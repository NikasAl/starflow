#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Game Design Document: Star Flow Command
A 3D space strategy game about routing spaceship streams to recolor planets.
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm, inch
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    Image, KeepTogether, HRFlowable, ListFlowable, ListItem
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# ============================================================
# FONT REGISTRATION
# ============================================================
pdfmetrics.registerFont(TTFont('Microsoft YaHei', '/usr/share/fonts/truetype/chinese/msyh.ttf'))
pdfmetrics.registerFont(TTFont('SimHei', '/usr/share/fonts/truetype/chinese/SimHei.ttf'))
pdfmetrics.registerFont(TTFont('SarasaMonoSC', '/usr/share/fonts/truetype/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('Times New Roman', '/usr/share/fonts/truetype/english/Times-New-Roman.ttf'))
pdfmetrics.registerFont(TTFont('Calibri', '/usr/share/fonts/truetype/english/calibri-regular.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))

registerFontFamily('Microsoft YaHei', normal='Microsoft YaHei', bold='Microsoft YaHei')
registerFontFamily('SimHei', normal='SimHei', bold='SimHei')
registerFontFamily('Times New Roman', normal='Times New Roman', bold='Times New Roman')
registerFontFamily('Calibri', normal='Calibri', bold='Calibri')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSans')

# ============================================================
# COLOR SCHEME
# ============================================================
TABLE_HEADER_COLOR = colors.HexColor('#1F4E79')
TABLE_HEADER_TEXT = colors.white
TABLE_ROW_EVEN = colors.white
TABLE_ROW_ODD = colors.HexColor('#F5F5F5')
ACCENT_COLOR = colors.HexColor('#2E75B6')
DARK_TEXT = colors.HexColor('#1A1A2E')
COVER_BG = colors.HexColor('#0D1B2A')

# ============================================================
# STYLES
# ============================================================
styles = getSampleStyleSheet()

cover_title_style = ParagraphStyle(
    name='CoverTitle',
    fontName='SimHei',
    fontSize=38,
    leading=48,
    alignment=TA_CENTER,
    textColor=colors.HexColor('#E0E7FF'),
    spaceAfter=20,
)

cover_subtitle_style = ParagraphStyle(
    name='CoverSubtitle',
    fontName='SimHei',
    fontSize=18,
    leading=26,
    alignment=TA_CENTER,
    textColor=colors.HexColor('#94A3B8'),
    spaceAfter=12,
)

cover_info_style = ParagraphStyle(
    name='CoverInfo',
    fontName='SimHei',
    fontSize=13,
    leading=20,
    alignment=TA_CENTER,
    textColor=colors.HexColor('#64748B'),
    spaceAfter=8,
)

h1_style = ParagraphStyle(
    name='H1',
    fontName='SimHei',
    fontSize=20,
    leading=28,
    textColor=DARK_TEXT,
    spaceBefore=18,
    spaceAfter=10,
    wordWrap='CJK',
)

h2_style = ParagraphStyle(
    name='H2',
    fontName='SimHei',
    fontSize=15,
    leading=22,
    textColor=colors.HexColor('#1F4E79'),
    spaceBefore=14,
    spaceAfter=8,
    wordWrap='CJK',
)

h3_style = ParagraphStyle(
    name='H3',
    fontName='SimHei',
    fontSize=12,
    leading=18,
    textColor=colors.HexColor('#2E75B6'),
    spaceBefore=10,
    spaceAfter=6,
    wordWrap='CJK',
)

body_style = ParagraphStyle(
    name='Body',
    fontName='SimHei',
    fontSize=10.5,
    leading=18,
    alignment=TA_LEFT,
    textColor=DARK_TEXT,
    firstLineIndent=21,
    wordWrap='CJK',
    spaceAfter=4,
)

body_no_indent = ParagraphStyle(
    name='BodyNoIndent',
    fontName='SimHei',
    fontSize=10.5,
    leading=18,
    alignment=TA_LEFT,
    textColor=DARK_TEXT,
    wordWrap='CJK',
    spaceAfter=4,
)

bullet_style = ParagraphStyle(
    name='Bullet',
    fontName='SimHei',
    fontSize=10.5,
    leading=18,
    alignment=TA_LEFT,
    textColor=DARK_TEXT,
    leftIndent=24,
    bulletIndent=12,
    wordWrap='CJK',
    spaceAfter=3,
)

code_style = ParagraphStyle(
    name='Code',
    fontName='DejaVuSans',
    fontSize=8.5,
    leading=13,
    alignment=TA_LEFT,
    textColor=colors.HexColor('#D4D4D4'),
    backColor=colors.HexColor('#1E1E1E'),
    leftIndent=12,
    rightIndent=12,
    spaceBefore=4,
    spaceAfter=4,
    borderPadding=6,
)

tbl_header = ParagraphStyle(
    name='TblHeader',
    fontName='SimHei',
    fontSize=10,
    leading=14,
    alignment=TA_CENTER,
    textColor=colors.white,
    wordWrap='CJK',
)

tbl_cell = ParagraphStyle(
    name='TblCell',
    fontName='SimHei',
    fontSize=9.5,
    leading=14,
    alignment=TA_CENTER,
    textColor=DARK_TEXT,
    wordWrap='CJK',
)

tbl_cell_left = ParagraphStyle(
    name='TblCellLeft',
    fontName='SimHei',
    fontSize=9.5,
    leading=14,
    alignment=TA_LEFT,
    textColor=DARK_TEXT,
    wordWrap='CJK',
)

caption_style = ParagraphStyle(
    name='Caption',
    fontName='SimHei',
    fontSize=9,
    leading=14,
    alignment=TA_CENTER,
    textColor=colors.HexColor('#555555'),
    spaceBefore=3,
    spaceAfter=6,
    wordWrap='CJK',
)


# ============================================================
# HELPER FUNCTIONS
# ============================================================
def h1(text):
    return Paragraph(f'<b>{text}</b>', h1_style)

def h2(text):
    return Paragraph(f'<b>{text}</b>', h2_style)

def h3(text):
    return Paragraph(f'<b>{text}</b>', h3_style)

def p(text):
    return Paragraph(text, body_style)

def pni(text):
    return Paragraph(text, body_no_indent)

def bullet(text):
    return Paragraph(f'<bullet>&bull;</bullet> {text}', bullet_style)

def make_table(headers, rows, col_widths=None):
    """Create a standardized table."""
    data = []
    header_row = [Paragraph(f'<b>{h}</b>', tbl_header) for h in headers]
    data.append(header_row)
    for row in rows:
        data.append([Paragraph(str(c), tbl_cell) for c in row])

    if col_widths is None:
        col_widths = [None] * len(headers)

    tbl = Table(data, colWidths=col_widths, repeatRows=1)
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CCCCCC')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    tbl.setStyle(TableStyle(style_cmds))
    return tbl


def code_block(text):
    """Create a code block."""
    return Paragraph(text.replace('\n', '<br/>').replace('  ', '&nbsp;&nbsp;'), code_style)


# ============================================================
# BUILD DOCUMENT
# ============================================================
output_path = '/home/z/my-project/download/Star_Flow_Command_GDD.pdf'

doc = SimpleDocTemplate(
    output_path,
    pagesize=A4,
    title='Star Flow Command - Game Design Document',
    author='Z.ai',
    creator='Z.ai',
    subject='Game design document for a 3D space strategy game about routing spaceship streams',
    leftMargin=2.2*cm,
    rightMargin=2.2*cm,
    topMargin=2.5*cm,
    bottomMargin=2.5*cm,
)

story = []

# ============================================================
# COVER PAGE
# ============================================================
story.append(Spacer(1, 100))
story.append(Paragraph('<b>STAR FLOW COMMAND</b>', cover_title_style))
story.append(Spacer(1, 16))
story.append(HRFlowable(width="60%", thickness=2, color=colors.HexColor('#2E75B6'),
                         spaceAfter=16, spaceBefore=0, hAlign='CENTER'))
story.append(Paragraph('<b>Game Design Document</b>', cover_subtitle_style))
story.append(Spacer(1, 30))
story.append(Paragraph('3D-<font name="Times New Roman">Space Strategy / Stream Routing Puzzle</font>', cover_info_style))
story.append(Spacer(1, 8))
story.append(Paragraph('<font name="Times New Roman">Godot 4.3 + GDScript</font>', cover_info_style))
story.append(Spacer(1, 50))
story.append(Paragraph('<font name="Times New Roman">2026</font>', cover_info_style))
story.append(PageBreak())

# ============================================================
# TABLE OF CONTENTS
# ============================================================
story.append(Spacer(1, 20))
story.append(Paragraph('<b>Contents</b>', h1_style))
story.append(Spacer(1, 12))

toc_items = [
    ('1', 'Overview'),
    ('1.1', 'Concept Summary'),
    ('1.2', 'Genre and Target Audience'),
    ('1.3', 'Unique Selling Points'),
    ('2', 'Core Mechanics'),
    ('2.1', 'Planet System'),
    ('2.2', 'Ship Stream System'),
    ('2.3', 'Combat and Recoloring'),
    ('2.4', 'Stream Routing (Player Input)'),
    ('3', 'Game Loop and Win Conditions'),
    ('3.1', 'Level Structure'),
    ('3.2', 'Win / Lose Conditions'),
    ('3.3', 'Scoring System'),
    ('4', 'AI Opponents'),
    ('4.1', 'Behavior Trees'),
    ('4.2', 'Difficulty Profiles'),
    ('5', '3D Space and Camera'),
    ('5.1', 'Level Layout'),
    ('5.2', 'Camera Controls'),
    ('5.3', 'Visual Feedback'),
    ('6', 'Level Design Progression'),
    ('7', 'Technical Architecture'),
    ('7.1', 'Godot Scene Tree'),
    ('7.2', 'Core Classes'),
    ('7.3', 'State Machine'),
    ('8', 'UI / UX Design'),
    ('9', 'Balance Parameters'),
    ('10', 'Development Roadmap'),
]

toc_style = ParagraphStyle(
    name='TOC',
    fontName='SimHei',
    fontSize=11,
    leading=20,
    alignment=TA_LEFT,
    textColor=DARK_TEXT,
    wordWrap='CJK',
)

toc_indent_style = ParagraphStyle(
    name='TOCIndent',
    fontName='SimHei',
    fontSize=10,
    leading=18,
    alignment=TA_LEFT,
    textColor=colors.HexColor('#444444'),
    leftIndent=20,
    wordWrap='CJK',
)

for num, title in toc_items:
    if '.' not in num:
        story.append(Paragraph(f'<b>{num}. {title}</b>', toc_style))
    else:
        story.append(Paragraph(f'{num} {title}', toc_indent_style))

story.append(PageBreak())

# ============================================================
# 1. OVERVIEW
# ============================================================
story.append(h1('1. Overview'))

story.append(h2('1.1 Concept Summary'))
story.append(p(
    '<font name="Times New Roman">Star Flow Command</font> '
    '- 3D-стратегия в реальном времени, в которой игрок управляет потоками космических кораблей '
    'между планетами с целью перекрасить всю галактику в свой цвет. Каждая планета имеет '
    'целочисленный уровень и принадлежит одному из игроков (человеку или ИИ). '
    'Корабли непрерывно генерируются захваченными планетами и летят по назначению '
    'в виде динамических потоков. Задача игрока - коммутация этих потоков, выбор '
    'целей атаки и обороны, чтобы захватить все планеты на уровне до того, как '
    'противник сделает то же самое.'
))
story.append(p(
    'Игровой процесс строится на принципе "потоковой логистики": игрок не управляет '
    'отдельными кораблями, а перенаправляет целые потоки (аналог коммутатора в '
    'сети передачи данных). Это создает уникальное сочетание стратегического планирования '
    'и динамического реагирования в реальном времени. Визуализация потоков кораблей '
    'в 3D-пространстве создает эффект живого, пульсирующего космоса, где линии '
    'кораблей напоминают нервные импульсы, соединяющие планеты.'
))

story.append(h2('1.2 Genre and Target Audience'))
story.append(p(
    'Жанр: 3D-стратегия реального времени с элементами головоломки. '
    'Целевая аудитория: игроки, предпочитающие стратегическое планирование, '
    'но не требующие глубокого микроменеджмента (как в классических RTS). '
    'Оптимальная продолжительность уровня: 3-10 минут для одиночной миссии, '
    'до 30 минут для масштабных карт. Платформы: <font name="Times New Roman">PC</font>, '
    '<font name="Times New Roman">macOS</font>, <font name="Times New Roman">Linux</font>, '
    'с возможностью портирования на мобильные устройства. Управление мышью и клавиатурой '
    '(для <font name="Times New Roman">PC</font>), сенсорное управление (для мобильных).'
))

story.append(h2('1.3 Unique Selling Points'))
story.append(bullet('<b>Потоковая механика</b>: вместо управления отдельными юнитами игрок перенаправляет непрерывные потоки кораблей, создавая динамичную и визуально выразительную картину боевых действий в реальном времени.'))
story.append(bullet('<b>3D-пространство</b>: планеты расположены в трехмерном пространстве, потоки кораблей прокладываются через объем, создавая уникальную геометрию атак и маршрутизацию.'))
story.append(bullet('<b>Минималистичное управление</b>: клик-и-тяните для создания маршрута потока, интуитивный интерфейс позволяет быстро освоить базовые механики за первые минуты игры.'))
story.append(bullet('<b>Процедурная генерация уровней</b>: каждый запуск предлагает новую конфигурацию планет, расстояний и начальных условий, обеспечивая высокую реиграбельность.'))
story.append(bullet('<b>Многоуровневый ИИ</b>: от пассивных до агрессивных стратегий поведения противника с адаптацией к действиям игрока в рамках каждого уровня.'))

# ============================================================
# 2. CORE MECHANICS
# ============================================================
story.append(Spacer(1, 18))
story.append(h1('2. Core Mechanics'))

story.append(h2('2.1 Planet System'))
story.append(p(
    'Планета - основной объект игрового мира. Каждая планета характеризуется набором '
    'свойств, которые определяют ее стратегическую ценность, уязвимость и производственный '
    'потенциал. Планеты генерируются для каждого уровня и располагаются в трехмерном '
    'пространстве с произвольным распределением по осям X, Y и Z. Форма планеты '
    'визуализируется как сфера с наложенным кольцом (кольцо показывает текущий уровень '
    'и цвет владельца), а размер сферы пропорционален максимальному уровню планеты.'
))

story.append(Spacer(1, 10))
story.append(make_table(
    ['Parameter', 'Type', 'Description'],
    [
        ['position', 'Vector3', 'Position in 3D space (x, y, z)'],
        ['owner', 'PlayerId', 'Current owner (none / player / AI)'],
        ['level', 'int', 'Current defense/production level'],
        ['max_level', 'int', 'Maximum possible level'],
        ['production_rate', 'float', 'Ships per second generated'],
        ['color', 'Color', 'Owner color (visual indicator)'],
        ['radius', 'float', 'Visual radius proportional to max_level'],
    ],
    col_widths=[3.2*cm, 2.5*cm, 10.5*cm]
))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Table 1.</b> Planet attributes', caption_style))
story.append(Spacer(1, 12))

story.append(h3('2.1.1 Level Mechanics'))
story.append(p(
    'Уровень планеты является одновременно показателем защиты и производства. '
    'Каждый уровень соответствует одному кораблю в "гарнизоне" планеты. Когда корабль '
    'достигает вражеской планеты, он уменьшает ее уровень на единицу. Когда уровень '
    'достигает нуля, планета перекрашивается в цвет атакующего, и последующие корабли '
    'начинают увеличивать уровень уже для нового владельца. Это создает глубокую '
    'стратегическую динамику: планета с высоким уровнем - мощная крепость, но она '
    'также генерирует больше кораблей в секунду, что можно обратить против ее же '
    'владельца, захватив планету с наработанным производственным потенциалом.'
))
story.append(p(
    'Производственная формула: уровень генерации кораблей напрямую зависит от текущего '
    'уровня планеты. Базовая производительность составляет <font name="Times New Roman">0.2 + level * 0.1</font> '
    'кораблей в секунду. Таким образом, планета уровня 1 генерирует 0.3 корабля/сек, '
    'а планета уровня 10 - 1.2 корабля/сек. Это означает, что захват высокоуровневой '
    'планеты дает значительное преимущество в темпе производства, создавая "снежный ком" '
    'для того, кто успешно развивает наступление. Баланс достигается за счет того, что '
    'высокий уровень также означает больше кораблей нужно потратить на захват.'
))

story.append(h2('2.2 Ship Stream System'))
story.append(p(
    'Корабли не существуют как индивидуальные объекты с собственной логикой. '
    'Вместо этого они организуются в "потоки" - непрерывные линии кораблей, '
    'движущихся от планеты-источника к планете-назначению. Каждый поток '
    'характеризуется источником, целью и скоростью движения. Количество кораблей '
    'в потоке определяется производственной скоростью планеты-источника. '
    'Визуально поток представляет собой цепочку мелких светящихся точек (кораблей), '
    'движущихся по кривой Безье в 3D-пространстве с изгибом по оси Y, чтобы '
    'создать эффект полета по дуге через пространство.'
))

story.append(Spacer(1, 10))
story.append(make_table(
    ['Stream Parameter', 'Value', 'Note'],
    [
        ['Ship speed', '5-15 units/s', 'Depends on distance'],
        ['Bezier offset', '0.3 * distance', 'Vertical arc height'],
        ['Visual spacing', '0.5 units', 'Between ships in stream'],
        ['Max simultaneous streams', 'Unlimited', 'Per planet'],
        ['Redirect delay', '1.5s', 'Buffer time on reroute'],
    ],
    col_widths=[4.5*cm, 3*cm, 8.5*cm]
))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Table 2.</b> Stream parameters', caption_style))
story.append(Spacer(1, 12))

story.append(p(
    'Когда игрок перенаправляет поток, уже вылетевшие корабли продолжают движение '
    'к прежней цели, а новые корабли начинаются от источника к новой цели. '
    'Период перенаправления (1.5 секунды) создает стратегическое окно, в котором '
    'нельзя мгновенно отреагировать на изменение ситуации, что добавляет '
    'элемент предвидения и планирования в игровой процесс. Потоки визуализируются '
    'с помощью системы частиц: каждый корабль - маленький светящийся объект '
    'с коротким следом (trail), цвет которого соответствует владельцу.'
))

story.append(h2('2.3 Combat and Recoloring'))
story.append(p(
    'Боевая система предельно проста, но стратегически глубока. Каждый корабль '
    'представляет собой единичную боевую единицу. При прибытии вражеского корабля '
    'на планету происходит следующая последовательность событий, которая '
    'определяет результат столкновения и изменение состояния планеты. '
    'Механика устроена так, чтобы численное преимущество всегда побеждало, '
    'но стратегическое распределение сил по фронтам может переломить ситуацию.'
))

story.append(Spacer(1, 10))
story.append(make_table(
    ['Situation', 'Condition', 'Result'],
    [
        ['Attack neutral', 'Planet level > 0', 'Level decreases by 1'],
        ['Capture neutral', 'Planet level = 0', 'Planet recolored, level +1'],
        ['Attack enemy', 'Planet level > 0', 'Level decreases by 1'],
        ['Capture enemy', 'Planet level = 0', 'Planet recolored, level +1'],
        ['Friendly arrive', 'Same owner', 'Level increases by 1'],
        ['Overflow', 'Level >= max_level', 'Excess ships lost'],
    ],
    col_widths=[3.2*cm, 3.8*cm, 9*cm]
))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Table 3.</b> Combat resolution rules', caption_style))
story.append(Spacer(1, 12))

story.append(p(
    'Ключевая стратегическая концепция: планета не может быть захвачена '
    '"за один рейс" - для этого нужно послать больше кораблей, чем текущий '
    'уровень защиты. Однако непрерывный поток может постепенно "обескровить" '
    'защиту врага, пока планета не перейдет под контроль атакующего. '
    'Двойные столкновения (когда корабли обоих игроков прибывают одновременно) '
    'обрабатываются попарно: один вражеский корабль нейтрализует один '
    'корабль защитника, уменьшая уровень планеты на 1. Если вражеских '
    'кораблей больше, остаток продолжает уменьшать уровень.'
))

story.append(h2('2.4 Stream Routing (Player Input)'))
story.append(p(
    'Основное взаимодействие игрока с игрой - перенаправление потоков кораблей. '
    'Механика управления спроектирована максимально интуитивно, чтобы игрок '
    'мог быстро принимать решения в условиях реального времени, не отвлекаясь '
    'на сложный интерфейс. Управление строится на принципе "нажми и потяни", '
    'аналогично прокладке маршрутов в стратегических картах.'
))

story.append(h3('2.4.1 Input Sequence'))
story.append(bullet('<b>Шаг 1 - Выбор источника</b>: клик по своей планете выделяет ее (визуальная подсветка, пульсирующий контур). На панели появляется информация о текущем уровне, производительности и существующих потоках.'))
story.append(bullet('<b>Шаг 2 - Выбор цели</b>: клик по другой планете (любой) назначает ее целью для потока. Появляется линия предварительного просмотра маршрута (пунктирная кривая Безье в 3D-пространстве).'))
story.append(bullet('<b>Шаг 3 - Подтверждение</b>: отпускание кнопки мыши создает поток. Если была нажата Shift, поток добавляется к существующим; иначе - заменяет текущий основной поток планеты-источника.'))
story.append(bullet('<b>Альтернатива - Drag and Drop</b>: зажать кнопку на своей планете и перетащить на цель. Линия маршрута отображается в реальном времени во время перетаскивания.'))

story.append(p(
    'Для управления на мобильных устройствах предусмотрены аналогичные жесты: '
    'тап по планете для выделения, тап по цели для создания потока, либо '
    'длительное нажатие и перетаскивание. На мобильной версии добавляется '
    'двойной тап для приближения к выбранной планете и кнопки масштабирования '
    'для навигации по 3D-пространству.'
))

# ============================================================
# 3. GAME LOOP AND WIN CONDITIONS
# ============================================================
story.append(Spacer(1, 18))
story.append(h1('3. Game Loop and Win Conditions'))

story.append(h2('3.1 Level Structure'))
story.append(p(
    'Каждый уровень представляет собой изолированную сессию с фиксированным '
    'набором планет, начальным распределением цветов и уровней, а также '
    'количеством и типом ИИ-противников. Уровни организованы в кампанию '
    'с нарастающей сложностью и вводом новых механик. Параллельно доступен '
    'режим "процедурной битвы" - случайная генерация конфигурации с '
    'настраиваемыми параметрами (количество планет, число ИИ, размер карты).'
))

story.append(Spacer(1, 10))
story.append(make_table(
    ['Stage', 'Planets', 'AI Opponents', 'New Mechanic', 'Avg. Time'],
    [
        ['Tutorial 1', '3', '0', 'Basic routing', '1-2 min'],
        ['Tutorial 2', '4', '1 (passive)', 'Combat basics', '2-3 min'],
        ['Level 1', '5-7', '1', 'Multiple streams', '3-5 min'],
        ['Level 2', '8-10', '1 (aggressive)', 'Stream splitting', '4-6 min'],
        ['Level 3', '10-12', '2', 'Alliances', '5-8 min'],
        ['Level 4', '12-15', '2 (coordinated)', 'Bottleneck maps', '6-10 min'],
        ['Level 5+', '15-25', '2-3', 'Special planets', '8-15 min'],
    ],
    col_widths=[2.5*cm, 2.2*cm, 3.5*cm, 3.5*cm, 2.5*cm]
))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Table 4.</b> Level progression', caption_style))
story.append(Spacer(1, 12))

story.append(h2('3.2 Win / Lose Conditions'))
story.append(p(
    'Условие победы в каждом уровне едино и прозрачно: игрок должен '
    'захватить все планеты на карте, перекрасив их в свой цвет. '
    'Условие поражения симметрично: если любой ИИ-противник захватывает '
    'все планеты (включая те, что были у игрока), уровень считается '
    'проигранным. В режиме с несколькими ИИ-противниками уровень '
    'продолжается, пока все планеты не окажутся под контролем одного '
    'фракции (игрока или одного из ИИ).'
))
story.append(p(
    'Дополнительные условия, которые могут быть добавлены для '
    'достижения звездных наград в кампании: '
    'завершение уровня за определенное время (бонус за скорость), '
    'минимизация потерь кораблей (бонус за эффективность), '
    'захват всех планет без потери ни одной своей (идеальная победа). '
    'Эти дополнительные цели не обязательны для прохождения уровня, '
    'но стимулируют повторное прохождение для совершенствования стратегии.'
))

story.append(h2('3.3 Scoring System'))
story.append(p(
    'Система подсчета очков работает параллельно с основным игровым процессом '
    'и не влияет на условия победы/поражения. Очки начисляются за каждую '
    'захваченную планету (базовые очки = максимальный уровень планеты * 100), '
    'за скорость прохождения уровня (бонус до 50% от базовых очков за время '
    'ниже порогового), за удержание максимального количества планет '
    'одновременно (пиковый контроль) и за каждый уничтоженный вражеский '
    'корабль (1 очко). Итоговый рейтинг уровня состоит из суммы всех '
    'компонентов и отображается в таблице рекордов.'
))

# ============================================================
# 4. AI OPPONENTS
# ============================================================
story.append(Spacer(1, 18))
story.append(h1('4. AI Opponents'))

story.append(h2('4.1 Behavior Trees'))
story.append(p(
    'ИИ-противники построены на основе дерева поведения (behavior tree), '
    'которое определяет приоритеты и стратегии в зависимости от текущей '
    'ситуации на карте. Дерево поведения оценивает состояние каждые '
    '0.5 секунды и принимает решение о перенаправлении потоков. '
    'Архитектура ИИ модульная: каждое "листье" дерева - отдельная '
    'стратегическая функция, что позволяет легко создавать новые '
    'профили поведения, комбинируя различные листья.'
))

story.append(h3('4.1.1 Decision Nodes'))
story.append(bullet('<b>Evaluate Threats</b>: анализ ближайших вражеских потоков, определение планет под угрозой захвата в ближайшие 5-10 секунд на основе расстояния и количества кораблей в потоке.'))
story.append(bullet('<b>Evaluate Opportunities</b>: поиск нейтральных или вражеских планет с низким уровнем, которые можно захватить с минимальными затратами.'))
story.append(bullet('<b>Expand</b>: отправка потока с наиболее развитой планеты на ближайшую нейтральную или слабо защищенную вражескую планету для расширения территории.'))
story.append(bullet('<b>Defend</b>: перенаправление потока на свою планету, находящуюся под угрозой захвата, с приоритетом по уровню угрозы и стратегической ценности планеты.'))
story.append(bullet('<b>Consolidate</b>: сбор потоков с нескольких планет на одну ключевой планету для создания мощного ударного кулака, направляемого на важную цель.'))
story.append(bullet('<b>Harass</b>: отправка небольших потоков по нескольким направлениям одновременно, чтобы распылить силы противника и заставить его постоянно перенаправлять защиту.'))

story.append(h2('4.2 Difficulty Profiles'))
story.append(p(
    'Каждый ИИ-противник имеет профиль сложности, который определяет '
    'частоту принятия решений, качество оценки ситуации и склонность '
    'к определенным стратегиям. Профили настроены так, чтобы '
    'обеспечить плавное нарастание сложности в кампании и разнообразие '
    'игрового опыта. На более высоких уровнях сложности ИИ принимает '
    'решения чаще, точнее оценивает ситуацию и способен к более '
    'сложным многошаговым стратегиям.'
))

story.append(Spacer(1, 10))
story.append(make_table(
    ['Profile', 'Decision Interval', 'Strategy', 'Weakness'],
    [
        ['Passive', '3-5s', 'Defend only', 'Never attacks first'],
        ['Balanced', '1.5-2s', 'Expand + Defend', 'Predictable patterns'],
        ['Aggressive', '0.8-1.2s', 'Rapid expansion', 'Overextends'],
        ['Tactical', '0.5-0.8s', 'Mixed + adapt', 'Requires CPU'],
        ['Coordinated', '0.5s', 'Multi-AI synergy', 'Rare on easy maps'],
    ],
    col_widths=[3*cm, 3.2*cm, 4*cm, 5.8*cm]
))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Table 5.</b> AI difficulty profiles', caption_style))
story.append(Spacer(1, 12))

story.append(p(
    'В режиме "координированного" ИИ несколько противников обмениваются '
    'информацией о состоянии карты через общее хранилище данных и '
    'координируют атаки: один ИИ отвлекает игрока на одном фронте, '
    'пока другой наносит основной удар на другом. Это создает '
    'значительный вызов даже для опытных игроков и используется '
    'только на поздних уровнях кампании. Координация реализуется '
    'через систему "флагов": ИИ-лидер помечает цель как приоритетную, '
    'а остальные ИИ направляют часть потоков на поддержку атаки.'
))

# ============================================================
# 5. 3D SPACE AND CAMERA
# ============================================================
story.append(Spacer(1, 18))
story.append(h1('5. 3D Space and Camera'))

story.append(h2('5.1 Level Layout'))
story.append(p(
    'Игровое пространство представляет собой кубическую область с размерами, '
    'зависящими от количества планет на уровне. Планеты размещаются в 3D '
    'с использованием алгоритма, обеспечивающего минимальное расстояние '
    'между любыми двумя планетами (для предотвращения визуального наложения) '
    'и разнообразие пространственных конфигураций. Алгоритм размещения '
    'основан на пуассоновском дисковом сэмплинге (Poisson Disk Sampling) '
    'с модификацией для трехмерного случая.'
))

story.append(Spacer(1, 10))
story.append(make_table(
    ['Map Size', 'Planet Count', 'Min Distance', 'Play Volume'],
    [
        ['Small', '3-6', '8 units', '50 x 50 x 30'],
        ['Medium', '7-12', '10 units', '80 x 80 x 40'],
        ['Large', '13-20', '12 units', '120 x 120 x 50'],
        ['Huge', '21-30', '15 units', '160 x 160 x 60'],
    ],
    col_widths=[3*cm, 3*cm, 3.2*cm, 6.5*cm]
))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Table 6.</b> Map size parameters', caption_style))
story.append(Spacer(1, 12))

story.append(p(
    'Визуально пространство заполнено фоном из звёздного поля с параллакс-эффектом '
    'при вращении камеры. Некоторые уровни могут содержать декоративные элементы: '
    'туманности (полупрозрачные объемные облака), астероидные поля (невзаимодействующие '
    'объекты, добавляющие атмосферу), цветные газовые облака. Эти элементы '
    'используются для создания уникальной атмосферы каждого уровня и помогают '
    'игроку ориентироваться в пространстве, служа визуальными ориентирами.'
))

story.append(h2('5.2 Camera Controls'))
story.append(p(
    'Камера управляется с помощью мыши и предоставляет игроку '
    'полный обзор 3D-пространства. Реализована система орбитальной камеры, '
    'которая вращается вокруг центра карты (или выбранной планеты) '
    'с ограничениями по углу наклона и масштабу. Это позволяет '
    'оценивать ситуацию с любого ракурса, что критически важно '
    'при наличии нескольких фронтов боевых действий на разных глубинах '
    '3D-пространства.'
))

story.append(bullet('<b>Вращение</b>: зажать правую кнопку мыши + движение курсора. Камера вращается вокруг точки фокуса (центр карты или выбранная планета).'))
story.append(bullet('<b>Масштаб</b>: колесо мыши. Приближение от 10 до 200 единиц от центра. Автоматический предел приближения, исключающий прохождение сквозь планеты.'))
story.append(bullet('<b>Панорамирование</b>: зажать среднюю кнопку мыши + движение. Сдвигает точку фокуса камеры в плоскости XY.'))
story.append(bullet('<b>Фокус на планете</b>: двойной клик по планете. Камера плавно перемещается и центрируется на выбранной планете с оптимальным расстоянием обзора.'))
story.append(bullet('<b>Обзорный режим</b>: нажатие клавиши "Space" возвращает камеру к обзору всей карты с оптимального ракурса.'))

story.append(h2('5.3 Visual Feedback'))
story.append(p(
    'Система визуальной обратной связи обеспечивает информативность '
    'игрового процесса и мгновенное понимание происходящего. Каждый '
    'игровое событие сопровождается визуальным эффектом, позволяющим '
    'игроку оценивать ситуацию даже без детального анализа числовых '
    'показателей. Цветовая кодировка является основным средством '
    'передачи информации: каждый игрок (человек или ИИ) имеет свой '
    'уникальный цвет, который отображается на планетах, потоках кораблей '
    'и элементах интерфейса.'
))

story.append(bullet('<b>Захват планеты</b>: вспышка цвета нового владельца, расширяющаяся волна, рассыпающиеся частицы старого цвета, краткая анимация пульсации.'))
story.append(bullet('<b>Урон планете</b>: мигание планеты, уменьшение визуального размера кольца уровня, искры при попадании каждого корабля.'))
story.append(bullet('<b>Поток кораблей</b>: светящиеся частицы с цветным следом, плотность потока визуально отражает интенсивность производства (больше кораблей = плотнее линия).'))
story.append(bullet('<b>Угроза</b>: планеты под угрозой захвата получают красную пульсирующую подсветку с интенсивностью, пропорциональной уровню угрозы.'))
story.append(bullet('<b>Выбор/выделение</b>: при наведении курсора планета подсвечивается. При выделении появляется информационная панель с деталями и анимированный контур.'))

# ============================================================
# 6. LEVEL DESIGN PROGRESSION
# ============================================================
story.append(Spacer(1, 18))
story.append(h1('6. Level Design Progression'))
story.append(p(
    'Кампания состоит из 30+ уровней, организованных в 5 глав по тематике '
    'и вводимым механикам. Каждая глава обучает игрока новому аспекту '
    'игры, постепенно усложняя задачи и вводя новые элементы. '
    'Внутри главы уровни следуют от простых к сложным с нарастающим '
    'количеством планет, более агрессивным ИИ и более сложными '
    'пространственными конфигурациями. Параллельно с кампанией '
    'доступен режим бесконечной игры с процедурной генерацией уровней.'
))

story.append(Spacer(1, 10))
story.append(make_table(
    ['Chapter', 'Theme', 'Levels', 'Focus'],
    [
        ['1: First Light', 'Basic mechanics', '1-6', 'Learning routing'],
        ['2: Nebula Wars', 'Combat focus', '7-12', 'Multi-front combat'],
        ['3: Deep Space', '3D tactics', '13-18', 'Vertical depth'],
        ['4: Alliance', 'Diplomacy', '19-24', 'Multi-AI dynamics'],
        ['5: Conquest', 'Full scale', '25-30', 'Mastery challenge'],
    ],
    col_widths=[3.5*cm, 3*cm, 2.2*cm, 7*cm]
))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Table 7.</b> Campaign chapters', caption_style))
story.append(Spacer(1, 12))

story.append(p(
    'Глава 1 обучает базовым механикам: как перенаправлять потоки, '
    'как происходит захват планет, как читать информацию на экране. '
    'Первые три уровня - интерактивный туториал с подсказками, '
    'показывающими, куда кликать и что делать. Глава 2 фокусируется '
    'на боевых аспектах: игрок учится управлять несколькими фронтами, '
    'распределять силы и выбирать приоритетные цели. '
    'Глава 3 использует вертикальное измерение 3D-пространства, '
    'заставляя игрока учитывать глубину при планировании маршрутов. '
    'Главы 4 и 5 вводят многократные ИИ-противников и требуют '
    'от игрока мастерского понимания всех механик игры.'
))

# ============================================================
# 7. TECHNICAL ARCHITECTURE
# ============================================================
story.append(Spacer(1, 18))
story.append(h1('7. Technical Architecture'))

story.append(h2('7.1 Godot Scene Tree'))
story.append(p(
    'Проект реализован на движке <font name="Times New Roman">Godot 4.3</font> '
    'с использованием <font name="Times New Roman">GDScript</font> как основного '
    'языка разработки. Выбор <font name="Times New Roman">Godot</font> обусловлен '
    'встроенной поддержкой 3D-рендеринга, эффективной системой частиц, '
    'кроссплатформенностью и открытой лицензией <font name="Times New Roman">MIT</font>. '
    'Архитектура сцены построена по принципу иерархических узлов с четким '
    'разделением ответственности между компонентами. '
    'Корневой узел сцены содержит все основные подсистемы.'
))

story.append(Spacer(1, 8))
story.append(code_block(
    'Main (Node3D)<br/>'
    '|-- World (Node3D) - container for all game objects<br/>'
    '|   |-- Planets (Node3D) - all planet instances<br/>'
    '|   |   |-- Planet1 (Planet3D) - individual planet<br/>'
    '|   |   |-- Planet2 (Planet3D)<br/>'
    '|   |   +-- ...<br/>'
    '|   |-- Streams (Node3D) - all ship stream instances<br/>'
    '|   |   |-- Stream1 (ShipStream3D)<br/>'
    '|   |   +-- ...<br/>'
    '|   +-- Effects (Node3D) - visual effects container<br/>'
    '|-- CameraRig (CameraController) - orbital camera<br/>'
    '|-- UI (CanvasLayer) - HUD and menus<br/>'
    '|-- GameManager (Node) - game state controller<br/>'
    '|-- AIManager (Node) - AI decision system<br/>'
    '+-- AudioPlayer (Node) - sound effects manager'
))
story.append(Spacer(1, 12))

story.append(h2('7.2 Core Classes'))
story.append(p(
    'Архитектура игры построена на наборе ключевых классов, каждый из которых '
    'отвечает за определенный аспект игрового процесса. Классы взаимодействуют '
    'через систему сигналов <font name="Times New Roman">Godot</font>, '
    'обеспечивая слабую связанность и легкость тестирования. '
    'Ниже описаны основные классы и их обязанности, образующие '
    'фундамент всей игровой логики.'
))

story.append(Spacer(1, 10))
story.append(make_table(
    ['Class', 'Type', 'Responsibility'],
    [
        ['Planet3D', 'Node3D', 'Planet rendering, level display, capture animation'],
        ['ShipStream3D', 'Node3D', 'Bezier path, ship particles, movement logic'],
        ['GameManager', 'Node', 'Game state, turn processing, win/lose check'],
        ['AIController', 'Node', 'Behavior tree, decision making, evaluation'],
        ['CameraController', 'Node3D', 'Orbital camera, zoom, pan, focus'],
        ['LevelGenerator', 'Node', 'Procedural map creation, balancing'],
        ['StreamManager', 'Node', 'Route tracking, collision detection'],
        ['AudioManager', 'Node', 'Sound effects, ambient music control'],
        ['UIManager', 'CanvasLayer', 'HUD, planet info panel, menu screens'],
    ],
    col_widths=[3.5*cm, 2.2*cm, 10.5*cm]
))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Table 8.</b> Core class architecture', caption_style))
story.append(Spacer(1, 12))

story.append(h3('7.2.1 Planet3D Class'))
story.append(p(
    'Класс <font name="Times New Roman">Planet3D</font> является центральным '
    'игровым объектом. Он унаследован от <font name="Times New Roman">Node3D</font> '
    'и содержит <font name="Times New Roman">MeshInstance3D</font> для сферы планеты, '
    '<font name="Times New Roman">MeshInstance3D</font> для кольца уровня, '
    '<font name="Times New Roman">GPUParticles3D</font> для атмосферного эффекта, '
    '<font name="Times New Roman">Area3D</font> для детекции попадания кораблей '
    'и <font name="Times New Roman">Label3D</font> для отображения уровня. '
    'Планета излучает сигналы: <font name="Times New Roman">level_changed(new_level)</font>, '
    '<font name="Times New Roman">owner_changed(new_owner)</font>, '
    '<font name="Times New Roman">ship_arrived(stream)</font>. '
    'Метод <font name="Times New Roman">_process(delta)</font> отвечает за '
    'генерацию кораблей (инкремент внутреннего счетчика, создание нового '
    'корабля при достижении порога) и визуальную анимацию вращения.'
))

story.append(h3('7.2.2 ShipStream3D Class'))
story.append(p(
    'Класс <font name="Times New Roman">ShipStream3D</font> управляет потоком '
    'кораблей между двумя планетами. Он использует <font name="Times New Roman">Path3D</font> '
    'с кривой Безье для определения маршрута, '
    '<font name="Times New Roman">GPUParticles3D</font> для визуализации кораблей '
    'и <font name="Times New Roman">MeshInstance3D</font> (тонкая полупрозрачная линия) '
    'для отображения трассы маршрута. Скорость движения зависит от дистанции: '
    'базовая скорость = <font name="Times New Roman">5 + distance * 0.1</font> '
    'единиц в секунду, но ограничена максимумом 15 единиц/сек для '
    'предотвращения слишком быстрого перемещения на малых дистанциях.'
))

story.append(h2('7.3 State Machine'))
story.append(p(
    'Игровой процесс управляется конечным автоматом (state machine) '
    'с следующими состояниями, каждое из которых определяет, '
    'какие системы активны и как обрабатывается пользовательский ввод. '
    'Переходы между состояниями инициируются как игроком, так и '
    'внутренними событиями игры (победа, поражение, пауза). '
    'Конечный автомат реализован в классе '
    '<font name="Times New Roman">GameManager</font> '
    'и использует паттерн "состояние" с инкапсуляцией логики '
    'каждого состояния в отдельные методы.'
))

story.append(Spacer(1, 10))
story.append(make_table(
    ['State', 'Description', 'Active Systems'],
    [
        ['MENU', 'Main menu / level select', 'UI, Audio'],
        ['TUTORIAL', 'Guided level with hints', 'All + Tutorial overlay'],
        ['PLAYING', 'Active gameplay', 'All systems'],
        ['PAUSED', 'Game frozen, menu open', 'UI only'],
        ['VICTORY', 'Level complete, stats', 'UI, Audio'],
        ['DEFEAT', 'Level lost, retry option', 'UI, Audio'],
    ],
    col_widths=[2.8*cm, 5*cm, 8.2*cm]
))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Table 9.</b> Game state machine', caption_style))
story.append(Spacer(1, 12))

# ============================================================
# 8. UI / UX DESIGN
# ============================================================
story.append(Spacer(1, 18))
story.append(h1('8. UI / UX Design'))
story.append(p(
    'Пользовательский интерфейс спроектирован по принципу минимализма: '
    'основная информация отображается непосредственно в 3D-мире '
    '(уровни планет, цвет владельца, направления потоков), '
    'а <font name="Times New Roman">HUD</font> содержит только '
    'дополнительные данные и элементы управления. Это позволяет '
    'игроку сохранять фокус на игровом поле и не отвлекаться на '
    'изучение интерфейса. Интерфейс адаптируется к размеру экрана '
    'и поддерживает как широкоформатные мониторы, так и мобильные '
    'устройства с различными соотношениями сторон.'
))

story.append(h3('8.1 HUD Elements'))
story.append(bullet('<b>Верхняя панель</b>: счетчик планет по цветам (например, "Синий: 5 / Красный: 3 / Нейтральные: 2"), таймер уровня, кнопка паузы. Эта панель дает мгновенное понимание баланса сил на карте.'))
story.append(bullet('<b>Панель планеты</b> (при выделении): всплывающая панель рядом с планетой показывает уровень, производительность (кораблей/сек), количество входящих и исходящих потоков, время до ближайшего захвата (если применимо).'))
story.append(bullet('<b>Мини-карта</b> (угол экрана): проекция всех планет на 2D-плоскость с цветовой кодировкой. Клик по мини-карте перемещает камеру к выбранной области. На мини-карте отображаются потоки кораблей как цветные линии.'))
story.append(bullet('<b>Кнопки быстрого действия</b>: "Остановить все потоки", "Собрать все на одной планете", "Равномерное распределение" (для удобного перенаправления нескольких потоков одновременно).'))
story.append(bullet('<b>Индикатор угрозы</b>: при наведении на планету отображается стрелка от ближайшего вражеского потока с оценкой времени прибытия, позволяя быстро оценить, успеет ли планета защищаться.'))

# ============================================================
# 9. BALANCE PARAMETERS
# ============================================================
story.append(Spacer(1, 18))
story.append(h1('9. Balance Parameters'))
story.append(p(
    'Баланс игры настраивается через набор глобальных параметров, '
    'которые могут изменяться для разных уровней сложности или '
    'режимов игры. Параметры хранятся в ресурсных файлах '
    '<font name="Times New Roman">Godot (.tres/.tscn)</font> и '
    'загружаются при инициализации уровня. Это позволяет '
    'отдельно настраивать баланс каждого уровня без изменения '
    'кода игры. Ниже приведены базовые значения параметров '
    'для стандартной сложности.'
))

story.append(Spacer(1, 10))
story.append(make_table(
    ['Parameter', 'Value', 'Description'],
    [
        ['base_production', '0.2 ships/s', 'Minimum production rate'],
        ['level_bonus', '0.1 ships/s', 'Per level production bonus'],
        ['ship_speed_min', '5 units/s', 'Minimum ship speed'],
        ['ship_speed_max', '15 units/s', 'Maximum ship speed'],
        ['redirect_delay', '1.5 s', 'Delay when rerouting streams'],
        ['ai_decision_interval', '1.0 s', 'AI re-evaluation frequency'],
        ['capture_flash_duration', '0.8 s', 'Capture animation time'],
        ['threat_detection_range', '30 units', 'Threat warning distance'],
        ['max_planet_level', '20', 'Maximum possible level'],
        ['tutorial_highlight_duration', '3.0 s', 'Tutorial tip display time'],
    ],
    col_widths=[4.5*cm, 2.5*cm, 9*cm]
))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Table 10.</b> Core balance parameters', caption_style))
story.append(Spacer(1, 12))

story.append(p(
    'Баланс труднопроходимых уровней достигается за счет нескольких '
    'механизмов. Во-первых, ИИ на высоких уровнях получает бонус '
    'к производительности (+10-30% к базовой скорости генерации '
    'кораблей). Во-вторых, начальное распределение планет может быть '
    'асимметричным: ИИ начинает с большими уровнями или лучшими '
    'позициями. В-третьих, структура карты может создавать '
    'бутылочные горлышки (bottlenecks) - ключевые планеты, '
    'контроль над которыми определяет исход уровня. Эти механики '
    'в сочетании создают сложные, но справедливые задачи, где '
    'победа требует продуманной стратегии, а не просто быстрого '
    'нажатия кнопок.'
))

# ============================================================
# 10. DEVELOPMENT ROADMAP
# ============================================================
story.append(Spacer(1, 18))
story.append(h1('10. Development Roadmap'))
story.append(p(
    'Разработка проекта разделена на четыре фазы, каждая из которых '
    'имеет конкретные цели и определяемый результат. Фазы '
    'организованы по принципу нарастающей сложности: сначала '
    'создается работающий прототип с базовыми механиками, '
    'затем добавляется контент и полировка, и наконец '
    'выпуск и поддержка. Общий estimated timeline: 4-6 месяцев '
    'для первого релиза.'
))

story.append(Spacer(1, 10))
story.append(make_table(
    ['Phase', 'Duration', 'Milestones'],
    [
        ['1: Prototype', '4-6 weeks', 'Core loop, basic AI, 3 levels'],
        ['2: Content', '6-8 weeks', 'Full campaign, all AI types, polish'],
        ['3: Testing', '2-3 weeks', 'QA, balance tuning, bug fixes'],
        ['4: Release', '2-4 weeks', 'Build optimization, store page, launch'],
    ],
    col_widths=[3.5*cm, 3*cm, 9.5*cm]
))
story.append(Spacer(1, 4))
story.append(Paragraph('<b>Table 11.</b> Development phases', caption_style))
story.append(Spacer(1, 12))

story.append(h3('10.1 Phase 1: Prototype'))
story.append(p(
    'Первая фаза фокусируется на создании игрового прототипа (MVP), '
    'демонстрирующего основные механики. Цель - проверить '
    'играбельность и интересные решения базовой концепции. '
    'В рамках прототипа создаются: базовая система планет '
    '(генерация, уровни, перекрашивание), система потоков '
    'кораблей с визуализацией, примитивный ИИ (balanced профиль), '
    'управление камерой и 3 уровня для тестирования. '
    'Прототип должен быть играбельным от начала до конца '
    'и демонстрировать основной игровой цикл за 5-10 минут. '
    'После завершения прототипа проводится внутреннее '
    'плейтестирование для оценки "fun factor" и '
    'корректировки базовых параметров.'
))

story.append(h3('10.2 Phase 2: Content'))
story.append(p(
    'Вторая фаза посвящена созданию игрового контента: '
    'полная кампания из 30 уровней, все типы ИИ-противников, '
    'система достижений, процедурная генерация, '
    'звуковые эффекты и музыка, дополнительные визуальные '
    'эффекты (туманности, астероидные поля, анимации захвата), '
    'мобильная адаптация интерфейса и локализация. '
    'Параллельно ведется работа над полировкой '
    'визуальной составляющей: настройка освещения, '
    'пост-процессинг, оптимизация частиц.'
))

story.append(h3('10.3 Phase 3 and 4'))
story.append(p(
    'Третья фаза - тестирование и балансировка. Включает '
    'внутреннее <font name="Times New Roman">QA</font>, '
    'закрытое бета-тестирование с привлечением внешних '
    'игроков, настройку баланса всех уровней, исправление '
    'ошибок и оптимизацию производительности. Четвертая '
    'фаза - подготовка к релизу: финальная оптимизация '
    'билдов для всех платформ (<font name="Times New Roman">PC</font>, '
    '<font name="Times New Roman">macOS</font>, '
    '<font name="Times New Roman">Linux</font>, '
    '<font name="Times New Roman">Android</font>), '
    'создание страницы в магазине, трейлеров и скриншотов, '
    'подготовка документации. После релиза запускается цикл '
    'поддержки с исправлением ошибок и подготовкой '
    'бесплатных обновлений с новым контентом.'
))

# ============================================================
# BUILD PDF
# ============================================================
doc.build(story)
print(f"PDF generated: {output_path}")
