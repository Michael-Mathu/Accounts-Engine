import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should display sign in page', async ({ page }) => {
    await page.goto('/signin');
    await expect(page).toHaveTitle(/Accounting Engine/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('should display sign up page', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: /sign up/i })).toBeVisible();
  });
});

test.describe('Dashboard Navigation', () => {
  test('should navigate to different pages', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    
    const navLinks = [
      ['chart-of-accounts', 'Chart of Accounts'],
      ['journal-entries', 'Journal Entries'],
      ['reports', 'Reports'],
      ['customers', 'Customers'],
      ['vendors', 'Vendors'],
      ['invoices', 'Invoices'],
      ['bills', 'Bills'],
      ['payments', 'Payments'],
      ['banking', 'Banking'],
      ['receipts', 'Receipts'],
      ['tax', 'Tax'],
    ];
    
    for (const [href, name] of navLinks) {
      await page.goto(`/dashboard/${href}`);
      await expect(page.getByRole('heading', { name, exact: false })).toBeVisible();
    }
  });
});

test.describe('Reports', () => {
  test('should display profit and loss report', async ({ page }) => {
    await page.goto('/dashboard/reports');
    await expect(page.getByRole('heading', { name: /profit & loss/i })).toBeVisible();
  });

  test('should switch between report types', async ({ page }) => {
    await page.goto('/dashboard/reports');
    await page.getByRole('button', { name: /trial balance/i }).click();
    await expect(page.getByRole('heading', { name: /trial balance/i })).toBeVisible();
  });
});

test.describe('Journal Entries', () => {
  test('should display journal entries page', async ({ page }) => {
    await page.goto('/dashboard/journal-entries');
    await expect(page.getByRole('heading', { name: /journal entries/i })).toBeVisible();
  });

  test('should navigate to create entry page', async ({ page }) => {
    await page.goto('/dashboard/journal-entries');
    await page.getByRole('link', { name: /new entry/i }).click();
    await expect(page).toHaveURL(/journal-entries\/new/);
  });
});