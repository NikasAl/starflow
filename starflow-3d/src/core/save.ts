// ============================================================
// Star Flow Command — Save/Load System
// Uses localStorage for persistence
// ============================================================

import {
  type GameState, type ActiveBoost,
} from './types';
import { type AIState } from './ai';
import { getRouteCounter, setRouteCounter } from '../game/state';
import { ENERGY_START } from '../core/constants';

const SAVE_KEY = 'starflow_save';
const SAVE_VERSION = 2;

/** Serializable save data */
export interface SaveData {
  version: number;
  gameState: GameState;
  aiStates: Array<{
    owner: number;
    thinkTimer: number;
    thinkInterval: number;
    activeRouteIds: string[];
  }>;
  routeCounter: number;
  savedAt: number;
}

/** Save game state to localStorage */
export function saveGame(
  state: GameState,
  aiStates: AIState[],
): void {
  try {
    const data: SaveData = {
      version: SAVE_VERSION,
      gameState: { ...state },
      aiStates: aiStates.map(ai => ({
        owner: ai.owner as number,
        thinkTimer: ai.thinkTimer,
        thinkInterval: ai.thinkInterval,
        activeRouteIds: Array.from(ai.activeRouteIds),
      })),
      routeCounter: getRouteCounter(),
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save game:', e);
  }
}

/** Load game state from localStorage. Returns null if no save exists. */
export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;

    const data: SaveData = JSON.parse(raw);

    // Migrate v1 saves (pre-energy/boosts)
    if (data.version === 1) {
      data.gameState.energy = ENERGY_START;
      data.gameState.activeBoosts = [];
      data.version = SAVE_VERSION;
    }

    if (data.version !== SAVE_VERSION) {
      console.warn('Save version mismatch, clearing save');
      clearSave();
      return null;
    }

    return data;
  } catch (e) {
    console.warn('Failed to load game:', e);
    clearSave();
    return null;
  }
}

/** Check if a save exists */
export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

/** Remove saved game */
export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch { /* ignore */ }
}

/** Get formatted info about the saved game for the Continue button */
export function getSaveInfo(): { level: number; name: string; time: string } | null {
  const data = loadGame();
  if (!data) return null;

  const s = data.gameState;
  const minutes = Math.floor(s.time / 60);
  const seconds = Math.floor(s.time % 60);
  return {
    level: s.level,
    name: s.levelConfig?.name || '',
    time: `${minutes}:${String(seconds).padStart(2, '0')}`,
  };
}
