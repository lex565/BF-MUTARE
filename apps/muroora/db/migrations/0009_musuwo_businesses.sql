-- Musuwo marketplace foundation: businesses, memberships, and product consent.
--
-- Muroora Mart stops being the whole product and becomes merchant one inside
-- Musuwo. This is a layer ABOVE the existing system, not a replacement. No
-- product, order, staff or inventory row is copied, moved or rewritten; the
-- existing `stores` row keeps its id and everything keeps pointing at it.
--
-- WHAT IS DELIBERATELY NOT HERE
--
-- Listings, chat, leads, contact release, cases, benefits and plans are all in
-- the brief and all absent. They depend on businesses and memberships existing
-- first, and shipping them together would mean none of it could be reviewed.
--
-- THE TWO RULES THIS FILE EXISTS TO MAKE STRUCTURAL
--
-- 1. A business must be APPROVED and ACTIVE before the public can see it.
--    Draft, submitted, rejected, paused and suspended businesses stay private.
--
-- 2. A product being active on its merchant's own storefront does NOT mean it
--    may appear on Musuwo. That is separate, explicit, per-product consent
--    with an audit trail, because publishing somebody's catalogue to a
--    marketplace they did not agree to is a decision, not a default.

/* ------------------------------------------------------------ lifecycle */

CREATE TYPE "business_status" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'NEEDS_INFORMATION',
  'APPROVED',
  'PILOT',
  'ACTIVE',
  'PAUSED',
  'SUSPENDED',
  'REJECTED',
  'INACTIVE'
);--> statement-breakpoint

-- What a business DOES, so the platform is not modelled as if every SME is a
-- grocer. A restaurant has a menu, a lodge has rooms, a mechanic has services.
CREATE TYPE "business_kind" AS ENUM (
  'RETAIL',
  'FOOD',
  'ACCOMMODATION',
  'SERVICE',
  'OTHER'
);--> statement-breakpoint

-- What somebody may do INSIDE one business. Deliberately not the `role` enum:
-- platform authority and business authority are different things, and reusing
-- one enum is how a Musuwo admin quietly becomes every merchant's admin.
CREATE TYPE "business_member_role" AS ENUM (
  'BUSINESS_OWNER',
  'BUSINESS_ADMIN',
  'BUSINESS_STAFF',
  'BUSINESS_VIEWER'
);--> statement-breakpoint

/* ------------------------------------------------------------ public ids */

-- Atomic, like next_staff_number(). Two applications approved in the same
-- second must not collide, and counting rows to derive the next number is
-- exactly the race that produces duplicates.
CREATE SEQUENCE IF NOT EXISTS business_public_id_seq START WITH 1 INCREMENT BY 1;--> statement-breakpoint

CREATE OR REPLACE FUNCTION next_business_public_id() RETURNS text AS $$
  SELECT 'MUR-BIZ-' || lpad(nextval('business_public_id_seq')::text, 4, '0');
$$ LANGUAGE sql VOLATILE;--> statement-breakpoint

/* ------------------------------------------------------------ businesses */

CREATE TABLE "businesses" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "public_id"       text NOT NULL UNIQUE DEFAULT next_business_public_id(),

  -- The merchant's own shop, when it has one. Muroora Mart points at the
  -- existing stores row, so its catalogue is reachable without duplication.
  -- Null for a business that only ever lists on Musuwo.
  "store_id"        uuid REFERENCES "stores"("id"),

  "name"            text NOT NULL,
  "slug"            text NOT NULL UNIQUE,
  "summary"         text,
  "kind"            "business_kind" NOT NULL DEFAULT 'RETAIL',
  "status"          "business_status" NOT NULL DEFAULT 'DRAFT',

  "city"            text NOT NULL DEFAULT 'Mutare',
  "logo_path"       text,

  -- Contact details are NOT public. They are released deliberately and the
  -- release is recorded, so raw numbers must be omitted from public payloads.
  "contact_phone"   text,
  "contact_email"   text,

  -- Muroora Mart. A badge with a date behind it, not a marketing adjective.
  "is_founding"     boolean NOT NULL DEFAULT false,
  "founded_at"      timestamptz,

  -- Who reviewed it, and when. An approval with nobody's name against it is
  -- not an approval.
  "reviewed_by"     uuid REFERENCES "users"("id"),
  "reviewed_at"     timestamptz,
  "review_note"     text,

  "created_by"      uuid REFERENCES "users"("id"),
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  "updated_at"      timestamptz NOT NULL DEFAULT now(),
  "deleted_at"      timestamptz
);--> statement-breakpoint

-- One business per store. Two businesses claiming the same catalogue would
-- make "who may edit this product" unanswerable.
CREATE UNIQUE INDEX "businesses_store_unique"
  ON "businesses"("store_id") WHERE "store_id" IS NOT NULL;--> statement-breakpoint

CREATE INDEX "businesses_status_idx" ON "businesses"("status");--> statement-breakpoint

-- An approved business must carry its reviewer. Enforced rather than trusted,
-- because this is the audit question somebody will eventually ask.
ALTER TABLE "businesses"
  ADD CONSTRAINT "businesses_reviewed_when_approved"
  CHECK (
    "status" NOT IN ('APPROVED','PILOT','ACTIVE')
    OR ("reviewed_by" IS NOT NULL AND "reviewed_at" IS NOT NULL)
  );--> statement-breakpoint

/* ---------------------------------------------------------- memberships */

-- WHO MAY ACT FOR A BUSINESS. This table is the entire isolation boundary.
--
-- Every business-scoped route must resolve membership from here on the SERVER,
-- against the signed-in user. A business id arriving from a client is a
-- request, never a permission.
CREATE TABLE "business_memberships" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "business_id"  uuid NOT NULL REFERENCES "businesses"("id") ON DELETE CASCADE,
  "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role"         "business_member_role" NOT NULL,
  "granted_by"   uuid REFERENCES "users"("id"),
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "updated_at"   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "business_memberships_unique" UNIQUE ("business_id","user_id","role")
);--> statement-breakpoint

CREATE INDEX "business_memberships_user_idx" ON "business_memberships"("user_id");--> statement-breakpoint
CREATE INDEX "business_memberships_business_idx" ON "business_memberships"("business_id");--> statement-breakpoint

/* --------------------------------------------------------- applications */

-- Somebody asking to join the marketplace. Kept apart from `businesses` so a
-- rejected application never leaves a half-real business behind.
CREATE TABLE "business_applications" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "business_id"    uuid REFERENCES "businesses"("id"),
  "applicant_id"   uuid NOT NULL REFERENCES "users"("id"),
  "business_name"  text NOT NULL,
  "kind"           "business_kind" NOT NULL DEFAULT 'RETAIL',
  "city"           text NOT NULL DEFAULT 'Mutare',
  "contact_phone"  text,
  "contact_email"  text,
  "note"           text,
  "status"         "business_status" NOT NULL DEFAULT 'SUBMITTED',
  "reviewed_by"    uuid REFERENCES "users"("id"),
  "reviewed_at"    timestamptz,
  "review_note"    text,
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX "business_applications_status_idx" ON "business_applications"("status");--> statement-breakpoint
CREATE INDEX "business_applications_applicant_idx" ON "business_applications"("applicant_id");--> statement-breakpoint

/* ------------------------------------------------- per-product consent */

-- THE CONSENT FLAG. Default false, and it must stay false.
--
-- Every product that already exists was created for Muroora's own shop, by
-- people who were never asked about a marketplace. Defaulting this to true
-- would publish all of it retroactively on the strength of an assumption.
ALTER TABLE "products"
  ADD COLUMN "publish_to_musuwo" boolean NOT NULL DEFAULT false,
  ADD COLUMN "published_to_musuwo_at" timestamptz,
  ADD COLUMN "published_to_musuwo_by" uuid REFERENCES "users"("id");--> statement-breakpoint

-- Consent must carry who gave it and when, or it is not auditable.
ALTER TABLE "products"
  ADD CONSTRAINT "products_musuwo_publication_audited"
  CHECK (
    "publish_to_musuwo" = false
    OR ("published_to_musuwo_at" IS NOT NULL AND "published_to_musuwo_by" IS NOT NULL)
  );--> statement-breakpoint

CREATE INDEX "products_musuwo_idx"
  ON "products"("publish_to_musuwo") WHERE "publish_to_musuwo" = true;--> statement-breakpoint

/* ------------------------------------------------------------------ RLS */

-- Same reasoning as 0008: RLS on, no policies, deny-all to the public anon
-- key. The application connects as the table owner and is unaffected.
-- NEVER add FORCE ROW LEVEL SECURITY here.
ALTER TABLE "businesses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "business_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "business_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

/* ------------------------------------------------- Muroora Mart as MUR-BIZ-0001 */

-- The founding merchant, pointed at the EXISTING store row. Nothing is copied.
-- Self-reviewed by definition: it predates the review process it is being
-- entered into, and the constraint above requires a reviewer for ACTIVE.
INSERT INTO "businesses" (
  "store_id", "name", "slug", "summary", "kind", "status", "city",
  "is_founding", "founded_at", "reviewed_by", "reviewed_at", "review_note"
)
SELECT
  s."id",
  s."name",
  s."slug",
  'Groceries and household essentials in Mutare, with a diaspora shopping programme for families abroad.',
  'RETAIL',
  'ACTIVE',
  s."city",
  true,
  s."created_at",
  (SELECT u."id" FROM "users" u
     JOIN "user_roles" r ON r."user_id" = u."id"
    WHERE r."role" = 'SUPER_ADMIN' AND u."deleted_at" IS NULL
    ORDER BY u."created_at" ASC LIMIT 1),
  now(),
  'Founding merchant. Predates the marketplace application process.'
FROM "stores" s
WHERE s."slug" = 'muroora-mart'
  AND NOT EXISTS (SELECT 1 FROM "businesses" b WHERE b."store_id" = s."id");--> statement-breakpoint

-- Everyone who already holds ADMIN or SUPER_ADMIN on the store becomes an
-- owner of the founding business. Without this the business exists and nobody
-- can administer it.
INSERT INTO "business_memberships" ("business_id", "user_id", "role")
SELECT b."id", r."user_id", 'BUSINESS_OWNER'
  FROM "businesses" b
  JOIN "user_roles" r ON r."store_id" = b."store_id"
 WHERE b."is_founding" = true
   AND r."role" IN ('ADMIN','SUPER_ADMIN')
ON CONFLICT ON CONSTRAINT "business_memberships_unique" DO NOTHING;
