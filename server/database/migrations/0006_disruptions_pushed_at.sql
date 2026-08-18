-- ROADMAP_NITRO_API 8.4: remember which disruptions were already pushed.
-- NULL = never announced, so the push sweep will pick the row up.
--
-- ONE statement per migration on purpose: drizzle-kit wraps a migration file
-- in a single transaction, and CockroachDB refuses both an index on a column
-- added in the same transaction (0007) and a DML statement depending on it
-- (0008). Handwritten migration; regenerate the meta snapshots if you later
-- use `drizzle-kit generate`.
ALTER TABLE "disruptions" ADD COLUMN IF NOT EXISTS "pushed_at" timestamp;
