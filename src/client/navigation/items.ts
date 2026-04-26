import {
  BarChart3,
  Bookmark,
  Bot,
  ClipboardCheck,
  Database,
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
  Star,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

// Estructura agrupada: 6 categorias para los 18 items.
// Declaramos el valor como "as const" para preservar los literales de `to`
// exigidos por TanStack Router. Los tipos NavItem / NavCategory se derivan
// despues del literal para mantener compatibilidad de consumo.
export const projectNavCategories = [
  {
    id: "research",
    label: "Investigación",
    items: [
      {
        to: "/p/$projectId/keywords" as const,
        label: "Keywords",
        icon: Search,
        matchSegment: "/keywords",
      },
      {
        to: "/p/$projectId/saved" as const,
        label: "Guardadas",
        icon: Bookmark,
        matchSegment: "/saved",
      },
      {
        to: "/p/$projectId/clusters" as const,
        label: "Clusters",
        icon: Network,
        matchSegment: "/clusters",
      },
      {
        to: "/p/$projectId/serp" as const,
        label: "SERP",
        icon: BarChart3,
        matchSegment: "/serp",
      },
    ],
  },
  {
    id: "domain",
    label: "Dominio",
    items: [
      {
        to: "/p/$projectId/domain" as const,
        label: "Dominio",
        icon: Globe,
        matchSegment: "/domain",
      },
      {
        to: "/p/$projectId/competitors" as const,
        label: "Competencia",
        icon: Users,
        matchSegment: "/competitors",
      },
      {
        to: "/p/$projectId/backlinks" as const,
        label: "Backlinks",
        icon: Link2,
        matchSegment: "/backlinks",
      },
      {
        to: "/p/$projectId/tracker" as const,
        label: "Posiciones",
        icon: TrendingUp,
        matchSegment: "/tracker",
      },
      {
        to: "/p/$projectId/opportunities" as const,
        label: "Oportunidades",
        icon: Target,
        matchSegment: "/opportunities",
      },
    ],
  },
  {
    id: "local",
    label: "Local",
    items: [
      {
        to: "/p/$projectId/local" as const,
        label: "SEO Local",
        icon: MapPin,
        matchSegment: "/local",
      },
      {
        to: "/p/$projectId/local-grid" as const,
        label: "Geo-Grid",
        icon: Grid3x3,
        matchSegment: "/local-grid",
      },
      {
        to: "/p/$projectId/reviews" as const,
        label: "Reseñas",
        icon: Star,
        matchSegment: "/reviews",
      },
      {
        to: "/p/$projectId/multilang" as const,
        label: "Multiidioma",
        icon: Languages,
        matchSegment: "/multilang",
      },
    ],
  },
  {
    id: "technical",
    label: "Técnico",
    items: [
      {
        to: "/p/$projectId/audit" as const,
        label: "Auditoría",
        icon: ClipboardCheck,
        matchSegment: "/audit",
      },
    ],
  },
  {
    id: "deliverables",
    label: "Entregables",
    items: [
      {
        to: "/p/$projectId/report" as const,
        label: "Informe",
        icon: FileBarChart,
        matchSegment: "/report",
      },
      {
        to: "/p/$projectId/wordpress" as const,
        label: "WordPress",
        icon: FileText,
        matchSegment: "/wordpress",
      },
      {
        to: "/p/$projectId/ai" as const,
        label: "IA",
        icon: Bot,
        matchSegment: "/ai",
      },
    ],
  },
  {
    id: "settings",
    label: "Ajustes",
    items: [
      {
        to: "/p/$projectId/settings" as const,
        label: "Ajustes del proyecto",
        icon: Settings,
        matchSegment: "/settings",
      },
      {
        to: "/p/$projectId/cache" as const,
        label: "Caché",
        icon: Database,
        matchSegment: "/cache",
      },
    ],
  },
] as const;

// Tipos derivados del literal para consumidores externos
export type NavCategory = (typeof projectNavCategories)[number];
export type NavItem = NavCategory["items"][number];

// Lista plana derivada de las categorias, para retrocompatibilidad
// con cualquier otro modulo que aun importe projectNavItems.
// El cast a NavItem[] es seguro: cada `category.items` es un subtipo de NavItem[].
export const projectNavItems: readonly NavItem[] = projectNavCategories.flatMap(
  (category) => category.items as readonly NavItem[],
);

// Helper: busca el item activo y su categoria en base al pathname.
// Util para breadcrumbs y estados activos.
export function findActiveNavEntry(currentPath: string): {
  category: NavCategory;
  item: NavItem;
} | null {
  for (const category of projectNavCategories) {
    for (const item of category.items) {
      if (currentPath.includes(item.matchSegment)) {
        return { category, item };
      }
    }
  }
  return null;
}
