import { z } from "zod";

export const localPackSearchSchema = z.object({
  keyword: z.string().min(1).trim(),
  locationCode: z.number().int().positive(),
  languageCode: z.string().min(2).max(5),
});

export const localKeywordSuggestionsSchema = z.object({
  keyword: z.string().min(1).trim(),
  locationCode: z.number().int().positive(),
  languageCode: z.string().min(2).max(5),
  limit: z.number().int().min(10).max(200).default(50),
});

/** Base keyword search at city level via Google Ads API */
export const localCityKeywordSuggestionsSchema = z.object({
  keyword: z.string().min(1).trim(),
  cityName: z.string().min(1).trim(),
  countryIso: z.string().min(2).max(2).default("ES"),
  languageCode: z.string().min(2).max(5),
});

export type LocalPackSearchInput = z.infer<typeof localPackSearchSchema>;
export type LocalKeywordSuggestionsInput = z.infer<
  typeof localKeywordSuggestionsSchema
>;
export type LocalCityKeywordSuggestionsInput = z.infer<
  typeof localCityKeywordSuggestionsSchema
>;
