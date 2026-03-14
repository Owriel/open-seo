/**
 * Lógica core del Revisor Multidioma — adaptada de Node.js a fetch API (Cloudflare Workers)
 *
 * Analiza fichas de Google Business Profile en 81 idiomas para detectar
 * variantes multiidioma del nombre del negocio.
 */

import { GOOGLE_LANGUAGES } from "@/types/multilang";
import type { MultilangFicha, LangResult, MultilangVariant } from "@/types/multilang";

// API Key de Google Places (para buscar fichas por nombre)
const GOOGLE_PLACES_API_KEY = "AIzaSyBu7TCezaciiRXVVwtPKUmmoDPOzbZ_D_o";

// Concurrencia de peticiones por batch
const CONCURRENCY = 10;
// Delay entre batches (ms)
const BATCH_DELAY = 400;

// ============================================================================
// FUNCIONES DE RESOLUCIÓN DE FTID
// ============================================================================

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
 * Obtiene el nombre de un negocio en un idioma específico usando la API interna de Google Maps.
 * Retorna el nombre o null.
 */
export async function fetchNameForLang(
  ftid: string,
  lang: string,
  returnFtid = false,
): Promise<string | { name: string | null; realFtid: string | null } | null> {
  try {
    const reqPath = `/maps/preview/place?authuser=0&hl=${lang}&gl=es&pb=!1m17!1s${ftid}!3m12!1m3!1d500!2d0!3d0!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m2!3d0!4d0`;

    const response = await fetch(`https://www.google.com${reqPath}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Cookie: "CONSENT=YES+cb.20210720-07-p0.en+FX+111",
        "Accept-Language": lang,
      },
      signal: AbortSignal.timeout(8000),
    });

    const data = await response.text();
    const cleaned = data.replace(/^\)\]\}'\n?/, "");

    // Estrategia 1: ftid completo
    if (!ftid.startsWith("0x0:")) {
      const idx = cleaned.indexOf(ftid);
      if (idx > -1) {
        const after = cleaned.substring(idx + ftid.length);
        const m = after.match(/,"([^"]+)"/);
        if (m) {
          const decoded = m[1].replace(/\\u[\dA-Fa-f]{4}/g, (x) =>
            String.fromCharCode(parseInt(x.replace("\\u", ""), 16)),
          );
          return returnFtid ? { name: decoded, realFtid: ftid } : decoded;
        }
      }
    }

    // Estrategia 2: encontrar ftid real desde CID
    const cidHex = ftid.split(":")[1];
    const re = new RegExp(`(0x[0-9a-f]{4,}:${cidHex})`, "i");
    const realMatch = cleaned.match(re);
    if (realMatch && !realMatch[1].startsWith("0x0:")) {
      const realFtid = realMatch[1];
      const idx = cleaned.indexOf(realFtid);
      if (idx > -1) {
        const after = cleaned.substring(idx + realFtid.length);
        const m = after.match(/,"([^"]+)"/);
        if (m && !m[1].startsWith("ChIJ") && !m[1].startsWith("0x")) {
          const decoded = m[1].replace(/\\u[\dA-Fa-f]{4}/g, (x) =>
            String.fromCharCode(parseInt(x.replace("\\u", ""), 16)),
          );
          return returnFtid ? { name: decoded, realFtid } : decoded;
        }
      }
    }

    // Estrategia 3: fallback pattern
    const all = [...cleaned.matchAll(/(0x[0-9a-f]{4,}:0x[0-9a-f]{4,})","([^"]+)"/gi)];
    for (const match of all) {
      if (!match[1].startsWith("0x0:") && !match[2].startsWith("ChIJ") && !/^0x/.test(match[2])) {
        const decoded = match[2].replace(/\\u[\dA-Fa-f]{4}/g, (x) =>
          String.fromCharCode(parseInt(x.replace("\\u", ""), 16)),
        );
        return returnFtid ? { name: decoded, realFtid: match[1] } : decoded;
      }
    }

    return returnFtid ? { name: null, realFtid: null } : null;
  } catch {
    return returnFtid ? { name: null, realFtid: null } : null;
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
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.googleMapsUri",
      },
      body: JSON.stringify({ textQuery: businessName, languageCode: "es" }),
      signal: AbortSignal.timeout(10000),
    });

    const json = (await response.json()) as {
      places?: Array<{
        id: string;
        displayName?: { text: string };
        formattedAddress?: string;
        googleMapsUri?: string;
      }>;
    };

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
 * Resuelve el ftid completo de una URL de Google Maps.
 * Intenta varias estrategias: extracción directa, CID decimal, seguir redirects.
 */
export async function resolveFtid(url: string): Promise<string | null> {
  // Intento directo con hex
  let ftid = extractFtidFromUrl(url);
  if (isValidFtid(ftid)) return ftid;

  // CID decimal → probar
  const decMatch = url.match(/[?&]cid=(\d+)/);
  if (decMatch) {
    const cidFtid = `0x0:0x${BigInt(decMatch[1]).toString(16)}`;
    const probe = (await fetchNameForLang(cidFtid, "es", true)) as {
      name: string | null;
      realFtid: string | null;
    };
    if (probe.realFtid && isValidFtid(probe.realFtid)) return probe.realFtid;
    return cidFtid; // fallback a formato 0x0:
  }

  // URL corta → resolver
  const resolved = await resolveUrl(url);
  ftid = extractFtidFromUrl(resolved);
  if (isValidFtid(ftid)) return ftid;

  const decMatch2 = resolved.match(/[?&]cid=(\d+)/);
  if (decMatch2) {
    const cidFtid = `0x0:0x${BigInt(decMatch2[1]).toString(16)}`;
    const probe = (await fetchNameForLang(cidFtid, "es", true)) as {
      name: string | null;
      realFtid: string | null;
    };
    if (probe.realFtid && isValidFtid(probe.realFtid)) return probe.realFtid;
    return cidFtid;
  }

  return null;
}

/**
 * Analiza una ficha en todos los idiomas (81 idiomas, batches de 10).
 * Retorna la ficha actualizada con resultados.
 */
export async function analyzeFicha(ficha: MultilangFicha): Promise<MultilangFicha> {
  // 1. Si es nombre sin URL, buscar en Google Places
  if (!ficha.url && ficha.inputName) {
    const placeResult = await searchPlaceByName(ficha.inputName);
    if (placeResult) {
      ficha.url = placeResult.mapsUrl;
      ficha.baseName = placeResult.name;
      ficha.ftid = await resolveFtid(placeResult.mapsUrl);

      // Fallback: decodificar ftid desde placeId
      if (!ficha.ftid && placeResult.placeId) {
        try {
          // Base64 decode del placeId para extraer ftid
          const raw = atob(placeResult.placeId);
          if (raw.length >= 20) {
            const bytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
            const view = new DataView(bytes.buffer);
            const v1 = view.getBigUint64(3, true);
            const v2 = view.getBigUint64(12, true);
            ficha.ftid = `0x${v1.toString(16)}:0x${v2.toString(16)}`;
          }
        } catch {
          // Ignorar error de decodificación
        }
      }
    } else {
      return {
        ...ficha,
        status: "error",
        error: "No se encontró la ficha por nombre. Añade la URL de Google Maps manualmente.",
      };
    }
  }

  // 2. Resolver ftid si no lo tenemos
  if (!ficha.ftid && ficha.url) {
    ficha.ftid = await resolveFtid(ficha.url);
  }

  if (!ficha.ftid) {
    return { ...ficha, status: "error", error: "No se pudo resolver el ftid" };
  }

  // 3. Si el ftid es 0x0:..., intentar obtener el real
  let realFtid = ficha.ftid;
  if (ficha.ftid.startsWith("0x0:")) {
    const probe = (await fetchNameForLang(ficha.ftid, "es", true)) as {
      name: string | null;
      realFtid: string | null;
    };
    if (probe.realFtid && isValidFtid(probe.realFtid)) {
      realFtid = probe.realFtid;
    }
  }

  // 4. Analizar todos los idiomas en batches
  const results: LangResult[] = [];

  for (let i = 0; i < GOOGLE_LANGUAGES.length; i += CONCURRENCY) {
    const batch = GOOGLE_LANGUAGES.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (lang) => {
        const title = (await fetchNameForLang(realFtid, lang.code)) as string | null;
        return title ? { code: lang.code, name: lang.name, title } : null;
      }),
    );
    for (const r of batchResults) {
      if (r) results.push(r);
    }
    // Delay entre batches (excepto el último)
    if (i + CONCURRENCY < GOOGLE_LANGUAGES.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY));
    }
  }

  // 5. Agrupar resultados
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
    ftid: realFtid,
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
