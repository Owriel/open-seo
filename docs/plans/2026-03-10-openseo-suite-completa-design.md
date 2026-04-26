# OpenSEO Suite Completa - Design Spec

**Fecha**: 2026-03-10
**Target user**: SEO profesional espanol trabajando con pymes locales
**Stack**: React 19 + TanStack Router + Cloudflare Workers + D1 SQLite + DataForSEO API

---

## Modulos

### 1. Auditoria Web mejorada (tipo Screaming Frog)

**Mejora del crawler existente.**

Que crawlea por cada URL:

- **Tecnico**: status codes (404, 301, 500), tiempo de respuesta, robots.txt, sitemap.xml, HTTPS, canonical tags, hreflang
- **SEO On-Page**: title (longitud, duplicados), meta description, H1/H2 estructura, alt text en imagenes, internal/external links rotos
- **Contenido**: word count, thin content (<300 palabras), keyword density en title/H1
- **Rendimiento**: tamano HTML, imagenes sin comprimir, recursos bloqueantes

Output:

- Dashboard con semaforo (errores rojo, avisos amarillo, ok verde) y contadores
- Lista de issues agrupadas por tipo con nivel de severidad
- Para cada error: explicacion en espanol + como arreglarlo
- Exportar informe a CSV

Limites: maximo 500 URLs por crawl, respeta robots.txt, delay configurable.

---

### 2. Analisis de Competencia

**Modulo nuevo.**

Flujo:

1. Meter dominio del cliente
2. DataForSEO devuelve competidores organicos automaticamente
3. Seleccionar 3-5 competidores
4. Ver comparativa

Dashboard comparativo:

- Tabla resumen: dominio | keywords posicionadas | trafico estimado | keywords top 3 | keywords top 10
- Keywords comunes: donde ambos rankean, con posicion de cada uno
- Keyword gaps: donde el competidor rankea y tu NO (oportunidades)
- Keyword ventajas: donde tu rankeas y el competidor NO (defender)

Acciones rapidas:

- Guardar keyword desde gaps
- Abrir dominio competidor en Domain Analysis
- Exportar comparativa a CSV

APIs DataForSEO:

- `dataforseo_labs/google/competitors/live`
- `dataforseo_labs/google/domain_intersection/live`

---

### 3. Keyword Research mejorado

**Mejora del modulo existente.**

Clustering automatico:

- Resultados se agrupan por tema semantico (palabras comunes)
- Cada cluster muestra: nombre, n keywords, volumen total
- Algoritmo simple sin IA

Scoring de prioridad (0-100):

- Basado en: volumen (alto=mejor) + dificultad (baja=mejor) + CPC (alto=mas intencion comercial)
- Semaforo: Alta >70 verde | Media 40-70 amarillo | Baja <40 rojo
- Columna ordenable por prioridad

Mejoras en guardado:

- Se guarda cluster al que pertenece
- Filtrar por cluster y prioridad en Keywords Guardadas
- Vista "Plan de contenidos": 1 pagina sugerida por cluster

---

### 4. SEO Local

**Modulo nuevo.**

Flujo:

1. Meter nombre negocio + ciudad (ej: "fontanero terrassa")
2. Ver resultados del Local Pack de Google

Dashboard:

- Local Pack results: negocios en Google Maps, posicion, rating, n resenas
- Keywords locales sugeridas: variaciones con intencion local
- Competencia local: tabla comparativa de negocios del Local Pack

Deteccion de oportunidades:

- Keywords donde Local Pack aparece pero cliente NO esta
- Comparar resenas vs competidores
- Categorias que usan competidores y cliente no

APIs DataForSEO:

- `serp/google/maps/live/advanced`
- `dataforseo_labs/google/keyword_suggestions/live`

Limitacion: datos publicos de SERPs, no Google Business API directa.

---

### 5. Rank Tracker

**Modulo nuevo.**

Flujo:

1. Seleccionar keywords de Keywords Guardadas (o anadir manualmente)
2. Asignar dominio a trackear
3. Registrar posicion actual como baseline

Dashboard:

- Tabla: keyword | posicion actual | anterior | cambio | mejor historica | URL que rankea
- Grafico de evolucion temporal (30/60/90 dias)
- Resumen: subidas | bajadas | estables | nuevas en top 100

Sistema de checks:

- Boton "Actualizar posiciones" manual
- Datos se guardan en D1 con fecha (historico acumulativo)
- No automatico (app local)

Alertas visuales:

- Sube +5 pos: badge verde
- Baja -5 pos: badge rojo
- Entra top 3: badge dorado

API DataForSEO:

- `serp/google/organic/live/regular`

---

## Criterios transversales

- Todo traducido a espanol
- Selector de pais en todos los modulos (Spain default)
- Exportar a CSV en todos
- Acciones cruzadas entre modulos
- UI consistente con DaisyUI dark theme
- Paises: Spain (2724), UK (2826), Germany (2276), France (2250), Italy (2380), Australia (2036)

---

## Orden de implementacion

1. Keyword Research mejorado (clustering + scoring)
2. Analisis de Competencia (modulo nuevo)
3. Rank Tracker (modulo nuevo, necesita esquema D1)
4. SEO Local (modulo nuevo)
5. Auditoria Web mejorada (refactor crawler)

---

## Despliegue

Pendiente de definir. Opciones: Cloudflare Workers/Pages, VPS, etc.
