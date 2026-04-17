// ============================================================
// Production System — accumulates ships over time
// ============================================================
import { PlayerId } from '../core/types';
import type { Planet } from '../core/types';
import { PRODUCTION_INTERVAL } from '../core/types';

const accumulators = new Map<number, number>();

export function resetProduction(): void {
  accumulators.clear();
}

export function updateProduction(planets: Planet[], delta: number): void {
  // Clean up stale entries
  for (const [id] of accumulators) {
    if (!planets.find(p => p.id === id)) {
      accumulators.delete(id);
    }
  }

  for (const planet of planets) {
    if (planet.ownerId === PlayerId.NONE) continue;

    const rate = planet.productionRate * planet.level;
    if (rate <= 0) continue;

    let acc = accumulators.get(planet.id) || 0;
    acc += (rate * delta) / PRODUCTION_INTERVAL;
    accumulators.set(planet.id, acc);

    while (acc >= 1) {
      acc -= 1;
      planet.pendingShips++;
    }
    accumulators.set(planet.id, acc);
  }
}
