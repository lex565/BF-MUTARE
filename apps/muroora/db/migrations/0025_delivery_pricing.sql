-- Delivery priced by road distance, and a record of why every fee was what it was.
--
-- Implements MUSUWO_DELIVERY_PRICING_IMPLEMENTATION_HANDOFF.md, pricing
-- version `mutare-pilot-v1`, sections 1, 2, 3 and 6.
--
-- WHAT WAS THERE BEFORE, AND WHY IT IS NOT ENOUGH
--
-- `delivery_zones` prices a delivery by matching the customer's typed suburb
-- against an admin-maintained list and charging that zone's flat fee. It is a
-- reasonable model and it is how delivery is priced by people who know the
-- roads. It is not the model that was approved. The approved tariff charges by
-- ROAD DISTANCE from the merchant to the customer, which a suburb name cannot
-- express: Dangamvura is one name over several kilometres, and the same name
-- can be a two dollar trip or a six dollar trip depending on which end of it
-- the customer lives and which merchant is sending.
--
-- The zones are NOT dropped. Two reasons. They still describe where Musuwo is
-- willing to go, which is a different question from what the trip costs. And
-- both live zones are inactive placeholders, so nothing has ever been priced
-- by them - there is no history to migrate, only a model to add beside them.
--
-- WHY THE MERCHANT NEEDS COORDINATES
--
-- Road distance has two ends. `orders` has carried `delivery_latitude` and
-- `delivery_longitude` since the beginning (both always null - nothing ever
-- wrote them, because checkout collects a typed suburb and has no map pin).
-- The merchant end did not exist at all: `businesses` has a city and nothing
-- finer. Without it there is no origin to route from, so no fee can be
-- calculated for any merchant, which is why this is the first thing here.

-- No BEGIN/COMMIT here: db/apply-migration.mjs already wraps the whole file
-- in one transaction. A COMMIT inside would close ITS transaction early and
-- run everything after this point unprotected.

/* ---------------------------------------------------------------- merchant */

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS latitude   double precision,
  ADD COLUMN IF NOT EXISTS longitude  double precision,
  ADD COLUMN IF NOT EXISTS location_confirmed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS location_confirmed_by  uuid REFERENCES users(id),
  -- A merchant who does not deliver is a real and ordinary case: collection
  -- only, or a service that travels to the customer. It is the
  -- BUSINESS_NOT_DELIVERING reason code, and it must be answerable without
  -- calling a router.
  ADD COLUMN IF NOT EXISTS delivers_locally boolean NOT NULL DEFAULT true;

-- Refuse a coordinate that is not one. Zero/zero is singled out because it is
-- what an uninitialised form field looks like, and it is a real place in the
-- Gulf of Guinea, so it would route and fail rather than be rejected.
ALTER TABLE businesses
  DROP CONSTRAINT IF EXISTS businesses_location_is_a_place;
ALTER TABLE businesses
  ADD CONSTRAINT businesses_location_is_a_place CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (
      latitude BETWEEN -90 AND 90
      AND longitude BETWEEN -180 AND 180
      AND NOT (latitude = 0 AND longitude = 0)
    )
  );

COMMENT ON COLUMN businesses.latitude IS
  'Merchant pickup point, WGS84. The origin of every road-distance delivery quote.';
COMMENT ON COLUMN businesses.delivers_locally IS
  'False means collection only. Answers BUSINESS_NOT_DELIVERING without a routing call.';

/* ------------------------------------------------------------------ tariff */

-- Tariffs are VERSIONED ROWS, never edited in place.
--
-- The handoff: "Changing a tariff must create a new version; existing orders
-- retain their original immutable pricing snapshot." An UPDATE to a fee would
-- silently rewrite what every past order supposedly cost, and the first time
-- anybody noticed would be a customer holding a receipt that disagrees with
-- the system.
CREATE TABLE IF NOT EXISTS delivery_tariffs (
  version       text PRIMARY KEY,
  currency      currency NOT NULL DEFAULT 'USD',
  -- [{ "maxMetres": 2000, "feeCents": 200 }, ...] ascending, inclusive bounds.
  bands         jsonb NOT NULL,
  max_standard_metres      integer NOT NULL,
  oversize_fee_cents       integer NOT NULL DEFAULT 200,
  included_waiting_minutes integer NOT NULL DEFAULT 10,
  waiting_block_minutes    integer NOT NULL DEFAULT 10,
  waiting_block_fee_cents  integer NOT NULL DEFAULT 100,
  return_percent           integer NOT NULL DEFAULT 75,
  is_active     boolean NOT NULL DEFAULT false,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES users(id),

  CONSTRAINT delivery_tariffs_bands_is_array CHECK (jsonb_typeof(bands) = 'array'),
  CONSTRAINT delivery_tariffs_bands_not_empty CHECK (jsonb_array_length(bands) > 0),
  CONSTRAINT delivery_tariffs_range_positive CHECK (max_standard_metres > 0),
  CONSTRAINT delivery_tariffs_return_percent CHECK (return_percent BETWEEN 0 AND 100)
);

-- Exactly one active tariff, enforced rather than remembered. Two active rows
-- would make the fee depend on which one a query happened to return first.
CREATE UNIQUE INDEX IF NOT EXISTS delivery_tariffs_one_active
  ON delivery_tariffs ((true)) WHERE is_active;

INSERT INTO delivery_tariffs (
  version, currency, bands, max_standard_metres, oversize_fee_cents,
  included_waiting_minutes, waiting_block_minutes, waiting_block_fee_cents,
  return_percent, is_active, notes
) VALUES (
  'mutare-pilot-v1',
  'USD',
  '[{"maxMetres":2000,"feeCents":200},
    {"maxMetres":5000,"feeCents":300},
    {"maxMetres":10000,"feeCents":400},
    {"maxMetres":15000,"feeCents":600}]'::jsonb,
  15000, 200, 10, 10, 100, 75, true,
  'Approved for pilot implementation. Review after the first 100 completed real deliveries.'
) ON CONFLICT (version) DO NOTHING;

/* ------------------------------------------------------- reason codes enum */

-- A closed list, in the database as well as in TypeScript. These codes go into
-- analytics and into admin screens; a typo introduced later would split a
-- year of history into two categories that look like one.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'serviceability_reason') THEN
    CREATE TYPE serviceability_reason AS ENUM (
      'WITHIN_RANGE',
      'TOO_FAR',
      'NO_NETWORK_ROUTE',
      'INVALID_LOCATION',
      'BUSINESS_NOT_DELIVERING',
      'OUTSIDE_SERVICE_AREA',
      'MANUAL_QUOTE_REQUIRED'
    );
  END IF;
END $$;

/* ------------------------------------------------------------------ quotes */

-- Every quote the server issued, whether it was used or not.
--
-- The handoff requires checkout to submit a quote ID and the server to
-- revalidate it. That only means anything if the server kept its own copy: a
-- quote the client can describe but the server cannot recognise is just a
-- price the client made up.
--
-- Unserviceable quotes are stored too. "How often did we refuse, and why" is
-- the question that decides whether the 15 km limit is right, and it cannot be
-- answered from orders, because a refusal never becomes one.
CREATE TABLE IF NOT EXISTS delivery_quotes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  store_id      uuid REFERENCES stores(id),

  pricing_version text NOT NULL REFERENCES delivery_tariffs(version),
  serviceable     boolean NOT NULL,
  serviceability_reason serviceability_reason NOT NULL,

  -- Both ends of the route, as used. Kept even when unserviceable, because
  -- "which pin did we refuse" is the first question when a customer complains.
  origin_latitude       double precision,
  origin_longitude      double precision,
  destination_latitude  double precision,
  destination_longitude double precision,

  road_distance_m         integer,
  estimated_time_seconds  integer,
  routing_provider        text,
  routing_data_version    text,

  standard_fee_cents        integer,
  oversize_fee_cents        integer NOT NULL DEFAULT 0,
  promotion_subsidy_cents   integer NOT NULL DEFAULT 0,
  customer_fee_cents        integer,
  currency                  currency NOT NULL DEFAULT 'USD',
  is_heavy_or_oversized     boolean NOT NULL DEFAULT false,

  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_by_order_id uuid REFERENCES orders(id),

  -- A serviceable quote without a price is the bug this constraint exists to
  -- make impossible: it would be accepted at checkout and charge nothing.
  CONSTRAINT delivery_quotes_priced_when_serviceable CHECK (
    (serviceable AND customer_fee_cents IS NOT NULL AND road_distance_m IS NOT NULL)
    OR (NOT serviceable AND customer_fee_cents IS NULL)
  ),
  CONSTRAINT delivery_quotes_reason_matches CHECK (
    (serviceable AND serviceability_reason = 'WITHIN_RANGE')
    OR (NOT serviceable AND serviceability_reason <> 'WITHIN_RANGE')
  ),
  CONSTRAINT delivery_quotes_distance_positive CHECK (
    road_distance_m IS NULL OR road_distance_m > 0
  ),
  CONSTRAINT delivery_quotes_expiry_after_creation CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS delivery_quotes_business_idx
  ON delivery_quotes (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS delivery_quotes_reason_idx
  ON delivery_quotes (serviceability_reason, created_at DESC);
CREATE INDEX IF NOT EXISTS delivery_quotes_unconsumed_idx
  ON delivery_quotes (expires_at) WHERE consumed_at IS NULL;

/* ------------------------------------------------- the snapshot on an order */

-- Frozen at the moment of sale. Nothing recomputes these, ever.
--
-- Same principle as `orders.fx_rate_to_usd` and the denormalised recipient
-- address already on this table: what the customer was charged, and why, must
-- survive every later edit to tariffs, merchant locations and routing data.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_pricing_version text
    REFERENCES delivery_tariffs(version),
  ADD COLUMN IF NOT EXISTS delivery_quote_id uuid REFERENCES delivery_quotes(id),
  ADD COLUMN IF NOT EXISTS delivery_serviceability_reason serviceability_reason,
  ADD COLUMN IF NOT EXISTS delivery_origin_latitude  double precision,
  ADD COLUMN IF NOT EXISTS delivery_origin_longitude double precision,
  ADD COLUMN IF NOT EXISTS delivery_road_distance_m  integer,
  ADD COLUMN IF NOT EXISTS delivery_estimated_time_seconds integer,
  ADD COLUMN IF NOT EXISTS delivery_standard_fee_cents integer,
  ADD COLUMN IF NOT EXISTS delivery_oversize_fee_cents integer,
  ADD COLUMN IF NOT EXISTS delivery_promotion_subsidy_cents integer,
  ADD COLUMN IF NOT EXISTS delivery_customer_fee_cents integer,
  ADD COLUMN IF NOT EXISTS delivery_routing_provider text,
  ADD COLUMN IF NOT EXISTS delivery_routing_data_version text,
  ADD COLUMN IF NOT EXISTS delivery_quoted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_quote_expired_at timestamptz,
  -- The ZiG case the handoff calls out. Null while everything is USD, which
  -- is today, but the column exists so a rate is never applied without being
  -- recorded beside the amount it was applied to.
  ADD COLUMN IF NOT EXISTS delivery_fx_rate text,
  ADD COLUMN IF NOT EXISTS delivery_fx_rate_at timestamptz;

-- The snapshot agrees with the money column, or the order does not exist.
-- `delivery_fee_amount` is what the customer is actually billed; if the
-- snapshot says something else, one of them is a lie and there is no way to
-- tell which from the outside.
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_delivery_snapshot_agrees;
ALTER TABLE orders
  ADD CONSTRAINT orders_delivery_snapshot_agrees CHECK (
    delivery_customer_fee_cents IS NULL
    OR delivery_customer_fee_cents = delivery_fee_amount
  );

-- A quote-priced order carries the whole snapshot or none of it. Half a
-- snapshot cannot be audited and cannot be explained to a customer.
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_delivery_snapshot_complete;
ALTER TABLE orders
  ADD CONSTRAINT orders_delivery_snapshot_complete CHECK (
    delivery_quote_id IS NULL
    OR (
      delivery_pricing_version IS NOT NULL
      AND delivery_serviceability_reason IS NOT NULL
      AND delivery_road_distance_m IS NOT NULL
      AND delivery_customer_fee_cents IS NOT NULL
      AND delivery_quoted_at IS NOT NULL
    )
  );

/* -------------------------------------------------- charges after the fact */

-- Waiting, redelivery, returns and manual adjustments.
--
-- APPEND ONLY, and enforced by a rule rather than by everyone remembering.
-- These are charges raised against a customer after they agreed a price, so
-- the record of who raised one and why is the only thing standing between the
-- company and "I never agreed to that".
--
-- The trigger lessons from migrations 0021-0023 are why this is a RULE on
-- UPDATE/DELETE rather than a BEFORE trigger: a trigger that raises on DELETE
-- breaks ON DELETE CASCADE, and this table hangs off orders.
CREATE TABLE IF NOT EXISTS order_charges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  charge_type text NOT NULL,
  amount_cents integer NOT NULL,
  currency    currency NOT NULL DEFAULT 'USD',
  reason      text NOT NULL,
  -- Who decided. Null only for a charge a scheduled job raised from measured
  -- waiting time, and `actor_role` then says so.
  actor_id    uuid REFERENCES users(id),
  actor_role  text,
  -- Minutes waited, attempt number: whatever the type needs to be checked.
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT order_charges_known_type CHECK (
    charge_type IN ('WAITING', 'REDELIVERY', 'RETURN_TO_MERCHANT', 'MANUAL_ADJUSTMENT')
  ),
  -- Only a manual adjustment may be negative, and that is the whole reason it
  -- exists: a goodwill credit is an adjustment, not a negative waiting charge.
  CONSTRAINT order_charges_sign CHECK (
    charge_type = 'MANUAL_ADJUSTMENT' OR amount_cents >= 0
  ),
  CONSTRAINT order_charges_reason_given CHECK (btrim(reason) <> '')
);

CREATE INDEX IF NOT EXISTS order_charges_order_idx
  ON order_charges (order_id, created_at);

CREATE OR REPLACE RULE order_charges_no_update AS
  ON UPDATE TO order_charges DO INSTEAD NOTHING;
CREATE OR REPLACE RULE order_charges_no_delete AS
  ON DELETE TO order_charges DO INSTEAD NOTHING;

COMMENT ON TABLE order_charges IS
  'Append-only. Charges raised after checkout. Corrections are new MANUAL_ADJUSTMENT rows, never edits.';

/* ---------------------------------------------------------- service area */

-- The operating area, as configuration rather than code.
--
-- SEEDED DISABLED, ON PURPOSE. The polygon below is the envelope the QGIS
-- simulation produced, and three of its four sides are dead straight lines at
-- longitude 32.55, longitude 32.675 and latitude -19.1 - that is where the
-- national ADM2 layer was clipped, not a boundary anybody surveyed. The
-- simulation's own README says as much. The eastern cut passes roughly 400
-- metres east of the Mutare CBD, so switching it on today would refuse real
-- customers while producing a log line that reads like a correct decision.
--
-- Until a real operating area is drawn, range is enforced by the thing that
-- was actually approved: the tariff's 15 km limit. Replace `rings`, set
-- `enabled` true, and it takes effect with no deploy.
INSERT INTO platform_settings (key, value, description) VALUES (
  'delivery_service_area',
  '{
     "enabled": false,
     "name": "Mutare simulation envelope (provisional)",
     "rings": [[
       [32.55664,-18.97262],[32.56142,-18.97255],[32.56231,-18.96887],
       [32.56129,-18.96476],[32.56075,-18.96111],[32.56025,-18.9602],
       [32.56831,-18.95642],[32.58599,-18.9557],[32.60127,-18.95456],
       [32.61753,-18.95432],[32.62661,-18.95419],[32.63279,-18.95227],
       [32.64277,-18.94891],[32.65228,-18.94557],[32.65494,-18.94486],
       [32.66322,-18.94265],[32.67368,-18.93975],[32.675,-18.93959],
       [32.675,-19.1],[32.55,-19.1],[32.55,-18.97238],[32.55664,-18.97262]
     ]]
   }'::jsonb,
  'Delivery operating area. DISABLED until a surveyed boundary replaces the QGIS simulation envelope.'
) ON CONFLICT (key) DO NOTHING;

-- How long a quoted price is honoured. Long enough to finish checkout, short
-- enough that a fee cannot be held over a tariff change.
INSERT INTO platform_settings (key, value, description) VALUES (
  'delivery_quote_ttl_seconds',
  '900'::jsonb,
  'Seconds a delivery quote stays valid. Checkout revalidates expiry server-side.'
) ON CONFLICT (key) DO NOTHING;
