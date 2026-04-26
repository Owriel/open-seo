export const LOCATIONS: Record<number, string> = {
  2724: "ES",
  2826: "UK",
  2276: "DE",
  2250: "FR",
  2380: "IT",
  2036: "AU",
};

const LOCATION_LANGUAGE: Record<number, string> = {
  2724: "es",
  2826: "en",
  2276: "de",
  2250: "fr",
  2380: "it",
  2036: "en",
};

export function getLanguageCode(locationCode: number): string {
  return LOCATION_LANGUAGE[locationCode] ?? "en";
}

/** Map DataForSEO location_code → ISO 3166-1 alpha-2 country code */
const LOCATION_COUNTRY_ISO: Record<number, string> = {
  2724: "ES",
  2826: "GB",
  2276: "DE",
  2250: "FR",
  2380: "IT",
  2036: "AU",
};

export function getCountryIso(locationCode: number): string {
  return LOCATION_COUNTRY_ISO[locationCode] ?? "ES";
}

export function competitionLabel(score: number | null): string {
  if (score == null) return "N/A";
  const pct = Math.round(score * 100);
  if (pct <= 33) return "low";
  if (pct <= 66) return "medium";
  return "high";
}

export function scoreTierClass(value: number | null): string {
  if (value == null) return "score-tier-na";
  if (value <= 20) return "score-tier-1";
  if (value <= 35) return "score-tier-2";
  if (value <= 50) return "score-tier-3";
  if (value <= 65) return "score-tier-4";
  if (value <= 80) return "score-tier-5";
  return "score-tier-6";
}

export function parseTerms(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[,+]/)
    .map((term) => term.trim())
    .filter(Boolean);
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "-";
  return new Intl.NumberFormat().format(value);
}

export function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return "";
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

/* ------------------------------------------------------------------ */
/*  Priority Scoring                                                    */
/* ------------------------------------------------------------------ */

export type PriorityTier = "alta" | "media" | "baja";

export function calculatePriorityScore(
  searchVolume: number | null,
  keywordDifficulty: number | null,
  cpc: number | null,
): number {
  const vol = Math.min(searchVolume ?? 0, 100000);
  const volScore = vol > 0 ? (Math.log10(vol) / Math.log10(100000)) * 100 : 0;
  const diffScore = 100 - (keywordDifficulty ?? 50);
  const cpcVal = Math.min(cpc ?? 0, 10);
  const cpcScore = (cpcVal / 10) * 100;
  return Math.round(volScore * 0.35 + diffScore * 0.35 + cpcScore * 0.3);
}

export function getPriorityTier(score: number): PriorityTier {
  if (score >= 70) return "alta";
  if (score >= 40) return "media";
  return "baja";
}

export function priorityTierClass(tier: PriorityTier): string {
  switch (tier) {
    case "alta":
      return "badge-success";
    case "media":
      return "badge-warning";
    case "baja":
      return "badge-error";
  }
}

/* ------------------------------------------------------------------ */
/*  Keyword Clustering                                                  */
/* ------------------------------------------------------------------ */

export type KeywordCluster = {
  name: string;
  keywords: string[];
  totalVolume: number;
  avgDifficulty: number;
  avgCpc: number;
  avgPriority: number;
  count: number;
};

const STOP_WORDS = new Set([
  "de",
  "la",
  "el",
  "en",
  "y",
  "a",
  "los",
  "las",
  "del",
  "un",
  "una",
  "por",
  "con",
  "para",
  "que",
  "se",
  "al",
  "es",
  "lo",
  "como",
  "más",
  "o",
  "su",
  "le",
  "ya",
  "no",
  "the",
  "and",
  "or",
  "of",
  "in",
  "to",
  "for",
  "is",
  "on",
  "at",
  "it",
  "a",
  "an",
  "vs",
  "with",
  "from",
]);

export function clusterKeywords<
  T extends {
    keyword: string;
    searchVolume: number | null;
    keywordDifficulty: number | null;
    cpc: number | null;
  },
>(rows: T[], _seedKeyword?: string): KeywordCluster[] {
  if (rows.length === 0) return [];

  const tokenized = rows.map((r) => ({
    keyword: r.keyword,
    tokens: r.keyword
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t)),
    volume: r.searchVolume ?? 0,
    difficulty: r.keywordDifficulty ?? 50,
    cpc: r.cpc ?? 0,
  }));

  const bigramCount = new Map<string, number>();
  for (const { tokens } of tokenized) {
    const seen = new Set<string>();
    for (let i = 0; i < tokens.length; i++) {
      if (i + 1 < tokens.length) {
        const bigram = `${tokens[i]} ${tokens[i + 1]}`;
        if (!seen.has(bigram)) {
          bigramCount.set(bigram, (bigramCount.get(bigram) ?? 0) + 1);
          seen.add(bigram);
        }
      }
    }
  }

  const validBigrams = [...bigramCount.entries()]
    .filter(([, count]) => count >= 2)
    .toSorted((a, b) => b[1] - a[1]);

  const assigned = new Set<string>();
  const clusters: KeywordCluster[] = [];

  for (const [bigram] of validBigrams) {
    const bigramTokens = bigram.split(" ");
    const matching = tokenized.filter(
      (t) =>
        !assigned.has(t.keyword) &&
        bigramTokens.every((bt) => t.tokens.includes(bt)),
    );

    if (matching.length < 2) continue;

    for (const m of matching) assigned.add(m.keyword);

    const totalVol = matching.reduce((s, m) => s + m.volume, 0);
    const avgDiff = Math.round(
      matching.reduce((s, m) => s + m.difficulty, 0) / matching.length,
    );
    const avgCpc = +(
      matching.reduce((s, m) => s + m.cpc, 0) / matching.length
    ).toFixed(2);
    const avgPriority = Math.round(
      matching.reduce(
        (s, m) => s + calculatePriorityScore(m.volume, m.difficulty, m.cpc),
        0,
      ) / matching.length,
    );

    clusters.push({
      name: bigram,
      keywords: matching.map((m) => m.keyword),
      totalVolume: totalVol,
      avgDifficulty: avgDiff,
      avgCpc: avgCpc,
      avgPriority: avgPriority,
      count: matching.length,
    });
  }

  const unassigned = tokenized.filter((t) => !assigned.has(t.keyword));
  if (unassigned.length > 0) {
    const totalVol = unassigned.reduce((s, m) => s + m.volume, 0);
    const avgDiff = Math.round(
      unassigned.reduce((s, m) => s + m.difficulty, 0) / unassigned.length,
    );
    const avgCpc = +(
      unassigned.reduce((s, m) => s + m.cpc, 0) / unassigned.length
    ).toFixed(2);
    const avgPriority = Math.round(
      unassigned.reduce(
        (s, m) => s + calculatePriorityScore(m.volume, m.difficulty, m.cpc),
        0,
      ) / unassigned.length,
    );

    clusters.push({
      name: "Otros",
      keywords: unassigned.map((m) => m.keyword),
      totalVolume: totalVol,
      avgDifficulty: avgDiff,
      avgCpc: avgCpc,
      avgPriority: avgPriority,
      count: unassigned.length,
    });
  }

  clusters.sort((a, b) => b.totalVolume - a.totalVolume);

  return clusters;
}
