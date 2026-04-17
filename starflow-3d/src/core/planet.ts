// ============================================================
// Star Flow Command — Planet Logic (pure data, no Three.js)
// ============================================================

import {
  type PlanetData, type OwnerId,
  PLAYER, AI_1, AI_2, NEUTRAL,
} from './types';
import {
  WORLD_SIZE, PLANET_MIN_DISTANCE,
  PLANET_RADII, PLANET_MAX_SHIPS, PLANET_PRODUCTION,
  PLANET_COUNT, STARTING_SHIPS, NEUTRAL_SHIPS,
} from './constants';

/** Generate planet names */
const PLANET_NAMES = [
  'Terra Nova', 'Kepler-7b', 'Proxima', 'Andoria', 'Vulcan',
  'Rigel Prime', 'Centauri', 'Sirius', 'Vega', 'Altair',
  'Deneb', 'Antares', 'Polaris', 'Betelgeuse', 'Capella',
  'Arcturus', 'Aldebaran', 'Spica', 'Regulus', 'Procyon',
];

/** Check if a position is too close to existing planets */
function tooClose(x: number, z: number, planets: PlanetData[]): boolean {
  for (const p of planets) {
    const dx = p.x - x;
    const dz = p.z - z;
    if (Math.sqrt(dx * dx + dz * dz) < PLANET_MIN_DISTANCE) return true;
  }
  return false;
}

/** Random position on the XZ plane within world bounds */
function randomPosition(planets: PlanetData[]): { x: number; z: number } {
  const half = WORLD_SIZE / 2;
  let attempts = 0;
  while (attempts < 500) {
    const x = (Math.random() - 0.5) * WORLD_SIZE * 0.8;
    const z = (Math.random() - 0.5) * WORLD_SIZE * 0.8;
    if (!tooClose(x, z, planets)) {
      return { x, z };
    }
    attempts++;
  }
  // Fallback: grid placement
  return { x: (Math.random() - 0.5) * WORLD_SIZE * 0.8, z: (Math.random() - 0.5) * WORLD_SIZE * 0.8 };
}

/** Pick a random tier weighted toward small planets */
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

  // Place starting planets for each faction far apart
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
      ships: STARTING_SHIPS,
      maxShips: PLANET_MAX_SHIPS[tier],
      productionRate: PLANET_PRODUCTION[tier],
      tier,
    });
  }

  // Fill remaining with neutral/contested planets
  for (let i = owners.length; i < PLANET_COUNT; i++) {
    const pos = randomPosition(planets);
    const tier = randomTier();
    planets.push({
      id: `planet_${i}`,
      name: PLANET_NAMES[i % PLANET_NAMES.length],
      x: pos.x, y: 0, z: pos.z,
      radius: PLANET_RADII[tier],
      owner: NEUTRAL,
      ships: NEUTRAL_SHIPS + Math.floor(Math.random() * 10),
      maxShips: PLANET_MAX_SHIPS[tier],
      productionRate: PLANET_PRODUCTION[tier],
      tier,
    });
  }

  return planets;
}

/** Update planet production: add ships based on elapsed time */
export function updateProduction(planet: PlanetData, dt: number): void {
  if (planet.owner === NEUTRAL) return;
  if (planet.ships >= planet.maxShips) return;

  planet.ships += planet.productionRate * dt;
  if (planet.ships > planet.maxShips) {
    planet.ships = planet.maxShips;
  }
}

/** Send ships from one planet to another. Returns the fleet if successful. */
export function launchFleet(
  source: PlanetData,
  targetId: string,
  tx: number, tz: number,
): { ships: number; sourceId: string; targetId: string } | null {
  const sendCount = Math.floor(source.ships * 0.7);
  if (sendCount < 1) return null;

  source.ships -= sendCount;

  return {
    ships: sendCount,
    sourceId: source.id,
    targetId,
  };
}

/** Resolve combat when a fleet arrives at a planet */
export function resolveCombat(planet: PlanetData, attackerShips: number, attackerOwner: OwnerId): PlanetData {
  const planetData = { ...planet };

  if (planetData.owner === attackerOwner) {
    // Reinforce — just add ships
    planetData.ships += attackerShips;
    if (planetData.ships > planetData.maxShips) {
      planetData.ships = planetData.maxShips;
    }
  } else {
    // Attack — mutual destruction
    if (attackerShips > planetData.ships) {
      // Attacker wins
      const remaining = Math.floor(attackerShips - planetData.ships * 0.7);
      planetData.owner = attackerOwner;
      planetData.ships = remaining;
    } else {
      // Defender holds
      planetData.ships = Math.floor(planetData.ships - attackerShips * 0.7);
    }
    if (planetData.ships < 0) planetData.ships = 0;
  }

  return planetData;
}
