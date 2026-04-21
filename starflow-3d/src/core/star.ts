// ============================================================
// Star Flow Command — Star (Sun) Obstacle Generation
// ============================================================

import { type StarData, type PlanetData, type LevelConfig } from './types';
import {
  STAR_MIN_PLANET_DISTANCE,
  STAR_VISUAL_RADIUS_MIN,
  STAR_VISUAL_RADIUS_MAX,
} from './constants';

const STAR_NAMES = [
  'Sol Prime', 'Helios', 'Vega Major', 'Antares Core',
  'Rigel Nova', 'Sirius Omega', 'Polaris Gate', 'Betelgeuse',
  'Aldebaran', 'Capella Rex', 'Canopus', 'Arcturus',
];

function tooCloseToPlanets(
  x: number, y: number, z: number,
  planets: PlanetData[], minDist: number,
): boolean {
  for (const p of planets) {
    const dx = p.x - x;
    const dy = p.y - y;
    const dz = p.z - z;
    if (Math.sqrt(dx * dx + dy * dy + dz * dz) < minDist + p.radius) return true;
  }
  return false;
}

function tooCloseToStars(
  x: number, y: number, z: number,
  stars: StarData[], minDist: number,
): boolean {
  for (const s of stars) {
    const dx = s.x - x;
    const dy = s.y - y;
    const dz = s.z - z;
    if (Math.sqrt(dx * dx + dy * dy + dz * dz) < minDist) return true;
  }
  return false;
}

/** Generate stars for a level. Stars are placed away from planets and each other. */
export function generateStars(
  levelConfig: LevelConfig,
  planets: PlanetData[],
): StarData[] {
  const stars: StarData[] = [];
  const [hMin, hMax] = levelConfig.heightRange;
  const starMinDist = 15; // minimum distance between two stars

  for (let i = 0; i < levelConfig.starCount; i++) {
    for (let attempts = 0; attempts < 300; attempts++) {
      const x = (Math.random() - 0.5) * levelConfig.worldSize * 0.7;
      const y = hMin + Math.random() * (hMax - hMin);
      const z = (Math.random() - 0.5) * levelConfig.worldSize * 0.7;

      if (tooCloseToPlanets(x, y, z, planets, STAR_MIN_PLANET_DISTANCE)) continue;
      if (tooCloseToStars(x, y, z, stars, starMinDist)) continue;

      const visualRadius = STAR_VISUAL_RADIUS_MIN +
        Math.random() * (STAR_VISUAL_RADIUS_MAX - STAR_VISUAL_RADIUS_MIN);

      stars.push({
        id: `star_${i}`,
        name: STAR_NAMES[i % STAR_NAMES.length],
        x, y, z,
        visualRadius,
        seed: i * 777 + 13,
      });
      break;
    }
  }

  return stars;
}

/**
 * Check if a missile at position (mx, my, mz) is within the kill radius of any star.
 * Returns the star that kills the missile, or null.
 */
export function checkStarCollision(
  mx: number, my: number, mz: number,
  stars: StarData[],
  killRadius: number,
): StarData | null {
  for (const star of stars) {
    const dx = star.x - mx;
    const dy = star.y - my;
    const dz = star.z - mz;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < star.visualRadius + killRadius) return star;
  }
  return null;
}

/**
 * Check if a straight line path from (x1,y1,z1) to (x2,y2,z2) passes too close to a star.
 * Used by AI to avoid routing missiles through stars.
 * Returns true if the path is blocked.
 */
export function isPathBlockedByStar(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  stars: StarData[],
  clearance: number,
): boolean {
  for (const star of stars) {
    if (pointToSegmentDist(
      star.x, star.y, star.z,
      x1, y1, z1, x2, y2, z2,
    ) < star.visualRadius + clearance) {
      return true;
    }
  }
  return false;
}

/** Distance from point (px,py,pz) to line segment (ax,ay,az)-(bx,by,bz) */
export function pointToSegmentDist(
  px: number, py: number, pz: number,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
): number {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;

  const abLen2 = abx * abx + aby * aby + abz * abz;
  if (abLen2 < 0.001) {
    return Math.sqrt(apx * apx + apy * apy + apz * apz);
  }

  let t = (apx * abx + apy * aby + apz * abz) / abLen2;
  t = Math.max(0, Math.min(1, t));

  const cx = ax + t * abx;
  const cy = ay + t * aby;
  const cz = az + t * abz;

  const dx = px - cx, dy = py - cy, dz = pz - cz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
