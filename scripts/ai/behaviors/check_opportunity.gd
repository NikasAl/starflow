class_name CheckOpportunity
extends BTLeaf

## Ищет благоприятную возможность для атаки — самую слабую вражескую или
## нейтральную планету в пределах разумной дистанции.
## Порог определяется через profile.aggression_factor.


func tick(actor: Node, blackboard: Dictionary) -> Status:
	var controller: AIController = actor as AIController
	var ai_state: AIGameState = controller._game_state
	var profile: AIProfile = controller.profile

	if ai_state.own_planets.is_empty():
		return Status.FAILURE

	# Собираем кандидатов: вражеские и нейтральные планеты
	var candidates: Array[Planet3D] = []
	candidates.append_array(ai_state.enemy_planets)
	candidates.append_array(ai_state.neutral_planets)

	if candidates.is_empty():
		return Status.FAILURE

	# Вычисляем максимальную дистанцию от наших планет, чтобы определить «разумную»
	var max_reachable_distance: float = 0.0
	for owned: Planet3D in ai_state.own_planets:
		for candidate: Planet3D in candidates:
			var dist: float = _get_distance(ai_state, owned, candidate)
			if dist > max_reachable_distance:
				max_reachable_distance = dist

	# Порог дистанции: чем агрессивнее ИИ, тем дальше готов атаковать
	var distance_threshold: float = max_reachable_distance * (0.3 + 0.7 * profile.aggression_factor)

	# Ищем самую слабую цель в пределах порога
	var best_target: Planet3D = null
	var best_score: float = INF

	for candidate: Planet3D in candidates:
		# Минимальная дистанция от любой owned-планеты до кандидата
		var min_dist: float = INF
		for owned: Planet3D in ai_state.own_planets:
			var dist: float = _get_distance(ai_state, owned, candidate)
			if dist < min_dist:
				min_dist = dist

		if min_dist > distance_threshold:
			continue

		# Оценка: ниже уровень = лучше цель, ближе дистанция = лучше цель
		var score: float = float(candidate.level) + min_dist * 0.01
		if score < best_score:
			best_score = score
			best_target = candidate

	if best_target != null:
		blackboard["attack_target"] = best_target
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
