#!/usr/bin/env bash
# =============================================================================
# starflow/check.sh — Автоматическая проверка качества GDScript-кода
# =============================================================================
# Использование:
#   ./check.sh              # Полная проверка (формат + линт + семантика)
#   ./check.sh lint         # Только gdlint
#   ./check.sh format       # Только gdformat --check
#   ./check.sh format-fix   # gdformat с автоисправлением
#   ./check.sh semantic     # Семантический анализ агента
#   ./check.sh list         # Список всех .gd файлов
# =============================================================================

set -euo pipefail

# --- Конфигурация ---
SCRIPTS_DIR="scripts"
DOCS_DIR="docs"
MAX_LINE_LENGTH=100
FAIL_COUNT=0

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# --- Утилиты ---
info()    { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()      { echo -e "${GREEN}[ OK ]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail()    { echo -e "${RED}[FAIL]${NC} $*"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
header()  { echo -e "\n${BOLD}══════════════════════════════════════════${NC}"; echo -e "${BOLD}  $*${NC}"; echo -e "${BOLD}══════════════════════════════════════════${NC}\n"; }

check_tool() {
    if ! command -v "$1" &>/dev/null; then
        fail "Инструмент '$1' не найден. Установите: pip install gdtoolkit"
        return 1
    fi
    ok "$1 ($( $1 --version 2>/dev/null | head -1 ))"
}

count_gd_files() {
    find "$SCRIPTS_DIR" -name "*.gd" -not -path "*addons/*" 2>/dev/null | wc -l
}

# --- 1. Форматирование ---
check_format() {
    header "1. Проверка форматирования (gdformat)"
    check_tool gdformat || return 1

    local total_files
    total_files=$(count_gd_files)
    info "Файлов .gd: $total_files"

    if gdformat --check "$SCRIPTS_DIR" 2>&1; then
        ok "Все файлы отформатированы правильно"
    else
        local bad_files
        bad_files=$(gdformat --check "$SCRIPTS_DIR" 2>&1 | grep "would reformat" | wc -l)
        fail "$bad_files из $total_files файлов требуют форматирования"
        warn "Запустите ./check.sh format-fix для автоисправления"
    fi
}

fix_format() {
    header "Автоформатирование (gdformat)"
    check_tool gdformat || return 1

    info "Форматирование файлов в $SCRIPTS_DIR/ ..."
    if gdformat "$SCRIPTS_DIR" 2>&1; then
        ok "Форматирование завершено"
    else
        warn "Некоторые файлы не удалось отформатировать (права доступа?)"
    fi
}

# --- 2. Линт ---
check_lint() {
    header "2. Статический анализ (gdlint)"
    check_tool gdlint || return 1

    local total_files
    total_files=$(count_gd_files)
    info "Файлов .gd: $total_files"

    # Запускаем gdlint и собираем результат
    local lint_output
    lint_output=$(gdlint "$SCRIPTS_DIR" 2>&1 || true)

    local errors warnings
    errors=$(echo "$lint_output" | grep -c "Error:" || true)
    warnings=$(echo "$lint_output" | grep -c "Warning:" || true)

    if [ "$errors" -eq 0 ] && [ "$warnings" -eq 0 ]; then
        ok "Линт пройден: 0 проблем"
    else
        echo "$lint_output"
        echo ""
        fail "Обнаружено проблем: $errors ошибок, $warnings предупреждений"
        echo ""

        # Группировка по типу
        info "--- Сводка по типам ---"
        echo "$lint_output" | grep -oP '\(\K[^)]+(?=\))' | sort | uniq -c | sort -rn || true
    fi
}

# --- 3. Семантический анализ ---
check_semantic() {
    header "3. Семантический анализ"

    local total_files
    total_files=$(count_gd_files)
    local issues=0

    # 3.1. Проверка: все autoload-скрипты существуют в project.godot
    info "3.1 Проверка autoload-регистраций..."
    if [ -f "project.godot" ]; then
        local autoload_section=false
        while IFS= read -r line; do
            if [[ "$line" == "[autoload]" ]]; then autoload_section=true; continue; fi
            if [[ "$line" == "["* ]] && $autoload_section; then break; fi
            if $autoload_section && [[ "$line" == *"="* ]]; then
                local script_path
                script_path=$(echo "$line" | grep -oP 'res://[^\s"]+' | sed 's/^\*//' | tr -d '"' || true)
                # Конвертируем Godot-путь (res://) в файловый
                local file_path="${script_path/res:\/\//}"
                if [ -n "$script_path" ] && [ ! -f "$file_path" ]; then
                    fail "Autoload файл не найден: $file_path"
                    issues=$((issues + 1))
                fi
            fi
        done < project.godot
        if [ "$issues" -eq 0 ]; then ok "Все autoload-файлы существуют"; fi
    else
        warn "project.godot не найден"
    fi

    # 3.2. Проверка: class_name используется в файлах, которые его требуют
    info "3.2 Проверка class_name..."
    local missing_classname=0
    while IFS= read -r file; do
        # Файлы, которые НЕ должны иметь class_name (autoload-синглтоны)
        if echo "$file" | grep -q "autoload/"; then
            if grep -q "class_name " "$file" 2>/dev/null; then
                warn "Autoload $file имеет class_name (обычно не нужно)"
            fi
            continue
        fi
        # Файлы, которые должны иметь class_name
        if ! grep -q "class_name " "$file" 2>/dev/null; then
            # Исключения: базовые шаблоны BTLeaf и State
            if ! echo "$file" | grep -qE "(bt_leaf|state)\.gd$"; then
                warn "Файл $file не имеет class_name"
                missing_classname=$((missing_classname + 1))
            fi
        fi
    done < <(find "$SCRIPTS_DIR" -name "*.gd" -not -path "*addons/*")
    if [ "$missing_classname" -eq 0 ]; then ok "class_name корректен во всех файлах"; fi

    # 3.3. Проверка: extends соответствует типу
    info "3.3 Проверка наследования..."
    local bad_extends=0
    while IFS= read -r file; do
        if grep -q "extends Node3D" "$file" 2>/dev/null; then
            local dirname
            dirname=$(basename "$(dirname "$file")")
            if [[ "$dirname" != "planets" && "$dirname" != "streams" && "$dirname" != "camera" ]]; then
                # Не ошибка, но заметка
                true
            fi
        fi
        # Проверяем, что Resource-классы наследуют Resource/RefCounted
        if echo "$file" | grep -qE "resources/|config\.gd|profile\.gd"; then
            if ! grep -q "extends Resource\|extends RefCounted" "$file" 2>/dev/null; then
                fail "$file — Resource-класс должен наследовать Resource или RefCounted"
                bad_extends=$((bad_extends + 1))
            fi
        fi
    done < <(find "$SCRIPTS_DIR" -name "*.gd" -not -path "*addons/*")
    if [ "$bad_extends" -eq 0 ]; then ok "Наследование корректно"; fi

    # 3.4. Проверка: наличие сигналов в EventBus, на которые есть подписки
    info "3.4 Проверка сигналов EventBus..."
    local missing_signals=0
    local eventbus_file="$SCRIPTS_DIR/autoload/event_bus.gd"
    if [ -f "$eventbus_file" ]; then
        while IFS= read -r file; do
            while IFS= read -r signal_call; do
                # Извлекаем имя сигнала из EventBus.xxx.emit() или .connect()
                local sig_name
                sig_name=$(echo "$signal_call" | grep -oP 'EventBus\.\K[a-z_]+' || true)
                if [ -n "$sig_name" ]; then
                    if ! grep -q "signal $sig_name" "$eventbus_file" 2>/dev/null; then
                        fail "$file использует несуществующий сигнал EventBus.$sig_name"
                        missing_signals=$((missing_signals + 1))
                    fi
                fi
            done < <(grep -oP 'EventBus\.[a-z_]+' "$file" 2>/dev/null || true)
        done < <(find "$SCRIPTS_DIR" -name "*.gd" -not -path "*event_bus*" -not -path "*addons/*")
        if [ "$missing_signals" -eq 0 ]; then ok "Все используемые сигналы EventBus объявлены"; fi
    fi

    # 3.5. Проверка: файлы не используют $NodePath (должны использовать %)
    info "3.5 Проверка ссылок на узлы (% вместо $)..."
    local dollar_refs=0
    while IFS= read -r file; do
        while IFS= read -r match; do
            warn "$file:$(echo "$match" | grep -oP '\d+') использует \$NodePath: $(echo "$match" | grep -oP '\$\S+')"
            dollar_refs=$((dollar_refs + 1))
        done < <(grep -nP '@onready.*\$' "$file" 2>/dev/null || true)
    done < <(find "$SCRIPTS_DIR" -name "*.gd" -not -path "*addons/*")
    if [ "$dollar_refs" -eq 0 ]; then ok "Все @onready используют % уникальных узлов"; fi

    # 3.7. Проверка: TODO/FIXME/HACK в коде
    info "3.7 Поиск TODO/FIXME/HACK..."
    local todo_count=0
    while IFS= read -r match; do
        warn "$match"
        todo_count=$((todo_count + 1))
    done < <(grep -rn "TODO\|FIXME\|HACK\|XXX" "$SCRIPTS_DIR" --include="*.gd" 2>/dev/null || true)
    if [ "$todo_count" -eq 0 ]; then ok "Нет незавершённых пометок"; fi
}

# --- 4. Список файлов ---
list_files() {
    header "Список GDScript файлов"
    find "$SCRIPTS_DIR" -name "*.gd" -not -path "*addons/*" | sort
    echo ""
    info "Всего: $(count_gd_files) файлов"
}

# --- 5. Статистика ---
show_stats() {
    header "Статистика проекта"
    local total_lines=0
    local total_files=0
    info "Сбор статистики по $SCRIPTS_DIR/ ..."
    while IFS= read -r file; do
        local lines
        lines=$(wc -l < "$file")
        total_lines=$((total_lines + lines))
        total_files=$((total_files + 1))
    done < <(find "$SCRIPTS_DIR" -name "*.gd" -not -path "*addons/*")

    echo ""
    echo -e "  Файлов .gd:     ${BOLD}$total_files${NC}"
    echo -e "  Строк кода:     ${BOLD}$total_lines${NC}"
    echo -e "  Среднее/файл:   ${BOLD}$((total_lines / (total_files + 1)))${NC}"
    echo ""

    # Список автозагрузок
    info "Автозагрузки (autoloads):"
    if [ -f "project.godot" ]; then
        local in_section=false
        while IFS= read -r line; do
            if [[ "$line" == "[autoload]" ]]; then in_section=true; continue; fi
            if [[ "$line" == "["* ]] && $in_section; then break; fi
            if $in_section && [[ "$line" == *"="* ]]; then
                echo "  $line"
            fi
        done < project.godot
    fi
}

# =============================================================================
# Точка входа
# =============================================================================
cd "$(dirname "$0")"

case "${1:-all}" in
    lint)
        check_lint
        ;;
    format)
        check_format
        ;;
    format-fix)
        fix_format
        ;;
    semantic)
        check_semantic
        ;;
    list)
        list_files
        ;;
    stats)
        show_stats
        ;;
    all)
        echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
        echo -e "${BOLD}║  Star Flow Command — Проверка качества    ║${NC}"
        echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
        check_format
        check_lint
        check_semantic
        echo ""
        header "ИТОГО"
        if [ "$FAIL_COUNT" -eq 0 ]; then
            ok "Все проверки пройдены успешно!"
        else
            fail "Обнаружено $FAIL_COUNT проблем"
            echo -e "  Запустите ${YELLOW}./check.sh format-fix${NC} для автоформатирования"
            echo -e "  Запустите ${YELLOW}./check.sh lint${NC} для деталей по линту"
        fi
        ;;
    *)
        echo "Использование: ./check.sh [команда]"
        echo ""
        echo "Команды:"
        echo "  all          Полная проверка (по умолчанию)"
        echo "  lint         Только статический анализ (gdlint)"
        echo "  format       Проверка форматирования (gdformat --check)"
        echo "  format-fix   Автоформатирование (gdformat)"
        echo "  semantic     Семантический анализ"
        echo "  list         Список всех .gd файлов"
        echo "  stats        Статистика проекта"
        exit 1
        ;;
esac

exit $FAIL_COUNT
