// ============================================================
// SnakeFlow — Puzzle Logic
// Movement, collision detection, freeing, stuck detection
//
// Movement model:
// - segments = target positions (where the snake is heading)
// - prevSegments = previous positions (where the snake was)
// - moveProgress 0..1 = interpolation factor
// - Visual: lerp(prevSegments[i], segments[i], moveProgress)
//
// When a step completes (moveProgress >= 1.0):
// - prevSegments = clone(segments) [current becomes previous]
// - Compute new segments [next step target]
// - Check bounds/collision
// - moveProgress = 0
//
// startSnakeMove immediately computes the first step target,
// so the animation begins on the very first frame.
// ============================================================

import {
  type Vec3I, type Direction, type Snake, type PuzzleState,
  type GameEvents, DIR_VECTORS,
} from '../core/types';
import { inBounds, nextCell, cloneSnakes, isCellOccupied } from './spatial';
import { SNAKE_MOVE_SPEED, FLY_AWAY_DURATION } from './constants';

/** Create a fresh PuzzleState from a level config */
export function createPuzzleState(
  gridSize: Vec3I,
  snakeConfigs: { segments: Vec3I[]; direction: Direction; color: number }[],
  levelIndex: number,
): PuzzleState {
  const snakes: Snake[] = snakeConfigs.map((cfg, i) => ({
    id: `snake-${i}`,
    color: cfg.color,
    segments: cfg.segments.map(s => ({ ...s })),
    direction: cfg.direction,
    isMoving: false,
    freed: false,
    stuck: false,
    moveProgress: 1.0, // start at 1.0 so initial position is correct
    prevSegments: cfg.segments.map(s => ({ ...s })),
    stuckTimer: 0,
    collisionCount: 0,
    isFlyingAway: false,
    flyAwayProgress: 0,
  }));

  return {
    gridSize,
    snakes,
    phase: 'idle',
    freedCount: 0,
    totalSnakes: snakes.length,
    moveCount: 0,
    levelIndex,
    history: [],
  };
}

/** Push current state to history (for undo) */
export function pushHistory(state: PuzzleState): void {
  state.history.push({
    snakes: cloneSnakes(state.snakes),
    freedCount: state.freedCount,
    moveCount: state.moveCount,
  });
}

/** Restore previous state from history (undo) */
export function undo(state: PuzzleState): boolean {
  if (state.history.length === 0) return false;
  const entry = state.history.pop()!;
  state.snakes = entry.snakes;
  state.freedCount = entry.freedCount;
  state.moveCount = entry.moveCount;
  state.phase = 'idle';
  return true;
}

/** Reset puzzle to initial state (clear all history) */
export function resetPuzzle(state: PuzzleState): void {
  state.history = [];
  for (const snake of state.snakes) {
    snake.isMoving = false;
    snake.freed = false;
    snake.stuck = false;
    snake.moveProgress = 1.0;
    snake.stuckTimer = 0;
    snake.collisionCount = 0;
    snake.isFlyingAway = false;
    snake.flyAwayProgress = 0;
    snake.prevSegments = snake.segments.map(s => ({ ...s }));
  }
  state.phase = 'idle';
  state.freedCount = 0;
  state.moveCount = 0;
}

/**
 * Compute next step target for a snake.
 * Returns null if the snake would collide with an obstacle.
 * Returns 'freed' if the snake would exit the grid.
 * Otherwise returns the new segments array.
 */
function computeNextStep(
  snake: Snake,
  gridSize: Vec3I,
  snakes: Snake[],
): { type: 'move'; segments: Vec3I[] } | { type: 'freed'; segments: Vec3I[] } | { type: 'blocked' } {
  const head = snake.segments[0];
  const dir = DIR_VECTORS[snake.direction];
  const nextHead: Vec3I = {
    x: head.x + dir.x,
    y: head.y + dir.y,
    z: head.z + dir.z,
  };

  if (!inBounds(nextHead, gridSize)) {
    // Snake will exit — compute the exit step (segments slide forward, tail drops)
    return { type: 'freed', segments: [nextHead, ...snake.segments.slice(0, -1)] };
  }

  if (isCellOccupied(nextHead, snakes, snake.id)) {
    return { type: 'blocked' };
  }

  // Normal move: head advances, tail retreats
  const newSegments: Vec3I[] = [nextHead, ...snake.segments.slice(0, -1)];
  return { type: 'move', segments: newSegments };
}

/**
 * Start moving a snake.
 * Immediately computes the first step target so animation begins right away.
 */
export function startSnakeMove(state: PuzzleState, snakeId: string): boolean {
  const snake = state.snakes.find(s => s.id === snakeId);
  if (!snake) return false;
  if (snake.freed || snake.isMoving || snake.isFlyingAway) return false;

  // Save state for undo BEFORE any changes
  pushHistory(state);

  // Compute first step
  const step = computeNextStep(snake, state.gridSize, state.snakes);

  if (step.type === 'blocked') {
    // Can't move at all — show stuck animation
    snake.stuck = true;
    snake.stuckTimer = 0;
    snake.collisionCount++;
    state.moveCount++;
    return false;
  }

  // Set up animation: prev = current, segments = target
  snake.prevSegments = snake.segments.map(s => ({ ...s }));
  snake.segments = step.type === 'freed'
    ? step.segments
    : step.segments;
  snake.isMoving = true;
  snake.stuck = false;
  snake.moveProgress = 0;

  // Mark that this snake will be freed after animation completes
  if (step.type === 'freed') {
    snake._pendingFree = true;
  }

  state.moveCount++;
  state.phase = 'moving';

  return true;
}

/**
 * Main update tick — called every frame.
 * Advances moving snakes, checks collisions, detects completion/stuck.
 */
export function updateSnakes(state: PuzzleState, dt: number): GameEvents {
  const events: GameEvents = {
    freed: [],
    stopped: [],
    startedMoving: null,
    completed: false,
    stuck: false,
  };

  // Update each moving snake
  for (const snake of state.snakes) {
    if (!snake.isMoving) continue;

    // Advance movement progress
    snake.moveProgress += SNAKE_MOVE_SPEED * dt;

    // Check if a full step is completed
    if (snake.moveProgress >= 1.0) {
      // Check if this snake was marked for freeing → start fly-away
      if (snake._pendingFree) {
        snake._pendingFree = false;
        snake.isMoving = false;
        snake.isFlyingAway = true;
        snake.flyAwayProgress = 0;
        // Don't free yet — let fly-away animation play
        continue;
      }

      snake.moveProgress = 0;

      // Compute next step
      const step = computeNextStep(snake, state.gridSize, state.snakes);

      if (step.type === 'freed') {
        // Set target for exit animation
        snake.prevSegments = snake.segments.map(s => ({ ...s }));
        snake.segments = step.segments;
        snake._pendingFree = true;
        // Don't stop yet — let animation play
        continue;
      }

      if (step.type === 'blocked') {
        // Collision → stop with shake animation
        snake.isMoving = false;
        snake.stuck = true;
        snake.stuckTimer = 0;
        snake.collisionCount++;
        events.stopped.push(snake.id);
        continue;
      }

      // Normal move: set prev and target
      snake.prevSegments = snake.segments.map(s => ({ ...s }));
      snake.segments = step.segments;
    }
  }

  // Update fly-away animations
  for (const snake of state.snakes) {
    if (!snake.isFlyingAway) continue;

    snake.flyAwayProgress += dt / FLY_AWAY_DURATION;

    if (snake.flyAwayProgress >= 1.0) {
      snake.flyAwayProgress = 1.0;
      snake.isFlyingAway = false;
      snake.freed = true;
      state.freedCount++;
      events.freed.push(snake.id);
    }
  }

  // Update stuck timers
  for (const snake of state.snakes) {
    if (snake.stuck) {
      snake.stuckTimer += dt;
    }
  }

  // Check completion
  if (state.freedCount === state.totalSnakes) {
    state.phase = 'complete';
    events.completed = true;
  } else if (state.snakes.every(s => !s.isMoving && !s.isFlyingAway) && state.freedCount < state.totalSnakes) {
    // Check if any remaining snake CAN move
    const anyCanMove = state.snakes.some(s => {
      if (s.freed || s.isMoving || s.isFlyingAway) return false;
      const step = computeNextStep(s, state.gridSize, state.snakes);
      return step.type !== 'blocked';
    });
    if (!anyCanMove) {
      state.phase = 'stuck';
      events.stuck = true;
    } else {
      state.phase = 'idle';
    }
  }

  return events;
}

/**
 * Check if a snake can potentially move forward.
 * Used for hover highlighting.
 */
export function canSnakeMove(snake: Snake, gridSize: Vec3I, snakes: Snake[]): boolean {
  if (snake.freed || snake.isMoving || snake.isFlyingAway) return false;
  const step = computeNextStep(snake, gridSize, snakes);
  return step.type !== 'blocked';
}
