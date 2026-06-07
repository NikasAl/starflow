// ============================================================
// SnakeFlow — Level Configurations & Procedural Generator
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

// ============================================================
// Direction validation
// ============================================================

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

// ============================================================
// BFS Solver (for procedural level verification)
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

function simCellOccupied(cell: Vec3I, snakes: SimSnake[], excludeIdx: number): boolean {
  for (let i = 0; i < snakes.length; i++) {
    if (i === excludeIdx || snakes[i].freed) continue;
    for (const seg of snakes[i].segments) {
      if (seg.x === cell.x && seg.y === cell.y && seg.z === cell.z) return true;
    }
  }
  return false;
}

function simMoveSnake(state: SimState, snakeIdx: number): { result: 'freed' | 'blocked' | 'moved'; state: SimState } {
  const newState: SimState = {
    gridSize: { ...state.gridSize },
    snakes: state.snakes.map(s => ({
      ...s,
      segments: s.segments.map(seg => ({ ...seg })),
    })),
  };
  const snake = newState.snakes[snakeIdx];
  if (snake.freed) return { result: 'blocked', state: newState };

  let moved = false;
  for (let step = 0; step < 100; step++) {
    const head = snake.segments[0];
    const d = DIR_VECTORS[snake.direction];
    const nextHead: Vec3I = { x: head.x + d.x, y: head.y + d.y, z: head.z + d.z };

    if (!inBounds(nextHead, newState.gridSize)) {
      snake.segments = [nextHead, ...snake.segments.slice(0, -1)];
      snake.freed = true;
      return { result: 'freed', state: newState };
    }

    if (simCellOccupied(nextHead, newState.snakes, snakeIdx)) {
      return { result: moved ? 'moved' : 'blocked', state: newState };
    }

    snake.segments = [nextHead, ...snake.segments.slice(0, -1)];
    moved = true;
  }

  return { result: moved ? 'moved' : 'blocked', state: newState };
}

function solvePuzzle(initialState: SimState, maxDepth: number = 40): boolean {
  interface QueueItem { state: SimState; depth: number; hash: string }

  function stateHash(s: SimState): string {
    const parts: string[] = [];
    for (const snake of s.snakes) {
      if (snake.freed) {
        parts.push('F');
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
  const maxIterations = 100000;

  while (queue.length > 0 && iterations < maxIterations) {
    iterations++;
    const item = queue.shift()!;

    if (item.state.snakes.every(s => s.freed)) return true;
    if (item.depth >= maxDepth) continue;

    for (let i = 0; i < item.state.snakes.length; i++) {
      const snake = item.state.snakes[i];
      if (snake.freed) continue;

      const { result, state: newState } = simMoveSnake(item.state, i);

      if (result === 'freed' || result === 'moved') {
        const h = stateHash(newState);
        if (!visited.has(h)) {
          visited.add(h);
          queue.push({ state: newState, depth: item.depth + 1, hash: h });
        }
      }
    }
  }

  return false;
}

// ============================================================
// Procedural Snake Placement
// ============================================================

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
 * Prefers directions with clear path to boundary.
 */
function chooseHeadDirection(
  segments: Vec3I[],
  gridSize: Vec3I,
): Direction {
  const head = segments[0];
  const validDirs = ALL_DIRECTIONS.filter(dir => isDirectionValid(segments, dir));
  if (validDirs.length === 0) return '+Y';

  let bestDir = validDirs[0];
  let bestScore = -Infinity;

  for (const dir of validDirs) {
    const d = DIR_VECTORS[dir];

    // Score by distance to boundary in this direction
    let score = 0;
    if (d.x > 0) score = gridSize.x - head.x;
    else if (d.x < 0) score = head.x + 1;
    else if (d.y > 0) score = gridSize.y - head.y;
    else if (d.y < 0) score = head.y + 1;
    else if (d.z > 0) score = gridSize.z - head.z;
    else if (d.z < 0) score = head.z + 1;

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
 * Generate a solvable level with retry logic.
 */
function generateSolvableLevel(
  id: number,
  name: string,
  options: GenerateLevelOptions,
  maxRetries: number = 10,
): LevelConfig | null {
  const {
    gridSize,
    fillRatio = 0.55,
    minSnakeLen = 2,
    maxSnakeLen = 4,
    snakeCount: overrideCount,
  } = options;

  const totalCells = gridSize.x * gridSize.y * gridSize.z;
  const targetFill = Math.floor(totalCells * fillRatio);

  for (let retry = 0; retry < maxRetries; retry++) {
    const occupied = new Set<string>();
    const allCells: Vec3I[] = [];
    for (let x = 0; x < gridSize.x; x++)
      for (let y = 0; y < gridSize.y; y++)
        for (let z = 0; z < gridSize.z; z++)
          allCells.push(v(x, y, z));

    for (let i = allCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allCells[i], allCells[j]] = [allCells[j], allCells[i]];
    }

    let filledCells = 0;
    const avgSnakeLen = (minSnakeLen + maxSnakeLen) / 2;
    const targetCount = overrideCount ?? Math.max(2, Math.floor(targetFill / avgSnakeLen));
    const snakes: { segments: Vec3I[]; direction: Direction; color: number }[] = [];

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
            const direction = chooseHeadDirection(segments, gridSize);
            snakes.push({ segments, direction, color: SNAKE_COLORS[snakes.length % SNAKE_COLORS.length] });
            filledCells += segments.length;
            startFound = true;
          }
          break;
        }
      }
      if (!startFound) break;
    }

    if (snakes.length < 2) continue;

    // Verify solvability
    const simSnakes: SimSnake[] = snakes.map((cfg, i) => ({
      id: i,
      segments: cfg.segments.map(s => ({ ...s })),
      direction: cfg.direction,
      freed: false,
    }));
    const simState: SimState = { gridSize: { ...gridSize }, snakes: simSnakes };

    if (solvePuzzle(simState)) {
      return { id, name, gridSize, snakes };
    }
  }

  return null;
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

// Level 1: Simple — 2 snakes in 3x3x3 (shows importance of order)
const LEVEL_1: LevelConfig = {
  id: 1,
  name: 'Два пути',
  gridSize: v(3, 3, 3),
  snakes: [
    snakeDef([[0, 1, 1], [0, 1, 0]], '+X', 0),
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
// Seeded random for deterministic procedural levels
// ============================================================

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// Procedural configs for levels beyond the 3 hand-crafted ones
const PROCEDURAL_CONFIGS: GenerateLevelOptions[] = [
  { gridSize: v(5, 5, 5), fillRatio: 0.55, minSnakeLen: 2, maxSnakeLen: 4 },
  { gridSize: v(6, 4, 5), fillRatio: 0.55, minSnakeLen: 2, maxSnakeLen: 4 },
  { gridSize: v(5, 5, 6), fillRatio: 0.55, minSnakeLen: 2, maxSnakeLen: 4 },
  { gridSize: v(6, 5, 5), fillRatio: 0.55, minSnakeLen: 3, maxSnakeLen: 5 },
  { gridSize: v(5, 6, 5), fillRatio: 0.55, minSnakeLen: 3, maxSnakeLen: 5 },
  { gridSize: v(6, 6, 6), fillRatio: 0.50, minSnakeLen: 2, maxSnakeLen: 4 },
  { gridSize: v(7, 5, 6), fillRatio: 0.50, minSnakeLen: 3, maxSnakeLen: 5 },
  { gridSize: v(6, 6, 7), fillRatio: 0.50, minSnakeLen: 2, maxSnakeLen: 4 },
  { gridSize: v(7, 6, 6), fillRatio: 0.50, minSnakeLen: 3, maxSnakeLen: 5 },
  { gridSize: v(7, 7, 7), fillRatio: 0.45, minSnakeLen: 2, maxSnakeLen: 4 },
];

// ============================================================
// Level registry
// ============================================================

const BASE_LEVELS: LevelConfig[] = [LEVEL_1, LEVEL_2, LEVEL_3];

/** Get a level by index (0-based). Generates procedural levels beyond the 3 hand-crafted ones. */
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

  const originalRandom = Math.random;
  const rng = seededRandom(seed);
  Math.random = rng;

  // Try multiple seeds near the base seed
  let level: LevelConfig | null = null;
  for (let offset = 0; offset < 20 && !level; offset++) {
    const tweakedSeed = seed + offset * 7919;
    const rng2 = seededRandom(tweakedSeed);
    Math.random = rng2;
    level = generateSolvableLevel(
      index + 1,
      `Уровень ${index + 1}`,
      config,
      8,
    );
  }

  Math.random = originalRandom;

  // Absolute fallback: generate without solvability check
  if (!level) {
    const rng3 = seededRandom(seed);
    Math.random = rng3;
    level = generateSolvableLevel(
      index + 1,
      `Уровень ${index + 1}`,
      { ...config, fillRatio: 0.35 },
      5,
    );
    Math.random = originalRandom;
  }

  return level;
}

/** Total number of hand-crafted levels */
export function getBaseLevelCount(): number {
  return BASE_LEVELS.length;
}
