# MILTRACKER 3D — Documento Técnico, Ejecutivo y de Negocio

> **Versión 3.0** · 10 de marzo de 2026  
> Estado de producción: **LIVE** — Railway (backend) + Vercel (frontend)  
> Repositorio: `github.com/Adritrader/miltracker-3d`  
> Dominio: `livewar3d.com`

---

# PARTE I — RESUMEN EJECUTIVO

---

## EXECUTIVE SUMMARY

**MilTracker 3D** es una plataforma de inteligencia de situación militar (ISR) en tiempo real que visualiza aeronaves militares, buques de guerra, eventos de conflicto activo, alertas con IA, anomalías térmicas (NASA FIRMS) y noticias geoespaciales sobre un globo 3D interactivo. Agrega y correlaciona datos de **35+ fuentes públicas** actualizando cada 30 segundos la actividad militar mundial.

### Datos clave del producto

| Métrica | Valor |
|---|---|
| **Entidades vivas simultáneas** | 100–400 (aeronaves + buques + conflictos + noticias) |
| **Fuentes de datos integradas** | 35+ (3 ADS-B + 6 regionales + 5 AIS + 25 RSS + GDELT + FIRMS + Gemini) |
| **Zonas de conflicto monitorizadas** | 14 regiones activas |
| **Catálogo MMSI naval** | 154 buques de guerra identificados |
| **Aeródromos militares** | 104 bases con nombre resuelto |
| **Países identificables por ICAO hex** | 27 naciones |
| **Tipos de aeronave con nombre** | 56 designaciones |
| **Patrones de trayectoria reconocidos** | 8 (ORBIT, RACETRACK, LINEAR, LOITER, DESCENT, CLIMB, ERRATIC, UNKNOWN) |
| **Inferencia de misión automatizada** | 40+ combinaciones patrón × categoría |
| **Motor de credibilidad** | 0–95 % con 5 factores de corroboración |
| **Hotspots geoespaciales** | Grid 3°×3° (~330 km), top 8 por densidad |
| **Persistencia de trayectorias** | IndexedDB, TTL 24 h, flush en `beforeunload` |
| **Replay histórico** | 120 snapshots × 30 s = 1 h, velocidades 1×–120× |
| **Coste operativo** | **~0–5 USD/mes** |

### Diferenciación competitiva

| | MilTracker 3D | Flightradar24 / MarineTraffic | Global Conflict Tracker (CFR) | LiveUAMap |
|---|---|---|---|---|
| **Foco** | Exclusivamente militar/defensa | Civil + militar mezclado | Texto estático | Mapas 2D básicos |
| **Correlación multicapa** | Aeronaves + Buques + Conflictos + Noticias + FIRMS + IA | Datos en silos | Sin datos live | Sin ADS-B/AIS |
| **Globo 3D** | CesiumJS, altitud real, rotación libre | Vista 2D | Sin mapa interactivo | 2D Leaflet |
| **Inteligencia de trayectoria** | Detección de patrones + inferencia de misión automática | Sin análisis | N/A | N/A |
| **IA de amenazas** | Proximidad + credibilidad multifuente + Gemini | Sin IA de alerta | Sin IA | Sin IA |
| **Hotspots** | Clustering geoespacial + FIRMS + corroboración cruzada | N/A | N/A | Manual |
| **Replay histórico** | 1 h navegable con controles de vídeo | Parcial (pago) | Sin replay | Sin replay |
| **SITREP** | Captura PNG + vídeo cinético + share social | Sin captura | Sin captura | Sin captura |
| **Coste operativo** | ~0–5 USD/mes | Miles USD/mes | — | — |

---

# PARTE II — ARQUITECTURA TÉCNICA

---

## 1. ARQUITECTURA GENERAL

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        FUENTES DE DATOS (gratuitas / públicas)                │
│                                                                               │
│  ADS-B (3 globales + 6 regionales)  │  AIS 5-tier (WebSocket + REST + RSS)   │
│  GDELT GEO + DOC  │  25 RSS militares  │  NASA FIRMS  │  Gemini 1.5 Flash   │
└──────────────────────────┬───────────────────────────────────────────────────┘
                           │ HTTP polling (30s / 60s / 5–10 min)
                           ▼
┌──────────────────── BACKEND (Node.js 20+ · Express · Socket.io) ─────────────┐
│                                                                                │
│  12 servicios independientes:                                                  │
│  ├── opensky.js ........... ADS-B fallback chain (3) + regional fetches (6)   │
│  ├── vesselFinder.js ...... AIS 5-tier: WS→REST→Norwegian→AISHub→Catalog      │
│  ├── conflictService.js ... GDELT GEO/DOC + seed dataset (72h TTL, dedup)     │
│  ├── newsService.js ....... 25 RSS feeds militares + GDELT DOC (5 min)        │
│  ├── firmsService.js ...... NASA FIRMS VIIRS/MODIS (10 min)                   │
│  ├── aiDanger.js .......... 14 zonas conflicto + reglas proximidad + Gemini   │
│  │                          + motor credibilidad (0–95%) + hotspots grid       │
│  ├── positionTracker.js ... Ring buffer 120 snapshots, disk persist 5 min     │
│  ├── militaryMMSI.js ...... Catálogo 154 buques de guerra por MMSI            │
│  ├── carrierAirWing.js .... 46 callsign prefixes → detección operaciones CVW  │
│  ├── diskCache.js ......... Cache async JSON (non-blocking, warmstart)        │
│  ├── cameraService.js ..... Cámaras en vivo en zonas de conflicto             │
│  └── twitterService.js .... Auto-tweet para alertas CRITICAL                  │
│                                                                                │
│  Middleware: CORS (allowlist), rate-limit 30 req/min, compression (gzip)      │
│  WebSocket: Socket.io con hash-diff (solo deltas), cooldowns 5s/10s           │
└──────────────────────────┬───────────────────────────────────────────────────┘
                           │ WebSocket (Socket.io — delta only)
                           ▼
┌──────────────────── FRONTEND (React 18 · Vite 5 · CesiumJS 1.115) ──────────┐
│                                                                                │
│  26 componentes · 4 hooks · 6 módulos de utilidad                             │
│                                                                                │
│  CAPAS DE DATOS (8):                                                          │
│  ├── AircraftLayer ........ Billboards SVG + trails altitud-gradient (40 pts) │
│  │                          + inferencia misión + persistencia IndexedDB       │
│  ├── ShipLayer ............ Billboards SVG por heading + trails + IndexedDB   │
│  ├── ConflictLayer ........ Símbolos militares Canvas, 15 tipos de evento     │
│  ├── NewsLayer ............ Clusters geoespaciales zoom-aware                 │
│  ├── DangerZoneLayer ...... Perímetros de zona de conflicto color-coded       │
│  ├── MilitaryBasesLayer ... ~200 bases militares mundiales (4 tipos)          │
│  ├── FIRMSLayer ........... Hotspots térmicos NASA (VIIRS + MODIS)           │
│  └── SentinelPortalModal .. Sentinels de monitoreo                            │
│                                                                                │
│  PANELES DE CONTROL (12):                                                     │
│  ├── FilterPanel .......... Toggles, país, misión, alianza, FIRMS             │
│  ├── MapLegend ............ Leyenda 3 tabs (GENERAL / EVENTS / COUNTRIES)     │
│  ├── AlertPanel ........... Alertas + Hotspots + SITREP + AI Intel tabs       │
│  ├── TrackingPanel ........ Seguimiento multi-entidad aeronaves + barcos      │
│  ├── TimelinePanel ........ Replay histórico 1h, controles tipo vídeo         │
│  ├── NewsPanel ............ Panel detalle noticias                             │
│  ├── NewsClusterModal ..... Modal agrupación de noticias geoespacial          │
│  ├── EntityPopup .......... Popup con inteligencia de trayectoria + ruta      │
│  ├── SearchBar ............ Búsqueda global callsign/nombre/tipo              │
│  ├── CoordinateHUD ........ HUD lat/lon + contadores live                     │
│  ├── SitrepCapture ........ Captura PNG + vídeo cinético MP4/WebM             │
│  └── MapLayerSwitcher ..... Selector de 7 basemaps                            │
│                                                                                │
│  UTILIDADES (6):                                                              │
│  ├── militaryFilter.js .... 27 países ICAO + 104 aeródromos + 56 tipos       │
│  ├── trajectoryAnalysis.js  8 patrones + 8 categorías + inferencia misión     │
│  ├── trailStore.js ........ IndexedDB persistencia trails (TTL 24h)           │
│  ├── geoUtils.js .......... Haversine, bearing, helpers geoespaciales         │
│  ├── icons.js ............. Generadores SVG inline para billboards             │
│  └── mediaLookup.js ....... ~400 imágenes Wikimedia por tipo entidad          │
│                                                                                │
│  HOOKS (4):                                                                   │
│  ├── useRealTimeData ...... Socket.io + caching localStorage + reconnect      │
│  ├── useTimeline .......... Control replay 1×–120×, scrubbing, play/pause     │
│  ├── useIsMobile .......... Detección responsive (< 768px)                    │
│  └── useCesiumEntities .... Gestión DataSource lifecycle Cesium               │
│                                                                                │
│  PERSISTENCIA CLIENT-SIDE:                                                    │
│  ├── localStorage ......... Aeronaves (30min), Buques (60min), Noticias (2h)  │
│  ├── IndexedDB ............ Trayectorias aeronaves + buques (TTL 24h)         │
│  └── sessionStorage ....... Estado de filtros y preferencias UI               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. STACK TECNOLÓGICO

### Backend

| Componente | Tecnología | Versión |
|---|---|---|
| Runtime | Node.js | 20+ |
| Framework HTTP | Express | 4.18.3 |
| WebSocket | Socket.io | 4.7.5 |
| AIS WebSocket | ws | 8.19.0 |
| HTTP client | node-fetch | 3.3.2 |
| XML → JSON | xml2js | 0.6.2 |
| Twitter API | twitter-api-v2 | 1.29.0 |
| Compresión | compression (gzip) | — |
| Rate limiting | express-rate-limit | — |
| Variables de entorno | dotenv | — |
| Caché en disco | JSON nativo (`fs/promises`) | — |

### Frontend

| Componente | Tecnología | Versión |
|---|---|---|
| UI framework | React | 18.3.1 |
| Build tool | Vite | 5.3.5 |
| Globe engine 3D | CesiumJS | 1.115.0 |
| Cesium–React bridge | Resium | 1.17.3 |
| Estilos | Tailwind CSS | 3.4.7 |
| WebSocket client | socket.io-client | 4.x |
| Captura vídeo | html2canvas + MediaRecorder API | — |
| Persistencia trails | IndexedDB (nativo) | — |

### Infraestructura

| Entorno | Plataforma | Coste mensual actual |
|---|---|---|
| Backend | Railway (auto-deploy desde GitHub) | 0–5 USD (tier Hobby) |
| Frontend | Vercel (auto-deploy desde GitHub) | 0 USD |
| DNS / CDN | Vercel Edge Network | 0 USD |
| **TOTAL** | | **~0–5 USD/mes** |

---

## 3. FUENTES DE DATOS

### 3.1 Aeronaves militares — ADS-B

**Cadena de fallback global (3 fuentes):**

| Fuente | Endpoint | Intervalo | Método |
|---|---|---|---|
| **adsb.lol** (primario) | `api.adsb.lol/v2/mil` | 30 s | REST JSON |
| **adsb.fi** (fallback 1) | `opendata.adsb.fi/api/v2/mil` | 30 s | REST JSON |
| **airplanes.live** (fallback 2) | `api.airplanes.live/v2/mil` | 30 s | REST JSON |

**Fetches regionales paralelos (6 zonas):**

Además del fetch global, el backend ejecuta 6 queries regionales en paralelo para mejorar la cobertura en zonas de conflicto activo. Si la fuente primaria ya contiene las aeronaves, los duplicados se descartan por ICAO hex.

Cadena de fallback automática. Si todas fallan, se sirven datos del disco cache.  
**Limitación:** Los aparatos pueden desactivar transponder en operaciones sensibles.

### 3.2 Buques de guerra — AIS (5 tiers)

| Tier | Fuente | Método | Notas |
|---|---|---|---|
| 1 | **AISStream** (MMSI targeted) | WebSocket | 154 MMSI del catálogo, tiempo real |
| 2 | **AISStream REST** | HTTP global | Complemento global |
| 3 | **Norwegian Coastal Admin** | REST | Cobertura Ártico / Noruega |
| 4 | **AISHub** | REST | Red comunitaria |
| 5 | **Catálogo baseline** | Estático | Posiciones homeport si todo falla |

Identificación militar por lista MMSI curada (`militaryMMSI.js` — **154 buques catalogados**):

| Armada | Buques | Incluye |
|---|---|---|
| US Navy | 36 | 8 portaaviones, 10 destructores/cruceros, 5 LHD, 8 logística |
| Royal Navy | 10 | Carriers, Type 45, frigates |
| Marine Nationale | 7 | Charles de Gaulle, FREMM |
| Deutsche Marine | 5 | F124, F125 |
| Altre NATO (NL, IT, ES, DK, NO, SE) | 21 | Frigatas, OPV |
| Россия ВМФ | 9 | Kuznetsov, Kirov, Slava |
| PLAN (China) | 8 | Carriers, Type 055 |
| Irán (IRIN/IRGCN) | 5 | Moudge, Jamaran |
| Israel (INS) | 4 | Sa'ar 6, Dolphin subs |
| Turquía (TCG) | 5 | TF-2000, ADA class |
| Otras (GR, JP, KR, IN, AU, CA) | 44 | Commonwealth + aliados Pacific |

### 3.3 Eventos de conflicto

Store en memoria (Map por ID, TTL 72 h, sin duplicados por hash título+fecha).

| Fuente | Tipo | Intervalo |
|---|---|---|
| GDELT GEO 2.0 | Eventos geolocalizados | 10 min |
| GDELT DOC 2.0 | Artículos noticias | 5 min |
| Dataset semilla interno | 90+ eventos baseline | Estáticos |

**Clasificación automática** en 15 tipos de evento: `airstrike`, `missile`, `explosion`, `artillery`, `drone`, `naval`, `troops`, `casualties`, `fire`, `cyber`, `cbrn`, `collapse`, `siege`, `infrastructure`, `hostage`.

### 3.4 Noticias militares — 25 RSS feeds

BBC World/Middle East/Europe, Al Jazeera, USNI News, Breaking Defense, The War Zone, Kyiv Independent, Defense News, Times of Israel, Jerusalem Post, Iran International, Middle East Eye, War on the Rocks, Reuters, Al-Monitor, i24, Atlantic Council, Military Times, Task & Purpose, Stars & Stripes, The Guardian, Foreign Policy, Bellingcat, Sky News, CBS News, SOFREP/ISW.

### 3.5 Anomalías térmicas (NASA FIRMS)

- Clave gratuita: `FIRMS_MAP_KEY` (NASA Earthdata)
- Resolución VIIRS 375 m / MODIS 1 km
- Intervalo: 10 min
- Filtro por Fire Radiative Power calibrado por región

### 3.6 IA Generativa — Google Gemini

- Modelo: Gemini 1.5 Flash (gratuito hasta 1 M tokens/día)
- Input: resumen táctico (aeronaves + buques + conflictos cercanos)
- Output: JSON `{ summary, threats[], recommendations[] }`
- Cooldown configurable para evitar quemar cuota

---

## 4. FUNCIONALIDADES PRINCIPALES

### 4.1 Tabla de estado (marzo 2026)

| # | Funcionalidad | Estado | Notas |
|---|---|---|---|
| 1 | Globo 3D interactivo (CesiumJS) | ✅ Live | 7 basemaps: Dark, Satellite, Sentinel, GIBS, Relief, Street, Light |
| 2 | Aeronaves militares en tiempo real | ✅ Live | ADS-B 3+6 fuentes, hasta 300 entidades, trails 40 pts |
| 3 | Buques de guerra en tiempo real | ✅ Live | AIS 5-tier, heading real, 154 MMSI catalogados |
| 4 | Eventos de conflicto geolocalizados | ✅ Live | GDELT + seed, 72 h TTL, 15 tipos de evento, dedup 9 km |
| 5 | Noticias militares geocodificadas | ✅ Live | 25 RSS + GDELT DOC, clusters zoom-aware |
| 6 | Zonas de peligro (DangerZones) | ✅ Live | 14 zonas activas, perímetros color-coded |
| 7 | Bases militares mundiales | ✅ Live | ~200 bases, 4 tipos (AB/NB/MS/RD) |
| 8 | NASA FIRMS (hotspots térmicos) | ✅ Live | VIIRS + MODIS, FRP filtrado por región |
| 9 | **Motor de alertas IA** | ✅ Live | Proximidad + credibilidad multifuente (0–95 %) |
| 10 | **Hotspots dashboard** | ✅ Live | Grid 3°×3°, top 8 clusters, mín. 3 eventos |
| 11 | **Credibilidad cruzada** | ✅ Live | 5 factores: zona, corroboración, FIRMS, aeronaves, buques |
| 12 | SITREP automático | ✅ Live | Resumen táctico generado de datos live |
| 13 | AI Intel (Gemini 1.5 Flash) | ✅ Live | Opcional vía GEMINI_API_KEY |
| 14 | Replay histórico | ✅ Live | 120 snapshots × 30 s = 1 h, velocidades 1×–120× |
| 15 | Tracking multi-entidad | ✅ Live | Seguimiento simultáneo aeronaves + buques |
| 16 | Filtros avanzados | ✅ Live | País, alianza, tipo misión, FIRMS, severidad |
| 17 | SITREP Capture | ✅ Live | PNG + vídeo cinético MP4/WebM, social share |
| 18 | Share de vista | ✅ Live | URL `?fly=` con parámetros de cámara |
| 19 | Notificaciones push | ✅ Live | Browser push para alertas CRITICAL |
| 20 | **Inteligencia de trayectoria** | ✅ Live | 8 patrones × 8 categorías → inferencia misión |
| 21 | **Trails con gradiente altitud** | ✅ Live | Cyan → Verde → Amarillo → Naranja → Rojo |
| 22 | **Persistencia IndexedDB** | ✅ Live | Trails aeronaves + buques, TTL 24 h |
| 23 | **Resolución aeródromos** | ✅ Live | 104 bases militares con nombre resuelto |
| 24 | **Identificación ICAO hex** | ✅ Live | 27 países por prefijo hexadecimal |
| 25 | **Detección Carrier Air Wing** | ✅ Live | 46 prefijos callsign → CVW + portaaviones |
| 26 | **Leyenda de mapa interactiva** | ✅ Live | 3 tabs: GENERAL / EVENTS / COUNTRIES |
| 27 | Búsqueda de entidades | ✅ Live | Por callsign, nombre, tipo (busca en datos completos) |
| 28 | Rate limiting WebSocket | ✅ Live | Cooldown por socket: 5 s datos, 10 s historial |
| 29 | Cache persistente async | ✅ Live | Escritura no bloqueante, arranque desde cache |
| 30 | **Optimización mobile** | ✅ Live | Layout responsive, paneles adaptados |

### 4.2 Detalle: Inteligencia de Trayectoria

**Módulo:** `trajectoryAnalysis.js`

Motor de análisis geométrico que detecta patrones de vuelo a partir de las coordenadas del trail y clasifica automáticamente la misión probable de cada aeronave.

**8 patrones reconocidos:**

| Patrón | Detección | Significado táctico |
|---|---|---|
| `ORBIT` | ≥ 1 rotación 360°, compactness alto | Vigilancia, reabastecimiento, CAP |
| `RACETRACK` | Óvalo elongado (turn bias > 0.6) | Patrulla AWACS, SIGINT, refueling |
| `LINEAR` | Straightness > 0.85, sin órbitas | Tránsito, ferry, scramble |
| `LOITER` | Movimiento lento, área compacta, sin órbitas completas | Overwatch, holding, hover ops |
| `DESCENT` | Δ altitud negativo consistente | Aproximación / aterrizaje |
| `CLIMB` | Δ altitud positivo consistente | Despegue / ascenso |
| `ERRATIC` | Turn rate alto, straightness bajo | Combate, entrenamiento, evasión |
| `UNKNOWN` | < 5 puntos de trail o sin patrón claro | Datos insuficientes |

**8 categorías de aeronave (regex en tipo ICAO):**

| Categoría | Regex | Ejemplos |
|---|---|---|
| Tanker | `KC, K35, K46, MRTT, IL78...` | KC-135, KC-46, A330MRTT |
| AWACS | `E3, E7, E2, A50, KJ...` | E-3 Sentry, E-7 Wedgetail |
| ISR | `RC, EP, MC12, U2, P8, GLEX...` | RC-135, P-8 Poseidon |
| UAV | `MQ, RQ, TB2, ANKA, BAYRKTR...` | MQ-9 Reaper, RQ-4 Global Hawk |
| Helicopter | `AH, UH, CH, MH, V22, S70...` | AH-64, UH-60, V-22 Osprey |
| Fighter | `F1x, FA18, SU, MIG, EF2K...` | F-16, F-35, Su-27, Eurofighter |
| Bomber | `B52, B1, B2, TU95, TU160, H6` | B-52H, Tu-160, H-6K |
| Cargo | `C17, C130, A400, AN, IL76, Y20` | C-17, C-130J, A400M |

**Tabla de inferencia de misión (40+ combinaciones):**

La misión se determina cruzando `patrón × categoría`:

| Patrón \ Categoría | Tanker | AWACS | ISR | UAV | Fighter | Bomber | Helo | Cargo |
|---|---|---|---|---|---|---|---|---|
| ORBIT | Refueling Orbit | Early Warning | ISR / Recon | UAV Surveillance | CAP | Holding | Patrol / SAR | Airdrop |
| RACETRACK | Refueling Racetrack | AWACS Patrol | SIGINT | Persistent Surv. | CAP | — | Border Patrol | — |
| LINEAR | Repositioning | — | — | Transit to AO | Intercept / Scramble | **Strike Route** | Point-to-Point | Strategic Airlift |
| LOITER | — | Station Keeping | Target Surv. | Persistent Overwatch | Defensive Counter-Air | — | CAS / Hover | — |
| ERRATIC | — | — | — | Evasive | **Air Combat (ACM)** | — | NOE / Tactical | — |
| DESCENT | Approach | Approach | Approach | Approach | Approach | Approach | Approach | Approach |
| CLIMB | Departure | Departure | Departure | Departure | Departure | Departure | Departure | Departure |

**Métricas calculadas por aeronave:**

| Métrica | Descripción |
|---|---|
| `totalDistKm` | Distancia total recorrida (suma segmentos) |
| `directDistKm` | Distancia inicio → fin |
| `straightness` | Ratio directo/total (0–1) |
| `orbits` | Rotaciones 360° completadas |
| `turnBias` | Ratio giro firmado/absoluto (0–1) |
| `avgTurnRate` | Grados/segmento (~°/30 s) |
| `compactness` | Diagonal bbox / longitud camino (0–1) |
| `altChangeM` | Cambio neto de altitud (metros) |
| `altStdDevM` | Desviación estándar de altitud |
| `bboxDiagKm` | Diagonal del bounding box (km) |

**Confidence:** 0–100 %, basada en número de puntos y claridad del patrón geométrico.

### 4.3 Detalle: Motor de Alertas y Credibilidad

**14 zonas de conflicto monitorizadas:**

| Zona | Severidad | Centro aproximado |
|---|---|---|
| Ukraine | CRITICAL | Kyiv, Donbas |
| Gaza | CRITICAL | Gaza Strip |
| Lebanon | CRITICAL | South Lebanon |
| Iran | HIGH | Tehran, Isfahan |
| Persian Gulf | HIGH | Strait of Hormuz |
| Red Sea | CRITICAL | Bab el-Mandeb |
| Iraq-Syria | CRITICAL | Euphrates corridor |
| Kuwait | MEDIUM | Kuwait Bay |
| Cyprus | MEDIUM | Buffer zone |
| Taiwan Strait | CRITICAL | Median line |
| South China Sea | HIGH | Spratly Islands |
| UAE | HIGH | Abu Dhabi / Dubai |
| Korean Peninsula | CRITICAL | DMZ |
| Syria | HIGH | Damascus region |

**Motor de credibilidad (0–95 %):**

| Factor | Puntos |
|---|---|
| Base por severidad (CRITICAL/HIGH/MEDIUM/LOW) | 40 / 30 / 20 / 10 |
| + En zona de conflicto activo | +15 |
| + Corroboración por otra fuente de datos | +20 |
| + Firma térmica FIRMS confirmada | +15 |
| + Aeronave militar en proximidad | +10 |
| + Buque de guerra en proximidad | +10 |
| **Tope máximo** | **95 %** |

**Hotspots (clustering geoespacial):**
- Grid: celdas de 3° × 3° (~330 km)
- Mínimo: 3 eventos por celda para considerar hotspot
- Output: top 8 hotspots ordenados por densidad de eventos
- Integrado en AlertPanel con tab dedicada

### 4.4 Detalle: Persistencia de Trayectorias (IndexedDB)

**Módulo:** `trailStore.js`

| Parámetro | Valor |
|---|---|
| Database | `miltracker_trails` |
| Object Store | `trails` |
| Key | `{type}:{entityId}` |
| Índices | `type`, `ts` |
| TTL | 24 horas |
| Prune | Automático al arranque |

**Flujo de persistencia:**

1. Cada ciclo de actualización (30 s / 60 s), los trails se guardan en IndexedDB con debounce de 5 s
2. Listeners `visibilitychange` y `beforeunload` fuerzan flush inmediato antes de cerrar/refrescar
3. Al cargar la página, se restauran los trails y se prepend a los datos frescos
4. Puntos expirados (> 24 h) se eliminan automáticamente en el arranque
5. Cap máximo por entidad: 40 puntos (aeronaves), 60 puntos (buques)

### 4.5 Detalle: Trails con Gradiente de Altitud

Cada segmento del trail de vuelo se colorea individualmente según la altitud del punto:

| Altitud (m) | Altitud (ft) | Color | Hex |
|---|---|---|---|
| 0 | 0 | Cian | `#00ffff` |
| 3 750 | 12 300 | Verde | `#00ff00` |
| 7 500 | 24 600 | Amarillo | `#ffff00` |
| 11 250 | 36 900 | Naranja | `#ff8000` |
| 15 000 | 49 200 | Rojo | `#ff0000` |

Interpolación lineal entre stops. Cada segmento del `PolylineGraphics` recibe su color individual.

### 4.6 Detalle: Enriquecimiento Militar

**Identificación de país por ICAO hex (27 naciones):**

US, GB, FR, DE, RU, CN, KR, JP, IN, IL, TR, IR, BE, AU, CA, IT, ES, NL, PL, SE, NO, GR, PK, SA, AE, EG, UA.

Cada rango hexadecimal de 24 bits se mapea al país emisor del transponder.

**Resolución de aeródromos (104 bases):**

| Región | Bases | Ejemplos |
|---|---|---|
| US CONUS | 44 | Andrews (KADW), Langley (KLFI), Nellis (KLSV) |
| US Pacific | 8 | Hickam (PHNL), Guam (PGUA), Yokota (RJTY) |
| Europa | 20 | Ramstein (ETAR), Aviano (LIPA), Brize Norton (EGVN) |
| Oriente Medio | 12 | Al Udeid (OTBH), Incirlik (LTAG), Nevatim (LLNV) |
| Asia-Pacífico | 10 | Osan (RKSO), Kadena (RODN), Diego Garcia (FJDG) |
| Otros | 10 | Sigonella (LICZ), Lajes (LPLA), Rota (LERT) |

**Tipos de aeronave con nombre (56 designaciones):**

US (23): C-17, C-5M, C-130J, KC-46, B-52, B-1, B-2, F-15, F-16, F/A-18, F-35, F-22, A-10, RC-135, E-3, E-8, U-2, RQ-4, MQ-9, P-8, UH-60, CH-47, AH-64.  
Europa (7): A400M, MRTT, E-145, F-2, Eurofighter, PA-18, DO-28.  
Rusia (9): IL-76, IL-78, IL-20, Tu-95, Tu-22M, Tu-160, Su-27, Su-57, MiG-31.  
Business/ISR (6): Gulfstream V/VI, Falcon 900, CL-60, GLEX.

**Detección Carrier Air Wing (46 callsign prefixes):**

| CVW | Portaaviones | Escuadrones (prefijos) |
|---|---|---|
| CVW-1 | USS Gerald R. Ford | 7 prefijos |
| CVW-3 | USS Eisenhower | 5 prefijos |
| CVW-8 | USS Truman | 5 prefijos |
| CVW-11 | USS Roosevelt | 6 prefijos |
| CVW-2 | USS Lincoln | 5 prefijos |
| CVW-5 | USS Reagan | 4 prefijos |
| Royal Navy | HMS Queen Elizabeth | 5 prefijos |
| Marine Nationale | Charles de Gaulle | 3 prefijos |
| Marina Militare | Cavour | 2 prefijos |

### 4.7 Detalle: Leyenda de Mapa (MapLegend)

Componente flotante posicionado en esquina inferior derecha, encima del `MapLayerSwitcher`. 3 pestañas:

**Tab GENERAL:**
- Entidades: Aeronave, Helicóptero, Buque, Conflicto, Base Militar, Noticia, FIRMS Fire, Alerta, Live Cam
- Gradiente de altitud: barra visual cyan → rojo
- Severidad: CRITICAL / HIGH / MEDIUM / LOW (colores)
- Credibilidad: HIGH ≥70 %, MED ≥45 %, LOW <45 %
- Alianzas: NATO (azul), ADVERSARY (rojo), OTHER (ámbar)
- Tipos de base: [AB] Airbase, [NB] Naval Base, [MS] Missile/Nuc, [RD] Radar/Cmd
- Zonas de peligro: CRIT, HIGH, MED, LOW (polylines)
- Clasificación de noticias: Attack/Blast, Aircraft, Naval, Military, General

**Tab EVENTS:**
- 11 tipos de evento de conflicto: Airstrike, Missile, Explosion, Artillery, Drone, Naval, Troops, Casualties, Fire, Cyber, CBRN
- FIRMS: Single fire / Cluster

**Tab COUNTRIES:**
- 9 colores de país: US/UK, France, Russia, China, Turkey, Ukraine, Israel, Iran, Germany

---

## 5. MOTOR DE ALERTAS IA

### 5.1 Reglas locales (sin API externa)

1. **Proximidad aeronave–zona de conflicto** (< 200 km) → severidad según zona
2. **Proximidad buque–zona de conflicto** (< 300 km) → severidad según zona
3. **Evento de alta severidad reciente** (< 30 min)
4. **Alertas desde noticias** por keywords en headlines geocodificados
5. **Credibilidad cruzada** — corroboración multifuente ajusta score 0–95 %
6. **Hotspots** — agrupación geoespacial en grid 3°×3°, mín. 3 eventos, top 8

### 5.2 Gemini AI (opcional)

Si `GEMINI_API_KEY` configurada: envía resumen táctico a Gemini 1.5 Flash. Devuelve insight JSON (`{ summary, threats[], recommendations[] }`). Mostrado en AlertPanel → tab "AI Intel". Cooldown configurable.

---

## 6. SISTEMA DE REPLAY HISTÓRICO

`positionTracker.js` guarda un snapshot cada 30 s (ring buffer 120 posiciones, disk persist cada 5 min):

- **Duración:** ~60 min de historial navegable
- **Velocidades:** 1×, 5×, 20×, 60×, 120× velocidad real
- **Controles:** Play / Pause / Stop, scrubbing manual en barra de progreso
- **Trails:** Ver trails históricos hasta el frame actual
- **STOP:** Regresa automáticamente al modo live
- **Datos persistidos:** Hasta 90 min en disco (sobrevive reinicios de backend)

---

## 7. DEPLOYMENT

### Backend — Railway

| Variable | Descripción | Obligatorio |
|---|---|---|
| `NODE_ENV` | `production` (CORS restrictivo) | Sí |
| `FIRMS_MAP_KEY` | NASA Earthdata (gratuita) | Recomendado |
| `GEMINI_API_KEY` | Google AI Studio (gratuita hasta 1M tokens/día) | Opcional |
| `AISSTREAM_KEY` | AIS Stream WebSocket | Recomendado |
| `TWITTER_API_KEY` / `TWITTER_API_SECRET` | Auto-tweet alertas CRITICAL | Opcional |
| `REST_API_KEY` | Si se establece, protege endpoints REST con X-Api-Key | Opcional |
| `ADMIN_SECRET` | Para `/api/admin/tweet` manual | Opcional |
| `ALLOWED_ORIGIN` | Origen Vercel extra | Recomendado |

### Frontend — Vercel

| Variable | Valor |
|---|---|
| `VITE_BACKEND_URL` | `https://tu-backend.railway.app` |
| `VITE_CESIUM_ION_TOKEN` | Opcional (mejora terrain tiles) |

### CORS (producción)

```
Orígenes permitidos:
  - localhost / 127.0.0.1 (dev)
  - *.vercel.app
  - *.railway.app
  - *.onrender.com
  - livewar3d.com / www.livewar3d.com
```

En `NODE_ENV=production`, orígenes no reconocidos se rechazan.

---

## 8. SEGURIDAD

| Control | Estado | Detalle |
|---|---|---|
| CORS restrictivo | ✅ | Allowlist de 5 patrones de origen |
| Rate limiting HTTP | ✅ | 30 req/min por IP en `/api/` |
| Rate limiting WebSocket | ✅ | Per-socket: 5 s `request_data`, 10 s `request_history` |
| Error handler global | ✅ | 500 genérico — nunca expone stack trace |
| Validación de input | ✅ | Callbacks y payloads sanitizados |
| API key opcional REST | ✅ | `REST_API_KEY` → `X-Api-Key` header |
| ErrorBoundary frontend | ✅ | Catch de crashes por componente |
| Variables de entorno | ✅ | dotenv, nunca en código fuente |

---

## 9. RENDIMIENTO

| Métrica | Valor |
|---|---|
| Aeronaves simultáneas en pantalla | 100–300 |
| Buques simultáneos | 20–80 |
| Frecuencia de actualización live (aeronaves) | 30 s |
| Frecuencia de actualización live (buques) | 60 s |
| Frecuencia noticias / conflictos | 5 min / 10 min |
| Uso de memoria frontend (~200 entidades) | ~180 MB |
| Tamaño bundle frontend (gzip) | ~8 MB (CesiumJS domina) |
| Primera carga (cold) | ~3–5 s |
| Carga con cache caliente | < 1 s |
| Framerate globo (Chrome/Edge) | 55–60 fps |
| Latencia socket backend→frontend | < 50 ms |
| Cooldown rate-limit WebSocket (datos) | 5 s por socket |
| Cooldown rate-limit WebSocket (historial) | 10 s por socket |
| Event loop bloqueado (cache write) | 0 ms (async) |
| Compresión HTTP | gzip (~70 % reducción) |
| Hash-based diff (aeronaves, buques) | Solo emite cambios |

**Optimizaciones implementadas:**

| Optimización | Impacto |
|---|---|
| Hash-diff WebSocket | Evita reemitir datos sin cambio |
| GDELT batched queries (4/500 ms) | Previene rate limiting |
| Timeouts agresivos (5 s por fuente) | Failover dentro de ventana de poll |
| setTimeout recursivo (no setInterval) | Evita solapamiento de polls |
| Fetch regional paralelo (7 queries) | Mejor cobertura, mismo ciclo |
| Ring buffer trimming (shift) | O(1) vs O(n) |
| dsCache ref (DataSource) | O(1) lookup vs O(n) scan |
| useMemo split por capa | Evita recálculos innecesarios |
| Trail cap por entidad | 40 pts aeronave / 60 pts buque |
| Icon cache (ConflictLayer) | Evita regenerar Canvas |

---

## 10. COBERTURA GEOPOLÍTICA

| Región | Eventos monitorizados | Severidad |
|---|---|---|
| **Ucrania/Rusia** | Artillería, misiles balísticos, enjambres de drones, crucero | CRITICAL |
| **Israel/Gaza/Líbano** | Airstrikes IDF, cohetes Hamas/Hezbollah, actividad IRGC | CRITICAL |
| **Yemen/Mar Rojo** | Misiles antibuque Houthis, airstrikes coalición saudí | CRITICAL |
| **Irak/Siria** | Bases EEUU, drones PMF-IRGC, airstrikes israelíes | CRITICAL |
| **Estrecho de Taiwán** | Ejercicios PLAN, cruce línea media PLAAF | CRITICAL |
| **Península de Corea** | DMZ, lanzamientos DPRK, ejercicios US-ROK | CRITICAL |
| **Irán** | Pruebas misilísticas, actividad IRGC en Ormuz | HIGH |
| **Golfo Pérsico** | Estrecho de Ormuz, incidentes IRGCN | HIGH |
| **Mar de China Meridional** | Incidentes navales, ejercicios anfibios, Spratly | HIGH |
| **EAU** | Abu Dhabi / Dubai, interceptores | HIGH |
| **Siria** | Damasco, corredor Éufrates | HIGH |
| **Sahel** | Wagner/Rusia, ataques yihadistas Mali/Burkina/Níger | HIGH |
| **Kuwait** | Bases aliadas, escudos antimisil | MEDIUM |
| **Chipre** | Buffer zone, bases RAF | MEDIUM |
| **Ártico** | Patrullas OTAN/Rusia, actividad submarina | Monitored |

---

## 11. PERSISTENCIA Y TTLs

| Dato | TTL | Almacenamiento | Notas |
|---|---|---|---|
| Aeronaves (live) | 30 min | localStorage | Preferencia a datos live |
| Buques (live) | 60 min | localStorage | Cache si offline |
| Noticias | 2 h | localStorage | Navegación offline |
| Conflictos | 72 h | Backend memoria + disco | Acumulan; expiran tras 3 días |
| Alertas | 4 h | localStorage | Short-lived |
| Zonas de peligro | 24 h | localStorage | Estáticas, baja frecuencia |
| AI Insight | 6 h | localStorage | Análisis Gemini |
| History snapshots | 90 min | Backend disco | Replay buffer, sobrevive restart |
| **Trails (IndexedDB)** | **24 h** | **IndexedDB client** | Flush en beforeunload |

---

## 12. LIMITACIONES CONOCIDAS

1. Los buques militares desactivan AIS con frecuencia en operaciones activas
2. B-2, F-22, Su-57 en misión no emiten ADS-B
3. Eventos GDELT con 10–30 min de lag respecto a ocurrencia real
4. Geocodificación por keywords (100+ ubicaciones), no por NLP semántico
5. 120 frames × 30 s = ~60 min de historial (limitado por RAM)
6. App pública sin autenticación (adecuado para datos OSINT públicos)
7. Buques con AIS caído muestran posición de homeport del catálogo
8. `conflictStore` en memoria sin límite de tamaño máximo
9. Trayectorias necesitan ≥ 5 puntos para análisis (≥ 2.5 min de datos)
10. No TypeScript — sin tipado estático (proyecto 100 % JavaScript)

---

---

# PARTE III — DATOS EJECUTIVOS Y NEGOCIO

---

## 13. VALORACIÓN DEL PROYECTO

> *Valoración actualizada a marzo 2026 (v3.0). El proyecto ha evolucionado de MVP auditado (v2.1) a plataforma de inteligencia de trayectoria con persistencia, motor de credibilidad cruzada, hotspots geoespaciales y 35+ fuentes integradas. El contexto geopolítico global (Ucrania, Gaza/Líbano, Yemen, Taiwán, Sahel, rearme europeo) favorece especialmente el caso de negocio.*

### 13.1 Comparativa con proyectos similares

| Proyecto | Descripción | Valoración / Estado |
|---|---|---|
| **Flightradar24** | Tracking aéreo civil + militar | ~1.500 M USD |
| **MarineTraffic** | Tracking AIS naval | ~50–100 M USD (Serie B, 2021) |
| **LiveUAMap** | Mapa 2D conflictos, sin datos live propios | ~2–5 M USD estimado |
| **Orbital Insight** | Inteligencia geoespacial IA | ~200 M USD (adquirido por Palantir, 2021) |
| **Hawkeye 360** | Inteligencia señales RF + geoespacial | ~100 M USD (contratos DoD) |
| **Bellingcat** | OSINT investigativo, modelo donativo | ~2–5 M USD estimado |
| **Maxar Intelligence** | Imágenes satelitales IA | ~6.400 M USD (Advent, 2023) |
| **Synthetaic** | Detección objetos militares en satélite | ~100 M USD (Serie B, DoD) |

MilTracker 3D combina tracking (Flightradar24), análisis de conflictos (LiveUAMap), inteligencia geoespacial con IA (Orbital Insight), **análisis de trayectoria automatizado** (capacidad única) y visualización 3D, operando a coste próximo a cero. El rearme europeo (OTAN al 2–3 % del PIB, 2025–2026) amplía sustancialmente el mercado institucional.

### 13.2 Factores de valoración (evolución v2.1 → v3.0)

| Factor | Impacto | Nota |
|---|---|---|
| **Inteligencia de trayectoria única** | +20–30 % | Ningún competidor ofrece inferencia de misión automatizada en OSINT |
| **Motor de credibilidad cruzada** | +10–15 % | Scoring 0–95 % con 5 factores, estándar de industria para OSINT |
| **Hotspots geoespaciales** | +10 % | Dashboard de clusters de actividad, valor analítico directo |
| **Persistencia IndexedDB** | +5 % | Trails 24 h, UX profesional sin pérdida de datos al refrescar |
| **Enriquecimiento masivo** | +10 % | 104 bases, 27 países ICAO, 56 tipos aeronave, 46 CVW, 154 MMSI |
| **35+ fuentes integradas** | +10 % | Mayor cobertura y resiliencia que cualquier competidor OSINT gratuito |
| Auditoría técnica (`AUDIT.md`) | +5 % | Deuda técnica documentada y controlada |
| 15+ bugs corregidos | +5 % | Estabilidad demostrable |
| Rate limiting + CORS + seguridad | +5 % | Requisito B2B/gov cubierto |
| Commits limpios + documentación completa | +5 % | Indica proceso de desarrollo maduro |

### 13.3 Valoración estimada por etapa

| Etapa | Condición | Valoración estimada |
|---|---|---|
| **Actual (v3.0)** — Plataforma de inteligencia completa, 0 revenue | Producto demostrable con capacidades únicas, diferenciación extrema | **80.000–200.000 USD** |
| **Dominio + primeros usuarios** — 1.000–10.000 usuarios/mes | PMF incipiente, analytics, dominio propio activo | **250.000–700.000 USD** |
| **Revenue inicial** — 2.000–5.000 USD/mes, un cliente B2B | Ingresos recurrentes demostrados | **800.000–2.500.000 USD** |
| **Crecimiento** — 20.000–50.000 USD/mes ARR, 2–3 clientes institucionales | Modelo de negocio probado, replicable | **3.000.000–12.000.000 USD** |
| **Scale** — >100K USD/mes ARR, contratos gobierno/defensa | Escalado real, clientes públicos verificables | **20.000.000–80.000.000 USD** |

> **Valoración actual realista (marzo 2026, v3.0):** Entre **100.000–200.000 USD** (vs. 50.000–150.000 USD en v2.1). La inteligencia de trayectoria, el motor de credibilidad cruzada y los 35+ feeds integrados elevan significativamente el valor técnico. Con 6 meses de tracción: **500.000–1.500.000 USD**. El timing geopolítico sigue siendo excepcionalmente favorable.

---

## 14. ESCENARIOS DE MONETIZACIÓN

### Escenario A — Freemium B2C (SaaS consumer)

**Target:** Analistas OSINT, periodistas, investigadores, enthusiasts militares, estudiantes de RRII, ciudadanos con interés en geopolítica.

**Pricing sugerido:**

| Plan | Precio | Incluye |
|---|---|---|
| Free | 0 USD/mes | Globo 3D, datos live, historial 1 h, 10 alertas/día, 1 entidad |
| **Pro** | **9,99 USD/mes** | Sin límites, historial 24 h, tracking ilimitado, SITREP PDF, push, sin ads |
| **Analyst** | **29,99 USD/mes** | Todo Pro + API REST, historial 7 d, CSV/JSON, alertas Telegram/email, beta |
| **Team** | **79,99 USD/mes** | Hasta 5 usuarios, dashboards compartidos, webhooks, SLA 48 h |

**Proyección ARR:**

| Usuarios/mes | Pro (2 %) | Analyst (15 % de Pro) | ARR estimado |
|---|---|---|---|
| 5.000 | 100 | 15 | ~13.400 USD/año |
| 20.000 | 400 | 60 | ~53.600 USD/año |
| 50.000 | 1.000 | 150 | ~134.000 USD/año |
| 200.000 | 4.000 | 600 | ~536.000 USD/año |

**Canales de adquisición (coste 0):**
- Reddit: r/OSINT, r/WarCollege, r/geopolitics, r/worldnews, r/ukraine, r/CredibleDefense
- Twitter/X: comunidades militares y OSINT
- Hacker News "Show HN"
- YouTube: canales de geopolítica (Perun, Task & Purpose, Foreign Policy)
- Newsletters: Bellingcat, The War Zone, War on the Rocks

**Inversión técnica:** Supabase Auth + Stripe (~4 semanas). Coste adicional: ~5–10 USD/mes.

---

### Escenario B — B2B: API y widgets embebibles

**Target:** Medios de comunicación, think tanks, universidades, empresas de análisis de riesgo.

| Producto | Precio/mes | Target |
|---|---|---|
| **API REST básica** (aircraft, ships, alerts) | 149–599 USD | Newsletters, medios digitales |
| **API REST Pro** (+ conflicts, historial 7 d, webhooks) | 499–1.499 USD | Medios internacionales, think tanks |
| **Widget embebible** (globo 3D iframe configurable) | 299–1.499 USD | Periódicos (Reuters, BBC Verify) |
| **Data feed WebSocket** (push en tiempo real) | 499–2.499 USD | Empresas riesgo, hedge funds |
| **White-label** (plataforma completa con branding propio) | 2.500–10.000 USD | Contratistas defensa |

**Proyección ARR:**

| Clientes | Ticket medio | ARR |
|---|---|---|
| 3 | 600 USD/mes | 21.600 USD/año |
| 10 | 1.000 USD/mes | 120.000 USD/año |
| 30 | 1.500 USD/mes | 540.000 USD/año |

---

### Escenario C — Contratos institucionales (defensa/gobierno)

**Target:** FFAA, servicios de inteligencia, contratistas de defensa. Plazos de venta 6–18 meses.

| Tipo | Rango de valor |
|---|---|
| Herramienta OSINT on-premise | 25.000–100.000 USD/año |
| Licencia de datos (feed normalizado) | 15.000–60.000 USD/año |
| Integración en sistemas C2 | 150.000–600.000 USD |
| Soporte y mantenimiento | 20–30 % del contrato base/año |
| Consultoría de datos geoespacial | 200–400 USD/hora |

**Organismos target:**

*España/Europa:* CNI, EMAD/MOPS, FRONTEX, EUISS, NATO STRATCOM, EDA.  
*Global:* RAND, CSIS, IISS, RUSI · L3Harris, BAE, Thales, Leonardo, Indra · Palantir, Anduril.

**Proyección:**

| Contratos | Valor medio | Año 1 |
|---|---|---|
| 1 piloto | 30.000 USD | 30.000 USD |
| 3 | 50.000 USD | 150.000 USD |
| 5 + renovaciones | 90.000 USD | 450.000 USD |

---

### Escenario D — Publicidad y patrocinios

| Canal | CPM estimado | Con 100K visitas/mes |
|---|---|---|
| Google AdSense / Carbon Ads | 2–6 USD | 200–600 USD/mes |
| Patrocinio newsletter | 500–2.000 USD/envío | Variable |
| Sponsor de la app | 1.000–5.000 USD/mes | Negociable |

**Sponsors naturales:** VPNs, Recorded Future, Flashpoint, JANES, Defense News, Esri, Maxar, Planet Labs.

---

### Escenario E — Venta / Adquisición

| Tipo comprador | Precio hoy (v3.0) | Con tracción (6 m) |
|---|---|---|
| Grupo editorial (defensa) | 120.000–400.000 USD | 400.000–1.000.000 USD |
| Empresa inteligencia geoespacial | 200.000–900.000 USD | 900.000–3.000.000 USD |
| Contratista defensa | 250.000–1.000.000 USD | 1.000.000–3.500.000 USD |
| PE fund / Family office | 500.000–1.500.000 USD (con traction) | — |
| **Plataforma OSINT existente** (Maltego, Maltego, SpiderFoot, i2) | Añadir capa de tracking militar live | 100.000–400.000 USD | 300.000–1.000.000 USD |
| **Media group** (The War Zone, Defense One, Jane's) | Competencia directa o widget diferenciador | 150.000–500.000 USD | 400.000–1.200.000 USD |

> La venta sin revenue hoy es esencialmente la venta de la **tecnología + activo técnico + tiempo de desarrollo ahorrado** (estimado en 8–14 meses de trabajo de un equipo de 2–3 ingenieros senior, contando la auditoría y endurecimiento de v2.1). La ventana de mayor precio es a **6–18 meses** con tracción de usuarios demostrable.

---

## 13. COMPARATIVA DE ESCENARIOS

| Escenario | Complejidad técnica adicional | Time-to-revenue | ARR realista año 1 | ARR optimista año 2 | Upside máximo |
|---|---|---|---|---|---|
| **A — Freemium B2C** | Baja (4–6 semanas) | 1–3 meses | 15.000–30.000 USD | 80.000–150.000 USD | 600K+ USD/año |
| **B — API B2B** | Media (6–8 semanas) | 2–4 meses | 25.000–65.000 USD | 120.000–400.000 USD | 1,5M+ USD/año |
| **C — Institucional/Gov** | Alta (3–6 meses + certificaciones) | 6–18 meses | 30.000–150.000 USD | 250.000–600.000 USD | Ilimitado (DoD-scale) |
| **D — Publicidad** | Muy baja (< 1 semana) | Inmediato | 3.000–10.000 USD | 15.000–40.000 USD | Limitado sin escala de tráfico |
| **E — Venta activo** | Ninguna | 3–12 meses búsqueda | — | — | 80K–2,5M+ USD one-time |

**Recomendación estratégica:** Ejecutar **A + D simultáneamente** (mínima fricción, generan señal de tracción) mientras se construyen relaciones B2B para **B**. El contexto de rearme europeo de 2025–2026 hace que **C** sea más accesible que nunca — los organismos tienen presupuesto y necesidad urgente de herramientas OSINT. Un solo cliente B2B ancla multiplica la valoración x5–10 para una posible ronda seed o venta.

---

## 14. PLAN DE ACCIÓN PARA MAXIMIZAR VALOR

### Inmediato — Ya completado en v2.1
- [x] Proyecto en producción: Railway (backend) + Vercel (frontend)
- [x] Auditoría técnica completa: `AUDIT.md` con 51 issues (35 bugs + 16 optimizaciones)
- [x] 15 bugs corregidos: seguridad, estabilidad, UX, rendimiento
- [x] Rate limiting WebSocket, validación de URLs, cache asíncrono
- [x] Documentación técnica y de negocio actualizada a v2.1

### Semanas 1–2 (inversión ~10 USD)
- [ ] Registrar dominio propio: `miltracker.io` / `miltracker3d.com` (~10 USD/año)
- [ ] Configurar Google Analytics 4 + hotjar básico (medir DAU, sesiones, mapas de calor)
- [ ] Crear perfiles Twitter/X, LinkedIn, Reddit del proyecto
- [ ] Post en r/OSINT, r/geopolitics, r/WarCollege, Hacker News "Show HN"
- [ ] Corregir las 16 optimizaciones identificadas en `AUDIT.md` §10 (O1–O16) con mayor ROI (O1, O4, O7, O14, O15)

### Mes 1 (inversión ~50–100 USD)
- [ ] Implementar autenticación (Supabase Auth, gratuita hasta 50.000 usuarios)
- [ ] Plan Pro con Stripe: desbloquear historial > 1h, exports PDF, tracking ilimitado, sin ads
- [ ] Landing page con email capture (Resend + Convertkit, gratuito hasta 1.000 suscriptores)
- [ ] Contactar 5 newsletters OSINT/defensa con propuesta de demo
- [ ] Configurar `NODE_ENV=production` + `ALLOWED_ORIGIN` en Railway (CORS restrictivo)

### Meses 2–3
- [ ] API pública documentada (Swagger/Redoc) con plan de pago (Escenario B)
- [ ] Widget embebible para medios (iframe configurable con API key)
- [ ] Primer cliente B2B piloto a precio reducido a cambio de testimonio público
- [ ] Aplicar a aceleradoras: Lanzadera (España), YC (W27 batch), Wayra Telefónica
- [ ] Alertas Telegram bot para eventos CRITICAL (diferenciador para plan Pro)

### Meses 4–6
- [ ] Ampliar historial a 7 días (Redis: ~5 USD/mes en Railway) — requisito para Analyst/B2B
- [ ] Alertas por email/Telegram para suscriptores Pro
- [ ] Preparar deck de inversión si DAU > 500 y hay revenue inicial
- [ ] Contactar think tanks europeos y CIDOB/Elcano con demo en vivo
- [ ] Explorar integración Sentinel-2 / NASA GIBS en MapLayerSwitcher (diferenciador visual)

---

## 15. ROADMAP TÉCNICO — PRÓXIMAS FUNCIONALIDADES

### Alta prioridad (prerequisitos para monetización)
- [ ] Autenticación + plan Pro (Supabase Auth + Stripe)
- [ ] Historial extendido a 24h/7 días (Redis o PostgreSQL timeseries)
- [ ] API REST pública documentada (aircraft, ships, alerts, conflicts) con rate limiting por API key
- [ ] Alertas Telegram bot para eventos CRITICAL
- [ ] Filtro temporal en ConflictLayer ("últimas 2h / 24h / 72h")
- [ ] Optimizaciones críticas de `AUDIT.md` §10: O1 (mouse throttle), O4 (sessionStorage quota), O7 (GDELT parallel), O14 (null coords in snapshots), O15 (conflictStore size limit)

### Media prioridad
- [ ] Overlay NASA GIBS (MODIS truecolor diario) en MapLayerSwitcher
- [ ] Overlay Sentinel-2 (EOX tiles, 10m resolución) para zonas calientes
- [ ] Exportar SITREP como PDF (jsPDF + html2canvas)
- [ ] Widget embebible configurable (iframe + API key)
- [ ] Integración AIS real (AISHub API gratuita, más fiable que scraping)
- [ ] Persistir snapshots del timeline a disco (Redis o JSON) para historial post-reinicio
- [ ] `conflictStore` con límite MAX_SIZE + política LRU (O15)
- [ ] `React.memo` en MapLayerSwitcher y CoordinateHUD con props numéricas (O6)

### Futuro / a largo plazo
- [ ] NLP geocodificación (mejorar precisión ubicación noticias)
- [ ] Análisis de patrones (rutas habituales vs. anomalías)
- [ ] App móvil nativa (React Native o PWA optimizada)
- [ ] Integraciones OSINT (Maltego, Shodan, Sentinel Hub)
- [ ] Módulo de análisis de amenazas custom para clientes enterprise
- [ ] Tests unitarios e integración (AUDIT.md §9.1)

---

## 16. IMÁGENES SATELITALES — OPCIONES

| Fuente | Resolución | Latencia | Auth | Coste |
|---|---|---|---|---|
| NASA GIBS / Worldview (MODIS, VIIRS) | 250m–1km | 1–2 días | Ninguna | Gratis |
| Sentinel-2 (ESA, EOX tiles) | 10–60m | ~5 días | Cuenta ESA gratuita | Gratis |
| Sentinel-1 SAR (radar) | 5–20m | ~6 días | Cuenta ESA gratuita | Gratis |
| ESRI World Imagery | 30cm–15m | Estático | Ninguna | Gratis |
| Mapbox Satellite | ~50cm ciudades | Periódica | API key (50k req/mes gratis) | Gratis (tier) |
| Planet Labs / Maxar | 30–50cm | 1–24h (tasking) | Contrato | 1–10 USD/km² |

La integración de GIBS y EOX Sentinel-2 en el MapLayerSwitcher es viable en < 1 semana sin coste adicional.

---

## APÉNDICE — DECISIONES DE DISEÑO

| Decisión | Alternativa considerada | Razón |
|---|---|---|
| CesiumJS en lugar de MapboxGL | Mapbox, Deck.gl | 3D globe nativo, altitud real de vuelo, terrain providers, WMTS built-in |
| CustomDataSource por capa | Primitive Collections | Integración más simple con React/Resium, suficiente para 300 entidades |
| Socket.io en lugar de polling REST | Fetch polling | Delta push: emite solo cuando los datos cambian (hash) |
| Cache en disco JSON, sin base de datos | PostgreSQL, MongoDB | Zero-dependency, arranque instantáneo en Railway |
| Un solo ScreenSpaceEventHandler | Handler por capa | Un único pick() por click, elimina conflictos entre capas |
| React 18 + Vite en lugar de Next.js | Next.js | CesiumJS no optimizado para SSR; cliente puro más simple y rápido |
| GDELT gratuito | Bellingcat, Janes.com | Cero coste operativo, 15 min de lag, cobertura global |
| Rate limiting por closure de socket | Map global de IDs | Sin estado compartido, sin riesgo de fuga de memoria por sockets desconectados |
| `writeFile` async para disk cache | `writeFileSync` en setImmediate | No bloquea el event loop durante la escritura de archivos de caché grandes |
| `setTimeout` recursivo para pollShips | `setInterval` fijo | Evita solapamiento si AISStream WS tarda más de 60s (3 batches × 18s) |
| Jitter geocodificación determinista (Knuth hash) | `Math.random()` | Mismo evento de conflicto siempre recibe el mismo offset; evita marcadores saltantes |

---

## HISTORIAL DE CAMBIOS

### v2.1b — 7 de marzo de 2026 (documentación)

**Actualización de valoración y escenarios de negocio:**
- §11 Valoración: cifras actualizadas post-auditoría; "Actual" sube de 15K–80K a **40K–120K USD**; valoración realista de 30K–100K a **50K–150K USD**; nuevo §11.2 con tabla de factores de mejora de valoración; nuevas comparables (Maxar, Synthetaic)
- §12 Escenarios: Escenario A amplía tabla de planes (Team), actualiza proyección ARR con tier Analyst, añade canales de adquisición específicos, timing de marzo 2026; Escenario B precios B2B actualizados, nuevas comparables (Politico Europe, ECFR, Sibylline, Janes.com), nota sobre ventaja competitiva widget 3D; Escenario C: nota sobre rearme europeo 2%+ PIB, contratos on-premise/VPC, FRONTEX, EDA, Anduril; Escenario E: precios upward, nuevas comparables (i2, Jane's, Defense One)
- §13 Comparativa: cifras ARR actualizadas en todos los escenarios; recomendación estratégica ampliada con contexto geopol. 2026
- §14 Plan de acción: nueva sección "Inmediato — Ya completado en v2.1" con 5 items marcados; semanas 1–2 añade optimizaciones AUDIT §10; mes 1: Resend + Convertkit, CORS Railway; meses 2–3: Wayra; meses 4–6: Sentinel-2/NASA GIBS
- §15 Roadmap técnico: API documentada con rate limiting por API key, optimizaciones prioritarias AUDIT §10 enumeradas; media prioridad: persistir snapshots, conflictStore LRU, React.memo; futuro: tests unitarios

### v2.1 — 6 de marzo de 2026 (commit `bb6064f`)

**Correcciones de bugs (15 issues del `AUDIT.md`):**

| ID | Descripción | Archivo(s) |
|---|---|---|
| F1 | `filteredConflicts` no respetaba el toggle `showConflicts` | `App.jsx` |
| B2 | Jitter `Math.random()` causaba marcadores de conflicto saltantes | `conflictService.js`, `aiDanger.js` |
| B4 | `setInterval(pollShips)` podía solaparse con fetch anterior | `server.js` |
| B5 | IDs de GDELT GEO colisionaban para eventos en mismas coordenadas | `conflictService.js` |
| B6 | ReliefWeb abría URL del endpoint API en vez del artículo | `conflictService.js` |
| B8 | `cacheSave('alerts')` no se llamaba cuando la lista era vacía | `useRealTimeData.js` |
| B9 | Dos handlers de tecla Escape independientes; prioridad incorrecta | `App.jsx` |
| A1 | Sin rate limiting en eventos WebSocket `request_data`/`request_history` | `server.js` |
| A3 | `writeFileSync` dentro de `setImmediate` bloqueaba el event loop | `diskCache.js` |
| D1 | `alertPanelHeight` calculado pero no conectado al layout | `App.jsx` |
| D2 | Locale `'es-ES'` hardcodeado en interfaz en inglés | `AlertPanel.jsx`, `EntityPopup.jsx`, `NewsPanel.jsx` |
| S1 | URLs de alertas renderizadas sin validar esquema `https?` | `AlertPanel.jsx` |
| S2 | URLs de noticias/conflictos renderizadas sin validar esquema `https?` | `EntityPopup.jsx` |
| T2 | Estado `alertPanelOpen` declarado pero nunca leído | `App.jsx` |
| T5 | Artefactos de migración no excluidos del repositorio | `.gitignore` |

**Nueva documentación:**
- `AUDIT.md` creado: auditoría completa del proyecto (35 issues en 9 categorías + 16 optimizaciones en §10)

### v2.0 — 5 de marzo de 2026
- Lanzamiento inicial en producción (Railway + Vercel)
- Layout dinámico NewsPanel → TrackingPanel → TimelinePanel
- Timeline minimizado a barra de controles siempre visible
- ConflictLayer con deduplicación por hash
- Fuentes RSS adicionales incorporadas

---

*Documento actualizado el 6 de marzo de 2026.*  
*Para estado técnico detallado, bugs conocidos y backlog ver `ROADMAP.md`, `STATUS.md` y `AUDIT.md`.*
