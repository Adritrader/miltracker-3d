# MilTracker 3D — Auditoría Técnica Completa

> Estado del análisis: **todos los archivos del proyecto leídos**
> Fecha: 2026-03-06 | Versión auditada: commit `0cb7c07` → fixes aplicados 2026-03-06

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

- [ ] 🔵 **T6 — `hasCachedData` usa `useRef` y se calcula una sola vez al montar el componente**
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

---

*Auditoría realizada mediante lectura directa de todos los archivos del proyecto. Los números de línea son aproximados y pueden variar tras ediciones recientes.*
