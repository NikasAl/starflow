// ============================================================
// SnakeFlow — Level Configurations & Procedural Generator
// ============================================================

import {
  type Vec3I, type Direction, type LevelConfig,
  ALL_DIRECTIONS, DIR_VECTORS,
} from './types';
import { SNAKE_COLORS } from './constants';

// ============================================================
// Helpers
// ============================================================

function v(x: number, y: number, z: number): Vec3I {
  return { x, y, z };
}

function cellKey(c: Vec3I): string {
  return `${c.x},${c.y},${c.z}`;
}

function vecEq(a: Vec3I, b: Vec3I): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

// ============================================================
// Direction validation
// ============================================================

/**
 * Check if a direction is valid for a snake:
 * - Must NOT point into any of the snake's own body segments
 * - Returns false if direction leads into own body
 */
function isDirectionValid(
  segments: Vec3I[],
  direction: Direction,
): boolean {
  const head = segments[0];
  const d = DIR_VECTORS[direction];
  const next: Vec3I = { x: head.x + d.x, y: head.y + d.y, z: head.z + d.z };

  // Must not point into own body
  for (const seg of segments) {
    if (vecEq(seg, next)) return false;
  }
  return true;
}

/**
 * Get all valid directions for a snake (not pointing into own body).
 * Filtered to directions that lead outward or into empty space.
 */
function getValidDirections(
  segments: Vec3I[],
  gridSize: Vec3I,
): Direction[] {
  return ALL_DIRECTIONS.filter(dir => isDirectionValid(segments, dir));
}

// ============================================================
// Procedural Snake Placement
// ============================================================

/**
 * Try to grow a snake from a starting cell.
 * The snake grows randomly, avoiding occupied cells.
 * Returns the segment list or null if placement failed.
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

    // Find available neighbors (adjacent, not occupied, in bounds)
    const neighbors: { cell: Vec3I; dir: Vec3I }[] = [];
    for (const dirStr of ALL_DIRECTIONS) {
      const d = DIR_VECTORS[dirStr];
      const next: Vec3I = { x: head.x + d.x, y: head.y + d.y, z: head.z + d.z };

      if (next.x < 0 || next.x >= gridSize.x ||
          next.y < 0 || next.y >= gridSize.y ||
          next.z < 0 || next.z >= gridSize.z) continue;
      if (occupied.has(cellKey(next))) continue;

      // Prefer directions that don't double back on the previous segment
      if (segments.length >= 2) {
        const prev = segments[segments.length - 2];
        // Don't go back the way we came
        if (vecEq(next, prev)) continue;
      }

      neighbors.push({ cell: next, dir: d });
    }

    if (neighbors.length === 0) break;

    // Pick a random neighbor (weighted to prefer continuing straight)
    let chosen: { cell: Vec3I; dir: Vec3I };
    if (neighbors.length > 1 && segments.length >= 2) {
      const prev = segments[segments.length - 2];
      const head = segments[segments.length - 1];
      const forwardDir: Vec3I = {
        x: head.x - prev.x,
        y: head.y - prev.y,
        z: head.z - prev.z,
      };

      // 60% chance to continue straight if possible
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

  // If we didn't reach minimum length, rollback
  if (segments.length < minLen) {
    for (const seg of segments) {
      occupied.delete(cellKey(seg));
    }
    return null;
  }

  return segments;
}

/**
 * Choose a good direction for a snake's head.
 * Prefers directions that lead toward the nearest boundary
 * (so the snake has a path to exit).
 */
function chooseHeadDirection(
  segments: Vec3I[],
  gridSize: Vec3I,
): Direction {
  const head = segments[0];
  const validDirs = getValidDirections(segments, gridSize);
  if (validDirs.length === 0) return '+Y'; // fallback

  // Score each direction by distance to nearest boundary along that axis
  let bestDir = validDirs[0];
  let bestScore = -Infinity;

  for (const dir of validDirs) {
    const d = DIR_VECTORS[dir];
    const next: Vec3I = { x: head.x + d.x, y: head.y + d.y, z: head.z + d.z };

    // Higher score = closer to boundary (easier to exit)
    let score = 0;

    // Distance to boundary along this direction
    if (d.x > 0) score = gridSize.x - head.x;
    else if (d.x < 0) score = head.x + 1;
    else if (d.y > 0) score = gridSize.y - head.y;
    else if (d.y < 0) score = head.y + 1;
    else if (d.z > 0) score = gridSize.z - head.z;
    else if (d.z < 0) score = head.z + 1;

    // Bonus if the next cell is unoccupied and closer to boundary
    // Small random factor to add variety
    score += Math.random() * 2;

    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }

  return bestDir;
}

// ============================================================
// Level Generator
// ============================================================

export interface GenerateLevelOptions {
  gridSize: Vec3I;
  /** Target fill ratio (0..1), how much of the grid to fill with snakes */
  fillRatio?: number;
  /** Minimum snake length */
  minSnakeLen?: number;
  /** Maximum snake length */
  maxSnakeLen?: number;
  /** Optional: exact snake count override */
  snakeCount?: number;
}

/**
 * Generate a level procedurally.
 * Fills the grid with snakes of varying lengths.
 * Each snake gets a valid direction (not pointing into own body).
 */
export function generateLevel(
  id: number,
  name: string,
  options: GenerateLevelOptions,
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
  const occupied = new Set<string>();
  const snakes: { segments: Vec3I[]; direction: Direction; color: number }[] = [];

  // Build list of all cells, shuffle
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

  // Determine target number of snakes
  const avgSnakeLen = (minSnakeLen + maxSnakeLen) / 2;
  const targetCount = overrideCount ?? Math.max(2, Math.floor(targetFill / avgSnakeLen));

  for (let attempt = 0; attempt < targetCount && filledCells < targetFill; attempt++) {
    // Pick a random unoccupied starting cell
    const startIdx = Math.floor(Math.random() * allCells.length);
    let startFound = false;
    for (let tries = 0; tries < allCells.length; tries++) {
      const idx = (startIdx + tries) % allCells.length;
      const cell = allCells[idx];
      if (!occupied.has(cellKey(cell))) {
        // Try to grow snake from this cell
        const minLen = Math.max(2, minSnakeLen);
        const maxLen = Math.min(maxSnakeLen, Math.floor((targetFill - filledCells) * 0.6) + minSnakeLen);

        if (maxLen < minLen) continue;

        const segments = growSnake(cell, occupied, gridSize, minLen, maxLen);
        if (segments) {
          // Choose a valid head direction
          const direction = chooseHeadDirection(segments, gridSize);
          const color = SNAKE_COLORS[snakes.length % SNAKE_COLORS.length];

          snakes.push({ segments, direction, color });
          filledCells += segments.length;
          startFound = true;
        }
        break;
      }
    }

    if (!startFound) break; // No more space
  }

  return { id, name, gridSize, snakes };
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

// Level 1: Simple intro (3x3x3, 1 short snake)
const LEVEL_1: LevelConfig = {
  id: 1,
  name: 'Первые шаги',
  gridSize: v(3, 3, 3),
  snakes: [
    snakeDef([[1, 1, 1], [1, 1, 0]], '+Z', 0),
  ],
};

// Level 2: Two snakes (3x3x3, 2 snakes)
const LEVEL_2: LevelConfig = {
  id: 2,
  name: 'Два пути',
  gridSize: v(3, 3, 3),
  snakes: [
    snakeDef([[0, 1, 1], [0, 1, 0]], '+X', 0),
    snakeDef([[2, 1, 0], [2, 1, 1], [2, 0, 1]], '-X', 1),
  ],
};

// Level 3: Three snakes (4x4x4, 3 snakes)
const LEVEL_3: LevelConfig = {
  id: 3,
  name: 'Изгиб',
  gridSize: v(4, 4, 4),
  snakes: [
    snakeDef([[0, 1, 2], [0, 1, 1], [0, 1, 0]], '+X', 0),
    snakeDef([[3, 2, 1], [3, 2, 2]], '-X', 1),
    snakeDef([[1, 0, 3], [2, 0, 3], [2, 1, 3]], '-Z', 2),
  ],
};

// Level 4: Blockers (4x4x4, 4 snakes, need ordering)
const LEVEL_4: LevelConfig = {
  id: 4,
  name: 'Препятствие',
  gridSize: v(4, 4, 4),
  snakes: [
    snakeDef([[1, 1, 3], [1, 2, 3], [1, 2, 2], [1, 1, 2]], '-Z', 0),
    snakeDef([[0, 1, 2]], '-X', 1),
    snakeDef([[3, 2, 0], [3, 2, 1]], '-X', 2),
    snakeDef([[2, 0, 0], [1, 0, 0]], '+X', 3),
  ],
};

// Level 5: Vertical emphasis (3x5x3, 4 snakes)
const LEVEL_5: LevelConfig = {
  id: 5,
  name: 'Вертикальный мир',
  gridSize: v(3, 5, 3),
  snakes: [
    snakeDef([[1, 0, 1], [1, 1, 1]], '-Y', 0),
    snakeDef([[1, 3, 0], [1, 4, 0]], '+Z', 1),
    snakeDef([[0, 2, 2], [0, 2, 1], [0, 3, 1]], '+X', 2),
    snakeDef([[2, 4, 1], [2, 3, 1], [2, 3, 2]], '-Y', 3),
  ],
};

// ============================================================
// Procedural levels (generated, seeded for reproducibility)
// ============================================================

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/**
 * Generate a deterministic level using a seed.
 * Replaces Math.random() temporarily.
 */
function generateSeededLevel(
  id: number,
  name: string,
  gridSize: Vec3I,
  seed: number,
  fillRatio: number,
  minLen: number,
  maxLen: number,
): LevelConfig {
  // Temporarily override Math.random
  const originalRandom = Math.random;
  const rng = seededRandom(seed);
  Math.random = rng;

  const level = generateLevel(id, name, { gridSize, fillRatio, minSnakeLen: minLen, maxSnakeLen: maxLen });

  Math.random = originalRandom;
  return level;
}

// Levels 6-10: Procedurally generated
const LEVEL_6 = generateSeededLevel(6, 'Плотный район', v(4, 4, 4), 42, 0.70, 2, 4);
const LEVEL_7 = generateSeededLevel(7, 'Теснота', v(3, 3, 3), 1337, 0.85, 2, 3);
const LEVEL_8 = generateSeededLevel(8, 'Змеиная тропа', v(5, 3, 5), 2024, 0.70, 3, 5);
const LEVEL_9 = generateSeededLevel(9, 'Слоёный пирог', v(4, 5, 4), 999, 0.65, 3, 6);
const LEVEL_10 = generateSeededLevel(10, 'Лабиринт', v(5, 5, 5), 7777, 0.60, 3, 6);

// Levels 11+: Generated on demand
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

  // Generate procedural level on demand
  const procIndex = index - BASE_LEVELS.length;
  const configIdx = procIndex % PROCEDURAL_CONFIGS.length;
  const seed = (index + 1) * 12345; // unique seed per level
  const config = PROCEDURAL_CONFIGS[configIdx];

  return generateSeededLevel(
    index + 1,
    `Уровень ${index + 1}`,
    config.gridSize,
    seed,
    config.fillRatio ?? 0.65,
    config.minSnakeLen ?? 2,
    config.maxSnakeLen ?? 5,
  );
}

/** Total number of hand-crafted levels */
export function getBaseLevelCount(): number {
  return BASE_LEVELS.length;
}
