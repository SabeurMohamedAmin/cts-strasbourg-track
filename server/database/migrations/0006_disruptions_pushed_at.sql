-- ROADMAP_NITRO_API 8.4: remember which disruptions were already pushed.
-- NULL = never announced, so the push sweep will pick the row up.
-- Handwritten migration; if you later use `drizzle-kit generate`, regenerate
-- the meta snapshots so it does not try to re-add this column.
--
-- DDL only. The backfill lives in 0007 because CockroachDB refuses a DML
-- statement that depends on a column added by DDL in the same transaction,
-- and drizzle-kit wraps each migration file in one transaction.
ALTER TABLE "disruptions" ADD COLUMN IF NOT EXISTS "pushed_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disruptions_pushed_at_idx" ON "disruptions" ("pushed_at");
