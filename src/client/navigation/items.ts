import { BarChart3, Bookmark, Bot, ClipboardCheck, Database, FileText, Globe, Languages, MapPin, Network, Search, Target, TrendingUp, Users } from "lucide-react";

export const projectNavItems = [
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
    to: "/p/$projectId/competitors" as const,
    label: "Competencia",
    icon: Users,
    matchSegment: "/competitors",
  },
  {
    to: "/p/$projectId/domain" as const,
    label: "Dominio",
    icon: Globe,
    matchSegment: "/domain",
  },
  {
    to: "/p/$projectId/tracker" as const,
    label: "Posiciones",
    icon: TrendingUp,
    matchSegment: "/tracker",
  },
  {
    to: "/p/$projectId/local" as const,
    label: "SEO Local",
    icon: MapPin,
    matchSegment: "/local",
  },
  {
    to: "/p/$projectId/multilang" as const,
    label: "Multiidioma",
    icon: Languages,
    matchSegment: "/multilang",
  },
  {
    to: "/p/$projectId/serp" as const,
    label: "SERP",
    icon: BarChart3,
    matchSegment: "/serp",
  },
  {
    to: "/p/$projectId/opportunities" as const,
    label: "Oportunidades",
    icon: Target,
    matchSegment: "/opportunities",
  },
  {
    to: "/p/$projectId/clusters" as const,
    label: "Clusters",
    icon: Network,
    matchSegment: "/clusters",
  },
  {
    to: "/p/$projectId/wordpress" as const,
    label: "WordPress",
    icon: FileText,
    matchSegment: "/wordpress",
  },
  {
    to: "/p/$projectId/audit" as const,
    label: "Auditoría",
    icon: ClipboardCheck,
    matchSegment: "/audit",
  },
  {
    to: "/p/$projectId/ai" as const,
    label: "IA",
    icon: Bot,
    matchSegment: "/ai",
  },
  {
    to: "/p/$projectId/cache" as const,
    label: "Caché",
    icon: Database,
    matchSegment: "/cache",
  },
] as const;
