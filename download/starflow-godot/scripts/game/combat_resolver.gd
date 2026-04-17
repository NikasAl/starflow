class_name CombatResolver
extends RefCounted

## Разрешитель боев — статическая логика столкновений кораблей у планет.
## ВАЖНО (Godot 4.5): Planet3D заменён на Node3D.


static func resolve_arrival(planet: Node3D, arriving_owner_id: int, ship_count: int) -> void:
	if not is_instance_valid(planet):
		return
	if arriving_owner_id == planet.owner_id:
		planet.receive_ship(arriving_owner_id, ship_count)
	else:
		var defense = planet.level * 3
		var remaining = ship_count - defense
		planet.receive_ship(arriving_owner_id, remaining)
