// ============================================================
// SnakeFlow — Core Types
// 3D Puzzle game with snakes in a grid
// ============================================================

/** Integer 3D coordinate (grid cell) */
export interface Vec3I {
  x: number;
  y: number;
  z: number;
}

/** The 6 cardinal directions in 3D */
export type Direction = '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z';

/** Direction vector mapping */
export const DIR_VECTORS: Record<Direction, Vec3I> = {
  '+X': { x: 1, y: 0, z: 0 },
  '-X': { x: -1, y: 0, z: 0 },
  '+Y': { x: 0, y: 1, z: 0 },
  '-Y': { x: 0, y: -1, z: 0 },
  '+Z': { x: 0, y: 0, z: 1 },
  '-Z': { x: 0, y: 0, z: -1 },
};

/** All 6 directions as array */
export const ALL_DIRECTIONS: Direction[] = ['+X', '-X', '+Y', '-Y', '+Z', '-Z'];

/** Opposite direction */
export const OPPOSITE: Record<Direction, Direction> = {
  '+X': '-X', '-X': '+X',
  '+Y': '-Y', '-Y': '+Y',
  '+Z': '-Z', '-Z': '+Z',
};

/** Rotation to align a cone along a direction (THREE.Euler) */
export const DIR_ROTATION: Record<Direction, { x: number; y: number; z: number }> = {
  '+X': { x: 0, y: -Math.PI / 2, z: 0 },
  '-X': { x: 0, y: Math.PI / 2, z: 0 },
  '+Y': { x: 0, y: 0, z: 0 },
  '-Y': { x: Math.PI, y: 0, z: 0 },
  '+Z': { x: Math.PI / 2, y: 0, z: 0 },
  '-Z': { x: -Math.PI / 2, y: 0, z: 0 },
};

// ============================================================
// Snake Data
// ============================================================

/** A single snake in the puzzle */
export interface Snake {
  /** Unique id */
  id: string;
  /** Color (hex number) */
  color: number;
  /** Cell positions, head = segments[0] */
  segments: Vec3I[];
  /** Direction the head is facing */
  direction: Direction;
  /** Whether the snake is currently moving */
  isMoving: boolean;
  /** Whether the snake has been freed (exited the grid) */
  freed: boolean;
  /** Whether the snake hit an obstacle and stopped */
  stuck: boolean;
  /** Animation progress 0..1 for current move step */
  moveProgress: number;
  /** Previous segment positions (for lerping visuals) */
  prevSegments: Vec3I[];
  /** Time since stuck (for shake animation) */
  stuckTimer: number;
  /** Number of collisions this snake has caused */
  collisionCount: number;
  /** @internal flag: snake will be freed after current animation completes */
  _pendingFree?: boolean;
}

// ============================================================
// Puzzle State
// ============================================================

export type PuzzlePhase = 'idle' | 'moving' | 'complete' | 'stuck';

/** Full puzzle state — pure data, no Three.js */
export interface PuzzleState {
  /** Grid dimensions */
  gridSize: Vec3I;
  /** All snakes */
  snakes: Snake[];
  /** Current phase */
  phase: PuzzlePhase;
  /** Number of freed snakes */
  freedCount: number;
  /** Total snake count */
  totalSnakes: number;
  /** Total moves made in this puzzle */
  moveCount: number;
  /** Current level index */
  levelIndex: number;
  /** History stack for undo */
  history: HistoryEntry[];
}

/** History entry for undo */
export interface HistoryEntry {
  snakes: Snake[];
  freedCount: number;
  moveCount: number;
}

// ============================================================
// Game Events (returned by updateSnakes, processed by renderer)
// ============================================================

export interface GameEvents {
  /** Snakes that were freed this tick */
  freed: string[];
  /** Snakes that stopped (collision) this tick */
  stopped: string[];
  /** Snake that was clicked to start moving */
  startedMoving: string | null;
  /** Whether all snakes are freed */
  completed: boolean;
  /** Whether the puzzle is in a stuck state */
  stuck: boolean;
}

// ============================================================
// Level Configuration
// ============================================================

export interface LevelConfig {
  id: number;
  name: string;
  gridSize: Vec3I;
  snakes: {
    segments: Vec3I[];
    direction: Direction;
    color: number;
  }[];
}

// ============================================================
// Camera State
// ============================================================

export interface CameraState {
  targetX: number;
  targetY: number;
  targetZ: number;
  theta: number;
  phi: number;
  distance: number;
}
