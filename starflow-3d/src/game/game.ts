// ============================================================
// Star Flow Command — Main Game Class
// Level management, scene reset, transitions
// ============================================================

import { type GameState } from '../core/types';
import { createGameState, updateGame, handlePlayerAction, createAIStatesForLevel } from '../game/state';
import { type AIState } from '../core/ai';
import {
  initRenderer,
  addPlanet,
  addMissile,
  removeMissile,
  addRouteLine,
  removeRouteLine,
  updateSelection,
  syncVisuals,
  resetScene,
  setPlanetClickCallback,
  setLevelCompleteCallback,
  setGameOverCallback,
  removeOverlay,
  dispose,
  addStar,
  addExplosion,
} from '../rendering/renderer';

const knownMissiles = new Set<string>();
const knownRoutes = new Set<string>();

let gameState: GameState;
let aiStates: AIState[];
let currentLevel = 1;
let running = false;
let lastTime = 0;

export function startGame(canvas: HTMLCanvasElement, level: number = 1): void {
  currentLevel = level;
  gameState = createGameState(currentLevel);
  aiStates = createAIStatesForLevel(gameState.levelConfig);

  initRenderer(canvas);

  for (const star of gameState.stars) {
    addStar(star);
  }

  for (const planet of gameState.planets) {
    addPlanet(planet);
  }

  setPlanetClickCallback((planetId: string) => {
    const result = handlePlayerAction(gameState, planetId);

    for (const rid of result.routeRemoved) {
      removeRouteLine(rid);
      knownRoutes.delete(rid);
    }

    if (result.routeAdded) {
      addRouteLine(result.routeAdded);
      knownRoutes.add(result.routeAdded.id);
    }

    updateSelection(gameState.selectedPlanetId);
  });

  setLevelCompleteCallback(() => {
    // Advance to next level
    goToLevel(currentLevel + 1);
  });

  setGameOverCallback(() => {
    // Retry same level
    goToLevel(currentLevel);
  });

  running = true;
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function goToLevel(level: number): void {
  running = false;

  // Clear tracking sets
  knownMissiles.clear();
  knownRoutes.clear();

  // Reset Three.js scene (removes all game objects)
  resetScene();

  // Create new game state
  currentLevel = level;
  gameState = createGameState(currentLevel);
  aiStates = createAIStatesForLevel(gameState.levelConfig);

  // Add new stars
  for (const star of gameState.stars) {
    addStar(star);
  }

  // Add new planets
  for (const planet of gameState.planets) {
    addPlanet(planet);
  }

  // Restart loop
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function gameLoop(now: number): void {
  if (!running) return;

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  // Stop updating on win/lose (but keep rendering for overlays)
  if (gameState.phase === 'playing') {
    const updateResult = updateGame(gameState, aiStates, dt);

    // Handle destroyed missiles (star collisions / interceptions)
    for (const mid of updateResult.destroyedMissileIds) {
      removeMissile(mid);
      knownMissiles.delete(mid);
    }

    // Spawn explosions
    for (const exp of updateResult.explosions) {
      addExplosion(exp.x, exp.y, exp.z);
    }

    // Sync new missiles
    for (const missile of gameState.missiles) {
      if (!knownMissiles.has(missile.id)) {
        addMissile(missile);
        knownMissiles.add(missile.id);
      }
    }

    // Sync route lines
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
  }

  syncVisuals(gameState, now / 1000, dt);
  requestAnimationFrame(gameLoop);
}

export function stopGame(): void {
  running = false;
  dispose();
}
