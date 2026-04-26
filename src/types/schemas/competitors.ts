import { z } from "zod";

export const findCompetitorsSchema = z.object({
  domain: z.string().min(1).trim(),
  locationCode: z.number().int().positive(),
  languageCode: z.string().min(2).max(5),
  includeSubdomains: z.boolean().default(true),
});

export const keywordIntersectionSchema = z.object({
  domain1: z.string().min(1).trim(),
  domain2: z.string().min(1).trim(),
  locationCode: z.number().int().positive(),
  languageCode: z.string().min(2).max(5),
  limit: z.number().int().min(10).max(500).default(100),
  mode: z.enum(["common", "gaps", "advantages"]).default("common"),
});

export type FindCompetitorsInput = z.infer<typeof findCompetitorsSchema>;
export type KeywordIntersectionInput = z.infer<
  typeof keywordIntersectionSchema
>;
