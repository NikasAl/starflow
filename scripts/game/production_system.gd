class_name ProductionSystem
extends Node

## Система производства — накапливает корабли на планетах в реальном времени.
## Каждая планета с владельцем производит корабли с частотой,
## зависящей от production_rate × level. Накопленные корабли либо
## отправляются по активному потоку, либо помещаются в очередь (pending_ships).

## Накопители производства: Planet3D → float (дробная часть до следующего корабля)
var _production_accumulators: Dictionary = {}


func _process(delta: float) -> void:
        # Не обрабатываем, если GameManager или список планет не инициализированы
        if GameManager == null or GameManager.all_planets.is_empty():
                return

                # Очистка устаревших записей (планеты могли быть удалены)

                # Пропускаем нейтральные планеты

                # Инициализация накопителя при первом обращении

                # Накопление производства

                # Спавн кораблей при достижении порога (1 корабль)
        _cleanup_stale_accumulators()

        for planet in GameManager.all_planets:
                if not is_instance_valid(planet):
                        continue

                        # Пропускаем нейтральные планеты

                        # Инициализация накопителя при первом обращении

                        # Накопление производства

                        # Спавн кораблей при достижении порога (1 корабль)
                if planet.owner_id == GameConstants.PlayerId.NONE:
                        continue

                        # Инициализация накопителя при первом обращении

                        # Накопление производства

                        # Спавн кораблей при достижении порога (1 корабль)
                var rate: float = planet.get_production_rate()
                if rate <= 0.0:
                        continue

                        # Инициализация накопителя при первом обращении

                        # Накопление производства

                        # Спавн кораблей при достижении порога (1 корабль)
                if not _production_accumulators.has(planet):
                        _production_accumulators[planet] = 0.0

                        # Накопление производства

                        # Спавн кораблей при достижении порога (1 корабль)
                _production_accumulators[planet] += rate * delta

                # Спавн кораблей при достижении порога (1 корабль)
                while _production_accumulators[planet] >= 1.0:
                        _production_accumulators[planet] -= 1.0
                        _spawn_ship_for_planet(planet)


# ─── Логика спавна кораблей ────────────────────────────────────────────────


func _spawn_ship_for_planet(planet: Node3D) -> void:
        # Проверяем наличие активного исходящего потока
        var streams = GameManager.stream_manager.get_streams_from(planet)
        if streams.size() > 0:
                # Увеличиваем счётчик кораблей в существующем потоке
                streams[0].ship_count += 1

                # Нет активного потока — помещаем корабль в очередь на планете
        else:
                # Нет активного потока — помещаем корабль в очередь на планете
                planet.pending_ships += 1


# ─── Очистка ───────────────────────────────────────────────────────────────


func _cleanup_stale_accumulators() -> void:
        var stale_keys: Array = []
        for key in _production_accumulators:
                if not is_instance_valid(key):
                        stale_keys.append(key)
        for key in stale_keys:
                _production_accumulators.erase(key)
