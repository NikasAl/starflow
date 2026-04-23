// ============================================================
// Star Flow Command — Sound Definitions & Configuration
// ============================================================

import { SFX, MUSIC } from './sound-ids';

export type SoundCategory = 'music' | 'sfx' | 'ui';

export interface SoundDefinition {
  /** File path relative to public/audio/ */
  file: string;
  /** Default volume 0-1 */
  volume: number;
  /** Category for volume control */
  category: SoundCategory;
  /** Whether to preload on game start */
  preload: boolean;
  /** Playback rate variation range for organic feel (SFX only) */
  pitchRange?: [number, number];
}

/**
 * All sound definitions.
 * File paths point to real audio files the user will provide later.
 * When files are missing, the AudioManager gracefully logs a warning
 * instead of crashing.
 */
export const SOUND_DEFINITIONS: Record<string, SoundDefinition> = {
  // ── SFX ──────────────────────────────────────────────────
  [SFX.UI_CLICK]: {
    file: 'sfx/ui_click.ogg',
    volume: 0.5,
    category: 'ui',
    preload: true,
  },
  [SFX.MENU_OPEN]: {
    file: 'sfx/menu_open.ogg',
    volume: 0.4,
    category: 'ui',
    preload: true,
  },
  [SFX.PLANET_SELECT]: {
    file: 'sfx/planet_select.ogg',
    volume: 0.6,
    category: 'sfx',
    preload: true,
    pitchRange: [0.9, 1.1],
  },
  [SFX.ROUTE_CREATE]: {
    file: 'sfx/route_create.ogg',
    volume: 0.5,
    category: 'sfx',
    preload: true,
  },
  [SFX.ROUTE_DISCONNECT]: {
    file: 'sfx/route_disconnect.ogg',
    volume: 0.4,
    category: 'sfx',
    preload: true,
  },
  [SFX.MISSILE_LAUNCH]: {
    file: 'sfx/missile_launch.ogg',
    volume: 0.3,
    category: 'sfx',
    preload: true,
    pitchRange: [0.85, 1.15],
  },
  [SFX.MISSILE_HIT]: {
    file: 'sfx/missile_hit.ogg',
    volume: 0.5,
    category: 'sfx',
    preload: true,
  },
  [SFX.EXPLOSION]: {
    file: 'sfx/explosion.ogg',
    volume: 0.6,
    category: 'sfx',
    preload: true,
    pitchRange: [0.8, 1.2],
  },
  [SFX.PLANET_CAPTURE]: {
    file: 'sfx/planet_capture.ogg',
    volume: 0.6,
    category: 'sfx',
    preload: true,
  },
  [SFX.GRAVITY_WELL]: {
    file: 'sfx/gravity_well.ogg',
    volume: 0.2,
    category: 'sfx',
    preload: false,
  },
  [SFX.STAR_DANGER]: {
    file: 'sfx/star_danger.ogg',
    volume: 0.15,
    category: 'sfx',
    preload: false,
  },
  [SFX.VICTORY]: {
    file: 'sfx/victory.ogg',
    volume: 0.7,
    category: 'sfx',
    preload: true,
  },
  [SFX.DEFEAT]: {
    file: 'sfx/defeat.ogg',
    volume: 0.7,
    category: 'sfx',
    preload: true,
  },

  // ── Music ────────────────────────────────────────────────
  [MUSIC.AMBIENT_SPACE]: {
    file: 'music/ambient_space.ogg',
    volume: 0.3,
    category: 'music',
    preload: true,
  },
  [MUSIC.BATTLE_INTENSE]: {
    file: 'music/battle_intense.ogg',
    volume: 0.35,
    category: 'music',
    preload: false,
  },
  [MUSIC.MENU_THEME]: {
    file: 'music/menu_theme.ogg',
    volume: 0.3,
    category: 'music',
    preload: true,
  },
};
