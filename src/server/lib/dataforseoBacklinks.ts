// oxlint-disable max-lines -- Cliente aislado con 4 endpoints + mappers + tipos API
// Cliente aislado de DataForSEO para el módulo "Backlinks".
//
// Usa el namespace Backlinks del SDK oficial `dataforseo-client`, que expone
// métodos *Live* (sin polling, respuesta síncrona):
//   - summaryLive          → agregados de perfil de enlaces
//   - backlinksLive        → lista de backlinks individuales (con filtros)
//   - referringDomainsLive → lista de dominios referentes
//   - anchorsLive          → distribución de anchor text
//
// No se mezcla con `src/server/lib/dataforseo.ts` para no interferir con otros
// módulos (keywords, SERP, domain). El patrón de auth es equivalente:
// fetch autenticado via Basic Auth con la API key de env.

import {
  BacklinksApi,
  BacklinksSummaryLiveRequestInfo,
  BacklinksBacklinksLiveRequestInfo,
  BacklinksReferringDomainsLiveRequestInfo,
  BacklinksAnchorsLiveRequestInfo,
} from "dataforseo-client";
import { env } from "cloudflare:workers";
import { AppError } from "@/server/lib/errors";
import type {
  AnchorItem,
  BacklinkItem,
  BacklinksSummary,
  ReferringDomainItem,
} from "@/types/backlinks";

const API_BASE = "https://api.dataforseo.com";

// Crea un fetch autenticado con Basic Auth usando la API key en env.
// Mismo patrón que `src/server/lib/dataforseo.ts` para consistencia.
function createAuthenticatedFetch() {
  return (url: RequestInfo, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Basic ${env.DATAFORSEO_API_KEY}`);
    return fetch(url, { ...init, headers });
  };
}

function getBacklinksApi(): BacklinksApi {
  return new BacklinksApi(API_BASE, { fetch: createAuthenticatedFetch() });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Valida la respuesta global y del primer task. Lanza AppError si algo falla.
// Equivalente a assertOk() de dataforseo.ts pero duplicado aquí para mantener
// el cliente aislado. Cuando falla, loguea el body enviado para facilitar
// el diagnóstico desde los logs del dev server.
function assertOk<T extends { status_code?: number; status_message?: string }>(
  response: {
    status_code?: number;
    status_message?: string;
    tasks?: T[];
  } | null,
  op: string,
  requestBody?: unknown,
): T {
  if (!response) {
    console.error(
      `[dataforseoBacklinks] ${op}: respuesta vacía, body:`,
      JSON.stringify(requestBody),
    );
    throw new AppError("INTERNAL_ERROR", `DataForSEO ${op}: respuesta vacía`);
  }
  if (response.status_code !== 20000) {
    console.error(
      `[dataforseoBacklinks] ${op} status_code=${response.status_code} status_message=${response.status_message} body:`,
      JSON.stringify(requestBody),
    );
    throw new AppError(
      "INTERNAL_ERROR",
      response.status_message ?? `DataForSEO ${op}: fallo global`,
    );
  }
  const task = response.tasks?.[0];
  if (!task) {
    console.error(
      `[dataforseoBacklinks] ${op}: sin task, body:`,
      JSON.stringify(requestBody),
    );
    throw new AppError("INTERNAL_ERROR", `DataForSEO ${op}: sin task`);
  }
  if (task.status_code !== 20000) {
    console.error(
      `[dataforseoBacklinks] ${op} task status_code=${task.status_code} status_message=${task.status_message} body:`,
      JSON.stringify(requestBody),
    );
    throw new AppError(
      "INTERNAL_ERROR",
      task.status_message ?? `DataForSEO ${op}: task falló`,
    );
  }
  return task;
}

// Convierte record|null|undefined en Record<string, number> limpio (sin nulls
// ni valores no-numéricos).
function cleanRecord(
  input: { [key: string]: number } | null | undefined,
): Record<string, number> {
  if (!input) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

// Extrae string|null|undefined → string|null.
function str(v: string | null | undefined): string | null {
  return v ?? null;
}

// Extrae number|null|undefined → number|null.
function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// Extrae boolean|null|undefined → boolean|null.
function bool(v: boolean | null | undefined): boolean | null {
  return typeof v === "boolean" ? v : null;
}

// ---------------------------------------------------------------------------
// 1. Summary
// ---------------------------------------------------------------------------

// Tipo mínimo que usamos del result de summary. Usamos campo-a-campo opcional
// porque DataForSEO devuelve extras que no modelamos.
type ApiSummaryResult = {
  target?: string;
  first_seen?: string;
  lost_date?: string;
  rank?: number;
  backlinks?: number;
  backlinks_spam_score?: number;
  crawled_pages?: number;
  internal_links_count?: number;
  external_links_count?: number;
  broken_backlinks?: number;
  broken_pages?: number;
  referring_domains?: number;
  referring_domains_nofollow?: number;
  referring_main_domains?: number;
  referring_main_domains_nofollow?: number;
  referring_ips?: number;
  referring_subnets?: number;
  referring_pages?: number;
  referring_pages_nofollow?: number;
  referring_links_tld?: Record<string, number>;
  referring_links_types?: Record<string, number>;
  referring_links_attributes?: Record<string, number>;
  referring_links_platform_types?: Record<string, number>;
  referring_links_semantic_locations?: Record<string, number>;
  referring_links_countries?: Record<string, number>;
};

// Llama al endpoint `backlinks/summary/live` y normaliza el result.
export async function fetchBacklinksSummary(
  target: string,
  includeSubdomains: boolean = true,
): Promise<BacklinksSummary> {
  const api = getBacklinksApi();
  const req = new BacklinksSummaryLiveRequestInfo({
    target,
    include_subdomains: includeSubdomains,
    // internal_list_limit: máx 1000 elementos en los mapas (tld, attributes,…).
    internal_list_limit: 1000,
    backlinks_status_type: "live",
  });

  let response;
  try {
    response = await api.summaryLive([req]);
  } catch (err) {
    console.error(
      "[dataforseoBacklinks] summary/live threw:",
      err instanceof Error ? err.message : String(err),
      "body:",
      JSON.stringify(req),
    );
    throw new AppError(
      "INTERNAL_ERROR",
      `DataForSEO backlinks/summary/live falló: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const task = assertOk(response, "backlinks/summary/live", req);
  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  const result = (task as { result?: ApiSummaryResult[] | null }).result?.[0];
  if (!result) {
    // Target sin backlinks: devolvemos estructura con ceros.
    return emptySummary(target);
  }

  return {
    target: result.target ?? target,
    firstSeen: str(result.first_seen),
    lostDate: str(result.lost_date),
    rank: num(result.rank),
    backlinks: result.backlinks ?? 0,
    spamScore: num(result.backlinks_spam_score),
    crawledPages: num(result.crawled_pages),
    internalLinksCount: num(result.internal_links_count),
    externalLinksCount: num(result.external_links_count),
    brokenBacklinks: num(result.broken_backlinks),
    brokenPages: num(result.broken_pages),
    referringDomains: result.referring_domains ?? 0,
    referringDomainsNofollow: result.referring_domains_nofollow ?? 0,
    referringMainDomains: result.referring_main_domains ?? 0,
    referringMainDomainsNofollow: result.referring_main_domains_nofollow ?? 0,
    referringIps: num(result.referring_ips),
    referringSubnets: num(result.referring_subnets),
    referringPages: num(result.referring_pages),
    referringPagesNofollow: num(result.referring_pages_nofollow),
    referringLinksTld: cleanRecord(result.referring_links_tld),
    referringLinksTypes: cleanRecord(result.referring_links_types),
    referringLinksAttributes: cleanRecord(result.referring_links_attributes),
    referringLinksPlatformTypes: cleanRecord(
      result.referring_links_platform_types,
    ),
    referringLinksSemanticLocations: cleanRecord(
      result.referring_links_semantic_locations,
    ),
    referringLinksCountries: cleanRecord(result.referring_links_countries),
  };
}

// Devuelve un BacklinksSummary vacío para el target (no hay backlinks).
function emptySummary(target: string): BacklinksSummary {
  return {
    target,
    firstSeen: null,
    lostDate: null,
    rank: null,
    backlinks: 0,
    spamScore: null,
    crawledPages: null,
    internalLinksCount: null,
    externalLinksCount: null,
    brokenBacklinks: null,
    brokenPages: null,
    referringDomains: 0,
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
  };
}

// ---------------------------------------------------------------------------
// 2. Backlinks list
// ---------------------------------------------------------------------------

// Tipo mínimo del item que usamos.
type ApiBacklinkItem = {
  type?: string;
  domain_from?: string;
  url_from?: string;
  url_from_https?: boolean;
  domain_to?: string;
  url_to?: string;
  tld_from?: string;
  is_new?: boolean;
  is_lost?: boolean;
  backlink_spam_score?: number;
  rank?: number;
  page_from_rank?: number;
  domain_from_rank?: number;
  domain_from_platform_type?: string[];
  domain_from_country?: string;
  page_from_language?: string;
  page_from_title?: string;
  page_from_status_code?: number;
  first_seen?: string;
  last_seen?: string;
  item_type?: string;
  attributes?: string[];
  dofollow?: boolean;
  anchor?: string;
  semantic_location?: string;
  is_broken?: boolean;
};

export type FetchBacklinksListOptions = {
  limit?: number;
  mode?: "as_is" | "one_per_domain" | "one_per_anchor";
  includeSubdomains?: boolean;
  // Filtros custom DataForSEO (array de condiciones). Se pasa tal cual.
  filters?: unknown[];
  orderBy?: string[];
  rankScale?: "one_hundred" | "one_thousand";
};

// Llama al endpoint `backlinks/backlinks/live` y normaliza cada item.
export async function fetchBacklinksList(
  target: string,
  opts: FetchBacklinksListOptions = {},
): Promise<BacklinkItem[]> {
  const api = getBacklinksApi();
  const req = new BacklinksBacklinksLiveRequestInfo({
    target,
    limit: opts.limit ?? 500,
    mode: opts.mode ?? "as_is",
    include_subdomains: opts.includeSubdomains ?? true,
    include_indirect_links: true,
    exclude_internal_backlinks: true,
    backlinks_status_type: "live",
    // Valores por defecto: DR descendente + spam score DESC para detectar
    // rápidamente los más tóxicos en el sample.
    order_by: opts.orderBy ?? ["domain_from_rank,desc"],
    filters: opts.filters,
    rank_scale: opts.rankScale ?? "one_hundred",
  });

  let response;
  try {
    response = await api.backlinksLive([req]);
  } catch (err) {
    console.error(
      "[dataforseoBacklinks] backlinks/live threw:",
      err instanceof Error ? err.message : String(err),
      "body:",
      JSON.stringify(req),
    );
    throw new AppError(
      "INTERNAL_ERROR",
      `DataForSEO backlinks/backlinks/live falló: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const task = assertOk(response, "backlinks/backlinks/live", req);
  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  const result = (task as { result?: Array<{ items?: ApiBacklinkItem[] }> })
    .result?.[0];
  const items = result?.items ?? [];
  return items.map(mapBacklinkItem);
}

function mapBacklinkItem(raw: ApiBacklinkItem): BacklinkItem {
  return {
    type: str(raw.type),
    domainFrom: str(raw.domain_from),
    urlFrom: str(raw.url_from),
    urlFromHttps: bool(raw.url_from_https),
    domainTo: str(raw.domain_to),
    urlTo: str(raw.url_to),
    tldFrom: str(raw.tld_from),
    isNew: bool(raw.is_new),
    isLost: bool(raw.is_lost),
    spamScore: num(raw.backlink_spam_score),
    rank: num(raw.rank),
    pageFromRank: num(raw.page_from_rank),
    domainFromRank: num(raw.domain_from_rank),
    domainFromPlatformType: Array.isArray(raw.domain_from_platform_type)
      ? raw.domain_from_platform_type
      : null,
    domainFromCountry: str(raw.domain_from_country),
    pageFromLanguage: str(raw.page_from_language),
    pageFromTitle: str(raw.page_from_title),
    pageFromStatusCode: num(raw.page_from_status_code),
    firstSeen: str(raw.first_seen),
    lastSeen: str(raw.last_seen),
    itemType: str(raw.item_type),
    attributes: Array.isArray(raw.attributes) ? raw.attributes : null,
    dofollow: bool(raw.dofollow),
    anchor: str(raw.anchor),
    semanticLocation: str(raw.semantic_location),
    isBroken: bool(raw.is_broken),
  };
}

// ---------------------------------------------------------------------------
// 3. Referring domains
// ---------------------------------------------------------------------------

type ApiReferringDomainItem = {
  type?: string;
  domain?: string;
  rank?: number;
  backlinks?: number;
  first_seen?: string;
  lost_date?: string;
  backlinks_spam_score?: number;
  broken_backlinks?: number;
  referring_domains?: number;
  referring_main_domains?: number;
  referring_pages?: number;
  referring_pages_nofollow?: number;
};

export type FetchReferringDomainsOptions = {
  limit?: number;
  includeSubdomains?: boolean;
  orderBy?: string[];
  rankScale?: "one_hundred" | "one_thousand";
};

export async function fetchReferringDomains(
  target: string,
  opts: FetchReferringDomainsOptions = {},
): Promise<ReferringDomainItem[]> {
  const api = getBacklinksApi();
  const req = new BacklinksReferringDomainsLiveRequestInfo({
    target,
    limit: opts.limit ?? 200,
    include_subdomains: opts.includeSubdomains ?? true,
    exclude_internal_backlinks: true,
    backlinks_status_type: "live",
    order_by: opts.orderBy ?? ["rank,desc"],
    rank_scale: opts.rankScale ?? "one_hundred",
  });

  let response;
  try {
    response = await api.referringDomainsLive([req]);
  } catch (err) {
    console.error(
      "[dataforseoBacklinks] referring_domains/live threw:",
      err instanceof Error ? err.message : String(err),
      "body:",
      JSON.stringify(req),
    );
    throw new AppError(
      "INTERNAL_ERROR",
      `DataForSEO backlinks/referring_domains/live falló: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const task = assertOk(response, "backlinks/referring_domains/live", req);
  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  const result = (
    task as { result?: Array<{ items?: ApiReferringDomainItem[] }> }
  ).result?.[0];
  const items = result?.items ?? [];
  return items
    .filter((it) => it.domain != null && it.domain.length > 0)
    .map(mapReferringDomain);
}

function mapReferringDomain(raw: ApiReferringDomainItem): ReferringDomainItem {
  const total = raw.referring_pages ?? 0;
  const nofollow = raw.referring_pages_nofollow ?? 0;
  // Ratio dofollow/total. Si total=0 devolvemos null (evita NaN y muestra "—").
  const dofollowRatio =
    total > 0 ? Math.max(0, (total - nofollow) / total) : null;
  return {
    domain: raw.domain ?? "",
    rank: num(raw.rank),
    backlinks: raw.backlinks ?? 0,
    firstSeen: str(raw.first_seen),
    lostDate: str(raw.lost_date),
    spamScore: num(raw.backlinks_spam_score),
    brokenBacklinks: num(raw.broken_backlinks),
    referringDomains: num(raw.referring_domains),
    referringMainDomains: num(raw.referring_main_domains),
    referringPages: num(raw.referring_pages),
    referringPagesNofollow: num(raw.referring_pages_nofollow),
    dofollowRatio,
  };
}

// ---------------------------------------------------------------------------
// 4. Anchors
// ---------------------------------------------------------------------------

type ApiAnchorItem = {
  type?: string;
  anchor?: string;
  rank?: number;
  backlinks?: number;
  first_seen?: string;
  lost_date?: string;
  backlinks_spam_score?: number;
  referring_domains?: number;
  referring_main_domains?: number;
  referring_pages?: number;
};

export type FetchAnchorsOptions = {
  limit?: number;
  includeSubdomains?: boolean;
  orderBy?: string[];
  rankScale?: "one_hundred" | "one_thousand";
};

export async function fetchAnchors(
  target: string,
  opts: FetchAnchorsOptions = {},
): Promise<AnchorItem[]> {
  const api = getBacklinksApi();
  const req = new BacklinksAnchorsLiveRequestInfo({
    target,
    limit: opts.limit ?? 200,
    include_subdomains: opts.includeSubdomains ?? true,
    exclude_internal_backlinks: true,
    backlinks_status_type: "live",
    order_by: opts.orderBy ?? ["backlinks,desc"],
    rank_scale: opts.rankScale ?? "one_hundred",
  });

  let response;
  try {
    response = await api.anchorsLive([req]);
  } catch (err) {
    console.error(
      "[dataforseoBacklinks] anchors/live threw:",
      err instanceof Error ? err.message : String(err),
      "body:",
      JSON.stringify(req),
    );
    throw new AppError(
      "INTERNAL_ERROR",
      `DataForSEO backlinks/anchors/live falló: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const task = assertOk(response, "backlinks/anchors/live", req);
  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  const result = (task as { result?: Array<{ items?: ApiAnchorItem[] }> })
    .result?.[0];
  const items = result?.items ?? [];

  // Total de backlinks (para calcular % de cada anchor). Si el primero trae
  // total_count lo usaríamos, pero aquí lo calculamos sumando (suficiente
  // como denominador para el sample que descargamos).
  const totalBacklinks = items.reduce((s, it) => s + (it.backlinks ?? 0), 0);

  return items
    .filter((it) => typeof it.anchor === "string")
    .map((raw): AnchorItem => {
      const backlinks = raw.backlinks ?? 0;
      const pct = totalBacklinks > 0 ? (backlinks / totalBacklinks) * 100 : 0;
      return {
        anchor: raw.anchor ?? "",
        rank: num(raw.rank),
        backlinks,
        firstSeen: str(raw.first_seen),
        lostDate: str(raw.lost_date),
        spamScore: num(raw.backlinks_spam_score),
        referringDomains: num(raw.referring_domains),
        referringMainDomains: num(raw.referring_main_domains),
        referringPages: num(raw.referring_pages),
        percentOfTotal: Math.round(pct * 100) / 100,
      };
    });
}
