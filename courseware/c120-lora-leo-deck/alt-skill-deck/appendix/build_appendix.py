#!/usr/bin/env python3
"""Build the P098-P116 donor-tail review deck from educate slideLayout2.

The source template remains the native OOXML authority.  Every authored slide
is created from its second layout (``slideLayout2.xml``); no slide background
fill is authored.  The deck is intentionally an editable, first-stage review
artifact with large text, native vector shapes, and embedded speaker notes.
"""

from __future__ import annotations

import copy
import json
import re
import zipfile
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE, MSO_CONNECTOR, MSO_SHAPE_TYPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt
from pptx.oxml.ns import qn


ROOT = Path(__file__).resolve().parent
TEMPLATE = Path("/home/u24/pptx-wrap/assets/templates/educate.pptx")
OUTPUT = ROOT.parent / "LoRaEnergySim-LEO-ALT-APPENDIX-REVIEW.pptx"
SOURCE_MAP = ROOT / "source-map.json"
BUILD_REPORT = ROOT / "build-report.json"

CJK_FONT = "標楷體"
LATIN_FONT = "Times New Roman"
NAVY = RGBColor(47, 50, 127)
TEAL = RGBColor(15, 111, 115)
AMBER = RGBColor(176, 122, 23)
RED = RGBColor(143, 46, 46)
INK = RGBColor(28, 31, 36)
MUTED = RGBColor(82, 88, 96)
PALE = RGBColor(235, 238, 248)
WHITE = RGBColor(255, 255, 255)

TOKEN_RE = re.compile(r"([A-Za-z0-9_./:+\-]+(?:\s+[A-Za-z0-9_./:+\-]+)*)")


SLIDES = [
    {
        "id": "P098", "route": "技術附錄", "layout": "record",
        "title": "TLE：固定來源與情境錨點",
        "anchor": "TLE（兩行軌道元素）保存 scenario 使用的來源文字與 epoch；此頁只建立來源 provenance。",
        "fields": [
            "source_id（來源識別碼）：scenario package 產生；字串、無單位；連結固定來源與後續推導。",
            "epoch（來源時刻）：TLE 文字提供；時間戳；界定元素所對應的基準時刻。",
            "raw bytes（原始位元組）：pinned source 保存；byte 序列；供 identity 與重建核對。",
        ],
        "interpret": "current source identity 尚未隨本次教材凍結，畫面狀態維持「待取得 current evidence」。",
        "recovery": "來源、epoch 或 scenario identity 缺漏時，附錄停在來源層，後續推導不成立。",
        "donor": "BeamShift e2 7 或 98；兩頁概念去重後只保留一個來源入口。",
    },
    {
        "id": "P099", "route": "技術附錄", "layout": "flow",
        "title": "SGP4：平均元素至目標時間狀態",
        "anchor": "SGP4（簡化一般擾動模型）讀取 TLE／GP 與 target time，輸出 position／velocity 的模型推導狀態。",
        "fields": [
            "target time（目標時間）：scenario clock 提供；時間戳；指定模型推進時點。",
            "position（位置向量）：SGP4 產生；km；描述 TEME reference frame 中的位置。",
            "velocity（速度向量）：SGP4 產生；km/s；描述同一 frame 與時刻的速度。",
        ],
        "interpret": "輸出分類為 derived（模型推導），其證據強度由 source、model version、time 與 units lineage 決定。",
        "recovery": "model version、target time 或 units 缺漏時，狀態標記為「待取得 current evidence」。",
        "donor": "BeamShift e2 8 或 107；移除 donor 數值，只保留 model lineage。",
    },
    {
        "id": "P100", "route": "技術附錄", "layout": "flow",
        "title": "TEME 至地面站方向的座標轉換",
        "anchor": "Reference frame 轉換把衛星狀態依序映射到地固與觀測者座標；每一步保留 frame 與 units。",
        "fields": [
            "TEME（真赤道平春分點座標）：SGP4 輸出 frame；位置 km、速度 km/s；保存軌道模型狀態。",
            "ECEF（地心地固座標）：frame conversion 產生；km；把向量連結到旋轉地球。",
            "ENU（東北天座標）：observer location 產生；km；形成 azimuth／elevation／range。",
        ],
        "interpret": "azimuth（方位角）與 elevation（仰角）為 degree；range（斜距）為 km，三者皆屬 observer-frame derived field。",
        "recovery": "frame 或 unit mapping 不完整時，不進入品質與 policy 比較。",
        "donor": "BeamShift e2 9–10、108–109；合併為一頁 source vocabulary。",
    },
    {
        "id": "P101", "route": "技術附錄", "layout": "gate",
        "title": "幾何與品質的分層 gate",
        "anchor": "四類欄位進入不同模型分支，service opportunity 需通過 current scenario 所定義的必要 gate。",
        "fields": [
            "elevation（仰角）：geometry derivation 產生；degree；判定地平線可見性。",
            "boresight angle（離軸角）：beam geometry 產生；degree；描述波束中心偏離。",
            "range（斜距）：observer frame 產生；km；進入 path／timing context。",
            "quality（品質分類）：runner observation 產生；ordinal、無物理單位；供 policy threshold 判斷。",
        ],
        "interpret": "visibility、geometry、quality 與 delivered service 分層保存，任何單一 gate 皆不能取代 service evidence。",
        "recovery": "欄位來源或 units 未凍結時，candidate 維持 unqualified。",
        "donor": "BeamShift e2 5、11、30–31、110–111；去除專業推導與 donor 門檻。",
    },
    {
        "id": "P102", "route": "技術附錄", "layout": "split",
        "title": "quality／dB：policy 的觀測情境",
        "anchor": "quality 是 decision-time observation；若 current contract 使用 dB，log value 需連結明確 source、unit 與 timing。",
        "fields": [
            "quality_band（品質帶）：runner observation 產生；ordinal、無 dB 單位；供 enter／hold／exit 條件讀取。",
            "dB（分貝）：模型欄位在已定義 ratio source 時產生；dB；表達 logarithmic ratio。",
            "threshold（門檻）：student_policy.py marked block 提供；與觀測同型別；決定 action branch。",
        ],
        "interpret": "quality observation 只描述 action context；service、endpoint energy 與 bit/J 由不同 result fields 提供。",
        "recovery": "units 或 observation timing 未知時，欄位標記 unavailable，返回 policy API 定義。",
        "donor": "BeamShift e2 13、15、22–24；保留概念，排除 donor RF 數值。",
    },
    {
        "id": "P103", "route": "技術附錄", "layout": "timeline",
        "title": "throughput、delivered bits 與 service",
        "anchor": "傳輸速率、已送達工作量與服務判定分別描述過程、輸出與 gate。",
        "fields": [
            "throughput（吞吐率）：result aggregation 產生；bit/s；描述指定 interval 的 delivered rate。",
            "delivered_bits（已送達位元）：packet ledger 產生；bit；累積符合 delivery 定義的工作量。",
            "service_pass（服務通過）：service evaluator 產生；Boolean、無單位；整合 delivery、deadline 與 freshness 條件。",
        ],
        "interpret": "energy efficiency 僅在相同 boundary、qualified window 與 service condition 下比較。",
        "recovery": "packet 或 service evidence 缺漏時，比較狀態維持 incomplete。",
        "donor": "BeamShift e2 14、32、37；與 core unit 頁去重。",
    },
    {
        "id": "P104", "route": "快速深化", "layout": "compare",
        "title": "切換時機的兩種失敗型態",
        "anchor": "Frozen policy 在兩條 held-out trace 上揭示 delayed switch 與 ping-pong 的事件特徵。",
        "fields": [
            "delayed switch（延遲切換）：transition ledger 產生；event timing；可能造成服務中斷或錯過窗口。",
            "ping-pong（往返切換）：transition ledger 產生；event count／timing；顯示條件過度敏感。",
            "continuity（服務連續性）：service trace 產生；Boolean／duration；連結切換與 packet outcome。",
        ],
        "interpret": "transition count 屬事件證據；energy verdict 仍需 scoped state duration、packet/service 與 endpoint J。",
        "recovery": "policy identity 或 trace identity 不相符時，返回 Lab B freeze record。",
        "donor": "BeamShift e2 12；作為 Lab B optional counterexample。",
    },
    {
        "id": "P105", "route": "技術附錄", "layout": "ledger",
        "title": "功率與能量的帳本範圍",
        "anchor": "Power 描述瞬時速率，energy 描述指定 boundary 內 power 隨 time 的累積。",
        "fields": [
            "P(t)（時間函數功率）：energy model 提供；W＝J/s；依 radio state 與 processing state 取值。",
            "state duration（狀態停留時間）：endpoint replay 產生；s；決定每個 power bucket 的累積量。",
            "endpoint_energy_j（端點累積能量）：runner result 產生；J；涵蓋 endpoint radio／processing course boundary。",
        ],
        "interpret": "RF output、PA input、static term、endpoint J 與 system J 各有獨立 source 與 scope。",
        "recovery": "未建模項維持 absent；scope 未定時停止 bit/J 判讀。",
        "donor": "BeamShift e2 16／17、21、25–29、112；重寫為單一 accounting page。",
    },
    {
        "id": "P106", "route": "快速深化", "layout": "gate",
        "title": "公平 A/B 的固定條件",
        "anchor": "Baseline 與 candidate 共享 scenario、seed、service window、units 與 predecessor，只允許一個 marked policy change。",
        "fields": [
            "scenario（情境）：scenario package 提供；structured record；固定 job、window 與 model inputs。",
            "seed（隨機種子）：runner command 提供；integer、無物理單位；固定 deterministic branch。",
            "predecessor（前置結果）：freeze receipt 提供；identity；維持 A/B lineage。",
            "consequential diff（具因果影響的差異）：result/replay comparison 產生；typed events；證明修改進入 runtime path。",
        ],
        "interpret": "identity mismatch 或 null diff 屬 comparison gate failure，不能形成 energy result。",
        "recovery": "恢復相符 checkpoint 或 same-scenario fallback，再重建比較。",
        "donor": "BeamShift e2 20、36–37、70–75；深化 fair-baseline 概念。",
    },
    {
        "id": "P107", "route": "快速深化", "layout": "flow",
        "title": "控制至證據的因果骨架",
        "anchor": "student_policy.py 的唯一修改須沿 action、state、packet／service 與 endpoint energy 留下對應證據。",
        "fields": [
            "action（策略動作）：policy callback 產生；enum、無單位；選擇 WAIT、SLEEP 或 send family。",
            "radio state（無線電狀態）：runner state machine 產生；enum、無單位；決定 duration 與 energy bucket。",
            "packet outcome（封包結果）：packet ledger 產生；category／timestamp；連結 delivery、expiry 與 retry。",
        ],
        "interpret": "中介 state evidence 將 code change 與 result field 連成可反駁因果句。",
        "recovery": "預測保留；若中介 evidence 無差異，返回 marked block 與 policy API。",
        "donor": "BeamShift e2 38–39；整併為 debrief causal spine。",
    },
    {
        "id": "P108", "route": "技術附錄", "layout": "matrix",
        "title": "節能判讀需要服務、工作量與能量",
        "anchor": "同一 qualified window 內同時核對 delivered work、service／quality 與 scoped energy。",
        "fields": [
            "delivered work（已送達工作量）：packet ledger 產生；bit；提供效率 numerator。",
            "service verdict（服務判定）：service evaluator 產生；Boolean／reason；限定比較有效性。",
            "scoped energy（有範圍的能量）：endpoint result 產生；J；提供同 boundary denominator。",
        ],
        "interpret": "較低 J 且 service loss 的結果分類為 trade-off 或 failure；資料完整度不足時分類為 incomplete。",
        "recovery": "保留原始 result/replay 與 missing-field status，不補寫預期值。",
        "donor": "BeamShift e2 70–75；current values 全數由 course evidence 提供。",
    },
    {
        "id": "P109", "route": "技術附錄", "layout": "record",
        "title": "可重建的 evidence record",
        "anchor": "Evidence record 連結 source mode、identity、mechanism、observed evidence 與 limitation。",
        "fields": [
            "source mode（來源模式）：importer 產生；actual run／fallback category；界定證據來源。",
            "run_id（執行識別碼）：runner 產生；字串、無單位；連結 result 與 endpoint replay。",
            "scope（範圍）：schema／authority map 提供；category；限定 endpoint 或 system interpretation。",
        ],
        "interpret": "完整 record 允許重建修改、輸入、觀察與限制；缺少 identity 或 scope 時狀態為 INCOMPLETE。",
        "recovery": "current record 待取得；donor screenshot 與預期值不填入缺口。",
        "donor": "BeamShift e2 96–97；改寫為 current endpoint record。",
    },
    {
        "id": "P110", "route": "技術附錄", "layout": "quadrants",
        "title": "證據來源分類",
        "anchor": "來源與 model lineage 決定 claim class；分類描述證據生成方式，不作優劣排名。",
        "fields": [
            "measured（實測）：instrument 直接取得；unit 隨物理量；支援 bounded measurement claim。",
            "derived（模型推導）：source 加 model 產生；unit 隨輸出；需保留 model／time lineage。",
            "assumed（課程假設）：course contract 指定；unit 隨參數；只支援 assumption-scoped explanation。",
            "simulated（模擬輸出）：runner 產生；unit 隨 schema；本課 endpoint result 的目前分類。",
        ],
        "interpret": "目前 claim ceiling 為 course-packaged simulated endpoint-energy lab；current owner evidence 改變前維持此分類。",
        "recovery": "來源不明時降低 claim，欄位標示「待取得 current evidence」。",
        "donor": "BeamShift e2 113；保留四類 classifier。",
    },
    {
        "id": "P111", "route": "技術附錄", "layout": "split",
        "title": "endpoint 與 system 能量邊界",
        "anchor": "兩層 replay 可共享 scenario／clock anchor，但 field authority 與 energy semantics 分離。",
        "fields": [
            "endpoint_energy_j（端點能量）：LoRaEnergySim result 產生；J；涵蓋 endpoint radio／processing boundary。",
            "system consumed J（系統消耗能量）：C-120 provider contract 產生；J；屬 LEO／system evidence authority。",
            "canonical efficiency（權威系統效率）：canonical source 定義；bit/J；需要完整 system numerator／denominator。",
        ],
        "interpret": "相同 J unit 不形成語義等價；endpoint 欄位不寫入 system／canonical fields。",
        "recovery": "scope 不明時停止所有 bit/J comparison，返回 authority map。",
        "donor": "BeamShift e2 19–21、28–29、32–33；current ADR／SDD 優先。",
    },
    {
        "id": "P112", "route": "技術附錄", "layout": "flow",
        "title": "policy 至 Leo import 的 lineage",
        "anchor": "student_policy.py 是唯一可編輯 node；deterministic run 產生 result／replay JSON，Leo 只執行 validation 與 materialization。",
        "fields": [
            "policy identity（策略識別）：runner 產生；字串、無物理單位；連結 permitted edit 與 artifact。",
            "result.json（結果檔）：runner 產生；structured JSON；保存 summary、service 與 endpoint energy。",
            "endpoint-replay.json（端點重播檔）：runner 產生；event JSON；保存 queue、action、state 與 packet timeline。",
        ],
        "interpret": "Leo 接收通過 gate 的 JSON；label 或 animation 變化需有 consequential artifact diff 才具教學證據。",
        "recovery": "version、policy identity 或 scenario mismatch 時返回 release checkpoint 或 matching fallback。",
        "donor": "BeamShift e2 96–97 的 lineage 概念；current package contract 重寫。",
    },
    {
        "id": "P113", "route": "技術附錄", "layout": "flow",
        "title": "scenario 至 workbook 的契約鏈",
        "anchor": "五個物件以 identity、units、seed、policy 與 source mode 共同維持 all-or-nothing import。",
        "fields": [
            "scenario（情境定義）：package 來源；structured record、無物理單位；固定 inputs 與 cases。",
            "receipt（凍結收據）：runner 來源；identity record、無物理單位；保存 predecessor 與 policy lineage。",
            "replay（事件重播）：runner／provider 來源；ordered events；以事件時間呈現 state changes。",
            "workbook（比較紀錄）：browser 寫入；JSON、無物理單位；保存 prediction 與 result lineage。",
        ],
        "interpret": "validation failure 時 session 與 workbook 保持原狀，契約鏈不接受局部寫入。",
        "recovery": "選擇 exact matching artifact 或 same-scenario fallback，不手動改寫 schema fields。",
        "donor": "Current SDD 為主；BeamShift e2 70–75 提供 evidence qualification 概念。",
    },
    {
        "id": "P114", "route": "技術附錄", "layout": "boundary",
        "title": "source、model、assumption 與 license",
        "anchor": "Pinned upstream、course wrapper、documented JSON 與 Leo application 以清楚介面分離。",
        "fields": [
            "source（來源）：upstream package／scenario 提供；code 或 data；決定原始 provenance。",
            "model（模型）：runner implementation 提供；equations／state machine；把 input 轉為 simulated events。",
            "assumption（假設）：course wrapper 明示；typed parameter；界定教學簡化。",
            "license（授權）：repository metadata 提供；legal category；限制 code reuse 與 distribution。",
        ],
        "interpret": "Course wrapper 與 JSON seam 維持 GPL upstream 與 Leo application 的技術／授權分界。",
        "recovery": "涉及 upstream、Leo source、schema 或 scientific semantics 的修改回到 owner review。",
        "donor": "BeamShift e2 113–114；依 ADR-004 trust boundary 重寫。",
    },
    {
        "id": "P115", "route": "快速深化", "layout": "transfer",
        "title": "機制遷移至其他 IoT 場域",
        "anchor": "Changing opportunity 仍會形成 send／wait／sleep／batch／urgent 的控制與 service-energy trade-off。",
        "fields": [
            "job（工作量）：application model 產生；packet／task units；定義需完成的工作。",
            "opportunity（可服務機會）：environment trace 產生；time／quality fields；限制 action 時機。",
            "policy（策略）：marked control 提供；enum／threshold；把 observation 映射為 action。",
            "falsifier（反證條件）：hypothesis record 提供；Boolean criterion；指出預測失效的 evidence。",
        ],
        "interpret": "智慧農業、HVAC 或 edge application 需重新定義 service、deadline、traffic 與 energy boundary。",
        "recovery": "只有 label 變更而 boundary 未重定義時，transfer record 維持 incomplete。",
        "donor": "BeamShift e2 2、4、19；僅保留 transfer mechanism。",
    },
    {
        "id": "P116", "route": "交接紀錄", "layout": "record",
        "title": "可重開、可反駁、可追溯的交接紀錄",
        "anchor": "交接狀態由 frozen policy／result identity、workbook reopen state、evidence record 與 claim class 共同決定。",
        "fields": [
            "COMPLETE（完整）：required evidence 全部存在；status、無單位；允許依 bounded claim 交接。",
            "INCOMPLETE（未完整）：至少一個 required gate 缺漏；status、無單位；保留缺口與 recovery target。",
            "claim class（主張分類）：authority record 提供；category；限制可陳述的證據強度。",
        ],
        "interpret": "Donor material 保留為 concept／source trail；current course evidence 由本次 artifact 與 authority 提供。",
        "recovery": "缺漏 gate 返回對應頁或 same-scenario fallback，claim 維持既定 ceiling。",
        "donor": "BeamShift e2 96–97、113–114 與 donor disposition map。",
    },
]


def remove_all_slides(prs: Presentation) -> None:
    for slide_id in list(prs.slides._sldIdLst):
        rel_id = slide_id.rId
        prs.part.drop_rel(rel_id)
        prs.slides._sldIdLst.remove(slide_id)


def _font_xml(run, face: str) -> None:
    r_pr = run._r.get_or_add_rPr()
    for tag in ("a:latin", "a:ea", "a:cs"):
        node = r_pr.find(qn(tag))
        if node is None:
            node = r_pr.makeelement(qn(tag), {})
            r_pr.append(node)
        node.set("typeface", face)


def add_mixed_runs(paragraph, text: str, size: float, *, bold: bool = False,
                   italic_tokens: bool = False, color: RGBColor = INK) -> None:
    paragraph.text = ""
    parts = [part for part in TOKEN_RE.split(text) if part]
    for part in parts:
        is_latin = bool(re.fullmatch(TOKEN_RE, part))
        run = paragraph.add_run()
        run.text = part
        run.font.name = LATIN_FONT if is_latin else CJK_FONT
        _font_xml(run, LATIN_FONT if is_latin else CJK_FONT)
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.italic = italic_tokens and is_latin
        run.font.color.rgb = color


def add_text(slide, x, y, w, h, text, size=24, *, bold=False, color=INK,
             align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP, margin=0.05,
             italic_tokens=False, name=None):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    if name:
        box.name = name
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Inches(margin)
    tf.margin_top = tf.margin_bottom = Inches(margin)
    tf.vertical_anchor = valign
    p = tf.paragraphs[0]
    p.alignment = align
    p.space_after = Pt(0)
    p.space_before = Pt(0)
    add_mixed_runs(p, text, size, bold=bold, italic_tokens=italic_tokens, color=color)
    return box


def set_title(slide, title: str) -> None:
    title_shape = slide.shapes.title
    if title_shape is None:
        title_shape = add_text(slide, 0.718, 0.205, 10.34, 0.525, title, 28, bold=True, color=NAVY)
    else:
        title_shape.left = Inches(0.718)
        title_shape.top = Inches(0.205)
        title_shape.width = Inches(10.348)
        title_shape.height = Inches(0.525)
        tf = title_shape.text_frame
        tf.clear()
        tf.word_wrap = False
        tf.margin_left = tf.margin_right = 0
        tf.margin_top = tf.margin_bottom = 0
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.LEFT
        add_mixed_runs(p, title, 28, bold=True, color=NAVY)


def clear_body_placeholder(slide) -> None:
    for shape in list(slide.placeholders):
        if shape == slide.shapes.title:
            continue
        if shape.shape_type == MSO_SHAPE_TYPE.PLACEHOLDER:
            shape._element.getparent().remove(shape._element)


def add_route(slide, route: str) -> None:
    add_text(slide, 0.72, 0.82, 1.55, 0.27, route, 16, bold=True, color=TEAL,
             valign=MSO_ANCHOR.MIDDLE, name="Route label")


def outline_shape(slide, kind, x, y, w, h, color=NAVY, width=1.5):
    shape = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.fill.background()
    shape.line.color.rgb = color
    shape.line.width = Pt(width)
    return shape


def connector(slide, x1, y1, x2, y2, color=MUTED, width=1.5):
    line = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    line.line.color.rgb = color
    line.line.width = Pt(width)
    line.line.end_arrowhead = True
    return line


def add_anchor(slide, text: str) -> None:
    add_text(slide, 0.76, 1.12, 11.95, 0.72, text, 22, bold=True, color=INK,
             valign=MSO_ANCHOR.MIDDLE, name="Teaching anchor")


def field_row(slide, y: float, text: str, accent=TEAL, size=20.5) -> None:
    dot = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.OVAL, Inches(0.88), Inches(y + 0.11), Inches(0.15), Inches(0.15))
    dot.fill.solid(); dot.fill.fore_color.rgb = accent
    dot.line.fill.background()
    add_text(slide, 1.14, y, 11.45, 0.59, text, size, color=INK, italic_tokens=True,
             valign=MSO_ANCHOR.MIDDLE)


def draw_flow(slide, spec):
    labels = [f.split("（", 1)[0] for f in spec["fields"]]
    n = len(labels)
    width = 10.8 / n
    for i, label in enumerate(labels):
        x = 1.0 + i * width
        outline_shape(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, x, 2.05, width - 0.35, 0.72, TEAL if i % 2 == 0 else NAVY)
        add_text(slide, x + 0.08, 2.10, width - 0.51, 0.58, label, 19 if n == 4 else 20, bold=True,
                 color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, italic_tokens=True)
        if i < n - 1:
            connector(slide, x + width - 0.30, 2.41, x + width + 0.02, 2.41, AMBER)
    if n == 4:
        for idx, text in enumerate(spec["fields"]):
            y = 2.87 + idx * 0.55
            dot = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.OVAL, Inches(0.88), Inches(y + 0.13), Inches(0.13), Inches(0.13))
            dot.fill.solid(); dot.fill.fore_color.rgb = TEAL if idx % 2 == 0 else NAVY
            dot.line.fill.background()
            add_text(slide, 1.12, y, 11.40, 0.54, text, 16.5, color=INK,
                     italic_tokens=True, valign=MSO_ANCHOR.MIDDLE)
    else:
        for idx, text in enumerate(spec["fields"]):
            field_row(slide, 3.00 + idx * 0.64, text, TEAL if idx % 2 == 0 else NAVY, 19.0)


def draw_split(slide, spec):
    mid = max(1, len(spec["fields"]) // 2)
    groups = [spec["fields"][:mid], spec["fields"][mid:]]
    for col, group in enumerate(groups):
        x = 0.92 + col * 6.08
        outline_shape(slide, MSO_AUTO_SHAPE_TYPE.RECTANGLE, x, 2.02, 5.55, 2.78, NAVY if col == 0 else TEAL)
        for idx, text in enumerate(group):
            add_text(slide, x + 0.22, 2.22 + idx * 1.12, 5.11, 0.93, text, 19.5,
                     color=INK, italic_tokens=True, valign=MSO_ANCHOR.MIDDLE)


def draw_gate(slide, spec):
    n = len(spec["fields"])
    for idx, text in enumerate(spec["fields"]):
        y = 1.98 + idx * (2.75 / n)
        outline_shape(slide, MSO_AUTO_SHAPE_TYPE.HEXAGON, 0.92, y, 1.18, 0.56, TEAL if idx % 2 == 0 else NAVY)
        add_text(slide, 0.98, y + 0.06, 1.05, 0.42, f"G{idx+1}", 18, bold=True,
                 color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE)
        add_text(slide, 2.32, y - 0.01, 10.1, 0.61, text, 19.5, color=INK,
                 italic_tokens=True, valign=MSO_ANCHOR.MIDDLE)


def draw_compare(slide, spec):
    left = spec["fields"][:2]
    right = spec["fields"][2:]
    for x, group, color, label in ((0.92, left, NAVY, "型態 A"), (6.77, right, TEAL, "型態 B／判讀")):
        add_text(slide, x, 1.96, 5.55, 0.38, label, 20, bold=True, color=color, align=PP_ALIGN.CENTER)
        outline_shape(slide, MSO_AUTO_SHAPE_TYPE.RECTANGLE, x, 2.37, 5.55, 2.47, color)
        for idx, text in enumerate(group):
            add_text(slide, x + 0.22, 2.58 + idx * 1.02, 5.1, 0.88, text, 19.5, color=INK,
                     italic_tokens=True, valign=MSO_ANCHOR.MIDDLE)


def draw_matrix(slide, spec):
    for idx, text in enumerate(spec["fields"]):
        x = 0.92 + idx * 4.05
        color = [NAVY, TEAL, AMBER][idx % 3]
        outline_shape(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, x, 2.08, 3.68, 2.65, color)
        label = text.split("：", 1)[0]
        rest = text.split("：", 1)[1] if "：" in text else text
        add_text(slide, x + 0.18, 2.27, 3.32, 0.63, label, 19.5, bold=True, color=color,
                 align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, italic_tokens=True)
        add_text(slide, x + 0.22, 3.01, 3.24, 1.45, rest, 18.5, color=INK,
                 align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.MIDDLE, italic_tokens=True)


def draw_record(slide, spec):
    outline_shape(slide, MSO_AUTO_SHAPE_TYPE.RECTANGLE, 0.92, 2.0, 11.45, 2.91, NAVY)
    for idx, text in enumerate(spec["fields"]):
        y = 2.18 + idx * 0.84
        add_text(slide, 1.17, y, 10.95, 0.68, text, 19.5, color=INK,
                 italic_tokens=True, valign=MSO_ANCHOR.MIDDLE)
        if idx < len(spec["fields"]) - 1:
            line = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(1.16), Inches(y + 0.71), Inches(12.08), Inches(y + 0.71))
            line.line.color.rgb = PALE
            line.line.width = Pt(1)


def draw_quadrants(slide, spec):
    positions = [(0.92, 2.0), (6.76, 2.0), (0.92, 3.45), (6.76, 3.45)]
    colors = [NAVY, TEAL, AMBER, RED]
    for idx, text in enumerate(spec["fields"]):
        x, y = positions[idx]
        outline_shape(slide, MSO_AUTO_SHAPE_TYPE.RECTANGLE, x, y, 5.56, 1.23, colors[idx])
        add_text(slide, x + 0.20, y + 0.12, 5.16, 0.98, text, 18.5, color=INK,
                 italic_tokens=True, valign=MSO_ANCHOR.MIDDLE)


def draw_timeline(slide, spec):
    y = 2.33
    line = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(1.28), Inches(y), Inches(12.02), Inches(y))
    line.line.color.rgb = NAVY; line.line.width = Pt(2)
    n = len(spec["fields"])
    for idx, text in enumerate(spec["fields"]):
        x = 1.35 + idx * (10.35 / max(1, n - 1))
        dot = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.OVAL, Inches(x - 0.14), Inches(y - 0.14), Inches(0.28), Inches(0.28))
        dot.fill.solid(); dot.fill.fore_color.rgb = TEAL if idx % 2 == 0 else AMBER
        dot.line.fill.background()
        box_x = 0.88 + idx * 4.06
        outline_shape(slide, MSO_AUTO_SHAPE_TYPE.RECTANGLE, box_x, 2.70, 3.58, 2.12,
                      [NAVY, TEAL, AMBER][idx % 3])
        add_text(slide, box_x + 0.18, 2.88, 3.22, 1.76, text, 17.5, color=INK,
                 align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.MIDDLE, italic_tokens=True)


def draw_boundary(slide, spec):
    x_positions = [0.82, 3.88, 6.94, 10.0]
    for idx, text in enumerate(spec["fields"]):
        color = [NAVY, TEAL, AMBER, RED][idx]
        outline_shape(slide, MSO_AUTO_SHAPE_TYPE.RECTANGLE, x_positions[idx], 2.08, 2.55, 2.85, color)
        add_text(slide, x_positions[idx] + 0.16, 2.28, 2.23, 2.40, text, 18.0, color=INK,
                 align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, italic_tokens=True)
        if idx < 3:
            connector(slide, x_positions[idx] + 2.57, 3.48, x_positions[idx] + 2.98, 3.48, MUTED)


def draw_transfer(slide, spec):
    labels = ["LEO window", "智慧農業", "HVAC", "edge"]
    positions = [0.82, 3.88, 6.94, 10.0]
    for idx, (label, x) in enumerate(zip(labels, positions)):
        outline_shape(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, x, 2.00, 2.50, 0.70, TEAL if idx % 2 == 0 else AMBER)
        add_text(slide, x + 0.10, 2.07, 2.30, 0.53, label, 18.5, bold=True, color=INK,
                 align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, italic_tokens=True)
        if idx < 3:
            connector(slide, x + 2.52, 2.35, positions[idx + 1] - 0.08, 2.35, MUTED)
    for idx, text in enumerate(spec["fields"]):
        col = idx % 2
        row = idx // 2
        x = 0.92 + col * 6.06
        y = 2.92 + row * 1.00
        outline_shape(slide, MSO_AUTO_SHAPE_TYPE.RECTANGLE, x, y, 5.54, 0.84,
                      NAVY if col == 0 else TEAL)
        add_text(slide, x + 0.17, y + 0.09, 5.20, 0.65, text, 16.5, color=INK,
                 align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.MIDDLE, italic_tokens=True)


DRAWERS = {
    "flow": draw_flow,
    "split": draw_split,
    "gate": draw_gate,
    "compare": draw_compare,
    "matrix": draw_matrix,
    "record": draw_record,
    "quadrants": draw_quadrants,
    "timeline": draw_timeline,
    "ledger": draw_matrix,
    "boundary": draw_boundary,
    "transfer": draw_transfer,
}


def add_interpretation(slide, spec):
    y = 5.13
    line = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(0.92), Inches(y), Inches(12.38), Inches(y))
    line.line.color.rgb = TEAL; line.line.width = Pt(1.6)
    add_text(slide, 0.92, 5.18, 11.46, 0.70, f"判讀｜{spec['interpret']}", 17.5, color=INK,
             valign=MSO_ANCHOR.MIDDLE, italic_tokens=True)
    add_text(slide, 0.92, 5.92, 11.46, 0.58, f"恢復｜{spec['recovery']}", 16.5, color=MUTED,
             valign=MSO_ANCHOR.MIDDLE, italic_tokens=True)


def add_notes(slide, spec):
    fields = "；".join(spec["fields"])
    notes = (
        f"{spec['title']}。{spec['anchor']}"
        f"欄位依序解讀如下：{fields}"
        f"判讀結論為：{spec['interpret']}"
        f"遇到契約缺漏時採用以下恢復路徑：{spec['recovery']}"
        f"概念來源為 {spec['donor']}。Donor 只提供概念與敘事位置，current evidence 仍以課程 authority 與目前 artifact 為準。"
    )
    tf = slide.notes_slide.notes_text_frame
    tf.text = notes
    for p in tf.paragraphs:
        for run in p.runs:
            run.font.name = CJK_FONT
            run.font.size = Pt(14)


def overlay_template_parts(path: Path) -> None:
    """Restore the exact educate master/layout/theme/media parts after save."""
    with zipfile.ZipFile(TEMPLATE) as source, zipfile.ZipFile(path, "r") as old:
        data = {info.filename: old.read(info.filename) for info in old.infolist()}
        infos = {info.filename: copy.copy(info) for info in old.infolist()}
        prefixes = (
            "ppt/slideLayouts/", "ppt/slideMasters/", "ppt/theme/",
            "ppt/media/", "ppt/notesMasters/",
        )
        for info in source.infolist():
            if info.filename.startswith(prefixes):
                data[info.filename] = source.read(info.filename)
                infos[info.filename] = copy.copy(info)
    temporary = path.with_suffix(".overlay.pptx")
    with zipfile.ZipFile(temporary, "w", zipfile.ZIP_DEFLATED) as target:
        for name, payload in data.items():
            target.writestr(infos[name], payload)
    temporary.replace(path)


def build() -> None:
    prs = Presentation(str(TEMPLATE))
    remove_all_slides(prs)
    layout = prs.slide_layouts[1]
    for spec in SLIDES:
        slide = prs.slides.add_slide(layout)
        set_title(slide, spec["title"])
        clear_body_placeholder(slide)
        add_route(slide, spec["route"])
        add_anchor(slide, spec["anchor"])
        DRAWERS[spec["layout"]](slide, spec)
        add_interpretation(slide, spec)
        add_notes(slide, spec)
    prs.core_properties.title = "LoRaEnergySim + LEO ALT 技術附錄"
    prs.core_properties.subject = "P098-P116 donor-tail review"
    prs.core_properties.author = "OpenAI Codex"
    prs.save(str(OUTPUT))
    overlay_template_parts(OUTPUT)

    SOURCE_MAP.write_text(json.dumps([
        {"slide": idx + 1, "page_id": spec["id"], "route": spec["route"],
         "donor_source": spec["donor"], "authority": "ADR-004 / C120 SDD / ALT handoff"}
        for idx, spec in enumerate(SLIDES)
    ], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    BUILD_REPORT.write_text(json.dumps({
        "status": "INITIAL_EDITABLE_REVIEW",
        "output": str(OUTPUT),
        "template": str(TEMPLATE),
        "template_sha256": "3a90b0106c6587d720b5a46c653a31937ccd649b30890563c70a53c4cc5d25b8",
        "slide_count": len(SLIDES),
        "layout_contract": "all slides relate to slideLayout2.xml",
        "title_pt": 28,
        "body_pt_range": [18, 22],
        "background_fill": "unset",
        "speaker_notes": len(SLIDES),
        "current_evidence": "neutral placeholders where evidence is not frozen",
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    build()
