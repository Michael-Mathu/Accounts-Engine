import { z } from 'zod';
import { router } from '../root';
import { publicProcedure, protectedProcedure, companyProcedure, ownerProcedure } from '../root';
import { schema } from '@/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { compare, hash } from 'bcryptjs';
import { TRPCError } from '@trpc/server';

export const authRouter = router({
  // Public: Request password reset
  requestPasswordReset: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      // In a real implementation, this would send an email with a reset token
      // For now, we just return success to avoid user enumeration
      return { success: true };
    }),

  // Public: Reset password with token
  resetPassword: publicProcedure
    .input(z.object({
      token: z.string(),
      password: z.string().min(8),
    }))
    .mutation(async ({ ctx, input }) => {
      // In a real implementation, validate token and update password
      return { success: true };
    }),

  // Public: Verify email
  verifyEmail: publicProcedure
    .input(z.object({
      token: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // In a real implementation, validate token and mark email as verified
      return { success: true };
    }),

  // Protected: Get current user
  me: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }
      const db = ctx.db;
      await ctx.setRLSContext();

      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, ctx.userId));

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      // Get user's companies
      const memberships = await db
        .select({
          companyId: schema.companyUsers.companyId,
          companyName: schema.companies.name,
          role: schema.companyUsers.role,
        })
        .from(schema.companyUsers)
        .innerJoin(schema.companies, eq(schema.companyUsers.companyId, schema.companies.id))
        .where(eq(schema.companyUsers.userId, ctx.userId));

      return {
        ...user,
        memberships,
      };
    }),

  // Protected: Switch current company
  switchCompany: protectedProcedure
    .input(z.object({
      companyId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      // Verify user is a member of this company
      const [membership] = await db
        .select()
        .from(schema.companyUsers)
        .where(and(
          eq(schema.companyUsers.userId, ctx.userId!),
          eq(schema.companyUsers.companyId, input.companyId)
        ));

      if (!membership) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this company' });
      }

      // In a real implementation, you'd update the session/JWT with the new company
      return { success: true, companyId: input.companyId };
    }),

  // Owner: Invite user to company
  inviteUser: ownerProcedure
    .input(z.object({
      email: z.string().email(),
      role: z.enum(['owner', 'admin', 'accountant', 'viewer']).default('viewer'),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      // Find or create user
      let [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, input.email));

      if (!user) {
        [user] = await db
          .insert(schema.users)
          .values({ email: input.email })
          .returning();
      }

      // Check if already a member
      const [existing] = await db
        .select()
        .from(schema.companyUsers)
        .where(and(
          eq(schema.companyUsers.userId, user.id),
          eq(schema.companyUsers.companyId, ctx.companyId!)
        ));

      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'User is already a member' });
      }

      // Add to company
      await db
        .insert(schema.companyUsers)
        .values({
          companyId: ctx.companyId!,
          userId: user.id,
          role: input.role,
        });

      return { success: true, userId: user.id };
    }),

  // Owner: Remove user from company
  removeUser: ownerProcedure
    .input(z.object({
      userId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      // Prevent removing yourself
      if (input.userId === ctx.userId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot remove yourself' });
      }

      await db
        .delete(schema.companyUsers)
        .where(and(
          eq(schema.companyUsers.userId, input.userId),
          eq(schema.companyUsers.companyId, ctx.companyId!)
        ));

      return { success: true };
    }),

  // Owner: Update user role
  updateUserRole: ownerProcedure
    .input(z.object({
      userId: z.string().uuid(),
      role: z.enum(['owner', 'admin', 'accountant', 'viewer']),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [updated] = await db
        .update(schema.companyUsers)
        .set({ role: input.role })
        .where(and(
          eq(schema.companyUsers.userId, input.userId),
          eq(schema.companyUsers.companyId, ctx.companyId!)
        ))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Membership not found' });
      }

      return updated;
    }),

  // Owner: Get company members
  getMembers: ownerProcedure
    .query(async ({ ctx }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const members = await db
        .select({
          userId: schema.companyUsers.userId,
          userEmail: schema.users.email,
          userName: schema.users.name,
          role: schema.companyUsers.role,
          createdAt: schema.companyUsers.createdAt,
        })
        .from(schema.companyUsers)
        .innerJoin(schema.users, eq(schema.companyUsers.userId, schema.users.id))
        .where(eq(schema.companyUsers.companyId, ctx.companyId!));

      return members;
    }),
});