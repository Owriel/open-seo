import { createServerFn } from "@tanstack/react-start";
import { authenticatedServerFunctionMiddleware } from "@/serverFunctions/middleware";
import { serpAnalysisSchema } from "@/types/schemas/serp";
import { fetchLiveSerpItemsRaw } from "@/server/lib/dataforseo";
import {
  buildCacheKey,
  getCached,
  setCached,
  CACHE_TTL_SECONDS,
} from "@/server/lib/kv-cache";
import type {
  SerpAnalysisResult,
  SerpResultRow,
  SerpFeature,
  SerpDominantDomain,
  SerpRecommendation,
  SerpIntentAnalysis,
} from "@/types/serp";

// Tipos de features SERP que detectamos
const SERP_FEATURE_TYPES: { type: string; label: string }[] = [
  { type: "featured_snippet", label: "Featured Snippet" },
  { type: "people_also_ask", label: "People Also Ask" },
  { type: "local_pack", label: "Local Pack" },
  { type: "video", label: "Video" },
  { type: "images", label: "Imágenes" },
  { type: "knowledge_panel", label: "Knowledge Panel" },
  { type: "shopping", label: "Shopping" },
  { type: "top_stories", label: "Noticias" },
  { type: "twitter", label: "Twitter/X" },
  { type: "related_searches", label: "Búsquedas relacionadas" },
];

// Reglas de recomendaciones basadas en features detectadas
function generateRecommendations(
  features: SerpFeature[],
  topResults: SerpResultRow[],
): SerpRecommendation[] {
  const recs: SerpRecommendation[] = [];
  const presentTypes = new Set(
    features.filter((f) => f.present).map((f) => f.type),
  );

  if (presentTypes.has("featured_snippet")) {
    recs.push({
      type: "featured_snippet",
      title: "Optimiza para Featured Snippet",
      description:
        "Hay un featured snippet activo. Estructura tu contenido con preguntas y respuestas directas, listas o tablas para capturarlo.",
      priority: "alta",
    });
  } else {
    recs.push({
      type: "featured_snippet_opportunity",
      title: "Oportunidad de Featured Snippet",
      description:
        "No hay featured snippet para esta keyword. Crea contenido con respuestas claras y directas para ocupar esta posición.",
      priority: "media",
    });
  }

  if (presentTypes.has("people_also_ask")) {
    recs.push({
      type: "people_also_ask",
      title: "Crea sección FAQ",
      description:
        "Google muestra People Also Ask. Añade una sección de preguntas frecuentes con respuestas concisas y markup FAQ schema.",
      priority: "alta",
    });
  }

  if (presentTypes.has("video")) {
    recs.push({
      type: "video",
      title: "Incluye contenido en video",
      description:
        "Hay resultados de video en la SERP. Crea un video explicativo y embébelo en tu contenido para competir en este carrusel.",
      priority: "media",
    });
  }

  if (presentTypes.has("local_pack")) {
    recs.push({
      type: "local_pack",
      title: "Optimiza Google Business Profile",
      description:
        "Aparece un Local Pack. Asegúrate de tener tu ficha de Google Business optimizada con categorías, fotos y reseñas.",
      priority: "alta",
    });
  }

  if (presentTypes.has("images")) {
    recs.push({
      type: "images",
      title: "Optimiza imágenes",
      description:
        "Google muestra un carrusel de imágenes. Usa imágenes originales con alt text descriptivo y nombres de archivo optimizados.",
      priority: "baja",
    });
  }

  if (presentTypes.has("shopping")) {
    recs.push({
      type: "shopping",
      title: "Intent transaccional detectado",
      description:
        "Aparecen resultados de Shopping. Esta keyword tiene fuerte intent de compra. Considera contenido comparativo o de producto.",
      priority: "media",
    });
  }

  if (presentTypes.has("knowledge_panel")) {
    recs.push({
      type: "knowledge_panel",
      title: "Knowledge Panel activo",
      description:
        "Google muestra un Knowledge Panel. Usa datos estructurados (Schema.org) para aumentar tus posibilidades de aparecer.",
      priority: "baja",
    });
  }

  // Análisis de longitud/competencia de top 3
  const top3 = topResults.slice(0, 3);
  const top3Domains = top3.map((r) => r.domain);
  const bigDomains = [
    "wikipedia.org",
    "amazon.es",
    "amazon.com",
    "youtube.com",
    "facebook.com",
  ];
  const hasBigCompetitors = top3Domains.some((d) =>
    bigDomains.some((big) => d.includes(big)),
  );

  if (hasBigCompetitors) {
    recs.push({
      type: "big_competitors",
      title: "Competencia fuerte en top 3",
      description:
        "Hay dominios de gran autoridad en las primeras posiciones. Enfócate en long-tail o en un ángulo de contenido diferenciado.",
      priority: "media",
    });
  }

  return recs;
}

// Análisis de intent basado en tipos de resultado presentes
function analyzeIntent(features: SerpFeature[]): SerpIntentAnalysis {
  const presentTypes = new Set(
    features.filter((f) => f.present).map((f) => f.type),
  );
  const signals: string[] = [];
  let primaryIntent = "informacional";

  if (presentTypes.has("shopping")) {
    primaryIntent = "transaccional";
    signals.push("Resultados de Shopping presentes");
  }

  if (presentTypes.has("local_pack")) {
    primaryIntent = "local";
    signals.push("Local Pack visible");
  }

  if (presentTypes.has("knowledge_panel")) {
    signals.push("Knowledge Panel → intent informacional/navegacional");
  }

  if (presentTypes.has("people_also_ask")) {
    signals.push("People Also Ask → intent informacional");
  }

  if (presentTypes.has("featured_snippet")) {
    signals.push("Featured Snippet → intent informacional directo");
  }

  if (presentTypes.has("video")) {
    signals.push("Resultados de video → contenido multimedia relevante");
  }

  if (presentTypes.has("images")) {
    signals.push("Carrusel de imágenes → componente visual importante");
  }

  if (signals.length === 0) {
    signals.push("SERP estándar sin features especiales");
  }

  return { primaryIntent, signals };
}

export const analyzeSerpResults = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => serpAnalysisSchema.parse(data))
  .handler(async ({ data }): Promise<SerpAnalysisResult> => {
    // Check KV cache
    const cacheKey = buildCacheKey("serp:analysis", {
      keyword: data.keyword,
      locationCode: data.locationCode,
      languageCode: data.languageCode,
    });

    const cachedRaw = await getCached<SerpAnalysisResult>(cacheKey);
    if (cachedRaw && cachedRaw.topResults?.length > 0) {
      return cachedRaw;
    }

    const serpItems = await fetchLiveSerpItemsRaw(
      data.keyword,
      data.locationCode,
      data.languageCode,
    );

    // 1. Extraer top 10 orgánicos
    const topResults: SerpResultRow[] = serpItems
      .filter((item) => item.type === "organic")
      .slice(0, 10)
      .map((item) => ({
        position: item.rank_absolute ?? item.rank_group ?? 0,
        title: item.title ?? "",
        url: item.url ?? "",
        domain: item.domain ?? "",
        description: item.description ?? "",
        etv: item.etv ?? null,
      }));

    // 2. Detectar features presentes
    const itemTypes = new Set(serpItems.map((item) => item.type));
    const features: SerpFeature[] = SERP_FEATURE_TYPES.map((ft) => ({
      type: ft.type,
      label: ft.label,
      present: itemTypes.has(ft.type),
    }));

    // 3. Calcular dominios dominantes (todos los orgánicos)
    const domainCounts = new Map<string, number>();
    for (const item of serpItems) {
      if (item.type === "organic" && item.domain) {
        domainCounts.set(item.domain, (domainCounts.get(item.domain) ?? 0) + 1);
      }
    }
    const dominantDomains: SerpDominantDomain[] = [...domainCounts.entries()]
      .map(([domain, count]) => ({ domain, count }))
      .toSorted((a, b) => b.count - a.count)
      .slice(0, 10);

    // 4. Análisis de intent
    const intentAnalysis = analyzeIntent(features);

    // 5. Generar recomendaciones
    const recommendations = generateRecommendations(features, topResults);

    const result: SerpAnalysisResult = {
      keyword: data.keyword,
      topResults,
      features,
      dominantDomains,
      intentAnalysis,
      recommendations,
    };

    // Cache con TTL estándar (30 días)
    if (topResults.length > 0) {
      await setCached(cacheKey, result, CACHE_TTL_SECONDS, {
        label: `SERP: ${data.keyword}`,
        params: { keyword: data.keyword, locationCode: data.locationCode },
      });
    }

    return result;
  });
