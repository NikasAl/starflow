class_name AIProfile
extends Resource

## Профиль ИИ — определяет стиль поведения AI.

@export var profile_name: String = "Default"
@export var decision_interval: float = 1.5
@export var strategy_type: int = GameConstants.StrategyType.BALANCED
@export var weakness: int = GameConstants.PlayerId.NONE  ## Уязвимость к определённому игроку
@export var aggression_factor: float = 0.5
@export var defense_priority: float = 0.5
@export var expansion_priority: float = 0.5
@export var reaction_delay: float = 0.5
@export var risk_tolerance: float = 0.5
