// LineChart (recharts) con la evolución mensual del número de reseñas
// y el rating medio, a partir del array de reseñas descargadas.
// Agrupamos las reseñas por mes (YYYY-MM) usando `reviewDate` ISO.
// Si la reseña viene en formato "time ago" (sin ISO), la ignoramos.

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";
import type { ReviewItem } from "@/types/reviews";

type Props = {
  reviews: ReviewItem[];
};

type MonthlyBucket = {
  month: string; // YYYY-MM para ordenación
  label: string; // "mar 2025" para mostrar
  count: number;
  avgRating: number;
  _sumRating: number;
  _ratedCount: number;
};

// Parsea una fecha de reseña (formato DataForSEO: "yyyy-mm-dd hh:mm:ss +00:00").
// Devuelve un Date o null si no se puede parsear.
function parseReviewDate(raw: string | null): Date | null {
  if (!raw) return null;
  // El formato DataForSEO es ISO-ish ("yyyy-mm-dd hh:mm:ss +00:00"): Date lo
  // interpreta OK si sustituimos el espacio por T.
  const iso = raw.includes("T")
    ? raw
    : raw.replace(" ", "T").replace(" +", "+");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

const MONTH_LABELS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

// Agrupa reseñas por mes YYYY-MM.
function buildMonthlyBuckets(reviews: ReviewItem[]): MonthlyBucket[] {
  const map = new Map<string, MonthlyBucket>();

  for (const r of reviews) {
    const d = parseReviewDate(r.reviewDate);
    if (!d) continue;
    const key = `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
    const label = `${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    const bucket = map.get(key) ?? {
      month: key,
      label,
      count: 0,
      avgRating: 0,
      _sumRating: 0,
      _ratedCount: 0,
    };
    bucket.count += 1;
    if (r.rating != null) {
      bucket._sumRating += r.rating;
      bucket._ratedCount += 1;
    }
    map.set(key, bucket);
  }

  // Calculamos avg y ordenamos cronológicamente.
  const arr = Array.from(map.values()).map((b) => ({
    ...b,
    avgRating:
      b._ratedCount > 0
        ? Math.round((b._sumRating / b._ratedCount) * 100) / 100
        : 0,
  }));

  arr.sort((a, b) => a.month.localeCompare(b.month));
  return arr;
}

export default function ReviewsTimelineChart({ reviews }: Props) {
  const buckets = useMemo(() => buildMonthlyBuckets(reviews), [reviews]);

  return (
    <div className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-base-300 bg-base-200/30">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="size-4 text-success" />
          Evolución mensual
        </h3>
        <p className="text-xs text-base-content/50 mt-0.5">
          Número de reseñas y rating medio por mes (sólo reseñas con fecha ISO).
        </p>
      </div>
      <div className="p-4">
        {buckets.length === 0 ? (
          <div className="text-center text-xs text-base-content/50 py-8">
            No hay suficientes reseñas con fecha para calcular la evolución.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={buckets}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--fallback-bc,oklch(var(--bc)/0.1))"
              />
              <XAxis
                dataKey="label"
                stroke="var(--fallback-bc,oklch(var(--bc)/0.5))"
                fontSize={11}
              />
              <YAxis
                yAxisId="left"
                stroke="var(--fallback-p,oklch(var(--p)))"
                fontSize={11}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="var(--fallback-wa,oklch(var(--wa)))"
                fontSize={11}
                domain={[0, 5]}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--fallback-b1,oklch(var(--b1)))",
                  border: "1px solid var(--fallback-b3,oklch(var(--b3)))",
                  borderRadius: "0.5rem",
                  fontSize: "0.75rem",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="count"
                name="Nº reseñas"
                stroke="var(--fallback-p,oklch(var(--p)))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avgRating"
                name="Rating medio"
                stroke="var(--fallback-wa,oklch(var(--wa)))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
