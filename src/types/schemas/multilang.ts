import { z } from "zod";

/** Schema para obtener datos multilang de un proyecto */
export const getMultilangDataSchema = z.object({
  projectId: z.string().min(1),
});

/** Schema para añadir fichas en bulk */
export const addFichasSchema = z.object({
  projectId: z.string().min(1),
  entries: z.array(z.object({ input: z.string().min(1) })).min(1),
});

/** Schema para analizar una ficha individual */
export const analyzeFichaSchema = z.object({
  projectId: z.string().min(1),
  fichaId: z.string().min(1),
});

/** Schema para eliminar una ficha */
export const deleteFichaSchema = z.object({
  projectId: z.string().min(1),
  fichaId: z.string().min(1),
});

/** Schema para eliminar todas las fichas */
export const deleteAllFichasSchema = z.object({
  projectId: z.string().min(1),
});

/** Schema para crear categoría */
export const createCategorySchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
});

/** Schema para actualizar categoría */
export const updateCategorySchema = z.object({
  projectId: z.string().min(1),
  categoryId: z.string().min(1),
  name: z.string().optional(),
  keywords: z.array(z.string()).optional(),
});

/** Schema para eliminar categoría */
export const deleteCategorySchema = z.object({
  projectId: z.string().min(1),
  categoryId: z.string().min(1),
});

/** Schema para asignar categoría a ficha */
export const assignCategorySchema = z.object({
  projectId: z.string().min(1),
  fichaId: z.string().min(1),
  categoryId: z.string().nullable(),
});

/** Schema para buscar fichas en Google Places */
export const searchPlacesSchema = z.object({
  query: z.string().min(2),
});

/** Schema para eliminar fichas en bulk */
export const deleteFichasBulkSchema = z.object({
  projectId: z.string().min(1),
  fichaIds: z.array(z.string().min(1)).min(1),
});
