// ============================================================
// Star Flow Command — Game State Manager
// ============================================================

import {
  type GameState, type PlanetData, type FleetData, type OwnerId,
  PLAYER, AI_1, AI_2, NEUTRAL,
} from '../core/types';
import { generateMap, updateProduction, launchFleet, resolveCombat } from '../core/planet';
import { createFleet, updateFleet } from '../core/fleet';
import { type AIState, createAIs, updateAI } from '../core/ai';
import { STREAM_PARTICLE_COUNT } from '../core/constants';

let streamCounter = 0;

/** Create initial game state */
export function createGameState(aiCount: number = 2): GameState {
  return {
    planets: generateMap(aiCount),
    fleets: [],
    streams: [],
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

  // 1. Update planet production
  for (const planet of state.planets) {
    updateProduction(planet, dt);
  }

  // 2. AI thinking
  for (const ai of aiStates) {
    const commands = updateAI(ai, state.planets, dt);
    for (const cmd of commands) {
      const source = state.planets.find(p => p.id === cmd.sourceId);
      const target = state.planets.find(p => p.id === cmd.targetId);
      if (!source || !target) continue;

      const result = launchFleet(source, target.id, target.x, target.z);
      if (result) {
        const fleet = createFleet(
          source.owner,
          result.ships,
          result.sourceId,
          result.targetId,
          source.x, source.y, source.z,
          target.x, target.y, target.z,
        );
        state.fleets.push(fleet);
        createStreamForFleet(state, fleet, source, target);
      }
    }
  }

  // 3. Update fleets
  const arrivedFleets: FleetData[] = [];
  for (const fleet of state.fleets) {
    const source = state.planets.find(p => p.id === fleet.sourceId);
    const target = state.planets.find(p => p.id === fleet.targetId);
    if (!source || !target) continue;

    const arrived = updateFleet(
      fleet,
      source.x, source.y, source.z,
      target.x, target.y, target.z,
      dt,
    );
    if (arrived) {
      arrivedFleets.push(fleet);
    }
  }

  // 4. Resolve fleet arrivals
  for (const fleet of arrivedFleets) {
    const planetIdx = state.planets.findIndex(p => p.id === fleet.targetId);
    if (planetIdx < 0) continue;

    state.planets[planetIdx] = resolveCombat(
      state.planets[planetIdx],
      fleet.ships,
      fleet.owner,
    );
  }

  // Remove arrived fleets
  state.fleets = state.fleets.filter(f => f.progress < 1.0);

  // 5. Update streams
  for (const stream of state.streams) {
    stream.progress += dt / stream.duration;
  }
  state.streams = state.streams.filter(s => s.progress < 1.0);

  // 6. Check win/lose
  checkWinLose(state);
}

/** Create visual stream for a fleet */
function createStreamForFleet(
  state: GameState,
  fleet: FleetData,
  source: PlanetData,
  target: PlanetData,
): void {
  const dx = target.x - source.x;
  const dz = target.z - source.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  // Perpendicular offset for Bezier control point
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
    duration: dist / 15,  // matches fleet speed roughly
  });
}

/** Check win/lose conditions */
function checkWinLose(state: GameState): void {
  const playerPlanets = state.planets.filter(p => p.owner === PLAYER).length;
  const totalPlanets = state.planets.length;

  if (playerPlanets === 0) {
    state.phase = 'lost';
    return;
  }

  if (playerPlanets === totalPlanets) {
    state.phase = 'won';
    return;
  }
}

/** Handle player click: select planet or send fleet */
export function handlePlayerAction(
  state: GameState,
  clickedPlanetId: string,
): void {
  if (state.phase !== 'playing') return;

  if (state.selectedPlanetId === null) {
    // Select source
    const planet = state.planets.find(p => p.id === clickedPlanetId);
    if (!planet || planet.owner !== PLAYER) return;
    if (Math.floor(planet.ships) < 2) return; // need at least 2 ships
    state.selectedPlanetId = clickedPlanetId;
  } else {
    // Send fleet to target
    if (state.selectedPlanetId === clickedPlanetId) {
      // Deselect
      state.selectedPlanetId = null;
      return;
    }

    const source = state.planets.find(p => p.id === state.selectedPlanetId);
    const target = state.planets.find(p => p.id === clickedPlanetId);
    if (!source || !target) {
      state.selectedPlanetId = null;
      return;
    }

    const result = launchFleet(source, target.id, target.x, target.z);
    if (result) {
      const fleet = createFleet(
        source.owner,
        result.ships,
        result.sourceId,
        result.targetId,
        source.x, source.y, source.z,
        target.x, target.y, target.z,
      );
      state.fleets.push(fleet);
      createStreamForFleet(state, fleet, source, target);
    }

    state.selectedPlanetId = null;
  }
}

/** Get stats for HUD */
export function getGameStats(state: GameState): Record<OwnerId, { planets: number; ships: number }> {
  const stats: Record<number, { planets: number; ships: number }> = {};
  const owners: OwnerId[] = [NEUTRAL, PLAYER, AI_1, AI_2];
  for (const owner of owners) {
    const planets = state.planets.filter(p => p.owner === owner);
    stats[owner] = {
      planets: planets.length,
      ships: planets.reduce((s, p) => s + Math.floor(p.ships), 0),
    };
  }
  return stats;
}
