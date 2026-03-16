import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import {
  FileBarChart,
  Search,
  ChevronDown,
  ChevronUp,
  FileDown,
  Trash2,
  Link2,
  Link2Off,
  Printer,
  Copy,
  Globe,
  Target,
  Users,
  TrendingUp,
  Wrench,
  MapPin,
  Store,
  Save,
} from "lucide-react";
import {
  generateReport,
  getReport,
  getReports,
  deleteReport,
  generatePublicLink,
  disablePublicLink,
} from "@/serverFunctions/report";
import type { SeoReport, SectionScore } from "@/types/report";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  LOCATIONS,
  getLanguageCode,
  formatNumber,
} from "@/client/features/keywords/utils";
import { buildCsv, downloadCsv } from "@/client/lib/csv";

export const Route = createFileRoute("/p/$projectId/report")({
  component: ReportPage,
});

function getScoreColorClass(color: string): string {
  if (color === "green") return "badge-success";
  if (color === "yellow") return "badge-warning";
  if (color === "red") return "badge-error";
  return "badge-ghost";
}

function getSeverityClass(severity: string): string {
  if (severity === "critical") return "badge-error";
  if (severity === "warning") return "badge-warning";
  return "badge-info";
}

type ReportSummary = { id: string; domain: string; score: number; generatedAt: string };

function ReportPage() {
  const { projectId } = Route.useParams();
  const [domain, setDomain] = useState("");
  const [keyword, setKeyword] = useState("");
  const [gbp, setGbp] = useState("");
  const [locationCode, setLocationCode] = useState(2724);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [report, setReport] = useState<SeoReport | null>(null);
  const [savedReports, setSavedReports] = useState<ReportSummary[]>([]);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    try {
      const result = await getReports({ data: { projectId } });
      setSavedReports(result.reports);
    } catch { /* silencioso */ }
  }, [projectId]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const reportMutation = useMutation({
    mutationFn: () =>
      generateReport({
        data: {
          projectId,
          domain: domain.trim(),
          keyword: keyword.trim() || null,
          gbpInput: gbp.trim() || null,
          locationCode,
          languageCode: getLanguageCode(locationCode),
        },
      }),
    onSuccess: (data) => {
      setReport(data);
      setPublicUrl(data.publicId ? `${window.location.origin}/report/${data.publicId}` : null);
      toast.success("Informe generado");
      loadReports();
    },
    onError: (err) => toast.error(getStandardErrorMessage(err, "Error generando informe")),
  });

  const deleteMutation = useMutation({
    mutationFn: (reportId: string) => deleteReport({ data: { projectId, reportId } }),
    onSuccess: () => { toast.success("Informe eliminado"); loadReports(); },
  });

  const publicLinkMutation = useMutation({
    mutationFn: () => generatePublicLink({ data: { projectId, reportId: report!.id } }),
    onSuccess: (data) => {
      const url = `${window.location.origin}/report/${data.publicId}`;
      setPublicUrl(url);
      toast.success("Enlace público generado");
    },
  });

  const disableLinkMutation = useMutation({
    mutationFn: () => disablePublicLink({ data: { projectId, reportId: report!.id } }),
    onSuccess: () => {
      setPublicUrl(null);
      if (report) setReport({ ...report, publicId: null });
      toast.success("Enlace desactivado");
    },
  });

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) { toast.error("Introduce un dominio"); return; }
    setReport(null);
    setPublicUrl(null);
    setExpandedSection(null);
    reportMutation.mutate();
  };

  const handleLoadReport = async (reportId: string) => {
    try {
      const result = await getReport({ data: { projectId, reportId } });
      if (result) {
        setReport(result);
        setDomain(result.domain);
        setPublicUrl(result.publicId ? `${window.location.origin}/report/${result.publicId}` : null);
      }
    } catch (err) {
      toast.error(getStandardErrorMessage(err, "Error cargando informe"));
    }
  };

  const handleExportCsv = () => {
    if (!report) return;
    const headers = ["Sección", "Dato", "Valor"];
    const rows: (string | number | null)[][] = [];
    for (const kw of report.visibility.topKeywords.slice(0, 50)) {
      rows.push(["Visibilidad", kw.keyword, `Pos ${kw.position} | Vol ${kw.searchVolume} | Tráf ${kw.traffic}`]);
    }
    for (const opp of report.opportunities.results.slice(0, 30)) {
      rows.push(["Oportunidades", opp.keyword, `Pos ${opp.position} | Score ${opp.score}`]);
    }
    for (const comp of report.competitors.competitors) {
      rows.push(["Competencia", comp.domain, `KWs ${comp.organicKeywords} | Tráf ${comp.organicTraffic}`]);
    }
    for (const kw of report.contentGap.keywords.slice(0, 30)) {
      rows.push(["Content Gap", kw.keyword, `Vol ${kw.searchVolume} | Pos comp ${kw.competitorRank}`]);
    }
    for (const issue of report.technical.issues) {
      rows.push(["Técnico", issue.description, `${issue.severity} | ${issue.page}`]);
    }
    downloadCsv(`informe-seo-${report.domain.replace(/\./g, "-")}.csv`, buildCsv(headers, rows));
  };

  const toggle = (s: string) => setExpandedSection(expandedSection === s ? null : s);

  const sections: Array<{
    key: string;
    name: string;
    icon: React.ReactNode;
    score: SectionScore | null;
    summary: string;
    render: () => React.ReactNode;
    show: boolean;
  }> = report ? [
    {
      key: "visibility", name: "Visibilidad", icon: <Globe className="size-4" />,
      score: report.scores.visibility,
      summary: `${formatNumber(report.visibility.organicTraffic)} tráfico · ${formatNumber(report.visibility.organicKeywords)} keywords`,
      show: true,
      render: () => (
        <div className="overflow-x-auto">
          <table className="table table-xs w-full">
            <thead><tr className="text-xs text-base-content/60"><th>Keyword</th><th className="text-right">Pos</th><th className="text-right">Vol</th><th className="text-right">Tráfico</th><th>URL</th></tr></thead>
            <tbody>
              {report.visibility.topKeywords.slice(0, 50).map((kw, i) => (
                <tr key={i} className="hover:bg-base-200/30">
                  <td className="max-w-[200px] truncate">{kw.keyword}</td>
                  <td className="text-right tabular-nums">{kw.position ?? "—"}</td>
                  <td className="text-right tabular-nums">{formatNumber(kw.searchVolume)}</td>
                  <td className="text-right tabular-nums">{formatNumber(kw.traffic)}</td>
                  <td className="max-w-[150px] truncate text-xs text-base-content/50">{kw.url ? new URL(kw.url).pathname : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
    {
      key: "opportunities", name: "Oportunidades", icon: <Target className="size-4" />,
      score: report.scores.opportunities,
      summary: `${report.opportunities.totalOpportunities} oportunidades · ${report.opportunities.cannibalization.length} canibalizaciones`,
      show: true,
      render: () => (
        <div className="overflow-x-auto">
          <table className="table table-xs w-full">
            <thead><tr className="text-xs text-base-content/60"><th>Keyword</th><th className="text-right">Pos</th><th className="text-right">Score</th><th>Tipo</th></tr></thead>
            <tbody>
              {report.opportunities.results.slice(0, 30).map((opp, i) => (
                <tr key={i} className="hover:bg-base-200/30">
                  <td className="max-w-[200px] truncate">{opp.keyword}</td>
                  <td className="text-right tabular-nums">{opp.position ?? "—"}</td>
                  <td className="text-right tabular-nums">{opp.score}</td>
                  <td><div className="flex gap-0.5">{opp.opportunityType.map((t) => <span key={t} className="badge badge-xs badge-ghost">{t}</span>)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
    {
      key: "competitors", name: "Competencia", icon: <Users className="size-4" />,
      score: report.scores.competitors,
      summary: `${report.competitors.competitors.length} competidores detectados`,
      show: true,
      render: () => (
        <div className="overflow-x-auto">
          <table className="table table-xs w-full">
            <thead><tr className="text-xs text-base-content/60"><th>Dominio</th><th className="text-right">Keywords</th><th className="text-right">Tráfico</th><th className="text-right">Comunes</th><th className="text-right">Pos. media</th></tr></thead>
            <tbody>
              {report.competitors.competitors.map((c, i) => (
                <tr key={i} className="hover:bg-base-200/30">
                  <td className="font-medium">{c.domain}</td>
                  <td className="text-right tabular-nums">{formatNumber(c.organicKeywords)}</td>
                  <td className="text-right tabular-nums">{formatNumber(c.organicTraffic)}</td>
                  <td className="text-right tabular-nums">{formatNumber(c.commonKeywords)}</td>
                  <td className="text-right tabular-nums">{c.avgPosition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
    {
      key: "contentGap", name: "Content Gap", icon: <TrendingUp className="size-4" />,
      score: report.scores.contentGap,
      summary: `${report.contentGap.totalCount} keywords donde la competencia rankea y tú no`,
      show: true,
      render: () => (
        <div className="overflow-x-auto">
          <table className="table table-xs w-full">
            <thead><tr className="text-xs text-base-content/60"><th>Keyword</th><th className="text-right">Volumen</th><th className="text-right">KD</th><th className="text-right">Pos. competidor</th></tr></thead>
            <tbody>
              {report.contentGap.keywords.slice(0, 30).map((kw, i) => (
                <tr key={i} className="hover:bg-base-200/30">
                  <td className="max-w-[200px] truncate">{kw.keyword}</td>
                  <td className="text-right tabular-nums">{formatNumber(kw.searchVolume)}</td>
                  <td className="text-right tabular-nums">{kw.keywordDifficulty ?? "—"}</td>
                  <td className="text-right tabular-nums">{kw.competitorRank ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
    {
      key: "local", name: "SEO Local", icon: <MapPin className="size-4" />,
      score: report.scores.local,
      summary: report.local ? `Posición: ${report.local.ourPosition ?? "No aparece"} · ${report.local.localKeywords.length} keywords locales` : "No analizado",
      show: report.local != null,
      render: () => report.local ? (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="table table-xs w-full">
              <thead><tr className="text-xs text-base-content/60"><th>Pos</th><th>Negocio</th><th className="text-right">Rating</th><th className="text-right">Reseñas</th></tr></thead>
              <tbody>
                {report.local!.localPackResults.map((r, i) => (
                  <tr key={i} className={`hover:bg-base-200/30 ${r.position === report.local!.ourPosition ? "bg-primary/10 font-semibold" : ""}`}>
                    <td className="tabular-nums">{r.position}</td>
                    <td className="max-w-[250px] truncate">{r.title}</td>
                    <td className="text-right tabular-nums">{r.rating ?? "—"}</td>
                    <td className="text-right tabular-nums">{r.reviewCount ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {report.local!.localKeywords.length > 0 && (
            <>
              <h4 className="text-xs font-semibold text-base-content/60">Keywords locales</h4>
              <div className="overflow-x-auto">
                <table className="table table-xs w-full">
                  <thead><tr className="text-xs text-base-content/60"><th>Keyword</th><th className="text-right">Volumen</th><th className="text-right">KD</th></tr></thead>
                  <tbody>
                    {report.local!.localKeywords.map((kw, i) => (
                      <tr key={i} className="hover:bg-base-200/30">
                        <td>{kw.keyword}</td>
                        <td className="text-right tabular-nums">{formatNumber(kw.searchVolume)}</td>
                        <td className="text-right tabular-nums">{kw.keywordDifficulty ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : null,
    },
    {
      key: "technical", name: "Salud Técnica", icon: <Wrench className="size-4" />,
      score: report.scores.technical,
      summary: `${report.technical.pagesCrawled} páginas · ${report.technical.criticalCount} críticos · ${report.technical.warningCount} avisos`,
      show: true,
      render: () => (
        <div className="space-y-1">
          {["critical", "warning", "info"].map((sev) => {
            const items = report.technical.issues.filter((i) => i.severity === sev);
            if (!items.length) return null;
            return items.map((issue, i) => (
              <div key={`${sev}-${i}`} className="flex items-start gap-2 py-1 px-2 rounded hover:bg-base-200/30">
                <span className={`badge badge-xs ${getSeverityClass(sev)} mt-0.5`}>{sev}</span>
                <span className="text-xs text-base-content/50">{issue.page}</span>
                <span className="text-sm">{issue.description}</span>
              </div>
            ));
          })}
        </div>
      ),
    },
    {
      key: "gbp", name: "Ficha Google", icon: <Store className="size-4" />,
      score: report.scores.gbp,
      summary: report.gbp ? `${report.gbp.variants.length} variantes detectadas` : "No analizado",
      show: report.gbp != null,
      render: () => report.gbp ? (
        <div className="overflow-x-auto">
          <table className="table table-xs w-full">
            <thead><tr className="text-xs text-base-content/60"><th>Variante</th><th>Idiomas</th></tr></thead>
            <tbody>
              {report.gbp!.variants.map((v, i) => (
                <tr key={i} className="hover:bg-base-200/30">
                  <td>{v.name}</td>
                  <td><div className="flex gap-1 flex-wrap">{v.languages.map((l) => <span key={l.code} className="badge badge-xs badge-ghost">{l.name}</span>)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null,
    },
  ] : [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-4 md:px-6 pt-4 pb-2 max-w-8xl mx-auto w-full">
        <h1 className="text-xl font-bold mb-1">Informe SEO</h1>
        <p className="text-sm text-base-content/60 mb-3">
          Genera un informe completo: visibilidad, oportunidades, competencia, salud técnica y presencia local.
        </p>
        <form className="bg-base-100 border border-base-300 rounded-xl px-4 py-3 flex flex-wrap items-center gap-2" onSubmit={handleGenerate}>
          <label className="input input-bordered input-sm flex items-center gap-2 flex-1 min-w-0 max-w-xs">
            <Search className="size-3.5 shrink-0 text-base-content/50" />
            <input className="grow min-w-0" placeholder="Dominio (ej: ejemplo.com)" value={domain} onChange={(e) => setDomain(e.target.value)} required />
          </label>
          <input className="input input-bordered input-sm w-auto max-w-[200px]" placeholder="Keyword principal" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <input className="input input-bordered input-sm w-auto max-w-[240px]" placeholder="Ficha Google (nombre o URL)" value={gbp} onChange={(e) => setGbp(e.target.value)} />
          <select className="select select-bordered select-sm w-auto" value={locationCode} onChange={(e) => setLocationCode(Number(e.target.value))}>
            {Object.entries(LOCATIONS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
          <button type="submit" className="btn btn-primary btn-sm px-6 font-semibold" disabled={reportMutation.isPending}>
            {reportMutation.isPending ? "Generando..." : "Generar Informe"}
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
        <div className="mx-auto w-full max-w-8xl">
          {reportMutation.isPending ? (
            <div className="mt-8 text-center space-y-4">
              <div className="loading loading-spinner loading-lg" />
              <p className="text-sm text-base-content/60 animate-pulse">Analizando {domain}... Esto puede tardar 15-30 segundos.</p>
            </div>
          ) : reportMutation.isError ? (
            <div className="mt-4 rounded-xl border border-error/30 bg-error/10 p-5 text-error">
              <p className="text-sm">{getStandardErrorMessage(reportMutation.error, "Error generando informe")}</p>
              <button className="btn btn-sm mt-2" onClick={() => reportMutation.reset()}>Reintentar</button>
            </div>
          ) : report ? (
            <div className="mt-4 space-y-4">
              {/* Score global */}
              <div className="border border-base-300 rounded-xl bg-base-100 p-5">
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="flex flex-col items-center">
                    <span className={`text-4xl font-bold badge ${getScoreColorClass(report.scores.global.color)} badge-lg p-4`}>
                      {report.scores.global.score}
                    </span>
                    <span className="text-xs text-base-content/50 mt-1">Score Global</span>
                  </div>
                  <p className="text-sm text-base-content/70 flex-1">{report.scores.global.summary}</p>
                  <div className="flex gap-3 flex-wrap">
                    {sections.filter((s) => s.show && s.score).map((s) => (
                      <div key={s.key} className="flex flex-col items-center">
                        <span className={`badge ${getScoreColorClass(s.score!.color)} badge-sm`}>{s.score!.score}</span>
                        <span className="text-[10px] text-base-content/50 mt-0.5">{s.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Secciones */}
              {sections.filter((s) => s.show).map((s) => (
                <div key={s.key} className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
                  <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-base-200/50 text-left" onClick={() => toggle(s.key)}>
                    <div className="flex items-center gap-3">
                      <span className="text-base-content/50">{s.icon}</span>
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                          {s.name}
                          {s.score && <span className={`badge badge-xs ${getScoreColorClass(s.score.color)}`}>{s.score.score}</span>}
                        </div>
                        <p className="text-xs text-base-content/50 mt-0.5">{s.summary}</p>
                      </div>
                    </div>
                    {expandedSection === s.key ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </button>
                  {expandedSection === s.key && <div className="border-t border-base-200 p-4">{s.render()}</div>}
                </div>
              ))}

              {/* Acciones */}
              <div className="border border-base-300 rounded-xl bg-base-100 px-4 py-3 flex flex-wrap items-center gap-2">
                {!publicUrl ? (
                  <button className="btn btn-sm btn-outline gap-1" onClick={() => publicLinkMutation.mutate()} disabled={publicLinkMutation.isPending}>
                    <Link2 className="size-3.5" /> {publicLinkMutation.isPending ? "Generando..." : "Enlace para cliente"}
                  </button>
                ) : (
                  <>
                    <div className="flex items-center gap-1 bg-base-200 rounded-lg px-3 py-1.5 text-sm">
                      <span className="truncate max-w-[240px]">{publicUrl}</span>
                      <button className="btn btn-ghost btn-xs" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("URL copiada"); }}>
                        <Copy className="size-3" />
                      </button>
                    </div>
                    <button className="btn btn-sm btn-ghost text-error gap-1" onClick={() => disableLinkMutation.mutate()} disabled={disableLinkMutation.isPending}>
                      <Link2Off className="size-3.5" /> Desactivar
                    </button>
                  </>
                )}
                <button className="btn btn-ghost btn-sm gap-1" onClick={handleExportCsv}><FileDown className="size-3.5" /> CSV</button>
                <button className="btn btn-ghost btn-sm gap-1" onClick={() => window.print()}><Printer className="size-3.5" /> Imprimir</button>
              </div>
            </div>
          ) : (
            <div className="mt-8 text-center space-y-3">
              <FileBarChart className="size-12 mx-auto text-base-content/30" />
              <p className="text-lg font-medium text-base-content/70">Genera un informe SEO completo</p>
              <p className="text-sm text-base-content/50 max-w-md mx-auto">Introduce un dominio para analizar visibilidad, oportunidades, competencia, salud técnica y más.</p>
            </div>
          )}

          {/* Informes guardados */}
          {savedReports.length > 0 && (
            <div className="mt-6">
              <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Save className="size-4 text-primary" /> Informes guardados ({savedReports.length})
              </h2>
              <div className="space-y-2">
                {savedReports.map((s) => (
                  <div key={s.id} className="border border-base-300 rounded-lg bg-base-100 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-base-200/30" onClick={() => handleLoadReport(s.id)}>
                    <div>
                      <span className="font-medium text-sm">{s.domain}</span>
                      <span className={`badge badge-xs ${s.score >= 70 ? "badge-success" : s.score >= 40 ? "badge-warning" : "badge-error"} ml-2`}>{s.score}</span>
                      <span className="text-xs text-base-content/40 ml-2">{new Date(s.generatedAt).toLocaleDateString("es-ES")}</span>
                    </div>
                    <button className="btn btn-ghost btn-xs text-error" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(s.id); }} disabled={deleteMutation.isPending}>
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
