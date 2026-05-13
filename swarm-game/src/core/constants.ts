// ============================================================
// Рой — Собиратель (Swarm: Collector) — Constants & Tuning
// ============================================================

import type { BoidType, LevelConfig } from './types.ts';

// --- Boid type colors, scores, and spawn weights ---
export const BOID_COLORS: Record<BoidType, { color: number; emissive: number; score: number; weight: number }> = {
  neutron:  { color: 0x55eeff, emissive: 0x33bbdd, score: 1, weight: 40 },
  ion:      { color: 0xbb66ff, emissive: 0x8833cc, score: 1, weight: 25 },
  photon:   { color: 0xffcc33, emissive: 0xcc9900, score: 2, weight: 15 },
  electron: { color: 0x55ff88, emissive: 0x33cc55, score: 1, weight: 10 },
  quark:    { color: 0xff66aa, emissive: 0xcc3377, score: 3, weight: 10 },
};

/** Weighted random boid type selection */
export function randomBoidType(): BoidType {
  const types: BoidType[] = ['neutron', 'ion', 'photon', 'electron', 'quark'];
  const totalWeight = types.reduce((s, t) => s + BOID_COLORS[t].weight, 0);
  let r = Math.random() * totalWeight;
  for (const t of types) {
    r -= BOID_COLORS[t].weight;
    if (r <= 0) return t;
  }
  return 'neutron';
}

// --- Collection / Portal ---
export const COLLECTION_RADIUS = 12;
export const PORTAL_RADIUS = 5;
export const PORTAL_BONUS_RADIUS = 2.5;
export const PORTAL_CAPTURE_DIST = 3;

// --- Free boid drift speeds ---
export const FREE_SPEED_MIN = 0.3;
export const FREE_SPEED_MAX = 1.0;

// --- Leader ---
export const LEADER_SPEED = 5.0;
export const LEADER_BOOST_MULT = 1.8;
export const LEADER_BOOST_DURATION = 2.0;
export const LEADER_BOOST_COOLDOWN = 5.0;
export const LEADER_MAX_TURN_RATE = 3.0;
export const LEADER_MAX_PITCH = 50; // degrees

// --- Mutable tuning (modified by debug panel at runtime) ---
export const tuning = {
  // Boid behavior
  separationRadius: 2.0,
  separationWeight: 4.0,
  perceptionRadius: 10.0,
  alignmentWeight: 1.7,
  cohesionWeight: 0.6,
  maxForce: 0.2,

  // Leader following
  leaderFollowRadius: 20.0,
  leaderWeight: 1.8,
  leaderTrailDist: 5.0,

  // Visual
  boidScale: 0.7,
};

// --- Static constants ---
export const BOID_MIN_SPEED = 3.5;
export const BOID_MAX_SPEED = 6.0;
export const BOID_MAX_ALLOC = 500;

// --- World ---
export const WORLD_HALF_SIZE = 80;

// --- Camera ---
export const CAM_DISTANCE = 10.0;
export const CAM_HEIGHT = 4.0;
export const CAM_LOOK_AHEAD = 6.0;
export const CAM_LERP = 4.0;
export const CAM_ZOOM_MIN = 4.0;
export const CAM_ZOOM_MAX = 40.0;
export const CAM_ZOOM_DEFAULT = 10.0;
export const CAM_ZOOM_SPEED = 20.0;

// --- Spatial hash ---
export const SPATIAL_CELL_SIZE = 8;

// --- Starfield ---
export const STAR_COUNT = 3000;
export const STAR_SHELL_MIN = 200;
export const STAR_SHELL_MAX = 400;

// --- Bloom ---
export const BLOOM_STRENGTH = 1.2;
export const BLOOM_RADIUS = 0.4;
export const BLOOM_THRESHOLD = 0.2;

// --- Level configurations (GDD §7.1) ---
export const LEVEL_CONFIGS: LevelConfig[] = [
  {
    name: 'Пробуждение',
    totalBoids: 30,
    startBoids: 5,
    obstacles: 0,
    hazards: 0,
    timeLimit: 90,
    worldSize: 80,
    portalPosition: [40, 0, 40],
  },
  {
    name: 'Рассеянные',
    totalBoids: 50,
    startBoids: 5,
    obstacles: 3,
    hazards: 0,
    timeLimit: 90,
    worldSize: 80,
    portalPosition: [35, 5, -40],
  },
  {
    name: 'Тень',
    totalBoids: 70,
    startBoids: 3,
    obstacles: 5,
    hazards: 1,
    timeLimit: 80,
    worldSize: 80,
    portalPosition: [-40, -5, -35],
  },
  {
    name: 'Разрозненные',
    totalBoids: 80,
    startBoids: 0,
    obstacles: 6,
    hazards: 1,
    timeLimit: 80,
    worldSize: 80,
    portalPosition: [-35, 0, 40],
  },
  {
    name: 'Перекрёсток',
    totalBoids: 100,
    startBoids: 0,
    obstacles: 8,
    hazards: 2,
    timeLimit: 75,
    worldSize: 80,
    portalPosition: [0, 10, 50],
  },
  {
    name: 'Шторм',
    totalBoids: 120,
    startBoids: 0,
    obstacles: 10,
    hazards: 2,
    timeLimit: 70,
    worldSize: 80,
    portalPosition: [45, -10, -30],
  },
  {
    name: 'Бездна',
    totalBoids: 150,
    startBoids: 0,
    obstacles: 12,
    hazards: 3,
    timeLimit: 70,
    worldSize: 80,
    portalPosition: [-45, 5, 30],
  },
  {
    name: 'Исход',
    totalBoids: 200,
    startBoids: 0,
    obstacles: 15,
    hazards: 3,
    timeLimit: 60,
    worldSize: 80,
    portalPosition: [0, 0, -50],
  },
];
