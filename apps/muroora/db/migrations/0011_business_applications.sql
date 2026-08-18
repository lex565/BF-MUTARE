-- Business applications: the nine types, the history, and the documents.
--
-- WHAT WAS THERE. A `business_applications` table with six columns - name,
-- kind, city, phone, email, note - and a `setBusinessStatus` that flipped a
-- status field. Applying worked. Everything after applying did not: there was
-- no history, so a rejection followed by a resubmission left no trace of
-- either; no uploads, so verification was a word rather than a document; and
-- no way to turn an approved application INTO a business, which meant nobody
-- could be approved without somebody writing SQL by hand.
--
-- ADDITIVE. Two new tables, new columns on an existing one, four new enum
-- values. No column dropped, no row rewritten, no existing application
-- invalidated - every new column is nullable or defaulted.

/* ------------------------------------------------------ the nine types */

-- The brief lists nine business types; the enum had five. Postgres adds enum
-- values without rewriting the table, and existing rows keep their value.
--
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block in older
-- Postgres. Supabase is on 15+, where it can, as long as the new value is not
-- USED in the same transaction. Nothing below uses them, so this is safe in
-- the one-transaction runner.
ALTER TYPE "business_kind" ADD VALUE IF NOT EXISTS 'EDUCATION';
ALTER TYPE "business_kind" ADD VALUE IF NOT EXISTS 'BEAUTY';
ALTER TYPE "business_kind" ADD VALUE IF NOT EXISTS 'AUTOMOTIVE';
ALTER TYPE "business_kind" ADD VALUE IF NOT EXISTS 'HOME_SERVICES';

/* -------------------------------------------- what an application holds */

ALTER TABLE "business_applications"
  ADD COLUMN IF NOT EXISTS "summary"       text,
  ADD COLUMN IF NOT EXISTS "address"       text,
  ADD COLUMN IF NOT EXISTS "whatsapp"      text,
  -- The type-specific answers. RETAIL is asked different questions from
  -- ACCOMMODATION, and modelling nine shapes as nine sets of columns would
  -- mean a migration every time a question changes wording.
  ADD COLUMN IF NOT EXISTS "details"       jsonb,
  -- Who is looking at it. §22: prevents two admins reviewing the same case,
  -- without a hard lock that traps an application when somebody goes offline.
  ADD COLUMN IF NOT EXISTS "assigned_to"   uuid REFERENCES "users"("id"),
  ADD COLUMN IF NOT EXISTS "assigned_at"   timestamptz,
  ADD COLUMN IF NOT EXISTS "submitted_at"  timestamptz,
  -- Set when a reviewer asks for more, cleared when the applicant resubmits.
  ADD COLUMN IF NOT EXISTS "info_requested" text,
  ADD COLUMN IF NOT EXISTS "info_due_at"   timestamptz;

-- Existing rows predate submitted_at. They were all submitted, so backfill
-- from created_at rather than leaving a null that reads as "never sent".
UPDATE "business_applications"
  SET "submitted_at" = "created_at"
  WHERE "submitted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "business_applications_assigned_idx"
  ON "business_applications" ("assigned_to");

/* --------------------------------------------------------- the history */

-- Append-only. Every status change, information request, resubmission,
-- assignment and note, with who and when.
--
-- The brief asks for history in four separate places (§18, §20, §24, §25) and
-- it is the same requirement each time: an application's past must survive its
-- present. A status column alone cannot answer "was this rejected before?",
-- which is exactly the question a reviewer needs answered.
CREATE TABLE IF NOT EXISTS "business_application_events" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "application_id" uuid NOT NULL REFERENCES "business_applications"("id") ON DELETE CASCADE,
  "actor_id"       uuid REFERENCES "users"("id"),
  -- SUBMITTED, CLAIMED, RELEASED, INFO_REQUESTED, RESUBMITTED, APPROVED,
  -- REJECTED, NOTE. Text rather than an enum: this list grows with the
  -- workflow and a new event name should not need a migration.
  "event"          text NOT NULL,
  "from_status"    "business_status",
  "to_status"      "business_status",
  -- What the applicant or the reviewer actually said.
  "message"        text,
  -- Reviewer-only. Never shown to the applicant. The API that serves the
  -- applicant's own view must not select this column.
  "internal"       boolean NOT NULL DEFAULT false,
  "created_at"     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "business_application_events_app_idx"
  ON "business_application_events" ("application_id", "created_at");

-- History is evidence. Same reasoning as the platform audit log.
CREATE RULE "business_application_events_no_update" AS
  ON UPDATE TO "business_application_events" DO INSTEAD NOTHING;
CREATE RULE "business_application_events_no_delete" AS
  ON DELETE TO "business_application_events" DO INSTEAD NOTHING;

-- Give the two applications already in the table their opening event, so the
-- history is complete rather than starting from whenever this shipped.
INSERT INTO "business_application_events"
  ("application_id", "actor_id", "event", "to_status", "message", "created_at")
SELECT a."id", a."applicant_id", 'SUBMITTED', a."status",
       'Backfilled from the application record when history was added.',
       a."created_at"
FROM "business_applications" a
WHERE NOT EXISTS (
  SELECT 1 FROM "business_application_events" e WHERE e."application_id" = a."id"
);

/* ------------------------------------------------------- the documents */

-- The row is the permission record; the file lives in a PRIVATE bucket and is
-- never publicly addressable. Reading one goes through a server route that
-- checks `sensitive_documents.view` and writes an audit event naming the
-- viewer - these are people's national IDs.
CREATE TABLE IF NOT EXISTS "business_application_documents" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "application_id" uuid NOT NULL REFERENCES "business_applications"("id") ON DELETE CASCADE,
  "uploaded_by"    uuid REFERENCES "users"("id"),
  -- ID_DOCUMENT, BUSINESS_REGISTRATION, PROOF_OF_ADDRESS, LOGO, PREMISES_PHOTO
  "kind"           text NOT NULL,
  -- Path inside the private bucket. NOT a URL. If a URL ever appears in this
  -- column somebody has made the bucket public.
  "path"           text NOT NULL,
  "mime_type"      text,
  "size_bytes"     integer,
  "original_name"  text,
  "created_at"     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "business_application_documents_app_idx"
  ON "business_application_documents" ("application_id");

/* --------------------------------------------------- approval plumbing */

-- Links the business back to the application that created it, so approval can
-- be idempotent: if this is already set, approval has already happened and the
-- second click returns the existing business instead of making another one.
ALTER TABLE "businesses"
  ADD COLUMN IF NOT EXISTS "application_id" uuid REFERENCES "business_applications"("id");

CREATE UNIQUE INDEX IF NOT EXISTS "businesses_application_unique"
  ON "businesses" ("application_id")
  WHERE "application_id" IS NOT NULL;

/* ----------------------------------------------------------------- RLS */

-- Same posture as 0008 and 0010: on, no policies, denies everything through
-- PostgREST while the application - which connects as the owning role - is
-- unaffected. DO NOT add FORCE ROW LEVEL SECURITY.
ALTER TABLE "business_application_events"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "business_application_documents" ENABLE ROW LEVEL SECURITY;
