-- Add the GTFS stop_code column (SIRI identifier used by the CTS API).
-- Handwritten migration; if you later use `drizzle-kit generate`, regenerate
-- the meta snapshots so it does not try to re-add this column.
ALTER TABLE "stops" ADD COLUMN IF NOT EXISTS "stop_code" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stops_code_idx" ON "stops" ("stop_code");