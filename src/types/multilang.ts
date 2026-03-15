// Tipos para el Revisor Multidioma

/** Idioma soportado por Google */
export interface GoogleLanguage {
  code: string;
  name: string;
}

/** Lista completa de 81 idiomas de Google */
export const GOOGLE_LANGUAGES: GoogleLanguage[] = [
  { code: "af", name: "Afrikaans" },
  { code: "sq", name: "Albanian" },
  { code: "am", name: "Amharic" },
  { code: "ar", name: "Arabic" },
  { code: "hy", name: "Armenian" },
  { code: "az", name: "Azerbaijani" },
  { code: "eu", name: "Basque" },
  { code: "be", name: "Belarusian" },
  { code: "bn", name: "Bengali" },
  { code: "bs", name: "Bosnian" },
  { code: "bg", name: "Bulgarian" },
  { code: "ca", name: "Catalan" },
  { code: "zh", name: "Chinese" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
  { code: "zh-HK", name: "Chinese (Hong Kong)" },
  { code: "zh-TW", name: "Chinese (Traditional)" },
  { code: "hr", name: "Croatian" },
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "nl", name: "Dutch" },
  { code: "en", name: "English" },
  { code: "en-AU", name: "English (Australian)" },
  { code: "en-GB", name: "English (Great Britain)" },
  { code: "et", name: "Estonian" },
  { code: "fa", name: "Farsi" },
  { code: "fi", name: "Finnish" },
  { code: "fil", name: "Filipino" },
  { code: "fr", name: "French" },
  { code: "fr-CA", name: "French (Canada)" },
  { code: "gl", name: "Galician" },
  { code: "ka", name: "Georgian" },
  { code: "de", name: "German" },
  { code: "el", name: "Greek" },
  { code: "gu", name: "Gujarati" },
  { code: "iw", name: "Hebrew" },
  { code: "hi", name: "Hindi" },
  { code: "hu", name: "Hungarian" },
  { code: "is", name: "Icelandic" },
  { code: "id", name: "Indonesian" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "kn", name: "Kannada" },
  { code: "kk", name: "Kazakh" },
  { code: "km", name: "Khmer" },
  { code: "ko", name: "Korean" },
  { code: "ky", name: "Kyrgyz" },
  { code: "lo", name: "Lao" },
  { code: "lv", name: "Latvian" },
  { code: "lt", name: "Lithuanian" },
  { code: "mk", name: "Macedonian" },
  { code: "ms", name: "Malay" },
  { code: "ml", name: "Malayalam" },
  { code: "mr", name: "Marathi" },
  { code: "mn", name: "Mongolian" },
  { code: "ne", name: "Nepali" },
  { code: "no", name: "Norwegian" },
  { code: "pl", name: "Polish" },
  { code: "pt", name: "Portuguese" },
  { code: "pt-BR", name: "Portuguese (Brazil)" },
  { code: "pt-PT", name: "Portuguese (Portugal)" },
  { code: "pa", name: "Punjabi" },
  { code: "ro", name: "Romanian" },
  { code: "ru", name: "Russian" },
  { code: "sr", name: "Serbian (Cyrillic)" },
  { code: "sr-Latn", name: "Serbian (Latin)" },
  { code: "si", name: "Sinhalese" },
  { code: "sk", name: "Slovak" },
  { code: "sl", name: "Slovenian" },
  { code: "es", name: "Spanish" },
  { code: "es-419", name: "Spanish (Latin America)" },
  { code: "sw", name: "Swahili" },
  { code: "sv", name: "Swedish" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "th", name: "Thai" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "ur", name: "Urdu" },
  { code: "uz", name: "Uzbek" },
  { code: "vi", name: "Vietnamese" },
  { code: "zu", name: "Zulu" },
];

/** Resultado de un idioma individual */
export interface LangResult {
  code: string;
  name: string;
  title: string;
}

/** Variante de nombre multiidioma */
export interface MultilangVariant {
  name: string;
  languages: { code: string; name: string }[];
  discoveredAt: string | null;
}

/** Ficha de negocio */
export interface MultilangFicha {
  id: string;
  inputName: string | null;
  url: string | null;
  baseName: string | null;
  ftid: string | null;
  variants: MultilangVariant[];
  baseLanguages: { code: string; name: string }[];
  allResults: LangResult[];
  totalLanguagesChecked: number;
  lastAnalyzed: string | null;
  status: "pending" | "analyzing" | "analyzed" | "error";
  error: string | null;
  categoryId: string | null;
  addedAt: string;
}

/** Categoría con keywords para agrupar fichas */
export interface MultilangCategory {
  id: string;
  name: string;
  keywords: string[];
  createdAt: string;
}

/** Base de datos completa en KV */
export interface MultilangDB {
  fichas: MultilangFicha[];
  categories: MultilangCategory[];
}

/** Resultado de búsqueda en Google Places */
export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
  mapsUrl: string;
  rating: number | null;
  totalReviews: number | null;
}
