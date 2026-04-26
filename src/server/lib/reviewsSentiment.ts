// Sentiment analysis básico en español para reseñas de Google.
// No es ML: simplemente cuenta ocurrencias de palabras clave positivas y
// negativas. Es suficiente para resaltar reseñas "calientes" y dar un score
// indicativo por reseña.
//
// Se puede usar tanto desde server como desde client (pure functions, sin
// dependencias de runtime). Se re-exporta desde el componente ReviewsList
// para highlight inline de palabras en el texto.

// Listado de palabras/expresiones positivas (en minúsculas, sin tildes).
// Normalizamos el texto antes de comparar para que "rápido" = "rapido", etc.
export const POSITIVE_WORDS: readonly string[] = [
  "excelente",
  "genial",
  "perfecto",
  "fantastico",
  "increible",
  "recomiendo",
  "recomendable",
  "recomendado",
  "recomendada",
  "amable",
  "amables",
  "atento",
  "atenta",
  "atentos",
  "atentas",
  "rapido",
  "rapida",
  "rapidos",
  "rapidas",
  "rapidez",
  "profesional",
  "profesionales",
  "profesionalidad",
  "eficiente",
  "eficientes",
  "limpio",
  "limpios",
  "limpia",
  "limpias",
  "limpieza",
  "bueno",
  "buena",
  "buenos",
  "buenas",
  "buenisimo",
  "buenisima",
  "bueno.",
  "mejor",
  "mejores",
  "maravilloso",
  "maravillosa",
  "encantado",
  "encantada",
  "encantador",
  "encantadora",
  "agradable",
  "agradables",
  "comodo",
  "comoda",
  "comodos",
  "comodas",
  "satisfecho",
  "satisfecha",
  "contento",
  "contenta",
  "volvere",
  "volveremos",
  "repetire",
  "repetiremos",
  "fenomenal",
  "espectacular",
  "impecable",
  "cumplido",
  "honesto",
  "honesta",
  "serio",
  "seria",
  "serios",
  "serias",
  "serio.",
  "calidad",
  "calidad-precio",
  "precio-calidad",
  "estupendo",
  "estupenda",
  "estupendos",
  "estupendas",
  "super",
  "súper",
  "10/10",
  "5 estrellas",
  "100% recomendable",
];

// Listado de palabras/expresiones negativas.
export const NEGATIVE_WORDS: readonly string[] = [
  "fatal",
  "horrible",
  "horribles",
  "pesimo",
  "pesima",
  "pesimos",
  "pesimas",
  "malo",
  "mala",
  "malos",
  "malas",
  "peor",
  "peores",
  "lento",
  "lenta",
  "lentos",
  "lentas",
  "lentitud",
  "caro",
  "cara",
  "caros",
  "caras",
  "carisimo",
  "carisima",
  "descortes",
  "descortesia",
  "maleducado",
  "maleducada",
  "maleducados",
  "maleducadas",
  "grosero",
  "grosera",
  "groseros",
  "groseras",
  "estafa",
  "estafador",
  "estafadores",
  "engaño",
  "engañan",
  "engaña",
  "engañoso",
  "sucio",
  "sucia",
  "sucios",
  "sucias",
  "suciedad",
  "nunca",
  "jamas",
  "no recomiendo",
  "no volvere",
  "no vuelvo",
  "evitar",
  "evitad",
  "pesima atencion",
  "mala atencion",
  "decepcion",
  "decepcionado",
  "decepcionada",
  "decepcionante",
  "vergonzoso",
  "vergonzosa",
  "inutil",
  "inutiles",
  "incompetente",
  "incompetentes",
  "tardon",
  "tardones",
  "tarde",
  "problema",
  "problemas",
  "queja",
  "quejas",
  "denuncia",
  "denunciar",
  "timo",
  "timador",
  "timadores",
  "pesimo servicio",
  "mal servicio",
  "1 estrella",
];

// Normaliza un texto para comparar: a minúsculas, sin tildes, sin puntuación
// compleja. Dejamos dígitos y espacios.
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s%/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Cuenta ocurrencias de una lista de términos en un texto normalizado.
// Soporta términos multi-palabra (ej. "no recomiendo"): por eso no tokenizamos
// a palabras sueltas, buscamos substrings con límites de palabra.
function countOccurrences(
  normalized: string,
  terms: readonly string[],
): { count: number; matched: string[] } {
  let count = 0;
  const matched: string[] = [];
  for (const term of terms) {
    const t = normalizeText(term);
    if (!t) continue;
    // Buscamos con límites de palabra para no pillar "malol" al buscar "mal".
    const re = new RegExp(`(^|\\s)${escapeRegex(t)}(\\s|$)`, "g");
    const hits = normalized.match(re);
    if (hits && hits.length > 0) {
      count += hits.length;
      matched.push(t);
    }
  }
  return { count, matched };
}

// Escapa caracteres especiales de regex.
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Resultado del sentiment por reseña:
//   - positiveCount / negativeCount: ocurrencias en el texto.
//   - score: diferencia (positive - negative). >0 es positivo, <0 negativo.
//   - label: "positive" | "negative" | "neutral".
//   - matchedPositive / matchedNegative: términos que hicieron match
//     (útiles para resaltar en la UI).
export type SentimentResult = {
  positiveCount: number;
  negativeCount: number;
  score: number;
  label: "positive" | "negative" | "neutral";
  matchedPositive: string[];
  matchedNegative: string[];
};

// Analiza un texto y devuelve su SentimentResult.
export function analyzeSentiment(text: string): SentimentResult {
  const normalized = normalizeText(text);
  const pos = countOccurrences(normalized, POSITIVE_WORDS);
  const neg = countOccurrences(normalized, NEGATIVE_WORDS);
  const score = pos.count - neg.count;
  const label: SentimentResult["label"] =
    score > 0 ? "positive" : score < 0 ? "negative" : "neutral";
  return {
    positiveCount: pos.count,
    negativeCount: neg.count,
    score,
    label,
    matchedPositive: pos.matched,
    matchedNegative: neg.matched,
  };
}
