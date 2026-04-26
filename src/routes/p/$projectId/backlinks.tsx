// Página "Backlinks" — módulo que analiza el perfil de enlaces entrantes de
// un dominio/URL vía DataForSEO Backlinks API (4 endpoints Live agregados):
//   - Summary: totales, spam score, rank, distribuciones.
//   - Dominios referentes: lista con DR/TR, backlinks, primera vez.
//   - Backlinks: lista individual con filtros (follow, idioma, DR min).
//   - Anchors: distribución con detección de sobre-optimización.
//   - Tóxicos: sublist con score heurístico y exportación disavow.txt.

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import { useProjectContext } from "@/client/hooks/useProjectContext";
import {
  analyzeBacklinks,
  getBacklinksHistory,
  getBacklinksAnalysis,
  deleteBacklinksAnalysis,
} from "@/serverFunctions/backlinks";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import BacklinksForm, {
  type BacklinksFormParams,
} from "@/client/features/backlinks/BacklinksForm";
import BacklinksSummaryCards from "@/client/features/backlinks/BacklinksSummaryCards";
import BacklinksOverview from "@/client/features/backlinks/BacklinksOverview";
import ReferringDomainsTable from "@/client/features/backlinks/ReferringDomainsTable";
import BacklinksTable from "@/client/features/backlinks/BacklinksTable";
import AnchorsTable from "@/client/features/backlinks/AnchorsTable";
import ToxicBacklinksTable from "@/client/features/backlinks/ToxicBacklinksTable";
import BacklinksHistorySidebar from "@/client/features/backlinks/BacklinksHistorySidebar";
import type { BacklinksAnalysis } from "@/types/backlinks";

export const Route = createFileRoute("/p/$projectId/backlinks")({
  component: BacklinksPage,
});

// Tabs disponibles en la vista principal. Orden: resumen (default) → dominios
// → backlinks → anchors → tóxicos.
type TabKey = "overview" | "domains" | "backlinks" | "anchors" | "toxic";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Resumen" },
  { key: "domains", label: "Dominios referentes" },
  { key: "backlinks", label: "Backlinks" },
  { key: "anchors", label: "Anchors" },
  { key: "toxic", label: "Tóxicos" },
];

// oxlint-disable-next-line max-lines-per-function -- Página con múltiples queries/mutations + 5 tabs
function BacklinksPage() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();
  const { project } = useProjectContext(projectId);

  // Análisis actualmente abierto en la vista principal.
  const [currentAnalysis, setCurrentAnalysis] =
    useState<BacklinksAnalysis | null>(null);

  // Tab activa.
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // Query: historial de análisis del proyecto.
  const historyQuery = useQuery({
    queryKey: ["backlinksHistory", projectId],
    queryFn: () => getBacklinksHistory({ data: { projectId, limit: 50 } }),
  });

  // Mutación: lanzar un análisis nuevo (llama a los 4 endpoints + guarda).
  const runMutation = useMutation({
    mutationFn: (params: BacklinksFormParams) =>
      analyzeBacklinks({
        data: {
          projectId,
          target: params.target,
          includeSubdomains: params.includeSubdomains,
          backlinksLimit: params.backlinksLimit,
          domainsLimit: params.domainsLimit,
          anchorsLimit: params.anchorsLimit,
        },
      }),
    onSuccess: (analysis) => {
      setCurrentAnalysis(analysis);
      setActiveTab("overview");
      toast.success(
        `Análisis completado: ${analysis.totalBacklinks.toLocaleString("es-ES")} backlinks, ${analysis.totalReferringDomains.toLocaleString("es-ES")} dominios referentes.`,
      );
      void queryClient.invalidateQueries({
        queryKey: ["backlinksHistory", projectId],
      });
    },
    onError: (err) =>
      toast.error(
        getStandardErrorMessage(err, "Error al analizar los backlinks"),
      ),
  });

  // Mutación: cargar un análisis del historial.
  const loadMutation = useMutation({
    mutationFn: (id: string) => getBacklinksAnalysis({ data: { id } }),
    onSuccess: (analysis) => {
      setCurrentAnalysis(analysis);
      setActiveTab("overview");
    },
    onError: (err) =>
      toast.error(getStandardErrorMessage(err, "Error al cargar el análisis")),
  });

  // Mutación: borrar un análisis.
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBacklinksAnalysis({ data: { id } }),
    onSuccess: (_res, id) => {
      toast.success("Análisis eliminado.");
      if (currentAnalysis?.id === id) setCurrentAnalysis(null);
      void queryClient.invalidateQueries({
        queryKey: ["backlinksHistory", projectId],
      });
    },
    onError: (err) =>
      toast.error(getStandardErrorMessage(err, "Error al borrar el análisis")),
  });

  const handleRun = (params: BacklinksFormParams) => {
    runMutation.mutate(params);
  };

  const handleSelect = (id: string) => {
    if (currentAnalysis?.id === id) return;
    loadMutation.mutate(id);
  };

  const handleDelete = (id: string) => {
    // oxlint-disable-next-line no-alert -- Confirmación simple sin modal
    if (!confirm("¿Borrar este análisis? No se puede deshacer.")) return;
    deleteMutation.mutate(id);
  };

  const analyses = historyQuery.data?.analyses ?? [];
  const isRunning = runMutation.isPending;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 md:px-6 pt-4 pb-2 max-w-8xl mx-auto w-full">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Link2 className="size-5" />
            Backlinks
          </h1>
          <p className="text-sm text-base-content/60">
            Analiza el perfil de enlaces entrantes de cualquier dominio o URL:
            totales, dominios referentes, anchors, detección de backlinks
            tóxicos y exportación disavow.txt para Google Search Console.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
        <div className="mx-auto w-full max-w-8xl">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 mt-3">
            {/* Columna principal */}
            <div className="space-y-4">
              <BacklinksForm
                onRun={handleRun}
                isRunning={isRunning}
                defaultTarget={project?.domain ?? undefined}
              />

              {currentAnalysis ? (
                <>
                  <BacklinksSummaryCards summary={currentAnalysis.summary} />

                  {/* Tabs */}
                  <div className="border-b border-base-300">
                    <nav
                      className="flex gap-1 overflow-x-auto"
                      aria-label="Tabs"
                    >
                      {TABS.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setActiveTab(tab.key)}
                          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                            activeTab === tab.key
                              ? "border-primary text-primary"
                              : "border-transparent text-base-content/60 hover:text-base-content"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </nav>
                  </div>

                  {/* Contenido por tab */}
                  {activeTab === "overview" && (
                    <BacklinksOverview
                      summary={currentAnalysis.summary}
                      anchors={currentAnalysis.topAnchors}
                    />
                  )}
                  {activeTab === "domains" && (
                    <ReferringDomainsTable
                      domains={currentAnalysis.topDomains}
                    />
                  )}
                  {activeTab === "backlinks" && (
                    <BacklinksTable backlinks={currentAnalysis.backlinks} />
                  )}
                  {activeTab === "anchors" && (
                    <AnchorsTable anchors={currentAnalysis.topAnchors} />
                  )}
                  {activeTab === "toxic" && (
                    <ToxicBacklinksTable
                      backlinks={currentAnalysis.backlinks}
                      target={currentAnalysis.target}
                    />
                  )}
                </>
              ) : isRunning ? (
                <div className="border border-dashed border-base-300 rounded-xl p-8 text-center text-sm text-base-content/50">
                  Analizando backlinks... (se consultan 4 endpoints en paralelo,
                  tarda 10-30s)
                </div>
              ) : project?.domain ? (
                // CTA específico: el proyecto tiene dominio configurado.
                <div className="border border-primary/30 bg-primary/5 rounded-xl p-8 text-center space-y-3">
                  <Link2 className="size-10 mx-auto text-primary" />
                  <p className="text-lg font-semibold text-base-content">
                    Descubre quién enlaza a{" "}
                    <span className="font-mono text-primary">
                      {project.domain}
                    </span>
                  </p>
                  <p className="text-sm text-base-content/70 max-w-md mx-auto">
                    El dominio del proyecto ya está pre-rellenado en el form.
                    Pulsa &ldquo;Analizar backlinks&rdquo; para ver totales,
                    dominios referentes, anchors y backlinks tóxicos.
                  </p>
                </div>
              ) : (
                <div className="border border-dashed border-base-300 rounded-xl p-8 text-center text-sm text-base-content/50">
                  Analiza un dominio o selecciona un análisis del historial para
                  empezar.
                </div>
              )}
            </div>

            {/* Sidebar historial */}
            <BacklinksHistorySidebar
              analyses={analyses}
              selectedId={currentAnalysis?.id ?? null}
              onSelect={handleSelect}
              onDelete={handleDelete}
              isLoading={historyQuery.isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
