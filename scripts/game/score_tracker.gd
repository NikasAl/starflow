class_name ScoreTracker
extends Node

## Отслеживание очков игрока.

var _scores: Dictionary = {
        GameConstants.PlayerId.PLAYER: 0,
        GameConstants.PlayerId.AI_1: 0,
        GameConstants.PlayerId.AI_2: 0,
        GameConstants.PlayerId.AI_3: 0,
}

var _planet_capture_times: Dictionary = {}
var _level_start_time: float = 0.0


func _ready() -> void:
        EventBus.planet_captured.connect(_on_planet_captured)
        EventBus.victory.connect(_on_victory)


func reset_scores() -> void:
        for key in _scores:
                _scores[key] = 0
        _planet_capture_times.clear()
        _level_start_time = Time.get_ticks_msec() / 1000.0


func on_planet_captured(player_id: int, planet: Node3D) -> void:
        var points := 100 * planet.level
        _scores[player_id] = _scores.get(player_id, 0) + points
        _planet_capture_times[planet] = Time.get_ticks_msec() / 1000.0
        EventBus.score_changed.emit(player_id, _scores[player_id])


func on_enemy_ship_destroyed(player_id: int, ship_count: int) -> void:
        var points := ship_count * 10
        _scores[player_id] = _scores.get(player_id, 0) + points
        EventBus.score_changed.emit(player_id, _scores[player_id])


func calculate_speed_bonus(_player_id: int) -> int:
        return 0  # TODO: вычислить бонус за скорость прохождения


func get_total_score(player_id: int) -> int:
        var base_score: int = _scores.get(player_id, 0)
        var speed_bonus: int = calculate_speed_bonus(player_id)
        return base_score + speed_bonus


func get_scores() -> Dictionary:
        return _scores.duplicate()


## Private Methods ##


func _on_planet_captured(planet: Node3D, new_owner_id: int) -> void:
        on_planet_captured(new_owner_id, planet)


func _on_victory(_player_id: int) -> void:
        # Финальный расчёт бонусов
        for pid in _scores:
                _scores[pid] = get_total_score(pid)
