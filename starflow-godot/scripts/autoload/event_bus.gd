extends Node

## Event Bus — глобальная шина событий (Autoload).
## Все системы общаются через сигналы этого синглтона.
##
## ВАЖНО (Godot 4.5): в autoload-скриптах типы из class_name
## могут быть недоступны на момент парсинга. Сигналы оставляем
## без типизации кастомных классов — это не влияет на runtime.

# --- Planet Events ---
signal planet_captured(planet, new_owner_id: int)
signal planet_damaged(planet, damage_amount: int)
signal planet_level_changed(planet, new_level: int)

# --- Stream Events ---
signal stream_created(stream)
signal stream_redirected(stream, new_target)
signal stream_destroyed(stream)

# --- Game State Events ---
signal game_state_changed(old_state: int, new_state: int)
signal level_started(level_config)
signal victory(player_id: int)
signal defeat(player_id: int)

# --- Score Events ---
signal score_changed(player_id: int, new_score: int)

# --- UI Events ---
signal ui_show_planet_info(planet)
signal ui_hide_planet_info
signal ui_show_notification(message: String, duration: float)
