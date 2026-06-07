// ============================================================
// SnakeFlow — Level Configurations & Reverse Generator
//
// Reverse Generation Algorithm:
// Instead of generating a random board and solving it (slow, unreliable),
// we build the level BACKWARDS — placing snakes on an empty board in the
// REVERSE order that the player will remove them.
//
// Key invariant: when placing snake X on a board with existing snakes S:
//   1. O(X) ∩ O(Y) = ∅  for all Y ∈ S   (bodies don't overlap)
//   2. M(X) ∩ O(Y) = ∅  for all Y ∈ S   (new snake's exit path is clear)
//
// O(X) may overlap M(Y) — this creates the "locks" that make the puzzle.
// The last-placed snake exits first (player clicks it first).
// ============================================================

import {
  type Vec3I, type Direction, type LevelConfig,
  ALL_DIRECTIONS, DIR_VECTORS,
} from './types';
import { SNAKE_COLORS } from './constants';
import { inBounds, cellKey, vec3Eq } from './spatial';

// ============================================================
// Helpers
// ============================================================

function v(x: number, y: number, z: number): Vec3I {
  return { x, y, z };
}

function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ============================================================
// Reverse Generation — Core Functions
// ============================================================

/**
 * Compute cells the snake's HEAD will visit on its way out of the grid.
 * These are all in-bounds cells from (head + direction) to the boundary.
 * The snake exits when the head reaches the first out-of-bounds cell.
 */
function computeExitPath(head: Vec3I, direction: Direction, gridSize: Vec3I): string[] {
  const d = DIR_VECTORS[direction];
  const cells: string[] = [];
  let x = head.x + d.x;
  let y = head.y + d.y;
  let z = head.z + d.z;
  while (x >= 0 && x < gridSize.x && y >= 0 && y < gridSize.y && z >= 0 && z < gridSize.z) {
    cells.push(`${x},${y},${z}`);
    x += d.x;
    y += d.y;
    z += d.z;
  }
  return cells;
}

/** Distance from a cell to the grid boundary in a given direction */
function distToBoundary(cell: Vec3I, dir: Direction, gridSize: Vec3I): number {
  const d = DIR_VECTORS[dir];
  if (d.x > 0) return gridSize.x - cell.x;
  if (d.x < 0) return cell.x + 1;
  if (d.y > 0) return gridSize.y - cell.y;
  if (d.y < 0) return cell.y + 1;
  if (d.z > 0) return gridSize.z - cell.z;
  return cell.z + 1;
}

/**
 * Check if all cells in the exit path are free (not in occupied set).
 */
function isExitPathClear(exitPath: string[], occupied: Set<string>): boolean {
  for (const key of exitPath) {
    if (occupied.has(key)) return false;
  }
  return true;
}

/**
 * Generate snake body as a random walk from the head.
 *
 * Constraints:
 *   - Must stay in bounds
 *   - Cannot enter occupied cells (other snakes)
 *   - Cannot enter own body cells (no self-intersection)
 *   - Cannot enter exit path cells (don't block own exit)
 *   - No U-turns (segment can't go back to the previous segment)
 */
function generateBody(
  head: Vec3I,
  direction: Direction,
  occupied: Set<string>,
  gridSize: Vec3I,
  minLen: number,
  maxLen: number,
): Vec3I[] | null {
  const targetLen = minLen + Math.floor(Math.random() * (maxLen - minLen + 1));
  const segments: Vec3I[] = [head];
  const bodySet = new Set<string>([cellKey(head)]);
  const exitSet = new Set(computeExitPath(head, direction, gridSize));
  const d = DIR_VECTORS[direction];

  for (let step = 1; step < targetLen; step++) {
    const tail = segments[segments.length - 1];
    const neighbors: Vec3I[] = [];

    for (const dirStr of ALL_DIRECTIONS) {
      const dv = DIR_VECTORS[dirStr];
      const next: Vec3I = { x: tail.x + dv.x, y: tail.y + dv.y, z: tail.z + dv.z };
      const key = `${next.x},${next.y},${next.z}`;

      if (next.x < 0 || next.x >= gridSize.x ||
          next.y < 0 || next.y >= gridSize.y ||
          next.z < 0 || next.z >= gridSize.z) continue;
      if (occupied.has(key) || bodySet.has(key)) continue;
      if (exitSet.has(key)) continue;

      // No U-turns
      if (segments.length >= 2 && vec3Eq(next, segments[segments.length - 2])) continue;

      neighbors.push(next);
    }

    if (neighbors.length === 0) break;

    // Prefer compact placement: bias toward cells adjacent to existing bodies
    let chosen: Vec3I;
    if (neighbors.length > 1 && Math.random() < 0.5) {
      // Score each neighbor by adjacency to occupied cells
      let bestScore = -1;
      let bestIdx = 0;
      for (let i = 0; i < neighbors.length; i++) {
        let score = 0;
        for (const dirStr of ALL_DIRECTIONS) {
          const dv = DIR_VECTORS[dirStr];
          const adj = `${neighbors[i].x + dv.x},${neighbors[i].y + dv.y},${neighbors[i].z + dv.z}`;
          if (occupied.has(adj)) score++;
        }
        // Add small randomness to break ties
        score += Math.random() * 0.5;
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      chosen = neighbors[bestIdx];
    } else {
      chosen = neighbors[Math.floor(Math.random() * neighbors.length)];
    }

    segments.push(chosen);
    bodySet.add(cellKey(chosen));
  }

  if (segments.length < minLen) return null;

  // Verify direction validity: head+D should not be in own body
  const nextHead: Vec3I = { x: head.x + d.x, y: head.y + d.y, z: head.z + d.z };
  for (const seg of segments) {
    if (vec3Eq(seg, nextHead)) return null;
  }

  return segments;
}

/**
 * Try to find a valid snake placement on the current board.
 * Picks random free cells as head candidates and tries all directions.
 * Returns a valid snake config or null if no placement found.
 */
function tryPlaceSnake(
  gridSize: Vec3I,
  occupied: Set<string>,
  minLen: number,
  maxLen: number,
): { segments: Vec3I[]; direction: Direction } | null {
  // Collect all free cells
  const freeCells: Vec3I[] = [];
  for (let x = 0; x < gridSize.x; x++) {
    for (let y = 0; y < gridSize.y; y++) {
      for (let z = 0; z < gridSize.z; z++) {
        const c = v(x, y, z);
        if (!occupied.has(cellKey(c))) freeCells.push(c);
      }
    }
  }

  if (freeCells.length < minLen) return null;
  shuffleArray(freeCells);

  // Try a limited number of head candidates (performance guard)
  const maxCandidates = Math.min(40, freeCells.length);

  for (let t = 0; t < maxCandidates; t++) {
    const head = freeCells[t];

    // Sort directions: prefer shorter exit paths (more likely to be clear)
    const dirs = [...ALL_DIRECTIONS];
    dirs.sort((a, b) => distToBoundary(head, a, gridSize) - distToBoundary(head, b, gridSize));

    // Add randomness: occasionally swap directions for variety
    for (let i = 1; i < dirs.length; i++) {
      if (Math.random() < 0.35) {
        const j = Math.floor(Math.random() * (i + 1));
        [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
      }
    }

    for (const dir of dirs) {
      // Quick check: exit path must be clear of occupied cells
      const exitPath = computeExitPath(head, dir, gridSize);
      if (!isExitPathClear(exitPath, occupied)) continue;

      // Generate body
      const segments = generateBody(head, dir, occupied, gridSize, minLen, maxLen);
      if (!segments) continue;

      // Final validation: body must not overlap occupied cells
      let valid = true;
      for (const seg of segments) {
        if (occupied.has(cellKey(seg))) { valid = false; break; }
      }
      if (!valid) continue;

      return { segments, direction: dir };
    }
  }

  return null;
}

// ============================================================
// Reverse Generation Algorithm
// ============================================================

export interface GenerateLevelOptions {
  gridSize: Vec3I;
  minSnakeLen?: number;
  maxSnakeLen?: number;
  snakeCount?: number;
}

/**
 * Generate a solvable level using reverse generation.
 *
 * Places snakes one at a time on an empty board. The last-placed snake
 * is the one the player should free first. Uses backtracking when
 * no valid placement can be found.
 *
 * GUARANTEES solvability without needing a BFS/A* solver.
 * Generation time: O(snakeCount * attempts * maxBodyLen) — milliseconds.
 */
function generateReverseLevel(
  id: number,
  name: string,
  options: GenerateLevelOptions,
): LevelConfig | null {
  const {
    gridSize,
    minSnakeLen = 2,
    maxSnakeLen = 4,
    snakeCount: targetCount = 8,
  } = options;

  const occupied = new Set<string>();
  const snakes: LevelConfig['snakes'] = [];

  const MAX_PLACE_RETRIES = 30;
  const MAX_BACKTRACKS = 200;
  let totalBacktracks = 0;

  while (snakes.length < targetCount) {
    let placed = false;

    // Try to place a snake (multiple attempts with different random state)
    for (let retry = 0; retry < MAX_PLACE_RETRIES; retry++) {
      const result = tryPlaceSnake(gridSize, occupied, minSnakeLen, maxSnakeLen);
      if (result) {
        // Mark body cells as occupied
        for (const seg of result.segments) {
          occupied.add(cellKey(seg));
        }
        snakes.push({
          segments: result.segments,
          direction: result.direction,
          color: SNAKE_COLORS[snakes.length % SNAKE_COLORS.length],
        });
        placed = true;
        break;
      }
    }

    if (!placed) {
      // Backtrack: remove the last placed snake and try again
      if (snakes.length === 0) return null;
      totalBacktracks++;
      if (totalBacktracks > MAX_BACKTRACKS) return null;

      const removed = snakes.pop()!;
      for (const seg of removed.segments) {
        occupied.delete(cellKey(seg));
      }
    }
  }

  return { id, name, gridSize, snakes };
}

// ============================================================
// Hand-crafted Levels
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

// Level 1: Simple — 2 snakes in 3x3x3 (shows importance of order)
const LEVEL_1: LevelConfig = {
  id: 1,
  name: 'Два пути',
  gridSize: v(3, 3, 3),
  snakes: [
    snakeDef([[0, 1, 1], [1, 1, 1]], '-X', 0),
    snakeDef([[2, 1, 0], [2, 1, 1], [2, 0, 1]], '-X', 1),
  ],
};

// Level 2: Medium — 10 snakes in 5x5x5 (onion layers)
const LEVEL_2: LevelConfig = {
  id: 2,
  name: 'Луковые слои',
  gridSize: v(5, 5, 5),
  snakes: [
    // Layer 1: exit immediately
    snakeDef([[0, 1, 1], [1, 1, 1]], '-X', 0),
    snakeDef([[4, 1, 3], [3, 1, 3]], '+X', 1),
    snakeDef([[2, 4, 2], [2, 3, 2]], '+Y', 2),
    snakeDef([[3, 0, 2], [3, 1, 2]], '-Y', 3),
    snakeDef([[1, 2, 4], [1, 2, 3]], '+Z', 4),
    snakeDef([[3, 2, 0], [3, 2, 1]], '-Z', 5),
    // Layer 2: blocked by Layer 1 bodies
    snakeDef([[1, 1, 1], [1, 0, 1]], '+Y', 6),
    snakeDef([[3, 1, 3], [3, 0, 3]], '+Y', 7),
    snakeDef([[2, 3, 2], [2, 3, 1]], '-X', 8),
    snakeDef([[3, 1, 2], [3, 1, 1]], '-X', 9),
  ],
};

// Level 3: Hard — 16 snakes in 5x5x5 (deep onion: L1→L2→L3)
const LEVEL_3: LevelConfig = {
  id: 3,
  name: 'Глубокий лук',
  gridSize: v(5, 5, 5),
  snakes: [
    // Layer 1 (8 snakes, exit immediately)
    snakeDef([[0, 1, 1], [1, 1, 1]], '-X', 0),
    snakeDef([[4, 1, 3], [3, 1, 3]], '+X', 1),
    snakeDef([[2, 4, 1], [2, 3, 1]], '+Y', 2),
    snakeDef([[3, 0, 2], [3, 1, 2]], '-Y', 3),
    snakeDef([[1, 3, 4], [1, 3, 3]], '+Z', 4),
    snakeDef([[3, 2, 0], [3, 2, 1]], '-Z', 5),
    snakeDef([[0, 4, 3]], '-X', 6),
    snakeDef([[4, 2, 0], [4, 2, 1]], '-Z', 7),
    // Layer 2 (4 snakes, blocked by L1 bodies)
    snakeDef([[1, 1, 1], [1, 0, 1]], '+Y', 8),
    snakeDef([[3, 1, 3], [3, 0, 3]], '+Y', 9),
    snakeDef([[2, 3, 1], [2, 3, 0]], '+Z', 10),
    snakeDef([[3, 1, 2], [3, 1, 1]], '-X', 11),
    // Layer 3 (4 snakes, blocked by L2 bodies)
    snakeDef([[1, 0, 1], [2, 0, 1]], '-X', 12),
    snakeDef([[3, 0, 3]], '+X', 13),
    snakeDef([[2, 3, 0]], '+Y', 14),
    snakeDef([[3, 1, 1]], '-X', 15),
  ],
};

// ============================================================
// Seeded Random (deterministic procedural levels)
// ============================================================

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ============================================================
// Procedural Level Configs (difficulty progression)
// ============================================================

const PROCEDURAL_CONFIGS: GenerateLevelOptions[] = [
  // Gentle intro after hand-crafted levels
  { gridSize: v(4, 4, 4), snakeCount: 4,  minSnakeLen: 2, maxSnakeLen: 3 },
  { gridSize: v(5, 4, 4), snakeCount: 5,  minSnakeLen: 2, maxSnakeLen: 3 },
  { gridSize: v(5, 5, 5), snakeCount: 6,  minSnakeLen: 2, maxSnakeLen: 4 },
  { gridSize: v(5, 5, 5), snakeCount: 8,  minSnakeLen: 2, maxSnakeLen: 4 },
  { gridSize: v(5, 5, 5), snakeCount: 10, minSnakeLen: 3, maxSnakeLen: 5 },
  // Larger grids
  { gridSize: v(6, 5, 5), snakeCount: 8,  minSnakeLen: 2, maxSnakeLen: 4 },
  { gridSize: v(6, 5, 5), snakeCount: 12, minSnakeLen: 3, maxSnakeLen: 5 },
  { gridSize: v(6, 6, 6), snakeCount: 10, minSnakeLen: 3, maxSnakeLen: 5 },
  { gridSize: v(6, 6, 6), snakeCount: 14, minSnakeLen: 3, maxSnakeLen: 5 },
  { gridSize: v(7, 6, 6), snakeCount: 12, minSnakeLen: 3, maxSnakeLen: 5 },
  { gridSize: v(7, 6, 6), snakeCount: 16, minSnakeLen: 3, maxSnakeLen: 6 },
  { gridSize: v(7, 7, 7), snakeCount: 14, minSnakeLen: 3, maxSnakeLen: 5 },
  { gridSize: v(7, 7, 7), snakeCount: 18, minSnakeLen: 3, maxSnakeLen: 6 },
  { gridSize: v(7, 7, 7), snakeCount: 22, minSnakeLen: 3, maxSnakeLen: 6 },
];

// ============================================================
// Level Registry
// ============================================================

const BASE_LEVELS: LevelConfig[] = [LEVEL_1, LEVEL_2, LEVEL_3];

/** Get a level by index (0-based). Generates procedural levels beyond the 3 hand-crafted ones. */
export function getLevel(index: number): LevelConfig | null {
  if (index < 0) return null;

  if (index < BASE_LEVELS.length) {
    return BASE_LEVELS[index];
  }

  // Generate procedural level on demand using reverse generation
  const procIndex = index - BASE_LEVELS.length;
  const configIdx = procIndex % PROCEDURAL_CONFIGS.length;
  const seed = (index + 1) * 12345;
  const config = PROCEDURAL_CONFIGS[configIdx];

  const originalRandom = Math.random;
  let level: LevelConfig | null = null;

  // Try multiple seeds for reliability
  for (let offset = 0; offset < 5 && !level; offset++) {
    Math.random = seededRandom(seed + offset * 7919);
    level = generateReverseLevel(
      index + 1,
      `Уровень ${index + 1}`,
      config,
    );
  }

  // Fallback: reduce snake count if needed
  if (!level) {
    const fallbackConfig: GenerateLevelOptions = {
      ...config,
      snakeCount: Math.max(2, Math.floor((config.snakeCount ?? 8) * 0.6)),
    };
    for (let offset = 0; offset < 3 && !level; offset++) {
      Math.random = seededRandom(seed + offset * 1301 + 5000);
      level = generateReverseLevel(
        index + 1,
        `Уровень ${index + 1}`,
        fallbackConfig,
      );
    }
  }

  Math.random = originalRandom;
  return level;
}

/** Total number of hand-crafted levels */
export function getBaseLevelCount(): number {
  return BASE_LEVELS.length;
}
