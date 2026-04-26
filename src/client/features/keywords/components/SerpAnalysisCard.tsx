import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { SerpResultItem } from "@/types/keywords";
import { formatNumber } from "../utils";

export function SerpAnalysisCard({
  items,
  keyword,
  loading,
  error,
  onRetry,
  page,
  pageSize,
  onPageChange,
}: {
  items: SerpResultItem[];
  keyword?: string | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(items.length / pageSize);
  const pageItems = items.slice(page * pageSize, (page + 1) * pageSize);

  if (loading) return <SerpAnalysisLoadingState />;
  if (error) {
    return (
      <div className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error space-y-2">
        <p>{error}</p>
        {onRetry ? (
          <button className="btn btn-xs" onClick={onRetry}>
            Reintentar
          </button>
        ) : null}
      </div>
    );
  }
  if (items.length === 0) return <SerpAnalysisEmptyState keyword={keyword} />;

  return (
    <div>
      <div className="text-xs text-base-content/50 mb-3">
        {items.length === 1
          ? "1 resultado orgánico"
          : `${items.length} resultados orgánicos`}
      </div>
      <SerpAnalysisTable items={pageItems} />
      <SerpAnalysisPagination
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}

function SerpAnalysisTable({ items }: { items: SerpResultItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="table table-xs w-full">
        <thead>
          <tr className="text-xs text-base-content/60">
            <th className="w-8">#</th>
            <th>Página</th>
            <th className="text-right w-20">Tráfico</th>
            <th className="text-right w-20">Dom. ref.</th>
            <th className="text-right w-20">Backlinks</th>
            <th className="text-center w-16">Cambio</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={`${item.rank}-${item.url}`}
              className="hover:bg-base-200/50"
            >
              <td className="font-mono text-base-content/50 text-xs">
                {item.rank}
              </td>
              <td className="max-w-[280px]">
                <div className="flex flex-col gap-0.5">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline truncate flex items-center gap-1"
                    title={item.title}
                  >
                    {item.title || item.url}
                    <ExternalLink className="size-3 shrink-0 opacity-40" />
                  </a>
                  <span className="text-xs text-base-content/40 truncate">
                    {item.domain}
                  </span>
                </div>
              </td>
              <td className="text-right tabular-nums text-base-content/70">
                {formatNumber(item.etv)}
              </td>
              <td className="text-right tabular-nums text-base-content/70">
                {formatNumber(item.referringDomains)}
              </td>
              <td className="text-right tabular-nums text-base-content/70">
                {formatNumber(item.backlinks)}
              </td>
              <td className="text-center">
                <RankChangeBadge change={item.rankChange} isNew={item.isNew} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SerpAnalysisPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-3 pt-3 border-t border-base-200">
      <span className="text-xs text-base-content/50">
        Página {page + 1} de {totalPages}
      </span>
      <div className="flex gap-1">
        <button
          className="btn btn-ghost btn-xs"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-3.5" />
          Anterior
        </button>
        <button
          className="btn btn-ghost btn-xs"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function SerpAnalysisLoadingState() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="h-8 rounded bg-base-200 animate-pulse"
          style={{ animationDelay: `${index * 50}ms` }}
        />
      ))}
    </div>
  );
}

function SerpAnalysisEmptyState({ keyword }: { keyword?: string | null }) {
  return (
    <div className="text-sm text-base-content/50 text-center py-8">
      <p>Aún no hay detalles SERP disponibles para esta keyword.</p>
      {keyword ? (
        <p className="mt-1">Pulsa otra keyword para cargar los datos.</p>
      ) : null}
    </div>
  );
}

function RankChangeBadge({
  change,
  isNew,
}: {
  change: number | null;
  isNew?: boolean;
}) {
  if (isNew) {
    return <span className="badge badge-success badge-xs">nuevo</span>;
  }
  if (change == null)
    return <Minus className="size-3 text-base-content/40 mx-auto" />;
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-success text-xs">
        <TrendingUp className="size-3" />
        {change}
      </span>
    );
  }
  if (change < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-error text-xs">
        <TrendingDown className="size-3" />
        {Math.abs(change)}
      </span>
    );
  }
  return <Minus className="size-3 text-base-content/40 mx-auto" />;
}
