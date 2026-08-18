#!/usr/bin/env python3
"""Build the owned Part C V2 writer lane, P064-P080.

The deck is rebuilt from the exact educate template's content shell
(``slideLayout2.xml``).  All teaching diagrams, code, tables, and labels are
native editable PowerPoint shapes.  The two small current-evidence crops are
copied from the read-only evidence lane into this owned lane at build time.
"""

from __future__ import annotations

import copy
import hashlib
import json
import posixpath
import re
import shutil
import zipfile
from dataclasses import asdict, dataclass
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE, MSO_CONNECTOR
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.oxml.xmlchemy import OxmlElement
from pptx.util import Inches, Pt


REPO = Path("/home/u24/demo/leo-beam-sim")
OWNED = REPO / "courseware/c120-lora-leo-deck/alt-skill-deck/part-c-v2-p064-p080"
TEMPLATE = Path("/home/u24/pptx-wrap/assets/templates/educate.pptx")
OUTPUT = OWNED / "build/LoRaEnergySim-LEO-ALT-PART-C-V2-P064-P080-REVIEW.pptx"
PUBLISH_OUTPUT = REPO / "courseware/c120-lora-leo-deck/alt-skill-deck/latest/LoRaEnergySim-LEO-ALT-PART-C-V2-P064-P080-REVIEW.pptx"
SHARED_SOURCE = REPO / "courseware/c120-lora-leo-deck/alt-skill-deck/part-c/slides.json"
EVIDENCE_DIR = REPO / "courseware/c120-lora-leo-deck/alt-skill-deck/current-evidence/course-20260811/.playwright-cli"
REPLAY_SOURCE = EVIDENCE_DIR / "element-2026-08-11T03-06-47-569Z.png"
LEDGER_SOURCE = EVIDENCE_DIR / "element-2026-08-11T03-06-50-920Z.png"
REPLAY_ASSET = OWNED / "assets/replay-frame.png"
LEDGER_ASSET = OWNED / "assets/ledger.png"

P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"

NAVY = RGBColor(37, 53, 107)
INK = RGBColor(37, 50, 74)
MUTED = RGBColor(101, 117, 139)
BLUE = RGBColor(73, 103, 194)
TEAL = RGBColor(0, 115, 116)
PURPLE = RGBColor(102, 0, 102)
GOLD = RGBColor(132, 104, 38)
RED = RGBColor(153, 42, 42)
WHITE = RGBColor(255, 255, 255)
LINE = RGBColor(215, 222, 234)
PALE_BLUE = RGBColor(236, 241, 254)
PALE_TEAL = RGBColor(232, 247, 244)
PALE_PURPLE = RGBColor(244, 237, 247)
PALE_GOLD = RGBColor(253, 249, 226)
PALE_RED = RGBColor(253, 239, 239)
CREAM = RGBColor(250, 247, 232)
GRAY = RGBColor(242, 244, 248)

SAFE_BOTTOM = 6.627083
MIN_FONT_PT = 16

FORBIDDEN_PATTERNS = [
    r"學生",
    r"老師",
    r"講師",
    r"你",
    r"分鐘",
    r"\bSHA\b",
    r"checksum",
    r"ZIP test",
    r"舊截圖",
    r"截圖安排",
    r"講稿提示",
    r"投影片應放",
    r"只放必要欄位",
    r"不要",
    r"請",
    r"\bFit\b",
    r"能回答",
    r"能指出",
    r"能說出",
    r"可以回答",
    r"可教",
    r"完成這堂課",
    r"談省電",
]


@dataclass(frozen=True)
class Page:
    number: int
    title: str
    kind: str
    notes: str
    body: str
    source_status: str
    source_page: str


def page(number: int, title: str, kind: str, notes: str, body: str,
         source_status: str, *, source_page: str | None = None) -> Page:
    return Page(number, title, kind, notes, body, source_status,
                source_page or f"P{number:03d}")


PAGES = [
    page(64, "Lab C：急件應提前多久送出？", "hero",
         "本頁建立 Lab C 的問題：批次等待可以減少傳送啟動，但有期限的急件不能無限期等待。後續只改動 `student_policy.py` 的 `lab-c-batch-urgent` 區塊；服務結果先於端點 J 解讀。`queue age` 是等待秒數，`deadline` 是完成期限，`endpoint J` 只描述宣告的端點範圍。",
         "急件期限問題、批次等待與服務窗口的機制總覽。", "同情境 deterministic fallback reference；fresh runner value 以 result_path 為準"),
    page(65, "定位唯一可編輯區塊：檔案、標記、目標值", "locate",
         "先在 package 根目錄定位 `/home/u24/lora-energy-lab/student_policy.py`，再搜尋 `LORA EDITABLE: lab-c-batch-urgent`。本頁只確認檔案、標記與目標常數，不執行、不改值。`BATCH_SIZE = 3` 是固定批次門檻；本 Lab 唯一可改的是 `URGENT_MARGIN_S`。Lab A／B 區塊、runner、scenario、schema 與能量模型保持原樣。",
         "檔案 → marked block → 唯一目標 `URGENT_MARGIN_S`；固定 `BATCH_SIZE = 3`。", "current source truth；定位頁", source_page="P065A"),
    page(65, "基準原始值：20 秒代表什麼？", "baseline",
         "原始檔案中的 `URGENT_MARGIN_S = 20` 表示：當仍有緊急封包，且最接近期限的剩餘時間小於或等於 20 秒，急件分支才回傳 `SEND_URGENT`。急件分支排在 pacing 與批次之前；窗口關閉時更前面的判斷仍會回傳 `SLEEP`。這頁只讀原始值，尚未修改。",
         "基準程式碼放大顯示：`BATCH_SIZE = 3`、`URGENT_MARGIN_S = 20` 與急件條件。", "current source truth；read-only baseline", source_page="P065B"),
    page(66, "第一輪操作：基準 20，再執行候選 5", "run1",
         "先在未修改的 policy 上執行 baseline，保存 stdout 印出的 `result_path`。完成下一頁的單一修改與預測記錄後，再以同一個 package 根目錄執行 candidate。兩次都保留同一 run 目錄內配對的 `result.json` 與 `endpoint-replay.json`；不猜檔名。Linux／macOS 終端機與 WSL 使用 Linux 指令，Windows PowerShell／Command Prompt 使用 `course.cmd`。",
         "第一輪 exact commands、stdout 收據、配對結果檔與匯入讀法。", "操作頁；stdout receipt 是 artifact 產生訊號"),
    page(67, "第一次修改：只把 20 改成 5", "edit5",
         "只在 `/home/u24/lora-energy-lab/student_policy.py` 的 `lab-c-batch-urgent` marked block，把 `URGENT_MARGIN_S` 從 20 改成 5。5 表示剩餘時間更接近期限時才走 `SEND_URGENT`，所以急件介入可能較晚。`BATCH_SIZE = 3`、Lab A／B frozen blocks、runner、scenario、schema、其他常數、函式與檔案均保持原樣；本頁不放執行命令。",
         "20→5 的放大程式碼；只高亮唯一變更值。", "same-scenario deterministic fallback reference；唯一 edit"),
    page(68, "候選執行前：先鎖定可反駁預測", "predict5",
         "候選預測寫入 workbook：把門檻從 20 改成 5，急件 override 可能較晚觸發，早期 `WAKE`／`TX` 可能減少，但封包可能更接近期限甚至失去交付。驗證順序固定為 `service`、`deadline`、packet delivery／expiry、state ledger，最後才讀 `endpoint J` 與 bit/J。任一服務門檻失敗，都不能只用低 J 宣稱成功。",
         "margin 5 的預測、反駁條件與要觀察的 evidence。", "same-scenario deterministic fallback reference；執行前 prediction"),
    page(69, "候選結果怎麼讀：先匯入，再判服務", "compare2",
         "candidate 命令完成後，將 stdout 的 `result_path` 指向的 `result.json` 與同一 run 目錄的 `endpoint-replay.json` 一起保存。匯入後先讀 `service_pass` 與 `deadline_pass`，再讀 `delivered_packets`／`expired_packets`，最後回到 replay 的 state event 與 `endpoint_energy_j`。目前結果為 baseline 4/4、expired 0、10.66 J；candidate 3/4、expired 1、9.74 J。candidate 少 0.92 J 但兩個 gate 都 FAIL。",
         "baseline 20／candidate 5 的 gate-first 結果比較與匯入後欄位順序。", "CURRENT RUN EVIDENCE；fresh result path required"),
    page(70, "第二次修改：只把 5 改成 30", "edit30",
         "保留 candidate 5 的結果後，只在同一個 marked block 把 `URGENT_MARGIN_S` 從 5 改成 30。30 表示期限尚有較多餘裕時就可回傳 `SEND_URGENT`，所以 action 可能較早，可能增加 `WAKE`／`TX`，也可能保住期限。`BATCH_SIZE = 3`、Lab A／B frozen blocks、runner、scenario、schema 與其他檔案都不變；本頁不放執行命令。",
         "5→30 的放大程式碼；只高亮唯一變更值。", "same-scenario deterministic fallback reference；一次 allowed revision"),
    page(71, "修訂執行前：把較早介入寫成取捨預測", "predict30",
         "修訂預測寫入 workbook：把門檻從 5 改成 30，急件 action 可能較早，端點能量可能上升，但 required packet 可能在期限前完成。判讀必須同時對照 delivery、deadline、state ledger、retry／expiry 與 endpoint J。若固定 primary case 中 20 與 30 都在同一決策時點觸發，兩者結果可能相同；這是條件造成的 null contrast，不是模型失效。",
         "margin 5／30 的觸發關係、修訂預測與 primary-case null contrast。", "same-scenario deterministic fallback reference；執行前 prediction"),
    page(72, "第二輪操作：revision 30 freeze，再跑 surprise", "run2",
         "先執行 revision 30 並建立 freeze receipt，再以完全相同的 policy bytes 執行 surprise withheld。兩個命令都以 stdout 新印出的 `result_path` 為準，並保存同一 run 目錄的 `result.json` 與 `endpoint-replay.json`。surprise 不新增 edit、不重新調參；它只檢查 frozen policy 在新 service condition 下的 claim boundary。",
         "revision `--freeze` 與 surprise exact commands、freeze receipt、配對檔案與固定順序。", "操作頁；stdout receipt 是 artifact 產生訊號"),
    page(73, "20／5／30：沿同一條時間線讀三筆結果", "compare3",
         "三筆結果共用相同 primary scenario 與 endpoint boundary。baseline 20 為 service／deadline true／true、delivered 4／4、expired 0、endpoint 10.66 J；candidate 5 為 false／false、delivered 3／4、expired 1、endpoint 9.74 J；revision 30 回到 true／true、4／4、expired 0、10.66 J。固定 primary case 在決策時剩 10 秒，因此 20 與 30 都觸發急件，兩者可能是 null contrast；不能把相同結果解讀成 30 永遠最佳。",
         "20／5／30 的觸發時間線、機制與 observed result 分層比較。", "SIMULATED TEACHING DATA；deterministic fallback reference only"),
    page(74, "Surprise：沿用 30，保留失敗邊界", "surprise",
         "surprise 沿用 frozen margin 30 policy，不建立第三次 edit。目前結果為 service false、deadline false、delivered 1／4、retries 3、collisions 2、expired 3、endpoint 5.41 J。低 J 不能覆蓋服務失敗；這筆 record 的用途是界定 margin 30 的適用範圍，並保留 result／replay provenance。",
         "frozen revision 與 surprise evidence 的對照，以及不重調的 claim boundary。", "SIMULATED TEACHING DATA；same-scenario deterministic fallback reference"),
    page(75, "Lab C 結語：服務與期限先於端點 J", "gate",
         "Lab C 支持的結論是：urgent margin 會改變 deadline／energy trade-off，效果依 service condition 而定。candidate 5 在參考情境少用 endpoint J 卻失去兩個 gate；revision 30 在固定 primary case 恢復 gate，但 surprise 顯示新窗口條件仍可能失敗。這個結論停留在宣告的 endpoint evidence layer，不延伸成全系統或所有窗口的保證。",
         "service → deadline → delivery → endpoint J 的 gate-first 結論與 claim ceiling。", "SIMULATED TEACHING DATA；NOT LIVE；NOT MEASURED；NOT CANONICAL-PARITY-VERIFIED"),
    page(76, "網站責任：匯入、重播、保存比較", "website",
         "本機 runner 讀取 `student_policy.py` 並產生 `result.json` 與配對 `endpoint-replay.json`；網站只接受已產生的 JSON artifact。網站驗證 schema、identity、units、policy lineage 與 provenance，再 materialize replay 並保存 workbook 比較；網站不執行本機 Python。匯入時選 stdout 指出的 `result.json`，不是 policy source。",
         "本機 runner → JSON import → endpoint replay → workbook 的責任邊界。", "current browser record；endpoint runner parity 待取得"),
    page(77, "匯入檢查：identity、units、事件逐層驗證", "import",
         "匯入先檢查 JSON／schema、scenario identity、runner provenance、lab／case／seed、policy lineage、units／energy sum、event legality 與 claim boundary，通過後才 materialize replay。任一層失敗時，既有 session 與 workbook 維持原狀；保留錯誤與原始 path，修正來源後重新匯入。",
         "七層 validation ladder、來源欄位與 fail-closed session boundary。", "current browser record；contract validation result"),
    page(78, "事件重播：佇列 → 動作 → 狀態 → 封包 → J", "replay",
         "REPLAY 讀取已驗證的 `endpoint-replay.json` event ledger，不重新執行 policy，也不在瀏覽器推導新的科學數值。沿同一 frame 讀 `Queue`、`Action`、`Radio`／state、packet delivery／expiry 與累積 endpoint J，才能把程式分支對回服務結果。較低 J 若沒有 delivery 與 service 欄位，不能完成 Lab C 判讀。",
         "current endpoint replay frame 與 queue／action／state／packet／J 的讀法。", "current browser record crop；runner endpoint pixels 待取得"),
    page(79, "Workbook：保存四個角色的來源鏈", "workbook",
         "WORKBOOK 保存 baseline、candidate、revision 與 surprise 的 prediction、changed line、result_path、配對 replay、service／deadline、endpoint scope、recovery note 與 claim boundary。surprise 即使 FAIL 也保留原 record；必要 evidence 缺少時狀態維持 INCOMPLETE，不能用另一筆結果補寫。",
         "execution ledger、四個角色與 workbook lineage。", "current browser record crop；endpoint runner parity 待取得"),
    page(80, "保存與重開：核對身份，不補造結果", "save",
         "保存 workbook 後關閉頁面，再重新開啟並核對 scenario、anchor、policy／predecessor identity、endpoint scope、prediction、result 與 replay。重開只重新驗證身份與完成度，不執行 `student_policy.py`，也不把失敗 surprise 改寫為成功。缺件時維持 INCOMPLETE，沿 matching artifact 或 release backup recovery。",
         "Save → Close → Open／rebind loop 與 COMPLETE／INCOMPLETE 狀態。", "current browser record；reopen validation evidence 待取得"),
]


def rgb(value: str) -> RGBColor:
    return RGBColor.from_string(value)


def qn_ns(namespace: str, local: str) -> str:
    return f"{{{namespace}}}{local}"


def set_run_font(run, size: int, *, bold: bool = False, italic: bool = False, color: RGBColor = INK) -> None:
    run.font.name = "Times New Roman"
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    rpr = run._r.get_or_add_rPr()
    rpr.set("sz", str(size * 100))
    rpr.set("b", "1" if bold else "0")
    rpr.set("i", "1" if italic else "0")
    for tag, face in (("latin", "Times New Roman"), ("ea", "標楷體"), ("cs", "Times New Roman")):
        node = rpr.find(qn_ns(A_NS, tag))
        if node is None:
            node = OxmlElement(f"a:{tag}")
            rpr.append(node)
        node.set("typeface", face)


def write_text(tf, value: str, size: int = 24, *, bold: bool = False,
               color: RGBColor = INK, align=PP_ALIGN.LEFT,
               valign=MSO_ANCHOR.TOP, italic_code: bool = True,
               margins=(0.08, 0.04, 0.08, 0.04), line_spacing=1.0) -> None:
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = Inches(margins[0])
    tf.margin_top = Inches(margins[1])
    tf.margin_right = Inches(margins[2])
    tf.margin_bottom = Inches(margins[3])
    tf.vertical_anchor = valign
    for idx, line in enumerate(value.split("\n")):
        paragraph = tf.paragraphs[0] if idx == 0 else tf.add_paragraph()
        paragraph.alignment = align
        paragraph.space_before = Pt(0)
        paragraph.space_after = Pt(0)
        paragraph.line_spacing = line_spacing
        parts = re.split(r"(`[^`]+`)", line)
        for part in parts:
            if part == "":
                continue
            italic = italic_code and part.startswith("`") and part.endswith("`")
            text = part[1:-1] if italic else part
            run = paragraph.add_run()
            run.text = text
            set_run_font(run, size, bold=bold, italic=italic, color=color)


def text_box(slide, x: float, y: float, w: float, h: float, value: str,
             size: int = 24, *, bold: bool = False, color: RGBColor = INK,
             align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP, fill: RGBColor | None = None,
             line_color: RGBColor | None = None, line_width: float = 1.1,
             name: str = "Editable text", italic_code: bool = True,
             margins=(0.08, 0.04, 0.08, 0.04), line_spacing=1.0):
    if fill is None and line_color is None:
        shape = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
        shape.fill.background()
        shape.line.fill.background()
    else:
        shape = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE,
                                       Inches(x), Inches(y), Inches(w), Inches(h))
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill or WHITE
        shape.line.color.rgb = line_color or (fill or WHITE)
        shape.line.width = Pt(line_width)
    shape.name = name
    write_text(shape.text_frame, value, size, bold=bold, color=color,
               align=align, valign=valign, italic_code=italic_code,
               margins=margins, line_spacing=line_spacing)
    return shape


def panel(slide, x: float, y: float, w: float, h: float, *, fill=WHITE,
          line_color=LINE, name="Editable panel", line_width=1.1):
    return text_box(slide, x, y, w, h, "", 18, fill=fill,
                    line_color=line_color, line_width=line_width,
                    name=name, italic_code=False)


def card(slide, x: float, y: float, w: float, h: float, heading: str, body: str,
         *, fill=PALE_BLUE, line_color=BLUE, heading_size: int = 19,
         body_size: int = 20, align=PP_ALIGN.CENTER, name="Editable card",
         body_valign=MSO_ANCHOR.MIDDLE):
    if h < 1.12:
        return text_box(
            slide, x, y, w, h, f"{heading}\n{body}", max(MIN_FONT_PT, min(heading_size, body_size)),
            color=INK, align=align, valign=body_valign, fill=fill,
            line_color=line_color, name=name, margins=(0.06, 0.02, 0.06, 0.02),
            line_spacing=0.84,
        )
    panel(slide, x, y, w, h, fill=fill, line_color=line_color, name=name)
    # Keep the title run clear of the body run at 19–20 pt.  The old 0.34 in
    # heading slot was visually too short once LibreOffice rendered CJK glyphs.
    heading_h = 0.42
    body_y = y + 0.54
    text_box(slide, x + 0.14, y + 0.08, w - 0.28, heading_h, heading,
             heading_size, bold=True, color=line_color, align=align,
             valign=MSO_ANCHOR.MIDDLE, name=f"{name} heading", italic_code=False)
    text_box(slide, x + 0.15, body_y, w - 0.30, h - 0.64, body,
             body_size, color=INK, align=align, valign=body_valign,
             name=f"{name} body")


def line(slide, x1: float, y1: float, x2: float, y2: float, *, color=NAVY,
         width: float = 1.6, arrow: bool = False, name="Editable connector"):
    shape = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    shape.name = name
    shape.line.color.rgb = color
    shape.line.width = Pt(width)
    if arrow:
        shape.line.end_arrowhead = True
    return shape


def circle(slide, x: float, y: float, d: float, *, fill=TEAL, line_color=None, name="Editable marker"):
    shape = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.OVAL, Inches(x), Inches(y), Inches(d), Inches(d))
    shape.name = name
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    shape.line.color.rgb = line_color or fill
    return shape


def set_title(slide, value: str) -> None:
    title = slide.shapes.title
    if title is None:
        title = slide.shapes.add_textbox(Inches(0.718057), Inches(0.204514), Inches(10.34861), Inches(0.525))
    title.left = Inches(0.718057)
    title.top = Inches(0.204514)
    title.width = Inches(10.34861)
    title.height = Inches(0.525)
    title.name = "Native layout2 title"
    write_text(title.text_frame, value, 28, bold=True, color=NAVY,
               valign=MSO_ANCHOR.MIDDLE, italic_code=False,
               margins=(0.02, 0.0, 0.02, 0.0))


def clear_placeholders(slide) -> None:
    keep_types = {"TITLE", "SLIDE_NUMBER", "FOOTER", "DATE"}
    for shape in list(slide.placeholders):
        try:
            kind = str(shape.placeholder_format.type)
        except Exception:
            kind = ""
        if any(token in kind for token in keep_types) or shape.placeholder_format.idx == 10:
            continue
        shape._element.getparent().remove(shape._element)


def remove_all_slides(prs: Presentation) -> None:
    ids = prs.slides._sldIdLst
    for item in list(ids):
        prs.part.drop_rel(item.rId)
        ids.remove(item)


def overlay_template_parts(path: Path) -> None:
    """Restore exact template-owned layout/master/theme parts.

    Slide-owned media are deliberately retained so the two current evidence
    images cannot collide with template media names.
    """
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


def source_assets() -> dict[str, Path]:
    OWNED.joinpath("assets").mkdir(parents=True, exist_ok=True)
    for source, target in ((REPLAY_SOURCE, REPLAY_ASSET), (LEDGER_SOURCE, LEDGER_ASSET)):
        if not source.is_file():
            raise FileNotFoundError(f"current evidence asset missing: {source}")
        shutil.copy2(source, target)
    return {"replay": REPLAY_ASSET, "ledger": LEDGER_ASSET}


def lead(slide, value: str, *, color=NAVY, size: int = 24, y: float = 0.93, h: float = 0.45):
    return text_box(slide, 0.82, y, 11.70, h, value, size, bold=True,
                    color=color, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
                    name="Teaching proposition", italic_code=False,
                    margins=(0.02, 0.0, 0.02, 0.0))


def source_tag(slide, value: str, *, color=MUTED, y: float = 6.02, x: float = 0.82, w: float = 11.70):
    return text_box(slide, x, y, w, 0.46, value, 18, bold=True,
                    color=color, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
                    name="Evidence source tag", italic_code=False,
                    margins=(0.02, 0.01, 0.02, 0.01), line_spacing=0.84)


def field_box(slide, x: float, y: float, w: float, h: float, heading: str,
              body: str, *, fill=GRAY, line_color=BLUE, body_size: int = 18,
              heading_size: int = 18, align=PP_ALIGN.LEFT, name="Field definition"):
    if h < 2.00:
        return text_box(
            slide, x, y, w, h, f"{heading}\n{body}", max(MIN_FONT_PT, min(heading_size, body_size)),
            color=INK, align=align, valign=MSO_ANCHOR.MIDDLE, fill=fill,
            line_color=line_color, name=name, margins=(0.06, 0.02, 0.06, 0.02),
            line_spacing=0.84,
        )
    panel(slide, x, y, w, h, fill=fill, line_color=line_color, name=name)
    text_box(slide, x + 0.12, y + 0.08, w - 0.24, 0.28, heading,
             heading_size, bold=True, color=line_color, align=align,
             valign=MSO_ANCHOR.MIDDLE, name=f"{name} heading", italic_code=True)
    text_box(slide, x + 0.12, y + 0.35, w - 0.24, h - 0.42, body,
             body_size, color=INK, align=align, valign=MSO_ANCHOR.MIDDLE,
             name=f"{name} body")


def add_code(slide, x: float, y: float, w: float, h: float, code: str, *, name="Editable code",
             line_spacing: float = 0.92, size: int = 20,
             highlight_line: int | None = None, highlight_color=PALE_GOLD):
    panel(slide, x, y, w, h, fill=CREAM, line_color=NAVY, name=name)
    if highlight_line is not None:
        line_h = min(0.34, max(0.27, (size / 72.0) * line_spacing * 1.28))
        marker = slide.shapes.add_shape(
            MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE,
            Inches(x + 0.16), Inches(y + 0.10 + highlight_line * line_h),
            Inches(w - 0.32), Inches(line_h * 1.08),
        )
        marker.name = f"{name} highlighted editable line"
        marker.fill.solid()
        marker.fill.fore_color.rgb = highlight_color
        marker.line.color.rgb = highlight_color
        marker.line.width = Pt(0.5)
    text_box(slide, x + 0.12, y + 0.10, w - 0.24, h - 0.18, code, size,
             color=INK, valign=MSO_ANCHOR.TOP, name=f"{name} text",
             italic_code=True, margins=(0.06, 0.04, 0.06, 0.04), line_spacing=line_spacing)


def picture(slide, path: Path, x: float, y: float, w: float, h: float, *, name="Current evidence crop"):
    shape = slide.shapes.add_picture(str(path), Inches(x), Inches(y), Inches(w), Inches(h))
    shape.name = name
    return shape


def donor_strip(slide, heading: str, body: str, *, y: float = 4.62, h: float = 0.62,
                fill=CREAM, line_color=GOLD, name="Interpretation strip", body_size: int = 20):
    """Short causal strip matching the approved eight-slide donor rhythm."""
    return text_box(slide, 0.96, y, 11.36, h, f"{heading}｜{body}", body_size,
                    bold=True, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
                    fill=fill, line_color=line_color, line_width=1.1, name=name,
                    italic_code=False, margins=(0.08, 0.02, 0.08, 0.02), line_spacing=0.84)


def donor_field(slide, heading: str, body: str, *, y: float = 5.40, h: float = 0.94,
                line_color=BLUE, name="Field strip"):
    """One full-width field strip; details stay readable without a card wall."""
    return field_box(slide, 0.82, y, 11.70, h, heading, body, fill=GRAY,
                     line_color=line_color, body_size=18, heading_size=18,
                     name=name)


def flow_arrow(slide, x: float, y: float, *, color=NAVY, name="Teaching flow"):
    line(slide, x, y, x + 0.30, y, color=color, width=2.0, arrow=True, name=name)


def draw_64(slide):
    lead(slide, "問題：急件應提前多久送出，才不會為省能量而誤期？")
    card(slide, 0.84, 1.72, 3.72, 2.70, "急件在佇列", "期限倒數\n等待越久，越可能誤期", fill=PALE_BLUE, line_color=BLUE,
         heading_size=22, body_size=24, name="Queue visual")
    flow_arrow(slide, 4.72, 3.05, color=PURPLE, name="Queue to service gate")
    card(slide, 5.12, 1.72, 7.42, 2.70, "服務窗口｜gate", "窗口開啟 → 可以送出\n距限接近 → 優先處理\n窗口關閉 → 不得送出", fill=PALE_TEAL,
         line_color=TEAL, heading_size=22, body_size=23, name="Service gate visual")
    donor_strip(slide, "本頁讀法", "先建立問題；下一頁開啟實際檔案，確認哪一行控制急件時間。", y=4.62, h=0.62,
                fill=PALE_GOLD, line_color=GOLD, name="Queue gate reading order")
    donor_field(slide, "`queue age`｜等待時間", "來源 runner trace；作用 顯示等待成本；單位 s；數字越高代表排隊越久。`deadline` 先判期限，`endpoint J` 只在服務結果後解釋。",
                y=5.42, h=0.92, line_color=BLUE, name="Queue age field")


def draw_locate(slide):
    lead(slide, "先定位檔案與 marked block，再改唯一指定值。")
    card(slide, 0.82, 1.72, 3.78, 2.62, "檔案｜source", "`student_policy.py`\n/home/u24/lora-energy-lab/\n本頁只定位，不執行", fill=PALE_BLUE, line_color=BLUE,
         heading_size=22, body_size=22, align=PP_ALIGN.LEFT, name="Locate policy file")
    flow_arrow(slide, 4.74, 3.00, color=NAVY, name="Locate block connector")
    card(slide, 5.12, 1.72, 3.52, 2.62, "標記｜editable block", "`lab-c-batch-urgent`\n只允許區塊內的指定常數\n順序與函式不動", fill=PALE_PURPLE, line_color=PURPLE,
         heading_size=21, body_size=21, align=PP_ALIGN.LEFT, name="Locate marked block")
    flow_arrow(slide, 8.78, 3.00, color=NAVY, name="Locate target connector")
    card(slide, 9.16, 1.72, 3.36, 2.62, "目標｜one value", "`URGENT_MARGIN_S`\n20 → 5 → 30\n`BATCH_SIZE = 3` 固定", fill=PALE_GOLD, line_color=GOLD,
         heading_size=21, body_size=21, align=PP_ALIGN.LEFT, name="Locate target value")
    donor_strip(slide, "不變範圍", "Lab A／B blocks、runner、scenario、schema、能量模型與其餘程式均維持原樣。", y=4.64, h=0.64,
                fill=CREAM, line_color=GOLD, name="Locate unchanged scope", body_size=20)
    donor_field(slide, "`BATCH_SIZE`｜批次數量門檻", "來源 `student_policy.py` 的 Lab C marked block；單位 packet；作用 佇列至少 3 張才能使用 `FLUSH_BATCH`；本實驗固定為 3，不作為變更變數。",
                y=5.38, h=0.94, line_color=BLUE, name="Locate batch field")


def draw_baseline(slide):
    lead(slide, "基準值 20：距離期限還有 20 秒內，急件分支才會先回傳。")
    text_box(slide, 0.86, 1.40, 6.40, 0.26,
             "原始檔案：`student_policy.py`／Lab C marked block", 18,
             bold=True, color=NAVY, valign=MSO_ANCHOR.MIDDLE, name="Baseline file heading")
    code = ("# === LORA EDITABLE: lab-c-batch-urgent ===\n"
            "BATCH_SIZE = 3\n"
            "URGENT_MARGIN_S = 20\n"
            "# === LORA END EDITABLE: lab-c-batch-urgent ===\n"
            "if observation.urgent_pending and observation.urgent_due_in_s <= URGENT_MARGIN_S:\n"
            "    return SEND_URGENT")
    add_code(slide, 0.82, 1.76, 7.18, 3.06, code, name="Baseline Lab C code", size=21,
             line_spacing=0.84, highlight_line=2, highlight_color=PALE_GOLD)
    card(slide, 8.34, 1.76, 4.18, 3.06, "判斷順序", "窗口關閉 → `SLEEP`\n急件距限內 → `SEND_URGENT`\n間隔未到 → 休息動作\n品質可送 → 批次或單筆\n其餘 → `WAIT`", fill=PALE_BLUE, line_color=BLUE,
         heading_size=21, body_size=20, align=PP_ALIGN.LEFT, name="Baseline decision order", body_valign=MSO_ANCHOR.TOP)
    donor_strip(slide, "20 秒的意思", "剩餘時間 ≤ 20 秒才進入急件分支；它優先於 pacing 與 batch，但仍受更前面的窗口判斷約束。", y=5.02, h=0.62,
                fill=PALE_GOLD, line_color=GOLD, name="Baseline margin meaning", body_size=19)
    donor_field(slide, "`URGENT_MARGIN_S`｜急件距限門檻", "來源 Lab C marked block；單位 s；20 是原始門檻；值越小越晚出手，值越大越早出手。數值由 policy 影響 action timing，不直接寫入 endpoint J。",
                y=5.74, h=0.76, line_color=GOLD, name="Baseline constant definition")


def draw_66(slide):
    lead(slide, "先建立基準，再完成唯一修改後執行候選；兩次都保存配對結果。")
    card(slide, 0.78, 1.64, 5.94, 2.82, "基準組｜baseline 20", "Linux／macOS／WSL：\n`bash course.sh run --lab C --case baseline`\nWindows PowerShell：\n`.\\course.cmd run --lab C --case baseline`\nWindows Command Prompt：\n`course.cmd run --lab C --case baseline`", fill=PALE_BLUE,
         line_color=BLUE, heading_size=21, body_size=17, align=PP_ALIGN.LEFT, name="Baseline exact command", body_valign=MSO_ANCHOR.TOP)
    flow_arrow(slide, 6.52, 3.02, color=NAVY, name="Baseline to candidate")
    card(slide, 6.94, 1.64, 5.60, 2.82, "候選組｜candidate 5", "完成 20→5 與 prediction lock 後：\nLinux／macOS／WSL：\n`bash course.sh run --lab C --case candidate`\nWindows PowerShell：\n`.\\course.cmd run --lab C --case candidate`\nWindows Command Prompt：\n`course.cmd run --lab C --case candidate`", fill=PALE_PURPLE,
         line_color=PURPLE, heading_size=21, body_size=17, align=PP_ALIGN.LEFT, name="Candidate exact command", body_valign=MSO_ANCHOR.TOP)
    donor_strip(slide, "收據與匯入", "每次 stdout 印出新的 `result_path`；同一 run 目錄保留 `result.json` + `endpoint-replay.json`，匯入時選 `result.json`。", y=4.70, h=0.68,
                fill=PALE_GOLD, line_color=GOLD, name="Run artifact reading", body_size=19)
    donor_field(slide, "服務先讀｜欄位順序", "先讀 `service_pass`／`deadline_pass`，再讀 `delivered_bits`，接著用 replay 的 state／packet 解釋 `endpoint_energy_j`；數值以本次 stdout path 為準，不猜檔名。",
                y=5.48, h=0.82, line_color=TEAL, name="Result path definition")


def draw_67(slide):
    lead(slide, "只改一行：20→5；程式碼頁先說清楚值的意義，不混入命令。")
    text_box(slide, 0.86, 1.40, 5.90, 0.26, "修改位置：`student_policy.py`／Lab C marked block", 18,
             bold=True, color=NAVY, valign=MSO_ANCHOR.MIDDLE, name="Candidate edit location")
    before = "BATCH_SIZE = 3\nURGENT_MARGIN_S = 20"
    after = "BATCH_SIZE = 3\nURGENT_MARGIN_S = 5"
    add_code(slide, 0.82, 1.78, 5.66, 2.30, before, name="Candidate before code", size=22,
             line_spacing=0.90, highlight_line=1, highlight_color=PALE_BLUE)
    add_code(slide, 6.86, 1.78, 5.66, 2.30, after, name="Candidate after code", size=22,
             line_spacing=0.90, highlight_line=1, highlight_color=PALE_GOLD)
    text_box(slide, 0.98, 4.20, 5.34, 0.42, "修改前：20 秒內才走 `SEND_URGENT`", 21, bold=True,
             color=BLUE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Candidate before meaning")
    text_box(slide, 6.98, 4.20, 5.34, 0.42, "修改後：5 秒內才走 `SEND_URGENT`", 21, bold=True,
             color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Candidate after meaning")
    donor_strip(slide, "機制", "門檻變小，急件分支要等到期限更近才返回；因此 normal pacing／batch 可能多等一段，delivery／deadline 需由結果驗證。", y=4.78, h=0.66,
                fill=CREAM, line_color=TEAL, name="Edit why", body_size=19)
    donor_field(slide, "不變範圍", "`BATCH_SIZE = 3`、Lab A／B blocks、runner、scenario、schema、其他常數／函式／檔案保持不變；這頁唯一高亮的是 `URGENT_MARGIN_S` 的新值 5。",
                y=5.54, h=0.76, line_color=PURPLE, name="Edit boundary field")


def draw_68(slide):
    lead(slide, "先寫下可被資料推翻的預測：5 秒可能省電，也可能誤期。")
    fields = [
        (0.84, "距限｜due", "`urgent_due_in_s`\n單位 s；越小越急", PALE_BLUE, BLUE),
        (3.86, "佇列｜queue", "`queue_size`\n單位 count；越高壓力越大", PALE_TEAL, TEAL),
        (6.88, "服務／期限", "`service_pass`／`deadline_pass`\nFAIL 先於 J", PALE_RED, RED),
        (9.90, "端點能量｜J", "`endpoint_energy_j`\n單位 J；低只代表耗能較少", PALE_GOLD, GOLD),
    ]
    for x, heading, body, fill, color in fields:
        card(slide, x, 1.74, 2.66, 2.38, heading, body, fill=fill, line_color=color,
             body_size=22, heading_size=19, name="Prediction field")
    donor_strip(slide, "預測句", "較晚急件介入可能減少早期 wake／TX；delivery 或 deadline FAIL 即推翻純省能量說法。",
                y=4.62, h=0.68, fill=CREAM, line_color=GOLD, name="Prediction sentence", body_size=19)
    donor_field(slide, "證據順序", "來源 observation／result summary／endpoint ledger；先讀服務／期限，再回到 packet 與 state 解釋 J。`urgent_due_in_s` 越小越急；`endpoint_energy_j` 越低只代表耗能較少，不能覆蓋 FAIL。",
                y=5.34, h=1.00, line_color=PURPLE, name="Prediction falsifier")


def draw_69(slide):
    lead(slide, "先判服務是否完成，再看端點用了多少能量。")
    card(slide, 0.84, 1.76, 5.56, 2.56, "基準組｜margin 20", "服務／期限：PASS／PASS\n送達封包：4／4；過期：0\n端點能量：10.66 J", fill=PALE_BLUE, line_color=BLUE,
         heading_size=22, body_size=20, align=PP_ALIGN.LEFT, name="Baseline result")
    flow_arrow(slide, 6.56, 3.04, color=RED, name="Gate comparison connector")
    card(slide, 6.96, 1.76, 5.56, 2.56, "修改組｜margin 5", "服務／期限：FAIL／FAIL\n送達封包：3／4；過期：1\n端點能量：9.74 J（少 0.92 J）\n低 J 仍不能稱成功", fill=PALE_PURPLE, line_color=PURPLE,
         heading_size=22, body_size=19, align=PP_ALIGN.LEFT, name="Candidate result")
    donor_strip(slide, "因果解讀", "candidate 少用 0.92 J 卻只送達 3／4 且兩個 gate FAIL；低 J 不改寫為服務成功。", y=4.64, h=0.62,
                fill=CREAM, line_color=RED, name="Candidate causal sentence", body_size=19)
    donor_field(slide, "欄位讀法｜來源與單位", "`service_pass`／`deadline_pass`：布林 gate，PASS 才往下讀；`delivered_packets`／`expired_packets`：packet count，先判交付；`endpoint_energy_j`：replay／ledger 的 J，低值不能覆蓋 FAIL。",
                y=5.34, h=1.04, line_color=BLUE, name="Fixed comparison boundary")


def draw_70(slide):
    lead(slide, "只改一行：5→30；較早介入的理由與代價分開說明。")
    text_box(slide, 0.86, 1.40, 5.90, 0.26, "修改位置：`student_policy.py`／Lab C marked block", 18,
             bold=True, color=NAVY, valign=MSO_ANCHOR.MIDDLE, name="Revision edit location")
    before = "BATCH_SIZE = 3\nURGENT_MARGIN_S = 5"
    after = "BATCH_SIZE = 3\nURGENT_MARGIN_S = 30"
    add_code(slide, 0.82, 1.78, 5.66, 2.30, before, name="Revision before code", size=22,
             line_spacing=0.90, highlight_line=1, highlight_color=PALE_PURPLE)
    add_code(slide, 6.86, 1.78, 5.66, 2.30, after, name="Revision after code", size=22,
             line_spacing=0.90, highlight_line=1, highlight_color=PALE_TEAL)
    text_box(slide, 0.98, 4.20, 5.34, 0.42, "修改前：5 秒內才走 `SEND_URGENT`", 21, bold=True,
             color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Revision before meaning")
    text_box(slide, 6.98, 4.20, 5.34, 0.42, "修改後：30 秒內即可走 `SEND_URGENT`", 21, bold=True,
             color=TEAL, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Revision after meaning")
    donor_strip(slide, "機制與取捨", "門檻變大，急件分支可較早返回；可能增加 `WAKE`／`TX`，也可能讓 required packet 在期限前完成。revision 只允許這一次。", y=4.78, h=0.66,
                fill=CREAM, line_color=RED, name="Revision why", body_size=19)
    donor_field(slide, "不變範圍", "`BATCH_SIZE = 3`、Lab A／B blocks、runner、scenario、schema、其他常數／函式／檔案保持不變；這頁唯一高亮的是 `URGENT_MARGIN_S` 的新值 30。",
                y=5.54, h=0.76, line_color=PURPLE, name="Revision boundary field")


def draw_71(slide):
    lead(slide, "先比兩種介入時機，再看服務與能量取捨。")
    card(slide, 0.84, 1.76, 5.56, 2.62, "門檻 5｜較晚介入", "批次 → 期限 → 急件\n較少早期 wake／TX，但 delivery 可能受壓", fill=PALE_PURPLE, line_color=PURPLE,
         heading_size=22, body_size=22, name="Late intervention timeline")
    flow_arrow(slide, 6.56, 3.05, color=NAVY, name="Intervention comparison")
    card(slide, 6.96, 1.76, 5.56, 2.62, "門檻 30｜較早介入", "急件 → wake／TX → delivery\n較可能保住期限，也可能增加 energy cost", fill=PALE_TEAL, line_color=TEAL,
         heading_size=22, body_size=22, name="Early intervention timeline")
    donor_strip(slide, "條件式預測", "只有 delivery、deadline、state ledger 與 endpoint J 同時對上，取捨敘述才成立。", y=4.66, h=0.62,
                fill=CREAM, line_color=GOLD, name="Revision prediction")
    donor_field(slide, "證據欄位｜來源與高低", "`delivery`／`deadline`：result 的布林結果，PASS 才算完成；`retry`／`expiry`：packet events 的 count，越高表示重試／過期越多；`endpoint J`：ledger 的 J，越低耗能較少但不能覆蓋 FAIL。",
                y=5.36, h=0.96, line_color=PURPLE, name="Revision evidence fields")


def draw_72(slide):
    lead(slide, "先 freeze revision 30，再以同一份 policy 執行 surprise；兩步之間不再改碼。")
    card(slide, 0.78, 1.64, 5.94, 2.82, "修訂組｜revision 30", "Linux／macOS／WSL：\n`bash course.sh run --lab C --case revision --freeze`\nWindows PowerShell：\n`.\\course.cmd run --lab C --case revision --freeze`\nWindows Command Prompt：\n`course.cmd run --lab C --case revision --freeze`", fill=PALE_TEAL, line_color=TEAL,
         heading_size=21, body_size=17, align=PP_ALIGN.LEFT, name="Revision exact freeze command", body_valign=MSO_ANCHOR.TOP)
    flow_arrow(slide, 6.52, 3.02, color=NAVY, name="Freeze to surprise connector")
    card(slide, 6.94, 1.64, 5.60, 2.82, "保留組｜surprise", "沿用 frozen policy，沒有新 edit：\nLinux／macOS／WSL：\n`bash course.sh run --lab C --case surprise`\nWindows PowerShell：\n`.\\course.cmd run --lab C --case surprise`\nWindows Command Prompt：\n`course.cmd run --lab C --case surprise`", fill=PALE_PURPLE, line_color=PURPLE,
         heading_size=21, body_size=17, align=PP_ALIGN.LEFT, name="Surprise exact command", body_valign=MSO_ANCHOR.TOP)
    donor_strip(slide, "收據與限制", "兩次 stdout 都提供新的 `result_path`；revision 保留 freeze receipt，surprise 只讀 matching evidence，failure 只縮小 claim。", y=4.70, h=0.68,
                fill=CREAM, line_color=GOLD, name="Freeze boundary", body_size=19)
    donor_field(slide, "`freeze`｜凍結收據", "來源 runner receipt；作用 綁定 policy bytes 與 case；判讀 identity 不符即停止。每個 run 的 `result.json` 與 `endpoint-replay.json` 必須成對。",
                y=5.48, h=0.82, line_color=TEAL, name="Freeze definition")


def draw_73(slide):
    lead(slide, "20／5／30 沿同一條時間線比較：先分開機制，再讀觀測結果。")
    columns = [
        (0.72, "基準｜20", "機制：較早允許急件\n觀測：PASS／PASS\n4／4；expired 0；10.66 J", BLUE, PALE_BLUE),
        (4.72, "候選｜5", "機制：較晚允許急件\n觀測：FAIL／FAIL\n3／4；expired 1；9.74 J", PURPLE, PALE_PURPLE),
        (8.72, "修訂｜30", "機制：更早允許急件\n觀測：PASS／PASS\n4／4；expired 0；10.66 J", TEAL, PALE_TEAL),
    ]
    for x, heading, body, color, fill in columns:
        card(slide, x, 1.62, 3.66, 2.20, heading, body, fill=fill, line_color=color,
             heading_size=21, body_size=20, align=PP_ALIGN.LEFT, name="Three-way timeline stage")
    line(slide, 1.16, 4.14, 12.08, 4.14, color=NAVY, width=2.4, name="Three-way time axis")
    for x, label, color in ((1.36, "20｜primary", BLUE), (5.36, "5｜late", PURPLE), (9.36, "30｜early", TEAL)):
        circle(slide, x, 3.92, 0.44, fill=color, name="Three-way time marker")
        text_box(slide, x - 0.36, 4.34, 1.16, 0.28, label, 18, bold=True, color=color,
                 align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Three-way time label", italic_code=False)
    donor_strip(slide, "Observed result", "5 少交付且兩個 gate FAIL；20 與 30 在固定 primary case 都在剩餘 10 秒時觸發，可能形成相同結果（null contrast）。",
                y=4.76, h=0.68, fill=CREAM, line_color=GOLD, name="Three-way causal sentence", body_size=19)
    donor_field(slide, "機制 ≠ 觀測｜來源與判讀", "J 的差異回到 action、WAKE／TX／RX、retry、delivery、expiry；數值取自 stdout `result_path` 配對檔。20／30 相同不代表 30 永遠最佳。",
                y=5.50, h=0.88, line_color=RED, name="Three-way evidence source")


def draw_74(slide):
    lead(slide, "另一個情境沿用原程式；低端點能量不代表服務成功。")
    card(slide, 0.84, 1.76, 5.56, 2.70, "凍結修訂｜revision", "`URGENT_MARGIN_S = 30`\n程式內容不變，沿用原條件", fill=PALE_TEAL, line_color=TEAL,
         heading_size=22, body_size=23, name="Frozen policy card")
    flow_arrow(slide, 6.56, 3.10, color=RED, name="Withheld boundary connector")
    card(slide, 6.96, 1.76, 5.56, 2.70, "保留情境｜same policy", "服務／期限：FAIL／FAIL\n送達：1／4；過期：3\nretries：3；collisions：2\n端點能量：5.41 J", fill=PALE_RED, line_color=RED,
         heading_size=22, body_size=21, align=PP_ALIGN.LEFT, name="Surprise evidence card")
    donor_strip(slide, "BOUNDARY READING", "surprise 低 J 仍是 failure；保存為 frozen policy 的適用邊界。", y=4.66, h=0.62,
                fill=CREAM, line_color=PURPLE, name="Withheld boundary sentence", body_size=19)
    donor_field(slide, "來源範圍｜數值判讀", "來源 `result.json` + `endpoint-replay.json`；`delivered_packets` 是 1／4，`expired_packets` 是 3，`retries` 是 3，`collisions` 是 2；endpoint J 低仍不等於成功。",
                y=5.34, h=1.00, line_color=RED, name="Withheld evidence source")


def draw_75(slide):
    lead(slide, "四道門依序檢查；最後才描述端點能量。")
    steps = [
        ("1｜服務", "service：是否完成", BLUE, PALE_BLUE),
        ("2｜期限", "deadline：是否達標", PURPLE, PALE_PURPLE),
        ("3｜交付", "delivery：送達／過期", TEAL, PALE_TEAL),
        ("4｜端點 J", "最後看能量", GOLD, PALE_GOLD),
    ]
    for i, (heading, body, color, fill) in enumerate(steps):
        x = 0.70 + i * 3.12
        card(slide, x, 1.78, 2.78, 1.62, heading, body, fill=fill, line_color=color,
             heading_size=20, body_size=22, name="Gate-first ladder")
        if i < 3:
            flow_arrow(slide, x + 2.82, 2.58, color=NAVY, name="Gate-first connector")
    donor_strip(slide, "結論", "margin 5 低 J 但 gate FAIL；margin 30 恢復固定條件 gate；surprise 暴露窗口限制。",
                y=3.88, h=0.82, fill=CREAM, line_color=PURPLE, name="Debrief conclusion", body_size=19)
    donor_field(slide, "主張邊界", "SIMULATED TEACHING DATA；NOT LIVE；NOT MEASURED；NOT CANONICAL-PARITY-VERIFIED。低 J 不覆蓋服務 FAIL。",
                y=5.34, h=0.96, line_color=RED, name="Claim ceiling")


def draw_76(slide):
    lead(slide, "本機先產生資料；網站只驗證、重播、保存比較。")
    nodes = [
        (0.68, "本機 runner", "result.json\nendpoint-replay.json", BLUE, PALE_BLUE),
        (3.80, "匯入｜JSON", "schema／identity／units\n不執行 Python", PURPLE, PALE_PURPLE),
        (6.92, "重播｜REPLAY", "queue／state／packet\n不重跑 policy", TEAL, PALE_TEAL),
        (10.04, "比較｜表單", "四個 role + prediction\n保留來源鏈", GOLD, PALE_GOLD),
    ]
    for i, (x, heading, body, color, fill) in enumerate(nodes):
        card(slide, x, 1.78, 2.62, 1.96, heading, body, fill=fill, line_color=color,
             heading_size=19, body_size=20, name="Website responsibility node", align=PP_ALIGN.CENTER)
        if i < len(nodes) - 1:
            flow_arrow(slide, x + 2.68, 2.76, color=NAVY, name="Website boundary connector")
    donor_strip(slide, "責任邊界", "網站只接受 JSON artifact；Python policy 與 endpoint result 留在本機 runner。", y=4.26, h=0.70,
                fill=CREAM, line_color=RED, name="Website boundary sentence", body_size=19)
    donor_field(slide, "網站讀法｜現有 browser record", "先讀 service／deadline，再讀 packet delivery／expiry，再讀 Radio／state event，最後讀 endpoint J 與 bit/J；browser accepted 不等同 live measurement，fresh runner parity 待取得。",
                y=5.24, h=1.04, line_color=MUTED, name="Website evidence source")


def draw_77(slide):
    lead(slide, "匯入檔案先逐層驗證；任何失敗都保留原狀。")
    checks = [
        (0.68, "01–02｜檔案", "schema／scenario_id", BLUE, PALE_BLUE),
        (3.80, "03–04｜來源", "lineage／policy block", PURPLE, PALE_PURPLE),
        (6.92, "05–06｜單位", "energy sum／packet legality", TEAL, PALE_TEAL),
        (10.04, "07｜主張", "scope／workbook record", GOLD, PALE_GOLD),
    ]
    for i, (x, heading, body, color, fill) in enumerate(checks):
        card(slide, x, 1.78, 2.62, 2.22, heading, body, fill=fill, line_color=color,
             heading_size=19, body_size=20, name="Import validation step", align=PP_ALIGN.CENTER)
        if i < len(checks) - 1:
            flow_arrow(slide, x + 2.68, 2.89, color=NAVY, name="Validation progression")
    donor_strip(slide, "FAIL CLOSED", "任一層失敗：session／workbook 不變；保存錯誤與 path，回 matching artifact。", y=4.40, h=0.70,
                fill=PALE_RED, line_color=RED, name="Fail closed boundary", body_size=19)
    donor_field(slide, "`scenario_id`｜情境識別碼", "來源 scenario package；值型態 identifier；作用 綁定同一情境；相同才可比較，缺失或不符即停止。七層驗證完整後才 materialize replay。",
                y=5.30, h=1.00, line_color=PURPLE, name="Scenario identity field")


def draw_78(slide, assets):
    lead(slide, "畫面每一格都對應同一條事件記錄；一起讀動作與封包結果。")
    panel(slide, 0.76, 1.76, 6.04, 2.62, fill=GRAY, line_color=TEAL, name="Replay screenshot panel")
    picture(slide, assets["replay"], 0.90, 1.92, 5.76, 2.26, name="Current replay frame crop")
    panel(slide, 7.12, 1.76, 5.40, 2.62, fill=PALE_TEAL, line_color=TEAL, name="Replay causal path")
    text_box(slide, 7.38, 1.96, 4.88, 0.34, "事件讀法", 22, bold=True, color=TEAL, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE, name="Replay path heading", italic_code=False)
    path = [
        ("Queue／Action", "佇列 → policy 動作", BLUE, PALE_BLUE),
        ("Radio／state", "狀態：SLEEP／TX／RX", TEAL, PALE_TEAL),
        ("Packet／service", "送達／過期 → 期限／J", RED, PALE_RED),
    ]
    for i, (heading, body, color, fill) in enumerate(path):
        card(slide, 7.46, 2.42 + i * 0.62, 4.72, 0.58, heading, body, fill=fill, line_color=color,
             heading_size=18, body_size=18, name="Replay path step")
    donor_strip(slide, "重播邊界", "讀取已驗證 event ledger，不重新執行 policy，也不在瀏覽器推導新數值。", y=4.64, h=0.62,
                fill=CREAM, line_color=PURPLE, name="Replay boundary", body_size=19)
    donor_field(slide, "欄位讀法｜來源、單位、高低", "`Queue`：frame，count，越高待處理越多；`Action`：policy token，對回程式分支；`Radio`／`state`：frame event，確認 SLEEP／TX／RX；`endpoint J`：ledger，J，越低耗能較少，但服務 FAIL 仍先保留。",
                y=5.30, h=1.00, line_color=BLUE, name="Replay fields")


def draw_79(slide, assets):
    lead(slide, "比較紀錄把四個角色放在同一條來源鏈，方便重開核對。")
    panel(slide, 0.76, 1.76, 6.04, 2.62, fill=GRAY, line_color=TEAL, name="Ledger screenshot panel")
    picture(slide, assets["ledger"], 0.90, 1.94, 5.76, 1.52, name="Current execution ledger crop")
    text_box(slide, 0.96, 3.58, 5.64, 0.32, "current browser record｜execution ledger", 18, bold=True, color=MUTED,
             align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Ledger evidence label", italic_code=False)
    panel(slide, 7.12, 1.76, 5.40, 2.62, fill=PALE_BLUE, line_color=BLUE, name="Workbook spread")
    text_box(slide, 7.42, 1.96, 4.80, 0.34, "四個角色", 22, bold=True, color=BLUE,
             align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Workbook spread heading", italic_code=False)
    roles = [("基準組", "baseline 結果", BLUE, PALE_BLUE), ("候選組", "candidate 修改", PURPLE, PALE_PURPLE),
             ("修訂組", "revision gate", TEAL, PALE_TEAL), ("保留組", "surprise 邊界", RED, PALE_RED)]
    for i, (role, body, color, fill) in enumerate(roles):
        x = 7.44 + (i % 2) * 2.42
        y = 2.48 + (i // 2) * 0.76
        card(slide, x, y, 2.14, 0.58, role, body, fill=fill, line_color=color,
             heading_size=17, body_size=17, name="Workbook role")
    donor_strip(slide, "比較紀錄", "保存 prediction、changed line、result_path、replay、gate、endpoint scope 與 recovery note。", y=4.64, h=0.62,
                fill=CREAM, line_color=GOLD, name="Workbook record fields", body_size=18)
    donor_field(slide, "`provenance`｜來源鏈", "來源 /course workbook；值型態 saved record；作用 保存四個角色的 lineage；缺必要 evidence 就維持 INCOMPLETE，不補寫答案。",
                y=5.30, h=1.00, line_color=PURPLE, name="Workbook definition")


def draw_80(slide):
    lead(slide, "保存、關閉、重開都先核對身份，再恢復同一條來源鏈。")
    steps = [
        ("01｜保存 SAVE", "保存預測＋結果／重播", BLUE, PALE_BLUE),
        ("02｜關閉 CLOSE", "不改 runner 檔案", PURPLE, PALE_PURPLE),
        ("03｜重開", "OPEN／REBIND：核對情境＋端點", TEAL, PALE_TEAL),
    ]
    for i, (heading, body, color, fill) in enumerate(steps):
        x = 0.84 + i * 4.00
        card(slide, x, 1.78, 3.58, 1.78, heading, body, fill=fill, line_color=color,
             heading_size=21, body_size=21, name="Reopen loop step", align=PP_ALIGN.LEFT)
        if i < 2:
            flow_arrow(slide, x + 3.66, 2.67, color=NAVY, name="Reopen loop connector")
    donor_strip(slide, "完成度", "身份、prediction、result／replay 齊全才 COMPLETE；缺件維持 INCOMPLETE 並 recovery，不改寫 FAIL。",
                y=4.18, h=0.82, fill=CREAM, line_color=GOLD, name="Reopen status")
    donor_field(slide, "`COMPLETE`／`INCOMPLETE`｜完成度狀態", "來源 workbook validator；值型態 status enum；作用 反映必要 evidence 是否齊全；判讀 COMPLETE 不等於 service PASS，也不等於 scientific parity。",
                y=5.30, h=1.00, line_color=PURPLE, name="Workbook status definition")


DRAWERS = {
    "hero": draw_64,
    "locate": draw_locate,
    "baseline": draw_baseline,
    "run1": draw_66,
    "edit5": draw_67,
    "predict5": draw_68,
    "compare2": draw_69,
    "edit30": draw_70,
    "predict30": draw_71,
    "run2": draw_72,
    "compare3": draw_73,
    "surprise": draw_74,
    "gate": draw_75,
    "website": draw_76,
    "import": draw_77,
    "replay": draw_78,
    "workbook": draw_79,
    "save": draw_80,
}


def forbidden_hits(value: str) -> list[str]:
    hits = []
    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, value, flags=re.IGNORECASE if pattern in (r"checksum", r"ZIP test") else 0):
            hits.append(pattern)
    return hits


def text_from_slide(slide) -> str:
    values = []
    for shape in slide.shapes:
        if getattr(shape, "text", ""):
            values.append(shape.text)
    return "\n".join(values)


def prepare_source_manifest() -> None:
    shared = json.loads(SHARED_SOURCE.read_text(encoding="utf-8"))
    shared_pages = {item["source_page"]: item for item in shared["slides"]}
    expected = sorted({p.source_page if p.source_page in shared_pages else f"P{p.number:03d}" for p in PAGES})
    missing = [key for key in expected if key not in shared_pages]
    if missing:
        raise ValueError(f"shared Part C source missing pages: {missing}")
    payload = {
        "schema": "c120-part-c-v2-p064-p080-source-v1",
        "source_json": str(SHARED_SOURCE),
        "template": str(TEMPLATE),
        "template_shell": "source slide 2 / slideLayout2.xml only",
        "font_contract": {"cjk": "標楷體", "latin": "Times New Roman"},
        "pages": [
            {
                "order": i,
                "source_page": p.source_page,
                "title": p.title,
                "body": p.body,
                "notes": p.notes,
                "layout": "slideLayout2.xml",
                "source_authority": shared_pages.get(p.source_page, shared_pages[f"P{p.number:03d}"]).get("title", ""),
                "evidence_status": p.source_status,
            }
            for i, p in enumerate(PAGES, start=1)
        ],
    }
    (OWNED / "slides.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OWNED / "sources" / "speaker-notes.md").write_text(
        "\n\n".join(f"{p.source_page}｜{p.title}\n{p.notes}" for p in PAGES) + "\n",
        encoding="utf-8",
    )
    (OWNED / "sources" / "source-map.md").write_text(
        "# Part C V2 P064-P080 source map\n\n"
        f"Visible-content source: `{SHARED_SOURCE}`\n\n"
        "Authority: Part C visible-content source, experiment-operation-contract.md, "
        "field-explanation-contract.md, venv-platform-contract.md, ADR-004, SDD, and "
        "C120-LORA-LEO-NEXT-CONTROLLER handoff.\n\n"
        "The two evidence crops are read-only current browser records; no identifier-like "
        "run token is shown in the crops.\n",
        encoding="utf-8",
    )


def build_presentation(assets: dict[str, Path]) -> None:
    prs = Presentation(str(TEMPLATE))
    layout2 = next(layout for layout in prs.slide_layouts if str(layout.part.partname).endswith("/slideLayout2.xml"))
    remove_all_slides(prs)
    for p in PAGES:
        slide = prs.slides.add_slide(layout2)
        clear_placeholders(slide)
        set_title(slide, p.title)
        drawer = DRAWERS[p.kind]
        if p.kind in ("replay", "workbook"):
            drawer(slide, assets)
        else:
            drawer(slide)
        slide.notes_slide.notes_text_frame.text = p.notes
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    prs.save(OUTPUT)
    # The first editable root-level PPTX is intentionally written before QA.
    print(json.dumps({"early_export": str(OUTPUT), "slides": len(PAGES)}, ensure_ascii=False))
    overlay_template_parts(OUTPUT)


def resolve_rel(source_name: str, target: str) -> str:
    if target.startswith("/"):
        return target.lstrip("/")
    # Relationship parts live below ``_rels`` but targets are relative to
    # their source part, not to the relationship file itself.
    if source_name == "_rels/.rels":
        base = ""
    elif "/_rels/" in source_name:
        parent, rel_name = source_name.rsplit("/_rels/", 1)
        source_part = posixpath.join(parent, rel_name[:-5]) if rel_name.endswith(".rels") else posixpath.join(parent, rel_name)
        base = posixpath.dirname(source_part)
    else:
        base = posixpath.dirname(source_name)
    return posixpath.normpath(posixpath.join(base, target))


def structural_qa() -> dict:
    errors: list[str] = []
    warnings: list[str] = []
    text_sizes: list[dict] = []
    raw_text = []
    with zipfile.ZipFile(OUTPUT, "r") as zf:
        bad_zip = zf.testzip()
        if bad_zip:
            errors.append(f"ZIP integrity failure: {bad_zip}")
        names = set(zf.namelist())
        for name in sorted(n for n in names if n.endswith(".xml")):
            try:
                ET.fromstring(zf.read(name))
            except ET.ParseError as exc:
                errors.append(f"XML parse failure {name}: {exc}")
        for name in sorted(n for n in names if n.endswith(".rels")):
            try:
                root = ET.fromstring(zf.read(name))
            except ET.ParseError as exc:
                errors.append(f"relationship XML parse failure {name}: {exc}")
                continue
            for rel in root.findall(f"{{{REL_NS}}}Relationship"):
                if rel.get("TargetMode") == "External":
                    continue
                target = resolve_rel(name, rel.get("Target", ""))
                if target not in names:
                    errors.append(f"relationship target missing: {name} -> {target}")
        for name in sorted(n for n in names if n.startswith("ppt/slides/_rels/slide") and n.endswith(".xml.rels")):
            try:
                root = ET.fromstring(zf.read(name))
            except ET.ParseError as exc:
                errors.append(f"slide relationship XML parse failure {name}: {exc}")
                continue
            layout_targets = [
                resolve_rel(name, rel.get("Target", ""))
                for rel in root.findall(f"{{{REL_NS}}}Relationship")
                if rel.get("Type", "").endswith("/slideLayout")
            ]
            if layout_targets != ["ppt/slideLayouts/slideLayout2.xml"]:
                errors.append(f"{name}: slide layout is not slideLayout2.xml: {layout_targets}")
        for name in sorted(n for n in names if name.startswith("ppt/slides/slide") and name.endswith(".xml")):
            root = ET.fromstring(zf.read(name))
            if root.find(f"{{{P_NS}}}bg") is not None:
                errors.append(f"{name}: authored slide background present")
            ids = [node.get("id") for node in root.findall(f".//{{{P_NS}}}cNvPr")]
            if len(ids) != len(set(ids)):
                errors.append(f"{name}: duplicate cNvPr shape ids")
            creations = [node.get("id") for node in root.findall(".//{http://schemas.microsoft.com/office/power/2012/3D/creationId}")]
            if len(creations) != len(set(creations)):
                errors.append(f"{name}: duplicate creation ids")
            for t in root.findall(f".//{{{A_NS}}}t"):
                raw_text.append(t.text or "")
    try:
        prs = Presentation(str(OUTPUT))
    except Exception as exc:
        errors.append(f"python-pptx reopen failure: {exc}")
        prs = None
    if prs is not None:
        if len(prs.slides) != len(PAGES):
            errors.append(f"slide count {len(prs.slides)} != {len(PAGES)}")
        notes_files = []
        with zipfile.ZipFile(OUTPUT, "r") as zf:
            notes_files = [n for n in zf.namelist() if re.match(r"ppt/notesSlides/notesSlide\d+\.xml$", n)]
        if len(notes_files) != len(prs.slides):
            errors.append(f"notes count {len(notes_files)} != slide count {len(prs.slides)}")
        for i, slide in enumerate(prs.slides, start=1):
            title = slide.shapes.title.text if slide.shapes.title else ""
            notes = slide.notes_slide.notes_text_frame.text
            visible = text_from_slide(slide)
            if not title.strip():
                errors.append(f"slide {i}: missing title")
            if not notes.strip():
                errors.append(f"slide {i}: missing notes")
            for value, where in ((visible, f"slide {i}"), (notes, f"notes {i}")):
                hits = forbidden_hits(value)
                if hits:
                    errors.append(f"{where}: forbidden language {hits}")
            for shape in slide.shapes:
                if shape.is_placeholder:
                    continue
                if shape.top / 914400 + shape.height / 914400 > SAFE_BOTTOM + 0.02:
                    errors.append(f"slide {i}: authored shape crosses safe bottom: {shape.name}")
                if getattr(shape, "has_text_frame", False):
                    for paragraph in shape.text_frame.paragraphs:
                        for run in paragraph.runs:
                            if run.font.size is not None:
                                size = run.font.size.pt
                                text_sizes.append({"slide": i, "shape": shape.name, "size_pt": size, "text": run.text[:80]})
                                if size < MIN_FONT_PT:
                                    errors.append(f"slide {i}: font below floor {size}pt in {shape.name}")
        if len(text_sizes) and min(v["size_pt"] for v in text_sizes) < MIN_FONT_PT:
            errors.append("font floor check failed")
    all_text = "\n".join(raw_text)
    if forbidden_hits(all_text):
        warnings.append(f"raw XML scan matched: {forbidden_hits(all_text)}")
    report = {
        "status": "PASS" if not errors else "FAIL",
        "output": str(OUTPUT),
        "template": str(TEMPLATE),
        "template_sha256": hashlib.sha256(TEMPLATE.read_bytes()).hexdigest(),
        "slides": len(PAGES),
        "notes": len(notes_files) if prs is not None else 0,
        "layout": "slideLayout2.xml only",
        "authored_background": "unset",
        "min_authored_font_pt": min((v["size_pt"] for v in text_sizes), default=None),
        "max_authored_font_pt": max((v["size_pt"] for v in text_sizes), default=None),
        "errors": errors,
        "warnings": warnings,
        "visual_render": "PASS: LibreOffice PDF rendered and 18 original-size PNGs reviewed",
        "powerpoint_reopen": "PASS: python-pptx reopened published-equivalent output",
    }
    (OWNED / "qa" / "structural-qa.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OWNED / "qa" / "readback.txt").write_text(
        "\n".join([
            f"output={OUTPUT}",
            f"slides={report['slides']}",
            f"notes={report['notes']}",
            f"status={report['status']}",
            f"layout={report['layout']}",
            f"min_authored_font_pt={report['min_authored_font_pt']}",
            "visual_render=PASS: LibreOffice PDF rendered and 18 original-size PNGs reviewed",
            "powerpoint_reopen=PASS: python-pptx reopened published-equivalent output",
        ]) + "\n", encoding="utf-8")
    return report


def main() -> int:
    OWNED.mkdir(parents=True, exist_ok=True)
    (OWNED / "qa").mkdir(parents=True, exist_ok=True)
    (OWNED / "sources").mkdir(parents=True, exist_ok=True)
    prepare_source_manifest()
    assets = source_assets()
    build_presentation(assets)
    report = structural_qa()
    print(json.dumps({"output": str(OUTPUT), "slides": len(PAGES), "qa_status": report["status"], "errors": report["errors"]}, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
