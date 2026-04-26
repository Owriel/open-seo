// Página "Geo-Grid Rank Tracker" (tipo Local Falcon).
// Flujo en dos pasos:
//   1) BusinessPicker — busca y selecciona el negocio objetivo en Google Maps.
//   2) LocalGridForm — define keyword, tamaño y radio del grid para ese negocio.
// Al terminar el scan, se renderiza el mapa de Google Maps con los puntos
// coloreados por posición. Cada marker es clickable: abre un InfoWindow con
// la tabla Top 5 de esa ubicación, resaltando el target.

import { createFileRoute } from "@tanstack/react-router";
import { useState, lazy, Suspense } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Grid3x3, Star, Globe, RefreshCw } from "lucide-react";
import { useProjectContext } from "@/client/hooks/useProjectContext";
import {
  runGridScan,
  getGridHistory,
  getGridScan,
  deleteGridScan,
} from "@/serverFunctions/localGrid";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import LocalGridForm, {
  type GridScanParams,
  type PrefilledBusiness,
} from "@/client/features/localGrid/LocalGridForm";
import LocalGridStats from "@/client/features/localGrid/LocalGridStats";
import LocalGridHistory from "@/client/features/localGrid/LocalGridHistory";
import LocalGridLegend from "@/client/features/localGrid/LocalGridLegend";
import BusinessPicker from "@/client/features/localGrid/BusinessPicker";
import type { BusinessSearchResult, GridScan } from "@/types/localGrid";

// Google Maps usa window.google; lazy-loading para no romper SSR y para
// no cargar la API hasta que el usuario tenga un scan activo.
const LocalGridMap = lazy(
  () => import("@/client/features/localGrid/LocalGridMap"),
);

export const Route = createFileRoute("/p/$projectId/local-grid")({
  component: LocalGridPage,
});

// Transforma el resultado del BusinessPicker al shape que consume el form.
// Exige lat/lng válidos; si el negocio no trae coords, no avanzamos.
function toPrefilled(biz: BusinessSearchResult): PrefilledBusiness | null {
  if (biz.latitude == null || biz.longitude == null) return null;
  return {
    businessName: biz.businessName,
    domain: biz.domain,
    placeId: biz.placeId,
    latitude: biz.latitude,
    longitude: biz.longitude,
    // Reusamos address como etiqueta de ubicación humana.
    locationName: biz.address ?? biz.businessName,
    languageCode: "es",
  };
}

// oxlint-disable-next-line max-lines-per-function -- Página con lógica de scan, historial y mapa
function LocalGridPage() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();
  // Contexto del proyecto: rellenaremos los defaults del BusinessPicker y,
  // si el proyecto tiene info suficiente (businessName + locationName),
  // auto-disparamos la búsqueda la primera vez para acortar el flujo.
  const { project } = useProjectContext(projectId);

  // Negocio objetivo seleccionado (paso 1). Si está null, mostramos Picker.
  const [selectedBusiness, setSelectedBusiness] =
    useState<PrefilledBusiness | null>(null);

  // Scan actual mostrado en el mapa. Lo rellenamos al terminar un runGridScan
  // o al seleccionar uno del historial.
  const [currentScan, setCurrentScan] = useState<GridScan | null>(null);

  // Historial del proyecto.
  const historyQuery = useQuery({
    queryKey: ["localGridHistory", projectId],
    queryFn: () => getGridHistory({ data: { projectId, limit: 50 } }),
  });

  // Mutación: ejecutar un nuevo scan.
  const runMutation = useMutation({
    mutationFn: (params: GridScanParams) =>
      runGridScan({
        data: {
          projectId,
          keyword: params.keyword,
          targetDomain: params.targetDomain,
          targetPlaceId: params.targetPlaceId,
          businessName: params.businessName,
          centerLat: params.centerLat,
          centerLng: params.centerLng,
          gridSize: params.gridSize,
          radiusKm: params.radiusKm,
          languageCode: params.languageCode,
          locationName: params.locationName,
        },
      }),
    onSuccess: (scan) => {
      setCurrentScan(scan);
      const found = scan.points.filter((p) => p.position != null).length;
      toast.success(
        `Scan completado: ${found}/${scan.points.length} puntos donde aparece.`,
      );
      void queryClient.invalidateQueries({
        queryKey: ["localGridHistory", projectId],
      });
    },
    onError: (err) =>
      toast.error(getStandardErrorMessage(err, "Error al ejecutar el scan")),
  });

  // Mutación: cargar un scan del historial al mapa.
  const loadScanMutation = useMutation({
    mutationFn: (scanId: string) => getGridScan({ data: { scanId } }),
    onSuccess: (scan) => {
      setCurrentScan(scan);
      // Al cargar un scan histórico, reconstruimos el negocio para que el
      // form quede con los mismos datos por si quiere re-lanzarlo.
      setSelectedBusiness({
        businessName: scan.businessName ?? scan.targetDomain,
        domain: scan.targetDomain || null,
        placeId: scan.targetPlaceId,
        latitude: scan.centerLat,
        longitude: scan.centerLng,
        locationName: scan.locationName ?? scan.targetDomain,
        languageCode: scan.languageCode,
      });
    },
    onError: (err) =>
      toast.error(getStandardErrorMessage(err, "Error al cargar el scan")),
  });

  // Mutación: borrar un scan del historial.
  const deleteMutation = useMutation({
    mutationFn: (scanId: string) => deleteGridScan({ data: { scanId } }),
    onSuccess: (_res, scanId) => {
      toast.success("Scan eliminado.");
      // Si borramos el que estaba abierto, limpiamos el mapa.
      if (currentScan?.id === scanId) setCurrentScan(null);
      void queryClient.invalidateQueries({
        queryKey: ["localGridHistory", projectId],
      });
    },
    onError: (err) =>
      toast.error(getStandardErrorMessage(err, "Error al borrar el scan")),
  });

  const handleSelectBusiness = (biz: BusinessSearchResult) => {
    const prefilled = toPrefilled(biz);
    if (!prefilled) {
      toast.error(
        "Este negocio no tiene coordenadas en Google Maps. Elige otro.",
      );
      return;
    }
    setSelectedBusiness(prefilled);
    // Al cambiar de negocio limpiamos el scan actual (si había uno cargado).
    setCurrentScan(null);
  };

  const handleChangeBusiness = () => {
    setSelectedBusiness(null);
    setCurrentScan(null);
  };

  const handleRun = (params: GridScanParams) => {
    runMutation.mutate(params);
  };

  const handleSelectScan = (scanId: string) => {
    // Evitamos recargar el mismo scan.
    if (currentScan?.id === scanId) return;
    loadScanMutation.mutate(scanId);
  };

  const handleDeleteScan = (scanId: string) => {
    if (!confirm("¿Borrar este scan? No se puede deshacer.")) return;
    deleteMutation.mutate(scanId);
  };

  const scans = historyQuery.data?.scans ?? [];
  const isRunningScan = runMutation.isPending;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 md:px-6 pt-4 pb-2 max-w-8xl mx-auto w-full">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Grid3x3 className="size-5" />
            Geo-Grid Rank Tracker
          </h1>
          <p className="text-sm text-base-content/60">
            Visualiza cómo posiciona tu negocio en Google Maps Local Finder
            desde múltiples ubicaciones GPS a la vez.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
        <div className="mx-auto w-full max-w-8xl">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 mt-3">
            {/* Columna principal: picker → form + stats + mapa */}
            <div className="space-y-4">
              {/* Paso 1: picker (oculto cuando ya hay negocio elegido).
                   Pre-rellenamos con businessName + locationName del proyecto
                   para que el usuario sólo pulse "Buscar" la primera vez. */}
              {!selectedBusiness && (
                <BusinessPicker
                  onSelect={handleSelectBusiness}
                  defaultQuery={project?.businessName ?? undefined}
                  defaultLocationName={project?.locationName ?? undefined}
                  defaultLanguageCode={project?.languageCode ?? undefined}
                />
              )}

              {/* Cabecera compacta del negocio seleccionado */}
              {selectedBusiness && (
                <div className="border border-primary/30 bg-primary/5 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 flex-wrap text-sm min-w-0">
                    <span className="font-semibold text-base">
                      Negocio objetivo: {selectedBusiness.businessName}
                    </span>
                    {selectedBusiness.domain && (
                      <span className="inline-flex items-center gap-1 text-xs text-base-content/70">
                        <Globe className="size-3" />
                        {selectedBusiness.domain}
                      </span>
                    )}
                    {selectedBusiness.placeId && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-base-content/50 font-mono">
                        <Star className="size-3" />
                        {selectedBusiness.placeId.slice(0, 24)}…
                      </span>
                    )}
                    <span className="text-[10px] text-base-content/50 tabular-nums">
                      {selectedBusiness.latitude.toFixed(5)},{" "}
                      {selectedBusiness.longitude.toFixed(5)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleChangeBusiness}
                    className="btn btn-ghost btn-xs gap-1"
                  >
                    <RefreshCw className="size-3" />
                    Cambiar negocio
                  </button>
                </div>
              )}

              {/* Paso 2: form del scan */}
              {selectedBusiness && (
                <LocalGridForm
                  business={selectedBusiness}
                  onRun={handleRun}
                  isRunning={isRunningScan}
                  defaultKeyword={project?.targetKeyword ?? undefined}
                />
              )}

              {currentScan ? (
                <>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-sm">
                      <strong className="text-base">
                        {currentScan.keyword}
                      </strong>
                      <span className="text-base-content/60"> · </span>
                      <span className="text-base-content/70">
                        {currentScan.businessName ?? currentScan.targetDomain}
                      </span>
                      {currentScan.locationName && (
                        <>
                          <span className="text-base-content/60"> · </span>
                          <span className="text-base-content/60 text-xs">
                            {currentScan.locationName}
                          </span>
                        </>
                      )}
                    </div>
                    <LocalGridLegend />
                  </div>

                  <LocalGridStats points={currentScan.points} />

                  <Suspense
                    fallback={
                      <div className="w-full h-[500px] rounded-xl border border-base-300 bg-base-200 flex items-center justify-center">
                        <span className="loading loading-spinner loading-md" />
                      </div>
                    }
                  >
                    <LocalGridMap
                      centerLat={currentScan.centerLat}
                      centerLng={currentScan.centerLng}
                      points={currentScan.points}
                      gridSize={currentScan.gridSize}
                      radiusKm={currentScan.radiusKm}
                      targetDomain={currentScan.targetDomain}
                      targetPlaceId={currentScan.targetPlaceId}
                    />
                  </Suspense>
                </>
              ) : (
                selectedBusiness && (
                  <div className="border border-dashed border-base-300 rounded-xl p-8 text-center text-sm text-base-content/50">
                    {isRunningScan
                      ? "Ejecutando scan... (puede tardar ~30-60s para un 7x7)"
                      : "Ejecuta un scan para ver el mapa, o selecciona uno del historial."}
                  </div>
                )
              )}
            </div>

            {/* Sidebar derecha: historial */}
            <LocalGridHistory
              scans={scans}
              selectedId={currentScan?.id ?? null}
              onSelect={handleSelectScan}
              onDelete={handleDeleteScan}
              isLoading={historyQuery.isLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
