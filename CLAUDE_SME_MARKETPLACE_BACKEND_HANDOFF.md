# Claude handoff: Muroora SME marketplace backend and web parity

> Platform restructure: the customer-facing parent brand is now **MUSUWO**. Muroora Mart is the founding merchant/business #001 inside Musuwo. Preserve the existing database and Supabase project; do not build parallel Musuwo infrastructure.

## STOP: mandatory questions before Claude executes

Claude must read this entire handoff and audit the repository, then ask the
owner follow-up questions. **Do not edit code, create or run migrations, change
environment variables, build EAS binaries, publish an OTA update, or deploy web
changes until the owner answers.** At minimum ask:

1. Confirm Musuwo must reuse Expo owner `muroora-mart`, EAS project ID
   `1da99634-840e-4cf1-8e23-60e6cb560d68`, and the existing update URL.
2. The app now uses `zw.co.musuwo.app`. Should that remain, or must the old
   `co.muroora.mart` identifiers be restored for an in-place update? Explain
   that changing identifiers creates a separate installed/store app identity.
3. Which existing web hosting project/domain must be reused, and what public
   Musuwo domain should become the canonical website and API URL?
4. Confirm the existing Supabase project, environment, backup requirement and
   an acceptable migration/maintenance window.
5. Which first backend release is approved: product syndication only, business
   applications, merchant portal, delivery, chat, accommodation, or a specified
   combination?
6. Who provides controlled Musuwo delivery during the pilot, and should
   `ENABLE_MUSUWO_DELIVERY` be enabled while public rider applications remain
   disabled?
7. Should every existing Muroora product remain private until individually
   marked `publishToMusuwo`, or should an explicitly selected set be migrated?
8. Which payment providers are production-approved, which are test-only, and
   should checkout continue without taking payment initially?
9. Which artifact is wanted first: web preview, Android internal APK, iOS
   internal build, EAS OTA preview update, or production release?
10. Who gives final go/no-go approval and what rollback window is required?

Ask any additional questions discovered during the audit. Summarize the
answers and proposed execution plan, then request explicit approval before
starting. Do not interpret silence as approval.

The Expo app contains frontend-only marketplace previews in `apps/muroora-mobile/src/MarketplaceFlow.tsx`. The existing Next.js website now mirrors the customer/business preview at `apps/muroora/app/marketplace/MarketplacePreview.tsx` and `/marketplace`. Do not connect these screens by inventing client-side authority. The existing Muroora backend must remain the source of truth, and the same APIs/domain rules must serve web and mobile.

## Current architecture findings

- `stores`, `products`, `categories`, inventory, orders, delivery, roles, uploads, staff, riders, and audit logs are store-scoped structurally.
- Most catalogue/order services still use a single `NEXT_PUBLIC_STORE_ID`; this is not production-safe multi-merchant isolation.
- `MERCHANT` is reserved but not granted. There are no business applications, typed marketplace listings, chat, leads, contact releases, properties, benefits, or marketplace cases.
- Product-photo public storage and private staff-photo storage demonstrate the required public/private separation.
- Do not expose verification documents through public URLs or mobile payloads.

## Backend work, in order

1. Add reviewed migrations for common businesses and self-service applications with lifecycle states: DRAFT, SUBMITTED, UNDER_REVIEW, NEEDS_INFORMATION, APPROVED, PILOT, ACTIVE, PAUSED, SUSPENDED, REJECTED, INACTIVE.
2. Add capability-driven business types and configurable categories. Do not encode every SME as a grocery store.
3. Add typed listings: PRODUCT, MENU_ITEM, SERVICE, ACCOMMODATION. Reuse existing products for commerce where safe; services/properties must not inherit inventory semantics.
4. Add public business IDs (`MUR-BIZ-*`), property IDs (`MUR-P-*`) and lead IDs (`MUR-L-*`) using atomic database sequences/functions.
5. Add operator-to-many-properties modelling, private configurable verification records, reviewer audit history, and public badges whose wording matches exactly what was checked.
6. Add conversations/messages, participant authorization, reports/blocks, leads, and server-authorized contact release. Raw phone/WhatsApp fields must be omitted before a recorded release.
7. Add cases/reports with review states. Reports must not automatically suspend or imply guilt.
8. Add dated/audited partner benefits, pilot periods, plan statuses, and academic seasons. Do not connect billing or automatic renewal.
9. Add universal-search APIs returning discriminated result types with relevance-first ranking and availability/approval filtering.
10. Add merchant-scoped APIs and RLS/security tests proving Business A cannot access Business B data, contacts, analytics, messages, verification or orders.
11. Keep one merchant per checkout initially unless multi-pickup and settlement have been explicitly designed and approved.
12. Add feature flags defaulting to disabled: business applications, accommodation, services, sensitive verification, automatic approval, and paid plans. Automatic approval must remain false.
13. Add merchant-preparation and Musuwo-delivery handoff transitions. Merchants
    prepare and mark orders ready; Musuwo controls pickup, custody, assignment,
    delivery and proof. Preserve timestamps and audit events.
14. Enforce `ENABLE_PUBLIC_RIDER_NETWORK=false` and
    `ENABLE_RIDER_APPLICATIONS=false` in public endpoints—not only UI. Treat
    controlled `ENABLE_MUSUWO_DELIVERY` as a separate owner-approved flag.
15. Represent Muroora Mart as `MUR-BIZ-0001` (or the final approved atomic public-ID format) with a dated Founding Merchant benefit/badge. Existing store/product/inventory/order/staff foreign keys must remain intact.

## Mobile API contracts needed

- `GET /api/marketplace/search?q=&type=&area=`
- `GET /api/marketplace/businesses/:publicId`
- `GET /api/marketplace/listings/:publicId`
- `POST/GET /api/marketplace/business-applications`
- `POST/GET /api/marketplace/conversations` and messages
- `POST /api/marketplace/leads/:id/contact-request`
- `POST /api/marketplace/leads/:id/contact-release`
- `POST /api/marketplace/reports`
- Merchant portal endpoints for profile, listings, availability, orders/enquiries, messages and first-party metrics.

All errors must use stable codes and human-safe messages. All state-changing endpoints need server-side role/ownership checks and auditable, idempotent transitions.

## Web parity

Implement the same customer journeys in `apps/muroora`: universal discovery, category pages, typed result cards, business profiles, commerce attribution, accommodation/service detail pages, chat, gated contact request/release, reporting, and business application. Add a responsive merchant portal. Consume the shared services/APIs; do not copy preview constants from the Expo file.

The web preview shell already demonstrates these routes inside `/marketplace`. Replace its local `rows` array and alert-only actions with server/API data incrementally; retain its responsive visual language and explicit commerce-versus-enquiry distinction. Add production route metadata and indexing only after feature flags and approval filtering are enforced.

## Delivery location handoff

The Expo home header now asks for foreground permission when the user taps **Delivering to**, captures a balanced-accuracy GPS point, and reverse-geocodes a readable area. Checkout independently keeps the precise coordinate plus typed address/landmarks. Persist an authenticated user's chosen delivery label/address only after adding a server endpoint that validates coordinates and scopes saved addresses to that user. GPS must remain optional; never block checkout when permission, reverse geocoding, or Zimbabwe address coverage fails. The web client should use `navigator.geolocation` behind a user gesture and the same saved-address endpoint, with a manual address fallback. Do not continuously track customer location.

## Musuwo account modes and business workspaces

The mobile localhost preview is implemented in `apps/muroora-mobile/src/AccountModePreview.tsx`. Production must use one Musuwo authentication identity with deliberately separate **Individual Account** and **Business Account** profiles.

- Individual Account: browsing, personal checkout, orders, favourites, chats and enquiries.
- Business Account: business profile, authorized stores, listings/products, prices, stock, orders, staff and fulfilment.
- A person may hold both profiles and switch modes, but merchant authority must never be used to place a personal order.
- Opening Muroora Mart from an authorized Musuwo Business Account must reuse the current session; there is no second Muroora password or auth system.
- Add a server-resolved workspace endpoint returning only business memberships the current user may access. Every business route/action must re-check membership and permission server-side rather than trusting a selected client business ID.
- Keep platform roles distinct from business roles. `MUSUWO_ADMIN` does not silently become every merchant's business admin, and a Muroora business admin does not become a Musuwo platform admin.
- The legacy mobile `AdminFlow` is now visibly branded **Musuwo Platform Admin**, but its current payload still contains legacy single-store operational data. Split that backend/UI responsibility: move products, prices, stock, store orders, staff and fulfilment into the selected Muroora Mart Business Workspace. Musuwo Platform Admin should manage businesses, applications, categories, verification, safety/cases, benefits/plans, platform search/configuration and pre-launch delivery governance.
- Do not merely rename legacy Muroora admin endpoints. Introduce business-scoped merchant endpoints and platform-scoped Musuwo admin endpoints with different authorization policies and tests.
- Muroora Mart should appear as `MUR-BIZ-0001`, Founding Merchant, and expose a business workspace to authorized memberships without migrating or duplicating its existing products, inventory, staff or orders.

The preview displays an initial **Musuwo Business Score 4.5**, explicitly labelled `Launch assessment · no customer reviews yet`. Implement this as a versioned platform assessment with stored components/source and auditability—not as fabricated customer reviews. Merchants cannot edit the score. Any admin override requires a reason and audit log. Later scoring may use profile completeness, verification, listing quality, photo coverage, stock reliability, fulfilment performance, response performance and verified reviews, with consistent rules across businesses.

Delivery attribution for the current product direction is:

- Sold by: Muroora Mart
- Prepared/fulfilled from: Muroora Mart
- Delivery experience coordinated through: Musuwo
- Independent public Musuwo rider network: Coming Soon

Do not make the last line contradictory: coordination may use business-managed fulfilment during the pilot and must not imply a live independent rider marketplace.

## Pilot exclusions

No automatic merchant approval, rent/deposit payments, escrow, recurring billing, facial recognition, paid sponsored ranking, automatic contact release, permanent early-partner ranking advantage, or expensive external service.

Public rider recruitment and open rider registration are excluded. Musuwo may
still provide controlled marketplace delivery after operational approval; this
does not make public rider applications live.

## Brand and route replacement notes

- Platform shell/logo: Musuwo. Supplied asset is `Musowo.png`, copied to web `public/musuwo-logo.png` and mobile `assets/musuwo-logo.png`.
- Merchant/store surfaces: Muroora Mart and its existing logo.
- Web `/` is the Musuwo marketplace preview; `/stores/muroora-mart` is the founding merchant storefront; `/riders` is Coming Soon.
- Mobile marketplace/account shell says Musuwo; catalogue, cart, checkout, staff and fulfilment remain attributed to Muroora Mart where applicable.
- Preserve compatibility for existing `/shop`, `/product/*`, `/cart`, `/checkout`, `/account`, `/staff` and admin links while introducing canonical platform routes incrementally.

## Acceptance/security tests

Cover every test in sections 78–79 of `MUROORA_SME_MARKETPLACE_EXPANSION_CODEX_PROMPT.txt`, especially cross-business isolation, hidden contact retrieval, private verification access, unapproved visibility, contact-release auditing, accommodation payment exclusion, one-merchant checkout, and regression of Muroora Mart/staff/rider/order flows.

The Expo previews intentionally use clearly labelled sample entries and no persistent actions. Replace them with live API data only after the corresponding authorization and isolation tests pass.
# Musuwo homepage business carousel (Codex preview)

The Musuwo web homepage now mirrors the established Muroora visual system and
contains a business carousel seeded with Muroora Mart. The preview seed lives
in `apps/muroora/app/components/marketplace/MusuwoHomeShell.tsx`.

Backend work for Claude:

- Add a public marketplace-businesses endpoint returning only businesses whose
  registration has been reviewed and whose publication status is `ACTIVE`.
- Return `id`, `slug`, `name`, `summary`, `category`, `city`, `logoUrl`,
  `businessScore`, `isFoundingBusiness`, and `storefrontUrl`.
- Replace `INITIAL_BUSINESSES` with that endpoint's result, keeping Muroora Mart
  as the first founding business. Never publish draft, rejected, suspended, or
  merely registered accounts.
- Revalidate/invalidate the public business feed when an administrator approves
  a business. The client carousel should therefore gain the business on its
  next fetch without a frontend deployment.
- Preserve the current five-second auto-advance, manual dots, accessible label,
  and graceful single-business state.
- Use the same approved-business/category response for both Next.js and Expo.
  When the first approved Housing business is published, for example, Housing
  and that business logo must appear on both clients without a new build.
- The combined `/shop` catalogue must return products with merchant ownership
  and show only active products from approved businesses. At launch that means
  the customer sees only real Muroora Mart inventory, without revealing or
  implying that the platform has only one merchant.
- Persist checkout context as `LOCAL`, `DIASPORA_SELF`, or
  `DIASPORA_TO_LOCAL`. Use it to drive recipient/address validation and do not
  ask again later in the same checkout. Contact data should come from the
  authenticated profile where it already exists.

## Merchant product syndication into Musuwo

Muroora's personalized storefront and Musuwo's marketplace catalogue are now
separate surfaces. `/stores/muroora-mart/shop` reads Muroora's own active
catalogue; `/shop` and `/api/marketplace/products` intentionally contain no
products until syndication is implemented.

- Add an explicit per-product `publishToMusuwo` flag plus publication status,
  timestamps and the staff user who changed it. A product being active on the
  merchant's own site must not silently imply marketplace consent.
- Musuwo reads the same canonical product row rather than a copied product.
  Name, price, unit size, image, stock and description updates made by Muroora
  therefore flow to Musuwo immediately while publication remains enabled.
- `GET /api/marketplace/products` returns only products from approved, active
  businesses where the product is active and `publishToMusuwo=true`. Include
  merchant name, slug, logo, short description and personalized storefront URL.
- Musuwo product detail must show brief merchant attribution and an optional
  “About Muroora” storefront link. Add-to-cart, payment, order and checkout all
  remain Musuwo routes and must not redirect into the merchant website.
- Apply the identical endpoint and rules to Expo so web and app never disagree.
- A business suspension or unpublishing action must remove its products from
  Musuwo promptly without deleting the merchant's canonical catalogue data.

## Authoritative backend and delivery instructions

This section supersedes any older line in this file that says Muroora owns
delivery or that `ENABLE_MUSUWO_DELIVERY` must always be false. The current
approved rule is: **Musuwo owns eligible marketplace delivery; the chosen
merchant remains the dominant customer-facing brand; public rider recruitment
remains Coming Soon.**

After the mandatory questions have been answered and the owner approves the
plan, Claude must:

1. Audit schema, migration history, RLS, services, API routes, environment
   variables, EAS linkage and deployed web configuration. Report each relevant
   feature as IMPLEMENTED, PARTIAL, NOT IMPLEMENTED or NEEDS REVIEW before edits.
2. Confirm a recoverable database backup, current migration head and deployed
   commit. Use reviewed forward migrations; never use `db:push` in production.
3. Preserve the current Supabase project and canonical Muroora rows/IDs. Add
   business profiles, memberships, approval lifecycle and merchant branding
   without copying products, inventory, customers, orders or delivery records.
4. Add RLS and server authorization first. Resolve user/business membership on
   the server and prove Business A cannot access Business B data. Never trust a
   client-supplied business, merchant, rider or admin ID as authority.
5. Implement audited per-product `publishToMusuwo` consent. Musuwo reads the
   canonical product, inventory, price, image and description so approved
   Muroora edits propagate immediately while publication remains enabled.
6. Replace the temporary empty `GET /api/marketplace/products` response with
   active products from active approved businesses where publication consent is
   enabled. Keep the neutral empty array contract: web/mobile already remove
   “Nothing to show for now” as soon as products are returned.
7. Return merchant name, slug, logo, summary and storefront URL with products.
   Musuwo product detail may link to “About Muroora,” but cart, payment, checkout
   and order creation stay inside Musuwo. Keep one merchant per checkout.
8. Implement one shared business/category feed for Next and Expo. Newly approved
   businesses/categories/logos must appear without a new client build. Draft,
   rejected, paused, suspended or merely registered businesses stay private.
9. Persist checkout context as `LOCAL`, `DIASPORA_SELF` or
   `DIASPORA_TO_LOCAL`. Reuse authenticated contact fields; ask recipient fields
   only when needed. GPS remains optional and typed Zimbabwe addresses and
   landmarks remain supported.
10. Implement merchant fulfilment and Musuwo handoff states:
    ORDER_RECEIVED, PREPARING, READY_FOR_MUSUWO_COLLECTION, HANDOVER_STARTED,
    IN_MUSUWO_CUSTODY, OUT_FOR_DELIVERY, DELIVERED and CUSTODY_CLOSED. Preserve
    custody evidence, OTP/proof of delivery, incident handling and audit events.
11. Keep `ENABLE_PUBLIC_RIDER_NETWORK=false` and
    `ENABLE_RIDER_APPLICATIONS=false`. Treat `ENABLE_MUSUWO_DELIVERY` separately;
    enable it only for approved controlled/internal capacity after tests and
    owner confirmation. Merchant staff cannot assign or impersonate riders.
12. Make merchant logo/name/colours dominant on customer tracking. Show
    “Delivery coordinated by Musuwo” only as secondary operational attribution.
13. Run migration, unit, integration, RLS, cross-merchant, publication,
    checkout, custody, web and mobile contract tests. Seed no invented public
    users, businesses, products, prices, reviews or orders.
14. Deliver a migration report, security-test evidence, API contract summary,
    unresolved-risk list and rollback instructions. Ask for deployment approval
    and wait.

## Authoritative deployment instructions: reuse the Muroora locations

Do not create another Expo/EAS project, Supabase project, web backend or auth
system. The existing Expo project is already linked:

- Expo owner: `muroora-mart`
- EAS project ID: `1da99634-840e-4cf1-8e23-60e6cb560d68`
- Updates URL: `https://u.expo.dev/1da99634-840e-4cf1-8e23-60e6cb560d68`
- App name/slug: `Musuwo` / `musuwo`

After the owner answers the native-identifier question, deploy in this order:

1. Run `eas whoami` and `eas project:info` to verify the current account and
   project. **Do not run `eas init` and do not accept a new project ID.**
2. Verify preview/production EAS environment variables without printing secret
   values. Mobile receives only API URL, Supabase URL and anon key. Database
   URLs, service-role keys and payment secrets remain server-only.
3. Apply reviewed migrations to preview/staging first. Run RLS, isolation,
   publication, checkout and custody tests there.
4. Deploy the existing Next application/backend to the same hosting project
   previously used for Muroora, using the owner-confirmed Musuwo domain/API URL.
   Reuse Supabase auth and update allowed redirect URLs instead of duplicating it.
5. Smoke-test `/`, `/shop`, `/access`, `/marketplace`, the Muroora storefront,
   authentication, cart, checkout, merchant workspace and platform admin.
   Confirm unpublished products and unapproved businesses remain hidden.
6. Point the EAS preview environment to that backend. Build an Android internal
   APK with `eas build --platform android --profile preview`. Build iOS only when
   Apple signing/provisioning access is confirmed.
7. On real devices test the installed icon, splash, login modes, location
   fallback, empty catalogue, published-product appearance, merchant attribution,
   checkout, handoff, tracking and rollback. Expo Go/web is not proof of native
   splash, signing or push/OTA correctness.
8. Present build URLs, test results and known risks. Wait for explicit production
   go/no-go approval.
9. Only after approval, apply the production migration, deploy the existing web
   project, publish/build through the same EAS project and monitor API errors,
   auth, orders, custody and delivery transitions.
10. If acceptance checks fail, stop rollout, disable the new feature flags and
    follow the documented rollback/forward-fix procedure. Never delete Muroora
    data or create a replacement production project as a shortcut.
