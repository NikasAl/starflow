// ============================================================
// Рой (Swarm) — Constants & Tuning Parameters
// ============================================================

// --- Mutable tuning (modified by debug panel at runtime) ---
export const tuning = {
  // Boid behavior
  separationRadius: 2.0,
  separationWeight: 4.0,
  perceptionRadius: 10.0,
  alignmentWeight: 1.7,
  cohesionWeight: 0.6,
  maxForce: 0.2,

  // Leader following
  leaderFollowRadius: 20.0,
  leaderWeight: 1.8,
  leaderTrailDist: 5.0,

  // Visual
  boidScale: 0.7,

  // Swarm size (requires restart to apply)
  boidCount: 150,
};

// --- Static constants ---

export const BOID_MIN_SPEED = 3.5;
export const BOID_MAX_SPEED = 6.0;
export const BOID_MAX_ALLOC = 500;  // max InstancedMesh buffer size

// --- Leader (autopilot) ---
export const LEADER_SPEED = 5.0;
export const LEADER_MAX_TURN_RATE = 3.0;
export const LEADER_MAX_PITCH = 60;

// --- Flight path (spline) ---
export const PATH_SAMPLES = 400;        // dense sampling of the curve
export const PLATFORM_SPACING = 22;     // path points between platforms (400/22 ≈ 18 platforms)
export const PATH_LOOK_AHEAD = 8;       // leader looks this many points ahead

// --- World ---
export const WORLD_HALF_SIZE = 80;

// --- Platforms ---
export const PLATFORM_RADIUS_MIN = 3.0;
export const PLATFORM_RADIUS_MAX = 5.0;
export const RING_RADIUS = 2.5;

// --- Curve shape parameters ---
export const CURVE_RADIUS_MAIN = 38;   // main loop radius
export const CURVE_RADIUS_MOD = 14;    // figure-8 modulation
export const CURVE_HEIGHT_AMP = 10;    // vertical wave amplitude

// --- Camera ---
export const CAM_DISTANCE = 10.0;
export const CAM_HEIGHT = 4.0;
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
