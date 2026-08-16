# 18 - Decision Log

Append-only. Each entry records what was decided, why, and what it costs to
reverse. Newest last.

---

## D-001 - One Next.js app, not two

**Date:** 2026-08-15 · **Status:** proposed, awaiting sign-off

The commerce platform lives inside the existing `apps/muroora`, split into
`(marketing)` and `(shop)` route groups, rather than as a separate application.

**Why:** the brief asks to preserve the current site and avoid unnecessary
migrations. A second app duplicates the design system, adds a second
deployment, and puts a visible seam in the middle of the customer's journey
from `/about` to `/shop`. Next renders static and dynamic routes from one
codebase, so the marketing pages stay prerendered either way.

**Cost to reverse:** low early, high after Phase 2. Splitting later means
extracting shared components and duplicating auth.

---

## D-002 - `store_id` on every domain table from migration one

**Date:** 2026-08-15 · **Status:** proposed

Products, inventory, orders and deliveries all carry a `store_id` even though
there is exactly one store and multi-merchant is explicitly out of scope for
version 1.

**Why:** it is the entire "architecture can support future merchants without
immediate rewrite" requirement, and it costs one column now. Adding it later
means backfilling every row in every table and rewriting every query.

**Cost to reverse:** trivial to drop, near-impossible to add retroactively.

---

## D-003 - Money as integer minor units with an explicit currency

**Date:** 2026-08-15 · **Status:** proposed

All monetary values are `bigint` in the currency's smallest unit, stored beside
a `currency` column. Never floats. The exchange rate in force is stored **on
the order**, not looked up at read time.

**Why:** floating point cannot represent money. And Zimbabwe runs USD and ZWL
in parallel at a moving rate - an order placed today must still reconcile
correctly in six months, which is only true if the rate is captured at the
moment of sale. The brief does not raise currency at all; it should.

**Cost to reverse:** among the worst refactors in commerce software.

---

## D-004 - Ledgers are append-only; status fields are projections

**Date:** 2026-08-15 · **Status:** proposed

`inventory_transactions`, `order_events`, `rider_earnings` and `audit_log`
accept inserts only. `orders.status` is a cached projection of the event log,
never the source of truth.

**Why:** the brief requires "never silently modify order states" and full
auditability. Neither is achievable if the current state is a mutable column.

**Cost to reverse:** high. Retrofitting an event log means the history before
the change does not exist.

---

## D-005 - Rider documents are a launch blocker, not a feature

**Date:** 2026-08-15 · **Status:** proposed

Private bucket, no public URLs ever, short-lived signed URLs to authenticated
admins only, encryption at rest, every access logged, a stated retention
period, deletion on rider exit.

**Why:** these are national IDs, licences and police clearances belonging to
people who are not employees. Zimbabwe's Data Protection Act (Chapter 11:12,
2021) applies and carries criminal penalties. A failure here harms riders, not
the website.

**Cost to reverse:** the leak cannot be reversed.

---

## D-006 - Rider custody and exposure are ledgers, not editable totals

**Date:** 2026-08-16 · **Status:** implemented

Assignment does not transfer goods. Shop staff starts handover, the assigned
rider confirms collection, and only then does exposure increase. OTP-confirmed
delivery or a recorded return decreases it. Each transition has an immutable
custody/exposure event and an idempotency key.

**Why:** a mutable “current rider value” field cannot explain who released the
goods, prevent double counting, or reconstruct an incident. The profile total
is only a cached projection of the append-only ledger.

**Cost to reverse:** high and unsafe; removing history would weaken financial
and custody reconciliation.

---

## D-007 - Sensitive rider verification remains off

**Date:** 2026-08-16 · **Status:** implemented

`ENABLE_SENSITIVE_RIDER_VERIFICATION=false` is the default. The current API and
mobile test UI accept only operational profile, vehicle, safety, and agreement
information. National ID and police/background document collection is not
built into the public flow.

**Why:** the owner has not yet approved the legal basis, retention period,
reviewer access, or deletion workflow. A private bucket alone is not permission
to collect sensitive data.

**Cost to reverse:** enabling later requires a separate reviewed migration,
private storage and signed access, audit logging, and explicit owner approval.

---

## Open decisions - needed before Phase 1

| # | Decision | Options |
| --- | --- | --- |
| O-1 | Postgres host | Neon · Supabase (brings private storage with RLS, which suits D-005) |
| O-2 | ORM and migrations | Drizzle + drizzle-kit (recommended) · Prisma |
| O-3 | Git remote | Required before Phase 1 - see the 110MB blob blocker in `00_CODEBASE_AUDIT.md` |
| O-4 | Who initiates rider payouts | Automatic from the platform, or manually by the business (materially different regulatory posture) |
