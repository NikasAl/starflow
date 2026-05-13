// ============================================================
// Рой — Собиратель (Swarm: Collector) — Input Controls
// Keyboard + touch support for leader control
// ============================================================

export class Controls {
  private keys = new Set<string>();
  private _wantsBoost = false;
  private canvas: HTMLCanvasElement | null = null;

  // Touch state
  private touchId: number | null = null;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchCurrentX = 0;
  private touchCurrentY = 0;

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;

    // Keyboard
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // Touch — left half of screen for direction
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', this.onTouchEnd, { passive: false });

    // Mouse for desktop (optional — hold right click to steer)
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('mousemove', this.onMouseMove);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    if (this.canvas) {
      this.canvas.removeEventListener('touchstart', this.onTouchStart);
      this.canvas.removeEventListener('touchmove', this.onTouchMove);
      this.canvas.removeEventListener('touchend', this.onTouchEnd);
      this.canvas.removeEventListener('touchcancel', this.onTouchEnd);
      this.canvas.removeEventListener('mousedown', this.onMouseDown);
      this.canvas.removeEventListener('mouseup', this.onMouseUp);
      this.canvas.removeEventListener('mousemove', this.onMouseMove);
    }
  }

  /** Get normalized input direction {x, y} from -1 to 1 */
  getDirection(): { x: number; y: number } {
    // Keyboard input
    let kx = 0;
    let ky = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ky += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ky -= 1;

    const keyLen = Math.sqrt(kx * kx + ky * ky);
    if (keyLen > 0.001) {
      return { x: kx / keyLen, y: ky / keyLen };
    }

    // Touch input
    if (this.touchId !== null) {
      const dx = (this.touchCurrentX - this.touchStartX) / 60; // normalize by pixels
      const dy = (this.touchStartY - this.touchCurrentY) / 60; // invert Y (up = positive)
      const touchLen = Math.sqrt(dx * dx + dy * dy);
      if (touchLen > 0.05) {
        const clamped = Math.min(touchLen, 1.0);
        return { x: (dx / touchLen) * clamped, y: (dy / touchLen) * clamped };
      }
    }

    return { x: 0, y: 0 };
  }

  /** Whether boost is requested this frame */
  wantsBoost(): boolean {
    if (this.keys.has('Space')) return true;
    if (this._wantsBoost) {
      this._wantsBoost = false;
      return true;
    }
    return false;
  }

  // --- Keyboard handlers ---

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  // --- Touch handlers ---

  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    if (!touch) return;

    const rect = this.canvas!.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    // Right half = boost, left half = direction
    if (x > rect.width * 0.5) {
      this._wantsBoost = true;
    } else {
      this.touchId = touch.identifier;
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.touchCurrentX = touch.clientX;
      this.touchCurrentY = touch.clientY;
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.touchId) {
        this.touchCurrentX = touch.clientX;
        this.touchCurrentY = touch.clientY;
      }
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchId) {
        this.touchId = null;
      }
    }
  };

  // --- Mouse handlers (hold right-click to steer) ---

  private mouseDown = false;

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 2) {
      // Right click = direction
      this.mouseDown = true;
      this.touchStartX = e.clientX;
      this.touchStartY = e.clientY;
      this.touchCurrentX = e.clientX;
      this.touchCurrentY = e.clientY;
      e.preventDefault();
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 2) {
      this.mouseDown = false;
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.mouseDown) {
      this.touchCurrentX = e.clientX;
      this.touchCurrentY = e.clientY;
    }
  };
}
