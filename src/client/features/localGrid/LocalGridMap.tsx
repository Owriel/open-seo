// Mapa Google Maps para visualizar un scan del Geo-Grid.
// Usa `@googlemaps/js-api-loader` v2 (API funcional `setOptions` +
// `importLibrary`) para cargar la API JS de forma robusta (dedupe, reuso
// entre rutas, carga async). La API key se obtiene del servidor mediante
// `getGoogleMapsApiKey` — NUNCA va hardcodeada en el bundle client-side.
//
// Cada punto del grid se pinta como `AdvancedMarkerElement` con contenido
// HTML custom (círculo coloreado por bucket + número de posición). Al
// hacer click en un marker se abre un InfoWindow con la tabla Top 5 de
// la celda, resaltando el negocio objetivo si aparece.

import { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import type { GridPoint, GridTopResult } from "@/types/localGrid";
import {
  BUCKET_COLORS,
  getPositionBucket,
  formatPosition,
} from "@/client/features/localGrid/colors";
import { getGoogleMapsApiKey } from "@/serverFunctions/localGrid";

type Props = {
  centerLat: number;
  centerLng: number;
  points: GridPoint[];
  // Tamaño del grid (para ajustar el zoom inicial).
  gridSize: number;
  // Radio en km del grid (para ajustar el zoom inicial).
  radiusKm: number;
  // Datos del negocio objetivo (para resaltar en la tabla del InfoWindow).
  targetDomain: string;
  targetPlaceId: string | null;
};

// Guardamos si ya llamamos a `setOptions` (solo se puede llamar una vez con
// la misma key, antes del primer importLibrary).
let optionsConfigured = false;

// Configura y carga las librerías core de Google Maps (maps + marker).
async function loadGoogleMapsCore(apiKey: string): Promise<{
  mapsLib: google.maps.MapsLibrary;
  markerLib: google.maps.MarkerLibrary;
}> {
  if (!optionsConfigured) {
    setOptions({
      key: apiKey,
      v: "weekly",
    });
    optionsConfigured = true;
  }
  const [mapsLib, markerLib] = await Promise.all([
    importLibrary("maps"),
    importLibrary("marker"),
  ]);
  return { mapsLib, markerLib };
}

// Zoom inicial aproximado según el radio del grid (valores empíricos).
function pickInitialZoom(radiusKm: number): number {
  if (radiusKm <= 1) return 14;
  if (radiusKm <= 3) return 13;
  if (radiusKm <= 6) return 12;
  if (radiusKm <= 12) return 11;
  return 10;
}

// HTML del marker: círculo coloreado con el número de posición dentro.
// Si no hay posición, pintamos una "×" centrada.
function buildMarkerContent(point: GridPoint): HTMLElement {
  const bucket = getPositionBucket(point.position);
  const { fill, stroke } = BUCKET_COLORS[bucket];
  const label = formatPosition(point.position);
  const display = label === "—" ? "×" : label.replace("#", "");

  const el = document.createElement("div");
  el.style.cssText = [
    "width: 30px",
    "height: 30px",
    "border-radius: 50%",
    `background: ${fill}`,
    `border: 2px solid ${stroke}`,
    "color: white",
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "font-size: 11px",
    "font-weight: 700",
    "box-shadow: 0 1px 3px rgba(0,0,0,0.4)",
    "font-family: system-ui, sans-serif",
    "cursor: pointer",
    "user-select: none",
  ].join(";");
  el.textContent = display;
  return el;
}

// Escapa texto para inyección segura dentro del HTML del InfoWindow.
// Evitamos XSS si un businessName trae ángulos raros.
function escapeHtml(input: string | null | undefined): string {
  if (input == null) return "";
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Normaliza un dominio para comparar (sin www, lowercase).
function normalizeDomainForCompare(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
}

// Determina si un resultado del top 5 corresponde al negocio objetivo.
// Prioridad: place_id > dominio.
function isTargetRow(
  row: GridTopResult,
  targetDomain: string,
  targetPlaceId: string | null,
): boolean {
  if (targetPlaceId && row.placeId && row.placeId === targetPlaceId) {
    return true;
  }
  const target = normalizeDomainForCompare(targetDomain);
  const rowDomain = normalizeDomainForCompare(row.domain);
  if (target && rowDomain) {
    if (rowDomain === target) return true;
    if (rowDomain.endsWith(`.${target}`)) return true;
    if (target.endsWith(`.${rowDomain}`)) return true;
  }
  return false;
}

// Construye el HTML del InfoWindow: badge de posición + coords + tabla Top 5.
// Si `topResults` viene vacío o undefined (scan antiguo), mostramos un
// mensaje alternativo.
// oxlint-disable-next-line max-lines-per-function -- HTML de popup con lógica de render
function buildInfoWindowHtml(
  point: GridPoint,
  targetDomain: string,
  targetPlaceId: string | null,
): string {
  const bucket = getPositionBucket(point.position);
  const { fill } = BUCKET_COLORS[bucket];
  const label = formatPosition(point.position);
  const tops = point.topResults ?? [];

  // Badge grande con la posición del target en esa celda.
  const badgeHtml = `
    <div style="
      display:inline-flex;align-items:center;gap:6px;
      padding:4px 10px;border-radius:999px;
      background:${fill};color:white;font-weight:700;font-size:12px;
      box-shadow:0 1px 2px rgba(0,0,0,.2);
    ">
      ${escapeHtml(label === "—" ? "No aparece en top 20" : `Posición ${label}`)}
    </div>
  `;

  const coordsHtml = `
    <div style="font-size:10px;color:#6b7280;margin-top:6px;">
      Lat: ${point.lat.toFixed(5)} · Lng: ${point.lng.toFixed(5)} ·
      ${point.resultsCount} resultados
    </div>
  `;

  // Tabla top 5. Si no hay topResults, mostramos fallback.
  let tableHtml = "";
  if (tops.length === 0) {
    tableHtml = `
      <p style="font-size:11px;color:#6b7280;margin-top:10px;font-style:italic;">
        Top no disponible para este scan (guardado antes de la versión actual).
      </p>
    `;
  } else {
    // Si el target aparece pero no está en el top 5, lo mostramos como fila
    // extra al final indicando la posición real.
    const targetInTop = tops.some((r) =>
      isTargetRow(r, targetDomain, targetPlaceId),
    );
    const showTargetFooter = !targetInTop && point.position != null;

    const rows = tops
      .map((row) => {
        const isTarget = isTargetRow(row, targetDomain, targetPlaceId);
        const highlight = isTarget
          ? "background:rgba(99,102,241,0.10);font-weight:600;"
          : "";
        const star = isTarget
          ? `<span style="color:#eab308;" title="Tu negocio">★</span> `
          : "";
        const rating =
          row.rating != null
            ? `${row.rating.toFixed(1)}${row.reviewCount != null ? ` (${row.reviewCount})` : ""}`
            : "—";
        const domainCell = row.website
          ? `<a href="${escapeHtml(row.website)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;">${escapeHtml(row.domain ?? row.website)}</a>`
          : escapeHtml(row.domain ?? "—");
        return `
          <tr style="${highlight}">
            <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;font-variant-numeric:tabular-nums;">#${row.position}</td>
            <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${star}${escapeHtml(row.businessName)}</td>
            <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;white-space:nowrap;">${rating}</td>
            <td style="padding:4px 6px;border-bottom:1px solid #e5e7eb;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${domainCell}</td>
          </tr>
        `;
      })
      .join("");

    const footer = showTargetFooter
      ? `
        <p style="font-size:11px;color:#6b7280;margin-top:8px;">
          Tu posición en esta celda: <strong>#${point.position}</strong>
          (fuera del top 5 visible).
        </p>
      `
      : "";

    tableHtml = `
      <div style="margin-top:10px;">
        <p style="font-size:11px;font-weight:600;color:#374151;margin-bottom:4px;">
          Top 5 en esta ubicación
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:11px;color:#111827;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:4px 6px;text-align:left;">#</th>
              <th style="padding:4px 6px;text-align:left;">Negocio</th>
              <th style="padding:4px 6px;text-align:left;">Rating</th>
              <th style="padding:4px 6px;text-align:left;">Web</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${footer}
      </div>
    `;
  }

  return `
    <div style="min-width:320px;max-width:420px;font-family:system-ui,sans-serif;">
      ${badgeHtml}
      ${coordsHtml}
      ${tableHtml}
    </div>
  `;
}

// oxlint-disable-next-line max-lines-per-function -- Componente wrapper de Google Maps con carga async
export default function LocalGridMap({
  centerLat,
  centerLng,
  points,
  gridSize,
  radiusKm,
  targetDomain,
  targetPlaceId,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Instancia del mapa (persistente entre renders).
  const mapRef = useRef<google.maps.Map | null>(null);
  // Markers vivos (para limpiarlos al cambiar puntos).
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  // InfoWindow reusable (evitamos crear uno por marker).
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (typeof window === "undefined") return;

    let cancelled = false;

    void (async () => {
      try {
        // 1. Pedimos la key al server (requiere autenticación).
        const { apiKey } = await getGoogleMapsApiKey();
        if (cancelled) return;

        // 2. Cargamos las librerías (reusa si otra ruta ya cargó la API).
        const { mapsLib, markerLib } = await loadGoogleMapsCore(apiKey);
        if (cancelled || !containerRef.current) return;

        const { Map, InfoWindow } = mapsLib;
        const { AdvancedMarkerElement } = markerLib;
        // LatLngBounds vive en la librería "core"; la importamos aparte.
        const coreLib = await importLibrary("core");
        if (cancelled) return;
        const { LatLngBounds } = coreLib;

        const initialZoom = pickInitialZoom(radiusKm);

        // 3. Si el mapa ya existe (cambio de props), reusamos la instancia.
        let map = mapRef.current;
        if (!map) {
          map = new Map(containerRef.current, {
            center: { lat: centerLat, lng: centerLng },
            zoom: initialZoom,
            // mapId requerido por AdvancedMarkerElement. Usamos el "DEMO_MAP_ID"
            // oficial de Google para estilos por defecto; el cliente puede
            // crear su propio map id en Google Cloud si quiere personalizarlos.
            mapId: "DEMO_MAP_ID",
            gestureHandling: "greedy",
            disableDefaultUI: false,
          });
          mapRef.current = map;
        } else {
          map.setCenter({ lat: centerLat, lng: centerLng });
          map.setZoom(initialZoom);
        }

        // 4. Limpiamos markers anteriores.
        for (const m of markersRef.current) {
          m.map = null;
        }
        markersRef.current = [];

        // 5. InfoWindow singleton.
        if (!infoWindowRef.current) {
          infoWindowRef.current = new InfoWindow();
        }
        const infoWindow = infoWindowRef.current;

        // 6. Creamos un AdvancedMarker por cada punto.
        const bounds = new LatLngBounds();
        for (const p of points) {
          const content = buildMarkerContent(p);
          const marker = new AdvancedMarkerElement({
            map,
            position: { lat: p.lat, lng: p.lng },
            content,
            title: `Posición: ${formatPosition(p.position)}`,
          });

          // Click → abrir InfoWindow con tabla Top 5.
          // El evento de AdvancedMarkerElement es "gmp-click".
          marker.addListener("gmp-click", () => {
            infoWindow.setContent(
              buildInfoWindowHtml(p, targetDomain, targetPlaceId),
            );
            infoWindow.open({ map, anchor: marker });
          });

          markersRef.current.push(marker);
          bounds.extend({ lat: p.lat, lng: p.lng });
        }

        // 7. Ajustamos bounds a todos los puntos si hay al menos 2.
        if (points.length >= 2) {
          map.fitBounds(bounds, 40);
        }

        void gridSize; // mantenido para recomputación del zoom si cambia
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : "No se pudo cargar Google Maps",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    centerLat,
    centerLng,
    points,
    gridSize,
    radiusKm,
    targetDomain,
    targetPlaceId,
  ]);

  // Cleanup total al desmontar el componente.
  useEffect(() => {
    return () => {
      for (const m of markersRef.current) {
        m.map = null;
      }
      markersRef.current = [];
      infoWindowRef.current?.close();
      infoWindowRef.current = null;
      // NOTA: no desmontamos la instancia del mapa para permitir reusarla
      // si el componente vuelve a montarse en otra ruta/pestaña.
      mapRef.current = null;
    };
  }, []);

  if (loadError) {
    return (
      <div className="w-full h-[500px] rounded-xl border border-error bg-error/10 flex items-center justify-center text-sm text-error p-4 text-center">
        <div>
          <strong>Error al cargar Google Maps:</strong>
          <br />
          {loadError}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-[500px] rounded-xl border border-base-300 bg-base-200"
      aria-label="Mapa Geo-Grid"
    />
  );
}
