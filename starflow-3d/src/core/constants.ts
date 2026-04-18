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

/** How many planets on the map */
export const PLANET_COUNT = 12;

/** Starting power on owned planets */
export const STARTING_POWER = 15;

/** Starting power range on neutral planets */
export const NEUTRAL_POWER_MIN = 5;
export const NEUTRAL_POWER_MAX = 10;

// ---- Power system ----

/** Planet auto-grows power up to this cap */
export const PLANET_MAX_AUTO_POWER = 10;

/** Power growth per second for owned planets (adjustable) */
export const PLANET_POWER_GROWTH_RATE = 1.0;

/** Missile speed — world units per second */
export const MISSILE_SPEED = 20;

// ---- Route system ----

/** How often a route sends a missile (seconds) — adjustable in code */
export const ROUTE_SEND_INTERVAL = 3.0;

/**
 * Max outgoing routes from a planet based on its power:
 * - power <= 15: 1 route
 * - power <= 30: 2 routes
 * - power > 30:  3 routes
 */
export function getMaxRoutesFromPlanet(power: number): number {
  if (power <= 15) return 1;
  if (power <= 30) return 2;
  return 3;
}

/**
 * Missile strength based on source planet tier:
 * - Tier 1, 2: strength 1
 * - Tier 3:    strength 2
 */
export function getMissileStrength(tier: 1 | 2 | 3): 1 | 2 {
  return tier === 3 ? 2 : 1;
}

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

// ---- Lights ----

export const AMBIENT_LIGHT = 0.3;
export const DIRECTIONAL_LIGHT = 0.9;

// ---- Scene ----

export const BACKGROUND_COLOR = 0x0a0a1a;
export const STAR_COUNT = 2000;

// ---- AI ----

export const AI_THINK_INTERVAL = 2.0;
