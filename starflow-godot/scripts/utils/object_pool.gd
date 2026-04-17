class_name ObjectPool
extends Node

## Пул объектов для переиспользования (Object Pool pattern).

var _pool: Array[Node] = []
var _scene: PackedScene
var _parent: Node
var _max_size: int = 100


func _init(scene: PackedScene, parent: Node, max_size: int = 100) -> void:
	_scene = scene
	_parent = parent
	_max_size = max_size


func acquire() -> Node:
	var obj: Node
	if _pool.size() > 0:
		obj = _pool.pop_back()
		if is_instance_valid(obj):
			obj.set_process(true)
			obj.visible = true
			return obj
	# Создаём новый объект, если пул пуст
	obj = _scene.instantiate()
	_parent.add_child(obj)
	return obj


func release(obj: Node) -> void:
	if not is_instance_valid(obj):
		return
	obj.set_process(false)
	obj.visible = false
	if _pool.size() < _max_size:
		_pool.append(obj)
	else:
		obj.queue_free()


func prewarm(count: int) -> void:
	for _i in count:
		var obj := _scene.instantiate()
		obj.set_process(false)
		obj.visible = false
		_parent.add_child(obj)
		_pool.append(obj)


func clear() -> void:
	for obj in _pool:
		if is_instance_valid(obj):
			obj.queue_free()
	_pool.clear()


func get_active_count() -> int:
	var active := 0
	for child in _parent.get_children():
		if child.get("_pool_source") == self and child.visible:
			active += 1
	return active


func get_pooled_count() -> int:
	return _pool.size()
