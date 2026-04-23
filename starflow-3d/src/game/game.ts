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
  setBoostActivateCallback,
  setWatchAdCallback,
  removeOverlay,
  dispose,
  addStar,
  addExplosion,
  recreateMenuButton,
} from '../rendering/renderer';
import { saveGame, loadGame, clearSave, type SaveData } from '../core/save';
import { audioManager, SFX, MUSIC } from '../audio';
import { activateBoost, grantEnergy } from '../core/boosts';
import { adManager } from '../ads/ad-manager';

const knownMissiles = new Set<string>();
const knownRoutes = new Set<string>();

let gameState: GameState;
let aiStates: AIState[];
let currentLevel = 1;
let running = false;
let lastTime = 0;
let autoSaveTimer = 0;

// ── Battle music system ──────────────────────────────────
let activeMissileCount = 0;
let battleMusicCooldown = 0;   // seconds since battle ended before switching back
let isBattleMusic = false;
let endMusicStarted = false;    // one-shot: menu music on win/lose
const BATTLE_MISSILE_THRESHOLD = 6;   // missiles in flight to trigger battle
const BATTLE_FADE_BACK_DELAY = 8;     // seconds of calm before switching back

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
      audioManager.play(SFX.ROUTE_DISCONNECT);
    }

    if (result.routeAdded) {
      addRouteLine(result.routeAdded);
      knownRoutes.add(result.routeAdded.id);
      audioManager.play(SFX.ROUTE_CREATE);
    }

    // Play planet select sound when a planet is newly selected
    if (gameState.selectedPlanetId && !result.routeAdded && result.routeRemoved.length === 0) {
      audioManager.play(SFX.PLANET_SELECT);
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

  // Register callback to restart music after unmute
  audioManager.setOnUnmute(() => {
    if (gameState.phase !== 'playing') {
      audioManager.playMusic(MUSIC.MENU_THEME, { fadeIn: 1.0 });
    } else if (isBattleMusic) {
      audioManager.playMusic(MUSIC.BATTLE_INTENSE, { fadeIn: 1.0 });
    } else {
      audioManager.playMusic(MUSIC.AMBIENT_SPACE, { fadeIn: 1.0 });
    }
  });

  // Wire boost activation from HUD buttons
  setBoostActivateCallback((type: string, planetId: string) => {
    const err = activateBoost(gameState, type as any, planetId);
    if (!err) {
      audioManager.play(SFX.UI_CLICK);
    }
  });

  // Wire watch-ad button in HUD
  setWatchAdCallback(async () => {
    const granted = await adManager.showRewardedAd();
    if (granted) {
      grantEnergy(gameState);
      audioManager.play(SFX.UI_CLICK);
    }
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

  // Reset battle music state on level change
  isBattleMusic = false;
  battleMusicCooldown = 0;
  endMusicStarted = false;
  audioManager.playMusic(MUSIC.AMBIENT_SPACE, { fadeIn: 1.0 });

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

    // ── SFX events from game logic ───────────────────────
    // Planet captures (arrival that changes ownership)
    for (const arrival of updateResult.missileArrivals) {
      if (arrival.captured) {
        audioManager.play(SFX.PLANET_CAPTURE);
      }
    }

    // Gravity well entry
    for (const gw of updateResult.gravityWellHits) {
      audioManager.play(SFX.GRAVITY_WELL);
    }

    // Star danger alerts
    for (const sd of updateResult.starDangerAlerts) {
      audioManager.play(SFX.STAR_DANGER);
    }

    // ── Battle music switching ───────────────────────────
    activeMissileCount = gameState.missiles.length;
    if (activeMissileCount >= BATTLE_MISSILE_THRESHOLD && !isBattleMusic) {
      isBattleMusic = true;
      battleMusicCooldown = 0;
      audioManager.playMusic(MUSIC.BATTLE_INTENSE, { fadeIn: 1.5 });
    } else if (activeMissileCount < BATTLE_MISSILE_THRESHOLD && isBattleMusic) {
      battleMusicCooldown += dt;
      if (battleMusicCooldown >= BATTLE_FADE_BACK_DELAY) {
        isBattleMusic = false;
        audioManager.playMusic(MUSIC.AMBIENT_SPACE, { fadeIn: 2.0 });
      }
    } else if (activeMissileCount >= BATTLE_MISSILE_THRESHOLD) {
      battleMusicCooldown = 0; // reset cooldown while battle still active
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
    // Save once + switch to menu music on win/lose (one-shot)
    saveGame(gameState, aiStates);
    if (!endMusicStarted) {
      endMusicStarted = true;
      audioManager.playMusic(MUSIC.MENU_THEME, { fadeIn: 1.0 });
    }
  }

  syncVisuals(gameState, now / 1000, dt);
  requestAnimationFrame(gameLoop);
}

export function stopGame(): void {
  running = false;
  audioManager.setOnUnmute(null);
  dispose();
}

/** Set callback for when game is saved (used to update Continue button) */
export function setOnGameSaved(cb: () => void): void {
  onGameSaved = cb;
}
