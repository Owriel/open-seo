import { env } from "cloudflare:workers";

// ---------------------------------------------------------------------------
// Simple auth: username/password login with HMAC-signed cookie
// Credenciales y secreto se leen de variables de entorno (env.AUTH_USERS, env.AUTH_SECRET)
// ---------------------------------------------------------------------------

const COOKIE_NAME = "openseo_session";
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

/** Lee usuarios desde env.AUTH_USERS (JSON: {"user":"pass"}) */
function getUsers(): Record<string, string> {
  try {
    const raw = env.AUTH_USERS;
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string") result[k] = v;
    }
    return result;
  } catch {
    return {};
  }
}

function getSecret(): string {
  const secret = env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET no configurado en variables de entorno");
  return secret;
}

// ---------------------------------------------------------------------------
// Crypto helpers (Web Crypto API — available in Cloudflare Workers)
// ---------------------------------------------------------------------------

async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(payload, secret);
  return expected === signature;
}

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

function parseCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") ?? "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the authenticated username from the cookie, or null.
 */
export async function getAuthUser(request: Request): Promise<string | null> {
  const cookie = parseCookie(request, COOKIE_NAME);
  if (!cookie) return null;

  const parts = cookie.split(":");
  if (parts.length !== 3) return null;

  const [username, timestamp, signature] = parts;
  const payload = `${username}:${timestamp}`;
  const secret = getSecret();

  const valid = await hmacVerify(payload, signature, secret);
  if (!valid) return null;

  // Check expiry
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Date.now() - ts > MAX_AGE * 1000) return null;

  // Confirmar que el usuario sigue existiendo
  const users = getUsers();
  if (!(username in users)) return null;

  return username;
}

/**
 * Worker-level auth gate. Returns a Response if the request should be
 * intercepted (login page, POST handler, logout). Returns null if the
 * request is authenticated and should be passed through.
 */
export async function handleAuth(request: Request): Promise<Response | null> {
  const url = new URL(request.url);

  // ---- Login POST --------------------------------------------------------
  if (url.pathname === "/__auth/login" && request.method === "POST") {
    const form = await request.formData();
    const rawUser = form.get("username");
    const rawPass = form.get("password");
    const username = (typeof rawUser === "string" ? rawUser : "").trim();
    const password = typeof rawPass === "string" ? rawPass : "";

    const users = getUsers();
    if (username in users && users[username] === password) {
      const secret = getSecret();
      const timestamp = Date.now().toString();
      const payload = `${username}:${timestamp}`;
      const signature = await hmacSign(payload, secret);
      const cookieValue = `${username}:${timestamp}:${signature}`;

      return new Response(null, {
        status: 302,
        headers: {
          Location: "/",
          "Set-Cookie": `${COOKIE_NAME}=${encodeURIComponent(cookieValue)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}`,
        },
      });
    }

    // Invalid credentials
    return new Response(loginPageHTML("Usuario o contraseña incorrectos"), {
      status: 401,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // ---- Logout ------------------------------------------------------------
  if (url.pathname === "/__auth/logout") {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/__auth/login",
        "Set-Cookie": `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`,
      },
    });
  }

  // ---- Login page GET ----------------------------------------------------
  if (url.pathname === "/__auth/login") {
    const user = await getAuthUser(request);
    if (user) {
      return new Response(null, { status: 302, headers: { Location: "/" } });
    }
    return new Response(loginPageHTML(), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // ---- Check session for all other routes --------------------------------
  const user = await getAuthUser(request);
  if (user) return null; // Authenticated → pass through

  // Not authenticated → redirect to login
  return new Response(null, {
    status: 302,
    headers: { Location: "/__auth/login" },
  });
}

// ---------------------------------------------------------------------------
// Login page HTML (standalone — no dependency on app build)
// ---------------------------------------------------------------------------

function loginPageHTML(error?: string): string {
  return `<!DOCTYPE html>
<html lang="es" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OpenSEO — Login</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#1d232a;color:#a6adbb}
    .card{background:#2a323c;border-radius:1rem;padding:2rem;width:100%;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,.3)}
    h1{text-align:center;font-size:1.5rem;font-weight:700;color:#fff;margin-bottom:.25rem}
    .subtitle{text-align:center;font-size:.85rem;color:#a6adbb;margin-bottom:1.5rem}
    label{display:block;font-size:.85rem;margin-bottom:.35rem;color:#a6adbb}
    input{width:100%;padding:.65rem .85rem;border-radius:.5rem;border:1px solid #3d4451;background:#1d232a;color:#fff;font-size:.95rem;outline:none;transition:border-color .2s}
    input:focus{border-color:#661ae6}
    .field{margin-bottom:1rem}
    button{width:100%;padding:.7rem;border:none;border-radius:.5rem;background:#661ae6;color:#fff;font-size:1rem;font-weight:600;cursor:pointer;transition:background .2s}
    button:hover{background:#7c3aed}
    .error{background:#3b1219;border:1px solid #f87272;color:#f87272;padding:.5rem .75rem;border-radius:.5rem;font-size:.85rem;margin-bottom:1rem;text-align:center}
  </style>
</head>
<body>
  <div class="card">
    <h1>OpenSEO</h1>
    <p class="subtitle">Inicia sesion para continuar</p>
    ${error ? `<div class="error">${error}</div>` : ""}
    <form method="POST" action="/__auth/login">
      <div class="field">
        <label for="username">Usuario</label>
        <input type="text" id="username" name="username" required autofocus autocomplete="username">
      </div>
      <div class="field">
        <label for="password">Contrasena</label>
        <input type="password" id="password" name="password" required autocomplete="current-password">
      </div>
      <button type="submit">Entrar</button>
    </form>
  </div>
</body>
</html>`;
}
