import { z } from "zod";

export const cacheActionSchema = z.object({
  kvKey: z.string().min(1),
});

export const cacheBulkActionSchema = z.object({
  kvKeys: z.array(z.string().min(1)).min(1),
  action: z.enum(["extend", "delete"]),
});
