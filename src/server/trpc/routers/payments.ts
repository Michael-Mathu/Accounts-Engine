import { z } from 'zod';
import { and, eq, gte, lte, desc, sql } from 'drizzle-orm';
import { router } from '../index';
import { accountantProcedure } from '../index';
import { TRPCError } from '@trpc/server';
import { schema } from '@/server/db';

export const paymentsRouter = router({
  // Apply customer payment to invoices
  applyToInvoices: accountantProcedure
    .input(z.object({
      customerId: z.string().uuid(),
      paymentDate: z.string().transform(val => new Date(val)),
      amount: z.number().positive(),
      bankAccountId: z.string().uuid().optional(),
      applications: z.array(z.object({
        invoiceId: z.string().uuid(),
        amount: z.number().positive(),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      // Validate total applied amount equals payment amount
      const totalApplied = input.applications.reduce((sum: number, a: { amount: number }) => sum + a.amount, 0);
      if (Math.abs(totalApplied - input.amount) > 0.0001) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: `Total applied amount (${totalApplied.toFixed(2)}) must equal payment amount (${input.amount.toFixed(2)})` 
        });
      }

      // Validate customer
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

      // Validate invoices exist and belong to customer
      const invoiceIds = input.applications.map(a => a.invoiceId);
      const invoices = await db
        .select()
        .from(schema.invoices)
        .where(and(
          eq(schema.invoices.companyId, ctx.companyId!),
          eq(schema.invoices.customerId, input.customerId),
          sql`${schema.invoices.id} IN (${invoiceIds.join(',')})`
        ));

      if (invoices.length !== invoiceIds.length) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'One or more invoices not found' });
      }

// Check amounts don't exceed invoice balances
       for (const app of input.applications) {
         const invoice = invoices.find((i: { id: string }) => i.id === app.invoiceId);
         if (!invoice) continue;

        // Calculate remaining balance
        const paidApplications = await db
          .select({ total: sql<number>`sum(${schema.paymentApplications.appliedAmount})` })
          .from(schema.paymentApplications)
          .where(eq(schema.paymentApplications.invoiceId, invoice.id));

        const alreadyPaid = Number(paidApplications[0]?.total || 0);
        const remaining = Number(invoice.total) - alreadyPaid;

        if (app.amount > remaining + 0.0001) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: `Applied amount ${app.amount.toFixed(2)} exceeds remaining balance ${remaining.toFixed(2)} on invoice ${invoice.invoiceNumber}` 
          });
        }
      }

      // Get default journal and period
      const [journal] = await db
        .select()
        .from(schema.journals)
        .where(and(
          eq(schema.journals.companyId, ctx.companyId!),
          eq(schema.journals.code, 'CR')
        ));

      const [period] = await db
        .select()
        .from(schema.accountingPeriods)
        .innerJoin(schema.fiscalYears, eq(schema.accountingPeriods.fiscalYearId, schema.fiscalYears.id))
        .where(and(
          eq(schema.fiscalYears.companyId, ctx.companyId!),
          eq(schema.accountingPeriods.isClosed, false),
          sql`${schema.accountingPeriods.startDate}::date <= ${input.paymentDate.toISOString().split('T')[0]}`,
          sql`${schema.accountingPeriods.endDate}::date >= ${input.paymentDate.toISOString().split('T')[0]}`
        ))
        .limit(1);

      if (!period) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No open accounting period for payment date' });
      }

      // Get AR account
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

      // Get Cash/Bank account
      const [cashAccount] = input.bankAccountId 
        ? await db.select().from(schema.bankAccounts).where(eq(schema.bankAccounts.id, input.bankAccountId))
        : await db
            .select()
            .from(schema.accounts)
            .innerJoin(schema.accountTypes, eq(schema.accounts.accountTypeId, schema.accountTypes.id))
            .where(and(
              eq(schema.accounts.companyId, ctx.companyId!),
              eq(schema.accountTypes.class, 'asset'),
              eq(schema.accountTypes.name, 'Bank')
            ))
            .limit(1);

      if (!cashAccount) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cash/Bank account not configured' });
      }

      // Create payment record
      const [payment] = await db
        .insert(schema.customerPayments)
        .values({
          companyId: ctx.companyId!,
          customerId: input.customerId,
          paymentDate: input.paymentDate,
          amount: input.amount.toFixed(4),
          bankAccountId: input.bankAccountId,
          journalEntryId: null, // Will update after creating entry
        })
        .returning();

      // Create payment applications
      const appInserts = input.applications.map(app => ({
        paymentId: payment.id,
        invoiceId: app.invoiceId,
        appliedAmount: app.amount.toFixed(4),
      }));

      await db.insert(schema.paymentApplications).values(appInserts);

      // Create journal entry
      const [entry] = await db
        .insert(schema.journalEntries)
        .values({
          journalId: journal.id,
          accountingPeriodId: period.id,
          entryDate: input.paymentDate,
          postingDate: input.paymentDate,
          referenceNumber: `PAY-${payment.id.slice(0, 8)}`,
          description: `Payment from ${customer.name}`,
          isPosted: true,
          createdBy: ctx.userId!,
        })
        .returning();

      // Create journal lines
      // Debit cash/bank
      await db.insert(schema.journalLines).values({
        journalEntryId: entry.id,
        accountId: cashAccount.accounts?.id || cashAccount.id,
        description: `Payment from ${customer.name}`,
        debit: input.amount.toFixed(4),
        credit: '0.0000',
      });

      // Credit AR
      await db.insert(schema.journalLines).values({
        journalEntryId: entry.id,
        accountId: arAccount.accounts.id,
        description: `Payment from ${customer.name}`,
        debit: '0.0000',
        credit: input.amount.toFixed(4),
      });

      // Update payment with journal entry ID
      await db
        .update(schema.customerPayments)
        .set({ journalEntryId: entry.id })
        .where(eq(schema.customerPayments.id, payment.id));

// Update invoice statuses
       for (const app of input.applications) {
         const invoice = invoices.find((i: { id: string }) => i.id === app.invoiceId);
         if (!invoice) continue;

        // Recalculate total paid
        const paidApps = await db
          .select({ total: sql<number>`sum(${schema.paymentApplications.appliedAmount})` })
          .from(schema.paymentApplications)
          .where(eq(schema.paymentApplications.invoiceId, invoice.id));

        const totalPaid = Number(paidApps[0]?.total || 0);
        const newStatus = totalPaid >= Number(invoice.total) ? 'paid' : 'partial';

        await db
          .update(schema.invoices)
          .set({ status: newStatus })
          .where(eq(schema.invoices.id, invoice.id));
      }

      return { payment, entry };
    }),

  // Apply vendor payment to bills
  applyToBills: accountantProcedure
    .input(z.object({
      vendorId: z.string().uuid(),
      paymentDate: z.string().transform(val => new Date(val)),
      amount: z.number().positive(),
      bankAccountId: z.string().uuid().optional(),
      applications: z.array(z.object({
        billId: z.string().uuid(),
        amount: z.number().positive(),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      // Validate total applied amount equals payment amount
      const totalApplied = input.applications.reduce((sum: number, a: { amount: number }) => sum + a.amount, 0);
      if (Math.abs(totalApplied - input.amount) > 0.0001) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: `Total applied amount (${totalApplied.toFixed(2)}) must equal payment amount (${input.amount.toFixed(2)})` 
        });
      }

      // Validate vendor
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

      // Validate bills
      const billIds = input.applications.map(a => a.billId);
      const bills = await db
        .select()
        .from(schema.bills)
        .where(and(
          eq(schema.bills.companyId, ctx.companyId!),
          eq(schema.bills.vendorId, input.vendorId),
          sql`${schema.bills.id} IN (${billIds.join(',')})`
        ));

      if (bills.length !== billIds.length) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'One or more bills not found' });
      }

// Check amounts don't exceed bill balances
       for (const app of input.applications) {
         const bill = bills.find((b: { id: string }) => b.id === app.billId);
         if (!bill) continue;

        const paidApps = await db
          .select({ total: sql<number>`sum(${schema.vendorPaymentApplications.appliedAmount})` })
          .from(schema.vendorPaymentApplications)
          .where(eq(schema.vendorPaymentApplications.billId, bill.id));

        const alreadyPaid = Number(paidApps[0]?.total || 0);
        const remaining = Number(bill.total) - alreadyPaid;

        if (app.amount > remaining + 0.0001) {
          throw new TRPCError({ 
            code: 'BAD_REQUEST', 
            message: `Applied amount ${app.amount.toFixed(2)} exceeds remaining balance ${remaining.toFixed(2)} on bill ${bill.billNumber}` 
          });
        }
      }

// Get default journal and period
       const [journal] = await db
        .select()
        .from(schema.journals)
        .where(and(
          eq(schema.journals.companyId, ctx.companyId!),
          eq(schema.journals.code, 'CD')
        ));

      const [period] = await db
        .select()
        .from(schema.accountingPeriods)
        .innerJoin(schema.fiscalYears, eq(schema.accountingPeriods.fiscalYearId, schema.fiscalYears.id))
        .where(and(
          eq(schema.fiscalYears.companyId, ctx.companyId!),
          eq(schema.accountingPeriods.isClosed, false),
          sql`${schema.accountingPeriods.startDate}::date <= ${input.paymentDate.toISOString().split('T')[0]}`,
          sql`${schema.accountingPeriods.endDate}::date >= ${input.paymentDate.toISOString().split('T')[0]}`
        ))
        .limit(1);

      if (!period) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No open accounting period for payment date' });
      }

      // Get AP account
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

      // Get Cash/Bank account
      const [cashAccount] = input.bankAccountId
        ? await db.select().from(schema.bankAccounts).where(eq(schema.bankAccounts.id, input.bankAccountId))
        : await db
            .select()
            .from(schema.accounts)
            .innerJoin(schema.accountTypes, eq(schema.accounts.accountTypeId, schema.accountTypes.id))
            .where(and(
              eq(schema.accounts.companyId, ctx.companyId!),
              eq(schema.accountTypes.class, 'asset'),
              eq(schema.accountTypes.name, 'Bank')
            ))
            .limit(1);

      if (!cashAccount) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cash/Bank account not configured' });
      }

      // Create payment record
      const [payment] = await db
        .insert(schema.vendorPayments)
        .values({
          companyId: ctx.companyId!,
          vendorId: input.vendorId,
          paymentDate: input.paymentDate,
          amount: input.amount.toFixed(4),
          bankAccountId: input.bankAccountId,
          journalEntryId: null,
        })
        .returning();

      // Create applications
      const appInserts = input.applications.map(app => ({
        paymentId: payment.id,
        billId: app.billId,
        appliedAmount: app.amount.toFixed(4),
      }));

      await db.insert(schema.vendorPaymentApplications).values(appInserts);

      // Create journal entry
      const [entry] = await db
        .insert(schema.journalEntries)
        .values({
          journalId: journal.id,
          accountingPeriodId: period.id,
          entryDate: input.paymentDate,
          postingDate: input.paymentDate,
          referenceNumber: `PAY-${payment.id.slice(0, 8)}`,
          description: `Payment to ${vendor.name}`,
          isPosted: true,
          createdBy: ctx.userId!,
        })
        .returning();

      // Create journal lines
      // Credit cash/bank
      await db.insert(schema.journalLines).values({
        journalEntryId: entry.id,
        accountId: cashAccount.accounts?.id || cashAccount.id,
        description: `Payment to ${vendor.name}`,
        debit: '0.0000',
        credit: input.amount.toFixed(4),
      });

      // Debit AP
      await db.insert(schema.journalLines).values({
        journalEntryId: entry.id,
        accountId: apAccount.accounts.id,
        description: `Payment to ${vendor.name}`,
        debit: input.amount.toFixed(4),
        credit: '0.0000',
      });

      // Update payment with journal entry ID
      await db
        .update(schema.vendorPayments)
        .set({ journalEntryId: entry.id })
        .where(eq(schema.vendorPayments.id, payment.id));

// Update bill statuses
       for (const app of input.applications) {
         const bill = bills.find((b: { id: string }) => b.id === app.billId);
         if (!bill) continue;

        const paidApps = await db
          .select({ total: sql<number>`sum(${schema.vendorPaymentApplications.appliedAmount})` })
          .from(schema.vendorPaymentApplications)
          .where(eq(schema.vendorPaymentApplications.billId, bill.id));

        const totalPaid = Number(paidApps[0]?.total || 0);
        const newStatus = totalPaid >= Number(bill.total) ? 'paid' : 'partial';

        await db
          .update(schema.bills)
          .set({ status: newStatus })
          .where(eq(schema.bills.id, bill.id));
      }

      return { payment, entry };
    }),

  // List customer payments
  listCustomerPayments: accountantProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(25),
      customerId: z.string().uuid().optional(),
      fromDate: z.string().transform(val => new Date(val)).optional(),
      toDate: z.string().transform(val => new Date(val)).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const conditions = [eq(schema.customerPayments.companyId, ctx.companyId!)];

      if (input.customerId) {
        conditions.push(eq(schema.customerPayments.customerId, input.customerId));
      }
      if (input.fromDate) {
        conditions.push(gte(schema.customerPayments.paymentDate, input.fromDate));
      }
      if (input.toDate) {
        conditions.push(lte(schema.customerPayments.paymentDate, input.toDate));
      }

      const offset = (input.page - 1) * input.pageSize;

      const [payments, totalResult] = await Promise.all([
        db
          .select({
            id: schema.customerPayments.id,
            customerId: schema.customerPayments.customerId,
            customerName: schema.customers.name,
            paymentDate: schema.customerPayments.paymentDate,
            amount: schema.customerPayments.amount,
            journalEntryId: schema.customerPayments.journalEntryId,
            bankAccountId: schema.customerPayments.bankAccountId,
            bankAccountName: schema.bankAccounts.name,
            createdAt: schema.customerPayments.createdAt,
          })
          .from(schema.customerPayments)
          .innerJoin(schema.customers, eq(schema.customerPayments.customerId, schema.customers.id))
          .leftJoin(schema.bankAccounts, eq(schema.customerPayments.bankAccountId, schema.bankAccounts.id))
          .where(and(...conditions))
          .orderBy(desc(schema.customerPayments.paymentDate))
          .limit(input.pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.customerPayments)
          .where(and(...conditions)),
      ]);

      return {
        payments,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total: Number(totalResult[0]?.count || 0),
          totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / input.pageSize),
        },
      };
    }),

  // List vendor payments
  listVendorPayments: accountantProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(25),
      vendorId: z.string().uuid().optional(),
      fromDate: z.string().transform(val => new Date(val)).optional(),
      toDate: z.string().transform(val => new Date(val)).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const conditions = [eq(schema.vendorPayments.companyId, ctx.companyId!)];

      if (input.vendorId) {
        conditions.push(eq(schema.vendorPayments.vendorId, input.vendorId));
      }
      if (input.fromDate) {
        conditions.push(gte(schema.vendorPayments.paymentDate, input.fromDate));
      }
      if (input.toDate) {
        conditions.push(lte(schema.vendorPayments.paymentDate, input.toDate));
      }

      const offset = (input.page - 1) * input.pageSize;

      const [payments, totalResult] = await Promise.all([
        db
          .select({
            id: schema.vendorPayments.id,
            vendorId: schema.vendorPayments.vendorId,
            vendorName: schema.vendors.name,
            paymentDate: schema.vendorPayments.paymentDate,
            amount: schema.vendorPayments.amount,
            journalEntryId: schema.vendorPayments.journalEntryId,
            bankAccountId: schema.vendorPayments.bankAccountId,
            bankAccountName: schema.bankAccounts.name,
            createdAt: schema.vendorPayments.createdAt,
          })
          .from(schema.vendorPayments)
          .innerJoin(schema.vendors, eq(schema.vendorPayments.vendorId, schema.vendors.id))
          .leftJoin(schema.bankAccounts, eq(schema.vendorPayments.bankAccountId, schema.bankAccounts.id))
          .where(and(...conditions))
          .orderBy(desc(schema.vendorPayments.paymentDate))
          .limit(input.pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.vendorPayments)
          .where(and(...conditions)),
      ]);

      return {
        payments,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total: Number(totalResult[0]?.count || 0),
          totalPages: Math.ceil(Number(totalResult[0]?.count || 0) / input.pageSize),
        },
      };
    }),
});