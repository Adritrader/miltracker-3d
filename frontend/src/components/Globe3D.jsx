/**
 * Globe3D – Main CesiumJS viewer component using Resium
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Viewer, Scene, Globe, Camera } from 'resium';
import * as Cesium from 'cesium';

// IMPORTANT: Set your Cesium Ion token here or via VITE_CESIUM_ION_TOKEN env var
// Free token at: https://ion.cesium.com/
const _RAW_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN || '';
const ION_TOKEN = _RAW_TOKEN && _RAW_TOKEN !== 'your_cesium_ion_token_here' ? _RAW_TOKEN : '';

if (ION_TOKEN) {
  Cesium.Ion.defaultAccessToken = ION_TOKEN;
}

// These must be stable object references — resium treats them as read-only
// props and will destroy+recreate the entire Viewer if they ever change.
// We attach to `window` so the SAME object survives Vite HMR module re-execution;
// without this, every hot-reload in dev creates new objects → Viewer recreated.
if (!window._milCreditContainer) window._milCreditContainer = document.createElement('div');
if (!window._milContextOptions)  window._milContextOptions  = { requestWebgl2: true };
if (!window._milTerrainProvider) window._milTerrainProvider = new Cesium.EllipsoidTerrainProvider();
const CREDIT_CONTAINER = window._milCreditContainer;
const CONTEXT_OPTIONS  = window._milContextOptions;
const TERRAIN_PROVIDER = window._milTerrainProvider;

// ── Basemap providers (all free, CORS-compatible) ───────────────────────────
function buildImageryProvider(basemap) {
  switch (basemap) {
    case 'satellite':
      // ESRI World Imagery – free, no API key, proper CORS headers for browser tile requests
      return new Cesium.UrlTemplateImageryProvider({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        minimumLevel: 0, maximumLevel: 19,
        credit: new Cesium.Credit('\u00a9 Esri, Maxar, Earthstar Geographics, USDA FSA, USGS, Aerogrid, IGN, IGP, and the GIS User Community'),
      });
    case 'relief':
      return new Cesium.UrlTemplateImageryProvider({
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        subdomains: ['a', 'b', 'c'],
        minimumLevel: 0, maximumLevel: 17,
        credit: new Cesium.Credit('\u00a9 OpenTopoMap contributors'),
      });
    case 'street':
      return new Cesium.UrlTemplateImageryProvider({
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        subdomains: ['a', 'b', 'c'],
        minimumLevel: 0, maximumLevel: 19,
        credit: new Cesium.Credit('\u00a9 OpenStreetMap contributors'),
      });
    case 'light':
      return new Cesium.UrlTemplateImageryProvider({
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        subdomains: ['a', 'b', 'c', 'd'],
        minimumLevel: 0, maximumLevel: 18,
        credit: new Cesium.Credit('\u00a9 CartoDB \u00a9 OpenStreetMap contributors'),
      });
    case 'night':
      return new Cesium.UrlTemplateImageryProvider({
        url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
        subdomains: ['a', 'b', 'c', 'd'],
        minimumLevel: 0, maximumLevel: 18,
        credit: new Cesium.Credit('\u00a9 CartoDB \u00a9 OpenStreetMap contributors'),
      });
    case 'dark':
    default:
      return new Cesium.UrlTemplateImageryProvider({
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        subdomains: ['a', 'b', 'c', 'd'],
        minimumLevel: 0, maximumLevel: 18,
        credit: new Cesium.Credit('\u00a9 CartoDB \u00a9 OpenStreetMap contributors'),
      });
  }
}

// CartoDB Dark Matter — initial provider (stable ref for first render)
const IMAGERY_PROVIDER = ION_TOKEN
  ? new Cesium.IonImageryProvider({ assetId: 2 })
  : buildImageryProvider('dark');

const Globe3D = ({ onViewerReady, onEntityClick, spaceView = false, basemap = 'dark', children }) => {
  const viewerRef = useRef(null);
  const cameraInitialized = useRef(false);
  const [globeReady, setGlobeReady] = useState(false);
  const overlayRemovedRef = useRef(false);

  const handleViewerReady = useCallback((cesiumComponent) => {
    if (!cesiumComponent || !cesiumComponent.cesiumElement) return;
    const viewer = cesiumComponent.cesiumElement;

    // ── Imagery layer (imageryProvider prop removed in Cesium 1.110) ─────────
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.add(new Cesium.ImageryLayer(IMAGERY_PROVIDER));

    // ── Visual settings ────────────────────────────────────────────────────
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#050810');
    if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
    if (viewer.scene.skyBox)        viewer.scene.skyBox.show        = false;
    if (viewer.scene.sun)           viewer.scene.sun.show           = false;
    if (viewer.scene.moon)          viewer.scene.moon.show          = false;
    viewer.scene.globe.enableLighting      = false;
    viewer.scene.globe.showGroundAtmosphere = false;
    viewer.scene.fog.enabled = false;

    // ── Globe tile performance ──────────────────────────────────────────────
    // SSE 2 = Cesium default; keeps enough tile detail to show country borders.
    // Do NOT raise above 2 or borders/labels vanish at the default camera height.
    viewer.scene.globe.maximumScreenSpaceError = 2;
    viewer.scene.globe.tileCacheSize = 150;
    viewer.scene.globe.preloadAncestors = true;   // prevents tile holes during pan
    viewer.scene.globe.preloadSiblings = false;

    // ── HiDPI / Retina sharpness ──────────────────────────────────────────
    // By default Cesium renders at 1 CSS-pixel per device pixel, which looks
    // blurry on mobile Retina / 3x screens. Cap at 2× for performance.
    viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 2);

    // ── Continuous rendering for smooth entity position interpolation ─────
    // Disabled requestRenderMode so CallbackProperty-driven entities animate
    // smoothly every frame instead of only on user-interaction frames.
    viewer.scene.requestRenderMode    = false;
    viewer.clock.shouldAnimate        = true;
    viewer.clock.multiplier           = 1;

    // ── Initial camera position (only on first mount) ─────────────────────
    if (!cameraInitialized.current) {
      cameraInitialized.current = true;
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(10, 45, 8_000_000),
        orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 },
      });
    }

    // ── Click handler ──────────────────────────────────────────────────────
    viewer.screenSpaceEventHandler.setInputAction((click) => {
      // Always clear Cesium's internal selectedEntity to prevent any blue
      // selection-indicator flash (even with selectionIndicator={false} a
      // one-frame repaint can occur if selectedEntity is set internally).
      viewer.selectedEntity = undefined;

      const picked = viewer.scene.pick(click.position);
      if (Cesium.defined(picked) && Cesium.defined(picked.id)) {
        const entity = picked.id;
        if (entity._milData) {
          onEntityClick?.(entity._milData);
        }
      } else {
        onEntityClick?.(null);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // ── Right-click: deselect ──────────────────────────────────────────────
    viewer.screenSpaceEventHandler.setInputAction(() => {
      viewer.selectedEntity = undefined;
      onEntityClick?.(null);
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    // ── Double-click: zoom into entity or globe point ──────────────────────
    viewer.screenSpaceEventHandler.setInputAction((click) => {
      const picked = viewer.scene.pick(click.position);
      if (Cesium.defined(picked) && Cesium.defined(picked.id)) {
        const entity = picked.id;
        if (entity._milData?.lat != null) {
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
              entity._milData.lon, entity._milData.lat, 800_000
            ),
            duration: 1.4,
          });
        }
      } else {
        // Double-click on globe: zoom into that point
        const ray = viewer.camera.getPickRay(click.position);
        const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
        if (cartesian) {
          const carto = Cesium.Cartographic.fromCartesian(cartesian);
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromRadians(
              carto.longitude, carto.latitude,
              Math.max(viewer.camera.positionCartographic.height * 0.35, 200_000)
            ),
            duration: 1.2,
          });
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    viewerRef.current = viewer;
    onViewerReady?.(viewer);

    // ── Kill the blue flash: wait for 3 rendered frames before revealing ───
    // One postRender is not always enough — the first frame may still show
    // Cesium's default navy-blue clear color before imagery tiles paint.
    let frameCount = 0;
    const removeOnce = () => {
      if (overlayRemovedRef.current) return;
      frameCount++;
      if (frameCount < 3) return; // wait for tiles to paint
      overlayRemovedRef.current = true;
      setGlobeReady(true);
      viewer.scene.postRender.removeEventListener(removeOnce);
    };
    viewer.scene.postRender.addEventListener(removeOnce);
  }, [onViewerReady, onEntityClick]);

  // ── Basemap switching ──────────────────────────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !globeReady || viewer.isDestroyed() || ION_TOKEN) return;
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.add(new Cesium.ImageryLayer(buildImageryProvider(basemap)));
  }, [basemap, globeReady]);

  // ── Space View (realistic lighting + atmosphere) reactive to prop ────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !globeReady || viewer.isDestroyed()) return;

    if (spaceView) {
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.showGroundAtmosphere = true;
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = true;
      if (viewer.scene.skyBox)        viewer.scene.skyBox.show        = true;
      if (viewer.scene.sun)           viewer.scene.sun.show           = true;
    } else {
      viewer.scene.globe.enableLighting       = false;
      viewer.scene.globe.showGroundAtmosphere = false;
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
      if (viewer.scene.skyBox)        viewer.scene.skyBox.show        = false;
      if (viewer.scene.sun)           viewer.scene.sun.show           = false;
    }
  }, [spaceView, globeReady]);

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#050810' }}
    >
      <Viewer
        full
        ref={handleViewerReady}
        terrainProvider={TERRAIN_PROVIDER}
        baseLayer={false}
        scene3DOnly
        creditContainer={CREDIT_CONTAINER}
        contextOptions={CONTEXT_OPTIONS}
        // Disable every widget at construction
        animation={false}
        timeline={false}
        baseLayerPicker={false}
        fullscreenButton={false}
        vrButton={false}
        homeButton={false}
        infoBox={false}
        sceneModePicker={false}
        selectionIndicator={false}
        navigationHelpButton={false}
        navigationInstructionsInitiallyVisible={false}
        geocoder={false}
      >
        {children}
      </Viewer>
      {/* Dark overlay rendered ON TOP of the WebGL canvas — removed once
          scene.postRender fires. This is the only reliable way to kill the
          Cesium blue flash because CSS cannot intercept WebGL clear-color. */}
      {!globeReady && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0,
            background: '#050810',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
};

export default Globe3D;
