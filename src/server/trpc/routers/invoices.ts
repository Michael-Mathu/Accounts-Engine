import { z } from 'zod';
import { and, desc, eq, sql, gte, lte } from 'drizzle-orm';
import { router } from '../index';
import { accountantProcedure, adminProcedure } from '../index';
import { TRPCError } from '@trpc/server';
import { schema } from '@/server/db';

export const invoicesRouter = router({
  create: accountantProcedure
    .input(z.object({
      customerId: z.string().uuid(),
      invoiceNumber: z.string().min(1).max(50),
      issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      lines: z.array(z.object({
        description: z.string().min(1),
        quantity: z.number().min(1).default(1),
        unitPrice: z.number().min(0),
        revenueAccountId: z.string().uuid(),
      })).min(1),
      taxTotal: z.number().min(0).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [customer] = await db
        .select()
        .from(schema.customers)
        .where(and(
          eq(schema.customers.id, input.customerId),
          eq(schema.customers.companyId, ctx.companyId!)
        ));

      if (!customer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' });
      }

      const accountIds = input.lines.map(l => l.revenueAccountId);
      const accounts = await db
        .select({ id: schema.accounts.id, accountClass: schema.accountTypes.class })
        .from(schema.accounts)
        .innerJoin(schema.accountTypes, eq(schema.accounts.accountTypeId, schema.accountTypes.id))
        .where(and(
          sql`${schema.accounts.id} IN (${accountIds.join(',')})`,
          eq(schema.accounts.companyId, ctx.companyId!)
        ));

      if (accounts.length !== accountIds.length) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'One or more revenue accounts not found' });
      }

      const subtotal = input.lines.reduce((sum, line) => sum + (line.quantity * line.unitPrice), 0);
      const total = subtotal + input.taxTotal;

      const [existing] = await db
        .select()
        .from(schema.invoices)
        .where(and(
          eq(schema.invoices.companyId, ctx.companyId!),
          eq(schema.invoices.invoiceNumber, input.invoiceNumber)
        ));

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Invoice number already exists' });
      }

      const [journal] = await db
        .select()
        .from(schema.journals)
        .where(and(
          eq(schema.journals.companyId, ctx.companyId!),
          eq(schema.journals.code, 'SJ')
        ));

      const [period] = await db
        .select()
        .from(schema.accountingPeriods)
        .innerJoin(schema.fiscalYears, eq(schema.accountingPeriods.fiscalYearId, schema.fiscalYears.id))
        .where(and(
          eq(schema.fiscalYears.companyId, ctx.companyId!),
          eq(schema.accountingPeriods.isClosed, false),
          sql`${schema.accountingPeriods.startDate}::date <= ${input.issueDate}`,
          sql`${schema.accountingPeriods.endDate}::date >= ${input.issueDate}`
        ))
        .limit(1);

      if (!period) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No open accounting period for this date' });
      }

      const [invoice] = await db
        .insert(schema.invoices)
        .values({
          companyId: ctx.companyId!,
          customerId: input.customerId,
          invoiceNumber: input.invoiceNumber,
          issueDate: input.issueDate,
          dueDate: input.dueDate,
          status: 'draft',
          subtotal: String(subtotal),
          taxTotal: String(input.taxTotal),
          total: String(total),
        })
        .returning();

      const linesToInsert = input.lines.map(line => ({
        invoiceId: invoice.id,
        description: line.description,
        quantity: String(line.quantity),
        unitPrice: String(line.unitPrice),
        revenueAccountId: line.revenueAccountId,
      }));

      await db.insert(schema.invoiceLines).values(linesToInsert);

      return invoice;
    }),

  send: accountantProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [invoice] = await db
        .select()
        .from(schema.invoices)
        .where(and(
          eq(schema.invoices.id, input.id),
          eq(schema.invoices.companyId, ctx.companyId!)
        ));

      if (!invoice) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      }

      if (invoice.status !== 'draft') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Can only send draft invoices' });
      }

      const lines = await db
        .select()
        .from(schema.invoiceLines)
        .where(eq(schema.invoiceLines.invoiceId, input.id));

      const [arAccount] = await db
        .select()
        .from(schema.accounts)
        .innerJoin(schema.accountTypes, eq(schema.accounts.accountTypeId, schema.accountTypes.id))
        .where(and(
          eq(schema.accounts.companyId, ctx.companyId!),
          eq(schema.accountTypes.class, 'asset'),
          eq(schema.accountTypes.name, 'Accounts Receivable')
        ))
        .limit(1);

      if (!arAccount) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Accounts Receivable account not configured' });
      }

      const [journal] = await db
        .select()
        .from(schema.journals)
        .where(and(
          eq(schema.journals.companyId, ctx.companyId!),
          eq(schema.journals.code, 'SJ')
        ));

      const [period] = await db
        .select()
        .from(schema.accountingPeriods)
        .innerJoin(schema.fiscalYears, eq(schema.accountingPeriods.fiscalYearId, schema.fiscalYears.id))
        .where(and(
          eq(schema.fiscalYears.companyId, ctx.companyId!),
          eq(schema.accountingPeriods.isClosed, false),
          sql`${schema.accountingPeriods.startDate}::date <= ${invoice.issueDate}`,
          sql`${schema.accountingPeriods.endDate}::date >= ${invoice.issueDate}`
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
          accountingPeriodId: (period as { accounting_periods: { id: string } }).accounting_periods.id,
          entryDate: invoice.issueDate,
          postingDate: invoice.issueDate,
          referenceNumber: invoice.invoiceNumber,
          description: `Invoice ${invoice.invoiceNumber} - ${invoice.customerId}`,
          isPosted: true,
          createdBy: ctx.userId!,
        })
        .returning();

      const [customer] = await db
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.id, invoice.customerId));

      const entryLines = [];

      entryLines.push({
        journalEntryId: entry.id,
        accountId: arAccount.accounts.id,
        description: `Invoice ${invoice.invoiceNumber} - ${customer?.name || invoice.customerId}`,
        debit: String(invoice.total),
        credit: '0',
      });

      for (const line of lines) {
        const lineAmount = Number(line.quantity) * Number(line.unitPrice);
        entryLines.push({
          journalEntryId: entry.id,
          accountId: line.revenueAccountId,
          description: line.description,
          debit: '0',
          credit: String(lineAmount),
        });
      }

      await db.insert(schema.journalLines).values(entryLines);

      const [updated] = await db
        .update(schema.invoices)
        .set({ 
          status: 'sent',
          journalEntryId: entry.id,
        })
        .where(eq(schema.invoices.id, input.id))
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

      const [invoice] = await db
        .select()
        .from(schema.invoices)
        .where(and(
          eq(schema.invoices.id, input.id),
          eq(schema.invoices.companyId, ctx.companyId!)
        ));

      if (!invoice) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      }

      if (invoice.status === 'void') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invoice already voided' });
      }

      if (invoice.journalEntryId) {
        const [entry] = await db
          .select()
          .from(schema.journalEntries)
          .where(eq(schema.journalEntries.id, invoice.journalEntryId));

        if (entry && entry.isPosted) {
          const [reversal] = await db
            .insert(schema.journalEntries)
            .values({
              companyId: ctx.companyId!,
              journalId: entry.journalId,
              accountingPeriodId: entry.accountingPeriodId,
              entryDate: new Date().toISOString().split('T')[0],
              postingDate: new Date().toISOString().split('T')[0],
              referenceNumber: `REV-${invoice.invoiceNumber}`,
              description: `Void of Invoice ${invoice.invoiceNumber}`,
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
        .update(schema.invoices)
        .set({ status: 'void' })
        .where(eq(schema.invoices.id, input.id))
        .returning();

      return updated;
    }),

  list: accountantProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(25),
      status: z.enum(['draft', 'sent', 'partial', 'paid', 'void']).optional(),
      customerId: z.string().uuid().optional(),
      fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const conditions = [eq(schema.invoices.companyId, ctx.companyId!)];

      if (input.status) {
        conditions.push(eq(schema.invoices.status, input.status));
      }
      if (input.customerId) {
        conditions.push(eq(schema.invoices.customerId, input.customerId));
      }
      if (input.fromDate) {
        conditions.push(gte(schema.invoices.issueDate, input.fromDate));
      }
      if (input.toDate) {
        conditions.push(lte(schema.invoices.issueDate, input.toDate));
      }

      const offset = (input.page - 1) * input.pageSize;

      const [invoices, totalResult] = await Promise.all([
        db
          .select({
            id: schema.invoices.id,
            invoiceNumber: schema.invoices.invoiceNumber,
            issueDate: schema.invoices.issueDate,
            dueDate: schema.invoices.dueDate,
            status: schema.invoices.status,
            subtotal: schema.invoices.subtotal,
            taxTotal: schema.invoices.taxTotal,
            total: schema.invoices.total,
            customerName: schema.customers.name,
            customerId: schema.invoices.customerId,
            journalEntryId: schema.invoices.journalEntryId,
          })
          .from(schema.invoices)
          .leftJoin(schema.customers, eq(schema.invoices.customerId, schema.customers.id))
          .where(and(...conditions))
          .orderBy(desc(schema.invoices.issueDate))
          .limit(input.pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.invoices)
          .where(and(...conditions)),
      ]);

      return {
        invoices,
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

      const [invoice] = await db
        .select()
        .from(schema.invoices)
        .where(and(
          eq(schema.invoices.id, input.id),
          eq(schema.invoices.companyId, ctx.companyId!)
        ));

      if (!invoice) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      }

      const [customer] = await db
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.id, invoice.customerId));

      const lines = await db
        .select({
          id: schema.invoiceLines.id,
          description: schema.invoiceLines.description,
          quantity: schema.invoiceLines.quantity,
          unitPrice: schema.invoiceLines.unitPrice,
          amount: schema.invoiceLines.amount,
          revenueAccountId: schema.invoiceLines.revenueAccountId,
          revenueAccountCode: schema.accounts.code,
          revenueAccountName: schema.accounts.name,
        })
        .from(schema.invoiceLines)
        .leftJoin(schema.accounts, eq(schema.invoiceLines.revenueAccountId, schema.accounts.id))
        .where(eq(schema.invoiceLines.invoiceId, input.id));

      return { ...invoice, customer, lines };
    }),
});