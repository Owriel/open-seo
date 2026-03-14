import { z } from "zod";

export const addTrackedKeywordsSchema = z.object({
  projectId: z.string().min(1),
  keywords: z.array(z.string().min(1)).min(1).max(100),
  domain: z.string().min(1).trim(),
  locationCode: z.number().int().positive(),
  languageCode: z.string().min(2).max(5),
});

export const removeTrackedKeywordSchema = z.object({
  trackedKeywordId: z.string().min(1),
});

export const getTrackedKeywordsSchema = z.object({
  projectId: z.string().min(1),
});

export const checkRankingsSchema = z.object({
  projectId: z.string().min(1),
});

export type AddTrackedKeywordsInput = z.infer<typeof addTrackedKeywordsSchema>;
export type GetTrackedKeywordsInput = z.infer<typeof getTrackedKeywordsSchema>;
