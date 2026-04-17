class_name LevelGenerator
extends RefCounted

## Генератор уровней — создаёт карту планет.
## ВАЖНО (Godot 4.5): LevelConfig, PoissonDisk3D, Planet3D заменены на базовые типы.

const _PoissonDisk3DScript := preload("res://scripts/levels/poisson_disk_3d.gd")

var _rng: RandomNumberGenerator = RandomNumberGenerator.new()


func generate(config: Resource, parent_node: Node) -> void:
        _rng.seed = config.seed if config.seed != 0 else _rng.randi()
        var planet_positions: PackedVector3Array = _place_planets_poisson(
                config.planet_count, config.map_size
        )
        var PlanetScene := preload("res://scenes/planets/planet_template.tscn")
        _assign_initial_owners(planet_positions, config, parent_node, PlanetScene)


func _place_planets_poisson(count: int, map_size: float) -> PackedVector3Array:
        var positions: PackedVector3Array = []
        var min_distance = map_size / sqrt(count) * 0.8
        var max_attempts: int = 30
        var candidate_count = count * 5
        var cell_size = min_distance / sqrt(2.0)
        var grid_size = int(ceil(map_size * 2.0 / cell_size))
        var grid: Array = []
        grid.resize(grid_size * grid_size)
        for i in grid_size * grid_size:
                grid[i] = -1

        var poisson_generator = _PoissonDisk3DScript.new()
        positions = poisson_generator.generate(count, map_size, min_distance, _rng)
        return positions


func _assign_initial_owners(
        positions: PackedVector3Array, config: Resource, parent_node: Node, planet_scene: PackedScene
) -> void:
        var player_start_indices: Array[int] = _get_start_positions(
                positions.size(), config.ai_count + 1
        )

        for i in positions.size():
                var planet = planet_scene.instantiate()
                planet.position = positions[i]  ## position вместо global_position — нода ещё не в дереве
                planet.name = "Planet_%d" % i
                # Назначаем владельцев стартовых планет
                if i in player_start_indices:
                        var idx = player_start_indices.find(i)
                        planet.owner_id = idx + 1  # 1=PLAYER, 2=AI_1, ...
                        planet.level = 3
                parent_node.add_child(planet)
                if GameManager:
                        GameManager.game_state.planets.append(planet)


func _get_start_positions(total: int, player_count: int) -> Array[int]:
        var indices: Array[int] = []
        var step = total / player_count
        for i in player_count:
                indices.append(i * step + step / 2)
        return indices
