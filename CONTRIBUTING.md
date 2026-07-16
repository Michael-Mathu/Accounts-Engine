# Contributing to Accounting Engine

## Development Setup

```bash
# Clone and install
git clone <repo-url>
cd accounting-engine
npm install

# Create .env file
cp .env.example .env
# Edit with your DATABASE_URL and AUTH_SECRET

# Start PostgreSQL (Docker recommended)
docker compose up -d

# Generate and run migrations
npx drizzle-kit generate
npx drizzle-kit migrate

# Seed demo data
npx tsx scripts/seed.ts

# Start dev server
npm run dev
```

## Phase-Based Development

Follow the phase-based execution protocol:

1. **Phase 1**: Core ledger (schema, triggers, journal entries)
2. **Phase 2**: Invoicing & AR/AP (customers, vendors, invoices, bills)
3. **Phase 3**: Banking & receipts (Plaid, OCR)
4. **Phase 4**: Polish & production readiness
5. **Phase 5**: Quality & operations

Within each phase: schema → triggers/invariants → tRPC → invariant tests → UI → integration tests

## Code Standards

- TypeScript strict mode
- ESLint with flat config
- Drizzle ORM snake_case columns
- React components PascalCase
- Utility functions camelCase
- Use `@/` path alias for imports

## Testing

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# E2E tests
npm run test:e2e

# Type check
npm run typecheck

# Lint
npm run lint
```

## Database Invariants (Never Relax)

1. **Balanced posting**: Σ signed_amount = 0, ≥ 2 lines before posting
2. **Immutability**: Posted entries reject UPDATE/DELETE
3. **Period locking**: Closed periods reject writes
4. **Tenant isolation**: RLS on all company_id tables
5. **Audit trail**: Critical mutations to audit_logs

## Pull Request Process

1. Create feature branch from `develop`
2. Run linter and type checker
3. Ensure all tests pass
4. Update documentation if needed
5. Submit PR to `develop` branch

## Architecture Decisions

Read `.gemini/antigravity/scratch/Accounts-Engine-main/AGENTS.md` for:
- Next.js 16 conventions
- tRPC authorization hierarchy
- Database patterns
- File organization