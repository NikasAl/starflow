class_name AIController
extends Node

## Контроллер ИИ — принимает решения на основе профиля и дерева поведения.

@export var player_id: int = Constants.PlayerId.AI_1
@export var profile: AIProfile
@export var decision_interval: float = 1.5

var _owned_planets: Array[Planet3D] = []
var _blackboard: Dictionary = {}
var _game_state: AIGameState
var _decision_timer: float = 0.0
var _behavior_tree: BTSelector

func _ready() -> void:
        _game_state = AIGameState.new()
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
                        player_id,
                        GameManager.game_state.planets,
                        GameManager.game_state.streams
                )
        _owned_planets = _game_state.own_planets

## Private Methods ##

func _build_behavior_tree() -> void:
        # Корневой селектор: приоритет обороны, затем расширение, затем атака
        _behavior_tree = BTSelector.new()
        # TODO: собрать дерево из подузлов при реализации конкретных стратегий

func _on_planet_captured(planet: Planet3D, new_owner_id: int) -> void:
        if new_owner_id == player_id:
                if not _owned_planets.has(planet):
                        _owned_planets.append(planet)
        else:
                _owned_planets.erase(planet)

func _on_stream_destroyed(_stream: ShipStream3D) -> void:
        pass
