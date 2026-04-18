# Star Flow Command

**3D Space Strategy — Управляйте потоками ракет, захватывайте галактику**

---

## О проекте

Star Flow Command — это 3D стратегия в реальном времени, в которой игрок управляет маршрутами ракет между планетами, чтобы перекрасить всю галактику в свой цвет. Игра построена на системе «мощности» планет: каждая планета имеет единственный показатель — мощность, которая растёт, падает и определяет стратегическую ценность объекта.

## Версии проекта

| Версия | Технологии | Статус |
|--------|-----------|--------|
| **starflow-3d** | Three.js + TypeScript + Vite + Capacitor | **Активная** — текущая разработка |
| starflow-pwa | HTML5 Canvas 2D | Архив — прототип |
| starflow-godot | Godot 4.3 + GDScript | Архив — заброшен из-за проблем с парсингом |

Подробнее о текущей версии — [starflow-3d/README.md](starflow-3d/README.md)

Полный игровой дизайн-документ — [docs/Star_Flow_Command_GDD.md](docs/Star_Flow_Command_GDD.md)

## Быстрый старт (starflow-3d)

```bash
cd starflow-3d
npm install
npm run dev       # Dev server: http://localhost:3001
npm run build     # Production build -> dist/
```

### Android сборка

```bash
npm run cap:init          # Инициализация Capacitor
npm run cap:add:android   # Добавить Android платформу
npm run build             # Собрать веб-часть
npm run cap:sync          # Синхронизировать в Android
npm run cap:open:android  # Открыть в Android Studio
```

Требуется Android Studio для финальной сборки APK. CLI-сборка через Gradle:
```bash
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

## Структура репозитория

```
starflow/
├── starflow-3d/             # Three.js 3D версия (активная)
│   ├── src/
│   │   ├── core/            # Чистая игровая логика (без Three.js)
│   │   │   ├── types.ts     # Типы: PlanetData, MissileData, ShipRoute, GameState
│   │   │   ├── constants.ts # Баланс, настройки камеры, параметры ИИ
│   │   │   ├── planet.ts    # Генерация карты, рост мощности, прибытие ракеты
│   │   │   ├── fleet.ts     # Движение ракет (прямая линия)
│   │   │   ├── ai.ts        # ИИ: расширение, защита, маршрутизация
│   │   │   └── texture-gen.ts # Процедурная генерация текстур планет
│   │   ├── game/
│   │   │   ├── state.ts     # Менеджер состояния: маршруты, ракеты, победа/поражение
│   │   │   └── game.ts      # Главный игровой цикл, синхронизация с рендерером
│   │   ├── rendering/
│   │   │   └── renderer.ts  # Three.js: сцена, планеты, ракеты, HUD
│   │   └── main.ts          # Точка входа
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── starflow-pwa/            # HTML5 Canvas 2D прототип (архив)
├── starflow-godot/          # Godot 4.3 версия (архив)
├── docs/
│   └── Star_Flow_Command_GDD.md  # Игровой дизайн-документ
└── README.md
```

## Лицензия

MIT License
