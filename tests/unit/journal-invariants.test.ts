import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '@/server/db';
import { schema } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

// Property-based tests for ledger invariants
// Note: In a real implementation, we'd use a library like fast-check,
// but for demo purposes we'll focus on core invariants

let db: ReturnType<typeof getDb>;
let companyId: string;
let userId: string;
let journalId: string;
let periodId: string;
let accountId: string;

beforeEach(async () => {
  db = getDb();
  
  // Create test company and user
  const [company] = await db.insert(schema.companies).values({
    name: 'Test Company',
    taxIdentifier: 'TAX123',
  }).returning();
  
  companyId = company.id;
  
  const [user] = await db.insert(schema.users).values({
    email: 'test@example.com',
    name: 'Test User',
  }).returning();
  
  userId = user.id;
  
  // Create user-company relation
  await db.insert(schema.companyUsers).values({
    company_id: companyId,
    user_id: userId,
    role: 'owner',
  });
  
  // Set RLS context (we'll need to mock this)
  await db.execute(`SET LOCAL app.current_company_id = '${companyId}'`);
  await db.execute(`SET LOCAL app.current_user_id = '${userId}'`);
  
  // Create a fiscal year and period
  const [fiscalYear] = await db.insert(schema.fiscalYears).values({
    company_id: companyId,
    start_date: new Date('2024-01-01'),
    end_date: new Date('2024-12-31'),
    is_closed: false,
  }).returning();
  
  const [period] = await db.insert(schema.accountingPeriods).values({
    fiscal_year_id: fiscalYear.id,
    start_date: new Date('2024-01-01'),
    end_date: new Date('2024-12-31'),
    is_closed: false,
  }).returning();
  
  periodId = period.id;
  
  // Create account types
  const [assetType] = await db.insert(schema.accountTypes).values({
    class: 'asset',
    name: 'Asset',
    normal_balance: 'debit',
  });
  
  const [equityType] = await db.insert(schema.accountTypes).values({
    class: 'equity',
    name: 'Equity',
    normal_balance: 'credit',
  });
  
  // Create test accounts
  const [assetAccount] = await db.insert(schema.accounts).values({
    company_id: companyId,
    account_type_id: assetType.id,
    code: '1000',
    name: 'Cash',
    is_active: true,
  });
  
  accountId = assetAccount.id;
  
  // Create journal
  const [journal] = await db.insert(schema.journals).values({
    company_id: companyId,
    code: 'JE',
    name: 'Journal Entries',
  });
  
  journalId = journal.id;
});

describe('Journal Entry Invariants', () => {
  it('should reject unbalanced journal entries', async () => {
    // Try to post an unbalanced entry (more debits than credits)
    const [entry] = await db.insert(schema.journalEntries).values({
      journal_id: journalId,
      accounting_period_id: periodId,
      entry_date: new Date(),
      posting_date: new Date(),
      reference_number: 'TEST001',
      description: 'Test unbalanced entry',
      is_posted: false,
      created_by: userId,
    }).returning();
    
    const [line1] = await db.insert(schema.journalLines).values({
      journal_entry_id: entry.id,
      account_id: accountId,
      debit: 100.00,
      credit: null,
    }).returning();
    
    const [line2] = await db.insert(schema.journalLines).values({
      journal_entry_id: entry.id,
      account_id: accountId,
      debit: null,
      credit: 50.00, // Only $50 credit, $50 debit imbalance
    }).returning();
    
    // Attempt to post should fail
    try {
      await db.update(schema.journalEntries)
        .set({ is_posted: true })
        .where(eq(schema.journalEntries.id, entry.id));
      
      expect.fail('Should have thrown exception for unbalanced entry');
    } catch (error) {
      expect(error.message).toContain('must be balanced');
    }
  });
  
  it('should reject journal entries with single line', async () => {
    const [entry] = await db.insert(schema.journalEntries).values({
      journal_id: journalId,
      accounting_period_id: periodId,
      entry_date: new Date(),
      posting_date: new Date(),
      reference_number: 'TEST002',
      description: 'Test single line entry',
      is_posted: false,
      created_by: userId,
    }).returning();
    
    await db.insert(schema.journalLines).values({
      journal_entry_id: entry.id,
      account_id: accountId,
      debit: 100.00,
      credit: null,
    });
    
    // Attempt to post should fail
    try {
      await db.update(schema.journalEntries)
        .set({ is_posted: true })
        .where(eq(schema.journalEntries.id, entry.id));
      
      expect.fail('Should have thrown exception for single-line entry');
    } catch (error) {
      expect(error.message).toContain('at least 2 lines');
    }
  });
  
  it('should allow posting of balanced multi-line entries', async () => {
    const [entry] = await db.insert(schema.journalEntries).values({
      journal_id: journalId,
      accounting_period_id: periodId,
      entry_date: new Date(),
      posting_date: new Date(),
      reference_number: 'TEST003',
      description: 'Test balanced entry',
      is_posted: false,
      created_by: userId,
    }).returning();
    
    // Create two lines: debit $100, credit $100
    await db.insert(schema.journalLines).values([
      {
        journal_entry_id: entry.id,
        account_id: accountId,
        debit: 100.00,
        credit: null,
      },
      {
        journal_entry_id: entry.id,
        account_id: accountId,
        debit: null,
        credit: 100.00,
      },
    ]);
    
    // Posting should succeed
    const [updatedEntry] = await db.update(schema.journalEntries)
      .set({ is_posted: true })
      .where(eq(schema.journalEntries.id, entry.id))
      .returning();
    
    expect(updatedEntry.is_posted).toBe(true);
  });
  
  it('should reject updates to posted journal entries', async () => {
    // First create and post a balanced entry
    const [entry] = await db.insert(schema.journalEntries).values({
      journal_id: journalId,
      accounting_period_id: periodId,
      entry_date: new Date(),
      posting_date: new Date(),
      reference_number: 'TEST004',
      description: 'Test posted entry',
      is_posted: false,
      created_by: userId,
    }).returning();
    
    await db.insert(schema.journalLines).values([
      {
        journal_entry_id: entry.id,
        account_id: accountId,
        debit: 100.00,
        credit: null,
      },
      {
        journal_entry_id: entry.id,
        account_id: accountId,
        debit: null,
        credit: 100.00,
      },
    ]);
    
    // Post the entry
    await db.update(schema.journalEntries)
      .set({ is_posted: true })
      .where(eq(schema.journalEntries.id, entry.id));
    
    // Attempt to update should fail
    try {
      await db.update(schema.journalEntries)
        .set({ description: 'Updated description' })
        .where(eq(schema.journalEntries.id, entry.id));
      
      expect.fail('Should have thrown exception for updating posted entry');
    } catch (error) {
      expect(error.message).toContain('Cannot update or delete a posted journal entry');
    }
  });
  
  it('should reject operations on closed accounting periods', async () => {
    // Create a closed accounting period
    const [closedPeriod] = await db.insert(schema.accountingPeriods).values({
      fiscal_year_id: periodId, // Use same fiscal year as reference
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-12-31'),
      is_closed: true,
    }).returning();
    
    const [entry] = await db.insert(schema.journalEntries).values({
      journal_id: journalId,
      accounting_period_id: closedPeriod.id,
      entry_date: new Date(),
      posting_date: new Date(),
      reference_number: 'TEST005',
      description: 'Test closed period entry',
      is_posted: false,
      created_by: userId,
    }).returning();
    
    // Attempt to post to closed period should fail
    try {
      await db.update(schema.journalEntries)
        .set({ is_posted: true })
        .where(eq(schema.journalEntries.id, entry.id));
      
      expect.fail('Should have thrown exception for posting to closed period');
    } catch (error) {
      expect(error.message).toContain('closed accounting period');
    }
  });
});
