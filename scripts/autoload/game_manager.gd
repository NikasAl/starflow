extends Node

## Game Manager — главный контроллер игры (Autoload).
## Управляет состоянием игры, уровнем, проверкой победы/поражения.
##
## ВАЖНО (Godot 4.5): в autoload-скриптах class_name типов
## может не быть в scope на момент парсинга. Используем preload()
## для форсирования загрузки зависимых скриптов.
## Порядок preload важен — зависимости должны идти первыми!

signal state_changed(new_state: int, old_state: int)
signal victory(player_id: int)
signal defeat(player_id: int)
signal level_started(level_config)

## Предзагрузка зависимостей для гарантии регистрации class_name.
## Порядок важен: Planet3D и ShipStream3D — базовые, остальные зависят от них.
const Planet3DScript := preload("res://scripts/planets/planet3d.gd")
const ShipStream3DScript := preload("res://scripts/streams/ship_stream3d.gd")
const LevelConfigScript := preload("res://scripts/levels/level_config.gd")
const GameStateScript := preload("res://scripts/game/game_state.gd")
const StreamManagerScript := preload("res://scripts/streams/stream_manager.gd")
const ScoreTrackerScript := preload("res://scripts/game/score_tracker.gd")
const LevelGeneratorScript := preload("res://scripts/levels/level_generator.gd")

@export var initial_level_config: Resource

var game_state  ## GameState — без типизации, чтобы Godot 4.5 не проверял члены внешнего класса
var stream_manager  ## StreamManager
var score_tracker  ## ScoreTracker
var current_level_config: Resource
var all_planets: Array = []


func _ready() -> void:
        game_state = GameStateScript.new()
        stream_manager = StreamManagerScript.new()
        stream_manager.name = "StreamManager"
        add_child(stream_manager)
        score_tracker = ScoreTrackerScript.new()
        score_tracker.name = "ScoreTracker"
        add_child(score_tracker)
        ## Автозапуск первого уровня с дефолтной конфигурацией
        ## (временно, пока нет главного меню)
        ## Используем call_deferred чтобы сцена успела загрузиться
        call_deferred("_auto_start")


func _auto_start() -> void:
        if not initial_level_config:
                initial_level_config = LevelConfigScript.new()
        start_level(initial_level_config)


func start_level(config: Resource = null) -> void:
        current_level_config = config if config else initial_level_config
        if not current_level_config:
                push_error("GameManager: нет конфигурации уровня")
                return
        _clear_level()
        _generate_level()
        change_state(GameStateScript.EState.PLAYING)
        score_tracker.reset_scores()
        EventBus.level_started.emit(current_level_config)


func pause_game() -> void:
        change_state(GameStateScript.EState.PAUSED)
        get_tree().paused = true


func resume_game() -> void:
        change_state(GameStateScript.EState.PLAYING)
        get_tree().paused = false


func check_victory_condition() -> void:
        if game_state.current_state != GameStateScript.EState.PLAYING:
                return
        var alive_players: Array[int] = []
        for planet in all_planets:
                if planet.owner_id != GameConstants.PlayerId.NONE:
                        if not alive_players.has(planet.owner_id):
                                alive_players.append(planet.owner_id)
        if alive_players.size() == 1:
                var winner: int = alive_players[0]
                change_state(GameStateScript.EState.VICTORY)
                victory.emit(winner)
                EventBus.victory.emit(winner)


func change_state(new_state: int) -> void:
        var old_state: int = game_state.current_state
        if old_state == new_state:
                return
        game_state.current_state = new_state
        state_changed.emit(new_state, old_state)
        EventBus.game_state_changed.emit(old_state, new_state)


func _generate_level() -> void:
        var generator = LevelGeneratorScript.new()
        ## Ищем контейнер планет в сцене (World/Planets из main.tscn)
        var planets_container = get_tree().current_scene.find_child("Planets", true, false)
        if not planets_container:
                planets_container = self  ## fallback — добавим к GameManager

        generator.call("generate", current_level_config, planets_container)
        all_planets = game_state.planets


func _clear_level() -> void:
        for planet in all_planets:
                if is_instance_valid(planet):
                        planet.queue_free()
        all_planets.clear()
        game_state.planets.clear()
        game_state.streams.clear()
