// Hook compartido que expone el "contexto" del proyecto (domain, targetKeyword,
// locationName, languageCode, placeId, businessName) a cualquier módulo para
// usarlo como defaults iniciales de sus formularios.
//
// Comparte queryKey ["project", projectId] con el ProjectLayout de
// routes/p/$projectId/route.tsx, así evitamos fetch duplicado: cuando entras
// en un módulo el proyecto YA está en caché gracias al layout padre.

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getProject } from "@/serverFunctions/keywords";

// Mapa locationName (valor guardado en la BBDD del proyecto) →
// location_code de DataForSEO. Si el usuario configura una location que no
// mapeamos, fallback 2724 (España, mercado principal).
const LOCATION_NAME_TO_CODE: Record<string, number> = {
  Spain: 2724,
  España: 2724,
  "United Kingdom": 2826,
  UK: 2826,
  Germany: 2276,
  Alemania: 2276,
  France: 2250,
  Francia: 2250,
  Italy: 2380,
  Italia: 2380,
  Australia: 2036,
};

export function locationNameToCode(
  locationName: string | null | undefined,
): number | null {
  if (!locationName) return null;
  const trimmed = locationName.trim();
  if (!trimmed) return null;
  // Algunas ubicaciones vienen como "Valencia,Valencia,Spain" (DataForSEO).
  // Intentamos match directo primero y si no, probamos la última parte
  // (que suele ser el país).
  const direct = LOCATION_NAME_TO_CODE[trimmed];
  if (direct != null) return direct;
  const tail = trimmed.split(",").pop()?.trim();
  if (tail && LOCATION_NAME_TO_CODE[tail] != null) {
    return LOCATION_NAME_TO_CODE[tail];
  }
  return null;
}

// Extrae el nombre de país de un locationName. Si viene como
// "Valencia,Valencia,Spain" devolvemos "Spain". Si ya es un país conocido,
// lo devolvemos tal cual. Null si no se reconoce.
export function extractCountryName(
  locationName: string | null | undefined,
): string | null {
  if (!locationName) return null;
  const trimmed = locationName.trim();
  if (!trimmed) return null;
  if (LOCATION_NAME_TO_CODE[trimmed] != null) return trimmed;
  const tail = trimmed.split(",").pop()?.trim();
  if (tail && LOCATION_NAME_TO_CODE[tail] != null) return tail;
  return null;
}

export type ProjectContext = {
  id: string;
  name: string;
  domain: string | null;
  targetKeyword: string | null;
  locationName: string | null;
  languageCode: string | null;
  placeId: string | null;
  businessName: string | null;
  createdAt: string;
};

export type ProjectContextResult = {
  project: ProjectContext | null;
  // Conveniencia: location_code derivado de locationName (si se pudo mapear).
  locationCode: number | null;
  isLoading: boolean;
  // Indica si el proyecto tiene "algo" de contexto útil para auto-rellenar.
  hasContext: boolean;
};

/**
 * Carga el proyecto actual y expone su contexto para pre-rellenar formularios.
 * Comparte queryKey con el layout padre, así que no genera fetch extra.
 */
export function useProjectContext(projectId: string): ProjectContextResult {
  const query = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject({ data: { projectId } }),
    enabled: !!projectId,
  });

  return useMemo(() => {
    const project = (query.data ?? null) as ProjectContext | null;
    const locationCode = locationNameToCode(project?.locationName);
    const hasContext = Boolean(
      project &&
      (project.domain ||
        project.targetKeyword ||
        project.businessName ||
        project.placeId ||
        project.locationName),
    );
    return {
      project,
      locationCode,
      isLoading: query.isLoading,
      hasContext,
    };
  }, [query.data, query.isLoading]);
}
