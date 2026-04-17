// ============================================================
// Star Flow Command — Game Types & Constants
// ============================================================

export enum PlayerId {
  NONE = 0,
  PLAYER = 1,
  AI_1 = 2,
  AI_2 = 3,
  AI_3 = 4,
}

export enum GameState {
  MENU,
  PLAYING,
  PAUSED,
  VICTORY,
  DEFEAT,
}

export const PLAYER_COLORS: Record<number, string> = {
  [PlayerId.NONE]: '#666688',
  [PlayerId.PLAYER]: '#3399ff',
  [PlayerId.AI_1]: '#ff4433',
  [PlayerId.AI_2]: '#33dd66',
  [PlayerId.AI_3]: '#ffcc22',
};

export const PLAYER_NAMES: Record<number, string> = {
  [PlayerId.NONE]: 'Нейтральная',
  [PlayerId.PLAYER]: 'Игрок',
  [PlayerId.AI_1]: 'AI 1',
  [PlayerId.AI_2]: 'AI 2',
  [PlayerId.AI_3]: 'AI 3',
};

export interface Vec2 {
  x: number;
  y: number;
}

export interface Planet {
  id: number;
  pos: Vec2;
  radius: number;
  ownerId: PlayerId;
  level: number;
  maxLevel: number;
  productionRate: number;
  pendingShips: number;
  selected: boolean;
  hovered: boolean;
}

export interface ShipStream {
  id: number;
  sourceId: number;
  targetId: number;
  ownerId: PlayerId;
  shipCount: number;
  progress: number;      // 0..1
  speed: number;
  controlPoints: Vec2[]; // quadratic bezier: [start, control, end]
  alive: boolean;
}

export interface LevelConfig {
  planetCount: number;
  aiCount: number;
  mapSize: number;
  seed: number;
  startingLevel: number;
  aiLevel: number;
  neutralLevel: number;
}

export const DEFAULT_CONFIG: LevelConfig = {
  planetCount: 20,
  aiCount: 2,
  mapSize: 800,
  seed: 42,
  startingLevel: 3,
  aiLevel: 2,
  neutralLevel: 1,
};

// Physics / gameplay
export const BASE_SHIP_SPEED = 120; // pixels per second (progress speed adjusted by distance)
export const PLANET_CAPTURE_THRESHOLD = 5;
export const PRODUCTION_INTERVAL = 2.0; // seconds per ship per level
export const CLICK_DOUBLE_THRESHOLD = 350; // ms for double-click

// Camera
export const CAMERA_ZOOM_MIN = 0.3;
export const CAMERA_ZOOM_MAX = 2.5;
export const CAMERA_PAN_SPEED = 600;
export const CAMERA_ZOOM_SPEED = 0.003;
