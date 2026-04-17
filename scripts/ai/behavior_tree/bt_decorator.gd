class_name BTDecorator
extends BTNode

## Базовый декоратор — оборачивает один дочерний узел.

@export var child: BTNode


func tick(actor: Node, blackboard: Dictionary) -> Status:
	if child:
		return child.tick(actor, blackboard)
	return Status.FAILURE


func reset() -> void:
	super.reset()
	if child:
		child.reset()
