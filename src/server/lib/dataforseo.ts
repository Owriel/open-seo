import {
  DataforseoLabsApi,
  SerpApi,
  DataforseoLabsGoogleRelatedKeywordsLiveRequestInfo,
  DataforseoLabsGoogleKeywordSuggestionsLiveRequestInfo,
  DataforseoLabsGoogleKeywordIdeasLiveRequestInfo,
  DataforseoLabsGoogleDomainRankOverviewLiveRequestInfo,
  DataforseoLabsGoogleRankedKeywordsLiveRequestInfo,
  DataforseoLabsGoogleCompetitorsDomainLiveRequestInfo,
  DataforseoLabsGoogleDomainIntersectionLiveRequestInfo,
  SerpGoogleMapsLiveAdvancedRequestInfo,
} from "dataforseo-client";
import { env } from "cloudflare:workers";
import { getDomain } from "tldts";
import { AppError } from "@/server/lib/errors";
import {
  dataforseoResponseSchema,
  domainMetricsItemSchema,
  domainRankedKeywordItemSchema,
  labsKeywordDataItemSchema,
  parseTaskItems,
  relatedKeywordItemSchema,
  serpSnapshotItemSchema,
  type DataforseoTask,
  type DomainMetricsItem,
  type DomainRankedKeywordItem,
  type LabsKeywordDataItem,
  type RelatedKeywordItem,
  type SerpLiveItem,
} from "@/server/lib/dataforseoSchemas";
export type {
  DomainRankedKeywordItem,
  LabsKeywordDataItem,
  SerpLiveItem,
} from "@/server/lib/dataforseoSchemas";

// ---------------------------------------------------------------------------
// SDK client factories (lazily created per-request using the env secret)
// ---------------------------------------------------------------------------

function createAuthenticatedFetch() {
  return (url: RequestInfo, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Basic ${env.DATAFORSEO_API_KEY}`);

    const newInit: RequestInit = {
      ...init,
      headers,
    };
    return fetch(url, newInit).then((res) => {
      console.log("[DATAFORSEO] Response status:", res.status);
      return res;
    });
  };
}

const API_BASE = "https://api.dataforseo.com";

function getLabsApi() {
  return new DataforseoLabsApi(API_BASE, { fetch: createAuthenticatedFetch() });
}

function getSerpApi() {
  return new SerpApi(API_BASE, { fetch: createAuthenticatedFetch() });
}

async function postDataforseo(
  path: string,
  payload: unknown,
): Promise<unknown> {
  const authenticatedFetch = createAuthenticatedFetch();
  const response = await authenticatedFetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new AppError(
      "INTERNAL_ERROR",
      `DataForSEO HTTP ${response.status} on ${path}`,
    );
  }

  return await response.json();
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

/**
 * Validate that the top-level response and first task both succeeded.
 * Throws a descriptive error on failure. Returns the first task.
 */
function assertOk<T extends { status_code?: number; status_message?: string }>(
  response: {
    status_code?: number;
    status_message?: string;
    tasks?: T[];
  } | null,
): T {
  if (!response) {
    throw new AppError(
      "INTERNAL_ERROR",
      "DataForSEO returned an empty response",
    );
  }
  if (response.status_code !== 20000) {
    throw new AppError(
      "INTERNAL_ERROR",
      response.status_message || "DataForSEO request failed",
    );
  }
  const task = response.tasks?.[0];
  if (!task) {
    throw new AppError("INTERNAL_ERROR", "DataForSEO response missing task");
  }
  if (task.status_code !== 20000) {
    throw new AppError(
      "INTERNAL_ERROR",
      task.status_message || "DataForSEO task failed",
    );
  }
  return task;
}

// ---------------------------------------------------------------------------
// DataForSEO Labs API wrappers
// ---------------------------------------------------------------------------

export async function fetchRelatedKeywordsRaw(
  keyword: string,
  locationCode: number,
  languageCode: string,
  limit: number,
  depth: number = 3,
): Promise<RelatedKeywordItem[]> {
  const api = getLabsApi();
  const req = new DataforseoLabsGoogleRelatedKeywordsLiveRequestInfo({
    keyword,
    location_code: locationCode,
    language_code: languageCode,
    limit,
    depth,
    include_clickstream_data: true,
    include_serp_info: false,
  });

  const response = await api.googleRelatedKeywordsLive([req]);
  const task = assertOk<DataforseoTask>(response);
  return parseTaskItems(
    "google-related-keywords-live",
    task,
    relatedKeywordItemSchema,
  );
}

export async function fetchKeywordSuggestionsRaw(
  keyword: string,
  locationCode: number,
  languageCode: string,
  limit: number,
): Promise<LabsKeywordDataItem[]> {
  const api = getLabsApi();
  const req = new DataforseoLabsGoogleKeywordSuggestionsLiveRequestInfo({
    keyword,
    location_code: locationCode,
    language_code: languageCode,
    limit,
    include_clickstream_data: true,
    include_serp_info: false,
    include_seed_keyword: true,
    ignore_synonyms: false,
    exact_match: false,
  });

  const response = await api.googleKeywordSuggestionsLive([req]);
  const task = assertOk<DataforseoTask>(response);
  return parseTaskItems(
    "google-keyword-suggestions-live",
    task,
    labsKeywordDataItemSchema,
  );
}

// ---------------------------------------------------------------------------
// Google Ads Keywords For Keywords (city-level support)
// ---------------------------------------------------------------------------

export type GoogleAdsKeywordItem = {
  keyword?: string;
  location_code?: number;
  language_code?: string;
  search_volume?: number;
  competition?: string; // LOW, MEDIUM, HIGH
  competition_index?: number;
  cpc?: number;
  low_top_of_page_bid?: number;
  high_top_of_page_bid?: number;
  monthly_searches?: Array<{ year: number; month: number; search_volume: number }>;
  keyword_annotations?: Record<string, object>;
};

/**
 * Fetch keyword ideas via Google Ads Keywords For Keywords endpoint.
 * Supports city-level location_code (unlike Labs API which only supports countries).
 */
export async function fetchGoogleAdsKeywordsForKeywordsRaw(
  keywords: string[],
  locationCode: number,
  languageCode: string,
): Promise<GoogleAdsKeywordItem[]> {
  const apiKey = env.DATAFORSEO_API_KEY;

  const requestBody = [
    {
      keywords,
      location_code: locationCode,
      language_code: languageCode,
      sort_by: "search_volume",
      include_adult_keywords: false,
    },
  ];

  console.log("[GOOGLE-ADS-KW] Request:", JSON.stringify(requestBody));

  const response = await fetch(
    `${API_BASE}/v3/keywords_data/google_ads/keywords_for_keywords/live`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    },
  );

  console.log("[GOOGLE-ADS-KW] Response status:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.log("[GOOGLE-ADS-KW] Error response:", errorText);
    throw new AppError("INTERNAL_ERROR", `DataForSEO Google Ads API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    status_code?: number;
    status_message?: string;
    tasks?: Array<{
      status_code?: number;
      status_message?: string;
      result_count?: number;
      result?: GoogleAdsKeywordItem[];
    }>;
  };

  console.log("[GOOGLE-ADS-KW] Response status_code:", data.status_code, "message:", data.status_message);

  const task = data.tasks?.[0];
  console.log("[GOOGLE-ADS-KW] Task status:", task?.status_code, "result_count:", task?.result_count);

  if (!task || task.status_code !== 20000) {
    console.log("[GOOGLE-ADS-KW] Task failed:", task?.status_message);
    throw new AppError(
      "INTERNAL_ERROR",
      `DataForSEO task error: ${task?.status_message ?? "unknown"}`,
    );
  }

  // Google Ads keywords_for_keywords returns items directly in result[],
  // NOT in result[0].items like Labs API
  const items = task.result ?? [];
  console.log("[GOOGLE-ADS-KW] Returning", items.length, "items");

  return items;
}

/**
 * Look up a city's DataForSEO location_code by name.
 * Uses the Google Ads locations endpoint with a country filter.
 */
export async function lookupCityLocationCode(
  cityName: string,
  countryCode: string,
): Promise<{ locationCode: number; locationName: string } | null> {
  const apiKey = env.DATAFORSEO_API_KEY;

  console.log("[CITY-LOOKUP] Looking up city:", cityName, "country:", countryCode);

  // DataForSEO locations endpoint — path-based with lowercase country code
  // Format: /v3/keywords_data/google_ads/locations/{country_lowercase}
  const url = `${API_BASE}/v3/keywords_data/google_ads/locations/${countryCode.toLowerCase()}`;
  console.log("[CITY-LOOKUP] Fetching:", url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${apiKey}`,
    },
  });

  console.log("[CITY-LOOKUP] Response status:", response.status);

  if (!response.ok) {
    console.log("[CITY-LOOKUP] Response not OK:", response.status);
    return null;
  }

  const rawData = await response.json();
  console.log("[CITY-LOOKUP] Raw response keys:", Object.keys(rawData as object));

  return parseCityFromResponse(rawData, cityName, countryCode);
}

function parseCityFromResponse(
  data: unknown,
  cityName: string,
  countryCode: string,
): { locationCode: number; locationName: string } | null {
  type LocationItem = {
    location_code: number;
    location_name: string;
    location_type: string;
    country_iso_code: string;
  };

  const typedData = data as {
    tasks?: Array<{ result?: LocationItem[] }>;
    result?: LocationItem[];
  };

  // Handle both response formats:
  // - tasks[0].result (standard DataForSEO format)
  // - result (some GET endpoints return this directly)
  const results = typedData.tasks?.[0]?.result ?? typedData.result ?? [];
  console.log("[CITY-LOOKUP] Parsed results count:", results.length, "from tasks:", !!typedData.tasks, "from result:", !!typedData.result);
  console.log("[CITY-LOOKUP] Total locations returned:", results.length);

  // Filter to only cities in the target country
  const cities = results.filter(
    (r) => r.location_type === "City" &&
      r.country_iso_code?.toUpperCase() === countryCode.toUpperCase(),
  );
  console.log("[CITY-LOOKUP] Cities in", countryCode, ":", cities.length);

  // Normalize for accent-insensitive matching
  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const cityNorm = normalize(cityName);
  console.log("[CITY-LOOKUP] Searching for normalized city:", cityNorm);

  // Log first few city names for debugging
  if (cities.length > 0) {
    console.log("[CITY-LOOKUP] Sample cities:", cities.slice(0, 5).map((c) => c.location_name));
  }

  // First try: exact city match
  const exactMatch = cities.find(
    (r) => normalize(r.location_name.split(",")[0]) === cityNorm,
  );
  if (exactMatch) {
    console.log("[CITY-LOOKUP] Exact match found:", exactMatch.location_name, "code:", exactMatch.location_code);
    return { locationCode: exactMatch.location_code, locationName: exactMatch.location_name };
  }

  // Second try: starts-with match (e.g., "castellon" matches "Castellon de la Plana")
  const startsWithMatch = cities.find(
    (r) => normalize(r.location_name.split(",")[0]).startsWith(cityNorm),
  );
  if (startsWithMatch) {
    console.log("[CITY-LOOKUP] Starts-with match:", startsWithMatch.location_name, "code:", startsWithMatch.location_code);
    return { locationCode: startsWithMatch.location_code, locationName: startsWithMatch.location_name };
  }

  // Third try: city name contains the search term
  const containsMatch = cities.find(
    (r) => normalize(r.location_name).includes(cityNorm),
  );
  if (containsMatch) {
    console.log("[CITY-LOOKUP] Contains match:", containsMatch.location_name, "code:", containsMatch.location_code);
    return { locationCode: containsMatch.location_code, locationName: containsMatch.location_name };
  }

  console.log("[CITY-LOOKUP] No match found for:", cityNorm);
  return null;
}

export async function fetchKeywordIdeasRaw(
  keyword: string,
  locationCode: number,
  languageCode: string,
  limit: number,
): Promise<LabsKeywordDataItem[]> {
  const api = getLabsApi();
  const req = new DataforseoLabsGoogleKeywordIdeasLiveRequestInfo({
    keywords: [keyword],
    location_code: locationCode,
    language_code: languageCode,
    limit,
    include_clickstream_data: true,
    include_serp_info: false,
    ignore_synonyms: false,
    closely_variants: false,
  });

  const response = await api.googleKeywordIdeasLive([req]);
  const task = assertOk<DataforseoTask>(response);
  return parseTaskItems(
    "google-keyword-ideas-live",
    task,
    labsKeywordDataItemSchema,
  );
}

// ---------------------------------------------------------------------------
// Domain API wrappers
// ---------------------------------------------------------------------------

export async function fetchDomainRankOverviewRaw(
  target: string,
  locationCode: number,
  languageCode: string,
): Promise<DomainMetricsItem[]> {
  const api = getLabsApi();
  const req = new DataforseoLabsGoogleDomainRankOverviewLiveRequestInfo({
    target,
    location_code: locationCode,
    language_code: languageCode,
    limit: 1,
  });

  const response = await api.googleDomainRankOverviewLive([req]);
  const task = assertOk<DataforseoTask>(response);
  return parseTaskItems(
    "google-domain-rank-overview-live",
    task,
    domainMetricsItemSchema,
  );
}

export async function fetchRankedKeywordsRaw(
  target: string,
  locationCode: number,
  languageCode: string,
  limit: number,
  orderBy?: string[],
): Promise<DomainRankedKeywordItem[]> {
  const api = getLabsApi();
  const req = new DataforseoLabsGoogleRankedKeywordsLiveRequestInfo({
    target,
    location_code: locationCode,
    language_code: languageCode,
    limit,
    order_by: orderBy,
  });

  const response = await api.googleRankedKeywordsLive([req]);
  const task = assertOk<DataforseoTask>(response);
  return parseTaskItems(
    "google-ranked-keywords-live",
    task,
    domainRankedKeywordItemSchema,
  );
}

// ---------------------------------------------------------------------------
// SERP Analysis API wrapper (Google Organic Live)
// ---------------------------------------------------------------------------

export async function fetchLiveSerpItemsRaw(
  keyword: string,
  locationCode: number,
  languageCode: string,
): Promise<SerpLiveItem[]> {
  const responseRaw = await postDataforseo(
    "/v3/serp/google/organic/live/advanced",
    [
      {
        keyword,
        location_code: locationCode,
        language_code: languageCode,
        device: "desktop",
        os: "windows",
        depth: 100,
      },
    ],
  );
  const response = dataforseoResponseSchema.parse(responseRaw);
  const task = assertOk<DataforseoTask>(response);
  return parseTaskItems(
    "google-organic-live-advanced",
    task,
    serpSnapshotItemSchema,
  );
}

// ---------------------------------------------------------------------------
// Domain utility functions (unchanged)
// ---------------------------------------------------------------------------

export function toRelativePath(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}` || "/";
  } catch {
    return null;
  }
}

export function normalizeDomainInput(
  input: string,
  includeSubdomains: boolean,
): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    throw new AppError("VALIDATION_ERROR", "Domain is required");
  }

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let host: string;
  try {
    host = new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    throw new AppError("VALIDATION_ERROR", "Domain is invalid");
  }

  if (!host) {
    throw new AppError("VALIDATION_ERROR", "Domain is invalid");
  }

  if (includeSubdomains) {
    return host;
  }

  return getDomain(host) ?? host;
}

// ---------------------------------------------------------------------------
// Competitor Analysis API wrappers
// ---------------------------------------------------------------------------

export type CompetitorDomainItem = {
  domain?: string | null;
  avg_position?: number | null;
  sum_position?: number | null;
  intersections?: number | null;
  full_domain_metrics?: Record<
    string,
    {
      organic?: {
        etv?: number | null;
        count?: number | null;
        estimated_paid_traffic_cost?: number | null;
        is_up?: number | null;
        is_down?: number | null;
        is_new?: number | null;
        is_lost?: number | null;
      } | null;
    } | undefined
  > | null;
};

export async function fetchCompetitorsDomainRaw(
  target: string,
  locationCode: number,
  languageCode: string,
  limit: number = 20,
): Promise<CompetitorDomainItem[]> {
  const api = getLabsApi();
  const req = new DataforseoLabsGoogleCompetitorsDomainLiveRequestInfo({
    target,
    location_code: locationCode,
    language_code: languageCode,
    limit,
    filters: undefined,
  });

  const response = await api.googleCompetitorsDomainLive([req]);
  const task = assertOk(response);

  const result = (task as { result?: Array<{ items?: unknown[] }> })
    .result?.[0];
  return (result?.items ?? []) as CompetitorDomainItem[];
}

export type DomainIntersectionItem = {
  keyword?: string | null;
  keyword_data?: {
    keyword_info?: {
      search_volume?: number | null;
      cpc?: number | null;
      competition?: number | null;
    } | null;
    keyword_properties?: {
      keyword_difficulty?: number | null;
    } | null;
    search_intent_info?: {
      main_intent?: string | null;
    } | null;
  } | null;
  first_domain_serp_element?: {
    domain?: string | null;
    url?: string | null;
    rank_absolute?: number | null;
    etv?: number | null;
  } | null;
  second_domain_serp_element?: {
    domain?: string | null;
    url?: string | null;
    rank_absolute?: number | null;
    etv?: number | null;
  } | null;
};

export async function fetchDomainIntersectionRaw(
  target1: string,
  target2: string,
  locationCode: number,
  languageCode: string,
  limit: number = 100,
  intersectionType: "all" | "target1_not_target2" | "target2_not_target1" | "common" = "all",
): Promise<DomainIntersectionItem[]> {
  const api = getLabsApi();

  const filters: string[] | undefined =
    intersectionType === "target1_not_target2"
      ? ["first_domain_serp_element.etv", ">", "0"]
      : intersectionType === "target2_not_target1"
        ? ["second_domain_serp_element.etv", ">", "0"]
        : undefined;

  const req = new DataforseoLabsGoogleDomainIntersectionLiveRequestInfo({
    target1,
    target2,
    location_code: locationCode,
    language_code: languageCode,
    limit,
    order_by: ["first_domain_serp_element.etv,desc"],
    exclude_intersections: intersectionType === "target1_not_target2" || intersectionType === "target2_not_target1",
    filters,
  });

  const response = await api.googleDomainIntersectionLive([req]);
  const task = assertOk(response);

  const result = (task as { result?: Array<{ items?: unknown[]; total_count?: number }> })
    .result?.[0];
  return (result?.items ?? []) as DomainIntersectionItem[];
}

// ---------------------------------------------------------------------------
// SERP Google Maps API wrapper
// ---------------------------------------------------------------------------

export type GoogleMapsItem = {
  type?: string;
  rank_group?: number | null;
  rank_absolute?: number | null;
  domain?: string | null;
  title?: string | null;
  url?: string | null;
  contact_url?: string | null;
  book_online_url?: string | null;
  rating?: {
    rating_type?: string | null;
    value?: number | null;
    votes_count?: number | null;
    rating_max?: number | null;
  } | null;
  rating_distribution?: Record<string, number> | null;
  snippet?: string | null;
  category?: string | null;
  additional_categories?: string[] | null;
  address?: string | null;
  address_info?: {
    city?: string | null;
    region?: string | null;
    zip?: string | null;
    country_code?: string | null;
  } | null;
  phone?: string | null;
  is_claimed?: boolean | null;
  place_id?: string | null;
  cid?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  main_image?: string | null;
  total_photos?: number | null;
  price_level?: string | null;
  work_hours?: {
    work_hours?: Record<string, Array<{ open?: { hour?: number; minute?: number }; close?: { hour?: number; minute?: number } }>> | null;
  } | null;
  local_justifications?: Array<{ justification_type?: string; description?: string }> | null;
};

export async function fetchGoogleMapsResultsRaw(
  keyword: string,
  locationCode: number,
  languageCode: string,
  depth: number = 20,
): Promise<GoogleMapsItem[]> {
  const api = getSerpApi();
  const req = new SerpGoogleMapsLiveAdvancedRequestInfo({
    keyword,
    location_code: locationCode,
    language_code: languageCode,
    depth,
  });

  const response = await api.googleMapsLiveAdvanced([req]);
  const task = assertOk(response);

  const result = (task as { result?: Array<{ items?: unknown[] }> })
    .result?.[0];
  return (result?.items ?? []) as GoogleMapsItem[];
}
