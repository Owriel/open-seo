// Representa un resultado de negocio dentro del Top 5 de una celda del grid.
// Sirve para mostrar, al click sobre un marker, los competidores que
// aparecen en esa ubicación concreta del mapa.
export type GridTopResult = {
  position: number;
  businessName: string;
  domain: string | null;
  placeId: string | null;
  rating: number | null;
  reviewCount: number | null;
  address: string | null;
  // URL del website del negocio (si DataForSEO la devuelve). La guardamos
  // aparte del dominio porque a veces viene `url` con path completo.
  website: string | null;
};

// Un punto del grid con su resultado tras la consulta a DataForSEO.
// `position` es null cuando el dominio objetivo no aparece en los top 20 del
// Local Finder para esas coordenadas. `resultsCount` es el total de items
// devueltos (útil para diagnosticar zonas con poca competencia local).
// `topResults` contiene los 5 primeros resultados de la celda (para InfoWindow).
// Puede venir `undefined` en scans antiguos (retrocompatibilidad).
export type GridPoint = {
  lat: number;
  lng: number;
  position: number | null;
  resultsCount: number;
  topResults?: GridTopResult[];
};

// Un scan guardado (fila en `local_grid_scans` + puntos parseados).
export type GridScan = {
  id: string;
  projectId: string;
  keyword: string;
  targetDomain: string;
  // place_id del negocio objetivo. Prioritario sobre targetDomain para el
  // matching. Puede ser null en scans antiguos.
  targetPlaceId: string | null;
  // Nombre comercial del negocio objetivo (el que el usuario eligió en el
  // BusinessPicker). Puro metadato para mostrar en cabecera.
  businessName: string | null;
  centerLat: number;
  centerLng: number;
  gridSize: number;
  radiusKm: number;
  locationName: string | null;
  languageCode: string;
  points: GridPoint[];
  createdAt: string;
};

// Resumen compacto para listados (sin los puntos, que son pesados).
export type GridScanSummary = {
  id: string;
  keyword: string;
  targetDomain: string;
  businessName: string | null;
  centerLat: number;
  centerLng: number;
  gridSize: number;
  radiusKm: number;
  locationName: string | null;
  createdAt: string;
  // Métricas resumidas para renderizar tarjeta de historial sin cargar todos los puntos:
  pointsTotal: number;
  pointsFound: number; // puntos donde `position` != null
  topPosition: number | null;
  avgPosition: number | null;
};

// Resultado de la búsqueda de un negocio en Google Maps (para el
// BusinessPicker). Campos básicos que mostramos en las tarjetas antes
// de ejecutar el scan.
export type BusinessSearchResult = {
  placeId: string | null;
  businessName: string;
  rating: number | null;
  reviewCount: number | null;
  address: string | null;
  website: string | null;
  // Dominio extraído del website (sin www, sin protocolo). Vacío si no hay web.
  domain: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  phone: string | null;
};
