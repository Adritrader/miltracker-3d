# LiveWar3D — API Reference

> Base URL: `https://<railway-host>` (default local: `http://localhost:3001`)

---

## Configuración del servidor

| Propiedad | Valor |
|-----------|-------|
| **Puerto** | `process.env.PORT` o `3001` |
| **CORS** | localhost, *.vercel.app, *.railway.app, *.onrender.com, livewar3d.com |
| **Rate Limit** | 30 req/min por IP |
| **WebSocket buffer** | 5 MB |

---

## Autenticación

| Método | Header | Notas |
|--------|--------|-------|
| API Key (opcional) | `X-Api-Key` | Solo si `REST_API_KEY` está definido en env. |
| Admin | `X-Admin-Secret` | Solo para endpoints `/api/admin/*`. |

---

## Variables de entorno

| Variable | Servicio | Requerida |
|----------|----------|-----------|
| `PORT` | server.js | No (default 3001) |
| `SUPABASE_URL` | Supabase PostgreSQL | No (historial deshabilitado sin ella) |
| `SUPABASE_ANON_KEY` | Supabase PostgreSQL | No |
| `GEMINI_API_KEY` | Google Gemini AI | No (análisis AI deshabilitado) |
| `FIRMS_MAP_KEY` | NASA FIRMS | No |
| `AISSTREAM_KEY` | AIS streams | No |
| `NEWSAPI_KEY` | NewsAPI.org | No |
| `REST_API_KEY` | Auth middleware | No |
| `ADMIN_SECRET` | Admin endpoints | No |
| `ALLOWED_ORIGIN` | CORS extra (comma-sep) | No |

---

## Endpoints REST

### Datos en tiempo real

#### `GET /api/status`
Estado del servidor y contadores.

**Response:**
```json
{
  "status": "ok",
  "clients": 12,
  "aircraft": 47,
  "ships": 23,
  "news": 85,
  "conflicts": 142,
  "firms": 30,
  "alerts": 8,
  "lastAircraftUpdate": "2026-03-11T10:30:00Z",
  "lastShipUpdate": "2026-03-11T10:30:00Z",
  "lastNewsUpdate": "2026-03-11T10:25:00Z",
  "lastConflictUpdate": "2026-03-11T10:20:00Z",
  "version": "3.0.0"
}
```

---

#### `GET /api/aircraft`
Aeronaves militares activas (ADS-B).

**Polling:** cada 30s | **Fuentes:** adsb.lol → adsb.fi → airplanes.live (fallback)

**Response:** `Array<Aircraft>`
```json
[
  {
    "id": "ae0413",
    "callsign": "FORTE12",
    "icao24": "ae0413",
    "lat": 45.123,
    "lon": 33.456,
    "altitude": 55000,
    "heading": 270,
    "velocity": 320,
    "country": "United States",
    "registration": "10-2045",
    "aircraftType": "RQ-4B",
    "squawk": "1200",
    "on_ground": false,
    "vertical_rate": 0,
    "carrierOps": false,
    "source": "adsb.lol"
  }
]
```

---

#### `GET /api/ships`
Buques militares activos (AIS).

**Polling:** cada 60s | **Fuentes:** aisstream.io WS + REST, Norwegian Coastal AIS, AISHub, catálogo MMSI

**Response:** `Array<Ship>`
```json
[
  {
    "id": "211234567",
    "mmsi": "211234567",
    "name": "FGS HESSEN",
    "callsign": "DRBD",
    "lat": 35.789,
    "lon": 14.321,
    "heading": 180,
    "velocity": 12.5,
    "flag": "DE",
    "shipType": "Frigate",
    "destination": "PIRAEUS",
    "imo": "9319440"
  }
]
```

---

#### `GET /api/news`
Noticias de conflicto/militar.

**Polling:** cada 5min | **Fuentes:** GDELT, NewsAPI, RSS

**Response:** `Array<NewsItem>` (máx 100, ordenado por fecha DESC)
```json
[
  {
    "id": "gdelt-abc123",
    "source": "GDELT",
    "title": "Ukraine strikes Russian ammo depot",
    "url": "https://...",
    "description": "...",
    "publishedAt": "2026-03-11T09:00:00Z",
    "lat": 48.5,
    "lon": 37.2,
    "imageUrl": "https://...",
    "tone": "-3.2",
    "type": "news"
  }
]
```

---

#### `GET /api/alerts`
Alertas generadas por análisis de noticias + posiciones.

**Response:** `Array<Alert>`
```json
[
  {
    "id": "alert-xyz",
    "title": "Heavy airstrikes reported near Kherson",
    "message": "...",
    "severity": "critical",
    "credibility": 87,
    "lat": 46.6,
    "lon": 32.6,
    "region": "Ukraine",
    "source": "GDELT",
    "url": "https://...",
    "timestamp": "2026-03-11T08:30:00Z"
  }
]
```
Severidades: `critical` | `high` | `medium` | `low`

---

#### `GET /api/hotspots`
Clusters geográficos de peligro.

**Response:** `Array<Hotspot>`
```json
[
  {
    "id": "hs-1",
    "name": "Eastern Ukraine Front",
    "lat": 48.5,
    "lon": 37.8,
    "radius": 150,
    "severity": "critical"
  }
]
```

---

#### `GET /api/conflicts`
Eventos de conflicto geolocalizados.

**Polling:** cada 10min | **Fuentes:** GDELT GEO/DOC, NASA FIRMS, ACLED, ReliefWeb | **TTL:** 72h

**Response:** `Array<ConflictEvent>` (máx 500)
```json
[
  {
    "id": "firms-20260311-001",
    "type": "fire",
    "title": "Thermal anomaly detected — Donetsk Oblast",
    "lat": 48.1,
    "lon": 37.9,
    "country": "Ukraine",
    "source": "NASA FIRMS",
    "severity": "high",
    "frp": 45.2,
    "zone": "ukraine-front",
    "publishedAt": "2026-03-11T07:00:00Z"
  }
]
```
Tipos: `airstrike` | `missile` | `explosion` | `fire` | `drone` | `artillery` | `naval` | `troops` | `unrest` | `conflict`

---

#### `GET /api/cameras`
Lista estática de cámaras de monitoreo (puede estar vacía).

---

### Inteligencia de aeronaves (Gemini AI)

#### `GET /api/aircraft/intel`
Identificación AI de una aeronave.

**Query params** (al menos 1 requerido):

| Param | Tipo | Ejemplo |
|-------|------|---------|
| `callsign` | string | `FORTE12` |
| `icao24` | string | `ae0413` |
| `registration` | string | `10-2045` |
| `type` | string | `RQ-4B` |
| `country` | string | `United States` |

**Response:**
```json
{
  "confidence": "HIGH",
  "unit": "9th Reconnaissance Wing",
  "base": "Beale AFB, California",
  "mission": "ISR — Surveillance of Black Sea region",
  "notes": "RQ-4B Global Hawk, long-endurance UAV"
}
```
Confidence: `HIGH` | `MEDIUM` | `LOW` | `UNAVAILABLE`

---

#### `GET /api/aircraft/intel/cached/:id`
Consultar intel cacheada sin llamar a Gemini.

**Response:** Intel object o `{ "confidence": "NOT_CACHED" }`

---

#### `GET /api/aircraft/intel/stats`
Estadísticas del cache de intel.

**Response:**
```json
{
  "cacheSize": 142,
  "hitRate": 0.73,
  "memoryUsage": "2.1 MB"
}
```

---

### Historial (requiere Supabase)

#### `GET /api/history/trail/:entityId`
Trail de posiciones de una entidad.

| Param | Default | Máx |
|-------|---------|-----|
| `hours` | 24 | 336 (14d) |

**Response:** `Array<Position>` ordenado cronológicamente
```json
[
  {
    "entity_id": "ae0413",
    "entity_type": "aircraft",
    "callsign": "FORTE12",
    "lat": 45.1,
    "lon": 33.4,
    "altitude": 16000,
    "heading": 270,
    "speed": 320,
    "flag": "US",
    "sampled_at": "2026-03-11T06:00:00Z"
  }
]
```

---

#### `GET /api/history/alerts`
Alertas archivadas.

| Param | Default | Descripción |
|-------|---------|-------------|
| `hours` | 48 | Ventana temporal |
| `severity` | — | Filtro: `critical`, `high`, `medium`, `low` |
| `limit` | 200 | Máximo resultados |

**Response:** `Array<ArchivedAlert>`

---

#### `GET /api/history/stats`
Estadísticas diarias agregadas.

| Param | Default |
|-------|---------|
| `days` | 14 |

**Response:**
```json
[
  {
    "date": "2026-03-11",
    "aircraft_count": 47,
    "ship_count": 23,
    "alert_count": 12,
    "conflict_count": 89,
    "news_count": 45,
    "critical_alerts": 3
  }
]
```

---

#### `GET /api/history/entities`
Entidades distintas vistas en la ventana temporal.

| Param | Default |
|-------|---------|
| `type` | `aircraft` |
| `hours` | 24 |

**Response:** `Array<Entity>` con última posición conocida

---

#### `GET /api/history/conflicts`
Eventos de conflicto archivados.

| Param | Default | Descripción |
|-------|---------|-------------|
| `hours` | 48 | Ventana temporal |
| `source` | — | Filtro: `NASA FIRMS`, `GDELT-GEO`, `ACLED`, `ReliefWeb` |

**Response:** `Array<ConflictEvent>`

---

#### `GET /api/history/news`
Noticias archivadas.

| Param | Default |
|-------|---------|
| `hours` | 48 |
| `source` | — (filtro opcional) |

**Response:** `Array<NewsItem>`

---

#### `GET /api/history/insights`
Análisis AI archivados (Gemini threat assessments).

| Param | Default |
|-------|---------|
| `limit` | 20 |

**Response:**
```json
[
  {
    "threat_level": "HIGH",
    "summary": "Escalation detected in eastern Ukraine...",
    "hotspots": [
      { "location": "Donetsk", "lat": 48.0, "lon": 37.8, "reason": "Sustained artillery" }
    ],
    "recommendations": ["Monitor FORTE flights", "Watch Black Sea fleet movement"],
    "model": "gemini-1.5-flash",
    "analyzed_at": "2026-03-11T08:00:00Z"
  }
]
```

---

### Analytics (Supabase RPC + JS fallback)

Todos aceptan `hours` como query param. Máximo lookback: 336h (14 días).
Si las funciones RPC de migración 005 están instaladas se ejecutan en PostgreSQL; si no, el backend calcula en JavaScript.

| Endpoint | Default hours | Response |
|----------|--------------|----------|
| `GET /api/analytics/fleet` | 24 | `[{ entity_type, flag, count }]` — Flota por país |
| `GET /api/analytics/aircraft-types` | 24 | `[{ aircraft_type, count }]` — Tipos de aeronave |
| `GET /api/analytics/hourly-activity` | 48 | `[{ hour, aircraft_count, ship_count }]` — Actividad por hora |
| `GET /api/analytics/top-entities` | 24 | `[{ entity_id, entity_type, callsign, name, flag, snapshot_count }]` — Más rastreados |
| `GET /api/analytics/altitude` | 24 | `[{ bucket, count }]` — Distribución de altitud |
| `GET /api/analytics/speed` | 24 | `[{ bucket, entity_type, count }]` — Distribución de velocidad |
| `GET /api/analytics/conflicts-by-zone` | 72 | `[{ zone, count }]` — Conflictos por zona |
| `GET /api/analytics/conflicts-by-type` | 72 | `[{ event_type, count }]` — Conflictos por tipo |
| `GET /api/analytics/news-by-source` | 72 | `[{ source, count }]` — Noticias por fuente |
| `GET /api/analytics/alerts-by-severity` | 72 | `[{ severity, count }]` — Alertas por severidad |

`/api/analytics/top-entities` acepta también `limit` (default 50).

---

### Admin

#### `POST /api/admin/tweet`
Lanza tweet de la alerta crítica más reciente.

**Headers:** `X-Admin-Secret` (obligatorio, debe coincidir con `ADMIN_SECRET` env)

**Response:** `{ "ok": true, "tweeted": "Heavy airstrikes near Kherson" }`

---

## WebSocket (Socket.io)

Conexión: `io("https://<host>", { transports: ["websocket", "polling"] })`

### Eventos Server → Client

| Evento | Frecuencia | Payload |
|--------|-----------|---------|
| `server_info` | Al conectar | `{ geminiEnabled: boolean }` |
| `aircraft_update` | ~30s (si cambió) | `{ aircraft: Aircraft[], timestamp }` |
| `ship_update` | ~60s (si cambió) | `{ ships: Ship[], timestamp }` |
| `news_update` | ~5min (si cambió) | `{ news: NewsItem[], timestamp }` |
| `conflict_update` | ~10min (si cambió) | `{ conflicts: ConflictEvent[], timestamp }` |
| `danger_update` | Al cambiar alertas | `{ dangerZones: DangerZone[], alerts: Alert[], hotspots: Hotspot[] }` |
| `ai_insight` | ~30min (cooldown 60min) | `{ threatLevel, summary, hotspots[], recommendations[], model, timestamp }` |
| `history_data` | On request | `{ snapshots: Snapshot[], range: { start, end } }` |

Solo se emiten si los datos cambiaron (hash comparison) para evitar tráfico duplicado.

### Eventos Client → Server

| Evento | Payload | Throttle | Respuesta |
|--------|---------|----------|-----------|
| `request_data` | `{ since?: { aircraft?, ships?, news?, conflicts? } }` | 5s | Emite updates si hay datos nuevos |
| `request_history` | — | 10s | `history_data` |

---

## Base de datos (Supabase PostgreSQL)

### Tablas

| Tabla | Migración | Descripción |
|-------|-----------|-------------|
| `alert_archive` | 001 | Alertas históricas |
| `position_snapshots` | 001 + 002 | Posiciones de aeronaves y buques |
| `daily_stats` | 001 | Estadísticas diarias agregadas |
| `conflict_events` | 004 | Eventos de conflicto geolocalizados |
| `news_archive` | 004 | Noticias archivadas |
| `ai_insights` | 004 | Análisis AI (Gemini) |

### Funciones RPC (Migración 005)

| Función | Descripción |
|---------|-------------|
| `analytics_fleet_composition(p_hours)` | Flota por bandera/tipo |
| `analytics_aircraft_types(p_hours)` | Tipos de aeronave |
| `analytics_hourly_activity(p_hours)` | Actividad por hora |
| `analytics_top_entities(p_hours, p_limit)` | Entidades más rastreadas |
| `analytics_altitude_distribution(p_hours)` | Buckets de altitud |
| `analytics_speed_distribution(p_hours)` | Buckets de velocidad |
| `analytics_conflicts_by_zone(p_hours)` | Conflictos por zona geográfica |
| `analytics_conflicts_by_type(p_hours)` | Conflictos por tipo de evento |
| `analytics_news_by_source(p_hours)` | Noticias por fuente |
| `analytics_alerts_by_severity(p_hours)` | Alertas por severidad |

### Migraciones

Ejecutar en orden en el SQL Editor de Supabase:

1. `001_initial.sql` — Tablas base (alert_archive, position_snapshots, daily_stats)
2. `002_enhance_snapshots.sql` — Columnas extendidas en position_snapshots
3. `003_dedup_indexes.sql` — Índices de deduplicación
4. `004_conflicts_news_insights.sql` — Tablas de conflictos, noticias, AI insights
5. `005_analytics_functions.sql` — 10 funciones RPC para analytics

---

## Ciclos de polling

| Datos | Intervalo | Evento WebSocket | Persistencia |
|-------|----------|-----------------|--------------|
| Aircraft | 30s | `aircraft_update` | Supabase snapshots (10min throttle) |
| Ships | 60s | `ship_update` | Supabase snapshots (10min throttle) |
| News | 5min | `news_update` + `danger_update` | Supabase news_archive |
| Conflicts | 10min | `conflict_update` | Supabase conflict_events |
| AI Analysis | 30min (60min cooldown) | `ai_insight` | Supabase ai_insights |
| History Save | 5min | — | Disco (ring buffer) |
| Purge snapshots | 24h | — | Elimina snapshots > 14 días |

---

## Servicios backend

| Módulo | Descripción |
|--------|-------------|
| `opensky.js` | Fetch aeronaves militares (ADS-B multi-source) |
| `vesselFinder.js` | Fetch buques militares (AIS multi-source) |
| `newsService.js` | Agregador de noticias (GDELT, NewsAPI, RSS) |
| `conflictService.js` | Eventos de conflicto geolocalizados (GDELT, FIRMS, ACLED, ReliefWeb) |
| `firmsService.js` | Anomalías térmicas NASA FIRMS (VIIRS) |
| `aiDanger.js` | Análisis local (rule-based) + Gemini AI |
| `aiAircraftIntel.js` | Identificación de aeronaves por Gemini |
| `carrierAirWing.js` | Detección de operaciones portaaviones |
| `supabaseStore.js` | Persistencia histórica + analytics |
| `positionTracker.js` | Ring buffer en memoria para timeline replay |
| `militaryMMSI.js` | Catálogo estático de MMSI militares |
| `diskCache.js` | Cache en disco para datos entre reinicios |
