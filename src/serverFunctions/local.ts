import { createServerFn } from "@tanstack/react-start";
import { authenticatedServerFunctionMiddleware } from "@/serverFunctions/middleware";
import {
  localPackSearchSchema,
  localKeywordSuggestionsSchema,
  localCityKeywordSuggestionsSchema,
} from "@/types/schemas/local";
import {
  fetchGoogleMapsResultsRaw,
  fetchKeywordSuggestionsRaw,
  fetchGoogleAdsKeywordsForKeywordsRaw,
  lookupCityLocationCode,
} from "@/server/lib/dataforseo";
import {
  buildCacheKey,
  getCached,
  setCached,
  CACHE_TTL,
} from "@/server/lib/kv-cache";
import type { LocalPackResult, LocalKeywordSuggestion } from "@/types/local";

export const searchLocalPack = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => localPackSearchSchema.parse(data))
  .handler(async ({ data }): Promise<{ results: LocalPackResult[] }> => {
    // Check KV cache
    const cacheKey = buildCacheKey("local:pack", {
      keyword: data.keyword,
      locationCode: data.locationCode,
      languageCode: data.languageCode,
    });

    const cachedRaw = await getCached(cacheKey) as { results: LocalPackResult[] } | null;
    if (cachedRaw && cachedRaw.results?.length > 0) {
      console.log("[LOCAL-PACK] Serving from cache:", cachedRaw.results.length, "results");
      return cachedRaw;
    }

    console.log("[LOCAL-PACK] Cache miss, calling DataForSEO...");
    const rawItems = await fetchGoogleMapsResultsRaw(
      data.keyword,
      data.locationCode,
      data.languageCode,
      20,
    );

    const results: LocalPackResult[] = rawItems
      .filter((item) => item.title)
      .map((item, idx) => {
        // Build Google Maps URL from cid or place_id
        let googleMapsUrl: string | null = null;
        if (item.cid) {
          googleMapsUrl = `https://www.google.com/maps?cid=${item.cid}`;
        } else if (item.place_id) {
          googleMapsUrl = `https://www.google.com/maps/place/?q=place_id:${item.place_id}`;
        }

        // Parse work hours into simple day → hours strings
        let workHours: Record<string, string[]> | null = null;
        const rawHours = item.work_hours?.work_hours;
        if (rawHours && typeof rawHours === "object") {
          workHours = {};
          for (const [day, slots] of Object.entries(rawHours)) {
            if (Array.isArray(slots)) {
              workHours[day] = slots.map((slot) => {
                const oh = slot.open?.hour ?? 0;
                const om = slot.open?.minute ?? 0;
                const ch = slot.close?.hour ?? 0;
                const cm = slot.close?.minute ?? 0;
                const pad = (n: number) => String(n).padStart(2, "0");
                return `${pad(oh)}:${pad(om)} - ${pad(ch)}:${pad(cm)}`;
              });
            }
          }
        }

        // Extract justification descriptions
        const localJustifications = (item.local_justifications ?? [])
          .map((j) => j.description ?? "")
          .filter(Boolean);

        return {
          title: item.title ?? "",
          rating: item.rating?.value ?? null,
          reviewCount: item.rating?.votes_count ?? null,
          ratingDistribution: item.rating_distribution ?? null,
          position: item.rank_group ?? idx + 1,
          category: item.category ?? null,
          additionalCategories: (item.additional_categories ?? []).filter(Boolean) as string[],
          address: item.address ?? null,
          city: item.address_info?.city ?? null,
          phone: item.phone ?? null,
          url: item.url ?? null,
          contactUrl: item.contact_url ?? null,
          bookOnlineUrl: item.book_online_url ?? null,
          domain: item.domain ?? null,
          isClaimed: item.is_claimed ?? null,
          snippet: item.snippet ?? null,
          googleMapsUrl,
          mainImage: item.main_image ?? null,
          totalPhotos: item.total_photos ?? null,
          priceLevel: item.price_level ?? null,
          workHours,
          localJustifications,
          latitude: item.latitude ?? null,
          longitude: item.longitude ?? null,
        };
      });

    // Cache the result
    if (results.length > 0) {
      await setCached(cacheKey, { results }, CACHE_TTL.localPack, {
        label: `Local Pack: ${data.keyword}`,
        params: { keyword: data.keyword, locationCode: data.locationCode },
      });
    }

    return { results };
  });

export const getLocalKeywordSuggestions = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => localKeywordSuggestionsSchema.parse(data))
  .handler(async ({ data }): Promise<{ keywords: LocalKeywordSuggestion[] }> => {
    // Check KV cache
    const cacheKey = buildCacheKey("local:keywords", {
      keyword: data.keyword,
      locationCode: data.locationCode,
      languageCode: data.languageCode,
      limit: data.limit,
    });

    const cachedRaw = await getCached(cacheKey) as { keywords: LocalKeywordSuggestion[] } | null;
    if (cachedRaw && cachedRaw.keywords?.length > 0) {
      console.log("[LOCAL-KW] Serving from cache:", cachedRaw.keywords.length, "keywords");
      return cachedRaw;
    }

    console.log("[LOCAL-KW] Cache miss, calling DataForSEO...");
    const rawItems = await fetchKeywordSuggestionsRaw(
      data.keyword,
      data.locationCode,
      data.languageCode,
      data.limit,
    );

    // Local intent markers
    const localTerms = new Set([
      "cerca", "cerca de mi", "near me", "en", "barrio", "zona",
      "mejor", "mejores", "barato", "baratos", "precio", "precios",
      "urgente", "24h", "24 horas", "abierto", "horario",
    ]);

    const keywords: LocalKeywordSuggestion[] = rawItems
      .filter((item) => item.keyword)
      .map((item) => {
        const kw = (item.keyword ?? "").toLowerCase();
        const hasLocalIntent = localTerms.has(kw) ||
          Array.from(localTerms).some((t) => kw.includes(t));

        return {
          keyword: item.keyword ?? "",
          searchVolume: item.keyword_info?.search_volume ?? null,
          cpc: item.keyword_info?.cpc ?? null,
          keywordDifficulty: item.keyword_properties?.keyword_difficulty ?? null,
          intent: item.search_intent_info?.main_intent ?? null,
          hasLocalPack: hasLocalIntent,
        };
      });

    // Cache the result
    if (keywords.length > 0) {
      await setCached(cacheKey, { keywords }, CACHE_TTL.localKeywords, {
        label: `Keywords locales: ${data.keyword}`,
        params: { keyword: data.keyword, locationCode: data.locationCode },
      });
    }

    return { keywords };
  });

/**
 * Keyword suggestions for the base keyword located IN a specific city.
 * Uses Google Ads Keywords For Keywords endpoint (supports city-level location_code).
 * e.g., if user searched "dentista castellon", this searches "dentista" located in Castellón.
 */
export const getCityKeywordSuggestions = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => localCityKeywordSuggestionsSchema.parse(data))
  .handler(async ({ data }): Promise<{ keywords: LocalKeywordSuggestion[]; cityFound: string | null }> => {
    // Check KV cache
    const cacheKey = buildCacheKey("local:citykw", {
      keyword: data.keyword,
      cityName: data.cityName,
      languageCode: data.languageCode,
    });

    const cachedRaw = await getCached(cacheKey) as { keywords: LocalKeywordSuggestion[]; cityFound: string | null } | null;
    if (cachedRaw && cachedRaw.keywords?.length > 0) {
      console.log("[LOCAL-CITY-KW] Serving from cache:", cachedRaw.keywords.length, "keywords");
      return cachedRaw;
    }

    // 1. Look up city location_code in DataForSEO
    console.log("[LOCAL-CITY-KW] Looking up city:", data.cityName, "country:", data.countryIso);
    const cityLocation = await lookupCityLocationCode(data.cityName, data.countryIso);

    if (!cityLocation) {
      console.log("[LOCAL-CITY-KW] City not found in DataForSEO locations:", data.cityName);
      return { keywords: [], cityFound: null };
    }

    console.log("[LOCAL-CITY-KW] City found:", cityLocation.locationName, "code:", cityLocation.locationCode);

    // 2. Fetch keywords via Google Ads API at city level
    const rawItems = await fetchGoogleAdsKeywordsForKeywordsRaw(
      [data.keyword],
      cityLocation.locationCode,
      data.languageCode,
    );

    const keywords: LocalKeywordSuggestion[] = rawItems
      .filter((item) => item.keyword)
      .map((item) => ({
        keyword: item.keyword ?? "",
        searchVolume: item.search_volume ?? null,
        cpc: item.cpc ?? null,
        keywordDifficulty: item.competition_index ?? null,
        intent: item.competition?.toLowerCase() ?? null, // LOW, MEDIUM, HIGH
        hasLocalPack: false,
      }));

    const result = { keywords, cityFound: cityLocation.locationName };

    // Cache the result
    if (keywords.length > 0) {
      await setCached(cacheKey, result, CACHE_TTL.localKeywords, {
        label: `Keywords ciudad: ${data.keyword} en ${cityLocation.locationName}`,
        params: { keyword: data.keyword, city: cityLocation.locationName },
      });
    }

    return result;
  });

