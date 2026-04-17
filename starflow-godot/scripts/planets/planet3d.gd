class_name Planet3D
extends Node3D

## Планета — ключевой объект игрового мира.

signal level_changed(new_level: int)
signal owner_changed(new_owner_id: int)
signal ship_arrived(ship_owner_id: int, ship_count: int)

@export var owner_id: int = GameConstants.PlayerId.NONE:
	set = set_owner_id
@export var level: int = 1:
	set = set_level
@export var max_level: int = 5
@export var production_rate: float = GameConstants.BASE_PRODUCTION_RATE
@export var planet_type: int = GameConstants.PlanetType.NORMAL
@export var radius: float = 1.0

var pending_ships: int = 0
var mesh_instance: MeshInstance3D
var highlight_mesh: MeshInstance3D
var _material: StandardMaterial3D  ## Кэшируем материал для обновления цвета


func _ready() -> void:
	mesh_instance = $MeshInstance3D
	highlight_mesh = $HighlightMesh
	## Создаём StandardMaterial3D если override material не задан
	if mesh_instance and mesh_instance.get_surface_override_material_count() == 0:
		_material = StandardMaterial3D.new()
		_material.albedo_color = Color.WHITE
		_material.roughness = 0.7
		_material.metallic = 0.1
		mesh_instance.set_surface_override_material(0, _material)
	else:
		_material = mesh_instance.get_surface_override_material(0)
	## Материал для highlight-меша (полупрозрачный)
	if highlight_mesh and highlight_mesh.get_surface_override_material_count() == 0:
		var hl_mat = StandardMaterial3D.new()
		hl_mat.albedo_color = Color(1.0, 1.0, 1.0, 0.3)
		hl_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		hl_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		hl_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		highlight_mesh.set_surface_override_material(0, hl_mat)
	_update_visuals()


func get_production_rate() -> float:
	return production_rate * level


func receive_ship(ship_owner_id: int, ship_count: int) -> void:
	if ship_owner_id == owner_id:
		pending_ships += ship_count
	else:
		pending_ships -= ship_count
		ship_arrived.emit(ship_owner_id, ship_count)
	_check_upgrade_or_capture(ship_owner_id)


func set_owner_id(new_id: int) -> void:
	var old_id := owner_id
	owner_id = new_id
	if old_id != new_id:
		_update_visuals()
		owner_changed.emit(new_id)
		EventBus.planet_captured.emit(self, new_id)


func set_level(new_level: int) -> void:
	new_level = clampi(new_level, 1, max_level)
	if level != new_level:
		level = new_level
		level_changed.emit(level)
		EventBus.planet_level_changed.emit(self, level)
		_update_visuals()


func highlight() -> void:
	if highlight_mesh:
		highlight_mesh.visible = true


func unhighlight() -> void:
	if highlight_mesh:
		highlight_mesh.visible = false


## Private Methods ##


func _check_upgrade_or_capture(attacker_id: int) -> void:
	if pending_ships >= GameConstants.PLANET_CAPTURE_THRESHOLD:
		if attacker_id != owner_id:
			set_owner_id(attacker_id)
			pending_ships = 0
		else:
			set_level(level + 1)
			pending_ships = 0


func _update_visuals() -> void:
	if not mesh_instance:
		return
	if _material:
		_material.albedo_color = GameConstants.PLAYER_COLORS.get(owner_id, Color.WHITE)
	var scale_factor := 0.8 + 0.2 * float(level) / float(max_level)
	mesh_instance.scale = Vector3.ONE * scale_factor
