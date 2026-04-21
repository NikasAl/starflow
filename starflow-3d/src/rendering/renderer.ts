// ============================================================
// Star Flow Command — 3D Renderer (Three.js) + HTML HUD
// ============================================================

import * as THREE from 'three';
import {
  type GameState, type PlanetData, type MissileData,
  type CameraState, type ShipRoute, type OwnerId,
  OWNER_COLORS, OWNER_NAMES,
  PLAYER,
} from '../core/types';
import {
  SELECTION_RING_COLOR, SELECTION_RING_RADIUS_MULTIPLIER,
  BACKGROUND_COLOR, STAR_COUNT, AMBIENT_LIGHT, DIRECTIONAL_LIGHT,
  CAM_DEFAULT_DISTANCE, CAM_DEFAULT_THETA, CAM_DEFAULT_PHI,
  CAM_MIN_DISTANCE, CAM_MAX_DISTANCE, CAM_ZOOM_SPEED,
  CAMERA_FLY_DURATION, CAMERA_FLY_DISTANCE, CAMERA_MAX_MISSES, CAMERA_MISS_TIMEOUT,
  PLANET_HIT_RADIUS_MIN,
  getMaxRoutesFromPlanet,
} from '../core/constants';
import { getGameStats } from '../game/state';
import { generatePlanetTextures, type TextureSet } from '../core/texture-gen';

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

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

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
}

function updateHTMLHUD(state: GameState): void {
  const stats = getGameStats(state);

  const owners: [number, string, number][] = [
    [1, 'You', 0x4488ff],
    [2, 'Crimson', 0xff4444],
    [3, 'Emerald', 0x44cc44],
    [4, 'Golden', 0xffaa00],
    [0, 'Neutral', 0x888888],
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
    Level ${state.level}: ${state.levelConfig.name}
  </div>`;
  html += `<div style="font-size:13px; color:rgba(255,255,255,0.5); margin-bottom:6px;">
    ${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}
  </div>`;

  for (const [id, name, color] of owners) {
    const s = stats[id as OwnerId];
    if (!s) continue;
    const ch = '#' + color.toString(16).padStart(6, '0');
    html += `<div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; font-size:13px;">
      <div style="width:10px; height:10px; border-radius:50%; background:${ch}; flex-shrink:0;"></div>
      <span style="min-width:55px;">${name}</span>
      <span style="color:rgba(255,255,255,0.7);">${s.planets}p</span>
      <span style="color:${ch === '#888888' ? '#aaa' : '#66bbff'}; font-size:11px;">
        pw:${s.power}
      </span>
    </div>`;
  }

  // Active player routes
  const playerRoutes = state.routes.filter(r => r.owner === PLAYER);
  if (playerRoutes.length > 0) {
    html += `<div style="margin-top:8px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1); font-size:11px; color:#00ff88;">
      Routes: ${playerRoutes.length} active
    </div>`;
  }

  // Active missiles
  const playerMissiles = state.missiles.filter(m => m.owner === PLAYER).length;
  if (playerMissiles > 0) {
    html += `<div style="font-size:11px; color:rgba(255,255,255,0.4);">
      Missiles in flight: ${playerMissiles}
    </div>`;
  }

  // Phase indicator (subtle, overlay handles the big display)
  if (state.phase === 'won') {
    html += `<div style="font-size:14px; font-weight:bold; color:#00ff88; text-align:center; margin-top:8px;">VICTORY</div>`;
  } else if (state.phase === 'lost') {
    html += `<div style="font-size:14px; font-weight:bold; color:#ff4444; text-align:center; margin-top:8px;">DEFEAT</div>`;
  }

  // Selected hint
  if (state.selectedPlanetId && state.phase === 'playing') {
    const p = state.planets.find(pl => pl.id === state.selectedPlanetId);
    if (p) {
      const maxR = getMaxRoutesFromPlanet(p.power);
      const currentR = state.routes.filter(r => r.sourceId === p.id && r.owner === PLAYER).length;
      html += `<div style="margin-top:8px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1); font-size:12px; color:#00ff88;">
        ${p.name}: power ${Math.floor(p.power)} (${currentR}/${maxR} routes)<br>
        <span style="color:rgba(255,255,255,0.5);">Click target to create route</span>
      </div>`;
    }
  }

  html += `</div>`;
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
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(6px);
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #fff;
    animation: fadeIn 0.5s ease;
  `;

  const isWin = state.phase === 'won';
  const titleColor = isWin ? '#00ff88' : '#ff4444';
  const title = isWin ? 'VICTORY' : 'DEFEAT';
  const subtitle = isWin
    ? `Level ${state.level}: ${state.levelConfig.name} completed!`
    : `Level ${state.level}: ${state.levelConfig.name}`;

  const minutes = Math.floor(state.time / 60);
  const seconds = Math.floor(state.time % 60);
  const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;

  const playerStats = getGameStats(state);
  const playerData = playerStats[PLAYER];

  let buttonsHtml = '';
  if (isWin) {
    buttonsHtml = `<button id="btn-next-level" style="
      margin-top: 24px; padding: 14px 48px; font-size: 18px; font-weight: 600;
      color: #000; background: #00ff88; border: none; border-radius: 50px;
      cursor: pointer; letter-spacing: 2px; text-transform: uppercase;
      box-shadow: 0 0 20px rgba(0,255,136,0.4);
      transition: all 0.2s;
    ">NEXT LEVEL</button>`;
  }
  buttonsHtml += `<button id="btn-retry" style="
    margin-top: ${isWin ? '12px' : '24px'}; padding: 12px 40px; font-size: 16px; font-weight: 500;
    color: #fff; background: transparent; border: 2px solid rgba(255,255,255,0.3);
    border-radius: 50px; cursor: pointer; letter-spacing: 1px;
    transition: all 0.2s;
  ">${isWin ? 'REPLAY' : 'RETRY'}</button>`;

  overlayElement.innerHTML = `
    <div style="text-align: center;">
      <div style="font-size: 48px; font-weight: 700; color: ${titleColor};
        text-shadow: 0 0 30px ${titleColor}80; letter-spacing: 4px;">${title}</div>
      <div style="font-size: 18px; color: rgba(255,255,255,0.6); margin-top: 12px;">${subtitle}</div>
      <div style="font-size: 14px; color: rgba(255,255,255,0.4); margin-top: 8px;">Time: ${timeStr}</div>
      ${playerData ? `<div style="font-size: 14px; color: rgba(255,255,255,0.4); margin-top: 4px;">Your power: ${playerData.power} | Planets: ${playerData.planets}</div>` : ''}
      ${buttonsHtml}
    </div>
  `;

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
  ctx.strokeText(`max:${maxR} link`, 80, 60);
  ctx.fillText(`max:${maxR} link`, 80, 60);
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
  if (isPinching || suppressPointerUntilRelease) return;
  isDragging = false;
  dragStartX = e.clientX; dragStartY = e.clientY;
  dragStartTheta = camState.theta; dragStartPhi = camState.phi;
  dragStartTargetX = camState.targetX; dragStartTargetZ = camState.targetZ;
  mouseDownTime = performance.now();
}

function onPointerMove(e: PointerEvent): void {
  if (isPinching || suppressPointerUntilRelease) return;
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
  if (isPinching || suppressPointerUntilRelease) return;
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

export function setPlanetClickCallback(cb: (planetId: string) => void): void { onPlanetClick = cb; }
export function setLevelCompleteCallback(cb: () => void): void { onLevelComplete = cb; }
export function setGameOverCallback(cb: () => void): void { onGameOver = cb; }
export function getCameraState(): CameraState { return { ...camState }; }

// ============================================================
// Scene Reset — clear all game objects, keep infrastructure
// ============================================================

export function resetScene(): void {
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
}

// ============================================================
// Main render loop
// ============================================================

let lastPhase: string = 'playing';

export function syncVisuals(state: GameState, time: number, dt: number = 0): void {
  // Update camera fly-forward animation
  updateCameraFly(dt);

  for (const planet of state.planets) updatePlanet(planet);

  animateSelection(time);
  animateRoutes(time);

  for (const missile of state.missiles) updateMissilePosition(missile);

  for (const mesh of planetMeshes.values()) mesh.rotation.y += 0.003;

  updateHTMLHUD(state);

  // Show overlay when phase changes
  if (state.phase !== lastPhase) {
    lastPhase = state.phase;
    if (state.phase === 'won' || state.phase === 'lost') {
      showOverlay(state);
    }
  }

  renderer.render(scene, camera);
}

export function getRenderer(): THREE.WebGLRenderer { return renderer; }

export function dispose(): void {
  renderer.dispose();
  if (hudElement && hudElement.parentNode) hudElement.parentNode.removeChild(hudElement);
  removeOverlay();
}
