import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Languages,
  Plus,
  Trash2,
  RefreshCw,
  FileDown,
  Search,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  X,
  Tag,
  FolderPlus,
  Eye,
  Sparkles,
  ExternalLink,
  Star,
  ChevronRight,
} from "lucide-react";
import {
  getMultilangData,
  addFichas,
  analyzeSingleFicha,
  deleteFicha,
  deleteAllFichas,
  createCategory,
  updateCategory,
  deleteCategory,
  assignCategory,
  searchPlacesAction,
  deleteFichasBulk,
} from "@/serverFunctions/multilang";
import type {
  MultilangDB,
  MultilangFicha,
  MultilangCategory,
  MultilangVariant,
  PlaceSearchResult,
} from "@/types/multilang";

export const Route = createFileRoute("/p/$projectId/multilang")({
  component: MultilangPage,
});

// ============================================================================
// Helpers
// ============================================================================

/** Calcula estado de keywords para una ficha dada una categoría */
function computeKeywordStatus(ficha: MultilangFicha, cat: MultilangCategory) {
  const found: { keyword: string; variants: MultilangVariant[] }[] = [];
  const missing: string[] = [];
  for (const kw of cat.keywords) {
    const kwL = kw.toLowerCase();
    const matched = (ficha.variants || []).filter((v) =>
      v.name.toLowerCase().includes(kwL),
    );
    if (matched.length > 0) found.push({ keyword: kw, variants: matched });
    else missing.push(kw);
  }
  return { found, missing };
}

// ============================================================================
// Componente principal
// ============================================================================

function MultilangPage() {
  const { projectId } = Route.useParams();

  // Estado principal
  const [db, setDb] = useState<MultilangDB>({ fichas: [], categories: [] });
  const [loaded, setLoaded] = useState(false);
  const [bulkInput, setBulkInput] = useState("");

  // Estado de análisis
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({
    current: 0,
    total: 0,
    name: "",
  });

  // Filtros
  const [searchText, setSearchText] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "multi" | "nomulti" | "pending" | "error"
  >("all");
  const [filterCatId, setFilterCatId] = useState("");

  // Categorías UI
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState("");

  // Modal categoría
  const [showCatModal, setShowCatModal] = useState(false);
  const [catModalName, setCatModalName] = useState("");
  const [catModalKeywords, setCatModalKeywords] = useState("");

  // Cards expandidas
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [expandedLangTables, setExpandedLangTables] = useState<Set<string>>(
    new Set(),
  );

  // Bulk select
  const [selectedFichas, setSelectedFichas] = useState<Set<string>>(new Set());

  // Buscador de Google Places
  const [placesQuery, setPlacesQuery] = useState("");
  const [placesResults, setPlacesResults] = useState<PlaceSearchResult[]>([]);
  const [placesSearching, setPlacesSearching] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const _searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Carga inicial ──
  const loadData = useCallback(async () => {
    try {
      const data = await getMultilangData({ data: { projectId } });
      setDb(data);
      setLoaded(true);
    } catch (err) {
      toast.error(
        "Error al cargar datos: " +
          (err instanceof Error ? err.message : "Error desconocido"),
      );
    }
  }, [projectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── Buscador de Google Places ──

  const handlePlacesSearch = async (query?: string) => {
    const q = query ?? placesQuery;
    if (q.trim().length < 2) return;
    setPlacesSearching(true);
    try {
      const results = await searchPlacesAction({ data: { query: q.trim() } });
      setPlacesResults(results);
    } catch (err) {
      toast.error(
        "Error en búsqueda: " + (err instanceof Error ? err.message : "Error"),
      );
    }
    setPlacesSearching(false);
  };

  const handlePlacesKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handlePlacesSearch();
    }
  };

  const handleAddFromPlaces = async (place: PlaceSearchResult) => {
    try {
      const result = await addFichas({
        data: { projectId, entries: [{ input: place.name }] },
      });
      if (result.added > 0) {
        toast.success(`"${place.name}" añadida`);
        // Quitar de resultados
        setPlacesResults((prev) =>
          prev.filter((p) => p.placeId !== place.placeId),
        );
        await loadData();
      } else {
        toast.info("Esa ficha ya existe");
      }
    } catch (err) {
      toast.error("Error: " + (err instanceof Error ? err.message : "Error"));
    }
  };

  // ── Acciones ──

  const handleAddBulk = async () => {
    const lines = bulkInput
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l);
    if (lines.length === 0) return;
    try {
      const result = await addFichas({
        data: { projectId, entries: lines.map((l) => ({ input: l })) },
      });
      setBulkInput("");
      toast.success(
        `Se agregaron ${result.added} fichas nuevas (${result.total} total)`,
      );
      await loadData();
    } catch (err) {
      toast.error(
        "Error: " + (err instanceof Error ? err.message : "Error desconocido"),
      );
    }
  };

  const handleAnalyzePending = async () => {
    const pending = db.fichas.filter((f) => f.status !== "analyzed");
    if (pending.length === 0) {
      toast.info("No hay fichas pendientes de analizar");
      return;
    }
    await runAnalysis(pending);
  };

  const handleRefreshAll = async () => {
    if (!confirm("¿Re-analizar TODAS las fichas? (puede tardar)")) return;
    await runAnalysis(db.fichas);
  };

  const runAnalysis = async (fichasToAnalyze: MultilangFicha[]) => {
    setAnalyzing(true);
    setAnalyzeProgress({ current: 0, total: fichasToAnalyze.length, name: "" });

    for (let i = 0; i < fichasToAnalyze.length; i++) {
      const ficha = fichasToAnalyze[i];
      setAnalyzeProgress({
        current: i + 1,
        total: fichasToAnalyze.length,
        name: ficha.baseName || ficha.inputName || ficha.url || "...",
      });

      try {
        const result = await analyzeSingleFicha({
          data: { projectId, fichaId: ficha.id },
        });
        setDb((prev) => ({
          ...prev,
          fichas: prev.fichas.map((f) => (f.id === result.id ? result : f)),
        }));
      } catch (err) {
        toast.error(
          `Error en "${ficha.inputName || ficha.url}": ${err instanceof Error ? err.message : "Error"}`,
        );
      }
    }

    setAnalyzing(false);
    toast.success("Análisis completado");
  };

  const handleAnalyzeOne = async (fichaId: string) => {
    setAnalyzing(true);
    const ficha = db.fichas.find((f) => f.id === fichaId);
    setAnalyzeProgress({
      current: 1,
      total: 1,
      name: ficha?.baseName || ficha?.inputName || ficha?.url || "...",
    });

    try {
      const result = await analyzeSingleFicha({ data: { projectId, fichaId } });
      setDb((prev) => ({
        ...prev,
        fichas: prev.fichas.map((f) => (f.id === result.id ? result : f)),
      }));
      toast.success("Ficha actualizada");
    } catch (err) {
      toast.error("Error: " + (err instanceof Error ? err.message : "Error"));
    }
    setAnalyzing(false);
  };

  const handleDeleteOne = async (fichaId: string) => {
    if (!confirm("¿Eliminar esta ficha?")) return;
    await deleteFicha({ data: { projectId, fichaId } });
    setDb((prev) => ({
      ...prev,
      fichas: prev.fichas.filter((f) => f.id !== fichaId),
    }));
    setSelectedFichas((prev) => {
      const n = new Set(prev);
      n.delete(fichaId);
      return n;
    });
    toast.success("Ficha eliminada");
  };

  const handleDeleteAll = async () => {
    if (!confirm("¿Eliminar TODAS las fichas?")) return;
    await deleteAllFichas({ data: { projectId } });
    setDb((prev) => ({ ...prev, fichas: [] }));
    setSelectedFichas(new Set());
    toast.success("Todas las fichas eliminadas");
  };

  // ── Acciones bulk ──

  const handleBulkAnalyze = async () => {
    const fichas = db.fichas.filter((f) => selectedFichas.has(f.id));
    if (fichas.length === 0) return;
    await runAnalysis(fichas);
    setSelectedFichas(new Set());
  };

  const handleBulkDelete = async () => {
    if (!confirm(`¿Eliminar ${selectedFichas.size} fichas seleccionadas?`))
      return;
    try {
      await deleteFichasBulk({
        data: { projectId, fichaIds: Array.from(selectedFichas) },
      });
      setDb((prev) => ({
        ...prev,
        fichas: prev.fichas.filter((f) => !selectedFichas.has(f.id)),
      }));
      setSelectedFichas(new Set());
      toast.success("Fichas eliminadas");
    } catch (err) {
      toast.error("Error: " + (err instanceof Error ? err.message : "Error"));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedFichas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedFichas.size === filteredFichas.length) {
      setSelectedFichas(new Set());
    } else {
      setSelectedFichas(new Set(filteredFichas.map((f) => f.id)));
    }
  };

  // ── CSV ──

  const handleExportCSV = () => {
    const analyzed = db.fichas.filter((f) => f.status === "analyzed");
    if (!analyzed.length) {
      toast.info("No hay fichas analizadas para exportar");
      return;
    }
    const headers = [
      "Ficha",
      "Nombre Base",
      "Categoría",
      "Idiomas",
      "Multiidiomas",
      "Keywords OK",
      "Keywords Faltan",
      "Detalle",
    ];
    const rows = analyzed.map((f) => {
      const cat = db.categories.find((c) => c.id === f.categoryId);
      let kwOk = "";
      let kwMiss = "";
      if (cat && cat.keywords.length > 0) {
        const ks = computeKeywordStatus(f, cat);
        kwOk = ks.found.map((k) => k.keyword).join(", ");
        kwMiss = ks.missing.join(", ");
      }
      return [
        f.baseName || f.inputName || "",
        f.baseName || "",
        cat ? cat.name : "",
        f.totalLanguagesChecked || 0,
        f.variants ? f.variants.length : 0,
        kwOk,
        kwMiss,
        f.variants
          ? f.variants
              .map(
                (v) =>
                  v.name +
                  " (" +
                  v.languages.map((l) => l.code).join(", ") +
                  ")",
              )
              .join(" | ")
          : "",
      ]
        .map((v) => '"' + String(v).replace(/"/g, '""') + '"')
        .join(",");
    });
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `multiidioma_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("CSV exportado");
  };

  // ── Categorías ──

  const handleCreateCategoryModal = async () => {
    if (!catModalName.trim()) return;
    try {
      const cat = await createCategory({
        data: { projectId, name: catModalName.trim() },
      });
      // Si hay keywords, actualizar inmediatamente
      const keywords = catModalKeywords
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l);
      if (keywords.length > 0) {
        await updateCategory({
          data: { projectId, categoryId: cat.id, keywords },
        });
        cat.keywords = keywords;
      }
      setDb((prev) => ({ ...prev, categories: [...prev.categories, cat] }));
      setCatModalName("");
      setCatModalKeywords("");
      setShowCatModal(false);
      toast.success(`Categoría "${cat.name}" creada`);
    } catch (err) {
      toast.error("Error: " + (err instanceof Error ? err.message : "Error"));
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (
      !confirm(
        "¿Eliminar esta categoría? Las fichas asignadas quedarán sin categoría.",
      )
    )
      return;
    await deleteCategory({ data: { projectId, categoryId: catId } });
    setDb((prev) => ({
      categories: prev.categories.filter((c) => c.id !== catId),
      fichas: prev.fichas.map((f) =>
        f.categoryId === catId ? { ...f, categoryId: null } : f,
      ),
    }));
    if (editingCatId === catId) setEditingCatId(null);
    toast.success("Categoría eliminada");
  };

  const handleAddKeyword = async (catId: string) => {
    if (!newKeyword.trim()) return;
    const cat = db.categories.find((c) => c.id === catId);
    if (!cat) return;
    if (
      cat.keywords.some(
        (k) => k.toLowerCase() === newKeyword.trim().toLowerCase(),
      )
    ) {
      toast.error("Keyword ya existe");
      return;
    }
    const updated = [...cat.keywords, newKeyword.trim()];
    await updateCategory({
      data: { projectId, categoryId: catId, keywords: updated },
    });
    setDb((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === catId ? { ...c, keywords: updated } : c,
      ),
    }));
    setNewKeyword("");
  };

  const handleRemoveKeyword = async (catId: string, idx: number) => {
    const cat = db.categories.find((c) => c.id === catId);
    if (!cat) return;
    const updated = cat.keywords.filter((_, i) => i !== idx);
    await updateCategory({
      data: { projectId, categoryId: catId, keywords: updated },
    });
    setDb((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === catId ? { ...c, keywords: updated } : c,
      ),
    }));
  };

  const handleAssignCategory = async (
    fichaId: string,
    categoryId: string | null,
  ) => {
    await assignCategory({ data: { projectId, fichaId, categoryId } });
    setDb((prev) => ({
      ...prev,
      fichas: prev.fichas.map((f) =>
        f.id === fichaId ? { ...f, categoryId } : f,
      ),
    }));
  };

  // ── Fichas filtradas ──

  const filteredFichas = useMemo(() => {
    return db.fichas.filter((f) => {
      const name = (f.baseName || f.inputName || f.url || "").toLowerCase();
      if (searchText && !name.includes(searchText.toLowerCase())) return false;
      if (filterCatId && f.categoryId !== filterCatId) return false;
      if (filterStatus === "multi") return f.variants && f.variants.length > 0;
      if (filterStatus === "nomulti")
        return (
          f.status === "analyzed" && (!f.variants || f.variants.length === 0)
        );
      if (filterStatus === "pending") return f.status === "pending";
      if (filterStatus === "error") return f.status === "error";
      return true;
    });
  }, [db.fichas, searchText, filterCatId, filterStatus]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = db.fichas.length;
    const analyzed = db.fichas.filter((f) => f.status === "analyzed").length;
    const multi = db.fichas.filter(
      (f) => f.variants && f.variants.length > 0,
    ).length;
    const nomulti = db.fichas.filter(
      (f) =>
        f.status === "analyzed" && (!f.variants || f.variants.length === 0),
    ).length;
    const pending = db.fichas.filter((f) => f.status === "pending").length;
    const errors = db.fichas.filter((f) => f.status === "error").length;
    const totalVariants = db.fichas.reduce(
      (s, f) => s + (f.variants ? f.variants.length : 0),
      0,
    );
    return { total, analyzed, multi, nomulti, pending, errors, totalVariants };
  }, [db.fichas]);

  // ── Descubrimientos recientes ──
  const discoveries = useMemo(() => {
    const discs: {
      fichaName: string;
      variantName: string;
      languages: { code: string; name: string }[];
      discoveredAt: string;
    }[] = [];
    for (const f of db.fichas) {
      for (const v of f.variants || []) {
        if (v.discoveredAt) {
          discs.push({
            fichaName: f.baseName || f.inputName || "—",
            variantName: v.name,
            languages: v.languages,
            discoveredAt: v.discoveredAt,
          });
        }
      }
    }
    discs.sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt));
    return discs;
  }, [db.fichas]);

  const [showAllDiscoveries, setShowAllDiscoveries] = useState(false);
  const visibleDiscoveries = showAllDiscoveries
    ? discoveries
    : discoveries.slice(0, 10);

  // ── Toggle helpers ──
  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleLangTable = (id: string) => {
    setExpandedLangTables((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!loaded) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Languages className="size-7 text-primary" />
          Revisor Multidioma
        </h1>
        <p className="text-base-content/60 text-sm mt-1">
          Analiza y trackea los nombres multidioma de tus fichas GBP
        </p>
      </div>

      {/* Stats */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Total fichas"
            value={stats.total}
            color="text-primary"
          />
          <StatCard
            label="Analizadas"
            value={stats.analyzed}
            color="text-success"
          />
          <StatCard
            label="Pendientes"
            value={stats.pending}
            color="text-warning"
          />
          <StatCard
            label="Multi-idiomas"
            value={stats.totalVariants}
            color="text-secondary"
          />
        </div>
      )}

      {/* Descubrimientos recientes — prominente */}
      {discoveries.length > 0 && (
        <div className="card bg-success/5 border-2 border-success/40 shadow-sm">
          <div className="card-body py-4">
            <h2 className="card-title text-sm text-success">
              <Sparkles className="size-5" /> Últimos multiidiomas descubiertos
            </h2>
            <div className="space-y-1.5">
              {visibleDiscoveries.map((d, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-2 text-sm"
                >
                  <div>
                    <span className="text-success font-medium">+</span>{" "}
                    <span className="font-semibold">{d.fichaName}</span>
                    {" — "}
                    <span className="text-success">
                      &ldquo;{d.variantName}&rdquo;
                    </span>{" "}
                    <span className="text-base-content/50">
                      ({d.languages.map((l) => l.code).join(", ")})
                    </span>
                  </div>
                  <span className="text-xs text-base-content/50 whitespace-nowrap">
                    {new Date(d.discoveredAt).toLocaleDateString("es-ES")}
                  </span>
                </div>
              ))}
            </div>
            {discoveries.length > 10 && (
              <button
                className="btn btn-ghost btn-xs text-success mt-1"
                onClick={() => setShowAllDiscoveries(!showAllDiscoveries)}
              >
                {showAllDiscoveries
                  ? "Ver menos"
                  : `Ver todos (${discoveries.length})`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Buscador de Google Places */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-sm text-primary">
            <Search className="size-4" /> Buscar y añadir fichas
          </h2>
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  className="input input-bordered w-full pl-10"
                  placeholder="Busca tu negocio en Google Maps... ej: Reformas en Valencia"
                  value={placesQuery}
                  onChange={(e) => setPlacesQuery(e.target.value)}
                  onKeyDown={handlePlacesKeyDown}
                />
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                {placesSearching && (
                  <Loader2 className="size-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary" />
                )}
              </div>
              <button
                className="btn btn-primary"
                onClick={() => handlePlacesSearch()}
                disabled={placesSearching || placesQuery.trim().length < 2}
              >
                Buscar
              </button>
            </div>

            {/* Resultados de búsqueda */}
            {placesResults.length > 0 && (
              <div className="mt-2 border border-base-300 rounded-lg overflow-hidden divide-y divide-base-300">
                {placesResults.map((place) => (
                  <div
                    key={place.placeId}
                    className="flex items-center justify-between px-4 py-3 hover:bg-base-300/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate">
                        {place.name}
                      </div>
                      <div className="text-xs text-base-content/50 truncate">
                        {place.address}
                      </div>
                      {(place.rating || place.totalReviews) && (
                        <div className="flex items-center gap-2 mt-0.5">
                          {place.rating && (
                            <span className="flex items-center gap-0.5 text-xs">
                              <Star className="size-3 fill-warning text-warning" />
                              {place.rating}
                            </span>
                          )}
                          {place.totalReviews != null && (
                            <span className="text-xs text-base-content/50">
                              {place.totalReviews} reseñas
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      className="btn btn-ghost btn-sm text-primary ml-3"
                      onClick={() => handleAddFromPlaces(place)}
                    >
                      <Plus className="size-4" /> Añadir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Importar manualmente (colapsable) */}
          <button
            className="btn btn-ghost btn-xs text-base-content/60 self-start mt-1"
            onClick={() => setShowBulkImport(!showBulkImport)}
          >
            <ChevronRight
              className={`size-3 transition-transform ${showBulkImport ? "rotate-90" : ""}`}
            />
            Importar manualmente (URLs/nombres)
          </button>
          {showBulkImport && (
            <div className="mt-2">
              <textarea
                className="textarea textarea-bordered w-full min-h-24 font-mono text-sm"
                placeholder={
                  "Pega URLs o nombres, uno por línea:\nhttps://www.google.com/maps?cid=...\nhttps://maps.app.goo.gl/...\nNombre del Negocio"
                }
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
              />
              <button
                className="btn btn-primary btn-sm mt-2"
                onClick={handleAddBulk}
                disabled={!bulkInput.trim()}
              >
                <Plus className="size-4" /> Agregar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Barra de acciones */}
      <div className="flex flex-wrap gap-2">
        <button
          className="btn btn-success btn-sm"
          onClick={handleAnalyzePending}
          disabled={analyzing}
        >
          {analyzing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          Analizar pendientes ({stats.pending})
        </button>
        <button
          className="btn btn-outline btn-sm"
          onClick={handleRefreshAll}
          disabled={analyzing}
        >
          <RefreshCw className="size-4" /> Actualizar todas
        </button>
        <button className="btn btn-outline btn-sm" onClick={handleExportCSV}>
          <FileDown className="size-4" /> Exportar
        </button>
      </div>

      {/* Barra de progreso */}
      {analyzing && (
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-primary" />
                Analizando {analyzeProgress.current}/{analyzeProgress.total}:{" "}
                {analyzeProgress.name}
              </span>
              <span className="text-base-content/60">
                {Math.round(
                  (analyzeProgress.current /
                    Math.max(analyzeProgress.total, 1)) *
                    100,
                )}
                %
              </span>
            </div>
            <progress
              className="progress progress-primary w-full"
              value={analyzeProgress.current}
              max={analyzeProgress.total}
            />
          </div>
        </div>
      )}

      {/* Panel de categorías */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <h2 className="card-title text-sm text-secondary">
              <Tag className="size-4" /> Categorías
            </h2>
            <button
              className="btn btn-ghost btn-sm text-primary"
              onClick={() => setShowCatModal(true)}
            >
              <FolderPlus className="size-4" /> Nueva categoría
            </button>
          </div>

          {/* Chips de categorías */}
          <div className="flex flex-wrap gap-2">
            {db.categories.length === 0 && (
              <span className="text-sm text-base-content/50">
                No hay categorías. Crea una para asignar keywords objetivo a tus
                fichas.
              </span>
            )}
            {db.categories.map((cat) => {
              const count = db.fichas.filter(
                (f) => f.categoryId === cat.id,
              ).length;
              return (
                <button
                  key={cat.id}
                  className={`btn btn-sm ${editingCatId === cat.id ? "btn-secondary" : "btn-outline"}`}
                  onClick={() =>
                    setEditingCatId(editingCatId === cat.id ? null : cat.id)
                  }
                >
                  {cat.name}
                  <span className="badge badge-sm badge-secondary">
                    {count}
                  </span>
                  <span
                    className="text-error hover:text-error/70 ml-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteCategory(cat.id);
                    }}
                  >
                    <X className="size-3" />
                  </span>
                </button>
              );
            })}
          </div>

          {/* Editor de keywords para categoría seleccionada */}
          {editingCatId &&
            (() => {
              const cat = db.categories.find((c) => c.id === editingCatId);
              if (!cat) return null;
              return (
                <div className="bg-base-300 rounded-lg p-4 mt-2">
                  <h3 className="text-sm font-semibold text-secondary mb-2">
                    Keywords de &ldquo;{cat.name}&rdquo;
                  </h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {cat.keywords.length === 0 && (
                      <span className="text-sm text-base-content/50">
                        Sin keywords
                      </span>
                    )}
                    {cat.keywords.map((kw, idx) => (
                      <span key={idx} className="badge badge-outline gap-1">
                        {kw}
                        <button
                          onClick={() => handleRemoveKeyword(cat.id, idx)}
                          className="text-error"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      className="input input-bordered input-sm flex-1"
                      placeholder="Nueva keyword..."
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleAddKeyword(cat.id);
                      }}
                    />
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleAddKeyword(cat.id)}
                    >
                      Agregar
                    </button>
                  </div>
                </div>
              );
            })()}
        </div>
      </div>

      {/* Tabs de filtro + búsqueda */}
      {stats.total > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {(
                [
                  { key: "all", label: "Todas", count: stats.total },
                  {
                    key: "multi",
                    label: "Con multiidioma",
                    count: stats.multi,
                  },
                  {
                    key: "nomulti",
                    label: "Sin multiidioma",
                    count: stats.nomulti,
                  },
                  { key: "pending", label: "Pendientes", count: stats.pending },
                  { key: "error", label: "Errores", count: stats.errors },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  className={`tab tab-sm tab-bordered ${filterStatus === tab.key ? "tab-active" : ""}`}
                  onClick={() => setFilterStatus(tab.key)}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
            <button
              className="btn btn-error btn-outline btn-xs"
              onClick={handleDeleteAll}
              disabled={db.fichas.length === 0}
            >
              <Trash2 className="size-3" /> Borrar todas
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              className="input input-bordered input-sm flex-1 min-w-40"
              placeholder="Buscar ficha..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <select
              className="select select-bordered select-sm"
              value={filterCatId}
              onChange={(e) => setFilterCatId(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {db.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (
                  {db.fichas.filter((f) => f.categoryId === c.id).length})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Barra de acciones bulk */}
      {selectedFichas.size > 0 && (
        <div className="flex items-center gap-3 bg-primary/10 rounded-lg px-4 py-2">
          <span className="text-sm font-medium">
            {selectedFichas.size} seleccionadas
          </span>
          <button
            className="btn btn-success btn-xs"
            onClick={handleBulkAnalyze}
            disabled={analyzing}
          >
            <RefreshCw className="size-3" /> Analizar
          </button>
          <button className="btn btn-error btn-xs" onClick={handleBulkDelete}>
            <Trash2 className="size-3" /> Borrar
          </button>
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => setSelectedFichas(new Set())}
          >
            Deseleccionar
          </button>
        </div>
      )}

      {/* Lista de fichas — layout compacto */}
      {stats.total > 0 && (
        <div className="bg-base-200 rounded-lg overflow-hidden">
          {/* Cabecera con seleccionar todas */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-base-300 text-xs text-base-content/50">
            <input
              type="checkbox"
              className="checkbox checkbox-xs"
              checked={
                filteredFichas.length > 0 &&
                selectedFichas.size === filteredFichas.length
              }
              onChange={toggleSelectAll}
            />
            <span>Seleccionar todas</span>
          </div>

          {/* Filas de fichas */}
          {filteredFichas.map((ficha) => (
            <FichaRow
              key={ficha.id}
              ficha={ficha}
              categories={db.categories}
              expanded={expandedCards.has(ficha.id)}
              langTableExpanded={expandedLangTables.has(ficha.id)}
              selected={selectedFichas.has(ficha.id)}
              onToggle={() => toggleCard(ficha.id)}
              onToggleLangTable={() => toggleLangTable(ficha.id)}
              onToggleSelect={() => toggleSelect(ficha.id)}
              onAnalyze={() => handleAnalyzeOne(ficha.id)}
              onDelete={() => handleDeleteOne(ficha.id)}
              onAssignCategory={(catId) =>
                handleAssignCategory(ficha.id, catId)
              }
              analyzing={analyzing}
            />
          ))}

          {filteredFichas.length === 0 && (
            <p className="text-center text-base-content/50 py-8">
              No hay fichas que coincidan con los filtros
            </p>
          )}
        </div>
      )}

      {stats.total === 0 && (
        <div className="bg-base-200 rounded-lg py-12 text-center">
          <p className="text-base-content/50">No hay fichas</p>
          <p className="text-base-content/40 text-sm">
            Busca tu negocio arriba para empezar
          </p>
        </div>
      )}

      {/* Modal de nueva categoría */}
      {showCatModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Nueva categoría</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="label">
                  <span className="label-text">Nombre</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="Ej: Reformas"
                  value={catModalName}
                  onChange={(e) => setCatModalName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreateCategoryModal();
                  }}
                  autoFocus
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text">
                    Keywords objetivo (una por línea, en español)
                  </span>
                </label>
                <textarea
                  className="textarea textarea-bordered w-full min-h-28"
                  placeholder={
                    "reforma cocina\nreforma baño\nreformas integrales"
                  }
                  value={catModalKeywords}
                  onChange={(e) => setCatModalKeywords(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-action">
              <button
                className="btn"
                onClick={() => {
                  setShowCatModal(false);
                  setCatModalName("");
                  setCatModalKeywords("");
                }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateCategoryModal}
                disabled={!catModalName.trim()}
              >
                Crear
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => setShowCatModal(false)}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Componentes auxiliares
// ============================================================================

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body items-center py-4">
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
        <span className="text-xs text-base-content/60">{label}</span>
      </div>
    </div>
  );
}

/** Fila compacta de ficha (layout tipo lista) */
function FichaRow({
  ficha,
  categories,
  expanded,
  langTableExpanded,
  selected,
  onToggle,
  onToggleLangTable,
  onToggleSelect,
  onAnalyze,
  onDelete,
  onAssignCategory,
  analyzing,
}: {
  ficha: MultilangFicha;
  categories: MultilangCategory[];
  expanded: boolean;
  langTableExpanded: boolean;
  selected: boolean;
  onToggle: () => void;
  onToggleLangTable: () => void;
  onToggleSelect: () => void;
  onAnalyze: () => void;
  onDelete: () => void;
  onAssignCategory: (catId: string | null) => void;
  analyzing: boolean;
}) {
  const name = ficha.baseName || ficha.inputName || ficha.url || "???";
  const hasMul = ficha.variants && ficha.variants.length > 0;
  const status = ficha.status || "pending";

  // Dot de color según estado
  const dotColor =
    status === "analyzed"
      ? hasMul
        ? "bg-success"
        : "bg-warning"
      : status === "analyzing"
        ? "bg-primary animate-pulse"
        : status === "error"
          ? "bg-error"
          : "bg-base-content/30";

  // Stats inline
  const statsText =
    status === "analyzed"
      ? `${ficha.variants?.length || 0} multi-idiomas · ${ficha.totalLanguagesChecked} idiomas${ficha.lastAnalyzed ? ` · ${new Date(ficha.lastAnalyzed).toLocaleDateString("es-ES")}` : ""}`
      : status === "error"
        ? "Error"
        : "Pendiente";

  const cat = categories.find((c) => c.id === ficha.categoryId);

  return (
    <div className="border-b border-base-300 last:border-b-0">
      {/* Fila compacta */}
      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-base-300/50 transition-colors">
        {/* Checkbox */}
        <input
          type="checkbox"
          className="checkbox checkbox-xs"
          checked={selected}
          onChange={onToggleSelect}
        />

        {/* Dot de estado */}
        <span
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotColor}`}
        />

        {/* Nombre + stats (clickable para expandir) */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{name}</span>
            {cat && (
              <span className="badge badge-xs badge-secondary badge-outline">
                {cat.name}
              </span>
            )}
            {cat &&
              status === "analyzed" &&
              cat.keywords.length > 0 &&
              (() => {
                const ks = computeKeywordStatus(ficha, cat);
                const pct = Math.round(
                  (ks.found.length / cat.keywords.length) * 100,
                );
                const cl =
                  pct === 100
                    ? "badge-success"
                    : pct >= 50
                      ? "badge-warning"
                      : "badge-error";
                return (
                  <span className={`badge badge-xs ${cl} badge-outline`}>
                    {ks.found.length}/{cat.keywords.length} kw
                  </span>
                );
              })()}
          </div>
          <div className="text-xs text-base-content/50">{statsText}</div>
        </div>

        {/* Iconos de acción */}
        <div className="flex items-center gap-1">
          <button
            className="btn btn-ghost btn-xs btn-square"
            title="Analizar"
            onClick={(e) => {
              e.stopPropagation();
              onAnalyze();
            }}
            disabled={analyzing}
          >
            <RefreshCw className="size-3.5" />
          </button>
          {ficha.url && (
            <a
              href={ficha.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-xs btn-square"
              title="Ver en Maps"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}
          <button
            className="btn btn-ghost btn-xs btn-square text-error"
            title="Eliminar"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="size-3.5" />
          </button>
          <button
            className="btn btn-ghost btn-xs btn-square"
            title={expanded ? "Colapsar" : "Expandir"}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            {expanded ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Cuerpo expandible */}
      {expanded && (
        <div className="bg-base-100 px-4 pb-4 pt-2 ml-10">
          {/* Error */}
          {status === "error" && (
            <div className="alert alert-error text-sm mb-3">
              <AlertCircle className="size-4" />
              {ficha.error || "Error desconocido"}
            </div>
          )}

          {/* Resultados analizados */}
          {status === "analyzed" && (
            <>
              {/* Nombre base */}
              <div className="bg-base-300 rounded-lg p-3">
                <div className="text-xs uppercase text-base-content/50 tracking-wide">
                  Nombre base ({ficha.baseLanguages?.length || 0} idiomas)
                </div>
                <div className="text-lg font-semibold mt-1">
                  {ficha.baseName}
                </div>
                <div className="text-xs text-base-content/50 mt-1">
                  {ficha.baseLanguages?.map((l) => l.code).join(", ")}
                </div>
              </div>

              {/* Variantes multiidioma */}
              {hasMul ? (
                ficha.variants.map((v, idx) => (
                  <div
                    key={idx}
                    className="border border-success/20 bg-success/5 rounded-lg p-3 mt-2"
                  >
                    <div className="font-semibold text-success flex items-center gap-2">
                      &ldquo;{v.name}&rdquo;
                      {v.discoveredAt && (
                        <span className="text-xs text-info font-normal badge badge-xs badge-info badge-outline">
                          Descubierto{" "}
                          {new Date(v.discoveredAt).toLocaleDateString("es-ES")}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {v.languages.map((l) => (
                        <span
                          key={l.code}
                          className="badge badge-sm badge-ghost"
                        >
                          <strong className="text-primary mr-1">
                            {l.code}
                          </strong>
                          {l.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="alert alert-warning mt-2 text-sm">
                  Mismo nombre en los {ficha.totalLanguagesChecked} idiomas. No
                  tiene multiidiomas configurados.
                </div>
              )}

              {/* Estado de keywords */}
              {cat &&
                cat.keywords.length > 0 &&
                (() => {
                  const ks = computeKeywordStatus(ficha, cat);
                  const pct = Math.round(
                    (ks.found.length / cat.keywords.length) * 100,
                  );
                  return (
                    <div className="mt-3">
                      <div className="text-sm font-semibold text-base-content/60 mb-1">
                        Keywords {ks.found.length}/{cat.keywords.length}
                      </div>
                      <progress
                        className={`progress w-full ${pct === 100 ? "progress-success" : "progress-primary"}`}
                        value={ks.found.length}
                        max={cat.keywords.length}
                      />
                      <div className="flex flex-wrap gap-1 mt-2">
                        {ks.found.map((k) => (
                          <span
                            key={k.keyword}
                            className="badge badge-sm badge-success badge-outline"
                          >
                            {k.keyword}
                          </span>
                        ))}
                        {ks.missing.map((k) => (
                          <span
                            key={k}
                            className="badge badge-sm badge-error badge-outline"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

              {/* Tabla completa de idiomas */}
              {ficha.allResults && ficha.allResults.length > 0 && (
                <>
                  <button
                    className="btn btn-ghost btn-xs text-primary mt-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLangTable();
                    }}
                  >
                    <Eye className="size-3" />{" "}
                    {langTableExpanded ? "Ocultar" : "Ver"} tabla completa
                  </button>
                  {langTableExpanded && (
                    <div className="max-h-72 overflow-y-auto mt-2 rounded-lg border border-base-300">
                      <table className="table table-xs table-pin-rows">
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Idioma</th>
                            <th>Nombre</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ficha.allResults.map((r) => (
                            <tr
                              key={r.code}
                              className={
                                r.title !== ficha.baseName ? "text-success" : ""
                              }
                            >
                              <td className="font-mono">{r.code}</td>
                              <td>{r.name}</td>
                              <td>{r.title}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Pendiente */}
          {status === "pending" && (
            <p className="text-sm text-base-content/50">
              Pendiente de analizar
            </p>
          )}

          {/* Acciones de la ficha */}
          <div className="flex flex-wrap gap-2 mt-3">
            <select
              className="select select-bordered select-xs"
              value={ficha.categoryId || ""}
              onChange={(e) => onAssignCategory(e.target.value || null)}
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
