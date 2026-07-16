// Inngest client and functions for background jobs
import { Inngest } from 'inngest';
import { getDb } from '@/server/db';
import { schema } from '@/server/db/schema';
import { eq, and, sql, lte } from 'drizzle-orm';

// Initialize Inngest client
export const inngest = new Inngest({
  id: 'accounting-engine',
  name: 'Accounting Engine',
});

// ============================================
// BANK SYNC JOB - Runs daily via cron
// ============================================
export const bankSyncJob = inngest.createFunction(
  { id: 'bank-sync', name: 'Bank Sync' },
  async ({ step }) => {
    const db = getDb();

    const bankAccounts = await db
      .select()
      .from(schema.bankAccounts)
      .where(sql`${schema.bankAccounts.plaidItemId} IS NOT NULL`);

    let syncedCount = 0;

    for (const account of bankAccounts) {
      try {
        await step.run(`sync-${account.id}`, async () => {
          const mockTransactions = [
            {
              externalTransactionId: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              postedDate: '2024-01-15',
              amount: '-150.0000',
              description: 'Office Supplies',
              rawPayload: { category: 'Office Expenses' },
            },
          ];

          for (const txn of mockTransactions) {
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
                amount: txn.amount,
                description: txn.description,
                rawPayload: txn.rawPayload,
                status: 'unmatched',
              });
            }
          }

          await db.insert(schema.creditTransactions).values({
            companyId: account.companyId,
            amount: -1,
            reason: 'bank_sync',
            description: `Bank sync for account ${account.name}`,
          });

          await db.update(schema.creditBalances)
            .set({
              creditsRemaining: sql`${schema.creditBalances.creditsRemaining} - 1`,
            })
            .where(eq(schema.creditBalances.companyId, account.companyId));

          syncedCount++;
        });
      } catch (error) {
        console.error(`Bank sync failed for account ${account.id}:`, error);
      }
    }

    return { synced: syncedCount, accounts: bankAccounts.length };
  }
);

// ============================================
// RECEIPT OCR JOB - Triggered by receipt upload
// ============================================
export const receiptOcrJob = inngest.createFunction(
  { id: 'receipt-ocr', name: 'Receipt OCR' },
  async ({ step }) => {
    const db = getDb();

    // Mock implementation
    await step.run('update-status-processing', async () => {
      // Would update receipt status in real implementation
    });

    return { success: true };
  }
);

// ============================================
// DEPRECIATION POSTING JOB - Runs monthly
// ============================================
export const depreciationPostingJob = inngest.createFunction(
  { id: 'depreciation-posting', name: 'Depreciation Posting' },
  async ({ step }) => {
    const db = getDb();
    const today = '2024-01-15';

    const companies = await db.select({ id: schema.companies.id }).from(schema.companies);

    for (const company of companies) {
      try {
        await step.run(`depreciation-${company.id}`, async () => {
          const [period] = await db
            .select()
            .from(schema.accountingPeriods)
            .where(and(
              eq(schema.accountingPeriods.companyId, company.id),
              eq(schema.accountingPeriods.isClosed, false),
              lte(schema.accountingPeriods.startDate, today),
            ))
            .limit(1);

          if (!period) return;

          const assets = await db
            .select()
            .from(schema.fixedAssets)
            .where(eq(schema.fixedAssets.companyId, company.id));

          const [journal] = await db
            .select()
            .from(schema.journals)
            .where(and(
              eq(schema.journals.companyId, company.id),
              eq(schema.journals.code, 'DEPR')
            ))
            .limit(1);

          if (!journal) return;

          let depreciationCount = 0;

          for (const asset of assets) {
            let amount: number;
            const depreciableBase = Number(asset.cost) - Number(asset.salvageValue);
            amount = depreciableBase / asset.usefulLifeYears / 12;
            amount = Math.round(amount * 10000) / 10000;

            if (amount <= 0) continue;

            const [entry] = await db.insert(schema.journalEntries).values({
              companyId: company.id,
              journalId: journal.id,
              accountingPeriodId: period.id,
              entryDate: today,
              postingDate: today,
              referenceNumber: `DEPR-${period.id.slice(0, 8)}`,
              description: `Depreciation for ${asset.name}`,
              isPosted: true,
              createdBy: '00000000-0000-0000-0000-000000000000',
            }).returning();

            await db.insert(schema.journalLines).values([
              {
                journalEntryId: entry.id,
                accountId: asset.accumulatedDepreciationAccountId,
                description: `Accumulated depreciation - ${asset.name}`,
                debit: amount.toFixed(4),
                credit: '0.0000',
              },
              {
                journalEntryId: entry.id,
                accountId: asset.assetAccountId,
                description: `Depreciation - ${asset.name}`,
                debit: '0.0000',
                credit: amount.toFixed(4),
              },
            ]);

            depreciationCount++;
          }

          if (depreciationCount > 0) {
            await db.insert(schema.creditTransactions).values({
              companyId: company.id,
              amount: -depreciationCount,
              reason: 'depreciation_posting',
              description: `Posted ${depreciationCount} entries`,
            });
          }
        });
      } catch (error) {
        console.error(`Depreciation failed for company ${company.id}:`, error);
      }
    }

    return { processed: companies.length };
  }
);

// ============================================
// CREDIT RESET JOB - Runs monthly
// ============================================
export const creditResetJob = inngest.createFunction(
  { id: 'credit-reset', name: 'Credit Reset' },
  async ({ step }) => {
    const db = getDb();

    await step.run('reset-credits', async () => {
      // Mock implementation
    });

    return { reset: 0 };
  }
);

export const functions = [
  bankSyncJob,
  receiptOcrJob,
  depreciationPostingJob,
  creditResetJob,
];