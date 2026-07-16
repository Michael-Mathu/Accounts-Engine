import { getDb } from "@/server/db";
import { schema } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { faker } from "@faker-js/faker";

async function seed() {
  const db = getDb();

  console.log("🌱 Seeding database...");

  // Create demo company
  const [company] = await db
    .insert(schema.companies)
    .values({
      name: "Demo Company",
      taxIdentifier: "TAX-12345",
      baseCurrency: "USD",
    })
    .returning();

  console.log(`Created company: ${company.name} (${company.id})`);

  // Create demo user
  const passwordHash = await hash("password123", 12);
  const [user] = await db
    .insert(schema.users)
    .values({
      email: "demo@example.com",
      name: "Demo User",
      passwordHash,
    })
    .returning();

  console.log(`Created user: ${user.email} (${user.id})`);

  // Link user to company as owner
  await db.insert(schema.companyUsers).values({
    companyId: company.id,
    userId: user.id,
    role: "owner",
  });

  console.log("Linked user to company as owner");

  // Create default account types
  const defaultAccountTypes = [
    // Assets
    { class: "asset" as const, name: "Current Assets", normal_balance: "debit" as const },
    { class: "asset" as const, name: "Fixed Assets", normal_balance: "debit" as const },
    { class: "asset" as const, name: "Other Assets", normal_balance: "debit" as const },
    { class: "asset" as const, name: "Bank", normal_balance: "debit" as const },
    { class: "asset" as const, name: "Accounts Receivable", normal_balance: "debit" as const },
    { class: "asset" as const, name: "Inventory", normal_balance: "debit" as const },
    { class: "asset" as const, name: "Prepaid Expenses", normal_balance: "debit" as const },

    // Liabilities
    { class: "liability" as const, name: "Current Liabilities", normal_balance: "credit" as const },
    { class: "liability" as const, name: "Long-term Liabilities", normal_balance: "credit" as const },
    { class: "liability" as const, name: "Accounts Payable", normal_balance: "credit" as const },
    { class: "liability" as const, name: "Credit Card", normal_balance: "credit" as const },
    { class: "liability" as const, name: "Payroll Liabilities", normal_balance: "credit" as const },
    { class: "liability" as const, name: "Sales Tax Payable", normal_balance: "credit" as const },

    // Equity
    { class: "equity" as const, name: "Owner's Equity", normal_balance: "credit" as const },
    { class: "equity" as const, name: "Retained Earnings", normal_balance: "credit" as const },
    { class: "equity" as const, name: "Capital Stock", normal_balance: "credit" as const },

    // Revenue
    { class: "revenue" as const, name: "Sales Revenue", normal_balance: "credit" as const },
    { class: "revenue" as const, name: "Service Revenue", normal_balance: "credit" as const },
    { class: "revenue" as const, name: "Other Income", normal_balance: "credit" as const },

    // Expenses
    { class: "expense" as const, name: "Cost of Goods Sold", normal_balance: "debit" as const },
    { class: "expense" as const, name: "Payroll Expenses", normal_balance: "debit" as const },
    { class: "expense" as const, name: "Rent Expense", normal_balance: "debit" as const },
    { class: "expense" as const, name: "Utilities Expense", normal_balance: "debit" as const },
    { class: "expense" as const, name: "Office Expenses", normal_balance: "debit" as const },
    { class: "expense" as const, name: "Travel & Entertainment", normal_balance: "debit" as const },
    { class: "expense" as const, name: "Professional Fees", normal_balance: "debit" as const },
    { class: "expense" as const, name: "Insurance Expense", normal_balance: "debit" as const },
    { class: "expense" as const, name: "Depreciation Expense", normal_balance: "debit" as const },
    { class: "expense" as const, name: "Interest Expense", normal_balance: "debit" as const },
    { class: "expense" as const, name: "Other Expenses", normal_balance: "debit" as const },
  ];

  console.log("Seeding account types...");
  const accountTypeMap = new Map<string, number>();

  for (const type of defaultAccountTypes) {
    const [existing] = await db
      .select()
      .from(schema.accountTypes)
      .where(
        and(
          eq(schema.accountTypes.class, type.class),
          eq(schema.accountTypes.name, type.name)
        )
      );

    if (!existing) {
      const [created] = await db
        .insert(schema.accountTypes)
        .values({
          class: type.class,
          name: type.name,
          normalBalance: type.normal_balance as 'debit' | 'credit',
        })
        .returning();
      accountTypeMap.set(`${type.class}:${type.name}`, created.id);
    } else {
      accountTypeMap.set(`${type.class}:${type.name}`, existing.id);
    }
  }

  // Create chart of accounts
  console.log("Creating chart of accounts...");

  const accounts = [
    // Assets
    { code: "1000", name: "Assets", type: "asset:Current Assets", parent: null },
    { code: "1100", name: "Current Assets", type: "asset:Current Assets", parent: "1000" },
    { code: "1110", name: "Cash", type: "asset:Bank", parent: "1100" },
    { code: "1120", name: "Accounts Receivable", type: "asset:Accounts Receivable", parent: "1100" },
    { code: "1130", name: "Inventory", type: "asset:Inventory", parent: "1100" },
    { code: "1140", name: "Prepaid Expenses", type: "asset:Prepaid Expenses", parent: "1100" },
    { code: "1200", name: "Fixed Assets", type: "asset:Fixed Assets", parent: "1000" },
    { code: "1210", name: "Equipment", type: "asset:Fixed Assets", parent: "1200" },
    { code: "1220", name: "Accumulated Depreciation", type: "asset:Fixed Assets", parent: "1200" },

    // Liabilities
    { code: "2000", name: "Liabilities", type: "liability:Current Liabilities", parent: null },
    { code: "2100", name: "Current Liabilities", type: "liability:Current Liabilities", parent: "2000" },
    { code: "2110", name: "Accounts Payable", type: "liability:Accounts Payable", parent: "2100" },
    { code: "2120", name: "Credit Card", type: "liability:Credit Card", parent: "2100" },
    { code: "2130", name: "Sales Tax Payable", type: "liability:Sales Tax Payable", parent: "2100" },

    // Equity
    { code: "3000", name: "Equity", type: "equity:Owner's Equity", parent: null },
    { code: "3100", name: "Owner's Capital", type: "equity:Owner's Equity", parent: "3000" },
    { code: "3200", name: "Retained Earnings", type: "equity:Retained Earnings", parent: "3000" },

    // Revenue
    { code: "4000", name: "Revenue", type: "revenue:Sales Revenue", parent: null },
    { code: "4100", name: "Sales Revenue", type: "revenue:Sales Revenue", parent: "4000" },
    { code: "4200", name: "Service Revenue", type: "revenue:Service Revenue", parent: "4000" },

    // Expenses
    { code: "5000", name: "Expenses", type: "expense:Cost of Goods Sold", parent: null },
    { code: "5100", name: "Cost of Goods Sold", type: "expense:Cost of Goods Sold", parent: "5000" },
    { code: "5200", name: "Payroll Expenses", type: "expense:Payroll Expenses", parent: "5000" },
    { code: "5300", name: "Rent Expense", type: "expense:Rent Expense", parent: "5000" },
    { code: "5400", name: "Utilities Expense", type: "expense:Utilities Expense", parent: "5000" },
    { code: "5500", name: "Office Expenses", type: "expense:Office Expenses", parent: "5000" },
    { code: "5600", name: "Travel & Entertainment", type: "expense:Travel & Entertainment", parent: "5000" },
    { code: "5700", name: "Professional Fees", type: "expense:Professional Fees", parent: "5000" },
    { code: "5800", name: "Insurance Expense", type: "expense:Insurance Expense", parent: "5000" },
    { code: "5900", name: "Depreciation Expense", type: "expense:Depreciation Expense", parent: "5000" },
    { code: "6000", name: "Interest Expense", type: "expense:Interest Expense", parent: "5000" },
  ];

  const accountIdMap = new Map<string, string>();

  for (const acc of accounts) {
    const typeKey = acc.type;
    const typeId = accountTypeMap.get(typeKey);

    if (!typeId) {
      console.warn(`Account type not found: ${typeKey} for account ${acc.code}`);
      continue;
    }

    const parentId = acc.parent ? accountIdMap.get(acc.parent) : null;

    const [existing] = await db
      .select()
      .from(schema.accounts)
      .where(and(eq(schema.accounts.companyId, company.id), eq(schema.accounts.code, acc.code)));

    if (!existing) {
      const [created] = await db
        .insert(schema.accounts)
        .values({
          companyId: company.id,
          accountTypeId: typeId,
          code: acc.code,
          name: acc.name,
          parentId: parentId,
          isActive: true,
        })
        .returning();
      accountIdMap.set(acc.code, created.id);
    } else {
      accountIdMap.set(acc.code, existing.id);
    }
  }

  // Create default journals
  const journals = [
    { code: "GJ", name: "General Journal" },
    { code: "SJ", name: "Sales Journal" },
    { code: "PJ", name: "Purchase Journal" },
    { code: "CR", name: "Cash Receipts" },
    { code: "CD", name: "Cash Disbursements" },
    { code: "DEPR", name: "Depreciation" },
  ];

  for (const j of journals) {
    const [existing] = await db
      .select()
      .from(schema.journals)
      .where(and(eq(schema.journals.companyId, company.id), eq(schema.journals.code, j.code)));

    if (!existing) {
      await db.insert(schema.journals).values({
        companyId: company.id,
        code: j.code,
        name: j.name,
      });
    }
  }

  // Create fiscal year and period
  const [fiscalYear] = await db
    .insert(schema.fiscalYears)
    .values({
      companyId: company.id,
      name: "FY 2024",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      isClosed: false,
    })
    .returning();

  await db.insert(schema.accountingPeriods).values({
    fiscalYearId: fiscalYear.id,
    companyId: company.id,
    name: "FY 2024",
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    isClosed: false,
  });

  // Create subscription (self-hosted)
  await db.insert(schema.subscriptions).values({
    companyId: company.id,
    plan: "self_hosted",
    status: "active",
  });

  // Create credit balance
  await db.insert(schema.creditBalances).values({
    companyId: company.id,
    creditsRemaining: 10000,
  });

  // Create feature flags (all enabled for self-hosted)
  await db.insert(schema.featureFlags).values({
    companyId: company.id,
    plaidRelayEnabled: true,
    aiReceiptExtractionEnabled: true,
    aiReportsEnabled: true,
    apiAccessEnabled: true,
    multiEntityEnabled: true,
  });

  console.log("✅ Seeding complete!");
  console.log("");
  console.log("Demo credentials:");
  console.log("  Email:    demo@example.com");
  console.log("  Password: password123");
  console.log("");
  console.log("Company: Demo Company");
  console.log("Plan: Self-hosted (all features unlocked)");
}

seed().catch(console.error);