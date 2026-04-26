// Tarjeta resumen del análisis actual: total reseñas, rating medio y
// estrellas visuales, y distribución rápida. Se muestra encima de los
// gráficos cuando hay un análisis cargado.

import { Star, MessageSquare } from "lucide-react";
import type { RatingDistribution } from "@/types/reviews";

type Props = {
  businessName: string | null;
  totalReviews: number;
  avgRating: number | null;
  ratingDistribution: RatingDistribution;
};

// Renderiza 5 estrellas visuales, coloreando una fracción proporcional al
// rating (ej. 4.3 → 4 completas + 30% de la 5ª coloreada). Usamos overlay
// de dos filas para conseguir el relleno parcial.
function Stars({ value }: { value: number | null }) {
  const v = value ?? 0;
  const pct = Math.max(0, Math.min(100, (v / 5) * 100));
  return (
    <div className="relative inline-flex">
      {/* Capa "vacía" de fondo (estrellas grises) */}
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="size-5 text-base-content/20" />
        ))}
      </div>
      {/* Capa "llena" recortada por width según rating */}
      <div
        className="absolute top-0 left-0 overflow-hidden flex gap-0.5"
        style={{ width: `${pct}%` }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="size-5 text-warning fill-warning" />
        ))}
      </div>
    </div>
  );
}

export default function ReviewsSummaryCard({
  businessName,
  totalReviews,
  avgRating,
  ratingDistribution,
}: Props) {
  // Total real de reseñas descargadas (suma del array de distribución).
  const downloaded = ratingDistribution.reduce((s, v) => s + v, 0);

  return (
    <div className="border border-base-300 rounded-xl bg-base-100 p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="size-4 text-primary" />
            {businessName ?? "Negocio"}
          </h2>
          <p className="text-xs text-base-content/50 mt-0.5">
            {downloaded} reseñas descargadas ·{" "}
            {totalReviews.toLocaleString("es-ES")} reseñas en total en Google
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-3xl font-bold text-warning tabular-nums leading-none">
              {avgRating != null ? avgRating.toFixed(1) : "—"}
            </p>
            <p className="text-[10px] text-base-content/50 mt-1">/ 5.0</p>
          </div>
          <Stars value={avgRating} />
        </div>
      </div>

      {/* Distribución compacta inline */}
      <div className="mt-3 grid grid-cols-5 gap-2">
        {[5, 4, 3, 2, 1].map((stars) => {
          const count = ratingDistribution[stars - 1];
          const pct = downloaded > 0 ? (count / downloaded) * 100 : 0;
          return (
            <div
              key={stars}
              className="flex flex-col items-center text-xs text-base-content/70"
            >
              <span className="font-medium flex items-center gap-0.5">
                {stars}
                <Star className="size-3 fill-current text-warning" />
              </span>
              <span className="tabular-nums">{count}</span>
              <span className="text-[10px] text-base-content/50">
                {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
