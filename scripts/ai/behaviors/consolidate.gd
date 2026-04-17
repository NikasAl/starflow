class_name Consolidate
extends BTLeaf

## Консолидация: перенаправляет потоки с слабых owned-планет
## на самую сильную owned-планету для ускорения её развития.
## ВАЖНО (Godot 4.5): все кастомные типы заменены на базовые.


func tick(actor: Node, _blackboard: Dictionary) -> Status:
	var controller = actor  ## AIController
	var ai_state = controller._game_state  ## AIGameState

	if ai_state.own_planets.size() < 2:
		return Status.FAILURE

	var strongest = null  ## Planet3D
	var highest_level: int = -1

	for planet in ai_state.own_planets:
		if planet.level > highest_level:
			highest_level = planet.level
			strongest = planet

	if strongest == null:
		return Status.FAILURE

	var weak_planets: Array = []
	for planet in ai_state.own_planets:
		if planet != strongest and planet.level < planet.max_level:
			weak_planets.append(planet)

	if weak_planets.is_empty():
		return Status.FAILURE

	var stream_manager = GameManager.stream_manager  ## StreamManager
	if stream_manager == null:
		push_error("Consolidate: StreamManager не найден")
		return Status.FAILURE

	var redirected_count: int = 0
	for weak_planet in weak_planets:
		var streams = stream_manager.get_streams_from(weak_planet)
		for stream in streams:
			if stream.target != strongest:
				stream_manager.redirect_stream(stream, strongest)
				redirected_count += 1
	if redirected_count > 0:
		return Status.SUCCESS
	return Status.FAILURE
