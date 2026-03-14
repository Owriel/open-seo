export type LocalPackResult = {
  title: string;
  rating: number | null;
  reviewCount: number | null;
  ratingDistribution: Record<string, number> | null;
  position: number;
  category: string | null;
  additionalCategories: string[];
  address: string | null;
  city: string | null;
  phone: string | null;
  url: string | null;
  contactUrl: string | null;
  bookOnlineUrl: string | null;
  domain: string | null;
  isClaimed: boolean | null;
  snippet: string | null;
  googleMapsUrl: string | null;
  mainImage: string | null;
  totalPhotos: number | null;
  priceLevel: string | null;
  workHours: Record<string, string[]> | null;
  localJustifications: string[];
  latitude: number | null;
  longitude: number | null;
};

export type LocalKeywordSuggestion = {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  keywordDifficulty: number | null;
  intent: string | null;
  hasLocalPack: boolean;
};
