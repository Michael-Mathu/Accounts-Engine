# Full System Build Plan — Open-Source Accounting Engine

## 1. Vision & Differentiators

An AGPL-3.0, self-hostable double-entry accounting system for freelancers and small businesses, with:
- A ledger core that cannot be corrupted (enforced at the database level, not just in application code)
- Native cash-basis reporting derived from an accrual-first core (no dual data models)
- Automated bank reconciliation via a multi-pass matching engine
- AI-native receipt/invoice ingestion via multimodal VLM extraction
- **Native US Schedule C tax mapping** — the wedge no competitor in this space has built in

## 2. Full System Architecture

```
                         ┌─────────────────────────────┐
                         │   Next.js App (App Router)  │
                         │   TypeScript strict, Tailwind│
                         └──────────────┬───────────────┘
                                        │ tRPC (typed RPC, no loose REST)
                         ┌──────────────▼───────────────┐
                         │      Application Layer        │
                         │  Auth.js · domain services ·  │
                         │  background job triggers      │
                         └──────────────┬───────────────┘
                                        │ Drizzle ORM
                         ┌──────────────▼───────────────┐
                         │        PostgreSQL              │
                         │  Triggers enforce: balance,    │
                         │  immutability, period locks,   │
                         │  tenant isolation              │
                         └───────────────────────────────┘
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              │                         │                         │
     ┌────────▼────────┐      ┌─────────▼────────┐      ┌─────────▼────────┐
     │   Plaid (bank    │      │  Anthropic API    │      │  Stripe (billing, │
     │   feeds, dual-   │      │  (VLM receipt      │      │  metered credits) │
     │   path per-tenant│      │  extraction)       │      │                   │
     │   or relay)      │      │                    │      │                   │
     └──────────────────┘      └───────────────────┘      └───────────────────┘

Background jobs (Inngest/Trigger.dev): bank sync polling, receipt OCR processing,
recurring depreciation posting, subscription renewal checks.
```

## 3. Complete Data Model (by domain)

| Domain | Core tables | Purpose |
|---|---|---|
| Tenancy & Auth | `companies`, `users`, `company_users` | Multi-tenant root, role-based access per company |
| Ledger core | `account_types`, `accounts`, `fiscal_years`, `accounting_periods`, `journals`, `journal_entries`, `journal_lines` | The immutable, balance-enforced general ledger |
| AR (invoicing) | `customers`, `invoices`, `invoice_lines`, `customer_payments`, `payment_applications` | Revenue recognition + cash application |
| AP (bills) | `vendors`, `bills`, `bill_lines`, `vendor_payments`, `vendor_payment_applications` | Expense recognition + cash application |
| Banking | `bank_accounts`, `bank_transactions`, `reconciliation_rules` | Feed ingestion + multi-pass matching |
| Receipts/AI | `receipts` (with `extracted_data jsonb`) | VLM-extracted draft entries pending review |
| Tax | `schedule_c_lines`, `mileage_logs` | Schedule C mapping + mileage deduction |
| Fixed assets | `fixed_assets`, `depreciation_schedules` | Depreciation posting |
| Billing | `subscriptions`, `credit_balances`, `credit_transactions` | Hosted-tier monetization |
| Audit | `audit_log` | Who changed what, when — required given immutability guarantees elsewhere |

Full DDL for every table is in the accompanying build prompt — this plan stays at the architecture level.

## 4. Full Feature Matrix by Phase

| Phase | Module | Key features | External deps | Definition of done |
|---|---|---|---|---|
| 0 | Foundation | Auth, multi-tenancy, CI, empty dashboard | Auth.js | New user can sign up and create a company |
| 1 | Ledger core | COA, journal entries, trial balance, P&L, balance sheet | — | Ledger invariant test suite passes (unbalanced/immutability/period-lock all rejected) |
| 2 | AR/AP | Customers, vendors, invoices, bills, payment application (full + partial) | — | Partial payment across 2+ invoices posts correct journal lines; cash-basis P&L matches accrual P&L minus unpaid AR/AP |
| 3 | Banking | CSV/OFX import, 4-pass reconciliation engine, then Plaid dual-path | Plaid | A sample bank statement reconciles with ≥90% auto-match rate in the exceptions-queue test fixture |
| 4 | AI receipts | Image upload, VLM extraction, draft entry generation, review/approve UI | Anthropic API | A photographed receipt produces a correctly-categorized draft journal entry a user can approve in one click |
| 5 | Tax | Schedule C account mapping, mileage tracker, fixed asset depreciation | — | A full tax year of seeded data exports a populated Schedule C worksheet |
| 6 | Monetization | Stripe subscriptions, credit metering, feature flags | Stripe | A hosted-tier user is correctly blocked/allowed based on credit balance |

## 5. Non-Functional Requirements

- **Tenant isolation**: every query scoped by `company_id`; add a Postgres row-level security policy as a second layer, not just app-level `WHERE` clauses.
- **Secrets**: Plaid access tokens and API keys encrypted at rest, never logged.
- **Audit trail**: every mutation to posted financial data (reversals, period closes) writes to `audit_log` with before/after snapshots.
- **Performance**: paginate all list endpoints; index on `(company_id, date)` for every ledger-adjacent table.
- **Observability**: structured logging + error tracking (Sentry) from Phase 0, not bolted on later.
- **Backups**: automated daily Postgres backups on the hosted tier; self-hosters get a documented `pg_dump` cron recipe.

## 6. Timeline (solo, part-time)

| Phase | Duration | Cumulative |
|---|---|---|
| 0 — Foundation | 1–2 wks | 2 wks |
| 1 — Ledger core | 3–5 wks | 7 wks |
| 2 — AR/AP | 3–4 wks | 11 wks |
| 3 — Banking | 3–4 wks | 15 wks |
| 4 — AI receipts | 2–3 wks | 18 wks |
| 5 — Tax | 2–3 wks | 21 wks |
| 6 — Monetization | 2 wks | 23 wks |

Roughly 5–6 months to a full v1. Phases 0–3 (≈15 weeks) are enough for a genuinely usable public beta — ship there and let real usage prioritize 4–6.

## 7. Licensing & Monetization (recap)

- Core: AGPL-3.0. Hosted cloud tier: flat monthly fee. Metered credits for anything with a per-use external cost (VLM calls, Plaid relay). Paid connectors (e-filing, multi-entity) come later, only once there's demand.

## 8. Risk Register

| Risk | Mitigation |
|---|---|
| Ledger bug corrupts financial data | DB-level triggers, not app-level checks; property-based tests on trial balance |
| Plaid self-hosting friction kills adoption | CSV/OFX import ships first and works standalone, forever — Plaid is additive, not required |
| VLM extraction costs balloon | Client-side preprocessing + prompt caching + credit metering from day one |
| Solo maintainer bottleneck | AGPL + clean module boundaries invite contributors; don't build anything so bespoke that only you can touch it |
| Scope creep past Phase 3 before validating demand | Ship the public beta at Phase 3, let user requests drive 4–6 priority order |

## 9. Go-to-Market

Ship the Phase 0–3 beta publicly (Show HN / r/selfhosted / r/accounting), lead with "AGPL, real bank reconciliation, no BSL paywall." Add the Schedule C story once Phase 5 ships and use it to target US solo-proprietor freelancers specifically — that's the segment with the clearest, most acute pain point none of the competitors solve natively.
