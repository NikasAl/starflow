#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  Star Flow Command — Скрипт автопроверки кода
#  Использование: ./check.sh [--fix]
#
#  Без аргументов: только проверка (lint + формат)
#  --fix:         автоформатирование + показ lint-проблем
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Добавляем ~/.local/bin в PATH (там устанавливается gdtoolkit)
export PATH="$HOME/.local/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
SCRIPTS_DIR="$PROJECT_DIR/scripts"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'  # No Color

# Счётчики
LINT_ERRORS=0
FORMAT_ISSUES=0
FILES_CHECKED=0

DO_FIX=false
if [[ "${1:-}" == "--fix" ]]; then
    DO_FIX=true
fi

echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Star Flow Command — Автопроверка кода${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
echo ""

# ─── Проверка инструментов ─────────────────────────────────────────────────
if ! command -v gdformat &> /dev/null; then
    echo -e "${RED}[ОШИБКА] gdformat не найден. Установите: pip install gdtoolkit${NC}"
    exit 1
fi
if ! command -v gdlint &> /dev/null; then
    echo -e "${RED}[ОШИБКА] gdlint не найден. Установите: pip install gdtoolkit${NC}"
    exit 1
fi

# ─── Подсчёт GDScript-файлов ──────────────────────────────────────────────
GD_FILES=$(find "$SCRIPTS_DIR" -name "*.gd" | wc -l)
echo -e "${CYAN}[ИНФО] Найдено GDScript-файлов: $GD_FILES${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
#  1. ПРОВЕРКА ФОРМАТИРОВАНИЯ (gdformat)
# ═══════════════════════════════════════════════════════════════════════════════
echo -e "${CYAN}[1/3] Проверка форматирования (gdformat)...${NC}"
echo ""

if $DO_FIX; then
    # Автоформатирование
    FORMAT_OUTPUT=$(gdformat "$SCRIPTS_DIR" --diff 2>&1 || true)
    if [ -z "$FORMAT_OUTPUT" ]; then
        echo -e "${GREEN}  ✓ Все файлы уже отформатированы${NC}"
    else
        echo -e "${YELLOW}  ⚡ Применяем автоформатирование...${NC}"
        gdformat "$SCRIPTS_DIR" 2>&1 || true
        # Проверяем, сколько файлов были изменены
        FORMATTED_NOW=$(git -C "$PROJECT_DIR" diff --name-only --diff-filter=M 2>/dev/null | grep "\.gd$" | wc -l || echo "0")
        echo -e "${GREEN}  ✓ Автоформатирование применено (изменено файлов: ~${FORMATTED_NOW})${NC}"
    fi
else
    # Только проверка
    FORMAT_OUTPUT=$(gdformat "$SCRIPTS_DIR" --check 2>&1 || true)
    if [ -z "$FORMAT_OUTPUT" ]; then
        echo -e "${GREEN}  ✓ Все файлы отформатированы правильно${NC}"
    else
        FORMAT_ISSUES=$(echo "$FORMAT_OUTPUT" | grep -c "would reformat" || echo "0")
        echo -e "${YELLOW}  ⚠ Файлы с неверным форматированием: ${FORMAT_ISSUES}${NC}"
        echo ""
        echo -e "${YELLOW}  Запустите ./check.sh --fix для автоисправления${NC}"
        echo ""
        echo "$FORMAT_OUTPUT" | head -50
        if [ "$FORMAT_ISSUES" -gt 50 ]; then
            echo -e "${YELLOW}  ... и ещё файлы${NC}"
        fi
    fi
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
#  2. ПРОВЕРКА ЛИНТЕРА (gdlint)
# ═══════════════════════════════════════════════════════════════════════════════
echo -e "${CYAN}[2/3] Статический анализ (gdlint)...${NC}"
echo ""

LINT_OUTPUT=$(gdlint "$SCRIPTS_DIR" 2>&1 || true)

if [ -z "$LINT_OUTPUT" ]; then
    echo -e "${GREEN}  ✓ Lint: проблем не найдено${NC}"
else
    LINT_ERRORS=$(echo "$LINT_OUTPUT" | wc -l)
    echo -e "${YELLOW}  ⚠ Найдено проблем: ${LINT_ERRORS}${NC}"
    echo ""

    # Группировка по типам ошибок
    UNUSED_ARG=$(echo "$LINT_OUTPUT" | grep -c "unused-argument" || echo "0")
    MAX_LINE=$(echo "$LINT_OUTPUT" | grep -c "max-line-length" || echo "0")
    FUNC_VAR=$(echo "$LINT_OUTPUT" | grep -c "function-variable-name" || echo "0")
    CLASS_ORDER=$(echo "$LINT_OUTPUT" | grep -c "class-definitions-order" || echo "0")
    OTHER=$((LINT_ERRORS - UNUSED_ARG - MAX_LINE - FUNC_VAR - CLASS_ORDER))

    echo -e "  ${YELLOW}  unused-argument:       ${UNUSED_ARG}${NC}"
    echo -e "  ${YELLOW}  max-line-length:       ${MAX_LINE}${NC}"
    echo -e "  ${YELLOW}  function-variable-name: ${FUNC_VAR}${NC}"
    echo -e "  ${YELLOW}  class-definitions-order:${CLASS_ORDER}${NC}"
    echo -e "  ${YELLOW}  прочие:                ${OTHER}${NC}"
    echo ""
    echo -e "${YELLOW}--- Детали ---${NC}"
    echo "$LINT_OUTPUT"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
#  3. БАЗОВЫЕ СЕМАНТИЧЕСКИЕ ПРОВЕРКИ
# ═══════════════════════════════════════════════════════════════════════════════
echo -e "${CYAN}[3/3] Семантические проверки...${NC}"
echo ""

# Проверка: все autoload-скрипты extends Node
SEMANTIC_ISSUES=0
for f in "$SCRIPTS_DIR"/autoload/*.gd; do
    if ! grep -q "extends Node" "$f" 2>/dev/null; then
        echo -e "${RED}  ✗ $f: autoload должен наследовать Node${NC}"
        SEMANTIC_ISSUES=$((SEMANTIC_ISSUES + 1))
    fi
done

# Проверка: нет ли class_name совпадений со встроенными классами Godot 4.5
RESERVED_CLASSES=("Constants" "String" "int" "float" "bool" "Array" "Dictionary" "Vector2" "Vector3")
for f in $(find "$SCRIPTS_DIR" -name "*.gd"); do
    CN=$(grep "^class_name " "$f" 2>/dev/null | sed 's/class_name //' | awk '{print $1}')
    for rc in "${RESERVED_CLASSES[@]}"; do
        if [ "$CN" = "$rc" ]; then
            echo -e "${RED}  ✗ $f: class_name '$CN' конфликтует с встроенным классом Godot${NC}"
            SEMANTIC_ISSUES=$((SEMANTIC_ISSUES + 1))
        fi
    done
done

# Проверка: project.godot и скрипты согласованы
for autoload_line in $(grep -oP '(?<=^)[A-Za-z_][A-Za-z0-9_]*=' "$PROJECT_DIR/project.godot" 2>/dev/null | tr -d '='); do
    # Извлекаем autoload name
    autoload_name=$(echo "$autoload_line" | cut -d'=' -f1)
done
# Проверяем что в project.godot autoload имена соответствуют class_name
AUTOLOAD_SECTION=false
while IFS= read -r line; do
    if [[ "$line" == "[autoload]" ]]; then
        AUTOLOAD_SECTION=true
        continue
    fi
    if $AUTOLOAD_SECTION && [[ -z "$line" ]]; then
        AUTOLOAD_SECTION=false
        continue
    fi
    if $AUTOLOAD_SECTION; then
        autoload_name=$(echo "$line" | cut -d'"' -f1)
        autoload_script=$(echo "$line" | grep -oP 'res://[^"]+\.gd' || true)
        if [ -n "$autoload_script" ] && [ -n "$autoload_name" ]; then
            script_path="$PROJECT_DIR/${autoload_script#res://}"
            if [ -f "$script_path" ]; then
                cn=$(grep "^class_name " "$script_path" 2>/dev/null | sed 's/class_name //' | awk '{print $1}' || true)
                if [ -n "$cn" ] && [ "$cn" != "$autoload_name" ]; then
                    echo -e "${YELLOW}  ⚠ $autoload_name: autoload имя ≠ class_name ('$cn')${NC}"
                    SEMANTIC_ISSUES=$((SEMANTIC_ISSUES + 1))
                fi
            fi
        fi
    fi
done < "$PROJECT_DIR/project.godot"

if [ "$SEMANTIC_ISSUES" -eq 0 ]; then
    echo -e "${GREEN}  ✓ Семантических проблем не найдено${NC}"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
#  ИТОГО
# ═══════════════════════════════════════════════════════════════════════════════
echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
TOTAL=$((LINT_ERRORS + FORMAT_ISSUES + SEMANTIC_ISSUES))
if [ "$TOTAL" -eq 0 ]; then
    echo -e "${GREEN}  ✓ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ — код чист!${NC}"
    echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${YELLOW}  ⚠ Найдено проблем: ${TOTAL}${NC}"
    echo -e "    Lint: ${LINT_ERRORS} | Формат: ${FORMAT_ISSUES} | Семантика: ${SEMANTIC_ISSUES}"
    echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
    exit 1
fi
