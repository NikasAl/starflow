# Audio Assets — Star Flow Command

Place your audio files here following the structure below.
Files missing at runtime will produce a console warning but
will **not** crash the game — sound simply stays silent.

## Directory layout

```
public/audio/
├── sfx/                          # Short sound effects (< 2 s each)
│   ├── ui_click.ogg
│   ├── menu_open.ogg
│   ├── planet_select.ogg
│   ├── route_create.ogg
│   ├── route_disconnect.ogg
│   ├── explosion.ogg
│   ├── planet_capture.ogg
│   ├── gravity_well.ogg
│   ├── star_danger.ogg
│   ├── victory.ogg
│   └── defeat.ogg
└── music/                        # Longer looping tracks
    ├── ambient_space.ogg
    ├── battle_intense.ogg
    └── menu_theme.ogg
```

## Format requirements

| Property | SFX | Music |
|---|---|---|
| **Codec** | OGG Vorbis (preferred) or MP3 | OGG Vorbis (preferred) or MP3 |
| **Channels** | Mono | Stereo |
| **Sample rate** | 44 100 Hz | 44 100 Hz |
| **Looping** | No | Yes (seamless loop point) |
| **Target size** | < 50 KB each | < 2 MB each |

## Naming convention

File names **must exactly match** the paths defined in
`src/audio/sound-config.ts`.  If you rename a file, update the
corresponding `file` field in `SOUND_DEFINITIONS`.

## Tips for composers

* Keep SFX short and punchy — the game may play many per second.
* Music tracks should loop seamlessly for an immersive background.
* Test on Android WebView (Capacitor) after placing files — some
  codecs behave differently on mobile.
* OGG Vorbis is preferred because it's well-supported on Android
  and typically smaller than MP3 at equivalent quality.
