import { z } from 'zod';
import { asc, desc, eq } from 'drizzle-orm';
import { router } from '../index';
import { accountantProcedure } from '../index';
import { schema } from '@/server/db';

export const taxRouter = router({
  // Get Schedule C lines (accountant+)
  getScheduleCLines: accountantProcedure
    .query(async ({ ctx }) => {
      const db = ctx.db;
      await ctx.setRLSContext();
      
      const lines = await db
        .select()
        .from(schema.taxCategories)
        .orderBy(schema.taxCategories.part, schema.taxCategories.lineNumber);
      
      return lines;
    }),
  
  // Map account to Schedule C line (accountant+)
  mapAccount: accountantProcedure
    .input(z.object({
      accountId: z.string().uuid(),
      scheduleCLineId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();
      
      const [account] = await db
        .update(schema.accounts)
        .set({ scheduleCLineId: input.scheduleCLineId })
        .where(eq(schema.accounts.id, input.accountId))
        .returning();
      
      return account;
    }),
  
  // Get mileage rates (accountant+)
  getMileageRates: accountantProcedure.query(async ({ ctx }) => {
    // Return standard IRS mileage rates by year
    return [
      { year: 2026, rate: 0.67 }, // Projected 2026 rate
      { year: 2025, rate: 0.65 },
      { year: 2024, rate: 0.65 },
    ];
  }),
  
  // Create mileage log (accountant+)
  createMileageLog: accountantProcedure
    .input(z.object({
      logDate: z.string().transform(val => new Date(val)),
      startLocation: z.string().optional(),
      endLocation: z.string().optional(),
      businessPurpose: z.string().min(1),
      miles: z.number().min(0.01),
      rateUsed: z.number().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();
      
      const [log] = await db.insert(schema.mileageLogs).values({
        companyId: ctx.companyId as string,
        userId: ctx.userId as string,
        logDate: input.logDate,
        startLocation: input.startLocation,
        endLocation: input.endLocation,
        businessPurpose: input.businessPurpose,
        miles: input.miles,
        rateUsed: input.rateUsed,
      }).returning();
      
      return log;
    }),
  
  // List mileage logs (accountant+)
  listMileageLogs: accountantProcedure
    .query(async ({ ctx }) => {
      const db = ctx.db;
      await ctx.setRLSContext();
      
      const logs = await db
        .select()
        .from(schema.mileageLogs)
        .where(eq(schema.mileageLogs.companyId, ctx.companyId as string))
        .orderBy(desc(schema.mileageLogs.logDate));
      
      return logs;
    }),
  
  // Create fixed asset (accountant+)
  createFixedAsset: accountantProcedure
    .input(z.object({
      name: z.string().min(1),
      purchaseDate: z.string().transform(val => new Date(val)),
      cost: z.number().min(0.01),
      salvageValue: z.number().default(0),
      usefulLifeYears: z.number().min(1),
      method: z.enum(['straight_line', 'declining_balance', 'sum_of_years_digits']).default('straight_line'),
      assetAccountId: z.string().uuid(),
      accumulatedDepreciationAccountId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();
      
      const [asset] = await db.insert(schema.fixedAssets).values({
        companyId: ctx.companyId as string,
        name: input.name,
        purchaseDate: input.purchaseDate,
        cost: input.cost,
        salvageValue: input.salvageValue,
        usefulLifeYears: input.usefulLifeYears,
        method: input.method,
        assetAccountId: input.assetAccountId,
        accumulatedDepreciationAccountId: input.accumulatedDepreciationAccountId,
      }).returning();
      
      return asset;
    }),
  
  // List fixed assets (accountant+)
  listFixedAssets: accountantProcedure
    .query(async ({ ctx }) => {
      const db = ctx.db;
      await ctx.setRLSContext();
      
      const assets = await db
        .select()
        .from(schema.fixedAssets)
        .where(eq(schema.fixedAssets.companyId, ctx.companyId as string))
        .orderBy(asc(schema.fixedAssets.name));
      
      return assets;
    }),
});
