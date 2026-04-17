class_name InputHandler
extends Node

## Обработчик ввода игрока — управление выбором планет, наведением
## и созданием потоков кораблей.

## preload для доступа к enum GameState.EState в Godot 4.5
const _GameStateScript := preload("res://scripts/game/game_state.gd")

@export var camera: Camera3D:  ## Главная камера сцены
        set(value):
                camera = value
                _controller = value  # Без каста к CameraController — Godot 4.5 не найдёт тип

@export var planets_container: Node3D:  ## Контейнер с узлами Planet3D
        set(value):
                planets_container = value

## Внутренняя ссылка на контроллер камеры (для фокусировки)
var _controller = null  # CameraController — без типизации для совместимости с 4.5

var _selected_planet = null  # Planet3D — без типизации для совместимости с 4.5
var _hovered_planet = null  # Planet3D — без типизации для совместимости с 4.5

var _debug_frame_counter: int = 0


func _ready() -> void:
        if camera == null:
                push_warning("InputHandler: камера не назначена — ввод не работает.")
        if planets_container == null:
                push_warning("InputHandler: контейнер планет не назначен.")
        print("[InputHandler] _ready() called. camera=%s, planets=%s" % [camera, planets_container])


func _process(_delta: float) -> void:
        ## Отладка: выводим состояние каждые 300 кадров (~5 сек)
        _debug_frame_counter += 1
        if _debug_frame_counter <= 15 or _debug_frame_counter % 300 == 0:
                var state_str = "?"
                if GameManager and GameManager.game_state:
                        state_str = "%d (PLAYING=%d)" % [
                                GameManager.game_state.current_state,
                                _GameStateScript.EState.PLAYING
                        ]
                else:
                        state_str = "GameManager or game_state is NULL"
                print("[InputHandler] frame=%d, state=%s, camera=%s, planets=%d" % [
                        _debug_frame_counter,
                        state_str,
                        "OK" if camera else "NULL",
                        GameManager.all_planets.size() if GameManager else -1
                ])


func _unhandled_input(event: InputEvent) -> void:
        # Не обрабатываем ввод, если игра не активна
        if GameManager == null:
                print("[InputHandler] _unhandled_input: GameManager is NULL")
                return
        if GameManager.game_state == null:
                print("[InputHandler] _unhandled_input: game_state is NULL")
                return
        if GameManager.game_state.current_state != _GameStateScript.EState.PLAYING:
                # Выводим только для первых нескольких событий, чтобы не засорять лог
                if _debug_frame_counter < 60:
                        print("[InputHandler] _unhandled_input: state=%d, expected PLAYING=%d" % [
                                GameManager.game_state.current_state,
                                _GameStateScript.EState.PLAYING
                        ])
                return
        if event is InputEventMouseButton:
                _handle_mouse_button(event as InputEventMouseButton)
        elif event is InputEventMouseMotion:
                _handle_mouse_hover()


# ─── Обработка кликов ──────────────────────────────────────────────────────


func _handle_mouse_button(mb: InputEventMouseButton) -> void:
        # Правая и средняя кнопки обрабатываются камерой, не перехватываем
        if mb.button_index != MOUSE_BUTTON_LEFT:
                return
        if not mb.pressed:
                return

        print("[InputHandler] LEFT CLICK detected, double=%s" % mb.double_click)

        var planet = _raycast_planet()

        # Двойной клик — фокус камеры на планете
        if mb.double_click:
                _handle_double_click(planet)
                return

        var shift_held: bool = Input.is_key_pressed(KEY_SHIFT)

        # Клик в пустоту
        if planet == null:
                print("[InputHandler] Click — no planet found (raycast miss)")
                if not shift_held:
                        _deselect()
                return

        print("[InputHandler] Click — planet found: %s, owner=%d, pending=%d" % [
                planet.name,
                planet.get("owner_id"),
                planet.get("pending_ships")
        ])

        if planet.owner_id == GameConstants.PlayerId.PLAYER:
                _select_planet(planet)
                return

        if _selected_planet != null and _selected_planet != planet:
                print("[InputHandler] Creating stream: %s → %s, ships=%d" % [
                        _selected_planet.name, planet.name,
                        maxi(_selected_planet.get("pending_ships"), 1)
                ])
                _create_stream(_selected_planet, planet)
                if not shift_held:
                        _deselect()


func _handle_double_click(planet: Node3D) -> void:
        if planet == null:
                return
        _focus_camera_on_planet(planet)


# ─── Обработка наведения ───────────────────────────────────────────────────


func _handle_mouse_hover() -> void:
        # Пропускаем наведение во время перетаскивания кнопками
        if Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
                return
        if Input.is_mouse_button_pressed(MOUSE_BUTTON_MIDDLE):
                return
        var planet = _raycast_planet()
        if planet == _hovered_planet:
                return
        if _hovered_planet != null:
                EventBus.ui_hide_planet_info.emit()
        _hovered_planet = planet
        if _hovered_planet != null:
                EventBus.ui_show_planet_info.emit(_hovered_planet)


# ─── Выбор и отмена выбора ─────────────────────────────────────────────────


func _select_planet(planet: Node3D) -> void:
        if _selected_planet == planet:
                return
        if _selected_planet != null and is_instance_valid(_selected_planet):
                _selected_planet.call("unhighlight")
        _selected_planet = planet
        _selected_planet.call("highlight")
        print("[InputHandler] Selected planet: %s (owner=%d, pending=%d)" % [
                planet.name, planet.get("owner_id"), planet.get("pending_ships")
        ])


func _deselect() -> void:
        if _selected_planet != null and is_instance_valid(_selected_planet):
                _selected_planet.call("unhighlight")
        _selected_planet = null
        print("[InputHandler] Deselected")


# ─── Создание потока ───────────────────────────────────────────────────────


func _create_stream(source: Node3D, target: Node3D) -> void:
        var ship_count: int = maxi(int(source.get("pending_ships")), 1)
        print("[InputHandler] Creating stream with %d ships" % ship_count)
        GameManager.stream_manager.call("create_stream", source, target, source.get("owner_id"), ship_count)
        source.set("pending_ships", 0)


# ─── Фокусировка камеры ────────────────────────────────────────────────────


func _focus_camera_on_planet(planet: Node3D) -> void:
        if _controller != null:
                _controller.call("focus_on_planet", planet)


# ─── Лучевой каст для определения планеты под курсором ─────────────────────


func _raycast_planet() -> Node3D:
        if camera == null:
                if _debug_frame_counter < 60:
                        print("[InputHandler] _raycast_planet: camera is NULL")
                return null
        var mouse_pos: Vector2 = get_viewport().get_mouse_position()
        var ray_origin: Vector3 = camera.project_ray_origin(mouse_pos)
        var ray_direction: Vector3 = camera.project_ray_normal(mouse_pos)
        var ray_end: Vector3 = ray_origin + ray_direction * 1000.0

        var world3d = get_viewport().get_world_3d()
        if world3d == null:
                if _debug_frame_counter < 60:
                        print("[InputHandler] _raycast_planet: world3d is NULL")
                return null

        var space_state = world3d.direct_space_state
        var query := PhysicsRayQueryParameters3D.create(ray_origin, ray_end)
        query.collide_with_areas = true  ## Планеты используют Area3D для детекции
        query.collide_with_bodies = false  ## Не нужен для Area3D
        query.collision_mask = 1  # Слой по умолчанию для планет

        var result: Dictionary = space_state.intersect_ray(query)
        if result.is_empty():
                return null
        var collider: Object = result.get("collider")
        if collider == null:
                return null
        return _find_planet_ancestor(collider)


func _find_planet_ancestor(node: Node) -> Node3D:
        var current: Node = node
        while current != null:
                if current.has_method("receive_ship"):
                        return current as Node3D
                current = current.get_parent()
        return null
