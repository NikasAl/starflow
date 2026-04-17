extends Node

## Глобальные константы и перечисления для Star Flow Command.
## Autoload singleton — доступен глобально как GameConstants.

enum PlayerId { NONE, PLAYER, AI_1, AI_2, AI_3 }

enum StrategyType { AGGRESSIVE, DEFENSIVE, ECONOMIC, BALANCED }

enum PlanetType { NORMAL, RESOURCE_RICH, FORTRESS, NEXUS }

enum StreamState { TRAVELING, ARRIVING, DESTROYED }

enum Difficulty { EASY, MEDIUM, HARD }

## Статический справочник цветов по PlayerId
const PLAYER_COLORS: Dictionary = {
	PlayerId.NONE: Color.WHITE,
	PlayerId.PLAYER: Color(0.2, 0.6, 1.0),
	PlayerId.AI_1: Color(1.0, 0.3, 0.2),
	PlayerId.AI_2: Color(0.2, 1.0, 0.4),
	PlayerId.AI_3: Color(1.0, 0.8, 0.2),
}

const BASE_SHIP_SPEED: float = 8.0
const BASE_PRODUCTION_RATE: float = 1.0
const PLANET_CAPTURE_THRESHOLD: int = 5
