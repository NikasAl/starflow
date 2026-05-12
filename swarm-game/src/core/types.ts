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

/** The player-controlled leader */
export interface LeaderData {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  // Quaternion orientation (w, x, y, z) — avoids gimbal lock
  qx: number;
  qy: number;
  qz: number;
  qw: number;
}

/** Current input state (set each frame from keyboard / joystick) */
export interface InputState {
  yaw: number;    // -1 left, +1 right
  pitch: number;  // -1 down, +1 up
  boost: boolean; // speed boost
}

/** A landmark object in the world */
export interface LandmarkData {
  x: number;
  y: number;
  z: number;
  type: 'ring' | 'pillar' | 'crystal';
  scale: number;
  rotation: number; // Y rotation in radians
  rotSpeed: number; // radians/sec
}

/** Full game state */
export interface GameState {
  boids: BoidData[];
  leader: LeaderData;
  input: InputState;
  landmarks: LandmarkData[];
  aliveCount: number;
  totalCount: number;
  time: number;
  fps: number;
}
