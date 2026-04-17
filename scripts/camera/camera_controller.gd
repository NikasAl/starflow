class_name CameraController
extends Camera3D

## Контроллер орбитальной камеры.

@export var orbit_speed: float = 0.005
@export var pan_speed: float = 10.0
@export var zoom_speed: float = 2.0
@export var min_distance: float = 5.0
@export var max_distance: float = 60.0
@export var smooth_speed: float = 5.0

var _target_position: Vector3 = Vector3(0, 15, 20)
var _is_orbiting: bool = false
var _is_panning: bool = false
var _last_mouse_pos: Vector2
var _current_distance: float = 25.0


func _ready() -> void:
	position = _target_position
	look_at(Vector3.ZERO, Vector3.UP)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.pressed:
			match mb.button_index:
				MOUSE_BUTTON_RIGHT:
					_is_orbiting = true
					_last_mouse_pos = mb.position
				MOUSE_BUTTON_MIDDLE:
					_is_panning = true
					_last_mouse_pos = mb.position
				MOUSE_BUTTON_WHEEL_UP:
					_current_distance = maxf(_current_distance - zoom_speed, min_distance)
				MOUSE_BUTTON_WHEEL_DOWN:
					_current_distance = minf(_current_distance + zoom_speed, max_distance)
		else:
			match mb.button_index:
				MOUSE_BUTTON_RIGHT:
					_is_orbiting = false
				MOUSE_BUTTON_MIDDLE:
					_is_panning = false

	if event is InputEventMouseMotion:
		var mm := event as InputEventMouseMotion
		if _is_orbiting:
			_orbit_camera(mm.relative)
		if _is_panning:
			_pan_camera(mm.relative)

	if event is InputEventKey and event.pressed:
		if event.keycode == KEY_SPACE:
			reset_to_overview()


func _process(delta: float) -> void:
	position = position.lerp(_target_position, smooth_speed * delta)


func focus_on_planet(planet: Planet3D) -> void:
	var planet_pos := planet.global_position
	_target_position = planet_pos + Vector3(0, _current_distance * 0.6, _current_distance * 0.8)
	look_at(planet_pos, Vector3.UP)


func reset_to_overview() -> void:
	_target_position = Vector3(0, 15, 20)
	_current_distance = 25.0
	look_at(Vector3.ZERO, Vector3.UP)


## Private Methods ##


func _orbit_camera(relative: Vector2) -> void:
	var offset := _target_position
	var spherical := _cartesian_to_spherical(offset)
	spherical.y -= relative.x * orbit_speed
	spherical.z -= relative.y * orbit_speed
	spherical.z = clampf(spherical.z, 0.1, PI - 0.1)
	_target_position = _spherical_to_cartesian(spherical)


func _pan_camera(relative: Vector2) -> void:
	var right := global_basis.x
	var up := Vector3.UP
	_target_position -= right * relative.x * pan_speed * 0.01
	_target_position -= up * relative.y * pan_speed * 0.01


func _cartesian_to_spherical(pos: Vector3) -> Vector3:
	var r := pos.length()
	var theta := atan2(pos.x, pos.z)
	var phi := acos(clampf(pos.y / r, -1.0, 1.0))
	return Vector3(r, theta, phi)


func _spherical_to_cartesian(spherical: Vector3) -> Vector3:
	var r := spherical.x
	var theta := spherical.y
	var phi := spherical.z
	return Vector3(r * sin(phi) * sin(theta), r * cos(phi), r * sin(phi) * cos(theta))
