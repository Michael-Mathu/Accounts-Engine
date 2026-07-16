import { z } from 'zod';
import { and, desc, eq, sql } from 'drizzle-orm';
import { router } from '../root';
import { accountantProcedure, adminProcedure } from '../root';
import { TRPCError } from '@trpc/server';
import { schema } from '@/server/db';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const EXTRACTION_PROMPT = `You are an expert receipt extraction system. Extract the following information from the receipt image and return it as valid JSON.

Extract these fields:
{
  "merchant": "string - merchant/business name",
  "date": "string - ISO date format (YYYY-MM-DD)",
  "subtotal": "number - subtotal before tax",
  "tax": "number - tax amount",
  "total": "number - total amount",
  "currency": "string - ISO currency code (default USD)",
  "lineItems": [
    {
      "description": "string",
      "quantity": "number",
      "unitPrice": "number",
      "total": "number"
    }
  ],
  "category": "string - suggested expense category",
  "paymentMethod": "string - cash, credit, debit, etc.",
  "confidence": "number - 0 to 1 confidence score"
}

Rules:
1. If a field cannot be determined, use null
2. Dates must be in YYYY-MM-DD format
3. All amounts must be numbers (not strings)
4. Line items are optional but preferred
5. Return ONLY valid JSON, no markdown or explanation`;

export const aiRouter = router({
  // Internal: extract receipt data using Anthropic VLM
  extractReceipt: adminProcedure
    .input(z.object({
      receiptId: z.string().uuid(),
      imageUrl: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      // Update receipt status to processing
      await db
        .update(schema.receipts)
        .set({ status: 'processing' })
        .where(eq(schema.receipts.id, input.receiptId));

      try {
        // Call Anthropic API
        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2048,
          temperature: 0,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: EXTRACTION_PROMPT },
              { 
                type: 'image', 
                source: { 
                  type: 'url', 
                  url: input.imageUrl 
                } 
              },
            ],
          }],
        });

        // Parse response
        const content = response.content[0];
        if (content.type !== 'text') {
          throw new Error('Unexpected response type from Anthropic');
        }

        let extractedData;
        try {
          // Try to parse JSON from response
          const jsonMatch = content.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            extractedData = JSON.parse(jsonMatch[0]);
          } else {
            extractedData = JSON.parse(content.text);
          }
        } catch (parseError) {
          console.error('Failed to parse Anthropic response:', content.text);
          throw new Error('Failed to parse extraction result');
        }

        // Validate extracted data
        const validatedData = {
          merchant: extractedData.merchant || null,
          date: extractedData.date ? new Date(extractedData.date) : null,
          subtotal: typeof extractedData.subtotal === 'number' ? extractedData.subtotal : null,
          tax: typeof extractedData.tax === 'number' ? extractedData.tax : null,
          total: typeof extractedData.total === 'number' ? extractedData.total : null,
          currency: extractedData.currency || 'USD',
          lineItems: Array.isArray(extractedData.lineItems) ? extractedData.lineItems : [],
          category: extractedData.category || null,
          paymentMethod: extractedData.paymentMethod || null,
          confidence: typeof extractedData.confidence === 'number' ? extractedData.confidence : 0.5,
        };

        // Update receipt with extracted data
        await db
          .update(schema.receipts)
          .set({
            extractedData: validatedData,
            status: 'processed',
          })
          .where(eq(schema.receipts.id, input.receiptId));

        // Consume credit
        await db
          .insert(schema.creditTransactions)
          .values({
            companyId: ctx.companyId!,
            amount: -1,
            reason: 'receipt_ocr',
            description: `Receipt OCR extraction for ${validatedData.merchant || 'receipt'}`,
          });

        return { 
          success: true, 
          receiptId: input.receiptId,
          extractedData: validatedData,
        };
      } catch (error) {
        // Update receipt status to failed
        await db
          .update(schema.receipts)
          .set({ status: 'failed' })
          .where(eq(schema.receipts.id, input.receiptId));

        console.error('Receipt extraction failed:', error);
        throw new TRPCError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: 'Receipt extraction failed' 
        });
      }
    }),

  // Get extraction prompt for testing
  getPrompt: adminProcedure
    .query(() => {
      return { prompt: EXTRACTION_PROMPT };
    }),
});