import { createFileRoute, redirect } from "@tanstack/react-router";
import { KeywordResearchPage } from "@/client/features/keywords/page/KeywordResearchPage";
import {
  isResultLimit,
  normalizeKeywordMode,
  normalizeLegacyKeywordSearch,
  normalizeSortDir,
  normalizeSortField,
} from "@/client/features/keywords/keywordSearchParams";
import { keywordsSearchSchema } from "@/types/schemas/keywords";
import { useProjectContext } from "@/client/hooks/useProjectContext";

export const Route = createFileRoute("/p/$projectId/keywords")({
  validateSearch: keywordsSearchSchema,
  beforeLoad: ({ params, search }) => {
    const { normalized, changed } = normalizeLegacyKeywordSearch(search);
    if (!changed) return;

    throw redirect({
      to: "/p/$projectId/keywords",
      params: { projectId: params.projectId },
      search: normalized,
      replace: true,
    });
  },
  component: KeywordResearchPageRoute,
});

function KeywordResearchPageRoute() {
  const { projectId } = Route.useParams();
  const {
    q: keywordInput,
    loc: locationCode,
    kLimit: resultLimit = 150,
    mode: keywordMode = "auto",
    sort: sortField = "searchVolume",
    order: sortDir = "desc",
  } = Route.useSearch();

  // Contexto del proyecto: si la URL no trae q/loc, usamos los del proyecto
  // como defaults. El usuario sigue pudiendo sobrescribir desde el form.
  const { project, locationCode: projectLocationCode } =
    useProjectContext(projectId);

  const effectiveKeyword = keywordInput ?? project?.targetKeyword ?? "";
  // Default 2724 = España (mercado principal del producto).
  const effectiveLocationCode = locationCode ?? projectLocationCode ?? 2724;

  return (
    <KeywordResearchPage
      projectId={projectId}
      keywordInput={effectiveKeyword}
      locationCode={effectiveLocationCode}
      resultLimit={isResultLimit(resultLimit) ? resultLimit : 150}
      keywordMode={normalizeKeywordMode(keywordMode)}
      sortField={normalizeSortField(sortField)}
      sortDir={normalizeSortDir(sortDir)}
    />
  );
}
