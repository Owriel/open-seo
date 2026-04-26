// Lista de reseñas con:
//   - Filtro dropdown por rating (todas / 5★ / 4★ / 3★ / 2★ / 1★ / negativas).
//   - Búsqueda full-text en el cuerpo de la reseña o autor.
//   - Resaltado inline de palabras positivas/negativas (sentiment básico).
// Cada reseña se pinta como tarjeta con: rating en estrellas, autor,
// fecha formateada, texto completo (con highlight), respuesta del owner si
// existe, y una etiqueta de sentiment.

import { useMemo, useState } from "react";
import {
  Star,
  Search,
  Filter,
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import type { ReviewItem } from "@/types/reviews";
import {
  analyzeSentiment,
  normalizeText,
  POSITIVE_WORDS,
  NEGATIVE_WORDS,
} from "@/server/lib/reviewsSentiment";

type Props = {
  reviews: ReviewItem[];
};

type RatingFilter = "all" | "5" | "4" | "3" | "2" | "1" | "negative";

// Estrellas inline compactas.
function InlineStars({ value }: { value: number | null }) {
  if (value == null)
    return <span className="text-base-content/40 text-xs">Sin rating</span>;
  const n = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`size-3 ${i < n ? "fill-warning text-warning" : "text-base-content/20"}`}
        />
      ))}
    </span>
  );
}

// Formatea la fecha de una reseña. Acepta ISO o "time ago".
function formatDate(raw: string | null): string {
  if (!raw) return "";
  // Si es time_ago ("hace 3 meses"), lo mostramos tal cual.
  if (!raw.match(/\d{4}-\d{2}-\d{2}/)) return raw;
  const iso = raw.includes("T")
    ? raw
    : raw.replace(" ", "T").replace(" +", "+");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Resalta palabras positivas/negativas en un texto.
// Como el análisis trabaja sobre texto normalizado (sin tildes, minúscula)
// y los términos pueden ser multi-palabra, buscamos case-insensitive en el
// texto original con los mismos términos (sin normalizar) como regex.
// Esto puede perder alguna coincidencia con tildes, pero es suficiente para
// highlight indicativo.
function HighlightedText({
  text,
  positive,
  negative,
}: {
  text: string;
  positive: readonly string[];
  negative: readonly string[];
}) {
  // Construimos un array de segmentos alternando texto / match con su clase.
  // Para evitar overlaps, ordenamos matches por posición y no superponemos.
  const segments = useMemo(() => {
    if (!text) return [{ text: "", className: "" }];

    type Match = { start: number; end: number; kind: "pos" | "neg" };
    const matches: Match[] = [];

    const pushMatches = (terms: readonly string[], kind: "pos" | "neg") => {
      for (const t of terms) {
        if (!t) continue;
        // Regex case-insensitive con límites de palabra. Escape simple.
        const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(`\\b${escaped}\\b`, "gi");
        let m;
        while ((m = re.exec(text)) !== null) {
          matches.push({ start: m.index, end: m.index + m[0].length, kind });
        }
      }
    };

    pushMatches(positive, "pos");
    pushMatches(negative, "neg");

    // Eliminar solapamientos: ordenamos por start y descartamos matches que
    // caen dentro de otro previo.
    matches.sort((a, b) => a.start - b.start);
    const filtered: Match[] = [];
    let lastEnd = -1;
    for (const m of matches) {
      if (m.start >= lastEnd) {
        filtered.push(m);
        lastEnd = m.end;
      }
    }

    const segs: { text: string; className: string }[] = [];
    let cursor = 0;
    for (const m of filtered) {
      if (m.start > cursor) {
        segs.push({ text: text.slice(cursor, m.start), className: "" });
      }
      segs.push({
        text: text.slice(m.start, m.end),
        className:
          m.kind === "pos"
            ? "bg-success/20 text-success-content px-0.5 rounded"
            : "bg-error/20 text-error px-0.5 rounded",
      });
      cursor = m.end;
    }
    if (cursor < text.length) {
      segs.push({ text: text.slice(cursor), className: "" });
    }
    return segs;
  }, [text, positive, negative]);

  return (
    <>
      {segments.map((s, i) => (
        <span key={i} className={s.className}>
          {s.text}
        </span>
      ))}
    </>
  );
}

// oxlint-disable-next-line max-lines-per-function -- Lista con filtros, búsqueda y sentiment
export default function ReviewsList({ reviews }: Props) {
  const [filter, setFilter] = useState<RatingFilter>("all");
  const [search, setSearch] = useState("");

  // Pre-procesamos sentiment una vez por reseña para evitar recálculos al
  // teclear en el buscador.
  const enriched = useMemo(
    () =>
      reviews.map((r) => {
        const sent = analyzeSentiment(r.text);
        return { review: r, sentiment: sent };
      }),
    [reviews],
  );

  // Filtramos por rating + búsqueda.
  const filtered = useMemo(() => {
    const searchNorm = normalizeText(search);
    return enriched.filter(({ review, sentiment }) => {
      // Filtro por rating.
      if (filter === "negative") {
        if (sentiment.label !== "negative" && (review.rating ?? 5) >= 4) {
          return false;
        }
      } else if (filter !== "all") {
        const target = Number(filter);
        const reviewRating =
          review.rating != null ? Math.round(review.rating) : null;
        if (reviewRating !== target) return false;
      }

      // Filtro por texto.
      if (searchNorm) {
        const haystack = normalizeText(
          `${review.text} ${review.authorName ?? ""}`,
        );
        if (!haystack.includes(searchNorm)) return false;
      }

      return true;
    });
  }, [enriched, filter, search]);

  // Contadores agregados por filtro para mostrar "X resultados".
  const counts = useMemo(() => {
    const byRating: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let negativeCount = 0;
    for (const { review, sentiment } of enriched) {
      const n = review.rating != null ? Math.round(review.rating) : null;
      if (n != null && n >= 1 && n <= 5) byRating[n] += 1;
      if (sentiment.label === "negative" || (n != null && n <= 2))
        negativeCount += 1;
    }
    return { byRating, negativeCount, total: enriched.length };
  }, [enriched]);

  return (
    <div className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
      {/* Header con filtros */}
      <div className="px-4 py-3 border-b border-base-300 bg-base-200/30 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <MessageCircle className="size-4 text-primary" />
            Reseñas descargadas
            <span className="badge badge-ghost badge-sm">
              {filtered.length}/{counts.total}
            </span>
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-base-content/40 pointer-events-none" />
            <input
              type="text"
              className="input input-bordered input-sm w-full pl-7"
              placeholder="Buscar en el texto o autor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-base-content/40 pointer-events-none" />
            <select
              className="select select-bordered select-sm pl-7"
              value={filter}
              onChange={(e) => {
                const v = e.target.value;
                if (
                  v === "all" ||
                  v === "5" ||
                  v === "4" ||
                  v === "3" ||
                  v === "2" ||
                  v === "1" ||
                  v === "negative"
                ) {
                  setFilter(v);
                }
              }}
            >
              <option value="all">Todas ({counts.total})</option>
              <option value="5">5★ ({counts.byRating[5]})</option>
              <option value="4">4★ ({counts.byRating[4]})</option>
              <option value="3">3★ ({counts.byRating[3]})</option>
              <option value="2">2★ ({counts.byRating[2]})</option>
              <option value="1">1★ ({counts.byRating[1]})</option>
              <option value="negative">
                Negativas ({counts.negativeCount})
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de reseñas */}
      <div className="max-h-[600px] overflow-y-auto divide-y divide-base-300">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-base-content/50">
            No hay reseñas que coincidan con los filtros.
          </div>
        ) : (
          filtered.map(({ review, sentiment }, idx) => (
            <div
              key={idx}
              className="p-3 hover:bg-base-200/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <InlineStars value={review.rating} />
                  <span className="text-sm font-medium">
                    {review.authorName ?? "Anónimo"}
                  </span>
                  {review.reviewDate && (
                    <span className="text-xs text-base-content/50">
                      {formatDate(review.reviewDate)}
                    </span>
                  )}
                </div>
                {/* Badge de sentiment */}
                {sentiment.label !== "neutral" && (
                  <span
                    className={`badge badge-xs gap-1 ${
                      sentiment.label === "positive"
                        ? "badge-success badge-outline"
                        : "badge-error badge-outline"
                    }`}
                  >
                    {sentiment.label === "positive" ? (
                      <ThumbsUp className="size-2.5" />
                    ) : (
                      <ThumbsDown className="size-2.5" />
                    )}
                    {sentiment.positiveCount}+ / {sentiment.negativeCount}−
                  </span>
                )}
              </div>
              {/* Texto con highlight */}
              {review.text && (
                <p className="text-sm text-base-content/80 mt-1.5 whitespace-pre-wrap break-words">
                  <HighlightedText
                    text={review.text}
                    positive={POSITIVE_WORDS}
                    negative={NEGATIVE_WORDS}
                  />
                </p>
              )}
              {/* Respuesta del owner si existe */}
              {review.ownerAnswer && (
                <div className="mt-2 pl-3 border-l-2 border-primary/30">
                  <p className="text-[10px] font-medium text-primary uppercase">
                    Respuesta del propietario
                  </p>
                  <p className="text-xs text-base-content/70 mt-0.5 whitespace-pre-wrap break-words">
                    {review.ownerAnswer}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
