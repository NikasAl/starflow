// ============================================================
// Рой (Swarm) — Demo Mode
// Autopilot flight path, Boids algorithm, spatial hash
// Pure math, no Three.js / DOM dependencies
// ============================================================

import type { BoidData, LeaderData, Waypoint, PlatformData } from './types.ts';
import {
  BOID_COUNT, BOID_MIN_SPEED, BOID_MAX_SPEED, BOID_MAX_FORCE,
  SEPARATION_RADIUS, SEPARATION_WEIGHT,
  PERCEPTION_RADIUS, ALIGNMENT_WEIGHT, COHESION_WEIGHT,
  LEADER_FOLLOW_RADIUS, LEADER_WEIGHT, LEADER_TRAIL_DIST,
  LEADER_SPEED, LEADER_MAX_TURN_RATE, LEADER_MAX_PITCH,
  WORLD_HALF_SIZE,
  WAYPOINT_REACH_DIST, SMOOTH_TURN_FACTOR,
  PLATFORM_COUNT, PLATFORM_RADIUS_MIN, PLATFORM_RADIUS_MAX, RING_RADIUS,
  PLATFORM_HEIGHT_MIN, PLATFORM_HEIGHT_MAX, PLATFORM_SPREAD,
  SPATIAL_CELL_SIZE,
} from './constants.ts';

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

/** Forward direction = where (0,1,0) points after quaternion rotation */
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
// Generate flight path — figure-8 / circuit through platforms
// ============================================================

export function generateWaypoints(platforms: PlatformData[]): Waypoint[] {
  // Build a scenic route that visits each platform in order
  // Use a smooth path: approach each platform, fly through, then curve to next
  const waypoints: Waypoint[] = [];

  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    const next = platforms[(i + 1) % platforms.length];

    // Waypoint AT the platform (fly through the ring)
    waypoints.push({ x: p.x, y: p.y, z: p.z });

    // Midpoint between platforms — for smooth curves
    // Offset perpendicular to the line between them
    const mx = (p.x + next.x) * 0.5;
    const my = (p.y + next.y) * 0.5 + (Math.random() - 0.5) * 4;
    const mz = (p.z + next.z) * 0.5;

    // Perpendicular offset for more interesting curves
    const dx = next.x - p.x;
    const dz = next.z - p.z;
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    const perpX = -dz / len;
    const perpZ = dx / len;
    const curveStrength = 8 + Math.random() * 10;

    waypoints.push({
      x: mx + perpX * curveStrength * (i % 2 === 0 ? 1 : -1),
      y: my,
      z: mz + perpZ * curveStrength * (i % 2 === 0 ? 1 : -1),
    });
  }

  return waypoints;
}

// ============================================================
// Generate platforms with rings
// ============================================================

export function generatePlatforms(): PlatformData[] {
  const platforms: PlatformData[] = [];

  // Create platforms in a spread pattern — not random, more structured
  // Arrange in a loose spiral / figure-8 for interesting flight path
  const count = PLATFORM_COUNT;

  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;

    // Spiral-ish layout with some variation
    const layer = Math.floor(i / 6);
    const angleInLayer = (i % 6) / 6 * Math.PI * 2 + layer * 0.8;

    const spread = PLATFORM_SPREAD * 0.5 + layer * 8;
    const x = Math.cos(angleInLayer) * spread + (Math.random() - 0.5) * 10;
    const z = Math.sin(angleInLayer) * spread + (Math.random() - 0.5) * 10;
    const y = PLATFORM_HEIGHT_MIN + Math.random() * (PLATFORM_HEIGHT_MAX - PLATFORM_HEIGHT_MIN);

    platforms.push({
      x,
      y,
      z,
      radius: PLATFORM_RADIUS_MIN + Math.random() * (PLATFORM_RADIUS_MAX - PLATFORM_RADIUS_MIN),
      ringRadius: RING_RADIUS,
      passed: false,
    });
  }

  return platforms;
}

// ============================================================
// Create initial boid swarm around the leader
// ============================================================

export function createBoids(leader: LeaderData): BoidData[] {
  const boids: BoidData[] = [];
  for (let i = 0; i < BOID_COUNT; i++) {
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
// Update leader — autopilot follows waypoints
// ============================================================

export function updateLeader(
  leader: LeaderData,
  waypoints: Waypoint[],
  dt: number,
): void {
  const maxPitchRad = LEADER_MAX_PITCH * Math.PI / 180;

  if (waypoints.length === 0) return;

  // Current waypoint
  const wp = waypoints[leader.waypointIndex];

  // Direction to waypoint
  const dx = wp.x - leader.x;
  const dy = wp.y - leader.y;
  const dz = wp.z - leader.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Check if reached
  if (dist < WAYPOINT_REACH_DIST) {
    leader.waypointIndex = (leader.waypointIndex + 1) % waypoints.length;
  }

  // Get desired direction (normalized)
  const [ddx, ddy, ddz] = normalize(dx, dy, dz);

  // Smoothly steer toward waypoint using quaternion
  // Extract current forward from quaternion
  const [fx, fy, fz] = quatGetForward(leader.qx, leader.qy, leader.qz, leader.qw);

  // Angle between current forward and desired direction
  const dotForward = fx * ddx + fy * ddy + fz * ddz;
  const turnAmount = Math.acos(Math.max(-1, Math.min(1, dotForward)));

  if (turnAmount > 0.01) {
    // Rotation axis = cross(current forward, desired direction)
    const [rx, ry, rz] = cross(fx, fy, fz, ddx, ddy, ddz);
    const rLen = Math.sqrt(rx * rx + ry * ry + rz * rz);

    if (rLen > 0.001) {
      // Normalize rotation axis
      const nrx = rx / rLen;
      const nry = ry / rLen;
      const nrz = rz / rLen;

      // Clamp turn rate
      const maxTurn = LEADER_MAX_TURN_RATE * dt;
      const clampedTurn = Math.min(turnAmount, maxTurn);

      // Apply rotation
      const qTurn = quatFromAxisAngle(nrx, nry, nrz, clampedTurn);
      const lq = [leader.qx, leader.qy, leader.qz, leader.qw];
      const r = quatMultiply(qTurn, lq);
      leader.qx = r[0]; leader.qy = r[1]; leader.qz = r[2]; leader.qw = r[3];
    }
  }

  // Enforce pitch limit — extract pitch and clamp
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

  // Forward direction from quaternion
  const [finalFx, finalFy, finalFz] = quatGetForward(leader.qx, leader.qy, leader.qz, leader.qw);

  // Smooth velocity
  const velLerp = Math.min(SMOOTH_TURN_FACTOR * dt, 1.0);
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

  for (let i = 0; i < boids.length; i++) {
    const boid = boids[i];
    if (!boid.alive) continue;

    const neighborIndices = hash.query(boid.x, boid.y, boid.z, PERCEPTION_RADIUS);

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

      if (dist < SEPARATION_RADIUS && dist > 0.001) {
        sepX -= ddx / dist;
        sepY -= ddy / dist;
        sepZ -= ddz / dist;
        sepCount++;
      }

      if (dist < PERCEPTION_RADIUS) {
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
        BOID_MAX_SPEED, BOID_MAX_FORCE,
      );
      fx += sfx * SEPARATION_WEIGHT;
      fy += sfy * SEPARATION_WEIGHT;
      fz += sfz * SEPARATION_WEIGHT;
    }

    if (aliCount > 0) {
      aliX /= aliCount; aliY /= aliCount; aliZ /= aliCount;
      const [afx, afy, afz] = steer(
        boid.vx, boid.vy, boid.vz, aliX, aliY, aliZ,
        BOID_MAX_SPEED, BOID_MAX_FORCE,
      );
      fx += afx * ALIGNMENT_WEIGHT;
      fy += afy * ALIGNMENT_WEIGHT;
      fz += afz * ALIGNMENT_WEIGHT;
    }

    if (cohCount > 0) {
      cohX = cohX / cohCount - boid.x;
      cohY = cohY / cohCount - boid.y;
      cohZ = cohZ / cohCount - boid.z;
      const [cfx, cfy, cfz] = steer(
        boid.vx, boid.vy, boid.vz, cohX, cohY, cohZ,
        BOID_MAX_SPEED, BOID_MAX_FORCE,
      );
      fx += cfx * COHESION_WEIGHT;
      fy += cfy * COHESION_WEIGHT;
      fz += cfz * COHESION_WEIGHT;
    }

    // Follow trail point behind leader
    const [lvx, lvy, lvz] = normalize(leader.vx, leader.vy, leader.vz);
    const trailX = leader.x - lvx * LEADER_TRAIL_DIST;
    const trailY = leader.y - lvy * LEADER_TRAIL_DIST;
    const trailZ = leader.z - lvz * LEADER_TRAIL_DIST;

    const ldx = trailX - boid.x;
    const ldy = trailY - boid.y;
    const ldz = trailZ - boid.z;
    const ldist = Math.sqrt(ldx * ldx + ldy * ldy + ldz * ldz);

    if (ldist < LEADER_FOLLOW_RADIUS && ldist > 0.001) {
      const [lfx, lfy, lfz] = steer(
        boid.vx, boid.vy, boid.vz, ldx, ldy, ldz,
        BOID_MAX_SPEED, BOID_MAX_FORCE * 1.5,
      );
      fx += lfx * LEADER_WEIGHT;
      fy += lfy * LEADER_WEIGHT;
      fz += lfz * LEADER_WEIGHT;
    } else if (ldist >= LEADER_FOLLOW_RADIUS) {
      const [lfx, lfy, lfz] = steer(
        boid.vx, boid.vy, boid.vz, ldx, ldy, ldz,
        BOID_MAX_SPEED, BOID_MAX_FORCE * 3,
      );
      fx += lfx * LEADER_WEIGHT * 2;
      fy += lfy * LEADER_WEIGHT * 2;
      fz += lfz * LEADER_WEIGHT * 2;
    }

    // Align with leader direction
    const [lafx, lafy, lafz] = steer(
      boid.vx, boid.vy, boid.vz, lvx, lvy, lvz,
      BOID_MAX_SPEED, BOID_MAX_FORCE,
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

    // Hard clamp to world bounds
    const limit = WORLD_HALF_SIZE - 1;
    boid.x = Math.max(-limit, Math.min(limit, boid.x));
    boid.y = Math.max(-limit, Math.min(limit, boid.y));
    boid.z = Math.max(-limit, Math.min(limit, boid.z));
  }
}
