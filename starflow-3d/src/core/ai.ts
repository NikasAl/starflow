// ============================================================
// Star Flow Command — AI Controller
// ============================================================

import {
  type PlanetData, type OwnerId,
  PLAYER, AI_1, AI_2,
} from './types';
import { AI_THINK_INTERVAL, AI_MIN_ATTACK_SHIPS } from './constants';

/** AI state per faction */
export interface AIState {
  owner: OwnerId;
  thinkTimer: number;
  /** Which strategy mode */
  mode: 'expand' | 'attack' | 'defend';
}

/** Create AI states for the game */
export function createAIs(count: number): AIState[] {
  const states: AIState[] = [];
  for (let i = 0; i < count; i++) {
    states.push({
      owner: (i + 2) as OwnerId,  // AI_1 = 2, AI_2 = 3
      thinkTimer: AI_THINK_INTERVAL * Math.random(), // stagger
      mode: 'expand',
    });
  }
  return states;
}

/** Update AI thinking. Returns fleet launch commands: [sourceId, targetId] */
export function updateAI(
  ai: AIState,
  planets: PlanetData[],
  dt: number,
): Array<{ sourceId: string; targetId: string }> {
  const commands: Array<{ sourceId: string; targetId: string }> = [];

  ai.thinkTimer -= dt;
  if (ai.thinkTimer > 0) return commands;
  ai.thinkTimer = AI_THINK_INTERVAL + Math.random() * 2;

  // Gather my planets and enemy/neutral planets
  const myPlanets = planets.filter(p => p.owner === ai.owner);
  const targetPlanets = planets.filter(p => p.owner !== ai.owner);

  if (myPlanets.length === 0 || targetPlanets.length === 0) return commands;

  // Find the strongest planet with enough ships
  const sorted = [...myPlanets].sort((a, b) => b.ships - a.ships);
  const source = sorted.find(p => p.ships >= AI_MIN_ATTACK_SHIPS);
  if (!source) return commands;

  // Strategy decision
  const totalMyShips = myPlanets.reduce((s, p) => s + p.ships, 0);
  const totalEnemyShips = targetPlanets.reduce((s, p) => s + p.ships, 0);

  if (totalMyShips > totalEnemyShips * 1.5) {
    ai.mode = 'attack';
  } else if (myPlanets.length <= 2) {
    ai.mode = 'expand';
  } else {
    ai.mode = Math.random() > 0.5 ? 'attack' : 'defend';
  }

  // Find target based on strategy
  let target: PlanetData | undefined;

  if (ai.mode === 'expand') {
    // Target nearest neutral with fewest ships
    const neutrals = targetPlanets
      .filter(p => p.owner === 0)
      .sort((a, b) => {
        const dA = dist(a, source);
        const dB = dist(b, source);
        return (dA + a.ships * 2) - (dB + b.ships * 2);
      });
    target = neutrals[0];
  } else if (ai.mode === 'attack') {
    // Target weakest enemy planet
    const enemies = targetPlanets
      .filter(p => p.owner !== 0)
      .sort((a, b) => (a.ships + dist(a, source) * 0.5) - (b.ships + dist(b, source) * 0.5));
    target = enemies[0];
  } else {
    // Defend: reinforce weakest own planet
    const weakest = myPlanets.sort((a, b) => a.ships - b.ships);
    target = weakest[0];
    // Don't reinforce self
    if (target.id === source.id) {
      target = undefined;
    }
  }

  if (!target) {
    // Fallback: random target
    target = targetPlanets[Math.floor(Math.random() * targetPlanets.length)];
  }

  if (target) {
    commands.push({ sourceId: source.id, targetId: target.id });
  }

  return commands;
}

function dist(a: PlanetData, b: PlanetData): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}
