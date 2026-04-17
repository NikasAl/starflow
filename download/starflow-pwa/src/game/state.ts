// ============================================================
// Game State — pure data, no rendering
// ============================================================
import { PlayerId, GameState, DEFAULT_CONFIG, PLANET_CAPTURE_THRESHOLD } from '../core/types';
import type { Planet, ShipStream, LevelConfig } from '../core/types';
import { makeRng, dist } from '../utils/math';

let _nextPlanetId = 1;
let _nextStreamId = 1;

export function resetIds(): void {
  _nextPlanetId = 1;
  _nextStreamId = 1;
}

export function createPlanet(
  x: number, y: number,
  ownerId: PlayerId = PlayerId.NONE,
  level: number = 1
): Planet {
  return {
    id: _nextPlanetId++,
    pos: { x, y },
    radius: 16 + level * 3,
    ownerId,
    level: Math.min(level, 5),
    maxLevel: 5,
    productionRate: 1.0,
    pendingShips: 0,
    selected: false,
    hovered: false,
  };
}

export function createStream(
  source: Planet, target: Planet,
  ownerId: PlayerId, shipCount: number
): ShipStream {
  const dx = target.pos.x - source.pos.x;
  const dy = target.pos.y - source.pos.y;
  const perpX = -dy;
  const perpY = dx;
  const d = Math.sqrt(perpX * perpX + perpY * perpY) || 1;
  const offset = d * 0.15;

  const midX = (source.pos.x + target.pos.x) / 2 + (perpX / d) * offset;
  const midY = (source.pos.y + target.pos.y) / 2 + (perpY / d) * offset;

  return {
    id: _nextStreamId++,
    sourceId: source.id,
    targetId: target.id,
    ownerId,
    shipCount,
    progress: 0,
    speed: BASE_SHIP_SPEED / Math.max(dist(source.pos, target.pos), 1),
    controlPoints: [
      { ...source.pos },
      { x: midX, y: midY },
      { ...target.pos },
    ],
    alive: true,
  };
}

const BASE_SHIP_SPEED = 120;

export function generateLevel(config: LevelConfig = DEFAULT_CONFIG): Planet[] {
  resetIds();
  const rng = makeRng(config.seed || Date.now());
  const half = config.mapSize / 2;
  const planets: Planet[] = [];

  // Poisson-like placement
  const minDist = (config.mapSize / Math.sqrt(config.planetCount)) * 0.7;
  const positions: { x: number; y: number }[] = [];

  for (let attempt = 0; attempt < config.planetCount * 50 && positions.length < config.planetCount; attempt++) {
    const x = (rng() - 0.5) * config.mapSize * 0.85;
    const y = (rng() - 0.5) * config.mapSize * 0.85;

    let tooClose = false;
    for (const p of positions) {
      if (dist(p, { x, y }) < minDist) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      positions.push({ x, y });
    }
  }

  const playerCount = config.aiCount + 1;
  const startStep = Math.floor(positions.length / playerCount);

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    let owner = PlayerId.NONE;
    let level = config.neutralLevel;

    for (let p = 0; p < playerCount; p++) {
      const idx = Math.floor(p * startStep + startStep / 2);
      if (i === idx) {
        owner = (p + 1) as PlayerId;
        level = config.startingLevel;
        break;
      }
    }

    planets.push(createPlanet(pos.x, pos.y, owner, level));
  }

  return planets;
}

export function receiveShip(planet: Planet, shipOwnerId: PlayerId, shipCount: number): void {
  if (shipOwnerId === planet.ownerId) {
    planet.pendingShips += shipCount;
  } else {
    planet.pendingShips -= shipCount;
  }
  // Check capture/upgrade
  if (planet.pendingShips >= PLANET_CAPTURE_THRESHOLD) {
    if (shipOwnerId !== planet.ownerId) {
      planet.ownerId = shipOwnerId;
      planet.pendingShips = 0;
      // Update radius
      planet.radius = 16 + planet.level * 3;
    } else {
      if (planet.level < planet.maxLevel) {
        planet.level++;
        planet.radius = 16 + planet.level * 3;
      }
      planet.pendingShips = 0;
    }
  }
}

