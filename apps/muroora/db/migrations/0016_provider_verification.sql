-- Provider types, six separate verification states, and drafts you can save.
--
-- THE THREE RULES THIS FILE EXISTS TO MAKE STRUCTURAL
--
--   STARTING an application must be easy. Somebody who does not yet have a
--   utility bill in their own name should still be able to begin, look at what
--   is needed, and come back. Today the form is submit-or-nothing, so a person
--   without every document simply leaves.
--
--   SUBMITTING must be impossible until the mandatory items for THAT provider
--   type are present. Not discouraged in the interface - impossible, checked on
--   the server, because the interface is the half an attacker skips.
--
--   OPERATING still requires a human at Musuwo to approve. Unchanged.
--
-- WHY PROVIDER TYPE IS NOT THE SAME AS CATEGORY, and why they get separate
-- columns: a woman selling sadza from her kitchen and a registered restaurant
-- company are both FOOD, and asking them for the same documents is either
-- pointless for one or negligent for the other. The type decides what is
-- required; the category decides where they appear.
--
-- SIX VERIFICATION STATES, NOT ONE BOOLEAN. §13 of the brief is explicit and
-- it is right: "verified" collapsing identity, address, premises and company
-- registration into a single tick means a customer cannot tell what was
-- actually checked, and a reviewer cannot record that they checked one thing
-- and not another. 0013 added a single `verified_at` for business licences;
-- that stays and becomes one of the six rather than standing for all of them.

/* --------------------------------------------------------- provider type */

CREATE TYPE "provider_type" AS ENUM (
  -- One person trading as themselves. The heaviest identity requirements,
  -- because there is no company behind them to be accountable.
  'INDIVIDUAL_SELLER',
  -- A real trading business without formal registration. Very common here and
  -- deliberately NOT treated as suspicious: informal does not mean anonymous.
  'INFORMAL_BUSINESS',
  -- Registered company or partnership. Certificate replaces some personal
  -- evidence, because the register is the accountability.
  'REGISTERED_BUSINESS',
  -- Tutors, plumbers, hairdressers. Identity matters more than premises.
  'SERVICE_PROVIDER',
  -- Rooms and boarding houses. The only type where the PROPERTY is checked.
  'ACCOMMODATION_PROVIDER'
);

/* ------------------------------------------------- more categories (§4) */

ALTER TYPE "business_kind" ADD VALUE IF NOT EXISTS 'ELECTRONICS';
ALTER TYPE "business_kind" ADD VALUE IF NOT EXISTS 'BOOKS';

/* ------------------------------------------- what an application carries */

ALTER TABLE "business_applications"
  ADD COLUMN IF NOT EXISTS "provider_type"        "provider_type",

  -- Identity. The NUMBER is stored so a reviewer can check it against the
  -- document; it is never selected into anything public. The images live in a
  -- private bucket and only their paths are here.
  ADD COLUMN IF NOT EXISTS "legal_name"           text,
  ADD COLUMN IF NOT EXISTS "id_type"              text,
  ADD COLUMN IF NOT EXISTS "id_number"            text,

  -- Address. "Address verification", never "proof of residence" - the
  -- applicant may rent, live with family, or be in student accommodation, and
  -- implying ownership would exclude most of the people this is for.
  ADD COLUMN IF NOT EXISTS "residential_address"  text,
  ADD COLUMN IF NOT EXISTS "address_evidence_type" text,

  -- Where they actually trade from, which is often NOT where they live.
  ADD COLUMN IF NOT EXISTS "operating_area"       text,

  -- Registered businesses only.
  ADD COLUMN IF NOT EXISTS "registration_number"  text,

  -- Set the moment the applicant first saves. Distinguishes "started and
  -- stopped" from "never started", which is the difference between somebody to
  -- help and somebody who never arrived.
  ADD COLUMN IF NOT EXISTS "draft_started_at"     timestamptz;

-- Existing applications predate provider types. RETAIL/FOOD/SERVICE rows were
-- all submitted by individuals in practice, but guessing would put a claim in
-- the record that nobody made. They are left NULL and the review screen shows
-- "not stated" rather than inventing one.
COMMENT ON COLUMN "business_applications"."provider_type" IS
  'NULL on applications created before provider types existed. Do not backfill by guessing.';

/* ------------------------------------------------ six verification states */

-- On the APPLICATION while it is being reviewed, and copied onto the business
-- when it is approved. Each is a separate act by a person, recorded separately.
ALTER TABLE "business_applications"
  ADD COLUMN IF NOT EXISTS "identity_verified_at"      timestamptz,
  ADD COLUMN IF NOT EXISTS "identity_verified_by"      uuid REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "address_verified_at"       timestamptz,
  ADD COLUMN IF NOT EXISTS "address_verified_by"       uuid REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "operating_verified_at"     timestamptz,
  ADD COLUMN IF NOT EXISTS "operating_verified_by"     uuid REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "registration_verified_at"  timestamptz,
  ADD COLUMN IF NOT EXISTS "registration_verified_by"  uuid REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "property_verified_at"      timestamptz,
  ADD COLUMN IF NOT EXISTS "property_verified_by"      uuid REFERENCES "users"("id");

ALTER TABLE "businesses"
  ADD COLUMN IF NOT EXISTS "provider_type"             "provider_type",
  ADD COLUMN IF NOT EXISTS "identity_verified_at"      timestamptz,
  ADD COLUMN IF NOT EXISTS "address_verified_at"       timestamptz,
  ADD COLUMN IF NOT EXISTS "operating_verified_at"     timestamptz,
  ADD COLUMN IF NOT EXISTS "registration_verified_at"  timestamptz,
  ADD COLUMN IF NOT EXISTS "property_verified_at"      timestamptz;

/* ------------------------------------- accepted address evidence (§11) */

-- A table rather than an enum, because §11 says the Platform Owner must be
-- able to enable, disable and add methods later, and an enum needs a migration
-- for that.
CREATE TABLE IF NOT EXISTS "address_evidence_types" (
  "code"        text PRIMARY KEY,
  "label"       text NOT NULL,
  "note"        text,
  "is_enabled"  boolean NOT NULL DEFAULT true,
  "sort_order"  integer NOT NULL DEFAULT 0,
  "created_at"  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "address_evidence_types" ("code", "label", "note", "sort_order") VALUES
  ('UTILITY_BILL', 'A utility bill', 'Water, electricity or similar, from the last three months.', 10),
  ('MUNICIPAL_BILL', 'A council or municipal bill', NULL, 20),
  ('LEASE', 'A lease or tenancy agreement', 'Renting is completely fine.', 30),
  ('BANK_LETTER', 'A bank letter or statement showing your address', 'Cover up the transactions. We only need the address.', 40),
  ('GOVERNMENT_LETTER', 'Official government correspondence', NULL, 50),
  ('EMPLOYER_LETTER', 'A letter from your employer', NULL, 60),
  ('STUDENT_ACCOMMODATION', 'Student accommodation confirmation', NULL, 70),
  ('LANDLORD_DECLARATION', 'A signed note from your landlord or the property owner', 'Useful when the bill is not in your name.', 80),
  ('FAMILY_BILL_PLUS_PROOF', 'A family member''s bill, plus something showing you live there', NULL, 90),
  ('MUSUWO_VISIT', 'Somebody from Musuwo visits', 'We come to you. Slower, but nothing to find.', 100)
ON CONFLICT ("code") DO NOTHING;

-- DELIBERATELY ABSENT: raw EcoCash transaction history. §12 is explicit that it
-- must not be automatic proof of address, and adding it here as an accepted
-- type is exactly how it would become automatic. If it is ever wanted it needs
-- a redaction story first - a full transaction list is a map of somebody's life
-- and none of it is our business.

/* ---------------------------------------- what each provider type needs */

-- Data, not code, so the Platform Owner can change a requirement without a
-- deploy - and so the server-side gate and the "you will need" screen read the
-- SAME source. Two lists that can disagree is how a form tells somebody they
-- are ready and the server then refuses them.
CREATE TABLE IF NOT EXISTS "provider_requirements" (
  "provider_type" "provider_type" NOT NULL,
  -- Matches a key the completeness checker understands. See
  -- lib/platform/registration.ts - an unknown key is ignored rather than
  -- blocking submission forever.
  "requirement"   text NOT NULL,
  "label"         text NOT NULL,
  "note"          text,
  "is_mandatory"  boolean NOT NULL DEFAULT true,
  "sort_order"    integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("provider_type", "requirement")
);

INSERT INTO "provider_requirements"
  ("provider_type", "requirement", "label", "note", "is_mandatory", "sort_order") VALUES
  -- INDIVIDUAL SELLER. The heaviest, because there is no company behind them.
  ('INDIVIDUAL_SELLER', 'legal_name', 'Your full name as it appears on your ID', NULL, true, 10),
  ('INDIVIDUAL_SELLER', 'id_document', 'A photo of your ID', 'National ID, passport or driver''s licence.', true, 20),
  ('INDIVIDUAL_SELLER', 'id_selfie', 'A photo of you holding that same ID', 'So we know the ID belongs to you. Nobody else sees it.', true, 30),
  ('INDIVIDUAL_SELLER', 'phone', 'A phone number that reaches you', NULL, true, 40),
  ('INDIVIDUAL_SELLER', 'address', 'Where you live', 'Never shown to customers.', true, 50),
  ('INDIVIDUAL_SELLER', 'address_evidence', 'Something showing that address', 'Renting or living with family is fine.', true, 60),
  ('INDIVIDUAL_SELLER', 'operating_area', 'Where you trade', NULL, true, 70),
  ('INDIVIDUAL_SELLER', 'business_name', 'What you want to be called', NULL, true, 80),
  ('INDIVIDUAL_SELLER', 'category', 'What you sell', NULL, true, 90),
  ('INDIVIDUAL_SELLER', 'summary', 'A sentence about what you offer', NULL, true, 100),

  -- INFORMAL BUSINESS. Same identity, because informal does not mean anonymous.
  ('INFORMAL_BUSINESS', 'legal_name', 'The owner''s full name as on their ID', NULL, true, 10),
  ('INFORMAL_BUSINESS', 'id_document', 'A photo of the owner''s ID', NULL, true, 20),
  ('INFORMAL_BUSINESS', 'id_selfie', 'A photo of the owner holding that ID', NULL, true, 30),
  ('INFORMAL_BUSINESS', 'phone', 'A phone number that reaches the business', NULL, true, 40),
  ('INFORMAL_BUSINESS', 'address', 'The owner''s address', 'Never shown to customers.', true, 50),
  ('INFORMAL_BUSINESS', 'address_evidence', 'Something showing that address', NULL, true, 60),
  ('INFORMAL_BUSINESS', 'operating_area', 'Where the business trades', NULL, true, 70),
  ('INFORMAL_BUSINESS', 'business_name', 'The trading name', NULL, true, 80),
  ('INFORMAL_BUSINESS', 'category', 'What the business does', NULL, true, 90),
  ('INFORMAL_BUSINESS', 'summary', 'A sentence about the business', NULL, true, 100),
  ('INFORMAL_BUSINESS', 'premises_photo', 'A photo of where you trade from', 'A stall, a shop, a table. Helps customers recognise you.', false, 110),

  -- REGISTERED BUSINESS. The certificate carries part of the accountability,
  -- so the personal holding-ID photo is not required.
  ('REGISTERED_BUSINESS', 'business_name', 'The registered business name', NULL, true, 10),
  ('REGISTERED_BUSINESS', 'registration_number', 'Company registration number', NULL, true, 20),
  ('REGISTERED_BUSINESS', 'registration_document', 'The certificate of incorporation', NULL, true, 30),
  ('REGISTERED_BUSINESS', 'legal_name', 'Full name of the person applying', NULL, true, 40),
  ('REGISTERED_BUSINESS', 'id_document', 'That person''s ID', 'So we know who is acting for the company.', true, 50),
  ('REGISTERED_BUSINESS', 'phone', 'A business phone number', NULL, true, 60),
  ('REGISTERED_BUSINESS', 'address', 'The business address', NULL, true, 70),
  ('REGISTERED_BUSINESS', 'operating_area', 'Where you trade', NULL, true, 80),
  ('REGISTERED_BUSINESS', 'category', 'What the business does', NULL, true, 90),
  ('REGISTERED_BUSINESS', 'summary', 'A sentence about the business', NULL, true, 100),

  -- SERVICE PROVIDER. Identity matters; premises usually do not exist.
  ('SERVICE_PROVIDER', 'legal_name', 'Your full name as on your ID', NULL, true, 10),
  ('SERVICE_PROVIDER', 'id_document', 'A photo of your ID', NULL, true, 20),
  ('SERVICE_PROVIDER', 'id_selfie', 'A photo of you holding that ID', 'You will be going into people''s homes and workplaces.', true, 30),
  ('SERVICE_PROVIDER', 'phone', 'A phone number that reaches you', NULL, true, 40),
  ('SERVICE_PROVIDER', 'address', 'Where you live', 'Never shown to customers.', true, 50),
  ('SERVICE_PROVIDER', 'address_evidence', 'Something showing that address', NULL, true, 60),
  ('SERVICE_PROVIDER', 'operating_area', 'The areas you cover', NULL, true, 70),
  ('SERVICE_PROVIDER', 'business_name', 'What you want to be called', NULL, true, 80),
  ('SERVICE_PROVIDER', 'category', 'What you do', NULL, true, 90),
  ('SERVICE_PROVIDER', 'summary', 'A sentence about your service', NULL, true, 100),

  -- ACCOMMODATION. The only type where the PROPERTY itself is checked.
  ('ACCOMMODATION_PROVIDER', 'legal_name', 'Your full name as on your ID', NULL, true, 10),
  ('ACCOMMODATION_PROVIDER', 'id_document', 'A photo of your ID', NULL, true, 20),
  ('ACCOMMODATION_PROVIDER', 'id_selfie', 'A photo of you holding that ID', 'People will be sleeping there.', true, 30),
  ('ACCOMMODATION_PROVIDER', 'phone', 'A phone number that reaches you', NULL, true, 40),
  ('ACCOMMODATION_PROVIDER', 'address', 'The property address', NULL, true, 50),
  ('ACCOMMODATION_PROVIDER', 'address_evidence', 'Something showing you may let it', 'A title deed, a lease that allows subletting, or an owner''s letter.', true, 60),
  ('ACCOMMODATION_PROVIDER', 'property_photos', 'Photos of the rooms', NULL, true, 70),
  ('ACCOMMODATION_PROVIDER', 'business_name', 'What the place is called', NULL, true, 80),
  ('ACCOMMODATION_PROVIDER', 'summary', 'A sentence about the place', NULL, true, 90)
ON CONFLICT DO NOTHING;

/* ----------------------------------------------------------------- RLS */

ALTER TABLE "address_evidence_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_requirements"  ENABLE ROW LEVEL SECURITY;
