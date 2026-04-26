// 4 KPI cards del módulo Backlinks:
//   1. Total backlinks
//   2. Dominios referentes (main)
//   3. Rank (0..100)
//   4. % dofollow (calculado a partir de referring_links_attributes)

import { Link2, Globe, Gauge, ShieldCheck } from "lucide-react";
import type { BacklinksSummary } from "@/types/backlinks";

type Props = {
  summary: BacklinksSummary;
};

// Calcula el % de backlinks dofollow a partir del mapa
// referring_links_attributes. "nofollow" aparece en ese mapa con el conteo
// de enlaces que llevan rel=nofollow. El resto se consideran dofollow.
function computeDofollowPercent(summary: BacklinksSummary): number | null {
  const total = summary.backlinks;
  if (total <= 0) return null;
  const nofollow = summary.referringLinksAttributes.nofollow ?? 0;
  const pct = ((total - nofollow) / total) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
}

// Formatea números grandes con separador de miles español.
function fmt(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("es-ES");
}

type KpiCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "primary" | "warning" | "success";
};

function KpiCard({ icon, label, value, hint, tone = "default" }: KpiCardProps) {
  const toneClasses: Record<NonNullable<KpiCardProps["tone"]>, string> = {
    default: "text-base-content",
    primary: "text-primary",
    warning: "text-warning",
    success: "text-success",
  };
  return (
    <div className="border border-base-300 rounded-xl bg-base-100 p-3">
      <div className="flex items-center gap-2 text-xs text-base-content/60">
        {icon}
        <span>{label}</span>
      </div>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums leading-tight ${toneClasses[tone]}`}
      >
        {value}
      </p>
      {hint && (
        <p className="text-[10px] text-base-content/50 mt-0.5">{hint}</p>
      )}
    </div>
  );
}

export default function BacklinksSummaryCards({ summary }: Props) {
  const dofollowPct = computeDofollowPercent(summary);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        icon={<Link2 className="size-3.5" />}
        label="Total backlinks"
        value={fmt(summary.backlinks)}
        hint={
          summary.brokenBacklinks != null
            ? `${fmt(summary.brokenBacklinks)} rotos`
            : undefined
        }
      />
      <KpiCard
        icon={<Globe className="size-3.5" />}
        label="Dominios referentes"
        value={fmt(summary.referringDomains)}
        hint={`${fmt(summary.referringMainDomains)} main · ${fmt(summary.referringIps)} IPs`}
        tone="primary"
      />
      <KpiCard
        icon={<Gauge className="size-3.5" />}
        label="Rank"
        value={summary.rank != null ? String(summary.rank) : "—"}
        hint="0-100 (DataForSEO)"
        tone="primary"
      />
      <KpiCard
        icon={<ShieldCheck className="size-3.5" />}
        label="% Dofollow"
        value={dofollowPct != null ? `${dofollowPct.toFixed(1)}%` : "—"}
        hint={
          summary.referringLinksAttributes.nofollow != null
            ? `${fmt(summary.referringLinksAttributes.nofollow)} nofollow`
            : undefined
        }
        tone={
          dofollowPct == null
            ? "default"
            : dofollowPct >= 60
              ? "success"
              : dofollowPct >= 30
                ? "default"
                : "warning"
        }
      />
    </div>
  );
}
