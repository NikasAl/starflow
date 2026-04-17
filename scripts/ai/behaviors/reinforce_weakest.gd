class_name ReinforceWeakest
extends BTLeaf

## Подкрепление слабейшей owned-планеты: находит планету с самым низким уровнем
## и создаёт усиливающий поток с другой owned-планеты, у которой есть запас
## производственных мощностей.


func tick(actor: Node, _blackboard: Dictionary) -> Status:
	var controller: AIController = actor as AIController
	var ai_state: AIGameState = controller._game_state

	if ai_state.own_planets.size() < 2:
		return Status.FAILURE

		# Ищем слабейшую owned-планету

		# Ищем донора — owned-планету с запасом производства (уровень > слабейшей)

		# Донором может быть планета с уровнем строго выше слабейшей

		# Создаём усиливающий поток

		# Отправляем подкрепление — половину от производства донора
	var weakest: Planet3D = null
	var lowest_level: int = INF

	for planet: Planet3D in ai_state.own_planets:
		if planet.level < lowest_level:
			lowest_level = planet.level
			weakest = planet

		# Ищем донора — owned-планету с запасом производства (уровень > слабейшей)

		# Донором может быть планета с уровнем строго выше слабейшей

		# Создаём усиливающий поток

		# Отправляем подкрепление — половину от производства донора
	if weakest == null:
		return Status.FAILURE

		# Ищем донора — owned-планету с запасом производства (уровень > слабейшей)

		# Донором может быть планета с уровнем строго выше слабейшей

		# Создаём усиливающий поток

		# Отправляем подкрепление — половину от производства донора
	var donor: Planet3D = null
	var donor_production: float = 0.0

	for planet: Planet3D in ai_state.own_planets:
		if planet == weakest:
			continue
			# Донором может быть планета с уровнем строго выше слабейшей
		if planet.level > weakest.level:
			var production: float = planet.get_production_rate()
			if production > donor_production:
				donor_production = production
				donor = planet

		# Создаём усиливающий поток

		# Отправляем подкрепление — половину от производства донора
	if donor == null:
		return Status.FAILURE

		# Создаём усиливающий поток

		# Отправляем подкрепление — половину от производства донора
	var stream_manager: StreamManager = GameManager.stream_manager
	if stream_manager == null:
		push_error("ReinforceWeakest: StreamManager не найден")
		return Status.FAILURE

		# Отправляем подкрепление — половину от производства донора
	var ship_count: int = maxi(ceili(donor_production * 0.5), 1)
	var result: ShipStream3D = stream_manager.create_stream(
		donor, weakest, controller.player_id, ship_count
	)

	if result:
		return Status.SUCCESS
	return Status.FAILURE
