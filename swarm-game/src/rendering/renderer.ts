// ============================================================
// Рой — Собиратель (Swarm: Collector) — Renderer
// Three.js scene, camera, InstancedMesh, bloom, HUD, debug panel
// ============================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { GameState, BoidData } from '../core/types.ts';
import { tuning } from '../core/boids.ts';
import {
  BOID_MAX_ALLOC,
  BOID_COLORS,
  PORTAL_RADIUS,
  STAR_COUNT, STAR_SHELL_MIN, STAR_SHELL_MAX,
  CAM_DISTANCE, CAM_HEIGHT, CAM_LOOK_AHEAD, CAM_LERP,
  CAM_ZOOM_MIN, CAM_ZOOM_MAX, CAM_ZOOM_DEFAULT, CAM_ZOOM_SPEED,
  BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD,
  LEADER_BOOST_DURATION, LEADER_BOOST_COOLDOWN,
  LEADER_SPEED,
  WORLD_HALF_SIZE,
} from '../core/constants.ts';
import type { BoidType } from '../core/types.ts';

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
let portalMesh: THREE.Mesh;
let portalGlow: THREE.PointLight;

// HUD
let hudDiv: HTMLDivElement;
let debugDiv: HTMLDivElement;
let endScreenDiv: HTMLDivElement;
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
const _persistentUp = new THREE.Vector3(0, 1, 0);
const _rotAxis = new THREE.Vector3();
const _boidColor = new THREE.Color();

// Smooth camera
let _camInitialized = false;
let _camZoom = CAM_ZOOM_DEFAULT;

// Restart callback
let _onRestart: (() => void) | null = null;

// Cached colors for boid types
const _colorCache = new Map<string, THREE.Color>();
for (const [key, val] of Object.entries(BOID_COLORS)) {
  _colorCache.set(key, new THREE.Color(val.color));
}

// ============================================================
// Robust orientation (cross-product based, NO setFromUnitVectors)
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
  // Very subtle fog — don't obscure gameplay objects
  scene.fog = new THREE.FogExp2(0x050518, 0.0008);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD,
  );
  composer.addPass(bloomPass);

  // Hemisphere light for even ambient coverage (sky/ground)
  const hemi = new THREE.HemisphereLight(0x4466aa, 0x111122, 2.0);
  scene.add(hemi);
  // Ambient fill
  const ambient = new THREE.AmbientLight(0x304060, 1.5);
  scene.add(ambient);
  // Directional key light
  const dirLight = new THREE.DirectionalLight(0x99bbee, 2.0);
  dirLight.position.set(30, 60, 20);
  scene.add(dirLight);
  // Fill light from opposite side
  const dirLight2 = new THREE.DirectionalLight(0x4466aa, 0.8);
  dirLight2.position.set(-20, 40, -30);
  scene.add(dirLight2);

  createStarfield();
  createWorldBounds();
  createBoidMesh();
  createLeaderMesh();
  createPortalMesh();
  createReferenceBeacons();
  createHUD();
  createDebugPanel();
  createEndScreen();
  setupInput(canvas);

  window.addEventListener('resize', onResize);
}

/** Set a callback for restarting the game */
export function setRestartCallback(cb: () => void): void {
  _onRestart = cb;
}

/** Get camera quaternion for input transformation */
export function getCameraQuaternion(): THREE.Quaternion {
  return camera.quaternion;
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
  (grid.material as THREE.Material).opacity = 0.25;
  scene.add(grid);
}

// ============================================================
// Boid InstancedMesh with instanceColor
// ============================================================

function createBoidMesh(): void {
  // Slightly larger cone for better visibility and 3D appearance
  const geometry = new THREE.ConeGeometry(0.25, 1.0, 4);
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    color: 0xffffff,
    // Bright white emissive — tinted per-instance via onBeforeCompile
    emissive: 0xffffff,
    emissiveIntensity: 1.2,
    transparent: true,
    opacity: 0.95,
    metalness: 0.3,
    roughness: 0.15,
  });

  // Per-instance emissive glow: make each boid emit its own instanceColor.
  // Standard InstancedMesh only applies instanceColor to diffuse (color channel).
  // This shader patch injects vColor into the emissive calculation so each
  // boid type (neutron/ion/photon/electron/quark) glows with its unique hue.
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      #ifdef USE_INSTANCING_COLOR
        totalEmissiveRadiance *= vColor;
      #endif`,
    );
  };

  boidMesh = new THREE.InstancedMesh(geometry, material, BOID_MAX_ALLOC);
  boidMesh.count = BOID_MAX_ALLOC;
  boidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  boidMesh.frustumCulled = false;

  // Initialize instance colors (will be overwritten per-frame by syncVisuals)
  for (let i = 0; i < BOID_MAX_ALLOC; i++) {
    boidMesh.setColorAt(i, _colorCache.get('neutron')!);
  }
  if (boidMesh.instanceColor) {
    boidMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  }

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
// Portal mesh (torus)
// ============================================================

function createPortalMesh(): void {
  const geometry = new THREE.TorusGeometry(PORTAL_RADIUS, 0.3, 16, 48);
  const material = new THREE.MeshStandardMaterial({
    color: 0x4488ff,
    emissive: 0x2266dd,
    emissiveIntensity: 2.0,
    transparent: true,
    opacity: 0.85,
    metalness: 0.8,
    roughness: 0.1,
    side: THREE.DoubleSide,
  });
  portalMesh = new THREE.Mesh(geometry, material);
  portalMesh.frustumCulled = false;
  scene.add(portalMesh);

  // Portal glow light — extended range so it's visible from far away
  portalGlow = new THREE.PointLight(0x4488ff, 12, 120);
  scene.add(portalGlow);
}

// ============================================================
// Static reference beacons for orientation
// ============================================================

function createReferenceBeacons(): void {
  const beaconPositions = [
    { x:  50, y: 0, z:  50, color: 0xff4444, label: 'R' },
    { x: -50, y: 0, z:  50, color: 0x44ff44, label: 'G' },
    { x:  50, y: 0, z: -50, color: 0x4488ff, label: 'B' },
    { x: -50, y: 0, z: -50, color: 0xffaa22, label: 'Y' },
    { x:   0, y: 0, z:   0, color: 0x888888, label: 'O' },
  ];

  for (const bp of beaconPositions) {
    // Tall pillar for visibility
    const pillarGeo = new THREE.CylinderGeometry(0.3, 0.3, 30, 6);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: bp.color,
      emissive: bp.color,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.6,
    });
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(bp.x, 15, bp.z);
    pillar.frustumCulled = false;
    scene.add(pillar);

    // Base marker (flat octahedron)
    const baseGeo = new THREE.OctahedronGeometry(1.5, 0);
    const baseMat = new THREE.MeshStandardMaterial({
      color: bp.color,
      emissive: bp.color,
      emissiveIntensity: 1.0,
      metalness: 0.5,
      roughness: 0.3,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(bp.x, 0, bp.z);
    baseMesh.frustumCulled = false;
    scene.add(baseMesh);

    // Small point light for beacon glow
    const light = new THREE.PointLight(bp.color, 3, 30);
    light.position.set(bp.x, 5, bp.z);
    scene.add(light);
  }

  // Axis lines from origin for debug orientation
  const axisLen = 12;
  const axisMatX = new THREE.LineBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.5 });
  const axisMatY = new THREE.LineBasicMaterial({ color: 0x33ff33, transparent: true, opacity: 0.5 });
  const axisMatZ = new THREE.LineBasicMaterial({ color: 0x3388ff, transparent: true, opacity: 0.5 });

  const lineGeoX = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(axisLen,0,0)]);
  const lineGeoY = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,axisLen,0)]);
  const lineGeoZ = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,axisLen)]);

  scene.add(new THREE.Line(lineGeoX, axisMatX));
  scene.add(new THREE.Line(lineGeoY, axisMatY));
  scene.add(new THREE.Line(lineGeoZ, axisMatZ));
}

// ============================================================
// HUD
// ============================================================

function createHUD(): void {
  hudDiv = document.createElement('div');
  hudDiv.id = 'hud';
  hudDiv.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    pointer-events: none; font-family: 'Segoe UI', system-ui, sans-serif;
    color: #88ccff; z-index: 10;
  `;
  hudDiv.innerHTML = `
    <div style="position:absolute; top:16px; left:20px; font-size:20px; font-weight:700; text-shadow: 0 0 10px rgba(68,204,255,0.4);">
      РОЙ — СОБИРАТЕЛЬ
    </div>
    <div style="position:absolute; top:44px; left:20px; font-size:14px; opacity:0.8;">
      <span id="hud-collected"></span>
    </div>
    <div style="position:absolute; top:66px; left:20px; font-size:14px; opacity:0.8;">
      <span id="hud-passed"></span>
    </div>
    <div style="position:absolute; top:88px; left:20px; font-size:14px; opacity:0.8;">
      <span id="hud-score" style="color:#ffcc33;"></span>
    </div>
    <div style="position:absolute; top:110px; left:20px; font-size:14px; opacity:0.8;">
      <span id="hud-timer"></span>
    </div>
    <div style="position:absolute; top:20px; right:20px; font-size:13px; opacity:0.5;">
      <span id="hud-fps"></span>
    </div>
    <div style="position:absolute; top:136px; left:20px; font-size:12px; opacity:0.3;">
      <span id="hud-boost"></span>
    </div>
    <div style="position:absolute; bottom:20px; left:50%; transform:translateX(-50%); font-size:12px; opacity:0.25; text-align:center;">
      WASD / стрелки — направление &nbsp;|&nbsp; Space — буст &nbsp;|&nbsp; Колёсико — зум &nbsp;|&nbsp; T — настройки
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

  html += `
    <button id="btn-restart" style="
      width:100%; margin-top:8px; padding:6px 0;
      background: rgba(68,136,255,0.2); border:1px solid rgba(68,136,255,0.4);
      color:#88ccff; border-radius:4px; cursor:pointer; font-size:12px;
    ">Перезапустить</button>
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
      });
    }
  }

  // Restart button
  const btn = document.getElementById('btn-restart');
  if (btn) {
    btn.addEventListener('click', () => {
      if (_onRestart) {
        _onRestart();
        _camInitialized = false;
      }
    });
  }
}

// ============================================================
// End screen overlay
// ============================================================

function createEndScreen(): void {
  endScreenDiv = document.createElement('div');
  endScreenDiv.id = 'end-screen';
  endScreenDiv.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(5,5,24,0.85); z-index: 30;
    display: none; align-items: center; justify-content: center;
    font-family: 'Segoe UI', system-ui, sans-serif; color: #88ccff;
    pointer-events: auto;
  `;
  endScreenDiv.innerHTML = `
    <div style="text-align: center;">
      <div id="end-title" style="font-size:32px; font-weight:700; margin-bottom:20px; text-shadow: 0 0 15px rgba(68,204,255,0.5);"></div>
      <div id="end-level" style="font-size:18px; opacity:0.6; margin-bottom:16px;"></div>
      <div id="end-stats" style="font-size:16px; line-height:1.8; margin-bottom:24px; opacity:0.8;"></div>
      <div id="end-stars" style="font-size:28px; margin-bottom:24px; color:#ffcc33;"></div>
      <button id="btn-replay" style="
        padding: 12px 40px; margin: 0 8px;
        background: rgba(68,136,255,0.3); border: 2px solid rgba(68,136,255,0.6);
        color:#88ccff; border-radius:8px; cursor:pointer; font-size:16px;
        font-weight:600; transition: background 0.2s;
      " onmouseover="this.style.background='rgba(68,136,255,0.5)'" onmouseout="this.style.background='rgba(68,136,255,0.3)'">
        Повторить
      </button>
    </div>
  `;
  document.body.appendChild(endScreenDiv);

  const replayBtn = document.getElementById('btn-replay');
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      endScreenDiv.style.display = 'none';
      if (_onRestart) {
        _onRestart();
        _camInitialized = false;
      }
    });
  }
}

export function showEndScreen(state: GameState): void {
  const titleEl = document.getElementById('end-title');
  const levelEl = document.getElementById('end-level');
  const statsEl = document.getElementById('end-stats');
  const starsEl = document.getElementById('end-stars');

  const totalFree = state.level.totalBoids;
  const passedFree = state.passedCount;
  const pct = totalFree > 0 ? (passedFree / totalFree * 100) : 0;

  // Star rating
  let stars = 0;
  let starStr = '';
  if (pct >= 40) { stars = 1; starStr = '★☆☆'; }
  if (pct >= 60) { stars = 2; starStr = '★★☆'; }
  if (pct >= 80) { stars = 3; starStr = '★★★'; }
  if (pct >= 90) { stars = 4; starStr = '★★★+'; }

  if (titleEl) titleEl.textContent = 'Время вышло!';
  if (levelEl) levelEl.textContent = `Уровень: ${state.level.name}`;
  if (statsEl) statsEl.innerHTML = `
    Собрано: ${state.collectedCount} / ${totalFree}<br>
    Проведено: ${passedFree} / ${totalFree} (${pct.toFixed(0)}%)<br>
    Очки: <span style="color:#ffcc33; font-weight:700;">${state.score}</span>
  `;
  if (starsEl) starsEl.textContent = starStr;

  endScreenDiv.style.display = 'flex';
}

// ============================================================
// Input (zoom + debug toggle)
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

  // Prevent context menu for right-click steering
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ============================================================
// Sync visuals
// ============================================================

export function syncVisuals(state: GameState, dt: number): void {
  const { boids, leader, portal } = state;
  const boidScale = tuning.boidScale;

  // --- Portal animation ---
  portal.rotation += dt * 0.8;
  portalMesh.rotation.x = portal.rotation * 0.3;
  portalMesh.rotation.y = portal.rotation;
  portalMesh.rotation.z = portal.rotation * 0.15;
  portalMesh.position.set(portal.x, portal.y, portal.z);
  portalGlow.position.set(portal.x, portal.y, portal.z);

  // Pulse glow
  const glowPulse = 6 + Math.sin(state.time * 3) * 2;
  portalGlow.intensity = glowPulse;

  // --- Boid instances ---
  let needsColorUpdate = false;

  // Set instance count
  boidMesh.count = Math.max(boids.length, BOID_MAX_ALLOC);

  for (let i = 0; i < boids.length; i++) {
    const boid = boids[i];

    if (boid.state === 'passed') {
      // Hide passed boids
      _dummy.position.set(0, -9999, 0);
      _dummy.scale.set(0.01, 0.01, 0.01);
      _dummy.updateMatrix();
      boidMesh.setMatrixAt(i, _dummy.matrix);
      continue;
    }

    // Set color by type
    const color = _colorCache.get(boid.type);
    if (color) {
      boidMesh.setColorAt(i, color);
      needsColorUpdate = true;
    }

    if (boid.state === 'free') {
      // Free boids: smaller and dimmer
      _dummy.position.set(boid.x, boid.y, boid.z);
      const freeScale = boidScale * 0.5;
      _dummy.scale.set(freeScale, freeScale, freeScale);
      _boidDir.set(boid.vx, boid.vy, boid.vz);
      if (_boidDir.lengthSq() > 0.001) {
        _boidDir.normalize();
        safeQuatFromDir(_boidDir, _dummy.quaternion);
      }
    } else {
      // Collected boids: normal scale
      _dummy.position.set(boid.x, boid.y, boid.z);
      _dummy.scale.set(boidScale, boidScale, boidScale);
      _boidDir.set(boid.vx, boid.vy, boid.vz);
      if (_boidDir.lengthSq() > 0.001) {
        _boidDir.normalize();
        safeQuatFromDir(_boidDir, _dummy.quaternion);
      }
    }

    _dummy.updateMatrix();
    boidMesh.setMatrixAt(i, _dummy.matrix);
  }

  // Hide unused instances
  for (let i = boids.length; i < BOID_MAX_ALLOC; i++) {
    _dummy.position.set(0, -9999, 0);
    _dummy.scale.set(0.01, 0.01, 0.01);
    _dummy.updateMatrix();
    boidMesh.setMatrixAt(i, _dummy.matrix);
  }

  boidMesh.instanceMatrix.needsUpdate = true;
  if (needsColorUpdate && boidMesh.instanceColor) {
    boidMesh.instanceColor.needsUpdate = true;
  }

  // --- Leader ---
  leaderMesh.position.set(leader.x, leader.y, leader.z);
  leaderMesh.quaternion.set(leader.qx, leader.qy, leader.qz, leader.qw);

  // Boost visual: brighter + larger when boosting
  if (leader.boostActive > 0) {
    const boostPct = leader.boostActive / LEADER_BOOST_DURATION;
    leaderMesh.scale.setScalar(1.0 + boostPct * 0.3);
    (leaderMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 3.5 + boostPct * 2;
    leaderLight.intensity = 15 + boostPct * 10;
  } else {
    leaderMesh.scale.setScalar(1.0);
    (leaderMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.5;
    leaderLight.intensity = 10;
  }
  leaderLight.position.set(leader.x, leader.y, leader.z);

  // --- Camera: behind and above, with persistent up ---
  const lq = new THREE.Quaternion(leader.qx, leader.qy, leader.qz, leader.qw);
  const zoomScale = _camZoom / CAM_ZOOM_DEFAULT;
  const zoomDist = CAM_DISTANCE * zoomScale;
  const zoomHeight = CAM_HEIGHT * zoomScale;

  // Camera offset: (0, -dist, -height) in leader's local space
  // Leader forward is local +Y, so camera is behind = -Y direction
  _camPos.set(0, -zoomDist, -zoomHeight);
  _camPos.applyQuaternion(lq);
  _camPos.add(leaderMesh.position);

  if (!_camInitialized) {
    _smoothCamPos.copy(_camPos);
    _smoothLookTarget.set(leader.x, leader.y, leader.z);
    _persistentUp.set(0, 1, 0);
    _camInitialized = true;
  }

  const camSmooth = Math.min(CAM_LERP * dt, 1);
  _smoothCamPos.lerp(_camPos, camSmooth);
  camera.position.copy(_smoothCamPos);

  // Persistent up vector: lerp toward world (0,1,0)
  const upLerp = Math.min(2.0 * dt, 1);
  _persistentUp.lerp(new THREE.Vector3(0, 1, 0), upLerp);
  _persistentUp.normalize();
  camera.up.copy(_persistentUp);

  // Look target: ahead of leader
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
  const collectedEl = document.getElementById('hud-collected');
  if (collectedEl) collectedEl.textContent = `Собрано: ${state.collectedCount} / ${state.level.totalBoids}`;

  const passedEl = document.getElementById('hud-passed');
  if (passedEl) passedEl.textContent = `Проведено: ${state.passedCount} / ${state.level.totalBoids}`;

  const scoreEl = document.getElementById('hud-score');
  if (scoreEl) scoreEl.textContent = `Очки: ${state.score}`;

  const timerEl = document.getElementById('hud-timer');
  if (timerEl) {
    const minutes = Math.floor(state.timeRemaining / 60);
    const seconds = Math.floor(state.timeRemaining % 60);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    const isLow = state.timeRemaining < 15;
    timerEl.textContent = `Время: ${timeStr}`;
    if (isLow) {
      timerEl.style.color = '#ff6666';
      timerEl.style.opacity = '1';
    } else {
      timerEl.style.color = '#88ccff';
      timerEl.style.opacity = '0.8';
    }
  }

  const boostEl = document.getElementById('hud-boost');
  if (boostEl) {
    if (leader.boostCooldown > 0) {
      boostEl.textContent = `Буст: ${leader.boostCooldown.toFixed(1)}с`;
      boostEl.style.opacity = '0.5';
    } else {
      boostEl.textContent = 'Буст: готов';
      boostEl.style.opacity = '0.3';
    }
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
