// Tabla de backlinks tóxicos según la heurística del módulo.
// - Calcula el score en el cliente usando `backlinksToxicScore.ts`.
// - Pinta filas con badge rojo si score ≥ 5.
// - Botón "Exportar disavow.txt" que descarga el archivo con formato Google.

import { useMemo } from "react";
import { ShieldAlert, Download, ExternalLink } from "lucide-react";
import type { BacklinkItem } from "@/types/backlinks";
import {
  buildDisavowFile,
  detectToxicBacklinks,
} from "@/server/lib/backlinksToxicScore";

type Props = {
  backlinks: BacklinkItem[];
  target: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const clean = iso.replace(" +00:00", "Z").replace(" ", "T");
  const d = new Date(clean);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Dispara la descarga del archivo disavow.txt en el navegador.
// Usa Blob + anchor sintético para no depender de librerías externas.
function downloadDisavow(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Liberamos la URL tras un tick para asegurar que la descarga arrancó.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// oxlint-disable-next-line max-lines-per-function -- Tabla con header + botón + filas
export default function ToxicBacklinksTable({ backlinks, target }: Props) {
  // Detectamos tóxicos en el render. Es rápido (O(n)) para samples de ≤ 500
  // y evita tener que persistirlo en BBDD (la heurística puede cambiar).
  const toxic = useMemo(
    () => detectToxicBacklinks(backlinks, { targetDomain: target }),
    [backlinks, target],
  );

  const handleExport = () => {
    const content = buildDisavowFile(toxic, target);
    const safeTarget = target.replace(/[^a-z0-9.-]/gi, "_");
    downloadDisavow(content, `disavow-${safeTarget}.txt`);
  };

  if (backlinks.length === 0) {
    return (
      <div className="border border-dashed border-base-300 rounded-xl p-8 text-center text-sm text-base-content/50">
        <ShieldAlert className="size-6 mx-auto mb-2 opacity-40" />
        No hay backlinks en la muestra para analizar.
      </div>
    );
  }

  if (toxic.length === 0) {
    return (
      <div className="border border-base-300 rounded-xl bg-base-100 p-6 text-center">
        <ShieldAlert className="size-8 mx-auto mb-2 text-success" />
        <p className="text-sm font-medium">Perfil limpio</p>
        <p className="text-xs text-base-content/60 mt-1">
          Ninguno de los <strong>{backlinks.length}</strong> backlinks de la
          muestra supera el umbral tóxico (score ≥ 5).
        </p>
      </div>
    );
  }

  return (
    <div className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-base-300 bg-base-200/30 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2 text-error">
            <ShieldAlert className="size-4" />
            Backlinks tóxicos ({toxic.length} de {backlinks.length})
          </h3>
          <p className="text-[10px] text-base-content/50 mt-0.5">
            Score ≥ 5: candidatos a disavow. Score 3-4: revisar manualmente.
            Heurística: spam score &gt; 30, TLD sospechoso, dominio sin rank,
            mismatch de idioma, anchor exacto.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-error gap-1"
          onClick={handleExport}
          title="Descargar archivo disavow.txt para Google Search Console"
        >
          <Download className="size-3.5" />
          Exportar disavow.txt
        </button>
      </div>

      <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
        <table className="table table-sm">
          <thead className="sticky top-0 bg-base-100 z-10">
            <tr>
              <th>Score</th>
              <th>URL origen</th>
              <th>Anchor</th>
              <th>Razones</th>
              <th>Primera vez</th>
            </tr>
          </thead>
          <tbody>
            {toxic.map((t, i) => (
              <tr
                key={`${t.backlink.urlFrom ?? "no-url"}-${i}`}
                className="hover"
              >
                <td>
                  <span
                    className={`badge badge-sm ${
                      t.score >= 7
                        ? "badge-error"
                        : t.score >= 5
                          ? "badge-warning"
                          : "badge-ghost"
                    }`}
                  >
                    {t.score}
                  </span>
                </td>
                <td className="max-w-[240px]">
                  {t.backlink.urlFrom ? (
                    <a
                      href={t.backlink.urlFrom}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs hover:text-primary hover:underline truncate max-w-full"
                      title={t.backlink.urlFrom}
                    >
                      <span className="truncate">{t.backlink.urlFrom}</span>
                      <ExternalLink className="size-2.5 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-base-content/40">—</span>
                  )}
                  <p className="text-[10px] text-base-content/50 truncate">
                    {t.backlink.domainFrom ?? ""}
                    {t.backlink.tldFrom && ` · .${t.backlink.tldFrom}`}
                  </p>
                </td>
                <td className="max-w-[160px]">
                  <span
                    className="inline-block max-w-full truncate text-xs"
                    title={t.backlink.anchor ?? ""}
                  >
                    {t.backlink.anchor ?? (
                      <span className="text-base-content/40">(vacío)</span>
                    )}
                  </span>
                </td>
                <td className="max-w-[300px]">
                  <ul className="text-[11px] space-y-0.5">
                    {t.reasons.map((r, idx) => (
                      <li key={idx} className="text-base-content/70">
                        · {r}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="whitespace-nowrap text-xs text-base-content/70">
                  {formatDate(t.backlink.firstSeen)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
