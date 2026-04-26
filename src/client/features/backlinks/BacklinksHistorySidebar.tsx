// Sidebar derecha con el historial de análisis de backlinks guardados.
// Al click en uno, se carga en la vista principal (gestionado por el padre
// via onSelect). Permite borrar análisis antiguos.

import { Clock, Trash2, Link2, Globe } from "lucide-react";
import type { BacklinksAnalysisSummary } from "@/types/backlinks";

type Props = {
  analyses: BacklinksAnalysisSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
};

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diffMs = now - d.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} d`;
  return d.toLocaleDateString("es-ES");
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("es-ES");
}

export default function BacklinksHistorySidebar({
  analyses,
  selectedId,
  onSelect,
  onDelete,
  isLoading,
}: Props) {
  return (
    <aside className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
      <div className="px-3 py-2 border-b border-base-300 bg-base-200/40">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Clock className="size-4" />
          Historial de análisis
        </h3>
        <p className="text-[10px] text-base-content/50 mt-0.5">
          {analyses.length} guardados
        </p>
      </div>
      <div className="max-h-[600px] overflow-y-auto">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : analyses.length === 0 ? (
          <div className="p-4 text-center text-xs text-base-content/50">
            Aún no hay análisis. Ejecuta uno para verlo aquí.
          </div>
        ) : (
          <ul className="divide-y divide-base-300">
            {analyses.map((a) => (
              <li
                key={a.id}
                className={`p-3 cursor-pointer hover:bg-base-200/60 transition-colors ${
                  selectedId === a.id ? "bg-primary/5" : ""
                }`}
                onClick={() => onSelect(a.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      title={a.target}
                    >
                      {a.target}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-base-content/50">
                      <span className="inline-flex items-center gap-0.5">
                        <Link2 className="size-2.5" />
                        {formatCompact(a.totalBacklinks)}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5">
                        <Globe className="size-2.5" />
                        {formatCompact(a.totalReferringDomains)}
                      </span>
                      {a.rank != null && (
                        <>
                          <span>·</span>
                          <span>DR {a.rank}</span>
                        </>
                      )}
                    </div>
                    <p className="text-[10px] text-base-content/50 mt-0.5">
                      {formatRelativeDate(a.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs shrink-0"
                    title="Borrar"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(a.id);
                    }}
                  >
                    <Trash2 className="size-3 text-error" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
