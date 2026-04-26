// Custom environment variable type definitions
// These extend the auto-generated Env interface from worker-configuration.d.ts

declare namespace Cloudflare {
  interface Env {
    R2: R2Bucket;

    AUTH_MODE?: "cloudflare_access" | "local_noauth";
    TEAM_DOMAIN?: string;
    POLICY_AUD?: string;

    // DataForSEO API Basic auth value (base64 of login:password)
    DATAFORSEO_API_KEY: string;

    // Google Places API key (para módulo multilang)
    GOOGLE_PLACES_API_KEY?: string;

    // Google OAuth2 credentials (para Google Search Console)
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;

    // URL base de la aplicación (usada en OAuth callbacks)
    APP_URL?: string;

    // Credenciales de autenticación simple (JSON: {"user":"pass"})
    AUTH_USERS?: string;
    // Secreto HMAC para firmar cookies de sesión
    AUTH_SECRET?: string;
  }
}
