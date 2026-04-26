// Página "Reseñas Google" — módulo que descarga reseñas de un negocio vía
// DataForSEO Business Data Google Reviews y las visualiza:
//   - Summary card con rating medio, total y distribución inline.
//   - BarChart con distribución 1-5★.
//   - LineChart con evolución mensual (nº reseñas + rating medio).
//   - Calculadora de metas (cuántas reseñas 5★ para subir el rating).
//   - Lista de reseñas con filtro + búsqueda + sentiment highlight.
//   - Sidebar derecha: historial de análisis guardados.

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import {
  useProjectContext,
  extractCountryName,
} from "@/client/hooks/useProjectContext";
import {
  analyzeReviews,
  getReviewsHistory,
  getReviewAnalysis,
  deleteReviewAnalysis,
} from "@/serverFunctions/reviews";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import ReviewsForm, {
  type ReviewsFormParams,
} from "@/client/features/reviews/ReviewsForm";
import ReviewsSummaryCard from "@/client/features/reviews/ReviewsSummaryCard";
import ReviewsDistributionChart from "@/client/features/reviews/ReviewsDistributionChart";
import ReviewsTimelineChart from "@/client/features/reviews/ReviewsTimelineChart";
import ReviewsGoalCalculator from "@/client/features/reviews/ReviewsGoalCalculator";
import ReviewsList from "@/client/features/reviews/ReviewsList";
import ReviewsHistorySidebar from "@/client/features/reviews/ReviewsHistorySidebar";
import type { ReviewAnalysis } from "@/types/reviews";

export const Route = createFileRoute("/p/$projectId/reviews")({
  component: ReviewsPage,
});

// oxlint-disable-next-line max-lines-per-function -- Página con múltiples queries/mutations y layout
function ReviewsPage() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();
  // Contexto del proyecto: businessName + country + languageCode + placeId
  // pre-rellenan el form de ReviewsForm (el usuario puede editarlos).
  const { project } = useProjectContext(projectId);
  const countryName = extractCountryName(project?.locationName) ?? "Spain";

  // Análisis actualmente abierto en la vista principal.
  const [currentAnalysis, setCurrentAnalysis] = useState<ReviewAnalysis | null>(
    null,
  );

  // Query: historial de análisis del proyecto.
  const historyQuery = useQuery({
    queryKey: ["reviewsHistory", projectId],
    queryFn: () => getReviewsHistory({ data: { projectId, limit: 50 } }),
  });

  // Mutación: lanzar un análisis nuevo (llama a DataForSEO + guarda).
  const runMutation = useMutation({
    mutationFn: (params: ReviewsFormParams) =>
      analyzeReviews({
        data: {
          projectId,
          keyword: params.keyword,
          placeId: params.placeId,
          locationName: params.locationName,
          languageCode: params.languageCode,
          limit: params.limit,
        },
      }),
    onSuccess: (analysis) => {
      setCurrentAnalysis(analysis);
      toast.success(
        `Análisis completado: ${analysis.reviews.length} reseñas descargadas.`,
      );
      void queryClient.invalidateQueries({
        queryKey: ["reviewsHistory", projectId],
      });
    },
    onError: (err) =>
      toast.error(
        getStandardErrorMessage(err, "Error al analizar las reseñas"),
      ),
  });

  // Mutación: cargar un análisis del historial.
  const loadMutation = useMutation({
    mutationFn: (id: string) => getReviewAnalysis({ data: { id } }),
    onSuccess: (analysis) => setCurrentAnalysis(analysis),
    onError: (err) =>
      toast.error(getStandardErrorMessage(err, "Error al cargar el análisis")),
  });

  // Mutación: borrar un análisis.
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReviewAnalysis({ data: { id } }),
    onSuccess: (_res, id) => {
      toast.success("Análisis eliminado.");
      // Si el análisis abierto fue borrado, limpiamos la vista.
      if (currentAnalysis?.id === id) setCurrentAnalysis(null);
      void queryClient.invalidateQueries({
        queryKey: ["reviewsHistory", projectId],
      });
    },
    onError: (err) =>
      toast.error(getStandardErrorMessage(err, "Error al borrar el análisis")),
  });

  const handleRun = (params: ReviewsFormParams) => {
    runMutation.mutate(params);
  };

  const handleSelect = (id: string) => {
    if (currentAnalysis?.id === id) return;
    loadMutation.mutate(id);
  };

  const handleDelete = (id: string) => {
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
            <MessageSquare className="size-5" />
            Reseñas Google
          </h1>
          <p className="text-sm text-base-content/60">
            Descarga y analiza las reseñas de Google Maps / Google Business
            Profile de cualquier negocio: distribución de ratings, evolución
            mensual, calculadora de metas y sentiment analysis.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
        <div className="mx-auto w-full max-w-8xl">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 mt-3">
            {/* Columna principal */}
            <div className="space-y-4">
              <ReviewsForm
                onRun={handleRun}
                isRunning={isRunning}
                defaultKeyword={project?.businessName ?? undefined}
                defaultPlaceId={project?.placeId ?? undefined}
                defaultLocationName={countryName}
                defaultLanguageCode={project?.languageCode ?? undefined}
              />

              {currentAnalysis ? (
                <>
                  <ReviewsSummaryCard
                    businessName={
                      currentAnalysis.businessName ?? currentAnalysis.keyword
                    }
                    totalReviews={currentAnalysis.totalReviews}
                    avgRating={currentAnalysis.avgRating}
                    ratingDistribution={currentAnalysis.ratingDistribution}
                  />

                  {/* Charts grid: distribución + timeline */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ReviewsDistributionChart
                      distribution={currentAnalysis.ratingDistribution}
                    />
                    <ReviewsTimelineChart reviews={currentAnalysis.reviews} />
                  </div>

                  {/* Calculadora de metas */}
                  <ReviewsGoalCalculator
                    currentTotal={currentAnalysis.totalReviews}
                    currentAvg={currentAnalysis.avgRating}
                  />

                  {/* Lista de reseñas */}
                  <ReviewsList reviews={currentAnalysis.reviews} />
                </>
              ) : isRunning ? (
                <div className="border border-dashed border-base-300 rounded-xl p-8 text-center text-sm text-base-content/50">
                  Analizando reseñas... (la primera vez tarda 20-60s por el task
                  async de DataForSEO)
                </div>
              ) : project?.businessName ? (
                // CTA específico: el proyecto tiene businessName configurado.
                <div className="border border-primary/30 bg-primary/5 rounded-xl p-8 text-center space-y-3">
                  <MessageSquare className="size-10 mx-auto text-primary" />
                  <p className="text-lg font-semibold text-base-content">
                    Analiza las reseñas de{" "}
                    <span className="text-primary">{project.businessName}</span>
                  </p>
                  <p className="text-sm text-base-content/70 max-w-md mx-auto">
                    Rellena el formulario de arriba (ya pre-rellenado con los
                    datos del proyecto) y pulsa &ldquo;Analizar reseñas&rdquo;
                    para obtener distribución, evolución y sentiment.
                  </p>
                </div>
              ) : (
                <div className="border border-dashed border-base-300 rounded-xl p-8 text-center text-sm text-base-content/50">
                  Analiza un negocio o selecciona un análisis del historial para
                  empezar.
                </div>
              )}
            </div>

            {/* Sidebar historial */}
            <ReviewsHistorySidebar
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
