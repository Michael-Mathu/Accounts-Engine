import { z } from 'zod';
import { and, asc, desc, eq, sql, lte, gte } from 'drizzle-orm';
import { router } from '../index';
import { accountantProcedure, adminProcedure, ownerProcedure } from '../index';
import { TRPCError } from '@trpc/server';
import { schema } from '@/server/db';

export const accountingPeriodsRouter = router({
  // List fiscal years with their periods
  listFiscalYears: accountantProcedure
    .query(async ({ ctx }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const fiscalYears = await db
        .select()
        .from(schema.fiscalYears)
        .where(eq(schema.fiscalYears.companyId, ctx.companyId!))
        .orderBy(desc(schema.fiscalYears.startDate));

      // Get periods for each fiscal year
      const yearsWithPeriods = await Promise.all(
        fiscalYears.map(async (fy) => {
          const periods = await db
            .select()
            .from(schema.accountingPeriods)
            .where(and(
              eq(schema.accountingPeriods.fiscalYearId, fy.id),
              eq(schema.accountingPeriods.companyId, ctx.companyId!)
            ))
            .orderBy(asc(schema.accountingPeriods.startDate));

          return { ...fy, periods };
        })
      );

      return yearsWithPeriods;
    }),

  // List periods (with optional fiscal year filter)
  list: accountantProcedure
    .input(z.object({
      fiscalYearId: z.string().uuid().optional(),
      includeClosed: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const conditions = [eq(schema.accountingPeriods.companyId, ctx.companyId!)];

      if (input.fiscalYearId) {
        conditions.push(eq(schema.accountingPeriods.fiscalYearId, input.fiscalYearId));
      }

      if (!input.includeClosed) {
        conditions.push(eq(schema.accountingPeriods.isClosed, false));
      }

      const periods = await db
        .select({
          id: schema.accountingPeriods.id,
          fiscalYearId: schema.accountingPeriods.fiscalYearId,
          name: schema.accountingPeriods.name,
          startDate: schema.accountingPeriods.startDate,
          endDate: schema.accountingPeriods.endDate,
          isClosed: schema.accountingPeriods.isClosed,
          closedAt: schema.accountingPeriods.closedAt,
          closedBy: schema.accountingPeriods.closedBy,
          createdAt: schema.accountingPeriods.createdAt,
          fiscalYearName: schema.fiscalYears.name,
        })
        .from(schema.accountingPeriods)
        .innerJoin(schema.fiscalYears, eq(schema.accountingPeriods.fiscalYearId, schema.fiscalYears.id))
        .where(and(...conditions))
        .orderBy(asc(schema.accountingPeriods.startDate));

      return { periods };
    }),

  // Get period by ID
  getById: accountantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [period] = await db
        .select({
          id: schema.accountingPeriods.id,
          fiscalYearId: schema.accountingPeriods.fiscalYearId,
          name: schema.accountingPeriods.name,
          startDate: schema.accountingPeriods.startDate,
          endDate: schema.accountingPeriods.endDate,
          isClosed: schema.accountingPeriods.isClosed,
          closedAt: schema.accountingPeriods.closedAt,
          closedBy: schema.accountingPeriods.closedBy,
          createdAt: schema.accountingPeriods.createdAt,
          fiscalYearName: schema.fiscalYears.name,
          fiscalYearStartDate: schema.fiscalYears.startDate,
          fiscalYearEndDate: schema.fiscalYears.endDate,
        })
        .from(schema.accountingPeriods)
        .innerJoin(schema.fiscalYears, eq(schema.accountingPeriods.fiscalYearId, schema.fiscalYears.id))
        .where(and(
          eq(schema.accountingPeriods.id, input.id),
          eq(schema.accountingPeriods.companyId, ctx.companyId!)
        ));

      if (!period) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Accounting period not found' });
      }

      return period;
    }),

  // Create fiscal year with periods
  createFiscalYear: ownerProcedure
    .input(z.object({
      name: z.string().min(1).max(50),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      periodType: z.enum(['monthly', 'quarterly']).default('monthly'),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      // Validate dates
      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);

      if (startDate >= endDate) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Start date must be before end date' });
      }

      // Check for overlapping fiscal years
      const overlapping = await db
        .select()
        .from(schema.fiscalYears)
        .where(and(
          eq(schema.fiscalYears.companyId, ctx.companyId!),
          lte(schema.fiscalYears.startDate, input.endDate),
          gte(schema.fiscalYears.endDate, input.startDate)
        ));

      if (overlapping.length > 0) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Fiscal year overlaps with existing fiscal year' });
      }

      // Create fiscal year
      const [fiscalYear] = await db
        .insert(schema.fiscalYears)
        .values({
          companyId: ctx.companyId!,
          name: input.name,
          startDate: input.startDate,
          endDate: input.endDate,
          isClosed: false,
        })
        .returning();

      // Generate periods
      const periods = [];
      const periodStart = new Date(startDate);
      let periodIndex = 1;

      while (periodStart < endDate) {
        const periodEnd = new Date(periodStart);
        
        if (input.periodType === 'monthly') {
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          periodEnd.setDate(periodEnd.getDate() - 1);
        } else {
          periodEnd.setMonth(periodEnd.getMonth() + 3);
          periodEnd.setDate(periodEnd.getDate() - 1);
        }

        // Cap at fiscal year end
        if (periodEnd > endDate) {
          periodEnd.setTime(endDate.getTime());
        }

        const periodName = input.periodType === 'monthly'
          ? periodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          : `Q${Math.ceil(periodIndex / 3)} ${periodStart.getFullYear()}`;

        periods.push({
          fiscalYearId: fiscalYear.id,
          companyId: ctx.companyId!,
          name: periodName,
          startDate: periodStart.toISOString().split('T')[0],
          endDate: periodEnd.toISOString().split('T')[0],
          isClosed: false,
        });

        periodStart.setDate(periodEnd.getDate() + 1);
        periodIndex++;
      }

      if (periods.length > 0) {
        await db.insert(schema.accountingPeriods).values(periods);
      }

      return { fiscalYear, periodsCreated: periods.length };
    }),

  // Close period (admin only)
  closePeriod: adminProcedure
    .input(z.object({
      periodId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [period] = await db
        .select()
        .from(schema.accountingPeriods)
        .where(and(
          eq(schema.accountingPeriods.id, input.periodId),
          eq(schema.accountingPeriods.companyId, ctx.companyId!)
        ));

      if (!period) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Period not found' });
      }

      if (period.isClosed) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Period is already closed' });
      }

      // Check if there are unposted journal entries in this period
      const [unpostedCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.journalEntries)
        .where(and(
          eq(schema.journalEntries.accountingPeriodId, input.periodId),
          eq(schema.journalEntries.isPosted, false)
        ));

      if (Number(unpostedCount.count) > 0) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: 'Cannot close period with unposted journal entries. Post or delete them first.' 
        });
      }

      const [updated] = await db
        .update(schema.accountingPeriods)
        .set({
          isClosed: true,
          closedAt: new Date(),
          closedBy: ctx.userId!,
        })
        .where(eq(schema.accountingPeriods.id, input.periodId))
        .returning();

      return updated;
    }),

  // Reopen period (admin only)
  reopenPeriod: adminProcedure
    .input(z.object({
      periodId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [period] = await db
        .select()
        .from(schema.accountingPeriods)
        .where(and(
          eq(schema.accountingPeriods.id, input.periodId),
          eq(schema.accountingPeriods.companyId, ctx.companyId!)
        ));

      if (!period) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Period not found' });
      }

      if (!period.isClosed) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Period is not closed' });
      }

      // Check if fiscal year is closed
      const [fy] = await db
        .select()
        .from(schema.fiscalYears)
        .where(eq(schema.fiscalYears.id, period.fiscalYearId));

      if (fy?.isClosed) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot reopen period in a closed fiscal year' });
      }

      const [updated] = await db
        .update(schema.accountingPeriods)
        .set({
          isClosed: false,
          closedAt: null,
          closedBy: null,
        })
        .where(eq(schema.accountingPeriods.id, input.periodId))
        .returning();

      return updated;
    }),

  // Get current open period
  getCurrentPeriod: accountantProcedure
    .query(async ({ ctx }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const today = new Date().toISOString().split('T')[0];

      const [period] = await db
        .select({
          id: schema.accountingPeriods.id,
          fiscalYearId: schema.accountingPeriods.fiscalYearId,
          name: schema.accountingPeriods.name,
          startDate: schema.accountingPeriods.startDate,
          endDate: schema.accountingPeriods.endDate,
          isClosed: schema.accountingPeriods.isClosed,
          fiscalYearName: schema.fiscalYears.name,
        })
        .from(schema.accountingPeriods)
        .innerJoin(schema.fiscalYears, eq(schema.accountingPeriods.fiscalYearId, schema.fiscalYears.id))
        .where(and(
          eq(schema.accountingPeriods.companyId, ctx.companyId!),
          eq(schema.accountingPeriods.isClosed, false),
          lte(schema.accountingPeriods.startDate, today),
          gte(schema.accountingPeriods.endDate, today)
        ))
        .orderBy(asc(schema.accountingPeriods.startDate))
        .limit(1);

      return period;
    }),
});