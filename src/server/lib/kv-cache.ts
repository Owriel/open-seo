import { env } from "cloudflare:workers";
import { sortBy } from "remeda";
import { z } from "zod";
import { jsonCodec } from "@/shared/json";
import { db } from "@/db";
import { cacheEntries } from "@/db/schema";
import { eq, lte, sql } from "drizzle-orm";

/**
 * Cache TTL — 30 days for everything.
 */
export const CACHE_TTL_SECONDS = 2592000; // 30 days

/** @deprecated Use CACHE_TTL_SECONDS directly */
export const CACHE_TTL = {
  researchResult: CACHE_TTL_SECONDS,
  localPack: CACHE_TTL_SECONDS,
  localKeywords: CACHE_TTL_SECONDS,
  competitors: CACHE_TTL_SECONDS,
  keywordIntersection: CACHE_TTL_SECONDS,
} as const;

const jsonUnknownCodec = jsonCodec(z.unknown());

/** Category labels for human-readable display */
const CATEGORY_LABELS: Record<string, string> = {
  "kw:research": "Investigación de Keywords",
  "serp:analysis": "Análisis SERP",
  "domain:overview": "Resumen de Dominio",
  "domain:keywords": "Keywords del Dominio",
  "local:pack": "SEO Local - Pack",
  "local:keywords": "SEO Local - Keywords",
  "comp:find": "Competidores",
  "comp:intersection": "Intersección de Keywords",
  "cluster:gen": "Clusters de Keywords",
  "opp:dataforseo": "Oportunidades (DataForSEO)",
};

/**
 * Build a deterministic cache key from an endpoint slug and input params.
 * Uses FNV-1a hash for compactness.
 */
export function buildCacheKey(
  prefix: string,
  params: Record<string, unknown>,
): string {
  const raw = JSON.stringify(
    params,
    sortBy(Object.keys(params), (key) => key),
  );
  return `${prefix}:${fnv1a(raw)}`;
}

/**
 * Helper para parsear JSON desde un string con un tipo esperado.
 * Centraliza el unsafe cast en un único lugar.
 */
export function parseJson<T>(raw: string): T {
  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  return JSON.parse(raw) as T;
}

/**
 * Get a cached JSON value from KV. Returns null on miss.
 */
export async function getCached<T = unknown>(key: string): Promise<T | null> {
  const value = await env.KV.get(key, "text");
  if (value === null) return null;
  const parsed = jsonUnknownCodec.safeParse(value);
  // eslint-disable-next-line typescript/no-unsafe-type-assertion
  return parsed.success ? (parsed.data as T) : null;
}

/**
 * Store a JSON value in KV with a TTL in seconds.
 * Also records metadata in D1 for cache management UI.
 */
export async function setCached<T>(
  key: string,
  data: T,
  ttlSeconds: number,
  meta?: { label?: string; params?: Record<string, unknown> },
): Promise<void> {
  // Store in KV
  await env.KV.put(key, JSON.stringify(data), {
    expirationTtl: ttlSeconds,
  });

  // Store metadata in D1
  const _prefix = key.split(":")[0] + (key.includes(":") ? ":" + key.split(":")[1]?.split(":")[0] : "");
  const categoryPrefix = key.substring(0, key.lastIndexOf(":"));
  const label = meta?.label ?? CATEGORY_LABELS[categoryPrefix] ?? categoryPrefix;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  try {
    // Upsert: delete old entry then insert
    await db.delete(cacheEntries).where(eq(cacheEntries.kvKey, key));
    await db.insert(cacheEntries).values({
      kvKey: key,
      label,
      category: categoryPrefix,
      paramsJson: meta?.params ? JSON.stringify(meta.params) : null,
      expiresAt,
    });
  } catch (err) {
    // Don't fail the cache write if metadata tracking fails
    console.error("[CACHE] Failed to store metadata:", err);
  }
}

/**
 * Delete a cached entry from both KV and D1.
 */
export async function deleteCached(key: string): Promise<void> {
  await env.KV.delete(key);
  await db.delete(cacheEntries).where(eq(cacheEntries.kvKey, key));
}

/**
 * Extend a cache entry by another 30 days.
 */
export async function extendCached(key: string): Promise<boolean> {
  // Check if the value still exists in KV
  const value = await env.KV.get(key, "text");
  if (value === null) {
    // KV entry expired, clean up D1 metadata
    await db.delete(cacheEntries).where(eq(cacheEntries.kvKey, key));
    return false;
  }

  // Re-put in KV with fresh TTL
  await env.KV.put(key, value, { expirationTtl: CACHE_TTL_SECONDS });

  // Update D1 metadata
  const newExpiresAt = new Date(Date.now() + CACHE_TTL_SECONDS * 1000).toISOString();
  await db
    .update(cacheEntries)
    .set({
      expiresAt: newExpiresAt,
      extendedCount: sql`${cacheEntries.extendedCount} + 1`,
    })
    .where(eq(cacheEntries.kvKey, key));

  return true;
}

/**
 * Get all cache entries, optionally filtered by expiration status.
 */
export async function listCacheEntries(filter?: "expiring" | "all") {
  if (filter === "expiring") {
    // Entries expiring in the next 3 days
    const threshold = new Date(Date.now() + 3 * 86400 * 1000).toISOString();
    return db
      .select()
      .from(cacheEntries)
      .where(lte(cacheEntries.expiresAt, threshold))
      .orderBy(cacheEntries.expiresAt);
  }
  return db.select().from(cacheEntries).orderBy(cacheEntries.expiresAt);
}

/**
 * Clean up D1 metadata for entries that have already expired in KV.
 */
export async function cleanupExpiredMetadata(): Promise<number> {
  const now = new Date().toISOString();
  const expired = await db
    .select({ id: cacheEntries.id, kvKey: cacheEntries.kvKey })
    .from(cacheEntries)
    .where(lte(cacheEntries.expiresAt, now));

  let cleaned = 0;
  for (const entry of expired) {
    const exists = await env.KV.get(entry.kvKey, "text");
    if (exists === null) {
      await db.delete(cacheEntries).where(eq(cacheEntries.id, entry.id));
      cleaned++;
    }
  }
  return cleaned;
}

/**
 * FNV-1a hash — fast, good distribution for cache keys.
 */
function fnv1a(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
