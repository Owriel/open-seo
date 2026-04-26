// Helper para calcular las NxN coordenadas de un grid alrededor de un centro
// (lat, lng) dado un radio en kilómetros.
//
// Fórmula:
//   - 1 grado de latitud ≈ 111 km (constante).
//   - 1 grado de longitud ≈ 111 km * cos(latitud) (varía según la latitud).
//   - El grid cubre un cuadrado de lado `2 * radiusKm` centrado en (lat, lng).
//   - Para gridSize = N, generamos N * N puntos equiespaciados, con el punto
//     central coincidiendo con (centerLat, centerLng) cuando N es impar.
//   - El "step" (distancia entre puntos consecutivos) es:
//       step = (2 * radiusKm) / (gridSize - 1)   para gridSize > 1
//     El índice recorre de -(N-1)/2 a +(N-1)/2.

const KM_PER_DEGREE_LAT = 111;

export type GridCoord = { lat: number; lng: number };

/**
 * Genera las coordenadas de un grid NxN centrado en (centerLat, centerLng).
 *
 * @param centerLat Latitud del centro en grados decimales.
 * @param centerLng Longitud del centro en grados decimales.
 * @param gridSize  Número de puntos por lado (3, 5 o 7 recomendado).
 * @param radiusKm  Radio en kilómetros desde el centro al borde del grid.
 * @returns array de {lat, lng} con `gridSize * gridSize` puntos en orden
 *          fila-mayor (de arriba-izq a abajo-der, norte a sur).
 */
export function computeGridCoordinates(
  centerLat: number,
  centerLng: number,
  gridSize: number,
  radiusKm: number,
): GridCoord[] {
  if (gridSize < 1 || !Number.isInteger(gridSize)) {
    throw new Error(`gridSize inválido: ${gridSize}`);
  }
  if (radiusKm <= 0) {
    throw new Error(`radiusKm inválido: ${radiusKm}`);
  }

  // Step entre puntos consecutivos. Para gridSize=1, no hay distancia.
  const stepKm = gridSize > 1 ? (2 * radiusKm) / (gridSize - 1) : 0;

  // Grados por km en latitud (constante).
  const latDegPerKm = 1 / KM_PER_DEGREE_LAT;
  // Grados por km en longitud, dependen de la latitud del centro.
  // Usamos la latitud del centro (aproximación buena para grids pequeños,
  // de hasta ~20km). Convertimos a radianes para cos().
  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  const lngDegPerKm = cosLat !== 0 ? 1 / (KM_PER_DEGREE_LAT * cosLat) : 0;

  const half = (gridSize - 1) / 2;
  const coords: GridCoord[] = [];

  // Recorrido fila-mayor: fila 0 es la más al norte (lat mayor).
  for (let row = 0; row < gridSize; row++) {
    // offsetY en km desde el centro (positivo = norte).
    // row=0 → offset = +half * step (norte). row=N-1 → offset = -half*step (sur).
    const offsetKmY = (half - row) * stepKm;
    const lat = centerLat + offsetKmY * latDegPerKm;

    for (let col = 0; col < gridSize; col++) {
      // offsetX en km desde el centro (positivo = este).
      const offsetKmX = (col - half) * stepKm;
      const lng = centerLng + offsetKmX * lngDegPerKm;
      coords.push({
        lat: Number(lat.toFixed(7)),
        lng: Number(lng.toFixed(7)),
      });
    }
  }

  return coords;
}

/**
 * Ejecuta una colección de tareas asíncronas con concurrencia limitada.
 * Se usa para lanzar las N*N llamadas del grid a DataForSEO sin saturar la API.
 *
 * @param tasks     Array de funciones que devuelven promesas.
 * @param concurrency Máximo de tareas ejecutándose en paralelo (ej. 8).
 * @returns array con los resultados en el mismo orden que las tareas.
 */
export async function runWithConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  // Mapa indice→resultado. Usamos un Map en lugar de un array pre-allocado
  // para evitar el type assertion a T[] (lint `no-unsafe-type-assertion`).
  const results = new Map<number, T>();
  let nextIdx = 0;

  // Cada worker va cogiendo el siguiente índice disponible hasta agotar tasks.
  async function worker(): Promise<void> {
    while (true) {
      const idx = nextIdx;
      nextIdx++;
      if (idx >= tasks.length) return;
      results.set(idx, await tasks[idx]());
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);

  // Reordenamos los resultados al orden original de las tareas.
  // Todos los índices [0..tasks.length) están garantizados en el Map porque
  // `nextIdx` los recorre linealmente antes de terminar los workers.
  const ordered: T[] = [];
  for (let i = 0; i < tasks.length; i++) {
    if (results.has(i)) {
      // `get` no puede devolver undefined aquí porque hemos comprobado has()
      // eslint-disable-next-line typescript/no-non-null-assertion
      ordered.push(results.get(i)!);
    }
  }
  return ordered;
}
