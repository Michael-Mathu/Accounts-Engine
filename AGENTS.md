<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Accounting Engine — Agent Instructions

## Project Identity

- **Name**: Accounting Engine
- **License**: AGPL-3.0
- **Mission**: Open-source QuickBooks alternative for freelancers/SMEs
- **Stack**: Next.js 16 (App Router), TypeScript strict, tRPC v11, Drizzle ORM/PostgreSQL, Auth.js v5, Tailwind CSS v4, Stripe, Plaid, Anthropic API, Inngest, Vitest v4, Playwright, Sentry

## Critical Next.js 16 Differences

### `proxy.ts` replaces `middleware.ts`
- File: `src/proxy.ts` (NOT `middleware.ts`)
- Export: `export function proxy(request: NextRequest)` (NOT `middleware`)
- See: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`

### `next.config.ts` is TypeScript-native
- Use `next.config.ts` with `import type { NextConfig } from 'next'`
- Do NOT create `next.config.js` or `next.config.mjs`

### Route parameters are Promises
```typescript
// Correct (Next.js 15+ / 16):
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}

// WRONG (old API):
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params
}
```

### `cookies()` and `headers()` are async
```typescript
// Correct:
const cookieStore = await cookies()
const headersList = await headers()

// WRONG:
const cookieStore = cookies()
```

### Auth.js v5 (next-auth v5 beta)
- Export: `export const { handlers, auth, signIn, signOut } = NextAuth(config)`
- Route handler: `export const { GET, POST } = handlers`
- Server session: `const session = await auth()` (NOT `getServerSession`)
- Middleware/Proxy: Use `auth` from `@/lib/auth`
- See: `node_modules/next-auth` for exact API

## Project File Organization

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Route group: auth pages
│   │   ├── signin/page.tsx
│   │   └── signup/page.tsx
│   ├── (dashboard)/        # Route group: protected pages
│   │   ├── dashboard/page.tsx
│   │   └── [feature]/page.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts  # Auth.js handler
│   │   └── trpc/[trpc]/route.ts         # tRPC endpoint
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Landing page
│   └── globals.css         # Tailwind styles
├── components/
│   ├── ui/                 # Radix UI primitives
│   └── providers.tsx       # Client providers wrapper
├── server/
│   ├── db/
│   │   ├── schema/         # Drizzle ORM table definitions
│   │   ├── index.ts        # DB connection + RLS helpers
│   │   └── triggers.ts     # PostgreSQL trigger definitions
│   ├── trpc/
│   │   ├── context.ts      # tRPC context creation
│   │   ├── root.ts         # Root router combining all sub-routers
│   │   └── routers/        # One file per domain router
│   └── jobs/               # Inngest job functions
├── lib/
│   ├── auth/
│   │   ├── index.ts        # Auth.js configuration
│   │   ├── jwt.ts          # Custom JWT helpers
│   │   └── email.ts        # Email utilities
│   └── utils.ts            # cn(), formatCurrency(), etc.
├── proxy.ts                # Request proxy (auth gating)
└── instrumentation.ts      # Sentry setup
```

## Execution Protocol (Enforced)

1. **One phase at a time** — Phase N+1 starts only after Phase N tests pass
2. **Within each phase**: Schema → Triggers/Invariants → tRPC → Invariant Tests → UI → Integration Tests
3. **Never relax invariants** — Balance, immutability, tenant isolation are non-negotiable
4. **Flag ambiguities** — Don't silently diverge from the plan
5. **All company-scoped data goes through RLS** — Set `app.current_company_id` in tRPC context

## Database Invariants

These are enforced via PostgreSQL triggers, NOT application code:

1. **Balanced posting**: `is_posted false→true` requires Σ signed_amount = 0 AND count ≥ 2
2. **Immutability**: Posted entries/lines reject UPDATE/DELETE
3. **Period locking**: Writes rejected if parent period `is_closed = true`
4. **Tenant isolation**: All `company_id` tables have RLS `USING (company_id = current_setting('app.current_company_id')::uuid)`
5. **Audit**: All critical mutations write to `audit_logs` with before/after JSONB

## tRPC Authorization Hierarchy

```
publicProcedure          # No auth required
  → protectedProcedure   # Requires valid session (isAuthed)
    → companyProcedure   # Requires company membership (hasCompany)
      → accountantProcedure  # Role: owner, admin, accountant
        → adminProcedure     # Role: owner, admin
          → ownerProcedure   # Role: owner
```

## Code Style

- All new files use TypeScript with strict mode
- Database columns use snake_case (Drizzle convention)
- React components use PascalCase filenames
- Utility functions use camelCase
- Prefer `type` imports for type-only imports
- Use `@/` path alias for all internal imports
- No default exports except for Next.js page/layout conventions

## Dependencies & Version Notes

| Package | Version | Notes |
|---|---|---|
| next | ^16.2.10 | Proxy, async cookies/headers, promise params |
| react | ^19.2.4 | React 19 |
| @trpc/server | ^11.18.0 | tRPC v11 |
| drizzle-orm | ^0.45.2 | Drizzle ORM latest |
| next-auth | ^5.0.0-beta.31 | Auth.js v5 beta |
| tailwindcss | ^4 | Tailwind v4 with `@tailwindcss/postcss` |
| zod | ^4.4.3 | Zod v4 |
| vitest | ^4.1.10 | Vitest v4 |
| @sentry/nextjs | ^10.65.0 | Sentry with App Router support |

## Testing

- **Unit tests**: Vitest with `@testing-library/react`
- **Integration tests**: tRPC caller + test database
- **E2E tests**: Playwright
- **Property tests**: Fast-check for ledger invariants
- Test files co-located or in `tests/` directory
- Test database: separate PostgreSQL instance, migrations run before test suite

## Background Jobs (Inngest)

| Job | Trigger | Phase |
|---|---|---|
| Bank sync (Plaid) | Cron / webhook | 3 |
| Reconciliation engine | On `bank_transactions` insert | 3 |
| Receipt OCR | On `receipts` insert | 4 |
| Depreciation posting | Monthly cron | 5 |
| Credit metering | On feature use | 6 |

## Self-Hosted vs Hosted

- **Self-hosted** (`SELF_HOSTED=true`): All features unlocked, own Plaid/Anthropic keys, no Stripe
- **Hosted**: Stripe subscriptions + credit packs, features gated behind credits