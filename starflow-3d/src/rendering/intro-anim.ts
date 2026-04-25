// ============================================================
// Star Flow Command — Intro Animation System
// Camera fly-to, text overlays, level title reveal
// ============================================================

import type { PlanetData, GameState } from '../core/types';
import { PLAYER } from '../core/types';
import { i18n } from '../i18n';

// Current animation state
let introActive = false;
let introCancelled = false;
let introElement: HTMLDivElement | null = null;

// Callbacks — set by game.ts
let getGameState: (() => GameState) | null = null;
let setCameraSmoothTarget: ((target: {
  targetX: number; targetZ: number;
  distance: number; theta: number; phi: number;
}) => void) | null = null;
let disableSmoothCamera: (() => void) | null = null;
let setGamePaused: ((paused: boolean) => void) | null = null;

// ---- Public API ----

export function initIntroAnim(deps: {
  getGameState: () => GameState;
  setCameraSmoothTarget: (target: {
    targetX: number; targetZ: number;
    distance: number; theta: number; phi: number;
  }) => void;
  disableSmoothCamera: () => void;
  setGamePaused: (paused: boolean) => void;
}): void {
  getGameState = deps.getGameState;
  setCameraSmoothTarget = deps.setCameraSmoothTarget;
  disableSmoothCamera = deps.disableSmoothCamera;
  setGamePaused = deps.setGamePaused;
}

/** Play the full intro sequence. Returns promise that resolves when done. */
export async function playIntro(): Promise<void> {
  if (!getGameState || !setCameraSmoothTarget || !setGamePaused) return;

  introActive = true;
  introCancelled = false;
  setGamePaused(true);

  const state = getGameState();

  // Find key planets
  const playerPlanet = state.planets.find(p => p.owner === PLAYER);
  const enemyPlanet = state.planets.find(p => p.owner !== 0 && p.owner !== PLAYER);
  const neutralPlanets = state.planets.filter(p => p.owner === 0);
  const neutralPlanet = neutralPlanets.length > 0 ? neutralPlanets[0] : null;

  try {
    // Step 1: Fly to player planet + show text simultaneously
    if (playerPlanet) {
      flyToPlanet(playerPlanet);
      await wait(600); // let camera start moving
      await showIntroText(i18n.t('intro.ourPlanet'), 0x4488ff);
      await wait(1800); // text visible while camera settles
      await hideIntroText(500);
    }

    if (introCancelled) return cleanup();

    // Step 2: Fly to enemy planet + show text
    if (enemyPlanet) {
      await wait(400);
      const enemyOwnerName = getOwnerDisplayName(enemyPlanet.owner);
      flyToPlanet(enemyPlanet);
      await wait(600);
      await showIntroText(i18n.t('intro.enemyPlanet', { enemy: enemyOwnerName }), 0xff4444);
      await wait(1800);
      await hideIntroText(500);
    }

    if (introCancelled) return cleanup();

    // Step 3: Fly to neutral planet + show text
    if (neutralPlanet) {
      await wait(400);
      flyToPlanet(neutralPlanet);
      await wait(600);
      await showIntroText(i18n.t('intro.neutralPlanets'), 0x888888);
      await wait(1800);
      await hideIntroText(500);
    }

    if (introCancelled) return cleanup();

    // Step 4: Controls guide — items appear one by one with staggered animation
    await wait(400);
    flyToDefault();
    await wait(800); // let camera pull back a bit before guide
    await showControlsGuide();
    await wait(800); // let items finish appearing (6 items × 250ms)
    await wait(2500); // give time to read
    await hideIntroText(600);

    if (introCancelled) return cleanup();

    // Step 5: Panoramic view + level title
    await wait(400);
    await showLevelTitle(state);
    await wait(2500);
    await hideLevelTitle(800);

  } catch {
    // Animation cancelled or error — just clean up
  }

  cleanup();
}

/** Play only the level title animation (for level transitions) */
export async function playLevelTitle(): Promise<void> {
  if (!getGameState || !setCameraSmoothTarget) return;

  const state = getGameState();
  flyToDefault();
  await wait(600);
  await showLevelTitle(state);
  await wait(2500);
  await hideLevelTitle(800);

  // IMPORTANT: disable smooth camera so user regains control
  if (disableSmoothCamera) disableSmoothCamera();
}

/** Cancel any running intro animation */
export function cancelIntro(): void {
  introCancelled = true;
  introActive = false;
  cleanup();
}

/** Check if intro is currently playing */
export function isIntroActive(): boolean {
  return introActive;
}

// ---- Camera Animation (fire-and-forget: starts move, doesn't wait) ----

function flyToPlanet(planet: PlanetData): void {
  if (!setCameraSmoothTarget) return;
  const angle = Math.random() * Math.PI * 2;
  const dist = planet.radius * 6;
  setCameraSmoothTarget({
    targetX: planet.x,
    targetZ: planet.z,
    distance: dist,
    theta: angle,
    phi: 0.8,
  });
}

function flyToDefault(): void {
  if (!setCameraSmoothTarget || !getGameState) return;
  const state = getGameState();
  let cx = 0, cz = 0;
  for (const p of state.planets) { cx += p.x; cz += p.z; }
  cx /= state.planets.length;
  cz /= state.planets.length;

  setCameraSmoothTarget({
    targetX: cx,
    targetZ: cz,
    distance: 55,
    theta: 0.5,
    phi: 1.1,
  });
}

// ---- Text Overlays ----

function getOwnerDisplayName(ownerId: number): string {
  switch (ownerId) {
    case 2: return i18n.t('owner.crimsonFleet');
    case 3: return i18n.t('owner.emeraldHorde');
    case 4: return i18n.t('owner.goldenArmada');
    default: return i18n.t('hud.neutral');
  }
}

function showIntroText(text: string, color: number): Promise<void> {
  return new Promise(resolve => {
    const colorHex = '#' + color.toString(16).padStart(6, '0');
    introElement = document.createElement('div');
    introElement.className = 'intro-text-overlay';
    introElement.style.cssText = `
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%) translateY(12px);
      z-index: 200;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: clamp(18px, 3.5vw, 30px);
      font-weight: 600;
      color: ${colorHex};
      text-align: center;
      text-shadow: 0 0 20px ${colorHex}88, 0 0 40px ${colorHex}44, 0 2px 8px rgba(0,0,0,0.8);
      letter-spacing: 2px;
      opacity: 0;
      transition: opacity 0.5s ease-out, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
      white-space: nowrap;
    `;
    introElement.textContent = text;
    document.body.appendChild(introElement);

    // Trigger fade in + slide up
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (introElement) {
          introElement.style.opacity = '1';
          introElement.style.transform = 'translate(-50%, -50%) translateY(0)';
        }
      });
    });

    setTimeout(resolve, 500);
  });
}

function showControlsGuide(): Promise<void> {
  return new Promise(resolve => {
    const lines = [
      i18n.t('ui.instructions.select'),
      i18n.t('ui.instructions.createRoute'),
      i18n.t('ui.instructions.disconnect'),
      i18n.t('ui.instructions.rotate'),
      i18n.t('ui.instructions.zoom'),
      i18n.t('ui.instructions.routes1'),
      i18n.t('ui.instructions.routes2'),
    ];

    introElement = document.createElement('div');
    introElement.className = 'intro-text-overlay';
    introElement.style.cssText = `
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      z-index: 200;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: clamp(13px, 2vw, 17px);
      color: rgba(255,255,255,0.9);
      text-align: center;
      text-shadow: 0 2px 8px rgba(0,0,0,0.8);
      line-height: 2.2;
      pointer-events: none;
      max-width: 80vw;
    `;
    document.body.appendChild(introElement);

    // Create items one by one with staggered animation
    for (let i = 0; i < lines.length; i++) {
      const item = document.createElement('div');
      item.textContent = lines[i];
      item.style.cssText = `
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 0.4s ease-out, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      `;
      introElement.appendChild(item);

      // Stagger each item by 250ms
      setTimeout(() => {
        item.style.opacity = '1';
        item.style.transform = 'translateY(0)';
      }, i * 250);
    }

    // Resolve after all items have started animating
    setTimeout(resolve, lines.length * 250 + 100);
  });
}

function showLevelTitle(state: GameState): Promise<void> {
  return new Promise(resolve => {
    const levelName = i18n.t(state.levelConfig.nameKey, state.levelConfig.nameParams);
    const fullText = i18n.t('hud.level', { level: state.level, name: levelName });

    introElement = document.createElement('div');
    introElement.className = 'intro-text-overlay';
    introElement.style.cssText = `
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%) scale(0.7);
      z-index: 200;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: clamp(24px, 4.5vw, 48px);
      font-weight: 700;
      color: #fff;
      text-align: center;
      text-shadow: 0 0 30px rgba(68,136,255,0.7), 0 0 60px rgba(68,136,255,0.4), 0 3px 10px rgba(0,0,0,0.9);
      letter-spacing: 4px;
      opacity: 0;
      transition: opacity 0.6s ease-out, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
      white-space: nowrap;
    `;
    introElement.textContent = fullText;
    document.body.appendChild(introElement);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (introElement) {
          introElement.style.opacity = '1';
          introElement.style.transform = 'translate(-50%, -50%) scale(1)';
        }
      });
    });

    setTimeout(resolve, 600);
  });
}

function hideIntroText(duration: number): Promise<void> {
  return new Promise(resolve => {
    if (introElement) {
      introElement.style.transition = `opacity ${duration}ms ease-in`;
      introElement.style.opacity = '0';
      setTimeout(() => {
        removeIntroElement();
        resolve();
      }, duration);
    } else {
      resolve();
    }
  });
}

function hideLevelTitle(duration: number): Promise<void> {
  return new Promise(resolve => {
    if (introElement) {
      introElement.style.transition = `opacity ${duration}ms ease-in, transform ${duration}ms ease-in`;
      introElement.style.opacity = '0';
      introElement.style.transform = 'translate(-50%, -50%) scale(1.15)';
      setTimeout(() => {
        removeIntroElement();
        resolve();
      }, duration);
    } else {
      resolve();
    }
  });
}

function removeIntroElement(): void {
  if (introElement && introElement.parentNode) {
    introElement.parentNode.removeChild(introElement);
  }
  introElement = null;
}

function cleanup(): void {
  introActive = false;
  removeIntroElement();
  if (disableSmoothCamera) disableSmoothCamera();
  if (setGamePaused) setGamePaused(false);
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => {
    if (introCancelled) { resolve(); return; }
    const timer = setTimeout(resolve, ms);
    // Check cancellation periodically
    const check = setInterval(() => {
      if (introCancelled) {
        clearTimeout(timer);
        clearInterval(check);
        resolve();
      }
    }, 100);
  });
}
