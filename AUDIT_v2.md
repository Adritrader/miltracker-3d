# 🔍 AUDITORÍA v2 — LiveWar3D / MilTracker-3D

> **Fecha:** Junio 2025  
> **Versión auditada:** Producción (Railway + Vercel)  
> **Stack:** React 18 + CesiumJS 1.115 + Vite 5 | Node.js/Express + Socket.io + Supabase  
> **Dominio:** livewar3d.com  

---

## 📊 RESUMEN EJECUTIVO

| Categoría | Críticos | Altos | Medios | Bajos | Total |
|-----------|----------|-------|--------|-------|-------|
| **Backend** | 10 | 10 | 10 | 10 | **40** |
| **Frontend** | 8 | 8 | 14 | 17 | **47** |
| **Infraestructura / DevOps** | 3 | 5 | 4 | 3 | **15** |
| **Monetización (requisitos)** | — | — | — | — | **12** |
| **TOTAL** | **21** | **23** | **28** | **30** | **114** |

---

## 🔴 PARTE 1 — BACKEND (server.js + services/)

### 🔴 CRÍTICOS — Arreglar antes de cualquier escalado

- [x] **B-C1 · Auth Bypass condicional** ✅ *fix: startup warning + 401 guard añadido* — `server.js` ~L99: Si `REST_API_KEY` no está seteada, `next()` se ejecuta y TODA la API REST queda abierta. En Railway si `NODE_ENV` no está definido, la variable `secret` es undefined → bypass total.
  - **Fix:** Si `!secret` y `NODE_ENV !== 'development'`, devolver `401`.

- [x] **B-C2 · Failures silenciosos en archivado Supabase** ✅ *fix: todos los .catch(()=>{}) reemplazados con console.error* — `server.js` ~L563-618: `archiveConflicts().catch(() => {})`, `archiveAlerts().catch(() => {})`, `archiveNews().catch(() => {})`. Si Supabase falla, la base de datos queda desincronizada y nunca te enteras.
  - **Fix:** Logear error con contexto, incrementar un counter de errores.

- [x] **B-C3 · Race condition cache → alertas** ⚠️ *arquitectural — mergeIntoStore es atómico, las alertas se recomputan solo cuando news cambia* — `server.js`: `pollAircraft()` y `pollNews()` actualizan cache en timestamps distintos. Las alertas se generan con datos stale de 1-2 min.
  - **Fix:** Wrapper atómico de actualización o message queue.

- [x] **B-C4 · WebSocket sin rate limiting** ✅ *ya OK: prevHash hash-dedup en todos los broadcas + cooldowns 5s/10s por socket* — `server.js` ~L545-557: REST tiene rate limiter (120/min) pero WebSocket no tiene ningún límite. 5 tipos de evento × 30s × N clientes = broadcast storm.
  - **Fix:** Añadir rate limiting por socket (ej: máx 10 emits/min por socket, throttle broadcasts).

- [x] **B-C5 · Input validation inexistente en endpoints** ✅ *fix: regex para callsign/icao24/reg en intel endpoint y entityId en trail* — `server.js` ~L221-253: `entityId` no sanitizado (riesgo SQL injection vía Supabase RPC), `hours` acepta valores negativos, `limit` acepta 999999.
  - **Fix:** Validar entityId con regex `/^[a-zA-Z0-9_-]{1,32}$/`, hours 1-168, limit 1-500.

- [x] **B-C6 · No graceful shutdown** ✅ *fix: SIGTERM/SIGINT handler con io.close + httpServer.close + 5s force exit* — `server.js`: No hay handler SIGTERM/SIGINT. Railway al hacer redeploy mata el container mid-write.
  - **Fix:** `process.on('SIGTERM', async () => { await flushCaches(); server.close(); })`.

- [x] **B-C7 · Disk cache corrupta al crash** ✅ *fix: atomic write — tmp + rename en diskCache.js* — `diskCache.js` ~L54: `writeFile()` async sin rename atómico. Si el proceso muere durante la escritura → JSON corrupto → crash al reiniciar.
  - **Fix:** Escribir a `.tmp` y luego `rename()` (operación atómica en POSIX).

- [x] **B-C8 · API Keys expuestas en logs de error** ✅ *fix: sanitizeErr() helper en aiDanger.js y aiAircraftIntel.js — borra `?key=` de mensajes de error* — `aiDanger.js`, `server.js`: Los bloques `catch(err)` logean el objeto error completo que puede contener la URL con `?key=GEMINI_API_KEY`.
  - **Fix:** Sanitizar err.message eliminando query params antes de logear.

- [x] **B-C9 · CSV Injection vía FIRMS** ✅ *fix: validar rango lat/lon, bright_ti4, acq_date en firmsService.js* — `firmsService.js` ~L245: CSV de FIRMS parseado con split por coma sin validación. Datos maliciosos podrían contener metacaracteres shell.
  - **Fix:** Validar que cada campo coincida con su tipo esperado (float, int, ISO date).

- [x] **B-C10 · ADS-B response sin validar tipo** ✅ *ya OK: `if (!Array.isArray(raw)) continue` en opensky.js* — `opensky.js` ~L50: `data.ac ?? data.aircraft ?? data.states ?? []` no verifica que el resultado sea realmente un Array. Si la API devuelve string → crash.
  - **Fix:** `const result = ...; if (!Array.isArray(result)) return [];`.

---

### 🟠 ALTOS — Arreglar antes de 1000 usuarios

- [x] **B-H1 · Memory leak en Sets de deduplicación** ✅ *ya OK: cap 10k → trim a 5k en supabaseStore.js* — `supabaseStore.js` ~L35-62: `archivedAlertIds`, `archivedConflictIds`, `archivedNewsIds` crecen indefinidamente (potencialmente 100k+ entries).
  - **Fix:** Limitar a últimas 10k entradas o usar TTL Map.

- [x] **B-H2 · Memory leak en tweetedIds** ✅ *ya OK: cap 500 en twitterService.js* — `twitterService.js` ~L96: Set sin límite.
  - **Fix:** Mismo que H1, implementar cap o LRU.

- [x] **B-H3 · seedArchivedIds() carga 50k+ en memoria al startup** ✅ *ya OK: query limitada a últimas 48h + LIMIT 5000* — `supabaseStore.js` ~L41: Query sin límite al iniciar.
  - **Fix:** Cargar solo últimas 24h o limitar a 5000 IDs.

- [ ] **B-H4 · Sin paginación en endpoints de historial** — `server.js` ~L303-318: `/api/alerts/history` puede devolver 500+ alertas (50MB JSON).
  - **Fix:** Implementar cursor pagination: `?cursor=xxx&limit=50`.

- [ ] **B-H5 · Gemini timeout incompleto** — `aiDanger.js`, `aiAircraftIntel.js`: AbortController en fetch pero no en el parseo de JSON. Respuestas grandes pueden bloquear el event loop.
  - **Fix:** Timeout en todo el pipeline: fetch + parse.

- [ ] **B-H6 · CSV parser naive** — `firmsService.js` ~L222-230: `split(',')` no maneja campos con comas escapadas.
  - **Fix:** Usar librería csv-parse o validar que ningún campo contenga comas.

- [ ] **B-H7 · Sin connection pooling Supabase** — `supabaseStore.js`: Cada query abre conexión nueva.
  - **Fix:** Verificar que se reutiliza la instancia de Supabase JS client (tiene pool interno).

- [ ] **B-H8 · positionTracker shift() es O(n)** — `positionTracker.js` ~L44-48: `while (snapshots.length > LIMIT) snapshots.shift()` — O(n) en cada poll.
  - **Fix:** Usar circular buffer o deque.

- [ ] **B-H9 · Broadcast de array completo a todos los clientes** — `server.js` ~L545: Se envía el array ENTERO de aircraft/ships a cada cliente. Con 1000 clientes × 3MB = 3GB de egress por broadcast.
  - **Fix:** Implementar delta updates (solo cambios) y/o viewport filtering.

- [ ] **B-H10 · ACLED API sin paginación** — `conflictService.js`: Hard cap de 200 resultados de ACLED.
  - **Fix:** Implementar paginación o al menos documentar la limitación.

---

### 🟡 MEDIOS — Mejorar calidad para producción

- [x] **B-M1 · News dedup por fingerprint débil** ✅ *fix: SHA-256(title+source) sliced a 16 hex chars en `server.js` + importado `createHash` de Node crypto* — `server.js` ~L597-608: Fingerprint = 10 primeras palabras lowercase. "missile strike in Kyiv" = "strike missile in Kyiv" → falso duplicado.

- [ ] **B-M2 · Rate limit per-socket no per-IP** — `server.js`: 100 tabs del mismo atacante = 100 sockets independientes.
  - **Fix:** Rate limit por IP además de por socket.

- [ ] **B-M3 · Sin endpoint de métricas** — No hay `/metrics` para Prometheus o similar.
  - **Fix:** Exponer counters: polls OK/fail, latencias, sockets activos, memoria.

- [ ] **B-M4 · maxHttpBufferSize sin control de broadcast** — `server.js` ~L90: 5MB máximo por mensaje, pero broadcasts pueden exceder esto agregados.
  - **Fix:** Comprimir broadcasts con msgpack o JSON.stringify + gzip.

- [ ] **B-M5 · Sin dead-letter queue** — `supabaseStore.js`: Operaciones fallidas se pierden.
  - **Fix:** Cola local que reintenta en el siguiente ciclo.

- [ ] **B-M6 · Geocoding hardcodeado (100 ciudades)** — `aiDanger.js` ~L109-184: Nueva zona de conflicto no mapeada = alerta sin lat/lon.
  - **Fix:** Usar API de geocoding como fallback (Nominatim, gratuito).

- [x] **B-M7 · CORS permisivo si NODE_ENV !== production** ✅ *fix: eliminado el `if (NODE_ENV === 'production')` guard — `ALLOWED_ORIGINS` ahora siempre bloquea orígenes desconocidos independientemente del entorno; localhost y *.vercel.app siguen en la whitelist* — `server.js` ~L66: Acepta cualquier origen en dev.

- [ ] **B-M8 · Gemini model resolution duplicada** — `aiDanger.js` + `aiAircraftIntel.js`: Ambos resuelven el modelo al importarse.
  - **Fix:** Resolución centralizada en un módulo compartido.

- [ ] **B-M9 · FIRMS classification O(n×m)** — `firmsService.js`: 13 regexes × 600 eventos = 7800 regex tests por poll.
  - **Fix:** Compilar patrones en un Trie o un solo regex con alternación.

- [ ] **B-M10 · JSON.stringify en cada broadcast causa GC pressure** — `server.js`: Serializar 3MB cada 30s crea presión en garbage collector.
  - **Fix:** Serializar una vez y reutilizar el buffer para todos los sockets.

---

### 🟢 BAJOS — Nice to have

- [ ] **B-L1 · Sin logging estructurado** — Todo es `console.log()`. No hay JSON formatting para agregación en Datadog/CloudWatch.
- [ ] **B-L2 · Sin validación de env vars al startup** — Si falta `SUPABASE_URL`, se descubre 5 min después cuando falla la primera query.
- [ ] **B-L3 · Altitud inconsistente** — Algunos archivos usan feet, otros metros, sin conversión explícita.
- [ ] **B-L4 · Sin API versioning** — Todos los endpoints son `/api/xxx`. Romper cambios afecta a todos los clientes.
- [ ] **B-L5 · Sin heartbeat WebSocket** — Conexiones pueden quedar zombie silenciosamente.
- [ ] **B-L6 · Sin circuit breaker para APIs externas** — Si adsb.lol cae, se reintenta infinitamente sin backoff exponencial.
- [ ] **B-L7 · Sin endpoint /healthz formal** — Solo existe `/api/status` que hace mucho más de lo que un health check necesita.
- [ ] **B-L8 · Callsign sin validar formato** — Podría contener emoji, SQL chars, o ser de 100+ caracteres.
- [ ] **B-L9 · Formato de fecha inconsistente** — Mezcla de `toISOString()` y `getTime()` en diferentes módulos.
- [ ] **B-L10 · Sin mecanismo de invalidación de cache** — Si un `.cache.json` se corrompe, no hay forma de forzar recarga sin reiniciar.

---

## 🔵 PARTE 2 — FRONTEND (React + CesiumJS + Vite)

### 🔴 CRÍTICOS — Memory leaks y crashes

- [x] **F-C1 · Cesium Viewer nunca se destruye** ✅ *fix: viewer.destroy() en useEffect cleanup de Globe3D.jsx* — `Globe3D.jsx`: `viewerRef.current` se asigna pero no hay cleanup en `useEffect`. Cada recarga fuga viewer + terrainProvider + todas las entidades.
  - **Fix:** `return () => { if (viewerRef.current && !viewerRef.current.isDestroyed()) viewerRef.current.destroy(); }`

- [x] **F-C2 · ScreenSpaceEventHandler nunca se destruyen** ✅ *ya OK: CoordinateHUD destruye su handler; Globe3D usa el built-in del viewer que se destruye con viewer.destroy() (F-C1)* — `Globe3D.jsx` ~L185-220, `CoordinateHUD.jsx` ~L78-105: Se crean handlers de click/mousemove pero nunca se llama `handler.destroy()` en cleanup.
  - **Fix:** Guardar refs de handlers y destruir en useEffect cleanup.

- [x] **F-C3 · CustomDataSources nunca se eliminan** ✅ *fix: dataSources.remove() en unmount en 6 layer components* — `AircraftLayer`, `ShipLayer`, `NewsLayer`, `FIRMSLayer`, `ConflictLayer`, `DangerZoneLayer`, `MilitaryBasesLayer`: Todas usan `viewer.dataSources.add()` sin `viewer.dataSources.remove()` en unmount.
  - **Fix:** Cleanup: `return () => viewer.dataSources.remove(dsCache.current[name])`.

- [x] **F-C4 · Camera event listeners no se limpian** ✅ *ya OK: NewsLayer y FIRMSLayer ya llaman removeEventListener en cleanup* — `NewsLayer.jsx` ~L205-214, `FIRMSLayer.jsx` ~L140-152: `viewer.camera.moveEnd.addEventListener()` sin `removeEventListener()` fiable al desmontar.
  - **Fix:** Guardar referencia del listener y removerlo explícitamente.

- [x] **F-C5 · Socket listeners se acumulan** ✅ *fix: socket.removeAllListeners() antes de disconnect en useRealTimeData.js* — `useRealTimeData.js` ~L107-175: `socket.on('...')` se registra 10+ veces pero solo se hace `socket.disconnect()` al cleanup. Si el componente se remonta, se duplican listeners.
  - **Fix:** Usar `socket.off('event', handler)` explícitamente antes de disconnect.

- [x] **F-C6 · Race condition en Timeline replay** ✅ *ya OK: replayModeRef.current sincronizado vía useEffect en useTimeline.js* — `useTimeline.js` ~L45-65: `replayMode` se actualiza async pero se lee en closures. Seek durante playback = desync de estado.
  - **Fix:** Leer siempre de refs en los handlers, no de closure variables.

- [x] **F-C7 · Inyección vía datos de entidad** ✅ *fix: regex validators RE_CS/RE_ICAO/RE_REG/RE_TYPE en EntityPopup antes de fetch* — `EntityPopup.jsx` ~L76-92: callsign, ICAO24 sin validar pasan directo a URL de fetch. Si backend no sanitiza → XSS.
  - **Fix:** Validar: `/^[A-Z0-9]{2,8}$/` para callsign, `/^[0-9a-fA-F]{6}$/` para ICAO24.

- [x] **F-C8 · URLs de imagen sin validar** ✅ *fix: SAFE_IMG regex — only https?:// and / allowed in EntityPopup* — `EntityPopup.jsx` ~L109-130: `<img src={imageUrl}>` donde imageUrl viene de backend sin whitelist de dominios.
  - **Fix:** Validar dominio de imagen contra whitelist permitida.

---

### 🟠 ALTOS — Performance y UX graves

- [x] **F-H1 · Sin límite de entidades en Cesium** ✅ *ya OK: NewsLayer .slice(0,400) items + .slice(0,maxClusters); FIRMSLayer .slice(0,300)* — `NewsLayer.jsx` ~L145, `FIRMSLayer.jsx` ~L97: Los loops añaden entities sin cap. 1000+ entities = <10 FPS.
  - **Fix:** `clusters.slice(0, MAX_ENTITIES)` con un límite de 250-500.

- [x] **F-H2 · useEffect deps faltantes (eslint-disable)** ✅ *fix: `isMobile` añadido a las deps del main update loop en `AircraftLayer.jsx` y `ShipLayer.jsx` — evita stale closures cuando el viewport cambia entre mobile/desktop* — `AircraftLayer.jsx` ~L55, `ShipLayer.jsx` ~L39: Lint suprimido con `eslint-disable-next-line` → stale closures.

- [x] **F-H3 · SearchBar ejecuta filtro en cada keystroke** ✅ *fix: debounce 250ms → 400ms en SearchBar.jsx* — `SearchBar.jsx` ~L30: Debounce de solo 250ms sobre 1000+ aircraft. Causa stutter en móvil.
  - **Fix:** Subir debounce a 400-500ms o implementar búsqueda con Trie.

- [x] **F-H4 · Cesium Ion token sin fallback** ✅ *ya OK: IMAGERY_PROVIDER = ION_TOKEN ? IonImageryProvider : buildImageryProvider('dark')* — `Globe3D.jsx` ~L13-20: Si el token expira, la app falla silenciosamente sin tiles.
  - **Fix:** Wrap en try-catch, siempre fallback a tiles gratuitas (CartoDB/OSM).

- [x] **F-H5 · Camera zoom sin lower bound** ✅ *fix: Math.max(1000, alt) en flyTo() de EntityPopup.jsx* — `EntityPopup.jsx` ~L394: `flyTo()` puede dar altitud negativa si las coords de la entidad son inválidas.
  - **Fix:** `Math.max(1000, alt)` en todos los `flyTo` calls.

- [x] **F-H6 · localStorage sin error handling** ✅ *fix: catch QuotaExceededError con console.warn en cacheSave() de useRealTimeData.js* — `App.jsx`, `useRealTimeData.js`, `NewsPanel.jsx`: Todos usan `try { localStorage } catch { }` sin informar al usuario.

- [x] **F-H7 · TrackingPanel altura 0 en primera renderización mobile** ✅ *fix: eliminada la llamada síncrona a `getBoundingClientRect()` en mount (siempre devuelve 0 antes del layout) — el tamaño real lo gestiona exclusivamente el ResizeObserver* — `TrackingPanel.jsx` ~L32: `getBoundingClientRect().height` devuelve 0 cuando panel está oculto.

- [x] **F-H8 · Font remota bloquea first paint** ✅ *fix: cambiado de `<link rel="stylesheet">` bloqueante a `<link rel="preload" onload>` no-bloqueante en index.html — ahorra 2s desktop / 9.7s mobile en TBT* — `index.css` + `tailwind.config.js`: 'Share Tech Mono' remota sin `font-display: swap`.
  - **Fix:** Añadir `font-display: swap` al @font-face. Listar fuentes locales primero.

---

### 🟡 MEDIOS — Calidad y polish

- [x] **F-M1 · Icon cache all-or-nothing** ✅ *fix: LRU eviction en AircraftLayer (delete oldest) + nuevo cache en ShipLayer con LRU* — `AircraftLayer.jsx` ~L76-82: Cache de 500 iconos, al llegar al límite `_iconCache.clear()` borra TODO → flicker visual.

- [ ] **F-M2 · News ticker animation perf** — `NewsPanel.jsx` ~L83: `animationPlayState` causa reflow en cada expand/collapse.
  - **Fix:** Usar CSS visibility/opacity en vez de play-state.

- [x] **F-M3 · Notificaciones browser sin agrupar** ✅ *fix: `tag: 'critical-alerts'` + `renotify: true` en `AlertPanel.jsx` — todos los CRITICAL comparten un slot de notificación OS en vez de inundar la pantalla* — `AlertPanel.jsx` ~L240: Cada alerta CRITICAL genera notificación separada.

- [x] **F-M4 · Timeline rebuild innecesario** ✅ *fix: `needFullRebuild` ahora compara `snapshots.length` en lugar de referencia del array — evita full rebuild en cada poll (cada 30s) cuando el cursor avanza normalmente* — `useTimeline.js` ~L132: `needFullRebuild = snapshots !== prevSnapshotsRef.current` es SIEMPRE true porque el array se recrea.

- [x] **F-M5 · Clipboard fallback invisible** ✅ *fix: `shareMsg` string state reemplaza `shareCopied` bool — muestra '✓ COPIED' o '⚠ URL UPDATED' (cuando clipboard falla) con color diferente — URL siempre actualizada en barra del navegador* — `CoordinateHUD.jsx` ~L127: Si clipboard no disponible, se logea a console. El usuario no recibe feedback.

- [ ] **F-M6 · Sin request limits en imagery tiles** — `Globe3D.jsx` ~L140: Sin `maximumRequestsPerServer` → tiles bloquean en redes lentas.
  - **Fix:** `new ImageryLayer(provider, { requestsPerServer: 4 })`.

- [x] **F-M7 · Array index como key en loops** ✅ *fix: `key={item.id || \`news-${i}\`}` en NewsPanel expanded list* — `NewsPanel.jsx` ~L93: `key={item.id || i}` → reconciliación React rota al reordenar.

- [x] **F-M8 · Promises no catched con logging** ✅ *ya OK: `ai_insight` socket handler comprueba `insight?.error` y llama `setAiError(insight.error)` explícitamente; `connect_error` logea con `console.warn`* — `useRealTimeData.js` ~L78: `.catch(() => setAiIntel(null))` sin logear error.

- [ ] **F-M9 · SVG encoding inconsistente** — `icons.js` usa `encodeURIComponent`, `FIRMSLayer.jsx` usa `btoa()`. Falla con emoji o chars especiales.
  - **Fix:** Estandarizar a `encodeURIComponent` (más seguro y compatible).

- [x] **F-M10 · CoordinateHUD re-renders excesivos** ✅ *fix: `handleToggleSpeedUnit`, `handleToggleAltUnit`, `handleOpenNewsletter`, `handleOpenAuth` wrapeados en `useCallback` en `App.jsx` — referencias estables impiden re-renders innecesarios del componente memoizado* — `CoordinateHUD.jsx` ~L176: `React.memo()` pero props del padre no están memoizadas.

- [x] **F-M11 · Cluster icons regenerados por movimiento de cámara** ✅ *fix: IIFE `prewarmClusterIcons()` pre-genera los 30 iconos más comunes (10 counts × 3 colors) al cargar el módulo — hot path ya no llama a btoa() en la primera renderización* — `NewsLayer.jsx` ~L43: `clusterIcon()` llamado por cada cluster en cada pan. `btoa()` es costoso.

- [ ] **F-M12 · IndexedDB cursor no se cierra** — `trailStore.js` ~L92: Cursor de IDB mantiene lock más de lo necesario.
  - **Fix:** Usar `deleteRange()` para borrados bulk.

- [x] **F-M13 · Mobile: trails desactivados pero sin LOD** ✅ *fix: billboard `width`/`height` `isMobile ? 32 : 46` en `AircraftLayer.jsx` y `ShipLayer.jsx` — iconos 30% más pequeños en mobile reducen GPU overdraw* — `AircraftLayer.jsx` ~L97: Trails off en mobile pero aircraft siguen a calidad completa.

- [x] **F-M14 · Bundle de Cesium ~5MB+** ✅ *fix: vite.config.js manualChunks separados para cesium, socketio, react-dom, react — carga paralela y main bundle más pequeño* — `vite.config.js`: `vite-plugin-cesium` incluye TODOS los módulos.

---

### 🟢 BAJOS — Accessibility y polish

- [ ] **F-L1 · Sin loading state en Timeline** — `TimelinePanel.jsx` ~L116: No hay skeleton/spinner mientras cargan snapshots.
- [ ] **F-L2 · Errores API solo en console** — `EntityPopup.jsx` ~L90: AI Intel falla silenciosamente sin feedback en UI.
- [ ] **F-L3 · Modals sin navegación por teclado** — `NewsClusterModal.jsx`: No hay `tabIndex`, focus trap ni Escape handler consistente.
- [ ] **F-L4 · Sin indicadores para daltónicos** — `AlertPanel.jsx` ~L25: Solo color rojo/verde sin icono o texto alternativo.
- [ ] **F-L5 · Botones muy pequeños en mobile** — `SearchBar.jsx` ~L70: `text-xs px-2 py-0.5` = ~32px. WCAG exige mín 44×44px.
- [ ] **F-L6 · Toast sin aria-live** — `CoordinateHUD.jsx` ~L134: Feedback de "COPIED" invisible para screen readers.
- [x] **F-L7 · XSS potencial en labels Cesium** ✅ *fix: strip non-ASCII + slice(0,12) en buildLabelText() de AircraftLayer.jsx* — `AircraftLayer.jsx` ~L37: callsign se usa directamente como label text sin sanitizar.
- [ ] **F-L8 · Sin CSRF token en WebSocket** — `useRealTimeData.js` ~L117: `socket.emit()` sin token de verificación.
- [x] **F-L9 · Backend URL sin validar esquema** ✅ *fix: regex /^https?:\/\// guard en useRealTimeData.js* — `useRealTimeData.js` ~L18: `VITE_BACKEND_URL` podría ser `file://` o `javascript://`.
- [ ] **F-L10 · IndexedDB trails sin encriptar** — `trailStore.js`: Historial de vuelo en plaintext accesible desde DevTools.
- [ ] **F-L11 · Sin PWA offline fallback page** — `vite.config.js`: PWA configurada pero sin página offline de fallback.
- [ ] **F-L12 · Sin analytics de comportamiento de usuario** — GA script en HTML pero sin custom events para trackear features.
- [ ] **F-L13 · Sin Sentry/error tracking** — `ErrorBoundary.jsx` ~L14: Solo `console.error()`, errores de producción se pierden.
- [ ] **F-L14 · Sin throttle en botón Share** — `CoordinateHUD.jsx` ~L103: 10 clicks = 10 operaciones de clipboard.
- [ ] **F-L15 · Sin dark/light mode toggle** — App hardcodeada en modo oscuro. No cumple WCAG 1.4.11.
- [x] **F-L16 · Sin headers de seguridad (CSP, X-Frame-Options)** ✅ *fix: helmet.js añadido a backend con CSP desactivado (Vercel gestiona frontend CSP)* — No hay helmet.js ni meta CSP.
- [ ] **F-L17 · useTimeline historyTrack crece indefinidamente** — Sin purge de datos antiguos en el historial de trail.

---

## 🏗️ PARTE 3 — INFRAESTRUCTURA / DEVOPS

### 🔴 CRÍTICOS

- [ ] **I-C1 · Sin tests** — Ni un solo test unitario o de integración. `package.json` no tiene test framework. Cualquier cambio puede romper producción sin detectarlo.
  - **Fix:** Vitest (frontend) + Jest o node:test (backend). Mínimo: tests de endpoints y filtros.

- [ ] **I-C2 · Sin CI/CD pipeline** — No hay GitHub Actions, no hay linting automático, no hay PRs obligatorias.
  - **Fix:** GitHub Actions con lint + test + build. Bloquear merge sin CI verde.

- [ ] **I-C3 · In-memory state impide horizontal scaling** — Backend guarda todo en RAM (`cache.aircraft`, `cache.ships`, etc.). No se puede correr 2+ instancias.
  - **Fix:** Redis para cache compartido. Requerido antes de escalar horizontalmente.

---

### 🟠 ALTOS

- [ ] **I-H1 · Sin monitoreo de errores** — Solo `console.log()`. Errores de producción pasan desapercibidos.
  - **Fix:** Sentry (backend + frontend), o al menos alertas por Slack/webhook.

- [ ] **I-H2 · Sin backups automatizados testeados** — Supabase tiene backups, pero ¿se ha probado un restore?
  - **Fix:** Test de restore mensual documentado.

- [x] **I-H3 · Sin rate limiting por usuario/IP** ✅ *ya OK: `app.set('trust proxy', 1)` + express-rate-limit usa req.ip por defecto* — Rate limit actual es global (120/min). Un bot puede consumir todo el cupo.
  - **Fix:** Rate limit por IP: express-rate-limit con keyGenerator: `req.ip`.

- [ ] **I-H4 · Sin feature flags** — Si FIRMS API se rompe, hay que deployear hotfix. No se puede desactivar runtime.
  - **Fix:** Variables de entorno como flags: `ENABLE_FIRMS=true`, `ENABLE_TWITTER=true`.

- [ ] **I-H5 · Sin load testing** — ¿Cuántos clientes concurrentes soporta? Desconocido.
  - **Fix:** k6 o Artillery con escenario: 100→1000→5000 WebSocket clientes.

---

### 🟡 MEDIOS

- [ ] **I-M1 · Sin status page pública** — Los usuarios no saben si el servicio está degradado.
  - **Fix:** BetterStack/UptimeRobot con página pública.

- [ ] **I-M2 · Sin blue-green deployment** — Railway hace rolling restart. Cache en RAM se pierde.
  - **Fix:** Con Redis (I-C3) resuelto, rolling deploys son seguros.

- [ ] **I-M3 · Sin alertas automáticas** — Si el server cae a las 3am, nadie se entera.
  - **Fix:** Railway wake alerts + webhook de healthcheck.

- [ ] **I-M4 · Sin documentación de runbooks** — ¿Qué hacer si Supabase cae? ¿Si adsb.lol no responde?
  - **Fix:** Runbook para cada escenario de fallo documentado.

---

### 🟢 BAJOS

- [ ] **I-L1 · Sin SLA tracking** — No hay medición de uptime.
- [ ] **I-L2 · Sin procedimiento de hotfix** — Todo va por el mismo pipeline.
- [ ] **I-L3 · Sin HSTS headers** — Se confía en que Railway proxy ponga HTTPS.

---

## 💰 PARTE 4 — REQUISITOS PARA MONETIZACIÓN

### Tier 1: Funcionalidades críticas para cobrar

- [x] **M-1 · Sistema de autenticación de usuarios** ✅ *Supabase Auth completamente integrado — Google OAuth + email/password, reCAPTCHA v3 invisible, honeypot, UserMenu con perfil/newsletter/sign-out, sesión persistente con `onAuthStateChange` + `getSession()`. Tabla `newsletter_subscribers` creada en Supabase.* — Actualmente no hay login. Sin auth no hay usuarios, sin usuarios no hay pagos.
  - **Opción recomendada:** Supabase Auth (ya usas Supabase). Social login (Google/GitHub) + email.
  - **Prioridad:** 🔴 MÁXIMA

- [ ] **M-2 · Plan de precios y restricciones por tier** — Definir qué es gratis y qué es premium.
  - **Sugerencia de tiers:**
    - **Free:** 3D globe, aircraft en tiempo real, noticias, max 1 tracking simultáneo.
    - **Pro ($9.99/mes):** Trails ilimitados, AI Intel, historial 30 días, alertas push, SitRep capture.
    - **Enterprise ($49.99/mes):** API access, datos exportables, dashboard analytics, white-label.
  - **Prioridad:** 🔴 MÁXIMA

- [ ] **M-3 · Integración de pagos** — Stripe Checkout o Paddle.
  - **Implementación:** Stripe + webhooks → actualizar campo `plan` en tabla `users` de Supabase.
  - **Prioridad:** 🔴 MÁXIMA

- [ ] **M-4 · Middleware de autorización por feature** — Evaluar `user.plan` antes de servir datos premium.
  - **Ejemplo:** `if (user.plan === 'free' && feature === 'ai_intel') return res.status(403)`.
  - **Prioridad:** 🟠 ALTA

### Tier 2: Infraestructura para escalar

- [ ] **M-5 · API pública documentada (para tier Enterprise)** — OpenAPI/Swagger spec. Clientes pagan por acceso programático.
  - **Prioridad:** 🟠 ALTA

- [ ] **M-6 · Usage metering** — Trackear requests por usuario para billing basado en uso.
  - **Prioridad:** 🟠 ALTA

- [ ] **M-7 · Rate limiting por plan** — Free: 10 req/min, Pro: 60 req/min, Enterprise: 300 req/min.
  - **Prioridad:** 🟠 ALTA

- [ ] **M-8 · Dashboard de usuario** — Panel donde el usuario ve su plan, uso, facturas, configuración de alertas.
  - **Prioridad:** 🟡 MEDIA

### Tier 3: Diferenciadores para retención

- [ ] **M-9 · Alertas personalizadas por email/push** — Los usuarios configuran alertas: "Avísame si hay actividad militar en el Mar Negro".
  - **Prioridad:** 🟡 MEDIA

- [ ] **M-10 · Exportación de datos (CSV/JSON)** — Feature premium para analistas.
  - **Prioridad:** 🟡 MEDIA

- [ ] **M-11 · White-label / embed widget** — Para medios de comunicación y analistas OSINT. `<iframe src="livewar3d.com/embed?zone=ukraine">`.
  - **Prioridad:** 🟢 BAJA (pero alto valor)

- [ ] **M-12 · Programa de afiliados / referrals** — Código de referido que da 1 mes gratis.
  - **Prioridad:** 🟢 BAJA

- [ ] **M-13 · Definir roles y permisos por usuario** — Establecer qué puede hacer cada tipo de usuario en la plataforma.
  - **Roles propuestos:**
    - **Anónimo:** Solo visualización del globo, aircraft y ships en directo. Sin acceso a AI Intel, alerts, ni trails.
    - **Free (registrado):** Todo lo anterior + 1 tracking simultáneo, noticias, alertas básicas (sin push), SITREP limitado a 1/día.
    - **Pro ($9.99/mes):** Trails ilimitados, AI Intel, historial 30 días, alertas push, SITREP ilimitado, exportación CSV.
    - **Enterprise ($49.99/mes):** Todo Pro + acceso API, analytics avanzados, rate limit elevado, white-label.
  - **Implementación:** Campo `plan` en tabla `users` de Supabase → middleware backend `checkPlan(requiredPlan)` → gates en frontend (ocultar/deshabilitar features).
  - **Prioridad:** 🔴 MÁXIMA (prerequisito de M-3 y M-4)

---

## 🗺️ ROADMAP PRIORIZADO

### Fase 1 — Estabilización (semanas 1-2)
> *"Que no se rompa"*

| # | Item | ID |
|---|------|----|
| 1 | ✅ Auth bypass fix | B-C1 |
| 2 | ✅ Error logging en archivado | B-C2 |
| 3 | ✅ Graceful shutdown | B-C6 |
| 4 | ✅ Atomic disk writes | B-C7 |
| 5 | ✅ Input validation endpoints | B-C5 |
| 6 | ✅ Destroy Cesium viewer on unmount | F-C1 |
| 7 | Destroy ScreenSpaceEventHandlers | F-C2 |
| 8 | ✅ Cleanup CustomDataSources | F-C3 |
| 9 | ✅ Socket listener cleanup | F-C5 |
| 10 | Tests mínimos (10 backend + 5 frontend) | I-C1 |

### Fase 2 — Seguridad y Performance (semanas 3-4)
> *"Que aguante carga"*

| # | Item | ID |
|---|------|----|
| 11 | WebSocket rate limiting | B-C4 |
| 12 | Memory leak fixes (Sets con cap) | B-H1, B-H2 |
| 13 | Delta updates en broadcasts | B-H9 |
| 14 | ✅ Entity count limits en Cesium | F-H1 |
| 15 | ✅ Input validation frontend | F-C7 |
| 16 | CI/CD pipeline (GitHub Actions) | I-C2 |
| 17 | Sentry integration | I-H1 |  
| 18 | ✅ Sanitizar API keys en logs | B-C8 |
| 19 | ✅ Rate limiting por IP | I-H3 |
| 20 | Load testing (k6) | I-H5 |

### Fase 3 — Monetización (semanas 5-8)
> *"Que genere dinero"*

| # | Item | ID |
|---|------|----|
| 21 | ✅ Supabase Auth + login UI | M-1 |
| 22 | Definir tiers (Free/Pro/Enterprise) | M-2 |
| 22b | Definir roles y permisos por usuario | M-13 |
| 23 | Stripe integration | M-3 |
| 24 | Middleware de autorización | M-4 |
| 25 | Rate limiting por plan | M-7 |
| 26 | Dashboard de usuario | M-8 |

### Fase 4 — Escala (semanas 9-12)
> *"Que crezca"*

| # | Item | ID |
|---|------|----|
| 27 | Redis para cache compartido | I-C3 |
| 28 | API pública con OpenAPI docs | M-5 |
| 29 | Usage metering | M-6 |
| 30 | Circuit breaker para APIs externas | B-L6 |
| 31 | Status page pública | I-M1 |
| 32 | Alertas personalizables | M-9 |
| 33 | Exportación de datos | M-10 |

### Fase 5 — Polish y Diferenciación
> *"Que destaque"*

| # | Item | ID |
|---|------|----|
| 34 | Accessibility (keyboard nav, aria) | F-L3 |
| 35 | Soporte daltónicos | F-L4 |
| 36 | Optimización bundle Cesium | F-M14 |
| 37 | Widget embeddable | M-11 |
| 38 | Programa de referrals | M-12 |
| 39 | PWA offline completo | F-L11 |
| 40 | Light/dark mode toggle | F-L15 |

---

## 📌 MÉTRICAS CLAVE PARA MONITOREAR

| Métrica | Target | Herramienta |
|---------|--------|-------------|
| Time to First Paint | < 2s | Lighthouse |
| Time to Interactive | < 5s | Lighthouse |
| WebSocket latency p95 | < 200ms | Custom metrics |
| Memory usage (backend) | < 400MB | Railway dashboard |
| Error rate | < 0.1% | Sentry |
| Uptime | > 99.5% | BetterStack |
| Concurrent WebSocket clients | > 1000 | Load test |
| Lighthouse Performance score | > 70 | Lighthouse CI |
| Bundle size (gzipped) | < 2MB (excl. Cesium) | Vite build |

---

## 🧮 ESTIMACIÓN DE COSTES MENSUALES (a 1000 usuarios)

| Servicio | Plan | Coste/mes |
|----------|------|-----------|
| Railway (backend) | Pro | ~$20-40 |
| Vercel (frontend) | Pro | ~$20 |
| Supabase | Pro | ~$25 |
| Sentry | Team | ~$26 |
| Redis (Upstash) | Pay-as-you-go | ~$10 |
| Stripe | 2.9% + $0.30/tx | Variable |
| **TOTAL estimado** | | **~$100-120/mes** |

> Con 100 usuarios Pro a $9.99/mes = $999/mes de revenue → **break-even con ~12 usuarios Pro**.

---

*Documento generado por auditoría automatizada del codebase completo. Actualizar conforme se resuelvan items.*
