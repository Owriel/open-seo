import { z } from "zod";

export const serpAnalysisSchema = z.object({
  keyword: z.string().min(1).trim(),
  locationCode: z.number().int().positive(),
  languageCode: z.string().min(2).max(5),
});

export type SerpAnalysisInput = z.infer<typeof serpAnalysisSchema>;
