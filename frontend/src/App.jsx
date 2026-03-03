/**
 * App.jsx – MilTracker 3D main application component
 * Assembles: Globe + Aircraft + Ships + News + Danger Zones + UI Panels
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
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
import { useRealTimeData } from './hooks/useRealTimeData.js';
import { useIsMobile } from './hooks/useIsMobile.js';
import { filterAircraft, filterShips, filterNews } from './utils/militaryFilter.js';

const DEFAULT_FILTERS = {
  showAircraft:  true,
  showShips:     true,
  showNews:      true,
  showDanger:    true,
  showConflicts: true,
  showBases:     true,
  showOnGround:  false,
  country:   'ALL',
  alliance:  'ALL',
};

function App() {
  const isMobile = useIsMobile();
  const viewerRef = useRef(null);
  const [viewer, setViewer] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [spaceView, setSpaceView]   = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

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
    connected, aircraft, aircraftSource, ships, news, conflicts, alerts, dangerZones, aiInsight, lastUpdate,
  } = useRealTimeData();

  // Filtered data — deps split per-layer to avoid cross-layer re-renders (§2.3)
  const filteredAircraft = useMemo(
    () => filterAircraft(aircraft, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aircraft, filters.showAircraft, filters.country, filters.alliance, filters.showOnGround]
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
      const C = window.Cesium;
      if (C?.Cartesian3) {
        v.camera.flyTo({
          destination: C.Cartesian3.fromDegrees(lon, lat, 1_800_000),
          duration: 2,
        });
      }
    }
  }, []);

  const handleFlyToAlert = useCallback((alert) => {
    // Show the linked entity if available, otherwise show the alert itself for popup
    setSelectedEntity(alert.entity || alert);
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden" style={{ background: '#050810' }}>
      {/* Scanlines overlay only */}
      <div className="scan-overlay" aria-hidden="true" />

      {/* 3D Globe */}
      <Globe3D onViewerReady={handleViewerReady} onEntityClick={handleEntityClick} spaceView={spaceView}>
        {/* Data layers */}
        <AircraftLayer
          viewer={viewer}
          aircraft={filteredAircraft}
          visible={filters.showAircraft}
          onSelect={handleEntityClick}
          isMobile={isMobile}
        />
        <ShipLayer
          viewer={viewer}
          ships={filteredShips}
          visible={filters.showShips}
          onSelect={handleEntityClick}
          isMobile={isMobile}
        />
        <DangerZoneLayer
          viewer={viewer}
          dangerZones={dangerZones}
          alerts={alerts}
          visible={filters.showDanger}
        />
        <NewsLayer
          viewer={viewer}
          news={filteredNews}
          visible={filters.showNews}
          onSelect={handleEntityClick}
        />
        <ConflictLayer
          viewer={viewer}
          conflicts={conflicts}
          visible={filters.showConflicts}
          onSelect={handleEntityClick}
        />
        <MilitaryBasesLayer
          viewer={viewer}
          visible={filters.showBases}
          onSelect={handleEntityClick}
        />
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
        viewer={viewer}
        onFlyTo={handleFlyToAlert}
        isMobile={isMobile}
      />

      {/* Bottom-right: Entity detail popup */}
      <EntityPopup
        entity={selectedEntity}
        viewer={viewer}
        onClose={() => setSelectedEntity(null)}
        isMobile={isMobile}
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
    </div>
  );
}

export default App;
