#!/usr/bin/env python3
"""Build the opening writer lane from the educate template.

The opening is a small, standalone deck that precedes P001.  It is rebuilt
from the native template with python-pptx; every authored slide uses source
slide 2 / slideLayout2.xml and inherits the template field, logo, divider, and
slide-number system.
"""

from __future__ import annotations

import copy
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, PP_PLACEHOLDER
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.oxml.xmlchemy import OxmlElement
from pptx.util import Inches, Pt


ROOT = Path(__file__).resolve().parent
ALT_ROOT = ROOT.parent
TEMPLATE = next(
    (
        candidate
        for candidate in (
            Path("/home/u24/pptx-wrap/assets/templates/educate.pptx"),
            Path("/home/sat/pptx-wrap/assets/templates/educate.pptx"),
        )
        if candidate.is_file()
    ),
    Path("/home/u24/pptx-wrap/assets/templates/educate.pptx"),
)
LATEST_ROOT = ALT_ROOT / "latest"
OUTPUT = LATEST_ROOT / "LoRaEnergySim-LEO-ALT-OPENING-V2-REVIEW.pptx"
OUTLINE_OUTPUT = ROOT / "outline.json"
QA_OUTPUT = ROOT / "qa" / "build-report.json"

EVIDENCE_ROOT = ALT_ROOT / "current-evidence" / "course-20260811" / ".playwright-cli"
EVIDENCE_METRICS = EVIDENCE_ROOT / "element-2026-08-11T03-06-45-152Z.png"
EVIDENCE_FRAME = EVIDENCE_ROOT / "element-2026-08-11T03-06-47-569Z.png"
EVIDENCE_LEDGER = EVIDENCE_ROOT / "element-2026-08-11T03-06-50-920Z.png"

NAVY = "25356B"
INK = "25324A"
MUTED = "65758B"
BLUE = "4967C2"
BLUE_PALE = "ECF1FE"
TEAL = "007374"
TEAL_PALE = "E8F7F4"
PURPLE = "660066"
PURPLE_PALE = "F4EDF7"
GOLD = "846826"
GOLD_PALE = "FDF9E2"
RED = "992A2A"
RED_PALE = "FDEFEF"
WHITE = "FFFFFF"
LINE = "D7DEEA"
FIELD = "F7F8FC"
CODE = "F3F5FA"

P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"

CLAIM_BOUNDARY = (
    "SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / "
    "NOT CANONICAL-PARITY-VERIFIED"
)


def rgb(value: str) -> RGBColor:
    return RGBColor.from_string(value)


def set_run_fonts(run, face: str = "Times New Roman") -> None:
    """Use Times New Roman for Latin/numerals and 標楷體 for Chinese."""
    rpr = run._r.get_or_add_rPr()
    for tag, typeface in (("latin", face), ("ea", "標楷體"), ("cs", face)):
        child = rpr.find(qn(f"a:{tag}"))
        if child is None:
            child = OxmlElement(f"a:{tag}")
            rpr.append(child)
        child.set("typeface", typeface)


def add_markup_runs(paragraph, text: str, size: float, color: str,
                    bold: bool = False, base_italic: bool = False,
                    face: str = "Times New Roman") -> None:
    """Backtick spans are editable italic fields/variables."""
    pieces = re.split(r"(`[^`]+`)", text)
    for piece in pieces:
        if not piece:
            continue
        marked = piece.startswith("`") and piece.endswith("`")
        value = piece[1:-1] if marked else piece
        run = paragraph.add_run()
        run.text = value
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.italic = base_italic or marked
        run.font.color.rgb = rgb(color)
        set_run_fonts(run, face)


def write_text(shape, text: str, size: float = 24, color: str = INK,
               bold: bool = False, align=PP_ALIGN.LEFT,
               valign=MSO_ANCHOR.MIDDLE,
               margins=(0.04, 0.02, 0.04, 0.02),
               line_spacing: float = 1.0,
               base_italic: bool = False,
               face: str = "Times New Roman") -> None:
    tf = shape.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.vertical_anchor = valign
    tf.margin_left = Inches(margins[0])
    tf.margin_top = Inches(margins[1])
    tf.margin_right = Inches(margins[2])
    tf.margin_bottom = Inches(margins[3])
    for index, line in enumerate(text.split("\n")):
        paragraph = tf.paragraphs[0] if index == 0 else tf.add_paragraph()
        paragraph.alignment = align
        paragraph.line_spacing = line_spacing
        paragraph.space_before = Pt(0)
        paragraph.space_after = Pt(0)
        add_markup_runs(paragraph, line, size, color, bold, base_italic, face)


def add_text(slide, x, y, w, h, text, size=24, color=INK, bold=False,
             align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.MIDDLE,
             margins=(0.02, 0.01, 0.02, 0.01), line_spacing=1.0,
             name="Text", base_italic=False, face="Times New Roman"):
    shape = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    shape.name = name
    write_text(shape, text, size, color, bold, align, valign, margins,
               line_spacing, base_italic, face)
    return shape


def add_box(slide, x, y, w, h, fill, line=LINE, radius=True,
            name="Box", line_width=1.2):
    kind = MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE
    shape = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.name = name
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb(fill)
    if line:
        shape.line.color.rgb = rgb(line)
        shape.line.width = Pt(line_width)
    else:
        shape.line.fill.background()
    return shape


def add_label_box(slide, x, y, w, h, text, fill, line, size=22,
                  color=INK, bold=False, align=PP_ALIGN.CENTER,
                  name="Label", margins=(0.10, 0.04, 0.10, 0.04),
                  line_spacing=0.96, base_italic=False, face="Times New Roman"):
    shape = add_box(slide, x, y, w, h, fill, line, name=name)
    write_text(shape, text, size, color, bold, align, MSO_ANCHOR.MIDDLE,
               margins=margins, line_spacing=line_spacing,
               base_italic=base_italic, face=face)
    return shape


def add_chevron(slide, x, y, w=0.38, h=0.48, color=BLUE, name="Connector"):
    shape = slide.shapes.add_shape(MSO_SHAPE.CHEVRON, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.name = name
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb(color)
    shape.line.fill.background()
    return shape


def add_dot(slide, x, y, d, color, name="Dot"):
    shape = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(d), Inches(d))
    shape.name = name
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb(color)
    shape.line.fill.background()
    return shape


def add_field_band(slide, y: float, text: str, line: str = BLUE,
                   fill: str = FIELD, size: float = 18,
                   h: float = 0.82, name: str = "Field contract"):
    band = add_box(slide, 0.88, y, 11.55, h, fill, line, name=name, line_width=1.0)
    write_text(band, text, size, NAVY, False, PP_ALIGN.LEFT,
               MSO_ANCHOR.MIDDLE, margins=(0.18, 0.04, 0.18, 0.04),
               line_spacing=0.92)
    return band


def add_section_label(slide, x, y, w, text, color, fill):
    return add_label_box(slide, x, y, w, 0.38, text, fill, color, 18,
                         color, True, name=f"Section {text}",
                         margins=(0.08, 0.01, 0.08, 0.01))


def add_code_box(slide, x, y, w, h, text, name="Code block", size=20,
                 line=LINE, fill=CODE):
    box = add_box(slide, x, y, w, h, fill, line, radius=True,
                  name=name, line_width=1.0)
    write_text(box, text, size, INK, False, PP_ALIGN.LEFT, MSO_ANCHOR.MIDDLE,
               margins=(0.16, 0.10, 0.16, 0.10), line_spacing=0.88,
               base_italic=True, face="Times New Roman")
    return box


def add_picture(slide, path: Path, x: float, y: float, w: float, h: float,
                name: str, line: str = LINE):
    if not path.exists():
        placeholder = add_box(slide, x, y, w, h, FIELD, line, name=name)
        write_text(placeholder, "待取得 current evidence", 18, MUTED,
                   False, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE)
        return placeholder
    picture = slide.shapes.add_picture(str(path), Inches(x), Inches(y), Inches(w), Inches(h))
    picture.name = name
    return picture


def delete_shape(shape) -> None:
    element = shape._element
    element.getparent().remove(element)


def prepare_slide(prs: Presentation, title: str):
    slide = prs.slides.add_slide(prs.slide_layouts[1])
    title_shape = slide.shapes.title
    if title_shape is None:
        raise RuntimeError("slideLayout2 title placeholder missing")
    for placeholder in list(slide.placeholders):
        if placeholder._element is title_shape._element:
            continue
        if placeholder.placeholder_format.type in {
            PP_PLACEHOLDER.DATE,
            PP_PLACEHOLDER.FOOTER,
            PP_PLACEHOLDER.SLIDE_NUMBER,
        }:
            continue
        delete_shape(placeholder)
    title_shape.left = Inches(0.718057)
    title_shape.top = Inches(0.204514)
    title_shape.width = Inches(10.34861)
    title_shape.height = Inches(0.525)
    title_shape.name = "Native layout2 title"
    write_text(title_shape, title, 28, NAVY, True, PP_ALIGN.LEFT,
               MSO_ANCHOR.MIDDLE, margins=(0.02, 0.0, 0.02, 0.0))
    return slide


def remove_all_slides(prs: Presentation) -> None:
    sld_id_lst = prs.slides._sldIdLst
    for sld_id in list(sld_id_lst):
        rel_id = sld_id.rId
        prs.part.drop_rel(rel_id)
        sld_id_lst.remove(sld_id)


def overlay_template_parts(path: Path) -> None:
    """Restore the template-owned layout/master/theme parts byte-for-byte."""
    owned_prefixes = (
        "ppt/slideLayouts/",
        "ppt/slideMasters/",
        "ppt/theme/",
        "ppt/notesMasters/",
    )
    with zipfile.ZipFile(TEMPLATE) as source, zipfile.ZipFile(path, "r") as old:
        data = {info.filename: old.read(info.filename) for info in old.infolist()}
        infos = {info.filename: copy.copy(info) for info in old.infolist()}
        for info in source.infolist():
            if info.filename.startswith(owned_prefixes):
                data[info.filename] = source.read(info.filename)
                infos[info.filename] = copy.copy(info)
    overlay = path.with_suffix(".overlay.pptx")
    with zipfile.ZipFile(overlay, "w", zipfile.ZIP_DEFLATED) as out:
        for name, payload in data.items():
            out.writestr(infos[name], payload)
    overlay.replace(path)


def slide_notes(slide, text: str) -> None:
    slide.notes_slide.notes_text_frame.text = text


def slide_1(prs):
    slide = prepare_slide(prs, "O001｜智慧節能 IoT：為何使用 LoRaEnergySim")
    add_text(slide, 0.92, 1.02, 11.45, 0.46,
             "在窗口與期限內完成必要傳輸，同時降低端點能量",
             24, NAVY, True, PP_ALIGN.CENTER, name="Opening proposition")

    add_label_box(slide, 0.92, 1.78, 3.35, 2.55,
                  "固定情境\n窗口、流量、units\n\n端點決策輸入",
                  BLUE_PALE, BLUE, 24, NAVY, True,
                  name="Scenario input")
    add_chevron(slide, 4.43, 2.73, 0.55, 0.58, BLUE, "Scenario to runner")

    runner = add_box(slide, 5.16, 1.55, 3.05, 3.02, TEAL_PALE, TEAL,
                     name="Local package runner")
    add_text(slide, 5.38, 1.78, 2.61, 0.44,
             "本機 package runner", 24, TEAL, True, PP_ALIGN.CENTER,
             name="Runner heading")
    add_text(slide, 5.44, 2.52, 2.50, 1.50,
             "bounded policy\n固定 seed／scenario\ndeterministic events\nendpoint energy model",
             20, INK, False, PP_ALIGN.CENTER, name="Runner anatomy")
    add_chevron(slide, 8.42, 2.73, 0.55, 0.58, TEAL, "Runner to Leo")

    add_label_box(slide, 9.15, 1.78, 3.18, 2.55,
                  "Leo `/course`\n驗證 result artifact\n重播 endpoint events\n保存比較 workbook",
                  PURPLE_PALE, PURPLE, 23, NAVY, True,
                  name="Leo evidence host")

    add_label_box(slide, 1.42, 4.77, 10.58, 0.52,
                  "endpoint evidence：queue／packet／radio state／service／J",
                  GOLD_PALE, GOLD, 21, NAVY, True, name="Endpoint evidence boundary")
    add_field_band(
        slide, 5.58,
        "`scenario_id`（情境識別碼）｜來源：fixed scenario package｜作用：固定窗口、流量與單位\n"
        "單位：字串識別碼｜判讀：相同情境與相同 policy identity 才進入比較",
        line=BLUE, name="Scenario identity field",
    )
    slide_notes(slide, (
        "智慧節能與物聯網應用的核心不是只把焦耳數壓低，而是在服務窗口與期限內完成必要資料，同時降低端點能量。"
        "LoRaEnergySim 把這個服務與能量的取捨轉成可重跑、可比較、可反駁的事件證據；Leo `/course` 則負責驗證、重播與保存。"
        "固定情境提供窗口、流量與單位；"
        "本機 package runner 讀取 bounded policy，依固定 scenario 與 seed 產生可重跑的事件資料；Leo `/course` "
        "接收 result artifact，進行驗證、endpoint event replay 與 workbook 保存。`scenario_id` 是情境識別碼，"
        "來源為 fixed scenario package，作用是固定窗口、流量與單位，單位為字串識別碼；比較時必須使用相同情境與相同 policy identity。"
        "證據範圍集中在 endpoint queue、packet、radio state、service 與 endpoint J。"
    ))


def slide_2(prs):
    slide = prepare_slide(prs, "O002｜為何加入 LEO：服務窗口會改變")
    add_text(slide, 1.02, 1.02, 11.25, 0.46,
             "LEO 提供一條會開啟、變強、關閉的服務機會 trace",
             24, NAVY, True, PP_ALIGN.CENTER, name="Window proposition")

    add_label_box(slide, 0.92, 1.86, 2.20, 1.24,
                  "LEO\n服務機會", BLUE_PALE, BLUE, 25, NAVY, True,
                  name="LEO role")
    add_chevron(slide, 3.35, 2.23, 0.45, 0.52, BLUE, "Window input arrow")

    band = add_box(slide, 3.96, 1.66, 7.10, 1.75, FIELD, LINE,
                   name="Changing service window timeline")
    segments = [
        ("窗口開啟", TEAL, 1.42), ("品質變化", GOLD, 1.50),
        ("窗口關閉", "CBD5E1", 1.36), ("再次開啟", BLUE, 1.42),
    ]
    cursor = 4.26
    for index, (label, fill, width) in enumerate(segments):
        segment = add_box(slide, cursor, 2.22, width, 0.62, fill, None,
                          radius=False, name=f"Window segment {index + 1}")
        write_text(segment, label, 18, WHITE if fill != "CBD5E1" else INK,
                   True, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE,
                   margins=(0.02, 0.01, 0.02, 0.01))
        cursor += width + 0.08
    add_text(slide, 4.26, 1.84, 6.54, 0.32,
             "fixed trace：closed → usable → strong → closed",
             18, MUTED, False, PP_ALIGN.CENTER, name="Window trace label")

    add_chevron(slide, 11.24, 2.23, 0.45, 0.52, TEAL, "Window to policy arrow")
    add_label_box(slide, 11.82, 1.86, 1.04, 1.24,
                  "端點\n策略", TEAL_PALE, TEAL, 21, NAVY, True,
                  name="Endpoint policy choice")

    actions = [
        ("等待", "保持可反應", BLUE_PALE, BLUE),
        ("休息", "降低休息功率", GOLD_PALE, GOLD),
        ("送出", "建立封包事件", TEAL_PALE, TEAL),
    ]
    x = 1.20
    for index, (heading, body, fill, line) in enumerate(actions):
        card = add_box(slide, x, 3.92, 3.28, 1.12, fill, line,
                       name=f"Endpoint option {index + 1}")
        add_text(slide, x + 0.16, 4.08, 1.05, 0.32, heading, 22, line,
                 True, PP_ALIGN.CENTER, name=f"Endpoint option heading {index + 1}")
        add_text(slide, x + 1.35, 4.04, 1.66, 0.42, body, 20, INK,
                 False, PP_ALIGN.CENTER, name=f"Endpoint option body {index + 1}")
        x += 3.60
    add_text(slide, 1.10, 5.20, 11.15, 0.36,
             "窗口關閉時，runner 的合法安全分支為休息；窗口開啟時，策略才評估等待或送出。",
             20, NAVY, True, PP_ALIGN.CENTER, name="Window legality")
    add_field_band(
        slide, 5.70,
        "`service_window`（服務窗口）｜來源：fixed scenario trace｜作用：定義合法傳輸區間\n"
        "單位：trace time｜判讀：決定 action 是否具有服務機會",
        line=TEAL, name="Service window field",
    )
    slide_notes(slide, (
        "LEO 在本課提供 changing-service-window 的工作範例。固定 trace 依序呈現窗口開啟、品質變化、窗口關閉與再次開啟；"
        "端點策略在服務機會存在時選擇等待或送出，窗口關閉時進入合法的休息分支。服務窗口 `service_window` 的來源是 fixed scenario trace，"
        "作用是定義合法傳輸區間，單位為 trace time；判讀時確認 action 是否具有服務機會。這個機制也能轉移到閘道可用時段、低負載時段或回報機會，"
        "而 LEO 的作用限於提供 changing-service-window 的清楚例子。"
    ))


def slide_3(prs):
    slide = prepare_slide(prs, "O003｜封裝已完成什麼；實驗還要做什麼")
    add_text(slide, 1.00, 1.02, 11.32, 0.46,
             "已固定環境、情境、runner 與 evidence；實驗只改 policy、解釋結果",
             24, NAVY, True, PP_ALIGN.CENTER, name="Package proposition")

    columns = [
        (0.92, 3.73, BLUE_PALE, BLUE, "固定與 setup", [
            "fixed scenario／case",
            "POSIX／Windows setup scripts",
            "package-local `.venv`",
            "`READY` verify receipt",
        ]),
        (4.80, 3.73, TEAL_PALE, TEAL, "policy 與 runner", [
            "bounded `student_policy.py`",
            "legal observation／action API",
            "deterministic runner／fixed seed",
            "`result.json` result artifact",
        ]),
        (8.68, 3.68, PURPLE_PALE, PURPLE, "evidence 與 recovery", [
            "paired `endpoint-replay.json`",
            "identity／units／provenance gate",
            "same-scenario fallback pair",
            "claim ceiling preserved",
        ]),
    ]
    for index, (x, w, fill, line, heading, rows) in enumerate(columns):
        card = add_box(slide, x, 1.78, w, 3.38, fill, line,
                       name=f"Package capability column {index + 1}")
        add_text(slide, x + 0.18, 2.02, w - 0.36, 0.40, heading, 23, line,
                 True, PP_ALIGN.CENTER, name=f"Package capability heading {index + 1}")
        y = 2.72
        for row_index, row in enumerate(rows):
            add_dot(slide, x + 0.30, y + 0.09, 0.16, line,
                    name=f"Package dot {index + 1}-{row_index + 1}")
            add_text(slide, x + 0.58, y, w - 0.80, 0.42, row, 19, INK,
                     False, PP_ALIGN.LEFT, name=f"Package row {index + 1}-{row_index + 1}")
            y += 0.56
    add_label_box(slide, 1.22, 5.42, 10.92, 0.56,
                  "實驗操作：改 active marked block → exact run → 上傳 artifact → 解釋 evidence",
                  GOLD_PALE, GOLD, 20, NAVY, True, name="Package identity footer")
    add_field_band(
        slide, 6.08,
        "`.venv`（套件本地虛擬環境）｜來源：setup script｜作用：隔離 lock、policy、scenario 與 runner\n"
        "單位：目錄路徑｜判讀：`course.sh`／`course.cmd` 使用同一套 Python 3.11.x",
        line=BLUE, fill=FIELD, size=18, h=0.52, name="Venv field",
    )
    slide_notes(slide, (
        "課程 package 已經把設定、執行與證據保存分成固定層次。固定 scenario 與 case 提供可重跑輸入；"
        "POSIX 與 Windows setup script 建立套件本地 `.venv`，verify 產生 `READY` receipt。bounded `student_policy.py` "
        "只使用合法 observation 與 action，deterministic runner 產生 `result.json`。配對的 `endpoint-replay.json` "
        "保存同一次 run 的事件脈絡；identity、units 與 provenance gate 維持配對正確，環境或 runner 受阻時使用同情境 fallback pair。"
        "`.venv` 的來源是 setup script，作用是隔離 lock、policy、scenario 與 runner，單位為目錄路徑；判讀時確認兩個 launcher 都使用同一套 Python 3.11.x。"
        "因此實驗操作不需要重寫模擬器；工作集中在 active marked block 的單一修改、exact run、artifact 上傳，以及依事件證據完成解釋。"
        "全部資料維持 claim ceiling：" + CLAIM_BOUNDARY + "。"
    ))


def slide_4(prs):
    slide = prepare_slide(prs, "O004｜三個實驗：改什麼、為何改、看什麼")
    add_text(slide, 1.02, 1.02, 11.28, 0.46,
             "固定 scenario、seed、traffic 與 endpoint scope；每次只改一個控制點",
             24, NAVY, True, PP_ALIGN.CENTER, name="Experiment proposition")

    steps = [
        ("A", "空檔休息", "SLEEP → WAIT\n看 state／wake／service／J", BLUE_PALE, BLUE),
        ("B", "品質 hold", "STABLE_STEPS 2 → 1\n看 MODE_CHANGE／service／J", GOLD_PALE, GOLD),
        ("C", "急件餘裕", "URGENT_MARGIN_S\n20 → 5 → 30\n看 deadline／service／J", TEAL_PALE, TEAL),
        ("共通", "證據方法", "prediction → exact run\n→ replay → explanation", PURPLE_PALE, PURPLE),
    ]
    x = 0.92
    for index, (number, heading, body, fill, line) in enumerate(steps):
        add_box(slide, x, 1.78, 2.72, 2.34, fill, line,
                name=f"Experiment step {number}")
        add_text(slide, x + 0.14, 1.98, 0.68, 0.40, number, 22, line,
                 True, PP_ALIGN.CENTER, name=f"Experiment number {number}")
        add_text(slide, x + 0.86, 1.96, 1.58, 0.40, heading, 22, NAVY,
                 True, PP_ALIGN.LEFT, name=f"Experiment heading {number}")
        add_text(slide, x + 0.18, 2.64, 2.36, 1.12, body, 17, INK,
                 False, PP_ALIGN.CENTER, name=f"Experiment body {number}")
        if index < len(steps) - 1:
            add_chevron(slide, x + 2.76, 2.76, 0.22, 0.34, line,
                        name=f"Experiment connector {number}")
        x += 3.06

    left = add_box(slide, 1.05, 4.48, 5.10, 1.05, FIELD, BLUE,
                   name="Interpretation rule")
    add_text(slide, 1.28, 4.66, 1.50, 0.34, "判讀規則", 22, BLUE, True,
             PP_ALIGN.CENTER, name="Interpretation heading")
    add_text(slide, 2.92, 4.61, 2.88, 0.48,
             "service gate → events → endpoint J",
             21, NAVY, True, PP_ALIGN.CENTER, name="Interpretation order")
    right = add_box(slide, 6.48, 4.48, 5.76, 1.05, RED_PALE, RED,
                    name="KPI boundary")
    add_text(slide, 6.72, 4.66, 1.72, 0.34, "單一 KPI（績效指標）", 20,
             RED, True, PP_ALIGN.CENTER, name="KPI heading")
    add_text(slide, 8.58, 4.61, 3.38, 0.48,
             "只作結果描述；因果句由事件證據完成",
             20, NAVY, True, PP_ALIGN.CENTER, name="KPI interpretation")
    add_field_band(
        slide, 5.78,
        "`prediction`（預測紀錄）｜來源：workbook record｜作用：指定可反駁的變化方向\n"
        "單位：statement｜判讀：執行前基準與執行後 evidence 對照",
        line=PURPLE, size=18, h=0.76, name="Prediction field",
    )
    slide_notes(slide, (
        "三個實驗都研究服務與端點能量的取捨。Lab A 將 `REST_DURING_GAP` 從 `SLEEP` 改為 `WAIT`，檢驗較少 wake 與較多 awake idle 的取捨。"
        "Lab B 將 `STABLE_STEPS` 從 2 改為 1，檢驗較早進入 send-ready 是否改善服務，或增加 mode transition。"
        "Lab C 將 `URGENT_MARGIN_S` 依序由 20 改為 5，再修訂為 30，檢驗急件介入時機、deadline 與 endpoint J。"
        "每個實驗先固定 scenario、seed、traffic 與 endpoint scope，在 workbook record 中保存 `prediction`，再只修改一個 marked constant，"
        "執行 exact case，使用 stdout result path 開啟 evidence，"
        "最後沿 action、event、service 與 endpoint J 完成 causal explanation。`prediction` 的來源是 workbook record，作用是指定可反駁的變化方向，"
        "單位為 statement；判讀時把執行前基準與執行後 evidence 對照。判讀規則的順序是 service gate、封包與狀態事件、endpoint J；"
        "單一 KPI 只作結果描述，不能取代事件證據。"
    ))


def slide_setup_overview(prs):
    slide = prepare_slide(prs, "O004a｜開始前：環境建立的固定順序")
    add_text(slide, 1.00, 1.02, 11.30, 0.46,
             "先確認 Python 3.11，再建立隔離環境；READY 之後才開始修改 policy",
             24, NAVY, True, PP_ALIGN.CENTER, name="Setup order proposition")
    steps = [
        ("01", "檢查 3.11", "顯示 Python 3.11.x", BLUE_PALE, BLUE),
        ("02", "必要時安裝", "取得精確 interpreter", GOLD_PALE, GOLD),
        ("03", "檢查 venv", "確認 standard module", TEAL_PALE, TEAL),
        ("04", "建立／啟用", "package-local .venv", PURPLE_PALE, PURPLE),
        ("05", "locked install", "在 .venv 內安裝", BLUE_PALE, BLUE),
        ("06", "verify", "看到 status: READY", TEAL_PALE, TEAL),
    ]
    x = 0.72
    for index, (number, heading, body, fill, line) in enumerate(steps):
        add_box(slide, x, 1.75, 1.88, 2.28, fill, line,
                name=f"Setup step {number}")
        add_text(slide, x + 0.12, 1.94, 0.42, 0.34, number, 20, line, True,
                 PP_ALIGN.CENTER, name=f"Setup number {number}")
        add_text(slide, x + 0.52, 1.91, 1.18, 0.42, heading, 19, NAVY, True,
                 PP_ALIGN.LEFT, name=f"Setup heading {number}")
        add_text(slide, x + 0.14, 2.72, 1.60, 0.72, body, 17, INK, False,
                 PP_ALIGN.CENTER, name=f"Setup body {number}")
        if index < len(steps) - 1:
            add_chevron(slide, x + 1.91, 2.66, 0.18, 0.32, line,
                        name=f"Setup connector {number}")
        x += 2.08
    add_label_box(slide, 0.95, 4.36, 5.66, 0.92,
                  "目的：固定 interpreter 與依賴邊界，讓同一 case 可重跑、可比較",
                  FIELD, BLUE, 20, NAVY, True, name="Setup purpose")
    add_label_box(slide, 6.78, 4.36, 5.60, 0.92,
                  "手動流程與 setup script 二選一；不要完成後再重複執行",
                  GOLD_PALE, GOLD, 20, NAVY, True, name="Setup route choice")
    add_field_band(
        slide, 5.62,
        "`.venv`（套件本地虛擬環境）｜來源：Python venv module｜作用：隔離 interpreter 與 locked requirements\n"
        "單位：目錄路徑｜判讀：啟用後 `python` 必須指向 package root 內的 `.venv`",
        line=TEAL, size=18, h=0.78, name="Venv setup field",
    )
    slide_notes(slide, (
        "環境建立遵循固定順序。先確認 Python 3.11.x；找不到時再依作業系統安裝精確版本。"
        "接著確認 Python standard library 的 venv module 可以建立環境，建立 package-local `.venv` 並啟用，"
        "再於該環境內安裝 locked requirements，最後執行 verify。`.venv` 的來源是 Python venv module，作用是隔離 interpreter 與 locked requirements，"
        "單位是目錄路徑；判讀時，啟用後的 Python executable 必須位於 package root 內的 `.venv`。"
        "手動流程與 setup script 是兩條等價路徑，只選一條。"
    ))


def slide_setup_windows(prs):
    slide = prepare_slide(prs, "O004b｜Windows：檢查、建立環境、安裝與驗證")
    add_text(slide, 1.00, 1.02, 11.30, 0.46,
             "PowerShell 為主要路徑；啟用受阻時改用同一 package 目錄的 Command Prompt",
             22, NAVY, True, PP_ALIGN.CENTER, name="Windows setup proposition")
    add_section_label(slide, 0.86, 1.64, 3.66, "01｜檢查；缺少才安裝", BLUE, BLUE_PALE)
    add_code_box(slide, 0.86, 2.08, 3.66, 1.42,
                 "py -3.11 --version\n\nwinget install --id=astral-sh.uv -e\nuv python install 3.11",
                 name="Windows check install", size=16.5, line=BLUE)
    add_section_label(slide, 4.82, 1.64, 3.70, "02｜建立並啟用 .venv", TEAL, TEAL_PALE)
    add_code_box(slide, 4.82, 2.08, 3.70, 1.42,
                 "$python311=(uv python find 3.11).Trim()\n& $python311 -m venv .venv\n.\\.venv\\Scripts\\Activate.ps1",
                 name="Windows venv", size=16.5, line=TEAL)
    add_section_label(slide, 8.82, 1.64, 3.64, "03｜在環境內安裝／verify", PURPLE, PURPLE_PALE)
    add_code_box(slide, 8.82, 2.08, 3.64, 1.42,
                 "python -m pip install --require-hashes\n--no-deps -r .\\requirements-lock.txt\n.\\course.cmd verify",
                 name="Windows install verify", size=16, line=PURPLE)
    add_label_box(slide, 0.98, 3.88, 5.56, 1.10,
                  "PowerShell activation 成功\n`python --version` → Python 3.11.x\n`python` path → `.venv\\Scripts\\python.exe`",
                  FIELD, BLUE, 18, NAVY, False, name="Windows active evidence")
    add_label_box(slide, 6.78, 3.88, 5.56, 1.10,
                  "若 Activate.ps1 受阻\nCommand Prompt：`call .venv\\Scripts\\activate.bat`\n再執行同一 locked install 與 `course.cmd verify`",
                  GOLD_PALE, GOLD, 18, NAVY, False, name="Windows CMD fallback")
    add_field_band(
        slide, 5.38,
        "`PYTHON_BIN`（Python 執行器路徑）｜來源：Python Launcher 或 `uv python find 3.11`｜作用：選定精確 3.11 interpreter\n"
        "單位：檔案路徑｜判讀：建立 `.venv` 前先顯示 Python 3.11.x",
        line=BLUE, size=17.5, h=0.86, name="Windows Python field",
    )
    slide_notes(slide, (
        "Windows 先使用 Python Launcher 執行 `py -3.11 --version`。顯示 Python 3.11.x 時可直接建立環境；找不到時，"
        "使用 uv 安裝 Python 3.11，再由 `uv python find 3.11` 取得 executable path。`PYTHON_BIN` 是 Python 執行器路徑，"
        "來源是 Python Launcher 或 uv，作用是選定精確的 3.11 interpreter，單位是檔案路徑；判讀時必須先顯示 Python 3.11.x。"
        "建立 `.venv` 後在同一視窗啟用，再於環境內執行 locked install 與 `course.cmd verify`。PowerShell activation 受阻時，"
        "不放寬全系統設定；改用 Command Prompt 的 activate.bat 完成同一流程。"
    ))


def slide_setup_linux(prs):
    slide = prepare_slide(prs, "O004c｜Linux／WSL：檢查 3.11，再建立 .venv")
    add_text(slide, 1.00, 1.02, 11.30, 0.46,
             "WSL 使用其 Linux distribution；命令與 Windows shell 不混用",
             23, NAVY, True, PP_ALIGN.CENTER, name="Linux setup proposition")
    add_section_label(slide, 0.86, 1.64, 3.66, "01｜檢查；缺少才安裝", BLUE, BLUE_PALE)
    add_code_box(slide, 0.86, 2.08, 3.66, 1.54,
                 "command -v python3.11\npython3.11 --version\n\ncurl -LsSf https://astral.sh/uv/install.sh | sh\nuv python install 3.11",
                 name="Linux check install", size=16, line=BLUE)
    add_section_label(slide, 4.82, 1.64, 3.70, "02｜建立並啟用 .venv", TEAL, TEAL_PALE)
    add_code_box(slide, 4.82, 2.08, 3.70, 1.54,
                 "PYTHON_BIN=\"$(uv python find 3.11)\"\n\"$PYTHON_BIN\" -m venv .venv\nsource .venv/bin/activate\npython --version",
                 name="Linux venv", size=16, line=TEAL)
    add_section_label(slide, 8.82, 1.64, 3.64, "03｜在環境內安裝／verify", PURPLE, PURPLE_PALE)
    add_code_box(slide, 8.82, 2.08, 3.64, 1.54,
                 "python -m pip install --require-hashes\n--no-deps -r requirements-lock.txt\nbash course.sh verify",
                 name="Linux install verify", size=16, line=PURPLE)
    add_label_box(slide, 0.98, 3.98, 5.56, 1.06,
                  "Ubuntu 24.04／WSL Ubuntu 24.04\n預設 repository 不提供 Python 3.11；使用 uv 取得精確版本",
                  GOLD_PALE, GOLD, 18.5, NAVY, True, name="Ubuntu 2404 route")
    add_label_box(slide, 6.78, 3.98, 5.56, 1.06,
                  "若 distribution Python 缺少 venv／ensurepip\n改用 uv-managed Python 建立 `.venv`",
                  FIELD, TEAL, 18.5, NAVY, True, name="Linux venv recovery")
    add_field_band(
        slide, 5.38,
        "`source .venv/bin/activate`（啟用虛擬環境）｜來源：POSIX shell｜作用：讓後續 `python`／`pip` 指向 package-local environment\n"
        "單位：shell state｜判讀：`python --version` 顯示 Python 3.11.x",
        line=TEAL, size=17.5, h=0.86, name="Linux activation field",
    )
    slide_notes(slide, (
        "Linux 與 WSL 先以 `command -v python3.11` 和版本命令檢查精確 interpreter。找不到時使用 uv 安裝；"
        "Ubuntu 24.04 與 WSL Ubuntu 24.04 不再嘗試不存在於預設 repository 的 Python 3.11 套件。"
        "取得 interpreter 後建立 `.venv`，使用 `source .venv/bin/activate` 啟用。這個命令來源是 POSIX shell，作用是讓後續 Python 與 pip 指向 package-local environment，"
        "單位是 shell state；判讀時 `python --version` 必須顯示 Python 3.11.x。最後在已啟用環境內執行 locked install 與 verify。"
    ))


def slide_setup_macos(prs):
    slide = prepare_slide(prs, "O004d｜macOS：Homebrew 或 uv 取得 Python 3.11")
    add_text(slide, 1.00, 1.02, 11.30, 0.46,
             "不要假設系統 `python3` 是 3.11；先查版本，再選一條安裝路徑",
             23, NAVY, True, PP_ALIGN.CENTER, name="macOS setup proposition")
    add_section_label(slide, 0.86, 1.64, 3.66, "01｜檢查／安裝", BLUE, BLUE_PALE)
    add_code_box(slide, 0.86, 2.08, 3.66, 1.58,
                 "command -v python3.11\npython3.11 --version\n\nbrew install python@3.11\n# 或：uv python install 3.11",
                 name="macOS check install", size=16, line=BLUE)
    add_section_label(slide, 4.82, 1.64, 3.70, "02｜建立並啟用 .venv", TEAL, TEAL_PALE)
    add_code_box(slide, 4.82, 2.08, 3.70, 1.58,
                 "PYTHON_BIN=\"$(brew --prefix python@3.11)/bin/python3.11\"\n\"$PYTHON_BIN\" -m venv .venv\nsource .venv/bin/activate",
                 name="macOS venv", size=16, line=TEAL)
    add_section_label(slide, 8.82, 1.64, 3.64, "03｜在環境內安裝／verify", PURPLE, PURPLE_PALE)
    add_code_box(slide, 8.82, 2.08, 3.64, 1.58,
                 "python --version\npython -m pip install --require-hashes\n--no-deps -r requirements-lock.txt\nbash course.sh verify",
                 name="macOS install verify", size=16, line=PURPLE)
    add_label_box(slide, 0.98, 4.00, 5.56, 1.02,
                  "Homebrew 路徑\n`$(brew --prefix python@3.11)/bin/python3.11`",
                  GOLD_PALE, GOLD, 19, NAVY, True, name="macOS brew route")
    add_label_box(slide, 6.78, 4.00, 5.56, 1.02,
                  "uv 路徑\n`PYTHON_BIN=$(uv python find 3.11)`",
                  FIELD, TEAL, 19, NAVY, True, name="macOS uv route")
    add_field_band(
        slide, 5.38,
        "`python@3.11`（Homebrew Python 套件）｜來源：Homebrew formula｜作用：提供維護中的 Python 3.11 interpreter\n"
        "單位：安裝套件／路徑｜判讀：建立 `.venv` 前先顯示 Python 3.11.x",
        line=GOLD, size=17.5, h=0.86, name="macOS Python field",
    )
    slide_notes(slide, (
        "macOS 先檢查 `python3.11` 是否存在，不以系統 `python3` 的名稱推定版本。缺少時可選擇 Homebrew 的 `python@3.11`，或使用 uv 安裝精確版本。"
        "`python@3.11` 是 Homebrew Python 套件，來源是 Homebrew formula，作用是提供維護中的 Python 3.11 interpreter，單位是安裝套件與 executable path；"
        "判讀時建立 `.venv` 前必須先顯示 Python 3.11.x。接著建立並啟用 package-local `.venv`，在環境內完成 locked install 與 `course.sh verify`。"
    ))


def slide_setup_ready(prs):
    slide = prepare_slide(prs, "O004e｜Verify 成功：看到 READY 才進入實驗")
    add_text(slide, 1.00, 1.02, 11.30, 0.46,
             "READY 是環境與契約 gate；不是 Lab 結果，也不是服務成功",
             24, NAVY, True, PP_ALIGN.CENTER, name="READY proposition")
    add_code_box(slide, 0.92, 1.72, 5.22, 2.86,
                 '{\n  "status":"READY",\n  "python_version":"3.11.x",\n  "scenario_id":"ntpu-energy-decision-01",\n  "policy_api_version":"lora-energy-policy-v1",\n  "engine_mode":"coherent-course-simulated-adapter",\n  "upstream_execution":false\n}',
                 name="READY receipt excerpt", size=16.5, line=TEAL, fill=TEAL_PALE)
    add_label_box(slide, 6.46, 1.72, 5.92, 1.16,
                  "Verify 檢查什麼\nPython 3.11／scenario identity／baseline markers／lock／policy API／engine mode／claim boundary",
                  BLUE_PALE, BLUE, 18.5, NAVY, True, name="READY checks")
    add_label_box(slide, 6.46, 3.08, 5.92, 1.50,
                  "成功後做什麼\n保持 `.venv` 啟用 → 只改 active marked block → exact run\n→ 取得 `result_path` → 上傳 `/course`",
                  GOLD_PALE, GOLD, 19, NAVY, True, name="READY next actions")
    add_label_box(slide, 1.12, 4.88, 11.08, 0.66,
                  "`artifacts/verify-receipt.json` 只證明環境 READY；Lab 結果由後續 run 產生",
                  RED_PALE, RED, 20, NAVY, True, name="READY boundary")
    add_field_band(
        slide, 5.78,
        "`status`（驗證狀態）｜來源：`course.sh`／`course.cmd verify`｜作用：表示環境與固定契約是否一致\n"
        "單位：enum｜判讀：值為 READY 才進入 case；不等同 `service_pass`",
        line=TEAL, size=18, h=0.76, name="READY status field",
    )
    slide_notes(slide, (
        "Verify 的成功標誌是輸出 JSON 中的 `status` 等於 READY，並寫入 `artifacts/verify-receipt.json`。"
        "`status` 是驗證狀態，來源是 `course.sh verify` 或 `course.cmd verify`，作用是表示環境與固定契約是否一致，單位是 enum；"
        "判讀時，只有 READY 才能進入 case。Verify 會核對 Python 3.11、scenario identity、baseline policy markers、locked requirements、policy API、engine mode 與 claim boundary。"
        "READY 不是 Lab result，也不表示 service 通過。成功後保持 `.venv` 啟用，只修改 active marked block，執行 exact case，從 stdout 保存 `result_path`，再把 result artifact 匯入 `/course`。"
    ))


def slide_5(prs):
    slide = prepare_slide(prs, "O005｜release → exact run：五步操作")
    add_text(slide, 1.02, 1.02, 11.28, 0.38,
             "先建立可重現環境，再檢查契約，最後才修改 policy 並執行 case",
             23, NAVY, True, PP_ALIGN.CENTER, name="Package workflow proposition")

    stages = [
        ("01", "取得 release", "root／README\nscripts／schemas", BLUE_PALE, BLUE),
        ("02", "setup", "建立 package-local\n`.venv`", GOLD_PALE, GOLD),
        ("03", "verify", "看到 `READY`\nreceipt", TEAL_PALE, TEAL),
        ("04", "inspect", "scenario +\n`observation`", PURPLE_PALE, PURPLE),
        ("05", "edit → run", "marked block\nexact case", RED_PALE, RED),
    ]
    x = 0.82
    for index, (number, heading, body, fill, line) in enumerate(stages):
        add_box(slide, x, 1.62, 2.25, 1.88, fill, line,
                name=f"Package workflow stage {number}")
        add_text(slide, x + 0.14, 1.82, 0.50, 0.30, number, 20, line,
                 True, PP_ALIGN.CENTER, name=f"Package workflow number {number}")
        add_text(slide, x + 0.70, 1.80, 1.30, 0.34, heading, 20, NAVY,
                 True, PP_ALIGN.LEFT, name=f"Package workflow heading {number}")
        add_text(slide, x + 0.22, 2.38, 1.82, 0.74, body, 17, INK,
                 False, PP_ALIGN.CENTER, name=f"Package workflow body {number}")
        if index < len(stages) - 1:
            add_chevron(slide, x + 2.29, 2.38, 0.18, 0.30, line,
                        name=f"Package workflow connector {number}")
        x += 2.47

    add_section_label(slide, 0.92, 3.78, 1.72, "POSIX／WSL", TEAL, TEAL_PALE)
    add_code_box(slide, 2.82, 3.70, 4.42, 0.92,
                 "PYTHON_BIN=python3.11 bash setup.sh\ncourse.sh verify",
                 name="POSIX setup verify commands", size=16.5, line=TEAL)
    add_section_label(slide, 7.48, 3.78, 1.72, "Windows", BLUE, BLUE_PALE)
    add_code_box(slide, 9.38, 3.70, 2.84, 0.92,
                 'set PYTHON_BIN=py -3.11\nsetup.cmd → course.cmd verify',
                 name="Windows setup verify commands", size=16, line=BLUE)
    add_text(slide, 1.06, 4.82, 11.08, 0.30,
             "`READY` 是環境 gate；result artifact 要由後續 exact run 產生。",
             19, NAVY, True, PP_ALIGN.CENTER, name="Ready meaning")
    add_field_band(
        slide, 5.28,
        "`READY`（環境驗證狀態）｜來源：`course.sh`／`course.cmd verify`｜作用：確認 Python、lock、policy API、scenario\n"
        "單位：status｜判讀：READY 允許進入 runner；尚未代表 result artifact 存在",
        line=TEAL, size=17, h=0.82, name="Ready field",
    )
    slide_notes(slide, (
        "package-side workflow 由 release、setup、verify、inspect、edit 與 exact run 組成。release 固定 package root；"
        "setup 建立 package-local `.venv`；POSIX／WSL 使用 `setup.sh` 與 `course.sh`，Windows 使用 `setup.cmd` 與 `course.cmd`。"
        "verify 產生 `READY` receipt，確認 Python、lock、policy API 與 scenario；`READY` 的來源是兩個 course launcher 的 verify 命令，"
        "作用是環境與契約 gate，單位為 status，判讀時只表示可以進入 runner。scenario 與 `observation` contract 在 inspect 階段讀取，"
        "marked block 的受控修改與 exact case 執行在後續步驟完成。"
    ))


def slide_6(prs):
    slide = prepare_slide(prs, "O006｜result.json → `/course`：驗證、重播、保存")
    add_text(slide, 1.02, 1.02, 11.28, 0.38,
             "runner stdout 的 result path 把同一次 run 交給網站處理",
             23, NAVY, True, PP_ALIGN.CENTER, name="Leo workflow proposition")

    stages = [
        ("01", "locate", "stdout\n`result_path`", BLUE_PALE, BLUE),
        ("02", "upload", "選擇同一次\n`result.json`", GOLD_PALE, GOLD),
        ("03", "validate", "schema／identity\nunits／provenance", TEAL_PALE, TEAL),
        ("04", "replay", "action／state／packet\nservice／energy", PURPLE_PALE, PURPLE),
        ("05", "compare + save", "baseline／candidate\nworkbook", RED_PALE, RED),
    ]
    x = 0.82
    for index, (number, heading, body, fill, line) in enumerate(stages):
        add_box(slide, x, 1.62, 2.25, 1.92, fill, line,
                name=f"Leo workflow stage {number}")
        add_text(slide, x + 0.14, 1.82, 0.50, 0.30, number, 20, line,
                 True, PP_ALIGN.CENTER, name=f"Leo workflow number {number}")
        add_text(slide, x + 0.70, 1.80, 1.36, 0.34, heading, 19.5, NAVY,
                 True, PP_ALIGN.LEFT, name=f"Leo workflow heading {number}")
        add_text(slide, x + 0.22, 2.38, 1.82, 0.72, body, 17, INK,
                 False, PP_ALIGN.CENTER, name=f"Leo workflow body {number}")
        if index < len(stages) - 1:
            add_chevron(slide, x + 2.29, 2.38, 0.18, 0.30, line,
                        name=f"Leo workflow connector {number}")
        x += 2.47

    add_label_box(slide, 1.02, 3.92, 3.34, 0.78,
                  "runner｜本機執行 policy", BLUE_PALE, BLUE, 19, NAVY, True,
                  name="Runner responsibility")
    add_chevron(slide, 4.58, 4.06, 0.40, 0.42, BLUE, "Runner artifact arrow")
    add_label_box(slide, 5.12, 3.92, 3.34, 0.78,
                  "Leo `/course`｜驗證／重播", TEAL_PALE, TEAL, 19, NAVY, True,
                  name="Leo responsibility")
    add_chevron(slide, 8.68, 4.06, 0.40, 0.42, TEAL, "Leo workbook arrow")
    add_label_box(slide, 9.22, 3.92, 3.05, 0.78,
                  "workbook｜compare／save／reopen", PURPLE_PALE, PURPLE, 18.5, NAVY, True,
                  name="Workbook responsibility")
    add_field_band(
        slide, 5.26,
        "`result_path`（結果路徑）｜來源：runner stdout｜作用：定位同一次 run 的 `result.json` 與 replay pair\n"
        "單位：檔案路徑｜判讀：以 stdout path 開啟；上傳端點：`/course`",
        line=BLUE, size=17, h=0.84, name="Result path field",
    )
    slide_notes(slide, (
        "Leo-side workflow 以 runner stdout 的 `result_path` 為唯一 artifact 入口。`result_path` 的來源是 runner stdout，"
        "作用是定位同一次 run 的 `result.json` 與配對 replay，單位為檔案路徑；判讀時以 stdout path 開啟，並保留同一個 generated run directory。"
        "`/course`（http://120.126.151.102:3000/course）的責任是驗證 schema、identity、units 與 provenance，materialize endpoint replay，並把 baseline、candidate 與 withheld record 保存到 workbook。"
        "網站不執行 policy source；網站呈現已驗證的 endpoint evidence。比較完成後保存並重新開啟 workbook，identity 或 evidence 缺件時維持原狀態。"
    ))


def slide_7(prs):
    slide = prepare_slide(prs, "O007｜`student_policy.py`：observation → action")
    add_text(slide, 1.02, 1.02, 11.28, 0.38,
             "讀取允許的 observation，依序判斷，回傳一個 legal action",
             23, NAVY, True, PP_ALIGN.CENTER, name="Policy anatomy proposition")

    add_field_band(
        slide, 1.52,
        "`observation`（決策觀測紀錄）｜來源：runner 每個 decision step｜作用：提供合法的 current／past inputs\n"
        "單位：structured record｜判讀：欄位供 branch 使用，future trace 與 result summary 不進入輸入",
        line=PURPLE, size=16.5, h=0.64, name="Observation field",
    )

    add_code_box(
        slide, 0.92, 2.34, 5.15, 3.46,
        "def choose_action(observation):\n"
        "    if not observation.contact_open:\n"
        "        return SLEEP\n"
        "    if observation.urgent_pending:\n"
        "        if due_in_s <= URGENT_MARGIN_S:\n"
        "            return SEND_URGENT\n"
        "    if queue_size >= BATCH_SIZE:\n"
        "        return FLUSH_BATCH\n"
        "    return WAIT",
        name="Policy code anatomy", size=17.5, line=PURPLE,
    )
    field_rows = [
        ("`contact_open`（窗口狀態）", "scenario trace", "合法 action gate", "bool", "false → SLEEP"),
        ("`urgent_pending`（緊急待送）", "queue ledger", "急件分支", "bool", "true → 檢查期限"),
        ("`urgent_due_in_s`（期限剩餘）", "traffic card", "比對 margin", "s", "越小越接近"),
        ("`queue_size`（佇列數）", "current queue", "batch decision", "count", "≥ batch → FLUSH"),
    ]
    add_label_box(slide, 6.42, 2.34, 1.70, 0.38, "欄位／中文", FIELD, LINE, 16,
                  NAVY, True, name="Policy field header 1", margins=(0.04, 0.01, 0.04, 0.01))
    add_label_box(slide, 8.16, 2.34, 1.25, 0.38, "來源", FIELD, LINE, 16,
                  NAVY, True, name="Policy field header 2", margins=(0.04, 0.01, 0.04, 0.01))
    add_label_box(slide, 9.46, 2.34, 1.45, 0.38, "作用", FIELD, LINE, 16,
                  NAVY, True, name="Policy field header 3", margins=(0.04, 0.01, 0.04, 0.01))
    add_label_box(slide, 10.96, 2.34, 0.62, 0.38, "單位", FIELD, LINE, 16,
                  NAVY, True, name="Policy field header 4", margins=(0.02, 0.01, 0.02, 0.01))
    add_label_box(slide, 11.63, 2.34, 1.08, 0.38, "判讀", FIELD, LINE, 16,
                  NAVY, True, name="Policy field header 5", margins=(0.02, 0.01, 0.02, 0.01))
    y = 2.76
    for index, row in enumerate(field_rows):
        fill = WHITE if index % 2 == 0 else FIELD
        widths = [1.70, 1.25, 1.45, 0.62, 1.08]
        x = 6.42
        for col, (value, width) in enumerate(zip(row, widths)):
            add_label_box(slide, x, y, width, 0.62, value, fill, LINE, 15.5,
                          INK, False, PP_ALIGN.LEFT,
                          name=f"Policy field row {index + 1}-{col + 1}",
                          margins=(0.04, 0.01, 0.04, 0.01), line_spacing=0.88,
                          base_italic=col == 0)
            x += width + 0.01
        y += 0.66
    add_text(slide, 6.48, 5.54, 6.02, 0.30,
             "legal action：SLEEP／WAIT／SEND_ONE／SEND_URGENT／FLUSH_BATCH",
             16, TEAL, True, PP_ALIGN.CENTER, name="Legal action line")
    add_field_band(
        slide, 6.00,
        "`action`（策略動作）｜來源：policy API return｜作用：選擇下一個 state／packet 路徑\n"
        "單位：enum｜判讀：runner 將 token 展開成可回看的 event ledger",
        line=TEAL, size=16.5, h=0.52, name="Action field",
    )
    slide_notes(slide, (
        "`student_policy.py` 的 decision surface 是一個 bounded function。`observation` 是 runner 每個 decision step 提供的決策觀測紀錄，"
        "來源是 runner，作用是提供合法的 current／past inputs，單位為 structured record；判讀時只使用允許欄位，future trace 與 result summary 不進入輸入。"
        "程式片段依序讀取 `contact_open`、`urgent_pending`、`urgent_due_in_s` 與 `queue_size`，每個欄位都在右側標示來源、作用、單位與判讀方式。"
        "`action` 是 policy API return 的策略動作，作用是選擇下一個 state／packet 路徑，單位為 enum；runner 將 SLEEP、WAIT、SEND_ONE、SEND_URGENT 或 FLUSH_BATCH 展開成 event ledger。"
    ))


def slide_8(prs):
    slide = prepare_slide(prs, "O008｜可編輯面：active marked block")
    add_text(slide, 1.02, 1.02, 11.28, 0.38,
             "每次只改一個 marker；其餘 policy 與 course contract 維持凍結",
             23, NAVY, True, PP_ALIGN.CENTER, name="Edit boundary proposition")

    add_code_box(
        slide, 0.92, 1.70, 5.08, 3.42,
        "student_policy.py\n\n"
        "# === LORA EDITABLE: lab-a-pace-rest ===\n"
        "PACE_GAP_STEPS = 2\n"
        "REST_DURING_GAP = SLEEP\n"
        "\n"
        "# === LORA EDITABLE: lab-b-enter-exit-hold ===\n"
        "STABLE_STEPS = 2\n"
        "\n"
        "# === LORA EDITABLE: lab-c-batch-urgent ===\n"
        "URGENT_MARGIN_S = 20",
        name="Marked policy file", size=16.5, line=BLUE,
    )
    add_section_label(slide, 6.46, 1.70, 2.70, "可編輯：active block", TEAL, TEAL_PALE)
    editable = [
        "一個 bounded constant 或 branch",
        "`WAIT`／`SLEEP` 等 typed symbol",
        "一個 causal variable + prediction",
    ]
    y = 2.28
    for index, line_text in enumerate(editable):
        add_dot(slide, 6.56, y + 0.10, 0.16, TEAL, name=f"Editable dot {index + 1}")
        add_text(slide, 6.84, y, 5.22, 0.36, line_text, 18.5, INK,
                 False, PP_ALIGN.LEFT, name=f"Editable rule {index + 1}")
        y += 0.50

    add_section_label(slide, 6.46, 3.98, 2.70, "保護：course contract", RED, RED_PALE)
    protected = [
        "scenario／quality trace／traffic",
        "schemas／runner／energy model",
        "generated result／replay JSON",
        "Leo source／baseline policy",
    ]
    y = 4.54
    for index, line_text in enumerate(protected):
        add_dot(slide, 6.56, y + 0.10, 0.16, RED, name=f"Protected dot {index + 1}")
        add_text(slide, 6.84, y, 5.22, 0.32, line_text, 17.5, INK,
                 False, PP_ALIGN.LEFT, name=f"Protected rule {index + 1}")
        y += 0.36
    add_label_box(
        slide, 0.92, 5.24, 5.08, 0.82,
        "`policy identity`（策略識別）｜來源：receipt\n"
        "作用：連結 edit／predecessor\n"
        "判讀：hidden／surprise 不變",
        GOLD_PALE, GOLD, 15.5, NAVY, False, PP_ALIGN.LEFT,
        name="Policy identity field", margins=(0.10, 0.02, 0.10, 0.02),
        line_spacing=0.88,
    )
    slide_notes(slide, (
        "可編輯面限於 `student_policy.py` 的 active marked block。Lab A、Lab B、Lab C 各有一個 marker；每次只改一個 bounded constant 或 branch，"
        "並在執行前保存 prediction。scenario、quality trace、traffic、schemas、runner、energy model 與 generated result／replay JSON 均屬於 course contract 的保護範圍。"
        "`policy identity` 的來源是 runner receipt 與 result provenance，作用是連結本次 edit 與 predecessor，單位為 content identity；"
        "判讀時，hidden 與 surprise 必須沿用 frozen policy，結果差異由 withheld condition 解釋。"
    ))


def slide_9(prs):
    slide = prepare_slide(prs, "O009｜exact run 產生可配對的 result 與 replay")
    add_text(slide, 1.02, 1.02, 11.28, 0.46,
             "同一個 case、同一個 package root、同一次 run identity 產生兩個 JSON artifact",
             24, NAVY, True, PP_ALIGN.CENTER, name="Exact run proposition")

    add_section_label(slide, 1.02, 1.78, 2.06, "POSIX／WSL", TEAL, TEAL_PALE)
    add_code_box(slide, 0.92, 2.24, 5.46, 1.16,
                 "bash course.sh run --lab A --case baseline",
                 name="POSIX exact run", size=20, line=TEAL)
    add_text(slide, 1.16, 3.56, 4.98, 0.44,
             "package root → runner → stdout result path",
             20, NAVY, True, PP_ALIGN.CENTER, name="POSIX run meaning")

    add_section_label(slide, 6.82, 1.78, 2.06, "Windows", BLUE, BLUE_PALE)
    add_code_box(slide, 6.72, 2.24, 5.50, 1.16,
                 "course.cmd run --lab A --case baseline",
                 name="Windows exact run", size=20, line=BLUE)
    add_text(slide, 6.96, 3.56, 5.00, 0.44,
             "package root → runner → stdout result path",
             20, NAVY, True, PP_ALIGN.CENTER, name="Windows run meaning")

    add_label_box(slide, 1.10, 4.30, 5.58, 0.88,
                  '{"status":"OK",\n"result_path":"artifacts/<run_id>/result.json"}',
                  CODE, LINE, 19, INK, False, PP_ALIGN.CENTER,
                  name="Expected stdout", margins=(0.10, 0.04, 0.10, 0.04),
                  base_italic=True)
    add_label_box(slide, 6.84, 4.30, 5.36, 0.88,
                  "同一目錄：`endpoint-replay.json`\n"
                  "同一 `run_id`｜summary + events + source",
                  TEAL_PALE, TEAL, 19, NAVY, True,
                  name="Paired artifact", margins=(0.12, 0.04, 0.12, 0.04))
    add_text(slide, 1.14, 5.38, 11.04, 0.38,
             "result_path 以 stdout 為準；配對 replay 取同一個 generated run directory。",
             20, NAVY, True, PP_ALIGN.CENTER, name="Result path rule")
    add_field_band(
        slide, 5.88,
        "`run_id`（執行識別碼）｜來源：runner result identity｜作用：配對 `result.json` 與 `endpoint-replay.json`\n"
        "單位：content identity｜判讀：同一次 run 的 path、summary、events 與 replay 必須一致",
        line=TEAL, size=17.5, h=0.72, name="Run identity field",
    )
    slide_notes(slide, (
        "exact run 在 package root 執行；POSIX／WSL 使用 `bash course.sh`，Windows 使用 `course.cmd`，兩者都呼叫 package-local runner。"
        "baseline 命令會依固定 case 產生 stdout payload。`run_id` 是執行識別碼，來源是 runner result identity，作用是配對 `result.json` 與 `endpoint-replay.json`，"
        "單位為 content identity；判讀時確認同一次 run 的 path、summary、events 與 replay 一致。預期 stdout 以 `status: OK` 和 `result_path` 指出 artifact；"
        "result path 直接取自 stdout，不以猜測的目錄名稱替代。"
    ))


def slide_10(prs):
    slide = prepare_slide(prs, "O010｜`/course`：artifact → endpoint evidence")
    add_text(slide, 1.00, 1.02, 11.32, 0.38,
             "網站只處理已產生的 artifact：驗證、重播、ledger 與 workbook",
             23, NAVY, True, PP_ALIGN.CENTER, name="Course evidence proposition")

    add_picture(slide, EVIDENCE_METRICS, 0.92, 1.62, 5.64, 0.48,
                "Current evidence metrics crop")
    add_picture(slide, EVIDENCE_FRAME, 0.92, 2.22, 5.64, 1.12,
                "Current evidence replay frame crop")
    add_picture(slide, EVIDENCE_LEDGER, 0.92, 3.54, 5.64, 0.36,
                "Current evidence execution ledger crop")
    add_text(slide, 0.98, 4.04, 5.50, 0.30,
             "current evidence/course-20260811 · artifact source：same-scenario fallback",
             15.5, MUTED, False, PP_ALIGN.CENTER, name="Current evidence provenance")

    jobs = [
        ("01", "validate／import", "schema、identity、units、provenance", BLUE, BLUE_PALE),
        ("02", "endpoint replay", "radio、action、queue、contact、quality、J", TEAL, TEAL_PALE),
        ("03", "ledger／workbook", "service gate、比較、保存與 reopen", PURPLE, PURPLE_PALE),
    ]
    y = 1.62
    for number, heading, body, line, fill in jobs:
        add_box(slide, 6.96, y, 5.26, 0.90, fill, line,
                name=f"Website job {number}")
        add_text(slide, 7.18, y + 0.16, 0.54, 0.28, number, 20, line,
                 True, PP_ALIGN.CENTER, name=f"Website job number {number}")
        add_text(slide, 7.88, y + 0.14, 2.18, 0.30, heading, 18.5, NAVY,
                 True, PP_ALIGN.LEFT, name=f"Website job heading {number}")
        add_text(slide, 7.88, y + 0.50, 4.02, 0.24, body, 16.5, INK,
                 False, PP_ALIGN.LEFT, name=f"Website job body {number}")
        y += 1.02
    add_label_box(slide, 7.10, 4.90, 4.92, 0.52,
                  "endpoint radio／processing；LEO／system energy 維持獨立",
                  GOLD_PALE, GOLD, 16.5, NAVY, True,
                  name="Website scope boundary", margins=(0.08, 0.02, 0.08, 0.02))
    add_field_band(
        slide, 5.58,
        "`service`（服務結果）｜來源：imported result summary｜作用：判斷 required delivery、deadline、freshness\n"
        "單位：pass／fail｜判讀：網站先呈現服務 gate，再顯示 endpoint energy 與 replay context",
        line=BLUE, size=16.5, h=0.72, name="Service evidence field",
    )
    slide_notes(slide, (
        "current `/course` evidence 顯示 endpoint metrics、replay frame 與 execution ledger；畫面上的資料類型標示為同情境 fallback，"
        "fresh local runner receipt 狀態維持待取得。網站的三個工作是 validate／import、endpoint replay 與 ledger／workbook。"
        "`service` 是服務結果，來源為 imported result summary，作用是判斷 required delivery、deadline 與 freshness，單位為 pass／fail；"
        "判讀順序是服務 gate、replay context 與 endpoint energy。網站保留 endpoint radio／processing scope，LEO／system energy 維持獨立 evidence layer。"
    ))


def slide_11(prs):
    slide = prepare_slide(prs, "O011｜結果判讀：service → state → endpoint J")
    add_text(slide, 1.02, 1.02, 11.28, 0.38,
             "同一個 result／replay pair 依服務、事件、端點能量三層完成解釋",
             23, NAVY, True, PP_ALIGN.CENTER, name="Interpretation proposition")

    tiers = [
        (0.92, 1.62, 5.82, 0.88, BLUE_PALE, BLUE,
         "01  SERVICE GATE｜服務閘門",
         "required delivery／deadline／freshness → `service_pass`"),
        (0.92, 2.68, 5.82, 1.04, TEAL_PALE, TEAL,
         "02  PACKET + RADIO｜封包狀態",
         "action → `radio_state` interval → attempt／retry／delivery／expiry"),
        (0.92, 3.90, 5.82, 0.92, PURPLE_PALE, PURPLE,
         "03  ENDPOINT ENERGY｜端點能量",
         "state power × time → `endpoint_energy_j`（J）"),
    ]
    for index, (x, y, w, h, fill, line, heading, body) in enumerate(tiers):
        add_box(slide, x, y, w, h, fill, line, name=f"Interpretation tier {index + 1}")
        add_text(slide, x + 0.22, y + 0.13, w - 0.44, 0.28, heading, 18.5,
                 line, True, PP_ALIGN.LEFT, name=f"Interpretation tier heading {index + 1}")
        add_text(slide, x + 0.22, y + 0.49, w - 0.44, h - 0.58, body,
                 16.5, INK, False, PP_ALIGN.LEFT, name=f"Interpretation tier body {index + 1}")
    add_chevron(slide, 3.74, 2.54, 0.22, 0.10, BLUE, "Tier connector 1")
    add_chevron(slide, 3.74, 3.76, 0.22, 0.10, TEAL, "Tier connector 2")

    ratio = add_box(slide, 6.96, 1.62, 5.30, 1.92, GOLD_PALE, GOLD,
                    name="Endpoint bit per J card")
    add_text(slide, 7.24, 1.84, 4.74, 0.32,
             "`endpoint bit/J`（端點能量效率）", 20, GOLD, True,
             PP_ALIGN.CENTER, name="Endpoint ratio heading")
    add_text(slide, 7.30, 2.34, 4.60, 0.96,
             "來源：result summary\n單位：bit/J\n作用：delivered bits ÷ endpoint J\n判讀：service gate 通過後再解讀",
             16.5, INK, False, PP_ALIGN.LEFT, name="Endpoint ratio explanation")

    boundary = add_box(slide, 6.96, 3.62, 5.30, 1.56, RED_PALE, RED,
                       name="Claim boundary card")
    add_text(slide, 7.24, 3.86, 4.74, 0.26,
             "evidence boundary", 21, RED, True, PP_ALIGN.CENTER,
             name="Claim boundary heading")
    add_text(slide, 7.24, 4.30, 4.74, 0.62,
             "endpoint J ≠ LEO／system／canonical\n"
             "claim ceiling 隨 artifact 保存",
             16, NAVY, True, PP_ALIGN.CENTER, name="Claim boundary explanation")

    add_field_band(
        slide, 5.28,
        "`radio_state`（無線狀態）｜來源：runner events／endpoint replay｜作用：說明每段 state duration 與 energy bucket\n"
        "單位：state enum + duration｜判讀：把 action 連回 packet、service 與 `endpoint_energy_j`",
        line=TEAL, size=16.5, h=0.68, name="Radio state field",
    )
    add_text(slide, 1.20, 6.10, 11.00, 0.22,
             CLAIM_BOUNDARY,
             15.5, MUTED, False, PP_ALIGN.CENTER, name="Claim ceiling")
    slide_notes(slide, (
        "結果判讀固定沿三層進行。`service_pass` 是服務是否通過的布林結果，必須先讀 required delivery、deadline 與 freshness；"
        "packet 與 radio state 事件接著說明 action 如何造成 attempt、retry、delivery、expiry 與 state duration。`radio_state` 的來源是 runner events 與 endpoint replay，"
        "作用是說明每段 state duration 與 energy bucket，單位為 state enum 加 duration；判讀時把 action 連回 packet、service 與 `endpoint_energy_j`。"
        "`endpoint_energy_j` 只描述 endpoint radio／processing model 累積的 J。`endpoint bit/J` 的來源是 result summary，單位是 bit/J，作用是描述 delivered bits 與 endpoint J 的比值，"
        "判讀順序要求 service gate 通過後再解讀。LEO、system 與 canonical energy 維持獨立 evidence layer；所有資料保持 " + CLAIM_BOUNDARY + "。"
    ))


SLIDE_BUILDERS = [
    slide_1, slide_2, slide_3, slide_4,
    slide_setup_overview, slide_setup_windows, slide_setup_linux,
    slide_setup_macos, slide_setup_ready,
    slide_5, slide_6,
    slide_7, slide_8, slide_9, slide_10, slide_11,
]

SLIDE_SOURCES = [
    {"slide": "O001", "source": "ADR-004; SDD §6; package README.zh-TW.md", "role": "endpoint-first product boundary"},
    {"slide": "O002", "source": "course-story-contract.md; donor insertion map", "role": "changing-service-window example"},
    {"slide": "O003", "source": "package README.zh-TW.md; venv-platform-contract.md", "role": "package capability inventory"},
    {"slide": "O004", "source": "course-story-contract.md; experiment-operation-contract.md", "role": "prediction and causal evidence loop"},
    {"slide": "O004a", "source": "/home/u24/lora-energy-lab/README.zh-TW.md section 1; setup launcher tests", "role": "cross-platform setup order"},
    {"slide": "O004b", "source": "/home/u24/lora-energy-lab/README.zh-TW.md Windows section; setup.cmd", "role": "Windows manual setup"},
    {"slide": "O004c", "source": "/home/u24/lora-energy-lab/README.zh-TW.md Linux section; setup.sh", "role": "Linux and WSL manual setup"},
    {"slide": "O004d", "source": "/home/u24/lora-energy-lab/README.zh-TW.md macOS section; setup.sh", "role": "macOS manual setup"},
    {"slide": "O004e", "source": "/home/u24/lora-energy-lab/run_lab.py verify_setup; current verify receipt", "role": "READY success and meaning"},
    {"slide": "O005", "source": "package README.zh-TW.md; venv-platform-contract.md", "role": "package-side setup/verify workflow"},
    {"slide": "O006", "source": "course-story-contract.md; part-c-visible-content.md P076–P080", "role": "result import/replay/workbook workflow"},
    {"slide": "O007", "source": "student_policy.py; SDD §8", "role": "policy API anatomy"},
    {"slide": "O008", "source": "package README.zh-TW.md; SDD §8", "role": "editable and protected surface"},
    {"slide": "O009", "source": "package README.zh-TW.md; SDD §9.3–9.5", "role": "exact run and paired artifacts"},
    {"slide": "O010", "source": "current-evidence/course-20260811 clean crops; SDD §10–11", "role": "website responsibility and current evidence"},
    {"slide": "O011", "source": "ADR-004; SDD §9.6; part-b-field-audit.md", "role": "service-first endpoint evidence boundary"},
]


def emit_outline(path: Path) -> None:
    prs = Presentation(str(path))
    slides = []
    for index, slide in enumerate(prs.slides):
        title = slide.shapes.title.text if slide.shapes.title is not None else ""
        slides.append({
            "order": index + 1,
            "page_id": f"O{index + 1:03d}",
            "title": title,
            "notes": slide.notes_slide.notes_text_frame.text,
            "layout": "slideLayout2.xml",
            "source": SLIDE_SOURCES[index],
            "current_evidence": "same-scenario fallback crop" if "/course 接收" in title else "editable diagram / package contract",
        })
    manifest = {
        "deck": "LoRaEnergySim-LEO-ALT-OPENING-V2-REVIEW",
        "template": str(TEMPLATE),
        "template_sha256": "3a90b0106c6587d720b5a46c653a31937ccd649b30890563c70a53c4cc5d25b8",
        "shell": "source slide 2 / slideLayout2.xml only",
        "background_author_fill": "unset",
        "font_contract": {"cjk": "標楷體", "latin": "Times New Roman"},
        "title_pt": 28,
        "body_baseline_pt": 24,
        "minimum_authored_text_pt": 16,
        "claim_boundary": CLAIM_BOUNDARY,
        "slides": slides,
    }
    OUTLINE_OUTPUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def basic_package_report(path: Path) -> dict:
    """Small early-export report; full recursive QA is in qa/structural_qa.py."""
    with zipfile.ZipFile(path) as archive:
        slide_names = sorted(
            (name for name in archive.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)),
            key=lambda value: int(re.search(r"(\d+)", value).group(1)),
        )
        notes_names = [name for name in archive.namelist() if re.fullmatch(r"ppt/notesSlides/notesSlide\d+\.xml", name)]
        layout_targets = []
        for slide_name in slide_names:
            rel_name = f"ppt/slides/_rels/{Path(slide_name).name}.rels"
            rel_root = ET.fromstring(archive.read(rel_name))
            layout_targets.extend(
                rel.get("Target")
                for rel in rel_root.findall(f"{{{PKG_REL_NS}}}Relationship")
                if rel.get("Type", "").endswith("/slideLayout")
            )
    return {
        "output": str(path),
        "slide_count": len(slide_names),
        "notes_count": len(notes_names),
        "layout_targets": sorted(set(layout_targets)),
        "status": "EARLY_VALID" if len(slide_names) == 16 and len(notes_names) == 16 and all(target.endswith("slideLayout2.xml") for target in layout_targets) else "CHECK",
    }


def build() -> None:
    if not TEMPLATE.exists():
        raise FileNotFoundError(TEMPLATE)
    prs = Presentation(str(TEMPLATE))
    remove_all_slides(prs)
    for builder in SLIDE_BUILDERS:
        builder(prs)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(OUTPUT))
    overlay_template_parts(OUTPUT)
    outline = emit_outline(OUTPUT)
    report = basic_package_report(OUTPUT)
    QA_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    QA_OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    build()
