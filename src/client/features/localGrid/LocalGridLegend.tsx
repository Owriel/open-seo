// Leyenda de colores del mapa. Explica qué significa cada color según la
// posición del dominio objetivo en ese punto del grid.

import {
  BUCKET_COLORS,
  BUCKET_LABELS,
  type PositionBucket,
} from "@/client/features/localGrid/colors";

const ORDER: PositionBucket[] = ["top1", "top3", "top10", "low", "none"];

export default function LocalGridLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <span className="text-base-content/60 font-medium">Leyenda:</span>
      {ORDER.map((bucket) => {
        const { fill, stroke } = BUCKET_COLORS[bucket];
        return (
          <span key={bucket} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-full border"
              style={{ background: fill, borderColor: stroke }}
            />
            <span className="text-base-content/70">
              {BUCKET_LABELS[bucket]}
            </span>
          </span>
        );
      })}
    </div>
  );
}
