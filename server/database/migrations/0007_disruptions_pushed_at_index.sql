-- Index for the push sweep's `pushed_at IS NULL` lookup (8.4).
-- Separate migration: CockroachDB cannot index a column added in the same
-- transaction (column added in 0006).
CREATE INDEX IF NOT EXISTS "disruptions_pushed_at_idx" ON "disruptions" ("pushed_at");
