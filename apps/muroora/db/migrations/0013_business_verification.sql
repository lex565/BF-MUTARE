-- Verified businesses: a licence on file, checked by a person.
--
-- WHAT "VERIFIED" MEANS HERE, AND WHAT IT MUST NEVER COME TO MEAN
--
-- It means one thing: somebody at Musuwo has seen this business's registration
-- or trading licence and recorded that they saw it. Nothing else. It is not a
-- quality rating, not a recommendation, not a measure of how well they serve
-- customers, and it must never be quietly repurposed into one - a customer
-- reads a verification badge as "this business is real and can be found again
-- if something goes wrong", and that promise has to stay exactly that size.
--
-- WHY THE BADGE NEEDS ITS OWN COLUMNS RATHER THAN A BOOLEAN
--
-- A bare `verified` flag can be set by anybody who can write to the row, and
-- six months later nobody can answer "who decided this, and on the strength of
-- what?". So the columns record the licence number, where the document sits,
-- who checked it and when. If any of that is missing the business is not
-- verified, because the claim would be unbacked.
--
-- The document itself lives in a PRIVATE bucket. `licence_document_path` is a
-- path, never a URL. A trading licence carries a real person's name, address
-- and national ID number; publishing it to make a badge appear would be a far
-- worse outcome than having no badge.
--
-- ADDITIVE. Four nullable columns and one index.

ALTER TABLE "businesses"
  -- The licence or registration number as issued. Shown to reviewers, and
  -- deliberately NOT shown publicly: the badge says "checked", it does not
  -- republish somebody's registration details to anybody who visits.
  ADD COLUMN IF NOT EXISTS "licence_number"        text,
  -- Path in the private bucket. If a "https://" ever appears in this column,
  -- somebody has made the bucket public and the fix is urgent.
  ADD COLUMN IF NOT EXISTS "licence_document_path" text,
  ADD COLUMN IF NOT EXISTS "verified_at"           timestamptz,
  ADD COLUMN IF NOT EXISTS "verified_by"           uuid REFERENCES "users"("id");

-- A business is verified when a PERSON recorded that they checked a licence.
-- Both halves are required, in the database, so no code path can produce a
-- badge by setting one and forgetting the other.
ALTER TABLE "businesses"
  DROP CONSTRAINT IF EXISTS "businesses_verification_complete";
ALTER TABLE "businesses"
  ADD CONSTRAINT "businesses_verification_complete"
  CHECK (
    ("verified_at" IS NULL AND "verified_by" IS NULL)
    OR
    ("verified_at" IS NOT NULL AND "verified_by" IS NOT NULL
     AND "licence_number" IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS "businesses_verified_idx"
  ON "businesses" ("verified_at")
  WHERE "verified_at" IS NOT NULL;
