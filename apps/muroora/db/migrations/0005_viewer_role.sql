-- A read-only oversight role, and a hard cap on editing admins.
--
-- Two separate requirements from the owner's staff list:
--
--   1. One named person's access is "just overseeing no editing". None of the
--      existing roles fit: ADMIN can change prices and stock, SHOP_STAFF can
--      pick and pack. VIEWER sees the admin screens and writes nothing.
--
--   2. "Only three owner-created admin accounts are permitted."
--
-- The cap is enforced in lib/services/staff.ts, which is the only path that
-- grants a role through the application. This index is the backstop for
-- anything that reaches the table another way — a psql session, a future
-- script, a mistake.
--
-- It cannot be a CHECK constraint: a CHECK sees one row, and "no more than
-- three rows like this exist" is a statement about the table. A partial
-- unique index on a generated ordinal would need a trigger to maintain, so
-- the honest backstop is a trigger.

ALTER TYPE "role" ADD VALUE IF NOT EXISTS 'VIEWER';
--> statement-breakpoint

CREATE OR REPLACE FUNCTION enforce_admin_limit() RETURNS trigger AS $$
DECLARE
  admin_count integer;
BEGIN
  IF NEW.role NOT IN ('ADMIN', 'SUPER_ADMIN') THEN
    RETURN NEW;
  END IF;

  -- Count PEOPLE, not grants. Somebody holding both ADMIN and SUPER_ADMIN is
  -- one person and must consume one place, not two.
  SELECT count(DISTINCT user_id) INTO admin_count
  FROM user_roles
  WHERE role IN ('ADMIN', 'SUPER_ADMIN')
    AND store_id = NEW.store_id
    AND user_id <> NEW.user_id;

  IF admin_count >= 3 THEN
    RAISE EXCEPTION
      'Only three accounts may have admin access. Remove one first.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS enforce_admin_limit_trigger ON "user_roles";
--> statement-breakpoint

CREATE TRIGGER enforce_admin_limit_trigger
  BEFORE INSERT ON "user_roles"
  FOR EACH ROW EXECUTE FUNCTION enforce_admin_limit();
