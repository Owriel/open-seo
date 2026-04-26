import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DomainOverviewPage } from "@/client/features/domain/DomainOverviewPage";
import {
  resolveSortOrder,
  toSortMode,
  toSortOrder,
} from "@/client/features/domain/utils";
import { domainSearchSchema } from "@/types/schemas/domain";
import { useProjectContext } from "@/client/hooks/useProjectContext";

export const Route = createFileRoute("/p/$projectId/domain")({
  validateSearch: domainSearchSchema,
  component: DomainOverviewRoute,
});

function DomainOverviewRoute() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const {
    domain,
    subdomains = true,
    sort = "rank",
    order,
    tab = "keywords",
    search = "",
  } = Route.useSearch();

  // Contexto del proyecto: si no viene dominio en la URL, pre-rellenamos
  // con el del proyecto. El usuario puede sobrescribirlo desde el form.
  const { project } = useProjectContext(projectId);
  const effectiveDomain = domain ?? project?.domain ?? "";

  const normalizedSort = toSortMode(sort) ?? "rank";
  const normalizedOrder = resolveSortOrder(
    normalizedSort,
    toSortOrder(order ?? null),
  );

  return (
    <DomainOverviewPage
      projectId={projectId}
      navigate={navigate}
      searchState={{
        domain: effectiveDomain,
        subdomains,
        sort: normalizedSort,
        order: normalizedOrder,
        tab,
        search,
      }}
    />
  );
}
