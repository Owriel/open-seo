// Vista pública del informe SEO — accesible sin autenticación
// Preparado para white-label futuro

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPublicReport } from "@/serverFunctions/report";
import type { SeoReport, SectionScore } from "@/types/report";
import {
  Globe,
  TrendingUp,
  Users,
  Search,
  MapPin,
  ClipboardCheck,
  Languages,
  Printer,
  AlertTriangle,
  FileX,
} from "lucide-react";

export const Route = createFileRoute("/report/$reportId")({
  component: PublicReportPage,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convierte el color semántico a clase DaisyUI de badge */
function scoreBadgeClass(color: SectionScore["color"]): string {
  if (color === "green") return "badge-success";
  if (color === "yellow") return "badge-warning";
  return "badge-error";
}

/** Clase de color del texto para la puntuación global */
function scoreTextClass(color: SectionScore["color"]): string {
  if (color === "green") return "text-success";
  if (color === "yellow") return "text-warning";
  return "text-error";
}

/** Clase de borde del anillo para la puntuación global */
function scoreRingClass(color: SectionScore["color"]): string {
  if (color === "green") return "border-success";
  if (color === "yellow") return "border-warning";
  return "border-error";
}

/** Formatea un número con separador de miles */
function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("es-ES");
}

/** Formatea la fecha del informe */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

function PublicReportPage() {
  const { reportId } = Route.useParams();

  const {
    data: report,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["publicReport", reportId],
    queryFn: () => getPublicReport({ data: { reportId } }),
    retry: false,
  });

  // Estado: cargando
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="text-center space-y-4">
          <span className="loading loading-spinner loading-lg text-primary" />
          <p className="text-base-content/70 text-lg">Cargando informe...</p>
        </div>
      </div>
    );
  }

  // Estado: no encontrado o error
  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="card bg-base-100 border border-base-300 max-w-md w-full mx-4">
          <div className="card-body items-center text-center gap-4">
            <FileX className="w-16 h-16 text-base-content/30" />
            <h1 className="text-xl font-semibold">Informe no disponible</h1>
            <p className="text-base-content/60">
              Este informe no existe o ha sido desactivado.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <ReportView report={report} />;
}

// ---------------------------------------------------------------------------
// Vista del informe
// ---------------------------------------------------------------------------

function ReportView({ report }: { report: SeoReport }) {
  const { scores } = report;

  return (
    <div className="min-h-screen bg-base-200 print:bg-white">
      {/* Estilos de impresión */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          .card { break-inside: avoid; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* ===== HEADER ===== */}
        {/* // Preparado para white-label futuro: aquí se puede añadir logo y marca del cliente */}
        <header className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">Informe SEO</h1>
          <p className="text-xl font-medium text-primary">{report.domain}</p>
          <p className="text-sm text-base-content/60">
            Generado el {fmtDate(report.generatedAt)}
          </p>
        </header>

        {/* ===== PUNTUACIÓN GLOBAL ===== */}
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body items-center text-center gap-4">
            <div
              className={`w-32 h-32 rounded-full border-8 ${scoreRingClass(scores.global.color)} flex items-center justify-center`}
            >
              <span
                className={`text-5xl font-bold ${scoreTextClass(scores.global.color)}`}
              >
                {scores.global.score}
              </span>
            </div>
            <p className="text-sm text-base-content/50 -mt-2">de 100</p>
            <p className="text-base text-base-content/80 max-w-md">
              {scores.global.summary}
            </p>
          </div>
        </div>

        {/* ===== 1. VISIBILIDAD EN GOOGLE ===== */}
        <SectionCard
          icon={<Globe className="w-5 h-5" />}
          title="Visibilidad en Google"
          score={scores.visibility}
        >
          <div className="flex flex-wrap gap-4 mb-3">
            <Stat
              label="Palabras clave posicionadas"
              value={fmt(report.visibility.organicKeywords)}
            />
            <Stat
              label="Visitas estimadas/mes"
              value={fmt(report.visibility.organicTraffic)}
            />
          </div>
          {report.visibility.topKeywords.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-base-content/50 uppercase mb-2">
                Tus mejores palabras clave
              </p>
              <ul className="space-y-1">
                {report.visibility.topKeywords.slice(0, 5).map((kw) => (
                  <li
                    key={kw.keyword}
                    className="flex justify-between text-sm border-b border-base-200 py-1"
                  >
                    <span className="truncate mr-2">{kw.keyword}</span>
                    <span className="badge badge-sm badge-ghost whitespace-nowrap">
                      Posición {kw.position ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SectionCard>

        {/* ===== 2. OPORTUNIDADES ===== */}
        <SectionCard
          icon={<TrendingUp className="w-5 h-5" />}
          title="Oportunidades de mejora"
          score={scores.opportunities}
        >
          <p className="text-sm text-base-content/70 mb-3">
            <strong>{fmt(report.opportunities.totalOpportunities)}</strong>{" "}
            oportunidades detectadas
          </p>
          {report.opportunities.results.length > 0 && (
            <ul className="space-y-1">
              {report.opportunities.results.slice(0, 5).map((opp) => (
                <li
                  key={opp.keyword}
                  className="text-sm border-b border-base-200 py-1"
                >
                  <span className="font-medium">{opp.keyword}</span>
                  <span className="text-base-content/50">
                    {" "}
                    — posición {opp.position ?? "—"}, potencial de mejora
                  </span>
                </li>
              ))}
            </ul>
          )}
          {report.opportunities.cannibalization.length > 0 && (
            <p className="text-sm text-warning mt-3 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              {report.opportunities.cannibalization.length} caso(s) de
              canibalización detectados
            </p>
          )}
        </SectionCard>

        {/* ===== 3. COMPETENCIA ===== */}
        <SectionCard
          icon={<Users className="w-5 h-5" />}
          title="Tu competencia"
          score={scores.competitors}
          className="print-break"
        >
          {report.competitors.mainCompetitor && (
            <p className="text-sm text-base-content/70 mb-3">
              Tu principal competidor es{" "}
              <strong>{report.competitors.mainCompetitor}</strong>
            </p>
          )}
          <div className="grid gap-2">
            {report.competitors.competitors.slice(0, 3).map((comp) => (
              <div
                key={comp.domain}
                className="flex items-center justify-between bg-base-200 rounded-lg px-3 py-2"
              >
                <span className="text-sm font-medium truncate mr-2">
                  {comp.domain}
                </span>
                <span className="text-xs text-base-content/50 whitespace-nowrap">
                  {fmt(comp.organicTraffic)} visitas/mes
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ===== 4. KEYWORDS QUE TE FALTAN ===== */}
        <SectionCard
          icon={<Search className="w-5 h-5" />}
          title="Keywords que te faltan"
          score={scores.contentGap}
        >
          {report.contentGap.totalCount > 0 ? (
            <>
              <p className="text-sm text-base-content/70 mb-3">
                Tu competidor posiciona en{" "}
                <strong>{fmt(report.contentGap.totalCount)}</strong> palabras
                clave donde tú no apareces
              </p>
              <ul className="space-y-1">
                {report.contentGap.keywords.slice(0, 5).map((kw) => (
                  <li
                    key={kw.keyword}
                    className="flex justify-between text-sm border-b border-base-200 py-1"
                  >
                    <span className="truncate mr-2">{kw.keyword}</span>
                    <span className="badge badge-sm badge-ghost whitespace-nowrap">
                      {fmt(kw.searchVolume)} búsquedas/mes
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-base-content/50">
              No se encontraron diferencias significativas.
            </p>
          )}
        </SectionCard>

        {/* ===== 5. PRESENCIA LOCAL (solo si hay datos) ===== */}
        {report.local && (
          <SectionCard
            icon={<MapPin className="w-5 h-5" />}
            title="Presencia local"
            score={scores.local}
            className="print-break"
          >
            <div className="flex flex-wrap gap-4 mb-3">
              <Stat
                label="Posición en Google Maps"
                value={
                  report.local.ourPosition
                    ? `#${report.local.ourPosition}`
                    : "No apareces"
                }
              />
              {report.local.ourRating != null && (
                <Stat
                  label="Valoración"
                  value={`${report.local.ourRating} / 5`}
                />
              )}
              {report.local.ourReviewCount != null && (
                <Stat
                  label="Reseñas"
                  value={fmt(report.local.ourReviewCount)}
                />
              )}
            </div>
            {report.local.localPackResults.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-base-content/50 uppercase mb-2">
                  Competidores en el Local Pack
                </p>
                <div className="grid gap-2">
                  {report.local.localPackResults.slice(0, 3).map((r, i) => (
                    <div
                      key={`${r.title}-${i}`}
                      className="flex items-center justify-between bg-base-200 rounded-lg px-3 py-2"
                    >
                      <span className="text-sm truncate mr-2">
                        #{r.position} {r.title}
                      </span>
                      <span className="text-xs text-base-content/50 whitespace-nowrap">
                        {r.rating ? `${r.rating} ★` : "—"} ({fmt(r.reviewCount)}{" "}
                        reseñas)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        )}

        {/* ===== 6. SALUD TÉCNICA ===== */}
        <SectionCard
          icon={<ClipboardCheck className="w-5 h-5" />}
          title="Salud técnica"
          score={scores.technical}
        >
          <div className="flex flex-wrap gap-4 mb-3">
            <Stat
              label="Problemas críticos"
              value={String(report.technical.criticalCount)}
              highlight={
                report.technical.criticalCount > 0 ? "error" : undefined
              }
            />
            <Stat
              label="Avisos"
              value={String(report.technical.warningCount)}
              highlight={
                report.technical.warningCount > 0 ? "warning" : undefined
              }
            />
            <Stat
              label="Páginas analizadas"
              value={String(report.technical.pagesCrawled)}
            />
          </div>
          {report.technical.issues.filter((i) => i.severity === "critical")
            .length > 0 && (
            <div>
              <p className="text-xs font-semibold text-base-content/50 uppercase mb-2">
                Problemas críticos encontrados
              </p>
              <ul className="space-y-1">
                {report.technical.issues
                  .filter((i) => i.severity === "critical")
                  .slice(0, 5)
                  .map((issue, idx) => (
                    <li
                      key={`${issue.type}-${idx}`}
                      className="text-sm text-error flex items-start gap-1 py-1"
                    >
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{issue.description}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </SectionCard>

        {/* ===== 7. FICHA DE GOOGLE (solo si hay datos GBP) ===== */}
        {report.gbp && scores.gbp && (
          <SectionCard
            icon={<Languages className="w-5 h-5" />}
            title="Tu ficha de Google"
            score={scores.gbp}
            className="print-break"
          >
            {report.gbp.hasProblematicVariants ? (
              <>
                <p className="text-sm text-base-content/70 mb-2">
                  Se han detectado <strong>{report.gbp.variants.length}</strong>{" "}
                  variante(s) del nombre de tu negocio en distintos idiomas.
                </p>
                <ul className="space-y-1">
                  {report.gbp.variants.slice(0, 5).map((v, i) => (
                    <li
                      key={`${v.name}-${i}`}
                      className="text-sm border-b border-base-200 py-1"
                    >
                      <span className="font-medium">{v.name}</span>
                      <span className="text-base-content/50 text-xs ml-2">
                        ({v.languages.map((l) => l.name).join(", ")})
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-success">
                Sin problemas detectados en tu ficha de Google.
              </p>
            )}
          </SectionCard>
        )}

        {/* ===== FOOTER ===== */}
        <footer className="text-center space-y-4 pt-4 pb-8">
          <p className="text-xs text-base-content/40">
            Informe generado automáticamente
          </p>
          {/* // Preparado para white-label futuro */}
          <button
            type="button"
            className="btn btn-outline btn-sm gap-2 no-print"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4" />
            Imprimir / Guardar PDF
          </button>
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componentes auxiliares
// ---------------------------------------------------------------------------

/** Tarjeta de sección con icono, título y puntuación */
function SectionCard({
  icon,
  title,
  score,
  className,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  score: SectionScore;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`card bg-base-100 border border-base-300 ${className ?? ""}`}
    >
      <div className="card-body gap-3">
        {/* Cabecera: icono + título + badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-primary">{icon}</span>
            <h2 className="card-title text-base">{title}</h2>
          </div>
          <div
            className={`badge ${scoreBadgeClass(score.color)} badge-lg font-bold gap-0`}
          >
            {score.score}
          </div>
        </div>
        {/* Resumen de la sección */}
        <p className="text-sm text-base-content/70">{score.summary}</p>
        {/* Contenido detallado */}
        {children}
      </div>
    </div>
  );
}

/** Mini-estadística con label y valor destacado */
function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "error" | "warning";
}) {
  const valueClass = highlight
    ? highlight === "error"
      ? "text-error"
      : "text-warning"
    : "text-base-content";

  return (
    <div>
      <p className="text-xs text-base-content/50">{label}</p>
      <p className={`text-lg font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}
