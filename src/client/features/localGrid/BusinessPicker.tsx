// Paso previo al Geo-Grid: búsqueda de negocio objetivo en Google Maps.
// El usuario introduce "nombre + ubicación", pulsa "Buscar" y elige una
// tarjeta. Al seleccionar un negocio, notifica al padre con todos los
// datos (place_id, lat/lng, dominio, rating, reseñas, etc.) para
// pre-rellenar el `LocalGridForm`.

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  Search,
  Loader2,
  AlertTriangle,
  Star,
  MapPin,
  Globe,
  Phone,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { searchBusinesses } from "@/serverFunctions/localGrid";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import type { BusinessSearchResult } from "@/types/localGrid";

type Props = {
  // Callback cuando el usuario selecciona un negocio. El padre se encarga
  // de avanzar al siguiente paso (form del scan).
  onSelect: (business: BusinessSearchResult) => void;
  // Defaults iniciales opcionales (si el proyecto tiene business/location
  // configurados, los pre-rellenamos para que el usuario sólo pulse Buscar).
  defaultQuery?: string;
  defaultLocationName?: string;
  defaultLanguageCode?: string;
};

// Normaliza un website a dominio sin www ni protocolo. Si no es URL válida,
// devuelve la cadena original limpia. Usado para mostrar dominio en la
// tarjeta de resultados.
function extractDomain(
  website: string | null,
  fallback: string | null,
): string | null {
  const input = website ?? fallback ?? null;
  if (!input) return null;
  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(input)
      ? input
      : `https://${input}`;
    return new URL(withProtocol).hostname.replace(/^www\./, "");
  } catch {
    return input.trim().replace(/^www\./, "");
  }
}

// Renderiza el rating como estrella + número (un solo glyph para ahorrar
// espacio en la tarjeta).
function RatingBadge({
  rating,
  count,
}: {
  rating: number | null;
  count: number | null;
}) {
  if (rating == null) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-base-content/80">
      <Star className="size-3 fill-yellow-500 text-yellow-500" />
      <span className="font-semibold">{rating.toFixed(1)}</span>
      {count != null && <span className="text-base-content/50">({count})</span>}
    </span>
  );
}

// oxlint-disable-next-line max-lines-per-function -- Componente con estado + lista
export default function BusinessPicker({
  onSelect,
  defaultQuery,
  defaultLocationName,
  defaultLanguageCode,
}: Props) {
  const [query, setQuery] = useState(defaultQuery ?? "");
  const [locationName, setLocationName] = useState(
    defaultLocationName ?? "Valencia, España",
  );
  const [languageCode, setLanguageCode] = useState(defaultLanguageCode ?? "es");

  const searchMutation = useMutation({
    mutationFn: (params: {
      query: string;
      locationName: string;
      languageCode: string;
    }) => searchBusinesses({ data: params }),
    onError: (err) =>
      toast.error(getStandardErrorMessage(err, "Error buscando negocios")),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !locationName.trim()) {
      toast.error("Rellena nombre del negocio y ubicación.");
      return;
    }
    searchMutation.mutate({
      query: query.trim(),
      locationName: locationName.trim(),
      languageCode,
    });
  };

  const results = searchMutation.data?.results ?? [];
  const isSearching = searchMutation.isPending;
  const hasSearched = searchMutation.isSuccess || searchMutation.isError;

  return (
    <section className="border border-base-300 rounded-xl bg-base-100 p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Building2 className="size-4" />
          Paso 1 · Selecciona el negocio objetivo
        </h2>
        <p className="text-xs text-base-content/60 mt-0.5">
          Busca por nombre comercial o categoría + ciudad. Al elegir, usaremos
          su <code>place_id</code>, sus coordenadas y su dominio para ejecutar
          el Geo-Grid.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-[1fr_1fr_120px_auto] gap-2"
      >
        <label className="form-control">
          <span className="label label-text text-xs font-medium">
            Nombre del negocio o keyword
          </span>
          <input
            className="input input-bordered input-sm"
            placeholder="ej: Fiscalis Valencia, dentista Benimaclet..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isSearching}
          />
        </label>

        <label className="form-control">
          <span className="label label-text text-xs font-medium">
            Ubicación
          </span>
          <div className="relative">
            <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-base-content/40 pointer-events-none" />
            <input
              className="input input-bordered input-sm w-full pl-7"
              placeholder="ej: Valencia, España"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              disabled={isSearching}
            />
          </div>
        </label>

        <label className="form-control">
          <span className="label label-text text-xs font-medium">Idioma</span>
          <select
            className="select select-bordered select-sm"
            value={languageCode}
            onChange={(e) => setLanguageCode(e.target.value)}
            disabled={isSearching}
          >
            <option value="es">Español</option>
            <option value="en">Inglés</option>
            <option value="fr">Francés</option>
            <option value="pt">Portugués</option>
            <option value="it">Italiano</option>
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            className="btn btn-sm btn-primary gap-1 w-full"
            disabled={isSearching}
          >
            {isSearching ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <Search className="size-3.5" />
                Buscar negocio
              </>
            )}
          </button>
        </div>
      </form>

      {/* Lista de resultados */}
      {hasSearched && !isSearching && results.length === 0 && (
        <div className="alert alert-warning alert-sm text-xs">
          <AlertTriangle className="size-4" />
          <span>
            No se encontraron negocios para &quot;{query}&quot; en &quot;
            {locationName}&quot;. Ajusta el término o la ubicación.
          </span>
        </div>
      )}

      {results.length > 0 && (
        <div>
          <p className="text-xs text-base-content/60 mb-2">
            {results.length} resultados · haz clic para seleccionar.
          </p>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {results.map((biz, idx) => {
              const domain = extractDomain(biz.website, biz.domain);
              return (
                <li key={`${biz.placeId ?? "none"}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(biz)}
                    className="w-full text-left border border-base-300 rounded-lg bg-base-50 hover:bg-primary/5 hover:border-primary/40 transition-colors p-3 space-y-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-tight">
                        {biz.businessName}
                      </p>
                      <RatingBadge
                        rating={biz.rating}
                        count={biz.reviewCount}
                      />
                    </div>
                    {biz.category && (
                      <p className="text-[11px] text-base-content/60">
                        {biz.category}
                      </p>
                    )}
                    {biz.address && (
                      <p className="text-[11px] text-base-content/70 flex items-start gap-1">
                        <MapPin className="size-3 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{biz.address}</span>
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                      {domain && (
                        <span className="inline-flex items-center gap-1 text-base-content/70">
                          <Globe className="size-3" />
                          {domain}
                        </span>
                      )}
                      {biz.phone && (
                        <span className="inline-flex items-center gap-1 text-base-content/60">
                          <Phone className="size-3" />
                          {biz.phone}
                        </span>
                      )}
                      {biz.latitude != null && biz.longitude != null && (
                        <span className="text-base-content/40 tabular-nums">
                          {biz.latitude.toFixed(4)}, {biz.longitude.toFixed(4)}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
