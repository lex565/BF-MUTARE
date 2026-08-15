CREATE TYPE "public"."staff_status" AS ENUM('ACTIVE', 'SUSPENDED', 'LEFT');--> statement-breakpoint
CREATE TABLE "staff_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"staff_number" text NOT NULL,
	"job_title" text,
	"photo_path" text,
	"status" "staff_status" DEFAULT 'ACTIVE' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"created_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_profiles_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "staff_profiles_staff_number_unique" UNIQUE("staff_number")
);
--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_profiles_store_idx" ON "staff_profiles" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "staff_profiles_user_idx" ON "staff_profiles" USING btree ("user_id");
--> statement-breakpoint
-- Staff numbers: MM-STF-0001, per addendum section 8.
--
-- A sequence for the same reason order numbers use one: two admins promoting
-- two people in the same moment must not be handed the same number. Numbers
-- are never reused, including after somebody leaves — a staff number that came
-- back would put two people''s history under one identifier.
CREATE SEQUENCE IF NOT EXISTS staff_number_seq START WITH 1 INCREMENT BY 1;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION next_staff_number() RETURNS text AS $$
  SELECT 'MM-STF-' || lpad(nextval('staff_number_seq')::text, 4, '0');
$$ LANGUAGE sql VOLATILE;
--> statement-breakpoint

ALTER TABLE "staff_profiles"
  ALTER COLUMN "staff_number" SET DEFAULT next_staff_number();
--> statement-breakpoint

-- Somebody who has left must have a leaving date, and somebody still here must
-- not. Otherwise "who works here" quietly becomes a matter of interpretation.
ALTER TABLE "staff_profiles"
  ADD CONSTRAINT staff_left_date_matches_status
  CHECK (("status" = 'LEFT' AND "left_at" IS NOT NULL)
      OR ("status" <> 'LEFT' AND "left_at" IS NULL));
