import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '@/server/db';
import { schema } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

let db: ReturnType<typeof getDb>;
let companyId: string;
let userId: string;
let journalId: string;
let periodId: string;
let accountId: string;
let fiscalYearId: string;

beforeEach(async () => {
  db = getDb();
  
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
  
  await db.insert(schema.companyUsers).values({
    companyId: companyId,
    userId: userId,
    role: 'owner',
  });
  
  await db.execute(`SET LOCAL app.current_company_id = '${companyId}'`);
  await db.execute(`SET LOCAL app.current_user_id = '${userId}'`);
  
  const [fiscalYear] = await db.insert(schema.fiscalYears).values({
    companyId: companyId,
    name: '2024',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    isClosed: false,
  }).returning();
  
  fiscalYearId = fiscalYear.id;
  
  const [period] = await db.insert(schema.accountingPeriods).values({
    fiscalYearId: fiscalYear.id,
    companyId: companyId,
    name: '2024-01',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    isClosed: false,
  }).returning();
  
  periodId = period.id;
  
  const [assetType] = await db.insert(schema.accountTypes).values({
    class: 'asset',
    name: 'Asset',
    normalBalance: 'debit',
  }).returning();
  
  const [equityType] = await db.insert(schema.accountTypes).values({
    class: 'equity',
    name: 'Equity',
    normalBalance: 'credit',
  }).returning();
  
  const [assetAccount] = await db.insert(schema.accounts).values({
    companyId: companyId,
    accountTypeId: assetType.id,
    code: '1000',
    name: 'Cash',
    isActive: true,
  }).returning();
  
  accountId = assetAccount.id;
  
  const [journal] = await db.insert(schema.journals).values({
    companyId: companyId,
    code: 'JE',
    name: 'Journal Entries',
  }).returning();
  
  journalId = journal.id;
});

describe('Journal Entry Invariants', () => {
  it('should reject unbalanced journal entries', async () => {
    const [entry] = await db.insert(schema.journalEntries).values({
      companyId: companyId,
      journalId: journalId,
      accountingPeriodId: periodId,
      entryDate: '2024-01-15',
      postingDate: '2024-01-15',
      referenceNumber: 'TEST001',
      description: 'Test unbalanced entry',
      isPosted: false,
      createdBy: userId,
    }).returning();
    
    await db.insert(schema.journalLines).values({
      journalEntryId: entry.id,
      accountId: accountId,
      debit: '100.0000',
      credit: '0',
    });
    
    await db.insert(schema.journalLines).values({
      journalEntryId: entry.id,
      accountId: accountId,
      debit: '0',
      credit: '50.0000',
    });
    
    try {
      await db.update(schema.journalEntries)
        .set({ isPosted: true })
        .where(eq(schema.journalEntries.id, entry.id));
      
      expect.fail('Should have thrown exception for unbalanced entry');
    } catch (error: unknown) {
      expect((error as Error).message).toContain('must be balanced');
    }
  });
  
  it('should reject journal entries with single line', async () => {
    const [entry] = await db.insert(schema.journalEntries).values({
      companyId: companyId,
      journalId: journalId,
      accountingPeriodId: periodId,
      entryDate: '2024-01-15',
      postingDate: '2024-01-15',
      referenceNumber: 'TEST002',
      description: 'Test single line entry',
      isPosted: false,
      createdBy: userId,
    }).returning();
    
    await db.insert(schema.journalLines).values({
      journalEntryId: entry.id,
      accountId: accountId,
      debit: '100.0000',
      credit: '0',
    });
    
    try {
      await db.update(schema.journalEntries)
        .set({ isPosted: true })
        .where(eq(schema.journalEntries.id, entry.id));
      
      expect.fail('Should have thrown exception for single-line entry');
    } catch (error: unknown) {
      expect((error as Error).message).toContain('at least 2 lines');
    }
  });
  
  it('should allow posting of balanced multi-line entries', async () => {
    const [entry] = await db.insert(schema.journalEntries).values({
      companyId: companyId,
      journalId: journalId,
      accountingPeriodId: periodId,
      entryDate: '2024-01-15',
      postingDate: '2024-01-15',
      referenceNumber: 'TEST003',
      description: 'Test balanced entry',
      isPosted: false,
      createdBy: userId,
    }).returning();
    
    await db.insert(schema.journalLines).values([
      {
        journalEntryId: entry.id,
        accountId: accountId,
        debit: '100.0000',
        credit: '0',
      },
      {
        journalEntryId: entry.id,
        accountId: accountId,
        debit: '0',
        credit: '100.0000',
      },
    ]);
    
    const [updatedEntry] = await db.update(schema.journalEntries)
      .set({ isPosted: true })
      .where(eq(schema.journalEntries.id, entry.id))
      .returning();
    
    expect(updatedEntry.isPosted).toBe(true);
  });
  
  it('should reject updates to posted journal entries', async () => {
    const [entry] = await db.insert(schema.journalEntries).values({
      companyId: companyId,
      journalId: journalId,
      accountingPeriodId: periodId,
      entryDate: '2024-01-15',
      postingDate: '2024-01-15',
      referenceNumber: 'TEST004',
      description: 'Test posted entry',
      isPosted: false,
      createdBy: userId,
    }).returning();
    
    await db.insert(schema.journalLines).values([
      {
        journalEntryId: entry.id,
        accountId: accountId,
        debit: '100.0000',
        credit: '0',
      },
      {
        journalEntryId: entry.id,
        accountId: accountId,
        debit: '0',
        credit: '100.0000',
      },
    ]);
    
    await db.update(schema.journalEntries)
      .set({ isPosted: true })
      .where(eq(schema.journalEntries.id, entry.id));
    
    try {
      await db.update(schema.journalEntries)
        .set({ description: 'Updated description' })
        .where(eq(schema.journalEntries.id, entry.id));
      
      expect.fail('Should have thrown exception for updating posted entry');
    } catch (error: unknown) {
      expect((error as Error).message).toContain('Cannot update or delete a posted journal entry');
    }
  });
  
  it('should reject operations on closed accounting periods', async () => {
    const [closedPeriod] = await db.insert(schema.accountingPeriods).values({
      fiscalYearId: fiscalYearId,
      companyId: companyId,
      name: '2024-01-closed',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      isClosed: true,
    }).returning();
    
    const [entry] = await db.insert(schema.journalEntries).values({
      companyId: companyId,
      journalId: journalId,
      accountingPeriodId: closedPeriod.id,
      entryDate: '2024-01-15',
      postingDate: '2024-01-15',
      referenceNumber: 'TEST005',
      description: 'Test closed period entry',
      isPosted: false,
      createdBy: userId,
    }).returning();
    
    try {
      await db.update(schema.journalEntries)
        .set({ isPosted: true })
        .where(eq(schema.journalEntries.id, entry.id));
      
      expect.fail('Should have thrown exception for posting to closed period');
    } catch (error: unknown) {
      expect((error as Error).message).toContain('closed accounting period');
    }
  });
});