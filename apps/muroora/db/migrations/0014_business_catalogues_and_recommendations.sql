-- Every approved business receives a real, isolated catalogue. Public contact
-- links are deliberate profile fields, never copied from private application
-- details. Product views are first-party signals for signed-in recommendations.

ALTER TABLE "businesses"
  ADD COLUMN IF NOT EXISTS "website_url" text,
  ADD COLUMN IF NOT EXISTS "whatsapp_number" text,
  ADD COLUMN IF NOT EXISTS "favicon_path" text;--> statement-breakpoint

INSERT INTO "stores" ("name", "slug", "is_first_party", "city")
SELECT b."name", b."slug", false, b."city"
FROM "businesses" b
WHERE b."store_id" IS NULL
  AND b."deleted_at" IS NULL
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint

UPDATE "businesses" b
SET "store_id" = s."id", "updated_at" = now()
FROM "stores" s
WHERE b."store_id" IS NULL AND s."slug" = b."slug";--> statement-breakpoint

INSERT INTO "categories" ("store_id", "name", "slug", "description", "sort_order")
SELECT b."store_id", 'General', 'general', 'Products and services from this business.', 0
FROM "businesses" b
WHERE b."store_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "categories" c
    WHERE c."store_id" = b."store_id" AND c."slug" = 'general'
  );--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "marketplace_product_views" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "viewed_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "marketplace_product_views_user_idx"
  ON "marketplace_product_views"("user_id", "viewed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplace_product_views_product_idx"
  ON "marketplace_product_views"("product_id");--> statement-breakpoint
ALTER TABLE "marketplace_product_views" ENABLE ROW LEVEL SECURITY;
