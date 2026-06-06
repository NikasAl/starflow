// ============================================================
// SnakeFlow — Entry Point
// ============================================================

import { startGame } from './game/game';

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas #game-canvas not found!');
    return;
  }

  startGame(canvas);
  console.log('SnakeFlow 3D initialized');
});
