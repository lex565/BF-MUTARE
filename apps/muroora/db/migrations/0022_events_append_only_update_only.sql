-- Make product_events tamper-proof without making products undeletable.
--
-- WHAT 0020 GOT WRONG
--
-- It put the append-only trigger on BOTH update and delete, copying what
-- audit_log and order_events do:
--
--   CREATE TRIGGER product_events_append_only
--     BEFORE UPDATE OR DELETE ON product_events ...
--
-- product_events.product_id is ON DELETE CASCADE. Postgres runs a cascade as
-- an internal DELETE on the child table, that DELETE fires this trigger, and
-- the trigger raises. So deleting ANY product that had ever been shown to
-- anybody failed with "product_events is append-only", blaming a table the
-- person deleting a product has never heard of.
--
-- This is the same shape as the bug migration 0012 fixed, where a
-- DO INSTEAD NOTHING rule on DELETE silently swallowed a cascade and made a
-- parent row undeletable by anybody. Found here by db/verify-discovery.mts,
-- which could not clean up after itself.
--
-- WHY UPDATE ONLY, RATHER THAN SOFT-DELETING PRODUCTS INSTEAD
--
-- The precedent on this platform is audit_log: it keeps the trigger on both,
-- and the cost is that a user with audit rows can never be hard-deleted, only
-- soft-deleted. That is the right trade for a compliance log, where the
-- record existing is the entire point.
--
-- Analytics are different in a way that matters. What must not happen is a
-- number being CHANGED - an impression becoming an order, a count being
-- edited upward - because ranking reads these rows and a merchant benefits
-- from the edit. That is UPDATE, and it stays blocked.
--
-- A DELETE is not the same risk. Nothing outside the application can reach
-- this table at all: RLS is on with no policies, so PostgREST denies both the
-- anon and the authenticated key. Within the application, deleting events only
-- ever reduces a merchant's own figures, which is self-harm rather than fraud,
-- and the daily rollup is recomputed from the events, so a deletion shows up
-- as numbers going down rather than as a forged rise.
--
-- Against that: this table grows for ever, and a platform that cannot delete
-- a product it has shown once, or honour a request to remove somebody's
-- browsing history, has a worse problem than the one the trigger solves.

DROP TRIGGER IF EXISTS "product_events_append_only" ON "product_events";--> statement-breakpoint

CREATE TRIGGER "product_events_append_only"
  BEFORE UPDATE ON "product_events"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
