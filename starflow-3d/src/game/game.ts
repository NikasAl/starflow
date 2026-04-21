// ============================================================
// Star Flow Command — Main Game Class
// Level management, scene reset, transitions, save/load
// ============================================================

import { type GameState } from '../core/types';
import { type AIState } from '../core/ai';
import { createGameState, updateGame, handlePlayerAction, createAIStatesForLevel, getRouteCounter, setRouteCounter } from '../game/state';
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
  setRestartLevelCallback,
  removeOverlay,
  dispose,
  addStar,
  addExplosion,
  recreateMenuButton,
} from '../rendering/renderer';
import { saveGame, loadGame, clearSave, type SaveData } from '../core/save';

const knownMissiles = new Set<string>();
const knownRoutes = new Set<string>();

let gameState: GameState;
let aiStates: AIState[];
let currentLevel = 1;
let running = false;
let lastTime = 0;
let autoSaveTimer = 0;

/** Callback to notify main.ts that game was saved */
let onGameSaved: (() => void) | null = null;

export function startGame(canvas: HTMLCanvasElement, level: number = 1): void {
  currentLevel = level;
  gameState = createGameState(currentLevel);
  aiStates = createAIStatesForLevel(gameState.levelConfig);

  initGameScene(canvas);

  // Save immediately so Continue works from start
  saveGame(gameState, aiStates);
  if (onGameSaved) onGameSaved();
}

/** Start game from a save file */
export function startGameFromSave(canvas: HTMLCanvasElement, save: SaveData): void {
  gameState = save.gameState;
  currentLevel = gameState.level;

  // Restore route counter to avoid ID collisions
  setRouteCounter(save.routeCounter);

  // Restore AI states from serialized data
  aiStates = save.aiStates.map(s => ({
    owner: s.owner as AIState['owner'],
    thinkTimer: s.thinkTimer,
    thinkInterval: s.thinkInterval,
    activeRouteIds: new Set(s.activeRouteIds),
  }));

  initGameScene(canvas);
}

function initGameScene(canvas: HTMLCanvasElement): void {
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
    // Retry same level (from overlay)
    goToLevel(currentLevel);
  });

  setRestartLevelCallback(() => {
    // Restart from menu button (during gameplay)
    goToLevel(currentLevel);
  });

  running = true;
  autoSaveTimer = 0;
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

  // Recreate menu button (removed by resetScene)
  recreateMenuButton();

  // Save on level change
  saveGame(gameState, aiStates);
  if (onGameSaved) onGameSaved();

  // Restart loop
  running = true;
  autoSaveTimer = 0;
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

    // Auto-save every 15 seconds during gameplay
    autoSaveTimer += dt;
    if (autoSaveTimer >= 15) {
      autoSaveTimer = 0;
      saveGame(gameState, aiStates);
    }
  } else {
    // Save on win/lose
    saveGame(gameState, aiStates);
  }

  syncVisuals(gameState, now / 1000, dt);
  requestAnimationFrame(gameLoop);
}

export function stopGame(): void {
  running = false;
  dispose();
}

/** Set callback for when game is saved (used to update Continue button) */
export function setOnGameSaved(cb: () => void): void {
  onGameSaved = cb;
}
