class_name AIController
extends Node

## Контроллер ИИ — принимает решения на основе профиля и дерева поведения.
## ВАЖНО (Godot 4.5): все кастомные типы заменены на базовые + preload.

const _AIGameStateScript := preload("res://scripts/ai/ai_game_state.gd")
const _AIProfileScript := preload("res://scripts/ai/ai_profile.gd")
const _BTSelectorScript := preload("res://scripts/ai/behavior_tree/bt_selector.gd")
const _BTSequenceScript := preload("res://scripts/ai/behavior_tree/bt_sequence.gd")
const _CheckThreatScript := preload("res://scripts/ai/behaviors/check_threat.gd")
const _DefendPlanetScript := preload("res://scripts/ai/behaviors/defend_planet.gd")
const _CheckOpportunityScript := preload("res://scripts/ai/behaviors/check_opportunity.gd")
const _AttackPlanetScript := preload("res://scripts/ai/behaviors/attack_planet.gd")
const _ExpandScript := preload("res://scripts/ai/behaviors/expand.gd")
const _ReinforceWeakestScript := preload("res://scripts/ai/behaviors/reinforce_weakest.gd")
const _ConsolidateScript := preload("res://scripts/ai/behaviors/consolidate.gd")

@export var player_id: int = GameConstants.PlayerId.AI_1
@export var profile: Resource  ## AIProfile
@export var decision_interval: float = 1.5

var _owned_planets: Array = []  ## Array[Planet3D]
var _blackboard: Dictionary = {}
var _game_state  ## AIGameState
var _decision_timer: float = 0.0
var _behavior_tree  ## BTSelector


func _ready() -> void:
	_game_state = _AIGameStateScript.new()
	_build_behavior_tree()
	EventBus.planet_captured.connect(_on_planet_captured)
	EventBus.stream_destroyed.connect(_on_stream_destroyed)


func _process(delta: float) -> void:
	_decision_timer += delta
	if _decision_timer >= decision_interval:
		_decision_timer = 0.0
		_evaluate_and_act()


func _evaluate_and_act() -> void:
	_gather_game_state()
	if _behavior_tree and _game_state.own_planets.size() > 0:
		_behavior_tree.tick(self, _blackboard)
		_behavior_tree.reset()


func _gather_game_state() -> void:
	if GameManager and GameManager.game_state:
		_game_state.capture_snapshot(
			player_id, GameManager.game_state.planets, GameManager.game_state.streams
		)
	_owned_planets = _game_state.own_planets


## Private Methods ##


func _build_behavior_tree() -> void:
	# Корневой селектор: приоритет обороны → атака → расширение → укрепление → консолидация
	_behavior_tree = _BTSelectorScript.new()

	# Ветвь защиты: проверка угрозы → действие защиты
	var defense_sequence = _BTSequenceScript.new()
	defense_sequence.children = [
		_CheckThreatScript.new(),
		_DefendPlanetScript.new(),
	]

	# Ветвь атаки: поиск возможности → действие атаки
	var attack_sequence = _BTSequenceScript.new()
	attack_sequence.children = [
		_CheckOpportunityScript.new(),
		_AttackPlanetScript.new(),
	]

	# Листья расширения, укрепления и консолидации
	var expand_leaf = _ExpandScript.new()
	var reinforce_leaf = _ReinforceWeakestScript.new()
	var consolidate_leaf = _ConsolidateScript.new()

	_behavior_tree.children = [
		defense_sequence,
		attack_sequence,
		expand_leaf,
		reinforce_leaf,
		consolidate_leaf,
	]


func _on_planet_captured(planet: Node3D, new_owner_id: int) -> void:
	if new_owner_id == player_id:
		if not _owned_planets.has(planet):
			_owned_planets.append(planet)
	else:
		_owned_planets.erase(planet)


func _on_stream_destroyed(_stream: Node3D) -> void:
	pass
