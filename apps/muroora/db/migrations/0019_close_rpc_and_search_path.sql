-- Stop the anonymous key advancing production sequences, and pin every
-- function's search_path.
--
-- WHAT WAS WRONG
--
-- Postgres grants EXECUTE to PUBLIC on every function it creates, unless told
-- otherwise. Nobody granted this deliberately. The effect is that `anon` and
-- `authenticated` - and `anon` is the key compiled into the Android APK and
-- shipped in the website bundle - could call the sequence functions through
-- PostgREST at /rest/v1/rpc/<name>.
--
-- Verified against production on 2026-08-20 with nothing but the anon key:
--
--   POST /rest/v1/rpc/next_business_public_id  ->  200  "MUR-BIZ-0020"
--   POST /rest/v1/rpc/next_order_number        ->  200  "MM-000025"
--   POST /rest/v1/rpc/next_staff_number        ->  200  "MM-STF-0032"
--
-- Those three numbers are permanently consumed. There is no way to test a
-- sequence function without advancing it, and the alternative was to assume.
--
-- This is not a data leak. It is integrity and abuse: a loop from anyone
-- holding the public key burns business public IDs, order numbers and staff
-- numbers for ever. Order numbers are printed on customer receipts, so the
-- gaps are visible to customers. It also explains why the second real merchant
-- was issued MUR-BIZ-0018 rather than MUR-BIZ-0002 - the sequence had already
-- been advanced. The number is not a count of anything and never was.
--
-- WHY THE REVOKE IS SAFE
--
-- Four of these are trigger bodies and three are column DEFAULT expressions.
-- Postgres runs a trigger and evaluates a DEFAULT as part of the statement
-- that fired it, and does NOT check EXECUTE on the calling role to do so. The
-- privilege only governs calling them directly, which nothing in the
-- application does - confirmed by grep across the repository.
--
-- The application connects as `postgres`, which owns all seven, so it keeps
-- EXECUTE regardless. `service_role` keeps it for the same reason.
--
-- WHY ALTER FUNCTION AND NOT CREATE OR REPLACE
--
-- The first draft of this migration re-declared all seven bodies so they could
-- be written against `search_path = ''`. That was wrong and nearly shipped:
-- comparing the drafted bodies against pg_get_functiondef showed three real
-- differences, any of which would have been a silent production bug.
--
--   enforce_admin_limit        counts DISTINCT user_id across ADMIN *and*
--                              SUPER_ADMIN and is scoped by store_id. The
--                              draft counted ADMIN only and invented a
--                              `revoked_at` column that table does not have.
--   enforce_super_admin_limit  keys on `status = 'ACTIVE'` and `id <> NEW.id`,
--                              not on `revoked_at` / `user_id`.
--   next_business_public_id    hard-codes the string 'MUR-BIZ-'. It does NOT
--                              read platform_settings.business_public_id_prefix,
--                              so that setting is currently decorative. Left
--                              exactly as found: changing the prefix is an
--                              open decision, not a side effect of this file.
--
-- So no body is touched here at all. ALTER FUNCTION ... SET changes only the
-- function's configuration, which is the single thing the lint is about.
--
-- WHY `public, pg_catalog` AND NOT `''`
--
-- The empty search_path is the stricter form, but it requires every reference
-- inside every body to be schema-qualified, which means editing all seven
-- bodies - the exact thing that just went wrong. A pinned path is what the
-- lint actually asks for: it cannot be influenced by the caller's session, so
-- nothing can be shadowed. None of the seven are SECURITY DEFINER - checked,
-- prosecdef is false on every one - so they run as the caller and a hijacked
-- path buys an attacker nothing they did not already have. This is hygiene
-- against the day somebody adds SECURITY DEFINER to one of them.
--
-- pg_catalog is listed explicitly because Postgres would otherwise prepend it
-- implicitly, and being explicit is the point of the exercise.

-- --------------------------------------------------------- pin search_path

ALTER FUNCTION public.next_order_number()            SET search_path = public, pg_catalog;--> statement-breakpoint
ALTER FUNCTION public.next_staff_number()            SET search_path = public, pg_catalog;--> statement-breakpoint
ALTER FUNCTION public.next_business_public_id()      SET search_path = public, pg_catalog;--> statement-breakpoint
ALTER FUNCTION public.forbid_mutation()              SET search_path = public, pg_catalog;--> statement-breakpoint
ALTER FUNCTION public.enforce_admin_limit()          SET search_path = public, pg_catalog;--> statement-breakpoint
ALTER FUNCTION public.enforce_super_admin_limit()    SET search_path = public, pg_catalog;--> statement-breakpoint
ALTER FUNCTION public.refuse_permissions_for_owner() SET search_path = public, pg_catalog;--> statement-breakpoint

-- ------------------------------------------------------------------ revoke

REVOKE EXECUTE ON FUNCTION public.next_order_number()            FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.next_staff_number()            FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.next_business_public_id()      FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.forbid_mutation()              FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.enforce_admin_limit()          FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.enforce_super_admin_limit()    FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.refuse_permissions_for_owner() FROM PUBLIC, anon, authenticated;--> statement-breakpoint

-- Everything created from here on inherits the closed default rather than
-- needing to be remembered. This governs functions created by `postgres` in
-- `public` from now on; it does not retroactively change the seven above,
-- which is why each is revoked explicitly.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
