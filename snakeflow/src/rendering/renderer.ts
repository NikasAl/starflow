// ============================================================
// SnakeFlow — Main Renderer
// Scene, camera, grid, lighting, input handling
// ============================================================

import * as THREE from 'three';
import { type CameraState, type Snake, type Vec3I, DIR_VECTORS } from '../core/types';
import { cellToWorld, inBounds } from '../core/spatial';
import {
  BACKGROUND_COLOR, GRID_COLOR, GRID_OPACITY,
  GRID_PLANE_COLOR, GRID_PLANE_OPACITY,
  AMBIENT_LIGHT_INTENSITY, DIRECTIONAL_LIGHT_INTENSITY, FILL_LIGHT_INTENSITY,
  CAM_DEFAULT_DISTANCE, CAM_DEFAULT_THETA, CAM_DEFAULT_PHI,
  CAM_MIN_DISTANCE, CAM_MAX_DISTANCE, CAM_ZOOM_SPEED,
  CAM_LERP_SPEED, SHAKE_DURATION,
} from '../core/constants';
import { createSnakeVisual, updateSnakePositions, setSnakeHover, applyStuckShake, disposeSnakeVisual, type SnakeVisual } from './snake-renderer';
import { spawnFreeParticles, spawnCollisionSparks, updateParticles, disposeAllParticles } from './particles';

// ============================================================
// Globals
// ============================================================

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let gridGroup: THREE.Group;
let bgStarsPoints: THREE.Points;

const camState: CameraState = {
  targetX: 0, targetY: 0, targetZ: 0,
  theta: CAM_DEFAULT_THETA,
  phi: CAM_DEFAULT_PHI,
  distance: CAM_DEFAULT_DISTANCE,
};

// Smooth camera target (for animations)
let smoothTarget = {
  targetX: 0, targetY: 0, targetZ: 0,
  distance: CAM_DEFAULT_DISTANCE,
  theta: CAM_DEFAULT_THETA,
  phi: CAM_DEFAULT_PHI,
  active: false,
};

// Mouse/touch drag state
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartTheta = 0;
let dragStartPhi = 0;
let dragStartTargetX = 0;
let dragStartTargetZ = 0;
let mouseDownTime = 0;
let isPinching = false;
let pinchStartDistance = 0;
let pinchStartCamDistance = 0;
let suppressPointer = false;

// Raycasting
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Snake visuals storage
const snakeVisuals = new Map<string, SnakeVisual>();

// Hover state
let hoveredSnakeId: string | null = null;

// Callbacks
let onSnakeClick: ((snakeId: string) => void) | null = null;

// HUD element
let hudElement: HTMLDivElement;

// Overlay element
let overlayElement: HTMLDivElement | null = null;

// Menu callbacks
let onRestart: (() => void) | null = null;
let onUndo: (() => void) | null = null;
let onPrevLevel: (() => void) | null = null;
let onNextLevel: (() => void) | null = null;
let menuOpen = false;
let menuElement: HTMLDivElement | null = null;
let menuButton: HTMLButtonElement | null = null;

// ============================================================
// Initialization
// ============================================================

export function initRenderer(canvas: HTMLCanvasElement): void {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND_COLOR);

  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
  updateCamera();

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Lighting — warm and bright for toy-like look
  scene.add(new THREE.AmbientLight(0xffffff, AMBIENT_LIGHT_INTENSITY));

  const mainLight = new THREE.DirectionalLight(0xfff5e0, DIRECTIONAL_LIGHT_INTENSITY);
  mainLight.position.set(20, 30, 15);
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0xaaccff, FILL_LIGHT_INTENSITY);
  fillLight.position.set(-15, 20, -10);
  scene.add(fillLight);

  // Subtle bottom fill
  const bottomLight = new THREE.HemisphereLight(0x8899bb, 0x443322, 0.3);
  scene.add(bottomLight);

  // Background stars
  createBgStars();

  // Grid placeholder (rebuilt per level)
  gridGroup = new THREE.Group();
  scene.add(gridGroup);

  // HUD
  createHTMLHUD();
  createMenuButton();

  // Input events
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

function createBgStars(): void {
  const count = 800;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 60 + Math.random() * 100;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);

    // Warm star colors
    const warmth = 0.7 + Math.random() * 0.3;
    colors[i * 3] = warmth;
    colors[i * 3 + 1] = warmth * (0.85 + Math.random() * 0.15);
    colors[i * 3 + 2] = 0.8 + Math.random() * 0.2;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  bgStarsPoints = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    sizeAttenuation: true,
  }));
  scene.add(bgStarsPoints);
}

// ============================================================
// Grid Rendering
// ============================================================

export function buildGrid(gridSize: Vec3I): void {
  // Clear old grid
  gridGroup.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
      if (child.geometry) child.geometry.dispose();
      if (child.material instanceof THREE.Material) child.material.dispose();
    }
  });
  gridGroup.clear();

  const { x: gx, y: gy, z: gz } = gridSize;

  // --- Wireframe grid edges ---
  const edgesMaterial = new THREE.LineBasicMaterial({
    color: GRID_COLOR,
    transparent: true,
    opacity: GRID_OPACITY,
  });

  // Build edge lines for each cell
  const edgePositions: number[] = [];
  const step = 1.0;

  for (let ix = 0; ix < gx; ix++) {
    for (let iy = 0; iy < gy; iy++) {
      for (let iz = 0; iz < gz; iz++) {
        const wx = ix - (gx - 1) / 2 - 0.5;
        const wy = iy - (gy - 1) / 2 - 0.5;
        const wz = iz - (gz - 1) / 2 - 0.5;

        // 12 edges of a cube
        const corners = [
          [wx, wy, wz], [wx + step, wy, wz],
          [wx, wy + step, wz], [wx + step, wy + step, wz],
          [wx, wy, wz + step], [wx + step, wy, wz + step],
          [wx, wy + step, wz + step], [wx + step, wy + step, wz + step],
        ];

        const edgePairs = [
          [0, 1], [2, 3], [4, 5], [6, 7], // along X
          [0, 2], [1, 3], [4, 6], [5, 7], // along Y
          [0, 4], [1, 5], [2, 6], [3, 7], // along Z
        ];

        for (const [a, b] of edgePairs) {
          // Only draw edges on the boundary faces to avoid visual clutter
          // Always draw if on outer boundary, otherwise skip internal shared edges
          const isBoundaryX = (ix === 0 || ix === gx - 1);
          const isBoundaryY = (iy === 0 || iy === gy - 1);
          const isBoundaryZ = (iz === 0 || iz === gz - 1);

          // For cleaner look, draw all edges but make internal ones dimmer
          edgePositions.push(
            corners[a][0], corners[a][1], corners[a][2],
            corners[b][0], corners[b][1], corners[b][2],
          );
        }
      }
    }
  }

  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
  const edgeLines = new THREE.LineSegments(edgeGeo, edgesMaterial);
  gridGroup.add(edgeLines);

  // --- Semi-transparent floor plane ---
  const planeSize = Math.max(gx, gy, gz) + 1;
  const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
  const planeMat = new THREE.MeshBasicMaterial({
    color: GRID_PLANE_COLOR,
    transparent: true,
    opacity: GRID_PLANE_OPACITY,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -(gy - 1) / 2 - 0.51;
  gridGroup.add(plane);

  // --- Axis indicators (small colored lines at corner) ---
  const axisLen = 0.8;
  const axisOrigin = new THREE.Vector3(-(gx - 1) / 2 - 0.8, -(gy - 1) / 2 - 0.8, -(gz - 1) / 2 - 0.8);

  const axisColors = [0xff4444, 0x44ff44, 0x4488ff]; // X=red, Y=green, Z=blue
  const axisDirs = [
    new THREE.Vector3(axisLen, 0, 0),
    new THREE.Vector3(0, axisLen, 0),
    new THREE.Vector3(0, 0, axisLen),
  ];

  for (let i = 0; i < 3; i++) {
    const axisGeo = new THREE.BufferGeometry().setFromPoints([
      axisOrigin.clone(),
      axisOrigin.clone().add(axisDirs[i]),
    ]);
    const axisMat = new THREE.LineBasicMaterial({ color: axisColors[i], linewidth: 2 });
    gridGroup.add(new THREE.Line(axisGeo, axisMat));
  }

  // Center camera target on grid center
  camState.targetX = 0;
  camState.targetY = 0;
  camState.targetZ = 0;

  // Adjust camera distance based on grid size
  const maxDim = Math.max(gx, gy, gz);
  camState.distance = Math.max(CAM_MIN_DISTANCE, maxDim * 2.5);
  camState.distance = Math.min(CAM_MAX_DISTANCE, camState.distance);

  smoothTarget = {
    targetX: 0, targetY: 0, targetZ: 0,
    distance: camState.distance,
    theta: CAM_DEFAULT_THETA,
    phi: CAM_DEFAULT_PHI,
    active: true,
  };
}

// ============================================================
// Camera
// ============================================================

function updateCamera(): void {
  const st = smoothTarget.active ? smoothTarget : camState;
  const d = st.distance;
  const theta = st.theta;
  const phi = st.phi;

  camera.position.set(
    st.targetX + d * Math.sin(phi) * Math.cos(theta),
    st.targetY + d * Math.cos(phi),
    st.targetZ + d * Math.sin(phi) * Math.sin(theta),
  );
  camera.lookAt(st.targetX, st.targetY, st.targetZ);
}

export function animateCamera(dt: number): void {
  if (!smoothTarget.active) return;

  const lerp = 1 - Math.exp(-CAM_LERP_SPEED * dt);
  camState.distance += (smoothTarget.distance - camState.distance) * lerp;
  camState.theta += (smoothTarget.theta - camState.theta) * lerp;
  camState.phi += (smoothTarget.phi - camState.phi) * lerp;
  camState.targetX += (smoothTarget.targetX - camState.targetX) * lerp;
  camState.targetY += (smoothTarget.targetY - camState.targetY) * lerp;
  camState.targetZ += (smoothTarget.targetZ - camState.targetZ) * lerp;

  // Deactivate smooth when close enough
  const distDiff = Math.abs(camState.distance - smoothTarget.distance);
  const angleDiff = Math.abs(camState.theta - smoothTarget.theta) + Math.abs(camState.phi - smoothTarget.phi);
  if (distDiff < 0.01 && angleDiff < 0.005) {
    smoothTarget.active = false;
  }

  updateCamera();
}

// ============================================================
// Snake Visual Management
// ============================================================

export function addSnakeVisual(snake: Snake, gridSize: Vec3I): void {
  if (snakeVisuals.has(snake.id)) return;
  const visual = createSnakeVisual(snake, gridSize);
  scene.add(visual.group);
  snakeVisuals.set(snake.id, visual);
}

export function removeSnakeVisual(snakeId: string): void {
  const visual = snakeVisuals.get(snakeId);
  if (!visual) return;
  scene.remove(visual.group);
  disposeSnakeVisual(visual);
  snakeVisuals.delete(snakeId);
}

export function syncSnakeVisuals(snakes: Snake[], gridSize: Vec3I): void {
  // Remove visuals for freed snakes
  for (const [id, visual] of snakeVisuals) {
    const snake = snakes.find(s => s.id === id);
    if (!snake || snake.freed) {
      // Don't remove immediately — will be handled by events
    }
  }
}

export function updateAllSnakeVisuals(snakes: Snake[], gridSize: Vec3I): void {
  for (const snake of snakes) {
    const visual = snakeVisuals.get(snake.id);
    if (!visual) continue;

    updateSnakePositions(visual, snake, gridSize);

    // Stuck shake
    if (snake.stuck && snake.stuckTimer < SHAKE_DURATION) {
      applyStuckShake(visual, snake.stuckTimer, SHAKE_DURATION);
    } else if (snake.stuckTimer >= SHAKE_DURATION) {
      visual.group.position.set(0, 0, 0);
    }

    // Hover
    const isHovered = hoveredSnakeId === snake.id;
    const canClick = !snake.freed && !snake.isMoving;
    setSnakeHover(visual, isHovered && canClick);
  }
}

// ============================================================
// Input Handling
// ============================================================

function onPointerDown(e: PointerEvent): void {
  if (suppressPointer) return;
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
  if (suppressPointer) return;

  // Hover detection
  updateHover(e.clientX, e.clientY);

  if (isPinching) return;

  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 5) {
    isDragging = true;
    smoothTarget.active = false;

    // Orbit camera
    camState.theta = dragStartTheta - dx * 0.008;
    camState.phi = Math.max(0.15, Math.min(Math.PI / 2 - 0.1, dragStartPhi + dy * 0.008));
    updateCamera();
  }
}

function onPointerUp(e: PointerEvent): void {
  if (suppressPointer) return;
  const elapsed = performance.now() - mouseDownTime;

  if (!isDragging && elapsed < 350) {
    handleClick(e.clientX, e.clientY);
  }
  isDragging = false;
}

function handleClick(clientX: number, clientY: number): void {
  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // Collect all snake head meshes
  const targets: THREE.Object3D[] = [];
  for (const [, visual] of snakeVisuals) {
    if (visual.group.visible) {
      targets.push(visual.headMesh);
    }
  }

  const intersects = raycaster.intersectObjects(targets, false);

  if (intersects.length > 0) {
    const hitMesh = intersects[0].object;
    // Find snake by traversing up to group
    let obj: THREE.Object3D | null = hitMesh;
    while (obj && !obj.userData.snakeId) {
      obj = obj.parent;
    }
    if (obj && obj.userData.snakeId) {
      if (onSnakeClick) onSnakeClick(obj.userData.snakeId);
    }
  }
}

function updateHover(clientX: number, clientY: number): void {
  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const targets: THREE.Object3D[] = [];
  for (const [, visual] of snakeVisuals) {
    if (visual.group.visible) targets.push(visual.headMesh);
  }

  const intersects = raycaster.intersectObjects(targets, false);

  let newHovered: string | null = null;
  if (intersects.length > 0) {
    let obj: THREE.Object3D | null = intersects[0].object;
    while (obj && !obj.userData.snakeId) {
      obj = obj.parent;
    }
    if (obj?.userData.snakeId) {
      newHovered = obj.userData.snakeId;
    }
  }

  if (newHovered !== hoveredSnakeId) {
    hoveredSnakeId = newHovered;
  }
}

// Touch gestures
function onTouchStart(e: TouchEvent): void {
  if (e.touches.length === 2) {
    isPinching = true;
    suppressPointer = true;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    pinchStartDistance = Math.sqrt(dx * dx + dy * dy);
    pinchStartCamDistance = camState.distance;
    e.preventDefault();
  }
}

function onTouchMove(e: TouchEvent): void {
  if (isPinching && e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const ratio = pinchStartDistance / Math.max(1, dist);
    camState.distance = Math.max(CAM_MIN_DISTANCE, Math.min(CAM_MAX_DISTANCE, pinchStartCamDistance * ratio));
    smoothTarget.active = false;
    updateCamera();
    e.preventDefault();
  }
}

function onTouchEnd(_e: TouchEvent): void {
  if (isPinching) {
    isPinching = false;
    suppressPointer = true;
    // Suppress for a short time to prevent accidental click after pinch
    setTimeout(() => { suppressPointer = false; }, 300);
  }
}

function onWheel(e: WheelEvent): void {
  e.preventDefault();
  camState.distance += e.deltaY * 0.001 * CAM_ZOOM_SPEED;
  camState.distance = Math.max(CAM_MIN_DISTANCE, Math.min(CAM_MAX_DISTANCE, camState.distance));
  smoothTarget.active = false;
  updateCamera();
}

function onResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ============================================================
// HTML HUD
// ============================================================

function createHTMLHUD(): void {
  hudElement = document.createElement('div');
  hudElement.id = 'game-hud';
  hudElement.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; z-index: 100;
    pointer-events: none; font-family: 'Segoe UI', Arial, sans-serif;
    color: #fff; user-select: none; padding: 16px;
  `;
  document.body.appendChild(hudElement);

  // Event delegation
  hudElement.addEventListener('click', (e: Event) => {
    const target = (e.target as HTMLElement).closest('[data-action]');
    if (!target) return;
    const action = target.getAttribute('data-action');
    if (action === 'undo' && onUndo) onUndo();
    else if (action === 'restart' && onRestart) onRestart();
    else if (action === 'prev-level' && onPrevLevel) onPrevLevel();
    else if (action === 'next-level' && onNextLevel) onNextLevel();
  });
  hudElement.addEventListener('touchend', (e: Event) => {
    const target = (e.target as HTMLElement).closest('[data-action]');
    if (!target) return;
    e.preventDefault();
    const action = target.getAttribute('data-action');
    if (action === 'undo' && onUndo) onUndo();
    else if (action === 'restart' && onRestart) onRestart();
    else if (action === 'prev-level' && onPrevLevel) onPrevLevel();
    else if (action === 'next-level' && onNextLevel) onNextLevel();
  });
}

let lastHudHash = '';

export function updateHUD(
  freedCount: number, totalSnakes: number,
  moveCount: number, levelIndex: number, totalLevels: number,
  phase: string,
): void {
  const hash = `${freedCount}/${totalSnakes}/${moveCount}/${levelIndex}/${phase}`;
  if (hash === lastHudHash) return;
  lastHudHash = hash;

  const isComplete = phase === 'complete';
  const isStuck = phase === 'stuck';

  hudElement.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
      <div>
        <div style="font-size:28px; font-weight:700; text-shadow: 0 2px 8px rgba(0,0,0,0.6); margin-bottom:4px;">
          ${isComplete ? '&#127942;' : isStuck ? '&#128560;' : '&#128013;'} SnakeFlow
        </div>
        <div style="font-size:16px; color:rgba(255,255,255,0.8); margin-bottom:8px;">
          Уровень ${levelIndex + 1} / ${totalLevels}
        </div>
        <div style="font-size:20px; font-weight:600; margin-bottom:12px; ${isComplete ? 'color:#44ff88;' : isStuck ? 'color:#ff6644;' : 'color:#ffcc44;'}">
          Освобождено: ${freedCount} / ${totalSnakes}
        </div>
        <div style="font-size:13px; color:rgba(255,255,255,0.5);">
          Ходов: ${moveCount}
        </div>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px; pointer-events:auto;">
        <div data-action="undo" style="width:44px; height:44px; border-radius:10px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.15); color:#fff; font-size:22px; display:flex; align-items:center; justify-content:center; cursor:pointer; backdrop-filter:blur(4px); transition:background 0.2s;">&#8634;</div>
        <div data-action="restart" style="width:44px; height:44px; border-radius:10px; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.15); color:#fff; font-size:22px; display:flex; align-items:center; justify-content:center; cursor:pointer; backdrop-filter:blur(4px); transition:background 0.2s;">&#8635;</div>
      </div>
    </div>
    ${isStuck ? `
      <div style="margin-top:16px; padding:12px 16px; background:rgba(255,60,40,0.15); border:1px solid rgba(255,60,40,0.3); border-radius:10px; font-size:14px; color:#ff8866;">
        &#128560; Змейки заблокированы! Попробуйте отменить ходы или начать заново.
      </div>
    ` : ''}
    ${isComplete ? `
      <div style="margin-top:16px; text-align:center;">
        <div style="font-size:36px; font-weight:700; color:#44ff88; text-shadow:0 0 20px rgba(68,255,136,0.5); margin-bottom:8px;">
          &#127881; Уровень пройден!
        </div>
        <div style="font-size:14px; color:rgba(255,255,255,0.6); margin-bottom:16px;">
          Ходов: ${moveCount}
        </div>
        <div style="display:flex; gap:12px; justify-content:center;">
          <div data-action="prev-level" style="padding:10px 24px; border-radius:50px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.25); color:#fff; font-size:14px; cursor:pointer; pointer-events:auto; backdrop-filter:blur(4px);">Назад</div>
          <div data-action="next-level" style="padding:10px 24px; border-radius:50px; background:rgba(68,255,136,0.15); border:1px solid rgba(68,255,136,0.4); color:#44ff88; font-size:14px; font-weight:600; cursor:pointer; pointer-events:auto; backdrop-filter:blur(4px);">Далее &#8594;</div>
        </div>
      </div>
    ` : ''}
  `;
}

// ============================================================
// Menu Button
// ============================================================

function createMenuButton(): void {
  menuButton = document.createElement('button');
  menuButton.style.cssText = `
    position:fixed; top:16px; right:16px; z-index:150;
    width:44px; height:44px; border-radius:10px;
    background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.15);
    backdrop-filter:blur(4px); color:#fff; font-size:22px;
    cursor:pointer; display:flex; align-items:center; justify-content:center;
    padding:0; transition:background 0.2s;
  `;
  menuButton.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';
  document.body.appendChild(menuButton);
  menuButton.addEventListener('click', toggleMenu);
  menuButton.addEventListener('touchend', (e) => { e.preventDefault(); toggleMenu(); });
}

function toggleMenu(): void {
  menuOpen = !menuOpen;
  if (menuOpen) showMenu();
  else hideMenu();
}

function showMenu(): void {
  hideMenu();
  menuElement = document.createElement('div');
  menuElement.style.cssText = `
    position:fixed; top:66px; right:16px; z-index:150;
    min-width:180px; background:rgba(10,10,30,0.92);
    backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.12);
    border-radius:10px; padding:6px 0;
    font-family:'Segoe UI',Arial,sans-serif; color:#fff;
    animation:fadeIn 0.15s ease;
  `;

  const items = [
    { label: 'Отменить ход', action: 'undo' },
    { label: 'Начать заново', action: 'restart' },
    { label: 'Предыдущий уровень', action: 'prev-level' },
    { label: 'Следующий уровень', action: 'next-level' },
  ];

  for (const item of items) {
    const row = document.createElement('div');
    row.textContent = item.label;
    row.setAttribute('data-action', item.action);
    row.style.cssText = `
      padding:10px 18px; cursor:pointer; font-size:14px;
      color:rgba(255,255,255,0.85); transition:background 0.15s;
    `;
    row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,0.08)'; });
    row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
    row.addEventListener('click', () => {
      hideMenu();
      handleMenuAction(item.action);
    });
    row.addEventListener('touchend', (e) => {
      e.preventDefault();
      hideMenu();
      handleMenuAction(item.action);
    });
    menuElement.appendChild(row);
  }

  document.body.appendChild(menuElement);
}

function hideMenu(): void {
  if (menuElement?.parentNode) {
    menuElement.parentNode.removeChild(menuElement);
    menuElement = null;
  }
  menuOpen = false;
}

function handleMenuAction(action: string): void {
  if (action === 'undo' && onUndo) onUndo();
  else if (action === 'restart' && onRestart) onRestart();
  else if (action === 'prev-level' && onPrevLevel) onPrevLevel();
  else if (action === 'next-level' && onNextLevel) onNextLevel();
}

// ============================================================
// Overlay (for messages)
// ============================================================

export function showOverlay(html: string): void {
  removeOverlay();
  overlayElement = document.createElement('div');
  overlayElement.style.cssText = `
    position:fixed; top:0; left:0; width:100%; height:100%; z-index:200;
    display:flex; align-items:center; justify-content:center;
    background:rgba(0,0,0,0.5); animation:fadeIn 0.3s ease;
    pointer-events:auto;
  `;
  overlayElement.innerHTML = html;
  document.body.appendChild(overlayElement);
}

export function removeOverlay(): void {
  if (overlayElement?.parentNode) {
    overlayElement.parentNode.removeChild(overlayElement);
    overlayElement = null;
  }
}

// ============================================================
// Callbacks
// ============================================================

export function setOnSnakeClick(cb: (snakeId: string) => void): void { onSnakeClick = cb; }
export function setOnRestart(cb: () => void): void { onRestart = cb; }
export function setOnUndo(cb: () => void): void { onUndo = cb; }
export function setOnPrevLevel(cb: () => void): void { onPrevLevel = cb; }
export function setOnNextLevel(cb: () => void): void { onNextLevel = cb; }

// ============================================================
// Frame rendering
// ============================================================

export function renderFrame(): void {
  renderer.render(scene, camera);
}

/** Get scene reference for particle spawning */
export function getScene(): THREE.Scene {
  return scene;
}

/** Clear all snake visuals */
export function clearSnakeVisuals(): void {
  for (const [id, visual] of snakeVisuals) {
    scene.remove(visual.group);
    disposeSnakeVisual(visual);
  }
  snakeVisuals.clear();
}

/** Full dispose */
export function disposeAll(): void {
  clearSnakeVisuals();
  disposeAllParticles(scene);
  gridGroup.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
      if (child.geometry) child.geometry.dispose();
      if (child.material instanceof THREE.Material) child.material.dispose();
    }
  });
  if (hudElement?.parentNode) hudElement.parentNode.removeChild(hudElement);
  if (overlayElement?.parentNode) overlayElement.parentNode.removeChild(overlayElement);
  if (menuButton?.parentNode) menuButton.parentNode.removeChild(menuButton);
  hideMenu();
  renderer.dispose();
}
