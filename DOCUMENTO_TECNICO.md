# MILTRACKER 3D — Documento Técnico y Ejecutivo

> Versión 1.0 · 5 de marzo de 2026  
> Estado de producción: **LIVE** — Railway (backend) + Vercel (frontend)

---

## RESUMEN EJECUTIVO

**MilTracker 3D** es una plataforma de inteligencia de situación militar en tiempo real que visualiza aeronaves militares, buques de guerra, eventos de conflicto activo y noticias geoespaciales sobre un globo 3D interactivo. Agrega y correlaciona datos de múltiples fuentes públicas en tiempo real para proporcionar una foto actualizada cada 30 segundos de la actividad militar mundial.

### Propuesta de valor

| | MilTracker 3D | Alternativas comerciales tipo Flightradar24 / MarineTraffic |
|---|---|---|
| **Foco** | Exclusivamente militar/defensa | Tráfico civil + militar mezclado |
| **Correlación** | Aeronaves + Buques + Eventos + Noticias en un mismo globo | Datos en silos separados |
| **3D Globe** | CesiumJS, rotación libre, altitud real de vuelo | Vista 2D plana |
| **IA** | Análisis de amenazas por proximidad (Gemini) | Sin IA de alerta |
| **Replay histórico** | 1h+ de historial navegable con controles de vídeo | Datos en directo solo |
| **Coste de operación** | ~0 USD/mes (fuentes gratuitas) | Datos bajo suscripción de pago |

---

## 1. ARQUITECTURA GENERAL

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         FUENTES DE DATOS (gratuitas)                      │
│  adsb.lol · adsb.fi · airplanes.live │ VesselFinder │ GDELT API · NASA   │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │ HTTP polling (30s / 60s / 5-10 min)
                             ▼
┌─────────────────────── BACKEND (Node.js 20+) ────────────────────────────┐
│  Express + Socket.io                                                       │
│  ├── Fallback chain ADS-B: adsb.lol → adsb.fi → airplanes.live            │
│  ├── Conflict store: GDELT + seed dataset (72h TTL, sin duplicados)        │
│  ├── News store: GDELT DOC + keyword geocoding (72h TTL)                   │
│  ├── NASA FIRMS thermal anomalies (incendios / hotspots)                   │
│  ├── Position tracker: ring buffer 120 snapshots (~1h historial)           │
│  ├── AI risk engine: reglas de proximidad + Gemini (opcional)              │
│  ├── Disk cache: *.cache.json — arranque instantáneo tras reinicio         │
│  └── CORS: producción solo orígenes allowlist / dev abierto                │
│                              │ Socket.io emissions (delta only si cambia)  │
└──────────────────────────────┼───────────────────────────────────────────┘
                               │ WebSocket (Socket.io)
                               ▼
┌─────────────────── FRONTEND (React 18 + Vite) ───────────────────────────┐
│  CesiumJS 1.115 + Resium 1.17 (React bindings)                            │
│  ├── AircraftLayer — billboards SVG + trails PolylineGlow (40 pts)        │
│  ├── ShipLayer — billboards SVG orientados por heading                     │
│  ├── ConflictLayer — símbolos militares canvas (sin emoji)                 │
│  ├── NewsLayer — clusters geoespaciales + geocodificación por headline     │
│  ├── DangerZoneLayer — círculos de zona de conflicto                       │
│  ├── MilitaryBasesLayer — bases militares mundiales                        │
│  ├── FilterPanel — toggles, país, misión, alianza                          │
│  ├── AlertPanel — amenazas detectadas + insight IA                         │
│  ├── Timeline — replay histórico (controles de vídeo integrados)           │
│  └── CoordinateHUD — barra inferior lat/lon + contadores                  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. STACK TECNOLÓGICO

### Backend

| Componente | Tecnología | Versión |
|---|---|---|
| Runtime | Node.js | 20+ |
| Framework HTTP | Express | 4.x |
| WebSocket | Socket.io | 4.x |
| Compresión | compression (gzip) | – |
| Rate limiting | express-rate-limit | – |
| Variables de entorno | dotenv | – |
| Caché en disco | JSON nativo (`fs.readFile/writeFile`) | – |

### Frontend

| Componente | Tecnología | Versión |
|---|---|---|
| UI framework | React | 18.x |
| Build tool | Vite | 5.x |
| 3D Globe engine | CesiumJS + Resium | 1.115 / 1.17 |
| Estilos | Tailwind CSS | 3.x |
| WebSocket client | socket.io-client | 4.x |
| Empaquetado Cesium | vite-plugin-cesium | – |

### Infraestructura

| Entorno | Plataforma | Coste |
|---|---|---|
| Backend | Railway (auto-deploy desde GitHub) | Gratuito (tier Hobby) |
| Frontend | Vercel (auto-deploy desde GitHub) | Gratuito |
| DNS / CDN | Vercel Edge Network | Gratuito |

---

## 3. FUENTES DE DATOS

### 3.1 Aeronaves militares — ADS-B

Los transponders ADS-B emiten en 1090 MHz. Redes civiles de receptores en tierra capturan y publican estos datos.

| Fuente | Endpoint | Intervalo | Método |
|---|---|---|---|
| **adsb.lol** (primario) | `api.adsb.lol/v2/mil` | 30s | REST JSON |
| **adsb.fi** (fallback 1) | `opendata.adsb.fi/api/v2/mil` | 30s | REST JSON |
| **airplanes.live** (fallback 2) | `api.airplanes.live/v2/mil` | 30s | REST JSON |

Campos utilizados por aeronave: `icao`, `callsign`, `lat`, `lon`, `altitudeFt`, `speed`, `heading`, `ownOp`, `reg`, `type`, `on_ground`.

La cadena de fallback garantiza disponibilidad: si la fuente primaria falla, se intenta la siguiente. Si todas fallan se sirven datos del disco cache.

**Limitación importante:** Las aeronaves militares pueden desactivar el transponder durante operaciones. La ausencia en el mapa no implica que el aparato no esté volando.

### 3.2 Buques de guerra — AIS

| Fuente | Método | Intervalo |
|---|---|---|
| **VesselFinder** scraper | HTML parsing (`/vessels.get_list`) | 60s |

Los buques con flag militar son identificados mediante lista MMSI curada (`backend/services/militaryMMSI.js`).

### 3.3 Eventos de conflicto

Los eventos se acumulan en un store en memoria (`Map` por ID) con TTL de 72 horas. Nunca se reemplazan (solo se añaden nuevos). Los IDs son estables basados en hash de título+fecha para evitar duplicados entre polls.

| Fuente | Tipo | Intervalo |
|---|---|---|
| **GDELT GEO 2.0** (`api.gdeltproject.org/api/v2/geo`) | Geolocated events | 10min |
| **GDELT DOC 2.0** (`api.gdeltproject.org/api/v2/doc`) | News articles | 5min |
| **Dataset semilla interno** | 90+ eventos históricos baseline | Estáticos (en código) |

Tipos de evento: `AIRSTRIKE`, `MISSILE`, `EXPLOSION`, `ARTILLERY`, `DRONE`, `NAVAL`, `TROOPS`, `CONFLICT`.  
Severidades: `CRITICAL` (rojo) → `HIGH` (naranja) → `MEDIUM` (ámbar) → `LOW` (amarillo).

### 3.4 Noticias con geocodificación

- Fuente: GDELT DOC API (gratuita, sin clave)
- Geocodificación: lookup de keywords en headline/descripción contra tabla de ~70 ubicaciones de conflicto activo (Ucrania, Gaza, Taiwán, Mar Rojo, etc.)
- Los pins se colocan con jitter aleatorio de ±0.15° para evitar solapamiento en la misma ciudad
- Clusters automáticos por zoom: cuanto más lejos, más agrupados

### 3.5 Anomalías térmicas (NASA FIRMS)

- Fuente: `firms.modaps.eosdis.nasa.gov/api/area/csv`
- Requiere `FIRMS_MAP_KEY` (gratuita, registro en NASA Earthdata)
- Resolución: 375m (VIIRS) y 1km (MODIS)
- Uso: detectar incendios activos y hotspots térmicos (posibles ataques con armas de energía, plantas alcanzadas, etc.)
- Filtro por `minFRP` (Fire Radiative Power) calibrado por zona: más exigente en Europa, más permisivo en zonas de combate activo

---

## 4. MODELO DE DATOS

### Aeronave (normalizado desde ADS-B)
```json
{
  "id": "AE1234",
  "callsign": "TOPCAT11",
  "lat": 35.89,
  "lon": 44.39,
  "altitudeFt": 28500,
  "speed": 485,
  "heading": 267,
  "type": "F-16",
  "reg": "92-3913",
  "ownOp": "USAF",
  "country": "US",
  "on_ground": false,
  "firstSeen": "2026-03-05T10:22:00Z"
}
```

### Buque de guerra
```json
{
  "mmsi": "338123456",
  "name": "USS CARL VINSON",
  "lat": 22.4,
  "lon": 115.8,
  "heading": 180,
  "speed": 14,
  "flag": "US",
  "type": "Aircraft Carrier"
}
```

### Evento de conflicto
```json
{
  "id": "gdelt-doc-20260305-ukraine-missile-strike",
  "title": "Ukraine Missile Strike on Zaporizhzhia",
  "lat": 47.84,
  "lon": 35.14,
  "type": "MISSILE",
  "severity": "HIGH",
  "source": "GDELT",
  "firstSeenAt": "2026-03-05T09:15:00Z",
  "url": "https://..."
}
```

### Snapshot histórico (position tracker)
```json
{
  "ts": "2026-03-05T10:00:00Z",
  "aircraft": [ /* array de aeronaves en ese instante */ ],
  "ships": [ /* array de buques en ese instante */ ]
}
```
El backend mantiene un ring buffer de 120 snapshots (1 por 30s = ~1 hora de historial).

---

## 5. PIPELINE DE DATOS FRONTEND

```
Socket.io event ──► useRealTimeData hook ──► App.jsx state
                                                 │
                              ┌──────────────────┼──────────────────┐
                              ▼                  ▼                  ▼
                       filterAircraft      filterShips         filterNews
                       (militaryFilter)    (militaryFilter)    (militaryFilter)
                              │                  │                  │
                              ▼                  ▼                  ▼
                       AircraftLayer       ShipLayer          NewsLayer
                       (dsCache ref O(1))  (dsCache ref O(1)) (cluster+geocode)
                              │
                              ▼
                       CesiumJS CustomDataSource
                       (billboard + trail entities)
```

**Optimizaciones clave:**
- Hash de cambios: solo se re-emite el socket cuando los datos cambian (`hashArr` incluye id, lat, lon, heading, altitude)
- `dsCache` ref O(1): las capas buscan el DataSource en un `useRef({})` en lugar de un scan O(n) de `viewer.dataSources`
- Una sola `useEffect` de render por capa: elimina race conditions entre el efecto de visibilidad y el de datos
- Un único `ScreenSpaceEventHandler` en `Globe3D` — no hay handlers por capa (§0.18)
- `useMemo` por capa con deps específicas: un cambio de filtro de una capa no re-renderiza las otras

---

## 6. MOTOR DE ALERTAS IA

### 6.1 Reglas locales (sin API externa)

`aiDanger.js` evalúa en cada poll:

1. **Proximidad aeronave–zona de conflicto** (`< 200 km`): alerta con entidad referenciada
2. **Proximidad buque–zona de conflicto** (`< 300 km`): ídem
3. **Evento de alta severidad reciente** (`< 30 min`): push a AlertPanel
4. **Alertas desde noticias**: keywords peligrosos en headlines geocodificados

### 6.2 Análisis Gemini (opcional)

Si `GEMINI_API_KEY` está configurada, periódicamente se envía un resumen de la situación al modelo Gemini 1.5 Flash. El modelo devuelve un insight táctico en formato JSON (`{ summary, threats[], recommendation }`). Se muestra en el AlertPanel como "AI INTEL".

---

## 7. SISTEMA DE REPLAY HISTÓRICO

El `positionTracker.js` guarda un snapshot del estado del globo cada 30 segundos en un ring buffer de 120 posiciones. El frontend puede:

- Solicitar el historial vía socket (`request_history` / `history_data`)
- Navegar por los snapshots con los controles de vídeo integrados en la barra inferior
- Reproducir a 1×, 5×, 20×, 60× o 120× velocidad real
- Hacer scrubbing manual en la barra de progreso
- Ver trails históricos de cada aeronave/buque hasta el frame actual

Durante el replay, `effectiveAircraft` y `effectiveShips` en App.jsx apuntan a los datos del snapshot en vez de los datos en directo. Al pulsar STOP regresa automáticamente al modo live.

---

## 8. DEPLOYMENT

### 8.1 Backend — Railway

```
Repositorio: github.com/Adritrader/miltracker-3d
Branch: main
Root: /backend
Build: npm install
Start: node server.js
Port: 3001 (auto-detectado por Railway via PORT env var)
```

**Variables de entorno necesarias en Railway:**
| Variable | Valor | Notas |
|---|---|---|
| `NODE_ENV` | `production` | Activa CORS restrictivo |
| `FIRMS_MAP_KEY` | `<tu clave>` | Firma en NASA Earthdata |
| `GEMINI_API_KEY` | `<tu clave>` | Opcional, IA |
| `ALLOWED_ORIGIN` | `https://tu-dominio.vercel.app` | Opcional, origen extra permitido |

### 8.2 Frontend — Vercel

```
Repositorio: mismo
Root: /frontend
Framework preset: Vite
Build: npm run build
Output: dist/
```

**Variables de entorno en Vercel:**
| Variable | Valor |
|---|---|
| `VITE_BACKEND_URL` | `https://tu-backend.railway.app` |
| `VITE_CESIUM_ION_TOKEN` | Opcional (mejora tiles base) |

---

## 9. SEGURIDAD

| Mecanismo | Descripción |
|---|---|
| **CORS allowlist** | Solo orígenes `localhost/*`, `*.vercel.app`, `*.railway.app`, `*.onrender.com` y `ALLOWED_ORIGIN` env. Bloquea cualquier otro origen en `NODE_ENV=production` |
| **Rate limiting** | 60 req/min por IP en endpoints REST (`/api/*`) vía `express-rate-limit` |
| **Sin datos sensibles** | Solo datos públicos de radiofrecuencia (ADS-B/AIS). Sin tokens de usuario, sin autenticación |
| **Compresión** | gzip en todas las respuestas HTTP (`compression` middleware) |
| **No SQL injection** | Sin base de datos. Todo en memoria + JSON en disco |

---

## 10. CAPAS DE VISUALIZACIÓN 3D

| Capa | Tecnología | Notas |
|---|---|---|
| Aeronaves | `Cesium.BillboardCollection` vía `CustomDataSource` | Iconos SVG orientados por heading, trails `PolylineGlow` |
| Buques | `Cesium.BillboardCollection` | Iconos SVG top-down, heading real |
| Eventos conflicto | `Cesium.BillboardCollection` | Símbolos militares dibujados en Canvas (sin emoji) |
| Noticias | `Cesium.BillboardCollection` | Clustering geoespacial automático por zoom bucket |
| Zonas de peligro | `Cesium.PolygonGraphics` | Por-entidad `.show = false` (ds.show solo dimea polígonos alpha bajo) |
| Bases militares | `Cesium.BillboardCollection` + `Cesium.LabelGraphics` | `disableDepthTestDistance: 2e6` |
| Anomalías FIRMS | `Cesium.PointGraphics` | Color por FRP (amarillo→rojo) |

**Basemaps disponibles:** CartoDB Dark (por defecto), CartoDB Light, CartoDB Night, OpenStreetMap, OpenTopoMap, ESRI World Imagery (satélite)

---

## 11. RENDIMIENTO (MÉTRICAS ESTIMADAS)

| Métrica | Valor |
|---|---|
| Aeronaves en pantalla simultáneas | 100–300 |
| Frecuencia de actualización (live) | 30s |
| Uso de memoria (frontend, ~200 entidades) | ~180 MB |
| Tamaño del bundle frontend (gzip) | ~8 MB (Cesium domina) |
| Tiempo de primera carga (cold) | ~3–5s (tiles + bundle) |
| Tiempo de carga con cache caliente | < 1s (datos pre-cacheados en disco) |
| Framerate globe (60Hz monitor) | 55–60 fps (Chrome/Edge) |
| Latencia socket backend→frontend | < 50ms (Railway EU) |

---

## 12. COBERTURA GEOPOLÍTICA

Zonas de conflicto cubiertas activamente por el dataset semilla y geocodificación automática:

| Región | Eventos monitorizados |
|---|---|
| **Ucrania/Rusia** | Artillería, misiles balísticos, enjambres de drones, crucero |
| **Israel/Gaza/Líbano** | Airstrikes IDF, cohetes Hamas/Hezbollah, actividad IRGC |
| **Yemen/Mar Rojo** | Misiles antibuque Houthis, airstrikes coalición |
| **Irak/Siria** | Atacan bases EEUU, drones PMF-IRGC, airstrikes israelíes |
| **Irán** | Pruebas misilísticas, actividad IRGC en Ormuz |
| **Estrecho de Taiwán** | Ejercicios PLAN, cruce línea media PLAAF |
| **Mar de China Meridional** | Incidentes navales, ejercicios anfibios |
| **Sahel** | Wagner/Rusia, ataques yihadistas Mali/Burkina/Níger |
| **Ártico** | Patrullas OTAN/Rusia, actividad submarina |

---

## 13. LIMITACIONES CONOCIDAS Y TRABAJO FUTURO

### Limitaciones actuales
1. **Buques sin transponder**: Los buques de guerra suelen desactivar AIS en operaciones activas
2. **Aviones sin transponder**: Algunos aparatos militares sensibles no emiten ADS-B (B-2, F-22 en misión, etc.)
3. **GDELT latencia**: Los eventos de conflicto tienen 10–30 min de lag respecto a ocurrencia real
4. **Geocodificación básica**: Las noticias se geoposicionan por keywords, no por NLP ni geocodificador real
5. **Sin autenticación**: La app es pública ya que solo usa datos públicos
6. **Ring buffer limitado**: 120 frames × 30s = ~60 min de historial

### Roadmap a corto plazo
- [ ] Imágenes satelitales de hotspots: Sentinel-2 (Copernicus) + NASA GIBS como overlays en Cesium
- [ ] Notificaciones push del navegador cuando ocurre evento CRITICAL
- [ ] Filtro temporal en ConflictLayer ("últimas 2h / 24h / 72h")
- [ ] Exportar snapshot actual como imagen (globo + datos)
- [ ] Integración Telegram bot para alertas críticas

---

## 14. IMÁGENES SATELITALES — ANÁLISIS DE OPCIONES

> Este apartado responde a la pregunta: ¿podemos mostrar imágenes satelitales de infraestructuras militares, puntos calientes, o áreas de conflicto?

### Lo que SÍ es técnicamente posible (e integrable)

| Fuente | Resolución | Cobertura temporal | Autenticación | Coste | Qué muestra |
|---|---|---|---|---|---|
| **NASA GIBS / Worldview** (MODIS, VIIRS) | 250m–1km | Diaria (1-2 días de lag) | Ninguna | Gratis | True-color, vapor de agua, índice de incendios |
| **Sentinel-2** (ESA Copernicus) | 10–60m | 5 días (por zona) | Cuenta gratuita ESA | Gratis | Optical multibanda, ideal para daños estructurales |
| **Sentinel-1 SAR** | 5–20m | ~6 días | Cuenta gratuita ESA | Gratis | Radar (ve de noche y nublado), detecta barcos, vehículos, cambios de suelo |
| **ESRI World Imagery** | 30cm–15m (variable) | Estático (actualización periódica) | Ninguna | Gratis | Fotografía aérea/satelital de alta resolución |
| **Mapbox Satellite** | ~50cm en ciudades | Actualización periódica | API key gratuita (50k req/mo) | Gratis (tier) | Mosaico de alta resolución |
| **Copernicus Browser tiles** | 10m (Sentinel-2) | Reciente | OAuth2 gratuito | Gratis | True-color y otras bandas |

### Lo que NO es posible (o está restringido)

- **Imagery clasificada de reconocimiento militar** (NRO, NSA): solo acceso gubernamental, resolución sub-10cm
- **Imagery comercial de pago** (Planet Labs, Maxar): ~1€–10€/km² por imagen reciente. Sí muestra tanques, vehículos, infraestructura militar con resolución 30–50cm
- **Instalaciones deliberadamente ocultadas**: Google, Bing y Apple tienen acuerdos con gobiernos para bloquear o degradar imagery de instalaciones sensibles (reactores nucleares, AREA 51, etc.)
- **SAR en tiempo real**: los datos RAW de Copernicus tienen 1-3 días de latencia como mínimo en el tier gratuito

### Plan de implementación propuesto

La integración más inmediata (cero coste, cero claves):

1. **NASA GIBS como overlay de Cesium** — añadir capa "MODIS Truecolor (Diario)" en el MapLayerSwitcher. Muestra imagery óptica con 1-2 días de lag refrescada por cuadro/tile.

2. **Sentinel-2 via EOX tiles** (`tiles.maps.eox.at`) — disponible sin clave para usos no comerciales, resolución ~10m, actualización cada ~5 días.

3. **Overlay activable sobre zonas calientes** — al hacer click en una zona de conflicto, abrir una miniatura Sentinel Hub Browser de la zona en el panel de entidad.

> La integración de estas capas ya está en progreso (ver `MapLayerSwitcher.jsx`). Las tiles de NASA GIBS se pueden añadir directamente como `Cesium.WebMapTileServiceImageryProvider` sin ningún login.

---

## APÉNDICE — DECISIONES DE DISEÑO CLAVE

| Decisión | Alternativa considerada | Razón de la elección |
|---|---|---|
| CesiumJS en lugar de MapboxGL / Leaflet | Mapbox, Deck.gl | CesiumJS nativo 3D globe, altitud real de vuelo visualizable, terrain providers, built-in WMTS |
| CustomDataSource por capa (no primitive collections) | Primitive Collections | Integración más simple con React/Resium, suficiente performance para 300 entidades |
| Socket.io en lugar de polling REST | Fetch polling | Delta push: solo emite cuando los datos cambian (hash), elimina 90% del tráfico innecesario |
| Cache en disco JSON, sin base de datos | PostgreSQL, MongoDB | Zero-dependency, arranca al instante, no requiere infraestructura adicional |
| Un solo ScreenSpaceEventHandler en Globe3D | Handler por capa | Un único pick() por click, evita disparar 4-5 handlers en secuencia |
| React 18 + Vite en lugar de Next.js | Next.js | CesiumJS no está optimizado para SSR; cliente 100% puro es más simple y performante |
| GDELT gratuito en lugar de fuentes de pago | Bellingcat, Janes.com | Cero coste operativo, actualización cada 15 min, cobertura global |

---

*Documento generado el 5 de marzo de 2026. Para comentarios técnicos ver `STATUS.md` y `ROADMAP.md` en la raíz del repositorio.*
