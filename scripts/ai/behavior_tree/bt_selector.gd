class_name BTSelector
extends BTNode

## Selector — выполняет дочерние узлы по порядку, пока один не вернёт SUCCESS.

@export var children: Array[BTNode] = []

func tick(actor: Node, blackboard: Dictionary) -> Status:
	for child in children:
		var result := child.tick(actor, blackboard)
		if result == Status.SUCCESS:
			status = Status.SUCCESS
			return status
		if result == Status.RUNNING:
			status = Status.RUNNING
			return status
	status = Status.FAILURE
	return status

func reset() -> void:
	super.reset()
	for child in children:
		child.reset()
