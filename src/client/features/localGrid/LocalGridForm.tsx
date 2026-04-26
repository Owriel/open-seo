// Formulario del Geo-Grid (Paso 2). El negocio objetivo ya viene
// pre-seleccionado del BusinessPicker: centro, dominio, place_id y
// businessName están resueltos. Aquí el usuario sólo define keyword
// de búsqueda, tamaño/radio del grid y el idioma.
//
// Si el negocio no tiene website, permitimos editar manualmente el
// campo `targetDomain` (fallback cuando sólo hay place_id fuerte).

import { useEffect, useState } from "react";
import { Search, Loader2, AlertTriangle, Edit3 } from "lucide-react";

export type GridScanParams = {
  keyword: string;
  targetDomain: string;
  targetPlaceId: string | null;
  businessName: string | null;
  centerLat: number;
  centerLng: number;
  gridSize: 3 | 5 | 7;
  radiusKm: number;
  languageCode: string;
  locationName: string;
};

// Datos pre-rellenados del negocio objetivo (vienen del BusinessPicker).
export type PrefilledBusiness = {
  businessName: string;
  domain: string | null;
  placeId: string | null;
  latitude: number;
  longitude: number;
  locationName: string;
  // Idioma sugerido (propagado desde el Picker).
  languageCode: string;
};

type Props = {
  // Negocio ya elegido en el paso 1.
  business: PrefilledBusiness;
  onRun: (params: GridScanParams) => void;
  isRunning: boolean;
  // Keyword pre-rellenada (opcional). Si viene, aparece por defecto en el
  // input (el usuario puede cambiarla). Útil para auto-sugerir la keyword
  // configurada en el proyecto sin forzarla.
  defaultKeyword?: string;
};

// Coste aproximado por llamada a DataForSEO Google Maps Live Advanced (USD).
// Fuente: tabla de precios DataForSEO. Sirve para estimación indicativa.
const COST_PER_CALL_USD = 0.002;

// oxlint-disable-next-line max-lines-per-function -- Componente formulario con estado local
export default function LocalGridForm({
  business,
  onRun,
  isRunning,
  defaultKeyword,
}: Props) {
  const [keyword, setKeyword] = useState(defaultKeyword ?? "");
  const [targetDomain, setTargetDomain] = useState(business.domain ?? "");
  const [domainEditable, setDomainEditable] = useState(!business.domain);
  const [gridSize, setGridSize] = useState<3 | 5 | 7>(7);
  const [radiusKm, setRadiusKm] = useState(2);
  const [languageCode, setLanguageCode] = useState(business.languageCode);
  const [error, setError] = useState<string | null>(null);

  // Sincronizamos el dominio si el usuario cambia de negocio (vuelve al
  // picker y elige otro).
  useEffect(() => {
    setTargetDomain(business.domain ?? "");
    setDomainEditable(!business.domain);
  }, [business.domain, business.placeId]);

  const numPoints = gridSize * gridSize;
  const estimatedCost = (numPoints * COST_PER_CALL_USD).toFixed(3);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!keyword.trim()) {
      setError("Escribe la keyword a monitorizar.");
      return;
    }
    // Necesitamos dominio O place_id. Si no hay ni uno ni el otro, no
    // podemos hacer matching.
    if (!targetDomain.trim() && !business.placeId) {
      setError(
        "El negocio elegido no tiene website ni place_id. No se puede ejecutar el scan.",
      );
      return;
    }

    onRun({
      keyword: keyword.trim(),
      targetDomain: targetDomain.trim(),
      targetPlaceId: business.placeId,
      businessName: business.businessName,
      centerLat: business.latitude,
      centerLng: business.longitude,
      gridSize,
      radiusKm,
      languageCode,
      locationName: business.locationName,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-base-300 rounded-xl bg-base-100 p-4 space-y-3"
    >
      <div>
        <h2 className="text-sm font-semibold">
          Paso 2 · Define el scan para este negocio
        </h2>
        <p className="text-xs text-base-content/60 mt-0.5">
          Centro del grid, dominio y place_id ya están resueltos. Elige la
          keyword y el tamaño de malla.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="form-control">
          <span className="label label-text text-xs font-medium">
            Keyword a monitorizar
          </span>
          <input
            className="input input-bordered input-sm"
            placeholder="ej: dentista, fontanero, abogado..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            disabled={isRunning}
            autoFocus
          />
        </label>

        <label className="form-control">
          <span className="label label-text text-xs font-medium flex items-center justify-between">
            <span>Dominio objetivo (fallback de matching)</span>
            {!domainEditable && (
              <button
                type="button"
                onClick={() => setDomainEditable(true)}
                className="btn btn-ghost btn-xs gap-1 text-[10px]"
                title="Editar dominio"
              >
                <Edit3 className="size-3" />
                Editar
              </button>
            )}
          </span>
          <input
            className="input input-bordered input-sm"
            placeholder="ej: fiscalis.es"
            value={targetDomain}
            onChange={(e) => setTargetDomain(e.target.value)}
            disabled={isRunning || !domainEditable}
          />
        </label>

        <label className="form-control">
          <span className="label label-text text-xs font-medium">
            Tamaño de grid
          </span>
          <select
            className="select select-bordered select-sm"
            value={gridSize}
            onChange={(e) => {
              // Validamos explícitamente para evitar type assertion unsafe:
              const v = Number(e.target.value);
              if (v === 3 || v === 5 || v === 7) setGridSize(v);
            }}
            disabled={isRunning}
          >
            <option value={3}>3 × 3 (9 puntos)</option>
            <option value={5}>5 × 5 (25 puntos)</option>
            <option value={7}>7 × 7 (49 puntos)</option>
          </select>
        </label>

        <label className="form-control">
          <span className="label label-text text-xs font-medium">
            Radio (km)
          </span>
          <input
            type="number"
            className="input input-bordered input-sm"
            min={0.2}
            max={50}
            step={0.1}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value) || 2)}
            disabled={isRunning}
          />
        </label>

        <label className="form-control">
          <span className="label label-text text-xs font-medium">Idioma</span>
          <select
            className="select select-bordered select-sm"
            value={languageCode}
            onChange={(e) => setLanguageCode(e.target.value)}
            disabled={isRunning}
          >
            <option value="es">Español</option>
            <option value="en">Inglés</option>
            <option value="fr">Francés</option>
            <option value="pt">Portugués</option>
            <option value="it">Italiano</option>
          </select>
        </label>
      </div>

      {/* Estimación de coste antes de lanzar */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <span className="text-base-content/60">
          Se ejecutarán <strong>{numPoints}</strong> llamadas a DataForSEO Maps
          Live (≈ ${estimatedCost} USD). Concurrencia: 8 en paralelo.
        </span>
        <button
          type="submit"
          className="btn btn-sm btn-primary gap-1"
          disabled={isRunning}
        >
          {isRunning ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Ejecutando scan...
            </>
          ) : (
            <>
              <Search className="size-3.5" />
              Ejecutar scan
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="alert alert-warning alert-sm text-xs">
          <AlertTriangle className="size-4" />
          <span>{error}</span>
        </div>
      )}
    </form>
  );
}
