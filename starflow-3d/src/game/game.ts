// ============================================================
// Star Flow Command — Main Game Class
// Orchestrates state, AI, rendering, and input
// ============================================================

import { type GameState, type PlanetData } from '../core/types';
import { createGameState, updateGame, handlePlayerAction } from '../game/state';
import { type AIState, createAIs } from '../core/ai';
import {
  initRenderer,
  addPlanet,
  removePlanet,
  addFleet,
  removeFleet,
  addStream,
  removeStream,
  updateSelection,
  syncVisuals,
  setPlanetClickCallback,
  dispose,
} from '../rendering/renderer';

/** Track which fleets/streams have been added to the scene */
const knownFleets = new Set<string>();
const knownStreams = new Set<string>();
const knownPlanets = new Set<string>();

let gameState: GameState;
let aiStates: AIState[];
let running = false;
let lastTime = 0;

/** Initialize and start the game */
export function startGame(canvas: HTMLCanvasElement): void {
  // Init state
  gameState = createGameState(2); // 2 AI opponents
  aiStates = createAIs(2);

  // Init 3D renderer
  initRenderer(canvas);

  // Add all initial planets to the scene
  for (const planet of gameState.planets) {
    addPlanet(planet);
    knownPlanets.add(planet.id);
  }

  // Set click handler
  setPlanetClickCallback((planetId: string) => {
    if (planetId === '__deselect__') {
      gameState.selectedPlanetId = null;
      updateSelection(null);
      return;
    }
    handlePlayerAction(gameState, planetId);
    updateSelection(gameState.selectedPlanetId);
  });

  // Start loop
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function gameLoop(now: number): void {
  if (!running) return;

  const dt = Math.min((now - lastTime) / 1000, 0.1); // cap delta time
  lastTime = now;

  // Update game logic
  const prevFleetCount = gameState.fleets.length;
  const prevStreamCount = gameState.streams.length;

  updateGame(gameState, aiStates, dt);

  // Sync new fleets to renderer
  for (const fleet of gameState.fleets) {
    if (!knownFleets.has(fleet.id)) {
      addFleet(fleet);
      knownFleets.add(fleet.id);
    }
  }

  // Sync new streams to renderer
  for (const stream of gameState.streams) {
    if (!knownStreams.has(stream.id)) {
      addStream(stream);
      knownStreams.add(stream.id);
    }
  }

  // Clean up arrived fleets
  for (const fleetId of knownFleets) {
    if (!gameState.fleets.find(f => f.id === fleetId)) {
      removeFleet(fleetId);
      knownFleets.delete(fleetId);
    }
  }

  // Clean up finished streams
  for (const streamId of knownStreams) {
    if (!gameState.streams.find(s => s.id === streamId)) {
      removeStream(streamId);
      knownStreams.delete(streamId);
    }
  }

  // Render
  syncVisuals(gameState, now / 1000);

  requestAnimationFrame(gameLoop);
}

/** Stop the game */
export function stopGame(): void {
  running = false;
  dispose();
}
