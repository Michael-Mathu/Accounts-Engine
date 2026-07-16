# Accounting Engine - Deployment Guide

## Environment Variables

### Required
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | NextAuth secret key (generate: `openssl rand -base64 32`) |

### Optional (Self-hosted mode)
| Variable | Description |
|----------|-------------|
| `SELF_HOSTED` | Set to `true` to bypass credit system |
| `PLAID_CLIENT_ID` | Plaid API client ID |
| `PLAID_SECRET` | Plaid API secret |
| `ANTHROPIC_API_KEY` | AI receipt extraction |
| `AWS_ACCESS_KEY_ID` | S3 credentials |
| `AWS_SECRET_ACCESS_KEY` | S3 credentials |
| `AWS_S3_BUCKET` | S3 bucket name |

### Optional (Hosted mode)
| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe payments |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification |
| `SENTRY_DSN` | Error monitoring |
| `INNGEST_EVENT_KEY` | Background jobs |

## Production Setup

```bash
# 1. Set environment variables
cp .env.example .env.production

# 2. Run migrations
npm run db:migrate

# 3. Build
npm run build

# 4. Start
npm start
```

## Docker Deployment

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
EXPOSE 3000
CMD ["npm", "start"]
```

## Docker Compose

```yaml
version: '3.8'
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: accounting
      POSTGRES_PASSWORD: postgres
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data
      
  app:
    build: .
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/accounting
      AUTH_SECRET: ${AUTH_SECRET}
    ports: ["3000:3000"]
    depends_on: [db]
```

## Database Migrations

Migrations are in `src/server/db/migrations/`. Run:

```bash
# Generate migration
npx drizzle-kit generate

# Apply migration
npx drizzle-kit migrate

# Studio (GUI)
npx drizzle-kit studio
```

## Background Jobs

Inngest runs automatically when `SELF_HOSTED=true` or when `INNGEST_EVENT_KEY` is set.

Jobs:
- `bankSyncJob` - Daily bank transaction sync
- `receiptOcrJob` - On receipt upload
- `depreciationPostingJob` - Monthly depreciation
- `creditResetJob` - Monthly credit reset (hosted)

## Health Checks

```bash
# API health
curl /api/trpc/accounts.list

# Database connection
curl /api/trpc/reports.trialBalance
```

## Testing

```bash
# Unit tests
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