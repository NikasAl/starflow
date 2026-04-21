// ============================================================
// Star Flow Command — Missile (Fleet) Logic
// ============================================================

import { type MissileData, type OwnerId, type PlanetData } from './types';
import { MISSILE_SPEED, GRAVITY_WELL_RADIUS, GRAVITY_WELL_MIN_PLANET_RADIUS } from './constants';

let missileCounter = 0;

/** Create a new missile */
export function createMissile(
  owner: OwnerId,
  strength: 1 | 2,
  sourceId: string,
  targetId: string,
  sx: number, sy: number, sz: number,
  tx: number, ty: number, tz: number,
): MissileData {
  return {
    id: `missile_${++missileCounter}`,
    owner,
    strength,
    sourceId,
    targetId,
    progress: 0,
    speed: MISSILE_SPEED,
    x: sx,
    y: sy,
    z: sz,
  };
}

/**
 * Update missile position in a straight line with gravity slow-down.
 * Returns true if arrived.
 */
export function updateMissile(
  missile: MissileData,
  sx: number, sy: number, sz: number,
  tx: number, ty: number, tz: number,
  dt: number,
  planets: PlanetData[],
): boolean {
  const dx = tx - sx;
  const dy = ty - sy;
  const dz = tz - sz;
  const totalDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (totalDist < 0.01) return true;

  // Calculate gravity slow-down from nearby large planets
  let speedMultiplier = 1.0;
  for (const planet of planets) {
    if (planet.radius < GRAVITY_WELL_MIN_PLANET_RADIUS) continue;
    // Skip source and target planets (they don't slow missiles)
    if (planet.id === missile.sourceId || planet.id === missile.targetId) continue;

    const pdx = planet.x - missile.x;
    const pdy = planet.y - missile.y;
    const pdz = planet.z - missile.z;
    const dist = Math.sqrt(pdx * pdx + pdy * pdy + pdz * pdz);
    const gravRange = GRAVITY_WELL_RADIUS + planet.radius;

    if (dist < gravRange) {
      // Slow down proportional to proximity: max 60% slow-down at surface
      const t = 1 - (dist / gravRange); // 0 at edge, 1 at center
      const slowdown = t * t * 0.6; // quadratic falloff, max 60% slow
      speedMultiplier *= (1 - slowdown);
    }
  }

  speedMultiplier = Math.max(0.2, speedMultiplier); // never slower than 20% base speed

  const moveAmount = (missile.speed * dt * speedMultiplier) / totalDist;
  missile.progress += moveAmount;

  if (missile.progress >= 1.0) {
    missile.progress = 1.0;
    missile.x = tx;
    missile.y = ty;
    missile.z = tz;
    return true;
  }

  // Straight line movement (no arc)
  missile.x = sx + dx * missile.progress;
  missile.y = sy + dy * missile.progress;
  missile.z = sz + dz * missile.progress;

  return false;
}
