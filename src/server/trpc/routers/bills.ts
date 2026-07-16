import { z } from 'zod';
import { and, desc, eq, sql, gte, lte } from 'drizzle-orm';
import { router } from '../index';
import { accountantProcedure, adminProcedure } from '../index';
import { TRPCError } from '@trpc/server';
import { schema } from '@/server/db';

export const billsRouter = router({
  create: accountantProcedure
    .input(z.object({
      vendorId: z.string().uuid(),
      billNumber: z.string().min(1).max(50),
      issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      lines: z.array(z.object({
        description: z.string().min(1),
        quantity: z.number().min(1).default(1),
        unitPrice: z.number().min(0),
        expenseAccountId: z.string().uuid(),
      })).min(1),
      taxTotal: z.number().min(0).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [vendor] = await db
        .select()
        .from(schema.vendors)
        .where(and(
          eq(schema.vendors.id, input.vendorId),
          eq(schema.vendors.companyId, ctx.companyId!)
        ));

      if (!vendor) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor not found' });
      }

      const accountIds = input.lines.map(l => l.expenseAccountId);
      const accounts = await db
        .select({ id: schema.accounts.id, accountClass: schema.accountTypes.class })
        .from(schema.accounts)
        .innerJoin(schema.accountTypes, eq(schema.accounts.accountTypeId, schema.accountTypes.id))
        .where(and(
          sql`${schema.accounts.id} IN (${accountIds.join(',')})`,
          eq(schema.accounts.companyId, ctx.companyId!)
        ));

      if (accounts.length !== accountIds.length) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'One or more expense accounts not found' });
      }

      const subtotal = input.lines.reduce((sum, line) => sum + (line.quantity * line.unitPrice), 0);
      const total = subtotal + input.taxTotal;

      const [existing] = await db
        .select()
        .from(schema.bills)
        .where(and(
          eq(schema.bills.companyId, ctx.companyId!),
          eq(schema.bills.billNumber, input.billNumber)
        ));

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Bill number already exists' });
      }

      const [journal] = await db
        .select()
        .from(schema.journals)
        .where(and(
          eq(schema.journals.companyId, ctx.companyId!),
          eq(schema.journals.code, 'PJ')
        ));

      const [period] = await db
        .select()
        .from(schema.accountingPeriods)
        .where(and(
          eq(schema.accountingPeriods.companyId, ctx.companyId!),
          eq(schema.accountingPeriods.isClosed, false),
          lte(schema.accountingPeriods.startDate, input.issueDate),
          gte(schema.accountingPeriods.endDate, input.issueDate)
        ))
        .limit(1);

      if (!period) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No open accounting period for this date' });
      }

      const [bill] = await db
        .insert(schema.bills)
        .values({
          companyId: ctx.companyId!,
          vendorId: input.vendorId,
          billNumber: input.billNumber,
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          status: 'draft',
          subtotal: String(subtotal),
          taxTotal: String(input.taxTotal),
          total: String(total),
        })
        .returning();

      const linesToInsert = input.lines.map(line => ({
        billId: bill.id,
        description: line.description,
        quantity: String(line.quantity),
        unitPrice: String(line.unitPrice),
        expenseAccountId: line.expenseAccountId,
      }));

      await db.insert(schema.billLines).values(linesToInsert);

      return bill;
    }),

  approve: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [bill] = await db
        .select()
        .from(schema.bills)
        .where(and(
          eq(schema.bills.id, input.id),
          eq(schema.bills.companyId, ctx.companyId!)
        ));

      if (!bill) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bill not found' });
      }

      if (bill.status !== 'draft') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Can only approve draft bills' });
      }

      const lines = await db
        .select()
        .from(schema.billLines)
        .where(eq(schema.billLines.billId, input.id));

      const [apAccount] = await db
        .select()
        .from(schema.accounts)
        .innerJoin(schema.accountTypes, eq(schema.accounts.accountTypeId, schema.accountTypes.id))
        .where(and(
          eq(schema.accounts.companyId, ctx.companyId!),
          eq(schema.accountTypes.class, 'liability'),
          eq(schema.accountTypes.name, 'Accounts Payable')
        ))
        .limit(1);

      if (!apAccount) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Accounts Payable account not configured' });
      }

      const [vendor] = await db
        .select({ name: schema.vendors.name })
        .from(schema.vendors)
        .where(eq(schema.vendors.id, bill.vendorId));

      const [journal] = await db
        .select()
        .from(schema.journals)
        .where(and(
          eq(schema.journals.companyId, ctx.companyId!),
          eq(schema.journals.code, 'PJ')
        ));

      const [period] = await db
        .select()
        .from(schema.accountingPeriods)
        .where(and(
          eq(schema.accountingPeriods.companyId, ctx.companyId!),
          eq(schema.accountingPeriods.isClosed, false),
          lte(schema.accountingPeriods.startDate, bill.issueDate),
          gte(schema.accountingPeriods.endDate, bill.issueDate)
        ))
        .limit(1);

      if (!period) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No open accounting period' });
      }

      const [entry] = await db
        .insert(schema.journalEntries)
        .values({
          companyId: ctx.companyId!,
          journalId: journal!.id,
          accountingPeriodId: period.id,
          entryDate: bill.issueDate,
          postingDate: bill.issueDate,
          referenceNumber: bill.billNumber,
          description: `Bill ${bill.billNumber} - ${vendor?.name || bill.vendorId}`,
          isPosted: true,
          createdBy: ctx.userId!,
        })
        .returning();

      const entryLines = [];

      entryLines.push({
        journalEntryId: entry.id,
        accountId: apAccount.accounts.id,
        description: `Bill ${bill.billNumber} - ${vendor?.name || bill.vendorId}`,
        debit: '0',
        credit: String(bill.total),
      });

      for (const line of lines) {
        entryLines.push({
          journalEntryId: entry.id,
          accountId: line.expenseAccountId,
          description: line.description,
          debit: String(line.amount),
          credit: '0',
        });
      }

      await db.insert(schema.journalLines).values(entryLines);

      const [updated] = await db
        .update(schema.bills)
        .set({ 
          status: 'approved',
          journalEntryId: entry.id,
        })
        .where(eq(schema.bills.id, input.id))
        .returning();

      return updated;
    }),

  void: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [bill] = await db
        .select()
        .from(schema.bills)
        .where(and(
          eq(schema.bills.id, input.id),
          eq(schema.bills.companyId, ctx.companyId!)
        ));

      if (!bill) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bill not found' });
      }

      if (bill.status === 'void') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Bill already voided' });
      }

      if (bill.journalEntryId) {
        const [entry] = await db
          .select()
          .from(schema.journalEntries)
          .where(eq(schema.journalEntries.id, bill.journalEntryId));

        if (entry && entry.isPosted) {
          const [reversal] = await db
            .insert(schema.journalEntries)
            .values({
              companyId: ctx.companyId!,
              journalId: entry.journalId,
              accountingPeriodId: entry.accountingPeriodId,
              entryDate: new Date().toISOString().split('T')[0],
              postingDate: new Date().toISOString().split('T')[0],
              referenceNumber: `REV-${bill.billNumber}`,
              description: `Void of Bill ${bill.billNumber}`,
              isPosted: false,
              reversedEntryId: entry.id,
              createdBy: ctx.userId!,
            })
            .returning();

          const originalLines = await db
            .select()
            .from(schema.journalLines)
            .where(eq(schema.journalLines.journalEntryId, entry.id));

          const reversedLines = originalLines.map((line) => ({
            journalEntryId: reversal.id,
            accountId: line.accountId,
            description: line.description,
            debit: line.credit || '0',
            credit: line.debit || '0',
          }));

          await db.insert(schema.journalLines).values(reversedLines);
        }
      }

      const [updated] = await db
        .update(schema.bills)
        .set({ status: 'void' })
        .where(eq(schema.bills.id, input.id))
        .returning();

      return updated;
    }),

  list: accountantProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(25),
      status: z.enum(['draft', 'approved', 'partial', 'paid', 'void']).optional(),
      vendorId: z.string().uuid().optional(),
      fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const conditions = [eq(schema.bills.companyId, ctx.companyId!)];

      if (input.status) {
        conditions.push(eq(schema.bills.status, input.status));
      }
      if (input.vendorId) {
        conditions.push(eq(schema.bills.vendorId, input.vendorId));
      }
      if (input.fromDate) {
        conditions.push(gte(schema.bills.issueDate, input.fromDate));
      }
      if (input.toDate) {
        conditions.push(lte(schema.bills.issueDate, input.toDate));
      }

      const offset = (input.page - 1) * input.pageSize;

      const [bills, totalResult] = await Promise.all([
        db
          .select({
            id: schema.bills.id,
            billNumber: schema.bills.billNumber,
            issueDate: schema.bills.issueDate,
            dueDate: schema.bills.dueDate,
            status: schema.bills.status,
            subtotal: schema.bills.subtotal,
            taxTotal: schema.bills.taxTotal,
            total: schema.bills.total,
            vendorName: schema.vendors.name,
            vendorId: schema.bills.vendorId,
            journalEntryId: schema.bills.journalEntryId,
          })
          .from(schema.bills)
          .leftJoin(schema.vendors, eq(schema.bills.vendorId, schema.vendors.id))
          .where(and(...conditions))
          .orderBy(desc(schema.bills.issueDate))
          .limit(input.pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.bills)
          .where(and(...conditions)),
      ]);

      return {
        bills,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total: Number(totalResult[0]?.count || 0),
          totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / input.pageSize),
        },
      };
    }),

  getById: accountantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [bill] = await db
        .select()
        .from(schema.bills)
        .where(and(
          eq(schema.bills.id, input.id),
          eq(schema.bills.companyId, ctx.companyId!)
        ));

      if (!bill) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Bill not found' });
      }

      const [vendor] = await db
        .select()
        .from(schema.vendors)
        .where(eq(schema.vendors.id, bill.vendorId));

      const lines = await db
        .select({
          id: schema.billLines.id,
          description: schema.billLines.description,
          quantity: schema.billLines.quantity,
          unitPrice: schema.billLines.unitPrice,
          amount: schema.billLines.amount,
          expenseAccountId: schema.billLines.expenseAccountId,
          expenseAccountCode: schema.accounts.code,
          expenseAccountName: schema.accounts.name,
        })
        .from(schema.billLines)
        .leftJoin(schema.accounts, eq(schema.billLines.expenseAccountId, schema.accounts.id))
        .where(eq(schema.billLines.billId, input.id));

      return { ...bill, vendor, lines };
    }),
});