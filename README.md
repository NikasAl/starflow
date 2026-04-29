# Star Flow Command

**3D Space Strategy — Управляйте потоками ракет, захватывайте галактику**

---

## О проекте

Star Flow Command (в сторе — «Поток») — это 3D стратегия в реальном времени, в которой игрок управляет маршрутами ракет между планетами, чтобы перекрасить всю галактику в свой цвет. Игра построена на системе «мощности» планет: каждая планета имеет единственный показатель — мощность, которая растёт, падает и определяет стратегическую ценность объекта.

Игра содержит 8 сюжетных уровней и бесконечный режим, систему внутриигровой валюты (энергия), бусты (ускорение, заморозка, щит), локализацию на 3 языка, рекламу (Яндекс) и микротранзакции (YooKassa). Собрана как нативное Android-приложение через Capacitor 6.

## Версии проекта

| Версия | Технологии | Статус |
|--------|-----------|--------|
| **starflow-3d** | Three.js + TypeScript + Vite + Capacitor 6 | **Активная** — релиз 1.0.0 |
| starflow-pwa | HTML5 Canvas 2D | Архив — прототип |
| starflow-godot | Godot 4.3 + GDScript | Архив — заброшен из-за проблем с парсингом |

Подробнее о текущей версии — [starflow-3d/README.md](starflow-3d/README.md)

Полный игровой дизайн-документ — [docs/Star_Flow_Command_GDD.md](docs/Star_Flow_Command_GDD.md)

План публикации в RuStore — [docs/rustore-publish-plan.md](docs/rustore-publish-plan.md)

## Быстрый старт (starflow-3d)

```bash
cd starflow-3d
npm install
npm run dev       # Dev server: http://localhost:3001
npm run build     # Production build -> dist/
```

### Android сборка

```bash
# Создать signing.properties (один раз)
echo "storeFile=/путь/к/keystore.jks" > signing.properties
echo "storePassword=пароль" >> signing.properties
echo "keyAlias=starflow" >> signing.properties
echo "keyPassword=пароль" >> signing.properties

# Debug
npm run android:debug

# Release (подписанный APK)
npm run android:release
# APK: android/app/build/outputs/apk/release/app-release.apk
```

**Требования:** Node.js 18+, JDK 21, Android SDK 33+, Gradle 8.14+

## Структура репозитория

```
starflow/
├── starflow-3d/                  # Three.js 3D версия (активная)
│   ├── src/
│   │   ├── core/                 # Чистая игровая логика (без Three.js)
│   │   │   ├── types.ts          # Типы: PlanetData, MissileData, ShipRoute, GameState
│   │   │   ├── constants.ts      # Баланс, настройки камеры, параметры ИИ
│   │   │   ├── planet.ts         # Генерация карты, рост мощности, прибытие ракеты
│   │   │   ├── fleet.ts          # Движение ракет (прямая линия)
│   │   │   ├── ai.ts             # ИИ: расширение, защита, маршрутизация
│   │   │   └── texture-gen.ts    # Процедурная генерация текстур планет
│   │   ├── game/
│   │   │   ├── state.ts          # Менеджер состояния: маршруты, ракеты, победа/поражение
│   │   │   ├── game.ts           # Главный игровой цикл, сохранение, энергия
│   │   │   └── intro-anim.ts     # Кинематографический гайд
│   │   ├── rendering/
│   │   │   └── renderer.ts       # Three.js: сцена, HUD, меню, магазин, реклама
│   │   ├── i18n/                 # Локализация (ru, en, es)
│   │   ├── audio/                # Аудио-менеджер (SFX + музыка)
│   │   └── main.ts               # Стартовый экран, запуск, пауза/выход
│   ├── scripts/
│   │   ├── setup-android.mjs     # Пост-настройка Android (9 шагов)
│   │   └── setup-release-gradle.mjs  # Настройка релизной подписи + ProGuard
│   ├── signing.properties        # Параметры подписи (gitignored)
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── starflow-pwa/                 # HTML5 Canvas 2D прототип (архив)
├── starflow-godot/               # Godot 4.3 версия (архив)
├── docs/
│   ├── Star_Flow_Command_GDD.md      # Игровой дизайн-документ
│   ├── localization-plan.md          # Архитектура локализации
│   ├── monetization-research.md      # Исследование монетизации
│   ├── yandex-ads-integration-research.md  # Исследование интеграции рекламы
│   ├── yookassa-integration-research.md    # Исследование интеграции YooKassa
│   └── rustore-publish-plan.md      # План публикации в RuStore + ASO
└── README.md
```

## Лицензия

MIT License
