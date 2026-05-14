// ============================================================
// Рой — Собиратель (Swarm: Collector) — Core Types
// Pure data interfaces, no Three.js / DOM dependencies
// ============================================================

/** Boid color types */
export type BoidType = 'neutron' | 'ion' | 'photon' | 'electron' | 'quark';

/** Boid lifecycle state */
export type BoidState = 'free' | 'collected' | 'passed';

/** A single boid (drone) in the swarm */
export interface BoidData {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  alive: boolean;
  type: BoidType;
  state: BoidState;
  freeWanderAngle: number;
}

/** The player-controlled leader */
export interface LeaderData {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  boostCooldown: number;
  boostActive: number;
}

/** Portal that boids pass through for scoring */
export interface PortalData {
  x: number;
  y: number;
  z: number;
  radius: number;
  rotation: number;
}

/** Level configuration */
export interface LevelConfig {
  name: string;
  totalBoids: number;
  startBoids: number;
  obstacles: number;
  hazards: number;
  timeLimit: number;
  worldSize: number;
  portalPosition: [number, number, number];
  /** Waypoints defining the flight route ([x,y,z] ...). Boids spawn along this route. */
  routeWaypoints?: [number, number, number][];
}

/** A buoy marker along the route */
export interface BuoyData {
  x: number;
  y: number;
  z: number;
}

/** Full game state */
export interface GameState {
  boids: BoidData[];
  leader: LeaderData;
  portal: PortalData;
  level: LevelConfig;
  buoys: BuoyData[];
  collectedCount: number;
  passedCount: number;
  score: number;
  timeRemaining: number;
  phase: 'playing' | 'won' | 'lost';
  time: number;
  fps: number;
}
