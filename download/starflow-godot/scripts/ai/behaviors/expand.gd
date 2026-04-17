class_name Expand
extends BTLeaf

## Расширение: захватывает ближайшую нейтральную планету, отправляя поток
## с самой развитой owned-планеты.
## ВАЖНО (Godot 4.5): все кастомные типы заменены на базовые.


func tick(actor: Node, _blackboard: Dictionary) -> Status:
        var controller = actor  ## AIController
        var ai_state = controller._game_state  ## AIGameState

        if ai_state.neutral_planets.is_empty() or ai_state.own_planets.is_empty():
                return Status.FAILURE

        var strongest = null  ## Planet3D
        var highest_level: int = -1

        for planet in ai_state.own_planets:
                if planet.level > highest_level:
                        highest_level = planet.level
                        strongest = planet

        if strongest == null:
                return Status.FAILURE

        var nearest = null  ## Planet3D
        var nearest_dist: float = INF

        for neutral in ai_state.neutral_planets:
                var dist: float = _get_distance(ai_state, strongest, neutral)
                if dist < nearest_dist:
                        nearest_dist = dist
                        nearest = neutral

        if nearest == null:
                return Status.FAILURE

        var stream_manager = GameManager.stream_manager  ## StreamManager
        if stream_manager == null:
                push_error("Expand: StreamManager не найден")
                return Status.FAILURE
        var ship_count: int = ceili(strongest.get_production_rate())
        var result = stream_manager.create_stream(
                strongest, nearest, controller.player_id, ship_count
        )

        if result:
                return Status.SUCCESS
        return Status.FAILURE


## Получает расстояние между двумя планетами из кэша.
func _get_distance(ai_state, p1: Node3D, p2: Node3D) -> float:
        var key_ab: String = "%s_%s" % [p1.name, p2.name]
        var key_ba: String = "%s_%s" % [p2.name, p1.name]
        if ai_state.distances.has(key_ab):
                return ai_state.distances[key_ab]
        if ai_state.distances.has(key_ba):
                return ai_state.distances[key_ba]
        return INF
