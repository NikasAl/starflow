class_name ShipStream3D
extends Node3D

## Поток кораблей — визуальное и логическое представление перемещения флота.
## ВАЖНО: Planet3D заменён на Node3D для совместимости с Godot 4.5.

signal stream_redirected(new_target: Node3D)
signal ship_reached_target(target: Node3D)
signal stream_destroyed

@export var source: Node3D  ## Planet3D
@export var target: Node3D  ## Planet3D
@export var owner_id: int = GameConstants.PlayerId.NONE
@export var ship_count: int = 10
@export var base_speed: float = GameConstants.BASE_SHIP_SPEED

var _progress: float = 0.0
var _path_points: PackedVector3Array = []
var _active: bool = true


func _ready() -> void:
	_calculate_bezier()
	EventBus.stream_created.emit(self)


func _process(delta: float) -> void:
	if not _active or not is_instance_valid(source) or not is_instance_valid(target):
		return
	var distance = source.global_position.distance_to(target.global_position)
	_progress += delta * base_speed / maxf(distance, 0.1)
	global_position = _evaluate_bezier(clampf(_progress, 0.0, 1.0))
	if _progress >= 1.0:
		_arrive()


func get_speed() -> float:
	return base_speed


func redirect(new_target: Node3D) -> void:
	target = new_target
	_progress = 0.0
	_calculate_bezier()
	stream_redirected.emit(new_target)
	EventBus.stream_redirected.emit(self, new_target)


func destroy() -> void:
	_active = false
	stream_destroyed.emit()
	EventBus.stream_destroyed.emit(self)
	queue_free()


## Private Methods ##


func _calculate_bezier() -> void:
	if not is_instance_valid(source) or not is_instance_valid(target):
		return
	var start = source.global_position
	var end = target.global_position
	var mid = (start + end) / 2.0
	var perpendicular = (end - start).cross(Vector3.UP).normalized()
	mid += perpendicular * start.distance_to(end) * 0.2
	mid.y += start.distance_to(end) * 0.15
	_path_points = PackedVector3Array([start, mid, end])


func _evaluate_bezier(t: float) -> Vector3:
	if _path_points.size() < 3:
		return Vector3.ZERO
	var p0 = _path_points[0]
	var p1 = _path_points[1]
	var p2 = _path_points[2]
	var u = 1.0 - t
	return u * u * p0 + 2.0 * u * t * p1 + t * t * p2


func _arrive() -> void:
	if is_instance_valid(target):
		target.receive_ship(owner_id, ship_count)
		ship_reached_target.emit(target)
	destroy()
