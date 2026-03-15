// Tipos para el módulo de Keywords de Oportunidad

/** Keyword normalizada — formato común para las 3 fuentes de datos */
export type OpportunityKeyword = {
  keyword: string;
  url: string | null;
  position: number | null;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  searchVolume: number | null;
  keywordDifficulty: number | null;
  cpc: number | null;
  traffic: number | null;
};

/** Resultado del análisis de oportunidades */
export type OpportunityResult = {
  keyword: string;
  url: string | null;
  position: number | null;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  expectedCtr: number | null;
  ctrGap: number | null;
  searchVolume: number | null;
  keywordDifficulty: number | null;
  cpc: number | null;
  traffic: number | null;
  score: number;
  opportunityType: OpportunityType[];
};

export type OpportunityType =
  | "near_top3"       // Posiciones 4-6
  | "second_page"     // Posiciones 11-20
  | "low_ctr"         // CTR por debajo del benchmark
  | "cannibalized";   // Múltiples URLs para la misma keyword

/** Grupo de canibalización — keyword que rankea con varias URLs */
export type CannibalizationGroup = {
  keyword: string;
  urls: Array<{
    url: string;
    position: number | null;
    clicks: number | null;
    impressions: number | null;
    ctr: number | null;
  }>;
};

/** Análisis completo guardable */
export type OpportunityAnalysis = {
  id: string;
  domain: string;
  source: DataSource;
  results: OpportunityResult[];
  cannibalization: CannibalizationGroup[];
  totalKeywords: number;
  totalOpportunities: number;
  savedAt: string;
  filters: OpportunityFilters;
};

export type DataSource = "dataforseo" | "csv" | "gsc";

/** Filtros configurables por el usuario */
export type OpportunityFilters = {
  minPosition: number;
  maxPosition: number;
  minImpressions: number;
  maxCtr: number | null;
  onlyWithCtrGap: boolean;
};

/** Estado de conexión GSC */
export type GscConnectionStatus = {
  connected: boolean;
  email: string | null;
  properties: string[] | null;
};
