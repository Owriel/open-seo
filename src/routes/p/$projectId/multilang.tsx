import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback, useEffect } from "react";
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
  CheckCircle2,
  Clock,
  Loader2,
  X,
  Tag,
  FolderPlus,
  Eye,
  Sparkles,
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
} from "@/serverFunctions/multilang";
import type {
  MultilangDB,
  MultilangFicha,
  MultilangCategory,
  MultilangVariant,
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
    const matched = (ficha.variants || []).filter((v) => v.name.toLowerCase().includes(kwL));
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
  const [analyzeProgress, setAnalyzeProgress] = useState({ current: 0, total: 0, name: "" });

  // Filtros
  const [searchText, setSearchText] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "multi" | "nomulti" | "pending">("all");
  const [filterCatId, setFilterCatId] = useState("");

  // Categorías UI
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [newKeyword, setNewKeyword] = useState("");

  // Cards expandidas
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [expandedLangTables, setExpandedLangTables] = useState<Set<string>>(new Set());

  // ── Carga inicial ──
  const loadData = useCallback(async () => {
    try {
      const data = await getMultilangData({ data: { projectId } });
      setDb(data);
      setLoaded(true);
    } catch (err) {
      toast.error("Error al cargar datos: " + (err instanceof Error ? err.message : "Error desconocido"));
    }
  }, [projectId]);

  // Cargar al montar
  useEffect(() => {
    loadData();
  }, [loadData]);

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
      toast.success(`Se agregaron ${result.added} fichas nuevas (${result.total} total)`);
      await loadData();
    } catch (err) {
      toast.error("Error: " + (err instanceof Error ? err.message : "Error desconocido"));
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
        // Actualizar la ficha en el state local
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
    setDb((prev) => ({ ...prev, fichas: prev.fichas.filter((f) => f.id !== fichaId) }));
    toast.success("Ficha eliminada");
  };

  const handleDeleteAll = async () => {
    if (!confirm("¿Eliminar TODAS las fichas?")) return;
    await deleteAllFichas({ data: { projectId } });
    setDb((prev) => ({ ...prev, fichas: [] }));
    toast.success("Todas las fichas eliminadas");
  };

  const handleExportCSV = () => {
    const analyzed = db.fichas.filter((f) => f.status === "analyzed");
    if (!analyzed.length) {
      toast.info("No hay fichas analizadas para exportar");
      return;
    }
    const headers = ["Ficha", "Nombre Base", "Categoría", "Idiomas", "Multiidiomas", "Keywords OK", "Keywords Faltan", "Detalle"];
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
        f.variants ? f.variants.map((v) => v.name + " (" + v.languages.map((l) => l.code).join(", ") + ")").join(" | ") : "",
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

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const cat = await createCategory({ data: { projectId, name: newCatName.trim() } });
      setDb((prev) => ({ ...prev, categories: [...prev.categories, cat] }));
      setNewCatName("");
      toast.success(`Categoría "${cat.name}" creada`);
    } catch (err) {
      toast.error("Error: " + (err instanceof Error ? err.message : "Error"));
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!confirm("¿Eliminar esta categoría? Las fichas asignadas quedarán sin categoría.")) return;
    await deleteCategory({ data: { projectId, categoryId: catId } });
    setDb((prev) => ({
      categories: prev.categories.filter((c) => c.id !== catId),
      fichas: prev.fichas.map((f) => (f.categoryId === catId ? { ...f, categoryId: null } : f)),
    }));
    if (editingCatId === catId) setEditingCatId(null);
    toast.success("Categoría eliminada");
  };

  const handleAddKeyword = async (catId: string) => {
    if (!newKeyword.trim()) return;
    const cat = db.categories.find((c) => c.id === catId);
    if (!cat) return;
    if (cat.keywords.some((k) => k.toLowerCase() === newKeyword.trim().toLowerCase())) {
      toast.error("Keyword ya existe");
      return;
    }
    const updated = [...cat.keywords, newKeyword.trim()];
    await updateCategory({ data: { projectId, categoryId: catId, keywords: updated } });
    setDb((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === catId ? { ...c, keywords: updated } : c)),
    }));
    setNewKeyword("");
  };

  const handleRemoveKeyword = async (catId: string, idx: number) => {
    const cat = db.categories.find((c) => c.id === catId);
    if (!cat) return;
    const updated = cat.keywords.filter((_, i) => i !== idx);
    await updateCategory({ data: { projectId, categoryId: catId, keywords: updated } });
    setDb((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === catId ? { ...c, keywords: updated } : c)),
    }));
  };

  const handleAssignCategory = async (fichaId: string, categoryId: string | null) => {
    await assignCategory({ data: { projectId, fichaId, categoryId } });
    setDb((prev) => ({
      ...prev,
      fichas: prev.fichas.map((f) => (f.id === fichaId ? { ...f, categoryId } : f)),
    }));
  };

  // ── Fichas filtradas ──

  const filteredFichas = useMemo(() => {
    return db.fichas.filter((f) => {
      const name = (f.baseName || f.inputName || f.url || "").toLowerCase();
      if (searchText && !name.includes(searchText.toLowerCase())) return false;
      if (filterCatId && f.categoryId !== filterCatId) return false;
      if (filterStatus === "multi") return f.variants && f.variants.length > 0;
      if (filterStatus === "nomulti") return f.status === "analyzed" && (!f.variants || f.variants.length === 0);
      if (filterStatus === "pending") return f.status === "pending" || f.status === "error";
      return true;
    });
  }, [db.fichas, searchText, filterCatId, filterStatus]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = db.fichas.length;
    const multi = db.fichas.filter((f) => f.variants && f.variants.length > 0).length;
    const nomulti = db.fichas.filter((f) => f.status === "analyzed" && (!f.variants || f.variants.length === 0)).length;
    const pending = db.fichas.filter((f) => f.status === "pending").length;
    const errors = db.fichas.filter((f) => f.status === "error").length;
    const totalVariants = db.fichas.reduce((s, f) => s + (f.variants ? f.variants.length : 0), 0);
    return { total, multi, nomulti, pending, errors, totalVariants };
  }, [db.fichas]);

  // ── Descubrimientos recientes ──
  const discoveries = useMemo(() => {
    const discs: { fichaName: string; variantName: string; languages: { code: string; name: string }[]; discoveredAt: string }[] = [];
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
    return discs.slice(0, 20);
  }, [db.fichas]);

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
      <div className="text-center">
        <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
          <Languages className="size-7 text-primary" />
          Revisor Multidioma
        </h1>
        <p className="text-base-content/60 text-sm mt-1">
          Analiza los nombres multiidioma de tus fichas de Google Business Profile
        </p>
      </div>

      {/* Panel de entrada */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-sm text-primary">
            <Plus className="size-4" /> Agregar fichas
          </h2>
          <textarea
            className="textarea textarea-bordered w-full min-h-28 font-mono text-sm"
            placeholder={"Pega aquí las URLs o nombres de fichas, uno por línea. Ejemplos:\n\nhttps://www.google.com/maps?cid=17326773546932756904\nhttps://maps.app.goo.gl/t6pRKgfs2ZQ9PE38A\nArquitectos y Reformas Reus"}
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
          />
          <p className="text-xs text-base-content/50">
            Acepta URLs de Google Maps (?cid=, maps.app.goo.gl, URL larga) o nombres exactos de fichas. Uno por línea.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <button className="btn btn-primary btn-sm" onClick={handleAddBulk} disabled={!bulkInput.trim()}>
              <Plus className="size-4" /> Agregar
            </button>
            <button className="btn btn-success btn-sm" onClick={handleAnalyzePending} disabled={analyzing}>
              {analyzing ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Analizar pendientes
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleRefreshAll} disabled={analyzing}>
              <RefreshCw className="size-4" /> Actualizar todas
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleExportCSV}>
              <FileDown className="size-4" /> Exportar CSV
            </button>
            <button className="btn btn-error btn-outline btn-sm" onClick={handleDeleteAll} disabled={db.fichas.length === 0}>
              <Trash2 className="size-4" /> Borrar todo
            </button>
          </div>
        </div>
      </div>

      {/* Barra de progreso */}
      {analyzing && (
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-primary" />
                Analizando {analyzeProgress.current}/{analyzeProgress.total}: {analyzeProgress.name}
              </span>
              <span className="text-base-content/60">
                {Math.round((analyzeProgress.current / Math.max(analyzeProgress.total, 1)) * 100)}%
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

      {/* Descubrimientos recientes */}
      {discoveries.length > 0 && (
        <div className="card bg-base-200 border border-success/30 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-sm text-success">
              <Sparkles className="size-4" /> Últimos multiidiomas descubiertos
            </h2>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {discoveries.map((d, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-sm border-l-2 border-success pl-3 py-1">
                  <div>
                    <span className="font-semibold text-success">{d.variantName}</span>{" "}
                    <span className="text-base-content/60">
                      en {d.fichaName} — {d.languages.map((l) => l.code).join(", ")}
                    </span>
                  </div>
                  <span className="text-xs text-base-content/50 whitespace-nowrap">
                    {new Date(d.discoveredAt).toLocaleDateString("es-ES")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Panel de categorías */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-sm text-secondary">
            <Tag className="size-4" /> Categorías y Keywords
          </h2>

          {/* Chips de categorías */}
          <div className="flex flex-wrap gap-2">
            {db.categories.length === 0 && (
              <span className="text-sm text-base-content/50">No hay categorías. Crea una para asignar keywords a tus fichas.</span>
            )}
            {db.categories.map((cat) => {
              const count = db.fichas.filter((f) => f.categoryId === cat.id).length;
              return (
                <button
                  key={cat.id}
                  className={`btn btn-sm ${editingCatId === cat.id ? "btn-secondary" : "btn-outline"}`}
                  onClick={() => setEditingCatId(editingCatId === cat.id ? null : cat.id)}
                >
                  {cat.name}
                  <span className="badge badge-sm badge-secondary">{count}</span>
                  <span
                    className="text-error hover:text-error/70 ml-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCategory(cat.id);
                    }}
                  >
                    <X className="size-3" />
                  </span>
                </button>
              );
            })}
          </div>

          {/* Editor de keywords para categoría seleccionada */}
          {editingCatId && (() => {
            const cat = db.categories.find((c) => c.id === editingCatId);
            if (!cat) return null;
            return (
              <div className="bg-base-300 rounded-lg p-4 mt-2">
                <h3 className="text-sm font-semibold text-secondary mb-2">Keywords de &ldquo;{cat.name}&rdquo;</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {cat.keywords.length === 0 && <span className="text-sm text-base-content/50">Sin keywords</span>}
                  {cat.keywords.map((kw, idx) => (
                    <span key={idx} className="badge badge-outline gap-1">
                      {kw}
                      <button onClick={() => handleRemoveKeyword(cat.id, idx)} className="text-error">
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
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddKeyword(cat.id); }}
                  />
                  <button className="btn btn-outline btn-sm" onClick={() => handleAddKeyword(cat.id)}>
                    Agregar
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Crear nueva categoría */}
          <div className="flex gap-2 mt-2">
            <input
              className="input input-bordered input-sm flex-1"
              placeholder="Nueva categoría..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateCategory(); }}
            />
            <button className="btn btn-outline btn-sm" onClick={handleCreateCategory}>
              <FolderPlus className="size-4" /> Crear
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Fichas" value={stats.total} color="text-primary" />
          <StatCard label="Con multiidioma" value={stats.multi} color="text-success" />
          <StatCard label="Sin multiidioma" value={stats.nomulti} color="text-warning" />
          <StatCard label="Multi-idiomas total" value={stats.totalVariants} color="text-secondary" />
          <StatCard label="Pendientes" value={stats.pending} color="text-base-content/60" />
          {stats.errors > 0 && <StatCard label="Errores" value={stats.errors} color="text-error" />}
        </div>
      )}

      {/* Filtros */}
      {stats.total > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            className="input input-bordered input-sm flex-1 min-w-40"
            placeholder="Buscar..."
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
                {c.name} ({db.fichas.filter((f) => f.categoryId === c.id).length})
              </option>
            ))}
          </select>
          {(["all", "multi", "nomulti", "pending"] as const).map((f) => (
            <button
              key={f}
              className={`btn btn-sm ${filterStatus === f ? "btn-primary" : "btn-outline"}`}
              onClick={() => setFilterStatus(f)}
            >
              {f === "all" ? "Todas" : f === "multi" ? "Con multiidioma" : f === "nomulti" ? "Sin multiidioma" : "Pendientes"}
            </button>
          ))}
        </div>
      )}

      {/* Cards de fichas */}
      <div className="space-y-3">
        {filteredFichas.map((ficha) => (
          <FichaCard
            key={ficha.id}
            ficha={ficha}
            categories={db.categories}
            expanded={expandedCards.has(ficha.id)}
            langTableExpanded={expandedLangTables.has(ficha.id)}
            onToggle={() => toggleCard(ficha.id)}
            onToggleLangTable={() => toggleLangTable(ficha.id)}
            onAnalyze={() => handleAnalyzeOne(ficha.id)}
            onDelete={() => handleDeleteOne(ficha.id)}
            onAssignCategory={(catId) => handleAssignCategory(ficha.id, catId)}
            analyzing={analyzing}
          />
        ))}
        {filteredFichas.length === 0 && stats.total > 0 && (
          <p className="text-center text-base-content/50 py-8">No hay fichas que coincidan con los filtros</p>
        )}
        {stats.total === 0 && (
          <p className="text-center text-base-content/50 py-8">
            Añade fichas de Google Business Profile arriba para empezar
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Componentes auxiliares
// ============================================================================

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body items-center py-4">
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
        <span className="text-xs text-base-content/60">{label}</span>
      </div>
    </div>
  );
}

function FichaCard({
  ficha,
  categories,
  expanded,
  langTableExpanded,
  onToggle,
  onToggleLangTable,
  onAnalyze,
  onDelete,
  onAssignCategory,
  analyzing,
}: {
  ficha: MultilangFicha;
  categories: MultilangCategory[];
  expanded: boolean;
  langTableExpanded: boolean;
  onToggle: () => void;
  onToggleLangTable: () => void;
  onAnalyze: () => void;
  onDelete: () => void;
  onAssignCategory: (catId: string | null) => void;
  analyzing: boolean;
}) {
  const name = ficha.baseName || ficha.inputName || ficha.url || "???";
  const hasMul = ficha.variants && ficha.variants.length > 0;
  const status = ficha.status || "pending";

  // Color de borde izquierdo según estado
  const borderClass =
    status === "analyzed"
      ? hasMul
        ? "border-l-4 border-l-success"
        : "border-l-4 border-l-warning"
      : status === "analyzing"
        ? "border-l-4 border-l-primary"
        : status === "error"
          ? "border-l-4 border-l-error"
          : "border-l-4 border-l-base-content/30";

  // Badge de estado
  const statusBadge =
    status === "pending" ? (
      <span className="badge badge-sm badge-ghost"><Clock className="size-3 mr-1" />Pendiente</span>
    ) : status === "analyzing" ? (
      <span className="badge badge-sm badge-info"><Loader2 className="size-3 mr-1 animate-spin" />Analizando...</span>
    ) : status === "error" ? (
      <span className="badge badge-sm badge-error"><AlertCircle className="size-3 mr-1" />Error</span>
    ) : hasMul ? (
      <span className="badge badge-sm badge-success"><CheckCircle2 className="size-3 mr-1" />{ficha.variants.length} Multi-idioma</span>
    ) : (
      <span className="badge badge-sm badge-warning">Solo 1 nombre</span>
    );

  // Badge de categoría
  const cat = categories.find((c) => c.id === ficha.categoryId);

  return (
    <div className={`card bg-base-200 shadow-sm ${borderClass}`}>
      {/* Cabecera clickable */}
      <div className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-base-300/50 transition-colors" onClick={onToggle}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold">{name}</span>
          {statusBadge}
          {cat && <span className="badge badge-sm badge-secondary badge-outline">{cat.name}</span>}
          {/* Badge de keyword completion */}
          {cat && status === "analyzed" && cat.keywords.length > 0 && (() => {
            const ks = computeKeywordStatus(ficha, cat);
            const pct = Math.round((ks.found.length / cat.keywords.length) * 100);
            const cl = pct === 100 ? "badge-success" : pct >= 50 ? "badge-warning" : "badge-error";
            return (
              <span className={`badge badge-sm ${cl} badge-outline`}>
                {ks.found.length}/{cat.keywords.length} kw
              </span>
            );
          })()}
        </div>
        <div className="flex items-center gap-3">
          {ficha.totalLanguagesChecked > 0 && (
            <span className="text-xs text-base-content/50">
              {ficha.totalLanguagesChecked} idiomas
              {ficha.lastAnalyzed && ` · ${new Date(ficha.lastAnalyzed).toLocaleDateString("es-ES")}`}
            </span>
          )}
          {expanded ? <ChevronUp className="size-4 text-base-content/50" /> : <ChevronDown className="size-4 text-base-content/50" />}
        </div>
      </div>

      {/* Cuerpo expandible */}
      {expanded && (
        <div className="border-t border-base-300 px-5 pb-4">
          {/* Error */}
          {status === "error" && (
            <div className="alert alert-error mt-3 text-sm">
              <AlertCircle className="size-4" />
              {ficha.error || "Error desconocido"}
            </div>
          )}

          {/* Resultados */}
          {status === "analyzed" && (
            <>
              {/* Nombre base */}
              <div className="bg-base-300 rounded-lg p-3 mt-3">
                <div className="text-xs uppercase text-base-content/50 tracking-wide">
                  Nombre base ({ficha.baseLanguages?.length || 0} idiomas)
                </div>
                <div className="text-lg font-semibold mt-1">{ficha.baseName}</div>
                <div className="text-xs text-base-content/50 mt-1">
                  {ficha.baseLanguages?.map((l) => l.code).join(", ")}
                </div>
              </div>

              {/* Variantes multiidioma */}
              {hasMul ? (
                ficha.variants.map((v, idx) => (
                  <div key={idx} className="border border-success/20 bg-success/5 rounded-lg p-3 mt-2">
                    <div className="font-semibold text-success flex items-center gap-2">
                      {v.name}
                      {v.discoveredAt && (
                        <span className="text-xs text-info font-normal">
                          nuevo {new Date(v.discoveredAt).toLocaleDateString("es-ES")}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {v.languages.map((l) => (
                        <span key={l.code} className="badge badge-sm badge-ghost">
                          <strong className="text-primary mr-1">{l.code}</strong>{l.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="alert alert-warning mt-3 text-sm">
                  Mismo nombre en los {ficha.totalLanguagesChecked} idiomas. No tiene multiidiomas configurados.
                </div>
              )}

              {/* Estado de keywords */}
              {cat && cat.keywords.length > 0 && (() => {
                const ks = computeKeywordStatus(ficha, cat);
                const pct = Math.round((ks.found.length / cat.keywords.length) * 100);
                return (
                  <div className="mt-3">
                    <div className="text-sm font-semibold text-base-content/60 mb-1">
                      Keywords {ks.found.length}/{cat.keywords.length}
                    </div>
                    <progress className={`progress w-full ${pct === 100 ? "progress-success" : "progress-primary"}`} value={ks.found.length} max={cat.keywords.length} />
                    <div className="flex flex-wrap gap-1 mt-2">
                      {ks.found.map((k) => (
                        <span key={k.keyword} className="badge badge-sm badge-success badge-outline">✓ {k.keyword}</span>
                      ))}
                      {ks.missing.map((k) => (
                        <span key={k} className="badge badge-sm badge-error badge-outline">✗ {k}</span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Tabla completa de idiomas */}
              {ficha.allResults && ficha.allResults.length > 0 && (
                <>
                  <button className="btn btn-ghost btn-xs text-primary mt-3" onClick={(e) => { e.stopPropagation(); onToggleLangTable(); }}>
                    <Eye className="size-3" /> {langTableExpanded ? "Ocultar" : "Ver"} tabla completa
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
                            <tr key={r.code} className={r.title !== ficha.baseName ? "text-success" : ""}>
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
            <p className="text-sm text-base-content/50 mt-3">Pendiente de analizar</p>
          )}

          {/* Acciones */}
          <div className="flex flex-wrap gap-2 mt-3">
            <select
              className="select select-bordered select-xs"
              value={ficha.categoryId || ""}
              onChange={(e) => onAssignCategory(e.target.value || null)}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button className="btn btn-outline btn-xs" onClick={(e) => { e.stopPropagation(); onAnalyze(); }} disabled={analyzing}>
              <RefreshCw className="size-3" /> Actualizar
            </button>
            <button className="btn btn-error btn-outline btn-xs" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="size-3" /> Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
