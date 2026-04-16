# Руководство для агента по разработке на Godot 4.x

> **Назначение:** Практическое руководство для AI-агента, генерирующего GDScript-код.
> **Версии:** Godot 4.2–4.4+, GDScript 2.0.
> **Главное правило:** Весь код должен использовать статическую типизацию. Смешивание типизированного и нетипизированного кода запрещено.

---

## Содержание

1. [Общие правила кодирования](#1-общие-правила-кодирования)
2. [Структура проекта](#2-структура-проекта)
3. [Архитектура: сигналы, автозагрузки, ресурсы](#3-архитектура-сигналы-автозагрузки-ресурсы)
4. [Конечные автоматы (FSM)](#4-конечные-автоматы-fsm)
5. [Деревья поведения (Behavior Trees)](#5-деревья-поведения-behavior-trees)
6. [3D: частицы, пути, кривые Безье](#6-3d-частицы-пути-кривые-безье)
7. [Система ввода](#7-система-ввода)
8. [Производительность](#8-производительность)
9. [Новое в Godot 4.3 и 4.4](#9-новое-в-godot-43-и-44)

---

## 1. Общие правила кодирования

### 1.1 Статическая типизация — ОБЯЗАТЕЛЬНО

Официальная документация: *"лучшей практикой является либо всегда использовать статическую типизацию, либо никогда — смешивание вызывает путаницу"*. Статическая типизация обеспечивает:
- Обнаружение ошибок на этапе написания кода (не в рантайме)
- Повышенную производительность (GDScript-компилятор оптимизирует типизированный код)
- Улучшенное автодополнение IDE и рефакторинг

```gdscript
# ✅ ПРАВИЛЬНО — Всё типизировано
var speed: float = 5.0
var health: int = 100
var player_name: String = "Hero"
var enemies: Array[Node3D] = []
var inventory: Dictionary[String, int] = {}

@export var max_speed: float = 10.0
@export var jump_force: Vector3 = Vector3(0, 5.0, 0)

func _ready() -> void:
    var label: Label = %Label
    var timer: Timer = %Timer

func deal_damage(amount: int) -> bool:
    health -= amount
    return health <= 0

func get_nearest_enemy() -> CharacterBody3D:
    var nearest: CharacterBody3D = null
    # ...
    return nearest

# ❌ НЕДОПУСТИМО — Нетипизированный код
var speed = 5.0          # Работает, но теряется безопасность типов
func deal_damage(amount): # Нет подсказок типов
    pass
```

### 1.2 Порядок кода (12 шагов)

Godot Enforcement требует строгий порядок. Следуй этой последовательности в каждом файле:

```
 1. class_name
 2. extends
 3. @icon
 4. Константы
 5. @export-переменные
 6. Публичные переменные (без @export)
 7. Приватные переменные
 8. @onready-переменные
 9. Встроенные виртуальные методы (_init, _enter_tree, _ready, _process и т.д.)
10. Публичные методы
11. Приватные методы
12. Внутренние классы (subclasses)
```

**Пример полного файла:**

```gdscript
# 1. class_name
class_name PlayerController
# 2. extends
extends CharacterBody3D
# 3. @icon
@icon("res://icons/player.svg")

# 4. Константы
const MAX_HEALTH: int = 100
const BASE_SPEED: float = 5.0

# 5. @export-переменные
@export var max_speed: float = 10.0
@export var jump_velocity: float = 4.5
@export_group("Camera")
@export var mouse_sensitivity: float = 0.002

# 6. Публичные переменные
var health: int = MAX_HEALTH
var score: int = 0

# 7. Приватные переменные
var _gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")
var _camera_basis: Basis = Basis.IDENTITY

# 8. @onready-переменные
@onready var camera_3d: Camera3D = %Camera3D
@onready var animation_tree: AnimationTree = %AnimationTree
@onready var collision_shape: CollisionShape3D = %CollisionShape

# 9. Встроенные виртуальные методы
func _ready() -> void:
    Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)

func _process(delta: float) -> void:
    pass

func _physics_process(delta: float) -> void:
    pass

func _unhandled_input(event: InputEvent) -> void:
    pass

# 10. Публичные методы
func take_damage(amount: int) -> bool:
    health -= amount
    return health <= 0

func heal(amount: int) -> void:
    health = mini(health + amount, MAX_HEALTH)

# 11. Приватные методы
func _apply_gravity(delta: float) -> void:
    if not is_on_floor():
        velocity.y -= _gravity * delta

func _handle_movement() -> void:
    pass

# 12. Внутренние классы
class DamageInfo:
    var amount: int = 0
    var source: Node3D = null
```

### 1.3 Конвенции именования

| Элемент | Конвенция | Пример |
|---|---|---|
| Классы / Узлы | PascalCase | `PlayerController`, `EnemyAI` |
| Функции | snake_case | `deal_damage()`, `get_nearest_enemy()` |
| Переменные | snake_case | `max_health`, `move_speed` |
| Константы | UPPER_SNAKE_CASE | `MAX_SPEED`, `DEFAULT_COLOR` |
| Сигналы | snake_case, прошедшее время | `health_changed`, `enemy_died` |
| Enum-типы | PascalCase | `State`, `WeaponType` |
| Enum-значения | UPPER_SNAKE_CASE | `IDLE`, `RUNNING`, `ATTACKING` |
| Файлы скриптов | snake_case | `player_controller.gd` |
| Файлы сцен | snake_case | `main_menu.tscn` |

### 1.4 Использование `%` уникальных узлов вместо `$`

Всегда используй **уникальные имена узлов** (устанавливаются в редакторе с префиксом `%`). Узлы можно переименовывать и перемещать без поломки кода:

```gdscript
# ✅ ПРАВИЛЬНО — Уникальный узел сцены
@onready var health_bar: ProgressBar = %HealthBar
@onready var sprite: AnimatedSprite3D = %PlayerSprite
@onready var collision: CollisionShape3D = %CollisionShape

# ❌ НЕДОПУСТИМО — Хрупкие пути
@onready var health_bar = $MarginContainer/VBoxContainer/HealthBar
@onready var sprite = $Model/Armature/Skeleton/AnimatedSprite3D
```

### 1.5 Аннотации

```gdscript
class_name PlayerController       # Регистрация как глобальный тип
@icon("res://icons/player.svg")   # Иконка в редакторе
@export                           # Экспорт в инспектор
@export_group("Movement")         # Группа в инспекторе
@export_subgroup("Ground")        # Подгруппа в инспекторе
@onready var node = $Path         # Отложенная инициализация
@rpc("any_peer", "call_remote")   # Сетевой RPC
@tool                             # Скрипт плагина редактора
@static_unload                    # Очистка статики при выгрузке (4.4+)
const MAX_HEALTH: int = 100       # Константы всегда UPPER_SNAKE_CASE
```

**Примеры использования аннотаций в реальном коде:**

```gdscript
class_name WeaponController
extends Node3D

@export_group("Weapon Configuration")
@export var weapon_data: WeaponResource
@export var fire_rate: float = 0.3
@export var damage_multiplier: float = 1.0

@export_subgroup("Visual Effects")
@export var muzzle_flash: GPUParticles3D
@export var impact_particles: PackedScene

@export var is_auto: bool = false

const MAX_AMMO: int = 30

var current_ammo: int = MAX_AMMO
var can_fire: bool = true

@onready var fire_timer: Timer = %FireTimer
@onready var muzzle_position: Marker3D = %MuzzlePosition
```

---

## 2. Структура проекта

### 2.1 Стандартная структура папок для 3D-игры

Официальная рекомендация: *"Создавайте директорию для каждой сцены и размещайте все скрипты, ассеты и файлы сцен внутри"*.

```
project_root/
├── project.godot
├── scenes/
│   ├── main/
│   │   ├── main_menu.tscn
│   │   └── main_menu.gd
│   ├── player/
│   │   ├── player.tscn
│   │   ├── player.gd
│   │   ├── player_model.glb
│   │   └── player_material.tres
│   ├── enemies/
│   │   ├── enemy_base.tscn
│   │   ├── enemy_base.gd
│   │   ├── melee_enemy.tscn
│   │   └── ranged_enemy.tscn
│   ├── ui/
│   │   ├── hud.tscn
│   │   ├── inventory_screen.tscn
│   │   └── health_bar.tscn
│   └── world/
│       ├── level_01.tscn
│       ├── environment.tscn
│       └── props/
├── assets/
│   ├── 3d/
│   │   ├── models/
│   │   ├── textures/
│   │   └── materials/
│   ├── audio/
│   │   ├── sfx/
│   │   ├── music/
│   │   └── voice/
│   ├── fonts/
│   └── shaders/
├── scripts/
│   ├── autoload/
│   │   ├── game_manager.gd
│   │   ├── audio_manager.gd
│   │   └── event_bus.gd
│   ├── resources/
│   │   ├── enemy_data.gd
│   │   └── weapon_data.gd
│   └── utilities/
│       ├── math_helpers.gd
│       └── object_pool.gd
├── resources/
│   ├── enemies/
│   │   ├── goblin_data.tres
│   │   └── dragon_data.tres
│   ├── weapons/
│   │   ├── iron_sword.tres
│   │   └── fire_staff.tres
│   └── items/
│       ├── health_potion.tres
│       └── mana_crystal.tres
├── addons/
└── tests/
```

### 2.2 Где хранить что

| Что хранить | Директория | Примечание |
|---|---|---|
| Autoload-скрипты | `scripts/autoload/` | Регистрируются в Project Settings → Autoload |
| Custom Resource скрипты | `scripts/resources/` | Определяют структуру данных (классы, унаследованные от Resource) |
| Custom Resource инстансы (.tres) | `resources/` | Конкретные данные (iron_sword.tres, goblin_data.tres) |
| Сцены (.tscn) | `scenes/<feature>/` | Одна директория на сцену + зависимые ассеты |
| Служебные скрипты | `scripts/utilities/` | Общие утилиты: ObjectPool, MathHelpers |
| Аддоны | `addons/` | Сторонние плагины (Beehave, LimboAI и т.д.) |
| 3D-модели | `assets/3d/models/` | .glb, .gltf, .fbx (4.3+) |
| Текстуры | `assets/3d/textures/` | .png, .jpg, .webp |
| Аудио | `assets/audio/sfx/`, `music/` | .wav (SFX), .ogg (музыка) |

### 2.3 Правило: одна сцена = одна директория

```
scenes/player/
├── player.tscn           # Сцена игрока
├── player.gd             # Скрипт игрока
├── player_model.glb      # 3D-модель (зависимый ассет)
├── player_material.tres  # Материал (зависимый ассет)
└── player_run.anim       # Анимация (зависимый ассет)
```

Все файлы, которые принадлежат конкретной сцене и не используются повторно, хранятся рядом с ней. Общие ресурсы — в `assets/` и `resources/`.

---

## 3. Архитектура: сигналы, автозагрузки, ресурсы

### 3.1 Таблица решений: когда использовать что

| Паттерн | Когда использовать | Пример |
|---|---|---|
| **Прямой вызов** | Родитель ↔ Потомок в одной сцене | `player.take_damage(10)` |
| **Сигнал** | Расцепленное общение, UI ↔ Логика | `health_changed.emit(new_health)` |
| **Event Bus (Autoload)** | Общение между сценами | `EventBus.player_died.emit()` |
| **Autoload** | Глобальное состояние, менеджеры | `GameManager`, `AudioManager` |
| **Custom Resource** | Определения данных, конфигурация | `WeaponData`, `EnemyStats` |

**Правило выбора:**
1. Если объекты в одной сцене (родитель/потомок) → прямой вызов
2. Если нужна развязка или общение UI с логикой → сигнал
3. Если объекты в разных сценах → Event Bus
4. Если нужны глобальные данные-менеджеры → Autoload
5. Если нужно описать игровые данные → Custom Resource

### 3.2 Сигналы

Объявляй сигналы в начале класса (после `@export`). Всегда используй типизированные параметры:

```gdscript
class_name HealthComponent
extends Node3D

@export var max_health: int = 100

var health: int = max_health

# Объявление сигналов
signal health_changed(new_health: int, max_health: int)
signal died()
signal damage_taken(amount: int, source: Node3D)

func take_damage(amount: int, source: Node3D = null) -> void:
    health -= amount
    damage_taken.emit(amount, source)
    health_changed.emit(health, max_health)
    if health <= 0:
        died.emit()

func heal(amount: int) -> void:
    health = mini(health + amount, max_health)
    health_changed.emit(health, max_health)
```

**Подключение сигналов в коде (предпочтительно):**

```gdscript
func _ready() -> void:
    # Подключение через лямбду
    health_component.health_changed.connect(
        func(new_hp: int, _max_hp: int) -> void:
            _update_health_ui(new_hp)
    )

    # Подключение через callable
    health_component.health_changed.connect(_on_health_changed)

    # Одноразовое подключение (срабатывает один раз)
    animation_player.animation_finished.connect(
        _on_attack_anim_finished, Object.CONNECT_ONE_SHOT
    )

    # Отключение (обязательно в cleanup)
    if health_component.health_changed.is_connected(_on_health_changed):
        health_component.health_changed.disconnect(_on_health_changed)

func _on_health_changed(new_health: int, max_health: int) -> void:
    health_bar.value = float(new_health) / float(max_health)
```

### 3.3 Правила для автозагрузок

- **Максимум 3–5 autoload на проект** — каждый с одной обязанностью
- **Никаких ссылок на сцены** в autoload — только данные и сигналы
- **Сигналы для общения** — не создавай жёсткую связность
- **Единая ответственность** — GameManager, AudioManager, EventBus, SaveManager

```gdscript
# game_manager.gd — Зарегистрирован как Autoload
extends Node

var score: int = 0
var current_level: int = 1
var is_game_over: bool = false
var difficulty: int = 1

signal score_changed(new_score: int)
signal game_over()
signal level_changed(new_level: int)
signal difficulty_changed(new_difficulty: int)

func add_score(points: int) -> void:
    score += points
    score_changed.emit(score)

func set_level(level: int) -> void:
    current_level = level
    level_changed.emit(level)

func restart_game() -> void:
    score = 0
    current_level = 1
    is_game_over = false
    difficulty = 1
    get_tree().reload_current_scene()
```

### 3.4 Event Bus — паттерн для межсценового общения

Event Bus — это Autoload, который содержит только сигналы. Никакой игровой логики:

```gdscript
# event_bus.gd — Зарегистрирован как Autoload
extends Node

# --- Игровые события ---
signal player_died()
signal level_completed(level_id: int)
signal game_paused(is_paused: bool)
signal game_restarted()
signal item_collected(item_id: StringName)
signal enemy_killed(enemy_type: StringName, position: Vector3)
signal quest_updated(quest_id: StringName, status: StringName)
signal boss_defeated(boss_id: StringName)

# --- UI-события ---
signal show_notification(message: String, notification_type: StringName)
signal hide_notification()
signal screen_transition_started()
signal screen_transition_finished()

# --- Аудио-события ---
signal play_sfx(sound_name: StringName)
signal play_music(track_name: StringName)
signal stop_music(fade_out: bool)

# --- Сохранение ---
signal save_requested()
signal load_requested(slot: int)
signal game_saved(success: bool)
signal game_loaded(success: bool)

# ⚠️ Никакой игровой логики здесь — только ретрансляция сигналов
```

**Использование Event Bus из любого места проекта:**

```gdscript
# В скрипте врага
func _on_death() -> void:
    EventBus.enemy_killed.emit(&"goblin", global_position)
    EventBus.show_notification.emit("Гоблин повержен!", &"info")
    EventBus.add_score.emit(50)

# В скрипте UI
func _ready() -> void:
    EventBus.show_notification.connect(_display_notification)
    EventBus.enemy_killed.connect(_on_enemy_killed)
    EventBus.level_completed.connect(_on_level_complete)

func _display_notification(message: String, type: StringName) -> void:
    match type:
        &"info":
            notification_label.modulate = Color.CYAN
        &"warning":
            notification_label.modulate = Color.YELLOW
        &"error":
            notification_label.modulate = Color.RED
    notification_label.text = message
    notification_anim_player.play("show")
```

### 3.5 Custom Resources для данных

Custom Resources — это данные, которые можно редактировать в инспекторе и переиспользовать:

```gdscript
# weapon_resource.gd
class_name WeaponResource
extends Resource

@export_group("Weapon Stats")
@export var display_name: String = "Sword"
@export var description: String = "A basic sword"
@export var damage: int = 10
@export var attack_speed: float = 1.0
@export var range: float = 2.0
@export var critical_chance: float = 0.1
@export var critical_multiplier: float = 2.0

@export_group("Visual")
@export var weapon_mesh: Mesh
@export var trail_particles: PackedScene
@export var swing_sound: AudioStream
@export var hit_sound: AudioStream

@export_group("Scaling")
@export var damage_scaling_curve: Curve  # Урон в зависимости от расстояния
@export var knockback_curve: Curve       # Откидывание в зависимости от расстояния

@export_group("Requirements")
@export var required_level: int = 1
@export var required_strength: int = 5
```

```gdscript
# enemy_resource.gd
class_name EnemyResource
extends Resource

@export_group("Base Stats")
@export var enemy_name: String = "Goblin"
@export var max_health: int = 50
@export var move_speed: float = 3.0
@export var damage: int = 10
@export var attack_range: float = 2.0
@export var detection_range: float = 10.0
@export var attack_cooldown: float = 1.0

@export_group("Behavior")
@export var patrol_points: Array[Vector3] = []
@export var is_aggressive: bool = true
@export var flee_health_threshold: float = 0.2

@export_group("Loot")
@export var experience_reward: int = 25
@export var gold_reward: int = 10
@export var loot_table: Dictionary[StringName, float] = {
    &"health_potion": 0.3,
    &"iron_sword": 0.05,
    &"gold_bag": 0.5
}

@export_group("Visuals")
@export var enemy_scene: PackedScene
@export var death_particles: PackedScene
@export var death_sound: AudioStream
```

**Использование Custom Resources:**

```gdscript
class_name Enemy
extends CharacterBody3D

@export var enemy_data: EnemyResource

var health: int
var can_attack: bool = true

@onready var health_bar: ProgressBar = %HealthBar
@onready var attack_timer: Timer = %AttackTimer

func _ready() -> void:
    if enemy_data == null:
        push_error("EnemyResource не назначен!")
        return
    _setup_from_data()

func _setup_from_data() -> void:
    health = enemy_data.max_health
    health_bar.max_value = enemy_data.max_health
    health_bar.value = health
    attack_timer.wait_time = enemy_data.attack_cooldown

func take_damage(amount: int) -> void:
    health -= amount
    health_bar.value = health
    if health <= 0:
        _die()

func _die() -> void:
    EventBus.enemy_killed.emit(enemy_data.enemy_name, global_position)
    EventBus.play_sfx.emit(&"enemy_death")
    queue_free()
```

---

## 4. Конечные автоматы (FSM)

### 4.1 Подход A: enum + match (простой)

Используй для простых объектов с 3–5 состояниями. Не требует наследования.

```gdscript
# simple_fsm_enemy.gd
class_name SimpleFSMEnemy
extends CharacterBody3D

enum State { IDLE, PATROL, CHASE, ATTACK, FLEE }
var current_state: State = State.IDLE

@export var move_speed: float = 3.0
@export var chase_speed: float = 6.0
@export var attack_range: float = 2.0
@export var detection_range: float = 10.0
@export var flee_speed: float = 5.0
@export var patrol_wait_time: float = 2.0

@onready var detection_ray: RayCast3D = %DetectionRay
@onready var animations: AnimationTree = %AnimationTree
@onready var patrol_timer: Timer = %PatrolTimer
@onready var attack_timer: Timer = %AttackTimer

var _patrol_index: int = 0
var _patrol_points: Array[Vector3] = [
    Vector3(5, 0, 0),
    Vector3(-5, 0, 5),
    Vector3(-3, 0, -7),
    Vector3(8, 0, -4),
]

func _ready() -> void:
    patrol_timer.timeout.connect(_on_patrol_timer_timeout)
    attack_timer.timeout.connect(_on_attack_timer_timeout)

func _process(delta: float) -> void:
    match current_state:
        State.IDLE:
            _state_idle(delta)
        State.PATROL:
            _state_patrol(delta)
        State.CHASE:
            _state_chase(delta)
        State.ATTACK:
            _state_attack(delta)
        State.FLEE:
            _state_flee(delta)

func _state_idle(_delta: float) -> void:
    velocity = Vector3.ZERO
    if not patrol_timer.is_stopped():
        return
    patrol_timer.start(patrol_wait_time)
    if _can_see_player():
        current_state = State.CHASE

func _state_patrol(_delta: float) -> void:
    if _can_see_player():
        current_state = State.CHASE
        return
    var target: Vector3 = _patrol_points[_patrol_index]
    var direction: Vector3 = (target - global_position).normalized()
    velocity = direction * move_speed
    move_and_slide()
    if global_position.distance_to(target) < 1.0:
        _patrol_index = (_patrol_index + 1) % _patrol_points.size()
        current_state = State.IDLE

func _state_chase(_delta: float) -> void:
    var player_pos: Vector3 = _get_player_position()
    if _distance_to(player_pos) <= attack_range:
        current_state = State.ATTACK
        return
    if _distance_to(player_pos) > detection_range * 1.5:
        current_state = State.PATROL
        return
    var direction: Vector3 = (player_pos - global_position).normalized()
    velocity = direction * chase_speed
    move_and_slide()

func _state_attack(_delta: float) -> void:
    velocity = Vector3.ZERO
    if _distance_to(_get_player_position()) > attack_range * 1.5:
        current_state = State.CHASE
        return
    if attack_timer.is_stopped():
        _perform_attack()
        attack_timer.start(1.0)

func _state_flee(delta: float) -> void:
    var away_direction: Vector3 = -(_get_player_position() - global_position).normalized()
    velocity = away_direction * flee_speed
    move_and_slide()
    if _distance_to(_get_player_position()) > detection_range * 2.0:
        current_state = State.IDLE

func _perform_attack() -> void:
    # Логика атаки
    pass

func _can_see_player() -> bool:
    # Реализация обнаружения игрока
    return false

func _get_player_position() -> Vector3:
    # Получение позиции игрока
    return Vector3.ZERO

func _distance_to(target: Vector3) -> float:
    return global_position.distance_to(target)

func _on_patrol_timer_timeout() -> void:
    current_state = State.PATROL

func _on_attack_timer_timeout() -> void:
    pass
```

### 4.2 Подход B: Node-based FSM (рекомендуемый)

Каждое состояние — отдельный узел-потомок StateMachine. Высоко переиспользуемый и тестируемый подход.

**Базовый класс State:**

```gdscript
# state.gd
class_name State
extends Node

# Сигнал для запроса перехода в другое состояние
signal transitioned(new_state_name: StringName)

# Персонаж/сущность, которой управляет это состояние (устанавливается StateMachine)
var actor: CharacterBody3D = null

# Вызывается при входе в состояние
func enter() -> void:
    pass

# Вызывается при выходе из состояния
func exit() -> void:
    pass

# Вызывается каждый кадр (_process)
func update(_delta: float) -> void:
    pass

# Вызывается каждый физический кадр (_physics_process)
func physics_update(_delta: float) -> void:
    pass
```

**State Machine:**

```gdscript
# state_machine.gd
class_name StateMachine
extends Node

@export var initial_state: State
var current_state: State
var states: Dictionary[StringName, State] = {}

func _ready() -> void:
    # Собираем все дочерние узлы State
    for child: Node in get_children():
        if child is State:
            states[child.name] = child
            child.transitioned.connect(_on_child_transitioned)
            child.actor = get_parent() as CharacterBody3D
        else:
            push_warning("StateMachine: потомок '%s' не является State" % child.name)

    # Входим в начальное состояние
    if initial_state:
        current_state = initial_state
        current_state.enter()
    elif states.size() > 0:
        current_state = states.values()[0]
        current_state.enter()

func _process(delta: float) -> void:
    if current_state:
        current_state.update(delta)

func _physics_process(delta: float) -> void:
    if current_state:
        current_state.physics_update(delta)

func _on_child_transitioned(new_state_name: StringName) -> void:
    var new_state: State = states.get(new_state_name)
    if new_state == null:
        push_warning("StateMachine: состояние '%s' не найдено" % new_state_name)
        return
    if new_state == current_state:
        return

    # Переход: выход → смена → вход
    current_state.exit()
    current_state = new_state
    current_state.enter()
```

**Пример реализации состояний игрока:**

```gdscript
# player_idle_state.gd
class_name PlayerIdleState
extends State

func enter() -> void:
    actor.velocity = Vector3.ZERO
    if actor.animation_tree:
        actor.animation_tree["parameters/Idle/transition_request"] = "Idle"

func physics_update(_delta: float) -> void:
    var input_dir: Vector2 = Input.get_vector(
        "move_left", "move_right", "move_forward", "move_backward"
    )
    if input_dir.length() > 0.1:
        transitioned.emit(&"Move")
        return

    if Input.is_action_just_pressed("jump") and actor.is_on_floor():
        transitioned.emit(&"Jump")
        return

    if not actor.is_on_floor():
        transitioned.emit(&"Fall")
```

```gdscript
# player_move_state.gd
class_name PlayerMoveState
extends State

func enter() -> void:
    if actor.animation_tree:
        actor.animation_tree["parameters/Walk/transition_request"] = "Walk"

func physics_update(delta: float) -> void:
    var input_dir: Vector2 = Input.get_vector(
        "move_left", "move_right", "move_forward", "move_backward"
    )
    if input_dir.length() < 0.1:
        transitioned.emit(&"Idle")
        return

    # Направление движения относительно камеры
    var camera_basis: Basis = actor.camera_basis
    var direction: Vector3 = (
        camera_basis * Vector3(input_dir.x, 0, input_dir.y)
    ).normalized()
    direction.y = 0.0
    direction = direction.normalized()

    actor.velocity.x = direction.x * actor.move_speed
    actor.velocity.z = direction.z * actor.move_speed
    actor.move_and_slide()

    # Поворот персонажа в направлении движения
    if direction.length() > 0.01:
        var target_rotation_y: float = atan2(-direction.x, -direction.z)
        actor.rotation.y = lerp_angle(
            actor.rotation.y, target_rotation_y, 10.0 * delta
        )

    if Input.is_action_just_pressed("jump") and actor.is_on_floor():
        transitioned.emit(&"Jump")
    if not actor.is_on_floor():
        transitioned.emit(&"Fall")
```

```gdscript
# player_jump_state.gd
class_name PlayerJumpState
extends State

var _has_jumped: bool = false

func enter() -> void:
    _has_jumped = false
    if actor.animation_tree:
        actor.animation_tree["parameters/Jump/transition_request"] = "Jump"

func physics_update(delta: float) -> void:
    if not _has_jumped:
        actor.velocity.y = actor.jump_velocity
        _has_jumped = true

    # Применяем гравитацию
    actor.velocity.y -= actor.gravity * delta
    actor.move_and_slide()

    # Управление в воздухе
    var input_dir: Vector2 = Input.get_vector(
        "move_left", "move_right", "move_forward", "move_backward"
    )
    if input_dir.length() > 0.1:
        var direction: Vector3 = (
            actor.camera_basis * Vector3(input_dir.x, 0, input_dir.y)
        ).normalized()
        actor.velocity.x = direction.x * actor.move_speed * 0.8
        actor.velocity.z = direction.z * actor.move_speed * 0.8

    if actor.is_on_floor():
        transitioned.emit(&"Idle")
```

```gdscript
# player_fall_state.gd
class_name PlayerFallState
extends State

func enter() -> void:
    if actor.animation_tree:
        actor.animation_tree["parameters/Fall/transition_request"] = "Fall"

func physics_update(delta: float) -> void:
    # Применяем гравитацию
    actor.velocity.y -= actor.gravity * delta
    actor.move_and_slide()

    # Управление в воздухе
    var input_dir: Vector2 = Input.get_vector(
        "move_left", "move_right", "move_forward", "move_backward"
    )
    if input_dir.length() > 0.1:
        var direction: Vector3 = (
            actor.camera_basis * Vector3(input_dir.x, 0, input_dir.y)
        ).normalized()
        actor.velocity.x = direction.x * actor.move_speed * 0.8
        actor.velocity.z = direction.z * actor.move_speed * 0.8

    if actor.is_on_floor():
        transitioned.emit(&"Idle")
```

### 4.3 Структура сцены для Node-based FSM

```
Player (CharacterBody3D) [player.gd]
├── StateMachine (Node) [state_machine.gd]
│   ├── Idle (Node) [player_idle_state.gd]
│   ├── Move (Node) [player_move_state.gd]
│   ├── Jump (Node) [player_jump_state.gd]
│   └── Fall (Node) [player_fall_state.gd]
├── Camera3D
├── CollisionShape3D
├── MeshInstance3D
├── AnimationTree
└── InteractionArea (Area3D)
```

### 4.4 Когда использовать какой подход

| Критерий | enum + match | Node-based FSM |
|---|---|---|
| Количество состояний | 3–5 | 5+ |
| Сложность переходов | Простые | Сложные (с анимациями, условиями) |
| Переиспользование | Нет | Да (состояния можно делить между персонажами) |
| Тестируемость | Низкая | Высокая (каждое состояние отдельно) |
| Рекомендация | NPC-стражники, простые враги | Игрок, боссы, сложные NPC |

---

## 5. Деревья поведения (Behavior Trees)

### 5.1 Базовый класс Task

Godot **не включает** встроенную систему деревьев поведения. Для продакшена используй **LimboAI** (C++ плагин, самый зрелый) или **Beehave** (GDScript, визуальный редактор). Для обучения и небольших проектов — реализация с нуля:

```gdscript
# task.gd — Базовый класс для всех узлов дерева поведения
class_name Task
extends Node

enum Status { FRESH, RUNNING, FAILED, SUCCEEDED, CANCELLED }

var control: Task = null       # Родительский таск (для распространения статуса)
var tree: Node = null          # Ссылка на корень дерева/агента
var actor: Node = null         # AI-агент, которым управляет дерево
var status: Status = Status.FRESH

# --- Финальные методы (НЕ переопределяй) ---
func running() -> void:
    status = Status.RUNNING
    if control:
        control.child_running()

func success() -> void:
    status = Status.SUCCEEDED
    if control:
        control.child_success()

func fail() -> void:
    status = Status.FAILED
    if control:
        control.child_fail()

func cancel() -> void:
    if status == Status.RUNNING:
        status = Status.CANCELLED
    for child: Node in get_children():
        if child is Task:
            child.cancel()

# --- Абстрактные методы (переопределяй в подклассах) ---
func run() -> void:
    push_error("Task.run() должен быть переопределён в %s" % name)
    fail()

func child_success() -> void:
    pass

func child_fail() -> void:
    pass

func child_running() -> void:
    pass

# --- Инициализация ---
func start() -> void:
    status = Status.FRESH
    for child: Node in get_children():
        if child is Task:
            child.control = self
            child.tree = self.tree
            child.actor = self.actor
            child.start()

func reset() -> void:
    cancel()
    status = Status.FRESH
```

### 5.2 Composite: Sequence и Selector

**Sequence** — выполняет дочерние узлы по порядку; завершается неудачей, если любой потомок терпит неудачу:

```gdscript
# sequence.gd — Выполняет потомков по порядку; неудача = остановка
class_name Sequence
extends Task

func run() -> void:
    for child: Node in get_children():
        if child is Task:
            child.run()
            if child.status != Status.SUCCEEDED:
                return  # Потомок неудачен или ещё выполняется
    success()

func child_success() -> void:
    pass  # Продолжаем к следующему потомку в последовательности

func child_fail() -> void:
    fail()

func child_running() -> void:
    running()
```

**Selector** — выполняет дочерние узлы по порядку; завершается успехом, если любой потомок успешен:

```gdscript
# selector.gd — Выполняет потомков по порядку; успех одного = успех селектора
class_name Selector
extends Task

var current_child_index: int = 0

func run() -> void:
    for i: int in range(current_child_index, get_child_count()):
        var child: Node = get_child(i)
        if child is Task:
            child.run()
            current_child_index = i
            if child.status == Status.SUCCEEDED:
                success()
                return
            elif child.status == Status.RUNNING:
                running()
                return
    fail()  # Все потомки завершились неудачей

func child_success() -> void:
    success()
    current_child_index = 0

func child_fail() -> void:
    current_child_index += 1
    # Пробуем следующего потомка на следующем кадре

func child_running() -> void:
    running()
```

### 5.3 Decorator: Inverter и Repeater

**Inverter** — инвертирует результат потомка (успех ↔ неудача):

```gdscript
# inverter.gd — Инвертирует результат потомка
class_name Inverter
extends Task

func run() -> void:
    if get_child_count() > 0 and get_child(0) is Task:
        get_child(0).run()
    else:
        fail()

func child_success() -> void:
    fail()

func child_fail() -> void:
    success()

func child_running() -> void:
    running()
```

**Repeater** — повторяет потомка N раз (0 = бесконечно):

```gdscript
# repeater.gd — Повторяет потомка N раз
class_name Repeater
extends Task

@export var max_repeats: int = 3  # 0 = бесконечный повтор
var repeat_count: int = 0

func run() -> void:
    if max_repeats > 0 and repeat_count >= max_repeats:
        success()
        return
    if get_child_count() > 0 and get_child(0) is Task:
        get_child(0).run()
    else:
        fail()

func child_success() -> void:
    repeat_count += 1
    if max_repeats > 0 and repeat_count >= max_repeats:
        repeat_count = 0
        success()
    else:
        running()  # Повторяем на следующем кадре

func child_fail() -> void:
    repeat_count = 0
    fail()

func child_running() -> void:
    running()
```

### 5.4 Leaf nodes (условия и действия)

**Условие (Condition):**

```gdscript
# check_enemy_in_range.gd — Условный лист: враг в радиусе обнаружения?
class_name CheckEnemyInRange
extends Task

@export var detection_range: float = 10.0

func run() -> void:
    if actor == null:
        fail()
        return
    var nearest: Node3D = _find_nearest_enemy()
    if nearest and actor.global_position.distance_to(nearest.global_position) <= detection_range:
        success()
    else:
        fail()

func _find_nearest_enemy() -> Node3D:
    var space_state: PhysicsDirectSpaceState3D = actor.get_world_3d().direct_space_state
    var query: PhysicsShapeQueryParameters3D = PhysicsShapeQueryParameters3D.new()
    var sphere: SphereShape3D = SphereShape3D.new()
    sphere.radius = detection_range
    query.shape_rid = sphere.get_rid()
    query.transform = actor.global_transform
    query.collide_with_bodies = true
    var results: Array[Dictionary] = space_state.intersect_shape(query)
    for result: Dictionary in results:
        if result.has("collider") and result["collider"] != actor:
            return result["collider"] as Node3D
    return null
```

**Действие (Action):**

```gdscript
# chase_target.gd — Действие: преследование цели
class_name ChaseTarget
extends Task

@export var chase_speed: float = 4.0
@export var stopping_distance: float = 2.0

func run() -> void:
    if actor == null or not actor is CharacterBody3D:
        fail()
        return
    var target: Node3D = actor.get("target") as Node3D
    if target == null:
        fail()
        return
    var distance: float = actor.global_position.distance_to(target.global_position)
    if distance <= stopping_distance:
        success()
        return
    var direction: Vector3 = (target.global_position - actor.global_position).normalized()
    var body: CharacterBody3D = actor as CharacterBody3D
    body.velocity = direction * chase_speed
    body.move_and_slide()
    # Поворот в направлении цели
    var target_y: float = atan2(-direction.x, -direction.z)
    body.rotation.y = lerp_angle(body.rotation.y, target_y, 5.0 * (1.0 / 60.0))
    running()
```

```gdscript
# attack_target.gd — Действие: атака цели
class_name AttackTarget
extends Task

@export var attack_damage: int = 10
@export var attack_cooldown: float = 1.0
var _cooldown_timer: float = 0.0

func run() -> void:
    if actor == null:
        fail()
        return
    var target: Node3D = actor.get("target") as Node3D
    if target == null:
        fail()
        return
    var distance: float = actor.global_position.distance_to(target.global_position)
    if distance > 3.0:
        fail()
        return
    if _cooldown_timer > 0.0:
        running()
        return
    # Выполняем атаку
    if target.has_method("take_damage"):
        target.take_damage(attack_damage)
    _cooldown_timer = attack_cooldown
    running()

func update(delta: float) -> void:
    if _cooldown_timer > 0.0:
        _cooldown_timer -= delta
```

### 5.5 Интеграция дерева поведения с агентом

```gdscript
# enemy_ai.gd — Скрипт на враге-CharacterBody3D
class_name EnemyAI
extends CharacterBody3D

@export var behavior_tree_root: Node  # Корневой узел Task в дереве сцены
@export var move_speed: float = 3.0
@export var detection_range: float = 10.0

var target: Node3D = null  # Текущая цель (доступна из листов)

@onready var vision_area: Area3D = %VisionArea

func _ready() -> void:
    if behavior_tree_root and behavior_tree_root is Task:
        behavior_tree_root.actor = self
        behavior_tree_root.tree = self
        behavior_tree_root.start()

func _physics_process(delta: float) -> void:
    if behavior_tree_root and behavior_tree_root is Task:
        behavior_tree_root.run()

func _on_vision_area_body_entered(body: Node3D) -> void:
    if body.is_in_group("player"):
        target = body

func _on_vision_area_body_exited(body: Node3D) -> void:
    if body == target:
        target = null
```

**Структура сцены для Behaviour Tree:**

```
Enemy (CharacterBody3D) [enemy_ai.gd]
├── BehaviorTree (Node) [корень дерева — Task]
│   ├── Selector (Node) [selector.gd]
│   │   ├── Sequence (Node) [sequence.gd]
│   │   │   ├── CheckEnemyInRange (Node) [check_enemy_in_range.gd]
│   │   │   ├── ChaseTarget (Node) [chase_target.gd]
│   │   │   └── AttackTarget (Node) [attack_target.gd]
│   │   └── Sequence (Node) [sequence.gd]
│   │       ├── CheckHealthLow (Node)
│   │       └── FleeToSafety (Node)
├── CollisionShape3D
├── MeshInstance3D
└── VisionArea (Area3D)
    └── CollisionShape3D
```

### 5.6 Рекомендация для продакшена

Для боевых проектов используй готовые плагины:

| Плагин | Язык | Особенности |
|---|---|---|
| **LimboAI** | C++ модуль | Самый зрелый, BT + FSM, визуальный отладчик |
| **Beehave** | GDScript | Визуальный редактор, идеален для GDScript-проектов |

- **LimboAI**: https://github.com/limbonaut/limboai
- **Beehave**: https://github.com/bitbrain/beehave

---

## 6. 3D: частицы, пути, кривые Безье

### 6.1 GPUParticles3D — ключевые свойства

| Свойство | Описание |
|---|---|
| `amount` | Максимальное количество живых частиц одновременно |
| `lifetime` | Время жизни каждой частицы в секундах |
| `explosiveness` | 0 = непрерывный поток, 1 = все мгновенно |
| `one_shot` | Испускать один раз и остановиться |
| `emitting` | Включить/выключить эмиссию |
| `process_material` | ParticleProcessMaterial для GPU-управления |
| `draw_passes` | Массив мешей для рендеринга частиц |

### 6.2 GPUParticles3D — настройка через код

```gdscript
# particle_controller.gd
class_name ParticleController
extends Node3D

@export var explosion_particles: GPUParticles3D
@export var trail_particles: GPUParticles3D

func _ready() -> void:
    _setup_explosion_particles()

func _setup_explosion_particles() -> void:
    if explosion_particles == null:
        return

    # Настройки эмиссии
    explosion_particles.amount = 50
    explosion_particles.emitting = false       # Не запускаем автоматически
    explosion_particles.lifetime = 1.5
    explosion_particles.explosiveness = 0.8   # 0 = поток, 1 = мгновенно
    explosion_particles.randomness = 0.5
    explosion_particles.one_shot = true        # Один раз и стоп

    # ProcessMaterial для GPU-настройки
    var mat: ParticleProcessMaterial = (
        explosion_particles.process_material as ParticleProcessMaterial
    )
    if mat == null:
        mat = ParticleProcessMaterial.new()
        explosion_particles.process_material = mat

    mat.direction = Vector3(0, 1, 0)
    mat.spread = 45.0
    mat.gravity = Vector3(0, -9.8, 0)
    mat.tangential_accel_min = 0.0
    mat.tangential_accel_max = 1.0

    # Градиент цвета по времени жизни
    var gradient: Gradient = Gradient.new()
    gradient.add_point(0.0, Color.WHITE)
    gradient.add_point(0.3, Color.YELLOW)
    gradient.add_point(0.7, Color.ORANGE)
    gradient.add_point(1.0, Color.TRANSPARENT)

    var gradient_texture: GradientTexture1D = GradientTexture1D.new()
    gradient_texture.gradient = gradient
    mat.color_ramp = gradient_texture

    # Масштаб частиц по времени жизни
    var scale_curve: Curve = Curve.new()
    scale_curve.add_point(Vector2(0.0, 0.0))
    scale_curve.add_point(Vector2(0.1, 1.0))
    scale_curve.add_point(Vector2(0.5, 0.8))
    scale_curve.add_point(Vector2(1.0, 0.0))

    var scale_texture: CurveTexture = CurveTexture.new()
    scale_texture.curve = scale_curve
    mat.scale_curve = scale_texture

func play_explosion() -> void:
    if explosion_particles:
        explosion_particles.emitting = true

func stop_trail() -> void:
    if trail_particles:
        trail_particles.emitting = false
```

### 6.3 Path3D и Curve3D — создание Безье-путей

```gdscript
# bezier_path_controller.gd
class_name BezierPathController
extends Node3D

@export var flight_path: Path3D
@export var flying_object: Node3D
@export var travel_speed: float = 5.0
@export var auto_start: bool = true

@onready var path_follow: PathFollow3D = %PathFollow3D

var _is_moving: bool = false

func _ready() -> void:
    _setup_path()
    if auto_start:
        start_movement()

func _setup_path() -> void:
    if flight_path == null or path_follow == null:
        return

    var curve: Curve3D = flight_path.curve

    # Добавляем точки с контрольными ручками Безье
    curve.clear_points()
    curve.add_point(Vector3(0, 0, 0))                                          # Точка 0
    curve.add_point(                                                           # Точка 1
        Vector3(5, 3, 0),       # Позиция
        Vector3(-1, 2, 0),      # In-handle (направление от предыдущей точки)
        Vector3(1, -1, 0)       # Out-handle (направление к следующей точке)
    )
    curve.add_point(                                                           # Точка 2
        Vector3(10, 0, 5),
        Vector3(-1, 0, -2),     # In-handle
        Vector3(2, 0, -1)       # Out-handle
    )
    curve.add_point(Vector3(15, 5, 10))                                       # Точка 3

    # Настройка PathFollow3D
    path_follow.loop = true
    path_follow.rotation_mode = PathFollow3D.ROTATION_ORIENTED
    path_follow.distance = 0.0

    # Интервал для baked-выборки (метры между точками)
    curve.bake_interval = 0.1

    # Запрос данных кривой
    var pos_at_half: Vector3 = curve.sample(0.5)               # Позиция на 50%
    var baked_length: float = curve.get_baked_length()          # Общая длина пути
    var closest_offset: float = curve.get_closest_offset(       # Ближайший offset
        Vector3(5, 2, 1)
    )
    print("Длина пути: %.1f метров" % baked_length)

func _process(delta: float) -> void:
    if _is_moving and path_follow:
        path_follow.progress += travel_speed * delta
        if path_follow.progress >= path_follow.path_length:
            if path_follow.loop:
                path_follow.progress = 0.0
            else:
                _is_moving = false
                return

        # Объект следует по пути
        if flying_object:
            flying_object.global_position = path_follow.global_position
            flying_object.global_rotation = path_follow.global_rotation

func start_movement() -> void:
    _is_moving = true

func stop_movement() -> void:
    _is_moving = false
```

### 6.4 PathFollow3D — анимация объектов вдоль пути

```gdscript
# cinematic_camera_path.gd
class_name CinematicCameraPath
extends Node3D

@export var camera_path: Path3D
@export var camera: Camera3D
@export var duration: float = 10.0        # Время проезда по пути
@export var ease_function: int = 0        # 0=Linear, 1=EaseIn, 2=EaseInOut

@onready var path_follow: PathFollow3D = %CameraPathFollow

var _elapsed: float = 0.0
var _is_playing: bool = false

func _ready() -> void:
    if camera_path and camera_path.curve:
        camera_path.curve.bake_interval = 0.05

func _process(delta: float) -> void:
    if not _is_playing:
        return

    _elapsed += delta
    var t: float = clampf(_elapsed / duration, 0.0, 1.0)

    # Применяем easing-функцию
    t = _apply_ease(t, ease_function)

    # Устанавливаем позицию на пути
    path_follow.progress_ratio = t

    # Камера следует за PathFollow3D
    camera.global_transform = path_follow.global_transform

    if _elapsed >= duration:
        _is_playing = false
        EventBus.cinematic_finished.emit()

func play() -> void:
    _elapsed = 0.0
    _is_playing = true

func stop() -> void:
    _is_playing = false

func _apply_ease(t: float, type: int) -> float:
    match type:
        0:
            return t  # Linear
        1:
            return t * t  # Ease In (квадратичная)
        2:
            return t * t * (3.0 - 2.0 * t)  # Smoothstep (Ease InOut)
        _:
            return t
```

### 6.5 Комбинация частиц и путей

```gdscript
# particle_trail_path.gd
class_name ParticleTrailPath
extends Node3D

@export var trail_path: Path3D
@export var particle_scene: PackedScene
@export var particle_count: int = 10
@export var particle_lifetime: float = 2.0
@export var follow_speed: float = 3.0

var _particles: Array[GPUParticles3D] = []
var _progress: float = 0.0

func _ready() -> void:
    if trail_path and trail_path.curve:
        trail_path.curve.bake_interval = 0.1
    _emit_particles_along_path(particle_count)

func _process(delta: float) -> void:
    _progress += follow_speed * delta
    if trail_path and trail_path.curve:
        var total_length: float = trail_path.curve.get_baked_length()
        if _progress > total_length:
            _progress = 0.0

func _emit_particles_along_path(count: int) -> void:
    if trail_path == null or trail_path.curve == null or particle_scene == null:
        return
    var curve: Curve3D = trail_path.curve
    for i: int in range(count):
        var t: float = float(i) / float(count)
        var pos: Vector3 = curve.sample(t)
        var particles: GPUParticles3D = particle_scene.instantiate() as GPUParticles3D
        if particles == null:
            continue
        particles.global_position = pos
        particles.one_shot = true
        particles.emitting = true
        add_child(particles)
        _particles.append(particles)

func clear_particles() -> void:
    for particle: GPUParticles3D in _particles:
        if is_instance_valid(particle):
            particle.queue_free()
    _particles.clear()
```

---

## 7. Система ввода

### 7.1 Polling vs Event-based

| Подход | Когда использовать | Метод |
|---|---|---|
| **Polling** (опрос) | Непрерывные действия: движение, камера, прицеливание | `Input.is_action_*()` в `_process` / `_physics_process` |
| **Event-based** (событийный) | Дискретные события: клики, прыжки, взаимодействие | `_input()` / `_unhandled_input()` |

### 7.2 `_input()` vs `_unhandled_input()`

| Метод | Описание |
|---|---|
| `_input()` | Получает **все** события первыми. Подходит для UI. Позволяет поглотить событие через `get_viewport().set_input_as_handled()` |
| `_unhandled_input()` | Получает события, **не обработанные UI**. **Предпочтителен для игрового ввода** — UI забирает свои события первым |

**Правило:** Используй `_unhandled_input()` для игрового ввода. Используй `_input()` только если тебе нужно обрабатывать события до UI.

### 7.3 Таблица всех Input-методов

| Метод | Назначение | Примечание |
|---|---|---|
| `Input.is_action_pressed("action")` | Непрерывная проверка | Использовать в `_physics_process` |
| `Input.is_action_just_pressed("action")` | Однокадровое событие при нажатии | Срабатывает один раз за нажатие |
| `Input.is_action_just_released("action")` | Однокадровое событие при отпускании | Для очистки/завершения действия |
| `Input.get_action_strength("action")` | Аналоговое значение | Геймпад-триггеры, стики (0.0–1.0) |
| `Input.get_action_raw_strength("action")` | Сырое аналоговое значение | Без мёртвой зоны |
| `Input.get_vector("neg_x", "pos_x", "neg_y", "pos_y")` | 2D-направление | Комбинирует 4 действия в Vector2 |
| `Input.get_axis("neg", "pos")` | Ось с мёртвой зоной | Возвращает -1.0 … 1.0 |
| `Input.is_action_just_pressed("ui_accept")` | UI-действия | Встроенные действия для UI |
| `event.is_action_pressed("action")` | Событийная проверка | В `_input` / `_unhandled_input` |
| `event.is_action_released("action")` | Событийная проверка отпускания | В `_input` / `_unhandled_input` |
| `InputMap.has_action("action")` | Проверка наличия действия | Для динамического добавления |
| `InputMap.add_action("action")` | Создание действия программно | В `_ready` |

### 7.4 Полный пример обработки ввода

```gdscript
# player_input_controller.gd
class_name PlayerInputController
extends Node

var move_input: Vector2 = Vector2.ZERO
var look_input: Vector2 = Vector2.ZERO
var jump_pressed: bool = false
var jump_just_pressed: bool = false
var interact_just_pressed: bool = false
var attack_just_pressed: bool = false
var attack_released: bool = false
var sprint_held: bool = false
var crouch_just_pressed: bool = false

func _physics_process(_delta: float) -> void:
    # --- Polling: непрерывные действия ---
    move_input = Input.get_vector(
        "move_left", "move_right", "move_forward", "move_backward"
    )
    sprint_held = Input.is_action_pressed("sprint")

    # Сбрасываем одноразовые флаги
    jump_just_pressed = false
    interact_just_pressed = false
    attack_just_pressed = false
    attack_released = false
    crouch_just_pressed = false

func _unhandled_input(event: InputEvent) -> void:
    # --- Прыжок ---
    if event.is_action_pressed("jump"):
        jump_just_pressed = true

    # --- Взаимодействие ---
    if event.is_action_pressed("interact"):
        interact_just_pressed = true

    # --- Атака: нажатие и отпускание ---
    if event.is_action_pressed("attack"):
        attack_just_pressed = true
    if event.is_action_released("attack"):
        attack_released = true

    # --- Приседание ---
    if event.is_action_pressed("crouch"):
        crouch_just_pressed = true

    # --- Мышь: клики ---
    if event is InputEventMouseButton:
        var mb: InputEventMouseButton = event as InputEventMouseButton
        if mb.button_index == MOUSE_BUTTON_LEFT and mb.pressed:
            _handle_left_click(mb.position)
        elif mb.button_index == MOUSE_BUTTON_RIGHT and mb.pressed:
            _handle_right_click(mb.position)

    # --- Мышь: движение ---
    if event is InputEventMouseMotion:
        var mm: InputEventMouseMotion = event as InputEventMouseMotion
        look_input = mm.relative

func _handle_left_click(position: Vector2) -> void:
    # Реализация клика левой кнопкой мыши
    pass

func _handle_right_click(position: Vector2) -> void:
    # Реализация клика правой кнопкой мыши
    pass
```

### 7.5 Работа с мышью: клики, движение, raycasting в 3D

```gdscript
# mouse_interaction_3d.gd
class_name MouseInteraction3D
extends Node3D

@export var camera: Camera3D
@export var ray_length: float = 1000.0
@export var interaction_mask: int = 1  # Collision layer для интерактивных объектов

var _mouse_position: Vector2 = Vector2.ZERO

func _ready() -> void:
    Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)

func _unhandled_input(event: InputEvent) -> void:
    # Захват/освобождение курсора
    if event.is_action_pressed("ui_cancel"):
        if Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED:
            Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
        else:
            Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)

    # Движение мыши (для камеры)
    if event is InputEventMouseMotion:
        var mm: InputEventMouseMotion = event as InputEventMouseMotion
        _mouse_position = mm.position

    # Левой кнопкой — raycast в 3D
    if event is InputEventMouseButton:
        var mb: InputEventMouseButton = event as InputEventMouseButton
        if mb.button_index == MOUSE_BUTTON_LEFT and mb.pressed:
            _perform_3d_raycast(mb.position)

func _perform_3d_raycast(screen_position: Vector2) -> void:
    if camera == null:
        return

    # Создаём луч из камеры
    var from: Vector3 = camera.project_ray_origin(screen_position)
    var to: Vector3 = from + camera.project_ray_normal(screen_position) * ray_length

    # Запрос к PhysicsServer
    var space_state: PhysicsDirectSpaceState3D = get_world_3d().direct_space_state
    var query: PhysicsRayQueryParameters3D = PhysicsRayQueryParameters3D.create(from, to)
    query.collision_mask = interaction_mask
    query.collide_with_bodies = true
    query.collide_with_areas = true

    var result: Dictionary = space_state.intersect_ray(query)

    if result.size() > 0:
        var collider: Object = result.get("collider")
        var position: Vector3 = result.get("position", Vector3.ZERO)
        var normal: Vector3 = result.get("normal", Vector3.UP)
        var distance: float = result.get("distance", 0.0)

        if collider is Node3D and collider.has_method("on_interact"):
            collider.on_interact(self)
            print("Попадание в %s на расстоянии %.1f" % [collider.name, distance])

        # Создаём эффект попадания
        _spawn_hit_effect(position, normal)

func _spawn_hit_effect(position: Vector3, normal: Vector3) -> void:
    # Реализация визуального эффекта попадания
    pass
```

### 7.6 Программная настройка Input Map

```gdscript
# input_setup.gd
class_name InputSetup
extends Node

func _ready() -> void:
    _add_custom_actions()

func _add_custom_actions() -> void:
    # Добавляем действие, если его нет
    if not InputMap.has_action("interact_secondary"):
        InputMap.add_action("interact_secondary")

    # Добавляем привязку клавиши
    var key_event: InputEventKey = InputEventKey.new()
    key_event.keycode = KEY_E
    key_event.ctrl_pressed = true
    InputMap.action_add_event("interact_secondary", key_event)

    # Добавляем привязку геймпада
    var pad_event: InputEventJoypadButton = InputEventJoypadButton.new()
    pad_event.button_index = JOY_BUTTON_Y
    InputMap.action_add_event("interact_secondary", pad_event)

    # Удаляем привязку (если нужно)
    # InputMap.action_erase_event("interact_secondary", key_event)

    # Удаляем действие полностью
    # InputMap.erase_action("interact_secondary")
```

---

## 8. Производительность

### 8.1 Кэширование узлов через @onready

Никогда не вызывай `get_node()` каждый кадр. Кэшируй все ссылки в `@onready`:

```gdscript
# ✅ ПРАВИЛЬНО — Кэширование
@onready var _mesh: MeshInstance3D = %Mesh
@onready var _material: StandardMaterial3D = _mesh.material_override as StandardMaterial3D
@onready var _collision: CollisionShape3D = %CollisionShape
@onready var _timer: Timer = %CooldownTimer
@onready var _audio_player: AudioStreamPlayer3D = %AudioPlayer

func _process(delta: float) -> void:
    _mesh.rotate_y(delta)     # Используем кэшированную ссылку
    _timer.start()            # Быстрый доступ

# ❌ НЕДОПУСТИМО — get_node() каждый кадр
func _process(delta: float) -> void:
    get_node("Mesh").rotate_y(delta)          # Медленно — хеш-поиск каждый кадр
    get_node("Timer").start()                 # То же самое
    $CollisionShape3D.disabled = false        # Оператор $ — тоже медленно
```

### 8.2 Object Pooling (полный код)

Object Pooling переиспользует объекты вместо постоянного создания/уничтожения:

```gdscript
# object_pool.gd
class_name ObjectPool
extends Node

## Простой пул объектов для переиспользоваения Node
## Предотвращает частые instantiate()/queue_free() в рантайме

var _pool: Array[Node] = []
var _scene: PackedScene
var _parent: Node
var _is_setup: bool = false

## Инициализация пула. Вызывать в _ready() или при запуске игры.
func setup(scene: PackedScene, parent: Node, initial_size: int) -> void:
    assert(scene != null, "ObjectPool: scene не может быть null")
    assert(parent != null, "ObjectPool: parent не может быть null")
    assert(initial_size >= 0, "ObjectPool: initial_size должен быть >= 0")

    _scene = scene
    _parent = parent
    _is_setup = true

    # Предзаполняем пул
    for i: int in range(initial_size):
        var instance: Node = _scene.instantiate()
        instance.set_process(false)
        instance.set_physics_process(false)
        _parent.add_child(instance)
        instance.visible = false
        # Вызываем reset(), если объект его поддерживает
        if instance.has_method("reset"):
            instance.reset()
        _pool.append(instance)

## Получить объект из пула. Если пул пуст — создаётся новый.
func get_instance() -> Node:
    assert(_is_setup, "ObjectPool: вызови setup() перед использованием")
    var instance: Node
    if _pool.size() > 0:
        instance = _pool.pop_back()
    else:
        instance = _scene.instantiate()
        _parent.add_child(instance)
        print("ObjectPool: создан новый экземпляр (пул исчерпан)")
    instance.set_process(true)
    instance.set_physics_process(true)
    instance.visible = true
    # Вызываем activate(), если объект его поддерживает
    if instance.has_method("activate"):
        instance.activate()
    return instance

## Вернуть объект в пул.
func return_instance(instance: Node) -> void:
    assert(_is_setup, "ObjectPool: вызови setup() перед использованием")
    if instance == null:
        return
    instance.set_process(false)
    instance.set_physics_process(false)
    instance.visible = false
    # Вызываем reset(), если объект его поддерживает
    if instance.has_method("reset"):
        instance.reset()
    _pool.append(instance)

## Текущий размер пула (доступных объектов)
func available_count() -> int:
    return _pool.size()

## Очистить весь пул
func clear() -> void:
    for instance: Node in _pool:
        if is_instance_valid(instance):
            instance.queue_free()
    _pool.clear()

func _notification(what: int) -> void:
    if what == NOTIFICATION_TREE_EXITING:
        clear()
```

**Пример использования ObjectPool:**

```gdscript
# projectile_manager.gd
class_name ProjectileManager
extends Node

@export var projectile_scene: PackedScene
@export var pool_parent: Node
@export var initial_pool_size: int = 20

var _pool: ObjectPool

func _ready() -> void:
    _pool = ObjectPool.new()
    add_child(_pool)
    _pool.setup(projectile_scene, pool_parent, initial_pool_size)

func spawn_projectile(position: Vector3, direction: Vector3, damage: int) -> void:
    var projectile: Node = _pool.get_instance()
    if projectile is Projectile:
        var p: Projectile = projectile as Projectile
        p.global_position = position
        p.setup(direction, damage, self)
    # Подключаем сигнал окончания жизни для возврата в пул
    if projectile.has_signal("lifetime_expired"):
        projectile.lifetime_expired.connect(_pool.return_instance)

func _on_projectile_hit(projectile: Node) -> void:
    _pool.return_instance(projectile)
```

### 8.3 MultiMeshInstance3D для одинаковых объектов

Для рендеринга сотен/тысяч одинаковых объектов (трава, обломки, декорации):

```gdscript
# grass_field.gd
class_name GrassField
extends Node3D

@export var grass_count: int = 5000
@export var spread_radius: float = 50.0
@export var grass_height_min: float = 0.3
@export var grass_height_max: float = 0.8

@onready var multimesh_instance: MultiMeshInstance3D = %GrassMultiMesh

func _ready() -> void:
    _generate_grass()

func _generate_grass() -> void:
    var multimesh: MultiMesh = multimesh_instance.multimesh
    multimesh.transform_format = MultiMesh.TRANSFORM_3D
    multimesh.instance_count = grass_count

    for i: int in range(grass_count):
        # Случайная позиция в радиусе
        var random_x: float = randf_range(-spread_radius, spread_radius)
        var random_z: float = randf_range(-spread_radius, spread_radius)
        var position: Vector3 = Vector3(random_x, 0.0, random_z)

        # Выравнивание по поверхности (опционально)
        # position.y = _get_terrain_height(position)

        # Случайный масштаб (высота)
        var scale_y: float = randf_range(grass_height_min, grass_height_max)
        var scale: Vector3 = Vector3(1.0, scale_y, 1.0)

        # Случайный поворот
        var rotation_y: float = randf() * TAU

        # Формируем Transform3D
        var basis: Basis = Basis(Vector3.UP, rotation_y).scaled(scale)
        var transform: Transform3D = Transform3D(basis, position)
        multimesh.set_instance_transform(i, transform)

        # Случайный цвет (опционально)
        if multimesh.use_custom_data:
            multimesh.set_instance_custom_data(i, Color(
                randf_range(0.8, 1.0),
                randf_range(0.8, 1.0),
                randf_range(0.5, 0.7),
                1.0
            ))
```

### 8.4 Минимизация аллокаций в _process

```gdscript
# ✅ ПРАВИЛЬНО — Переиспользуем объекты
var _direction: Vector3 = Vector3.ZERO        # Переиспользуемый вектор
var _temp_array: Array[Node3D] = []            # Переиспользуемый массив
var _reuse_color: Color = Color.WHITE          # Переиспользуемый цвет

func _physics_process(delta: float) -> void:
    # Переиспользуем вектор, не создаём новый каждый кадр
    _direction = _get_input_direction()
    velocity = _direction * move_speed
    move_and_slide()

# ❌ НЕДОПУСТИМО — Создание объектов каждый кадр
func _physics_process(delta: float) -> void:
    var direction: Vector3 = Vector3()  # Выделяет память каждый кадр
    direction.x = Input.get_axis("move_left", "move_right")
    direction.z = Input.get_axis("move_forward", "move_backward")
    velocity = direction * move_speed
    move_and_slide()

# ✅ ПРАВИЛЬНО — Типизированные массивы быстрее
var _enemies: Array[CharacterBody3D] = []

# ❌ НЕДОПУСТИМО — Нетипизированный массив
var _enemies: Array = []  # Медленнее, без проверки типов
```

### 8.5 Избегание get_node() каждый кадр

```gdscript
# ✅ ПРАВИЛЬНО — Все ссылки закэшированы
class_name OptimizedEnemy
extends CharacterBody3D

@export var move_speed: float = 3.0

@onready var _vision: Area3D = %VisionArea
@onready var _mesh: MeshInstance3D = %Mesh
@onready var _anim_tree: AnimationTree = %AnimationTree
@onready var _nav_agent: NavigationAgent3D = %NavigationAgent3D
@onready var _attack_area: Area3D = %AttackArea

func _physics_process(delta: float) -> void:
    # Все ссылки мгновенные — никаких поисков
    if _anim_tree:
        _anim_tree["parameters/conditions/is_moving"] = velocity.length() > 0.1

func _on_vision_body_entered(body: Node3D) -> void:
    if body.is_in_group("player"):
        _target = body

# ❌ НЕДОПУСТИМО — Поиски в _physics_process
func _physics_process(delta: float) -> void:
    $VisionArea.monitoring = true
    $NavigationAgent3D.target_position = _target.global_position
    get_node("AnimationTree").set("parameters/conditions/is_moving", true)
    %Mesh.rotate_y(delta)  # % тоже лучше кэшировать в @onready
```

### 8.6 Физика: оптимизация

```gdscript
# Оптимизация физики
func _ready() -> void:
    # Area3D для триггер-зон (дешевле, чем RigidBody3D)
    # move_and_slide() для персонажей (не move_and_collide())
    # Sleeping для RigidBody3D, которые не нуждаются в постоянной симуляции
    var rb: RigidBody3D = %Prop
    rb.can_sleep = true
    rb.sleeping = true   # Начинаем в спящем режиме

    # Используй collision layers/masks вместо множества RayCast3D
    # Избегай множества RayCast3D каждый кадр — группируй проверки
```

---

## 9. Новое в Godot 4.3 и 4.4

### 9.1 Godot 4.3 (август 2024)

| Функция | Описание |
|---|---|
| **Нативный FBX** | Импорт FBX без конвертации в glTF. Файлы `.fbx` импортируются напрямую |
| **Улучшенные частицы** | Рефакторизованная система частиц с улучшенной архитектурой |
| **GDScript улучшения** | Более точные сообщения об ошибках, повышение производительности |
| **Рендеринг** | Новые возможности рендеринга, улучшение качества |

```gdscript
# 4.3: Прямой импорт FBX — просто помести файл в проект
# assets/3d/models/character.fbx → автоматически импортируется
# Настраивается через Import dock, как и glTF

# 4.3: Улучшенные сообщения об ошибках GDScript
# Более точные указания на строку и причину ошибки
```

### 9.2 Godot 4.4 (март 2025)

| Функция | Описание |
|---|---|
| **UID ресурсов** | Уникальные идентификаторы для ресурсов. Надёжные межсценовые ссылки |
| **Типизированные словари** | `Dictionary[KeyType, ValueType]` с поддержкой Inspector |
| **Jolt Physics** | Альтернативный физический движок (быстрее GodotPhysics) |
| **Встроенное игровое окно** | Запуск игры внутри редактора (Windows, Linux, Android) |
| **Интерактивное редактирование** | Изменение свойств во время выполнения/паузы |
| **REPL в отладчике** | Expression evaluator в отладчике |
| **Автоматический профайлер** | Профайлер запускается автоматически при запуске игры |
| **3× быстрее загрузка** | Загрузка больших проектов стала значительно быстрее |
| **`@static_unload`** | Автоочистка статических переменных при перезагрузке |

**Примеры новых возможностей 4.4:**

```gdscript
# === UID ресурсов (4.4+) ===
# Загрузка по UID вместо пути к файлу (более надёжно при переименовании)
var texture: Texture2D = load("uid://d2b4x7example")

# === Типизированные словари (4.4+) ===
# Полная поддержка в Inspector с автодополнением
@export var stats: Dictionary[String, int] = {
    "strength": 10,
    "defense": 5,
    "speed": 8,
}
@export var item_drops: Dictionary[StringName, PackedScene] = {}
@export var enemy_spawns: Dictionary[String, Vector3] = {}

func get_stat(stat_name: String) -> int:
    return stats.get(stat_name, 0)

# === Jolt Physics (4.4+) ===
# Включается в Project Settings → Physics → 3D → Physics Engine → JoltPhysics
# Значительно быстрее для сложных сцен с множеством столкновений
# Совместим с существующим GodotPhysics API — замена прозрачна

# === @static_unload (4.4+) ===
class_name MySingleton
extends Node

@static_unload
static var instance: MySingleton  # Автоочистка при перезагрузке скриптов

# === Expression evaluator (4.4+) ===
# В отладчике (Debug → Debugger) можно выполнять выражения:
# self.health = 100
# self.velocity = Vector3(0, 5, 0)
# get_tree().reload_current_scene()
```

### 9.3 Сводная таблица: что использовать

| Возможность | Версия | Когда использовать |
|---|---|---|
| Статическая типизация | 4.0+ | **Всегда** — обязательно для всех проектов |
| `%` уникальные узлы | 4.0+ | **Всегда** — вместо `$` путей |
| Typed Arrays | 4.0+ | `Array[NodeType]` для всех коллекций |
| Custom Resources | 4.0+ | Для игровых данных (оружие, враги, предметы) |
| Node-based FSM | 4.0+ | Сложные персонажи (игрок, боссы) |
| Event Bus | 4.0+ | Межсценовое общение |
| Нативный FBX | 4.3+ | Прямой импорт FBX без конвертации |
| UID ресурсов | 4.4+ | Надёжные ссылки на ресурсы между сценами |
| Типизированные словари | 4.4+ | `Dictionary[K, V]` с поддержкой Inspector |
| Jolt Physics | 4.4+ | Для сложных физических сцен (множество объектов) |
| `@static_unload` | 4.4+ | Очистка статики при перезагрузке скриптов |

---

## Быстрые правила-чеклист для агента

Перед генерацией кода проверь:

- [ ] **Весь код типизирован** — `var x: int`, `func f() -> void`, `Array[Type]`
- [ ] **Порядок кода** соблюдён (12 шагов из раздела 1.2)
- [ ] **`%` уникальные узлы** вместо `$` путей
- [ ] **Все `@onready`** для ссылок на узлы — нет `get_node()` в `_process`
- [ ] **Сигналы** для развязанного общения, не прямые ссылки на далёкие узлы
- [ ] **Autoload** не хранит ссылки на сцены, только данные + сигналы
- [ ] **Custom Resource** для данных (оружие, враги, предметы)
- [ ] **FSM**: простые → enum+match, сложные → Node-based
- [ ] **Object Pooling** для часто создаваемых объектов (пули, эффекты)
- [ ] **`_unhandled_input()`** предпочтительнее `_input()` для игрового ввода
- [ ] **`_physics_process`** для движения, `_process` — для визуала
