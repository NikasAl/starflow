extends Node

## Event Bus — глобальная шина событий (Autoload).
## Все системы общаются через сигналы этого синглтона.

# --- Planet Events ---
signal planet_captured(planet: Planet3D, new_owner_id: int)
signal planet_damaged(planet: Planet3D, damage_amount: int)
signal planet_level_changed(planet: Planet3D, new_level: int)

# --- Stream Events ---
signal stream_created(stream: ShipStream3D)
signal stream_redirected(stream: ShipStream3D, new_target: Planet3D)
signal stream_destroyed(stream: ShipStream3D)

# --- Game State Events ---
signal game_state_changed(old_state: int, new_state: int)
signal level_started(level_config: LevelConfig)
signal victory(player_id: int)
signal defeat(player_id: int)

# --- Score Events ---
signal score_changed(player_id: int, new_score: int)

# --- UI Events ---
signal ui_show_planet_info(planet: Planet3D)
signal ui_hide_planet_info
signal ui_show_notification(message: String, duration: float)
