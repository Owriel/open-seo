// Server functions para el módulo "Reseñas Google".
// - analyzeReviews: llama a DataForSEO Business Data Google Reviews y guarda
//   el resultado en la tabla `review_analyses`.
// - getReviewsHistory: lista los análisis guardados de un proyecto.
// - getReviewAnalysis: carga un análisis concreto por id.
// - deleteReviewAnalysis: borra un análisis.

import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, reviewAnalyses } from "@/db/schema";
import { AppError } from "@/server/lib/errors";
import { authenticatedServerFunctionMiddleware } from "@/serverFunctions/middleware";
import {
  analyzeReviewsSchema,
  getReviewsHistorySchema,
  getReviewAnalysisSchema,
  deleteReviewAnalysisSchema,
} from "@/types/schemas/reviews";
import type {
  RatingDistribution,
  ReviewAnalysis,
  ReviewAnalysisSummary,
  ReviewItem,
} from "@/types/reviews";
import { fetchBusinessReviews } from "@/server/lib/dataforseoReviews";

// Verifica que el proyecto existe y pertenece al usuario.
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

// Parse seguro del array de distribución. Si el JSON está malformado o
// no tiene 5 elementos, devolvemos un array limpio [0,0,0,0,0].
function safeParseDistribution(raw: string): RatingDistribution {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length === 5 &&
      parsed.every((v) => typeof v === "number" && Number.isFinite(v))
    ) {
      // eslint-disable-next-line typescript/no-unsafe-type-assertion
      return parsed as RatingDistribution;
    }
  } catch {
    // Ignoramos y devolvemos defaults.
  }
  return [0, 0, 0, 0, 0];
}

// Parse seguro del array de reseñas.
function safeParseReviews(raw: string): ReviewItem[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // eslint-disable-next-line typescript/no-unsafe-type-assertion
      return parsed as ReviewItem[];
    }
  } catch {
    // Ignoramos.
  }
  return [];
}

export const analyzeReviews = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => analyzeReviewsSchema.parse(data))
  .handler(async ({ data, context }): Promise<ReviewAnalysis> => {
    await ensureProjectAccess(data.projectId, context.userId);

    // 1. Llamar a DataForSEO Business Data Google Reviews.
    const resp = await fetchBusinessReviews({
      keyword: data.keyword,
      placeId: data.placeId ?? null,
      locationName: data.locationName,
      languageCode: data.languageCode,
      limit: data.limit,
    });

    // 2. Persistir en BBDD.
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await db.insert(reviewAnalyses).values({
      id,
      projectId: data.projectId,
      keyword: data.keyword,
      placeId: resp.placeId,
      businessName: resp.businessName,
      locationName: data.locationName,
      languageCode: data.languageCode,
      totalReviews: resp.totalReviews,
      avgRating: resp.avgRating,
      ratingDistributionJson: JSON.stringify(resp.ratingDistribution),
      reviewsJson: JSON.stringify(resp.reviews),
      createdAt,
    });

    return {
      id,
      projectId: data.projectId,
      keyword: data.keyword,
      placeId: resp.placeId,
      businessName: resp.businessName,
      locationName: data.locationName,
      languageCode: data.languageCode,
      totalReviews: resp.totalReviews,
      avgRating: resp.avgRating,
      ratingDistribution: resp.ratingDistribution,
      reviews: resp.reviews,
      createdAt,
    };
  });

export const getReviewsHistory = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => getReviewsHistorySchema.parse(data))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ analyses: ReviewAnalysisSummary[] }> => {
      await ensureProjectAccess(data.projectId, context.userId);

      const rows = await db
        .select()
        .from(reviewAnalyses)
        .where(eq(reviewAnalyses.projectId, data.projectId))
        .orderBy(desc(reviewAnalyses.createdAt))
        .limit(data.limit);

      const analyses: ReviewAnalysisSummary[] = rows.map((row) => ({
        id: row.id,
        keyword: row.keyword,
        businessName: row.businessName,
        locationName: row.locationName,
        totalReviews: row.totalReviews,
        avgRating: row.avgRating,
        ratingDistribution: safeParseDistribution(row.ratingDistributionJson),
        createdAt: row.createdAt,
      }));

      return { analyses };
    },
  );

export const getReviewAnalysis = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => getReviewAnalysisSchema.parse(data))
  .handler(async ({ data, context }): Promise<ReviewAnalysis> => {
    const row = await db.query.reviewAnalyses.findFirst({
      where: eq(reviewAnalyses.id, data.id),
    });
    if (!row) throw new AppError("NOT_FOUND", "Análisis no encontrado");

    await ensureProjectAccess(row.projectId, context.userId);

    return {
      id: row.id,
      projectId: row.projectId,
      keyword: row.keyword,
      placeId: row.placeId,
      businessName: row.businessName,
      locationName: row.locationName,
      languageCode: row.languageCode,
      totalReviews: row.totalReviews,
      avgRating: row.avgRating,
      ratingDistribution: safeParseDistribution(row.ratingDistributionJson),
      reviews: safeParseReviews(row.reviewsJson),
      createdAt: row.createdAt,
    };
  });

export const deleteReviewAnalysis = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => deleteReviewAnalysisSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ success: true }> => {
    const row = await db.query.reviewAnalyses.findFirst({
      where: eq(reviewAnalyses.id, data.id),
    });
    if (!row) throw new AppError("NOT_FOUND", "Análisis no encontrado");
    await ensureProjectAccess(row.projectId, context.userId);

    await db.delete(reviewAnalyses).where(eq(reviewAnalyses.id, data.id));
    return { success: true };
  });
