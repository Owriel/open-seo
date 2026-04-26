// Sidebar con el historial de scans guardados del proyecto.
// Al click en uno, se carga en el mapa principal (lo gestiona el padre
// mediante onSelect). Permite borrar scans antiguos.

import { Grid3x3, Trash2, Clock } from "lucide-react";
import type { GridScanSummary } from "@/types/localGrid";

type Props = {
  scans: GridScanSummary[];
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

export default function LocalGridHistory({
  scans,
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
          Historial de scans
        </h3>
        <p className="text-[10px] text-base-content/50 mt-0.5">
          {scans.length} guardados
        </p>
      </div>
      <div className="max-h-[500px] overflow-y-auto">
        {isLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : scans.length === 0 ? (
          <div className="p-4 text-center text-xs text-base-content/50">
            Aún no hay scans. Ejecuta uno para verlo aquí.
          </div>
        ) : (
          <ul className="divide-y divide-base-300">
            {scans.map((s) => (
              <li
                key={s.id}
                className={`p-3 cursor-pointer hover:bg-base-200/60 transition-colors ${
                  selectedId === s.id ? "bg-primary/5" : ""
                }`}
                onClick={() => onSelect(s.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.keyword}</p>
                    <p className="text-xs text-base-content/60 truncate">
                      {s.targetDomain}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-base-content/50">
                      <span className="inline-flex items-center gap-0.5">
                        <Grid3x3 className="size-2.5" />
                        {s.gridSize}×{s.gridSize}
                      </span>
                      <span>·</span>
                      <span>{s.radiusKm} km</span>
                      <span>·</span>
                      <span>{formatRelativeDate(s.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                      <span className="badge badge-ghost badge-xs">
                        {s.pointsFound}/{s.pointsTotal} aparece
                      </span>
                      {s.topPosition != null && (
                        <span className="badge badge-success badge-xs">
                          top #{s.topPosition}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs shrink-0"
                    title="Borrar"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(s.id);
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
