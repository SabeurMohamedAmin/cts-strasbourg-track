-- ROADMAP_NITRO_API 8.4: remember which disruptions were already pushed.
-- NULL = never announced, so the push sweep will pick the row up.
-- Handwritten migration; if you later use `drizzle-kit generate`, regenerate
-- the meta snapshots so it does not try to re-add this column.
ALTER TABLE "disruptions" ADD COLUMN IF NOT EXISTS "pushed_at" timestamp;--> statement-breakpoint
-- Backfill existing rows: turning push on must never flood handsets with
-- notifications for disruptions the app has been showing for days.
UPDATE "disruptions" SET "pushed_at" = now() WHERE "pushed_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disruptions_pushed_at_idx" ON "disruptions" ("pushed_at");
