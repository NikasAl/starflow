// ============================================================
// Renderer — all Canvas 2D drawing
// ============================================================
import { PLAYER_COLORS, GameState } from '../core/types';
import type { Planet, ShipStream, Vec2 } from '../core/types';
import { quadBezier } from '../utils/math';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false })!;
    this.ctx = ctx;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  get width(): number { return this.w; }
  get height(): number { return this.h; }

  clear(): void {
    const ctx = this.ctx;
    // Dark space background
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, this.w, this.h);

    // Subtle grid
    ctx.strokeStyle = 'rgba(40, 40, 80, 0.15)';
    ctx.lineWidth = 1;
    const gridSize = 80;
    // Grid is in world space, offset by camera
    // We draw it in worldToScreen space — but for performance,
    // just draw a simple background pattern in screen space
  }

  applyCamera(cam: Vec2, zoom: number): void {
    this.ctx.save();
    this.ctx.translate(this.w / 2, this.h / 2);
    this.ctx.scale(zoom, zoom);
    this.ctx.translate(-cam.x, -cam.y);
  }

  restoreCamera(): void {
    this.ctx.restore();
  }

  // --- World-space drawing ---

  drawGrid(cam: Vec2, zoom: number): void {
    const ctx = this.ctx;
    const gridSize = 80;
    const viewW = this.w / zoom;
    const viewH = this.h / zoom;
    const startX = Math.floor((cam.x - viewW / 2) / gridSize) * gridSize;
    const startY = Math.floor((cam.y - viewH / 2) / gridSize) * gridSize;
    const endX = cam.x + viewW / 2 + gridSize;
    const endY = cam.y + viewH / 2 + gridSize;

    ctx.strokeStyle = 'rgba(30, 30, 70, 0.3)';
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();
  }

  drawPlanet(p: Planet): void {
    const ctx = this.ctx;
    const { pos, radius, ownerId, level, pendingShips, selected, hovered } = p;
    const color = PLAYER_COLORS[ownerId] || '#666688';

    // Glow for owned planets
    if (ownerId !== 0) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius + 6, 0, Math.PI * 2);
      ctx.fillStyle = color + '18';
      ctx.fill();
    }

    // Selection ring
    if (selected) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff88';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Hover ring
    if (hovered) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius + 3, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff44';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Planet body
    const grad = ctx.createRadialGradient(
      pos.x - radius * 0.3, pos.y - radius * 0.3, radius * 0.1,
      pos.x, pos.y, radius
    );
    grad.addColorStop(0, lighten(color, 40));
    grad.addColorStop(0.7, color);
    grad.addColorStop(1, darken(color, 30));
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = lighten(color, 20) + '66';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Level indicator — inner ring segments
    if (level > 1) {
      const segAngle = (Math.PI * 2) / level;
      ctx.strokeStyle = '#ffffff44';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < level; i++) {
        const startA = segAngle * i - Math.PI / 2;
        const endA = startA + segAngle * 0.6;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius * 0.55, startA, endA);
        ctx.stroke();
      }
    }

    // Pending ships count
    if (pendingShips > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(pendingShips), pos.x, pos.y);
    }
  }

  drawStream(stream: ShipStream, planets: Planet[]): void {
    const ctx = this.ctx;
    const source = planets.find(p => p.id === stream.sourceId);
    const target = planets.find(p => p.id === stream.targetId);
    if (!source || !target) return;

    const color = PLAYER_COLORS[stream.ownerId] || '#ffffff';

    // Trail line
    ctx.strokeStyle = color + '44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(source.pos.x, source.pos.y);
    ctx.quadraticCurveTo(
      stream.controlPoints[1].x, stream.controlPoints[1].y,
      target.pos.x, target.pos.y
    );
    ctx.stroke();

    // Ship cluster position
    const pos = quadBezier(
      stream.controlPoints[0],
      stream.controlPoints[1],
      stream.controlPoints[2],
      stream.progress
    );

    // Ship dot(s)
    const shipRadius = Math.min(3 + stream.shipCount * 0.3, 12);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, shipRadius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Ship count label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(stream.shipCount), pos.x, pos.y);
  }

  // --- Screen-space UI ---

  drawHUD(state: GameState, planets: Planet[]): void {
    const ctx = this.ctx;

    // Top-left: Score
    const myPlanets = planets.filter(p => p.ownerId === 1);
    const myShips = myPlanets.reduce((s, p) => s + p.pendingShips, 0);

    ctx.fillStyle = '#ffffffcc';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Планеты: ${myPlanets.length}`, 16, 16);
    ctx.fillText(`Корабли: ${myShips}`, 16, 40);

    // Instructions (bottom center)
    ctx.fillStyle = '#ffffff55';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Клик — выбрать планету | Клик по чужой — отправить корабли | ПКМ — перемещение | Колёсико — масштаб', this.w / 2, this.h - 12);
  }

  drawPlanetInfo(planet: Planet): void {
    const ctx = this.ctx;
    const margin = 16;
    const pw = 220;
    const ph = 90;
    const px = margin;
    const py = this.h - margin - ph;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    roundRect(ctx, px, py, pw, ph, 8);
    ctx.fill();
    ctx.strokeStyle = PLAYER_COLORS[planet.ownerId] + '88';
    ctx.lineWidth = 1;
    roundRect(ctx, px, py, pw, ph, 8);
    ctx.stroke();

    // Text
    ctx.fillStyle = '#ffffffdd';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const names: Record<number, string> = { 0: 'Нейтральная', 1: 'Игрок', 2: 'AI 1', 3: 'AI 2', 4: 'AI 3' };
    ctx.fillText(planet.pos ? `Планета #${planet.id}` : 'Планета', px + 12, py + 10);
    ctx.font = '12px monospace';
    ctx.fillStyle = '#ffffffaa';
    ctx.fillText(`Владелец: ${names[planet.ownerId] || '?'}`, px + 12, py + 32);
    ctx.fillText(`Уровень: ${planet.level}  |  Корабли: ${planet.pendingShips}`, px + 12, py + 50);
    ctx.fillText(`Производство: ${(planet.productionRate * planet.level).toFixed(1)}/с`, px + 12, py + 68);
  }
}

// Helpers
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + amount, g + amount, b + amount);
}

function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r - amount, g - amount, b - amount);
}
