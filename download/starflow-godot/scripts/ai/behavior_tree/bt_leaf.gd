class_name BTLeaf
extends BTNode

## Лист дерева поведения — содержит пользовательскую логику.
## Для использования: создаёте подкласс и переопределяете tick().


func tick(_actor: Node, _blackboard: Dictionary) -> Status:
	return Status.FAILURE
