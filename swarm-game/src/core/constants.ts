// ============================================================
// Рой (Swarm) — Constants & Tuning Parameters
// ============================================================

// --- Boid behavior ---
export const BOID_COUNT = 200;
export const BOID_MIN_SPEED = 3.0;
export const BOID_MAX_SPEED = 5.0;
export const BOID_MAX_FORCE = 0.12;
export const BOID_MIN_FORCE = 0.02;

export const SEPARATION_RADIUS = 2.5;
export const SEPARATION_WEIGHT = 2.0;

export const PERCEPTION_RADIUS = 6.0;
export const ALIGNMENT_WEIGHT = 1.0;
export const COHESION_WEIGHT = 1.2;

export const LEADER_FOLLOW_RADIUS = 20.0;
export const LEADER_WEIGHT = 2.5;

// --- Leader ---
export const LEADER_SPEED = 4.5;
export const LEADER_BOOST_SPEED = 7.0;
export const LEADER_MAX_TURN_RATE = 2.5; // radians/sec

// --- World ---
export const WORLD_HALF_SIZE = 50;
export const BOUNDARY_MARGIN = 10;
export const BOUNDARY_STRENGTH = 8.0;

// --- Camera ---
export const CAM_OFFSET_Y = 2.5;
export const CAM_OFFSET_Z = -8;
export const CAM_LERP = 4.0;
export const CAM_LOOK_AHEAD = 2.0;

// --- Spatial hash ---
export const SPATIAL_CELL_SIZE = 8;

// --- Rendering ---
export const STAR_COUNT = 4000;
export const STAR_SHELL_MIN = 200;
export const STAR_SHELL_MAX = 400;

// --- Bloom ---
export const BLOOM_STRENGTH = 1.5;
export const BLOOM_RADIUS = 0.4;
export const BLOOM_THRESHOLD = 0.15;
