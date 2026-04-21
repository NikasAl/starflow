// ============================================================
// Star Flow Command — Core Types
// Three.js 3D space strategy game
// ============================================================

/** Who owns something: neutral, player, or AI players */
export type OwnerId = 0 | 1 | 2 | 3 | 4;

export const NEUTRAL: OwnerId = 0;
export const PLAYER: OwnerId = 1;
export const AI_1: OwnerId = 2;
export const AI_2: OwnerId = 3;
export const AI_3: OwnerId = 4;

/** Color map for owners */
export const OWNER_COLORS: Record<OwnerId, number> = {
  [NEUTRAL]: 0x888888,
  [PLAYER]:  0x4488ff,
  [AI_1]:    0xff4444,
  [AI_2]:    0x44cc44,
  [AI_3]:    0xffaa00,
};

export const OWNER_NAMES: Record<OwnerId, string> = {
  [NEUTRAL]: 'Neutral',
  [PLAYER]:  'Player',
  [AI_1]:    'Crimson Fleet',
  [AI_2]:    'Emerald Horde',
  [AI_3]:    'Golden Armada',
};

// ============================================================
// Planet Visual Types
// ============================================================

export type PlanetVisualType =
  | 'rocky' | 'terran' | 'gas' | 'ice'
  | 'volcanic' | 'desert' | 'ocean' | 'crystal';

// ============================================================
// Planet Size Types
// ============================================================

export type PlanetSizeType = 'dwarf' | 'small' | 'medium' | 'large' | 'giant' | 'supergiant';

export interface PlanetSizeConfig {
  radius: number;
  missileStrength: 1 | 2;
  /** Power growth rate multiplier */
  growthMultiplier: number;
  /** Neutral planet defense power multiplier */
  defenseMultiplier: number;
  /** Random selection weight (higher = more common) */
  weight: number;
}

// ============================================================
// Level Configuration
// ============================================================

export interface LevelConfig {
  level: number;
  name: string;
  planetCount: number;
  aiCount: number;
  /** Y-axis height variation range */
  heightRange: [number, number];
  worldSize: number;
  /** AI thinking interval in seconds */
  aiThinkInterval: number;
  neutralPowerMin: number;
  neutralPowerMax: number;
  planetMinDistance: number;
}

// ============================================================
// Core Data
// ============================================================

/** Core data for a planet — pure state, no Three.js */
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
  /** Planet size category */
  sizeType: PlanetSizeType;
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
  /** Current level number (1-based) */
  level: number;
  /** Configuration for the current level */
  levelConfig: LevelConfig;
}

/** Camera state */
export interface CameraState {
  targetX: number;
  targetZ: number;
  theta: number;
  phi: number;
  distance: number;
}
