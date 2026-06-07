// ============================================================
// SnakeFlow — Level Configurations & Reverse Generator
//
// Reverse Generation Algorithm:
// Build level BACKWARDS — place snakes on an empty board in reverse
// solution order (last placed = first freed by the player).
//
// Key invariants when placing snake X on board with snakes S:
//   1. O(X) ∩ O(Y) = ∅  for all Y ∈ S   (bodies don't overlap)
//   2. M(X) ∩ O(Y) = ∅  for all Y ∈ S   (exit path is clear)
//
// O(X) may overlap M(Y) — this creates the puzzle "locks".
//
// Placement order: CENTER → EDGE (center snakes exit last,
// boundary snakes exit first with empty exit paths).
// Direction bias: OUTWARD (toward nearest boundary face).
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

/** Distance from a cell to the grid boundary in a given direction (in cells) */
function distToBoundary(cell: Vec3I, dir: Direction, gridSize: Vec3I): number {
  const d = DIR_VECTORS[dir];
  if (d.x > 0) return gridSize.x - cell.x;
  if (d.x < 0) return cell.x + 1;
  if (d.y > 0) return gridSize.y - cell.y;
  if (d.y < 0) return cell.y + 1;
  if (d.z > 0) return gridSize.z - cell.z;
  return cell.z + 1;
}

/** Preferred outward direction: toward the nearest boundary face */
function outwardDirection(cell: Vec3I, gridSize: Vec3I): Direction {
  let bestDir: Direction = ALL_DIRECTIONS[0];
  let bestDist = Infinity;
  for (const dir of ALL_DIRECTIONS) {
    const d = distToBoundary(cell, dir, gridSize);
    if (d < bestDist) {
      bestDist = d;
      bestDir = dir;
    }
  }
  return bestDir;
}

/** Squared distance from a cell to the grid center */
function distFromCenter(cell: Vec3I, gridSize: Vec3I): number {
  const cx = (gridSize.x - 1) / 2;
  const cy = (gridSize.y - 1) / 2;
  const cz = (gridSize.z - 1) / 2;
  return (cell.x - cx) ** 2 + (cell.y - cy) ** 2 + (cell.z - cz) ** 2;
}

/**
 * Compute cells the snake's HEAD will visit on its way out.
 * All in-bounds cells from (head + dir) stepping to the boundary.
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

/** Check if all cells in the exit path are free of occupied cells */
function isExitPathClear(exitPath: string[], occupied: Set<string>): boolean {
  for (const key of exitPath) {
    if (occupied.has(key)) return false;
  }
  return true;
}

/**
 * Generate snake body as a short random walk from the head cell.
 *
 * The body grows from the head, one segment at a time. Each new segment
 * must be: in-bounds, free, not on the exit path, not a U-turn.
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

    // Packing heuristic: prefer cells adjacent to already-occupied cells
    let chosen: Vec3I;
    if (neighbors.length > 1 && Math.random() < 0.5) {
      let bestScore = -1;
      let bestIdx = 0;
      for (let i = 0; i < neighbors.length; i++) {
        let score = 0;
        for (const dirStr of ALL_DIRECTIONS) {
          const dv = DIR_VECTORS[dirStr];
          const adj = `${neighbors[i].x + dv.x},${neighbors[i].y + dv.y},${neighbors[i].z + dv.z}`;
          if (occupied.has(adj)) score++;
        }
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

  // Verify head+D is not in own body (would self-block)
  const nextHead: Vec3I = { x: head.x + d.x, y: head.y + d.y, z: head.z + d.z };
  for (const seg of segments) {
    if (vec3Eq(seg, nextHead)) return null;
  }

  return segments;
}

/**
 * Collect free (unoccupied) cells, sorted center-to-edge with randomization.
 * Center cells are tried first (they exit last, need long clear paths → empty board).
 * Boundary cells are tried last (they exit first, empty exit paths → always valid).
 */
function collectFreeCellsCenterFirst(
  occupied: Set<string>,
  gridSize: Vec3I,
): Vec3I[] {
  const free: Vec3I[] = [];
  for (let x = 0; x < gridSize.x; x++) {
    for (let y = 0; y < gridSize.y; y++) {
      for (let z = 0; z < gridSize.z; z++) {
        const c = v(x, y, z);
        if (!occupied.has(cellKey(c))) free.push(c);
      }
    }
  }
  shuffleArray(free);
  // Stable sort: group by distance band from center (center first)
  free.sort((a, b) => {
    const da = Math.floor(distFromCenter(a, gridSize));
    const db = Math.floor(distFromCenter(b, gridSize));
    if (da !== db) return da - db;
    return 0; // preserve shuffle within same band
  });
  return free;
}

/**
 * Try to place one snake on the current board.
 * Iterates free cells center-to-edge, prefers outward directions.
 */
function tryPlaceSnake(
  gridSize: Vec3I,
  occupied: Set<string>,
  freeCells: Vec3I[],
  minLen: number,
  maxLen: number,
): { segments: Vec3I[]; direction: Direction } | null {
  const maxCandidates = Math.min(80, freeCells.length);

  for (let t = 0; t < maxCandidates; t++) {
    const head = freeCells[t];

    // Directions: prefer outward (shortest exit path), then by distance
    const preferred = outwardDirection(head, gridSize);
    const dirs = [...ALL_DIRECTIONS];
    dirs.sort((a, b) => {
      if (a === preferred) return -1;
      if (b === preferred) return 1;
      return distToBoundary(head, a, gridSize) - distToBoundary(head, b, gridSize);
    });
    // Occasional random swaps for variety
    for (let i = 1; i < dirs.length; i++) {
      if (Math.random() < 0.2) {
        const j = Math.floor(Math.random() * (i + 1));
        [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
      }
    }

    for (const dir of dirs) {
      // Quick check: exit path must be clear
      const exitPath = computeExitPath(head, dir, gridSize);
      if (!isExitPathClear(exitPath, occupied)) continue;

      const segments = generateBody(head, dir, occupied, gridSize, minLen, maxLen);
      if (!segments) continue;

      // Final: body must not overlap any occupied cell
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
  /** Target fill ratio (0.0–1.0). Default 0.9 = 90% of cells occupied. */
  fillRatio?: number;
  minSnakeLen?: number;
  maxSnakeLen?: number;
  /** Override: exact number of snakes (takes precedence over fillRatio). */
  snakeCount?: number;
}

/**
 * Generate a solvable level using reverse generation with backtracking.
 *
 * Placement order: center → edge (onion layers).
 * Center snakes exit last (long paths through initially empty board).
 * Boundary snakes exit first (empty exit paths).
 *
 * GUARANTEES solvability — no BFS/A* solver needed.
 */
function generateReverseLevel(
  id: number,
  name: string,
  options: GenerateLevelOptions,
): LevelConfig | null {
  const {
    gridSize,
    fillRatio = 0.9,
    minSnakeLen = 2,
    maxSnakeLen = 3,
    snakeCount: overrideCount,
  } = options;

  const totalCells = gridSize.x * gridSize.y * gridSize.z;
  const avgLen = (minSnakeLen + maxSnakeLen) / 2;
  const targetCount = overrideCount ?? Math.ceil(totalCells * fillRatio / avgLen);

  const occupied = new Set<string>();
  const snakes: LevelConfig['snakes'] = [];

  const MAX_PLACE_RETRIES = 50;
  const MAX_BACKTRACKS = 800;
  let totalBacktracks = 0;

  while (snakes.length < targetCount) {
    const freeCells = collectFreeCellsCenterFirst(occupied, gridSize);
    if (freeCells.length < minSnakeLen) break;

    let placed = false;
    for (let retry = 0; retry < MAX_PLACE_RETRIES && !placed; retry++) {
      const result = tryPlaceSnake(gridSize, occupied, freeCells, minSnakeLen, maxSnakeLen);
      if (result) {
        for (const seg of result.segments) {
          occupied.add(cellKey(seg));
        }
        snakes.push({
          segments: result.segments,
          direction: result.direction,
          color: SNAKE_COLORS[snakes.length % SNAKE_COLORS.length],
        });
        placed = true;
      }
    }

    if (!placed) {
      // Backtrack: remove last snake, free its cells, try different placement
      if (snakes.length === 0) return null;
      totalBacktracks++;
      if (totalBacktracks > MAX_BACKTRACKS) {
        // Return partial result if we have a decent fill
        const fillPct = occupied.size / totalCells;
        if (fillPct >= fillRatio * 0.7 && snakes.length >= 2) {
          break;
        }
        return null;
      }
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

// Level 1: Tutorial — 2 snakes in 3x3x3 (shows importance of order)
const LEVEL_1: LevelConfig = {
  id: 1,
  name: 'Два пути',
  gridSize: v(3, 3, 3),
  snakes: [
    snakeDef([[0, 1, 1], [1, 1, 1]], '-X', 0),
    snakeDef([[2, 1, 0], [2, 1, 1], [2, 0, 1]], '-X', 1),
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
// All use fillRatio: 0.9 for dense packing.
// ============================================================

const PROCEDURAL_CONFIGS: GenerateLevelOptions[] = [
  // Tutorial-sized grid — short snakes only
  { gridSize: v(3, 3, 3), fillRatio: 0.85, minSnakeLen: 2, maxSnakeLen: 3 },
  // 4x4x4 — short snakes
  { gridSize: v(4, 4, 4), fillRatio: 0.9, minSnakeLen: 2, maxSnakeLen: 5 },
  // 4x4x5 — medium variety
  { gridSize: v(4, 4, 5), fillRatio: 0.9, minSnakeLen: 2, maxSnakeLen: 6 },
  // 5x5x5 — mix of short and long
  { gridSize: v(5, 5, 5), fillRatio: 0.9, minSnakeLen: 2, maxSnakeLen: 6 },
  // 5x5x5 — longer snakes, more puzzle complexity
  { gridSize: v(5, 5, 5), fillRatio: 0.9, minSnakeLen: 3, maxSnakeLen: 8 },
  // 5x5x6
  { gridSize: v(5, 5, 6), fillRatio: 0.9, minSnakeLen: 2, maxSnakeLen: 7 },
  // 6x5x5
  { gridSize: v(6, 5, 5), fillRatio: 0.9, minSnakeLen: 2, maxSnakeLen: 7 },
  // 6x5x5 — long snakes
  { gridSize: v(6, 5, 5), fillRatio: 0.9, minSnakeLen: 3, maxSnakeLen: 9 },
  // 6x6x6
  { gridSize: v(6, 6, 6), fillRatio: 0.9, minSnakeLen: 2, maxSnakeLen: 8 },
  // 6x6x6 — long snakes
  { gridSize: v(6, 6, 6), fillRatio: 0.9, minSnakeLen: 3, maxSnakeLen: 10 },
  // 7x6x6
  { gridSize: v(7, 6, 6), fillRatio: 0.9, minSnakeLen: 2, maxSnakeLen: 8 },
  // 7x6x6 — long snakes
  { gridSize: v(7, 6, 6), fillRatio: 0.9, minSnakeLen: 3, maxSnakeLen: 10 },
  // 7x7x7
  { gridSize: v(7, 7, 7), fillRatio: 0.9, minSnakeLen: 2, maxSnakeLen: 8 },
  // 7x7x7 — long snakes (max variety)
  { gridSize: v(7, 7, 7), fillRatio: 0.9, minSnakeLen: 3, maxSnakeLen: 12 },
];

// ============================================================
// Level Registry
// ============================================================

const BASE_LEVELS: LevelConfig[] = [LEVEL_1];

/** Get a level by index (0-based). Generates procedural levels beyond the 1 tutorial. */
export function getLevel(index: number): LevelConfig | null {
  if (index < 0) return null;

  if (index < BASE_LEVELS.length) {
    return BASE_LEVELS[index];
  }

  // Procedural levels (starting from level 2)
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

  // Fallback: lower fill ratio
  if (!level) {
    const fallbackConfig: GenerateLevelOptions = {
      ...config,
      fillRatio: 0.7,
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
