class_name AttackPlanet
extends BTLeaf

## Атакует целевую планету: создаёт поток с самой сильной owned-планеты
## на цель из чёрного ящика.

func tick(actor: Node, blackboard: Dictionary) -> Status:
	var controller: AIController = actor as AIController
	var ai_state: AIGameState = controller._game_state

	# Получаем цель атаки из чёрного ящика
	var attack_target: Planet3D = blackboard.get("attack_target")
	if not attack_target or not is_instance_valid(attack_target):
		return Status.FAILURE

	# Ищем owned-планету с максимальным уровнем (самую сильную)
	var strongest: Planet3D = null
	var highest_level: int = -1

	for planet: Planet3D in ai_state.own_planets:
		if planet.level > highest_level:
			highest_level = planet.level
			strongest = planet

	if strongest == null:
		return Status.FAILURE

	# Создаём атакующий поток
	var stream_manager: StreamManager = GameManager.stream_manager
	if stream_manager == null:
		push_error("AttackPlanet: StreamManager не найден")
		return Status.FAILURE

	var ship_count: int = ceili(strongest.get_production_rate())
	var result: ShipStream3D = stream_manager.create_stream(
		strongest, attack_target, controller.player_id, ship_count
	)

	if result:
		return Status.SUCCESS

	return Status.FAILURE
