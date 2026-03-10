/**
 * supabaseStore.js — Historical data persistence via Supabase (PostgreSQL)
 *
 * All methods are fire-and-forget safe: they catch errors internally
 * so a Supabase outage never breaks the real-time pipeline.
 *
 * Tables: alert_archive, position_snapshots, daily_stats
 * Migration: backend/migrations/001_initial.sql
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('[Supabase] Connected →', SUPABASE_URL.replace(/https?:\/\//, '').split('.')[0]);
} else {
  console.warn('[Supabase] SUPABASE_URL or SUPABASE_ANON_KEY not set — historical storage disabled');
}

/** Check if Supabase is configured */
export function isEnabled() {
  return supabase !== null;
}

// ─── Alert Archive ──────────────────────────────────────────────────────────

// Track already-archived alert IDs to avoid re-inserting on every poll cycle
const archivedAlertIds = new Set();

/**
 * Archive new alerts. Deduplicates by alert_id so only genuinely new alerts
 * are inserted, even if alertsFromNews() re-generates the same set.
 */
export async function archiveAlerts(alerts) {
  if (!supabase || !alerts?.length) return;
  try {
    const newAlerts = alerts.filter(a => a.id && !archivedAlertIds.has(a.id));
    if (newAlerts.length === 0) return;

    const rows = newAlerts.map(a => ({
      alert_id:    a.id,
      title:       (a.title || '').slice(0, 500),
      summary:     (a.message || '').slice(0, 1000),
      severity:    a.severity,
      credibility: a.credibility ?? null,
      lat:         a.lat ?? null,
      lon:         a.lon ?? null,
      region:      a.geocodedFrom || null,
      source:      a.source || null,
      event_type:  a.type || 'news_alert',
      url:         a.url || null,
      timestamp:   a.timestamp || new Date().toISOString(),
    }));

    const { error } = await supabase.from('alert_archive').insert(rows);
    if (error) throw error;

    for (const a of newAlerts) archivedAlertIds.add(a.id);
    console.log(`[Supabase] Archived ${newAlerts.length} new alerts`);
  } catch (err) {
    console.error('[Supabase] archiveAlerts error:', err.message);
  }
}

// ─── Position Snapshots ─────────────────────────────────────────────────────

let lastPositionSave = 0;
const POSITION_INTERVAL_MS = 10 * 60_000; // every 10 minutes

/**
 * Sample current positions and insert into position_snapshots.
 * Throttled to one save every 10 minutes to conserve storage.
 */
export async function snapshotPositions(aircraft, ships) {
  if (!supabase) return;
  const now = Date.now();
  if (now - lastPositionSave < POSITION_INTERVAL_MS) return;
  lastPositionSave = now;

  try {
    const rows = [];

    // Aircraft — only those with valid positions
    for (const a of (aircraft || [])) {
      if (a.lat == null || a.lon == null) continue;
      rows.push({
        entity_type: 'aircraft',
        entity_id:   a.id || a.icao24 || a.callsign,
        callsign:    a.callsign || null,
        name:        null,
        flag:        a.country || null,
        lat:         a.lat,
        lon:         a.lon,
        altitude:    a.altitude ?? null,
        heading:     a.heading ?? a.track ?? null,
        speed:       a.velocity ?? null,
      });
    }

    // Ships
    for (const s of (ships || [])) {
      if (s.lat == null || s.lon == null) continue;
      rows.push({
        entity_type: 'ship',
        entity_id:   s.id || s.mmsi,
        callsign:    null,
        name:        s.name || null,
        flag:        s.flag || null,
        lat:         s.lat,
        lon:         s.lon,
        altitude:    null,
        heading:     s.heading ?? null,
        speed:       s.velocity ?? null,
      });
    }

    if (rows.length === 0) return;

    // Supabase has a max payload size — batch in chunks of 500
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from('position_snapshots').insert(chunk);
      if (error) throw error;
    }

    console.log(`[Supabase] Snapshot: ${rows.length} positions (${aircraft?.length || 0} ac + ${ships?.length || 0} ships)`);
  } catch (err) {
    console.error('[Supabase] snapshotPositions error:', err.message);
  }
}

// ─── Daily Stats ────────────────────────────────────────────────────────────

let lastStatsSave = '';

/**
 * Upsert today's aggregate stats. Called from pollAircraft (most frequent).
 * Only writes once per UTC date change to avoid excessive writes.
 */
export async function upsertDailyStats({ aircraftCount, shipCount, alertCount, conflictCount, newsCount, criticalAlerts }) {
  if (!supabase) return;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  if (today === lastStatsSave) return;
  lastStatsSave = today;

  try {
    const { error } = await supabase.from('daily_stats').upsert({
      date:            today,
      aircraft_count:  aircraftCount  || 0,
      ship_count:      shipCount      || 0,
      alert_count:     alertCount     || 0,
      conflict_count:  conflictCount  || 0,
      news_count:      newsCount      || 0,
      critical_alerts: criticalAlerts || 0,
    }, { onConflict: 'date' });
    if (error) throw error;
    console.log(`[Supabase] Daily stats for ${today} upserted`);
  } catch (err) {
    console.error('[Supabase] upsertDailyStats error:', err.message);
  }
}

// ─── Cleanup — purge old position snapshots ─────────────────────────────────

const RETENTION_DAYS = 14;

/**
 * Delete position snapshots older than RETENTION_DAYS.
 * Called once on startup and then once per day.
 */
export async function purgeOldSnapshots() {
  if (!supabase) return;
  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400_000).toISOString();
    const { error, count } = await supabase
      .from('position_snapshots')
      .delete()
      .lt('sampled_at', cutoff);
    if (error) throw error;
    if (count > 0) console.log(`[Supabase] Purged ${count} snapshots older than ${RETENTION_DAYS}d`);
  } catch (err) {
    console.error('[Supabase] purgeOldSnapshots error:', err.message);
  }
}
