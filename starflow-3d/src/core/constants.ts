// ============================================================
// Star Flow Command — Game Constants
// ============================================================

/** World bounds */
export const WORLD_SIZE = 80;

/** Minimum distance between planet centers */
export const PLANET_MIN_DISTANCE = 18;

/** Planet visual radii by tier */
export const PLANET_RADII: Record<1 | 2 | 3, number> = {
  1: 1.2,
  2: 1.8,
  3: 2.5,
};

/** Max total ship weight by tier */
export const PLANET_MAX_SHIPS: Record<1 | 2 | 3, number> = {
  1: 50,
  2: 100,
  3: 200,
};

/** Fighter production rate (per second) by tier */
export const PLANET_FIGHTER_PRODUCTION: Record<1 | 2 | 3, number> = {
  1: 1.2,
  2: 2.0,
  3: 3.0,
};

/** Cruiser production rate (per second) by tier */
export const PLANET_CRUISER_PRODUCTION: Record<1 | 2 | 3, number> = {
  1: 0.4,
  2: 0.7,
  3: 1.2,
};

/** How many planets on the map */
export const PLANET_COUNT = 12;

/** Starting fighters on owned planets */
export const STARTING_FIGHTERS = 15;

/** Starting cruisers on owned planets */
export const STARTING_CRUISERS = 4;

/** Starting ships on neutral planets */
export const NEUTRAL_FIGHTERS = 8;
export const NEUTRAL_CRUISERS = 2;

/** Fleet speed — world units per second */
export const FLEET_SPEED = 15;

// ---- Route system ----

/** How often a route sends a batch (seconds) */
export const ROUTE_SEND_INTERVAL = 2.0;

/** How many fighters per batch (small constant, routes are continuous) */
export const ROUTE_FIGHTERS_PER_BATCH = 3;

/** How many cruisers per batch */
export const ROUTE_CRUISERS_PER_BATCH = 1;

// ---- Camera ----

export const CAM_DEFAULT_DISTANCE = 60;
export const CAM_DEFAULT_THETA = 0;
export const CAM_DEFAULT_PHI = 0.8;
export const CAM_MIN_DISTANCE = 20;
export const CAM_MAX_DISTANCE = 150;
export const CAM_ZOOM_SPEED = 2;

// ---- Selection ----

export const SELECTION_RING_COLOR = 0x00ff88;
export const SELECTION_RING_RADIUS_MULTIPLIER = 1.6;

// ---- Streams ----

export const STREAM_PARTICLE_COUNT = 8;
export const STREAM_PARTICLE_SIZE = 0.3;

// ---- Lights ----

export const AMBIENT_LIGHT = 0.3;
export const DIRECTIONAL_LIGHT = 0.9;

// ---- Scene ----

export const BACKGROUND_COLOR = 0x0a0a1a;
export const STAR_COUNT = 2000;

// ---- AI ----

export const AI_THINK_INTERVAL = 3.0;
export const AI_MIN_ATTACK_SHIPS = 8;
