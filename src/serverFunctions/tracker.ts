import { createServerFn } from "@tanstack/react-start";
import { authenticatedServerFunctionMiddleware } from "@/serverFunctions/middleware";
import {
  addTrackedKeywordsSchema,
  removeTrackedKeywordSchema,
  getTrackedKeywordsSchema,
  checkRankingsSchema,
} from "@/types/schemas/tracker";
import { trackedKeywords, rankHistory } from "@/db/schema";
import { db } from "@/db";
import { eq, desc } from "drizzle-orm";
import type { TrackedKeywordRow } from "@/types/tracker";
import { fetchHistoricalSerpsRaw } from "@/server/lib/dataforseo";

export const addTrackedKeywords = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => addTrackedKeywordsSchema.parse(data))
  .handler(async ({ data }) => {
    const results: string[] = [];

    for (const keyword of data.keywords) {
      const id = crypto.randomUUID();
      try {
        await db.insert(trackedKeywords).values({
          id,
          projectId: data.projectId,
          keyword: keyword.toLowerCase().trim(),
          domain: data.domain.toLowerCase().trim(),
          locationCode: data.locationCode,
          languageCode: data.languageCode,
        }).onConflictDoNothing();
        results.push(keyword);
      } catch {
        // Skip duplicates
      }
    }

    return { added: results.length };
  });

export const removeTrackedKeyword = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => removeTrackedKeywordSchema.parse(data))
  .handler(async ({ data }) => {
    await db.delete(trackedKeywords).where(eq(trackedKeywords.id, data.trackedKeywordId));
    return { success: true };
  });

export const getTrackedKeywords = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => getTrackedKeywordsSchema.parse(data))
  .handler(async ({ data }): Promise<{ keywords: TrackedKeywordRow[] }> => {
    const tracked = await db
      .select()
      .from(trackedKeywords)
      .where(eq(trackedKeywords.projectId, data.projectId))
      .orderBy(trackedKeywords.keyword);

    const keywords: TrackedKeywordRow[] = [];

    for (const tk of tracked) {
      // Get last 2 rank checks for this keyword
      const history = await db
        .select()
        .from(rankHistory)
        .where(eq(rankHistory.trackedKeywordId, tk.id))
        .orderBy(desc(rankHistory.checkedAt))
        .limit(2);

      // Get best position ever
      const allHistory = await db
        .select()
        .from(rankHistory)
        .where(eq(rankHistory.trackedKeywordId, tk.id))
        .orderBy(rankHistory.position)
        .limit(1);

      const current = history[0] ?? null;
      const previous = history[1] ?? null;
      const best = allHistory[0] ?? null;

      const currentPos = current?.position ?? null;
      const previousPos = previous?.position ?? null;
      const change = currentPos != null && previousPos != null
        ? previousPos - currentPos // positive = improved (went up)
        : null;

      keywords.push({
        id: tk.id,
        keyword: tk.keyword,
        domain: tk.domain,
        locationCode: tk.locationCode,
        languageCode: tk.languageCode,
        currentPosition: currentPos,
        previousPosition: previousPos,
        bestPosition: best?.position ?? null,
        rankingUrl: current?.url ?? null,
        lastChecked: current?.checkedAt ?? null,
        change,
      });
    }

    return { keywords };
  });

export const checkRankings = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => checkRankingsSchema.parse(data))
  .handler(async ({ data }): Promise<{ checked: number; errors: number }> => {
    const tracked = await db
      .select()
      .from(trackedKeywords)
      .where(eq(trackedKeywords.projectId, data.projectId));

    let checked = 0;
    let errors = 0;

    for (const tk of tracked) {
      try {
        // Use Historical SERPs to find current ranking
        const serpSnapshots = await fetchHistoricalSerpsRaw(
          tk.keyword,
          tk.locationCode,
          tk.languageCode,
        );

        // Get most recent snapshot
        const latestSnapshot = serpSnapshots[0];
        const items = (latestSnapshot as unknown as { items?: Array<{ domain?: string; rank_absolute?: number; rank_group?: number; url?: string }> })?.items ?? [];

        // Find our domain in the results
        let position: number | null = null;
        let url: string | null = null;
        const domainLower = tk.domain.toLowerCase();

        for (const item of items) {
          const itemDomain = (item.domain ?? "").toLowerCase();
          if (itemDomain.includes(domainLower) || domainLower.includes(itemDomain)) {
            position = item.rank_absolute ?? item.rank_group ?? null;
            url = item.url ?? null;
            break;
          }
        }

        // Insert rank history entry
        await db.insert(rankHistory).values({
          trackedKeywordId: tk.id,
          position,
          url,
        });

        checked++;
      } catch {
        errors++;
      }
    }

    return { checked, errors };
  });
