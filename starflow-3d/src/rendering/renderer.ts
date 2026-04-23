// ============================================================
// Star Flow Command — 3D Renderer (Three.js) + HTML HUD
// ============================================================

import * as THREE from 'three';
import {
  type GameState, type PlanetData, type MissileData,
  type CameraState, type ShipRoute, type OwnerId, type StarData,
  OWNER_COLORS, OWNER_NAMES, OWNER_NAME_KEYS,
  PLAYER,
} from '../core/types';
import { i18n, SUPPORTED_LOCALES, LOCALE_NAMES } from '../i18n';
import {
  SELECTION_RING_COLOR, SELECTION_RING_RADIUS_MULTIPLIER,
  BACKGROUND_COLOR, STAR_COUNT, AMBIENT_LIGHT, DIRECTIONAL_LIGHT,
  CAM_DEFAULT_DISTANCE, CAM_DEFAULT_THETA, CAM_DEFAULT_PHI,
  CAM_MIN_DISTANCE, CAM_MAX_DISTANCE, CAM_ZOOM_SPEED,
  CAMERA_FLY_DURATION, CAMERA_FLY_DISTANCE, CAMERA_MAX_MISSES, CAMERA_MISS_TIMEOUT,
  PLANET_HIT_RADIUS_MIN,
  GRAVITY_WELL_RADIUS, GRAVITY_WELL_MIN_PLANET_RADIUS,
  getMaxRoutesFromPlanet,
} from '../core/constants';
import { type BoostType, PLAYER as PLAYER_ID } from '../core/types';
import {
  BOOST_COLORS,
  ENERGY_AD_REWARD,
} from '../core/constants';
import { getGameStats, getRouteSendInterval } from '../game/state';
import { generatePlanetTextures, type TextureSet } from '../core/texture-gen';
import { audioManager, SFX, MUSIC } from '../audio';

// Store texture sets per planet for disposal
const planetTextures = new Map<string, TextureSet>();

// ============================================================
// Three.js scene globals
// ============================================================

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;

const planetMeshes = new Map<string, THREE.Mesh>();
const planetGlows = new Map<string, THREE.Mesh>();
let selectionRing: THREE.Mesh | null = null;
const planetLabels = new Map<string, THREE.Sprite>();

// Missile meshes (cylinders)
const missileMeshes = new Map<string, THREE.Group>();

// Route lines (persistent beams between planets)
const routeLines = new Map<string, THREE.Line>();

// Star meshes (sun obstacles)
const starMeshes = new Map<string, THREE.Group>();
const starGlows = new Map<string, THREE.Mesh>();
const starPointLights = new Map<string, THREE.PointLight>();

// Gravity well rings (for giant/supergiant planets)
const gravityWellRings = new Map<string, THREE.Mesh>();

// Boost indicator rings (colored rings around boosted planets)
const boostRingMeshes = new Map<string, THREE.Mesh>();

// Explosion particles
interface ExplosionEffect {
  particles: THREE.Points;
  life: number;
  maxLife: number;
  velocities: THREE.Vector3[];
}
const activeExplosions: ExplosionEffect[] = [];

const camState: CameraState = {
  targetX: 0,
  targetZ: 0,
  theta: CAM_DEFAULT_THETA,
  phi: CAM_DEFAULT_PHI,
  distance: CAM_DEFAULT_DISTANCE,
};

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartTheta = 0;
let dragStartPhi = 0;
let dragStartTargetX = 0;
let dragStartTargetZ = 0;
let mouseDownTime = 0;

// Pinch-to-zoom state (touch)
let isPinching = false;
let pinchStartDistance = 0;
let pinchStartCamDistance = 0;
let suppressPointerUntilRelease = false;

// Camera fly-forward on miss
let missCount = 0;
let lastMissTime = 0;
let cameraFlyTarget: { x: number; z: number } | null = null;
let cameraFlyStart: { x: number; z: number } | null = null;
let cameraFlyProgress = 0;

// HTML HUD element
let hudElement: HTMLDivElement;
let overlayElement: HTMLDivElement | null = null;

let onPlanetClick: ((planetId: string) => void) | null = null;
let onLevelComplete: (() => void) | null = null;
let onGameOver: (() => void) | null = null;
let onRestartLevel: (() => void) | null = null;
let onBoostActivate: ((type: string, planetId: string) => void) | null = null;
let onWatchAd: (() => void) | null = null;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// HUD dirty check — skip innerHTML when nothing changed
let hudDirty = true;
let lastHudHash = '';

// HUD visibility toggle
let hudVisible = true;
let menuOpen = false;
let menuElement: HTMLDivElement | null = null;
let menuButtonElement: HTMLButtonElement | null = null;

// Track selected planet ID for boost delegation (survives innerHTML rebuilds)
let currentSelectedPlanetId: string | null = null;

// Camera orbit on win/lose
let isOrbiting = false;
let orbitAngle = 0;
let orbitCenter = { x: 0, z: 0 };
let orbitRadius = 0;
const ORBIT_SPEED = 0.15; // radians per second

// ============================================================
// Init
// ============================================================

export function initRenderer(canvas: HTMLCanvasElement): void {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND_COLOR);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
  updateCamera();

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, AMBIENT_LIGHT));

  const dir = new THREE.DirectionalLight(0xffffff, DIRECTIONAL_LIGHT);
  dir.position.set(30, 50, 20);
  scene.add(dir);

  const dir2 = new THREE.DirectionalLight(0x4466aa, 0.3);
  dir2.position.set(-20, 30, -10);
  scene.add(dir2);

  createStarField();
  createGrid();
  createHTMLHUD();

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
  window.addEventListener('resize', onResize);
}

function createStarField(): void {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const r = 150 + Math.random() * 200;
    const t = Math.random() * Math.PI * 2;
    const p = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(p) * Math.cos(t);
    pos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
    pos[i * 3 + 2] = r * Math.cos(p);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.8, sizeAttenuation: true, transparent: true, opacity: 0.8,
  })));
}

function createGrid(): void {
  const g = new THREE.GridHelper(200, 40, 0x1a1a3a, 0x0d0d2a);
  g.position.y = -1;
  (g.material as THREE.Material).transparent = true;
  (g.material as THREE.Material).opacity = 0.3;
  scene.add(g);
}

// ============================================================
// HTML HUD — screen-fixed overlay
// ============================================================

function createHTMLHUD(): void {
  hudElement = document.createElement('div');
  hudElement.id = 'game-hud';
  hudElement.style.cssText = `
    position: fixed;
    top: 12px;
    left: 12px;
    z-index: 100;
    pointer-events: none;
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #fff;
    user-select: none;
  `;
  document.body.appendChild(hudElement);

  // Event delegation for boost & ad buttons (stable listener survives innerHTML rebuilds)
  hudElement.addEventListener('click', (e: Event) => {
    const target = (e.target as HTMLElement).closest('[data-action]');
    if (!target) return;
    const action = target.getAttribute('data-action');
    if (action === 'watch-ad') {
      if (onWatchAd) onWatchAd();
    } else if (action && action.startsWith('boost:')) {
      const boostType = action.slice(6); // e.g. 'speed', 'freeze', 'shield'
      if (onBoostActivate && currentSelectedPlanetId) {
        onBoostActivate(boostType, currentSelectedPlanetId);
      }
    }
  });
  hudElement.addEventListener('touchend', (e: Event) => {
    const target = (e.target as HTMLElement).closest('[data-action]');
    if (!target) return;
    e.preventDefault();
    const action = target.getAttribute('data-action');
    if (action === 'watch-ad') {
      if (onWatchAd) onWatchAd();
    } else if (action && action.startsWith('boost:')) {
      const boostType = action.slice(6);
      if (onBoostActivate && currentSelectedPlanetId) {
        onBoostActivate(boostType, currentSelectedPlanetId);
      }
    }
  });

  createMenuButton();
}

// ============================================================
// Three-dot menu (top-right corner)
// ============================================================

function createMenuButton(): void {
  menuButtonElement = document.createElement('button');
  menuButtonElement.id = 'menu-btn';
  menuButtonElement.innerHTML = '&#8943;';
  menuButtonElement.style.cssText = `
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 150;
    width: 44px;
    height: 44px;
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 10px;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    color: #fff;
    font-size: 22px;
    line-height: 1;
    cursor: pointer;
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
    padding: 0;
  `;
  document.body.appendChild(menuButtonElement);

  menuButtonElement.addEventListener('click', toggleMenu);
  menuButtonElement.addEventListener('touchend', (e) => { e.preventDefault(); toggleMenu(); });
}

function toggleMenu(): void {
  menuOpen = !menuOpen;
  if (menuOpen) {
    showMenu();
    audioManager.play(SFX.MENU_OPEN);
  } else {
    hideMenu();
    audioManager.play(SFX.UI_CLICK);
  }
}

function showMenu(): void {
  hideMenu(); // clean up first

  menuElement = document.createElement('div');
  menuElement.id = 'game-menu';
  menuElement.style.cssText = `
    position: fixed;
    top: 62px;
    right: 12px;
    z-index: 150;
    min-width: 180px;
    background: rgba(10,10,30,0.9);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    padding: 6px 0;
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #fff;
    animation: fadeIn 0.15s ease;
  `;

  const toggleLabel = hudVisible
    ? i18n.t('menu.hideHelp')
    : i18n.t('menu.showHelp');
  const muteLabel = audioManager.isMuted()
    ? i18n.t('menu.unmuteAll')
    : i18n.t('menu.muteAll');
  const items = [
    { label: toggleLabel, id: 'menu-toggle-help' },
    { label: i18n.t('menu.restart'), id: 'menu-restart' },
    { label: muteLabel, id: 'menu-toggle-mute' },
    { label: i18n.t('menu.language'), id: 'menu-language' },
  ];

  for (const item of items) {
    const row = document.createElement('div');
    row.id = item.id;
    row.textContent = item.label;
    row.style.cssText = `
      padding: 10px 18px;
      cursor: pointer;
      font-size: 14px;
      letter-spacing: 0.5px;
      color: rgba(255,255,255,0.85);
      transition: background 0.15s;
    `;
    row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,0.08)'; });
    row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
    row.addEventListener('click', () => handleMenuItem(item.id));
    row.addEventListener('touchend', (e) => { e.preventDefault(); handleMenuItem(item.id); });
    menuElement.appendChild(row);
  }

  document.body.appendChild(menuElement);
}

function hideMenu(): void {
  if (menuElement && menuElement.parentNode) {
    menuElement.parentNode.removeChild(menuElement);
    menuElement = null;
  }
  menuOpen = false;
}

function handleMenuItem(itemId: string): void {
  hideMenu();
  audioManager.play(SFX.UI_CLICK);

  if (itemId === 'menu-toggle-help') {
    hudVisible = !hudVisible;
    hudElement.style.display = hudVisible ? '' : 'none';
    const instructions = document.getElementById('instructions');
    if (instructions) instructions.style.display = hudVisible ? '' : 'none';
  } else if (itemId === 'menu-restart') {
    if (onRestartLevel) onRestartLevel();
  } else if (itemId === 'menu-toggle-mute') {
    audioManager.toggleMute();
  } else if (itemId === 'menu-language') {
    showLanguageMenu();
  }
}

// ============================================================
// Language selector submenu
// ============================================================

function showLanguageMenu(): void {
  hideMenu();

  const currentLocale = i18n.getLocale();

  const langMenu = document.createElement('div');
  langMenu.id = 'language-menu';
  langMenu.style.cssText = `
    position: fixed;
    top: 62px;
    right: 12px;
    z-index: 160;
    min-width: 150px;
    background: rgba(10,10,30,0.95);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px;
    padding: 6px 0;
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #fff;
    animation: fadeIn 0.15s ease;
  `;

  for (const locale of SUPPORTED_LOCALES) {
    const row = document.createElement('div');
    row.textContent = LOCALE_NAMES[locale];
    row.style.cssText = `
      padding: 10px 18px;
      cursor: pointer;
      font-size: 14px;
      letter-spacing: 0.5px;
      color: ${locale === currentLocale ? '#00ff88' : 'rgba(255,255,255,0.85)'};
      transition: background 0.15s;
    `;
    row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,0.08)'; });
    row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
    row.addEventListener('click', () => {
      i18n.setLocale(locale);
      langMenu.remove();
    });
    row.addEventListener('touchend', (e) => {
      e.preventDefault();
      i18n.setLocale(locale);
      langMenu.remove();
    });
    langMenu.appendChild(row);
  }

  document.body.appendChild(langMenu);
}

function updateHTMLHUD(state: GameState): void {
  const stats = getGameStats(state);

  const owners: [number, string, number][] = [
    [1, i18n.t('hud.you'), 0x4488ff],
    [2, i18n.t('hud.crimson'), 0xff4444],
    [3, i18n.t('hud.emerald'), 0x44cc44],
    [4, i18n.t('hud.golden'), 0xffaa00],
    [0, i18n.t('hud.neutral'), 0x888888],
  ];

  let html = `<div style="
    background: rgba(0,0,0,0.7);
    border-radius: 10px;
    padding: 12px 16px;
    backdrop-filter: blur(4px);
    border: 1px solid rgba(255,255,255,0.1);
    min-width: 220px;
  ">`;

  // Level + Timer
  html += `<div style="font-size:13px; color:rgba(255,255,255,0.5); margin-bottom:4px;">
    ${i18n.t('hud.level', { level: state.level, name: i18n.t(state.levelConfig.nameKey, state.levelConfig.nameParams) })}
  </div>`;
  html += `<div style="font-size:13px; color:rgba(255,255,255,0.5); margin-bottom:6px;">
    ${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}
  </div>`;

  // Energy counter + watch ad button (only during gameplay)
  if (state.phase === 'playing') {
    html += `<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; padding:6px 10px; background:rgba(255,170,0,0.1); border-radius:6px; border:1px solid rgba(255,170,0,0.2);">
      <div style="font-size:14px; font-weight:bold; color:#ffaa00;">&#9889; ${state.energy}</div>
      <div data-action="watch-ad" style="font-size:11px; padding:2px 8px; background:rgba(255,170,0,0.2); border:1px solid rgba(255,170,0,0.3); border-radius:4px; color:#ffaa00; cursor:pointer; pointer-events:auto;">+${i18n.t('boost.cost', { cost: ENERGY_AD_REWARD })}</div>
    </div>`;
  }

  for (const [id, name, color] of owners) {
    const s = stats[id as OwnerId];
    if (!s) continue;
    const ch = '#' + color.toString(16).padStart(6, '0');
    html += `<div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; font-size:13px;">
      <div style="width:10px; height:10px; border-radius:50%; background:${ch}; flex-shrink:0;"></div>
      <span style="min-width:55px;">${name}</span>
      <span style="color:rgba(255,255,255,0.7);">${s.planets}p</span>
      <span style="color:${ch === '#888888' ? '#aaa' : '#66bbff'}; font-size:11px;">
        ${i18n.t('hud.power', { power: s.power })}
      </span>
    </div>`;
  }

  // Star count
  if (state.stars.length > 0) {
    html += `<div style="margin-top:6px; font-size:11px; color:#ff6644;">
      ${i18n.tp('hud.stars', state.stars.length)}
    </div>`;
  }

  // Active player routes
  const playerRoutes = state.routes.filter(r => r.owner === PLAYER);
  if (playerRoutes.length > 0) {
    html += `<div style="margin-top:4px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1); font-size:11px; color:#00ff88;">
      ${i18n.tp('hud.routes', playerRoutes.length)}
    </div>`;
  }

  // Active missiles
  const playerMissiles = state.missiles.filter(m => m.owner === PLAYER).length;
  if (playerMissiles > 0) {
    html += `<div style="font-size:11px; color:rgba(255,255,255,0.4);">
      ${i18n.tp('hud.missiles', playerMissiles)}
    </div>`;
  }

  // Phase indicator (subtle, overlay handles the big display)
  if (state.phase === 'won') {
    html += `<div style="font-size:14px; font-weight:bold; color:#00ff88; text-align:center; margin-top:8px;">${i18n.t('hud.victory')}</div>`;
  } else if (state.phase === 'lost') {
    html += `<div style="font-size:14px; font-weight:bold; color:#ff4444; text-align:center; margin-top:8px;">${i18n.t('hud.defeat')}</div>`;
  }

  // Selected hint
  if (state.selectedPlanetId && state.phase === 'playing') {
    const p = state.planets.find(pl => pl.id === state.selectedPlanetId);
    if (p) {
      const maxR = getMaxRoutesFromPlanet(p.power);
      const currentR = state.routes.filter(r => r.sourceId === p.id && r.owner === PLAYER).length;
      const fireRate = getRouteSendInterval(p.power);
      html += `<div style="margin-top:8px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1); font-size:12px; color:#00ff88;">
        ${i18n.t('hud.selectedInfo', { name: p.name, power: Math.floor(p.power), current: currentR, max: maxR })}<br>
        <span style="color:rgba(255,255,255,0.5);">${i18n.t('hud.fireRate', { rate: fireRate.toFixed(1) })}</span><br>
        <span style="color:rgba(255,255,255,0.5);">${i18n.t('hud.clickTarget')}</span>
      </div>`;
    }
  }

  // Boost buttons for selected planet (only during gameplay)
  if (state.selectedPlanetId && state.phase === 'playing') {
    const sp = state.planets.find(pl => pl.id === state.selectedPlanetId);
    if (sp) {
      const boostTypes: { type: BoostType; color: string }[] = [];
      if (sp.owner === PLAYER_ID) {
        boostTypes.push({ type: 'speed', color: '#ff8800' });
        boostTypes.push({ type: 'shield', color: '#00ffcc' });
      } else if (sp.owner !== 0) {
        boostTypes.push({ type: 'freeze', color: '#44aaff' });
      }

      if (boostTypes.length > 0) {
        html += `<div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1);">`;
        for (const bt of boostTypes) {
          const bKey = `boost.${bt.type}`;
          const cost = i18n.t('boost.cost', { cost: bt.type === 'speed' ? 5 : bt.type === 'freeze' ? 8 : 10 });
          const dur = bt.type === 'speed' ? 15 : bt.type === 'freeze' ? 10 : 8;
          const isActive = state.activeBoosts.some(b => b.planetId === sp.id && b.type === bt.type);
          const canAfford = state.energy >= (bt.type === 'speed' ? 5 : bt.type === 'freeze' ? 8 : 10);
          const disabled = isActive || !canAfford;
          const opacity = disabled ? '0.35' : '0.9';
          html += `<div data-action="boost:${bt.type}" style="display:flex; align-items:center; justify-content:space-between; padding:4px 8px; margin-bottom:2px; border-radius:4px; font-size:12px; color:${bt.color}; opacity:${opacity}; cursor:pointer; pointer-events:auto; background:${isActive ? 'rgba(255,255,255,0.05)' : 'transparent'};">
            <span><b>${i18n.t(`${bKey}.name`)}</b> <span style="color:rgba(255,255,255,0.5); font-size:10px;">${i18n.t(`${bKey}.desc`, { duration: dur })}</span></span>
            <span style="font-weight:bold; font-size:11px;">${isActive ? i18n.t('boost.alreadyActive') : cost}</span>
          </div>`;
        }
        html += `</div>`;
      }
    }
  }

  html += `</div>`;

  // Dirty check — only rebuild innerHTML when content actually changes
  currentSelectedPlanetId = state.selectedPlanetId || null;
  const newHash = html.length + '|' + state.energy + '|' + (state.selectedPlanetId || '') + '|' + state.phase;
  if (newHash === lastHudHash) return;
  lastHudHash = newHash;
  hudElement.innerHTML = html;
}

// ============================================================
// Level Complete / Game Over Overlays
// ============================================================

function showOverlay(state: GameState): void {
  removeOverlay();

  overlayElement = document.createElement('div');
  overlayElement.id = 'level-overlay';
  overlayElement.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    z-index: 200; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: transparent;
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #fff;
    animation: fadeIn 0.5s ease;
    pointer-events: none;
  `;

  const isWin = state.phase === 'won';
  const titleColor = isWin ? '#00ff88' : '#ff4444';
  const levelName = i18n.t(state.levelConfig.nameKey, state.levelConfig.nameParams);
  const title = isWin ? i18n.t('overlay.victory') : i18n.t('overlay.defeat');
  const subtitle = isWin
    ? i18n.t('overlay.levelCompleted', { level: state.level, name: levelName })
    : i18n.t('overlay.levelFailed', { level: state.level, name: levelName });

  const minutes = Math.floor(state.time / 60);
  const seconds = Math.floor(state.time % 60);
  const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;

  const playerStats = getGameStats(state);
  const playerData = playerStats[PLAYER];

  let buttonsHtml = '';
  if (isWin) {
    buttonsHtml = `<button id="btn-next-level" style="
      padding: 14px 48px; font-size: 18px; font-weight: 600;
      color: #00ff88; background: transparent; border: 2px solid rgba(0,255,136,0.5);
      border-radius: 50px; cursor: pointer; letter-spacing: 2px; text-transform: uppercase;
      text-shadow: 0 0 10px rgba(0,255,136,0.6);
      transition: all 0.2s;
    ">${i18n.t('overlay.nextLevel')}</button>`;
  }
  buttonsHtml += `<button id="btn-retry" style="
    margin-top: ${isWin ? '14px' : '0'}; padding: 12px 40px; font-size: 16px; font-weight: 500;
    color: #fff; background: transparent; border: 2px solid rgba(255,255,255,0.3);
    border-radius: 50px; cursor: pointer; letter-spacing: 1px;
    text-shadow: 0 1px 4px rgba(0,0,0,0.9);
    transition: all 0.2s;
  ">${isWin ? i18n.t('overlay.replay') : i18n.t('overlay.retry')}</button>`;

  overlayElement.innerHTML = `
    <div style="text-align: center; pointer-events: auto;
      background: transparent;
      display: flex; flex-direction: column; justify-content: space-between;
      height: 100%; padding: 10vh 24px 8vh;
    ">
      <div>
        <div style="font-size: 48px; font-weight: 700; color: ${titleColor};
          text-shadow: 0 0 30px ${titleColor}80, 0 2px 8px rgba(0,0,0,0.8); letter-spacing: 4px;">${title}</div>
        <div style="font-size: 18px; color: rgba(255,255,255,0.8); margin-top: 12px;
          text-shadow: 0 1px 6px rgba(0,0,0,0.9);">${subtitle}</div>
        <div style="font-size: 14px; color: rgba(255,255,255,0.6); margin-top: 8px;
          text-shadow: 0 1px 4px rgba(0,0,0,0.9);">${i18n.t('overlay.time', { time: timeStr })}</div>
        ${playerData ? `<div style="font-size: 14px; color: rgba(255,255,255,0.6); margin-top: 4px;
          text-shadow: 0 1px 4px rgba(0,0,0,0.9);">${i18n.t('overlay.yourStats', { power: playerData.power, planets: playerData.planets })}</div>` : ''}
      </div>
      <div>${buttonsHtml}</div>
    </div>
  `;

  // Play victory / defeat sound
  if (isWin) {
    audioManager.play(SFX.VICTORY);
  } else {
    audioManager.play(SFX.DEFEAT);
  }

  document.body.appendChild(overlayElement);

  // Wire buttons
  const nextBtn = overlayElement.querySelector('#btn-next-level');
  const retryBtn = overlayElement.querySelector('#btn-retry');

  if (nextBtn) {
    nextBtn.addEventListener('click', () => { if (onLevelComplete) onLevelComplete(); });
    nextBtn.addEventListener('touchend', (e) => { e.preventDefault(); if (onLevelComplete) onLevelComplete(); });
  }
  if (retryBtn) {
    retryBtn.addEventListener('click', () => { if (onGameOver) onGameOver(); });
    retryBtn.addEventListener('touchend', (e) => { e.preventDefault(); if (onGameOver) onGameOver(); });
  }
}

export function removeOverlay(): void {
  if (overlayElement && overlayElement.parentNode) {
    overlayElement.parentNode.removeChild(overlayElement);
    overlayElement = null;
  }
}

// ============================================================
// Star (Sun) Rendering
// ============================================================

export function addStar(star: StarData): void {
  const group = new THREE.Group();
  group.userData = { starId: star.id };

  // Star color variants based on seed
  const colorVariants = [
    { core: 0xffffcc, glow: 0xffaa44, corona: 0xff6600 },
    { core: 0xccddff, glow: 0x4488ff, corona: 0x2244aa },
    { core: 0xffccaa, glow: 0xff6644, corona: 0xcc2200 },
    { core: 0xffffff, glow: 0xffdd88, corona: 0xff8800 },
  ];
  const variant = colorVariants[star.seed % colorVariants.length];

  // Core sphere — bright emissive
  const coreGeo = new THREE.SphereGeometry(Math.max(0.1, star.visualRadius * 0.5), 32, 24);
  const coreMat = new THREE.MeshBasicMaterial({
    color: variant.core,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  group.add(core);

  // Inner glow
  const glowGeo = new THREE.SphereGeometry(Math.max(0.1, star.visualRadius * 0.8), 32, 24);
  const glowMat = new THREE.MeshBasicMaterial({
    color: variant.glow,
    transparent: true,
    opacity: 0.35,
  });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  group.add(glowMesh);
  starGlows.set(star.id, glowMesh);

  // Corona — large semi-transparent sphere
  const coronaGeo = new THREE.SphereGeometry(Math.max(0.1, star.visualRadius * 1.5), 32, 24);
  const coronaMat = new THREE.MeshBasicMaterial({
    color: variant.corona,
    transparent: true,
    opacity: 0.08,
  });
  const corona = new THREE.Mesh(coronaGeo, coronaMat);
  group.add(corona);

  // Danger ring — red ring indicating kill zone
  const ringGeo = new THREE.RingGeometry(
    Math.max(0.1, star.visualRadius + 3.5),
    Math.max(0.2, star.visualRadius + 4.0),
    48,
  );
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff2200,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.1;
  group.add(ring);

  // Second danger ring (vertical)
  const ring2Geo = new THREE.RingGeometry(
    Math.max(0.1, star.visualRadius + 3.5),
    Math.max(0.2, star.visualRadius + 4.0),
    48,
  );
  const ring2Mat = new THREE.MeshBasicMaterial({
    color: 0xff2200,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
  });
  const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
  ring2.position.y = -0.1;
  group.add(ring2);

  // Point light — illuminates nearby space
  const light = new THREE.PointLight(variant.glow, 2.0, 40, 1.5);
  light.position.set(0, 0, 0);
  group.add(light);
  starPointLights.set(star.id, light);

  group.position.set(star.x, star.y, star.z);
  scene.add(group);
  starMeshes.set(star.id, group);
}

function animateStars(time: number): void {
  for (const [id, group] of starMeshes) {
    // Pulse glow
    const glow = starGlows.get(id);
    if (glow) {
      (glow.material as THREE.MeshBasicMaterial).opacity = 0.25 + Math.sin(time * 2 + group.position.x) * 0.1;
    }

    // Rotate danger rings slowly
    group.children.forEach((child, idx) => {
      if (idx >= 4 && idx <= 5) { // ring indices
        child.rotation.z = time * 0.3 * (idx === 4 ? 1 : -1);
      }
    });

    // Flicker point light
    const light = starPointLights.get(id);
    if (light) {
      light.intensity = 1.8 + Math.sin(time * 5 + id.charCodeAt(id.length - 1)) * 0.3;
    }
  }
}

// ============================================================
// Gravity Well Visualization
// ============================================================

export function addGravityWell(planet: PlanetData): void {
  const wellRadius = GRAVITY_WELL_RADIUS + planet.radius;

  // Multiple concentric rings
  for (let i = 0; i < 3; i++) {
    const r = wellRadius * (0.6 + i * 0.2);
    const ringGeo = new THREE.RingGeometry(
      Math.max(0.1, r - 0.15),
      Math.max(0.2, r + 0.15),
      48,
    );
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.12 - i * 0.03,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(planet.x, planet.y - 0.2, planet.z);
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);
    gravityWellRings.set(`${planet.id}_${i}`, ring);
  }
}

function animateGravityWells(time: number): void {
  for (const [key, ring] of gravityWellRings) {
    const i = parseInt(key.split('_')[1]);
    (ring.material as THREE.MeshBasicMaterial).opacity = (0.12 - i * 0.03) +
      Math.sin(time * 1.5 + i * 1.2) * 0.04;
  }
}

export function removeGravityWellsForPlanet(planetId: string): void {
  for (let i = 0; i < 3; i++) {
    const key = `${planetId}_${i}`;
    const ring = gravityWellRings.get(key);
    if (ring) {
      scene.remove(ring);
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
      gravityWellRings.delete(key);
    }
  }
}

// ============================================================
// Explosion Effects
// ============================================================

export function addExplosion(x: number, y: number, z: number): void {
  const particleCount = 20;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const velocities: THREE.Vector3[] = [];

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Random direction
    const v = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
    ).normalize().multiplyScalar(3 + Math.random() * 5);
    velocities.push(v);
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xff8844,
    size: 0.4,
    transparent: true,
    opacity: 1.0,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);

  activeExplosions.push({
    particles: points,
    life: 0,
    maxLife: 0.8,
    velocities,
  });

  audioManager.play(SFX.EXPLOSION);
}

function updateExplosions(dt: number): void {
  for (let i = activeExplosions.length - 1; i >= 0; i--) {
    const exp = activeExplosions[i];
    exp.life += dt;

    if (exp.life >= exp.maxLife) {
      scene.remove(exp.particles);
      exp.particles.geometry.dispose();
      (exp.particles.material as THREE.Material).dispose();
      activeExplosions.splice(i, 1);
      continue;
    }

    const t = exp.life / exp.maxLife;
    (exp.particles.material as THREE.PointsMaterial).opacity = 1.0 - t;

    const posAttr = exp.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let j = 0; j < exp.velocities.length; j++) {
      arr[j * 3] += exp.velocities[j].x * dt;
      arr[j * 3 + 1] += exp.velocities[j].y * dt;
      arr[j * 3 + 2] += exp.velocities[j].z * dt;
      // Slow down
      exp.velocities[j].multiplyScalar(0.95);
    }
    posAttr.needsUpdate = true;
  }
}

// ============================================================
// Planet rendering
// ============================================================

export function addPlanet(planet: PlanetData): void {
  const geometry = new THREE.SphereGeometry(Math.max(0.1, planet.radius), 48, 32);
  const color = OWNER_COLORS[planet.owner];

  // Generate procedural textures
  const texSet = generatePlanetTextures(
    planet.visualType,
    planet.textureSeed,
    color,
  );
  planetTextures.set(planet.id, texSet);

  // PBR material with stronger emissive tint
  const material = new THREE.MeshStandardMaterial({
    map: texSet.diffuse,
    normalMap: texSet.normal,
    normalScale: new THREE.Vector2(1.5, 1.5),
    roughness: 0.7,
    metalness: 0.1,
    emissive: color,
    emissiveIntensity: 0.2,
    emissiveMap: texSet.emissive,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(planet.x, planet.y, planet.z);
  mesh.userData = { planetId: planet.id };
  scene.add(mesh);
  planetMeshes.set(planet.id, mesh);

  // Glow ring — scale with planet size
  const glowScale = Math.max(1.1, 1.0 + (planet.radius - 1.6) * 0.05);
  const glowGeo = new THREE.RingGeometry(
    Math.max(0.1, planet.radius * glowScale),
    Math.max(0.2, planet.radius * (glowScale + 0.2)),
    32,
  );
  const glowMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.set(planet.x, planet.y + 0.05, planet.z);
  glow.rotation.x = -Math.PI / 2;
  scene.add(glow);
  planetGlows.set(planet.id, glow);

  // Add gravity well for large planets
  if (planet.radius >= GRAVITY_WELL_MIN_PLANET_RADIUS) {
    addGravityWell(planet);
  }

  addPlanetLabel(planet);
}

function addPlanetLabel(planet: PlanetData): void {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  drawPlanetLabel(ctx, planet);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, transparent: true, depthTest: true, depthWrite: false,
  }));
  sprite.scale.set(7, 3, 1);
  sprite.position.set(planet.x, planet.y + planet.radius + 1.5, planet.z);
  scene.add(sprite);
  planetLabels.set(planet.id, sprite);
}

function drawPlanetLabel(ctx: CanvasRenderingContext2D, planet: PlanetData): void {
  ctx.clearRect(0, 0, 160, 64);

  const pw = Math.floor(planet.power);
  const colorHex = '#' + OWNER_COLORS[planet.owner].toString(16).padStart(6, '0');

  // Power number — prominent
  ctx.font = 'bold 30px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = colorHex;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeText(`${pw}`, 80, 30);
  ctx.fillText(`${pw}`, 80, 30);

  // Planet size label
  ctx.font = '11px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeText(planet.sizeType.toUpperCase(), 80, 48);
  ctx.fillText(planet.sizeType.toUpperCase(), 80, 48);

  // Max routes indicator
  const maxR = getMaxRoutesFromPlanet(planet.power);
  ctx.font = '10px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.strokeText(i18n.t('planet.maxLinks', { n: maxR }), 80, 60);
  ctx.fillText(i18n.t('planet.maxLinks', { n: maxR }), 80, 60);
}

export function updatePlanet(planet: PlanetData): void {
  const mesh = planetMeshes.get(planet.id);
  if (!mesh) return;

  const color = OWNER_COLORS[planet.owner];
  const mat = mesh.material as THREE.MeshStandardMaterial;
  mat.emissive.setHex(color);
  mat.emissiveIntensity = 0.2;

  const glow = planetGlows.get(planet.id);
  if (glow) (glow.material as THREE.MeshBasicMaterial).color.setHex(color);

  const sprite = planetLabels.get(planet.id);
  if (sprite) {
    const canvas = (sprite.material as THREE.SpriteMaterial).map!.image as HTMLCanvasElement;
    drawPlanetLabel(canvas.getContext('2d')!, planet);
    (sprite.material as THREE.SpriteMaterial).map!.needsUpdate = true;
  }
}

// ============================================================
// Missile rendering (cylinders)
// ============================================================

export function addMissile(missile: MissileData): void {
  const group = new THREE.Group();
  group.userData = { missileId: missile.id };

  const color = OWNER_COLORS[missile.owner];

  const cylGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 8);
  const cylMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.6,
  });
  const cylinder = new THREE.Mesh(cylGeo, cylMat);
  group.add(cylinder);

  const noseGeo = new THREE.SphereGeometry(0.15, 8, 6);
  const nose = new THREE.Mesh(noseGeo, cylMat.clone());
  nose.position.y = 0.5;
  group.add(nose);

  const engineGeo = new THREE.SphereGeometry(0.2, 8, 6);
  const engineMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.35,
  });
  const engine = new THREE.Mesh(engineGeo, engineMat);
  engine.position.y = -0.4;
  group.add(engine);

  const source = planetMeshes.get(missile.sourceId);
  const target = planetMeshes.get(missile.targetId);
  if (source && target) {
    const dir = new THREE.Vector3()
      .subVectors(target.position, source.position)
      .normalize();
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    group.quaternion.copy(quaternion);
  }

  group.position.set(missile.x, missile.y, missile.z);
  scene.add(group);
  missileMeshes.set(missile.id, group);
}

export function updateMissilePosition(missile: MissileData): void {
  const group = missileMeshes.get(missile.id);
  if (group) group.position.set(missile.x, missile.y, missile.z);
}

export function removeMissile(id: string): void {
  const group = missileMeshes.get(id);
  if (group) {
    scene.remove(group);
    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
    missileMeshes.delete(id);
  }
}

// ============================================================
// Selection ring
// ============================================================

export function updateSelection(planetId: string | null): void {
  if (selectionRing) {
    scene.remove(selectionRing);
    selectionRing.geometry.dispose();
    (selectionRing.material as THREE.Material).dispose();
    selectionRing = null;
  }
  if (!planetId) return;

  const planet = planetMeshes.get(planetId);
  if (!planet) return;

  const radius = (planet.geometry as THREE.SphereGeometry).parameters?.radius || 1.5;
  const rr = radius * SELECTION_RING_RADIUS_MULTIPLIER;

  const geo = new THREE.RingGeometry(Math.max(0.1, rr), Math.max(0.2, rr + 0.2), 32);
  const mat = new THREE.MeshBasicMaterial({
    color: SELECTION_RING_COLOR, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
  });

  selectionRing = new THREE.Mesh(geo, mat);
  selectionRing.position.copy(planet.position);
  selectionRing.position.y += 0.1;
  selectionRing.rotation.x = -Math.PI / 2;
  scene.add(selectionRing);
}

function animateSelection(time: number): void {
  if (!selectionRing) return;
  const s = 1.0 + Math.sin(time * 4) * 0.1;
  selectionRing.scale.set(s, s, 1);
  (selectionRing.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(time * 3) * 0.3;
}

// ============================================================
// Route lines (persistent beams between planets)
// ============================================================

export function addRouteLine(route: ShipRoute): void {
  const source = planetMeshes.get(route.sourceId);
  const target = planetMeshes.get(route.targetId);
  if (!source || !target) return;

  const points = [source.position.clone(), target.position.clone()];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  const color = OWNER_COLORS[route.owner];
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.4,
    linewidth: 1,
  });

  const line = new THREE.Line(geometry, material);
  scene.add(line);
  routeLines.set(route.id, line);
}

export function removeRouteLine(routeId: string): void {
  const line = routeLines.get(routeId);
  if (line) {
    scene.remove(line);
    line.geometry.dispose();
    (line.material as THREE.Material).dispose();
    routeLines.delete(routeId);
  }
}

function animateRoutes(time: number): void {
  for (const [id, line] of routeLines) {
    (line.material as THREE.LineBasicMaterial).opacity = 0.2 + Math.sin(time * 2 + id.length) * 0.15;
  }
}

// ============================================================
// Camera
// ============================================================

function updateCamera(): void {
  const x = camState.targetX + camState.distance * Math.sin(camState.phi) * Math.cos(camState.theta);
  const y = camState.distance * Math.cos(camState.phi);
  const z = camState.targetZ + camState.distance * Math.sin(camState.phi) * Math.sin(camState.theta);
  camera.position.set(x, y, z);
  camera.lookAt(camState.targetX, 0, camState.targetZ);
}

function onResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================================
// Input
// ============================================================

function onPointerDown(e: PointerEvent): void {
  if (isOrbiting || isPinching || suppressPointerUntilRelease) return;
  hideMenu();
  isDragging = false;
  dragStartX = e.clientX; dragStartY = e.clientY;
  dragStartTheta = camState.theta; dragStartPhi = camState.phi;
  dragStartTargetX = camState.targetX; dragStartTargetZ = camState.targetZ;
  mouseDownTime = performance.now();
}

function onPointerMove(e: PointerEvent): void {
  if (isOrbiting || isPinching || suppressPointerUntilRelease) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging = true;
  if (!isDragging) return;

  if (e.buttons === 1) {
    if (e.shiftKey) {
      const s = camState.distance * 0.003;
      camState.targetX = dragStartTargetX - dx * s * Math.cos(camState.theta) + dy * s * Math.sin(camState.theta);
      camState.targetZ = dragStartTargetZ - dx * s * Math.sin(camState.theta) - dy * s * Math.cos(camState.theta);
    } else {
      camState.theta = dragStartTheta - dx * 0.005;
      camState.phi = Math.max(0.2, Math.min(Math.PI / 2 - 0.1, dragStartPhi + dy * 0.005));
    }
  }
  updateCamera();
}

function onPointerUp(e: PointerEvent): void {
  if (isOrbiting || isPinching || suppressPointerUntilRelease) return;
  if (!isDragging && performance.now() - mouseDownTime < 300) handleClick(e);
  isDragging = false;
}

/** Enhanced planet click detection with close-miss tolerance */
function handleClick(e: PointerEvent): void {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // 1. Try exact mesh intersection
  const meshes = Array.from(planetMeshes.values());
  const intersects = raycaster.intersectObjects(meshes);

  if (intersects.length > 0) {
    const pid = intersects[0].object.userData.planetId;
    if (pid && onPlanetClick) onPlanetClick(pid);
    missCount = 0;
    cameraFlyTarget = null;
    return;
  }

  // 2. Close-miss: check if ray passes near any planet (larger hit radius)
  const ray = raycaster.ray;
  let closestPlanetId: string | null = null;
  let closestDist = Infinity;

  for (const [id, mesh] of planetMeshes) {
    const radius = (mesh.geometry as THREE.SphereGeometry).parameters?.radius || 1.5;
    // Use a generous hit radius (at least PLANET_HIT_RADIUS_MIN)
    const hitRadius = Math.max(radius * 1.5, PLANET_HIT_RADIUS_MIN);
    const sphere = new THREE.Sphere(mesh.position, hitRadius);
    const intersection = new THREE.Vector3();
    if (ray.intersectSphere(sphere, intersection)) {
      const dist = intersection.distanceTo(ray.origin);
      if (dist < closestDist) {
        closestDist = dist;
        closestPlanetId = id;
      }
    }
  }

  if (closestPlanetId && onPlanetClick) {
    onPlanetClick(closestPlanetId);
    missCount = 0;
    cameraFlyTarget = null;
    return;
  }

  // 3. True miss — fly camera forward or deselect
  missCount++;
  const now = performance.now() / 1000;
  const timeSinceLastMiss = now - lastMissTime;
  lastMissTime = now;

  if (missCount >= CAMERA_MAX_MISSES || timeSinceLastMiss > CAMERA_MISS_TIMEOUT) {
    // Deselect
    if (onPlanetClick) onPlanetClick('__deselect__');
    missCount = 0;
  } else {
    // Fly camera forward toward the ray direction
    const flyDir = ray.direction.clone();
    // Project onto the XZ ground plane
    flyDir.y = 0;
    if (flyDir.length() > 0.01) {
      flyDir.normalize();
      cameraFlyStart = { x: camState.targetX, z: camState.targetZ };
      cameraFlyTarget = {
        x: camState.targetX + flyDir.x * CAMERA_FLY_DISTANCE,
        z: camState.targetZ + flyDir.z * CAMERA_FLY_DISTANCE,
      };
      cameraFlyProgress = 0;
    }
  }
}

/** Ease-out cubic for smooth camera animation */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function updateCameraFly(dt: number): void {
  if (!cameraFlyTarget || !cameraFlyStart) return;

  cameraFlyProgress += dt / CAMERA_FLY_DURATION;
  if (cameraFlyProgress >= 1) {
    camState.targetX = cameraFlyTarget.x;
    camState.targetZ = cameraFlyTarget.z;
    cameraFlyTarget = null;
    cameraFlyStart = null;
    updateCamera();
    return;
  }

  const t = easeOutCubic(cameraFlyProgress);
  camState.targetX = cameraFlyStart.x + (cameraFlyTarget.x - cameraFlyStart.x) * t;
  camState.targetZ = cameraFlyStart.z + (cameraFlyTarget.z - cameraFlyStart.z) * t;
  updateCamera();
}

function onWheel(e: WheelEvent): void {
  if (isOrbiting) return;
  e.preventDefault();
  camState.distance *= 1 + e.deltaY * 0.001 * CAM_ZOOM_SPEED;
  camState.distance = Math.max(CAM_MIN_DISTANCE, Math.min(CAM_MAX_DISTANCE, camState.distance));
  updateCamera();
}

// ============================================================
// Pinch-to-zoom (touch gestures for mobile/Android)
// ============================================================

function getTouchDistance(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function onTouchStart(e: TouchEvent): void {
  if (e.touches.length === 2) {
    e.preventDefault();
    isPinching = true;
    pinchStartDistance = getTouchDistance(e.touches[0], e.touches[1]);
    pinchStartCamDistance = camState.distance;
    isDragging = false;
  }
}

function onTouchMove(e: TouchEvent): void {
  if (e.touches.length === 2 && isPinching) {
    e.preventDefault();
    const currentDist = getTouchDistance(e.touches[0], e.touches[1]);
    const scale = pinchStartDistance / currentDist;
    camState.distance = Math.max(
      CAM_MIN_DISTANCE,
      Math.min(CAM_MAX_DISTANCE, pinchStartCamDistance * scale)
    );
    updateCamera();
  }
}

function onTouchEnd(e: TouchEvent): void {
  if (e.touches.length === 0) {
    isPinching = false;
    suppressPointerUntilRelease = false;
  } else if (e.touches.length < 2) {
    isPinching = false;
    suppressPointerUntilRelease = true;
  }
}

/** Recreate the menu button after a scene reset */
export function recreateMenuButton(): void {
  createMenuButton();
}

export function setPlanetClickCallback(cb: (planetId: string) => void): void { onPlanetClick = cb; }
export function setLevelCompleteCallback(cb: () => void): void { onLevelComplete = cb; }
export function setGameOverCallback(cb: () => void): void { onGameOver = cb; }
export function setRestartLevelCallback(cb: () => void): void { onRestartLevel = cb; }

export function setBoostActivateCallback(cb: (type: string, planetId: string) => void): void {
  onBoostActivate = cb;
}

export function setWatchAdCallback(cb: () => void): void {
  onWatchAd = cb;
}

/** Force HUD rebuild on next frame (e.g. after boost activation) */
export function invalidateHud(): void {
  lastHudHash = '';
}

export function getCameraState(): CameraState { return { ...camState }; }

// ============================================================
// Scene Reset — clear all game objects, keep infrastructure
// ============================================================

export function resetScene(): void {
  // Force HUD rebuild on next frame
  lastHudHash = '';
  currentSelectedPlanetId = null;

  // Remove and dispose all planets
  for (const [id, mesh] of planetMeshes) {
    scene.remove(mesh);
    const texSet = planetTextures.get(id);
    if (texSet) {
      texSet.diffuse.dispose();
      texSet.normal.dispose();
      if (texSet.emissive) texSet.emissive.dispose();
    }
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
  planetMeshes.clear();
  planetTextures.clear();

  for (const [id, glow] of planetGlows) {
    scene.remove(glow);
    glow.geometry.dispose();
    (glow.material as THREE.Material).dispose();
  }
  planetGlows.clear();

  for (const [id, label] of planetLabels) {
    scene.remove(label);
    (label.material as THREE.SpriteMaterial).map?.dispose();
    (label.material as THREE.SpriteMaterial).dispose();
  }
  planetLabels.clear();

  // Remove gravity wells
  for (const [key, ring] of gravityWellRings) {
    scene.remove(ring);
    ring.geometry.dispose();
    (ring.material as THREE.Material).dispose();
  }
  gravityWellRings.clear();

  // Clear boost indicator rings
  for (const ring of boostRingMeshes.values()) {
    scene.remove(ring);
    ring.geometry.dispose();
    (ring.material as THREE.Material).dispose();
  }
  boostRingMeshes.clear();

  // Remove stars
  for (const [id, group] of starMeshes) {
    scene.remove(group);
    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
  }
  starMeshes.clear();
  starGlows.clear();
  for (const [id, light] of starPointLights) {
    scene.remove(light);
    light.dispose();
  }
  starPointLights.clear();

  // Remove missiles
  for (const [id, group] of missileMeshes) {
    scene.remove(group);
    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
  }
  missileMeshes.clear();

  // Remove routes
  for (const [id, line] of routeLines) {
    scene.remove(line);
    line.geometry.dispose();
    (line.material as THREE.Material).dispose();
  }
  routeLines.clear();

  // Remove explosions
  for (const exp of activeExplosions) {
    scene.remove(exp.particles);
    exp.particles.geometry.dispose();
    (exp.particles.material as THREE.Material).dispose();
  }
  activeExplosions.length = 0;

  // Remove selection ring
  if (selectionRing) {
    scene.remove(selectionRing);
    selectionRing.geometry.dispose();
    (selectionRing.material as THREE.Material).dispose();
    selectionRing = null;
  }

  // Remove overlay
  removeOverlay();

  // Reset camera
  camState.targetX = 0;
  camState.targetZ = 0;
  camState.theta = CAM_DEFAULT_THETA;
  camState.phi = CAM_DEFAULT_PHI;
  camState.distance = CAM_DEFAULT_DISTANCE;
  updateCamera();

  // Reset fly-forward state
  cameraFlyTarget = null;
  cameraFlyStart = null;
  cameraFlyProgress = 0;
  missCount = 0;

  // Reset orbit state
  isOrbiting = false;
  orbitAngle = 0;
  orbitRadius = 0;

  // Remove menu
  hideMenu();
  if (menuButtonElement && menuButtonElement.parentNode) {
    menuButtonElement.parentNode.removeChild(menuButtonElement);
    menuButtonElement = null;
  }

  // Reset HUD visibility
  hudVisible = true;

  // Reset phase tracker
  lastPhase = 'playing';
}

// ============================================================
// Main render loop
// ============================================================

let lastPhase: string = 'playing';

// ============================================================
// Camera Orbit (cinematic fly-around on win/lose)
// ============================================================

function startOrbit(planets: PlanetData[]): void {
  isOrbiting = true;
  orbitAngle = camState.theta; // start from current angle

  // Calculate center and radius to fit all planets
  if (planets.length > 0) {
    let cx = 0, cz = 0;
    for (const p of planets) { cx += p.x; cz += p.z; }
    orbitCenter.x = cx / planets.length;
    orbitCenter.z = cz / planets.length;

    // Find max distance from center to any planet
    let maxDist = 0;
    for (const p of planets) {
      const dx = p.x - orbitCenter.x;
      const dz = p.z - orbitCenter.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > maxDist) maxDist = dist;
    }
    // Camera distance to see the whole field: farthest planet + padding
    orbitRadius = (maxDist + 10) / Math.sin(CAM_DEFAULT_PHI);
  } else {
    orbitRadius = CAM_DEFAULT_DISTANCE;
  }
}

function updateOrbit(dt: number, time: number): void {
  if (!isOrbiting) return;

  orbitAngle += ORBIT_SPEED * dt;

  // Smoothly aim camera at orbit center
  camState.targetX += (orbitCenter.x - camState.targetX) * 0.02;
  camState.targetZ += (orbitCenter.z - camState.targetZ) * 0.02;

  // Slowly rotate around
  camState.theta = orbitAngle;
  // Gentle phi oscillation for cinematic feel
  camState.phi = CAM_DEFAULT_PHI + Math.sin(time * 0.3) * 0.08;

  // Zoom out to fit the whole battlefield
  camState.distance += (orbitRadius - camState.distance) * 0.01;

  updateCamera();
}

function stopOrbit(): void {
  isOrbiting = false;
}

function syncBoostIndicators(state: GameState): void {
  const activeKeys = new Set<string>();

  for (const boost of state.activeBoosts) {
    const key = `${boost.type}:${boost.planetId}`;
    activeKeys.add(key);

    if (!boostRingMeshes.has(key)) {
      // Create ring for this boost
      const planet = planetMeshes.get(boost.planetId);
      if (!planet) continue;
      const radius = (planet.geometry as THREE.SphereGeometry).parameters?.radius || 1.5;
      const rr = radius * 1.8;
      const color = BOOST_COLORS[boost.type] || 0xffffff;

      const geo = new THREE.TorusGeometry(Math.max(0.1, rr), 0.12, 16, 32);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.6,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.position.copy(planet.position);
      ring.position.y += 0.15;
      ring.rotation.x = Math.PI / 2;
      scene.add(ring);
      boostRingMeshes.set(key, ring);
    }
  }

  // Remove rings for expired boosts
  for (const [key, ring] of boostRingMeshes) {
    if (!activeKeys.has(key)) {
      scene.remove(ring);
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
      boostRingMeshes.delete(key);
    }
  }
}

function animateBoostRings(time: number): void {
  for (const ring of boostRingMeshes.values()) {
    ring.rotation.z = time * 2;
    (ring.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(time * 4) * 0.2;
  }
}

export function syncVisuals(state: GameState, time: number, dt: number = 0): void {
  // Update camera fly-forward animation
  updateCameraFly(dt);

  // Orbit camera on win/lose
  if (isOrbiting) {
    updateOrbit(dt, time);
  }

  for (const planet of state.planets) updatePlanet(planet);

  animateSelection(time);
  animateRoutes(time);
  syncBoostIndicators(state);
  animateBoostRings(time);
  animateStars(time);
  animateGravityWells(time);
  updateExplosions(dt);

  for (const missile of state.missiles) updateMissilePosition(missile);

  for (const mesh of planetMeshes.values()) mesh.rotation.y += 0.003;

  updateHTMLHUD(state);

  // Show overlay when phase changes + start cinematic orbit
  if (state.phase !== lastPhase) {
    lastPhase = state.phase;
    if (state.phase === 'won' || state.phase === 'lost') {
      startOrbit(state.planets);
      showOverlay(state);
    }
  }

  renderer.render(scene, camera);
}

export function getRenderer(): THREE.WebGLRenderer { return renderer; }

export function dispose(): void {
  renderer.dispose();
  if (hudElement && hudElement.parentNode) hudElement.parentNode.removeChild(hudElement);
  hideMenu();
  if (menuButtonElement && menuButtonElement.parentNode) {
    menuButtonElement.parentNode.removeChild(menuButtonElement);
    menuButtonElement = null;
  }
  removeOverlay();
}
