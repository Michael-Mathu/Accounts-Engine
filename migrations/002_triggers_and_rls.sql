-- Migration: Triggers for ledger invariants and RLS policies
-- Run with: psql -d accounting_engine -f migrations/002_triggers_and_rls.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TRIGGER FUNCTIONS FOR LEDGER INVARIANTS
-- ============================================================

-- 1. Balanced posting: is_posted false->true requires sum(signed_amount)=0 AND count >= 2
CREATE OR REPLACE FUNCTION check_balanced_posting()
RETURNS TRIGGER AS $$
DECLARE
  line_count INTEGER;
  total_signed_amount NUMERIC(18,4);
BEGIN
  IF NEW.is_posted AND NOT OLD.is_posted THEN
    SELECT COUNT(*), COALESCE(SUM(signed_amount), 0)
    INTO line_count, total_signed_amount
    FROM journal_lines
    WHERE journal_entry_id = NEW.id;
    
    IF line_count < 2 THEN
      RAISE EXCEPTION 'Journal entry must have at least 2 lines to be posted';
    END IF;
    
    IF total_signed_amount != 0 THEN
      RAISE EXCEPTION 'Journal entry must be balanced (sum of signed_amount must equal 0)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_balanced_posting ON journal_entries;
CREATE TRIGGER trigger_balanced_posting
BEFORE UPDATE OF is_posted ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION check_balanced_posting();

-- 2. Immutability: Posted entries/lines reject UPDATE/DELETE
CREATE OR REPLACE FUNCTION enforce_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_posted THEN
    IF TG_OP = 'UPDATE' THEN
      RAISE EXCEPTION 'Cannot update a posted journal entry. Use reversal instead.';
    ELSIF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cannot delete a posted journal entry. Use reversal instead.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_immutability_entries ON journal_entries;
CREATE TRIGGER trigger_immutability_entries
BEFORE UPDATE OR DELETE ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION enforce_immutability();

DROP TRIGGER IF EXISTS trigger_immutability_lines ON journal_lines;
CREATE TRIGGER trigger_immutability_lines
BEFORE UPDATE OR DELETE ON journal_lines
FOR EACH ROW
EXECUTE FUNCTION enforce_immutability();

-- 3. Period locking: Writes rejected if parent period is_closed = true
CREATE OR REPLACE FUNCTION check_period_lock()
RETURNS TRIGGER AS $$
DECLARE
  period_closed BOOLEAN;
  target_entry_id UUID;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE', 'DELETE') THEN
    IF TG_TABLE_NAME = 'journal_lines' THEN
      target_entry_id := NEW.journal_entry_id;
    ELSE
      target_entry_id := NEW.id;
    END IF;
    
    SELECT ap.is_closed INTO period_closed
    FROM journal_entries je
    JOIN accounting_periods ap ON je.accounting_period_id = ap.id
    WHERE je.id = target_entry_id;
    
    IF period_closed THEN
      RAISE EXCEPTION 'Cannot modify journal entries in a closed accounting period';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_period_lock_entries ON journal_entries;
CREATE TRIGGER trigger_period_lock_entries
BEFORE INSERT OR UPDATE OR DELETE ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION check_period_lock();

DROP TRIGGER IF EXISTS trigger_period_lock_lines ON journal_lines;
CREATE TRIGGER trigger_period_lock_lines
BEFORE INSERT OR UPDATE OR DELETE ON journal_lines
FOR EACH ROW
EXECUTE FUNCTION check_period_lock();

-- 4. Audit logging on critical mutations
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_action TEXT;
  v_entity_type TEXT;
  v_entity_id UUID;
  v_before JSONB;
  v_after JSONB;
BEGIN
  v_company_id := NULLIF(current_setting('app.current_company_id', true), '')::UUID;
  v_user_id := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
  v_action := TG_OP;
  v_entity_type := TG_TABLE_NAME;
  
  IF TG_OP = 'INSERT' THEN
    v_entity_id := NEW.id;
    v_before := NULL;
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := NEW.id;
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_entity_id := OLD.id;
    v_before := to_jsonb(OLD);
    v_after := NULL;
  END IF;

  IF v_company_id IS NOT NULL AND v_entity_type IN (
    'journal_entries', 'journal_lines', 'invoices', 'bills',
    'customer_payments', 'vendor_payments', 'bank_transactions',
    'accounting_periods', 'fiscal_years', 'accounts'
  ) THEN
    INSERT INTO audit_log (company_id, actor_id, action, entity_type, entity_id, before, after)
    VALUES (v_company_id, v_user_id, v_action, v_entity_type, v_entity_id, v_before, v_after);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_audit_journal_entries ON journal_entries;
CREATE TRIGGER trigger_audit_journal_entries
AFTER INSERT OR UPDATE OR DELETE ON journal_entries
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

DROP TRIGGER IF EXISTS trigger_audit_journal_lines ON journal_lines;
CREATE TRIGGER trigger_audit_journal_lines
AFTER INSERT OR UPDATE OR DELETE ON journal_lines
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

DROP TRIGGER IF EXISTS trigger_audit_invoices ON invoices;
CREATE TRIGGER trigger_audit_invoices
AFTER INSERT OR UPDATE OR DELETE ON invoices
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

DROP TRIGGER IF EXISTS trigger_audit_bills ON bills;
CREATE TRIGGER trigger_audit_bills
AFTER INSERT OR UPDATE OR DELETE ON bills
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

DROP TRIGGER IF EXISTS trigger_audit_customer_payments ON customer_payments;
CREATE TRIGGER trigger_audit_customer_payments
AFTER INSERT OR UPDATE OR DELETE ON customer_payments
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

DROP TRIGGER IF EXISTS trigger_audit_vendor_payments ON vendor_payments;
CREATE TRIGGER trigger_audit_vendor_payments
AFTER INSERT OR UPDATE OR DELETE ON vendor_payments
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

DROP TRIGGER IF EXISTS trigger_audit_bank_transactions ON bank_transactions;
CREATE TRIGGER trigger_audit_bank_transactions
AFTER INSERT OR UPDATE OR DELETE ON bank_transactions
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

DROP TRIGGER IF EXISTS trigger_audit_accounting_periods ON accounting_periods;
CREATE TRIGGER trigger_audit_accounting_periods
AFTER INSERT OR UPDATE OR DELETE ON accounting_periods
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

DROP TRIGGER IF EXISTS trigger_audit_fiscal_years ON fiscal_years;
CREATE TRIGGER trigger_audit_fiscal_years
AFTER INSERT OR UPDATE OR DELETE ON fiscal_years
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

DROP TRIGGER IF EXISTS trigger_audit_accounts ON accounts;
CREATE TRIGGER trigger_audit_accounts
AFTER INSERT OR UPDATE OR DELETE ON accounts
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all company-scoped tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
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

-- RLS Policies using app.current_company_id setting
CREATE POLICY company_isolation ON companies
  USING (id = current_setting('app.current_company_id')::uuid);

CREATE POLICY company_users_isolation ON company_users
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY accounts_isolation ON accounts
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY journals_isolation ON journals
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY fiscal_years_isolation ON fiscal_years
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY accounting_periods_isolation ON accounting_periods
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY journal_entries_isolation ON journal_entries
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY journal_lines_isolation ON journal_lines
  USING (journal_entry_id IN (
    SELECT id FROM journal_entries WHERE company_id = current_setting('app.current_company_id')::uuid
  ));

CREATE POLICY customers_isolation ON customers
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY vendors_isolation ON vendors
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY invoices_isolation ON invoices
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY invoice_lines_isolation ON invoice_lines
  USING (invoice_id IN (
    SELECT id FROM invoices WHERE company_id = current_setting('app.current_company_id')::uuid
  ));

CREATE POLICY bills_isolation ON bills
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY bill_lines_isolation ON bill_lines
  USING (bill_id IN (
    SELECT id FROM bills WHERE company_id = current_setting('app.current_company_id')::uuid
  ));

CREATE POLICY customer_payments_isolation ON customer_payments
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY vendor_payments_isolation ON vendor_payments
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY payment_applications_isolation ON payment_applications
  USING (payment_id IN (
    SELECT id FROM customer_payments WHERE company_id = current_setting('app.current_company_id')::uuid
  ));

CREATE POLICY vendor_payment_applications_isolation ON vendor_payment_applications
  USING (payment_id IN (
    SELECT id FROM vendor_payments WHERE company_id = current_setting('app.current_company_id')::uuid
  ));

CREATE POLICY bank_accounts_isolation ON bank_accounts
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY bank_transactions_isolation ON bank_transactions
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY reconciliation_rules_isolation ON reconciliation_rules
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY receipts_isolation ON receipts
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY mileage_logs_isolation ON mileage_logs
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY fixed_assets_isolation ON fixed_assets
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY depreciation_schedules_isolation ON depreciation_schedules
  USING (accounting_period_id IN (
    SELECT id FROM accounting_periods WHERE company_id = current_setting('app.current_company_id')::uuid
  ));

CREATE POLICY subscriptions_isolation ON subscriptions
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY credit_balances_isolation ON credit_balances
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY credit_transactions_isolation ON credit_transactions
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY feature_flags_isolation ON feature_flags
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY audit_log_isolation ON audit_log
  USING (company_id = current_setting('app.current_company_id')::uuid);

-- ============================================================
-- FUNCTION TO SET RLS CONTEXT
-- ============================================================

CREATE OR REPLACE FUNCTION set_rls_context(p_company_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_company_id', p_company_id::text, false);
  PERFORM set_config('app.current_user_id', p_user_id::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION set_rls_context(UUID, UUID) TO authenticated;