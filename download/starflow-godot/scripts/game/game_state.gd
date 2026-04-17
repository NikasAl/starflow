class_name GameState
extends RefCounted

## Состояние игры (Game State) — чистая логика без привязки к нодам.

## Renamed from 'State' to 'EState' to avoid conflict with class_name State (state.gd)
## В Godot 4.5 глобальный class_name State затеняет локальный enum State.
enum EState { MENU, TUTORIAL, PLAYING, PAUSED, VICTORY, DEFEAT }

var current_state: EState = EState.MENU
var elapsed_time: float = 0.0
var planets: Array = []  ## Planet3D[] — без типизации для совместимости с Godot 4.5
var streams: Array = []  ## ShipStream3D[] — без типизации для совместимости с Godot 4.5
var scores: Dictionary = {}


func _init() -> void:
        reset_scores()


func reset_scores() -> void:
        scores = {
                GameConstants.PlayerId.PLAYER: 0,
                GameConstants.PlayerId.AI_1: 0,
                GameConstants.PlayerId.AI_2: 0,
                GameConstants.PlayerId.AI_3: 0,
        }


func get_state_name() -> String:
        return EState.keys()[current_state]


func is_active() -> bool:
        return current_state == EState.PLAYING


func add_score(player_id: int, amount: int) -> void:
        if player_id in scores:
                scores[player_id] += amount


func get_score(player_id: int) -> int:
        return scores.get(player_id, 0)
