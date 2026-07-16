import { describe, it, expect, beforeAll } from 'vitest';
import { createCallerFactory } from '@/server/trpc/root';
import { appRouter } from '@/server/trpc/root';
import { getDb } from '@/server/db';

const createCaller = createCallerFactory(appRouter);

function createTestCaller() {
  return createCaller({
    db: getDb(),
    userId: null,
    companyId: null,
    setRLSContext: async () => {},
  });
}

describe('tRPC Integration Tests', () => {
  const caller = createTestCaller();

  describe('Account Types Router', () => {
    it('should list account types', async () => {
      const result = await caller.accountTypes.list();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Accounts Router', () => {
    it('should list accounts', async () => {
      const result = await caller.accounts.list({ page: 1, pageSize: 10 });
      expect(result.accounts).toBeDefined();
      expect(typeof result.page).toBe('number');
      expect(typeof result.totalPages).toBe('number');
    });
  });

  describe('Reports Router', () => {
    it('should generate trial balance', async () => {
      const result = await caller.reports.trialBalance({});
      expect(result.rows).toBeDefined();
      expect(result.totals).toBeDefined();
      expect(typeof result.totals.isBalanced).toBe('boolean');
    });

    it('should generate profit and loss report', async () => {
      const result = await caller.reports.profitAndLoss({
        fromDate: '2024-01-01',
        toDate: '2024-12-31',
      });
      expect(result.revenue).toBeDefined();
      expect(typeof result.expenses).toBe('number');
      expect(typeof result.netIncome).toBe('number');
    });

    it('should generate balance sheet report', async () => {
      const result = await caller.reports.balanceSheet({});
      expect(result.assets).toBeDefined();
      expect(result.liabilities).toBeDefined();
      expect(result.equity).toBeDefined();
      expect(typeof result.balanced).toBe('boolean');
    });
  });

  describe('Tax Router', () => {
    it('should list mileage logs', async () => {
      const result = await caller.tax.listMileageLogs();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should get mileage rates', async () => {
      const result = await caller.tax.getMileageRates();
      expect(Array.isArray(result)).toBe(true);
      expect(result.some(r => r.year === 2024)).toBe(true);
    });
  });
});