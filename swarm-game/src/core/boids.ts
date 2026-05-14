// ============================================================
// Рой — Собиратель (Swarm: Collector) — Core Simulation
// Boids algorithm, spatial hash, collection, portal
// Pure math, no Three.js / DOM dependencies
// ============================================================

import type { BoidData, BoidType, BoidState, LeaderData, PortalData, LevelConfig } from './types.ts';
import {
  tuning,
  BOID_MIN_SPEED, BOID_MAX_SPEED,
  LEADER_SPEED, LEADER_MAX_TURN_RATE, LEADER_MAX_PITCH,
  LEADER_BOOST_MULT, LEADER_BOOST_DURATION, LEADER_BOOST_COOLDOWN,
  COLLECTION_RADIUS, PORTAL_CAPTURE_DIST, PORTAL_BONUS_RADIUS,
  FREE_SPEED_MIN, FREE_SPEED_MAX,
  WORLD_HALF_SIZE,
  SPATIAL_CELL_SIZE,
  randomBoidType,
  BOID_COLORS,
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

/** Build initial quaternion from a direction vector using cross-product axis rotation */
export function quatFromDir(fx: number, fy: number, fz: number): [number, number, number, number] {
  const dot = fy; // dot((0,1,0), (fx,fy,fz))
  if (dot > 0.9999) return [0, 0, 0, 1];
  if (dot < -0.9999) return [1, 0, 0, 0];
  const cx = 0 * fz - 1 * fy; // uy*fz - uz*fy = 0*fz - 1*fy = -fy... wait
  // cross((0,1,0), (fx,fy,fz)) = (1*fz-0*fy, 0*fx-0*fz, 0*fy-1*fx) = (fz, 0, -fx)
  const ax = fz;
  const ay = 0;
  const az = -fx;
  const aLen = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
  return quatFromAxisAngle(ax / aLen, ay / aLen, az / aLen, angle);
}

// ============================================================
// Catmull-Rom spline interpolation for route
// ============================================================

function catmullRomPoint(
  t: number,
  p0: number, p1: number, p2: number, p3: number,
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function splinePoint(
  waypoints: [number, number, number][],
  t: number, // 0..1 along the whole spline
): [number, number, number] {
  const n = waypoints.length - 1;
  const scaledT = t * n;
  const i = Math.min(Math.floor(scaledT), n - 1);
  const frac = scaledT - i;

  // Clamp indices for Catmull-Rom boundary
  const i0 = Math.max(0, i - 1);
  const i1 = i;
  const i2 = Math.min(n, i + 1);
  const i3 = Math.min(n, i + 2);

  return [
    catmullRomPoint(frac, waypoints[i0][0], waypoints[i1][0], waypoints[i2][0], waypoints[i3][0]),
    catmullRomPoint(frac, waypoints[i0][1], waypoints[i1][1], waypoints[i2][1], waypoints[i3][1]),
    catmullRomPoint(frac, waypoints[i0][2], waypoints[i1][2], waypoints[i2][2], waypoints[i3][2]),
  ];
}

/** Default route when level has no custom waypoints */
const DEFAULT_ROUTE: [number, number, number][] = [
  [-60, 5, -20],
  [-30, -5, 30],
  [0, 8, -10],
  [25, -3, 35],
  [50, 5, 10],
  [35, -8, -30],
  [10, 3, -50],
  [-25, 10, -40],
  [-55, 0, 0],
  [-30, -5, 25],
];

/** Get route waypoints for a level (custom or default) */
export function getRouteWaypoints(level: LevelConfig): [number, number, number][] {
  return level.routeWaypoints && level.routeWaypoints.length >= 2
    ? level.routeWaypoints
    : DEFAULT_ROUTE;
}

/** Generate buoy positions along the route */
export function generateBuoys(level: LevelConfig): [number, number, number][] {
  const waypoints = getRouteWaypoints(level);
  const buoyCount = Math.max(6, Math.ceil(waypoints.length * 1.5));
  const buoys: [number, number, number][] = [];

  for (let i = 0; i < buoyCount; i++) {
    const t = (i + 0.5) / buoyCount;
    const [bx, by, bz] = splinePoint(waypoints, t);
    buoys.push([bx, by, bz]);
  }

  return buoys;
}

// ============================================================
// Create boids for a level
// ============================================================

export function createBoids(level: LevelConfig): BoidData[] {
  const boids: BoidData[] = [];
  const waypoints = getRouteWaypoints(level);
  const freeCount = level.totalBoids - level.startBoids;

  // Collected boids: start near leader at origin
  for (let i = 0; i < level.startBoids; i++) {
    const type = randomBoidType();
    const bx = (Math.random() - 0.5) * 8;
    const by = (Math.random() - 0.5) * 4;
    const bz = (Math.random() - 0.5) * 8;
    const speed = BOID_MIN_SPEED + Math.random() * (BOID_MAX_SPEED - BOID_MIN_SPEED) * 0.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    boids.push({
      x: bx, y: by, z: bz,
      vx: Math.sin(phi) * Math.cos(theta) * speed,
      vy: Math.sin(phi) * Math.sin(theta) * speed,
      vz: Math.cos(phi) * speed,
      alive: true, type, state: 'collected',
      freeWanderAngle: Math.random() * Math.PI * 2,
    });
  }

  // Free boids: distributed evenly along the route with small random offset
  for (let i = 0; i < freeCount; i++) {
    const type = randomBoidType();
    const t = freeCount > 1 ? i / (freeCount - 1) : 0.5;
    const [sx, sy, sz] = splinePoint(waypoints, t);

    // Small scatter around the route point
    const scatter = 6;
    const bx = sx + (Math.random() - 0.5) * scatter * 2;
    const by = sy + (Math.random() - 0.5) * scatter;
    const bz = sz + (Math.random() - 0.5) * scatter * 2;

    const speed = FREE_SPEED_MIN + Math.random() * (FREE_SPEED_MAX - FREE_SPEED_MIN);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    boids.push({
      x: bx, y: by, z: bz,
      vx: Math.sin(phi) * Math.cos(theta) * speed,
      vy: Math.sin(phi) * Math.sin(theta) * speed,
      vz: Math.cos(phi) * speed,
      alive: true, type, state: 'free',
      freeWanderAngle: Math.random() * Math.PI * 2,
    });
  }

  return boids;
}

// ============================================================
// Update free boids — inert drifting with slight wandering
// ============================================================

export function updateFreeBoids(boids: BoidData[], dt: number): void {
  for (let i = 0; i < boids.length; i++) {
    const boid = boids[i];
    if (boid.state !== 'free') continue;

    // Slowly change wander angle
    boid.freeWanderAngle += (Math.random() - 0.5) * 2.0 * dt;

    // Apply gentle wander force
    const wanderX = Math.cos(boid.freeWanderAngle) * 0.1;
    const wanderZ = Math.sin(boid.freeWanderAngle) * 0.1;
    const wanderY = (Math.random() - 0.5) * 0.05;

    boid.vx += wanderX * dt;
    boid.vy += wanderY * dt;
    boid.vz += wanderZ * dt;

    // Clamp speed to free drift range
    const speed = Math.sqrt(boid.vx * boid.vx + boid.vy * boid.vy + boid.vz * boid.vz);
    if (speed > FREE_SPEED_MAX) {
      const scale = FREE_SPEED_MAX / speed;
      boid.vx *= scale;
      boid.vy *= scale;
      boid.vz *= scale;
    } else if (speed < FREE_SPEED_MIN && speed > 0.001) {
      const scale = FREE_SPEED_MIN / speed;
      boid.vx *= scale;
      boid.vy *= scale;
      boid.vz *= scale;
    }

    boid.x += boid.vx * dt;
    boid.y += boid.vy * dt;
    boid.z += boid.vz * dt;

    // Soft world boundary for free boids
    const limit = WORLD_HALF_SIZE - 2;
    const bounce = 0.3;
    if (boid.x > limit) { boid.vx -= bounce * (boid.x - limit); }
    if (boid.x < -limit) { boid.vx -= bounce * (boid.x + limit); }
    if (boid.y > limit) { boid.vy -= bounce * (boid.y - limit); }
    if (boid.y < -limit) { boid.vy -= bounce * (boid.y + limit); }
    if (boid.z > limit) { boid.vz -= bounce * (boid.z - limit); }
    if (boid.z < -limit) { boid.vz -= bounce * (boid.z + limit); }
  }
}

// ============================================================
// Collect boids — attract free boids within radius, convert to collected
// ============================================================

export function collectBoids(boids: BoidData[], leader: LeaderData): number {
  let newCollected = 0;

  for (let i = 0; i < boids.length; i++) {
    const boid = boids[i];
    if (boid.state !== 'free') continue;

    const dx = leader.x - boid.x;
    const dy = leader.y - boid.y;
    const dz = leader.z - boid.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < COLLECTION_RADIUS) {
      // Attract toward leader
      const attractionStrength = 8.0 * (1.0 - dist / COLLECTION_RADIUS);
      if (dist > 0.001) {
        boid.vx += (dx / dist) * attractionStrength * 0.016; // dt approximation
        boid.vy += (dy / dist) * attractionStrength * 0.016;
        boid.vz += (dz / dist) * attractionStrength * 0.016;
      }

      // When close enough to trail point, convert to collected
      const trailDist = tuning.leaderTrailDist;
      if (dist < trailDist) {
        boid.state = 'collected';
        // Accelerate to swarm speed
        const speed = Math.sqrt(boid.vx * boid.vx + boid.vy * boid.vy + boid.vz * boid.vz);
        if (speed < BOID_MIN_SPEED) {
          const scale = BOID_MIN_SPEED / Math.max(speed, 0.001);
          boid.vx *= scale;
          boid.vy *= scale;
          boid.vz *= scale;
        }
        newCollected++;
      }
    }
  }

  return newCollected;
}

// ============================================================
// Check portal — collected boids near portal become passed
// ============================================================

export function checkPortal(boids: BoidData[], portal: PortalData): { passed: number; score: number } {
  let passed = 0;
  let score = 0;

  for (let i = 0; i < boids.length; i++) {
    const boid = boids[i];
    if (boid.state !== 'collected') continue;

    const dx = boid.x - portal.x;
    const dy = boid.y - portal.y;
    const dz = boid.z - portal.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < PORTAL_CAPTURE_DIST) {
      boid.state = 'passed';
      boid.x = 0;
      boid.y = -9999;
      boid.z = 0;

      // Score: base + bonus for center
      const typeInfo = BOID_COLORS[boid.type];
      let points = typeInfo.score;
      if (dist < PORTAL_BONUS_RADIUS) {
        points *= 2; // Center bonus
      }
      score += points;
      passed++;
    }
  }

  return { passed, score };
}

// ============================================================
// Update leader — player-controlled, separated yaw / pitch
// Zero roll guaranteed by reconstructing quaternion each frame
// Auto-levels pitch when no vertical input
// ============================================================

export function updateLeader(
  leader: LeaderData,
  inputDir: { x: number; y: number },
  wantsBoost: boolean,
  _cameraQuatX: number, _cameraQuatY: number, _cameraQuatZ: number, _cameraQuatW: number,
  dt: number,
): void {
  const maxPitchRad = LEADER_MAX_PITCH * Math.PI / 180;
  const currentSpeed = LEADER_SPEED * (leader.boostActive > 0 ? LEADER_BOOST_MULT : 1.0);

  // Handle boost cooldown and duration
  if (wantsBoost && leader.boostCooldown <= 0 && leader.boostActive <= 0) {
    leader.boostActive = LEADER_BOOST_DURATION;
    leader.boostCooldown = LEADER_BOOST_COOLDOWN;
  }
  if (leader.boostActive > 0) leader.boostActive -= dt;
  if (leader.boostCooldown > 0) leader.boostCooldown -= dt;

  // --- Decompose current orientation into yaw and pitch ---
  // Forward is local +Y of the quaternion
  const [fx, fy, fz] = quatGetForward(leader.qx, leader.qy, leader.qz, leader.qw);
  let yaw = Math.atan2(fx, fz);                          // rotation around world Y
  let pitch = Math.asin(Math.max(-1, Math.min(1, fy)));   // angle above horizontal

  // --- Yaw input (left / right — always in horizontal plane) ---
  // inputDir.x: Left = -1, Right = +1
  // yaw = atan2(fx, fz). Decreasing yaw = turn left when viewed from above.
  if (Math.abs(inputDir.x) > 0.05) {
    yaw -= inputDir.x * LEADER_MAX_TURN_RATE * dt;
  }

  // --- Pitch input (up / down) ---
  if (Math.abs(inputDir.y) > 0.05) {
    pitch += inputDir.y * LEADER_MAX_TURN_RATE * 0.8 * dt;
    pitch = Math.max(-maxPitchRad, Math.min(maxPitchRad, pitch));
  }
  // When no pitch input: pitch stays constant (within clamped range).

  // --- Reconstruct quaternion (zero roll) ---
  // Base rotation: maps local +Y (cone tip) to world +Z (horizontal forward).
  // Without this, identity quaternion would have forward = (0,1,0) = straight up.
  const qBase = quatFromAxisAngle(1, 0, 0, Math.PI * 0.5);

  // Yaw: rotate heading around world Y
  const qYaw = quatFromAxisAngle(0, 1, 0, yaw);

  // Pitch: rotate around horizontal right vector.
  // Negated because the base rotation flips the pitch axis direction.
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  const qPitch = quatFromAxisAngle(rightX, 0, rightZ, -pitch);

  // Combine: base → yaw → pitch
  const qYawBase = quatMultiply(qYaw, qBase);
  const finalQ = quatMultiply(qPitch, qYawBase);

  leader.qx = finalQ[0];
  leader.qy = finalQ[1];
  leader.qz = finalQ[2];
  leader.qw = finalQ[3];

  // Normalize quaternion
  const qLen = Math.sqrt(
    leader.qx * leader.qx + leader.qy * leader.qy +
    leader.qz * leader.qz + leader.qw * leader.qw,
  );
  if (qLen > 0.001) {
    leader.qx /= qLen; leader.qy /= qLen;
    leader.qz /= qLen; leader.qw /= qLen;
  }

  // --- Velocity from forward direction ---
  const [finalFx, finalFy, finalFz] = quatGetForward(leader.qx, leader.qy, leader.qz, leader.qw);
  const velLerp = Math.min(5.0 * dt, 1.0);
  leader.vx += (finalFx * currentSpeed - leader.vx) * velLerp;
  leader.vy += (finalFy * currentSpeed - leader.vy) * velLerp;
  leader.vz += (finalFz * currentSpeed - leader.vz) * velLerp;

  // --- Update position ---
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
// Update collected boids (Boids algorithm)
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
    if (!boid.alive || boid.state !== 'collected') continue;

    const neighborIndices = hash.query(boid.x, boid.y, boid.z, percRad);

    let sepX = 0, sepY = 0, sepZ = 0, sepCount = 0;
    let aliX = 0, aliY = 0, aliZ = 0, aliCount = 0;
    let cohX = 0, cohY = 0, cohZ = 0, cohCount = 0;

    for (let n = 0; n < neighborIndices.length; n++) {
      const j = neighborIndices[n];
      if (j === i) continue;
      const other = boids[j];
      if (!other.alive || other.state !== 'collected') continue;

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
    if (!boid.alive || boid.state !== 'collected') continue;

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
