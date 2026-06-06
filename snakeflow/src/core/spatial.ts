// ============================================================
// SnakeFlow — Spatial Utilities
// Grid cell math, occupation map, bounds checking
// ============================================================

import { type Vec3I, type Direction, DIR_VECTORS, type Snake } from './types';

/** Check if a cell is within the grid bounds */
export function inBounds(cell: Vec3I, gridSize: Vec3I): boolean {
  return cell.x >= 0 && cell.x < gridSize.x &&
         cell.y >= 0 && cell.y < gridSize.y &&
         cell.z >= 0 && cell.z < gridSize.z;
}

/** Convert grid cell to world position (centered at origin) */
export function cellToWorld(cell: Vec3I, gridSize: Vec3I): { x: number; y: number; z: number } {
  return {
    x: cell.x - (gridSize.x - 1) / 2,
    y: cell.y - (gridSize.y - 1) / 2,
    z: cell.z - (gridSize.z - 1) / 2,
  };
}

/** Convert world position back to nearest grid cell */
export function worldToCell(worldX: number, worldY: number, worldZ: number, gridSize: Vec3I): Vec3I {
  return {
    x: Math.round(worldX + (gridSize.x - 1) / 2),
    y: Math.round(worldY + (gridSize.y - 1) / 2),
    z: Math.round(worldZ + (gridSize.z - 1) / 2),
  };
}

/** Get the next cell in a given direction from a starting cell */
export function nextCell(cell: Vec3I, dir: Direction): Vec3I {
  const d = DIR_VECTORS[dir];
  return { x: cell.x + d.x, y: cell.y + d.y, z: cell.z + d.z };
}

/** Cell key for Map/Set usage */
export function cellKey(c: Vec3I): string {
  return `${c.x},${c.y},${c.z}`;
}

/** Parse cell key back to Vec3I */
export function parseCellKey(key: string): Vec3I {
  const [x, y, z] = key.split(',').map(Number);
  return { x, y, z };
}

/**
 * Build an occupation map: cellKey → snakeId
 * Maps every cell that has a snake segment on it.
 * Excludes freed snakes and optionally a specific snake.
 */
export function buildOccupationMap(
  snakes: Snake[],
  excludeId?: string,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const snake of snakes) {
    if (snake.freed) continue;
    if (snake.id === excludeId) continue;
    for (const seg of snake.segments) {
      map.set(cellKey(seg), snake.id);
    }
  }
  return map;
}

/** Check if a cell is occupied by any non-freed snake (optionally excluding one) */
export function isCellOccupied(
  cell: Vec3I,
  snakes: Snake[],
  excludeId?: string,
): boolean {
  for (const snake of snakes) {
    if (snake.freed) continue;
    if (snake.id === excludeId) continue;
    for (const seg of snake.segments) {
      if (seg.x === cell.x && seg.y === cell.y && seg.z === cell.z) {
        return true;
      }
    }
  }
  return false;
}

/** Deep-clone a snake array (for history/undo) */
export function cloneSnakes(snakes: Snake[]): Snake[] {
  return snakes.map(s => ({
    ...s,
    segments: s.segments.map(seg => ({ ...seg })),
    prevSegments: s.prevSegments.map(seg => ({ ...seg })),
  }));
}

/** Deep-clone a Vec3I */
export function cloneVec3(v: Vec3I): Vec3I {
  return { x: v.x, y: v.y, z: v.z };
}

/** Two Vec3I equality */
export function vec3Eq(a: Vec3I, b: Vec3I): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

/** Lerp between two world positions */
export function lerpVec3(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  t: number,
): { x: number; y: number; z: number } {
  return {
    x: ax + (bx - ax) * t,
    y: ay + (by - ay) * t,
    z: az + (bz - az) * t,
  };
}
