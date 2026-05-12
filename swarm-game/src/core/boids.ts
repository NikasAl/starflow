// ============================================================
// Рой (Swarm) — Boids 3D Algorithm + Spatial Hash
// Pure math, no Three.js / DOM dependencies
// ============================================================

import type { BoidData, LeaderData, InputState, GameState } from './types.ts';
import {
  BOID_COUNT, BOID_MIN_SPEED, BOID_MAX_SPEED, BOID_MAX_FORCE, BOID_MIN_FORCE,
  SEPARATION_RADIUS, SEPARATION_WEIGHT,
  PERCEPTION_RADIUS, ALIGNMENT_WEIGHT, COHESION_WEIGHT,
  LEADER_FOLLOW_RADIUS, LEADER_WEIGHT,
  LEADER_SPEED, LEADER_BOOST_SPEED, LEADER_MAX_TURN_RATE,
  WORLD_HALF_SIZE, BOUNDARY_MARGIN, BOUNDARY_STRENGTH,
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
// Rodrigues' rotation — rotate vector (vx,vy,vz) around axis
// ============================================================

function rotateAroundAxis(
  vx: number, vy: number, vz: number,
  ax: number, ay: number, az: number,
  angle: number,
): [number, number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dot = vx * ax + vy * ay + vz * az;
  const cx = ay * vz - az * vy;
  const cy = az * vx - ax * vz;
  const cz = ax * vy - ay * vx;
  return [
    vx * cos + cx * sin + ax * dot * (1 - cos),
    vy * cos + cy * sin + ay * dot * (1 - cos),
    vz * cos + cz * sin + az * dot * (1 - cos),
  ];
}

// ============================================================
// Normalize a 3D vector
// ============================================================

function normalize(x: number, y: number, z: number): [number, number, number] {
  const len = Math.sqrt(x * x + y * y + z * z);
  if (len < 1e-8) return [0, 0, 1];
  return [x / len, y / len, z / len];
}

// ============================================================
// Cross product of two 3D vectors
// ============================================================

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
// Returns clamped force vector
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
// Boundary repulsion force
// ============================================================

function boundaryForce(
  x: number, y: number, z: number,
): [number, number, number] {
  let fx = 0, fy = 0, fz = 0;
  const limit = WORLD_HALF_SIZE - BOUNDARY_MARGIN;
  const s = BOUNDARY_STRENGTH;

  // Positive boundary
  const px = x - limit;
  if (px > 0) fx -= s * px * px;
  // Negative boundary
  const nx = -limit - x;
  if (nx > 0) fx += s * nx * nx;

  const py = y - limit;
  if (py > 0) fy -= s * py * py;
  const ny = -limit - y;
  if (ny > 0) fy += s * ny * ny;

  const pz = z - limit;
  if (pz > 0) fz -= s * pz * pz;
  const nz = -limit - z;
  if (nz > 0) fz += s * nz * nz;

  return [fx, fy, fz];
}

// ============================================================
// Create initial boid swarm around the leader
// ============================================================

export function createBoids(leader: LeaderData): BoidData[] {
  const boids: BoidData[] = [];
  for (let i = 0; i < BOID_COUNT; i++) {
    // Small random offset around leader
    const ox = (Math.random() - 0.5) * 10;
    const oy = (Math.random() - 0.5) * 6;
    const oz = (Math.random() - 0.5) * 10;

    // Initial velocity roughly matches leader direction
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
// Update leader position based on input
// ============================================================

export function updateLeader(
  leader: LeaderData,
  input: InputState,
  dt: number,
): void {
  // Current direction
  let [dx, dy, dz] = normalize(leader.vx, leader.vy, leader.vz);

  // Apply yaw (A/D) — rotate around world Y axis
  if (input.yaw !== 0) {
    [dx, dy, dz] = rotateAroundAxis(dx, dy, dz, 0, 1, 0, input.yaw * LEADER_MAX_TURN_RATE * dt);
  }

  // Apply pitch (W/S) — rotate around local right axis
  if (input.pitch !== 0) {
    const [rx, ry, rz] = cross(dx, dy, dz, 0, 1, 0);
    // If nearly vertical, use Z axis as fallback
    if (Math.abs(rx) + Math.abs(ry) + Math.abs(rz) < 0.01) {
      const [rdx, rdy, rdz] = cross(dx, dy, dz, 0, 0, 1);
      [dx, dy, dz] = rotateAroundAxis(dx, dy, dz, rdx, rdy, rdz, input.pitch * LEADER_MAX_TURN_RATE * dt);
    } else {
      [dx, dy, dz] = rotateAroundAxis(dx, dy, dz, rx, ry, rz, input.pitch * LEADER_MAX_TURN_RATE * dt);
    }
  }

  [dx, dy, dz] = normalize(dx, dy, dz);

  const speed = input.boost ? LEADER_BOOST_SPEED : LEADER_SPEED;

  leader.vx = dx * speed;
  leader.vy = dy * speed;
  leader.vz = dz * speed;

  leader.x += leader.vx * dt;
  leader.y += leader.vy * dt;
  leader.z += leader.vz * dt;

  // Hard clamp to world bounds (with margin)
  const clamp = WORLD_HALF_SIZE - 3;
  leader.x = Math.max(-clamp, Math.min(clamp, leader.x));
  leader.y = Math.max(-clamp, Math.min(clamp, leader.y));
  leader.z = Math.max(-clamp, Math.min(clamp, leader.z));
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
  // Accumulate forces for each boid
  const forces = new Float32Array(boids.length * 3);

  for (let i = 0; i < boids.length; i++) {
    const boid = boids[i];
    if (!boid.alive) continue;

    // Query neighbors via spatial hash
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

      // Separation
      if (dist < SEPARATION_RADIUS && dist > 0.001) {
        sepX -= ddx / dist;
        sepY -= ddy / dist;
        sepZ -= ddz / dist;
        sepCount++;
      }

      // Alignment + Cohesion (within perception radius)
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

    // Separation force
    if (sepCount > 0) {
      sepX /= sepCount;
      sepY /= sepCount;
      sepZ /= sepCount;
      const [sfx, sfy, sfz] = steer(
        boid.vx, boid.vy, boid.vz,
        sepX, sepY, sepZ,
        BOID_MAX_SPEED, BOID_MAX_FORCE,
      );
      fx += sfx * SEPARATION_WEIGHT;
      fy += sfy * SEPARATION_WEIGHT;
      fz += sfz * SEPARATION_WEIGHT;
    }

    // Alignment force
    if (aliCount > 0) {
      aliX /= aliCount;
      aliY /= aliCount;
      aliZ /= aliCount;
      const [afx, afy, afz] = steer(
        boid.vx, boid.vy, boid.vz,
        aliX, aliY, aliZ,
        BOID_MAX_SPEED, BOID_MAX_FORCE,
      );
      fx += afx * ALIGNMENT_WEIGHT;
      fy += afy * ALIGNMENT_WEIGHT;
      fz += afz * ALIGNMENT_WEIGHT;
    }

    // Cohesion force
    if (cohCount > 0) {
      cohX = cohX / cohCount - boid.x;
      cohY = cohY / cohCount - boid.y;
      cohZ = cohZ / cohCount - boid.z;
      const [cfx, cfy, cfz] = steer(
        boid.vx, boid.vy, boid.vz,
        cohX, cohY, cohZ,
        BOID_MAX_SPEED, BOID_MAX_FORCE,
      );
      fx += cfx * COHESION_WEIGHT;
      fy += cfy * COHESION_WEIGHT;
      fz += cfz * COHESION_WEIGHT;
    }

    // Leader follow force
    const ldx = leader.x - boid.x;
    const ldy = leader.y - boid.y;
    const ldz = leader.z - boid.z;
    const ldist = Math.sqrt(ldx * ldx + ldy * ldy + ldz * ldz);
    if (ldist < LEADER_FOLLOW_RADIUS && ldist > 0.001) {
      const [lfx, lfy, lfz] = steer(
        boid.vx, boid.vy, boid.vz,
        ldx, ldy, ldz,
        BOID_MAX_SPEED, BOID_MAX_FORCE * 1.5,
      );
      fx += lfx * LEADER_WEIGHT;
      fy += lfy * LEADER_WEIGHT;
      fz += lfz * LEADER_WEIGHT;
    }
    // If far from leader, strong attraction to come back
    else if (ldist >= LEADER_FOLLOW_RADIUS) {
      const [lfx, lfy, lfz] = steer(
        boid.vx, boid.vy, boid.vz,
        ldx, ldy, ldz,
        BOID_MAX_SPEED, BOID_MAX_FORCE * 3,
      );
      fx += lfx * LEADER_WEIGHT * 2;
      fy += lfy * LEADER_WEIGHT * 2;
      fz += lfz * LEADER_WEIGHT * 2;
    }

    // Boundary repulsion
    const [bfx, bfy, bfz] = boundaryForce(boid.x, boid.y, boid.z);
    fx += bfx;
    fy += bfy;
    fz += bfz;

    forces[fi] = fx;
    forces[fi + 1] = fy;
    forces[fi + 2] = fz;
  }

  // Apply forces, clamp speed, integrate position
  for (let i = 0; i < boids.length; i++) {
    const boid = boids[i];
    if (!boid.alive) continue;

    const fi = i * 3;
    boid.vx += forces[fi];
    boid.vy += forces[fi + 1];
    boid.vz += forces[fi + 2];

    // Clamp speed
    const speed = Math.sqrt(boid.vx * boid.vx + boid.vy * boid.vy + boid.vz * boid.vz);
    if (speed > BOID_MAX_SPEED) {
      const scale = BOID_MAX_SPEED / speed;
      boid.vx *= scale;
      boid.vy *= scale;
      boid.vz *= scale;
    } else if (speed < BOID_MIN_SPEED) {
      const scale = BOID_MIN_SPEED / (speed || 1);
      boid.vx *= scale;
      boid.vy *= scale;
      boid.vz *= scale;
    }

    // Integrate position
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
