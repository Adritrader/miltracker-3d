# MilTracker 3D — Checklist Unificado

> Consolida STATUS.md, AUDIT.md, AUDIT_v2.md, REVIEW2.md y ROADMAP.md en un único documento vivo.
> Fecha de esta revisión: **2026-08-18** (última actualización puntual: **2026-09-03**, fix de basemap). Los ítems marcados como "hecho" en los docs antiguos fueron re-verificados contra el código actual (no se asumió que la documentación previa siga siendo correcta).
> Los 5 documentos antiguos quedan obsoletos a partir de aquí — mantener solo este archivo hacia adelante.

---

## 📊 Resumen ejecutivo

| Área | Estado |
|------|--------|
| Seguridad crítica (CORS, auth REST, Stripe, Supabase Auth) | ✅ Resuelto |
| Auth de usuarios + Monetización (Stripe, planes Pro) | ✅ Implementado y funcionando |
| PWA (manifest + service worker) | ✅ Implementado (vite-plugin-pwa) |
| Anuncios (Monetag) | ✅ Implementado, con incidentes recientes resueltos (ver §7) |
| Socket.io — auth por token | ❌ Pendiente |
| Basemap tiles (CartoDB → Esri, ver §3) | ✅ Corregido 2026-09-03 tras cambio de política de CartoDB |
| Observabilidad (Sentry, /metrics, /healthz, logging estructurado) | ❌ Pendiente |
| Calidad de código (tests, ESLint, TypeScript) | ❌ Pendiente — 0% cobertura |
| DevOps (Docker, CI/CD, docs de build) | ❌ Pendiente |
| i18n / Context API / arquitectura frontend | ❌ Pendiente |
| SEO clásico (meta tags, OG, JSON-LD, sitemap) | ✅ Muy completo |
| SEO para IA (llms.txt, bots declarados, cobertura de contenido) | ❌ Pendiente (ver §10) |

---

## 1. Seguridad — ✅ Mayormente resuelto

- [x] CORS restrictivo por origen (whitelist `ALLOWED_ORIGINS`, aplica a HTTP y Socket.io) — `backend/server.js`
- [x] Auth REST opcional vía `REST_API_KEY` con guard 401 si falta en producción
- [x] Rate limiting HTTP: 120 req/min por IP en `/api/*` (`express-rate-limit`)
- [x] Validación de URLs externas (esquema `https?`) antes de renderizar `<a href>` — `AlertPanel.jsx`, `EntityPopup.jsx`
- [x] Validación de inputs en endpoints de intel (`callsign`, `icao24`, `registration`, `entityId` por regex)
- [x] Sanitización de API keys en logs de error (`sanitizeErr()`)
- [x] Validación CSV/rango en FIRMS (lat/lon, fecha, brillo)
- [x] Escritura atómica de disk cache (`.tmp` + `rename`) — evita corrupción en crash
- [x] Graceful shutdown (`SIGTERM`/`SIGINT` → flush + close)
- [x] Supabase Auth real (Google OAuth + email) — `AuthModal.jsx`, tabla `profiles` con trigger, endpoint `/api/profile` con `requireAuth`
- [ ] **Socket.io sin autenticación por token** — cualquiera puede conectarse al WebSocket y recibir todo el stream. `io.use(...)` no existe.
- [ ] Rate limiting de Socket.io es solo por-socket (cooldown 5s/10s), no por-IP — 100 tabs del mismo atacante = 100 sockets libres
- [ ] Sanitizar mensajes de error en producción (evitar exponer stack traces / paths internos al cliente)

---

## 2. Monetización — ✅ Implementado

- [x] Stripe integrado: `stripeService.js` + webhook + checkout session + gating de planes vía Supabase `profiles`
- [x] `PricingModal.jsx`, `AccountPanel.jsx`, `AuthModal.jsx` — wired en `App.jsx`, funcionales (no stubs)
- [x] Anuncios Monetag para usuarios free (`AdBanner.jsx`), inyección dinámica sólo si `!isPro`
- [x] Formato Multitag reemplazado por In-Page Push (más ligero) tras causar sobrecarga en móvil
- [x] Onclick/Popunder probado y **retirado** — correlacionaba con el crash de renderizado de Cesium en móvil (ver §7)
- [ ] Confirmar en producción que el In-Page Push (zona `11485282`) está recibiendo fill consistente (zonas nuevas de Monetag tardan 24-48h)
- [ ] Considerar Ko-fi/Patreon como canal adicional de monetización (bajo esfuerzo, no implementado)

---

## 3. Cesium / Globe3D — Estabilidad

- [x] `viewer.destroy()` en cleanup — ya no fuga memoria entre remounts
- [x] DataSources (`AircraftLayer`, `ShipLayer`, `NewsLayer`, `FIRMSLayer`, `ConflictLayer`, `DangerZoneLayer`, `MilitaryBasesLayer`) se remueven en unmount
- [x] Un único `ScreenSpaceEventHandler` central en `Globe3D` que enruta clicks (antes cada capa tenía el suyo)
- [x] **Bug raíz del "black screen" (`TypeError: tilingScheme`)** — causado por invocar `new Cesium.IonImageryProvider()` directamente (constructor inseguro/deprecado en 1.115). Corregido usando siempre `buildImageryProvider('dark')` como proveedor inicial.
- [x] **`showRenderLoopErrorMessage={false}`** añadido al `<Viewer>` — antes el diálogo nativo de error de Cesium quedaba pegado sobre el canvas y bloqueaba cualquier intento de auto-recuperación en segundo plano.
- [x] Recuperación de `renderError` mejorada: sondeo hasta 20 intentos (300ms) esperando canvas con tamaño válido, en vez de 3 intentos fijos
- [x] Pausa de render loop en `visibilitychange` (tab oculta) y en `webglcontextlost`/`webglcontextrestored`
- [x] **Basemap mostrando watermark "API KEY REQUIRED" (2026-09-03)** — CartoDB dejó de servir `basemaps.cartocdn.com` (`light_all`/`dark_nolabels`) sin API key. Corregido migrando los estilos `dark`/`night`/`light` a Esri Canvas (`World_Dark_Gray_Base`/`World_Light_Gray_Base`, `server.arcgisonline.com`), que sigue siendo gratuito y sin key. Actualizado también `index.html` (preconnect), `vite.config.js` (patrón de cache PWA) y `README.md`. — `Globe3D.jsx`
- [ ] **Pendiente de confirmación del usuario:** validar en dispositivo móvil real que el `RangeError: Invalid array length` (`createPotentiallyVisibleSet`) no vuelve a aparecer tras quitar el Onclick/Popunder + los dos fixes anteriores. Si reaparece sin ads, el trigger real podría ser resize/rotación de pantalla en vez de ads — investigar `handleVisibilityChange`/orientation change.
- [x] Doble-click zoom con suelo mínimo 50km
- [ ] Sin grid de coordenadas MGRS/lat-lon opcional en el globo — pendiente (baja prioridad)
- [ ] Sin rosa de los vientos / botón "north up" — pendiente

---

## 4. Backend — Arquitectura y Performance

- [x] `pollAircraft`/`pollShips` con `setTimeout` recursivo (no `setInterval`) — evita solapamiento
- [x] Hash-diff antes de broadcast (`danger_update`, aircraft, ships) — reduce tráfico redundante
- [x] Disk cache con TTL + escritura async no bloqueante
- [x] Compresión HTTP (gzip) habilitada
- [x] ACLED integrado como fuente adicional de conflictos (`fetchACLEDConflicts()`)
- [x] GDELT con límite de concurrencia (batches de 4)
- [x] Memory leaks acotados: Sets de dedup (`archivedAlertIds` etc.) con cap ~5-10k, `tweetedIds` con cap 500
- [ ] `server.js` sigue siendo un archivo monolítico (~1000+ líneas), aunque ya delega a 8+ módulos de servicio — refactor a rutas/módulos pendiente
- [ ] Logging estructurado (pino/winston) — sigue siendo `console.log`/`console.error` puro
- [ ] Validación de env vars al arranque — parcial (solo `REST_API_KEY` y Gemini se comprueban)
- [ ] Paginación cursor-based en `/api/alerts/history` y similares — solo hay `limit` (offset simple), no cursor real
- [ ] CSV parser de FIRMS sigue usando `split(',')` naive (no maneja campos con comas escapadas)
- [ ] Endpoint `/metrics` (Prometheus) o `/healthz` dedicado — no existe, solo `/api/status`
- [ ] Sentry / error tracking en producción — no implementado
- [ ] Broadcast de arrays completos a todos los clientes (sin delta updates ni viewport filtering) — con muchos usuarios concurrentes esto escala mal
- [ ] Circuit breaker / backoff exponencial para APIs externas caídas (adsb.lol, etc.) — no implementado
- [ ] Deduplicar Haversine (`distanceKm`/`distKm`) entre frontend y backend — backend ya centralizado (`aiDanger.js` exporta `distKm`), frontend sigue con su propia copia (aceptable, no puede importar del backend)

---

## 5. Frontend — Arquitectura y Calidad

- [x] `ErrorBoundary` en capas críticas
- [x] Persistencia de filtros y tracking list en `localStorage`
- [x] Memoización de listas pesadas (`TrackingPanel`, `historyTrack` incremental, iconos con LRU cap)
- [x] Debounce en `SearchBar` (400ms) y `CoordinateHUD` mouse tracking (100ms throttle)
- [ ] Sin Context API global — `App.jsx` sigue con ~20 `useState` y prop drilling a 5+ niveles de componentes
- [ ] Sin TypeScript (0 archivos `.ts`/`.tsx`, sin `tsconfig.json`)
- [ ] Sin ESLint configurado (no hay `.eslintrc`/`eslint.config.js`)
- [ ] Sin i18n (la UI está solo en inglés, sin `react-i18next` ni equivalente)
- [ ] SVGs de iconos con tamaño fijo (no completamente HiDPI-safe)
- [ ] Clases Tailwind `hud-*` sin documentar en `tailwind.config.js`

---

## 6. Testing / Calidad de Código — ❌ 0% cobertura

- [ ] **Cero tests** — no existe ni un solo `*.test.js`/`*.spec.js` en todo el repo (backend ni frontend)
- [ ] Sin `vitest.config` ni Jest configurado
- [ ] Sin CI (no hay GitHub Actions / pipeline visible en el repo)

> Esta sigue siendo la brecha más grande del proyecto en términos de mantenibilidad a largo plazo.

---

## 7. Incidente reciente — Ads + Cesium crash móvil (resuelto en esta sesión, 2026-08-18)

Cronología completa por si se necesita repasar el diagnóstico:

1. Reporte inicial: crash en móvil (`RangeError: Invalid array length`) atribuido en primera instancia a los anuncios Monetag (formato Multitag agresivo).
2. Se descartó la teoría de "tab backgrounding" tras confirmar que el crash ocurría también en modo standalone/PWA.
3. Se cambió Multitag → formatos ligeros (In-Page Push + Onclick/Popunder) como mitigación.
4. Apareció un **segundo error distinto**, más fundamental: `TypeError: Cannot read properties of undefined (reading 'tilingScheme')` → pantalla negra permanente. Causa raíz: uso directo de `new Cesium.IonImageryProvider()` (API insegura/deprecada en Cesium 1.115). **Corregido** usando siempre el proveedor CartoDB síncrono como imagery inicial.
5. Ads reactivados en móvil (ya no se sospechaba de ellos como causa raíz).
6. Verificación en PC: `tag.min.js` → 304 (cacheado, normal) y `al5sm` → 204 (sin fill de anuncios, normal, no es bug).
7. **El crash original (`RangeError: Invalid array length` en `createPotentiallyVisibleSet`) reapareció en móvil** justo tras interactuar con el anuncio Onclick/Popunder. Se encontró que Cesium mostraba su propio diálogo bloqueante de error (`showRenderLoopErrorMessage` no estaba desactivado) por encima del canvas, tapando cualquier intento de recuperación automática ya existente en el código. **Corregido**: `showRenderLoopErrorMessage={false}` + polling robusto (20 intentos × 300ms) hasta que el canvas recupera un tamaño válido.
8. **Anuncio Onclick/Popunder eliminado** de `AdBanner.jsx` — se mantiene solo In-Page Push, dado que el popunder es el que más se correlaciona temporalmente con el crash (abre pestaña nueva → posible resize/backgrounding del tab original).

**Estado actual:** ambos fixes de Cesium están desplegados (commits `1a1f2b4`, `0aaebfe`). **Pendiente de confirmación del usuario** en dispositivo móvil real para cerrar definitivamente el incidente.

---

## 8. DevOps

- [x] Script `dev` unificado en `package.json` raíz (`concurrently`)
- [x] `.env.example` presente en `backend/` y `frontend/`
- [ ] Sin `docker-compose.yml`
- [ ] Sin documentación de build/deploy de producción más allá de `vercel.json`/`railway.json`
- [ ] Sin CI/CD (lint/test automático en PRs)

---

## 9. SEO — Auditoría 2026-08-18

> Estado general: **muy sólido** en SEO clásico (meta tags, Open Graph, JSON-LD, sitemap). Las brechas están en la parte de descubribilidad por IA (llms.txt, bots declarados) y en contenido incompleto respecto a lo que ya se promete en meta/FAQ.

### ✅ Ya implementado

- [x] Meta tags completos en `index.html`: title, description, keywords, canonical, robots, geo, news_keywords
- [x] Open Graph completo (title, description, image 1200×630, site_name, locale)
- [x] Twitter Card (`summary_large_image`) completa
- [x] JSON-LD `WebApplication` con `offers` (Free/Pro), `featureList`, `potentialAction`
- [x] JSON-LD **`FAQPage`** con 5 preguntas — formato clave para que Google AI Overviews/Perplexity/ChatGPT citen respuestas directas
- [x] JSON-LD `Organization` con `sameAs`
- [x] `robots.txt` + `sitemap.xml` presentes y válidos
- [x] Título/descripción dinámicos por ruta vía `react-helmet-async` en la SPA (`App.jsx` `seoTitle`/`seoDescription`) — visible para crawlers que ejecutan JS (Google)
- [x] Páginas estáticas sin JS indexables: `about.html` + 4 páginas `/conflicts/*.html` (ukraine-russia, taiwan-strait, red-sea, south-china-sea) — crítico porque la app principal es una SPA con WebGL que la mayoría de crawlers de IA (GPTBot, ClaudeBot, PerplexityBot) no renderizan
- [x] `preconnect`/`dns-prefetch` a CDNs de tiles y fuentes — ayuda a Core Web Vitals (LCP)

### ❌ Pendiente

- [ ] **`llms.txt`** — estándar emergente que varios crawlers de IA consultan para obtener un resumen curado del sitio en markdown. No existe en el repo. Alto impacto / esfuerzo mínimo.
- [ ] **`robots.txt` no declara bots de IA explícitamente** (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `anthropic-ai`). El wildcard `User-agent: *` ya los permite implícitamente, pero declararlos da control fino (ej. permitir los de *search* y bloquear `Bytespider`/`CCBot` si no se quiere scraping de entrenamiento).
- [ ] **Sin JSON-LD en las 4 páginas de `/conflicts/*.html`** — ninguna tiene `Article`/`NewsArticle` schema con `datePublished`/`dateModified`. Reduce elegibilidad para Google News/Discover y citas de IA.
- [ ] **Contenido incompleto vs. lo prometido en meta/FAQ**: la `description` y el `FAQPage` mencionan "Israel-Gaza" y "Korean DMZ" como zonas cubiertas, pero no existen `/conflicts/israel-gaza.html` ni `/conflicts/korean-dmz.html`. Inconsistencia que penaliza señales de calidad/E-E-A-T.
- [ ] **`sitemap.xml` con `lastmod` hardcodeado** (`2026-07-29` en todas las URLs) — inconsistente con `changefreq: hourly` en la home; no refleja actualizaciones reales.
- [ ] Sin imagen en el sitemap (`<image:image>`) para `og-preview.png`.

---

## 10. Próximos pasos recomendados (orden sugerido)

1. **Validar el fix del crash móvil** en dispositivo real (bloqueante — hay usuarios afectados ahora mismo).
2. **Socket.io auth por token** — cierra el mayor agujero de seguridad restante (cualquiera puede leer el stream completo sin autenticarse).
3. **Sentry** (u otra herramienta de error tracking) — sin esto, los próximos bugs en producción se detectan solo por reporte manual del usuario, como ha pasado en esta sesión.
4. **Tests mínimos** sobre funciones puras críticas (`geocodeTitle`, `filterAircraft`, `analyzeLocalDanger`, `icaoToCountry`) — cobertura actual es 0%.
5. **Refactor de `server.js`** a rutas/módulos — ya delega a servicios pero el archivo principal sigue creciendo.
6. Paginación cursor-based en endpoints de historial, antes de que el volumen de datos lo haga necesario.
7. **SEO para IA** (§9): crear `llms.txt`, declarar bots de IA en `robots.txt`, añadir `Article` JSON-LD a las páginas de conflicto, y crear las páginas de Israel-Gaza/Korean DMZ que ya se prometen en meta tags.
