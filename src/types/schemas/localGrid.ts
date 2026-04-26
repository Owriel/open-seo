import { z } from "zod";

// Tamaños permitidos del grid: 3x3, 5x5 o 7x7 puntos.
export const gridSizeSchema = z.union([
  z.literal(3),
  z.literal(5),
  z.literal(7),
]);

export const runGridScanSchema = z.object({
  projectId: z.string().min(1),
  keyword: z.string().min(1).max(200).trim(),
  targetDomain: z.string().min(1).max(255).trim(),
  // place_id del negocio objetivo (opcional). Si viene, el matching por
  // place_id tiene prioridad sobre el matching por dominio.
  targetPlaceId: z.string().max(255).optional().nullable(),
  // Nombre comercial del negocio (solo metadato, no participa en matching).
  businessName: z.string().max(255).optional().nullable(),
  centerLat: z.number().gte(-90).lte(90),
  centerLng: z.number().gte(-180).lte(180),
  gridSize: gridSizeSchema,
  radiusKm: z.number().positive().max(50), // techo razonable: 50km
  languageCode: z.string().min(2).max(5).default("es"),
  locationName: z.string().max(255).optional(),
});

export const getGridHistorySchema = z.object({
  projectId: z.string().min(1),
  limit: z.number().int().positive().max(100).default(20),
});

export const getGridScanSchema = z.object({
  scanId: z.string().min(1),
});

export const deleteGridScanSchema = z.object({
  scanId: z.string().min(1),
});

// Búsqueda de negocios en Google Maps para el BusinessPicker previo al scan.
// Limitamos a 10 resultados para ahorrar coste en DataForSEO (es una
// búsqueda interactiva, no necesitamos profundidad grande).
export const searchBusinessesSchema = z.object({
  query: z.string().min(1).max(200).trim(),
  locationName: z.string().min(1).max(255).trim(),
  languageCode: z.string().min(2).max(5).default("es"),
});

export type RunGridScanInput = z.infer<typeof runGridScanSchema>;
export type GetGridHistoryInput = z.infer<typeof getGridHistorySchema>;
export type SearchBusinessesInput = z.infer<typeof searchBusinessesSchema>;
