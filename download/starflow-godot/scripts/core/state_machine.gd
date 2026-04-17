class_name StateMachine
extends Node

## Конечный автомат (Finite State Machine).
## ВАЖНО (Godot 4.5): preload для State, убрана типизация export.

const _StateScript := preload("res://scripts/core/state.gd")

signal state_changed(new_state, old_state)

@export var initial_state: Resource  ## State — RefCounted нельзя экспортировать напрямую в 4.5
var current_state  ## State
var states: Dictionary = {}


func _ready() -> void:
	for child in get_children():
		if child is _StateScript:
			states[child.name] = child
			child.state_machine = self
	if initial_state:
		current_state = initial_state
		current_state.enter()


func _process(delta: float) -> void:
	if current_state:
		current_state.update(delta)


func _physics_process(delta: float) -> void:
	if current_state:
		current_state.physics_update(delta)


func _unhandled_input(event: InputEvent) -> void:
	if current_state:
		current_state.unhandled_input(event)


func transition_to(target_state_name: StringName) -> void:
	if not states.has(target_state_name):
		push_error("StateMachine: состояние '%s' не найдено" % target_state_name)
		return
	if current_state:
		current_state.exit()
	var old_state = current_state
	current_state = states[target_state_name]
	current_state.enter()
	state_changed.emit(current_state, old_state)
