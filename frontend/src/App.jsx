/**
 * App.jsx – LiveWar3D main application component
 * Assembles: Globe + Aircraft + Ships + News + Danger Zones + UI Panels
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import * as Cesium from 'cesium';
import Globe3D from './components/Globe3D.jsx';
import AircraftLayer from './components/AircraftLayer.jsx';
import ShipLayer from './components/ShipLayer.jsx';
import DangerZoneLayer from './components/DangerZoneLayer.jsx';
import NewsLayer from './components/NewsLayer.jsx';
import ConflictLayer from './components/ConflictLayer.jsx';
import MilitaryBasesLayer from './components/MilitaryBasesLayer.jsx';
import EntityPopup from './components/EntityPopup.jsx';
import FilterPanel from './components/FilterPanel.jsx';
import { MapLegend } from './components/FilterPanel.jsx';
import AlertPanel from './components/AlertPanel.jsx';
import NewsPanel from './components/NewsPanel.jsx';
import SearchBar from './components/SearchBar.jsx';
import CoordinateHUD from './components/CoordinateHUD.jsx';
import NewsClusterModal from './components/NewsClusterModal.jsx';
import MapLayerSwitcher from './components/MapLayerSwitcher.jsx';
import TrackingPanel from './components/TrackingPanel.jsx';
import TimelinePanel from './components/TimelinePanel.jsx';
import FIRMSLayer from './components/FIRMSLayer.jsx';
import SentinelPortalModal from './components/SentinelPortalModal.jsx';
import SitrepCapture from './components/SitrepCapture.jsx';
import HistoryPanel from './components/HistoryPanel.jsx';
import CameraLayer from './components/CameraLayer.jsx';
import CameraModal from './components/CameraModal.jsx';
import CookieBanner from './components/CookieBanner.jsx';
import LegalModal from './components/LegalModal.jsx';
import { useRealTimeData } from './hooks/useRealTimeData.js';
import { useIsMobile } from './hooks/useIsMobile.js';
import { useTimeline } from './hooks/useTimeline.js';
import { filterAircraft, filterShips, filterNews } from './utils/militaryFilter.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';

const DEFAULT_FILTERS = {
  showAircraft:  true,
  showShips:     true,
  showNews:      true,
  showDanger:    true,
  showConflicts: true,
  showFIRMS:     true,
  showBases:     true,
  showCameras:   true,
  showOnGround:  false,
  country:     'ALL',
  alliance:    'ALL',
  missionType: 'ALL',
};

function App() {
  const isMobile = useIsMobile();
  const viewerRef = useRef(null);
  const [viewer, setViewer] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [newsCluster, setNewsCluster] = useState(null); // array of news items for cluster modal
  // F1: restore filters from localStorage; merge with DEFAULT_FILTERS so new keys always have a value
  const [filters, setFilters] = useState(() => {
    try {
      const raw = localStorage.getItem('milt_filters');
      if (raw) return { ...DEFAULT_FILTERS, ...JSON.parse(raw) };
    } catch { /* ignore corrupt data */ }
    return DEFAULT_FILTERS;
  });
  const [spaceView, setSpaceView]   = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [basemap, setBasemap] = useState(() => {
    const stored = localStorage.getItem('milt_basemap') || 'dark';
    // sentinel and gibs removed from UI — fall back to dark
    return (stored === 'sentinel' || stored === 'gibs') ? 'dark' : stored;
  });

  // Tracking state — Map<id, { id, type }> supports multiple simultaneous entities
  // F2: restore from localStorage so tracked entities survive a page refresh
  const [trackedList, setTrackedList] = useState(() => {
    try {
      const raw = localStorage.getItem('milt_tracked');
      if (raw) return new Map(JSON.parse(raw));
    } catch { /* ignore */ }
    return new Map();
  });
  const [satellitePortal, setSatellitePortal] = useState(null); // { lat, lon, title }
  const [uiHidden, setUiHidden] = useState(false); // used during SITREP capture
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [legalPage, setLegalPage] = useState(null); // 'privacy' | 'cookies' | 'terms'
  const [historyTrailId, setHistoryTrailId] = useState(null); // { id, ts } for HistoryPanel trail auto-load
  const [alertPanelHeight, setAlertPanelHeight] = useState(0);
  const [trackingPanelHeight, setTrackingPanelHeight] = useState(0);
  const [newsPanelHeight, setNewsPanelHeight] = useState(40);
  const [newsFeedExpanded, setNewsFeedExpanded] = useState(false);
  const [speedUnit, setSpeedUnit] = useState(() => localStorage.getItem('milt_speedUnit') || 'kt');
  const [altUnit, setAltUnit] = useState(() => localStorage.getItem('milt_altUnit') || 'ft');

  // Persist speed unit
  useEffect(() => {
    try { localStorage.setItem('milt_speedUnit', speedUnit); } catch { /* ignore */ }
  }, [speedUnit]);
  // Persist altitude unit
  useEffect(() => {
    try { localStorage.setItem('milt_altUnit', altUnit); } catch { /* ignore */ }
  }, [altUnit]);

  // F1: persist filters whenever they change
  useEffect(() => {
    try { localStorage.setItem('milt_filters', JSON.stringify(filters)); } catch { /* ignore */ }
  }, [filters]);

  // F2: persist trackedList whenever it changes
  useEffect(() => {
    try { localStorage.setItem('milt_tracked', JSON.stringify([...trackedList])); } catch { /* ignore */ }
  }, [trackedList]);

  // Fetch conflict-zone cameras from backend once on mount
  useEffect(() => {
    const url = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001') + '/api/cameras';
    fetch(url)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setCameras(data); })
      .catch(() => {});
  }, []);

  // ─ Keyboard shortcuts ──────────────────────────────────────────────────────
  const {
    connected, aircraft, aircraftSource, ships, news, conflicts, alerts, hotspots, dangerZones, aiInsight, aiError, geminiEnabled, lastUpdate, isInitialLoad, hasCachedData, socketRef,
  } = useRealTimeData();

  // Timeline replay
  const timeline = useTimeline(socketRef);

  // Single Escape handler — priority: replay stop > modal/entity close (B9)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (timeline.replayMode) {
          timeline.controls.stop();
          return; // replay stop takes priority
        }        if (selectedCamera) { setSelectedCamera(null); return; }        setSelectedEntity(null);
        setSearchOpen(false);
        setNewsCluster(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(s => !s);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [timeline.replayMode, timeline.controls, selectedCamera]);

  // Data used by layers: replay data overrides live when in replay mode
  const effectiveAircraft = timeline.replayAircraft ?? aircraft;
  const effectiveShips    = timeline.replayShips    ?? ships;

  // Filtered data — deps split per-layer to avoid cross-layer re-renders (§2.3)
  const filteredAircraft = useMemo(
    () => filterAircraft(effectiveAircraft, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveAircraft, filters.showAircraft, filters.country, filters.alliance, filters.showOnGround, filters.missionType]
  );
  const filteredShips = useMemo(
    () => filterShips(effectiveShips, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveShips, filters.showShips, filters.country, filters.alliance]
  );
  const filteredNews = useMemo(
    () => filterNews(news, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [news, filters.showNews]
  );

  const filteredConflicts = useMemo(
    () => filters.showConflicts
          ? conflicts.filter(c => c.source !== 'NASA FIRMS')
          : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conflicts, filters.showConflicts]
  );

  const firmsHotspots = useMemo(
    () => filters.showFIRMS ? conflicts.filter(c => c.source === 'NASA FIRMS') : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conflicts, filters.showFIRMS]
  );

  const handleViewerReady = useCallback((v) => {
    viewerRef.current = v;
    setViewer(v);
  }, []);

  const handleClusterSelect = useCallback((items) => {
    setNewsCluster(items);
  }, []);

  const handleEntityClick = useCallback((entity) => {
    // §0.18: news-cluster entities now carry _milData with type='news-cluster'
    // so Globe3D's single handler can route them here instead of NewsLayer's own handler
    if (entity?.type === 'news-cluster') {
      setNewsCluster(entity.items);
    } else {
      setSelectedEntity(entity);
    }
  }, []);

  const handleNewsSelect = useCallback((newsItem) => {
    setSelectedEntity(newsItem);
    // Auto-fly camera to news location
    const v = viewerRef.current;
    const lat = newsItem?.lat ?? newsItem?.location?.lat;
    const lon = newsItem?.lon ?? newsItem?.location?.lon;
    if (v && lat != null && lon != null) {
      v.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, 1_800_000),
        duration: 2,
      });
    }
  }, []);

  const handleFlyToAlert = useCallback(() => {
    // Camera fly-to already handled by AlertPanel — no modal needed
  }, []);

  // ── Entity tracking ──────────────────────────────────────────────────────────────────
  const handleTrack = useCallback((id, type) => {
    setTrackedList(prev => new Map(prev).set(id, { id, type }));
  }, []);

  const handleUntrack = useCallback((id) => {
    if (id) {
      setTrackedList(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    } else {
      setTrackedList(new Map());
    }
  }, []);

  const handleUntrackAll = useCallback(() => {
    setTrackedList(new Map());
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden" style={{ background: '#050810' }}>
      {/* Scanlines overlay only */}
      <div className="scan-overlay" aria-hidden="true" />

      {/* 3D Globe */}
      <Globe3D onViewerReady={handleViewerReady} onEntityClick={handleEntityClick} spaceView={spaceView} basemap={basemap}>
        {/* Data layers — each wrapped in ErrorBoundary so a crash in one layer doesn't kill the globe */}
        <ErrorBoundary name="AircraftLayer" silent>
        <AircraftLayer
          viewer={viewer}
          aircraft={filteredAircraft}
          visible={filters.showAircraft}
          onSelect={handleEntityClick}
          isMobile={isMobile}
          trackedList={trackedList}
          replayMode={timeline.replayMode}
          historyTrack={timeline.historyTrack}
          speedUnit={speedUnit}
          altUnit={altUnit}
        />
        <ShipLayer
          viewer={viewer}
          ships={filteredShips}
          visible={filters.showShips}
          onSelect={handleEntityClick}
          isMobile={isMobile}
          trackedList={trackedList}
          replayMode={timeline.replayMode}
          historyTrack={timeline.historyTrack}
        />
        </ErrorBoundary>
        <ErrorBoundary name="DangerZoneLayer" silent>
        <DangerZoneLayer
          viewer={viewer}
          dangerZones={dangerZones}
          alerts={alerts}
          visible={filters.showDanger}
        />
        </ErrorBoundary>
        <ErrorBoundary name="NewsLayer" silent>
        <NewsLayer
          viewer={viewer}
          news={filteredNews}
          visible={filters.showNews}
          onSelect={handleEntityClick}
          onClusterSelect={handleClusterSelect}
          isMobile={isMobile}
        />
        </ErrorBoundary>
        <ErrorBoundary name="ConflictLayer" silent>
        <ConflictLayer
          viewer={viewer}
          conflicts={filteredConflicts}
          visible={filters.showConflicts}
          onSelect={handleEntityClick}
        />
        </ErrorBoundary>
        <ErrorBoundary name="FIRMSLayer" silent>
        <FIRMSLayer
          viewer={viewer}
          firms={firmsHotspots}
          visible={filters.showFIRMS}
          onSelect={handleEntityClick}
        />
        </ErrorBoundary>
        <ErrorBoundary name="MilitaryBasesLayer" silent>
        <MilitaryBasesLayer
          viewer={viewer}
          visible={filters.showBases}
          onSelect={handleEntityClick}
        />
        </ErrorBoundary>
        <ErrorBoundary name="CameraLayer" silent>
        <CameraLayer
          viewer={viewer}
          cameras={cameras}
          visible={filters.showCameras}
          onSelect={setSelectedCamera}
        />
        </ErrorBoundary>
      </Globe3D>

      {/* UI Overlay layers (rendered outside Viewer for performance) */}
      {/* Wrapped in a div that hides during SITREP capture so globe-only frame is recorded */}
      <div style={uiHidden ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}>

      {/* Top-center: Entity search */}
      <SearchBar
        aircraft={effectiveAircraft}
        ships={effectiveShips}
        conflicts={conflicts}
        news={news}
        viewer={viewer}
        onSelect={handleEntityClick}
        open={searchOpen}
        onOpen={() => setSearchOpen(true)}
        onClose={() => setSearchOpen(false)}
        isMobile={isMobile}
      />

      {/* Top-left: Filter controls — slides up/fades when Intel Feed expands (skip on mobile so hamburger stays reachable) */}
      <div style={isMobile ? undefined : {
        transition: 'opacity 0.15s ease-out, transform 0.15s ease-out',
        opacity: newsFeedExpanded ? 0 : 1,
        transform: newsFeedExpanded ? 'translateY(-10px)' : 'translateY(0)',
        pointerEvents: newsFeedExpanded ? 'none' : undefined,
      }}>
        <FilterPanel
          filters={filters}
          onFilterChange={setFilters}
          aircraftCount={filteredAircraft.length}
          shipCount={filteredShips.length}
          newsCount={filteredNews.filter(n => n.lat).length}
          conflictCount={filteredConflicts.length}
          alertCount={alerts.length}
          connected={connected}
          lastUpdate={lastUpdate}
          aircraftSource={aircraftSource}
          spaceView={spaceView}
          onSpaceViewChange={setSpaceView}
          isMobile={isMobile}
          onSearchOpen={() => setSearchOpen(true)}
        />
      </div>

      {/* Top-right: Threat board + AI intel — same fade when feed expands (skip on mobile) */}
      <div style={isMobile ? undefined : {
        transition: 'opacity 0.15s ease-out, transform 0.15s ease-out',
        opacity: newsFeedExpanded ? 0 : 1,
        transform: newsFeedExpanded ? 'translateY(-10px)' : 'translateY(0)',
        pointerEvents: newsFeedExpanded ? 'none' : undefined,
      }}>
        <AlertPanel
          alerts={alerts}
          hotspots={hotspots}
          aiInsight={aiInsight}
          aiError={aiError}
          geminiEnabled={geminiEnabled}
          viewer={viewer}
          onFlyTo={handleFlyToAlert}
          isMobile={isMobile}
          onHeightChange={setAlertPanelHeight}
        />
      </div>

      {/* Tracking panel — right-side floating, multi-entity */}
      <TrackingPanel
        trackedList={trackedList}
        aircraft={aircraft}
        ships={ships}
        viewer={viewer}
        onUntrack={handleUntrack}
        onUntrackAll={handleUntrackAll}
        isMobile={isMobile}
        onHeightChange={setTrackingPanelHeight}
        newsPanelHeight={newsPanelHeight}
        speedUnit={speedUnit}
        altUnit={altUnit}
      />

      {/* Bottom-center: Timeline — always visible video-controls bar (auto-fetches history on mount) */}
      <TimelinePanel
        snapshots={timeline.snapshots}
        currentIndex={timeline.currentIndex}
        playing={timeline.playing}
        speed={timeline.speed}
        replayMode={timeline.replayMode}
        currentTs={timeline.currentTs}
        controls={timeline.controls}
        trackingPanelHeight={trackingPanelHeight}
        newsPanelHeight={newsPanelHeight}
        isMobile={isMobile}
        popupOpen={!!selectedEntity}
      />

      {/* Bottom-right: Legend + Map layer + SITREP stacked vertically */}
      <div className="fixed z-[35] flex flex-col gap-2 items-end pointer-events-auto"
           style={{ bottom: (isMobile ? 72 : 28) + newsPanelHeight + trackingPanelHeight + 8, right: isMobile ? 8 : 16, transition: 'bottom 0.15s ease-out',
                    // cap height so AlertPanel can't overlap on small screens
                    maxHeight: `calc(100vh - ${alertPanelHeight + 80}px)` }}>
        <MapLegend isMobile={isMobile} />
        <MapLayerSwitcher basemap={basemap} onBasemapChange={(bm) => { setBasemap(bm); localStorage.setItem('milt_basemap', bm); }} isMobile={isMobile} />
        <HistoryPanel viewer={viewer} isMobile={isMobile} externalTrailId={historyTrailId} />
        <SitrepCapture
          viewer={viewer}
          onUiHide={() => setUiHidden(true)}
          onUiShow={() => setUiHidden(false)}
          inline
        />
      </div>

      {/* News cluster modal — shown when multiple items share a map area */}
      {newsCluster && (
        <NewsClusterModal
          items={newsCluster}
          onSelect={handleNewsSelect}
          onClose={() => setNewsCluster(null)}
        />
      )}

      {/* Bottom-right: Entity detail popup */}
      <EntityPopup
        entity={selectedEntity}
        viewer={viewer}
        onClose={() => setSelectedEntity(null)}
        isMobile={isMobile}
        trackedList={trackedList}
        onTrack={handleTrack}
        onUntrack={handleUntrack}
        onSatellite={setSatellitePortal}
        onLoadTrail={(id) => setHistoryTrailId({ id, ts: Date.now() })}
        speedUnit={speedUnit}
        onToggleSpeedUnit={() => setSpeedUnit(u => u === 'kt' ? 'kmh' : 'kt')}
        altUnit={altUnit}
        onToggleAltUnit={() => setAltUnit(u => u === 'ft' ? 'm' : 'ft')}
      />

      {/* SITREP capture — already rendered inline in the bottom-right container above */}
      {satellitePortal && (
        <SentinelPortalModal
          lat={satellitePortal.lat}
          lon={satellitePortal.lon}
          title={satellitePortal.title}
          onClose={() => setSatellitePortal(null)}
        />
      )}

      {/* Bottom: News ticker (sits above CoordinateHUD) */}
      <NewsPanel
        news={news}
        onSelectNews={handleNewsSelect}
        isMobile={isMobile}
        onHeightChange={setNewsPanelHeight}
        onExpandedChange={setNewsFeedExpanded}
      />

      {/* Bottom: Coordinate / status bar */}
      <CoordinateHUD
        viewer={viewer}
        aircraftCount={filteredAircraft.length}
        shipCount={filteredShips.length}
        conflictCount={conflicts.length}
        connected={connected}
        isMobile={isMobile}
        onOpenLegal={setLegalPage}
        speedUnit={speedUnit}
        onToggleSpeedUnit={() => setSpeedUnit(u => u === 'kt' ? 'kmh' : 'kt')}
      />

      {/* Full blocking overlay — only when there's truly nothing cached to show */}
      {isInitialLoad && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
          style={{ background: 'rgba(5,8,16,0.82)' }}
        >
          <div className="font-mono text-hud-green text-xl tracking-widest animate-pulse mb-3">
            &#9670; INITIALIZING SENSORS...
          </div>
          <div className="font-mono text-hud-text text-xs tracking-widest opacity-60">
            CONNECTING TO LIVE FEEDS
          </div>
        </div>
      )}

      {/* Non-blocking reconnecting badge — shown when cached data is displayed but socket is down */}
      {!connected && !isInitialLoad && hasCachedData && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="hud-panel px-3 py-1.5 flex items-center gap-2 text-xs font-mono border border-hud-amber/40">
            <span className="w-1.5 h-1.5 rounded-full bg-hud-amber animate-pulse" />
            <span className="text-hud-amber">RECONNECTING — SHOWING CACHED DATA</span>
          </div>
        </div>
      )}

      </div>{/* end UI overlay wrapper (uiHidden) */}

      {/* Camera live viewer modal */}
      {selectedCamera && (
        <CameraModal camera={selectedCamera} onClose={() => setSelectedCamera(null)} />
      )}

      {/* Cookie consent banner */}
      <CookieBanner onOpenLegal={setLegalPage} />

      {/* Legal modals — Privacy / Cookies / Terms */}
      {legalPage && (
        <LegalModal page={legalPage} onClose={() => setLegalPage(null)} />
      )}

    </div>
  );
}

export default App;
