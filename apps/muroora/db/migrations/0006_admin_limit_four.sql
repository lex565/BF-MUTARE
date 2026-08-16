-- Raise the admin limit from three to four.
--
-- The original instruction was "only three owner-created admin accounts are
-- permitted". The named people turned out to be four: the owner, Musi,
-- Mischeck and Patronella, all of whom need to edit. The owner raised the cap
-- rather than drop one of them to read-only.
--
-- The limit is kept rather than removed. It is not there because three was a
-- magic number; it is there so that admin access is a deliberate act with a
-- ceiling, and so nobody can quietly accumulate a dozen admins over a year.
--
-- The number lives in exactly two places, and they must agree:
--   lib/services/staff.ts   MAX_ADMINS
--   this trigger
-- The service gives a readable message; the trigger is what actually holds
-- when something reaches the table another way.

CREATE OR REPLACE FUNCTION enforce_admin_limit() RETURNS trigger AS $$
DECLARE
  admin_count integer;
  admin_limit constant integer := 4;
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

  IF admin_count >= admin_limit THEN
    RAISE EXCEPTION
      'Only % accounts may have admin access. Remove one first.', admin_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
