class_name CheckThreat
extends BTLeaf

## Проверяет, есть ли угроза для owned планет.
## Если угроза найдена, сохраняет атакуемую планету в чёрном ящике и возвращает SUCCESS.
## ВАЖНО (Godot 4.5): все кастомные типы заменены на базовые.


func tick(actor: Node, blackboard: Dictionary) -> Status:
	var controller = actor  ## AIController
	var ai_state = controller._game_state  ## AIGameState

	# Ищем планету с максимальной угрозой
	var worst_planet = null  ## Planet3D
	var worst_threat: float = 0.0

	for planet in ai_state.own_planets:
		var threat: float = ai_state.threat_assessments.get(planet, 0.0)
		if threat > worst_threat:
			worst_threat = threat
			worst_planet = planet

	if worst_planet != null and worst_threat > 0.0:
		blackboard["threatened_planet"] = worst_planet
		return Status.SUCCESS

	# Угроз не обнаружено
	return Status.FAILURE
