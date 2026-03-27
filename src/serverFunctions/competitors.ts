import { createServerFn } from "@tanstack/react-start";
import { authenticatedServerFunctionMiddleware } from "@/serverFunctions/middleware";
import {
  findCompetitorsSchema,
  keywordIntersectionSchema,
} from "@/types/schemas/competitors";
import {
  fetchCompetitorsDomainRaw,
  fetchDomainIntersectionRaw,
  normalizeDomainInput,
} from "@/server/lib/dataforseo";
import {
  buildCacheKey,
  getCached,
  setCached,
  CACHE_TTL,
} from "@/server/lib/kv-cache";

import type { CompetitorRow, KeywordIntersectionRow } from "@/types/competitors";

export const findCompetitors = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => findCompetitorsSchema.parse(data))
  .handler(async ({ data }): Promise<{ competitors: CompetitorRow[] }> => {
    const target = normalizeDomainInput(data.domain, data.includeSubdomains);

    // Check KV cache
    const cacheKey = buildCacheKey("comp:find", {
      target,
      locationCode: data.locationCode,
      languageCode: data.languageCode,
    });

    const cachedRaw = await getCached<{ competitors: CompetitorRow[] }>(cacheKey);
    if (cachedRaw && cachedRaw.competitors?.length > 0) {
      return cachedRaw;
    }

    const rawItems = await fetchCompetitorsDomainRaw(
      target,
      data.locationCode,
      data.languageCode,
      20,
    );

    const competitors: CompetitorRow[] = rawItems
      .filter((item) => item.domain && item.domain !== target)
      .map((item) => {
        // Extract organic metrics from full_domain_metrics (the key varies by location)
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

    // Cache the result
    if (competitors.length > 0) {
      await setCached(cacheKey, { competitors }, CACHE_TTL.competitors, {
        label: `Competidores: ${data.domain}`,
        params: { domain: data.domain, locationCode: data.locationCode },
      });
    }

    return { competitors };
  });

export const getKeywordIntersection = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => keywordIntersectionSchema.parse(data))
  .handler(async ({ data }): Promise<{ keywords: KeywordIntersectionRow[]; totalCount: number }> => {
    // Check KV cache
    const cacheKey = buildCacheKey("comp:intersection", {
      domain1: data.domain1,
      domain2: data.domain2,
      locationCode: data.locationCode,
      languageCode: data.languageCode,
      mode: data.mode,
      limit: data.limit,
    });

    const cachedRaw = await getCached<{ keywords: KeywordIntersectionRow[]; totalCount: number }>(cacheKey);
    if (cachedRaw && cachedRaw.keywords?.length > 0) {
      return cachedRaw;
    }

    const intersectionType =
      data.mode === "gaps"
        ? ("target2_not_target1" as const)
        : data.mode === "advantages"
          ? ("target1_not_target2" as const)
          : ("common" as const);

    // For "common" mode, don't exclude intersections
    const excludeIntersections = intersectionType !== "common";

    const rawItems = await fetchDomainIntersectionRaw(
      data.domain1,
      data.domain2,
      data.locationCode,
      data.languageCode,
      data.limit,
      excludeIntersections ? intersectionType : "all",
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

    const result = { keywords, totalCount: keywords.length };

    // Cache the result
    if (keywords.length > 0) {
      await setCached(cacheKey, result, CACHE_TTL.keywordIntersection, {
        label: `Intersección: ${data.domain1} vs ${data.domain2}`,
        params: { domain1: data.domain1, domain2: data.domain2, mode: data.mode },
      });
    }

    return result;
  });
