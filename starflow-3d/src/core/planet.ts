// ============================================================
// Star Flow Command — Planet Logic
// ============================================================

import {
  type PlanetData, type OwnerId, planetPower,
  PLAYER, AI_1, AI_2, NEUTRAL,
} from './types';
import {
  WORLD_SIZE, PLANET_MIN_DISTANCE,
  PLANET_RADII, PLANET_MAX_SHIPS,
  PLANET_FIGHTER_PRODUCTION, PLANET_CRUISER_PRODUCTION,
  PLANET_COUNT,
  STARTING_FIGHTERS, STARTING_CRUISERS,
  NEUTRAL_FIGHTERS, NEUTRAL_CRUISERS,
  ROUTE_FIGHTERS_PER_BATCH, ROUTE_CRUISERS_PER_BATCH,
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
      fighters: STARTING_FIGHTERS,
      cruisers: STARTING_CRUISERS,
      maxShips: PLANET_MAX_SHIPS[tier],
      fighterProduction: PLANET_FIGHTER_PRODUCTION[tier],
      cruiserProduction: PLANET_CRUISER_PRODUCTION[tier],
      tier,
    });
  }

  for (let i = owners.length; i < PLANET_COUNT; i++) {
    const pos = randomPosition(planets);
    const tier = randomTier();
    planets.push({
      id: `planet_${i}`,
      name: PLANET_NAMES[i % PLANET_NAMES.length],
      x: pos.x, y: 0, z: pos.z,
      radius: PLANET_RADII[tier],
      owner: NEUTRAL,
      fighters: NEUTRAL_FIGHTERS + Math.floor(Math.random() * 6),
      cruisers: NEUTRAL_CRUISERS + Math.floor(Math.random() * 3),
      maxShips: PLANET_MAX_SHIPS[tier],
      fighterProduction: PLANET_FIGHTER_PRODUCTION[tier],
      cruiserProduction: PLANET_CRUISER_PRODUCTION[tier],
      tier,
    });
  }

  return planets;
}

/** Update planet production: add fighters and cruisers over time */
export function updateProduction(planet: PlanetData, dt: number): void {
  if (planet.owner === NEUTRAL) return;
  const totalWeight = planet.fighters + planet.cruisers * 2;
  if (totalWeight >= planet.maxShips) return;

  planet.fighters += planet.fighterProduction * dt;
  planet.cruisers += planet.cruiserProduction * dt;

  // Cap by max weight
  if (planet.fighters + planet.cruisers * 2 > planet.maxShips) {
    // Reduce proportionally
    const excess = (planet.fighters + planet.cruisers * 2) - planet.maxShips;
    // Remove fighters first (cheaper)
    const fighterReduction = Math.min(excess, planet.fighters - 0);
    planet.fighters -= fighterReduction;
    const remaining = excess - fighterReduction;
    planet.cruisers -= remaining / 2;
    if (planet.fighters < 0) planet.fighters = 0;
    if (planet.cruisers < 0) planet.cruisers = 0;
  }
}

/** Launch a batch from source planet for route sending */
export function launchRouteBatch(source: PlanetData): { fighters: number; cruisers: number } | null {
  const f = Math.min(Math.floor(source.fighters), ROUTE_FIGHTERS_PER_BATCH);
  const c = Math.min(Math.floor(source.cruisers), ROUTE_CRUISERS_PER_BATCH);
  if (f === 0 && c === 0) return null;

  source.fighters -= f;
  source.cruisers -= c;

  return { fighters: f, cruisers: c };
}

/** Resolve combat when a fleet arrives */
export function resolveCombat(planet: PlanetData, attackerFighters: number, attackerCruisers: number, attackerOwner: OwnerId): PlanetData {
  const p = { ...planet };
  const attackPower = attackerFighters + attackerCruisers * 2;
  const defendPower = p.fighters + p.cruisers * 2;

  if (p.owner === attackerOwner) {
    // Reinforce
    p.fighters += attackerFighters;
    p.cruisers += attackerCruisers;
    // Cap
    const total = p.fighters + p.cruisers * 2;
    if (total > p.maxShips) {
      const ratio = p.maxShips / total;
      p.fighters = Math.floor(p.fighters * ratio);
      p.cruisers = Math.floor(p.cruisers * ratio);
    }
  } else {
    // Attack — mutual destruction by weight
    if (attackPower > defendPower) {
      // Attacker wins
      const remainingPower = attackPower - defendPower;
      p.owner = attackerOwner;
      // Distribute remaining as fighters (simpler)
      p.fighters = remainingPower;
      p.cruisers = 0;
    } else {
      // Defender holds
      const remainingPower = defendPower - attackPower;
      // Remove proportionally from defenders
      const ratio = remainingPower / defendPower;
      p.fighters = Math.floor(p.fighters * ratio);
      p.cruisers = Math.floor(p.cruisers * ratio);
    }
    if (p.fighters < 0) p.fighters = 0;
    if (p.cruisers < 0) p.cruisers = 0;
  }

  return p;
}
