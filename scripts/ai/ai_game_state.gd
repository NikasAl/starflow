class_name AIGameState
extends RefCounted

## Снимок игрового состояния для ИИ — used for decision making.
## ВАЖНО (Godot 4.5): Planet3D и ShipStream3D заменены на Array (без типизации).

## Все планеты: {planet: Planet3D, owner: int, level: int, production: float}
var all_planets: Array[Dictionary] = []
## Все потоки: {source: Planet3D, target: Planet3D, owner: int, count: int}
var all_streams: Array[Dictionary] = []
## Кэш расстояний: String key -> float
var distances: Dictionary = {}
## Уровень угрозы для каждой owned-планеты: Planet3D -> float
var threat_assessments: Dictionary = {}
var own_planets: Array = []  ## Array[Planet3D]
var enemy_planets: Array = []  ## Array[Planet3D]
var neutral_planets: Array = []  ## Array[Planet3D]


func capture_snapshot(ai_player_id: int, planets: Array, streams: Array) -> void:
	all_planets.clear()
	own_planets.clear()
	enemy_planets.clear()
	neutral_planets.clear()
	distances.clear()

	for planet in planets:
		var info := {
			"planet": planet,
			"owner": planet.owner_id,
			"level": planet.level,
			"production": planet.get_production_rate(),
		}
		all_planets.append(info)

		match planet.owner_id:
			ai_player_id:
				own_planets.append(planet)
			GameConstants.PlayerId.NONE:
				neutral_planets.append(planet)
			_:
				enemy_planets.append(planet)
	for i in range(all_planets.size()):
		for j in range(i + 1, all_planets.size()):
			var p1 = all_planets[i]["planet"]
			var p2 = all_planets[j]["planet"]
			var key = "%s_%s" % [p1.name, p2.name]
			distances[key] = p1.global_position.distance_to(p2.global_position)
	all_streams.clear()
	for stream in streams:
		(
			all_streams
			. append(
				{
					"source": stream.source,
					"target": stream.target,
					"owner": stream.owner_id,
					"count": stream.ship_count,
				}
			)
		)
	_calculate_threats(ai_player_id)


func _calculate_threats(ai_player_id: int) -> void:
	threat_assessments.clear()
	for planet in own_planets:
		var threat := 0.0
		for stream_info in all_streams:
			if stream_info["target"] == planet and stream_info["owner"] != ai_player_id:
				threat += float(stream_info["count"])
		threat_assessments[planet] = threat
