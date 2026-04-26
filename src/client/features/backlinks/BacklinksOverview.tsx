// Tab "Resumen" del módulo Backlinks. Muestra 3 gráficos recharts:
//   1. Donut dofollow vs nofollow (total backlinks).
//   2. Distribución de backlinks por TLD (barras).
//   3. Top 10 anchors como barras horizontales.

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { PieChart as PieIcon, BarChart3, Tag } from "lucide-react";
import type { BacklinksSummary, AnchorItem } from "@/types/backlinks";

type Props = {
  summary: BacklinksSummary;
  anchors: AnchorItem[];
};

// Colores consistentes con el resto de módulos (Reviews usa tonalidades
// verdes/rojas). Aquí usamos primary/warning para follow/nofollow.
const COLOR_FOLLOW = "#22c55e"; // verde
const COLOR_NOFOLLOW = "#f97316"; // naranja

// Paleta para el gráfico de TLDs. Cíclica.
const TLD_PALETTE = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f59e0b",
  "#84cc16",
  "#10b981",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
];

const TOOLTIP_STYLE = {
  background: "var(--fallback-b1,oklch(var(--b1)))",
  border: "1px solid var(--fallback-b3,oklch(var(--b3)))",
  borderRadius: "0.5rem",
  fontSize: "0.75rem",
};

// Construye datos del donut follow/nofollow.
function buildFollowData(summary: BacklinksSummary) {
  const total = summary.backlinks;
  const nofollow = summary.referringLinksAttributes.nofollow ?? 0;
  const follow = Math.max(0, total - nofollow);
  return [
    { name: "Dofollow", value: follow, color: COLOR_FOLLOW },
    { name: "Nofollow", value: nofollow, color: COLOR_NOFOLLOW },
  ];
}

// Top N TLDs por conteo. Agrupa el resto en "otros" para no saturar el chart.
function buildTldData(summary: BacklinksSummary, topN: number = 10) {
  const entries = Object.entries(summary.referringLinksTld).toSorted(
    (a, b) => b[1] - a[1],
  );
  const top = entries.slice(0, topN);
  const rest = entries.slice(topN);
  const restCount = rest.reduce((s, [, v]) => s + v, 0);
  const data = top.map(([tld, count], i) => ({
    tld: `.${tld}`,
    count,
    color: TLD_PALETTE[i % TLD_PALETTE.length],
  }));
  if (restCount > 0) {
    data.push({ tld: "otros", count: restCount, color: "#94a3b8" });
  }
  return data;
}

// Top 10 anchors por conteo de backlinks.
function buildAnchorData(anchors: AnchorItem[]) {
  return anchors
    .toSorted((a, b) => b.backlinks - a.backlinks)
    .slice(0, 10)
    .map((a) => ({
      // Truncamos anchor largo para que quepa en el eje Y.
      anchor:
        a.anchor.length > 40
          ? `${a.anchor.slice(0, 37).trim()}…`
          : a.anchor || "(vacío)",
      count: a.backlinks,
      pct: a.percentOfTotal,
    }));
}

// Panel wrapper reutilizable.
function Panel({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-base-300 bg-base-200/30">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          {icon}
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-base-content/50 mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// oxlint-disable-next-line max-lines-per-function -- 3 gráficos en una vista
export default function BacklinksOverview({ summary, anchors }: Props) {
  const followData = buildFollowData(summary);
  const tldData = buildTldData(summary);
  const anchorData = buildAnchorData(anchors);

  const hasFollowData = followData.some((d) => d.value > 0);
  const hasTldData = tldData.length > 0;
  const hasAnchorData = anchorData.length > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Donut follow/nofollow */}
      <Panel
        icon={<PieIcon className="size-4 text-primary" />}
        title="Dofollow vs Nofollow"
        subtitle="Proporción de backlinks que traspasan autoridad"
      >
        {hasFollowData ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={followData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={50}
                label={(entry: { name?: string; value?: number }) =>
                  `${entry.name ?? ""}: ${(entry.value ?? 0).toLocaleString("es-ES")}`
                }
              >
                {followData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center text-xs text-base-content/50 py-8">
            Sin datos de dofollow/nofollow.
          </div>
        )}
      </Panel>

      {/* Distribución por TLD */}
      <Panel
        icon={<BarChart3 className="size-4 text-primary" />}
        title="Backlinks por TLD"
        subtitle="TLD del dominio referente (top 10 + otros)"
      >
        {hasTldData ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={tldData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--fallback-bc,oklch(var(--bc)/0.1))"
              />
              <XAxis
                dataKey="tld"
                stroke="var(--fallback-bc,oklch(var(--bc)/0.5))"
                fontSize={11}
                angle={-30}
                textAnchor="end"
                height={50}
              />
              <YAxis
                stroke="var(--fallback-bc,oklch(var(--bc)/0.5))"
                fontSize={11}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v) => [`${String(v)} backlinks`, "Cantidad"]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {tldData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center text-xs text-base-content/50 py-8">
            Sin datos de TLD.
          </div>
        )}
      </Panel>

      {/* Top anchors horizontales — ancho completo */}
      <Panel
        icon={<Tag className="size-4 text-primary" />}
        title="Top 10 anchors"
        subtitle="Textos ancla más usados (por nº de backlinks)"
      >
        {hasAnchorData ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={anchorData}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 120, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--fallback-bc,oklch(var(--bc)/0.1))"
              />
              <XAxis
                type="number"
                stroke="var(--fallback-bc,oklch(var(--bc)/0.5))"
                fontSize={11}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="anchor"
                stroke="var(--fallback-bc,oklch(var(--bc)/0.5))"
                fontSize={11}
                width={120}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v, _name, ctx: { payload?: { pct?: number } }) => [
                  `${String(v)} backlinks (${ctx.payload?.pct?.toFixed(1) ?? "—"}%)`,
                  "Cantidad",
                ]}
              />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center text-xs text-base-content/50 py-8">
            Sin datos de anchors.
          </div>
        )}
      </Panel>
    </div>
  );
}
