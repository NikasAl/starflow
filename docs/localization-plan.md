# Star Flow Command — План локализации (i18n)

## Обзор

Документ описывает архитектуру и этапы внедрения многоязычной поддержки в игру Star Flow Command.
Целевые языки первого этапа: **русский (ru)**, **английский (en)**, **испанский (es)**.
Архитектура должна допускать добавление новых языков без изменения кода игры — достаточно добавить один JSON-файл.

Локализация должна работать одинаково в **веб-версии** (браузер) и **Android-версии** (Capacitor WebView).

---

## 1. Инвентаризация строк

Все подлежащие переводу строки разбиты на 4 категории.

### 1.1. HTML — Стартовый экран (`index.html`)

| Ключ | EN (текущий) | Примечание |
|------|-------------|------------|
| `app.title` | Star Flow Command | `<title>` и заголовок h1 |
| `app.subtitle` | 3D Space Strategy | Подзаголовок на стартовом экране |
| `ui.newGame` | NEW GAME | Кнопка |
| `ui.continue` | CONTINUE | Кнопка |
| `ui.loading` | Loading Star Flow Command... | Экран загрузки |
| `ui.instructions` | Click planet to select · Click target to create route · ... | Полная строка инструкций |

**Важно:** Строка инструкций длинная. Разобьём её на сегменты для гибкости — на мобильных шаблон может отличаться от десктопа.

```
ui.instructions.select = "Click planet to select"
ui.instructions.createRoute = "Click target to create route"
ui.instructions.disconnect = "Click source again to disconnect"
ui.instructions.rotate = "Drag to rotate"
ui.instructions.pan = "Shift+Drag to pan"
ui.instructions.zoom = "Scroll to zoom"
ui.instructions.pinch = "Pinch to zoom (mobile)"
ui.instructions.routes1 = "Power >15 = 2 routes"
ui.instructions.routes2 = ">30 = 3 routes"
```

### 1.2. HUD и меню (`renderer.ts`)

| Ключ | EN (текущий) | Контекст |
|------|-------------|----------|
| `menu.hideHelp` | Hide Help | Тогл меню |
| `menu.showHelp` | Show Help | Тогл меню |
| `menu.restart` | Restart Level | Пункт меню |
| `hud.you` | You | Имя игрока в таблице |
| `hud.crimson` | Crimson | Короткое имя AI_1 |
| `hud.emerald` | Emerald | Короткое имя AI_2 |
| `hud.golden` | Golden | Короткое имя AI_3 |
| `hud.neutral` | Neutral | Нейтральные |
| `hud.level` | Level {level}: {name} | Шаблон заголовка |
| `hud.power` | pw:{power} | Метка мощности |
| `hud.stars` | Stars: {count} hazard(s) | Счётчик звёзд |
| `hud.routes` | Routes: {count} active | Счётчик маршрутов |
| `hud.missiles` | Missiles in flight: {count} | Счётчик ракет |
| `hud.victory` | VICTORY | Индикатор фазы |
| `hud.defeat` | DEFEAT | Индикатор фазы |
| `hud.selectedInfo` | {name}: power {power} ({current}/{max} routes) | Подсказка выбранной планеты |
| `hud.fireRate` | Fire rate: {rate}s/missile | Скорость стрельбы |
| `hud.clickTarget` | Click target to create route | Подсказка |

### 1.3. Оверлей завершения уровня (`renderer.ts`)

| Ключ | EN (текущий) | Контекст |
|------|-------------|----------|
| `overlay.victory` | VICTORY | Заголовок победы |
| `overlay.defeat` | DEFEAT | Заголовок поражения |
| `overlay.levelCompleted` | Level {level}: {name} completed! | Подзаголовок победы |
| `overlay.levelFailed` | Level {level}: {name} | Подзаголовок поражения |
| `overlay.time` | Time: {time} | Статистика |
| `overlay.yourStats` | Your power: {power} \| Planets: {planets} | Статистика |
| `overlay.nextLevel` | NEXT LEVEL | Кнопка |
| `overlay.replay` | REPLAY | Кнопка |
| `overlay.retry` | RETRY | Кнопка |

### 1.4. Игровые данные (`constants.ts`, `planet.ts`, `star.ts`, `types.ts`)

**Имена фракций (`types.ts`):**
| Ключ | EN |
|------|-----|
| `owner.neutral` | Neutral |
| `owner.player` | Player |
| `owner.crimsonFleet` | Crimson Fleet |
| `owner.emeraldHorde` | Emerald Horde |
| `owner.goldenArmada` | Golden Armada |

**Названия уровней (`constants.ts`):**
| Ключ | EN |
|------|-----|
| `level.1` | First Contact |
| `level.2` | Expanding Borders |
| `level.3` | Rising Tensions |
| `level.4` | Two Front War |
| `level.5` | Galactic Conflict |
| `level.6` | Deep Space |
| `level.7` | Supernova |
| `level.8` | Endgame |
| `level.infinite` | Infinite {n} | Шаблон для бесконечных уровней |

**Имена планет (`planet.ts`) — 25 имён:**
`Terra Nova`, `Kepler-7b`, `Proxima`, `Andoria`, `Vulcan`, `Rigel Prime`, `Centauri`, `Sirius`, `Vega`, `Altair`, `Deneb`, `Antares`, `Polaris`, `Betelgeuse`, `Capella`, `Arcturus`, `Aldebaran`, `Spica`, `Regulus`, `Procyon`, `Mira`, `Castor`, `Pollux`, `Fomalhaut`, `Canopus`

**Решение по именам планет:** Это астрономические названия, в основном латинские. Они остаются **без перевода** во всех языках. Это творческое решение —星球名 не переводятся, как в большинстве космических стратегий (Stellaris, Endless Space).

**Имена звёзд (`star.ts`) — 12 имён:**
Аналогично — оставляем без перевода: `Sol Prime`, `Helios`, `Vega Major`, и т.д.

**Метка на планете (canvas label, `renderer.ts`):**
- `max:{n} link` — этот короткий текст подлежит локализации:
  | Ключ | EN |
  |------|-----|
  | `planet.maxLinks` | max:{n} link |

**Сохранение игры (`main.ts`):**
- `Level {level}: {name} — {time}` — шаблон, подлежит локализации:
  | Ключ | EN |
  |------|-----|
  | `save.info` | Level {level}: {name} — {time} |

---

## 2. Архитектура i18n

### 2.1. Подход: собственная лёгкая система (без библиотек)

Для vanilla TypeScript проекта подключение i18next или аналогов — избыточная зависимость.
Реализуем минимальную систему i18n (~80 строк кода), обеспечивающую:

- Загрузку JSON-словарей
- Интерполяцию переменных (`{variable}`)
- Падежи/множественное число (простая форма)
- Кэширование
- Реактивное переключение языка (событие `languageChanged`)

### 2.2. Структура файлов

```
src/
  i18n/
    index.ts          — Ядро системы (I18n класс)
    types.ts          — Типы: Locale, TranslationMap
    locales/
      en.json         — Английский (базовый)
      ru.json         — Русский
      es.json         — Испанский
```

### 2.3. Формат JSON-словаря

```jsonc
{
  "app": {
    "title": "Star Flow Command",
    "subtitle": "3D Space Strategy"
  },
  "ui": {
    "newGame": "NEW GAME",
    "continue": "CONTINUE",
    "loading": "Loading Star Flow Command...",
    "instructions": {
      "select": "Click planet to select",
      "createRoute": "Click target to create route",
      "disconnect": "Click source again to disconnect",
      "rotate": "Drag to rotate",
      "pan": "Shift+Drag to pan",
      "zoom": "Scroll to zoom",
      "pinch": "Pinch to zoom (mobile)",
      "routes1": "Power >15 = 2 routes",
      "routes2": ">30 = 3 routes"
    }
  },
  "menu": {
    "hideHelp": "Hide Help",
    "showHelp": "Show Help",
    "restart": "Restart Level"
  },
  "hud": {
    "you": "You",
    "crimson": "Crimson",
    "emerald": "Emerald",
    "golden": "Golden",
    "neutral": "Neutral",
    "level": "Level {level}: {name}",
    "power": "pw:{power}",
    "stars": "Stars: {count} hazard(s)",
    "routes": "Routes: {count} active",
    "missiles": "Missiles in flight: {count}",
    "victory": "VICTORY",
    "defeat": "DEFEAT",
    "selectedInfo": "{name}: power {power} ({current}/{max} routes)",
    "fireRate": "Fire rate: {rate}s/missile",
    "clickTarget": "Click target to create route"
  },
  "overlay": {
    "victory": "VICTORY",
    "defeat": "DEFEAT",
    "levelCompleted": "Level {level}: {name} completed!",
    "levelFailed": "Level {level}: {name}",
    "time": "Time: {time}",
    "yourStats": "Your power: {power} | Planets: {planets}",
    "nextLevel": "NEXT LEVEL",
    "replay": "REPLAY",
    "retry": "RETRY"
  },
  "owner": {
    "neutral": "Neutral",
    "player": "Player",
    "crimsonFleet": "Crimson Fleet",
    "emeraldHorde": "Emerald Horde",
    "goldenArmada": "Golden Armada"
  },
  "level": {
    "1": "First Contact",
    "2": "Expanding Borders",
    "3": "Rising Tensions",
    "4": "Two Front War",
    "5": "Galactic Conflict",
    "6": "Deep Space",
    "7": "Supernova",
    "8": "Endgame",
    "infinite": "Infinite {n}"
  },
  "planet": {
    "maxLinks": "max:{n} link"
  },
  "save": {
    "info": "Level {level}: {name} — {time}"
  }
}
```

### 2.4. Ядро i18n (`src/i18n/index.ts`)

```typescript
// === Концептуальная структура ===

export type Locale = 'en' | 'ru' | 'es';

interface TranslationMap {
  [key: string]: string | TranslationMap;
}

class I18n {
  private locale: Locale = 'en';
  private dictionaries: Map<Locale, TranslationMap> = new Map();
  private listeners: Array<() => void> = [];

  /** Загрузить словарь */
  async load(locale: Locale): Promise<void>;

  /** Установить язык */
  setLocale(locale: Locale): void;

  /** Получить текущий язык */
  getLocale(): Locale;

  /** Получить перевод по ключу (точка-нотация: 'hud.victory') */
  t(key: string, params?: Record<string, string | number>): string;

  /** Подписаться на смену языка */
  onChange(listener: () => void): () => void;
}

export const i18n = new I18n();
```

### 2.5. Определение языка

**Алгоритм определения:**

```
1. Проверить localStorage: 'starflow-locale'
2. Если нет → navigator.language → извлечь код ('ru-RU' → 'ru')
3. Если язык не поддерживается → fallback на 'en'
```

**Для Android (Capacitor):**
`navigator.language` работает в WebView. Дополнительно можно читать язык системы через Capacitor-плагин, но `navigator.language` достаточно.

### 2.6. Переключение языка

- Сохраняем выбор в `localStorage: 'starflow-locale'`
- Генерируем событие `languageChanged`
- Все компоненты, подписанные на событие, обновляют текст

**UI переключения языка** — добавим в трёхточечное меню:
- Новый пункт "Language" (или "Язык")
- Подменю с флагами/названиями: English, Русский, Español
- Выбор сохраняется и применяется сразу без перезагрузки

---

## 3. Адаптация по файлам

### 3.1. `index.html` — Стартовый экран

**Проблема:** HTML загружается до инициализации JS. Строки в HTML видны сразу.

**Решение:**
1. Оставить в HTML **пустые контейнеры** или **заполнители** (en как дефолт)
2. При инициализации `main.ts` сразу вызвать `i18n.setLocale()` и обновить все текстовые элементы DOM
3. Для `<title>` — обновить через `document.title`

**Конкретные изменения:**
```html
<!-- Было -->
<h1>STAR FLOW COMMAND</h1>
<div class="subtitle">3D Space Strategy</div>
<button id="start-btn">NEW GAME</button>

<!-- Станет (en как fallback в HTML, JS перезапишет) -->
<h1 id="title-text">STAR FLOW COMMAND</h1>
<div class="subtitle" id="subtitle-text">3D Space Strategy</div>
<button id="start-btn" data-i18n="ui.newGame">NEW GAME</button>
<button id="continue-btn" data-i18n="ui.continue">CONTINUE</button>
```

Или (альтернативно) — **полностью управлять через JS:**
```html
<h1 id="title-text"></h1>
<div class="subtitle" id="subtitle-text"></div>
```

**Рекомендация:** Использовать `data-i18n` атрибуты + утилиту `applyTranslations()` которая пробегает по DOM и заменяет `textContent` у элементов с `data-i18n`.

### 3.2. `renderer.ts` — HUD, оверлеи, canvas-метки

**HUD (HTML-оверлей):**
Все строки формируются через шаблонные литералы в `updateHTMLHUD()` и `showOverlay()`.
Заменяем все литеральные строки на вызовы `i18n.t()`:

```typescript
// Было
`Level ${state.level}: ${state.levelConfig.name}`
// Станет
i18n.t('hud.level', { level: state.level, name: state.levelConfig.name })
```

**Canvas-метки планет (`drawPlanetLabel`):**
Canvas-рендеринг использует `ctx.fillText()`. Поддержка Unicode/кириллицы зависит от шрифта.
Текущий шрифт: `Arial` — поддерживает кириллицу и испанские символы (ñ).

Дополнительных действий не требуется, просто подставляем локализованную строку.

### 3.3. `constants.ts` — Названия уровней

**Вариант A (рекомендуемый):** Массив `LEVELS` хранит только ключи локализации:
```typescript
{ level: 1, nameKey: 'level.1', ... }
```
При отображении: `i18n.t(config.nameKey)`

**Вариант B:** Массив остаётся как есть (EN-имена как fallback), а `i18n` пытается найти перевод, иначе возвращает оригинал.

**Рекомендация:** Вариант A — чище, нет дублирования.

Но это требует изменения интерфейса `LevelConfig`: поле `name` → `nameKey` (string).
Или сохранить `name` для обратной совместимости и добавить `nameKey`.

### 3.4. `types.ts` — OWNER_NAMES

Заменить на функцию:
```typescript
export function getOwnerName(id: OwnerId): string {
  const keys: Record<OwnerId, string> = {
    [NEUTRAL]: 'owner.neutral',
    [PLAYER]:  'owner.player',
    [AI_1]:    'owner.crimsonFleet',
    [AI_2]:    'owner.emeraldHorde',
    [AI_3]:    'owner.goldenArmada',
  };
  return i18n.t(keys[id]);
}
```

Важно: `OWNER_NAMES` используется в `renderer.ts` для HUD, а полные имена (`Crimson Fleet`) — для отображения в состоянии. Короткие имена (`Crimson`) — отдельные ключи `hud.crimson` и т.д.

### 3.5. `planet.ts` / `star.ts` — Имена планет/звёзд

**Решение: НЕ локализовать.** Астрономические названия остаются как есть.
Это общепринятая практика в космических играх. Имена планет — часть лора.

### 3.6. `main.ts` — Сохранение игры

```typescript
// Было
`Level ${info.level}: ${info.name} — ${info.time}`
// Станет
i18n.t('save.info', { level: info.level, name: info.name, time: info.time })
```

---

## 4. Обработка особенностей языков

### 4.1. Русский язык — множественное число

Строка `Stars: {count} hazard(s)` требует форм множественного числа:
- 1 звезда (singular)
- 2-4 звезды (paucal)
- 5-20 звезд (plural)
- 21 звезда (singular again)

**Решение:** Добавить поддержку `_plural` суффикса в i18n:

```json
// ru.json
{
  "hud": {
    "stars_one": "Звезда: {count} угроза",
    "stars_few": "Звёзды: {count} угрози",
    "stars_many": "Звёзд: {count} угроз"
  }
}
```

Добавить в ядро i18n функцию `tp(key, count, params)` — "translate plural":

```typescript
tp(key: string, count: number, params?: Record<string, string | number>): string {
  const form = this.getPluralForm(count);
  return this.t(`${key}_${form}`, { ...params, count });
}
```

Форма множественного числа для русского:
```typescript
function getRussianPluralForm(n: number): 'one' | 'few' | 'many' {
  const abs = Math.abs(n) % 100;
  const lastDigit = abs % 10;
  if (abs > 10 && abs < 20) return 'many';
  if (lastDigit > 1 && lastDigit < 5) return 'few';
  if (lastDigit === 1) return 'one';
  return 'many';
}
```

Использование:
```typescript
i18n.tp('hud.stars', state.stars.length)
```

### 4.2. Испанский язык — особые символы

Испанский содержит: ñ, á, é, í, ó, ú, ¿, ¡. Все эти символы поддерживаются UTF-8 и шрифтом Arial. Никаких дополнительных действий.

### 4.3. Длина строк

Русские и испанские переводы часто длиннее английских. Это влияет на:
- **HUD-панель:** Увеличить `min-width` с 220px → адаптивный
- **Кнопки оверлея:** Already have padding, но проверить врезание
- **Инструкции внизу экрана:** Строка длинная — сегментированный подход решает проблему (можно менять набор подсказок для мобильных)

### 4.4. Canvas-метки планет

Текст на canvas (`drawPlanetLabel`). Нужно проверить, что кириллица рендерится корректно с `font: 'bold 30px Arial'`.
Arial имеет кириллические глифы — проблем нет.

**Потенциальная проблема:** Ширина текста. `max:3 link` → `макс:3 связ.` — длиннее.
Решение: canvas 160px шириной — достаточно для коротких меток.

---

## 5. Добавление нового языка

Чтобы добавить, например, немецкий (de):

1. Создать `src/i18n/locales/de.json` — скопировать `en.json` и перевести
2. Добавить `'de'` в тип `Locale` в `types.ts`
3. Добавить запись в язык-селектор меню
4. Добавить опцию в fallback-цепочку

**Никаких других файлов трогать не нужно** — архитектура гарантирует это.

---

## 6. Сборка и Capatior/Android

### 6.1. Vite

JSON-файлы локалей импортируются через `import` (Vite поддерживает JSON-импорты):

```typescript
import en from './locales/en.json';
import ru from './locales/ru.json';
import es from './locales/es.json';
```

Это значит:
- Все локали попадут в бандл
- Нет дополнительных HTTP-запросов
- Размер: ~3 JSON × ~2 КБ = ~6 КБ — negligible

### 6.2. Ленивая загрузка (опционально, для будущего)

Если языков станет 10+, можно использовать dynamic import:

```typescript
const dictionary = await import(`./locales/${locale}.json`);
```

Vite создаст отдельные чанки для каждого языка.

### 6.3. Android (Capacitor)

- WebView поддерживает `navigator.language` — автоопределение работает
- `localStorage` работает в WebView — сохранение языка работает
- Шрифты: системный Arial на Android содержит кириллицу и испанские символы
- Никаких дополнительных плагинов Capacitor не требуется

---

## 7. Этапы реализации

### Этап 1: Инфраструктура (файлы, ~80 строк)

**Файлы:**
- `src/i18n/types.ts` — типы Locale, TranslationMap
- `src/i18n/index.ts` — класс I18n с методами `load`, `setLocale`, `t`, `tp`, `onChange`
- `src/i18n/locales/en.json` — полный английский словарь

**Работа:**
- Реализовать загрузку словарей
- Реализовать интерполяцию `{variable}`
- Реализовать dot-нотацию ключей (`'hud.victory'`)
- Реализовать определение языка (navigator.language → fallback)
- Реализовать сохранение языка в localStorage
- Реализовать событие смены языка

### Этап 2: Английский словарь + рефакторинг

**Файлы:**
- Заменить все хардкод-строки на `i18n.t()` в:
  - `renderer.ts` — HUD, оверлеи, canvas-метки
  - `main.ts` — стартовый экран, сохранение
- Обновить `constants.ts` — добавить `nameKey` к уровням
- Обновить `types.ts` — `OWNER_NAMES` → `getOwnerName()`
- Функция `applyDOMTranslations()` — для HTML-элементов с `data-i18n`

**Проверка:** Игра работает на английском без визуальных изменений.

### Этап 3: Русский язык

**Файлы:**
- `src/i18n/locales/ru.json` — полный русский перевод
- Добавить `_one`, `_few`, `_many` варианты для множественного числа
- Реализовать `getRussianPluralForm()` в ядре i18n

**Проверка:** Переключение на русский — все строки переведены, множественное число корректно.

### Этап 4: Испанский язык

**Файлы:**
- `src/i18n/locales/es.json` — полный испанский перевод
- Испанский множественное число совпадает с английским (only _one / _other)

**Проверка:** Переключение на испанский — все строки переведены.

### Этап 5: UI переключения языка

**Файлы:**
- `renderer.ts` — добавить пункт "Language" в меню с подменю языков
- Флаги не используем (нет besoins в графических ассетах) — текстовые названия: `English`, `Русский`, `Español`
- При выборе: `i18n.setLocale(locale)` → все подписчики обновляются
- Сохранение в localStorage автоматически

### Этап 6: Тестирование и полировка

- Проверить все экраны на всех 3 языках
- Проверить длинные строки (HUD не обрезается)
- Проверить canvas-метки с кириллицей
- Проверить мобильный вид (инструкции)
- Проверить Android APK — язык определяется, переключается
- Проверить edge cases: язык браузера не поддерживается → fallback en
- Проверить сохранение игры: текст сохранения на текущем языке

---

## 8. Что НЕ локализуем

| Элемент | Причина |
|---------|---------|
| Имена планет (25 шт.) | Астрономические названия — часть лора |
| Имена звёзд (12 шт.) | Аналогично |
| `sizeType` (dwarf, small, medium...) | Технические термины, короткие метки |
| Идентификаторы и ключи | Внутренние данные |
| Коды цветов | Не являются текстом |
| Console.log | Отладочный вывод |

---

## 9. Оценка объёма работ

| Этап | Объём | Сложность |
|------|-------|-----------|
| 1. Инфраструктура | ~80-100 строк TS + 1 JSON | Низкая |
| 2. Рефакторинг EN | ~50 замен строк в 4 файлах | Средняя |
| 3. Русский | 1 JSON (~100 ключей) + plural | Низкая |
| 4. Испанский | 1 JSON (~100 ключей) | Низкая |
| 5. UI переключения | ~30 строк в renderer.ts | Низкая |
| 6. Тестирование | Ручная проверка | Средняя |

**Итого:** ~200 строк нового кода, ~50 замен в существующем коде, 3 JSON-файла.

---

## 10. Будущие расширения

- **Правильно-направленный текст (RTL):** Если добавим арабский/иврит — понадобятся CSS-переменные `direction` и `text-align`. Пока не требуется.
- **Локализация графики:** Если будут картинки с текстом (не планируются) — папка `assets/locales/`.
- **Локализация Google Play:** Название приложения, описание, скриншоты — отдельно от кода.
- **Поддержка `Intl` API:** Для форматирования чисел/дат по локали (если добавим).
