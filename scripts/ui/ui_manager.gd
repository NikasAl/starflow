class_name UIManager
extends CanvasLayer

## Менеджер пользовательского интерфейса.
## ВАЖНО (Godot 4.5): UI-элементы создаются программно,
## т.к. в main.tscn ещё нет дочерних UI-нод.

const _GameStateScript := preload("res://scripts/game/game_state.gd")

var _notification_timer: Timer = null

## UI элементы — создаются в _ready() программно
var planet_info_panel: PanelContainer
var score_display: Label
var notification_label: Label
var pause_menu: Control
var victory_screen: Control
var defeat_screen: Control


func _ready() -> void:
	_build_ui()
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


func _build_ui() -> void:
	## Score display — верхний левый угол
	score_display = Label.new()
	score_display.name = "ScoreDisplay"
	score_display.anchor_left = 0.05
	score_display.anchor_top = 0.02
	score_display.anchor_right = 0.35
	score_display.anchor_bottom = 0.08
	score_display.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	score_display.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	score_display.text = "Очки: 0"
	_add_label_theme(score_display, 24, Color.WHITE)
	add_child(score_display)

	## Notification label — верхний центр
	notification_label = Label.new()
	notification_label.name = "NotificationLabel"
	notification_label.anchor_left = 0.25
	notification_label.anchor_top = 0.06
	notification_label.anchor_right = 0.75
	notification_label.anchor_bottom = 0.12
	notification_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	notification_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	notification_label.visible = false
	_add_label_theme(notification_label, 20, Color.YELLOW)
	add_child(notification_label)

	## Planet info panel — нижний левый угол
	planet_info_panel = PanelContainer.new()
	planet_info_panel.name = "PlanetInfoPanel"
	planet_info_panel.anchor_left = 0.02
	planet_info_panel.anchor_top = 0.75
	planet_info_panel.anchor_right = 0.30
	planet_info_panel.anchor_bottom = 0.98
	planet_info_panel.visible = false
	var info_style = StyleBoxFlat.new()
	info_style.bg_color = Color(0.0, 0.0, 0.0, 0.7)
	info_style.border_color = Color(0.3, 0.5, 1.0, 0.8)
	info_style.set_border_width_all(2)
	info_style.set_corner_radius_all(8)
	planet_info_panel.add_theme_stylebox_override("panel", info_style)
	var info_label = Label.new()
	info_label.name = "InfoLabel"
	info_label.text = "Планета"
	_add_label_theme(info_label, 18, Color.WHITE)
	planet_info_panel.add_child(info_label)
	add_child(planet_info_panel)

	## Pause menu — центр экрана
	pause_menu = PanelContainer.new()
	pause_menu.name = "PauseMenu"
	pause_menu.anchor_left = 0.3
	pause_menu.anchor_top = 0.3
	pause_menu.anchor_right = 0.7
	pause_menu.anchor_bottom = 0.7
	pause_menu.visible = false
	var pause_style = StyleBoxFlat.new()
	pause_style.bg_color = Color(0.0, 0.0, 0.0, 0.85)
	pause_style.set_corner_radius_all(12)
	pause_menu.add_theme_stylebox_override("panel", pause_style)
	var pause_vbox = VBoxContainer.new()
	pause_vbox.anchor_left = 0.0
	pause_vbox.anchor_top = 0.0
	pause_vbox.anchor_right = 1.0
	pause_vbox.anchor_bottom = 1.0
	var pause_title = Label.new()
	pause_title.text = "ПАУЗА"
	pause_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_add_label_theme(pause_title, 32, Color.WHITE)
	pause_vbox.add_child(pause_title)
	pause_menu.add_child(pause_vbox)
	add_child(pause_menu)

	## Victory screen
	victory_screen = PanelContainer.new()
	victory_screen.name = "VictoryScreen"
	victory_screen.anchor_left = 0.2
	victory_screen.anchor_top = 0.3
	victory_screen.anchor_right = 0.8
	victory_screen.anchor_bottom = 0.7
	victory_screen.visible = false
	var vic_style = StyleBoxFlat.new()
	vic_style.bg_color = Color(0.0, 0.1, 0.0, 0.85)
	vic_style.set_corner_radius_all(12)
	victory_screen.add_theme_stylebox_override("panel", vic_style)
	var vic_label = Label.new()
	vic_label.text = "ПОБЕДА!"
	vic_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_add_label_theme(vic_label, 48, Color(0.2, 1.0, 0.3))
	victory_screen.add_child(vic_label)
	add_child(victory_screen)

	## Defeat screen
	defeat_screen = PanelContainer.new()
	defeat_screen.name = "DefeatScreen"
	defeat_screen.anchor_left = 0.2
	defeat_screen.anchor_top = 0.3
	defeat_screen.anchor_right = 0.8
	defeat_screen.anchor_bottom = 0.7
	defeat_screen.visible = false
	var def_style = StyleBoxFlat.new()
	def_style.bg_color = Color(0.1, 0.0, 0.0, 0.85)
	def_style.set_corner_radius_all(12)
	defeat_screen.add_theme_stylebox_override("panel", def_style)
	var def_label = Label.new()
	def_label.text = "ПОРАЖЕНИЕ"
	def_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_add_label_theme(def_label, 48, Color(1.0, 0.3, 0.2))
	defeat_screen.add_child(def_label)
	add_child(defeat_screen)


func _add_label_theme(label: Label, font_size: int, color: Color) -> void:
	var theme = Theme.new()
	theme.set_font_size("font_size", "Label", font_size)
	theme.set_color("font_color", "Label", color)
	theme.set_color("font_shadow_color", "Label", Color(0, 0, 0, 0.5))
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.5))
	label.add_theme_constant_override("shadow_offset_x", 1)
	label.add_theme_constant_override("shadow_offset_y", 1)


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


func _show_planet_info(planet: Node3D) -> void:
	if not planet_info_panel:
		return
	var info_label = planet_info_panel.get_node_or_null("InfoLabel")
	if info_label and is_instance_valid(planet):
		var owner_name = "Нейтральная"
		match planet.owner_id:
			GameConstants.PlayerId.PLAYER:
				owner_name = "Игрок"
			GameConstants.PlayerId.AI_1:
				owner_name = "AI 1"
			GameConstants.PlayerId.AI_2:
				owner_name = "AI 2"
			GameConstants.PlayerId.AI_3:
				owner_name = "AI 3"
		info_label.text = "%s\nВладелец: %s\nУровень: %d\nПроизводство: %.1f" % [
			planet.name, owner_name, planet.level, planet.get_production_rate()
		]
	planet_info_panel.visible = true


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
		_GameStateScript.EState.PAUSED:
			show_pause_menu()
		_GameStateScript.EState.PLAYING:
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
