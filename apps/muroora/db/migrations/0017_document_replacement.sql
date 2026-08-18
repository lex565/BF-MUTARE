-- One document per kind, held by the database.
--
-- WHAT WAS WRONG. Replacing a document did this: upload the new file, delete
-- the old storage object, delete the old row, then insert the new row. Three
-- unprotected steps, and the failure modes are all bad in the same direction:
--
--   If the final insert failed, the applicant was left with NO document row,
--   their original evidence already deleted from storage and unrecoverable,
--   and the file they had just uploaded orphaned in the bucket with nothing
--   pointing at it. Somebody replacing a blurry ID photo would lose the
--   readable one they already had.
--
--   The result of the storage delete was ignored, so a failed delete left an
--   identity document sitting in the bucket after its only database reference
--   was gone - a national ID nobody knows is there and nobody will ever remove.
--
--   Two uploads at once both saw "no existing row" and both inserted, so an
--   application could carry two ID photos and a reviewer would not know which
--   was current.
--
-- This index makes the third impossible and lets the service do the other two
-- as one upsert inside a transaction, deleting the old FILE only after the
-- metadata has committed.
--
-- PARTIAL, because photographs are legitimately plural: several pictures of a
-- boarding house or a market stall is the point. Only the kinds where exactly
-- one document is meaningful are constrained.

/* --------------------------------------------- clean up any duplicates */

-- Nothing should have got in yet, but adding a unique index to a table that
-- already violates it fails, and failing here would leave the fix unapplied
-- while looking like it ran. Keeps the newest of each pair.
--
-- NOTE: this deletes ROWS ONLY. The storage objects those rows pointed at are
-- deliberately left alone - deleting a stranger's identity document because a
-- migration inferred it was a duplicate is not a decision a migration should
-- make. `npm run storage:orphans` lists anything left behind.
DELETE FROM "business_application_documents" a
USING "business_application_documents" b
WHERE a."application_id" = b."application_id"
  AND a."kind" = b."kind"
  AND a."kind" NOT IN ('PREMISES_PHOTO', 'PROPERTY_PHOTO')
  AND a."created_at" < b."created_at";

/* ------------------------------------------------------------- the rule */

CREATE UNIQUE INDEX IF NOT EXISTS "business_application_documents_one_per_kind"
  ON "business_application_documents" ("application_id", "kind")
  WHERE "kind" NOT IN ('PREMISES_PHOTO', 'PROPERTY_PHOTO');
