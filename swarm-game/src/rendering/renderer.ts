// ============================================================
// Рой (Swarm) — Renderer (Demo Mode)
// Three.js scene, camera, InstancedMesh, bloom, debug panel
// ============================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { GameState, PlatformData } from '../core/types.ts';
import { tuning } from '../core/boids.ts';
import {
  BOID_MAX_ALLOC,
  STAR_COUNT, STAR_SHELL_MIN, STAR_SHELL_MAX,
  CAM_DISTANCE, CAM_HEIGHT, CAM_LOOK_AHEAD, CAM_LERP,
  CAM_ZOOM_MIN, CAM_ZOOM_MAX, CAM_ZOOM_DEFAULT, CAM_ZOOM_SPEED,
  BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD,
  WORLD_HALF_SIZE,
} from '../core/constants.ts';

// ============================================================
// Internal state
// ============================================================

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let composer: EffectComposer;
let bloomPass: UnrealBloomPass;

let boidMesh: THREE.InstancedMesh;
let leaderMesh: THREE.Mesh;
let leaderLight: THREE.PointLight;

let platformObjects: THREE.Group[] = [];

// HUD
let hudDiv: HTMLDivElement;
let debugDiv: HTMLDivElement;
let debugVisible = false;
let fpsFrames = 0;
let fpsTime = 0;
let currentFps = 0;

// Reusable objects
const _dummy = new THREE.Object3D();
const _boidDir = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _smoothCamPos = new THREE.Vector3();
const _smoothLookTarget = new THREE.Vector3();
const _rotAxis = new THREE.Vector3();

// Path visualization
let pathLine: THREE.Line;

// Smooth camera
let _camInitialized = false;
let _camZoom = CAM_ZOOM_DEFAULT;

// Restart callback
let _onRestart: (() => void) | null = null;

// ============================================================
// Robust orientation
// ============================================================

function safeQuatFromDir(dir: THREE.Vector3, out: THREE.Quaternion): void {
  const ax = dir.z;
  const az = -dir.x;
  const aLen = Math.sqrt(ax * ax + az * az);

  if (aLen < 0.0001) {
    if (dir.y > 0) {
      out.identity();
    } else {
      out.set(1, 0, 0, 0);
    }
    return;
  }

  const dot = Math.max(-1, Math.min(1, dir.y));
  const angle = Math.acos(dot);

  _rotAxis.set(ax / aLen, 0, az / aLen);
  out.setFromAxisAngle(_rotAxis, angle);
}

// ============================================================
// Initialize
// ============================================================

export function initRenderer(canvas: HTMLCanvasElement): void {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050518);
  scene.fog = new THREE.FogExp2(0x050518, 0.002);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD,
  );
  composer.addPass(bloomPass);

  const ambient = new THREE.AmbientLight(0x202040, 2.5);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0x6688cc, 1.0);
  dirLight.position.set(30, 60, 20);
  scene.add(dirLight);
  const dirLight2 = new THREE.DirectionalLight(0x334488, 0.5);
  dirLight2.position.set(-20, 40, -30);
  scene.add(dirLight2);

  createStarfield();
  createWorldBounds();
  createBoidMesh();
  createLeaderMesh();
  createHUD();
  createDebugPanel();
  setupInput(canvas);

  window.addEventListener('resize', onResize);
}

/** Set a callback for restarting the game (e.g., after boidCount change) */
export function setRestartCallback(cb: () => void): void {
  _onRestart = cb;
}

// ============================================================
// Starfield
// ============================================================

function createStarfield(): void {
  const positions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = STAR_SHELL_MIN + Math.random() * (STAR_SHELL_MAX - STAR_SHELL_MIN);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({
    color: 0x8899cc, size: 0.5, sizeAttenuation: true, transparent: true, opacity: 0.6,
  })));
}

// ============================================================
// World boundary
// ============================================================

function createWorldBounds(): void {
  const size = WORLD_HALF_SIZE * 2;
  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(size, size, size));
  scene.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
    color: 0x1a1a3a, transparent: true, opacity: 0.12,
  })));
  const grid = new THREE.GridHelper(size, 20, 0x111133, 0x0a0a22);
  grid.position.y = -WORLD_HALF_SIZE + 1;
  grid.material.transparent = true;
  grid.material.opacity = 0.25;
  scene.add(grid);
}

// ============================================================
// Boid InstancedMesh (pre-allocated buffer)
// ============================================================

function createBoidMesh(): void {
  const geometry = new THREE.ConeGeometry(0.2, 0.8, 4);
  const material = new THREE.MeshStandardMaterial({
    color: 0x55eeff, emissive: 0x33bbdd, emissiveIntensity: 1.5,
    transparent: true, opacity: 0.95, metalness: 0.7, roughness: 0.2,
  });

  boidMesh = new THREE.InstancedMesh(geometry, material, BOID_MAX_ALLOC);
  boidMesh.count = tuning.boidCount;
  boidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  boidMesh.frustumCulled = false;
  scene.add(boidMesh);
}

// ============================================================
// Leader mesh
// ============================================================

function createLeaderMesh(): void {
  const geometry = new THREE.ConeGeometry(0.35, 1.4, 6);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0x88eeff, emissiveIntensity: 2.5,
    transparent: true, opacity: 1.0, metalness: 0.9, roughness: 0.05,
  });
  leaderMesh = new THREE.Mesh(geometry, material);
  scene.add(leaderMesh);
  leaderLight = new THREE.PointLight(0x55ddff, 10, 50);
  scene.add(leaderLight);
}

// ============================================================
// Create platform 3D objects
// ============================================================

export function createPlatforms(platforms: PlatformData[]): void {
  for (const obj of platformObjects) scene.remove(obj);
  platformObjects = [];

  for (const p of platforms) {
    const group = new THREE.Group();

    const discGeo = new THREE.CylinderGeometry(p.radius, p.radius, 0.3, 16);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x1a2a44, emissive: 0x0a1525, emissiveIntensity: 0.3,
      transparent: true, opacity: 0.7, metalness: 0.5, roughness: 0.5,
    });
    group.add(new THREE.Mesh(discGeo, discMat));

    const ringGeo = new THREE.TorusGeometry(p.ringRadius, 0.15, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x44aaff, emissive: 0x2266dd, emissiveIntensity: 1.2,
      transparent: true, opacity: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI * 0.5;
    ring.position.y = 0.3;
    group.add(ring);

    const ringLight = new THREE.PointLight(0x4488ff, 2, 15);
    ringLight.position.y = 1;
    group.add(ringLight);

    group.position.set(p.x, p.y, p.z);
    scene.add(group);
    platformObjects.push(group);
  }
}

// ============================================================
// Flight path visualization
// ============================================================

export function createPathVisualization(path: [number, number, number][]): void {
  if (pathLine) {
    scene.remove(pathLine);
    pathLine.geometry.dispose();
  }

  const points: THREE.Vector3[] = [];
  for (const p of path) {
    points.push(new THREE.Vector3(p[0], p[1], p[2]));
  }
  if (path.length > 0) {
    points.push(new THREE.Vector3(path[0][0], path[0][1], path[0][2]));
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  pathLine = new THREE.Line(geometry, new THREE.LineBasicMaterial({
    color: 0x334466, transparent: true, opacity: 0.12,
  }));
  scene.add(pathLine);
}

// ============================================================
// HUD
// ============================================================

function createHUD(): void {
  hudDiv = document.createElement('div');
  hudDiv.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none; font-family: 'Segoe UI', system-ui, sans-serif;
    color: #88ccff; z-index: 10;
  `;
  hudDiv.innerHTML = `
    <div style="position:absolute; top:16px; left:20px; font-size:20px; font-weight:700; text-shadow: 0 0 10px rgba(68,204,255,0.4);">
      РОЙ — ДЕМО
    </div>
    <div style="position:absolute; top:20px; right:20px; font-size:13px; opacity:0.5;">
      <span id="hud-fps"></span>
    </div>
    <div style="position:absolute; top:44px; left:20px; font-size:13px; opacity:0.6;">
      <span id="hud-count"></span>
    </div>
    <div style="position:absolute; top:64px; left:20px; font-size:12px; opacity:0.4;">
      <span id="hud-progress"></span>
    </div>
    <div style="position:absolute; top:84px; left:20px; font-size:12px; opacity:0.3;">
      <span id="hud-pos"></span>
    </div>
    <div style="position:absolute; bottom:20px; left:50%; transform:translateX(-50%); font-size:12px; opacity:0.25; text-align:center;">
      Колёсико — зум &nbsp;|&nbsp; T — настройки
    </div>
  `;
  document.body.appendChild(hudDiv);
}

// ============================================================
// Debug panel
// ============================================================

function createDebugPanel(): void {
  debugDiv = document.createElement('div');
  debugDiv.style.cssText = `
    position: fixed; top: 10px; right: 10px; width: 260px;
    background: rgba(5,5,24,0.92); border: 1px solid rgba(68,136,255,0.25);
    border-radius: 8px; padding: 14px;
    font-family: 'Segoe UI', system-ui, sans-serif; font-size: 12px;
    color: #88aadd; z-index: 20; pointer-events: auto;
    display: none; max-height: 90vh; overflow-y: auto;
  `;

  const sliders: { label: string; key: string; min: number; max: number; step: number }[] = [
    { label: 'Кол-во боидов', key: 'boidCount', min: 20, max: 400, step: 10 },
    { label: 'Разделение (радиус)', key: 'separationRadius', min: 1, max: 10, step: 0.5 },
    { label: 'Разделение (сила)', key: 'separationWeight', min: 0.5, max: 10, step: 0.5 },
    { label: 'Восприятие (радиус)', key: 'perceptionRadius', min: 3, max: 20, step: 1 },
    { label: 'Выравнивание', key: 'alignmentWeight', min: 0, max: 3, step: 0.1 },
    { label: 'Когезия', key: 'cohesionWeight', min: 0, max: 3, step: 0.1 },
    { label: 'Макс. сила', key: 'maxForce', min: 0.05, max: 0.5, step: 0.01 },
    { label: 'Притяжение к лидеру', key: 'leaderWeight', min: 0.5, max: 6, step: 0.25 },
    { label: 'Дист. следования', key: 'leaderTrailDist', min: 1, max: 15, step: 0.5 },
    { label: 'Радиус следования', key: 'leaderFollowRadius', min: 8, max: 40, step: 2 },
    { label: 'Масштаб боидов', key: 'boidScale', min: 0.5, max: 3, step: 0.1 },
  ];

  let html = `<div style="font-size:13px; font-weight:700; margin-bottom:10px; color:#aaccff;">Настройки</div>`;

  for (const s of sliders) {
    html += `
      <div style="margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
          <span>${s.label}</span>
          <span id="val-${s.key}" style="color:#66aaee; min-width:32px; text-align:right;">${(tuning as Record<string, number>)[s.key]}</span>
        </div>
        <input type="range" id="slider-${s.key}"
          min="${s.min}" max="${s.max}" step="${s.step}" value="${(tuning as Record<string, number>)[s.key]}"
          style="width:100%; accent-color:#4488cc; height:4px; cursor:pointer;">
      </div>
    `;
  }

  // Restart button for boidCount
  html += `
    <button id="btn-restart" style="
      width:100%; margin-top:8px; padding:6px 0;
      background: rgba(68,136,255,0.2); border:1px solid rgba(68,136,255,0.4);
      color:#88ccff; border-radius:4px; cursor:pointer; font-size:12px;
    ">Перезапустить (применить кол-во)</button>
  `;

  debugDiv.innerHTML = html;
  document.body.appendChild(debugDiv);

  // Bind sliders
  for (const s of sliders) {
    const slider = document.getElementById(`slider-${s.key}`) as HTMLInputElement;
    const valEl = document.getElementById(`val-${s.key}`);
    if (slider && valEl) {
      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        (tuning as Record<string, number>)[s.key] = v;
        valEl.textContent = v.toFixed(s.step < 0.1 ? 2 : 1);

        if (s.key === 'boidCount') {
          boidMesh.count = v;
        }
      });
    }
  }

  // Restart button
  const btn = document.getElementById('btn-restart');
  if (btn) {
    btn.addEventListener('click', () => {
      if (_onRestart) {
        _onRestart();
        // Reset camera
        _camInitialized = false;
      }
    });
  }
}

// ============================================================
// Input
// ============================================================

function setupInput(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    _camZoom += e.deltaY * 0.01 * CAM_ZOOM_SPEED;
    _camZoom = Math.max(CAM_ZOOM_MIN, Math.min(CAM_ZOOM_MAX, _camZoom));
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyT') {
      debugVisible = !debugVisible;
      debugDiv.style.display = debugVisible ? 'block' : 'none';
    }
  });
}

// ============================================================
// Sync visuals
// ============================================================

export function syncVisuals(state: GameState, dt: number): void {
  const { boids, leader, path } = state;
  const boidScale = tuning.boidScale;

  // --- Boid instances ---
  for (let i = 0; i < boids.length; i++) {
    const boid = boids[i];
    if (boid.alive) {
      _dummy.position.set(boid.x, boid.y, boid.z);
      _dummy.scale.set(boidScale, boidScale, boidScale);
      _boidDir.set(boid.vx, boid.vy, boid.vz);
      if (_boidDir.lengthSq() > 0.001) {
        _boidDir.normalize();
        safeQuatFromDir(_boidDir, _dummy.quaternion);
      }
    } else {
      _dummy.position.set(0, -9999, 0);
      _dummy.scale.set(boidScale, boidScale, boidScale);
    }
    _dummy.updateMatrix();
    boidMesh.setMatrixAt(i, _dummy.matrix);
  }
  // Hide unused instances
  for (let i = boids.length; i < boidMesh.count; i++) {
    _dummy.position.set(0, -9999, 0);
    _dummy.scale.set(0.01, 0.01, 0.01);
    _dummy.updateMatrix();
    boidMesh.setMatrixAt(i, _dummy.matrix);
  }
  boidMesh.instanceMatrix.needsUpdate = true;

  // --- Leader ---
  leaderMesh.position.set(leader.x, leader.y, leader.z);
  leaderMesh.quaternion.set(leader.qx, leader.qy, leader.qz, leader.qw);
  leaderLight.position.set(leader.x, leader.y, leader.z);

  // --- Camera: behind and above ---
  const lq = new THREE.Quaternion(leader.qx, leader.qy, leader.qz, leader.qw);
  const zoomScale = _camZoom / CAM_ZOOM_DEFAULT;
  const zoomDist = CAM_DISTANCE * zoomScale;
  const zoomHeight = CAM_HEIGHT * zoomScale;

  _camPos.set(0, -zoomDist, -zoomHeight);
  _camPos.applyQuaternion(lq);
  _camPos.add(leaderMesh.position);

  if (!_camInitialized) {
    _smoothCamPos.copy(_camPos);
    _smoothLookTarget.set(leader.x, leader.y, leader.z);
    _camInitialized = true;
  }

  const camSmooth = Math.min(CAM_LERP * dt, 1);
  _smoothCamPos.lerp(_camPos, camSmooth);
  camera.position.copy(_smoothCamPos);

  const speed = Math.sqrt(leader.vx * leader.vx + leader.vy * leader.vy + leader.vz * leader.vz);
  const fwdX = speed > 0.1 ? leader.vx / speed : 0;
  const fwdY = speed > 0.1 ? leader.vy / speed : 0;
  const fwdZ = speed > 0.1 ? leader.vz / speed : 0;

  _lookTarget.set(
    leader.x + fwdX * CAM_LOOK_AHEAD,
    leader.y + fwdY * CAM_LOOK_AHEAD,
    leader.z + fwdZ * CAM_LOOK_AHEAD,
  );
  const lookSmooth = Math.min(CAM_LERP * 0.7 * dt, 1);
  _smoothLookTarget.lerp(_lookTarget, lookSmooth);
  camera.lookAt(_smoothLookTarget);

  // --- HUD ---
  const countEl = document.getElementById('hud-count');
  if (countEl) countEl.textContent = `Рой: ${state.aliveCount} / ${state.totalCount}`;

  const progEl = document.getElementById('hud-progress');
  if (progEl) {
    const pct = ((leader.pathIndex / path.length) * 100).toFixed(0);
    progEl.textContent = `Круг: ${pct}% (${leader.pathIndex}/${path.length})`;
  }

  const posEl = document.getElementById('hud-pos');
  if (posEl) {
    posEl.textContent = `x:${leader.x.toFixed(0)} y:${leader.y.toFixed(0)} z:${leader.z.toFixed(0)} | v:${speed.toFixed(1)}`;
  }
}

export function renderFrame(): void {
  composer.render();
}

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

function onResize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloomPass.resolution.set(w, h);
}
