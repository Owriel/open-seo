// Tabla "Backlinks" con filtros:
//   - Solo dofollow (toggle).
//   - Idioma (select dinámico basado en los idiomas presentes en la muestra).
//   - DR mínimo del dominio referente.
//   - Búsqueda en anchor (text contains).

import { useMemo, useState } from "react";
import { Link2, Search, Filter, ExternalLink } from "lucide-react";
import type { BacklinkItem } from "@/types/backlinks";

type Props = {
  backlinks: BacklinkItem[];
};

// Devuelve idiomas únicos presentes en la muestra, ordenados alfabéticamente.
function collectLanguages(bls: BacklinkItem[]): string[] {
  const set = new Set<string>();
  for (const bl of bls) {
    if (bl.pageFromLanguage) set.add(bl.pageFromLanguage);
  }
  return Array.from(set).toSorted();
}

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

// oxlint-disable-next-line max-lines-per-function -- Tabla con filtros + render condicional
export default function BacklinksTable({ backlinks }: Props) {
  const [onlyDofollow, setOnlyDofollow] = useState(false);
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [minDr, setMinDr] = useState(0);
  const [anchorQuery, setAnchorQuery] = useState("");

  const languages = useMemo(() => collectLanguages(backlinks), [backlinks]);

  const filtered = useMemo(() => {
    const q = anchorQuery.trim().toLowerCase();
    return backlinks.filter((bl) => {
      if (onlyDofollow && bl.dofollow !== true) return false;
      if (languageFilter !== "all" && bl.pageFromLanguage !== languageFilter)
        return false;
      if (minDr > 0 && (bl.domainFromRank ?? 0) < minDr) return false;
      if (q.length > 0 && !(bl.anchor?.toLowerCase().includes(q) ?? false))
        return false;
      return true;
    });
  }, [backlinks, onlyDofollow, languageFilter, minDr, anchorQuery]);

  if (backlinks.length === 0) {
    return (
      <div className="border border-dashed border-base-300 rounded-xl p-8 text-center text-sm text-base-content/50">
        <Link2 className="size-6 mx-auto mb-2 opacity-40" />
        No hay backlinks en la muestra de este análisis.
      </div>
    );
  }

  return (
    <div className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-base-300 bg-base-200/30 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Link2 className="size-4 text-primary" />
            Backlinks ({filtered.length}
            {filtered.length !== backlinks.length && ` / ${backlinks.length}`})
          </h3>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="form-control">
            <span className="label label-text text-[10px] font-medium">
              Solo dofollow
            </span>
            <div className="flex items-center h-8">
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-primary"
                checked={onlyDofollow}
                onChange={(e) => setOnlyDofollow(e.target.checked)}
              />
            </div>
          </label>

          <label className="form-control">
            <span className="label label-text text-[10px] font-medium">
              Idioma
            </span>
            <select
              className="select select-bordered select-xs"
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang.toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <label className="form-control">
            <span className="label label-text text-[10px] font-medium">
              DR mínimo del dominio referente
            </span>
            <input
              type="number"
              className="input input-bordered input-xs w-24"
              min={0}
              max={100}
              step={5}
              value={minDr}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) setMinDr(Math.max(0, Math.min(100, v)));
              }}
            />
          </label>

          <label className="form-control flex-1 min-w-[200px]">
            <span className="label label-text text-[10px] font-medium">
              Buscar en anchor
            </span>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-base-content/40" />
              <input
                type="text"
                className="input input-bordered input-xs pl-6 w-full"
                placeholder="ej: seo, comprar..."
                value={anchorQuery}
                onChange={(e) => setAnchorQuery(e.target.value)}
              />
            </div>
          </label>

          {(onlyDofollow ||
            languageFilter !== "all" ||
            minDr > 0 ||
            anchorQuery !== "") && (
            <button
              type="button"
              className="btn btn-ghost btn-xs gap-1"
              onClick={() => {
                setOnlyDofollow(false);
                setLanguageFilter("all");
                setMinDr(0);
                setAnchorQuery("");
              }}
            >
              <Filter className="size-3" />
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
        <table className="table table-sm">
          <thead className="sticky top-0 bg-base-100 z-10">
            <tr>
              <th>URL origen</th>
              <th>Anchor</th>
              <th>Tipo</th>
              <th className="text-right">DR</th>
              <th>URL destino</th>
              <th>Primera vez</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((bl, i) => (
              <tr key={`${bl.urlFrom ?? "no-url"}-${i}`} className="hover">
                <td className="max-w-[240px]">
                  {bl.urlFrom ? (
                    <a
                      href={bl.urlFrom}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs hover:text-primary hover:underline truncate max-w-full"
                      title={bl.urlFrom}
                    >
                      <span className="truncate">{bl.urlFrom}</span>
                      <ExternalLink className="size-2.5 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-base-content/40">—</span>
                  )}
                  <p className="text-[10px] text-base-content/50 truncate">
                    {bl.domainFrom ?? ""}
                    {bl.pageFromLanguage && ` · ${bl.pageFromLanguage}`}
                  </p>
                </td>
                <td className="max-w-[180px]">
                  <span
                    className="inline-block max-w-full truncate text-xs"
                    title={bl.anchor ?? ""}
                  >
                    {bl.anchor ?? (
                      <span className="text-base-content/40">(vacío)</span>
                    )}
                  </span>
                </td>
                <td>
                  <span
                    className={`badge badge-xs ${
                      bl.dofollow ? "badge-success" : "badge-warning"
                    }`}
                  >
                    {bl.dofollow ? "dofollow" : "nofollow"}
                  </span>
                  {bl.itemType && (
                    <p className="text-[10px] text-base-content/50 mt-0.5">
                      {bl.itemType}
                    </p>
                  )}
                </td>
                <td className="text-right tabular-nums">
                  {bl.domainFromRank != null ? bl.domainFromRank : "—"}
                </td>
                <td className="max-w-[220px]">
                  {bl.urlTo ? (
                    <a
                      href={bl.urlTo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs hover:text-primary hover:underline truncate max-w-full"
                      title={bl.urlTo}
                    >
                      {bl.urlTo}
                    </a>
                  ) : (
                    <span className="text-base-content/40">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap text-xs text-base-content/70">
                  {formatDate(bl.firstSeen)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
