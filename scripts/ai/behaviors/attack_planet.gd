class_name AttackPlanet
extends BTLeaf

## Атакует целевую планету: создаёт поток с самой сильной owned-планеты
## на цель из чёрного ящика.
## ВАЖНО (Godot 4.5): все кастомные типы заменены на базовые.


func tick(actor: Node, blackboard: Dictionary) -> Status:
	var controller = actor  ## AIController
	var ai_state = controller._game_state  ## AIGameState

	# Получаем цель атаки из чёрного ящика
	var attack_target = blackboard.get("attack_target")  ## Planet3D
	if not attack_target or not is_instance_valid(attack_target):
		return Status.FAILURE

	# Ищем owned-планету с максимальным уровнем (самую сильную)
	var strongest = null  ## Planet3D
	var highest_level: int = -1

	for planet in ai_state.own_planets:
		if planet.level > highest_level:
			highest_level = planet.level
			strongest = planet

	if strongest == null:
		return Status.FAILURE

	# Создаём атакующий поток
	var stream_manager = GameManager.stream_manager  ## StreamManager
	if stream_manager == null:
		push_error("AttackPlanet: StreamManager не найден")
		return Status.FAILURE

	var ship_count: int = ceili(strongest.get_production_rate())
	var result = stream_manager.create_stream(
		strongest, attack_target, controller.player_id, ship_count
	)

	if result:
		return Status.SUCCESS

	return Status.FAILURE
