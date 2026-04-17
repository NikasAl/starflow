#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  Star Flow Command — Скрипт автопроверки кода (Godot 4.5)
#  Использование: ./check.sh [--fix]
#
#  Без аргументов: только проверка (lint + формат + семантика 4.5)
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
SEMANTIC_ISSUES=0

DO_FIX=false
if [[ "${1:-}" == "--fix" ]]; then
    DO_FIX=true
fi

echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Star Flow Command — Автопроверка кода (Godot 4.5)${NC}"
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
    FORMAT_OUTPUT=$(gdformat "$SCRIPTS_DIR" --diff 2>&1 || true)
    if [ -z "$FORMAT_OUTPUT" ]; then
        echo -e "${GREEN}  ✓ Все файлы уже отформатированы${NC}"
    else
        echo -e "${YELLOW}  ⚡ Применяем автоформатирование...${NC}"
        gdformat "$SCRIPTS_DIR" 2>&1 || true
        echo -e "${GREEN}  ✓ Автоформатирование применено${NC}"
    fi
else
    FORMAT_OUTPUT=$(gdformat "$SCRIPTS_DIR" --check 2>&1 || true)
    # gdformat --check выводит "N files would be left unchanged" даже при успехе
    # Ошибка — только если есть "would reformat"
    if echo "$FORMAT_OUTPUT" | grep -q "would reformat"; then
        FORMAT_ISSUES=$(echo "$FORMAT_OUTPUT" | grep -c "would reformat" 2>/dev/null)
        FORMAT_ISSUES=${FORMAT_ISSUES:-0}
        echo -e "${YELLOW}  ⚠ Файлы с неверным форматированием: ${FORMAT_ISSUES}${NC}"
        echo ""
        echo -e "${YELLOW}  Запустите ./check.sh --fix для автоисправления${NC}"
        echo ""
        echo "$FORMAT_OUTPUT" | head -50
        if [ "$FORMAT_ISSUES" -gt 50 ]; then
            echo -e "${YELLOW}  ... и ещё файлы${NC}"
        fi
    else
        echo -e "${GREEN}  ✓ Все файлы отформатированы правильно${NC}"
    fi
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
#  2. ПРОВЕРКА ЛИНТЕРА (gdlint)
# ═══════════════════════════════════════════════════════════════════════════════
echo -e "${CYAN}[2/3] Статический анализ (gdlint)...${NC}"
echo ""

LINT_OUTPUT=$(gdlint "$SCRIPTS_DIR" 2>&1 || true)

# gdlint при успехе выводит "Success: no problems found" — это не ошибка
# Ошибки — только строки с именами файлов (содержат .gd:)
if echo "$LINT_OUTPUT" | grep -q "\.gd:"; then
    LINT_ERRORS=$(echo "$LINT_OUTPUT" | grep -c "\.gd:" 2>/dev/null)
    LINT_ERRORS=${LINT_ERRORS:-0}
    echo -e "${YELLOW}  ⚠ Найдено проблем: ${LINT_ERRORS}${NC}"
    echo ""

    # Группировка по типам ошибок
    UNUSED_ARG=$(echo "$LINT_OUTPUT" | grep -c "unused-argument" 2>/dev/null)
    UNUSED_ARG=${UNUSED_ARG:-0}
    MAX_LINE=$(echo "$LINT_OUTPUT" | grep -c "max-line-length" 2>/dev/null)
    MAX_LINE=${MAX_LINE:-0}
    FUNC_VAR=$(echo "$LINT_OUTPUT" | grep -c "function-variable-name" 2>/dev/null)
    FUNC_VAR=${FUNC_VAR:-0}
    CLASS_ORDER=$(echo "$LINT_OUTPUT" | grep -c "class-definitions-order" 2>/dev/null)
    CLASS_ORDER=${CLASS_ORDER:-0}
    OTHER=$((LINT_ERRORS - UNUSED_ARG - MAX_LINE - FUNC_VAR - CLASS_ORDER))

    echo -e "  ${YELLOW}  unused-argument:       ${UNUSED_ARG}${NC}"
    echo -e "  ${YELLOW}  max-line-length:       ${MAX_LINE}${NC}"
    echo -e "  ${YELLOW}  function-variable-name: ${FUNC_VAR}${NC}"
    echo -e "  ${YELLOW}  class-definitions-order:${CLASS_ORDER}${NC}"
    echo -e "  ${YELLOW}  прочие:                ${OTHER}${NC}"
    echo ""
    echo -e "${YELLOW}--- Детали ---${NC}"
    echo "$LINT_OUTPUT"
else
    LINT_ERRORS=0
    echo -e "${GREEN}  ✓ Lint: проблем не найдено${NC}"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
#  3. СЕМАНТИЧЕСКИЕ ПРОВЕРКИ (Godot 4.5)
# ═══════════════════════════════════════════════════════════════════════════════
echo -e "${CYAN}[3/3] Семантические проверки (Godot 4.5)...${NC}"
echo ""

# Список autoload-скриптов (извлекаем один раз)
AUTOLOAD_SCRIPTS=()
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
        autoload_script=$(echo "$line" | grep -oP 'res://[^"]+\.gd' || true)
        if [ -n "$autoload_script" ]; then
            script_path="$PROJECT_DIR/${autoload_script#res://}"
            if [ -f "$script_path" ]; then
                AUTOLOAD_SCRIPTS+=("$script_path")
            fi
        fi
    fi
done < "$PROJECT_DIR/project.godot"

# ─── 3a. class_name в autoload-скриптах (Godot 4.5: Parser Error) ───────
echo -e "  ${CYAN}[3a] class_name в autoload-скриптах...${NC}"
for script_path in "${AUTOLOAD_SCRIPTS[@]}"; do
    cn=$(grep "^class_name " "$script_path" 2>/dev/null | sed 's/class_name //' | awk '{print $1}' 2>/dev/null) || cn=""
    if [ -n "$cn" ]; then
        echo -e "${RED}  ✗ ${script_path}: class_name '${cn}' в autoload — УДАЛИТЬ (Godot 4.5: 'Class hides autoload singleton')${NC}"
        SEMANTIC_ISSUES=$((SEMANTIC_ISSUES + 1))
    fi
done

# ─── 3b. Кастомные типы в сигналах autoload ──────────────────────────────
echo -e "  ${CYAN}[3b] Кастомные типы в сигналах autoload...${NC}"
# Встроенные типы, которые безопасны в сигналах autoload
BUILTIN_TYPES="int float bool String StringName Vector2 Vector3 Vector4 Color Array Dictionary Variant Node Node2D Node3D Control Resource PackedScene AudioStream Texture2D Material InputEvent Transform3D Basis AABB Plane Rect2 Rect2i Callable Signal RID Object"
for script_path in "${AUTOLOAD_SCRIPTS[@]}"; do
    while IFS= read -r sig_line; do
        # Извлекаем типы из параметров сигнала: signal foo(bar: CustomType)
        params=$(echo "$sig_line" | grep -oP ':\s*\K[A-Z][A-Za-z0-9_]+' || true)
        for param_type in $params; do
            is_builtin=false
            for bt in $BUILTIN_TYPES; do
                if [ "$param_type" = "$bt" ]; then
                    is_builtin=true
                    break
                fi
            done
            if ! $is_builtin; then
                echo -e "${RED}  ✗ ${script_path}: signal с кастомным типом '${param_type}' — не виден при парсинге (Godot 4.5)${NC}"
                echo -e "${RED}    строка: ${sig_line}${NC}"
                SEMANTIC_ISSUES=$((SEMANTIC_ISSUES + 1))
            fi
        done
    done < <(grep "^signal " "$script_path" 2>/dev/null || true)
done

# ─── 3c. Кастомные типы в var/autoload без preload ────────────────────────
echo -e "  ${CYAN}[3c] Кастомные типы в autoload без preload...${NC}"
# Дополнительные встроенные типы для var-проверки
VAR_BUILTIN_TYPES="$BUILTIN_TYPES RefCounted Timer Label Camera3D MeshInstance3D ProgressBar PanelContainer CanvasLayer AnimationPlayer AudioStreamPlayer"
for script_path in "${AUTOLOAD_SCRIPTS[@]}"; do
    # Собираем preload-алиасы
    PRELOADED=""
    while IFS= read -r preload_line; do
        alias_name=$(echo "$preload_line" | sed -n 's/const \([A-Za-z_][A-Za-z0-9_]*\).*/\1/p')
        if [ -n "$alias_name" ]; then
            PRELOADED="$PRELOADED $alias_name"
        fi
    done < <(grep "const.*:= preload" "$script_path" 2>/dev/null || true)

    while IFS= read -r var_line; do
        # Пропускаем preload-строки и строки с :=
        if echo "$var_line" | grep -q "preload("; then continue; fi

        # Извлекаем тип: var x: CustomType или const x: CustomType
        var_type=$(echo "$var_line" | sed -n 's/.*:\s*\([A-Z][A-Za-z0-9_]*\).*/\1/p' || true)
        if [ -z "$var_type" ]; then continue; fi

        # Пропускаем встроенные типы
        is_builtin=false
        for bt in $VAR_BUILTIN_TYPES; do
            if [ "$var_type" = "$bt" ]; then is_builtin=true; break; fi
        done
        if $is_builtin; then continue; fi

        # Пропускаем preload-алиасы
        is_preloaded=false
        for pa in $PRELOADED; do
            if [ "$var_type" = "$pa" ]; then is_preloaded=true; break; fi
        done
        if $is_preloaded; then continue; fi

        # Пропускаем Array[...] и Dictionary[...]
        if echo "$var_line" | grep -q "Array\["; then continue; fi
        if echo "$var_line" | grep -q "Dictionary\["; then continue; fi

        echo -e "${YELLOW}  ⚠ ${script_path}: тип '${var_type}' может быть недоступен при парсинге (Godot 4.5)${NC}"
        echo -e "${YELLOW}    строка: ${var_line}${NC}"
        echo -e "${YELLOW}    решение: добавь const XxxScript := preload(\"...\") в начало файла${NC}"
        SEMANTIC_ISSUES=$((SEMANTIC_ISSUES + 1))
    done < <(grep -E "^\s*(var|const) " "$script_path" 2>/dev/null || true)
done

# ─── 3d. Автoload-скрипты наследуют Node ────────────────────────────────
echo -e "  ${CYAN}[3d] Автoload наследует Node...${NC}"
for f in "$SCRIPTS_DIR"/autoload/*.gd; do
    if [ -f "$f" ] && ! grep -q "extends Node" "$f" 2>/dev/null; then
        echo -e "${RED}  ✗ $f: autoload должен наследовать Node${NC}"
        SEMANTIC_ISSUES=$((SEMANTIC_ISSUES + 1))
    fi
done

# ─── 3e. class_name не конфликтует со встроенными типами ──────────────────
echo -e "  ${CYAN}[3e] class_name ≠ встроенные типы Godot...${NC}"
RESERVED=("Constants" "String" "int" "float" "bool" "Array" "Dictionary" "Vector2" "Vector3" "Node" "Resource" "RefCounted" "Object")
for f in $(find "$SCRIPTS_DIR" -name "*.gd"); do
    CN=$(grep "^class_name " "$f" 2>/dev/null | sed 's/class_name //' | awk '{print $1}' 2>/dev/null) || CN=""
    for rc in "${RESERVED[@]}"; do
        if [ "$CN" = "$rc" ]; then
            echo -e "${RED}  ✗ $f: class_name '$CN' конфликтует со встроенным типом${NC}"
            SEMANTIC_ISSUES=$((SEMANTIC_ISSUES + 1))
        fi
    done
done

# ─── 3f. Версия Godot в project.godot ────────────────────────────────────
echo -e "  ${CYAN}[3f] Версия Godot в project.godot...${NC}"
GODOT_VERSION=$(grep 'config/features' "$PROJECT_DIR/project.godot" 2>/dev/null | grep -oP '"\d+\.\d+"' | tr -d '"' || echo "")
if [ "$GODOT_VERSION" != "4.5" ]; then
    echo -e "${YELLOW}  ⚠ Версия в project.godot: '${GODOT_VERSION}' (ожидается 4.5)${NC}"
    SEMANTIC_ISSUES=$((SEMANTIC_ISSUES + 1))
fi

# ─── Итоги семантики ──────────────────────────────────────────────────────
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
    echo -e "    Lint: ${LINT_ERRORS} | Формат: ${FORMAT_ISSUES} | Семантика 4.5: ${SEMANTIC_ISSUES}"
    echo -e "${CYAN}══════════════════════════════════════════════════════════════════${NC}"
    exit 1
fi
