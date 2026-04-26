// Calculadora de metas de reseñas.
// Dado rating actual + total actual, calcula cuántas reseñas 5★ hacen falta
// para alcanzar un rating objetivo, y el ritmo mensual necesario si queremos
// llegar en 6 meses.
//
// Fórmula (asumiendo que todas las nuevas reseñas son 5★):
//   newAvg = (currentTotal * currentAvg + needed * 5) / (currentTotal + needed)
//   newAvg * (currentTotal + needed) = currentTotal * currentAvg + needed * 5
//   newAvg*currentTotal + newAvg*needed = currentTotal*currentAvg + 5*needed
//   needed * (newAvg - 5) = currentTotal*currentAvg - newAvg*currentTotal
//   needed = currentTotal * (newAvg - currentAvg) / (5 - newAvg)
//
// - Si el objetivo ya se alcanza (newAvg <= currentAvg), devuelve 0.
// - Si el objetivo es ≥ 5.0, devuelve Infinity (matemáticamente imposible
//   porque ni con infinitas 5★ subiríamos por encima de 5.0).

import { useState, useMemo } from "react";
import { Target, Calendar, Calculator } from "lucide-react";

type Props = {
  currentTotal: number;
  currentAvg: number | null;
};

// Calcula el número de reseñas 5★ necesarias para llegar al objetivo.
// Devuelve null si no es posible (objetivo ≥ 5.0 o inputs inválidos).
export function calculateReviewsNeeded(
  currentTotal: number,
  currentAvg: number,
  targetAvg: number,
): number | null {
  if (
    !Number.isFinite(currentTotal) ||
    !Number.isFinite(currentAvg) ||
    !Number.isFinite(targetAvg)
  ) {
    return null;
  }
  if (currentTotal < 0 || currentAvg < 0 || targetAvg < 0) return null;
  if (targetAvg <= currentAvg) return 0;
  if (targetAvg >= 5) return null; // imposible pasar de 5 estrellas

  const numerator = currentTotal * (targetAvg - currentAvg);
  const denominator = 5 - targetAvg;
  if (denominator <= 0) return null;

  const exact = numerator / denominator;
  // Redondeamos hacia arriba porque "0.3 reseñas" no existe — hacen falta enteras.
  return Math.ceil(exact);
}

// oxlint-disable-next-line max-lines-per-function -- Calculadora con múltiples inputs y ramas de UI
export default function ReviewsGoalCalculator({
  currentTotal,
  currentAvg,
}: Props) {
  // Rating objetivo por defecto: 0.3 por encima del actual, redondeado a
  // décimas, con techo 4.9.
  const defaultTarget = useMemo(() => {
    const base = currentAvg ?? 4.0;
    return Math.min(4.9, Math.round((base + 0.3) * 10) / 10);
  }, [currentAvg]);

  const [targetAvg, setTargetAvg] = useState<number>(defaultTarget);
  const [months, setMonths] = useState<number>(6);

  const currentAvgSafe = currentAvg ?? 0;

  const needed = useMemo(
    () => calculateReviewsNeeded(currentTotal, currentAvgSafe, targetAvg),
    [currentTotal, currentAvgSafe, targetAvg],
  );

  // Reseñas / mes para llegar al objetivo en `months` meses.
  const perMonth =
    needed != null && months > 0 ? Math.ceil(needed / months) : null;

  // Color del resultado: verde si <=30 reseñas, amarillo <=100, rojo >100.
  const neededColor =
    needed == null
      ? "text-error"
      : needed === 0
        ? "text-success"
        : needed <= 30
          ? "text-success"
          : needed <= 100
            ? "text-warning"
            : "text-error";

  return (
    <div className="border border-base-300 rounded-xl bg-base-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-base-300 bg-base-200/30">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Calculator className="size-4 text-primary" />
          Calculadora de metas
        </h3>
        <p className="text-xs text-base-content/50 mt-0.5">
          ¿Cuántas reseñas 5★ necesitas para subir tu rating?
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Estado actual */}
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="p-2 border border-base-200 rounded-lg">
            <p className="text-xs text-base-content/50">Rating actual</p>
            <p className="text-xl font-bold text-warning tabular-nums">
              {currentAvg != null ? currentAvg.toFixed(1) : "—"}
            </p>
          </div>
          <div className="p-2 border border-base-200 rounded-lg">
            <p className="text-xs text-base-content/50">Reseñas actuales</p>
            <p className="text-xl font-bold tabular-nums">
              {currentTotal.toLocaleString("es-ES")}
            </p>
          </div>
        </div>

        {/* Slider rating objetivo */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="target-avg"
              className="text-xs font-medium text-base-content/70"
            >
              Rating objetivo
            </label>
            <span className="text-lg font-bold text-primary tabular-nums">
              {targetAvg.toFixed(1)}
            </span>
          </div>
          <input
            id="target-avg"
            type="range"
            min={3.5}
            max={5.0}
            step={0.1}
            value={targetAvg}
            onChange={(e) => setTargetAvg(Number(e.target.value))}
            className="range range-sm range-primary"
          />
          <div className="flex justify-between text-[10px] text-base-content/40 mt-0.5 tabular-nums">
            <span>3.5</span>
            <span>4.0</span>
            <span>4.5</span>
            <span>5.0</span>
          </div>
        </div>

        {/* Meses para el objetivo */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="months"
              className="text-xs font-medium text-base-content/70 flex items-center gap-1"
            >
              <Calendar className="size-3" />
              Plazo en meses
            </label>
            <span className="text-sm font-semibold tabular-nums">{months}</span>
          </div>
          <input
            id="months"
            type="range"
            min={1}
            max={24}
            step={1}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="range range-xs range-secondary"
          />
        </div>

        {/* Resultado */}
        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
          {needed == null ? (
            <p className="text-xs text-error flex items-center gap-1">
              <Target className="size-3" />
              Imposible: el rating objetivo es 5.0 o superior, no se puede
              alcanzar con reseñas 5★.
            </p>
          ) : needed === 0 ? (
            <p className="text-xs text-success flex items-center gap-1">
              <Target className="size-3" />
              Ya has alcanzado (o superas) el rating objetivo. ¡Bien hecho!
            </p>
          ) : (
            <>
              <p className="text-xs font-medium text-primary flex items-center gap-1">
                <Target className="size-3" />
                Plan para llegar a {targetAvg.toFixed(1)}★
              </p>
              <p
                className={`text-2xl font-bold mt-1 tabular-nums ${neededColor}`}
              >
                {needed.toLocaleString("es-ES")} reseñas 5★
              </p>
              <p className="text-xs text-base-content/70 mt-1">
                para pasar de <strong>{currentAvgSafe.toFixed(1)}★</strong> a{" "}
                <strong>{targetAvg.toFixed(1)}★</strong> (con {currentTotal}{" "}
                reseñas actuales).
              </p>
              {perMonth != null && (
                <p className="text-xs text-base-content/70 mt-1 flex items-center gap-1">
                  <Calendar className="size-3" />
                  Ritmo: <strong>{perMonth} reseñas/mes</strong> para llegar en{" "}
                  {months} {months === 1 ? "mes" : "meses"}.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
