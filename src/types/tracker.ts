export type TrackedKeywordRow = {
  id: string;
  keyword: string;
  domain: string;
  locationCode: number;
  languageCode: string;
  currentPosition: number | null;
  previousPosition: number | null;
  bestPosition: number | null;
  rankingUrl: string | null;
  lastChecked: string | null;
  change: number | null; // positive = improved, negative = dropped
};

export type RankHistoryPoint = {
  date: string;
  position: number | null;
};
