import { z } from "zod";

export const wpConfigSchema = z.object({
  projectId: z.string().min(1),
  wpUrl: z.string().url().trim(),
  wpUser: z.string().min(1).trim(),
  wpAppPassword: z.string().min(1),
});

export const wpGetConfigSchema = z.object({
  projectId: z.string().min(1),
});

export const wpTestSchema = z.object({
  projectId: z.string().min(1),
});

export const wpPublishSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).trim(),
  content: z.string().min(1),
  status: z.enum(["draft", "publish"]).default("draft"),
});
