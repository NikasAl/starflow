// ============================================================
// Star Flow Command — Core Types
// Three.js 3D space strategy game
// ============================================================

/** Who owns something: neutral, player, or AI players */
export type OwnerId = 0 | 1 | 2 | 3;

export const NEUTRAL: OwnerId = 0;
export const PLAYER: OwnerId = 1;
export const AI_1: OwnerId = 2;
export const AI_2: OwnerId = 3;

/** Color map for owners */
export const OWNER_COLORS: Record<OwnerId, number> = {
  [NEUTRAL]: 0x888888,
  [PLAYER]:  0x4488ff,
  [AI_1]:    0xff4444,
  [AI_2]:    0x44cc44,
};

export const OWNER_NAMES: Record<OwnerId, string> = {
  [NEUTRAL]: 'Neutral',
  [PLAYER]:  'Player',
  [AI_1]:    'Crimson Fleet',
  [AI_2]:    'Emerald Horde',
};

/** Core data for a planet — pure state, no Three.js */
import { type PlanetVisualType } from './texture-gen';

export interface PlanetData {
  id: string;
  name: string;
  /** World-space position */
  x: number;
  y: number;
  z: number;
  /** Visual radius of the planet sphere */
  radius: number;
  /** Current owner */
  owner: OwnerId;
  /** Planet power (single value, replaces fighters/cruisers) */
  power: number;
  /** Planet size tier 1-3 (small, medium, large) */
  tier: 1 | 2 | 3;
  /** Procedural visual type for texture generation */
  visualType: PlanetVisualType;
  /** Seed for deterministic texture generation */
  textureSeed: number;
}

/** A missile flying between planets */
export interface MissileData {
  id: string;
  owner: OwnerId;
  /** Missile strength: 1 or 2 */
  strength: 1 | 2;
  /** Source planet id */
  sourceId: string;
  /** Target planet id */
  targetId: string;
  /** Movement progress 0..1 */
  progress: number;
  /** Speed in world units per second */
  speed: number;
  /** Current world position */
  x: number;
  y: number;
  z: number;
}

/** A persistent route between two planets — missiles sent periodically */
export interface ShipRoute {
  id: string;
  owner: OwnerId;
  sourceId: string;
  targetId: string;
  /** Seconds until next missile */
  sendTimer: number;
  /** Missile strength for this route */
  missileStrength: 1 | 2;
}

/** Overall game state */
export interface GameState {
  planets: PlanetData[];
  missiles: MissileData[];
  /** Persistent missile routes */
  routes: ShipRoute[];
  /** Which planet the player is selecting as source (null = none) */
  selectedPlanetId: string | null;
  /** Game phase */
  phase: 'playing' | 'won' | 'lost';
  /** Elapsed game time in seconds */
  time: number;
  /** How many AI opponents */
  aiCount: number;
}

/** Camera state */
export interface CameraState {
  targetX: number;
  targetZ: number;
  theta: number;
  phi: number;
  distance: number;
}
