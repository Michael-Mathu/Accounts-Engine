# Accounting Engine

Open-source QuickBooks alternative for freelancers/SMEs.

## Deployment

### Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - NextAuth secret key
- `NEXTAUTH_URL` - Application URL

Optional:
- `SENTRY_DSN` - Sentry error tracking
- `STRIPE_SECRET_KEY` - Stripe payments
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing
- `PLAID_CLIENT_ID` / `PLAID_SECRET` - Plaid integration
- `ANTHROPIC_API_KEY` - AI features

### Production Setup

1. Set environment variables
2. Run migrations: `npm run db:migrate`
3. Seed database: `npm run db:seed`
4. Build: `npm run build`
5. Start: `npm start`

### Docker Deployment

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

## Testing

- Unit tests: `npm run test`
- E2E tests: `npm run test:e2e`