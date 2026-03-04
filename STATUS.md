# MILTRACKER 3D — Estado del Roadmap

> Última actualización: Commit actual en `main`

---

## §1 — Bugs Conocidos

| # | Item | Estado |
|---|------|--------|
| 1.1 | Emoji en FilterPanel → ASCII | ✅ Hecho |
| 1.2 | FLY TO / botones → ASCII | ✅ Hecho |
| 1.3 | `isDestroyed()` guard en trails | ✅ Hecho |
| 1.4 | Ship filter países incompleto | ✅ Hecho (25 países) |
| 1.5 | `categorizeAircraft()` sin usar en UI | ✅ Hecho (mission type filter) |
| 1.6 | Gemini JSON parsing frágil | ✅ Hecho (regex `jsonMatch`) |
| 1.7 | `BACKEND_URL` hardcodeado | ✅ Hecho (`VITE_BACKEND_URL`) |
| 1.8 | `driftState` memory leak | ✅ N/A (drift eliminado con ships reales) |
| 1.9 | Conflictos dedup por título frágil | ❌ Pendiente |

## §2 — Performance Frontend

| # | Item | Estado |
|---|------|--------|
| 2.1 | Virtual diff con Map (no re-crear todo) | ✅ Hecho |
| 2.2 | Memoize `buildIcon()` en ConflictLayer | ✅ Hecho (`_iconCache`) |
| 2.3 | `useMemo` split por capa | ✅ Hecho |
| 2.4 | Vite `manualChunks` para CesiumJS | ❌ Revertido (causaba problemas) |
| 2.5 | Trail cap puntos | ✅ Hecho (`MAX_TRAIL_POINTS = 40`) |
| 2.6 | Cachear ref DataSource (evitar O(n) scan) | ❌ Pendiente |

## §3 — Performance Backend

| # | Item | Estado |
|---|------|--------|
| 3.1 | ADS-B timeout agresivo por fuente | ✅ `a7d066b` |
| 3.2 | GDELT límite de concurrencia | ✅ `batchedFetch` 4req/500ms — conflictService.js |
| 3.3 | Disk cache TTL al leer | ✅ Hecho |
| 3.4 | `analyzeLocalDanger` en worker thread | ❌ Pendiente |
| 3.5 | Compresión HTTP Express | ✅ Hecho |
| 3.6 | WebSocket hash-diff | ✅ Hecho |

## §4 — Arquitectura Backend

| # | Item | Estado |
|---|------|--------|
| 4.1 | Refactorizar `server.js` en módulos | ❌ Pendiente |
| 4.2 | Logging estructurado (pino) | ❌ Pendiente |
| 4.3 | Express error handler global | ✅ Hecho |
| 4.4 | Rate limiting en rutas REST | ✅ Hecho |
| 4.5 | Validación de env vars al arranque | ❌ Pendiente |

## §5 — Arquitectura Frontend

| # | Item | Estado |
|---|------|--------|
| 5.1 | Context API (evitar prop drilling) | ❌ Pendiente |
| 5.2 | `ErrorBoundary` en todas las capas | ✅ Hecho |
| 5.3 | SVG escalable (HiDPI) | ❌ Pendiente |
| 5.4 | Clases `hud-*` documentadas en Tailwind | ❌ Pendiente |

## §6 — Datos y Fuentes

| # | Item | Estado |
|---|------|--------|
| 6.1 | Ghost tracking (aviones stale 5 min) | ✅ Hecho |
| 6.2 | Ships: fuente real AIS global | ✅ Hecho (AISStream 3-tier) |
| 6.3 | News geocoding filtro militar | ✅ `hasMilitaryContext()` en fetchGDELTDocConflicts |
| 6.4 | GDELT vacío vs error diferenciado | ❌ Pendiente |
| 6.5 | Events `firstSeenAt` persist (no reset de timestamps) | ✅ Hecho |

## §7 — UX / HUD

| # | Item | Estado |
|---|------|--------|
| 7.1 | AlertPanel diseño visual (pulso, bordes) | ✅ Hecho |
| 7.2 | Indicador de carga inicial | ✅ Hecho |
| 7.3 | AlertPanel límite visible + expandir | ✅ `a7d066b` |
| 7.4 | Tema claro/oscuro | ❌ Pendiente (baja prioridad) |
| 7.5 | Link FlightAware | ✅ Eliminado (no querido) |
| 7.6 | Filtro por tipo de misión | ✅ Hecho |
| 7.7 | Grid lat/lon en el globo | ❌ Pendiente |

## §8 — Seguridad

| # | Item | Estado |
|---|------|--------|
| 8.1 | CORS restrictivo por origen | ❌ Pendiente |
| 8.2 | Socket.io con autenticación token | ❌ Pendiente |
| 8.3 | Sanitizar errores en producción | ❌ Pendiente |

## §9 — Testing y Calidad

| # | Item | Estado |
|---|------|--------|
| 9.1 | Tests unitarios (Jest/Vitest) | ❌ Pendiente |
| 9.2 | Migración a TypeScript | ❌ Pendiente |
| 9.3 | ESLint configurado | ❌ Pendiente |
| 9.4 | Deduplicar `distanceKm` frontend/backend | ❌ Pendiente |

## §10 — Nuevas Funcionalidades

| # | Item | Estado |
|---|------|--------|
| 10.1 | Replay histórico (timeline) | ❌ Pendiente |
| 10.2 | Heatmap de actividad | ❌ Pendiente |
| 10.3 | Notificaciones push browser | ✅ AlertPanel.jsx — Notification API, bell icon, dedup por id |
| 10.4 | Dashboard estadísticas / gráficas | ❌ Pendiente |
| 10.5 | Búsqueda global (callsign/MMSI) | ✅ Hecho (SearchBar) |
| 10.6 | Exportar GeoJSON / KML | ❌ Pendiente |
| 10.7 | Modo presentación (sin HUD) | ❌ Pendiente |
| 10.8 | PWA (manifest + service worker) | ❌ Pendiente |
| 10.9 | Internacionalización i18n | ❌ Pendiente |
| 10.10 | Panel AI expandido (SITREP + tabs) | ✅ Hecho |

## §11 — DevOps

| # | Item | Estado |
|---|------|--------|
| 11.1 | `docker-compose.yml` | ❌ Pendiente |
| 11.2 | Script `dev` unificado en raíz | ✅ root package.json `dev` via concurrently |
| 11.3 | Build producción documentado | ❌ Pendiente |
| 11.4 | `.env.example` | ✅ Hecho |

---

## Extras fuera del Roadmap original (implementados en sesión)

| Feature | Commit |
|---------|--------|
| Smooth animation lerp (CallbackProperty 10s/20s) | `460cd7b` |
| Gold color para entidades trackeadas | `d2b6083` |
| TrackingPanel multi-entidad simultánea | anterior |
| Ship/aircraft trails con persistencia sessionStorage | anterior |
| Helicopter SVG distinto del avión | anterior |
| Country flags en billboards (código ISO) | anterior |
| MapLayerSwitcher (6 basemaps libres) | anterior |
| Satellite basemap (ESRI) | anterior |
| Basemap lock: no cambia al clicar entidades | `0a6d396` |
| Gemini API key activa | `0a6d396` |
| Mission type filter (FIGHTER/ISR/TANKER…) | `23e0053` |
| Initial load overlay "INITIALIZING SENSORS" | `23e0053` |
| Ghost tracking aviones (30% opacidad 5 min) | `23e0053` |
| Events timestamp persist (firstSeenAt, 72h TTL) | actual |
| SITREP tab con briefing local generado | `d2b6083` |

---

## §12 — Estrategia: Producción Real, SEO y Monetización

### 12.1 — Valoración SEO

CesiumJS renderiza en WebGL — el DOM está casi vacío. El SEO orgánico no funcionará bien.  
**Mejor enfoque:**
- OG / Twitter Card meta tags (`og:title`, `og:description`, `og:image` con screenshot del globo)
- Página estática `/about` en Vercel (indexable, sin WebGL)
- `document.title` dinámico con contadores en vivo: `"MilTracker 3D — 124 aircraft · 37 ships · 18 conflicts"`
- Distribución directa: Reddit (r/geopolitics, r/flightradar, r/OpenData), Twitter/X, Product Hunt

### 12.2 — Monetización (ordenada por viabilidad)

| Opción | Esfuerzo | POtencial | Notas |
|--------|----------|-----------|-------|
| **Ko-fi / Patreon** | ~1h | Bajo-medio | Botón en HUD, comunidad paga herramientas que usa — el más rápido |
| **Tier Premium** ($4.99/mes) | 1-2 días | Alto | Stripe + JWT: datos en tiempo real vs 30-min delay, alertas ilimitadas, SITREP completo |
| **Acceso API** ($20-50/mes) | 1-2 días | Medio | Para analistas/periodistas una vez acumulen datos históricos |
| **Google AdSense** | 1h | Bajo | CPM bajo en este nicho + arruina la estética del HUD militar |

### 12.3 — Features de Alto Impacto No Planificadas

| Feature | Por qué importa |
|---------|----------------|
| **Share link** `?fly=lat,lon,alt` | Viralidad en Twitter/X — cada usuario comparte una vista del globo |
| **Timeline / Replay histórico** | Feature más pedida en apps de tracking — ver el desarrollo de un evento |
| **Email / Telegram alertas por región** | Diferenciador fuerte frente a OpenSky/MarineTraffic |
| **Iframe embeddable** | Backlinks desde medios/blogs, más tráfico |

### 12.4 — Hardening de Seguridad (antes de publicar)

| # | Item | Riesgo si no se hace |
|---|------|---------------------|
| §8.1 | CORS restrictivo por origen | Cualquiera puede consumir el backend de Railway y quemar la cuota Gemini |
| §8.2 | Socket.io con token de auth | Bots pueden conectarse y saturar el server gratuito |
| §8.3 | Sanitizar errores en producción | Stack traces con rutas internas llegan al frontend |

### 12.5 — Top 5 Recomendaciones (prioridad)

```
1. PWA (§10.8)           — manifest.json + service worker → retención móvil
2. Share link            — ?fly=lat,lon,alt → viralidad, ~2h de trabajo
3. Ko-fi en HUD          — botón discreto, monetización en 1h
4. CORS + Socket auth    — §8.1 + §8.2 → protege cuota Gemini y Railway
5. Timeline / Replay     — §10.1 → mayor driver de retención de usuarios
```

### 12.6 — Opciones de Dirección

| Opción | Items | Tiempo estimado |
|--------|-------|----------------|
| **A — Producción segura** | §8.1 CORS + §8.2 Socket auth + §8.3 sanitizar + §10.8 PWA | ~4-6h |
| **B — Monetización primero** | Ko-fi (1h) + Share link (2h) + Stripe Premium (1-2 días) | 1h → 2 días |
| **C — Roadmap en orden** | §1.9 dedup + §4.5 env validation + §6.4 GDELT errors + §7.7 lat/lon grid | ~3-4h |
| **D — Features de impacto** | Timeline/replay (§10.1) + Email/Telegram alerts | 1-3 días |

---

**Resumen: 34 ✅ hechos · 28 ❌ pendientes**
