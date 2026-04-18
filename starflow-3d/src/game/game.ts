// ============================================================
// Star Flow Command — Main Game Class
// ============================================================

import { type GameState } from '../core/types';
import { createGameState, updateGame, handlePlayerAction } from '../game/state';
import { type AIState, createAIs } from '../core/ai';
import {
  initRenderer,
  addPlanet,
  addMissile,
  removeMissile,
  addRouteLine,
  removeRouteLine,
  updateSelection,
  syncVisuals,
  setPlanetClickCallback,
  dispose,
} from '../rendering/renderer';

const knownMissiles = new Set<string>();
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

  updateGame(gameState, aiStates, dt);

  // Sync new missiles
  for (const missile of gameState.missiles) {
    if (!knownMissiles.has(missile.id)) {
      addMissile(missile);
      knownMissiles.add(missile.id);
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

  // Clean up arrived missiles
  for (const mid of knownMissiles) {
    if (!gameState.missiles.find(m => m.id === mid)) {
      removeMissile(mid);
      knownMissiles.delete(mid);
    }
  }

  syncVisuals(gameState, now / 1000);
  requestAnimationFrame(gameLoop);
}

export function stopGame(): void {
  running = false;
  dispose();
}
