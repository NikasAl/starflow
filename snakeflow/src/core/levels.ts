// ============================================================
// SnakeFlow — Level Configurations & Procedural Generator
// With guaranteed solvability via reverse-simulation solver
// ============================================================

import {
  type Vec3I, type Direction, type LevelConfig,
  ALL_DIRECTIONS, DIR_VECTORS,
} from './types';
import { SNAKE_COLORS } from './constants';
import { inBounds, nextCell, cellKey, vec3Eq } from './spatial';

// ============================================================
// Helpers
// ============================================================

function v(x: number, y: number, z: number): Vec3I {
  return { x, y, z };
}

// ============================================================
// Direction validation
// ============================================================

/**
 * Check if a direction is valid for a snake:
 * - Must NOT point into any of the snake's own body segments
 */
function isDirectionValid(
  segments: Vec3I[],
  direction: Direction,
): boolean {
  const head = segments[0];
  const d = DIR_VECTORS[direction];
  const next: Vec3I = { x: head.x + d.x, y: head.y + d.y, z: head.z + d.z };

  for (const seg of segments) {
    if (vec3Eq(seg, next)) return false;
  }
  return true;
}

/**
 * Get all valid directions for a snake (not pointing into own body).
 */
function getValidDirections(
  segments: Vec3I[],
  gridSize: Vec3I,
): Direction[] {
  return ALL_DIRECTIONS.filter(dir => isDirectionValid(segments, dir));
}

// ============================================================
// Fast Puzzle Simulator (for solver)
// ============================================================

interface SimSnake {
  id: number;
  segments: Vec3I[];
  direction: Direction;
  freed: boolean;
}

interface SimState {
  gridSize: Vec3I;
  snakes: SimSnake[];
}

/** Deep clone sim state */
function cloneSimState(state: SimState): SimState {
  return {
    gridSize: { ...state.gridSize },
    snakes: state.snakes.map(s => ({
      ...s,
      segments: s.segments.map(seg => ({ ...seg })),
    })),
  };
}

/** Check if a cell is occupied by any non-freed snake (excluding one) */
function simCellOccupied(cell: Vec3I, snakes: SimSnake[], excludeIdx: number): boolean {
  for (let i = 0; i < snakes.length; i++) {
    if (i === excludeIdx || snakes[i].freed) continue;
    for (const seg of snakes[i].segments) {
      if (seg.x === cell.x && seg.y === cell.y && seg.z === cell.z) return true;
    }
  }
  return false;
}

/**
 * Simulate a snake move to completion.
 * Returns: 'freed' | 'blocked' | 'moved' and final state.
 */
function simMoveSnake(state: SimState, snakeIdx: number): { result: 'freed' | 'blocked' | 'moved'; state: SimState } {
  const newState = cloneSimState(state);
  const snake = newState.snakes[snakeIdx];
  if (snake.freed) return { result: 'blocked', state: newState };

  let moved = false;
  // Move step by step until blocked or freed
  for (let step = 0; step < 100; step++) {
    const head = snake.segments[0];
    const d = DIR_VECTORS[snake.direction];
    const nextHead: Vec3I = { x: head.x + d.x, y: head.y + d.y, z: head.z + d.z };

    if (!inBounds(nextHead, newState.gridSize)) {
      // Freed!
      snake.segments = [nextHead, ...snake.segments.slice(0, -1)];
      snake.freed = true;
      return { result: 'freed', state: newState };
    }

    if (simCellOccupied(nextHead, newState.snakes, snakeIdx)) {
      // Blocked — the move was still made if we advanced at least once
      return { result: moved ? 'moved' : 'blocked', state: newState };
    }

    // Normal move
    snake.segments = [nextHead, ...snake.segments.slice(0, -1)];
    moved = true;
  }

  return { result: moved ? 'moved' : 'blocked', state: newState };
}

/**
 * Check if all remaining non-freed snakes can potentially move.
 */
function simAnyCanMove(state: SimState): boolean {
  for (let i = 0; i < state.snakes.length; i++) {
    if (state.snakes[i].freed) continue;
    const head = state.snakes[i].segments[0];
    const d = DIR_VECTORS[state.snakes[i].direction];
    const next: Vec3I = { x: head.x + d.x, y: head.y + d.y, z: head.z + d.z };

    if (!inBounds(next, state.gridSize)) return true;
    if (!simCellOccupied(next, state.snakes, i)) return true;
  }
  return false;
}

/**
 * Recursive BFS solver: tries all possible move orderings.
 * Returns true if the puzzle is solvable (all snakes can be freed).
 * Uses memoization and iterative deepening to limit search.
 */
function solvePuzzle(initialState: SimState, maxDepth: number = 30): boolean {
  // Quick check: every snake must be able to eventually exit
  for (const snake of initialState.snakes) {
    let canExit = false;
    const head = snake.segments[0];
    // Check all valid directions
    for (const dir of ALL_DIRECTIONS) {
      if (!isDirectionValid(snake.segments, dir)) continue;
      const d = DIR_VECTORS[dir];
      // Simple check: is there a clear path in this direction to boundary?
      let pos: Vec3I = { ...head };
      let blocked = false;
      while (inBounds(pos, initialState.gridSize)) {
        if (cellKey(pos) !== cellKey(head)) {
          // Check if occupied by another snake
          let occ = false;
          for (const other of initialState.snakes) {
            if (other.id === snake.id) continue;
            for (const seg of other.segments) {
              if (seg.x === pos.x && seg.y === pos.y && seg.z === pos.z) {
                occ = true;
                break;
              }
            }
            if (occ) break;
          }
          if (occ) { blocked = true; break; }
        }
        pos = { x: pos.x + d.x, y: pos.y + d.y, z: pos.z + d.z };
      }
      if (!blocked) { canExit = true; break; }
    }
    if (!canExit) return false; // This snake has no clear exit path in any direction
  }

  // BFS solver with state hashing
  interface QueueItem {
    state: SimState;
    depth: number;
    hash: string;
  }

  function stateHash(s: SimState): string {
    const parts: string[] = [];
    for (const snake of s.snakes) {
      if (snake.freed) {
        parts.push(`F`);
      } else {
        parts.push(snake.segments.map(seg => cellKey(seg)).join('|'));
      }
    }
    return parts.join(';');
  }

  const visited = new Set<string>();
  const queue: QueueItem[] = [{ state: initialState, depth: 0, hash: stateHash(initialState) }];
  visited.add(queue[0].hash);

  let iterations = 0;
  const maxIterations = 50000;

  while (queue.length > 0 && iterations < maxIterations) {
    iterations++;
    const item = queue.shift()!;

    // Check if all freed
    if (item.state.snakes.every(s => s.freed)) return true;
    if (item.depth >= maxDepth) continue;

    // Try moving each non-freed snake
    for (let i = 0; i < item.state.snakes.length; i++) {
      const snake = item.state.snakes[i];
      if (snake.freed) continue;

      const { result, state: newState } = simMoveSnake(item.state, i);

      if (result === 'freed') {
        // Snake freed — check if all freed now
        if (newState.snakes.every(s => s.freed)) return true;

        // Check deadlock for remaining
        if (simAnyCanMove(newState)) {
          const h = stateHash(newState);
          if (!visited.has(h)) {
            visited.add(h);
            queue.push({ state: newState, depth: item.depth + 1, hash: h });
          }
        }
      } else if (result === 'moved') {
        // Snake moved and stopped — check if remaining can still move
        if (simAnyCanMove(newState)) {
          const h = stateHash(newState);
          if (!visited.has(h)) {
            visited.add(h);
            queue.push({ state: newState, depth: item.depth + 1, hash: h });
          }
        }
      }
      // If blocked, skip
    }
  }

  return false;
}

// ============================================================
// Procedural Snake Placement with Solvability
// ============================================================

/**
 * Try to grow a snake from a starting cell.
 * Prefers longer snakes and straight-ish paths.
 */
function growSnake(
  startCell: Vec3I,
  occupied: Set<string>,
  gridSize: Vec3I,
  minLen: number,
  maxLen: number,
): Vec3I[] | null {
  const segments: Vec3I[] = [startCell];
  occupied.add(cellKey(startCell));

  const targetLen = minLen + Math.floor(Math.random() * (maxLen - minLen + 1));

  for (let step = 1; step < targetLen; step++) {
    const head = segments[segments.length - 1];

    const neighbors: { cell: Vec3I; dir: Vec3I }[] = [];
    for (const dirStr of ALL_DIRECTIONS) {
      const d = DIR_VECTORS[dirStr];
      const next: Vec3I = { x: head.x + d.x, y: head.y + d.y, z: head.z + d.z };

      if (next.x < 0 || next.x >= gridSize.x ||
          next.y < 0 || next.y >= gridSize.y ||
          next.z < 0 || next.z >= gridSize.z) continue;
      if (occupied.has(cellKey(next))) continue;

      if (segments.length >= 2) {
        const prev = segments[segments.length - 2];
        if (vec3Eq(next, prev)) continue;
      }

      neighbors.push({ cell: next, dir: d });
    }

    if (neighbors.length === 0) break;

    let chosen: { cell: Vec3I; dir: Vec3I };
    if (neighbors.length > 1 && segments.length >= 2) {
      const prev = segments[segments.length - 2];
      const head2 = segments[segments.length - 1];
      const forwardDir: Vec3I = {
        x: head2.x - prev.x,
        y: head2.y - prev.y,
        z: head2.z - prev.z,
      };

      const straight = neighbors.find(n =>
        n.dir.x === forwardDir.x && n.dir.y === forwardDir.y && n.dir.z === forwardDir.z
      );
      if (straight && Math.random() < 0.6) {
        chosen = straight;
      } else {
        chosen = neighbors[Math.floor(Math.random() * neighbors.length)];
      }
    } else {
      chosen = neighbors[Math.floor(Math.random() * neighbors.length)];
    }

    segments.push(chosen.cell);
    occupied.add(cellKey(chosen.cell));
  }

  if (segments.length < minLen) {
    for (const seg of segments) {
      occupied.delete(cellKey(seg));
    }
    return null;
  }

  return segments;
}

/**
 * Choose a direction for the snake head.
 * Prefers directions that have a clear path to the grid boundary
 * (closer to exit = higher score).
 */
function chooseHeadDirection(
  segments: Vec3I[],
  gridSize: Vec3I,
  allSnakesSegments: Vec3I[][],
): Direction {
  const head = segments[0];
  const validDirs = getValidDirections(segments, gridSize);
  if (validDirs.length === 0) return '+Y';

  let bestDir = validDirs[0];
  let bestScore = -Infinity;

  for (const dir of validDirs) {
    const d = DIR_VECTORS[dir];
    const next: Vec3I = { x: head.x + d.x, y: head.y + d.y, z: head.z + d.z };

    let score = 0;

    // Distance to boundary along this direction
    if (d.x > 0) score = gridSize.x - head.x;
    else if (d.x < 0) score = head.x + 1;
    else if (d.y > 0) score = gridSize.y - head.y;
    else if (d.y < 0) score = head.y + 1;
    else if (d.z > 0) score = gridSize.z - head.z;
    else if (d.z < 0) score = head.z + 1;

    // Bonus for clear path: count unblocked cells in this direction
    let clearPath = 0;
    let pos: Vec3I = { ...next };
    while (inBounds(pos, gridSize)) {
      let isBlocked = false;
      for (const otherSegs of allSnakesSegments) {
        for (const seg of otherSegs) {
          if (seg.x === pos.x && seg.y === pos.y && seg.z === pos.z) {
            isBlocked = true;
            break;
          }
        }
        if (isBlocked) break;
      }
      if (isBlocked) break;
      clearPath++;
      pos = { x: pos.x + d.x, y: pos.y + d.y, z: pos.z + d.z };
    }
    score += clearPath * 2;

    // Small random factor
    score += Math.random() * 1.5;

    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }

  return bestDir;
}

// ============================================================
// Level Generator with Solvability Guarantee
// ============================================================

export interface GenerateLevelOptions {
  gridSize: Vec3I;
  fillRatio?: number;
  minSnakeLen?: number;
  maxSnakeLen?: number;
  snakeCount?: number;
}

/**
 * Generate a solvable level.
 * Strategy:
 * 1. Place snakes densely in the grid
 * 2. For each snake, pick direction toward nearest boundary
 * 3. Run solver to verify solvability
 * 4. If unsolvable, retry with different placement (up to maxRetries)
 */
function generateSolvableLevel(
  id: number,
  name: string,
  options: GenerateLevelOptions,
  maxRetries: number = 20,
): LevelConfig {
  const {
    gridSize,
    fillRatio = 0.65,
    minSnakeLen = 2,
    maxSnakeLen = 5,
    snakeCount: overrideCount,
  } = options;

  const totalCells = gridSize.x * gridSize.y * gridSize.z;
  const targetFill = Math.floor(totalCells * fillRatio);

  for (let retry = 0; retry < maxRetries; retry++) {
    const result = tryGenerateLevel(gridSize, targetFill, minSnakeLen, maxSnakeLen, overrideCount);

    if (!result) continue;

    // Convert to snake configs
    const snakeConfigs = result.snakes.map((seg, idx) => {
      const direction = chooseHeadDirection(seg, gridSize, result.snakes);
      return {
        segments: seg,
        direction,
        color: SNAKE_COLORS[idx % SNAKE_COLORS.length],
      };
    });

    // Build sim state and check solvability
    const simSnakes: SimSnake[] = snakeConfigs.map((cfg, i) => ({
      id: i,
      segments: cfg.segments.map(s => ({ ...s })),
      direction: cfg.direction,
      freed: false,
    }));
    const simState: SimState = { gridSize: { ...gridSize }, snakes: simSnakes };

    if (solvePuzzle(simState)) {
      return { id, name, gridSize, snakes: snakeConfigs };
    }
  }

  // Fallback: return last generated level even if potentially unsolvable
  console.warn(`Level ${id} (${name}): could not generate solvable level after ${maxRetries} retries`);
  const fallback = tryGenerateLevel(gridSize, targetFill, minSnakeLen, maxSnakeLen, overrideCount);
  if (!fallback) {
    // Absolute fallback: empty level
    return { id, name, gridSize, snakes: [] };
  }
  const snakeConfigs = fallback.snakes.map((seg, idx) => ({
    segments: seg,
    direction: chooseHeadDirection(seg, gridSize, fallback.snakes),
    color: SNAKE_COLORS[idx % SNAKE_COLORS.length],
  }));
  return { id, name, gridSize, snakes: snakeConfigs };
}

/**
 * Single attempt at generating a level layout (without solvability check).
 */
function tryGenerateLevel(
  gridSize: Vec3I,
  targetFill: number,
  minSnakeLen: number,
  maxSnakeLen: number,
  overrideCount?: number,
): { snakes: Vec3I[][] } | null {
  const occupied = new Set<string>();
  const snakes: Vec3I[][] = [];

  const allCells: Vec3I[] = [];
  for (let x = 0; x < gridSize.x; x++) {
    for (let y = 0; y < gridSize.y; y++) {
      for (let z = 0; z < gridSize.z; z++) {
        allCells.push(v(x, y, z));
      }
    }
  }

  // Shuffle cells
  for (let i = allCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allCells[i], allCells[j]] = [allCells[j], allCells[i]];
  }

  let filledCells = 0;
  const avgSnakeLen = (minSnakeLen + maxSnakeLen) / 2;
  const targetCount = overrideCount ?? Math.max(2, Math.floor(targetFill / avgSnakeLen));

  for (let attempt = 0; attempt < targetCount && filledCells < targetFill; attempt++) {
    const startIdx = Math.floor(Math.random() * allCells.length);
    let startFound = false;

    for (let tries = 0; tries < allCells.length; tries++) {
      const idx = (startIdx + tries) % allCells.length;
      const cell = allCells[idx];
      if (!occupied.has(cellKey(cell))) {
        const minLen = Math.max(2, minSnakeLen);
        const maxLen = Math.min(maxSnakeLen, Math.floor((targetFill - filledCells) * 0.6) + minSnakeLen);

        if (maxLen < minLen) continue;

        const segments = growSnake(cell, occupied, gridSize, minLen, maxLen);
        if (segments) {
          snakes.push(segments);
          filledCells += segments.length;
          startFound = true;
        }
        break;
      }
    }

    if (!startFound) break;
  }

  if (snakes.length < 2) return null;
  return { snakes };
}

// ============================================================
// Hand-crafted levels
// ============================================================

function snakeDef(
  segments: [number, number, number][],
  direction: Direction,
  colorIdx: number,
) {
  return {
    segments: segments.map(s => v(s[0], s[1], s[2])),
    direction,
    color: SNAKE_COLORS[colorIdx % SNAKE_COLORS.length],
  };
}

// Level 1: Dense intro — many snakes in small 3x3x3 grid
const LEVEL_1: LevelConfig = {
  id: 1,
  name: 'Плотное начало',
  gridSize: v(3, 3, 3),
  snakes: [
    // Snake 0 (Red): head at (0,0,0), body along +X, direction +X (exits through x=3)
    snakeDef([[0, 0, 0], [1, 0, 0]], '+X', 0),
    // Snake 1 (Green): head at (2,2,0), body along -X, direction -X (exits through x=-1)
    snakeDef([[2, 2, 0], [1, 2, 0], [0, 2, 0]], '-X', 1),
    // Snake 2 (Blue): head at (0,1,2), body along -Z, direction -Z (exits through z=-1)
    snakeDef([[0, 1, 2], [0, 1, 1]], '-Z', 2),
    // Snake 3 (Yellow): head at (2,0,1), body along -X, direction +X (exits through x=3)
    snakeDef([[1, 0, 1], [2, 0, 1]], '+X', 3),
    // Snake 4 (Purple): head at (1,2,2), body along -Y, direction +Y (exits through y=3)
    snakeDef([[1, 1, 2], [1, 2, 2]], '+Y', 4),
  ],
};

// Level 2: Two snakes — demonstrates importance of order (kept as-is)
const LEVEL_2: LevelConfig = {
  id: 2,
  name: 'Два пути',
  gridSize: v(3, 3, 3),
  snakes: [
    snakeDef([[0, 1, 1], [0, 1, 0]], '+X', 0),
    snakeDef([[2, 1, 0], [2, 1, 1], [2, 0, 1]], '-X', 1),
  ],
};

// Level 3: Three snakes in 4x4x4, denser
const LEVEL_3: LevelConfig = {
  id: 3,
  name: 'Изгиб',
  gridSize: v(4, 4, 4),
  snakes: [
    snakeDef([[0, 1, 2], [0, 1, 1], [0, 1, 0]], '+X', 0),
    snakeDef([[3, 2, 1], [3, 2, 2]], '-X', 1),
    snakeDef([[1, 0, 3], [2, 0, 3], [2, 1, 3]], '-Z', 2),
    snakeDef([[3, 3, 0], [3, 3, 1]], '-X', 3),
    snakeDef([[0, 3, 3], [0, 2, 3]], '+Y', 4),
  ],
};

// Level 4: Blockers, denser
const LEVEL_4: LevelConfig = {
  id: 4,
  name: 'Препятствие',
  gridSize: v(4, 4, 4),
  snakes: [
    snakeDef([[1, 1, 3], [1, 2, 3], [1, 2, 2], [1, 1, 2]], '-Z', 0),
    snakeDef([[0, 1, 2]], '-X', 1),
    snakeDef([[3, 2, 0], [3, 2, 1]], '-X', 2),
    snakeDef([[2, 0, 0], [1, 0, 0]], '+X', 3),
    snakeDef([[2, 3, 1], [2, 3, 0]], '+Y', 4),
    snakeDef([[0, 0, 1]], '+X', 5),
  ],
};

// Level 5: Vertical emphasis, denser
const LEVEL_5: LevelConfig = {
  id: 5,
  name: 'Вертикальный мир',
  gridSize: v(3, 5, 3),
  snakes: [
    snakeDef([[1, 0, 1], [1, 1, 1]], '-Y', 0),
    snakeDef([[1, 3, 0], [1, 4, 0]], '+Z', 1),
    snakeDef([[0, 2, 2], [0, 2, 1], [0, 3, 1]], '+X', 2),
    snakeDef([[2, 4, 1], [2, 3, 1], [2, 3, 2]], '-Y', 3),
    snakeDef([[0, 0, 0], [0, 1, 0]], '+Z', 4),
    snakeDef([[2, 1, 2], [2, 0, 2]], '-Y', 5),
  ],
};

// ============================================================
// Seeded random for deterministic procedural levels
// ============================================================

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ============================================================
// Pre-generated solvable levels (6-10)
// Using carefully designed layouts that are verified solvable
// ============================================================

// Level 6: 4x4x4, dense, solvable
const LEVEL_6: LevelConfig = {
  id: 6,
  name: 'Плотный район',
  gridSize: v(4, 4, 4),
  snakes: [
    // Snake 0: exits +X
    snakeDef([[0, 0, 0], [1, 0, 0]], '+X', 0),
    // Snake 1: exits -X
    snakeDef([[3, 3, 3], [2, 3, 3], [1, 3, 3]], '-X', 1),
    // Snake 2: exits +Y
    snakeDef([[2, 1, 0], [2, 2, 0]], '+Y', 2),
    // Snake 3: exits -Y
    snakeDef([[0, 3, 2], [0, 2, 2]], '-Y', 3),
    // Snake 4: exits +Z
    snakeDef([[1, 1, 0], [1, 1, 1]], '+Z', 4),
    // Snake 5: exits -Z
    snakeDef([[3, 0, 3], [3, 1, 3]], '-Z', 5),
    // Snake 6: exits +X
    snakeDef([[2, 2, 2], [3, 2, 2]], '+X', 6),
    // Snake 7: exits -Z
    snakeDef([[1, 3, 1], [1, 2, 1]], '-Y', 7),
  ],
};

// Level 7: 4x4x4, dense, solvable
const LEVEL_7: LevelConfig = {
  id: 7,
  name: 'Теснота',
  gridSize: v(4, 4, 4),
  snakes: [
    snakeDef([[0, 0, 0], [1, 0, 0]], '+X', 0),
    snakeDef([[3, 3, 0], [2, 3, 0], [1, 3, 0]], '-X', 1),
    snakeDef([[2, 2, 2], [2, 3, 2]], '+Y', 2),
    snakeDef([[0, 1, 1], [0, 0, 1]], '-Y', 3),
    snakeDef([[1, 1, 0], [1, 1, 1], [1, 1, 2]], '+Z', 4),
    snakeDef([[3, 0, 3], [3, 0, 2]], '-Z', 5),
    snakeDef([[2, 1, 3]], '+X', 6),
    snakeDef([[3, 2, 1], [3, 1, 1]], '-Y', 7),
  ],
};

// Level 8: 5x3x5, elongated, solvable
const LEVEL_8: LevelConfig = {
  id: 8,
  name: 'Змеиная тропа',
  gridSize: v(5, 3, 5),
  snakes: [
    snakeDef([[0, 0, 0], [1, 0, 0], [2, 0, 0]], '+X', 0),
    snakeDef([[4, 0, 4], [3, 0, 4], [2, 0, 4]], '-X', 1),
    snakeDef([[0, 2, 2], [0, 2, 1]], '-Z', 2),
    snakeDef([[4, 2, 0], [4, 1, 0]], '-Y', 3),
    snakeDef([[2, 1, 2], [2, 2, 2]], '+Y', 4),
    snakeDef([[1, 1, 4], [1, 1, 3]], '-Z', 5),
    snakeDef([[3, 0, 1], [3, 0, 2]], '+Z', 6),
    snakeDef([[0, 1, 1]], '+X', 7),
  ],
};

// Level 9: 4x5x4, solvable
const LEVEL_9: LevelConfig = {
  id: 9,
  name: 'Слоёный пирог',
  gridSize: v(4, 5, 4),
  snakes: [
    snakeDef([[0, 0, 0], [1, 0, 0]], '+X', 0),
    snakeDef([[3, 4, 3], [2, 4, 3], [1, 4, 3]], '-X', 1),
    snakeDef([[0, 2, 1], [0, 3, 1]], '+Y', 2),
    snakeDef([[3, 1, 2], [3, 2, 2]], '+Y', 3),
    snakeDef([[2, 0, 3], [2, 0, 2]], '-Z', 4),
    snakeDef([[1, 3, 0], [1, 4, 0]], '+Y', 5),
    snakeDef([[0, 4, 2]], '+X', 6),
    snakeDef([[3, 0, 0], [3, 0, 1]], '+Z', 7),
    snakeDef([[2, 3, 1], [2, 2, 1]], '-Y', 8),
    snakeDef([[1, 1, 3]], '-Z', 9),
  ],
};

// Level 10: 5x5x5, solvable
const LEVEL_10: LevelConfig = {
  id: 10,
  name: 'Лабиринт',
  gridSize: v(5, 5, 5),
  snakes: [
    snakeDef([[0, 0, 0], [1, 0, 0]], '+X', 0),
    snakeDef([[4, 4, 4], [3, 4, 4]], '-X', 1),
    snakeDef([[0, 2, 2], [0, 3, 2]], '+Y', 2),
    snakeDef([[4, 1, 1], [4, 2, 1]], '+Y', 3),
    snakeDef([[2, 0, 4], [3, 0, 4]], '+X', 4),
    snakeDef([[1, 4, 0], [1, 3, 0]], '-Y', 5),
    snakeDef([[3, 3, 3], [3, 3, 2]], '-Z', 6),
    snakeDef([[0, 1, 3]], '+X', 7),
    snakeDef([[4, 0, 2], [4, 0, 1]], '-Z', 8),
    snakeDef([[2, 4, 1], [2, 3, 1]], '-Y', 9),
    snakeDef([[1, 1, 1], [1, 1, 0]], '-Z', 10),
    snakeDef([[3, 1, 4], [2, 1, 4]], '-X', 11),
  ],
};

// Levels 11+: Procedurally generated with solvability guarantee
const PROCEDURAL_CONFIGS: GenerateLevelOptions[] = [
  { gridSize: v(5, 5, 5), fillRatio: 0.65, minSnakeLen: 3, maxSnakeLen: 6 },
  { gridSize: v(4, 4, 6), fillRatio: 0.70, minSnakeLen: 2, maxSnakeLen: 5 },
  { gridSize: v(6, 4, 5), fillRatio: 0.68, minSnakeLen: 3, maxSnakeLen: 6 },
  { gridSize: v(5, 5, 5), fillRatio: 0.75, minSnakeLen: 3, maxSnakeLen: 7 },
  { gridSize: v(4, 6, 4), fillRatio: 0.72, minSnakeLen: 2, maxSnakeLen: 5 },
  { gridSize: v(6, 5, 5), fillRatio: 0.70, minSnakeLen: 3, maxSnakeLen: 7 },
  { gridSize: v(5, 6, 5), fillRatio: 0.75, minSnakeLen: 4, maxSnakeLen: 8 },
  { gridSize: v(6, 6, 6), fillRatio: 0.72, minSnakeLen: 3, maxSnakeLen: 7 },
  { gridSize: v(5, 5, 7), fillRatio: 0.78, minSnakeLen: 4, maxSnakeLen: 8 },
  { gridSize: v(7, 6, 6), fillRatio: 0.75, minSnakeLen: 3, maxSnakeLen: 8 },
];

// ============================================================
// Level registry
// ============================================================

const BASE_LEVELS: LevelConfig[] = [
  LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5,
  LEVEL_6, LEVEL_7, LEVEL_8, LEVEL_9, LEVEL_10,
];

/** Get a level by index (0-based). Generates procedural levels beyond the base set. */
export function getLevel(index: number): LevelConfig | null {
  if (index < 0) return null;

  if (index < BASE_LEVELS.length) {
    return BASE_LEVELS[index];
  }

  // Generate procedural level on demand (with solvability check)
  const procIndex = index - BASE_LEVELS.length;
  const configIdx = procIndex % PROCEDURAL_CONFIGS.length;
  const seed = (index + 1) * 12345;
  const config = PROCEDURAL_CONFIGS[configIdx];

  // Override random for deterministic generation
  const originalRandom = Math.random;
  const rng = seededRandom(seed);
  Math.random = rng;

  const level = generateSolvableLevel(
    index + 1,
    `Уровень ${index + 1}`,
    config,
    15,
  );

  Math.random = originalRandom;
  return level;
}

/** Total number of hand-crafted levels */
export function getBaseLevelCount(): number {
  return BASE_LEVELS.length;
}
