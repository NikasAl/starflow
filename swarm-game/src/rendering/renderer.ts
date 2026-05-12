// ============================================================
// Рой (Swarm) — Renderer
// Three.js scene, camera, InstancedMesh, bloom, input, HUD
// ============================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { GameState, InputState } from '../core/types.ts';
import {
  BOID_COUNT, BOID_MAX_SPEED,
  LEADER_MAX_TURN_RATE,
  STAR_COUNT, STAR_SHELL_MIN, STAR_SHELL_MAX,
  CAM_OFFSET_Y, CAM_OFFSET_Z, CAM_LERP, CAM_LOOK_AHEAD,
  BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD,
  WORLD_HALF_SIZE, SPATIAL_CELL_SIZE,
} from '../core/constants.ts';

// ============================================================
// Internal state (module-scoped)
// ============================================================

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let composer: EffectComposer;
let bloomPass: UnrealBloomPass;

let boidMesh: THREE.InstancedMesh;
let leaderMesh: THREE.Mesh;
let leaderLight: THREE.PointLight;

// Input
const input: InputState = { yaw: 0, pitch: 0, boost: false };
const keys = new Set<string>();

// HUD
let hudDiv: HTMLDivElement;
let fpsFrames = 0;
let fpsTime = 0;
let currentFps = 0;

// Reusable objects (avoid allocations in hot loop)
const _dummy = new THREE.Object3D();
const _up = new THREE.Vector3(0, 1, 0);
const _camTarget = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _leaderQuat = new THREE.Quaternion();
const _leaderDir = new THREE.Vector3();

// ============================================================
// Initialize the renderer
// ============================================================

export function initRenderer(canvas: HTMLCanvasElement): void {
  // --- Renderer ---
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // --- Scene ---
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020208);
  scene.fog = new THREE.FogExp2(0x020208, 0.003);

  // --- Camera ---
  camera = new THREE.PerspectiveCamera(
    65,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );

  // --- Post-processing (Bloom) ---
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    BLOOM_STRENGTH,
    BLOOM_RADIUS,
    BLOOM_THRESHOLD,
  );
  composer.addPass(bloomPass);

  // --- Lighting ---
  const ambient = new THREE.AmbientLight(0x111122, 0.8);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0x4466aa, 0.6);
  dirLight.position.set(20, 40, 30);
  scene.add(dirLight);

  const dirLight2 = new THREE.DirectionalLight(0x2244aa, 0.3);
  dirLight2.position.set(-30, -10, -20);
  scene.add(dirLight2);

  // --- Starfield ---
  createStarfield();

  // --- World boundary wireframe ---
  createWorldBounds();

  // --- Boid InstancedMesh ---
  createBoidMesh();

  // --- Leader mesh ---
  createLeaderMesh();

  // --- HUD ---
  createHUD();

  // --- Input handlers ---
  setupInput(canvas);

  // --- Resize handler ---
  window.addEventListener('resize', onResize);
}

// ============================================================
// Starfield background
// ============================================================

function createStarfield(): void {
  const count = STAR_COUNT;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Random point on a sphere shell
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = STAR_SHELL_MIN + Math.random() * (STAR_SHELL_MAX - STAR_SHELL_MIN);

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    sizes[i] = 0.3 + Math.random() * 0.7;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    color: 0xaabbff,
    size: 0.5,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.8,
  });

  scene.add(new THREE.Points(geometry, material));
}

// ============================================================
// World boundary wireframe box
// ============================================================

function createWorldBounds(): void {
  const size = WORLD_HALF_SIZE * 2;
  const geo = new THREE.BoxGeometry(size, size, size);
  const edges = new THREE.EdgesGeometry(geo);
  const mat = new THREE.LineBasicMaterial({
    color: 0x1a1a3a,
    transparent: true,
    opacity: 0.3,
  });
  const wireframe = new THREE.LineSegments(edges, mat);
  scene.add(wireframe);

  // Subtle grid on the XZ plane (floor reference)
  const gridHelper = new THREE.GridHelper(size, 20, 0x0a0a20, 0x0a0a15);
  gridHelper.position.y = -WORLD_HALF_SIZE;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.15;
  scene.add(gridHelper);
}

// ============================================================
// Boid InstancedMesh
// ============================================================

function createBoidMesh(): void {
  // Cone geometry — rocket/drone shape pointing along +Y (default up)
  const geometry = new THREE.ConeGeometry(0.12, 0.5, 4);
  geometry.rotateX(Math.PI); // flip so tip points -Y → we'll orient via quaternion

  const material = new THREE.MeshStandardMaterial({
    color: 0x44ddff,
    emissive: 0x22aadd,
    emissiveIntensity: 1.2,
    transparent: true,
    opacity: 0.9,
    metalness: 0.6,
    roughness: 0.3,
  });

  boidMesh = new THREE.InstancedMesh(geometry, material, BOID_COUNT);
  boidMesh.count = BOID_COUNT;
  boidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(boidMesh);
}

// ============================================================
// Leader mesh (slightly larger, brighter)
// ============================================================

function createLeaderMesh(): void {
  const geometry = new THREE.ConeGeometry(0.2, 0.8, 4);
  geometry.rotateX(Math.PI);

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x66eeff,
    emissiveIntensity: 2.0,
    transparent: true,
    opacity: 1.0,
    metalness: 0.8,
    roughness: 0.1,
  });

  leaderMesh = new THREE.Mesh(geometry, material);
  scene.add(leaderMesh);

  // Point light attached to leader for local illumination
  leaderLight = new THREE.PointLight(0x44ccff, 3, 20);
  leaderLight.distance = 25;
  scene.add(leaderLight);
}

// ============================================================
// HUD (HTML overlay)
// ============================================================

function createHUD(): void {
  hudDiv = document.createElement('div');
  hudDiv.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none;
    font-family: 'Segoe UI', system-ui, sans-serif;
    color: #88ccff;
    z-index: 10;
  `;
  hudDiv.innerHTML = `
    <div style="position:absolute; top:16px; left:20px; font-size:18px; font-weight:600; text-shadow: 0 0 8px rgba(68,204,255,0.5);">
      <span id="hud-title">Рой</span>
    </div>
    <div style="position:absolute; top:16px; left:80px; font-size:14px; opacity:0.8;">
      <span id="hud-count"></span>
    </div>
    <div style="position:absolute; top:16px; right:20px; font-size:13px; opacity:0.6;">
      <span id="hud-fps"></span>
    </div>
    <div style="position:absolute; bottom:20px; left:50%; transform:translateX(-50%); font-size:13px; opacity:0.4; text-align:center; line-height:1.6;">
      WASD — управление &nbsp;|&nbsp; Space — ускорение
    </div>
    <div style="position:absolute; bottom:50px; left:50%; transform:translateX(-50%); font-size:12px; opacity:0.3;" id="hud-speed"></div>
  `;
  document.body.appendChild(hudDiv);
}

// ============================================================
// Input handling
// ============================================================

function setupInput(canvas: HTMLCanvasElement): void {
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    // Prevent scrolling
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });

  // Prevent context menu on long press (mobile)
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function readInput(): InputState {
  input.yaw = 0;
  input.pitch = 0;

  if (keys.has('KeyA') || keys.has('ArrowLeft')) input.yaw = 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) input.yaw = -1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) input.pitch = 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) input.pitch = -1;
  input.boost = keys.has('Space');

  return input;
}

// ============================================================
// Sync visuals from game state
// ============================================================

export function syncVisuals(state: GameState, dt: number): void {
  const { boids, leader } = state;

  // --- Update boid instances ---
  for (let i = 0; i < boids.length; i++) {
    const boid = boids[i];
    if (boid.alive) {
      _dummy.position.set(boid.x, boid.y, boid.z);
      // Orient cone tip along velocity direction
      _leaderDir.set(boid.vx, boid.vy, boid.vz).normalize();
      _dummy.quaternion.setFromUnitVectors(_up, _leaderDir);
    } else {
      _dummy.position.set(0, -9999, 0);
    }
    _dummy.updateMatrix();
    boidMesh.setMatrixAt(i, _dummy.matrix);
  }
  boidMesh.instanceMatrix.needsUpdate = true;

  // --- Update leader mesh ---
  leaderMesh.position.set(leader.x, leader.y, leader.z);
  _leaderDir.set(leader.vx, leader.vy, leader.vz).normalize();
  leaderMesh.quaternion.setFromUnitVectors(_up, _leaderDir);

  // Leader light follows
  leaderLight.position.set(leader.x, leader.y, leader.z);

  // --- Camera follow ---
  // Desired position: behind and above leader in local space
  _leaderQuat.setFromUnitVectors(_up, _leaderDir);
  _camPos.set(0, CAM_OFFSET_Y, CAM_OFFSET_Z).applyQuaternion(_leaderQuat);
  _camPos.add(leaderMesh.position);

  // Smooth interpolation
  camera.position.lerp(_camPos, Math.min(CAM_LERP * dt, 1));

  // Look at point slightly ahead of leader
  _lookTarget.set(
    leader.x + leader.vx * CAM_LOOK_AHEAD * 0.2,
    leader.y + leader.vy * CAM_LOOK_AHEAD * 0.2,
    leader.z + leader.vz * CAM_LOOK_AHEAD * 0.2,
  );
  camera.lookAt(_lookTarget);

  // --- HUD update ---
  const countEl = document.getElementById('hud-count');
  if (countEl) countEl.textContent = `${state.aliveCount} / ${state.totalCount}`;

  // Speed indicator
  const speed = Math.sqrt(leader.vx * leader.vx + leader.vy * leader.vy + leader.vz * leader.vz);
  const speedEl = document.getElementById('hud-speed');
  if (speedEl) {
    speedEl.textContent = input.boost ? `BOOST ${speed.toFixed(1)}` : `${speed.toFixed(1)} м/с`;
  }
}

// ============================================================
// Render frame (with bloom)
// ============================================================

export function renderFrame(): void {
  composer.render();
}

// ============================================================
// FPS tracking
// ============================================================

export function updateFPS(time: number): number {
  fpsFrames++;
  fpsTime += time; // time is already dt in ms

  if (fpsTime >= 1000) {
    currentFps = Math.round(fpsFrames * 1000 / fpsTime);
    fpsFrames = 0;
    fpsTime = 0;
    const fpsEl = document.getElementById('hud-fps');
    if (fpsEl) fpsEl.textContent = `FPS: ${currentFps}`;
  }

  return currentFps;
}

// ============================================================
// Resize handler
// ============================================================

function onResize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloomPass.resolution.set(w, h);
}
