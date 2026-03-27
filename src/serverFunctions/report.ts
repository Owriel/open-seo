import { createServerFn } from "@tanstack/react-start";
import { authenticatedServerFunctionMiddleware } from "@/serverFunctions/middleware";
import {
  generateReportSchema,
  getReportSchema,
  getReportsSchema,
  deleteReportSchema,
  generatePublicLinkSchema,
  disablePublicLinkSchema,
  getPublicReportSchema,
} from "@/types/schemas/report";
import { env } from "cloudflare:workers";

// Servicios y utilidades existentes
import { DomainService } from "@/server/features/domain/services/DomainService";
import {
  normalizeDomainInput,
  fetchCompetitorsDomainRaw,
  fetchDomainIntersectionRaw,
  fetchGoogleMapsResultsRaw,
  fetchKeywordSuggestionsRaw,
} from "@/server/lib/dataforseo";
import { buildCacheKey, getCached, parseJson, setCached, CACHE_TTL_SECONDS } from "@/server/lib/kv-cache";
import { analyzeOpportunities } from "@/server/lib/opportunities";
import { runMiniCrawl } from "@/server/lib/report-crawl";
import { calculateScores } from "@/server/lib/report";
import { searchPlaceByName, analyzeFicha } from "@/server/lib/multilang";

import type {
  SeoReport,
  ReportVisibility,
  ReportOpportunities,
  ReportCompetitors,
  ReportContentGap,
  ReportLocal,
  ReportTechnicalHealth,
  ReportGbp,
} from "@/types/report";
import type { CompetitorRow, KeywordIntersectionRow } from "@/types/competitors";
import type { LocalPackResult, LocalKeywordSuggestion } from "@/types/local";
import type { OpportunityKeyword } from "@/types/opportunities";

// ---------------------------------------------------------------------------
// KV helpers
// ---------------------------------------------------------------------------

function reportKey(projectId: string, reportId: string) {
  return `report:data:${projectId}:${reportId}`;
}

function reportIndexKey(projectId: string) {
  return `report:index:${projectId}`;
}

function publicReportKey(publicId: string) {
  return `report:public:${publicId}`;
}

async function loadReportIndex(projectId: string): Promise<string[]> {
  const raw = await env.KV.get(reportIndexKey(projectId), "text");
  if (!raw) return [];
  try { return parseJson<string[]>(raw); } catch { return []; }
}

async function saveReportIndex(projectId: string, ids: string[]) {
  await env.KV.put(reportIndexKey(projectId), JSON.stringify(ids));
}

// ---------------------------------------------------------------------------
// Generar informe completo
// ---------------------------------------------------------------------------

export const generateReport = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => generateReportSchema.parse(data))
  .handler(async ({ data }): Promise<SeoReport> => {
    const domain = normalizeDomainInput(data.domain, true);
    const reportId = crypto.randomUUID();

    // ===== FASE 1: Ejecutar todo en paralelo =====
    const [
      domainResult,
      competitorsResult,
      localPackResult,
      localKeywordsResult,
      technicalResult,
      gbpResult,
    ] = await Promise.all([
      // 1. Domain Overview (llamada 1)
      DomainService.getOverview({
        domain: data.domain,
        includeSubdomains: true,
        locationCode: data.locationCode,
        languageCode: data.languageCode,
      }).catch((err) => {
        console.error("[REPORT] Domain overview failed:", err);
        return null;
      }),

      // 2. Competidores (llamada 2)
      fetchCompetitorsRaw(domain, data.locationCode, data.languageCode),

      // 3. Local Pack (llamada 3, solo si hay keyword)
      data.keyword
        ? fetchLocalPackRaw(data.keyword, data.locationCode, data.languageCode)
        : Promise.resolve(null),

      // 4. Keywords locales (llamada 4, solo si hay keyword)
      data.keyword
        ? fetchLocalKeywordsRaw(data.keyword, data.locationCode, data.languageCode)
        : Promise.resolve(null),

      // 5. Mini-crawl técnico (sin coste DataForSEO)
      runMiniCrawl(data.domain).catch((err) => {
        console.error("[REPORT] Mini-crawl failed:", err);
        return {
          pagesCrawled: 0,
          issues: [],
          issuesByType: {},
          criticalCount: 0,
          warningCount: 0,
          infoCount: 0,
        } as ReportTechnicalHealth;
      }),

      // 6. GBP análisis (sin coste DataForSEO, usa Google Places API gratuita)
      data.gbpInput
        ? analyzeGbp(data.gbpInput)
        : Promise.resolve(null),
    ]);

    // ===== FASE 2: Construir secciones =====

    // Visibilidad
    const visibility: ReportVisibility = {
      organicTraffic: domainResult?.organicTraffic ?? null,
      organicKeywords: domainResult?.organicKeywords ?? null,
      topKeywords: (domainResult?.keywords ?? []).slice(0, 200).map((k) => ({
        keyword: k.keyword,
        position: k.position,
        searchVolume: k.searchVolume,
        traffic: k.traffic,
        url: k.url,
      })),
      topPages: (domainResult?.pages ?? []).slice(0, 20),
    };

    // Oportunidades (reutilizar keywords del domain overview)
    const opportunityKeywords: OpportunityKeyword[] = visibility.topKeywords.map((k) => ({
      keyword: k.keyword,
      url: k.url,
      position: k.position,
      clicks: null,
      impressions: null,
      ctr: null,
      searchVolume: k.searchVolume,
      keywordDifficulty: null,
      cpc: null,
      traffic: k.traffic,
    }));

    const oppAnalysis = analyzeOpportunities(opportunityKeywords, {
      minPosition: 4,
      maxPosition: 20,
      minImpressions: 0,
      maxCtr: null,
      onlyWithCtrGap: false,
    });

    const opportunities: ReportOpportunities = {
      results: oppAnalysis.results,
      cannibalization: oppAnalysis.cannibalization,
      totalKeywords: opportunityKeywords.length,
      totalOpportunities: oppAnalysis.results.length,
    };

    // Competidores
    const competitors: ReportCompetitors = {
      competitors: competitorsResult,
      mainCompetitor: competitorsResult.length > 0 ? competitorsResult[0].domain : null,
    };

    // Content Gap (llamada 5, secuencial porque necesita mainCompetitor)
    let contentGap: ReportContentGap;
    if (competitors.mainCompetitor) {
      const gapResult = await fetchContentGap(
        domain,
        competitors.mainCompetitor,
        data.locationCode,
        data.languageCode,
      );
      contentGap = {
        competitorDomain: competitors.mainCompetitor,
        keywords: gapResult,
        totalCount: gapResult.length,
      };
    } else {
      contentGap = { competitorDomain: "", keywords: [], totalCount: 0 };
    }

    // Local
    let local: ReportLocal | null = null;
    if (data.keyword && localPackResult) {
      // Buscar nuestro dominio en el local pack
      const cleanDomain = domain.replace(/^www\./, "");
      const ourEntry = localPackResult.find((r) =>
        r.domain?.replace(/^www\./, "") === cleanDomain || r.url?.includes(cleanDomain),
      );

      local = {
        keyword: data.keyword,
        localPackResults: localPackResult.slice(0, 10),
        localKeywords: (localKeywordsResult ?? []).slice(0, 20),
        ourPosition: ourEntry?.position ?? null,
        ourRating: ourEntry?.rating ?? null,
        ourReviewCount: ourEntry?.reviewCount ?? null,
      };
    }

    // ===== FASE 3: Calcular scores =====
    const scores = calculateScores(
      visibility,
      opportunities,
      competitors,
      contentGap,
      local,
      technicalResult,
      gbpResult,
    );

    // ===== FASE 4: Construir y guardar informe =====
    const report: SeoReport = {
      id: reportId,
      projectId: data.projectId,
      domain: data.domain,
      keyword: data.keyword,
      gbpInput: data.gbpInput,
      locationCode: data.locationCode,
      languageCode: data.languageCode,
      visibility,
      opportunities,
      competitors,
      contentGap,
      local,
      technical: technicalResult,
      gbp: gbpResult,
      scores,
      generatedAt: new Date().toISOString(),
      publicId: null,
    };

    // Guardar en KV
    await env.KV.put(reportKey(data.projectId, reportId), JSON.stringify(report));

    // Actualizar índice
    const index = await loadReportIndex(data.projectId);
    index.unshift(reportId);
    await saveReportIndex(data.projectId, index);

    return report;
  });

// ---------------------------------------------------------------------------
// Helpers internos para las llamadas DataForSEO con caché
// ---------------------------------------------------------------------------

async function fetchCompetitorsRaw(
  domain: string,
  locationCode: number,
  languageCode: string,
): Promise<CompetitorRow[]> {
  const cacheKey = buildCacheKey("comp:find", {
    target: domain,
    locationCode,
    languageCode,
  });

  const cached = await getCached<{ competitors: CompetitorRow[] }>(cacheKey);
  if (cached?.competitors?.length) return cached.competitors;

  try {
    const rawItems = await fetchCompetitorsDomainRaw(domain, locationCode, languageCode, 10);
    const competitors: CompetitorRow[] = rawItems
      .filter((item) => item.domain && item.domain !== domain)
      .map((item) => {
        const metricsObj = item.full_domain_metrics ?? {};
        type MetricsEntry = { organic?: { etv?: number | null; count?: number | null } };
        // eslint-disable-next-line typescript/no-unsafe-type-assertion
        const firstEntry = Object.values(metricsObj)[0] as MetricsEntry | undefined;
        const organicMetrics = firstEntry?.organic;
        return {
          domain: item.domain ?? "",
          organicKeywords: organicMetrics?.count ?? 0,
          organicTraffic: Math.round(organicMetrics?.etv ?? 0),
          commonKeywords: item.intersections ?? 0,
          avgPosition: Math.round((item.avg_position ?? 0) * 10) / 10,
        };
      })
      .filter((c) => c.domain.length > 0);

    if (competitors.length > 0) {
      await setCached(cacheKey, { competitors }, CACHE_TTL_SECONDS, {
        label: `Competidores: ${domain}`,
        params: { domain, locationCode },
      });
    }
    return competitors;
  } catch (err) {
    console.error("[REPORT] Competitors failed:", err);
    return [];
  }
}

async function fetchContentGap(
  ourDomain: string,
  competitorDomain: string,
  locationCode: number,
  languageCode: string,
): Promise<KeywordIntersectionRow[]> {
  const cacheKey = buildCacheKey("comp:intersection", {
    domain1: ourDomain,
    domain2: competitorDomain,
    locationCode,
    languageCode,
    mode: "gaps",
    limit: 50,
  });

  const cached = await getCached<{ keywords: KeywordIntersectionRow[] }>(cacheKey);
  if (cached?.keywords?.length) return cached.keywords;

  try {
    const rawItems = await fetchDomainIntersectionRaw(
      ourDomain,
      competitorDomain,
      locationCode,
      languageCode,
      50,
      "target2_not_target1",
    );

    const keywords: KeywordIntersectionRow[] = rawItems
      .filter((item) => item.keyword)
      .map((item) => ({
        keyword: item.keyword ?? "",
        searchVolume: item.keyword_data?.keyword_info?.search_volume ?? null,
        cpc: item.keyword_data?.keyword_info?.cpc ?? null,
        keywordDifficulty: item.keyword_data?.keyword_properties?.keyword_difficulty ?? null,
        intent: item.keyword_data?.search_intent_info?.main_intent ?? null,
        myRank: item.first_domain_serp_element?.rank_absolute ?? null,
        myEtv: item.first_domain_serp_element?.etv ?? null,
        competitorRank: item.second_domain_serp_element?.rank_absolute ?? null,
        competitorEtv: item.second_domain_serp_element?.etv ?? null,
      }));

    if (keywords.length > 0) {
      await setCached(cacheKey, { keywords, totalCount: keywords.length }, CACHE_TTL_SECONDS, {
        label: `Content Gap: ${ourDomain} vs ${competitorDomain}`,
        params: { domain1: ourDomain, domain2: competitorDomain, mode: "gaps" },
      });
    }
    return keywords;
  } catch (err) {
    console.error("[REPORT] Content gap failed:", err);
    return [];
  }
}

async function fetchLocalPackRaw(
  keyword: string,
  locationCode: number,
  languageCode: string,
): Promise<LocalPackResult[]> {
  const cacheKey = buildCacheKey("local:pack", { keyword, locationCode, languageCode });
  const cached = await getCached<{ results: LocalPackResult[] }>(cacheKey);
  if (cached?.results?.length) return cached.results;

  try {
    const rawItems = await fetchGoogleMapsResultsRaw(keyword, locationCode, languageCode, 20);
    const results: LocalPackResult[] = rawItems
      .filter((item) => item.title)
      .map((item, idx) => {
        let googleMapsUrl: string | null = null;
        if (item.cid) googleMapsUrl = `https://www.google.com/maps?cid=${item.cid}`;
        else if (item.place_id) googleMapsUrl = `https://www.google.com/maps/place/?q=place_id:${item.place_id}`;

        return {
          title: item.title ?? "",
          rating: item.rating?.value ?? null,
          reviewCount: item.rating?.votes_count ?? null,
          ratingDistribution: item.rating_distribution ?? null,
          position: item.rank_group ?? idx + 1,
          category: item.category ?? null,
          additionalCategories: (item.additional_categories ?? []).filter(Boolean),
          address: item.address ?? null,
          city: item.address_info?.city ?? null,
          phone: item.phone ?? null,
          url: item.url ?? null,
          contactUrl: item.contact_url ?? null,
          bookOnlineUrl: item.book_online_url ?? null,
          domain: item.domain ?? null,
          isClaimed: item.is_claimed ?? null,
          snippet: item.snippet ?? null,
          googleMapsUrl,
          mainImage: item.main_image ?? null,
          totalPhotos: item.total_photos ?? null,
          priceLevel: item.price_level ?? null,
          workHours: null,
          localJustifications: (item.local_justifications ?? []).map((j) => j.description ?? "").filter(Boolean),
          latitude: item.latitude ?? null,
          longitude: item.longitude ?? null,
        };
      });

    if (results.length > 0) {
      await setCached(cacheKey, { results }, CACHE_TTL_SECONDS, {
        label: `Local Pack: ${keyword}`,
        params: { keyword, locationCode },
      });
    }
    return results;
  } catch (err) {
    console.error("[REPORT] Local pack failed:", err);
    return [];
  }
}

async function fetchLocalKeywordsRaw(
  keyword: string,
  locationCode: number,
  languageCode: string,
): Promise<LocalKeywordSuggestion[]> {
  const cacheKey = buildCacheKey("local:keywords", { keyword, locationCode, languageCode, limit: 30 });
  const cached = await getCached<{ keywords: LocalKeywordSuggestion[] }>(cacheKey);
  if (cached?.keywords?.length) return cached.keywords;

  try {
    const rawItems = await fetchKeywordSuggestionsRaw(keyword, locationCode, languageCode, 30);
    const localTerms = new Set(["cerca", "cerca de mi", "near me", "mejor", "mejores", "barato", "precio", "urgente", "24h", "abierto"]);

    const keywords: LocalKeywordSuggestion[] = rawItems
      .filter((item) => item.keyword)
      .map((item) => {
        const kw = (item.keyword ?? "").toLowerCase();
        return {
          keyword: item.keyword ?? "",
          searchVolume: item.keyword_info?.search_volume ?? null,
          cpc: item.keyword_info?.cpc ?? null,
          keywordDifficulty: item.keyword_properties?.keyword_difficulty ?? null,
          intent: item.search_intent_info?.main_intent ?? null,
          hasLocalPack: Array.from(localTerms).some((t) => kw.includes(t)),
        };
      });

    if (keywords.length > 0) {
      await setCached(cacheKey, { keywords }, CACHE_TTL_SECONDS, {
        label: `Keywords locales: ${keyword}`,
        params: { keyword, locationCode },
      });
    }
    return keywords;
  } catch (err) {
    console.error("[REPORT] Local keywords failed:", err);
    return [];
  }
}

async function analyzeGbp(gbpInput: string): Promise<ReportGbp | null> {
  try {
    // Buscar la ficha
    const placeResult = await searchPlaceByName(gbpInput);
    if (!placeResult) return null;

    // Crear ficha temporal para analizar
    const tempFicha = {
      id: crypto.randomUUID(),
      inputName: placeResult.name,
      url: placeResult.mapsUrl || null,
      baseName: null,
      ftid: null,
      variants: [],
      baseLanguages: [],
      allResults: [],
      totalLanguagesChecked: 0,
      lastAnalyzed: null,
      status: "pending" as const,
      error: null,
      categoryId: null,
      addedAt: new Date().toISOString(),
    };

    // Analizar en 81 idiomas
    const fichaData = await analyzeFicha(tempFicha);

    return {
      name: placeResult.name,
      baseName: fichaData.baseName ?? placeResult.name,
      variants: fichaData.variants ?? [],
      totalLanguagesChecked: fichaData.totalLanguagesChecked ?? 81,
      hasProblematicVariants: (fichaData.variants?.length ?? 0) > 0,
    };
  } catch (err) {
    console.error("[REPORT] GBP analysis failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// CRUD de informes
// ---------------------------------------------------------------------------

export const getReport = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => getReportSchema.parse(data))
  .handler(async ({ data }): Promise<SeoReport | null> => {
    const raw = await env.KV.get(reportKey(data.projectId, data.reportId), "text");
    if (!raw) return null;
    try { return parseJson<SeoReport>(raw); } catch { return null; }
  });

export const getReports = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => getReportsSchema.parse(data))
  .handler(async ({ data }): Promise<{ reports: Array<{ id: string; domain: string; score: number; generatedAt: string }> }> => {
    const index = await loadReportIndex(data.projectId);
    const reports: Array<{ id: string; domain: string; score: number; generatedAt: string }> = [];

    for (const id of index) {
      const raw = await env.KV.get(reportKey(data.projectId, id), "text");
      if (raw) {
        try {
          const report = parseJson<SeoReport>(raw);
          reports.push({
            id: report.id,
            domain: report.domain,
            score: report.scores.global.score,
            generatedAt: report.generatedAt,
          });
        } catch { /* skip */ }
      }
    }
    return { reports };
  });

export const deleteReport = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => deleteReportSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    // Leer informe para limpiar link público si existe
    const raw = await env.KV.get(reportKey(data.projectId, data.reportId), "text");
    if (raw) {
      try {
        const report = parseJson<SeoReport>(raw);
        if (report.publicId) {
          await env.KV.delete(publicReportKey(report.publicId));
        }
      } catch { /* ignore */ }
    }

    await env.KV.delete(reportKey(data.projectId, data.reportId));
    const index = await loadReportIndex(data.projectId);
    await saveReportIndex(data.projectId, index.filter((id) => id !== data.reportId));
    return { success: true };
  });

// ---------------------------------------------------------------------------
// Link público
// ---------------------------------------------------------------------------

export const generatePublicLink = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => generatePublicLinkSchema.parse(data))
  .handler(async ({ data }): Promise<{ publicId: string }> => {
    const raw = await env.KV.get(reportKey(data.projectId, data.reportId), "text");
    if (!raw) throw new Error("NOT_FOUND");

    const report = parseJson<SeoReport>(raw);

    // Si ya tiene publicId, reutilizarlo
    if (report.publicId) {
      return { publicId: report.publicId };
    }

    const publicId = crypto.randomUUID();
    report.publicId = publicId;

    // Guardar informe actualizado
    await env.KV.put(reportKey(data.projectId, data.reportId), JSON.stringify(report));

    // Guardar mapeo público → datos del informe (sin projectId por seguridad)
    await env.KV.put(publicReportKey(publicId), JSON.stringify(report));

    return { publicId };
  });

export const disablePublicLink = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => disablePublicLinkSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    const raw = await env.KV.get(reportKey(data.projectId, data.reportId), "text");
    if (!raw) throw new Error("NOT_FOUND");

    const report = parseJson<SeoReport>(raw);
    if (report.publicId) {
      await env.KV.delete(publicReportKey(report.publicId));
      report.publicId = null;
      await env.KV.put(reportKey(data.projectId, data.reportId), JSON.stringify(report));
    }

    return { success: true };
  });

// ---------------------------------------------------------------------------
// Informe público (sin auth)
// ---------------------------------------------------------------------------

export const getPublicReport = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => getPublicReportSchema.parse(data))
  .handler(async ({ data }): Promise<SeoReport | null> => {
    const raw = await env.KV.get(publicReportKey(data.reportId), "text");
    if (!raw) return null;
    try { return parseJson<SeoReport>(raw); } catch { return null; }
  });
