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
| STAFF-02 | Staff photographs on the profile | Claude | — | `lib/services/staff.ts` | Supabase Storage, signed URL at render. Column exists, unused. |
| STAFF-03 | Printable staff ID cards | Claude | STAFF-02 | — | Addendum §8 says make it possible later, do not prioritise now. |
| SEC-01 | Row-level security on Supabase tables | Claude | — | migration | Anon can read active products only |
| DOC-01 | Remaining `/docs` files from section 45 | Claude | — | `docs/**` | 01–19 present |

## IN PROGRESS

| ID | Description | Owner | Notes |
| --- | --- | --- | --- |
| OPS-01 | Staff order queue | Claude | Blocked on API-03 for real orders, but the shell at `/staff` is in place. |
| UI-01 | Shop + category pages | Codex | Consuming the ready API-01 contract; customer frontend only. |
| UI-02 | Product detail page | Codex | Consuming the ready API-01 contract; customer frontend only. |
| UI-03 | Guest cart page | Codex | Consuming the ready API-02 contract; customer frontend only. |
| UI-04 | Checkout, buyer/recipient | Codex | Consuming the ready API-03/API-04 contracts; customer frontend only. |

## BLOCKED

| ID | Description | Owner | Blocked on |
| --- | --- | --- | --- |
| DATA-01 | Load the real product catalogue | Owner | The shop's actual stock list — names, sizes, prices, categories. Nothing invented. |
| DATA-02 | Set the real delivery areas | Owner | **The screen is built and waiting at `/admin/delivery`.** Until at least one area exists, checkout refuses every order — a fee only comes from an area, and none were invented. Needs the suburbs actually covered and what each costs. |
| AUTH-02 | Google / Facebook sign-in | Owner | Client ID + secret from Google Cloud Console and Meta for Developers. Free, but only the owner can open those. |
| WA-01 | WhatsApp CTAs | Owner | No business number yet. `WHATSAPP_BUSINESS_NUMBER` blank keeps every CTA hidden. |
| PAY-01 | Payment provider | Owner | No provider chosen. `payments` table records without one. |

## REVIEW

| ID | Description | Owner | Notes |
| --- | --- | --- | --- |
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
| AUTH-01 | Email sign-in, role gating, admin bootstrap | Claude | Verified end to end with a real signed-in admin session on 2026-08-15. `tanakambendanata@gmail.com` holds ADMIN. |
| STAFF-01 | Staff profiles, `MM-STF-0001` numbers, promote-to-staff, admin People screen, `/staff` shell, `/account` | Claude | `db/verify-staff.mjs` — 15 DB checks; `db/verify-staff-service.mts` — 23 service checks. Promote flow also driven through the real UI with a signed-in admin. |
| API-03 | Checkout + order creation | Claude | `db/verify-orders.mts` — 30 checks incl. frozen prices, one order from a double-tap, and a failed line leaving no stock held |
| API-04 | Delivery fee by zone + `/admin/delivery` | Claude | Same script. A suburb belongs to one zone only; an uncovered suburb is refused rather than given a default fee. |
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
- **The dev database holds test data that cannot be deleted.** `order_events`
  is append-only and `audit_log` has a foreign key to `users`, so verification
  runs leave cancelled test orders and soft-deleted test accounts behind. That
  is the audit guarantee working, not a fault: you must not be able to erase
  history by deleting a row. **Reset the database before real trading begins**
  rather than trying to clean it in place.
