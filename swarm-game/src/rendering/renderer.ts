// ============================================================
// Рой (Swarm) — Renderer
// Three.js scene, camera, InstancedMesh, bloom, input, HUD
// ============================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { GameState, InputState, LandmarkData } from '../core/types.ts';
import {
  BOID_COUNT,
  STAR_COUNT, STAR_SHELL_MIN, STAR_SHELL_MAX,
  CAM_OFFSET_Y, CAM_OFFSET_Z, CAM_LERP, CAM_LOOK_AHEAD,
  BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD,
  WORLD_HALF_SIZE,
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

// Landmarks
let landmarkObjects: THREE.Object3D[] = [];

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
const _camPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _smoothLookTarget = new THREE.Vector3();
const _leaderDir = new THREE.Vector3();
const _fallbackAxis = new THREE.Vector3(1, 0, 0);

/** Safe quaternion from two unit vectors — handles near-180° case */
function safeQuatFromDir(dir: THREE.Vector3, out: THREE.Quaternion): void {
  const dot = _up.dot(dir);
  if (dot > 0.9999) {
    // Nearly same direction
    out.identity();
  } else if (dot < -0.9999) {
    // Nearly opposite — pick any perpendicular axis
    out.setFromAxisAngle(_fallbackAxis, Math.PI);
  } else {
    out.setFromUnitVectors(_up, dir);
  }
}

// Smooth camera state
let _camInitialized = false;
const _smoothCamPos = new THREE.Vector3(0, 2, -8);

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
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // --- Scene ---
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030310);
  scene.fog = new THREE.FogExp2(0x030310, 0.002);

  // --- Camera ---
  camera = new THREE.PerspectiveCamera(
    70,
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
  const ambient = new THREE.AmbientLight(0x151525, 1.2);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0x5577cc, 0.5);
  dirLight.position.set(20, 40, 30);
  scene.add(dirLight);

  const dirLight2 = new THREE.DirectionalLight(0x3344aa, 0.3);
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

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = STAR_SHELL_MIN + Math.random() * (STAR_SHELL_MAX - STAR_SHELL_MIN);

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0x99aadd,
    size: 0.6,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.7,
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
    opacity: 0.25,
  });
  scene.add(new THREE.LineSegments(edges, mat));
}

// ============================================================
// Boid InstancedMesh
// ============================================================

function createBoidMesh(): void {
  // Cone geometry — rocket/drone shape
  const geometry = new THREE.ConeGeometry(0.15, 0.6, 4);
  geometry.rotateX(Math.PI); // tip points -Y, we orient via quaternion

  const material = new THREE.MeshStandardMaterial({
    color: 0x55eeff,
    emissive: 0x33bbdd,
    emissiveIntensity: 1.5,
    transparent: true,
    opacity: 0.95,
    metalness: 0.7,
    roughness: 0.2,
  });

  boidMesh = new THREE.InstancedMesh(geometry, material, BOID_COUNT);
  boidMesh.count = BOID_COUNT;
  boidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(boidMesh);
}

// ============================================================
// Leader mesh (larger, brighter, white-cyan)
// ============================================================

function createLeaderMesh(): void {
  const geometry = new THREE.ConeGeometry(0.25, 1.0, 4);
  geometry.rotateX(Math.PI);

  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x88eeff,
    emissiveIntensity: 2.5,
    transparent: true,
    opacity: 1.0,
    metalness: 0.9,
    roughness: 0.05,
  });

  leaderMesh = new THREE.Mesh(geometry, material);
  scene.add(leaderMesh);

  // Stronger point light for leader
  leaderLight = new THREE.PointLight(0x55ddff, 5, 30);
  scene.add(leaderLight);
}

// ============================================================
// Create landmark 3D objects
// ============================================================

export function createLandmarks(landmarks: LandmarkData[]): void {
  // Clear existing
  for (const obj of landmarkObjects) {
    scene.remove(obj);
  }
  landmarkObjects = [];

  for (const lm of landmarks) {
    let obj: THREE.Object3D;

    if (lm.type === 'ring') {
      // Glowing ring (torus)
      const geo = new THREE.TorusGeometry(2 * lm.scale, 0.15 * lm.scale, 8, 24);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x3366aa,
        emissive: 0x2255aa,
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      obj = new THREE.Mesh(geo, mat);
    } else if (lm.type === 'pillar') {
      // Tall thin cylinder
      const geo = new THREE.CylinderGeometry(
        0.3 * lm.scale, 0.5 * lm.scale, 8 * lm.scale, 6,
      );
      const mat = new THREE.MeshStandardMaterial({
        color: 0x334466,
        emissive: 0x1a2244,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.6,
      });
      obj = new THREE.Mesh(geo, mat);

      // Add a small glowing top
      const topGeo = new THREE.SphereGeometry(0.6 * lm.scale, 8, 6);
      const topMat = new THREE.MeshStandardMaterial({
        color: 0x4488ff,
        emissive: 0x4488ff,
        emissiveIntensity: 1.0,
      });
      const top = new THREE.Mesh(topGeo, topMat);
      top.position.y = 4 * lm.scale;
      obj.add(top);
    } else {
      // Crystal — octahedron
      const geo = new THREE.OctahedronGeometry(1.2 * lm.scale, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x66aaff,
        emissive: 0x4477dd,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.6,
        metalness: 0.9,
        roughness: 0.1,
      });
      obj = new THREE.Mesh(geo, mat);
    }

    obj.position.set(lm.x, lm.y, lm.z);
    obj.rotation.y = lm.rotation;
    scene.add(obj);
    landmarkObjects.push(obj);
  }
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
    <div style="position:absolute; top:16px; left:70px; font-size:14px; opacity:0.8;">
      <span id="hud-count"></span>
    </div>
    <div style="position:absolute; top:16px; right:20px; font-size:13px; opacity:0.6;">
      <span id="hud-fps"></span>
    </div>
    <div style="position:absolute; bottom:20px; left:50%; transform:translateX(-50%); font-size:13px; opacity:0.4; text-align:center; line-height:1.6;">
      WASD — управление &nbsp;|&nbsp; Space — ускорение
    </div>
    <div style="position:absolute; bottom:50px; left:50%; transform:translateX(-50%); font-size:12px; opacity:0.3;" id="hud-speed"></div>
    <div style="position:absolute; bottom:72px; left:50%; transform:translateX(-50%); font-size:11px; opacity:0.25;" id="hud-pos"></div>
  `;
  document.body.appendChild(hudDiv);
}

// ============================================================
// Input handling
// ============================================================

function setupInput(canvas: HTMLCanvasElement): void {
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });

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
  const { boids, leader, landmarks } = state;

  // --- Update boid instances ---
  for (let i = 0; i < boids.length; i++) {
    const boid = boids[i];
    if (boid.alive) {
      _dummy.position.set(boid.x, boid.y, boid.z);
      _leaderDir.set(boid.vx, boid.vy, boid.vz);
      if (_leaderDir.lengthSq() > 0.001) {
        _leaderDir.normalize();
        safeQuatFromDir(_leaderDir, _dummy.quaternion);
      }
    } else {
      _dummy.position.set(0, -9999, 0);
    }
    _dummy.updateMatrix();
    boidMesh.setMatrixAt(i, _dummy.matrix);
  }
  boidMesh.instanceMatrix.needsUpdate = true;

  // --- Update leader mesh (use quaternion directly, no setFromUnitVectors) ---
  leaderMesh.position.set(leader.x, leader.y, leader.z);
  leaderMesh.quaternion.set(leader.qx, leader.qy, leader.qz, leader.qw);
  leaderLight.position.set(leader.x, leader.y, leader.z);

  // --- Update landmark objects ---
  for (let i = 0; i < landmarks.length; i++) {
    if (landmarkObjects[i]) {
      landmarkObjects[i].rotation.y = landmarks[i].rotation;
    }
  }

  // --- Camera follow (stabilized) ---
  // Desired position: behind and above leader in local space
  const lq = new THREE.Quaternion(leader.qx, leader.qy, leader.qz, leader.qw);
  _camPos.set(0, CAM_OFFSET_Y, CAM_OFFSET_Z).applyQuaternion(lq);
  _camPos.add(leaderMesh.position);

  if (!_camInitialized) {
    _smoothCamPos.copy(_camPos);
    _smoothLookTarget.set(leader.x, leader.y, leader.z);
    _camInitialized = true;
  }

  // Smooth camera position (lerp)
  const camSmooth = Math.min(CAM_LERP * dt, 1);
  _smoothCamPos.lerp(_camPos, camSmooth);
  camera.position.copy(_smoothCamPos);

  // Look at: point ahead of leader (smoothed to avoid jitter)
  _lookTarget.set(
    leader.x + leader.vx * CAM_LOOK_AHEAD * 0.3,
    leader.y + leader.vy * CAM_LOOK_AHEAD * 0.3,
    leader.z + leader.vz * CAM_LOOK_AHEAD * 0.3,
  );
  const lookSmooth = Math.min(CAM_LERP * 0.8 * dt, 1);
  _smoothLookTarget.lerp(_lookTarget, lookSmooth);
  camera.lookAt(_smoothLookTarget);

  // --- HUD update ---
  const countEl = document.getElementById('hud-count');
  if (countEl) countEl.textContent = `${state.aliveCount} / ${state.totalCount}`;

  const speed = Math.sqrt(leader.vx * leader.vx + leader.vy * leader.vy + leader.vz * leader.vz);
  const speedEl = document.getElementById('hud-speed');
  if (speedEl) {
    speedEl.textContent = input.boost ? `BOOST ${speed.toFixed(1)}` : `${speed.toFixed(1)} м/с`;
  }

  const posEl = document.getElementById('hud-pos');
  if (posEl) {
    posEl.textContent = `x:${leader.x.toFixed(0)} y:${leader.y.toFixed(0)} z:${leader.z.toFixed(0)}`;
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
  fpsTime += time;

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
