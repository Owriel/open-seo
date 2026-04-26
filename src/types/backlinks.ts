// Tipos del módulo "Backlinks" (DataForSEO Backlinks API).
// Representan los datos normalizados que devolvemos al cliente tras llamar
// a los 4 endpoints agregados (summary / backlinks / referring_domains / anchors).

// Resumen agregado del perfil de enlaces (endpoint backlinks/summary/live).
// Contiene contadores globales y distribuciones por TLD, país, plataforma, etc.
export type BacklinksSummary = {
  target: string;
  firstSeen: string | null;
  lostDate: string | null;
  rank: number | null;
  backlinks: number;
  spamScore: number | null;
  crawledPages: number | null;
  internalLinksCount: number | null;
  externalLinksCount: number | null;
  brokenBacklinks: number | null;
  brokenPages: number | null;
  referringDomains: number;
  referringDomainsNofollow: number;
  referringMainDomains: number;
  referringMainDomainsNofollow: number;
  referringIps: number | null;
  referringSubnets: number | null;
  referringPages: number | null;
  referringPagesNofollow: number | null;
  // Mapas (clave → conteo) para construir gráficos. Pueden venir null.
  referringLinksTld: Record<string, number>;
  referringLinksTypes: Record<string, number>;
  referringLinksAttributes: Record<string, number>;
  referringLinksPlatformTypes: Record<string, number>;
  referringLinksSemanticLocations: Record<string, number>;
  referringLinksCountries: Record<string, number>;
};

// Entrada individual de la lista de backlinks (endpoint backlinks/backlinks/live).
export type BacklinkItem = {
  type: string | null;
  domainFrom: string | null;
  urlFrom: string | null;
  urlFromHttps: boolean | null;
  domainTo: string | null;
  urlTo: string | null;
  tldFrom: string | null;
  isNew: boolean | null;
  isLost: boolean | null;
  spamScore: number | null;
  rank: number | null;
  pageFromRank: number | null;
  domainFromRank: number | null;
  domainFromPlatformType: string[] | null;
  domainFromCountry: string | null;
  pageFromLanguage: string | null;
  pageFromTitle: string | null;
  pageFromStatusCode: number | null;
  firstSeen: string | null;
  lastSeen: string | null;
  itemType: string | null;
  attributes: string[] | null;
  dofollow: boolean | null;
  anchor: string | null;
  semanticLocation: string | null;
  isBroken: boolean | null;
};

// Entrada individual de la lista de dominios referentes.
export type ReferringDomainItem = {
  domain: string;
  rank: number | null;
  backlinks: number;
  firstSeen: string | null;
  lostDate: string | null;
  spamScore: number | null;
  brokenBacklinks: number | null;
  referringDomains: number | null;
  referringMainDomains: number | null;
  referringPages: number | null;
  referringPagesNofollow: number | null;
  // Ratio dofollow/nofollow aproximado, calculado a partir de attributes.
  dofollowRatio: number | null;
};

// Entrada individual de la distribución de anchors.
export type AnchorItem = {
  anchor: string;
  rank: number | null;
  backlinks: number;
  firstSeen: string | null;
  lostDate: string | null;
  spamScore: number | null;
  referringDomains: number | null;
  referringMainDomains: number | null;
  referringPages: number | null;
  // Porcentaje respecto al total de backlinks (0..100). Calculado client-side,
  // se persiste aquí para que la tabla no lo recalcule.
  percentOfTotal: number;
};

// Resultado agregado que se devuelve al cliente tras un análisis completo.
export type BacklinksAnalysis = {
  id: string;
  projectId: string;
  target: string;
  totalBacklinks: number;
  totalReferringDomains: number;
  rank: number | null;
  spamScore: number | null;
  summary: BacklinksSummary;
  topDomains: ReferringDomainItem[];
  topAnchors: AnchorItem[];
  backlinks: BacklinkItem[];
  createdAt: string;
};

// Resumen ligero para la sidebar de historial (sin arrays largos).
export type BacklinksAnalysisSummary = {
  id: string;
  target: string;
  totalBacklinks: number;
  totalReferringDomains: number;
  rank: number | null;
  spamScore: number | null;
  createdAt: string;
};

// Un backlink con su score tóxico calculado y el desglose de pistas.
export type ToxicBacklink = {
  backlink: BacklinkItem;
  score: number;
  // Array de razones legibles: "Spam score > 30", "TLD sospechoso (.xyz)", etc.
  reasons: string[];
};
