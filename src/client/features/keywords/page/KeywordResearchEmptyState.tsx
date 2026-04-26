import { Clock, Globe, History, Search, X, Sparkles } from "lucide-react";
import { Link, useParams } from "@tanstack/react-router";
import { reverse } from "remeda";
import { LOCATIONS } from "@/client/features/keywords/utils";
import { useProjectContext } from "@/client/hooks/useProjectContext";
import type { KeywordResearchControllerState } from "./types";

type Props = {
  controller: KeywordResearchControllerState;
};

export function KeywordResearchEmptyState({ controller }: Props) {
  const { hasSearched, isLoading, lastSearchError } = controller;

  if (hasSearched && !isLoading && !lastSearchError) {
    return <NoResultsState controller={controller} />;
  }

  return <SearchHistoryState controller={controller} />;
}

function NoResultsState({ controller }: Props) {
  const {
    controlsForm,
    lastResultSource,
    lastSearchKeyword,
    lastSearchLocationCode,
    lastUsedFallback,
    onSearch,
  } = controller;

  return (
    <div className="flex-1 flex items-center justify-center px-4 md:px-6 py-6">
      <div className="w-full max-w-2xl rounded-2xl border border-base-300 bg-base-100 p-6 md:p-8 text-center space-y-4">
        <Globe className="size-10 mx-auto text-base-content/40" />
        <div className="space-y-2">
          <p className="text-lg font-semibold text-base-content">
            Todavía no hay suficientes datos de keywords para esta búsqueda
          </p>
          <p className="text-sm text-base-content/70">
            No hemos encontrado oportunidades de keywords para
            <span className="font-medium text-base-content">
              {` "${lastSearchKeyword}" `}
            </span>
            en
            <span className="font-medium text-base-content">
              {` ${LOCATIONS[lastSearchLocationCode] || "esta ubicación"}`}
            </span>
            .
          </p>
        </div>

        <div className="rounded-xl bg-base-200/70 px-4 py-3 text-left text-sm text-base-content/70 space-y-1">
          <p>
            Fuente consultada:{" "}
            <span className="font-medium">{lastResultSource}</span>
            {lastUsedFallback ? (
              <span>
                {" "}
                (con cadena de fallback: related - suggestions - ideas)
              </span>
            ) : null}
          </p>
          <p>
            Prueba una frase más amplia, cambia el orden de las palabras o la
            ubicación.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            className="btn btn-sm btn-outline"
            onClick={() => {
              const words = lastSearchKeyword.split(/\s+/).filter(Boolean);
              const reversedKeyword = reverse(words).join(" ");
              if (!reversedKeyword || reversedKeyword === lastSearchKeyword) {
                return;
              }
              controlsForm.setFieldValue("keyword", reversedKeyword);
              onSearch({
                keyword: reversedKeyword,
                locationCode: lastSearchLocationCode,
              });
            }}
            disabled={lastSearchKeyword.trim().split(/\s+/).length < 2}
          >
            Probar frase invertida
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => {
              const firstWord = lastSearchKeyword
                .split(/\s+/)
                .filter(Boolean)[0];
              if (!firstWord) return;
              controlsForm.setFieldValue("keyword", firstWord);
              onSearch({
                keyword: firstWord,
                locationCode: lastSearchLocationCode,
              });
            }}
          >
            Probar término más amplio
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchHistoryState({ controller }: Props) {
  const {
    clearHistory,
    controlsForm,
    history,
    historyLoaded,
    onSearch,
    removeHistoryItem,
  } = controller;
  // Contexto del proyecto para CTA específico (sustituye al empty genérico
  // cuando no hay historial de búsquedas previas).
  const { projectId } = useParams({ from: "/p/$projectId/keywords" });
  const { project } = useProjectContext(projectId);
  const projectKeyword = project?.targetKeyword?.trim() ?? "";
  const hasNoHistory = historyLoaded && history.length === 0;

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
      <div className="mx-auto w-full max-w-5xl space-y-6 pt-3 md:pt-5">
        {historyLoaded && history.length > 0 ? (
          <section className="rounded-2xl border border-base-300 bg-base-100 p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="size-4 text-base-content/45" />
                <span className="text-sm text-base-content/60">
                  {history.length === 1
                    ? "1 búsqueda reciente"
                    : `${history.length} búsquedas recientes`}
                </span>
              </div>
              <button
                className="btn btn-ghost btn-xs text-error"
                onClick={clearHistory}
              >
                Limpiar todo
              </button>
            </div>
            <div className="grid gap-2">
              {history.map((item) => (
                <div
                  key={item.timestamp}
                  className="flex items-center justify-between p-3 rounded-lg border border-base-300 bg-base-100 hover:bg-base-200 transition-colors text-left group cursor-pointer"
                  onClick={() => {
                    controlsForm.setFieldValue("keyword", item.keyword);
                    controlsForm.setFieldValue(
                      "locationCode",
                      item.locationCode,
                    );
                    onSearch({
                      keyword: item.keyword,
                      locationCode: item.locationCode,
                    });
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Clock className="size-4 text-base-content/40" />
                    <div>
                      <p className="font-medium text-base-content">
                        {item.keyword}
                      </p>
                      <p className="text-sm text-base-content/60">
                        {item.locationName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-base-content/40">
                      {new Date(item.timestamp).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <button
                      className="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 p-1"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeHistoryItem(item.timestamp);
                      }}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : hasNoHistory && projectKeyword ? (
          // CTA específico: el proyecto tiene targetKeyword configurada.
          // Al pulsar, autocompleta el form y lanza la búsqueda.
          <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center space-y-3">
            <Sparkles className="size-10 mx-auto text-primary" />
            <p className="text-lg font-semibold text-base-content">
              Investiga tu primera keyword
            </p>
            <p className="text-sm text-base-content/70 max-w-md mx-auto">
              Tu proyecto tiene configurada{" "}
              <span className="font-medium text-base-content">
                &ldquo;{projectKeyword}&rdquo;
              </span>
              . Dale un clic y te mostraremos volumen, dificultad, CPC y
              keywords relacionadas.
            </p>
            <button
              className="btn btn-sm btn-primary gap-1"
              onClick={() => {
                controlsForm.setFieldValue("keyword", projectKeyword);
                onSearch({ keyword: projectKeyword });
              }}
            >
              <Search className="size-3.5" />
              Buscar &ldquo;{projectKeyword}&rdquo;
            </button>
          </section>
        ) : hasNoHistory ? (
          // Sin historial y sin keyword configurada en el proyecto: invitamos
          // al usuario a configurarla en Settings.
          <section className="rounded-2xl border border-dashed border-base-300 bg-base-100/70 p-6 text-center text-base-content/60 space-y-3">
            <Search className="size-10 mx-auto opacity-40" />
            <p className="text-lg font-medium text-base-content/80">
              Introduce una keyword para empezar
            </p>
            <p className="text-sm max-w-md mx-auto">
              Busca cualquier keyword para ver volumen, dificultad, CPC e ideas
              de keywords relacionadas.
            </p>
            <div className="text-xs text-base-content/50 mt-2">
              Sugerencia: configura una keyword objetivo en{" "}
              <Link
                to="/p/$projectId/settings"
                params={{ projectId }}
                className="link link-primary"
              >
                ajustes del proyecto
              </Link>{" "}
              para auto-rellenar todos los módulos.
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-base-300 bg-base-100/70 p-6 text-center text-base-content/50 space-y-3">
            <Search className="size-10 mx-auto opacity-40" />
            <p className="text-lg font-medium text-base-content/80">
              Introduce una keyword para empezar
            </p>
            <p className="text-sm max-w-md mx-auto">
              Busca cualquier keyword para ver volumen, dificultad, CPC e ideas
              de keywords relacionadas.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
