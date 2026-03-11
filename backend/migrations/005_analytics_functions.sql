-- ============================================================================
-- LiveWar3D — Migration 005: Analytics RPC functions
-- Run this in SQL Editor at: https://supabase.com/dashboard/project/stsyfidhphyxsquecups/sql
-- These are OPTIONAL — the JS fallback works without them, but RPC is faster.
-- ============================================================================

-- 1) Fleet composition: entities by flag
CREATE OR REPLACE FUNCTION analytics_fleet_composition(p_hours INT DEFAULT 24)
RETURNS TABLE(flag TEXT, entity_type TEXT, count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT flag, entity_type, COUNT(*) as count
  FROM (
    SELECT DISTINCT ON (entity_id) COALESCE(NULLIF(flag, ''), 'Unknown') AS flag, entity_type
    FROM position_snapshots
    WHERE sampled_at >= NOW() - (p_hours || ' hours')::INTERVAL
    ORDER BY entity_id, sampled_at DESC
  ) sub
  GROUP BY flag, entity_type
  ORDER BY count DESC;
$$;

-- 2) Aircraft types breakdown
CREATE OR REPLACE FUNCTION analytics_aircraft_types(p_hours INT DEFAULT 24)
RETURNS TABLE(aircraft_type TEXT, count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT aircraft_type, COUNT(*) as count
  FROM (
    SELECT DISTINCT ON (entity_id) aircraft_type
    FROM position_snapshots
    WHERE sampled_at >= NOW() - (p_hours || ' hours')::INTERVAL
      AND entity_type = 'aircraft'
      AND aircraft_type IS NOT NULL AND aircraft_type != ''
    ORDER BY entity_id, sampled_at DESC
  ) sub
  GROUP BY aircraft_type
  ORDER BY count DESC
  LIMIT 20;
$$;

-- 3) Hourly activity (positions per hour)
CREATE OR REPLACE FUNCTION analytics_hourly_activity(p_hours INT DEFAULT 48)
RETURNS TABLE(hour TIMESTAMPTZ, aircraft_count BIGINT, ship_count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT
    date_trunc('hour', sampled_at) as hour,
    COUNT(*) FILTER (WHERE entity_type = 'aircraft') as aircraft_count,
    COUNT(*) FILTER (WHERE entity_type = 'ship') as ship_count
  FROM position_snapshots
  WHERE sampled_at >= NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY hour
  ORDER BY hour;
$$;

-- 4) Top tracked entities
CREATE OR REPLACE FUNCTION analytics_top_entities(p_hours INT DEFAULT 24, p_limit INT DEFAULT 30)
RETURNS TABLE(entity_id TEXT, entity_type TEXT, callsign TEXT, name TEXT, flag TEXT, snapshots BIGINT) LANGUAGE sql STABLE AS $$
  SELECT
    entity_id,
    MAX(entity_type) as entity_type,
    MAX(callsign) as callsign,
    MAX(name) as name,
    MAX(flag) as flag,
    COUNT(*) as snapshots
  FROM position_snapshots
  WHERE sampled_at >= NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY entity_id
  ORDER BY snapshots DESC
  LIMIT p_limit;
$$;

-- 5) Altitude distribution (buckets)
CREATE OR REPLACE FUNCTION analytics_altitude_distribution(p_hours INT DEFAULT 24)
RETURNS TABLE(bucket TEXT, count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT bucket, COUNT(*) as count FROM (
    SELECT CASE
      WHEN altitude IS NULL THEN 'Unknown'
      WHEN altitude < 100 THEN 'Ground (<100m)'
      WHEN altitude < 1000 THEN 'Low (100-1000m)'
      WHEN altitude < 5000 THEN 'Medium (1-5km)'
      WHEN altitude < 10000 THEN 'High (5-10km)'
      WHEN altitude < 15000 THEN 'Very High (10-15km)'
      ELSE 'Stratosphere (15km+)'
    END as bucket
    FROM position_snapshots
    WHERE sampled_at >= NOW() - (p_hours || ' hours')::INTERVAL
      AND entity_type = 'aircraft'
  ) sub
  GROUP BY bucket
  ORDER BY CASE bucket
    WHEN 'Ground (<100m)' THEN 1
    WHEN 'Low (100-1000m)' THEN 2
    WHEN 'Medium (1-5km)' THEN 3
    WHEN 'High (5-10km)' THEN 4
    WHEN 'Very High (10-15km)' THEN 5
    WHEN 'Stratosphere (15km+)' THEN 6
    ELSE 7
  END;
$$;

-- 6) Speed distribution
CREATE OR REPLACE FUNCTION analytics_speed_distribution(p_hours INT DEFAULT 24)
RETURNS TABLE(bucket TEXT, entity_type TEXT, count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT bucket, entity_type, COUNT(*) as count FROM (
    SELECT entity_type, CASE
      WHEN speed IS NULL THEN 'Unknown'
      WHEN speed < 50 THEN '0-50 kn'
      WHEN speed < 150 THEN '50-150 kn'
      WHEN speed < 300 THEN '150-300 kn'
      WHEN speed < 500 THEN '300-500 kn'
      WHEN speed < 700 THEN '500-700 kn'
      ELSE '700+ kn'
    END as bucket
    FROM position_snapshots
    WHERE sampled_at >= NOW() - (p_hours || ' hours')::INTERVAL
      AND speed IS NOT NULL
  ) sub
  GROUP BY bucket, entity_type
  ORDER BY CASE bucket
    WHEN '0-50 kn' THEN 1 WHEN '50-150 kn' THEN 2 WHEN '150-300 kn' THEN 3
    WHEN '300-500 kn' THEN 4 WHEN '500-700 kn' THEN 5 WHEN '700+ kn' THEN 6 ELSE 7
  END;
$$;

-- 7) Conflicts by zone
CREATE OR REPLACE FUNCTION analytics_conflicts_by_zone(p_hours INT DEFAULT 72)
RETURNS TABLE(zone TEXT, count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT COALESCE(zone, 'Unknown') as zone, COUNT(*) as count
  FROM conflict_events
  WHERE published_at >= NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY zone ORDER BY count DESC LIMIT 20;
$$;

-- 8) Conflicts by type
CREATE OR REPLACE FUNCTION analytics_conflicts_by_type(p_hours INT DEFAULT 72)
RETURNS TABLE(event_type TEXT, count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT COALESCE(event_type, 'unknown') as event_type, COUNT(*) as count
  FROM conflict_events
  WHERE published_at >= NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY event_type ORDER BY count DESC;
$$;

-- 9) News by source
CREATE OR REPLACE FUNCTION analytics_news_by_source(p_hours INT DEFAULT 72)
RETURNS TABLE(source TEXT, count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT COALESCE(source, 'Unknown') as source, COUNT(*) as count
  FROM news_archive
  WHERE published_at >= NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY source ORDER BY count DESC LIMIT 20;
$$;

-- 10) Alerts by severity
CREATE OR REPLACE FUNCTION analytics_alerts_by_severity(p_hours INT DEFAULT 72)
RETURNS TABLE(severity TEXT, count BIGINT) LANGUAGE sql STABLE AS $$
  SELECT severity, COUNT(*) as count
  FROM alert_archive
  WHERE timestamp >= NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY severity
  ORDER BY CASE severity
    WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5
  END;
$$;
