// ============================================================
// SnakeFlow — Game Orchestrator
// Game loop, level management, event processing
// ============================================================

import { type PuzzleState, type Snake, type GameEvents, type Vec3I, DIR_VECTORS } from '../core/types';
import { cellToWorld } from '../core/spatial';
import {
  createPuzzleState, updateSnakes, startSnakeMove,
  undo, resetPuzzle, pushHistory,
} from '../core/puzzle';
import { getLevel, getBaseLevelCount } from '../core/levels';
import {
  initRenderer, buildGrid, renderFrame, animateCamera,
  addSnakeVisual, removeSnakeVisual, clearSnakeVisuals,
  updateAllSnakeVisuals, updateHUD,
  setOnSnakeClick, setOnRestart, setOnUndo,
  setOnPrevLevel, setOnNextLevel,
  getScene, disposeAll, resetHudHash,
} from '../rendering/renderer';
import { spawnFreeParticles, spawnCollisionSparks, updateParticles, disposeAllParticles } from '../rendering/particles';

// ============================================================
// State
// ============================================================

let state: PuzzleState | null = null;
let currentLevelIndex = 0;
let animFrameId: number = 0;
let lastTime = 0;
let isPaused = false;

// ============================================================
// Level Loading
// ============================================================

export function loadLevel(index: number): void {
  const config = getLevel(index);
  if (!config) return;

  currentLevelIndex = index;

  // Clear old visuals and particles
  clearSnakeVisuals();
  disposeAllParticles(getScene());
  resetHudHash();

  // Create puzzle state
  state = createPuzzleState(config.gridSize, config.snakes, index);

  // Build grid
  buildGrid(config.gridSize);

  // Create snake visuals
  for (const snake of state.snakes) {
    addSnakeVisual(snake, config.gridSize);
  }

  // Update HUD
  updateHUD(state.freedCount, state.totalSnakes, state.moveCount, currentLevelIndex, getBaseLevelCount(), state.phase);
}

// ============================================================
// Game Loop
// ============================================================

function gameLoop(timestamp: number): void {
  animFrameId = requestAnimationFrame(gameLoop);

  if (!lastTime) lastTime = timestamp;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1); // cap dt
  lastTime = timestamp;

  if (!state) return;

  // Update camera smooth animation
  animateCamera(dt);

  if (!isPaused && state.phase !== 'complete') {
    // Update puzzle logic
    const events: GameEvents = updateSnakes(state, dt);

    // Process events
    for (const snakeId of events.freed) {
      const snake = state.snakes.find(s => s.id === snakeId);
      if (snake) {
        // Spawn particles at head position
        const head = snake.segments[0];
        const hw = cellToWorld(head, state.gridSize);
        spawnFreeParticles(getScene(), hw.x, hw.y, hw.z, snake.color);

        // Delay removal so particles are visible
        setTimeout(() => {
          removeSnakeVisual(snakeId);
        }, 400);
      }
    }

    for (const snakeId of events.stopped) {
      const snake = state.snakes.find(s => s.id === snakeId);
      if (snake) {
        const head = snake.segments[0];
        const hw = cellToWorld(head, state.gridSize);
        spawnCollisionSparks(getScene(), hw.x, hw.y, hw.z);
      }
    }

    // Update HUD
    updateHUD(state.freedCount, state.totalSnakes, state.moveCount, currentLevelIndex, currentLevelIndex + 1, state.phase);
  }

  // Update visuals (even when paused — for hover, stuck shake, etc.)
  updateAllSnakeVisuals(state.snakes, state.gridSize);

  // Update particles
  updateParticles(getScene(), dt);

  // Render
  renderFrame();
}

// ============================================================
// Start / Stop
// ============================================================

export function startGame(canvas: HTMLCanvasElement): void {
  // Init renderer
  initRenderer(canvas);

  // Wire callbacks
  setOnSnakeClick(handleSnakeClick);
  setOnRestart(() => handleRestart());
  setOnUndo(() => handleUndo());
  setOnPrevLevel(() => handlePrevLevel());
  setOnNextLevel(() => handleNextLevel());

  // Load first level
  loadLevel(0);

  // Start loop
  lastTime = 0;
  isPaused = false;
  animFrameId = requestAnimationFrame(gameLoop);
}

export function stopGame(): void {
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = 0;
  }
  disposeAll();
}

// ============================================================
// Input Handlers
// ============================================================

function handleSnakeClick(snakeId: string): void {
  if (!state) return;

  const snake = state.snakes.find(s => s.id === snakeId);
  if (!snake) return;

  // Can only click non-freed, non-moving snakes
  if (snake.freed || snake.isMoving) return;

  // In complete/stuck mode, only allow undo/restart
  if (state.phase === 'complete' || state.phase === 'stuck') return;

  startSnakeMove(state, snakeId);
}

function handleRestart(): void {
  if (!state) return;
  // Fully reload level to avoid any state artifacts
  loadLevel(currentLevelIndex);
}

function handleUndo(): void {
  if (!state) return;

  // Restore previous state
  const success = undo(state);
  if (!success) return;

  // Rebuild visuals
  clearSnakeVisuals();
  for (const snake of state.snakes) {
    if (!snake.freed) {
      addSnakeVisual(snake, state.gridSize);
    }
  }

  updateHUD(state.freedCount, state.totalSnakes, state.moveCount, currentLevelIndex, currentLevelIndex + 1, state.phase);
}

function handlePrevLevel(): void {
  if (currentLevelIndex > 0) {
    loadLevel(currentLevelIndex - 1);
  }
}

function handleNextLevel(): void {
  // Infinite levels — always can go next
  loadLevel(currentLevelIndex + 1);
}
