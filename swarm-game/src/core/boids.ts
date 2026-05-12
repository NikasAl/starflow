// ============================================================
// Рой (Swarm) — Demo Mode
// Smooth spline flight path, Boids algorithm, spatial hash
// Pure math, no Three.js / DOM dependencies
// ============================================================

import type { BoidData, LeaderData, PlatformData } from './types.ts';
import {
  tuning,
  BOID_MIN_SPEED, BOID_MAX_SPEED,
  LEADER_SPEED, LEADER_MAX_TURN_RATE, LEADER_MAX_PITCH,
  WORLD_HALF_SIZE,
  PATH_SAMPLES, PLATFORM_SPACING, PATH_LOOK_AHEAD,
  PLATFORM_RADIUS_MIN, PLATFORM_RADIUS_MAX, RING_RADIUS,
  CURVE_RADIUS_MAIN, CURVE_RADIUS_MOD, CURVE_HEIGHT_AMP,
  SPATIAL_CELL_SIZE,
} from './constants.ts';

// Re-export tuning for debug panel access
export { tuning };

// ============================================================
// Spatial Hash — O(n) neighbor queries
// ============================================================

export class SpatialHash {
  private cells = new Map<string, number[]>();
  private cellSize: number;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  clear(): void {
    this.cells.clear();
  }

  private key(cx: number, cy: number, cz: number): string {
    return `${cx},${cy},${cz}`;
  }

  insert(index: number, x: number, y: number, z: number): void {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    const k = this.key(cx, cy, cz);
    let arr = this.cells.get(k);
    if (!arr) {
      arr = [];
      this.cells.set(k, arr);
    }
    arr.push(index);
  }

  query(x: number, y: number, z: number, radius: number): number[] {
    const result: number[] = [];
    const cr = Math.ceil(radius / this.cellSize);
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const cz = Math.floor(z / this.cellSize);

    for (let dx = -cr; dx <= cr; dx++) {
      for (let dy = -cr; dy <= cr; dy++) {
        for (let dz = -cr; dz <= cr; dz++) {
          const arr = this.cells.get(this.key(cx + dx, cy + dy, cz + dz));
          if (arr) {
            for (let i = 0; i < arr.length; i++) {
              result.push(arr[i]);
            }
          }
        }
      }
    }
    return result;
  }
}

// ============================================================
// Vector math helpers
// ============================================================

function normalize(x: number, y: number, z: number): [number, number, number] {
  const len = Math.sqrt(x * x + y * y + z * z);
  if (len < 1e-8) return [0, 0, 1];
  return [x / len, y / len, z / len];
}

function cross(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
): [number, number, number] {
  return [
    ay * bz - az * by,
    az * bx - ax * bz,
    ax * by - ay * bx,
  ];
}

// ============================================================
// Steer toward target velocity (Reynolds' steering)
// ============================================================

function steer(
  vx: number, vy: number, vz: number,
  desiredX: number, desiredY: number, desiredZ: number,
  maxSpeed: number, maxForce: number,
): [number, number, number] {
  let [dx, dy, dz] = normalize(desiredX, desiredY, desiredZ);
  dx *= maxSpeed;
  dy *= maxSpeed;
  dz *= maxSpeed;

  let fx = dx - vx;
  let fy = dy - vy;
  let fz = dz - vz;

  const fmag = Math.sqrt(fx * fx + fy * fy + fz * fz);
  if (fmag > maxForce) {
    fx = (fx / fmag) * maxForce;
    fy = (fy / fmag) * maxForce;
    fz = (fz / fmag) * maxForce;
  }
  return [fx, fy, fz];
}

// ============================================================
// Quaternion helpers
// ============================================================

function quatFromAxisAngle(
  ax: number, ay: number, az: number, angle: number,
): [number, number, number, number] {
  const halfAngle = angle * 0.5;
  const sin = Math.sin(halfAngle);
  return [ax * sin, ay * sin, az * sin, Math.cos(halfAngle)];
}

function quatMultiply(
  a: number[], b: number[],
): [number, number, number, number] {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

function quatRotateDir(
  dx: number, dy: number, dz: number,
  qx: number, qy: number, qz: number, qw: number,
): [number, number, number] {
  const tx = 2 * (qy * dz - qz * dy);
  const ty = 2 * (qz * dx - qx * dz);
  const tz = 2 * (qx * dy - qy * dx);
  return [
    dx + qw * tx + qy * tz - qz * ty,
    dy + qw * ty + qz * tx - qx * tz,
    dz + qw * tz + qx * ty - qy * tx,
  ];
}

function quatGetForward(
  qx: number, qy: number, qz: number, qw: number,
): [number, number, number] {
  return quatRotateDir(0, 1, 0, qx, qy, qz, qw);
}

function quatGetRight(
  qx: number, qy: number, qz: number, qw: number,
): [number, number, number] {
  return quatRotateDir(1, 0, 0, qx, qy, qz, qw);
}

// ============================================================
// Parametric 3D curve — smooth figure-8 with height waves
// C∞ smooth, no sharp corners possible
// ============================================================

function curvePoint(t: number): [number, number, number] {
  const R = CURVE_RADIUS_MAIN;
  const r = CURVE_RADIUS_MOD;
  const H = CURVE_HEIGHT_AMP;

  const x = R * Math.sin(t) + r * Math.sin(3 * t);
  const z = R * Math.cos(t) + r * Math.cos(2 * t);
  const y = H * Math.sin(2 * t) + 3 * Math.sin(5 * t);

  return [x, y, z];
}

// ============================================================
// Generate smooth flight path and platform positions
// Returns { path: dense array of [x,y,z], platforms: PlatformData[] }
// ============================================================

export function generateFlightPath(): {
  path: [number, number, number][];
  platforms: PlatformData[];
} {
  const path: [number, number, number][] = [];

  // Dense sampling of the parametric curve
  for (let i = 0; i < PATH_SAMPLES; i++) {
    const t = (i / PATH_SAMPLES) * Math.PI * 2;
    path.push(curvePoint(t));
  }

  // Place platforms at equal intervals along the path
  const platforms: PlatformData[] = [];
  const interval = Math.floor(PATH_SAMPLES / (PATH_SAMPLES / PLATFORM_SPACING));

  // Spread platforms evenly: total ≈ 18 platforms
  const platformCount = Math.floor(PATH_SAMPLES / PLATFORM_SPACING);
  for (let i = 0; i < platformCount; i++) {
    const idx = i * PLATFORM_SPACING;
    const [x, y, z] = path[idx];

    platforms.push({
      x, y, z,
      radius: PLATFORM_RADIUS_MIN + Math.random() * (PLATFORM_RADIUS_MAX - PLATFORM_RADIUS_MIN),
      ringRadius: RING_RADIUS,
      passed: false,
    });
  }

  return { path, platforms };
}

// ============================================================
// Create initial boid swarm around the leader
// ============================================================

export function createBoids(leader: LeaderData, count: number): BoidData[] {
  const boids: BoidData[] = [];
  for (let i = 0; i < count; i++) {
    const ox = (Math.random() - 0.5) * 12;
    const oy = (Math.random() - 0.5) * 6;
    const oz = (Math.random() - 0.5) * 12;

    const speed = BOID_MIN_SPEED + Math.random() * (BOID_MAX_SPEED - BOID_MIN_SPEED);
    const spread = 0.3;
    boids.push({
      x: leader.x + ox,
      y: leader.y + oy,
      z: leader.z + oz,
      vx: leader.vx + (Math.random() - 0.5) * spread * speed,
      vy: leader.vy + (Math.random() - 0.5) * spread * speed,
      vz: leader.vz + (Math.random() - 0.5) * spread * speed,
      alive: true,
    });
  }
  return boids;
}

// ============================================================
// Update leader — follows dense path smoothly
// ============================================================

export function updateLeader(
  leader: LeaderData,
  path: [number, number, number][],
  dt: number,
): void {
  if (path.length === 0) return;

  const maxPitchRad = LEADER_MAX_PITCH * Math.PI / 180;

  // Current target point on the path
  const target = path[leader.waypointIndex];

  // Direction to current target
  const dx = target[0] - leader.x;
  const dy = target[1] - leader.y;
  const dz = target[2] - leader.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Advance along path when close enough to current point
  if (dist < 3.0) {
    leader.waypointIndex = (leader.waypointIndex + 1) % path.length;
  }

  // Steer toward current path point
  const [ddx, ddy, ddz] = normalize(dx, dy, dz);
  const [fx, fy, fz] = quatGetForward(leader.qx, leader.qy, leader.qz, leader.qw);

  const dotForward = fx * ddx + fy * ddy + fz * ddz;
  const turnAmount = Math.acos(Math.max(-1, Math.min(1, dotForward)));

  if (turnAmount > 0.01) {
    const [rx, ry, rz] = cross(fx, fy, fz, ddx, ddy, ddz);
    const rLen = Math.sqrt(rx * rx + ry * ry + rz * rz);

    if (rLen > 0.001) {
      const maxTurn = LEADER_MAX_TURN_RATE * dt;
      const clampedTurn = Math.min(turnAmount, maxTurn);

      const qTurn = quatFromAxisAngle(rx / rLen, ry / rLen, rz / rLen, clampedTurn);
      const lq = [leader.qx, leader.qy, leader.qz, leader.qw];
      const r = quatMultiply(qTurn, lq);
      leader.qx = r[0]; leader.qy = r[1]; leader.qz = r[2]; leader.qw = r[3];
    }
  }

  // Enforce pitch limit
  const [newFx, newFy, newFz] = quatGetForward(leader.qx, leader.qy, leader.qz, leader.qw);
  let currentPitch = Math.asin(Math.max(-1, Math.min(1, newFy)));

  if (Math.abs(currentPitch) > maxPitchRad) {
    const clampedPitch = Math.sign(currentPitch) * maxPitchRad;
    const deltaPitch = clampedPitch - currentPitch;

    if (Math.abs(deltaPitch) > 0.0001) {
      const [rightX, rightY, rightZ] = quatGetRight(leader.qx, leader.qy, leader.qz, leader.qw);
      const qPitch = quatFromAxisAngle(rightX, rightY, rightZ, deltaPitch);
      const lq = [leader.qx, leader.qy, leader.qz, leader.qw];
      const rp = quatMultiply(qPitch, lq);
      leader.qx = rp[0]; leader.qy = rp[1]; leader.qz = rp[2]; leader.qw = rp[3];
    }
  }

  // Normalize quaternion
  const qLen = Math.sqrt(
    leader.qx * leader.qx + leader.qy * leader.qy +
    leader.qz * leader.qz + leader.qw * leader.qw
  );
  if (qLen > 0.001) {
    leader.qx /= qLen; leader.qy /= qLen;
    leader.qz /= qLen; leader.qw /= qLen;
  }

  // Velocity from forward direction
  const [finalFx, finalFy, finalFz] = quatGetForward(leader.qx, leader.qy, leader.qz, leader.qw);
  const velLerp = Math.min(5.0 * dt, 1.0);
  const targetVx = finalFx * LEADER_SPEED;
  const targetVy = finalFy * LEADER_SPEED;
  const targetVz = finalFz * LEADER_SPEED;
  leader.vx += (targetVx - leader.vx) * velLerp;
  leader.vy += (targetVy - leader.vy) * velLerp;
  leader.vz += (targetVz - leader.vz) * velLerp;

  leader.x += leader.vx * dt;
  leader.y += leader.vy * dt;
  leader.z += leader.vz * dt;

  // Soft world boundary
  const clamp = WORLD_HALF_SIZE - 5;
  const bounce = 0.5;
  if (leader.x > clamp) leader.vx -= bounce * (leader.x - clamp);
  if (leader.x < -clamp) leader.vx -= bounce * (leader.x + clamp);
  if (leader.y > clamp) leader.vy -= bounce * (leader.y - clamp);
  if (leader.y < -clamp) leader.vy -= bounce * (leader.y + clamp);
  if (leader.z > clamp) leader.vz -= bounce * (leader.z - clamp);
  if (leader.z < -clamp) leader.vz -= bounce * (leader.z + clamp);
}

// ============================================================
// Update all boids (main Boids algorithm)
// ============================================================

export function updateBoids(
  boids: BoidData[],
  leader: LeaderData,
  dt: number,
  hash: SpatialHash,
): void {
  const forces = new Float32Array(boids.length * 3);

  const sepRad = tuning.separationRadius;
  const sepW = tuning.separationWeight;
  const percRad = tuning.perceptionRadius;
  const aliW = tuning.alignmentWeight;
  const cohW = tuning.cohesionWeight;
  const maxF = tuning.maxForce;
  const followRad = tuning.leaderFollowRadius;
  const leaderW = tuning.leaderWeight;
  const trailDist = tuning.leaderTrailDist;

  for (let i = 0; i < boids.length; i++) {
    const boid = boids[i];
    if (!boid.alive) continue;

    const neighborIndices = hash.query(boid.x, boid.y, boid.z, percRad);

    let sepX = 0, sepY = 0, sepZ = 0, sepCount = 0;
    let aliX = 0, aliY = 0, aliZ = 0, aliCount = 0;
    let cohX = 0, cohY = 0, cohZ = 0, cohCount = 0;

    for (let n = 0; n < neighborIndices.length; n++) {
      const j = neighborIndices[n];
      if (j === i) continue;
      const other = boids[j];
      if (!other.alive) continue;

      const ddx = other.x - boid.x;
      const ddy = other.y - boid.y;
      const ddz = other.z - boid.z;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);

      if (dist < sepRad && dist > 0.001) {
        sepX -= ddx / dist;
        sepY -= ddy / dist;
        sepZ -= ddz / dist;
        sepCount++;
      }

      if (dist < percRad) {
        aliX += other.vx;
        aliY += other.vy;
        aliZ += other.vz;
        aliCount++;

        cohX += other.x;
        cohY += other.y;
        cohZ += other.z;
        cohCount++;
      }
    }

    let fi = i * 3;
    let fx = forces[fi];
    let fy = forces[fi + 1];
    let fz = forces[fi + 2];

    if (sepCount > 0) {
      sepX /= sepCount; sepY /= sepCount; sepZ /= sepCount;
      const [sfx, sfy, sfz] = steer(
        boid.vx, boid.vy, boid.vz, sepX, sepY, sepZ,
        BOID_MAX_SPEED, maxF,
      );
      fx += sfx * sepW;
      fy += sfy * sepW;
      fz += sfz * sepW;
    }

    if (aliCount > 0) {
      aliX /= aliCount; aliY /= aliCount; aliZ /= aliCount;
      const [afx, afy, afz] = steer(
        boid.vx, boid.vy, boid.vz, aliX, aliY, aliZ,
        BOID_MAX_SPEED, maxF,
      );
      fx += afx * aliW;
      fy += afy * aliW;
      fz += afz * aliW;
    }

    if (cohCount > 0) {
      cohX = cohX / cohCount - boid.x;
      cohY = cohY / cohCount - boid.y;
      cohZ = cohZ / cohCount - boid.z;
      const [cfx, cfy, cfz] = steer(
        boid.vx, boid.vy, boid.vz, cohX, cohY, cohZ,
        BOID_MAX_SPEED, maxF,
      );
      fx += cfx * cohW;
      fy += cfy * cohW;
      fz += cfz * cohW;
    }

    // Follow trail point behind leader
    const [lvx, lvy, lvz] = normalize(leader.vx, leader.vy, leader.vz);
    const trailX = leader.x - lvx * trailDist;
    const trailY = leader.y - lvy * trailDist;
    const trailZ = leader.z - lvz * trailDist;

    const ldx = trailX - boid.x;
    const ldy = trailY - boid.y;
    const ldz = trailZ - boid.z;
    const ldist = Math.sqrt(ldx * ldx + ldy * ldy + ldz * ldz);

    if (ldist < followRad && ldist > 0.001) {
      const [lfx, lfy, lfz] = steer(
        boid.vx, boid.vy, boid.vz, ldx, ldy, ldz,
        BOID_MAX_SPEED, maxF * 1.5,
      );
      fx += lfx * leaderW;
      fy += lfy * leaderW;
      fz += lfz * leaderW;
    } else if (ldist >= followRad) {
      const [lfx, lfy, lfz] = steer(
        boid.vx, boid.vy, boid.vz, ldx, ldy, ldz,
        BOID_MAX_SPEED, maxF * 3,
      );
      fx += lfx * leaderW * 2;
      fy += lfy * leaderW * 2;
      fz += lfz * leaderW * 2;
    }

    // Align with leader direction
    const [lafx, lafy, lafz] = steer(
      boid.vx, boid.vy, boid.vz, lvx, lvy, lvz,
      BOID_MAX_SPEED, maxF,
    );
    fx += lafx * 0.5;
    fy += lafy * 0.5;
    fz += lafz * 0.5;

    forces[fi] = fx;
    forces[fi + 1] = fy;
    forces[fi + 2] = fz;
  }

  for (let i = 0; i < boids.length; i++) {
    const boid = boids[i];
    if (!boid.alive) continue;

    const fi = i * 3;
    boid.vx += forces[fi];
    boid.vy += forces[fi + 1];
    boid.vz += forces[fi + 2];

    const speed = Math.sqrt(boid.vx * boid.vx + boid.vy * boid.vy + boid.vz * boid.vz);
    if (speed > BOID_MAX_SPEED) {
      const scale = BOID_MAX_SPEED / speed;
      boid.vx *= scale; boid.vy *= scale; boid.vz *= scale;
    } else if (speed < BOID_MIN_SPEED) {
      const scale = BOID_MIN_SPEED / (speed || 1);
      boid.vx *= scale; boid.vy *= scale; boid.vz *= scale;
    }

    boid.x += boid.vx * dt;
    boid.y += boid.vy * dt;
    boid.z += boid.vz * dt;

    const limit = WORLD_HALF_SIZE - 1;
    boid.x = Math.max(-limit, Math.min(limit, boid.x));
    boid.y = Math.max(-limit, Math.min(limit, boid.y));
    boid.z = Math.max(-limit, Math.min(limit, boid.z));
  }
}
