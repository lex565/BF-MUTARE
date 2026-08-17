-- Close direct public read access to every domain table.
--
-- WHAT WAS WRONG
--
-- Twenty tables had row level security switched off. Supabase exposes every
-- table in the `public` schema through PostgREST at /rest/v1/<table>, and with
-- RLS off the anon key is allowed to read them. The anon key is not a secret:
-- it is `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the website bundle and
-- `EXPO_PUBLIC_SUPABASE_ANON_KEY` compiled into the Android APK. Anybody who
-- installed the beta could extract it in a minute.
--
-- Verified by reading each table with the anon key over HTTPS. It returned:
--
--   users            46 rows - full name, email, phone, country
--   user_roles       11 rows - who holds ADMIN and SUPER_ADMIN, a target list
--   orders           10 rows - buyer name, email, phone, recipient name and
--                              phone, full delivery address, GPS coordinates
--   staff_profiles    3 rows - staff numbers, job titles, photo paths
--   audit_log       117 rows - IP addresses and user agents
--   carts            27 rows - cart tokens, which identify a guest's basket
--
-- WHY ENABLING RLS IS ENOUGH, AND WHY IT CHANGES NOTHING FOR THE APP
--
-- A table with RLS enabled and no policies denies everything to ordinary
-- roles. That is exactly what is wanted here: nothing should reach these
-- tables through PostgREST at all. Confirmed by grep that no code anywhere in
-- the repository queries a domain table through the Supabase client - the
-- website and the app both read through server routes.
--
-- The application connects as `postgres`, which owns all thirty-two tables and
-- carries BYPASSRLS, and no table uses FORCE ROW LEVEL SECURITY. Postgres
-- exempts owners and BYPASSRLS roles, so every existing Drizzle query is
-- unaffected. Checked before writing this, not assumed.
--
-- DO NOT ADD `FORCE ROW LEVEL SECURITY` HERE. That would subject the owner to
-- policies too, and since there are no policies, it would deny the application
-- its own database and take the shop down.
--
-- The twelve rider tables already had RLS enabled with no policies, from
-- 0007_rider_foundation.sql. They are deliberately left alone.
--
-- WHAT THIS IS NOT
--
-- This is a lock on the front door, not multi-merchant isolation. Business A
-- being unable to read Business B still has to be enforced in the service
-- layer, because the application's own role bypasses RLS by design. Policies
-- become load-bearing only if the app is ever changed to connect as an
-- ordinary role.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "addresses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "saved_recipients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "stores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inventory" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "carts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cart_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "delivery_zones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "staff_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
