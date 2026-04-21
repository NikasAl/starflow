// ============================================================
// Star Flow Command — AI Controller
// Aggressively expands, attacks, and reinforces
// ============================================================

import {
  type PlanetData, type ShipRoute, type OwnerId, type StarData,
  PLAYER, AI_1, AI_2, AI_3, NEUTRAL,
} from './types';
import {
  getMaxRoutesFromPlanet,
  PLANET_MAX_AUTO_POWER,
  STAR_KILL_RADIUS,
} from './constants';
import { getMissileStrengthForSize } from './constants';
import { isPathBlockedByStar } from './star';

export interface AIState {
  owner: OwnerId;
  thinkTimer: number;
  /** Seconds between AI decisions */
  thinkInterval: number;
  /** Active route IDs managed by this AI */
  activeRouteIds: Set<string>;
}

let routeCounter = 1000;

export function createAIs(count: number, thinkInterval: number = 2.0): AIState[] {
  const states: AIState[] = [];
  for (let i = 0; i < count; i++) {
    states.push({
      owner: (i + 2) as OwnerId, // 2=AI_1, 3=AI_2, 4=AI_3
      thinkTimer: thinkInterval * (0.3 + Math.random() * 0.7),
      thinkInterval,
      activeRouteIds: new Set(),
    });
  }
  return states;
}

function dist(a: PlanetData, b: PlanetData): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Update AI: actively create/remove routes to expand territory.
 * Returns route changes: { addRoutes, removeRouteIds }
 */
export function updateAI(
  ai: AIState,
  planets: PlanetData[],
  routes: ShipRoute[],
  stars: StarData[],
  dt: number,
): { addRoutes: ShipRoute[]; removeRouteIds: string[] } {
  const result = { addRoutes: [] as ShipRoute[], removeRouteIds: [] as string[] };

  ai.thinkTimer -= dt;
  if (ai.thinkTimer > 0) return result;
  ai.thinkTimer = ai.thinkInterval * (0.5 + Math.random() * 0.5);

  const myPlanets = planets.filter(p => p.owner === ai.owner);
  if (myPlanets.length === 0) return result;

  // Get my current active routes
  const myRoutes = routes.filter(r => r.owner === ai.owner && ai.activeRouteIds.has(r.id));

  // ---- Phase 1: Remove stale routes ----

  // Remove routes from planets we no longer own
  for (const route of myRoutes) {
    const source = planets.find(p => p.id === route.sourceId);
    if (!source || source.owner !== ai.owner) {
      result.removeRouteIds.push(route.id);
      ai.activeRouteIds.delete(route.id);
    }
  }

  // Remove routes to own planets that are well-established (power > 12)
  for (const route of myRoutes) {
    if (result.removeRouteIds.includes(route.id)) continue;
    const target = planets.find(p => p.id === route.targetId);
    if (target && target.owner === ai.owner && target.power > 12) {
      result.removeRouteIds.push(route.id);
      ai.activeRouteIds.delete(route.id);
    }
  }

  // ---- Phase 2: Recalculate active routes after removals ----

  const activeRoutes = myRoutes.filter(r => !result.removeRouteIds.includes(r.id));

  // Count outgoing routes per source planet
  const routesFromSource = new Map<string, number>();
  for (const r of activeRoutes) {
    routesFromSource.set(r.sourceId, (routesFromSource.get(r.sourceId) || 0) + 1);
  }

  // Track existing targets per source (avoid duplicates)
  const existingTargets = new Map<string, Set<string>>();
  for (const r of activeRoutes) {
    const targets = existingTargets.get(r.sourceId) || new Set();
    targets.add(r.targetId);
    existingTargets.set(r.sourceId, targets);
  }

  // ---- Phase 3: Add new routes from planets with spare capacity ----

  // Sort owned planets by power descending (strongest first get routes)
  const sortedPlanets = [...myPlanets].sort((a, b) => b.power - a.power);

  for (const planet of sortedPlanets) {
    if (planet.power < 2) continue;

    const currentCount = routesFromSource.get(planet.id) || 0;
    const maxRoutes = getMaxRoutesFromPlanet(planet.power);
    if (currentCount >= maxRoutes) continue;

    const targets = existingTargets.get(planet.id) || new Set();

    // Find best target: prefer close non-owned planets with low power
    let bestTarget: PlanetData | null = null;
    let bestScore = Infinity;

    for (const candidate of planets) {
      if (candidate.id === planet.id) continue;
      if (targets.has(candidate.id)) continue;

      const distance = dist(planet, candidate);

      // Check if path passes through a star
      const blockedByStar = stars.length > 0 &&
        isPathBlockedByStar(planet.x, planet.y, planet.z, candidate.x, candidate.y, candidate.z, stars, STAR_KILL_RADIUS);

      let score: number;
      if (blockedByStar) {
        // Heavily penalize routes through stars (AI avoids suicide missions)
        score = 99999;
      } else if (candidate.owner === ai.owner) {
        // Reinforce weak own planets (lower priority than attacking)
        score = distance * 1.5 + candidate.power * 3;
      } else {
        // Attack enemy/neutral planets — prefer close + weak
        score = distance + candidate.power * 1.5;
      }

      if (score < bestScore) {
        bestScore = score;
        bestTarget = candidate;
      }
    }

    if (bestTarget) {
      const route: ShipRoute = {
        id: `route_${++routeCounter}`,
        owner: ai.owner,
        sourceId: planet.id,
        targetId: bestTarget.id,
        sendTimer: 0,
        missileStrength: getMissileStrengthForSize(planet.sizeType),
      };
      result.addRoutes.push(route);
      ai.activeRouteIds.add(route.id);
      routesFromSource.set(planet.id, currentCount + 1);
      targets.add(bestTarget.id);
      existingTargets.set(planet.id, targets);
    }
  }

  return result;
}
