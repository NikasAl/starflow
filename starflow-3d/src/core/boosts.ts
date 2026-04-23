// ============================================================
// Star Flow Command — Boost System
// Temporary power-ups activated by spending energy currency
// ============================================================

import {
  type GameState, type BoostType,
  PLAYER, NEUTRAL,
} from './types';
import {
  ENERGY_AD_REWARD,
  BOOST_SPEED_COST, BOOST_SPEED_DURATION, BOOST_SPEED_MULTIPLIER,
  BOOST_FREEZE_COST, BOOST_FREEZE_DURATION,
  BOOST_SHIELD_COST, BOOST_SHIELD_DURATION,
} from './constants';

/** Check if a planet has an active boost of the given type */
export function hasBoost(state: GameState, planetId: string, type: BoostType): boolean {
  return state.activeBoosts.some(b => b.planetId === planetId && b.type === type);
}

/** Get the remaining time for a boost, or 0 if not active */
export function getBoostRemaining(state: GameState, planetId: string, type: BoostType): number {
  const boost = state.activeBoosts.find(b => b.planetId === planetId && b.type === type);
  return boost ? boost.remaining : 0;
}

/** Get the energy cost of a boost type */
export function getBoostCost(type: BoostType): number {
  switch (type) {
    case 'speed': return BOOST_SPEED_COST;
    case 'freeze': return BOOST_FREEZE_COST;
    case 'shield': return BOOST_SHIELD_COST;
  }
}

/** Get the duration of a boost type in seconds */
export function getBoostDuration(type: BoostType): number {
  switch (type) {
    case 'speed': return BOOST_SPEED_DURATION;
    case 'freeze': return BOOST_FREEZE_DURATION;
    case 'shield': return BOOST_SHIELD_DURATION;
  }
}

/**
 * Activate a boost on a planet. Returns error key if activation fails, null on success.
 * Error keys: 'alreadyActive', 'notEnough', 'wrongOwner', 'notFound'
 */
export function activateBoost(state: GameState, type: BoostType, planetId: string): string | null {
  if (hasBoost(state, planetId, type)) {
    return 'alreadyActive';
  }

  const cost = getBoostCost(type);
  if (state.energy < cost) {
    return 'notEnough';
  }

  const planet = state.planets.find(p => p.id === planetId);
  if (!planet) return 'notFound';

  // Speed and shield are for player planets only
  if (type === 'speed' || type === 'shield') {
    if (planet.owner !== PLAYER) return 'wrongOwner';
  }
  // Freeze is for enemy planets only (not neutral)
  if (type === 'freeze') {
    if (planet.owner === PLAYER || planet.owner === NEUTRAL) return 'wrongOwner';
  }

  state.energy -= cost;
  state.activeBoosts.push({
    type,
    planetId,
    remaining: getBoostDuration(type),
  });

  return null;
}

/** Grant energy to the player (from ad reward or other source) */
export function grantEnergy(state: GameState, amount: number = ENERGY_AD_REWARD): void {
  state.energy += amount;
}

/** Update all boost timers and remove expired ones. Call every frame. */
export function updateBoosts(state: GameState, dt: number): void {
  for (const boost of state.activeBoosts) {
    boost.remaining -= dt;
  }
  state.activeBoosts = state.activeBoosts.filter(b => b.remaining > 0);
}
