class_name CombatResolver
extends RefCounted

## Разрешитель боев — статическая логика столкновений кораблей у планет.


static func resolve_arrival(planet: Planet3D, arriving_owner_id: int, ship_count: int) -> void:
	if not is_instance_valid(planet):
		return
	if arriving_owner_id == planet.owner_id:
		planet.receive_ship(arriving_owner_id, ship_count)
	else:
		var defense := planet.level * 3
		var remaining := ship_count - defense
		if remaining > 0:
			planet.receive_ship(arriving_owner_id, remaining)
		else:
			planet.receive_ship(arriving_owner_id, remaining)
