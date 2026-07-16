import { z } from 'zod';
import { and, asc, desc, eq, sql, lte, gte, sum } from 'drizzle-orm';
import { router } from '../index';
import { accountantProcedure } from '../index';
import { TRPCError } from '@trpc/server';
import { schema } from '@/server/db';

export const reportsRouter = router({
  // Trial Balance
  trialBalance: accountantProcedure
    .input(z.object({
      asOfDate: z.string().transform(val => new Date(val)).optional(),
      accountingPeriodId: z.string().uuid().optional(),
      includeZeroBalance: z.boolean().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      // Get balance sums per account from posted journal entries
      let linesQuery = db
        .select({
          accountId: schema.journalLines.accountId,
          totalDebit: sum(schema.journalLines.debit).as('totalDebit'),
          totalCredit: sum(schema.journalLines.credit).as('totalCredit'),
        })
        .from(schema.journalLines)
        .innerJoin(schema.journalEntries, eq(schema.journalLines.journalEntryId, schema.journalEntries.id))
        .where(and(
          eq(schema.journalEntries.companyId, ctx.companyId!),
          eq(schema.journalEntries.isPosted, true),
        ));

      if (input.asOfDate) {
        linesQuery = linesQuery.where(lte(schema.journalEntries.postingDate, input.asOfDate));
      }

      if (input.accountingPeriodId) {
        linesQuery = linesQuery.where(eq(schema.journalEntries.accountingPeriodId, input.accountingPeriodId));
      }

      const lineSums = await linesQuery.groupBy(schema.journalLines.accountId);

      const balanceMap = new Map();
      for (const ls of lineSums) {
        balanceMap.set(ls.accountId, {
          debit: Number(ls.totalDebit || 0),
          credit: Number(ls.totalCredit || 0),
        });
      }

      // Get all active accounts with their types
      const accounts = await db
        .select({
          id: schema.accounts.id,
          code: schema.accounts.code,
          name: schema.accounts.name,
          description: schema.accounts.description,
          isActive: schema.accounts.isActive,
          accountTypeId: schema.accounts.accountTypeId,
          accountClass: schema.accountTypes.class,
          normalBalance: schema.accountTypes.normalBalance,
        })
        .from(schema.accounts)
        .innerJoin(schema.accountTypes, eq(schema.accounts.accountTypeId, schema.accountTypes.id))
        .where(and(
          eq(schema.accounts.companyId, ctx.companyId!),
          eq(schema.accounts.isActive, true)
        ))
        .orderBy(asc(schema.accounts.code));

      // Build trial balance rows
      const rows = accounts.map(acc => {
        const balances = balanceMap.get(acc.id) || { debit: 0, credit: 0 };
        const netBalance = balances.debit - balances.credit;
        const displayBalance = acc.normalBalance === 'debit' ? netBalance : -netBalance;

        return {
          accountId: acc.id,
          code: acc.code,
          name: acc.name,
          description: acc.description,
          accountClass: acc.accountClass,
          normalBalance: acc.normalBalance,
          debit: balances.debit,
          credit: balances.credit,
          balance: displayBalance,
        };
      });

      const filteredRows = input.includeZeroBalance 
        ? rows 
        : rows.filter(r => r.balance !== 0 || r.debit !== 0 || r.credit !== 0);

      const totalDebits = filteredRows.reduce((sum, r) => sum + r.debit, 0);
      const totalCredits = filteredRows.reduce((sum, r) => sum + r.credit, 0);
      const totalBalance = filteredRows.reduce((sum, r) => sum + r.balance, 0);

      const byClass = {
        asset: filteredRows.filter(r => r.accountClass === 'asset'),
        liability: filteredRows.filter(r => r.accountClass === 'liability'),
        equity: filteredRows.filter(r => r.accountClass === 'equity'),
        revenue: filteredRows.filter(r => r.accountClass === 'revenue'),
        expense: filteredRows.filter(r => r.accountClass === 'expense'),
      };

      return {
        asOfDate: input.asOfDate || new Date(),
        accountingPeriodId: input.accountingPeriodId,
        rows: filteredRows,
        totals: {
          totalDebits,
          totalCredits,
          totalBalance,
          isBalanced: Math.abs(totalBalance) < 0.01,
        },
        byClass,
      };
    }),

  // Profit & Loss (Income Statement)
  profitAndLoss: accountantProcedure
    .input(z.object({
      fromDate: z.string().transform(val => new Date(val)),
      toDate: z.string().transform(val => new Date(val)),
      accountingPeriodId: z.string().uuid().optional(),
      compareFromDate: z.string().transform(val => new Date(val)).optional(),
      compareToDate: z.string().transform(val => new Date(val)).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      async function getBalances(from: Date, to: Date, periodId?: string) {
        let query = db
          .select({
            accountId: schema.journalLines.accountId,
            totalDebit: sum(schema.journalLines.debit).as('totalDebit'),
            totalCredit: sum(schema.journalLines.credit).as('totalCredit'),
            accountCode: schema.accounts.code,
            accountName: schema.accounts.name,
            accountClass: schema.accountTypes.class,
            normalBalance: schema.accountTypes.normalBalance,
          })
          .from(schema.journalLines)
          .innerJoin(schema.journalEntries, eq(schema.journalLines.journalEntryId, schema.journalEntries.id))
          .innerJoin(schema.accounts, eq(schema.journalLines.accountId, schema.accounts.id))
          .innerJoin(schema.accountTypes, eq(schema.accounts.accountTypeId, schema.accountTypes.id))
          .where(and(
            eq(schema.journalEntries.companyId, ctx.companyId!),
            eq(schema.journalEntries.isPosted, true),
            gte(schema.journalEntries.postingDate, from),
            lte(schema.journalEntries.postingDate, to),
          ));

        if (periodId) {
          query = query.where(eq(schema.journalEntries.accountingPeriodId, periodId));
        }

        const results = await query.groupBy(
          schema.journalLines.accountId,
          schema.accounts.code,
          schema.accounts.name,
          schema.accountTypes.class,
          schema.accountTypes.normalBalance
        );

        return results.map(r => ({
          accountId: r.accountId,
          code: r.accountCode,
          name: r.accountName,
          class: r.accountClass,
          normalBalance: r.normalBalance,
          debit: Number(r.totalDebit || 0),
          credit: Number(r.totalCredit || 0),
        }));
      }

      const [currentBalances, compareBalances] = await Promise.all([
        getBalances(input.fromDate, input.toDate, input.accountingPeriodId),
        input.compareFromDate && input.compareToDate
          ? getBalances(input.compareFromDate, input.compareToDate)
          : Promise.resolve([]),
      ]);

      const revenueAccounts = currentBalances.filter(b => b.class === 'revenue');
      const expenseAccounts = currentBalances.filter(b => b.class === 'expense');

      const revenue = revenueAccounts.reduce((sum, acc) => {
        const net = acc.credit - acc.debit;
        return sum + (acc.normalBalance === 'credit' ? net : -net);
      }, 0);

      const expenses = expenseAccounts.reduce((sum, acc) => {
        const net = acc.debit - acc.credit;
        return sum + (acc.normalBalance === 'debit' ? net : -net);
      }, 0);

      const revenueRows = revenueAccounts.map(acc => ({
        accountId: acc.accountId,
        code: acc.code,
        name: acc.name,
        amount: acc.normalBalance === 'credit' ? (acc.credit - acc.debit) : -(acc.credit - acc.debit),
      }));

      const expenseRows = expenseAccounts.map(acc => ({
        accountId: acc.accountId,
        code: acc.code,
        name: acc.name,
        amount: acc.normalBalance === 'debit' ? (acc.debit - acc.credit) : -(acc.debit - acc.credit),
      }));

      const netIncome = revenue - expenses;

      let comparison = null;
      if (compareBalances.length > 0) {
        const prevRevenue = compareBalances
          .filter(b => b.class === 'revenue')
          .reduce((sum, acc) => sum + (acc.normalBalance === 'credit' ? (acc.credit - acc.debit) : -(acc.credit - acc.debit)), 0);
        const prevExpenses = compareBalances
          .filter(b => b.class === 'expense')
          .reduce((sum, acc) => sum + (acc.normalBalance === 'debit' ? (acc.debit - acc.credit) : -(acc.debit - acc.credit)), 0);

        comparison = {
          revenue: prevRevenue,
          expenses: prevExpenses,
          netIncome: prevRevenue - prevExpenses,
        };
      }

      return {
        period: { from: input.fromDate, to: input.toDate },
        revenue,
        expenses,
        netIncome,
        revenueRows,
        expenseRows,
        comparison,
      };
    }),

  // Balance Sheet
  balanceSheet: accountantProcedure
    .input(z.object({
      asOfDate: z.string().transform(val => new Date(val)).optional(),
      accountingPeriodId: z.string().uuid().optional(),
      compareAsOfDate: z.string().transform(val => new Date(val)).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = ctx.db;
      await ctx.setRLSContext();

      const asOfDate = input.asOfDate || new Date();

      async function getBalances(toDate: Date, periodId?: string) {
        let query = db
          .select({
            accountId: schema.journalLines.accountId,
            totalDebit: sum(schema.journalLines.debit).as('totalDebit'),
            totalCredit: sum(schema.journalLines.credit).as('totalCredit'),
            accountCode: schema.accounts.code,
            accountName: schema.accounts.name,
            accountClass: schema.accountTypes.class,
            normalBalance: schema.accountTypes.normalBalance,
          })
          .from(schema.journalLines)
          .innerJoin(schema.journalEntries, eq(schema.journalLines.journalEntryId, schema.journalEntries.id))
          .innerJoin(schema.accounts, eq(schema.journalLines.accountId, schema.accounts.id))
          .innerJoin(schema.accountTypes, eq(schema.accounts.accountTypeId, schema.accountTypes.id))
          .where(and(
            eq(schema.journalEntries.companyId, ctx.companyId!),
            eq(schema.journalEntries.isPosted, true),
            lte(schema.journalEntries.postingDate, toDate),
          ));

        if (periodId) {
          query = query.where(eq(schema.journalEntries.accountingPeriodId, periodId));
        }

        const results = await query.groupBy(
          schema.journalLines.accountId,
          schema.accounts.code,
          schema.accounts.name,
          schema.accountTypes.class,
          schema.accountTypes.normalBalance
        );

        return results.map(r => ({
          accountId: r.accountId,
          code: r.accountCode,
          name: r.accountName,
          class: r.accountClass,
          normalBalance: r.normalBalance,
          debit: Number(r.totalDebit || 0),
          credit: Number(r.totalCredit || 0),
        }));
      }

      const [currentBalances, compareBalances] = await Promise.all([
        getBalances(asOfDate, input.accountingPeriodId),
        input.compareAsOfDate ? getBalances(input.compareAsOfDate) : Promise.resolve([]),
      ]);

      const buildSection = (balances: typeof currentBalances, className: string) => {
        return balances
          .filter(b => b.class === className)
          .map(b => {
            const net = b.debit - b.credit;
            const balance = b.normalBalance === 'debit' ? net : -net;
            return {
              accountId: b.accountId,
              code: b.code,
              name: b.name,
              balance,
            };
          });
      };

      // Assets
      const currentAssets = buildSection(currentBalances, 'asset').filter(a => 
        ['1100', '1200', '1300'].some(prefix => a.code.startsWith(prefix))
      );
      const fixedAssets = buildSection(currentBalances, 'asset').filter(a => 
        ['1400', '1500', '1600', '1700', '1800', '1900'].some(prefix => a.code.startsWith(prefix))
      );
      const otherAssets = buildSection(currentBalances, 'asset').filter(a => 
        !['1100', '1200', '1300', '1400', '1500', '1600', '1700', '1800', '1900'].some(prefix => a.code.startsWith(prefix))
      );

      // Liabilities
      const currentLiabilities = buildSection(currentBalances, 'liability').filter(l => 
        ['2100', '2200'].some(prefix => l.code.startsWith(prefix))
      );
      const longTermLiabilities = buildSection(currentBalances, 'liability').filter(l => 
        !['2100', '2200'].some(prefix => l.code.startsWith(prefix))
      );

      // Equity
      const equity = buildSection(currentBalances, 'equity');

      // Calculate totals
      const totalAssets = [...currentAssets, ...fixedAssets, ...otherAssets].reduce((sum, a) => sum + a.balance, 0);
      const totalLiabilities = [...currentLiabilities, ...longTermLiabilities].reduce((sum, l) => sum + l.balance, 0);
      const totalEquity = equity.reduce((sum, e) => sum + e.balance, 0);

      let comparison = null;
      if (compareBalances.length > 0) {
        const prevAssets = compareBalances.filter(b => b.class === 'asset').reduce((sum, b) => {
          const net = b.debit - b.credit;
          return sum + (b.normalBalance === 'debit' ? net : -net);
        }, 0);
        const prevLiabilities = compareBalances.filter(b => b.class === 'liability').reduce((sum, b) => {
          const net = b.debit - b.credit;
          return sum + (b.normalBalance === 'credit' ? net : -net);
        }, 0);
        const prevEquity = compareBalances.filter(b => b.class === 'equity').reduce((sum, b) => {
          const net = b.debit - b.credit;
          return sum + (b.normalBalance === 'credit' ? net : -net);
        }, 0);

        comparison = {
          assets: prevAssets,
          liabilities: prevLiabilities,
          equity: prevEquity,
        };
      }

      return {
        asOfDate,
        accountingPeriodId: input.accountingPeriodId,
        assets: {
          current: currentAssets,
          fixed: fixedAssets,
          other: otherAssets,
          total: totalAssets,
        },
        liabilities: {
          current: currentLiabilities,
          longTerm: longTermLiabilities,
          total: totalLiabilities,
        },
        equity: {
          accounts: equity,
          total: totalEquity,
        },
        totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
        balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
        comparison,
      };
    }),
});