// Cliente aislado de DataForSEO para el módulo "Reseñas Google".
// Usa el endpoint Business Data Google Reviews, que NO tiene variante "live":
// sólo existe task_post + task_get (async). El flujo es:
//   1. task_post con keyword / place_id + location_name + language_code.
//   2. Poll cada ~8-10s del task_get hasta que el status sea 20000 (listo).
//   3. Parsear items[] → ReviewItem[] y calcular resumen.
//
// No se mezcla con `src/server/lib/dataforseo.ts` para evitar conflictos con
// otros agentes que estén tocando ese archivo.

import { BusinessDataApi } from "dataforseo-client";
import { env } from "cloudflare:workers";
import { AppError } from "@/server/lib/errors";
import type {
  BusinessReviewsResponse,
  RatingDistribution,
  ReviewItem,
} from "@/types/reviews";

const API_BASE = "https://api.dataforseo.com";

// Crea un fetch autenticado con Basic Auth usando la API key en env.
function createAuthenticatedFetch() {
  return (url: RequestInfo, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Basic ${env.DATAFORSEO_API_KEY}`);
    return fetch(url, { ...init, headers });
  };
}

function getBusinessDataApi(): BusinessDataApi {
  return new BusinessDataApi(API_BASE, { fetch: createAuthenticatedFetch() });
}

// Cuántas veces polleamos el task_get antes de rendirnos.
// DataForSEO Google Reviews suele tardar 20-60s. 12 intentos cada 8s = ~96s máx.
const MAX_POLL_ATTEMPTS = 12;
const POLL_INTERVAL_MS = 8000;
const INITIAL_DELAY_MS = 10000; // esperar 10s antes del primer poll

// Espera N ms. Usado entre polls para no hammear DataForSEO.
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Business Data Google Reviews de DataForSEO SOLO acepta `location_name`
// a nivel país (ej. "Spain", "United States"). Si el usuario pega un
// formato granular del estilo DataForSEO Labs ("Valencia,Valencia,Spain"),
// extraemos la última parte (el país) para evitar el error
// "Invalid Field: 'location_name'". También normalizamos "España" → "Spain".
function normalizeCountryName(locationName: string): string {
  const trimmed = locationName.trim();
  if (trimmed.length === 0) return "Spain";
  // Si viene "ciudad,region,pais" nos quedamos con la última parte.
  const lastPart = trimmed.includes(",")
    ? (trimmed.split(",").pop() ?? "").trim()
    : trimmed;
  // Mapeos ES → EN más comunes (DataForSEO exige los nombres en inglés).
  const map: Record<string, string> = {
    españa: "Spain",
    espana: "Spain",
    "estados unidos": "United States",
    francia: "France",
    alemania: "Germany",
    portugal: "Portugal",
    italia: "Italy",
    "reino unido": "United Kingdom",
    mexico: "Mexico",
    méxico: "Mexico",
    argentina: "Argentina",
    colombia: "Colombia",
    chile: "Chile",
  };
  const lower = lastPart.toLowerCase();
  return map[lower] ?? lastPart;
}

// Tipo mínimo que usamos de cada review item de la API.
type ApiReviewItem = {
  type?: string;
  rating?: { value?: number | null; rating_max?: number | null } | null;
  review_text?: string | null;
  original_review_text?: string | null;
  original_language?: string | null;
  profile_name?: string | null;
  timestamp?: string | null;
  time_ago?: string | null;
  owner_answer?: string | null;
};

// Tipo mínimo del result del task_get.
type ApiReviewsResult = {
  title?: string | null;
  place_id?: string | null;
  reviews_count?: number | null;
  rating?: { value?: number | null } | null;
  items?: ApiReviewItem[] | null;
};

// Normaliza un rating a entero 1..5 (truncando).
function normalizeRating(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 1) return 1;
  if (rounded > 5) return 5;
  return rounded;
}

// Calcula distribución [c1..c5] a partir del array de reseñas.
function buildDistribution(items: ReviewItem[]): RatingDistribution {
  const dist: RatingDistribution = [0, 0, 0, 0, 0];
  for (const r of items) {
    const n = normalizeRating(r.rating);
    if (n == null) continue;
    dist[n - 1] += 1;
  }
  return dist;
}

// Calcula la media (sólo entre reseñas con rating válido).
function buildAvgRating(items: ReviewItem[]): number | null {
  const withRating = items.filter((r) => r.rating != null);
  if (withRating.length === 0) return null;
  const sum = withRating.reduce((s, r) => s + (r.rating ?? 0), 0);
  return Math.round((sum / withRating.length) * 100) / 100;
}

// Mapea un ApiReviewItem al shape interno ReviewItem.
function mapReviewItem(raw: ApiReviewItem): ReviewItem {
  // Preferimos el texto original (sin auto-translate) si viene; si no, el
  // traducido.
  const text = (raw.original_review_text ?? raw.review_text ?? "").trim();
  return {
    rating: raw.rating?.value ?? null,
    text,
    authorName: raw.profile_name ?? null,
    reviewDate: raw.timestamp ?? raw.time_ago ?? null,
    language: raw.original_language ?? null,
    ownerAnswer: raw.owner_answer ?? null,
  };
}

// Parsea la respuesta del task_get y extrae el primer result.
// Devuelve null si el task aún no está listo (status 40100 = in queue, 40102 = in progress).
// eslint-disable-next-line complexity
function extractResult(
  response: unknown,
): { ready: true; result: ApiReviewsResult } | { ready: false } | "error" {
  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  const typed = response as {
    status_code?: number;
    status_message?: string;
    tasks?: Array<{
      status_code?: number;
      status_message?: string;
      result?: ApiReviewsResult[] | null;
    }>;
  } | null;

  if (!typed) return "error";
  if (typed.status_code !== 20000) return "error";
  const task = typed.tasks?.[0];
  if (!task) return "error";

  // Códigos de "en progreso" — seguimos polleando.
  // 40100 = task in queue, 40102 = task in progress, 40602 = handler processing.
  if (
    task.status_code === 40100 ||
    task.status_code === 40102 ||
    task.status_code === 40602
  ) {
    return { ready: false };
  }

  // Éxito.
  if (task.status_code === 20000) {
    const result = task.result?.[0];
    if (!result) {
      // Task listo pero sin result (puede pasar si el negocio no existe).
      return { ready: true, result: {} };
    }
    return { ready: true, result };
  }

  // Cualquier otro código: error permanente.
  return "error";
}

/**
 * Lanza un task_post a Business Data Google Reviews y polea task_get hasta
 * que esté listo. Devuelve los resultados normalizados.
 *
 * Al menos uno de `keyword` o `placeId` debe venir informado (lo exige la API).
 */
// oxlint-disable-next-line max-lines-per-function -- task_post + polling + logging detallado no se puede partir razonablemente
export async function fetchBusinessReviews(params: {
  keyword: string;
  placeId?: string | null;
  locationName: string;
  languageCode: string;
  limit: number;
}): Promise<BusinessReviewsResponse> {
  const { keyword, placeId, locationName, languageCode, limit } = params;

  if (!keyword.trim() && !placeId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Debes proporcionar una keyword o un place_id",
    );
  }

  const api = getBusinessDataApi();

  // Normalizamos la location a nivel país: DataForSEO Business Data Google
  // Reviews NO acepta ubicaciones granulares (ciudad/region) como sí hace
  // DataForSEO Labs. Si llega "Valencia,Valencia,Spain" lo convertimos a
  // "Spain". También mapea "España" → "Spain", etc.
  const countryName = normalizeCountryName(locationName);

  // 1. Lanzar el task_post.
  const postBody: Record<string, unknown> = {
    language_code: languageCode,
    location_name: countryName,
    // Profundidad en múltiplos de 10 (cómo DataForSEO cobra).
    depth: Math.min(490, Math.max(10, Math.round(limit / 10) * 10)),
    // Ordenamos por más recientes primero para que la evolución mensual sea útil.
    sort_by: "newest",
  };
  if (placeId) postBody.place_id = placeId;
  if (!placeId && keyword.trim()) postBody.keyword = keyword.trim();

  let postResp;
  try {
    // eslint-disable-next-line typescript/no-unsafe-type-assertion
    postResp = await api.googleReviewsTaskPost([postBody as never]);
  } catch (err) {
    // Logueamos el body que enviamos para poder diagnosticar desde consola.
    console.error(
      "[dataforseoReviews] task_post threw:",
      err instanceof Error ? err.message : String(err),
      "body:",
      JSON.stringify(postBody),
    );
    throw new AppError(
      "INTERNAL_ERROR",
      `DataForSEO Google Reviews task_post falló: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!postResp || postResp.status_code !== 20000) {
    console.error(
      "[dataforseoReviews] task_post status_code distinto de 20000:",
      postResp?.status_code,
      "status_message:",
      postResp?.status_message,
      "body enviado:",
      JSON.stringify(postBody),
    );
    throw new AppError(
      "INTERNAL_ERROR",
      postResp?.status_message ?? "DataForSEO Google Reviews task_post error",
    );
  }

  const postTask = postResp.tasks?.[0];
  if (!postTask || postTask.status_code !== 20100) {
    // 20100 = "task created". Cualquier otro es error.
    console.error(
      "[dataforseoReviews] task creation status_code distinto de 20100:",
      postTask?.status_code,
      "status_message:",
      postTask?.status_message,
      "body enviado:",
      JSON.stringify(postBody),
    );
    throw new AppError(
      "INTERNAL_ERROR",
      postTask?.status_message ?? "No se pudo crear el task en DataForSEO",
    );
  }

  const taskId = postTask.id;
  if (!taskId) {
    throw new AppError("INTERNAL_ERROR", "DataForSEO no devolvió task ID");
  }

  // 2. Esperar un poco antes del primer poll (los resultados casi nunca
  //    llegan antes de 10-15s).
  await sleep(INITIAL_DELAY_MS);

  // 3. Pollear el task_get hasta que esté listo.
  let apiResult: ApiReviewsResult | null = null;
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    let getResp;
    try {
      getResp = await api.googleReviewsTaskGet(taskId);
    } catch (err) {
      throw new AppError(
        "INTERNAL_ERROR",
        `DataForSEO Google Reviews task_get falló: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const extracted = extractResult(getResp);
    if (extracted === "error") {
      throw new AppError(
        "INTERNAL_ERROR",
        "DataForSEO devolvió un error al recuperar las reseñas",
      );
    }
    if (extracted.ready) {
      apiResult = extracted.result;
      break;
    }

    // Todavía en progreso, esperar y reintentar.
    await sleep(POLL_INTERVAL_MS);
  }

  if (!apiResult) {
    throw new AppError(
      "INTERNAL_ERROR",
      `Las reseñas no estuvieron listas tras ${MAX_POLL_ATTEMPTS} intentos (${Math.round((INITIAL_DELAY_MS + MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000)}s). Inténtalo de nuevo en unos minutos.`,
    );
  }

  // 4. Normalizar.
  const apiItems: ApiReviewItem[] = apiResult.items ?? [];
  const reviews: ReviewItem[] = apiItems
    .filter(
      (it) =>
        it.type === "google_reviews_search" ||
        it.review_text != null ||
        it.original_review_text != null,
    )
    .map(mapReviewItem);

  // Total oficial reportado por Google (via DataForSEO). Puede diferir del
  // número de reseñas que venimos a descargar (depth).
  const totalReviews = apiResult.reviews_count ?? reviews.length;
  // Rating medio: preferimos el que trae DataForSEO en el result; si no, lo
  // calculamos con las reseñas descargadas.
  const avgRating =
    apiResult.rating?.value != null
      ? Math.round((apiResult.rating.value ?? 0) * 100) / 100
      : buildAvgRating(reviews);

  return {
    businessName: apiResult.title ?? null,
    placeId: apiResult.place_id ?? placeId ?? null,
    totalReviews,
    avgRating,
    ratingDistribution: buildDistribution(reviews),
    reviews,
  };
}
