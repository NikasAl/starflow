class_name CheckThreat
extends BTLeaf

## Проверяет, есть ли угроза для_owned планет.
## Если угроза найдена, сохраняет атакуемую планету в чёрном ящике и возвращает SUCCESS.


func tick(actor: Node, blackboard: Dictionary) -> Status:
	var controller: AIController = actor as AIController
	var ai_state: AIGameState = controller._game_state

	# Ищем планету с максимальной угрозой
	var worst_planet: Planet3D = null
	var worst_threat: float = 0.0

	for planet: Planet3D in ai_state.own_planets:
		var threat: float = ai_state.threat_assessments.get(planet, 0.0)
		if threat > worst_threat:
			worst_threat = threat
			worst_planet = planet

	if worst_planet != null and worst_threat > 0.0:
		blackboard["threatened_planet"] = worst_planet
		return Status.SUCCESS

	# Угроз не обнаружено
	return Status.FAILURE
