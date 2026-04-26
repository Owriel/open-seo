// Schemas Zod para validar input/output de las server functions del
// módulo "Reseñas Google".

import { z } from "zod";

export const analyzeReviewsSchema = z.object({
  projectId: z.string().min(1),
  keyword: z.string().min(1).max(200).trim(),
  placeId: z.string().max(255).optional().nullable(),
  // Ubicación completa estilo DataForSEO (ej. "Valencia,Valencia,Spain").
  // Si no se pasa, el cliente puede ir por coordenadas (no implementado aquí).
  locationName: z.string().min(1).max(255).default("Valencia,Valencia,Spain"),
  languageCode: z.string().min(2).max(5).default("es"),
  // Profundidad (número de reseñas a descargar). Múltiplos de 10 recomendados.
  limit: z.number().int().min(10).max(490).default(50),
});

export const getReviewsHistorySchema = z.object({
  projectId: z.string().min(1),
  limit: z.number().int().positive().max(100).default(20),
});

export const getReviewAnalysisSchema = z.object({
  id: z.string().min(1),
});

export const deleteReviewAnalysisSchema = z.object({
  id: z.string().min(1),
});

export type AnalyzeReviewsInput = z.infer<typeof analyzeReviewsSchema>;
export type GetReviewsHistoryInput = z.infer<typeof getReviewsHistorySchema>;
