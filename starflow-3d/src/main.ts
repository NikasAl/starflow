// ============================================================
// Star Flow Command — Entry Point
// ============================================================

import { startGame } from './game/game';

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas #game-canvas not found!');
    return;
  }

  // Start the game
  startGame(canvas);
  console.log('Star Flow Command — 3D initialized');
});
