// ============================================================
// Stream Manager — update streams, handle arrival
// ============================================================
import type { Planet, ShipStream } from '../core/types';
import { receiveShip } from './state';

export function updateStreams(streams: ShipStream[], planets: Planet[], delta: number): ShipStream[] {
  const alive: ShipStream[] = [];

  for (const stream of streams) {
    if (!stream.alive) continue;

    stream.progress += stream.speed * delta;

    if (stream.progress >= 1.0) {
      // Arrived at target
      const target = planets.find(p => p.id === stream.targetId);
      if (target) {
        receiveShip(target, stream.ownerId, stream.shipCount);
      }
      stream.alive = false;
    } else {
      alive.push(stream);
    }
  }

  return alive;
}
