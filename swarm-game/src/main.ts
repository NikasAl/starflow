// ============================================================
// Рой (Swarm) — Main Entry Point (Demo Mode)
// Game loop, state management, initialization
// ============================================================

import type { GameState } from './core/types.ts';
import { SPATIAL_CELL_SIZE } from './core/constants.ts';
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
  const halfPi = Math.PI * 0.5;
  const cos = Math.cos(halfPi * 0.5);
  const sin = Math.sin(halfPi * 0.5);

  // Initial forward direction: from path[0] to path[1]
  const [fx, fy, fz] = (() => {
    if (path.length < 2) return [0, 0, 1];
    const dx = path[1][0] - path[0][0];
    const dy = path[1][1] - path[0][1];
    const dz = path[1][2] - path[0][2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    return [dx / len, dy / len, dz / len];
  })();

  const leader = {
    x: path[0][0],
    y: path[0][1],
    z: path[0][2],
    vx: fx * 5.0,
    vy: fy * 5.0,
    vz: fz * 5.0,
    // Initial quaternion: rotate (0,1,0) to face along path direction
    qx: sin,
    qy: 0,
    qz: 0,
    qw: cos,
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
