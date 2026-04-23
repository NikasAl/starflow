// ============================================================
// Star Flow Command — Audio Manager
// Lightweight Web Audio API wrapper with caching, categories,
// fade support, and Android WebView compatibility.
// ============================================================

import { SOUND_DEFINITIONS, type SoundCategory } from './sound-config';

// ── Internal types ─────────────────────────────────────────

interface PlayOptions {
  /** Override the definition's default volume (0-1) */
  volume?: number;
  /** Playback rate multiplier (e.g. 0.8 – 1.2 for pitch variation) */
  pitch?: number;
}

interface MusicPlayOptions {
  volume?: number;
  /** Fade-in duration in seconds (default 0 = no fade) */
  fadeIn?: number;
}

interface ActiveMusic {
  source: AudioBufferSourceNode;
  gain: GainNode;
  buffer: AudioBuffer;
  /** True while a fade-out is in progress */
  fading: boolean;
}

// ── AudioManager ───────────────────────────────────────────

export class AudioManager {
  private ctx: AudioContext | null = null;
  private cache = new Map<string, AudioBuffer>();
  private activeMusic: ActiveMusic | null = null;
  private masterVolume = 1;
  private categoryVolumes: Record<SoundCategory, number> = {
    music: 1,
    sfx: 1,
    ui: 1,
  };
  private muted = false;
  private unlockAttempted = false;
  private onUnmuteCallback: (() => void) | null = null;

  // ── Context lifecycle ────────────────────────────────────

  /** Lazily create the AudioContext. */
  private ensureContext(): AudioContext | null {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      // Resume if suspended (iOS / Android)
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    } catch {
      console.warn('[AudioManager] Cannot create AudioContext');
      return null;
    }
  }

  /**
   * Unlock the AudioContext.  Must be called from a user gesture
   * (click / touchstart) on mobile browsers / Android WebView,
   * otherwise audio playback will be silently blocked.
   */
  async unlock(): Promise<void> {
    if (this.unlockAttempted) return;
    this.unlockAttempted = true;
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      try { await ctx.resume(); } catch { /* ignore */ }
    }
  }

  /** Suspend audio (call when app goes to background on Android). */
  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  /** Resume audio (call when app returns to foreground on Android). */
  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // ── Loading ──────────────────────────────────────────────

  /**
   * Preload a sound file into the decode cache.
   * If the fetch or decode fails, a warning is logged — the game
   * continues silently (placeholder mode).
   */
  async load(name: string, url: string): Promise<void> {
    if (this.cache.has(name)) return;
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        console.warn(`[AudioManager] Failed to fetch "${url}" — status ${resp.status}`);
        return;
      }
      const arrayBuf = await resp.arrayBuffer();
      const ctx = this.ensureContext();
      if (!ctx) return;
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      this.cache.set(name, audioBuf);
    } catch (err) {
      console.warn(`[AudioManager] Failed to load "${url}":`, err);
    }
  }

  /**
   * Bulk-preload every sound marked `preload: true` in
   * SOUND_DEFINITIONS.  Safe to call multiple times; skips
   * already-cached entries.
   */
  async preloadAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const [name, def] of Object.entries(SOUND_DEFINITIONS)) {
      if (def.preload) {
        promises.push(this.load(name, `/audio/${def.file}`));
      }
    }
    await Promise.allSettled(promises);
  }

  // ── SFX playback ─────────────────────────────────────────

  /**
   * Play a one-shot sound effect.
   * If the buffer isn't cached, attempts an on-demand load first.
   */
  play(name: string, options?: PlayOptions): void {
    if (this.muted) return;
    const def = SOUND_DEFINITIONS[name];
    const ctx = this.ensureContext();
    if (!ctx) return;

    const buffer = this.cache.get(name);
    if (!buffer) {
      // On-demand load — fire-and-forget; will play on next call
      if (def) this.load(name, `/audio/${def.file}`);
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();

    // Calculate effective volume: master * category * override/default
    const cat = (def?.category ?? 'sfx') as SoundCategory;
    const baseVol = options?.volume ?? def?.volume ?? 0.5;
    const effVol = baseVol * this.categoryVolumes[cat] * this.masterVolume;
    gain.gain.setValueAtTime(effVol, ctx.currentTime);

    // Pitch variation (organic feel)
    if (def?.pitchRange && options?.pitch === undefined) {
      const [lo, hi] = def.pitchRange;
      source.playbackRate.value = lo + Math.random() * (hi - lo);
    } else if (options?.pitch !== undefined) {
      source.playbackRate.value = options.pitch;
    }

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  // ── Music playback ───────────────────────────────────────

  /**
   * Start looping background music.  If music is already playing
   * it is cross-faded out first.
   */
  playMusic(name: string, options?: MusicPlayOptions): void {
    if (this.muted) return;
    if (this.activeMusic) {
      this.stopMusic(0.3); // quick cross-fade
    }

    const def = SOUND_DEFINITIONS[name];
    const ctx = this.ensureContext();
    if (!ctx) return;

    const buffer = this.cache.get(name);
    if (!buffer) {
      // On-demand load — schedule playback when ready
      if (def) {
        this.load(name, `/audio/${def.file}`).then(() => {
          // Only play if user hasn't started something else
          if (!this.activeMusic) this.playMusic(name, options);
        });
      }
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = ctx.createGain();

    const baseVol = options?.volume ?? def?.volume ?? 0.3;
    const effVol = baseVol * this.categoryVolumes.music * this.masterVolume;

    // Fade-in
    const fadeIn = options?.fadeIn ?? 0;
    if (fadeIn > 0) {
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(effVol, ctx.currentTime + fadeIn);
    } else {
      gain.gain.setValueAtTime(effVol, ctx.currentTime);
    }

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    this.activeMusic = { source, gain, buffer, fading: false };
  }

  /** Stop currently playing music with optional fade-out. */
  stopMusic(fadeOut: number = 0): void {
    if (!this.activeMusic) return;
    const { source, gain } = this.activeMusic;
    this.activeMusic.fading = true;

    if (fadeOut > 0) {
      const ctx = this.ctx;
      if (ctx) {
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + fadeOut);
      }
      // Schedule actual stop after fade completes
      setTimeout(() => {
        try { source.stop(); } catch { /* already stopped */ }
        if (this.activeMusic?.source === source) {
          this.activeMusic = null;
        }
      }, fadeOut * 1000 + 50);
    } else {
      try { source.stop(); } catch { /* already stopped */ }
      this.activeMusic = null;
    }
  }

  // ── Volume controls ──────────────────────────────────────

  /** Master volume 0-1 (multiplied with category volumes). */
  setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    this._applyMusicVolume();
  }

  setMusicVolume(vol: number): void {
    this.categoryVolumes.music = Math.max(0, Math.min(1, vol));
    this._applyMusicVolume();
  }

  setSfxVolume(vol: number): void {
    this.categoryVolumes.sfx = Math.max(0, Math.min(1, vol));
  }

  setUiVolume(vol: number): void {
    this.categoryVolumes.ui = Math.max(0, Math.min(1, vol));
  }

  getMasterVolume(): number { return this.masterVolume; }
  getMusicVolume(): number { return this.categoryVolumes.music; }
  getSfxVolume(): number { return this.categoryVolumes.sfx; }
  getUiVolume(): number { return this.categoryVolumes.ui; }

  /** Update active music gain node without restarting. */
  private _applyMusicVolume(): void {
    if (!this.activeMusic || !this.ctx) return;
    const effVol = this.activeMusic.gain.gain.value === 0
      ? 0 // don't ramp during fade
      : /* recompute */ this.categoryVolumes.music * this.masterVolume;
    // Simple set — if a fade is running it will override this
    if (!this.activeMusic.fading) {
      this.activeMusic.gain.gain.setValueAtTime(effVol, this.ctx.currentTime);
    }
  }

  // ── Mute / unmute ────────────────────────────────────────

  /** Register a callback fired when the user unmutes. */
  setOnUnmute(cb: (() => void) | null): void {
    this.onUnmuteCallback = cb;
  }

  /** Toggle mute.  Returns the new muted state. */
  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopMusic(0.2);
    } else if (this.onUnmuteCallback) {
      this.onUnmuteCallback();
    }
    return this.muted;
  }

  isMuted(): boolean { return this.muted; }

  // ── Cleanup ──────────────────────────────────────────────

  /** Dispose everything. */
  dispose(): void {
    this.stopMusic(0);
    this.cache.clear();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.unlockAttempted = false;
  }
}

// ── Singleton ──────────────────────────────────────────────

/** Global audio manager instance. */
export const audioManager = new AudioManager();
