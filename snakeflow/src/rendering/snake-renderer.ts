// ============================================================
// SnakeFlow — Snake Renderer
// Creates and animates 3D snake meshes (toy-like style)
// ============================================================

import * as THREE from 'three';
import {
  type Snake, type Vec3I, type Direction,
  DIR_ROTATION, DIR_VECTORS,
} from '../core/types';
import { cellToWorld, lerpVec3 } from '../core/spatial';
import {
  HEAD_RADIUS, BODY_RADIUS, TAIL_RADIUS,
  ARROW_LENGTH, ARROW_RADIUS, EYE_RADIUS, EYE_OFFSET,
} from '../core/constants';

// ============================================================
// Shared geometries (created once, reused)
// ============================================================

const geo = {
  head: new THREE.SphereGeometry(HEAD_RADIUS, 16, 12),
  body: new THREE.SphereGeometry(BODY_RADIUS, 12, 8),
  tail: new THREE.SphereGeometry(TAIL_RADIUS, 10, 8),
  arrow: new THREE.ConeGeometry(ARROW_RADIUS, ARROW_LENGTH, 8),
  eye: new THREE.SphereGeometry(EYE_RADIUS, 8, 6),
  connector: new THREE.CylinderGeometry(BODY_RADIUS * 0.8, BODY_RADIUS * 0.8, 0.7, 8),
};

// ============================================================
// SnakeVisual — all meshes for one snake
// ============================================================

export interface SnakeVisual {
  group: THREE.Group;
  headMesh: THREE.Mesh;
  arrowMesh: THREE.Mesh;
  leftEye: THREE.Group;
  rightEye: THREE.Group;
  bodyMeshes: THREE.Mesh[];
  tailMesh: THREE.Mesh;
  connectorMeshes: THREE.Mesh[];
}

/** Build eye positions offset for a given direction */
function getEyePositions(dir: Direction): [THREE.Vector3, THREE.Vector3] {
  const d = DIR_VECTORS[dir];
  const fwd = HEAD_RADIUS * 0.65;
  const side = EYE_OFFSET;
  const up = EYE_OFFSET * 0.6;

  // Build two perpendicular vectors to the direction
  let perp1: THREE.Vector3;
  let perp2: THREE.Vector3;

  if (d.x !== 0) {
    perp1 = new THREE.Vector3(0, 1, 0);
    perp2 = new THREE.Vector3(0, 0, 1);
  } else if (d.y !== 0) {
    perp1 = new THREE.Vector3(1, 0, 0);
    perp2 = new THREE.Vector3(0, 0, 1);
  } else {
    perp1 = new THREE.Vector3(1, 0, 0);
    perp2 = new THREE.Vector3(0, 1, 0);
  }

  const fwdVec = new THREE.Vector3(d.x, d.y, d.z).multiplyScalar(fwd);
  const eye1 = fwdVec.clone().add(perp1.clone().multiplyScalar(side)).add(perp2.clone().multiplyScalar(up * 0.3));
  const eye2 = fwdVec.clone().add(perp1.clone().multiplyScalar(-side)).add(perp2.clone().multiplyScalar(up * 0.3));

  return [eye1, eye2];
}

/** Create a complete visual for a snake */
export function createSnakeVisual(snake: Snake, gridSize: Vec3I): SnakeVisual {
  const group = new THREE.Group();
  group.userData = { snakeId: snake.id };

  const baseColor = new THREE.Color(snake.color);
  const bodyColor = baseColor.clone().multiplyScalar(0.72);

  // --- Head ---
  const headMat = new THREE.MeshStandardMaterial({
    color: snake.color,
    emissive: snake.color,
    emissiveIntensity: 0.25,
    roughness: 0.35,
    metalness: 0.05,
  });
  const headMesh = new THREE.Mesh(geo.head, headMat);
  group.add(headMesh);

  // --- Arrow (cone pointing in direction) ---
  const arrowMat = new THREE.MeshStandardMaterial({
    color: snake.color,
    emissive: snake.color,
    emissiveIntensity: 0.5,
    roughness: 0.25,
  });
  const arrowMesh = new THREE.Mesh(geo.arrow, arrowMat);
  const rot = DIR_ROTATION[snake.direction];
  arrowMesh.rotation.set(rot.x, rot.y, rot.z);
  group.add(arrowMesh);

  // --- Eyes ---
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.4,
    roughness: 0.2,
  });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.5 });

  function makeEye(): THREE.Group {
    const g = new THREE.Group();
    const eye = new THREE.Mesh(geo.eye, eyeMat);
    g.add(eye);
    const pupil = new THREE.Mesh(geo.eye, pupilMat);
    pupil.scale.setScalar(0.55);
    g.add(pupil);
    // Pupil slightly in front of eye
    const d = DIR_VECTORS[snake.direction];
    pupil.position.set(d.x * EYE_OFFSET * 0.3, d.y * EYE_OFFSET * 0.3, d.z * EYE_OFFSET * 0.3);
    return g;
  }

  const leftEye = makeEye();
  const rightEye = makeEye();
  group.add(leftEye);
  group.add(rightEye);

  // --- Body segments ---
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor.getHex(),
    emissive: snake.color,
    emissiveIntensity: 0.08,
    roughness: 0.45,
    metalness: 0.05,
  });

  const bodyMeshes: THREE.Mesh[] = [];
  for (let i = 1; i < snake.segments.length - 1; i++) {
    const m = new THREE.Mesh(geo.body, bodyMat.clone());
    group.add(m);
    bodyMeshes.push(m);
  }

  // --- Connectors between adjacent segments ---
  const connectorMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < snake.segments.length - 1; i++) {
    const conn = new THREE.Mesh(geo.connector, bodyMat.clone());
    group.add(conn);
    connectorMeshes.push(conn);
  }

  // --- Tail ---
  const tailMat = new THREE.MeshStandardMaterial({
    color: bodyColor.clone().multiplyScalar(0.85).getHex(),
    emissive: snake.color,
    emissiveIntensity: 0.05,
    roughness: 0.55,
  });
  const tailMesh = new THREE.Mesh(geo.tail, tailMat);
  group.add(tailMesh);

  const visual: SnakeVisual = {
    group, headMesh, arrowMesh, leftEye, rightEye,
    bodyMeshes, tailMesh, connectorMeshes,
  };

  // Set initial positions
  updateSnakePositions(visual, snake, gridSize);

  return visual;
}

/** Update all mesh positions for a snake (called every frame) */
export function updateSnakePositions(
  visual: SnakeVisual,
  snake: Snake,
  gridSize: Vec3I,
): void {
  const { headMesh, arrowMesh, leftEye, rightEye, bodyMeshes, tailMesh, connectorMeshes } = visual;
  const t = snake.isMoving ? snake.moveProgress : 1.0;

  // Compute visual positions for each segment
  const visualPositions: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < snake.segments.length; i++) {
    const prev = snake.prevSegments[Math.min(i, snake.prevSegments.length - 1)];
    const curr = snake.segments[i];
    const pw = cellToWorld(prev, gridSize);
    const cw = cellToWorld(curr, gridSize);

    if (snake.isMoving && snake.moveProgress < 1.0) {
      visualPositions.push(lerpVec3(pw.x, pw.y, pw.z, cw.x, cw.y, cw.z, t));
    } else {
      visualPositions.push(cw);
    }
  }

  // --- Position head ---
  if (visualPositions.length > 0) {
    const hp = visualPositions[0];
    headMesh.position.set(hp.x, hp.y, hp.z);

    // Arrow
    const d = DIR_VECTORS[snake.direction];
    arrowMesh.position.set(
      hp.x + d.x * (HEAD_RADIUS + ARROW_LENGTH * 0.35),
      hp.y + d.y * (HEAD_RADIUS + ARROW_LENGTH * 0.35),
      hp.z + d.z * (HEAD_RADIUS + ARROW_LENGTH * 0.35),
    );

    // Eyes
    const [e1, e2] = getEyePositions(snake.direction);
    leftEye.position.set(hp.x + e1.x, hp.y + e1.y, hp.z + e1.z);
    rightEye.position.set(hp.x + e2.x, hp.y + e2.y, hp.z + e2.z);


  }

  // --- Position body segments ---
  for (let i = 0; i < bodyMeshes.length; i++) {
    const segIdx = i + 1; // body mesh 0 = segment[1]
    if (segIdx < visualPositions.length) {
      const p = visualPositions[segIdx];
      bodyMeshes[i].position.set(p.x, p.y, p.z);
    }
  }

  // --- Position tail ---
  if (visualPositions.length > 1) {
    const tp = visualPositions[visualPositions.length - 1];
    tailMesh.position.set(tp.x, tp.y, tp.z);
  } else if (visualPositions.length === 1) {
    tailMesh.visible = false;
  }

  // --- Position connectors ---
  for (let i = 0; i < connectorMeshes.length; i++) {
    const idx1 = i;
    const idx2 = Math.min(i + 1, visualPositions.length - 1);
    if (idx1 < visualPositions.length && idx2 < visualPositions.length) {
      const p1 = visualPositions[idx1];
      const p2 = visualPositions[idx2];
      connectorMeshes[i].position.set(
        (p1.x + p2.x) / 2,
        (p1.y + p2.y) / 2,
        (p1.z + p2.z) / 2,
      );

      // Orient connector
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dz = p2.z - p1.z;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len > 0.01) {
        const up = new THREE.Vector3(0, 1, 0);
        const dir = new THREE.Vector3(dx / len, dy / len, dz / len);
        connectorMeshes[i].quaternion.setFromUnitVectors(up, dir);
      }
      connectorMeshes[i].visible = true;
    } else {
      connectorMeshes[i].visible = false;
    }
  }

  // Visibility management
  for (let i = 0; i < bodyMeshes.length; i++) {
    bodyMeshes[i].visible = (i + 1) < snake.segments.length;
  }
  tailMesh.visible = snake.segments.length > 1;
}

/** Set hover highlight on/off */
export function setSnakeHover(visual: SnakeVisual, hovered: boolean): void {
  const target = hovered ? 1.12 : 1.0;
  // Smooth scale via lerp is handled in the game loop
  visual.group.scale.setScalar(target);
  // Glow ring removed
}

/** Apply stuck shake effect */
export function applyStuckShake(visual: SnakeVisual, timer: number, maxDuration: number): void {
  if (timer >= maxDuration) {
    visual.group.position.set(0, 0, 0);
    return;
  }
  const decay = 1.0 - timer / maxDuration;
  const intensity = 0.07 * decay;
  const freq = 25;
  visual.group.position.set(
    Math.sin(timer * freq) * intensity,
    Math.cos(timer * freq * 1.3 + 1.0) * intensity,
    Math.sin(timer * freq * 0.9 + 2.0) * intensity * 0.5,
  );
}

/** Dispose visual resources (geometries are shared, only dispose materials) */
export function disposeSnakeVisual(visual: SnakeVisual): void {
  visual.group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.material instanceof THREE.Material) {
        child.material.dispose();
      }
    }
  });
}
