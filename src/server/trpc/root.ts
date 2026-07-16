import { router, publicProcedure, protectedProcedure, companyProcedure, accountantProcedure, adminProcedure, ownerProcedure, createCallerFactory } from './index';
import { authRouter } from './routers/auth';
import { accountsRouter } from './routers/accounts';
import { journalEntriesRouter } from './routers/journalEntries';
import { reportsRouter } from './routers/reports';
import { accountTypesRouter } from './routers/accountTypes';
import { customersRouter, vendorsRouter } from './routers/customers-vendors';
import { invoicesRouter } from './routers/invoices';
import { billsRouter } from './routers/bills';
import { paymentsRouter } from './routers/payments';
import { receiptsRouter } from './routers/receipts';
import { aiRouter } from './routers/ai';
import { bankAccountsRouter, bankTransactionsRouter } from './routers/banking';
import { reconciliationEngineRouter } from './routers/reconciliation-engine';
import { taxRouter } from './routers/tax';
import { billingRouter } from './routers/billing';

export { router, publicProcedure, protectedProcedure, companyProcedure, accountantProcedure, adminProcedure, ownerProcedure, createCallerFactory };

export const appRouter = router({
  auth: authRouter,
  accounts: accountsRouter,
  accountTypes: accountTypesRouter,
  journalEntries: journalEntriesRouter,
  reports: reportsRouter,
  customers: customersRouter,
  vendors: vendorsRouter,
  invoices: invoicesRouter,
  bills: billsRouter,
  payments: paymentsRouter,
  receipts: receiptsRouter,
  ai: aiRouter,
  bankAccounts: bankAccountsRouter,
  bankTransactions: bankTransactionsRouter,
  reconciliationEngine: reconciliationEngineRouter,
  tax: taxRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;