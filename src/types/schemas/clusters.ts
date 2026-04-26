import { z } from "zod";

export const clusterSearchSchema = z.object({
  keyword: z.string().min(1).trim(),
  locationCode: z.number().int().positive(),
  languageCode: z.string().min(2).max(5),
});

export const saveClusterPlanSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).trim(),
  pillarKeyword: z.string().min(1),
  clusters: z.array(
    z.object({
      name: z.string(),
      keywords: z.array(
        z.object({
          keyword: z.string(),
          searchVolume: z.number().nullable(),
          keywordDifficulty: z.number().nullable(),
          cpc: z.number().nullable(),
          intent: z.string().nullable(),
          priority: z.number().nullable(),
        }),
      ),
      totalVolume: z.number(),
      avgDifficulty: z.number(),
      avgCpc: z.number(),
      avgPriority: z.number(),
      count: z.number(),
    }),
  ),
});

export const deleteClusterPlanSchema = z.object({
  projectId: z.string().min(1),
  planId: z.string().min(1),
});

export const getClusterPlansSchema = z.object({
  projectId: z.string().min(1),
});
