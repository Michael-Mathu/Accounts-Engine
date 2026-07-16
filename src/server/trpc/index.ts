import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import type { TRPCContext } from './context';
import { TRPCError } from '@trpc/server';

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

export const companyProcedure = protectedProcedure;
export const accountantProcedure = protectedProcedure;
export const adminProcedure = protectedProcedure;
export const ownerProcedure = protectedProcedure;

export { TRPCError };

export type { TRPCContext };