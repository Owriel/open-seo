export type SerpResultRow = {
  position: number;
  title: string;
  url: string;
  domain: string;
  description: string;
  etv: number | null;
};

export type SerpFeature = {
  type: string;
  present: boolean;
  label: string;
};

export type SerpDominantDomain = {
  domain: string;
  count: number;
};

export type SerpRecommendation = {
  type: string;
  title: string;
  description: string;
  priority: "alta" | "media" | "baja";
};

export type SerpIntentAnalysis = {
  primaryIntent: string;
  signals: string[];
};

export type SerpAnalysisResult = {
  keyword: string;
  topResults: SerpResultRow[];
  features: SerpFeature[];
  dominantDomains: SerpDominantDomain[];
  intentAnalysis: SerpIntentAnalysis;
  recommendations: SerpRecommendation[];
};
