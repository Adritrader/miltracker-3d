# LiveWar3D — Auditoría completa (2026-11-17)

> Revisión de todo el proyecto (frontend, backend, despliegue, SEO, diseño) hecha sobre el código del commit `5689957` y sobre la web en producción (`livewar3d.com`).
> Complementa a [CHECKLIST.md](CHECKLIST.md): aquí solo aparece lo **nuevo**. Lo que ya estaba anotado allí como pendiente se resume en la [sección 9](#9-pendientes-que-ya-estaban-en-checklistmd).
>
> **Leyenda:** `[x]` hecho en esta sesión · `[ ]` pendiente · 🔴 alto · 🟠 medio · 🟢 bajo

## Resumen

| Área | Hecho | Pendiente | Lo más importante que queda |
|------|:----:|:--------:|------------------------------|
| Bugs y fiabilidad | 10 | 1 | `daily_stats` guarda el último valor del día |
| Seguridad y privacidad | 5 | 8 | El plan Pro solo se comprueba en el navegador |
| Rendimiento | 5 | 6 | Estelas: una entidad Cesium por segmento |
| Arquitectura y código | 8 | 5 | Tests y ESLint (siguen a cero) |
| Diseño, UX y accesibilidad | 4 | 8 | Texto de 8–10 px |
| SEO y contenido | 3 | 4 | Las URL inexistentes devuelven 200 (soft 404) |
| Funcionalidades | 0 | 8 | Enlace "Ajustes de cookies" y enlaces directos a entidades |

**Verificado:** el frontend compila (`npm run build`), todos los archivos del backend pasan `node --check` y probé `planFromSubscription()` con los dos formatos de Stripe.
**No verificado:** no arranqué el backend ni abrí la app en un navegador. El `.env` local puede tener credenciales de producción (tuitearía y escribiría en Supabase), así que los cambios de servidor y de interfaz están sin probar en ejecución. El nuevo `vercel.json` solo se puede comprobar desplegando.
**Nada está commiteado:** todos los cambios están en el árbol de trabajo para que los revises.

**Actualización 2026-11-17 (segunda sesión):** 12 puntos pendientes más cerrados (marcados abajo como **Hecho**). El frontend compila y el backend pasa `node --check`; tampoco se han probado en navegador.

---

## 1. Bugs y fiabilidad

### Hecho

- [x] 🔴 **El webhook de Stripe respondía 200 aunque fallara al guardar el plan.** Si Supabase tenía un corte en ese momento, Stripe daba el evento por entregado y el usuario pagaba sin recibir Pro (o cancelaba sin perderlo). Ahora responde 500 y Stripe reintenta durante 3 días — `backend/server.js`.
- [x] 🔴 **Fecha de fin de plan vacía con las versiones nuevas de la API de Stripe.** Desde 2025-03-31 `current_period_end` está en el item de la suscripción, no en la suscripción. Los webhooks usan la versión del endpoint, no la del cliente, así que `plan_expires_at` podía quedar en `null`. Ahora se lee de los dos sitios — `backend/services/stripeService.js`.
- [x] 🟠 **Tras pagar, Pro no se activaba hasta cerrar el aviso o recargar.** El plan lo pone un webhook que llega unos segundos después de la redirección. Ahora la app relee el perfil cada 3 s (máx. 30 s) hasta ver Pro — `frontend/src/App.jsx`.
- [x] 🟠 **Cada conexión recibía todos los datos dos veces.** El servidor ya envía todo al conectar y el cliente lo volvía a pedir con `request_data`, cuyo filtro `since` nunca descartaba nada en la primera conexión. Eliminada la petición del cliente — `frontend/src/hooks/useRealTimeData.js`.
- [x] 🟠 **Un sondeo en vivo se marcaba como "caché" cuando caía el feed `/mil`.** Se miraba solo `aircraft[0].source`; con `/mil` caído el primero es de un feed regional, así que no se guardaba la caché en disco. Ahora se comprueba si algún avión se obtuvo en este sondeo. Las estadísticas de actividad por región siguen exigiendo un `/mil` fresco — `backend/server.js`.
- [x] 🟠 **`localStorage` sin proteger tiraba la app entera.** En modos privados o con almacenamiento bloqueado, `localStorage.getItem` lanza una excepción; en `PromoModalTrigger` y en tres `useState` de `App.jsx` no había `try/catch` ni `ErrorBoundary` por encima.
- [x] 🟢 **`pollNews` podía solaparse consigo mismo** (va con `setInterval` y la llamada a Gemini puede tardar). Añadido un candado.
- [x] 🟢 **Se perdían hasta 5 min de historial del timeline en cada redeploy.** `shutdown()` ahora guarda el buffer antes de cerrar.

### Pendiente

- [x] 🔴 **Aviones civiles en un mapa "militar".** `fetchRegion()` acepta cualquier avión a más de 15.000 ft y 350 kt (`backend/services/opensky.js:268`), es decir, todos los aviones de línea en crucero sobre el Golfo, el Báltico, Corea, etc. Salen en blanco como "Other". Opciones: quitar esa regla, o descartar los que tengan indicativo de aerolínea (3 letras + número) y no estén marcados como militares. **Hecho:** se acepta la marca militar `dbFlags` de readsb; la regla "rápido y alto" ya no deja pasar tipos de avión de línea ni de jet privado, ni indicativos de aerolínea.
- [x] 🟠 **`trailPointsRef` nunca se limpia** (`AircraftLayer.jsx`): los aviones que desaparecen se quedan en el mapa de estelas y se reescriben en IndexedDB cada 15 s. En una sesión larga crece sin límite. **Hecho:** se olvidan las estelas de aviones que llevan 30 min sin aparecer en el feed.
- [ ] 🟢 **`daily_stats` guarda el último valor del día, no el máximo ni la media**, aunque el comentario dice "peak/end-of-day". Las gráficas diarias dependen de la hora del último sondeo.

---

## 2. Seguridad y privacidad

### Hecho

- [x] 🔴 **Google Analytics se cargaba antes de pedir consentimiento.** El banner guardaba la elección pero nada la leía. Añadido Consent Mode v2: por defecto `denied`, pasa a `granted` al pulsar "Accept all" y se recuerda en visitas posteriores — `frontend/index.html`, `CookieBanner.jsx`. **Efecto:** GA dejará de medir con cookies a quien no acepte (seguirás viendo datos modelados).
- [x] 🟠 **El error en bruto de Gemini se emitía a todos los clientes** por `ai_insight` (nombre del modelo, detalles de cuota). Ahora va un texto genérico; el detalle queda en el log.
- [x] 🟠 **Los emails del newsletter se escribían en los logs** de Railway cuando fallaba la base de datos. Eliminado.
- [x] 🟠 **Vulnerabilidades en dependencias** (`npm audit fix`, solo subidas de parche/minor): backend 11 → 1, frontend 26 → 6. Las que quedan son de herramientas de build (`workbox-build`, `glob`) y exigen un cambio de versión mayor de `vite-plugin-pwa`; la del backend es `qs` (moderada).
- [x] 🟢 **Las cabeceras de `vercel.json` no se estaban sirviendo.** En producción no aparece `Permissions-Policy`: el bloque `headers` no se aplica junto a `routes`. Movidas dentro de `routes` y añadidas `X-Content-Type-Options` y `Referrer-Policy`. ⚠️ Comprobar tras desplegar con `curl -I https://livewar3d.com`.

### Pendiente

- [ ] 🔴 **El plan Pro solo se comprueba en el navegador.** Noticias completas, cámaras, historial, analíticas y el timeline llegan a todos por socket o por `/api/*` sin autenticación; el frontend solo los oculta. Cualquiera con las DevTools o `curl` tiene Pro gratis. Para cerrarlo: `requireAuth` + comprobación de plan en `/api/history/*`, `/api/analytics/*`, `/api/cameras` y `/api/aircraft/intel`, y recortar en el servidor lo que se emite a sockets sin plan.
- [ ] 🔴 **`VITE_ADMIN_EMAILS` se publica dentro del bundle** (`useSubscription.js`): cualquiera puede leer los emails de administrador. Mover la marca de admin a una columna de `profiles`.
- [ ] 🟠 **Los anuncios de Monetag se cargan sin consentimiento.** Para visitantes de la UE hace falta consentimiento previo. No lo he tocado porque afecta a ingresos: decide si condicionarlo al banner.
- [ ] 🟠 **El reCAPTCHA no protege el registro.** El navegador pregunta al backend si el token vale y luego llama a Supabase por su cuenta; un bot se salta el primer paso. Supabase Auth tiene captcha nativo (Turnstile/hCaptcha) que sí se valida en servidor.
- [ ] 🟠 **`getSocketIp()` usa la primera IP de `X-Forwarded-For`**, que el cliente puede falsificar para saltarse el límite por IP. No lo cambié: si Railway tiene más de un proxy delante, usar la última IP agruparía a todos los usuarios y repetiría el bloqueo masivo de septiembre. Hay que mirar qué cabecera llega realmente en Railway.
- [ ] 🟠 **CORS acepta cualquier `*.vercel.app`, `*.railway.app` y `*.onrender.com`.** Cualquiera puede montar un clon que use tu backend. Limitar a los dominios propios.
- [ ] 🟢 **`REST_API_KEY` rompería la app si se activa**: ningún `fetch` del frontend envía `X-Api-Key`. O se elimina la opción o se documenta que es solo para un backend privado.
- [ ] 🟢 **Newsletter**: sin doble opt-in, sin baja, sin límite propio, y responde `ok` aunque no haya base de datos (el email se pierde; ahora al menos queda un aviso en el log).

---

## 3. Rendimiento

### Hecho

- [x] 🔴 **Bundle inicial a la mitad: 961 kB → 483 kB (280 → 144 kB gzip).** `HistoryPanel` (con recharts, 421 kB), los modales de login, cuenta, legal, newsletter, cámara, satélite y SITREP se cargan ahora bajo demanda con `React.lazy` — `frontend/src/App.jsx`. Añadida una recarga automática única si falla la carga de un chunk tras un deploy — `frontend/src/main.jsx`.
- [x] 🟠 **Se gastaba cuota de Gemini en usuarios gratuitos.** Al abrir la ficha de un avión se pedía `/api/aircraft/intel` siempre, aunque el resultado solo se muestra a Pro — `EntityPopup.jsx`.
- [x] 🟢 Eliminado el import muerto de `PricingModal` en `App.jsx` (el componente no se usa en ningún sitio).

### Pendiente

- [ ] 🔴 **Estelas: una entidad Cesium por segmento.** Hasta 39 segmentos por avión; con 500 aviones son ~19.000 entidades de polilínea. Usar una sola polilínea por avión (o una `PolylineCollection`) reduciría mucho la carga en móvil.
- [ ] 🟠 **Render continuo a 60 fps** (`requestRenderMode = false`) aunque nada cambie: batería y calor en móvil. Alternativa: `requestRenderMode = true` y pedir frame solo durante los 10 s de interpolación.
- [ ] 🟠 **`preserveDrawingBuffer: true` siempre activo** solo para la captura SITREP (función Pro). Penaliza a todos; se puede capturar en `postRender` sin esa opción.
- [ ] 🟠 **`resolutionScale` hasta 2× en móvil**: cuadruplica los píxeles. Probar 1,5 en pantallas pequeñas.
- [ ] 🟠 **`history_data` puede pesar varios MB**: 120 instantáneas × todos los aviones y barcos en un solo mensaje. Enviar solo posiciones cuantizadas o paginar.
- [ ] 🟠 **Los assets con hash se sirven con `max-age=14400, must-revalidate`** (comprobado en producción). Deberían ser `immutable` a 1 año. Lo más seguro es una Cache Rule de Cloudflare para `/assets/*`; no lo puse en `vercel.json` porque la ruta comodín devolvería `index.html` cacheado un año para un chunk inexistente.
- [x] 🟢 **La regla PWA `/api/` nunca se cumple**: el backend está en otro dominio y esa expresión solo casa en el mismo origen. Es código muerto (y si casara, cachearía `/api/profile`). **Hecho:** regla eliminada.
- [x] 🟢 **El service worker precachea ahora los chunks diferidos** (29 entradas, 1,3 MB). Se puede excluir `HistoryPanel-*.js` con `globIgnores` para que solo lo bajen los Pro. **Hecho:** `HistoryPanel-*.js` excluido; el precacheo baja a 28 entradas y 938 kB.

---

## 4. Arquitectura y código

### Hecho

- [x] 🟠 **CI añadido** (`.github/workflows/ci.yml`): en cada push/PR compila el frontend y pasa `node --check` a todo el backend. Sin dependencias nuevas.
- [x] 🟠 **El keep-alive nunca fallaba** (`|| echo` tapaba el error). Ahora es diario, falla si el backend no responde o si `database != ok`, y GitHub te avisa por email: cubre el punto "alerta automática" que seguía pendiente en CHECKLIST.md §11.
- [x] 🟢 **`.gitignore` tenía una línea corrupta en UTF-16** que no ignoraba nada; por eso `HistoryPanel.jsx.bak` (687 líneas) estaba versionado. Línea corregida (`*.bak`) y archivo eliminado del repo.
- [x] 🟢 **`ShipLayer` compartía `ErrorBoundary` con `AircraftLayer`**: un fallo en una ocultaba las dos. Ahora cada una tiene el suyo.

### Pendiente

- [ ] 🔴 **Sin tests ni ESLint** (ya anotado). El CI nuevo detecta errores de sintaxis y de build, pero no una variable indefinida como la que rompió la capa de aviones en octubre. Añadir ESLint con `no-undef` al CI es el siguiente paso de menor coste.
- [ ] 🟠 **Los `ErrorBoundary` silenciosos esconden las capas rotas.** Así pasó desapercibido el fallo de octubre. Mostrar un aviso discreto ("capa de aviones no disponible") y enviar el error a GA o Sentry.
- [x] 🟠 **`VITE_BACKEND_URL || 'http://localhost:3001'` repetido en 13 archivos.** Centralizar en `utils/config.js`. **Hecho:** `frontend/src/utils/config.js`.
- [ ] 🟠 **Las analíticas devuelven `[]` cuando falla la base de datos**, mientras `/api/history/*` responde 503. El panel no distingue "sin datos" de "error".
- [x] 🟠 **`past_due` degrada a gratis al instante.** Stripe reintenta el cobro varios días; lo habitual es mantener Pro durante ese periodo. **Hecho:** Pro se mantiene en `past_due` (backend y frontend).
- [ ] 🟢 **Código muerto**: `PricingModal.jsx` (213 líneas), `isInOpZone` en `server.js`, el handler `request_data` del servidor (ya sin emisor), basemaps `sentinel`/`gibs` en `Globe3D.jsx`, 5 imports sin usar en `EntityPopup.jsx`, `backend/tweet-test.mjs`, `scripts/archive/`.
- [ ] 🟢 **9 archivos `.md` en la raíz, 5 de ellos obsoletos** según el propio CHECKLIST.md (`STATUS`, `AUDIT`, `AUDIT_v2`, `REVIEW2`, `ROADMAP`). Mover a `docs/archive/`. El README sigue titulado "MILTRACKER 3D".
- [x] 🟢 **Versión incoherente**: `/api/status` dice `2.1.0`, `backend/package.json` dice `1.0.0`. **Hecho:** `backend/package.json` pasa a `2.1.0`.
- [x] 🟢 **Comentarios con codificación rota** (`â€”`) en `PromoModal.jsx`. **Hecho.**

---

## 5. Diseño, UX y accesibilidad

> Revisado leyendo el código, no en pantalla: conviene confirmar cada punto en un móvil real.

### Hecho

- [x] 🟠 **Se respeta "reducir movimiento" del sistema**: glitch, parpadeo, pulsos y ticker se desactivan con `prefers-reduced-motion` — `frontend/src/index.css`.
- [x] 🟢 Las cadencias de actualización que se anunciaban no coincidían con las reales (ver sección 6).

### Pendiente

- [x] 🔴 **Avalancha de avisos en la primera visita**: overlay de carga, banner de cookies, anuncio a los 3 s, modal de precios a los 12 s y avisos de vuelos notables. El modal de precios y el banner comparten `z-index` 300 y se pisan. Propuesta: no mostrar la promo hasta que se cierre el banner y tras una interacción real (p. ej. abrir la segunda ficha). **Hecho en parte:** la promo ya no sale a los 12 s: espera a que se conteste el banner de cookies y a que se abra y cierre la segunda ficha. Queda el anuncio de Monetag a los 3 s.
- [ ] 🔴 **Texto demasiado pequeño**: 257 usos de `text-[8px]`, `[9px]` o `[10px]`. En móvil es ilegible. Mínimo recomendable: 11–12 px.
- [ ] 🟠 **Contraste insuficiente** en textos secundarios: `#4a5568` sobre `#050810` da ~2,4:1 (el mínimo AA es 4,5:1). Afecta al pie legal y a varias etiquetas.
- [ ] 🟠 **Accesibilidad de teclado y lector de pantalla**: 10 `aria-label` para 117 botones (muchos son solo un icono o una "X"), ningún modal con `role="dialog"`/`aria-modal` ni foco atrapado.
- [ ] 🟠 **`user-scalable=no, maximum-scale=1`** impide hacer zoom a personas con baja visión. El canvas ya tiene `touch-action: none`, así que se puede quitar sin afectar a los gestos del globo (probar en iOS).
- [x] 🟠 **La tabla de precios dice "Limited" para aviones y barcos en el plan gratuito, pero no existe ningún límite.** El `<noscript>` y el FAQ dicen "full access". Unificar el mensaje. **Hecho:** la tabla del modal de precios dice ahora acceso completo en ambos planes.
- [ ] 🟠 **Precios escritos a mano en el frontend** (9,99 $/mes; anual 6,66 × 12 = 79,92 $) mientras el comentario de `stripeService.js` habla de ~95,88 $/año. Confirmar contra los precios reales de Stripe.
- [ ] 🟢 **Las líneas de escaneo (`.scan-overlay`, z-998) cubren también modales y fotos.** Limitarlas al globo.
- [ ] 🟢 **Estilos mezclados**: clases Tailwind junto a `style={{…}}` con colores hex repetidos (`#00ff88`, `#050810`, `#00e5ff`) en vez de los tokens `hud-*`.
- [ ] 🟢 **Botón de cierre "X" y marcas "[S]" / "[+]"** en el modal de precios: quedan como texto provisional; usar iconos.

---

## 6. SEO y contenido

### Hecho

- [x] 🟠 **El FAQ (JSON-LD) anunciaba cadencias falsas**: "noticias cada 15 min, conflictos cada hora, IA cada 5 min". Las reales son 5 min, 10 min y ~30 min. Corregido — `frontend/index.html`.

### Pendiente

- [x] 🟠 **`og-preview.png` pesa 1,35 MB.** WhatsApp y otros no muestran vista previa por encima de ~300–600 kB. Exportar como JPG de 1200×630 a menos de 200 kB. **Hecho:** `og-preview.jpg` de 1200×630 y 72 kB; referencias actualizadas en `index.html`, páginas de conflicto y `sitemap.xml`.
- [ ] 🟠 **Cualquier URL inexistente devuelve 200 con la app** (comprobado: `/this-page-does-not-exist` → 200). Google lo trata como "soft 404". Añadir una página 404 real.
- [x] 🟢 **Tres imágenes de ~1 MB** en `public/images/mil/` (`BM21_Grad_rocket.jpg`, `M198_howitzer_firing.jpg`, `SeaWolf_missile_firing.jpg`) y una duplicada (`Bayraktar_TB2.jpg` = `Bayraktar_TB2_drone.jpg`). Redimensionar a ~800 px. **Hecho:** redimensionadas a 800 px (97–149 kB) y borrado el duplicado. Ninguna de las cinco está en la lista `_LOCAL` de `mediaLookup.js`, así que la app no las usa.
- [ ] 🟢 **`sitemap.xml` con `lastmod` de 2026-09-04**; las páginas legales, de 2026-07-29.
- [ ] 🟢 **Meta `keywords` con ~60 términos** y etiquetas sin efecto (`revisit-after`, `distribution`, `target`, `coverage`). Google las ignora; se pueden borrar.
- [ ] 🟢 **Las 6 páginas de conflicto son estáticas** (fecha de septiembre). Regenerarlas periódicamente con datos reales del backend les daría valor real para buscadores e IA.

---

## 7. Funcionalidades propuestas

- [ ] 🟠 **Enlace "Ajustes de cookies"** en el pie. Hoy la política dice que para retirar el consentimiento hay que borrar `localStorage` desde las DevTools.
- [ ] 🟠 **Enlace directo a una entidad** (`?aircraft=ae1234`, `?ship=…`). Ya existe `?fly=`; esto permitiría compartir "mira este avión" y daría URLs indexables.
- [ ] 🟠 **Indicador de antigüedad de los datos** visible ("aviones: hace 40 s") y aviso claro cuando la fuente está caída, en vez de solo el estado del socket.
- [ ] 🟠 **Alertas por email o Telegram** para vuelos notables o zonas seguidas: es el argumento más fuerte para Pro y ya existe la detección (`NotableFlights`).
- [ ] 🟢 **Botón "norte arriba" y vista inicial** (ya pendiente en CHECKLIST.md §3).
- [ ] 🟢 **Ayuda de primer uso**: tres pistas sobre qué significan colores e iconos, en lugar del modal de precios como primer contacto.
- [ ] 🟢 **Widget embebible (`/embed`)** para medios y blogs: tráfico y enlaces entrantes.
- [ ] 🟢 **Español** como segundo idioma (i18n ya pendiente).

---

## 8. Qué hacer después de revisar estos cambios

1. Revisar el diff y hacer commit (no he commiteado nada).
2. Desplegar y comprobar: `curl -I https://livewar3d.com` debe mostrar `permissions-policy`, `x-content-type-options` y `referrer-policy`.
3. Probar en el navegador: abrir login, cuenta, legal y newsletter (ahora se cargan bajo demanda); con una cuenta Pro, el panel de historial y SITREP.
4. Probar el banner de cookies: con "Essential only" no debe aparecer la cookie `_ga`; con "Accept all", sí.
5. En Stripe (modo test): completar un pago y confirmar que Pro aparece solo en menos de 30 s.
6. En GitHub: confirmar que existe el secreto `BACKEND_URL`; si no, el keep-alive diario fallará (antes fallaba en silencio).

**Orden recomendado para lo pendiente:** plan Pro en servidor (§2) → aviones civiles (§1) → estelas (§3) → avalancha de avisos y tamaño de texto (§5) → ESLint en CI (§4).

---

## 9. Pendientes que ya estaban en CHECKLIST.md

Siguen abiertos y no se repiten arriba: validar el crash de Cesium en móvil real (§3), `AISSTREAM_KEY` y MMSI inventados (§4.1), `server.js` monolítico y logging estructurado (§4), Sentry (§4), difusión de arrays completos sin deltas (§4), Context API / TypeScript / i18n (§5), tests (§6), Docker y documentación de despliegue (§8), y la acción manual de ejecutar `setup_new_project.sql` y configurar las claves del proyecto Supabase nuevo (§11).
