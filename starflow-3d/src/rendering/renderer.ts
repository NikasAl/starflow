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

// HTML HUD element
let hudElement: HTMLDivElement;

let onPlanetClick: ((planetId: string) => void) | null = null;

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

  // Timer
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

  // Phase
  if (state.phase === 'won') {
    html += `<div style="font-size:20px; font-weight:bold; color:#00ff88; text-align:center; margin-top:10px;">VICTORY!</div>`;
  } else if (state.phase === 'lost') {
    html += `<div style="font-size:20px; font-weight:bold; color:#ff4444; text-align:center; margin-top:10px;">DEFEAT</div>`;
  }

  // Selected hint
  if (state.selectedPlanetId) {
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

  // Glow ring
  const glowGeo = new THREE.RingGeometry(
    Math.max(0.1, planet.radius * 1.1),
    Math.max(0.2, planet.radius * 1.3),
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
    map: texture, transparent: true, depthTest: false,
  }));
  sprite.scale.set(7, 3, 1);
  sprite.position.set(planet.x, planet.radius + 1.5, planet.z);
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

  // Max routes indicator
  const maxR = getMaxRoutesFromPlanet(planet.power);
  ctx.font = '13px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeText(`max:${maxR} link`, 80, 52);
  ctx.fillText(`max:${maxR} link`, 80, 52);
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

  // Cylinder body
  const cylGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 8);
  const cylMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.6,
  });
  const cylinder = new THREE.Mesh(cylGeo, cylMat);
  group.add(cylinder);

  // Nose cone (small sphere at front)
  const noseGeo = new THREE.SphereGeometry(0.15, 8, 6);
  const nose = new THREE.Mesh(noseGeo, cylMat.clone());
  nose.position.y = 0.5;
  group.add(nose);

  // Engine glow at back
  const engineGeo = new THREE.SphereGeometry(0.2, 8, 6);
  const engineMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.35,
  });
  const engine = new THREE.Mesh(engineGeo, engineMat);
  engine.position.y = -0.4;
  group.add(engine);

  // Orient cylinder toward target direction
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

/** Animate route lines (pulse) */
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
  isDragging = false;
  dragStartX = e.clientX; dragStartY = e.clientY;
  dragStartTheta = camState.theta; dragStartPhi = camState.phi;
  dragStartTargetX = camState.targetX; dragStartTargetZ = camState.targetZ;
  mouseDownTime = performance.now();
}

function onPointerMove(e: PointerEvent): void {
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
  if (!isDragging && performance.now() - mouseDownTime < 300) handleClick(e);
  isDragging = false;
}

function handleClick(e: PointerEvent): void {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const meshes = Array.from(planetMeshes.values());
  const intersects = raycaster.intersectObjects(meshes);

  if (intersects.length > 0) {
    const pid = intersects[0].object.userData.planetId;
    if (pid && onPlanetClick) onPlanetClick(pid);
  } else if (onPlanetClick) {
    onPlanetClick('__deselect__');
  }
}

function onWheel(e: WheelEvent): void {
  e.preventDefault();
  camState.distance *= 1 + e.deltaY * 0.001 * CAM_ZOOM_SPEED;
  camState.distance = Math.max(CAM_MIN_DISTANCE, Math.min(CAM_MAX_DISTANCE, camState.distance));
  updateCamera();
}

export function setPlanetClickCallback(cb: (planetId: string) => void): void { onPlanetClick = cb; }
export function getCameraState(): CameraState { return { ...camState }; }

// ============================================================
// Main render loop
// ============================================================

export function syncVisuals(state: GameState, time: number): void {
  for (const planet of state.planets) updatePlanet(planet);

  animateSelection(time);
  animateRoutes(time);

  for (const missile of state.missiles) updateMissilePosition(missile);

  for (const mesh of planetMeshes.values()) mesh.rotation.y += 0.003;

  updateHTMLHUD(state);

  renderer.render(scene, camera);
}

export function getRenderer(): THREE.WebGLRenderer { return renderer; }

export function dispose(): void {
  renderer.dispose();
  if (hudElement && hudElement.parentNode) hudElement.parentNode.removeChild(hudElement);
}
