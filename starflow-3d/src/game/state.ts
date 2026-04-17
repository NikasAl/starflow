// ============================================================
// Star Flow Command — Game State Manager
// ============================================================

import {
  type GameState, type PlanetData, type FleetData, type OwnerId,
  type ShipRoute, planetPower,
  PLAYER, AI_1, AI_2, NEUTRAL,
} from '../core/types';
import { generateMap, updateProduction, launchRouteBatch, resolveCombat } from '../core/planet';
import { createFleet, updateFleet } from '../core/fleet';
import { type AIState, createAIs, updateAI } from '../core/ai';
import { ROUTE_SEND_INTERVAL } from '../core/constants';

let streamCounter = 0;
let routeCounter = 0;

export function createGameState(aiCount: number = 2): GameState {
  return {
    planets: generateMap(aiCount),
    fleets: [],
    streams: [],
    routes: [],
    selectedPlanetId: null,
    phase: 'playing',
    time: 0,
    aiCount,
  };
}

/** Main update tick */
export function updateGame(
  state: GameState,
  aiStates: AIState[],
  dt: number,
): void {
  if (state.phase !== 'playing') return;

  state.time += dt;

  // 1. Production
  for (const planet of state.planets) {
    updateProduction(planet, dt);
  }

  // 2. AI thinking — create/remove routes
  for (const ai of aiStates) {
    const { addRoutes, removeRouteIds } = updateAI(ai, state.planets, state.routes, dt);

    // Remove AI routes
    for (const rid of removeRouteIds) {
      state.routes = state.routes.filter(r => r.id !== rid);
    }

    // Add AI routes
    for (const route of addRoutes) {
      state.routes.push(route);
    }
  }

  // 3. Process routes: send batches periodically
  processRoutes(state, dt);

  // 4. Update fleets
  const arrivedFleets: FleetData[] = [];
  for (const fleet of state.fleets) {
    const source = state.planets.find(p => p.id === fleet.sourceId);
    const target = state.planets.find(p => p.id === fleet.targetId);
    if (!source || !target) continue;

    const arrived = updateFleet(fleet, source.x, source.y, source.z, target.x, target.y, target.z, dt);
    if (arrived) arrivedFleets.push(fleet);
  }

  // 5. Resolve arrivals
  for (const fleet of arrivedFleets) {
    const idx = state.planets.findIndex(p => p.id === fleet.targetId);
    if (idx < 0) continue;
    state.planets[idx] = resolveCombat(state.planets[idx], fleet.fighters, fleet.cruisers, fleet.owner);
  }

  state.fleets = state.fleets.filter(f => f.progress < 1.0);

  // 6. Update streams
  for (const stream of state.streams) {
    stream.progress += dt / stream.duration;
  }
  state.streams = state.streams.filter(s => s.progress < 1.0);

  // 7. Clean up routes whose source was lost
  state.routes = state.routes.filter(r => {
    const src = state.planets.find(p => p.id === r.sourceId);
    return src && src.owner === r.owner;
  });

  // 8. Win/lose
  checkWinLose(state);
}

/** Process all active routes — send batches on timer */
function processRoutes(state: GameState, dt: number): void {
  for (const route of state.routes) {
    route.sendTimer -= dt;
    if (route.sendTimer > 0) continue;
    route.sendTimer = ROUTE_SEND_INTERVAL;

    const source = state.planets.find(p => p.id === route.sourceId);
    const target = state.planets.find(p => p.id === route.targetId);
    if (!source || !target) continue;
    if (source.owner !== route.owner) continue;

    const batch = launchRouteBatch(source);
    if (!batch || (batch.fighters === 0 && batch.cruisers === 0)) continue;

    const fleet = createFleet(
      route.owner,
      batch.fighters,
      batch.cruisers,
      route.sourceId,
      route.targetId,
      source.x, source.y, source.z,
      target.x, target.y, target.z,
    );
    state.fleets.push(fleet);
    createStreamForFleet(state, fleet, source, target);
  }
}

function createStreamForFleet(state: GameState, fleet: FleetData, source: PlanetData, target: PlanetData): void {
  const dx = target.x - source.x;
  const dz = target.z - source.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const perpX = -dz / dist * dist * 0.3;
  const perpZ = dx / dist * dist * 0.3;
  const cx = (source.x + target.x) / 2 + perpX;
  const cy = 4;
  const cz = (source.z + target.z) / 2 + perpZ;

  state.streams.push({
    id: `stream_${++streamCounter}`,
    fleetId: fleet.id,
    owner: fleet.owner,
    sx: source.x, sy: source.y, sz: source.z,
    tx: target.x, ty: target.y, tz: target.z,
    cx, cy, cz,
    progress: 0,
    duration: dist / 15,
  });
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
 * Click on same planet: remove its routes.
 * Click empty space: deselect.
 */
export function handlePlayerAction(
  state: GameState,
  clickedPlanetId: string,
): { routeAdded: ShipRoute | null; routeRemoved: string[] } {
  const result: { routeAdded: ShipRoute | null; routeRemoved: string[] } = {
    routeAdded: null,
    routeRemoved: [],
  };

  if (state.phase !== 'playing') return result;

  if (state.selectedPlanetId === null) {
    // Select source
    const planet = state.planets.find(p => p.id === clickedPlanetId);
    if (!planet || planet.owner !== PLAYER) return result;
    if (!planetHasShips(planet)) return result;
    state.selectedPlanetId = clickedPlanetId;
  } else if (state.selectedPlanetId === clickedPlanetId) {
    // Clicked same planet — toggle: remove its routes and deselect
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

    // Check if route already exists
    const existing = state.routes.find(r =>
      r.sourceId === source.id && r.targetId === target.id && r.owner === PLAYER
    );
    if (existing) {
      // Route exists — remove it
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
        fightersPerBatch: 3,
        cruisersPerBatch: 1,
      };
      state.routes.push(route);
      result.routeAdded = route;
    }
    state.selectedPlanetId = null;
  }

  return result;
}

function planetHasShips(p: PlanetData): boolean {
  return p.fighters > 0 || p.cruisers > 0;
}

/** Get stats for HUD */
export function getGameStats(state: GameState): Record<OwnerId, { planets: number; fighters: number; cruisers: number }> {
  const stats: Record<number, { planets: number; fighters: number; cruisers: number }> = {};
  const owners: OwnerId[] = [NEUTRAL, PLAYER, AI_1, AI_2];
  for (const owner of owners) {
    const planets = state.planets.filter(p => p.owner === owner);
    stats[owner] = {
      planets: planets.length,
      fighters: planets.reduce((s, p) => s + Math.floor(p.fighters), 0),
      cruisers: planets.reduce((s, p) => s + Math.floor(p.cruisers), 0),
    };
  }
  return stats;
}
