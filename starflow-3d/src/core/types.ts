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
  /** Fighter count (weight 1 each) */
  fighters: number;
  /** Cruiser count (weight 2 each) */
  cruisers: number;
  /** Max total ship weight */
  maxShips: number;
  /** Fighter production rate (fighters per second) */
  fighterProduction: number;
  /** Cruiser production rate (cruisers per second) */
  cruiserProduction: number;
  /** Planet size tier 1-3 (small, medium, large) */
  tier: 1 | 2 | 3;
}

/** Helper: total attack power of a planet */
export function planetPower(p: PlanetData): number {
  return p.fighters + p.cruisers * 2;
}

/** Helper: total weight on a planet */
export function planetWeight(p: PlanetData): number {
  return p.fighters + p.cruisers * 2;
}

/** Helper: check if planet has any ships */
export function planetHasShips(p: PlanetData): boolean {
  return p.fighters > 0 || p.cruisers > 0;
}

/** Data for a fleet moving between planets */
export interface FleetData {
  id: string;
  owner: OwnerId;
  /** Fighter count */
  fighters: number;
  /** Cruiser count */
  cruisers: number;
  /** Total weight for combat */
  get power(): number;
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
  sx: number; sy: number; sz: number;
  tx: number; ty: number; tz: number;
  cx: number; cy: number; cz: number;
  progress: number;
  duration: number;
}

/** A persistent route between two planets — ships sent periodically */
export interface ShipRoute {
  id: string;
  owner: OwnerId;
  sourceId: string;
  targetId: string;
  /** Seconds until next batch */
  sendTimer: number;
  /** How many fighters per batch */
  fightersPerBatch: number;
  /** How many cruisers per batch */
  cruisersPerBatch: number;
}

/** Overall game state */
export interface GameState {
  planets: PlanetData[];
  fleets: FleetData[];
  streams: StreamData[];
  /** Persistent ship routes */
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
