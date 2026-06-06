// ============================================================
// SnakeFlow — Level Configurations
// Hand-crafted levels for the prototype
// ============================================================

import { type Vec3I, type Direction, type LevelConfig } from './types';
import { SNAKE_COLORS } from './constants';

// ============================================================
// Helper: shorthand for Vec3I and snake definition
// ============================================================

function v(x: number, y: number, z: number): Vec3I {
  return { x, y, z };
}

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

// ============================================================
// Level 1: "First Steps" (3x3x3, 1 snake)
// One snake, head pointing outward, simple slide out
// ============================================================

const LEVEL_1: LevelConfig = {
  id: 1,
  name: 'Первые шаги',
  gridSize: v(3, 3, 3),
  snakes: [
    snakeDef([[1, 1, 1]], '+Y', 0),
  ],
};

// ============================================================
// Level 2: "Twin Paths" (3x3x3, 2 snakes)
// Two snakes going in different directions, no interference
// ============================================================

const LEVEL_2: LevelConfig = {
  id: 2,
  name: 'Два пути',
  gridSize: v(3, 3, 3),
  snakes: [
    snakeDef([[0, 1, 1]], '-X', 0),   // pointing left, exits immediately
    snakeDef([[2, 1, 1]], '+X', 1),   // pointing right, exits immediately
  ],
};

// ============================================================
// Level 3: "Bend" (3x3x3, 1 snake, 3 segments)
// An L-shaped snake pointing outward
// ============================================================

const LEVEL_3: LevelConfig = {
  id: 3,
  name: 'Изгиб',
  gridSize: v(3, 3, 3),
  snakes: [
    snakeDef([[1, 1, 0], [1, 1, 1], [1, 2, 1]], '-Z', 2),
  ],
};

// ============================================================
// Level 4: "Obstacle" (4x4x4, 2 snakes)
// One snake blocks the path of another; must click blocker first
// ============================================================

const LEVEL_4: LevelConfig = {
  id: 4,
  name: 'Препятствие',
  gridSize: v(4, 4, 4),
  snakes: [
    snakeDef([[1, 1, 2], [1, 1, 1], [1, 2, 1]], '-Z', 0),  // needs to go left
    snakeDef([[0, 1, 1]], '-X', 1),                            // blocking (exits left)
  ],
};

// ============================================================
// Level 5: "Three's Company" (4x4x4, 3 snakes)
// Three snakes, need to find the right order
// ============================================================

const LEVEL_5: LevelConfig = {
  id: 5,
  name: 'Тройная компания',
  gridSize: v(4, 4, 4),
  snakes: [
    snakeDef([[1, 1, 3], [1, 2, 3], [1, 2, 2]], '-Z', 0),
    snakeDef([[0, 1, 2]], '-X', 1),
    snakeDef([[3, 1, 2]], '+X', 2),
  ],
};

// ============================================================
// Level 6: "Vertical World" (3x5x3, 3 snakes, vertical emphasis)
// Taller grid with snakes going up/down
// ============================================================

const LEVEL_6: LevelConfig = {
  id: 6,
  name: 'Вертикальный мир',
  gridSize: v(3, 5, 3),
  snakes: [
    snakeDef([[1, 0, 1]], '-Y', 3),   // exits down
    snakeDef([[1, 3, 1], [1, 4, 1]], '-Y', 4),  // L-shaped, exits down
    snakeDef([[1, 2, 1], [1, 2, 0]], '+Z', 5),  // blocking middle, exits forward
  ],
};

// ============================================================
// Level 7: "Tight Squeeze" (3x3x3, 4 snakes)
// Very crowded small grid, careful ordering needed
// ============================================================

const LEVEL_7: LevelConfig = {
  id: 7,
  name: 'Теснота',
  gridSize: v(3, 3, 3),
  snakes: [
    snakeDef([[0, 0, 0]], '-X', 0),
    snakeDef([[2, 0, 0]], '+X', 1),
    snakeDef([[0, 2, 0]], '-Z', 2),
    snakeDef([[2, 2, 2]], '+X', 3),
  ],
};

// ============================================================
// Level 8: "Serpentine" (5x3x5, 4 snakes, long snakes)
// Longer snakes in a wider grid
// ============================================================

const LEVEL_8: LevelConfig = {
  id: 8,
  name: 'Змеиная тропа',
  gridSize: v(5, 3, 5),
  snakes: [
    snakeDef([[1, 1, 1], [2, 1, 1], [3, 1, 1]], '-X', 0),
    snakeDef([[3, 1, 3], [3, 1, 2]], '+Z', 1),
    snakeDef([[1, 1, 3]], '-X', 2),
    snakeDef([[0, 1, 0], [0, 0, 0]], '-X', 3),
  ],
};

// ============================================================
// Level 9: "Layer Cake" (4x4x4, 5 snakes)
// Snakes on multiple Y layers
// ============================================================

const LEVEL_9: LevelConfig = {
  id: 9,
  name: 'Слоёный пирог',
  gridSize: v(4, 4, 4),
  snakes: [
    snakeDef([[0, 0, 1]], '-X', 0),
    snakeDef([[3, 0, 2]], '+X', 1),
    snakeDef([[1, 2, 0], [2, 2, 0]], '+Z', 2),
    snakeDef([[3, 2, 3]], '+X', 3),
    snakeDef([[0, 3, 3], [0, 3, 2], [0, 2, 2]], '-X', 4),
  ],
};

// ============================================================
// Level 10: "The Maze" (5x5x5, 6 snakes)
// Complex puzzle with many snakes
// ============================================================

const LEVEL_10: LevelConfig = {
  id: 10,
  name: 'Лабиринт',
  gridSize: v(5, 5, 5),
  snakes: [
    snakeDef([[1, 1, 1], [2, 1, 1], [2, 2, 1]], '-X', 0),
    snakeDef([[4, 1, 1]], '+X', 1),
    snakeDef([[0, 2, 2], [0, 3, 2]], '-X', 2),
    snakeDef([[2, 3, 4], [2, 3, 3]], '-Z', 3),
    snakeDef([[4, 3, 3]], '+X', 4),
    snakeDef([[1, 4, 4], [1, 4, 3]], '+X', 5),
  ],
};

// ============================================================
// All levels array
// ============================================================

export const LEVELS: LevelConfig[] = [
  LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5,
  LEVEL_6, LEVEL_7, LEVEL_8, LEVEL_9, LEVEL_10,
];

/** Get a level by index (0-based) */
export function getLevel(index: number): LevelConfig | null {
  if (index < 0 || index >= LEVELS.length) return null;
  return LEVELS[index];
}
