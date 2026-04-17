// ============================================================
// Star Flow Command — Game Constants
// ============================================================

/** World bounds — planets spawn within this area */
export const WORLD_SIZE = 80;

/** Minimum distance between planet centers */
export const PLANET_MIN_DISTANCE = 18;

/** Planet visual radii by tier */
export const PLANET_RADII: Record<1 | 2 | 3, number> = {
  1: 1.2,   // small
  2: 1.8,   // medium
  3: 2.5,   // large
};

/** Ship capacity by tier */
export const PLANET_MAX_SHIPS: Record<1 | 2 | 3, number> = {
  1: 50,
  2: 100,
  3: 200,
};

/** Production rate (ships per second) by tier */
export const PLANET_PRODUCTION: Record<1 | 2 | 3, number> = {
  1: 0.8,
  2: 1.5,
  3: 2.5,
};

/** How many planets on the map */
export const PLANET_COUNT = 12;

/** Starting ships on owned planets */
export const STARTING_SHIPS = 20;

/** Ships on neutral planets */
export const NEUTRAL_SHIPS = 10;

/** Fleet speed — world units per second */
export const FLEET_SPEED = 15;

/** Camera defaults */
export const CAM_DEFAULT_DISTANCE = 60;
export const CAM_DEFAULT_THETA = 0;
export const CAM_DEFAULT_PHI = 0.8;   // ~45 degrees
export const CAM_MIN_DISTANCE = 20;
export const CAM_MAX_DISTANCE = 150;
export const CAM_ZOOM_SPEED = 2;
export const CAM_ROTATE_SPEED = 0.005;
export const CAM_PAN_SPEED = 0.3;

/** Selection ring animation */
export const SELECTION_RING_COLOR = 0x00ff88;
export const SELECTION_RING_RADIUS_MULTIPLIER = 1.6;

/** Number of particles per stream visual */
export const STREAM_PARTICLE_COUNT = 8;

/** Particle size for ship streams */
export const STREAM_PARTICLE_SIZE = 0.3;

/** Ambient light intensity */
export const AMBIENT_LIGHT = 0.3;

/** Directional light intensity */
export const DIRECTIONAL_LIGHT = 0.9;

/** Background color (deep space) */
export const BACKGROUND_COLOR = 0x0a0a1a;

/** Star field: how many background stars */
export const STAR_COUNT = 2000;

/** AI decision interval in seconds */
export const AI_THINK_INTERVAL = 3.0;

/** Minimum ships AI needs before attacking */
export const AI_MIN_ATTACK_SHIPS = 8;
