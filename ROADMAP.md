# MILTRACKER 3D — Roadmap Técnico Detallado

> Versión del análisis: Junio 2025  
> Prioridad: P0 = Bloqueante / P1 = Alta / P2 = Media / P3 = Mejora futura

---

## Tabla de Contenidos

1. [Bugs Conocidos y Correcciones Pendientes](#1-bugs-conocidos-y-correcciones-pendientes)
2. [Performance — Frontend](#2-performance--frontend)
3. [Performance — Backend](#3-performance--backend)
4. [Arquitectura — Backend](#4-arquitectura--backend)
5. [Arquitectura — Frontend](#5-arquitectura--frontend)
6. [Datos y Fuentes Externas](#6-datos-y-fuentes-externas)
7. [UX / Estilo / HUD](#7-ux--estilo--hud)
8. [Seguridad](#8-seguridad)
9. [Testing y Calidad de Código](#9-testing-y-calidad-de-código)
10. [Nuevas Funcionalidades](#10-nuevas-funcionalidades)
11. [DevOps y Deployment](#11-devops-y-deployment)
12. [Priorización Visual](#12-priorizacion-visual)

---

## 1. Bugs Conocidos y Correcciones Pendientes

### 1.1 Emoji en FilterPanel — Inconsistencia con política de iconos `[P1]`

**Archivo:** `frontend/src/components/FilterPanel.jsx` líneas 66–70

**Problema:** El panel de estadísticas usa emoji directamente (`✈`, `⚓`, `📰`, `🚨`, `💥`) en HTML, exactamente lo que se eliminó de los billboards 3D. Inconsistencia visual y de política.

**Fix recomendado:**
```jsx
// Reemplazar con caracteres ASCII o SVG inline
<span>▲ <span className="text-hud-blue font-bold">{aircraftCount}</span> aircraft</span>
<span>▬ <span className="text-hud-blue font-bold">{shipCount}</span> ships</span>
<span>■ <span className="text-hud-amber font-bold">{newsCount}</span> news</span>
<span>⚠ <span className="text-red-400 font-bold">{alertCount}</span> alerts</span>
<span>◆ <span className="text-orange-400 font-bold">{conflictCount}</span> events</span>
```

---

### 1.2 Botones FLY TO / OPEN en EntityPopup siguen usando emoji `[P1]`

**Archivo:** `frontend/src/components/EntityPopup.jsx` líneas 144–153

**Problema:** Los botones del pie del popup usan `📍 FLY TO` y `🔗 OPEN`/`🔗 SOURCE`. Misma inconsistencia.

**Fix:** Reemplazar `📍` por `►` y `🔗` por `↗`.

---

### 1.3 `isDestroyed()` no protege AircraftLayer al actualizar trails `[P1]`

**Archivo:** `frontend/src/components/AircraftLayer.jsx`

**Problema:** El trail (polyline history) se actualiza en un loop separado al loop de entidades. Si el Viewer se destruye durante el animation frame del trail, la actualización del `DataSource` de trails no tiene guard `isDestroyed()`.

**Fix:** Añadir `if (!viewerRef.current || viewerRef.current.isDestroyed()) return;` al inicio del effect de trails.

---

### 1.4 Ship filter por país nunca funciona para la mayoría de países `[P1]`

**Archivo:** `frontend/src/utils/militaryFilter.js` línea 124

**Problema:** `filterShips` mapea sólo 6 países a códigos de bandera de 2 letras. El resto de filtros (`Israel`, `Turkey`, `Iran`, etc.) nunca coincide porque `sh.flag` es código ISO 2 y el mapa es incompleto.

**Fix completo:**
```javascript
const flagMap = {
  'United States': 'US', 'Russia': 'RU', 'China': 'CN',
  'United Kingdom': 'GB', 'France': 'FR', 'Germany': 'DE',
  'Israel': 'IL', 'Turkey': 'TR', 'Iran': 'IR', 'Ukraine': 'UA',
  'India': 'IN', 'Japan': 'JP', 'South Korea': 'KR',
  'Australia': 'AU', 'Canada': 'CA', 'Norway': 'NO',
  'Netherlands': 'NL', 'Spain': 'ES', 'Italy': 'IT',
};
```

---

### 1.5 `categorizeAircraft()` nunca usada en la UI `[P2]`

**Archivo:** `frontend/src/utils/militaryFilter.js` línea 140

**Problema:** La función `categorizeAircraft()` existe pero ningún componente la llama. No se muestra `Transport`, `Fighter/Bomber`, etc., en ningún sitio.

**Fix:** Mostrar la categoría en el popup de aeronave (debajo de AC TYPE) y/o en la label del billboard.

---

### 1.6 `aiDanger.js` — respuesta Gemini nunca parseada correctamente `[P1]`

**Archivo:** `backend/services/aiDanger.js`

**Problema:** El archivo está cortado (termina en la línea 200 de 211). Si el parsing del JSON de Gemini falla (respuesta con texto extra antes del `{`), la función lanza pero no hay `try/catch` fuera del corte visible. La emisión del evento `ai_insight` en `server.js` tiene `catch` pero el error se silencia con un `console.warn`, dejando `aiInsight` siempre `null` en el cliente.

**Fix:** Añadir extracción robusta del JSON de la respuesta Gemini:
```javascript
const text = data.candidates[0].content.parts[0].text;
const jsonMatch = text.match(/\{[\s\S]*\}/);
if (!jsonMatch) throw new Error('No JSON in Gemini response');
return JSON.parse(jsonMatch[0]);
```

---

### 1.7 `useRealTimeData` — `BACKEND_URL` hardcodeado `[P2]`

**Archivo:** `frontend/src/hooks/useRealTimeData.js` línea 8

**Problema:** `const BACKEND_URL = 'http://localhost:3001'` está hardcodeado. En un deployment en producción o en otra máquina fallará silenciosamente.

**Fix:**
```javascript
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
```
Y añadir `.env.example` con `VITE_BACKEND_URL=http://localhost:3001`.

---

### 1.8 Ships — `drift state` global nunca se limpia `[P2]`

**Archivo:** `backend/services/vesselFinder.js` línea 74

**Problema:** El objeto `driftState` acumula entradas para cada MMSI visto. Si un barco desaparece del feed, su entrada en `driftState` queda eternamente (memory leak menor, pero leak al fin).

**Fix:** Limpiar entradas cuyo MMSI no esté en el set actual al inicio de cada tick.

---

### 1.9 Conflictos — deduplicación por título es frágil `[P2]`

**Archivo:** `backend/services/conflictService.js`

**Problema:** La deduplicación de seeds vs live GDELT usa `title.slice(0,50)` como clave. Dos artículos con el mismo evento pero distinto título introducen duplicados. Además, el campo `id` de los seeds es un string estático que puede colisionar con IDs auto-generados de GDELT.

**Fix:** Generar IDs de seed con prefijo `seed-` y deduplicar por `(lat, lon, eventType, date)` con tolerancia de ±0.5° y ±24h.

---

## 2. Performance — Frontend

### 2.1 Re-render completo de capas en cada tick de datos `[P0]`

**Archivos:** `AircraftLayer.jsx`, `ShipLayer.jsx`, `NewsLayer.jsx`, `ConflictLayer.jsx`

**Problema:** Cada vez que llegan datos nuevos por WebSocket, el array entero (hasta 130+ aeronaves) se pasa como prop. El `useEffect` que sync las entidades de Cesium itera sobre TODOS los items y recrea los que no coinciden. Para 130 aeronaves con actualización cada 30s, esto es ~130 operaciones de `DataSource` en el thread principal.

**Fix — Virtual diff con Map:**
```javascript
// En lugar de limpiar y re-añadir todo:
const existingIds = new Set(dataSource.entities.values.map(e => e.id));
const newIds = new Set(items.map(i => i.id));

// 1. Añadir/actualizar sólo los nuevos/cambiados
for (const item of items) {
  if (!existingIds.has(item.id)) {
    addEntity(item); // nueva entidad
  } else {
    updateEntity(item); // sólo posición + heading
  }
}
// 2. Eliminar los que ya no existen
for (const id of existingIds) {
  if (!newIds.has(id)) dataSource.entities.removeById(id);
}
```

**Impacto esperado:** Reducción del 80-90% de operaciones DOM/WebGL por tick.

---

### 2.2 `buildIcon()` en ConflictLayer recrea canvas en cada render `[P1]`

**Archivo:** `frontend/src/components/ConflictLayer.jsx`

**Problema:** `buildIcon(eventType, severity)` dibuja un canvas de 56×56px cada vez que se procesa un conflicto. Con 37 eventos y re-renders frecuentes, esto son cientos de operaciones de canvas innecesarias.

**Fix — Memoize icons por `(type, severity)`:**
```javascript
const iconCache = new Map();

function buildIcon(eventType, severity) {
  const key = `${eventType}:${severity}`;
  if (iconCache.has(key)) return iconCache.get(key);
  // ... dibuja canvas ...
  const url = canvas.toDataURL();
  iconCache.set(key, url);
  return url;
}
```
Con 8 tipos × 3 severidades = máximo 24 canvas en caché total.

---

### 2.3 `useMemo` en App.jsx no impide re-renders de capas sin cambios `[P1]`

**Archivo:** `frontend/src/App.jsx`

**Problema:** `filteredAircraft`, `filteredShips`, etc., se recalculan con `useMemo`, pero si `filters` cambia (p.ej. el toggle de `showNews`), TODOS los memos se recomputan aunque el cambio no afecte a esa capa — porque todos dependen del objeto `filters` completo.

**Fix:** Dividir en memos específicos por capa:
```javascript
const filteredAircraft = useMemo(
  () => filterAircraft(aircraft, filters),
  [aircraft, filters.showAircraft, filters.country, filters.alliance, filters.showOnGround]
);
```

---

### 2.4 CesiumJS bundle — sin `CESIUM_BASE_URL` optimizado `[P1]`

**Archivo:** `frontend/vite.config.js`

**Problema:** `vite-plugin-cesium` incluye los workers de CesiumJS (terrain, imagery, etc.) en el bundle. Sin configuración de `cesiumBaseURL` explícita o split de chunks, el primer load puede ser >10MB.

**Fix recomendado en `vite.config.js`:**
```javascript
import cesium from 'vite-plugin-cesium';

export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          cesium: ['cesium'],
          react: ['react', 'react-dom'],
        }
      }
    },
    chunkSizeWarningLimit: 3000,
  },
  plugins: [react(), cesium()],
};
```

---

### 2.5 Trails de aeronaves — sin límite de puntos por entidad `[P2]`

**Archivo:** `frontend/src/components/AircraftLayer.jsx`

**Problema:** El historial de posiciones (trail) acumula hasta N posiciones por aeronave. Para vuelos largos de varios horas en sesión activa, esto puede ser un leak de memoria de `Cartesian3[]` de gran tamaño.

**Fix:** Cap de 60 puntos (30 minutos a 30s de poll) con `shift()` del array al superar el límite.

---

### 2.6 En re-renders, `viewer.dataSources.getByName()` se llama en cada effect `[P2]`

**Archivos:** capas en `components/`

**Problema:** En cada efecto de sync se busca el DataSource por nombre con un O(n) scan. Con múltiples capas activas, este patrón se repite ~5 veces en cada tick.

**Fix:** Guardar la referencia al DataSource en un `useRef` al crearlo; no buscarlo en cada render.

---

## 3. Performance — Backend

### 3.1 `pollAircraft` hace 3 fetches secuenciales en cadena `[P1]`

**Archivo:** `backend/server.js`

**Problema:** El sistema de fallback intenta adsb.lol, luego adsb.fi, luego airplanes.live en serie. Si adsb.lol tarda 8s en timeout, el poll completo puede tardar 24+ segundos, más que el propio intervalo de 30s.

**Fix:** `Promise.race` o timeout agresivo por fuente (3s) para failover rápido:
```javascript
async function fetchWithTimeout(url, ms = 4000) {
  return fetch(url, { signal: AbortSignal.timeout(ms) });
}
```

---

### 3.2 GDELT — `Promise.allSettled` sin límite de concurrencia `[P1]`

**Archivo:** `backend/services/conflictService.js`

**Problema:** Se lanzan 17 queries a GDELT (9 GEO + 8 DOC) simultáneamente. GDELT es una API pública sin autenticación; lanzar 17 requests en paralelo puede provocar rate limiting (HTTP 429) o bloqueo de IP.

**Fix:** Implementar límite de concurrencia con `p-limit` o batches de 4:
```javascript
// Batches de 4 requests con 500ms entre batches
const results = [];
for (let i = 0; i < queries.length; i += 4) {
  const batch = queries.slice(i, i+4).map(q => fetchGDELT(q));
  results.push(...await Promise.allSettled(batch));
  if (i + 4 < queries.length) await sleep(500);
}
```

---

### 3.3 Disk cache no tiene TTL — puede servir datos de días `[P1]`

**Archivo:** `backend/services/diskCache.js` (inferido por uso en server.js)

**Problema:** Los archivos `.cache.json` se leen al arrancar el servidor sin verificar la antigüedad del archivo. Si el servidor reinicia después de 12h sin conectividad, sirve datos de conflictos/noticias con 12h de antigüedad como si fueran actuales.

**Fix:** Añadir campo `cachedAt` al JSON y validar antigüedad al leer:
```javascript
function loadCache(name, maxAgeMs = 3_600_000) { // 1h default
  const data = JSON.parse(fs.readFileSync(path));
  if (Date.now() - new Date(data.cachedAt) > maxAgeMs) return null;
  return data.payload;
}
```

---

### 3.4 `analyzeLocalDanger` ejecutado en el thread de Node sin worker `[P2]`

**Archivo:** `backend/services/aiDanger.js`

**Problema:** `analyzeLocalDanger()` itera O(aircraft × zones + ships × zones + aircraft²) en el thread principal de Node.js. Con 130 aeronaves y 12 zonas = 1560 distancias Haversine + ~8450 comparaciones por pares. Si se llama por cada conexión, bloquea el event loop ~5-10ms.

**Fix:** Mover a `worker_threads` o sólo ejecutar en el poll periódico (no en `socket.on('connect')`).

---

### 3.5 No hay compresión HTTP en Express `[P1]`

**Archivo:** `backend/server.js`

**Problema:** Las respuestas REST y WebSocket payload (hasta 130 aeronaves × ~500 bytes = 65KB por tick) se envían sin comprimir. En conexiones lentas esto afecta la latencia percibida.

**Fix:**
```javascript
import compression from 'compression';
app.use(compression());
```
Añadir `compression` a `dependencies`.

---

### 3.6 WebSocket emite a TODOS los clientes aunque datos no hayan cambiado `[P2]`

**Archivo:** `backend/server.js`

**Problema:** `io.emit('aircraft_update', { aircraft, timestamp })` se ejecuta cada 30s independientemente de si los datos han cambiado respecto al tick anterior. En horas de baja actividad, se envían ~57KB/min de datos repetidos.

**Fix — Hash de datos:**
```javascript
const prevHash = { aircraft: null, ships: null };

function hashData(data) {
  return data.map(i => i.id + i.lat + i.lon).join('|');
}

// En pollAircraft:
const newHash = hashData(aircraft);
if (newHash !== prevHash.aircraft) {
  io.emit('aircraft_update', { aircraft, timestamp });
  prevHash.aircraft = newHash;
}
```

---

## 4. Arquitectura — Backend

### 4.1 Toda la lógica de polling en `server.js` — acoplamiento total `[P1]`

**Problema:** `server.js` mezcla: inicialización del servidor, gestión de sockets, lógica de polling, gestión de caché y orchestración de servicios (203 líneas). Esto complica el testing unitario y el mantenimiento.

**Arquitectura propuesta:**
```
backend/
  server.js              ← Express + Socket.io init SOLO
  scheduler.js           ← Polling intervals + orchestration
  socket/
    handlers.js          ← Eventos de socket (connect, disconnect, request_data)
    emitters.js          ← io.emit wrappers tipados
  services/
    aircraftService.js   ← ADS-B fetching (mover de server.js)
    vesselFinder.js      ← ya existe
    newsService.js       ← ya existe
    conflictService.js   ← ya existe
    aiDanger.js          ← ya existe
  cache/
    diskCache.js         ← ya existe
    memCache.js          ← NEW: in-memory cache con TTL
```

---

### 4.2 Sin sistema de logging estructurado `[P2]`

**Problema:** Todos los logs son `console.log()`/`console.warn()`. En producción es imposible filtrar, correlacionar o agregar logs.

**Fix:** Añadir `pino` (logger de alto rendimiento):
```javascript
import pino from 'pino';
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

logger.info({ source: 'adsb.lol', count: aircraft.length }, 'Aircraft poll OK');
logger.warn({ error: e.message }, 'GDELT fetch failed');
```

---

### 4.3 Sin manejo de errores global en Express `[P2]`

**Archivo:** `backend/server.js`

**Problema:** No hay middleware `app.use((err, req, res, next) => {...})`. Los errores no capturados en rutas devuelven stack traces en texto plano al cliente.

**Fix:**
```javascript
app.use((err, req, res, next) => {
  logger.error({ err }, 'Unhandled request error');
  res.status(500).json({ error: 'Internal server error' });
});
```

---

### 4.4 Sin rate limiting en las rutas REST `[P1]`

**Problema:** Los endpoints `/api/aircraft`, `/api/ships`, `/api/conflicts`, `/api/news` no tienen rate limiting. Un scraper o bot puede golpear el backend sin restricción.

**Fix:** Añadir `express-rate-limit`:
```javascript
import rateLimit from 'express-rate-limit';
const limiter = rateLimit({ windowMs: 60_000, max: 60 });
app.use('/api/', limiter);
```

---

### 4.5 Variables de entorno sin validación al arranque `[P2]`

**Problema:** Si `GEMINI_API_KEY`, `AISSTREAM_KEY`, etc., están mal escritas en `.env`, el servidor arranca sin error y sólo falla silenciosamente cuando se intenta usar la API.

**Fix:** Validar al arranque con un schema:
```javascript
const required = [];
const optional = ['GEMINI_API_KEY', 'AISSTREAM_KEY', 'PORT'];
optional.forEach(k => {
  if (!process.env[k]) logger.info(`[ENV] ${k} not set — feature disabled`);
});
```

---

## 5. Arquitectura — Frontend

### 5.1 Sin Context API para datos globales — prop drilling en capas `[P1]`

**Problema:** `App.jsx` pasa props a 5+ capas de componentes (aircraft, ships, conflicts, news, danger, filters). Cualquier nueva prop requiere modificar App.jsx Y el componente destino.

**Fix — Context de datos:**
```jsx
// contexts/TrackingDataContext.jsx
const TrackingDataContext = createContext();

export function TrackingDataProvider({ children }) {
  const data = useRealTimeData();
  return (
    <TrackingDataContext.Provider value={data}>
      {children}
    </TrackingDataContext.Provider>
  );
}

// En capas:
const { aircraft } = useContext(TrackingDataContext);
```

---

### 5.2 Sin manejo de errores en el árbol de componentes `[P1]`

**Problema:** Si cualquier capa de Cesium lanza un error (p.ej. `TypeError` con una entidad mal formada), React desmonta el árbol completo y muestra pantalla en blanco. No hay `ErrorBoundary`.

**Fix:**
```jsx
// components/ErrorBoundary.jsx
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div className="hud-panel p-4 text-red-400">
        Layer error: {this.state.error.message}
      </div>
    );
    return this.props.children;
  }
}

// Uso en App.jsx
<ErrorBoundary><AircraftLayer ... /></ErrorBoundary>
```

---

### 5.3 `icons.js` — SVG con dimensiones fijas no escalables `[P2]`

**Archivo:** `frontend/src/utils/icons.js`

**Problema:** Los SVGs de aeronaves y barcos están generados inline con tamaños fijos en píxeles. Para pantallas de alta densidad (Retina / 4K) quedan pixelados.

**Fix:** Usar `scaleByDistance` en los billboards en combinación con SVGs correctamente vectoriales (viewBox sin width/height fijos).

---

### 5.4 Tailwind — clases customizadas sin documentar `[P2]`

**Archivo:** `frontend/tailwind.config.js`

**Problema:** Clases como `hud-panel`, `hud-title`, `hud-label`, `hud-btn`, `hud-green`, `hud-blue`, etc., no están definidas en el config de Tailwind ni en un plugin documentado — probablemente en `index.css` como CSS custom. Esto dificulta el onboarding de nuevos desarrolladores.

**Fix:** Mover todas las clases `hud-*` a `tailwind.config.js` como `theme.extend` o crear `src/hud.css` con comentarios, y eliminar las definiciones sueltas en `index.css`.

---

## 6. Datos y Fuentes Externas

### 6.1 ADS-B — Sin tracking de cobertura temporal `[P2]`

**Problema:** Si adsb.lol devuelve 130 aeronaves pero hace 2 minutos devolvía 140, no hay forma de saber cuáles 10 "desaparecieron" — pueden seguir en vuelo pero no reportar ADS-B. La UI simplemente los elimina.

**Fix:** Implementar "ghost tracking" — mantener aeronaves en caché con flag `stale: true` hasta 5 minutos después de su último reporte, mostrándolas con opacidad reducida.

---

### 6.2 Ships — Fuente primaria (Norwegian AIS) sólo cubre barcos noruegos `[P1]`

**Archivo:** `backend/services/vesselFinder.js`

**Problema:** `kystdatahuset.no` devuelve sólo AIS de aguas noruegas. La mayoría de los barcos militares globales no aparecerán, cayendo siempre al fallback de demo data.

**Alternativas reales a evaluar:**
- **MarineTraffic API** (gratuita con límites) — cobertura global
- **AISHub** (gratuito con registro) — feed AIS real agregado
- **VesselFinder API** — plan gratuito disponible
- **aisstream.io** — ya soportado si se provee `AISSTREAM_KEY`

**Acción:** Documentar `AISSTREAM_KEY` como prioritario y añadir instrucciones de obtención (gratuito en aisstream.io).

---

### 6.3 News — Geocoding basado en keywords es inexacto `[P2]`

**Archivo:** `backend/services/conflictService.js` — `LOCATION_MAP`

**Problema:** El geocoding de titulares por keywords puede dar falsos positivos. "Iraq" en el headline puede referirse a política económica, no a un evento militar geolocable.

**Fix:** Añadir un filtro de keywords militares antes del geocoding:
```javascript
const MILITARY_KEYWORDS = [
  'airstrike', 'missile', 'military', 'troops', 'drone', 'bomb',
  'attack', 'explosion', 'forces', 'war', 'conflict', 'killed',
  'fighter', 'navy', 'army', 'strike', 'combat', 'offensive',
  'artillery', 'shelling', 'rocket', 'intercepted',
];

function hasMilitaryContext(title) {
  const lower = title.toLowerCase();
  return MILITARY_KEYWORDS.some(kw => lower.includes(kw));
}
```

---

### 6.4 GDELT — Sin manejo de respuestas vacías vs error `[P2]`

**Problema:** Si GDELT devuelve `{"articles": []}` (sin datos) vs timeout vs error HTTP, todos se tratan igual: `Promise.allSettled` retorna `rejected`. Se pierde información diagnóstica.

**Fix:** Diferenciar vacío vs error en logs para poder detectar problemas de API vs ausencia real de noticias.

---

### 6.5 Conflictos seed — Fechas estáticas `[P1]`

**Archivo:** `backend/services/conflictService.js` — `getSeedConflicts()`

**Problema:** Los 37 eventos seed tienen `publishedAt: new Date(Date.now() - X).toISOString()` calculado en el momento del arranque. Si el servidor corre durante días, los timestamps de los seeds se vuelven muy antiguos y en el popup de EntityPopup aparecerá "3d ago", "7d ago", etc., para eventos que deberían ser "actuales".

**Fix:** Recalcular los offsets relativos en cada llamada a `getSeedConflicts()`, o asignar `publishedAt: new Date().toISOString()` si no hay un timestamp real disponible.

También relacionado: los seeds deberían tener `isBaseline: true` para poder filtrarlos o etiquetarlos diferente en la UI ("Zona de conflicto activo" vs "Evento reportado").

---

## 7. UX / Estilo / HUD

### 7.1 Panel de alertas sin diseño completamente visual `[P1]`

**Archivo:** `frontend/src/components/AlertPanel.jsx`

**Problema:** Las alertas generadas por `analyzeLocalDanger` (aeronave en zona de conflicto, fast mover, intercept) se pasan al `AlertPanel` pero actualmente el componente probablemente sólo muestra una lista. Las alertas críticas deberían tener:
- Borde y flash animado en rojo para `critical`
- Icono de tipo de alerta (diferente para aircraft/ship/intercept)
- Botón "FLY TO" integrado en la alerta
- Auto-dismiss configurable (30s para alertas medium, nunca para critical)

---

### 7.2 Sin indicación visual de carga inicial `[P2]`

**Problema:** Cuando el frontend carga por primera vez y el backend todavía está completando los polls, el globo aparece vacío durante varios segundos. No hay spinner ni mensaje "Loading live data..." visible.

**Fix:** Añadir estado `isInitialLoad` en `useRealTimeData` (true hasta que lleguen los primeros datos), y mostrar overlay en el globo.

---

### 7.3 AlertPanel no tiene límite visible de alertas `[P2]`

**Archivo:** `backend/services/aiDanger.js` línea 126

**Problema:** El servidor limita alertas a `.slice(0, 30)` pero si hay 30 alertas activas, el panel se llena. En mobile o pantallas pequeñas, esto tapará el globo entero.

**Fix:** Mostrar máximo 5 alertas con "Ver todas (30)" expandible, y colapsar por severidad.

---

### 7.4 Sin modo oscuro/claro ni temas `[P3]`

**Problema:** El HUD está completamente seteado en oscuro (`hud-bg`, `#0a1628`, etc.). Para presentaciones o uso en exteriores, un tema claro sería útil.

**Nota:** Esta es una mejora de baja prioridad dado que la naturaleza del producto (militar, nocturno) favorece el oscuro.

---

### 7.5 Popup de aeronave sin enlace a FlightAware/FlightRadar24 `[P2]`

**Archivo:** `frontend/src/components/EntityPopup.jsx`

**Problema:** Los datos del popup de aeronave (callsign, ICAO24) podrían enlazarse a fuentes externas para más información.

**Fix:** Añadir link a `https://www.flightaware.com/live/flight/{callsign}` en el footer del popup, similar al botón de "SOURCE" en conflictos.

---

### 7.6 FilterPanel — sin filtro por tipo de aeronave `[P2]`

**Problema:** Actualmente se puede filtrar por país y alliance, pero no por tipo de misión (Tanker, ISR, Fighter, Transport). Esta información ya está disponible via `categorizeAircraft()`.

**Fix:** Añadir un dropdown "MISSION TYPE" en FilterPanel con opciones: ALL / Fighter / Transport / ISR / Tanker / Bomber.

---

### 7.7 Globe no tiene grid de coordenadas opcional `[P3]`

**Problema:** Para un sitio militar profesional, poder mostrar una grid de referencia MGRS o lat/lon en el globo añade credibilidad y funcionalidad.

**Fix CesiumJS:**
```javascript
viewer.scene.globe.showGroundAtmosphere = false;
const grid = new Cesium.GridImageryProvider({ cells: 8 });
viewer.imageryLayers.addImageryProvider(grid);
```

---

## 8. Seguridad

### 8.1 CORS totalmente abierto `[P1]`

**Archivo:** `backend/server.js`

**Problema:** `app.use(cors())` sin opciones permite requests desde cualquier origen. En producción, esto permite a cualquier sitio web consultar los datos de la API.

**Fix:**
```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET'],
}));
```

---

### 8.2 Socket.io sin autenticación `[P1]`

**Problema:** Cualquier cliente puede conectarse al WebSocket y recibir los datos completos (aircraft, ships, conflicts). Tampoco hay protección contra clients maliciosos que emitan eventos.

**Fix básico:** Añadir middleware de autenticación con token simple:
```javascript
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token !== process.env.SOCKET_SECRET) return next(new Error('Unauthorized'));
  next();
});
```

---

### 8.3 Información sensible en respuestas de error `[P2]`

**Problema:** Los `catch` en el backend hacen `console.error(e)` y a veces `res.status(500).json({ error: e.message })`. El mensaje de error puede exponer paths del servidor o detalles de APIs internas.

**Fix:** En producción (`NODE_ENV === 'production'`), devolver sólo mensajes genéricos; en desarrollo, la info completa.

---

## 9. Testing y Calidad de Código

### 9.1 Sin tests unitarios ni de integración `[P1]`

**Problema:** No existe ningún archivo `*.test.js` o `*.spec.js` en el proyecto. Las funciones críticas como `geocodeTitle()`, `filterAircraft()`, `analyzeLocalDanger()`, `icaoToCountry()` no tienen cobertura.

**Setup recomendado:**

Para el backend:
```bash
npm install --save-dev jest
```
```javascript
// services/conflictService.test.js
import { geocodeTitle } from './conflictService.js';
test('geocodes Tehran correctly', () => {
  const result = geocodeTitle('Iran IRGC fires missile near Tehran', 'Iran');
  expect(result.lat).toBeCloseTo(35.7, 0);
  expect(result.lon).toBeCloseTo(51.4, 0);
});
```

Para el frontend:
```bash
npm install --save-dev vitest @testing-library/react
```

---

### 9.2 Sin TypeScript — tipos implícitos causarán bugs `[P2]`

**Problema:** El proyecto usa JavaScript puro. Funciones como `formatAltitude(meters)` están llamadas en algunos sitios con `altitudeFt` en pies en vez de metros, sin que TypeScript lo detecte.

**Migración gradual recomendada:**
1. Añadir `// @ts-check` + JSDoc types a utils y servicios
2. Migrar `utils/` y `hooks/` a `.ts` primero
3. Migrar `components/` gradualmente

---

### 9.3 Sin ESLint configurado `[P2]`

**Problema:** No hay `.eslintrc` en el proyecto. Sin linter, bugs como variables no usadas, `==` vs `===`, o `console.log` olvidados llegan a producción.

**Fix:**
```bash
npm install --save-dev eslint @eslint/js eslint-plugin-react
```
```json
// .eslintrc.json
{
  "extends": ["eslint:recommended", "plugin:react/recommended"],
  "rules": {
    "no-console": "warn",
    "eqeqeq": "error"
  }
}
```

---

### 9.4 Duplicación de `distanceKm` / `distKm` `[P2]`

**Archivos:** `frontend/src/utils/geoUtils.js` y `backend/services/aiDanger.js`

**Problema:** La función Haversine está implementada dos veces con nombres distintos. Si uno se optimiza o corrige, el otro queda desactualizado.

**Fix:** En el backend, crear `utils/geoUtils.js` compartido. Si el proyecto migrara a monorepo o shared package, esto quedaría en un único lugar.

---

## 10. Nuevas Funcionalidades

### 10.1 Replay de datos históricos `[P2]`

**Descripción:** Permitir reproducir los datos de las últimas 24h almacenados en caché, con un slider de tiempo y botones play/pause/speed. CesiumJS tiene soporte nativo via `ClockViewModel`.

**Implementación:**
- Backend: conservar últimos N snapshots por tipo (circular buffer en archivo JSON o SQLite)
- Frontend: `TimelineWidget` de Cesium + `SampledPositionProperty` para aeronaves

---

### 10.2 Mapa de calor de actividad militar `[P2]`

**Descripción:** Capa de heatmap (acumulada en las últimas 24h) mostrando densidad de tráfico militar por área geográfica.

**Implementación:** CesiumJS `HeatmapImageryProvider` o canvas overlay custom con datos de posiciones históricas.

---

### 10.3 Alertas push / notificaciones browser `[P2]`

**Descripción:** Enviar notificación del navegador (`Notification API`) cuando una alerta de severidad `critical` se genere (aeronave en zona de conflicto, intercept detectado, etc.).

**Implementación:**
```javascript
// En useRealTimeData.js o AlertPanel.jsx
if (alert.severity === 'critical' && Notification.permission === 'granted') {
  new Notification(`MILTRACKER ALERT: ${alert.title}`, {
    body: alert.message,
    icon: '/mil-icon-192.png'
  });
}
```

---

### 10.4 Panel de estadísticas / Dashboard `[P2]`

**Descripción:** Vista lateral colapsable o pantalla separada con métricas:
- Aeronaves por país (gráfico de barras)
- Distribución de altitudes
- Actividad de noticias por zona geográfica
- Timeline de eventos de conflicto

**Implementación:** Añadir `recharts` o `chart.js` al frontend.

---

### 10.5 Búsqueda de entidades `[P1]`

**Descripción:** Barra de búsqueda global para encontrar aeronave por callsign/ICAO, barco por nombre/MMSI, o conflicto por país/tipo. Al seleccionar, hace `flyTo` a la entidad.

**Implementación:** Input con debounce + filtrado en memoria + `viewer.camera.flyTo()`.

---

### 10.6 Exportar datos a GeoJSON / KML `[P3]`

**Descripción:** Botón en la UI para exportar la vista actual (aeronaves/barcos/conflictos visibles) como GeoJSON o KML, para uso en otros sistemas SIG (QGIS, Google Earth, etc.).

---

### 10.7 Modo de Presentación / Pantalla Completa `[P2]`

**Descripción:** Modo "sin HUD" que oculta todos los paneles y muestra sólo el globo con billboards, para presentaciones o pantallas de mando.

**Implementación:** Toggle con tecla `F11` o botón dedicado. Usar `document.documentElement.requestFullscreen()` + CSS que oculte los paneles con `pointer-events: none; opacity: 0`.

---

### 10.8 Soporte PWA (Progressive Web App) `[P2]`

**Descripción:** Añadir `manifest.json` y service worker básico para que la app pueda instalarse en desktop/móvil y cargue el último estado cached sin conexión.

**Implementación:**
```bash
npm install --save-dev vite-plugin-pwa
```

---

### 10.9 Internacionalización (i18n) `[P3]`

**Descripción:** Soporte para español / inglés. La UI actual está en inglés ("AIRCRAFT INTEL", "VESSEL INTEL", etc.). Para audiencia hispanohablante.

**Implementación:** `react-i18next` con archivos de traducción en `public/locales/`.

---

### 10.10 Panel de Inteligencia AI expandido `[P2]`

**Descripción:** Actualmente `aiInsight` (respuesta de Gemini) no tiene un componente dedicado en la UI (sólo se almacena en estado). Crear panel colapsable "AI THREAT ASSESSMENT" con:
- Nivel de amenaza con badge de color
- Resumen geopolítico
- Lista de hotspots con botón flyTo por cada uno
- Timestamp de la última evaluación

---

## 11. DevOps y Deployment

### 11.1 Sin `docker-compose.yml` para desarrollo `[P1]`

**Problema:** Para reproducir el entorno en otra máquina hay que instalar Node, arrancar backend y frontend por separado manualmente. Sin Docker, el onboarding lleva 15+ minutos.

**Fix:**
```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports: ["3001:3001"]
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    volumes: ["./backend/data:/app/data"]

  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    environment:
      - VITE_BACKEND_URL=http://backend:3001
    depends_on: [backend]
```

---

### 11.2 Sin script de `start` unificado `[P2]`

**Problema:** Para arrancar el proyecto hay que abrir dos terminales: `cd backend && npm run dev` y `cd frontend && npm run dev`. No hay script en el `package.json` raíz.

**Fix en `package.json` raíz:**
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev --prefix backend\" \"npm run dev --prefix frontend\"",
    "build": "npm run build --prefix frontend",
    "start": "npm run start --prefix backend"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

---

### 11.3 Sin proceso de build de producción documentado `[P1]`

**Problema:** No hay instrucciones sobre cómo hacer un build de producción, servir el frontend estático desde el backend, o hacer deployment a un servidor VPS/cloud.

**Fix sugerido — servir frontend desde backend:**
```javascript
// En server.js (producción):
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => res.sendFile(
    path.join(__dirname, '../frontend/dist/index.html')
  ));
}
```

---

### 11.4 Sin archivo `.env.example` `[P1]`

**Problema:** Las variables de entorno (`GEMINI_API_KEY`, `AISSTREAM_KEY`, `PORT`, `SOCKET_SECRET`) no están documentadas en ningún archivo de ejemplo.

**Fix:**
```bash
# .env.example
PORT=3001
GEMINI_API_KEY=           # Optional: https://aistudio.google.com/app/apikey
AISSTREAM_KEY=            # Optional: https://aisstream.io
SOCKET_SECRET=            # Recommended in production
FRONTEND_URL=http://localhost:5173
LOG_LEVEL=info            # debug | info | warn | error
```

---

## 12. Priorización Visual

| Ítem | Área | Prioridad | Esfuerzo | Impacto |
|------|------|-----------|----------|---------|
| 2.1 Virtual diff en capas | Frontend Perf | P0 | Alto | Muy Alto |
| 1.4 Ship filter países | Bug | P1 | Bajo | Medio |
| 1.3 Trail isDestroyed guard | Bug | P1 | Bajo | Alto |
| 3.1 ADS-B timeout agresivo | Backend Perf | P1 | Bajo | Alto |
| 3.5 Compresión HTTP | Backend Perf | P1 | Bajo | Medio |
| 4.4 Rate limiting | Seguridad | P1 | Bajo | Alto |
| 8.1 CORS restrictivo | Seguridad | P1 | Bajo | Alto |
| 11.4 `.env.example` | DevOps | P1 | Muy Bajo | Medio |
| 6.5 Seeds publishedAt dinámico | Datos | P1 | Bajo | Medio |
| 2.2 Memoize buildIcon() | Frontend Perf | P1 | Bajo | Medio |
| 10.5 Búsqueda global | Feature | P1 | Medio | Alto |
| 3.3 Cache TTL | Backend Perf | P1 | Bajo | Medio |
| 5.2 ErrorBoundary | Arquitectura | P1 | Bajo | Alto |
| 11.2 Script dev unificado | DevOps | P2 | Muy Bajo | Bajo |
| 2.4 Vite chunks CesiumJS | Frontend Perf | P1 | Bajo | Alto |
| 9.1 Tests unitarios | Calidad | P1 | Alto | Muy Alto |
| 10.3 Notificaciones push | Feature | P2 | Medio | Alto |
| 10.10 Panel AI expandido | Feature | P2 | Medio | Medio |
| 10.2 Heatmap actividad | Feature | P2 | Alto | Medio |
| 10.1 Replay histórico | Feature | P2 | Alto | Alto |

---

*Roadmap generado automáticamente mediante análisis estático y dinámico del codebase de MilTracker 3D.*  
*Última actualización: Junio 2025*
