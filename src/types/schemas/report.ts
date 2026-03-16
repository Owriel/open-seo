import { z } from "zod";

export const generateReportSchema = z.object({
  projectId: z.string().min(1),
  domain: z.string().min(1).trim(),
  keyword: z.string().nullable().default(null),
  gbpInput: z.string().nullable().default(null),
  locationCode: z.number().int().positive().default(2724),
  languageCode: z.string().min(2).max(5).default("es"),
});

export const getReportSchema = z.object({
  projectId: z.string().min(1),
  reportId: z.string().min(1),
});

export const getReportsSchema = z.object({
  projectId: z.string().min(1),
});

export const deleteReportSchema = z.object({
  projectId: z.string().min(1),
  reportId: z.string().min(1),
});

export const generatePublicLinkSchema = z.object({
  projectId: z.string().min(1),
  reportId: z.string().min(1),
});

export const disablePublicLinkSchema = z.object({
  projectId: z.string().min(1),
  reportId: z.string().min(1),
});

export const getPublicReportSchema = z.object({
  reportId: z.string().min(1),
});
