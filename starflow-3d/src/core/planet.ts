// ============================================================
// Star Flow Command — Planet Logic
// ============================================================

import {
  type PlanetData, type OwnerId,
  PLAYER, AI_1, AI_2, NEUTRAL,
} from './types';
import { planetTypeForIndex } from './texture-gen';
import {
  WORLD_SIZE, PLANET_MIN_DISTANCE,
  PLANET_RADII,
  PLANET_COUNT,
  STARTING_POWER,
  NEUTRAL_POWER_MIN, NEUTRAL_POWER_MAX,
  PLANET_MAX_AUTO_POWER,
  PLANET_POWER_GROWTH_RATE,
} from './constants';

const PLANET_NAMES = [
  'Terra Nova', 'Kepler-7b', 'Proxima', 'Andoria', 'Vulcan',
  'Rigel Prime', 'Centauri', 'Sirius', 'Vega', 'Altair',
  'Deneb', 'Antares', 'Polaris', 'Betelgeuse', 'Capella',
  'Arcturus', 'Aldebaran', 'Spica', 'Regulus', 'Procyon',
];

function tooClose(x: number, z: number, planets: PlanetData[]): boolean {
  for (const p of planets) {
    const dx = p.x - x;
    const dz = p.z - z;
    if (Math.sqrt(dx * dx + dz * dz) < PLANET_MIN_DISTANCE) return true;
  }
  return false;
}

function randomPosition(planets: PlanetData[]): { x: number; z: number } {
  for (let attempts = 0; attempts < 500; attempts++) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.8;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.8;
    if (!tooClose(x, z, planets)) return { x, z };
  }
  return {
    x: (Math.random() - 0.5) * WORLD_SIZE * 0.8,
    z: (Math.random() - 0.5) * WORLD_SIZE * 0.8,
  };
}

function randomTier(): 1 | 2 | 3 {
  const r = Math.random();
  if (r < 0.5) return 1;
  if (r < 0.85) return 2;
  return 3;
}

/** Generate the full map layout */
export function generateMap(aiCount: number = 2): PlanetData[] {
  const planets: PlanetData[] = [];
  const owners: OwnerId[] = [PLAYER];
  if (aiCount >= 1) owners.push(AI_1);
  if (aiCount >= 2) owners.push(AI_2);

  // Place faction starting planets evenly spaced
  for (let i = 0; i < owners.length; i++) {
    const angle = (i / owners.length) * Math.PI * 2;
    const dist = WORLD_SIZE * 0.25;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    const tier = 2 as const;
    planets.push({
      id: `planet_${i}`,
      name: PLANET_NAMES[i % PLANET_NAMES.length],
      x, y: 0, z,
      radius: PLANET_RADII[tier],
      owner: owners[i],
      power: STARTING_POWER,
      tier,
      visualType: planetTypeForIndex(i, tier),
      textureSeed: i * 1000 + 42,
    });
  }

  // Place neutral planets
  for (let i = owners.length; i < PLANET_COUNT; i++) {
    const pos = randomPosition(planets);
    const tier = randomTier();
    planets.push({
      id: `planet_${i}`,
      name: PLANET_NAMES[i % PLANET_NAMES.length],
      x: pos.x, y: 0, z: pos.z,
      radius: PLANET_RADII[tier],
      owner: NEUTRAL,
      power: NEUTRAL_POWER_MIN + Math.floor(Math.random() * (NEUTRAL_POWER_MAX - NEUTRAL_POWER_MIN + 1)),
      tier,
      visualType: planetTypeForIndex(i, tier),
      textureSeed: i * 1000 + 42,
    });
  }

  return planets;
}

/** Update planet power: auto-grow up to PLANET_MAX_AUTO_POWER */
export function updatePlanetGrowth(planet: PlanetData, dt: number): void {
  if (planet.owner === NEUTRAL) return;
  if (planet.power >= PLANET_MAX_AUTO_POWER) return;

  planet.power += PLANET_POWER_GROWTH_RATE * dt;
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
