# Muroora Mart — Tasks

Coordination between **Claude** (backend, data, API) and **Codex** (Figma,
front end). Required by section 59 of the master build prompt.

## The deal, in one line

**One backend, two consumers.** Claude owns the database, the service layer and
the HTTP API. Codex owns the front end. The API is the contract between them —
neither agent edits the other's layer.

## Rules

1. **Claim a task before starting it.** Move it to IN PROGRESS with your name.
2. **Never blindly rewrite a file the other agent just changed.** Run
   `git log --oneline -10` and `git diff` first.
3. **Commit logical units**, not end-of-day dumps.
4. **Run `npm run build` and `npm run lint` before marking anything DONE.**
   Do not claim completion if either fails.
5. **Update the docs** when architecture changes.
6. No TODO placeholders in security, money or stock logic.

## Ownership — who edits what

| Path | Owner | Notes |
| --- | --- | --- |
| `db/**` | **Claude** | Schema, migrations, seed. Codex: request a change, do not edit. |
| `lib/money.ts`, `lib/inventory.ts` | **Claude** | Money and stock invariants. Do not bypass. |
| `lib/services/**` | **Claude** | Business logic. The only place it lives. |
| `app/api/**` | **Claude** | The HTTP contract Codex consumes. |
| `lib/auth.ts`, `middleware.ts` | **Claude** | Access control. |
| `app/(marketing)/**` | **Codex** | Public pages. |
| `app/(shop)/**` | **Codex** | Shop, product, cart, checkout UI. |
| `app/components/**` | **Codex** | Presentation. May read from the API only. |
| `app/globals.css` | **Codex** | Brand layer. Claude will not touch it. |
| `app/admin/**`, `app/staff/**` | **Claude** for now | Handing to Codex once the API is stable. |

## The contract Codex builds against

Business logic never lives in a component. Every screen gets its data from
either a service function (server-side) or an HTTP endpoint (anything else).

```
UI  ──►  app/api/*  ──►  lib/services/*  ──►  db/*
        (HTTP, for       (all business      (Drizzle,
         any client)      rules)             Postgres)
```

A future native app calls the same `app/api/*` routes the web front end does.
That is the whole reason the boundary exists — section 56.

**Rules that are enforced below the UI and cannot be worked around:**

- Money is integer minor units with a currency. Never a float. `lib/money.ts`.
- Stock changes go through `lib/inventory.ts`, which writes the balance and the
  ledger row in one transaction. Nothing else may write to `inventory`.
- `orders.status` is a projection of `order_events`. Never set it directly.
- Cost price is admin-only and must never appear in a customer response.
- Public signup grants CUSTOMER only. Roles come from `user_roles`.

---

## BACKLOG

| ID | Description | Owner | Depends on | Files | Acceptance |
| --- | --- | --- | --- | --- | --- |
| API-03 | Checkout + order creation | Claude | API-02 | `lib/services/orders.ts`, `app/api/orders/**` | Buyer/recipient split; idempotent; reserves stock; writes `order_events` |
| API-04 | Delivery fee by zone | Claude | API-03 | `lib/services/delivery.ts` | Suburb → zone → fee; refuses inactive zones |
| UI-01 | Shop + category pages — **API-01 is READY** | Codex | API-01 | `app/(shop)/shop/**` | Renders live products; no cost price in the payload |
| UI-02 | Product detail page — **API-01 is READY** | Codex | API-01 | `app/(shop)/product/[slug]` | Shows stock state; add-to-cart |
| UI-03 | Cart page — **API-02 is READY** | Codex | API-02 | `app/(shop)/cart` | Works signed out |
| UI-04 | Checkout, buyer/recipient | Codex | API-03 | `app/(shop)/checkout` | "I am the recipient" checkbox; mobile-first |
| OPS-01 | Staff order queue | Claude | API-03 | `app/staff/orders/**` | Filter by status; pick/pack |
| SEC-01 | Row-level security on Supabase tables | Claude | — | migration | Anon can read active products only |
| DOC-01 | Remaining `/docs` files from section 45 | Claude | — | `docs/**` | 01–19 present |

## IN PROGRESS

| ID | Description | Owner | Notes |
| --- | --- | --- | --- |
| — | Nothing claimed. **API-03 is next for Claude.** | | |

## BLOCKED

| ID | Description | Owner | Blocked on |
| --- | --- | --- | --- |
| DATA-01 | Load the real product catalogue | Owner | The shop's actual stock list — names, sizes, prices, categories. Nothing invented. |
| AUTH-02 | Google / Facebook sign-in | Owner | Client ID + secret from Google Cloud Console and Meta for Developers. Free, but only the owner can open those. |
| WA-01 | WhatsApp CTAs | Owner | No business number yet. `WHATSAPP_BUSINESS_NUMBER` blank keeps every CTA hidden. |
| PAY-01 | Payment provider | Owner | No provider chosen. `payments` table records without one. |

## REVIEW

| ID | Description | Owner | Notes |
| --- | --- | --- | --- |
| AUTH-01 | Email sign-in, role gating, admin bootstrap | Claude | Gate verified — anonymous hits on `/admin/*` redirect to `/login`. **Not yet verified end to end with a real session**, because the first admin needs an account only the owner can create. The temporary test account has been deleted. |
| ADM-01 | Admin product screen | Claude | Built and gated. Add-product path exercised through the service layer by `db/verify-api.mjs`, not yet through the form with a signed-in admin. |

## DONE

| ID | Description | Owner | Verified by |
| --- | --- | --- | --- |
| DB-01 | Schema: 19 tables, store_id everywhere, money as minor units | Claude | `db/verify.mjs` |
| DB-02 | Migrations + DB-level guards (append-only triggers, stock CHECKs, order-number sequence) | Claude | `db/verify.mjs` — each rule deliberately violated to prove it refuses |
| DB-03 | Supabase project provisioned (free tier), migrated, seeded | Claude | `db/show.mjs` |
| LIB-01 | `lib/money.ts` | Claude | `lib/money.check.ts` — 28 checks |
| LIB-02 | `lib/inventory.ts` — ledger + balance in one transaction | Claude | `db/verify.mjs` |
| API-01 | Product/catalogue service + read endpoints | Claude | `db/verify-api.mjs` — 13 checks, incl. a $999.99 cost price greppped for in the raw response |
| API-02 | Cart service + endpoints | Claude | `db/verify-cart.mjs` — 22 checks, guest-only journey |
| DOC-00 | Phase 0 audit + decision log | Claude | — |

---

## Known issues

- **`mailer_autoconfirm` is ON.** Signups skip email verification. Correct for
  development on a free tier with no SMTP; **must be turned off before real
  customers**, or anyone can register with someone else's address.
- **Repo has no git remote**, and cannot be pushed to GitHub: a 110MB video is
  in git history and GitHub rejects anything over 100MB. Two agents working the
  same tree without a shared remote is a real coordination risk.
- **Supabase free tier pauses after 7 days idle.** One click to wake.
