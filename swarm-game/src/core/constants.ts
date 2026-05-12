// ============================================================
// Рой (Swarm) — Constants & Tuning Parameters
// ============================================================

// --- Boid behavior ---
export const BOID_COUNT = 150;
export const BOID_MIN_SPEED = 3.5;
export const BOID_MAX_SPEED = 6.0;
export const BOID_MAX_FORCE = 0.15;

export const SEPARATION_RADIUS = 2.5;
export const SEPARATION_WEIGHT = 2.8;

export const PERCEPTION_RADIUS = 6.0;
export const ALIGNMENT_WEIGHT = 1.0;
export const COHESION_WEIGHT = 1.0;

export const LEADER_FOLLOW_RADIUS = 18.0;
export const LEADER_WEIGHT = 3.0;
export const LEADER_TRAIL_DIST = 3.0;

// --- Leader (autopilot) ---
export const LEADER_SPEED = 5.0;
export const LEADER_MAX_TURN_RATE = 2.0; // radians/sec
export const LEADER_MAX_PITCH = 60;       // degrees

// --- Autopilot ---
export const WAYPOINT_REACH_DIST = 4.0;  // distance to consider waypoint reached
export const SMOOTH_TURN_FACTOR = 3.0;    // how smoothly leader turns toward waypoint

// --- World ---
export const WORLD_HALF_SIZE = 80;

// --- Platforms ---
export const PLATFORM_COUNT = 18;
export const PLATFORM_RADIUS_MIN = 3.0;
export const PLATFORM_RADIUS_MAX = 5.0;
export const RING_RADIUS = 2.5;
export const PLATFORM_HEIGHT_MIN = -8;
export const PLATFORM_HEIGHT_MAX = 8;
export const PLATFORM_SPREAD = 55;  // how far platforms spread in XZ

// --- Camera (behind & above, follow) ---
export const CAM_OFFSET_Y = 4.0;      // height above leader
export const CAM_OFFSET_Z = -10.0;    // distance behind leader (in local space)
export const CAM_LOOK_AHEAD = 6.0;    // look-ahead distance
export const CAM_LERP = 4.0;
export const CAM_ZOOM_MIN = 4.0;      // closest zoom
export const CAM_ZOOM_MAX = 40.0;     // farthest zoom
export const CAM_ZOOM_DEFAULT = 10.0;
export const CAM_ZOOM_SPEED = 20.0;   // units per scroll notch

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
