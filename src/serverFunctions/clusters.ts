import { createServerFn } from "@tanstack/react-start";
import { authenticatedServerFunctionMiddleware } from "@/serverFunctions/middleware";
import {
  clusterSearchSchema,
  saveClusterPlanSchema,
  deleteClusterPlanSchema,
  getClusterPlansSchema,
} from "@/types/schemas/clusters";
import {
  fetchKeywordSuggestionsRaw,
  fetchRelatedKeywordsRaw,
} from "@/server/lib/dataforseo";
import {
  buildCacheKey,
  getCached,
  parseJson,
  setCached,
  CACHE_TTL_SECONDS,
} from "@/server/lib/kv-cache";
import { env } from "cloudflare:workers";
import type { ClusterGroup, ClusterKeywordRow, ClusterPlan } from "@/types/clusters";
import {
  clusterKeywords,
  calculatePriorityScore,
} from "@/client/features/keywords/utils";

// Helpers para persistencia KV de planes
function indexKey(projectId: string) {
  return `cluster:index:${projectId}`;
}

function planKey(projectId: string, planId: string) {
  return `cluster:plan:${projectId}:${planId}`;
}

async function loadIndex(projectId: string): Promise<string[]> {
  const raw = await env.KV.get(indexKey(projectId), "text");
  if (!raw) return [];
  try {
    return parseJson<string[]>(raw);
  } catch {
    return [];
  }
}

async function saveIndex(projectId: string, ids: string[]) {
  await env.KV.put(indexKey(projectId), JSON.stringify(ids));
}

export const generateClusters = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => clusterSearchSchema.parse(data))
  .handler(async ({ data }): Promise<{ clusters: ClusterGroup[]; pillarKeyword: string }> => {
    // Check KV cache
    const cacheKey = buildCacheKey("cluster:gen", {
      keyword: data.keyword,
      locationCode: data.locationCode,
      languageCode: data.languageCode,
    });

    const cachedRaw = await getCached<{ clusters: ClusterGroup[]; pillarKeyword: string }>(cacheKey);
    if (cachedRaw && cachedRaw.clusters?.length > 0) {
      return cachedRaw;
    }

    // Llamar en paralelo a suggestions + related
    const [suggestionsRaw, relatedRaw] = await Promise.all([
      fetchKeywordSuggestionsRaw(data.keyword, data.locationCode, data.languageCode, 150),
      fetchRelatedKeywordsRaw(data.keyword, data.locationCode, data.languageCode, 150),
    ]);

    // Normalizar a formato uniforme y deduplicar
    const keywordMap = new Map<string, ClusterKeywordRow>();

    for (const item of suggestionsRaw) {
      const kw = (item.keyword ?? "").toLowerCase().trim();
      if (!kw || keywordMap.has(kw)) continue;
      const vol = item.keyword_info?.search_volume ?? null;
      const diff = item.keyword_properties?.keyword_difficulty ?? null;
      const cpc = item.keyword_info?.cpc ?? null;
      const intent = item.search_intent_info?.main_intent ?? null;
      keywordMap.set(kw, {
        keyword: kw,
        searchVolume: vol,
        keywordDifficulty: diff,
        cpc,
        intent,
        priority: calculatePriorityScore(vol, diff, cpc),
      });
    }

    for (const item of relatedRaw) {
      // RelatedKeywordItem tiene datos dentro de keyword_data
      const kd = item.keyword_data;
      const kw = (kd?.keyword ?? "").toLowerCase().trim();
      if (!kw || keywordMap.has(kw)) continue;
      const vol = kd?.keyword_info?.search_volume ?? null;
      const diff = kd?.keyword_properties?.keyword_difficulty ?? null;
      const cpc = kd?.keyword_info?.cpc ?? null;
      const intent = kd?.search_intent_info?.main_intent ?? null;
      keywordMap.set(kw, {
        keyword: kw,
        searchVolume: vol,
        keywordDifficulty: diff,
        cpc,
        intent,
        priority: calculatePriorityScore(vol, diff, cpc),
      });
    }

    // Convertir a array para clusterKeywords
    const allKeywords = [...keywordMap.values()];

    // Aplicar clustering por bigrams (función pura, reutilizable en server)
    const rawClusters = clusterKeywords(allKeywords, data.keyword);

    // Mapear a nuestro tipo ClusterGroup con keywords detalladas
    const clusters: ClusterGroup[] = rawClusters.map((c) => ({
      name: c.name,
      keywords: c.keywords.map((kw) => keywordMap.get(kw) ?? {
        keyword: kw,
        searchVolume: null,
        keywordDifficulty: null,
        cpc: null,
        intent: null,
        priority: null,
      }),
      totalVolume: c.totalVolume,
      avgDifficulty: c.avgDifficulty,
      avgCpc: c.avgCpc,
      avgPriority: c.avgPriority,
      count: c.count,
    }));

    const result = { clusters, pillarKeyword: data.keyword };

    // Cache
    if (clusters.length > 0) {
      await setCached(cacheKey, result, CACHE_TTL_SECONDS, {
        label: `Clusters: ${data.keyword}`,
        params: { keyword: data.keyword, locationCode: data.locationCode },
      });
    }

    return result;
  });

export const saveClusterPlan = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => saveClusterPlanSchema.parse(data))
  .handler(async ({ data }): Promise<{ planId: string }> => {
    const planId = crypto.randomUUID();
    const plan: ClusterPlan = {
      id: planId,
      name: data.name,
      pillarKeyword: data.pillarKeyword,
      clusters: data.clusters,
      savedAt: new Date().toISOString(),
    };

    // Guardar plan en KV
    await env.KV.put(planKey(data.projectId, planId), JSON.stringify(plan));

    // Actualizar índice
    const index = await loadIndex(data.projectId);
    index.unshift(planId);
    await saveIndex(data.projectId, index);

    return { planId };
  });

export const getClusterPlans = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => getClusterPlansSchema.parse(data))
  .handler(async ({ data }): Promise<{ plans: ClusterPlan[] }> => {
    const index = await loadIndex(data.projectId);
    const plans: ClusterPlan[] = [];

    for (const id of index) {
      const raw = await env.KV.get(planKey(data.projectId, id), "text");
      if (raw) {
        try {
          plans.push(parseJson<ClusterPlan>(raw));
        } catch {
          // Skip corruptos
        }
      }
    }

    return { plans };
  });

export const deleteClusterPlan = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => deleteClusterPlanSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    // Eliminar plan
    await env.KV.delete(planKey(data.projectId, data.planId));

    // Actualizar índice
    const index = await loadIndex(data.projectId);
    const filtered = index.filter((id) => id !== data.planId);
    await saveIndex(data.projectId, filtered);

    return { success: true };
  });
