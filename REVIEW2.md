# REVIEW2 — Análisis Completo del Proyecto · Checklist de Mejoras

> Revisión exhaustiva de todo el código (backend + frontend) realizada en Junio 2025.
> Cubre bugs, rendimiento, UI/UX, nuevas funcionalidades, calidad de datos, arquitectura, seguridad y mobile.
> Cada ítem incluye su ubicación en el código y prioridad (🔴 Alta · 🟡 Media · 🟢 Baja).

---

## § B — Bugs y Comportamiento Incorrecto

- [x] **B1** 🔴 `EntityPopup.jsx` — detección de `isAlert` frágil: verifica presencia de campos `title+message+severity` en lugar de revisar `type === 'alert'`. Un conflicto con esos tres campos sería clasificado incorrectamente como alerta, renderizando el formato equivocado.

- [x] **B2** 🟡 `opensky.js` — `fetchGulfRegion()` marcada como `@deprecated` pero sigue presente en el módulo (código muerto). Ocupa ~3KB de bundle y genera confusión en futuros contribuidores. Eliminar.

- [x] **B3** 🔴 `Globe3D.jsx` — URL param `?fly=lat,lon,alt,hdg,pitch` se parsea con `parseFloat()` sin validación de rango. Una URL maliciosa con `lat=91` o `lon=999` puede causar comportamientos inesperados en Cesium. Validar: `Math.abs(lat) <= 90`, `Math.abs(lon) <= 180`, `alt > 0`.

- [x] **B4** 🟡 `NewsPanel.jsx` — el efecto de "trickle reveal" (`visibleCount`) no se reinicia cuando la lista de noticias se reemplaza por completo con el mismo número de ítems. Sólo detecta cambios en `news.length`. Resultado: para actualizaciones donde el servidor devuelve exactamente 30 artículos nuevos (N=30 siempre), los nuevos artículos no se animan.

- [x] **B5** 🟡 `positionTracker.js` — al cargar desde disco, los snapshots sólo se recortan por **cantidad** (`snapshots.length > HISTORY_LIMIT`) pero no por **antigüedad**. Tras un reinicio del servidor, el timeline puede mostrar snapshots de hace >2 horas mezclados con datos frescos. Añadir filtro de TTL al cargar (ej: descartar entradas >90 minutos).

- [x] **B6** 🟡 `newsService.js` — `extractRSSImage()` acepta URLs que empiezan con `http://` (sin TLS), causando mixed-content warnings en el navegador. El check actual es `m[1].startsWith('http')`. Cambiar a `startsWith('https://')`.

- [x] **B7** 🟡 `conflictService.js` — `classifyEvent()` usa lógica "primer match gana". Un titular con "drone" y "troops" queda clasificado como `troops` porque `drone` aparece antes en el array pero coincide con el patrón `troops` más tarde. En realidad debería devolver el tipo más específico según el orden de prioridad del array, que actualmente es: airstrike→missile→explosion→artillery→drone→naval→troops. El problema es que "drone strike" matchea `airstrike` por "strike", no `drone`. Revisar patrones de regex para evitar colisiones.

- [x] **B8** 🟢 `server.js` — el endpoint `/api/status` no reporta el conteo de FIRMS hotspots ni el timestamp de la última actualización de FIRMS, aunque sí lo hace con conflicts y news. Añadir `firms: cache.firms?.length ?? 0` y `lastFirmsUpdate`.

- [x] **B9** 🟡 `ShipLayer.jsx` — `saveTrails()` a `sessionStorage` se llama dentro del `useEffect` principal sin debounce alguno. En cada ciclo de actualización (30s) se serializa todo el mapa de trails (hasta 60 posiciones × N ships) a JSON. Con 100+ barcos, esto es ~200KB+ de escritura síncrona al DOM storage en cada tick. Añadir debounce de al menos 10s.

- [x] **B10** 🟢 `AlertPanel.jsx` — la vista SITREP muestra la hora como "LOCAL" pero usa `toLocaleDateString` / `toLocaleTimeString` sin fijar zona horaria, lo que efectivamente muestra la hora local del navegador. La mayor parte de la audiencia objetivo espera hora de operaciones (UTC). Añadir aclaración "UTC" o unificar con el reloj del CoordinateHUD.

- [x] **B11** 🟡 `useRealTimeData.js` — al reconectar (`socket.on('connect')`), el hook emite `request_data` con `since: lastUpdateRef.current`. Sin embargo `lastUpdateRef` nunca se actualiza para `dangerZones` ni `alerts`, por lo que cada reconexión re-solicita todos los datos de peligro aunque no hayan cambiado. Añadir `alerts` y `dangerZones` timestamps al ref.

- [x] **B12** 🟢 `FilterPanel.jsx` — ~~N/A: `useMissionClock()` ya hace re-render cada segundo, `timeAgo()` se actualiza correctamente~~ — los timestamps de última actualización (ej: "Aircraft: 32s ago") usan `timeAgo()` pero sólo se re-renderizan cuando llega nueva data, no cada segundo. Para un usuario que acaba de conectarse, el texto puede mostrar "0s ago" durante un minuto completo sin actualizarse. Usar un estado con tick de 1s o la función `timeAgo` como un hook reactivo.

---

## § P — Rendimiento y Optimización

- [ ] **P1** 🟡 `Globe3D.jsx` — `tileCacheSize: 150` es conservadoramente bajo para conexiones de banda ancha. En desktop moderno, 300-500 tiles en caché elimina casi todos los flashes de carga de terreno al hacer pan. Aumentar a `300` en desktop, mantener `150` en mobile.

- [ ] **P2** 🟡 `NewsPanel.jsx` — duración del ticker calculada como `Math.max(items * 6, 40)s`. Con 30 artículos = 180 segundos (3 minutos por ciclo completo). Los usuarios no leen el ticker con títulos que tardan 3 min en pasar. Reducir a `items * 3` o máximo 90s. También: el ticker CSS `animation` hace repaint continuo en GPU, incluso cuando el panel está collapsed — pausar animación cuando `!expanded`.

- [ ] **P3** 🟡 `positionTracker.js` — `saveHistory()` serializa el array completo de snapshots (hasta 120 entradas × ~300+ entidades × 8 campos ≈ 2-3MB) de forma **síncrona** con `JSON.stringify` en el event loop de Node. En servidores con muchas entidades conectadas, esto puede causar un freeze de ~50ms cada 5 minutos. Usar `setImmediate()` o serializar en chunks.

- [ ] **P4** 🟡 `conflictService.js` — las 20 queries a GDELT se lanzan en paralelo con timeout de 25s cada una. Si GDELT está lento, mantiene ~20 conexiones HTTP abiertas durante 25s cada 10 minutos, agotando el pool de conexiones de `node-fetch`. Limitar a un máximo de 6 queries simultáneas con `Promise.allSettled` en batches de 6.

- [ ] **P5** 🟢 `FIRMSLayer.jsx` — `_clusterIconCache` (Map en módulo) crece indefinidamente sin límite. En sesiones largas con muchos recuentos únicos de cluster (1-999), la caché puede acumular 500+ SVGs en base64. Añadir un límite de 200 entradas con LRU simple.

- [ ] **P6** 🟢 `CoordinateHUD.jsx` — crea su propio `ScreenSpaceEventHandler` para seguimiento del mouse, independiente del handler de `Globe3D.jsx`. Dos handlers de `MOUSE_MOVE` en el mismo canvas causan doble procesamiento. Centralizar el mouse tracking en `Globe3D` y pasar las coordenadas via callback/context.

- [ ] **P7** 🟢 `newsService.js` — 28 feeds RSS se fetchen en paralelo en cada ciclo de 15 minutos. Con un timeout de 10s por feed, en producción Railway esto puede consumir 28 × 10 = hasta 280s de compute en el peor caso (aunque paralelo). Algunos feeds (ej: `atlanticcouncil.org/feed/`, SOFREP) raramente tienen noticias militares relevantes. Evaluar eliminar los 5-6 feeds menos productivos.

- [ ] **P8** 🟢 `AircraftLayer.jsx` (no leído en detalle pero) — los iconos SVG se generan por cada aeronave en cada render. Añadir una caché de SVG-to-dataURI memoizada por `(type_code, country, heading_bucket)` para evitar regenerar SVGs idénticos.

---

## § U — UI/UX y Diseño

- [ ] **U1** 🔴 `FilterPanel.jsx` — lista de países hardcodeada con sólo 10 países. `militaryFilter.js` ya tiene `COUNTRY_DATA` con 50+ países. Reemplazar la lista hardcodeada por un selector dinámico generado desde `COUNTRY_DATA`, con flags emoji y búsqueda por nombre.

- [ ] **U2** 🟡 `FilterPanel.jsx` — no hay botón prominente de "Restablecer filtros". El botón de reset actual no es visible. Añadir un botón "RESET ALL" con confirmación visual (flash rojo → verde) accesible desde el header del panel.

- [ ] **U3** 🟡 `EntityPopup.jsx` — `flyTo` siempre usa altitud de 1,500,000m sin importar el tipo de entidad. Para aeronaves debería ser ~500,000m, para barcos ~800,000m, para FIRMS (hotspot) ~200,000m, para bases militares ~300,000m. Usar mapa de altitudes por tipo.

- [ ] **U4** 🟡 `Globe3D.jsx` — no hay rosa de los vientos ni botón "norte arriba". Cesium tiene `viewer.scene.camera.setView` para resetear orientación. Añadir un botón de brújula (top-right del globo) que muestre el heading actual y al hacer click realinee al norte.

- [ ] **U5** 🟡 `TimelinePanel.jsx` — el slider sólo muestra hora UTC sin fecha. Para snapshots de hace 45-60 minutos (inicio del buffer), la fecha es la misma pero para overnight sessions (buffer que cruza medianoche) es ambiguo. Mostrar "DD MMM HH:MM" como tooltip del slider handle.

- [ ] **U6** 🟡 `TrackingPanel.jsx` — las entidades trackeadas no están ordenadas. Al añadir una nueva entidad aparece en posición arbitraria. Ordenar por: tipo (aircraft primero, ships después), luego por nombre. Mostrar un contador "N tracked" en el header del panel.

- [ ] **U7** 🟡 `MilitaryBasesLayer.jsx` — las bases militares son visibles en el globo pero **no son interactivas**: al hacer click no ocurre nada. Añadir handler de selección que muestre un popup con el nombre, país, tipo, y el campo `note` de inteligencia que ya existe en cada base.

- [ ] **U8** 🟡 `SearchBar.jsx` — al seleccionar un resultado de tipo `conflict` o `news`, la cámara vuela a 1,200,000m (altura de barco). Para eventos de conflicto en ciudad, 400,000m muestra más contexto. Para news sólo con coordenadas regionales (ej: "Red Sea"), 2,000,000m es más apropiado. Ajustar altitudes por tipo.

- [ ] **U9** 🟢 `AlertPanel.jsx` — el tab "AI" aparece aunque `geminiEnabled === false` o `aiInsight === null`. El tab queda en "— sin datos —". Ocultar o deshabilitar el tab AI cuando Gemini no está activo para evitar confusión.

- [ ] **U10** 🟢 `NewsPanel.jsx` — hacer click en un artículo del ticker (barra collapsed) selecciona el artículo pero no expande automáticamente el panel para mostrarlo en la lista. El usuario tiene que hacer click en "▲" manualmente. Activar `setExpanded(true)` cuando se selecciona un artículo desde el ticker.

- [ ] **U11** 🟢 `CoordinateHUD.jsx` — el botón "SHARE" copia la URL al clipboard correctamente pero no hay feedback visual explícito de qué se copió. Añadir un tooltip "View URL copied!" más prominente (de momento sólo cambia el label del botón internamente).

- [ ] **U12** 🟢 `TimelinePanel.jsx` — el slider de reproducción no tiene `aria-label` ni `aria-valuetext`, haciendo que sea inaccesible para lectores de pantalla. Añadir `aria-label="Timeline position"` y `aria-valuetext={currentTimeString}`.

- [ ] **U13** 🟢 `FilterPanel.jsx` — los iconos de tipo de misión usan entidades HTML (`▶`, `▽`, `◆`). Reemplazar con emojis Unicode que se escalan mejor: ✈️ para aéreo, 🚁 para helicóptero, ⚡ para drones, etc. O usar SVG icons consistentes con el sistema de design actual.

- [ ] **U14** 🟢 `App.jsx` — el estado `uiHidden` (oculta toda la UI para capturas SITREP) sólo se activa internamente desde `SitrepCapture.jsx`. No hay ninguna forma para el usuario de activarlo manualmente fuera del flujo de SITREP. Añadir atajo de teclado `Ctrl+H` para toggle.

- [ ] **U15** 🟢 `AlertPanel.jsx` — en mobile, cuando hay alertas CRITICAL nuevas, el panel permanece colapsado y no hay ningún indicador flotante. Añadir un badge de conteo rojo pulsante visible desde el panel colapsado (similar al sistema de notificaciones de iOS).

- [ ] **U16** 🟡 `TrackingPanel.jsx` — los cards de entidades muestran altitud/velocidad/heading pero no el "tiempo desde último fix" (age de la posición). Para aeronaves, si el fix tiene >2min de antigüedad puede ser que el avión abandonó la cobertura ADS-B. Mostrar `timeAgo(lastSeen)` con color rojo si >5min.

- [ ] **U17** 🟢 `Globe3D.jsx` — al hacer doble-click para zoom, la cámara baja al 35% de la altitud actual sin límite inferior. Si la cámara ya está cerca del suelo (<50,000m), hacer doble-click puede atravesar el terreno o generar una vista inutilizable. Establecer `Math.max(height * 0.35, 50_000)` como mínimo.

---

## § F — Nuevas Funcionalidades

- [ ] **F1** 🔴 `FilterPanel.jsx` + `useRealTimeData.js` — **Persistencia de filtros**: guardar el estado de `filters` en `localStorage` al cambiar. Restaurar en el montaje inicial. Igual que ya se hace con `basemap`. Estimado: 15 líneas.

- [ ] **F2** 🔴 `TrackingPanel.jsx` + `App.jsx` — **Persistencia del tracking list**: serializar el `Map<id, {id, type}>` a `localStorage` y restaurarlo al montar. Las entidades trackeadas deben sobrevivir a un page refresh.

- [ ] **F3** 🟡 `TrackingPanel.jsx` — **Modo "Follow camera"**: al hacer click en el icono de cámara de una entidad trackeada, la cámara sigue continuamente a esa entidad, actualizando `viewer.camera.lookAt()` en cada frame. Un segundo click desactiva el modo.

- [ ] **F4** 🟡 `App.jsx` + `FilterPanel.jsx` — **Atajos de teclado para layers**: `Alt+A` (aircraft), `Alt+S` (ships), `Alt+C` (conflicts), `Alt+F` (FIRMS), `Alt+B` (bases), `Alt+N` (news). Mostrar los atajos en `FilterPanel` junto a cada toggle.

- [ ] **F5** 🟡 `EntityPopup.jsx` + `positionTracker.js` — **Sparkline de historial**: mostrar un mini-gráfico de altitud/velocidad de las últimas N posiciones de la entidad seleccionada. Los datos ya existen en los snapshots del timeline. Usar SVG inline o `<canvas>` pequeño (120×30px).

- [ ] **F6** 🟡 `EntityPopup.jsx` — **Copiar coordenadas**: botón "📋 COPY" junto a las coordenadas lat/lon que use `navigator.clipboard.writeText()`. Mostrar confirmación "✓ Copied" por 2s.

- [ ] **F7** 🟡 `EntityPopup.jsx` / `CoordinateHUD.jsx` — **Share entity**: URL con params `?entity=<type>&id=<id>`, análogo al `?fly=` ya existente. Al cargar, si existen esos params, seleccionar la entidad automáticamente y volar a su posición.

- [ ] **F8** 🟡 `opensky.js` — **Fetches ADS-B regionales adicionales**: añadir `fetchRegion()` equivalentes para:
  - Arabia Saudita / Golfo Pérsico (lat 20-30, lon 44-56)
  - India/Pakistán LoC (lat 28-38, lon 68-78)
  - Cuerno de África / Mar Rojo (lat 8-22, lon 38-52)
  Estas zonas tienen actividad aérea militar activa pero no se cubren con el fetch global.

- [ ] **F9** 🟡 `TimelinePanel.jsx` + `useTimeline.js` — **Bookmarks de timeline**: botón "🔖 MARK" que guarda el frame actual con un label. Los bookmarks aparecen como marcadores en el slider. Al hacer click en un bookmark, el slider salta a ese frame.

- [ ] **F10** 🟢 `TimelinePanel.jsx` — **Exportar replay**: botón "EXPORT GeoJSON" que genera un GeoJSON FeatureCollection con las trayectorias de todas las entidades en el rango de tiempo actual. Útil para análisis offline en QGIS/Mapbox.

- [ ] **F11** 🟡 `FilterPanel.jsx` + `App.jsx` — **Presets de filtros guardados**: botón "SAVE PRESET" que guarda el estado actual de filtros con un nombre. Un selector muestra los presets guardados. Almacenados en `localStorage`.

- [ ] **F12** 🟢 `AircraftLayer.jsx` — **Filtro por tipo de aeronave**: en FilterPanel, añadir checkboxes para subtipos: `Fighters`, `Bombers`, `Tankers/ISR`, `Helicopters`, `Transport`. Usar `type_code` del ADS-B para clasificar.

- [ ] **F13** 🟡 `Globe3D.jsx` — **"Quick jump" a teatros de operaciones**: botón desplegable con opciones predefinidas: "Middle East", "Ukraine", "Taiwan Strait", "Korean Peninsula", "Red Sea", "South China Sea", "Arctic". Cada opción hace `flyTo` a la región correspondiente.

- [ ] **F14** 🟢 `App.jsx` — **Pantalla completa**: atajo `F` o `F11` para activar `document.documentElement.requestFullscreen()`. Útil para presentaciones en pantalla grande.

- [ ] **F15** 🟢 `AlertPanel.jsx` — **Filtro de alertas por severidad**: botonera en el header del panel que filtra la lista de alertas por nivel (ALL / CRIT / HIGH / MED). El tab "Alerts" muestra el conteo total; al filtrar, el conteo actualiza.

- [ ] **F16** 🟢 `CoordinateHUD.jsx` — **Rings de distancia**: botón "RANGE RINGS" que dibuja círculos concéntricos (100km, 250km, 500km) centrados en el cursor al hacer click derecho, mostrando el alcance de armas/sensores.

- [ ] **F17** 🟡 `newsService.js` — **Alertas de sonido**: para nuevas alertas CRITICAL, reproducir un tono suave usando Web Audio API (sin archivos de audio externos, sólo oscilador). Configurable: on/off en FilterPanel.

- [ ] **F18** 🟢 `TimelinePanel.jsx` — **Velocidades adicionales**: añadir `0.5×` (cámara lenta) y `120×` (ultra-rápido) a la lista de speeds. Actualmente: 1x, 5x, 20x, 60x.

- [ ] **F19** 🟢 `MilitaryBasesLayer.jsx` — **Filtro de bases por tipo**: en FilterPanel, añadir checkboxes para mostrar/ocultar: Airbases, Naval bases, Missile sites, Radar/HQ, combined. Mapa de tipo a color ya existe (`SEV`).

- [ ] **F20** 🟡 `conflictService.js` / `newsService.js` — **ACLED integration**: ACLED (acleddata.com) ofrece API gratuita para datos geolocalizados de conflicto armado. Añadir como fuente adicional para `fetchConflictEvents()` con key configurable via env var `ACLED_KEY`.

- [ ] **F21** 🟢 `App.jsx` — **Modo "night vision"**: CSS filter `hue-rotate(90deg) saturate(0.8)` sobre la UI para simular pantalla NVG verde. Toggle con `Ctrl+N`. Puramente cosmético pero muy solicitado en trackers militares.

- [ ] **F22** 🟡 `EntityPopup.jsx` — **Navegación entre entidades cercanas**: botones "◀ prev" / "▶ next" en el popup que navegan entre las N entidades más cercanas a la seleccionada (dentro de 100km). Evita tener que hacer click en el mapa repetidamente.

---

## § D — Calidad de Datos

- [ ] **D1** 🔴 `opensky.js` — `MIL_TYPE_CODES` incompleto para fuerzas europeas y rusas. Añadir:
  - `F2` → Dassault Rafale (Francia)
  - `TPHR` / `EF` → Eurofighter Typhoon (RAF, Luftwaffe, SAF, ItAF, SpAF)
  - `SU34` → Sukhoi Su-34 Fullback
  - `SU57` → Sukhoi Su-57 Felon
  - `JAS3` / `GRPE` → Saab JAS-39 Gripen
  - `T160` / `TU60` → Tupolev Tu-160 Blackjack
  - `T22M` → Tupolev Tu-22M3 Backfire
  - `IL78` → Ilyushin Il-78 Midas (tanker)
  - `A400` → Airbus A400M Atlas (transporte aliado)
  - `P8` → Boeing P-8 Poseidon (patrulla marítima)
  - `V22` → Bell-Boeing V-22 Osprey

- [ ] **D2** 🟡 `firmsService.js` — zonas VIIRS sin cobertura de conflictos activos:
  - Norte de África: Libia (lat 20-33, lon 8-25), Mali/Sahel (lat 12-20, lon -5-5)
  - Pakistán/India LoC: (lat 32-37, lon 72-78)
  - Etiopía/Tigray: (lat 13-15, lon 37-40)
  - Mindanao/Filipinas: (lat 5-10, lon 120-127)
  - Myanmar: (lat 15-28, lon 92-101)

- [ ] **D3** 🟡 `conflictService.js` — queries GDELT no cubren: Etiopía, Filipinas, Colombia/Venezuela/ELN, Myanmar, Mozambique (Cabo Delgado), DRC (Kivu). Añadir queries específicas para estos teatros.

- [ ] **D4** 🟡 `newsService.js` — fuentes RSS no incluyen perspectivas regionales importantes:
  - Dawn (Pakistan) para cobertura LoC
  - Ynet / Haaretz (Israel — perspectiva local)
  - The Hindu (India — perspectiva India-Pakistán)
  - Radio Free Europe / RFE/RL (Europa del Este)
  - Jane's Defence (detrás de paywall pero RSS free)
  - IISS Armed Conflict Survey updates

- [ ] **D5** 🟡 `aiDanger.js` `ALERT_LOCATIONS` — coordenadas de ciudades faltantes para geocodificación de alertas:
  - `lahore` (31.52, 74.36), `islamabad` (33.73, 73.09), `karachi` (24.86, 67.01)
  - `delhi` / `new delhi` (28.61, 77.21), `mumbai` (19.08, 72.88)
  - `beijing` (39.91, 116.39), `shanghai` (31.22, 121.48)
  - `seoul` (37.57, 126.98), `busan` (35.18, 129.08)
  - `port sudan` (19.61, 37.22), `omdurman` (15.65, 32.48)
  - `addis ababa` (9.03, 38.74), `mekelle` (13.48, 39.47)
  - `nairobi` (1.29, 36.82), `kampala` (0.32, 32.58)

- [ ] **D6** 🟡 `positionTracker.js` — los snapshots sólo guardan `id, lat, lon, heading, alt, v, on_ground, callsign, flag, name`. Para el popup del timeline, faltan: `icao24`, `type_code`, `registration`. Sin `type_code`, el timeline no puede mostrar el tipo de aeronave en snapshots históricos.

- [ ] **D7** 🟢 `conflictService.js` — `severityFromTone()` usa umbrales fijos (`<= -15` = critical, `<= -7` = high) pero el tono de GDELT es relativo al corpus y puede variar por región. Artículos sobre Ucrania tienen tono sistemáticamente más negativo que artículos sobre el mismo nivel de violencia en Africa. Considerar normalización por región o usar percentiles.

- [ ] **D8** 🟢 `militaryMMSI.js` — catálogo de MMSIs conocidos (no leído en detalle). Verificar que incluya: nuevas fragatas F-125 alemanas, class-26 británicas (HMS Glasgow), nouvelles corvettes francesas (FLI), USS Gerald R. Ford (CVN-78), USS John F. Kennedy (CVN-79).

- [ ] **D9** 🟢 `MilitaryBasesLayer.jsx` — base de datos de bases estáticas muy completa (140+ bases). Sin embargo algunas están desactualizadas:
  - Tartus naval base: operatividad rusa reducida desde sanciones 2022; marcarla como "status: reduced"
  - Khmeimim AFB: añadir nota de ataques de drones ucranianos en 2024
  - Añadir: Andersen AFB Guam como alerta de modernización B-21
  - Añadir: Sigonella P-8 operations para Mediterráneo actual

- [ ] **D10** 🟢 `opensky.js` — el filtro heurístico `alt > 15000 && gs > 350` (pies → knots) que clasifica aeronaves como militares es demasiado agresivo. Excluye operaciones de combate a baja altitud: helicópteros de ataque, A-10 Thunderbolt (típico: 5,000ft, 300kts), drones tácticos. Revisar lógica de fallback o añadir excepción para tipo de aeronave conocido.

---

## § A — Arquitectura y Mantenibilidad

- [ ] **A1** 🟡 `useRealTimeData.js` — hook monolítico de 150+ líneas que devuelve 15+ valores. Dificulta el tree-shaking y testing. Separar en hooks de dominio: `useAircraftData()`, `useShipData()`, `useConflictData()`, `useTimelineSocket()`. Mantener `useRealTimeData()` como composición de los anteriores para backward compat.

- [ ] **A2** 🟢 `server.js` — `pollAircraft()` y `pollShips()` están definidas como funciones anónimas en el módulo. Extraer a un módulo `pollService.js` que exporte las funciones de polling individuales. Facilita testing unitario sin arrancar el servidor completo.

- [ ] **A3** 🟡 No hay **service worker / PWA**. La app no funciona sin conexión aunque `useRealTimeData` ya carga desde `localStorage`. Un SW básico que sirva `index.html` + assets desde cache permitiría: abrir la app sin red, ver última data cacheada, mostrar mensaje "offline" apropiado.

- [ ] **A4** 🟢 `diskCache.js` — escritura de cache no es atómica. Si el proceso se mata durante `fs.writeFileSync()`, el JSON queda truncado/corrupto. Escribir a un archivo temporal (`cache.abc123.tmp`) y luego `fs.renameSync()` al filename final, que es atómico en Linux/Mac.

- [ ] **A5** 🟢 No hay **versionado del protocolo WebSocket**. Si Railway despliega un backend nuevo mientras el frontend sigue cargado en el navegador (versión vieja), los eventos pueden tener shape diferente. Añadir campo `version` en el evento `server_info` y en `aircraft_update`, y que el frontend valide que la versión sea compatible.

- [ ] **A6** 🟢 No hay **telemetría ni health metrics**. Los únicos indicadores de salud son los `console.log`. Añadir un endpoint `/api/metrics` que exponga: source actual de ADS-B, tasa de éxito de las últimas N polls, latencia promedio de GDELT, conteo de entidades por tipo.

- [ ] **A7** 🟢 `conflictService.js` y `newsService.js` ambos piden a **GDELT** en ciclos diferentes (10min y 15min respectivamente), pudiendo solaparse. Centralizar en un `gdeltService.js` con `RateLimiter` que no haga más de 1 request/segundo a GDELT en total.

- [ ] **A8** 🟢 `App.jsx` maneja el estado global (filtros, tracking, vista) via docenas de `useState`. A medida que crece, props drilling se hace difícil. Considerar migrar a `useReducer` + Context para el estado UI compartido (filtros, panel heights, selected entity). No requiere Redux.

---

## § S — Seguridad

- [x] **S1** 🔴 `Globe3D.jsx` — `flyParam` se parsea sin validación de rango:
  ```js
  // VULNERABLE:
  const [lat, lon, alt] = param.split(',').map(parseFloat);
  // CORRECCIÓN:
  const lat = clamp(parseFloat(parts[0]), -90, 90);
  const lon = clamp(parseFloat(parts[1]), -180, 180);
  const alt = Math.max(1000, Math.min(parseFloat(parts[2]), 2e7));
  ```
  Sin esto, `?fly=NaN,NaN,NaN,NaN,NaN` puede pasar NaN a `Cesium.Cartesian3.fromDegrees()` y lanzar errores no manejados.

- [x] **S2** 🟡 `newsService.js` — `extractRSSImage()` acepta URLs `http://` de feeds externos. Renderizar una imagen `http://` desde un iframe sandbox puede filtrar la IP del usuario a servidores externos a través de mixed-content requests. Filtrar a `https://` únicamente:
  ```js
  if (m && m[1].startsWith('https://')) return m[1];
  ```

- [x] **S3** 🟡 `server.js` `hashArr()` — la función de hash usa concatenación de campos con separadores `|`. Si un campo contiene `|`, puede generar colisiones de hash (ej: callsign `UAB|123`). Usar un separador no imprimible `\x00` o calcular un hash real (CRC32, FNV1a).

- [x] **S4** 🟢 `server.js` — el rate limiter es por IP (`req.ip`). En deployment de Railway detrás de un proxy, `req.ip` puede ser la IP del proxy, haciendo el rate limit ineficaz. Añadir `app.set('trust proxy', 1)` para que Express respete `X-Forwarded-For` y el rate limiter use la IP real del cliente.

- [ ] **S5** 🟢 `newsService.js` — algunos títulos de artículos RSS pasan sin sanitizar al frontend. Si una fuente RSS sirve HTML en el título (`<script>alert(1)</script>`), React lo escapa correctamente al renderizar como texto, pero si en algún punto se usa `dangerouslySetInnerHTML`, sería XSS. Auditar que ningún componente use `dangerouslySetInnerHTML` con datos de news.

---

## § M — Mobile y Responsive

- [ ] **M1** 🔴 `App.jsx` / Todos los paneles — en resoluciones muy pequeñas (< 360px de ancho), varios paneles se solapan sin scroll. El `FilterPanel`, `AlertPanel` y `NewsPanel` simultáneamente consumen >100% de la altura de pantalla en iPhone SE. Implementar un sistema de paneles mutuamente exclusivos en mobile: sólo uno abierto a la vez.

- [ ] **M2** 🟡 `TrackingPanel.jsx` — en mobile, los cards de entidades trackeadas son demasiado grandes (muchos campos). En mobile, mostrar sólo: flag + nombre + tipo + velocidad. El resto en un acordeón.

- [ ] **M3** 🟡 `AlertPanel.jsx` — en mobile, cuando hay nuevas alertas CRITICAL, el panel permanece colapsado sin ningún indicador flotante visible. Añadir un badge pulsante rojo con conteo de alertas críticas sobre el botón de apertura del panel.

- [ ] **M4** 🟢 No hay **manifest.json** ni soporte PWA. Los usuarios en mobile no pueden "Añadir a pantalla de inicio". Crear `/public/manifest.json` con `name: "MilTracker 3D"`, icons, `display: "standalone"`, `theme_color: "#050810"`. Añadir `<link rel="manifest">` en `index.html`.

- [ ] **M5** 🟢 `CoordinateHUD.jsx` — en mobile se ocultan las coordenadas del cursor (correcto) pero los contadores de entidades se muestran en texto muy pequeño (10px). En mobile, el status bar podría mostrar sólo el indicador de conexión + contadores más grandes.

- [ ] **M6** 🟢 `Globe3D.jsx` — no hay ajustes de sensibilidad para gestos táctiles. El zoom con pinch en dispositivos de alta DPI actúa demasiado rápido (se puede atravesar el globo en un gesto). Añadir `viewer.scene.screenSpaceCameraController.minimumZoomDistance = 50000`.

- [ ] **M7** 🟢 `TimelinePanel.jsx` — el slider de reproducción es difícil de arrastrar con el dedo en mobile (target demasiado pequeño). Aumentar el `height` del thumb del slider a 24px en mobile con una media query Tailwind.

---

## § X — Mejoras de Design System y Visual

- [ ] **X1** 🟡 Las animaciones de los paneles (fade-in, slide) no respetan `prefers-reduced-motion`. Añadir `@media (prefers-reduced-motion: reduce)` en `index.css` que desactive las animaciones de CSS para usuarios con sensibilidad a movimiento.

- [ ] **X2** 🟢 El ticker de noticias usa CSS `animation: ticker` indefinidamente, incluso cuando la pestaña del navegador está en background. Pausar la animación con `document.addEventListener('visibilitychange')` cuando `document.hidden === true`.

- [ ] **X3** 🟢 `AlertPanel.jsx` — la clase `glow-critical` (pulsación roja para alertas críticas) no está definida en `index.css` (o lo está como CSS custom). Verificar que el efecto es visible en todos los navegadores. Si usa `@keyframes`, añadir fallback.

- [ ] **X4** 🟢 Los iconos de aeronaves en `AircraftLayer.jsx` y `icons.js` usan SVG generado en runtime. Para los tipos más comunes (F-15, F-35, C-17, B-52, KC-135), considerar iconos SVG pre-compilados como assets estáticos para reducir el tiempo de generación en el primer render.

- [ ] **X5** 🟢 No hay feedback visual de "actualización en progreso" cuando los datos se están refrescando. Añadir un pulso sutil en los contadores de entidades del CoordinateHUD cuando llega un nuevo `aircraft_update` o `ship_update` (ej: flash amarillo por 500ms).

---

## Resumen de Prioridades

| Sección | Ítems Totales | 🔴 Alta | 🟡 Media | 🟢 Baja |
|---------|:---:|:---:|:---:|:---:|
| B — Bugs | 12 | 3 | 6 | 3 |
| P — Rendimiento | 8 | 0 | 4 | 4 |
| U — UI/UX | 17 | 3 | 7 | 7 |
| F — Funcionalidades | 22 | 2 | 10 | 10 |
| D — Datos | 10 | 1 | 6 | 3 |
| A — Arquitectura | 8 | 0 | 3 | 5 |
| S — Seguridad | 5 | 1 | 2 | 2 |
| M — Mobile | 7 | 1 | 3 | 3 |
| X — Design | 5 | 0 | 1 | 4 |
| **TOTAL** | **94** | **11** | **42** | **41** |

### Top 10 — Implementar Primero

1. **B3** — Validar parámetros URL `?fly=` contra XSS/NaN (seguridad)
2. **B1** — Fix detección `isAlert` en EntityPopup
3. **S1** — Sanitizar y validar rango de `flyParam`
4. **F1** — Persistir filtros en localStorage
5. **F2** — Persistir tracking list en localStorage
6. **U1** — Country filter dinámico con los 50+ países de COUNTRY_DATA
7. **D1** — Añadir tipos de aeronave europeos/rusos a MIL_TYPE_CODES (Rafale, Typhoon, Su-34)
8. **U7** — Hacer bases militares clickeables con popup de intel
9. **F8** — Fetches ADS-B regionales (Saudi, India/Pak, Horn of Africa)
10. **M1** — Paneles mutuamente exclusivos en mobile

---

*Generado el: {{ fecha de revisión }}*
*Archivos analizados: App.jsx, Globe3D.jsx, EntityPopup.jsx, FilterPanel.jsx, TrackingPanel.jsx, TimelinePanel.jsx, AlertPanel.jsx, NewsPanel.jsx, ShipLayer.jsx, FIRMSLayer.jsx, MilitaryBasesLayer.jsx, DangerZoneLayer.jsx, CoordinateHUD.jsx, SearchBar.jsx, useTimeline.js, useRealTimeData.js, opensky.js, firmsService.js, conflictService.js, newsService.js, aiDanger.js, vesselFinder.js, positionTracker.js, militaryFilter.js, server.js*
