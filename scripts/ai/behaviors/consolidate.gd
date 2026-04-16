class_name Consolidate
extends BTLeaf

## Консолидация: перенаправляет потоки с слабых owned-планет
## на самую сильную owned-планету для ускорения её развития.

func tick(actor: Node, _blackboard: Dictionary) -> Status:
        var controller: AIController = actor as AIController
        var ai_state: AIGameState = controller._game_state

        if ai_state.own_planets.size() < 2:
                return Status.FAILURE

        # Находим самую сильную owned-планету (цель консолидации)
        var strongest: Planet3D = null
        var highest_level: int = -1

        for planet: Planet3D in ai_state.own_planets:
                if planet.level > highest_level:
                        highest_level = planet.level
                        strongest = planet

        if strongest == null:
                return Status.FAILURE

        # Собираем слабые планеты (уровень ниже максимального)
        var weak_planets: Array[Planet3D] = []
        for planet: Planet3D in ai_state.own_planets:
                if planet != strongest and planet.level < planet.max_level:
                        weak_planets.append(planet)

        if weak_planets.is_empty():
                return Status.FAILURE

        # Перенаправляем потоки со слабых планет на самую сильную
        var stream_manager: StreamManager = GameManager.stream_manager
        if stream_manager == null:
                push_error("Consolidate: StreamManager не найден")
                return Status.FAILURE

        var redirected_count: int = 0
        for weak_planet: Planet3D in weak_planets:
                var streams: Array[ShipStream3D] = stream_manager.get_streams_from(weak_planet)
                for stream: ShipStream3D in streams:
                        # Перенаправляем только потоки, которые уже направлены не на самую сильную
                        if stream.target != strongest:
                                stream_manager.redirect_stream(stream, strongest)
                                redirected_count += 1

        if redirected_count > 0:
                return Status.SUCCESS

        return Status.FAILURE
