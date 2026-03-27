/**
 * Lógica core del Revisor Multidioma — adaptada de Node.js a fetch API (Cloudflare Workers)
 *
 * Analiza fichas de Google Business Profile en 81 idiomas para detectar
 * variantes multiidioma del nombre del negocio.
 */

import { GOOGLE_LANGUAGES } from "@/types/multilang";
import type { MultilangFicha, LangResult, MultilangVariant, PlaceSearchResult } from "@/types/multilang";
import { env } from "cloudflare:workers";

/** Obtiene la API key de Google Places desde variables de entorno */
function getGooglePlacesApiKey(): string {
  const key = env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY no configurada en variables de entorno");
  return key;
}

// Concurrencia de peticiones por batch
const CONCURRENCY = 5;
// Delay entre batches (ms)
const BATCH_DELAY = 500;

// ============================================================================
// FUNCIONES DE RESOLUCIÓN DE FTID
// ============================================================================

/**
 * Decodifica el ftid real desde un placeId de Google Places (formato base64).
 * Los bytes en offsets 3 (little-endian uint64) y 12 (little-endian uint64)
 * contienen las dos partes del ftid hexadecimal.
 */
export function decodeFtidFromPlaceId(placeId: string): string | null {
  try {
    const raw = atob(placeId);
    if (raw.length < 20) return null;
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const view = new DataView(bytes.buffer);
    const v1 = view.getBigUint64(3, true);
    const v2 = view.getBigUint64(12, true);
    const ftid = `0x${v1.toString(16)}:0x${v2.toString(16)}`;
    // Validar que ambas partes tienen al menos 2 dígitos hex y no es 0x0:
    if (isValidFtid(ftid)) return ftid;
    return null;
  } catch {
    return null;
  }
}

/** Extrae el ftid hexadecimal de una URL de Google Maps */
export function extractFtidFromUrl(url: string): string | null {
  const hexMatch = url.match(/(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  if (hexMatch) return hexMatch[1];
  const decMatch = url.match(/[?&]cid=(\d+)/);
  if (decMatch) return decMatch[1];
  return null;
}

/** Valida que un ftid sea válido (no 0x0:...) */
function isValidFtid(f: string | null): f is string {
  return !!f && /^0x[0-9a-f]{2,}:0x[0-9a-f]{2,}$/i.test(f) && !f.startsWith("0x0:");
}

/**
 * Sigue redirects de una URL y retorna la URL final.
 * Adaptado de http/https de Node.js a fetch API.
 */
export async function resolveUrl(inputUrl: string, maxRedirects = 5): Promise<string> {
  if (maxRedirects <= 0) return inputUrl;

  try {
    const response = await fetch(inputUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "manual", // No seguir redirects automáticamente
    });

    // Si hay redirect, seguirlo manualmente
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location) {
        return resolveUrl(location, maxRedirects - 1);
      }
    }

    // Leer body para buscar ftid en el HTML
    const data = await response.text();
    const hexInBody = data.match(/(0x[0-9a-f]+:0x[0-9a-f]+)/i);
    if (hexInBody) return inputUrl + "#ftid=" + hexInBody[1];

    // Buscar meta refresh
    const metaRefresh = data.match(/url=([^"'>\s]+)/i);
    if (metaRefresh && maxRedirects > 1) {
      let rUrl = metaRefresh[1].replace(/&amp;/g, "&");
      if (rUrl.startsWith("/")) {
        const parsed = new URL(inputUrl);
        rUrl = `${parsed.protocol}//${parsed.hostname}${rUrl}`;
      }
      return resolveUrl(rUrl, maxRedirects - 1);
    }

    return inputUrl;
  } catch {
    return inputUrl;
  }
}

/**
 * Busca una ficha de negocio por nombre usando Google Places API Text Search.
 */
export async function searchPlaceByName(
  businessName: string,
): Promise<{ placeId: string; name: string; address: string; mapsUrl: string } | null> {
  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": getGooglePlacesApiKey(),
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.googleMapsUri",
      },
      body: JSON.stringify({ textQuery: businessName, languageCode: "es" }),
      signal: AbortSignal.timeout(10000),
    });

    const json: {
      places?: Array<{
        id: string;
        displayName?: { text: string };
        formattedAddress?: string;
        googleMapsUri?: string;
      }>;
    } = await response.json();

    if (json.places && json.places.length > 0) {
      const place = json.places[0];
      return {
        placeId: place.id,
        name: place.displayName?.text || businessName,
        address: place.formattedAddress || "",
        mapsUrl: place.googleMapsUri || "",
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Busca múltiples fichas en Google Places (hasta 5 resultados) con rating y reseñas.
 * Usada por el buscador del frontend.
 */
export async function searchPlaces(
  query: string,
): Promise<PlaceSearchResult[]> {
  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": getGooglePlacesApiKey(),
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.rating,places.userRatingCount",
      },
      body: JSON.stringify({ textQuery: query, languageCode: "es" }),
      signal: AbortSignal.timeout(10000),
    });

    const json: {
      places?: Array<{
        id: string;
        displayName?: { text: string };
        formattedAddress?: string;
        googleMapsUri?: string;
        rating?: number;
        userRatingCount?: number;
      }>;
    } = await response.json();

    if (!json.places || json.places.length === 0) return [];

    return json.places.slice(0, 5).map((place) => ({
      placeId: place.id,
      name: place.displayName?.text || query,
      address: place.formattedAddress || "",
      mapsUrl: place.googleMapsUri || "",
      rating: place.rating ?? null,
      totalReviews: place.userRatingCount ?? null,
    }));
  } catch {
    return [];
  }
}

/**
 * Resuelve el ftid completo de una URL de Google Maps.
 * Estrategias: decode placeId, extracción de URL, seguir redirects, CID decimal.
 */
export async function resolveFtid(url: string, placeId?: string): Promise<string | null> {
  // 1. Decodificar ftid directamente del placeId (más rápido, sin API calls)
  if (placeId) {
    const decoded = decodeFtidFromPlaceId(placeId);
    if (decoded) return decoded;
  }

  // 2. Extraer hex ftid directamente de la URL
  let ftid = extractFtidFromUrl(url);
  if (isValidFtid(ftid)) return ftid;

  // 3. Intentar resolver via placeId construyendo una URL de Maps
  if (placeId) {
    try {
      const pidUrl = `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${placeId}`;
      const resolved = await resolveUrl(pidUrl);
      ftid = extractFtidFromUrl(resolved);
      if (isValidFtid(ftid)) return ftid;
    } catch {
      // Ignorar error de resolución via placeId
    }
  }

  // 4. URL corta → resolver siguiendo redirects
  const resolved = await resolveUrl(url);
  ftid = extractFtidFromUrl(resolved);
  if (isValidFtid(ftid)) return ftid;

  // 5. CID decimal como fallback (formato parcial 0x0:0xHEX)
  const cidFromUrl = url.match(/[?&]cid=(\d+)/) || resolved.match(/[?&]cid=(\d+)/);
  if (cidFromUrl) {
    return `0x0:0x${BigInt(cidFromUrl[1]).toString(16)}`;
  }

  return null;
}

/**
 * Obtiene el nombre de un negocio en un idioma usando Google Places API (New).
 * Usa Place Details GET por placeId — campo displayName (Basic, gratuito).
 * Funciona desde CF Workers sin problemas de bloqueo.
 */
export async function fetchNameViaPlacesAPI(
  placeId: string,
  lang: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?languageCode=${lang}`,
      {
        headers: {
          "X-Goog-Api-Key": getGooglePlacesApiKey(),
          "X-Goog-FieldMask": "displayName",
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) return null;
    const json: { displayName?: { text: string } } = await response.json();
    return json.displayName?.text || null;
  } catch {
    return null;
  }
}

/**
 * Analiza una ficha en todos los idiomas (81 idiomas, batches de 10).
 * Usa Google Places API oficial (Place Details) — funciona desde CF Workers.
 * Retorna la ficha actualizada con resultados.
 */
export async function analyzeFicha(ficha: MultilangFicha): Promise<MultilangFicha> {
  let placeId: string | null = null;

  // 1. Si es nombre sin URL, buscar en Google Places
  if (!ficha.url && ficha.inputName) {
    const placeResult = await searchPlaceByName(ficha.inputName);
    if (placeResult) {
      ficha.url = placeResult.mapsUrl;
      ficha.baseName = placeResult.name;
      placeId = placeResult.placeId;
      // Resolver ftid desde placeId (decode base64, sin llamar a API interna)
      const decoded = decodeFtidFromPlaceId(placeResult.placeId);
      if (decoded) {
        ficha.ftid = decoded;
      } else {
        ficha.ftid = await resolveFtid(placeResult.mapsUrl, placeResult.placeId);
      }
    } else {
      return {
        ...ficha,
        status: "error",
        error: "No se encontró la ficha por nombre. Añade la URL de Google Maps manualmente.",
      };
    }
  }

  // 2. Si tenemos URL pero no placeId, buscar por nombre para obtener placeId
  if (!placeId && (ficha.baseName || ficha.inputName)) {
    const placeResult = await searchPlaceByName(ficha.baseName || ficha.inputName || "");
    if (placeResult) {
      placeId = placeResult.placeId;
      if (!ficha.ftid) {
        const decoded = decodeFtidFromPlaceId(placeResult.placeId);
        ficha.ftid = decoded || await resolveFtid(ficha.url || placeResult.mapsUrl, placeResult.placeId);
      }
    }
  }

  if (!placeId) {
    return { ...ficha, status: "error", error: "No se pudo obtener el placeId" };
  }

  if (!ficha.ftid) {
    // Intentar resolver ftid si aún no lo tenemos
    if (ficha.url) ficha.ftid = await resolveFtid(ficha.url);
    if (!ficha.ftid) ficha.ftid = "unknown";
  }

  // 3. Probar primero un idioma para verificar que la API funciona
  const testName = await fetchNameViaPlacesAPI(placeId, "es");
  if (!testName) {
    // Debug: hacer una llamada raw y guardar el error detallado
    let debugInfo = `placeId=${placeId}`;
    try {
      const testResp = await fetch(
        `https://places.googleapis.com/v1/places/${placeId}?languageCode=es`,
        {
          headers: {
            "X-Goog-Api-Key": getGooglePlacesApiKey(),
            "X-Goog-FieldMask": "displayName",
          },
        },
      );
      const testBody = await testResp.text();
      debugInfo += `, status=${testResp.status}, body=${testBody.substring(0, 300)}`;
    } catch (e) {
      debugInfo += `, fetchError=${e instanceof Error ? e.message : String(e)}`;
    }
    return {
      ...ficha,
      status: "error",
      error: `Places API no responde: ${debugInfo}`,
    };
  }

  // 4. Analizar todos los idiomas usando Google Places API
  const results: LangResult[] = [];
  // Ya tenemos el resultado de "es", añadirlo
  results.push({ code: "es", name: "Spanish", title: testName });

  // Analizar el resto de idiomas (excepto "es" que ya tenemos)
  const remainingLangs = GOOGLE_LANGUAGES.filter((l) => l.code !== "es");
  for (let i = 0; i < remainingLangs.length; i += CONCURRENCY) {
    const batch = remainingLangs.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (lang) => {
        const title = await fetchNameViaPlacesAPI(placeId, lang.code);
        return title ? { code: lang.code, name: lang.name, title } : null;
      }),
    );
    for (const r of batchResults) {
      if (r) results.push(r);
    }
    // Delay entre batches (excepto el último)
    if (i + CONCURRENCY < remainingLangs.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY));
    }
  }

  // 4. Agrupar resultados
  const baseName = results.find((r) => r.code === "es")?.title ?? results[0]?.title ?? "";
  const nameMap = new Map<string, { code: string; name: string }[]>();

  for (const r of results) {
    if (r.title === baseName) continue;
    const existing = nameMap.get(r.title);
    if (existing) existing.push({ code: r.code, name: r.name });
    else nameMap.set(r.title, [{ code: r.code, name: r.name }]);
  }

  const variants: MultilangVariant[] = Array.from(nameMap.entries()).map(([name, languages]) => ({
    name,
    languages,
    discoveredAt: null,
  }));

  const baseLanguages = results.filter((r) => r.title === baseName).map((r) => ({ code: r.code, name: r.name }));

  return {
    ...ficha,
    baseName,
    baseLanguages,
    variants,
    totalLanguagesChecked: results.length,
    allResults: results,
    lastAnalyzed: new Date().toISOString(),
    status: "analyzed",
    error: null,
  };
}
