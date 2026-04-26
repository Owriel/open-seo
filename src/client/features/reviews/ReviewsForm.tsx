// Formulario del módulo "Reseñas Google":
//   - Nombre del negocio (keyword para DataForSEO).
//   - País (Business Data Google Reviews solo acepta country-level, no
//     ciudad/region). Ej: "Spain", "United States", "France". Default "Spain".
//   - place_id opcional (si ya se conoce, se salta la búsqueda fuzzy).
//   - Número de reseñas a descargar (múltiplos de 10, máx 490).
//   - Idioma.
// Dispara onRun con los parámetros al submit. Muestra estimación de coste
// aproximada (DataForSEO Business Data Google Reviews ~$0.03 / 100 reviews).

import { useState } from "react";
import { Search, Loader2, AlertTriangle, MessageSquare } from "lucide-react";

export type ReviewsFormParams = {
  keyword: string;
  placeId?: string;
  locationName: string;
  languageCode: string;
  limit: number;
};

type Props = {
  onRun: (params: ReviewsFormParams) => void;
  isRunning: boolean;
  // Defaults iniciales opcionales desde el contexto del proyecto.
  // El usuario puede sobrescribirlos desde el form.
  defaultKeyword?: string;
  defaultPlaceId?: string;
  defaultLocationName?: string;
  defaultLanguageCode?: string;
};

// Coste aproximado por cada 100 reseñas (USD). Según enunciado: ~$0.03/100.
const COST_PER_100_USD = 0.03;

// oxlint-disable-next-line max-lines-per-function -- Formulario con estado local extenso
export default function ReviewsForm({
  onRun,
  isRunning,
  defaultKeyword,
  defaultPlaceId,
  defaultLocationName,
  defaultLanguageCode,
}: Props) {
  const [keyword, setKeyword] = useState(defaultKeyword ?? "");
  const [placeId, setPlaceId] = useState(defaultPlaceId ?? "");
  // DataForSEO Business Data Google Reviews solo acepta country-level
  // (p.ej. "Spain"). Si el backend recibe "Valencia,Valencia,Spain" lo
  // normaliza a la última parte, pero aquí el default ya es el país.
  const [locationName, setLocationName] = useState(
    defaultLocationName ?? "Spain",
  );
  const [languageCode, setLanguageCode] = useState(defaultLanguageCode ?? "es");
  const [limit, setLimit] = useState(50);
  const [formError, setFormError] = useState<string | null>(null);

  const estimatedCost = ((limit / 100) * COST_PER_100_USD).toFixed(3);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!keyword.trim() && !placeId.trim()) {
      setFormError(
        "Introduce al menos el nombre del negocio o un place_id de Google Maps.",
      );
      return;
    }

    onRun({
      keyword: keyword.trim(),
      placeId: placeId.trim() || undefined,
      locationName: locationName.trim() || "Spain",
      languageCode,
      limit,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-base-300 rounded-xl bg-base-100 p-4 space-y-3"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="form-control">
          <span className="label label-text text-xs font-medium">
            Nombre del negocio
          </span>
          <input
            className="input input-bordered input-sm"
            placeholder="ej: Dentista López Valencia, Restaurante La Marina..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            disabled={isRunning}
          />
        </label>

        <label className="form-control">
          <span className="label label-text text-xs font-medium">
            País (solo nivel país — ej. Spain)
          </span>
          <input
            className="input input-bordered input-sm"
            placeholder="Spain"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            disabled={isRunning}
          />
          <span className="text-[10px] text-base-content/50 mt-1">
            DataForSEO Google Reviews solo acepta país (no ciudad/región).
            Acepta inglés (&quot;Spain&quot;, &quot;United States&quot;) o
            español (&quot;España&quot;, &quot;Francia&quot;).
          </span>
        </label>

        <label className="form-control">
          <span className="label label-text text-xs font-medium">
            place_id (opcional, acelera la búsqueda)
          </span>
          <input
            className="input input-bordered input-sm"
            placeholder="ej: ChIJ0X3Bwy..."
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            disabled={isRunning}
          />
        </label>

        <label className="form-control">
          <span className="label label-text text-xs font-medium">
            Idioma de las reseñas
          </span>
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
            <option value="de">Alemán</option>
          </select>
        </label>

        <label className="form-control md:col-span-2">
          <span className="label label-text text-xs font-medium">
            Nº reseñas a descargar (múltiplos de 10, máx 490)
          </span>
          <input
            type="number"
            className="input input-bordered input-sm"
            min={10}
            max={490}
            step={10}
            value={limit}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) setLimit(Math.max(10, Math.min(490, v)));
            }}
            disabled={isRunning}
          />
        </label>
      </div>

      {/* Estimación de coste */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <span className="text-base-content/60 flex items-center gap-1">
          <MessageSquare className="size-3" />
          Se descargarán hasta <strong>{limit}</strong> reseñas (≈ $
          {estimatedCost} USD). Tarda 20-60s (task async).
        </span>
        <button
          type="submit"
          className="btn btn-sm btn-primary gap-1"
          disabled={isRunning}
        >
          {isRunning ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Analizando reseñas...
            </>
          ) : (
            <>
              <Search className="size-3.5" />
              Analizar reseñas
            </>
          )}
        </button>
      </div>

      {formError && (
        <div className="alert alert-warning text-xs">
          <AlertTriangle className="size-4" />
          <span>{formError}</span>
        </div>
      )}
    </form>
  );
}
