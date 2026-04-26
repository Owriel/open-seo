// Tabla "Anchors" del módulo Backlinks.
// Columnas: anchor, nº backlinks, nº dominios referentes, % del total.
// Destaca los anchors sobre-optimizados (> 20% → warning amarillo).

import { useMemo, useState } from "react";
import {
  Tag,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { AnchorItem } from "@/types/backlinks";

type Props = {
  anchors: AnchorItem[];
};

// Umbral de sobre-optimización. Un anchor por encima de este % es un flag
// para auditores SEO (puede indicar link building manual / manipulativo).
const OVER_OPTIMIZATION_THRESHOLD = 20;

type SortKey = "anchor" | "backlinks" | "referringDomains" | "percentOfTotal";
type SortDir = "asc" | "desc";

function compareNullable(
  a: number | string | null,
  b: number | string | null,
  dir: SortDir,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") {
    return dir === "asc" ? a - b : b - a;
  }
  const sa = String(a);
  const sb = String(b);
  return dir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
}

function SortButton({
  active,
  dir,
  onClick,
  children,
}: {
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 hover:text-primary transition-colors"
      onClick={onClick}
    >
      {children}
      <Icon
        className={`size-3 ${active ? "text-primary" : "text-base-content/40"}`}
      />
    </button>
  );
}

// oxlint-disable-next-line max-lines-per-function -- Tabla con 4 columnas sortable + banner de warning
export default function AnchorsTable({ anchors }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("backlinks");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const copy = anchors.slice();
    copy.sort((a, b) => {
      switch (sortKey) {
        case "anchor":
          return compareNullable(a.anchor, b.anchor, sortDir);
        case "backlinks":
          return compareNullable(a.backlinks, b.backlinks, sortDir);
        case "referringDomains":
          return compareNullable(
            a.referringDomains,
            b.referringDomains,
            sortDir,
          );
        case "percentOfTotal":
          return compareNullable(a.percentOfTotal, b.percentOfTotal, sortDir);
        default:
          return 0;
      }
    });
    return copy;
  }, [anchors, sortKey, sortDir]);

  const toggle = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // Detecta cuántos anchors superan el umbral para mostrar el banner.
  const overOptimized = sorted.filter(
    (a) => a.percentOfTotal > OVER_OPTIMIZATION_THRESHOLD,
  );

  if (anchors.length === 0) {
    return (
      <div className="border border-dashed border-base-300 rounded-xl p-8 text-center text-sm text-base-content/50">
        <Tag className="size-6 mx-auto mb-2 opacity-40" />
        No hay anchors en este análisis.
      </div>
    );
  }

  return (
    <div className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
      <div className="px-4 py-2 border-b border-base-300 bg-base-200/30">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Tag className="size-4 text-primary" />
          Distribución de anchors ({sorted.length})
        </h3>
      </div>

      {overOptimized.length > 0 && (
        <div className="alert alert-warning rounded-none text-xs">
          <AlertTriangle className="size-4" />
          <span>
            <strong>{overOptimized.length}</strong> anchor
            {overOptimized.length !== 1 ? "s" : ""} con posible
            sobre-optimización (&gt; {OVER_OPTIMIZATION_THRESHOLD}% del total).
            Revisa si son naturales o parte de un patrón de link building
            manipulativo.
          </span>
        </div>
      )}

      <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
        <table className="table table-sm">
          <thead className="sticky top-0 bg-base-100 z-10">
            <tr>
              <th>
                <SortButton
                  active={sortKey === "anchor"}
                  dir={sortDir}
                  onClick={() => toggle("anchor")}
                >
                  Anchor
                </SortButton>
              </th>
              <th className="text-right">
                <SortButton
                  active={sortKey === "backlinks"}
                  dir={sortDir}
                  onClick={() => toggle("backlinks")}
                >
                  Backlinks
                </SortButton>
              </th>
              <th className="text-right">
                <SortButton
                  active={sortKey === "referringDomains"}
                  dir={sortDir}
                  onClick={() => toggle("referringDomains")}
                >
                  Ref. domains
                </SortButton>
              </th>
              <th className="text-right">
                <SortButton
                  active={sortKey === "percentOfTotal"}
                  dir={sortDir}
                  onClick={() => toggle("percentOfTotal")}
                >
                  % del total
                </SortButton>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a, i) => {
              const isWarning = a.percentOfTotal > OVER_OPTIMIZATION_THRESHOLD;
              return (
                <tr
                  key={`${a.anchor}-${i}`}
                  className={`hover ${isWarning ? "bg-warning/5" : ""}`}
                >
                  <td className="max-w-xl">
                    <span
                      className="inline-block max-w-full truncate text-xs"
                      title={a.anchor}
                    >
                      {a.anchor || (
                        <span className="text-base-content/40">(vacío)</span>
                      )}
                    </span>
                    {isWarning && (
                      <span className="badge badge-warning badge-xs ml-2">
                        sobre-optimizado
                      </span>
                    )}
                  </td>
                  <td className="text-right tabular-nums">
                    {a.backlinks.toLocaleString("es-ES")}
                  </td>
                  <td className="text-right tabular-nums">
                    {a.referringDomains != null
                      ? a.referringDomains.toLocaleString("es-ES")
                      : "—"}
                  </td>
                  <td className="text-right tabular-nums">
                    {a.percentOfTotal.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
