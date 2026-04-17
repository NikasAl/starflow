// ============================================================
// Star Flow Command — Main Game Class
// ============================================================

import { type GameState } from '../core/types';
import { createGameState, updateGame, handlePlayerAction } from '../game/state';
import { type AIState, createAIs } from '../core/ai';
import {
  initRenderer,
  addPlanet,
  addFleet,
  removeFleet,
  addStream,
  removeStream,
  addRouteLine,
  removeRouteLine,
  updateSelection,
  syncVisuals,
  setPlanetClickCallback,
  dispose,
} from '../rendering/renderer';

const knownFleets = new Set<string>();
const knownStreams = new Set<string>();
const knownRoutes = new Set<string>();

let gameState: GameState;
let aiStates: AIState[];
let running = false;
let lastTime = 0;

export function startGame(canvas: HTMLCanvasElement): void {
  gameState = createGameState(2);
  aiStates = createAIs(2);

  initRenderer(canvas);

  for (const planet of gameState.planets) {
    addPlanet(planet);
  }

  setPlanetClickCallback((planetId: string) => {
    if (planetId === '__deselect__') {
      gameState.selectedPlanetId = null;
      updateSelection(null);
      return;
    }

    const result = handlePlayerAction(gameState, planetId);

    // Handle route removals from renderer
    for (const rid of result.routeRemoved) {
      removeRouteLine(rid);
      knownRoutes.delete(rid);
    }

    // Handle route addition
    if (result.routeAdded) {
      addRouteLine(result.routeAdded);
      knownRoutes.add(result.routeAdded.id);
    }

    updateSelection(gameState.selectedPlanetId);
  });

  running = true;
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function gameLoop(now: number): void {
  if (!running) return;

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  // Snapshot routes before update (to detect AI route changes)
  const prevRouteIds = new Set(gameState.routes.map(r => r.id));

  updateGame(gameState, aiStates, dt);

  // Sync new fleets
  for (const fleet of gameState.fleets) {
    if (!knownFleets.has(fleet.id)) {
      addFleet(fleet);
      knownFleets.add(fleet.id);
    }
  }

  // Sync new streams
  for (const stream of gameState.streams) {
    if (!knownStreams.has(stream.id)) {
      addStream(stream);
      knownStreams.add(stream.id);
    }
  }

  // Sync route lines (AI may have added/removed routes)
  for (const route of gameState.routes) {
    if (!knownRoutes.has(route.id)) {
      addRouteLine(route);
      knownRoutes.add(route.id);
    }
  }
  for (const rid of knownRoutes) {
    if (!gameState.routes.find(r => r.id === rid)) {
      removeRouteLine(rid);
      knownRoutes.delete(rid);
    }
  }

  // Clean up arrived fleets
  for (const fid of knownFleets) {
    if (!gameState.fleets.find(f => f.id === fid)) {
      removeFleet(fid);
      knownFleets.delete(fid);
    }
  }

  // Clean up finished streams
  for (const sid of knownStreams) {
    if (!gameState.streams.find(s => s.id === sid)) {
      removeStream(sid);
      knownStreams.delete(sid);
    }
  }

  syncVisuals(gameState, now / 1000);
  requestAnimationFrame(gameLoop);
}

export function stopGame(): void {
  running = false;
  dispose();
}
