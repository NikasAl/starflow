// ============================================================
// Star Flow Command — Entry Point
// ============================================================

import { startGame } from './game/game';

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-btn');
  const startScreen = document.getElementById('start-screen');
  const gameContainer = document.getElementById('game-container');

  function launchGame(): void {
    if (!gameContainer || !startScreen) return;

    // Remove start screen
    startScreen.classList.add('fade-out');
    setTimeout(() => {
      startScreen.style.display = 'none';
      gameContainer.classList.add('active');

      // Now init Three.js on the visible canvas
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      if (!canvas) {
        console.error('Canvas #game-canvas not found!');
        return;
      }
      startGame(canvas);
      console.log('Star Flow Command — 3D initialized');

      // Hide loading overlay
      const loading = document.getElementById('loading');
      if (loading) loading.classList.add('hidden');
    }, 800);
  }

  if (startBtn) {
    startBtn.addEventListener('click', launchGame);
    // Touch support — prevent ghost clicks, ensure response
    startBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      launchGame();
    });
  }
});
