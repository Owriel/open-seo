// Formulario del módulo "Backlinks":
//   - Target: dominio o URL absoluta.
//   - includeSubdomains (checkbox).
//   - Tamaño de muestra (backlinks / dominios / anchors).
//   - Disclaimer de coste (~$0.30-0.50 por análisis completo).
// Dispara onRun con los parámetros al submit.

import { useState } from "react";
import { Search, Loader2, AlertTriangle, Link2 } from "lucide-react";

export type BacklinksFormParams = {
  target: string;
  includeSubdomains: boolean;
  backlinksLimit: number;
  domainsLimit: number;
  anchorsLimit: number;
};

type Props = {
  onRun: (params: BacklinksFormParams) => void;
  isRunning: boolean;
  // Dominio/URL pre-rellenado desde el contexto del proyecto (opcional).
  defaultTarget?: string;
};

// oxlint-disable-next-line max-lines-per-function -- Form con estado local extenso
export default function BacklinksForm({
  onRun,
  isRunning,
  defaultTarget,
}: Props) {
  const [target, setTarget] = useState(defaultTarget ?? "");
  const [includeSubdomains, setIncludeSubdomains] = useState(true);
  const [backlinksLimit, setBacklinksLimit] = useState(500);
  const [domainsLimit, setDomainsLimit] = useState(200);
  const [anchorsLimit, setAnchorsLimit] = useState(200);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmed = target.trim();
    if (!trimmed) {
      setFormError("Introduce un dominio o URL a analizar.");
      return;
    }

    onRun({
      target: trimmed,
      includeSubdomains,
      backlinksLimit,
      domainsLimit,
      anchorsLimit,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-base-300 rounded-xl bg-base-100 p-4 space-y-3"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="form-control md:col-span-2">
          <span className="label label-text text-xs font-medium">
            Dominio o URL a analizar
          </span>
          <input
            className="input input-bordered input-sm"
            placeholder="ej: ejemplo.com, blog.ejemplo.com, https://ejemplo.com/articulo"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={isRunning}
          />
          <span className="text-[10px] text-base-content/50 mt-1">
            Introduce el dominio sin protocolo (ej: fiscalis.es) o una URL
            absoluta de una página concreta. El sistema normaliza
            automáticamente.
          </span>
        </label>

        <label className="form-control">
          <span className="label label-text text-xs font-medium">
            Incluir subdominios
          </span>
          <div className="flex items-center h-8">
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-primary"
              checked={includeSubdomains}
              onChange={(e) => setIncludeSubdomains(e.target.checked)}
              disabled={isRunning}
            />
            <span className="ml-2 text-xs text-base-content/60">
              {includeSubdomains ? "Sí" : "No"}
            </span>
          </div>
        </label>

        <label className="form-control">
          <span className="label label-text text-xs font-medium">
            Nº backlinks (10-1000)
          </span>
          <input
            type="number"
            className="input input-bordered input-sm"
            min={10}
            max={1000}
            step={10}
            value={backlinksLimit}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v))
                setBacklinksLimit(Math.max(10, Math.min(1000, v)));
            }}
            disabled={isRunning}
          />
        </label>

        <label className="form-control">
          <span className="label label-text text-xs font-medium">
            Nº dominios referentes (10-1000)
          </span>
          <input
            type="number"
            className="input input-bordered input-sm"
            min={10}
            max={1000}
            step={10}
            value={domainsLimit}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v))
                setDomainsLimit(Math.max(10, Math.min(1000, v)));
            }}
            disabled={isRunning}
          />
        </label>

        <label className="form-control">
          <span className="label label-text text-xs font-medium">
            Nº anchors (10-1000)
          </span>
          <input
            type="number"
            className="input input-bordered input-sm"
            min={10}
            max={1000}
            step={10}
            value={anchorsLimit}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v))
                setAnchorsLimit(Math.max(10, Math.min(1000, v)));
            }}
            disabled={isRunning}
          />
        </label>
      </div>

      {/* Disclaimer de coste — obligatorio según enunciado */}
      <div className="alert alert-warning text-xs">
        <AlertTriangle className="size-4" />
        <span>
          Esta consulta costará aproximadamente <strong>$0.30-0.50</strong> en
          créditos DataForSEO (4 endpoints agregados: summary + backlinks +
          referring_domains + anchors).
        </span>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <span className="text-base-content/60 flex items-center gap-1">
          <Link2 className="size-3" />
          Se descargarán hasta <strong>{backlinksLimit}</strong> backlinks,{" "}
          <strong>{domainsLimit}</strong> dominios y{" "}
          <strong>{anchorsLimit}</strong> anchors.
        </span>
        <button
          type="submit"
          className="btn btn-sm btn-primary gap-1"
          disabled={isRunning}
        >
          {isRunning ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Analizando backlinks...
            </>
          ) : (
            <>
              <Search className="size-3.5" />
              Analizar backlinks
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
