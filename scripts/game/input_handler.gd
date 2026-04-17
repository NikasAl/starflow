extends Node

## Обработчик ввода игрока — управление выбором планет, наведением
## и созданием потоков кораблей.

const _GameStateScript := preload("res://scripts/game/game_state.gd")

@export var camera: Camera3D:
	set(value):
		camera = value
		_controller = value

@export var planets_container: Node3D:
	set(value):
		planets_container = value

var _controller = null
var _selected_planet = null
var _hovered_planet = null

var _dbg: int = 0


func _ready() -> void:
	print_rich("[color=yellow][InputHandler] _ready() camera=[/color]%s[color=yellow] planets=[/color]%s[color=yellow]" % [camera, planets_container])
	if camera == null:
		push_warning("InputHandler: камера не назначена — ввод не работает.")
	if planets_container == null:
		push_warning("InputHandler: контейнер планет не назначен.")
	## Найдём камеру и контейнер вручную если не заданы
	if camera == null:
		camera = get_parent().get_node_or_null("CameraRig")
		print_rich("[color=orange][InputHandler] Автопоиск камеры: %s[/color]" % camera)
	if planets_container == null:
		planets_container = get_parent().get_node_or_null("World/Planets")
		print_rich("[color=orange][InputHandler] Автопоиск планет: %s[/color]" % planets_container)


func _process(_delta: float) -> void:
	_dbg += 1
	if _dbg == 1 or _dbg % 300 == 0:
		var st := "NONE"
		if GameManager and is_instance_valid(GameManager) and GameManager.game_state:
			st = "%d (PLAYING=%d)" % [GameManager.game_state.current_state, _GameStateScript.EState.PLAYING]
		print("[InputHandler] f=%d state=%s cam=%s planets=%d" % [
			_dbg, st,
			"OK" if camera else "NULL",
			GameManager.all_planets.size() if GameManager and is_instance_valid(GameManager) else -1
		])


func _unhandled_input(event: InputEvent) -> void:
	if not is_instance_valid(GameManager) or not GameManager.game_state:
		return
	if GameManager.game_state.current_state != _GameStateScript.EState.PLAYING:
		return

	if event is InputEventMouseButton:
		_handle_mouse_button(event as InputEventMouseButton)
	elif event is InputEventMouseMotion:
		_handle_mouse_hover()


func _handle_mouse_button(mb: InputEventMouseButton) -> void:
	if mb.button_index != MOUSE_BUTTON_LEFT:
		return
	if not mb.pressed:
		return

	print("[InputHandler] LEFT CLICK double=%s" % mb.double_click)

	var planet = _raycast_planet()

	if mb.double_click:
		_handle_double_click(planet)
		return

	var shift_held: bool = Input.is_key_pressed(KEY_SHIFT)

	if planet == null:
		print("[InputHandler] Click — raycast miss")
		if not shift_held:
			_deselect()
		return

	var p_owner: int = planet.get("owner_id") if planet.has_method("get") else -999
	var p_pending: int = planet.get("pending_ships") if planet.has_method("get") else -999
	print("[InputHandler] Click — planet=%s owner=%d pending=%d" % [planet.name, p_owner, p_pending])

	if p_owner == GameConstants.PlayerId.PLAYER:
		_select_planet(planet)
		return

	if _selected_planet != null and _selected_planet != planet:
		_create_stream(_selected_planet, planet)
		if not shift_held:
			_deselect()


func _handle_double_click(planet: Node3D) -> void:
	if planet == null:
		return
	_focus_camera_on_planet(planet)


func _handle_mouse_hover() -> void:
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


func _select_planet(planet: Node3D) -> void:
	if _selected_planet == planet:
		return
	if _selected_planet != null and is_instance_valid(_selected_planet):
		_selected_planet.call("unhighlight")
	_selected_planet = planet
	_selected_planet.call("highlight")
	print("[InputHandler] Selected: %s" % planet.name)


func _deselect() -> void:
	if _selected_planet != null and is_instance_valid(_selected_planet):
		_selected_planet.call("unhighlight")
	_selected_planet = null


func _create_stream(source: Node3D, target: Node3D) -> void:
	var ship_count: int = maxi(int(source.get("pending_ships") if source.has_method("get") else 0), 1)
	if is_instance_valid(GameManager) and is_instance_valid(GameManager.stream_manager):
		GameManager.stream_manager.call("create_stream", source, target, source.get("owner_id") if source.has_method("get") else 0, ship_count)
		source.set("pending_ships", 0) if source.has_method("set") else null
		print("[InputHandler] Stream sent: %s → %s (%d ships)" % [source.name, target.name, ship_count])
	else:
		push_error("[InputHandler] Cannot create stream — manager invalid")


func _focus_camera_on_planet(planet: Node3D) -> void:
	if _controller != null:
		_controller.call("focus_on_planet", planet)


func _raycast_planet() -> Node3D:
	if camera == null:
		return null
	var mouse_pos: Vector2 = get_viewport().get_mouse_position()
	var ray_origin: Vector3 = camera.project_ray_origin(mouse_pos)
	var ray_direction: Vector3 = camera.project_ray_normal(mouse_pos)
	var ray_end: Vector3 = ray_origin + ray_direction * 1000.0

	var world3d = get_viewport().get_world_3d()
	if world3d == null:
		return null

	var space_state = world3d.direct_space_state
	var query := PhysicsRayQueryParameters3D.create(ray_origin, ray_end)
	query.collide_with_areas = true
	query.collide_with_bodies = false
	query.collision_mask = 1

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
