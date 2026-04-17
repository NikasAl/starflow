# Star Flow Command — 3D

Three.js + TypeScript + Vite space strategy game with Capacitor for Android export.

## Quick Start

```bash
cd starflow-3d
npm install
npm run dev       # Development server on http://localhost:3001
npm run build     # Production build to dist/
```

## Controls

| Action | Mouse | Touch |
|--------|-------|-------|
| Select planet | Click | Tap |
| Send ships | Click target | Tap target |
| Rotate camera | Drag | Drag (1 finger) |
| Pan camera | Shift+Drag | 2 finger drag |
| Zoom | Scroll wheel | Pinch |

## Game Rules

1. You start with 1 blue planet, AI has red and green planets
2. Planets produce ships over time
3. Click your planet to select, click target to send 70% of ships
4. When fleet arrives: if attacker > defender, planet is captured
5. Win: capture all planets. Lose: lose all planets.

## Android Build

```bash
npm run cap:init
npm run cap:add:android
npm run cap:sync
npm run cap:open:android    # Opens Android Studio
```

## Architecture

```
src/
├── core/           # Pure game logic (no Three.js)
│   ├── types.ts    # All type definitions
│   ├── constants.ts # Game balance constants
│   ├── planet.ts   # Planet generation, production, combat
│   ├── fleet.ts    # Fleet movement
│   └── ai.ts       # AI opponent controller
├── game/
│   ├── state.ts    # Game state manager
│   └── game.ts     # Main game loop
├── rendering/
│   └── renderer.ts # Three.js scene, planets, fleets, HUD
└── main.ts         # Entry point
```

## Tech Stack

- **Three.js** — 3D rendering (spheres, particles, lighting)
- **TypeScript** — Type-safe game logic
- **Vite** — Fast dev server and bundler
- **Capacitor** — Native Android wrapper
