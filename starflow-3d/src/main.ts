// ============================================================
// Star Flow Command — Entry Point
// ============================================================

import { startGame, startGameFromSave, setOnGameSaved } from './game/game';
import { hasSave, loadGame, getSaveInfo } from './core/save';
import { i18n } from './i18n';
import { audioManager, MUSIC } from './audio';

/** Apply localized text to all DOM elements with data-i18n attribute */
function applyDOMTranslations(): void {
  // Static data-i18n elements
  const elements = document.querySelectorAll<HTMLElement>('[data-i18n]');
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = i18n.t(key);
  });

  // Special elements by ID
  const titleText = document.getElementById('title-text');
  if (titleText) titleText.textContent = i18n.t('app.title');

  const subtitleText = document.getElementById('subtitle-text');
  if (subtitleText) subtitleText.textContent = i18n.t('app.subtitle');

  const loadingText = document.getElementById('loading-text');
  if (loadingText) loadingText.textContent = i18n.t('ui.loading');

  const instructionsEl = document.getElementById('instructions');
  if (instructionsEl) {
    instructionsEl.textContent = [
      i18n.t('ui.instructions.select'),
      i18n.t('ui.instructions.createRoute'),
      i18n.t('ui.instructions.disconnect'),
      i18n.t('ui.instructions.rotate'),
      i18n.t('ui.instructions.pan'),
      i18n.t('ui.instructions.zoom'),
      i18n.t('ui.instructions.pinch'),
      i18n.t('ui.instructions.routes1'),
      i18n.t('ui.instructions.routes2'),
    ].join(' \u2022 ');
  }

  // Page title
  document.title = i18n.t('app.title');
}

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
  const continueBtn = document.getElementById('continue-btn') as HTMLButtonElement;
  const saveInfo = document.getElementById('save-info') as HTMLDivElement;
  const startScreen = document.getElementById('start-screen') as HTMLDivElement;
  const gameContainer = document.getElementById('game-container') as HTMLDivElement;

  // Continue button uses i18n — needs re-translation on language change
  function updateContinueButton(): void {
    const info = getSaveInfo();
    if (info) {
      continueBtn.classList.add('visible');
      saveInfo.classList.add('visible');
      saveInfo.textContent = i18n.t('save.info', {
        level: info.level, name: info.name, time: info.time,
      });
    } else {
      continueBtn.classList.remove('visible');
      saveInfo.classList.remove('visible');
    }
  }

  // Apply translations immediately
  applyDOMTranslations();
  updateContinueButton();

  // Preload audio assets (fire-and-forget — game starts regardless)
  audioManager.preloadAll();

  // Start menu theme music (will play silently until AudioContext is unlocked)
  audioManager.playMusic(MUSIC.MENU_THEME, { fadeIn: 1 });

  // Subscribe to language changes — retranslate everything
  i18n.onChange(() => {
    applyDOMTranslations();
    updateContinueButton();
  });

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

    // Unlock audio on first user gesture (required for Android WebView)
    audioManager.unlock();

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

      // Switch from menu theme to ambient game music
      audioManager.stopMusic(0.5);
      audioManager.playMusic(MUSIC.AMBIENT_SPACE, { fadeIn: 1.5 });

      console.log('Star Flow Command — 3D initialized');

      // Hide loading overlay
      const loading = document.getElementById('loading');
      if (loading) loading.classList.add('hidden');
    }, 800);
  }

  // Notify main when game is saved (update Continue button info)
  setOnGameSaved(() => {
    updateContinueButton();
  });

  // Handle Android app pause / resume (Capacitor)
  document.addEventListener('pause', () => audioManager.suspend());
  document.addEventListener('resume', () => audioManager.resume());

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
