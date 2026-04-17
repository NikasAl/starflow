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
  /** Ships stationed on the planet */
  ships: number;
  /** Max ships the planet can hold */
  maxShips: number;
  /** Base production rate (ships per second) */
  productionRate: number;
  /** Planet size tier 1-3 (small, medium, large) */
  tier: 1 | 2 | 3;
}

/** Data for a fleet moving between planets */
export interface FleetData {
  id: string;
  owner: OwnerId;
  /** How many ships */
  ships: number;
  /** Source planet id */
  sourceId: string;
  /** Target planet id */
  targetId: string;
  /** Movement progress 0..1 */
  progress: number;
  /** Speed in units per second (world-space) */
  speed: number;
  /** Current world position (interpolated) */
  x: number;
  y: number;
  z: number;
}

/** A ship stream visual — collection of particles along a Bezier curve */
export interface StreamData {
  id: string;
  fleetId: string;
  owner: OwnerId;
  /** Source position */
  sx: number; sy: number; sz: number;
  /** Target position */
  tx: number; ty: number; tz: number;
  /** Bezier control point (offset perpendicular) */
  cx: number; cy: number; cz: number;
  /** Life progress 0..1 */
  progress: number;
  /** Total stream duration in seconds */
  duration: number;
}

/** Overall game state */
export interface GameState {
  planets: PlanetData[];
  fleets: FleetData[];
  streams: StreamData[];
  /** Which planet the player has selected (null = none) */
  selectedPlanetId: string | null;
  /** Game phase */
  phase: 'playing' | 'won' | 'lost';
  /** Elapsed game time in seconds */
  time: number;
  /** How many AI opponents */
  aiCount: number;
}

/** Camera state (separate from Three.js camera for clarity) */
export interface CameraState {
  /** Target orbit center (x, z plane) */
  targetX: number;
  targetZ: number;
  /** Orbital angle around Y axis */
  theta: number;
  /** Angle above horizon */
  phi: number;
  /** Distance from target */
  distance: number;
}
