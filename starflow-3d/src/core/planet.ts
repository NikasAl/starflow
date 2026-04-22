// ============================================================
// Star Flow Command — Planet Logic
// ============================================================

import {
  type PlanetData, type OwnerId, type LevelConfig,
  PLAYER, AI_1, AI_2, AI_3, NEUTRAL,
} from './types';
import { type PlanetSizeType } from './types';
import { planetTypeForIndex } from './texture-gen';
import {
  PLANET_SIZES,
  PLANET_MAX_AUTO_POWER,
  PLANET_POWER_GROWTH_RATE,
  randomPlanetSizeType,
  getGrowthMultiplier,
} from './constants';

const PLANET_NAMES = [
  'Terra Nova', 'Kepler-7b', 'Proxima', 'Andoria', 'Vulcan',
  'Rigel Prime', 'Centauri', 'Sirius', 'Vega', 'Altair',
  'Deneb', 'Antares', 'Polaris', 'Betelgeuse', 'Capella',
  'Arcturus', 'Aldebaran', 'Spica', 'Regulus', 'Procyon',
  'Mira', 'Castor', 'Pollux', 'Fomalhaut', 'Canopus',
];

function tooClose(x: number, y: number, z: number, planets: PlanetData[], minDist: number, newRadius: number = 1.0): boolean {
  for (const p of planets) {
    const dx = p.x - x;
    const dy = p.y - y;
    const dz = p.z - z;
    // Minimum distance accounts for both radii
    if (Math.sqrt(dx * dx + dy * dy + dz * dz) < minDist + p.radius + newRadius) return true;
  }
  return false;
}

function randomPosition(planets: PlanetData[], cfg: LevelConfig, radius: number = 1.0): { x: number; y: number; z: number } {
  const [hMin, hMax] = cfg.heightRange;

  // Phase 1: strict placement with full minDistance spacing
  for (let attempts = 0; attempts < 500; attempts++) {
    const x = (Math.random() - 0.5) * cfg.worldSize * 0.8;
    const y = hMin + Math.random() * (hMax - hMin);
    const z = (Math.random() - 0.5) * cfg.worldSize * 0.8;
    if (!tooClose(x, y, z, planets, cfg.planetMinDistance, radius)) return { x, y, z };
  }

  // Phase 2: relaxed placement — only prevent physical overlap (no minDistance, just radii)
  for (let attempts = 0; attempts < 500; attempts++) {
    const x = (Math.random() - 0.5) * cfg.worldSize * 0.8;
    const y = hMin + Math.random() * (hMax - hMin);
    const z = (Math.random() - 0.5) * cfg.worldSize * 0.8;
    if (!tooClose(x, y, z, planets, 0, radius)) return { x, y, z };
  }

  // Absolute fallback — guaranteed no overlap with a small gap (0.5 units)
  for (let attempts = 0; attempts < 1000; attempts++) {
    const x = (Math.random() - 0.5) * cfg.worldSize;
    const y = hMin + Math.random() * (hMax - hMin);
    const z = (Math.random() - 0.5) * cfg.worldSize;
    let overlap = false;
    for (const p of planets) {
      const dx = p.x - x;
      const dy = p.y - y;
      const dz = p.z - z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < p.radius + radius + 0.5) {
        overlap = true;
        break;
      }
    }
    if (!overlap) return { x, y, z };
  }

  // Last resort — push away from nearest planet
  let bestX = 0, bestY = 0, bestZ = 0, bestMinGap = -Infinity;
  for (let attempts = 0; attempts < 200; attempts++) {
    const x = (Math.random() - 0.5) * cfg.worldSize;
    const y = hMin + Math.random() * (hMax - hMin);
    const z = (Math.random() - 0.5) * cfg.worldSize;
    let minGap = Infinity;
    for (const p of planets) {
      const dx = p.x - x;
      const dy = p.y - y;
      const dz = p.z - z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const gap = dist - p.radius - radius;
      if (gap < minGap) minGap = gap;
    }
    if (minGap > bestMinGap) {
      bestMinGap = minGap;
      bestX = x; bestY = y; bestZ = z;
    }
  }
  return { x: bestX, y: bestY, z: bestZ };
}

/** Alias for randomPosition with explicit radius parameter */
function randomPositionWithRadius(planets: PlanetData[], cfg: LevelConfig, radius: number): { x: number; y: number; z: number } {
  return randomPosition(planets, cfg, radius);
}

/** Generate the full map layout for a given level configuration */
export function generateMap(levelConfig: LevelConfig): PlanetData[] {
  const planets: PlanetData[] = [];
  const { aiCount, planetCount, worldSize } = levelConfig;

  // Build owners list: player + AIs
  const owners: OwnerId[] = [PLAYER];
  if (aiCount >= 1) owners.push(AI_1);
  if (aiCount >= 2) owners.push(AI_2);
  if (aiCount >= 3) owners.push(AI_3);

  // Place faction starting planets evenly spaced
  for (let i = 0; i < owners.length; i++) {
    const angle = (i / owners.length) * Math.PI * 2;
    const dist = worldSize * 0.25;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const [hMin, hMax] = levelConfig.heightRange;
    const y = hMin + Math.random() * (hMax - hMin);

    // Starting planets are medium for player, medium/large for AI
    const sizeType: PlanetSizeType = (i === 0) ? 'medium' : (Math.random() < 0.5 ? 'medium' : 'large');
    const sizeConfig = PLANET_SIZES[sizeType];

    planets.push({
      id: `planet_${i}`,
      name: PLANET_NAMES[i % PLANET_NAMES.length],
      x, y, z,
      radius: sizeConfig.radius,
      owner: owners[i],
      power: 15,
      sizeType,
      visualType: planetTypeForIndex(i, sizeType),
      textureSeed: i * 1000 + 42,
    });
  }

  // Place neutral planets
  for (let i = owners.length; i < planetCount; i++) {
    const sizeType = randomPlanetSizeType();
    const sizeConfig = PLANET_SIZES[sizeType];
    const pos = randomPositionWithRadius(planets, levelConfig, sizeConfig.radius);

    // Neutral power scaled by planet defense multiplier
    const basePower = levelConfig.neutralPowerMin +
      Math.floor(Math.random() * (levelConfig.neutralPowerMax - levelConfig.neutralPowerMin + 1));
    const power = Math.max(1, Math.round(basePower * sizeConfig.defenseMultiplier));

    planets.push({
      id: `planet_${i}`,
      name: PLANET_NAMES[i % PLANET_NAMES.length],
      x: pos.x, y: pos.y, z: pos.z,
      radius: sizeConfig.radius,
      owner: NEUTRAL,
      power,
      sizeType,
      visualType: planetTypeForIndex(i, sizeType),
      textureSeed: i * 1000 + 42,
    });
  }

  return planets;
}

/** Update planet power: auto-grow up to PLANET_MAX_AUTO_POWER */
export function updatePlanetGrowth(planet: PlanetData, dt: number): void {
  if (planet.owner === NEUTRAL) return;
  if (planet.power >= PLANET_MAX_AUTO_POWER) return;

  const growthRate = PLANET_POWER_GROWTH_RATE * getGrowthMultiplier(planet.sizeType);
  planet.power += growthRate * dt;
  if (planet.power > PLANET_MAX_AUTO_POWER) {
    planet.power = PLANET_MAX_AUTO_POWER;
  }
}

/**
 * Resolve missile arrival at a planet.
 * - Same owner: power += strength
 * - Different owner: power -= strength; if power <= 0, planet captured
 */
export function resolveMissileArrival(
  planet: PlanetData,
  missileStrength: number,
  missileOwner: OwnerId,
): PlanetData {
  const p = { ...planet };

  if (p.owner === missileOwner) {
    // Reinforce: increase power
    p.power += missileStrength;
  } else {
    // Attack: decrease power
    p.power -= missileStrength;
    if (p.power <= 0) {
      // Planet captured! Remaining power transfers to new owner
      p.power = Math.abs(p.power);
      p.owner = missileOwner;
    }
  }

  return p;
}
