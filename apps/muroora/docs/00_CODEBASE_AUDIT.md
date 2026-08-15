# 00 — Codebase Audit

**Date:** 2026-08-15
**Against:** `MUROORA_MART_MASTER_BUILD_PROMPT.txt` v1.0, Phase 0
**Auditor:** Claude (Opus 5), by inspection of the repository, not from memory

---

## The headline finding

**There is no backend. Not a thin one — none.**

I searched the entire monorepo for every signal of a stateful application:

| Looked for | Occurrences |
| --- | --- |
| `prisma`, `drizzle`, `mongoose` | 0 |
| `@supabase`, `postgres`, `sqlite` | 0 |
| `next-auth`, `@auth/` | 0 |
| API route handlers (`app/**/route.ts`) | 0 |
| `middleware.ts` | 0 |
| `stripe`, `paynow`, any payment SDK | 0 |

`apps/muroora` is **26 files**, all of them a static marketing site: five page
components, five shared components, one hand-written `site.ts` of copy, a logo
and a hero image. It renders to static HTML and is served from a CDN.

This is not a criticism of it — it does its job well and the brief explicitly
asks to keep it as the visual foundation. But it means the spec's scope must be
read honestly: **products, inventory, cart, checkout, orders, roles, riders,
dispatch, earnings, payments, notifications and audit logging are all new
build from zero.** Nothing in the current codebase can be extended into them,
because there is nothing there to extend.

---

## A. What exists today

### Stack

| Concern | Current |
| --- | --- |
| Framework | Next.js 16.3 (App Router), React 19 |
| Language | TypeScript, strict |
| Styling | Tailwind CSS 4, tokens in `@pineberry/ui` |
| Rendering | Fully static. Every route prerenders at build time |
| Data | A TypeScript file. `app/data/site.ts` exports frozen literals |
| Auth | None |
| Database | None |
| File storage | `public/`, i.e. world-readable CDN assets |
| Deployment | Vercel, project `muroora-mart`, root directory `apps/muroora` |
| Repo | Local git only, no remote. See "Blockers" |

### Routes

`/`, `/shop`, `/diaspora`, `/about`, `/contact` — all marketing pages.
`/shop` describes six product *categories* in prose. There is no product, no
price, no basket and no way to buy anything.

### What is genuinely reusable

Keep all of it. The design language is settled and the spec asks to preserve it:

- `app/globals.css` — the brand layer. Green `#005029` and orange `#f25c13`
  are sampled from the client's own logo artwork, not invented.
- `components/Nav.tsx`, `Footer.tsx`, `PageHeader.tsx`, `Logo.tsx`
- `@pineberry/ui` — shared tokens, `Reveal`, `GroupBar`
- The hero photograph and its full-bleed treatment
- The copy in `site.ts`, which came from the company's own profile document

### What must move

`app/data/site.ts` currently holds `CATEGORIES`, `PAYMENTS`, `SEGMENTS`,
`DIASPORA_STEPS` as hard-coded constants. Categories and payment rails become
database tables. The rest is marketing copy and can stay as-is.

---

## B. Proposed architecture

### The central decision: one app or two?

**Recommendation: one Next.js app, two route groups.** Keep `apps/muroora`,
add `(marketing)` and `(shop)` groups inside it.

Rationale:

- The brief says preserve the current site and avoid unnecessary migrations.
  A second app means a second deployment, a duplicated design system and a
  visible seam when a customer crosses from `/about` to `/shop`.
- Next.js renders static and dynamic routes from one codebase. The marketing
  pages stay prerendered; the shop routes become dynamic. No conflict.
- One domain, one session cookie, one analytics view of the funnel.

The cost: the project stops being a static site, so it now needs a database, a
server runtime and private storage. That is unavoidable — the spec requires
state.

### Recommended stack

| Concern | Recommendation | Why |
| --- | --- | --- |
| Database | **Postgres** (Neon or Supabase) | Relational data with real integrity constraints. Orders, stock and money are exactly what Postgres is for. Both have free tiers and first-class Vercel integration. |
| ORM / migrations | **Drizzle + drizzle-kit** | SQL-shaped, small serverless footprint, migrations are plain SQL files that can be read and reviewed. Prisma is the reasonable alternative if the team prefers its DX. |
| Auth | **Auth.js v5** | Phone-first is the right fit for this market; start email/password + magic link, add OTP when an SMS provider is chosen. |
| Private files | **Supabase Storage** (private bucket) or **Vercel Blob** | Rider ID documents must never be public. See Risk 1. |
| Payments | **Abstraction only for now** | The spec is right to defer. No provider is chosen. |
| Money | **Integer minor units** | Never floats. See Risk 3. |
| Background work | Vercel Cron to start | Document expiry checks, stale-order sweeps. Real queues can come later. |

### Boundaries worth drawing on day one

- **Money and stock changes go through a service layer, never a component.**
  Every mutation writes a ledger row in the same transaction as the balance
  change. This is what makes the business auditable, and it is very hard to
  retrofit.
- **Order state changes are events, not field updates.** `orders.status` is a
  cached projection of `order_events`. The spec's "never silently modify order
  states" only holds if the event log is the source of truth.
- **`store_id` on every product, inventory and order row from the first
  migration**, even though there is exactly one store. This is the whole
  "future multi-merchant without a rewrite" requirement, and it costs nothing
  now. Adding it later means backfilling every table.

---

## C. Database schema (first cut)

Names are indicative; the full schema goes in `03_DATABASE_SCHEMA.md`.

**Identity and access**
`users` · `sessions` · `roles` · `user_roles` · `addresses` · `saved_recipients`

**Catalogue**
`stores` · `categories` · `products` · `product_images` · `product_variants`

**Stock**
`inventory` (current level per product per store)
`inventory_transactions` (the ledger — every movement, typed, with
`quantity_before` / `quantity_after`, actor and reason)

**Ordering**
`orders` · `order_items` · `order_events` · `substitutions` · `payments`

**Delivery**
`delivery_zones` · `deliveries` · `delivery_events` · `proof_of_delivery`

**Riders**
`riders` · `rider_documents` · `rider_availability` · `rider_ratings`
`rider_earnings` · `payouts`

**Cross-cutting**
`audit_log` · `notifications` · `feature_flags` · `idempotency_keys`

### Three schema rules that are hard to add later

1. **Every table carries `store_id`.** One store today, many later.
2. **Money is `bigint` in minor units plus a `currency` column.** Never
   `float`, never `numeric` without a currency beside it.
3. **Ledgers are append-only.** `inventory_transactions`, `order_events`,
   `rider_earnings` and `audit_log` take inserts only. No updates, no deletes.

---

## D. Migration plan

The current site has no data to migrate, which makes this unusually clean.

1. Provision Postgres; put the URL in an environment variable.
2. Add Drizzle, create the initial migration for identity + catalogue + stock.
3. Seed real Muroora products from the shop's own stock list — **not** invented
   demo data. This is a real business; fake products would end up in front of
   real customers.
4. Move `CATEGORIES` out of `site.ts` into the `categories` table, and have
   `/shop` read from the database. This is the first moment the site stops
   being static, and it is a good, small, reversible first cut.
5. Everything after that is additive.

**Nothing existing gets deleted.** The marketing pages keep working throughout.

---

## E. Phase plan

The spec's own phasing is sound and I would not change its order. What I would
add is a realistic sense of size, because that is missing from the brief:

| Phase | Scope | Rough size |
| --- | --- | --- |
| 0 | Audit, architecture, schema, decisions | This document |
| 1 | DB, products, categories, inventory, accounts, cart, checkout, order creation, admin products, staff queue | The largest single phase |
| 2 | Picking, packing, substitutions, order events, zones, delivery fees, tracking page | Large |
| 3 | Rider registration, documents, verification, availability | Medium, high risk — see Risk 1 |
| 4 | Dispatch, accept/decline, pickup, delivery, proof of delivery | Large |
| 5 | Earnings ledger, payouts, reconciliation | Medium, high risk — money |
| 6 | Notification abstraction, WhatsApp once a number exists | Medium |
| 7 | Analytics | Small |
| 8 | Testing, security review, privacy review, backups, launch checklist | Do not skip |

**This is a multi-month build for a small team, not a sprint.** Phase 1 alone
is a substantial piece of work. Saying so now is more useful than discovering
it in week three.

---

## F. Risks and blockers

### Risk 1 — Rider identity documents. The most serious thing in this spec.

Phase 3 collects national IDs, driving licences, police clearance, proof of
residence and mobile-wallet details from real people who are not employees and
have little leverage.

- Zimbabwe's **Data Protection Act (Chapter 11:12, 2021)** applies. It requires
  a lawful basis, purpose limitation, security safeguards, and it has criminal
  penalties.
- A leak here is not a broken website. It is riders exposed to identity theft.
- **Non-negotiables:** private bucket, no public URLs ever, short-lived signed
  URLs issued only to authenticated admins, encryption at rest, every access
  written to `audit_log`, a documented retention period, and deletion when a
  rider leaves.
- The spec already says most of this. It should be treated as a launch
  blocker, not a nice-to-have.

### Risk 2 — Payments and money movement

Rider earnings mean the platform holds money owed to third parties. That is a
different regulatory posture from simply taking card payments. Before Phase 5,
someone needs to confirm what licensing (if any) applies to paying riders
through the platform, and whether payouts should instead be initiated manually
by the business.

### Risk 3 — Currency

The brief never mentions it, but Zimbabwe runs USD and ZWL in parallel with a
moving rate. Every price, fee, earning and payout needs a currency attached
from the first migration, and the rate used must be stored **on the order** at
the time it was placed. Retrofitting multi-currency into a single-currency
schema is one of the worst refactors in commerce software.

### Risk 4 — No WhatsApp number, no shop contact details

Already handled correctly: the site shows nothing rather than a fake number.
Keep that. `WHATSAPP_BUSINESS_NUMBER` unset must mean CTAs are hidden, never
`undefined` in an href.

### Blocker 1 — The repository cannot be pushed to GitHub

`Images/video_2026-08-08_15-27-21.mp4` is **110MB and already in git history**.
GitHub hard-rejects anything over 100MB, so a push is refused regardless of
`.gitignore`. Fixing it needs `git filter-repo` or LFS.

This matters more now than it did for marketing sites. A commerce platform
handling money and PII needs code review, CI, branch protection and a backup of
the source that is not one laptop. **This should be resolved before Phase 1.**

### Blocker 2 — A credential was nearly committed

A Vercel token was left in the repo root as `vercell.txt`, untracked but not
ignored. One `git add -A` would have committed it. It is now in `.gitignore`
and `.vercelignore`, but the practice needs to stop before there are database
URLs and payment keys in play.

### Blocker 3 — No test infrastructure

There is no test runner in the monorepo. Phase 1 should add one, because stock
arithmetic and order state machines are exactly the code that must not be
verified by clicking around.

---

## G. Files expected to change

**Preserved, largely untouched**
`app/globals.css` · `components/Nav.tsx` · `Footer.tsx` · `PageHeader.tsx` ·
`Logo.tsx` · `app/about/page.tsx` · `app/diaspora/page.tsx` · `app/page.tsx`

**Changed**
`app/shop/page.tsx` — reads the database instead of a constant
`app/data/site.ts` — categories move out; marketing copy stays
`app/layout.tsx` — session provider, cart context
`package.json` — Drizzle, Auth.js, Zod, a test runner
`vercel.json` / env — database URL, storage credentials

**New (Phase 1)**
`db/schema/*`, `db/migrations/*`, `lib/auth/*`, `lib/money.ts`,
`lib/inventory.ts`, `app/(shop)/product/[slug]`, `/cart`, `/checkout`,
`/order/[id]`, `/account/*`, `/staff/orders`, `/admin/products`,
`app/api/*/route.ts`, `middleware.ts` for role gating

---

## Recommended next task

Confirm three decisions before any code is written, because each one is
expensive to reverse:

1. **Postgres host** — Neon or Supabase. Supabase brings private storage with
   row-level security in the same product, which suits Risk 1.
2. **ORM** — Drizzle (recommended) or Prisma.
3. **Fix the GitHub blocker** so this work is reviewable and backed up.

Then Phase 1 opens with the schema and the product catalogue.
