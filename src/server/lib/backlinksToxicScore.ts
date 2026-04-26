// Heurística para detectar backlinks tóxicos.
// La API de DataForSEO NO clasifica un backlink como "tóxico" per se; expone
// métricas (spam_score, tld, country, attributes, etc.) que hay que combinar
// manualmente. Este módulo implementa un scoring puntuado 0..10 donde:
//
//   - score ≥ 5  → candidato a disavow
//   - 3 ≤ score < 5 → sospechoso (revisar)
//   - score < 3  → poco probable que sea tóxico
//
// Reglas:
//   1. spam_score > 30 ...................... +3 pts
//   2. anchor = match exacto del keyword repetido (más de N veces el anchor
//      aparece con el mismo patrón) ......... +2 pts
//   3. TLD sospechoso (.xyz .click .top .tk
//      .ml .ga .cf .work .loan .click) ..... +2 pts
//   4. Dominio referente sin rank ni spam
//      (ambos null o 0) .................... +1 pt
//   5. Idioma del backlink distinto de ES
//      cuando el target es un .es .......... +1 pt
//
// El helper principal recibe el array de backlinks y devuelve cada uno con
// su score y el desglose de razones. Se usa tanto en UI (marcar filas) como
// en la exportación disavow.

import type { BacklinkItem, ToxicBacklink } from "@/types/backlinks";

// TLDs comúnmente usados para spam / SEO black hat.
// Fuente: Spamhaus, Google Transparency Report, análisis de backlink audits.
// Lista conservadora: no incluimos TLDs mainstream aunque haya spam ocasional
// (ej. .info no está aquí aunque históricamente haya tenido problemas).
const SUSPICIOUS_TLDS = new Set([
  "xyz",
  "click",
  "top",
  "tk",
  "ml",
  "ga",
  "cf",
  "work",
  "loan",
  "download",
  "bid",
  "stream",
  "racing",
  "win",
  "party",
  "trade",
  "science",
  "review",
  "date",
  "cricket",
  "faith",
  "gq",
  "cyou",
  "rest",
  "casino",
  "poker",
]);

export type ToxicScoreConfig = {
  // Umbral mínimo de spam_score para contar como señal.
  spamScoreThreshold?: number;
  // Target para detectar mismatch de idioma. Si no se pasa, se salta esa regla.
  targetDomain?: string | null;
  // Anchors que se consideran "keyword target" (match exacto peligroso) si
  // aparecen en el backlink. Sin normalizar por el caller; el helper normaliza.
  targetKeywords?: string[];
};

// Normaliza un string para comparaciones: minúsculas, sin acentos, sin
// espacios extremos.
function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Extrae el TLD del tldFrom. DataForSEO ya devuelve el TLD como string
// (ej. "xyz", "com"), pero a veces viene como "co.uk" → cogemos la última
// parte tras el punto para simplificar la detección.
function extractTld(tldFrom: string | null | undefined): string | null {
  if (!tldFrom) return null;
  const clean = tldFrom.toLowerCase().replace(/^\./, "");
  const parts = clean.split(".");
  return parts[parts.length - 1] ?? null;
}

// Detecta si el target es un dominio .es (o subdominio .es).
export function targetIsEs(target: string | null | undefined): boolean {
  if (!target) return false;
  const clean =
    target
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      ?.trim() ?? "";
  return clean.endsWith(".es");
}

// Calcula el score tóxico de un backlink aplicando las 5 reglas.
// Devuelve { score, reasons[] } con el desglose legible.
// eslint-disable-next-line complexity -- 5 reglas + guards, refactorizar sólo añade indirection
export function computeBacklinkToxicScore(
  bl: BacklinkItem,
  config: ToxicScoreConfig = {},
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const spamThreshold = config.spamScoreThreshold ?? 30;

  // Regla 1: spam_score alto.
  if (bl.spamScore != null && bl.spamScore > spamThreshold) {
    score += 3;
    reasons.push(`Spam score ${bl.spamScore} (> ${spamThreshold})`);
  }

  // Regla 2: anchor = match exacto del target keyword (potencial over-optimization).
  // Nota: en v1 detectamos coincidencia exacta con alguna de las keywords
  // que nos pasa el caller. Es un proxy: el problema real es la densidad
  // global de anchors exact-match, que se calcula a nivel de AnchorsTable.
  if (
    bl.anchor != null &&
    config.targetKeywords &&
    config.targetKeywords.length > 0
  ) {
    const anchorNorm = normalizeText(bl.anchor);
    const matched = config.targetKeywords
      .map(normalizeText)
      .filter((k) => k.length > 0)
      .some((k) => anchorNorm === k);
    if (matched) {
      score += 2;
      reasons.push(`Anchor exacto "${bl.anchor}" (sobre-optimización)`);
    }
  }

  // Regla 3: TLD sospechoso.
  const tld = extractTld(bl.tldFrom);
  if (tld != null && SUSPICIOUS_TLDS.has(tld)) {
    score += 2;
    reasons.push(`TLD sospechoso (.${tld})`);
  }

  // Regla 4: dominio referente sin rank (ni PageRank de página ni de dominio).
  // Indica dominio recién creado o de muy baja autoridad → red de backlinks
  // típica de PBN o spam.
  const hasNoRank =
    (bl.domainFromRank == null || bl.domainFromRank === 0) &&
    (bl.pageFromRank == null || bl.pageFromRank === 0);
  if (hasNoRank) {
    score += 1;
    reasons.push("Dominio sin rank (baja autoridad)");
  }

  // Regla 5: mismatch de idioma (target es .es pero el backlink no es ES).
  if (
    config.targetDomain != null &&
    targetIsEs(config.targetDomain) &&
    bl.pageFromLanguage != null &&
    bl.pageFromLanguage.toLowerCase() !== "es"
  ) {
    score += 1;
    reasons.push(`Idioma distinto (${bl.pageFromLanguage}, target es .es)`);
  }

  return { score, reasons };
}

// Aplica el scoring a una lista y devuelve los tóxicos (score ≥ threshold).
// Por defecto threshold = 5 (coincide con el cut-off que pinta la UI en rojo).
export function detectToxicBacklinks(
  backlinks: BacklinkItem[],
  config: ToxicScoreConfig = {},
  threshold: number = 5,
): ToxicBacklink[] {
  const out: ToxicBacklink[] = [];
  for (const bl of backlinks) {
    const { score, reasons } = computeBacklinkToxicScore(bl, config);
    if (score >= threshold) {
      out.push({ backlink: bl, score, reasons });
    }
  }
  // Orden descendente por score (los peores primero).
  out.sort((a, b) => b.score - a.score);
  return out;
}

// Genera el contenido de un archivo disavow.txt para Google Search Console.
// Formato oficial (https://support.google.com/webmasters/answer/2648487):
//   # comentarios opcionales con #
//   domain:ejemplo.xyz           ← ignora todos los backlinks desde ese dominio
//   http://ejemplo.xyz/page.html ← URL individual
//
// La política aquí: si hay varios backlinks del mismo dominio, preferimos
// `domain:` (más seguro). Si sólo hay uno, usamos la URL exacta.
export function buildDisavowFile(
  toxic: ToxicBacklink[],
  generatedFor: string,
): string {
  const lines: string[] = [];
  lines.push(`# Archivo disavow generado por OpenSEO`);
  lines.push(`# Target: ${generatedFor}`);
  lines.push(`# Generado: ${new Date().toISOString()}`);
  lines.push(`# Total backlinks marcados tóxicos: ${toxic.length}`);
  lines.push("");

  // Agrupamos por dominio para detectar cuáles tienen varios backlinks.
  const byDomain = new Map<string, ToxicBacklink[]>();
  for (const t of toxic) {
    const d = t.backlink.domainFrom ?? "";
    if (!d) continue;
    const arr = byDomain.get(d) ?? [];
    arr.push(t);
    byDomain.set(d, arr);
  }

  // Dominios con varios → `domain:` directiva (más efectiva en GSC).
  const multiDomains = Array.from(byDomain.entries())
    .filter(([, arr]) => arr.length > 1)
    .map(([d]) => d)
    .toSorted();

  // Dominios con sólo 1 backlink → URL exacta.
  const singleUrls: string[] = [];
  for (const [d, arr] of byDomain.entries()) {
    if (arr.length === 1) {
      const url = arr[0]?.backlink.urlFrom;
      if (url) singleUrls.push(url);
      else if (d) lines.push(`# Dominio sin URL exacta: ${d}`);
    }
  }
  singleUrls.sort();

  if (multiDomains.length > 0) {
    lines.push(
      `# Dominios con múltiples backlinks tóxicos (${multiDomains.length})`,
    );
    for (const d of multiDomains) {
      lines.push(`domain:${d}`);
    }
    lines.push("");
  }

  if (singleUrls.length > 0) {
    lines.push(
      `# URLs individuales con backlink tóxico (${singleUrls.length})`,
    );
    for (const u of singleUrls) {
      lines.push(u);
    }
  }

  return lines.join("\n") + "\n";
}
