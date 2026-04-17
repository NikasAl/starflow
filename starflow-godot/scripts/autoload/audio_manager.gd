extends Node

## Audio Manager — управление звуками (Autoload).

const MAX_SFX_CHANNELS: int = 8

var _music_player: AudioStreamPlayer = null
var _sfx_players: Array[AudioStreamPlayer] = []


func _ready() -> void:
	_music_player = AudioStreamPlayer.new()
	_music_player.bus = "Music"
	add_child(_music_player)

	for i in MAX_SFX_CHANNELS:
		var player := AudioStreamPlayer.new()
		player.bus = "SFX"
		add_child(player)
		_sfx_players.append(player)


func play_music(stream: AudioStream) -> void:
	if _music_player.playing:
		_music_player.stop()
	_music_player.stream = stream
	_music_player.play()


func stop_music(fade_out: bool = false) -> void:
	if fade_out:
		var tween := create_tween()
		tween.tween_property(_music_player, "volume_db", -80.0, 1.0)
		tween.tween_callback(_music_player.stop)
		tween.tween_property(_music_player, "volume_db", 0.0, 0.0)
	else:
		_music_player.stop()


func play_sfx(stream: AudioStream, volume_db: float = 0.0, pitch_scale: float = 1.0) -> void:
	for player in _sfx_players:
		if not player.playing:
			player.stream = stream
			player.volume_db = volume_db
			player.pitch_scale = pitch_scale
			player.play()
			return
	push_warning("AudioManager: все SFX каналы заняты")


func set_music_volume(db: float) -> void:
	_music_player.volume_db = db


func set_sfx_volume(db: float) -> void:
	for player in _sfx_players:
		player.volume_db = db
