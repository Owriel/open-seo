// Server functions para el módulo Geo-Grid Rank Tracker.
// - runGridScan: ejecuta un scan NxN, guarda los puntos en la DB y devuelve
//   el scan completo para pintar el mapa.
// - getGridHistory: lista los scans guardados de un proyecto (con resumen).
// - getGridScan: obtiene un scan concreto con todos sus puntos.
// - deleteGridScan: borra un scan por id.
// - searchBusinesses: búsqueda previa de negocios (BusinessPicker).
// - getGoogleMapsApiKey: devuelve la API key de Google Maps para el cliente
//   (sólo a usuarios autenticados, nunca expuesta en bundle).

import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { db } from "@/db";
import { localGridScans, projects } from "@/db/schema";
import { AppError } from "@/server/lib/errors";
import { authenticatedServerFunctionMiddleware } from "@/serverFunctions/middleware";
import {
  runGridScanSchema,
  getGridHistorySchema,
  getGridScanSchema,
  deleteGridScanSchema,
  searchBusinessesSchema,
} from "@/types/schemas/localGrid";
import type {
  BusinessSearchResult,
  GridPoint,
  GridScan,
  GridScanSummary,
} from "@/types/localGrid";
import {
  fetchLocalGridPosition,
  searchBusinessesByQuery,
} from "@/server/lib/dataforseoLocalGrid";
import {
  computeGridCoordinates,
  runWithConcurrencyLimit,
} from "@/server/lib/geoGrid";

// Concurrencia máxima de llamadas a DataForSEO por scan. 8 es un punto medio
// seguro: suficientemente rápido (un 7x7 = 49 calls en ~6-7 tandas) sin
// saturar el rate limit ni explotar el wall-time del Worker.
const MAX_CONCURRENCY = 8;

// Comprueba que el proyecto existe y pertenece al usuario autenticado.
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

// Calcula el resumen (pointsFound, topPosition, avgPosition) a partir de los puntos.
function summarizePoints(points: GridPoint[]): {
  pointsTotal: number;
  pointsFound: number;
  topPosition: number | null;
  avgPosition: number | null;
} {
  const found = points.filter((p) => p.position != null);
  const pointsFound = found.length;
  const topPosition =
    found.length > 0
      ? Math.min(...found.map((p) => p.position ?? Number.POSITIVE_INFINITY))
      : null;
  const avgPosition =
    found.length > 0
      ? Math.round(
          (found.reduce((s, p) => s + (p.position ?? 0), 0) / found.length) *
            10,
        ) / 10
      : null;
  return {
    pointsTotal: points.length,
    pointsFound,
    topPosition,
    avgPosition,
  };
}

// oxlint-disable-next-line max-lines-per-function -- Orquestador del scan con persistencia
export const runGridScan = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => runGridScanSchema.parse(data))
  .handler(async ({ data, context }): Promise<GridScan> => {
    await ensureProjectAccess(data.projectId, context.userId);

    // 1. Calculamos las NxN coordenadas alrededor del centro.
    const coords = computeGridCoordinates(
      data.centerLat,
      data.centerLng,
      data.gridSize,
      data.radiusKm,
    );

    // 2. Preparamos una tarea por coordenada. Cada una consulta DataForSEO
    //    Maps Live Advanced y devuelve el GridPoint final (con top 5).
    const tasks = coords.map((c) => async (): Promise<GridPoint> => {
      try {
        const res = await fetchLocalGridPosition({
          keyword: data.keyword,
          targetDomain: data.targetDomain,
          targetPlaceId: data.targetPlaceId ?? null,
          latitude: c.lat,
          longitude: c.lng,
          languageCode: data.languageCode,
          locationName: data.locationName,
        });
        return {
          lat: c.lat,
          lng: c.lng,
          position: res.position,
          resultsCount: res.resultsCount,
          topResults: res.topResults,
        };
      } catch {
        // Una celda fallida no tumba el scan: la devolvemos como "no encontrado".
        return {
          lat: c.lat,
          lng: c.lng,
          position: null,
          resultsCount: 0,
          topResults: [],
        };
      }
    });

    // 3. Ejecutamos con límite de concurrencia.
    const points = await runWithConcurrencyLimit(tasks, MAX_CONCURRENCY);

    // 4. Persistimos el scan con todos los puntos como JSON.
    const scanId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await db.insert(localGridScans).values({
      id: scanId,
      projectId: data.projectId,
      keyword: data.keyword,
      targetDomain: data.targetDomain,
      targetPlaceId: data.targetPlaceId ?? null,
      businessName: data.businessName ?? null,
      centerLat: data.centerLat,
      centerLng: data.centerLng,
      gridSize: data.gridSize,
      radiusKm: data.radiusKm,
      locationName: data.locationName ?? null,
      languageCode: data.languageCode,
      pointsJson: JSON.stringify(points),
      createdAt,
    });

    return {
      id: scanId,
      projectId: data.projectId,
      keyword: data.keyword,
      targetDomain: data.targetDomain,
      targetPlaceId: data.targetPlaceId ?? null,
      businessName: data.businessName ?? null,
      centerLat: data.centerLat,
      centerLng: data.centerLng,
      gridSize: data.gridSize,
      radiusKm: data.radiusKm,
      locationName: data.locationName ?? null,
      languageCode: data.languageCode,
      points,
      createdAt,
    };
  });

export const getGridHistory = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => getGridHistorySchema.parse(data))
  .handler(async ({ data, context }): Promise<{ scans: GridScanSummary[] }> => {
    await ensureProjectAccess(data.projectId, context.userId);

    const rows = await db
      .select()
      .from(localGridScans)
      .where(eq(localGridScans.projectId, data.projectId))
      .orderBy(desc(localGridScans.createdAt))
      .limit(data.limit);

    const scans: GridScanSummary[] = rows.map((row) => {
      let points: GridPoint[] = [];
      try {
        // eslint-disable-next-line typescript/no-unsafe-type-assertion
        points = JSON.parse(row.pointsJson) as GridPoint[];
      } catch {
        points = [];
      }
      const summary = summarizePoints(points);
      return {
        id: row.id,
        keyword: row.keyword,
        targetDomain: row.targetDomain,
        businessName: row.businessName,
        centerLat: row.centerLat,
        centerLng: row.centerLng,
        gridSize: row.gridSize,
        radiusKm: row.radiusKm,
        locationName: row.locationName,
        createdAt: row.createdAt,
        ...summary,
      };
    });

    return { scans };
  });

export const getGridScan = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => getGridScanSchema.parse(data))
  .handler(async ({ data, context }): Promise<GridScan> => {
    const row = await db.query.localGridScans.findFirst({
      where: eq(localGridScans.id, data.scanId),
    });
    if (!row) throw new AppError("NOT_FOUND", "Scan no encontrado");

    // Verificamos acceso al proyecto al que pertenece el scan.
    await ensureProjectAccess(row.projectId, context.userId);

    let points: GridPoint[] = [];
    try {
      // eslint-disable-next-line typescript/no-unsafe-type-assertion
      points = JSON.parse(row.pointsJson) as GridPoint[];
    } catch {
      points = [];
    }

    return {
      id: row.id,
      projectId: row.projectId,
      keyword: row.keyword,
      targetDomain: row.targetDomain,
      targetPlaceId: row.targetPlaceId,
      businessName: row.businessName,
      centerLat: row.centerLat,
      centerLng: row.centerLng,
      gridSize: row.gridSize,
      radiusKm: row.radiusKm,
      locationName: row.locationName,
      languageCode: row.languageCode,
      points,
      createdAt: row.createdAt,
    };
  });

export const deleteGridScan = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => deleteGridScanSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ success: true }> => {
    const row = await db.query.localGridScans.findFirst({
      where: eq(localGridScans.id, data.scanId),
    });
    if (!row) throw new AppError("NOT_FOUND", "Scan no encontrado");
    await ensureProjectAccess(row.projectId, context.userId);

    await db.delete(localGridScans).where(eq(localGridScans.id, data.scanId));
    return { success: true };
  });

// Búsqueda de negocios para el BusinessPicker previo al scan.
// Usa DataForSEO Google Maps Live Advanced con `location_name` (geocoding
// interno de DataForSEO) y limit 10 para ahorrar coste.
export const searchBusinesses = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => searchBusinessesSchema.parse(data))
  .handler(async ({ data }): Promise<{ results: BusinessSearchResult[] }> => {
    const results = await searchBusinessesByQuery({
      query: data.query,
      locationName: data.locationName,
      languageCode: data.languageCode,
    });
    return { results };
  });

// Devuelve la API key de Google Maps JavaScript API al cliente autenticado.
// La key NO va en el bundle: se pide en runtime vía esta server fn, así
// queda protegida por el middleware de autenticación (ensureUser).
export const getGoogleMapsApiKey = createServerFn({ method: "GET" })
  .middleware(authenticatedServerFunctionMiddleware)
  .handler((): { apiKey: string } => {
    const apiKey = env.GOOGLE_PLACES_API_KEY?.trim() ?? "";
    if (!apiKey) {
      throw new AppError(
        "INTERNAL_ERROR",
        "GOOGLE_PLACES_API_KEY no está configurada en el servidor",
      );
    }
    return { apiKey };
  });
