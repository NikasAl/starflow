class_name State
extends RefCounted

## Базовый класс состояния для конечного автомата.

var name: StringName = &""
var state_machine: StateMachine

func enter() -> void:
	pass

func exit() -> void:
	pass

func update(_delta: float) -> void:
	pass

func physics_update(_delta: float) -> void:
	pass

func handle_input(_event: InputEvent) -> void:
	pass

func unhandled_input(_event: InputEvent) -> void:
	pass
