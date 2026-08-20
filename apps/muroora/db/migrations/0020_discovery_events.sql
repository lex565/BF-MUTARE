-- The discovery and analytics foundation: events, daily rollups, search log.
--
-- WHAT THIS IS FOR
--
-- The For You feed has to rank products by how they actually perform, and
-- merchants have to be able to see that performance for their own products.
-- Neither is possible today: the only behavioural table on the platform is
-- `marketplace_product_views`, which records a signed-in customer opening a
-- product and nothing else.
--
-- That table is NOT replaced. It is kept exactly as it is, because it is the
-- only history that exists and because it feeds `listRecommendedProducts`.
-- What follows sits beside it.
--
-- THE ONE DISTINCTION THIS FILE EXISTS TO ENFORCE
--
-- An IMPRESSION is "this product was meaningfully visible in somebody's feed".
-- A VIEW is "somebody chose to open it". They are different events, they are
-- worth different amounts, and conflating them is how a feed learns to
-- promote whatever it already shows most. They are separate values of
-- `product_event_type` and there is no code path that turns one into the
-- other.
--
-- WHY EVENTS AND ROLLUPS BOTH
--
-- Ranking a feed cannot aggregate raw events per card render, and a merchant
-- analytics page cannot scan a year of rows to draw one number. So raw events
-- are written once and never updated, and `product_analytics_daily` /
-- `merchant_analytics_daily` hold the pre-aggregated day totals the feed and
-- the studio read. The rollup is derivable from the events at any time, which
-- means a bug in the rollup is recoverable and a bug in the events is not.
--
-- WHY business_id IS DENORMALISED ONTO EVERY EVENT
--
-- Merchant isolation is the reason. Every question a merchant may ask is
-- "my products only", and resolving that through products -> stores ->
-- businesses on every read is both slow and easy to get wrong once. Carrying
-- the owning business on the row makes the scope a column filter, and makes
-- the eventual RLS policy a one-line predicate rather than a join.
--
-- WHY `excluded_reason` RATHER THAN DELETING JUNK
--
-- Section 16 of the brief asks for protection against refresh inflation,
-- rerender impressions, merchant self-views and admin previews. The row is
-- still written, with a reason, and the rollup ignores it. Deleting it would
-- destroy the evidence that the filter is working, and the first question
-- anybody asks about an analytics number is "what did you throw away".

-- ------------------------------------------------------------------- enums

CREATE TYPE "product_event_type" AS ENUM (
  'PRODUCT_IMPRESSION',
  'PRODUCT_VIEW',
  'STORE_VISIT',
  'ADD_TO_CART',
  'REMOVE_FROM_CART',
  'CHECKOUT_STARTED',
  'ORDER_COMPLETED',
  'PRODUCT_SHARED',
  'SEARCH_RESULT_CLICKED'
);--> statement-breakpoint

-- Where the customer was when it happened. This is what makes section 19's
-- "traffic sources" and section 18's "store discovery generated" answerable.
CREATE TYPE "discovery_surface" AS ENUM (
  'FOR_YOU',
  'SEARCH',
  'STOREFRONT',
  'CATEGORY',
  'SHARED_LINK',
  'DIRECT',
  'MOBILE_APP',
  'OTHER'
);--> statement-breakpoint

-- ------------------------------------------------------------------ events

CREATE TABLE "product_events" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_type"    "product_event_type" NOT NULL,
  "surface"       "discovery_surface" NOT NULL DEFAULT 'OTHER',

  -- Null for a STORE_VISIT that did not come through a product.
  "product_id"    uuid REFERENCES "products"("id") ON DELETE CASCADE,
  -- Never null. Every event belongs to exactly one merchant.
  "business_id"   uuid NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,

  -- The product the customer came through, for STORE_VISIT. This single
  -- column is the whole of "store discovery generated": it answers "how many
  -- people entered this shop because of this item".
  "entry_product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL,

  -- Null for anonymous browsing, which stays legitimate and untracked by
  -- identity. The session id is a rotating opaque value, not a person.
  "user_id"       uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "session_id"    text NOT NULL,

  -- Set when the event is real but must not count. NULL means it counts.
  "excluded_reason" text,

  "occurred_at"   timestamptz NOT NULL DEFAULT now(),
  "metadata"      jsonb
);--> statement-breakpoint

-- Deduplication.
--
-- The key is computed on the server from session + product + event type +
-- a time bucket, so the same card scrolling back into view, a React rerender,
-- a double-fired tap and a page refresh all collapse onto one row. It is
-- UNIQUE, which means the database is what enforces it rather than the
-- application remembering to check. An insert that loses the race is
-- discarded with ON CONFLICT DO NOTHING, not retried.
--
-- Nullable, because ORDER_COMPLETED must never be deduplicated: two genuine
-- orders for the same product in the same minute are two orders.
ALTER TABLE "product_events" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "product_events_dedupe_uniq"
  ON "product_events" ("dedupe_key") WHERE "dedupe_key" IS NOT NULL;--> statement-breakpoint

-- Per-product rollup queries, which is the merchant studio's hot path.
CREATE INDEX "product_events_product_idx"
  ON "product_events" ("product_id", "event_type", "occurred_at");--> statement-breakpoint

-- Per-merchant rollup and the isolation predicate.
CREATE INDEX "product_events_business_idx"
  ON "product_events" ("business_id", "occurred_at");--> statement-breakpoint

-- "Which products brought people into this shop", section 18.
CREATE INDEX "product_events_entry_idx"
  ON "product_events" ("entry_product_id") WHERE "entry_product_id" IS NOT NULL;--> statement-breakpoint

-- Append only, like audit_log and order_events. An analytics row that can be
-- edited is not evidence of anything, and the ranking reads these.
CREATE TRIGGER "product_events_append_only"
  BEFORE UPDATE OR DELETE ON "product_events"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();--> statement-breakpoint

-- --------------------------------------------------------- daily rollups

CREATE TABLE "product_analytics_daily" (
  "product_id"     uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "business_id"    uuid NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
  "day"            date NOT NULL,

  "impressions"    integer NOT NULL DEFAULT 0,
  "views"          integer NOT NULL DEFAULT 0,
  -- Distinct sessions that opened it, which is the number a merchant actually
  -- means by "how many people". Always <= views.
  "unique_viewers" integer NOT NULL DEFAULT 0,
  "add_to_cart"    integer NOT NULL DEFAULT 0,
  "orders"         integer NOT NULL DEFAULT 0,
  "shares"         integer NOT NULL DEFAULT 0,
  -- Store visits this product acted as the doorway for.
  "store_entries"  integer NOT NULL DEFAULT 0,
  "revenue_amount" bigint NOT NULL DEFAULT 0,
  "revenue_currency" "currency" NOT NULL DEFAULT 'USD',

  "computed_at"    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("product_id", "day")
);--> statement-breakpoint

CREATE INDEX "product_daily_business_idx"
  ON "product_analytics_daily" ("business_id", "day");--> statement-breakpoint

CREATE TABLE "merchant_analytics_daily" (
  "business_id"    uuid NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
  "day"            date NOT NULL,

  "store_visits"   integer NOT NULL DEFAULT 0,
  "unique_visitors" integer NOT NULL DEFAULT 0,
  "impressions"    integer NOT NULL DEFAULT 0,
  "views"          integer NOT NULL DEFAULT 0,
  "add_to_cart"    integer NOT NULL DEFAULT 0,
  "orders"         integer NOT NULL DEFAULT 0,
  "revenue_amount" bigint NOT NULL DEFAULT 0,
  "revenue_currency" "currency" NOT NULL DEFAULT 'USD',

  "computed_at"    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("business_id", "day")
);--> statement-breakpoint

-- --------------------------------------------------------------- searches
--
-- Section 32 asks for "searches with low supply" - the report that tells
-- Musuwo what Mutare is asking for and no merchant is selling. That report is
-- impossible without writing the queries down, and search is currently a
-- browser-side filter that leaves no trace at all.
--
-- The normalised column is what gets grouped; the raw one is kept because
-- normalising is lossy and the first time the report looks wrong, the raw
-- text is the only way to find out why.

CREATE TABLE "search_queries" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "query_raw"    text NOT NULL,
  "query_normalised" text NOT NULL,
  "result_count" integer NOT NULL,
  "surface"      "discovery_surface" NOT NULL DEFAULT 'SEARCH',
  "user_id"      uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "session_id"   text NOT NULL,
  "occurred_at"  timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX "search_queries_normalised_idx"
  ON "search_queries" ("query_normalised", "occurred_at");--> statement-breakpoint

-- The market-gap query: what people asked for and did not find.
CREATE INDEX "search_queries_empty_idx"
  ON "search_queries" ("query_normalised") WHERE "result_count" = 0;--> statement-breakpoint

-- ------------------------------------------------------- the feed predicate
--
-- The exact shape of the For You candidate query, as a partial index. A plain
-- index on (store_id, is_active) already exists; this one additionally carries
-- the marketplace consent flag and excludes deleted rows, so the feed never
-- touches a row it cannot use.

CREATE INDEX "products_musuwo_feed_idx"
  ON "products" ("store_id", "publish_to_musuwo", "is_active")
  WHERE "deleted_at" IS NULL AND "publish_to_musuwo" = true;--> statement-breakpoint

-- ------------------------------------------------------------------- RLS
--
-- Same posture as every other table on this platform: enabled, no policies,
-- which denies PostgREST entirely. The application reads these as `postgres`.
--
-- These four tables are the reason the merchant-to-merchant question in the
-- brief stops being theoretical: revenue and conversion are exactly what one
-- merchant must never read about another. Enabling RLS here means that even
-- if a future client is given a direct Supabase handle, the default is no.

ALTER TABLE "product_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_analytics_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "merchant_analytics_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "search_queries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- --------------------------------------------------- ranking configuration
--
-- Section 12: no magic numbers scattered through the code. Every weight the
-- feed uses lives here, so the owner can retune the marketplace without a
-- deploy, and every change is one auditable row.

INSERT INTO "platform_settings" ("key", "value", "description") VALUES
  ('feed_weight_interest',    '30', 'How much a customer''s own history counts towards a product''s score.'),
  ('feed_weight_performance', '25', 'How much views, cart adds and orders count.'),
  ('feed_weight_freshness',   '15', 'How much being recently listed counts.'),
  ('feed_weight_merchant',    '10', 'How much the merchant''s order-completion record counts.'),
  ('feed_weight_exploration', '20', 'The controlled boost new products and new merchants receive.'),
  ('feed_exploration_days',   '21', 'How long a product counts as new for the exploration bonus.'),
  ('feed_max_consecutive_per_merchant', '2', 'Most items one merchant may occupy in a row in For You.'),
  ('feed_page_size',          '24', 'Products per For You page.'),
  ('feed_impression_dedupe_minutes', '30', 'Within this window, the same session seeing the same card again is not a new impression.')
ON CONFLICT ("key") DO NOTHING;
