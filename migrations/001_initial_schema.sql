-- Migration: Initial schema for Accounting Engine
-- Run with: psql -d accounting_engine -f migrations/001_initial_schema.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE account_class_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
CREATE TYPE normal_balance_type AS ENUM ('debit', 'credit');
CREATE TYPE invoice_status_type AS ENUM ('draft', 'sent', 'partial', 'paid', 'void');
CREATE TYPE bill_status_type AS ENUM ('draft', 'approved', 'partial', 'paid', 'void');
CREATE TYPE bank_transaction_status_type AS ENUM ('unmatched', 'matched', 'excluded');
CREATE TYPE match_type_type AS ENUM ('exact', 'split', 'tolerance', 'rule');
CREATE TYPE receipt_status_type AS ENUM ('pending', 'processing', 'processed', 'failed', 'approved', 'rejected');
CREATE TYPE subscription_status_type AS ENUM ('active', 'canceled', 'past_due', 'incomplete', 'expired');
CREATE TYPE subscription_plan_type AS ENUM ('self_hosted', 'monthly', 'quarterly', 'annual');
CREATE TYPE credit_reason_type AS ENUM ('receipt_ocr', 'bank_sync', 'ai_report', 'ledger_export', 'purchase');
CREATE TYPE depreciation_method_type AS ENUM ('straight_line', 'declining_balance', 'sum_of_years_digits');

-- Core tables
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    tax_identifier VARCHAR(100),
    base_currency CHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    password_hash VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE company_users (
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL DEFAULT 'owner',
    PRIMARY KEY (company_id, user_id)
);

-- Account types (system-defined)
CREATE TABLE account_types (
    id SERIAL PRIMARY KEY,
    class account_class_type NOT NULL,
    name VARCHAR(100) NOT NULL,
    normal_balance normal_balance_type NOT NULL
);

-- Chart of accounts
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    account_type_id INT NOT NULL REFERENCES account_types(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    schedule_c_line_id VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uniq_company_account_code UNIQUE (company_id, code)
);

CREATE INDEX idx_accounts_company ON accounts(company_id);
CREATE INDEX idx_accounts_parent ON accounts(parent_id);
CREATE INDEX idx_accounts_type ON accounts(account_type_id);

-- Fiscal years and periods
CREATE TABLE fiscal_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT check_fiscal_dates CHECK (start_date < end_date)
);

CREATE TABLE accounting_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT check_period_dates CHECK (start_date < end_date)
);

CREATE INDEX idx_periods_fiscal_year ON accounting_periods(fiscal_year_id);
CREATE INDEX idx_periods_dates ON accounting_periods(start_date, end_date);

-- Journals
CREATE TABLE journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(10) NOT NULL,
    name VARCHAR(100) NOT NULL,
    CONSTRAINT uniq_company_journal_code UNIQUE (company_id, code)
);

-- Journal entries and lines
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id UUID NOT NULL REFERENCES journals(id),
    accounting_period_id UUID NOT NULL REFERENCES accounting_periods(id),
    entry_date DATE NOT NULL,
    posting_date DATE NOT NULL,
    reference_number VARCHAR(100),
    description TEXT,
    is_posted BOOLEAN NOT NULL DEFAULT FALSE,
    reversed_entry_id UUID REFERENCES journal_entries(id),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    description TEXT,
    debit DECIMAL(15, 4) NOT NULL DEFAULT 0.0000 CHECK (debit >= 0),
    credit DECIMAL(15, 4) NOT NULL DEFAULT 0.0000 CHECK (credit >= 0),
    signed_amount DECIMAL(15, 4) GENERATED ALWAYS AS (debit - credit) STORED,
    CONSTRAINT check_line_has_values CHECK (debit > 0 OR credit > 0),
    CONSTRAINT check_line_cannot_overlap CHECK (NOT (debit > 0 AND credit > 0))
);

CREATE INDEX idx_lines_account ON journal_lines(account_id);
CREATE INDEX idx_lines_entry ON journal_lines(journal_entry_id);
CREATE INDEX idx_entries_period ON journal_entries(accounting_period_id);
CREATE INDEX idx_entries_posting_date ON journal_entries(posting_date);
CREATE INDEX idx_entries_posted ON journal_entries(is_posted);

-- AR/AP tables
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    payment_terms_days INT NOT NULL DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    invoice_number VARCHAR(50) NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status invoice_status_type NOT NULL DEFAULT 'draft',
    subtotal DECIMAL(15,4) NOT NULL,
    tax_total DECIMAL(15,4) NOT NULL DEFAULT 0,
    total DECIMAL(15,4) NOT NULL,
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uniq_company_invoice_number UNIQUE (company_id, invoice_number)
);

CREATE TABLE invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(15,4) NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,4) NOT NULL,
    revenue_account_id UUID NOT NULL REFERENCES accounts(id),
    amount DECIMAL(15,4) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE TABLE bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    bill_number VARCHAR(50) NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status bill_status_type NOT NULL DEFAULT 'draft',
    subtotal DECIMAL(15,4) NOT NULL,
    tax_total DECIMAL(15,4) NOT NULL DEFAULT 0,
    total DECIMAL(15,4) NOT NULL,
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uniq_company_bill_number UNIQUE (company_id, bill_number)
);

CREATE TABLE bill_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(15,4) NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,4) NOT NULL,
    expense_account_id UUID NOT NULL REFERENCES accounts(id),
    amount DECIMAL(15,4) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE TABLE customer_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    payment_date DATE NOT NULL,
    amount DECIMAL(15,4) NOT NULL CHECK (amount > 0),
    bank_account_id UUID REFERENCES bank_accounts(id),
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vendor_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    payment_date DATE NOT NULL,
    amount DECIMAL(15,4) NOT NULL CHECK (amount > 0),
    bank_account_id UUID REFERENCES bank_accounts(id),
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payment_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES customer_payments(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    applied_amount DECIMAL(15,4) NOT NULL CHECK (applied_amount > 0)
);

CREATE TABLE vendor_payment_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES vendor_payments(id) ON DELETE CASCADE,
    bill_id UUID NOT NULL REFERENCES bills(id),
    applied_amount DECIMAL(15,4) NOT NULL CHECK (applied_amount > 0)
);

-- Banking
CREATE TABLE bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    ledger_account_id UUID NOT NULL REFERENCES accounts(id),
    plaid_item_id VARCHAR(255),
    plaid_access_token_encrypted TEXT,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    external_transaction_id VARCHAR(255),
    posted_date DATE NOT NULL,
    amount DECIMAL(15,4) NOT NULL,
    description TEXT,
    raw_payload JSONB,
    status bank_transaction_status_type NOT NULL DEFAULT 'unmatched',
    matched_journal_entry_id UUID REFERENCES journal_entries(id),
    match_type match_type_type,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reconciliation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    match_pattern VARCHAR(255) NOT NULL,
    target_account_id UUID NOT NULL REFERENCES accounts(id),
    priority INT NOT NULL DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Receipts
CREATE TABLE receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    file_url TEXT NOT NULL,
    status receipt_status_type NOT NULL DEFAULT 'pending',
    extracted_data JSONB,
    draft_journal_entry_id UUID REFERENCES journal_entries(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tax
CREATE TABLE tax_categories (
    id VARCHAR(10) PRIMARY KEY,
    part INT NOT NULL,
    line_number VARCHAR(10) NOT NULL,
    label VARCHAR(255) NOT NULL,
    deductibility_limit DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    is_standard BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE mileage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    log_date DATE NOT NULL,
    start_location VARCHAR(255),
    end_location VARCHAR(255),
    business_purpose TEXT NOT NULL,
    miles DECIMAL(10,2) NOT NULL CHECK (miles > 0),
    rate_used DECIMAL(6,4) NOT NULL,
    deductible_amount DECIMAL(15,4) GENERATED ALWAYS AS (miles * rate_used) STORED
);

CREATE TABLE fixed_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    purchase_date DATE NOT NULL,
    cost DECIMAL(15,4) NOT NULL CHECK (cost > 0),
    salvage_value DECIMAL(15,4) NOT NULL DEFAULT 0,
    useful_life_years INT NOT NULL CHECK (useful_life_years > 0),
    method depreciation_method_type NOT NULL DEFAULT 'straight_line',
    asset_account_id UUID NOT NULL REFERENCES accounts(id),
    accumulated_depreciation_account_id UUID NOT NULL REFERENCES accounts(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE depreciation_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fixed_asset_id UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
    accounting_period_id UUID NOT NULL REFERENCES accounting_periods(id),
    amount DECIMAL(15,4) NOT NULL,
    is_posted BOOLEAN NOT NULL DEFAULT FALSE,
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Billing/Monetization
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    plan subscription_plan_type NOT NULL DEFAULT 'self_hosted',
    status subscription_status_type NOT NULL DEFAULT 'active',
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uniq_company_subscription UNIQUE (company_id)
);

CREATE TABLE credit_balances (
    company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    credits_remaining INT NOT NULL DEFAULT 0,
    last_reset_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    amount INT NOT NULL,
    reason credit_reason_type NOT NULL,
    description TEXT,
    stripe_invoice_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE feature_flags (
    company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    plaid_relay_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ai_receipt_extraction_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ai_reports_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    api_access_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    multi_entity_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    before JSONB,
    after JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_company ON audit_log(company_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- Update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feature_flags_updated_at BEFORE UPDATE ON feature_flags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credit_balances_updated_at BEFORE UPDATE ON credit_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security Policies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_payment_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mileage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE depreciation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies (using app.current_company_id setting)
CREATE POLICY company_isolation ON companies
    USING (id = current_setting('app.current_company_id')::uuid);

CREATE POLICY company_users_isolation ON company_users
    USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY accounts_isolation ON accounts
    USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY journal_entries_isolation ON journal_entries
    USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY journal_lines_isolation ON journal_lines
    USING (journal_entry_id IN (
        SELECT id FROM journal_entries WHERE company_id = current_setting('app.current_company_id')::uuid
    ));

-- ... (similar policies for all company-scoped tables)