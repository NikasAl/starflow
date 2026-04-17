class_name DefendPlanet
extends BTLeaf

## Оборона атакуемой планеты: создаёт поток с самой сильной owned-планеты
## на угрожаемую планету.


func tick(actor: Node, blackboard: Dictionary) -> Status:
	var controller: AIController = actor as AIController
	var ai_state: AIGameState = controller._game_state

	# Получаем атакуемую планету из чёрного ящика
	var threatened_planet: Planet3D = blackboard.get("threatened_planet")
	if not threatened_planet or not is_instance_valid(threatened_planet):
		return Status.FAILURE

	# Ищем owned-планету с максимальной производительностью (для отправки подкреплений)
	var best_source: Planet3D = null
	var best_production: float = -1.0

	for planet: Planet3D in ai_state.own_planets:
		if planet == threatened_planet:
			continue
		var production: float = planet.get_production_rate()
		if production > best_production:
			best_production = production
			best_source = planet

	if best_source == null:
		return Status.FAILURE

	# Создаём оборонительный поток
	var stream_manager: StreamManager = GameManager.stream_manager
	if stream_manager == null:
		push_error("DefendPlanet: StreamManager не найден")
		return Status.FAILURE

	var ship_count: int = ceili(best_production)
	var result: ShipStream3D = stream_manager.create_stream(
		best_source, threatened_planet, controller.player_id, ship_count
	)

	if result:
		blackboard["last_defense_action"] = true
		return Status.SUCCESS

	return Status.FAILURE
