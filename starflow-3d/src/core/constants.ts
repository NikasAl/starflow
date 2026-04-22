// ============================================================
// Star Flow Command — Game Constants
// ============================================================

// ---- Planet Size Configurations ----

import {
  type PlanetSizeType,
  type PlanetSizeConfig,
  type LevelConfig,
} from './types';

export const PLANET_SIZES: Record<PlanetSizeType, PlanetSizeConfig> = {
  dwarf:      { radius: 0.5,  missileStrength: 1, growthMultiplier: 1.3,  defenseMultiplier: 0.6,  weight: 12 },
  small:      { radius: 1.0,  missileStrength: 1, growthMultiplier: 1.15, defenseMultiplier: 0.8,  weight: 18 },
  medium:     { radius: 1.8,  missileStrength: 1, growthMultiplier: 1.0,   defenseMultiplier: 1.0,  weight: 30 },
  large:      { radius: 3.0,  missileStrength: 1, growthMultiplier: 0.9,   defenseMultiplier: 1.3,  weight: 22 },
  giant:      { radius: 5.0,  missileStrength: 2, growthMultiplier: 0.7,   defenseMultiplier: 1.8,  weight: 14 },
  supergiant: { radius: 7.5,  missileStrength: 2, growthMultiplier: 0.5,   defenseMultiplier: 2.5,  weight: 4  },
};

/** Random planet size with weighted probability */
export function randomPlanetSizeType(): PlanetSizeType {
  const entries = Object.entries(PLANET_SIZES) as [PlanetSizeType, PlanetSizeConfig][];
  const totalWeight = entries.reduce((s, [, c]) => s + c.weight, 0);
  let r = Math.random() * totalWeight;
  for (const [type, config] of entries) {
    r -= config.weight;
    if (r <= 0) return type;
  }
  return 'medium';
}

/** Get missile strength for a planet size */
export function getMissileStrengthForSize(sizeType: PlanetSizeType): 1 | 2 {
  return PLANET_SIZES[sizeType].missileStrength;
}

/** Get growth rate multiplier for a planet size */
export function getGrowthMultiplier(sizeType: PlanetSizeType): number {
  return PLANET_SIZES[sizeType].growthMultiplier;
}

// ---- Level Configurations ----

export const LEVELS: LevelConfig[] = [
  {
    level: 1, name: 'First Contact', nameKey: 'level.1',
    planetCount: 4, aiCount: 1,
    heightRange: [-2, 2], worldSize: 50,
    starCount: 0,
    aiThinkInterval: 3.5,
    neutralPowerMin: 3, neutralPowerMax: 6,
    planetMinDistance: 14,
  },
  {
    level: 2, name: 'Expanding Borders', nameKey: 'level.2',
    planetCount: 6, aiCount: 1,
    heightRange: [-5, 5], worldSize: 55,
    starCount: 1,
    aiThinkInterval: 3.0,
    neutralPowerMin: 4, neutralPowerMax: 8,
    planetMinDistance: 15,
  },
  {
    level: 3, name: 'Rising Tensions', nameKey: 'level.3',
    planetCount: 8, aiCount: 1,
    heightRange: [-8, 8], worldSize: 60,
    starCount: 1,
    aiThinkInterval: 2.8,
    neutralPowerMin: 5, neutralPowerMax: 10,
    planetMinDistance: 16,
  },
  {
    level: 4, name: 'Two Front War', nameKey: 'level.4',
    planetCount: 10, aiCount: 2,
    heightRange: [-10, 10], worldSize: 70,
    starCount: 2,
    aiThinkInterval: 2.5,
    neutralPowerMin: 6, neutralPowerMax: 12,
    planetMinDistance: 17,
  },
  {
    level: 5, name: 'Galactic Conflict', nameKey: 'level.5',
    planetCount: 12, aiCount: 2,
    heightRange: [-12, 12], worldSize: 80,
    starCount: 2,
    aiThinkInterval: 2.2,
    neutralPowerMin: 7, neutralPowerMax: 14,
    planetMinDistance: 18,
  },
  {
    level: 6, name: 'Deep Space', nameKey: 'level.6',
    planetCount: 14, aiCount: 2,
    heightRange: [-14, 14], worldSize: 85,
    starCount: 3,
    aiThinkInterval: 2.0,
    neutralPowerMin: 8, neutralPowerMax: 16,
    planetMinDistance: 18,
  },
  {
    level: 7, name: 'Supernova', nameKey: 'level.7',
    planetCount: 16, aiCount: 3,
    heightRange: [-15, 15], worldSize: 90,
    starCount: 3,
    aiThinkInterval: 1.8,
    neutralPowerMin: 9, neutralPowerMax: 18,
    planetMinDistance: 19,
  },
  {
    level: 8, name: 'Endgame', nameKey: 'level.8',
    planetCount: 18, aiCount: 3,
    heightRange: [-15, 15], worldSize: 100,
    starCount: 4,
    aiThinkInterval: 1.5,
    neutralPowerMin: 10, neutralPowerMax: 20,
    planetMinDistance: 20,
  },
];

/** Get level config — generates endless scaling levels beyond defined ones */
export function getLevelConfig(level: number): LevelConfig {
  if (level >= 1 && level <= LEVELS.length) return { ...LEVELS[level - 1] };

  const base = LEVELS[LEVELS.length - 1];
  const extra = level - LEVELS.length;
  return {
    ...base,
    level,
    name: `Infinite ${extra}`, nameKey: 'level.infinite', nameParams: { n: extra },
    planetCount: Math.min(24, base.planetCount + extra * 2),
    aiCount: Math.min(4, base.aiCount + Math.floor(extra / 3)),
    heightRange: [-15, 15] as [number, number],
    worldSize: Math.min(120, base.worldSize + extra * 3),
    aiThinkInterval: Math.max(1.0, base.aiThinkInterval - extra * 0.1),
    neutralPowerMin: Math.min(30, base.neutralPowerMin + extra),
    neutralPowerMax: Math.min(50, base.neutralPowerMax + extra * 2),
    planetMinDistance: Math.min(22, base.planetMinDistance + extra * 0.3),
    starCount: Math.min(6, 4 + Math.floor(extra / 2)),
  };
}

// ---- World bounds (defaults, overridden by level config) ----

export const WORLD_SIZE = 80;

// ---- Power system ----

/** Planet auto-grows power up to this cap */
export const PLANET_MAX_AUTO_POWER = 10;

/** Base power growth per second for owned planets */
export const PLANET_POWER_GROWTH_RATE = 1.0;

/** Starting power on owned planets */
export const STARTING_POWER = 15;

// ---- Missile ----

/** Missile speed — world units per second */
export const MISSILE_SPEED = 20;

// ---- Route system ----

/** How often a route sends a missile (seconds) at power 1 */
export const ROUTE_SEND_INTERVAL_BASE = 3.0;

/** Minimum interval between missile sends (saturation floor) */
export const ROUTE_SEND_INTERVAL_MIN = 1.0;

/**
 * Route send interval scales down with planet power.
 * - power 1:   3.0s (base)
 * - power 15:  2.4s
 * - power 30:  1.8s
 * - power 50:  1.0s (saturation)
 * - power 50+: 1.0s (floor)
 */
export function getRouteSendInterval(power: number): number {
  if (power <= 1) return ROUTE_SEND_INTERVAL_BASE;
  return Math.max(
    ROUTE_SEND_INTERVAL_MIN,
    ROUTE_SEND_INTERVAL_BASE - (power - 1) * 0.04,
  );
}

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

// ---- Camera ----

export const CAM_DEFAULT_DISTANCE = 60;
export const CAM_DEFAULT_THETA = 0;
export const CAM_DEFAULT_PHI = 0.8;
export const CAM_MIN_DISTANCE = 20;
export const CAM_MAX_DISTANCE = 180;
export const CAM_ZOOM_SPEED = 2;

/** Camera fly-forward settings */
export const CAMERA_FLY_DURATION = 0.4;
export const CAMERA_FLY_DISTANCE = 18;
export const CAMERA_MAX_MISSES = 2;
export const CAMERA_MISS_TIMEOUT = 4.0;

// ---- Selection ----

export const SELECTION_RING_COLOR = 0x00ff88;
export const SELECTION_RING_RADIUS_MULTIPLIER = 1.6;

/** Minimum raycast hit radius for planets (increases accessibility) */
export const PLANET_HIT_RADIUS_MIN = 2.0;

// ---- Lights ----

export const AMBIENT_LIGHT = 0.3;
export const DIRECTIONAL_LIGHT = 0.9;

// ---- Scene ----

export const BACKGROUND_COLOR = 0x0a0a1a;
export const STAR_COUNT = 2000;

// ---- Stars (Suns) as obstacles ----

/** Minimum distance from star to any planet */
export const STAR_MIN_PLANET_DISTANCE = 12;
/** Star visual radius (not physical — missiles die at STAR_KILL_RADIUS) */
export const STAR_VISUAL_RADIUS_MIN = 2.5;
export const STAR_VISUAL_RADIUS_MAX = 5.0;
/** Missiles that enter this radius from star center are destroyed */
export const STAR_KILL_RADIUS = 4.0;
/** Gravity well radius for planets (giant/supergiant) */
export const GRAVITY_WELL_RADIUS = 8.0;
/** Minimum planet radius to generate gravity well */
export const GRAVITY_WELL_MIN_PLANET_RADIUS = 3.0;
/** How close two enemy missiles must be to intercept each other */
export const MISSILE_INTERCEPT_DISTANCE = 1.5;
