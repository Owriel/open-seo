/**
 * SEO Issues Analyzer
 * Analyzes crawl page data and generates SEO issues with Spanish descriptions
 * and fix recommendations.
 */

export type SeoIssueSeverity = "error" | "warning" | "info";

export type SeoIssue = {
  id: string;
  severity: SeoIssueSeverity;
  category: "technical" | "onpage" | "content" | "images" | "links";
  title: string;
  description: string;
  howToFix: string;
  affectedPages: Array<{ url: string; detail?: string }>;
};

export type SeoIssuesSummary = {
  errors: number;
  warnings: number;
  infos: number;
  score: number; // 0-100
  issues: SeoIssue[];
};

type AuditPage = {
  id: string;
  url: string;
  statusCode: number | null;
  redirectUrl: string | null;
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  robotsMeta: string | null;
  h1Count: number | null;
  wordCount: number | null;
  imagesTotal: number | null;
  imagesMissingAlt: number | null;
  internalLinkCount: number | null;
  externalLinkCount: number | null;
  hasStructuredData: boolean | null;
  isIndexable: boolean | null;
  responseTimeMs: number | null;
};

export function analyzeSeoIssues(pages: AuditPage[]): SeoIssuesSummary {
  const issues: SeoIssue[] = [];

  // === TECHNICAL ISSUES ===

  // 404 errors
  const pages404 = pages.filter((p) => p.statusCode === 404);
  if (pages404.length > 0) {
    issues.push({
      id: "http-404",
      severity: "error",
      category: "technical",
      title: `Páginas con error 404 (${pages404.length})`,
      description:
        "Se han encontrado páginas que devuelven error 404 (no encontrada). Esto afecta la experiencia de usuario y puede perder link juice.",
      howToFix:
        "Redirige las URLs 404 a páginas relevantes con una redirección 301, o elimina los enlaces internos que apuntan a estas páginas.",
      affectedPages: pages404.map((p) => ({
        url: p.url,
        detail: "HTTP 404",
      })),
    });
  }

  // 5xx server errors
  const pages5xx = pages.filter(
    (p) => p.statusCode != null && p.statusCode >= 500,
  );
  if (pages5xx.length > 0) {
    issues.push({
      id: "http-5xx",
      severity: "error",
      category: "technical",
      title: `Errores de servidor 5xx (${pages5xx.length})`,
      description:
        "Páginas que devuelven errores del servidor. Estos errores impiden la indexación y dan mala señal a Google.",
      howToFix:
        "Revisa los logs del servidor para identificar el problema. Puede ser un error de código, timeout de base de datos o problema de configuración.",
      affectedPages: pages5xx.map((p) => ({
        url: p.url,
        detail: `HTTP ${p.statusCode}`,
      })),
    });
  }

  // Redirect chains (pages with redirects)
  const redirected = pages.filter(
    (p) =>
      p.statusCode != null &&
      p.statusCode >= 300 &&
      p.statusCode < 400 &&
      p.redirectUrl,
  );
  if (redirected.length > 0) {
    issues.push({
      id: "redirects",
      severity: "warning",
      category: "technical",
      title: `Redirecciones detectadas (${redirected.length})`,
      description:
        "Páginas que redireccionan a otras URLs. Las cadenas de redirecciones ralentizan la carga y diluyen el link juice.",
      howToFix:
        "Actualiza los enlaces internos para que apunten directamente a la URL final, evitando pasar por la redirección.",
      affectedPages: redirected.map((p) => ({
        url: p.url,
        detail: `→ ${p.redirectUrl}`,
      })),
    });
  }

  // Slow pages (>3s)
  const slowPages = pages.filter(
    (p) => p.responseTimeMs != null && p.responseTimeMs > 3000,
  );
  if (slowPages.length > 0) {
    issues.push({
      id: "slow-response",
      severity: "warning",
      category: "technical",
      title: `Páginas lentas >3s (${slowPages.length})`,
      description:
        "Estas páginas tardan más de 3 segundos en responder. La velocidad es un factor de ranking y afecta la experiencia de usuario.",
      howToFix:
        "Optimiza el servidor (caché, CDN, compresión gzip), reduce el tamaño de recursos, y revisa consultas lentas a base de datos.",
      affectedPages: slowPages.map((p) => ({
        url: p.url,
        detail: `${p.responseTimeMs}ms`,
      })),
    });
  }

  // No canonical
  const noCanonical = pages.filter(
    (p) =>
      p.isIndexable !== false &&
      p.statusCode === 200 &&
      !p.canonicalUrl,
  );
  if (noCanonical.length > 0) {
    issues.push({
      id: "no-canonical",
      severity: "warning",
      category: "technical",
      title: `Sin canonical tag (${noCanonical.length})`,
      description:
        "Páginas indexables sin etiqueta canonical. Esto puede causar problemas de contenido duplicado.",
      howToFix:
        'Añade <link rel="canonical" href="URL_COMPLETA"> en el <head> de cada página, apuntando a la versión preferida.',
      affectedPages: noCanonical.map((p) => ({ url: p.url })),
    });
  }

  // No structured data
  const noSchema = pages.filter(
    (p) => p.statusCode === 200 && p.hasStructuredData === false,
  );
  if (noSchema.length > 0) {
    issues.push({
      id: "no-structured-data",
      severity: "info",
      category: "technical",
      title: `Sin datos estructurados (${noSchema.length})`,
      description:
        "Páginas sin Schema markup (JSON-LD). Los datos estructurados ayudan a Google a entender el contenido y pueden generar rich snippets.",
      howToFix:
        "Añade JSON-LD con el tipo de Schema adecuado: LocalBusiness para negocios, Article para blog, Product para productos, FAQPage para preguntas frecuentes.",
      affectedPages: noSchema.map((p) => ({ url: p.url })),
    });
  }

  // === ON-PAGE ISSUES ===

  // Missing title
  const noTitle = pages.filter(
    (p) => p.statusCode === 200 && (!p.title || p.title.trim() === ""),
  );
  if (noTitle.length > 0) {
    issues.push({
      id: "missing-title",
      severity: "error",
      category: "onpage",
      title: `Sin título <title> (${noTitle.length})`,
      description:
        "Páginas sin etiqueta <title>. El título es uno de los factores on-page más importantes para el SEO.",
      howToFix:
        "Añade un <title> único y descriptivo de 50-60 caracteres que incluya la keyword principal.",
      affectedPages: noTitle.map((p) => ({ url: p.url })),
    });
  }

  // Title too long (>60 chars)
  const titleLong = pages.filter(
    (p) => p.statusCode === 200 && p.title && p.title.length > 60,
  );
  if (titleLong.length > 0) {
    issues.push({
      id: "title-too-long",
      severity: "warning",
      category: "onpage",
      title: `Título demasiado largo >60 chars (${titleLong.length})`,
      description:
        "Títulos que superan los 60 caracteres pueden ser truncados en los resultados de Google.",
      howToFix:
        "Acorta el título a menos de 60 caracteres manteniendo la keyword principal al inicio.",
      affectedPages: titleLong.map((p) => ({
        url: p.url,
        detail: `${p.title?.length} chars: "${p.title?.substring(0, 70)}..."`,
      })),
    });
  }

  // Title too short (<30 chars)
  const titleShort = pages.filter(
    (p) =>
      p.statusCode === 200 &&
      p.title &&
      p.title.trim().length > 0 &&
      p.title.trim().length < 30,
  );
  if (titleShort.length > 0) {
    issues.push({
      id: "title-too-short",
      severity: "info",
      category: "onpage",
      title: `Título muy corto <30 chars (${titleShort.length})`,
      description:
        "Títulos demasiado cortos pueden no aprovechar todo el espacio disponible en los resultados de búsqueda.",
      howToFix:
        "Amplía el título incluyendo más contexto descriptivo o keywords secundarias.",
      affectedPages: titleShort.map((p) => ({
        url: p.url,
        detail: `${p.title?.trim().length} chars: "${p.title}"`,
      })),
    });
  }

  // Duplicate titles
  const titleMap = new Map<string, AuditPage[]>();
  for (const p of pages) {
    if (p.statusCode === 200 && p.title && p.title.trim()) {
      const key = p.title.trim().toLowerCase();
      const existing = titleMap.get(key) ?? [];
      existing.push(p);
      titleMap.set(key, existing);
    }
  }
  const duplicateTitles = [...titleMap.entries()].filter(
    ([, group]) => group.length > 1,
  );
  if (duplicateTitles.length > 0) {
    const affected = duplicateTitles.flatMap(([title, group]) =>
      group.map((p) => ({
        url: p.url,
        detail: `"${title.substring(0, 60)}" (${group.length} páginas)`,
      })),
    );
    issues.push({
      id: "duplicate-titles",
      severity: "error",
      category: "onpage",
      title: `Títulos duplicados (${duplicateTitles.length} grupos)`,
      description:
        "Varias páginas comparten el mismo título. Los títulos duplicados confunden a Google sobre qué página mostrar.",
      howToFix:
        "Crea títulos únicos para cada página que describan específicamente su contenido.",
      affectedPages: affected,
    });
  }

  // Missing meta description
  const noMetaDesc = pages.filter(
    (p) =>
      p.statusCode === 200 &&
      (!p.metaDescription || p.metaDescription.trim() === ""),
  );
  if (noMetaDesc.length > 0) {
    issues.push({
      id: "missing-meta-description",
      severity: "warning",
      category: "onpage",
      title: `Sin meta description (${noMetaDesc.length})`,
      description:
        "Páginas sin meta description. Google podría generar un snippet automático menos atractivo.",
      howToFix:
        "Añade una meta description de 120-155 caracteres que resuma el contenido e incluya un call-to-action.",
      affectedPages: noMetaDesc.map((p) => ({ url: p.url })),
    });
  }

  // Missing or multiple H1
  const noH1 = pages.filter(
    (p) => p.statusCode === 200 && (p.h1Count === 0 || p.h1Count == null),
  );
  if (noH1.length > 0) {
    issues.push({
      id: "missing-h1",
      severity: "error",
      category: "onpage",
      title: `Sin etiqueta H1 (${noH1.length})`,
      description:
        "Páginas sin H1. El H1 es la etiqueta de encabezado principal y es importante para el SEO on-page.",
      howToFix:
        "Añade exactamente un H1 por página con la keyword principal del contenido.",
      affectedPages: noH1.map((p) => ({ url: p.url })),
    });
  }

  const multipleH1 = pages.filter(
    (p) => p.statusCode === 200 && p.h1Count != null && p.h1Count > 1,
  );
  if (multipleH1.length > 0) {
    issues.push({
      id: "multiple-h1",
      severity: "warning",
      category: "onpage",
      title: `Múltiples H1 (${multipleH1.length})`,
      description:
        "Páginas con más de un H1. Aunque no es un error grave, tener un solo H1 ayuda a clarificar la jerarquía del contenido.",
      howToFix:
        "Mantén un solo H1 por página. Usa H2 y H3 para subsecciones.",
      affectedPages: multipleH1.map((p) => ({
        url: p.url,
        detail: `${p.h1Count} H1s`,
      })),
    });
  }

  // === CONTENT ISSUES ===

  // Thin content (<300 words)
  const thinContent = pages.filter(
    (p) =>
      p.statusCode === 200 &&
      p.isIndexable !== false &&
      p.wordCount != null &&
      p.wordCount < 300 &&
      p.wordCount > 0,
  );
  if (thinContent.length > 0) {
    issues.push({
      id: "thin-content",
      severity: "warning",
      category: "content",
      title: `Contenido escaso <300 palabras (${thinContent.length})`,
      description:
        "Páginas con menos de 300 palabras. El contenido escaso puede tener dificultades para posicionar y Google podría considerarlo de baja calidad.",
      howToFix:
        "Amplía el contenido añadiendo información útil, FAQs, ejemplos o detalles relevantes. Objetivo: mínimo 500-800 palabras para contenido principal.",
      affectedPages: thinContent.map((p) => ({
        url: p.url,
        detail: `${p.wordCount} palabras`,
      })),
    });
  }

  // === IMAGE ISSUES ===

  // Images missing alt text
  const missingAlt = pages.filter(
    (p) =>
      p.statusCode === 200 &&
      p.imagesMissingAlt != null &&
      p.imagesMissingAlt > 0,
  );
  if (missingAlt.length > 0) {
    const totalMissing = missingAlt.reduce(
      (sum, p) => sum + (p.imagesMissingAlt ?? 0),
      0,
    );
    issues.push({
      id: "images-missing-alt",
      severity: "warning",
      category: "images",
      title: `Imágenes sin alt text (${totalMissing} en ${missingAlt.length} páginas)`,
      description:
        "Imágenes sin atributo alt. El alt text es importante para accesibilidad y SEO de imágenes.",
      howToFix:
        "Añade un atributo alt descriptivo a cada imagen que describa lo que muestra. Incluye keywords relevantes de forma natural.",
      affectedPages: missingAlt.map((p) => ({
        url: p.url,
        detail: `${p.imagesMissingAlt} de ${p.imagesTotal} sin alt`,
      })),
    });
  }

  // === LINK ISSUES ===

  // Pages with no internal links (orphan pages)
  const orphanPages = pages.filter(
    (p) =>
      p.statusCode === 200 &&
      p.internalLinkCount != null &&
      p.internalLinkCount === 0,
  );
  if (orphanPages.length > 0) {
    issues.push({
      id: "orphan-pages",
      severity: "warning",
      category: "links",
      title: `Páginas sin enlaces internos (${orphanPages.length})`,
      description:
        "Páginas que no tienen ningún enlace interno saliente. El enlazado interno ayuda a distribuir la autoridad y mejora el crawleo.",
      howToFix:
        "Añade enlaces a otras páginas relevantes del sitio. Usa anchor text descriptivo con keywords relacionadas.",
      affectedPages: orphanPages.map((p) => ({ url: p.url })),
    });
  }

  // Calculate score
  const totalChecks = pages.filter((p) => p.statusCode === 200).length;
  const errorWeight = issues
    .filter((i) => i.severity === "error")
    .reduce((sum, i) => sum + i.affectedPages.length, 0);
  const warningWeight = issues
    .filter((i) => i.severity === "warning")
    .reduce((sum, i) => sum + i.affectedPages.length, 0);

  const deductions =
    totalChecks > 0
      ? Math.min(
          100,
          (errorWeight * 3 + warningWeight * 1) / totalChecks * 10,
        )
      : 0;
  const score = Math.max(0, Math.round(100 - deductions));

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const infoCount = issues.filter((i) => i.severity === "info").length;

  return {
    errors: errorCount,
    warnings: warningCount,
    infos: infoCount,
    score,
    issues: issues.sort((a, b) => {
      const severityOrder = { error: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
  };
}
