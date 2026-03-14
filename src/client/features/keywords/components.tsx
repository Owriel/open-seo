import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { sortBy } from "remeda";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  KeywordIntent,
  KeywordResearchRow,
  MonthlySearch,
  SerpResultItem,
} from "@/types/keywords";
import {
  formatNumber,
  scoreTierClass,
  calculatePriorityScore,
  getPriorityTier,
  priorityTierClass,
  type KeywordCluster,
} from "./utils";

export type SortField =
  | "keyword"
  | "searchVolume"
  | "cpc"
  | "competition"
  | "keywordDifficulty";
export type SortDir = "asc" | "desc";

export function HeaderHelpLabel({
  label,
  helpText,
  delayMs = 150,
}: {
  label: string;
  helpText: string;
  delayMs?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  };

  const clearOpenTimeout = () => {
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
  };

  const scheduleOpen = () => {
    clearOpenTimeout();
    openTimeoutRef.current = setTimeout(() => {
      updatePosition();
      setIsOpen(true);
      openTimeoutRef.current = null;
    }, delayMs);
  };

  const closeNow = () => {
    clearOpenTimeout();
    setIsOpen(false);
  };

  useEffect(() => clearOpenTimeout, []);

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    const handleReposition = () => updatePosition();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen]);

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex items-center"
      onMouseEnter={scheduleOpen}
      onMouseLeave={closeNow}
      onFocus={scheduleOpen}
      onBlur={closeNow}
      onKeyDown={(e) => {
        if (e.key === "Escape") closeNow();
      }}
    >
      <span>{label}</span>
      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <span
              role="tooltip"
              className="pointer-events-none fixed z-[1000] w-max max-w-56 -translate-x-1/2 -translate-y-full rounded-md border border-base-300 bg-base-100 px-2 py-1 text-[11px] font-normal normal-case leading-snug text-base-content shadow-md"
              style={{ left: position.left, top: position.top }}
            >
              {helpText}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

export function OverviewStats({ keyword }: { keyword: KeywordResearchRow }) {
  return (
    <div className="shrink-0 bg-base-100 border border-base-300 rounded-xl px-4 py-2.5 flex items-center gap-4 min-h-[48px]">
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        <span className="font-bold text-base truncate max-w-[240px] capitalize">
          {keyword.keyword}
        </span>
        <ScoreBadge value={keyword.keywordDifficulty} size="sm" />
      </div>

      <div className="w-px h-6 bg-base-300 shrink-0" />

      <div className="flex items-center gap-4 text-sm flex-wrap min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-base-content/50">Vol</span>
          <span className="font-semibold tabular-nums">
            {formatNumber(keyword.searchVolume)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-base-content/50">CPC</span>
          <span className="font-semibold tabular-nums">
            {keyword.cpc == null ? "-" : `$${keyword.cpc.toFixed(2)}`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-base-content/50">Comp</span>
          <span className="font-semibold tabular-nums">
            {keyword.competition == null ? "-" : keyword.competition.toFixed(2)}
          </span>
        </div>
        <IntentBadge intent={keyword.intent} />
      </div>
    </div>
  );
}

export function KeywordRow({
  row,
  isSelected,
  isActive,
  onToggle,
  onClick,
}: {
  row: KeywordResearchRow;
  isSelected: boolean;
  isActive: boolean;
  onToggle: () => void;
  onClick: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 border-b border-base-200 text-sm hover:bg-base-200/50 transition-colors cursor-pointer ${
        isActive ? "bg-primary/5 border-l-2 border-l-primary" : ""
      }`}
      onClick={onClick}
    >
      <input
        type="checkbox"
        className="checkbox checkbox-xs shrink-0"
        checked={isSelected}
        onChange={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onClick={(e) => e.stopPropagation()}
      />

      <span
        className="flex-1 min-w-0 truncate font-medium capitalize"
        title={row.keyword}
      >
        {row.keyword}
      </span>

      <span className="w-16 text-right tabular-nums text-base-content/70">
        {formatNumber(row.searchVolume)}
      </span>
      <span className="w-14 text-right tabular-nums text-base-content/70">
        {row.cpc == null ? "-" : row.cpc.toFixed(2)}
      </span>
      <span className="w-12 text-right tabular-nums text-base-content/70">
        {row.competition == null ? "-" : row.competition.toFixed(2)}
      </span>

      <div className="w-10 flex justify-end">
        <ScoreBadge value={row.keywordDifficulty} size="sm" />
      </div>

      <div className="w-14 flex justify-end">
        <PriorityBadge
          searchVolume={row.searchVolume}
          keywordDifficulty={row.keywordDifficulty}
          cpc={row.cpc}
        />
      </div>
    </div>
  );
}

export function KeywordCard({
  row,
  isSelected,
  isActive,
  onToggle,
  onClick,
}: {
  row: KeywordResearchRow;
  isSelected: boolean;
  isActive: boolean;
  onToggle: () => void;
  onClick: () => void;
}) {
  return (
    <div
      className={`bg-base-100 border border-base-300 rounded-lg p-3 space-y-2 cursor-pointer transition-colors ${
        isActive ? "border-primary bg-primary/5" : "hover:bg-base-200/50"
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          className="checkbox checkbox-sm shrink-0 mt-0.5"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <span className="flex-1 font-semibold text-sm capitalize leading-tight">
          {row.keyword}
        </span>
        <ScoreBadge value={row.keywordDifficulty} size="sm" />
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="text-center">
          <p className="text-base-content/50">Volumen</p>
          <p className="font-medium tabular-nums">
            {formatNumber(row.searchVolume)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-base-content/50">CPC</p>
          <p className="font-medium tabular-nums">
            {row.cpc == null ? "-" : `$${row.cpc.toFixed(2)}`}
          </p>
        </div>
        <div className="text-center">
          <p className="text-base-content/50">Comp.</p>
          <p className="font-medium tabular-nums">
            {row.competition == null ? "-" : row.competition.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <IntentBadge intent={row.intent} />
        <PriorityBadge
          searchVolume={row.searchVolume}
          keywordDifficulty={row.keywordDifficulty}
          cpc={row.cpc}
        />
      </div>
    </div>
  );
}

export function SerpAnalysisCard({
  items,
  loading,
  error,
  onRetry,
  page,
  pageSize,
  onPageChange,
}: {
  items: SerpResultItem[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(items.length / pageSize);
  const pageItems = items.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div>
      {loading ? (
        <div className="space-y-3" aria-busy>
          <div className="skeleton h-3 w-40" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="grid grid-cols-[24px_minmax(0,1fr)_72px_92px_82px_56px] items-center gap-2"
              >
                <div className="skeleton h-3 w-4" />
                <div className="space-y-1">
                  <div className="skeleton h-3 w-10/12" />
                  <div className="skeleton h-2.5 w-7/12" />
                </div>
                <div className="skeleton h-3 w-12 justify-self-end" />
                <div className="skeleton h-3 w-16 justify-self-end" />
                <div className="skeleton h-3 w-16 justify-self-end" />
                <div className="skeleton h-3 w-10 justify-self-center" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error space-y-2">
          <p>{error}</p>
          {onRetry ? (
            <button className="btn btn-xs" onClick={onRetry}>
              Reintentar
            </button>
          ) : null}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-6 text-base-content/40 text-sm">
          No hay datos SERP disponibles para esta keyword
        </div>
      ) : (
        <>
          <div className="text-xs text-base-content/50 mb-3">
            {items.length} resultados orgánicos
          </div>

          <div className="overflow-x-auto">
            <table className="table table-xs w-full">
              <thead>
                <tr className="text-xs text-base-content/60">
                  <th className="w-8">#</th>
                  <th>Página</th>
                  <th className="text-right w-20">Tráfico</th>
                  <th className="text-right w-20">Dom. Ref.</th>
                  <th className="text-right w-20">Backlinks</th>
                  <th className="text-center w-16">Cambio</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => (
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
                      <RankChangeBadge
                        change={item.rankChange}
                        isNew={item.isNew}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
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
                  Ant.
                </button>
                <button
                  className="btn btn-ghost btn-xs"
                  disabled={page >= totalPages - 1}
                  onClick={() => onPageChange(page + 1)}
                >
                  Sig.
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RankChangeBadge({
  change,
  isNew,
}: {
  change: number | null;
  isNew: boolean;
}) {
  if (isNew) {
    return <span className="badge badge-xs badge-success">NEW</span>;
  }
  if (change == null || change === 0) {
    return <Minus className="size-3 text-base-content/30 mx-auto" />;
  }
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-success text-xs font-medium">
        <TrendingUp className="size-3" />+{change}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-error text-xs font-medium">
      <TrendingDown className="size-3" />
      {change}
    </span>
  );
}

function ScoreBadge({
  value,
  size = "sm",
}: {
  value: number | null;
  size?: "sm" | "lg";
}) {
  if (value == null) return null;

  const tierClass = scoreTierClass(value);
  const sizeClasses =
    size === "lg"
      ? "size-9 text-sm font-bold"
      : "size-6 text-[10px] font-semibold";

  return (
    <span
      className={`score-badge ${tierClass} inline-flex items-center justify-center rounded-full ${sizeClasses}`}
    >
      {value}
    </span>
  );
}

export function AreaTrendChart({ trend }: { trend: MonthlySearch[] }) {
  const sorted = sortBy(trend, (item) => item.year * 100 + item.month);
  const last12 = sorted.slice(-12);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  if (last12.length === 0) return null;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      setChartWidth(container.clientWidth);
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  const monthLabels = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  const data = last12.map((m) => ({
    month: monthLabels[m.month - 1],
    year: m.year,
    searchVolume: m.searchVolume,
    label: `${monthLabels[m.month - 1]} ${m.year}`,
  }));

  return (
    <div
      ref={containerRef}
      className="w-full h-[210px] min-w-0"
      aria-label="Gráfico de tendencias"
    >
      {chartWidth > 0 ? (
        <AreaChart
          width={chartWidth}
          height={210}
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
          accessibilityLayer
        >
          <defs>
            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--color-primary)"
                stopOpacity="var(--trend-fill-start-opacity)"
              />
              <stop
                offset="100%"
                stopColor="var(--color-primary)"
                stopOpacity="var(--trend-fill-end-opacity)"
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="var(--trend-grid-color)"
            strokeDasharray="2 4"
            vertical={true}
            horizontal={true}
          />
          <XAxis
            dataKey="month"
            tick={{ fill: "var(--trend-axis-color)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value: number | string) =>
              formatNumber(Number(value))
            }
            tick={{ fill: "var(--trend-axis-color)", fontSize: 11 }}
            width={56}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--trend-tooltip-bg)",
              border: "1px solid var(--trend-tooltip-border)",
              borderRadius: "10px",
              boxShadow: "0 8px 24px var(--trend-tooltip-shadow)",
              color: "var(--color-base-content)",
            }}
          />
          <Area
            type="monotone"
            dataKey="searchVolume"
            name="Volumen de búsqueda"
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill="url(#trendGrad)"
            isAnimationActive={false}
            dot={{ r: 3, fill: "var(--color-primary)", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "var(--color-primary)" }}
          />
        </AreaChart>
      ) : null}
    </div>
  );
}

export function SortHeader({
  label,
  helpText,
  field,
  current,
  dir,
  onToggle,
  className,
}: {
  label: string;
  helpText?: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onToggle: (f: SortField) => void;
  className?: string;
}) {
  const isActive = field === current;
  return (
    <button
      className={`inline-flex items-center gap-0.5 hover:text-primary transition-colors cursor-pointer select-none ${className ?? ""}`}
      onClick={() => onToggle(field)}
    >
      {helpText ? <HeaderHelpLabel label={label} helpText={helpText} /> : label}
      {isActive &&
        (dir === "asc" ? (
          <ChevronUp className="size-3" />
        ) : (
          <ChevronDown className="size-3" />
        ))}
    </button>
  );
}

function IntentBadge({ intent }: { intent: KeywordIntent }) {
  const colors: Record<KeywordIntent, string> = {
    informational: "badge-info",
    commercial: "badge-warning",
    transactional: "badge-success",
    navigational: "badge-primary",
    unknown: "badge-ghost",
  };
  const shortLabels: Record<KeywordIntent, string> = {
    informational: "Info",
    commercial: "Com",
    transactional: "Trans",
    navigational: "Nav",
    unknown: "?",
  };
  return (
    <span className={`badge badge-sm ${colors[intent]}`}>
      {shortLabels[intent]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Priority Badge                                                      */
/* ------------------------------------------------------------------ */

export function PriorityBadge({
  searchVolume,
  keywordDifficulty,
  cpc,
  showScore = false,
}: {
  searchVolume: number | null;
  keywordDifficulty: number | null;
  cpc: number | null;
  showScore?: boolean;
}) {
  const score = calculatePriorityScore(searchVolume, keywordDifficulty, cpc);
  const tier = getPriorityTier(score);
  const tierClass = priorityTierClass(tier);
  const label = tier.charAt(0).toUpperCase() + tier.slice(1);

  return (
    <span className={`badge badge-sm ${tierClass}`}>
      {showScore ? `${score} - ${label}` : label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Cluster View                                                        */
/* ------------------------------------------------------------------ */

export function ClusterCard({
  cluster,
  isExpanded,
  onToggle,
  onSelectCluster,
}: {
  cluster: KeywordCluster;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectCluster?: (keywords: string[]) => void;
}) {
  const tier = getPriorityTier(cluster.avgPriority);
  const tierClass = priorityTierClass(tier);

  return (
    <div className="border border-base-300 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-base-100 hover:bg-base-200/50 transition-colors text-left"
        onClick={onToggle}
      >
        {isExpanded ? (
          <ChevronDown className="size-4 shrink-0 text-base-content/50" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-base-content/50" />
        )}

        <span className="flex-1 font-semibold text-sm capitalize">
          {cluster.name}
        </span>

        <span className="text-xs text-base-content/50">
          {cluster.count} keywords
        </span>

        <span className="text-xs tabular-nums font-medium">
          {formatNumber(cluster.totalVolume)} vol.
        </span>

        <span className={`badge badge-sm ${tierClass}`}>
          P: {cluster.avgPriority}
        </span>

        <span className="text-xs tabular-nums text-base-content/60">
          KD: {cluster.avgDifficulty}
        </span>

        <span className="text-xs tabular-nums text-base-content/60">
          CPC: ${cluster.avgCpc.toFixed(2)}
        </span>
      </button>

      {isExpanded && (
        <div className="border-t border-base-200 bg-base-200/20 px-4 py-2">
          {onSelectCluster && (
            <div className="flex justify-end mb-2">
              <button
                className="btn btn-xs btn-ghost text-primary"
                onClick={() => onSelectCluster(cluster.keywords)}
              >
                Seleccionar todas
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {cluster.keywords.map((kw) => (
              <span
                key={kw}
                className="badge badge-sm badge-outline capitalize"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ClusterSummary({
  clusters,
  expandedClusters,
  onToggleCluster,
  onSelectCluster,
}: {
  clusters: KeywordCluster[];
  expandedClusters: Set<string>;
  onToggleCluster: (name: string) => void;
  onSelectCluster?: (keywords: string[]) => void;
}) {
  if (clusters.length === 0) return null;

  const totalKeywords = clusters.reduce((s, c) => s + c.count, 0);
  const totalVolume = clusters.reduce((s, c) => s + c.totalVolume, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          Clusters de Keywords
        </h3>
        <span className="text-xs text-base-content/50">
          {clusters.length} clusters · {totalKeywords} keywords · {formatNumber(totalVolume)} vol. total
        </span>
      </div>

      <div className="space-y-2">
        {clusters.map((cluster) => (
          <ClusterCard
            key={cluster.name}
            cluster={cluster}
            isExpanded={expandedClusters.has(cluster.name)}
            onToggle={() => onToggleCluster(cluster.name)}
            onSelectCluster={onSelectCluster}
          />
        ))}
      </div>
    </div>
  );
}
