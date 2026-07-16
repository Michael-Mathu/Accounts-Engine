import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { router } from '../index';
import { accountantProcedure, adminProcedure } from '../index';
import { schema } from '@/server/db';

export const receiptsRouter = router({
  // Upload receipt for processing (accountant+)
  upload: accountantProcedure
    .input(z.object({
      fileUrl: z.string().url(),
      vendor: z.string().min(1).optional(),
      date: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();
      
      const [receipt] = await db.insert(schema.receipts).values({
        companyId: ctx.companyId as string,
        uploadedBy: ctx.userId as string,
        fileUrl: input.fileUrl,
        status: 'pending',
      }).returning();
      
      // Trigger AI extraction in background (would queue Inngest job)
      console.log(`Receipt ${receipt.id} uploaded, triggering AI extraction`);
      
      return receipt;
    }),
  
  // List receipts (accountant+)
  list: accountantProcedure
    .query(async ({ ctx }) => {
      const db = ctx.db;
      await ctx.setRLSContext();
      
      const receipts = await db
        .select()
        .from(schema.receipts)
        .where(eq(schema.receipts.companyId, ctx.companyId as string))
        .orderBy(desc(schema.receipts.createdAt));
      
      return receipts;
    }),
  
  // Get receipt details (accountant+)
  getById: accountantProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();
      
      const [receipt] = await db
        .select()
        .from(schema.receipts)
        .where(eq(schema.receipts.id, input.id));
      
      if (!receipt || receipt.companyId !== ctx.companyId) {
        return null;
      }
      
      // Get draft journal entry if any
      if (receipt.draftJournalEntryId) {
        const [entry] = await db
          .select()
          .from(schema.journalEntries)
          .where(eq(schema.journalEntries.id, receipt.draftJournalEntryId));
        receipt.draftJournalEntry = entry;
      }
      
      return receipt;
    }),
  
  // Process receipt (admin+)
  process: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();
      
      // Trigger AI extraction
      const [receipt] = await db
        .update(schema.receipts)
        .set({ status: 'processing' })
        .where(eq(schema.receipts.id, input.id))
        .returning();
      
      // In real implementation, this would queue an Inngest job
      // that calls aiRouter.extractReceipt
      
      return receipt;
    }),
  
  // Approve receipt (admin+)
  approve: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();
      
      const [receipt] = await db
        .update(schema.receipts)
        .set({ status: 'approved' })
        .where(eq(schema.receipts.id, input.id))
        .returning();
      
      // In real implementation, would create journal entry
      
      return receipt;
    }),
  
  // Reject receipt (admin+)
  reject: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();
      
      const [receipt] = await db
        .update(schema.receipts)
        .set({ status: 'rejected', extractedData: null })
        .where(eq(schema.receipts.id, input.id))
        .returning();
      
      return receipt;
    }),
});
