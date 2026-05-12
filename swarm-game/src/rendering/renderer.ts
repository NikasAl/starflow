// ============================================================
// Рой (Swarm) — Renderer (Demo Mode)
// Three.js scene, camera, InstancedMesh, bloom, platforms
// ============================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { GameState, PlatformData } from '../core/types.ts';
import {
  BOID_COUNT,
  STAR_COUNT, STAR_SHELL_MIN, STAR_SHELL_MAX,
  CAM_OFFSET_Y, CAM_OFFSET_Z, CAM_LOOK_AHEAD, CAM_LERP,
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

// Platforms
let platformObjects: THREE.Group[] = [];

// HUD
let hudDiv: HTMLDivElement;
let fpsFrames = 0;
let fpsTime = 0;
let currentFps = 0;

// Reusable objects
const _dummy = new THREE.Object3D();
const _up = new THREE.Vector3(0, 1, 0);
const _camPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _smoothCamPos = new THREE.Vector3();
const _smoothLookTarget = new THREE.Vector3();
const _boidDir = new THREE.Vector3();
const _fallbackAxis = new THREE.Vector3(1, 0, 0);

// Waypoint visualization
let waypointLine: THREE.Line;
let waypointMaterial: THREE.LineBasicMaterial;

/** Safe quaternion from direction — avoids NaN at near-180° */
function safeQuatFromDir(dir: THREE.Vector3, out: THREE.Quaternion): void {
  const dot = _up.dot(dir);
  if (dot > 0.9999) {
    out.identity();
  } else if (dot < -0.9999) {
    out.setFromAxisAngle(_fallbackAxis, Math.PI);
  } else {
    out.setFromUnitVectors(_up, dir);
  }
}

// Smooth camera
let _camInitialized = false;
let _camZoom = CAM_ZOOM_DEFAULT;

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
  scene.background = new THREE.Color(0x050518);
  scene.fog = new THREE.FogExp2(0x050518, 0.0025);

  // --- Camera (top-down view for demo) ---
  camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );

  // --- Post-processing ---
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
  const ambient = new THREE.AmbientLight(0x202040, 2.0);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0x6688cc, 0.8);
  dirLight.position.set(30, 60, 20);
  scene.add(dirLight);

  const dirLight2 = new THREE.DirectionalLight(0x334488, 0.4);
  dirLight2.position.set(-20, 40, -30);
  scene.add(dirLight2);

  // --- Starfield ---
  createStarfield();

  // --- World boundary ---
  createWorldBounds();

  // --- Boid InstancedMesh ---
  createBoidMesh();

  // --- Leader mesh ---
  createLeaderMesh();

  // --- HUD ---
  createHUD();

  // --- Zoom (mouse wheel) ---
  setupZoom(canvas);

  // --- Resize ---
  window.addEventListener('resize', onResize);
}

// ============================================================
// Starfield
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
    color: 0x8899cc,
    size: 0.5,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.6,
  });

  scene.add(new THREE.Points(geometry, material));
}

// ============================================================
// World boundary wireframe
// ============================================================

function createWorldBounds(): void {
  const size = WORLD_HALF_SIZE * 2;
  const geo = new THREE.BoxGeometry(size, size, size);
  const edges = new THREE.EdgesGeometry(geo);
  const mat = new THREE.LineBasicMaterial({
    color: 0x1a1a3a,
    transparent: true,
    opacity: 0.15,
  });
  scene.add(new THREE.LineSegments(edges, mat));

  // Ground plane — semi-transparent grid for depth reference
  const gridHelper = new THREE.GridHelper(
    WORLD_HALF_SIZE * 2,
    20,
    0x111133,
    0x0a0a22,
  );
  gridHelper.position.y = -WORLD_HALF_SIZE + 1;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.3;
  scene.add(gridHelper);
}

// ============================================================
// Boid InstancedMesh
// ============================================================

function createBoidMesh(): void {
  // Cone tip at +Y — quaternion orients +Y → forward
  const geometry = new THREE.ConeGeometry(0.15, 0.6, 4);

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
// Leader mesh
// ============================================================

function createLeaderMesh(): void {
  // Cone tip at +Y
  const geometry = new THREE.ConeGeometry(0.3, 1.2, 6);

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

  leaderLight = new THREE.PointLight(0x55ddff, 8, 40);
  scene.add(leaderLight);
}

// ============================================================
// Create platform 3D objects (disc + glowing ring)
// ============================================================

export function createPlatforms(platforms: PlatformData[]): void {
  // Clear existing
  for (const obj of platformObjects) {
    scene.remove(obj);
  }
  platformObjects = [];

  for (const p of platforms) {
    const group = new THREE.Group();

    // Platform disc (flat cylinder)
    const discGeo = new THREE.CylinderGeometry(p.radius, p.radius, 0.3, 16);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x1a2a44,
      emissive: 0x0a1525,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.7,
      metalness: 0.5,
      roughness: 0.5,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    group.add(disc);

    // Glowing ring (torus) on top of platform
    const ringGeo = new THREE.TorusGeometry(p.ringRadius, 0.15, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x44aaff,
      emissive: 0x2266dd,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI * 0.5; // Lay flat
    ring.position.y = 0.3;
    group.add(ring);

    // Small light on ring
    const ringLight = new THREE.PointLight(0x4488ff, 2, 15);
    ringLight.position.y = 1;
    group.add(ringLight);

    group.position.set(p.x, p.y, p.z);
    scene.add(group);
    platformObjects.push(group);
  }
}

// ============================================================
// Create waypoint path visualization
// ============================================================

export function createWaypointPath(waypoints: { x: number; y: number; z: number }[]): void {
  if (waypointLine) {
    scene.remove(waypointLine);
    waypointLine.geometry.dispose();
  }

  // Close the loop
  const points: THREE.Vector3[] = [];
  for (const wp of waypoints) {
    points.push(new THREE.Vector3(wp.x, wp.y, wp.z));
  }
  if (waypoints.length > 0) {
    points.push(new THREE.Vector3(waypoints[0].x, waypoints[0].y, waypoints[0].z));
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  waypointMaterial = new THREE.LineBasicMaterial({
    color: 0x334466,
    transparent: true,
    opacity: 0.2,
  });
  waypointLine = new THREE.Line(geometry, waypointMaterial);
  scene.add(waypointLine);
}

// ============================================================
// HUD
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
    <div style="position:absolute; top:16px; left:20px; font-size:20px; font-weight:700; text-shadow: 0 0 10px rgba(68,204,255,0.4);">
      <span id="hud-title">РОЙ — ДЕМО</span>
    </div>
    <div style="position:absolute; top:20px; right:20px; font-size:13px; opacity:0.5;">
      <span id="hud-fps"></span>
    </div>
    <div style="position:absolute; top:44px; left:20px; font-size:13px; opacity:0.6;">
      <span id="hud-count"></span>
    </div>
    <div style="position:absolute; top:64px; left:20px; font-size:12px; opacity:0.4;">
      <span id="hud-waypoint"></span>
    </div>
    <div style="position:absolute; top:84px; left:20px; font-size:12px; opacity:0.3;">
      <span id="hud-pos"></span>
    </div>
    <div style="position:absolute; bottom:20px; left:50%; transform:translateX(-50%); font-size:12px; opacity:0.3; text-align:center;">
      Автопилот — демо-режим | Колёсико мыши — зум
    </div>
  `;
  document.body.appendChild(hudDiv);
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
      _boidDir.set(boid.vx, boid.vy, boid.vz);
      if (_boidDir.lengthSq() > 0.001) {
        _boidDir.normalize();
        safeQuatFromDir(_boidDir, _dummy.quaternion);
      }
    } else {
      _dummy.position.set(0, -9999, 0);
    }
    _dummy.updateMatrix();
    boidMesh.setMatrixAt(i, _dummy.matrix);
  }
  boidMesh.instanceMatrix.needsUpdate = true;

  // --- Update leader ---
  leaderMesh.position.set(leader.x, leader.y, leader.z);
  leaderMesh.quaternion.set(leader.qx, leader.qy, leader.qz, leader.qw);
  leaderLight.position.set(leader.x, leader.y, leader.z);

  // --- Camera: behind and above leader, using quaternion ---
  const lq = new THREE.Quaternion(leader.qx, leader.qy, leader.qz, leader.qw);

  // Camera offset in leader's local space: behind (-Z) and above (+Y)
  // Zoom scales the distance from leader
  const zoomScale = _camZoom / Math.abs(CAM_OFFSET_Z);
  _camPos.set(0, CAM_OFFSET_Y * zoomScale, CAM_OFFSET_Z * zoomScale);
  _camPos.applyQuaternion(lq);
  _camPos.add(leaderMesh.position);

  if (!_camInitialized) {
    _smoothCamPos.copy(_camPos);
    _smoothLookTarget.set(leader.x, leader.y, leader.z);
    _camInitialized = true;
  }

  // Smooth camera follow
  const camSmooth = Math.min(CAM_LERP * dt, 1);
  _smoothCamPos.lerp(_camPos, camSmooth);
  camera.position.copy(_smoothCamPos);

  // Look at: ahead of leader in its forward direction
  const speed = Math.sqrt(leader.vx * leader.vx + leader.vy * leader.vy + leader.vz * leader.vz);
  const fwdX = speed > 0.1 ? leader.vx / speed : 0;
  const fwdZ = speed > 0.1 ? leader.vz / speed : 0;
  const lookX = leader.x + fwdX * CAM_LOOK_AHEAD;
  const lookY = leader.y;
  const lookZ = leader.z + fwdZ * CAM_LOOK_AHEAD;

  _lookTarget.set(lookX, lookY, lookZ);
  const lookSmooth = Math.min(CAM_LERP * 0.7 * dt, 1);
  _smoothLookTarget.lerp(_lookTarget, lookSmooth);
  camera.lookAt(_smoothLookTarget);

  // --- HUD ---
  const countEl = document.getElementById('hud-count');
  if (countEl) countEl.textContent = `Рой: ${state.aliveCount} / ${state.totalCount}`;

  const wpEl = document.getElementById('hud-waypoint');
  if (wpEl) {
    const total = state.waypoints.length;
    wpEl.textContent = `Точка: ${leader.waypointIndex + 1} / ${total}`;
  }

  const posEl = document.getElementById('hud-pos');
  if (posEl) {
    posEl.textContent = `x:${leader.x.toFixed(0)} y:${leader.y.toFixed(0)} z:${leader.z.toFixed(0)} | v:${speed.toFixed(1)}`;
  }
}

// ============================================================
// Render frame
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
// Zoom (mouse wheel)
// ============================================================

function setupZoom(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    _camZoom += e.deltaY * 0.01 * CAM_ZOOM_SPEED;
    // Clamp zoom range
    _camZoom = Math.max(CAM_ZOOM_MIN, Math.min(CAM_ZOOM_MAX, _camZoom));
  }, { passive: false });
}

// ============================================================
// Resize
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
