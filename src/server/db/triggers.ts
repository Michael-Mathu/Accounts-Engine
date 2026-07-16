import { sql } from 'drizzle-orm';

export const triggers = [
  sql`
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
  `,

  sql`
    DROP TRIGGER IF EXISTS trigger_balanced_posting ON journal_entries;
    CREATE TRIGGER trigger_balanced_posting
    BEFORE UPDATE OF is_posted ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION check_balanced_posting();
  `,

  sql`
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
  `,

  sql`
    DROP TRIGGER IF EXISTS trigger_immutability_entries ON journal_entries;
    CREATE TRIGGER trigger_immutability_entries
    BEFORE UPDATE OR DELETE ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION enforce_immutability();
  `,

  sql`
    DROP TRIGGER IF EXISTS trigger_immutability_lines ON journal_lines;
    CREATE TRIGGER trigger_immutability_lines
    BEFORE UPDATE OR DELETE ON journal_lines
    FOR EACH ROW
    EXECUTE FUNCTION enforce_immutability();
  `,

  sql`
    CREATE OR REPLACE FUNCTION check_period_lock()
    RETURNS TRIGGER AS $$
    DECLARE
      period_closed BOOLEAN;
    BEGIN
      IF TG_OP IN ('INSERT', 'UPDATE', 'DELETE') THEN
        IF TG_TABLE_NAME = 'journal_lines' THEN
          SELECT ap.is_closed INTO period_closed
          FROM journal_entries je
          JOIN accounting_periods ap ON je.accounting_period_id = ap.id
          WHERE je.id = NEW.journal_entry_id;
        ELSE
          SELECT ap.is_closed INTO period_closed
          FROM journal_entries je
          JOIN accounting_periods ap ON je.accounting_period_id = ap.id
          WHERE je.id = NEW.id;
        END IF;
        
        IF period_closed THEN
          RAISE EXCEPTION 'Cannot modify journal entries in a closed accounting period';
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `,

  sql`
    DROP TRIGGER IF EXISTS trigger_period_lock_entries ON journal_entries;
    CREATE TRIGGER trigger_period_lock_entries
    BEFORE INSERT OR UPDATE OR DELETE ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION check_period_lock();
  `,

  sql`
    DROP TRIGGER IF EXISTS trigger_period_lock_lines ON journal_lines;
    CREATE TRIGGER trigger_period_lock_lines
    BEFORE INSERT OR UPDATE OR DELETE ON journal_lines
    FOR EACH ROW
    EXECUTE FUNCTION check_period_lock();
  `,

  sql`
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
      v_company_id := current_setting('app.current_company_id', true)::UUID;
      v_user_id := current_setting('app.current_user_id', true)::UUID;
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
        INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, before_data, after_data)
        VALUES (v_company_id, v_user_id, v_action, v_entity_type, v_entity_id, v_before, v_after);
      END IF;
      
      RETURN COALESCE(NEW, OLD);
    END;
    $$ LANGUAGE plpgsql;
  `,

  sql`
    DROP TRIGGER IF EXISTS trigger_audit_journal_entries ON journal_entries;
    CREATE TRIGGER trigger_audit_journal_entries
    AFTER INSERT OR UPDATE OR DELETE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
  `,

  sql`
    DROP TRIGGER IF EXISTS trigger_audit_journal_lines ON journal_lines;
    CREATE TRIGGER trigger_audit_journal_lines
    AFTER INSERT OR UPDATE OR DELETE ON journal_lines
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
  `,

  sql`
    DROP TRIGGER IF EXISTS trigger_audit_invoices ON invoices;
    CREATE TRIGGER trigger_audit_invoices
    AFTER INSERT OR UPDATE OR DELETE ON invoices
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
  `,

  sql`
    DROP TRIGGER IF EXISTS trigger_audit_bills ON bills;
    CREATE TRIGGER trigger_audit_bills
    AFTER INSERT OR UPDATE OR DELETE ON bills
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
  `,

  sql`
    DROP TRIGGER IF EXISTS trigger_audit_customer_payments ON customer_payments;
    CREATE TRIGGER trigger_audit_customer_payments
    AFTER INSERT OR UPDATE OR DELETE ON customer_payments
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
  `,

  sql`
    DROP TRIGGER IF EXISTS trigger_audit_vendor_payments ON vendor_payments;
    CREATE TRIGGER trigger_audit_vendor_payments
    AFTER INSERT OR UPDATE OR DELETE ON vendor_payments
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
  `,

  sql`
    DROP TRIGGER IF EXISTS trigger_audit_bank_transactions ON bank_transactions;
    CREATE TRIGGER trigger_audit_bank_transactions
    AFTER INSERT OR UPDATE OR DELETE ON bank_transactions
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
  `,

  sql`
    DROP TRIGGER IF EXISTS trigger_audit_accounting_periods ON accounting_periods;
    CREATE TRIGGER trigger_audit_accounting_periods
    AFTER INSERT OR UPDATE OR DELETE ON accounting_periods
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
  `,

  sql`
    DROP TRIGGER IF EXISTS trigger_audit_fiscal_years ON fiscal_years;
    CREATE TRIGGER trigger_audit_fiscal_years
    AFTER INSERT OR UPDATE OR DELETE ON fiscal_years
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
  `,

  sql`
    DROP TRIGGER IF EXISTS trigger_audit_accounts ON accounts;
    CREATE TRIGGER trigger_audit_accounts
    AFTER INSERT OR UPDATE OR DELETE ON accounts
    FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
  `,
];