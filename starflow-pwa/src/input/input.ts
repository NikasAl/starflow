// ============================================================
// Input Handler — mouse + touch
// ============================================================
import { PlayerId, CLICK_DOUBLE_THRESHOLD } from '../core/types';
import type { Planet, Vec2 } from '../core/types';
import { screenToWorld, dist } from '../utils/math';

export class InputHandler {
  private selectedPlanet: Planet | null = null;
  private hoveredPlanet: Planet | null = null;
  private lastClickTime = 0;

  // Camera panning state
  private isPanning = false;
  private panStart: Vec2 = { x: 0, y: 0 };
  private camStart: Vec2 = { x: 0, y: 0 };

  private cam: Vec2;
  private zoom: number;
  private canvasW: number;
  private canvasH: number;

  onStreamRequest: ((source: Planet, target: Planet) => void) | null = null;
  onHoverChange: ((planet: Planet | null) => void) | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private getPlanets: () => Planet[]
  ) {
    this.cam = { x: 0, y: 0 };
    this.zoom = 1;
    this.canvasW = canvas.width;
    this.canvasH = canvas.height;

    canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
    canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
    canvas.addEventListener('pointerup', this.onPointerUp.bind(this));
    canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  updateViewport(w: number, h: number): void {
    this.canvasW = w;
    this.canvasH = h;
  }

  getCamera(): Vec2 { return this.cam; }
  getZoom(): number { return this.zoom; }

  private worldFromEvent(e: PointerEvent): Vec2 {
    return screenToWorld(e.clientX, e.clientY, this.cam, this.zoom, this.canvasW, this.canvasH);
  }

  private planetAt(worldPos: Vec2): Planet | null {
    const planets = this.getPlanets();
    for (let i = planets.length - 1; i >= 0; i--) {
      const p = planets[i];
      if (dist(worldPos, p.pos) <= p.radius + 4) {
        return p;
      }
    }
    return null;
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button === 2 || e.button === 1) {
      // Right/middle click — pan
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.camStart = { ...this.cam };
      this.canvas.setPointerCapture(e.pointerId);
      return;
    }

    if (e.button !== 0) return;

    const worldPos = this.worldFromEvent(e);
    const planet = this.planetAt(worldPos);
    const now = performance.now();
    const isDouble = (now - this.lastClickTime) < CLICK_DOUBLE_THRESHOLD;
    this.lastClickTime = now;

    if (isDouble && planet) {
      // Double-click — focus camera
      this.cam = { ...planet.pos };
      return;
    }

    if (!planet) {
      // Click empty space — deselect
      this.deselect();
      return;
    }

    if (planet.ownerId === PlayerId.PLAYER) {
      // Select player's planet
      this.selectPlanet(planet);
      return;
    }

    // Click on non-player planet with selection active — send stream
    if (this.selectedPlanet && this.selectedPlanet !== planet) {
      this.onStreamRequest?.(this.selectedPlanet, planet);
      this.deselect();
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.isPanning) {
      const dx = e.clientX - this.panStart.x;
      const dy = e.clientY - this.panStart.y;
      this.cam.x = this.camStart.x - dx / this.zoom;
      this.cam.y = this.camStart.y - dy / this.zoom;
      return;
    }

    // Hover detection
    const worldPos = this.worldFromEvent(e);
    const planet = this.planetAt(worldPos);

    if (planet !== this.hoveredPlanet) {
      if (this.hoveredPlanet) this.hoveredPlanet.hovered = false;
      this.hoveredPlanet = planet;
      if (planet) planet.hovered = true;
      this.onHoverChange?.(planet);
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (e.button === 2 || e.button === 1) {
      this.isPanning = false;
      this.canvas.releasePointerCapture(e.pointerId);
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    this.zoom = Math.max(0.3, Math.min(2.5, this.zoom * factor));
  }

  private selectPlanet(planet: Planet): void {
    this.deselect();
    planet.selected = true;
    this.selectedPlanet = planet;
  }

  private deselect(): void {
    if (this.selectedPlanet) {
      this.selectedPlanet.selected = false;
      this.selectedPlanet = null;
    }
  }
}
