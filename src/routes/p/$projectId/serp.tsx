import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import {
  Search,
  BarChart3,
  Globe,
  CheckCircle,
  XCircle,
  Lightbulb,
  FileDown,
  ExternalLink,
} from "lucide-react";
import { analyzeSerpResults } from "@/serverFunctions/serp";
import type { SerpAnalysisResult, SerpFeature, SerpRecommendation } from "@/types/serp";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { LOCATIONS, getLanguageCode } from "@/client/features/keywords/utils";

export const Route = createFileRoute("/p/$projectId/serp")({
  component: SerpAnalysisPage,
});

function SerpAnalysisPage() {
  const [keyword, setKeyword] = useState("");
  const [locationCode, setLocationCode] = useState(2724);

  const serpMutation = useMutation({
    mutationFn: (data: { keyword: string; locationCode: number; languageCode: string }) =>
      analyzeSerpResults({ data }),
  });

  const result = serpMutation.data ?? null;

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) {
      toast.error("Introduce una keyword");
      return;
    }
    serpMutation.mutate({
      keyword: keyword.trim().toLowerCase(),
      locationCode,
      languageCode: getLanguageCode(locationCode),
    });
  };

  const handleExportCsv = () => {
    if (!result || result.topResults.length === 0) return;
    const headers = ["Posición", "Título", "URL", "Dominio", "ETV"];
    const csvRows = result.topResults.map((r) =>
      [r.position, `"${r.title.replace(/"/g, '""')}"`, `"${r.url}"`, r.domain, r.etv ?? ""].join(","),
    );
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `serp-${keyword.replace(/\s+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 md:px-6 pt-4 pb-2 max-w-8xl mx-auto w-full">
        <h1 className="text-xl font-bold mb-1">Análisis SERP</h1>
        <p className="text-sm text-base-content/60 mb-3">
          Analiza los top 10 resultados orgánicos, features de la SERP y obtén recomendaciones SEO.
        </p>

        <form
          className="bg-base-100 border border-base-300 rounded-xl px-4 py-3 flex flex-wrap items-center gap-2"
          onSubmit={handleAnalyze}
        >
          <label className="input input-bordered input-sm flex items-center gap-2 flex-1 min-w-0 max-w-md">
            <Search className="size-3.5 shrink-0 text-base-content/50" />
            <input
              className="grow min-w-0"
              placeholder="Introduce una keyword (ej: dentista valencia)"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </label>

          <select
            className="select select-bordered select-sm w-auto"
            value={locationCode}
            onChange={(e) => setLocationCode(Number(e.target.value))}
          >
            {Object.entries(LOCATIONS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="btn btn-primary btn-sm px-6 font-semibold"
            disabled={serpMutation.isPending}
          >
            {serpMutation.isPending ? "Analizando..." : "Analizar SERP"}
          </button>
        </form>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
        <div className="mx-auto w-full max-w-8xl">
          {serpMutation.isPending ? (
            <LoadingState />
          ) : serpMutation.isError ? (
            <div className="mt-4 rounded-xl border border-error/30 bg-error/10 p-5 text-error">
              <p className="text-sm">{getStandardErrorMessage(serpMutation.error, "Error analizando SERP")}</p>
              <button className="btn btn-sm mt-2" onClick={() => serpMutation.reset()}>
                Reintentar
              </button>
            </div>
          ) : result ? (
            <div className="mt-4 space-y-4">
              {/* Features + Intent */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FeaturesPanel features={result.features} />
                <IntentPanel intent={result.intentAnalysis} />
              </div>

              {/* Top 10 */}
              <TopResultsPanel results={result.topResults} onExport={handleExportCsv} />

              {/* Dominios dominantes */}
              {result.dominantDomains.length > 0 && (
                <DominantDomainsPanel domains={result.dominantDomains} />
              )}

              {/* Recomendaciones */}
              {result.recommendations.length > 0 && (
                <RecommendationsPanel recommendations={result.recommendations} />
              )}
            </div>
          ) : (
            /* Empty state */
            <div className="mt-8 text-center space-y-3">
              <BarChart3 className="size-12 mx-auto text-base-content/30" />
              <p className="text-lg font-medium text-base-content/70">
                Introduce una keyword para analizar la SERP
              </p>
              <p className="text-sm text-base-content/50 max-w-md mx-auto">
                Verás los top 10 resultados orgánicos, features activas (featured snippet, FAQ, video...),
                dominios dominantes y recomendaciones SEO personalizadas.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Paneles                                                            */
/* ------------------------------------------------------------------ */

function FeaturesPanel({ features }: { features: SerpFeature[] }) {
  return (
    <div className="border border-base-300 rounded-xl bg-base-100 p-4">
      <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <BarChart3 className="size-4 text-primary" />
        Features de la SERP
      </h2>
      <div className="flex flex-wrap gap-2">
        {features.map((f) => (
          <span
            key={f.type}
            className={`badge badge-sm gap-1 ${f.present ? "badge-success" : "badge-ghost text-base-content/40"}`}
          >
            {f.present ? <CheckCircle className="size-3" /> : <XCircle className="size-3" />}
            {f.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function IntentPanel({ intent }: { intent: SerpAnalysisResult["intentAnalysis"] }) {
  const intentColors: Record<string, string> = {
    informacional: "badge-info",
    transaccional: "badge-success",
    local: "badge-warning",
    navegacional: "badge-primary",
  };

  return (
    <div className="border border-base-300 rounded-xl bg-base-100 p-4">
      <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <Globe className="size-4 text-primary" />
        Análisis de Intent
      </h2>
      <div className="mb-2">
        <span className={`badge ${intentColors[intent.primaryIntent] ?? "badge-ghost"} capitalize`}>
          {intent.primaryIntent}
        </span>
      </div>
      <ul className="text-xs text-base-content/60 space-y-1">
        {intent.signals.map((s, i) => (
          <li key={i}>- {s}</li>
        ))}
      </ul>
    </div>
  );
}

function TopResultsPanel({
  results,
  onExport,
}: {
  results: SerpAnalysisResult["topResults"];
  onExport: () => void;
}) {
  return (
    <div className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-base-300 flex items-center justify-between">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Search className="size-4 text-primary" />
          Top {results.length} Resultados Orgánicos
        </h2>
        <button className="btn btn-ghost btn-xs gap-1" onClick={onExport}>
          <FileDown className="size-3.5" />
          CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="table table-sm w-full">
          <thead>
            <tr className="text-xs text-base-content/60">
              <th className="w-12">#</th>
              <th>Título</th>
              <th>Dominio</th>
              <th className="text-right">ETV</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.position} className="hover:bg-base-200/50">
                <td>
                  <span
                    className={`badge badge-sm ${
                      r.position <= 3 ? "badge-success" : r.position <= 10 ? "badge-warning" : "badge-ghost"
                    }`}
                  >
                    {r.position}
                  </span>
                </td>
                <td className="max-w-[300px]">
                  <div className="font-medium text-sm truncate" title={r.title}>
                    {r.title}
                  </div>
                  <div className="text-xs text-base-content/40 truncate" title={r.url}>
                    {r.url}
                  </div>
                </td>
                <td className="text-sm">{r.domain}</td>
                <td className="text-right tabular-nums text-sm">
                  {r.etv != null ? Math.round(r.etv) : "-"}
                </td>
                <td>
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost btn-xs"
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DominantDomainsPanel({ domains }: { domains: SerpAnalysisResult["dominantDomains"] }) {
  return (
    <div className="border border-base-300 rounded-xl bg-base-100 p-4">
      <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <Globe className="size-4 text-primary" />
        Dominios Dominantes
      </h2>
      <div className="flex flex-wrap gap-2">
        {domains.map((d) => (
          <span key={d.domain} className="badge badge-sm badge-outline gap-1">
            {d.domain}
            {d.count > 1 && <span className="badge badge-xs badge-primary">{d.count}</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

function RecommendationsPanel({ recommendations }: { recommendations: SerpRecommendation[] }) {
  const priorityColors: Record<string, string> = {
    alta: "border-l-success",
    media: "border-l-warning",
    baja: "border-l-info",
  };
  const priorityBadge: Record<string, string> = {
    alta: "badge-success",
    media: "badge-warning",
    baja: "badge-info",
  };

  return (
    <div className="border border-base-300 rounded-xl bg-base-100 p-4">
      <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <Lightbulb className="size-4 text-primary" />
        Recomendaciones SEO
      </h2>
      <div className="space-y-3">
        {recommendations.map((rec) => (
          <div
            key={rec.type}
            className={`border-l-4 ${priorityColors[rec.priority]} bg-base-200/30 rounded-r-lg p-3`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{rec.title}</span>
              <span className={`badge badge-xs ${priorityBadge[rec.priority]}`}>
                {rec.priority}
              </span>
            </div>
            <p className="text-xs text-base-content/60">{rec.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading state                                                       */
/* ------------------------------------------------------------------ */

function LoadingState() {
  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-base-300 rounded-xl bg-base-100 p-4">
          <div className="skeleton h-4 w-32 mb-3" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-5 w-24" />
            ))}
          </div>
        </div>
        <div className="border border-base-300 rounded-xl bg-base-100 p-4">
          <div className="skeleton h-4 w-32 mb-3" />
          <div className="skeleton h-6 w-20 mb-2" />
          <div className="space-y-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-3 w-48" />
            ))}
          </div>
        </div>
      </div>
      <div className="border border-base-300 rounded-xl bg-base-100 p-6">
        <div className="skeleton h-5 w-48 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="grid grid-cols-5 gap-4">
              <div className="skeleton h-4 w-8" />
              <div className="skeleton h-4 w-full col-span-2" />
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
