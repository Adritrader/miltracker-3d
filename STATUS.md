# MILTRACKER 3D — Estado del Roadmap

> Última actualización: share link `?fly=`, modal centering flex overlay, timeline flush HUD — 2026-03-05

---

## §0 — BUGS ACTIVOS (encontrados en audit 2026-03-05)

> Estos son problemas confirmados en el código actual que necesitan arreglo.

| # | Archivo | Bug | Causa | Prioridad |
|---|---------|-----|-------|-----------|
| 0.1 | `NewsLayer.jsx` | Toggle NEWS: efecto `ds.show = visible` separado podía competir con el rebuild effect | Se eliminó el efecto de visibilidad redundante — `buildEntities` ya maneja la visibilidad via `ds.entities.removeAll()` + retorno anticipado. Sin entidades no hay nada visible aunque `ds.show = true` | ✅ Arreglado — efecto separado eliminado |
| 0.2 | `AircraftLayer.jsx` | `GHOST_TTL` y `ghostTimestampRef` dead code | Feature ghost eliminada en `3c59c30` pero no se limpió el código residual | ✅ Arreglado `34f1c42` |
| 0.3 | `AircraftLayer.jsx` + `ShipLayer.jsx` | `getDS()` hace un O(n) scan de `viewer.dataSources` en cada ciclo | Inconsistencia arquitectural | ✅ Arreglado — `dsCache` ref O(1) |
| 0.4 | `MilitaryBasesLayer.jsx` | Bases visibles a través del globo desde cualquier ángulo | `disableDepthTestDistance: Number.POSITIVE_INFINITY` — ARREGLADO en `fd13097` | ✅ Arreglado |
| 0.5 | `server.js` (línea ~32) | **CORS siempre abierto en producción** | Comentario decía "tighten in production" pero nunca se hizo | ✅ Arreglado — bloquea origen desconocido cuando `NODE_ENV=production`. Requiere setear `NODE_ENV=production` en Railway |
| 0.6 | `server.js` `hashArr()` | Si un avión cambia de altitud o heading pero no de posición, el diff hash no detecta el cambio | Hash usaba solo `id\|lat\|lon` | ✅ Arreglado — hash incluye ahora `heading` y `altitude` |
| 0.7 | `SearchBar.jsx` | Buscar un callsign devuelve 0 resultados si la capa está en OFF | SearchBar buscaba en `filteredAircraft` ya filtrado | ✅ Arreglado `34f1c42` — busca en `effectiveAircraft`/`ships` completos |
| 0.8 | `militaryFilter.js` `filterShips` | Ships no respetan `missionType` filter | Por diseño — los barcos no tienen tipos de misión aéreos. Mostrar siempre junto a los aviones filtrados es el comportamiento correcto | ✅ Por diseño — cerrado |
| 0.9 | `AircraftLayer.jsx` `_ghost` | Código `if (entity._ghost)` huérfano — `_ghost` nunca se establece | Residuo de la feature eliminada | ✅ Arreglado `34f1c42` |
| 0.10 | `positionTracker.js` | Límite de snapshots en memoria | Ya tiene cap: `HISTORY_LIMIT = 120` + `splice` al final de `recordSnapshot` | ✅ No era bug — cerrado |
| 0.11 | `newsGeocoder.js` | Geocoding falla silenciosamente — `geocodeNewsItem` retorna item sin lat/lon sin log. La noticia desaparece del globo sin avisar por qué | Sin manejo diferenciado de "no geocodeable" vs "error de red" | ✅ Arreglado — añadido `_noGeocode: true` marker + `console.debug` en modo DEV |
| 0.12 | `ConflictLayer.jsx` | Deduplicación por proximidad usaba 0.3° (~33 km). Eventos en Kiev y periferia colapsaban | La deduplicación es correcta para performance, pero borraba eventos válidos cercanos | ✅ Arreglado — reducido a 0.08° (~9 km) |
| 0.13 | `STATUS.md` item 6.1 | "Ghost tracking aviones (30% opacidad 5 min)" marcado ✅ pero la feature se eliminó intencionalmente en `3c59c30` | Documentación incorrecta | 🟢 Baja |
| 0.14 | `STATUS.md` item 10.1 | "Replay histórico" marcado ❌ pero `TimelinePanel`, `useTimeline`, `positionTracker`, historyTrack en Aircraft/ShipLayer ya implementados | Documentación incorrecta | 🟢 Baja |
| 0.15 | `FilterPanel.jsx` `Toggle` | `<label onClick>` + `<input type="checkbox">` implícito → doble-firing del evento en algunos browsers cuando se clica el texto | Se añadió `e.preventDefault()` en `6cde758` pero debería marcarse como verificado en mobile | 🟢 Baja |
| 0.16 | `firmsService.js` | `FIRMS_MAP_KEY` no está disponible en Railway — el servicio falla silenciosamente y retorna `[]` | Variable de entorno no configurada en el hosting | ⚠️ Requiere acción manual en Railway dashboard |
| 0.17 | `militaryFilter.js` | `on_ground` filter fallaba silenciosamente si la fuente ADS-B no enviaba el campo | Depende de que ADS-B envíe el campo; algunas fuentes lo omiten | ✅ Arreglado — heurística de altitud: `on_ground \|\| altitudeFt < 100 \|\| altitude < 30` |
| 0.18 | `Globe3D.jsx` + capas | Múltiples `ScreenSpaceEventHandler` registrados (AircraftLayer, NewsLayer, ConflictLayer, MilitaryBasesLayer) — cada capa añadía su propio handler. En click se disparaban todos en secuencia | Falta un único event handler central en Globe3D que delega | ✅ Arreglado — eliminados handlers de AircraftLayer, ConflictLayer, MilitaryBasesLayer. NewsLayer ahora pone `_milData` en entidades cluster (`{ type:'news-cluster', items }`) para que Globe3D las route. App.jsx `handleEntityClick` abre el modal de cluster. |

---

## §1 — Bugs Conocidos (legacy)

| # | Item | Estado |
|---|------|--------|
| 1.1 | Emoji en FilterPanel → ASCII | ✅ Hecho |
| 1.2 | FLY TO / botones → ASCII | ✅ Hecho |
| 1.3 | `isDestroyed()` guard en trails | ✅ Hecho |
| 1.4 | Ship filter países incompleto | ✅ Hecho (25 países) |
| 1.5 | `categorizeAircraft()` sin usar en UI | ✅ Hecho (mission type filter) |
| 1.6 | Gemini JSON parsing frágil | ✅ Hecho (regex `jsonMatch`) |
| 1.7 | `BACKEND_URL` hardcodeado | ✅ Hecho (`VITE_BACKEND_URL`) |
| 1.8 | `driftState` memory leak | ✅ N/A (drift eliminado con ships reales) |
| 1.9 | Conflictos dedup por título frágil | ❌→✅ Arreglado — IDs de GDELT-DOC ahora basados en `titleKey+dateKey` normalizados en vez de `encodeURIComponent(url)` |

## §2 — Performance Frontend

| # | Item | Estado |
|---|------|--------|
| 2.1 | Virtual diff con Map (no re-crear todo) | ✅ Hecho |
| 2.2 | Memoize `buildIcon()` en ConflictLayer | ✅ Hecho (`_iconCache`) |
| 2.3 | `useMemo` split por capa | ✅ Hecho |
| 2.4 | Vite `manualChunks` para CesiumJS | ❌ Revertido (causaba problemas) |
| 2.5 | Trail cap puntos | ✅ Hecho (`MAX_TRAIL_POINTS = 40`) |
| 2.6 | Cachear ref DataSource (evitar O(n) scan) | ✅ Arreglado — `dsCache` ref en AircraftLayer y ShipLayer |

## §3 — Performance Backend

| # | Item | Estado |
|---|------|--------|
| 3.1 | ADS-B timeout agresivo por fuente | ✅ `a7d066b` |
| 3.2 | GDELT límite de concurrencia | ✅ `batchedFetch` 4req/500ms — conflictService.js |
| 3.3 | Disk cache TTL al leer | ✅ Hecho |
| 3.4 | `analyzeLocalDanger` en worker thread | ❌ Pendiente |
| 3.5 | Compresión HTTP Express | ✅ Hecho |
| 3.6 | WebSocket hash-diff | ✅ Hecho |

## §4 — Arquitectura Backend

| # | Item | Estado |
|---|------|--------|
| 4.1 | Refactorizar `server.js` en módulos | ❌ Pendiente |
| 4.2 | Logging estructurado (pino) | ❌ Pendiente |
| 4.3 | Express error handler global | ✅ Hecho |
| 4.4 | Rate limiting en rutas REST | ✅ Hecho |
| 4.5 | Validación de env vars al arranque | ❌ Pendiente |

## §5 — Arquitectura Frontend

| # | Item | Estado |
|---|------|--------|
| 5.1 | Context API (evitar prop drilling) | ❌ Pendiente |
| 5.2 | `ErrorBoundary` en todas las capas | ✅ Hecho |
| 5.3 | SVG escalable (HiDPI) | ❌ Pendiente |
| 5.4 | Clases `hud-*` documentadas en Tailwind | ❌ Pendiente |

## §6 — Datos y Fuentes

| # | Item | Estado |
|---|------|--------|
| 6.1 | Ghost tracking (aviones stale 5 min) | ❌ Eliminado — causaba confusión visual (`3c59c30`) |
| 6.2 | Ships: fuente real AIS global | ✅ Hecho (AISStream 3-tier) |
| 6.3 | News geocoding filtro militar | ✅ `hasMilitaryContext()` en fetchGDELTDocConflicts |
| 6.4 | GDELT vacío vs error diferenciado | ❌ Pendiente |
| 6.5 | Events `firstSeenAt` persist (no reset de timestamps) | ✅ Hecho |

## §7 — UX / HUD

| # | Item | Estado |
|---|------|--------|
| 7.1 | AlertPanel diseño visual (pulso, bordes) | ✅ Hecho |
| 7.2 | Indicador de carga inicial | ✅ Hecho |
| 7.3 | AlertPanel límite visible + expandir | ✅ `a7d066b` |
| 7.4 | Tema claro/oscuro | ❌ Pendiente (baja prioridad) |
| 7.5 | Link FlightAware | ✅ Eliminado (no querido) |
| 7.6 | Filtro por tipo de misión | ✅ Hecho |
| 7.7 | Grid lat/lon en el globo | ❌ Pendiente |

## §8 — Seguridad

| # | Item | Estado |
|---|------|--------|
| 8.1 | CORS restrictivo por origen | ❌ Pendiente |
| 8.2 | Socket.io con autenticación token | ❌ Pendiente |
| 8.3 | Sanitizar errores en producción | ❌ Pendiente |

## §9 — Testing y Calidad

| # | Item | Estado |
|---|------|--------|
| 9.1 | Tests unitarios (Jest/Vitest) | ❌ Pendiente |
| 9.2 | Migración a TypeScript | ❌ Pendiente |
| 9.3 | ESLint configurado | ❌ Pendiente |
| 9.4 | Deduplicar `distanceKm` frontend/backend | ❌ Pendiente |

## §10 — Nuevas Funcionalidades

| # | Item | Estado |
|---|------|--------|
| 10.1 | Replay histórico (timeline) | 🔶 Parcial — `TimelinePanel`, `useTimeline`, `positionTracker` y `historyTrack` en Aircraft/ShipLayer implementados. Falta UI de scrubbing y ConflictLayer/NewsLayer no conectados al replay |
| 10.2 | Heatmap de actividad | ❌ Pendiente |
| 10.3 | Notificaciones push browser | ✅ AlertPanel.jsx — Notification API, bell icon, dedup por id |
| 10.4 | Dashboard estadísticas / gráficas | ❌ Pendiente |
| 10.5 | Búsqueda global (callsign/MMSI) | ✅ Hecho (SearchBar) |
| 10.6 | Exportar GeoJSON / KML | ❌ Pendiente |
| 10.7 | Modo presentación (sin HUD) | ❌ Pendiente |
| 10.8 | PWA (manifest + service worker) | ❌ Pendiente |
| 10.9 | Internacionalización i18n | ❌ Pendiente |
| 10.10 | Panel AI expandido (SITREP + tabs) | ✅ Hecho |

## §11 — DevOps

| # | Item | Estado |
|---|------|--------|
| 11.1 | `docker-compose.yml` | ❌ Pendiente |
| 11.2 | Script `dev` unificado en raíz | ✅ root package.json `dev` via concurrently |
| 11.3 | Build producción documentado | ❌ Pendiente |
| 11.4 | `.env.example` | ✅ Hecho |

---

## Extras fuera del Roadmap original (implementados en sesión)

| Feature | Commit |
|---------|--------|
| Modal centering (EntityPopup / NewsClusterModal / SentinelPortalModal) | `84e4eeb` |
| Share link `?fly=lat,lon,alt,hdg,pitch` + `⎘ SHARE` in CoordinateHUD | actual |
| Gold color para entidades trackeadas | `d2b6083` |
| TrackingPanel multi-entidad simultánea | anterior |
| Ship/aircraft trails con persistencia sessionStorage | anterior |
| Helicopter SVG distinto del avión | anterior |
| Country flags en billboards (código ISO) | anterior |
| MapLayerSwitcher (6 basemaps libres) | anterior |
| Satellite basemap (ESRI) | anterior |
| Basemap lock: no cambia al clicar entidades | `0a6d396` |
| Gemini API key activa | `0a6d396` |
| Mission type filter (FIGHTER/ISR/TANKER…) | `23e0053` |
| Initial load overlay "INITIALIZING SENSORS" | `23e0053` |
| ~~Ghost tracking aviones (30% opacidad 5 min)~~ | Eliminado en `3c59c30` — causaba entidades sombreadas confusas |
| Events timestamp persist (firstSeenAt, 72h TTL) | actual |
| SITREP tab con briefing local generado | `d2b6083` |

---

## §12 — Estrategia: Producción Real, SEO y Monetización

### 12.1 — Valoración SEO

CesiumJS renderiza en WebGL — el DOM está casi vacío. El SEO orgánico no funcionará bien.  
**Mejor enfoque:**
- OG / Twitter Card meta tags (`og:title`, `og:description`, `og:image` con screenshot del globo)
- Página estática `/about` en Vercel (indexable, sin WebGL)
- `document.title` dinámico con contadores en vivo: `"MilTracker 3D — 124 aircraft · 37 ships · 18 conflicts"`
- Distribución directa: Reddit (r/geopolitics, r/flightradar, r/OpenData), Twitter/X, Product Hunt

### 12.2 — Monetización (ordenada por viabilidad)

| Opción | Esfuerzo | POtencial | Notas |
|--------|----------|-----------|-------|
| **Ko-fi / Patreon** | ~1h | Bajo-medio | Botón en HUD, comunidad paga herramientas que usa — el más rápido |
| **Tier Premium** ($4.99/mes) | 1-2 días | Alto | Stripe + JWT: datos en tiempo real vs 30-min delay, alertas ilimitadas, SITREP completo |
| **Acceso API** ($20-50/mes) | 1-2 días | Medio | Para analistas/periodistas una vez acumulen datos históricos |
| **Google AdSense** | 1h | Bajo | CPM bajo en este nicho + arruina la estética del HUD militar |

### 12.3 — Features de Alto Impacto No Planificadas

| Feature | Por qué importa |
|---------|----------------|
| **Share link** `?fly=lat,lon,alt,hdg,pitch` | ✅ Hecho — CoordinateHUD `⎘ SHARE` button + Globe3D reads ?fly= on load |
| **Iframe embeddable** | ❌ Backlinks desde medios/blogs, más tráfico |

### 12.4 — Hardening de Seguridad (antes de publicar)

| # | Item | Riesgo si no se hace |
|---|------|---------------------|
| §8.1 | CORS restrictivo por origen | Cualquiera puede consumir el backend de Railway y quemar la cuota Gemini |
| §8.2 | Socket.io con token de auth | Bots pueden conectarse y saturar el server gratuito |
| §8.3 | Sanitizar errores en producción | Stack traces con rutas internas llegan al frontend |

### 12.5 — Top 5 Recomendaciones (prioridad)

```
1. PWA (§10.8)           — manifest.json + service worker → retención móvil
2. Ko-fi en HUD          — botón discreto, monetización en 1h
3. CORS + Socket auth    — §8.1 + §8.2 → protege cuota Gemini y Railway
4. Timeline / Replay     — §10.1 → mayor driver de retención de usuarios
5. Email/Telegram alerts — diferenciador vs OpenSky/MarineTraffic
```

### 12.6 — Opciones de Dirección

| Opción | Items | Tiempo estimado |
|--------|-------|----------------|
| **A — Producción segura** | §8.1 CORS + §8.2 Socket auth + §8.3 sanitizar + §10.8 PWA | ~4-6h |
| **B — Monetización primero** | Ko-fi (1h) + Share link (2h) + Stripe Premium (1-2 días) | 1h → 2 días |
| **C — Roadmap en orden** | §1.9 dedup + §4.5 env validation + §6.4 GDELT errors + §7.7 lat/lon grid | ~3-4h |
| **D — Features de impacto** | Timeline/replay (§10.1) + Email/Telegram alerts | 1-3 días |

---

**Resumen global: 43 ✅ hechos · 19 ❌ pendientes · 6 🐛 bugs activos sin resolver**

---

## §13 — Acciones Urgentes (hacer antes de publicar)

| Orden | Acción | Tiempo | Estado |
|-------|--------|--------|--------|
| 1 | Añadir `FIRMS_MAP_KEY` en Railway dashboard | 2 min | ⚠️ Requiere acción manual |
| 2 | Arreglar toggle NEWS (§0.1) | 20 min | 🟡 Verificar en live |
| 3 | **CORS** `NODE_ENV=production` en Railway (§0.5) | 2 min | ✅ Código arreglado — falta setear env en Railway |
| 4 | Limpiar dead code de ghost en AircraftLayer (§0.2, §0.9) | 10 min | ✅ Arreglado `34f1c42` |
| 5 | SearchBar buscar en array completo (§0.7) | 15 min | ✅ Arreglado `34f1c42` |
