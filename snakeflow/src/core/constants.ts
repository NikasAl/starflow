// ============================================================
// SnakeFlow — Constants & Tuning
// ============================================================

// === Colors ===

/** Bright, toy-like snake colors */
export const SNAKE_COLORS: number[] = [
  0xff4466, // Red
  0x44dd66, // Green
  0x4488ff, // Blue
  0xffbb22, // Yellow
  0xcc44ff, // Purple
  0xff8833, // Orange
  0x22dddd, // Cyan
  0xff66aa, // Pink
  0x88ff44, // Lime
  0xff6655, // Coral
];

/** Darker shade for body segments */
export function darkenColor(hex: number, factor: number = 0.7): number {
  const r = ((hex >> 16) & 0xff) * factor;
  const g = ((hex >> 8) & 0xff) * factor;
  const b = (hex & 0xff) * factor;
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

// === Grid ===

export const CELL_SIZE = 1.0;
export const CELL_GAP = 0.08;       // visual gap between cells
export const CELL_FILL_RATIO = 0.72; // how much of cell is filled by snake

// === Rendering ===

export const BACKGROUND_COLOR = 0x1a1a2e;
export const GRID_COLOR = 0x334466;
export const GRID_OPACITY = 0.25;
export const GRID_PLANE_COLOR = 0x223344;
export const GRID_PLANE_OPACITY = 0.08;

// === Lighting ===

export const AMBIENT_LIGHT_INTENSITY = 0.6;
export const DIRECTIONAL_LIGHT_INTENSITY = 1.0;
export const FILL_LIGHT_INTENSITY = 0.3;

// === Camera ===

export const CAM_DEFAULT_DISTANCE = 12;
export const CAM_DEFAULT_THETA = 0.6;
export const CAM_DEFAULT_PHI = 0.7;
export const CAM_MIN_DISTANCE = 4;
export const CAM_MAX_DISTANCE = 30;
export const CAM_ZOOM_SPEED = 2.0;
export const CAM_LERP_SPEED = 5.0;

// === Movement ===

/** Cells per second a snake moves */
export const SNAKE_MOVE_SPEED = 3.0;

// === Snake visual ===

export const HEAD_RADIUS = 0.32;
export const BODY_RADIUS = 0.24;
export const TAIL_RADIUS = 0.18;
export const ARROW_LENGTH = 0.28;
export const ARROW_RADIUS = 0.16;
export const EYE_RADIUS = 0.06;
export const EYE_OFFSET = 0.12;

// === Particles ===

export const PARTICLE_COUNT = 24;
export const PARTICLE_LIFE = 0.9;
export const PARTICLE_SIZE = 0.25;

// === Shake ===

export const SHAKE_DURATION = 0.6;
export const SHAKE_INTENSITY = 0.06;

// === Hover ===

export const HOVER_SCALE = 1.12;
