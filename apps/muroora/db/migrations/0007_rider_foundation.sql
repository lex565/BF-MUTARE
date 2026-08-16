CREATE SEQUENCE IF NOT EXISTS "rider_number_seq" START WITH 1;

CREATE TYPE "public"."rider_vehicle_type" AS ENUM('BICYCLE', 'MOTORBIKE', 'CAR');--> statement-breakpoint
CREATE TYPE "public"."rider_account_status" AS ENUM('APPLICATION', 'UNDER_REVIEW', 'VERIFICATION_COMPLETE', 'CONTRACT_CONFIRMED', 'APPROVED', 'ACTIVE', 'REJECTED', 'RESTRICTED', 'SUSPENDED', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."rider_verification_status" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'VERIFIED', 'NEEDS_INFORMATION', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."rider_availability" AS ENUM('OFFLINE', 'AVAILABLE', 'OFFERED_DELIVERY', 'ON_DELIVERY', 'PAUSED', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."delivery_status" AS ENUM('CREATED', 'ASSIGNED', 'ACCEPTED', 'RIDER_EN_ROUTE_TO_PICKUP', 'RIDER_ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_TO_CUSTOMER', 'ARRIVED', 'DELIVERED', 'FAILED', 'CANCELLED', 'RETURNING_TO_STORE', 'RETURNED');--> statement-breakpoint
CREATE TYPE "public"."custody_state" AS ENUM('SHOP_CUSTODY', 'RIDER_ASSIGNED', 'HANDOVER_STARTED', 'IN_RIDER_CUSTODY', 'DELIVERY_CONFIRMED', 'CUSTODY_CLOSED', 'HANDOVER_CANCELLED', 'DELIVERY_FAILED', 'RETURNING_TO_STORE', 'RETURNED_TO_STORE', 'DAMAGED', 'DISPUTED', 'LOST_PENDING_INVESTIGATION');--> statement-breakpoint
CREATE TYPE "public"."delivery_offer_status" AS ENUM('OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."delivery_proof_type" AS ENUM('OTP', 'PHOTO', 'AUTHORIZED_EXCEPTION');--> statement-breakpoint
CREATE TYPE "public"."delivery_proof_status" AS ENUM('PENDING', 'VERIFIED', 'FAILED', 'EXPIRED', 'WAIVED_BY_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."rider_incident_category" AS ENUM('CUSTOMER_UNREACHABLE', 'INCORRECT_ADDRESS', 'RECIPIENT_UNAVAILABLE', 'VEHICLE_BREAKDOWN', 'DAMAGED_PACKAGE', 'SAFETY_CONCERN', 'CUSTOMER_DISPUTE', 'SHOP_ISSUE', 'PAYMENT_CASH_ISSUE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."rider_incident_status" AS ENUM('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."rider_exposure_event_type" AS ENUM('CUSTODY_ACQUIRED', 'DELIVERY_CONFIRMED', 'HANDOVER_CANCELLED', 'RETURNED_TO_STORE', 'AUTHORIZED_RECONCILIATION');--> statement-breakpoint
CREATE TYPE "public"."rider_earning_type" AS ENUM('DELIVERY_EARNING', 'BONUS', 'ADJUSTMENT', 'PAYOUT', 'REVERSAL');--> statement-breakpoint

CREATE TABLE "rider_trust_levels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL,
  "level" integer NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "max_exposure_amount" bigint,
  "currency" "currency" DEFAULT 'USD' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "rider_trust_levels_store_level_unique" UNIQUE("store_id", "level"),
  CONSTRAINT "rider_trust_level_range" CHECK ("level" BETWEEN 1 AND 4),
  CONSTRAINT "rider_trust_exposure_nonnegative" CHECK ("max_exposure_amount" IS NULL OR "max_exposure_amount" >= 0)
);--> statement-breakpoint

CREATE TABLE "rider_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL,
  "user_id" uuid NOT NULL UNIQUE,
  "public_rider_id" text DEFAULT ('MUR-R-' || lpad(nextval('rider_number_seq')::text, 4, '0')) NOT NULL UNIQUE,
  "display_name" text NOT NULL,
  "profile_photo_path" text,
  "operational_phone" text,
  "vehicle_type" "rider_vehicle_type",
  "vehicle_make_model" text,
  "vehicle_registration" text,
  "vehicle_colour" text,
  "account_status" "rider_account_status" DEFAULT 'APPLICATION' NOT NULL,
  "verification_status" "rider_verification_status" DEFAULT 'NOT_STARTED' NOT NULL,
  "availability" "rider_availability" DEFAULT 'OFFLINE' NOT NULL,
  "trust_level_id" uuid,
  "max_exposure_override_amount" bigint,
  "current_exposure_amount" bigint DEFAULT 0 NOT NULL,
  "currency" "currency" DEFAULT 'USD' NOT NULL,
  "completed_deliveries" integer DEFAULT 0 NOT NULL,
  "failed_deliveries" integer DEFAULT 0 NOT NULL,
  "incident_count" integer DEFAULT 0 NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  "approved_at" timestamp with time zone,
  "approved_by" uuid,
  "restriction_reason" text,
  "internal_notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "rider_current_exposure_nonnegative" CHECK ("current_exposure_amount" >= 0),
  CONSTRAINT "rider_override_exposure_nonnegative" CHECK ("max_exposure_override_amount" IS NULL OR "max_exposure_override_amount" >= 0)
);--> statement-breakpoint

CREATE TABLE "rider_status_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rider_id" uuid NOT NULL,
  "actor_id" uuid,
  "event_type" text NOT NULL,
  "previous_status" "rider_account_status",
  "new_status" "rider_account_status",
  "previous_trust_level_id" uuid,
  "new_trust_level_id" uuid,
  "reason" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL,
  "order_id" uuid NOT NULL UNIQUE,
  "rider_id" uuid,
  "status" "delivery_status" DEFAULT 'CREATED' NOT NULL,
  "custody_state" "custody_state" DEFAULT 'SHOP_CUSTODY' NOT NULL,
  "merchandise_value_amount" bigint NOT NULL,
  "rider_earning_amount" bigint,
  "currency" "currency" DEFAULT 'USD' NOT NULL,
  "required_vehicle_type" "rider_vehicle_type",
  "weight_class" text,
  "volume_class" text,
  "is_perishable" boolean DEFAULT false NOT NULL,
  "batch_group_id" uuid,
  "assigned_by" uuid,
  "assigned_at" timestamp with time zone,
  "accepted_at" timestamp with time zone,
  "picked_up_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "closed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "delivery_merchandise_value_nonnegative" CHECK ("merchandise_value_amount" >= 0)
);--> statement-breakpoint

CREATE TABLE "delivery_offers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "delivery_id" uuid NOT NULL,
  "rider_id" uuid NOT NULL,
  "status" "delivery_offer_status" DEFAULT 'OFFERED' NOT NULL,
  "earning_offered_amount" bigint,
  "currency" "currency" DEFAULT 'USD' NOT NULL,
  "offered_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone,
  "responded_at" timestamp with time zone,
  "decline_reason" text,
  CONSTRAINT "delivery_offers_delivery_rider_unique" UNIQUE("delivery_id", "rider_id")
);--> statement-breakpoint

CREATE TABLE "custody_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "delivery_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "rider_id" uuid,
  "store_id" uuid NOT NULL,
  "actor_id" uuid,
  "actor_type" text NOT NULL,
  "previous_state" "custody_state",
  "new_state" "custody_state" NOT NULL,
  "merchandise_value_amount" bigint NOT NULL,
  "currency" "currency" DEFAULT 'USD' NOT NULL,
  "reason" text,
  "proof_reference" text,
  "idempotency_key" text NOT NULL UNIQUE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "exposure_overrides" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rider_id" uuid NOT NULL,
  "delivery_id" uuid NOT NULL,
  "authorized_by" uuid NOT NULL,
  "previous_exposure_amount" bigint NOT NULL,
  "resulting_exposure_amount" bigint NOT NULL,
  "configured_limit_amount" bigint,
  "currency" "currency" DEFAULT 'USD' NOT NULL,
  "reason" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "rider_exposure_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rider_id" uuid NOT NULL,
  "delivery_id" uuid NOT NULL,
  "event_type" "rider_exposure_event_type" NOT NULL,
  "amount_change" bigint NOT NULL,
  "amount_before" bigint NOT NULL,
  "amount_after" bigint NOT NULL,
  "currency" "currency" DEFAULT 'USD' NOT NULL,
  "actor_id" uuid,
  "override_id" uuid,
  "idempotency_key" text NOT NULL UNIQUE,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "rider_exposure_after_nonnegative" CHECK ("amount_after" >= 0)
);--> statement-breakpoint

CREATE TABLE "delivery_proofs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "delivery_id" uuid NOT NULL,
  "proof_type" "delivery_proof_type" NOT NULL,
  "status" "delivery_proof_status" DEFAULT 'PENDING' NOT NULL,
  "otp_hash" text,
  "expires_at" timestamp with time zone,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 5 NOT NULL,
  "locked_at" timestamp with time zone,
  "photo_path" text,
  "verified_at" timestamp with time zone,
  "verified_by" uuid,
  "exception_reason" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "delivery_proof_attempt_range" CHECK ("attempt_count" >= 0 AND "max_attempts" > 0)
);--> statement-breakpoint

CREATE TABLE "delivery_proof_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "proof_id" uuid NOT NULL,
  "actor_id" uuid,
  "was_successful" boolean NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "rider_incidents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "delivery_id" uuid,
  "order_id" uuid,
  "rider_id" uuid NOT NULL,
  "reported_by" uuid NOT NULL,
  "category" "rider_incident_category" NOT NULL,
  "status" "rider_incident_status" DEFAULT 'OPEN' NOT NULL,
  "note" text NOT NULL,
  "evidence_path" text,
  "resolution_note" text,
  "resolved_by" uuid,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "rider_earning_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rider_id" uuid NOT NULL,
  "delivery_id" uuid,
  "type" "rider_earning_type" NOT NULL,
  "amount" bigint NOT NULL,
  "balance_before" bigint NOT NULL,
  "balance_after" bigint NOT NULL,
  "currency" "currency" DEFAULT 'USD' NOT NULL,
  "actor_id" uuid,
  "idempotency_key" text NOT NULL UNIQUE,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "rider_trust_levels" ADD CONSTRAINT "rider_trust_levels_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");--> statement-breakpoint
ALTER TABLE "rider_profiles" ADD CONSTRAINT "rider_profiles_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");--> statement-breakpoint
ALTER TABLE "rider_profiles" ADD CONSTRAINT "rider_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");--> statement-breakpoint
ALTER TABLE "rider_profiles" ADD CONSTRAINT "rider_profiles_trust_level_id_rider_trust_levels_id_fk" FOREIGN KEY ("trust_level_id") REFERENCES "public"."rider_trust_levels"("id");--> statement-breakpoint
ALTER TABLE "rider_profiles" ADD CONSTRAINT "rider_profiles_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");--> statement-breakpoint
ALTER TABLE "rider_status_events" ADD CONSTRAINT "rider_status_events_rider_id_rider_profiles_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."rider_profiles"("id");--> statement-breakpoint
ALTER TABLE "rider_status_events" ADD CONSTRAINT "rider_status_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id");--> statement-breakpoint
ALTER TABLE "rider_status_events" ADD CONSTRAINT "rider_status_events_previous_trust_level_id_fk" FOREIGN KEY ("previous_trust_level_id") REFERENCES "public"."rider_trust_levels"("id");--> statement-breakpoint
ALTER TABLE "rider_status_events" ADD CONSTRAINT "rider_status_events_new_trust_level_id_fk" FOREIGN KEY ("new_trust_level_id") REFERENCES "public"."rider_trust_levels"("id");--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_rider_id_rider_profiles_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."rider_profiles"("id");--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id");--> statement-breakpoint
ALTER TABLE "delivery_offers" ADD CONSTRAINT "delivery_offers_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id");--> statement-breakpoint
ALTER TABLE "delivery_offers" ADD CONSTRAINT "delivery_offers_rider_id_rider_profiles_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."rider_profiles"("id");--> statement-breakpoint
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id");--> statement-breakpoint
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");--> statement-breakpoint
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_rider_id_rider_profiles_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."rider_profiles"("id");--> statement-breakpoint
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");--> statement-breakpoint
ALTER TABLE "custody_events" ADD CONSTRAINT "custody_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id");--> statement-breakpoint
ALTER TABLE "exposure_overrides" ADD CONSTRAINT "exposure_overrides_rider_id_rider_profiles_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."rider_profiles"("id");--> statement-breakpoint
ALTER TABLE "exposure_overrides" ADD CONSTRAINT "exposure_overrides_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id");--> statement-breakpoint
ALTER TABLE "exposure_overrides" ADD CONSTRAINT "exposure_overrides_authorized_by_users_id_fk" FOREIGN KEY ("authorized_by") REFERENCES "public"."users"("id");--> statement-breakpoint
ALTER TABLE "rider_exposure_events" ADD CONSTRAINT "rider_exposure_events_rider_id_rider_profiles_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."rider_profiles"("id");--> statement-breakpoint
ALTER TABLE "rider_exposure_events" ADD CONSTRAINT "rider_exposure_events_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id");--> statement-breakpoint
ALTER TABLE "rider_exposure_events" ADD CONSTRAINT "rider_exposure_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id");--> statement-breakpoint
ALTER TABLE "rider_exposure_events" ADD CONSTRAINT "rider_exposure_events_override_id_exposure_overrides_id_fk" FOREIGN KEY ("override_id") REFERENCES "public"."exposure_overrides"("id");--> statement-breakpoint
ALTER TABLE "delivery_proofs" ADD CONSTRAINT "delivery_proofs_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id");--> statement-breakpoint
ALTER TABLE "delivery_proofs" ADD CONSTRAINT "delivery_proofs_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id");--> statement-breakpoint
ALTER TABLE "delivery_proof_attempts" ADD CONSTRAINT "delivery_proof_attempts_proof_id_delivery_proofs_id_fk" FOREIGN KEY ("proof_id") REFERENCES "public"."delivery_proofs"("id");--> statement-breakpoint
ALTER TABLE "delivery_proof_attempts" ADD CONSTRAINT "delivery_proof_attempts_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id");--> statement-breakpoint
ALTER TABLE "rider_incidents" ADD CONSTRAINT "rider_incidents_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id");--> statement-breakpoint
ALTER TABLE "rider_incidents" ADD CONSTRAINT "rider_incidents_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");--> statement-breakpoint
ALTER TABLE "rider_incidents" ADD CONSTRAINT "rider_incidents_rider_id_rider_profiles_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."rider_profiles"("id");--> statement-breakpoint
ALTER TABLE "rider_incidents" ADD CONSTRAINT "rider_incidents_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id");--> statement-breakpoint
ALTER TABLE "rider_incidents" ADD CONSTRAINT "rider_incidents_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id");--> statement-breakpoint
ALTER TABLE "rider_earning_events" ADD CONSTRAINT "rider_earning_events_rider_id_rider_profiles_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."rider_profiles"("id");--> statement-breakpoint
ALTER TABLE "rider_earning_events" ADD CONSTRAINT "rider_earning_events_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id");--> statement-breakpoint
ALTER TABLE "rider_earning_events" ADD CONSTRAINT "rider_earning_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id");--> statement-breakpoint

CREATE INDEX "rider_profiles_store_status_idx" ON "rider_profiles" ("store_id", "account_status");--> statement-breakpoint
CREATE INDEX "rider_profiles_availability_idx" ON "rider_profiles" ("store_id", "availability");--> statement-breakpoint
CREATE INDEX "rider_status_events_rider_idx" ON "rider_status_events" ("rider_id", "created_at");--> statement-breakpoint
CREATE INDEX "deliveries_rider_status_idx" ON "deliveries" ("rider_id", "status");--> statement-breakpoint
CREATE INDEX "deliveries_store_status_idx" ON "deliveries" ("store_id", "status");--> statement-breakpoint
CREATE INDEX "delivery_offers_rider_status_idx" ON "delivery_offers" ("rider_id", "status");--> statement-breakpoint
CREATE INDEX "custody_events_delivery_idx" ON "custody_events" ("delivery_id", "created_at");--> statement-breakpoint
CREATE INDEX "exposure_overrides_rider_idx" ON "exposure_overrides" ("rider_id", "created_at");--> statement-breakpoint
CREATE INDEX "rider_exposure_events_rider_idx" ON "rider_exposure_events" ("rider_id", "created_at");--> statement-breakpoint
CREATE INDEX "delivery_proofs_delivery_idx" ON "delivery_proofs" ("delivery_id", "status");--> statement-breakpoint
CREATE INDEX "delivery_proof_attempts_proof_idx" ON "delivery_proof_attempts" ("proof_id", "created_at");--> statement-breakpoint
CREATE INDEX "rider_incidents_rider_idx" ON "rider_incidents" ("rider_id", "status");--> statement-breakpoint
CREATE INDEX "rider_incidents_delivery_idx" ON "rider_incidents" ("delivery_id", "created_at");--> statement-breakpoint
CREATE INDEX "rider_earning_events_rider_idx" ON "rider_earning_events" ("rider_id", "created_at");--> statement-breakpoint

CREATE TRIGGER rider_status_events_immutable BEFORE UPDATE OR DELETE ON "rider_status_events" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();--> statement-breakpoint
CREATE TRIGGER custody_events_immutable BEFORE UPDATE OR DELETE ON "custody_events" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();--> statement-breakpoint
CREATE TRIGGER rider_exposure_events_immutable BEFORE UPDATE OR DELETE ON "rider_exposure_events" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();--> statement-breakpoint
CREATE TRIGGER delivery_proof_attempts_immutable BEFORE UPDATE OR DELETE ON "delivery_proof_attempts" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();--> statement-breakpoint
CREATE TRIGGER rider_earning_events_immutable BEFORE UPDATE OR DELETE ON "rider_earning_events" FOR EACH ROW EXECUTE FUNCTION forbid_mutation();--> statement-breakpoint

ALTER TABLE "rider_trust_levels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rider_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rider_status_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "delivery_offers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "custody_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "exposure_overrides" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rider_exposure_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "delivery_proofs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "delivery_proof_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rider_incidents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rider_earning_events" ENABLE ROW LEVEL SECURITY;
