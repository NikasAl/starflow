// ============================================================
// SnakeFlow — Particle Effects
// Liberation particles and collision sparks
// ============================================================

import * as THREE from 'three';
import { PARTICLE_COUNT, PARTICLE_LIFE, PARTICLE_SIZE } from '../core/constants';

interface ParticleEffect {
  points: THREE.Points;
  velocities: THREE.Vector3[];
  life: number;
  maxLife: number;
  color: number;
}

const activeEffects: ParticleEffect[] = [];

/** Spawn liberation particles at a world position */
export function spawnFreeParticles(
  scene: THREE.Scene,
  x: number, y: number, z: number,
  color: number,
): void {
  const count = PARTICLE_COUNT;
  const positions = new Float32Array(count * 3);
  const velocities: THREE.Vector3[] = [];

  for (let i = 0; i < count; i++) {
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Spherical random direction, biased upward
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.6; // bias up
    const speed = 2.5 + Math.random() * 4.0;
    velocities.push(new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta) * speed,
      Math.cos(phi) * speed + 1.5, // extra upward
      Math.sin(phi) * Math.sin(theta) * speed,
    ));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color,
    size: PARTICLE_SIZE,
    transparent: true,
    opacity: 1.0,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  activeEffects.push({
    points,
    velocities,
    life: 0,
    maxLife: PARTICLE_LIFE,
    color,
  });
}

/** Spawn collision sparks at world position */
export function spawnCollisionSparks(
  scene: THREE.Scene,
  x: number, y: number, z: number,
): void {
  spawnFreeParticles(scene, x, y, z, 0xff3333);
}

/** Update all particle effects (call each frame) */
export function updateParticles(scene: THREE.Scene, dt: number): void {
  for (let i = activeEffects.length - 1; i >= 0; i--) {
    const fx = activeEffects[i];
    fx.life += dt;

    if (fx.life >= fx.maxLife) {
      scene.remove(fx.points);
      fx.points.geometry.dispose();
      (fx.points.material as THREE.Material).dispose();
      activeEffects.splice(i, 1);
      continue;
    }

    const t = fx.life / fx.maxLife;
    (fx.points.material as THREE.PointsMaterial).opacity = 1.0 - t;
    (fx.points.material as THREE.PointsMaterial).size = PARTICLE_SIZE * (1.0 - t * 0.5);

    // Update positions
    const posAttr = fx.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let j = 0; j < fx.velocities.length; j++) {
      arr[j * 3] += fx.velocities[j].x * dt;
      arr[j * 3 + 1] += fx.velocities[j].y * dt;
      arr[j * 3 + 2] += fx.velocities[j].z * dt;
      // Gravity
      fx.velocities[j].y -= 6.0 * dt;
      // Drag
      fx.velocities[j].multiplyScalar(0.97);
    }
    posAttr.needsUpdate = true;
  }
}

/** Dispose all active effects */
export function disposeAllParticles(scene: THREE.Scene): void {
  for (const fx of activeEffects) {
    scene.remove(fx.points);
    fx.points.geometry.dispose();
    (fx.points.material as THREE.Material).dispose();
  }
  activeEffects.length = 0;
}
