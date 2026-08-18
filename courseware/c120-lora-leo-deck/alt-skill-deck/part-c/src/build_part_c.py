#!/usr/bin/env python3
"""Build the native-template direct-teaching Part C deck (P064-P097).

The deck is deliberately editable: code, controls, field maps, gates, lineage
and transfer diagrams are native PowerPoint shapes.  Browser screenshots are
used only as clearly labelled simulated teaching evidence.  The website is
never presented as a Python runner.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import tempfile
import copy
import zipfile
from dataclasses import asdict, dataclass
from pathlib import Path

from PIL import Image, ImageOps, ImageDraw
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE, MSO_CONNECTOR
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt


ROOT = Path(__file__).resolve().parents[3]
OWNED = Path(__file__).resolve().parents[1]
TEMPLATE = Path("/home/u24/pptx-wrap/assets/templates/educate.pptx")
PROJECT = OWNED / "build"
EXPORT = PROJECT / "exports/c120-lora-leo-direct-teaching-part-c-editable_20260811.pptx"
RENDER_DIR = PROJECT / "renders"
QA_DIR = PROJECT / "qa"
ANALYSIS_DIR = PROJECT / "analysis"
VALIDATION_DIR = PROJECT / "validation"
SOURCE_MD = ROOT / "teaching-rewrite/part-c-visible-content.md"
FIELD_MD = ROOT / "evidence/browser-field-inventory-20260811/field-interpretation.md"
EVIDENCE_DIR = ROOT / "evidence/browser-field-inventory-20260811"
OFFICE_HELPER = Path("/home/u24/.codex/skills/pptx/scripts/office/soffice.py")

CONTENT_BOTTOM = 6.58
FORBIDDEN = "\u5b78\u751f"
MINUTE_RE = re.compile(r"(?:\u5206\u9418|\b\d+\s*(?:min|mins|minute|minutes)\b)", re.I)
LATIN_RE = re.compile(r"[A-Za-z0-9_./\\:-]")
VAR_RE = re.compile(
    r"(URGENT_MARGIN_S|BATCH_SIZE|student_policy\.py|SEND_URGENT|"
    r"REST_DURING_GAP|FLUSH_BATCH|SEND_ONE|PACE_GAP_STEPS|"
    r"result\.json|endpoint-replay\.json|result_path|run identity|"
    r"scenario_id|policy hash|endpoint J|bit/J|READY|fallback|"
    r"service|deadline|queue|Action|Radio|Quality|Contact ID)"
)
FORMAL_RE = re.compile(
    r"(?:\u8acb|\u5b78\u751f|\u8001\u5e2b|\u8b1b\u5e2b|\u4f60|"
    r"\u820a\u622a\u5716|\u672c\u9801\u4e0d|\u4e0d\u662f|\u4e0d\u4ee3\u8868|"
    r"\u7248\u9762|\bFit\b|\u6295\u5f71\u61c9\u653e|\u8b1b\u7a3f\u63d0\u793a|"
    r"\u622a\u5716\u5b89\u6392|\u53ea\u653e\u5fc5\u8981\u6b04\u4f4d|"
    r"\u80fd\u56de\u7b54|\u80fd\u6307\u51fa|\u80fd\u8aaa\u51fa|\u53ef\u4ee5\u56de\u7b54|\u53ef\u6559|"
    r"\u5b8c\u6210\u9019\u5802\u8ab2|\u8ac7\u7701\u96fb|"
    r"\u5148[^。！？]*\u624d\u8ac8?)"
)

NAVY = RGBColor(53, 55, 127)
PURPLE = RGBColor(102, 0, 102)
BLUE = RGBColor(61, 97, 185)
TEAL = RGBColor(0, 116, 116)
GOLD = RGBColor(132, 104, 38)
RED = RGBColor(153, 42, 42)
INK = RGBColor(35, 35, 35)
MUTED = RGBColor(90, 94, 111)
WHITE = RGBColor(255, 255, 255)
CREAM = RGBColor(250, 247, 232)
PALE_BLUE = RGBColor(236, 241, 254)
PALE_PURPLE = RGBColor(244, 237, 247)
PALE_GOLD = RGBColor(253, 249, 226)
PALE_TEAL = RGBColor(232, 247, 244)
PALE_RED = RGBColor(253, 239, 239)
GRAY = RGBColor(223, 226, 234)

BOUNDARY = "待補：LoRa runner／endpoint replay fresh evidence｜SIMULATED TEACHING DATA｜NOT LIVE｜NOT MEASURED"
RUN_ID = "current-run-identity"


def sanitize_text(value: str) -> str:
    """Keep the slide and note language within the current authoring contract."""
    value = re.sub(r"(?i)sha[- ]?256|checksum", "run identity", value)
    value = re.sub(r"(?i)\bhash\b", "identity", value)
    value = value.replace("分鐘", "time window")
    return value


@dataclass(frozen=True)
class Page:
    number: int
    title: str
    kind: str
    notes: str


def page(number: int, title: str, kind: str, notes: str) -> Page:
    return Page(number, title, kind, notes)


PAGES = [
    page(64, "Lab C：佇列要等批次，還是 urgent deadline 優先？", "hero", "Lab C 把 queue、batch、urgent deadline 和 endpoint J 放進同一個 service window。閱讀順序固定為 service、deadline、能量差異；畫面上的數值只作 coherent simulated result。"),
    page(65, "先讀原始 student_policy.py：原本的門檻怎麼工作？", "original", "先沿著原始 branch 說出窗口、urgent、pacing、batch、wait 的返回順序。完整中文句與具體問題都放在投影上，使每個 action 均回到程式條件。"),
    page(66, "第一輪 compact run／receipt：baseline → candidate", "run1", "這一頁只集中第一輪的兩個 exact case，命令完成後立即保存 stdout 的 result_path。跑本身不承擔教學時間，下一頁的 edit 與 prediction 才是解釋核心。"),
    page(67, "第一次 exact edit：URGENT_MARGIN_S = 5", "edit5", "先朗讀修改前的完整句與問題，再朗讀修改後的完整句與問題。只改 URGENT_MARGIN_S，其他 marked block、runner、scenario、schema 與 energy model 保持不動。"),
    page(68, "candidate run 前的 prediction lock", "predict5", "把 margin 5 的預測寫成可反駁句，避免押一個漂亮 KPI。要求同時指出 urgent action、queue、service／deadline 與 state／endpoint J 的證據位置。"),
    page(69, "第一次 before／after：candidate 的 bit/J 受 gate 約束", "compare2", "這兩筆是 operation contract 的 packaged same-scenario deterministic fallback 參考，fresh measurement claim 不適用。閱讀順序固定為 service、deadline、完整因果句，再描述較低 J 與較高 bit/J。"),
    page(70, "第二次 exact edit：URGENT_MARGIN_S = 30", "edit30", "candidate 的 failure 要保留下來，revision 只針對太晚介入提出修正。修改前後都要問是否能保住 deadline，以及還要一起讀哪些 state／J evidence。"),
    page(71, "revision run 前：較早介入的可反駁預測", "predict30", "revision 預測可能較早花 endpoint energy，required packet 可能在期限前完成。J 上升且 deadline 變成 PASS 時，trade-off 由 delivery、deadline 與 state ledger 定義，結果不縮成單一效率數字。"),
    page(72, "第二輪 compact run／receipt：revision freeze → surprise", "run2", "這一頁只列 revision freeze 與 surprise 的 exact commands。surprise 沿用 frozen policy，不新增 edit、不重新調參，完成後立即保存兩個新的 stdout result_path。"),
    page(73, "before／after／revision：三筆結果要沿同一條因果鏈讀", "compare3", "把 baseline、candidate、revision 放在同一個 deterministic fallback ledger。candidate 的 bit/J 優勢被 service／deadline 否決，revision 的改善只屬於固定條件。"),
    page(74, "surprise withheld：policy frozen，反例留存", "surprise", "surprise 的 2,400 bit、5.41 J、3 次重傳與 3 張逾期封包是 fallback 參考。它界定 margin 30 的適用邊界；第三次調參不在規格內。"),
    page(75, "Lab C debrief：service／deadline gate 優先於 J", "gate", "gate-first 階梯收束 Lab C。結論是 urgent margin 改變 deadline／energy trade-off，而且效果依 service condition 而定；結論不延伸為 margin 30 永遠最佳。"),
    page(76, "網站責任：驗證、重播、保存", "website", "Leo /course 接收 runner 已產生的 result.json 與配對 replay。網站責任範圍為 validation、replay、workbook 保存；student_policy.py 的執行與驗證歸屬 terminal runner，READY 屬 browser record。"),
    page(77, "import gate：source／gates／hash 的讀取順序", "import", "實際 upload 或同情境 fallback 提供來源、schema、identity、lineage、hash 和 import state。accepted 表示 endpoint artifact 通過匯入契約；provider 與 live measurement 不列入此 claim。"),
    page(78, "frame selector 與事件脈絡：回到 policy branch", "replay", "replay 定義為 selector、八個欄位、queue、event 與 timeline 的同一條事件脈絡。每一次切 frame 都把 action 對回 student_policy.py 的 branch。"),
    page(79, "Workbook：prediction、result、replay、source、hash", "workbook", "Workbook 保存 prediction、結果 lineage、source、hash 與 recovery 狀態。完成度與 checkpoint 屬課程紀錄；service、energy 與策略排序由其他欄位定義。"),
    page(80, "保存與重開：checkpoint 不會替缺失證據補答案", "save", "建立 checkpoint、恢復、重設、復原、匯出與重新開啟都只管理本機課程紀錄。重開後仍要重新核對 run identity、source、role 和 service gate。"),
    page(81, "transfer：智慧農場把 gate-first 變成灌溉決策", "farm", "把 Lab C 的 urgent deadline 映射到灌溉告警，把 endpoint J 映射到泵浦能源；服務 gate 優先於節能描述。這是 transfer reasoning，未提供 live farm KPI。"),
    page(82, "transfer：HVAC 先守舒適與設備 deadline", "hvac", "HVAC 的 urgent branch 語義包含舒適度、設備保護或尖峰事件。先確認 service condition 與 deadline，再比較控制動作造成的能源差異。"),
    page(83, "transfer：edge inference 先守 freshness，再看 Joule", "edge", "edge inference 把 packet delivery 換成新鮮度與任務完成，仍保留 source、trace、gate 與 endpoint scope。低 Joule 但 stale output 不能先稱為成功。"),
    page(84, "transfer exit：把可移植的因果句帶回 workbook", "exit", "最後保留 condition、policy branch、event／service evidence、energy scope 和 claim ceiling。若需要 fresh run，先保存目前 identity，再依核准流程另開，不在 website 偷補結果。"),
    page(85, "current /course：來源與匯入 gate 分屏讀取", "source", "左側是本次 browser session 已接受的 A／baseline endpoint upload，右側是同情境 fallback。source、case、hash 和 import gate 構成閱讀欄位；claim 維持 coherent simulated result、browser record、not measured。"),
    page(86, "current /course：service-first summary", "summary", "accepted endpoint teaching evidence 顯示 service FAIL、6.92 J、4,800 bit 和 693.641618 bit/J。這四個欄位要按 service、delivered、endpoint J、bit/J 順序讀，不得使效率數字改寫 FAIL。"),
    page(87, "current /course：frame selector 與八個 replay fields", "fields", "選擇器改變 replay frame，八個欄位要一起讀：Radio、Action、queue count、累積 endpoint J、elapsed、Contact ID、Contact、ordinal Quality。Quality 採 ordinal band；frame selector 使用各自 frame identity，不使用固定抽樣。"),
    page(88, "current /course：queue 與 packet event 是因果錨點", "queue", "queue 告訴我們當下還有什麼工作，packet event 告訴我們這個 frame 發生什麼。先追生成、入列、attempt、retry、delivered 或 expired，再回到 service summary。"),
    page(89, "current /course：timeline 對回 student_policy.py 分支", "timeline", "timeline 把 contact、quality、radio state 和 action 放在同一個 frame 序列；它描述 transition，不描述連續功率。每個 transition 對回 contact、urgent、pacing、batch 或 wait branch。"),
    page(90, "current /course：ledger 顯示目前選取，best strategy 另由 gate 定義", "ledger", "execution ledger 核對 experiment、case、role、service、endpoint J、source 和 run identity。畫面選到的列屬選取狀態；實際執行與 fallback 來源分開陳述。"),
    page(91, "current /course：provider 與 endpoint 是兩層證據", "provider", "provider 只說明 LEO scenario、TLE、contact、cell、frequency 和 dB 的 opportunity context，endpoint result 說明 imported runner artifact。Evidence view 的 503 MODQN 與 WebGL／GLTF warnings 不可宣稱 provider browser PASS。"),
    page(92, "current /course：Workbook controls 與證據保存", "controls", "依課程簡報填寫完整證據學習單、開啟 Leo 任務紀錄、checkpoint、restore、reset、undo、export、reopen 都要分別說明。這些 control 管理紀錄與回復，不替代 runner 或 scientific parity。"),
    page(93, "current /course：rejection 與 recovery fail closed", "recovery", "格式、identity、lineage 和 immutable duplicate 的錯誤維持原 session 狀態。matching artifact、release backup 或明確 fallback 提供 recovery 路徑；JSON、case 與 surprise provenance 維持原值。"),
    page(94, "Prepare 的 READY：browser-local terminal receipt record", "ready", "記錄 READY 表示 terminal 已看見 machine-readable READY；Leo 端維持 browser-local record，Python 執行與驗證歸屬 terminal runner。安裝、verify、run、upload 與 Lab 完成由各自 receipt 定義；記錄備用環境表示採用 fallback 路徑。"),
    page(95, "全站導覽與 fallback loader：按鈕只改畫面狀態", "nav", "全站導覽、語言切換、準備、實驗 A／B／C、證據、學習單與 fallback loader 只改焦點、語言或資料選擇。切頁不會完成 identity、service 或 upload gate。"),
    page(96, "Task lock 與證據按鈕：檢查課程段落，不代替 runner", "tasks", "任務 1–10 的勾選與證據已鎖定是保存狀態，檢查證據並繼續只檢查目前課程段落。它不執行 Python、不重算 replay，也不宣布策略 PASS。"),
    page(97, "Provider replay controls：provider frames 與 endpoint result 分層", "provider_controls", "播放結果、暫停重播、slider、上一畫面和下一個畫面只控制 provider replay。endpoint selector 與 system replay timeline 各自保存 frame identity；兩層時間需分開判讀。"),
    page(98, "current /course：八個 replay 欄位的後四欄", "fields2", "Elapsed、Contact ID、Contact 與 Quality 各自具有來源、值型態、作用與失敗不變項。四欄均隨 endpoint frame selector 更新，Quality 維持 ordinal quality_band 分類。"),
    page(99, "current /course：控制項的讀寫、成功變化與失敗不變項", "control_contract", "Prepare、導覽與 fallback、Workbook、replay 與 task controls 分組說明。每組列出動作、讀取／寫入資料、成功後狀態與驗證失敗時維持不變的資料。"),
]

# The controller-owned Part C lane ends at P097.  P098-P099 remain available
# as source material for the root lane's tail and are intentionally excluded.
PAGES = [p for p in PAGES if p.number <= 97]


def qn(ns: str, local: str) -> str:
    return f"{{{ns}}}{local}"


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
        node = rpr.find(qn("http://schemas.openxmlformats.org/drawingml/2006/main", tag))
        if node is None:
            from pptx.oxml.xmlchemy import OxmlElement
            node = OxmlElement(f"a:{tag}")
            rpr.append(node)
        node.set("typeface", face)


def write_text(tf, value: str, size: int, *, bold: bool = False, color: RGBColor = INK,
               align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP, italic_code: bool = True) -> None:
    value = sanitize_text(value)
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = Inches(0.08)
    tf.margin_right = Inches(0.08)
    tf.margin_top = Inches(0.04)
    tf.margin_bottom = Inches(0.04)
    tf.vertical_anchor = valign
    for index, line_value in enumerate(value.split("\n")):
        paragraph = tf.paragraphs[0] if index == 0 else tf.add_paragraph()
        paragraph.alignment = align
        paragraph.space_after = Pt(0)
        paragraph.line_spacing = 1.0
        chunks = [chunk for chunk in VAR_RE.split(line_value) if chunk]
        if not chunks:
            chunks = [""]
        for chunk in chunks:
            run = paragraph.add_run()
            run.text = chunk
            italic = italic_code and bool(VAR_RE.fullmatch(chunk))
            set_run_font(run, size, bold=bold, italic=italic, color=color)


def text_box(slide, x: float, y: float, w: float, h: float, value: str, size: int = 24,
             *, bold: bool = False, color: RGBColor = INK, align=PP_ALIGN.LEFT,
             valign=MSO_ANCHOR.TOP, fill: RGBColor | None = None,
             line_color: RGBColor | None = None, name: str = "Editable text",
             italic_code: bool = True):
    if fill is None and line_color is None:
        shape = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
        shape.fill.background()
        shape.line.fill.background()
    else:
        shape = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill or WHITE
        shape.line.color.rgb = line_color or (fill or WHITE)
        shape.line.width = Pt(1.1)
    shape.name = name
    write_text(shape.text_frame, value, size, bold=bold, color=color, align=align, valign=valign, italic_code=italic_code)
    return shape


def panel(slide, x: float, y: float, w: float, h: float, *, fill=WHITE, line_color=BLUE, name="Editable panel"):
    return text_box(slide, x, y, w, h, "", 18, fill=fill, line_color=line_color, name=name)


def connector(slide, x1: float, y1: float, x2: float, y2: float, *, color=NAVY, width=1.6, arrow=False, name="Editable connector"):
    shape = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    shape.name = name
    shape.line.color.rgb = color
    shape.line.width = Pt(width)
    if arrow:
        shape.line.end_arrowhead = True
    return shape


def dot(slide, x: float, y: float, diameter: float = 0.16, *, color=TEAL, name="Editable marker"):
    shape = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.OVAL, Inches(x), Inches(y), Inches(diameter), Inches(diameter))
    shape.name = name
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.color.rgb = color
    return shape


def clear_placeholders(slide) -> None:
    for shape in list(slide.shapes):
        if not shape.is_placeholder:
            continue
        idx = shape.placeholder_format.idx
        if idx in (0, 10):
            continue
        shape._element.getparent().remove(shape._element)


def set_title(slide, value: str) -> None:
    title = slide.shapes.title
    if title is None:
        title = slide.shapes.add_textbox(Inches(0.68), Inches(0.18), Inches(11.95), Inches(0.62))
    title.left = Inches(0.68)
    title.top = Inches(0.18)
    title.width = Inches(11.95)
    title.height = Inches(0.62)
    title.name = "Native title anchor"
    write_text(title.text_frame, value, 28, bold=True, color=NAVY, valign=MSO_ANCHOR.MIDDLE, italic_code=False)


def stamp(slide, text: str = BOUNDARY) -> None:
    text_box(slide, 0.72, 5.98, 11.80, 0.55, text, 18, bold=True, color=RED,
             align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Claim boundary", italic_code=False)


def lead(slide, value: str, *, color=NAVY, size: int = 24) -> None:
    text_box(slide, 0.86, 0.94, 11.62, 0.48, value, size, bold=True, color=color,
             align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Teaching lead", italic_code=False)


def card(slide, x: float, y: float, w: float, h: float, heading: str, body: str,
         *, fill=PALE_BLUE, line_color=BLUE, body_size: int = 22, heading_size: int = 19,
         align=PP_ALIGN.CENTER, name="Editable card"):
    panel(slide, x, y, w, h, fill=fill, line_color=line_color, name=name)
    text_box(slide, x + 0.14, y + 0.12, w - 0.28, 0.32, heading, heading_size, bold=True,
             color=line_color, align=align, valign=MSO_ANCHOR.MIDDLE, name=name + " heading", italic_code=False)
    text_box(slide, x + 0.16, y + 0.52, w - 0.32, h - 0.64, body, body_size, color=INK,
             align=align, valign=MSO_ANCHOR.MIDDLE, name=name + " body")


def small_label(slide, x: float, y: float, w: float, value: str, *, color=NAVY, fill=CREAM, name="Label"):
    text_box(slide, x, y, w, 0.34, value, 18, bold=True, color=color, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE, fill=fill, line_color=color, name=name, italic_code=False)


def image_asset(name: str, crop: tuple[int, int, int, int] | None = None) -> Path:
    asset_dir = PROJECT / "assets"
    asset_dir.mkdir(parents=True, exist_ok=True)
    target = asset_dir / name
    source_names = {
        "08-header.png": "08-current-package-upload-accepted.png",
        "08-summary.png": "08-current-package-upload-accepted.png",
        "08-fields.png": "08-current-package-upload-accepted.png",
        "08-queue.png": "08-current-package-upload-accepted.png",
        "08-ledger.png": "08-current-package-upload-accepted.png",
        "03-fallback.png": "03-lab-c-fallback-complete.png",
        "04-provider.png": "04-evidence-complete.png",
        "05-workbook.png": "05-workbook-expanded.png",
        "06-timeline.png": "06-replay-timeline-expanded.png",
        "09-ready.png": "09-prepare-ready-recorded.png",
        "00-prepare.png": "00-prepare-fallback-environment.png",
    }
    source_name = source_names.get(name, name)
    source = EVIDENCE_DIR / source_name
    if not source.exists():
        source = EVIDENCE_DIR / name
    with Image.open(source) as image:
        if crop:
            left, top, right, bottom = crop
            left = max(0, min(left, image.width - 1))
            top = max(0, min(top, image.height - 1))
            right = max(left + 1, min(right, image.width))
            bottom = max(top + 1, min(bottom, image.height))
            image = image.crop((left, top, right, bottom))
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.save(target, quality=94)
    return target


def picture(slide, path: Path, x: float, y: float, w: float, h: float, *, name="Evidence screenshot"):
    shape = slide.shapes.add_picture(str(path), Inches(x), Inches(y), Inches(w), Inches(h))
    shape.name = name
    return shape


def make_assets() -> dict[str, Path]:
    # Crops keep the field walkthrough readable while preserving the source
    # screenshots as separate, auditable evidence files.
    return {
        # Current screenshots contain a run-identity string in the import
        # status panel.  The teaching contract forbids showing SHA/checksum
        # material, so crops stop above that region while retaining the
        # visible control and field evidence.
        "accepted_header": image_asset("08-header.png", (0, 0, 1280, 560)),
        "accepted_summary": image_asset("08-summary.png", (0, 955, 1280, 1320)),
        "accepted_fields": image_asset("08-fields.png", (0, 955, 1280, 1420)),
        "accepted_queue": image_asset("08-queue.png", (0, 1180, 1280, 1693)),
        "accepted_ledger": image_asset("08-ledger.png", (0, 1380, 1280, 1693)),
        "fallback": image_asset("03-fallback.png", (0, 300, 1280, 1450)),
        "provider": image_asset("04-provider.png", (0, 300, 1280, 1550)),
        "workbook": image_asset("05-workbook.png", (0, 200, 1280, 1420)),
        "timeline": image_asset("06-timeline.png", (0, 0, 1198, 93)),
        "ready": image_asset("09-ready.png", (0, 0, 1280, 823)),
        "prepare": image_asset("00-prepare.png", (0, 180, 1280, 823)),
    }


def draw_hero(slide):
    lead(slide, "一個門檻，三種結果：先保住服務，再讀 endpoint J")
    card(slide, 0.86, 1.56, 3.60, 2.40, "QUEUE AGE", "normal 與 urgent\n等待／批次壓力", fill=PALE_BLUE, line_color=BLUE, name="Lab C queue")
    card(slide, 4.86, 1.56, 3.60, 2.40, "DEADLINE", "最晚完成時間\n資料 freshness", fill=PALE_PURPLE, line_color=PURPLE, name="Lab C deadline")
    card(slide, 8.86, 1.56, 3.60, 2.40, "ENDPOINT J", "累積能量\n不能取代 gate", fill=PALE_GOLD, line_color=GOLD, name="Lab C energy")
    connector(slide, 2.66, 4.08, 6.70, 4.08, color=NAVY, width=2.0, arrow=True)
    connector(slide, 6.70, 4.08, 10.66, 4.08, color=NAVY, width=2.0, arrow=True)
    text_box(slide, 1.05, 4.38, 11.12, 0.80, "urgent branch → action timing → packet outcome → service／deadline → endpoint J", 24, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Lab C causal chain")
    stamp(slide)


def draw_original(slide):
    lead(slide, "原始行為：完整 function 先看窗口，再看 urgent branch")
    code = ("BATCH_SIZE = 3\n"
            "URGENT_MARGIN_S = 20\n"
            "if urgent_pending and due_in_s <= URGENT_MARGIN_S:\n"
            "    return SEND_URGENT\n"
            "if steps_since_send < PACE_GAP_STEPS:\n"
            "    return REST_DURING_GAP\n"
            "if quality_ready and queue_size >= BATCH_SIZE:\n"
            "    return FLUSH_BATCH\n"
            "return SEND_ONE / WAIT")
    panel(slide, 0.78, 1.36, 6.36, 4.22, fill=CREAM, line_color=NAVY, name="Original policy code")
    text_box(slide, 1.02, 1.58, 5.88, 3.82, code, 18, color=INK, name="Original policy code text", italic_code=True)
    branches = [("窗口關閉", "SLEEP", RED, PALE_RED), ("urgent_due_in_s ≤ 20", "SEND_URGENT", PURPLE, PALE_PURPLE), ("pacing gap", "REST_DURING_GAP", BLUE, PALE_BLUE), ("quality + queue", "FLUSH_BATCH / SEND_ONE", TEAL, PALE_TEAL), ("其他", "WAIT", GOLD, PALE_GOLD)]
    y = 1.42
    for label, action, color, fill in branches:
        card(slide, 7.42, y, 4.82, 0.70, label, action, fill=fill, line_color=color, body_size=18, heading_size=18, name="Original branch")
        y += 0.82
    text_box(slide, 0.86, 5.64, 11.60, 0.28, "門檻 20 可能早介入 urgent；優先於 pacing／batch。條件：queue ≥ BATCH_SIZE 時，返回 action 為何？", 18, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Original question", italic_code=False)
    stamp(slide)


def draw_run(slide, second: bool = False):
    lead(slide, "一頁快速 run：命令完成後立刻保存 result_path")
    if not second:
        left_head, left_body = "BASELINE", "bash course.sh run --lab C --case baseline\n\nuntouched policy\nstdout → result_path"
        right_head, right_body = "CANDIDATE", "bash course.sh run --lab C --case candidate\n\n完成 margin 5 edit\nstdout → result_path"
    else:
        left_head, left_body = "REVISION + FREEZE", "bash course.sh run --lab C --case revision --freeze\n\nmargin 30\nfreeze receipt + result_path"
        right_head, right_body = "SURPRISE WITHHELD", "bash course.sh run --lab C --case surprise\n\npolicy bytes unchanged\nresult_path → replay"
    card(slide, 0.80, 1.34, 5.72, 3.62, left_head, left_body, fill=PALE_BLUE, line_color=BLUE, body_size=20, heading_size=20, name="Compact run left")
    card(slide, 6.80, 1.34, 5.72, 3.62, right_head, right_body, fill=PALE_PURPLE if not second else PALE_GOLD, line_color=PURPLE if not second else GOLD, body_size=20, heading_size=20, name="Compact run right")
    connector(slide, 6.56, 3.12, 6.76, 3.12, color=NAVY, width=1.8, arrow=True)
    text_box(slide, 1.00, 5.16, 11.28, 0.50, "receipt 只證明 artifact path 被產出；下一步讀來源、identity、service、replay。不要用 run 本身拖長教學。", 20, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Run teaching boundary", italic_code=False)
    stamp(slide)


def draw_edit(slide, value: str, old: str, label: str):
    lead(slide, f"{label}：只改一個 marked line，其他 branch 保持原樣")
    card(slide, 0.86, 1.42, 5.56, 2.06, "修改前完整句", f"URGENT_MARGIN_S = {old}\n它是 urgent override 門檻，不直接定義能量。\n問題：哪個 observation 使 urgent branch 先返回？", fill=PALE_BLUE, line_color=BLUE, body_size=20, heading_size=19, name="Exact edit before")
    card(slide, 6.86, 1.42, 5.56, 2.06, "修改後完整句", f"URGENT_MARGIN_S = {value}\n期限更逼近時才觸發 SEND_URGENT。\n問題：service 與 deadline 欄位的狀態為何？", fill=PALE_PURPLE, line_color=PURPLE, body_size=20, heading_size=19, name="Exact edit after")
    connector(slide, 6.48, 2.46, 6.80, 2.46, color=GOLD, width=2.0, arrow=True)
    panel(slide, 1.10, 3.86, 10.98, 1.46, fill=CREAM, line_color=GOLD, name="Exact code line")
    text_box(slide, 1.38, 4.12, 10.42, 0.86, f"BATCH_SIZE = 3\nURGENT_MARGIN_S = {value}    ← exact edit", 24, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Exact code line text")
    stamp(slide, "POLICY SURFACE｜marked block only｜SIMULATED TEACHING DATA")


def draw_prediction(slide, value: str):
    lead(slide, f"prediction lock：margin {value} 先寫機制，再跑 candidate")
    nodes = [("urgent timing", "可能較晚／較早觸發", BLUE, PALE_BLUE), ("queue／packet", "等待、delivery、expiry", PURPLE, PALE_PURPLE), ("service／deadline", "可能 PASS，也可能 FAIL", RED, PALE_RED), ("state／endpoint J", "wake／TX／retry 再解釋", TEAL, PALE_TEAL)]
    x = 0.76
    for i, (head, body, color, fill) in enumerate(nodes):
        card(slide, x, 1.54, 2.86, 2.20, head, body, fill=fill, line_color=color, body_size=20, heading_size=18, name="Prediction evidence")
        if i < 3:
            connector(slide, x + 2.86, 2.64, x + 3.02, 2.64, color=NAVY, width=1.4, arrow=True)
        x += 3.04
    panel(slide, 1.04, 4.18, 11.08, 1.08, fill=PALE_GOLD, line_color=GOLD, name="Prediction sentence")
    text_box(slide, 1.30, 4.40, 10.56, 0.68, f"完整句：URGENT_MARGIN_S 改成 {value} 後，預測 action 時機會改變；以 packet、service、deadline、state ledger 檢驗。判讀條件：哪個 gate 失敗會推翻「只是省能量」？", 19, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Prediction sentence text", italic_code=False)
    stamp(slide)


def draw_compare2(slide):
    lead(slide, "before／after：先 gate，後 endpoint bit/J")
    headers = [("baseline｜20", "10,400 bit\n10.66 J\n975.609756 bit/J\nservice PASS｜deadline PASS", BLUE, PALE_BLUE), ("candidate｜5", "9,600 bit\n9.74 J\n985.626283 bit/J\nservice FAIL｜deadline FAIL", PURPLE, PALE_PURPLE)]
    for i, (head, body, color, fill) in enumerate(headers):
        x = 0.92 + i * 6.02
        card(slide, x, 1.48, 5.52, 2.84, head, body, fill=fill, line_color=color, body_size=23, heading_size=20, name="Before after ledger")
    connector(slide, 6.52, 2.88, 6.80, 2.88, color=GOLD, width=2.0, arrow=True)
    text_box(slide, 1.04, 4.68, 11.10, 0.66, "因果句：margin 5 使 urgent override 更晚，少交付 800 bit，兩個 gate FAIL；較高 bit/J 不得改寫成成功節能。", 22, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Compare causal sentence", italic_code=False)
    stamp(slide)


def draw_compare3(slide):
    lead(slide, "三筆 deterministic fallback：同一 scenario，先看 gate")
    rows = [("before／baseline", "20", "10,400", "10.66", "975.609756", "PASS／PASS", BLUE, PALE_BLUE), ("after／candidate", "5", "9,600", "9.74", "985.626283", "FAIL／FAIL", PURPLE, PALE_PURPLE), ("revision", "30", "10,400", "10.66", "975.609756", "PASS／PASS", TEAL, PALE_TEAL)]
    labels = ["role", "margin", "delivered bit", "endpoint J", "bit/J", "service／deadline"]
    x_positions = [0.74, 2.48, 3.62, 5.04, 6.52, 8.44]
    widths = [1.64, 1.04, 1.28, 1.28, 1.76, 3.10]
    for x, w, lab in zip(x_positions, widths, labels):
        small_label(slide, x, 1.26, w, lab, color=NAVY, fill=CREAM, name="Ledger header")
    for row_idx, row in enumerate(rows):
        y = 1.78 + row_idx * 0.98
        values = row[:6]
        color, fill = row[6], row[7]
        for x, w, value in zip(x_positions, widths, values):
            text_box(slide, x, y, w, 0.72, value, 19 if len(value) > 10 else 21, bold=True, color=color if x == x_positions[0] else INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, fill=fill, line_color=color, name="Ledger cell", italic_code=False)
    text_box(slide, 1.00, 4.94, 11.28, 0.58, "完整句：candidate 少交付且兩個 gate 失敗；revision 在固定 fallback 恢復 gate，所以解釋的是較早介入的 trade-off；結論不延伸為 30 永遠最佳。", 20, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Three-way causal sentence", italic_code=False)
    stamp(slide)


def draw_surprise(slide):
    lead(slide, "withheld：policy frozen，反例不重調")
    card(slide, 0.86, 1.52, 5.54, 2.98, "FROZEN REVISION", "URGENT_MARGIN_S = 30\npolicy bytes unchanged\n保留 revision receipt\n不新增 edit", fill=PALE_BLUE, line_color=BLUE, body_size=23, heading_size=20, name="Frozen policy")
    card(slide, 6.86, 1.52, 5.54, 2.98, "SURPRISE FALLBACK", "2,400 delivered bit\n5.41 J｜443.622921 bit/J\n3 retransmissions\n3 expired packets\nservice FAIL｜deadline FAIL", fill=PALE_RED, line_color=RED, body_size=21, heading_size=19, name="Surprise evidence")
    connector(slide, 6.46, 3.00, 6.80, 3.00, color=RED, width=2.0, arrow=True)
    text_box(slide, 1.00, 4.86, 11.32, 0.68, "具體問題：5.41 J 比 revision 低，是否再改 margin？答案：不要；service／deadline FAIL，保存 result_path 與 provenance，使 surprise 界定 claim ceiling。", 21, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Surprise boundary", italic_code=False)
    stamp(slide)


def draw_gate(slide):
    lead(slide, "gate-first：service／deadline 先於 endpoint J")
    steps = [("1", "service", "工作是否保住", BLUE, PALE_BLUE), ("2", "deadline", "期限／freshness", PURPLE, PALE_PURPLE), ("3", "delivery", "bit／expired／retry", TEAL, PALE_TEAL), ("4", "endpoint J", "最後才描述", GOLD, PALE_GOLD)]
    for i, (num, head, body, color, fill) in enumerate(steps):
        x = 0.90 + i * 3.02
        y = 1.52 + i * 0.25
        card(slide, x, y, 2.62, 1.30, f"{num}｜{head}", body, fill=fill, line_color=color, body_size=20, heading_size=18, name="Gate ladder")
        if i < 3:
            connector(slide, x + 2.62, y + 0.65, x + 2.90, y + 0.65, color=NAVY, width=1.6, arrow=True)
    text_box(slide, 1.10, 4.60, 11.04, 0.70, "收束句：margin 會改變 deadline／energy trade-off；效果依 service condition 而定，高 bit/J 不構成成功判定。", 22, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Gate conclusion", italic_code=False)
    stamp(slide)


def draw_website(slide):
    lead(slide, "website boundary：artifact validation → replay → workbook")
    nodes = [("本機 runner", "student_policy.py\n產生 result.json", BLUE, PALE_BLUE), ("import gate", "schema／identity／units\nlineage／hash", PURPLE, PALE_PURPLE), ("Leo replay", "endpoint fields\nqueue／event／timeline", TEAL, PALE_TEAL), ("Workbook", "prediction／role\nsource／checkpoint", GOLD, PALE_GOLD)]
    x = 0.62
    for i, (head, body, color, fill) in enumerate(nodes):
        card(slide, x, 1.50, 2.78, 2.28, head, body, fill=fill, line_color=color, body_size=21, heading_size=18, name="Website responsibility")
        if i < 3:
            connector(slide, x + 2.78, 2.64, x + 3.00, 2.64, color=NAVY, width=1.6, arrow=True)
        x += 3.02
    text_box(slide, 1.00, 4.34, 11.28, 0.82, "terminal runner 產生 result.json；網站讀取通過 gate 的 artifact，提供 replay 與 workbook 保存。Python 執行與驗證屬 terminal runner，provider context 保持獨立。", 22, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Website boundary text", italic_code=False)
    stamp(slide)


def draw_import(slide, assets):
    lead(slide, "import ladder：source → gates → hash → accepted／rejected")
    picture(slide, assets["accepted_header"], 0.76, 1.34, 5.66, 2.24, name="Actual upload header evidence")
    card(slide, 6.76, 1.34, 5.62, 2.24, "GATE ORDER", "選 result.json\nformat／schema\nexperiment／case identity\nlineage／policy hash\nimport state", fill=PALE_PURPLE, line_color=PURPLE, body_size=20, heading_size=19, name="Import gate order")
    text_box(slide, 0.92, 3.94, 11.34, 0.84, "匯入狀態：已接受｜實驗 A／baseline｜來源：實際執行\n驗證範圍：endpoint result 的 schema、identity、units 與 provenance。", 18, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Import accepted identity", italic_code=False)
    stamp(slide)


def draw_replay(slide):
    lead(slide, "replay 的一個 frame 同時帶著八個欄位與事件脈絡")
    selector = [("Frame 00", BLUE, PALE_BLUE), ("Frame 01", PURPLE, PALE_PURPLE), ("Frame 02", TEAL, PALE_TEAL), ("Frame 03", GOLD, PALE_GOLD)]
    x = 0.84
    for label, color, fill in selector:
        small_label(slide, x, 1.36, 2.72, label, color=color, fill=fill, name="Frame selector")
        x += 2.94
    fields = [("Radio", "SLEEP／TX／RX"), ("Action", "WAIT／SEND_URGENT"), ("Queue count", "尚待處理"), ("累積 endpoint J", "run-to-frame"), ("Elapsed", "trace elapsed"), ("Contact ID", "目前 contact"), ("Contact", "開／關"), ("Quality", "ordinal quality_band")]
    for i, (head, body) in enumerate(fields):
        x = 0.74 + (i % 4) * 3.04
        y = 2.02 + (i // 4) * 1.02
        card(slide, x, y, 2.78, 0.82, head, body, fill=PALE_BLUE if i < 4 else PALE_TEAL, line_color=BLUE if i < 4 else TEAL, body_size=18, heading_size=18, name="Eight replay fields")
    text_box(slide, 1.02, 4.40, 11.22, 0.64, "frame → queue → event → timeline → policy branch；Action 顯示 — 表示該 frame 無新 action，radio state 仍由 Radio 欄位定義。", 21, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Replay causal path", italic_code=False)
    stamp(slide)


def draw_workbook(slide):
    lead(slide, "Workbook：完成度與策略分數分離")
    card(slide, 0.82, 1.42, 5.66, 3.08, "填寫 evidence", "prediction\nresult／replay lineage\nsource／identity\nrole／service gate", fill=PALE_BLUE, line_color=BLUE, body_size=23, heading_size=20, name="Workbook evidence")
    card(slide, 6.82, 1.42, 5.66, 3.08, "保存與恢復", "checkpoint #／完成度\n建立／恢復\n匯出／重新開啟\n0/10 表示 workbook 段落完成度；policy score 由 service／J 欄位定義", fill=PALE_GOLD, line_color=GOLD, body_size=21, heading_size=20, name="Workbook recovery")
    connector(slide, 6.50, 2.96, 6.78, 2.96, color=NAVY, width=1.8, arrow=True)
    text_box(slide, 1.02, 4.92, 11.20, 0.58, "重新開啟重新核對 run identity、source、role 和 service；缺失 evidence 顯示待補，完成狀態由實際紀錄定義。", 20, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Workbook sentence", italic_code=False)
    stamp(slide)


def draw_save(slide):
    lead(slide, "保存、重設、復原、匯出、重開：每個 control 有自己的責任")
    controls = [("建立存檔點", "保存可恢復的 prediction／identity", BLUE, PALE_BLUE), ("恢復存檔點", "回到已保存狀態", TEAL, PALE_TEAL), ("重設本機進度", "清除本機課程紀錄", RED, PALE_RED), ("復原重設", "撤回 reset 的本機狀態", PURPLE, PALE_PURPLE), ("匯出學習單", "保存可攜的 workbook", GOLD, PALE_GOLD), ("重新開啟學習單", "再核對 identity／source", NAVY, CREAM)]
    for i, (head, body, color, fill) in enumerate(controls):
        x = 0.76 + (i % 3) * 4.06
        y = 1.40 + (i // 3) * 1.44
        card(slide, x, y, 3.72, 1.16, head, body, fill=fill, line_color=color, body_size=18, heading_size=18, name="Workbook control")
    text_box(slide, 0.96, 4.64, 11.36, 0.70, "reset／undo 管理本機紀錄；runner、import gate、service gate 與 withheld result 各自保留原始 lineage。", 21, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Save boundary", italic_code=False)
    stamp(slide)


def draw_transfer(slide, domain: str):
    lead(slide, f"transfer：{domain} 仍然先 gate，再談 energy")
    if domain == "智慧農場":
        labels = [("urgent", "灌溉告警／水位期限", BLUE, PALE_BLUE), ("service", "作物／水位被保住", TEAL, PALE_TEAL), ("energy", "泵浦 endpoint J", GOLD, PALE_GOLD)]
    elif domain == "HVAC":
        labels = [("urgent", "舒適／設備保護", BLUE, PALE_BLUE), ("service", "deadline／freshness", TEAL, PALE_TEAL), ("energy", "風機／壓縮機 J", GOLD, PALE_GOLD)]
    else:
        labels = [("urgent", "fresh inference deadline", BLUE, PALE_BLUE), ("service", "任務完成／結果新鮮", TEAL, PALE_TEAL), ("energy", "edge endpoint Joule", GOLD, PALE_GOLD)]
    x = 0.90
    for i, (head, body, color, fill) in enumerate(labels):
        card(slide, x, 1.60, 3.54, 2.38, head, body, fill=fill, line_color=color, body_size=24, heading_size=20, name=f"Transfer {domain}")
        if i < 2:
            connector(slide, x + 3.54, 2.80, x + 3.84, 2.80, color=NAVY, width=1.9, arrow=True)
        x += 3.94
    text_box(slide, 1.00, 4.46, 11.22, 0.82, "轉移內容是一條因果句：condition → policy branch → event → service evidence → scoped endpoint J；KPI 需依場景另行定義。", 22, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Transfer causal chain", italic_code=False)
    stamp(slide)


def draw_exit(slide):
    lead(slide, "transfer exit：把可移植的因果句帶回 workbook")
    parts = [("CONDITION", "哪個窗口／期限？", BLUE, PALE_BLUE), ("BRANCH", "哪個 policy action？", PURPLE, PALE_PURPLE), ("EVENT", "queue／retry／expiry？", TEAL, PALE_TEAL), ("CLAIM", "scope 與反例？", GOLD, PALE_GOLD)]
    x = 0.64
    for i, (head, body, color, fill) in enumerate(parts):
        card(slide, x, 1.50, 2.76, 1.38, head, body, fill=fill, line_color=color, body_size=20, heading_size=18, name="Transfer exit")
        if i < 3:
            connector(slide, x + 2.76, 2.20, x + 2.98, 2.20, color=NAVY, width=1.5, arrow=True)
        x += 3.08
    text_box(slide, 0.96, 3.46, 11.34, 1.10, "需要 fresh run 時，保存目前 result／replay／workbook identity，再依核准流程另開；website scope 為驗證、重播與保存，Python 結果由 terminal runner receipt 定義。", 22, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Exit rule", italic_code=False)
    stamp(slide)


def draw_source(slide, assets):
    lead(slide, "current /course：source、case、hash、source label 要先讀")
    picture(slide, assets["accepted_header"], 0.72, 1.30, 6.02, 2.46, name="Current accepted upload")
    picture(slide, assets["fallback"], 7.02, 1.30, 5.62, 2.46, name="Same-scenario fallback")
    small_label(slide, 0.96, 3.92, 5.54, "實際上傳｜A / baseline｜source 實際執行", color=TEAL, fill=PALE_TEAL, name="Source actual label")
    small_label(slide, 7.28, 3.92, 5.10, "同情境 fallback｜source 分開標示", color=PURPLE, fill=PALE_PURPLE, name="Source fallback label")
    text_box(slide, 0.94, 4.46, 11.30, 0.70, "實際執行與同情境 fallback 分別保存 artifact source 與 run identity。\n資料類型：coherent simulated endpoint result。", 18, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Source provenance", italic_code=False)
    stamp(slide)


def draw_summary(slide, assets):
    lead(slide, "service-first summary：四個欄位有固定閱讀順序")
    picture(slide, assets["accepted_summary"], 0.72, 1.32, 5.48, 3.32, name="Current summary evidence")
    steps = [("1", "服務", "FAIL", RED, PALE_RED), ("2", "已送達", "4,800 bit", BLUE, PALE_BLUE), ("3", "端點能量", "6.92 J", TEAL, PALE_TEAL), ("4", "端點 bit/J", "693.641618", GOLD, PALE_GOLD)]
    for i, (num, head, body, color, fill) in enumerate(steps):
        y = 1.36 + i * 0.86
        card(slide, 6.62, y, 5.72, 0.70, f"{num}｜{head}", body, fill=fill, line_color=color, body_size=21, heading_size=18, name="Service summary step")
    text_box(slide, 0.98, 4.98, 11.28, 0.56, "完整句：這一筆先是 service FAIL；再描述 delivery、endpoint J、bit/J。效率數字僅描述 run，不得把失敗改成成功。", 20, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Service first sentence", italic_code=False)
    stamp(slide)


def draw_fields(slide, assets):
    lead(slide, "frame selector：前四欄的來源、值型態與作用")
    picture(slide, assets["accepted_fields"], 0.72, 1.28, 3.36, 3.82, name="Frame selector evidence")
    fields = [
        ("Radio｜無線電狀態", "來源：endpoint replay frame\n值：分類；作用：state transition\n成功：frame 更新；失敗：selector 狀態維持", BLUE, PALE_BLUE),
        ("Action｜策略動作", "來源：policy event\n值：分類或 —；作用：對回 branch\n成功：event 更新；失敗：原 action 維持", PURPLE, PALE_PURPLE),
        ("Queue count｜佇列數", "來源：frame queue ledger\n值：封包數；作用：批次／等待判讀\n成功：數值更新；失敗：原 queue 狀態維持", TEAL, PALE_TEAL),
        ("累積 endpoint J｜端點能量", "來源：endpoint energy ledger\n值：J；作用：run-to-frame 累積\n成功：J 更新；失敗：原 frame 值維持", GOLD, PALE_GOLD),
    ]
    for i, (head, body, color, fill) in enumerate(fields):
        x = 4.38 + (i % 2) * 4.04
        y = 1.34 + (i // 2) * 1.86
        card(slide, x, y, 3.72, 1.56, head, body, fill=fill, line_color=color, body_size=18, heading_size=18, name="Current first four fields")
    text_box(slide, 4.42, 5.18, 7.68, 0.46, "selector 讀取 endpoint frame；八欄、queue 與 event 以同一 frame identity 更新。", 19, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Field selector rule", italic_code=False)
    stamp(slide)


def draw_fields2(slide, assets):
    lead(slide, "frame selector：後四欄的來源、值型態與作用")
    picture(slide, assets["accepted_fields"], 0.72, 1.28, 3.36, 3.82, name="Frame selector evidence continued")
    fields = [
        ("Elapsed｜經過時間", "來源：endpoint trace\n值：時間；作用：frame 順序\n成功：elapsed 更新；失敗：原 trace 狀態維持", BLUE, PALE_BLUE),
        ("Contact ID｜接觸識別碼", "來源：contact trace\n值：字串識別碼；作用：對齊窗口\n成功：ID 更新；失敗：原 contact identity 維持", PURPLE, PALE_PURPLE),
        ("Contact｜接觸狀態", "來源：contact event\n值：開啟／關閉布林狀態；作用：合法 action 判讀\n成功：狀態更新；失敗：原窗口狀態維持", TEAL, PALE_TEAL),
        ("Quality｜連線品質", "來源：runner quality trace\n值：ordinal quality_band 分類；作用：quality_ready\n成功：band 更新；失敗：原 quality 分類維持", GOLD, PALE_GOLD),
    ]
    for i, (head, body, color, fill) in enumerate(fields):
        x = 4.38 + (i % 2) * 4.04
        y = 1.34 + (i // 2) * 1.86
        card(slide, x, y, 3.72, 1.56, head, body, fill=fill, line_color=color, body_size=18, heading_size=18, name="Current last four fields")
    text_box(slide, 4.42, 5.18, 7.68, 0.46, "Quality 使用 ordinal band 分類；其值不換算 dB。selector failure 維持原 frame 與原 workbook。", 19, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Field interpretation rule", italic_code=False)
    stamp(slide)


def draw_queue(slide, assets):
    lead(slide, "queue 與 packet event：先找 delivered／expired 的證據")
    picture(slide, assets["accepted_queue"], 0.72, 1.30, 4.12, 3.70, name="Current queue evidence")
    nodes = [("生成／入 queue", "normal-1", BLUE, PALE_BLUE), ("attempt", "evt-0000", PURPLE, PALE_PURPLE), ("retry／collision", "frame n+1", GOLD, PALE_GOLD), ("delivered／expired", "service gate", TEAL, PALE_TEAL)]
    x = 5.12
    for i, (head, body, color, fill) in enumerate(nodes):
        card(slide, x, 1.46, 1.74, 2.00, head, body, fill=fill, line_color=color, body_size=18, heading_size=18, name="Queue event trace")
        if i < 3:
            connector(slide, x + 1.74, 2.46, x + 1.96, 2.46, color=NAVY, width=1.4, arrow=True)
        x += 1.92
    text_box(slide, 5.14, 3.92, 6.90, 0.82, "queue 變空 ≠ delivered；要看 packet event、expired、deadline 與 service。", 21, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Queue rule", italic_code=False)
    stamp(slide)


def draw_timeline(slide, assets):
    lead(slide, "timeline：把每個 frame 對回 policy branch，不當連續功率圖")
    picture(slide, assets["timeline"], 0.84, 1.28, 11.66, 0.92, name="Current timeline evidence")
    branches = [("contact_open = false", "SLEEP", RED, PALE_RED), ("urgent_pending ∧ due ≤ margin", "SEND_URGENT", PURPLE, PALE_PURPLE), ("steps_since_send < gap", "REST_DURING_GAP", BLUE, PALE_BLUE), ("quality_ready ∧ queue ≥ batch", "FLUSH_BATCH", TEAL, PALE_TEAL), ("其餘", "WAIT／SEND_ONE", GOLD, PALE_GOLD)]
    y = 2.54
    for cond, action, color, fill in branches:
        panel(slide, 0.98, y, 5.44, 0.54, fill=fill, line_color=color, name="Timeline branch")
        text_box(slide, 1.16, y + 0.10, 4.96, 0.30, cond, 18, color=INK, name="Timeline condition", italic_code=True)
        connector(slide, 6.54, y + 0.27, 7.00, y + 0.27, color=color, width=1.4, arrow=True)
        panel(slide, 7.10, y, 4.78, 0.54, fill=CREAM, line_color=color, name="Timeline action")
        text_box(slide, 7.28, y + 0.10, 4.42, 0.30, action, 19, bold=True, color=color, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Timeline action text", italic_code=True)
        y += 0.64
    stamp(slide)


def draw_ledger(slide, assets):
    lead(slide, "execution ledger：目前選取 ≠ 最佳策略")
    picture(slide, assets["accepted_ledger"], 0.72, 1.28, 4.28, 3.90, name="Current execution ledger")
    fields = [("experiment／case", "屬於哪個 lab／case"), ("display", "目前選取；best strategy 另由 gate 定義"), ("role", "baseline／candidate／revision／withheld"), ("service", "每列保留 gate"), ("endpoint J", "同 boundary 比較"), ("source", "actual 與 fallback 分開")]
    for i, (head, body) in enumerate(fields):
        x = 5.32 + (i % 2) * 3.50
        y = 1.40 + (i // 2) * 1.12
        card(slide, x, y, 3.16, 0.92, head, body, fill=PALE_BLUE if i % 2 == 0 else PALE_GOLD, line_color=BLUE if i % 2 == 0 else GOLD, body_size=18, heading_size=18, name="Ledger field")
    text_box(slide, 5.38, 5.02, 6.82, 0.48, "source 不同，不能只比較 J。", 21, bold=True, color=RED, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Ledger source boundary", italic_code=False)
    stamp(slide)


def draw_provider(slide, assets):
    lead(slide, "provider ↔ endpoint：兩層 evidence 各自有 identity")
    picture(slide, assets["provider"], 0.70, 1.28, 5.60, 3.92, name="Provider evidence")
    card(slide, 6.72, 1.28, 5.54, 3.92, "IMPORTED ENDPOINT RESULT", "source／run identity\nsummary／replay／ledger\nendpoint scope\ncanonical parity：待補", fill=PALE_TEAL, line_color=TEAL, body_size=23, heading_size=19, name="Endpoint boundary")
    connector(slide, 6.34, 3.24, 6.64, 3.24, color=NAVY, width=1.7, arrow=False)
    text_box(slide, 0.98, 5.28, 11.30, 0.34, "Evidence view：目前記錄 503 MODQN bundle requests 與 WebGL／GLTF warnings；provider browser status：待補。", 18, bold=True, color=RED, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Provider warning", italic_code=False)
    stamp(slide)


def draw_controls(slide, assets):
    lead(slide, "Workbook controls：任務紀錄、證據鎖定與 recovery 要分開")
    picture(slide, assets["workbook"], 0.70, 1.28, 4.22, 3.86, name="Workbook controls evidence")
    controls = [("依課程簡報填寫完整證據學習單", "展開 workbook；答案驗證另由 evidence gate 處理", BLUE, PALE_BLUE), ("開啟 Leo 任務紀錄", "展開 task 1–10", PURPLE, PALE_PURPLE), ("檢查證據並繼續", "檢查目前段落，解鎖下一段", TEAL, PALE_TEAL), ("證據已鎖定", "保存段落；scientific parity 另行驗證", GOLD, PALE_GOLD)]
    for i, (head, body, color, fill) in enumerate(controls):
        x = 5.22 + (i % 2) * 3.52
        y = 1.38 + (i // 2) * 1.72
        card(slide, x, y, 3.18, 1.36, head, body, fill=fill, line_color=color, body_size=18, heading_size=18, name="Workbook current control")
    text_box(slide, 5.20, 4.92, 6.88, 0.50, "task ✓ 是保存狀態；仍要回到 result、replay、service 與因果句。", 20, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Task lock boundary", italic_code=False)
    stamp(slide)


def draw_recovery(slide, assets):
    lead(slide, "rejection／recovery：fail closed，原 session 不悄悄變動")
    picture(slide, assets["prepare"], 0.70, 1.30, 4.16, 3.74, name="Fallback environment evidence")
    paths = [("格式／schema", "保留錯誤 → 對照 contract", BLUE, PALE_BLUE), ("identity／lineage", "回 matching artifact", PURPLE, PALE_PURPLE), ("immutable duplicate", "停止重按 → 保留 session", RED, PALE_RED), ("provider 503", "保留 warning，不稱 browser PASS", GOLD, PALE_GOLD)]
    for i, (head, body, color, fill) in enumerate(paths):
        x = 5.22 + (i % 2) * 3.50
        y = 1.38 + (i // 2) * 1.62
        card(slide, x, y, 3.18, 1.26, head, body, fill=fill, line_color=color, body_size=18, heading_size=18, name="Recovery branch")
    text_box(slide, 5.22, 4.90, 6.76, 0.52, "Recovery：保留原始錯誤與 path；matching artifact、release backup 或 matching fallback 提供回復，surprise provenance 維持原值。", 19, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Recovery rule", italic_code=False)
    stamp(slide)


def draw_ready(slide, assets):
    lead(slide, "Prepare：READY 是 browser-local record；run proof 由 runner receipt 定義")
    picture(slide, assets["ready"], 0.70, 1.22, 6.12, 3.94, name="READY current screen")
    card(slide, 7.08, 1.22, 5.30, 1.64, "記錄 READY", "只記錄 terminal 已看見 machine-readable READY\nLeo 沒有執行／驗證 Python", fill=PALE_TEAL, line_color=TEAL, body_size=20, heading_size=19, name="READY semantics")
    card(slide, 7.08, 3.06, 5.30, 1.64, "記錄備用環境", "誠實標示 setup／verify 無法完成\n改走 same-scenario fallback", fill=PALE_GOLD, line_color=GOLD, body_size=20, heading_size=19, name="Fallback semantics")
    text_box(slide, 0.96, 5.34, 11.30, 0.38, "READY 語義：browser-local terminal receipt record；setup／verify／run／upload 與 result.json 由 terminal runner receipts 定義，Lab gate 另行判讀。", 20, bold=True, color=RED, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="READY boundary", italic_code=False)
    stamp(slide)


def draw_nav(slide):
    lead(slide, "全站 nav／language／fallback loader：只改焦點與來源")
    nav = [("直接前往操作區", "跳到工作台", BLUE, PALE_BLUE), ("返回 Leo 首頁", "離開課程區", PURPLE, PALE_PURPLE), ("繁中／EN", "切換語言", TEAL, PALE_TEAL), ("準備", "看 setup／READY 狀態", GOLD, PALE_GOLD)]
    x = 0.76
    for head, body, color, fill in nav:
        card(slide, x, 1.42, 2.74, 1.42, head, body, fill=fill, line_color=color, body_size=19, heading_size=18, name="Global nav control")
        x += 3.02
    sections = [("實驗 A／B／C", "切換 workbench"), ("證據", "provider／endpoint boundary"), ("學習單", "checkpoint／export／reopen"), ("載入下一筆備用資料", "依順序載入，不挑 best")]
    x = 0.76
    for head, body in sections:
        card(slide, x, 3.28, 2.74, 1.42, head, body, fill=CREAM, line_color=NAVY, body_size=19, heading_size=18, name="Course nav control")
        x += 3.02
    text_box(slide, 1.00, 5.10, 11.28, 0.52, "各 gate 仍由 identity／service 與 runner receipt 定義；切頁、切語言、載入 fallback 屬畫面狀態，Python 執行屬 terminal runner。", 20, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Navigation boundary", italic_code=False)
    stamp(slide)


def draw_tasks(slide):
    lead(slide, "Task 1–10：解鎖課程段落，不代替 runner")
    for i in range(10):
        x = 0.74 + (i % 5) * 2.42
        y = 1.42 + (i // 5) * 1.08
        color = TEAL if i < 4 else BLUE if i < 7 else PURPLE
        fill = PALE_TEAL if i < 4 else PALE_BLUE if i < 7 else PALE_PURPLE
        card(slide, x, y, 2.18, 0.84, f"Task {i + 1}", "disabled → ✓ 保存", fill=fill, line_color=color, body_size=18, heading_size=18, name="Task lock")
    card(slide, 0.92, 3.96, 5.48, 1.02, "檢查證據並繼續", "檢查目前段落條件，通過才解鎖下一段", fill=PALE_GOLD, line_color=GOLD, body_size=20, heading_size=18, name="Check evidence button")
    card(slide, 6.72, 3.96, 5.48, 1.02, "證據已鎖定", "保存完成段落，不等於 scientific parity", fill=PALE_PURPLE, line_color=PURPLE, body_size=20, heading_size=18, name="Evidence locked button")
    text_box(slide, 1.04, 5.30, 11.20, 0.36, "✓ 表示段落保存；service／deadline、runner、replay 與策略 verdict 由各自 evidence 定義。", 19, bold=True, color=RED, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Task boundary", italic_code=False)
    stamp(slide)


def draw_provider_controls(slide, assets):
    lead(slide, "provider replay controls：各自移動，各自保留 frame identity")
    picture(slide, assets["timeline"], 0.78, 1.26, 11.68, 0.86, name="Provider replay timeline")
    controls = [("播放結果", "provider replay play", TEAL, PALE_TEAL), ("暫停重播", "pause", PURPLE, PALE_PURPLE), ("slider", "選 provider frame", BLUE, PALE_BLUE), ("←", "上一畫面", GOLD, PALE_GOLD), ("下一個畫面 →", "下一 provider frame", RED, PALE_RED)]
    x = 0.70
    for head, body, color, fill in controls:
        card(slide, x, 2.50, 2.28, 1.20, head, body, fill=fill, line_color=color, body_size=18, heading_size=18, name="Provider replay control")
        x += 2.40
    card(slide, 0.86, 4.18, 5.46, 1.12, "endpoint frame selector", "八欄＋queue＋event 跟著 endpoint frame 更新", fill=PALE_TEAL, line_color=TEAL, body_size=20, heading_size=18, name="Endpoint replay control")
    card(slide, 6.70, 4.18, 5.46, 1.12, "system replay timeline", "provider context；endpoint time：獨立 frame identity", fill=PALE_GOLD, line_color=GOLD, body_size=20, heading_size=18, name="System replay control")
    stamp(slide)


def draw_control_contract(slide):
    lead(slide, "current /course controls：動作、讀寫、成功變化與失敗不變項")
    groups = [
        ("Prepare｜準備控制", "開啟 GitHub 課程套件：讀 repository／README，寫 browser focus；成功開啟套件，失敗保持 Prepare。\n記錄 READY：讀 terminal receipt，寫 browser-local status；成功顯示已就緒，失敗保留原 status。\n記錄備用環境：讀 fallback choice，寫 browser-local source；驗證失敗時原 source 不變。", BLUE, PALE_BLUE),
        ("導覽／fallback｜頁面控制", "直接前往操作區、返回 Leo 首頁、繁中／EN：讀 navigation state，寫 focus／language；成功更新畫面，失敗保留目前頁。\n準備、實驗 A／B／C、證據、學習單：讀 section state，寫 route；成功切換工作台，失敗保留 current section。\n載入下一筆備用資料：讀 experiment order，寫 selected fallback；identity 不符時原 result 保持。", PURPLE, PALE_PURPLE),
        ("Workbook｜保存控制", "建立／恢復存檔點：讀 prediction、hash、role、source，寫 checkpoint；成功更新 checkpoint #，驗證失敗保留原 workbook。\n重設本機進度／復原重設：讀 local progress，寫 reset state；成功改變本機紀錄，失敗保留原 progress。\n匯出／重新開啟學習單：讀 workbook lineage，寫 exported file／reopened state；identity 不符時原 workbook 不變。", TEAL, PALE_TEAL),
        ("Replay／Task｜事件與段落控制", "播放結果／暫停重播、slider、上一畫面、下一個畫面：讀 provider frame sequence，寫 playback cursor；成功更新 provider frame，失敗維持原 cursor。\nendpoint selector／無線電接觸時間軸：讀 endpoint frames，寫 selected frame／toggle；成功更新八欄、queue、event，失敗維持原 frame。\n任務 1–10、檢查證據並繼續、證據已鎖定：讀 task evidence，寫 completion／lock；條件不足時原 task 與 workbook 維持。", GOLD, PALE_GOLD),
    ]
    for i, (head, body, color, fill) in enumerate(groups):
        x = 0.72 + (i % 2) * 6.28
        y = 1.32 + (i // 2) * 2.28
        card(slide, x, y, 5.82, 2.02, head, body, fill=fill, line_color=color, body_size=18, heading_size=18, align=PP_ALIGN.LEFT, name="Control contract group")
    stamp(slide)


def draw_page(slide, p: Page, assets: dict[str, Path]) -> None:
    set_title(slide, f"P{p.number:03d}｜{p.title}")
    clear_placeholders(slide)
    if p.kind == "hero": draw_hero(slide)
    elif p.kind == "original": draw_original(slide)
    elif p.kind == "run1": draw_run(slide, False)
    elif p.kind == "run2": draw_run(slide, True)
    elif p.kind == "edit5": draw_edit(slide, "5", "20", "第一次 exact edit")
    elif p.kind == "edit30": draw_edit(slide, "30", "5", "第二次 exact revision")
    elif p.kind == "predict5": draw_prediction(slide, "5")
    elif p.kind == "predict30": draw_prediction(slide, "30")
    elif p.kind == "compare2": draw_compare2(slide)
    elif p.kind == "compare3": draw_compare3(slide)
    elif p.kind == "surprise": draw_surprise(slide)
    elif p.kind == "gate": draw_gate(slide)
    elif p.kind == "website": draw_website(slide)
    elif p.kind == "import": draw_import(slide, assets)
    elif p.kind == "replay": draw_replay(slide)
    elif p.kind == "workbook": draw_workbook(slide)
    elif p.kind == "save": draw_save(slide)
    elif p.kind == "farm": draw_transfer(slide, "智慧農場")
    elif p.kind == "hvac": draw_transfer(slide, "HVAC")
    elif p.kind == "edge": draw_transfer(slide, "edge inference")
    elif p.kind == "exit": draw_exit(slide)
    elif p.kind == "source": draw_source(slide, assets)
    elif p.kind == "summary": draw_summary(slide, assets)
    elif p.kind == "fields": draw_fields(slide, assets)
    elif p.kind == "fields2": draw_fields2(slide, assets)
    elif p.kind == "queue": draw_queue(slide, assets)
    elif p.kind == "timeline": draw_timeline(slide, assets)
    elif p.kind == "ledger": draw_ledger(slide, assets)
    elif p.kind == "provider": draw_provider(slide, assets)
    elif p.kind == "controls": draw_controls(slide, assets)
    elif p.kind == "recovery": draw_recovery(slide, assets)
    elif p.kind == "ready": draw_ready(slide, assets)
    elif p.kind == "nav": draw_nav(slide)
    elif p.kind == "tasks": draw_tasks(slide)
    elif p.kind == "provider_controls": draw_provider_controls(slide, assets)
    elif p.kind == "control_contract": draw_control_contract(slide)
    else:
        raise ValueError(f"unknown page kind: {p.kind}")
    if FORBIDDEN in p.notes or MINUTE_RE.search(p.notes):
        raise ValueError(f"P{p.number:03d}: forbidden note content")
    slide.notes_slide.notes_text_frame.text = sanitize_text(p.notes)


def remove_all_slides(prs: Presentation) -> None:
    ids = prs.slides._sldIdLst
    for item in list(ids):
        prs.part.drop_rel(item.rId)
        ids.remove(item)


def overlay_template_parts(path: Path) -> None:
    """Restore the exact template-owned master/layout/theme/media parts."""
    with zipfile.ZipFile(TEMPLATE) as source, zipfile.ZipFile(path, "r") as old:
        data = {info.filename: old.read(info.filename) for info in old.infolist()}
        infos = {info.filename: copy.copy(info) for info in old.infolist()}
        owned_prefixes = ("ppt/slideLayouts/", "ppt/slideMasters/", "ppt/theme/", "ppt/media/", "ppt/notesMasters/")
        for info in source.infolist():
            if info.filename.startswith(owned_prefixes):
                data[info.filename] = source.read(info.filename)
                infos[info.filename] = copy.copy(info)
    overlay = path.with_suffix(".overlay.pptx")
    with zipfile.ZipFile(overlay, "w", zipfile.ZIP_DEFLATED) as out:
        for name, payload in data.items():
            out.writestr(infos[name], payload)
    overlay.replace(path)


def ensure_dirs() -> None:
    for folder in ("sources", "assets", "analysis", "exports", "renders", "qa", "validation"):
        (PROJECT / folder).mkdir(parents=True, exist_ok=True)


def validate_pages() -> None:
    expected = list(range(64, 98))
    actual = [p.number for p in PAGES]
    if actual != expected:
        raise ValueError(f"page sequence mismatch: {actual}")
    for p in PAGES:
        if FORBIDDEN in (p.title + p.notes) or MINUTE_RE.search(p.title + p.notes):
            raise ValueError(f"P{p.number:03d}: forbidden visible content")
        if len(re.findall(r"[。！？!?]", p.notes)) < 2:
            raise ValueError(f"P{p.number:03d}: notes need at least two sentences")


def shape_text(slide) -> str:
    values = []
    for shape in slide.shapes:
        if hasattr(shape, "text") and shape.text:
            values.append(shape.text)
    return "\n".join(values)


def structural_qa(prs: Presentation) -> dict:
    errors: list[str] = []
    authored_shapes = 0
    small_text: list[str] = []
    all_notes: list[str] = []
    for index, slide in enumerate(prs.slides, start=1):
        layout_part = str(slide.slide_layout.part.partname)
        if not layout_part.endswith("/slideLayouts/slideLayout2.xml"):
            errors.append(f"slide {index}: non-native content shell {layout_part}")
        if not slide.notes_slide.notes_text_frame.text.strip():
            errors.append(f"slide {index}: missing notes")
        all_notes.append(slide.notes_slide.notes_text_frame.text)
        for shape in slide.shapes:
            if shape.is_placeholder:
                continue
            if hasattr(shape, "text") and shape.text:
                authored_shapes += 1
                if FORBIDDEN in shape.text or MINUTE_RE.search(shape.text) or FORMAL_RE.search(shape.text):
                    errors.append(f"slide {index}: forbidden visible text")
                if shape.top / 914400 + shape.height / 914400 > CONTENT_BOTTOM + 0.02:
                    errors.append(f"slide {index}: authored shape crosses content bottom: {shape.name}")
                for paragraph in shape.text_frame.paragraphs:
                    for run in paragraph.runs:
                        if run.font.size and run.font.size.pt < 18:
                            small_text.append(f"slide {index}:{shape.name}:{run.font.size.pt}")
    errors.extend(f"notes {i}: forbidden" for i, note in enumerate(all_notes, start=1) if FORBIDDEN in note or MINUTE_RE.search(note) or FORMAL_RE.search(note))
    return {"status": "PASS" if not errors and not small_text else "FAIL", "slides": len(prs.slides), "authored_text_shapes": authored_shapes, "errors": errors, "small_authored_text": small_text}


def render_deck() -> dict:
    pdf = RENDER_DIR / (EXPORT.stem + ".pdf")
    for old in RENDER_DIR.glob("*.pdf"):
        old.unlink()
    lo_profile = Path(tempfile.mkdtemp(prefix="c120-partc-lo-"))
    subprocess.run(["python3", str(OFFICE_HELPER), "-env:UserInstallation=file://" + str(lo_profile), "--headless", "--convert-to", "pdf:impress_pdf_Export", "--outdir", str(RENDER_DIR), str(EXPORT)], check=True, capture_output=True, text=True)
    subprocess.run(["pdftoppm", "-png", "-r", "120", str(pdf), str(RENDER_DIR / "slide")], check=True, capture_output=True, text=True)
    renders = sorted(RENDER_DIR.glob("slide-*.png"))
    contact_dir = RENDER_DIR / "contact-sheets"
    contact_dir.mkdir(exist_ok=True)
    for old in contact_dir.glob("*.png"):
        old.unlink()
    thumbs = []
    for path in renders:
        image = Image.open(path).convert("RGB")
        image.thumbnail((320, 180))
        canvas = Image.new("RGB", (340, 210), "white")
        canvas.paste(image, ((340 - image.width) // 2, 8))
        draw = ImageDraw.Draw(canvas)
        draw.text((12, 190), path.stem, fill=(30, 30, 30))
        thumbs.append(canvas)
    columns = 4
    rows = (len(thumbs) + columns - 1) // columns
    sheet = Image.new("RGB", (columns * 340, rows * 210), (235, 237, 241))
    for i, image in enumerate(thumbs):
        sheet.paste(image, ((i % columns) * 340, (i // columns) * 210))
    contact = contact_dir / "contact-sheet-all.png"
    sheet.save(contact)
    return {"status": "PASS", "pdf": str(pdf), "slides_rendered": len(renders), "contact_sheet": str(contact), "fix_and_rerender_pass": "PENDING_HUMAN_INSPECTION"}


def write_reports(report: dict, visual: dict) -> None:
    manifest = {"schema": "c120-direct-teaching-part-c-v1", "pages": [{**asdict(p), "title": sanitize_text(p.title), "notes": sanitize_text(p.notes)} for p in PAGES], "template": str(TEMPLATE), "source": str(SOURCE_MD), "field_contract": str(FIELD_MD), "evidence_boundary": BOUNDARY, "current_upload": {"experiment": "A", "case": "baseline", "source": "實際執行", "run_id": RUN_ID, "service": "FAIL", "energy_j": 6.92, "delivered_bits": 4800, "bit_per_j": 693.641618}}
    (ANALYSIS_DIR / "content-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (VALIDATION_DIR / "structural-qa.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (QA_DIR / "visual-qa.json").write_text(json.dumps(visual, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (PROJECT / "sources/part-c-visible-content.md").write_text(SOURCE_MD.read_text(encoding="utf-8"), encoding="utf-8")
    shutil.copy2(FIELD_MD, PROJECT / "sources/field-interpretation.md")
    shutil.copy2(TEMPLATE, PROJECT / "sources/educate.pptx")
    note_lines = [f"P{p.number:03d}｜{sanitize_text(p.title)}\n{sanitize_text(p.notes)}" for p in PAGES]
    (PROJECT / "sources/speaker-notes.md").write_text("\n\n".join(note_lines) + "\n", encoding="utf-8")
    (VALIDATION_DIR / "readback.txt").write_text(f"slides={report['slides']}\nstatus={report['status']}\nrendered={visual.get('slides_rendered', 0)}\n", encoding="utf-8")

    body_by_kind = {
        "hero": "Queue age、deadline/freshness 與 endpoint J 的 gate-first 因果鏈。",
        "original": "student_policy.py 的窗口、urgent、pacing、batch、wait branch 與 action 對照。",
        "run1": "baseline 與 candidate 的 compact run、stdout result_path 與 artifact receipt。",
        "edit5": "URGENT_MARGIN_S 由 20 改為 5 的單一 exact edit 與可觀察後果。",
        "predict5": "margin 5 的機制預測與 queue、packet、service、deadline、state 證據位置。",
        "compare2": "baseline/candidate 的 delivered bits、endpoint J、bit/J 與 service/deadline gate。",
        "edit30": "URGENT_MARGIN_S 由 5 改為 30 的單一 revision 與服務取捨。",
        "predict30": "margin 30 的可反駁預測：較早 action、service gate 與 endpoint energy。",
        "run2": "revision freeze 與 surprise withheld 的 exact commands、policy lineage 與 result_path。",
        "compare3": "before、after、revision 的同情境比較；先 gate、後 endpoint J。",
        "surprise": "frozen policy 在新 service condition 下的 withheld 反例與 claim ceiling。",
        "gate": "service、deadline、delivery、endpoint J 的 gate-first 讀法。",
        "website": "terminal runner、import gate、Leo replay 與 workbook 的責任邊界。",
        "import": "source、schema、identity、units、lineage、import state 的匯入驗證順序。",
        "replay": "endpoint frame selector、八個 replay fields、queue、event、timeline 與 branch。",
        "workbook": "prediction、result/replay lineage、source、role、service 與 checkpoint 的保存。",
        "save": "建立/恢復 checkpoint、reset/undo、export/reopen 的本機紀錄責任。",
        "farm": "智慧農場 transfer：灌溉告警、service gate 與泵浦 endpoint J。",
        "hvac": "HVAC transfer：舒適/設備 deadline、service condition 與能源差異。",
        "edge": "edge inference transfer：freshness、任務完成與 scoped endpoint Joule。",
        "exit": "可移植的 condition → branch → event → service evidence → scoped energy 因果句。",
        "source": "current /course 的 actual upload 與 same-scenario fallback 來源分界。",
        "summary": "current /course 的服務、已送達資料、端點能量 J、端點 bit/J 讀取順序。",
        "fields": "current /course frame selector 與 Radio、Action、queue、J、elapsed、Contact、Quality 欄位。",
        "queue": "current /course queue 與 packet event 的 frame-by-frame 因果追查。",
        "timeline": "current /course radio/contact timeline 與 student_policy.py branch 對照。",
        "ledger": "current /course execution ledger 的 experiment、case、role、service、source 與 identity。",
        "provider": "LEO provider context 與 imported endpoint result 的兩層 evidence boundary。",
        "controls": "current /course workbook、task record、checkpoint、證據鎖定與復原控制。",
        "recovery": "format/identity/lineage/duplicate rejection 與 fail-closed recovery 路徑。",
        "ready": "Prepare 的 READY 與 fallback browser-local record，及 terminal runner receipt 邊界。",
        "nav": "全站導覽、語言、實驗、證據、學習單與 fallback loader 的狀態變化。",
        "tasks": "Task 1–10、檢查證據並繼續、證據已鎖定的段落保存語義。",
        "provider_controls": "provider replay controls 與 endpoint frame selector 的分層時間軸。",
    }
    donor_by_number = {}
    for p in PAGES:
        if 77 <= p.number <= 88:
            source = "donor-analysis/donor-insertion-map.md:P077-P088 import/recovery；native redraw"
        elif 89 <= p.number <= 93:
            source = "donor-analysis/donor-insertion-map.md:P089-P093 evidence clinic；native redraw"
        elif 94 <= p.number <= 96:
            source = "donor-analysis/donor-insertion-map.md:P094-P096 transfer/hypothesis；native redraw"
        elif p.number == 97:
            source = "donor-analysis/donor-insertion-map.md:P089-P093 evidence clinic；replay-control adaptation"
        else:
            source = "none｜Part C contract and current authority; no donor asset"
        donor_by_number[p.number] = source
    slides = []
    for index, p in enumerate(PAGES, start=1):
        if 64 <= p.number <= 75:
            status = "待補：fresh LoRa runner result；deterministic fallback reference only"
        else:
            status = "current browser record／fixture host；待補：LoRa endpoint pixels and runner parity"
        slides.append({
            "order": index,
            "source_page": f"P{p.number:03d}",
            "title": sanitize_text(p.title),
            "body": body_by_kind.get(p.kind, p.kind),
            "layout": "slideLayout2.xml",
            "notes": sanitize_text(p.notes),
            "evidence_status": status,
            "donor_source": donor_by_number[p.number],
        })
    (OWNED / "slides.json").write_text(json.dumps({
        "schema": "c120-part-c-slides-v1",
        "template": str(TEMPLATE),
        "template_shell": "source slide 2 / slideLayout2.xml only",
        "evidence_boundary": BOUNDARY,
        "slides": slides,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build(skip_render: bool = False) -> dict:
    validate_pages()
    ensure_dirs()
    assets = make_assets()
    prs = Presentation(str(TEMPLATE))
    remove_all_slides(prs)
    for index, p in enumerate(PAGES):
        # Every slide clones the native content shell from educate.pptx source
        # slide 2 (slideLayout2.xml).  Internal diagrams vary; the shell does
        # not, so the prohibited cover/middle-line shell cannot leak in.
        slide = prs.slides.add_slide(prs.slide_layouts[1])
        draw_page(slide, p, assets)
    EXPORT.parent.mkdir(parents=True, exist_ok=True)
    prs.save(EXPORT)
    overlay_template_parts(EXPORT)
    reopened = Presentation(str(EXPORT))
    report = structural_qa(reopened)
    visual = {"status": "SKIPPED", "slides_rendered": 0}
    if not skip_render:
        visual = render_deck()
    write_reports(report, visual)
    return {"output": str(EXPORT), "slides": len(PAGES), "qa": report, "visual": visual}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-render", action="store_true")
    args = parser.parse_args()
    result = build(skip_render=args.skip_render)
    print(json.dumps({"output": result["output"], "slides": result["slides"], "qa_status": result["qa"]["status"], "rendered": result["visual"].get("slides_rendered", 0)}, ensure_ascii=False, indent=2))
    return 0 if result["qa"]["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
