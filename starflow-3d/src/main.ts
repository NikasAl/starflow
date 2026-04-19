// ============================================================
// Star Flow Command — Entry Point
// ============================================================

import { startGame } from './game/game';

let gameStarted = false;

function initGame(): void {
  if (gameStarted) return;
  gameStarted = true;

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas #game-canvas not found!');
    return;
  }

  startGame(canvas);
  console.log('Star Flow Command — 3D initialized');
}

document.addEventListener('DOMContentLoaded', () => {
  // Listen for start screen button click
  window.addEventListener('game-start', initGame);
});
