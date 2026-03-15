// Lógica core del módulo de Oportunidades
// Normalización, CTR benchmarks, scoring, detección de canibalización

import type {
  OpportunityKeyword,
  OpportunityResult,
  OpportunityType,
  CannibalizationGroup,
  OpportunityFilters,
} from "@/types/opportunities";

// ---------------------------------------------------------------------------
// CTR Benchmark por posición (datos promedio del sector, fuentes: AWR, Backlinko)
// ---------------------------------------------------------------------------
const CTR_BENCHMARKS: Record<number, number> = {
  1: 31.7,
  2: 24.7,
  3: 18.6,
  4: 13.6,
  5: 9.5,
  6: 6.2,
  7: 4.5,
  8: 3.4,
  9: 2.6,
  10: 2.4,
  11: 1.3,
  12: 1.1,
  13: 1.0,
  14: 0.9,
  15: 0.8,
  16: 0.7,
  17: 0.7,
  18: 0.6,
  19: 0.6,
  20: 0.5,
};

/** Obtener CTR esperado según la posición */
export function getExpectedCtr(position: number | null): number | null {
  if (position == null || position < 1) return null;
  const rounded = Math.round(position);
  if (rounded <= 20) return CTR_BENCHMARKS[rounded] ?? null;
  // Para posiciones > 20 estimamos un valor decreciente
  return Math.max(0.1, 0.5 - (rounded - 20) * 0.02);
}

// ---------------------------------------------------------------------------
// Scoring — Priorización de oportunidades
// ---------------------------------------------------------------------------

// Pesos del framework de priorización
const WEIGHTS = {
  position: 0.30,
  impressions: 0.25,
  intent: 0.20,    // Aproximado por CPC (mayor CPC = mayor intención comercial)
  ctrGap: 0.15,
  traffic: 0.10,   // Tráfico estimado o clics como proxy de conversión
};

/**
 * Calcula el score de oportunidad (0-100).
 * Mayor score = mayor oportunidad de mejora.
 */
export function calculateOpportunityScore(kw: OpportunityKeyword): number {
  // Componente de posición: cuanto más cerca del top 3, más oportunidad
  // Posiciones 4-10 puntúan alto, 11-20 puntúan medio
  let positionScore = 0;
  if (kw.position != null) {
    if (kw.position >= 4 && kw.position <= 6) positionScore = 100;
    else if (kw.position >= 7 && kw.position <= 10) positionScore = 75;
    else if (kw.position >= 11 && kw.position <= 15) positionScore = 50;
    else if (kw.position >= 16 && kw.position <= 20) positionScore = 30;
    else positionScore = 10;
  }

  // Componente de impresiones: normalizado logarítmicamente
  let impressionsScore = 0;
  const impressions = kw.impressions ?? kw.searchVolume ?? 0;
  if (impressions > 0) {
    // log10(1000) = 3, log10(10000) = 4, normalizado a 0-100
    impressionsScore = Math.min(100, (Math.log10(impressions + 1) / 5) * 100);
  }

  // Componente de intención comercial: basado en CPC
  let intentScore = 0;
  if (kw.cpc != null && kw.cpc > 0) {
    // CPC > 2€ = alta intención, normalizado
    intentScore = Math.min(100, (kw.cpc / 5) * 100);
  }

  // Componente de CTR gap
  let ctrGapScore = 0;
  const expectedCtr = getExpectedCtr(kw.position);
  const actualCtr = kw.ctr != null ? kw.ctr : null;
  if (expectedCtr != null && actualCtr != null) {
    const gap = expectedCtr - actualCtr;
    if (gap > 0) {
      // Gap normalizado: un gap de 10pp+ es máximo
      ctrGapScore = Math.min(100, (gap / 15) * 100);
    }
  }

  // Componente de tráfico/conversión
  let trafficScore = 0;
  const trafficValue = kw.clicks ?? kw.traffic ?? 0;
  if (trafficValue > 0) {
    trafficScore = Math.min(100, (Math.log10(trafficValue + 1) / 4) * 100);
  }

  const score =
    positionScore * WEIGHTS.position +
    impressionsScore * WEIGHTS.impressions +
    intentScore * WEIGHTS.intent +
    ctrGapScore * WEIGHTS.ctrGap +
    trafficScore * WEIGHTS.traffic;

  return Math.round(score * 10) / 10;
}

// ---------------------------------------------------------------------------
// Clasificación de tipo de oportunidad
// ---------------------------------------------------------------------------

export function classifyOpportunity(kw: OpportunityKeyword): OpportunityType[] {
  const types: OpportunityType[] = [];
  if (kw.position != null) {
    if (kw.position >= 4 && kw.position <= 6) types.push("near_top3");
    if (kw.position >= 11 && kw.position <= 20) types.push("second_page");
  }
  const expectedCtr = getExpectedCtr(kw.position);
  const actualCtr = kw.ctr;
  if (expectedCtr != null && actualCtr != null && actualCtr < expectedCtr * 0.7) {
    types.push("low_ctr");
  }
  return types;
}

// ---------------------------------------------------------------------------
// Detección de canibalización
// ---------------------------------------------------------------------------

export function detectCannibalization(
  keywords: OpportunityKeyword[],
): CannibalizationGroup[] {
  // Agrupar por keyword — si una keyword tiene más de 1 URL, hay canibalización
  const byKeyword = new Map<string, OpportunityKeyword[]>();
  for (const kw of keywords) {
    if (!kw.url) continue;
    const key = kw.keyword.toLowerCase().trim();
    const existing = byKeyword.get(key) ?? [];
    // Solo añadir si la URL es diferente
    if (!existing.some((e) => e.url === kw.url)) {
      existing.push(kw);
      byKeyword.set(key, existing);
    }
  }

  const groups: CannibalizationGroup[] = [];
  for (const [keyword, items] of byKeyword) {
    if (items.length < 2) continue;
    groups.push({
      keyword,
      urls: items.map((item) => ({
        url: item.url!,
        position: item.position,
        clicks: item.clicks,
        impressions: item.impressions,
        ctr: item.ctr,
      })),
    });
  }

  // Ordenar por número de URLs (más canibalización primero)
  return groups.sort((a, b) => b.urls.length - a.urls.length);
}

// ---------------------------------------------------------------------------
// Análisis completo: filtrar + clasificar + puntuar
// ---------------------------------------------------------------------------

export function analyzeOpportunities(
  keywords: OpportunityKeyword[],
  filters: OpportunityFilters,
): { results: OpportunityResult[]; cannibalization: CannibalizationGroup[] } {
  // Detectar canibalización antes de filtrar (necesita todos los datos)
  const cannibalization = detectCannibalization(keywords);
  const cannibalizedKeywords = new Set(cannibalization.map((g) => g.keyword));

  // Filtrar keywords por rango de posición e impresiones
  const filtered = keywords.filter((kw) => {
    if (kw.position == null) return false;
    if (kw.position < filters.minPosition || kw.position > filters.maxPosition) return false;
    if (filters.minImpressions > 0) {
      const imp = kw.impressions ?? kw.searchVolume ?? 0;
      if (imp < filters.minImpressions) return false;
    }
    if (filters.maxCtr != null && kw.ctr != null && kw.ctr > filters.maxCtr) return false;
    if (filters.onlyWithCtrGap) {
      const expected = getExpectedCtr(kw.position);
      if (expected == null || kw.ctr == null || kw.ctr >= expected) return false;
    }
    return true;
  });

  // Calcular score y clasificar cada keyword
  const results: OpportunityResult[] = filtered.map((kw) => {
    const expectedCtr = getExpectedCtr(kw.position);
    const ctrGap = expectedCtr != null && kw.ctr != null ? expectedCtr - kw.ctr : null;
    const types = classifyOpportunity(kw);
    if (cannibalizedKeywords.has(kw.keyword.toLowerCase().trim())) {
      types.push("cannibalized");
    }

    return {
      keyword: kw.keyword,
      url: kw.url,
      position: kw.position,
      clicks: kw.clicks,
      impressions: kw.impressions,
      ctr: kw.ctr,
      expectedCtr,
      ctrGap: ctrGap != null ? Math.round(ctrGap * 100) / 100 : null,
      searchVolume: kw.searchVolume,
      keywordDifficulty: kw.keywordDifficulty,
      cpc: kw.cpc,
      traffic: kw.traffic,
      score: calculateOpportunityScore(kw),
      opportunityType: types,
    };
  });

  // Ordenar por score descendente
  results.sort((a, b) => b.score - a.score);

  return { results, cannibalization };
}

// ---------------------------------------------------------------------------
// Normalización de datos CSV de Google Search Console
// ---------------------------------------------------------------------------

// Nombres de columnas en GSC export (español e inglés)
const COLUMN_MAPPINGS: Record<string, string> = {
  // Inglés
  "top queries": "keyword",
  "query": "keyword",
  "queries": "keyword",
  "top pages": "url",
  "page": "url",
  "pages": "url",
  "clicks": "clicks",
  "impressions": "impressions",
  "ctr": "ctr",
  "position": "position",
  "average position": "position",
  // Español
  "consultas principales": "keyword",
  "consulta": "keyword",
  "consultas": "keyword",
  "páginas principales": "url",
  "página": "url",
  "clics": "clicks",
  "impresiones": "impressions",
  "posición": "position",
  "posición media": "position",
};

/** Normaliza las cabeceras de un CSV de GSC a nuestro formato */
export function normalizeGscHeaders(headers: string[]): Map<number, string> {
  const mapping = new Map<number, string>();
  for (let i = 0; i < headers.length; i++) {
    const normalized = headers[i].toLowerCase().trim();
    const field = COLUMN_MAPPINGS[normalized];
    if (field) mapping.set(i, field);
  }
  return mapping;
}

/** Parsea un valor de CTR (puede venir como "5.23%" o como 0.0523 o como 5.23) */
export function parseCtrValue(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const str = String(raw).trim().replace(",", ".");
  if (str === "" || str === "-") return null;
  // Si tiene %, quitar y parsear como porcentaje directo
  if (str.endsWith("%")) {
    const num = parseFloat(str.replace("%", ""));
    return isNaN(num) ? null : num;
  }
  const num = parseFloat(str);
  if (isNaN(num)) return null;
  // Si es menor que 1, probablemente es decimal (0.05 = 5%)
  return num < 1 ? num * 100 : num;
}

/** Parsea un valor numérico genérico */
export function parseNumericValue(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  const str = String(raw).trim().replace(",", ".").replace(/\s/g, "");
  if (str === "" || str === "-") return null;
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}
