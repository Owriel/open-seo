import { createServerFn } from "@tanstack/react-start";
import { authenticatedServerFunctionMiddleware } from "@/serverFunctions/middleware";
import {
  wpConfigSchema,
  wpGetConfigSchema,
  wpTestSchema,
  wpPublishSchema,
} from "@/types/schemas/wordpress";
import { env } from "cloudflare:workers";
import type { WpConfig, WpPublishResult } from "@/types/wordpress";

// KV key para config WP de un proyecto
function configKey(projectId: string) {
  return `wp:config:${projectId}`;
}

// Tipo interno con password incluida (nunca se envía al cliente)
type WpConfigInternal = {
  wpUrl: string;
  wpUser: string;
  wpAppPassword: string; // codificada en base64
};

// Leer config interna desde KV
async function loadConfig(projectId: string): Promise<WpConfigInternal | null> {
  const raw = await env.KV.get(configKey(projectId), "text");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WpConfigInternal;
  } catch {
    return null;
  }
}

// Crear header de Basic Auth
function makeAuthHeader(user: string, passwordBase64: string): string {
  // La password está guardada en base64, la decodificamos para construir el Basic Auth
  const password = atob(passwordBase64);
  return `Basic ${btoa(`${user}:${password}`)}`;
}

export const saveWpConfig = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => wpConfigSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    // Normalizar URL (quitar trailing slash)
    const wpUrl = data.wpUrl.replace(/\/+$/, "");

    const config: WpConfigInternal = {
      wpUrl,
      wpUser: data.wpUser,
      wpAppPassword: btoa(data.wpAppPassword), // Codificar en base64
    };

    await env.KV.put(configKey(data.projectId), JSON.stringify(config));
    return { success: true };
  });

export const getWpConfig = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => wpGetConfigSchema.parse(data))
  .handler(async ({ data }): Promise<{ config: WpConfig | null }> => {
    const internal = await loadConfig(data.projectId);
    if (!internal) return { config: null };

    // Nunca devolver la password al cliente
    return {
      config: {
        wpUrl: internal.wpUrl,
        wpUser: internal.wpUser,
        hasPassword: !!internal.wpAppPassword,
      },
    };
  });

export const testWpConnection = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => wpTestSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: boolean; message: string; siteName?: string }> => {
    const config = await loadConfig(data.projectId);
    if (!config) {
      return { success: false, message: "No hay configuración de WordPress guardada" };
    }

    try {
      const res = await fetch(`${config.wpUrl}/wp-json/wp/v2/users/me`, {
        headers: {
          Authorization: makeAuthHeader(config.wpUser, config.wpAppPassword),
        },
      });

      if (!res.ok) {
        const text = await res.text();
        return {
          success: false,
          message: `Error ${res.status}: ${text.slice(0, 200)}`,
        };
      }

      const user = await res.json() as { name?: string };
      return {
        success: true,
        message: `Conectado como ${user.name ?? config.wpUser}`,
        siteName: user.name,
      };
    } catch (err) {
      return {
        success: false,
        message: `Error de conexión: ${err instanceof Error ? err.message : "desconocido"}`,
      };
    }
  });

export const publishToWordPress = createServerFn({ method: "POST" })
  .middleware(authenticatedServerFunctionMiddleware)
  .inputValidator((data: unknown) => wpPublishSchema.parse(data))
  .handler(async ({ data }): Promise<WpPublishResult> => {
    const config = await loadConfig(data.projectId);
    if (!config) {
      throw new Error("No hay configuración de WordPress guardada");
    }

    const res = await fetch(`${config.wpUrl}/wp-json/wp/v2/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: makeAuthHeader(config.wpUser, config.wpAppPassword),
      },
      body: JSON.stringify({
        title: data.title,
        content: data.content,
        status: data.status,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`WordPress API error ${res.status}: ${text.slice(0, 300)}`);
    }

    const post = await res.json() as {
      id: number;
      link: string;
      status: string;
      _links?: { edit?: Array<{ href: string }> };
    };

    return {
      postId: post.id,
      postUrl: post.link,
      editUrl: `${config.wpUrl}/wp-admin/post.php?post=${post.id}&action=edit`,
      status: post.status,
    };
  });
