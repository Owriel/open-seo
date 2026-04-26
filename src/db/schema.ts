// oxlint-disable max-lines -- Esquema con múltiples módulos (audits, backlinks, reviews, local grid, etc.)
import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Users table
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// Projects for keyword research + context compartido entre módulos.
// Estos campos autorrellenan los formularios de todos los módulos
// (Keywords, Domain, SERP, Reviews, Backlinks, Local, Geo-Grid, etc.)
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  domain: text("domain"),
  // Contexto compartido del proyecto. Cualquier módulo que necesite
  // keyword/location/GBP tira de estos por defecto.
  targetKeyword: text("target_keyword"),
  locationName: text("location_name").default("Spain"),
  languageCode: text("language_code").default("es"),
  placeId: text("place_id"),
  businessName: text("business_name"),
  // PSI keys are used for Google API abuse-control, not direct billing.
  // We still keep handling explicit to make the tradeoff obvious.
  pagespeedApiKey: text("pagespeed_api_key"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

// Saved keywords within projects
export const savedKeywords = sqliteTable(
  "saved_keywords",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    locationCode: integer("location_code").notNull().default(2840),
    languageCode: text("language_code").notNull().default("en"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    uniqueIndex("saved_keywords_unique_project_keyword_location_language").on(
      table.projectId,
      table.keyword,
      table.locationCode,
      table.languageCode,
    ),
    index("saved_keywords_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);

// Keyword metrics cache
export const keywordMetrics = sqliteTable(
  "keyword_metrics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    locationCode: integer("location_code").notNull(),
    languageCode: text("language_code").notNull().default("en"),
    searchVolume: integer("search_volume"),
    cpc: real("cpc"),
    competition: real("competition"),
    keywordDifficulty: integer("keyword_difficulty"),
    intent: text("intent"),
    monthlySearches: text("monthly_searches"),
    fetchedAt: text("fetched_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    uniqueIndex("keyword_metrics_unique_project_keyword_location_language").on(
      table.projectId,
      table.keyword,
      table.locationCode,
      table.languageCode,
    ),
    index("keyword_metrics_lookup_idx").on(
      table.projectId,
      table.keyword,
      table.locationCode,
      table.languageCode,
      table.fetchedAt,
    ),
  ],
);

// ============================================================================
// Rank Tracker tables
// ============================================================================

// Keywords being tracked for position monitoring
export const trackedKeywords = sqliteTable(
  "tracked_keywords",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    domain: text("domain").notNull(),
    locationCode: integer("location_code").notNull().default(2724),
    languageCode: text("language_code").notNull().default("es"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    uniqueIndex("tracked_keywords_unique").on(
      table.projectId,
      table.keyword,
      table.domain,
      table.locationCode,
    ),
    index("tracked_keywords_project_idx").on(table.projectId),
  ],
);

// Historical position data for tracked keywords
export const rankHistory = sqliteTable(
  "rank_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    trackedKeywordId: text("tracked_keyword_id")
      .notNull()
      .references(() => trackedKeywords.id, { onDelete: "cascade" }),
    position: integer("position"), // null means not ranking
    url: text("url"), // URL that ranks
    checkedAt: text("checked_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    index("rank_history_keyword_idx").on(
      table.trackedKeywordId,
      table.checkedAt,
    ),
  ],
);

// ============================================================================
// Site Audit tables
// ============================================================================

// One row per audit run
export const audits = sqliteTable(
  "audits",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startUrl: text("start_url").notNull(),
    status: text("status", {
      enum: ["running", "completed", "failed"],
    })
      .notNull()
      .default("running"),
    workflowInstanceId: text("workflow_instance_id"),
    // JSON config: { maxPages, psiStrategy, psiApiKey? }
    config: text("config").notNull().default("{}"),
    // Progress & summary
    pagesCrawled: integer("pages_crawled").notNull().default(0),
    pagesTotal: integer("pages_total").notNull().default(0),
    psiTotal: integer("psi_total").notNull().default(0),
    psiCompleted: integer("psi_completed").notNull().default(0),
    psiFailed: integer("psi_failed").notNull().default(0),
    currentPhase: text("current_phase").default("discovery"),
    startedAt: text("started_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    completedAt: text("completed_at"),
  },
  (table) => [
    index("audits_project_id_idx").on(table.projectId),
    index("audits_user_id_idx").on(table.userId),
  ],
);

// One row per crawled page
export const auditPages = sqliteTable(
  "audit_pages",
  {
    id: text("id").primaryKey(),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    statusCode: integer("status_code"),
    redirectUrl: text("redirect_url"),
    // Metadata
    title: text("title"),
    metaDescription: text("meta_description"),
    canonicalUrl: text("canonical_url"),
    robotsMeta: text("robots_meta"),
    // Open Graph
    ogTitle: text("og_title"),
    ogDescription: text("og_description"),
    ogImage: text("og_image"),
    // Headings
    h1Count: integer("h1_count").notNull().default(0),
    h2Count: integer("h2_count").notNull().default(0),
    h3Count: integer("h3_count").notNull().default(0),
    h4Count: integer("h4_count").notNull().default(0),
    h5Count: integer("h5_count").notNull().default(0),
    h6Count: integer("h6_count").notNull().default(0),
    headingOrderJson: text("heading_order_json"), // JSON array of heading levels
    // Content
    wordCount: integer("word_count").notNull().default(0),
    // Images
    imagesTotal: integer("images_total").notNull().default(0),
    imagesMissingAlt: integer("images_missing_alt").notNull().default(0),
    imagesJson: text("images_json"), // JSON array of {src, alt} objects
    // Links
    internalLinkCount: integer("internal_link_count").notNull().default(0),
    externalLinkCount: integer("external_link_count").notNull().default(0),
    // Structured data
    hasStructuredData: integer("has_structured_data", { mode: "boolean" })
      .notNull()
      .default(false),
    // Hreflang
    hreflangTagsJson: text("hreflang_tags_json"), // JSON array of hreflang values
    // Indexability
    isIndexable: integer("is_indexable", { mode: "boolean" })
      .notNull()
      .default(true),
    // Performance
    responseTimeMs: integer("response_time_ms"),
  },
  (table) => [index("audit_pages_audit_id_idx").on(table.auditId)],
);

// One row per PSI test (mobile + desktop per page)
export const auditPsiResults = sqliteTable(
  "audit_psi_results",
  {
    id: text("id").primaryKey(),
    auditId: text("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    pageId: text("page_id")
      .notNull()
      .references(() => auditPages.id, { onDelete: "cascade" }),
    strategy: text("strategy", { enum: ["mobile", "desktop"] }).notNull(),
    performanceScore: integer("performance_score"),
    accessibilityScore: integer("accessibility_score"),
    bestPracticesScore: integer("best_practices_score"),
    seoScore: integer("seo_score"),
    lcpMs: real("lcp_ms"),
    cls: real("cls"),
    inpMs: real("inp_ms"),
    ttfbMs: real("ttfb_ms"),
    errorMessage: text("error_message"),
    r2Key: text("r2_key"),
    payloadSizeBytes: integer("payload_size_bytes"),
  },
  (table) => [index("audit_psi_results_audit_id_idx").on(table.auditId)],
);

// ============================================================================
// Cache management
// ============================================================================

export const cacheEntries = sqliteTable(
  "cache_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kvKey: text("kv_key").notNull(),
    label: text("label").notNull(),
    category: text("category").notNull().default("general"),
    paramsJson: text("params_json"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    expiresAt: text("expires_at").notNull(),
    extendedCount: integer("extended_count").notNull().default(0),
  },
  (table) => [
    uniqueIndex("cache_entries_kv_key_idx").on(table.kvKey),
    index("cache_entries_expires_at_idx").on(table.expiresAt),
    index("cache_entries_category_idx").on(table.category),
  ],
);

// One row per on-demand PSI check (full raw in R2)
export const psiAuditResults = sqliteTable(
  "psi_audit_results",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    requestedUrl: text("requested_url").notNull(),
    finalUrl: text("final_url").notNull(),
    strategy: text("strategy", { enum: ["mobile", "desktop"] }).notNull(),
    status: text("status", { enum: ["completed", "failed"] })
      .notNull()
      .default("completed"),
    performanceScore: integer("performance_score"),
    accessibilityScore: integer("accessibility_score"),
    bestPracticesScore: integer("best_practices_score"),
    seoScore: integer("seo_score"),
    firstContentfulPaint: text("first_contentful_paint"),
    largestContentfulPaint: text("largest_contentful_paint"),
    totalBlockingTime: text("total_blocking_time"),
    cumulativeLayoutShift: text("cumulative_layout_shift"),
    speedIndex: text("speed_index"),
    timeToInteractive: text("time_to_interactive"),
    lighthouseVersion: text("lighthouse_version"),
    errorMessage: text("error_message"),
    r2Key: text("r2_key"),
    payloadSizeBytes: integer("payload_size_bytes"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    index("psi_audit_results_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
    index("psi_audit_results_project_strategy_idx").on(
      table.projectId,
      table.strategy,
    ),
  ],
);

// ============================================================================
// Geo-Grid Rank Tracker (tipo Local Falcon)
// ============================================================================

// Cada scan es una ejecución del grid para una keyword + dominio target + centro + tamaño.
// Los puntos individuales se almacenan como JSON stringificado para evitar
// explosión de filas (un scan 7x7 = 49 puntos, pero podrían llegar a cientos).
export const localGridScans = sqliteTable(
  "local_grid_scans",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    targetDomain: text("target_domain").notNull(),
    // place_id del negocio objetivo (Business Picker). Nullable para
    // retrocompatibilidad con scans creados antes de esta feature.
    targetPlaceId: text("target_place_id"),
    // Nombre comercial del negocio elegido (solo metadato para UI).
    businessName: text("business_name"),
    centerLat: real("center_lat").notNull(),
    centerLng: real("center_lng").notNull(),
    gridSize: integer("grid_size").notNull(), // 3, 5 o 7 (produce NxN puntos)
    radiusKm: real("radius_km").notNull(),
    locationName: text("location_name"), // Etiqueta opcional (ciudad buscada)
    languageCode: text("language_code").notNull().default("es"),
    // JSON array stringificado de puntos:
    // [{ lat, lng, position, resultsCount, topResults?: [...] }, ...]
    pointsJson: text("points_json").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    index("local_grid_scans_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);

// ============================================================================
// Reseñas Google (DataForSEO Business Data Google Reviews)
// ============================================================================

// Cada análisis de reseñas es una ejecución del endpoint
// `business_data/google/reviews/task_post` + `task_get` contra un negocio
// concreto. Guardamos el resumen (total, avg, distribución) y el array
// completo de reseñas como JSON stringificado para permitir filtrado
// cliente-side sin volver a llamar a la API.
export const reviewAnalyses = sqliteTable(
  "review_analyses",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    placeId: text("place_id"),
    businessName: text("business_name"),
    locationName: text("location_name"),
    languageCode: text("language_code").notNull().default("es"),
    totalReviews: integer("total_reviews").notNull().default(0),
    avgRating: real("avg_rating"),
    // Array [c1, c2, c3, c4, c5] con el conteo por estrellas, JSON stringificado.
    ratingDistributionJson: text("rating_distribution_json")
      .notNull()
      .default("[0,0,0,0,0]"),
    // Array de reseñas con { rating, text, authorName, reviewDate, language }.
    // Se almacena como JSON stringificado para evitar explotar filas.
    reviewsJson: text("reviews_json").notNull().default("[]"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    index("review_analyses_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);

// ============================================================================
// Backlinks (DataForSEO Backlinks API)
// ============================================================================

// Cada análisis de backlinks es una ejecución agregada de 4 endpoints Live
// (`summary`, `backlinks`, `referring_domains`, `anchors`). Persistimos el
// resumen y muestras (primeros N) como JSON stringificado para mostrar la UI
// sin volver a pegar a DataForSEO (costoso: $0.30-0.50 por análisis).
export const backlinksAnalyses = sqliteTable(
  "backlinks_analyses",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // Target analizado (dominio sin protocolo o URL absoluta).
    target: text("target").notNull(),
    // Agregados para la sidebar y filtros rápidos.
    totalBacklinks: integer("total_backlinks").notNull().default(0),
    totalReferringDomains: integer("total_referring_domains")
      .notNull()
      .default(0),
    rank: integer("rank"),
    // Spam score medio del perfil (0..100). Lo traemos del summary.
    spamScore: real("spam_score"),
    // Payload completo del summary como JSON stringificado.
    summaryJson: text("summary_json").notNull().default("{}"),
    // Top dominios referentes (hasta ~200) como JSON stringificado.
    topDomainsJson: text("top_domains_json").notNull().default("[]"),
    // Top anchors (hasta ~200) como JSON stringificado.
    topAnchorsJson: text("top_anchors_json").notNull().default("[]"),
    // Sample de los primeros ~500 backlinks individuales como JSON.
    // El resto se puede pedir haciendo "refresh" si se quiere paginar.
    backlinksSampleJson: text("backlinks_sample_json").notNull().default("[]"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    index("backlinks_analyses_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);
