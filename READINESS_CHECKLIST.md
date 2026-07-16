# Accounting Engine - Readiness Checklist

## ✅ Completed Features

### Infrastructure
- [x] Next.js 16 with Turbopack
- [x] TypeScript strict mode
- [x] Tailwind CSS v4
- [x] tRPC v11 with React Query
- [x] Drizzle ORM with PostgreSQL
- [x] Auth.js v5 (NextAuth) with credentials provider
- [x] Proxy middleware for auth gating (`src/proxy.ts`)
- [x] Inngest background jobs setup (`src/server/jobs/index.ts`)
- [x] Sentry error tracking integration (`src/instrumentation.ts`)
- [x] Mobile-responsive navigation (`src/components/layout/dashboard-layout.tsx`)

### Core Accounting
- [x] Chart of Accounts (CRUD)
- [x] Journal Entries (CRUD + posting invariants)
- [x] Invoices (CRUD + payment application)
- [x] Bills (CRUD + approval workflow)
- [x] Customers/Vendors (CRUD)
- [x] Payments (customer/vendor payment application)
- [x] Bank Accounts & Transactions (CRUD)
- [x] Receipts (upload + OCR workflow)
- [x] Fixed Assets (CRUD + depreciation)
- [x] Tax (Schedule C mapping, mileage logs)
- [x] Reports (P&L, Balance Sheet, Trial Balance)

### UI/UX
- [x] Loading skeletons
- [x] Toast notifications
- [x] Empty states
- [x] Keyboard shortcuts hook
- [x] Auth pages connected to tRPC (`/(auth)/signin`, `/(auth)/signup`)

## ⚠️ Remaining Tasks

### Authentication & Security
- [x] Add password reset functionality
- [ ] Add email verification flow
- [ ] Add rate limiting to auth endpoints
- [ ] Add CSRF protection

### Error Handling
- [x] Add global error boundary component
- [x] Add tRPC error formatters
- [ ] Add API error responses with proper codes
- [ ] Add form validation error display

### Database
- [ ] Ensure migrations run in test environment
- [ ] Add database seeding for test data
- [ ] Add RLS trigger verification tests
- [ ] Add audit log trigger verification tests
- [ ] Add period locking verification tests

### Testing
- [ ] Add unit tests for UI components
- [ ] Add unit tests for utils
- [ ] Add integration tests for auth flow
- [ ] Add integration tests for CRUD operations
- [ ] Add property tests for journal invariants
- [ ] Mock external services (Anthropic, Plaid, Stripe)

### Background Jobs
- [ ] Connect receipt OCR job to actual tRPC mutation
- [ ] Add webhook handlers for Plaid/Stripe

### Configuration
- [x] Add `.env.example` file
- [ ] Add `NEXTAUTH_SECRET` to required env vars
- [ ] Add `AUTH_SECRET` to required env vars (check auth config)
- [ ] Add `SENTRY_DSN` configuration documentation

### UI Components Missing
- [x] Modal dialogs for confirmations
- [x] Form error display components
- [ ] Loading spinners (only skeletons)
- [ ] Company switcher dropdown

### Routing
- [x] Auth routes aligned (`/signin`, `/signup`)
- [x] Landing page with marketing content

### Performance
- [ ] Add bundle analyzer
- [ ] Add image optimization
- [ ] Add lazy loading for heavy components

### Documentation
- [ ] API endpoint documentation
- [ ] Database schema documentation
- [ ] Deployment guide needs more detail
- [ ] Environment variable documentation