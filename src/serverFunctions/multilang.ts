import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { authenticatedServerFunctionMiddleware } from "@/serverFunctions/middleware";
import {
  getMultilangDataSchema,
  addFichasSchema,
  analyzeFichaSchema,
  deleteFichaSchema,
  deleteAllFichasSchema,
  createCategorySchema,
  updateCategorySchema,
  deleteCategorySchema,
  assignCategorySchema,
  searchPlacesSchema,
  deleteFichasBulkSchema,
} from "@/types/schemas/multilang";
import type { MultilangDB, MultilangFicha, PlaceSearchResult } from "@/types/multilang";
import { analyzeFicha, searchPlaces as searchPlacesLib } from "@/server/lib/multilang";
import { parseJson } from "@/server/lib/kv-cache";

// ============================================================================
// Helpers de KV
// ============================================================================

/** Clave KV para la base de datos multilang de un proyecto */
function kvKey(projectId: string): string {
  return `multilang:${projectId}`;
}

/** Lee la base de datos multilang de KV */
async function loadDB(projectId: string): Promise<MultilangDB> {
  try {
    const raw = await env.KV.get(kvKey(projectId), "text");
    if (!raw) return { fichas: [], categories: [] };
    const db = parseJson<MultilangDB>(raw);
    // Migración por si faltan campos
    if (!db.categories) db.categories = [];
    if (!db.fichas) db.fichas = [];
    return db;
  } catch {
    return { fichas: [], categories: [] };
  }
}

/** Guarda la base de datos multilang en KV (sin TTL — persistente) */
async function saveDB(projectId: string, db: MultilangDB): Promise<void> {
  await env.KV.put(kvKey(projectId), JSON.stringify(db));
}

/** Genera un ID único */
function generateId(prefix = ""): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ============================================================================
// Server Functions
// ============================================================================

/** Obtener todos los datos multilang de un proyecto */
export const getMultilangData = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => getMultilangDataSchema.parse(data))
  .handler(async ({ data }): Promise<MultilangDB> => {
    return loadDB(data.projectId);
  });

/** Añadir fichas en bulk (URLs o nombres) */
export const addFichas = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => addFichasSchema.parse(data))
  .handler(async ({ data }): Promise<{ added: number; total: number }> => {
    const db = await loadDB(data.projectId);
    let added = 0;

    for (const entry of data.entries) {
      const input = entry.input.trim();
      if (!input) continue;

      // Detectar si es URL o nombre
      const isUrl =
        /^https?:\/\//.test(input) || input.includes("maps.app.goo.gl") || input.includes("goo.gl");

      const ficha: MultilangFicha = {
        id: generateId(),
        inputName: isUrl ? null : input,
        url: isUrl ? input : null,
        baseName: null,
        ftid: null,
        variants: [],
        baseLanguages: [],
        allResults: [],
        totalLanguagesChecked: 0,
        lastAnalyzed: null,
        status: "pending",
        error: null,
        categoryId: null,
        addedAt: new Date().toISOString(),
      };

      // Verificar duplicados
      const isDuplicate = db.fichas.some(
        (f) => (ficha.url && f.url === ficha.url) || (ficha.inputName && f.inputName === ficha.inputName),
      );

      if (!isDuplicate) {
        db.fichas.push(ficha);
        added++;
      }
    }

    await saveDB(data.projectId, db);
    return { added, total: db.fichas.length };
  });

/** Analizar una ficha individual (resolve ftid + 81 idiomas) */
export const analyzeSingleFicha = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => analyzeFichaSchema.parse(data))
  .handler(async ({ data }): Promise<MultilangFicha> => {
    const db = await loadDB(data.projectId);
    const idx = db.fichas.findIndex((f) => f.id === data.fichaId);
    if (idx < 0) throw new Error("Ficha no encontrada");

    const ficha = db.fichas[idx];
    const oldFicha = { ...ficha, variants: [...(ficha.variants || [])] };
    const wasAnalyzed = oldFicha.status === "analyzed";

    // Ejecutar análisis completo
    const result = await analyzeFicha({ ...ficha });

    // Preservar categoryId
    result.categoryId = oldFicha.categoryId || null;

    // Detectar descubrimientos nuevos
    const now = new Date().toISOString();
    for (const v of result.variants) {
      const oldV = oldFicha.variants.find((ov) => ov.name === v.name);
      if (oldV) {
        v.discoveredAt = oldV.discoveredAt || null;
      } else if (wasAnalyzed) {
        v.discoveredAt = now; // Nuevo descubrimiento
      } else {
        v.discoveredAt = null;
      }
    }

    // Guardar en KV
    db.fichas[idx] = result;
    await saveDB(data.projectId, db);

    return result;
  });

/** Eliminar una ficha */
export const deleteFicha = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => deleteFichaSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const db = await loadDB(data.projectId);
    db.fichas = db.fichas.filter((f) => f.id !== data.fichaId);
    await saveDB(data.projectId, db);
    return { ok: true };
  });

/** Eliminar todas las fichas */
export const deleteAllFichas = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => deleteAllFichasSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const db = await loadDB(data.projectId);
    db.fichas = [];
    await saveDB(data.projectId, db);
    return { ok: true };
  });

// ============================================================================
// Categorías
// ============================================================================

/** Crear categoría */
export const createCategory = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => createCategorySchema.parse(data))
  .handler(async ({ data }) => {
    const db = await loadDB(data.projectId);
    const cat = {
      id: generateId("cat_"),
      name: data.name,
      keywords: [] as string[],
      createdAt: new Date().toISOString(),
    };
    db.categories.push(cat);
    await saveDB(data.projectId, db);
    return cat;
  });

/** Actualizar categoría (nombre y/o keywords) */
export const updateCategory = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => updateCategorySchema.parse(data))
  .handler(async ({ data }) => {
    const db = await loadDB(data.projectId);
    const cat = db.categories.find((c) => c.id === data.categoryId);
    if (!cat) throw new Error("Categoría no encontrada");
    if (data.name !== undefined) cat.name = data.name;
    if (data.keywords !== undefined) cat.keywords = data.keywords;
    await saveDB(data.projectId, db);
    return cat;
  });

/** Eliminar categoría */
export const deleteCategory = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => deleteCategorySchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const db = await loadDB(data.projectId);
    db.categories = db.categories.filter((c) => c.id !== data.categoryId);
    // Limpiar referencia en fichas
    for (const f of db.fichas) {
      if (f.categoryId === data.categoryId) f.categoryId = null;
    }
    await saveDB(data.projectId, db);
    return { ok: true };
  });

/** Asignar categoría a ficha */
export const assignCategory = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => assignCategorySchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const db = await loadDB(data.projectId);
    const ficha = db.fichas.find((f) => f.id === data.fichaId);
    if (!ficha) throw new Error("Ficha no encontrada");
    ficha.categoryId = data.categoryId;
    await saveDB(data.projectId, db);
    return { ok: true };
  });

// ============================================================================
// Búsqueda de Places y acciones bulk
// ============================================================================

/** Buscar fichas en Google Places (hasta 5 resultados con rating/reseñas) */
export const searchPlacesAction = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => searchPlacesSchema.parse(data))
  .handler(async ({ data }): Promise<PlaceSearchResult[]> => {
    return searchPlacesLib(data.query);
  });

/** Eliminar fichas en bulk */
export const deleteFichasBulk = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => deleteFichasBulkSchema.parse(data))
  .handler(async ({ data }): Promise<{ deleted: number }> => {
    const db = await loadDB(data.projectId);
    const idsSet = new Set(data.fichaIds);
    const before = db.fichas.length;
    db.fichas = db.fichas.filter((f) => !idsSet.has(f.id));
    await saveDB(data.projectId, db);
    return { deleted: before - db.fichas.length };
  });

