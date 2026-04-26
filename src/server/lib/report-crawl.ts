// Mini-crawl técnico para el informe SEO
// Crawlea home + páginas enlazadas desde home (máx 15 páginas)
// Sin dependencias externas, usa fetch + cheerio del proyecto

import * as cheerio from "cheerio";
import { normalizeUrl, isSameOrigin } from "@/server/lib/audit/url-utils";
import type { TechnicalIssue, ReportTechnicalHealth } from "@/types/report";

/** Datos extraídos de cada página */
type CrawledPage = {
  url: string;
  statusCode: number;
  responseTimeMs: number;
  title: string;
  metaDescription: string;
  canonical: string | null;
  h1s: string[];
  images: Array<{ src: string | null; alt: string | null }>;
  wordCount: number;
  hasStructuredData: boolean;
  internalLinks: string[];
};

const MAX_PAGES = 15;
const FETCH_TIMEOUT = 10000;

/** Fetch una URL con timeout */
async function fetchPage(url: string): Promise<{
  html: string;
  statusCode: number;
  responseTimeMs: number;
} | null> {
  try {
    const start = Date.now();
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "OpenSeo-Bot/1.0 (SEO Audit)",
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    const responseTimeMs = Date.now() - start;
    const html = await resp.text();
    return { html, statusCode: resp.status, responseTimeMs };
  } catch {
    return null;
  }
}

/** Analizar HTML de una página */
function analyzePage(
  html: string,
  pageUrl: string,
  statusCode: number,
  responseTimeMs: number,
): CrawledPage {
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim();
  const metaDescription =
    $('meta[name="description"]').first().attr("content")?.trim() ?? "";
  const canonical = $('link[rel="canonical"]').first().attr("href") ?? null;

  const h1s: string[] = [];
  $("h1").each((_, el) => {
    h1s.push($(el).text().trim());
  });

  const images: Array<{ src: string | null; alt: string | null }> = [];
  $("img").each((_, el) => {
    images.push({
      src: $(el).attr("src") ?? null,
      alt: $(el).attr("alt") ?? null,
    });
  });

  // Contar palabras del body (excluyendo scripts/styles)
  const bodyText = $("body")
    .clone()
    .find("script, style, noscript")
    .remove()
    .end()
    .text();
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  const hasStructuredData = $('script[type="application/ld+json"]').length > 0;

  // Enlaces internos
  const internalLinks: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const resolved = normalizeUrl(href, pageUrl);
      if (resolved && isSameOrigin(resolved, pageUrl)) {
        internalLinks.push(resolved);
      }
    } catch {
      // Ignorar URLs inválidas
    }
  });

  return {
    url: pageUrl,
    statusCode,
    responseTimeMs,
    title,
    metaDescription,
    canonical,
    h1s,
    images,
    wordCount,
    hasStructuredData,
    internalLinks,
  };
}

/** Detectar problemas técnicos en una página */
function detectIssues(page: CrawledPage): TechnicalIssue[] {
  const issues: TechnicalIssue[] = [];
  const shortUrl = new URL(page.url).pathname || "/";

  // Título
  if (!page.title) {
    issues.push({
      type: "missing_title",
      severity: "critical",
      page: shortUrl,
      description: "Sin etiqueta <title>",
    });
  } else if (page.title.length < 20) {
    issues.push({
      type: "short_title",
      severity: "warning",
      page: shortUrl,
      description: `Título muy corto (${page.title.length} caracteres)`,
    });
  } else if (page.title.length > 65) {
    issues.push({
      type: "long_title",
      severity: "warning",
      page: shortUrl,
      description: `Título muy largo (${page.title.length} caracteres)`,
    });
  }

  // Meta description
  if (!page.metaDescription) {
    issues.push({
      type: "missing_meta",
      severity: "critical",
      page: shortUrl,
      description: "Sin meta description",
    });
  } else if (page.metaDescription.length < 50) {
    issues.push({
      type: "short_meta",
      severity: "warning",
      page: shortUrl,
      description: `Meta description muy corta (${page.metaDescription.length} caracteres)`,
    });
  } else if (page.metaDescription.length > 160) {
    issues.push({
      type: "long_meta",
      severity: "warning",
      page: shortUrl,
      description: `Meta description muy larga (${page.metaDescription.length} caracteres)`,
    });
  }

  // H1
  if (page.h1s.length === 0) {
    issues.push({
      type: "missing_h1",
      severity: "critical",
      page: shortUrl,
      description: "Sin encabezado H1",
    });
  } else if (page.h1s.length > 1) {
    issues.push({
      type: "multiple_h1",
      severity: "warning",
      page: shortUrl,
      description: `Múltiples H1 (${page.h1s.length})`,
    });
  }

  // Imágenes sin alt
  const imagesWithoutAlt = page.images.filter(
    (img) => !img.alt || img.alt.trim() === "",
  );
  if (imagesWithoutAlt.length > 0) {
    issues.push({
      type: "images_no_alt",
      severity: "warning",
      page: shortUrl,
      description: `${imagesWithoutAlt.length} imagen(es) sin atributo alt`,
    });
  }

  // Contenido escaso
  if (page.wordCount < 100) {
    issues.push({
      type: "thin_content",
      severity: "warning",
      page: shortUrl,
      description: `Contenido escaso (${page.wordCount} palabras)`,
    });
  }

  // Tiempo de respuesta lento
  if (page.responseTimeMs > 3000) {
    issues.push({
      type: "slow_response",
      severity: "critical",
      page: shortUrl,
      description: `Respuesta lenta (${(page.responseTimeMs / 1000).toFixed(1)}s)`,
    });
  } else if (page.responseTimeMs > 1500) {
    issues.push({
      type: "slow_response",
      severity: "warning",
      page: shortUrl,
      description: `Respuesta moderadamente lenta (${(page.responseTimeMs / 1000).toFixed(1)}s)`,
    });
  }

  // Sin datos estructurados
  if (!page.hasStructuredData) {
    issues.push({
      type: "no_schema",
      severity: "info",
      page: shortUrl,
      description: "Sin datos estructurados (Schema.org)",
    });
  }

  // Código de estado
  if (page.statusCode >= 400) {
    issues.push({
      type: "error_status",
      severity: "critical",
      page: shortUrl,
      description: `Error HTTP ${page.statusCode}`,
    });
  } else if (page.statusCode >= 300) {
    issues.push({
      type: "redirect",
      severity: "info",
      page: shortUrl,
      description: `Redirección HTTP ${page.statusCode}`,
    });
  }

  return issues;
}

/** Ejecutar mini-crawl completo */
export async function runMiniCrawl(
  domain: string,
): Promise<ReportTechnicalHealth> {
  const startUrl = domain.startsWith("http") ? domain : `https://${domain}`;

  // 1. Crawlear la home
  const homeResult = await fetchPage(startUrl);
  if (!homeResult) {
    return {
      pagesCrawled: 0,
      issues: [
        {
          type: "unreachable",
          severity: "critical",
          page: "/",
          description: "No se pudo acceder a la web",
        },
      ],
      issuesByType: { unreachable: 1 },
      criticalCount: 1,
      warningCount: 0,
      infoCount: 0,
    };
  }

  const homePage = analyzePage(
    homeResult.html,
    startUrl,
    homeResult.statusCode,
    homeResult.responseTimeMs,
  );
  const crawled: CrawledPage[] = [homePage];
  const visited = new Set<string>([startUrl]);

  // 2. Crawlear páginas enlazadas desde la home (máx MAX_PAGES - 1)
  const linksToVisit = homePage.internalLinks
    .filter((link) => !visited.has(link))
    .slice(0, MAX_PAGES - 1);

  // Crawlear en paralelo con concurrencia limitada
  const CONCURRENCY = 5;
  for (let i = 0; i < linksToVisit.length; i += CONCURRENCY) {
    const batch = linksToVisit.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (link) => {
        if (visited.has(link)) return null;
        visited.add(link);
        const result = await fetchPage(link);
        if (!result) return null;
        return analyzePage(
          result.html,
          link,
          result.statusCode,
          result.responseTimeMs,
        );
      }),
    );
    for (const page of results) {
      if (page) crawled.push(page);
    }
  }

  // 3. Detectar problemas en todas las páginas
  const allIssues: TechnicalIssue[] = [];
  for (const page of crawled) {
    allIssues.push(...detectIssues(page));
  }

  // 4. Detectar títulos duplicados
  const titles = crawled
    .filter((p) => p.title)
    .map((p) => ({ title: p.title, url: p.url }));
  const titleMap = new Map<string, string[]>();
  for (const { title, url } of titles) {
    const existing = titleMap.get(title) ?? [];
    existing.push(url);
    titleMap.set(title, existing);
  }
  for (const [title, urls] of titleMap) {
    if (urls.length > 1) {
      for (const url of urls) {
        const shortUrl = new URL(url).pathname || "/";
        allIssues.push({
          type: "duplicate_title",
          severity: "warning",
          page: shortUrl,
          description: `Título duplicado: "${title.substring(0, 50)}..."`,
        });
      }
    }
  }

  // 5. Detectar meta descriptions duplicadas
  const metas = crawled
    .filter((p) => p.metaDescription)
    .map((p) => ({ meta: p.metaDescription, url: p.url }));
  const metaMap = new Map<string, string[]>();
  for (const { meta, url } of metas) {
    const existing = metaMap.get(meta) ?? [];
    existing.push(url);
    metaMap.set(meta, existing);
  }
  for (const [meta, urls] of metaMap) {
    if (urls.length > 1) {
      for (const url of urls) {
        const shortUrl = new URL(url).pathname || "/";
        allIssues.push({
          type: "duplicate_meta",
          severity: "warning",
          page: shortUrl,
          description: `Meta description duplicada: "${meta.substring(0, 50)}..."`,
        });
      }
    }
  }

  // 6. Agrupar por tipo
  const issuesByType: Record<string, number> = {};
  for (const issue of allIssues) {
    issuesByType[issue.type] = (issuesByType[issue.type] ?? 0) + 1;
  }

  return {
    pagesCrawled: crawled.length,
    issues: allIssues,
    issuesByType,
    criticalCount: allIssues.filter((i) => i.severity === "critical").length,
    warningCount: allIssues.filter((i) => i.severity === "warning").length,
    infoCount: allIssues.filter((i) => i.severity === "info").length,
  };
}
