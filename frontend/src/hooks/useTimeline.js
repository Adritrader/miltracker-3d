/**
 * useTimeline – manages position-replay state for MilTracker 3D.
 *
 * On mount it subscribes to the backend 'history_data' socket event and
 * loads the full snapshot ring-buffer (up to 120 frames, ~1 hour at 30s each).
 *
 * During playback the hook auto-advances currentIndex at an interval inversely
 * proportional to the chosen speed multiplier.
 *
 * Returned values:
 *   snapshots    – full array (from server)
 *   replayMode   – boolean: true while user is scrubbing / playing
 *   currentIndex – which snapshot is rendered
 *   playing      – whether the playhead is auto-advancing
 *   speed        –  1 | 5 | 20 | 60 | 120  (× real-time)
 *   progress     – 0…1  (slider value)
 *   currentTs    – ISO string of the displayed snapshot's timestamp
 *   replayAircraft / replayShips – arrays to use instead of live data
 *   controls: { play, pause, stop, seek, setSpeed, toggle, requestHistory }
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

// Base interval (ms) between snapshot advances when speed = 1×
// Each snapshot is ~30s of real time.  At 1× we want 30 000 ms steps.
const BASE_REAL_MS = 30_000; // real milliseconds each snapshot represents

export function useTimeline(socketRef) {
  const [snapshots, setSnapshots]   = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying]       = useState(false);
  const [replayMode, setReplayMode] = useState(false);
  const [speed, setSpeedState]      = useState(1);

  const timerRef  = useRef(null);
  const speedRef  = useRef(1);
  const indexRef  = useRef(0);
  const totalRef  = useRef(0);
  const replayModeRef = useRef(false); // kept in sync to avoid stale closures (B10/O11)

  // Keep refs in sync
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { indexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { totalRef.current = snapshots.length; }, [snapshots]);
  useEffect(() => { replayModeRef.current = replayMode; }, [replayMode]);

  // ── helpers ──────────────────────────────────────────────────────────────
  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    const intervalMs = Math.max(50, BASE_REAL_MS / speedRef.current);
    timerRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        const next = prev + 1;
        if (next >= totalRef.current) {
          // Reached live — stop replay
          setPlaying(false);
          setReplayMode(false);
          stopTimer();
          return totalRef.current - 1;
        }
        return next;
      });
    }, intervalMs);
  }, [stopTimer]);

  // ── socket subscription ───────────────────────────────────────────────────
  useEffect(() => {
    const socket = socketRef?.current;
    if (!socket) return;

    const handler = ({ snapshots: snaps }) => {
      if (!snaps || snaps.length === 0) return;
      setSnapshots(snaps);
      // Use ref to avoid reading stale replayMode from closure (B10/O11)
      setCurrentIndex(prev => {
        if (replayModeRef.current) return Math.min(prev, snaps.length - 1);
        return snaps.length - 1;
      });
    };
    socket.on('history_data', handler);
    return () => socket.off('history_data', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketRef]);

  // ── controls ─────────────────────────────────────────────────────────────
  const requestHistory = useCallback(() => {
    socketRef?.current?.emit('request_history');
  }, [socketRef]);

  const play = useCallback(() => {
    if (snapshots.length === 0) return;
    setReplayMode(true);
    setPlaying(true);
    // If already at end, rewind first
    setCurrentIndex(prev => (prev >= snapshots.length - 1 ? 0 : prev));
    startTimer();
  }, [snapshots.length, startTimer]);

  const pause = useCallback(() => {
    setPlaying(false);
    stopTimer();
  }, [stopTimer]);

  const stop = useCallback(() => {
    stopTimer();
    setPlaying(false);
    setReplayMode(false);
    setCurrentIndex(snapshots.length > 0 ? snapshots.length - 1 : 0);
  }, [stopTimer, snapshots.length]);

  const seek = useCallback((idx) => {
    const clamped = Math.max(0, Math.min(idx, snapshots.length - 1));
    setCurrentIndex(clamped);
    setReplayMode(true);
    setPlaying(false);
    stopTimer();
  }, [snapshots.length, stopTimer]);

  const setSpeed = useCallback((s) => {
    setSpeedState(s);
    speedRef.current = s;
    // Restart timer with new interval if playing
    if (playing) startTimer();
  }, [playing, startTimer]);

  const toggle = useCallback(() => {
    if (playing) pause(); else play();
  }, [playing, pause, play]);

  // ── cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => () => stopTimer(), [stopTimer]);

  // ── derived values ────────────────────────────────────────────────────────
  const current = snapshots[currentIndex];
  const currentTs = current?.ts ?? null;
  const progress  = snapshots.length > 1 ? currentIndex / (snapshots.length - 1) : 1;

  const replayAircraft = useMemo(() => {
    if (!replayMode || !current) return null;
    return current.aircraft || [];
  }, [replayMode, current]);

  const replayShips = useMemo(() => {
    if (!replayMode || !current) return null;
    return current.ships || [];
  }, [replayMode, current]);

  // For trail rendering: accumulate aircraft/ship positions up to currentIndex.
  // Incremental update when index advances; full rebuild on seek backwards (P1).
  const historyTrackRef   = useRef({});
  const prevTrackIndexRef = useRef(-1);
  const prevSnapshotsRef  = useRef(null);

  const historyTrack = useMemo(() => {
    if (!replayMode || snapshots.length === 0) {
      historyTrackRef.current = {};
      prevTrackIndexRef.current = -1;
      prevSnapshotsRef.current = null;
      return {};
    }
    // Full rebuild when seeking backwards or when the snapshots array grows/changes
    const needFullRebuild =
      currentIndex < prevTrackIndexRef.current ||
      snapshots.length !== (prevSnapshotsRef.current?.length ?? -1); // F-M4: compare by length, not reference
    if (needFullRebuild) {
      const track = {};
      for (const snap of snapshots.slice(0, currentIndex + 1)) {
        for (const ac of (snap.aircraft || [])) {
          if (!track[ac.id]) track[ac.id] = [];
          track[ac.id].push({ lat: ac.lat, lon: ac.lon, heading: ac.heading, ts: snap.ts });
        }
        for (const sh of (snap.ships || [])) {
          if (!track[sh.id]) track[sh.id] = [];
          track[sh.id].push({ lat: sh.lat, lon: sh.lon, heading: sh.heading, ts: snap.ts });
        }
      }
      historyTrackRef.current = track;
    } else {
      // Incremental: only process snapshots added since last computation
      const startFrom = prevTrackIndexRef.current < 0 ? 0 : prevTrackIndexRef.current + 1;
      const track = historyTrackRef.current;
      for (let i = startFrom; i <= currentIndex; i++) {
        const snap = snapshots[i];
        if (!snap) continue;
        for (const ac of (snap.aircraft || [])) {
          if (!track[ac.id]) track[ac.id] = [];
          track[ac.id].push({ lat: ac.lat, lon: ac.lon, heading: ac.heading, ts: snap.ts });
        }
        for (const sh of (snap.ships || [])) {
          if (!track[sh.id]) track[sh.id] = [];
          track[sh.id].push({ lat: sh.lat, lon: sh.lon, heading: sh.heading, ts: snap.ts });
        }
      }
    }
    prevTrackIndexRef.current = currentIndex;
    prevSnapshotsRef.current = snapshots;
    return { ...historyTrackRef.current }; // new object ref triggers downstream re-render
  }, [replayMode, snapshots, currentIndex]);

  return {
    snapshots,
    replayMode,
    currentIndex,
    playing,
    speed,
    progress,
    currentTs,
    replayAircraft,
    replayShips,
    historyTrack,
    controls: { play, pause, stop, seek, setSpeed, toggle, requestHistory },
  };
}
