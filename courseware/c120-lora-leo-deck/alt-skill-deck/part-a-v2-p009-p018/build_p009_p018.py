#!/usr/bin/env python3
"""Build the owned Part A P009-P018 deck from the native educate layout 2.

This lane is intentionally self-contained.  It reads the shared Part A source
manifest for page identity and titles, then creates new editable shapes and
notes from the authoritative P009-P018 teaching contract.  It never clones a
rejected deck or edits another writer's source.
"""

from __future__ import annotations

import copy
import json
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


LANE_ROOT = Path(__file__).resolve().parent
ALT_ROOT = LANE_ROOT.parent
LATEST_ROOT = ALT_ROOT / "latest"
LATEST_ROOT.mkdir(parents=True, exist_ok=True)
TEMPLATE = next(
    candidate
    for candidate in (
        Path("/home/u24/pptx-wrap/assets/templates/educate.pptx"),
        Path("/home/sat/pptx-wrap/assets/templates/educate.pptx"),
        Path("/home/u24/ppt-master/template/educate.pptx"),
    )
    if candidate.is_file()
)
SOURCE = ALT_ROOT / "part-a" / "slides.json"
WORKING_ROOT = LANE_ROOT / "build"
OUTPUT = WORKING_ROOT / "LoRaEnergySim-LEO-ALT-PART-A-V2-P009-P018-REVIEW.pptx"
SOURCE_SLICE = LANE_ROOT / "p009-p018-source.json"
QA_OUTPUT = LANE_ROOT / "qa" / "p009-p018-qa.json"

P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
REL_TYPE_SLIDE_LAYOUT = "/slideLayout"

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
SLATE_PALE = "F7F8FC"

SLIDE_IDS = [f"P{i:03d}" for i in range(9, 19)]


def rgb(value: str) -> RGBColor:
    return RGBColor.from_string(value)


def set_run_fonts(run) -> None:
    """Use 標楷體 for CJK glyphs and Times New Roman for Latin/numerals."""
    rpr = run._r.get_or_add_rPr()
    for tag, face in (("latin", "Times New Roman"), ("ea", "標楷體"), ("cs", "Times New Roman")):
        child = rpr.find(qn(f"a:{tag}"))
        if child is None:
            child = OxmlElement(f"a:{tag}")
            rpr.append(child)
        child.set("typeface", face)


def add_marked_runs(paragraph, text: str, size: float, color: str, bold: bool = False) -> None:
    """Backtick spans are variables, field names, commands, or formulas."""
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
        run.font.italic = marked
        run.font.color.rgb = rgb(color)
        set_run_fonts(run)


def write_text(
    shape,
    text: str,
    size: float = 24,
    color: str = INK,
    bold: bool = False,
    align=PP_ALIGN.LEFT,
    valign=MSO_ANCHOR.MIDDLE,
    margins=(0.08, 0.04, 0.08, 0.04),
    line_spacing: float = 1.0,
) -> None:
    tf = shape.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.vertical_anchor = valign
    tf.margin_left = Inches(margins[0])
    tf.margin_top = Inches(margins[1])
    tf.margin_right = Inches(margins[2])
    tf.margin_bottom = Inches(margins[3])
    for idx, line in enumerate(text.split("\n")):
        paragraph = tf.paragraphs[0] if idx == 0 else tf.add_paragraph()
        paragraph.alignment = align
        paragraph.line_spacing = line_spacing
        paragraph.space_before = Pt(0)
        paragraph.space_after = Pt(0)
        add_marked_runs(paragraph, line, size, color, bold)


def add_text(
    slide,
    x: float,
    y: float,
    w: float,
    h: float,
    text: str,
    size: float = 24,
    color: str = INK,
    bold: bool = False,
    align=PP_ALIGN.LEFT,
    valign=MSO_ANCHOR.MIDDLE,
    margins=(0.02, 0.01, 0.02, 0.01),
    line_spacing: float = 1.0,
    name: str = "Text",
):
    shape = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    shape.name = name
    write_text(shape, text, size, color, bold, align, valign, margins, line_spacing)
    return shape


def add_box(
    slide,
    x: float,
    y: float,
    w: float,
    h: float,
    fill: str,
    line: str | None = LINE,
    radius: bool = True,
    name: str = "Box",
    line_width: float = 1.2,
):
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


def add_label_box(
    slide,
    x: float,
    y: float,
    w: float,
    h: float,
    text: str,
    fill: str,
    line: str,
    size: float = 20,
    color: str = NAVY,
    bold: bool = True,
    align=PP_ALIGN.CENTER,
    name: str = "Label",
):
    shape = add_box(slide, x, y, w, h, fill, line, name=name)
    write_text(shape, text, size, color, bold, align, MSO_ANCHOR.MIDDLE, margins=(0.10, 0.04, 0.10, 0.04), line_spacing=0.95)
    return shape


def add_chevron(slide, x: float, y: float, w: float = 0.38, h: float = 0.48, color: str = BLUE):
    shape = slide.shapes.add_shape(MSO_SHAPE.CHEVRON, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.fill.solid()
    shape.fill.fore_color.rgb = rgb(color)
    shape.line.fill.background()
    return shape


def add_contract_band(
    slide,
    text: str,
    y: float = 5.72,
    h: float = 0.82,
    line: str = BLUE,
    name: str = "Field contract",
    size: float = 18,
):
    band = add_box(slide, 0.88, y, 11.55, h, SLATE_PALE, line, name=name, line_width=1.0)
    write_text(band, text, size, NAVY, False, PP_ALIGN.LEFT, MSO_ANCHOR.MIDDLE, margins=(0.16, 0.04, 0.16, 0.04), line_spacing=0.90)
    return band


def add_code_box(slide, x: float, y: float, w: float, h: float, text: str, fill: str = "F1F4FA", line: str = BLUE, size: float = 20, name: str = "Command"):
    box = add_box(slide, x, y, w, h, fill, line, name=name, line_width=1.0)
    write_text(box, text, size, NAVY, False, PP_ALIGN.LEFT, MSO_ANCHOR.MIDDLE, margins=(0.18, 0.06, 0.18, 0.06), line_spacing=0.92)
    return box


def delete_shape(shape) -> None:
    element = shape._element
    element.getparent().remove(element)


def prepare_slide(prs: Presentation, title: str):
    # In the exact source template, index 1 is slideLayout2.xml.
    slide = prs.slides.add_slide(prs.slide_layouts[1])
    title_shape = slide.shapes.title
    if title_shape is None:
        raise RuntimeError("slideLayout2 title placeholder missing")
    for placeholder in list(slide.placeholders):
        if placeholder._element is title_shape._element or placeholder.placeholder_format.type == PP_PLACEHOLDER.TITLE:
            continue
        if placeholder.placeholder_format.type not in {PP_PLACEHOLDER.DATE, PP_PLACEHOLDER.FOOTER, PP_PLACEHOLDER.SLIDE_NUMBER}:
            delete_shape(placeholder)
    title_shape.left = Inches(0.718057)
    title_shape.top = Inches(0.204514)
    title_shape.width = Inches(10.34861)
    title_shape.height = Inches(0.525)
    title_shape.name = "Native layout2 title"
    write_text(title_shape, title, 28, NAVY, True, PP_ALIGN.LEFT, MSO_ANCHOR.MIDDLE, margins=(0.02, 0.0, 0.02, 0.0))
    return slide


def remove_all_slides(prs: Presentation) -> None:
    sld_id_lst = prs.slides._sldIdLst
    for sld_id in list(sld_id_lst):
        prs.part.drop_rel(sld_id.rId)
        sld_id_lst.remove(sld_id)


def overlay_template_parts(path: Path) -> None:
    """Restore the exact template-owned master/layout/theme/media parts."""
    owned_prefixes = (
        "ppt/slideLayouts/",
        "ppt/slideMasters/",
        "ppt/theme/",
        "ppt/media/",
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


def load_source_slice() -> list[dict]:
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    selected = [page for page in source["slides"] if page["id"] in SLIDE_IDS]
    if [page["id"] for page in selected] != SLIDE_IDS:
        raise RuntimeError("source manifest does not contain the exact P009-P018 sequence")
    return selected


def title_for(source_slice: list[dict], page_id: str) -> str:
    return next(page["title"] for page in source_slice if page["id"] == page_id)


def slide_p009(prs, source_slice):
    slide = prepare_slide(prs, title_for(source_slice, "P009"))
    add_text(slide, 1.02, 1.08, 11.30, 0.48, "固定來源、固定情境與固定主張上限，才形成可比較證據", 24, NAVY, True, PP_ALIGN.CENTER, name="P009 lead")
    left = add_box(slide, 0.92, 1.78, 5.55, 2.30, BLUE_PALE, BLUE, name="P009 provenance card")
    write_text(left, "`provenance`（來源鏈）\n來源：package receipt／scenario／policy identity／run artifact\n作用：連結輸入與輸出；判讀：確認 evidence scope", 20, INK, False, PP_ALIGN.LEFT, MSO_ANCHOR.MIDDLE, margins=(0.24, 0.10, 0.24, 0.10), line_spacing=0.92)
    right = add_box(slide, 6.85, 1.78, 5.55, 2.30, RED_PALE, RED, name="P009 source mode card")
    write_text(right, "`source_mode`（來源模式）\n來源：result metadata\n值：`student-run`／`same-scenario-fallback`\n單位：enum；判讀：來源分類保持原值", 20, INK, False, PP_ALIGN.LEFT, MSO_ANCHOR.MIDDLE, margins=(0.24, 0.10, 0.24, 0.10), line_spacing=0.91)
    add_label_box(slide, 1.02, 4.30, 11.27, 0.80, "`claim_boundary`（主張邊界）｜來源：course contract｜作用：標示 evidence class\n固定值：SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED｜單位：fixed string｜判讀：主張上限固定", GOLD_PALE, GOLD, 18, NAVY, True, name="P009 claim ceiling")
    add_contract_band(slide, "`package identity`（套件識別）｜來源：release manifest｜作用：綁定 package 與 artifact｜單位：identifier｜判讀：identity mismatch 停止匯入", line=PURPLE, name="P009 package identity")
    slide.notes_slide.notes_text_frame.text = (
        "本頁界定來源鏈與主張上限。provenance 由 package receipt、scenario、policy identity 與 run artifact 組成，作用是連結輸入與輸出，並限定 evidence scope。"
        "source_mode 來自 result metadata，值為 student-run 或 same-scenario-fallback，單位是 enum；來源分類必須保持原值。"
        "claim_boundary 是固定的 evidence class：SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED。package identity 由 release manifest 提供，作用是綁定 package 與 artifact；identity 不一致時，匯入流程停止。"
    )


def slide_p010(prs, source_slice):
    slide = prepare_slide(prs, title_for(source_slice, "P010"))
    add_text(slide, 1.00, 1.06, 11.35, 0.48, "一份 reviewed release asset，對應一個可核對的 package root", 24, NAVY, True, PP_ALIGN.CENTER, name="P010 lead")
    release = add_box(slide, 0.92, 1.75, 3.45, 3.15, BLUE_PALE, BLUE, name="P010 release asset")
    add_text(slide, 1.18, 2.05, 2.93, 0.62, "`lora-energy-lab-v1.zip`", 22, BLUE, True, PP_ALIGN.CENTER, name="P010 release filename")
    add_text(slide, 1.20, 2.88, 2.88, 1.58, "`release asset`\n發布封裝\n來源：course package distribution\n作用：提供同一組 runner files\n單位：archive file\n判讀：package identity boundary", 18, INK, False, PP_ALIGN.CENTER, name="P010 release definition")
    add_chevron(slide, 4.53, 2.95, 0.45, 0.58, BLUE)
    root = add_box(slide, 5.18, 1.62, 7.20, 3.45, TEAL_PALE, TEAL, name="P010 package root")
    add_text(slide, 5.48, 1.84, 6.60, 0.48, "`lora-energy-lab/`｜package root", 23, TEAL, True, PP_ALIGN.CENTER, name="P010 root heading")
    blocks = [
        (5.48, 2.48, 1.98, "README.zh-TW.md", "說明"),
        (7.62, 2.48, 1.98, "setup.sh  setup.cmd", "設定"),
        (9.76, 2.48, 2.30, "course.sh  course.cmd", "驗證／執行"),
        (5.48, 3.52, 1.98, "student_policy.py", "策略"),
        (7.62, 3.52, 1.98, "schemas/", "契約"),
        (9.76, 3.52, 2.30, "fallback_artifacts/", "回復資料"),
    ]
    for idx, (x, y, w, label, purpose) in enumerate(blocks, start=1):
        add_label_box(slide, x, y, w, 0.70, f"{label}\n{purpose}", WHITE, TEAL, 18, NAVY, True, name=f"P010 root item {idx}")
    add_contract_band(slide, "`package root`（套件根目錄）｜來源：extracted release asset｜作用：固定 setup／launcher 的工作錨點｜單位：directory｜判讀：`.venv` 與 artifacts 留在此邊界", line=TEAL, name="P010 package root contract")
    slide.notes_slide.notes_text_frame.text = (
        "本頁說明 release asset 與 package root 的關係。lora-energy-lab-v1.zip 是課程封裝檔，release asset 的來源是 course package distribution，作用是提供同一組 runner files，單位是 archive file。"
        "解壓後的 lora-energy-lab/ 是 package root，包含 README、兩套平台啟動器、策略檔、schemas 與 same-scenario fallback artifacts。package root 的作用是固定 setup、launcher、.venv 與 artifacts 的工作錨點。"
        "根目錄內容必須保持為同一份 reviewed package；內容不完整時，問題仍屬於 package identity，尚未進入 interpreter 或 case gate。"
    )


def slide_p011(prs, source_slice):
    slide = prepare_slide(prs, title_for(source_slice, "P011"))
    add_text(slide, 1.02, 1.06, 11.30, 0.48, "root inventory 完整後，interpreter gate 開啟", 24, NAVY, True, PP_ALIGN.CENTER, name="P011 lead")
    inventory = add_box(slide, 0.92, 1.78, 5.05, 3.12, BLUE_PALE, BLUE, name="P011 inventory")
    write_text(inventory, "`root inventory`（根目錄清單）\n來源：release manifest + extracted package root\n作用：確認 required files 屬於同一 package\n單位：identifier／list\nREADME／setup／course launcher；`student_policy.py`；`schemas/`／`fallback_artifacts/`\n判讀：必要檔案同屬一份 release asset", 19, INK, False, PP_ALIGN.LEFT, MSO_ANCHOR.MIDDLE, margins=(0.24, 0.10, 0.24, 0.10), line_spacing=0.88)
    add_chevron(slide, 6.20, 2.98, 0.45, 0.58, BLUE)
    gate = add_box(slide, 6.92, 1.78, 5.46, 3.12, TEAL_PALE, TEAL, name="P011 gate")
    add_text(slide, 7.24, 2.04, 4.82, 0.48, "identity gate", 24, TEAL, True, PP_ALIGN.CENTER, name="P011 identity heading")
    add_label_box(slide, 7.45, 2.75, 4.38, 0.72, "root complete", WHITE, TEAL, 21, NAVY, True, name="P011 root complete")
    add_chevron(slide, 9.39, 3.60, 0.40, 0.42, TEAL)
    add_label_box(slide, 7.45, 4.05, 4.38, 0.58, "interpreter gate", GOLD_PALE, GOLD, 20, NAVY, True, name="P011 interpreter gate")
    add_text(slide, 1.02, 5.08, 11.27, 0.38, "root incomplete → 保留錯誤，重新取得同一 release asset", 19, RED, True, PP_ALIGN.CENTER, name="P011 recovery")
    add_contract_band(slide, "`package identity`（套件識別）｜來源：release manifest + root inventory｜作用：確認 required files 屬於同一 package｜單位：identifier／list｜判讀：identity mismatch 停在 setup 前", line=BLUE, name="P011 package identity contract")
    slide.notes_slide.notes_text_frame.text = (
        "本頁把 package identity 轉成兩段 gate。root inventory 來自 release manifest 與 extracted package root，列出 README、兩套 setup／course launcher、student_policy.py、schemas 與 fallback_artifacts；作用是確認 required files 屬於同一 package，單位是 identifier 或 list。"
        "root inventory 完整後，流程才進入 interpreter gate。若 root 不完整，錯誤保留在 package identity 邊界，重新取得同一 release asset；不以補檔改變 package 內容。"
    )


def slide_p012(prs, source_slice):
    slide = prepare_slide(prs, title_for(source_slice, "P012"))
    add_text(slide, 1.00, 1.06, 11.34, 0.48, "Windows shell identity 與 Python 3.11.x 是 setup 的前置 gate", 24, NAVY, True, PP_ALIGN.CENTER, name="P012 lead")
    cmd = add_box(slide, 0.92, 1.74, 5.25, 3.28, BLUE_PALE, BLUE, name="P012 CMD")
    write_text(cmd, "`CMD`（Windows 命令提示字元）\n來源：Windows native shell\n作用：執行 `.cmd` launcher\n單位：shell type\n判讀：path 使用 `\\`\n\n`py --list`\n`py -3.11 --version`", 18, INK, False, PP_ALIGN.LEFT, MSO_ANCHOR.MIDDLE, margins=(0.22, 0.08, 0.22, 0.08), line_spacing=0.89)
    ps = add_box(slide, 6.55, 1.74, 5.25, 3.28, TEAL_PALE, TEAL, name="P012 PowerShell")
    write_text(ps, "`PowerShell`（Windows 管理命令殼）\n來源：Windows native shell\n作用：執行 `.cmd` 與查看 receipt\n單位：shell type\n判讀：命令語法與 CMD 不同\n\n`py --list`\n`py -3.11 --version`", 18, INK, False, PP_ALIGN.LEFT, MSO_ANCHOR.MIDDLE, margins=(0.22, 0.08, 0.22, 0.08), line_spacing=0.89)
    add_label_box(slide, 3.74, 5.12, 5.84, 0.46, "預期：`py --list` 出現 3.11；版本命令回傳 `Python 3.11.x`", GOLD_PALE, GOLD, 19, NAVY, True, name="P012 expected")
    add_contract_band(slide, "`Python 3.11.x`（固定直譯器版本）｜來源：runner frozen contract｜作用：建立 package-local `.venv`｜單位：version｜判讀：其他 minor version 不通過版本 gate", line=GOLD, name="P012 Python contract")
    slide.notes_slide.notes_text_frame.text = (
        "本頁區分 Windows 的兩種 native shell。CMD 來自 Windows native shell，作用是執行 .cmd launcher，單位是 shell type，path 使用反斜線；PowerShell 同屬 Windows native shell，也執行 .cmd，但命令語法不同。"
        "兩個 shell 都以 py --list 與 py -3.11 --version 確認固定直譯器。Python 3.11.x 來自 runner frozen contract，作用是建立 package-local .venv，單位是 version；版本 gate 不接受其他 minor version。"
        "版本正確只表示可以進入 setup，尚未表示 package-local venv 或 READY receipt 已經存在。"
    )


def slide_p013(prs, source_slice):
    slide = prepare_slide(prs, title_for(source_slice, "P013"))
    add_text(slide, 1.00, 1.06, 11.34, 0.48, "Python 3.11 缺少時，recovery 路徑指向 exact interpreter，再回到 setup", 24, NAVY, True, PP_ALIGN.CENTER, name="P013 lead")
    add_label_box(slide, 0.92, 1.78, 2.45, 1.02, "3.11 不在清單\n版本 gate 未通過", RED_PALE, RED, 20, NAVY, True, name="P013 missing")
    steps = [
        (3.72, "取得 uv", "`winget install --id=astral-sh.uv -e`", GOLD_PALE, GOLD),
        (6.20, "安裝 3.11", "`uv python install 3.11`", BLUE_PALE, BLUE),
        (8.68, "定位 path", "`uv python find 3.11`", TEAL_PALE, TEAL),
        (11.16, "回到 setup", "PYTHON_BIN → setup", PURPLE_PALE, PURPLE),
    ]
    for idx, (x, heading, body, fill, line) in enumerate(steps):
        add_label_box(slide, x, 1.78, 1.82, 1.02, f"{heading}\n{body}", fill, line, 18, NAVY, True, name=f"P013 ladder {idx + 1}")
        if idx < len(steps) - 1:
            add_chevron(slide, x + 1.92, 2.07, 0.32, 0.42, line)
    add_code_box(slide, 0.92, 3.18, 11.48, 1.10, "`uv --version`\n`uv python install 3.11`\n`uv python find 3.11` → 可執行的 Python 3.11 interpreter path", fill="F1F4FA", line=BLUE, size=20, name="P013 uv commands")
    add_label_box(slide, 1.26, 4.60, 10.78, 0.48, "uv 成功只產生 interpreter path；package setup、`READY` 與 case result 仍是後續 gate", SLATE_PALE, PURPLE, 19, NAVY, True, name="P013 boundary")
    add_contract_band(slide, "`uv`（Python 執行環境管理工具）｜來源：runtime recovery tool｜作用：取得並定位 exact Python 3.11｜單位：tool／version／path｜判讀：只處理 interpreter recovery", line=PURPLE, name="P013 uv contract")
    slide.notes_slide.notes_text_frame.text = (
        "本頁處理 Windows 找不到 Python 3.11 的 recovery。uv 是 Python 執行環境管理工具，來源是 runtime recovery tool，作用是取得並定位 exact Python 3.11，單位可為 tool、version 或 path；判讀時只把它視為 interpreter recovery。"
        "PowerShell 可用 winget 取得 uv，接著執行 uv python install 3.11 與 uv python find 3.11。find 回傳的 path 會交給後續 setup；uv 本身不建立 package-local .venv，不產生 READY receipt，也不產生 case result。"
        "若 recovery 工具或網路失敗，錯誤仍屬於 interpreter 邊界；回到可取得 Python 3.11 的路徑，不能以其他 minor version 通過版本 gate。"
    )


def slide_p014(prs, source_slice):
    slide = prepare_slide(prs, title_for(source_slice, "P014"))
    add_text(slide, 1.00, 1.06, 11.34, 0.48, "Windows native 與 POSIX／WSL 是兩套 shell、path 與 venv 邊界", 24, NAVY, True, PP_ALIGN.CENTER, name="P014 lead")
    win = add_box(slide, 0.92, 1.76, 5.36, 3.06, BLUE_PALE, BLUE, name="P014 Windows lane")
    write_text(win, "Windows native\n`.cmd` 啟動器\npath：`C:\\...`\ninterpreter：`.venv\\Scripts\\python.exe`\n\n作用：Windows shell 內完成 setup／verify", 21, INK, False, PP_ALIGN.LEFT, MSO_ANCHOR.MIDDLE, margins=(0.26, 0.10, 0.26, 0.10), line_spacing=0.92)
    posix = add_box(slide, 6.74, 1.76, 5.36, 3.06, TEAL_PALE, TEAL, name="P014 POSIX lane")
    write_text(posix, "`POSIX`（Unix-like shell 環境）\n來源：macOS／Linux／WSL\n作用：執行 `.sh` 啟動器\n單位：environment class\n判讀：path 使用 `/`\ninterpreter：`.venv/bin/python`", 19, INK, False, PP_ALIGN.LEFT, MSO_ANCHOR.MIDDLE, margins=(0.26, 0.10, 0.26, 0.10), line_spacing=0.89)
    add_label_box(slide, 2.20, 5.08, 3.82, 0.48, "Windows 與 WSL 的 `.venv` 不互換", RED_PALE, RED, 19, NAVY, True, name="P014 isolation")
    add_label_box(slide, 7.30, 5.08, 3.82, 0.48, "WSL identity：`pwd` 為 Linux path", GOLD_PALE, GOLD, 19, NAVY, True, name="P014 identity")
    add_contract_band(slide, "`WSL`（Windows Subsystem for Linux；Windows 的 Linux 執行層）｜來源：host platform｜作用：提供 Ubuntu／Linux tools｜單位：environment class｜判讀：擁有獨立 `.venv`", line=TEAL, name="P014 WSL contract")
    slide.notes_slide.notes_text_frame.text = (
        "本頁區分 Windows native 與 POSIX／WSL。Windows native 使用 .cmd launcher 與反斜線 path；POSIX、Linux、macOS 與 WSL 使用 .sh launcher 與斜線 path。兩邊的 package-local interpreter 也不同：Windows 是 .venv\\Scripts\\python.exe，POSIX／WSL 是 .venv/bin/python。"
        "WSL 是 Windows Subsystem for Linux，來源是 host platform，作用是提供 Ubuntu 或 Linux tools，單位是 environment class；它擁有獨立的 Linux filesystem 與 .venv。Windows 與 WSL 的 venv 不互換。"
        "WSL identity 以 Linux path 的 pwd 結果核對，通過後才在該環境使用 .sh 命令。"
    )


def slide_p015(prs, source_slice):
    slide = prepare_slide(prs, title_for(source_slice, "P015"))
    add_text(slide, 1.00, 1.06, 11.34, 0.48, "`.venv` 是 package root 內的隔離目錄；`venv` 是建立它的標準模組", 24, NAVY, True, PP_ALIGN.CENTER, name="P015 lead")
    root = add_box(slide, 0.92, 1.78, 3.00, 3.12, BLUE_PALE, BLUE, name="P015 package root")
    add_text(slide, 1.20, 2.12, 2.44, 0.56, "`lora-energy-lab/`", 23, BLUE, True, PP_ALIGN.CENTER, name="P015 root")
    add_label_box(slide, 1.27, 3.02, 2.30, 0.86, "`.venv`\npackage-local", WHITE, BLUE, 21, NAVY, True, name="P015 venv")
    add_chevron(slide, 4.16, 3.12, 0.42, 0.48, BLUE)
    win = add_box(slide, 4.82, 1.78, 3.45, 3.12, TEAL_PALE, TEAL, name="P015 Windows path")
    write_text(win, "Windows path\n`.venv\\Scripts\\python.exe`\n\n`...python.exe --version`\n→ `Python 3.11.x`", 20, INK, False, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE, margins=(0.18, 0.10, 0.18, 0.10), line_spacing=0.92)
    add_chevron(slide, 8.48, 3.12, 0.42, 0.48, TEAL)
    posix = add_box(slide, 9.14, 1.78, 3.24, 3.12, GOLD_PALE, GOLD, name="P015 POSIX path")
    write_text(posix, "POSIX／WSL path\n`.venv/bin/python`\n\n`./.venv/bin/python --version`\n→ `Python 3.11.x`", 20, INK, False, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE, margins=(0.16, 0.10, 0.16, 0.10), line_spacing=0.92)
    add_label_box(slide, 2.06, 5.08, 9.20, 0.48, "正常 launcher 直接呼叫 package-local interpreter；環境啟用僅供手動診斷", SLATE_PALE, PURPLE, 19, NAVY, True, name="P015 activation")
    add_contract_band(slide, "`.venv`（套件本地虛擬環境）｜來源：Python `venv` module｜作用：隔離 lock、policy 與 runner｜單位：directory｜判讀：launcher 使用此 package-local interpreter", line=BLUE, name="P015 venv contract")
    slide.notes_slide.notes_text_frame.text = (
        "本頁拆開 .venv 與 venv 兩個概念。.venv 是 package root 內的套件本地虛擬環境，來源是 Python venv module，作用是隔離 lock、policy 與 runner，單位是 directory；launcher 會直接使用這個 package-local interpreter。"
        "Windows 路徑是 .venv\\Scripts\\python.exe，POSIX／WSL 路徑是 .venv/bin/python，兩者都應回傳 Python 3.11.x。venv 是建立目錄的標準模組，不是另一個 Python minor version。"
        "正常 package 操作不需要持續啟用環境；activation 只保留給手動診斷。若既有 venv 的 minor version 不符，修正範圍限於目前 package root 內的 .venv。"
    )


def slide_p016(prs, source_slice):
    slide = prepare_slide(prs, title_for(source_slice, "P016"))
    add_text(slide, 1.00, 1.06, 11.34, 0.48, "Windows setup 建立隔離環境；verify 將 gate 寫成 READY receipt", 24, NAVY, True, PP_ALIGN.CENTER, name="P016 lead")
    add_code_box(slide, 0.92, 1.74, 5.42, 1.40, "CMD\n`set \"PYTHON_BIN=py -3.11\"`\n`setup.cmd`\n`course.cmd verify`", fill=BLUE_PALE, line=BLUE, size=20, name="P016 CMD")
    add_code_box(slide, 6.72, 1.74, 5.66, 1.40, "PowerShell\n`$env:PYTHON_BIN = \"py -3.11\"`\n`.\\setup.cmd`\n`.\\course.cmd verify`", fill=TEAL_PALE, line=TEAL, size=20, name="P016 PowerShell")
    receipt = add_box(slide, 0.92, 3.30, 11.46, 1.82, GOLD_PALE, GOLD, name="P016 receipt")
    write_text(receipt, "`status`（狀態）= READY；`python_version`（Python 版本）= 3.11.x\n`scenario_id`（情境識別碼）= ntpu-energy-decision-01；`engine_mode`（引擎模式）= coherent-course-simulated-adapter\n`upstream_execution`（上游執行）= false\n來源：verify receipt｜作用：核對 environment／contract gate｜單位：enum／version／identifier／Boolean｜判讀：READY permits case entry", 18, NAVY, True, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE, margins=(0.20, 0.08, 0.20, 0.08), line_spacing=0.90)
    add_label_box(slide, 2.00, 5.20, 9.30, 0.38, "預期檔案：`artifacts\\verify-receipt.json`；READY 只表示 gate 通過", SLATE_PALE, RED, 18, NAVY, True, name="P016 receipt meaning")
    add_contract_band(slide, "`READY`（環境就緒狀態）｜來源：`artifacts/verify-receipt.json`｜作用：表示 environment／contract gate 通過｜單位：enum｜判讀：可進入 case execution，尚非 case result", line=GOLD, name="P016 READY contract")
    slide.notes_slide.notes_text_frame.text = (
        "本頁呈現 Windows package root 的 setup 與 verify。setup.cmd 依 Python 3.11 建立 package-local .venv、安裝 lock dependencies 並執行 verification；course.cmd verify 重新核對 interpreter、lock、scenario 與 policy contract。"
        "CMD 與 PowerShell 的命令入口不同，但兩者都產生同一個 verify receipt。READY 來自 artifacts/verify-receipt.json，來源是 setup／verify command，作用是表示 environment 與 contract gate 通過，單位是 enum；它允許進入 case execution，仍不是 case result。"
        "receipt 中的 scenario_id 綁定固定情境，engine_mode 標示 coherent-course-simulated-adapter，upstream_execution 維持 false。claim boundary 仍是 SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED。"
    )


def slide_p017(prs, source_slice):
    slide = prepare_slide(prs, title_for(source_slice, "P017"))
    add_text(slide, 1.00, 1.06, 11.34, 0.48, "WSL identity gate：Windows shell 進入 Ubuntu，後續命令才屬於 Linux", 24, NAVY, True, PP_ALIGN.CENTER, name="P017 lead")
    steps = [
        (0.92, "Windows PowerShell", "`wsl --install -d Ubuntu`\n僅在 distribution 不存在時", BLUE_PALE, BLUE),
        (3.94, "`distribution`（發行版）", "`wsl -l -v`\n選定 Ubuntu", GOLD_PALE, GOLD),
        (6.96, "進入 Linux shell", "`wsl -d Ubuntu`\n後續使用 `.sh`", TEAL_PALE, TEAL),
        (9.98, "identity evidence", "`pwd` → Linux path\n`uname -a` → Linux", PURPLE_PALE, PURPLE),
    ]
    for idx, (x, heading, body, fill, line) in enumerate(steps):
        add_label_box(slide, x, 1.78, 2.38, 1.62, f"{heading}\n{body}", fill, line, 18, NAVY, True, name=f"P017 step {idx + 1}")
        if idx < len(steps) - 1:
            add_chevron(slide, x + 2.48, 2.34, 0.35, 0.46, line)
    add_label_box(slide, 2.02, 3.88, 9.28, 0.72, "Windows：`.cmd`　｜　Ubuntu／WSL：`.sh`、`apt`、`.venv/bin/python`", SLATE_PALE, BLUE, 21, NAVY, True, name="P017 shell boundary")
    add_text(slide, 1.12, 4.88, 11.06, 0.38, "WSL 已存在時，從 distribution 清單確認後進入；不重複安裝。", 19, MUTED, False, PP_ALIGN.CENTER, name="P017 existing")
    add_contract_band(slide, "`Ubuntu`（Linux 發行版）｜來源：WSL distribution｜作用：提供已核對的 Linux shell｜單位：distribution name｜判讀：`setup.sh` 與 `course.sh` 在此邊界執行", line=TEAL, name="P017 Ubuntu contract")
    slide.notes_slide.notes_text_frame.text = (
        "本頁建立 WSL 的 shell identity gate。wsl --install -d Ubuntu 只在 Ubuntu distribution 不存在時使用；wsl -l -v 顯示 distribution、version 與 status，wsl -d Ubuntu 進入 Linux shell。"
        "Ubuntu 是 WSL distribution，來源是 WSL distribution，作用是提供已核對的 Linux shell，單位是 distribution name；setup.sh、course.sh、apt 與 .venv/bin/python 都屬於這個邊界。"
        "進入後以 pwd 確認 Linux path，以 uname -a 確認 Linux kernel label。identity 通過後，Windows 的 .cmd 與 Linux 的 .sh 保持分離。"
    )


def slide_p018(prs, source_slice):
    slide = prepare_slide(prs, title_for(source_slice, "P018"))
    add_text(slide, 1.00, 1.06, 11.34, 0.48, "Ubuntu／WSL `toolchain`（工具鏈）依序建立：解壓工具 → uv → Python 3.11", 24, NAVY, True, PP_ALIGN.CENTER, name="P018 lead")
    ladder = [
        (0.92, "`apt`\nLinux 套件管理器", "取得 `curl`／`unzip`\nunit：command／tool", BLUE_PALE, BLUE),
        (3.92, "`curl` + `unzip`", "下載 installer\n展開 release asset", GOLD_PALE, GOLD),
        (6.92, "`uv`", "取得並定位\nPython 3.11", TEAL_PALE, TEAL),
        (9.92, "Python 3.11", "`uv python find 3.11`\n回傳 interpreter path", PURPLE_PALE, PURPLE),
    ]
    for idx, (x, heading, body, fill, line) in enumerate(ladder):
        add_label_box(slide, x, 1.78, 2.38, 1.48, f"{heading}\n{body}", fill, line, 18, NAVY, True, name=f"P018 ladder {idx + 1}")
        if idx < len(ladder) - 1:
            add_chevron(slide, x + 2.48, 2.30, 0.35, 0.46, line)
    add_code_box(slide, 0.92, 3.62, 11.46, 1.24, "`sudo apt update`\n`sudo apt install -y curl unzip`\n`curl -LsSf https://astral.sh/uv/install.sh | sh`\n新的 Ubuntu shell：`uv --version` → `uv python install 3.11` → `uv python find 3.11`", fill="F1F4FA", line=BLUE, size=18, name="P018 commands")
    add_label_box(slide, 2.16, 5.08, 9.06, 0.46, "toolchain 完成只表示環境輸入可用；release 解壓、setup 與 READY 仍由後續頁面核對", SLATE_PALE, RED, 18, NAVY, True, name="P018 boundary")
    add_contract_band(slide, "`toolchain`（工具鏈）｜來源：Ubuntu shell｜作用：依序建立 extraction／runtime prerequisites｜單位：ordered command set｜判讀：各階段分開核對\n`apt`（Linux 套件管理器）／`curl`（命令列傳輸工具）／`unzip`（封裝解壓工具）｜來源：Ubuntu packages｜作用：提供 release extraction 與 uv installer prerequisites｜單位：command／tool", y=5.62, h=0.98, line=BLUE, name="P018 toolchain contract")
    slide.notes_slide.notes_text_frame.text = (
        "本頁說明 Ubuntu／WSL toolchain 的順序。apt 是 Linux 套件管理器，curl 是命令列傳輸工具，unzip 是封裝解壓工具；三者來源是 Ubuntu packages，作用是提供 release extraction 與 uv installer 的前置條件，單位是 command 或 tool。"
        "apt update 與 apt install 先建立 curl、unzip；curl 取得 uv installer；新的 Ubuntu shell 載入 uv path 後，uv --version、uv python install 3.11 與 uv python find 3.11 取得 exact interpreter path。"
        "這些命令只建立環境輸入，尚未解壓 release、建立 package-local .venv，也尚未寫入 READY receipt；各階段的結果在後續 gate 中分開判讀。"
    )


def v2_card(slide, x, y, w, h, heading, body, fill, line, name, heading_size=24, body_size=22):
    """One donor-style teaching card: short heading plus at most two short lines."""
    card = add_box(slide, x, y, w, h, fill, line, name=name)
    add_text(slide, x + 0.18, y + 0.20, w - 0.36, 0.42, heading, heading_size, line, True, PP_ALIGN.CENTER, name=f"{name} heading")
    add_text(slide, x + 0.22, y + 0.88, w - 0.44, h - 1.08, body, body_size, INK, False, PP_ALIGN.CENTER, name=f"{name} body")
    return card


def v2_lead(slide, text, name):
    return add_text(slide, 1.02, 1.02, 11.28, 0.40, text, 24, NAVY, True, PP_ALIGN.CENTER, name=name)


def v2_strip(slide, text, y=4.86, h=0.58, line=GOLD, fill=GOLD_PALE, size=22, name="Causal strip"):
    return add_label_box(slide, 1.02, y, 11.28, h, text, fill, line, size, NAVY, True, name=name)


def v2_field(slide, text, line=BLUE, y=5.60, h=0.84, size=18, name="Field strip"):
    return add_contract_band(slide, text, y=y, h=h, line=line, name=name, size=size)


def v2_title(source_slice, page_id, fallback):
    """Keep the page id/source mapping while shortening titles to one line."""
    return fallback


def slide_p009_v2(prs, source_slice):
    slide = prepare_slide(prs, v2_title(source_slice, "P009", "P009｜先確認來源，再限制可說的結論"))
    v2_lead(slide, "先把同一筆證據的來源綁好，再判斷能否比較", "P009 lead")
    v2_card(slide, 0.92, 1.70, 3.55, 2.24,
            "套件已完成",
            "固定情境與策略\n啟動器、契約已封裝",
            BLUE_PALE, BLUE, "P009 package card")
    add_chevron(slide, 4.66, 2.58, 0.46, 0.54, BLUE)
    v2_card(slide, 5.28, 1.70, 3.55, 2.24,
            "本次只做",
            "`student_policy.py` 指定區塊\n只改一處，保留註解",
            TEAL_PALE, TEAL, "P009 edit card", heading_size=22, body_size=18.5)
    add_chevron(slide, 9.02, 2.58, 0.46, 0.54, TEAL)
    v2_card(slide, 9.64, 1.70, 2.68, 2.24,
            "完成後看什麼",
            "先看封包與服務\n再判讀端點能量",
            PURPLE_PALE, PURPLE, "P009 result card", heading_size=20, body_size=18.5)
    v2_strip(slide, "完成判斷：有結果檔，且能說明狀態／封包／服務如何導向端點能量；不當成實機量測", y=4.24, h=0.60, line=GOLD, fill=GOLD_PALE, size=18.5, name="P009 claim ceiling")
    v2_field(slide,
             "`provenance`（來源鏈）｜來源：封裝收據、固定情境、策略與結果檔｜作用：綁定同一筆證據\n"
             "單位：紀錄｜判讀：來源不一致時停止比較",
             line=PURPLE, name="P009 provenance field")
    slide.notes_slide.notes_text_frame.text = (
        "本頁先建立教學邊界。套件已完成固定情境、策略介面、啟動器與契約的封裝；這一段只改 student_policy.py 的指定 marked block，使用同一個情境執行，不修改封裝本身。"
        "完成後先確認有結果檔，再依序讀取 state、packet、service 與 endpoint energy；只有能說明中間事件如何導向結果，才算完成判讀。"
        "provenance 是由 package receipt、scenario、policy identity 與 run artifact 組成的來源鏈，"
        "作用是追溯 evidence scope，單位是 structured record；判讀時若 identity 或 source mode 不一致，停止比較。"
        "source mode 只保留兩種原值：student-run 與 same-scenario-fallback。兩者都可以進入教學解釋，但來源分類不能互換。"
        "本課程的 claim ceiling 是模擬教學資料，明示非 live、非 measured、非 canonical parity；READY 只表示環境與契約 gate 通過，並不等於 energy experiment 已完成。"
    )


def slide_p010_v2(prs, source_slice):
    slide = prepare_slide(prs, v2_title(source_slice, "P010", "P010｜一份封裝，一個根目錄"))
    v2_lead(slide, "先確認封裝是同一份，再檢查解開後的根目錄；此步不改程式", "P010 lead")
    v2_card(slide, 0.92, 1.70, 3.55, 2.30,
            "發布封裝",
            "同一份 ZIP\n先確認來源，再解開",
            BLUE_PALE, BLUE, "P010 release card")
    add_chevron(slide, 4.66, 2.78, 0.46, 0.54, BLUE)
    v2_card(slide, 5.28, 1.70, 3.55, 2.30,
            "根目錄",
            "lora-energy-lab/\n後續命令都在此目錄",
            TEAL_PALE, TEAL, "P010 root card")
    add_chevron(slide, 9.02, 2.78, 0.46, 0.54, TEAL)
    v2_card(slide, 9.64, 1.70, 2.68, 2.30,
            "完整清單",
            "契約／回退資料\n缺一項就停",
            PURPLE_PALE, PURPLE, "P010 inventory card", heading_size=22, body_size=20)
    v2_strip(slide, "完成判斷：只有一個 `lora-energy-lab/` 根目錄，必要內容都在；不完整就停止", y=4.34, h=0.60, line=RED, fill=RED_PALE, size=19.5, name="P010 recovery strip")
    v2_field(slide,
             "`release asset`（發布封裝）｜來源：課程封裝配送｜作用：提供同一組啟動檔與契約\n"
             "單位：封裝檔｜判讀：解開後只有一個 `lora-energy-lab/` 根目錄",
             line=BLUE, name="P010 release field")
    slide.notes_slide.notes_text_frame.text = (
        "本頁先確認 package identity。release asset 是課程封裝檔，來源是 course package distribution，作用是提供同一組 runner files，單位是 archive file。"
        "解開後的唯一 package root 是 lora-energy-lab/，其中包含 README、setup.sh、setup.cmd、course.sh、course.cmd、student_policy.py、schemas 與 fallback_artifacts。"
        "先檢查 root inventory，再進入 interpreter gate。若根目錄或必要檔案不完整，問題仍在 artifact identity；保留錯誤並重新取得同一封裝，不從其他 branch 或 checkout 拼接檔案。"
    )


def slide_p011_v2(prs, source_slice):
    slide = prepare_slide(prs, v2_title(source_slice, "P011", "P011｜清單完整，才進入版本檢查"))
    v2_lead(slide, "先確認必要檔案同屬一份封裝，再查看版本；此步不建立環境", "P011 lead")
    v2_card(slide, 0.92, 1.70, 3.55, 2.30,
            "① 必要檔案",
            "說明／啟動器／策略\n契約／回退資料都在此",
            BLUE_PALE, BLUE, "P011 identity card")
    add_chevron(slide, 4.66, 2.78, 0.46, 0.54, BLUE)
    v2_card(slide, 5.28, 1.70, 3.55, 2.30,
            "② 不完整",
            "保留錯誤訊息\n不補檔、不進下一關",
            GOLD_PALE, GOLD, "P011 integrity card")
    add_chevron(slide, 9.02, 2.78, 0.46, 0.54, GOLD)
    v2_card(slide, 9.64, 1.70, 2.68, 2.30,
            "③ 下一關",
            "版本檢查可開始\n環境仍未建立",
            TEAL_PALE, TEAL, "P011 root card", heading_size=21, body_size=20)
    v2_strip(slide, "完成判斷：必要檔案同屬一份封裝；不完整就停在這一頁", y=4.34, h=0.60, line=RED, fill=RED_PALE, size=20, name="P011 boundary strip")
    v2_field(slide,
             "`identity gate`（封裝身分檢查）｜來源：發布清單與解壓目錄｜作用：確認必要檔案同屬一份封裝\n"
             "單位：檢查｜判讀：內容不一致時停止，不進入後續環境",
             line=GOLD, name="P011 archive field")
    slide.notes_slide.notes_text_frame.text = (
        "本頁是 archive identity gate。先以 release sidecar 與封裝本身確認是同一組 bytes，再做完整性檢查；顯示 OK 且沒有錯誤後，才解開並進入 lora-energy-lab/。"
        "archive_identity 是封裝識別，來源是 release sidecar 與 archive bytes，作用是確認交付內容未被替換，單位是 content identity。"
        "這個 gate 只回答 package bytes 是否可追溯，不回答 setup、case run 或網站匯入是否成功。若不一致或解開失敗，保留錯誤並重新取得成對封裝，不混用舊檔。"
    )


def slide_p012_v2(prs, source_slice):
    slide = prepare_slide(prs, v2_title(source_slice, "P012", "P012｜先辨識 Windows 命令殼，再確認版本"))
    v2_lead(slide, "兩種命令殼的入口不同；這兩行只讀版本，不改程式與環境", "P012 lead")
    v2_card(slide, 0.92, 1.70, 5.45, 2.30,
            "命令提示字元",
            "先讀清單再讀版本\npy --list → py -3.11 --version",
            BLUE_PALE, BLUE, "P012 CMD card", heading_size=21, body_size=22)
    v2_card(slide, 6.86, 1.70, 5.45, 2.30,
            "管理命令殼",
            "先讀清單再讀版本\npy --list → py -3.11 --version",
            TEAL_PALE, TEAL, "P012 PowerShell card", heading_size=21, body_size=22)
    v2_strip(slide, "完成判斷：清單有 3.11，版本行顯示 Python 3.11.x；此步不建環境", y=4.34, h=0.60, line=GOLD, fill=GOLD_PALE, size=20, name="P012 expected strip")
    v2_field(slide,
             "`Python 3.11.x`（固定版本）｜來源：課程執行契約｜作用：提供環境建立使用的版本\n"
             "單位：版本｜判讀：其他小版本不通過版本檢查",
             line=GOLD, name="P012 Python field")
    slide.notes_slide.notes_text_frame.text = (
        "Windows 的 CMD、PowerShell 與 WSL 不是同一個 shell。CMD 與 PowerShell 都可以先用 py --list，再用 py -3.11 --version 檢查 exact minor version；看到 Python 3.11.x 才進入 setup。"
        "Python 3.11.x 是固定直譯器版本，來源是 runner frozen contract，作用是建立 package-local .venv，單位是 version。版本正確只表示可以進入 setup，還沒有 READY receipt 或 case result。"
        "如果 3.11 不在清單，保留版本錯誤，依下一頁的 recovery path 取得精確 interpreter；不要把其他 minor version 當成通過。"
    )


def slide_p013_v2(prs, source_slice):
    slide = prepare_slide(prs, v2_title(source_slice, "P013", "P013｜沒有 3.11，就補一個正確版本"))
    v2_lead(slide, "只修正版本來源；不改課程程式，也不執行案例", "P013 lead")
    v2_card(slide, 0.92, 1.70, 3.55, 2.30,
            "先取得工具",
            "先確認工具可用\nuv --version",
            RED_PALE, RED, "P013 check card")
    add_chevron(slide, 4.66, 2.78, 0.46, 0.54, RED)
    v2_card(slide, 5.28, 1.70, 3.55, 2.30,
            "安裝指定版本",
            "取得指定直譯器\nuv python install 3.11",
            BLUE_PALE, BLUE, "P013 installer card")
    add_chevron(slide, 9.02, 2.78, 0.46, 0.54, BLUE)
    v2_card(slide, 9.64, 1.70, 2.68, 2.30,
            "找到可執行路徑",
            "讀取可執行位置\nuv python find 3.11",
            TEAL_PALE, TEAL, "P013 reopen card", heading_size=21, body_size=20)
    v2_strip(slide, "完成判斷：找到 3.11 路徑；版本工具成功不等於環境成功", y=4.34, h=0.60, line=GOLD, fill=GOLD_PALE, size=20, name="P013 expected strip")
    v2_field(slide,
             "`uv`（版本工具）｜來源：主機恢復路徑｜作用：取得並定位 Python 3.11\n"
             "單位：工具／路徑｜判讀：只處理版本，不產生 READY 或案例結果",
             line=BLUE, name="P013 interpreter field")
    slide.notes_slide.notes_text_frame.text = (
        "如果 py --list 沒有 3.11，先使用 Python 3.11.x 的 64-bit Windows installer，並保留 Python Launcher；安裝後關閉並重新開啟 shell，再重跑 py --list 與 py -3.11 --version。若官方安裝路徑仍找不到 3.11，才改走 uv recovery。"
        "畫面上的三步只處理版本來源：uv --version 讀取工具是否可用，不改課程檔案；uv python install 3.11 取得指定直譯器，不建立 package-local .venv；uv python find 3.11 讀取可執行路徑，再把路徑交給後續環境建立。"
        "interpreter 是直譯器，來源是 Python 3.11.x installer、Launcher 或 uv recovery，作用是提供環境建立使用的 exact runtime，單位是 executable path。這一頁只修版本檢查；即使版本命令成功，也還沒有 READY 或案例結果。"
        "若 installer、uv 或網路失敗，保留錯誤並留在版本邊界，不把 PATH 指到其他 minor version。"
    )


def slide_p014_v2(prs, source_slice):
    slide = prepare_slide(prs, v2_title(source_slice, "P014", "P014｜工具相同，平台路徑不同"))
    v2_lead(slide, "版本工具成功後，Windows 與 Linux 各走自己的路徑；不互換環境", "P014 lead")
    v2_card(slide, 0.92, 1.70, 3.55, 2.30,
            "Windows 路徑",
            "反斜線路徑\n`.venv\\Scripts\\python.exe`",
            BLUE_PALE, BLUE, "P014 Windows card")
    add_chevron(slide, 4.66, 2.78, 0.46, 0.54, BLUE)
    v2_card(slide, 5.28, 1.70, 3.55, 2.30,
            "Linux／macOS／WSL",
            "斜線路徑\n`.venv/bin/python`",
            TEAL_PALE, TEAL, "P014 POSIX card")
    add_chevron(slide, 9.02, 2.78, 0.46, 0.54, TEAL)
    v2_card(slide, 9.64, 1.70, 2.68, 2.30,
            "交接",
            "回傳 3.11\n不產生案例結果",
            PURPLE_PALE, PURPLE, "P014 find card", heading_size=21, body_size=20)
    v2_strip(slide, "完成判斷：各平台只使用自己的環境；版本工具不產生案例結果", y=4.34, h=0.60, line=RED, fill=RED_PALE, size=20, name="P014 boundary strip")
    v2_field(slide,
             "`WSL`（Windows 的 Linux 執行層）｜來源：主機平台｜作用：提供獨立 Linux 命令殼\n"
             "單位：環境類別｜判讀：WSL 擁有自己的 `.venv`，不與 Windows 互換",
             line=TEAL, name="P014 uv field")
    slide.notes_slide.notes_text_frame.text = (
        "uv 是 interpreter recovery tool。Windows 可先安裝 uv，再執行 uv --version、uv python install 3.11 與 uv python find 3.11；Linux、macOS 與 WSL 也使用同一組 uv 命令。"
        "uv 的作用是取得並定位 Python 3.11，單位是 tool 或 executable path；find 回傳的 path 交給後面的 setup。"
        "uv 不建立 package-local .venv、不寫入 READY receipt，也不產生 case result。若 POSIX／WSL 尚未有 uv，先依官方 installer 完成安裝並重新開 shell；不要把 Windows 的 venv 帶進 WSL。"
    )


def slide_p015_v2(prs, source_slice):
    slide = prepare_slide(prs, v2_title(source_slice, "P015", "P015｜每個封裝都要有自己的虛擬環境"))
    v2_lead(slide, "把版本、依賴與策略關在同一個目錄；不共用別的專案", "P015 lead")
    v2_card(slide, 0.92, 1.70, 3.55, 2.30,
            "課程根目錄",
            "lora-energy-lab/\n`.venv` 必須留在此",
            BLUE_PALE, BLUE, "P015 root card")
    add_chevron(slide, 4.66, 2.78, 0.46, 0.54, BLUE)
    v2_card(slide, 5.28, 1.70, 3.55, 2.30,
            "Windows 路徑",
            "`.venv\\Scripts\\python.exe`\n顯示 Python 3.11.x",
            TEAL_PALE, TEAL, "P015 Windows path card", heading_size=22, body_size=20)
    add_chevron(slide, 9.02, 2.78, 0.46, 0.54, TEAL)
    v2_card(slide, 9.64, 1.70, 2.68, 2.30,
            "Linux 路徑",
            "`.venv/bin/python`\n版本 3.11.x",
            GOLD_PALE, GOLD, "P015 POSIX path card", heading_size=21, body_size=20)
    v2_strip(slide, "完成判斷：兩個路徑都顯示 3.11.x；不互換，也不共用別的專案", y=4.34, h=0.60, line=RED, fill=RED_PALE, size=20, name="P015 isolation strip")
    v2_field(slide,
             "`.venv`（套件本地虛擬環境）｜來源：Python `venv` 模組｜作用：隔離版本、依賴、策略與啟動器\n"
             "單位：目錄｜判讀：啟動器只使用目前封裝內的版本",
             line=BLUE, name="P015 venv field")
    slide.notes_slide.notes_text_frame.text = (
        "每個 package 都要有自己的 .venv，目錄位於 lora-energy-lab/ package root 內。`.venv` 的來源是 Python venv module，作用是隔離 lock、policy、scenario 與 runner，單位是 directory。"
        "Windows 使用 .venv\\Scripts\\python.exe；POSIX、Linux、macOS 與 WSL 使用 .venv/bin/python。兩者都必須顯示 Python 3.11.x，不能互換或共用另一個專案的 venv。"
        "正常 launcher 會優先使用 package-local interpreter；若現有 .venv 的 minor version 不符，修正範圍只限目前 package root 內的 .venv，不刪除 package root。"
    )


def slide_p016_v2(prs, source_slice):
    slide = prepare_slide(prs, v2_title(source_slice, "P016", "P016｜Windows：建立環境，驗證後才進案例"))
    v2_lead(slide, "下面兩組命令會建立隔離環境並讀取驗證結果；不修改案例程式", "P016 lead")
    v2_card(slide, 0.92, 1.70, 5.45, 2.30,
            "CMD",
            "先固定 3.11\nset PYTHON_BIN=py -3.11\nsetup.cmd → course.cmd verify",
            BLUE_PALE, BLUE, "P016 CMD card", heading_size=23, body_size=18.5)
    v2_card(slide, 6.86, 1.70, 5.45, 2.30,
            "PowerShell",
            "先固定 3.11\n$env:PYTHON_BIN = \"py -3.11\"\n.\\setup.cmd → .\\course.cmd verify",
            TEAL_PALE, TEAL, "P016 PowerShell card", heading_size=23, body_size=18)
    v2_strip(slide, "完成判斷：狀態為 READY，並寫入驗證收據；這不是案例結果", y=4.34, h=0.60, line=GOLD, fill=GOLD_PALE, size=20, name="P016 READY strip")
    v2_field(slide,
             "`READY`（環境就緒狀態）｜來源：驗證收據｜作用：表示版本、依賴、情境與策略介面通過\n"
             "單位：狀態值｜判讀：READY 才能進案例，仍不代表案例已執行",
             line=GOLD, name="P016 READY field")
    slide.notes_slide.notes_text_frame.text = (
        "Windows package root 內，CMD 使用 set PYTHON_BIN=py -3.11、setup.cmd 與 course.cmd verify；PowerShell 使用環境變數、.\\setup.cmd 與 .\\course.cmd verify。"
        "setup 建立 package-local .venv 並依 lock 安裝，verify 重新核對 Python、lock、scenario、policy API 與 claim boundary。READY 的來源是 course.cmd verify 與 verify receipt，作用是表示這些環境與契約 gate 通過，單位是 enum。"
        "預期輸出包含 status: READY、python_version: 3.11.x，並寫入 artifacts\\verify-receipt.json。READY 只允許進入 case，不代表 case 已經執行，也不等同 service_pass 或 energy result。"
    )


def slide_p017_v2(prs, source_slice):
    slide = prepare_slide(prs, v2_title(source_slice, "P017", "P017｜WSL：先進入 Ubuntu，再用 Linux 命令"))
    v2_lead(slide, "先確認命令殼身分；看到 Linux 路徑後才執行 `.sh`", "P017 lead")
    steps = [
        (0.92, "先看清單", "清單確認\n`wsl -l -v`", BLUE_PALE, BLUE),
        (3.94, "進入 Ubuntu", "`wsl -d Ubuntu`\n進入 Linux", GOLD_PALE, GOLD),
        (6.96, "確認路徑", "`pwd`／`uname`\n看到 Linux path", TEAL_PALE, TEAL),
        (9.98, "後續路徑", "`.sh`／`apt`\n不使用 `.cmd`", PURPLE_PALE, PURPLE),
    ]
    for idx, (x, heading, body, fill, line) in enumerate(steps):
        v2_card(slide, x, 1.70, 2.38, 2.30, heading, body, fill, line, f"P017 step {idx + 1}", heading_size=20, body_size=19)
        if idx < len(steps) - 1:
            add_chevron(slide, x + 2.48, 2.78, 0.35, 0.46, line)
    v2_strip(slide, "完成判斷：看到 Linux 路徑後才用 `.sh`；不要重複安裝，也不執行 Windows 命令", y=4.34, h=0.60, line=RED, fill=RED_PALE, size=19.5, name="P017 shell strip")
    v2_field(slide,
             "`Ubuntu`（Linux 發行版）｜來源：WSL 執行層｜作用：提供獨立 Linux 命令殼與檔案系統\n"
             "單位：發行版名稱｜判讀：看到 Linux `pwd` 後才使用 `setup.sh`／`course.sh`",
             line=TEAL, name="P017 Ubuntu field")
    slide.notes_slide.notes_text_frame.text = (
        "WSL 不是 Windows shell 的別名，而是另一個 Linux environment。先在 PowerShell 用 wsl -l -v 確認 Ubuntu；只有 distribution 不存在時才使用 wsl --install -d Ubuntu。"
        "接著用 wsl -d Ubuntu 進入 Linux shell，以 pwd 確認 Linux home path，以 uname -a 確認 Linux identity。Ubuntu 是 Linux 發行版，來源是 WSL distribution，作用是提供獨立 Linux shell 與 filesystem，單位是 distribution name。"
        "看到 Linux path 後，後續才使用 setup.sh、course.sh、apt 與 .venv/bin/python；Windows 的 .cmd 與 .venv\\Scripts\\python.exe 留在另一條路徑。"
    )


def slide_p018_v2(prs, source_slice):
    slide = prepare_slide(prs, v2_title(source_slice, "P018", "P018｜在 Ubuntu 依序備妥工具與 Python"))
    v2_lead(slide, "先準備解壓工具，再取得 Python 3.11；尚未解壓封裝", "P018 lead")
    steps = [
        (0.92, "更新清單", "`sudo apt update`\n只更新套件清單", BLUE_PALE, BLUE),
        (3.94, "準備解壓工具", "取得傳輸與解壓\n不進案例", GOLD_PALE, GOLD),
        (6.96, "安裝版本工具", "安裝 `uv`\n再開新命令殼", TEAL_PALE, TEAL),
        (9.98, "確認 Python", "`find 3.11`\n回傳版本路徑", PURPLE_PALE, PURPLE),
    ]
    for idx, (x, heading, body, fill, line) in enumerate(steps):
        v2_card(slide, x, 1.70, 2.38, 2.30, heading, body, fill, line, f"P018 step {idx + 1}", heading_size=21, body_size=18.5)
        if idx < len(steps) - 1:
            add_chevron(slide, x + 2.48, 2.78, 0.35, 0.46, line)
    v2_strip(slide, "完成判斷：工具可用、找到 3.11 路徑；尚未建立環境與就緒收據", y=4.34, h=0.60, line=GOLD, fill=GOLD_PALE, size=20, name="P018 boundary strip")
    v2_field(slide,
             "`uv`（版本工具）｜來源：Ubuntu 命令殼｜作用：取得 Python 3.11 路徑\n"
             "單位：工具／路徑｜判讀：找到路徑後才進入環境建立，不當成案例結果",
             line=BLUE, name="P018 toolchain field")
    slide.notes_slide.notes_text_frame.text = (
        "在已確認的 Ubuntu shell，先執行 sudo apt update，再執行 sudo apt install -y curl unzip。curl 是命令列傳輸工具，unzip 是封裝解壓工具；兩者先把 release extraction 與 installer 的前置條件準備好。"
        "接著依官方 installer 安裝 uv，重新開一個 Ubuntu shell，執行 uv --version、uv python install 3.11 與 uv python find 3.11。toolchain 是工具鏈，來源是 Ubuntu shell，作用是依序建立 extraction 與 runtime prerequisites，單位是 ordered command set。"
        "預期 uv --version 有版本字串，find 回傳 Python 3.11 interpreter path。這些命令只準備工具，尚未解壓 release、建立 package-local .venv 或寫入 READY receipt。"
    )


BUILDERS = [slide_p009_v2, slide_p010_v2, slide_p011_v2, slide_p012_v2, slide_p013_v2, slide_p014_v2, slide_p015_v2, slide_p016_v2, slide_p017_v2, slide_p018_v2]


def emit_source_slice(source_slice: list[dict]) -> None:
    payload = {
        "source": str(SOURCE),
        "template": str(TEMPLATE),
        "shell": "source slide 2 / slideLayout2.xml only",
        "owned_pages": SLIDE_IDS,
        "slides": source_slice,
    }
    SOURCE_SLICE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _relationship_targets(archive: zipfile.ZipFile, part_name: str) -> list[tuple[str, str]]:
    rel_name = posixpath.join(posixpath.dirname(part_name), "_rels", posixpath.basename(part_name) + ".rels")
    if rel_name not in archive.namelist():
        return []
    root = ET.fromstring(archive.read(rel_name))
    return [(rel.get("Type", ""), rel.get("Target", "")) for rel in root.findall(f"{{{PKG_REL_NS}}}Relationship")]


def _resolve_target(part_name: str, target: str) -> str:
    if target.startswith("/"):
        return target.lstrip("/")
    return posixpath.normpath(posixpath.join(posixpath.dirname(part_name), target))


def package_qa(path: Path) -> dict:
    forbidden = ["學生", "老師", "講師", "分鐘", "SHA", "checksum", "ZIP test", "production notes", "製作備註"]
    text_nodes: list[str] = []
    layout_targets: list[str] = []
    slide_backgrounds: list[bool] = []
    creation_ids: list[str] = []
    font_sizes: list[float] = []
    relationship_errors: list[str] = []
    malformed_xml: list[str] = []
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        xml_names = sorted(name for name in names if name.endswith(".xml"))
        for name in xml_names:
            try:
                root = ET.fromstring(archive.read(name))
            except ET.ParseError as exc:
                malformed_xml.append(f"{name}: {exc}")
                continue
            for node in root.iter():
                local = node.tag.rsplit("}", 1)[-1]
                if local == "t" and node.text:
                    text_nodes.append(node.text)
                # Typography floor is an authored-slide check.  Inherited
                # template/master placeholders intentionally contain smaller
                # footer/number text and are not learner-facing body content.
                if name.startswith("ppt/slides/slide") and local in {"rPr", "defRPr", "endParaRPr"} and node.get("sz"):
                    font_sizes.append(int(node.get("sz")) / 100)
                if local == "creationId":
                    creation_ids.append(node.get("id") or node.get("val") or "")
        slide_names = sorted(
            (name for name in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)),
            key=lambda value: int(re.search(r"(\d+)", value).group(1)),
        )
        notes_names = sorted(
            (name for name in names if re.fullmatch(r"ppt/notesSlides/notesSlide\d+\.xml", name)),
            key=lambda value: int(re.search(r"(\d+)", value).group(1)),
        )
        for slide_name in slide_names:
            root = ET.fromstring(archive.read(slide_name))
            slide_backgrounds.append(root.find(f"./{{{P_NS}}}cSld/{{{P_NS}}}bg") is not None)
            rels = _relationship_targets(archive, slide_name)
            targets = [target for kind, target in rels if kind.endswith(REL_TYPE_SLIDE_LAYOUT)]
            layout_targets.extend(targets)
            for kind, target in rels:
                if target and not target.startswith("http") and _resolve_target(slide_name, target) not in names:
                    relationship_errors.append(f"{slide_name} -> {target}")
        for notes_name in notes_names:
            for kind, target in _relationship_targets(archive, notes_name):
                if target and not target.startswith("http") and _resolve_target(notes_name, target) not in names:
                    relationship_errors.append(f"{notes_name} -> {target}")
        for part_name in ("ppt/presentation.xml", "ppt/slideMasters/slideMaster1.xml", "ppt/slideLayouts/slideLayout2.xml"):
            for kind, target in _relationship_targets(archive, part_name):
                if target and not target.startswith("http") and _resolve_target(part_name, target) not in names:
                    relationship_errors.append(f"{part_name} -> {target}")
    joined = "".join(text_nodes)
    forbidden_hits = [term for term in forbidden if term in joined]
    if "你" in joined:
        forbidden_hits.append("你")
    report = {
        "output": str(path),
        "template": str(TEMPLATE),
        "template_sha256": "3a90b0106c6587d720b5a46c653a31937ccd649b30890563c70a53c4cc5d25b8",
        "slide_count": len(slide_names),
        "expected_slide_count": 10,
        "notes_count": len(notes_names),
        "expected_notes_count": 10,
        "layout_targets": sorted(set(layout_targets)),
        "all_layout2": bool(layout_targets) and all(target.endswith("slideLayout2.xml") for target in layout_targets),
        "slide_background_count": sum(slide_backgrounds),
        "creation_id_count": len(creation_ids),
        "creation_ids_unique": len(creation_ids) == len(set(creation_ids)),
        "minimum_authored_font_pt": min(font_sizes) if font_sizes else None,
        "forbidden_hits": forbidden_hits,
        "malformed_xml": malformed_xml,
        "relationship_errors": relationship_errors,
        "rendering": "DEFERRED: no LibreOffice or installed PPTX renderer discovered on server",
        "microsoft_powerpoint_reopen": "DEFERRED: controller environment required",
    }
    report["status"] = "PASS" if (
        report["slide_count"] == report["expected_slide_count"]
        and report["notes_count"] == report["expected_notes_count"]
        and report["all_layout2"]
        and report["slide_background_count"] == 0
        and report["creation_ids_unique"]
        and not report["forbidden_hits"]
        and not report["malformed_xml"]
        and not report["relationship_errors"]
        and (report["minimum_authored_font_pt"] or 0) >= 16
    ) else "FAIL"
    return report


def build() -> None:
    if not TEMPLATE.exists():
        raise FileNotFoundError(TEMPLATE)
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)
    source_slice = load_source_slice()
    emit_source_slice(source_slice)
    prs = Presentation(str(TEMPLATE))
    remove_all_slides(prs)
    for builder in BUILDERS:
        builder(prs, source_slice)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(OUTPUT))
    overlay_template_parts(OUTPUT)
    report = package_qa(OUTPUT)
    QA_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    QA_OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if report["status"] != "PASS":
        raise RuntimeError(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    build()
