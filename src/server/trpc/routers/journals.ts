import { z } from 'zod';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { router } from '../index';
import { accountantProcedure, adminProcedure } from '../index';
import { TRPCError } from '@trpc/server';
import { schema } from '@/server/db';

export const journalsRouter = router({
  create: accountantProcedure
    .input(z.object({
      code: z.string().min(1).max(10),
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      isDefault: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      // Check code uniqueness
      const [existing] = await db
        .select()
        .from(schema.journals)
        .where(and(
          eq(schema.journals.companyId, ctx.companyId!),
          eq(schema.journals.code, input.code)
        ));

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Journal code already exists' });
      }

      // If setting as default, unset other defaults
      if (input.isDefault) {
        await db
          .update(schema.journals)
          .set({ isDefault: false })
          .where(eq(schema.journals.companyId, ctx.companyId!));
      }

      const [journal] = await db
        .insert(schema.journals)
        .values({
          companyId: ctx.companyId!,
          code: input.code,
          name: input.name,
          description: input.description,
          isDefault: input.isDefault,
        })
        .returning();

      return journal;
    }),

  list: accountantProcedure
    .query(async ({ ctx }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const journals = await db
        .select({
          id: schema.journals.id,
          code: schema.journals.code,
          name: schema.journals.name,
          description: schema.journals.description,
          isDefault: schema.journals.isDefault,
          createdAt: schema.journals.createdAt,
        })
        .from(schema.journals)
        .where(eq(schema.journals.companyId, ctx.companyId!))
        .orderBy(asc(schema.journals.code));

      return journals;
    }),

  getById: accountantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [journal] = await db
        .select()
        .from(schema.journals)
        .where(and(
          eq(schema.journals.id, input.id),
          eq(schema.journals.companyId, ctx.companyId!)
        ));

      if (!journal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Journal not found' });
      }

      return journal;
    }),

  update: accountantProcedure
    .input(z.object({
      id: z.string().uuid(),
      code: z.string().min(1).max(10).optional(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().optional(),
      isDefault: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const { id, ...updates } = input;

      const [existing] = await db
        .select()
        .from(schema.journals)
        .where(and(
          eq(schema.journals.id, id),
          eq(schema.journals.companyId, ctx.companyId!)
        ));

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Journal not found' });
      }

      // Check code uniqueness if changing
      if (updates.code && updates.code !== existing.code) {
        const [duplicate] = await db
          .select()
          .from(schema.journals)
          .where(and(
            eq(schema.journals.companyId, ctx.companyId!),
            eq(schema.journals.code, updates.code)
          ));

        if (duplicate) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Journal code already exists' });
        }
      }

      // If setting as default, unset other defaults
      if (updates.isDefault) {
        await db
          .update(schema.journals)
          .set({ isDefault: false })
          .where(and(
            eq(schema.journals.companyId, ctx.companyId!),
            eq(schema.journals.id, existing.id)
          ));
      }

      const [updated] = await db
        .update(schema.journals)
        .set(updates)
        .where(eq(schema.journals.id, id))
        .returning();

      return updated;
    }),

  // Archive (delete) journal - admin only
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [journal] = await db
        .select()
        .from(schema.journals)
        .where(and(
          eq(schema.journals.id, input.id),
          eq(schema.journals.companyId, ctx.companyId!)
        ));

      if (!journal) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Journal not found' });
      }

      // Check if journal has entries
      const [entryCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.journalEntries)
        .where(eq(schema.journalEntries.journalId, input.id));

      if (Number(entryCount.count) > 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot delete journal with existing entries' });
      }

      await db
        .delete(schema.journals)
        .where(eq(schema.journals.id, input.id));

      return { success: true };
    }),

  // Get default journal
  getDefault: accountantProcedure
    .query(async ({ ctx }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [journal] = await db
        .select()
        .from(schema.journals)
        .where(and(
          eq(schema.journals.companyId, ctx.companyId!),
          eq(schema.journals.isDefault, true)
        ))
        .limit(1);

      return journal;
    }),
});