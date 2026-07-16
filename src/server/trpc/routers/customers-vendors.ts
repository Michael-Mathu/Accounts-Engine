import { z } from 'zod';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { router } from '../index';
import { accountantProcedure, adminProcedure, TRPCError } from '../index';
import { schema } from '@/server/db';

export const customersRouter = router({
  create: accountantProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      email: z.string().email().optional(),
      paymentTermsDays: z.number().int().positive().default(30),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [customer] = await db
        .insert(schema.customers)
        .values({
          companyId: ctx.companyId!,
          name: input.name,
          email: input.email,
          paymentTermsDays: input.paymentTermsDays,
        })
        .returning();

      return customer;
    }),

  list: accountantProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(50),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const conditions = [eq(schema.customers.companyId, ctx.companyId!)];

      if (input.search) {
        conditions.push(sql`${schema.customers.name} ILIKE ${'%' + input.search + '%'}`);
      }

      const offset = (input.page - 1) * input.pageSize;

      const [customers, totalResult] = await Promise.all([
        db
          .select()
          .from(schema.customers)
          .where(and(...conditions))
          .orderBy(asc(schema.customers.name))
          .limit(input.pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.customers)
          .where(and(...conditions)),
      ]);

      return {
        customers,
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

      const [customer] = await db
        .select()
        .from(schema.customers)
        .where(and(
          eq(schema.customers.id, input.id),
          eq(schema.customers.companyId, ctx.companyId!)
        ));

      if (!customer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' });
      }

      return customer;
    }),

  update: accountantProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(255).optional(),
      email: z.string().email().optional(),
      paymentTermsDays: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const { id, ...updates } = input;

      const [customer] = await db
        .update(schema.customers)
        .set(updates)
        .where(and(
          eq(schema.customers.id, id),
          eq(schema.customers.companyId, ctx.companyId!)
        ))
        .returning();

      if (!customer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' });
      }

      return customer;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      // Check for associated invoices
      const [invoiceCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.invoices)
        .where(eq(schema.invoices.customerId, input.id));

      if (Number(invoiceCount.count) > 0) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: 'Cannot delete customer with existing invoices' 
        });
      }

      await db
        .delete(schema.customers)
        .where(and(
          eq(schema.customers.id, input.id),
          eq(schema.customers.companyId, ctx.companyId!)
        ));

      return { success: true };
    }),
});

export const vendorsRouter = router({
  create: accountantProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      email: z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [vendor] = await db
        .insert(schema.vendors)
        .values({
          companyId: ctx.companyId!,
          name: input.name,
          email: input.email,
        })
        .returning();

      return vendor;
    }),

  list: accountantProcedure
    .input(z.object({
      page: z.number().int().positive().default(1),
      pageSize: z.number().int().positive().max(100).default(50),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const conditions = [eq(schema.vendors.companyId, ctx.companyId!)];

      if (input.search) {
        conditions.push(sql`${schema.vendors.name} ILIKE ${'%' + input.search + '%'}`);
      }

      const offset = (input.page - 1) * input.pageSize;

      const [vendors, totalResult] = await Promise.all([
        db
          .select()
          .from(schema.vendors)
          .where(and(...conditions))
          .orderBy(asc(schema.vendors.name))
          .limit(input.pageSize)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(schema.vendors)
          .where(and(...conditions)),
      ]);

      return {
        vendors,
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

      const [vendor] = await db
        .select()
        .from(schema.vendors)
        .where(and(
          eq(schema.vendors.id, input.id),
          eq(schema.vendors.companyId, ctx.companyId!)
        ));

      if (!vendor) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor not found' });
      }

      return vendor;
    }),

  update: accountantProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(255).optional(),
      email: z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const { id, ...updates } = input;

      const [vendor] = await db
        .update(schema.vendors)
        .set(updates)
        .where(and(
          eq(schema.vendors.id, id),
          eq(schema.vendors.companyId, ctx.companyId!)
        ))
        .returning();

      if (!vendor) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Vendor not found' });
      }

      return vendor;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [billCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.bills)
        .where(eq(schema.bills.vendorId, input.id));

      if (Number(billCount.count) > 0) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: 'Cannot delete vendor with existing bills' 
        });
      }

      await db
        .delete(schema.vendors)
        .where(and(
          eq(schema.vendors.id, input.id),
          eq(schema.vendors.companyId, ctx.companyId!)
        ));

      return { success: true };
    }),
});