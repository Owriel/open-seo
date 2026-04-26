// oxlint-disable max-lines -- Dashboard con múltiples secciones (header, stats, quick actions, recientes) y sub-componentes de presentación
// Dashboard del proyecto.
//
// Reemplaza el antiguo redirect a /keywords. El objetivo es que el usuario
// tenga un hub visual al entrar: nombre del negocio, dominio, stats rápidos,
// accesos directos a los módulos más usados y las últimas auditorías.
//
// Si el proyecto NO tiene dominio NI keyword configurada, mostramos un
// banner de bienvenida que empuja al usuario al settings para rellenar los
// campos antes de usar el resto de la app.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BarChart3,
  Bot,
  ClipboardCheck,
  FileBarChart,
  FileText,
  Globe,
  Grid3x3,
  Languages,
  Link2,
  MapPin,
  Network,
  Search,
  Settings,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  getProjectDashboard,
  type ProjectDashboardData,
} from "@/serverFunctions/project";
import { getStandardErrorMessage } from "@/client/lib/error-messages";

export const Route = createFileRoute("/p/$projectId/")({
  component: ProjectDashboard,
});

function ProjectDashboard() {
  const { projectId } = Route.useParams();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["projectDashboard", projectId],
    queryFn: () => getProjectDashboard({ data: { projectId } }),
  });

  if (isLoading) {
    return (
      <div className="px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-8 overflow-auto">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="skeleton h-32 w-full rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-24 rounded-xl" />
            ))}
          </div>
          <div className="skeleton h-6 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-20 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="px-4 py-4 md:px-6 md:py-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error flex items-start gap-2">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>
              {getStandardErrorMessage(
                error,
                "No se pudo cargar el dashboard del proyecto.",
              )}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const { project, stats, recentAudits } = data;
  const isUnconfigured = !project.domain && !project.targetKeyword;

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-8 overflow-auto">
      <div className="mx-auto max-w-6xl space-y-6">
        {isUnconfigured ? (
          <WelcomeBanner projectId={projectId} />
        ) : (
          <ProjectHeader project={project} projectId={projectId} />
        )}

        <StatCards stats={stats} />

        <QuickActions projectId={projectId} />

        <RecentSection recentAudits={recentAudits} projectId={projectId} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Banner de bienvenida (proyecto sin configurar)
// ---------------------------------------------------------------------------

function WelcomeBanner({ projectId }: { projectId: string }) {
  return (
    <div className="bg-gradient-to-br from-primary/10 via-base-100 to-base-100 border border-primary/30 rounded-xl p-6 md:p-8">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
        <div className="shrink-0 size-14 rounded-full bg-primary/15 text-primary flex items-center justify-center">
          <Sparkles className="size-7" />
        </div>
        <div className="flex-1 space-y-1">
          <h1 className="text-2xl font-semibold">
            Bienvenido a tu proyecto OpenSEO
          </h1>
          <p className="text-sm text-base-content/70">
            Configura tu dominio y keyword objetivo para que el resto de módulos
            (keywords, auditorías, geo-grid, reseñas...) se autorrellenen
            automáticamente.
          </p>
        </div>
        <Link
          to="/p/$projectId/settings"
          params={{ projectId }}
          className="btn btn-primary gap-2"
        >
          <Settings className="size-4" />
          Configurar proyecto
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header con datos del proyecto
// ---------------------------------------------------------------------------

function ProjectHeader({
  project,
  projectId,
}: {
  project: ProjectDashboardData["project"];
  projectId: string;
}) {
  // Iniciales del negocio para el "logo" placeholder (2 primeras letras).
  const displayName = project.businessName ?? project.name;
  const initials = getInitials(displayName);

  // URL clickable del dominio: si no lleva protocolo, añadimos https://.
  const domainHref = project.domain ? toAbsoluteUrl(project.domain) : null;

  return (
    <div className="bg-base-100 border border-base-300 rounded-xl p-5 md:p-6">
      <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-5">
        {/* Logo placeholder */}
        <div className="shrink-0 size-16 md:size-20 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-2xl md:text-3xl font-bold">
          {initials}
        </div>

        {/* Info principal */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {domainHref ? (
            <a
              href={domainHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-2xl md:text-3xl font-semibold hover:text-primary transition-colors break-all"
            >
              {project.domain}
            </a>
          ) : (
            <h1 className="text-2xl md:text-3xl font-semibold">
              {project.name}
            </h1>
          )}

          <p className="text-sm text-base-content/70">
            {displayName}
            {project.domain && project.name !== displayName
              ? ` · ${project.name}`
              : null}
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            {project.locationName ? (
              <span className="badge badge-ghost gap-1">
                <MapPin className="size-3" />
                {project.locationName}
              </span>
            ) : null}
            {project.targetKeyword ? (
              <span className="badge badge-ghost gap-1">
                <Search className="size-3" />
                {project.targetKeyword}
              </span>
            ) : null}
            {project.languageCode ? (
              <span className="badge badge-ghost gap-1 uppercase">
                <Languages className="size-3" />
                {project.languageCode}
              </span>
            ) : null}
          </div>
        </div>

        {/* Botón configurar */}
        <Link
          to="/p/$projectId/settings"
          params={{ projectId }}
          className="btn btn-sm btn-ghost gap-2 shrink-0"
        >
          <Settings className="size-4" />
          Configurar
        </Link>
      </div>
    </div>
  );
}

// Devuelve las 2 primeras iniciales del nombre (en mayúsculas).
function getInitials(name: string): string {
  const clean = name.trim();
  if (clean.length === 0) return "?";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Convierte un dominio sin protocolo (p.ej. "fiscalis.es") a URL absoluta.
function toAbsoluteUrl(domain: string): string {
  const trimmed = domain.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

// ---------------------------------------------------------------------------
// Stat cards
// ---------------------------------------------------------------------------

function StatCards({ stats }: { stats: ProjectDashboardData["stats"] }) {
  const items: Array<{
    label: string;
    value: string;
    icon: typeof ClipboardCheck;
    accent: string;
  }> = [
    {
      label: "Auditorías",
      value: stats.audits.toString(),
      icon: ClipboardCheck,
      accent: "text-primary",
    },
    {
      label: "Keywords guardadas",
      value: stats.savedKeywords.toString(),
      icon: Search,
      accent: "text-success",
    },
    {
      label: "Posiciones tracked",
      value: stats.trackedKeywords.toString(),
      icon: TrendingUp,
      accent: "text-info",
    },
    {
      label: "Rating medio",
      value: stats.latestRating == null ? "—" : stats.latestRating.toFixed(1),
      icon: Star,
      accent: "text-warning",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="bg-base-100 border border-base-300 rounded-xl p-4 flex items-center gap-3"
          >
            <div
              className={`size-10 rounded-lg bg-base-200 flex items-center justify-center ${item.accent}`}
            >
              <Icon className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold leading-none">
                {item.value}
              </div>
              <div className="text-xs text-base-content/60 mt-1 truncate">
                {item.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Acciones rápidas
// ---------------------------------------------------------------------------

// Items del bloque de accesos directos. Cada uno lleva a un módulo concreto.
// Usamos `to` tipado para que TanStack Router valide las rutas en compilación.
const QUICK_ACTIONS = [
  {
    to: "/p/$projectId/keywords" as const,
    title: "Investigar keyword",
    subtitle: "Volumen, CPC, intent, KD",
    icon: Search,
    accent: "bg-primary/10 text-primary",
  },
  {
    to: "/p/$projectId/audit" as const,
    title: "Auditar sitio",
    subtitle: "Crawl + Lighthouse + SEO on-page",
    icon: ClipboardCheck,
    accent: "bg-success/10 text-success",
  },
  {
    to: "/p/$projectId/local-grid" as const,
    title: "Geo-Grid",
    subtitle: "Posición por punto en Google Maps",
    icon: Grid3x3,
    accent: "bg-warning/10 text-warning",
  },
  {
    to: "/p/$projectId/reviews" as const,
    title: "Analizar reseñas",
    subtitle: "Google Business Profile",
    icon: Star,
    accent: "bg-warning/10 text-warning",
  },
  {
    to: "/p/$projectId/backlinks" as const,
    title: "Analizar backlinks",
    subtitle: "Perfil de enlaces + anchors",
    icon: Link2,
    accent: "bg-info/10 text-info",
  },
  {
    to: "/p/$projectId/report" as const,
    title: "Generar informe",
    subtitle: "Entregable cliente",
    icon: FileBarChart,
    accent: "bg-secondary/10 text-secondary",
  },
] as const;

// Segundo bloque: módulos adicionales menos prioritarios pero accesibles.
const SECONDARY_ACTIONS = [
  {
    to: "/p/$projectId/tracker" as const,
    title: "Tracker posiciones",
    icon: TrendingUp,
  },
  {
    to: "/p/$projectId/domain" as const,
    title: "Análisis dominio",
    icon: Globe,
  },
  {
    to: "/p/$projectId/competitors" as const,
    title: "Competencia",
    icon: Users,
  },
  {
    to: "/p/$projectId/clusters" as const,
    title: "Clusters",
    icon: Network,
  },
  {
    to: "/p/$projectId/serp" as const,
    title: "SERP",
    icon: BarChart3,
  },
  {
    to: "/p/$projectId/local" as const,
    title: "SEO Local",
    icon: MapPin,
  },
  {
    to: "/p/$projectId/multilang" as const,
    title: "Multiidioma",
    icon: Languages,
  },
  {
    to: "/p/$projectId/opportunities" as const,
    title: "Oportunidades",
    icon: Target,
  },
  {
    to: "/p/$projectId/wordpress" as const,
    title: "WordPress",
    icon: FileText,
  },
  {
    to: "/p/$projectId/ai" as const,
    title: "Asistente IA",
    icon: Bot,
  },
] as const;

function QuickActions({ projectId }: { projectId: string }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-base-content/60">
          Acciones rápidas
        </h2>
      </div>

      {/* Bloque principal: cards grandes con subtítulo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.to}
              to={action.to}
              params={{ projectId }}
              className="group bg-base-100 border border-base-300 rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all flex items-start gap-3"
            >
              <div
                className={`size-10 rounded-lg ${action.accent} flex items-center justify-center shrink-0`}
              >
                <Icon className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="font-medium group-hover:text-primary transition-colors">
                  {action.title}
                </div>
                <div className="text-xs text-base-content/60 mt-0.5">
                  {action.subtitle}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Bloque secundario: pastillas pequeñas para módulos extra */}
      <div className="flex flex-wrap gap-2 pt-1">
        {SECONDARY_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.to}
              to={action.to}
              params={{ projectId }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-base-300 bg-base-100 text-xs text-base-content/70 hover:border-primary/40 hover:text-primary transition-colors"
            >
              <Icon className="size-3.5" />
              {action.title}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Reciente (últimas auditorías)
// ---------------------------------------------------------------------------

function RecentSection({
  recentAudits,
  projectId,
}: {
  recentAudits: ProjectDashboardData["recentAudits"];
  projectId: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-base-content/60">
          Reciente
        </h2>
        {recentAudits.length > 0 ? (
          <Link
            to="/p/$projectId/audit"
            params={{ projectId }}
            className="text-xs text-primary hover:underline"
          >
            Ver todas →
          </Link>
        ) : null}
      </div>

      {recentAudits.length === 0 ? (
        <div className="bg-base-100 border border-dashed border-base-300 rounded-xl p-6 text-center text-sm text-base-content/60">
          Aún no has lanzado ninguna auditoría para este proyecto.{" "}
          <Link
            to="/p/$projectId/audit"
            params={{ projectId }}
            className="text-primary hover:underline"
          >
            Lanzar la primera →
          </Link>
        </div>
      ) : (
        <div className="bg-base-100 border border-base-300 rounded-xl overflow-hidden">
          <ul className="divide-y divide-base-200">
            {recentAudits.map((audit) => (
              <li key={audit.id}>
                <Link
                  to="/p/$projectId/audit"
                  params={{ projectId }}
                  search={{ auditId: audit.id }}
                  className="flex items-center gap-3 p-3 hover:bg-base-200/50 transition-colors"
                >
                  <AuditStatusDot status={audit.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {audit.startUrl}
                    </div>
                    <div className="text-xs text-base-content/60">
                      {formatDate(audit.startedAt)} · {audit.pagesCrawled}{" "}
                      página
                      {audit.pagesCrawled === 1 ? "" : "s"} rastreada
                      {audit.pagesCrawled === 1 ? "" : "s"}
                    </div>
                  </div>
                  <AuditStatusBadge status={audit.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function AuditStatusDot({
  status,
}: {
  status: "running" | "completed" | "failed";
}) {
  const color =
    status === "completed"
      ? "bg-success"
      : status === "failed"
        ? "bg-error"
        : "bg-warning animate-pulse";
  return <span className={`inline-block size-2.5 rounded-full ${color}`} />;
}

function AuditStatusBadge({
  status,
}: {
  status: "running" | "completed" | "failed";
}) {
  if (status === "completed") {
    return <span className="badge badge-success badge-sm">Completada</span>;
  }
  if (status === "failed") {
    return <span className="badge badge-error badge-sm">Falló</span>;
  }
  return <span className="badge badge-warning badge-sm">En curso</span>;
}

// Formatea una fecha ISO a algo legible en español: "21 abr 2026, 14:30".
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
