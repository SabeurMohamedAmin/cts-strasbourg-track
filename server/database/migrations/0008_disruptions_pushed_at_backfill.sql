-- Backfill disruptions.pushed_at (column added in 0006).
-- Turning push on must never flood handsets with notifications for
-- disruptions the app has been showing for days, so every pre-existing row
-- counts as already announced.
-- Separate migration: CockroachDB refuses DML depending on a column added
-- in the same transaction.
UPDATE "disruptions" SET "pushed_at" = now() WHERE "pushed_at" IS NULL;
