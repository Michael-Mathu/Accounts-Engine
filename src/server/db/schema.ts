import { pgTable, uuid, varchar, text, timestamp, boolean, integer, decimal, pgEnum, serial, date, jsonb, uniqueIndex, index, char, check, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';

export const accountClassType = pgEnum('account_class_type', ['asset', 'liability', 'equity', 'revenue', 'expense']);
export const normalBalanceType = pgEnum('normal_balance_type', ['debit', 'credit']);
export const invoiceStatusType = pgEnum('invoice_status', ['draft', 'sent', 'partial', 'paid', 'void']);
export const billStatusType = pgEnum('bill_status', ['draft', 'approved', 'partial', 'paid', 'void']);
export const bankTransactionStatusType = pgEnum('bank_transaction_status', ['unmatched', 'matched', 'excluded']);
export const matchTypeType = pgEnum('match_type', ['exact', 'split', 'tolerance', 'rule', 'manual']);
export const receiptStatusType = pgEnum('receipt_status', ['pending', 'processing', 'processed', 'failed', 'approved', 'rejected']);
export const subscriptionStatusType = pgEnum('subscription_status', ['active', 'canceled', 'past_due', 'incomplete', 'expired']);
export const subscriptionPlanType = pgEnum('subscription_plan', ['self_hosted', 'monthly', 'quarterly', 'annual']);
export const creditReasonType = pgEnum('credit_reason', ['receipt_ocr', 'bank_sync', 'ai_report', 'ledger_export', 'purchase', 'depreciation_posting']);
export const depreciationMethodType = pgEnum('depreciation_method', ['straight_line', 'declining_balance', 'sum_of_years_digits']);

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  taxIdentifier: varchar('tax_identifier', { length: 100 }),
  baseCurrency: char('base_currency', { length: 3 }).notNull().default('USD'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }),
  passwordHash: varchar('password_hash', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const companyUsers = pgTable('company_users', {
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 30 }).notNull().default('owner'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  pk: check('pk_company_users', sql`${table.companyId} IS NOT NULL AND ${table.userId} IS NOT NULL`),
}));

export const accountTypes = pgTable('account_types', {
  id: serial('id').primaryKey(),
  class: accountClassType('class').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  normalBalance: normalBalanceType('normal_balance').notNull(),
  sortOrder: integer('sort_order').default(0),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  accountTypeId: integer('account_type_id').notNull().references(() => accountTypes.id),
  code: varchar('code', { length: 50 }).notNull(),
  name: varchar('name', { length: 150 }).notNull(),
  description: text('description'),
  parentId: uuid('parent_id').references((): AnyPgColumn => accounts.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').notNull().default(true),
  scheduleCLineId: varchar('schedule_c_line_id', { length: 10 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueCodePerCompany: uniqueIndex('accounts_company_code_unique').on(table.companyId, table.code),
  parentIdx: index('accounts_parent_idx').on(table.parentId),
}));

export const journals = pgTable('journals', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 10 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueCodePerCompany: uniqueIndex('journals_company_code_unique').on(table.companyId, table.code),
}));

export const fiscalYears = pgTable('fiscal_years', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 50 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  isClosed: boolean('is_closed').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const accountingPeriods = pgTable('accounting_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  fiscalYearId: uuid('fiscal_year_id').notNull().references(() => fiscalYears.id, { onDelete: 'cascade' }),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 50 }).notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  isClosed: boolean('is_closed').default(false),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedBy: uuid('closed_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  companyIdx: index('accounting_periods_company_idx').on(table.companyId),
}));

export const journalEntries = pgTable('journal_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  journalId: uuid('journal_id').notNull().references(() => journals.id),
  accountingPeriodId: uuid('accounting_period_id').notNull().references(() => accountingPeriods.id),
  entryDate: date('entry_date').notNull(),
  postingDate: date('posting_date').notNull(),
  referenceNumber: varchar('reference_number', { length: 100 }),
  description: text('description'),
  isPosted: boolean('is_posted').notNull().default(false),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  postedBy: uuid('posted_by').references(() => users.id),
  reversedEntryId: uuid('reversed_entry_id').references((): AnyPgColumn => journalEntries.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  companyIdx: index('journal_entries_company_idx').on(table.companyId),
  periodIdx: index('journal_entries_period_idx').on(table.accountingPeriodId),
  postedIdx: index('journal_entries_posted_idx').on(table.isPosted),
}));

export const journalLines = pgTable('journal_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  journalEntryId: uuid('journal_entry_id').notNull().references(() => journalEntries.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  description: text('description'),
  debit: decimal('debit', { precision: 18, scale: 4 }).notNull().default('0'),
  credit: decimal('credit', { precision: 18, scale: 4 }).notNull().default('0'),
  signedAmount: decimal('signed_amount', { precision: 18, scale: 4 }).notNull().default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  entryIdx: index('journal_lines_entry_idx').on(table.journalEntryId),
  accountIdx: index('journal_lines_account_idx').on(table.accountId),
}));

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  paymentTermsDays: integer('payment_terms_days').notNull().default(30),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const vendors = pgTable('vendors', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  paymentTermsDays: integer('payment_terms_days').notNull().default(30),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  issueDate: date('issue_date').notNull(),
  dueDate: date('due_date').notNull(),
  status: invoiceStatusType('status').notNull().default('draft'),
  subtotal: decimal('subtotal', { precision: 18, scale: 4 }).notNull().default('0'),
  taxTotal: decimal('tax_total', { precision: 18, scale: 4 }).notNull().default('0'),
  total: decimal('total', { precision: 18, scale: 4 }).notNull().default('0'),
  amountPaid: decimal('amount_paid', { precision: 18, scale: 4 }).notNull().default('0'),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueNumberPerCompany: uniqueIndex('invoices_company_number_unique').on(table.companyId, table.invoiceNumber),
  customerIdx: index('invoices_customer_idx').on(table.customerId),
}));

export const invoiceLines = pgTable('invoice_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
  unitPrice: decimal('unit_price', { precision: 18, scale: 4 }).notNull().default('0'),
  amount: decimal('amount', { precision: 18, scale: 4 }).notNull().default('0'),
  revenueAccountId: uuid('revenue_account_id').notNull().references(() => accounts.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const bills = pgTable('bills', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  billNumber: varchar('bill_number', { length: 50 }).notNull(),
  issueDate: date('issue_date').notNull(),
  dueDate: date('due_date').notNull(),
  status: billStatusType('status').notNull().default('draft'),
  subtotal: decimal('subtotal', { precision: 18, scale: 4 }).notNull().default('0'),
  taxTotal: decimal('tax_total', { precision: 18, scale: 4 }).notNull().default('0'),
  total: decimal('total', { precision: 18, scale: 4 }).notNull().default('0'),
  amountPaid: decimal('amount_paid', { precision: 18, scale: 4 }).notNull().default('0'),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueNumberPerCompany: uniqueIndex('bills_company_number_unique').on(table.companyId, table.billNumber),
  vendorIdx: index('bills_vendor_idx').on(table.vendorId),
}));

export const billLines = pgTable('bill_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  billId: uuid('bill_id').notNull().references(() => bills.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: decimal('quantity', { precision: 10, scale: 2 }).notNull().default('1'),
  unitPrice: decimal('unit_price', { precision: 18, scale: 4 }).notNull().default('0'),
  amount: decimal('amount', { precision: 18, scale: 4 }).notNull().default('0'),
  expenseAccountId: uuid('expense_account_id').notNull().references(() => accounts.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const bankAccounts = pgTable('bank_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 150 }).notNull(),
  ledgerAccountId: uuid('ledger_account_id').notNull().references(() => accounts.id),
  plaidItemId: varchar('plaid_item_id', { length: 100 }),
  plaidAccessTokenEncrypted: text('plaid_access_token_encrypted'),
  currency: char('currency', { length: 3 }).notNull().default('USD'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const bankTransactions = pgTable('bank_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  bankAccountId: uuid('bank_account_id').notNull().references(() => bankAccounts.id, { onDelete: 'cascade' }),
  externalTransactionId: varchar('external_transaction_id', { length: 100 }),
  postedDate: date('posted_date').notNull(),
  amount: decimal('amount', { precision: 18, scale: 4 }).notNull(),
  description: text('description'),
  status: bankTransactionStatusType('status').notNull().default('unmatched'),
  matchType: matchTypeType('match_type'),
  matchedJournalEntryId: uuid('matched_journal_entry_id').references(() => journalEntries.id, { onDelete: 'set null' }),
  rawPayload: jsonb('raw_payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueExternalPerAccount: uniqueIndex('bank_transactions_external_unique').on(table.bankAccountId, table.externalTransactionId),
  accountIdx: index('bank_transactions_account_idx').on(table.bankAccountId),
  statusIdx: index('bank_transactions_status_idx').on(table.status),
}));

export const receipts = pgTable('receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  uploadedBy: uuid('uploaded_by').notNull().references(() => users.id),
  fileUrl: text('file_url').notNull(),
  status: receiptStatusType('status').notNull().default('pending'),
  extractedData: jsonb('extracted_data'),
  draftJournalEntryId: uuid('draft_journal_entry_id').references(() => journalEntries.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  companyIdx: index('receipts_company_idx').on(table.companyId),
  statusIdx: index('receipts_status_idx').on(table.status),
}));

export const taxCategories = pgTable('tax_categories', {
  id: varchar('id', { length: 10 }).primaryKey(),
  part: varchar('part', { length: 50 }).notNull(),
  lineNumber: varchar('line_number', { length: 20 }).notNull(),
  description: text('description').notNull(),
  isDeductible: boolean('is_deductible').notNull().default(true),
  sortOrder: integer('sort_order').default(0),
});

export const mileageLogs = pgTable('mileage_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  logDate: date('log_date').notNull(),
  startLocation: varchar('start_location', { length: 255 }),
  endLocation: varchar('end_location', { length: 255 }),
  businessPurpose: text('business_purpose').notNull(),
  miles: decimal('miles', { precision: 10, scale: 2 }).notNull(),
  rateUsed: decimal('rate_used', { precision: 6, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  companyIdx: index('mileage_logs_company_idx').on(table.companyId),
  userIdx: index('mileage_logs_user_idx').on(table.userId),
}));

export const fixedAssets = pgTable('fixed_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  purchaseDate: date('purchase_date').notNull(),
  cost: decimal('cost', { precision: 18, scale: 4 }).notNull(),
  salvageValue: decimal('salvage_value', { precision: 18, scale: 4 }).notNull().default('0'),
  usefulLifeYears: integer('useful_life_years').notNull(),
  method: depreciationMethodType('method').notNull().default('straight_line'),
  assetAccountId: uuid('asset_account_id').notNull().references(() => accounts.id),
  accumulatedDepreciationAccountId: uuid('accumulated_depreciation_account_id').notNull().references(() => accounts.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const depreciationSchedules = pgTable('depreciation_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  fixedAssetId: uuid('fixed_asset_id').notNull().references(() => fixedAssets.id, { onDelete: 'cascade' }),
  accountingPeriodId: uuid('accounting_period_id').notNull().references(() => accountingPeriods.id),
  amount: decimal('amount', { precision: 18, scale: 4 }).notNull(),
  isPosted: boolean('is_posted').notNull().default(false),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  assetPeriodIdx: index('depreciation_schedules_asset_period_idx').on(table.fixedAssetId, table.accountingPeriodId),
}));

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().unique().references(() => companies.id, { onDelete: 'cascade' }),
  stripeCustomerId: varchar('stripe_customer_id', { length: 100 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 100 }),
  plan: subscriptionPlanType('plan').notNull(),
  status: subscriptionStatusType('status').notNull().default('incomplete'),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const creditBalances = pgTable('credit_balances', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().unique().references(() => companies.id, { onDelete: 'cascade' }),
  creditsRemaining: integer('credits_remaining').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const creditTransactions = pgTable('credit_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  reason: creditReasonType('reason').notNull(),
  description: text('description'),
  stripeInvoiceId: varchar('stripe_invoice_id', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  companyIdx: index('credit_transactions_company_idx').on(table.companyId),
  reasonIdx: index('credit_transactions_reason_idx').on(table.reason),
}));

export const featureFlags = pgTable('feature_flags', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().unique().references(() => companies.id, { onDelete: 'cascade' }),
  plaidRelayEnabled: boolean('plaid_relay_enabled').default(false),
  aiReceiptExtractionEnabled: boolean('ai_receipt_extraction_enabled').default(false),
  aiReportsEnabled: boolean('ai_reports_enabled').default(false),
  apiAccessEnabled: boolean('api_access_enabled').default(false),
  multiEntityEnabled: boolean('multi_entity_enabled').default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id'),
  beforeData: jsonb('before_data'),
  afterData: jsonb('after_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  companyIdx: index('audit_logs_company_idx').on(table.companyId),
  entityIdx: index('audit_logs_entity_idx').on(table.entityType, table.entityId),
  createdIdx: index('audit_logs_created_idx').on(table.createdAt),
}));

// Payment tables
export const customerPayments = pgTable('customer_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  paymentDate: date('payment_date').notNull(),
  amount: decimal('amount', { precision: 18, scale: 4 }).notNull(),
  bankAccountId: uuid('bank_account_id').references(() => bankAccounts.id),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  companyIdx: index('customer_payments_company_idx').on(table.companyId),
  customerIdx: index('customer_payments_customer_idx').on(table.customerId),
}));

export const paymentApplications = pgTable('payment_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id').notNull().references(() => customerPayments.id, { onDelete: 'cascade' }),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  appliedAmount: decimal('applied_amount', { precision: 18, scale: 4 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  paymentIdx: index('payment_applications_payment_idx').on(table.paymentId),
  invoiceIdx: index('payment_applications_invoice_idx').on(table.invoiceId),
}));

export const vendorPayments = pgTable('vendor_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  paymentDate: date('payment_date').notNull(),
  amount: decimal('amount', { precision: 18, scale: 4 }).notNull(),
  bankAccountId: uuid('bank_account_id').references(() => bankAccounts.id),
  journalEntryId: uuid('journal_entry_id').references(() => journalEntries.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  companyIdx: index('vendor_payments_company_idx').on(table.companyId),
  vendorIdx: index('vendor_payments_vendor_idx').on(table.vendorId),
}));

export const vendorPaymentApplications = pgTable('vendor_payment_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id').notNull().references(() => vendorPayments.id, { onDelete: 'cascade' }),
  billId: uuid('bill_id').notNull().references(() => bills.id, { onDelete: 'cascade' }),
  appliedAmount: decimal('applied_amount', { precision: 18, scale: 4 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  paymentIdx: index('vendor_payment_applications_payment_idx').on(table.paymentId),
  billIdx: index('vendor_payment_applications_bill_idx').on(table.billId),
}));

// Reconciliation rules
export const reconciliationRules = pgTable('reconciliation_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  matchType: matchTypeType('match_type').notNull(),
  priority: integer('priority').notNull().default(100),
  isActive: boolean('is_active').notNull().default(true),
  conditions: jsonb('conditions').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  companyIdx: index('reconciliation_rules_company_idx').on(table.companyId),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(companyUsers),
  accounts: many(accounts),
  journals: many(journals),
  fiscalYears: many(fiscalYears),
  journalEntries: many(journalEntries),
  customers: many(customers),
  vendors: many(vendors),
  invoices: many(invoices),
  bills: many(bills),
  bankAccounts: many(bankAccounts),
  bankTransactions: many(bankTransactions),
  receipts: many(receipts),
  mileageLogs: many(mileageLogs),
  fixedAssets: many(fixedAssets),
  subscriptions: many(subscriptions),
  creditBalances: many(creditBalances),
  creditTransactions: many(creditTransactions),
  featureFlags: many(featureFlags),
  auditLogs: many(auditLogs),
  customerPayments: many(customerPayments),
  vendorPayments: many(vendorPayments),
}));

export const usersRelations = relations(users, ({ many }) => ({
  companies: many(companyUsers),
  journalEntries: many(journalEntries),
  uploadedReceipts: many(receipts),
  mileageLogs: many(mileageLogs),
}));

export const companyUsersRelations = relations(companyUsers, ({ one }) => ({
  company: one(companies, { fields: [companyUsers.companyId], references: [companies.id] }),
  user: one(users, { fields: [companyUsers.userId], references: [users.id] }),
}));

export const accountTypesRelations = relations(accountTypes, ({ many }) => ({
  accounts: many(accounts),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  company: one(companies, { fields: [accounts.companyId], references: [companies.id] }),
  accountType: one(accountTypes, { fields: [accounts.accountTypeId], references: [accountTypes.id] }),
  parent: one(accounts, { fields: [accounts.parentId], references: [accounts.id] }),
  children: many(accounts),
  journalLines: many(journalLines),
  invoiceLines: many(invoiceLines),
  billLines: many(billLines),
  bankAccounts: many(bankAccounts),
}));

export const journalsRelations = relations(journals, ({ one, many }) => ({
  company: one(companies, { fields: [journals.companyId], references: [companies.id] }),
  journalEntries: many(journalEntries),
}));

export const fiscalYearsRelations = relations(fiscalYears, ({ one, many }) => ({
  company: one(companies, { fields: [fiscalYears.companyId], references: [companies.id] }),
  periods: many(accountingPeriods),
}));

export const accountingPeriodsRelations = relations(accountingPeriods, ({ one, many }) => ({
  fiscalYear: one(fiscalYears, { fields: [accountingPeriods.fiscalYearId], references: [fiscalYears.id] }),
  journalEntries: many(journalEntries),
}));

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  company: one(companies, { fields: [journalEntries.companyId], references: [companies.id] }),
  journal: one(journals, { fields: [journalEntries.journalId], references: [journals.id] }),
  accountingPeriod: one(accountingPeriods, { fields: [journalEntries.accountingPeriodId], references: [accountingPeriods.id] }),
  createdByUser: one(users, { fields: [journalEntries.createdBy], references: [users.id] }),
  postedByUser: one(users, { fields: [journalEntries.postedBy], references: [users.id] }),
  reversedEntry: one(journalEntries, { fields: [journalEntries.reversedEntryId], references: [journalEntries.id] }),
  lines: many(journalLines),
  invoices: many(invoices),
  bills: many(bills),
  bankTransactions: many(bankTransactions),
  receipts: many(receipts),
  customerPayments: many(customerPayments),
  vendorPayments: many(vendorPayments),
}));

export const journalLinesRelations = relations(journalLines, ({ one }) => ({
  journalEntry: one(journalEntries, { fields: [journalLines.journalEntryId], references: [journalEntries.id] }),
  account: one(accounts, { fields: [journalLines.accountId], references: [accounts.id] }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  company: one(companies, { fields: [customers.companyId], references: [companies.id] }),
  invoices: many(invoices),
  payments: many(customerPayments),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  company: one(companies, { fields: [vendors.companyId], references: [companies.id] }),
  bills: many(bills),
  payments: many(vendorPayments),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  company: one(companies, { fields: [invoices.companyId], references: [companies.id] }),
  customer: one(customers, { fields: [invoices.customerId], references: [customers.id] }),
  journalEntry: one(journalEntries, { fields: [invoices.journalEntryId], references: [journalEntries.id] }),
  lines: many(invoiceLines),
  paymentApplications: many(paymentApplications),
}));

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceLines.invoiceId], references: [invoices.id] }),
  revenueAccount: one(accounts, { fields: [invoiceLines.revenueAccountId], references: [accounts.id] }),
}));

export const billsRelations = relations(bills, ({ one, many }) => ({
  company: one(companies, { fields: [bills.companyId], references: [companies.id] }),
  vendor: one(vendors, { fields: [bills.vendorId], references: [vendors.id] }),
  journalEntry: one(journalEntries, { fields: [bills.journalEntryId], references: [journalEntries.id] }),
  lines: many(billLines),
  vendorPaymentApplications: many(vendorPaymentApplications),
}));

export const billLinesRelations = relations(billLines, ({ one }) => ({
  bill: one(bills, { fields: [billLines.billId], references: [bills.id] }),
  expenseAccount: one(accounts, { fields: [billLines.expenseAccountId], references: [accounts.id] }),
}));

export const bankAccountsRelations = relations(bankAccounts, ({ one, many }) => ({
  company: one(companies, { fields: [bankAccounts.companyId], references: [companies.id] }),
  ledgerAccount: one(accounts, { fields: [bankAccounts.ledgerAccountId], references: [accounts.id] }),
  transactions: many(bankTransactions),
  customerPayments: many(customerPayments),
  vendorPayments: many(vendorPayments),
}));

export const bankTransactionsRelations = relations(bankTransactions, ({ one }) => ({
  company: one(companies, { fields: [bankTransactions.companyId], references: [companies.id] }),
  bankAccount: one(bankAccounts, { fields: [bankTransactions.bankAccountId], references: [bankAccounts.id] }),
  matchedJournalEntry: one(journalEntries, { fields: [bankTransactions.matchedJournalEntryId], references: [journalEntries.id] }),
}));

export const receiptsRelations = relations(receipts, ({ one }) => ({
  company: one(companies, { fields: [receipts.companyId], references: [companies.id] }),
  uploadedByUser: one(users, { fields: [receipts.uploadedBy], references: [users.id] }),
  draftJournalEntry: one(journalEntries, { fields: [receipts.draftJournalEntryId], references: [journalEntries.id] }),
}));

export const mileageLogsRelations = relations(mileageLogs, ({ one }) => ({
  company: one(companies, { fields: [mileageLogs.companyId], references: [companies.id] }),
  user: one(users, { fields: [mileageLogs.userId], references: [users.id] }),
}));

export const fixedAssetsRelations = relations(fixedAssets, ({ one, many }) => ({
  company: one(companies, { fields: [fixedAssets.companyId], references: [companies.id] }),
  assetAccount: one(accounts, { fields: [fixedAssets.assetAccountId], references: [accounts.id] }),
  accumulatedDepreciationAccount: one(accounts, { fields: [fixedAssets.accumulatedDepreciationAccountId], references: [accounts.id] }),
  depreciationSchedules: many(depreciationSchedules),
}));

export const depreciationSchedulesRelations = relations(depreciationSchedules, ({ one }) => ({
  fixedAsset: one(fixedAssets, { fields: [depreciationSchedules.fixedAssetId], references: [fixedAssets.id] }),
  accountingPeriod: one(accountingPeriods, { fields: [depreciationSchedules.accountingPeriodId], references: [accountingPeriods.id] }),
  journalEntry: one(journalEntries, { fields: [depreciationSchedules.journalEntryId], references: [journalEntries.id] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  company: one(companies, { fields: [subscriptions.companyId], references: [companies.id] }),
}));

export const creditBalancesRelations = relations(creditBalances, ({ one }) => ({
  company: one(companies, { fields: [creditBalances.companyId], references: [companies.id] }),
}));

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  company: one(companies, { fields: [creditTransactions.companyId], references: [companies.id] }),
}));

export const featureFlagsRelations = relations(featureFlags, ({ one }) => ({
  company: one(companies, { fields: [featureFlags.companyId], references: [companies.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  company: one(companies, { fields: [auditLogs.companyId], references: [companies.id] }),
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

export const customerPaymentsRelations = relations(customerPayments, ({ one, many }) => ({
  company: one(companies, { fields: [customerPayments.companyId], references: [companies.id] }),
  customer: one(customers, { fields: [customerPayments.customerId], references: [customers.id] }),
  bankAccount: one(bankAccounts, { fields: [customerPayments.bankAccountId], references: [bankAccounts.id] }),
  journalEntry: one(journalEntries, { fields: [customerPayments.journalEntryId], references: [journalEntries.id] }),
  applications: many(paymentApplications),
}));

export const paymentApplicationsRelations = relations(paymentApplications, ({ one }) => ({
  payment: one(customerPayments, { fields: [paymentApplications.paymentId], references: [customerPayments.id] }),
  invoice: one(invoices, { fields: [paymentApplications.invoiceId], references: [invoices.id] }),
}));

export const vendorPaymentsRelations = relations(vendorPayments, ({ one, many }) => ({
  company: one(companies, { fields: [vendorPayments.companyId], references: [companies.id] }),
  vendor: one(vendors, { fields: [vendorPayments.vendorId], references: [vendors.id] }),
  bankAccount: one(bankAccounts, { fields: [vendorPayments.bankAccountId], references: [bankAccounts.id] }),
  journalEntry: one(journalEntries, { fields: [vendorPayments.journalEntryId], references: [journalEntries.id] }),
  applications: many(vendorPaymentApplications),
}));

export const vendorPaymentApplicationsRelations = relations(vendorPaymentApplications, ({ one }) => ({
  payment: one(vendorPayments, { fields: [vendorPaymentApplications.paymentId], references: [vendorPayments.id] }),
  bill: one(bills, { fields: [vendorPaymentApplications.billId], references: [bills.id] }),
}));

export const reconciliationRulesRelations = relations(reconciliationRules, ({ one }) => ({
  company: one(companies, { fields: [reconciliationRules.companyId], references: [companies.id] }),
}));

export const schema = {
  companies,
  users,
  companyUsers,
  accountTypes,
  accounts,
  journals,
  fiscalYears,
  accountingPeriods,
  journalEntries,
  journalLines,
  customers,
  vendors,
  invoices,
  invoiceLines,
  bills,
  billLines,
  bankAccounts,
  bankTransactions,
  receipts,
  taxCategories,
  mileageLogs,
  fixedAssets,
  depreciationSchedules,
  subscriptions,
  creditBalances,
  creditTransactions,
  featureFlags,
  auditLogs,
  customerPayments,
  paymentApplications,
  vendorPayments,
  vendorPaymentApplications,
  reconciliationRules,
};