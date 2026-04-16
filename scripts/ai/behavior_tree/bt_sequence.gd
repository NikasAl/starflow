class_name BTSequence
extends BTNode

## Sequence — выполняет дочерние узлы по порядку, пока все возвращают SUCCESS.

@export var children: Array[BTNode] = []

func tick(actor: Node, blackboard: Dictionary) -> Status:
	for child in children:
		var result := child.tick(actor, blackboard)
		if result == Status.FAILURE:
			status = Status.FAILURE
			return status
		if result == Status.RUNNING:
			status = Status.RUNNING
			return status
	status = Status.SUCCESS
	return status

func reset() -> void:
	super.reset()
	for child in children:
		child.reset()
