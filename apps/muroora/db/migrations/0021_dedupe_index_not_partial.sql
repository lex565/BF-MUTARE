-- Make the deduplication index inferrable by ON CONFLICT.
--
-- WHAT WENT WRONG
--
-- 0020 created the index as PARTIAL:
--
--   CREATE UNIQUE INDEX product_events_dedupe_uniq
--     ON product_events (dedupe_key) WHERE dedupe_key IS NOT NULL;
--
-- The reasoning was that rows with no key - orders and cart removals, which
-- are deliberately never deduplicated - should not be carried in the index.
--
-- Postgres will not infer a partial index from `ON CONFLICT (dedupe_key)`. It
-- refuses the whole statement with
--
--   42P10: there is no unique or exclusion constraint matching the
--          ON CONFLICT specification
--
-- so EVERY event insert failed, not just the ones with a null key. Matching
-- the predicate in the statement is the documented fix, but drizzle's
-- `targetWhere` did not emit it on this version, and an ORM that silently
-- drops a clause is a bad thing to depend on for a correctness guarantee.
--
-- WHY DROPPING THE PREDICATE IS CORRECT AND NOT A CLIMBDOWN
--
-- Postgres treats NULLs as distinct in a unique index by default. Any number
-- of rows may carry a NULL `dedupe_key` without colliding, which is exactly
-- the exemption the partial predicate was written to provide. The predicate
-- was never buying the exemption; it was only keeping the index smaller.
--
-- It also brings the database into agreement with db/schema/analytics.ts,
-- which declares this index without a predicate. Those had silently diverged.
--
-- Found by db/verify-discovery.mts on its first run, before any event had been
-- written by a customer.

DROP INDEX IF EXISTS "product_events_dedupe_uniq";--> statement-breakpoint

CREATE UNIQUE INDEX "product_events_dedupe_uniq"
  ON "product_events" ("dedupe_key");
