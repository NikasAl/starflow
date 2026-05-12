// ============================================================
// Рой (Swarm) — Constants & Tuning Parameters
// ============================================================

// --- Mutable tuning (modified by debug panel at runtime) ---
export const tuning = {
  // Boid behavior
  separationRadius: 3.5,
  separationWeight: 4.0,
  perceptionRadius: 8.0,
  alignmentWeight: 0.8,
  cohesionWeight: 0.6,
  maxForce: 0.2,

  // Leader following
  leaderFollowRadius: 20.0,
  leaderWeight: 2.5,
  leaderTrailDist: 5.0,

  // Visual
  boidScale: 1.0,
};

// --- Static constants ---

export const BOID_COUNT = 150;
export const BOID_MIN_SPEED = 3.5;
export const BOID_MAX_SPEED = 6.0;

// --- Leader (autopilot) ---
export const LEADER_SPEED = 5.0;
export const LEADER_MAX_TURN_RATE = 2.0;
export const LEADER_MAX_PITCH = 60;

// --- Autopilot ---
export const WAYPOINT_REACH_DIST = 4.0;
export const SMOOTH_TURN_FACTOR = 3.0;
export const WAYPOINT_HEIGHT_OFFSET = 8;  // waypoints placed this far above platform

// --- World ---
export const WORLD_HALF_SIZE = 80;

// --- Platforms ---
export const PLATFORM_COUNT = 18;
export const PLATFORM_RADIUS_MIN = 3.0;
export const PLATFORM_RADIUS_MAX = 5.0;
export const RING_RADIUS = 2.5;
export const PLATFORM_HEIGHT_MIN = -8;
export const PLATFORM_HEIGHT_MAX = 8;
export const PLATFORM_SPREAD = 55;

// --- Camera ---
// Quaternion convention: q maps +Y → forward
// So local -Y = behind, local -Z = world-up
// Offset (0, -dist, -height) → world (0, height, -dist)
export const CAM_DISTANCE = 10.0;     // behind leader
export const CAM_HEIGHT = 4.0;        // above leader
export const CAM_LOOK_AHEAD = 6.0;
export const CAM_LERP = 4.0;
export const CAM_ZOOM_MIN = 4.0;
export const CAM_ZOOM_MAX = 40.0;
export const CAM_ZOOM_DEFAULT = 10.0;
export const CAM_ZOOM_SPEED = 20.0;

// --- Spatial hash ---
export const SPATIAL_CELL_SIZE = 8;

// --- Rendering ---
export const STAR_COUNT = 3000;
export const STAR_SHELL_MIN = 200;
export const STAR_SHELL_MAX = 400;

// --- Bloom ---
export const BLOOM_STRENGTH = 1.2;
export const BLOOM_RADIUS = 0.4;
export const BLOOM_THRESHOLD = 0.2;
