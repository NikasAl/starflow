class_name StreamManager
extends Node

## Менеджер потоков кораблей.
## ВАЖНО (Godot 4.5): ShipStream3D и Planet3D заменены на Node3D
## для совместимости. ShipStream3D.new() через preload.

const _ShipStream3DScript := preload("res://scripts/streams/ship_stream3d.gd")

var _active_streams: Array = []  ## Array[ShipStream3D]


func _ready() -> void:
	EventBus.stream_destroyed.connect(_on_stream_destroyed)


func create_stream(
	source: Node3D, target: Node3D, owner_id: int, ship_count: int
) -> Node3D:
	var stream = _ShipStream3DScript.new()
	stream.source = source
	stream.target = target
	stream.owner_id = owner_id
	stream.ship_count = ship_count
	add_child(stream)
	_active_streams.append(stream)
	return stream


func redirect_stream(stream: Node3D, new_target: Node3D) -> void:
	if stream and is_instance_valid(stream):
		stream.redirect(new_target)


func cancel_streams_for_planet(planet: Node3D) -> void:
	var to_remove: Array = []
	for stream in _active_streams:
		if stream.source == planet or stream.target == planet:
			stream.destroy()
			to_remove.append(stream)
	for stream in to_remove:
		_active_streams.erase(stream)


func get_streams_from(planet: Node3D) -> Array:
	var result: Array = []
	for stream in _active_streams:
		if stream.source == planet:
			result.append(stream)
	return result


func get_streams_to(planet: Node3D) -> Array:
	var result: Array = []
	for stream in _active_streams:
		if stream.target == planet:
			result.append(stream)
	return result


func get_all_streams() -> Array:
	return _active_streams.duplicate()


func _on_stream_destroyed(stream: Node3D) -> void:
	_active_streams.erase(stream)
