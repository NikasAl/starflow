// ============================================================
// Star Flow Command — Procedural Planet Texture Generator
// ============================================================

import * as THREE from 'three';

export type PlanetVisualType =
  | 'rocky' | 'terran' | 'gas' | 'ice'
  | 'volcanic' | 'desert' | 'ocean' | 'crystal';

const TEX_W = 512;
const TEX_H = 256;

// ---- Seeded PRNG ----

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2D(ix: number, iy: number, _seed: number): number {
  const n = ix * 374761393 + iy * 668265263 + _seed;
  const a = (n ^ (n >> 13)) * 1274126177;
  return ((a ^ (a >> 16)) >>> 0) / 4294967296;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smoothstep(x - ix, 0, 1);
  const fy = smoothstep(y - iy, 0, 1);
  return lerp(
    lerp(hash2D(ix, iy, seed), hash2D(ix + 1, iy, seed), fx),
    lerp(hash2D(ix, iy + 1, seed), hash2D(ix + 1, iy + 1, seed), fx),
    fy,
  );
}

function fbm(x: number, y: number, octaves: number, seed: number): number {
  let v = 0, amp = 0.5, freq = 1, total = 0;
  for (let i = 0; i < octaves; i++) {
    v += valueNoise(x * freq, y * freq, seed + i * 137) * amp;
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return v / total;
}

function warpedNoise(x: number, y: number, octaves: number, seed: number): number {
  const w = fbm(x, y, 3, seed + 999);
  return fbm(x + w * 3, y + w * 3, octaves, seed);
}

// ---- Color helpers ----

function rgb(r: number, g: number, b: number): number {
  return ((Math.floor(r * 255) & 0xff) << 16) |
         ((Math.floor(g * 255) & 0xff) << 8) |
         (Math.floor(b * 255) & 0xff);
}

function ownerTint(ownerColor: number, base: number[]): number[] {
  const or = ((ownerColor >> 16) & 0xff) / 255;
  const og = ((ownerColor >> 8) & 0xff) / 255;
  const ob = (ownerColor & 0xff) / 255;
  const t = 0.4;  // Stronger owner color tint
  return [lerp(base[0], or, t), lerp(base[1], og, t), lerp(base[2], ob, t)];
}

function computeNormal(h: number, d: number, s: number): [number, number, number] {
  return [
    Math.max(0, Math.min(255, 128 + (d - 0.5) * s * 200)),
    Math.max(0, Math.min(255, 128 + (h - 0.5) * s * 200)),
    255,
  ];
}

// ---- Texture generation ----

export interface TextureSet {
  diffuse: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  emissive: THREE.CanvasTexture | null;
}

function makeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = TEX_W; c.height = TEX_H;
  return c;
}

function toTex(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

export function generatePlanetTextures(
  type: PlanetVisualType,
  seed: number,
  ownerColor: number,
): TextureSet {
  const dC = makeCanvas(), nC = makeCanvas(), eC = makeCanvas();
  const dCtx = dC.getContext('2d')!;
  const nCtx = nC.getContext('2d')!;
  const eCtx = eC.getContext('2d')!;
  const dImg = dCtx.createImageData(TEX_W, TEX_H);
  const nImg = nCtx.createImageData(TEX_W, TEX_H);
  const eImg = eCtx.createImageData(TEX_W, TEX_H);

  const hasEmissive = type === 'volcanic' || type === 'crystal';

  for (let y = 0; y < TEX_H; y++) {
    for (let x = 0; x < TEX_W; x++) {
      const i = (y * TEX_W + x) * 4;
      const u = x / TEX_W, v = y / TEX_H;
      const nx = u * 8, ny = v * 4;
      const n1 = fbm(nx, ny, 6, seed);
      const n2 = warpedNoise(nx, ny, 4, seed + 42);
      const n3 = fbm(nx * 2, ny * 2, 3, seed + 137);

      const { r, g, b, nr, ng, nb, er = 0, eg = 0, eb = 0 } =
        genPixel(type, n1, n2, n3, u, v, ownerColor);

      dImg.data[i] = clamp(r); dImg.data[i+1] = clamp(g);
      dImg.data[i+2] = clamp(b); dImg.data[i+3] = 255;
      nImg.data[i] = clamp(nr); nImg.data[i+1] = clamp(ng);
      nImg.data[i+2] = clamp(nb); nImg.data[i+3] = 255;
      eImg.data[i] = clamp(er); eImg.data[i+1] = clamp(eg);
      eImg.data[i+2] = clamp(eb); eImg.data[i+3] = 255;
    }
  }

  dCtx.putImageData(dImg, 0, 0);
  nCtx.putImageData(nImg, 0, 0);
  eCtx.putImageData(eImg, 0, 0);

  return {
    diffuse: toTex(dC),
    normal: toTex(nC),
    emissive: hasEmissive ? toTex(eC) : null,
  };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, v));
}

interface PixelResult {
  r: number; g: number; b: number;
  nr: number; ng: number; nb: number;
  er?: number; eg?: number; eb?: number;
}

function genPixel(
  type: PlanetVisualType, n1: number, n2: number, n3: number,
  u: number, v: number, oc: number,
): PixelResult {
  const N = (s: number) => computeNormal(n1, n2, s);
  const E = [0, 0, 0];

  switch (type) {
    case 'rocky': {
      const dk = ownerTint(oc, [0.25, 0.22, 0.2]);
      const lt = ownerTint(oc, [0.55, 0.5, 0.45]);
      let r = lerp(dk[0], lt[0], n1), g = lerp(dk[1], lt[1], n1), b = lerp(dk[2], lt[2], n1);
      const cr = smoothstep(0.45, 0.55, n3) * 0.5;
      r = lerp(r, dk[0] * 0.7, cr); g = lerp(g, dk[1] * 0.7, cr); b = lerp(b, dk[2] * 0.7, cr);
      const [nr, ng, nb] = N(0.8);
      return { r: r*255, g: g*255, b: b*255, nr, ng, nb };
    }

    case 'terran': {
      const sea = 0.42, isLand = n1 > sea, isPole = v < 0.15 || v > 0.85;
      let r: number, g: number, b: number;
      if (isPole) {
        const ice = ownerTint(oc, [0.85, 0.9, 0.95]);
        r = ice[0]+n2*0.1; g = ice[1]+n2*0.1; b = ice[2]+n2*0.1;
      } else if (!isLand) {
        const dp = ownerTint(oc, [0.05, 0.1, 0.35]);
        const sh = ownerTint(oc, [0.1, 0.25, 0.5]);
        const d = smoothstep(0.2, sea, n1);
        r = lerp(dp[0], sh[0], d); g = lerp(dp[1], sh[1], d); b = lerp(dp[2], sh[2], d);
        const coast = 1 - smoothstep(0, 0.05, sea - n1);
        r = lerp(r, 0.7, coast*0.3); g = lerp(g, 0.8, coast*0.3); b = lerp(b, 0.85, coast*0.3);
      } else {
        const el = (n1 - sea) / (1 - sea);
        const trop = ownerTint(oc, [0.15, 0.45, 0.12]);
        const temp = ownerTint(oc, [0.3, 0.4, 0.15]);
        const mtn = ownerTint(oc, [0.45, 0.4, 0.35]);
        const snow = [0.9, 0.9, 0.92];
        if (el > 0.6) {
          const mt = smoothstep(0.6, 0.85, el);
          r = lerp(mtn[0], snow[0], mt); g = lerp(mtn[1], snow[1], mt); b = lerp(mtn[2], snow[2], mt);
        } else {
          const bio = smoothstep(0.1, 0.4, v) + n2 * 0.3;
          r = lerp(trop[0], temp[0], bio); g = lerp(trop[1], temp[1], bio); b = lerp(trop[2], temp[2], bio);
        }
        r += (n2-0.5)*0.08; g += (n2-0.5)*0.06;
      }
      const [nr, ng, nb] = N(isLand ? 1.2 : 0.3);
      return { r: r*255, g: g*255, b: b*255, nr, ng, nb };
    }

    case 'gas': {
      const band = Math.sin(v * Math.PI * 12 + n1 * 4) * 0.5 + 0.5;
      const swirl = Math.sin(u * Math.PI * 6 + n2 * 8 + v * 3) * 0.3;
      const c1 = ownerTint(oc, [0.7, 0.5, 0.3]);
      const c2 = ownerTint(oc, [0.5, 0.3, 0.2]);
      const c3 = ownerTint(oc, [0.85, 0.7, 0.4]);
      const spot = ownerTint(oc, [0.9, 0.3, 0.2]);
      let r = lerp(c1[0], c2[0], band), g = lerp(c1[1], c2[1], band), b = lerp(c1[2], c2[2], band);
      const lb = smoothstep(0.4, 0.6, band + swirl);
      r = lerp(r, c3[0], lb*0.4); g = lerp(g, c3[1], lb*0.4); b = lerp(b, c3[2], lb*0.4);
      const sd = Math.sqrt((u-0.6)**2*4 + (v-0.5)**2*16);
      const sm = 1 - smoothstep(0.05, 0.15, sd);
      r = lerp(r, spot[0], sm); g = lerp(g, spot[1], sm); b = lerp(b, spot[2], sm);
      r += (n3-0.5)*0.06; g += (n3-0.5)*0.04;
      const [nr, ng, nb] = N(0.2);
      return { r: r*255, g: g*255, b: b*255, nr, ng, nb };
    }

    case 'ice': {
      const base = ownerTint(oc, [0.75, 0.82, 0.92]);
      const crack = ownerTint(oc, [0.3, 0.4, 0.6]);
      const hi = ownerTint(oc, [0.9, 0.93, 0.98]);
      let r = base[0]+n1*0.1, g = base[1]+n1*0.08, b = base[2]+n1*0.06;
      const cv = 1 - smoothstep(0, 0.08, Math.abs(Math.sin(n2*20)*Math.cos(n3*15)));
      r = lerp(r, crack[0], cv*0.7); g = lerp(g, crack[1], cv*0.7); b = lerp(b, crack[2], cv*0.7);
      const sm = smoothstep(0.4, 0.7, n1);
      r = lerp(r, hi[0], sm*0.2); g = lerp(g, hi[1], sm*0.2); b = lerp(b, hi[2], sm*0.2);
      const [nr, ng, nb] = N(0.5);
      return { r: r*255, g: g*255, b: b*255, nr, ng, nb };
    }

    case 'volcanic': {
      const dk = [0.12, 0.08, 0.06], rk = [0.25, 0.18, 0.12];
      const la = [1.0, 0.3, 0.0], hl = [1.0, 0.7, 0.1];
      let r = lerp(dk[0], rk[0], n1), g = lerp(dk[1], rk[1], n1), b = lerp(dk[2], rk[2], n1);
      const vein = 1 - smoothstep(0, 0.06, Math.abs(Math.sin(n3*25+n2*10)));
      const lc = n2 > 0.6 ? hl : la;
      r = lerp(r, lc[0], vein); g = lerp(r, lc[1], vein); b = lerp(b, lc[2], vein);
      const [nr, ng, nb] = N(0.8);
      return { r: r*255, g: g*255, b: b*255, nr, ng, nb,
               er: vein*lc[0]*255, eg: vein*lc[1]*255, eb: vein*lc[2]*255 };
    }

    case 'desert': {
      const sand = ownerTint(oc, [0.75, 0.6, 0.35]);
      const dk = ownerTint(oc, [0.55, 0.4, 0.2]);
      const rk = ownerTint(oc, [0.45, 0.35, 0.25]);
      const dune = Math.sin(n1*15+n3*8)*0.5+0.5;
      let r = lerp(dk[0], sand[0], dune), g = lerp(dk[1], sand[1], dune), b = lerp(dk[2], sand[2], dune);
      const rm = smoothstep(0.55, 0.7, n2);
      r = lerp(r, rk[0], rm*0.4); g = lerp(g, rk[1], rm*0.4); b = lerp(b, rk[2], rm*0.4);
      r += (n3-0.5)*0.05; g += (n3-0.5)*0.04;
      const [nr, ng, nb] = N(0.6);
      return { r: r*255, g: g*255, b: b*255, nr, ng, nb };
    }

    case 'ocean': {
      const dp = ownerTint(oc, [0.02, 0.05, 0.2]);
      const md = ownerTint(oc, [0.05, 0.15, 0.4]);
      const sf = ownerTint(oc, [0.1, 0.3, 0.55]);
      const pl = ownerTint(oc, [0.6, 0.7, 0.8]);
      const isPole = v < 0.12 || v > 0.88;
      let r: number, g: number, b: number;
      if (isPole) {
        const ice = smoothstep(0.88, 0.95, v) + smoothstep(0.12, 0.05, v);
        r = lerp(md[0], pl[0], ice); g = lerp(md[1], pl[1], ice); b = lerp(md[2], pl[2], ice);
      } else {
        const d = smoothstep(0, 0.6, n1);
        r = lerp(dp[0], sf[0], d); g = lerp(dp[1], sf[1], d); b = lerp(dp[2], sf[2], d);
        const w = Math.sin(n2*30+n3*15)*0.03;
        r += w; g += w*1.5; b += w*2;
        const isle = smoothstep(0.7, 0.8, n1);
        const ic = ownerTint(oc, [0.2, 0.35, 0.15]);
        r = lerp(r, ic[0], isle*0.5); g = lerp(g, ic[1], isle*0.5); b = lerp(b, ic[2], isle*0.5);
      }
      const [nr, ng, nb] = N(0.3);
      return { r: r*255, g: g*255, b: b*255, nr, ng, nb };
    }

    case 'crystal': {
      const base = ownerTint(oc, [0.2, 0.15, 0.35]);
      const cry = ownerTint(oc, [0.5, 0.3, 0.7]);
      const glow = ownerTint(oc, [0.3, 0.6, 0.9]);
      const facet = Math.abs(Math.sin(n1*20)*Math.sin(n2*20));
      let r = lerp(base[0], cry[0], facet), g = lerp(base[1], cry[1], facet), b = lerp(base[2], cry[2], facet);
      const vein = 1 - smoothstep(0, 0.1, Math.abs(Math.sin(n3*30)));
      r = lerp(r, glow[0], vein*0.6); g = lerp(g, glow[1], vein*0.6); b = lerp(b, glow[2], vein*0.6);
      const [nr, ng, nb] = N(1.0);
      return { r: r*255, g: g*255, b: b*255, nr, ng, nb,
               er: vein*glow[0]*80, eg: vein*glow[1]*80, eb: vein*glow[2]*80 };
    }
  }
}

export function planetTypeForIndex(index: number, tier: 1 | 2 | 3): PlanetVisualType {
  const types: PlanetVisualType[] = ['terran', 'rocky', 'gas', 'ice', 'ocean', 'desert', 'crystal', 'volcanic'];
  if (tier === 3) return (['gas', 'ocean', 'crystal'] as PlanetVisualType[])[index % 3];
  return types[(index * 7 + tier * 3) % types.length];
}
