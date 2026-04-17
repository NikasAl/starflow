// ============================================================
// Game — main game loop and orchestration
// ============================================================
import { PlayerId, GameState, DEFAULT_CONFIG } from '../core/types';
import type { Planet, ShipStream, LevelConfig } from '../core/types';
import { generateLevel, createStream, receiveShip } from './state';
import { updateProduction, resetProduction } from './production';
import { updateStreams } from './streams';
import { initAI, updateAI } from '../ai/ai';
import { Renderer } from '../render/renderer';
import { InputHandler } from '../input/input';

export class Game {
  private renderer: Renderer;
  private input: InputHandler;

  private planets: Planet[] = [];
  private streams: ShipStream[] = [];
  private gameState: GameState = GameState.MENU;
  private lastTime = 0;
  private aiPlayers: PlayerId[] = [];

  private hoveredPlanet: Planet | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);

    this.input = new InputHandler(canvas, () => this.planets);
    this.input.onStreamRequest = (source, target) => this.handleStreamRequest(source, target);
    this.input.onHoverChange = (p) => { this.hoveredPlanet = p; };

    // Handle resize
    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.input.updateViewport(this.renderer.width, this.renderer.height);
    });

    // Start the game loop
    this.lastTime = performance.now();
    this.startLevel(DEFAULT_CONFIG);
    requestAnimationFrame(this.loop.bind(this));
  }

  private startLevel(config: LevelConfig): void {
    this.planets = generateLevel(config);
    this.streams = [];
    this.gameState = GameState.PLAYING;
    resetProduction();

    // Determine AI players
    this.aiPlayers = [];
    for (let i = 1; i <= config.aiCount; i++) {
      this.aiPlayers.push((i + 1) as PlayerId);
    }
    initAI(this.aiPlayers);
  }

  private handleStreamRequest(source: Planet, target: Planet): void {
    const shipCount = Math.max(source.pendingShips, 1);
    this.streams.push(createStream(source, target, source.ownerId, shipCount));
    source.pendingShips = 0;
  }

  private loop = (time: number): void => {
    const delta = Math.min((time - this.lastTime) / 1000, 0.1); // cap at 100ms
    this.lastTime = time;

    if (this.gameState === GameState.PLAYING) {
      this.update(delta);
    }

    this.draw();
    requestAnimationFrame(this.loop);
  };

  private update(delta: number): void {
    // Production
    updateProduction(this.planets, delta);

    // Streams
    this.streams = updateStreams(this.streams, this.planets, delta);

    // AI
    const newAIStreams: ShipStream[] = [];
    updateAI(delta, this.planets, this.aiPlayers, newAIStreams);
    for (const s of newAIStreams) {
      this.streams.push(s);
    }

    // Check victory
    const owners = new Set(this.planets.map(p => p.ownerId).filter(o => o !== PlayerId.NONE));
    if (owners.size === 1 && !owners.has(PlayerId.PLAYER) && this.planets.length > 0) {
      this.gameState = GameState.DEFEAT;
    }
    if (owners.size === 1 && owners.has(PlayerId.PLAYER) && this.planets.some(p => p.ownerId !== PlayerId.PLAYER)) {
      // Check if all planets are player's (no neutrals)
      if (this.planets.every(p => p.ownerId === PlayerId.PLAYER)) {
        this.gameState = GameState.VICTORY;
      }
    }
  }

  private draw(): void {
    const r = this.renderer;
    const cam = this.input.getCamera();
    const zoom = this.input.getZoom();

    r.clear();

    // World-space drawing
    r.applyCamera(cam, zoom);
    r.drawGrid(cam, zoom);

    for (const planet of this.planets) {
      r.drawPlanet(planet);
    }

    for (const stream of this.streams) {
      r.drawStream(stream, this.planets);
    }

    r.restoreCamera();

    // Screen-space HUD
    r.drawHUD(this.gameState, this.planets);

    if (this.hoveredPlanet) {
      r.drawPlanetInfo(this.hoveredPlanet);
    }

    // Victory / Defeat overlay
    if (this.gameState === GameState.VICTORY || this.gameState === GameState.DEFEAT) {
      this.drawEndScreen();
    }
  }

  private drawEndScreen(): void {
    const r = this.renderer;
    const ctx = (r as any).ctx as CanvasRenderingContext2D;
    const w = r.width;
    const h = r.height;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.gameState === GameState.VICTORY) {
      ctx.fillStyle = '#33ff66';
      ctx.font = 'bold 48px sans-serif';
      ctx.fillText('ПОБЕДА!', w / 2, h / 2 - 20);
    } else {
      ctx.fillStyle = '#ff3344';
      ctx.font = 'bold 48px sans-serif';
      ctx.fillText('ПОРАЖЕНИЕ', w / 2, h / 2 - 20);
    }

    ctx.fillStyle = '#ffffff88';
    ctx.font = '20px sans-serif';
    ctx.fillText('Кликните чтобы начать заново', w / 2, h / 2 + 30);

    // Restart on click
    if (!this._restartListenerAdded) {
      this._restartListenerAdded = true;
      const handler = () => {
        (r as any).canvas.removeEventListener('pointerdown', handler);
        this._restartListenerAdded = false;
        this.startLevel(DEFAULT_CONFIG);
      };
      (r as any).canvas.addEventListener('pointerdown', handler);
    }
  }

  private _restartListenerAdded = false;
}
