#!/usr/bin/env python3
"""Build the owned C-120 Part B V2 slice P046-P063.

This lane is intentionally self-contained.  It uses the server-approved
educate template as a native python-pptx source, creates every page from
source slide 2 / slideLayout2, and restores the template-owned master, theme,
logo, footer and notes-master parts after the editable content is authored.
"""

from __future__ import annotations

import copy
import hashlib
import json
import os
import posixpath
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
REPO = ROOT.parents[3]
LATEST_ROOT = ROOT.parent / "latest"
TEMPLATE = Path("/home/u24/pptx-wrap/assets/templates/educate.pptx")
WIP_ROOT = Path(os.environ.get("C120_B046_P063_WORK_ROOT", "/tmp/c120-style-b046-p063"))
OUTPUT = WIP_ROOT / "LoRaEnergySim-LEO-ALT-PART-B-V2-P046-P063-REVIEW.pptx"
QA_DIR = ROOT / "qa"
BUILD_DIR = ROOT / "build"
RENDER_DIR = ROOT / "renders"
MANIFEST = ROOT / "slides.json"
NOTES_MD = ROOT / "speaker-notes.md"
README = ROOT / "README.md"

P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
OFFICE_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

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
GRAY = "D7DEEA"
COOL = "F7F8FC"
CREAM = "FFF9E6"
WHITE = "FFFFFF"

CLAIM_BOUNDARY = "SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED"
EVIDENCE_STATUS = "資料界線：固定 scenario 的 simulated teaching data；結果以本次 stdout result_path 與同目錄 replay 為準"

FORBIDDEN = (
    "學生", "老師", "講師", "你", "請", "分鐘", "checksum", "ZIP test",
    "production notes", "製作備註", "SHA", "先辨認 radio state，才談省電",
    "舊截圖", "截圖安排", "版面", "講稿提示", "這一頁不", "本頁不",
)


def rgb(value: str) -> RGBColor:
    return RGBColor.from_string(value)


def mark_tokens(text: str) -> list[tuple[str, bool]]:
    """Return visible text and italic markers for backtick-delimited code."""
    pieces = re.split(r"(`[^`]+`)", text)
    output: list[tuple[str, bool]] = []
    for piece in pieces:
        if not piece:
            continue
        if piece.startswith("`") and piece.endswith("`"):
            output.append((piece[1:-1], True))
        else:
            output.append((piece, False))
    return output


def set_script_fonts(run, *, italic: bool = False, bold: bool = False,
                     size: float = 20, color: str = INK) -> None:
    run.font.name = "Times New Roman"
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = rgb(color)
    rpr = run._r.get_or_add_rPr()
    rpr.set("sz", str(int(size * 100)))
    rpr.set("b", "1" if bold else "0")
    rpr.set("i", "1" if italic else "0")
    for tag, face in (("latin", "Times New Roman"), ("ea", "標楷體"), ("cs", "Times New Roman")):
        node = rpr.find(qn(f"a:{tag}"))
        if node is None:
            node = OxmlElement(f"a:{tag}")
            rpr.append(node)
        node.set("typeface", face)


def write_text(tf, text: str, size: float = 20, *, color: str = INK,
               bold: bool = False, align=PP_ALIGN.LEFT,
               valign=MSO_ANCHOR.TOP, italic_all: bool = False,
               margins=(0.08, 0.04, 0.08, 0.04), line_spacing: float = 1.0) -> None:
    tf.clear()
    tf.word_wrap = True
    tf.vertical_anchor = valign
    tf.margin_left = Inches(margins[0])
    tf.margin_top = Inches(margins[1])
    tf.margin_right = Inches(margins[2])
    tf.margin_bottom = Inches(margins[3])
    for index, line_text in enumerate(str(text).split("\n")):
        paragraph = tf.paragraphs[0] if index == 0 else tf.add_paragraph()
        paragraph.alignment = align
        paragraph.line_spacing = line_spacing
        paragraph.space_before = Pt(0)
        paragraph.space_after = Pt(0)
        parts = [(line_text, italic_all)] if italic_all else mark_tokens(line_text)
        for visible, marked in parts:
            run = paragraph.add_run()
            run.text = visible
            set_script_fonts(run, italic=marked, bold=bold, size=size, color=color)


def text_box(slide, x: float, y: float, w: float, h: float, text: str,
             size: float = 20, *, color: str = INK, bold: bool = False,
             align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP, fill: str | None = None,
             line: str | None = None, radius: bool = False, name: str = "Editable text",
             italic_all: bool = False, margins=(0.08, 0.04, 0.08, 0.04),
             line_spacing: float = 1.0):
    kind = MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE
    if fill is None and line is None:
        shape = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
        shape.fill.background()
        shape.line.fill.background()
    else:
        shape = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
        if fill is None:
            shape.fill.background()
        else:
            shape.fill.solid()
            shape.fill.fore_color.rgb = rgb(fill)
        if line is None:
            shape.line.fill.background()
        else:
            shape.line.color.rgb = rgb(line)
            shape.line.width = Pt(1.2)
    shape.name = name
    write_text(shape.text_frame, text, size, color=color, bold=bold, align=align,
               valign=valign, italic_all=italic_all, margins=margins,
               line_spacing=line_spacing)
    return shape


def box(slide, x: float, y: float, w: float, h: float, *, fill: str = WHITE,
        line: str = BLUE, radius: bool = True, name: str = "Editable figure"):
    kind = MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE
    shape = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.name = name
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb(fill)
    if line:
        shape.line.color.rgb = rgb(line)
        shape.line.width = Pt(1.2)
    else:
        shape.line.fill.background()
    return shape


def chevron(slide, x: float, y: float, w: float = 0.34, h: float = 0.42,
            color: str = NAVY, name: str = "Mechanism connector"):
    shape = slide.shapes.add_shape(MSO_SHAPE.CHEVRON, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.name = name
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb(color)
    shape.line.fill.background()
    return shape


def pill(slide, x: float, y: float, w: float, h: float, text: str,
         fill: str, line: str, *, size: float = 18, color: str = NAVY,
         name: str = "Mechanism label"):
    return text_box(slide, x, y, w, h, text, size, color=color, bold=True,
                    align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
                    fill=fill, line=line, radius=True, name=name,
                    margins=(0.03, 0.01, 0.03, 0.01), line_spacing=0.92)


def card(slide, x: float, y: float, w: float, h: float, heading: str, body: str,
         fill: str, line: str, *, body_size: float = 19,
         heading_size: float = 19, name: str = "Teaching card",
         compact: bool = False, body_line_spacing: float = 0.96,
         body_margins=(0.03, 0.02, 0.03, 0.02), body_inset: float = 0.18):
    box(slide, x, y, w, h, fill=fill, line=line, name=name)
    if compact:
        heading_y, heading_h = y + 0.07, 0.28
        body_y, body_h = y + 0.37, h - 0.44
        heading_margins = (0.01, 0.0, 0.01, 0.0)
    else:
        heading_y, heading_h = y + 0.12, 0.36
        body_y, body_h = y + 0.56, h - 0.68
        heading_margins = (0.02, 0.0, 0.02, 0.0)
    text_box(slide, x + 0.16, heading_y, w - 0.32, heading_h, heading,
             heading_size, color=line, bold=True, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE, name=f"{name} heading",
             margins=heading_margins, line_spacing=0.92)
    text_box(slide, x + body_inset, body_y, w - (2 * body_inset), body_h, body,
             body_size, color=INK, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE, name=f"{name} body",
             margins=body_margins, line_spacing=body_line_spacing)


def title(slide, value: str) -> None:
    shape = slide.shapes.title
    if shape is None:
        shape = slide.shapes.add_textbox(Inches(0.718057), Inches(0.204514), Inches(10.34861), Inches(0.525))
    shape.left = Inches(0.718057)
    shape.top = Inches(0.204514)
    shape.width = Inches(10.34861)
    shape.height = Inches(0.525)
    shape.name = "Native layout2 title"
    write_text(shape.text_frame, value, 28, color=NAVY, bold=True,
               valign=MSO_ANCHOR.MIDDLE, margins=(0.01, 0.0, 0.01, 0.0),
               line_spacing=1.0)


def clear_authored_placeholders(slide) -> None:
    keep = {
        PP_PLACEHOLDER.TITLE,
        PP_PLACEHOLDER.DATE,
        PP_PLACEHOLDER.FOOTER,
        PP_PLACEHOLDER.SLIDE_NUMBER,
        PP_PLACEHOLDER.HEADER,
    }
    for shape in list(slide.placeholders):
        if shape.placeholder_format.type not in keep:
            shape._element.getparent().remove(shape._element)


def prepare(prs: Presentation, page_title: str):
    slide = prs.slides.add_slide(prs.slide_layouts[1])
    clear_authored_placeholders(slide)
    title(slide, page_title)
    return slide


def evidence_tag(slide, text: str = EVIDENCE_STATUS, *, y: float = 5.76,
                 color: str = MUTED, fill: str = COOL, line: str = GRAY,
                 size: float = 16, name: str = "Evidence status"):
    return text_box(slide, 0.88, y, 11.58, 0.44, text, size, color=color,
                    align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
                    fill=fill, line=line, radius=True, name=name,
                    margins=(0.03, 0.01, 0.03, 0.01), line_spacing=0.9)


def note(page: int, narration: str, recovery: str) -> str:
    return (
        f"P{page:03d}。{narration} "
        f"目前 evidence 尚待取得，數值欄位維持待補；讀取時使用本次 stdout 印出的 result_path，"
        f"並以同一產物目錄的 endpoint-replay.json 配對。{recovery} "
        f"資料分類維持 {CLAIM_BOUNDARY}。"
    )


def draw_p046(prs):
    slide = prepare(prs, "P046｜A freeze：hidden 入場 gate")
    text_box(slide, 0.94, 1.05, 11.35, 0.42,
             "freeze receipt 綁定 policy lineage；hidden 只接受對得上的 checkpoint。",
             22, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P046 lead", margins=(0.02, 0.0, 0.02, 0.0))
    nodes = [
        ("A baseline", "原始 policy\n固定 scenario／seed", BLUE, BLUE_PALE),
        ("candidate + freeze", "`REST_DURING_GAP =`\n`WAIT` + freeze receipt", PURPLE, PURPLE_PALE),
        ("hidden entry", "frozen policy\n新 case 條件", TEAL, TEAL_PALE),
    ]
    x = 0.78
    for idx, (heading, body, line_color, fill) in enumerate(nodes):
        card(slide, x, 1.74, 3.56, 1.50, heading, body, fill, line_color,
             body_size=19, heading_size=19, name=f"P046 lineage {idx + 1}")
        if idx < 2:
            chevron(slide, x + 3.68, 2.28, color=GOLD, name="P046 lineage gate connector")
        x += 4.12
    field_cards = [
        ("freeze receipt｜凍結收據", "來源：`--freeze` output；hidden gate", PURPLE, PURPLE_PALE),
        ("checkpoint｜策略快照", "來源：同 run `.json + .py`；復原 policy", BLUE, BLUE_PALE),
        ("predecessor｜前序 policy", "來源：freeze receipt；edit 前 control", TEAL, TEAL_PALE),
        ("active_block_id｜作用區塊", "來源：freeze receipt；唯一 marked block", GOLD, GOLD_PALE),
    ]
    for idx, (heading, body, line_color, fill) in enumerate(field_cards):
        x = 0.86 + (idx % 2) * 6.00
        y = 3.52 + (idx // 2) * 1.00
        card(slide, x, y, 5.56, 0.82, heading, body, fill, line_color,
             body_size=16, heading_size=16, name=f"P046 field card {idx + 1}",
             compact=True, body_line_spacing=0.88,
             body_margins=(0.01, 0.0, 0.01, 0.0))
    pill(slide, 2.12, 5.58, 9.10, 0.34, "entry rule：checkpoint 存在、identity 對得上，才進入 hidden", GOLD_PALE, GOLD, size=17)
    evidence_tag(slide, y=5.98)
    slide.notes_slide.notes_text_frame.text = note(
        46,
        "本頁說明 A freeze 的作用。candidate 的 A marked block 已改為 WAIT，freeze receipt 同時記錄目前 policy、前序 policy、scenario、seed role 與作用區塊。checkpoint 是可復原的 policy source，並與 receipt identity 配對。hidden 不是新的調參階段，而是 frozen policy 在另一個 case 條件下的檢驗。",
        "若 receipt 或 checkpoint 缺失，從 baseline policy 還原後重新執行 A candidate 的 `--freeze`；不得直接進入 hidden。",
    )


def draw_p047(prs):
    slide = prepare(prs, "P047｜A hidden：frozen policy 的反例")
    text_box(slide, 0.96, 1.05, 11.25, 0.42,
             "withheld case 改變條件，不改 policy；結果界定 claim ceiling。",
             22, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P047 lead", margins=(0.02, 0.0, 0.02, 0.0))
    card(slide, 0.86, 1.72, 5.58, 2.60, "FROZEN POLICY｜凍結策略",
         "來源：A checkpoint\n`REST_DURING_GAP = WAIT` 保持不變\n新 freeze：0\npolicy edit：0\n同一 policy identity + 新 case",
         BLUE_PALE, BLUE, body_size=20, heading_size=20, name="P047 frozen policy")
    card(slide, 6.86, 1.72, 5.58, 2.60, "WITHHELD EVIDENCE｜保留條件證據",
         "來源：P042 第三條 stdout `result_path`\n條件：hidden contact／traffic\n`endpoint_energy_j`（端點能量）：待補 J\n`delivered_bits`（交付資料）：待補 bit\n`service_pass`（服務布林狀態）：待補",
         GOLD_PALE, GOLD, body_size=18, heading_size=20, name="P047 hidden evidence")
    box(slide, 1.00, 4.66, 11.34, 0.84, fill=COOL, line=GRAY, name="P047 claim ceiling")
    text_box(slide, 1.20, 4.82, 10.94, 0.50,
             "counterexample：同一 policy identity 在新 case 出現不同 outcome；結論只限於可支持的條件。",
             20, color=RED, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P047 counterexample text", margins=(0.02, 0.0, 0.02, 0.0))
    pill(slide, 2.12, 5.66, 9.10, 0.43, "withheld = 檢驗條件；frozen = 不再調參", RED_PALE, RED, size=18)
    slide.notes_slide.notes_text_frame.text = note(
        47,
        "本頁讀取 hidden 結果。withheld case 是預先定義的新 contact 或 traffic 條件，frozen policy identity 保持不變，所以差異歸因於 case，而不是新的 edit。counterexample 是使原先方向失去普遍性的結果；它會降低 claim ceiling，並保留在 workbook 的 lineage 中。",
        "若 hidden path 缺失，從 `artifacts/checkpoints/lab-a-frozen.py` 還原 policy，重新執行 exact hidden case，使用新 stdout result_path。",
    )


def draw_p048(prs):
    slide = prepare(prs, "P048｜Lab A 結論：用因果句讀 state 與 J")
    text_box(slide, 0.96, 1.05, 11.26, 0.42,
             "結論要連到 state、service 與 endpoint J，不只報一個數。",
             22, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P048 lead", margins=(0.02, 0.0, 0.02, 0.0))
    labels = [
        ("條件", "同一 scenario\nA frozen identity", BLUE, BLUE_PALE),
        ("state mechanism", "`WAIT`／`SLEEP`\nstate interval", PURPLE, PURPLE_PALE),
        ("packet／service", "delivery、deadline、freshness\nservice gate", TEAL, TEAL_PALE),
        ("endpoint J", "`endpoint_energy_j`\n端點 radio／processing", GOLD, GOLD_PALE),
    ]
    x = 0.62
    for idx, (head, body, line_color, fill) in enumerate(labels):
        card(slide, x, 1.72, 2.78, 1.50, head, body, fill, line_color,
             body_size=19, heading_size=19, name=f"P048 causal node {idx + 1}")
        if idx < 3:
            chevron(slide, x + 2.88, 2.28, color=line_color, name="P048 causal connector")
        x += 3.10
    box(slide, 0.92, 3.62, 11.48, 1.12, fill=CREAM, line=GOLD, name="P048 sentence builder")
    text_box(slide, 1.14, 3.82, 11.04, 0.72,
             "在 ______ trace，`REST_DURING_GAP` 從 `SLEEP` 改為 `WAIT`，透過 ______ state 改變 ______ packet／service evidence；`endpoint_energy_j` ______。hidden trace ______，因此結論限於 ______。",
             20, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P048 sentence text", margins=(0.05, 0.01, 0.05, 0.01), line_spacing=0.95)
    pill(slide, 1.34, 5.10, 10.64, 0.48, "三個 result／replay pair 的 identity、state、service 與 J 共同決定句子內容", COOL, BLUE, size=18)
    evidence_tag(slide, y=5.72)
    slide.notes_slide.notes_text_frame.text = note(
        48,
        "本頁收束 Lab A。`state_interval`（狀態區間）來源是 result events，單位為秒，作用是把 action 連到時間與 energy bucket。packet outcome 來源是 result summary 與 replay，service_pass 來源是 service gate；`endpoint_energy_j` 來源是同一 result 的 endpoint energy breakdown，單位為 J。結論不以單一數字代替機制，也保留 hidden 的反例條件。",
        "若三個 result／replay pair 的 identity 無法配對，回到 A freeze gate，重新取得正確 stdout result_path；不手改 JSON。",
    )


def draw_p049(prs):
    slide = prepare(prs, "P049｜Lab B：品質 hold 的窗口邊界")
    text_box(slide, 0.94, 1.05, 11.35, 0.46,
             "品質 hold 改變 send-ready timing；窗口會決定代價。",
             22, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P049 lead", margins=(0.02, 0.0, 0.02, 0.0))
    # Editable quality/service-window trace.
    box(slide, 0.84, 1.70, 7.64, 2.88, fill=COOL, line=BLUE, name="P049 quality trace figure")
    text_box(slide, 1.08, 1.86, 2.50, 0.30, "quality trace（品質軌跡）", 19, color=BLUE, bold=True,
             name="P049 quality trace label", margins=(0.01, 0.0, 0.01, 0.0))
    text_box(slide, 5.60, 1.86, 2.52, 0.30, "來源：scenario package", 16, color=MUTED, align=PP_ALIGN.RIGHT,
             name="P049 quality source", margins=(0.01, 0.0, 0.01, 0.0))
    # Three quality bars, with explicit interpretation labels.
    for idx, (label, fill, line_color, width) in enumerate([
        ("closed：0", RED_PALE, RED, 1.26),
        ("weak：1", GOLD_PALE, GOLD, 1.42),
        ("usable：2 → strong：3", TEAL_PALE, TEAL, 2.42),
    ]):
        x = 1.16 + sum(item[3] + 0.10 for item in [
            ("closed：0", RED_PALE, RED, 1.26),
            ("weak：1", GOLD_PALE, GOLD, 1.42),
            ("usable：2 → strong：3", TEAL_PALE, TEAL, 2.42),
        ][:idx])
        box(slide, x, 2.45, width, 0.60, fill=fill, line=line_color, radius=False,
            name=f"P049 quality band {idx + 1}")
        text_box(slide, x + 0.04, 2.62, width - 0.08, 0.22, label, 16, color=line_color,
                 bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
                 name=f"P049 quality band label {idx + 1}", margins=(0.01, 0.0, 0.01, 0.0))
    text_box(slide, 1.18, 3.26, 6.88, 0.84,
             "`enter`：進入 send-ready\n`hold`：連續穩定的步數\n`exit`：品質下降後退出 send-ready",
             18, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P049 transition definitions", margins=(0.04, 0.01, 0.04, 0.01))
    card(slide, 8.78, 1.70, 3.70, 2.88, "CHALLENGE｜挑戰",
         "等待 quality 穩定\n可能降低失敗／重傳\n但 contact window 會關閉\n\n成功 gate：packet delivery + deadline + freshness + endpoint J",
         PURPLE_PALE, PURPLE, body_size=19, heading_size=20, name="P049 challenge")
    box(slide, 0.94, 4.82, 11.40, 0.78, fill=GOLD_PALE, line=GOLD, name="P049 causal path")
    text_box(slide, 1.14, 4.94, 11.00, 0.54,
             "`service_window`（服務窗口，s；來源：scenario contact windows；作用：合法傳輸機會）\n`quality_band`（品質等級，band）＋`stable_steps`（穩定步數，steps）→ `MODE_CHANGE` → packet／service／J",
             16, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P049 causal path text", margins=(0.02, 0.0, 0.02, 0.0))
    evidence_tag(slide, y=5.72)
    slide.notes_slide.notes_text_frame.text = note(
        49,
        "Lab B 的輸入是 quality trace，來源為固定 scenario package，數值是 quality band 與 elapsed time。service window 來源為 scenario contact windows，單位是秒，作用是界定合法傳輸機會。enter、hold、exit 描述 send-ready mode 的三個 transition 條件。實驗的唯一控制點是 stable hold，結果要沿 MODE_CHANGE、packet、service 與 endpoint J 讀取。",
        "若 A predecessor 不是 frozen，先還原 `artifacts/checkpoints/lab-a-frozen.py`，完成 compile 後再開始 B。",
    )


def draw_p050(prs):
    slide = prepare(prs, "P050｜ENTER_QUALITY：進入 send-ready")
    text_box(slide, 0.96, 1.05, 11.28, 0.42,
             "ENTER_QUALITY=2 決定何時進入 send-ready；不是 energy knob。",
             22, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P050 lead", margins=(0.02, 0.0, 0.02, 0.0))
    box(slide, 0.86, 1.70, 5.00, 3.20, fill=COOL, line=BLUE, name="P050 threshold ladder")
    text_box(slide, 1.14, 1.88, 4.54, 0.28, "quality_band（品質等級）：0–3", 19, color=BLUE, bold=True,
             align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="P050 ladder label", margins=(0.01, 0.0, 0.01, 0.0))
    for idx, value in enumerate((0, 1, 2, 3)):
        y = 4.34 - idx * 0.58
        line_color = TEAL if value >= 2 else MUTED
        fill = TEAL_PALE if value >= 2 else WHITE
        box(slide, 1.42, y, 3.86, 0.42, fill=fill, line=line_color, radius=False,
            name=f"P050 level {value}")
        text_box(slide, 1.54, y + 0.10, 3.62, 0.22,
                 f"quality {value}｜{'可作為 enter 候選' if value >= 2 else '尚未達 enter'}",
                 17, color=line_color, bold=value >= 2, align=PP_ALIGN.CENTER,
                 valign=MSO_ANCHOR.MIDDLE, name=f"P050 level label {value}", margins=(0.01, 0.0, 0.01, 0.0))
    card(slide, 6.18, 1.70, 6.24, 1.50, "CODE｜policy constant",
         "`ENTER_QUALITY = 2`\n來源：`student_policy.py` B marked block\n單位：quality band；作用：進入門檻",
         BLUE_PALE, BLUE, body_size=19, heading_size=19, name="P050 code")
    card(slide, 6.18, 3.34, 6.24, 1.82, "MECHANISM｜mode entry",
         "未進入：`quality_band ≥ 2`\n且 `stable_steps ≥ STABLE_STEPS`\n→ `send_mode_active = true`\n來源：MODE_CHANGE；保持 send-ready",
         TEAL_PALE, TEAL, body_size=18, heading_size=19, name="P050 mechanism",
         body_line_spacing=0.86)
    pill(slide, 1.34, 5.24, 10.64, 0.40, "baseline：ENTER=2、EXIT=1、STABLE_STEPS=2；candidate 只動第三項", GOLD_PALE, GOLD, size=17)
    evidence_tag(slide, y=5.72)
    slide.notes_slide.notes_text_frame.text = note(
        50,
        "`ENTER_QUALITY` 是 policy constant，來源是 `student_policy.py` 的 B marked block，單位為 quality band，作用是設定進入 send-ready 的最低 quality。`stable_steps` 是 runner observation，單位為連續 step，作用是抑制短暫尖峰。`send_mode_active` 是 policy mode 的布林狀態，來源是 MODE_CHANGE event。baseline 值是 2、1、2；本實驗的唯一修改會放在 STABLE_STEPS。",
        "若 B block 的 baseline 值與頁面不一致，停止並恢復 A frozen predecessor，再檢查 release policy。",
    )


def draw_p051(prs):
    slide = prepare(prs, "P051｜EXIT_QUALITY：雙閾值形成 hysteresis")
    text_box(slide, 0.96, 1.05, 11.28, 0.42,
             "EXIT_QUALITY=1 讓已進入模式在 weak quality 中保持，降低邊界切換。",
             22, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P051 lead", margins=(0.02, 0.0, 0.02, 0.0))
    box(slide, 0.92, 1.70, 7.10, 3.54, fill=COOL, line=PURPLE, name="P051 hysteresis figure")
    text_box(slide, 1.18, 1.88, 6.58, 0.28, "quality band 隨時間下降：enter 與 exit 不共用同一條線", 18,
             color=PURPLE, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P051 figure label", margins=(0.01, 0.0, 0.01, 0.0))
    # Draw two threshold rails and a falling quality trace.
    for value, y, color, label in ((2, 2.54, TEAL, "進入：quality ≥ 2"), (1, 3.76, PURPLE, "退出：quality < 1")):
        text_box(slide, 1.24, y - 0.15, 1.90, 0.28, label, 17, color=color, bold=True,
                 name=f"P051 threshold {value}", margins=(0.01, 0.0, 0.01, 0.0))
        box(slide, 3.20, y, 4.30, 0.08, fill=color, line=color, radius=False,
            name=f"P051 threshold rail {value}")
    points = [(3.36, 2.35), (4.18, 2.42), (5.00, 2.72), (5.82, 3.18), (6.64, 3.54), (7.28, 4.02)]
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        # Sloped editable connectors are represented by thin rectangles with
        # no text dependency; the threshold labels provide the mechanism.
        line_shape = slide.shapes.add_connector(1, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
        line_shape.name = "P051 quality trace"
        line_shape.line.color.rgb = rgb(GOLD)
        line_shape.line.width = Pt(2.2)
    for x, y in points:
        dot = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x - 0.07), Inches(y - 0.07), Inches(0.14), Inches(0.14))
        dot.name = "P051 quality point"
        dot.fill.solid(); dot.fill.fore_color.rgb = rgb(GOLD); dot.line.color.rgb = rgb(GOLD)
    card(slide, 8.38, 1.70, 4.06, 1.62, "CODE｜雙閾值",
         "`ENTER_QUALITY = 2`\n`EXIT_QUALITY = 1`\n來源：B marked block\n單位：quality band",
         PURPLE_PALE, PURPLE, body_size=19, heading_size=19, name="P051 code")
    card(slide, 8.38, 3.56, 4.06, 1.78, "INTERPRET｜保持與退出",
         "已進入：quality ≥ 1 → send-ready\nquality < 1 → `MODE_CHANGE` 退出\n`hysteresis`：雙閾值；降低來回",
         GOLD_PALE, GOLD, body_size=17, heading_size=19, name="P051 interpret",
         body_line_spacing=0.86)
    evidence_tag(slide, y=5.72)
    slide.notes_slide.notes_text_frame.text = note(
        51,
        "`EXIT_QUALITY` 來源是 B marked block，單位為 quality band，作用是設定已進入 send-ready 後的退出門檻。ENTER=2 與 EXIT=1 形成 hysteresis：未進入要達到 2，已進入只要維持 1 或以上。這個設計預期減少 mode ping-pong，但是否改變 retry、service 或 endpoint J，必須由 MODE_CHANGE 與 result evidence 驗證。",
        "若 transition evidence 缺失，保留 result 與 replay，回到同一次 stdout result_path 重新選取 pair；不改寫 JSON。",
    )


def draw_p052(prs):
    slide = prepare(prs, "P052｜STABLE_STEPS：拒絕短暫尖峰")
    text_box(slide, 0.94, 1.05, 11.36, 0.42,
             "`STABLE_STEPS = 2` 要求兩個連續 clock step；candidate 的 bounded edit 是 `2 → 1`。",
             22, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P052 lead", margins=(0.02, 0.0, 0.02, 0.0))
    card(slide, 0.84, 1.72, 5.56, 2.62, "短暫 spike｜hold 不足",
         "quality band：0 → 2 → 0\n`stable_steps`：1 → 0\n`STABLE_STEPS = 2`\n`send_mode_active` 保持 false\n結果：不因單步尖峰進入 send-ready",
         BLUE_PALE, BLUE, body_size=19, heading_size=20, name="P052 spike")
    card(slide, 6.86, 1.72, 5.56, 2.62, "連續穩定｜達到 hold",
         "quality band：2 → 2\n`stable_steps`：1 → 2\n`STABLE_STEPS = 2`\n`send_mode_active` 可能切為 true\n結果：MODE_CHANGE 時機改變",
         TEAL_PALE, TEAL, body_size=19, heading_size=20, name="P052 stable")
    chevron(slide, 6.48, 2.80, color=GOLD, name="P052 comparison connector")
    box(slide, 1.00, 4.72, 11.34, 0.78, fill=GOLD_PALE, line=GOLD, name="P052 prediction")
    text_box(slide, 1.18, 4.88, 10.98, 0.42,
             "prediction：hold=1 可能提早 `MODE_CHANGE` 一個固定 step；觀察 transition → `PACKET_ATTEMPT` → deadline／service → `endpoint_energy_j`。",
             18, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P052 prediction text", margins=(0.02, 0.0, 0.02, 0.0))
    evidence_tag(slide, y=5.72)
    slide.notes_slide.notes_text_frame.text = note(
        52,
        "`STABLE_STEPS` 來源是 `student_policy.py` B marked block，單位是連續 clock steps。runner 每個固定 10 s step 更新 stable count；達到 2 才能切換 `send_mode_active`。candidate 只將 2 改為 1，所以預測是 enter transition 可能提早一個 step，後續再觀察 packet attempt、deadline、service 與 endpoint J。",
        "若 prediction 尚未記錄，不先解讀結果；保留目前 policy，完成 prediction 後再進入 Trace A baseline。",
    )


def draw_p053(prs):
    slide = prepare(prs, "P053｜Trace A：先寫 enter／hold／exit 預測")
    text_box(slide, 0.94, 1.05, 11.34, 0.42,
             "A frozen predecessor 固定；B candidate 尚未執行，預測先於 result。",
             22, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P053 lead", margins=(0.02, 0.0, 0.02, 0.0))
    box(slide, 0.78, 1.70, 7.56, 3.50, fill=COOL, line=TEAL, name="P053 Trace A figure")
    text_box(slide, 1.04, 1.88, 6.98, 0.28, "Trace A quality_band + contact window（輸入軌跡）", 18,
             color=TEAL, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P053 trace label", margins=(0.01, 0.0, 0.01, 0.0))
    line_shape = slide.shapes.add_connector(1, Inches(1.20), Inches(3.62), Inches(7.84), Inches(3.62))
    line_shape.name = "P053 trace axis"; line_shape.line.color.rgb = rgb(MUTED); line_shape.line.width = Pt(1.6)
    points = [(1.30, 4.12), (2.12, 3.94), (2.94, 3.58), (3.76, 3.10), (4.58, 3.26), (5.40, 2.92), (6.22, 3.08), (7.04, 3.86), (7.78, 4.18)]
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        segment = slide.shapes.add_connector(1, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
        segment.name = "P053 quality trace"; segment.line.color.rgb = rgb(TEAL); segment.line.width = Pt(2.1)
    for x, y in points:
        marker = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x - 0.07), Inches(y - 0.07), Inches(0.14), Inches(0.14))
        marker.name = "P053 trace point"; marker.fill.solid(); marker.fill.fore_color.rgb = rgb(TEAL); marker.line.color.rgb = rgb(TEAL)
    for x, label_value, color in ((3.76, "enter：step ____", BLUE), (5.40, "hold：____ steps", GOLD), (7.04, "exit：quality ____", PURPLE)):
        pill(slide, x - 0.64, 4.52, 1.28, 0.38, label_value, WHITE, color, size=16, color=color, name=f"P053 prompt {label_value}")
    card(slide, 8.68, 1.70, 3.76, 3.50, "PREDICTION RECORD｜預測紀錄",
         "`ENTER_QUALITY = 2`\n`EXIT_QUALITY = 1`\n`STABLE_STEPS = 2 → 1`\n\n我預期：\n`MODE_CHANGE` ______\npacket／service ______\nJ ______，因為 ______",
         PURPLE_PALE, PURPLE, body_size=18, heading_size=19, name="P053 prediction record")
    evidence_tag(slide, y=5.72)
    slide.notes_slide.notes_text_frame.text = note(
        53,
        "本頁在 Trace A 上記錄預測。`quality_band` 的單位是 teaching band，`MODE_CHANGE` 來源是 result events，單位是 event record；prediction 要指出第一次達到 enter 門檻的 step、hold 所需的連續 steps、exit 的 quality 條件，以及 packet／service／J 的方向。policy 只能使用當下與過去 observation，不使用 future trace 或 result summary。",
        "若 A policy 不是 frozen，從 `artifacts/checkpoints/lab-a-frozen.py` 還原並完成 compile；B edit 在後續 operation page 執行。",
    )


def draw_p054(prs):
    slide = prepare(prs, "P054｜B-01：Trace A baseline control")
    text_box(slide, 0.94, 1.05, 11.34, 0.42,
             "baseline 固定 A predecessor 與 B baseline；result_path 是本次證據的唯一入口。",
             22, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P054 lead", margins=(0.02, 0.0, 0.02, 0.0))
    card(slide, 0.84, 1.72, 5.56, 2.74, "BASELINE DECISION｜原始分支",
         "A：`REST_DURING_GAP = WAIT` 保持 frozen\nB：`STABLE_STEPS = 2`\n未進入：quality ≥ 2 且 stable_steps ≥ 2\n已進入：quality ≥ 1 才保持 send-ready\n來源：policy + Trace A",
         BLUE_PALE, BLUE, body_size=18, heading_size=19, name="P054 baseline decision")
    card(slide, 6.86, 1.72, 5.56, 2.74, "READ EVIDENCE｜讀取欄位",
         "`result_path`（結果路徑）\n來源：runner stdout；單位：字串 path\n`endpoint-replay.json`（事件重播檔）\n來源：同一 generated run；作用：state／queue／packet\n各值：待補",
         TEAL_PALE, TEAL, body_size=18, heading_size=19, name="P054 baseline evidence")
    box(slide, 1.00, 4.84, 11.34, 0.66, fill=GOLD_PALE, line=GOLD, name="P054 control rule")
    text_box(slide, 1.18, 5.00, 10.98, 0.32,
             "control interpretation：hold=2 的原始 behavior；candidate 只改 hold，才能比較 transition 後的 packet／service／J。",
             18, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P054 control text", margins=(0.02, 0.0, 0.02, 0.0))
    evidence_tag(slide, y=5.72)
    slide.notes_slide.notes_text_frame.text = note(
        54,
        "Trace A baseline 使用 A frozen predecessor 與 B 的原始 STABLE_STEPS=2。`result_path` 來源是 runner stdout，資料型態是字串路徑；配對的 endpoint-replay.json 必須來自同一個產物目錄。讀取順序是 MODE_CHANGE、packet outcome、service_pass 與 endpoint_energy_j。baseline 只建立 control，不回答 hold=1 是否更好。",
        "若 baseline pair 缺失，重新執行 `bash course.sh run --lab B --case trace-a-baseline` 或 Windows 等價命令，接受新的 stdout result_path。",
    )


def draw_p055(prs):
    slide = prepare(prs, "P055｜B-02：只改 STABLE_STEPS：2 → 1")
    text_box(slide, 0.94, 1.05, 11.34, 0.42,
             "exact edit：A、B 與 C block 不變；只測試 B hold。",
             22, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P055 lead", margins=(0.02, 0.0, 0.02, 0.0))
    box(slide, 0.82, 1.70, 5.80, 2.62, fill=PURPLE_PALE, line=PURPLE, name="P055 code block")
    text_box(slide, 1.02, 1.88, 5.40, 0.28, "student_policy.py｜lab-b-enter-exit-hold", 18, color=PURPLE, bold=True,
             align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="P055 code heading", margins=(0.01, 0.0, 0.01, 0.0))
    text_box(slide, 1.08, 2.30, 5.24, 1.52,
             "`ENTER_QUALITY = 2`  # original\n`EXIT_QUALITY = 1`    # original\n`STABLE_STEPS = 2`     # original\n\n唯一修改：`STABLE_STEPS = 1`",
             18, color=INK, italic_all=True, valign=MSO_ANCHOR.MIDDLE,
             name="P055 code lines", margins=(0.04, 0.02, 0.04, 0.02), line_spacing=0.92)
    card(slide, 6.92, 1.70, 5.50, 1.18, "WHY｜為何選這一行",
         "hold 長度先改變 MODE_CHANGE timing。",
         BLUE_PALE, BLUE, body_size=18, heading_size=18, name="P055 why")
    card(slide, 6.84, 3.00, 5.58, 1.78, "COMPILE｜備份與語法 gate",
         "`cp student_policy.py student_policy.before-B-edit.py`\n`.venv/bin/python -m py_compile student_policy.py`\n`copy /Y student_policy.py student_policy.before-B-edit.py`\n`.venv\\Scripts\\python.exe -m py_compile student_policy.py`",
         COOL, GRAY, body_size=16, heading_size=18, name="P055 compile",
         body_line_spacing=0.76, body_margins=(0.0, 0.0, 0.0, 0.0), body_inset=0.0)
    box(slide, 1.00, 4.88, 11.34, 0.56, fill=GOLD_PALE, line=GOLD, name="P055 prediction")
    text_box(slide, 1.18, 4.96, 10.98, 0.38,
             "prediction：hold=1 可能早送；先核對 transition、service、endpoint J。",
             17, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P055 prediction text", margins=(0.02, 0.0, 0.02, 0.0))
    evidence_tag(slide, y=5.72)
    slide.notes_slide.notes_text_frame.text = note(
        55,
        "本頁只改 `student_policy.py` 的 `lab-b-enter-exit-hold` marked block。ENTER=2 與 EXIT=1 定義進出 threshold，STABLE_STEPS 定義進入前的連續 observation 數；因此將 2 改為 1，能把 transition timing 的變化連到 hold，而不混入其他 policy。備份與 py_compile 只驗證檔案可恢復及語法成立，不產生結果數值。",
        "若 compile 失敗，從 `student_policy.before-B-edit.py` 還原；A frozen block 與 runner 不作修改。",
    )


def draw_p056(prs):
    slide = prepare(prs, "P056｜B-03：三段 run 共用 receipt")
    text_box(slide, 0.94, 1.05, 11.34, 0.42,
             "三次 exact run 共用 stdout result_path；candidate freeze 後才進 Trace B。",
             20, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P056 lead", margins=(0.02, 0.0, 0.02, 0.0))
    stages = [
        ("1｜Trace A baseline", "bash course.sh run\n--lab B --case\ntrace-a-baseline", "course.cmd run\n--lab B --case\ntrace-a-baseline", BLUE, BLUE_PALE, "result_path｜artifact_source 待補"),
        ("2｜candidate --freeze", "bash course.sh run\n--lab B --case\ntrace-a-candidate --freeze", "course.cmd run\n--lab B --case\ntrace-a-candidate --freeze", PURPLE, PURPLE_PALE, "result_path +\nlab-b-frozen.{json,py}"),
        ("3｜Trace B withheld", "bash course.sh run\n--lab B --case\ntrace-b", "course.cmd run\n--lab B --case\ntrace-b", TEAL, TEAL_PALE, "result_path｜同 run replay"),
    ]
    x = 0.58
    for idx, (heading, posix, windows, line_color, fill, receipt) in enumerate(stages):
        box(slide, x, 1.66, 3.92, 3.90, fill=fill, line=line_color, name=f"P056 ribbon {idx + 1}")
        text_box(slide, x + 0.12, 1.84, 3.68, 0.30, heading, 17, color=line_color, bold=True,
                 align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"P056 heading {idx + 1}", margins=(0.01, 0.0, 0.01, 0.0))
        text_box(slide, x + 0.18, 2.25, 3.56, 0.22, "POSIX / WSL", 18, color=line_color, bold=True,
                 align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"P056 POSIX label {idx + 1}", margins=(0.01, 0.0, 0.01, 0.0))
        text_box(slide, x + 0.16, 2.55, 3.60, 0.82, posix, 18, color=INK, italic_all=True,
                 align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"P056 POSIX command {idx + 1}", margins=(0.0, 0.0, 0.0, 0.0), line_spacing=0.82)
        text_box(slide, x + 0.18, 3.60, 3.56, 0.22, "Windows CMD", 18, color=line_color, bold=True,
                 align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"P056 Windows label {idx + 1}", margins=(0.01, 0.0, 0.01, 0.0))
        text_box(slide, x + 0.16, 3.90, 3.60, 0.82, windows, 18, color=INK, italic_all=True,
                 align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"P056 Windows command {idx + 1}", margins=(0.0, 0.0, 0.0, 0.0), line_spacing=0.82)
        text_box(slide, x + 0.18, 4.86, 3.56, 0.58, receipt, 18, color=line_color, bold=True,
                 align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"P056 receipt {idx + 1}", margins=(0.0, 0.0, 0.0, 0.0), line_spacing=0.82)
        x += 4.14
    pill(slide, 0.98, 5.70, 11.38, 0.44, "read：baseline → edit → candidate freeze → Trace B｜same run replay", GOLD_PALE, GOLD, size=18)
    slide.notes_slide.notes_text_frame.text = note(
        56,
        "本頁集中 Lab B 的三條 exact command。第一條建立 Trace A baseline；第二條在 STABLE_STEPS=1 後執行 candidate 並建立 B freeze checkpoint；第三條保持 B frozen 執行 Trace B。每次成功 stdout 都提供新的 `result_path`，它是該次 result.json 的字串入口；配對 replay 必須在同一個產物目錄。candidate 的 status、artifact source 與 checkpoint 狀態均以實際 stdout 和檔案為準。",
        "任一步失敗都保留 stdout／stderr；若 candidate freeze 缺失，不進 Trace B，先從 A checkpoint 還原並重跑 candidate freeze。",
    )


def draw_p057(prs):
    slide = prepare(prs, "P057｜B-04：MODE_CHANGE 接到 service")
    text_box(slide, 0.94, 1.05, 11.34, 0.42,
             "quality band 是 context；MODE_CHANGE 把 hold edit 接到 packet／service／J。",
             20, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P057 lead", margins=(0.02, 0.0, 0.02, 0.0))
    nodes = [
        ("quality_band", "品質等級\n來源：observation", BLUE, BLUE_PALE),
        ("MODE_CHANGE", "模式切換事件\n來源：events", PURPLE, PURPLE_PALE),
        ("PACKET_ATTEMPT", "封包嘗試\n來源：events／replay", GOLD, GOLD_PALE),
        ("service + J", "deadline／delivery／J\n來源：summary", TEAL, TEAL_PALE),
    ]
    x = 0.62
    for idx, (heading, body, line_color, fill) in enumerate(nodes):
        card(slide, x, 1.70, 2.78, 1.38, heading, body, fill, line_color,
             body_size=17, heading_size=18, name=f"P057 node {idx + 1}")
        if idx < 3:
            chevron(slide, x + 2.88, 2.20, color=line_color, name="P057 causal connector")
        x += 3.04
    card(slide, 0.84, 3.46, 5.58, 1.66, "TRACE A CANDIDATE｜欄位讀法",
         "`attempted_packets`（嘗試封包）：待補 count\n`retransmissions`（重傳）：待補 count\n`delivered_bits`（交付資料）：待補 bit\n`expired_packets`（逾時封包）：待補 count",
         BLUE_PALE, BLUE, body_size=16, heading_size=18, name="P057 metrics",
         body_line_spacing=0.84)
    card(slide, 6.90, 3.46, 5.58, 1.66, "SERVICE GATE｜判讀順序",
         "`deadline_pass`（期限布林）：待補\n`service_pass`（服務布林）：待補\n`endpoint_energy_j`（端點能量）：待補 J\n數值均由 P056 stdout path 讀取",
         GOLD_PALE, GOLD, body_size=16, heading_size=18, name="P057 service",
         body_line_spacing=0.84)
    pill(slide, 1.16, 5.40, 11.00, 0.40, "candidate 的 hold=1 只有在 transition 改變 packet／service／J 時才形成可解釋 evidence", COOL, PURPLE, size=17)
    evidence_tag(slide, y=5.84)
    slide.notes_slide.notes_text_frame.text = note(
        57,
        "本頁沿 candidate 的 result_path 觀察。`MODE_CHANGE` 是事件，描述 REST 與 SEND_READY 的切換；`PACKET_ATTEMPT` 是一次封包傳輸嘗試；attempted、retransmissions、delivered_bits 與 expired_packets 的單位分別是 count、count、bit、count。service_pass 與 deadline_pass 是獨立的布林 gate，endpoint_energy_j 是同一 endpoint scope 的 J。品質上升本身不等於服務成功。",
        "若 MODE_CHANGE、packet 或 service 欄位不存在，重新從 P056 選取同一 result／replay pair；不要修改產物內容。",
    )


def draw_p058(prs):
    slide = prepare(prs, "P058｜B-05：B freeze 是 Trace B gate")
    text_box(slide, 0.94, 1.05, 11.34, 0.42,
             "B checkpoint 綁住 A predecessor 與 STABLE_STEPS=1；Trace B 不再調參。",
             20, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P058 lead", margins=(0.02, 0.0, 0.02, 0.0))
    nodes = [
        ("A predecessor", "`lab-a-frozen.py`\n`REST_DURING_GAP =`\n`WAIT`", BLUE, BLUE_PALE),
        ("B checkpoint", "`lab-b-frozen.py`\n`STABLE_STEPS = 1`", PURPLE, PURPLE_PALE),
        ("Trace B entry", "P056 第三條 path\nwithheld case", TEAL, TEAL_PALE),
    ]
    x = 0.66
    for idx, (heading, body, line_color, fill) in enumerate(nodes):
        card(slide, x, 1.72, 3.58, 1.56, heading, body, fill, line_color,
             body_size=18, heading_size=19, name=f"P058 lineage {idx + 1}",
             body_line_spacing=0.84)
        if idx < 2:
            chevron(slide, x + 3.70, 2.28, color=GOLD, name="P058 lineage connector")
        x += 4.02
    box(slide, 0.86, 3.70, 11.62, 1.42, fill=COOL, line=GRAY, name="P058 checkpoint fields")
    text_box(slide, 1.10, 3.90, 11.10, 0.30, "checkpoint evidence（欄位用途）", 18, color=PURPLE, bold=True,
             align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="P058 field heading", margins=(0.01, 0.0, 0.01, 0.0))
    text_box(slide, 1.14, 4.30, 10.98, 0.54,
             "active_block_id：`lab-b-enter-exit-hold`｜predecessor：A frozen identity\nseed role：Trace A／Trace B｜receipt identity：candidate freeze",
             16, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P058 field body", margins=(0.02, 0.01, 0.02, 0.01), line_spacing=0.84)
    pill(slide, 1.22, 5.40, 10.90, 0.40, "entry gate：B checkpoint 存在且與 A predecessor 對得上；不符合時停止 Trace B", RED_PALE, RED, size=17)
    evidence_tag(slide, y=5.84)
    slide.notes_slide.notes_text_frame.text = note(
        58,
        "B freeze evidence 不是另一張結果頁，而是 Trace B 的 lineage gate。A predecessor 提供 Lab B 的固定前序 policy；B checkpoint 保存 STABLE_STEPS=1 的 frozen source；Trace B 只能使用同一 frozen policy。active_block_id 是作用區塊識別碼，seed role 是案例角色，receipt identity 是 candidate freeze 的收據識別，這些欄位一起決定是否具備 withheld 閱讀資格。",
        "若 B checkpoint 缺失或 predecessor 不符，從 `artifacts/checkpoints/lab-a-frozen.py` 還原，重做 P056 candidate `--freeze`；不得直接執行 Trace B。",
    )


def draw_p059(prs):
    slide = prepare(prs, "P059｜B-06：Trace B 界定泛化邊界")
    text_box(slide, 0.94, 1.05, 11.34, 0.42,
             "Trace B 只檢驗 hold=1 在新窗口／traffic 下的條件式效果，不接受 retune。",
             21, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P059 lead", margins=(0.02, 0.0, 0.02, 0.0))
    card(slide, 0.86, 1.72, 5.58, 2.78, "FROZEN POLICY｜固定不變",
         "來源：`lab-b-frozen.py`\nA：`REST_DURING_GAP = WAIT`\nB：`STABLE_STEPS = 1`\n新 freeze：0\n結果入口：P056 第三條 stdout path",
         BLUE_PALE, BLUE, body_size=19, heading_size=19, name="P059 frozen")
    card(slide, 6.86, 1.72, 5.58, 2.78, "TRACE B EVIDENCE｜值待補",
         "`expired_packets`（逾時封包）：待補 count\n`delivered_bits`（交付資料）：待補 bit\n`service_pass`（服務布林）：待補\n`endpoint_energy_j`（端點能量）：待補 J\n來源：同 run result／replay",
         GOLD_PALE, GOLD, body_size=18, heading_size=19, name="P059 Trace B evidence")
    box(slide, 1.02, 4.86, 11.30, 0.60, fill=RED_PALE, line=RED, name="P059 boundary")
    text_box(slide, 1.20, 4.98, 10.94, 0.36,
             "Trace B 方向不同 → 結論只限 Trace A，不外推 changing windows。",
             18, color=RED, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P059 boundary text", margins=(0.02, 0.0, 0.02, 0.0))
    evidence_tag(slide, y=5.72)
    slide.notes_slide.notes_text_frame.text = note(
        59,
        "Trace B 使用 P056 第三條 stdout result_path 與同目錄 replay。frozen policy 的 A、B 兩個 marked block 都不變，Trace B 的 case 條件才是新的因素。讀取 expired_packets、delivered_bits、service_pass 與 endpoint_energy_j，並把它們與 Trace A candidate 的 transition evidence 對照。Trace B 是 claim ceiling 的 evidence，不是要被調參消除的錯誤。",
        "若 Trace B path 缺失，從 `artifacts/checkpoints/lab-b-frozen.py` 還原，重新執行 `bash course.sh run --lab B --case trace-b` 或 Windows 等價命令。",
    )


def draw_p060(prs):
    slide = prepare(prs, "P060｜B-07：too-slow 與 ping-pong")
    text_box(slide, 0.94, 1.05, 11.34, 0.42,
             "service loss 可能來自 hold 過長或 enter／exit 過近；先分開事件證據。",
             20, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P060 lead", margins=(0.02, 0.0, 0.02, 0.0))
    card(slide, 0.84, 1.72, 5.56, 2.78, "TOO-SLOW｜進入太晚",
         "原因：`STABLE_STEPS` hold 太長\n機制：quality 達標後仍在 REST\n事件：較晚 `MODE_CHANGE`\n結果：contact window 用完\n觀察：deadline／expired／service",
         RED_PALE, RED, body_size=19, heading_size=20, name="P060 too slow")
    card(slide, 6.86, 1.72, 5.56, 2.78, "PING-PONG｜邊界來回",
         "原因：ENTER／EXIT 間隔太窄\n機制：mode 反覆切換\n事件：多次 `MODE_CHANGE`\n結果：retry／transition cost\n觀察：packet／energy ledger",
         GOLD_PALE, GOLD, body_size=19, heading_size=20, name="P060 ping pong")
    chevron(slide, 6.48, 2.84, color=NAVY, name="P060 comparison connector")
    box(slide, 1.00, 4.88, 11.34, 0.62, fill=COOL, line=GRAY, name="P060 comparison rule")
    text_box(slide, 1.16, 5.03, 11.02, 0.30,
             "判定：`MODE_CHANGE` + packet + service + endpoint ledger；quality 只是 context。",
             17, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P060 comparison text", margins=(0.02, 0.0, 0.02, 0.0))
    evidence_tag(slide, y=5.72)
    slide.notes_slide.notes_text_frame.text = note(
        60,
        "too-slow 與 ping-pong 使用不同的事件判定。too-slow 是 hold 長度使 send-ready 進入過晚，導致窗口或 deadline 失去機會；ping-pong 是 enter 與 exit 間隔太近，造成多次 MODE_CHANGE、retry 或 transition cost。兩者都必須以 event ledger、packet outcome、service verdict 與 endpoint energy 支持，不能只看一條 quality 曲線。",
        "若比較的兩筆結果 policy identity 不同，回到 B freeze，使用同一個 checkpoint 重新取得可配對的 result／replay。",
    )


def draw_p061(prs):
    slide = prepare(prs, "P061｜Lab B 結論：hysteresis 不是保證")
    text_box(slide, 0.94, 1.05, 11.34, 0.42,
             "Lab B 同時保留 Trace A mechanism 與 Trace B boundary。",
             20, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P061 lead", margins=(0.02, 0.0, 0.02, 0.0))
    card(slide, 0.84, 1.72, 5.56, 2.72, "TRACE A｜支持什麼",
         "policy identity：B frozen\n`STABLE_STEPS = 1`\n觀察：enter transition、packet、service、J\n結論欄位：待補\n適用條件：Trace A window／traffic",
         TEAL_PALE, TEAL, body_size=19, heading_size=20, name="P061 Trace A")
    card(slide, 6.86, 1.72, 5.56, 2.72, "TRACE B｜縮小什麼",
         "相同 frozen policy\n新 quality／window／traffic\n觀察：expired、deadline、service、J\nboundary 欄位：待補\n外推範圍：不成立",
         RED_PALE, RED, body_size=19, heading_size=20, name="P061 Trace B")
    box(slide, 1.00, 4.78, 11.34, 0.88, fill=GOLD_PALE, line=GOLD, name="P061 qualified conclusion")
    text_box(slide, 1.18, 4.94, 10.98, 0.56,
             "結論句：Trace A 的 hold=1 使 ______；Trace B 以 ______ 限制 service；有效條件：______。",
             18, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P061 conclusion text", margins=(0.03, 0.01, 0.03, 0.01))
    evidence_tag(slide, y=5.84)
    slide.notes_slide.notes_text_frame.text = note(
        61,
        "Lab B 結論要同時讀 P056 的 Trace A 與 Trace B result_path、policy identity、scenario identity、transition 與 service verdict。若 hold=1 在 Trace A 改善某個 packet 欄位，但 service_pass 仍未通過，結論只能描述該 trade-off；Trace B 的窗口或 traffic 限制會進一步縮小適用範圍。hysteresis 是條件設計，不是跨所有窗口的保證。",
        "若任一 result／replay pair 缺失，保留 B freeze，回到 stdout path 重新選檔，不重新執行或改寫 policy。",
    )


def draw_p062(prs):
    slide = prepare(prs, "P062｜中斷復原：policy 與 result 分開")
    text_box(slide, 0.94, 1.05, 11.34, 0.42,
             "復原 policy 只恢復 lineage；compile 後 rerun 才有新 result_path。",
             20, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P062 lead", margins=(0.02, 0.0, 0.02, 0.0))
    steps = [
        ("01｜copy", "最後 checkpoint\nA frozen／B frozen\nrelease baseline", BLUE, BLUE_PALE),
        ("02｜compile", "POSIX／Windows：先做 py_compile", PURPLE, PURPLE_PALE),
        ("03｜exact rerun", "重跑對應 case\n不改 scenario／runner／JSON", TEAL, TEAL_PALE),
        ("04｜new receipt", "保存新的\nstdout result_path\n配對同目錄 replay", GOLD, GOLD_PALE),
    ]
    x = 0.64
    for idx, (heading, body, line_color, fill) in enumerate(steps):
        card(slide, x, 1.72, 2.78, 1.60, heading, body, fill, line_color,
             body_size=16, heading_size=18, name=f"P062 step {idx + 1}",
             body_line_spacing=0.84)
        if idx < 3:
            chevron(slide, x + 2.88, 2.30, color=line_color, name="P062 step connector")
        x += 3.04
    box(slide, 0.82, 3.72, 5.70, 1.54, fill=COOL, line=BLUE, name="P062 POSIX restore")
    text_box(slide, 1.04, 3.90, 5.26, 0.24, "POSIX／WSL exact restore", 17, color=BLUE, bold=True,
             align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="P062 POSIX heading", margins=(0.01, 0.0, 0.01, 0.0))
    text_box(slide, 0.82, 4.22, 5.70, 0.84,
             "cp artifacts/checkpoints/lab-a-frozen.py student_policy.py\ncp artifacts/checkpoints/lab-b-frozen.py student_policy.py\ncp student_policy.baseline.py student_policy.py",
             16, color=INK, italic_all=False, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P062 POSIX commands", margins=(0.0, 0.0, 0.0, 0.0), line_spacing=0.84)
    box(slide, 6.82, 3.72, 5.70, 1.54, fill=COOL, line=PURPLE, name="P062 Windows restore")
    text_box(slide, 7.04, 3.90, 5.26, 0.24, "Windows Command Prompt exact restore", 17, color=PURPLE, bold=True,
             align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="P062 Windows heading", margins=(0.01, 0.0, 0.01, 0.0))
    text_box(slide, 6.82, 4.22, 5.70, 0.84,
             "copy /Y artifacts\\checkpoints\\lab-a-frozen.py student_policy.py\ncopy /Y artifacts\\checkpoints\\lab-b-frozen.py student_policy.py\ncopy /Y student_policy.baseline.py student_policy.py",
             16, color=INK, italic_all=False, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P062 Windows commands", margins=(0.0, 0.0, 0.0, 0.0), line_spacing=0.84)
    pill(slide, 1.18, 5.52, 10.98, 0.42, "policy checkpoint ≠ result artifact；遺失 result 時重跑 exact case，使用新 path，不手改 JSON", RED_PALE, RED, size=17)
    evidence_tag(slide, y=5.98)
    slide.notes_slide.notes_text_frame.text = note(
        62,
        "復原分成四個資料變化。copy 將最後一個 identity 正確的 policy checkpoint 放回 `student_policy.py`；compile 確認語法；exact rerun 在同一 scenario 與 case contract 下重新產生結果；新的 stdout result_path 與同目錄 endpoint-replay.json 成為新的 evidence pair。policy checkpoint 不會復原遺失的 result。release baseline 檔名依 package 實際檔案為 `student_policy.baseline.py`。",
        "若 result 或 replay 遺失，回到最後一個有效 checkpoint，先 compile，再重跑對應 case；主機受阻時保留 same-scenario fallback 的來源標籤。",
    )


def draw_p063(prs):
    slide = prepare(prs, "P063｜result.json：驗證、回放、工作簿")
    text_box(slide, 0.94, 1.05, 11.34, 0.42,
             "網站只驗證 runner evidence；不執行 policy，不改稱 endpoint energy。",
             20, color=NAVY, bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="P063 lead", margins=(0.02, 0.0, 0.02, 0.0))
    nodes = [
        ("RUNNER｜執行器", "stdout `result_path`\n選取該次 `result.json`", BLUE, BLUE_PALE),
        ("VALIDATOR｜檢核", "schema／identity／units\nprovenance：I／P／O\nresult.json；fail closed", PURPLE, PURPLE_PALE),
        ("REPLAY｜事件回放", "same run\n`endpoint-replay.json`\nstate／queue／packet", TEAL, TEAL_PALE),
        ("WORKBOOK｜比較", "baseline／candidate\nwithheld；lineage\ninterpretation", GOLD, GOLD_PALE),
    ]
    x = 0.58
    for idx, (heading, body, line_color, fill) in enumerate(nodes):
        card(slide, x, 1.72, 2.84, 1.52, heading, body, fill, line_color,
             body_size=16, heading_size=17, name=f"P063 bridge node {idx + 1}",
             body_line_spacing=0.80)
        if idx < 3:
            chevron(slide, x + 2.94, 2.28, color=line_color, name="P063 bridge connector")
        x += 3.06
    card(slide, 0.86, 3.72, 5.58, 1.66, "SUCCESS｜驗證通過",
         "同一 scenario／case／run identity\n同 run pair 產生 endpoint replay\nworkbook 留下 lineage record\nscope：endpoint radio／processing",
         TEAL_PALE, TEAL, body_size=16, heading_size=18, name="P063 success",
         body_line_spacing=0.82)
    card(slide, 6.86, 3.72, 5.58, 1.66, "REJECT｜fail closed",
         "schema／identity／units／provenance mismatch\n匯入拒絕，原 workbook 不變\n保留錯誤與 stdout path\n回到 P062 重跑 exact case",
         RED_PALE, RED, body_size=16, heading_size=18, name="P063 reject",
         body_line_spacing=0.82)
    pill(slide, 1.10, 5.50, 11.12, 0.40, "上傳 result evidence，不是 policy source；網站驗證、回放、保存，不重算 policy", COOL, NAVY, size=17)
    evidence_tag(slide, y=5.98)
    slide.notes_slide.notes_text_frame.text = note(
        63,
        "本頁將 result.json 接到 Leo /course。runner stdout 的 `result_path` 是輸入位置；validator 讀取 schema、scenario identity、case、units、policy lineage 與 provenance。通過後，網站讀取同一產物目錄的 endpoint-replay.json，materialize state、queue、packet 與 service evidence，並把 baseline、candidate、withheld record 放入 Energy Decision Workbook。網站不執行 `student_policy.py`，也不把 endpoint energy 對應為 current system/canonical energy。任何 mismatch 都 fail closed，原 workbook 維持不變。",
        "匯入失敗時保留錯誤與原始 stdout path，從 P062 checkpoint 重跑 exact case，再以新的 result/replay pair 重試；不手改 JSON。",
    )


BUILDERS = [
    draw_p046, draw_p047, draw_p048, draw_p049, draw_p050, draw_p051,
    draw_p052, draw_p053, draw_p054, draw_p055, draw_p056, draw_p057,
    draw_p058, draw_p059, draw_p060, draw_p061, draw_p062, draw_p063,
]


PAGE_NUMBERS = list(range(46, 64))

# Visible titles are semantic.  P046-P063 remain source-map identifiers only;
# they are intentionally absent from the authored title bars.
VISIBLE_TITLE_PREFIXES = [
    "A freeze：",
    "A hidden：",
    "Lab A 結論：",
    "Lab B：一個 hold 參數",
    "Lab B：找到唯一可編輯",
    "Lab B：Before",
    "Lab B：After",
    "Lab B：兩個穩定觀測",
    "Trace A：先建立",
    "Trace A 與 Trace B：Linux",
    "同一流程：Windows",
    "每次 run 都產生",
    "讀取結果：先看 service",
    "Trace A：candidate 送達",
    "Trace B：frozen candidate",
    "Lab B 結論：",
    "中斷時：",
    "result.json 匯入",
]


# ---------------------------------------------------------------------------
# Readability rebuild
# ---------------------------------------------------------------------------
# The first draft above is retained as historical source context.  The
# published builders below are deliberately sparse: one teaching move per
# page, one editable variable per edit page, and a field strip that names the
# source, unit, and interpretation of the first English token.

def rb_lead(slide, text: str, *, size: float = 22, color: str = NAVY,
            name: str = "Readable lead"):
    return text_box(slide, 0.92, 1.02, 11.48, 0.42, text, size, color=color,
                    bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
                    name=name, margins=(0.02, 0.0, 0.02, 0.0), line_spacing=0.94)


def rb_field(slide, field: str, chinese: str, source: str, purpose: str,
             unit: str, interpretation: str, *, y: float = 5.36):
    text = (
        f"`{field}`（{chinese}）｜來源：{source}｜作用：{purpose}｜"
        f"單位：{unit}｜判讀：{interpretation}"
    )
    return text_box(slide, 0.88, y, 11.58, 0.52, text, 16, color=NAVY,
                    align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.MIDDLE,
                    fill=BLUE_PALE, line=BLUE, radius=True,
                    name=f"Field strip {field}",
                    margins=(0.16, 0.01, 0.16, 0.01), line_spacing=0.86)


def rb_claim(slide, *, y: float = 5.98):
    return evidence_tag(slide, y=y, size=16, name="Claim boundary strip")


def rb_code_block(slide, x: float, y: float, w: float, h: float,
                  lines: list[str], *, target_index: int = -1,
                  target_value: str | None = None, name: str = "Code excerpt"):
    box(slide, x, y, w, h, fill=COOL, line=BLUE, name=name)
    line_h = h / (len(lines) + 1)
    start_y = y + 0.14
    for idx, line in enumerate(lines):
        line_y = start_y + idx * line_h
        if idx == target_index:
            if target_value is None:
                box(slide, x + 0.16, line_y - 0.02, w - 0.32, line_h - 0.03,
                    fill=GOLD_PALE, line=GOLD, radius=True,
                    name=f"{name} highlighted line")
                text_box(slide, x + 0.30, line_y, w - 0.60, line_h - 0.03,
                         line, 21, color=NAVY, bold=True,
                         valign=MSO_ANCHOR.MIDDLE, name=f"{name} target line",
                         margins=(0.02, 0.0, 0.02, 0.0), line_spacing=0.86)
            else:
                prefix = line.rsplit(target_value, 1)[0]
                suffix = line.rsplit(target_value, 1)[1]
                text_box(slide, x + 0.30, line_y, w - 1.28, line_h - 0.03,
                         prefix, 21, color=MUTED,
                         valign=MSO_ANCHOR.MIDDLE, name=f"{name} target prefix",
                         margins=(0.02, 0.0, 0.02, 0.0), line_spacing=0.86)
                value_x = x + 0.30 + min(3.90, len(prefix) * 0.12)
                box(slide, value_x, line_y + 0.01, 0.44, line_h - 0.06,
                    fill=GOLD_PALE, line=GOLD, radius=True,
                    name=f"{name} changed value")
                text_box(slide, value_x, line_y + 0.01, 0.44, line_h - 0.06,
                         target_value, 21, color=NAVY, bold=True,
                         align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
                         name=f"{name} changed value text",
                         margins=(0.0, 0.0, 0.0, 0.0), line_spacing=0.86)
                if suffix:
                    text_box(slide, value_x + 0.48, line_y, 1.20, line_h - 0.03,
                             suffix, 21, color=MUTED,
                             valign=MSO_ANCHOR.MIDDLE, name=f"{name} target suffix",
                             margins=(0.02, 0.0, 0.02, 0.0), line_spacing=0.86)
        else:
            color = MUTED if line.strip().startswith(("#", "ENTER", "EXIT")) else INK
            text_box(slide, x + 0.30, line_y, w - 0.60, line_h - 0.03,
                     line, 20, color=color,
                     valign=MSO_ANCHOR.MIDDLE, name=f"{name} line {idx + 1}",
                     margins=(0.02, 0.0, 0.02, 0.0), line_spacing=0.86)


def rb_command_card(slide, x: float, y: float, w: float, h: float,
                    heading: str, body: str, line_color: str, fill: str,
                    *, size: float = 18, name: str = "Command card"):
    box(slide, x, y, w, h, fill=fill, line=line_color, name=name)
    text_box(slide, x + 0.14, y + 0.12, w - 0.28, 0.34, heading, 19,
             color=line_color, bold=True, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE, name=f"{name} heading",
             margins=(0.01, 0.0, 0.01, 0.0), line_spacing=0.86)
    text_box(slide, x + 0.20, y + 0.54, w - 0.40, h - 0.66, body, size,
             color=INK, align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.MIDDLE,
             name=f"{name} command", margins=(0.02, 0.0, 0.02, 0.0),
             line_spacing=0.76)


def rb_number(slide, x: float, y: float, value: str, line_color: str,
              fill: str, *, w: float = 0.44):
    box(slide, x, y, w, 0.44, fill=fill, line=line_color, radius=True,
        name=f"Step {value}")
    text_box(slide, x, y + 0.01, w, 0.40, value, 20, color=line_color,
             bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name=f"Step {value} label", margins=(0.0, 0.0, 0.0, 0.0))


def rb_note(page: int, narration: str, recovery: str) -> str:
    return note(page, narration, recovery)


def rb_current_note(page: int, narration: str, recovery: str) -> str:
    """Speaker note for pages whose result values are supplied by current evidence."""
    return (
        f"P{page:03d}。{narration} {recovery} "
        f"資料分類維持 {CLAIM_BOUNDARY}。"
    )


def rb_p046(prs):
    slide = prepare(prs, "A freeze：把 candidate 綁成可追溯 policy")
    rb_lead(slide, "freeze receipt 固定 policy identity；hidden 只接受配對的 checkpoint。")
    nodes = [
        ("A baseline", "原始 policy\n固定 scenario／seed", BLUE, BLUE_PALE),
        ("candidate + freeze", "`REST_DURING_GAP = WAIT`\n留下 receipt + checkpoint", PURPLE, PURPLE_PALE),
        ("A hidden", "policy 不再改\n只換 case 條件", TEAL, TEAL_PALE),
    ]
    x = 0.78
    for idx, (heading, body, line_color, fill) in enumerate(nodes):
        card(slide, x, 1.72, 3.56, 1.48, heading, body, fill, line_color,
             body_size=20, heading_size=20, name=f"A freeze node {idx + 1}")
        if idx < 2:
            chevron(slide, x + 3.68, 2.26, color=GOLD, name="A freeze connector")
        x += 4.12
    card(slide, 0.86, 3.58, 5.56, 1.30, "receipt｜凍結收據",
         "`--freeze` 產生；記下 policy、scenario、seed role。\n"
         "作用：確認後續 case 使用同一個 policy identity。",
         PURPLE_PALE, PURPLE, body_size=18, heading_size=19,
         name="A freeze receipt", body_line_spacing=0.86)
    card(slide, 6.86, 3.58, 5.56, 1.30, "checkpoint｜策略快照",
         "同一 run 保存 `.json + .py`；可復原前序 policy。\n"
         "作用：identity 不符時停止，不直接進 hidden。",
         BLUE_PALE, BLUE, body_size=18, heading_size=19,
         name="A freeze checkpoint", body_line_spacing=0.86)
    rb_field(slide, "freeze_receipt", "凍結收據識別", "candidate stdout／receipt",
             "配對後續 policy", "hash-like identity", "對得上才可進 hidden")
    rb_claim(slide)
    slide.notes_slide.notes_text_frame.text = rb_note(
        46,
        "A candidate 將 Lab A 的 marked value 改為 WAIT 後，以 `--freeze` 產生 receipt 與 checkpoint。receipt 記錄 policy identity、scenario、seed role 與 active block；checkpoint 保存可復原的 policy source。hidden 不再改 policy，只在同一 frozen identity 下讀取另一個 case。這個 lineage 讓後續差異可以回到條件與事件，而不是混入新的 edit。",
        "若 receipt 或 checkpoint 缺失，先從 baseline policy 還原，重新執行 A candidate 的 `--freeze`；尚未取得配對 identity 前不進 hidden。",
    )


def rb_p047(prs):
    slide = prepare(prs, "A hidden：同一 policy，檢查新的 case")
    rb_lead(slide, "withheld case 改變 contact／traffic 條件；frozen policy 保持不變。")
    card(slide, 0.86, 1.72, 5.58, 2.62, "固定的 policy",
         "A checkpoint：`REST_DURING_GAP = WAIT`\n"
         "policy edit：0\n同一 policy identity\n新的 case 條件才是檢驗因素",
         BLUE_PALE, BLUE, body_size=20, heading_size=20, name="A hidden frozen")
    card(slide, 6.86, 1.72, 5.58, 2.62, "要讀的 evidence",
         "`result_path` 指向本次 `result.json`\n"
         "同目錄保留 `endpoint-replay.json`\n"
         "service、delivery、endpoint J：待補\n"
         "數值以同一 run pair 為準",
         GOLD_PALE, GOLD, body_size=19, heading_size=20, name="A hidden evidence")
    box(slide, 1.00, 4.72, 11.34, 0.78, fill=CREAM, line=GOLD, name="A hidden interpretation")
    text_box(slide, 1.18, 4.88, 10.98, 0.42,
             "同一 policy 在新 case 出現不同結果，結論只描述可被這組條件支持的範圍。",
             20, color=NAVY, bold=True, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE, name="A hidden interpretation text",
             margins=(0.02, 0.0, 0.02, 0.0))
    rb_field(slide, "withheld", "保留 case", "scenario contract", "檢查條件邊界",
             "case role", "不同結果不是新的調參證據")
    rb_claim(slide)
    slide.notes_slide.notes_text_frame.text = rb_note(
        47,
        "A hidden 只替換 case 條件，不替換 frozen policy。讀取 command stdout 的 `result_path`，再配對同一 run 目錄的 `endpoint-replay.json`。如果 service、delivery 或 endpoint J 方向改變，這是對條件邊界的資訊；結論不延伸成所有 window 或 traffic 都相同。",
        "若 hidden path 缺失，從 `artifacts/checkpoints/lab-a-frozen.py` 還原 policy，重新執行 exact hidden case，使用新 stdout result_path。",
    )


def rb_p048(prs):
    slide = prepare(prs, "Lab A 結論：state、service、J 要一起讀")
    rb_lead(slide, "一個數字不能代替因果；先確認 state 怎麼變，再對照 service 與 endpoint J。")
    labels = [
        ("條件", "同一 scenario\nA frozen identity", BLUE, BLUE_PALE),
        ("state", "`WAIT`／`SLEEP`\nstate interval", PURPLE, PURPLE_PALE),
        ("service", "delivery、deadline\n與 freshness gate", TEAL, TEAL_PALE),
        ("endpoint J", "radio／processing\n端點能量", GOLD, GOLD_PALE),
    ]
    x = 0.62
    for idx, (head, body, line_color, fill) in enumerate(labels):
        card(slide, x, 1.72, 2.78, 1.46, head, body, fill, line_color,
             body_size=20, heading_size=20, name=f"A conclusion node {idx + 1}")
        if idx < 3:
            chevron(slide, x + 2.88, 2.25, color=line_color, name="A conclusion connector")
        x += 3.10
    box(slide, 0.92, 3.58, 11.48, 1.12, fill=CREAM, line=GOLD, name="A conclusion sentence")
    text_box(slide, 1.18, 3.78, 10.98, 0.70,
             "`SLEEP → WAIT` 先改變 state interval，再觀察 packet／service；\n"
             "endpoint J 的變化只在同一 identity、同一 run pair 下解讀。",
             20, color=NAVY, bold=True, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE, name="A conclusion sentence text",
             margins=(0.04, 0.01, 0.04, 0.01), line_spacing=0.88)
    rb_field(slide, "state_interval", "狀態區間", "result events", "把 action 接到時間",
             "s", "對照 packet、service、endpoint J")
    rb_claim(slide)
    slide.notes_slide.notes_text_frame.text = rb_note(
        48,
        "Lab A 收束時，`state_interval` 來自 result events，單位是秒；它把 WAIT 或 SLEEP 的 action 接到後續時間與 energy bucket。接著讀 packet delivery、service gate 與同一 result 的 `endpoint_energy_j`。這種讀法保留 mechanism、service 與端點 scope，避免把單一 J 值當成完整結論。",
        "若三個 result／replay pair 的 identity 無法配對，回到 A freeze gate，重新取得正確 stdout result_path；不手改 JSON。",
    )


def rb_p049(prs):
    slide = prepare(prs, "Lab B：一個 hold 參數，連到整條 energy ledger")
    rb_lead(slide, "LoRaEnergySim 的價值在於把品質觀測、封包事件與端點 energy 放到同一條可追溯鏈。")
    nodes = [
        ("1｜觀測 quality", "`quality_band`\n`stable_steps`", BLUE, BLUE_PALE),
        ("2｜模式事件", "`MODE_CHANGE`\n何時進入 send-ready", PURPLE, PURPLE_PALE),
        ("3｜封包結果", "attempt／retry\ndelivery／collision", TEAL, TEAL_PALE),
        ("4｜端點 energy", "radio／processing\n`endpoint_energy_j`", GOLD, GOLD_PALE),
    ]
    x = 0.60
    for idx, (head, body, line_color, fill) in enumerate(nodes):
        card(slide, x, 1.72, 2.86, 1.62, head, body, fill, line_color,
             body_size=19, heading_size=18, name=f"LoRa ledger node {idx + 1}")
        if idx < 3:
            chevron(slide, x + 2.95, 2.28, color=line_color, name="LoRa ledger connector")
        x += 3.06
    card(slide, 0.86, 3.72, 5.56, 1.40, "LEO input｜服務窗口",
         "`service_window` 定義合法傳輸機會。\n"
         "它改變可用條件；policy edit 仍只在 endpoint decision block。",
         TEAL_PALE, TEAL, body_size=19, heading_size=19,
         name="LEO service input", body_line_spacing=0.86)
    card(slide, 6.86, 3.72, 5.56, 1.40, "可解釋的比較",
         "同一 scenario 比較 baseline／candidate／withheld。\n"
         "結果仍是 simulated teaching data，不是 live measurement。",
         GOLD_PALE, GOLD, body_size=19, heading_size=19,
         name="Teaching comparison", body_line_spacing=0.86)
    rb_field(slide, "endpoint_energy_j", "端點能量", "result energy breakdown",
             "讀 radio／processing 成本", "J", "不可改稱 LEO/system energy")
    rb_claim(slide)
    slide.notes_slide.notes_text_frame.text = rb_note(
        49,
        "Lab B 使用 LoRaEnergySim 的 energy-state vocabulary 來串起 quality observation、MODE_CHANGE、packet outcome 與 endpoint energy。這使 hold 參數不只是品質分數，而能沿事件鏈追問何時進入 send-ready、是否取得傳送機會、是否付出 retry 或 radio／processing 成本。LEO 只提供 changing service window 的情境輸入；本套件的結果是固定 scenario 的 simulated teaching data。",
        "若前序 A policy 不是 frozen，先還原 `artifacts/checkpoints/lab-a-frozen.py`，完成 compile 後再開始 Lab B。",
    )


def rb_p050(prs):
    slide = prepare(prs, "Lab B：找到唯一可編輯的決策區塊")
    rb_lead(slide, "整份檔案保持原樣；本 lab 只改一個 marked block 內的 `STABLE_STEPS`。")
    card(slide, 0.84, 1.70, 3.52, 2.92, "檔案位置",
         "`student_policy.py`\n\n"
         "runner 每個固定 step 提供 observation；\n"
         "`choose_action()` 依條件回傳 action。",
         BLUE_PALE, BLUE, body_size=20, heading_size=20,
         name="Lab B file location", body_line_spacing=0.84)
    rb_code_block(slide, 4.62, 1.70, 7.84, 2.92, [
        "# === LORA EDITABLE: lab-b-enter-exit-hold ===",
        "ENTER_QUALITY = 2",
        "EXIT_QUALITY = 1",
        "STABLE_STEPS = 2",
        "# === LORA END EDITABLE: lab-b-enter-exit-hold ===",
    ], target_index=3, name="Lab B marked block")
    card(slide, 0.86, 4.78, 3.72, 0.48, "固定 A", "`REST_DURING_GAP = WAIT`", TEAL_PALE, TEAL,
         body_size=17, heading_size=17, name="Lab B fixed A", compact=True)
    card(slide, 4.80, 4.78, 3.72, 0.48, "固定 C", "`URGENT_MARGIN_S = 20`", GOLD_PALE, GOLD,
         body_size=17, heading_size=17, name="Lab B fixed C", compact=True)
    card(slide, 8.74, 4.78, 3.72, 0.48, "固定執行器", "runner／scenario／schemas", COOL, BLUE,
         body_size=17, heading_size=17, name="Lab B fixed runner", compact=True)
    rb_field(slide, "active_block_id", "作用區塊", "policy／freeze receipt", "鎖定可編輯範圍",
             "block name", "不是整份檔案都可改")
    rb_claim(slide)
    slide.notes_slide.notes_text_frame.text = rb_note(
        50,
        "Lab B 的實際檔案是 `student_policy.py`，作用區塊是 `lab-b-enter-exit-hold`。ENTER_QUALITY=2 與 EXIT_QUALITY=1 先保持不動；本 lab 的唯一 edit 是 STABLE_STEPS。Lab A 的 frozen block、Lab C block、runner、scenario 與 schema 都是固定條件。這個界線讓後續結果可歸因於一個變數。",
        "若 marked block 或 predecessor identity 與頁面不同，先停止執行，從 A frozen checkpoint 恢復，再檢查 package baseline。",
    )


def rb_p051(prs):
    slide = prepare(prs, "Lab B：Before 的 baseline")
    rb_lead(slide, "先以原始 `STABLE_STEPS = 2` 建立 Trace A baseline；這頁只讀 code，不先宣稱結果。")
    rb_code_block(slide, 0.84, 1.62, 7.58, 3.24, [
        "# === LORA EDITABLE: lab-b-enter-exit-hold ===",
        "ENTER_QUALITY = 2",
        "EXIT_QUALITY = 1",
        "STABLE_STEPS = 2",
        "# === LORA END EDITABLE: lab-b-enter-exit-hold ===",
    ], target_index=3, target_value="2", name="Before code excerpt")
    card(slide, 8.72, 1.62, 3.70, 1.38, "固定門檻",
         "`ENTER_QUALITY = 2`\n品質達 2 才有進入資格。",
         BLUE_PALE, BLUE, body_size=20, heading_size=19,
         name="Before enter threshold", body_line_spacing=0.86)
    card(slide, 8.72, 3.24, 3.70, 1.62, "保持門檻",
         "`EXIT_QUALITY = 1`\n已進入後維持 1 或以上，不因小幅下降立即退出。",
         PURPLE_PALE, PURPLE, body_size=19, heading_size=19,
         name="Before exit threshold", body_line_spacing=0.84)
    rb_field(slide, "STABLE_STEPS", "穩定步數", "student_policy.py B block",
             "限制進入時機", "step", "baseline 需要連續 2 次觀測")
    rb_claim(slide)
    slide.notes_slide.notes_text_frame.text = rb_note(
        51,
        "Before code 顯示 B marked block 的五行相關內容。ENTER_QUALITY=2 定義品質達標；EXIT_QUALITY=1 定義已進入後的保持下限。STABLE_STEPS=2 則要求同一正品質連續出現兩個固定 step，才可進入 send-ready。只有這個數值屬於本頁之後的 edit。",
        "先保持 baseline policy 不變，執行 Trace A baseline；stdout 印出的 result_path 是之後比較的基準。",
    )


def rb_p052(prs):
    slide = prepare(prs, "Lab B：After 的 candidate")
    rb_lead(slide, "唯一 edit：`STABLE_STEPS` 從 2 改成 1；其它行、其它 block、其它檔案保持原樣。")
    rb_code_block(slide, 0.84, 1.62, 7.58, 3.24, [
        "# === LORA EDITABLE: lab-b-enter-exit-hold ===",
        "ENTER_QUALITY = 2",
        "EXIT_QUALITY = 1",
        "STABLE_STEPS = 1",
        "# === LORA END EDITABLE: lab-b-enter-exit-hold ===",
    ], target_index=3, target_value="1", name="After code excerpt")
    card(slide, 8.72, 1.62, 3.70, 1.38, "one-line diff",
         "Before：`STABLE_STEPS = 2`\nAfter：`STABLE_STEPS = 1`",
         GOLD_PALE, GOLD, body_size=20, heading_size=19,
         name="After diff", body_line_spacing=0.86)
    card(slide, 8.72, 3.24, 3.70, 1.62, "保持不變",
         "ENTER=2、EXIT=1、A frozen block、C block、runner、scenario、schemas。",
         TEAL_PALE, TEAL, body_size=18, heading_size=19,
         name="After unchanged", body_line_spacing=0.82)
    rb_field(slide, "STABLE_STEPS", "穩定步數", "student_policy.py B block",
             "改變進入 timing", "step", "candidate 只保留 1 次觀測")
    rb_claim(slide)
    slide.notes_slide.notes_text_frame.text = rb_note(
        52,
        "After code 顯示相同的 B block，只有數字 1 被標示為 changed value。ENTER_QUALITY、EXIT_QUALITY、中文註解、Lab A frozen block、Lab C block、runner、scenario、schemas 與檔案格式都保持原樣。這是一個 bounded edit；候選效果要由 Trace A candidate 的事件與結果驗證。",
        "存檔後先做 compile，再執行 Trace A candidate 的 `--freeze`；若多於一個值改變，回到 baseline policy 重做。",
    )


def rb_p053(prs):
    slide = prepare(prs, "Lab B：兩個穩定觀測 versus 一個")
    rb_lead(slide, "相同 quality trace 下，hold 的差別是進入 send-ready 的時間；不是直接指定封包成功。")
    box(slide, 0.84, 1.62, 5.56, 3.22, fill=BLUE_PALE, line=BLUE, name="Two-step timing")
    text_box(slide, 1.08, 1.82, 5.08, 0.30, "baseline：兩次確認", 21, color=BLUE,
             bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="Two-step heading", margins=(0.01, 0.0, 0.01, 0.0))
    for x, label in ((1.42, "第 1 次\n品質達 2"), (3.06, "第 2 次\n品質仍穩定")):
        box(slide, x, 2.42, 1.28, 0.86, fill=WHITE, line=BLUE, name="Two-step observation")
        text_box(slide, x + 0.05, 2.56, 1.18, 0.50, label, 19, color=NAVY,
                 bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
                 name="Two-step observation text", margins=(0.01, 0.0, 0.01, 0.0), line_spacing=0.82)
    chevron(slide, 2.80, 2.62, color=BLUE, name="Two-step timing connector")
    pill(slide, 1.52, 3.72, 4.20, 0.48, "第 2 次完成 → MODE_CHANGE", BLUE_PALE, BLUE, size=19)
    text_box(slide, 1.08, 4.34, 5.08, 0.32, "短暫 spike 不會立刻進入", 19, color=INK,
             align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Two-step explanation",
             margins=(0.01, 0.0, 0.01, 0.0))
    box(slide, 6.86, 1.62, 5.56, 3.22, fill=TEAL_PALE, line=TEAL, name="One-step timing")
    text_box(slide, 7.10, 1.82, 5.08, 0.30, "candidate：一次確認", 21, color=TEAL,
             bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="One-step heading", margins=(0.01, 0.0, 0.01, 0.0))
    box(slide, 8.28, 2.42, 1.70, 0.86, fill=WHITE, line=TEAL, name="One-step observation")
    text_box(slide, 8.36, 2.56, 1.54, 0.50, "第 1 次\n品質達 2", 19, color=NAVY,
             bold=True, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="One-step observation text", margins=(0.01, 0.0, 0.01, 0.0), line_spacing=0.82)
    pill(slide, 7.54, 3.72, 4.20, 0.48, "第 1 次完成 → MODE_CHANGE", TEAL_PALE, TEAL, size=19)
    text_box(slide, 7.10, 4.34, 5.08, 0.32, "可能提早一個固定 step", 19, color=INK,
             align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="One-step explanation",
             margins=(0.01, 0.0, 0.01, 0.0))
    rb_field(slide, "MODE_CHANGE", "模式切換事件", "result events／replay",
             "確認進入 timing", "event", "再對照 packet、service、J")
    rb_claim(slide)
    slide.notes_slide.notes_text_frame.text = rb_note(
        53,
        "Baseline 的 STABLE_STEPS=2 需要兩個連續穩定觀測；第一次達標只開始累積，第二次仍穩定才記錄 MODE_CHANGE。Candidate 的值為 1，第一次達標就可能進入 send-ready。這個機制只改變 decision timing；封包是否送達仍由窗口、runner 與 packet outcome 決定。",
        "Trace A 要讀 MODE_CHANGE 的時間，再讀 packet、service 與 endpoint J；若沒有事件證據，不把 timing prediction 當成結果。",
    )


def rb_p054(prs):
    slide = prepare(prs, "Trace A：先建立可驗證的比較")
    rb_lead(slide, "A frozen predecessor 固定；先跑 baseline，再跑 candidate freeze，最後以同一 policy 做 Trace B。")
    nodes = [
        ("baseline", "A frozen\nB：STABLE_STEPS=2\n不加 freeze", BLUE, BLUE_PALE),
        ("candidate", "只改 B：2→1\nTrace A\n建立 freeze", PURPLE, PURPLE_PALE),
        ("withheld", "保持 B frozen\nTrace B 新 case\n不再調參", TEAL, TEAL_PALE),
    ]
    x = 0.78
    for idx, (head, body, line_color, fill) in enumerate(nodes):
        card(slide, x, 1.72, 3.56, 1.70, head, body, fill, line_color,
             body_size=20, heading_size=20, name=f"Trace sequence {idx + 1}",
             body_line_spacing=0.84)
        if idx < 2:
            chevron(slide, x + 3.68, 2.34, color=GOLD, name="Trace sequence connector")
        x += 4.12
    card(slide, 0.86, 3.84, 3.72, 1.18, "baseline prediction",
         "較晚進入；可能少一次早期嘗試。", BLUE_PALE, BLUE, body_size=19,
         heading_size=18, name="Trace prediction baseline", body_line_spacing=0.86)
    card(slide, 4.80, 3.84, 3.72, 1.18, "candidate prediction",
         "較早進入；service opportunity 可能增加，也可能付出更多 radio／processing。", PURPLE_PALE, PURPLE,
         body_size=18, heading_size=18, name="Trace prediction candidate", body_line_spacing=0.82)
    card(slide, 8.74, 3.84, 3.72, 1.18, "判讀規則",
         "只有 event → packet → service → J 的配對才支持因果句。", GOLD_PALE, GOLD,
         body_size=18, heading_size=18, name="Trace prediction rule", body_line_spacing=0.82)
    rb_field(slide, "policy lineage", "策略脈絡", "freeze receipt／checkpoint",
             "固定比較前提", "identity", "baseline／candidate／withheld 不混 policy")
    rb_claim(slide)
    slide.notes_slide.notes_text_frame.text = rb_note(
        54,
        "Trace A 比較的前提是 A frozen predecessor。Baseline 使用 STABLE_STEPS=2；candidate 只改為 1，並以 `--freeze` 產生 B checkpoint；Trace B 維持這個 frozen policy，改看 withheld case。預測是可被反駁的工作假設：較早進入可能增加 service opportunity，也可能增加 radio／processing 成本。",
        "執行順序不可交換；candidate freeze 缺失時不進 Trace B，先恢復 A checkpoint 並重跑 candidate freeze。",
    )


def rb_p055(prs):
    slide = prepare(prs, "Trace A 與 Trace B：Linux／macOS 終端機")
    rb_lead(slide, "下列命令在 package 根目錄執行；WSL 也使用這組 Linux 指令，stdout 會印出 result_path。")
    rb_command_card(slide, 0.84, 1.62, 11.64, 1.02, "Trace A baseline｜原始 B policy",
                    "bash course.sh run --lab B --case trace-a-baseline",
                    BLUE, BLUE_PALE, size=20, name="Linux baseline command")
    rb_command_card(slide, 0.84, 2.88, 11.64, 1.02, "Trace A candidate｜2→1 + freeze",
                    "bash course.sh run --lab B --case trace-a-candidate --freeze",
                    PURPLE, PURPLE_PALE, size=20, name="Linux candidate command")
    rb_command_card(slide, 0.84, 4.14, 11.64, 1.02, "Trace B｜保持 B frozen 的 withheld case",
                    "bash course.sh run --lab B --case trace-b",
                    TEAL, TEAL_PALE, size=20, name="Linux Trace B command")
    rb_field(slide, "result_path", "結果路徑", "command stdout", "選取本次 result.json",
             "file path", "不要自行猜 run directory")
    rb_claim(slide, y=6.00)
    slide.notes_slide.notes_text_frame.text = rb_note(
        55,
        "Linux 與 macOS 終端機使用 `bash course.sh`；WSL 同樣使用這組 Linux launcher。第一條建立 Trace A baseline；第二條在 STABLE_STEPS=1 的 policy 下建立 candidate freeze；第三條保持 B frozen 執行 Trace B。每一條成功命令都在 stdout 印出本次 `result_path`，後續以該路徑找 result.json。",
        "若命令失敗，保留 stdout／stderr；candidate freeze 缺失時不執行 Trace B，先回到 A checkpoint 並重做 candidate。",
    )


def rb_p056(prs):
    slide = prepare(prs, "同一流程：Windows PowerShell／Command Prompt")
    rb_lead(slide, "Windows 使用相同參數；PowerShell 與 Command Prompt 只替換 launcher 名稱。")
    rb_command_card(slide, 0.84, 1.62, 5.60, 3.58, "PowerShell｜`.\\course.cmd`",
                    ".\\course.cmd run --lab B --case trace-a-baseline\n"
                    ".\\course.cmd run --lab B --case trace-a-candidate --freeze\n"
                    ".\\course.cmd run --lab B --case trace-b",
                    BLUE, BLUE_PALE, size=18, name="PowerShell commands")
    rb_command_card(slide, 6.84, 1.62, 5.60, 3.58, "Command Prompt｜`course.cmd`",
                    "course.cmd run --lab B --case trace-a-baseline\n"
                    "course.cmd run --lab B --case trace-a-candidate --freeze\n"
                    "course.cmd run --lab B --case trace-b",
                    PURPLE, PURPLE_PALE, size=18, name="Command Prompt commands")
    pill(slide, 1.06, 4.78, 11.16, 0.44,
         "baseline → candidate --freeze → Trace B；每次 stdout 都保存新的 result_path",
         GOLD_PALE, GOLD, size=18)
    rb_field(slide, "launcher", "執行器入口", "Windows shell", "呼叫同一 course contract",
             "command", "PowerShell 與 Command Prompt 不混用語法")
    rb_claim(slide, y=6.00)
    slide.notes_slide.notes_text_frame.text = rb_note(
        56,
        "Windows PowerShell 以 ` .\\course.cmd ` 呼叫三個 Lab B cases；Command Prompt 以 `course.cmd` 呼叫同樣三個參數。PowerShell 版本的前綴包含 `.` 與反斜線；Command Prompt 版本不含這個前綴。案例順序保持 baseline、candidate `--freeze`、Trace B，stdout 仍是 result_path 的唯一選取入口。",
        "若 shell 解析錯誤，改用該 shell 的完整 launcher，不混用引號或換行；保留錯誤後重新執行 exact case。",
    )


def rb_p057(prs):
    slide = prepare(prs, "每次 run 都產生一對可追溯檔案")
    rb_lead(slide, "runner 的輸出不是一個孤立數字；result 與 replay 共同保留同一 run identity。")
    nodes = [
        ("stdout", "命令列印出\n`result_path`", BLUE, BLUE_PALE),
        ("result.json", "summary、events、\npolicy／scenario identity", PURPLE, PURPLE_PALE),
        ("endpoint-replay.json", "同目錄的 state、queue、\npacket replay", TEAL, TEAL_PALE),
    ]
    x = 0.80
    for idx, (head, body, line_color, fill) in enumerate(nodes):
        card(slide, x, 1.72, 3.58, 1.66, head, body, fill, line_color,
             body_size=20, heading_size=19, name=f"Artifact pair node {idx + 1}")
        if idx < 2:
            chevron(slide, x + 3.70, 2.31, color=GOLD, name="Artifact pair connector")
        x += 4.02
    card(slide, 0.86, 3.86, 5.56, 1.24, "run directory",
         "`artifacts/<run_id>/result.json`\n"
         "同目錄的 `endpoint-replay.json` 必須保留。",
         COOL, BLUE, body_size=19, heading_size=19, name="Artifact directory", body_line_spacing=0.86)
    card(slide, 6.86, 3.86, 5.56, 1.24, "freeze 時多一層 lineage",
         "`--freeze` 另寫 receipt 與 checkpoint。\n"
         "checkpoint 是 policy source，不是結果檔。",
         GOLD_PALE, GOLD, body_size=19, heading_size=19, name="Artifact freeze", body_line_spacing=0.86)
    rb_field(slide, "endpoint-replay.json", "端點事件回放", "same run directory",
             "重現 state／queue／packet", "JSON artifact", "不可與另一 run 混配")
    rb_claim(slide)
    slide.notes_slide.notes_text_frame.text = rb_note(
        57,
        "每次成功 run 的 stdout 都會印出 `result_path`。該路徑指向 `artifacts/<run_id>/result.json`；同一目錄的 `endpoint-replay.json` 保存 state、queue 與 packet 的回放資料。candidate 加上 `--freeze` 時，另外保存 receipt 與 checkpoint。policy checkpoint 用來恢復 lineage，不能代替遺失的 result。",
        "若 result 或 replay 缺一，保留原始 stdout path，不手改 JSON；回到最後一個有效 checkpoint，重跑 exact case 取得新的 pair。",
    )


def rb_p058(prs):
    slide = prepare(prs, "讀取結果：先看 service，再看 packet、state、endpoint J")
    rb_lead(slide, "服務是否完成是第一個判斷；後面三層用來解釋成功、失敗與 energy trade-off。")
    steps = [
        ("1", "SERVICE", "deadline／freshness／delivery\n先判斷服務 gate", TEAL, TEAL_PALE),
        ("2", "PACKET", "attempt／retry／collision\n說明交付成本", BLUE, BLUE_PALE),
        ("3", "STATE", "MODE_CHANGE、WAIT／SLEEP\n說明 timing", PURPLE, PURPLE_PALE),
        ("4", "ENDPOINT J", "radio／processing J\n只代表端點 scope", GOLD, GOLD_PALE),
    ]
    x = 0.60
    for idx, (num, head, body, line_color, fill) in enumerate(steps):
        rb_number(slide, x + 0.10, 1.78, num, line_color, fill)
        card(slide, x, 2.36, 2.88, 1.76, head, body, fill, line_color,
             body_size=18, heading_size=19, name=f"Reading order {idx + 1}",
             body_line_spacing=0.84)
        x += 3.04
    box(slide, 0.96, 4.46, 11.30, 0.60, fill=CREAM, line=GOLD, name="Reading rule")
    text_box(slide, 1.16, 4.60, 10.90, 0.30,
             "service FAIL 時，較小的 endpoint J 不能把服務失敗改寫成成功。",
             20, color=RED, bold=True, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE, name="Reading rule text",
             margins=(0.02, 0.0, 0.02, 0.0))
    rb_field(slide, "service_pass", "服務布林狀態", "result summary／service gate",
             "先判斷 deadline、freshness、delivery", "true／false", "PASS 才進入 trade-off 解釋")
    rb_claim(slide)
    slide.notes_slide.notes_text_frame.text = rb_note(
        58,
        "結果判讀固定採四層順序。第一層 service 讀 deadline、freshness 與 delivery；第二層 packet 讀 attempted、retry、collision 與 delivered；第三層 state 讀 MODE_CHANGE 與 WAIT／SLEEP／PROCESS／TX／RX 的時間；第四層讀 endpoint_energy_j。endpoint J 只描述 endpoint radio／processing scope，不是 LEO 或整個 system energy。",
        "若 service_pass、packet 或 state 欄位缺失，先確認 result／replay 是同一 run pair，再進行解讀。",
    )


def rb_p059(prs):
    slide = prepare(prs, "Trace A：candidate 送達增加，但 service 仍未通過")
    rb_lead(slide, "current evidence 將 baseline 與 candidate 放在同一條 service → packet → state → J 判讀鏈。")
    card(slide, 0.84, 1.62, 5.58, 2.42, "Trace A baseline｜STABLE_STEPS = 2",
         "service_pass：false\n"
         "delivered：1／4　expired：3\n"
         "retries：1　collisions：1\n"
         "endpoint_energy_j：8.86 J",
         BLUE_PALE, BLUE, body_size=18, heading_size=19,
         name="Trace A current baseline", body_line_spacing=0.78)
    card(slide, 6.86, 1.62, 5.58, 2.42, "Trace A candidate｜STABLE_STEPS = 1",
         "service_pass：false\n"
         "delivered：3／4　expired：1\n"
         "retries：1　collisions：1\n"
         "endpoint_energy_j：10.66 J",
         PURPLE_PALE, PURPLE, body_size=18, heading_size=19,
         name="Trace A current candidate", body_line_spacing=0.78)
    box(slide, 0.96, 4.28, 11.30, 0.74, fill=GOLD_PALE, line=GOLD,
        name="Trace A current interpretation")
    text_box(slide, 1.16, 4.44, 10.90, 0.38,
             "candidate：送達 1／4 → 3／4、逾時 3 → 1；endpoint J 8.86 → 10.66（+1.80 J），service 仍為 false。",
             18, color=NAVY, bold=True, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE, name="Trace A current interpretation text",
             margins=(0.02, 0.0, 0.02, 0.0), line_spacing=0.86)
    rb_field(slide, "MODE_CHANGE", "模式切換事件", "result events",
             "連接 edit 與 service timing", "event time", "先填事件，再填 packet／service／J")
    rb_claim(slide)
    slide.notes_slide.notes_text_frame.text = rb_current_note(
        59,
        "Trace A current evidence 顯示：STABLE_STEPS 由 2 改成 1 後，delivered 從 1/4 增至 3/4，expired 從 3 降至 1；retries 與 collisions 都維持 1。endpoint energy 從 8.86 J 增至 10.66 J，增加 1.80 J，但 service_pass 仍為 false。因此 candidate 改善送達數，不等於完成 service gate。",
        "這組數值來自 current Trace A baseline／candidate result pair；後續仍以同一 run 的 replay 對照 MODE_CHANGE 與 state interval，不把 service false 寫成成功。",
    )


def rb_p060(prs):
    slide = prepare(prs, "Trace B：frozen candidate 仍未通過 service")
    rb_lead(slide, "Trace B 使用同一個 frozen candidate；新的 case 顯示條件邊界，而不是整體改善證據。")
    card(slide, 0.84, 1.70, 5.56, 2.70, "Trace A candidate｜frozen policy",
         "`STABLE_STEPS = 1`\n"
         "delivered：3／4　expired：1\n"
         "service_pass：false\n"
         "endpoint_energy_j：10.66 J",
         TEAL_PALE, TEAL, body_size=20, heading_size=20,
         name="Trace B compare A", body_line_spacing=0.84)
    card(slide, 6.86, 1.70, 5.56, 2.70, "Trace B｜withheld evidence",
         "同一 frozen policy；case 條件改變\n"
         "delivered：1／3　expired：2\n"
         "service_pass：false\n"
         "endpoint_energy_j：5.43 J",
         GOLD_PALE, GOLD, body_size=20, heading_size=20,
         name="Trace B compare B", body_line_spacing=0.84)
    box(slide, 1.00, 4.72, 11.34, 0.78, fill=RED_PALE, line=RED, name="Trace B boundary")
    text_box(slide, 1.18, 4.88, 10.98, 0.42,
             "Trace B service_pass 仍為 false；不能把單一 J 值 5.43 宣稱為整體改善。",
             20, color=RED, bold=True, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE, name="Trace B boundary text",
             margins=(0.02, 0.0, 0.02, 0.0))
    rb_field(slide, "withheld", "保留條件", "Trace B scenario contract",
             "檢驗外推邊界", "case role", "frozen policy 不因結果改寫")
    rb_claim(slide)
    slide.notes_slide.notes_text_frame.text = rb_current_note(
        60,
        "Trace B 沿用 Trace A candidate 的 frozen policy，但 current evidence 顯示 delivered 只有 1/3、expired 為 2、service_pass 仍為 false、endpoint energy 為 5.43 J。Trace B 沒有通過 service，因此 5.43 J 只能描述這個 withheld case 的端點成本，不能覆蓋服務失敗，也不能支持整體改善。",
        "保持 B checkpoint 與 policy identity 不變；若 B evidence pair 缺失，先恢復 A predecessor，重新執行 Trace A candidate `--freeze`，再跑 Trace B。",
    )


def rb_p061(prs):
    slide = prepare(prs, "Lab B 結論：送達增加，service 仍未通過")
    rb_lead(slide, "LoRaEnergySim energy ledger 顯示 candidate 的送達收益伴隨端點成本；Trace B 未通過 service。")
    card(slide, 0.84, 1.70, 3.72, 2.74, "Trace A｜送達變化",
         "baseline：delivered 1／4\n"
         "candidate：delivered 3／4\n"
         "expired：3 → 1\n"
         "service_pass：false → false",
         BLUE_PALE, BLUE, body_size=20, heading_size=20,
         name="Lab B conclusion delivery", body_line_spacing=0.84)
    card(slide, 4.80, 1.70, 3.72, 2.74, "Trace A｜端點成本",
         "endpoint J：8.86 → 10.66\n"
         "增加：+1.80 J\n"
         "retries：1 → 1\n"
         "collisions：1 → 1",
         PURPLE_PALE, PURPLE, body_size=20, heading_size=20,
         name="Lab B conclusion energy", body_line_spacing=0.84)
    card(slide, 8.76, 1.70, 3.72, 2.74, "Trace B｜主張邊界",
         "frozen candidate\ndelivered：1／3\n"
         "expired：2；J：5.43\n"
         "service_pass：false",
         GOLD_PALE, GOLD, body_size=20, heading_size=20,
         name="Lab B conclusion boundary", body_line_spacing=0.84)
    box(slide, 1.00, 4.72, 11.34, 0.78, fill=CREAM, line=GOLD, name="Lab B qualified conclusion")
    text_box(slide, 1.18, 4.88, 10.98, 0.42,
             "結論句：candidate 增加送達但增加 energy，且仍未 service pass；Trace B 未通過，不能宣稱整體改善。",
             20, color=NAVY, bold=True, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE, name="Lab B qualified conclusion text",
             margins=(0.02, 0.0, 0.02, 0.0))
    rb_field(slide, "claim ceiling", "主張上限", "Trace A／Trace B pairs",
             "界定可外推範圍", "condition set", "J 變小不覆蓋 service failure")
    rb_claim(slide)
    slide.notes_slide.notes_text_frame.text = rb_current_note(
        61,
        "current evidence 的 Lab B 結論是條件式的：Trace A candidate 將 delivered 從 1/4 提高到 3/4、expired 從 3 降到 1，但 endpoint energy 從 8.86 J 增至 10.66 J，且 service_pass 仍為 false。Trace B 使用 frozen candidate，delivered 只有 1/3、expired 為 2、endpoint energy 為 5.43 J，service_pass 同樣為 false。因此 candidate 增加送達並不等於整體改善；Trace B 未通過 service，不能宣稱跨 case 的改善。LoRaEnergySim energy ledger 的幫助在於把這個送達／成本／服務 trade-off 放在同一條可追溯鏈。",
        "保留 B freeze 與兩組 result／replay identity；若欄位不符，回到 B freeze gate，不重新改 policy。",
    )


def rb_p062(prs):
    slide = prepare(prs, "中斷時：先恢復 policy，再重跑 exact case")
    rb_lead(slide, "policy checkpoint 只恢復 lineage；compile 後重新 run，才會產生新的 result_path。")
    steps = [
        ("01", "copy", "放回最後有效\nA／B checkpoint", BLUE, BLUE_PALE),
        ("02", "compile", "確認 policy\n語法可載入", PURPLE, PURPLE_PALE),
        ("03", "exact rerun", "同一 case\n不改 runner／JSON", TEAL, TEAL_PALE),
        ("04", "new pair", "保存新的 path\n配對 replay", GOLD, GOLD_PALE),
    ]
    x = 0.64
    for idx, (num, head, body, line_color, fill) in enumerate(steps):
        card(slide, x, 1.64, 2.78, 1.56, f"{num}｜{head}", body, fill, line_color,
             body_size=19, heading_size=18, name=f"Recovery step {idx + 1}", body_line_spacing=0.84)
        if idx < 3:
            chevron(slide, x + 2.88, 2.22, color=line_color, name="Recovery connector")
        x += 3.04
    rb_command_card(slide, 0.82, 3.60, 5.70, 1.52, "Linux／macOS 終端機／WSL",
                    "cp artifacts/checkpoints/lab-b-frozen.py student_policy.py\n"
                    ".venv/bin/python -m py_compile student_policy.py",
                    BLUE, BLUE_PALE, size=17, name="Recovery POSIX commands")
    rb_command_card(slide, 6.82, 3.60, 5.70, 1.52, "Windows Command Prompt",
                    "copy /Y artifacts\\checkpoints\\lab-b-frozen.py student_policy.py\n"
                    ".venv\\Scripts\\python.exe -m py_compile student_policy.py",
                    PURPLE, PURPLE_PALE, size=17, name="Recovery Windows commands")
    rb_field(slide, "checkpoint", "策略快照", "artifacts/checkpoints",
             "恢復 policy lineage", "Python source", "不會復原遺失的 result")
    rb_claim(slide, y=6.00)
    slide.notes_slide.notes_text_frame.text = rb_note(
        62,
        "中斷復原分成 copy、compile、exact rerun、new pair 四步。Linux／macOS 終端機與 WSL 使用 cp 和 `.venv/bin/python`；Windows Command Prompt 使用 copy /Y 和 `.venv\\Scripts\\python.exe`。copy 只恢復 B frozen policy，compile 只確認語法；同一 case 重新 run 才會取得新的 result_path 與同目錄 replay。",
        "若缺少 result 或 replay，不手改 artifact；從最後一個 identity 正確的 checkpoint 恢復，依原 case contract 重新執行。",
    )


def rb_p063(prs):
    slide = prepare(prs, "result.json 匯入 /course：驗證後才進 workbook")
    rb_lead(slide, "網站接收 runner 的 `result.json`；驗證 identity 後讀取配對 replay，保存可回溯的比較紀錄。")
    nodes = [
        ("1｜選檔", "stdout `result_path`\n選該次 `result.json`", BLUE, BLUE_PALE),
        ("2｜驗證", "schema／identity／units\n不符就 fail closed", PURPLE, PURPLE_PALE),
        ("3｜回放", "同目錄 `endpoint-replay.json`\nstate／queue／packet", TEAL, TEAL_PALE),
        ("4｜保存", "service → packet → state → J\n寫入 workbook lineage", GOLD, GOLD_PALE),
    ]
    x = 0.58
    for idx, (head, body, line_color, fill) in enumerate(nodes):
        card(slide, x, 1.68, 2.84, 1.64, head, body, fill, line_color,
             body_size=18, heading_size=18, name=f"Upload flow node {idx + 1}", body_line_spacing=0.82)
        if idx < 3:
            chevron(slide, x + 2.94, 2.28, color=line_color, name="Upload flow connector")
        x += 3.06
    card(slide, 0.86, 3.78, 5.58, 1.38, "網站讀取／保存",
         "讀 `result.json` 並驗證；materialize 同 run replay。\n"
         "保存 baseline／candidate／withheld lineage。",
         TEAL_PALE, TEAL, body_size=18, heading_size=18,
         name="Upload success", body_line_spacing=0.84)
    card(slide, 6.86, 3.78, 5.58, 1.38, "網站不做的事",
         "不接收或執行 `student_policy.py`；\n"
         "不把 endpoint J 改稱 LEO／system energy。",
         RED_PALE, RED, body_size=18, heading_size=18,
         name="Upload boundary", body_line_spacing=0.84)
    rb_field(slide, "result.json", "執行結果", "runner stdout result_path",
             "匯入 /course 的 evidence", "JSON artifact", "與 endpoint replay 同 run 配對")
    rb_claim(slide, y=6.00)
    slide.notes_slide.notes_text_frame.text = rb_note(
        63,
        "匯入 /course 時，選擇 stdout 的 `result_path` 所指向的 `result.json`，不要上傳 policy source。網站驗證 schema、scenario、case、units、policy lineage 與 provenance；通過後讀取同一目錄的 `endpoint-replay.json`，把 service、packet、state 與 endpoint J 保存到 workbook。讀取順序仍是 service → packet → state → endpoint J。identity、unit 或 provenance 不符時 fail closed，原 workbook 不變。",
        "若匯入失敗，保留錯誤與原始 stdout path；回到中斷復原步驟重跑 exact case，取得新的 result／replay pair，不手改 JSON。",
    )


# Replace the historical dense builders with the readable sequence above.
BUILDERS = [
    rb_p046, rb_p047, rb_p048, rb_p049, rb_p050, rb_p051,
    rb_p052, rb_p053, rb_p054, rb_p055, rb_p056, rb_p057,
    rb_p058, rb_p059, rb_p060, rb_p061, rb_p062, rb_p063,
]


def remove_all_slides(prs: Presentation) -> None:
    slide_ids = prs.slides._sldIdLst
    for slide_id in list(slide_ids):
        prs.part.drop_rel(slide_id.rId)
        slide_ids.remove(slide_id)


def overlay_template_parts(path: Path) -> None:
    """Restore template-owned parts without changing authored slide XML."""
    prefixes = (
        "ppt/slideLayouts/", "ppt/slideMasters/", "ppt/theme/",
        "ppt/media/", "ppt/notesMasters/",
    )
    with zipfile.ZipFile(TEMPLATE) as source, zipfile.ZipFile(path, "r") as old:
        data = {info.filename: old.read(info.filename) for info in old.infolist()}
        infos = {info.filename: copy.copy(info) for info in old.infolist()}
        for info in source.infolist():
            if info.filename.startswith(prefixes):
                data[info.filename] = source.read(info.filename)
                infos[info.filename] = copy.copy(info)
    temp = path.with_suffix(".overlay.pptx")
    with zipfile.ZipFile(temp, "w", zipfile.ZIP_DEFLATED) as out:
        for name, payload in data.items():
            out.writestr(infos[name], payload)
    temp.replace(path)


def slide_parts_in_order(archive: zipfile.ZipFile) -> list[str]:
    presentation = ET.fromstring(archive.read("ppt/presentation.xml"))
    rels = ET.fromstring(archive.read("ppt/_rels/presentation.xml.rels"))
    targets = {
        rel.get("Id"): rel.get("Target")
        for rel in rels.findall(f"{{{REL_NS}}}Relationship")
    }
    parts: list[str] = []
    for node in presentation.findall(f"./{{{P_NS}}}sldIdLst/{{{P_NS}}}sldId"):
        rid = node.get(f"{{{OFFICE_REL_NS}}}id")
        target = targets.get(rid)
        if target:
            parts.append(str(Path("ppt") / target).replace("\\", "/"))
    return parts


def extract_text(root: ET.Element) -> str:
    return "".join(node.text or "" for node in root.findall(f".//{{{A_NS}}}t"))


def authored_font_sizes(root: ET.Element) -> list[float]:
    sizes: list[float] = []
    for node in root.findall(f".//{{{A_NS}}}rPr"):
        value = node.get("sz")
        if value and value.isdigit():
            sizes.append(int(value) / 100)
    return sizes


def recursive_relationship_targets(archive: zipfile.ZipFile, part: str) -> list[str]:
    rel_name = str(Path(part).parent / "_rels" / f"{Path(part).name}.rels").replace("\\", "/")
    if rel_name not in archive.namelist():
        return []
    rel_root = ET.fromstring(archive.read(rel_name))
    targets: list[str] = []
    for rel in rel_root.findall(f"{{{REL_NS}}}Relationship"):
        target = rel.get("Target") or ""
        if target.startswith("/"):
            normalized = target.lstrip("/")
        else:
            normalized = posixpath.normpath(posixpath.join(posixpath.dirname(part), target))
        targets.append(str(Path(normalized)).replace("\\", "/"))
    return targets


def structural_qa(path: Path) -> dict:
    errors: list[str] = []
    warnings: list[str] = []
    text_pages: list[dict] = []
    low_fonts: list[dict] = []
    relationship_issues: list[str] = []
    duplicate_ids: list[dict] = []
    background_nodes: list[int] = []
    font_sizes_seen: list[float] = []
    notes_text: list[str] = []
    with zipfile.ZipFile(path) as archive:
        if archive.testzip() is not None:
            errors.append("zip-integrity")
        names = set(archive.namelist())
        parts = slide_parts_in_order(archive)
        note_parts = sorted(
            [name for name in names if re.fullmatch(r"ppt/notesSlides/notesSlide\d+\.xml", name)],
            key=lambda name: int(re.search(r"(\d+)", name).group(1)),
        )
        if len(parts) != 18:
            errors.append(f"slide-count:{len(parts)}")
        if len(note_parts) != 18:
            errors.append(f"notes-count:{len(note_parts)}")
        for index, part in enumerate(parts, start=1):
            if part not in names:
                errors.append(f"missing-slide-part:{part}")
                continue
            root = ET.fromstring(archive.read(part))
            text = extract_text(root)
            text_pages.append({"slide": index, "source_page": f"P{PAGE_NUMBERS[index - 1]:03d}", "text": text})
            if root.find(f"./{{{P_NS}}}cSld/{{{P_NS}}}bg") is not None:
                background_nodes.append(index)
            sizes = authored_font_sizes(root)
            font_sizes_seen.extend(sizes)
            if sizes and min(sizes) < 16:
                low_fonts.append({"slide": index, "minimum_pt": min(sizes)})
            ids: list[str] = []
            for node in root.findall(f".//{{{P_NS}}}cNvPr"):
                value = node.get("id")
                if value:
                    ids.append(value)
            duplicates = sorted({value for value in ids if ids.count(value) > 1})
            if duplicates:
                duplicate_ids.append({"slide": index, "ids": duplicates})
            targets = recursive_relationship_targets(archive, part)
            layout_targets = [target for target in targets if target.endswith("slideLayout2.xml") or "slideLayout" in target]
            if len(layout_targets) != 1 or not layout_targets[0].endswith("slideLayout2.xml"):
                relationship_issues.append(f"slide-{index}:{layout_targets}")
            for target in targets:
                if target not in names and not target.startswith("http"):
                    relationship_issues.append(f"missing-target:{part}->{target}")
        for name in note_parts:
            root = ET.fromstring(archive.read(name))
            text = extract_text(root)
            notes_text.append(text)
            if not text.strip():
                errors.append(f"empty-note:{name}")
            for target in recursive_relationship_targets(archive, name):
                if target not in names and not target.startswith("http"):
                    relationship_issues.append(f"missing-target:{name}->{target}")
        all_text = "\n".join(page["text"] for page in text_pages) + "\n" + "\n".join(notes_text)
        forbidden_hits = sorted({term for term in FORBIDDEN if term.lower() in all_text.lower()})
        if forbidden_hits:
            errors.append(f"forbidden-language:{forbidden_hits}")
        if background_nodes:
            errors.append(f"slide-backgrounds:{background_nodes}")
        if low_fonts:
            errors.append(f"font-floor:{low_fonts}")
        if duplicate_ids:
            errors.append(f"duplicate-cnvpr-ids:{duplicate_ids}")
        if relationship_issues:
            errors.append(f"relationship-issues:{relationship_issues[:8]}")
        if len(notes_text) != len(parts):
            errors.append("notes-slide-parity")
        required_titles = VISIBLE_TITLE_PREFIXES
        if len(required_titles) != len(text_pages):
            errors.append(f"visible-title-contract-count:{len(required_titles)}")
        for index, expected in enumerate(required_titles):
            if index >= len(text_pages) or expected not in text_pages[index]["text"]:
                errors.append(f"missing-semantic-title:{expected}")
        template_sha = hashlib.sha256(TEMPLATE.read_bytes()).hexdigest()
    report = {
        "schema": "c120-alt-part-b-v2-p046-p063-structural-qa-v1",
        "status": "PASS" if not errors else "FAIL",
        "output": str(path),
        "template": str(TEMPLATE),
        "template_sha256": template_sha,
        "slide_count": len(parts),
        "notes_count": len(notes_text),
        "page_labels": required_titles,
        "layout_contract": {"expected": "ppt/slideLayouts/slideLayout2.xml", "issues": relationship_issues, "all_layout2": not relationship_issues},
        "slide_background_nodes": background_nodes,
        "duplicate_creation_ids": duplicate_ids,
        "minimum_authored_font_pt": min(font_sizes_seen, default=0),
        "font_floor": {"minimum_pt": 16, "violations": low_fonts},
        "forbidden_language_hits": sorted({term for term in FORBIDDEN if term.lower() in ("\n".join(item["text"] for item in text_pages) + "\n" + "\n".join(notes_text)).lower()}),
        "recursive_xml_and_relationship_scan": "PASS" if not relationship_issues and not duplicate_ids else "FAIL",
        "content_readback": text_pages,
        "notes_readback": notes_text,
        "visual_rendering": "ATTEMPTED: LibreOffice headless conversion returned exit 1 without emitting PDF in the current sandbox; original-size raster inspection deferred to controller environment",
        "microsoft_powerpoint_reopen": "DEFERRED: controller environment",
        "warnings": warnings,
        "errors": errors,
    }
    return report


def write_manifest(notes_by_page: dict[int, str]) -> None:
    donor = {
        "P046-P048": "donor-analysis/donor-insertion-map.md:e2 36-39; topic-level redraw only",
        "P049-P061": "donor-analysis/donor-insertion-map.md:e2 11-12; topic-level redraw only",
        "P062-P063": "donor-analysis/donor-insertion-map.md:e2 70-75; topic-level redraw only",
    }
    pages = []
    for number in PAGE_NUMBERS:
        title_text = next(
            (page["text"].split("\n", 1)[0] for page in structural_qa(OUTPUT)["content_readback"] if page["source_page"] == f"P{number:03d}"),
            f"P{number:03d}",
        )
        pages.append({
            "order": number - 45,
            "source_page": f"P{number:03d}",
            "title": title_text,
            "layout": "slideLayout2.xml",
            "evidence_status": (
                "current local evidence embedded; no screenshot"
                if number in {59, 60, 61}
                else "待補：no screenshot or fabricated run result embedded"
            ),
            "speaker_note": notes_by_page[number],
            "donor_source": donor["P046-P048"] if number <= 48 else donor["P049-P061"] if number <= 61 else donor["P062-P063"],
        })
    payload = {
        "schema": "c120-alt-part-b-v2-p046-p063-manifest-v1",
        "template": str(TEMPLATE),
        "template_sha256": hashlib.sha256(TEMPLATE.read_bytes()).hexdigest(),
        "shell": "source slide 2 / slideLayout2.xml only",
        "background_author_fill": "unset",
        "fonts": {"cjk": "標楷體", "latin": "Times New Roman"},
        "title_pt": 28,
        "primary_body_pt": 24,
        "minimum_authored_pt": 16,
        "claim_boundary": CLAIM_BOUNDARY,
        "pages": pages,
    }
    MANIFEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    NOTES_MD.write_text(
        "# Part B V2 P046-P063 speaker notes\n\n" +
        "\n\n".join(f"## P{number:03d}\n\n{notes_by_page[number]}" for number in PAGE_NUMBERS) + "\n",
        encoding="utf-8",
    )


def write_readme(report: dict) -> None:
    README.write_text(
        "# Part B V2 P046-P063\n\n"
        f"Root-level editable PPTX: `{OUTPUT}`\n\n"
        f"- Scope: Lab A freeze/withheld/conclusion, complete Lab B, and result-to-website bridge.\n"
        f"- Template: `{TEMPLATE}`\n"
        f"- Template SHA-256: `{report['template_sha256']}`\n"
        "- Construction: native `python-pptx` from template slide 2 / `slideLayout2.xml`; template-owned parts restored after authoring.\n"
        "- Evidence: current Trace A／Trace B values are embedded only on the three result-interpretation pages; no screenshot is embedded.\n"
        f"- Structural QA: `{report['status']}`; slide count `{report['slide_count']}`; notes count `{report['notes_count']}`.\n"
        "- Rendering: LibreOffice headless conversion was attempted; the current sandbox returned exit 1 without a PDF, so original-size raster inspection remains deferred to the controller environment.\n"
        "- Microsoft PowerPoint reopen: deferred to the controller environment.\n",
        encoding="utf-8",
    )


def build() -> dict:
    if not TEMPLATE.exists():
        raise FileNotFoundError(TEMPLATE)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    prs = Presentation(str(TEMPLATE))
    remove_all_slides(prs)
    for builder in BUILDERS:
        builder(prs)
    notes_by_page = {
        number: prs.slides[index].notes_slide.notes_text_frame.text
        for index, number in enumerate(PAGE_NUMBERS)
    }
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    # First export is intentionally written before any structural QA report.
    # The root-level path is the handoff path owned by this lane.
    prs.save(str(OUTPUT))
    overlay_template_parts(OUTPUT)
    early = {"output": str(OUTPUT), "slide_count": len(prs.slides), "stage": "early-valid-export"}
    (QA_DIR / "early-export.json").write_text(json.dumps(early, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(early, ensure_ascii=False))
    report = structural_qa(OUTPUT)
    QA_DIR.mkdir(parents=True, exist_ok=True)
    (QA_DIR / "structural-qa.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_manifest(notes_by_page)
    write_readme(report)
    if report["status"] != "PASS":
        raise RuntimeError(json.dumps(report, ensure_ascii=False))
    # Publish the fixed, range-stable handoff name only after structural QA.
    published = LATEST_ROOT / OUTPUT.name
    published.write_bytes(OUTPUT.read_bytes())
    report["published_output"] = str(published)
    (QA_DIR / "structural-qa.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "status": report["status"], "slides": report["slide_count"], "notes": report["notes_count"]}, ensure_ascii=False))
    return report


if __name__ == "__main__":
    build()
