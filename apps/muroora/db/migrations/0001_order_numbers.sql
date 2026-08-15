-- Human-facing order numbers: MM-000001.
--
-- Hand-written because drizzle-kit has no way to express a sequence or a
-- default that calls a function.
--
-- Why a Postgres sequence rather than counting rows or generating in JS:
-- two customers checking out in the same second must not receive the same
-- number. `SELECT max(order_number) + 1` has exactly that race, and a random
-- string is not something anyone can read down a phone line. A sequence is
-- atomic by definition and survives rollbacks (leaving gaps, which is fine —
-- the number identifies an order, it does not count them).
--
-- The UUID primary key remains the true identifier. This is the label.

CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1 INCREMENT BY 1;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION next_order_number() RETURNS text AS $$
  SELECT 'MM-' || lpad(nextval('order_number_seq')::text, 6, '0');
$$ LANGUAGE sql VOLATILE;
--> statement-breakpoint

ALTER TABLE "orders" ALTER COLUMN "order_number" SET DEFAULT next_order_number();
--> statement-breakpoint

-- Guard rails on the append-only ledgers (D-004).
--
-- These are enforced in lib/inventory.ts, but a service layer only protects
-- callers that go through it. A trigger protects the table from a future
-- migration, an admin at a psql prompt, or a well-meant fix at 2am.

CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    '% is append-only. Correct a mistake by inserting a compensating row, '
    'not by editing history.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER inventory_transactions_immutable
  BEFORE UPDATE OR DELETE ON "inventory_transactions"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint

CREATE TRIGGER order_events_immutable
  BEFORE UPDATE OR DELETE ON "order_events"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint

CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
--> statement-breakpoint

-- Stock cannot go negative by accident.
--
-- lib/inventory.ts checks this, but the check and the write are two steps and
-- the database is the only place that can make the rule absolute. `reserved`
-- may never exceed what is on the shelf either — that is what stops the same
-- last bag of rice being promised to two customers.

ALTER TABLE "inventory"
  ADD CONSTRAINT inventory_quantity_non_negative CHECK ("quantity" >= 0);
--> statement-breakpoint

ALTER TABLE "inventory"
  ADD CONSTRAINT inventory_reserved_within_quantity
  CHECK ("reserved" >= 0 AND "reserved" <= "quantity");
--> statement-breakpoint

-- Money is never negative on these columns. A discount is a discount column,
-- not a negative price.
ALTER TABLE "products"
  ADD CONSTRAINT products_price_non_negative CHECK ("price_amount" >= 0);
--> statement-breakpoint

ALTER TABLE "orders"
  ADD CONSTRAINT orders_total_non_negative CHECK ("total_amount" >= 0);
