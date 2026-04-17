// ============================================================
// Star Flow Command — 3D Renderer (Three.js) + HTML HUD
// ============================================================

import * as THREE from 'three';
import {
  type GameState, type PlanetData, type FleetData, type StreamData,
  type CameraState, type ShipRoute, type OwnerId,
  OWNER_COLORS, OWNER_NAMES, planetPower,
  PLAYER,
} from '../core/types';
import {
  SELECTION_RING_COLOR, SELECTION_RING_RADIUS_MULTIPLIER,
  BACKGROUND_COLOR, STAR_COUNT, AMBIENT_LIGHT, DIRECTIONAL_LIGHT,
  CAM_DEFAULT_DISTANCE, CAM_DEFAULT_THETA, CAM_DEFAULT_PHI,
  CAM_MIN_DISTANCE, CAM_MAX_DISTANCE, CAM_ZOOM_SPEED,
  STREAM_PARTICLE_SIZE, STREAM_PARTICLE_COUNT,
} from '../core/constants';
import { getGameStats } from '../game/state';

// ============================================================
// Three.js scene globals
// ============================================================

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;

const planetMeshes = new Map<string, THREE.Mesh>();
const planetGlows = new Map<string, THREE.Mesh>();
let selectionRing: THREE.Mesh | null = null;
const fleetSprites = new Map<string, THREE.Group>();
const streamGroups = new Map<string, THREE.Points>();
const planetLabels = new Map<string, THREE.Sprite>();

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
    min-width: 200px;
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
        ${s.fighters}F+${s.cruisers}C
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
      html += `<div style="margin-top:8px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1); font-size:12px; color:#00ff88;">
        ${p.name}: ${Math.floor(p.fighters)}F + ${Math.floor(p.cruisers)}C<br>
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
  const geometry = new THREE.SphereGeometry(Math.max(0.1, planet.radius), 32, 24);
  const color = OWNER_COLORS[planet.owner];

  const material = new THREE.MeshPhongMaterial({
    color, shininess: 60, emissive: color, emissiveIntensity: 0.15,
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
    color, transparent: true, opacity: 0.3, side: THREE.DoubleSide,
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

  const f = Math.floor(planet.fighters);
  const c = Math.floor(planet.cruisers);

  // Two-line label: fighters on top, cruisers below
  ctx.font = 'bold 22px Arial';
  ctx.textAlign = 'center';

  const colorHex = '#' + OWNER_COLORS[planet.owner].toString(16).padStart(6, '0');

  // Fighters line
  ctx.fillStyle = '#66bbff';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeText(`${f}F`, 55, 28);
  ctx.fillText(`${f}F`, 55, 28);

  // Cruisers line
  ctx.fillStyle = '#ffaa44';
  ctx.strokeText(`${c}C`, 105, 28);
  ctx.fillText(`${c}C`, 105, 28);

  // Total power small
  const power = f + c * 2;
  ctx.font = '14px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeText(`pw:${power}`, 80, 50);
  ctx.fillText(`pw:${power}`, 80, 50);
}

export function updatePlanet(planet: PlanetData): void {
  const mesh = planetMeshes.get(planet.id);
  if (!mesh) return;

  const color = OWNER_COLORS[planet.owner];
  (mesh.material as THREE.MeshPhongMaterial).color.setHex(color);
  (mesh.material as THREE.MeshPhongMaterial).emissive.setHex(color);

  const glow = planetGlows.get(planet.id);
  if (glow) (glow.material as THREE.MeshBasicMaterial).color.setHex(color);

  const sprite = planetLabels.get(planet.id);
  if (sprite) {
    const canvas = (sprite.material as THREE.SpriteMaterial).map!.image as HTMLCanvasElement;
    drawPlanetLabel(canvas.getContext('2d')!, planet);
    (sprite.material as THREE.SpriteMaterial).map!.needsUpdate = true;
  }
}

export function removePlanet(id: string): void {
  const mesh = planetMeshes.get(id);
  if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); planetMeshes.delete(id); }
  const glow = planetGlows.get(id);
  if (glow) { scene.remove(glow); glow.geometry.dispose(); (glow.material as THREE.Material).dispose(); planetGlows.delete(id); }
  const label = planetLabels.get(id);
  if (label) { scene.remove(label); (label.material as THREE.SpriteMaterial).map!.dispose(); (label.material as THREE.SpriteMaterial).dispose(); planetLabels.delete(id); }
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
// Fleet and Stream rendering
// ============================================================

export function addFleet(fleet: FleetData): void {
  const group = new THREE.Group();
  group.userData = { fleetId: fleet.id };

  const color = OWNER_COLORS[fleet.owner];

  // Central sphere
  const geom = new THREE.SphereGeometry(0.5, 12, 8);
  group.add(new THREE.Mesh(geom, new THREE.MeshPhongMaterial({
    color, emissive: color, emissiveIntensity: 0.4, transparent: true, opacity: 0.9,
  })));

  // Glow
  group.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 12, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15 }),
  ));

  group.position.set(fleet.x, fleet.y, fleet.z);
  scene.add(group);
  fleetSprites.set(fleet.id, group);

  // Fleet label
  const lc = document.createElement('canvas');
  lc.width = 96;
  lc.height = 32;
  const ctx = lc.getContext('2d')!;
  const ch = '#' + color.toString(16).padStart(6, '0');

  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  // Fighters
  ctx.fillStyle = '#66bbff';
  ctx.strokeText(`${fleet.fighters}F`, 28, 20);
  ctx.fillText(`${fleet.fighters}F`, 28, 20);
  // Cruisers
  ctx.fillStyle = '#ffaa44';
  ctx.strokeText(`${fleet.cruisers}C`, 68, 20);
  ctx.fillText(`${fleet.cruisers}C`, 68, 20);

  const tex = new THREE.CanvasTexture(lc);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(4, 1.5, 1);
  sprite.position.y = 1.2;
  group.add(sprite);
}

export function updateFleetPosition(fleet: FleetData): void {
  const group = fleetSprites.get(fleet.id);
  if (group) group.position.set(fleet.x, fleet.y, fleet.z);
}

export function removeFleet(id: string): void {
  const group = fleetSprites.get(id);
  if (group) {
    scene.remove(group);
    group.traverse(child => {
      if (child instanceof THREE.Mesh) { child.geometry.dispose(); (child.material as THREE.Material).dispose(); }
      if (child instanceof THREE.Sprite) { (child.material as THREE.SpriteMaterial).map?.dispose(); (child.material as THREE.SpriteMaterial).dispose(); }
    });
    fleetSprites.delete(id);
  }
}

export function addStream(stream: StreamData): void {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAM_PARTICLE_COUNT * 3), 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    color: OWNER_COLORS[stream.owner], size: STREAM_PARTICLE_SIZE,
    transparent: true, opacity: 0.6, sizeAttenuation: true,
  })));
  // Find the just-added points
  const points = scene.children[scene.children.length - 1] as THREE.Points;
  streamGroups.set(stream.id, points);
}

export function updateStream(stream: StreamData): void {
  const points = streamGroups.get(stream.id);
  if (!points) return;
  const pos = points.geometry.attributes.position.array as Float32Array;

  for (let i = 0; i < STREAM_PARTICLE_COUNT; i++) {
    const t = Math.max(0, stream.progress - (i / STREAM_PARTICLE_COUNT) * 0.3);
    if (t < 0) { pos[i * 3] = 0; pos[i * 3 + 1] = -100; pos[i * 3 + 2] = 0; continue; }
    const omt = 1 - t;
    pos[i * 3] = omt * omt * stream.sx + 2 * omt * t * stream.cx + t * t * stream.tx;
    pos[i * 3 + 1] = omt * omt * stream.sy + 2 * omt * t * stream.cy + t * t * stream.ty;
    pos[i * 3 + 2] = omt * omt * stream.sz + 2 * omt * t * stream.cz + t * t * stream.tz;
  }
  points.geometry.attributes.position.needsUpdate = true;
}

export function removeStream(id: string): void {
  const points = streamGroups.get(id);
  if (points) {
    scene.remove(points);
    points.geometry.dispose();
    (points.material as THREE.Material).dispose();
    streamGroups.delete(id);
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

  for (const fleet of state.fleets) updateFleetPosition(fleet);
  for (const stream of state.streams) updateStream(stream);

  for (const mesh of planetMeshes.values()) mesh.rotation.y += 0.003;

  updateHTMLHUD(state);

  renderer.render(scene, camera);
}

export function getRenderer(): THREE.WebGLRenderer { return renderer; }

export function dispose(): void {
  renderer.dispose();
  if (hudElement && hudElement.parentNode) hudElement.parentNode.removeChild(hudElement);
}
