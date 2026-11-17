/**
 * App.jsx – LiveWar3D main application component
 * Assembles: Globe + Aircraft + Ships + News + Danger Zones + UI Panels
 */

import React, { useState, useRef, useCallback, useMemo, useEffect, lazy, Suspense } from 'react';
import * as Cesium from 'cesium';
import Globe3D from './components/Globe3D.jsx';
import AircraftLayer from './components/AircraftLayer.jsx';
import ShipLayer from './components/ShipLayer.jsx';
import DangerZoneLayer from './components/DangerZoneLayer.jsx';
import NewsLayer from './components/NewsLayer.jsx';
import ConflictLayer from './components/ConflictLayer.jsx';
import MilitaryBasesLayer from './components/MilitaryBasesLayer.jsx';
import NotableFlights from './components/NotableFlights.jsx';
import { BACKEND } from './utils/config.js';
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
import CameraLayer from './components/CameraLayer.jsx';
import CookieBanner from './components/CookieBanner.jsx';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import UserMenu from './components/UserMenu.jsx';
import PromoModal, { PromoModalTrigger } from './components/PromoModal.jsx';
import AdBanner from './components/AdBanner.jsx';
import { supabase } from './utils/supabaseClient.js';
import { useSubscription } from './hooks/useSubscription.js';
import { HelmetProvider, Helmet } from 'react-helmet-async';

// Opened on demand (or Pro-only): loaded as separate chunks so the first paint
// doesn't pay for recharts, the auth forms or the legal texts.
const SentinelPortalModal = lazy(() => import('./components/SentinelPortalModal.jsx'));
const SitrepCapture = lazy(() => import('./components/SitrepCapture.jsx'));
const HistoryPanel = lazy(() => import('./components/HistoryPanel.jsx'));
const CameraModal = lazy(() => import('./components/CameraModal.jsx'));
const LegalModal = lazy(() => import('./components/LegalModal.jsx'));
const AuthModal = lazy(() => import('./components/AuthModal.jsx'));
const NewsletterModal = lazy(() => import('./components/NewsletterModal.jsx'));
const AccountPanel = lazy(() => import('./components/AccountPanel.jsx'));

const RC_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';
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

// Max entities a logged-in free user can track at once (Pro: unlimited)
const FREE_TRACK_LIMIT = 2;

function App() {
  const isMobile = useIsMobile();
  const viewerRef = useRef(null);
  const [viewer, setViewer] = useState(null);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [entityViews, setEntityViews] = useState(0); // entity cards opened this visit (gates the promo)
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
    let stored = 'dark';
    try { stored = localStorage.getItem('milt_basemap') || 'dark'; } catch { /* storage blocked */ }
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
  const [authOpen, setAuthOpen] = useState(false);
  const [newsletterOpen, setNewsletterOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [checkoutBanner, setCheckoutBanner] = useState(() => {
    // Show success/cancel banner if redirected back from Stripe Checkout
    const params = new URLSearchParams(window.location.search);
    const status = params.get('checkout');
    if (status) {
      // Clean URL without reloading
      window.history.replaceState({}, '', window.location.pathname);
    }
    return status || null; // 'success' | 'cancel' | null
  });
  const [authUser, setAuthUser] = useState(null);

  // Listen for Supabase auth state changes (handles Google OAuth redirect return)
  useEffect(() => {
    if (!supabase) return;
    // Hydrate session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      if (session?.user) setAuthOpen(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Subscription plan (fetched from backend via /api/profile)
  const { profile, isPro, refresh: refreshSubscription } = useSubscription(authUser);

  // Back from Stripe Checkout: the plan is set by a webhook that can land a few
  // seconds after the redirect, so re-read the profile until it shows Pro
  // (before this, Pro only appeared after closing the banner or reloading).
  useEffect(() => {
    if (checkoutBanner !== 'success' || !authUser || isPro) return;
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      refreshSubscription();
      if (tries >= 10) clearInterval(id);
    }, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutBanner, authUser, isPro]);

  const [historyTrailId, setHistoryTrailId] = useState(null); // { id, ts } for HistoryPanel trail auto-load
  const [alertPanelHeight, setAlertPanelHeight] = useState(0);
  const [trackingPanelHeight, setTrackingPanelHeight] = useState(0);
  const [newsPanelHeight, setNewsPanelHeight] = useState(40);
  const [newsFeedExpanded, setNewsFeedExpanded] = useState(false);
  const [speedUnit, setSpeedUnit] = useState(() => { try { return localStorage.getItem('milt_speedUnit') || 'kt'; } catch { return 'kt'; } });
  const [altUnit, setAltUnit] = useState(() => { try { return localStorage.getItem('milt_altUnit') || 'ft'; } catch { return 'ft'; } });

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

  // Count entity cards opened (by id change) — the auto promo waits for real interaction
  const selectedKey = selectedEntity ? (selectedEntity.id ?? selectedEntity.icao24 ?? selectedEntity.title ?? 'x') : null;
  useEffect(() => {
    if (selectedKey != null) setEntityViews(n => n + 1);
  }, [selectedKey]);

  // F2: persist trackedList whenever it changes
  useEffect(() => {
    try { localStorage.setItem('milt_tracked', JSON.stringify([...trackedList])); } catch { /* ignore */ }
  }, [trackedList]);

  // Fetch conflict-zone cameras from backend once on mount
  useEffect(() => {
    const url = BACKEND + '/api/cameras';
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
        }
        if (selectedCamera) { setSelectedCamera(null); return; }
        setSelectedEntity(null);
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

  // Country and mission-type filters are Pro-only. A non-Pro user may still
  // have them saved in localStorage (e.g. after a cancelled subscription), so
  // they are ignored here rather than trusted from storage.
  const proCountry = isPro ? filters.country : 'ALL';
  const proMission = isPro ? filters.missionType : 'ALL';

  // Filtered data — deps split per-layer to avoid cross-layer re-renders (§2.3)
  const filteredAircraft = useMemo(
    () => filterAircraft(effectiveAircraft, { ...filters, country: proCountry, missionType: proMission }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveAircraft, filters.showAircraft, proCountry, filters.alliance, filters.showOnGround, proMission]
  );
  const filteredShips = useMemo(
    () => filterShips(effectiveShips, { ...filters, country: proCountry }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveShips, filters.showShips, proCountry, filters.alliance]
  );
  const liveShipCount = useMemo(
    () => filteredShips.filter(s => !s.isBaseline).length,
    [filteredShips]
  );
  const filteredNews = useMemo(
    () => filterNews(news, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [news, filters.showNews]
  );

  // P4: single memo iterates `conflicts` once per update instead of twice.
  // deps include both show-flags so toggling either still triggers a recompute.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { filteredConflicts, firmsHotspots } = useMemo(() => ({
    filteredConflicts: filters.showConflicts
      ? conflicts.filter(c => c.source !== 'NASA FIRMS')
      : [],
    firmsHotspots: filters.showFIRMS
      ? conflicts.filter(c => c.source === 'NASA FIRMS')
      : [],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [conflicts, filters.showConflicts, filters.showFIRMS]);

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

  const handleNotableSelect = useCallback((ac) => {
    setSelectedEntity(ac);
    const v = viewerRef.current;
    if (v && !v.isDestroyed() && ac?.lat != null && ac?.lon != null) {
      v.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(ac.lon, ac.lat, 500_000),
        duration: 2,
      });
    }
  }, []);

  const handleFlyToAlert = useCallback(() => {
    // Camera fly-to already handled by AlertPanel — no modal needed
  }, []);

  // ── Entity tracking ──────────────────────────────────────────────────────────────────
  // Tracking needs a free account; free accounts can follow FREE_TRACK_LIMIT
  // entities at once, Pro is unlimited.
  const handleTrack = useCallback((id, type) => {
    if (!authUser) { setAuthOpen(true); return; }
    if (!isPro && !trackedList.has(id) && trackedList.size >= FREE_TRACK_LIMIT) {
      setPricingOpen(true);
      return;
    }
    setTrackedList(prev => new Map(prev).set(id, { id, type }));
  }, [authUser, isPro, trackedList]);

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

  // F-M10: stable callbacks for CoordinateHUD (wrapped in React.memo) to avoid re-renders
  const handleToggleSpeedUnit   = useCallback(() => setSpeedUnit(u => u === 'kt' ? 'kmh' : 'kt'), []);
  const handleToggleAltUnit     = useCallback(() => setAltUnit(u => u === 'ft' ? 'm' : 'ft'), []);
  const handleOpenNewsletter    = useCallback(() => setNewsletterOpen(true), []);
  const handleOpenAuth          = useCallback(() => setAuthOpen(true), []);
  const handleOpenPricing       = useCallback(() => setPricingOpen(true), []);
  const handleOpenAccount       = useCallback(() => setAccountOpen(true), []);
  const handleLogout            = useCallback(() => setAuthUser(null), []);

  // ── Dynamic SEO title/description based on selected entity ───────────────────────────
  const seoTitle = useMemo(() => {
    if (!selectedEntity) return 'LiveWar3D — Real-Time Military Tracking on a 3D Globe';
    const e = selectedEntity;
    if (e.type === 'aircraft') {
      const id = e.callsign || e.icao || 'Unknown';
      const model = e.aircraft_type || e.model || 'Military Aircraft';
      return `${id} — ${model} | LiveWar3D`;
    }
    if (e.type === 'ship') {
      const name = e.name || e.mmsi || 'Unknown';
      const kind = e.ship_type || 'Warship';
      return `${name} — ${kind} | LiveWar3D`;
    }
    if (e.type === 'news') return `${e.title || 'Breaking News'} | LiveWar3D`;
    if (e.type === 'conflict') return `${e.name || 'Active Conflict'} — Conflict Zone | LiveWar3D`;
    return 'LiveWar3D — Real-Time Military Tracking on a 3D Globe';
  }, [selectedEntity]);

  const seoDescription = useMemo(() => {
    if (!selectedEntity) return 'Track military aircraft, warships and active conflict zones live on a free interactive 3D globe. AI threat analysis, live cameras and breaking war news.';
    const e = selectedEntity;
    if (e.type === 'aircraft') {
      const parts = [];
      if (e.callsign) parts.push(`Callsign: ${e.callsign}`);
      if (e.altitude) parts.push(`Alt: ${e.altitude}ft`);
      if (e.speed) parts.push(`Speed: ${e.speed}kt`);
      if (e.country) parts.push(e.country);
      return `Live military aircraft tracking — ${parts.join(', ')}. Real-time OSINT on LiveWar3D.`;
    }
    if (e.type === 'ship') {
      const parts = [];
      if (e.name) parts.push(e.name);
      if (e.flag) parts.push(e.flag);
      if (e.status) parts.push(e.status);
      return `Live warship tracking — ${parts.join(', ')}. Real-time naval positions on LiveWar3D.`;
    }
    if (e.type === 'news') return e.description || e.title || 'Breaking geopolitical news on LiveWar3D.';
    return 'Track active conflict zones live on LiveWar3D.';
  }, [selectedEntity]);

  const appContent = (
    <div className="w-screen h-screen overflow-hidden" style={{ background: '#050810' }}>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
      </Helmet>

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
        </ErrorBoundary>
        <ErrorBoundary name="ShipLayer" silent>
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
        {/* Free users: no globe news pins — upgrade to see geolocated news */}
        <NewsLayer
          viewer={viewer}
          news={filteredNews}
          visible={isPro && filters.showNews}
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
        {/* Free users: no live cameras */}
        <CameraLayer
          viewer={viewer}
          cameras={cameras}
          visible={isPro && filters.showCameras}
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
        onLoginClick={handleOpenAuth}
        authUser={authUser}
        onLogout={handleLogout}
        onOpenNewsletter={handleOpenNewsletter}
        onOpenLegal={setLegalPage}
        isPro={isPro}
        profile={profile}
        onOpenPricing={handleOpenPricing}
        onOpenAccount={handleOpenAccount}
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
          liveShipCount={liveShipCount}
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
          onLoginClick={handleOpenAuth}
          isPro={isPro}
          authUser={authUser}
          onOpenPricing={handleOpenPricing}
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
          isPro={isPro}
          onOpenPricing={handleOpenPricing}
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

      {/* Bottom-center: Timeline — Pro only */}
      {isPro && (
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
      )}

      {/* Bottom-right: Legend + Map layer + SITREP stacked vertically */}
      <div className="fixed z-[35] flex flex-col gap-2 items-end pointer-events-auto"
           style={{ bottom: (isMobile ? 72 : 28) + newsPanelHeight + trackingPanelHeight + 8, right: isMobile ? 8 : 16, transition: 'bottom 0.15s ease-out',
                    // cap height so AlertPanel can't overlap on small screens
                    maxHeight: `calc(100vh - ${alertPanelHeight + 80}px)` }}>
        <MapLegend isMobile={isMobile} />
        <MapLayerSwitcher basemap={basemap} onBasemapChange={(bm) => { setBasemap(bm); try { localStorage.setItem('milt_basemap', bm); } catch { /* ignore */ } }} isMobile={isMobile} />
        {/* History trails — Pro only */}
        {isPro && (
          <Suspense fallback={null}>
          <HistoryPanel viewer={viewer} isMobile={isMobile} externalTrailId={historyTrailId}
            liveCounts={{ aircraft: filteredAircraft.length, ships: filteredShips.length, alerts: alerts.length, conflicts: filteredConflicts.length, news: filteredNews.filter(n => n.lat).length }} />
          </Suspense>
        )}
        {/* SITREP capture — Pro only */}
        {isPro && (
          <Suspense fallback={null}>
          <SitrepCapture
            viewer={viewer}
            onUiHide={() => setUiHidden(true)}
            onUiShow={() => setUiHidden(false)}
            inline
          />
          </Suspense>
        )}
        {/* Upgrade nudge for free users in bottom-right toolbar */}
        {!isPro && (
          <button
            onClick={handleOpenPricing}
            className="px-3 py-1.5 rounded border border-hud-green/50 bg-hud-green/10
                       text-hud-green text-[10px] font-mono font-bold tracking-wider
                       hover:bg-hud-green/20 transition-colors duration-150"
          >
            ⚡ Upgrade to Pro
          </button>
        )}
      </div>

      {/* Monetag ad script — free users only */}
      {!isPro && (
        <AdBanner />
      )}

      {/* News cluster modal — shown when multiple items share a map area */}
      {newsCluster && (
        <NewsClusterModal
          items={newsCluster}
          onSelect={handleNewsSelect}
          onClose={() => setNewsCluster(null)}
        />
      )}

      {/* Toasts for rare airborne aircraft (bombers, emergency squawks…) */}
      <NotableFlights aircraft={filteredAircraft} onSelect={handleNotableSelect} isMobile={isMobile} />

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
        onToggleSpeedUnit={handleToggleSpeedUnit}
        altUnit={altUnit}
        onToggleAltUnit={handleToggleAltUnit}
        isPro={isPro}
        authUser={authUser}
        onOpenPricing={handleOpenPricing}
      />

      {/* SITREP capture — already rendered inline in the bottom-right container above */}
      {satellitePortal && (
        <Suspense fallback={null}>
        <SentinelPortalModal
          lat={satellitePortal.lat}
          lon={satellitePortal.lon}
          title={satellitePortal.title}
          onClose={() => setSatellitePortal(null)}
        />
        </Suspense>
      )}

      {/* Bottom: News ticker (sits above CoordinateHUD) */}
      <NewsPanel
        news={news}
        onSelectNews={handleNewsSelect}
        isMobile={isMobile}
        onHeightChange={setNewsPanelHeight}
        onExpandedChange={setNewsFeedExpanded}
        isPro={isPro}
        onOpenPricing={handleOpenPricing}
      />

      {/* Bottom: Coordinate / status bar */}
      <CoordinateHUD
        viewer={viewer}
        aircraftCount={filteredAircraft.length}
        shipCount={filteredShips.length}
        liveShipCount={liveShipCount}
        conflictCount={conflicts.length}
        connected={connected}
        isMobile={isMobile}
        onOpenLegal={setLegalPage}
        onNewsletterOpen={handleOpenNewsletter}
        speedUnit={speedUnit}
        onToggleSpeedUnit={handleToggleSpeedUnit}
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
      {selectedCamera && isPro && (
        <Suspense fallback={null}>
        <CameraModal camera={selectedCamera} onClose={() => setSelectedCamera(null)} />
        </Suspense>
      )}

      {/* Cookie consent banner */}
      <CookieBanner onOpenLegal={setLegalPage} />

      {/* Legal modals — Privacy / Cookies / Terms */}
      {legalPage && (
        <Suspense fallback={null}>
        <LegalModal page={legalPage} onClose={() => setLegalPage(null)} />
        </Suspense>
      )}

      {/* Auth modal — login / register */}
      {authOpen && (
        <Suspense fallback={null}>
        <AuthModal onClose={() => setAuthOpen(false)} onOpenLegal={setLegalPage} />
        </Suspense>
      )}

      {/* Account settings panel — profile, subscription, preferences */}
      {accountOpen && authUser && (
        <Suspense fallback={null}>
        <AccountPanel
          user={authUser}
          profile={profile}
          isPro={isPro}
          onClose={() => setAccountOpen(false)}
          onOpenPricing={handleOpenPricing}
          onOpenNewsletter={handleOpenNewsletter}
          onLogout={handleLogout}
          speedUnit={speedUnit}
          altUnit={altUnit}
          onToggleSpeedUnit={handleToggleSpeedUnit}
          onToggleAltUnit={handleToggleAltUnit}
        />
        </Suspense>
      )}

      {/* Pricing / upgrade modal (opened manually) */}
      {pricingOpen && (
        <PromoModal
          onClose={() => setPricingOpen(false)}
          authUser={authUser}
          onOpenAuth={() => { setPricingOpen(false); setAuthOpen(true); }}
        />
      )}

      {/* Auto promo modal — shows once to non-pro visitors, only after they
          have opened a second entity card and closed it (never on a timer) */}
      <PromoModalTrigger
        authUser={authUser}
        isPro={isPro}
        ready={entityViews >= 2 && !selectedEntity && !pricingOpen && !authOpen}
        onOpenAuth={() => setAuthOpen(true)}
      />

      {/* Checkout return banner */}
      {checkoutBanner && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[400] px-5 py-3 rounded-lg border font-mono text-xs shadow-xl animate-fade-in
          ${checkoutBanner === 'success'
            ? 'bg-hud-green/10 border-hud-green/50 text-hud-green'
            : 'bg-hud-amber/10 border-hud-amber/40 text-hud-amber'}`}>
          {checkoutBanner === 'success'
            ? '✓ Payment successful — your Pro plan is now active!'
            : 'Checkout cancelled — your plan has not changed.'}
          <button
            onClick={() => {
              setCheckoutBanner(null);
              if (checkoutBanner === 'success') refreshSubscription();
            }}
            className="ml-4 opacity-60 hover:opacity-100"
          >×</button>
        </div>
      )}

      {/* Newsletter subscription modal */}
      {newsletterOpen && (
        <Suspense fallback={null}>
        <NewsletterModal onClose={() => setNewsletterOpen(false)} />
        </Suspense>
      )}

      {/* Site footer — legal links for Google AdSense compliance */}
      <div
        className="fixed bottom-0 right-0 z-[20] pointer-events-auto"
        style={{ padding: '4px 10px', background: 'rgba(5,8,16,0.7)' }}
      >
        <div className="flex gap-3">
          {[
            { href: '/about.html',   label: 'About'   },
            { href: '/privacy.html', label: 'Privacy' },
            { href: '/terms.html',   label: 'Terms'   },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[9px] transition-opacity hover:opacity-100"
              style={{ color: '#4a5568', opacity: 0.7, textDecoration: 'none' }}
            >
              {label}
            </a>
          ))}
        </div>
      </div>

    </div>
  );

  const wrappedContent = RC_SITE_KEY ? (
    <GoogleReCaptchaProvider reCaptchaKey={RC_SITE_KEY}>
      {appContent}
    </GoogleReCaptchaProvider>
  ) : appContent;

  return (
    <HelmetProvider>
      {wrappedContent}
    </HelmetProvider>
  );
}

export default App;
