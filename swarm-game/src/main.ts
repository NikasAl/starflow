// ============================================================
// Рой (Swarm) — Main Entry Point
// Game loop, state management, initialization
// ============================================================

import type { GameState } from './core/types.ts';
import { BOID_COUNT, SPATIAL_CELL_SIZE } from './core/constants.ts';
import { createBoids, updateLeader, updateBoids, SpatialHash } from './core/boids.ts';
import {
  initRenderer,
  readInput,
  syncVisuals,
  renderFrame,
  updateFPS,
} from './rendering/renderer.ts';

// ============================================================
// Game state initialization
// ============================================================

function createGameState(): GameState {
  // Leader starts at origin, flying in +Z direction
  const leader = {
    x: 0,
    y: 0,
    z: -30,
    vx: 0,
    vy: 0,
    vz: 4.5,
  };

  const boids = createBoids(leader);

  return {
    boids,
    leader,
    input: { yaw: 0, pitch: 0, boost: false },
    aliveCount: boids.length,
    totalCount: boids.length,
    time: 0,
    fps: 0,
  };
}

// ============================================================
// Game loop
// ============================================================

let state: GameState;
let spatialHash: SpatialHash;
let lastTime = 0;
let running = false;

function gameLoop(timestamp: number): void {
  if (!running) return;

  requestAnimationFrame(gameLoop);

  // Delta time in seconds, clamped to avoid spiral of death
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (dt <= 0) return;

  state.time += dt;

  // --- Read input ---
  state.input = readInput();

  // --- Update leader ---
  updateLeader(state.leader, state.input, dt);

  // --- Rebuild spatial hash ---
  spatialHash.clear();
  for (let i = 0; i < state.boids.length; i++) {
    const b = state.boids[i];
    if (b.alive) {
      spatialHash.insert(i, b.x, b.y, b.z);
    }
  }

  // --- Update boids ---
  updateBoids(state.boids, state.leader, dt, spatialHash);

  // --- Count alive ---
  let alive = 0;
  for (let i = 0; i < state.boids.length; i++) {
    if (state.boids[i].alive) alive++;
  }
  state.aliveCount = alive;

  // --- Sync visuals ---
  syncVisuals(state, dt);

  // --- Render ---
  renderFrame();

  // --- FPS ---
  state.fps = updateFPS(dt * 1000);
}

// ============================================================
// Start
// ============================================================

function startGame(): void {
  state = createGameState();
  spatialHash = new SpatialHash(SPATIAL_CELL_SIZE);

  running = true;
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
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
  startGame();

  console.log('[Swarm] Game started — use WASD to steer, Space to boost');
});
