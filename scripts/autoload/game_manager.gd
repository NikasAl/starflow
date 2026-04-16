extends Node

## Game Manager — главный контроллер игры (Autoload).
## Управляет состоянием игры, уровнем, проверкой победы/поражения.

signal state_changed(new_state: int, old_state: int)
signal victory(player_id: int)
signal defeat(player_id: int)
signal level_started(level_config: LevelConfig)

@export var initial_level_config: LevelConfig

var game_state: GameState
var stream_manager: StreamManager
var score_tracker: ScoreTracker
var current_level_config: LevelConfig
var all_planets: Array[Planet3D] = []

func _ready() -> void:
        game_state = GameState.new()
        stream_manager = StreamManager.new()
        stream_manager.name = "StreamManager"
        add_child(stream_manager)
        score_tracker = ScoreTracker.new()
        score_tracker.name = "ScoreTracker"
        add_child(score_tracker)

func start_level(config: LevelConfig = null) -> void:
        current_level_config = config if config else initial_level_config
        if not current_level_config:
                push_error("GameManager: нет конфигурации уровня")
                return
        _clear_level()
        _generate_level()
        change_state(GameState.State.PLAYING)
        score_tracker.reset_scores()
        EventBus.level_started.emit(current_level_config)

func pause_game() -> void:
        change_state(GameState.State.PAUSED)
        get_tree().paused = true

func resume_game() -> void:
        change_state(GameState.State.PLAYING)
        get_tree().paused = false

func check_victory_condition() -> void:
        if game_state.current_state != GameState.State.PLAYING:
                return
        var alive_players: Array[int] = []
        for planet in all_planets:
                if planet.owner_id != Constants.PlayerId.NONE:
                        if not alive_players.has(planet.owner_id):
                                alive_players.append(planet.owner_id)
        if alive_players.size() == 1:
                var winner: int = alive_players[0]
                change_state(GameState.State.VICTORY)
                victory.emit(winner)
                EventBus.victory.emit(winner)

func change_state(new_state: int) -> void:
        var old_state := game_state.current_state
        if old_state == new_state:
                return
        game_state.current_state = new_state
        state_changed.emit(new_state, old_state)
        EventBus.game_state_changed.emit(old_state, new_state)

func _generate_level() -> void:
        var generator := LevelGenerator.new()
        generator.generate(current_level_config, self)
        all_planets = game_state.planets

func _clear_level() -> void:
        for planet in all_planets:
                if is_instance_valid(planet):
                        planet.queue_free()
        all_planets.clear()
        game_state.planets.clear()
        game_state.streams.clear()
