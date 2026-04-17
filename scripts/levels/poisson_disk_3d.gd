class_name PoissonDisk3D
extends RefCounted

## Алгоритм выборки Пуассона в 3D (вариант на плоскости XZ).


func generate(
	point_count: int, bounds: float, min_distance: float, rng: RandomNumberGenerator
) -> PackedVector3Array:
	var points: PackedVector3Array = []
	if point_count == 0:
		return points

	var half_bounds := bounds / 2.0
	# Первый point — случайный в центре
	var first := Vector3(
		rng.randf_range(-half_bounds * 0.3, half_bounds * 0.3),
		0.0,
		rng.randf_range(-half_bounds * 0.3, half_bounds * 0.3)
	)
	points.append(first)

	var active: PackedVector3Array = PackedVector3Array([first])
	var cell_size := min_distance / sqrt(2.0)
	var grid: Dictionary = {}
	_grid_insert(grid, first, cell_size)

	var max_attempts := 30
	while active.size() > 0 and points.size() < point_count:
		var rand_idx := rng.randi() % active.size()
		var point := active[rand_idx]
		var found := false
		for _attempt in max_attempts:
			var angle := rng.randf() * TAU
			var dist := rng.randf_range(min_distance, min_distance * 2.0)
			var candidate := Vector3(point.x + cos(angle) * dist, 0.0, point.z + sin(angle) * dist)
			if abs(candidate.x) > half_bounds or abs(candidate.z) > half_bounds:
				continue
			if not _is_too_close(grid, candidate, min_distance, cell_size):
				points.append(candidate)
				active.append(candidate)
				_grid_insert(grid, candidate, cell_size)
				found = true
				break
		if not found:
			active.remove_at(rand_idx)

	return points


func _grid_insert(grid: Dictionary, point: Vector3, cell_size: float) -> void:
	var key := "%d,%d" % [int(floor(point.x / cell_size)), int(floor(point.z / cell_size))]
	if not grid.has(key):
		grid[key] = []
	grid[key].append(point)


func _is_too_close(grid: Dictionary, point: Vector3, min_dist: float, cell_size: float) -> bool:
	var gx := int(floor(point.x / cell_size))
	var gz := int(floor(point.z / cell_size))
	var range_check := int(ceil(min_dist / cell_size)) + 1
	for dx in range(-range_check, range_check + 1):
		for dz in range(-range_check, range_check + 1):
			var key := "%d,%d" % [gx + dx, gz + dz]
			if not grid.has(key):
				continue
			for other in grid[key]:
				if point.distance_to(other) < min_dist:
					return true
	return false
