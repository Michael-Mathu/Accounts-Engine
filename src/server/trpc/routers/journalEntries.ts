import { z } from 'zod';
import { and, asc, desc, eq, sql, gte, lte } from 'drizzle-orm';
import { router } from '../index';
import { accountantProcedure, adminProcedure } from '../index';
import { TRPCError } from '@trpc/server';
import { schema } from '@/server/db';

export const journalEntriesRouter = router({
  // List journal entries with filtering and pagination
  list: accountantProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(25),
      journalId: z.string().uuid().optional(),
      accountingPeriodId: z.string().uuid().optional(),
      fromDate: z.string().transform(val => new Date(val)).optional(),
      toDate: z.string().transform(val => new Date(val)).optional(),
      isPosted: z.boolean().optional(),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const conditions = [
        eq(schema.journalEntries.companyId, ctx.companyId!),
      ];

      if (input.journalId) {
        conditions.push(eq(schema.journalEntries.journalId, input.journalId));
      }
      if (input.accountingPeriodId) {
        conditions.push(eq(schema.journalEntries.accountingPeriodId, input.accountingPeriodId));
      }
      if (input.isPosted !== undefined) {
        conditions.push(eq(schema.journalEntries.isPosted, input.isPosted));
      }
      if (input.fromDate) {
        conditions.push(gte(schema.journalEntries.postingDate, input.fromDate.toISOString().split('T')[0]));
      }
      if (input.toDate) {
        conditions.push(lte(schema.journalEntries.postingDate, input.toDate.toISOString().split('T')[0]));
      }
      if (input.search) {
        conditions.push(
          sql`${schema.journalEntries.referenceNumber} ILIKE ${'%' + input.search + '%'} OR ${schema.journalEntries.description} ILIKE ${'%' + input.search + '%'}`
        );
      }

      const offset = (input.page - 1) * input.pageSize;

      const [entries, totalResult] = await Promise.all([
        db
          .select({
            id: schema.journalEntries.id,
            journalId: schema.journalEntries.journalId,
            accountingPeriodId: schema.journalEntries.accountingPeriodId,
            entryDate: schema.journalEntries.entryDate,
            postingDate: schema.journalEntries.postingDate,
            referenceNumber: schema.journalEntries.referenceNumber,
            description: schema.journalEntries.description,
            isPosted: schema.journalEntries.isPosted,
            reversedEntryId: schema.journalEntries.reversedEntryId,
            createdBy: schema.journalEntries.createdBy,
            createdAt: schema.journalEntries.createdAt,
            journalCode: schema.journals.code,
            journalName: schema.journals.name,
            periodName: schema.accountingPeriods.name,
            createdByName: schema.users.name,
            createdByEmail: schema.users.email,
          })
          .from(schema.journalEntries)
          .innerJoin(schema.journals, eq(schema.journalEntries.journalId, schema.journals.id))
          .innerJoin(schema.accountingPeriods, eq(schema.journalEntries.accountingPeriodId, schema.accountingPeriods.id))
          .leftJoin(schema.users, eq(schema.journalEntries.createdBy, schema.users.id))
          .where(and(...conditions))
          .orderBy(desc(schema.journalEntries.postingDate), desc(schema.journalEntries.createdAt))
          .limit(input.pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.journalEntries)
          .where(and(...conditions)),
      ]);

      return {
        entries,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total: Number(totalResult[0]?.count || 0),
          totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / input.pageSize),
        },
      };
    }),

  // Get single journal entry with lines
  getById: accountantProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [entry] = await db
        .select({
          id: schema.journalEntries.id,
          journalId: schema.journalEntries.journalId,
          accountingPeriodId: schema.journalEntries.accountingPeriodId,
          entryDate: schema.journalEntries.entryDate,
          postingDate: schema.journalEntries.postingDate,
          referenceNumber: schema.journalEntries.referenceNumber,
          description: schema.journalEntries.description,
          isPosted: schema.journalEntries.isPosted,
          reversedEntryId: schema.journalEntries.reversedEntryId,
          createdBy: schema.journalEntries.createdBy,
          createdAt: schema.journalEntries.createdAt,
          journalCode: schema.journals.code,
          journalName: schema.journals.name,
          periodName: schema.accountingPeriods.name,
          createdByName: schema.users.name,
          createdByEmail: schema.users.email,
        })
        .from(schema.journalEntries)
        .innerJoin(schema.journals, eq(schema.journalEntries.journalId, schema.journals.id))
        .innerJoin(schema.accountingPeriods, eq(schema.journalEntries.accountingPeriodId, schema.accountingPeriods.id))
        .leftJoin(schema.users, eq(schema.journalEntries.createdBy, schema.users.id))
        .where(and(
          eq(schema.journalEntries.id, input.id),
          eq(schema.journalEntries.companyId, ctx.companyId!)
        ));

      if (!entry) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Journal entry not found' });
      }

      const lines = await db
        .select({
          id: schema.journalLines.id,
          accountId: schema.journalLines.accountId,
          description: schema.journalLines.description,
          debit: schema.journalLines.debit,
          credit: schema.journalLines.credit,
          signedAmount: schema.journalLines.signedAmount,
          accountCode: schema.accounts.code,
          accountName: schema.accounts.name,
          accountNormalBalance: schema.accountTypes.normalBalance,
        })
        .from(schema.journalLines)
        .innerJoin(schema.accounts, eq(schema.journalLines.accountId, schema.accounts.id))
        .innerJoin(schema.accountTypes, eq(schema.accounts.accountTypeId, schema.accountTypes.id))
        .where(eq(schema.journalLines.journalEntryId, input.id))
        .orderBy(asc(schema.journalLines.id));

      return { ...entry, lines };
    }),

  // Create draft journal entry
  createDraft: accountantProcedure
    .input(z.object({
      journalId: z.string().uuid(),
      accountingPeriodId: z.string().uuid(),
      entryDate: z.string().transform(val => new Date(val)),
      postingDate: z.string().transform(val => new Date(val)),
      referenceNumber: z.string().max(100).optional(),
      description: z.string().optional(),
      lines: z.array(z.object({
        accountId: z.string().uuid(),
        description: z.string().optional(),
        debit: z.number().min(0).optional(),
        credit: z.number().min(0).optional(),
      })).min(2, 'At least 2 lines required'),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      // Validate journal belongs to company
      const [journal] = await db
        .select()
        .from(schema.journals)
        .where(and(
          eq(schema.journals.id, input.journalId),
          eq(schema.journals.companyId, ctx.companyId!)
        ));

      if (!journal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Journal not found' });
      }

      // Validate period belongs to company and is open
      const [period] = await db
        .select()
        .from(schema.accountingPeriods)
        .where(and(
          eq(schema.accountingPeriods.id, input.accountingPeriodId),
          eq(schema.accountingPeriods.isClosed, false)
        ));

      if (!period) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Accounting period not found or is closed' });
      }

      // Validate all accounts exist and belong to company
      const accountIds = input.lines.map(l => l.accountId);
      const accounts = await db
        .select({ id: schema.accounts.id, isActive: schema.accounts.isActive })
        .from(schema.accounts)
        .where(and(
          sql`${schema.accounts.id} IN (${accountIds.join(',')})`,
          eq(schema.accounts.companyId, ctx.companyId!)
        ));

      if (accounts.length !== accountIds.length) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'One or more accounts not found' });
      }

      if (accounts.some((a: typeof accounts[0]) => !a.isActive)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'One or more accounts are inactive' });
      }

      // Validate debits = credits
      const totalDebit = input.lines.reduce((sum: number, l) => sum + (l.debit || 0), 0);
      const totalCredit = input.lines.reduce((sum: number, l) => sum + (l.credit || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.0001) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: `Entry must balance: debits (${totalDebit.toFixed(4)}) must equal credits (${totalCredit.toFixed(4)})` 
        });
      }

      // Validate each line has either debit or credit (not both, not neither)
      for (const line of input.lines) {
        const hasDebit = (line.debit || 0) > 0;
        const hasCredit = (line.credit || 0) > 0;
        if (hasDebit && hasCredit) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Line cannot have both debit and credit' });
        }
        if (!hasDebit && !hasCredit) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Line must have either debit or credit' });
        }
      }

      // Create the entry
      const [entry] = await db
        .insert(schema.journalEntries)
        .values({
          journalId: input.journalId,
          accountingPeriodId: input.accountingPeriodId,
          entryDate: input.entryDate,
          postingDate: input.postingDate,
          referenceNumber: input.referenceNumber,
          description: input.description,
          isPosted: false,
          createdBy: ctx.userId!,
        })
        .returning();

      // Create lines
      const linesToInsert = input.lines.map(line => ({
        journalEntryId: entry.id,
        accountId: line.accountId,
        description: line.description,
        debit: line.debit || 0,
        credit: line.credit || 0,
      }));

      await db
        .insert(schema.journalLines)
        .values(linesToInsert);

      return entry;
    }),

  // Post a draft entry
  post: accountantProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [entry] = await db
        .select()
        .from(schema.journalEntries)
        .where(and(
          eq(schema.journalEntries.id, input.id),
          eq(schema.journalEntries.companyId, ctx.companyId!)
        ));

      if (!entry) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Journal entry not found' });
      }

      if (entry.isPosted) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Entry is already posted' });
      }

      // Verify period is still open
      const [period] = await db
        .select()
        .from(schema.accountingPeriods)
        .where(and(
          eq(schema.accountingPeriods.id, entry.accountingPeriodId),
          eq(schema.accountingPeriods.isClosed, false)
        ));

      if (!period) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot post to closed period' });
      }

      // Verify balance (trigger will also check)
      const lines = await db
        .select({ debit: schema.journalLines.debit, credit: schema.journalLines.credit })
        .from(schema.journalLines)
        .where(eq(schema.journalLines.journalEntryId, input.id));

const totalDebit = lines.reduce((sum: number, l: { debit: string | null; credit: string | null }) => sum + Number(l.debit), 0);
       const totalCredit = lines.reduce((sum: number, l: { debit: string | null; credit: string | null }) => sum + Number(l.credit), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.0001) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Entry does not balance' });
      }

      if (lines.length < 2) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Entry must have at least 2 lines' });
      }

      const [updated] = await db
        .update(schema.journalEntries)
        .set({ isPosted: true })
        .where(eq(schema.journalEntries.id, input.id))
        .returning();

      return updated;
    }),

  // Reverse a posted entry
  reverse: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      reversalDate: z.string().transform(val => new Date(val)).optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [entry] = await db
        .select()
        .from(schema.journalEntries)
        .where(and(
          eq(schema.journalEntries.id, input.id),
          eq(schema.journalEntries.companyId, ctx.companyId!)
        ));

      if (!entry) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Journal entry not found' });
      }

      if (!entry.isPosted) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Can only reverse posted entries' });
      }

      if (entry.reversedEntryId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Entry has already been reversed' });
      }

      // Get original lines
      const originalLines = await db
        .select({
          journalEntryId: schema.journalLines.journalEntryId,
          accountId: schema.journalLines.accountId,
          description: schema.journalLines.description,
          debit: schema.journalLines.debit,
          credit: schema.journalLines.credit,
        })
        .from(schema.journalLines)
        .where(eq(schema.journalLines.journalEntryId, input.id));

      // Create reversal entry
      const reversalDate = input.reversalDate || new Date();
      const [reversal] = await db
        .insert(schema.journalEntries)
        .values({
          journalId: entry.journalId,
          accountingPeriodId: entry.accountingPeriodId,
          entryDate: reversalDate,
          postingDate: reversalDate,
          referenceNumber: `REV-${entry.referenceNumber || entry.id.substring(0, 8)}`,
          description: input.description || `Reversal of ${entry.referenceNumber || entry.id}`,
          isPosted: false,
          reversedEntryId: entry.id,
          createdBy: ctx.userId!,
        })
        .returning();

// Create reversed lines (swap debit/credit)
       const reversedLines = originalLines.map((line: { accountId: string; description: string | null; credit: string | null; debit: string | null }) => ({
         journalEntryId: reversal.id,
         accountId: line.accountId,
         description: line.description,
         debit: line.credit,
         credit: line.debit,
       }));

      await db.insert(schema.journalLines).values(reversedLines);

      // Update original entry with reversal reference
      await db
        .update(schema.journalEntries)
        .set({ reversedEntryId: reversal.id })
        .where(eq(schema.journalEntries.id, entry.id));

      return reversal;
    }),

  // Delete draft entry
  deleteDraft: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [entry] = await db
        .select()
        .from(schema.journalEntries)
        .where(and(
          eq(schema.journalEntries.id, input.id),
          eq(schema.journalEntries.companyId, ctx.companyId!)
        ));

      if (!entry) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Journal entry not found' });
      }

      if (entry.isPosted) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot delete posted entry. Reverse it instead.' });
      }

      // Delete lines first (cascade should handle this)
      await db
        .delete(schema.journalLines)
        .where(eq(schema.journalLines.journalEntryId, input.id));

      // Delete entry
      await db
        .delete(schema.journalEntries)
        .where(eq(schema.journalEntries.id, input.id));

      return { success: true };
    }),
});