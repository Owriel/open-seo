import { createServerFn } from "@tanstack/react-start";
import { authenticatedServerFunctionMiddleware } from "@/serverFunctions/middleware";
import { cacheActionSchema, cacheBulkActionSchema } from "@/types/schemas/cache";
import {
  listCacheEntries,
  extendCached,
  deleteCached,
  cleanupExpiredMetadata,
} from "@/server/lib/kv-cache";

export const getCacheEntries = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .handler(async () => {
    // Clean up expired entries first
    await cleanupExpiredMetadata();

    const entries = await listCacheEntries("all");
    return { entries };
  });

export const extendCacheEntry = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => cacheActionSchema.parse(data))
  .handler(async ({ data }) => {
    const success = await extendCached(data.kvKey);
    return { success };
  });

export const deleteCacheEntry = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => cacheActionSchema.parse(data))
  .handler(async ({ data }) => {
    await deleteCached(data.kvKey);
    return { success: true };
  });

export const bulkCacheAction = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => cacheBulkActionSchema.parse(data))
  .handler(async ({ data }) => {
    const results: { key: string; success: boolean }[] = [];

    for (const key of data.kvKeys) {
      try {
        if (data.action === "extend") {
          const success = await extendCached(key);
          results.push({ key, success });
        } else {
          await deleteCached(key);
          results.push({ key, success: true });
        }
      } catch {
        results.push({ key, success: false });
      }
    }

    return { results };
  });
