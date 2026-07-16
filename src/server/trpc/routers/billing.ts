import { z } from 'zod';
import { eq, desc, sql } from 'drizzle-orm';
import { router } from '../index';
import { ownerProcedure, accountantProcedure, TRPCError } from '../index';
import { schema } from '@/server/db';

const STRIPE_API_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// In production, use the actual Stripe SDK
// import Stripe from 'stripe';
// const stripe = new Stripe(STRIPE_API_KEY!, { apiVersion: '2024-04-10' });

const PLAN_PRICES = {
  monthly: { amount: 9999, interval: 'month' as const },
  quarterly: { amount: 29997, interval: 'month' as const, intervalCount: 3 },
  annual: { amount: 99900, interval: 'year' as const },
};

const CREDITS_PER_DOLLAR = 10;

export const billingRouter = router({
  getSubscription: ownerProcedure
    .query(async ({ ctx }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [subscription] = await db
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.companyId, ctx.companyId!));

      return subscription;
    }),

  createCheckoutSession: ownerProcedure
    .input(z.object({
      plan: z.enum(['monthly', 'quarterly', 'annual']),
      paymentMethod: z.enum(['card', 'bank_transfer']).default('card'),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const planConfig = PLAN_PRICES[input.plan];
      if (!planConfig) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid plan' });
      }

      let stripeCustomerId = '';
      const [existing] = await db
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.companyId, ctx.companyId!));

      if (existing?.stripeCustomerId) {
        stripeCustomerId = existing.stripeCustomerId;
      } else {
        // In production: create Stripe customer
        // const customer = await stripe.customers.create({ email: session.user.email });
        stripeCustomerId = `cus_mock_${ctx.companyId!.slice(0, 8)}`;
      }

      // In production: create Stripe checkout session
      // const session = await stripe.checkout.sessions.create({
      //   customer: stripeCustomerId,
      //   payment_method_types: ['card'],
      //   line_items: [{
      //     price_data: {
      //       currency: 'usd',
      //       product_data: { name: `Accounting Engine ${input.plan} plan` },
      //       unit_amount: planConfig.amount,
      //       recurring: { interval: planConfig.interval, interval_count: planConfig.intervalCount },
      //     },
      //     quantity: 1,
      //   }],
      //   mode: 'subscription',
      //   success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true`,
      //   cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?canceled=true`,
      // });

      const checkoutSessionId = `cs_test_${Math.random().toString(36).slice(2, 15)}`;

      return {
        checkoutUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing/checkout/${checkoutSessionId}`,
        amount: planConfig.amount,
        currency: 'usd',
        plan: input.plan,
      };
    }),

  createPortalSession: ownerProcedure
    .input(z.object({
      returnUrl: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [subscription] = await db
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.companyId, ctx.companyId!));

      if (!subscription?.stripeCustomerId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No active subscription' });
      }

      // In production: const session = await stripe.billingPortal.sessions.create({...})
      const portalSessionId = `bps_test_${Math.random().toString(36).slice(2, 15)}`;

      return {
        portalUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/billing/portal/${portalSessionId}`,
        customerId: subscription.stripeCustomerId,
      };
    }),

  purchaseCredits: ownerProcedure
    .input(z.object({
      amount: z.number().int().min(1).max(100000),
      paymentMethod: z.enum(['card', 'bank_transfer']).default('card'),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const credits = input.amount;
      const stripeAmount = Math.round(credits / CREDITS_PER_DOLLAR * 100); // cents

      // In production: create Stripe payment intent
      // const paymentIntent = await stripe.paymentIntents.create({...})

      const paymentIntentId = `pi_test_${Math.random().toString(36).slice(2, 15)}`;

      // Update credit balance optimistically (would be confirmed via webhook in production)
      const [updatedBalance] = await db
        .insert(schema.creditBalances)
        .values({
          companyId: ctx.companyId!,
          creditsRemaining: credits,
        })
        .onConflictDoUpdate({
          target: schema.creditBalances.companyId,
          set: {
            creditsRemaining: sql`${schema.creditBalances.creditsRemaining} + ${credits}`,
            updatedAt: new Date(),
          },
        })
        .returning();

      await db.insert(schema.creditTransactions).values({
        companyId: ctx.companyId!,
        amount: credits,
        reason: 'purchase',
        description: `Purchased ${credits} credits`,
        stripeInvoiceId: `in_test_${paymentIntentId}`,
      });

      return {
        paymentIntentId,
        amount: stripeAmount,
        credits,
      };
    }),

  getCreditBalance: ownerProcedure
    .query(async ({ ctx }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [balance] = await db
        .select()
        .from(schema.creditBalances)
        .where(eq(schema.creditBalances.companyId, ctx.companyId!));

      const transactions = await db
        .select()
        .from(schema.creditTransactions)
        .where(eq(schema.creditTransactions.companyId, ctx.companyId!))
        .orderBy(desc(schema.creditTransactions.createdAt))
        .limit(50);

      return {
        balance: balance?.creditsRemaining || 0,
        transactions,
      };
    }),

  getFeatureGates: ownerProcedure
    .query(async ({ ctx }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const [flags] = await db
        .select()
        .from(schema.featureFlags)
        .where(eq(schema.featureFlags.companyId, ctx.companyId!));

      const [subscription] = await db
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.companyId, ctx.companyId!));

      const [balance] = await db
        .select()
        .from(schema.creditBalances)
        .where(eq(schema.creditBalances.companyId, ctx.companyId!));

      const credits = balance?.creditsRemaining || 0;
      const isSelfHosted = subscription?.plan === 'self_hosted';
      const isHostedActive = subscription && ['monthly', 'quarterly', 'annual'].includes(subscription.plan) && subscription.status === 'active';

      let plaidAccess = isSelfHosted || (isHostedActive && credits > 0);
      let aiReceiptAccess = isSelfHosted || (isHostedActive && credits > 0);
      let aiReportsAccess = isSelfHosted || (isHostedActive && credits > 0);
      let apiAccess = isSelfHosted || isHostedActive;
      let multiEntityAccess = isSelfHosted || isHostedActive;

      if (flags) {
        if (flags.plaidRelayEnabled !== undefined) plaidAccess = flags.plaidRelayEnabled;
        if (flags.aiReceiptExtractionEnabled !== undefined) aiReceiptAccess = flags.aiReceiptExtractionEnabled;
        if (flags.aiReportsEnabled !== undefined) aiReportsAccess = flags.aiReportsEnabled;
        if (flags.apiAccessEnabled !== undefined) apiAccess = flags.apiAccessEnabled;
        if (flags.multiEntityEnabled !== undefined) multiEntityAccess = flags.multiEntityEnabled;
      }

      return {
        plaid_relay: plaidAccess,
        ai_receipt_extraction: aiReceiptAccess,
        ai_reports: aiReportsAccess,
        api_access: apiAccess,
        multi_entity: multiEntityAccess,
        credits,
        plan: subscription?.plan || 'none',
        subscriptionStatus: subscription?.status || 'none',
      };
    }),

  // Webhook handler for Stripe events
  stripeWebhook: accountantProcedure
    .input(z.object({
      eventType: z.string(),
      data: z.object({
        object: z.record(z.unknown()),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      // In production: verify webhook signature
      // const sig = headers.get('stripe-signature');
      // const event = stripe.webhooks.constructEvent(payload, sig, STRIPE_WEBHOOK_SECRET!);

      const { eventType, data } = input;

      switch (eventType) {
case 'checkout.session.completed': {
          const session = data.object as Record<string, unknown>;
          const companyId = session.metadata?.companyId as string | undefined;
          const plan = session.metadata?.plan as 'self_hosted' | 'monthly' | 'quarterly' | 'annual' | undefined;

          if (companyId && plan) {
            await db
              .insert(schema.subscriptions)
              .values({
                companyId,
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: session.subscription as string,
                plan,
                status: 'active',
                currentPeriodStart: new Date((session.subscription as Record<string, unknown>).current_period_start as number * 1000),
                currentPeriodEnd: new Date((session.subscription as Record<string, unknown>).current_period_end as number * 1000),
              })
              .onConflictDoUpdate({
                target: schema.subscriptions.companyId,
                set: {
                  stripeSubscriptionId: session.subscription as string,
                  plan,
                  status: 'active',
                  currentPeriodStart: new Date((session.subscription as Record<string, unknown>).current_period_start as number * 1000),
                  currentPeriodEnd: new Date((session.subscription as Record<string, unknown>).current_period_end as number * 1000),
                  updatedAt: new Date(),
                },
              });
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = data.object as Record<string, unknown>;
          const subscriptionId = invoice.subscription as string;
          const amount = invoice.amount_paid as number;
          const credits = Math.round(amount / 100 * CREDITS_PER_DOLLAR);

          await db
            .insert(schema.creditBalances)
            .values({
              companyId: ctx.companyId!,
              creditsRemaining: credits,
            })
            .onConflictDoUpdate({
              target: [schema.creditBalances.companyId],
              set: {
                creditsRemaining: sql`${schema.creditBalances.creditsRemaining} + ${credits}`,
                updatedAt: new Date(),
              },
            });

          await db.insert(schema.creditTransactions).values({
            companyId: ctx.companyId!,
            amount: credits,
            reason: 'purchase',
            description: `Credit purchase via invoice ${invoice.id}`,
            stripeInvoiceId: invoice.id as string,
          });
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = data.object as Record<string, unknown>;
          await db
            .update(schema.subscriptions)
            .set({
              status: subscription.status as string,
              currentPeriodStart: new Date((subscription.current_period_start as number) * 1000),
              currentPeriodEnd: new Date((subscription.current_period_end as number) * 1000),
              updatedAt: new Date(),
            })
            .where(eq(schema.subscriptions.stripeSubscriptionId, subscription.id as string));
          break;
        }

        case 'customer.subscription.deleted': {
          await db
            .update(schema.subscriptions)
            .set({
              status: 'canceled',
              updatedAt: new Date(),
            })
            .where(eq(schema.subscriptions.stripeSubscriptionId, data.object.id));
          break;
        }
      }

      return { received: true };
    }),
});