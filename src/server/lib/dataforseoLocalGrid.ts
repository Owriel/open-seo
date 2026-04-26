// Cliente aislado de DataForSEO para el Geo-Grid Rank Tracker.
// No se mezcla con `src/server/lib/dataforseo.ts` para evitar conflictos
// con otros agentes que estén tocando ese archivo.
//
// Este módulo expone:
//   - `fetchLocalGridPosition`: para cada celda del grid, busca el target
//     (por place_id o dominio) en Google Maps Local Finder y devuelve la
//     posición + los top 5 competidores de la celda.
//   - `searchBusinessesByQuery`: búsqueda interactiva de negocios (limit
//     reducido) para el BusinessPicker previo al scan.

import {
  SerpApi,
  SerpGoogleMapsLiveAdvancedRequestInfo,
} from "dataforseo-client";
import { env } from "cloudflare:workers";
import { AppError } from "@/server/lib/errors";
import type { BusinessSearchResult, GridTopResult } from "@/types/localGrid";

const API_BASE = "https://api.dataforseo.com";

// Crea un fetch autenticado con la API key en Basic Auth.
function createAuthenticatedFetch() {
  return (url: RequestInfo, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Basic ${env.DATAFORSEO_API_KEY}`);
    return fetch(url, { ...init, headers });
  };
}

function getSerpApi() {
  return new SerpApi(API_BASE, { fetch: createAuthenticatedFetch() });
}

// Normaliza un dominio o URL a su hostname en minúsculas sin "www.".
// Si no se puede parsear como URL, se asume que ya es un dominio simple.
function normalizeHost(input: string | null | undefined): string {
  if (!input) return "";
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return "";
  try {
    // Si ya parece una URL, extraemos el hostname
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const host = new URL(withProtocol).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return trimmed.replace(/^www\./, "");
  }
}

// Normaliza un place_id (trim + sin espacios extraños). Devuelve cadena vacía
// si no hay valor utilizable.
function normalizePlaceId(input: string | null | undefined): string {
  if (!input) return "";
  return input.trim();
}

// Comprueba si un resultado de Maps coincide con el dominio objetivo.
// Se considera match si:
//   - el campo `domain` del resultado termina en el dominio objetivo
//   - la `url` del resultado incluye el dominio objetivo
function itemMatchesDomain(
  item: { domain?: string | null; url?: string | null },
  targetHost: string,
): boolean {
  if (!targetHost) return false;
  const itemDomain = normalizeHost(item.domain);
  if (itemDomain) {
    if (itemDomain === targetHost) return true;
    if (itemDomain.endsWith(`.${targetHost}`)) return true;
    if (targetHost.endsWith(`.${itemDomain}`)) return true;
  }
  if (item.url) {
    const urlHost = normalizeHost(item.url);
    if (urlHost === targetHost) return true;
    if (urlHost.endsWith(`.${targetHost}`)) return true;
  }
  return false;
}

// Comprueba si un item coincide con el place_id objetivo. Priority match
// (sobre el de dominio) cuando el usuario eligió un negocio en el Picker.
function itemMatchesPlaceId(
  item: { place_id?: string | null },
  targetPlaceId: string,
): boolean {
  if (!targetPlaceId) return false;
  const itemPlaceId = normalizePlaceId(item.place_id);
  return itemPlaceId !== "" && itemPlaceId === targetPlaceId;
}

// Shape mínimo que usamos del item de Maps. Lo duplicamos aquí (en lugar de
// importarlo de `dataforseo.ts`) para no tocar ese archivo (regla del proyecto).
type MapsItemShape = {
  type?: string;
  rank_group?: number | null;
  rank_absolute?: number | null;
  domain?: string | null;
  title?: string | null;
  url?: string | null;
  rating?: {
    value?: number | null;
    votes_count?: number | null;
  } | null;
  address?: string | null;
  place_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  category?: string | null;
  phone?: string | null;
};

// Extrae los 5 primeros items del array y los normaliza al tipo público
// `GridTopResult`. Si hay menos de 5, devuelve los disponibles.
function buildTopResults(items: MapsItemShape[]): GridTopResult[] {
  const top: GridTopResult[] = [];
  for (const item of items) {
    if (top.length >= 5) break;
    const pos = item.rank_absolute ?? item.rank_group ?? null;
    if (pos == null) continue;
    const normalizedDomain = normalizeHost(item.domain);
    top.push({
      position: pos,
      businessName: item.title ?? "(sin nombre)",
      domain: normalizedDomain || null,
      placeId: normalizePlaceId(item.place_id) || null,
      rating: item.rating?.value ?? null,
      reviewCount: item.rating?.votes_count ?? null,
      address: item.address ?? null,
      website: item.url ?? null,
    });
  }
  return top;
}

export type LocalGridPositionResult = {
  position: number | null;
  resultsCount: number;
  topResults: GridTopResult[];
};

/**
 * Llama al endpoint DataForSEO SERP Google Maps Live Advanced con coordenadas
 * GPS concretas y devuelve la posición del negocio objetivo en los resultados.
 *
 * Estrategia de matching (por orden de prioridad):
 *   1. Match por `place_id` (si `targetPlaceId` viene informado).
 *   2. Match por `domain` / `url` contra `targetDomain`.
 *
 * Parámetros:
 *  - keyword: término de búsqueda.
 *  - targetDomain: dominio a localizar (fallback cuando no hay place_id).
 *  - targetPlaceId: place_id del negocio (tiene prioridad sobre el dominio).
 *  - latitude / longitude: coordenadas del punto del grid.
 *  - languageCode: código de idioma ISO (ej. "es", "en").
 *  - locationName: opcional, solo para logging/fallback.
 *
 * Devuelve { position, resultsCount, topResults }.
 *   - `position`: `rank_absolute` (o `rank_group`) del match, o null si no aparece.
 *   - `resultsCount`: total de items devueltos por la API para la celda.
 *   - `topResults`: primeros 5 negocios de la celda para mostrar al click.
 */
// oxlint-disable-next-line max-lines-per-function -- Wrapper único con validación inline
export async function fetchLocalGridPosition(params: {
  keyword: string;
  targetDomain: string;
  targetPlaceId?: string | null;
  latitude: number;
  longitude: number;
  languageCode: string;
  locationName?: string;
}): Promise<LocalGridPositionResult> {
  const {
    keyword,
    targetDomain,
    targetPlaceId,
    latitude,
    longitude,
    languageCode,
  } = params;

  // Redondeamos a 7 decimales (máximo permitido por la API) y montamos
  // el string "lat,lng,zoom". Zoom 10 ≈ nivel ciudad, recomendado para grids
  // que cubren pocos kilómetros a la redonda.
  const lat = Number(latitude.toFixed(7));
  const lng = Number(longitude.toFixed(7));
  const locationCoordinate = `${lat},${lng},10z`;

  const targetHost = normalizeHost(targetDomain);
  const normalizedPlaceId = normalizePlaceId(targetPlaceId);
  if (!targetHost && !normalizedPlaceId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "El dominio objetivo o el place_id son obligatorios",
    );
  }

  const api = getSerpApi();
  const req = new SerpGoogleMapsLiveAdvancedRequestInfo({
    keyword,
    location_coordinate: locationCoordinate,
    language_code: languageCode,
    depth: 20, // top 20 de Local Finder
  });

  let response;
  try {
    response = await api.googleMapsLiveAdvanced([req]);
  } catch (err) {
    // Algunos errores del SDK no son AppError; los envolvemos
    throw new AppError(
      "INTERNAL_ERROR",
      `DataForSEO Maps Live falló: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response || response.status_code !== 20000) {
    throw new AppError(
      "INTERNAL_ERROR",
      response?.status_message ?? "DataForSEO Maps Live error",
    );
  }

  const task = response.tasks?.[0];
  if (!task || task.status_code !== 20000) {
    // Si una celda concreta falla, no tumbamos todo el grid: devolvemos
    // "no encontrado" para que el punto se pinte como gris.
    return { position: null, resultsCount: 0, topResults: [] };
  }

  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  const result = (task as { result?: Array<{ items?: unknown[] }> })
    .result?.[0];
  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  const items = (result?.items ?? []) as MapsItemShape[];

  // Precalculamos los top 5 de la celda (independiente del matching).
  const topResults = buildTopResults(items);

  // Buscamos el primer match siguiendo la prioridad place_id > dominio.
  let matchedPosition: number | null = null;
  for (const item of items) {
    const matchesByPlace =
      normalizedPlaceId !== "" && itemMatchesPlaceId(item, normalizedPlaceId);
    const matchesByDomain =
      !matchesByPlace &&
      normalizedPlaceId === "" &&
      itemMatchesDomain(item, targetHost);
    // Si hay place_id informado pero no matchea por place_id, seguimos sin
    // fallback a dominio — el usuario eligió un negocio concreto y el
    // match por dominio podría llevar a falsos positivos (misma web, otra ficha).
    if (matchesByPlace || matchesByDomain) {
      matchedPosition = item.rank_absolute ?? item.rank_group ?? null;
      break;
    }
  }

  // Caso borde: si no hay place_id y hay dominio, iteramos ya lo hemos
  // contemplado arriba. Si hay place_id pero no matchea, devolvemos null
  // (el punto se pintará como "no aparece").

  return {
    position: matchedPosition,
    resultsCount: items.length,
    topResults,
  };
}

/**
 * Busca negocios en Google Maps para el BusinessPicker previo al scan.
 * Limit bajo (10) y sin grid: es una búsqueda simple por `location_name`
 * (no por coordenadas) para resolver el negocio objetivo.
 */
export async function searchBusinessesByQuery(params: {
  query: string;
  locationName: string;
  languageCode: string;
}): Promise<BusinessSearchResult[]> {
  const { query, locationName, languageCode } = params;

  const api = getSerpApi();
  const req = new SerpGoogleMapsLiveAdvancedRequestInfo({
    keyword: query,
    location_name: locationName,
    language_code: languageCode,
    depth: 10, // top 10 es suficiente para elegir el negocio correcto
  });

  let response;
  try {
    response = await api.googleMapsLiveAdvanced([req]);
  } catch (err) {
    throw new AppError(
      "INTERNAL_ERROR",
      `DataForSEO Maps Live falló: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response || response.status_code !== 20000) {
    throw new AppError(
      "INTERNAL_ERROR",
      response?.status_message ?? "DataForSEO Maps Live error",
    );
  }

  const task = response.tasks?.[0];
  if (!task || task.status_code !== 20000) {
    // Fallo de la búsqueda: devolvemos lista vacía para que la UI indique
    // "no se encontraron negocios" en lugar de romper la pantalla.
    return [];
  }

  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  const result = (task as { result?: Array<{ items?: unknown[] }> })
    .result?.[0];
  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  const items = (result?.items ?? []) as MapsItemShape[];

  const businesses: BusinessSearchResult[] = items
    .filter((item) => (item.title ?? "").trim().length > 0)
    .map((item) => {
      const website = item.url ?? null;
      const domain = normalizeHost(item.domain || website) || null;
      return {
        placeId: normalizePlaceId(item.place_id) || null,
        businessName: item.title ?? "(sin nombre)",
        rating: item.rating?.value ?? null,
        reviewCount: item.rating?.votes_count ?? null,
        address: item.address ?? null,
        website,
        domain,
        latitude: item.latitude ?? null,
        longitude: item.longitude ?? null,
        category: item.category ?? null,
        phone: item.phone ?? null,
      };
    });

  return businesses;
}
