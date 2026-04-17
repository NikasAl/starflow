// ============================================================
// Simple AI — each AI player makes decisions periodically
// ============================================================
import { PlayerId } from '../core/types';
import type { Planet, ShipStream } from '../core/types';
import { createStream } from '../game/state';
import { dist } from '../utils/math';

export interface AIConfig {
  thinkInterval: number;  // seconds between decisions
  aggressiveness: number; // 0..1
}

const defaultAI: AIConfig = {
  thinkInterval: 2.5,
  aggressiveness: 0.6,
};

const timers = new Map<number, number>();

export function initAI(players: PlayerId[]): void {
  timers.clear();
  for (const p of players) {
    timers.set(p, 0);
  }
}

export function updateAI(
  delta: number,
  planets: Planet[],
  aiPlayers: PlayerId[],
  newStreams: ShipStream[],
  config: AIConfig = defaultAI
): void {
  for (const aiId of aiPlayers) {
    const timer = (timers.get(aiId) || 0) + delta;
    if (timer < config.thinkInterval) {
      timers.set(aiId, timer);
      continue;
    }
    timers.set(aiId, 0);

    // Gather my planets
    const myPlanets = planets.filter(p => p.ownerId === aiId);
    if (myPlanets.length === 0) continue;

    // Pick a random source with ships
    const sources = myPlanets.filter(p => p.pendingShips > 0);
    if (sources.length === 0) continue;

    const source = sources[Math.floor(Math.random() * sources.length)];
    const shipCount = Math.max(source.pendingShips, 1);

    // Find nearest non-owned planet
    let bestTarget: Planet | null = null;
    let bestDist = Infinity;

    for (const planet of planets) {
      if (planet.ownerId === aiId) continue;
      const d = dist(source.pos, planet.pos);
      if (d < bestDist) {
        bestDist = d;
        bestTarget = planet;
      }
    }

    if (bestTarget) {
      newStreams.push(createStream(source, bestTarget, aiId, shipCount));
      source.pendingShips = 0;
    }
  }
}
