// ============================================================
// Рой (Swarm) — Core Types
// Pure data interfaces, no Three.js / DOM dependencies
// ============================================================

/** A single boid (drone) in the swarm */
export interface BoidData {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  alive: boolean;
}

/** The leader (auto-piloted in demo mode) */
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
  pathIndex: number;  // current index on the dense flight path
}

/** A platform with a ring */
export interface PlatformData {
  x: number;
  y: number;
  z: number;
  radius: number;
  ringRadius: number;
  passed: boolean;
}

/** Full game state */
export interface GameState {
  boids: BoidData[];
  leader: LeaderData;
  path: [number, number, number][];
  platforms: PlatformData[];
  aliveCount: number;
  totalCount: number;
  time: number;
  fps: number;
}
