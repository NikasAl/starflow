class_name Expand
extends BTLeaf

## Расширение: захватывает ближайшую нейтральную планету, отправляя поток
## с самой развитой owned-планеты.

func tick(actor: Node, blackboard: Dictionary) -> Status:
	var controller: AIController = actor as AIController
	var ai_state: AIGameState = controller._game_state

	if ai_state.neutral_planets.is_empty() or ai_state.own_planets.is_empty():
		return Status.FAILURE

	# Ищем owned-планету с максимальным уровнем (самую развитую для отправки)
	var strongest: Planet3D = null
	var highest_level: int = -1

	for planet: Planet3D in ai_state.own_planets:
		if planet.level > highest_level:
			highest_level = planet.level
			strongest = planet

	if strongest == null:
		return Status.FAILURE

	# Ищем ближайшую нейтральную планету
	var nearest: Planet3D = null
	var nearest_dist: float = INF

	for neutral: Planet3D in ai_state.neutral_planets:
		var dist: float = _get_distance(ai_state, strongest, neutral)
		if dist < nearest_dist:
			nearest_dist = dist
			nearest = neutral

	if nearest == null:
		return Status.FAILURE

	# Создаём поток расширения
	var stream_manager: StreamManager = GameManager.stream_manager
	if stream_manager == null:
		push_error("Expand: StreamManager не найден")
		return Status.FAILURE

	var ship_count: int = ceili(strongest.get_production_rate())
	var result: ShipStream3D = stream_manager.create_stream(
		strongest, nearest, controller.player_id, ship_count
	)

	if result:
		return Status.SUCCESS

	return Status.FAILURE


## Получает расстояние между двумя планетами из кэша.
func _get_distance(ai_state: AIGameState, p1: Planet3D, p2: Planet3D) -> float:
	var key_ab: String = "%s_%s" % [p1.name, p2.name]
	var key_ba: String = "%s_%s" % [p2.name, p1.name]
	if ai_state.distances.has(key_ab):
		return ai_state.distances[key_ab]
	if ai_state.distances.has(key_ba):
		return ai_state.distances[key_ba]
	return INF
