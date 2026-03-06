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

### 11.1 Comparativa con proyectos similares

| Proyecto | Descripción | Valoración |
|---|---|---|
| **Flightradar24** | Tracking aéreo civil + militar | ~1.500M USD |
| **MarineTraffic** | Tracking AIS naval | ~50–100M USD (Serie B, 2021) |
| **LiveUAMap** | Mapa 2D conflictos, sin datos live propios | ~2–5M USD estimado |
| **Orbital Insight** | Inteligencia geoespacial IA | ~200M USD (adquirido por Palantir, 2021) |
| **Hawkeye 360** | Inteligencia señales RF + geoespacial | ~100M USD (contratos DoD) |
| **Bellingcat** | OSINT investigativo, modelo donativo | ~2–5M USD estimado |

MilTracker 3D combina tracking (Flightradar), inteligencia geoespacial (Orbital Insight) y visualización de conflictos (LiveUAMap), operando a coste próximo a cero.

### 11.2 Valoración estimada por etapa

| Etapa | Condición para alcanzarla | Valoración estimada |
|---|---|---|
| **Actual** — MVP live, 0 revenue, 0 usuarios registrados | Prototipo técnico completo en producción | **15.000–80.000 USD** |
| **Tracción temprana** — 1.000–10.000 usuarios/mes, dominio propio | Demo funcional con evidencia de uso real | **100.000–400.000 USD** |
| **Revenue inicial** — 2.000–5.000 USD/mes, un cliente B2B o 500 suscriptores | Product-market fit incipiente | **500.000–1.500.000 USD** |
| **Crecimiento** — 20.000–50.000 USD/mes ARR, API pública, 2–3 clientes institucionales | Modelo de negocio probado | **2.000.000–8.000.000 USD** |
| **Scale** — >100K USD/mes, contratos gobierno/defensa | Escalado real demostrado | **10.000.000–50.000.000 USD** |

> **Valoración actual realista:** Como proyecto técnico completamente funcional en producción con diferenciación real, una venta o entrada de inversión semilla hoy estaría entre **30.000–100.000 USD**. Con 6 meses de tracción demostrable (usuarios activos + primeros ingresos) ese número escala fácilmente a **300.000–1.000.000 USD**.

---

## 12. ESCENARIOS DE MONETIZACIÓN

### Escenario A — Freemium B2C (SaaS consumer)

**Target:** Analistas OSINT, periodistas, investigadores, enthusiasts militares, estudiantes de RRII.

**Pricing sugerido:**

| Plan | Precio | Incluye |
|---|---|---|
| Free | 0 USD/mes | Globo 3D, datos live, historial 1h, hasta 10 alertas/día |
| **Pro** | **9,99 USD/mes** | Sin límites, historial 24h, SITREP exports, notificaciones push, sin ads |
| **Analyst** | **29,99 USD/mes** | Todo Pro + API access REST, historial 7 días, exports CSV/JSON, alertas Telegram/email |

**Proyección de ingresos (ARR):**

| Usuarios activos/mes | Conversión Free→Pro (2%) | ARR |
|---|---|---|
| 5.000 | 100 usuarios Pro | ~12.000 USD/año |
| 20.000 | 400 usuarios Pro | ~48.000 USD/año |
| 50.000 | 1.000 usuarios Pro | ~120.000 USD/año |
| 200.000 | 4.000 usuarios Pro | ~480.000 USD/año |

**Canales de adquisición (coste 0):**
- Reddit: r/OSINT, r/WarCollege, r/geopolitics, r/worldnews
- Twitter/X: comunidades militares, analistas OSINT
- Hacker News "Show HN"
- Newsletters: Bellingcat, The War Zone, Intel Today

**Inversión técnica necesaria:** Supabase Auth (gratuito) + Stripe (~4 semanas de desarrollo). Coste operativo adicional: ~0 USD.

---

### Escenario B — B2B: API y widgets embebibles

**Target:** Medios de comunicación, think tanks, universidades, empresas de análisis de riesgo.

**Productos:**

| Producto | Precio/mes | Target |
|---|---|---|
| **API REST** (aircraft, ships, alerts, conflicts) | 99–499 USD | Newsletters seguridad, medios digitales |
| **Widget embebible** (globo 3D iframe configurable) | 199–999 USD | Periódicos (El País, Reuters, BBC Verify) |
| **Data feed WebSocket** (push en tiempo real) | 299–1.499 USD | Empresas análisis riesgo, hedge funds geopolíticos |
| **White-label** (plataforma completa con branding propio) | 2.000–8.000 USD | Contratistas defensa, consultoras estratégicas |

**Clientes potenciales — España:**
- El País / El Mundo / La Vanguardia (sección internacional/defensa)
- Real Instituto Elcano, CIDOB
- Indra Sistemas, GMV

**Clientes potenciales — Europa/Global:**
- Reuters, BBC Verify, Der Spiegel
- IISS (International Institute for Strategic Studies), RUSI, Chatham House
- Bellingcat, The War Zone, Defense One
- Control Risks, Kroll, Teneo (gestión de riesgo político)
- Departamentos de RRII y Ciencias Políticas (licencias educativas)

**Proyección ARR:**

| Clientes | Ticket medio | ARR |
|---|---|---|
| 3 clientes | 500 USD/mes | 18.000 USD/año |
| 10 clientes | 800 USD/mes | 96.000 USD/año |
| 30 clientes | 1.200 USD/mes | 432.000 USD/año |

---

### Escenario C — Contratos institucionales (defensa/gobierno)

**Target:** Organismos de gobierno, fuerzas armadas, servicios de inteligencia, contratistas de defensa. Mayor upside, mayor complejidad regulatoria y plazos de venta de 6–18 meses.

**Tipos de contrato:**

| Tipo | Descripción | Rango de valor |
|---|---|---|
| **Herramienta OSINT interna** | Versión private-deploy para analistas | 20.000–80.000 USD/año |
| **Integración en sistemas C2** | Módulo embebido en plataformas de mando y control | 100.000–500.000 USD |
| **Soporte y mantenimiento** | SLA, updates, soporte técnico dedicado | 15–30% del contrato base/año |
| **Consultoría de datos** | Enriquecimiento y análisis geoespacial específico | 150–300 USD/hora |

**Organismos target:**

*España/Europa:*
- CNI (Centro Nacional de Inteligencia)
- EMAD / MOPS (Mando de Operaciones)
- FRONTEX (vigilancia de fronteras)
- EUISS (EU Institute for Security Studies)
- NATO STRATCOM Centre of Excellence

*Global:*
- RAND Corporation, CSIS, Brookings Institution
- L3Harris, BAE Systems, Thales, Indra (contratistas prime)
- Palantir, SentinelOne (plataformas que podrían integrarlo)

**Nota regulatoria:** La herramienta opera solo con datos públicos OSINT — no requiere clasificación de seguridad para uso como herramienta open-source de análisis. Esto simplifica radicalmente el acceso a organismos que solo pueden usar datos no clasificados.

**Proyección:**

| Contratos | Valor medio | Ingresos año 1 |
|---|---|---|
| 1 contrato piloto | 25.000 USD | 25.000 USD |
| 3 contratos | 40.000 USD | 120.000 USD |
| 5 contratos + renovaciones | 75.000 USD | 375.000 USD |

---

### Escenario D — Publicidad contextual + patrocinios

Adecuado para monetizar tráfico de forma inmediata sin fricción, compatible con cualquier otro escenario.

| Canal | Formato | CPM estimado | Con 100K visitas/mes |
|---|---|---|---|
| Google AdSense | Display | 2–4 USD | 200–400 USD/mes |
| Carbon Ads | Texto contextual (tech/dev) | 3–6 USD | 300–600 USD/mes |
| **Patrocinio newsletter** | Mención curada | 500–2.000 USD/envío | Variable |
| **Sponsor de la app** | Branding "Powered by X" | 500–3.000 USD/mes | Negociable |

**Sponsors naturales:** VPNs (ExpressVPN, NordVPN), software de seguridad (Recorded Future, Flashpoint), medios especializados (JANES, Defense News), servicios geoespaciales (Esri, Maxar, Planet Labs).

---

### Escenario E — Venta / Adquisición

**Compradores potenciales:**

| Tipo de comprador | Interés estratégico | Precio estimado hoy | Con tracción (6 meses) |
|---|---|---|---|
| **Grupo editorial** (defensa/internacional) | Widget diferenciador para coberturas de conflicto | 50.000–200.000 USD | 200.000–600.000 USD |
| **Empresa inteligencia geoespacial** (Recorded Future, Esri, Palantir) | Integrar capa de tracking + UI en producto existente | 100.000–500.000 USD | 500.000–2.000.000 USD |
| **Contratista defensa** (Indra, Thales, BAE, L3Harris) | Módulo listo para integrar en plataformas C2 | 150.000–600.000 USD | 500.000–2.000.000 USD |
| **PE fund / Family office** (govtech/security) | Inversión semilla + escalar | 300.000–1.000.000 USD (con traction) | — |
| **Plataforma OSINT existente** (Maltego, SpiderFoot) | Añadir capa de tracking militar | 80.000–300.000 USD | 200.000–800.000 USD |

> La venta sin revenue hoy es esencialmente la venta de la **tecnología + activo técnico + tiempo de desarrollo ahorrado** (estimado en 6–12 meses de trabajo de un equipo de 2–3 ingenieros senior). La ventana de mayor precio es a **6–18 meses** con tracción de usuarios demostrable.

---

## 13. COMPARATIVA DE ESCENARIOS

| Escenario | Complejidad técnica adicional | Time-to-revenue | ARR realista año 1 | ARR optimista año 2 | Upside máximo |
|---|---|---|---|---|---|
| **A — Freemium B2C** | Baja (4–6 semanas) | 1–3 meses | 12.000–24.000 USD | 60.000–120.000 USD | 500K+ USD/año |
| **B — API B2B** | Media (6–8 semanas) | 2–4 meses | 20.000–50.000 USD | 100.000–300.000 USD | 1M+ USD/año |
| **C — Institucional/Gov** | Alta (3–6 meses + certificaciones) | 6–18 meses | 25.000–100.000 USD | 200.000–500.000 USD | Ilimitado (DoD-scale) |
| **D — Publicidad** | Muy baja (< 1 semana) | Inmediato | 2.000–8.000 USD | 10.000–30.000 USD | Limitado sin escala de tráfico |
| **E — Venta activo** | Ninguna | 3–12 meses búsqueda | — | — | 50K–2M+ USD one-time |

**Recomendación estratégica:** Ejecutar **A + D simultáneamente** (mínima fricción, generan señal de tracción) mientras se construyen relaciones B2B para **B**. Un solo cliente B2B ancla multiplica la valoración x5–x10 para una posible ronda seed o venta.

---

## 14. PLAN DE ACCIÓN PARA MAXIMIZAR VALOR

### Semanas 1–2 (inversión ~10 USD)
- [ ] Registrar dominio propio: `miltracker.io` / `miltracker3d.com` (~10 USD/año)
- [ ] Configurar Google Analytics 4 + hotjar básico (medir DAU, sesiones, mapas de calor)
- [ ] Crear perfiles Twitter/X, LinkedIn, Reddit del proyecto
- [ ] Post en r/OSINT, r/geopolitics, r/WarCollege, Hacker News "Show HN"

### Mes 1 (inversión ~50–100 USD)
- [ ] Implementar autenticación (Supabase Auth, gratuita)
- [ ] Plan Pro con Stripe: desbloquear historial > 1h, exports, sin ads
- [ ] Landing page con email capture (Convertkit gratuito hasta 1.000 suscriptores)
- [ ] Contactar 5 newsletters OSINT con propuesta de demo

### Meses 2–3
- [ ] API pública documentada (Swagger/Redoc) con plan de pago
- [ ] Widget embebible para medios (iframe configurable con API key)
- [ ] Primer cliente B2B piloto a precio reducido a cambio de testimonio público
- [ ] Aplicar a aceleradoras: Lanzadera (España), YC (W27 batch)

### Meses 4–6
- [ ] Ampliar historial a 7 días (Redis: ~5 USD/mes en Railway)
- [ ] Alertas por email/Telegram para suscriptores Pro
- [ ] Preparar deck de inversión si DAU > 500 y hay revenue inicial
- [ ] Contactar think tanks europeos con demo en vivo

---

## 15. ROADMAP TÉCNICO — PRÓXIMAS FUNCIONALIDADES

### Alta prioridad
- [ ] Autenticación + plan Pro (Supabase Auth + Stripe)
- [ ] Historial extendido a 24h/7 días (Redis o PostgreSQL timeseries)
- [ ] API REST pública documentada (aircraft, ships, alerts, conflicts)
- [ ] Alertas Telegram bot para eventos CRITICAL
- [ ] Filtro temporal en ConflictLayer ("últimas 2h / 24h / 72h")

### Media prioridad
- [ ] Overlay NASA GIBS (MODIS truecolor diario) en MapLayerSwitcher
- [ ] Overlay Sentinel-2 (EOX tiles, 10m resolución) para zonas calientes
- [ ] Exportar SITREP como PDF (jsPDF + html2canvas)
- [ ] Widget embebible configurable (iframe + API key)
- [ ] Integración AIS real (AISHub API, más fiable que scraping)

### Futuro / a largo plazo
- [ ] NLP geocodificación (mejorar precisión ubicación noticias)
- [ ] Análisis de patrones (rutas habituales vs. anomalías)
- [ ] App móvil nativa (React Native o PWA optimizada)
- [ ] Integraciones OSINT (Maltego, Shodan, Sentinel Hub)
- [ ] Módulo de análisis de amenazas custom para clientes enterprise

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
