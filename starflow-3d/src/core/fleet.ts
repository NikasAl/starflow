// ============================================================
// Star Flow Command — Missile (Fleet) Logic
// ============================================================

import { type MissileData, type OwnerId } from './types';
import { MISSILE_SPEED } from './constants';

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

/** Update missile position in a straight line. Returns true if arrived. */
export function updateMissile(
  missile: MissileData,
  sx: number, sy: number, sz: number,
  tx: number, ty: number, tz: number,
  dt: number,
): boolean {
  const dx = tx - sx;
  const dy = ty - sy;
  const dz = tz - sz;
  const totalDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (totalDist < 0.01) return true;

  const moveAmount = (missile.speed * dt) / totalDist;
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
