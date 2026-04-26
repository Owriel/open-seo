// Sidebar derecha con el historial de análisis de reseñas guardados.
// Al click en uno, se carga en la vista principal (lo gestiona el padre
// mediante onSelect). Permite borrar análisis antiguos.

import { Clock, Trash2, Star, MessageCircle } from "lucide-react";
import type { ReviewAnalysisSummary } from "@/types/reviews";

type Props = {
  analyses: ReviewAnalysisSummary[];
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

export default function ReviewsHistorySidebar({
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
              <div key={i} className="skeleton h-16 w-full rounded-lg" />
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
                    <p className="text-sm font-medium truncate">
                      {a.businessName ?? a.keyword}
                    </p>
                    {a.businessName && (
                      <p className="text-[10px] text-base-content/50 truncate">
                        {a.keyword}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-base-content/50">
                      {a.avgRating != null && (
                        <span className="inline-flex items-center gap-0.5 text-warning">
                          <Star className="size-2.5 fill-current" />
                          {a.avgRating.toFixed(1)}
                        </span>
                      )}
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5">
                        <MessageCircle className="size-2.5" />
                        {a.totalReviews}
                      </span>
                      <span>·</span>
                      <span>{formatRelativeDate(a.createdAt)}</span>
                    </div>
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
