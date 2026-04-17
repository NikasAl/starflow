// ============================================================
// Star Flow Command — Entry Point
// ============================================================
import { Game } from './game/game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
if (!canvas) {
  throw new Error('Canvas element #game not found');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const game = new Game(canvas);
