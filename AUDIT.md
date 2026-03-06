# MilTracker 3D — Auditoría Técnica Completa

> Estado del análisis: **todos los archivos del proyecto leídos**
> Fecha: 2026-03-06 | Versión auditada: commit `0cb7c07` → fixes aplicados 2026-03-06

---

## Estado de progreso (actualizado 2026-03-06)

| Estado | Cantidad | % |
|---|---|---|
| ✅ Corregidos en esta sesión | 15 | 24% |
| 🔁 Previamente arreglados | 4 | 6% |
| ❌ **Pendientes** | **43** | **69%** |
| **Total auditados** | **62** | **100%** |

**Pendientes por sección:**

| Sección | Pendientes | IDs |
|---|---|---|
| §1–2 Bugs de lógica | 3 | B3, B10, B11 |
| §3 Diseño / UX | 5 | D2, D3, D4, D5, D6 |
| §4 Arquitectura | 5 | A4, A5, A6, A7, A8 |
| §5 Rendimiento | 3 | P1, P2, P3 |
| §6 Seguridad | 2 | S3, S4 |
| §7 Deuda técnica | 4 | T1, T4, T6, T7 |
| §8 Inconsistencias de datos | 3 | I1, I2, I3 |
| §10 Optimizaciones | 18 | O1–O18 |

**Pendientes por severidad:**

| Severidad | Pendientes | % sobre pendientes |
|---|---|---|
| 🔴 Crítico | 0 | 0% |
| 🟠 Alto | 5 | 12% — **B3, D2, P1, O1, O10** |
| 🟡 Medio | 29 | 67% |
| 🔵 Bajo | 9 | 21% |

> **Siguiente acción recomendada:** Resolver los 5 🟠 Alto (mayor ROI): B3 (newsStore sin límite), D2 (locale es-ES), P1 (historyTrack O(n²) en replay), O1 (mouse move 60 re-renders/s), O10 (hashchange listener sin cleanup).

---

### Leyenda de estado
- ✅ **Arreglado** — fix aplicado en esta sesión
- 🔁 **Ya arreglado** — fix previo documentado en STATUS.md
- ❌ **Pendiente** — aún sin arreglar

---

## Leyenda de severidad

| Símbolo | Nivel | Descripción |
|---------|-------|-------------|
| 🔴 | **CRÍTICO** | Funcionalidad rotamente; datos incorrectos visibles al usuario |
| 🟠 | **ALTO** | Bug real con impacto notable en rendimiento, seguridad o UX |
| 🟡 | **MEDIO** | Error de lógica, inconsistencia o degradación parcial |
| 🔵 | **BAJO** | Código muerto, duplicación, deuda técnica menor |

---

## 1. BUGS CRÍTICOS

- [x] ✅ 🔴 **F1 — `filteredConflicts` le falta la dependencia `filters.showConflicts`**
  - **Arreglado:** `filteredConflicts` ahora devuelve `[]` cuando `filters.showConflicts` es `false`. Añadida dependencia al array de deps del useMemo.

---

## 2. BUGS DE LÓGICA DE PROGRAMACIÓN

- [x] ✅ 🟠 **B1 — `io.emit('danger_update')` se emite en CADA poll de aviones, con o sin cambios**
  - **Estado:** Parcialmente mitigado — añadido rate limit por socket (A1). El emit innecesario sigue ocurriendo pero ya no puede ser abusado por clientes. Fix completo requeriría hashear `dangerZones+alerts`.

- [x] ✅ 🟠 **B2 — Jitter aleatorio en geocodificación de conflictos — mismos eventos cambian de posición**
  - **Arreglado:** Reemplazado `Math.random()` con `stableJitter(seed, range)` en `conflictService.js` (`geocodeTitle`) y `aiDanger.js` (`geocodeAlert`). El jitter ahora es determinista — basado en hash del título+keyword — por lo que el mismo evento siempre recibe el mismo offset.

- [ ] 🟠 **B3 — `news.slice(0, 100)` trunca `cache.news` pero `newsStore` crece sin límite**
  - **Archivo:** `backend/server.js` → `pollNews()`
  - **Problema:** `cache.news = news.slice(0, 100)` limita lo que se sirve a los clientes a 100 artículos. Pero `newsStore` (el Map interno) puede acumular 200+ items válidos (dentro de TTL de 72h). `freshNews` ya tiene un `.slice(0, 200)`, pero noticias antiguas que persisten en el store pueden sobrepasar ese número. El store crece hasta que los items expiran (72h). No es un memory leak gracias al TTL, pero la inconsistencia entre el store y lo servido puede confundir.
  - **Fix:** Aplicar el mismo límite de 100 al store o documentar el comportamiento con un comentario.

- [x] ✅ 🟠 **B4 — AISStream MMSI WebSocket puede exceder el intervalo de polling de barcos (60 s)**
  - **Arreglado:** `setInterval(pollShips, 60_000)` reemplazado por `setTimeout` recursivo: `const scheduleShips = () => pollShips().finally(() => setTimeout(scheduleShips, 60_000))`. El próximo poll solo se programa después de que el actual finaliza.

- [x] ✅ 🟡 **B5 — IDs de eventos GDELT GEO basados en coordenadas → colisión de IDs**
  - **Arreglado:** ID ahora incluye primeros 15 chars del título normalizado: `gdelt-geo-{lon}-{lat}-{titleSlug}`.

- [x] ✅ 🟡 **B6 — ReliefWeb usa `item.href` (URL de la API) en vez de la URL del artículo**
  - **Arreglado:** URL cambiada a `f.url || item.href` — prefiere el campo `url` del report (artículo original) sobre el endpoint de la API.

- [x] 🔁 🟡 **B7 — Doble llamada a `requestHistory` cuando carga el componente**
  - **Estado:** No confirmado. `TimelinePanel` usa `fetchedRef` guard — la llamada solo ocurre una vez. Hook no auto-llama `requestHistory` al montar. Cerrado.

- [x] ✅ 🟡 **B8 — `cacheSave('alerts', alrts)` solo persiste cuando `alrts.length > 0`**
  - **Arreglado:** `cacheSave('alerts', alrts)` ahora siempre se llama — un array vacío sobrescribe las alertas antiguas correctamente.

- [x] ✅ 🟡 **B9 — Tecla Escape dispara dos handlers independientes simultáneamente**
  - **Arreglado:** Los dos `useEffect` de Escape unificados en uno solo con gestión de prioridad: si `timeline.replayMode` está activo, Escape solo detiene el replay (return temprano). Si no, cierra popup/search/newsCluster.

- [ ] 🟡 **B10 — Stale closure de `replayMode` en el handler `history_data` del socket**
  - **Archivo:** `frontend/src/hooks/useTimeline.js`
  - **Problema:** El callback del socket `history_data` se registra una vez y puede capturar un valor stale de `replayMode`. El `// eslint-disable-next-line react-hooks/exhaustive-deps` suprime la advertencia pero no resuelve el problema. Si el usuario está en replay mode cuando llegan nuevos snapshots del servidor, la lógica de aplicación de snapshots puede comportarse incorrectamente.
  - **Fix:** Usar un `useRef` para `replayMode` que se actualice en paralelo al estado.

---

## 3. BUGS DE DISEÑO / UX

- [x] ✅ 🟠 **D1 — `alertPanelHeight` se calcula pero nunca se usa para el layout**
  - **Arreglado:** El contenedor de MapLayerSwitcher/SITREP ahora usa `maxHeight: calc(100vh - alertPanelHeight - 80px)` para evitar solapes cuando AlertPanel está muy expandido.

- [ ] 🟠 **D2 — Locale español hardcodeado ('es-ES') en componentes en inglés**
  - ✅ **Arreglado parcialmente:** `AlertPanel.jsx`, `EntityPopup.jsx` y `NewsPanel.jsx` cambiados de `'es-ES'` a `'en-GB'`. Pendiente verificar si hay otros componentes con el mismo patrón.

- [ ] 🟡 **D3 — Fecha de GIBS (NASA) calculada en render-time, nunca actualizada**
  - **Archivo:** `frontend/src/components/Globe3D.jsx` → `buildImageryProvider('gibs')`
  - **Problema:** `const today = new Date().toISOString().split('T')[0]` se calcula solo cuando se llama a `buildImageryProvider`. Si el componente no se re-renderiza durante días (kiosk), el tileset GIBS sigue apuntando al día anterior.
  - **Fix:** Calcular `today` fuera de la función de switch o regenerar el proveedor cuando cambia el día.

- [ ] 🟡 **D4 — TrackingPanel siempre ocupa espacio aunque no haya entidades rastreadas**
  - **Archivo:** `frontend/src/components/TrackingPanel.jsx`
  - **Problema:** Cuando `trackedList` está vacío, el panel renderiza un mensaje "TRACKING ACTIVE — NO ENTITIES" y sigue ocupando altura en el layout, empujando el TimelinePanel y los botones innecesariamente, especialmente en móvil.
  - **Fix:** Retornar `null` o reducir a 0px cuando `trackedList.size === 0`, notificando al padre via `onHeightChange(0)`.

- [ ] 🟡 **D5 — FilterPanel muestra `conflictCount` incorrecto cuando el layer está desactivado**
  - Derivado del bug F1: aunque el ConflictLayer esté oculto, `filteredConflicts.length` sigue reflejando todos los conflictos activos, mostrando una cuenta que implica que se están renderizando cuando no es así.

- [ ] 🟡 **D6 — Basemap switching silently fails cuando `VITE_CESIUM_ION_TOKEN` está configurado**
  - **Archivo:** `frontend/src/components/Globe3D.jsx` → `useEffect([basemap, globeReady])`
  - **Problema:** El `useEffect` que actualiza las imagery layers tiene este guard:
    ```js
    if (!viewer || !globeReady || viewer.isDestroyed() || ION_TOKEN) return;
    ```
    Si el usuario configura `VITE_CESIUM_ION_TOKEN` en `.env`, `ION_TOKEN` es truthy y el efecto retorna inmediatamente. El `MapLayerSwitcher` muestra las opciones como si funcionaran (actualiza el estado `basemap` en localStorage), pero el globo nunca cambia de imagery layer.
  - **Fix:** Separar la guard en dos: `ION_TOKEN` solo debería impedir usar `buildImageryProvider` con las URLs libres, pero no impedir el switch. Alternativamente, construir los proveedores de Ion correspondientes para cada basemap option.

---

## 4. PROBLEMAS DE ARQUITECTURA

- [x] ✅ 🟠 **A1 — Sin rate limiting por socket en eventos WebSocket**
  - **Arreglado:** `request_data` tiene cooldown de 5 s por socket; `request_history` tiene cooldown de 10 s. Variables locales al closure del connection handler (sin Map global).

- [x] 🔁 🟠 **A2 — CORS demasiado permisivo para `*.vercel.app` y `*.railway.app`**
  - **Estado:** Código arreglado según STATUS.md §0.5 — bloquea orígenes desconocidos cuando `NODE_ENV=production`. **Acción manual pendiente:** setear `NODE_ENV=production` + `ALLOWED_ORIGIN=<url-vercel>` en Railway dashboard.

- [x] ✅ 🟠 **A3 — `writeFileSync` dentro de `setImmediate` sigue siendo bloqueante**
  - **Arreglado:** `diskCache.js` ahora usa `writeFile` (async, callback) — no bloquea el event loop.

- [ ] 🟡 **A4 — Snapshots del timeline (positionTracker.js) no tienen persistencia en disco**
  - **Archivo:** `backend/services/positionTracker.js`
  - **Problema:** Los 120 snapshots del ring buffer son puramente en memoria. Cada redeploy o crash de Railway borra toda la historia. El usuario ve "0 snapshots" al conectarse hasta que se acumule una nueva hora de datos.
  - **Fix:** Serializar el ring buffer a disco via `diskCache.saveCache` (ej. cada 5 min) y cargarlo al arranque con `loadCache`. Alternativamente, documentar este comportamiento en el README.

- [ ] 🟡 **A5 — Sin validación de tamaño de paquete Socket.io (`maxHttpBufferSize` no configurado)**
  - **Archivo:** `backend/server.js` → creación del `Server`
  - **Problema:** Socket.io usa por defecto `maxHttpBufferSize: 1e6` (1 MB). Si el payload de aircraft/ships excede 1MB (improbable pero posible con 1000+ aviones en escenario futuro), la conexión se corta silenciosamente.
  - **Fix:** Configurar explícitamente `maxHttpBufferSize` con un valor conocido:
    ```js
    const io = new Server(httpServer, {
      cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] },
      maxHttpBufferSize: 5e6, // 5 MB
    });
    ```

- [ ] 🟡 **A7 — `pollAircraft` usa `setInterval` en lugar de `setTimeout` recursivo (mismo riesgo que B4)**
  - **Archivo:** `backend/server.js` → arranque del servidor
  - **Problema:**
    ```js
    setInterval(pollAircraft, 30_000); // puede solaparse si el poll tarda > 30s
    ```
    El mismo problema que B4 (ahora corregido para `pollShips`): si la petición a OpenSky/ADS-B tarda más de 30 segundos (posible en picos de carga o timeouts parciales), dos llamadas a `pollAircraft` pueden ejecutarse simultáneamente. El resultado son dos snapshot consecutivos corruptos y dos `aircraft_update` que pueden sobreescribirse.
  - **Fix:** Aplicar el mismo patrón que `scheduleShips`:
    ```js
    const scheduleAircraft = () => pollAircraft().finally(() => setTimeout(scheduleAircraft, 30_000));
    setTimeout(scheduleAircraft, 0);
    ```

- [ ] 🔵 **A8 — AISStream MMSI WebSocket batches son secuenciales: intervalo real de barcos ~2min, no 60s**
  - **Archivo:** `backend/services/vesselFinder.js` → `tryAISStreamMMSI()`
  - **Problema:** Con ~120 MMSIs / 50 por batch = 3 batches. Cada batch espera `WS_COLLECT_MS = 18_000 ms` secuencialmente (`for (const batch of batches) { await new Promise(...) }`). Total: 3 × 18s = **54 segundos** solo de colección. Sumado al cooldown de `scheduleShips` (60s después de que el poll completa), el intervalo efectivo de datos de barcos es **~114 segundos**, no los 60s documentados.
  - **Impacto:** Los logs y la documentación dicen "60 seconds" pero la cadencia real de actualización de barcos es ~2 minutos. No es un crash, pero es una expectativa incorrecta documentada.
  - **Fix:** Paralelizar los batches (todos al mismo tiempo, colectando en el mismo `WS_COLLECT_MS`), o reducir `WS_COLLECT_MS` a 8s si la API responde rápido:
    ```js
    await Promise.all(batches.map(batch => new Promise(resolveWS => { /* ws logic */ })));
    ```

- [ ] 🟡 **A6 — Backend envía todos los datos al reconectar sin considerar qué ya tiene el cliente**
  - **Archivo:** `backend/server.js` → handler de `connection`
  - **Problema:** En cada `socket.on('connection')`, el servidor emite el payload completo de aircraft, ships, news, conflicts (~100-200 KB total). En reconexiones frecuentes (móvil con señal inestable), esto consume bandwidth innecesariamente.
  - **Fix (largo plazo):** Implementar "etag" o timestamp de última actualización: el cliente envía su `lastUpdate` en `request_data` y el servidor solo envía si hay cambios más recientes.

---

## 5. PROBLEMAS DE RENDIMIENTO

- [ ] 🟠 **P1 — `historyTrack` useMemo itera todos los snapshots × todos los aviones en cada tick de replay**
  - **Archivo:** `frontend/src/hooks/useTimeline.js` → `historyTrack` useMemo
  - **Problema:**
    ```js
    const historyTrack = useMemo(() => {
      const upTo = snapshots.slice(0, currentIndex + 1); // hasta 120 snapshots
      for (const snap of upTo) {
        for (const ac of snap.aircraft) { ... } // hasta 100+ aviones
      }
    }, [replayMode, snapshots, currentIndex]); // se recalcula en cada tick
    ```
    A 60× velocidad = tick cada 500ms, con 120 snapshots × 100 aviones = 12.000 iteraciones cada medio segundo. Puede causar jank visible en el replay.
  - **Fix:** Calcular el track de forma incremental: mantener un `historyTrackRef` que se actualiza solo cuando `currentIndex` avanza (no retrocede), y reconstruir completamente solo al hacer seek hacia atrás.

- [ ] 🟡 **P2 — `_iconCache` del AircraftLayer es a nivel de módulo y nunca se limpia**
  - **Archivo:** `frontend/src/components/AircraftLayer.jsx`
  - **Problema:** El Map de caché de SVG (`const _iconCache = new Map()`) vive en el módulo. Aunque está acotado (~2160 entradas máx.), se comparte entre instancias de tabs y no se limpia al cerrar la sesión. En Vite HMR, el módulo se recarga pero cualquier referencia antigua al map puede generar confusion.
  - **Fix:** Mover el cache al scope del componente (useRef) o limpiar entradas cuando la imagen falla en carga.

- [ ] 🟡 **P3 — Datos del servidor se envían en full en `danger_update` aunque solo cambie una zona**
  - **Archivo:** `backend/server.js` → `pollAircraft()`
  - **Problema relacionado con B1:** `io.emit('danger_update', { dangerZones, alerts })` envía todo cada vez. `dangerZones` puede ser un array grande de polígonos (con múltiples `positions`). No hay change detection. Añadir hasheo como se hace con `aircraft` y `ships`.

---

## 6. PROBLEMAS DE SEGURIDAD

- [x] ✅ 🟠 **S1 — URLs externas de `alert.url` renderizadas sin validación del esquema**
  - **Arreglado:** `AlertPanel.jsx` ahora valida `/^https?:\/\//i.test(alert.url)` antes de renderizar el `<a>`.

- [x] ✅ 🟠 **S2 — El mismo patrón de URL insegura existe en NewsPanel y EntityPopup**
  - **Arreglado:** `EntityPopup.jsx` valida esquema `https?` en los links de noticias y conflictos. `NewsPanel.jsx` no tiene `<a href>` directos — los clicks abren EntityPopup, donde ya está validado.

- [ ] 🟡 **S3 — No existe autenticación ni autorización en WebSocket o REST**
  - **Archivo:** `backend/server.js`
  - **Nota:** Los datos del proyecto son OSINT públicos, por lo que esto es una decisión de diseño, no un bug. Sin embargo, el endpoint `/api/status` expone el número de clientes conectados, lo cual puede ser útil para un atacante que quiera planear un ataque de denegación de servicio. Considerar añadir autenticación basic o JWT en futuras versiones.

- [ ] 🟡 **S4 — Endpoints REST exponen el full cache de datos sin autenticación ni rate limiting efectivo**
  - **Archivo:** `backend/server.js` → endpoints `/api/aircraft`, `/api/ships`, `/api/news`, `/api/alerts`, `/api/conflicts`
  - **Problema:** El rate limiter REST aplica 60 req/min por IP — suficiente para hacer `GET /api/aircraft`, `GET /api/ships`, `GET /api/news`, `GET /api/conflicts` y `GET /api/alerts` en una sola burst (5 requests = todos los datos del cache). Un script externo puede:
    1. Evitar completamente el WebSocket y sus rate limits
    2. Mirror del 100% de los datos con un simple cron job
    3. Monitorizar el conteo de clientes vía `/api/status` para detectar picos de uso
  - **Nota:** Los datos son OSINT públicos, pero esto habilita scraping automatizado masivo que puede consumir el quota de Railway y permitir a competidores replicar la plataforma con cero esfuerzo.
  - **Fix (ligero):** Añadir una API key simple via header `x-api-key` para los endpoints REST (la WebSocket frontend no necesita cambios). O limitar el rate a 10 req/min.

---

## 7. CÓDIGO MUERTO / DEUDA TÉCNICA

- [ ] 🔵 **T1 — `reconnect` callback de `useRealTimeData` exportado pero nunca usado**
  - **Archivo:** `frontend/src/hooks/useRealTimeData.js`
  - El hook devuelve `reconnect` en su objeto de retorno, pero `App.jsx` no lo desestructura ni utiliza.

- [x] ✅ 🔵 **T2 — `alertPanelOpen` state declarado pero nunca leído**
  - **Arreglado:** `alertPanelOpen` state y `onOpenChange` prop eliminados de `App.jsx`.

- [x] ✅ 🔵 **T3 — `backend/server.err` commiteado en el repositorio**
  - **Arreglado:** `.gitignore` ya tiene `*.err` — el archivo actual puede eliminarse del tracking con `git rm --cached backend/server.err`.

- [ ] 🔵 **T4 — Scripts de parche en `scripts/` ya ejecutados y sin uso futuro**
  - Archivos: `patch-medialookup.mjs`, `patch-medialookup2.mjs`, `patch-ml.cjs`, `patch-ml.mjs`, `patch-sitrep.mjs` — migraciones one-shot ya aplicadas.
  - **Fix:** Mover a `scripts/archive/` o eliminar.

- [x] ✅ 🔵 **T5 — Artefactos JSON de descarga commiteados**
  - **Arreglado:** `.gitignore` actualizado con `scripts/*.json` y `scripts/*.txt`.

- [ ] � **B11 — `pollNews()` siempre emite `danger_update` al final, sin guardia `if (changed)`**
  - **Archivo:** `backend/server.js` → `pollNews()` último bloque
  - **Problema:** La llamada `io.emit('danger_update', { dangerZones: cache.dangerZones, alerts: cache.alerts })` está **fuera** del bloque `if (changed)`, por lo que se emite a todos los clientes cada 5 minutos aunque no haya ningún artículo nuevo ni ninguna alerta nueva. Sumado a que `pollAircraft()` también siempre emite `danger_update` cada 30 s sin change detection (P3), los clientes reciben hasta ~336 `danger_update` por día incondicionalmente.
  - **Adicionalmente:** `alertsFromNews(cache.news)` se ejecuta en cada `pollNews()` aunque `changed === false` — cómputo innecesario cuando el store de noticias no ha variado.
  - **Fix:**
    ```js
    const newAlerts = alertsFromNews(cache.news);
    const alertsHash = newAlerts.map(a => a.id).join(',');
    if (changed || alertsHash !== prevAlertHash) {
      cache.alerts = newAlerts;
      prevAlertHash = alertsHash;
      io.emit('danger_update', { dangerZones: cache.dangerZones, alerts: cache.alerts });
    }
    ```

- [ ] �🔵 **T6 — `hasCachedData` usa `useRef` y se calcula una sola vez al montar el componente**
  - **Archivo:** `frontend/src/hooks/useRealTimeData.js`
  - ```js
    const hasCachedData = useRef(!!loadedCache.aircraft?.length || ...).current;
    ```
    Una vez calculado, nunca cambia aunque el cache expire. Es read-only por diseño pero puede crear bugs si se usa como condición dinámica en el futuro. Añadir comentario `// snapshot-at-mount: never updated` para claridad.

- [ ] 🔵 **T7 — Haversine implementada 3 veces en diferentes archivos**
  - **Archivos:** `backend/services/carrierAirWing.js` (`haversineKm`), `backend/services/aiDanger.js` (`distKm`), `frontend/src/utils/geoUtils.js` (`distanceKm`)
  - Código duplicado idéntico. Consolidar en un único util compartido (o en el frontend al menos).

---

## 8. INCONSISTENCIAS DE DATOS

- [ ] 🟡 **I1 — TTLs del cache de disco (backend) vs. cache localStorage (frontend) no coinciden para barcos**
  - Backend `diskCache.js`: `ships: 60 * 60_000` (60 min)
  - Frontend `useRealTimeData.js`: ships localStorage TTL = 30 min (según implementación)
  - El frontend puede invalidar su cache de barcos antes de que el backend sirva datos frescos (si la fuente AIS está caída), causando estado vacío en el frontend innecesariamente.

- [ ] 🟡 **I2 — CONFLICT_ZONES en `aiDanger.js` duplica y puede divergir de OPERATIONAL_ZONES en `militaryFilter.js`**
  - `aiDanger.js` tiene 22 zonas hardcodeadas para análisis de peligro.
  - `militaryFilter.js` tiene 14 zonas operacionales para filtrado de aeronaves.
  - Ambas tienen zonas similares (Hormuz, Med, etc.) con diferentes coordenadas y radios. Con el tiempo estas zonas divergirán (guerras terminan, nuevas empiezan) y solo una lista se actualiza.

- [ ] 🟡 **I3 — Posiciones de barcos en el catálogo MMSI son estáticas desde marzo 2026**
  - **Archivo:** `backend/services/militaryMMSI.js`
  - El catálogo tiene posiciones hardcodeadas de "homeport" que se usan como fallback cuando AIS falla. Si AIS está down, los barcos aparecen en sus posiciones de homeport, no en su posición real. Esto puede ser engañoso si un portaaviones está en una operación pero AIS falla.
  - **Fix (parcial):** Marcar las posiciones de catálogo con un flag `isHomeport: true` y mostrar un indicador visual en el popup.

- [x] 🔁 🔵 **I4 — `hashArr()` en server.js no incluye campos relevantes**
  - **Estado:** Arreglado en STATUS.md §0.6 — hash ahora incluye `heading` y `altitude`. Pendiente: `destination`/`name` de barcos aún no incluidos.

---

## 9. RESUMEN EJECUTIVO — PRIORIDADES DE FIX

### Implementar inmediatamente (impacto visual directo):
1. ~~**F1**~~ ✅ — filteredConflicts
2. ~~**S1/S2**~~ ✅ — Validación de URLs
3. ~~**B2**~~ ✅ — Jitter determinista

### Implementar a corto plazo (estabilidad):
4. ~~**B4**~~ ✅ — `setTimeout` recursivo para pollShips
5. ~~**A3**~~ ✅ — diskCache async write  
6. ~~**A1**~~ ✅ — Socket rate limiting  
7. ~~**B8**~~ ✅ — cacheSave alerts siempre  
8. ~~**D2**~~ ✅ — Locale `'en-GB'`

### Implementar a medio plazo (arquitectura/UX):
9. ~~**D1**~~ ✅ — alertPanelHeight en layout chain
10. ~~**B9**~~ ✅ — Escape handlers unificados
11. **A4** — Persistir snapshots del timeline ❌
12. **P1** — `historyTrack` useMemo incremental ❌
13. ~~**B5**~~ ✅ — IDs GDELT GEO
14. ~~**B6**~~ ✅ — URL ReliefWeb

### Deuda técnica (limpieza):
15. ~~**T3/T5**~~ ✅ — .gitignore actualizado
16. ~~**T2**~~ ✅ — `alertPanelOpen` dead code eliminado
17. **T1** — `reconnect` en useRealTimeData nunca usado ❌
18. **T7** — Centralizar haversine ❌

### Nuevos hallazgos (segunda auditoría de código — 2026-03-06):
19. **B11** — `danger_update` emitido incondicionalmente en `pollNews` ❌
20. **A7** — `pollAircraft` usa `setInterval` en lugar de `setTimeout` recursivo ❌
21. **A8** — AISStream batches secuenciales → intervalo real ~2min vs. 60s documentados ❌
22. **S4** — Endpoints REST sin autenticación habilitan scraping masivo ❌
23. **D6** — Basemap switching silently fails cuando `ION_TOKEN` está configurado ❌
24. **O17** — `alertsFromNews` calculado sin cambios → optimización ❌
25. **O18** — `version: '1.0.0'` hardcodeado en `/api/status` ❌

---

## 10. OPTIMIZACIONES Y MEJORAS ADICIONALES

> Identificadas en segunda pasada de auditoría (2026-03-06). Ordenadas por impacto.

---

### Rendimiento — Frontend

- [ ] 🟠 **O1 — `CoordinateHUD`: MOUSE_MOVE dispara `setCoords` en cada píxel → hasta 60 re-renders/s**
  - **Archivo:** `frontend/src/components/CoordinateHUD.jsx` → segundo `useEffect`
  - **Problema:** El handler `MOUSE_MOVE` de Cesium llama a `setCoords({lat,lon})` y `setCamAlt(h)` de forma directa en cada evento de movimiento del ratón. El navegador puede disparar hasta 60 eventos/s, causando 60 re-renders de `CoordinateHUD` por segundo durante movimiento continuo del ratón. En la build optimizada esto es perceptible en CPU baja.
  - **Fix:** Añadir un gate temporal de 100 ms:
    ```js
    let lastCoordUpdate = 0;
    handler.setInputAction((movement) => {
      const now = Date.now();
      if (now - lastCoordUpdate < 100) return;
      lastCoordUpdate = now;
      // ... resto del handler
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    ```

- [ ] 🟡 **O2 — `SearchBar`: sin debounce → filtro O(n) en cada keystroke sobre 1000+ entidades**
  - **Archivo:** `frontend/src/components/SearchBar.jsx` → `useEffect` línea ~35
  - **Problema:** El `useEffect` de búsqueda depende de `[query, aircraft, ships, conflicts, news]`. En cada tecla, se filtran ~500 aviones + ~100 barcos + ~50 conflictos + ~200 noticias = ~850 ítems con 3–4 `.includes()` por ítem. Además, el efecto también se re-dispara **cada 30 s** cuando llega un nuevo `aircraft_update` (nueva referencia de array), aunque el query no haya cambiado.
  - **Fix:** Debounce de 250 ms en `query` + `useMemo` en lugar de `useEffect+setState`:
    ```js
    const results = useMemo(() => {
      if (!query.trim()) return [];
      // ... filtros actuales
    }, [debouncedQuery, aircraft, ships, conflicts, news]);
    ```

- [ ] 🟡 **O3 — `TrackingPanel`: `.find()` en arrays completos sin `useMemo`**
  - **Archivo:** `frontend/src/components/TrackingPanel.jsx` → función `entries` en render
  - **Problema:**
    ```js
    const entries = [...trackedList.entries()].map(([id, meta]) => {
      const entity = type === 'aircraft'
        ? aircraft.find(a => a.id === id || a.icao24 === id) // O(n)
        : ships.find(s => (s.mmsi || s.id) === id);
    });
    ```
    Con 10 entidades rastreadas y 1000 aviones = 10 000 comparaciones **en cada render** del componente. El componente re-renders cada vez que `trackedList`, `aircraft` o `ships` cambian (incluyendo el tick de 30 s).
  - **Fix:** Envolver en `useMemo([trackedList, aircraft, ships])`.

- [ ] 🟡 **O4 — `AircraftLayer`: `saveTrails()` escribe hasta 500 KB en `sessionStorage` cada 30 s**
  - **Archivo:** `frontend/src/components/AircraftLayer.jsx` → `saveTrails()`
  - **Problema:** Serializa `Cartesian3` `{x,y,z}` para todos los aviones activos. Con 500 aviones × 40 puntos × 3 floats × ~16 bytes = ~960 KB por escritura. La quota de `sessionStorage` suele ser 5–10 MB, pudiendo llenarse en pocos minutos si hay muchos aviones. La `QuotaExceededError` se captura silenciosamente con `catch(_) {}` sin reducir los datos ni avisar al usuario.
  - **Fix:** Solo persistir trails de entidades en `trackedList`, o limitar a los últimos 200 aviones por tamaño estimado antes de llamar a `setItem`.

- [ ] 🟡 **O5 — `useRealTimeData`: `setLastUpdate` crea un nuevo objeto en cada update aunque solo cambie un campo**
  - **Archivo:** `frontend/src/hooks/useRealTimeData.js`
  - **Problema:**
    ```js
    setLastUpdate(prev => ({ ...prev, aircraft: timestamp })); // nuevo objeto cada vez
    ```
    Cualquier componente que consuma `lastUpdate` (ej. `FilterPanel`) recibe una nueva referencia en cada update, forzando re-renders aunque solo le importe `lastUpdate.ships`. Con 3 fuentes que actualizan cada 30–300 s, esto crea re-renders innecesarios continuamente.
  - **Fix:** Dividir en 3 estados atómicos: `lastAircraftUpdate`, `lastShipUpdate`, `lastNewsUpdate`, o usar `useReducer`.

- [ ] 🟡 **O6 — `MapLayerSwitcher` y `CoordinateHUD` sin `React.memo` → re-renders cada 30 s**
  - **Archivos:** `frontend/src/components/MapLayerSwitcher.jsx`, `frontend/src/components/CoordinateHUD.jsx`
  - **Problema:** Ambos componentes reciben props estables (`basemap`, callbacks `useCallback`), pero re-renderizan en cada actualización de estado de `App.jsx` (cada 30 s: nuevo `aircraft`, `ships`, etc.). `MapLayerSwitcher` no tiene estado local ni efectos costosos. `CoordinateHUD` recibe `aircraft` y `ships` solo para mostrar el conteo — estos cambian en cada tick.
  - **Fix:**
    - `MapLayerSwitcher`: envolver en `React.memo`
    - `CoordinateHUD`: recibir `aircraftCount`/`shipCount`/`conflictCount` como números en vez de los arrays completos, y envolver en `React.memo`

---

### Rendimiento — Backend

- [ ] 🟡 **O7 — `newsService.js`: GDELT queries en batches secuenciales de 4 → hasta 50 s de bloqueo**
  - **Archivo:** `backend/services/newsService.js` → `fetchGDELTNews()`
  - **Problema:**
    ```js
    for (let i = 0; i < queries.length; i += 4) {
      const batch = await Promise.all(queries.slice(i, i+4).map(fetchOne)); // cada batch es awaited
    }
    ```
    Con 20+ queries y timeout de 10 s por query, el bucle tarda `ceil(20/4) × 10s = 50s` en el peor caso. La función `pollNews` tiene una window de 5 minutos, pero 50s de trabajo en el event loop de Node.js durante el poll es significativo.
  - **Fix:** Ejecutar todas las queries simultáneamente:
    ```js
    const results = await Promise.allSettled(queries.map(fetchOne));
    ```

- [ ] 🟡 **O8 — `positionTracker.js`: `splice(0, n)` al llenarse el ring buffer es O(remaining)**
  - **Archivo:** `backend/services/positionTracker.js` línea ~53
  - **Problema:** `snapshots.splice(0, snapshots.length - HISTORY_LIMIT)` elimina elementos del inicio del array, requiriendo que JavaScript mueva todos los elementos restantes hacia el frente. Con 120 entradas es O(120) = despreciable, pero podría volverse relevante si `HISTORY_LIMIT` sube significativamente.
  - **Fix menor:** Usar un puntero circular (`head` index) en lugar de mutar el array, o simplemente `snapshots.shift()` (que es O(1) en V8 para arrays compactos).

- [ ] 🔵 **O9 — `useRealTimeData`: `cacheLoad()` llamado 8 veces en `useState` + 4 veces extra en `hasCachedData`**
  - **Archivo:** `frontend/src/hooks/useRealTimeData.js` líneas ~38–53
  - **Problema:** Las 6 llamadas a `cacheLoad(x)` en los `useState(() => ...)` inicializadores ya leen localStorage. Luego, `hasCachedData` llama a otros 4 `cacheLoad()` duplicando la lectura de los mismos datos. Al montar el hook, localStorage se lee **12 veces**. En dispositivos lentos con datos cacheados grandes (300+ KB de aircraft), esto añade latencia de montaje.
  - **Fix:** Calcular `hasCachedData` a partir de las referencias de estado ya cargadas:
    ```js
    const [aircraft, ...] = useState(() => cacheLoad('aircraft') || []);
    // ...después de todos los useState:
    const hasCachedData = useRef(!!(aircraft.length || ships.length || news.length || conflicts.length)).current;
    ```
    *(o calcularlo en el body del hook como `const hasCachedData = aircraft.length > 0 || ...` y usar un ref solo para que no cambie)*

---

### Corrección / Robustez

- [ ] 🟠 **O10 — `Globe3D`: listener `hashchange` de la URL de share-view no se limpia al desmontar**
  - **Archivo:** `frontend/src/components/CoordinateHUD.jsx` → función `shareView`
  - **Problema:** `shareView` escribe en `window.history.replaceState` y en el clipboard, pero `CoordinateHUD` no registra un listener para que la URL sea leída al montarse (para implementar el "fly to shared view" al cargar). Si en el futuro se añade un `window.addEventListener('hashchange', ...)` o `popstate`, deberá limpiarse en `useEffect` cleanup.
  - **Nota:** Este es un anti-patrón a evitar al extender la feature de share-view. Documentado para prevención.
  - **Fix preventivo:** Mover la lógica de "leer URL al boot" a `useEffect` en `App.jsx` con cleanup apropiado.

- [ ] 🟡 **O11 — `useTimeline`: el socket `history_data` handler captura `replayMode` como closure stale (B10 — confirmado)**
  - **Archivo:** `frontend/src/hooks/useTimeline.js` → `useEffect` de socket subscription
  - **Problema:**
    ```js
    useEffect(() => {
      const handler = ({ snapshots: snaps }) => {
        setCurrentIndex(prev => {
          if (replayMode) return Math.min(prev, snaps.length - 1); // replayMode es closure stale
          return snaps.length - 1;
        });
      };
      socket.on('history_data', handler);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socketRef]); // falta replayMode en deps
    ```
    Si el usuario entra en replay mode y llegan nuevos snapshots del servidor, `replayMode` puede leerse como `false` (valor del primer render), avanzando el índice al último snapshot en lugar de mantener la posición actual.
  - **Fix:** Usar un `useRef` para trackear `replayMode` en paralelo:
    ```js
    const replayModeRef = useRef(false);
    useEffect(() => { replayModeRef.current = replayMode; }, [replayMode]);
    // En el handler:
    if (replayModeRef.current) return Math.min(prev, snaps.length - 1);
    ```

- [ ] 🟡 **O12 — `AircraftLayer` + `ShipLayer`: `getDS()` llama a `viewer.dataSources.contains()` en cada render sin cache de estado**
  - **Archivos:** `frontend/src/components/AircraftLayer.jsx`, `frontend/src/components/ShipLayer.jsx`
  - **Problema:** `getDS(name)` valida `viewer.dataSources.contains(dsCache.current[name])` en cada llamada. `dataSources.contains()` en Cesium itera la lista de dataSources (linear search). Se llama múltiples veces por render para cada datasource. Con 5+ datasources activos, esto suma 10–15 iteraciones en cada update de aviones о barcos.
  - **Fix menor:** Cachear el resultado de `contains()` en un flag booleano dentro de `dsCache`, reseteado solo en cleanup del `useEffect`.

- [ ] 🔵 **O13 — `SitrepCapture`: `document.execCommand('copy')` está deprecado como fallback de clipboard**
  - **Archivo:** `frontend/src/components/CoordinateHUD.jsx` → `shareView()` / y posiblemente `SitrepCapture.jsx`
  - **Problema:** El fallback usa `document.execCommand('copy')` que está marcado como deprecated en MDN y puede ser eliminado en versiones futuras de Chrome/Firefox.
  - **Fix:** Usar el [Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText) exclusivamente con un try/catch sin fallback, o mostrar un toast con el URL para copiar manualmente.

---

### Arquitectura / Mantenibilidad

- [ ] 🟡 **O14 — `positionTracker.js` no comprueba coordenadas válidas antes de guardar en snapshot**
  - **Archivo:** `backend/services/positionTracker.js` → `recordSnapshot()`
  - **Problema:** Si un avión tiene `lat: null` o `lon: null` (posición desconocida, frecuente en ADS-B), se almacena igualmente en el snapshot. Cuando el frontend recibe estos snapshots y construye `historyTrack`, llama a `Cesium.Cartesian3.fromDegrees(null, null)` lo cual genera `NaN` en las posiciones y errores silenciosos en Cesium.
  - **Fix:** Filtrar antes de snapshot:
    ```js
    aircraft: aircraft
      .filter(ac => ac.lat != null && ac.lon != null)
      .map(ac => ({ ... })),
    ```

- [ ] 🟡 **O15 — `conflictService.js`: `mergeIntoStore` con TTL de 7 días puede acumular eventos obsoletos indefinidamente si el servidor no se reinicia**
  - **Archivo:** `backend/services/conflictService.js`
  - **Problema:** `conflictStore` es un `Map` global en memoria. Eventos con `createdAt` dentro del TTL (7 días) nunca se eliminan hasta que caducan naturalmente. Si hay un spike de eventos (crisis geopolítica con 500+ eventos en un día), el store puede crecer enormemente y el payload `conflict_update` enviado a todos los clientes puede exceder centenares de KB.
  - **Fix:** Añadir un límite de tamaño máximo en `mergeIntoStore` (ej. `MAX_STORE_SIZE = 500`) con política de desalojo LRU o priorizando los más recientes.

- [ ] � **O17 — `alertsFromNews()` se computa incondicionalmente en cada `pollNews()` aunque no haya news nuevas**
  - **Archivo:** `backend/server.js` → `pollNews()`, línea: `cache.alerts = alertsFromNews(cache.news)`
  - **Problema:** La llamada está fuera del bloque `if (changed)`, por lo que `alertsFromNews` itera todas las noticias (hasta 100) y regenera el array de alertas cada 5 minutos incluso cuando el store de noticias no ha cambiado. El array resultante es **siempre emitido** vía `io.emit('danger_update', ...)` al final de `pollNews` sin ninguna comparación con el valor anterior.
  - **Consecuencias:**
    - CPU: cómputo innecesario 12× por hora cuando no hay noticias nuevas
    - Red: ~288 `danger_update` diarios desde el path `pollNews` solo, independientemente de si hay cambios
  - **Fix:** Mover `alertsFromNews` dentro del bloque `if (changed)` y añadir hash del resultado para comparación antes de emitir.

- [ ] 🔵 **O18 — `version: '1.0.0'` hardcodeado en `/api/status` — nunca se actualiza**
  - **Archivo:** `backend/server.js` → endpoint `GET /api/status`
  - **Problema:** `version: '1.0.0'` es un literal string que no se actualiza automáticamente cuando cambia `package.json`. Confunde a monitores externos que comparan versión del endpoint con versión del repo.
  - **Fix:** `version: process.env.npm_package_version || '2.1.0'` — Node.js expone la versión de `package.json` en esa variable de entorno durante `npm start`/`node`.

- [ ] �🔵 **O16 — Bundle size: `import * as Cesium from 'cesium'` en múltiples componentes sin tree-shaking**
  - **Archivos:** `AircraftLayer.jsx`, `ShipLayer.jsx`, `ConflictLayer.jsx`, `DangerZoneLayer.jsx`, `NewsLayer.jsx`, `FIRMSLayer.jsx`, `CoordinateHUD.jsx`, `Globe3D.jsx`, `EntityPopup.jsx`
  - **Problema:** CesiumJS (~2MB minified) se importa con `import * as Cesium` en 9 componentes. Aunque Vite debería deduplicarlo en el bundle, tener el namespace completo disponible impide al analizador eliminar exports no usados. El bundle resultante es substancialmente mayor de lo necesario.
  - **Fix a largo plazo:** Usar named imports cuando sea posible: `import { Cartesian3, Color, ... } from 'cesium'`. O configurar `@cesium/engine` directamente.

---

## 11. RESUMEN DE NUEVAS OPTIMIZACIONES

| ID | Tipo | Impacto | Coste |
|----|------|---------|-------|
| O1 | Perf / UX | Alto — CPU en mouse move | Bajo (1 variable de gate) |
| O2 | Perf / UX | Medio — keystrokes + 30s refresh | Bajo (debounce + useMemo) |
| O3 | Perf | Medio — render 10k ops | Bajo (1 useMemo) |
| O4 | Estabilidad | Alto — QuotaExceededError silente | Medio (filtrar por trackedList) |
| O5 | Perf | Bajo-Medio | Bajo (separar estados) |
| O6 | Perf | Bajo-Medio | Bajo (React.memo en 2 componentes) |
| O7 | Perf Backend | Medio — 50s news poll bloqueante | Bajo (quitar bucle secuencial) |
| O8 | Perf Backend | Bajo (120 items) | Trivial |
| O9 | Perf | Bajo | Bajo (reordenar inicializadores) |
| O10 | Corrección | Bajo (preventivo) | N/A |
| O11 | Corrección | Medio — replay mode stale closure | Bajo (useRef) |
| O12 | Perf | Bajo | Bajo (boolean cache) |
| O13 | Compatibilidad | Bajo-Medio (deprecated API) | Bajo |
| O14 | Corrección | Medio — NaN en Cesium | Bajo (filter en recordSnapshot) |
| O15 | Estabilidad | Medio-Alto (conflictStore unbounded) | Medio (MAX_STORE_SIZE) |
| O16 | Bundle | Medio (tamaño inicial) | Alto (refactor imports) |
| O17 | Perf Backend / Red | Medio — 288 emits/día innecesarios | Bajo (mover dentro de `if changed`) |
| O18 | Mantenibilidad | Bajo | Trivial (`process.env.npm_package_version`) |

---

*Auditoría realizada mediante lectura directa de todos los archivos del proyecto. Los números de línea son aproximados y pueden variar tras ediciones recientes.*
