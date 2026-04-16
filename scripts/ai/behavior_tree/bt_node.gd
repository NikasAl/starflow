class_name BTNode
extends Resource

## Базовый узел дерева поведения (Behavior Tree).

enum Status { SUCCESS, FAILURE, RUNNING }

var status: Status = Status.FAILURE
var _actor: Node

func tick(actor: Node, _blackboard: Dictionary) -> Status:
	_actor = actor
	return Status.FAILURE

func reset() -> void:
	status = Status.FAILURE
