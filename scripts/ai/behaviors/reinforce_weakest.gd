class_name ReinforceWeakest
extends BTLeaf

## Подкрепление слабейшей owned-планеты: находит планету с самым низким уровнем
## и создаёт усиливающий поток с другой owned-планеты, у которой есть запас
## производственных мощностей.
## ВАЖНО (Godot 4.5): все кастомные типы заменены на базовые.


func tick(actor: Node, _blackboard: Dictionary) -> Status:
	var controller = actor  ## AIController
	var ai_state = controller._game_state  ## AIGameState

	if ai_state.own_planets.size() < 2:
		return Status.FAILURE

	var weakest = null  ## Planet3D
	var lowest_level: int = INF

	for planet in ai_state.own_planets:
		if planet.level < lowest_level:
			lowest_level = planet.level
			weakest = planet

	if weakest == null:
		return Status.FAILURE

	var donor = null  ## Planet3D
	var donor_production: float = 0.0

	for planet in ai_state.own_planets:
		if planet == weakest:
			continue
		if planet.level > weakest.level:
			var production: float = planet.get_production_rate()
			if production > donor_production:
				donor_production = production
				donor = planet

	if donor == null:
		return Status.FAILURE

	var stream_manager = GameManager.stream_manager  ## StreamManager
	if stream_manager == null:
		push_error("ReinforceWeakest: StreamManager не найден")
		return Status.FAILURE

	var ship_count: int = maxi(ceili(donor_production * 0.5), 1)
	var result = stream_manager.create_stream(
		donor, weakest, controller.player_id, ship_count
	)

	if result:
		return Status.SUCCESS
	return Status.FAILURE
