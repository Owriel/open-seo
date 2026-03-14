export type CompetitorRow = {
  domain: string;
  organicKeywords: number;
  organicTraffic: number;
  commonKeywords: number;
  avgPosition: number;
};

export type KeywordIntersectionRow = {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  keywordDifficulty: number | null;
  intent: string | null;
  myRank: number | null;
  myEtv: number | null;
  competitorRank: number | null;
  competitorEtv: number | null;
};
