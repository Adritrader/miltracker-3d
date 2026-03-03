# MILTRACKER 3D

**Real-time military aircraft, warship, and conflict event tracking on a 3D globe.**

![Stack](https://img.shields.io/badge/React-18-blue) ![CesiumJS](https://img.shields.io/badge/CesiumJS-1.115-green) ![Node.js](https://img.shields.io/badge/Node.js-20+-brightgreen) ![License](https://img.shields.io/badge/License-MIT-yellow)

---

## Features

| Layer | Description |
|-------|-------------|
| **3D Globe** | CesiumJS + Resium on a CartoDB Dark Matter base map — no API key required |
| **Live Aircraft** | Real military ADS-B via `adsb.lol` (primary) → `adsb.fi` → `airplanes.live` (fallbacks). Zero fake data, 100–300 aircraft at any time |
| **Aircraft Trails** | 40-point fading trajectory history per aircraft (~20 min at 30s poll). PolylineGlow material |
| **Live Ships** | Warships via VesselFinder scraper. Heading-aware top-down hull icons |
| **Conflict Events** | Geolocated conflict incidents: airstrikes, missiles, explosions, artillery, drones, naval, troops. Canvas-drawn military symbols — no emojis |
| **Live News** | GDELT API (free, no key). Articles geocoded from headline keywords and placed on the globe as map pins |
| **Entity Popup** | Detailed panel for any selected entity: aircraft reg/type/altitude/speed, ship details, conflict event with severity, news with source link |
| **Disk Cache** | All data persists to `backend/data/*.cache.json`. Globe loads instantly on server restart without waiting for API polls |
| **HUD Interface** | Military dark theme. Layer toggles, country filter, live event counts, animated ACTIVE SCAN radar indicator |

---

## Data Sources

All sources are **free and require zero registration**.

| Source | Data | Poll interval |
|--------|------|---------------|
| [adsb.lol/v2/mil](https://api.adsb.lol/v2/mil) | Military aircraft (ADS-B) | 30s |
| [adsb.fi/v2/mil](https://opendata.adsb.fi/api/v2/mil) | Military aircraft fallback | 30s |
| [airplanes.live/v2/mil](https://api.airplanes.live/v2/mil) | Military aircraft fallback | 30s |
| [VesselFinder](https://www.vesselfinder.com) | Warships | 60s |
| [GDELT GEO API](https://api.gdeltproject.org/api/v2/geo) | Geolocated conflict events | 10min |
| [GDELT DOC API](https://api.gdeltproject.org/api/v2/doc) | News articles (geocoded) | 10min / 5min |

### Optional API keys (`backend/.env`)

| Key | Purpose | Where to get |
|-----|---------|-------------|
| `CESIUM_ION_TOKEN` | High-res satellite imagery | [ion.cesium.com](https://ion.cesium.com) — 1 GB/mo free |
| `GEMINI_API_KEY` | AI threat analysis | [aistudio.google.com](https://aistudio.google.com/app/apikey) — 1500 req/day free |
| `NEWSAPI_KEY` | Additional news feed | [newsapi.org](https://newsapi.org/register) — 100 req/day free |

> The app runs fully without any keys. CartoDB tiles are used by default.

---

## Quick Start

### Prerequisites
- Node.js 20+

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment (optional)

```bash
copy backend\.env.example backend\.env
# Edit backend/.env to add optional API keys
```

### 3. Start backend

```bash
cd backend
node server.js
# Listening on http://localhost:3001
```

### 4. Start frontend (new terminal)

```bash
cd frontend
npm run dev
# Opens at http://localhost:5173
```

---

## Project Structure

```
miltracker-3d/
├── backend/
│   ├── server.js                  # Express + Socket.io, polling intervals, REST endpoints
│   ├── data/                      # Disk cache (auto-created)
│   │   ├── aircraft.cache.json
│   │   ├── ships.cache.json
│   │   ├── news.cache.json
│   │   └── conflicts.cache.json
│   └── services/
│       ├── opensky.js             # ADS-B military aircraft (adsb.lol / adsb.fi / airplanes.live)
│       ├── vesselFinder.js        # Warship AIS scraper
│       ├── newsService.js         # GDELT news + geocoding
│       ├── conflictService.js     # GDELT conflict events + keyword geocoding + seed dataset
│       ├── aiDanger.js            # Rule-based alerts + optional Gemini AI
│       └── diskCache.js           # Read/write JSON cache to disk
└── frontend/
    └── src/
        ├── App.jsx                # Root: state, layer wiring, filter logic
        ├── components/
        │   ├── Globe3D.jsx            # CesiumJS viewer, visual settings, postRender overlay
        │   ├── AircraftLayer.jsx      # Aircraft billboards + fading trail polylines
        │   ├── ShipLayer.jsx          # Ship billboards
        │   ├── ConflictLayer.jsx      # Conflict event icons (canvas-drawn military symbols)
        │   ├── NewsLayer.jsx          # Geolocated news pins
        │   ├── DangerZoneLayer.jsx    # Conflict zone proximity circles
        │   ├── newsGeocoder.js        # Client-side headline → coordinate lookup
        │   ├── EntityPopup.jsx        # Detail panel (click any entity)
        │   ├── FilterPanel.jsx        # Layer toggles, country filter, status grid
        │   ├── AlertPanel.jsx         # Threat board
        │   └── NewsPanel.jsx          # News ticker
        ├── hooks/
        │   ├── useRealTimeData.js     # Socket.io state management
        │   └── useCesiumEntities.js
        └── utils/
            ├── icons.js               # SVG aircraft / ship / news billboard generators
            ├── geoUtils.js            # Distance, coordinate helpers
            └── militaryFilter.js      # Country detection, aircraft type lookup, ICAO→flag
```

---

## Data Flow

```
adsb.lol ─────────────[30s]───┐
adsb.fi  ─────────────[30s]───┤  (fallback chain, first success wins)
airplanes.live ────────[30s]───┤
VesselFinder ──────────[60s]───┼──► Node.js Backend ──[Socket.io]──► React Frontend
GDELT Conflicts ───────[10min]─┤       │                                    │
GDELT News ────────────[5min]──┘       ├──[saveCache]──► disk *.cache.json  │
                                       └──[loadCache]──► served on startup  ▼
                                                                     CesiumJS Globe
                                                                     (Resium + Cesium 1.115)
```

---

## Conflict Events

Active hotspots covered in the baseline seed dataset (always shown, supplemented by live GDELT data):

- **Iran / IRGC** — ballistic missile tests, drone ops over Hormuz, proxy forces
- **Yemen / Houthis** — Red Sea anti-ship missiles, UAV attacks, coalition airstrikes
- **Iraq** — rocket attacks on bases, IED incidents, PMF drone strikes
- **Syria** — Israeli airstrikes on Iranian assets, Idlib front, Deir ez-Zor
- **Israel / Gaza / Lebanon** — IDF airstrikes, Hamas rockets, Hezbollah activity
- **UAE / Kuwait / Saudi Arabia** — Houthi missile/drone intercepts over Abu Dhabi, Dubai, Kuwait City, Riyadh
- **Ukraine / Russia** — artillery, ballistic missiles, drone swarms, cruise missiles
- **Taiwan Strait** — PLA Navy exercises, PLAAF median-line crossings
- **Red Sea / Hormuz** — Houthi anti-ship attacks, IRGC naval interdiction

### Conflict icon legend

| Symbol | Event type |
|--------|-----------|
| Delta-wing silhouette | AIRSTRIKE |
| Rocket body with fins | MISSILE |
| 8-spike starburst | EXPLOSION |
| Cannon with spoked wheel | ARTILLERY |
| X-frame quadrotor | DRONE |
| Top-down warship hull | NAVAL |
| NATO infantry box (×) | TROOPS |
| Warning diamond | CONFLICT |

Outer ring colour = severity: red (CRITICAL) → orange (HIGH) → amber (MEDIUM) → yellow (LOW).

---

## Controls

| Action | Input |
|--------|-------|
| Rotate globe | Left-click + drag |
| Zoom | Scroll wheel |
| Tilt | Right-click + drag |
| Select entity | Left-click on any icon |
| Fly to entity | "FLY TO" button in popup |
| Toggle layers | Filter panel (top-left) |
| Filter by country | Dropdown in filter panel |

---

## Disclaimer

This tool displays only **publicly broadcast** ADS-B and AIS transponder signals. Military vessels routinely disable transponders during operations — the absence of an aircraft or ship does not imply it is not present. Data is for situational awareness and educational purposes only.

---

## License

MIT


---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🌍 **3D Globe** | CesiumJS + Resium, satellite imagery, full rotation & zoom |
| ✈️ **Live Aircraft** | Military ADS-B via OpenSky Network (free, 100–400 req/hr) |
| ⚓ **Live Ships** | Warships via Norwegian AIS open data + curated demo fleet |
| 📰 **Live News** | GDELT API (free, geolocated) + NewsAPI — marked on the map |
| 🤖 **AI Analysis** | Google Gemini free tier — threat assessment every 5 min |
| 🚨 **Danger Zones** | 12 conflict zones with real-time proximity alerts |
| 🎛️ **HUD UI** | Military dark theme, layer toggles, country filter |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm 9+

### 1. Clone / navigate to project
```bash
cd miltracker-3d
```

### 2. Copy environment files
```bash
# Backend
copy backend\.env.example backend\.env

# Frontend
copy frontend\.env.example frontend\.env
```

### 3. Install dependencies
```bash
# Install all
cd backend && npm install
cd ../frontend && npm install
```

### 4. (Optional) Add free API keys to backend/.env

| Key | Where to get | Free tier |
|-----|-------------|-----------|
| `CESIUM_ION_TOKEN` | [ion.cesium.com](https://ion.cesium.com) | 1GB/mo satellite tiles |
| `GEMINI_API_KEY` | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) | 1500 req/day AI |
| `NEWSAPI_KEY` | [newsapi.org/register](https://newsapi.org/register) | 100 req/day news |
| `OPENSKY_USER` / `OPENSKY_PASS` | [opensky-network.org/register](https://opensky-network.org/register) | 400 req/hr aircraft |

> ⚠️ **The app works without any keys** — uses OpenStreetMap tiles, public AIS, GDELT news, and demo ship data.

### 5. Start backend
```bash
cd backend
npm run dev
# Runs on http://localhost:3001
```

### 6. Start frontend (new terminal)
```bash
cd frontend
npm run dev
# Opens at http://localhost:5173
```

---

## 🗂️ Project Structure

```
miltracker-3d/
├── backend/
│   ├── server.js              # Express + Socket.io server
│   ├── services/
│   │   ├── opensky.js         # Aircraft ADS-B (OpenSky Network)
│   │   ├── vesselFinder.js    # Ships (Norwegian AIS + demo data)
│   │   ├── newsService.js     # GDELT + NewsAPI
│   │   └── aiDanger.js        # Rule-based alerts + Gemini AI
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx            # Main assembly
    │   ├── components/
    │   │   ├── Globe3D.jsx       # CesiumJS 3D globe
    │   │   ├── AircraftLayer.jsx # Aircraft markers
    │   │   ├── ShipLayer.jsx     # Ship markers
    │   │   ├── DangerZoneLayer.jsx # Conflict zone circles
    │   │   ├── NewsLayer.jsx     # News pins on globe
    │   │   ├── EntityPopup.jsx   # Detail panel (bottom-right)
    │   │   ├── FilterPanel.jsx   # Controls (top-left)
    │   │   ├── AlertPanel.jsx    # Threat board (top-right)
    │   │   └── NewsPanel.jsx     # News ticker (bottom)
    │   ├── hooks/
    │   │   ├── useRealTimeData.js  # WebSocket hook
    │   │   └── useCesiumEntities.js
    │   └── utils/
    │       ├── icons.js           # SVG billboards
    │       ├── geoUtils.js        # Distance, format helpers
    │       └── militaryFilter.js  # Filter logic
    └── package.json
```

---

## 🔌 Data Flow

```
OpenSky API ──[REST/15s]──┐
Norwegian AIS ─[REST/60s]─┤
GDELT API ────[REST/5min]──┤──► Node.js Backend ──[WebSocket]──► React Frontend
NewsAPI ──────[REST/5min]──┘         │                               │
                                     └─[Gemini AI]──► AI Insights ──►│
                                      Rule-based alerts ─────────────►│
                                                                       ▼
                                                               CesiumJS Globe
```

---

## 🎮 Controls

| Action | Control |
|--------|---------|
| Rotate globe | Left-click + drag |
| Zoom | Scroll wheel |
| Tilt | Right-click + drag |
| Select entity | Left-click on icon |
| Fly to entity | Click "📍 FLY TO" in popup |
| Toggle layers | Filter panel (top-left) |
| View news | Click news ticker (bottom) |

---

## 📊 API Rate Limits (Free Tier)

| API | Limit | Interval |
|-----|-------|----------|
| OpenSky (anon) | 100 req/hr | Poll every 15s |
| OpenSky (account) | 400 req/hr | Poll every 15s |
| GDELT | Unlimited | Poll every 5min |
| NewsAPI | 100 req/day | Poll every 5min |
| Gemini Flash | 1500 req/day | On news update |

---

## ⚠️ Disclaimer

This tool displays **publicly broadcast** ADS-B and AIS signals only. Military vessels may disable transponders at any time. Data is for educational and demonstration purposes only.

---

## 📜 License

MIT — Free to use, modify, and distribute.
