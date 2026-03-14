import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSavedKeywords,
  removeSavedKeyword,
} from "@/serverFunctions/keywords";
import { Trash2, Download, Search, Loader2, AlertCircle } from "lucide-react";
import { getStandardErrorMessage } from "@/client/lib/error-messages";

export const Route = createFileRoute("/p/$projectId/saved")({
  component: SavedKeywordsPage,
});

function SavedKeywordsPage() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { data: savedKeywordsData, isLoading } = useQuery({
    queryKey: ["savedKeywords", projectId],
    queryFn: () => getSavedKeywords({ data: { projectId } }),
  });
  const savedKeywords = savedKeywordsData?.rows ?? [];

  const removeMutation = useMutation({
    mutationFn: (savedKeywordId: string) =>
      removeSavedKeyword({ data: { savedKeywordId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["savedKeywords", projectId],
      });
      toast.success("Keyword eliminada");
    },
    onError: (error) => {
      setRemoveError(getStandardErrorMessage(error, "Error al eliminar."));
    },
  });

  const handleRemoveKeyword = (savedKeywordId: string) => {
    setRemoveError(null);
    setRemovingId(savedKeywordId);
    removeMutation.mutate(savedKeywordId, {
      onSettled: () => {
        setRemovingId((current) =>
          current === savedKeywordId ? null : current,
        );
      },
    });
  };

  const exportCsv = () => {
    if (savedKeywords.length === 0) {
      toast.error("No hay keywords para exportar");
      return;
    }

    const headers = [
      "Keyword",
      "Volume",
      "CPC",
      "Competition",
      "Difficulty",
      "Intent",
      "Location",
      "Fetched At",
    ];
    const csvRows = savedKeywords.map((kw) =>
      [
        csvEscape(kw.keyword),
        kw.searchVolume ?? "",
        kw.cpc?.toFixed(2) ?? "",
        kw.competition?.toFixed(2) ?? "",
        kw.keywordDifficulty ?? "",
        kw.intent ?? "",
        kw.locationCode ?? "",
        kw.fetchedAt ?? "",
      ].join(","),
    );
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "saved-keywords.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 pb-24 md:pb-8 overflow-auto">
      <div className="mx-auto max-w-5xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Keywords Guardadas</h1>
            <p className="text-sm text-base-content/70">
              Keywords que has guardado de tus investigaciones.
            </p>
          </div>
          {savedKeywords.length > 0 && (
            <button className="btn btn-sm" onClick={exportCsv}>
              <Download className="size-4" /> Exportar CSV
            </button>
          )}
        </div>

        {/* Keyword list */}
        {isLoading ? (
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body gap-3" aria-busy>
              <div className="skeleton h-4 w-48" />
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="grid grid-cols-8 gap-3 items-center"
                >
                  <div className="skeleton h-4 col-span-2" />
                  <div className="skeleton h-4" />
                  <div className="skeleton h-4" />
                  <div className="skeleton h-4" />
                  <div className="skeleton h-4" />
                  <div className="skeleton h-4" />
                  <div className="skeleton h-4" />
                </div>
              ))}
            </div>
          </div>
        ) : savedKeywords.length === 0 ? (
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body text-center py-12 text-base-content/50">
              <Search className="size-8 mx-auto mb-2 opacity-40" />
              <p>
                Aún no tienes keywords guardadas. Usa la sección de
                Investigación de Keywords para encontrar y guardar keywords.
              </p>
            </div>
          </div>
        ) : (
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body gap-3">
              {removeError ? (
                <div className="rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error flex items-start gap-2">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{removeError}</span>
                </div>
              ) : null}
              <p className="text-sm text-base-content/70">
                {savedKeywords.length} keyword
                {savedKeywords.length !== 1 ? "s guardadas" : " guardada"}
              </p>
              <div className="overflow-x-auto">
                <table className="table table-zebra table-sm">
                  <thead>
                    <tr>
                      <th>Keyword</th>
                      <th>Volumen</th>
                      <th>CPC</th>
                      <th>Competencia</th>
                      <th>Dificultad</th>
                      <th>Intención</th>
                      <th>Última consulta</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedKeywords.map((kw) => (
                      <tr key={kw.id}>
                        <td className="font-medium">{kw.keyword}</td>
                        <td>{formatNumber(kw.searchVolume)}</td>
                        <td>
                          {kw.cpc == null ? "-" : `$${kw.cpc.toFixed(2)}`}
                        </td>
                        <td>
                          {kw.competition == null
                            ? "-"
                            : kw.competition.toFixed(2)}
                        </td>
                        <td>
                          <DifficultyBadge value={kw.keywordDifficulty} />
                        </td>
                        <td>
                          <span className="badge badge-sm badge-ghost">
                            {kw.intent ?? "?"}
                          </span>
                        </td>
                        <td className="text-xs text-base-content/50">
                          {kw.fetchedAt
                            ? new Date(kw.fetchedAt).toLocaleDateString()
                            : "-"}
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost btn-xs text-error"
                            onClick={() => handleRemoveKeyword(kw.id)}
                            disabled={removingId === kw.id}
                            title="Eliminar"
                          >
                            {removingId === kw.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Trash2 className="size-3" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DifficultyBadge({ value }: { value: number | null }) {
  if (value == null)
    return <span className="badge badge-ghost badge-sm">-</span>;
  if (value < 30)
    return <span className="badge badge-success badge-sm">{value}</span>;
  if (value <= 60)
    return <span className="badge badge-warning badge-sm">{value}</span>;
  return <span className="badge badge-error badge-sm">{value}</span>;
}

function formatNumber(value: number | null | undefined) {
  if (value == null) return "-";
  return new Intl.NumberFormat().format(value);
}

function csvEscape(value: string | number | null | undefined): string {
  if (value == null) return "";
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}
