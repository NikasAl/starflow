class_name UIManager
extends CanvasLayer

## Менеджер пользовательского интерфейса.

## preload для доступа к enum GameState.State в Godot 4.5
const _GameStateScript := preload("res://scripts/game/game_state.gd")

var _notification_timer: Timer = null

@onready var planet_info_panel: PanelContainer = %PlanetInfoPanel
@onready var score_display: Label = %ScoreDisplay
@onready var notification_label: Label = %NotificationLabel
@onready var pause_menu: Control = %PauseMenu
@onready var victory_screen: Control = %VictoryScreen
@onready var defeat_screen: Control = %DefeatScreen


func _ready() -> void:
        EventBus.ui_show_planet_info.connect(_show_planet_info)
        EventBus.ui_hide_planet_info.connect(_hide_planet_info)
        EventBus.ui_show_notification.connect(_show_notification)
        EventBus.game_state_changed.connect(_on_game_state_changed)
        EventBus.victory.connect(_on_victory)
        EventBus.defeat.connect(_on_defeat)
        EventBus.score_changed.connect(_on_score_changed)

        _notification_timer = Timer.new()
        _notification_timer.one_shot = true
        _notification_timer.timeout.connect(_hide_notification)
        add_child(_notification_timer)


func show_planet_info(planet: Node3D) -> void:
        EventBus.ui_show_planet_info.emit(planet)


func hide_planet_info() -> void:
        EventBus.ui_hide_planet_info.emit()


func show_pause_menu() -> void:
        if pause_menu:
                pause_menu.visible = true


func hide_pause_menu() -> void:
        if pause_menu:
                pause_menu.visible = false


## Private Methods ##


func _show_planet_info(_planet: Node3D) -> void:
        if not planet_info_panel:
                return

                # TODO: обновить текст в панели информацией о планете
        planet_info_panel.visible = true
        # TODO: обновить текст в панели информацией о планете


func _hide_planet_info() -> void:
        if planet_info_panel:
                planet_info_panel.visible = false


func _show_notification(message: String, duration: float) -> void:
        if notification_label:
                notification_label.text = message
                notification_label.visible = true
                _notification_timer.start(duration)


func _hide_notification() -> void:
        if notification_label:
                notification_label.visible = false


func _on_game_state_changed(_old_state: int, new_state: int) -> void:
        match new_state:
                _GameStateScript.State.PAUSED:
                        show_pause_menu()
                _GameStateScript.State.PLAYING:
                        hide_pause_menu()


func _on_victory(_player_id: int) -> void:
        if victory_screen:
                victory_screen.visible = true


func _on_defeat(_player_id: int) -> void:
        if defeat_screen:
                defeat_screen.visible = true


func _on_score_changed(player_id: int, new_score: int) -> void:
        if score_display and player_id == GameConstants.PlayerId.PLAYER:
                score_display.text = "Очки: %d" % new_score
