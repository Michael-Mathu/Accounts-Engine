import { z } from 'zod';
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { router } from '../index';
import { accountantProcedure, adminProcedure } from '../index';
import { TRPCError } from '@trpc/server';
import { schema } from '@/server/db';

export const bankAccountsRouter = router({
  create: accountantProcedure
    .input(z.object({
      name: z.string().min(1).max(150),
      ledgerAccountId: z.string().uuid(),
      plaidItemId: z.string().optional(),
      plaidAccessTokenEncrypted: z.string().optional(),
      currency: z.string().length(3).default('USD'),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      // Validate ledger account
      const [ledgerAccount] = await db
        .select()
        .from(schema.accounts)
        .where(and(
          eq(schema.accounts.id, input.ledgerAccountId),
          eq(schema.accounts.companyId, ctx.companyId!)
        ));

      if (!ledgerAccount) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Ledger account not found' });
      }

      const [bankAccount] = await db
        .insert(schema.bankAccounts)
        .values([{
          companyId: ctx.companyId!,
          name: input.name,
          ledgerAccountId: input.ledgerAccountId,
          plaidItemId: input.plaidItemId,
          plaidAccessTokenEncrypted: input.plaidAccessTokenEncrypted,
          currency: input.currency,
        }])
        .returning();

      return bankAccount;
    }),

  list: accountantProcedure
    .query(async ({ ctx }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const bankAccounts = await db
        .select({
          id: schema.bankAccounts.id,
          name: schema.bankAccounts.name,
          ledgerAccountId: schema.bankAccounts.ledgerAccountId,
          ledgerAccountCode: schema.accounts.code,
          ledgerAccountName: schema.accounts.name,
          plaidItemId: schema.bankAccounts.plaidItemId,
          currency: schema.bankAccounts.currency,
          createdAt: schema.bankAccounts.createdAt,
        })
        .from(schema.bankAccounts)
        .innerJoin(schema.accounts, eq(schema.bankAccounts.ledgerAccountId, schema.accounts.id))
        .where(eq(schema.bankAccounts.companyId, ctx.companyId!))
        .orderBy(asc(schema.bankAccounts.name));

      return bankAccounts;
    }),

  getById: accountantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [bankAccount] = await db
        .select({
          id: schema.bankAccounts.id,
          name: schema.bankAccounts.name,
          ledgerAccountId: schema.bankAccounts.ledgerAccountId,
          ledgerAccountCode: schema.accounts.code,
          ledgerAccountName: schema.accounts.name,
          plaidItemId: schema.bankAccounts.plaidItemId,
          currency: schema.bankAccounts.currency,
          createdAt: schema.bankAccounts.createdAt,
        })
        .from(schema.bankAccounts)
        .innerJoin(schema.accounts, eq(schema.bankAccounts.ledgerAccountId, schema.accounts.id))
        .where(and(
          eq(schema.bankAccounts.id, input.id),
          eq(schema.bankAccounts.companyId, ctx.companyId!)
        ));

      if (!bankAccount) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bank account not found' });
      }

      return bankAccount;
    }),

  // Sync with Plaid (stub)
  sync: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // In production, this would queue an Inngest job to sync with Plaid
      return { success: true, message: 'Sync queued' };
    }),

  // Get reconciliation status
  getReconciliationStatus: accountantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [bankAccount] = await db
        .select()
        .from(schema.bankAccounts)
        .where(and(
          eq(schema.bankAccounts.id, input.id),
          eq(schema.bankAccounts.companyId, ctx.companyId!)
        ));

      if (!bankAccount) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bank account not found' });
      }

      // Get unmatched transactions
      const unmatched = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.bankTransactions)
        .where(and(
          eq(schema.bankTransactions.bankAccountId, input.id),
          eq(schema.bankTransactions.status, 'unmatched')
        ));

      // Get last statement balance
      const latestTransaction = await db
        .select()
        .from(schema.bankTransactions)
        .where(eq(schema.bankTransactions.bankAccountId, input.id))
        .orderBy(desc(schema.bankTransactions.postedDate))
        .limit(1);

      return {
        bankAccount,
        unmatchedCount: Number(unmatched[0]?.count || 0),
        lastTransaction: latestTransaction[0],
      };
    }),
});

export const bankTransactionsRouter = router({
  list: accountantProcedure
    .input(z.object({
      bankAccountId: z.string().uuid().optional(),
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(200).default(50),
      status: z.enum(['unmatched', 'matched', 'excluded']).optional(),
      fromDate: z.string().transform(val => new Date(val)).optional(),
      toDate: z.string().transform(val => new Date(val)).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const conditions = [
        eq(schema.bankTransactions.companyId, ctx.companyId!),
      ];

      if (input.bankAccountId) {
        conditions.push(eq(schema.bankTransactions.bankAccountId, input.bankAccountId));
      }
      if (input.status) {
        conditions.push(eq(schema.bankTransactions.status, input.status));
      }
      if (input.fromDate) {
        conditions.push(gte(schema.bankTransactions.postedDate, input.fromDate.toISOString().split('T')[0]));
      }
      if (input.toDate) {
        conditions.push(lte(schema.bankTransactions.postedDate, input.toDate.toISOString().split('T')[0]));
      }

      const offset = (input.page - 1) * input.pageSize;

      const [transactions, totalResult] = await Promise.all([
        db
          .select({
            id: schema.bankTransactions.id,
            bankAccountId: schema.bankTransactions.bankAccountId,
            bankAccountName: schema.bankAccounts.name,
            externalTransactionId: schema.bankTransactions.externalTransactionId,
            postedDate: schema.bankTransactions.postedDate,
            amount: schema.bankTransactions.amount,
            description: schema.bankTransactions.description,
            status: schema.bankTransactions.status,
            matchType: schema.bankTransactions.matchType,
            matchedJournalEntryId: schema.bankTransactions.matchedJournalEntryId,
            createdAt: schema.bankTransactions.createdAt,
          })
          .from(schema.bankTransactions)
          .leftJoin(schema.bankAccounts, eq(schema.bankTransactions.bankAccountId, schema.bankAccounts.id))
          .where(and(...conditions))
          .orderBy(desc(schema.bankTransactions.postedDate), desc(schema.bankTransactions.createdAt))
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

  // Import transactions from CSV/OFX
  import: accountantProcedure
    .input(z.object({
      bankAccountId: z.string().uuid(),
      transactions: z.array(z.object({
        externalTransactionId: z.string().optional(),
        postedDate: z.string().transform(val => new Date(val)),
        amount: z.number(),
        description: z.string(),
        rawPayload: z.object({}).passthrough().optional(),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      // Verify bank account belongs to company
      const [bankAccount] = await db
        .select()
        .from(schema.bankAccounts)
        .where(and(
          eq(schema.bankAccounts.id, input.bankAccountId),
          eq(schema.bankAccounts.companyId, ctx.companyId!)
        ));

      if (!bankAccount) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bank account not found' });
      }

      // Check for duplicates
      const externalIds = input.transactions
        .filter(t => t.externalTransactionId)
        .map(t => t.externalTransactionId!);

      const existing = externalIds.length > 0
        ? await db
            .select({ externalTransactionId: schema.bankTransactions.externalTransactionId })
            .from(schema.bankTransactions)
            .where(and(
              eq(schema.bankTransactions.bankAccountId, input.bankAccountId),
              sql`${schema.bankTransactions.externalTransactionId} IN (${externalIds.join(',')})`
            ))
        : [];

      const existingIds = new Set(existing.map((e: { externalTransactionId: string | null }) => e.externalTransactionId));

      const toInsert = input.transactions
        .filter(t => !t.externalTransactionId || !existingIds.has(t.externalTransactionId))
        .map(t => ({
          bankAccountId: input.bankAccountId,
          companyId: ctx.companyId!,
          externalTransactionId: t.externalTransactionId,
          postedDate: t.postedDate.toISOString().split('T')[0],
          amount: String(t.amount),
          description: t.description,
          rawPayload: t.rawPayload,
          status: 'unmatched' as const,
        }));

      if (toInsert.length > 0) {
        await db.insert(schema.bankTransactions).values(toInsert);
      }

      return {
        inserted: toInsert.length,
        duplicates: input.transactions.length - toInsert.length,
      };
    }),

  // Match transaction to journal entry
  match: accountantProcedure
    .input(z.object({
      transactionId: z.string().uuid(),
      journalEntryId: z.string().uuid(),
      matchType: z.enum(['exact', 'split', 'tolerance', 'rule']),
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

      // Verify journal entry exists and is posted
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

      // Check amounts match (for exact match)
      if (input.matchType === 'exact') {
        const lines = await db
          .select({ debit: schema.journalLines.debit, credit: schema.journalLines.credit })
          .from(schema.journalLines)
          .where(eq(schema.journalLines.journalEntryId, input.journalEntryId));

        const totalDebit = lines.reduce((sum: number, l: { debit: string | null; credit: string | null }) => sum + Number(l.debit), 0);
        const totalCredit = lines.reduce((sum: number, l: { debit: string | null; credit: string | null }) => sum + Number(l.credit), 0);
        const netEntry = totalDebit - totalCredit;

        if (Math.abs(netEntry - Number(transaction.amount)) > 0.01) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: `Entry amount (${netEntry.toFixed(2)}) does not match transaction (${Number(transaction.amount).toFixed(2)})` 
          });
        }
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

  // Exclude transaction
  exclude: accountantProcedure
    .input(z.object({
      transactionId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [updated] = await db
        .update(schema.bankTransactions)
        .set({ status: 'excluded' })
        .where(and(
          eq(schema.bankTransactions.id, input.transactionId),
          eq(schema.bankTransactions.companyId, ctx.companyId!)
        ))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Transaction not found' });
      }

      return updated;
    }),
});