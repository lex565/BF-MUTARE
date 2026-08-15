CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_items_cart_product" UNIQUE("cart_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"user_id" uuid,
	"token" text,
	"expires_at" timestamp with time zone,
	"converted_order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "carts_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "delivery_fee_amount" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "discount_amount" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "delivery_zones" ALTER COLUMN "minimum_order_amount" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cart_items_cart_idx" ON "cart_items" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "carts_user_idx" ON "carts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "carts_token_idx" ON "carts" USING btree ("token");--> statement-breakpoint
CREATE INDEX "carts_expiry_idx" ON "carts" USING btree ("expires_at");
--> statement-breakpoint
-- A cart belongs to EITHER a signed-in user or an anonymous token, never
-- neither and never both.
--
-- Neither would be an orphan nobody could ever load again. Both would be
-- ambiguous at sign-in, when a guest cart is merged into an account: the merge
-- has to know which side is authoritative. The database enforces it because
-- the alternative is remembering, and this is the kind of rule that gets
-- forgotten in the third place it is needed.
ALTER TABLE "carts"
  ADD CONSTRAINT carts_owner_exactly_one
  CHECK (("user_id" IS NOT NULL AND "token" IS NULL)
      OR ("user_id" IS NULL AND "token" IS NOT NULL));
--> statement-breakpoint

-- A line of zero or fewer is not a line. Removing an item deletes the row.
ALTER TABLE "cart_items"
  ADD CONSTRAINT cart_items_quantity_positive CHECK ("quantity" > 0);
