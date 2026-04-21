// ============================================================
// Star Flow Command — Entry Point
// ============================================================

import { startGame, startGameFromSave, setOnGameSaved } from './game/game';
import { hasSave, loadGame, getSaveInfo } from './core/save';

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
  const continueBtn = document.getElementById('continue-btn') as HTMLButtonElement;
  const saveInfo = document.getElementById('save-info') as HTMLDivElement;
  const startScreen = document.getElementById('start-screen') as HTMLDivElement;
  const gameContainer = document.getElementById('game-container') as HTMLDivElement;

  // Check for existing save and show Continue button
  updateContinueButton();

  function requestFullscreen(): void {
    const el = document.documentElement as any;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
    }
  }

  function launchGame(continueSave: boolean = false): void {
    if (!gameContainer || !startScreen) return;

    // Request fullscreen (works in WebView and browser)
    requestFullscreen();

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

      if (continueSave) {
        const save = loadGame();
        if (save) {
          startGameFromSave(canvas, save);
        } else {
          // No save — start new game
          startGame(canvas);
        }
      } else {
        startGame(canvas);
      }

      console.log('Star Flow Command — 3D initialized');

      // Hide loading overlay
      const loading = document.getElementById('loading');
      if (loading) loading.classList.add('hidden');
    }, 800);
  }

  function updateContinueButton(): void {
    const info = getSaveInfo();
    if (info) {
      continueBtn.classList.add('visible');
      saveInfo.classList.add('visible');
      saveInfo.textContent = `Level ${info.level}: ${info.name} — ${info.time}`;
    } else {
      continueBtn.classList.remove('visible');
      saveInfo.classList.remove('visible');
    }
  }

  // Notify main when game is saved (update Continue button info)
  setOnGameSaved(() => {
    updateContinueButton();
  });

  if (startBtn) {
    startBtn.addEventListener('click', () => launchGame(false));
    startBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      launchGame(false);
    });
  }

  if (continueBtn) {
    continueBtn.addEventListener('click', () => launchGame(true));
    continueBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      launchGame(true);
    });
  }
});
