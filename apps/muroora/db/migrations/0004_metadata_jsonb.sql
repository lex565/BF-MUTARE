-- Metadata columns were text, and stored "[object Object]".
--
-- `metadata()` in db/schema/_shared.ts declared a `text` column carrying
-- `.$type<Record<string, unknown>>()`. That type-checks perfectly and is
-- silently wrong: `$type` tells TypeScript what to believe, it does not make
-- Postgres store an object. Drizzle handed the object to the driver for a text
-- column, JavaScript stringified it, and every row landed as the literal
-- string "[object Object]".
--
-- The cost of that: audit_log, order_events and inventory_transactions all
-- kept WHO did WHAT, and threw away the detail of what they actually did. The
-- audit trail said "STAFF_PROMOTED" without saying to which role, and
-- "ORDER_CANCELLED" without the reason it was given.
--
-- Converting to jsonb. Rows already written cannot be recovered — the detail
-- never reached the database — so they become NULL rather than being left as
-- a string that looks like data. Anything that IS valid JSON is kept.
--
-- ALTER TABLE is DDL, so the append-only triggers on audit_log and
-- order_events (which fire on INSERT/UPDATE/DELETE of rows) do not block it.

ALTER TABLE "audit_log"
  ALTER COLUMN "metadata" TYPE jsonb
  USING (
    CASE
      WHEN "metadata" IS NULL THEN NULL
      WHEN "metadata" = '[object Object]' THEN NULL
      WHEN jsonb_typeof("metadata"::jsonb) IS NOT NULL THEN "metadata"::jsonb
      ELSE NULL
    END
  );

ALTER TABLE "order_events"
  ALTER COLUMN "metadata" TYPE jsonb
  USING (
    CASE
      WHEN "metadata" IS NULL THEN NULL
      WHEN "metadata" = '[object Object]' THEN NULL
      WHEN jsonb_typeof("metadata"::jsonb) IS NOT NULL THEN "metadata"::jsonb
      ELSE NULL
    END
  );

ALTER TABLE "inventory_transactions"
  ALTER COLUMN "metadata" TYPE jsonb
  USING (
    CASE
      WHEN "metadata" IS NULL THEN NULL
      WHEN "metadata" = '[object Object]' THEN NULL
      WHEN jsonb_typeof("metadata"::jsonb) IS NOT NULL THEN "metadata"::jsonb
      ELSE NULL
    END
  );

ALTER TABLE "payments"
  ALTER COLUMN "metadata" TYPE jsonb
  USING (
    CASE
      WHEN "metadata" IS NULL THEN NULL
      WHEN "metadata" = '[object Object]' THEN NULL
      WHEN jsonb_typeof("metadata"::jsonb) IS NOT NULL THEN "metadata"::jsonb
      ELSE NULL
    END
  );
