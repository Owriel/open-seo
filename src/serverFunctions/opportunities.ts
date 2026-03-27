import { createServerFn } from "@tanstack/react-start";
import { authenticatedServerFunctionMiddleware } from "@/serverFunctions/middleware";
import {
  analyzeWithDataforseoSchema,
  analyzeWithCsvSchema,
  analyzeWithGscSchema,
  gscAuthUrlSchema,
  gscCallbackSchema,
  gscStatusSchema,
  gscDisconnectSchema,
  saveAnalysisSchema,
  getAnalysesSchema,
  deleteAnalysisSchema,
} from "@/types/schemas/opportunities";
import {
  fetchRankedKeywordsRaw,
  normalizeDomainInput,
  type DomainRankedKeywordItem,
} from "@/server/lib/dataforseo";
import {
  analyzeOpportunities,
} from "@/server/lib/opportunities";
import {
  buildCacheKey,
  getCached,
  parseJson,
  setCached,
  CACHE_TTL_SECONDS,
} from "@/server/lib/kv-cache";
import { env } from "cloudflare:workers";
import type {
  OpportunityKeyword,
  OpportunityAnalysis,
  OpportunityResult,
  CannibalizationGroup,
  GscConnectionStatus,
} from "@/types/opportunities";

// ---------------------------------------------------------------------------
// Helpers KV para persistencia de análisis
// ---------------------------------------------------------------------------

function analysisIndexKey(projectId: string) {
  return `opp:index:${projectId}`;
}

function analysisKey(projectId: string, analysisId: string) {
  return `opp:analysis:${projectId}:${analysisId}`;
}

async function loadAnalysisIndex(projectId: string): Promise<string[]> {
  const raw = await env.KV.get(analysisIndexKey(projectId), "text");
  if (!raw) return [];
  try {
    return parseJson<string[]>(raw);
  } catch {
    return [];
  }
}

async function saveAnalysisIndex(projectId: string, ids: string[]) {
  await env.KV.put(analysisIndexKey(projectId), JSON.stringify(ids));
}

// ---------------------------------------------------------------------------
// Helpers GSC OAuth
// ---------------------------------------------------------------------------

function gscTokenKey(projectId: string) {
  return `gsc:tokens:${projectId}`;
}

type GscTokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  email: string | null;
};

async function getGscTokens(projectId: string): Promise<GscTokens | null> {
  const raw = await env.KV.get(gscTokenKey(projectId), "text");
  if (!raw) return null;
  try {
    return parseJson<GscTokens>(raw);
  } catch {
    return null;
  }
}

async function refreshGscAccessToken(projectId: string, tokens: GscTokens): Promise<GscTokens | null> {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!resp.ok) return null;

  const data: { access_token: string; expires_in: number } = await resp.json();
  const updated: GscTokens = {
    ...tokens,
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  await env.KV.put(gscTokenKey(projectId), JSON.stringify(updated));
  return updated;
}

async function getValidGscToken(projectId: string): Promise<string | null> {
  const tokens = await getGscTokens(projectId);
  if (!tokens) return null;

  // Si el token expira en menos de 5 minutos, refrescar
  if (tokens.expires_at < Date.now() + 5 * 60 * 1000) {
    const refreshed = await refreshGscAccessToken(projectId, tokens);
    return refreshed?.access_token ?? null;
  }

  return tokens.access_token;
}

// ---------------------------------------------------------------------------
// Normalización de datos de DataForSEO a OpportunityKeyword
// ---------------------------------------------------------------------------

function normalizeDataforseoItem(item: DomainRankedKeywordItem): OpportunityKeyword | null {
  const keywordData = item.keyword_data;
  const keywordInfo = keywordData?.keyword_info;
  const keywordProperties = keywordData?.keyword_properties;
  const rankedSerpElement = item.ranked_serp_element;
  const serpItem = rankedSerpElement?.serp_item;

  const keyword = keywordData?.keyword ?? item.keyword;
  if (!keyword) return null;

  const url = serpItem?.url ?? rankedSerpElement?.url ?? null;
  const position = serpItem?.rank_absolute ?? rankedSerpElement?.rank_absolute ?? null;
  const traffic = serpItem?.etv ?? rankedSerpElement?.etv ?? null;

  return {
    keyword,
    url,
    position: position != null ? Math.round(position) : null,
    clicks: null, // DataForSEO no tiene clics reales de GSC
    impressions: null,
    ctr: null,
    searchVolume: keywordInfo?.search_volume != null ? Math.round(keywordInfo.search_volume) : null,
    keywordDifficulty: keywordProperties?.keyword_difficulty != null
      ? Math.round(keywordProperties.keyword_difficulty)
      : null,
    cpc: keywordInfo?.cpc ?? null,
    traffic: traffic ?? null,
  };
}

// ===========================================================================================
// FASE 1: Análisis con DataForSEO
// ===========================================================================================

export const analyzeWithDataforseo = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => analyzeWithDataforseoSchema.parse(data))
  .handler(async ({ data }) => {
    const domain = normalizeDomainInput(data.domain, true);

    // Cache
    const cacheKey = buildCacheKey("opp:dataforseo", {
      domain,
      locationCode: data.locationCode,
      languageCode: data.languageCode,
    });

    const cached = await getCached<{ keywords: OpportunityKeyword[] }>(cacheKey);
    let keywords: OpportunityKeyword[];

    if (cached?.keywords?.length) {
      keywords = cached.keywords;
    } else {
      // Pedir hasta 700 keywords ordenadas por volumen para tener suficientes datos
      const rawItems = await fetchRankedKeywordsRaw(
        domain,
        data.locationCode,
        data.languageCode,
        700,
        ["keyword_data.keyword_info.search_volume,desc"],
      );

      keywords = rawItems
        .map(normalizeDataforseoItem)
        .filter((kw): kw is OpportunityKeyword => kw != null);

      if (keywords.length > 0) {
        await setCached(cacheKey, { keywords }, CACHE_TTL_SECONDS, {
          label: `Oportunidades: ${data.domain}`,
          params: { domain: data.domain, locationCode: data.locationCode },
        });
      }
    }

    // Analizar oportunidades
    const { results, cannibalization } = analyzeOpportunities(keywords, data.filters);

    return {
      results,
      cannibalization,
      totalKeywords: keywords.length,
      totalOpportunities: results.length,
      source: "dataforseo" as const,
    };
  });

// ===========================================================================================
// FASE 2: Análisis con CSV (datos parseados en cliente)
// ===========================================================================================

export const analyzeWithCsv = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => analyzeWithCsvSchema.parse(data))
  .handler(async ({ data }) => {
    // Normalizar filas CSV a OpportunityKeyword
    const keywords: OpportunityKeyword[] = data.rows.map((row) => ({
      keyword: row.keyword,
      url: row.url,
      position: row.position,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      searchVolume: null,
      keywordDifficulty: null,
      cpc: null,
      traffic: null,
    }));

    const { results, cannibalization } = analyzeOpportunities(keywords, data.filters);

    return {
      results,
      cannibalization,
      totalKeywords: keywords.length,
      totalOpportunities: results.length,
      source: "csv" as const,
    };
  });

// ===========================================================================================
// FASE 3: Google Search Console API
// ===========================================================================================

/** Genera URL de autorización OAuth2 para GSC */
export const getGscAuthUrl = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => gscAuthUrlSchema.parse(data))
  .handler(async ({ data }) => {
    const clientId = env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return { url: null, error: "GOOGLE_CLIENT_ID no configurado en wrangler.jsonc" };
    }

    // Construir redirect URI dinámicamente
    // En CF Workers no hay req.url accesible aquí, usamos una var de entorno
    const baseUrl = env.APP_URL ?? "http://localhost:5173";
    const redirectUri = `${baseUrl}/auth/gsc-callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/userinfo.email",
      access_type: "offline",
      prompt: "consent",
      state: data.projectId,
    });

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      error: null,
    };
  });

/** Intercambia el code de OAuth por tokens y los guarda en KV */
export const handleGscCallback = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => gscCallbackSchema.parse(data))
  .handler(async ({ data }) => {
    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;
    const baseUrl = env.APP_URL ?? "http://localhost:5173";
    const redirectUri = `${baseUrl}/auth/gsc-callback`;

    if (!clientId || !clientSecret) {
      return { success: false, error: "Credenciales Google no configuradas" };
    }

    // Intercambiar code por tokens
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: data.code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResp.ok) {
      const errText = await tokenResp.text();
      console.error("[GSC] Token exchange failed:", errText);
      return { success: false, error: "Error al intercambiar el código OAuth" };
    }

    const tokenData: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    } = await tokenResp.json();

    // Obtener email del usuario
    let email: string | null = null;
    try {
      const userResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userResp.ok) {
        const userData: { email: string } = await userResp.json();
        email = userData.email;
      }
    } catch {
      // No crítico
    }

    const tokens: GscTokens = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
      email,
    };

    await env.KV.put(gscTokenKey(data.projectId), JSON.stringify(tokens));

    return { success: true, error: null, email };
  });

/** Comprueba el estado de conexión GSC para un proyecto */
export const getGscStatus = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => gscStatusSchema.parse(data))
  .handler(async ({ data }): Promise<GscConnectionStatus> => {
    const tokens = await getGscTokens(data.projectId);
    if (!tokens) {
      return { connected: false, email: null, properties: null };
    }

    // Intentar obtener las propiedades de GSC
    const accessToken = await getValidGscToken(data.projectId);
    if (!accessToken) {
      return { connected: false, email: tokens.email, properties: null };
    }

    try {
      const resp = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok) {
        return { connected: false, email: tokens.email, properties: null };
      }
      const sitesData: { siteEntry?: Array<{ siteUrl: string }> } = await resp.json();
      const properties = (sitesData.siteEntry ?? []).map((s) => s.siteUrl);
      return { connected: true, email: tokens.email, properties };
    } catch {
      return { connected: false, email: tokens.email, properties: null };
    }
  });

/** Desconecta GSC para un proyecto */
export const disconnectGsc = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => gscDisconnectSchema.parse(data))
  .handler(async ({ data }) => {
    await env.KV.delete(gscTokenKey(data.projectId));
    return { success: true };
  });

const formatDate = (d: Date) => d.toISOString().split("T")[0];

/** Analiza keywords de oportunidad usando datos de GSC */
export const analyzeWithGsc = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => analyzeWithGscSchema.parse(data))
  .handler(async ({ data }) => {
    const accessToken = await getValidGscToken(data.projectId);
    if (!accessToken) {
      throw new Error("GSC no conectado. Conecta tu cuenta de Google Search Console primero.");
    }

    // Calcular rango de fechas
    const endDate = new Date();
    const startDate = new Date();
    const rangeMap: Record<string, number> = {
      "7d": 7, "28d": 28, "3m": 90, "6m": 180, "12m": 365, "16m": 480,
    };
    startDate.setDate(startDate.getDate() - (rangeMap[data.dateRange] ?? 90));

    // Consultar GSC Search Analytics API — queries + pages
    const gscResp = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(data.siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions: ["query", "page"],
          rowLimit: 5000,
          startRow: 0,
        }),
      },
    );

    if (!gscResp.ok) {
      const errText = await gscResp.text();
      console.error("[GSC] Search Analytics failed:", errText);
      throw new Error("Error al consultar Google Search Console");
    }

    const gscData: {
      rows?: Array<{
        keys: string[];
        clicks: number;
        impressions: number;
        ctr: number;
        position: number;
      }>;
    } = await gscResp.json();

    const rows = gscData.rows ?? [];

    // Normalizar a OpportunityKeyword
    const keywords: OpportunityKeyword[] = rows.map((row) => ({
      keyword: row.keys[0],
      url: row.keys[1] ?? null,
      position: row.position != null ? Math.round(row.position * 10) / 10 : null,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr != null ? Math.round(row.ctr * 10000) / 100 : null, // GSC devuelve decimal, convertir a %
      searchVolume: null,
      keywordDifficulty: null,
      cpc: null,
      traffic: null,
    }));

    const { results, cannibalization } = analyzeOpportunities(keywords, data.filters);

    return {
      results,
      cannibalization,
      totalKeywords: keywords.length,
      totalOpportunities: results.length,
      source: "gsc" as const,
    };
  });

// ===========================================================================================
// Guardar / Cargar / Eliminar análisis
// ===========================================================================================

export const saveOpportunityAnalysis = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => saveAnalysisSchema.parse(data))
  .handler(async ({ data }): Promise<{ analysisId: string }> => {
    const analysisId = crypto.randomUUID();
    const analysis: OpportunityAnalysis = {
      id: analysisId,
      domain: data.domain,
      source: data.source,
      results: data.results as OpportunityResult[],
      cannibalization: data.cannibalization as CannibalizationGroup[],
      totalKeywords: data.totalKeywords,
      totalOpportunities: data.totalOpportunities,
      savedAt: new Date().toISOString(),
      filters: data.filters,
    };

    await env.KV.put(analysisKey(data.projectId, analysisId), JSON.stringify(analysis));

    const index = await loadAnalysisIndex(data.projectId);
    index.unshift(analysisId);
    await saveAnalysisIndex(data.projectId, index);

    return { analysisId };
  });

export const getOpportunityAnalyses = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => getAnalysesSchema.parse(data))
  .handler(async ({ data }): Promise<{ analyses: OpportunityAnalysis[] }> => {
    const index = await loadAnalysisIndex(data.projectId);
    const analyses: OpportunityAnalysis[] = [];

    for (const id of index) {
      const raw = await env.KV.get(analysisKey(data.projectId, id), "text");
      if (raw) {
        try {
          analyses.push(parseJson<OpportunityAnalysis>(raw));
        } catch {
          // Skip corruptos
        }
      }
    }

    return { analyses };
  });

export const deleteOpportunityAnalysis = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => deleteAnalysisSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await env.KV.delete(analysisKey(data.projectId, data.analysisId));

    const index = await loadAnalysisIndex(data.projectId);
    const filtered = index.filter((id) => id !== data.analysisId);
    await saveAnalysisIndex(data.projectId, filtered);

    return { success: true };
  });
