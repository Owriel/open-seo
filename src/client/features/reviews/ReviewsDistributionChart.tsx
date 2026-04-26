// BarChart (recharts) que pinta la distribución de ratings 1-5★.
// Usamos colores progresivos: 1-2★ rojos, 3★ amarillo, 4-5★ verdes.

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { BarChart3 } from "lucide-react";
import type { RatingDistribution } from "@/types/reviews";

type Props = {
  distribution: RatingDistribution;
};

// Color por cada estrella (1★ a 5★). Usamos variables semánticas de daisyUI
// mapeadas a tailwind.
const STAR_COLORS = [
  "#ef4444", // 1★ - rojo
  "#f97316", // 2★ - naranja
  "#eab308", // 3★ - amarillo
  "#84cc16", // 4★ - verde claro
  "#22c55e", // 5★ - verde
] as const;

export default function ReviewsDistributionChart({ distribution }: Props) {
  // Datos para recharts: pasamos cada estrella como fila.
  const data = [1, 2, 3, 4, 5].map((stars) => ({
    rating: `${stars}★`,
    count: distribution[stars - 1],
    color: STAR_COLORS[stars - 1],
  }));

  const total = distribution.reduce((s, v) => s + v, 0);

  return (
    <div className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-base-300 bg-base-200/30">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="size-4 text-primary" />
          Distribución de ratings
        </h3>
        <p className="text-xs text-base-content/50 mt-0.5">
          Cuántas reseñas hay de cada nota
        </p>
      </div>
      <div className="p-4">
        {total === 0 ? (
          <div className="text-center text-xs text-base-content/50 py-8">
            No hay datos de distribución.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--fallback-bc,oklch(var(--bc)/0.1))"
              />
              <XAxis
                dataKey="rating"
                stroke="var(--fallback-bc,oklch(var(--bc)/0.5))"
                fontSize={12}
              />
              <YAxis
                stroke="var(--fallback-bc,oklch(var(--bc)/0.5))"
                fontSize={12}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--fallback-b1,oklch(var(--b1)))",
                  border: "1px solid var(--fallback-b3,oklch(var(--b3)))",
                  borderRadius: "0.5rem",
                  fontSize: "0.75rem",
                }}
                formatter={(value) => [`${String(value)} reseñas`, "Cantidad"]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
