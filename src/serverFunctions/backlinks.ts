// Server functions para el módulo "Backlinks" (DataForSEO Backlinks API).
//
//   - analyzeBacklinks        → ejecuta los 4 endpoints agregados y persiste.
//   - getBacklinksHistory     → lista los análisis de un proyecto (sidebar).
//   - getBacklinksAnalysis    → carga un análisis concreto por id.
//   - deleteBacklinksAnalysis → borra un análisis guardado.
//
// Los 4 handlers se exportan como constantes con sufijo `_createServerFn_handler`
// por consistencia con la convención del enunciado del módulo. Internamente
// son `createServerFn({ method: "POST" }).handler(...)`.

import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, backlinksAnalyses } from "@/db/schema";
import { AppError } from "@/server/lib/errors";
import { authenticatedServerFunctionMiddleware } from "@/serverFunctions/middleware";
import {
  analyzeBacklinksSchema,
  getBacklinksHistorySchema,
  getBacklinksAnalysisSchema,
  deleteBacklinksAnalysisSchema,
} from "@/types/schemas/backlinks";
import type {
  AnchorItem,
  BacklinkItem,
  BacklinksAnalysis,
  BacklinksAnalysisSummary,
  BacklinksSummary,
  ReferringDomainItem,
} from "@/types/backlinks";
import {
  fetchAnchors,
  fetchBacklinksList,
  fetchBacklinksSummary,
  fetchReferringDomains,
} from "@/server/lib/dataforseoBacklinks";

// Verifica que el proyecto existe y pertenece al usuario. Si no, 404.
// Mismo patrón que `serverFunctions/reviews.ts`.
async function ensureProjectAccess(
  projectId: string,
  userId: string,
): Promise<void> {
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
  });
  if (!project) {
    throw new AppError("NOT_FOUND", "Proyecto no encontrado");
  }
}

// Máximo de backlinks que guardamos en la muestra persistida. Si el análisis
// devuelve más, truncamos al serializar (el resto queda en memoria del cliente
// sólo durante la llamada inicial).
const MAX_BACKLINKS_SAMPLE = 500;

// Parse seguro de JSON → tipo T. Si falla, devolvemos `fallback`.
function safeParse<T>(raw: string | null, fallback: T): T {
  if (raw == null || raw.length === 0) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    // eslint-disable-next-line typescript/no-unsafe-type-assertion
    return parsed as T;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// analyzeBacklinks
// ---------------------------------------------------------------------------

// Lanza los 4 endpoints en paralelo con Promise.allSettled para que un fallo
// puntual (p.ej. anchors devuelve vacío) no aborte el análisis completo.
export const analyzeBacklinks = createServerFn({
  method: "POST",
})
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => analyzeBacklinksSchema.parse(data))
  .handler(async ({ data, context }): Promise<BacklinksAnalysis> => {
    await ensureProjectAccess(data.projectId, context.userId);

    // Disparamos los 4 endpoints en paralelo.
    const [summaryRes, domainsRes, anchorsRes, backlinksRes] =
      await Promise.allSettled([
        fetchBacklinksSummary(data.target, data.includeSubdomains),
        fetchReferringDomains(data.target, {
          limit: data.domainsLimit,
          includeSubdomains: data.includeSubdomains,
          rankScale: "one_hundred",
        }),
        fetchAnchors(data.target, {
          limit: data.anchorsLimit,
          includeSubdomains: data.includeSubdomains,
          rankScale: "one_hundred",
        }),
        fetchBacklinksList(data.target, {
          limit: Math.min(data.backlinksLimit, MAX_BACKLINKS_SAMPLE),
          includeSubdomains: data.includeSubdomains,
          rankScale: "one_hundred",
          // Orden por domain_from_rank DESC: muestra los más "autoritativos"
          // primero para que el sample sea representativo del perfil real.
          orderBy: ["domain_from_rank,desc"],
        }),
      ]);

    // El summary es crítico: si falla, el análisis no tiene sentido.
    if (summaryRes.status !== "fulfilled") {
      throw new AppError(
        "INTERNAL_ERROR",
        summaryRes.reason instanceof Error
          ? summaryRes.reason.message
          : "DataForSEO summary falló",
      );
    }
    const summary: BacklinksSummary = summaryRes.value;

    // Para los demás, si fallan devolvemos array vacío y seguimos. La UI
    // mostrará "sin datos" en esa tab.
    const topDomains: ReferringDomainItem[] =
      domainsRes.status === "fulfilled" ? domainsRes.value : [];
    const topAnchors: AnchorItem[] =
      anchorsRes.status === "fulfilled" ? anchorsRes.value : [];
    const backlinks: BacklinkItem[] =
      backlinksRes.status === "fulfilled" ? backlinksRes.value : [];

    // Truncamos la muestra a MAX_BACKLINKS_SAMPLE por si el caller se pasó.
    const backlinksSample = backlinks.slice(0, MAX_BACKLINKS_SAMPLE);

    // Persistimos el análisis.
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await db.insert(backlinksAnalyses).values({
      id,
      projectId: data.projectId,
      target: data.target,
      totalBacklinks: summary.backlinks,
      totalReferringDomains: summary.referringDomains,
      rank: summary.rank,
      spamScore: summary.spamScore,
      summaryJson: JSON.stringify(summary),
      topDomainsJson: JSON.stringify(topDomains),
      topAnchorsJson: JSON.stringify(topAnchors),
      backlinksSampleJson: JSON.stringify(backlinksSample),
      createdAt,
    });

    return {
      id,
      projectId: data.projectId,
      target: data.target,
      totalBacklinks: summary.backlinks,
      totalReferringDomains: summary.referringDomains,
      rank: summary.rank,
      spamScore: summary.spamScore,
      summary,
      topDomains,
      topAnchors,
      backlinks: backlinksSample,
      createdAt,
    };
  });

// ---------------------------------------------------------------------------
// getBacklinksHistory
// ---------------------------------------------------------------------------

export const getBacklinksHistory = createServerFn({
  method: "POST",
})
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => getBacklinksHistorySchema.parse(data))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ analyses: BacklinksAnalysisSummary[] }> => {
      await ensureProjectAccess(data.projectId, context.userId);

      const rows = await db
        .select()
        .from(backlinksAnalyses)
        .where(eq(backlinksAnalyses.projectId, data.projectId))
        .orderBy(desc(backlinksAnalyses.createdAt))
        .limit(data.limit);

      const analyses: BacklinksAnalysisSummary[] = rows.map((row) => ({
        id: row.id,
        target: row.target,
        totalBacklinks: row.totalBacklinks,
        totalReferringDomains: row.totalReferringDomains,
        rank: row.rank,
        spamScore: row.spamScore,
        createdAt: row.createdAt,
      }));

      return { analyses };
    },
  );

// ---------------------------------------------------------------------------
// getBacklinksAnalysis
// ---------------------------------------------------------------------------

export const getBacklinksAnalysis = createServerFn({
  method: "POST",
})
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => getBacklinksAnalysisSchema.parse(data))
  .handler(async ({ data, context }): Promise<BacklinksAnalysis> => {
    const row = await db.query.backlinksAnalyses.findFirst({
      where: eq(backlinksAnalyses.id, data.id),
    });
    if (!row) throw new AppError("NOT_FOUND", "Análisis no encontrado");

    await ensureProjectAccess(row.projectId, context.userId);

    // Parseamos los JSONs persistidos con fallbacks seguros.
    const summary = safeParse<BacklinksSummary>(
      row.summaryJson,
      // Fallback: un summary con ceros para que la UI no explote.
      {
        target: row.target,
        firstSeen: null,
        lostDate: null,
        rank: row.rank,
        backlinks: row.totalBacklinks,
        spamScore: row.spamScore,
        crawledPages: null,
        internalLinksCount: null,
        externalLinksCount: null,
        brokenBacklinks: null,
        brokenPages: null,
        referringDomains: row.totalReferringDomains,
        referringDomainsNofollow: 0,
        referringMainDomains: 0,
        referringMainDomainsNofollow: 0,
        referringIps: null,
        referringSubnets: null,
        referringPages: null,
        referringPagesNofollow: null,
        referringLinksTld: {},
        referringLinksTypes: {},
        referringLinksAttributes: {},
        referringLinksPlatformTypes: {},
        referringLinksSemanticLocations: {},
        referringLinksCountries: {},
      },
    );

    return {
      id: row.id,
      projectId: row.projectId,
      target: row.target,
      totalBacklinks: row.totalBacklinks,
      totalReferringDomains: row.totalReferringDomains,
      rank: row.rank,
      spamScore: row.spamScore,
      summary,
      topDomains: safeParse<ReferringDomainItem[]>(row.topDomainsJson, []),
      topAnchors: safeParse<AnchorItem[]>(row.topAnchorsJson, []),
      backlinks: safeParse<BacklinkItem[]>(row.backlinksSampleJson, []),
      createdAt: row.createdAt,
    };
  });

// ---------------------------------------------------------------------------
// deleteBacklinksAnalysis
// ---------------------------------------------------------------------------

export const deleteBacklinksAnalysis = createServerFn({
  method: "POST",
})
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => deleteBacklinksAnalysisSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ success: true }> => {
    const row = await db.query.backlinksAnalyses.findFirst({
      where: eq(backlinksAnalyses.id, data.id),
    });
    if (!row) throw new AppError("NOT_FOUND", "Análisis no encontrado");
    await ensureProjectAccess(row.projectId, context.userId);

    await db.delete(backlinksAnalyses).where(eq(backlinksAnalyses.id, data.id));
    return { success: true };
  });
