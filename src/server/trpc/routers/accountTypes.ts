import { z } from 'zod';
import { router } from '../root';
import { accountantProcedure, adminProcedure, ownerProcedure } from '../root';
import { schema } from '@/server/db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';

export const accountTypesRouter = router({
  // List all account types
  list: accountantProcedure
    .query(async ({ ctx }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const types = await db
        .select()
        .from(schema.accountTypes)
        .orderBy(asc(schema.accountTypes.class), asc(schema.accountTypes.name));

      return types;
    }),

  // Get account types by class
  getByClass: accountantProcedure
    .input(z.object({
      class: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
    }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const types = await db
        .select()
        .from(schema.accountTypes)
        .where(eq(schema.accountTypes.class, input.class))
        .orderBy(asc(schema.accountTypes.name));

      return types;
    }),

  // Create account type (admin only - these are usually system-defined)
  create: adminProcedure
    .input(z.object({
      class: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
      name: z.string().min(1).max(100),
      normalBalance: z.enum(['debit', 'credit']),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [type] = await db
        .insert(schema.accountTypes)
        .values(input)
        .returning();

      return type;
    }),

  // Update account type (admin only)
  update: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      name: z.string().min(1).max(100).optional(),
      normalBalance: z.enum(['debit', 'credit']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const { id, ...updates } = input;

      const [type] = await db
        .update(schema.accountTypes)
        .set(updates)
        .where(eq(schema.accountTypes.id, id))
        .returning();

      if (!type) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Account type not found' });
      }

      return type;
    }),

  // Delete account type (admin only - only if no accounts reference it)
  delete: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      // Check if any accounts use this type
      const [count] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.accounts)
        .where(eq(schema.accounts.accountTypeId, input.id));

      if (Number(count.count) > 0) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: 'Cannot delete account type that is in use by accounts' 
        });
      }

      await db
        .delete(schema.accountTypes)
        .where(eq(schema.accountTypes.id, input.id));

      return { success: true };
    }),

  // Seed default account types (owner only)
  seedDefaults: ownerProcedure
    .mutation(async ({ ctx }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const defaults = [
        // Assets
        { class: 'asset', name: 'Current Assets', normalBalance: 'debit' },
        { class: 'asset', name: 'Fixed Assets', normalBalance: 'debit' },
        { class: 'asset', name: 'Other Assets', normalBalance: 'debit' },
        { class: 'asset', name: 'Bank', normalBalance: 'debit' },
        { class: 'asset', name: 'Accounts Receivable', normalBalance: 'debit' },
        { class: 'asset', name: 'Inventory', normalBalance: 'debit' },
        { class: 'asset', name: 'Prepaid Expenses', normalBalance: 'debit' },

        // Liabilities
        { class: 'liability', name: 'Current Liabilities', normalBalance: 'credit' },
        { class: 'liability', name: 'Long-term Liabilities', normalBalance: 'credit' },
        { class: 'liability', name: 'Accounts Payable', normalBalance: 'credit' },
        { class: 'liability', name: 'Credit Card', normalBalance: 'credit' },
        { class: 'liability', name: 'Payroll Liabilities', normalBalance: 'credit' },
        { class: 'liability', name: 'Sales Tax Payable', normalBalance: 'credit' },

        // Equity
        { class: 'equity', name: 'Owner\'s Equity', normalBalance: 'credit' },
        { class: 'equity', name: 'Retained Earnings', normalBalance: 'credit' },
        { class: 'equity', name: 'Capital Stock', normalBalance: 'credit' },

        // Revenue
        { class: 'revenue', name: 'Sales Revenue', normalBalance: 'credit' },
        { class: 'revenue', name: 'Service Revenue', normalBalance: 'credit' },
        { class: 'revenue', name: 'Other Income', normalBalance: 'credit' },

        // Expenses
        { class: 'expense', name: 'Cost of Goods Sold', normalBalance: 'debit' },
        { class: 'expense', name: 'Payroll Expenses', normalBalance: 'debit' },
        { class: 'expense', name: 'Rent Expense', normalBalance: 'debit' },
        { class: 'expense', name: 'Utilities Expense', normalBalance: 'debit' },
        { class: 'expense', name: 'Office Expenses', normalBalance: 'debit' },
        { class: 'expense', name: 'Travel & Entertainment', normalBalance: 'debit' },
        { class: 'expense', name: 'Professional Fees', normalBalance: 'debit' },
        { class: 'expense', name: 'Insurance Expense', normalBalance: 'debit' },
        { class: 'expense', name: 'Depreciation Expense', normalBalance: 'debit' },
        { class: 'expense', name: 'Interest Expense', normalBalance: 'debit' },
        { class: 'expense', name: 'Other Expenses', normalBalance: 'debit' },
      ];

      const results = [];
      for (const def of defaults) {
        const [existing] = await db
          .select()
          .from(schema.accountTypes)
          .where(and(
            eq(schema.accountTypes.class, def.class as typeof schema.accountTypes.class.enumValues[number]),
            eq(schema.accountTypes.name, def.name)
          ));

        if (!existing) {
          const [created] = await db
            .insert(schema.accountTypes)
            .values(def)
            .returning();
          results.push(created);
        }
      }

      return { created: results.length, types: results };
    }),
});