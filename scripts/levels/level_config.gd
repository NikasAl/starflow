class_name LevelConfig
extends Resource

## Конфигурация уровня.

@export var level_name: String = "Level 1"
@export var planet_count: int = 20
@export var ai_count: int = 2
@export var map_size: float = 50.0
@export var seed: int = 0
@export var difficulty: int = Constants.Difficulty.MEDIUM
@export var starting_conditions: Dictionary = {
	"player_planets": 1,
	"player_level": 3,
	"ai_level": 2,
	"neutral_level": 1,
}
