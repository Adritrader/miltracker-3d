-- ============================================================================
-- LiveWar3D — Migration 002: Enhance position_snapshots
-- Run this in SQL Editor at: https://supabase.com/dashboard/project/stsyfidhphyxsquecups/sql
-- ============================================================================

-- Add aircraft-specific fields
ALTER TABLE position_snapshots ADD COLUMN IF NOT EXISTS registration    TEXT;
ALTER TABLE position_snapshots ADD COLUMN IF NOT EXISTS aircraft_type   TEXT;
ALTER TABLE position_snapshots ADD COLUMN IF NOT EXISTS squawk          TEXT;
ALTER TABLE position_snapshots ADD COLUMN IF NOT EXISTS on_ground       BOOLEAN;
ALTER TABLE position_snapshots ADD COLUMN IF NOT EXISTS vertical_rate   REAL;

-- Add ship-specific fields
ALTER TABLE position_snapshots ADD COLUMN IF NOT EXISTS ship_type       TEXT;
ALTER TABLE position_snapshots ADD COLUMN IF NOT EXISTS destination     TEXT;
ALTER TABLE position_snapshots ADD COLUMN IF NOT EXISTS imo             TEXT;

-- Add carrier ops / mission context
ALTER TABLE position_snapshots ADD COLUMN IF NOT EXISTS carrier_name    TEXT;
ALTER TABLE position_snapshots ADD COLUMN IF NOT EXISTS carrier_ops     TEXT;

-- Composite index for faster trail queries
CREATE INDEX IF NOT EXISTS idx_pos_snap_entity_time ON position_snapshots (entity_id, sampled_at DESC);
