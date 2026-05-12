// ============================================================
// Рой (Swarm) — Main Entry Point (Demo Mode)
// Game loop, state management, initialization
// ============================================================

import type { GameState } from './core/types.ts';
import { BOID_COUNT, SPATIAL_CELL_SIZE } from './core/constants.ts';
import {
  createBoids,
  generatePlatforms,
  generateWaypoints,
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
  createWaypointPath,
} from './rendering/renderer.ts';

// ============================================================
// Game state initialization
// ============================================================

function createGameState(): GameState {
  // Generate platforms first (they determine the flight path)
  const platforms = generatePlatforms();

  // Leader starts at first platform, facing +Z
  const halfPi = Math.PI * 0.5;
  const cos = Math.cos(halfPi * 0.5);
  const sin = Math.sin(halfPi * 0.5);

  const startX = platforms[0].x;
  const startY = platforms[0].y;
  const startZ = platforms[0].z - 15;

  const leader = {
    x: startX,
    y: startY,
    z: startZ,
    vx: 0,
    vy: 0,
    vz: 5.0,
    qx: sin,
    qy: 0,
    qz: 0,
    qw: cos,
    waypointIndex: 0,
  };

  // Generate flight path through platforms
  const waypoints = generateWaypoints(platforms);

  const boids = createBoids(leader);

  return {
    boids,
    leader,
    waypoints,
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

let state: GameState;
let spatialHash: SpatialHash;
let lastTime = 0;
let running = false;

function gameLoop(timestamp: number): void {
  if (!running) return;

  requestAnimationFrame(gameLoop);

  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  if (dt <= 0) return;

  state.time += dt;

  // --- Update leader (autopilot) ---
  updateLeader(state.leader, state.waypoints, dt);

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

  // Create 3D platform objects
  createPlatforms(state.platforms);

  // Create waypoint path visualization
  createWaypointPath(state.waypoints);

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

  console.log('[Swarm] Demo mode started — autopilot flight through platforms');
});
