-- ROADMAP_NITRO_API 8.4: backfill disruptions.pushed_at (added in 0006).
-- Turning push on must never flood handsets with notifications for
-- disruptions the app has been showing for days, so every pre-existing row
-- counts as already announced.
-- Separate migration on purpose: see the note in 0006 (CockroachDB).
UPDATE "disruptions" SET "pushed_at" = now() WHERE "pushed_at" IS NULL;
