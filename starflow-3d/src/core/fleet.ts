// ============================================================
// Star Flow Command — Fleet Logic
// ============================================================

import { type FleetData, type OwnerId } from './types';
import { FLEET_SPEED } from './constants';

let fleetCounter = 0;

/** Create a new fleet heading from source to target */
export function createFleet(
  owner: OwnerId,
  ships: number,
  sourceId: string,
  targetId: string,
  sx: number, sy: number, sz: number,
  tx: number, ty: number, tz: number,
): FleetData {
  return {
    id: `fleet_${++fleetCounter}`,
    owner,
    ships,
    sourceId,
    targetId,
    progress: 0,
    speed: FLEET_SPEED,
    x: sx,
    y: sy,
    z: sz,
  };
}

/** Update fleet position. Returns true if arrived. */
export function updateFleet(
  fleet: FleetData,
  sx: number, sy: number, sz: number,  // source position
  tx: number, ty: number, tz: number,  // target position
  dt: number,
): boolean {
  const dx = tx - sx;
  const dy = ty - sy;
  const dz = tz - sz;
  const totalDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (totalDist < 0.01) return true;

  const moveAmount = (fleet.speed * dt) / totalDist;
  fleet.progress += moveAmount;

  if (fleet.progress >= 1.0) {
    fleet.progress = 1.0;
    fleet.x = tx;
    fleet.y = ty;
    fleet.z = tz;
    return true; // arrived
  }

  // Interpolate position
  fleet.x = sx + dx * fleet.progress;
  fleet.y = sy + dy * fleet.progress + Math.sin(fleet.progress * Math.PI) * 3;
  fleet.z = sz + dz * fleet.progress;

  return false;
}
