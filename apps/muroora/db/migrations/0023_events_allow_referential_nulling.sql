-- Let referential cleanup through, and nothing else.
--
-- THE THIRD FACE OF THE SAME PROBLEM
--
-- 0020 blocked UPDATE and DELETE, which made a cascade delete fail.
-- 0022 narrowed it to UPDATE, which fixed ON DELETE CASCADE on product_id but
-- not the other two references:
--
--   entry_product_id  ON DELETE SET NULL
--   user_id           ON DELETE SET NULL
--
-- Postgres implements SET NULL as an internal UPDATE on the child row. So the
-- narrowed trigger still fired, and the error is unmistakable once seen:
--
--   PL/pgSQL function forbid_mutation() line 3 at RAISE
--   SQL statement: UPDATE ONLY public.product_events
--                  SET entry_product_id = NULL WHERE $1 = entry_product_id
--
-- Deleting a product that had ever been a doorway into a shop failed. So did
-- deleting a user who had ever opened anything - which matters more, because
-- that is what honouring "delete my account" looks like.
--
-- WHY NOT JUST DROP THE FOREIGN KEYS
--
-- That would work and it would be wrong. Without the reference, deleting a
-- user leaves their id sitting in an analytics table for ever, and the one
-- thing a deletion request has to actually do is remove the link between the
-- behaviour and the person. The FK is what guarantees the link is severed.
--
-- WHAT THIS TRIGGER ALLOWS
--
-- Exactly the shape a referential SET NULL produces: a row where one of the
-- two nullable references has become null and EVERY OTHER COLUMN IS
-- UNCHANGED. Any edit to what an event says - its type, its product, its
-- merchant, its session, when it happened, whether it counts - is still
-- refused, which is the property that matters. Ranking reads these rows, so
-- what must be impossible is a number being changed in somebody's favour.
--
-- `IS NOT DISTINCT FROM` throughout rather than `=`, because several of these
-- columns are nullable and `null = null` is null, not true. Using `=` would
-- have made the guard silently permissive on exactly the rows it exists to
-- protect.

CREATE OR REPLACE FUNCTION public.product_events_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- The only permitted change: a reference was severed by a cascade, and
  -- nothing else about the event moved.
  IF (NEW.entry_product_id IS NULL OR NEW.user_id IS NULL)
     AND NEW.id              IS NOT DISTINCT FROM OLD.id
     AND NEW.event_type      IS NOT DISTINCT FROM OLD.event_type
     AND NEW.surface         IS NOT DISTINCT FROM OLD.surface
     AND NEW.product_id      IS NOT DISTINCT FROM OLD.product_id
     AND NEW.business_id     IS NOT DISTINCT FROM OLD.business_id
     AND NEW.session_id      IS NOT DISTINCT FROM OLD.session_id
     AND NEW.excluded_reason IS NOT DISTINCT FROM OLD.excluded_reason
     AND NEW.dedupe_key      IS NOT DISTINCT FROM OLD.dedupe_key
     AND NEW.occurred_at     IS NOT DISTINCT FROM OLD.occurred_at
     AND NEW.metadata        IS NOT DISTINCT FROM OLD.metadata
     -- and the nulling only ever removes a reference, never adds one
     AND (OLD.entry_product_id IS NOT NULL OR NEW.entry_product_id IS NULL)
     AND (OLD.user_id          IS NOT NULL OR NEW.user_id          IS NULL)
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'product_events is append-only. An event may lose a reference when the '
    'product or account it points at is deleted, but nothing it records may '
    'be edited. Correct a mistake by inserting a compensating row.';
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS "product_events_append_only" ON "product_events";--> statement-breakpoint

CREATE TRIGGER "product_events_append_only"
  BEFORE UPDATE ON "product_events"
  FOR EACH ROW EXECUTE FUNCTION public.product_events_guard();--> statement-breakpoint

-- Closed to the public key from the moment it exists, rather than being added
-- to the list of things somebody has to remember. See 0019.
REVOKE EXECUTE ON FUNCTION public.product_events_guard() FROM PUBLIC, anon, authenticated;
