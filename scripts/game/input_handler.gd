class_name InputHandler
extends Node

## Обработчик ввода игрока — управление выбором планет, наведением
## и созданием потоков кораблей.

## preload для доступа к enum GameState.State в Godot 4.5
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


func _ready() -> void:
        if camera == null:
                push_warning("InputHandler: камера не назначена — ввод не работает.")
        if planets_container == null:
                push_warning("InputHandler: контейнер планет не назначен.")


func _unhandled_input(event: InputEvent) -> void:
        # Не обрабатываем ввод, если игра не активна
        if GameManager == null or GameManager.game_state == null:
                return
        if GameManager.game_state.current_state != _GameStateScript.State.PLAYING:
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

                # Двойной клик — фокус камеры на планете

                # Клик в пустоту

                # Клик по своей планете — выделяем

                # Клик по чужой/нейтральной планете при наличии выделенной — поток
        if not mb.pressed:
                return

                # Двойной клик — фокус камеры на планете

                # Клик в пустоту

                # Клик по своей планете — выделяем

                # Клик по чужой/нейтральной планете при наличии выделенной — поток
        var planet = _raycast_planet()

        # Двойной клик — фокус камеры на планете
        if mb.double_click:
                _handle_double_click(planet)
                return

                # Клик в пустоту

                # Клик по своей планете — выделяем

                # Клик по чужой/нейтральной планете при наличии выделенной — поток
        var shift_held: bool = Input.is_key_pressed(KEY_SHIFT)

        # Клик в пустоту
        if planet == null:
                if not shift_held:
                        _deselect()
                return

                # Клик по своей планете — выделяем

                # Клик по чужой/нейтральной планете при наличии выделенной — поток
        if planet.owner_id == GameConstants.PlayerId.PLAYER:
                _select_planet(planet)
                return

                # Клик по чужой/нейтральной планете при наличии выделенной — поток
        if _selected_planet != null and _selected_planet != planet:
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

                # Покидаем предыдущую планету

                # Наводимся на новую планету
        if Input.is_mouse_button_pressed(MOUSE_BUTTON_MIDDLE):
                return

                # Покидаем предыдущую планету

                # Наводимся на новую планету
        var planet = _raycast_planet()

        if planet == _hovered_planet:
                return

                # Покидаем предыдущую планету

                # Наводимся на новую планету
        if _hovered_planet != null:
                EventBus.ui_hide_planet_info.emit()

                # Наводимся на новую планету
        _hovered_planet = planet

        # Наводимся на новую планету
        if _hovered_planet != null:
                EventBus.ui_show_planet_info.emit(_hovered_planet)


# ─── Выбор и отмена выбора ─────────────────────────────────────────────────


func _select_planet(planet: Node3D) -> void:
        if _selected_planet == planet:
                return
        if _selected_planet != null and is_instance_valid(_selected_planet):
                _selected_planet.unhighlight()
        _selected_planet = planet
        _selected_planet.highlight()


func _deselect() -> void:
        if _selected_planet != null and is_instance_valid(_selected_planet):
                _selected_planet.unhighlight()
        _selected_planet = null


# ─── Создание потока ───────────────────────────────────────────────────────


func _create_stream(source: Node3D, target: Node3D) -> void:
        var ship_count: int = maxi(source.pending_ships, 1)
        GameManager.stream_manager.create_stream(source, target, source.owner_id, ship_count)
        source.pending_ships = 0


# ─── Фокусировка камеры ────────────────────────────────────────────────────


func _focus_camera_on_planet(planet: Node3D) -> void:
        if _controller != null:
                _controller.focus_on_planet(planet)


# ─── Лучевой каст для определения планеты под курсором ─────────────────────


func _raycast_planet() -> Node3D:
        if camera == null:
                return null
        var mouse_pos: Vector2 = get_viewport().get_mouse_position()
        var ray_origin: Vector3 = camera.project_ray_origin(mouse_pos)
        var ray_direction: Vector3 = camera.project_ray_normal(mouse_pos)
        var ray_end: Vector3 = ray_origin + ray_direction * 1000.0

        var space_state = get_world_3d().direct_space_state
        var query := PhysicsRayQueryParameters3D.create(ray_origin, ray_end)
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
