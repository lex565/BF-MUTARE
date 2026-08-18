-- Musuwo platform authority: an owner, super admins, permissions and audit.
--
-- WHAT WAS WRONG, AND IT IS THE REASON THIS FILE EXISTS
--
-- There was no platform-level role of any kind. `user_roles` answers "what may
-- this person do inside Muroora Mart's shop": every row carries a store_id,
-- every check filters on one, and SUPER_ADMIN there means "can edit this
-- shop's products and staff". Four people hold it today.
--
-- The moment a second business is approved, that becomes a problem nobody
-- would notice. Whoever runs Musuwo and whoever runs the grocer's shop are not
-- the same authority, and if the second business's fate is decided by a check
-- against the first shop's admin list, then four people acquire power over a
-- merchant they have never met, silently, and it will look like it is working.
--
-- So platform authority is a separate table with its own enum and no store
-- column, because a platform action belongs to no shop. Nothing here touches
-- user_roles. A person may hold both; that is two grants, made separately and
-- revocable separately.
--
-- ADDITIVE ONLY. No existing table is altered, no column dropped, no row
-- rewritten. Every statement below is CREATE or INSERT.
--
-- THE OWNER IS CREATED HERE, BY EMAIL, AND THAT IS DELIBERATE
--
-- There is no screen that makes somebody the Platform Owner, because there
-- must be no way to become the owner by asking. The grant is at the bottom of
-- this file where it can be read in the diff before it runs, and a partial
-- unique index then refuses a second owner. After this, ownership can only
-- move by another migration - which is to say, deliberately, in writing, in
-- version control.

/* --------------------------------------------------------------- types */

CREATE TYPE "platform_role" AS ENUM (
  'PLATFORM_OWNER',
  'SUPER_ADMIN'
);

CREATE TYPE "platform_admin_status" AS ENUM (
  'INVITED',
  'ACTIVE',
  'SUSPENDED',
  'DEACTIVATED'
);

/* --------------------------------------------------------------- roles */

CREATE TABLE "platform_roles" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"        uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role"           "platform_role" NOT NULL,
  "status"         "platform_admin_status" NOT NULL DEFAULT 'INVITED',
  "granted_by"     uuid REFERENCES "users"("id"),
  "granted_at"     timestamptz NOT NULL DEFAULT now(),
  "revoked_by"     uuid REFERENCES "users"("id"),
  "revoked_at"     timestamptz,
  "revoke_reason"  text,
  "last_active_at" timestamptz,
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "platform_roles_user_role_unique" UNIQUE ("user_id", "role")
);

CREATE INDEX "platform_roles_status_idx" ON "platform_roles" ("status");

-- EXACTLY ONE LIVE OWNER, held by the database rather than by the application
-- remembering to check. Deactivated and suspended owner rows are excluded from
-- the index, so ownership can be transferred later: deactivate the old row,
-- insert the new one. It cannot be held by two people at once.
CREATE UNIQUE INDEX "platform_roles_single_owner"
  ON "platform_roles" ("role")
  WHERE "role" = 'PLATFORM_OWNER' AND "status" IN ('INVITED', 'ACTIVE');

/* --------------------------------------------------------- permissions */

CREATE TABLE "platform_permissions" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "platform_role_id" uuid NOT NULL REFERENCES "platform_roles"("id") ON DELETE CASCADE,
  "permission"       text NOT NULL,
  "granted_by"       uuid REFERENCES "users"("id"),
  "created_at"       timestamptz NOT NULL DEFAULT now(),
  "updated_at"       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "platform_permissions_unique" UNIQUE ("platform_role_id", "permission")
);

CREATE INDEX "platform_permissions_role_idx"
  ON "platform_permissions" ("platform_role_id");

-- The owner is allowed everything by being the owner, decided in one place in
-- lib/platform/auth.ts. Materialising rows for them would mean somebody could
-- one day revoke one and lock the owner out of their own platform, so the
-- database refuses to store them at all.
--
-- A trigger rather than a CHECK constraint: a CHECK may not contain a
-- subquery, and this rule is about a row in another table. Postgres accepts
-- `CHECK (NOT EXISTS (...))` in neither form - it raises 0A000 at DDL time.
CREATE OR REPLACE FUNCTION refuse_permissions_for_owner() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM platform_roles r
    WHERE r.id = NEW.platform_role_id AND r.role = 'PLATFORM_OWNER'
  ) THEN
    RAISE EXCEPTION
      'The Platform Owner is not granted individual permissions - they are allowed everything by being the owner. Granting rows here would make it possible to revoke one and lock the owner out.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER platform_permissions_not_for_owner
  BEFORE INSERT OR UPDATE ON platform_permissions
  FOR EACH ROW EXECUTE FUNCTION refuse_permissions_for_owner();

/* ------------------------------------------------------------ settings */

CREATE TABLE "platform_settings" (
  "key"         text PRIMARY KEY,
  "value"       jsonb NOT NULL,
  "description" text,
  "updated_by"  uuid REFERENCES "users"("id"),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

-- The ten-admin cap lives here as data, not as a number compiled into four
-- files. NOTE FOR WHOEVER READS THIS NEXT: the shop's separate four-admin cap
-- is a trigger in 0006 and is a DIFFERENT LIMIT ON A DIFFERENT THING. Do not
-- reconcile them.
INSERT INTO "platform_settings" ("key", "value", "description") VALUES
  ('max_active_super_admins', '10'::jsonb,
   'How many SUPER_ADMIN grants may be ACTIVE at once. The Platform Owner is not counted: they are not a super admin.'),
  ('business_public_id_prefix', '"MUR-BIZ"'::jsonb,
   'Prefix for new business public IDs. Still MUR-BIZ because Muroora Mart is MUR-BIZ-0001 and renumbering a live ID is destructive. Changing this affects NEW businesses only.');

/* --------------------------------------------------------- admin limit */

-- Enforced in the database as well as the service, because a limit that only
-- exists in application code holds until the first script that reaches the
-- table another way.
CREATE OR REPLACE FUNCTION enforce_super_admin_limit() RETURNS trigger AS $$
DECLARE
  active_count integer;
  active_limit integer;
BEGIN
  IF NEW.role <> 'SUPER_ADMIN' OR NEW.status <> 'ACTIVE' THEN
    RETURN NEW;
  END IF;

  -- Read the cap from settings so the owner can change it in one place.
  SELECT COALESCE((value #>> '{}')::integer, 10) INTO active_limit
  FROM platform_settings WHERE key = 'max_active_super_admins';

  SELECT count(*) INTO active_count
  FROM platform_roles
  WHERE role = 'SUPER_ADMIN'
    AND status = 'ACTIVE'
    AND id <> NEW.id;

  IF active_count >= active_limit THEN
    RAISE EXCEPTION
      'Musuwo already has % active Super Admins, which is the limit. Deactivate one before activating another.',
      active_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER super_admin_limit
  BEFORE INSERT OR UPDATE ON platform_roles
  FOR EACH ROW EXECUTE FUNCTION enforce_super_admin_limit();

/* --------------------------------------------------------------- audit */

CREATE TABLE "platform_audit_log" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_id"    uuid REFERENCES "users"("id"),
  "actor_role"  text,
  "action"      text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id"   uuid,
  "changes"     jsonb,
  "reason"      text,
  "ip_address"  text,
  "user_agent"  text,
  "created_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "platform_audit_entity_idx"
  ON "platform_audit_log" ("entity_type", "entity_id");
CREATE INDEX "platform_audit_actor_idx"
  ON "platform_audit_log" ("actor_id", "created_at");

-- APPEND ONLY, held by the database. The brief requires that a Super Admin
-- cannot erase audit history; a rule that only lives in application code is
-- one forgotten check away from not existing. Nothing in the application
-- updates or deletes from this table, so this costs nothing today and means
-- the guarantee survives whatever gets written next year.
CREATE RULE "platform_audit_no_update" AS
  ON UPDATE TO "platform_audit_log" DO INSTEAD NOTHING;
CREATE RULE "platform_audit_no_delete" AS
  ON DELETE TO "platform_audit_log" DO INSTEAD NOTHING;

/* ----------------------------------------------------------------- RLS */

-- Same posture as migration 0008: enabled with no policies, which denies
-- everything through PostgREST while leaving the application untouched,
-- because it connects as the owning role which Postgres exempts.
--
-- DO NOT ADD `FORCE ROW LEVEL SECURITY` HERE. That subjects the owner to
-- policies too, and with no policies it would deny the application its own
-- database.
ALTER TABLE "platform_roles"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_settings"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_audit_log"   ENABLE ROW LEVEL SECURITY;

/* --------------------------------------------------------- THE OWNER */

-- Tanaka Mbendana, who owns Musuwo.
--
-- Matched on email against the existing users table rather than on a UUID
-- pasted in here, because the id would be wrong on any other database and this
-- migration has to be runnable against a fresh one.
--
-- granted_by is NULL and that is correct: there was nobody with the authority
-- to grant it yet. Writing a name here would put a fiction in the record.
--
-- If the address does not exist, this inserts nothing and the migration still
-- succeeds - it does not fail the deploy. Check afterwards with
-- `npm run platform:whoami`, which reports plainly when there is no owner.
INSERT INTO "platform_roles" ("user_id", "role", "status", "granted_at")
SELECT u."id", 'PLATFORM_OWNER', 'ACTIVE', now()
FROM "users" u
WHERE lower(u."email") = 'tanakambendanata@gmail.com'
  AND u."deleted_at" IS NULL
LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO "platform_audit_log"
  ("actor_id", "actor_role", "action", "entity_type", "entity_id", "changes", "reason")
SELECT r."user_id", 'PLATFORM_OWNER', 'PLATFORM_OWNER_ESTABLISHED',
       'platform_role', r."id",
       jsonb_build_object('role', 'PLATFORM_OWNER', 'status', 'ACTIVE'),
       'Founding grant, migration 0010.'
FROM "platform_roles" r
WHERE r."role" = 'PLATFORM_OWNER';
