import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useProjectContext } from "@/client/hooks/useProjectContext";
import {
  MapPin,
  Search,
  Star,
  Phone,
  Globe,
  FileDown,
  Sparkles,
  MessageSquare,
  ShieldCheck,
  ShieldX,
  Tag,
  Clock,
  ChevronDown,
  ChevronUp,
  Image,
  Map,
  DollarSign,
  Mail,
  CalendarCheck,
  BarChart3,
  TrendingUp,
  Target,
  CheckCircle2,
  XCircle,
  Camera,
} from "lucide-react";
import {
  searchLocalPack,
  getLocalKeywordSuggestions,
  getCityKeywordSuggestions,
} from "@/serverFunctions/local";
import {
  LOCATIONS,
  getLanguageCode,
  getCountryIso,
  formatNumber,
  csvEscape,
  calculatePriorityScore,
  getPriorityTier,
  priorityTierClass,
} from "@/client/features/keywords/utils";
import type { LocalPackResult } from "@/types/local";

export const Route = createFileRoute("/p/$projectId/local")({
  component: LocalPage,
});

// Day name translations
const DAY_NAMES: Record<string, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

const PRICE_LABELS: Record<string, string> = {
  inexpensive: "€",
  moderate: "€€",
  expensive: "€€€",
  very_expensive: "€€€€",
};

function BusinessCard({
  r,
  isExpanded,
  onToggle,
}: {
  r: LocalPackResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const allCategories = [r.category, ...r.additionalCategories].filter(Boolean);

  return (
    <div className="border border-base-300 rounded-lg bg-base-100 overflow-hidden">
      {/* Main row - always visible */}
      <div
        className="flex items-start gap-3 p-3 cursor-pointer hover:bg-base-200/50 transition-colors"
        onClick={onToggle}
      >
        {/* Position badge */}
        <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold tabular-nums">
          {r.position}
        </div>

        {/* Business info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <h3 className="font-semibold text-sm truncate flex-1">{r.title}</h3>
            {r.isClaimed === true && (
              <ShieldCheck className="size-4 text-success shrink-0" />
            )}
          </div>

          {/* Category + price */}
          <div className="flex items-center gap-2 mt-0.5">
            {r.category && (
              <span className="text-xs text-base-content/60">{r.category}</span>
            )}
            {r.priceLevel && (
              <span className="text-xs font-medium text-warning">
                {PRICE_LABELS[r.priceLevel] ?? r.priceLevel}
              </span>
            )}
          </div>

          {/* Rating + reviews inline */}
          <div className="flex items-center gap-3 mt-1">
            {r.rating != null && (
              <span
                className={`badge badge-sm gap-0.5 ${
                  r.rating >= 4.5
                    ? "badge-success"
                    : r.rating >= 4.0
                      ? "badge-warning"
                      : r.rating >= 3.0
                        ? "badge-info"
                        : "badge-error"
                }`}
              >
                <Star className="size-2.5" />
                {r.rating.toFixed(1)}
              </span>
            )}
            {r.reviewCount != null && (
              <span className="text-xs text-base-content/50">
                {formatNumber(r.reviewCount)} reseñas
              </span>
            )}
            {r.address && (
              <span className="text-xs text-base-content/40 truncate hidden md:inline">
                {r.address}
              </span>
            )}
          </div>
        </div>

        {/* Action links + expand */}
        <div className="shrink-0 flex items-center gap-1">
          {r.url && (
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <Globe className="size-3.5" />
            </a>
          )}
          {r.contactUrl && (
            <a
              href={r.contactUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <Mail className="size-3.5" />
            </a>
          )}
          {r.googleMapsUrl && (
            <a
              href={r.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <Map className="size-3.5" />
            </a>
          )}
          {isExpanded ? (
            <ChevronUp className="size-4 text-base-content/40" />
          ) : (
            <ChevronDown className="size-4 text-base-content/40" />
          )}
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-base-300 px-4 py-3 bg-base-200/30 space-y-3">
          {/* Snippet / description */}
          {r.snippet && (
            <p className="text-sm text-base-content/70">{r.snippet}</p>
          )}

          {/* Links row */}
          <div className="flex flex-wrap gap-2">
            {r.url && (
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-xs btn-outline gap-1"
              >
                <Globe className="size-3" />
                Web
              </a>
            )}
            {r.contactUrl && (
              <a
                href={r.contactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-xs btn-outline gap-1"
              >
                <Mail className="size-3" />
                Contacto
              </a>
            )}
            {r.bookOnlineUrl && (
              <a
                href={r.bookOnlineUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-xs btn-outline gap-1"
              >
                <CalendarCheck className="size-3" />
                Reservar
              </a>
            )}
            {r.googleMapsUrl && (
              <a
                href={r.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-xs btn-outline gap-1"
              >
                <Map className="size-3" />
                Google Maps
              </a>
            )}
            {r.phone && (
              <a
                href={`tel:${r.phone}`}
                className="btn btn-xs btn-outline gap-1"
              >
                <Phone className="size-3" />
                {r.phone}
              </a>
            )}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {/* Address */}
            {r.address && (
              <div>
                <span className="text-xs font-medium text-base-content/50 uppercase">
                  Dirección
                </span>
                <p className="text-base-content/80">{r.address}</p>
              </div>
            )}

            {/* Categories */}
            {allCategories.length > 0 && (
              <div>
                <span className="text-xs font-medium text-base-content/50 uppercase">
                  Categorías
                </span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {allCategories.map((cat, i) => (
                    <span
                      key={i}
                      className={`badge badge-xs ${i === 0 ? "badge-primary badge-outline" : "badge-ghost"}`}
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Photos */}
            {r.totalPhotos != null && r.totalPhotos > 0 && (
              <div>
                <span className="text-xs font-medium text-base-content/50 uppercase">
                  Fotos
                </span>
                <p className="text-base-content/80 flex items-center gap-1">
                  <Image className="size-3" />
                  {r.totalPhotos} fotos
                </p>
              </div>
            )}

            {/* Verified status */}
            <div>
              <span className="text-xs font-medium text-base-content/50 uppercase">
                Estado
              </span>
              <p className="flex items-center gap-1 text-base-content/80">
                {r.isClaimed === true ? (
                  <>
                    <ShieldCheck className="size-3.5 text-success" />
                    Ficha verificada
                  </>
                ) : r.isClaimed === false ? (
                  <>
                    <ShieldX className="size-3.5 text-base-content/40" />
                    No verificada
                  </>
                ) : (
                  "Desconocido"
                )}
              </p>
            </div>
          </div>

          {/* Rating distribution */}
          {r.ratingDistribution &&
            Object.keys(r.ratingDistribution).length > 0 && (
              <div>
                <span className="text-xs font-medium text-base-content/50 uppercase">
                  Distribución de reseñas
                </span>
                <div className="flex items-end gap-1 mt-1 h-10">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = r.ratingDistribution?.[String(star)] ?? 0;
                    const total = Object.values(r.ratingDistribution!).reduce(
                      (s, v) => s + v,
                      0,
                    );
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <div
                        key={star}
                        className="flex flex-col items-center gap-0.5 flex-1"
                      >
                        <div
                          className="w-full bg-warning/60 rounded-sm min-h-[2px]"
                          style={{ height: `${Math.max(2, pct * 0.4)}px` }}
                          title={`${star}★: ${count} (${pct.toFixed(0)}%)`}
                        />
                        <span className="text-[9px] text-base-content/40">
                          {star}★
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Work hours */}
          {r.workHours && Object.keys(r.workHours).length > 0 && (
            <div>
              <span className="text-xs font-medium text-base-content/50 uppercase flex items-center gap-1">
                <Clock className="size-3" />
                Horario
              </span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-0.5 mt-1 text-xs">
                {Object.entries(r.workHours).map(([day, hours]) => (
                  <div key={day} className="flex justify-between gap-2">
                    <span className="text-base-content/60">
                      {DAY_NAMES[day.toLowerCase()] ?? day}
                    </span>
                    <span className="text-base-content/80 tabular-nums">
                      {hours.join(", ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Local justifications */}
          {r.localJustifications.length > 0 && (
            <div>
              <span className="text-xs font-medium text-base-content/50 uppercase">
                Por qué aparece
              </span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {r.localJustifications.map((j, i) => (
                  <span key={i} className="badge badge-ghost badge-xs">
                    {j}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type SortField =
  | "keyword"
  | "searchVolume"
  | "cpc"
  | "keywordDifficulty"
  | "intent"
  | "priority";
type SortDir = "asc" | "desc";

function SortHeader({
  label,
  field,
  currentField,
  currentDir,
  onSort,
  align = "left",
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (f: SortField) => void;
  align?: "left" | "right" | "center";
}) {
  const active = currentField === field;
  const alignClass =
    align === "right"
      ? "justify-end"
      : align === "center"
        ? "justify-center"
        : "justify-start";
  return (
    <th
      className={`cursor-pointer select-none hover:text-base-content transition-colors ${active ? "text-base-content" : ""}`}
      onClick={() => onSort(field)}
    >
      <span className={`inline-flex items-center gap-0.5 ${alignClass}`}>
        {label}
        {active ? (
          currentDir === "asc" ? (
            <ChevronUp className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )
        ) : (
          <ChevronDown className="size-3 opacity-0 group-hover:opacity-30" />
        )}
      </span>
    </th>
  );
}

function KeywordTable({
  keywords,
  onExportCsv,
  showLocalColumn,
}: {
  keywords: Array<{
    keyword: string;
    searchVolume: number | null;
    cpc: number | null;
    keywordDifficulty: number | null;
    intent: string | null;
    hasLocalPack: boolean;
  }>;
  onExportCsv: () => void;
  showLocalColumn: boolean;
}) {
  const [sortField, setSortField] = useState<SortField>("priority");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      // Default desc for numeric fields, asc for keyword
      setSortDir(field === "keyword" ? "asc" : "desc");
    }
  };

  const sorted = useMemo(() => {
    const arr = [...keywords];
    const dir = sortDir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      switch (sortField) {
        case "keyword":
          return dir * a.keyword.localeCompare(b.keyword);
        case "searchVolume":
          return dir * ((a.searchVolume ?? -1) - (b.searchVolume ?? -1));
        case "cpc":
          return dir * ((a.cpc ?? -1) - (b.cpc ?? -1));
        case "keywordDifficulty":
          return (
            dir * ((a.keywordDifficulty ?? -1) - (b.keywordDifficulty ?? -1))
          );
        case "intent":
          return dir * (a.intent ?? "").localeCompare(b.intent ?? "");
        case "priority":
        default:
          return (
            dir *
            (calculatePriorityScore(
              a.searchVolume,
              a.keywordDifficulty,
              a.cpc,
            ) -
              calculatePriorityScore(
                b.searchVolume,
                b.keywordDifficulty,
                b.cpc,
              ))
          );
      }
    });

    return arr;
  }, [keywords, sortField, sortDir]);

  return (
    <div className="mt-3 border border-base-300 rounded-xl bg-base-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
        <span className="text-sm font-semibold">
          {keywords.length} keywords sugeridas
        </span>
        <button className="btn btn-ghost btn-xs gap-1" onClick={onExportCsv}>
          <FileDown className="size-3.5" />
          CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="table table-sm w-full">
          <thead>
            <tr className="text-xs text-base-content/60">
              <SortHeader
                label="Keyword"
                field="keyword"
                currentField={sortField}
                currentDir={sortDir}
                onSort={handleSort}
              />
              <SortHeader
                label="Volumen"
                field="searchVolume"
                currentField={sortField}
                currentDir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortHeader
                label="CPC"
                field="cpc"
                currentField={sortField}
                currentDir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortHeader
                label="Dificultad"
                field="keywordDifficulty"
                currentField={sortField}
                currentDir={sortDir}
                onSort={handleSort}
                align="center"
              />
              <SortHeader
                label="Intent"
                field="intent"
                currentField={sortField}
                currentDir={sortDir}
                onSort={handleSort}
                align="center"
              />
              {showLocalColumn && <th className="text-center">Local</th>}
              <SortHeader
                label="Prioridad"
                field="priority"
                currentField={sortField}
                currentDir={sortDir}
                onSort={handleSort}
                align="center"
              />
            </tr>
          </thead>
          <tbody>
            {sorted.map((kw, idx) => {
              const score = calculatePriorityScore(
                kw.searchVolume,
                kw.keywordDifficulty,
                kw.cpc,
              );
              const tier = getPriorityTier(score);
              return (
                <tr key={idx} className="hover:bg-base-200/50">
                  <td className="font-medium capitalize">{kw.keyword}</td>
                  <td className="text-right tabular-nums text-xs">
                    {kw.searchVolume != null
                      ? formatNumber(kw.searchVolume)
                      : "—"}
                  </td>
                  <td className="text-right tabular-nums text-xs">
                    {kw.cpc != null ? `${kw.cpc.toFixed(2)}€` : "—"}
                  </td>
                  <td className="text-center">
                    {kw.keywordDifficulty != null ? (
                      <span
                        className={`badge badge-sm ${
                          kw.keywordDifficulty <= 30
                            ? "badge-success"
                            : kw.keywordDifficulty <= 60
                              ? "badge-warning"
                              : "badge-error"
                        }`}
                      >
                        {kw.keywordDifficulty}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="text-center text-xs text-base-content/60">
                    {kw.intent ?? "—"}
                  </td>
                  {showLocalColumn && (
                    <td className="text-center">
                      {kw.hasLocalPack ? (
                        <MapPin className="size-3.5 text-success mx-auto" />
                      ) : (
                        <span className="text-base-content/30 text-xs">—</span>
                      )}
                    </td>
                  )}
                  <td className="text-center">
                    <span
                      className={`badge badge-sm ${priorityTierClass(tier)}`}
                    >
                      {score}
                    </span>
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

function LocalPage() {
  const { projectId } = Route.useParams();
  const { project, locationCode: projectLocationCode } =
    useProjectContext(projectId);
  const [keyword, setKeyword] = useState("");
  const [locationCode, setLocationCode] = useState(2724);
  const [searchTrigger, setSearchTrigger] = useState<{
    keyword: string;
    locationCode: number;
    languageCode: string;
  } | null>(null);

  // Pre-rellenamos keyword con targetKeyword o businessName, y el país con el
  // del proyecto. Sólo si los campos están vacíos (no pisamos al usuario).
  useEffect(() => {
    if (!project) return;
    if (keyword === "") {
      const seed = project.targetKeyword ?? project.businessName ?? "";
      if (seed) setKeyword(seed);
    }
    if (projectLocationCode != null && locationCode === 2724) {
      setLocationCode(projectLocationCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, projectLocationCode]);
  const [activeTab, setActiveTab] = useState<"pack" | "analysis" | "keywords">(
    "pack",
  );
  const [kwSubTab, setKwSubTab] = useState<"withCity" | "withoutCity">(
    "withCity",
  );
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

  // Local Pack query
  const packQuery = useQuery({
    queryKey: ["localPack", searchTrigger],
    queryFn: () => searchLocalPack({ data: searchTrigger! }),
    enabled: !!searchTrigger,
  });

  // Keyword suggestions query (with city in keyword)
  const suggestionsQuery = useQuery({
    queryKey: ["localKeywords", searchTrigger],
    queryFn: () =>
      getLocalKeywordSuggestions({
        data: { ...searchTrigger!, limit: 50 },
      }),
    enabled: !!searchTrigger,
  });

  // Detect city and base keyword from:
  // 1. Pattern "X en Y" (e.g., "pintor en terrassa")
  // 2. Pattern "X Y" where Y matches the city from Local Pack results
  const { detectedCity, baseKeyword } = useMemo(() => {
    if (!searchTrigger) return { detectedCity: null, baseKeyword: "" };
    const kw = searchTrigger.keyword.toLowerCase().trim();

    // Normalize accents for comparison
    const normalize = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    // 1. Try "X en Y" pattern
    const enMatch = kw.match(/^(.+?)\s+en\s+(.+)$/i);
    if (enMatch) {
      return {
        detectedCity: enMatch[2].trim(),
        baseKeyword: enMatch[1].trim(),
      };
    }

    // 2. Try to match city from Local Pack results (find first result with a city)
    const rawPackCity = packQuery.data?.results?.find((r) => r.city)?.city;
    // Pack city may come as "Barcelona,Catalonia,Spain" — extract just the city name
    const packCity = rawPackCity?.split(",")[0]?.trim() ?? null;
    if (packCity) {
      const packCityNorm = normalize(packCity);
      const kwNorm = normalize(kw);

      // Check if any word in the keyword matches the start of the city name
      // e.g., "castellon" matches "castellon de la plana"
      const kwWords = kwNorm.split(/\s+/);
      for (let i = 0; i < kwWords.length; i++) {
        const candidateCity = kwWords.slice(i).join(" ");
        const candidateBase = kwWords.slice(0, i).join(" ");
        // City match: the pack city starts with the candidate, or exact match
        if (
          candidateBase.length > 0 &&
          (packCityNorm.startsWith(candidateCity) ||
            packCityNorm === candidateCity ||
            candidateCity.startsWith(packCityNorm))
        ) {
          return {
            detectedCity: packCity.toLowerCase(),
            baseKeyword: candidateBase,
          };
        }
      }

      // 3. If pack city exists but doesn't match keyword words,
      //    still use it — the whole keyword is the base service
      return { detectedCity: packCity.toLowerCase(), baseKeyword: kw };
    }

    return { detectedCity: null, baseKeyword: kw };
  }, [searchTrigger, packQuery.data]);

  // City-level keyword suggestions via Google Ads API
  const cityKeywordsQuery = useQuery({
    queryKey: [
      "localCityKeywords",
      baseKeyword,
      detectedCity,
      searchTrigger?.languageCode,
    ],
    queryFn: () =>
      getCityKeywordSuggestions({
        data: {
          keyword: baseKeyword,
          cityName: detectedCity!,
          countryIso: getCountryIso(searchTrigger!.locationCode),
          languageCode: searchTrigger!.languageCode,
        },
      }),
    enabled: !!searchTrigger && !!detectedCity && !!baseKeyword,
  });

  const packResults = useMemo(
    () => packQuery.data?.results ?? [],
    [packQuery.data?.results],
  );
  const keywordSuggestions = suggestionsQuery.data?.keywords ?? [];
  const cityKeywords = cityKeywordsQuery.data?.keywords ?? [];
  const cityFound = cityKeywordsQuery.data?.cityFound ?? null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const kw = keyword.trim();
    if (!kw) {
      toast.error("Introduce un negocio o servicio + ciudad");
      return;
    }
    setExpandedCards(new Set());
    setSearchTrigger({
      keyword: kw,
      locationCode,
      languageCode: getLanguageCode(locationCode),
    });
  };

  const isLoading =
    packQuery.isLoading ||
    suggestionsQuery.isLoading ||
    cityKeywordsQuery.isLoading;

  const toggleCard = (idx: number) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedCards(new Set(packResults.map((_, i) => i)));
  };

  const collapseAll = () => {
    setExpandedCards(new Set());
  };

  // Stats from pack results
  const avgRating =
    packResults.filter((r) => r.rating != null).length > 0
      ? (
          packResults
            .filter((r) => r.rating != null)
            .reduce((acc, r) => acc + (r.rating ?? 0), 0) /
          packResults.filter((r) => r.rating != null).length
        ).toFixed(1)
      : null;
  const avgReviews =
    packResults.filter((r) => r.reviewCount != null).length > 0
      ? Math.round(
          packResults
            .filter((r) => r.reviewCount != null)
            .reduce((acc, r) => acc + (r.reviewCount ?? 0), 0) /
            packResults.filter((r) => r.reviewCount != null).length,
        )
      : null;
  const _claimed = packResults.filter((r) => r.isClaimed === true).length;
  const withWeb = packResults.filter((r) => r.url).length;

  // Competitive analysis data
  const analysis = useMemo(() => {
    if (packResults.length === 0) return null;
    const total = packResults.length;

    // --- Reseñas ---
    const withReviews = packResults.filter((r) => r.reviewCount != null);
    const totalReviews = withReviews.reduce(
      (s, r) => s + (r.reviewCount ?? 0),
      0,
    );
    const avgReviewCount =
      withReviews.length > 0
        ? Math.round(totalReviews / withReviews.length)
        : 0;
    const medianReviews = (() => {
      const sorted = withReviews
        .map((r) => r.reviewCount ?? 0)
        .toSorted((a, b) => a - b);
      if (sorted.length === 0) return 0;
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0
        ? sorted[mid]
        : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    })();
    const maxReviews = Math.max(
      0,
      ...withReviews.map((r) => r.reviewCount ?? 0),
    );
    const minReviews =
      withReviews.length > 0
        ? Math.min(...withReviews.map((r) => r.reviewCount ?? 0))
        : 0;

    // --- Rating ---
    const withRating = packResults.filter((r) => r.rating != null);
    const avgRatingNum =
      withRating.length > 0
        ? withRating.reduce((s, r) => s + (r.rating ?? 0), 0) /
          withRating.length
        : 0;
    const ratingsAbove4_5 = withRating.filter(
      (r) => (r.rating ?? 0) >= 4.5,
    ).length;

    // --- Categorías con % ---
    const catCounts: Record<string, number> = {};
    for (const r of packResults) {
      const all = [r.category, ...r.additionalCategories].filter(
        (c): c is string => !!c,
      );
      for (const c of all) {
        catCounts[c] = (catCounts[c] ?? 0) + 1;
      }
    }
    const categoriesRanked = Object.entries(catCounts)
      .toSorted((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.round((count / total) * 100),
      }));

    // --- Fotos ---
    const withPhotos = packResults.filter(
      (r) => r.totalPhotos != null && r.totalPhotos > 0,
    );
    const avgPhotos =
      withPhotos.length > 0
        ? Math.round(
            withPhotos.reduce((s, r) => s + (r.totalPhotos ?? 0), 0) /
              withPhotos.length,
          )
        : 0;
    const maxPhotos = Math.max(0, ...withPhotos.map((r) => r.totalPhotos ?? 0));
    const pctWithPhotos = Math.round((withPhotos.length / total) * 100);

    // --- Verificados ---
    const pctClaimed = Math.round(
      (packResults.filter((r) => r.isClaimed === true).length / total) * 100,
    );

    // --- Con web / contacto / reserva ---
    const pctWithWeb = Math.round(
      (packResults.filter((r) => r.url).length / total) * 100,
    );
    const pctWithContact = Math.round(
      (packResults.filter((r) => r.contactUrl).length / total) * 100,
    );
    const pctWithBooking = Math.round(
      (packResults.filter((r) => r.bookOnlineUrl).length / total) * 100,
    );

    // --- Precio ---
    const priceCounts: Record<string, number> = {};
    for (const r of packResults) {
      if (r.priceLevel)
        priceCounts[r.priceLevel] = (priceCounts[r.priceLevel] ?? 0) + 1;
    }
    const priceDistribution = Object.entries(priceCounts)
      .toSorted((a, b) => b[1] - a[1])
      .map(([level, count]) => ({
        level,
        label: PRICE_LABELS[level] ?? level,
        count,
        pct: Math.round((count / total) * 100),
      }));

    // --- Horarios ---
    const dayOpenCounts: Record<string, number> = {};
    const openHours: number[] = [];
    const closeHours: number[] = [];
    for (const r of packResults) {
      if (!r.workHours) continue;
      for (const [day, slots] of Object.entries(r.workHours)) {
        dayOpenCounts[day] = (dayOpenCounts[day] ?? 0) + 1;
        for (const slot of slots) {
          const match = slot.match(/^(\d{2}):(\d{2}) - (\d{2}):(\d{2})$/);
          if (match) {
            openHours.push(parseInt(match[1]) * 60 + parseInt(match[2]));
            closeHours.push(parseInt(match[3]) * 60 + parseInt(match[4]));
          }
        }
      }
    }
    const withHours = packResults.filter(
      (r) => r.workHours && Object.keys(r.workHours).length > 0,
    ).length;
    const pctWithHours = Math.round((withHours / total) * 100);

    const dayOrder = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];
    const daysOpen = dayOrder
      .filter((d) => d in dayOpenCounts)
      .map((d) => ({
        day: d,
        count: dayOpenCounts[d] ?? 0,
        pct: Math.round(((dayOpenCounts[d] ?? 0) / withHours) * 100),
      }));

    const avgOpen =
      openHours.length > 0
        ? Math.round(openHours.reduce((s, v) => s + v, 0) / openHours.length)
        : null;
    const avgClose =
      closeHours.length > 0
        ? Math.round(closeHours.reduce((s, v) => s + v, 0) / closeHours.length)
        : null;
    const formatMinutes = (m: number) =>
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

    // --- Justificaciones ---
    const justCounts: Record<string, number> = {};
    for (const r of packResults) {
      for (const j of r.localJustifications) {
        justCounts[j] = (justCounts[j] ?? 0) + 1;
      }
    }
    const topJustifications = Object.entries(justCounts)
      .toSorted((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([text, count]) => ({ text, count }));

    return {
      total,
      avgReviewCount,
      medianReviews,
      maxReviews,
      minReviews,
      totalReviews,
      avgRatingNum,
      ratingsAbove4_5,
      categoriesRanked,
      avgPhotos,
      maxPhotos,
      pctWithPhotos,
      pctClaimed,
      pctWithWeb,
      pctWithContact,
      pctWithBooking,
      priceDistribution,
      pctWithHours,
      daysOpen,
      avgOpen,
      avgClose,
      formatMinutes,
      topJustifications,
    };
  }, [packResults]);

  const handleExportPackCsv = () => {
    if (packResults.length === 0) return;
    const headers = [
      "Posición",
      "Nombre",
      "Rating",
      "Reseñas",
      "Categoría",
      "Categorías Extra",
      "Dirección",
      "Ciudad",
      "Teléfono",
      "Web",
      "Contacto URL",
      "Google Maps",
      "Verificado",
      "Descripción",
      "Precio",
      "Fotos",
    ];
    const csvRows = packResults.map((r) =>
      [
        r.position,
        csvEscape(r.title),
        r.rating ?? "",
        r.reviewCount ?? "",
        csvEscape(r.category ?? ""),
        csvEscape(r.additionalCategories.join("; ")),
        csvEscape(r.address ?? ""),
        csvEscape(r.city ?? ""),
        csvEscape(r.phone ?? ""),
        csvEscape(r.url ?? ""),
        csvEscape(r.contactUrl ?? ""),
        csvEscape(r.googleMapsUrl ?? ""),
        r.isClaimed === true ? "Sí" : r.isClaimed === false ? "No" : "",
        csvEscape(r.snippet ?? ""),
        r.priceLevel ?? "",
        r.totalPhotos ?? "",
      ].join(","),
    );
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `local-pack-${keyword.replace(/\s+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportKeywordsCsv = () => {
    if (keywordSuggestions.length === 0) return;
    const headers = [
      "Keyword",
      "Volumen",
      "CPC",
      "Dificultad",
      "Intent",
      "Local",
      "Prioridad",
    ];
    const csvRows = keywordSuggestions.map((k) => {
      const score = calculatePriorityScore(
        k.searchVolume,
        k.keywordDifficulty,
        k.cpc,
      );
      return [
        csvEscape(k.keyword),
        k.searchVolume ?? "",
        k.cpc?.toFixed(2) ?? "",
        k.keywordDifficulty ?? "",
        k.intent ?? "",
        k.hasLocalPack ? "Sí" : "No",
        score,
      ].join(",");
    });
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `local-keywords-${keyword.replace(/\s+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCityKeywordsCsv = () => {
    if (cityKeywords.length === 0) return;
    const headers = [
      "Keyword",
      "Volumen",
      "CPC",
      "Dificultad",
      "Intent",
      "Prioridad",
    ];
    const csvRows = cityKeywords.map((k) => {
      const score = calculatePriorityScore(
        k.searchVolume,
        k.keywordDifficulty,
        k.cpc,
      );
      return [
        csvEscape(k.keyword),
        k.searchVolume ?? "",
        k.cpc?.toFixed(2) ?? "",
        k.keywordDifficulty ?? "",
        k.intent ?? "",
        score,
      ].join(",");
    });
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `city-keywords-${baseKeyword}-${detectedCity ?? ""}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 md:px-6 pt-4 pb-2 max-w-8xl mx-auto w-full">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MapPin className="size-5" />
            SEO Local
          </h1>
          <p className="text-sm text-base-content/60">
            Analiza el Local Pack de Google Maps: web, contacto, categorías,
            horarios y más.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="mt-3 flex gap-2 flex-wrap">
          <input
            className="input input-bordered input-sm flex-1 min-w-[200px]"
            placeholder="ej: fontanero terrassa, dentista madrid..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <select
            className="select select-bordered select-sm"
            value={locationCode}
            onChange={(e) => setLocationCode(Number(e.target.value))}
          >
            {Object.entries(LOCATIONS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="btn btn-sm btn-primary gap-1"
            disabled={isLoading}
          >
            <Search className="size-3.5" />
            {isLoading ? "Buscando..." : "Buscar"}
          </button>
        </form>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
        <div className="mx-auto w-full max-w-8xl">
          {!searchTrigger ? (
            <div className="mt-12 text-center space-y-3">
              <MapPin className="size-12 mx-auto text-base-content/30" />
              <p className="text-lg font-medium text-base-content/70">
                Analiza el Local Pack de Google
              </p>
              <p className="text-sm text-base-content/50 max-w-md mx-auto">
                Introduce un tipo de negocio + ciudad para ver quién aparece en
                Google Maps con datos completos: web, teléfono, categorías,
                horarios y ficha de Google.
              </p>
            </div>
          ) : isLoading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {/* Stats cards */}
              {packResults.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  <div className="border border-base-300 rounded-lg bg-base-100 p-3 text-center">
                    <p className="text-2xl font-bold">{packResults.length}</p>
                    <p className="text-xs text-base-content/50 flex items-center justify-center gap-1">
                      <MapPin className="size-3" /> Resultados
                    </p>
                  </div>
                  <div className="border border-base-300 rounded-lg bg-base-100 p-3 text-center">
                    <p className="text-2xl font-bold text-warning">
                      {avgRating ?? "—"}
                    </p>
                    <p className="text-xs text-base-content/50 flex items-center justify-center gap-1">
                      <Star className="size-3" /> Rating Medio
                    </p>
                  </div>
                  <div className="border border-base-300 rounded-lg bg-base-100 p-3 text-center">
                    <p className="text-2xl font-bold text-info">
                      {avgReviews != null ? formatNumber(avgReviews) : "—"}
                    </p>
                    <p className="text-xs text-base-content/50 flex items-center justify-center gap-1">
                      <MessageSquare className="size-3" /> Reseñas Prom.
                    </p>
                  </div>
                  <div className="border border-base-300 rounded-lg bg-base-100 p-3 text-center">
                    <p className="text-2xl font-bold text-success">
                      {withWeb}/{packResults.length}
                    </p>
                    <p className="text-xs text-base-content/50 flex items-center justify-center gap-1">
                      <Globe className="size-3" /> Con web
                    </p>
                  </div>
                </div>
              )}

              {/* Tab navigation */}
              <div className="tabs tabs-bordered mt-4">
                <button
                  className={`tab tab-sm ${activeTab === "pack" ? "tab-active" : ""}`}
                  onClick={() => setActiveTab("pack")}
                >
                  <MapPin className="size-3.5 mr-1" />
                  Local Pack ({packResults.length})
                </button>
                <button
                  className={`tab tab-sm ${activeTab === "analysis" ? "tab-active" : ""}`}
                  onClick={() => setActiveTab("analysis")}
                >
                  <BarChart3 className="size-3.5 mr-1" />
                  Análisis Competitivo
                </button>
                <button
                  className={`tab tab-sm ${activeTab === "keywords" ? "tab-active" : ""}`}
                  onClick={() => setActiveTab("keywords")}
                >
                  <Sparkles className="size-3.5 mr-1" />
                  Keywords Locales (
                  {keywordSuggestions.length + cityKeywords.length})
                </button>
              </div>

              {/* Local Pack tab */}
              {activeTab === "pack" && (
                <>
                  {packResults.length === 0 ? (
                    <div className="mt-8 text-center text-base-content/50 text-sm">
                      No se encontraron resultados de Google Maps para esta
                      búsqueda.
                    </div>
                  ) : (
                    <>
                      {/* Toolbar */}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            {packResults.length} negocios en Google Maps
                          </span>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={expandAll}
                          >
                            Expandir todos
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={collapseAll}
                          >
                            Contraer
                          </button>
                        </div>
                        <button
                          className="btn btn-ghost btn-xs gap-1"
                          onClick={handleExportPackCsv}
                        >
                          <FileDown className="size-3.5" />
                          CSV
                        </button>
                      </div>

                      {/* Business cards */}
                      <div className="mt-2 space-y-2">
                        {packResults.map((r, idx) => (
                          <BusinessCard
                            key={idx}
                            r={r}
                            isExpanded={expandedCards.has(idx)}
                            onToggle={() => toggleCard(idx)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Analysis tab */}
              {activeTab === "analysis" && analysis && (
                <div className="mt-3 space-y-4">
                  {/* Section: Reseñas y Rating */}
                  <div className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-base-300 bg-base-200/30">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Star className="size-4 text-warning" />
                        Reseñas y Rating
                      </h3>
                      <p className="text-xs text-base-content/50 mt-0.5">
                        Cómo gestionan las reseñas tus competidores en esta zona
                      </p>
                    </div>
                    <div className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-warning">
                            {analysis.avgRatingNum.toFixed(1)}
                          </p>
                          <p className="text-xs text-base-content/50">
                            Rating medio
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold">
                            {formatNumber(analysis.avgReviewCount)}
                          </p>
                          <p className="text-xs text-base-content/50">
                            Media reseñas
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-info">
                            {formatNumber(analysis.medianReviews)}
                          </p>
                          <p className="text-xs text-base-content/50">
                            Mediana reseñas
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-success">
                            {Math.round(
                              (analysis.ratingsAbove4_5 / analysis.total) * 100,
                            )}
                            %
                          </p>
                          <p className="text-xs text-base-content/50">
                            Con 4.5+ estrellas
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-4 text-xs text-base-content/50">
                        <span>
                          Mín: {formatNumber(analysis.minReviews)} reseñas
                        </span>
                        <span>
                          Máx: {formatNumber(analysis.maxReviews)} reseñas
                        </span>
                        <span>
                          Total: {formatNumber(analysis.totalReviews)} reseñas
                          en la zona
                        </span>
                      </div>
                      <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                        <p className="text-xs font-medium text-primary flex items-center gap-1">
                          <Target className="size-3" /> Objetivo para competir
                        </p>
                        <p className="text-xs text-base-content/70 mt-1">
                          Para estar al nivel de la competencia necesitas al
                          menos{" "}
                          <strong>
                            {formatNumber(analysis.medianReviews)} reseñas
                          </strong>{" "}
                          con un rating de{" "}
                          <strong>
                            {Math.max(analysis.avgRatingNum, 4.0).toFixed(1)}+
                          </strong>
                          . El líder tiene {formatNumber(analysis.maxReviews)}{" "}
                          reseñas.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section: Categorías */}
                  <div className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-base-300 bg-base-200/30">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Tag className="size-4 text-secondary" />
                        Categorías utilizadas
                      </h3>
                      <p className="text-xs text-base-content/50 mt-0.5">
                        Qué categorías de Google Business usan los negocios de
                        la zona
                      </p>
                    </div>
                    <div className="p-4">
                      <div className="space-y-2">
                        {analysis.categoriesRanked.map((cat, i) => (
                          <div
                            key={cat.name}
                            className="flex items-center gap-3"
                          >
                            <span className="text-xs text-base-content/40 w-5 text-right tabular-nums">
                              {i + 1}
                            </span>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-sm">{cat.name}</span>
                                <span className="text-xs text-base-content/50 tabular-nums">
                                  {cat.count}/{analysis.total} ({cat.pct}%)
                                </span>
                              </div>
                              <div className="w-full bg-base-200 rounded-full h-1.5">
                                <div
                                  className="bg-secondary/60 h-1.5 rounded-full"
                                  style={{ width: `${cat.pct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {analysis.categoriesRanked.length > 0 && (
                        <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                          <p className="text-xs font-medium text-primary flex items-center gap-1">
                            <Target className="size-3" /> Recomendación
                          </p>
                          <p className="text-xs text-base-content/70 mt-1">
                            La categoría principal más usada es{" "}
                            <strong>
                              &quot;{analysis.categoriesRanked[0].name}&quot;
                            </strong>{" "}
                            ({analysis.categoriesRanked[0].pct}%). Usa esta como
                            categoría principal y añade las secundarias más
                            relevantes para maximizar tu visibilidad.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section: Presencia online */}
                  <div className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-base-300 bg-base-200/30">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Globe className="size-4 text-info" />
                        Presencia online
                      </h3>
                      <p className="text-xs text-base-content/50 mt-0.5">
                        Qué elementos tienen las fichas de la competencia
                      </p>
                    </div>
                    <div className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                          {
                            label: "Ficha verificada",
                            pct: analysis.pctClaimed,
                            icon: ShieldCheck,
                            color: "text-success",
                          },
                          {
                            label: "Con web",
                            pct: analysis.pctWithWeb,
                            icon: Globe,
                            color: "text-info",
                          },
                          {
                            label: "Con pág. contacto",
                            pct: analysis.pctWithContact,
                            icon: Mail,
                            color: "text-primary",
                          },
                          {
                            label: "Con reserva online",
                            pct: analysis.pctWithBooking,
                            icon: CalendarCheck,
                            color: "text-secondary",
                          },
                          {
                            label: "Con fotos",
                            pct: analysis.pctWithPhotos,
                            icon: Camera,
                            color: "text-warning",
                          },
                          {
                            label: "Con horarios",
                            pct: analysis.pctWithHours,
                            icon: Clock,
                            color: "text-accent",
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="flex items-center gap-3 p-2 border border-base-200 rounded-lg"
                          >
                            <div className={`shrink-0 ${item.color}`}>
                              <item.icon className="size-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-base-content/60 truncate">
                                  {item.label}
                                </span>
                                <span className="text-sm font-bold tabular-nums">
                                  {item.pct}%
                                </span>
                              </div>
                              <div className="w-full bg-base-200 rounded-full h-1 mt-1">
                                <div
                                  className={`h-1 rounded-full ${item.pct >= 80 ? "bg-success" : item.pct >= 50 ? "bg-warning" : "bg-error"}`}
                                  style={{ width: `${item.pct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                        <p className="text-xs font-medium text-primary flex items-center gap-1">
                          <Target className="size-3" /> Checklist para tu ficha
                        </p>
                        <div className="mt-1 space-y-0.5">
                          {[
                            {
                              done: true,
                              text: "Verificar la ficha de Google Business",
                            },
                            {
                              done: analysis.pctWithWeb >= 50,
                              text: `Añadir web (${analysis.pctWithWeb}% la tienen)`,
                            },
                            {
                              done: analysis.pctWithContact >= 30,
                              text: `Añadir página de contacto (${analysis.pctWithContact}% la tienen)`,
                            },
                            {
                              done: analysis.pctWithPhotos >= 50,
                              text: `Subir fotos — media: ${analysis.avgPhotos}, líder: ${formatNumber(analysis.maxPhotos)}`,
                            },
                            {
                              done: analysis.pctWithHours >= 50,
                              text: `Publicar horarios (${analysis.pctWithHours}% los tienen)`,
                            },
                          ].map((item, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 text-xs text-base-content/70"
                            >
                              {item.done ? (
                                <CheckCircle2 className="size-3 text-success shrink-0" />
                              ) : (
                                <XCircle className="size-3 text-error shrink-0" />
                              )}
                              {item.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Fotos */}
                  <div className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-base-300 bg-base-200/30">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Camera className="size-4 text-warning" />
                        Fotos
                      </h3>
                    </div>
                    <div className="p-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold">
                            {analysis.avgPhotos}
                          </p>
                          <p className="text-xs text-base-content/50">
                            Media fotos
                          </p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-warning">
                            {formatNumber(analysis.maxPhotos)}
                          </p>
                          <p className="text-xs text-base-content/50">Máximo</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-info">
                            {analysis.pctWithPhotos}%
                          </p>
                          <p className="text-xs text-base-content/50">
                            Tienen fotos
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                        <p className="text-xs text-base-content/70">
                          Sube al menos{" "}
                          <strong>
                            {Math.max(analysis.avgPhotos, 10)} fotos
                          </strong>{" "}
                          de calidad (fachada, interior, equipo, trabajos
                          realizados) para superar la media de la zona.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section: Horarios */}
                  {analysis.daysOpen.length > 0 && (
                    <div className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
                      <div className="px-4 py-3 border-b border-base-300 bg-base-200/30">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <Clock className="size-4 text-accent" />
                          Horarios de la competencia
                        </h3>
                        <p className="text-xs text-base-content/50 mt-0.5">
                          Días y horas habituales de apertura (
                          {analysis.pctWithHours}% publican horarios)
                        </p>
                      </div>
                      <div className="p-4">
                        <div className="space-y-1.5">
                          {analysis.daysOpen.map((d) => (
                            <div
                              key={d.day}
                              className="flex items-center gap-3"
                            >
                              <span className="text-xs w-20 text-base-content/60">
                                {DAY_NAMES[d.day] ?? d.day}
                              </span>
                              <div className="flex-1">
                                <div className="w-full bg-base-200 rounded-full h-2">
                                  <div
                                    className="bg-accent/60 h-2 rounded-full"
                                    style={{ width: `${d.pct}%` }}
                                  />
                                </div>
                              </div>
                              <span className="text-xs text-base-content/50 tabular-nums w-16 text-right">
                                {d.count} ({d.pct}%)
                              </span>
                            </div>
                          ))}
                        </div>
                        {analysis.avgOpen != null &&
                          analysis.avgClose != null && (
                            <div className="mt-3 flex gap-4 text-sm">
                              <span className="text-base-content/60">
                                Apertura media:{" "}
                                <strong>
                                  {analysis.formatMinutes(analysis.avgOpen)}
                                </strong>
                              </span>
                              <span className="text-base-content/60">
                                Cierre medio:{" "}
                                <strong>
                                  {analysis.formatMinutes(analysis.avgClose)}
                                </strong>
                              </span>
                            </div>
                          )}
                      </div>
                    </div>
                  )}

                  {/* Section: Precio */}
                  {analysis.priceDistribution.length > 0 && (
                    <div className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
                      <div className="px-4 py-3 border-b border-base-300 bg-base-200/30">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <DollarSign className="size-4 text-success" />
                          Nivel de precios
                        </h3>
                      </div>
                      <div className="p-4">
                        <div className="flex gap-3">
                          {analysis.priceDistribution.map((p) => (
                            <div
                              key={p.level}
                              className="flex-1 text-center p-2 border border-base-200 rounded-lg"
                            >
                              <p className="text-lg font-bold">{p.label}</p>
                              <p className="text-xs text-base-content/50">
                                {p.count} negocios ({p.pct}%)
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Section: Justificaciones */}
                  {analysis.topJustifications.length > 0 && (
                    <div className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
                      <div className="px-4 py-3 border-b border-base-300 bg-base-200/30">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <TrendingUp className="size-4 text-primary" />
                          Por qué posicionan (Justificaciones de Google)
                        </h3>
                        <p className="text-xs text-base-content/50 mt-0.5">
                          Razones que Google muestra para recomendar estos
                          negocios
                        </p>
                      </div>
                      <div className="p-4">
                        <div className="flex flex-wrap gap-2">
                          {analysis.topJustifications.map((j, i) => (
                            <span
                              key={i}
                              className="badge badge-outline badge-sm gap-1"
                            >
                              {j.text}
                              <span className="text-base-content/40">
                                ×{j.count}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Keywords tab */}
              {activeTab === "keywords" && (
                <>
                  {/* Sub-tabs: Con ciudad / Sin ciudad */}
                  {detectedCity && (
                    <div className="flex items-center gap-2 mt-3">
                      <div className="join">
                        <button
                          className={`join-item btn btn-xs ${kwSubTab === "withCity" ? "btn-primary" : "btn-ghost"}`}
                          onClick={() => setKwSubTab("withCity")}
                        >
                          Con ciudad ({keywordSuggestions.length})
                        </button>
                        <button
                          className={`join-item btn btn-xs ${kwSubTab === "withoutCity" ? "btn-primary" : "btn-ghost"}`}
                          onClick={() => setKwSubTab("withoutCity")}
                        >
                          Sin ciudad (
                          {cityKeywordsQuery.isLoading
                            ? "..."
                            : cityKeywords.length}
                          )
                        </button>
                      </div>
                      <span className="text-xs text-base-content/50">
                        📍 Ciudad detectada:{" "}
                        <span className="capitalize font-medium">
                          {cityFound ?? detectedCity}
                        </span>
                        {kwSubTab === "withoutCity" && (
                          <>
                            {" "}
                            — Buscando «{baseKeyword}» ubicado en{" "}
                            {cityFound ?? detectedCity} (Google Ads)
                          </>
                        )}
                      </span>
                    </div>
                  )}

                  {/* "Con ciudad" sub-tab (original behavior) */}
                  {kwSubTab === "withCity" && (
                    <>
                      {suggestionsQuery.isLoading ? (
                        <div className="mt-4 space-y-3">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div
                              key={i}
                              className="skeleton h-12 w-full rounded-lg"
                            />
                          ))}
                        </div>
                      ) : keywordSuggestions.length === 0 ? (
                        <div className="mt-8 text-center text-base-content/50 text-sm">
                          No se encontraron sugerencias de keywords para esta
                          búsqueda.
                        </div>
                      ) : (
                        <KeywordTable
                          keywords={keywordSuggestions}
                          onExportCsv={handleExportKeywordsCsv}
                          showLocalColumn
                        />
                      )}
                    </>
                  )}

                  {/* "Sin ciudad" sub-tab (city-level location) */}
                  {kwSubTab === "withoutCity" && (
                    <>
                      {!detectedCity ? (
                        <div className="mt-8 text-center text-base-content/50 text-sm">
                          No se ha detectado la ciudad. Usa el formato «servicio
                          en ciudad» (ej: pintor en terrassa).
                        </div>
                      ) : cityKeywordsQuery.isLoading ? (
                        <div className="mt-4 space-y-3">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <div
                              key={i}
                              className="skeleton h-12 w-full rounded-lg"
                            />
                          ))}
                        </div>
                      ) : cityKeywords.length === 0 ? (
                        <div className="mt-8 text-center text-base-content/50 text-sm">
                          No se encontraron keywords para «{baseKeyword}» en{" "}
                          {cityFound ?? detectedCity}.
                        </div>
                      ) : (
                        <KeywordTable
                          keywords={cityKeywords}
                          onExportCsv={() => handleExportCityKeywordsCsv()}
                          showLocalColumn={false}
                        />
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
