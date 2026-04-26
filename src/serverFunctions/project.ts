// Server functions para el dashboard de proyecto y sus ajustes.
// - getProjectDashboard: devuelve el proyecto + stats agregados (auditorías,
//   keywords guardadas, keywords tracked, rating medio última reseña) +
//   las últimas 5 auditorías para el bloque "Reciente".
// - updateProjectSettings: actualiza los campos editables del proyecto
//   (nombre, dominio, keyword objetivo, location, idioma, place_id,
//   businessName, PageSpeed API key).

import { createServerFn } from "@tanstack/react-start";
import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  audits,
  projects,
  reviewAnalyses,
  savedKeywords,
  trackedKeywords,
} from "@/db/schema";
import { AppError } from "@/server/lib/errors";
import { authenticatedServerFunctionMiddleware } from "@/serverFunctions/middleware";

// ============================================================================
// Schemas de entrada
// ============================================================================

const getProjectDashboardSchema = z.object({
  projectId: z.string().min(1),
});

// Los campos opcionales aceptan string vacío para que el cliente pueda enviar
// el formulario tal cual lo rellena el usuario; normalizamos a null en el
// handler antes de persistir.
const updateProjectSettingsSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1, "El nombre del proyecto es obligatorio").max(200),
  domain: z.string().max(500).optional().nullable(),
  targetKeyword: z.string().max(500).optional().nullable(),
  locationName: z.string().max(200).optional().nullable(),
  languageCode: z.string().max(10).optional().nullable(),
  placeId: z.string().max(500).optional().nullable(),
  businessName: z.string().max(300).optional().nullable(),
  pagespeedApiKey: z.string().max(500).optional().nullable(),
});

// ============================================================================
// Helpers
// ============================================================================

// Verifica que el proyecto exista y pertenezca al usuario autenticado.
// Devuelve la fila completa del proyecto para que el caller no repita la query.
async function ensureProjectAccess(projectId: string, userId: string) {
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
  if (!project) {
    throw new AppError("NOT_FOUND", "Proyecto no encontrado");
  }
  return project;
}

// Normaliza un string opcional: trim + convierte vacío a null para que
// el UPDATE no deje strings en blanco en columnas nullable.
function normalizeOptional(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// ============================================================================
// Tipos de respuesta
// ============================================================================

export type ProjectDashboardData = {
  project: {
    id: string;
    name: string;
    domain: string | null;
    targetKeyword: string | null;
    locationName: string | null;
    languageCode: string | null;
    placeId: string | null;
    businessName: string | null;
    pagespeedApiKey: string | null;
    createdAt: string;
  };
  stats: {
    audits: number;
    savedKeywords: number;
    trackedKeywords: number;
    latestRating: number | null;
  };
  recentAudits: Array<{
    id: string;
    startUrl: string;
    status: "running" | "completed" | "failed";
    pagesCrawled: number;
    startedAt: string;
    completedAt: string | null;
  }>;
};

// ============================================================================
// Server functions
// ============================================================================

// Devuelve toda la info necesaria para pintar el dashboard del proyecto.
// Se hace en paralelo con Promise.all para minimizar round-trips a D1.
export const getProjectDashboard = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => getProjectDashboardSchema.parse(data))
  .handler(async ({ data, context }): Promise<ProjectDashboardData> => {
    const project = await ensureProjectAccess(data.projectId, context.userId);

    // Lanzamos las 4 queries de stats + recientes en paralelo.
    const [
      auditsCountRow,
      savedKeywordsCountRow,
      trackedKeywordsCountRow,
      latestReviewRow,
      recentAuditsRows,
    ] = await Promise.all([
      db
        .select({ value: count() })
        .from(audits)
        .where(eq(audits.projectId, data.projectId)),
      db
        .select({ value: count() })
        .from(savedKeywords)
        .where(eq(savedKeywords.projectId, data.projectId)),
      db
        .select({ value: count() })
        .from(trackedKeywords)
        .where(eq(trackedKeywords.projectId, data.projectId)),
      db
        .select({ avgRating: reviewAnalyses.avgRating })
        .from(reviewAnalyses)
        .where(eq(reviewAnalyses.projectId, data.projectId))
        .orderBy(desc(reviewAnalyses.createdAt))
        .limit(1),
      db
        .select({
          id: audits.id,
          startUrl: audits.startUrl,
          status: audits.status,
          pagesCrawled: audits.pagesCrawled,
          startedAt: audits.startedAt,
          completedAt: audits.completedAt,
        })
        .from(audits)
        .where(eq(audits.projectId, data.projectId))
        .orderBy(desc(audits.startedAt))
        .limit(5),
    ]);

    return {
      project: {
        id: project.id,
        name: project.name,
        domain: project.domain,
        targetKeyword: project.targetKeyword,
        locationName: project.locationName,
        languageCode: project.languageCode,
        placeId: project.placeId,
        businessName: project.businessName,
        pagespeedApiKey: project.pagespeedApiKey,
        createdAt: project.createdAt,
      },
      stats: {
        audits: auditsCountRow[0]?.value ?? 0,
        savedKeywords: savedKeywordsCountRow[0]?.value ?? 0,
        trackedKeywords: trackedKeywordsCountRow[0]?.value ?? 0,
        latestRating: latestReviewRow[0]?.avgRating ?? null,
      },
      recentAudits: recentAuditsRows.map((row) => ({
        id: row.id,
        startUrl: row.startUrl,
        status: row.status,
        pagesCrawled: row.pagesCrawled,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
      })),
    };
  });

// Actualiza los campos editables del proyecto. El nombre es obligatorio;
// el resto se normaliza (trim + null si viene vacío) para no ensuciar la BBDD.
export const updateProjectSettings = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => updateProjectSettingsSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ success: true }> => {
    // Verificamos acceso antes de tocar nada.
    await ensureProjectAccess(data.projectId, context.userId);

    await db
      .update(projects)
      .set({
        name: data.name.trim(),
        domain: normalizeOptional(data.domain),
        targetKeyword: normalizeOptional(data.targetKeyword),
        locationName: normalizeOptional(data.locationName) ?? "Spain",
        languageCode: normalizeOptional(data.languageCode) ?? "es",
        placeId: normalizeOptional(data.placeId),
        businessName: normalizeOptional(data.businessName),
        pagespeedApiKey: normalizeOptional(data.pagespeedApiKey),
      })
      .where(
        and(
          eq(projects.id, data.projectId),
          eq(projects.userId, context.userId),
        ),
      );

    return { success: true };
  });
