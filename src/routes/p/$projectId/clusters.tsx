import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import {
  Search,
  Network,
  ChevronDown,
  ChevronUp,
  FileDown,
  Save,
  Trash2,
} from "lucide-react";
import { generateClusters, saveClusterPlan, getClusterPlans, deleteClusterPlan } from "@/serverFunctions/clusters";
import type { ClusterGroup, ClusterPlan } from "@/types/clusters";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  LOCATIONS,
  getLanguageCode,
  formatNumber,
  csvEscape,
  getPriorityTier,
  priorityTierClass,
} from "@/client/features/keywords/utils";
import { useEffect, useCallback } from "react";

export const Route = createFileRoute("/p/$projectId/clusters")({
  component: ClustersPage,
});

function ClustersPage() {
  const { projectId } = Route.useParams();
  const [keyword, setKeyword] = useState("");
  const [locationCode, setLocationCode] = useState(2724);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [savedPlans, setSavedPlans] = useState<ClusterPlan[]>([]);
  const [planName, setPlanName] = useState("");

  // Cargar planes guardados
  const loadPlans = useCallback(async () => {
    try {
      const result = await getClusterPlans({ data: { projectId } });
      setSavedPlans(result.plans);
    } catch {
      // silencioso en carga inicial
    }
  }, [projectId]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const clusterMutation = useMutation({
    mutationFn: (data: { keyword: string; locationCode: number; languageCode: string }) =>
      generateClusters({ data }),
  });

  const saveMutation = useMutation({
    mutationFn: (data: { projectId: string; name: string; pillarKeyword: string; clusters: ClusterGroup[] }) =>
      saveClusterPlan({ data }),
    onSuccess: () => {
      toast.success("Plan guardado");
      setPlanName("");
      void loadPlans();
    },
    onError: (err) => toast.error(getStandardErrorMessage(err, "Error al guardar")),
  });

  const deleteMutation = useMutation({
    mutationFn: (data: { projectId: string; planId: string }) =>
      deleteClusterPlan({ data }),
    onSuccess: () => {
      toast.success("Plan eliminado");
      void loadPlans();
    },
  });

  const clusters = clusterMutation.data?.clusters ?? [];
  const pillarKeyword = clusterMutation.data?.pillarKeyword ?? "";

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) {
      toast.error("Introduce una keyword semilla");
      return;
    }
    setExpandedCluster(null);
    clusterMutation.mutate({
      keyword: keyword.trim().toLowerCase(),
      locationCode,
      languageCode: getLanguageCode(locationCode),
    });
  };

  const handleSavePlan = () => {
    if (clusters.length === 0) return;
    const name = planName.trim() || `Cluster: ${pillarKeyword}`;
    saveMutation.mutate({
      projectId,
      name,
      pillarKeyword,
      clusters,
    });
  };

  const handleExportCsv = () => {
    if (clusters.length === 0) return;
    const headers = ["Cluster", "Keyword", "Volumen", "KD", "CPC", "Prioridad"];
    const rows: string[] = [];
    for (const c of clusters) {
      for (const kw of c.keywords) {
        rows.push(
          [
            csvEscape(c.name),
            csvEscape(kw.keyword),
            kw.searchVolume ?? "",
            kw.keywordDifficulty ?? "",
            kw.cpc?.toFixed(2) ?? "",
            kw.priority ?? "",
          ].join(","),
        );
      }
    }
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `clusters-${pillarKeyword.replace(/\s+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 md:px-6 pt-4 pb-2 max-w-8xl mx-auto w-full">
        <h1 className="text-xl font-bold mb-1">Topic Clusters</h1>
        <p className="text-sm text-base-content/60 mb-3">
          Genera clusters de keywords a partir de una semilla para planificar tu estrategia de contenido.
        </p>

        <form
          className="bg-base-100 border border-base-300 rounded-xl px-4 py-3 flex flex-wrap items-center gap-2"
          onSubmit={handleGenerate}
        >
          <label className="input input-bordered input-sm flex items-center gap-2 flex-1 min-w-0 max-w-md">
            <Search className="size-3.5 shrink-0 text-base-content/50" />
            <input
              className="grow min-w-0"
              placeholder="Keyword semilla (ej: reformas valencia)"
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
            disabled={clusterMutation.isPending}
          >
            {clusterMutation.isPending ? "Generando..." : "Generar Clusters"}
          </button>
        </form>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
        <div className="mx-auto w-full max-w-8xl">
          {clusterMutation.isPending ? (
            <LoadingState />
          ) : clusterMutation.isError ? (
            <div className="mt-4 rounded-xl border border-error/30 bg-error/10 p-5 text-error">
              <p className="text-sm">{getStandardErrorMessage(clusterMutation.error, "Error generando clusters")}</p>
              <button className="btn btn-sm mt-2" onClick={() => clusterMutation.reset()}>
                Reintentar
              </button>
            </div>
          ) : clusters.length > 0 ? (
            <div className="mt-4 space-y-4">
              {/* Pillar + actions */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="badge badge-primary badge-lg capitalize">{pillarKeyword}</span>
                  <span className="text-sm text-base-content/60 ml-2">
                    {clusters.length} clusters · {clusters.reduce((s, c) => s + c.count, 0)} keywords
                  </span>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-ghost btn-sm gap-1" onClick={handleExportCsv}>
                    <FileDown className="size-3.5" />
                    CSV
                  </button>
                </div>
              </div>

              {/* Save plan */}
              <div className="flex items-center gap-2">
                <input
                  className="input input-bordered input-sm flex-1 max-w-xs"
                  placeholder="Nombre del plan (opcional)"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                />
                <button
                  className="btn btn-sm btn-success gap-1"
                  onClick={handleSavePlan}
                  disabled={saveMutation.isPending}
                >
                  <Save className="size-3.5" />
                  Guardar plan
                </button>
              </div>

              {/* Cluster cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {clusters.map((cluster) => {
                  const isExpanded = expandedCluster === cluster.name;
                  const tier = getPriorityTier(cluster.avgPriority);
                  const tierClass = priorityTierClass(tier);
                  return (
                    <div
                      key={cluster.name}
                      className="border border-base-300 rounded-xl bg-base-100 overflow-hidden"
                    >
                      <button
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-base-200/50 text-left"
                        onClick={() => setExpandedCluster(isExpanded ? null : cluster.name)}
                      >
                        <div>
                          <div className="font-medium text-sm capitalize flex items-center gap-2">
                            {cluster.name}
                            <span className="badge badge-xs badge-ghost">{cluster.count}</span>
                          </div>
                          <div className="flex gap-3 mt-1 text-xs text-base-content/50">
                            <span>Vol: {formatNumber(cluster.totalVolume)}</span>
                            <span>KD: {cluster.avgDifficulty}</span>
                            <span>CPC: ${cluster.avgCpc.toFixed(2)}</span>
                            <span className={`badge badge-xs ${tierClass}`}>{cluster.avgPriority}</span>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </button>

                      {isExpanded && (
                        <div className="border-t border-base-200 overflow-x-auto">
                          <table className="table table-xs w-full">
                            <thead>
                              <tr className="text-xs text-base-content/60">
                                <th>Keyword</th>
                                <th className="text-right">Vol</th>
                                <th className="text-right">KD</th>
                                <th className="text-right">CPC</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cluster.keywords.map((kw) => (
                                <tr key={kw.keyword} className="hover:bg-base-200/30">
                                  <td className="capitalize max-w-[200px] truncate">{kw.keyword}</td>
                                  <td className="text-right tabular-nums">{formatNumber(kw.searchVolume)}</td>
                                  <td className="text-right tabular-nums">{kw.keywordDifficulty ?? "-"}</td>
                                  <td className="text-right tabular-nums">
                                    {kw.cpc != null ? `$${kw.cpc.toFixed(2)}` : "-"}
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
          ) : !clusterMutation.data ? (
            <div className="mt-8 text-center space-y-3">
              <Network className="size-12 mx-auto text-base-content/30" />
              <p className="text-lg font-medium text-base-content/70">
                Introduce una keyword semilla para generar clusters
              </p>
              <p className="text-sm text-base-content/50 max-w-md mx-auto">
                Buscaremos keywords relacionadas y las agruparemos en clusters temáticos
                para planificar tu estrategia de contenido.
              </p>
            </div>
          ) : null}

          {/* Planes guardados */}
          {savedPlans.length > 0 && (
            <div className="mt-6">
              <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Save className="size-4 text-primary" />
                Planes guardados ({savedPlans.length})
              </h2>
              <div className="space-y-2">
                {savedPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="border border-base-300 rounded-lg bg-base-100 px-4 py-3 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-medium text-sm">{plan.name}</span>
                      <span className="text-xs text-base-content/50 ml-2">
                        {plan.clusters.length} clusters · {plan.clusters.reduce((s, c) => s + c.count, 0)} keywords
                      </span>
                      <span className="text-xs text-base-content/40 ml-2">
                        {new Date(plan.savedAt).toLocaleDateString("es-ES")}
                      </span>
                    </div>
                    <button
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => deleteMutation.mutate({ projectId, planId: plan.id })}
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

function LoadingState() {
  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="border border-base-300 rounded-xl bg-base-100 p-4">
          <div className="skeleton h-4 w-32 mb-2" />
          <div className="flex gap-3">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton h-3 w-12" />
            <div className="skeleton h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
