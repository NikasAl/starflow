// ============================================================
// Star Flow Command — 3D Renderer (Three.js)
// ============================================================

import * as THREE from 'three';
import {
  type GameState, type PlanetData, type FleetData, type StreamData,
  type CameraState, type OwnerId,
  OWNER_COLORS, OWNER_NAMES,
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
// Scene setup
// ============================================================

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;

// Planet meshes keyed by planet id
const planetMeshes = new Map<string, THREE.Mesh>();
// Planet glow rings keyed by id
const planetGlows = new Map<string, THREE.Mesh>();
// Selection ring
let selectionRing: THREE.Mesh | null = null;
// Ship sprites for fleets
const fleetSprites = new Map<string, THREE.Group>();
// Stream particles
const streamGroups = new Map<string, THREE.Points>();

// Ship count labels (sprite text)
const planetLabels = new Map<string, THREE.Sprite>();

// Camera state
const camState: CameraState = {
  targetX: 0,
  targetZ: 0,
  theta: CAM_DEFAULT_THETA,
  phi: CAM_DEFAULT_PHI,
  distance: CAM_DEFAULT_DISTANCE,
};

// Drag state
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartTheta = 0;
let dragStartPhi = 0;
let dragStartTargetX = 0;
let dragStartTargetZ = 0;
let mouseDownTime = 0;

// HUD canvas
let hudCanvas: HTMLCanvasElement;
let hudCtx: CanvasRenderingContext2D;
let hudTexture: THREE.CanvasTexture;
let hudSprite: THREE.Sprite;

// Click callback
let onPlanetClick: ((planetId: string) => void) | null = null;

// Raycaster
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

/** Initialize the Three.js scene */
export function initRenderer(canvas: HTMLCanvasElement): void {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND_COLOR);

  // Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
  updateCamera();

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, AMBIENT_LIGHT);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffffff, DIRECTIONAL_LIGHT);
  dirLight.position.set(30, 50, 20);
  scene.add(dirLight);

  const dirLight2 = new THREE.DirectionalLight(0x4466aa, 0.3);
  dirLight2.position.set(-20, 30, -10);
  scene.add(dirLight2);

  // Star field background
  createStarField();

  // Grid plane (subtle reference grid)
  createGrid();

  // HUD
  createHUD();

  // Events
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('resize', onResize);
}

function createStarField(): void {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);

  for (let i = 0; i < STAR_COUNT; i++) {
    const r = 150 + Math.random() * 200;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    sizes[i] = 0.5 + Math.random() * 1.5;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.8,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.8,
  });

  scene.add(new THREE.Points(geometry, material));
}

function createGrid(): void {
  const gridHelper = new THREE.GridHelper(200, 40, 0x1a1a3a, 0x0d0d2a);
  gridHelper.position.y = -1;
  (gridHelper.material as THREE.Material).transparent = true;
  (gridHelper.material as THREE.Material).opacity = 0.3;
  scene.add(gridHelper);
}

function createHUD(): void {
  hudCanvas = document.createElement('canvas');
  hudCanvas.width = 512;
  hudCanvas.height = 256;
  hudCtx = hudCanvas.getContext('2d')!;
  hudTexture = new THREE.CanvasTexture(hudCanvas);
  hudTexture.minFilter = THREE.LinearFilter;

  const hudMaterial = new THREE.SpriteMaterial({
    map: hudTexture,
    transparent: true,
    depthTest: false,
  });
  hudSprite = new THREE.Sprite(hudMaterial);
  hudSprite.scale.set(40, 20, 1);
  hudSprite.position.set(0, 30, -30);
  scene.add(hudSprite);
}

// ============================================================
// Planet rendering
// ============================================================

/** Create a 3D mesh for a planet */
export function addPlanet(planet: PlanetData): void {
  // Main sphere
  const geometry = new THREE.SphereGeometry(Math.max(0.1, planet.radius), 32, 24);
  const color = OWNER_COLORS[planet.owner];

  const material = new THREE.MeshPhongMaterial({
    color,
    shininess: 60,
    emissive: color,
    emissiveIntensity: 0.15,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(planet.x, planet.y, planet.z);
  mesh.userData = { planetId: planet.id };
  scene.add(mesh);
  planetMeshes.set(planet.id, mesh);

  // Glow ring around planet
  const glowGeometry = new THREE.RingGeometry(
    Math.max(0.1, planet.radius * 1.1),
    Math.max(0.2, planet.radius * 1.3),
    32,
  );
  const glowMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  glow.position.set(planet.x, planet.y + 0.05, planet.z);
  glow.rotation.x = -Math.PI / 2;
  scene.add(glow);
  planetGlows.set(planet.id, glow);

  // Ship count label
  addPlanetLabel(planet);
}

function addPlanetLabel(planet: PlanetData): void {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  drawPlanetLabel(ctx, planet);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(6, 3, 1);
  sprite.position.set(planet.x, planet.radius + 1.5, planet.z);
  scene.add(sprite);
  planetLabels.set(planet.id, sprite);
}

function drawPlanetLabel(ctx: CanvasRenderingContext2D, planet: PlanetData): void {
  ctx.clearRect(0, 0, 128, 64);
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';

  const colorHex = '#' + OWNER_COLORS[planet.owner].toString(16).padStart(6, '0');
  ctx.fillStyle = colorHex;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  const text = String(Math.floor(planet.ships));
  ctx.strokeText(text, 64, 40);
  ctx.fillText(text, 64, 40);
}

/** Update a planet mesh (owner color change, ship count) */
export function updatePlanet(planet: PlanetData): void {
  const mesh = planetMeshes.get(planet.id);
  if (!mesh) return;

  const color = OWNER_COLORS[planet.owner];
  (mesh.material as THREE.MeshPhongMaterial).color.setHex(color);
  (mesh.material as THREE.MeshPhongMaterial).emissive.setHex(color);

  const glow = planetGlows.get(planet.id);
  if (glow) {
    (glow.material as THREE.MeshBasicMaterial).color.setHex(color);
  }

  // Update label
  const sprite = planetLabels.get(planet.id);
  if (sprite) {
    const canvas = (sprite.material as THREE.SpriteMaterial).map!.image as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    drawPlanetLabel(ctx, planet);
    (sprite.material as THREE.SpriteMaterial).map!.needsUpdate = true;
  }
}

/** Remove a planet mesh from the scene */
export function removePlanet(id: string): void {
  const mesh = planetMeshes.get(id);
  if (mesh) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
    planetMeshes.delete(id);
  }
  const glow = planetGlows.get(id);
  if (glow) {
    scene.remove(glow);
    glow.geometry.dispose();
    (glow.material as THREE.Material).dispose();
    planetGlows.delete(id);
  }
  const label = planetLabels.get(id);
  if (label) {
    scene.remove(label);
    (label.material as THREE.SpriteMaterial).map!.dispose();
    (label.material as THREE.SpriteMaterial).dispose();
    planetLabels.delete(id);
  }
}

// ============================================================
// Selection ring
// ============================================================

export function updateSelection(planetId: string | null): void {
  // Remove old ring
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
  const ringRadius = radius * SELECTION_RING_RADIUS_MULTIPLIER;

  const geometry = new THREE.RingGeometry(
    Math.max(0.1, ringRadius),
    Math.max(0.2, ringRadius + 0.2),
    32,
  );
  const material = new THREE.MeshBasicMaterial({
    color: SELECTION_RING_COLOR,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  });

  selectionRing = new THREE.Mesh(geometry, material);
  selectionRing.position.copy(planet.position);
  selectionRing.position.y += 0.1;
  selectionRing.rotation.x = -Math.PI / 2;
  scene.add(selectionRing);
}

/** Animate selection ring (pulse) */
function animateSelection(time: number): void {
  if (!selectionRing) return;
  const scale = 1.0 + Math.sin(time * 4) * 0.1;
  selectionRing.scale.set(scale, scale, 1);
  (selectionRing.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(time * 3) * 0.3;
}

// ============================================================
// Fleet and Stream rendering
// ============================================================

export function addFleet(fleet: FleetData): void {
  const group = new THREE.Group();
  group.userData = { fleetId: fleet.id };

  // Central sphere for fleet
  const geom = new THREE.SphereGeometry(0.5, 12, 8);
  const mat = new THREE.MeshPhongMaterial({
    color: OWNER_COLORS[fleet.owner],
    emissive: OWNER_COLORS[fleet.owner],
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.9,
  });
  const sphere = new THREE.Mesh(geom, mat);
  group.add(sphere);

  // Glow
  const glowGeom = new THREE.SphereGeometry(0.9, 12, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    color: OWNER_COLORS[fleet.owner],
    transparent: true,
    opacity: 0.15,
  });
  group.add(new THREE.Mesh(glowGeom, glowMat));

  group.position.set(fleet.x, fleet.y, fleet.z);
  scene.add(group);
  fleetSprites.set(fleet.id, group);

  // Fleet label
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 64;
  labelCanvas.height = 32;
  const ctx = labelCanvas.getContext('2d')!;
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  const colorHex = '#' + OWNER_COLORS[fleet.owner].toString(16).padStart(6, '0');
  ctx.fillStyle = colorHex;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  const txt = String(fleet.ships);
  ctx.strokeText(txt, 32, 22);
  ctx.fillText(txt, 32, 22);

  const tex = new THREE.CanvasTexture(labelCanvas);
  const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const label = new THREE.Sprite(spriteMat);
  label.scale.set(3, 1.5, 1);
  label.position.y = 1.2;
  group.add(label);
}

export function updateFleetPosition(fleet: FleetData): void {
  const group = fleetSprites.get(fleet.id);
  if (group) {
    group.position.set(fleet.x, fleet.y, fleet.z);
  }
}

export function removeFleet(id: string): void {
  const group = fleetSprites.get(id);
  if (group) {
    scene.remove(group);
    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
      if (child instanceof THREE.Sprite) {
        (child.material as THREE.SpriteMaterial).map?.dispose();
        (child.material as THREE.SpriteMaterial).dispose();
      }
    });
    fleetSprites.delete(id);
  }
}

export function addStream(stream: StreamData): void {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(STREAM_PARTICLE_COUNT * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: OWNER_COLORS[stream.owner],
    size: STREAM_PARTICLE_SIZE,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);
  streamGroups.set(stream.id, points);
}

export function updateStream(stream: StreamData): void {
  const points = streamGroups.get(stream.id);
  if (!points) return;

  const positions = points.geometry.attributes.position.array as Float32Array;
  const count = STREAM_PARTICLE_COUNT;

  for (let i = 0; i < count; i++) {
    // Each particle at a different progress along the curve
    const t = Math.max(0, stream.progress - (i / count) * 0.3);
    if (t < 0) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -100;
      positions[i * 3 + 2] = 0;
      continue;
    }
    // Quadratic Bezier: B(t) = (1-t)^2*P0 + 2(1-t)t*P1 + t^2*P2
    const omt = 1 - t;
    positions[i * 3] = omt * omt * stream.sx + 2 * omt * t * stream.cx + t * t * stream.tx;
    positions[i * 3 + 1] = omt * omt * stream.sy + 2 * omt * t * stream.cy + t * t * stream.ty;
    positions[i * 3 + 2] = omt * omt * stream.sz + 2 * omt * t * stream.cz + t * t * stream.tz;
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
// HUD
// ============================================================

function updateHUD(state: GameState): void {
  const stats = getGameStats(state);
  const w = hudCanvas.width;
  const h = hudCanvas.height;

  hudCtx.clearRect(0, 0, w, h);

  // Semi-transparent background
  hudCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  hudCtx.roundRect(0, 0, w, h, 12);
  hudCtx.fill();

  hudCtx.font = 'bold 18px Arial';
  hudCtx.textAlign = 'left';
  hudCtx.fillStyle = '#ffffff';
  hudCtx.fillText(`Time: ${Math.floor(state.time)}s`, 16, 28);

  // Stats
  const entries: Array<{ name: string; color: string; stats: { planets: number; ships: number } }> = [];
  const owners: [number, string, number][] = [
    [0, 'Neutral', 0x888888],
    [1, 'You', 0x4488ff],
    [2, 'Crimson', 0xff4444],
    [3, 'Emerald', 0x44cc44],
  ];
  for (const [id, name, color] of owners) {
    const s = stats[id as OwnerId];
    if (s) {
      entries.push({ name, color: '#' + color.toString(16).padStart(6, '0'), stats: s });
    }
  }

  let y = 52;
  for (const entry of entries) {
    hudCtx.fillStyle = entry.color;
    hudCtx.fillRect(16, y - 14, 10, 10);
    hudCtx.fillStyle = '#ffffff';
    hudCtx.fillText(`${entry.name}: ${entry.stats.planets}p / ${entry.stats.ships}s`, 32, y);
    y += 22;
  }

  // Phase indicator
  if (state.phase === 'won') {
    hudCtx.font = 'bold 28px Arial';
    hudCtx.textAlign = 'center';
    hudCtx.fillStyle = '#00ff88';
    hudCtx.fillText('VICTORY!', w / 2, h - 16);
  } else if (state.phase === 'lost') {
    hudCtx.font = 'bold 28px Arial';
    hudCtx.textAlign = 'center';
    hudCtx.fillStyle = '#ff4444';
    hudCtx.fillText('DEFEAT', w / 2, h - 16);
  }

  // Selected planet hint
  if (state.selectedPlanetId) {
    const planet = state.planets.find(p => p.id === state.selectedPlanetId);
    if (planet) {
      hudCtx.font = '16px Arial';
      hudCtx.textAlign = 'center';
      hudCtx.fillStyle = SELECTION_RING_COLOR.toString(16).padStart(6, '0') ? '#00ff88' : '#ffffff';
      hudCtx.fillText(`Selected: ${planet.name} (${Math.floor(planet.ships)} ships) - Click target`, w / 2, h - 4);
    }
  }

  hudTexture.needsUpdate = true;
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
// Input handling
// ============================================================

function onPointerDown(e: PointerEvent): void {
  isDragging = false;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragStartTheta = camState.theta;
  dragStartPhi = camState.phi;
  dragStartTargetX = camState.targetX;
  dragStartTargetZ = camState.targetZ;
  mouseDownTime = performance.now();
}

function onPointerMove(e: PointerEvent): void {
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;

  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    isDragging = true;
  }

  if (!isDragging) return;

  if (e.buttons === 1) {
    // Left button: rotate + pan
    if (e.shiftKey) {
      // Pan
      const panScale = camState.distance * 0.003;
      camState.targetX = dragStartTargetX - dx * panScale * Math.cos(camState.theta) + dy * panScale * Math.sin(camState.theta);
      camState.targetZ = dragStartTargetZ - dx * panScale * Math.sin(camState.theta) - dy * panScale * Math.cos(camState.theta);
    } else {
      // Rotate
      camState.theta = dragStartTheta - dx * 0.005;
      camState.phi = Math.max(0.2, Math.min(Math.PI / 2 - 0.1, dragStartPhi + dy * 0.005));
    }
  }

  updateCamera();
}

function onPointerUp(e: PointerEvent): void {
  const elapsed = performance.now() - mouseDownTime;
  if (!isDragging && elapsed < 300) {
    // It was a click, not a drag
    handleClick(e);
  }
  isDragging = false;
}

function handleClick(e: PointerEvent): void {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // Check planet intersections
  const meshes = Array.from(planetMeshes.values());
  const intersects = raycaster.intersectObjects(meshes);

  if (intersects.length > 0) {
    const planetId = intersects[0].object.userData.planetId;
    if (planetId && onPlanetClick) {
      onPlanetClick(planetId);
    }
  } else {
    // Clicked empty space — deselect
    if (onPlanetClick) {
      onPlanetClick('__deselect__');
    }
  }
}

function onWheel(e: WheelEvent): void {
  e.preventDefault();
  camState.distance *= 1 + e.deltaY * 0.001 * CAM_ZOOM_SPEED;
  camState.distance = Math.max(CAM_MIN_DISTANCE, Math.min(CAM_MAX_DISTANCE, camState.distance));
  updateCamera();
}

export function setPlanetClickCallback(cb: (planetId: string) => void): void {
  onPlanetClick = cb;
}

export function getCameraState(): CameraState {
  return { ...camState };
}

// ============================================================
// Main render loop
// ============================================================

/** Sync all visuals with game state */
export function syncVisuals(state: GameState, time: number): void {
  // Update planet visuals
  for (const planet of state.planets) {
    updatePlanet(planet);
  }

  // Animate selection
  animateSelection(time);

  // Update fleet positions
  for (const fleet of state.fleets) {
    updateFleetPosition(fleet);
  }

  // Update streams
  for (const stream of state.streams) {
    updateStream(stream);
  }

  // Rotate planets slowly
  for (const mesh of planetMeshes.values()) {
    mesh.rotation.y += 0.003;
  }

  // Update HUD
  updateHUD(state);

  // Render
  renderer.render(scene, camera);
}

/** Get the renderer (for main loop) */
export function getRenderer(): THREE.WebGLRenderer {
  return renderer;
}

/** Dispose of everything */
export function dispose(): void {
  renderer.dispose();
}
