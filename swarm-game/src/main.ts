// ============================================================
// Рой — Собиратель (Swarm: Collector) — Main Entry Point
// Game loop, state management, initialization
// ============================================================

import type { GameState, LevelConfig } from './core/types.ts';
import { SPATIAL_CELL_SIZE, LEADER_SPEED, LEVEL_CONFIGS } from './core/constants.ts';
import { tuning } from './core/constants.ts';
import {
  createBoids,
  updateLeader,
  updateBoids,
  updateFreeBoids,
  collectBoids,
  checkPortal,
  quatFromDir,
  SpatialHash,
  generateBuoys,
  getRouteWaypoints,
} from './core/boids.ts';
import { Controls } from './input/controls.ts';
import {
  initRenderer,
  syncVisuals,
  renderFrame,
  updateFPS,
  setRestartCallback,
  showEndScreen,
  getCameraQuaternion,
  rebuildBuoys,
} from './rendering/renderer.ts';

// ============================================================
// Game state
// ============================================================

let state: GameState;
let spatialHash: SpatialHash;
let controls: Controls;
let lastTime = 0;
let running = false;
let currentLevelIndex = 0;

function createGameState(levelIndex: number): GameState {
  const level = LEVEL_CONFIGS[levelIndex];

  // Leader starts at origin, facing +Z
  const [fx, fy, fz] = [0, 0, 1];
  const initQ = quatFromDir(fx, fy, fz);

  const leader = {
    x: 0,
    y: 0,
    z: 0,
    vx: fx * LEADER_SPEED,
    vy: fy * LEADER_SPEED,
    vz: fz * LEADER_SPEED,
    qx: initQ[0],
    qy: initQ[1],
    qz: initQ[2],
    qw: initQ[3],
    boostCooldown: 0,
    boostActive: 0,
  };

  const boids = createBoids(level);
  const buoyPositions = generateBuoys(level);

  // Count initial collected
  let collectedCount = 0;
  for (const b of boids) {
    if (b.state === 'collected') collectedCount++;
  }

  return {
    boids,
    leader,
    portal: {
      x: level.portalPosition[0],
      y: level.portalPosition[1],
      z: level.portalPosition[2],
      radius: 5,
      rotation: 0,
    },
    level,
    buoys: buoyPositions.map(([x, y, z]) => ({ x, y, z })),
    collectedCount,
    passedCount: 0,
    score: 0,
    timeRemaining: level.timeLimit,
    phase: 'playing',
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

  // Always update visuals and render
  state.time += dt;

  if (state.phase === 'playing') {
    // Timer
    state.timeRemaining -= dt;
    if (state.timeRemaining <= 0) {
      state.timeRemaining = 0;
      state.phase = 'won';
      showEndScreen(state);
    }

    // Get input
    const dir = controls.getDirection();
    const boost = controls.wantsBoost();

    // Camera quaternion for input transformation
    const camQ = getCameraQuaternion();

    // Update leader (player-controlled)
    updateLeader(
      state.leader,
      dir,
      boost,
      camQ.x, camQ.y, camQ.z, camQ.w,
      dt,
    );

    // Collect free boids near leader
    const newCollected = collectBoids(state.boids, state.leader);
    state.collectedCount += newCollected;

    // Update free boids (inert drifting)
    updateFreeBoids(state.boids, dt);

    // Rebuild spatial hash (only for collected boids)
    spatialHash.clear();
    for (let i = 0; i < state.boids.length; i++) {
      const b = state.boids[i];
      if (b.alive && b.state === 'collected') {
        spatialHash.insert(i, b.x, b.y, b.z);
      }
    }

    // Update collected boids (Boids algorithm)
    updateBoids(state.boids, state.leader, dt, spatialHash);

    // Check portal
    const result = checkPortal(state.boids, state.portal);
    state.passedCount += result.passed;
    state.score += result.score;

    // Recount collected (some may have been passed)
    state.collectedCount = 0;
    for (const b of state.boids) {
      if (b.state === 'collected') state.collectedCount++;
    }
  }

  // Sync + render
  syncVisuals(state, dt);
  renderFrame();
  state.fps = updateFPS(dt * 1000);
}

// ============================================================
// Start / restart
// ============================================================

function startGame(): void {
  state = createGameState(currentLevelIndex);
  spatialHash = new SpatialHash(SPATIAL_CELL_SIZE);

  // Rebuild buoy meshes and route line for this level
  const routeWp = getRouteWaypoints(state.level);
  rebuildBuoys(state.buoys, routeWp);

  if (!running) {
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  } else {
    lastTime = performance.now();
  }

  console.log(
    `[Swarm:Collector] Level ${currentLevelIndex + 1} "${state.level.name}" started — ` +
    `${state.level.totalBoids} boids, ${state.level.timeLimit}s time limit`,
  );
}

// ============================================================
// Boot
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('[Swarm:Collector] Canvas element #game-canvas not found');
    return;
  }

  // Initialize controls
  controls = new Controls();
  controls.init(canvas);

  // Initialize renderer
  initRenderer(canvas);
  setRestartCallback(startGame);

  // Start first level
  startGame();
});
