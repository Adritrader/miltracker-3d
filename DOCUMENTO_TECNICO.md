# MILTRACKER 3D — Documento Técnico, Ejecutivo y de Negocio

> Versión 2.1 · 6 de marzo de 2026  
> Estado de producción: **LIVE** — Railway (backend) + Vercel (frontend)  
> Repositorio: `github.com/Adritrader/miltracker-3d`  
> Último commit: `bb6064f` — 15 bugs corregidos · auditoría completa en `AUDIT.md`

---

## RESUMEN EJECUTIVO

**MilTracker 3D** es una plataforma de inteligencia de situación militar en tiempo real que visualiza aeronaves militares, buques de guerra, eventos de conflicto activo, alertas de IA y noticias geoespaciales sobre un globo 3D interactivo. Agrega y correlaciona datos de múltiples fuentes públicas actualizando cada 30 segundos la actividad militar mundial.

La plataforma opera con **coste operativo próximo a cero** (infraestructura gratuita, fuentes abiertas) y está lista para producción: backend en Railway, frontend en Vercel, CI/CD automático desde GitHub.

### Diferenciación competitiva

| | MilTracker 3D | Flightradar24 / MarineTraffic | Global Conflict Tracker (CFR) | LiveUAMaps |
|---|---|---|---|---|
| **Foco** | Exclusivamente militar/defensa | Civil + militar mezclado | Texto estático | Mapas 2D básicos |
| **Correlación multicapa** | Aeronaves + Buques + Conflictos + Noticias + IA | Datos en silos | Sin datos live | Sin ADS-B/AIS |
| **Globo 3D** | CesiumJS, altitud real de vuelo, rotación libre | Vista 2D | Sin mapa interactivo | 2D Leaflet |
| **IA de amenazas** | Análisis de proximidad + Gemini | Sin IA de alerta | Sin IA | Sin IA |
| **Replay histórico** | 1h+ navegable con controles de vídeo | Parcial (pago) | Sin replay | Sin replay |
| **SITREP** | Captura + vídeo cinético compartible | Sin captura | Sin captura | Sin captura |
| **Coste operativo** | ~0–5 USD/mes | Miles USD/mes en datos | — | — |

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
│  ├── NASA FIRMS thermal anomalies (incendios / hotspots activos)           │
│  ├── Position tracker: ring buffer 120 snapshots (~1h historial)           │
│  ├── AI risk engine: reglas de proximidad + Gemini (opcional)              │
│  ├── Disk cache: *.cache.json async (non-blocking, arranque instantáneo)   │
│  ├── Rate limiting: HTTP (express-rate-limit) + WS por socket (5s/10s)     │
│  ├── Jitter geocodificación: determinista (hash Knuth, no Math.random)     │
│  └── CORS: producción solo orígenes allowlist / dev abierto                │
│                              │ Socket.io (delta only si hash cambia)       │
└──────────────────────────────┼───────────────────────────────────────────┘
                               │ WebSocket (Socket.io)
                               ▼
┌─────────────────── FRONTEND (React 18 + Vite) ───────────────────────────┐
│  CesiumJS 1.115 + Resium 1.17                                              │
│  ├── AircraftLayer — billboards SVG + trails PolylineGlow (40 pts)        │
│  ├── ShipLayer — billboards SVG orientados por heading real               │
│  ├── ConflictLayer — símbolos militares Canvas (sin emoji)                │
│  ├── NewsLayer — clusters geoespaciales zoom-aware                        │
│  ├── DangerZoneLayer — círculos de zona de conflicto activo               │
│  ├── MilitaryBasesLayer — bases militares mundiales (~200 bases)          │
│  ├── FilterPanel — toggles, país, misión, alianza, FIRMS                 │
│  ├── AlertPanel — CRITICAL threats + SITREP + AI Intel tabs               │
│  ├── TrackingPanel — seguimiento multi-entidad en tiempo real             │
│  ├── TimelinePanel — replay histórico con controles de vídeo             │
│  ├── SitrepCapture — captura PNG / vídeo cinético MP4/WebM + social share │
│  └── CoordinateHUD — barra lat/lon + contadores live                     │
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
| Compresión | compression (gzip) | — |
| Rate limiting | express-rate-limit | — |
| Variables de entorno | dotenv | — |
| Caché en disco | JSON nativo (`fs`) | — |

### Frontend

| Componente | Tecnología | Versión |
|---|---|---|
| UI framework | React | 18.x |
| Build tool | Vite | 5.x |
| 3D Globe engine | CesiumJS + Resium | 1.115 / 1.17 |
| Estilos | Tailwind CSS | 3.x |
| WebSocket client | socket.io-client | 4.x |

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

| Fuente | Endpoint | Intervalo | Método |
|---|---|---|---|
| **adsb.lol** (primario) | `api.adsb.lol/v2/mil` | 30s | REST JSON |
| **adsb.fi** (fallback 1) | `opendata.adsb.fi/api/v2/mil` | 30s | REST JSON |
| **airplanes.live** (fallback 2) | `api.airplanes.live/v2/mil` | 30s | REST JSON |

Cadena de fallback automática. Si todas fallan, se sirven datos del disco cache.  
**Limitación:** Los aparatos pueden desactivar transponder en operaciones sensibles.

### 3.2 Buques de guerra — AIS

| Fuente | Método | Intervalo |
|---|---|---|
| VesselFinder scraper | HTML parsing | 60s |

Identificación militar por lista MMSI curada (`militaryMMSI.js`).

### 3.3 Eventos de conflicto

Store en memoria (Map por ID, TTL 72h, sin duplicados por hash título+fecha).

| Fuente | Tipo | Intervalo |
|---|---|---|
| GDELT GEO 2.0 | Geolocated events | 10min |
| GDELT DOC 2.0 | News articles | 5min |
| Dataset semilla interno | 90+ eventos baseline | Estáticos |

### 3.4 Anomalías térmicas (NASA FIRMS)

- Clave gratuita: `FIRMS_MAP_KEY` (NASA Earthdata)
- Resolución VIIRS 375m / MODIS 1km
- Filtro por Fire Radiative Power calibrado por región

---

## 4. FUNCIONALIDADES PRINCIPALES (estado marzo 2026)

| Funcionalidad | Estado | Notas |
|---|---|---|
| Globo 3D interactivo (CesiumJS) | ✅ Live | 6 basemaps: Dark, Sat, Relief, Street, Light, Night |
| Aeronaves militares en tiempo real | ✅ Live | ADS-B, hasta 300 entidades, trails de vuelo |
| Buques de guerra en tiempo real | ✅ Live | AIS, heading real, identificación MMSI |
| Eventos de conflicto geolocalizados | ✅ Live | GDELT + seed dataset, 72h TTL, IDs deduplicados |
| Noticias militares con geocodificación | ✅ Live | Clusters zoom-aware, 70+ ubicaciones de conflicto |
| Zonas de peligro (DangerZones) | ✅ Live | Círculos color-coded por severidad |
| Bases militares mundiales | ✅ Live | ~200 bases globales |
| Intel Alerts (reglas de proximidad) | ✅ Live | CRITICAL / HIGH / MED / LOW |
| SITREP automático | ✅ Live | Resumen táctico generado de datos live |
| AI Intel (Gemini 1.5 Flash) | ✅ Live | Opcional vía GEMINI_API_KEY |
| Replay histórico | ✅ Live | 120 snapshots × 30s = ~1h, velocidades 1×–120× |
| Tracking multi-entidad | ✅ Live | Seguimiento simultáneo de aviones y barcos |
| Filtros avanzados | ✅ Live | País, alianza, tipo de misión, FIRMS; toggle conflictos corregido |
| SITREP Capture | ✅ Live | PNG + vídeo cinético MP4/WebM, social share |
| Share de vista | ✅ Live | URL con parámetros de cámara, copia al portapapeles |
| Notificaciones push | ✅ Live | Browser push para alertas CRITICAL |
| NASA FIRMS (incendios/hotspots) | ✅ Live | Precisa clave gratuita NASA Earthdata |
| Búsqueda de entidades | ✅ Live | Por callsign, nombre, tipo |
| Modo space view | ✅ Live | Vista desde órbita |
| Rate limiting WebSocket | ✅ Live | Cooldown por socket: 5s datos, 10s historial |
| Cache persistente async | ✅ Live | Escritura no bloqueante, cache coherente en restart |

---

## 5. MOTOR DE ALERTAS IA

### 5.1 Reglas locales (sin API externa)

1. **Proximidad aeronave–zona de conflicto** (< 200 km)
2. **Proximidad buque–zona de conflicto** (< 300 km)
3. **Evento de alta severidad reciente** (< 30 min)
4. **Alertas desde noticias** por keywords en headlines geocodificados

### 5.2 Gemini AI (opcional)

Si `GEMINI_API_KEY` configurada: envía resumen táctico a Gemini 1.5 Flash. Devuelve insight JSON (`{ summary, threats[], recommendations[] }`). Mostrado en AlertPanel → tab "AI Intel".

---

## 6. SISTEMA DE REPLAY HISTÓRICO

`positionTracker.js` guarda un snapshot cada 30s (ring buffer 120 posiciones):

- Reproducir a 1×, 5×, 20×, 60× o 120× velocidad real
- Scrubbing manual en barra de progreso
- Ver trails históricos hasta el frame actual
- STOP → regresa automáticamente al modo live

---

## 7. DEPLOYMENT

### Backend — Railway

| Variable | Descripción | Obligatorio |
|---|---|---|
| `NODE_ENV` | `production` (CORS restrictivo) | Sí |
| `FIRMS_MAP_KEY` | NASA Earthdata (gratuita) | Recomendado |
| `GEMINI_API_KEY` | Google AI Studio (gratuita hasta 1M tokens/día) | Opcional |
| `ALLOWED_ORIGIN` | Origen Vercel extra | Recomendado |

### Frontend — Vercel

| Variable | Valor |
|---|---|
| `VITE_BACKEND_URL` | `https://tu-backend.railway.app` |
| `VITE_CESIUM_ION_TOKEN` | Opcional (mejora terrain tiles) |

---

## 8. RENDIMIENTO

| Métrica | Valor |
|---|---|
| Aeronaves simultáneas en pantalla | 100–300 |
| Frecuencia de actualización live | 30s |
| Uso de memoria frontend (~200 entidades) | ~180 MB |
| Tamaño bundle frontend (gzip) | ~8 MB (CesiumJS domina) |
| Primera carga (cold) | ~3–5s |
| Carga con cache caliente | < 1s |
| Framerate globo (Chrome/Edge) | 55–60 fps |
| Latencia socket backend→frontend | < 50ms (Railway EU) |
| Cooldown rate-limit WebSocket (request_data) | 5s por socket |
| Cooldown rate-limit WebSocket (request_history) | 10s por socket |
| Bloqueado event loop en escritura de cache | 0ms (async writeFile) |

> **Optimizaciones identificadas pendientes de implementar** (ver `AUDIT.md` §10): throttle de MOUSE_MOVE (O1), debounce en búsqueda (O2), `React.memo` en componentes estáticos (O6), batching paralelo de queries GDELT (O7), límite de tamaño en `conflictStore` (O15). Ver desglose completo en la auditoría.

---

## 9. COBERTURA GEOPOLÍTICA

| Región | Eventos monitorizados |
|---|---|
| Ucrania/Rusia | Artillería, misiles balísticos, enjambres de drones, crucero |
| Israel/Gaza/Líbano | Airstrikes IDF, cohetes Hamas/Hezbollah, actividad IRGC |
| Yemen/Mar Rojo | Misiles antibuque Houthis, airstrikes coalición |
| Irak/Siria | Bases EEUU, drones PMF-IRGC, airstrikes israelíes |
| Irán | Pruebas misilísticas, actividad IRGC en Ormuz |
| Estrecho de Taiwán | Ejercicios PLAN, cruce línea media PLAAF |
| Mar de China Meridional | Incidentes navales, ejercicios anfibios |
| Sahel | Wagner/Rusia, ataques yihadistas Mali/Burkina/Níger |
| Ártico | Patrullas OTAN/Rusia, actividad submarina |

---

## 10. LIMITACIONES CONOCIDAS

1. Los buques militares desactivan AIS con frecuencia en operaciones activas
2. B-2, F-22, Su-57 en misión no emiten ADS-B
3. Eventos GDELT con 10–30 min de lag respecto a ocurrencia real
4. Geocodificación por keywords, no por NLP ni geocodificador semántico
5. 120 frames × 30s = ~60 min de historial (limitado por RAM; no persiste entre reinicios)
6. App pública sin autenticación (adecuado para datos públicos únicamente)
7. Barcos con AIS caído muestran posición de homeport del catálogo (marcado como limitación conocida)
8. `conflictStore` en memoria sin límite de tamaño máximo (ver `AUDIT.md` O15)

---

---

# PARTE II — VALORACIÓN Y MONETIZACIÓN

---

## 11. VALORACIÓN DEL PROYECTO

> *Valoración actualizada a marzo 2026. El proyecto ha pasado de MVP inicial a plataforma auditada y endurecida (v2.1): 15 bugs corregidos, seguridad reforzada, cache asíncrono, rate limiting, auditoría completa de 51 issues documentada. El contexto geopolítico global (Ucrania, Gaza/Líbano, Yemen, Strait of Taiwan, Sahel) favorece especialmente el caso de negocio.*

### 11.1 Comparativa con proyectos similares

| Proyecto | Descripción | Valoración / Estado |
|---|---|---|
| **Flightradar24** | Tracking aéreo civil + militar | ~1.500M USD |
| **MarineTraffic** | Tracking AIS naval | ~50–100M USD (Serie B, 2021) |
| **LiveUAMap** | Mapa 2D conflictos, sin datos live propios | ~2–5M USD estimado |
| **Orbital Insight** | Inteligencia geoespacial IA | ~200M USD (adquirido por Palantir, 2021) |
| **Hawkeye 360** | Inteligencia señales RF + geoespacial | ~100M USD (contratos DoD) |
| **Bellingcat** | OSINT investigativo, modelo donativo | ~2–5M USD estimado |
| **Maxar Intelligence** | Imágenes satelitales IA | ~6.400M USD (adquirido por Advent, 2023) |
| **Synthetaic** | Detección objetos militares en imagen satelital | ~100M USD (ronda Serie B, 2023, DoD contracts) |

MilTracker 3D combina tracking (Flightradar24), análisis de conflictos (LiveUAMap), inteligencia geoespacial con IA (Orbital Insight) y visualización 3D única, operando a coste próximo a cero. El contexto de rearme europeo y aumento del gasto en defensa hasta el 2–3% del PIB en países OTAN (2025–2026) amplia sustancialmente el mercado institucional.

### 11.2 Factores que mejoran la valoración respecto a v2.0

| Factor | Impacto en valoración |
|---|---|
| Auditoría técnica completa (`AUDIT.md`) documentada | +10–20% — demuestra madurez y control de deuda técnica |
| 15 bugs criticos/altos corregidos en una sesión | +5–10% — reduce riesgo para comprador/inversor |
| Rate limiting + validación de URLs + CORS restrictivo | +5–15% — infosec básico implementado (requisito para ventas B2B/gov) |
| Cache asíncrono + `setTimeout` recursivo | +5% — no hay riesgos de event loop en producción |
| Historial de commits limpio y mensajes descriptivos | +5% — buen indicador de proceso de desarrollo |
| 16 optimizaciones pendientes documentadas con fix propuesto | +5% — backlog ejecutable, no deuda oscura |

### 11.3 Valoración estimada por etapa

| Etapa | Condición para alcanzarla | Valoración estimada |
|---|---|---|
| **Actual (v2.1)** — MVP endurecido en producción, auditado, 0 revenue | Producto técnico demostrable, diferenciación clara, contexto geopolítico favorable | **40.000–120.000 USD** |
| **Dominio + primeros usuarios** — 1.000–10.000 usuarios/mes | Evidencia de product-market fit, dominio propio, analytics activos | **150.000–500.000 USD** |
| **Revenue inicial** — 2.000–5.000 USD/mes, un cliente B2B o 500 suscriptores | PMF incipiente con ingresos recurrentes | **600.000–1.800.000 USD** |
| **Crecimiento** — 20.000–50.000 USD/mes ARR, API pública, 2–3 clientes institucionales | Modelo de negocio probado y replicable | **2.500.000–10.000.000 USD** |
| **Scale** — >100K USD/mes ARR, contratos gobierno/defensa | Escalado real demostrado, clientes públicos | **15.000.000–60.000.000 USD** |

> **Valoración actual realista (marzo 2026):** El proyecto ha pasado de MVP a plataforma endurecida con auditoría y documentación completa. Una venta o entrada de inversión semilla hoy está entre **50.000–150.000 USD** (vs. 30.000–100.000 USD en v2.0). Con 6 meses de tracción demostrable (usuarios activos + primeros ingresos) ese número escala a **400.000–1.200.000 USD**. El entorno de seguridad europeo de 2025–2026 (rearme, OTAN al 2%+, Ucrania, Gaza) hace que el timing sea especialmente favorable.

---

## 12. ESCENARIOS DE MONETIZACIÓN

### Escenario A — Freemium B2C (SaaS consumer)

**Target:** Analistas OSINT, periodistas, investigadores, enthusiasts militares, estudiantes de RRII, ciudadanos con interés en geopolítica (audiencia consolidada en X/Twitter, Reddit, YouTube tras 2+ años de conflictos activos con alta cobertura mediática).

**Pricing sugerido:**

| Plan | Precio | Incluye |
|---|---|---|
| Free | 0 USD/mes | Globo 3D, datos live, historial 1h, hasta 10 alertas/día, 1 entidad rastreada |
| **Pro** | **9,99 USD/mes** | Sin límites, historial 24h, tracking ilimitado, SITREP exports PDF, notificaciones push, sin ads |
| **Analyst** | **29,99 USD/mes** | Todo Pro + API access REST, historial 7 días, exports CSV/JSON, alertas Telegram/email, acceso beta a features |
| **Team** | **79,99 USD/mes** | Hasta 5 usuarios, dashboards compartidos, webhooks, SLA soporte 48h |

**Proyección de ingresos (ARR):**

| Usuarios activos/mes | Conversión Free→Pro (2%) | Conversión Pro→Analyst (15%) | ARR estimado |
|---|---|---|---|
| 5.000 | 100 Pro | 15 Analyst | ~13.400 USD/año |
| 20.000 | 400 Pro | 60 Analyst | ~53.600 USD/año |
| 50.000 | 1.000 Pro | 150 Analyst | ~134.000 USD/año |
| 200.000 | 4.000 Pro | 600 Analyst | ~536.000 USD/año |

**Canales de adquisición (coste 0):**
- Reddit: r/OSINT, r/WarCollege, r/geopolitics, r/worldnews, r/ukraine, r/CredibleDefense
- Twitter/X: comunidades militares, analistas OSINT (@oryxspioenkop, @RALee85, @trenttelenko)
- Hacker News "Show HN" — alto ratio de primi pagadores entre audiencia tech
- YouTube: colaboración con canales de geopolítica (Perun, Task & Purpose, Foreign Policy)
- Newsletters: Bellingcat, The War Zone, Intel Today, War on the Rocks

**Timing favorable (marzo 2026):** La audiencia de seguimiento de conflictos en tiempo real creció 10x desde 2022 (Ucrania). Existe demanda probada.

**Inversión técnica necesaria:** Supabase Auth (gratuito) + Stripe (~4 semanas). Coste operativo adicional: ~5–10 USD/mes.

---

### Escenario B — B2B: API y widgets embebibles

**Target:** Medios de comunicación, think tanks, universidades, empresas de análisis de riesgo geopolítico.

**Productos:**

| Producto | Precio/mes | Target |
|---|---|---|
| **API REST básica** (aircraft, ships, alerts) | 149–599 USD | Newsletters defensa, medios digitales |
| **API REST Pro** (+ conflicts, historial 7d, webhooks) | 499–1.499 USD | Medios internacionales, think tanks |
| **Widget embebible** (globo 3D iframe configurable) | 299–1.499 USD | Periódicos (El País, Reuters, BBC Verify) |
| **Data feed WebSocket** (push en tiempo real) | 499–2.499 USD | Empresas análisis riesgo, hedge funds geopolíticos |
| **White-label** (plataforma completa con branding propio) | 2.500–10.000 USD | Contratistas defensa, consultoras estratégicas |

**Clientes potenciales — España:**
- El País / El Mundo / La Vanguardia / El Confidencial (sección internacional/defensa)
- Real Instituto Elcano, CIDOB, IEMED
- Indra Sistemas, GMV, Airbus España (división defensa)

**Clientes potenciales — Europa/Global:**
- Reuters, BBC Verify, Der Spiegel, Le Monde, Politico Europe
- IISS (International Institute for Strategic Studies), RUSI, Chatham House, ECFR
- Bellingcat, The War Zone, Defense One, Janes.com
- Control Risks, Kroll, Teneo, Sibylline (gestión de riesgo político)
- Departamentos de RRII y Ciencias Políticas (licencias educativas, 500–1.500 USD/año)

**Proyección ARR:**

| Clientes | Ticket medio | ARR |
|---|---|---|
| 3 clientes | 600 USD/mes | 21.600 USD/año |
| 10 clientes | 1.000 USD/mes | 120.000 USD/año |
| 30 clientes | 1.500 USD/mes | 540.000 USD/año |

**Ventaja competitiva en B2B:** Ningún competidor directo ofrece un widget 3D embebible para cobertura de conflictos con datos ADS-B/AIS live + IA integrada en formato SaaS a este precio.

---

### Escenario C — Contratos institucionales (defensa/gobierno)

**Target:** Organismos de gobierno, fuerzas armadas, servicios de inteligencia, contratistas de defensa. Mayor upside, mayor complejidad regulatoria y plazos de venta de 6–18 meses. El aumento del gasto en defensa europeo al 2–3% del PIB (2025–2026) crea presupuesto para herramientas OSINT que no requerían financiación previa.

**Tipos de contrato:**

| Tipo | Descripción | Rango de valor |
|---|---|---|
| **Herramienta OSINT interna** | Versión private-deploy on-premise o VPC | 25.000–100.000 USD/año |
| **Licencia de datos** | Feed ADS-B + AIS + conflictos normalizado | 15.000–60.000 USD/año |
| **Integración en sistemas C2** | Módulo embebido en plataformas de mando y control | 150.000–600.000 USD |
| **Soporte y mantenimiento** | SLA 99.9%, updates, soporte técnico dedicado | 20–30% del contrato base/año |
| **Consultoría de datos** | Enriquecimiento y análisis geoespacial específico | 200–400 USD/hora |

**Organismos target:**

*España/Europa:*
- CNI (Centro Nacional de Inteligencia)
- EMAD / MOPS (Mando de Operaciones)
- FRONTEX (vigilancia de fronteras, sede Varsovia)
- EUISS (EU Institute for Security Studies)
- NATO STRATCOM Centre of Excellence (Riga)
- EDA (European Defence Agency)

*Global:*
- RAND Corporation, CSIS, Brookings Institution, IISS
- L3Harris, BAE Systems, Thales, Indra, Leonardo (contratistas prime)
- Palantir, Anduril, SentinelOne (plataformas que podrían integrarlo)
- Departamentos de defensa OTAN (especialmente países limítrofes con Rusia o cuencas de conflicto)

**Nota regulatoria:** La herramienta opera solo con datos públicos OSINT — no requiere clasificación de seguridad para uso como herramienta open-source de análisis. Esto simplifica radicalmente el acceso a organismos que solo pueden usar datos no clasificados y acelera el ciclo de venta.

**Proyección:**

| Contratos | Valor medio | Ingresos año 1 |
|---|---|---|
| 1 contrato piloto | 30.000 USD | 30.000 USD |
| 3 contratos | 50.000 USD | 150.000 USD |
| 5 contratos + renovaciones | 90.000 USD | 450.000 USD |

---

### Escenario D — Publicidad contextual + patrocinios

Adecuado para monetizar tráfico de forma inmediata sin fricción, compatible con cualquier otro escenario.

| Canal | Formato | CPM estimado | Con 100K visitas/mes |
|---|---|---|---|
| Google AdSense | Display | 2–4 USD | 200–400 USD/mes |
| Carbon Ads | Texto contextual (tech/dev) | 3–6 USD | 300–600 USD/mes |
| **Patrocinio newsletter** | Mención curada | 500–2.000 USD/envío | Variable |
| **Sponsor de la app** | Branding "Powered by X" | 1.000–5.000 USD/mes | Negociable |

**Sponsors naturales:** VPNs (Mullvad, ProtonVPN), software de seguridad (Recorded Future, Flashpoint, Mandiant), medios especializados (JANES, Defense News, Politico Defense), servicios geoespaciales (Esri, Maxar, Planet Labs, Satellogic).

---

### Escenario E — Venta / Adquisición

**Compradores potenciales:**

| Tipo de comprador | Interés estratégico | Precio estimado hoy (v2.1) | Con tracción (6 meses) |
|---|---|---|---|
| **Grupo editorial** (defensa/internacional) | Widget diferenciador para coberturas de conflicto | 80.000–300.000 USD | 300.000–800.000 USD |
| **Empresa inteligencia geoespacial** (Recorded Future, Esri, Palantir) | Integrar capa de tracking + UI en producto existente | 150.000–700.000 USD | 700.000–2.500.000 USD |
| **Contratista defensa** (Indra, Thales, BAE, L3Harris, Leonardo) | Módulo listo para integrar en plataformas C2 | 200.000–800.000 USD | 700.000–2.500.000 USD |
| **PE fund / Family office** (govtech/security) | Inversión semilla + escalar | 400.000–1.200.000 USD (con traction) | — |
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
