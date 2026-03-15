# OpenSeo — Notas del proyecto

## Stack
- TanStack Start + React + Cloudflare Workers + KV (D1, R2)
- Wrangler para deploy y dev local
- Auth: HMAC-signed cookies (credenciales: Jesus/Alonsito1234_)
- wrangler.jsonc: AUTH_MODE: "local_noauth" para desarrollo

---

## Módulo Multiidioma (Revisor Multilang)

### Qué hace
Analiza fichas de Google Business Profile en **81 idiomas** para detectar variantes multiidioma del nombre del negocio (ej: "Reformas Nou Cabanyal S.L." en español vs "Reformes Nou Cabanyal" en catalán).

### Archivos clave
- `src/server/lib/multilang.ts` — Lógica core del análisis
- `src/serverFunctions/multilang.ts` — Server functions (TanStack)
- `src/routes/p/$projectId/multilang.tsx` — Frontend/UI del módulo
- `src/types/multilang.ts` — Tipos e interfaces, lista de 81 GOOGLE_LANGUAGES
- `src/types/schemas/multilang.ts` — Schemas Zod (tiene schemas no usados: `prepareFichaAnalysisSchema`, `saveAnalysisResultsSchema` — se pueden limpiar)

### Flujo de análisis (marzo 2026)

1. **Entrada**: nombre de negocio o URL de Google Maps
2. **Buscar placeId**: vía `searchPlaceByName()` → Google Places API Text Search
3. **Resolver ftid**: vía `decodeFtidFromPlaceId()` (decode base64 del placeId, offsets 3 y 12, little-endian uint64) — sin API calls
4. **Obtener nombres en 81 idiomas**: vía `fetchNameViaPlacesAPI()` → Google Places API Place Details GET (`/v1/places/{placeId}?languageCode={lang}`) con FieldMask `displayName`
5. **Agrupar variantes**: nombres diferentes al baseName (español) se agrupan como variantes multiidioma

### Decisiones técnicas importantes

#### Por qué Places API y no la API interna de Google Maps
- La API interna (`/maps/preview/place`) **NO funciona desde Cloudflare Workers IPs** — Google bloquea/devuelve vacío
- Google Places API (New) Place Details con FieldMask `displayName` es campo **Basic = gratuito**
- Funciona perfectamente desde CF Workers

#### Por qué decodeFtidFromPlaceId
- Extrae el ftid hexadecimal directamente del placeId (formato protobuf base64) **sin ninguna llamada API**
- Offsets: byte 3 → primera parte hex (little-endian uint64), byte 12 → segunda parte hex
- Ejemplo: placeId `ChIJscz7vmdIYA0RMULPCPpQ1Co` → ftid `0xd604867befbccb1:0x2ad450fa08cf4231`

#### Configuración de batches
- CONCURRENCY = 5 (no más, algunos idiomas fallan por timeout con 10)
- BATCH_DELAY = 500ms entre batches
- Timeout por petición = 15s
- Primero prueba "es" como test — si falla, devuelve error con debug info

### API Key
- Google Places API: `AIzaSyBu7TCezaciiRXVVwtPKUmmoDPOzbZ_D_o`

### Funciones legacy (aún presentes)
- `fetchNameForLang()` — usa API interna de Google Maps (NO funciona desde CF Workers). Se sigue usando como fallback en `resolveFtid()` para resolver ftids parciales (formato `0x0:0xHEX`). Podría eliminarse si no se necesita esa resolución
- `resolveUrl()` — sigue redirects para extraer ftid de URLs de Maps
- `extractFtidFromUrl()` — regex simple para sacar ftid de una URL

### Problemas conocidos y resueltos
1. **Google Maps internal API bloqueada desde CF Workers** → Solucionado con Places API oficial
2. **ftid resolution sin API** → Solucionado con `decodeFtidFromPlaceId()` (decode protobuf)
3. **CORS bloquea fetch a google.com desde browser** → No aplica, todo el análisis corre server-side en CF Workers
4. **`window.confirm()` bloquea tab del navegador** → Cuidado al usar MCP tools, el confirm() en `handleRefreshAll` bloquea la interacción

### Pendientes / Limpieza
- Eliminar schemas no usados en `src/types/schemas/multilang.ts`
- `fetchNameForLang()` podría eliminarse si ya no se necesita resolver ftids parciales (0x0:0xHEX) — evaluar si resolveFtid sigue siendo necesaria con el nuevo flujo
- La `googleMapsUri` de Google Places API devuelve URLs con `?cid=DECIMAL`, no hex ftids

---

## Otros módulos

_(Documentar aquí conforme se trabaje en otros módulos)_
