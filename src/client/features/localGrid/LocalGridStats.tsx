// Barra de estadísticas del scan actual:
//   - SoLV (Share of Local Voice): % de puntos donde el target aparece en top 3.
//   - Posición media (entre los puntos donde sí aparece).
//   - Top position (la mejor posición alcanzada).
//   - Peor posición.
//   - Cobertura: % de puntos donde el target aparece en alguna posición.

import { Trophy, Target, TrendingDown, MapPin } from "lucide-react";
import type { GridPoint } from "@/types/localGrid";

type Props = { points: GridPoint[] };

function computeStats(points: GridPoint[]) {
  const total = points.length;
  const found = points.filter((p) => p.position != null);
  const top3 = found.filter((p) => (p.position ?? 999) <= 3).length;
  const positions = found.map((p) => p.position ?? 0);

  const solv = total > 0 ? Math.round((top3 / total) * 100) : 0;
  const coverage = total > 0 ? Math.round((found.length / total) * 100) : 0;
  const avgPosition =
    positions.length > 0
      ? Math.round(
          (positions.reduce((s, v) => s + v, 0) / positions.length) * 10,
        ) / 10
      : null;
  const bestPosition = positions.length > 0 ? Math.min(...positions) : null;
  const worstPosition = positions.length > 0 ? Math.max(...positions) : null;

  return {
    total,
    foundCount: found.length,
    solv,
    coverage,
    avgPosition,
    bestPosition,
    worstPosition,
  };
}

export default function LocalGridStats({ points }: Props) {
  const s = computeStats(points);

  // Colores según "salud" del SoLV (criterio sencillo):
  const solvColor =
    s.solv >= 60
      ? "text-success"
      : s.solv >= 30
        ? "text-warning"
        : "text-error";

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <StatCard
        label="Share of Local Voice"
        // top 3 en SoLV
        value={`${s.solv}%`}
        sub={`${s.total > 0 ? Math.round((s.foundCount / s.total) * 100) : 0}% cobertura total`}
        icon={<Target className={`size-4 ${solvColor}`} />}
        valueClass={solvColor}
      />
      <StatCard
        label="Posición media"
        value={s.avgPosition != null ? `#${s.avgPosition}` : "—"}
        sub={`${s.foundCount}/${s.total} puntos`}
        icon={<MapPin className="size-4 text-info" />}
      />
      <StatCard
        label="Mejor posición"
        value={s.bestPosition != null ? `#${s.bestPosition}` : "—"}
        sub="en algún punto del grid"
        icon={<Trophy className="size-4 text-success" />}
      />
      <StatCard
        label="Peor posición"
        value={s.worstPosition != null ? `#${s.worstPosition}` : "—"}
        sub="entre los que aparecen"
        icon={<TrendingDown className="size-4 text-error" />}
      />
      <StatCard
        label="Cobertura"
        value={`${s.coverage}%`}
        sub="aparece al menos en top 20"
        icon={<MapPin className="size-4 text-primary" />}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  valueClass,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="border border-base-300 rounded-lg bg-base-100 p-3">
      <div className="flex items-center gap-1 text-xs text-base-content/60">
        {icon}
        <span>{label}</span>
      </div>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${valueClass ?? ""}`}>
        {value}
      </p>
      <p className="text-[10px] text-base-content/50 mt-0.5">{sub}</p>
    </div>
  );
}
