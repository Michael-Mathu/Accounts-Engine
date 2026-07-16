import { createClient } from 'inngest';
import { getDb } from '@/server/db';
import { schema } from '@/server/db/schema';
import { eq, and, lte, sql } from 'drizzle-orm';

const inngest = new createClient({ id: 'accounting-engine' });

// Bank Sync Job - runs daily to fetch transactions from Plaid
export const bankSyncJob = inngest.createFunction(
  { id: 'bank-sync', name: 'Bank Sync' },
  { cron: '0 3 * * *' }, // 3 AM daily
  async ({ event, step }) => {
    const db = getDb();

    // Get all companies with Plaid-connected bank accounts
    const bankAccounts = await db
      .select()
      .from(schema.bankAccounts)
      .where(sql`${schema.bankAccounts.plaidItemId} IS NOT NULL`);

    for (const account of bankAccounts) {
      try {
        await step.run(`sync-${account.id}`, async () => {
          // In production: call Plaid API to fetch transactions
          // const transactions = await plaid.transactionsSync({ access_token: account.plaidAccessToken });

          // Mock: create sample transactions
          const mockTransactions = [
            { externalTransactionId: `txn_${Date.now()}_1`, postedDate: new Date(), amount: -150.00, description: 'Office Supplies', rawPayload: {} },
            { externalTransactionId: `txn_${Date.now()}_2`, postedDate: new Date(), amount: 2500.00, description: 'Customer Payment', rawPayload: {} },
          ];

          for (const txn of mockTransactions) {
            // Check for duplicate
            const [existing] = await db
              .select()
              .from(schema.bankTransactions)
              .where(and(
                eq(schema.bankTransactions.bankAccountId, account.id),
                eq(schema.bankTransactions.externalTransactionId, txn.externalTransactionId)
              ));

            if (!existing) {
              await db.insert(schema.bankTransactions).values({
                bankAccountId: account.id,
                companyId: account.companyId,
                externalTransactionId: txn.externalTransactionId,
                postedDate: txn.postedDate,
                amount: txn.amount.toFixed(4),
                description: txn.description,
                rawPayload: txn.rawPayload,
                status: 'unmatched',
              });
            }
          }

          // Consume credit for bank sync
          await db.insert(schema.creditTransactions).values({
            companyId: account.companyId,
            amount: -1,
            reason: 'bank_sync',
            description: `Bank sync for account ${account.name}`,
          });

          await db.update(schema.creditBalances)
            .set({ creditsRemaining: sql`${schema.creditBalances.creditsRemaining} - 1`, updatedAt: new Date() })
            .where(eq(schema.creditBalances.companyId, account.companyId));
        });
      } catch (error) {
        console.error(`Bank sync failed for account ${account.id}:`, error);
      }
    }

    return { synced: bankAccounts.length };
  }
);

// Receipt OCR Job - triggered when receipt is uploaded
export const receiptOcrJob = inngest.createFunction(
  { id: 'receipt-ocr', name: 'Receipt OCR' },
  { event: 'receipt/uploaded' },
  async ({ event, step }) => {
    const { receiptId, imageUrl } = event.data;
    const db = getDb();

    try {
      await step.run('update-status-processing', async () => {
        await db
          .update(schema.receipts)
          .set({ status: 'processing' })
          .where(eq(schema.receipts.id, receiptId));
      });

      // In production: call Anthropic VLM
      // const extracted = await anthropic.messages.create({...});

      const extractedData = await step.run('extract-receipt', async () => {
        // Mock extraction
        return {
          merchant: 'Office Supplies Plus',
          date: new Date().toISOString().split('T')[0],
          subtotal: 200.00,
          tax: 20.00,
          total: 220.00,
          currency: 'USD',
          lineItems: [{ description: 'Office supplies', quantity: 1, unitPrice: 200.00, amount: 200.00 }],
          category: 'office_supplies',
          paymentMethod: 'credit',
          confidence: 0.92,
        };
      });

      await step.run('update-receipt', async () => {
        await db
          .update(schema.receipts)
          .set({
            extractedData: extractedData,
            status: 'processed',
          })
          .where(eq(schema.receipts.id, receiptId));
      });

      // Consume credit
      await step.run('consume-credit', async () => {
        const [receipt] = await db
          .select()
          .from(schema.receipts)
          .where(eq(schema.receipts.id, receiptId));

        if (receipt) {
          await db.insert(schema.creditTransactions).values({
            companyId: receipt.companyId,
            amount: -1,
            reason: 'receipt_ocr',
            description: `Receipt OCR for ${extractedData.merchant}`,
          });

          await db.update(schema.creditBalances)
            .set({ creditsRemaining: sql`${schema.creditBalances.creditsRemaining} - 1`, updatedAt: new Date() })
            .where(eq(schema.creditBalances.companyId, receipt.companyId));
        }
      });

      // Auto-create draft journal entry
      await step.run('create-draft-entry', async () => {
        const [receipt] = await db
          .select()
          .from(schema.receipts)
          .where(eq(schema.receipts.id, receiptId));

        if (receipt && extractedData.total > 0) {
          // Get default expense account
          const [expenseAccount] = await db
            .select()
            .from(schema.accounts)
            .innerJoin(schema.accountTypes, eq(schema.accounts.accountTypeId, schema.accountTypes.id))
            .where(and(
              eq(schema.accounts.companyId, receipt.companyId),
              eq(schema.accountTypes.class, 'expense'),
              eq(schema.accounts.isActive, true)
            ))
            .limit(1);

          // Get default cash account
          const [cashAccount] = await db
            .select()
            .from(schema.accounts)
            .innerJoin(schema.accountTypes, eq(schema.accounts.accountTypeId, schema.accountTypes.id))
            .where(and(
              eq(schema.accounts.companyId, receipt.companyId),
              eq(schema.accountTypes.class, 'asset'),
              eq(schema.accountTypes.name, 'Bank'),
              eq(schema.accounts.isActive, true)
            ))
            .limit(1);

          if (expenseAccount && cashAccount) {
            // Get default journal and period
            const [journal] = await db
              .select()
              .from(schema.journals)
              .where(eq(schema.journals.companyId, receipt.companyId))
              .limit(1);

            const [period] = await db
              .select()
              .from(schema.accountingPeriods)
              .where(and(
                eq(schema.accountingPeriods.companyId, receipt.companyId),
                eq(schema.accountingPeriods.isClosed, false)
              ))
              .limit(1);

            if (journal && period) {
              const [entry] = await db
                .insert(schema.journalEntries)
                .values({
                  journalId: journal.id,
                  accountingPeriodId: period.id,
                  entryDate: extractedData.date,
                  postingDate: new Date(),
                  referenceNumber: `RCPT-${receiptId.slice(0, 8)}`,
                  description: `Receipt: ${extractedData.merchant}`,
                  isPosted: false,
                  createdBy: receipt.uploadedBy,
                })
                .returning();

              await db.insert(schema.journalLines).values([
                {
                  journalEntryId: entry.id,
                  accountId: expenseAccount.accounts.id,
                  description: extractedData.merchant,
                  debit: extractedData.total.toFixed(4),
                  credit: '0.0000',
                },
                {
                  journalEntryId: entry.id,
                  accountId: cashAccount.accounts.id,
                  description: extractedData.merchant,
                  debit: '0.0000',
                  credit: extractedData.total.toFixed(4),
                },
              ]);

              await db
                .update(schema.receipts)
                .set({ draftJournalEntryId: entry.id })
                .where(eq(schema.receipts.id, receiptId));
            }
          }
        }
      });

      return { success: true, receiptId };
    } catch (error) {
      await db
        .update(schema.receipts)
        .set({ status: 'failed' })
        .where(eq(schema.receipts.id, receiptId));

      console.error('Receipt OCR failed:', error);
      return { success: false, error: String(error) };
    }
  }
);

// Depreciation Posting Job - runs monthly
export const depreciationPostingJob = inngest.createFunction(
  { id: 'depreciation-posting', name: 'Depreciation Posting' },
  { cron: '0 4 1 * *' }, // 4 AM on 1st of month
  async ({ event, step }) => {
    const db = getDb();

    // Get all fixed assets with depreciation schedules for current period
    const assets = await db
      .select()
      .from(schema.fixedAssets)
      .innerJoin(schema.depreciationSchedules, eq(schema.fixedAssets.id, schema.depreciationSchedules.fixedAssetId))
      .where(and(
        eq(schema.depreciationSchedules.isPosted, false),
        eq(schema.depreciationSchedules.accountingPeriodId, sql`(SELECT id FROM accounting_periods WHERE is_closed = false LIMIT 1)`)
      ));

    for (const asset of assets) {
      try {
        await step.run(`post-depreciation-${asset.fixedAssets.id}`, async () => {
          const [assetAccount] = await db
            .select()
            .from(schema.accounts)
            .where(eq(schema.accounts.id, asset.fixedAssets.assetAccountId));

          const [accumulatedAccount] = await db
            .select()
            .from(schema.accounts)
            .where(eq(schema.accounts.id, asset.fixedAssets.accumulatedDepreciationAccountId));

          const [journal] = await db
            .select()
            .from(schema.journals)
            .where(eq(schema.journals.companyId, asset.fixedAssets.companyId))
            .limit(1);

          const [period] = await db
            .select()
            .from(schema.accountingPeriods)
            .where(and(
              eq(schema.accountingPeriods.companyId, asset.fixedAssets.companyId),
              eq(schema.accountingPeriods.isClosed, false)
            ))
            .limit(1);

          if (!journal || !period) return;

          const amount = asset.depreciationSchedules.amount;

          const [entry] = await db
            .insert(schema.journalEntries)
            .values({
              journalId: journal.id,
              accountingPeriodId: period.id,
              entryDate: new Date(),
              postingDate: new Date(),
              referenceNumber: `DEPR-${asset.fixedAssets.id.slice(0, 8)}`,
              description: `Depreciation: ${asset.fixedAssets.name}`,
              isPosted: true,
              createdBy: asset.fixedAssets.id, // System user
            })
            .returning();

          await db.insert(schema.journalLines).values([
            {
              journalEntryId: entry.id,
              accountId: assetAccount.id,
              description: `Depreciation: ${asset.fixedAssets.name}`,
              debit: '0.0000',
              credit: amount.toFixed(4),
            },
            {
              journalEntryId: entry.id,
              accountId: accumulatedAccount.id,
              description: `Depreciation: ${asset.fixedAssets.name}`,
              debit: amount.toFixed(4),
              credit: '0.0000',
            },
          ]);

          await db
            .update(schema.depreciationSchedules)
            .set({ isPosted: true, journalEntryId: entry.id })
            .where(eq(schema.depreciationSchedules.id, asset.depreciationSchedules.id));
        });
      } catch (error) {
        console.error(`Depreciation posting failed for asset ${asset.fixedAssets.id}:`, error);
      }
    }

    return { processed: assets.length };
  }
);

// Credit Metering Job - tracks feature usage
export const creditMeteringJob = inngest.createFunction(
  { id: 'credit-metering', name: 'Credit Metering' },
  { event: 'credit/consume' },
  async ({ event, step }) => {
    const { companyId, amount, reason, description } = event.data;
    const db = getDb();

    await step.run('consume-credits', async () => {
      await db.insert(schema.creditTransactions).values({
        companyId,
        amount: -amount,
        reason,
        description,
      });

      await db.update(schema.creditBalances)
        .set({ creditsRemaining: sql`${schema.creditBalances.creditsRemaining} - ${amount}`, updatedAt: new Date() })
        .where(eq(schema.creditBalances.companyId, companyId));

      // Check if balance is low
      const [balance] = await db
        .select()
        .from(schema.creditBalances)
        .where(eq(schema.creditBalances.companyId, companyId));

      if (balance && balance.creditsRemaining < 10) {
        // In production: send notification
        console.log(`Low credit alert for company ${companyId}: ${balance.creditsRemaining} credits remaining`);
      }
    });

    return { success: true };
  }
);

export { inngest };