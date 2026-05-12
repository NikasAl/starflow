// ============================================================
// Рой (Swarm) — Main Entry Point (Demo Mode)
// Game loop, state management, initialization
// ============================================================

import type { GameState } from './core/types.ts';
import { SPATIAL_CELL_SIZE, LEADER_SPEED } from './core/constants.ts';
import { tuning } from './core/constants.ts';
import {
  createBoids,
  generateFlightPath,
  updateLeader,
  updateBoids,
  SpatialHash,
} from './core/boids.ts';
import {
  initRenderer,
  syncVisuals,
  renderFrame,
  updateFPS,
  createPlatforms,
  createPathVisualization,
  setRestartCallback,
} from './rendering/renderer.ts';

// ============================================================
// Game state
// ============================================================

let state: GameState;
let spatialHash: SpatialHash;
let lastTime = 0;
let running = false;

function createGameState(): GameState {
  const { path, platforms } = generateFlightPath();

  // Leader starts at path[0], facing along path direction
  // Initial forward direction: from path[0] to path[1]
  const [fx, fy, fz] = (() => {
    if (path.length < 2) return [0, 0, 1];
    const dx = path[1][0] - path[0][0];
    const dy = path[1][1] - path[0][1];
    const dz = path[1][2] - path[0][2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    return [dx / len, dy / len, dz / len];
  })();

  // Build initial quaternion: rotate (0,1,0) → (fx, fy, fz) via cross-product axis
  const initQ = (() => {
    const [ux, uy, uz] = [0, 1, 0]; // unit Y = forward in local space
    const dot = ux * fx + uy * fy + uz * fz;
    if (dot > 0.9999) return [0, 0, 0, 1]; // same direction
    if (dot < -0.9999) return [1, 0, 0, 0]; // opposite
    const cx = uy * fz - uz * fy;
    const cy = uz * fx - ux * fz;
    const cz = ux * fy - uy * fx;
    const cLen = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    const half = angle * 0.5;
    const s = Math.sin(half);
    return [cx / cLen * s, cy / cLen * s, cz / cLen * s, Math.cos(half)];
  })();

  const leader = {
    x: path[0][0],
    y: path[0][1],
    z: path[0][2],
    vx: fx * LEADER_SPEED,
    vy: fy * LEADER_SPEED,
    vz: fz * LEADER_SPEED,
    qx: initQ[0],
    qy: initQ[1],
    qz: initQ[2],
    qw: initQ[3],
    pathIndex: 0,
  };

  const boids = createBoids(leader, tuning.boidCount);

  return {
    boids,
    leader,
    path,
    platforms,
    aliveCount: boids.length,
    totalCount: boids.length,
    time: 0,
    fps: 0,
  };
}

// ============================================================
// Game loop
// ============================================================

function gameLoop(timestamp: number): void {
  if (!running) return;
  requestAnimationFrame(gameLoop);

  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  if (dt <= 0) return;

  state.time += dt;

  // Update leader (follows smooth path)
  updateLeader(state.leader, state.path, dt);

  // Rebuild spatial hash
  spatialHash.clear();
  for (let i = 0; i < state.boids.length; i++) {
    const b = state.boids[i];
    if (b.alive) spatialHash.insert(i, b.x, b.y, b.z);
  }

  // Update boids
  updateBoids(state.boids, state.leader, dt, spatialHash);

  // Count alive
  let alive = 0;
  for (let i = 0; i < state.boids.length; i++) {
    if (state.boids[i].alive) alive++;
  }
  state.aliveCount = alive;

  // Sync + render
  syncVisuals(state, dt);
  renderFrame();
  state.fps = updateFPS(dt * 1000);
}

// ============================================================
// Start / restart
// ============================================================

function startGame(): void {
  state = createGameState();
  spatialHash = new SpatialHash(SPATIAL_CELL_SIZE);

  createPlatforms(state.platforms);
  createPathVisualization(state.path);

  if (!running) {
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  } else {
    lastTime = performance.now();
  }

  console.log(`[Swarm] Game started — ${tuning.boidCount} boids, ${state.path.length} path points, ${state.platforms.length} platforms`);
}

// ============================================================
// Boot
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('[Swarm] Canvas element #game-canvas not found');
    return;
  }

  initRenderer(canvas);
  setRestartCallback(startGame);
  startGame();
});
