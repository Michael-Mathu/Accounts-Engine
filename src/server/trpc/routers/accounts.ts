import { z } from 'zod';
import { router } from '../root';
import { accountantProcedure, adminProcedure } from '../root';
import { schema } from '@/server/db/schema';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { TRPCError } from '@trpc/server';

const parentAlias = alias(schema.accounts, 'parent');

export const accountsRouter = router({
  // Get chart of accounts tree
  getTree: accountantProcedure
    .query(async ({ ctx }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const allAccounts = await db
        .select({
          id: schema.accounts.id,
          code: schema.accounts.code,
          name: schema.accounts.name,
          description: schema.accounts.description,
          accountTypeId: schema.accounts.accountTypeId,
          parentId: schema.accounts.parentId,
          isActive: schema.accounts.isActive,
          accountClass: schema.accountTypes.class,
          normalBalance: schema.accountTypes.normalBalance,
          scheduleCLineId: schema.accounts.scheduleCLineId,
        })
        .from(schema.accounts)
        .innerJoin(schema.accountTypes, eq(schema.accounts.accountTypeId, schema.accountTypes.id))
        .where(and(
          eq(schema.accounts.companyId, ctx.companyId!),
          eq(schema.accounts.isActive, true)
        ))
        .orderBy(asc(schema.accounts.code));

      // Build tree structure
      const accountMap = new Map<string, typeof allAccounts[0] & { children: typeof allAccounts }>();
      const roots: typeof allAccounts[0] & { children: typeof allAccounts }[] = [];

      for (const acc of allAccounts) {
        accountMap.set(acc.id, { ...acc, children: [] });
      }

      for (const acc of allAccounts) {
        const node = accountMap.get(acc.id)!;
        if (acc.parentId) {
          const parent = accountMap.get(acc.parentId);
          if (parent) {
            parent.children.push(node);
          } else {
            roots.push(node);
          }
        } else {
          roots.push(node);
        }
      }

      return roots;
    }),

  // List accounts (flat, with filters)
  list: accountantProcedure
    .input(z.object({
      includeInactive: z.boolean().default(false),
      accountTypeId: z.number().optional(),
      parentId: z.string().uuid().optional(),
      search: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const conditions = [eq(schema.accounts.companyId, ctx.companyId!)];

      if (!input.includeInactive) {
        conditions.push(eq(schema.accounts.isActive, true));
      }

      if (input.accountTypeId) {
        conditions.push(eq(schema.accounts.accountTypeId, input.accountTypeId));
      }

      if (input.parentId) {
        conditions.push(eq(schema.accounts.parentId, input.parentId));
      }

      if (input.search) {
        conditions.push(
          sql`(${schema.accounts.code} ILIKE ${`%${input.search}%`} OR ${schema.accounts.name} ILIKE ${`%${input.search}%`})`
        );
      }

      const offset = (input.page - 1) * input.pageSize;

      const accounts = await db
        .select({
          id: schema.accounts.id,
          code: schema.accounts.code,
          name: schema.accounts.name,
          description: schema.accounts.description,
          accountTypeId: schema.accounts.accountTypeId,
          accountTypeName: schema.accountTypes.name,
          accountClass: schema.accountTypes.class,
          normalBalance: schema.accountTypes.normalBalance,
          parentId: schema.accounts.parentId,
          isActive: schema.accounts.isActive,
          scheduleCLineId: schema.accounts.scheduleCLineId,
          createdAt: schema.accounts.createdAt,
        })
        .from(schema.accounts)
        .innerJoin(schema.accountTypes, eq(schema.accounts.accountTypeId, schema.accountTypes.id))
        .where(and(...conditions))
        .orderBy(asc(schema.accounts.code))
        .limit(input.pageSize)
        .offset(offset);

      const [totalResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.accounts)
        .where(and(...conditions));

      return {
        accounts,
        total: Number(totalResult.count),
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(Number(totalResult.count) / input.pageSize),
      };
    }),

  // Get single account by ID
  getById: accountantProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [account] = await db
        .select({
          id: schema.accounts.id,
          code: schema.accounts.code,
          name: schema.accounts.name,
          description: schema.accounts.description,
          accountTypeId: schema.accounts.accountTypeId,
          accountTypeName: schema.accountTypes.name,
          accountClass: schema.accountTypes.class,
          normalBalance: schema.accountTypes.normalBalance,
          parentId: schema.accounts.parentId,
          parentCode: parentAlias.code,
          isActive: schema.accounts.isActive,
          scheduleCLineId: schema.accounts.scheduleCLineId,
          createdAt: schema.accounts.createdAt,
        })
        .from(schema.accounts)
        .leftJoin(schema.accountTypes, eq(schema.accounts.accountTypeId, schema.accountTypes.id))
        .leftJoin(parentAlias, eq(schema.accounts.parentId, parentAlias.id))
        .where(and(
          eq(schema.accounts.id, input.id),
          eq(schema.accounts.companyId, ctx.companyId!)
        ));

      if (!account) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found' });
      }

      // Get children
      const children = await db
        .select({
          id: schema.accounts.id,
          code: schema.accounts.code,
          name: schema.accounts.name,
        })
        .from(schema.accounts)
        .where(eq(schema.accounts.parentId, input.id))
        .orderBy(asc(schema.accounts.code));

      return { ...account, children };
    }),

  // Create new account
  create: accountantProcedure
    .input(z.object({
      accountTypeId: z.number().int().positive(),
      code: z.string().min(1).max(50),
      name: z.string().min(1).max(150),
      description: z.string().optional(),
      parentId: z.string().uuid().optional(),
      scheduleCLineId: z.string().max(10).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      // Validate account type exists
      const [accountType] = await db
        .select()
        .from(schema.accountTypes)
        .where(eq(schema.accountTypes.id, input.accountTypeId));

      if (!accountType) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid account type' });
      }

      // Check code uniqueness
      const [existing] = await db
        .select()
        .from(schema.accounts)
        .where(and(
          eq(schema.accounts.companyId, ctx.companyId!),
          eq(schema.accounts.code, input.code)
        ));

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Account code already exists' });
      }

      // Validate parent if provided
      if (input.parentId) {
        const [parent] = await db
          .select()
          .from(schema.accounts)
          .where(and(
            eq(schema.accounts.id, input.parentId),
            eq(schema.accounts.companyId, ctx.companyId!)
          ));

        if (!parent) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Parent account not found' });
        }

        // Prevent circular reference
        if (parent.id === input.parentId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Account cannot be its own parent' });
        }
      }

      // Validate schedule C line if provided
      if (input.scheduleCLineId) {
        const [taxLine] = await db
          .select()
          .from(schema.taxCategories)
          .where(eq(schema.taxCategories.id, input.scheduleCLineId));

        if (!taxLine) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid Schedule C line' });
        }
      }

      const [account] = await db
        .insert(schema.accounts)
        .values({
          companyId: ctx.companyId!,
          accountTypeId: input.accountTypeId,
          code: input.code,
          name: input.name,
          description: input.description,
          parentId: input.parentId,
          scheduleCLineId: input.scheduleCLineId,
          isActive: true,
        })
        .returning();

      return account;
    }),

  // Update account
  update: accountantProcedure
    .input(z.object({
      id: z.string().uuid(),
      code: z.string().min(1).max(50).optional(),
      name: z.string().min(1).max(150).optional(),
      description: z.string().optional(),
      parentId: z.string().uuid().nullable().optional(),
      isActive: z.boolean().optional(),
      scheduleCLineId: z.string().max(10).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const { id, ...updates } = input;

      const [existing] = await db
        .select()
        .from(schema.accounts)
        .where(and(
          eq(schema.accounts.id, id),
          eq(schema.accounts.companyId, ctx.companyId!)
        ));

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found' });
      }

      // Validate code uniqueness if changing
      if (updates.code && updates.code !== existing.code) {
        const [duplicate] = await db
          .select()
          .from(schema.accounts)
          .where(and(
            eq(schema.accounts.companyId, ctx.companyId!),
            eq(schema.accounts.code, updates.code)
          ));

        if (duplicate) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Account code already exists' });
        }
      }

      // Validate parent if changing
      if (updates.parentId !== undefined) {
        if (updates.parentId) {
          const [parent] = await db
            .select()
            .from(schema.accounts)
            .where(and(
              eq(schema.accounts.id, updates.parentId),
              eq(schema.accounts.companyId, ctx.companyId!)
            ));

          if (!parent) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Parent account not found' });
          }

          // Check for circular reference
          let currentParentId = parent.parentId;
          while (currentParentId) {
            if (currentParentId === id) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: 'Circular reference detected' });
            }
            const [p] = await db
              .select()
              .from(schema.accounts)
              .where(eq(schema.accounts.id, currentParentId));
            if (!p) break;
            currentParentId = p.parentId;
          }
        }
      }

      // Validate schedule C line
      if (updates.scheduleCLineId !== undefined && updates.scheduleCLineId) {
        const [taxLine] = await db
          .select()
          .from(schema.taxCategories)
          .where(eq(schema.taxCategories.id, updates.scheduleCLineId));

        if (!taxLine) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid Schedule C line' });
        }
      }

      const [updated] = await db
        .update(schema.accounts)
        .set(updates)
        .where(eq(schema.accounts.id, id))
        .returning();

      return updated;
    }),

  // Archive account (admin only)
  archive: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [account] = await db
        .select()
        .from(schema.accounts)
        .where(and(
          eq(schema.accounts.id, input.id),
          eq(schema.accounts.companyId, ctx.companyId!)
        ));

      if (!account) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found' });
      }

      // Check if account has children
      const children = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.parentId, input.id));

      if (children.length > 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot archive account with child accounts' });
      }

      // Check if account has journal lines
      const [lineCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.journalLines)
        .where(eq(schema.journalLines.accountId, input.id));

      if (Number(lineCount.count) > 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot archive account with journal lines' });
      }

      const [updated] = await db
        .update(schema.accounts)
        .set({ isActive: false })
        .where(eq(schema.accounts.id, input.id))
        .returning();

      return updated;
    }),
});