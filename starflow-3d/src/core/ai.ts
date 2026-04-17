// ============================================================
// Star Flow Command — AI Controller
// ============================================================

import {
  type PlanetData, type ShipRoute, type OwnerId, planetPower,
  PLAYER, AI_1, AI_2,
} from './types';
import {
  AI_THINK_INTERVAL, AI_MIN_ATTACK_SHIPS,
  ROUTE_SEND_INTERVAL, ROUTE_FIGHTERS_PER_BATCH, ROUTE_CRUISERS_PER_BATCH,
} from './constants';

export interface AIState {
  owner: OwnerId;
  thinkTimer: number;
  /** Active route IDs */
  activeRouteIds: Set<string>;
}

let routeCounter = 1000;

export function createAIs(count: number): AIState[] {
  const states: AIState[] = [];
  for (let i = 0; i < count; i++) {
    states.push({
      owner: (i + 2) as OwnerId,
      thinkTimer: AI_THINK_INTERVAL * Math.random(),
      activeRouteIds: new Set(),
    });
  }
  return states;
}

/**
 * Update AI: think about creating/canceling routes.
 * Returns route changes: { add, remove }
 */
export function updateAI(
  ai: AIState,
  planets: PlanetData[],
  routes: ShipRoute[],
  dt: number,
): { addRoutes: ShipRoute[]; removeRouteIds: string[] } {
  const result = { addRoutes: [] as ShipRoute[], removeRouteIds: [] as string[] };

  ai.thinkTimer -= dt;
  if (ai.thinkTimer > 0) return result;
  ai.thinkTimer = AI_THINK_INTERVAL + Math.random() * 2;

  const myPlanets = planets.filter(p => p.owner === ai.owner);
  const otherPlanets = planets.filter(p => p.owner !== ai.owner);

  if (myPlanets.length === 0 || otherPlanets.length === 0) return result;

  // My current routes
  const myRoutes = routes.filter(r => r.owner === ai.owner && ai.activeRouteIds.has(r.id));
  const mySources = new Set(myRoutes.map(r => r.sourceId));

  // Find planets with ships but no route
  const idlePlanets = myPlanets.filter(p =>
    planetPower(p) >= AI_MIN_ATTACK_SHIPS && !mySources.has(p.id)
  );

  // Strategy: have up to N active routes
  const maxRoutes = Math.min(myPlanets.length - 1, 3);

  if (myRoutes.length < maxRoutes && idlePlanets.length > 0) {
    // Pick strongest idle planet as source
    const source = [...idlePlanets].sort((a, b) => planetPower(b) - planetPower(a))[0];

    // Pick target: nearest planet with fewest ships (that's not ours)
    const targets = otherPlanets
      .filter(t => t.id !== source.id)
      .sort((a, b) => {
        const dA = dist(a, source);
        const dB = dist(b, source);
        return (dA + planetPower(a) * 2) - (dB + planetPower(b) * 2);
      });

    if (targets.length > 0) {
      const target = targets[0];
      const route: ShipRoute = {
        id: `route_${++routeCounter}`,
        owner: ai.owner,
        sourceId: source.id,
        targetId: target.id,
        sendTimer: 0,
        fightersPerBatch: ROUTE_FIGHTERS_PER_BATCH,
        cruisersPerBatch: ROUTE_CRUISERS_PER_BATCH,
      };
      result.addRoutes.push(route);
      ai.activeRouteIds.add(route.id);
    }
  }

  // Occasionally remove old routes and retarget
  if (myRoutes.length > 0 && Math.random() < 0.2) {
    // Remove route if target already captured
    const captured = myRoutes.find(r => {
      const target = planets.find(p => p.id === r.targetId);
      return target && target.owner === ai.owner;
    });
    if (captured) {
      result.removeRouteIds.push(captured.id);
      ai.activeRouteIds.delete(captured.id);
    }
  }

  return result;
}

function dist(a: PlanetData, b: PlanetData): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}
