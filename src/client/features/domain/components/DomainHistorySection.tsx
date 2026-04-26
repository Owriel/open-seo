import { Clock, History, Search, X } from "lucide-react";
import { Globe } from "lucide-react";
import { Link, useParams } from "@tanstack/react-router";
import { useProjectContext } from "@/client/hooks/useProjectContext";
import type { DomainHistoryItem } from "@/client/features/domain/types";

type Props = {
  historyLoaded: boolean;
  history: DomainHistoryItem[];
  onClearHistory: () => void;
  onRemoveHistoryItem: (timestamp: number) => void;
  onSelectHistoryItem: (item: DomainHistoryItem) => void;
  // Handler opcional para lanzar el análisis con un dominio concreto desde
  // el CTA del empty state (cuando el proyecto tiene dominio configurado).
  onAnalyzeDomain?: (domain: string) => void;
};

export function DomainHistorySection({
  historyLoaded,
  history,
  onClearHistory,
  onRemoveHistoryItem,
  onSelectHistoryItem,
  onAnalyzeDomain,
}: Props) {
  const { projectId } = useParams({ from: "/p/$projectId/domain" });
  const { project } = useProjectContext(projectId);
  const projectDomain = project?.domain?.trim() ?? "";

  if (!historyLoaded || history.length === 0) {
    // CTA específico cuando el proyecto tiene dominio configurado: click
    // directo para analizar el dominio del proyecto sin escribir nada.
    if (projectDomain && onAnalyzeDomain) {
      return (
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center space-y-3">
          <Globe className="size-9 mx-auto text-primary" />
          <p className="text-lg font-semibold text-base-content">
            Analiza{" "}
            <span className="font-mono text-primary">{projectDomain}</span>
          </p>
          <p className="text-sm text-base-content/70 max-w-md mx-auto">
            Te mostraremos tráfico orgánico, keywords rankeadas, top páginas y
            distribución de posiciones.
          </p>
          <button
            type="button"
            className="btn btn-sm btn-primary gap-1"
            onClick={() => onAnalyzeDomain(projectDomain)}
          >
            <Search className="size-3.5" />
            Analizar ahora
          </button>
        </section>
      );
    }

    return (
      <section className="rounded-2xl border border-dashed border-base-300 bg-base-100/70 p-6 text-center text-base-content/55 space-y-2">
        <Globe className="size-9 mx-auto opacity-35" />
        <p className="text-base font-medium text-base-content/80">
          Enter a domain to get started
        </p>
        {historyLoaded && (
          <p className="text-xs text-base-content/50 mt-1">
            Sugerencia: configura un dominio en{" "}
            <Link
              to="/p/$projectId/settings"
              params={{ projectId }}
              className="link link-primary"
            >
              ajustes del proyecto
            </Link>{" "}
            para auto-rellenar todos los módulos.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-base-300 bg-base-100 p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="size-4 text-base-content/45" />
          <span className="text-sm text-base-content/60">
            {history.length} recent search{history.length !== 1 ? "es" : ""}
          </span>
        </div>
        <button
          className="btn btn-ghost btn-xs text-error"
          onClick={onClearHistory}
        >
          Clear all
        </button>
      </div>

      <div className="grid gap-2">
        {history.map((item) => (
          <div
            key={item.timestamp}
            className="flex items-center justify-between p-3 rounded-lg border border-base-300 bg-base-100 hover:bg-base-200 transition-colors text-left group cursor-pointer"
            onClick={() => onSelectHistoryItem(item)}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Clock className="size-4 text-base-content/40 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-base-content truncate">
                  {item.domain}
                </p>
                <p className="text-sm text-base-content/60 truncate">
                  {item.subdomains ? "Include subdomains" : "Root domain only"}
                  {item.search?.trim() ? ` - ${item.search}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-base-content/40">
                {new Date(item.timestamp).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 p-1"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemoveHistoryItem(item.timestamp);
                }}
              >
                <X className="size-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
