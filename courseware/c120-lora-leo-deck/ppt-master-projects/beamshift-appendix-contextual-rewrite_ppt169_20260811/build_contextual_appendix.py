#!/usr/bin/env python3
"""Build a contextual P098-P116 appendix from educate slideLayout2.

The current appendix is intentionally regenerated rather than patched.  The
native educate master, layout, theme, logo, footer, and background remain the
visual authority.  All authored content uses editable PowerPoint text and
vector shapes.  The endpoint-energy equation is reserved for a later native
Office Math insertion pass.
"""

from __future__ import annotations

import copy
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE, MSO_CONNECTOR, MSO_SHAPE_TYPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt
from pptx.oxml.ns import qn


ROOT = Path(__file__).resolve().parent
TEMPLATE = Path("/home/u24/ppt-master/template/educate.pptx")
EXPORTS = ROOT / "exports"
VALIDATION = ROOT / "validation"
PREVIEW = EXPORTS / "LoRaEnergySim-LEO-BeamShift-Appendix-CONTEXTUAL-PREVIEW.pptx"
OMML_SOURCE = EXPORTS / "LoRaEnergySim-LEO-BeamShift-Appendix-CONTEXTUAL-OMML-SOURCE.pptx"
SOURCE_MAP = VALIDATION / "appendix-source-map.json"
BUILD_REPORT = VALIDATION / "build-report.json"
EQUATION_TOOL = Path("/home/u24/demo/leo-beam-sim/courseware/c120-lora-leo-deck/insert-native-equations.py")

CJK_FONT = "標楷體"
LATIN_FONT = "Times New Roman"
NAVY = RGBColor(47, 50, 127)
TEAL = RGBColor(0, 105, 112)
SLATE = RGBColor(68, 75, 86)
INK = RGBColor(25, 28, 34)
MID = RGBColor(92, 98, 108)
PALE_BLUE = RGBColor(238, 241, 249)
PALE_TEAL = RGBColor(232, 244, 244)
PALE_GRAY = RGBColor(245, 246, 248)
WHITE = RGBColor(255, 255, 255)

LATIN_RE = re.compile(r"([A-Za-z0-9_./:+\-]+)")
ITALIC_TOKENS = {
    "source_id", "epoch", "scenario", "seed", "window", "units", "predecessor",
    "observation", "quality", "quality_band", "policy", "action", "state", "service",
    "throughput", "delivered_bits", "service_pass", "deadline", "freshness",
    "endpoint_energy_j", "energy", "radio", "packet", "queue", "result_path", "run_id",
    "ENTER_QUALITY", "EXIT_QUALITY", "STABLE_STEPS", "BATCH_SIZE", "URGENT_MARGIN_S",
    "WAIT", "SLEEP", "WAKE", "SEND_READY", "student_policy.py",
}
FORBIDDEN = ("學生", "老師", "講師", "全班", "你", "分鐘", "minutes", "sha256", "SHA256", "SHA")


SLIDES = [
    {
        "id": "P098",
        "title": "這份附錄處理哪些問題",
        "lead": "主流程出現來源、策略、結果或網站欄位疑問時，依問題進入對應頁面。\n每一列列出問題類型與頁碼，不必依序閱讀整份附錄。",
        "kind": "entry",
        "notes": "這份附錄不是另一套衛星課程，而是主流程的查閱索引。情境來源不清楚時，進入來源與服務視窗；程式修改與結果無法連結時，進入策略與證據鏈；網站欄位不清楚時，進入匯入與 READY；完成查閱後，依最後一頁返回原本的實驗或操作。",
        "donor": "donor disposition map；current ADR-004／SDD",
    },
    {
        "id": "P099",
        "title": "從服務視窗到端點結果的完整鏈",
        "lead": "LEO 提供隨時間改變的服務機會；LoRaEnergySim 負責端點策略、狀態、服務與能量結果。\n閱讀方向為來源、視窗、observation、policy、action／state、服務與能量。",
        "kind": "causal",
        "notes": "LEO 在本課程中只是一個 changing-service-window 範例。固定來源與時間形成服務視窗，視窗內的 observation 交給 student_policy.py 產生 action，runner 再把 action 轉為 radio state、packet outcome、service 與 endpoint energy。後面的技術頁都在補充這條鏈上的一個節點，不會改變 LoRaEnergySim 是主體的課程定位。",
        "donor": "e2 2、4–6、38–39；ADR-004",
    },
    {
        "id": "P100",
        "title": "情境資料從哪裡開始",
        "lead": "CURRENT SOURCE 尚未凍結；本頁只界定 claim ceiling，不提供可執行 TLE。\nsource_id、epoch 與兩行原始資料只用於後續模型輸入追查。",
        "kind": "source",
        "notes": "情境追查從固定來源開始。source_id 指向本次 scenario 使用的來源紀錄，epoch 表示軌道元素的基準時刻，原始兩行文字保留模型輸入。此頁只建立來源與情境的連結；目前來源畫面尚未凍結，因此使用明示 placeholder，待 current evidence 凍結後更新來源字串。",
        "donor": "e2 7 或 98；duplicate opening deduplicated",
    },
    {
        "id": "P101",
        "title": "固定來源如何形成服務視窗",
        "lead": "來源資料經過時間推進與座標轉換，形成地面位置所見的仰角、方位與距離。\n流程左側是模型輸入，中段是推導，右側是策略使用的服務機會。",
        "kind": "window_flow",
        "notes": "TLE 或 GP 提供固定來源，scenario clock 提供目標時間，SGP4 產生該時刻的模型狀態。TEME 到 ECEF 再到 ENU 的轉換，把模型狀態連結到指定地面位置。最後得到的 elevation、azimuth 與 range 用於描述服務機會；這些欄位仍是模型推導，不是封包送達或服務通過。",
        "donor": "e2 8–10、107–109",
    },
    {
        "id": "P102",
        "title": "可見、品質合格與完成服務是三個層次",
        "lead": "通過仰角條件只表示幾何可見；完成資料工作仍需品質與服務證據。\n判讀順序固定為幾何可見、品質情境，再確認封包與期限是否完成。",
        "kind": "layers",
        "notes": "第一層處理幾何可見性，例如 elevation 與 range。第二層處理 quality observation，表示策略在決策時取得的品質情境。第三層處理 packet delivery、deadline、freshness 與 service_pass。三層分開保存，避免以單一角度或 quality 欄位替代實際服務結果。",
        "donor": "e2 5、11、30–31、110–111",
    },
    {
        "id": "P103",
        "title": "quality 欄位如何影響策略分支",
        "lead": "Lab B 讀取同一型別的 quality observation 與門檻，產生進入、維持或退出的 action。\n門檻修改直接影響 action 與 state transition；service 與 endpoint energy 是後續結果。",
        "kind": "quality_decision",
        "notes": "quality 是決策當下的 observation，不是送達位元或能量結果。ENTER_QUALITY 決定何時進入 send-ready 狀態，EXIT_QUALITY 決定何時退出，STABLE_STEPS 抑制短時間擺動。修改 student_policy.py 後，檢查順序為 action、state transition、service 與 endpoint energy；quality 本身不直接代表節能。",
        "donor": "e2 13、15、22–24；current Lab B policy API",
    },
    {
        "id": "P104",
        "title": "速率、送達量與服務判定各自代表什麼",
        "lead": "三個欄位分別描述傳輸過程、完成工作量與應用條件，不能互相替代。\nthroughput 是速率、delivered_bits 是完成量、service_pass 是條件判定。",
        "kind": "service_timeline",
        "notes": "throughput 描述指定區間的傳輸速率，單位是 bit/s。delivered_bits 累積符合送達定義的資料量，單位是 bit。service_pass 另外檢查 deadline、freshness 或其他服務條件。網站同時呈現這三類欄位，是為了避免把高傳輸速率直接解讀成工作已完成。",
        "donor": "e2 14、32、37",
    },
    {
        "id": "P105",
        "title": "狀態停留時間如何累積為端點能量",
        "lead": "每個 endpoint state 的功率乘以停留時間，再於相同邊界內加總。\n核對順序為各狀態功率、停留時間、加總結果與 endpoint 範圍。",
        "kind": "energy_formula",
        "notes": "公式的 LaTeX source 為 E_{\\mathrm{endpoint}} = \\sum_{s \\in S} P_s t_s。P_s 是狀態 s 的功率，單位為 W；t_s 是該狀態的停留時間，單位為 s；乘積與加總得到 endpoint energy，單位為 J。這個邊界涵蓋課程模型中的 endpoint radio 與 processing，不代表衛星、閘道或整體系統消耗。",
        "donor": "e2 16／17、21、25–29、112；current endpoint boundary",
    },
    {
        "id": "P106",
        "title": "低能量結果的四種判定",
        "lead": "endpoint energy 與 service 必須同時比較；單獨採用較低 J 會遺漏服務損失。\n本課程的節能判定同時要求服務維持與端點能量下降。",
        "kind": "verdict_matrix",
        "notes": "比較順序為 service 狀態與 endpoint energy 變化。服務維持且能量降低，形成 bounded saving result；服務維持但能量上升，表示成本增加；服務下降但能量降低，屬於服務換能量的 trade-off；兩者都變差則是失敗結果。欄位不足時維持 incomplete，不補寫預期值。",
        "donor": "e2 70–75",
    },
    {
        "id": "P107",
        "title": "A／B 比較固定哪些條件",
        "lead": "Baseline 與 candidate 共用 scenario、seed、window、units 與 predecessor，只改 marked policy block。\n固定條件的目的，是讓兩次結果的差異集中在單一策略修改。",
        "kind": "ab_lock",
        "notes": "公平比較的目的，是把差異限制在一個策略修改。scenario 與 seed 固定輸入與 deterministic branch，service window 與 units 固定比較邊界，predecessor 固定 lineage。若 identity 不一致或 artifact 沒有 consequential diff，該次比較不形成有效結果。",
        "donor": "e2 20、36–37、70–75",
    },
    {
        "id": "P108",
        "title": "程式修改後應出現哪些中介證據",
        "lead": "程式差異須依序反映在 action、state、packet／service 與 endpoint energy。\naction 或 state 沒有改變時，後續差異不歸因於這次程式修改。",
        "kind": "evidence_spine",
        "notes": "student_policy.py 的 marked block 是唯一程式修改位置。差異沿 action、radio state 與停留時間傳遞；packet ledger 與 service evaluator 記錄工作結果，endpoint ledger 記錄能量。若程式檔不同但 action 或 state 完全相同，表示修改沒有進入目前觀察的 runtime path。",
        "donor": "e2 38–39；current result／replay contract",
    },
    {
        "id": "P109",
        "title": "Lab A 延伸：WAIT 與 SLEEP 的狀態帳本",
        "lead": "兩種 action 的差異不只在名稱，而在 awake idle、sleep 與 wake transition 的停留時間。\n比較順序為 WAIT、SLEEP、WAKE、TX duration、封包結果與服務結果。",
        "kind": "lab_a",
        "notes": "WAIT 通常保留 awake idle 狀態，後續送出延遲較短，但等待期間持續消耗對應功率。SLEEP 降低休息狀態功率，重新送出前會增加 wake transition。比較時查看 WAIT、SLEEP、WAKE、TX 的 duration，以及 packet delivery、service_pass 與 endpoint_energy_j；結論由同一份 result／replay 提供。",
        "donor": "current Lab A；e2 accounting concept",
    },
    {
        "id": "P110",
        "title": "Lab B 延伸：切換太慢與過度往返",
        "lead": "門檻與 hold 條件同時影響服務連續性、transition 次數與狀態能量。\ntoo-slow 與 ping-pong 是不同失敗機制，須分別從 transition trace 判讀。",
        "kind": "lab_b",
        "notes": "切換太慢時，quality 已下降但策略仍維持原狀態，可能錯過服務機會。條件過度敏感時，A 到 B 再回 A 的往返事件增加，形成額外 transition 與狀態切換成本。Lab B 的重點不是追求最少 transition，而是檢查門檻與 STABLE_STEPS 如何共同影響 continuity、packet outcome、service 與 endpoint energy。",
        "donor": "e2 12；current Lab B",
    },
    {
        "id": "P111",
        "title": "Lab C 延伸：批次與緊急資料",
        "lead": "批次策略減少喚醒與傳送事件，但 deadline 與 urgent packet 限制等待時間。\n批次過小增加喚醒與傳送；批次過大則可能造成 urgent 或 deadline failure。",
        "kind": "lab_c",
        "notes": "一般資料可累積到 batch 條件後再送出，減少 WAKE 與 TX event 次數。urgent packet 或接近 deadline 的資料需要提前送出，避免服務失敗。比較時同時查看 queue depth、packet age、batch action、deadline outcome、service_pass 與 endpoint_energy_j；批次較大不自動代表較佳。",
        "donor": "current Lab C authority",
    },
    {
        "id": "P112",
        "title": "result.json 匯入流程與目前證據邊界",
        "lead": "package root: lora-energy-lab/；browser: http://120.126.151.102:3000/course\n目前畫面尚未匯入結果；下方流程是匯入契約的預期路徑，不代表已完成 live 驗證。",
        "kind": "import_flow",
        "notes": "操作入口是 runner stdout 顯示的 result_path。於 /course 檔案選擇器選取該 result.json；不選 student_policy.py，也不在匯入控制中另外選 endpoint-replay.json。匯入契約要求檢查 scenario、policy identity、version、units 與 event contract；accepted 後預期更新「證據」頁的 result／replay 欄位與「進度備份」的 browser-local A／B／C import records。2026-08-11 14:12 的 current browser evidence 仍為尚未匯入，因此本頁不宣稱 accepted replay 已在 live browser 建立。進度備份只保存 browser-local progress 與匯入紀錄，不重算 runner result；相同 run 目錄內的 endpoint-replay.json 保留作為配對與事件核對證據。驗證失敗時，原有 session、證據與進度備份不變。",
        "donor": "e2 96–97；current SDD import contract",
    },
    {
        "id": "P113",
        "title": "對照 Part C 讀取 /course 欄位",
        "lead": "本頁是欄位閱讀地圖；current /course 真實畫面與逐項說明位於 Part C P085–P099。\n閱讀順序為 identity、來源、service、state／packet、endpoint energy、證據與進度備份。",
        "kind": "course_fields",
        "notes": "這是一張欄位閱讀地圖，不是網站截圖。current /course 的真實截圖、目前 source state、replay fields、ledger、READY 與 controls 位於 Part C P085–P099。閱讀順序為 scenario 與 policy identity、actual run 或 matching fallback 來源、service 與 packet outcome、state duration 與 endpoint energy，以及「證據」頁保存的 identity；「進度備份」只保存 browser-local progress 與 A/B/C import records，不重算 runner result。網站畫面更新時，以 Part C current evidence 頁為準。",
        "donor": "current SDD／browser evidence gate",
    },
    {
        "id": "P114",
        "title": "READY 記錄的目的",
        "lead": "package root: lora-energy-lab/；terminal verify writes READY receipt。\n/course: http://120.126.151.102:3000/course；browser-local READY 與 terminal receipt 分開。",
        "kind": "ready",
        "notes": "Terminal verify 檢查 Python 3.11、package、scenario、policy API 與 schema，並寫入 machine-readable READY receipt。/course 的「記錄 READY」讀取這個前置條件狀態並保存 browser-local 紀錄；按鈕本身不安裝 Python、不執行 verify、不執行 policy，也不產生 result.json。RUN 或 IMPORT 完成後，「證據」頁提供 result、replay、service、state 與 endpoint energy 欄位；「進度備份」只保存 browser-local progress 與 A/B/C import records，不重算 runner result。",
        "donor": "current package readiness contract",
    },
    {
        "id": "P115",
        "title": "資料來源與能量範圍要同時標記",
        "lead": "actual run、matching fallback、simulated／derived 是來源分類；endpoint 與 system 是範圍分類。\n同樣標示為 J 的數值，來源與範圍不同時不放在同一項效率比較。",
        "kind": "scope",
        "notes": "來源分類回答資料如何產生，範圍分類回答數值涵蓋哪一層。LoRaEnergySim result 與 endpoint replay 屬 endpoint authority；Leo 或既有 C-120 provider 的 system fields 屬另一個 authority。兩者即使同為 J，也不能直接互換；任何效率解讀都要固定 numerator、denominator、window 與 scope。",
        "donor": "e2 19–21、96–97、113；ADR-004",
    },
    {
        "id": "P116",
        "title": "依問題返回對應操作頁",
        "lead": "附錄的作用在於補足概念；查閱完成後回到原本的安裝、實驗、匯入或網站判讀。\n依左側問題分類找到說明頁，再由右側連結返回對應的主流程。",
        "kind": "exit",
        "notes": "來源與服務視窗問題返回 P100 到 P102；策略欄位與程式因果問題返回 P103、P107 與三個 Lab 延伸；能量與服務判定問題返回 P104 到 P106 及 P115；JSON 與網站問題返回 P112 到 P114。概念釐清後回到 Part A、Part B 或 Part C 的原操作頁，附錄不另設新的實驗流程。",
        "donor": "donor disposition map；current deck route",
    },
]


def remove_all_slides(prs: Presentation) -> None:
    for slide_id in list(prs.slides._sldIdLst):
        prs.part.drop_rel(slide_id.rId)
        prs.slides._sldIdLst.remove(slide_id)


def _font_xml(run, face: str) -> None:
    r_pr = run._r.get_or_add_rPr()
    for tag, typeface in (("a:latin", LATIN_FONT), ("a:ea", CJK_FONT), ("a:cs", LATIN_FONT)):
        node = r_pr.find(qn(tag))
        if node is None:
            node = r_pr.makeelement(qn(tag), {})
            r_pr.append(node)
        node.set("typeface", typeface)


def _add_run(paragraph, text: str, size: float, *, bold: bool = False,
             italic: bool = False, color: RGBColor = INK) -> None:
    run = paragraph.add_run()
    run.text = text
    is_latin = bool(re.fullmatch(LATIN_RE, text))
    face = LATIN_FONT if is_latin else CJK_FONT
    run.font.name = face
    _font_xml(run, face)
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic or text in ITALIC_TOKENS
    run.font.color.rgb = color


def append_mixed(paragraph, text: str, size: float, *, bold: bool = False,
                 color: RGBColor = INK) -> None:
    for part in [p for p in LATIN_RE.split(text) if p]:
        _add_run(paragraph, part, size, bold=bold, color=color)


def add_mixed(paragraph, text: str, size: float, *, bold: bool = False,
              color: RGBColor = INK) -> None:
    paragraph.text = ""
    append_mixed(paragraph, text, size, bold=bold, color=color)


def add_rich(paragraph, segments, size: float, *, color: RGBColor = INK) -> None:
    paragraph.text = ""
    for segment in segments:
        if isinstance(segment, str):
            append_mixed(paragraph, segment, size, color=color)
            continue
        text, italic, bold, seg_color = segment
        _add_run(paragraph, text, size, italic=italic, bold=bold,
                 color=seg_color or color)


def add_text(slide, x, y, w, h, text, size=24, *, bold=False, color=INK,
             align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP, margin=0.04,
             name=None, fill=None, line=None):
    if name != "Page id":
        size = max(20, size)
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    if name:
        box.name = name
    if fill is not None:
        box.fill.solid()
        box.fill.fore_color.rgb = fill
    else:
        box.fill.background()
    if line is not None:
        box.line.color.rgb = line
        box.line.width = Pt(1.2)
    else:
        box.line.fill.background()
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Inches(margin)
    tf.margin_top = tf.margin_bottom = Inches(margin)
    tf.vertical_anchor = valign
    p = tf.paragraphs[0]
    p.alignment = align
    p.space_before = p.space_after = Pt(0)
    add_mixed(p, text, size, bold=bold, color=color)
    return box


def add_segments(slide, x, y, w, h, segments, size=24, *, align=PP_ALIGN.LEFT,
                 valign=MSO_ANCHOR.TOP, margin=0.04, fill=None, line=None,
                 name=None):
    if name != "Page id":
        size = max(20, size)
    box = add_text(slide, x, y, w, h, "", size, align=align, valign=valign,
                   margin=margin, fill=fill, line=line, name=name)
    add_rich(box.text_frame.paragraphs[0], segments, size)
    return box


def outline(slide, kind, x, y, w, h, color=NAVY, fill=None, radius=False):
    shape = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    if fill is None:
        shape.fill.background()
    else:
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill
    shape.line.color.rgb = color
    shape.line.width = Pt(1.4)
    return shape


def line(slide, x1, y1, x2, y2, color=SLATE, width=1.5, arrow=False):
    shape = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    shape.line.color.rgb = color
    shape.line.width = Pt(width)
    if arrow:
        shape.line.end_arrowhead = True
    return shape


def title_and_lead(slide, spec):
    title = slide.shapes.title
    title.left = Inches(0.68)
    title.top = Inches(0.18)
    title.width = Inches(10.9)
    title.height = Inches(0.58)
    tf = title.text_frame
    tf.clear()
    tf.word_wrap = False
    tf.margin_left = tf.margin_right = 0
    tf.margin_top = tf.margin_bottom = 0
    p = tf.paragraphs[0]
    add_mixed(p, spec["title"], 28, bold=True, color=NAVY)
    add_text(slide, 11.72, 0.27, 0.82, 0.26, spec["id"], 14, color=MID,
             align=PP_ALIGN.RIGHT, valign=MSO_ANCHOR.MIDDLE, name="Page id")
    add_text(slide, 0.76, 1.12, 11.78, 0.62, spec["lead"], 20,
             color=INK, valign=MSO_ANCHOR.MIDDLE, margin=0.01)


def clear_body_placeholder(slide):
    for shape in list(slide.placeholders):
        if shape == slide.shapes.title:
            continue
        if shape.shape_type == MSO_SHAPE_TYPE.PLACEHOLDER:
            shape._element.getparent().remove(shape._element)


def card(slide, x, y, w, h, heading, body, *, accent=NAVY, fill=WHITE,
         heading_size=22, body_size=21, align=PP_ALIGN.LEFT):
    outline(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, x, y, w, h,
            accent, fill)
    add_text(slide, x + 0.20, y + 0.16, w - 0.40, 0.38, heading,
             heading_size, bold=True, color=accent, align=align,
             valign=MSO_ANCHOR.MIDDLE)
    add_text(slide, x + 0.20, y + 0.64, w - 0.40, h - 0.78, body,
             body_size, color=INK, align=align, valign=MSO_ANCHOR.MIDDLE)


def node(slide, x, y, w, h, text, *, accent=NAVY, fill=WHITE, size=21):
    outline(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, x, y, w, h, accent, fill)
    add_text(slide, x + 0.10, y + 0.08, w - 0.20, h - 0.16, text, size,
             bold=True, color=accent, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE)


def draw_entry(slide):
    items = [
        ("情境來源", "TLE、時間、服務視窗", "P100–P102", PALE_BLUE, NAVY),
        ("策略與能量", "quality、state、service、J", "P103–P111", PALE_TEAL, TEAL),
        ("網站與證據", "JSON、欄位、READY、scope", "P112–P115", PALE_GRAY, SLATE),
        ("返回操作", "回到 Part A／B／C 的原頁面", "P116", PALE_BLUE, NAVY),
    ]
    for i, (head, body, pages, fill, accent) in enumerate(items):
        y = 1.92 + i * 1.12
        add_text(slide, 0.92, y, 1.12, 0.74, str(i + 1), 30, bold=True,
                 color=WHITE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
                 fill=accent)
        outline(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, 2.18, y, 10.10, 0.74,
                accent, fill)
        add_text(slide, 2.42, y + 0.08, 2.15, 0.54, head, 23, bold=True,
                 color=accent, valign=MSO_ANCHOR.MIDDLE)
        add_text(slide, 4.58, y + 0.08, 5.55, 0.54, body, 22,
                 valign=MSO_ANCHOR.MIDDLE)
        add_text(slide, 10.28, y + 0.08, 1.66, 0.54, pages, 20, bold=True,
                 color=accent, align=PP_ALIGN.RIGHT, valign=MSO_ANCHOR.MIDDLE)


def draw_causal(slide):
    labels = ["固定來源", "服務視窗", "quality observation", "student_policy.py", "action／state"]
    for i, label in enumerate(labels):
        x = 0.66 + i * 2.43
        label_size = 16.5 if label == "student_policy.py" else (19 if i >= 2 else 21)
        node(slide, x, 2.10, 2.08, 0.82, label,
             accent=TEAL if i in (1, 2) else NAVY,
             fill=PALE_TEAL if i in (1, 2) else PALE_BLUE,
             size=label_size)
        if i < len(labels) - 1:
            line(slide, x + 2.08, 2.51, x + 2.40, 2.51, color=SLATE, arrow=True)
    line(slide, 10.80, 2.92, 10.80, 3.52, color=SLATE, arrow=True)
    card(slide, 1.10, 3.62, 5.22, 1.74, "服務結果",
         "packet delivery、deadline、freshness 與 service_pass",
         accent=TEAL, fill=PALE_TEAL, body_size=21, align=PP_ALIGN.CENTER)
    card(slide, 7.00, 3.62, 5.22, 1.74, "端點能量",
         "radio／processing state duration 累積為 endpoint_energy_j",
         accent=NAVY, fill=PALE_BLUE, body_size=21, align=PP_ALIGN.CENTER)
    add_text(slide, 1.12, 5.65, 11.10, 0.50,
             "LoRaEnergySim 產生兩側結果；LEO 不替代端點 energy model。",
             22, bold=True, color=SLATE, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE)


def draw_source(slide):
    outline(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, 0.88, 1.90, 5.18, 3.84,
            NAVY, PALE_BLUE)
    add_text(slide, 1.15, 2.12, 4.62, 0.44, "CURRENT SOURCE PLACEHOLDER", 20,
             bold=True, color=NAVY, align=PP_ALIGN.CENTER)
    add_text(slide, 1.20, 2.82, 4.52, 1.46,
             "TLE line 1\nTLE line 2\ncurrent source 尚未凍結",
             22, color=SLATE, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE, fill=WHITE, line=SLATE)
    add_text(slide, 1.18, 4.55, 4.60, 0.70,
             "目前來源尚未凍結；欄位保留明示 placeholder。",
             20, color=SLATE, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE)
    rows = [
        ("source_id", "指出 scenario 使用哪一筆固定來源。", TEAL, PALE_TEAL),
        ("epoch", "表示軌道元素的基準時刻。", NAVY, PALE_BLUE),
        ("兩行原始文字", "保留模型輸入，供後續推導與 identity 追查。", SLATE, PALE_GRAY),
    ]
    for idx, (heading, body, accent, fill) in enumerate(rows):
        y = 1.90 + idx * 1.28
        outline(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, 6.55, y, 5.72, 1.02, accent, fill)
        add_text(slide, 6.78, y + 0.14, 1.72, 0.70, heading, 21, bold=True,
                 color=accent, valign=MSO_ANCHOR.MIDDLE)
        add_text(slide, 8.52, y + 0.14, 3.48, 0.70, body, 19,
                 color=INK, valign=MSO_ANCHOR.MIDDLE)


def draw_window_flow(slide):
    labels = ["固定 TLE／GP", "目標時間", "SGP4 狀態", "地面座標", "服務視窗"]
    captions = ["模型輸入", "scenario clock", "position／velocity", "azimuth／elevation／range", "changing opportunity"]
    for i, (label, caption) in enumerate(zip(labels, captions)):
        x = 0.48 + i * 2.54
        node(slide, x, 2.00, 2.15, 0.84, label, accent=TEAL if i == 4 else NAVY,
             fill=PALE_TEAL if i == 4 else PALE_BLUE, size=19)
        add_text(slide, x, 2.94, 2.15, 0.48, caption, 17, color=SLATE,
                 align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE)
        if i < 4:
            line(slide, x + 2.15, 2.42, x + 2.49, 2.42, color=SLATE, arrow=True)
    card(slide, 0.72, 3.62, 3.86, 1.88, "模型推導",
         "位置、速度與方向\n來源、時間、座標系、單位",
         accent=NAVY, fill=PALE_BLUE, body_size=18)
    card(slide, 4.74, 3.62, 3.86, 1.88, "策略輸入",
         "服務視窗／quality observation\n輸入端點策略",
         accent=TEAL, fill=PALE_TEAL, body_size=18)
    card(slide, 8.76, 3.62, 3.86, 1.88, "結果證據",
         "packet／service／endpoint energy\n由 runner 產生",
         accent=SLATE, fill=PALE_GRAY, body_size=18)


def draw_layers(slide):
    layers = [
        ("第一層｜幾何可見", "elevation、azimuth、range", "說明幾何是否可見", NAVY, PALE_BLUE),
        ("第二層｜品質情境", "quality observation", "說明決策時的品質輸入", TEAL, PALE_TEAL),
        ("第三層｜完成服務", "delivery／deadline\nfreshness／service_pass", "說明資料工作是否完成", SLATE, PALE_GRAY),
    ]
    widths = [11.2, 10.0, 9.0]
    for i, (head, fields, answer, accent, fill) in enumerate(layers):
        w = widths[i]
        x = (13.333 - w) / 2
        y = 1.88 + i * 1.22
        outline(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, x, y, w, 1.02, accent, fill)
        add_text(slide, x + 0.22, y + 0.10, 2.62, 0.78, head, 21, bold=True,
                 color=accent, valign=MSO_ANCHOR.MIDDLE)
        add_text(slide, x + 2.88, y + 0.10, 3.42, 0.78, fields, 18.5,
                 valign=MSO_ANCHOR.MIDDLE)
        add_text(slide, x + w - 2.88, y + 0.10, 2.64, 0.78, answer, 18.5,
                 color=SLATE, align=PP_ALIGN.RIGHT, valign=MSO_ANCHOR.MIDDLE)
    add_text(slide, 1.42, 5.70, 10.48, 0.40,
             "仰角通過 ≠ quality 合格 ≠ service 完成",
             24, bold=True, color=NAVY, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE)


def draw_quality_decision(slide):
    node(slide, 0.78, 2.02, 2.58, 0.90, "quality observation", accent=TEAL, fill=PALE_TEAL, size=20)
    line(slide, 3.36, 2.47, 3.82, 2.47, arrow=True)
    node(slide, 3.86, 1.88, 2.90, 1.18, "ENTER／EXIT\n＋ STABLE_STEPS", accent=NAVY, fill=PALE_BLUE, size=20)
    line(slide, 6.76, 2.47, 7.22, 2.47, arrow=True)
    actions = [("進入", "send-ready"), ("維持", "hold"), ("退出", "WAIT／SLEEP")]
    for i, (head, body) in enumerate(actions):
        x = 7.30 + i * 1.82
        card(slide, x, 1.84, 1.62, 1.30, head, body,
             accent=TEAL if i == 1 else NAVY,
             fill=PALE_TEAL if i == 1 else PALE_BLUE,
             heading_size=21, body_size=18, align=PP_ALIGN.CENTER)
    card(slide, 0.82, 3.62, 3.80, 1.55, "策略前",
         "quality 的型別、時間點與門檻型別一致。",
         accent=SLATE, fill=PALE_GRAY, body_size=21)
    card(slide, 4.76, 3.62, 3.80, 1.55, "策略後",
         "action 與 state transition 留下中介證據。",
         accent=TEAL, fill=PALE_TEAL, body_size=21)
    card(slide, 8.70, 3.62, 3.80, 1.55, "結果端",
         "service 與 endpoint energy 另外判定。",
         accent=NAVY, fill=PALE_BLUE, body_size=21)


def draw_service_timeline(slide):
    line(slide, 1.00, 2.55, 12.20, 2.55, color=NAVY, width=2.2)
    positions = [1.65, 6.65, 11.65]
    heads = ["throughput", "delivered_bits", "service_pass"]
    bodies = ["傳輸速率\nbit/s", "已送達工作量\nbit", "應用服務判定\nBoolean＋reason"]
    for i, (x, head, body) in enumerate(zip(positions, heads, bodies)):
        dot = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.OVAL, Inches(x - 0.16), Inches(2.39), Inches(0.32), Inches(0.32))
        dot.fill.solid(); dot.fill.fore_color.rgb = TEAL if i == 1 else NAVY
        dot.line.fill.background()
        card(slide, x - 1.42, 2.94, 2.84, 1.70, head, body,
             accent=TEAL if i == 1 else NAVY,
             fill=PALE_TEAL if i == 1 else PALE_BLUE,
             body_size=21, align=PP_ALIGN.CENTER)
    add_text(slide, 1.10, 5.12, 11.12, 0.70,
             "高 throughput 不保證資料在期限內送達；service_pass 也不等於 energy 較低。",
             22, bold=True, color=SLATE, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE)


def draw_energy_formula(slide, *, preview_formula=False):
    if preview_formula:
        add_segments(
            slide, 1.02, 1.82, 11.30, 1.12,
            [("E", True, False, NAVY), ("endpoint", False, False, NAVY),
             (" = Σ ", False, False, NAVY), ("P", True, False, NAVY),
             ("s", True, False, NAVY), (" ", False, False, NAVY),
             ("t", True, False, NAVY), ("s", True, False, NAVY)],
            30, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
            fill=PALE_BLUE, line=NAVY, name="Visual formula surrogate")
    else:
        # Native Office Math is inserted into this clear region after export.
        add_text(slide, 1.02, 1.82, 11.30, 1.12, "", 24,
                 name="Native Office Math reserved region")
    variables = [
        (0.86, "P_s", "狀態功率", "由 energy model 提供；單位 W。", NAVY, PALE_BLUE),
        (4.76, "t_s", "停留時間", "由 endpoint replay 提供；單位 s。", TEAL, PALE_TEAL),
        (8.66, "E_endpoint", "端點能量", "由 runner result 提供；單位 J。", SLATE, PALE_GRAY),
    ]
    for x, variable, label, body, accent, fill in variables:
        outline(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, x, 3.32, 3.80, 1.54, accent, fill)
        add_segments(slide, x + 0.16, 3.48, 3.48, 0.42,
                     [(variable, True, True, accent), f"｜{label}"], 21,
                     align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE)
        add_text(slide, x + 0.22, 4.00, 3.36, 0.62, body, 20,
                 align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE)
    add_text(slide, 1.02, 5.22, 11.30, 0.72,
             "邊界：endpoint radio＋processing；不包含 satellite、gateway 或 whole system。",
             21, bold=True, color=NAVY, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE)


def draw_verdict_matrix(slide):
    add_text(slide, 0.58, 3.03, 1.10, 0.52, "service", 20, bold=True, color=NAVY,
             align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE)
    add_text(slide, 5.30, 1.64, 3.10, 0.46, "endpoint energy", 20, bold=True,
             color=NAVY, align=PP_ALIGN.CENTER)
    heads = [("降低", 3.05), ("增加／不變", 7.86)]
    for text, x in heads:
        add_text(slide, x, 2.07, 3.92, 0.48, text, 21, bold=True, color=SLATE,
                 align=PP_ALIGN.CENTER)
    rows = [("維持", 2.60), ("下降", 4.20)]
    cells = [
        (3.05, 2.60, "節能結果", "服務維持，端點能量降低", TEAL, PALE_TEAL),
        (7.86, 2.60, "能量成本增加", "服務維持，能量未降低", NAVY, PALE_BLUE),
        (3.05, 4.20, "服務換能量", "能量降低伴隨服務損失", SLATE, PALE_GRAY),
        (7.86, 4.20, "結果惡化", "服務與能量皆未改善", SLATE, WHITE),
    ]
    for label, y in rows:
        add_text(slide, 1.28, y + 0.34, 1.55, 0.52, label, 22, bold=True,
                 color=NAVY, align=PP_ALIGN.RIGHT, valign=MSO_ANCHOR.MIDDLE)
    for x, y, head, body, accent, fill in cells:
        card(slide, x, y, 3.92, 1.38, head, body, accent=accent, fill=fill,
             heading_size=20, body_size=19, align=PP_ALIGN.CENTER)


def draw_ab_lock(slide):
    locks = [("scenario", "固定工作與模型輸入"), ("seed", "固定 deterministic branch"),
             ("window／units", "固定比較邊界"), ("predecessor", "固定 lineage")]
    for i, (head, body) in enumerate(locks):
        x = 0.62 + i * 3.10
        card(slide, x, 1.92, 2.72, 1.48, head, body,
             accent=TEAL if i % 2 else NAVY,
             fill=PALE_TEAL if i % 2 else PALE_BLUE,
             heading_size=20, body_size=18, align=PP_ALIGN.CENTER)
        if i < 3:
            line(slide, x + 2.72, 2.66, x + 3.06, 2.66, arrow=True)
    outline(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, 0.88, 3.92, 11.58, 1.50,
            NAVY, PALE_GRAY)
    add_text(slide, 1.10, 4.10, 2.12, 1.12, "精確修改索引", 21, bold=True,
             color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE)
    add_text(slide, 3.38, 4.02, 8.72, 1.30,
             "lora-energy-lab/student_policy.py\n"
             "A｜lab-a-pace-rest：REST_DURING_GAP SLEEP → WAIT\n"
             "B｜lab-b-enter-exit-hold：STABLE_STEPS 2 → 1",
             16.5, bold=True, color=TEAL, align=PP_ALIGN.LEFT,
             valign=MSO_ANCHOR.MIDDLE)
    add_text(slide, 1.36, 5.58, 10.62, 0.42,
             "identity mismatch 或 null diff → comparison gate failure",
             21, bold=True, color=SLATE, align=PP_ALIGN.CENTER)


def draw_evidence_spine(slide):
    labels = ["marked code", "action", "radio state", "packet／service", "endpoint J"]
    captions = ["程式差異", "策略輸出", "停留時間", "工作結果", "能量結果"]
    for i, (label, caption) in enumerate(zip(labels, captions)):
        x = 0.50 + i * 2.54
        node(slide, x, 2.08, 2.14, 0.88, label,
             accent=TEAL if i in (1, 2) else NAVY,
             fill=PALE_TEAL if i in (1, 2) else PALE_BLUE,
             size=19)
        add_text(slide, x, 3.06, 2.14, 0.42, caption, 18, color=SLATE,
                 align=PP_ALIGN.CENTER)
        if i < 4:
            line(slide, x + 2.14, 2.52, x + 2.48, 2.52, arrow=True)
    card(slide, 0.62, 3.68, 7.14, 2.06, "exact edit index",
         "student_policy.py\n"
         "A｜lab-a-pace-rest｜REST_DURING_GAP：SLEEP → WAIT\n"
         "B｜lab-b-enter-exit-hold｜STABLE_STEPS：2 → 1",
         accent=TEAL, fill=PALE_TEAL, heading_size=20, body_size=20)
    card(slide, 8.06, 3.68, 4.66, 2.06, "consumer / mechanism",
         "choose_action(observation)\n"
         "lora_energy_lab/engine.py\n"
         "stable_steps → MODE_CHANGE",
         accent=SLATE, fill=PALE_GRAY, heading_size=20, body_size=20)


def draw_lab_a(slide):
    card(slide, 0.82, 1.94, 5.78, 2.72, "WAIT",
         "維持 awake idle\n等待期間持續累積功率\n後續送出通常不經完整 wake transition",
         accent=NAVY, fill=PALE_BLUE, body_size=22)
    card(slide, 6.74, 1.94, 5.78, 2.72, "SLEEP",
         "進入低功率休息狀態\n重新送出前增加 WAKE\n節省與延遲由同一份 ledger 判定",
         accent=TEAL, fill=PALE_TEAL, body_size=22)
    add_text(slide, 1.04, 5.02, 11.28, 0.84,
             "檢查：WAIT／SLEEP／WAKE／TX duration → packet delivery → service_pass → endpoint_energy_j",
             21, bold=True, color=SLATE, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE, fill=PALE_GRAY, line=SLATE)


def draw_lab_b(slide):
    card(slide, 0.82, 1.90, 5.72, 3.20, "切換太慢",
         "quality 已下降\n策略仍維持原狀態\n可能錯過服務視窗或增加 retry",
         accent=NAVY, fill=PALE_BLUE, body_size=22, align=PP_ALIGN.CENTER)
    card(slide, 6.78, 1.90, 5.72, 3.20, "過度往返",
         "A → B → A 事件密集\ntransition 與 state change 增加\ncontinuity 與能量需一起檢查",
         accent=TEAL, fill=PALE_TEAL, body_size=22, align=PP_ALIGN.CENTER)
    add_text(slide, 1.18, 5.48, 10.96, 0.46,
             "ENTER_QUALITY、EXIT_QUALITY 與 STABLE_STEPS 共同決定 transition timing。",
             21, bold=True, color=SLATE, align=PP_ALIGN.CENTER)


def draw_lab_c(slide):
    line(slide, 0.92, 2.62, 12.30, 2.62, color=NAVY, width=2.2)
    events = [(1.35, "一般資料", NAVY), (3.65, "一般資料", NAVY),
              (6.02, "batch threshold", TEAL), (8.58, "urgent", TEAL),
              (11.18, "deadline", SLATE)]
    for x, label, color in events:
        dot = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.OVAL, Inches(x - 0.16), Inches(2.46), Inches(0.32), Inches(0.32))
        dot.fill.solid(); dot.fill.fore_color.rgb = color
        dot.line.fill.background()
        add_text(slide, x - 0.70, 2.88, 1.40, 0.52, label, 18, bold=True,
                 color=color, align=PP_ALIGN.CENTER)
    card(slide, 0.92, 3.76, 3.54, 1.42, "累積",
         "queue depth 與 packet age 增加。", accent=NAVY, fill=PALE_BLUE,
         body_size=20, align=PP_ALIGN.CENTER)
    card(slide, 4.88, 3.76, 3.54, 1.42, "批次送出",
         "減少 WAKE／TX event 次數。", accent=TEAL, fill=PALE_TEAL,
         body_size=20, align=PP_ALIGN.CENTER)
    card(slide, 8.84, 3.76, 3.54, 1.42, "緊急送出",
         "deadline 與 urgent packet 覆寫等待。", accent=SLATE, fill=PALE_GRAY,
         body_size=20, align=PP_ALIGN.CENTER)
    add_text(slide, 1.24, 5.52, 10.84, 0.42,
             "批次較大 ≠ 自動較省；service_pass 與 endpoint_energy_j 同時判定。",
             21, bold=True, color=SLATE, align=PP_ALIGN.CENTER)


def draw_import_flow(slide):
    card(slide, 0.50, 1.86, 3.08, 1.58, "選取 result.json",
         "stdout 的 result_path\n指定唯一 result.json",
         accent=NAVY, fill=PALE_BLUE,
         heading_size=20, body_size=20, align=PP_ALIGN.CENTER)
    line(slide, 3.58, 2.65, 3.92, 2.65, arrow=True)
    card(slide, 0.50, 4.08, 3.08, 1.58, "保留 endpoint-replay.json",
         "同一 run 目錄配對\n不在匯入欄另選",
         accent=TEAL, fill=PALE_TEAL,
         heading_size=20, body_size=20, align=PP_ALIGN.CENTER)
    line(slide, 3.58, 4.87, 3.92, 4.87, color=TEAL, arrow=True)
    card(slide, 3.96, 2.10, 2.54, 3.56, "驗證 result",
         "scenario\npolicy identity\nversion／units\nevent contract",
         accent=SLATE, fill=PALE_GRAY, body_size=20, align=PP_ALIGN.CENTER)
    line(slide, 6.50, 3.88, 6.82, 3.88, arrow=True)
    card(slide, 6.86, 2.10, 2.60, 3.56, "契約預期：accepted",
         "accepted 後預期更新\nendpoint replay\n與證據欄位",
         accent=TEAL, fill=PALE_TEAL, heading_size=20, body_size=20, align=PP_ALIGN.CENTER)
    line(slide, 9.46, 3.88, 9.78, 3.88, arrow=True)
    card(slide, 9.82, 2.10, 3.00, 3.56, "目前 live 邊界",
         "目前尚未匯入\n沒有 accepted replay\n進度備份不重算 result",
         accent=NAVY, fill=PALE_BLUE, heading_size=20, body_size=20, align=PP_ALIGN.CENTER)


def draw_course_fields(slide):
    outline(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, 0.72, 1.84, 7.18, 4.34,
            SLATE, PALE_GRAY)
    add_text(slide, 0.98, 2.04, 6.66, 0.44, "欄位閱讀地圖｜真實畫面見 Part C P085–P099", 20,
             bold=True, color=SLATE, align=PP_ALIGN.CENTER)
    rows = ["scenario／policy identity", "source mode／validation", "service／packet outcome",
            "state duration／endpoint energy", "證據／進度備份／READY"]
    for i, row in enumerate(rows):
        y = 2.72 + i * 0.61
        add_text(slide, 1.14, y, 0.46, 0.42, str(i + 1), 18, bold=True,
                 color=WHITE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
                 fill=TEAL if i in (1, 2) else NAVY)
        add_text(slide, 1.78, y, 5.48, 0.42, row, 20, bold=True,
                 color=INK, valign=MSO_ANCHOR.MIDDLE)
    explanations = [
        ("1–2", "確認目前顯示的是哪個 scenario、policy 與來源。"),
        ("3", "服務與封包結果優先於單一能量數值。"),
        ("4", "state duration 說明 endpoint J 的機制。"),
        ("5", "證據、進度備份與 READY 分別記錄結果與流程狀態。"),
    ]
    for i, (num, body) in enumerate(explanations):
        y = 1.84 + i * 1.08
        accent = TEAL if i % 2 else NAVY
        fill = PALE_TEAL if i % 2 else PALE_BLUE
        outline(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, 8.22, y, 4.40, 0.88, accent, fill)
        add_text(slide, 8.40, y + 0.10, 0.86, 0.66, num, 18, bold=True,
                 color=accent, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE)
        add_text(slide, 9.34, y + 0.10, 3.02, 0.66, body, 17.5,
                 color=INK, valign=MSO_ANCHOR.MIDDLE)


def draw_ready(slide):
    stages = [("SETUP", "建立 Python 3.11 與 .venv"),
              ("TERMINAL VERIFY", "檢查前置條件並寫 READY receipt"),
              ("/COURSE RECORD", "保存 browser-local READY 狀態"),
              ("RUN／IMPORT", "產生或載入 result／replay")]
    for i, (head, body) in enumerate(stages):
        x = 0.48 + i * 3.18
        card(slide, x, 2.02, 2.72, 1.58, head, body,
             accent=TEAL if i in (1, 2) else NAVY,
             fill=PALE_TEAL if i in (1, 2) else PALE_BLUE,
             heading_size=18 if i in (1, 2) else 21, body_size=17.5,
             align=PP_ALIGN.CENTER)
        if i < 3:
            line(slide, x + 2.72, 2.81, x + 3.12, 2.81, arrow=True)
    card(slide, 0.96, 4.18, 5.48, 1.46, "兩種 READY 紀錄",
         "terminal receipt 記錄 verify；browser record 保存頁面狀態。",
         accent=TEAL, fill=PALE_TEAL, body_size=20, align=PP_ALIGN.CENTER)
    card(slide, 6.90, 4.18, 5.48, 1.46, "兩者都不代表",
         "run 已完成、service 通過、endpoint energy 降低或比較成立。",
         accent=SLATE, fill=PALE_GRAY, body_size=20, align=PP_ALIGN.CENTER)


def draw_scope(slide):
    add_text(slide, 1.00, 1.78, 4.40, 0.40, "來源分類｜資料如何產生", 21, bold=True,
             color=NAVY, align=PP_ALIGN.CENTER)
    add_text(slide, 7.78, 1.78, 4.40, 0.40, "範圍分類｜數值涵蓋哪一層", 21, bold=True,
             color=TEAL, align=PP_ALIGN.CENTER)
    sources = [("actual run", "本機 runner 產生"), ("matching fallback", "相同 scenario 的封裝 artifact"),
               ("simulated／derived", "模型或 runner 輸出")]
    for i, (head, body) in enumerate(sources):
        y = 2.36 + i * 1.06
        outline(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, 0.80, y, 5.18, 0.86, NAVY, PALE_BLUE)
        add_text(slide, 1.04, y + 0.11, 2.30, 0.62, head, 18.5, bold=True,
                 color=NAVY, valign=MSO_ANCHOR.MIDDLE)
        add_text(slide, 3.36, y + 0.11, 2.34, 0.62, body, 17.5,
                 color=INK, valign=MSO_ANCHOR.MIDDLE)
    card(slide, 7.18, 2.36, 5.18, 1.50, "endpoint",
         "LoRaEnergySim result／replay\nradio＋processing boundary",
         accent=TEAL, fill=PALE_TEAL, body_size=18.5, align=PP_ALIGN.CENTER)
    card(slide, 7.18, 4.08, 5.18, 1.50, "system／canonical",
         "Leo／C-120 provider 或 canonical source\n另一套 numerator／denominator",
         accent=SLATE, fill=PALE_GRAY, body_size=18.5, align=PP_ALIGN.CENTER)
    line(slide, 6.36, 2.34, 6.36, 5.36, color=SLATE, width=1.6)
    add_text(slide, 1.20, 5.72, 10.92, 0.42,
             "同為 J 不代表相同語義；來源標籤與 scope 標籤必須同時存在。",
             21, bold=True, color=SLATE, align=PP_ALIGN.CENTER)


def draw_exit(slide):
    routes = [
        ("來源／視窗", "P100–P102", "返回情境與服務視窗說明", NAVY, PALE_BLUE),
        ("策略／程式", "P103、P107–P111", "返回 Lab A／B／C", TEAL, PALE_TEAL),
        ("服務／能量", "P104–P106、P115", "返回結果比較頁", NAVY, PALE_BLUE),
        ("JSON／網站", "P112–P114", "返回匯入與欄位操作", SLATE, PALE_GRAY),
    ]
    for i, (issue, pages, target, accent, fill) in enumerate(routes):
        y = 1.90 + i * 1.12
        card(slide, 0.82, y, 3.10, 0.86, issue, pages,
             accent=accent, fill=fill, heading_size=20, body_size=18)
        line(slide, 3.92, y + 0.43, 4.42, y + 0.43, arrow=True)
        add_text(slide, 4.48, y, 7.92, 0.86, target, 23, bold=True,
                 color=accent, valign=MSO_ANCHOR.MIDDLE,
                 fill=fill, line=accent)


DRAWERS = {
    "entry": draw_entry,
    "causal": draw_causal,
    "source": draw_source,
    "window_flow": draw_window_flow,
    "layers": draw_layers,
    "quality_decision": draw_quality_decision,
    "service_timeline": draw_service_timeline,
    "verdict_matrix": draw_verdict_matrix,
    "ab_lock": draw_ab_lock,
    "evidence_spine": draw_evidence_spine,
    "lab_a": draw_lab_a,
    "lab_b": draw_lab_b,
    "lab_c": draw_lab_c,
    "import_flow": draw_import_flow,
    "course_fields": draw_course_fields,
    "ready": draw_ready,
    "scope": draw_scope,
    "exit": draw_exit,
}


APPENDIX_REQUIRED_NOTE_SECTIONS = (
    "本頁目的：",
    "畫面指向：",
    "可直接說：",
    "必要操作：",
    "預期畫面或結果：",
    "失敗處理：",
)

APPENDIX_KIND_GUIDANCE = {
    "entry": (
        "把附錄問題路由到可核對的頁面，不新增實驗流程。",
        "四列問題路由、每列右側頁碼，以及最下方返回主流程的箭頭。",
        "依問題類型找到頁碼，再帶著該頁的欄位或命令返回原操作頁。",
        "頁碼與問題不一致時保留疑問，回到 P098 的索引，不把附錄當成新的 evidence。",
        "沿著四列問題路由閱讀；本頁不變更 package、runner 或 browser 狀態。",
    ),
    "causal": (
        "建立來源到端點結果的可追溯因果鏈。",
        "上方固定來源、服務視窗、quality observation、student_policy.py、action/state 節點與下方兩個結果卡。",
        "沿箭頭判讀來源如何形成 observation，再由 policy 產生 action/state，最後分流到 service 與 endpoint energy。",
        "節點缺失或來源與結果混用時，返回 source/window 頁，維持欄位邊界。",
        "沿畫面箭頭閱讀；此頁維持模型解釋，不寫入 result、replay、證據或進度備份。",
    ),
    "window_flow": (
        "說明固定來源如何透過時間與座標推導形成服務視窗。",
        "固定 TLE/GP、目標時間、SGP4 狀態、地面座標、服務視窗五個節點，以及下方模型推導卡。",
        "先區分模型輸入與推導欄位，再把 elevation、azimuth、range 帶入策略 observation。",
        "來源、時鐘、座標系或 units 不一致時，停止服務視窗解讀並返回 source identity。",
        "沿五個節點核對順序；本頁不宣稱封包送達或 service_pass。",
    ),
    "layers": (
        "把幾何可見、品質情境、完成服務分成三個不能互換的判讀層。",
        "三層橫向卡片與底部的「仰角通過 ≠ quality 合格 ≠ service 完成」邊界句。",
        "先看 geometry，再看 quality observation，最後看 delivery、deadline、freshness、service_pass。",
        "若只取得角度或 quality 欄位，保留 incomplete，不補寫服務完成。",
        "依三層由上而下核對欄位；本頁不修改模型或 generated JSON。",
    ),
    "quality_decision": (
        "說明 quality observation、門檻與 hold 條件如何形成策略分支。",
        "quality observation 節點、ENTER/EXIT + STABLE_STEPS 門檻、進入/維持/退出三個 action 卡。",
        "把 quality 當成決策當下的 observation；再沿 action、state transition、service、endpoint energy 判讀。",
        "quality 與 future outcome 混淆時，返回 policy API 邊界，只保留允許的 observation。",
        "沿 observation→threshold→action→state 的箭頭閱讀；欄位保持唯讀。",
    ),
    "service_timeline": (
        "區分 throughput、delivered_bits 與 service_pass 的單位和判定責任。",
        "時間線上的三個節點與各自的單位、工作量或 Boolean 判定說明。",
        "先讀速率，再讀完成量，最後讀期限或 freshness 條件；高 throughput 不直接推出服務完成。",
        "欄位缺少 units 或 deadline reason 時，保留欄位不足，不以單一速率代替 service_pass。",
        "按時間線左到右核對欄位；本頁只做結果閱讀，不改 run artifacts。",
    ),
    "energy_formula": (
        "固定 endpoint energy 的分子邊界、狀態功率與停留時間來源。",
        "公式保留區、P_s/t_s/E_endpoint 三個變數卡，以及 endpoint radio + processing 邊界句。",
        "逐一核對功率單位 W、時間單位 s、加總結果 J，再確認範圍沒有混入 satellite 或 gateway。",
        "numerator、denominator、scope 或 units 不一致時，保持 incomplete，不以相同 J 標籤拼接比較。",
        "沿公式區到三個變數卡閱讀；本頁不產生新的 energy result。",
    ),
    "verdict_matrix": (
        "以 service 維持與 endpoint energy 變化共同判定結果類型。",
        "service 軸、endpoint energy 軸與四個結果格。",
        "先讀 service 是否維持，再讀 endpoint energy 下降、增加或不變，最後選擇對應結果格。",
        "欄位不足時標記 incomplete；較低 J 但服務下降只能判為 trade-off。",
        "沿矩陣先行後列閱讀；本頁不捏造缺少的結果值。",
    ),
    "lab_a": (
        "說明 WAIT 與 SLEEP 的狀態停留、wake transition、封包與服務差異。",
        "WAIT 與 SLEEP 兩張狀態卡，以及底部 WAIT/SLEEP/WAKE/TX duration 到 endpoint_energy_j 的檢查列。",
        "把 action 差異連到 awake idle、sleep、wake，再按 packet delivery、service_pass、endpoint_energy_j 判讀。",
        "只有 action 名稱而沒有 state duration 或 result/replay 配對時，保留因果鏈未完成。",
        "依底部檢查列逐欄閱讀；本頁不改 policy 或 ledger。",
    ),
    "lab_b": (
        "區分快速反應不足與門檻過敏造成的往返兩種 failure mechanism。",
        "切換太慢與過度往返兩張卡，以及 ENTER_QUALITY、EXIT_QUALITY、STABLE_STEPS 的 timing 句。",
        "先看 quality 變化與 state transition，再分辨錯過服務視窗或 A→B→A 往返，最後看 continuity、service、energy。",
        "只有 transition 次數而沒有 service 或 energy context 時，保留 mechanism 未判定。",
        "依兩種 failure mechanism 分開閱讀；本頁不把 transition 越少當成唯一目標。",
    ),
    "lab_c": (
        "說明批次、urgent 與 deadline 如何改變喚醒、傳送與服務結果。",
        "事件時間線與累積、批次送出、緊急送出三張結果卡。",
        "把 queue depth、packet age、batch threshold、urgent、deadline 串成 action 與 service 判定。",
        "批次較大但 deadline 或 service 下降時，保留 trade-off，不直接判定節能。",
        "沿事件時間線閱讀，再核對 service_pass 與 endpoint_energy_j；本頁不修改 queue 或 runner。",
    ),
    "course_fields": (
        "提供 /course 真實畫面的欄位閱讀順序，並把截圖 authority 留在 Part C。",
        "左側五個欄位閱讀列、右側四個說明卡與 Part C P085–P099 指示。",
        "先讀 identity 與來源，再讀 service/packet、state duration/endpoint energy，最後讀證據/進度備份/READY。",
        "真實畫面或 source state 與本頁不同時，以 Part C current evidence 為準，不把示意圖當現況。",
        "沿五個欄位列閱讀；本頁不匯入檔案、不執行 policy。",
    ),
    "scope": (
        "同時標記資料來源分類與能量範圍，避免把不同 authority 的 J 直接比較。",
        "左側 actual run/matching fallback/simulated-derived，右側 endpoint/system/canonical 兩種範圍卡。",
        "先問資料如何產生，再問數值涵蓋哪一層，最後固定 numerator、denominator、window、scope。",
        "來源或 scope 缺一項時維持 incomplete，不把 endpoint、Leo、system 數值放進同一項效率判定。",
        "沿來源欄到範圍欄閱讀；本頁不合併不同 authority 的結果。",
    ),
    "exit": (
        "把附錄查閱結果返回 Part A、Part B 或 Part C 的原操作頁。",
        "四列問題分類、對應頁碼與右側返回目標。",
        "先依疑問找到分類，再依頁碼返回安裝、策略、結果或網站欄位操作。",
        "找不到對應頁時返回 P098 索引，維持原主流程，不新增附錄實驗。",
        "沿四列返回路由閱讀；本頁不新增 package、runner 或 browser 操作。",
    ),
}


APPENDIX_ID_GUIDANCE = {
    "P100": (
        "界定未凍結 current source 的 evidence boundary，保留 claim ceiling。",
        "左側 CURRENT SOURCE PLACEHOLDER、TLE line 1/2、current source 尚未凍結，以及右側 source_id、epoch、兩行原始文字欄位。",
        "此頁明示 source 尚未凍結；只核對 placeholder labels 與 source_id/epoch 欄位，不填入 TLE、不捏造 current screenshot 或即時位置。",
        "任何來源字串或畫面被當成 current evidence 時，恢復 placeholder，停止超出 claim ceiling 的解讀。",
        "placeholder 必須仍可見；本頁只界定 claim ceiling，不產生 TLE 或 current location result。",
    ),
    "P107": (
        "把公平比較的固定條件與唯一編輯面連成可執行索引。",
        "上方 scenario、seed、window/units、predecessor 四個固定條件卡；下方精確修改索引卡。",
        "package root 是 lora-energy-lab/；策略檔的 package-relative path 是 lora-energy-lab/student_policy.py。索引列出 marker lab-a-pace-rest 的 REST_DURING_GAP SLEEP → WAIT 與 marker lab-b-enter-exit-hold 的 STABLE_STEPS 2 → 1；先對照 identity，再把 diff 限在 active marked block。",
        "預期 baseline/candidate 共用 scenario、seed、window、units、predecessor，且只出現一個 marked block diff；identity mismatch 或 null diff 保持 comparison gate failure。",
        "若固定條件或 path 不一致，保留 receipt 與比較失敗訊息，返回 package identity，不拼接另一份 artifact。",
    ),
    "P108": (
        "把精確程式變更、consumer 與中介 evidence 串成可反駁的因果鏈。",
        "上方 marked code→action→radio state→packet/service→endpoint J spine；下方 exact edit index 與 consumer/mechanism 卡。",
        "精確索引是 lora-energy-lab/student_policy.py：marker lab-a-pace-rest 的 REST_DURING_GAP SLEEP → WAIT；marker lab-b-enter-exit-hold 的 STABLE_STEPS 2 → 1。consumer 先讀 choose_action(observation)，再讀 package root 內 lora_energy_lab/engine.py 的 stable_steps→MODE_CHANGE。",
        "預期 diff 先改變 action 或 state，再能在 packet/service 與 endpoint J 看到中介或結果差異；只有 source diff 而沒有 runtime path 差異時，claim 維持未完成。",
        "若 action/state 無差異，保留程式 diff 與 result/replay，返回 policy API、consumer 或 runtime path，不用畫面效果補足證據。",
    ),
    "P112": (
        "把瀏覽器匯入邊界與本機 replay 配對證據分開。",
        "package root、/course URL、result.json 選取卡、同 run 目錄 endpoint-replay.json 卡、契約預期流程與 current live 空狀態。",
        "package root 是 lora-energy-lab/；瀏覽器入口是 http://120.126.151.102:3000/course。檔案選擇器只匯入 runner stdout 的 result_path 所指向的 result.json；同一 run 目錄的 endpoint-replay.json 留在本機，作為配對與事件核對證據。student_policy.py 不上傳、不在瀏覽器執行。",
        "依匯入契約，accepted 後預期更新「證據」欄位；「進度備份」只保存 browser-local progress 與 A/B/C import records，不重算 runner result。2026-08-11 14:12 current browser evidence 仍為尚未匯入，故本頁不宣稱 live accepted replay 已建立。",
        "驗證失敗時保留原 session、證據、進度備份與 run 目錄，不改 generated JSON；返回 stdout result_path 與 identity 檢查。",
    ),
    "P114": (
        "分清 terminal READY receipt 與 /course browser-local 記錄的責任。",
        "四段 SETUP→TERMINAL VERIFY→/COURSE RECORD→RUN/IMPORT 流程、兩張 READY 卡，以及 package root、commands、URL 索引。",
        "package root 是 lora-energy-lab/。Windows PowerShell 執行 .\\course.cmd verify，WSL/POSIX 執行 bash course.sh verify；terminal receipt 先寫入 artifacts/verify-receipt.json。瀏覽器入口是 http://120.126.151.102:3000/course，頁面只保存 browser-local READY，不安裝 Python、不執行 verify 或 policy。",
        "預期 terminal receipt 的 status 是 READY，且 /course 的 browser-local record 與 terminal receipt 可分開追查；兩者都不產生 result.json 或宣稱 run 完成。",
        "receipt 或 package root 不一致時保留錯誤狀態，返回同一 root 重做 verify；browser-local record 不取代 terminal receipt。",
    ),
}


def appendix_speaker_script(spec, next_spec=None) -> str:
    """Return a complete, page-local delivery script for appendix notes."""
    guidance = APPENDIX_ID_GUIDANCE.get(spec["id"], APPENDIX_KIND_GUIDANCE.get(spec["kind"]))
    if guidance is None:
        raise KeyError(f"no appendix guidance for {spec['id']} / {spec['kind']}")
    purpose, pointer, operation, expected, recovery = guidance
    if next_spec is None:
        transition = "銜接下一頁：附錄在 P116 收束，依問題分類返回原本的 Part A、Part B 或 Part C 操作頁。"
    else:
        transition = f"銜接下一頁：{next_spec['id']}｜{next_spec['title']}；把本頁的欄位邊界或 evidence 索引帶入下一個判讀節點。"
    return "\n".join([
        f"本頁目的：{purpose}",
        f"畫面指向：{pointer}",
        f"可直接說：{spec['notes']}",
        f"必要操作：{operation}",
        f"預期畫面或結果：{expected}",
        f"失敗處理：{recovery}",
        transition,
    ])


def add_notes(slide, spec, next_spec=None):
    tf = slide.notes_slide.notes_text_frame
    tf.clear()
    paragraph = tf.paragraphs[0]
    add_mixed(paragraph, appendix_speaker_script(spec, next_spec), 14, color=INK)


def overlay_template_parts(path: Path) -> None:
    with zipfile.ZipFile(TEMPLATE) as source, zipfile.ZipFile(path, "r") as old:
        data = {info.filename: old.read(info.filename) for info in old.infolist()}
        infos = {info.filename: copy.copy(info) for info in old.infolist()}
        prefixes = ("ppt/slideLayouts/", "ppt/slideMasters/", "ppt/theme/", "ppt/media/", "ppt/notesMasters/")
        for info in source.infolist():
            if info.filename.startswith(prefixes):
                data[info.filename] = source.read(info.filename)
                infos[info.filename] = copy.copy(info)
    temporary = path.with_suffix(".overlay.pptx")
    with zipfile.ZipFile(temporary, "w", zipfile.ZIP_DEFLATED) as target:
        for name, payload in data.items():
            target.writestr(infos[name], payload)
    temporary.replace(path)


def build_one(path: Path, *, preview_formula: bool) -> None:
    prs = Presentation(str(TEMPLATE))
    remove_all_slides(prs)
    layout = prs.slide_layouts[1]
    for index, spec in enumerate(SLIDES):
        next_spec = SLIDES[index + 1] if index + 1 < len(SLIDES) else None
        slide = prs.slides.add_slide(layout)
        clear_body_placeholder(slide)
        title_and_lead(slide, spec)
        if spec["kind"] == "energy_formula":
            draw_energy_formula(slide, preview_formula=preview_formula)
        else:
            DRAWERS[spec["kind"]](slide)
        add_notes(slide, spec, next_spec)
    prs.core_properties.title = "LoRaEnergySim + LEO BeamShift 附錄脈絡化重寫"
    prs.core_properties.subject = "P098-P116 contextual appendix review"
    prs.core_properties.author = "OpenAI Codex"
    prs.save(str(path))
    overlay_template_parts(path)


def validate_text() -> list[str]:
    scripts = []
    for index, spec in enumerate(SLIDES):
        next_spec = SLIDES[index + 1] if index + 1 < len(SLIDES) else None
        scripts.append(appendix_speaker_script(spec, next_spec))
    visible = "\n".join(f"{s['title']}\n{s['lead']}\n{s['notes']}\n{script}" for s, script in zip(SLIDES, scripts))
    hits = [term for term in FORBIDDEN if term in visible]
    if hits:
        raise RuntimeError(f"forbidden wording found: {hits}")
    script_errors = []
    for spec, script in zip(SLIDES, scripts):
        missing = [section for section in APPENDIX_REQUIRED_NOTE_SECTIONS if section not in script]
        if "銜接下一頁：" not in script or len(script) < 260:
            missing.append("銜接下一頁：或完整 note length")
        if missing:
            script_errors.append({"page_id": spec["id"], "chars": len(script), "missing": missing})
    if script_errors:
        raise RuntimeError(f"speaker note script gate failed: {script_errors}")
    return scripts


def insert_native_endpoint_equation(path: Path) -> dict[str, object]:
    """Insert the editable endpoint-energy OMML object on logical slide 8."""
    if not EQUATION_TOOL.is_file():
        raise RuntimeError(f"native equation tool missing: {EQUATION_TOOL}")
    temporary = path.with_suffix(".omml.pptx")
    report_path = VALIDATION / "native-equation-report.json"
    command = [
        sys.executable,
        str(EQUATION_TOOL),
        str(path),
        str(temporary),
        "--logical-slide",
        "8",
        "--equation",
        "E_endpoint",
        "--report",
        str(report_path),
    ]
    result = subprocess.run(command, cwd=str(ROOT), text=True, capture_output=True, check=False)
    if result.returncode != 0 or not temporary.exists():
        raise RuntimeError(
            "native endpoint equation insertion failed: "
            f"rc={result.returncode}; stdout={result.stdout[-500:]}; stderr={result.stderr[-500:]}"
        )
    temporary.replace(path)
    if report_path.exists():
        return json.loads(report_path.read_text(encoding="utf-8"))
    return {"status": "PASS", "tool": str(EQUATION_TOOL), "logical_slide": 8, "equation": "E_endpoint"}


def enforce_native_math_font(path: Path) -> None:
    """Apply the deck's explicit Times New Roman contract to native math runs."""
    with zipfile.ZipFile(path, "r") as archive:
        infos = [copy.copy(info) for info in archive.infolist()]
        payloads = {info.filename: archive.read(info.filename) for info in infos}
    slide_part = "ppt/slides/slide8.xml"
    before = payloads[slide_part]
    after = before.replace(b'typeface="Cambria Math"', b'typeface="Times New Roman"')
    if before == after or b'typeface="Cambria Math"' in after:
        raise RuntimeError("native equation font normalization did not replace every Cambria Math run")
    payloads[slide_part] = after
    temporary = path.with_suffix(".math-font.pptx")
    with zipfile.ZipFile(temporary, "w", zipfile.ZIP_DEFLATED) as target:
        for info in infos:
            target.writestr(info, payloads[info.filename])
    temporary.replace(path)


def build() -> None:
    EXPORTS.mkdir(parents=True, exist_ok=True)
    VALIDATION.mkdir(parents=True, exist_ok=True)
    scripts = validate_text()
    build_one(PREVIEW, preview_formula=True)
    build_one(OMML_SOURCE, preview_formula=False)
    native_equation_report = insert_native_endpoint_equation(OMML_SOURCE)
    enforce_native_math_font(OMML_SOURCE)
    SOURCE_MAP.write_text(json.dumps([
        {"slide": idx + 1, "page_id": spec["id"], "title": spec["title"],
         "donor_source": spec["donor"], "authority": "ADR-004 / C120 SDD / current artifact"}
        for idx, spec in enumerate(SLIDES)
    ], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    BUILD_REPORT.write_text(json.dumps({
        "status": "CONTEXTUAL_REWRITE_SOURCE_BUILT",
        "template": str(TEMPLATE),
        "preview": str(PREVIEW),
        "omml_source": str(OMML_SOURCE),
        "slide_count": len(SLIDES),
        "layout_contract": "all slides use educate slideLayout2.xml",
        "background_fill": "unset",
        "title_pt": 28,
        "body_pt_range": [18, 24],
        "speaker_notes": {
            "count": len(scripts),
            "min_chars": min(len(script) for script in scripts),
            "max_chars": max(len(script) for script in scripts),
            "required_sections": list(APPENDIX_REQUIRED_NOTE_SECTIONS) + ["銜接下一頁："],
        },
        "native_equation_target": {
            "logical_slide": 8,
            "equation": "E_endpoint",
            "latex": r"E_{\mathrm{endpoint}} = \sum_{s \in S} P_s t_s",
            "font": "Times New Roman",
            "picture_fallback": "absent",
            "report": native_equation_report,
        },
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    build()
