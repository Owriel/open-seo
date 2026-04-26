// Utilidades de color y etiquetado según la posición del target en el grid.
// Paleta inspirada en Local Falcon:
//   - Posición 1: verde (dominio líder en esa zona).
//   - Posiciones 2-3: amarillo (podio, pero mejorable).
//   - Posiciones 4-10: naranja (aparece pero lejos del top).
//   - Posiciones 11+: rojo (resultados muy abajo).
//   - Sin aparecer: gris (no está en los top 20 del Local Finder).

export type PositionBucket = "top1" | "top3" | "top10" | "low" | "none";

export function getPositionBucket(position: number | null): PositionBucket {
  if (position == null) return "none";
  if (position === 1) return "top1";
  if (position <= 3) return "top3";
  if (position <= 10) return "top10";
  return "low";
}

// Colores hex adecuados para círculos Leaflet (fill + stroke).
export const BUCKET_COLORS: Record<
  PositionBucket,
  { fill: string; stroke: string }
> = {
  top1: { fill: "#16a34a", stroke: "#14532d" }, // verde
  top3: { fill: "#eab308", stroke: "#854d0e" }, // amarillo
  top10: { fill: "#f97316", stroke: "#7c2d12" }, // naranja
  low: { fill: "#dc2626", stroke: "#7f1d1d" }, // rojo
  none: { fill: "#9ca3af", stroke: "#374151" }, // gris
};

export const BUCKET_LABELS: Record<PositionBucket, string> = {
  top1: "#1",
  top3: "Top 3",
  top10: "Top 10",
  low: "11+",
  none: "No aparece",
};

// Etiqueta para el badge de una posición concreta (ej. "#4", "No aparece").
export function formatPosition(position: number | null): string {
  return position == null ? "—" : `#${position}`;
}
