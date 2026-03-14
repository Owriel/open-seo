import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Plus,
  Trash2,
  Trophy,
  AlertTriangle,
  Target,
  FileDown,
} from "lucide-react";
import {
  getTrackedKeywords,
  addTrackedKeywords,
  removeTrackedKeyword,
  checkRankings,
} from "@/serverFunctions/tracker";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  LOCATIONS,
  getLanguageCode,
  formatNumber,
  csvEscape,
} from "@/client/features/keywords/utils";

export const Route = createFileRoute("/p/$projectId/tracker")({
  component: TrackerPage,
});

function TrackerPage() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();

  // Form state for adding keywords
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKeywords, setNewKeywords] = useState("");
  const [trackDomain, setTrackDomain] = useState("");
  const [locationCode, setLocationCode] = useState(2724);

  // Query tracked keywords
  const keywordsQuery = useQuery({
    queryKey: ["trackedKeywords", projectId],
    queryFn: () => getTrackedKeywords({ data: { projectId } }),
  });

  const tracked = keywordsQuery.data?.keywords ?? [];

  // Mutations
  const addMutation = useMutation({
    mutationFn: (data: { projectId: string; keywords: string[]; domain: string; locationCode: number; languageCode: string }) =>
      addTrackedKeywords({ data }),
    onSuccess: (result) => {
      toast.success(`${result.added} keywords añadidas al tracker`);
      setShowAddForm(false);
      setNewKeywords("");
      void queryClient.invalidateQueries({ queryKey: ["trackedKeywords", projectId] });
    },
    onError: (err) => toast.error(getStandardErrorMessage(err, "Error al añadir")),
  });

  const removeMutation = useMutation({
    mutationFn: (data: { trackedKeywordId: string }) =>
      removeTrackedKeyword({ data }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["trackedKeywords", projectId] });
    },
  });

  const checkMutation = useMutation({
    mutationFn: () => checkRankings({ data: { projectId } }),
    onSuccess: (result) => {
      toast.success(`${result.checked} posiciones actualizadas${result.errors > 0 ? ` (${result.errors} errores)` : ""}`);
      void queryClient.invalidateQueries({ queryKey: ["trackedKeywords", projectId] });
    },
    onError: (err) => toast.error(getStandardErrorMessage(err, "Error al comprobar posiciones")),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const keywords = newKeywords
      .split(/[\n,]/)
      .map((k) => k.trim())
      .filter(Boolean);
    if (keywords.length === 0) {
      toast.error("Introduce al menos una keyword");
      return;
    }
    if (!trackDomain.trim()) {
      toast.error("Introduce el dominio a monitorizar");
      return;
    }
    addMutation.mutate({
      projectId,
      keywords,
      domain: trackDomain.trim(),
      locationCode,
      languageCode: getLanguageCode(locationCode),
    });
  };

  const handleExportCsv = () => {
    if (tracked.length === 0) return;
    const headers = ["Keyword", "Dominio", "Posición Actual", "Posición Anterior", "Cambio", "Mejor Posición", "URL", "Último Check"];
    const csvRows = tracked.map((k) =>
      [
        csvEscape(k.keyword),
        csvEscape(k.domain),
        k.currentPosition ?? "",
        k.previousPosition ?? "",
        k.change ?? "",
        k.bestPosition ?? "",
        csvEscape(k.rankingUrl ?? ""),
        k.lastChecked ?? "",
      ].join(","),
    );
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rank-tracker.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  // Stats
  const ups = tracked.filter((k) => k.change != null && k.change > 0).length;
  const downs = tracked.filter((k) => k.change != null && k.change < 0).length;
  const top3 = tracked.filter((k) => k.currentPosition != null && k.currentPosition <= 3).length;
  const top10 = tracked.filter((k) => k.currentPosition != null && k.currentPosition <= 10).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 md:px-6 pt-4 pb-2 max-w-8xl mx-auto w-full">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold">Rank Tracker</h1>
            <p className="text-sm text-base-content/60">
              Monitoriza las posiciones de tus keywords en Google.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-sm btn-outline gap-1"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="size-3.5" />
              Añadir Keywords
            </button>
            <button
              className="btn btn-sm btn-primary gap-1"
              onClick={() => checkMutation.mutate()}
              disabled={checkMutation.isPending || tracked.length === 0}
            >
              <RefreshCw className={`size-3.5 ${checkMutation.isPending ? "animate-spin" : ""}`} />
              {checkMutation.isPending ? "Comprobando..." : "Actualizar Posiciones"}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
        <div className="mx-auto w-full max-w-8xl">
          {/* Stats cards */}
          {tracked.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div className="border border-base-300 rounded-lg bg-base-100 p-3 text-center">
                <p className="text-2xl font-bold text-success">{ups}</p>
                <p className="text-xs text-base-content/50 flex items-center justify-center gap-1">
                  <TrendingUp className="size-3" /> Subidas
                </p>
              </div>
              <div className="border border-base-300 rounded-lg bg-base-100 p-3 text-center">
                <p className="text-2xl font-bold text-error">{downs}</p>
                <p className="text-xs text-base-content/50 flex items-center justify-center gap-1">
                  <TrendingDown className="size-3" /> Bajadas
                </p>
              </div>
              <div className="border border-base-300 rounded-lg bg-base-100 p-3 text-center">
                <p className="text-2xl font-bold text-warning">{top3}</p>
                <p className="text-xs text-base-content/50 flex items-center justify-center gap-1">
                  <Trophy className="size-3" /> Top 3
                </p>
              </div>
              <div className="border border-base-300 rounded-lg bg-base-100 p-3 text-center">
                <p className="text-2xl font-bold text-info">{top10}</p>
                <p className="text-xs text-base-content/50 flex items-center justify-center gap-1">
                  <Target className="size-3" /> Top 10
                </p>
              </div>
            </div>
          )}

          {/* Add keyword form */}
          {showAddForm && (
            <div className="mt-4 border border-primary/30 rounded-xl bg-base-100 p-4">
              <h3 className="font-semibold text-sm mb-3">Añadir Keywords al Tracker</h3>
              <form onSubmit={handleAdd} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="form-control">
                    <span className="label-text text-xs mb-1">Dominio a monitorizar</span>
                    <input
                      className="input input-bordered input-sm"
                      placeholder="tuempresa.es"
                      value={trackDomain}
                      onChange={(e) => setTrackDomain(e.target.value)}
                    />
                  </label>
                  <label className="form-control">
                    <span className="label-text text-xs mb-1">País</span>
                    <select
                      className="select select-bordered select-sm"
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
                  </label>
                </div>
                <label className="form-control">
                  <span className="label-text text-xs mb-1">Keywords (una por línea o separadas por coma)</span>
                  <textarea
                    className="textarea textarea-bordered textarea-sm h-24"
                    placeholder="reformas terrassa&#10;fontanero terrassa&#10;empresa reformas barcelona"
                    value={newKeywords}
                    onChange={(e) => setNewKeywords(e.target.value)}
                  />
                </label>
                <div className="flex gap-2 justify-end">
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowAddForm(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-sm btn-primary" disabled={addMutation.isPending}>
                    {addMutation.isPending ? "Añadiendo..." : "Añadir"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Keywords table */}
          {keywordsQuery.isLoading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : tracked.length === 0 ? (
            <div className="mt-12 text-center space-y-3">
              <TrendingUp className="size-12 mx-auto text-base-content/30" />
              <p className="text-lg font-medium text-base-content/70">
                No hay keywords en seguimiento
              </p>
              <p className="text-sm text-base-content/50 max-w-md mx-auto">
                Añade keywords para monitorizar su posición en Google. Puedes importarlas
                desde Keywords Guardadas o añadirlas manualmente.
              </p>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="size-3.5" />
                Añadir Keywords
              </button>
            </div>
          ) : (
            <div className="mt-4 border border-base-300 rounded-xl bg-base-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
                <span className="text-sm font-semibold">
                  {tracked.length} keywords monitorizadas
                </span>
                <button
                  className="btn btn-ghost btn-xs gap-1"
                  onClick={handleExportCsv}
                >
                  <FileDown className="size-3.5" />
                  CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="table table-sm w-full">
                  <thead>
                    <tr className="text-xs text-base-content/60">
                      <th>Keyword</th>
                      <th>Dominio</th>
                      <th className="text-center">Posición</th>
                      <th className="text-center">Cambio</th>
                      <th className="text-center">Mejor</th>
                      <th className="text-right">URL</th>
                      <th className="text-right">Último Check</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tracked.map((kw) => (
                      <tr key={kw.id} className="hover:bg-base-200/50">
                        <td className="font-medium capitalize">{kw.keyword}</td>
                        <td className="text-base-content/60 text-xs">{kw.domain}</td>
                        <td className="text-center">
                          {kw.currentPosition ? (
                            <span className={`badge badge-sm ${
                              kw.currentPosition <= 3 ? "badge-success" :
                              kw.currentPosition <= 10 ? "badge-warning" :
                              kw.currentPosition <= 20 ? "badge-info" : "badge-ghost"
                            }`}>
                              #{kw.currentPosition}
                            </span>
                          ) : (
                            <span className="text-base-content/30 text-xs">Sin datos</span>
                          )}
                        </td>
                        <td className="text-center">
                          {kw.change != null ? (
                            kw.change > 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-success text-xs font-medium">
                                <TrendingUp className="size-3" />+{kw.change}
                                {kw.change >= 5 && <span className="ml-0.5">🚀</span>}
                              </span>
                            ) : kw.change < 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-error text-xs font-medium">
                                <TrendingDown className="size-3" />{kw.change}
                                {kw.change <= -5 && <AlertTriangle className="size-3 ml-0.5" />}
                              </span>
                            ) : (
                              <Minus className="size-3 mx-auto text-base-content/30" />
                            )
                          ) : (
                            <span className="text-base-content/30 text-xs">—</span>
                          )}
                        </td>
                        <td className="text-center">
                          {kw.bestPosition ? (
                            <span className="text-xs tabular-nums">
                              #{kw.bestPosition}
                              {kw.bestPosition <= 3 && <Trophy className="size-3 inline ml-0.5 text-warning" />}
                            </span>
                          ) : (
                            <span className="text-base-content/30">—</span>
                          )}
                        </td>
                        <td className="text-right max-w-[200px] truncate text-xs text-base-content/50" title={kw.rankingUrl ?? ""}>
                          {kw.rankingUrl ?? "—"}
                        </td>
                        <td className="text-right text-xs text-base-content/40">
                          {kw.lastChecked
                            ? new Date(kw.lastChecked).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                            : "Nunca"}
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost btn-xs text-error"
                            onClick={() => removeMutation.mutate({ trackedKeywordId: kw.id })}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
