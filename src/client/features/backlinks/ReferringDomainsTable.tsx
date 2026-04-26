// Tabla "Dominios referentes" del módulo Backlinks.
// Columnas: dominio, rank (DR), backlinks, dominios referentes del referente
// (TR), ratio dofollow, first seen. Sortable clicando cabecera.

import { useMemo, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Globe } from "lucide-react";
import type { ReferringDomainItem } from "@/types/backlinks";

type Props = {
  domains: ReferringDomainItem[];
};

type SortKey =
  | "domain"
  | "rank"
  | "backlinks"
  | "referringDomains"
  | "dofollowRatio"
  | "firstSeen";
type SortDir = "asc" | "desc";

// Compara dos valores posiblemente null (null va al final en asc, al principio
// en desc).
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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  // DataForSEO: "2019-11-15 12:57:46 +00:00"
  const clean = iso.replace(" +00:00", "Z").replace(" ", "T");
  const d = new Date(clean);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

// oxlint-disable-next-line max-lines-per-function -- Tabla con 6 columnas sortable + cabecera
export default function ReferringDomainsTable({ domains }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const copy = domains.slice();
    copy.sort((a, b) => {
      switch (sortKey) {
        case "domain":
          return compareNullable(a.domain, b.domain, sortDir);
        case "rank":
          return compareNullable(a.rank, b.rank, sortDir);
        case "backlinks":
          return compareNullable(a.backlinks, b.backlinks, sortDir);
        case "referringDomains":
          return compareNullable(
            a.referringDomains,
            b.referringDomains,
            sortDir,
          );
        case "dofollowRatio":
          return compareNullable(a.dofollowRatio, b.dofollowRatio, sortDir);
        case "firstSeen":
          return compareNullable(a.firstSeen, b.firstSeen, sortDir);
        default:
          return 0;
      }
    });
    return copy;
  }, [domains, sortKey, sortDir]);

  const toggle = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  if (domains.length === 0) {
    return (
      <div className="border border-dashed border-base-300 rounded-xl p-8 text-center text-sm text-base-content/50">
        <Globe className="size-6 mx-auto mb-2 opacity-40" />
        No hay dominios referentes en este análisis.
      </div>
    );
  }

  return (
    <div className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
      <div className="px-4 py-2 border-b border-base-300 bg-base-200/30 flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Globe className="size-4 text-primary" />
          Dominios referentes ({sorted.length})
        </h3>
      </div>
      <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
        <table className="table table-sm">
          <thead className="sticky top-0 bg-base-100 z-10">
            <tr>
              <th>
                <SortButton
                  active={sortKey === "domain"}
                  dir={sortDir}
                  onClick={() => toggle("domain")}
                >
                  Dominio
                </SortButton>
              </th>
              <th className="text-right">
                <SortButton
                  active={sortKey === "rank"}
                  dir={sortDir}
                  onClick={() => toggle("rank")}
                >
                  DR
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
                  TR
                </SortButton>
              </th>
              <th className="text-right">
                <SortButton
                  active={sortKey === "dofollowRatio"}
                  dir={sortDir}
                  onClick={() => toggle("dofollowRatio")}
                >
                  % Dofollow
                </SortButton>
              </th>
              <th>
                <SortButton
                  active={sortKey === "firstSeen"}
                  dir={sortDir}
                  onClick={() => toggle("firstSeen")}
                >
                  Primera vez
                </SortButton>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => (
              <tr key={d.domain} className="hover">
                <td className="max-w-xs truncate font-medium">
                  <a
                    href={`https://${d.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary hover:underline"
                  >
                    {d.domain}
                  </a>
                </td>
                <td className="text-right tabular-nums">
                  {d.rank != null ? d.rank : "—"}
                </td>
                <td className="text-right tabular-nums">
                  {d.backlinks.toLocaleString("es-ES")}
                </td>
                <td className="text-right tabular-nums">
                  {d.referringDomains != null
                    ? d.referringDomains.toLocaleString("es-ES")
                    : "—"}
                </td>
                <td className="text-right tabular-nums">
                  {d.dofollowRatio != null
                    ? `${(d.dofollowRatio * 100).toFixed(0)}%`
                    : "—"}
                </td>
                <td className="whitespace-nowrap text-xs text-base-content/70">
                  {formatDate(d.firstSeen)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
