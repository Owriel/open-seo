// Tipos para el módulo de Informe SEO Integral

import type {
  CompetitorRow,
  KeywordIntersectionRow,
} from "@/types/competitors";
import type { LocalPackResult, LocalKeywordSuggestion } from "@/types/local";
import type {
  OpportunityResult,
  CannibalizationGroup,
} from "@/types/opportunities";

// ---------------------------------------------------------------------------
// Sección de visibilidad (Domain Overview simplificado)
// ---------------------------------------------------------------------------
export type ReportVisibility = {
  organicTraffic: number | null;
  organicKeywords: number | null;
  topKeywords: Array<{
    keyword: string;
    position: number | null;
    searchVolume: number | null;
    traffic: number | null;
    url: string | null;
  }>;
  topPages: Array<{
    page: string;
    relativePath: string | null;
    organicTraffic: number | null;
    keywords: number | null;
  }>;
};

// ---------------------------------------------------------------------------
// Sección de oportunidades
// ---------------------------------------------------------------------------
export type ReportOpportunities = {
  results: OpportunityResult[];
  cannibalization: CannibalizationGroup[];
  totalKeywords: number;
  totalOpportunities: number;
};

// ---------------------------------------------------------------------------
// Sección de competencia
// ---------------------------------------------------------------------------
export type ReportCompetitors = {
  competitors: CompetitorRow[];
  mainCompetitor: string | null;
};

// ---------------------------------------------------------------------------
// Sección de content gap
// ---------------------------------------------------------------------------
export type ReportContentGap = {
  competitorDomain: string;
  keywords: KeywordIntersectionRow[];
  totalCount: number;
};

// ---------------------------------------------------------------------------
// Sección local
// ---------------------------------------------------------------------------
export type ReportLocal = {
  keyword: string;
  localPackResults: LocalPackResult[];
  localKeywords: LocalKeywordSuggestion[];
  ourPosition: number | null; // Posición del dominio en el local pack
  ourRating: number | null;
  ourReviewCount: number | null;
};

// ---------------------------------------------------------------------------
// Sección de salud técnica (mini-crawl)
// ---------------------------------------------------------------------------
export type TechnicalIssue = {
  type: string;
  severity: "critical" | "warning" | "info";
  page: string;
  description: string;
};

export type ReportTechnicalHealth = {
  pagesCrawled: number;
  issues: TechnicalIssue[];
  issuesByType: Record<string, number>;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
};

// ---------------------------------------------------------------------------
// Sección GBP (multilang)
// ---------------------------------------------------------------------------
export type ReportGbp = {
  name: string;
  baseName: string;
  variants: Array<{
    name: string;
    languages: Array<{ code: string; name: string }>;
  }>;
  totalLanguagesChecked: number;
  hasProblematicVariants: boolean;
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------
export type SectionScore = {
  score: number; // 0-100
  color: "green" | "yellow" | "red";
  summary: string; // Frase en español llano
};

export type ReportScores = {
  global: SectionScore;
  visibility: SectionScore;
  opportunities: SectionScore;
  competitors: SectionScore;
  contentGap: SectionScore;
  local: SectionScore;
  technical: SectionScore;
  gbp: SectionScore | null; // null si no se analizó GBP
};

// ---------------------------------------------------------------------------
// Informe completo
// ---------------------------------------------------------------------------
export type SeoReport = {
  id: string;
  projectId: string;
  domain: string;
  keyword: string | null;
  gbpInput: string | null;
  locationCode: number;
  languageCode: string;

  // Secciones de datos
  visibility: ReportVisibility;
  opportunities: ReportOpportunities;
  competitors: ReportCompetitors;
  contentGap: ReportContentGap;
  local: ReportLocal | null; // null si no hay keyword
  technical: ReportTechnicalHealth;
  gbp: ReportGbp | null; // null si no hay GBP

  // Puntuaciones
  scores: ReportScores;

  // Metadata
  generatedAt: string;
  publicId: string | null; // UUID para link público (null hasta que se genere)
};

// ---------------------------------------------------------------------------
// Estado de generación
// ---------------------------------------------------------------------------
export type ReportGenerationStatus = {
  phase: string;
  progress: number; // 0-100
  completedSections: string[];
};
