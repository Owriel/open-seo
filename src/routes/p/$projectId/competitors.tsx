import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import {
  Search,
  Globe,
  TrendingUp,
  TrendingDown,
  FileDown,
  ArrowRightLeft,
  Users,
  Target,
  Zap,
  Shield,
} from "lucide-react";
import { findCompetitors, getKeywordIntersection } from "@/serverFunctions/competitors";
import { saveKeywords } from "@/serverFunctions/keywords";
import type { CompetitorRow, KeywordIntersectionRow } from "@/types/competitors";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  LOCATIONS,
  getLanguageCode,
  formatNumber,
  csvEscape,
  calculatePriorityScore,
  getPriorityTier,
  priorityTierClass,
} from "@/client/features/keywords/utils";

export const Route = createFileRoute("/p/$projectId/competitors")({
  component: CompetitorsPage,
});

type IntersectionMode = "common" | "gaps" | "advantages";

function CompetitorsPage() {
  const { projectId } = Route.useParams();

  // Form state
  const [domain, setDomain] = useState("");
  const [locationCode, setLocationCode] = useState(2724);
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
  const [intersectionMode, setIntersectionMode] = useState<IntersectionMode>("gaps");
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());

  // API mutations
  const competitorsMutation = useMutation({
    mutationFn: (data: { domain: string; locationCode: number; languageCode: string; includeSubdomains: boolean }) =>
      findCompetitors({ data }),
  });

  const intersectionMutation = useMutation({
    mutationFn: (data: { domain1: string; domain2: string; locationCode: number; languageCode: string; limit: number; mode: IntersectionMode }) =>
      getKeywordIntersection({ data }),
  });

  const saveMutation = useMutation({
    mutationFn: (data: { projectId: string; keywords: string[]; locationCode: number; languageCode: string }) =>
      saveKeywords({ data }),
  });

  const competitors = competitorsMutation.data?.competitors ?? [];
  const intersectionKeywords = intersectionMutation.data?.keywords ?? [];

  // Handlers
  const handleFindCompetitors = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) {
      toast.error("Introduce un dominio");
      return;
    }
    setSelectedCompetitor(null);
    setSelectedKeywords(new Set());
    competitorsMutation.mutate({
      domain: domain.trim(),
      locationCode,
      languageCode: getLanguageCode(locationCode),
      includeSubdomains: true,
    });
  };

  const handleSelectCompetitor = (competitorDomain: string) => {
    setSelectedCompetitor(competitorDomain);
    setSelectedKeywords(new Set());
    intersectionMutation.mutate({
      domain1: domain.trim(),
      domain2: competitorDomain,
      locationCode,
      languageCode: getLanguageCode(locationCode),
      limit: 200,
      mode: intersectionMode,
    });
  };

  const handleModeChange = (mode: IntersectionMode) => {
    setIntersectionMode(mode);
    if (selectedCompetitor) {
      setSelectedKeywords(new Set());
      intersectionMutation.mutate({
        domain1: domain.trim(),
        domain2: selectedCompetitor,
        locationCode,
        languageCode: getLanguageCode(locationCode),
        limit: 200,
        mode,
      });
    }
  };

  const handleSaveSelected = () => {
    if (selectedKeywords.size === 0) {
      toast.error("Selecciona al menos una keyword");
      return;
    }
    saveMutation.mutate(
      {
        projectId,
        keywords: [...selectedKeywords],
        locationCode,
        languageCode: getLanguageCode(locationCode),
      },
      {
        onSuccess: () => toast.success(`${selectedKeywords.size} keywords guardadas`),
        onError: (err) => toast.error(getStandardErrorMessage(err, "Error al guardar")),
      },
    );
  };

  const handleExportCsv = () => {
    const source = selectedKeywords.size > 0
      ? intersectionKeywords.filter((k) => selectedKeywords.has(k.keyword))
      : intersectionKeywords;
    if (source.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }
    const headers = ["Keyword", "Volume", "CPC", "Difficulty", "Intent", "Mi Posición", "Mi Tráfico", "Competidor Posición", "Competidor Tráfico", "Prioridad"];
    const csvRows = source.map((k) =>
      [
        csvEscape(k.keyword),
        k.searchVolume ?? "",
        k.cpc?.toFixed(2) ?? "",
        k.keywordDifficulty ?? "",
        k.intent ?? "",
        k.myRank ?? "",
        k.myEtv != null ? Math.round(k.myEtv) : "",
        k.competitorRank ?? "",
        k.competitorEtv != null ? Math.round(k.competitorEtv) : "",
        calculatePriorityScore(k.searchVolume, k.keywordDifficulty, k.cpc),
      ].join(","),
    );
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `competencia-${domain}-vs-${selectedCompetitor}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleKeywordSelection = (kw: string) => {
    setSelectedKeywords((prev) => {
      const next = new Set(prev);
      if (next.has(kw)) next.delete(kw);
      else next.add(kw);
      return next;
    });
  };

  const toggleAllKeywords = () => {
    if (selectedKeywords.size === intersectionKeywords.length) {
      setSelectedKeywords(new Set());
    } else {
      setSelectedKeywords(new Set(intersectionKeywords.map((k) => k.keyword)));
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 md:px-6 pt-4 pb-2 max-w-8xl mx-auto w-full">
        <h1 className="text-xl font-bold mb-1">Análisis de Competencia</h1>
        <p className="text-sm text-base-content/60 mb-3">
          Descubre tus competidores orgánicos, keywords comunes y oportunidades de posicionamiento.
        </p>

        <form
          className="bg-base-100 border border-base-300 rounded-xl px-4 py-3 flex flex-wrap items-center gap-2"
          onSubmit={handleFindCompetitors}
        >
          <label className="input input-bordered input-sm flex items-center gap-2 flex-1 min-w-0 max-w-md">
            <Search className="size-3.5 shrink-0 text-base-content/50" />
            <input
              className="grow min-w-0"
              placeholder="Introduce tu dominio (ej: tuempresa.es)"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </label>

          <select
            className="select select-bordered select-sm w-auto"
            value={locationCode}
            onChange={(e) => setLocationCode(Number(e.target.value))}
          >
            <option value={2724}>Spain</option>
            <option value={2826}>United Kingdom</option>
            <option value={2276}>Germany</option>
            <option value={2250}>France</option>
            <option value={2380}>Italy</option>
            <option value={2036}>Australia</option>
          </select>

          <button
            type="submit"
            className="btn btn-primary btn-sm px-6 font-semibold"
            disabled={competitorsMutation.isPending}
          >
            {competitorsMutation.isPending ? "Buscando..." : "Buscar Competidores"}
          </button>
        </form>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
        <div className="mx-auto w-full max-w-8xl">
          {competitorsMutation.isPending ? (
            <LoadingState />
          ) : competitorsMutation.isError ? (
            <div className="mt-4 rounded-xl border border-error/30 bg-error/10 p-5 text-error">
              <p className="text-sm">{getStandardErrorMessage(competitorsMutation.error, "Error buscando competidores")}</p>
              <button className="btn btn-sm mt-2" onClick={() => competitorsMutation.reset()}>
                Reintentar
              </button>
            </div>
          ) : competitors.length > 0 ? (
            <div className="mt-4 space-y-4">
              {/* Competitors table */}
              <div className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-base-300 flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  <h2 className="font-semibold text-sm">
                    {competitors.length} competidores orgánicos de {domain}
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="table table-sm w-full">
                    <thead>
                      <tr className="text-xs text-base-content/60">
                        <th>Dominio</th>
                        <th className="text-right">Keywords</th>
                        <th className="text-right">Tráfico Est.</th>
                        <th className="text-right">Keywords Comunes</th>
                        <th className="text-right">Pos. Media</th>
                        <th className="text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {competitors.map((comp) => (
                        <tr
                          key={comp.domain}
                          className={`hover:bg-base-200/50 cursor-pointer ${
                            selectedCompetitor === comp.domain ? "bg-primary/5 border-l-2 border-l-primary" : ""
                          }`}
                          onClick={() => handleSelectCompetitor(comp.domain)}
                        >
                          <td className="font-medium">{comp.domain}</td>
                          <td className="text-right tabular-nums">{formatNumber(comp.organicKeywords)}</td>
                          <td className="text-right tabular-nums">{formatNumber(comp.organicTraffic)}</td>
                          <td className="text-right tabular-nums">{formatNumber(comp.commonKeywords)}</td>
                          <td className="text-right tabular-nums">{comp.avgPosition}</td>
                          <td className="text-center">
                            <button
                              className="btn btn-ghost btn-xs text-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectCompetitor(comp.domain);
                              }}
                            >
                              <ArrowRightLeft className="size-3" />
                              Comparar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Keyword intersection */}
              {selectedCompetitor && (
                <div className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-base-300">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h2 className="font-semibold text-sm flex items-center gap-2">
                        <Target className="size-4 text-primary" />
                        {domain} vs {selectedCompetitor}
                      </h2>
                      <div className="flex gap-1">
                        <button
                          className={`btn btn-xs ${intersectionMode === "gaps" ? "btn-primary" : "btn-ghost"}`}
                          onClick={() => handleModeChange("gaps")}
                        >
                          <Zap className="size-3" />
                          Oportunidades
                        </button>
                        <button
                          className={`btn btn-xs ${intersectionMode === "common" ? "btn-primary" : "btn-ghost"}`}
                          onClick={() => handleModeChange("common")}
                        >
                          <ArrowRightLeft className="size-3" />
                          Comunes
                        </button>
                        <button
                          className={`btn btn-xs ${intersectionMode === "advantages" ? "btn-primary" : "btn-ghost"}`}
                          onClick={() => handleModeChange("advantages")}
                        >
                          <Shield className="size-3" />
                          Ventajas
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-base-content/50 mt-1">
                      {intersectionMode === "gaps"
                        ? "Keywords donde el competidor rankea y tú NO — oportunidades de contenido."
                        : intersectionMode === "common"
                          ? "Keywords donde ambos rankeáis — compara posiciones."
                          : "Keywords donde tú rankeas y el competidor NO — protege estas posiciones."}
                    </p>
                  </div>

                  {intersectionMutation.isPending ? (
                    <div className="p-6 text-center">
                      <span className="loading loading-spinner loading-md" />
                      <p className="text-sm text-base-content/50 mt-2">Analizando keywords...</p>
                    </div>
                  ) : intersectionMutation.isError ? (
                    <div className="p-4 text-error text-sm">
                      {getStandardErrorMessage(intersectionMutation.error, "Error al comparar")}
                    </div>
                  ) : intersectionKeywords.length === 0 ? (
                    <div className="p-6 text-center text-base-content/50">
                      <Globe className="size-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No se encontraron keywords en este modo.</p>
                    </div>
                  ) : (
                    <>
                      {/* Toolbar */}
                      <div className="flex items-center gap-2 px-4 py-2 border-b border-base-200">
                        <span className="text-sm text-base-content/60">
                          {selectedKeywords.size > 0
                            ? `${selectedKeywords.size} de ${intersectionKeywords.length} seleccionadas`
                            : `${intersectionKeywords.length} keywords`}
                        </span>
                        <div className="flex-1" />
                        <button
                          className="btn btn-ghost btn-xs gap-1"
                          onClick={handleSaveSelected}
                          disabled={selectedKeywords.size === 0}
                        >
                          Guardar
                        </button>
                        <button
                          className="btn btn-ghost btn-xs gap-1"
                          onClick={handleExportCsv}
                          disabled={intersectionKeywords.length === 0}
                        >
                          <FileDown className="size-3.5" />
                          CSV
                        </button>
                      </div>

                      {/* Keywords table */}
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <table className="table table-xs w-full">
                          <thead className="sticky top-0 bg-base-100 z-10">
                            <tr className="text-xs text-base-content/60">
                              <th className="w-8">
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-xs"
                                  checked={intersectionKeywords.length > 0 && selectedKeywords.size === intersectionKeywords.length}
                                  onChange={toggleAllKeywords}
                                />
                              </th>
                              <th>Keyword</th>
                              <th className="text-right">Volumen</th>
                              <th className="text-right">KD</th>
                              <th className="text-right">CPC</th>
                              <th className="text-center">Mi Pos.</th>
                              <th className="text-center">Comp. Pos.</th>
                              <th className="text-center">Prioridad</th>
                            </tr>
                          </thead>
                          <tbody>
                            {intersectionKeywords.map((kw) => {
                              const priority = calculatePriorityScore(kw.searchVolume, kw.keywordDifficulty, kw.cpc);
                              const tier = getPriorityTier(priority);
                              const tierClass = priorityTierClass(tier);
                              return (
                                <tr key={kw.keyword} className="hover:bg-base-200/50">
                                  <td>
                                    <input
                                      type="checkbox"
                                      className="checkbox checkbox-xs"
                                      checked={selectedKeywords.has(kw.keyword)}
                                      onChange={() => toggleKeywordSelection(kw.keyword)}
                                    />
                                  </td>
                                  <td className="font-medium capitalize max-w-[250px] truncate" title={kw.keyword}>
                                    {kw.keyword}
                                  </td>
                                  <td className="text-right tabular-nums">{formatNumber(kw.searchVolume)}</td>
                                  <td className="text-right tabular-nums">{kw.keywordDifficulty ?? "-"}</td>
                                  <td className="text-right tabular-nums">
                                    {kw.cpc != null ? `$${kw.cpc.toFixed(2)}` : "-"}
                                  </td>
                                  <td className="text-center">
                                    {kw.myRank ? (
                                      <span className={`badge badge-sm ${kw.myRank <= 3 ? "badge-success" : kw.myRank <= 10 ? "badge-warning" : "badge-ghost"}`}>
                                        #{kw.myRank}
                                      </span>
                                    ) : (
                                      <span className="text-base-content/30">—</span>
                                    )}
                                  </td>
                                  <td className="text-center">
                                    {kw.competitorRank ? (
                                      <span className={`badge badge-sm ${kw.competitorRank <= 3 ? "badge-success" : kw.competitorRank <= 10 ? "badge-warning" : "badge-ghost"}`}>
                                        #{kw.competitorRank}
                                      </span>
                                    ) : (
                                      <span className="text-base-content/30">—</span>
                                    )}
                                  </td>
                                  <td className="text-center">
                                    <span className={`badge badge-sm ${tierClass}`}>
                                      {priority}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : !competitorsMutation.data ? (
            /* Empty state */
            <div className="mt-8 text-center space-y-3">
              <Users className="size-12 mx-auto text-base-content/30" />
              <p className="text-lg font-medium text-base-content/70">
                Introduce tu dominio para descubrir competidores
              </p>
              <p className="text-sm text-base-content/50 max-w-md mx-auto">
                Analizaremos qué dominios compiten contigo por las mismas keywords
                orgánicas y te mostraremos oportunidades de posicionamiento.
              </p>
            </div>
          ) : (
            <div className="mt-8 text-center space-y-3">
              <Globe className="size-12 mx-auto text-base-content/30" />
              <p className="text-lg font-medium text-base-content/70">
                No se encontraron competidores para este dominio
              </p>
              <p className="text-sm text-base-content/50">
                Prueba con un dominio diferente o verifica la ortografía.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="mt-4 space-y-4">
      <div className="border border-base-300 rounded-xl bg-base-100 p-6">
        <div className="skeleton h-5 w-64 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="grid grid-cols-6 gap-4">
              <div className="skeleton h-4 w-full col-span-2" />
              <div className="skeleton h-4 w-16" />
              <div className="skeleton h-4 w-16" />
              <div className="skeleton h-4 w-12" />
              <div className="skeleton h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
