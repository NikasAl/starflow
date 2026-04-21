// ============================================================
// Star Flow Command — Game State Manager
// ============================================================

import {
  type GameState, type PlanetData, type MissileData, type OwnerId,
  type ShipRoute, type StarData,
  PLAYER, NEUTRAL,
} from '../core/types';
import { generateMap, updatePlanetGrowth, resolveMissileArrival } from '../core/planet';
import { generateStars, checkStarCollision } from '../core/star';
import { createMissile, updateMissile } from '../core/fleet';
import { type AIState, createAIs, updateAI } from '../core/ai';
import {
  ROUTE_SEND_INTERVAL,
  getMaxRoutesFromPlanet,
  getMissileStrengthForSize,
  getLevelConfig,
  STAR_KILL_RADIUS,
  MISSILE_INTERCEPT_DISTANCE,
} from '../core/constants';

let routeCounter = 0;

/** Create game state for a specific level */
export function createGameState(level: number = 1): GameState {
  const levelConfig = getLevelConfig(level);
  const planets = generateMap(levelConfig);
  const stars = generateStars(levelConfig, planets);
  return {
    planets,
    stars,
    missiles: [],
    routes: [],
    selectedPlanetId: null,
    phase: 'playing',
    time: 0,
    level,
    levelConfig,
  };
}

/** Create AI states matching the level config */
export function createAIStatesForLevel(levelConfig: { aiCount: number; aiThinkInterval: number }): AIState[] {
  return createAIs(levelConfig.aiCount, levelConfig.aiThinkInterval);
}

/** Main update tick */
export function updateGame(
  state: GameState,
  aiStates: AIState[],
  dt: number,
): { destroyedMissileIds: string[]; explosions: Array<{ x: number; y: number; z: number }> } {
  const result = { destroyedMissileIds: [] as string[], explosions: [] as Array<{ x: number; y: number; z: number }> };

  if (state.phase !== 'playing') return result;

  state.time += dt;

  // 1. Planet power growth (auto-grow up to max)
  for (const planet of state.planets) {
    updatePlanetGrowth(planet, dt);
  }

  // 2. AI thinking — create/remove routes
  for (const ai of aiStates) {
    const { addRoutes, removeRouteIds } = updateAI(ai, state.planets, state.routes, state.stars, dt);

    // Remove AI routes
    for (const rid of removeRouteIds) {
      state.routes = state.routes.filter(r => r.id !== rid);
    }

    // Add AI routes
    for (const route of addRoutes) {
      state.routes.push(route);
    }
  }

  // 3. Process routes: send missiles periodically
  processRoutes(state, dt);

  // 4. Update missiles (with gravity wells)
  const arrivedMissiles: MissileData[] = [];
  for (const missile of state.missiles) {
    const source = state.planets.find(p => p.id === missile.sourceId);
    const target = state.planets.find(p => p.id === missile.targetId);
    if (!source || !target) continue;

    const arrived = updateMissile(missile, source.x, source.y, source.z, target.x, target.y, target.z, dt, state.planets);
    if (arrived) arrivedMissiles.push(missile);
  }

  // 5. Check star collisions — missiles destroyed by stars
  const starKilled: Set<string> = new Set();
  for (const missile of state.missiles) {
    if (arrivedMissiles.includes(missile)) continue;
    const hitStar = checkStarCollision(missile.x, missile.y, missile.z, state.stars, STAR_KILL_RADIUS);
    if (hitStar) {
      starKilled.add(missile.id);
      result.destroyedMissileIds.push(missile.id);
      result.explosions.push({ x: missile.x, y: missile.y, z: missile.z });
    }
  }

  // 6. Missile interception — enemy missiles collide mid-flight
  const intercepted: Set<string> = new Set();
  for (let i = 0; i < state.missiles.length; i++) {
    const a = state.missiles[i];
    if (starKilled.has(a.id) || arrivedMissiles.includes(a)) continue;

    for (let j = i + 1; j < state.missiles.length; j++) {
      const b = state.missiles[j];
      if (starKilled.has(b.id) || arrivedMissiles.includes(b)) continue;
      // Only intercept if different owners
      if (a.owner === b.owner) continue;

      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dz = a.z - b.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < MISSILE_INTERCEPT_DISTANCE) {
        // Both destroyed regardless of strength (mutual annihilation)
        intercepted.add(a.id);
        intercepted.add(b.id);
        result.destroyedMissileIds.push(a.id, b.id);
        result.explosions.push(
          { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 },
        );
        break; // a is destroyed, stop checking it
      }
    }
  }

  // 7. Resolve arrivals
  for (const missile of arrivedMissiles) {
    if (starKilled.has(missile.id) || intercepted.has(missile.id)) continue;
    const idx = state.planets.findIndex(p => p.id === missile.targetId);
    if (idx < 0) continue;
    state.planets[idx] = resolveMissileArrival(
      state.planets[idx], missile.strength, missile.owner
    );
  }

  // 8. Clean up dead missiles
  state.missiles = state.missiles.filter(m =>
    m.progress < 1.0 && !starKilled.has(m.id) && !intercepted.has(m.id)
  );

  // 9. Clean up routes whose source was lost
  state.routes = state.routes.filter(r => {
    const src = state.planets.find(p => p.id === r.sourceId);
    return src && src.owner === r.owner;
  });

  // 10. Win/lose
  checkWinLose(state);

  return result;
}

/** Process all active routes — send missiles on timer */
function processRoutes(state: GameState, dt: number): void {
  for (const route of state.routes) {
    route.sendTimer -= dt;
    if (route.sendTimer > 0) continue;
    route.sendTimer = ROUTE_SEND_INTERVAL;

    const source = state.planets.find(p => p.id === route.sourceId);
    const target = state.planets.find(p => p.id === route.targetId);
    if (!source || !target) continue;
    if (source.owner !== route.owner) continue;

    const missile = createMissile(
      route.owner,
      route.missileStrength,
      route.sourceId,
      route.targetId,
      source.x, source.y, source.z,
      target.x, target.y, target.z,
    );
    state.missiles.push(missile);
  }
}

function checkWinLose(state: GameState): void {
  const playerPlanets = state.planets.filter(p => p.owner === PLAYER).length;
  if (playerPlanets === 0) { state.phase = 'lost'; return; }
  if (playerPlanets === state.planets.length) { state.phase = 'won'; return; }
}

/**
 * Handle player click.
 * First click: select source planet.
 * Second click on another planet: create a persistent route.
 * Click on same planet: remove its routes and deselect.
 * Click empty space: deselect.
 */
export function handlePlayerAction(
  state: GameState,
  clickedPlanetId: string,
): { routeAdded: ShipRoute | null; routeRemoved: string[]; errorMsg: string | null } {
  const result: { routeAdded: ShipRoute | null; routeRemoved: string[]; errorMsg: string | null } = {
    routeAdded: null,
    routeRemoved: [],
    errorMsg: null,
  };

  if (state.phase !== 'playing') return result;

  if (clickedPlanetId === '__deselect__') {
    state.selectedPlanetId = null;
    return result;
  }

  if (state.selectedPlanetId === null) {
    // Select source
    const planet = state.planets.find(p => p.id === clickedPlanetId);
    if (!planet || planet.owner !== PLAYER) return result;
    if (planet.power < 1) return result;
    state.selectedPlanetId = clickedPlanetId;
  } else if (state.selectedPlanetId === clickedPlanetId) {
    // Clicked same planet — remove its routes and deselect
    const removed = state.routes.filter(r => r.sourceId === clickedPlanetId && r.owner === PLAYER);
    result.routeRemoved = removed.map(r => r.id);
    state.routes = state.routes.filter(r => !(r.sourceId === clickedPlanetId && r.owner === PLAYER));
    state.selectedPlanetId = null;
  } else {
    // Clicked different planet — create route
    const source = state.planets.find(p => p.id === state.selectedPlanetId);
    const target = state.planets.find(p => p.id === clickedPlanetId);
    if (!source || !target) {
      state.selectedPlanetId = null;
      return result;
    }

    // Check max routes from source planet
    const currentRoutes = state.routes.filter(r =>
      r.sourceId === source.id && r.owner === PLAYER
    ).length;
    const maxRoutes = getMaxRoutesFromPlanet(source.power);

    if (currentRoutes >= maxRoutes) {
      result.errorMsg = `Max ${maxRoutes} route(s) for power ${Math.floor(source.power)}`;
      state.selectedPlanetId = null;
      return result;
    }

    // Check if route already exists
    const existing = state.routes.find(r =>
      r.sourceId === source.id && r.targetId === target.id && r.owner === PLAYER
    );

    if (existing) {
      // Route exists — remove it (toggle)
      result.routeRemoved = [existing.id];
      state.routes = state.routes.filter(r => r.id !== existing.id);
    } else {
      // Create new route
      const route: ShipRoute = {
        id: `route_${++routeCounter}`,
        owner: PLAYER,
        sourceId: source.id,
        targetId: target.id,
        sendTimer: 0, // send immediately
        missileStrength: getMissileStrengthForSize(source.sizeType),
      };
      state.routes.push(route);
      result.routeAdded = route;
    }
    state.selectedPlanetId = null;
  }

  return result;
}

/** Get stats for HUD */
export function getGameStats(state: GameState): Record<OwnerId, { planets: number; power: number }> {
  const stats: Record<number, { planets: number; power: number }> = {};
  const owners: OwnerId[] = [0, 1, 2, 3, 4] as OwnerId[];
  for (const owner of owners) {
    const planets = state.planets.filter(p => p.owner === owner);
    if (planets.length === 0) continue;
    stats[owner] = {
      planets: planets.length,
      power: planets.reduce((s, p) => s + Math.floor(p.power), 0),
    };
  }
  return stats;
}
