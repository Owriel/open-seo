import { z } from "zod";

// --- Análisis con DataForSEO ---
export const analyzeWithDataforseoSchema = z.object({
  domain: z.string().min(1).trim(),
  locationCode: z.number().int().positive(),
  languageCode: z.string().min(2).max(5),
  filters: z.object({
    minPosition: z.number().min(1).default(4),
    maxPosition: z.number().max(100).default(20),
    minImpressions: z.number().min(0).default(0),
    maxCtr: z.number().min(0).max(100).nullable().default(null),
    onlyWithCtrGap: z.boolean().default(false),
  }),
});

// --- Análisis con CSV (datos ya parseados en cliente) ---
export const analyzeWithCsvSchema = z.object({
  domain: z.string().min(1).trim(),
  rows: z.array(z.object({
    keyword: z.string().min(1),
    url: z.string().nullable().default(null),
    clicks: z.number().nullable().default(null),
    impressions: z.number().nullable().default(null),
    ctr: z.number().nullable().default(null),
    position: z.number().nullable().default(null),
  })),
  filters: z.object({
    minPosition: z.number().min(1).default(4),
    maxPosition: z.number().max(100).default(20),
    minImpressions: z.number().min(0).default(0),
    maxCtr: z.number().min(0).max(100).nullable().default(null),
    onlyWithCtrGap: z.boolean().default(false),
  }),
});

// --- Análisis con GSC ---
export const analyzeWithGscSchema = z.object({
  projectId: z.string().min(1),
  siteUrl: z.string().min(1),
  dateRange: z.enum(["7d", "28d", "3m", "6m", "12m", "16m"]).default("3m"),
  filters: z.object({
    minPosition: z.number().min(1).default(4),
    maxPosition: z.number().max(100).default(20),
    minImpressions: z.number().min(0).default(0),
    maxCtr: z.number().min(0).max(100).nullable().default(null),
    onlyWithCtrGap: z.boolean().default(false),
  }),
});

// --- GSC OAuth ---
export const gscAuthUrlSchema = z.object({
  projectId: z.string().min(1),
});

export const gscCallbackSchema = z.object({
  code: z.string().min(1),
  projectId: z.string().min(1),
});

export const gscStatusSchema = z.object({
  projectId: z.string().min(1),
});

export const gscDisconnectSchema = z.object({
  projectId: z.string().min(1),
});

// --- Guardar / cargar análisis ---
export const saveAnalysisSchema = z.object({
  projectId: z.string().min(1),
  domain: z.string().min(1),
  source: z.enum(["dataforseo", "csv", "gsc"]),
  results: z.array(z.object({
    keyword: z.string(),
    url: z.string().nullable(),
    position: z.number().nullable(),
    clicks: z.number().nullable(),
    impressions: z.number().nullable(),
    ctr: z.number().nullable(),
    expectedCtr: z.number().nullable(),
    ctrGap: z.number().nullable(),
    searchVolume: z.number().nullable(),
    keywordDifficulty: z.number().nullable(),
    cpc: z.number().nullable(),
    traffic: z.number().nullable(),
    score: z.number(),
    opportunityType: z.array(z.enum(["near_top3", "second_page", "low_ctr", "cannibalized"])),
  })),
  cannibalization: z.array(z.object({
    keyword: z.string(),
    urls: z.array(z.object({
      url: z.string(),
      position: z.number().nullable(),
      clicks: z.number().nullable(),
      impressions: z.number().nullable(),
      ctr: z.number().nullable(),
    })),
  })),
  totalKeywords: z.number(),
  totalOpportunities: z.number(),
  filters: z.object({
    minPosition: z.number(),
    maxPosition: z.number(),
    minImpressions: z.number(),
    maxCtr: z.number().nullable(),
    onlyWithCtrGap: z.boolean(),
  }),
});

export const getAnalysesSchema = z.object({
  projectId: z.string().min(1),
});

export const deleteAnalysisSchema = z.object({
  projectId: z.string().min(1),
  analysisId: z.string().min(1),
});
