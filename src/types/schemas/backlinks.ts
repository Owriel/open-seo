// Schemas Zod para validar input/output de las server functions del
// módulo "Backlinks" (DataForSEO Backlinks API).

import { z } from "zod";

// Normaliza el target: quita protocolo y www. DataForSEO exige el dominio
// o subdominio sin https:// ni www. Solo acepta URL absoluta cuando el
// target es una página concreta (ej. /articulo). Si viene una URL que
// apunta a la raíz del dominio, la convertimos a dominio plano para
// evitar errores del API ("Target has invalid format").
function normalizeTarget(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  // Si no trae protocolo explícito: dominio/subdominio. Quitamos www. y
  // cualquier slash final.
  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^www\./i, "").replace(/\/+$/, "");
  }
  // Viene URL con protocolo. Intentamos parsearla.
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./i, "");
    // Si el path es raíz (/ o vacío) y no hay query/hash, tratamos como
    // dominio plano. Es lo que DataForSEO espera.
    const pathIsRoot = url.pathname === "/" || url.pathname === "";
    if (pathIsRoot && !url.search && !url.hash) {
      return host;
    }
    // Hay path real: dejamos la URL absoluta (DataForSEO la necesita
    // completa para un target de página).
    return `${url.protocol}//${host}${url.pathname}${url.search}${url.hash}`;
  } catch {
    // Si no parsea, devolvemos el trimmed tal cual.
    return trimmed;
  }
}

export const analyzeBacklinksSchema = z.object({
  projectId: z.string().min(1),
  target: z
    .string()
    .min(1)
    .max(500)
    .trim()
    .transform(normalizeTarget)
    .refine((v) => v.length > 0, "Target vacío"),
  // Nº de backlinks a descargar (máx 1000 por call según doc DataForSEO).
  backlinksLimit: z.number().int().min(10).max(1000).default(500),
  // Nº de dominios referentes a descargar (máx 1000).
  domainsLimit: z.number().int().min(10).max(1000).default(200),
  // Nº de anchors a descargar (máx 1000).
  anchorsLimit: z.number().int().min(10).max(1000).default(200),
  // Si incluir subdominios del target al contar backlinks. Default true.
  includeSubdomains: z.boolean().default(true),
});

export const getBacklinksHistorySchema = z.object({
  projectId: z.string().min(1),
  limit: z.number().int().positive().max(100).default(20),
});

export const getBacklinksAnalysisSchema = z.object({
  id: z.string().min(1),
});

export const deleteBacklinksAnalysisSchema = z.object({
  id: z.string().min(1),
});

export type AnalyzeBacklinksInput = z.infer<typeof analyzeBacklinksSchema>;
export type GetBacklinksHistoryInput = z.infer<
  typeof getBacklinksHistorySchema
>;
