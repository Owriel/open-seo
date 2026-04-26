import { Search } from "lucide-react";
import {
  isResultLimit,
  normalizeKeywordMode,
} from "@/client/features/keywords/keywordSearchParams";
import { RESULT_LIMITS } from "@/client/features/keywords/keywordResearchTypes";
import type { KeywordResearchControllerState } from "./types";

type Props = {
  controller: KeywordResearchControllerState;
};

// Lista de ubicaciones disponibles para el dropdown. España va primero
// porque es el mercado por defecto del producto.
const LOCATION_OPTIONS = [
  { code: 2724, label: "España" },
  { code: 2840, label: "Estados Unidos" },
  { code: 2826, label: "Reino Unido" },
  { code: 2276, label: "Alemania" },
  { code: 2250, label: "Francia" },
  { code: 2380, label: "Italia" },
  { code: 2036, label: "Australia" },
  { code: 2124, label: "Canadá" },
];

export function KeywordResearchSearchBar({ controller }: Props) {
  const { controlsForm, handleSearchSubmit, isLoading, searchInputError } =
    controller;

  return (
    <div className="shrink-0 px-4 md:px-6 pt-4 pb-2 max-w-8xl mx-auto w-full">
      <form
        className="bg-base-100 border border-base-300 rounded-xl px-4 py-3 flex flex-wrap items-center gap-2"
        onSubmit={handleSearchSubmit}
      >
        <label
          className={`input input-bordered input-sm flex items-center gap-2 flex-1 min-w-0 max-w-md ${searchInputError ? "input-error" : ""}`}
        >
          <Search className="size-3.5 shrink-0 text-base-content/50" />
          <controlsForm.Field name="keyword">
            {(field) => (
              <input
                className="grow min-w-0"
                placeholder="Introduce una keyword"
                value={field.state.value}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                  if (searchInputError) controller.setSearchInputError(null);
                }}
              />
            )}
          </controlsForm.Field>
        </label>

        <controlsForm.Field name="locationCode">
          {(field) => (
            <select
              className="select select-bordered select-sm w-auto"
              value={field.state.value}
              onChange={(event) =>
                field.handleChange(Number(event.target.value))
              }
            >
              {LOCATION_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </controlsForm.Field>

        <controlsForm.Field name="resultLimit">
          {(field) => (
            <select
              className="select select-bordered select-sm w-auto"
              value={field.state.value}
              onChange={(event) => {
                const next = Number(event.target.value);
                field.handleChange(isResultLimit(next) ? next : 150);
              }}
            >
              {RESULT_LIMITS.map((limit) => (
                <option key={limit} value={limit}>
                  {limit} resultados
                </option>
              ))}
            </select>
          )}
        </controlsForm.Field>

        <controlsForm.Field name="mode">
          {(field) => (
            <select
              className="select select-bordered select-sm w-auto"
              value={field.state.value}
              onChange={(event) =>
                field.handleChange(normalizeKeywordMode(event.target.value))
              }
            >
              <option value="auto">Automático</option>
              <option value="related">Keywords relacionadas</option>
              <option value="suggestions">Sugerencias</option>
              <option value="ideas">Ideas</option>
            </select>
          )}
        </controlsForm.Field>

        <button
          type="submit"
          className="btn btn-primary btn-sm px-6 font-semibold"
          disabled={isLoading}
        >
          {isLoading ? "Buscando..." : "Buscar"}
        </button>
      </form>
      {searchInputError ? (
        <p className="mt-2 text-sm text-error">{searchInputError}</p>
      ) : null}
    </div>
  );
}
