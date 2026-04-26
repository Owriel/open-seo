import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useProjectContext } from "@/client/hooks/useProjectContext";
import {
  Search,
  Target,
  Upload,
  Link2,
  FileDown,
  Save,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Unlink,
} from "lucide-react";
import {
  analyzeWithDataforseo,
  analyzeWithCsv,
  analyzeWithGsc,
  getGscAuthUrl,
  getGscStatus,
  disconnectGsc,
  saveOpportunityAnalysis,
  getOpportunityAnalyses,
  deleteOpportunityAnalysis,
} from "@/serverFunctions/opportunities";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  LOCATIONS,
  getLanguageCode,
  formatNumber,
} from "@/client/features/keywords/utils";
import { buildCsv, downloadCsv } from "@/client/lib/csv";
import {
  normalizeGscHeaders,
  parseCtrValue,
  parseNumericValue,
} from "@/server/lib/opportunities";
import type {
  OpportunityResult,
  OpportunityAnalysis,
  CannibalizationGroup,
  DataSource,
  GscConnectionStatus,
  OpportunityFilters,
} from "@/types/opportunities";

export const Route = createFileRoute("/p/$projectId/opportunities")({
  component: OpportunitiesPage,
});

// Filtros por defecto
const DEFAULT_FILTERS: OpportunityFilters = {
  minPosition: 4,
  maxPosition: 20,
  minImpressions: 10,
  maxCtr: null,
  onlyWithCtrGap: false,
};

type AnalysisResult = {
  results: OpportunityResult[];
  cannibalization: CannibalizationGroup[];
  totalKeywords: number;
  totalOpportunities: number;
  source: DataSource;
};

function OpportunitiesPage() {
  const { projectId } = Route.useParams();
  const { project, locationCode: projectLocationCode } =
    useProjectContext(projectId);

  // Estado general
  const [activeSource, setActiveSource] = useState<DataSource>("dataforseo");
  const [domain, setDomain] = useState("");
  const [locationCode, setLocationCode] = useState(2724);

  // Pre-rellenar al cargar el proyecto (sólo si el campo está vacío).
  useEffect(() => {
    if (!project) return;
    if (domain === "" && project.domain) setDomain(project.domain);
    if (projectLocationCode != null && locationCode === 2724) {
      setLocationCode(projectLocationCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, projectLocationCode]);
  const [filters, setFilters] = useState<OpportunityFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [savedAnalyses, setSavedAnalyses] = useState<OpportunityAnalysis[]>([]);

  // Estado CSV
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvRows, setCsvRows] = useState<
    Array<{
      keyword: string;
      url: string | null;
      clicks: number | null;
      impressions: number | null;
      ctr: number | null;
      position: number | null;
    }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado GSC
  const [gscStatus, setGscStatus] = useState<GscConnectionStatus | null>(null);
  const [gscSiteUrl, setGscSiteUrl] = useState("");
  const [gscDateRange, setGscDateRange] = useState<
    "7d" | "28d" | "3m" | "6m" | "12m" | "16m"
  >("3m");

  // Estado de resultados
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );
  const [expandedCannibalization, setExpandedCannibalization] = useState<
    string | null
  >(null);
  const [sortField, setSortField] = useState<
    "score" | "position" | "impressions" | "ctrGap"
  >("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Cargar análisis guardados
  const loadAnalyses = useCallback(async () => {
    try {
      const result = await getOpportunityAnalyses({ data: { projectId } });
      setSavedAnalyses(result.analyses);
    } catch {
      // Silencioso en carga inicial
    }
  }, [projectId]);

  // Cargar estado GSC
  const loadGscStatus = useCallback(async () => {
    try {
      const status = await getGscStatus({ data: { projectId } });
      setGscStatus(status);
      if (status.properties?.length === 1) {
        setGscSiteUrl(status.properties[0]);
      }
    } catch {
      // GSC no configurado, no es error
    }
  }, [projectId]);

  useEffect(() => {
    void loadAnalyses();
    void loadGscStatus();
  }, [loadAnalyses, loadGscStatus]);

  // Detectar si venimos del callback OAuth (redirigido desde /auth/gsc-callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gsc_connected") === "1") {
      toast.success("Google Search Console conectado");
      void loadGscStatus();
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [projectId, loadGscStatus]);

  // --- Mutaciones ---

  const dataforseoMutation = useMutation({
    mutationFn: () =>
      analyzeWithDataforseo({
        data: {
          domain: domain.trim(),
          locationCode,
          languageCode: getLanguageCode(locationCode),
          filters,
        },
      }),
    onSuccess: (data) => setAnalysisResult(data),
    onError: (err) =>
      toast.error(
        getStandardErrorMessage(err, "Error analizando con DataForSEO"),
      ),
  });

  const csvMutation = useMutation({
    mutationFn: () =>
      analyzeWithCsv({
        data: {
          domain: domain.trim() || csvFileName || "csv-import",
          rows: csvRows,
          filters,
        },
      }),
    onSuccess: (data) => setAnalysisResult(data),
    onError: (err) =>
      toast.error(getStandardErrorMessage(err, "Error analizando CSV")),
  });

  const gscMutation = useMutation({
    mutationFn: () =>
      analyzeWithGsc({
        data: {
          projectId,
          siteUrl: gscSiteUrl,
          dateRange: gscDateRange,
          filters,
        },
      }),
    onSuccess: (data) => setAnalysisResult(data),
    onError: (err) =>
      toast.error(getStandardErrorMessage(err, "Error analizando con GSC")),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!analysisResult) throw new Error("No hay resultados");
      return saveOpportunityAnalysis({
        data: {
          projectId,
          domain: domain.trim() || "sin-dominio",
          source: analysisResult.source,
          results: analysisResult.results,
          cannibalization: analysisResult.cannibalization,
          totalKeywords: analysisResult.totalKeywords,
          totalOpportunities: analysisResult.totalOpportunities,
          filters,
        },
      });
    },
    onSuccess: () => {
      toast.success("Análisis guardado");
      void loadAnalyses();
    },
    onError: (err) =>
      toast.error(getStandardErrorMessage(err, "Error al guardar")),
  });

  const deleteMutation = useMutation({
    mutationFn: (analysisId: string) =>
      deleteOpportunityAnalysis({ data: { projectId, analysisId } }),
    onSuccess: () => {
      toast.success("Análisis eliminado");
      void loadAnalyses();
    },
  });

  const isPending =
    dataforseoMutation.isPending ||
    csvMutation.isPending ||
    gscMutation.isPending;

  // --- Handlers ---

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    setAnalysisResult(null);

    if (activeSource === "dataforseo") {
      if (!domain.trim()) {
        toast.error("Introduce un dominio");
        return;
      }
      dataforseoMutation.mutate();
    } else if (activeSource === "csv") {
      if (csvRows.length === 0) {
        toast.error("Sube un archivo CSV primero");
        return;
      }
      csvMutation.mutate();
    } else if (activeSource === "gsc") {
      if (!gscSiteUrl) {
        toast.error("Selecciona una propiedad de GSC");
        return;
      }
      gscMutation.mutate();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.addEventListener("load", (event) => {
      const result = event.target?.result;
      const text = typeof result === "string" ? result : "";
      if (!text) return;

      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) {
        toast.error("El CSV no tiene datos suficientes");
        return;
      }

      // Detectar separador (coma o tabulador)
      const separator = lines[0].includes("\t") ? "\t" : ",";
      const headerCells = lines[0]
        .split(separator)
        .map((h) => h.replace(/^"|"$/g, "").trim());
      const headerMap = normalizeGscHeaders(headerCells);

      if (!headerMap.size) {
        toast.error(
          "No se reconocen las columnas del CSV. Usa un export de Google Search Console.",
        );
        return;
      }

      const rows: typeof csvRows = [];
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i]
          .split(separator)
          .map((c) => c.replace(/^"|"$/g, "").trim());
        const row: Record<string, string> = {};
        for (const [idx, field] of headerMap) {
          row[field] = cells[idx] ?? "";
        }

        if (!row.keyword) continue;

        rows.push({
          keyword: row.keyword,
          url: row.url || null,
          clicks: parseNumericValue(row.clicks),
          impressions: parseNumericValue(row.impressions),
          ctr: parseCtrValue(row.ctr),
          position: parseNumericValue(row.position),
        });
      }

      setCsvRows(rows);
      toast.success(`${rows.length} keywords cargadas desde CSV`);
    });
    reader.readAsText(file);
  };

  const handleConnectGsc = async () => {
    const result = await getGscAuthUrl({ data: { projectId } });
    if (result.url) {
      window.open(result.url, "_blank");
    } else {
      toast.error(result.error ?? "Error generando URL de autorización");
    }
  };

  const handleDisconnectGsc = async () => {
    await disconnectGsc({ data: { projectId } });
    setGscStatus({ connected: false, email: null, properties: null });
    toast.success("GSC desconectado");
  };

  const handleExportCsv = () => {
    if (!analysisResult?.results.length) return;
    const headers = [
      "Keyword",
      "URL",
      "Posición",
      "Clics",
      "Impresiones",
      "CTR (%)",
      "CTR Esperado (%)",
      "Gap CTR (pp)",
      "Volumen",
      "KD",
      "CPC",
      "Score",
      "Tipo",
    ];
    const rows = analysisResult.results.map((r) => [
      r.keyword,
      r.url,
      r.position,
      r.clicks,
      r.impressions,
      r.ctr != null ? r.ctr.toFixed(2) : null,
      r.expectedCtr != null ? r.expectedCtr.toFixed(2) : null,
      r.ctrGap != null ? r.ctrGap.toFixed(2) : null,
      r.searchVolume,
      r.keywordDifficulty,
      r.cpc != null ? r.cpc.toFixed(2) : null,
      r.score,
      r.opportunityType.join(", "),
    ]);
    const csv = buildCsv(headers, rows);
    downloadCsv(`oportunidades-${domain || "analisis"}.csv`, csv);
  };

  // Ordenar resultados
  const sortedResults = [...(analysisResult?.results ?? [])].toSorted(
    (a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    },
  );

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 md:px-6 pt-4 pb-2 max-w-8xl mx-auto w-full">
        <h1 className="text-xl font-bold mb-1">Keywords de Oportunidad</h1>
        <p className="text-sm text-base-content/60 mb-3">
          Detecta keywords donde ya tienes visibilidad pero puedes escalar
          posiciones, mejorar CTR o resolver canibalizaciones.
        </p>

        {/* Selector de fuente */}
        <div className="flex gap-1 mb-3">
          <button
            className={`btn btn-sm gap-1 ${activeSource === "dataforseo" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveSource("dataforseo")}
          >
            <Search className="size-3.5" />
            DataForSEO
          </button>
          <button
            className={`btn btn-sm gap-1 ${activeSource === "csv" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveSource("csv")}
          >
            <Upload className="size-3.5" />
            CSV
          </button>
          <button
            className={`btn btn-sm gap-1 ${activeSource === "gsc" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveSource("gsc")}
          >
            <Link2 className="size-3.5" />
            Search Console
          </button>
        </div>

        {/* Formulario según fuente activa */}
        <form
          className="bg-base-100 border border-base-300 rounded-xl px-4 py-3 space-y-3"
          onSubmit={handleAnalyze}
        >
          {activeSource === "dataforseo" && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="input input-bordered input-sm flex items-center gap-2 flex-1 min-w-0 max-w-md">
                <Search className="size-3.5 shrink-0 text-base-content/50" />
                <input
                  className="grow min-w-0"
                  placeholder="Dominio (ej: ejemplo.com)"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
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
                disabled={isPending}
              >
                {isPending ? "Analizando..." : "Analizar"}
              </button>
            </div>
          )}

          {activeSource === "csv" && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                className="file-input file-input-bordered file-input-sm max-w-xs"
                onChange={handleFileUpload}
              />
              {csvRows.length > 0 && (
                <span className="badge badge-success badge-sm">
                  {csvRows.length} keywords cargadas
                </span>
              )}
              <label className="input input-bordered input-sm flex items-center gap-2 flex-1 min-w-0 max-w-xs">
                <input
                  className="grow min-w-0"
                  placeholder="Dominio (opcional)"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
              </label>
              <button
                type="submit"
                className="btn btn-primary btn-sm px-6 font-semibold"
                disabled={isPending || csvRows.length === 0}
              >
                {isPending ? "Analizando..." : "Analizar CSV"}
              </button>
            </div>
          )}

          {activeSource === "gsc" && (
            <div className="space-y-2">
              {gscStatus?.connected ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge badge-success badge-sm gap-1">
                    <Link2 className="size-3" />
                    {gscStatus.email ?? "Conectado"}
                  </span>
                  <select
                    className="select select-bordered select-sm flex-1 max-w-md"
                    value={gscSiteUrl}
                    onChange={(e) => setGscSiteUrl(e.target.value)}
                  >
                    <option value="">Selecciona propiedad...</option>
                    {gscStatus.properties?.map((prop) => (
                      <option key={prop} value={prop}>
                        {prop}
                      </option>
                    ))}
                  </select>
                  <select
                    className="select select-bordered select-sm w-auto"
                    value={gscDateRange}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (
                        v === "7d" ||
                        v === "28d" ||
                        v === "3m" ||
                        v === "6m" ||
                        v === "12m" ||
                        v === "16m"
                      )
                        setGscDateRange(v);
                    }}
                  >
                    <option value="7d">7 días</option>
                    <option value="28d">28 días</option>
                    <option value="3m">3 meses</option>
                    <option value="6m">6 meses</option>
                    <option value="12m">12 meses</option>
                    <option value="16m">16 meses</option>
                  </select>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm px-6 font-semibold"
                    disabled={isPending || !gscSiteUrl}
                  >
                    {isPending ? "Analizando..." : "Analizar GSC"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-error"
                    onClick={handleDisconnectGsc}
                  >
                    <Unlink className="size-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-base-content/60">
                    Conecta tu cuenta de Google Search Console para obtener
                    datos reales de clics, impresiones y CTR.
                  </p>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline gap-1"
                    onClick={handleConnectGsc}
                  >
                    <Link2 className="size-3.5" />
                    Conectar GSC
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Filtros avanzados */}
          <div>
            <button
              type="button"
              className="text-xs text-base-content/50 hover:text-base-content/80 flex items-center gap-1"
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
              Filtros avanzados
            </button>
            {showFilters && (
              <div className="flex flex-wrap gap-3 mt-2 text-sm">
                <label className="flex items-center gap-1">
                  <span className="text-xs text-base-content/60">
                    Pos. mín:
                  </span>
                  <input
                    type="number"
                    className="input input-bordered input-xs w-16"
                    value={filters.minPosition}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        minPosition: Number(e.target.value) || 1,
                      })
                    }
                  />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-xs text-base-content/60">
                    Pos. máx:
                  </span>
                  <input
                    type="number"
                    className="input input-bordered input-xs w-16"
                    value={filters.maxPosition}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        maxPosition: Number(e.target.value) || 100,
                      })
                    }
                  />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-xs text-base-content/60">
                    Impresiones mín:
                  </span>
                  <input
                    type="number"
                    className="input input-bordered input-xs w-20"
                    value={filters.minImpressions}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        minImpressions: Number(e.target.value) || 0,
                      })
                    }
                  />
                </label>
                <label className="flex items-center gap-1">
                  <span className="text-xs text-base-content/60">
                    CTR máx (%):
                  </span>
                  <input
                    type="number"
                    className="input input-bordered input-xs w-16"
                    value={filters.maxCtr ?? ""}
                    placeholder="—"
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        maxCtr: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={filters.onlyWithCtrGap}
                    onChange={(e) =>
                      setFilters({
                        ...filters,
                        onlyWithCtrGap: e.target.checked,
                      })
                    }
                  />
                  <span className="text-xs text-base-content/60">
                    Solo con gap de CTR
                  </span>
                </label>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
        <div className="mx-auto w-full max-w-8xl">
          {isPending ? (
            <LoadingState />
          ) : analysisResult ? (
            <div className="mt-4 space-y-4">
              {/* Resumen */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="stat bg-base-100 border border-base-300 rounded-lg px-4 py-2">
                    <div className="stat-title text-xs">
                      Keywords analizadas
                    </div>
                    <div className="stat-value text-lg">
                      {formatNumber(analysisResult.totalKeywords)}
                    </div>
                  </div>
                  <div className="stat bg-base-100 border border-base-300 rounded-lg px-4 py-2">
                    <div className="stat-title text-xs">Oportunidades</div>
                    <div className="stat-value text-lg text-success">
                      {formatNumber(analysisResult.totalOpportunities)}
                    </div>
                  </div>
                  <div className="stat bg-base-100 border border-base-300 rounded-lg px-4 py-2">
                    <div className="stat-title text-xs">Canibalizaciones</div>
                    <div className="stat-value text-lg text-warning">
                      {analysisResult.cannibalization.length}
                    </div>
                  </div>
                  <span className="badge badge-ghost badge-sm capitalize">
                    {analysisResult.source}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn btn-ghost btn-sm gap-1"
                    onClick={handleExportCsv}
                  >
                    <FileDown className="size-3.5" /> CSV
                  </button>
                  <button
                    className="btn btn-sm btn-success gap-1"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                  >
                    <Save className="size-3.5" /> Guardar
                  </button>
                </div>
              </div>

              {/* Tabla de resultados */}
              {sortedResults.length > 0 && (
                <div className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="table table-xs w-full">
                      <thead>
                        <tr className="text-xs text-base-content/60">
                          <th>Keyword</th>
                          <th>URL</th>
                          <th
                            className="text-right cursor-pointer"
                            onClick={() => handleSort("position")}
                          >
                            Pos{" "}
                            {sortField === "position" &&
                              (sortDir === "desc" ? "↓" : "↑")}
                          </th>
                          <th
                            className="text-right cursor-pointer"
                            onClick={() => handleSort("impressions")}
                          >
                            Impr{" "}
                            {sortField === "impressions" &&
                              (sortDir === "desc" ? "↓" : "↑")}
                          </th>
                          <th className="text-right">Clics</th>
                          <th className="text-right">CTR</th>
                          <th className="text-right">CTR Esp.</th>
                          <th
                            className="text-right cursor-pointer"
                            onClick={() => handleSort("ctrGap")}
                          >
                            Gap{" "}
                            {sortField === "ctrGap" &&
                              (sortDir === "desc" ? "↓" : "↑")}
                          </th>
                          <th className="text-right">Vol</th>
                          <th
                            className="text-right cursor-pointer"
                            onClick={() => handleSort("score")}
                          >
                            Score{" "}
                            {sortField === "score" &&
                              (sortDir === "desc" ? "↓" : "↑")}
                          </th>
                          <th>Tipo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedResults.map((r, i) => (
                          <tr
                            key={`${r.keyword}-${r.url}-${i}`}
                            className="hover:bg-base-200/30"
                          >
                            <td className="max-w-[200px] truncate font-medium">
                              {r.keyword}
                            </td>
                            <td className="max-w-[150px] truncate text-xs text-base-content/50">
                              {r.url ? new URL(r.url).pathname : "—"}
                            </td>
                            <td className="text-right tabular-nums">
                              {r.position ?? "—"}
                            </td>
                            <td className="text-right tabular-nums">
                              {formatNumber(r.impressions)}
                            </td>
                            <td className="text-right tabular-nums">
                              {formatNumber(r.clicks)}
                            </td>
                            <td className="text-right tabular-nums">
                              {r.ctr != null ? `${r.ctr.toFixed(1)}%` : "—"}
                            </td>
                            <td className="text-right tabular-nums text-base-content/50">
                              {r.expectedCtr != null
                                ? `${r.expectedCtr.toFixed(1)}%`
                                : "—"}
                            </td>
                            <td
                              className={`text-right tabular-nums ${r.ctrGap != null && r.ctrGap > 0 ? "text-warning" : ""}`}
                            >
                              {r.ctrGap != null
                                ? `${r.ctrGap > 0 ? "+" : ""}${r.ctrGap.toFixed(1)}pp`
                                : "—"}
                            </td>
                            <td className="text-right tabular-nums">
                              {formatNumber(r.searchVolume)}
                            </td>
                            <td className="text-right">
                              <span
                                className={`badge badge-xs ${getScoreBadgeClass(r.score)}`}
                              >
                                {r.score}
                              </span>
                            </td>
                            <td>
                              <div className="flex gap-0.5">
                                {r.opportunityType.map((t) => (
                                  <span
                                    key={t}
                                    className={`badge badge-xs ${getTypeBadgeClass(t)}`}
                                  >
                                    {getTypeLabel(t)}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Canibalizaciones */}
              {analysisResult.cannibalization.length > 0 && (
                <div>
                  <h2 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <AlertTriangle className="size-4 text-warning" />
                    Canibalizaciones detectadas (
                    {analysisResult.cannibalization.length})
                  </h2>
                  <div className="space-y-2">
                    {analysisResult.cannibalization.map((group) => {
                      const isExpanded =
                        expandedCannibalization === group.keyword;
                      return (
                        <div
                          key={group.keyword}
                          className="border border-warning/30 rounded-lg bg-base-100 overflow-hidden"
                        >
                          <button
                            className="w-full px-4 py-2 flex items-center justify-between hover:bg-base-200/50 text-left"
                            onClick={() =>
                              setExpandedCannibalization(
                                isExpanded ? null : group.keyword,
                              )
                            }
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {group.keyword}
                              </span>
                              <span className="badge badge-warning badge-xs">
                                {group.urls.length} URLs
                              </span>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="size-3.5" />
                            ) : (
                              <ChevronDown className="size-3.5" />
                            )}
                          </button>
                          {isExpanded && (
                            <div className="border-t border-base-200 overflow-x-auto">
                              <table className="table table-xs w-full">
                                <thead>
                                  <tr className="text-xs text-base-content/60">
                                    <th>URL</th>
                                    <th className="text-right">Posición</th>
                                    <th className="text-right">Clics</th>
                                    <th className="text-right">Impresiones</th>
                                    <th className="text-right">CTR</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.urls.map((u) => (
                                    <tr
                                      key={u.url}
                                      className="hover:bg-base-200/30"
                                    >
                                      <td className="max-w-[300px] truncate text-xs">
                                        {u.url}
                                      </td>
                                      <td className="text-right tabular-nums">
                                        {u.position ?? "—"}
                                      </td>
                                      <td className="text-right tabular-nums">
                                        {formatNumber(u.clicks)}
                                      </td>
                                      <td className="text-right tabular-nums">
                                        {formatNumber(u.impressions)}
                                      </td>
                                      <td className="text-right tabular-nums">
                                        {u.ctr != null
                                          ? `${u.ctr.toFixed(1)}%`
                                          : "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-8 text-center space-y-3">
              <Target className="size-12 mx-auto text-base-content/30" />
              <p className="text-lg font-medium text-base-content/70">
                Detecta tus keywords de oportunidad
              </p>
              <p className="text-sm text-base-content/50 max-w-lg mx-auto">
                Analiza tu dominio para encontrar keywords donde ya tienes
                visibilidad pero puedes mejorar. Usa DataForSEO para datos
                estimados, sube un CSV de Search Console, o conecta GSC
                directamente.
              </p>
            </div>
          )}

          {/* Análisis guardados */}
          {savedAnalyses.length > 0 && (
            <div className="mt-6">
              <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Save className="size-4 text-primary" />
                Análisis guardados ({savedAnalyses.length})
              </h2>
              <div className="space-y-2">
                {savedAnalyses.map((a) => (
                  <div
                    key={a.id}
                    className="border border-base-300 rounded-lg bg-base-100 px-4 py-3 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-medium text-sm">{a.domain}</span>
                      <span className="badge badge-ghost badge-xs ml-2 capitalize">
                        {a.source}
                      </span>
                      <span className="text-xs text-base-content/50 ml-2">
                        {a.totalOpportunities} oportunidades ·{" "}
                        {a.cannibalization.length} canibalizaciones
                      </span>
                      <span className="text-xs text-base-content/40 ml-2">
                        {new Date(a.savedAt).toLocaleDateString("es-ES")}
                      </span>
                    </div>
                    <button
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => deleteMutation.mutate(a.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers UI
// ---------------------------------------------------------------------------

function getScoreBadgeClass(score: number): string {
  if (score >= 60) return "badge-success";
  if (score >= 40) return "badge-warning";
  if (score >= 20) return "badge-info";
  return "badge-ghost";
}

function getTypeBadgeClass(type: string): string {
  switch (type) {
    case "near_top3":
      return "badge-success";
    case "second_page":
      return "badge-info";
    case "low_ctr":
      return "badge-warning";
    case "cannibalized":
      return "badge-error";
    default:
      return "badge-ghost";
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case "near_top3":
      return "Top 3";
    case "second_page":
      return "Pág 2";
    case "low_ctr":
      return "CTR↓";
    case "cannibalized":
      return "Canib.";
    default:
      return type;
  }
}

function LoadingState() {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="border border-base-300 rounded-lg bg-base-100 px-4 py-3 flex-1"
          >
            <div className="skeleton h-3 w-20 mb-2" />
            <div className="skeleton h-5 w-12" />
          </div>
        ))}
      </div>
      <div className="border border-base-300 rounded-xl bg-base-100 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 py-2">
            <div className="skeleton h-3 w-40" />
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-3 w-12" />
            <div className="skeleton h-3 w-12" />
            <div className="skeleton h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
