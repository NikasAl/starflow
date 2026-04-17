# Godot 4.5 — ловушки и неочевидное поведение

> Для AI-агента. Только то, что легко сделать неправильно.
> Проект: Star Flow Command, Godot 4.5, GDScript 2.0.

---

## 1. class_name + autoload: НЕМЕДЛЕННЫЙ ПАРСЕР-ЭРРОР

**Правило:** В autoload-скриптах **НИКОГДА** не пиши `class_name`.

Если autoload зарегистрирован в `project.godot` как `MyManager="*res://scripts/autoload/my_manager.gd"`,
Godot 4.5 мгновенно выдаёт `Parser Error: Class "MyManager" hides an autoload singleton`.
Это НЕ было ошибкой в 4.3/4.4 — в 4.5 проверка стала строго обязательной.

Autoload уже доступен глобально по своему имени без `class_name`. Убираем:

```gdscript
# ❌ НЕВЕРНО — вызовет ошибку парсера
class_name MyManager
extends Node

# ✅ ВЕРНО — autoload делает его доступным глобально как MyManager
extends Node
```

**Проверка:** В `check.sh` есть автоматическая проверка на это.

---

## 2. Порядок парсинга скриптов в 4.5

**Ключевое изменение 4.5:** Autoload-скрипты парсятся **ДО** всех остальных скриптов.
Это значит, что на момент парсинга autoload-скрипта типы из `class_name` обычных
скриптов **ещё не зарегистрированы** в глобальной таблице.

Результат: `Parser Error: Could not find type "Planet3D" in the current scope`.

### Что ломается

Любая статическая типизация, ссылающаяся на `class_name` из обычного скрипта
внутри autoload-скрипта:

```gdscript
# event_bus.gd (autoload) — ❌ НЕРАБОТАЕТ в 4.5
signal planet_captured(planet: Planet3D, new_owner_id: int)
var game_state: GameState
```

### Решение A: preload() для форсирования загрузки

В autoload-скриптах используем `preload()` для явной загрузки зависимых скриптов:

```gdscript
# game_manager.gd (autoload) — ✅ РАБОТАЕТ
const Planet3DScript := preload("res://scripts/planets/planet3d.gd")
const GameStateScript := preload("res://scripts/game/game_state.gd")

var game_state: GameStateScript
```

Затем используем preload-константу как тип и как конструктор:
- `var x: GameStateScript` — тип
- `GameStateScript.new()` — создание инстанса
- `GameStateScript.State.PLAYING` — доступ к вложенным enum

**Важно:** preload-константы должны идти **до** переменных и методов, которые их используют.

### Решение B: Убрать типизацию кастомных типов в сигналах autoload

В EventBus-autoload сигналы оставляем без типов для кастомных классов:

```gdscript
# event_bus.gd (autoload) — ✅ РАБОТАЕТ
signal planet_captured(planet, new_owner_id: int)    # planet — без типа
signal stream_created(stream)                        # stream — без типа
signal ui_show_planet_info(planet)                   # planet — без типа
```

Встроенные типы (`int`, `float`, `String`, `Vector3`) в сигналах — окей.

### Что НЕ ломается

Обычные скрипты (не autoload) видят ВСЕ `class_name` нормально, потому что
парсятся после autoload. В `game_state.gd` можно спокойно писать:

```gdscript
# game_state.gd (обычный скрипт) — ✅ РАБОТАЕТ
var planets: Array[Planet3D] = []
var streams: Array[ShipStream3D] = []
```

---

## 3. Autoload-имена в 4.5: PascalCase вручную

В Godot 4.4 и ниже, autoload-имя из snake_case файла автоматически
получало PascalCase вариант для автодополнения. В 4.5 этого больше нет.

**Что делать:** В `project.godot` имена autoload всегда пишем в PascalCase,
файлы — в snake_case:

```ini
# project.godot
[autoload]
GameConstants="*res://scripts/autoload/constants.gd"
EventBus="*res://scripts/autoload/event_bus.gd"
GameManager="*res://scripts/autoload/game_manager.gd"
```

---

## 4. RefCounted vs Node: нельзя add_child()

Классы, унаследованные от `RefCounted`, **не могут** быть добавлены в дерево сцены
через `add_child()`. Если попытаться — runtime-ошибка.

В нашем проекте RefCounted:
- `GameState` — чистая логика состояния, хранится как переменная
- `CombatResolver` — статические методы
- `LevelGenerator` — создаёт ноды, но сам не нода
- `PoissonDisk3D` — математическая утилита
- `AIProfile`, `LevelConfig` — Resource (который RefCounted)
- `AIGameState` — снимок состояния для AI

```gdscript
# ✅ ВЕРНО — RefCounted храним как переменную
var game_state: GameStateScript = GameStateScript.new()

# ❌ НЕВЕРНО — RefCounted нельзя addChild
add_child(GameStateScript.new())  #崩溃!
```

Если нужен Node-контейнер для RefCounted-логики (как `ScoreTracker`),
класс должен наследовать `Node`, не `RefCounted`.

---

## 5. Порядок autoload имеет значение

Автозагрузки из `project.godot` инициализируются строго сверху вниз.
Если `GameManager` использует `GameConstants` и `EventBus` — они должны быть
выше в списке:

```ini
[autoload]
GameConstants="*res://scripts/autoload/constants.gd"    # 1-й: предоставляет enum
EventBus="*res://scripts/autoload/event_bus.gd"        # 2-й: предоставляет сигналы
GameManager="*res://scripts/autoload/game_manager.gd"   # 3-й: использует оба
AudioManager="*res://scripts/autoload/audio_manager.gd"  # 4-й: независим
```

На момент `_ready()` каждого следующего autoload предыдущие уже проинициализированы.

---

## 6. Файловая система и права

Файлы проекта созданы от `root`. Для редактирования через CLI нужен `sudo`:

```bash
sudo nano /home/z/my-project/download/starflow/scripts/autoload/game_manager.gd
```

Или `sudo chown -R $(whoami) /home/z/my-project/download/starflow/` для смены владельца.

---

## 7. Инструменты проверки

### check.sh — автопроверка проекта

```bash
cd /home/z/my-project/download/starflow
./check.sh          # только проверка
./check.sh --fix    # автоформатирование + проверка
```

Инструменты:
- `gdformat` — форматирование (из `gdtoolkit`, путь: `/home/z/.local/bin/`)
- `gdlint` — статический анализ (тоже из `gdtoolkit`)
- Семантические проверки (встроены в check.sh):
  - Автoload-скрипты должны наследовать `Node`
  - `class_name` не должен конфликтовать с autoload-именами
  - `class_name` не должен совпадать с встроенными типами Godot

### Ограничения gdlint

`gdlint` не понимает паттерн preload-констант как типов:
- `max-line-length` может срабатывать на длинных preload-пути — это OK
- `function-variable-name` может ругаться на `preload`-имена — это OK

---

## 8. Артефакты текущего проекта

### Неработающие ссылки на %UniqueNode

`ui_manager.gd` ссылается на `%PlanetInfoPanel`, `%ScoreDisplay`, `%NotificationLabel`,
`%PauseMenu`, `%VictoryScreen`, `%DefeatScreen` — но в `main.tscn` эти уникальные
имена не назначены. До исправления сцены — `@onready` будет `null`.

### highlight_mesh в Planet3D

`planet3d.gd` определяет `var highlight_mesh: MeshInstance3D`, но `_ready()`
не назначает его. В сцене есть `HighlightMesh` (Node3D), но он не кэшируется.
Нужно добавить: `highlight_mesh = $HighlightMesh`

### CombatResolver, StateMachine, State, ObjectPool

Определены, но **нигде не используются**. Не удалять без согласования — могут
понадобиться при развитии проекта.

### AudioManager

Определён как autoload, но **ни один скрипт не вызывает** его методы.
Интеграция звука ещё не реализована.
