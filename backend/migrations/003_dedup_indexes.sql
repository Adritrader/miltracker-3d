-- ============================================================================
-- LiveWar3D — Migration 003: Add unique index + dedup alerts
-- Run this in SQL Editor at: https://supabase.com/dashboard/project/stsyfidhphyxsquecups/sql
-- ============================================================================

-- 1) Remove duplicate alert_archive rows (keep earliest by id)
DELETE FROM alert_archive a
USING alert_archive b
WHERE a.alert_id = b.alert_id
  AND a.id > b.id;

-- 2) Add unique index on alert_id to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_archive_alert_id_unique
  ON alert_archive (alert_id);

-- 3) Composite index for faster trail queries (already in 002 but idempotent)
CREATE INDEX IF NOT EXISTS idx_pos_snap_entity_time
  ON position_snapshots (entity_id, sampled_at DESC);

-- 4) Case-insensitive index on entity_id for trail lookups
CREATE INDEX IF NOT EXISTS idx_pos_snap_entity_lower
  ON position_snapshots (LOWER(entity_id));
