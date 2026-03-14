import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Bot, Compass, Lightbulb, Sparkles } from "lucide-react";

const DISCORD_URL = "https://discord.gg/c9uGs3cFXr";
const SUPPORT_EMAIL = "ben@everyapp.com";
const DATAFORSEO_MCP_DOCS_URL =
  "https://dataforseo.com/help-center/setting-up-the-official-dataforseo-mcp-server-simple-guide";

export const Route = createFileRoute("/p/$projectId/ai")({
  component: AiPage,
});

function AiPage() {
  return (
    <div className="px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-8 overflow-auto">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body gap-3">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="size-5" />
              <span className="text-sm font-semibold uppercase tracking-wide">
                Próximamente
              </span>
            </div>
            <h1 className="text-2xl font-semibold">
              Las funciones de IA llegarán pronto
            </h1>
            <p className="text-sm text-base-content/70 max-w-3xl">
              Queremos que sea impulsado por la comunidad. Si hay un flujo de
              trabajo que quieres que resolvamos primero, ¡dínoslo!
            </p>
            <div className="text-sm text-base-content/80">
              Escríbenos en{" "}
              <a
                className="link link-primary"
                href={DISCORD_URL}
                target="_blank"
                rel="noreferrer"
              >
                Discord
              </a>{" "}
              o envíanos un email a{" "}
              <a className="link link-primary" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
              .
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h2 className="card-title text-base">
                  Planificado: Asistente de Contenido
                </h2>
              </div>
              <p className="text-sm text-base-content/70">
                Genera borradores de artículos usando tus keywords guardadas,
                contexto de negocio y estrategia general.
              </p>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300">
            <div className="card-body gap-3">
              <div className="flex items-center gap-2">
                <Bot className="size-4 text-primary" />
                <h2 className="card-title text-base">
                  Planificado: Agente de Investigación SEO
                </h2>
              </div>
              <p className="text-sm text-base-content/70">
                Haz preguntas sobre SEO, ejecuta investigaciones enfocadas y
                obtén ayuda usando la app sin salir de tu flujo de trabajo.
              </p>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 md:col-span-2">
            <div className="card-body gap-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="size-4 text-primary" />
                <h2 className="card-title text-base">
                  Flujo del Asistente de Contenido hoy
                </h2>
              </div>
              <p className="text-sm text-base-content/70">
                Si quieres generar contenido ahora, crea una carpeta local y usa
                Claude Code, Claude/Cowork, Cursor, Codex u otro agente de
                código similar. Pega tus keywords, plan de negocio y estrategia,
                y itera con el agente hasta tener el borrador perfecto.
              </p>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 md:col-span-2">
            <div className="card-body gap-3">
              <div className="flex items-center gap-2">
                <Compass className="size-4 text-primary" />
                <h2 className="card-title text-base">
                  DataForSEO MCP para flujos agénticos
                </h2>
              </div>
              <p className="text-sm text-base-content/70">
                Si quieres la mejor ruta agéntica para datos de la API de
                DataForSEO, usa la guía de configuración oficial del servidor
                MCP de DataForSEO.
              </p>
              <div>
                <a
                  className="btn btn-outline btn-sm"
                  href={DATAFORSEO_MCP_DOCS_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir documentación MCP de DataForSEO
                  <ArrowUpRight className="size-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
