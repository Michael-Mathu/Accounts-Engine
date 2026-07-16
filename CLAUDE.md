@AGENTS.md

# Claude Additional Configuration

## Context Files

- Full build plan: `C:\Users\micha\.gemini\antigravity\scratch\ACCOUNT\full-system-build-plan.md`
- Full build prompt (DDL + detailed specs): `C:\Users\micha\.gemini\antigravity\scratch\ACCOUNT\full-system-build-prompt.md`

## Project Directory

`C:\Users\micha\.gemini\antigravity\scratch\ACCOUNT\accounting-engine`

## Key Environment Variables

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/accounting_engine
AUTH_SECRET=<generate-a-32-char-random-string>
NEXTAUTH_URL=http://localhost:3000
SELF_HOSTED=true  # Development default
```

## Quick Setup Commands

```bash
# Fresh setup
npm install
cp .env.example .env   # Then populate AUTH_SECRET
npx drizzle-kit generate
npx drizzle-kit migrate
npx tsx scripts/seed.ts
npm run dev

# Testing
npx vitest run          # Unit/integration tests
npx playwright test     # E2E tests
```

## Next.js 16 API Differences (Cheat Sheet)

| Old (≤14) | New (≥16) |
|---|---|
| `middleware.ts` | `proxy.ts` |
| `export function middleware(req)` | `export function proxy(request)` |
| `next.config.js` | `next.config.ts` |
| `cookies()` (sync) | `await cookies()` (async) |
| `headers()` (sync) | `await headers()` (async) |
| `params: { id: string }` | `params: Promise<{ id: string }>` → `await params` |
| `getServerSession(authOptions)` | `auth()` |
| `AuthOptions` type | `NextAuth(config)` returns `{ handlers, auth, signIn, signOut }` |

## Important: Read the Docs

When writing framework-specific code (proxy, route handlers, server functions, auth), always check the relevant doc in `node_modules/next/dist/docs/` first. This version has breaking changes.

Key docs to reference:
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/index.md`