/**
 * App.jsx – MilTracker 3D main application component
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
import AlertPanel from './components/AlertPanel.jsx';
import NewsPanel from './components/NewsPanel.jsx';
import SearchBar from './components/SearchBar.jsx';
import CoordinateHUD from './components/CoordinateHUD.jsx';
import MapLayerSwitcher from './components/MapLayerSwitcher.jsx';
import TrackingPanel from './components/TrackingPanel.jsx';
import { useRealTimeData } from './hooks/useRealTimeData.js';
import { useIsMobile } from './hooks/useIsMobile.js';
import { filterAircraft, filterShips, filterNews } from './utils/militaryFilter.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';

const DEFAULT_FILTERS = {
  showAircraft:  true,
  showShips:     true,
  showNews:      true,
  showDanger:    true,
  showConflicts: true,
  showBases:     true,
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
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [spaceView, setSpaceView]   = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [basemap, setBasemap]       = useState(() => localStorage.getItem('milt_basemap') || 'dark');

  // Tracking state — Map<id, { id, type }> supports multiple simultaneous entities
  const [trackedList, setTrackedList] = useState(new Map());

  // ─ Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setSelectedEntity(null);
        setSearchOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(s => !s);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const {
    connected, aircraft, aircraftSource, ships, news, conflicts, alerts, dangerZones, aiInsight, geminiEnabled, lastUpdate, isInitialLoad,
  } = useRealTimeData();

  // Filtered data — deps split per-layer to avoid cross-layer re-renders (§2.3)
  const filteredAircraft = useMemo(
    () => filterAircraft(aircraft, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aircraft, filters.showAircraft, filters.country, filters.alliance, filters.showOnGround, filters.missionType]
  );
  const filteredShips = useMemo(
    () => filterShips(ships, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ships, filters.showShips, filters.country]
  );
  const filteredNews = useMemo(
    () => filterNews(news, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [news, filters.showNews]
  );

  const handleViewerReady = useCallback((v) => {
    viewerRef.current = v;
    setViewer(v);
  }, []);

  const handleEntityClick = useCallback((entity) => {
    setSelectedEntity(entity);
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

  const handleFlyToAlert = useCallback((alert) => {
    // Show the linked entity if available, otherwise show the alert itself for popup
    setSelectedEntity(alert.entity || alert);
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
        />
        </ErrorBoundary>
        <ErrorBoundary name="ShipLayer" silent>
        <ShipLayer
          viewer={viewer}
          ships={filteredShips}
          visible={filters.showShips}
          onSelect={handleEntityClick}
          isMobile={isMobile}
          trackedList={trackedList}
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
        />
        </ErrorBoundary>
        <ErrorBoundary name="ConflictLayer" silent>
        <ConflictLayer
          viewer={viewer}
          conflicts={conflicts}
          visible={filters.showConflicts}
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
      </Globe3D>

      {/* UI Overlay layers (rendered outside Viewer for performance) */}

      {/* Top-center: Entity search */}
      <SearchBar
        aircraft={filteredAircraft}
        ships={filteredShips}
        conflicts={conflicts}
        news={filteredNews}
        viewer={viewer}
        onSelect={handleEntityClick}
        open={searchOpen}
        onOpen={() => setSearchOpen(true)}
        onClose={() => setSearchOpen(false)}
        isMobile={isMobile}
      />

      {/* Top-left: Filter controls */}
      <FilterPanel
        filters={filters}
        onFilterChange={setFilters}
        aircraftCount={filteredAircraft.length}
        shipCount={filteredShips.length}
        newsCount={filteredNews.filter(n => n.lat).length}
        conflictCount={conflicts.length}
        alertCount={alerts.length}
        connected={connected}
        lastUpdate={lastUpdate}
        aircraftSource={aircraftSource}
        spaceView={spaceView}
        onSpaceViewChange={setSpaceView}
        isMobile={isMobile}
        onSearchOpen={() => setSearchOpen(true)}
      />

      {/* Top-right: Threat board + AI intel */}
      <AlertPanel
        alerts={alerts}
        aiInsight={aiInsight}
        geminiEnabled={geminiEnabled}
        viewer={viewer}
        onFlyTo={handleFlyToAlert}
        isMobile={isMobile}
      />

      {/* Tracking panel — right-side floating, multi-entity */}
      <TrackingPanel
        trackedList={trackedList}
        aircraft={aircraft}
        ships={ships}
        viewer={viewer}
        onUntrack={handleUntrack}
        onUntrackAll={handleUntrackAll}
        isMobile={isMobile}
      />

      {/* Bottom-right: Map layer switcher */}
      <MapLayerSwitcher basemap={basemap} onBasemapChange={(bm) => { setBasemap(bm); localStorage.setItem('milt_basemap', bm); }} isMobile={isMobile} />

      {/* Bottom-right: Entity detail popup */}
      <EntityPopup
        entity={selectedEntity}
        viewer={viewer}
        onClose={() => setSelectedEntity(null)}
        isMobile={isMobile}
        trackedList={trackedList}
        onTrack={handleTrack}
        onUntrack={handleUntrack}
      />

      {/* Bottom: News ticker (sits above CoordinateHUD) */}
      <NewsPanel
        news={news}
        onSelectNews={handleNewsSelect}
        isMobile={isMobile}
      />

      {/* Bottom: Coordinate / status bar */}
      <CoordinateHUD
        viewer={viewer}
        aircraft={filteredAircraft}
        ships={filteredShips}
        conflicts={conflicts}
        connected={connected}
        isMobile={isMobile}
      />

      {/* Initial load overlay */}
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
    </div>
  );
}

export default App;
