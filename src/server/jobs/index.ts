// Inngest client and functions for background jobs
import { createClient } from 'inngest';
import { getDb } from '@/server/db';
import { schema } from '@/server/db/schema';
import { eq, and, sql, lte, desc } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Inngest client
export const inngest = new createClient({
  id: 'accounting-engine',
  name: 'Accounting Engine',
  eventKey: process.env.INNGEST_EVENT_KEY,
  baseUrl: process.env.INNGEST_BASE_URL,
});

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================
// BANK SYNC JOB - Runs daily via cron
// ============================================
export const bankSyncJob = inngest.createFunction(
  { id: 'bank-sync', name: 'Bank Sync', retries: 3 },
  { cron: '0 3 * * *' }, // 3 AM UTC daily
  async ({ step, event }) => {
    const db = getDb();

    // Get all companies with Plaid-connected bank accounts
    const bankAccounts = await db
      .select()
      .from(schema.bankAccounts)
      .where(sql`${schema.bankAccounts.plaidItemId} IS NOT NULL`);

    let syncedCount = 0;

    for (const account of bankAccounts) {
      try {
        await step.run(`sync-${account.id}`, async () => {
          // In production: call Plaid API to fetch transactions
          // const response = await plaidClient.transactionsSync({
          //   access_token: decrypt(account.plaidAccessTokenEncrypted!),
          // });

          // Mock: create sample transactions for demonstration
          const mockTransactions = [
            {
              externalTransactionId: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              postedDate: new Date(),
              amount: -150.00,
              description: 'Office Supplies',
              rawPayload: { category: 'Office Expenses' },
            },
            {
              externalTransactionId: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              postedDate: new Date(),
              amount: 2500.00,
              description: 'Customer Payment - Acme Corp',
              rawPayload: { category: 'Income' },
            },
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
            .set({
              creditsRemaining: sql`${schema.creditBalances.creditsRemaining} - 1`,
              updatedAt: new Date(),
            })
            .where(eq(schema.creditBalances.companyId, account.companyId));

          syncedCount++;
        });
      } catch (error) {
        console.error(`Bank sync failed for account ${account.id}:`, error);
        // Continue with other accounts
      }
    }

    return { synced: syncedCount, accounts: bankAccounts.length };
  }
);

// ============================================
// RECEIPT OCR JOB - Triggered by receipt upload
// ============================================
export const receiptOcrJob = inngest.createFunction(
  { id: 'receipt-ocr', name: 'Receipt OCR', retries: 2 },
  { event: 'receipt/uploaded' },
  async ({ event, step }) => {
    const { receiptId, imageUrl } = event.data;
    const db = getDb();

    const EXTRACTION_PROMPT = `You are an expert receipt extraction system. Extract the following information from the receipt image and return it as valid JSON.

Extract these fields:
{
  "merchant": "string - merchant/business name",
  "date": "string - transaction date in YYYY-MM-DD format",
  "time": "string - transaction time in HH:MM format (24-hour)",
  "subtotal": "number - subtotal before tax",
  "tax": "number - tax amount",
  "total": "number - total amount paid",
  "currency": "string - 3-letter currency code (default USD)",
  "lineItems": [
    {"description": "string", "quantity": "number", "unitPrice": "number", "amount": "number"}
  ],
  "category": "string - expense category (e.g., meals, travel, office supplies)",
  "paymentMethod": "string - payment method (cash, credit, debit, etc.)",
  "confidence": "number - 0-1 confidence score for extraction accuracy"
}

Rules:
1. If a field cannot be determined, use null
2. Dates must be in YYYY-MM-DD format
3. All amounts must be numbers (not strings)
4. Line items are optional but preferred
5. Return ONLY valid JSON, no markdown or explanation`;

    try {
      // Update status to processing
      await step.run('update-status-processing', async () => {
        await db
          .update(schema.receipts)
          .set({ status: 'processing' })
          .where(eq(schema.receipts.id, receiptId));
      });

      // Call Anthropic API for receipt extraction
      const extractedData = await step.run('extract-receipt', async () => {
        try {
          const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2048,
            temperature: 0,
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: EXTRACTION_PROMPT },
                { type: 'image', source: { type: 'url', url: imageUrl } },
              ],
            }],
          });

          const content = response.content[0];
          if (content.type !== 'text') {
            throw new Error('Unexpected response type from Anthropic');
          }

          // Parse JSON from response
          let extractedData;
          try {
            const jsonMatch = content.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              extractedData = JSON.parse(jsonMatch[0]);
            } else {
              extractedData = JSON.parse(content.text);
            }
          } catch (parseError) {
            console.error('Failed to parse Anthropic response:', content.text);
            throw new Error('Failed to parse extraction result');
          }

          return extractedData;
        } catch (error) {
          console.error('Anthropic API error:', error);
          throw error;
        }
      });

      // Validate extracted data
      const validatedData = {
        merchant: extractedData.merchant || null,
        date: extractedData.date ? new Date(extractedData.date) : null,
        time: extractedData.time || null,
        subtotal: typeof extractedData.subtotal === 'number' ? extractedData.subtotal : null,
        tax: typeof extractedData.tax === 'number' ? extractedData.tax : null,
        total: typeof extractedData.total === 'number' ? extractedData.total : null,
        currency: extractedData.currency || 'USD',
        lineItems: Array.isArray(extractedData.lineItems) ? extractedData.lineItems : [],
        category: extractedData.category || null,
        paymentMethod: extractedData.paymentMethod || null,
        confidence: typeof extractedData.confidence === 'number' ? extractedData.confidence : 0.5,
      };

      // Update receipt with extracted data
      await step.run('update-receipt', async () => {
        await db
          .update(schema.receipts)
          .set({
            extractedData: validatedData,
            status: 'processed',
          })
          .where(eq(schema.receipts.id, receiptId));
      });

      // Consume credit for OCR
      await step.run('consume-credit', async () => {
        await db.insert(schema.creditTransactions).values({
          companyId: (await db.select({ companyId: schema.receipts.companyId })
            .from(schema.receipts)
            .where(eq(schema.receipts.id, receiptId)))[0].companyId,
          amount: -1,
          reason: 'receipt_ocr',
          description: `Receipt OCR extraction for ${validatedData.merchant || 'receipt'}`,
        });

        await db.update(schema.creditBalances)
          .set({
            creditsRemaining: sql`${schema.creditBalances.creditsRemaining} - 1`,
            updatedAt: new Date(),
          })
          .where(eq(schema.creditBalances.companyId, (await db.select({ companyId: schema.receipts.companyId })
            .from(schema.receipts)
            .where(eq(schema.receipts.id, receiptId)))[0].companyId));
      });

      return {
        success: true,
        receiptId,
        extractedData: validatedData,
      };
    } catch (error) {
      // Update receipt status to failed
      await step.run('update-status-failed', async () => {
        await db
          .update(schema.receipts)
          .set({ status: 'failed' })
          .where(eq(schema.receipts.id, receiptId));
      });

      console.error('Receipt OCR failed:', error);
      throw error;
    }
  }
);

// ============================================
// DEPRECIATION POSTING JOB - Runs monthly
// ============================================
export const depreciationPostingJob = inngest.createFunction(
  { id: 'depreciation-posting', name: 'Depreciation Posting', retries: 2 },
  { cron: '0 2 1 * *' }, // 2 AM on 1st of each month
  async ({ step }) => {
    const db = getDb();

    // Get all companies
    const companies = await db.select({ id: schema.companies.id }).from(schema.companies);

    for (const company of companies) {
      try {
        await step.run(`depreciation-${company.id}`, async () => {
          // Get current open accounting period
          const [period] = await db
            .select()
            .from(schema.accountingPeriods)
            .where(and(
              eq(schema.accountingPeriods.companyId, company.id),
              eq(schema.accountingPeriods.isClosed, false),
              lte(schema.accountingPeriods.startDate, new Date()),
              sql`${schema.accountingPeriods.endDate} >= CURRENT_DATE`
            ))
            .limit(1);

          if (!period) {
            console.log(`No open period for company ${company.id}`);
            return;
          }

          // Get fixed assets that need depreciation this period
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

          if (!journal) {
            console.warn(`No depreciation journal found for company ${company.id}`);
            return;
          }

          let depreciationCount = 0;

          for (const asset of assets) {
            // Check if depreciation already posted for this period
            const [existing] = await db
              .select()
              .from(schema.depreciationSchedules)
              .where(and(
                eq(schema.depreciationSchedules.fixedAssetId, asset.id),
                eq(schema.depreciationSchedules.accountingPeriodId, period.id)
              ));

            if (existing?.isPosted) continue;

            // Calculate depreciation amount
            let amount: number;
            const depreciableBase = Number(asset.cost) - Number(asset.salvageValue);

            switch (asset.method) {
              case 'straight_line':
                amount = depreciableBase / asset.usefulLifeYears / 12; // Monthly
                break;
              case 'declining_balance':
                // Double declining balance
                const rate = 2 / asset.usefulLifeYears;
                // Would need accumulated depreciation tracking for full implementation
                amount = depreciableBase * rate / 12;
                break;
              case 'sum_of_years_digits':
                // Simplified - would need year tracking
                amount = depreciableBase / asset.usefulLifeYears / 12;
                break;
              default:
                amount = depreciableBase / asset.usefulLifeYears / 12;
            }

            amount = Math.round(amount * 10000) / 10000; // Round to 4 decimals

            if (amount <= 0) continue;

            // Create depreciation journal entry
            const [entry] = await db.insert(schema.journalEntries).values({
              journalId: journal.id,
              accountingPeriodId: period.id,
              entryDate: new Date(),
              postingDate: new Date(),
              referenceNumber: `DEPR-${period.id.slice(0, 8)}`,
              description: `Depreciation for ${asset.name} (${asset.method})`,
              isPosted: true,
              createdBy: asset.assetAccountId, // Using asset account as creator placeholder
            }).returning();

            // Debit depreciation expense, credit accumulated depreciation
            await db.insert(schema.journalLines).values([
              {
                journalEntryId: entry.id,
                accountId: asset.assetAccountId,
                description: `Depreciation - ${asset.name}`,
                debit: '0.0000',
                credit: amount.toFixed(4),
              },
              {
                journalEntryId: entry.id,
                accountId: asset.accumulatedDepreciationAccountId,
                description: `Accumulated depreciation - ${asset.name}`,
                debit: amount.toFixed(4),
                credit: '0.0000',
              },
            ]);

            // Update depreciation schedule
            if (existing) {
              await db.update(schema.depreciationSchedules)
                .set({ amount: amount.toFixed(4), isPosted: true, journalEntryId: entry.id })
                .where(eq(schema.depreciationSchedules.id, existing.id));
            } else {
              await db.insert(schema.depreciationSchedules).values({
                fixedAssetId: asset.id,
                accountingPeriodId: period.id,
                amount: amount.toFixed(4),
                isPosted: true,
                journalEntryId: entry.id,
              });
            }

            depreciationCount++;
          }

          // Consume credit for depreciation posting
          if (depreciationCount > 0) {
            await db.insert(schema.creditTransactions).values({
              companyId: company.id,
              amount: -depreciationCount,
              reason: 'depreciation_posting',
              description: `Posted ${depreciationCount} depreciation entries`,
            });

            await db.update(schema.creditBalances)
              .set({ creditsRemaining: sql`${schema.creditBalances.creditsRemaining} - ${depreciationCount}`, updatedAt: new Date() })
              .where(eq(schema.creditBalances.companyId, company.id));
          }
        });
      } catch (error) {
        console.error(`Depreciation posting failed for company ${company.id}:`, error);
      }
    }

    return { processed: companies.length };
  }
);

// ============================================
// CREDIT RESET JOB - Runs monthly
// ============================================
export const creditResetJob = inngest.createFunction(
  { id: 'credit-reset', name: 'Credit Reset', retries: 1 },
  { cron: '0 0 1 * *' }, // Midnight on 1st of each month
  async ({ step }) => {
    const db = getDb();

    // Reset credits for subscription plans that include monthly credits
    await step.run('reset-credits', async () => {
      const subscriptions = await db
        .select()
        .from(schema.subscriptions)
        .where(and(
          eq(schema.subscriptions.status, 'active'),
          sql`${schema.subscriptions.plan} IN ('monthly', 'quarterly', 'annual')`
        ));

      for (const sub of subscriptions) {
        const creditsPerPeriod = sub.plan === 'monthly' ? 1000 : sub.plan === 'quarterly' ? 3000 : 12000;

        await db.update(schema.creditBalances)
          .set({
            creditsRemaining: creditsPerPeriod,
            lastResetAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.creditBalances.companyId, sub.companyId));

        await db.insert(schema.creditTransactions).values({
          companyId: sub.companyId,
          amount: creditsPerPeriod,
          reason: 'purchase',
          description: `Monthly credit reset for ${sub.plan} plan`,
        });
      }
    });

    return { reset: subscriptions.length };
  }
);

// Export all functions
export const functions = [
  bankSyncJob,
  receiptOcrJob,
  depreciationPostingJob,
  creditResetJob,
];