// Tipos del módulo "Reseñas Google".
// Representan el resultado normalizado que devolvemos al cliente tras llamar
// al endpoint Business Data Google Reviews de DataForSEO.

// Una reseña individual normalizada. Sólo guardamos los campos que usamos
// en la UI (filtro, listado, sentiment) y dejamos los datos brutos de la API
// fuera de la BBDD.
export type ReviewItem = {
  rating: number | null;
  text: string;
  authorName: string | null;
  reviewDate: string | null; // ISO date o "time ago"
  language: string | null;
  ownerAnswer: string | null;
};

// Distribución del rating, siempre un array de 5 posiciones:
// índice 0 = 1★, índice 4 = 5★. Indexación por estrellas (no por grado).
export type RatingDistribution = [number, number, number, number, number];

// Respuesta del cliente DataForSEO tras task_post + task_get.
export type BusinessReviewsResponse = {
  businessName: string | null;
  placeId: string | null;
  totalReviews: number;
  avgRating: number | null;
  ratingDistribution: RatingDistribution;
  reviews: ReviewItem[];
};

// Análisis guardado en BBDD (resumen + reseñas completas como JSON parseado).
export type ReviewAnalysis = {
  id: string;
  projectId: string;
  keyword: string;
  placeId: string | null;
  businessName: string | null;
  locationName: string | null;
  languageCode: string;
  totalReviews: number;
  avgRating: number | null;
  ratingDistribution: RatingDistribution;
  reviews: ReviewItem[];
  createdAt: string;
};

// Resumen ligero para la sidebar del historial (sin array de reseñas).
export type ReviewAnalysisSummary = {
  id: string;
  keyword: string;
  businessName: string | null;
  locationName: string | null;
  totalReviews: number;
  avgRating: number | null;
  ratingDistribution: RatingDistribution;
  createdAt: string;
};
