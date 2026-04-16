class_name StreamManager
extends Node

## Менеджер потоков кораблей.

var _active_streams: Array[ShipStream3D] = []

func _ready() -> void:
        EventBus.stream_destroyed.connect(_on_stream_destroyed)

func create_stream(source: Planet3D, target: Planet3D, owner_id: int, ship_count: int) -> ShipStream3D:
        var stream := ShipStream3D.new()
        stream.source = source
        stream.target = target
        stream.owner_id = owner_id
        stream.ship_count = ship_count
        add_child(stream)
        _active_streams.append(stream)
        return stream

func redirect_stream(stream: ShipStream3D, new_target: Planet3D) -> void:
        if stream and is_instance_valid(stream):
                stream.redirect(new_target)

func cancel_streams_for_planet(planet: Planet3D) -> void:
        var to_remove: Array[ShipStream3D] = []
        for stream in _active_streams:
                if stream.source == planet or stream.target == planet:
                        stream.destroy()
                        to_remove.append(stream)
        for stream in to_remove:
                _active_streams.erase(stream)

func get_streams_from(planet: Planet3D) -> Array[ShipStream3D]:
        var result: Array[ShipStream3D] = []
        for stream in _active_streams:
                if stream.source == planet:
                        result.append(stream)
        return result

func get_streams_to(planet: Planet3D) -> Array[ShipStream3D]:
        var result: Array[ShipStream3D] = []
        for stream in _active_streams:
                if stream.target == planet:
                        result.append(stream)
        return result

func get_all_streams() -> Array[ShipStream3D]:
        return _active_streams.duplicate()

func _on_stream_destroyed(stream: ShipStream3D) -> void:
        _active_streams.erase(stream)
