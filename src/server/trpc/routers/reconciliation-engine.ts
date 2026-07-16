import { z } from 'zod';
import { and, asc, desc, eq, sql, gte, lte, sum } from 'drizzle-orm';
import { router } from '../index';
import { accountantProcedure, adminProcedure } from '../index';
import { TRPCError } from '@trpc/server';
import { schema } from '@/server/db';

export const reconciliationEngineRouter = router({
  // Run the 4-pass reconciliation engine
  run: adminProcedure
    .input(z.object({
      bankAccountId: z.string().uuid().optional(),
      dateRange: z.object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }).optional(),
      dryRun: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const conditions = [
        eq(schema.bankTransactions.companyId, ctx.companyId!),
        eq(schema.bankTransactions.status, 'unmatched'),
      ];

      if (input.bankAccountId) {
        conditions.push(eq(schema.bankTransactions.bankAccountId, input.bankAccountId));
      }

      if (input.dateRange) {
        conditions.push(
          gte(schema.bankTransactions.postedDate, input.dateRange.from),
          lte(schema.bankTransactions.postedDate, input.dateRange.to),
        );
      }

      const unmatchedTransactions = await db
        .select()
        .from(schema.bankTransactions)
        .where(and(...conditions))
        .orderBy(asc(schema.bankTransactions.postedDate));

      const rules = await db
        .select()
        .from(schema.reconciliationRules)
        .where(eq(schema.reconciliationRules.companyId, ctx.companyId!))
        .orderBy(asc(schema.reconciliationRules.priority));

      const postedEntries = await db
        .select({
          entryId: schema.journalEntries.id,
          postingDate: schema.journalEntries.postingDate,
          referenceNumber: schema.journalEntries.referenceNumber,
          description: schema.journalEntries.description,
          totalDebit: sum(schema.journalLines.debit).as('totalDebit'),
          totalCredit: sum(schema.journalLines.credit).as('totalCredit'),
        })
        .from(schema.journalEntries)
        .innerJoin(schema.journalLines, eq(schema.journalEntries.id, schema.journalLines.journalEntryId))
        .where(and(
          eq(schema.journalEntries.companyId, ctx.companyId!),
          eq(schema.journalEntries.isPosted, true),
        ))
        .groupBy(schema.journalEntries.id);

      interface JournalLine {
        entryId: string;
        lineId: string;
        accountId: string;
        debit: string;
        credit: string;
      }

      const entryLines = await db
        .select({
          entryId: schema.journalLines.journalEntryId,
          lineId: schema.journalLines.id,
          accountId: schema.journalLines.accountId,
          debit: schema.journalLines.debit,
          credit: schema.journalLines.credit,
        })
        .from(schema.journalLines)
        .innerJoin(schema.journalEntries, eq(schema.journalLines.journalEntryId, schema.journalEntries.id))
        .where(and(
          eq(schema.journalEntries.companyId, ctx.companyId!),
          eq(schema.journalEntries.isPosted, true),
        ));

      const entryLineMap = new Map<string, JournalLine[]>();
      for (const line of entryLines) {
        if (!entryLineMap.has(line.entryId)) {
          entryLineMap.set(line.entryId, []);
        }
        entryLineMap.get(line.entryId)!.push(line);
      }

      const openInvoices = await db
        .select({
          id: schema.invoices.id,
          invoiceNumber: schema.invoices.invoiceNumber,
          total: schema.invoices.total,
          issueDate: schema.invoices.issueDate,
          customerId: schema.invoices.customerId,
        })
        .from(schema.invoices)
        .where(and(
          eq(schema.invoices.companyId, ctx.companyId!),
          sql`${schema.invoices.status} IN ('sent', 'partial')`,
        ));

      const openBills = await db
        .select({
          id: schema.bills.id,
          billNumber: schema.bills.billNumber,
          total: schema.bills.total,
          issueDate: schema.bills.issueDate,
          vendorId: schema.bills.vendorId,
        })
        .from(schema.bills)
        .where(and(
          eq(schema.bills.companyId, ctx.companyId!),
          sql`${schema.bills.status} IN ('approved', 'partial')`,
        ));

      interface ReconciliationEntry {
        entryId: string;
        postingDate: string;
        totalDebit: number;
        totalCredit: number;
        netAmount: number;
        lines: JournalLine[];
        currency: string;
      }

      const entryMap = new Map<string, ReconciliationEntry>();
      for (const e of postedEntries) {
        entryMap.set(e.entryId, {
          ...e,
          totalDebit: Number(e.totalDebit || 0),
          totalCredit: Number(e.totalCredit || 0),
          netAmount: Number(e.totalDebit || 0) - Number(e.totalCredit || 0),
          currency: 'USD',
          lines: entryLineMap.get(e.entryId) || [],
        });
      }

      const results = {
        pass1_exact: [] as { transactionId: string; transactionAmount: string; matchedEntryId: string; matchType: string }[],
        pass2_split: [] as { transactionId: string; transactionAmount: string; matchedEntryIds: string[]; matchType: string }[],
        pass3_tolerance: [] as { transactionId: string; transactionAmount: string; matchedEntryId: string; difference: number; matchType: string }[],
        pass4_rules: [] as { transactionId: string; transactionAmount: string; matchedEntryId: string; ruleId: string; rulePattern: string; matchType: string }[],
        unmatched: [] as { transactionId: string; amount: string; description: string; postedDate: string }[],
        errors: [] as { transactionId: string; error: string; candidateCount?: number }[],
      };

      for (const txn of unmatchedTransactions) {
        let matched = false;

        const description = txn.description?.toLowerCase() || '';

        const exactMatches = Array.from(entryMap.values()).filter(e => {
          const dateDiff = Math.abs(
            new Date(e.postingDate).getTime() - new Date(txn.postedDate).getTime()
          ) / (1000 * 60 * 60 * 24);
          return (
            dateDiff <= 3 &&
            e.currency === 'USD' &&
            Math.abs(e.netAmount - Number(txn.amount)) < 0.01
          );
        });

        if (exactMatches.length === 1) {
          const match = exactMatches[0];
          if (!input.dryRun) {
            await ctx.db
              .update(schema.bankTransactions)
              .set({
                status: 'matched',
                matchedJournalEntryId: match.entryId,
                matchType: 'exact',
              })
              .where(eq(schema.bankTransactions.id, txn.id));
          }
          results.pass1_exact.push({
            transactionId: txn.id,
            transactionAmount: String(txn.amount),
            matchedEntryId: match.entryId,
            matchType: 'exact',
          });
          matched = true;
        } else if (exactMatches.length > 1) {
          results.errors.push({
            transactionId: txn.id,
            error: 'Multiple exact matches found',
            candidateCount: exactMatches.length,
          });
        }

        if (matched) continue;

        const txnAmount = Number(txn.amount);
        const splitMatches: string[] = [];

        const entriesArray = Array.from(entryMap.values());

        for (let i = 0; i < entriesArray.length - 1; i++) {
          for (let j = i + 1; j < entriesArray.length; j++) {
            const sum = entriesArray[i].netAmount + entriesArray[j].netAmount;
            if (Math.abs(sum - txnAmount) < 0.01) {
              splitMatches.push(entriesArray[i].entryId, entriesArray[j].entryId);
              break;
            }
          }
          if (splitMatches.length > 0) break;
        }

        if (splitMatches.length === 2) {
          if (!input.dryRun) {
            await ctx.db
              .update(schema.bankTransactions)
              .set({
                status: 'matched',
                matchedJournalEntryId: splitMatches[0],
                matchType: 'split',
              })
              .where(eq(schema.bankTransactions.id, txn.id));
          }
          results.pass2_split.push({
            transactionId: txn.id,
            transactionAmount: String(txn.amount),
            matchedEntryIds: splitMatches,
            matchType: 'split',
          });
          matched = true;
        }

        if (matched) continue;

        const tolerance = Math.max(5, Math.abs(txnAmount) * 0.01);
        const toleranceMatches = Array.from(entryMap.values()).filter(e => {
          const dateDiff = Math.abs(
            new Date(e.postingDate).getTime() - new Date(txn.postedDate).getTime()
          ) / (1000 * 60 * 60 * 24);
          return dateDiff <= 7 && Math.abs(e.netAmount - txnAmount) <= tolerance;
        });

        if (toleranceMatches.length === 1) {
          const match = toleranceMatches[0];
          const diff = Math.abs(match.netAmount - txnAmount);

          if (!input.dryRun) {
            await ctx.db
              .update(schema.bankTransactions)
              .set({
                status: 'matched',
                matchedJournalEntryId: match.entryId,
                matchType: 'tolerance',
              })
              .where(eq(schema.bankTransactions.id, txn.id));
          }
          results.pass3_tolerance.push({
            transactionId: txn.id,
            transactionAmount: String(txn.amount),
            matchedEntryId: match.entryId,
            difference: diff,
            matchType: 'tolerance',
          });
          matched = true;
        }

        if (matched) continue;

        for (const rule of rules) {
          const conditions = rule.conditions as { pattern?: string; targetAccountId?: string };
          const pattern = conditions?.pattern || '';
          const targetAccountId = conditions?.targetAccountId;

          if (pattern && description.includes(pattern.toLowerCase())) {
            if (targetAccountId) {
              const targetEntry = Array.from(entryMap.values()).find(e => 
                e.lines.some(l => l.accountId === targetAccountId)
              );

              if (targetEntry) {
                if (!input.dryRun) {
                  await ctx.db
                    .update(schema.bankTransactions)
                    .set({
                      status: 'matched',
                      matchedJournalEntryId: targetEntry.entryId,
                      matchType: 'rule',
                    })
                    .where(eq(schema.bankTransactions.id, txn.id));
                }
                results.pass4_rules.push({
                  transactionId: txn.id,
                  transactionAmount: String(txn.amount),
                  matchedEntryId: targetEntry.entryId,
                  ruleId: rule.id,
                  rulePattern: pattern,
                  matchType: 'rule',
                });
                matched = true;
                break;
              }
            }
          }
        }

        if (!matched) {
          results.unmatched.push({
            transactionId: txn.id,
            amount: String(txn.amount),
            description: txn.description || '',
            postedDate: txn.postedDate,
          });
        }
      }

      return {
        processed: unmatchedTransactions.length,
        ...results,
        summary: {
          total: unmatchedTransactions.length,
          matched: results.pass1_exact.length + results.pass2_split.length + results.pass3_tolerance.length + results.pass4_rules.length,
          unmatched: results.unmatched.length,
          errors: results.errors.length,
        },
      };
    }),

  // Get unmatched transactions
  getUnmatched: accountantProcedure
    .input(z.object({
      bankAccountId: z.string().uuid().optional(),
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const conditions = [
        eq(schema.bankTransactions.companyId, ctx.companyId!),
        eq(schema.bankTransactions.status, 'unmatched'),
      ];

      if (input.bankAccountId) {
        conditions.push(eq(schema.bankTransactions.bankAccountId, input.bankAccountId));
      }

      const offset = (input.page - 1) * input.pageSize;

      const [transactions, totalResult] = await Promise.all([
        db
          .select()
          .from(schema.bankTransactions)
          .where(and(...conditions))
          .orderBy(desc(schema.bankTransactions.postedDate))
          .limit(input.pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.bankTransactions)
          .where(and(...conditions)),
      ]);

      return {
        transactions,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total: Number(totalResult[0]?.count || 0),
          totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / input.pageSize),
        },
      };
    }),

  // Manually match transaction
  manualMatch: adminProcedure
    .input(z.object({
      transactionId: z.string().uuid(),
      journalEntryId: z.string().uuid(),
      matchType: z.enum(['exact', 'split', 'tolerance', 'rule', 'manual']),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [transaction] = await db
        .select()
        .from(schema.bankTransactions)
        .where(and(
          eq(schema.bankTransactions.id, input.transactionId),
          eq(schema.bankTransactions.companyId, ctx.companyId!)
        ));

      if (!transaction) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Transaction not found' });
      }

      if (transaction.status === 'matched') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Transaction already matched' });
      }

      const [entry] = await db
        .select()
        .from(schema.journalEntries)
        .where(and(
          eq(schema.journalEntries.id, input.journalEntryId),
          eq(schema.journalEntries.companyId, ctx.companyId!),
          eq(schema.journalEntries.isPosted, true)
        ));

      if (!entry) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Journal entry not found or not posted' });
      }

      const [updated] = await db
        .update(schema.bankTransactions)
        .set({
          status: 'matched',
          matchedJournalEntryId: input.journalEntryId,
          matchType: input.matchType,
        })
        .where(eq(schema.bankTransactions.id, input.transactionId))
        .returning();

      return updated;
    }),

  // Unmatch transaction
  unmatch: adminProcedure
    .input(z.object({
      transactionId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [updated] = await db
        .update(schema.bankTransactions)
        .set({
          status: 'unmatched',
          matchedJournalEntryId: null,
          matchType: null,
        })
        .where(eq(schema.bankTransactions.id, input.transactionId))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Transaction not found' });
      }

      return updated;
    }),
});