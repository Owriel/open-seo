// Lógica core del informe SEO: scoring y generación de frases

import type {
  ReportScores,
  SectionScore,
  ReportVisibility,
  ReportOpportunities,
  ReportCompetitors,
  ReportContentGap,
  ReportLocal,
  ReportTechnicalHealth,
  ReportGbp,
} from "@/types/report";

// ---------------------------------------------------------------------------
// Helpers de scoring
// ---------------------------------------------------------------------------

function scoreColor(score: number): "green" | "yellow" | "red" {
  if (score >= 70) return "green";
  if (score >= 40) return "yellow";
  return "red";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Scoring por sección
// ---------------------------------------------------------------------------

export function scoreVisibility(data: ReportVisibility): SectionScore {
  let score = 0;

  // Keywords en top 10
  const top10Count = data.topKeywords.filter(
    (k) => k.position != null && k.position <= 10,
  ).length;
  const top3Count = data.topKeywords.filter(
    (k) => k.position != null && k.position <= 3,
  ).length;

  // Tráfico estimado (log scale)
  const traffic = data.organicTraffic ?? 0;
  const trafficScore =
    traffic > 0 ? clamp((Math.log10(traffic + 1) / 4) * 100, 0, 100) : 0;

  // Keywords rankeadas
  const kwCount = data.organicKeywords ?? 0;
  const kwScore =
    kwCount > 0 ? clamp((Math.log10(kwCount + 1) / 3) * 100, 0, 100) : 0;

  // Top 10 ratio
  const top10Score =
    data.topKeywords.length > 0
      ? (top10Count / data.topKeywords.length) * 100
      : 0;

  score = Math.round(trafficScore * 0.35 + kwScore * 0.3 + top10Score * 0.35);

  let summary: string;
  if (score >= 70) {
    summary = `Tu web tiene buena presencia en Google con ${kwCount} palabras clave posicionadas y ${top3Count} en el top 3.`;
  } else if (score >= 40) {
    summary = `Tu web aparece en Google con ${kwCount} palabras clave, pero pocas están en las primeras posiciones. Hay margen de mejora.`;
  } else {
    summary = `Tu web tiene poca visibilidad en Google. Solo ${kwCount} palabras clave posicionadas. Necesitas trabajar el SEO.`;
  }

  return { score, color: scoreColor(score), summary };
}

export function scoreOpportunities(data: ReportOpportunities): SectionScore {
  // Más oportunidades = peor nota (significa más potencial sin explotar)
  const ratio =
    data.totalKeywords > 0 ? data.totalOpportunities / data.totalKeywords : 0;

  // Invertir: si 80%+ son oportunidades = mal, si <20% = bien
  const score = Math.round(clamp((1 - ratio) * 100, 0, 100));

  const nearTop3 = data.results.filter((r) =>
    r.opportunityType.includes("near_top3"),
  ).length;
  const cannibCount = data.cannibalization.length;

  let summary: string;
  if (score >= 70) {
    summary = `La mayoría de tus keywords ya están bien posicionadas. ${nearTop3 > 0 ? `${nearTop3} keywords están muy cerca del top 3.` : ""}`;
  } else if (score >= 40) {
    summary = `Tienes ${data.totalOpportunities} oportunidades de mejora. ${nearTop3} keywords están cerca del top 3 y podrían subir con optimización.${cannibCount > 0 ? ` Se detectaron ${cannibCount} canibalizaciones.` : ""}`;
  } else {
    summary = `Hay ${data.totalOpportunities} keywords con potencial sin explotar. ${cannibCount > 0 ? `${cannibCount} canibalizaciones detectadas que frenan tu posicionamiento.` : "Necesitas optimizar contenido y estructura."}`;
  }

  return { score, color: scoreColor(score), summary };
}

export function scoreCompetitors(
  data: ReportCompetitors,
  ourTraffic: number | null,
): SectionScore {
  if (data.competitors.length === 0) {
    return {
      score: 50,
      color: "yellow",
      summary: "No se encontraron competidores orgánicos directos.",
    };
  }

  const avgCompTraffic =
    data.competitors.slice(0, 3).reduce((s, c) => s + c.organicTraffic, 0) /
    Math.min(3, data.competitors.length);
  const our = ourTraffic ?? 0;

  let score: number;
  if (avgCompTraffic === 0) {
    score = 70;
  } else {
    const ratio = our / avgCompTraffic;
    score = Math.round(clamp(ratio * 70, 0, 100));
  }

  const topComp = data.competitors[0];

  let summary: string;
  if (score >= 70) {
    summary = `Tu tráfico orgánico está por encima de la media de tus competidores. Compites bien contra ${topComp.domain}.`;
  } else if (score >= 40) {
    summary = `Tu principal competidor (${topComp.domain}) tiene más tráfico que tú. Hay margen para crecer.`;
  } else {
    summary = `${topComp.domain} te supera ampliamente en tráfico orgánico (${topComp.organicTraffic.toLocaleString("es-ES")} visitas estimadas). Necesitas una estrategia agresiva de contenido.`;
  }

  return { score, color: scoreColor(score), summary };
}

export function scoreContentGap(
  data: ReportContentGap,
  ourKeywordCount: number | null,
): SectionScore {
  if (data.keywords.length === 0) {
    return {
      score: 85,
      color: "green",
      summary:
        "Tu competidor principal no tiene keywords significativas que tú no tengas.",
    };
  }

  const gapCount = data.keywords.length;
  const ourKw = ourKeywordCount ?? 1;
  const ratio = gapCount / Math.max(ourKw, 1);

  // Menos gaps = mejor
  const score = Math.round(clamp((1 - Math.min(ratio, 1)) * 100, 10, 95));

  const highVolumeGaps = data.keywords.filter(
    (k) => (k.searchVolume ?? 0) > 100,
  ).length;

  let summary: string;
  if (score >= 70) {
    summary = `Tu competidor solo tiene ${gapCount} keywords que tú no cubres. Buena cobertura temática.`;
  } else if (score >= 40) {
    summary = `Tu competidor (${data.competitorDomain}) posiciona en ${gapCount} keywords donde tú no apareces. ${highVolumeGaps} de ellas tienen buen volumen de búsqueda.`;
  } else {
    summary = `Hay un gap importante: tu competidor posiciona en ${gapCount} keywords que tú no cubres. ${highVolumeGaps} con buen volumen. Necesitas crear contenido para estos temas.`;
  }

  return { score, color: scoreColor(score), summary };
}

export function scoreLocal(data: ReportLocal | null): SectionScore {
  if (!data) {
    return {
      score: 50,
      color: "yellow",
      summary:
        "No se proporcionó keyword principal para analizar presencia local.",
    };
  }

  let score = 0;

  // Apareces en el local pack
  if (data.ourPosition != null) {
    if (data.ourPosition <= 3) score += 40;
    else if (data.ourPosition <= 7) score += 25;
    else score += 10;
  }

  // Rating
  if (data.ourRating != null) {
    if (data.ourRating >= 4.5) score += 30;
    else if (data.ourRating >= 4.0) score += 20;
    else if (data.ourRating >= 3.5) score += 10;
  }

  // Reviews
  if (data.ourReviewCount != null) {
    if (data.ourReviewCount >= 50) score += 30;
    else if (data.ourReviewCount >= 20) score += 20;
    else if (data.ourReviewCount >= 5) score += 10;
  }

  let summary: string;
  if (data.ourPosition != null) {
    summary = `Apareces en la posición ${data.ourPosition} de Google Maps para "${data.keyword}"`;
    if (data.ourRating != null) summary += ` con ${data.ourRating} estrellas`;
    if (data.ourReviewCount != null)
      summary += ` y ${data.ourReviewCount} reseñas`;
    summary += ".";
    if (data.ourPosition > 3)
      summary +=
        " Mejorar reseñas y optimizar tu ficha puede subir te al top 3.";
  } else {
    score = Math.max(score, 15);
    summary = `No apareces en Google Maps cuando buscan "${data.keyword}". Esto significa que pierdes clientes que buscan tu servicio en la zona.`;
  }

  return { score: clamp(score, 0, 100), color: scoreColor(score), summary };
}

export function scoreTechnical(data: ReportTechnicalHealth): SectionScore {
  if (data.pagesCrawled === 0) {
    return {
      score: 0,
      color: "red",
      summary: "No se pudo acceder a la web para analizarla.",
    };
  }

  // Penalizar por issues
  const criticalPenalty = data.criticalCount * 15;
  const warningPenalty = data.warningCount * 5;
  const infoPenalty = data.infoCount * 1;

  const score = clamp(
    100 - criticalPenalty - warningPenalty - infoPenalty,
    0,
    100,
  );

  let summary: string;
  if (score >= 70) {
    summary = `Tu web está técnicamente bien. ${data.pagesCrawled} páginas analizadas con ${data.criticalCount === 0 ? "ningún" : data.criticalCount} error(es) crítico(s).`;
  } else if (score >= 40) {
    summary = `Se encontraron ${data.criticalCount} problemas críticos y ${data.warningCount} avisos en ${data.pagesCrawled} páginas. Corregir los errores críticos mejorará tu posicionamiento.`;
  } else {
    summary = `Tu web tiene problemas técnicos importantes: ${data.criticalCount} errores críticos y ${data.warningCount} avisos. Esto afecta a tu posicionamiento en Google.`;
  }

  return { score, color: scoreColor(score), summary };
}

export function scoreGbp(data: ReportGbp | null): SectionScore | null {
  if (!data) return null;

  const hasProblems = data.hasProblematicVariants;
  const variantCount = data.variants.length;

  const score = hasProblems ? (variantCount > 3 ? 25 : 50) : 90;

  let summary: string;
  if (!hasProblems) {
    summary = `Tu ficha de Google muestra el mismo nombre en todos los idiomas. Sin problemas detectados.`;
  } else {
    summary = `Se detectaron ${variantCount} variantes del nombre de tu negocio en diferentes idiomas. Esto puede confundir a Google y afectar tu posicionamiento local.`;
  }

  return { score, color: scoreColor(score), summary };
}

// ---------------------------------------------------------------------------
// Scoring global
// ---------------------------------------------------------------------------

type CalculateScoresInput = {
  visibility: ReportVisibility;
  opportunities: ReportOpportunities;
  competitors: ReportCompetitors;
  contentGap: ReportContentGap;
  local: ReportLocal | null;
  technical: ReportTechnicalHealth;
  gbp: ReportGbp | null;
};

export function calculateScores(input: CalculateScoresInput): ReportScores {
  const {
    visibility,
    opportunities,
    competitors,
    contentGap,
    local,
    technical,
    gbp,
  } = input;
  const visibilityScore = scoreVisibility(visibility);
  const opportunitiesScore = scoreOpportunities(opportunities);
  const competitorsScore = scoreCompetitors(
    competitors,
    visibility.organicTraffic,
  );
  const contentGapScore = scoreContentGap(
    contentGap,
    visibility.organicKeywords,
  );
  const localScore = scoreLocal(local);
  const technicalScore = scoreTechnical(technical);
  const gbpScore = scoreGbp(gbp);

  // Media ponderada para la puntuación global
  const weights = {
    visibility: 0.25,
    opportunities: 0.2,
    competitors: 0.15,
    contentGap: 0.1,
    local: 0.15,
    technical: 0.1,
    gbp: 0.05,
  };

  // Si no hay GBP, redistribuir peso
  let totalWeight = 1;
  let globalScore = 0;

  globalScore += visibilityScore.score * weights.visibility;
  globalScore += opportunitiesScore.score * weights.opportunities;
  globalScore += competitorsScore.score * weights.competitors;
  globalScore += contentGapScore.score * weights.contentGap;
  globalScore += localScore.score * weights.local;
  globalScore += technicalScore.score * weights.technical;

  if (gbpScore) {
    globalScore += gbpScore.score * weights.gbp;
  } else {
    totalWeight -= weights.gbp;
  }

  const normalizedGlobal = Math.round(globalScore / totalWeight);

  let globalSummary: string;
  if (normalizedGlobal >= 70) {
    globalSummary =
      "Tu web tiene una buena base SEO. Hay oportunidades puntuales de mejora para crecer más.";
  } else if (normalizedGlobal >= 40) {
    globalSummary =
      "Tu web tiene visibilidad en Google pero necesita mejoras en varias áreas para competir mejor.";
  } else {
    globalSummary =
      "Tu web necesita trabajo urgente en SEO. Hay problemas que están frenando tu posicionamiento en Google.";
  }

  return {
    global: {
      score: normalizedGlobal,
      color: scoreColor(normalizedGlobal),
      summary: globalSummary,
    },
    visibility: visibilityScore,
    opportunities: opportunitiesScore,
    competitors: competitorsScore,
    contentGap: contentGapScore,
    local: localScore,
    technical: technicalScore,
    gbp: gbpScore,
  };
}
