class_name GameState
extends RefCounted

## Состояние игры (Game State) — чистая логика без привязки к нодам.

enum State { MENU, TUTORIAL, PLAYING, PAUSED, VICTORY, DEFEAT }

var current_state: State = State.MENU
var elapsed_time: float = 0.0
var planets: Array[Planet3D] = []
var streams: Array[ShipStream3D] = []
var scores: Dictionary = {}

func _init() -> void:
	reset_scores()

func reset_scores() -> void:
	scores = {
		Constants.PlayerId.PLAYER: 0,
		Constants.PlayerId.AI_1: 0,
		Constants.PlayerId.AI_2: 0,
		Constants.PlayerId.AI_3: 0,
	}

func get_state_name() -> String:
	return State.keys()[current_state]

func is_active() -> bool:
	return current_state == State.PLAYING

func add_score(player_id: int, amount: int) -> void:
	if player_id in scores:
		scores[player_id] += amount

func get_score(player_id: int) -> int:
	return scores.get(player_id, 0)
