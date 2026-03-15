export type ClusterKeywordRow = {
  keyword: string;
  searchVolume: number | null;
  keywordDifficulty: number | null;
  cpc: number | null;
  intent: string | null;
  priority: number | null;
};

export type ClusterGroup = {
  name: string;
  keywords: ClusterKeywordRow[];
  totalVolume: number;
  avgDifficulty: number;
  avgCpc: number;
  avgPriority: number;
  count: number;
};

export type ClusterPlan = {
  id: string;
  name: string;
  pillarKeyword: string;
  clusters: ClusterGroup[];
  savedAt: string;
};
