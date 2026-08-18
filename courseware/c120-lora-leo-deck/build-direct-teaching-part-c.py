#!/usr/bin/env python3
"""Build the native-template direct-teaching Part C deck (P064-P097).

The deck is deliberately editable: code, controls, field maps, gates, lineage
and transfer diagrams are native PowerPoint shapes.  Browser screenshots are
used only as clearly labelled simulated teaching evidence.  The website is
never presented as a Python runner.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path

from PIL import Image, ImageOps, ImageDraw
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE, MSO_CONNECTOR
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt


ROOT = Path(__file__).resolve().parent
TEMPLATE = Path("/home/u24/ppt-master/template/educate.pptx")
PROJECT = ROOT / "projects/direct-teaching-part-c_ppt169_20260811"
EXPORT = PROJECT / "exports/c120-lora-leo-direct-teaching-part-c-editable_20260811.pptx"
RENDER_DIR = PROJECT / "renders"
QA_DIR = PROJECT / "qa"
ANALYSIS_DIR = PROJECT / "analysis"
VALIDATION_DIR = PROJECT / "validation"
SOURCE_MD = ROOT / "teaching-rewrite/part-c-visible-content.md"
FIELD_MD = ROOT / "evidence/browser-field-inventory-20260811/field-interpretation.md"
# Current browser capture is intentionally used for the UI walkthrough pages.
# It is a no-import snapshot: do not turn the empty states into result claims.
# The live-refresh capture supersedes the earlier no-refresh screenshot set.
# All P077-P099 UI crops are regenerated from this 14:12 browser state; the
# README records the empty-import claim boundary and full course URL.
EVIDENCE_DIR = ROOT / "current-browser-evidence/course-20260811-1412-live"
OFFICE_HELPER = Path("/home/u24/.agents/skills/pptx/scripts/office/soffice.py")

CONTENT_BOTTOM = 6.18
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

BOUNDARY = "SIMULATED TEACHING DATA｜NOT LIVE｜NOT MEASURED｜NOT CANONICAL-PARITY-VERIFIED"
RUN_ID = "current-20260811-A-baseline-fallback"


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
    page(65, "原始 student_policy.py：原本的門檻與返回順序", "original", "原始 branch 依序處理窗口、urgent、pacing、batch、wait；每個 action 對應一個程式條件。具體問題：margin 是否改變 urgent branch 的觸發時點？"),
    page(66, "第一輪 compact run／receipt：baseline → candidate", "run1", "第一輪執行 baseline 與 candidate 兩個 exact case；命令完成即保存 stdout 的 result_path，解讀聚焦 edit 與 prediction 的因果鏈。"),
    page(67, "第一次 exact edit：URGENT_MARGIN_S = 5", "edit5", "修改前後的完整句與問題都保留在頁面。只改 URGENT_MARGIN_S，其他 marked block、runner、scenario、schema 與 energy model 保持不動。"),
    page(68, "candidate run 前的 prediction lock", "predict5", "margin 5 的預測包含 urgent action、queue、service／deadline 與 state／endpoint J 的具體值域；每項預測對應明確的 evidence location。"),
    page(69, "第一次 before／after：candidate 的 bit/J 受 gate 約束", "compare2", "這兩筆是 operation contract 的 packaged same-scenario deterministic fallback 參考，fresh measurement claim 不適用。閱讀順序固定為 service、deadline、完整因果句，再描述較低 J 與較高 bit/J。"),
    page(70, "第二次 exact edit：URGENT_MARGIN_S = 30", "edit30", "candidate 的 failure 要保留下來，revision 只針對太晚介入提出修正。修改前後都要問是否能保住 deadline，以及還要一起讀哪些 state／J evidence。"),
    page(71, "revision run 前：較早介入的 prediction", "predict30", "revision 預測較早花 endpoint energy，required packet 於期限前完成。J 上升且 deadline 變成 PASS 時，trade-off 由 delivery、deadline 與 state ledger 定義，結果以完整證據鏈描述。"),
    page(72, "第二輪 compact run／receipt：revision freeze → surprise", "run2", "第二輪執行 revision freeze 與 surprise 兩個 exact case；surprise 沿用 frozen policy，不新增 edit、不重新調參，完成即保存兩個新的 stdout result_path。"),
    page(73, "before／after／revision：三筆結果要沿同一條因果鏈讀", "compare3", "把 baseline、candidate、revision 放在同一個 deterministic fallback ledger。candidate 的 bit/J 優勢被 service／deadline 否決，revision 的改善只屬於固定條件。"),
    page(74, "surprise withheld：policy frozen，邊界條件留存", "surprise", "surprise 的 2,400 bit、5.41 J、3 次重傳與 3 張逾期封包是 fallback 參考。這組結果界定 margin 30 的適用邊界；第三次調參不在規格內。"),
    page(75, "Lab C debrief：service／deadline gate 優先於 J", "gate", "gate-first 階梯收束 Lab C。結論是 urgent margin 改變 deadline／energy trade-off，而且效果依 service condition 而定；結論不延伸為 margin 30 永遠最佳。"),
    page(76, "網站責任：驗證、重播、保存；Python 由 terminal runner 執行", "website", "Leo /course 接收 runner 已產生的 result.json 與配對 replay。網站責任範圍為 validation、replay、workbook 保存；student_policy.py 的執行與驗證歸屬 terminal runner，READY 屬 browser record。"),
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
    page(94, "Prepare 的 READY：browser-local terminal receipt record", "ready", "記錄 READY 表示 terminal 已看見 machine-readable READY；Leo 端維持 browser-local record，Python 執行與驗證歸屬 terminal runner。14:12 live Prepare 目前為尚未記錄；安裝、verify、run、upload 與 Lab 完成由各自 receipt 定義。"),
    page(95, "全站導覽與 fallback loader：按鈕只改畫面狀態", "nav", "全站導覽、語言切換、準備、實驗 A／B／C、證據、學習單與 fallback loader 只改焦點、語言或資料選擇。切頁不會完成 identity、service 或 upload gate。"),
    page(96, "Task lock 與證據按鈕：檢查課程段落，不代替 runner", "tasks", "任務 1–10 的勾選與證據已鎖定是保存狀態，檢查證據並繼續只檢查目前課程段落。它不執行 Python、不重算 replay，也不宣布策略 PASS。"),
    page(97, "Provider replay controls：provider frames 與 endpoint result 分層", "provider_controls", "播放結果、暫停重播、slider、上一畫面和下一個畫面只控制 provider replay。endpoint selector 與 system replay timeline 各自保存 frame identity；兩層時間需分開判讀。"),
    page(98, "current /course：八個 replay 欄位的後四欄", "fields2", "Elapsed、Contact ID、Contact 與 Quality 各自具有來源、值型態、作用與失敗不變項。四欄均隨 endpoint frame selector 更新，Quality 維持 ordinal quality_band 分類。"),
    page(99, "current /course：控制項的讀寫、成功變化與失敗不變項", "control_contract", "Prepare、導覽與 fallback、Workbook、replay 與 task controls 分組說明。每組列出動作、讀取／寫入資料、成功後狀態與驗證失敗時維持不變的資料。"),
]

# Teaching-readability checkpoint.  The existing 36-page export remains the
# legacy review sample; this checkpoint is intentionally written to a new
# output path so that the sample is never overwritten while the controller
# reviews the first eight rewritten pages.
CHECKPOINT_EXPORT = ROOT.parent / "LoRaEnergySim-LEO-Part-C-P064-P071-REWRITE-CHECKPOINT.pptx"
CHECKPOINT_PROJECT_EXPORT = PROJECT / "exports/c120-lora-leo-part-c-p064-p071-rewrite-checkpoint_20260811.pptx"
CHECKPOINT_RENDER_DIR = PROJECT / "renders/p064-p071-rewrite-checkpoint"
FULL_REWRITE_PROJECT_EXPORT = PROJECT / "exports/c120-lora-leo-part-c-teaching-rewrite-review_20260811.pptx"
# Keep the full-rewrite candidate entirely inside the Part C project lane.
# The controller owns any outer courseware/LATEST publication and this builder
# must never copy a review candidate into that shared directory.
FULL_REWRITE_EXPORT = FULL_REWRITE_PROJECT_EXPORT
FULL_REWRITE_RENDER_DIR = PROJECT / "renders/teaching-rewrite-review"

# The small field helpers normally shorten repetitive prose to keep legacy
# pages compact.  The current /course walkthrough pages (P085-P099) are a
# read-aloud contract, so they must retain complete clauses and never render
# an ellipsis.  This is set while each full-rewrite page is drawn and leaves
# the earlier teaching pages unchanged.
ACTIVE_RW_PAGE = 0

CHECKPOINT_PAGES = [
    page(64, "Lab C：資料等待、期限與耗能的取捨", "rw64", "Lab C 以同一個服務窗口串起佇列、批次、急件、完成期限與端點能量。判讀順序由工作是否完成、期限是否通過、送達資料與端點 J 組成。"),
    page(65, "原始程式：門檻與分支的判斷順序", "rw65", "原始 student_policy.py 由窗口、急件、節奏、批次與等待分支組成。每個分支的中文作用、輸入條件與返回 action 都在頁面上對應。"),
    page(66, "第一輪 run：baseline 與 candidate 的檔案收據", "rw66", "baseline 使用原始 policy 建立比較 control，candidate 使用 margin 5 的 policy 產生第二筆 result。每條命令都關聯 result.json、事件 replay 與下一階段的判讀位置。"),
    page(67, "exact edit 1：急件門檻由 20 秒改為 5 秒", "rw67", "URGENT_MARGIN_S 定義急件距離期限的剩餘秒數門檻；唯一修改由 20 改為 5。修改前後的完整句、具體問題、action timing 與 service 欄位形成同一條因果鏈。"),
    page(68, "margin 5：四個可觀察欄位的預測", "rw68", "margin 5 的預測連接 action 時點、佇列與封包、服務／期限以及端點 J。每個欄位都標出來源、值型態或單位、作用與 run 後判讀。"),
    page(69, "baseline 與 candidate：gate-first 的比較", "rw69", "兩筆 deterministic fallback 來自同一情境與固定 operation contract。服務、期限、送達資料、端點能量與效率都有中文欄名、單位、來源類型與判讀。"),
    page(70, "exact edit 2：急件門檻由 5 秒修訂為 30 秒", "rw70", "revision 將門檻由 5 改為 30，保留 candidate 的失敗紀錄並改變 urgent action 的觸發時點。修改前後的完整句與問題連接 deadline、送達資料與端點 J。"),
    page(71, "margin 30：修訂後的受控預測", "rw71", "margin 30 的預測描述較早 urgent action、required packet、deadline 與端點能量的方向。結果判讀以 service、delivery、state ledger 與 endpoint J 的共同 evidence 定義。"),
]

CHECKPOINT_AUDIT = [
    (64, "時序圖：資料等待 → 急件 → 送出 → 服務判定", "queue 佇列／deadline 完成期限／endpoint energy 端點能量", "queue：工作項數；deadline：剩餘時間；energy：J", "來源為 Lab C service window；描述 action 造成的事件順序", "服務與期限通過後，才比較送達資料與端點 J"),
    (65, "marked code 與五段 branch callout", "BATCH_SIZE 批次大小／URGENT_MARGIN_S 急件門檻／SEND_URGENT 急件送出／WAIT 等待", "BATCH_SIZE=3；URGENT_MARGIN_S=20 秒；action 為列舉值", "來源為 student_policy.py；依判斷順序返回 action", "窗口與 urgent 條件成立時，後面的 pacing／batch 分支不接手"),
    (66, "兩條命令與檔案收據流程", "baseline 原始 control／candidate 修改後案例／result.json 結果檔／replay 事件重播", "case 為文字標籤；result_path 為檔案路徑；replay 為事件序列", "來源為 terminal runner；產生配對 result 與 replay 供匯入及判讀", "收據只定位 artifact；下一階段以 service、deadline 與事件讀取結果"),
    (67, "before／after code 與門檻刻度", "URGENT_MARGIN_S 急件剩餘秒數門檻／urgent_due_in_s 剩餘秒數／SEND_URGENT 急件送出", "20 秒 → 5 秒；條件為 urgent_due_in_s ≤ 門檻", "來源為 student_policy.py marked line；決定 urgent branch 觸發時點", "5 秒使觸發更接近期限，送達與 service 結果待 run 證據判定"),
    (68, "四列 prediction-to-evidence map", "action timing 動作時點／queue packet 佇列封包／service deadline 服務期限／endpoint J 端點能量", "event trace；queue/count 與 bit；PASS/FAIL；J", "來源為 result、replay、state ledger；把預測連到可觀察欄位", "任何 gate 失敗都改變『只是節能』的判讀"),
    (69, "帶中文欄名的 baseline／candidate ledger", "service 服務結果／deadline 期限結果／delivered bits 已送達位元／endpoint J 端點能量／bit/J 能量效率", "PASS/FAIL；PASS/FAIL；bit；J；bit/J", "來源為同情境 deterministic fallback；固定 scenario 與 energy scope", "candidate 效率較高但兩個 gate FAIL；gate 狀態保留為主判讀"),
    (70, "修訂前後門檻與 action timing", "revision 修訂 policy／deadline 完成期限／delivery 送達資料／endpoint J 端點能量", "5 秒 → 30 秒；deadline PASS/FAIL；bit；J", "來源為 marked line 與第二輪 run；只改門檻，保留其他 block", "較早 urgent action 可能增加 J；是否保住 deadline 由第二輪結果決定"),
    (71, "margin 30 的 prediction chain", "freeze policy 凍結 policy／required packet 必要封包／state ledger 狀態帳／service gate 服務閘門", "policy bytes 不變；bit；事件列；PASS/FAIL", "來源為 revision receipt、result、replay 與 ledger；固定條件下比較", "deadline PASS 且 J 上升呈現服務／能量取捨；單一效率值不取代 gate"),
]


@dataclass(frozen=True)
class RewritePage:
    label: str
    title: str
    kind: str
    notes: str


def rpage(label: str, title: str, kind: str, notes: str) -> RewritePage:
    return RewritePage(label, title, kind, notes)


FULL_REWRITE_PAGES = [
    rpage("P064", "Lab C：資料等待、期限與耗能的取捨", "rw64", CHECKPOINT_PAGES[0].notes),
    rpage("P065", "原始程式：完整 marked block", "rw65", "原始 student_policy.py 顯示完整 marked block、BATCH_SIZE = 3、URGENT_MARGIN_S = 20 與 marker 外分支入口。這頁只保留 code，避免 branch 卡片遮住 end marker。"),
    rpage("P065-B", "原始程式：marker 外 consumer branch 與後續分支", "rw65branch", "consumer branch 位於 marked block 外，逐字保留 observation.urgent_pending、observation.urgent_due_in_s 與 SEND_URGENT。窗口、pacing、batch、WAIT 只在 urgent 條件不成立時判讀。"),
    rpage("P066", "第一輪 run：baseline 與 candidate 的檔案收據", "rw66", CHECKPOINT_PAGES[2].notes),
    rpage("P067", "exact edit 1：急件門檻由 20 秒改為 5 秒", "rw67", CHECKPOINT_PAGES[3].notes),
    rpage("P067-B", "exact edit 1：備份、編輯與語法檢查", "rw67commands", "在 lora-energy-lab/ 根目錄保存 before-C-edit 備份，分列 WSL／POSIX 與 Windows PowerShell 的編輯及 py_compile 命令。py_compile 只檢查語法，run、policy guard、result_path 與 endpoint-replay.json 才驗證行為。"),
    rpage("P068", "margin 5：四個可觀察欄位的預測", "rw68", CHECKPOINT_PAGES[4].notes),
    rpage("P069", "baseline 與 candidate：gate-first 的比較", "rw69", CHECKPOINT_PAGES[5].notes),
    rpage("P070", "exact edit 2：急件門檻由 5 秒修訂為 30 秒", "rw70", CHECKPOINT_PAGES[6].notes),
    rpage("P070-B", "exact edit 2：修訂備份、編輯與語法檢查", "rw70commands", "在 lora-energy-lab/ 根目錄保存 distinct before-C-revision 備份，分列 WSL／POSIX 與 Windows PowerShell 命令。py_compile 只檢查語法，revision freeze run、policy guard、result_path 與 endpoint-replay.json 驗證行為。"),
    rpage("P071", "margin 30：修訂後的受控預測", "rw71", CHECKPOINT_PAGES[7].notes),
    rpage("P072", "第二輪 run：revision freeze 與 surprise", "rw72", "第二輪執行 revision 與 surprise；revision 的 policy bytes 維持固定，surprise 使用同一 policy 讀取新的 service condition。每個 result_path 與 replay 都保存為獨立 artifact。"),
    rpage("P073-A", "服務與期限結果：三筆案例的 gate", "rw73gates", "三筆 deterministic fallback 依 service、deadline、delivery 排列。這組 gate 結果提供策略判讀的條件，能量欄位放在下一頁。"),
    rpage("P073-B", "能量與效率結果：三筆案例的 endpoint ledger", "rw73energy", "endpoint J 與 bit/J 來自同一組固定條件。效率數值描述端點代價，不能替換三筆案例的 service／deadline 狀態。"),
    rpage("P073-C", "唯一修改如何改變 state 與 packet 事件", "rw73causal", "三筆結果回到同一條 event chain：門檻、action、state、packet、delivery 與 endpoint J。這頁將數值比較還原為可觀察機制。"),
    rpage("P074", "surprise：frozen policy 的適用邊界", "rw74", "surprise 保留 margin 30 的 frozen policy，並呈現新的 service condition。2,400 bit、5.41 J、3 次重傳與 3 張逾期封包形成條件式判讀。"),
    rpage("P075", "Lab C 結論：service／deadline gate 與 endpoint J", "rw75", "固定條件下，margin 5、30 與 surprise 的 gate 結果共同界定結論。endpoint J 的比較隨 delivery、deadline 與事件鏈一起解讀。"),
    rpage("P076", "執行器、結果檔、課程頁與進度備份", "rw76", "terminal runner 產生 result 與 replay，/course 讀取並驗證 identity，replay 顯示事件，進度備份只保存本機紀錄。READY 只寫 browser-local setup status。"),
    rpage("P077-A", "匯入一：result.json、欄位與單位", "rw77format", "14:12 live Lab A capture 顯示 result.json 選擇器與尚未匯入狀態。這張 crop 只記錄目前空狀態；尚未產生 accepted replay 或 endpoint artifact。"),
    rpage("P077-B", "匯入二：情境、run 與 policy lineage", "rw77lineage", "14:12 live Lab A 仍要求先選 result.json；目前沒有匯入紀錄。experiment、case、run identity 與 policy lineage 是待核對契約，identity 不配對時目前畫面保持。"),
    rpage("P078-A", "frame selector 一：選取畫面與目前 frame", "rw78splitA", "14:12 live Lab A 尚未匯入，故 frame selector 與 current frame 只作欄位契約說明。每欄標出來源、值、作用、成功變化與失敗不變項；沒有 sequence 就不補寫。"),
    rpage("P078-B", "frame selector 二：八欄與 queue／event 分工", "rw78splitB", "八個 replay fields 與 queue／event 的資料責任分開說明。14:12 live capture 沒有 current result，frame identity 或事件值待 result.json 匯入後核對。"),
    rpage("P079-A", "進度備份記錄一：匯入紀錄與本機存檔點", "rw79splitA", "14:12 live 進度備份 capture 顯示 A／B／C 匯入紀錄為 0、本機存檔點為 #0、備份格式為 JSON。這是本機進度紀錄，並不會重算 runner result。"),
    rpage("P079-A2", "進度備份記錄二：來源／角色與復原邊界", "rw79splitB", "來源／角色與復原邊界分開保留資料責任與本機處置。進度備份沒有已保存 runner result；identity 不符時目前紀錄保持。"),
    rpage("P079-B", "進度備份控制一：下載與從備份還原", "rw79saveA", "14:12 live 進度備份提供下載進度備份與從備份還原。成功才寫入本機紀錄；目前備份內容尚未下載。"),
    rpage("P079-B2", "進度備份控制二：建立／還原存檔點與重設", "rw79saveB", "14:12 live 進度備份提供建立本機存檔點、還原本機存檔點與重設本機進度。這些本機 controls 不重算 runner result。"),
    rpage("P080", "本機進度備份：建立、還原、重設的狀態機", "rw80", "建立與還原本機存檔點只讀寫進度備份；重設本機進度改變 local state。這些 controls 不改 runner artifact、service gate 或 replay result。"),
    rpage("P081", "轉移一：智慧農場的灌溉 service gate", "rw81", "智慧農場以水位、作物 freshness 與灌溉期限作為 service condition。pump endpoint J 只在服務條件明確後描述；目前未提供 live farm KPI。"),
    rpage("P082", "轉移二：HVAC 的舒適度與設備期限", "rw82", "HVAC 將 urgent branch 對應舒適度、設備保護與尖峰事件。fan／compressor endpoint J 以宣告 scope 保存，沒有現場量測宣稱。"),
    rpage("P083", "轉移三：edge inference 的 freshness gate", "rw83", "edge inference 將 packet delivery 改為任務 freshness 與完成狀態。edge endpoint Joule 仍跟在 service gate 之後，使用條件式推理。"),
    rpage("P084", "轉移出口：保留可重播的 policy hypothesis", "rw84", "transfer record 保留 condition、branch、event、service、energy scope 與 claim ceiling。workbook export／reopen 維持 lineage，另開 fresh run 需保持 identity。"),
    rpage("P085-A", "匯入資料：source 與 case", "rw85splitA", "14:12 live Lab A 以 source 與 experiment／case 兩欄說明資料責任與情境配對。目前仍是尚未匯入，不宣稱 accepted upload。"),
    rpage("P085-B", "匯入狀態與備用標籤", "rw85splitB", "14:12 live Lab A 的 import state 與 fallback label 分開說明。尚未匯入與同情境備用各自保留 identity 邊界。"),
    rpage("P086-A", "service 與 delivered bits", "rw86splitA", "14:12 live Lab A 沒有 current result。service 與 delivered bits 只說明待匯入欄位契約，值保持待 result.json。"),
    rpage("P086-B", "endpoint J 與 bit/J", "rw86splitB", "14:12 live Lab A 沒有 current result。endpoint J 與 bit/J 只說明 scope、單位與失敗邊界，不填入數值。"),
    rpage("P087-A", "replay fields 一至二", "rw87splitA", "14:12 live Lab A 尚未匯入。Radio 與 Action 是待 replay 欄位契約，不把列舉值當成目前 frame 結果。"),
    rpage("P087-B", "replay fields 三至四", "rw87splitB", "14:12 live Lab A 尚未匯入。Queue count 與累積 endpoint J 只說明來源、單位與 frame identity，待 result.json。"),
    rpage("P088-A", "queue 與事件一", "rw88splitA", "14:12 live Lab A 尚未匯入。queue item 與 event type 分開說明，事件值待 result.json，不補寫未見事件。"),
    rpage("P088-B", "queue 與事件二", "rw88splitB", "14:12 live Lab A 尚未匯入。packet identity 與 delivery state 只定義欄位責任，待配對後才連回 service 與 deadline。"),
    rpage("P089-A", "timeline 一：contact 與 quality", "rw89splitA", "14:12 live Lab A 的時間軸尚未載入 sequence。contact 與 quality 只作欄位契約，不捏造 transition。"),
    rpage("P089-B", "timeline 二：radio 與 policy branch", "rw89splitB", "14:12 live Lab A 尚未匯入。radio state 與 policy branch 待 frame sequence，未知值保持未知。"),
    rpage("P090-A", "execution ledger 一", "rw90splitA", "14:12 live Lab A 的 execution ledger 尚未建立。experiment／case 與 role 只說明配對契約，案例不符時停止更新。"),
    rpage("P090-B", "execution ledger 二", "rw90splitB", "14:12 live Lab A 尚未匯入。service／endpoint J 與 source／selected state 只說明 scope，沒有 current result 可升格。"),
    rpage("P091-A", "Evidence：Leo scene 與空 endpoint replay", "rw91splitA", "14:12 live Evidence capture 顯示真實 Leo scene，但 endpoint replay 區仍為空。scenario metadata 與 endpoint result 分開標示；沒有 replay 就不宣稱結果。"),
    rpage("P091-B", "Evidence：identity 與空 replay 邊界", "rw91splitB", "14:12 live Evidence capture 只提供 Leo scene 與空 endpoint replay。identity 尚待 result.json 配對；不宣稱 accepted result 或 provider PASS。"),
    rpage("P092-A1", "進度備份：下載與建立本機存檔點", "rw92saveSplitA", "14:12 live 進度備份的下載 JSON 與建立本機存檔點分開說明。#0、尚未下載保持誠實，成功才更新本機 record。"),
    rpage("P092-A2", "進度備份：從備份還原與目前紀錄", "rw92saveSplitB", "14:12 live 進度備份的從備份還原與目前紀錄分開說明。沒有備份檔時不宣稱可還原。"),
    rpage("P092-B1", "進度備份：建立與還原本機存檔點", "rw92checkpointSplitA", "14:12 live 進度備份的建立／還原本機存檔點分開說明。本機保存點與 runner artifact 分層。"),
    rpage("P092-B2", "進度備份：重設本機進度與結果邊界", "rw92checkpointSplitB", "14:12 live 進度備份的重設本機進度與 result boundary 分開說明。重設只改 local progress，不重算 endpoint result。"),
    rpage("P093-A", "empty-state／recovery：匯入狀態與配對結果", "rw93splitA", "14:12 live Lab C 是尚未匯入且沒有 replay 的 empty state。empty import state 與 matching artifact 分開說明，rejection result 尚未出現。"),
    rpage("P093-B", "empty-state／recovery：同情境備用", "rw93splitB", "14:12 live Lab C 的 same-scenario fallback 與 empty-state boundary 分開說明。未配對時保留原 session。"),
    rpage("P094-A", "Prepare：READY 與備用環境", "rw94splitA", "14:12 live Prepare capture 顯示目前狀態為尚未記錄；READY 與 fallback source 分開說明。兩個按鈕尚待操作，browser-local state 不等於 terminal receipt。"),
    rpage("P094-B", "Prepare：terminal receipt 與完成邊界", "rw94splitB", "14:12 live Prepare capture 沒有 terminal receipt。install、verify、run、upload 各由自身 receipt 定義，失敗時 browser-local status 保持。"),
    rpage("P095-A1", "導覽：global navigation 與語言", "rw95navSplitA", "14:12 live Lab A capture 的 global navigation 與 language controls 分開說明。按鈕只改 focus 或 language。"),
    rpage("P095-A2", "導覽：Lab tabs 與結果邊界", "rw95navSplitB", "14:12 live tabs 已改為準備、實驗 A／B／C、證據、進度備份。切頁不重寫 endpoint result。"),
    rpage("P095-B1", "fallback loader：選取與來源", "rw95fallbackSplitA", "14:12 live Lab B 是 empty state。fallback loader 與 selected source 分開說明，沒有從空白狀態宣稱 selected result。"),
    rpage("P095-B2", "fallback loader：identity 配對與空狀態", "rw95fallbackSplitB", "14:12 live Lab B 的 identity match 與 empty-state boundary 分開說明。未配對時原 result 保持。"),
    rpage("P096-A", "進度備份：下載與建立本機存檔點", "rw96splitA", "14:12 live 進度備份的下載進度備份與建立本機存檔點分開說明。#0、0 筆匯入紀錄保持為 browser-local record。"),
    rpage("P096-B", "進度備份：還原與重設本機進度", "rw96splitB", "14:12 live 進度備份的從備份還原與重設本機進度分開說明。條件不足時不執行 Python、不重算 replay。"),
    rpage("P097-A", "provider replay controls 一：播放與暫停", "rw97splitA", "14:12 live Evidence 有 Leo scene 但 endpoint replay 空白；play 與 pause 只作 replay controls 契約說明。provider cursor identity 保持獨立。"),
    rpage("P097-B", "provider replay controls 二：滑桿與端點 selector", "rw97splitB", "14:12 live Evidence 的 endpoint replay 尚未匯入；slider／鄰接畫面與 endpoint selector 分開說明。兩層 frame identity 不混讀。"),
    rpage("P098-A", "replay fields 五至六", "rw98splitA", "14:12 live Lab A 尚未匯入。Elapsed 與 Contact ID 是待 replay 欄位契約，未見 frame 不補值。"),
    rpage("P098-B", "replay fields 七至八", "rw98splitB", "14:12 live Lab A 尚未匯入。Contact 與 ordinal Quality 是待 replay 欄位契約，Quality 不宣稱 dB 量測。"),
    rpage("P099-A", "控制契約一：Prepare 與 Import", "rw99prepare", "Prepare 與 Import controls 讀取 terminal receipt、repository、source 與 identity，成功後更新 browser-local status 或 import state。驗證失敗時原 state 保持。"),
    rpage("P099-B", "控制契約二：Replay 與進度備份", "rw99replay", "Replay 與進度備份 controls 讀寫 selected frame、cursor、本機存檔點與 lineage。成功後更新對應畫面或 record，失敗時原值保留。"),
    rpage("P099-C", "控制契約三：Task 與證據狀態", "rw99task", "Task controls 讀取 evidence condition，寫入 completion 與 lock。進度備份只保存本機進度與 A／B／C 匯入紀錄，不執行 Python。"),
]


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
    tf.clear()
    tf.word_wrap = True
    # Native editable text needs a predictable ink box.  The educate shell
    # already supplies the visual separation; padding inside the small field
    # cards only steals line height and makes CJK glyphs escape their panels.
    tf.margin_left = Inches(0.04)
    tf.margin_right = Inches(0.04)
    tf.margin_top = Inches(0.0)
    tf.margin_bottom = Inches(0.0)
    tf.vertical_anchor = valign
    for index, line_value in enumerate(value.split("\n")):
        paragraph = tf.paragraphs[0] if index == 0 else tf.add_paragraph()
        paragraph.alignment = align
        paragraph.space_after = Pt(0)
        paragraph.line_spacing = 0.94
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
    # Make the externally readable course route unambiguous on every authored
    # title, field, caption, and note-derived sentence.
    if "http://120.126.151.102:3000/course" not in value:
        value = value.replace("/course", "http://120.126.151.102:3000/course")
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
    if "http://120.126.151.102:3000/course" not in value:
        value = value.replace("/course", "http://120.126.151.102:3000/course")
    write_text(title.text_frame, value, 28, bold=True, color=NAVY, valign=MSO_ANCHOR.MIDDLE, italic_code=False)


def stamp(slide, text: str = BOUNDARY) -> None:
    text_box(slide, 0.72, 5.86, 11.80, 0.27, text, 18, bold=True, color=RED,
             align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Claim boundary", italic_code=False)


def lead(slide, value: str, *, color=NAVY, size: int = 24) -> None:
    # Rewritten pages place the teaching topic in the native title anchor.
    # Suppress an identical second line so the visible area carries mechanism
    # and field explanations instead of repeating the heading.
    title_text = slide.shapes.title.text if slide.shapes.title is not None else ""
    if title_text and (
        title_text == value
        or title_text.endswith("｜" + value)
        or title_text.split("｜", 1)[-1].strip() == value
    ):
        return
    text_box(slide, 0.86, 1.14, 11.62, 0.38, value, size, bold=True, color=color,
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
    text_box(slide, x, y, w, 0.62, value, 18, bold=True, color=color, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE, fill=fill, line_color=color, name=name, italic_code=False)


def image_asset(name: str, crop: tuple[int, int, int, int] | None = None) -> Path:
    asset_dir = PROJECT / "assets"
    asset_dir.mkdir(parents=True, exist_ok=True)
    target = asset_dir / name
    source_names = {
        # The 2026-08-11 browser capture is the only permitted visual source
        # for the current /course walkthrough.  Keep these aliases stable so
        # the page builders remain readable, but never fall back to the stale
        # pre-capture assets that were used by the first rewrite pass.
        "08-header.png": "lab-a.png",
        "08-summary.png": "lab-a.png",
        "08-fields.png": "lab-a.png",
        "08-queue.png": "lab-a.png",
        "08-ledger.png": "lab-a.png",
        "03-fallback.png": "lab-b.png",
        "04-provider.png": "evidence.png",
        "05-workbook.png": "progress-backup.png",
        "06-timeline.png": "lab-a.png",
        "09-ready.png": "prepare.png",
        "00-prepare.png": "prepare.png",
        "07-empty-lab-c.png": "lab-c.png",
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
    # screenshots as separate, auditable evidence files.  The live-refresh
    # screenshots are 1600x1000; crops below target individual UI regions and
    # never include the forbidden raw digest region from the earlier capture.
    return {
        # Import chooser/status; ends before the source/digest panel.
        "accepted_header": image_asset("08-header.png", (220, 320, 1380, 820)),
        # Summary and replay fields; starts below the source/digest panel.
        "accepted_summary": image_asset("08-summary.png", (820, 360, 1480, 880)),
        "accepted_fields": image_asset("08-fields.png", (180, 320, 1420, 820)),
        # Queue/event and ledger are deliberately short, readable crops rather
        # than a tall page squeezed into one slide.
        "accepted_queue": image_asset("08-queue.png", (180, 610, 1420, 980)),
        "accepted_ledger": image_asset("08-ledger.png", (180, 320, 1420, 820)),
        # Lab B is a current empty-state capture; it is not presented as a
        # completed result.  Lab C is kept separately for the recovery page.
        "fallback": image_asset("03-fallback.png", (220, 320, 1380, 920)),
        "empty_lab_c": image_asset("07-empty-lab-c.png", (220, 320, 1380, 920)),
        # The Evidence capture is a current blank white PNG.  Keep it as an
        # auditable empty capture and explain the missing replay beside it.
        "provider": image_asset("04-provider.png", (180, 320, 1420, 940)),
        "workbook": image_asset("05-workbook.png", (180, 320, 1420, 900)),
        # Current Lab A only exposes the collapsed timeline control in this
        # capture; do not redraw it as a loaded sequence.
        "timeline": image_asset("06-timeline.png", (180, 240, 1420, 340)),
        "ready": image_asset("09-ready.png", (180, 320, 1420, 820)),
        "prepare": image_asset("00-prepare.png", (180, 320, 1420, 820)),
    }


def rw_field_row(slide, y: float, label: str, body: str, *, color=BLUE,
                 x: float = 0.76, w: float = 11.72, h: float = 0.78,
                 label_w: float = 2.28, body_size: int = 20, name="Teaching field"):
    """A readable Chinese definition row used by the checkpoint pages.

    The label carries the first English token together with its Chinese name;
    the body states source, value/unit, operation and interpretation in one
    editable text shape.  This avoids hiding the field contract in notes.
    """
    panel(slide, x, y, w, h, fill=WHITE, line_color=color, name=name + " panel")
    # Keep the label and definition inside the same visual row.  CJK labels
    # frequently wrap to two lines; 18 pt with zero vertical padding is the
    # smallest readable size and prevents glyphs from escaping the border.
    text_box(slide, x + 0.10, y + 0.06, label_w - 0.18, h - 0.12, label, 18,
             bold=True, color=color, align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.MIDDLE,
             name=name + " label", italic_code=False)
    text_box(slide, x + label_w, y + 0.07, w - label_w - 0.12, h - 0.14, compact_contract_text(body), max(18, min(body_size, 20)),
             color=INK, align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP,
             name=name + " explanation")


def _clip_clause(value: str, limit: int) -> str:
    # A field contract is read aloud from the slide.  Never replace a field,
    # command, or interpretation with an ellipsis; callers keep the clause
    # complete and allocate a readable card for it instead.
    value = re.sub(r"\s+", " ", value.strip())
    return value


def compact_contract_text(body: str) -> str:
    """Condense repeated source/value/action prose for a small field card.

    The full teaching explanation remains in speaker notes and the source
    manifest.  On-slide cards carry the minimum observable contract so that
    18 pt native text stays inside its border instead of wrapping into the
    neighbouring row.
    """
    raw = re.sub(r"\s+", " ", body.replace("\n", "；")).strip()
    if ACTIVE_RW_PAGE >= 85:
        # From the edit/run chain onward, the visible field contract is the
        # teaching record itself.  Keep source, value, action, and outcome
        # labels intact; a condensed parser would hide exactly the clause
        # needed to read a result or UI field.
        if ACTIVE_RW_PAGE >= 85 and not re.search(r"成功|失敗", raw):
            raw += "；成功：畫面或 record 更新；失敗：原 state 保持。"
        return raw
    clauses = [c.strip() for c in re.split(r"[；;]+", raw) if c.strip()]
    source = value = meaning = ""
    for clause in clauses:
        if not source and re.match(r"(?:來源|讀取)", clause):
            source = re.sub(r"^(?:來源|讀取)[：:]?\s*", "", clause)
        elif not value and re.match(r"(?:值型態|值|單位|寫入)", clause):
            value = re.sub(r"^(?:值型態|值|單位|寫入)[：:]?\s*", "", clause)
        elif re.match(r"(?:判讀|成功|失敗|作用|用途)", clause):
            cleaned = re.sub(r"^(?:判讀|成功變化|成功|失敗不變|失敗|作用|用途)[：:]?\s*", "", clause)
            meaning = (meaning + "；" + cleaned).strip("；")
    if not source and clauses:
        source = re.sub(r"^[^：:]+[：:]\s*", "", clauses[0])
    if not value and len(clauses) > 1:
        value = re.sub(r"^[^：:]+[：:]\s*", "", clauses[1])
    if not meaning and len(clauses) > 2:
        meaning = re.sub(r"^[^：:]+[：:]\s*", "", clauses[-1])
    result = "來源 " + _clip_clause(source, 16)
    if value:
        result += "；值 " + _clip_clause(value, 16)
    if meaning:
        result += "；" + _clip_clause(meaning, 22)
    # Current /course cards are an on-slide UI contract.  When the source
    # description has no observed success/failure receipt, state the honest
    # contract boundary explicitly instead of implying a result.
    if ACTIVE_RW_PAGE >= 85 and not re.search(r"成功|失敗", raw):
        result += "；Expect 成功更新畫面／record；Interpret 失敗保留原 state"
    return result


def compact_numbered_body(body: str) -> str:
    raw = re.sub(r"\s+", " ", body.replace("\n", "；")).strip()
    if ACTIVE_RW_PAGE >= 85:
        # Keep field labels visible on the UI walkthrough cards.  Removing
        # 來源／值／作用 here would turn a readable contract into shorthand.
        return raw
    # Short single-sentence callouts already fit the card; do not truncate a
    # decisive action such as SEND_URGENT merely because it has no separators.
    if "；" not in raw and ";" not in raw and len(raw) <= 64:
        return raw
    # Numbered cards are action receipts or branch explanations.  Keep every
    # clause: commands, paths, and the observable interpretation are part of
    # the slide contract and must never be replaced by a shorthand.
    clauses = [c.strip() for c in re.split(r"[；;]+", raw) if c.strip()]
    cleaned = []
    for clause in clauses:
        clause = re.sub(r"^(?:來源|值型態|值|單位|作用|判讀|命令|policy|輸出|用途|輸入|動作|成功變化|失敗不變|成功|失敗)[：:]?\s*", "", clause)
        cleaned.append(_clip_clause(clause, 25))
    return "；".join(cleaned) if cleaned else _clip_clause(raw, 72)


def rw_sentence(slide, y: float, text: str, *, color=NAVY, size: int = 21,
                x: float = 0.82, w: float = 11.56, h: float = 0.62, name="Teaching sentence"):
    panel(slide, x, y, w, h, fill=CREAM, line_color=color, name=name + " panel")
    text_box(slide, x + 0.16, y + 0.06, w - 0.32, h - 0.12, text, size, bold=True,
             color=color, align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.MIDDLE,
             name=name + " text", italic_code=False)


def rw_numbered(slide, x: float, y: float, number: str, heading: str, body: str,
                *, color=BLUE, w: float = 5.72, h: float = 0.88, body_size: int = 19,
                name="Numbered teaching callout"):
    panel(slide, x, y, w, h, fill=WHITE, line_color=color, name=name + " panel")
    dot(slide, x + 0.14, y + 0.18, 0.36, color=color, name=name + " number marker")
    text_box(slide, x + 0.14, y + 0.16, 0.36, 0.34, number, 18, bold=True,
             color=WHITE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name=name + " number", italic_code=False)
    text_box(slide, x + 0.64, y + 0.06, w - 0.80, 0.34, heading, 18, bold=True,
             color=color, align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.MIDDLE,
             name=name + " heading", italic_code=False)
    # Keep heading and body in disjoint vertical bands.  Vertical centering
    # let multi-line bodies rise into the heading and, on dense pages, cross
    # the next card; top anchoring makes the contract readable and bounded.
    text_box(slide, x + 0.64, y + 0.46, w - 0.80, max(0.32, h - 0.50), compact_numbered_body(body), max(18, min(body_size, 19)),
             color=INK, align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP,
             name=name + " body")


def rw_code(slide, x: float, y: float, w: float, h: float, value: str, *, name="Teaching code", size: int = 20):
    panel(slide, x, y, w, h, fill=CREAM, line_color=NAVY, name=name + " panel")
    text_box(slide, x + 0.18, y + 0.14, w - 0.36, h - 0.28, value, size, color=INK,
             align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP, name=name + " text", italic_code=True)


def rw_command_box(slide, x: float, y: float, w: float, heading: str, command: str, *, color=BLUE, name="Command box"):
    """A separate, copyable command box for Windows or WSL/POSIX runs."""
    panel(slide, x, y, w, 0.92, fill=CREAM, line_color=color, name=name + " panel")
    text_box(slide, x + 0.16, y + 0.08, w - 0.32, 0.25, heading, 18, bold=True,
             color=color, align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.MIDDLE,
             name=name + " heading", italic_code=False)
    text_box(slide, x + 0.16, y + 0.38, w - 0.32, 0.42, command, 18, color=INK,
             align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP, name=name + " command", italic_code=True)


def rw_callout_tag(slide, x: float, y: float, value: str, *, color=RED, w: float = 0.52,
                   name="Screenshot callout"):
    dot(slide, x, y, w, color=color, name=name + " marker")
    text_box(slide, x, y + 0.03, w, w - 0.04, value, 18, bold=True, color=WHITE,
             align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=name + " number", italic_code=False)


def rw_source_label(slide, text: str, *, y: float = 5.62, color=MUTED):
    text_box(slide, 0.90, y, 11.18, 0.28, text, 18, color=color,
             align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Evidence source label", italic_code=False)


def draw_rw64(slide):
    lead(slide, "Lab C：資料等待、期限與耗能的取捨")
    panel(slide, 0.76, 1.32, 7.16, 3.78, fill=PALE_BLUE, line_color=BLUE, name="Lab C queue timeline")
    text_box(slide, 1.00, 1.54, 6.68, 0.42, "queue（佇列）中的工作沿 service window（服務窗口）移動", 21,
             bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name="Queue timeline heading", italic_code=False)
    connector(slide, 1.30, 3.16, 7.34, 3.16, color=NAVY, width=2.1, arrow=True)
    stages = [("一般資料", "可等待 batch", 1.22, BLUE), ("急件", "接近期限", 3.06, PURPLE), ("送出", "action 產生 packet", 4.92, TEAL), ("完成", "service 判定", 6.72, GOLD)]
    for heading, body, x, color in stages:
        dot(slide, x, 3.00, 0.32, color=color, name="Queue stage marker")
        text_box(slide, x - 0.48, 2.14, 1.30, 0.38, heading, 18, bold=True, color=color,
                 align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Queue stage heading", italic_code=False)
        text_box(slide, x - 0.68, 3.48, 1.70, 0.72, body, 18, color=INK,
                 align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.TOP, name="Queue stage body", italic_code=False)
    rw_field_row(slide, 1.32, "deadline\n完成期限", "來源：observation；值：秒；判讀：期限通過才算 service PASS。", color=PURPLE, x=8.18, w=4.38, h=1.04, label_w=1.52, body_size=18, name="Lab C deadline definition")
    rw_field_row(slide, 2.54, "endpoint J\n端點能量", "來源：endpoint scope；值：J；判讀：只描述端點代價，不取代 service。", color=GOLD, x=8.18, w=4.38, h=1.04, label_w=1.52, body_size=18, name="Lab C energy definition")
    rw_sentence(slide, 3.82, "因果句：action 改變 packet 完成時點；service／deadline 定義結果，endpoint J 描述代價。", size=18, x=8.18, w=4.38, h=1.22, name="Lab C causal sentence")
    rw_sentence(slide, 5.34, "問題：bit/J 變高但急件逾期時，先回到哪個 gate？", size=18, x=0.90, w=11.18, h=0.42, name="Lab C question")


def draw_rw65(slide):
    lead(slide, "student_policy.py：exact marked block 與 urgent consumer")
    code = ("student_policy.py\n"
            "# === LORA EDITABLE: lab-c-batch-urgent ===\n"
            "BATCH_SIZE = 3\n"
            "URGENT_MARGIN_S = 20\n"
            "# === LORA END EDITABLE: lab-c-batch-urgent ===")
    rw_code(slide, 0.76, 1.18, 12.00, 1.62, code, name="Original student_policy code", size=18)
    rw_code(slide, 0.76, 2.98, 12.00, 1.36,
            "def choose_action(observation):\n"
            "    if observation.urgent_pending and observation.urgent_due_in_s <= URGENT_MARGIN_S:\n"
            "        return SEND_URGENT",
            name="Original urgent branch source", size=18)
    rw_sentence(slide, 4.58,
                "BATCH_SIZE = 3 固定批次門檻；URGENT_MARGIN_S = 20 是 baseline 門檻。choose_action(observation) 在急件剩餘期限小於等於門檻時回傳 SEND_URGENT。",
                size=20, x=0.82, w=11.54, h=0.72, name="Original source explanation")
    rw_sentence(slide, 5.46,
                "後續只修改 URGENT_MARGIN_S：20 → 5 → 30；BATCH_SIZE 保持 3。",
                size=20, x=0.82, w=11.54, h=0.42, name="Original edit boundary")


def draw_rw66(slide):
    lead(slide, "第一輪 run：baseline 與 candidate 的檔案收據")
    text_box(slide, 0.84, 1.04, 11.64, 0.22, "package root：lora-energy-lab/", 18, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Run package root", italic_code=False)
    rw_command_box(slide, 0.78, 1.38, 5.82, "baseline｜Windows PowerShell", ".\\course.cmd run --lab C --case baseline", color=BLUE, name="Baseline Windows command")
    rw_command_box(slide, 6.78, 1.38, 5.82, "candidate｜Windows PowerShell", ".\\course.cmd run --lab C --case candidate", color=PURPLE, name="Candidate Windows command")
    rw_command_box(slide, 0.78, 2.44, 5.82, "baseline｜WSL/POSIX", "bash course.sh run --lab C --case baseline", color=BLUE, name="Baseline WSL command")
    rw_command_box(slide, 6.78, 2.44, 5.82, "candidate｜WSL/POSIX", "bash course.sh run --lab C --case candidate", color=PURPLE, name="Candidate WSL command")
    rw_field_row(slide, 3.58, "stdout contract（標準輸出）", "來源：runner stdout；值：status、run_id、result_path；作用：定位 result.json；成功：三欄齊全；失敗：原 artifact 保持。", color=TEAL, h=0.76, label_w=2.72, body_size=18, name="Run stdout contract")
    rw_field_row(slide, 4.46, "artifact source（來源邊界）", "來源：result.json header；值：artifact_source、endpoint-replay.json；作用：配對 replay；成功：identity 一致；失敗：claim_boundary 保持。", color=GOLD, h=0.76, label_w=2.72, body_size=18, name="Run artifact source")
    rw_sentence(slide, 5.30, "Expect／Interpret：配對 replay 後讀 service、deadline、action、state、endpoint J；claim_boundary 只對此 artifact，不延伸 live KPI。", size=18, x=0.82, w=11.54, h=0.58, name="Run receipt interpretation")


def draw_rw67(slide):
    lead(slide, "exact edit 1：急件門檻由 20 秒改為 5 秒")
    before_block = ("lora-energy-lab/student_policy.py\n"
                    "# === LORA EDITABLE: lab-c-batch-urgent ===\n"
                    "BATCH_SIZE = 3\nURGENT_MARGIN_S = 20\n"
                    "# === LORA END EDITABLE: lab-c-batch-urgent ===")
    after_block = ("lora-energy-lab/student_policy.py\n"
                   "# === LORA EDITABLE: lab-c-batch-urgent ===\n"
                   "BATCH_SIZE = 3\nURGENT_MARGIN_S = 5\n"
                   "# === LORA END EDITABLE: lab-c-batch-urgent ===")
    rw_code(slide, 0.62, 1.18, 6.18, 1.82, before_block, name="Edit one before code", size=18)
    rw_code(slide, 6.86, 1.18, 6.18, 1.82, after_block, name="Edit one after code", size=18)
    # Use a wide, dedicated label lane so URGENT_MARGIN_S remains a single
    # readable token.  Put the exact consumer branch in its own code panel;
    # it is outside the editable marker and no longer competes with a rail.
    rw_field_row(slide, 3.18, "URGENT_MARGIN_S", "（急件門檻）來源：marked block；值：20 → 5 秒；作用：只改一行；consumer branch 讀此值。", color=PURPLE, h=0.82, label_w=4.10, body_size=18, name="Edit one field definition")
    rw_code(slide, 0.78, 4.16, 12.00, 1.36,
            "marker 外 consumer branch\n"
            "if observation.urgent_pending and observation.urgent_due_in_s <= URGENT_MARGIN_S:\n"
            "    return SEND_URGENT",
            name="Edit one consumer branch", size=18)


def draw_rw68(slide):
    lead(slide, "margin 5：四個可觀察欄位的預測")
    fields = [
        ("action timing（動作時點）", "來源：event trace；值：frame／時間序列；作用：定位 SEND_URGENT；判讀：預測較晚觸發。", BLUE),
        ("queue packet（佇列／封包）", "來源：queue event；值：count、bit；作用：讀等待與送達；晚送增加期限壓力。", PURPLE),
        ("service deadline（服務／期限）", "來源：result summary；值：PASS／FAIL；作用：定義工作結果；判讀：任一 FAIL 改變節能解讀。", RED),
        ("endpoint J（端點能量）", "來源：endpoint ledger；值：J；作用：描述端點代價；少 J 仍要讀送達與 gate。", GOLD),
    ]
    for i, (label, body, color) in enumerate(fields):
        rw_field_row(slide, 1.38 + i * 0.88, label, body, color=color, h=0.74, label_w=2.58, body_size=19, name="Margin five prediction")
    rw_sentence(slide, 5.02, "完整句：margin 5 的機制預測是 urgent 較晚、早期 TX／wake 可能減少，但 delivery 或 deadline 可能失敗。", size=20, x=0.82, w=11.54, h=0.56, name="Margin five prediction sentence")
    rw_sentence(slide, 5.64, "問題：哪一個 gate 結果會改變節能判讀？", size=18, x=0.82, w=11.54, h=0.28, name="Margin five prediction question")


def draw_rw69(slide):
    lead(slide, "baseline 與 candidate：gate-first 的比較")
    # Keep the numeric bit/J column wholly inside the 13.333 in template.
    # The previous six-column total extended past the right edge, clipping
    # the final digits in both rows.
    x0 = 0.62
    widths = [1.90, 1.92, 1.92, 1.88, 1.98, 2.34]
    headers = ["案例／來源", "服務結果\nservice", "期限結果\ndeadline", "已送達\ndelivered bits", "端點能量\nendpoint J", "能量效率\nbit/J"]
    x = x0
    for h, w in zip(headers, widths):
        small_label(slide, x, 1.34, w, h, color=NAVY, fill=CREAM, name="Comparison Chinese header")
        x += w + 0.06
    rows = [
        ("baseline\n固定原始 control", "PASS", "PASS", "10,400 bit", "10.66 J", "975.609756 bit/J", BLUE, PALE_BLUE),
        ("candidate\n同情境 fallback", "FAIL", "FAIL", "9,600 bit", "9.74 J", "985.626283 bit/J", PURPLE, PALE_PURPLE),
    ]
    for i, row in enumerate(rows):
        y = 2.06 + i * 1.10
        x = x0
        for j, (value, w) in enumerate(zip(row[:6], widths)):
            color, fill = row[6], row[7]
            text_box(slide, x, y, w, 0.84, value, 18 if j in (0, 5) else 19, bold=True,
                     color=color if j == 0 else INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
                     fill=fill, line_color=color, name="Comparison value", italic_code=False)
            x += w + 0.06
    rw_source_label(slide, "資料來源：同情境 deterministic fallback；固定 scenario、policy edit 與 endpoint scope。", y=4.42)
    rw_sentence(slide, 4.82, "判讀句：candidate 少交付 800 bit 且 service／deadline FAIL；較高 bit/J 不改寫 gate 結果。", size=21, x=0.82, w=11.54, h=0.58, name="Comparison interpretation")
    rw_sentence(slide, 5.46, "問題：哪兩欄決定工作是否完成？", size=18, x=0.82, w=11.54, h=0.36, name="Comparison question")


def draw_rw70(slide):
    lead(slide, "exact edit 2：急件門檻由 5 秒修訂為 30 秒")
    panel(slide, 0.82, 1.38, 3.72, 3.64, fill=PALE_PURPLE, line_color=PURPLE, name="Revision candidate state")
    text_box(slide, 1.04, 1.62, 3.28, 0.40, "candidate（待修訂狀態）", 21, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Revision candidate heading", italic_code=False)
    rw_code(slide, 1.10, 2.22, 3.16, 1.04, "URGENT_MARGIN_S = 5\nservice = FAIL\ndeadline = FAIL", name="Revision candidate values", size=18)
    text_box(slide, 1.06, 3.82, 3.24, 0.72, "來源：P069 的同情境 fallback。作用：保留失敗條件，作為 revision 的比較輸入。", 19, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Revision candidate explanation", italic_code=False)
    connector(slide, 4.78, 3.20, 5.06, 3.20, color=NAVY, width=2.0, arrow=True)
    panel(slide, 5.22, 1.38, 7.04, 3.64, fill=PALE_TEAL, line_color=TEAL, name="Revision edit state")
    text_box(slide, 5.52, 1.62, 6.44, 0.40, "revision（修訂 policy）：唯一 marked line", 22, bold=True, color=TEAL, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Revision heading", italic_code=False)
    revision_block = ("lora-energy-lab/student_policy.py\n"
                      "# === LORA EDITABLE: lab-c-batch-urgent ===\n"
                      "BATCH_SIZE = 3\nURGENT_MARGIN_S = 30\n"
                      "# === LORA END EDITABLE: lab-c-batch-urgent ===")
    # The five-line marked block needs a taller code region at native size;
    # the one-line edit explanation sits below it instead of being laid over
    # the final end marker or the page conclusion rail.
    rw_code(slide, 5.62, 2.00, 6.24, 1.82, revision_block, name="Revision exact line", size=18)
    text_box(slide, 5.56, 4.06, 6.34, 0.70,
             "來源：marked block；修改前：5；修改後：30；只改一行。marker 外 branch 見 P067。",
             18, color=INK, align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP,
             name="Revision field explanation", italic_code=False)
    rw_sentence(slide, 5.28, "Expect／Interpret：5 → 30 代表較早介入急件；失敗時保留 candidate 原 result。", size=18, x=0.82, w=11.54, h=0.60, name="Revision question")


def draw_rw71(slide):
    lead(slide, "margin 30：修訂後的受控預測")
    panel(slide, 0.78, 1.36, 4.10, 3.76, fill=PALE_GOLD, line_color=GOLD, name="Revision prediction timeline")
    text_box(slide, 1.02, 1.60, 3.62, 0.38, "較早 action 的機制方向", 22, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Revision prediction heading", italic_code=False)
    connector(slide, 1.26, 3.22, 4.44, 3.22, color=GOLD, width=2.0, arrow=True)
    for x, head, body in [(1.22, "urgent", "較早觸發"), (2.66, "packet", "完成機會"), (4.06, "deadline", "期限判定")]:
        dot(slide, x, 3.06, 0.32, color=GOLD, name="Revision prediction marker")
        text_box(slide, x - 0.38, 2.24, 1.10, 0.30, head, 19, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Revision prediction token", italic_code=False)
        text_box(slide, x - 0.56, 3.58, 1.42, 0.62, body, 18, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.TOP, name="Revision prediction body", italic_code=False)
    rows = [
        ("required packet（必要封包）", "來源：packet；值：bit；作用：確認送達；delivery 是 service evidence。", TEAL),
        ("service／deadline（服務／期限）", "來源：result；值：PASS／FAIL；作用：判定窗口完成與 revision。", PURPLE),
        ("state ledger（狀態帳）", "來源：replay；值：WAKE／TX／RX／retry；作用：連回 action 與 J。", BLUE),
        ("endpoint J（端點能量）", "來源：result；值：J；作用：描述修訂代價；與 delivery PASS 一起讀。", GOLD),
    ]
    for i, (label, body, color) in enumerate(rows):
        rw_field_row(slide, 1.40 + i * 0.86, label, body, color=color, x=5.18, w=7.08, h=0.74, label_w=2.72, body_size=18, name="Revision prediction field")
    rw_sentence(slide, 5.02, "完整句：margin 30 預測較早送出、較高端點 J，並提高 required packet 在期限前完成的機率。", size=20, x=0.82, w=11.54, h=0.52, name="Revision prediction sentence")
    rw_sentence(slide, 5.58, "問題：哪三組 evidence 共同決定預測是否成立？", size=18, x=0.82, w=11.54, h=0.30, name="Revision prediction question")


def draw_rw72(slide):
    lead(slide, "第二輪 run：revision freeze 與 surprise")
    text_box(slide, 0.84, 1.04, 11.64, 0.22, "package root：lora-energy-lab/", 18, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Second run package root", italic_code=False)
    rw_command_box(slide, 0.78, 1.38, 5.82, "revision｜Windows PowerShell", ".\\course.cmd run --lab C --case revision --freeze", color=TEAL, name="Revision Windows command")
    rw_command_box(slide, 6.78, 1.38, 5.82, "surprise｜Windows PowerShell", ".\\course.cmd run --lab C --case surprise", color=GOLD, name="Surprise Windows command")
    rw_command_box(slide, 0.78, 2.44, 5.82, "revision｜WSL/POSIX", "bash course.sh run --lab C --case revision --freeze", color=TEAL, name="Revision WSL command")
    rw_command_box(slide, 6.78, 2.44, 5.82, "surprise｜WSL/POSIX", "bash course.sh run --lab C --case surprise", color=GOLD, name="Surprise WSL command")
    rw_field_row(slide, 3.58, "stdout contract（標準輸出）", "來源：runner stdout；值：status、run_id、result_path；作用：定位 revision／surprise result；成功：收據齊全；失敗：原 artifact 保持。", color=TEAL, h=0.76, label_w=2.72, body_size=18, name="Second stdout contract")
    rw_field_row(slide, 4.46, "artifact source（來源邊界）", "來源：result.json header；值：artifact_source、endpoint-replay.json；作用：配對 replay；成功：identity 一致；失敗：claim_boundary 保持。", color=GOLD, h=0.76, label_w=2.72, body_size=18, name="Second artifact source")
    rw_sentence(slide, 5.34, "Expect／Interpret：配對 replay 後讀 service、deadline、action、state、endpoint J；claim_boundary 只對此 artifact。", size=18, x=0.82, w=11.54, h=0.44, name="Second run interpretation")


def draw_rw73gates(slide):
    lead(slide, "服務與期限結果：三筆案例的 gate")
    x0 = 0.82
    widths = [2.22, 2.05, 2.05, 2.05, 3.00]
    heads = ["案例／門檻", "服務結果\nservice", "期限結果\ndeadline", "已送達資料\ndelivered bits", "來源與判讀"]
    x = x0
    for h, w in zip(heads, widths):
        small_label(slide, x, 1.38, w, h, color=NAVY, fill=CREAM, name="Gate comparison header")
        x += w + 0.06
    rows = [
        ("baseline\n20 秒", "PASS", "PASS", "10,400 bit", "同情境 fallback；control 通過", BLUE, PALE_BLUE),
        ("candidate\n5 秒", "FAIL", "FAIL", "9,600 bit", "同情境 fallback；兩個 gate 失敗", PURPLE, PALE_PURPLE),
        ("revision\n30 秒", "PASS", "PASS", "10,400 bit", "同情境 fallback；固定條件通過", TEAL, PALE_TEAL),
    ]
    for i, row in enumerate(rows):
        y = 2.14 + i * 0.92
        x = x0
        for j, (value, w) in enumerate(zip(row[:5], widths)):
            color, fill = row[5], row[6]
            text_box(slide, x, y, w, 0.68, value, 19 if j in (0, 4) else 21, bold=True,
                     color=color if j == 0 else INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
                     fill=fill, line_color=color, name="Gate comparison value", italic_code=False)
            x += w + 0.06
    rw_source_label(slide, "來源類型：operation-contract deterministic fallback；固定 scenario 與 endpoint scope。", y=4.98)
    rw_sentence(slide, 5.38, "判讀：先讀 service／deadline，再讀 delivered bits；result 與 replay 定義 gate。", size=18, x=0.82, w=11.54, h=0.48, name="Gate comparison interpretation")


def draw_rw73energy(slide):
    lead(slide, "能量與效率結果：三筆案例的 endpoint ledger")
    x0 = 0.90
    widths = [2.62, 2.62, 2.72, 3.04]
    heads = ["案例／gate", "端點能量\nendpoint J", "能量效率\nbit/J", "來源與讀法"]
    x = x0
    for h, w in zip(heads, widths):
        small_label(slide, x, 1.42, w, h, color=NAVY, fill=CREAM, name="Energy comparison header")
        x += w + 0.08
    rows = [
        ("baseline\nPASS／PASS", "10.66 J", "975.609756 bit/J", "固定 control；energy scope 為 endpoint", BLUE, PALE_BLUE),
        ("candidate\nFAIL／FAIL", "9.74 J", "985.626283 bit/J", "少 J、少交付；效率不改 gate", PURPLE, PALE_PURPLE),
        ("revision\nPASS／PASS", "10.66 J", "975.609756 bit/J", "同條件恢復 gate；J 與 control 相同", TEAL, PALE_TEAL),
    ]
    for i, row in enumerate(rows):
        y = 2.20 + i * 0.90
        x = x0
        for j, (value, w) in enumerate(zip(row[:4], widths)):
            color, fill = row[4], row[5]
            text_box(slide, x, y, w, 0.66, value, 19 if j in (0, 3) else 20, bold=True,
                     color=color if j == 0 else INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
                     fill=fill, line_color=color, name="Energy comparison value", italic_code=False)
            x += w + 0.08
    rw_source_label(slide, "來源類型：同情境 deterministic fallback；endpoint J 單位為 J，bit/J 單位為 bit per J。", y=5.02)
    rw_sentence(slide, 5.34, "Expect／Interpret：bit/J 只描述 endpoint scope；與 service／deadline、delivery、replay 一起讀，不產生成功判定。", size=18, x=0.82, w=11.54, h=0.54, name="Energy comparison interpretation")


def draw_rw73causal(slide):
    lead(slide, "唯一修改如何改變 state 與 packet 事件")
    nodes = [
        ("門檻", "margin\n20 → 5 → 30", BLUE, PALE_BLUE),
        ("action", "SEND_URGENT\n或正常 pacing", PURPLE, PALE_PURPLE),
        ("state", "WAKE／TX／RX\nretry", TEAL, PALE_TEAL),
        ("packet", "delivery／expiry\nservice gate", GOLD, PALE_GOLD),
    ]
    x = 0.74
    for i, (head, body, color, fill) in enumerate(nodes):
        panel(slide, x, 1.62, 2.72, 2.12, fill=fill, line_color=color, name="Causal mechanism node")
        text_box(slide, x + 0.16, 1.88, 2.40, 0.34, head, 22, bold=True, color=color, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Causal node heading", italic_code=False)
        text_box(slide, x + 0.20, 2.48, 2.32, 0.88, body, 20, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Causal node body")
        if i < 3:
            connector(slide, x + 2.72, 2.68, x + 3.02, 2.68, color=NAVY, width=1.8, arrow=True)
        x += 3.02
    rw_field_row(slide, 4.18, "state ledger（狀態帳）", "來源：replay frame；值：WAKE、TX、RX、retry；作用：連回 action 與 J；判讀：state 事件解釋 endpoint energy。", color=TEAL, h=0.74, label_w=2.46, body_size=19, name="Causal state ledger")
    rw_field_row(slide, 5.06, "packet event（封包事件）", "來源：packet trace；值：attempt、delivered、expired；作用：定義 service／deadline；判讀：事件結果約束效率解讀。", color=GOLD, h=0.74, label_w=2.46, body_size=19, name="Causal packet event")


def draw_rw74(slide):
    lead(slide, "surprise：frozen policy 的適用邊界")
    panel(slide, 0.78, 1.40, 5.30, 3.70, fill=PALE_BLUE, line_color=BLUE, name="Frozen policy panel")
    text_box(slide, 1.00, 1.68, 4.86, 0.36, "frozen policy（凍結 policy）", 22, bold=True, color=BLUE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Frozen policy heading", italic_code=False)
    rw_code(slide, 1.14, 2.30, 4.56, 0.92, "URGENT_MARGIN_S = 30\npolicy bytes unchanged", name="Frozen policy code")
    text_box(slide, 1.04, 3.40, 4.78, 1.16, "來源：revision freeze receipt；唯一 edit 不變。\n判讀：surprise 使用同一 policy，只改變 service condition。", 19, color=INK, align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.MIDDLE, name="Frozen policy explanation", italic_code=False)
    panel(slide, 6.38, 1.40, 5.86, 3.70, fill=PALE_RED, line_color=RED, name="Surprise result panel")
    text_box(slide, 6.62, 1.68, 5.38, 0.36, "surprise（保留案例）", 22, bold=True, color=RED, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Surprise heading", italic_code=False)
    rw_field_row(slide, 2.22, "delivered bits（送達位元）", "來源：fallback；值：2,400 bit；作用：量化送達；service FAIL 保留原值。", color=RED, x=6.62, w=5.38, h=0.72, label_w=2.18, body_size=18, name="Surprise delivered")
    rw_field_row(slide, 3.06, "retransmissions（重傳）", "來源：packet event；值：3 次；作用：顯示傳輸代價並解釋 J。", color=PURPLE, x=6.62, w=5.38, h=0.72, label_w=2.18, body_size=18, name="Surprise retries")
    rw_field_row(slide, 3.90, "expired packets（逾期封包）", "來源：deadline event；值：3 張；作用：定義期限失敗；低 J 不改寫 gate FAIL。", color=GOLD, x=6.62, w=5.38, h=0.72, label_w=2.18, body_size=18, name="Surprise expired")
    rw_sentence(slide, 5.34, "Expect／Interpret：2,400 bit、5.41 J、重傳與逾期事件共同說明 FAIL；不以低 J 改寫 service／deadline。", size=18, x=0.82, w=11.54, h=0.54, name="Surprise interpretation")


def draw_rw75(slide):
    lead(slide, "Lab C 結論：service／deadline gate 與 endpoint J")
    steps = [
        ("1", "service（服務結果）", "PASS／FAIL；工作是否完成", BLUE, PALE_BLUE),
        ("2", "deadline（期限結果）", "PASS／FAIL；是否在期限前完成", PURPLE, PALE_PURPLE),
        ("3", "delivery（送達資料）", "bit、expired、retry；事件證據", TEAL, PALE_TEAL),
        ("4", "endpoint J（端點能量）", "J、bit/J；端點代價", GOLD, PALE_GOLD),
    ]
    for i, (num, head, body, color, fill) in enumerate(steps):
        x = 0.86 + i * 3.02
        y = 1.48 + i * 0.22
        panel(slide, x, y, 2.64, 1.46, fill=fill, line_color=color, name="Gate-first conclusion")
        text_box(slide, x + 0.12, y + 0.12, 2.40, 0.32, f"{num}｜{head}", 19, bold=True, color=color, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Gate conclusion heading", italic_code=False)
        text_box(slide, x + 0.18, y + 0.58, 2.28, 0.62, body, 19, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Gate conclusion body", italic_code=False)
        if i < 3:
            connector(slide, x + 2.64, y + 0.72, x + 2.92, y + 0.72, color=NAVY, width=1.7, arrow=True)
    rw_sentence(slide, 3.76, "完整句：margin 5 的少 J 伴隨 delivery 與兩個 gate 失敗；margin 30 在固定條件下恢復 gate，endpoint J 需隨事件鏈解讀。", size=21, x=0.82, w=11.54, h=0.70, name="Lab C conclusion sentence")
    rw_field_row(slide, 4.72, "claim boundary（結論範圍）", "來源：三筆 fallback 與 surprise；值：固定 scenario；作用：限制推論範圍；判讀：margin 30 的結果不延伸到所有窗口。", color=NAVY, h=0.78, label_w=2.46, body_size=19, name="Lab C claim boundary")


def draw_rw76(slide):
    lead(slide, "執行器、結果檔、課程頁與進度備份")
    stages = [
        ("1", "terminal runner（終端執行器）", "輸入：student_policy.py 與 scenario；動作：執行 policy；輸出：result.json、replay。", BLUE),
        ("2", "result files（結果檔）", "輸入：run receipt；動作：保存 source、identity、units；輸出：可匯入 artifact。", PURPLE),
        ("3", "課程頁（網站）", "輸入：已產生 artifact；動作：驗證、重播、選取 frame；輸出：畫面與欄位狀態。", TEAL),
        ("4", "進度備份（本機紀錄）", "輸入：A／B／C 匯入紀錄；動作：下載 JSON、建立／還原存檔點；輸出：本機進度，不重算 runner result。", GOLD),
    ]
    for i, (num, head, body, color) in enumerate(stages):
        x = 0.76 + (i % 2) * 6.20
        y = 1.40 + (i // 2) * 1.72
        rw_numbered(slide, x, y, num, head, body, color=color, w=5.74, h=1.42, body_size=19, name="Website responsibility stage")
        if i == 0:
            connector(slide, 6.52, 2.10, 6.70, 2.10, color=NAVY, width=1.7, arrow=True)
        if i == 1:
            connector(slide, 3.64, 3.02, 3.64, 3.12, color=NAVY, width=1.7, arrow=True)
        if i == 2:
            connector(slide, 6.52, 3.82, 6.70, 3.82, color=NAVY, width=1.7, arrow=True)
    rw_sentence(slide, 5.02, "責任邊界：課程頁只驗證、重播與保存；Python 執行與 machine-readable READY 來自 terminal receipt。", size=19, x=0.82, w=11.54, h=0.48, name="Website boundary sentence")
    rw_source_label(slide, "課程頁：http://120.126.151.102:3000/course", y=5.64, color=NAVY)


def draw_rw77format(slide, assets):
    lead(slide, "匯入一：result.json、欄位與單位")
    picture(slide, assets["accepted_header"], 0.76, 1.32, 5.74, 3.22, name="Import format current screenshot")
    for x, y, n in [(1.10, 1.58, "1"), (4.86, 2.38, "2"), (2.80, 3.62, "3")]:
        rw_callout_tag(slide, x, y, n, color=RED, name="Import format callout")
    rw_numbered(slide, 6.68, 1.24, "1", "result.json（結果檔）", "來源：terminal runner；值：JSON 物件；作用：提供欄位與單位；成功：格式與 identity 通過；失敗：原匯入 state 保持。", color=BLUE, w=5.64, h=1.28, body_size=18, name="Import format file")
    rw_numbered(slide, 6.68, 2.68, "2", "units（單位）", "來源：result schema；值：J／bit／bit/J；作用：統一計算語義；成功：單位齊全；失敗：endpoint result 不更新。", color=PURPLE, w=5.64, h=1.28, body_size=18, name="Import format units")
    rw_numbered(slide, 6.68, 4.12, "3", "import state（匯入狀態）", "來源：http://120.126.151.102:3000/course gate；值：尚未匯入；作用：控制 artifact 進 replay；成功：匯入後更新；失敗：目前狀態保持。", color=TEAL, w=5.64, h=1.28, body_size=18, name="Import format state")
    rw_source_label(slide, "14:12 live Lab A：選擇 result.json 按鈕可見；匯入狀態為尚未匯入。", y=5.54)


def draw_rw77lineage(slide, assets):
    lead(slide, "匯入二：情境、run 與 policy lineage")
    picture(slide, assets["accepted_header"], 0.76, 1.32, 5.74, 3.22, name="Import lineage current screenshot")
    for x, y, n in [(1.00, 1.72, "1"), (4.78, 2.36, "2"), (2.72, 3.70, "3")]:
        rw_callout_tag(slide, x, y, n, color=RED, name="Import lineage callout")
    rw_numbered(slide, 6.68, 1.24, "1", "experiment／case（實驗／案例）", "來源：result.json header；值：A／B／C case；作用：配對課程段落；成功：案例一致；失敗：停止更新。尚未匯入時值待補。", color=BLUE, w=5.64, h=1.28, body_size=18, name="Import lineage case")
    rw_numbered(slide, 6.68, 2.68, "2", "run identity（執行識別）", "來源：runner receipt；值：run_id；作用：連結 result、replay、ledger；成功：identity 一致；失敗：目前 record 不變。尚未匯入時沒有 run_id。", color=PURPLE, w=5.64, h=1.28, body_size=18, name="Import lineage run")
    rw_numbered(slide, 6.68, 4.12, "3", "policy lineage（policy 血緣）", "來源：marked edit／freeze receipt；值：原始／5 秒／30 秒；作用：說明 result 版本；成功：版本可追；失敗：目前 capture 不補版本。", color=TEAL, w=5.64, h=1.28, body_size=18, name="Import lineage policy")
    rw_source_label(slide, "14:12 live Lab A：匯入狀態仍是尚未匯入；experiment、run identity、policy lineage 待 receipt 補足。", y=5.54)


def draw_rw78(slide, assets):
    lead(slide, "frame selector：選取畫面與欄位分工")
    picture(slide, assets["accepted_fields"], 0.76, 1.28, 5.92, 2.06, name="Frame selector current screenshot")
    for x, y, n in [(1.00, 1.50, "1"), (4.70, 1.68, "2"), (2.10, 2.06, "3")]:
        rw_callout_tag(slide, x, y, n, color=RED, name="Frame selector callout")
    rw_numbered(slide, 6.94, 1.34, "1", "frame selector（畫面選擇器）", "來源：endpoint replay；值：frame identity；作用：改變目前觀察畫面；判讀：selected frame 更新後欄位跟隨。", color=BLUE, w=5.30, h=1.12, body_size=18, name="Frame selector definition")
    rw_numbered(slide, 6.94, 2.62, "2", "current frame（目前畫面）", "來源：result／replay pair；值：一個 frame；作用：固定 Radio、Action、queue 與 event 的共同時間點；判讀：欄位不可跨 frame 混讀。", color=PURPLE, w=5.30, h=1.28, body_size=18, name="Current frame definition")
    rw_numbered(slide, 6.94, 4.06, "3", "eight fields（八欄）", "中文：frame 摘要欄位；來源：endpoint artifact；值型態：狀態、計數、J、時間、識別與 ordinal band；作用：分頁讀取，詳見 P087／P098。", color=TEAL, w=5.30, h=1.18, body_size=18, name="Eight fields definition")
    rw_source_label(slide, "current Lab A fallback crop：selector 與欄位同屬目前 frame；queue／event 另於 P088 讀取。", y=5.58)


def draw_rw79records(slide, assets):
    lead(slide, "Workbook 記錄：prediction、result 與 lineage")
    picture(slide, assets["workbook"], 0.74, 1.28, 4.44, 3.90, name="Workbook record screenshot")
    for x, y, n in [(1.08, 1.68, "1"), (3.98, 2.36, "2"), (2.42, 4.10, "3")]:
        rw_callout_tag(slide, x, y, n, color=RED, name="Workbook record callout")
    rw_field_row(slide, 1.22, "prediction（預測）", "來源：run 前 workbook；值：機制句／問題；作用：保留可比較預測；成功：可回看；失敗：目前尚未填寫。", color=BLUE, x=5.34, w=6.92, h=0.92, label_w=2.20, body_size=18, name="Workbook prediction field")
    rw_field_row(slide, 2.30, "result／replay（結果／重播）", "來源：runner artifact；值：result.json／frame；作用：保存數值與事件；成功：可配對；失敗：目前沒有 exported workbook。", color=PURPLE, x=5.34, w=6.92, h=0.92, label_w=2.20, body_size=18, name="Workbook result field")
    rw_field_row(slide, 3.38, "source／role（來源／角色）", "來源：artifact header；值：執行／fallback／baseline／candidate；作用：區分資料責任；成功：source 一致；失敗：不混寫。", color=TEAL, x=5.34, w=6.92, h=0.92, label_w=2.20, body_size=18, name="Workbook source field")
    rw_field_row(slide, 4.46, "recovery note（復原記錄）", "來源：rejection／recovery；值：matching artifact／fallback；作用：保留處置；成功：可復原；失敗：空白 workbook 不補 record。", color=GOLD, x=5.34, w=6.92, h=0.92, label_w=2.20, body_size=18, name="Workbook recovery field")
    rw_source_label(slide, "current Workbook capture：checkpoint 0、0/10、沒有 exported workbook；右側為欄位契約。", y=5.66)


def draw_rw79save(slide, assets):
    lead(slide, "Workbook 控制：save、export、open 與 reopen")
    picture(slide, assets["workbook"], 0.74, 1.28, 4.40, 3.90, name="Workbook save screenshot")
    for x, y, n in [(1.04, 1.72, "1"), (3.96, 2.54, "2"), (2.20, 4.02, "3")]:
        rw_callout_tag(slide, x, y, n, color=RED, name="Workbook save callout")
    rw_numbered(slide, 5.34, 1.20, "1", "save（保存）", "來源：prediction／result／identity；值：checkpoint record；作用：新增保存點；成功：record 更新；失敗：checkpoint 保持。", color=BLUE, w=6.92, h=1.12, body_size=18, name="Workbook save control")
    rw_numbered(slide, 5.34, 2.48, "2", "export（匯出）", "來源：workbook lineage；值：可攜檔案；作用：產生 export；成功：檔案出現；失敗：目前尚未匯出。", color=PURPLE, w=6.92, h=1.12, body_size=18, name="Workbook export control")
    rw_numbered(slide, 5.34, 3.76, "3", "open／reopen（開啟／重開）", "來源：exported record；值：reopened state；作用：回到相同 identity；成功：record 可重開；失敗：無 exported record。", color=TEAL, w=6.92, h=1.12, body_size=18, name="Workbook reopen control")
    rw_sentence(slide, 5.06, "判讀：control 管理 workbook 狀態；runner artifact、service gate、replay evidence 各自保留。", size=18, x=0.82, w=11.54, h=0.42, name="Workbook save interpretation")
    rw_source_label(slide, "current Workbook crop：save／export／reopen controls 可見；checkpoint 0、0/10、尚未匯出。", y=5.70)


def draw_rw80(slide):
    lead(slide, "本機進度備份：建立、還原、重設的狀態機")
    panel(slide, 0.78, 1.42, 6.00, 3.72, fill=PALE_BLUE, line_color=BLUE, name="Progress backup state machine")
    states = [("建立存檔點", "保存本機進度", 1.20, BLUE), ("還原存檔點", "回到保存內容", 2.70, TEAL), ("重設進度", "清除本機紀錄", 4.20, RED), ("下載／還原", "交換 JSON 備份", 5.64, PURPLE)]
    for i, (head, body, x, color) in enumerate(states):
        dot(slide, x, 3.08, 0.28, color=color, name="Progress backup state marker")
        text_box(slide, x - 0.58, 2.14, 1.16, 0.30, head, 18, bold=True, color=color, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Progress backup state heading", italic_code=False)
        text_box(slide, x - 0.62, 3.52, 1.34, 0.72, body, 18, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.TOP, name="Progress backup state body", italic_code=False)
        if i < len(states) - 1:
            connector(slide, x + 0.30, 3.22, x + 1.16, 3.22, color=NAVY, width=1.6, arrow=True)
    rw_field_row(slide, 1.46, "建立本機存檔點", "來源：browser-local progress；值：#0 或新存檔點；作用：建立可回復狀態；成功：存檔點更新；失敗：原進度保持。", color=BLUE, x=7.12, w=5.14, h=0.88, label_w=1.76, body_size=18, name="Checkpoint definition")
    rw_field_row(slide, 2.48, "還原本機存檔點", "來源：本機存檔點；值：原保存內容；作用：回到保存狀態；成功：進度更新；失敗：runner artifact 不被重算。", color=TEAL, x=7.12, w=5.14, h=0.82, label_w=1.76, body_size=18, name="Restore definition")
    rw_field_row(slide, 3.44, "重設本機進度", "來源：local progress；值：重設後紀錄；作用：改變本機進度；成功：狀態更新；失敗：result、service gate、replay 維持原值。", color=PURPLE, x=7.12, w=5.14, h=0.94, label_w=1.76, body_size=18, name="Reset progress definition")
    rw_sentence(slide, 4.70, "狀態結論：進度備份 controls 只改本機 local state；資料來源與 scientific result 的 identity 保持。", size=20, x=0.82, w=11.54, h=0.62, name="Progress backup state interpretation")
    rw_source_label(slide, "14:12 live 進度備份：#0、0 筆匯入紀錄、JSON 格式；操作失敗時保持目前本機紀錄。", y=5.48)


def draw_rw_transfer(slide, key: str):
    titles = {"farm": "轉移一：智慧農場的灌溉 service gate", "hvac": "轉移二：HVAC 的舒適度與設備期限", "edge": "轉移三：edge inference 的 freshness gate"}
    lead(slide, titles[key])
    if key == "farm":
        rows = [("observation（觀察）", "來源：domain input；值：水位、含水、窗口、期限；作用：提供灌溉條件。", BLUE), ("policy action（策略動作）", "來源：policy；值：WAIT／urgent／batch；作用：安排灌溉封包。", PURPLE), ("service（服務結果）", "來源：farm condition；值：達成／未達成；作用：定義完成；沒有 live KPI。", TEAL), ("endpoint J（端點能量）", "來源：pump scope；值：J；作用：描述泵浦代價；與 service 分開。", GOLD)]
    elif key == "hvac":
        rows = [("observation（觀察）", "來源：HVAC input；值：舒適度、設備、尖峰、窗口；作用：提供控制條件。", BLUE), ("policy action（策略動作）", "來源：policy；值：WAIT／urgent／batch；作用：安排感測與控制。", PURPLE), ("service（服務結果）", "來源：HVAC condition；值：達成／未達成；作用：定義 deadline；現場結果待取得。", TEAL), ("endpoint J（端點能量）", "來源：fan／compressor scope；值：J；作用：描述宣告端點；沒有現場量測。", GOLD)]
    else:
        rows = [("observation（觀察）", "來源：edge trace；值：queue、freshness、quality、窗口；作用：提供推論條件。", BLUE), ("policy action（策略動作）", "來源：policy；值：WAIT／urgent／batch；作用：選擇封包時機。", PURPLE), ("service（服務結果）", "來源：edge trace；值：完成／stale；作用：定義 freshness gate。", TEAL), ("endpoint Joule（端點焦耳）", "來源：edge device scope；值：J；作用：描述端點代價；不取代 freshness gate。", GOLD)]
    for i, (label, body, color) in enumerate(rows):
        rw_field_row(slide, 1.42 + i * 0.84, label, body, color=color, h=0.72, label_w=2.58, body_size=18, name=f"Transfer {key} field")
    rw_sentence(slide, 4.98, "可移植句：觀察欄位決定 action；action 形成 event；service gate 定義完成；endpoint J 描述宣告 scope 的代價。", size=20, x=0.82, w=11.54, h=0.62, name=f"Transfer {key} causal sentence")
    rw_sentence(slide, 5.66, "問題：若 endpoint J 下降但 service condition 失敗，結果的主判讀欄位是哪一組？", size=18, x=0.82, w=11.54, h=0.24, name=f"Transfer {key} question")


def draw_rw81(slide): draw_rw_transfer(slide, "farm")
def draw_rw82(slide): draw_rw_transfer(slide, "hvac")
def draw_rw83(slide): draw_rw_transfer(slide, "edge")


def draw_rw84(slide):
    lead(slide, "轉移出口：保留可重播的 policy hypothesis")
    stages = [
        ("condition（條件）", "queue、期限、quality、窗口", BLUE),
        ("branch（分支）", "WAIT／SEND_URGENT／FLUSH_BATCH", PURPLE),
        ("event（事件）", "state、packet、delivery、expiry", TEAL),
        ("claim（結論）", "service gate、energy scope、適用邊界", GOLD),
    ]
    for i, (head, body, color) in enumerate(stages):
        x = 0.78 + i * 3.02
        panel(slide, x, 1.52, 2.64, 1.76, fill=WHITE, line_color=color, name="Transfer exit stage")
        text_box(slide, x + 0.12, 1.76, 2.40, 0.34, head, 19, bold=True, color=color, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Transfer exit heading", italic_code=False)
        text_box(slide, x + 0.18, 2.28, 2.28, 0.68, body, 19, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Transfer exit body", italic_code=False)
        if i < 3:
            connector(slide, x + 2.64, 2.40, x + 2.92, 2.40, color=NAVY, width=1.7, arrow=True)
    rw_field_row(slide, 3.86, "進度備份匯出", "來源：本機進度備份；值：可攜 JSON record；作用：攜帶 lineage，還原後配對 identity。", color=BLUE, h=0.80, label_w=2.74, body_size=18, name="Transfer exit export")
    rw_field_row(slide, 4.80, "claim ceiling（結論上限）", "來源：固定 scope；值：條件式 hypothesis；作用：限制外推，不延伸 live KPI。", color=GOLD, h=0.80, label_w=2.74, body_size=18, name="Transfer exit claim")
    rw_sentence(slide, 5.68, "收束句：保留可重跑的條件、事件與 evidence；下一個 domain 重新建立 service condition。", size=18, x=0.82, w=11.54, h=0.24, name="Transfer exit sentence")


def draw_rw85(slide, assets):
    lead(slide, "current /course：來源與匯入狀態")
    picture(slide, assets["accepted_header"], 0.72, 1.28, 6.18, 3.10, name="Current source screenshot")
    for x, y, n in [(1.02, 1.56, "1"), (4.98, 2.18, "2"), (2.88, 2.86, "3"), (5.56, 3.16, "4")]:
        rw_callout_tag(slide, x, y, n, color=RED, name="Current source callout")
    # Four complete contracts fit as evenly spaced 1.00 in cards.  The
    # earlier 1.02/0.92 mix left the second-to-fourth bodies crossing their
    # panel borders once the full Chinese explanation was restored.
    rw_numbered(slide, 7.10, 1.20, "1", "source（來源）", "來源：source label；值：同情境備用資料；作用：標示資料責任；成功：建立 selected state；失敗：原 import state 保持。", color=BLUE, w=5.16, h=1.08, body_size=18, name="Current source field")
    rw_numbered(slide, 7.10, 2.32, "2", "experiment／case（實驗／案例）", "來源：case label；值：A／baseline 或 Lab C／case；作用：配對情境；成功：案例可讀；失敗：匯入狀態保持。", color=PURPLE, w=5.16, h=1.08, body_size=18, name="Current case field")
    rw_numbered(slide, 7.10, 3.44, "3", "import state（匯入狀態）", "來源：/course gate；值：尚未匯入；作用：控制 downstream view；成功：accepted 才進 replay；失敗：原 state 保持。", color=TEAL, w=5.16, h=1.08, body_size=18, name="Current import field")
    rw_numbered(slide, 7.10, 4.56, "4", "fallback label（備用標籤）", "來源：fallback source；值：同情境資料；作用：支援欄位重播；成功：selected 更新；失敗：terminal record 不改。", color=GOLD, w=5.16, h=1.08, body_size=18, name="Current fallback field")
    rw_source_label(slide, "current Lab A crop：source／case／尚未匯入狀態；資料類型為 simulated teaching evidence。", y=5.86)


def draw_rw86(slide, assets):
    lead(slide, "current /course：服務摘要四欄")
    picture(slide, assets["accepted_summary"], 0.72, 1.28, 5.44, 3.86, name="Current summary screenshot")
    for x, y, n in [(1.00, 1.62, "1"), (3.92, 1.98, "2"), (1.24, 3.38, "3"), (4.48, 3.78, "4")]:
        rw_callout_tag(slide, x, y, n, color=RED, name="Current summary callout")
    rw_field_row(slide, 1.26, "service（服務結果）", "來源：Lab A fallback；值：FAIL；作用：第一個 gate，不能被數值改寫；成功：PASS 才繼續；失敗：保留 FAIL。", color=RED, x=6.18, w=6.08, h=0.98, label_w=2.00, body_size=18, name="Summary service field")
    rw_field_row(slide, 2.28, "delivered bits（已送達位元）", "來源：fallback endpoint；值：4,800 bit；作用：量化資料並與 service 同讀；成功：數值可配對；失敗：原 record 保持。", color=BLUE, x=6.18, w=6.08, h=0.98, label_w=2.00, body_size=18, name="Summary delivered field")
    rw_field_row(slide, 3.30, "endpoint J（端點能量）", "來源：fallback endpoint；值：6.92 J；作用：描述端點代價；成功：scope 清楚；失敗：不升格系統能量。", color=PURPLE, x=6.18, w=6.08, h=0.98, label_w=2.00, body_size=18, name="Summary energy field")
    rw_field_row(slide, 4.32, "bit/J（能量效率）", "來源：bits ÷ endpoint J；值：693.641618 bit/J；作用：描述效率；成功：可比較；失敗：service FAIL 優先。", color=GOLD, x=6.18, w=6.08, h=0.98, label_w=2.00, body_size=18, name="Summary efficiency field")
    rw_source_label(slide, "current Lab A fallback summary：FAIL、4,800 bit、6.92 J、693.641618 bit/J；accepted-upload claim 尚未形成。", y=5.70)


def draw_rw87(slide, assets):
    lead(slide, "current /course：replay fields 一至四")
    picture(slide, assets["accepted_fields"], 0.70, 1.24, 5.72, 2.00, name="Current fields first crop")
    for x, y, n in [(0.98, 1.46, "1"), (3.94, 1.62, "2"), (1.18, 2.20, "3"), (4.60, 2.36, "4")]:
        rw_callout_tag(slide, x, y, n, color=RED, name="Current fields first callout")
    rows = [
        ("Radio（無線電狀態）", "來源：fallback frame；值：SLEEP／TX／RX；作用：描述 radio mode，frame 改變時更新。", BLUE),
        ("Action（策略動作）", "來源：policy replay；值：WAIT／SEND_URGENT／FLUSH_BATCH；作用：指出 branch output。", PURPLE),
        ("Queue count（佇列數量）", "來源：queue snapshot；值：筆；作用：描述待處理工作，隨 queue event 更新。", TEAL),
        ("累積 endpoint J（端點累積能量）", "來源：frame ledger；值：J；作用：顯示目前累積代價；system energy 不在此欄。", GOLD),
    ]
    for i, (label, body, color) in enumerate(rows):
        rw_field_row(slide, 1.26 + i * 1.02, label, body + "；成功：frame 更新；失敗：原 frame 保持。", color=color, x=6.58, w=5.68, h=0.98, label_w=1.98, body_size=18, name="Current fields first definition")
    rw_source_label(slide, "current Lab A fallback crop：四欄跟隨 frame selector；來源標示為同情境備用資料。", y=5.70)


def draw_rw88(slide, assets):
    lead(slide, "current /course：queue 與 packet event")
    picture(slide, assets["accepted_queue"], 0.72, 1.28, 5.72, 1.80, name="Current queue screenshot")
    for x, y, n in [(1.00, 1.46, "1"), (3.92, 1.46, "2"), (1.38, 2.14, "3"), (4.48, 2.14, "4")]:
        rw_callout_tag(slide, x, y, n, color=RED, name="Current queue callout")
    rw_numbered(slide, 6.82, 1.22, "1", "queue item（佇列項目）", "來源：fallback queue；值：item／count；作用：顯示等待壓力；成功：同 frame 讀 Action；失敗：原 queue 保持。", color=BLUE, w=5.38, h=1.06, body_size=18, name="Queue item field")
    rw_numbered(slide, 6.82, 2.42, "2", "event type（事件類型）", "來源：packet trace；值：attempt／retry／delivered／expired；作用：說明 action 結果；成功：回到 service；失敗：原 event 保持。", color=PURPLE, w=5.38, h=1.06, body_size=18, name="Event type field")
    rw_numbered(slide, 6.82, 3.62, "3", "packet identity（封包識別）", "來源：event ledger；值：packet label；作用：連結重傳與送達；成功：配對 evt-0000；失敗：原 identity 保持。", color=TEAL, w=5.38, h=1.06, body_size=18, name="Packet identity field")
    rw_numbered(slide, 6.82, 4.82, "4", "delivery state（送達狀態）", "來源：service event；值：delivered／expired；作用：支撐 deadline；成功：更新 gate；失敗：原 state 保持。", color=GOLD, w=5.38, h=1.06, body_size=18, name="Delivery state field")
    rw_source_label(slide, "current Lab A fallback crop：目前可見 queue normal-1、event evt-0000；資料類型為 simulated teaching evidence。", y=5.84)


def draw_rw89(slide, assets):
    lead(slide, "current /course：timeline 與 policy branch")
    picture(slide, assets["timeline"], 0.82, 1.28, 11.42, 0.92, name="Current timeline screenshot")
    for x, n in [(1.26, "1"), (4.12, "2"), (7.12, "3"), (10.36, "4")]:
        rw_callout_tag(slide, x, 1.46, n, color=RED, name="Current timeline callout")
    rows = [
        ("contact（接觸）", "來源：frame；值：contact ID／status；作用：界定窗口並連回 SLEEP 或 action。", BLUE),
        ("quality（品質）", "來源：frame；值：ordinal band；作用：判定 quality_ready，品質不足對應 WAIT。", PURPLE),
        ("radio state（無線電狀態）", "來源：Radio；值：SLEEP／TX／RX；作用：描述 state transition 並連接 endpoint J。", TEAL),
        ("policy branch（策略分支）", "來源：Action；值：urgent／pacing／batch／wait；作用：回到 policy branch。", GOLD),
    ]
    for i, (label, body, color) in enumerate(rows):
        rw_field_row(slide, 2.34 + i * 0.82, label, body, color=color, h=0.74, label_w=2.46, body_size=18, name="Current timeline definition")
    rw_sentence(slide, 5.56, "目前時間軸收合；本頁定義欄位與 branch 對應，expanded frame sequence 尚未載入。", size=18, x=0.82, w=11.54, h=0.44, name="Timeline interpretation")


def draw_rw90(slide, assets):
    lead(slide, "current /course：execution ledger 與 selected state")
    picture(slide, assets["accepted_ledger"], 0.72, 1.28, 5.82, 1.80, name="Current ledger screenshot")
    for x, y, n in [(1.00, 1.46, "1"), (4.24, 1.46, "2"), (1.24, 2.16, "3"), (4.62, 2.16, "4")]:
        rw_callout_tag(slide, x, y, n, color=RED, name="Current ledger callout")
    rows = [
        ("experiment／case（實驗／案例）", "來源：ledger；值：A／baseline；作用：配對 fallback artifact，案例需一致。", BLUE),
        ("role（案例角色）", "來源：comparison；值：baseline／candidate／revision；作用：定義比較位置，role 不可混換。", PURPLE),
        ("service／endpoint J（服務／端點能量）", "來源：fallback result；值：FAIL、J；作用：保留 gate 與 scope，J 不改寫 service。", TEAL),
        ("source／selected state（來源／選取狀態）", "來源：fallback source；值：備用、selected；作用：區分資料與畫面，選取不升格來源。", GOLD),
    ]
    for i, (label, body, color) in enumerate(rows):
        rw_field_row(slide, 1.26 + i * 1.02, label, body + "；成功：selected 更新；失敗：原 state 保持。", color=color, x=6.58, w=5.68, h=0.98, label_w=1.98, body_size=18, name="Current ledger definition")
    rw_source_label(slide, "current Lab A fallback ledger：selected row 是 browser state；source、run identity 與 result scope 分層保存。", y=5.74)


def draw_rw91(slide, assets):
    lead(slide, "current /course：情境輸入與 endpoint 結果")
    panel(slide, 0.72, 1.26, 5.68, 3.96, fill=WHITE, line_color=GRAY, name="Evidence blank capture frame")
    picture(slide, assets["provider"], 0.72, 1.26, 5.68, 3.96, name="Provider context screenshot")
    text_box(slide, 1.04, 2.54, 5.04, 0.82, "Evidence capture 是全白 PNG\n沒有可讀 replay 欄位", 22, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Evidence blank capture note", italic_code=False)
    for x, y, n in [(1.00, 1.60, "1"), (4.18, 2.22, "2"), (2.36, 4.08, "3")]:
        rw_callout_tag(slide, x, y, n, color=RED, name="Provider context callout")
    rw_numbered(slide, 6.68, 1.30, "1", "scenario input（情境輸入）", "來源：Evidence README；值：scenario metadata；作用：提供 context；成功：欄位可讀；失敗：白色 PNG 不臆造。", color=BLUE, w=5.56, h=1.20, body_size=18, name="Provider layer field")
    rw_numbered(slide, 6.68, 2.66, "2", "endpoint result（端點結果）", "來源：runner artifact；值：service／delivery／J／replay；作用：提供 endpoint evidence；成功：replay 可讀；失敗：目前沒有 replay。", color=TEAL, w=5.56, h=1.20, body_size=18, name="Endpoint layer field")
    rw_numbered(slide, 6.68, 4.02, "3", "identity boundary（識別邊界）", "來源：context／result；值：identity label；作用：避免跨層混讀；成功：配對 record；失敗：白色 capture 無法核對。", color=PURPLE, w=5.56, h=1.20, body_size=18, name="Identity boundary field")
    rw_sentence(slide, 5.38, "目前結論：Evidence capture 沒有可讀 replay；scenario、endpoint result 與 provider PASS 都不從白色 PNG 臆造。", size=20, x=0.82, w=11.54, h=0.54, name="Provider endpoint interpretation")


def draw_rw92save(slide, assets):
    lead(slide, "Workbook：保存與重新開啟")
    picture(slide, assets["workbook"], 0.72, 1.28, 4.44, 3.90, name="Workbook save reopen screenshot")
    for x, y, n in [(1.02, 1.72, "1"), (3.94, 2.42, "2"), (2.12, 4.06, "3")]:
        rw_callout_tag(slide, x, y, n, color=RED, name="Workbook save reopen callout")
    rw_numbered(slide, 5.30, 1.24, "1", "save（保存）", "來源：prediction／result／source；值：workbook record；作用：保存紀錄；成功：新增 record；失敗：checkpoint 保持。", color=BLUE, w=6.96, h=1.08, body_size=18, name="Workbook save field")
    rw_numbered(slide, 5.30, 2.46, "2", "export（匯出）", "來源：lineage／role；值：exported workbook；作用：產生可攜檔；成功：檔案出現；失敗：尚未匯出。", color=PURPLE, w=6.96, h=1.08, body_size=18, name="Workbook export field")
    rw_numbered(slide, 5.30, 3.68, "3", "reopen（重新開啟）", "來源：exported workbook；值：reopened state；作用：回到 identity；成功：record 可重開；失敗：無 exported record。", color=TEAL, w=6.96, h=1.08, body_size=18, name="Workbook reopen field")
    rw_sentence(slide, 4.80, "操作解讀：save／export／reopen 管理紀錄的生命週期；runner result 與 service gate 仍由原 artifact 定義。", size=20, x=0.82, w=11.54, h=0.62, name="Workbook save reopen interpretation")
    rw_source_label(slide, "current Workbook crop：checkpoint 0、0/10、尚未匯出；按鈕狀態是 browser-local record。", y=5.54)


def draw_rw92checkpoint(slide, assets):
    lead(slide, "Workbook：checkpoint 與本機復原")
    picture(slide, assets["workbook"], 0.72, 1.28, 4.44, 3.90, name="Workbook checkpoint screenshot")
    for x, y, n in [(1.02, 1.72, "1"), (3.94, 2.42, "2"), (2.12, 4.06, "3")]:
        rw_callout_tag(slide, x, y, n, color=RED, name="Workbook checkpoint callout")
    rw_numbered(slide, 5.30, 1.24, "1", "checkpoint（存檔點）", "來源：identity／prediction／source；值：checkpoint record；作用：建立保存點；成功：新增 record；失敗：current state 保持。", color=BLUE, w=6.96, h=1.08, body_size=18, name="Checkpoint control field")
    rw_numbered(slide, 5.30, 2.46, "2", "restore（恢復）", "來源：checkpoint；值：local workbook state；作用：回到保存內容；成功：progress 回復；失敗：原 progress 保持。", color=TEAL, w=6.96, h=1.08, body_size=18, name="Restore control field")
    rw_numbered(slide, 5.30, 3.68, "3", "reset／undo（重設／復原）", "來源：local progress；值：reset／undo state；作用：改變本機進度；成功：progress 更新；失敗：result、replay、service gate 不變。", color=PURPLE, w=6.96, h=1.08, body_size=18, name="Reset undo control field")
    rw_sentence(slide, 4.84, "本機復原只改 progress 與 workbook；它不重新執行 Python，也不重算 endpoint result。", size=20, x=0.82, w=11.54, h=0.58, name="Workbook checkpoint interpretation")
    rw_source_label(slide, "current Workbook crop：checkpoint 0、尚未完成段落；本機狀態與 endpoint artifact 分層保存。", y=5.54)


def draw_rw93(slide, assets):
    lead(slide, "empty-state／recovery：配對結果與 fallback")
    picture(slide, assets["empty_lab_c"], 0.72, 1.26, 5.82, 3.94, name="Current empty-state screenshot")
    for x, y, n in [(1.02, 1.62, "1"), (4.10, 2.52, "2"), (2.18, 4.16, "3")]:
        rw_callout_tag(slide, x, y, n, color=RED, name="Recovery callout")
    rw_numbered(slide, 6.68, 1.28, "1", "empty import state（尚未匯入）", "來源：/course import state；值：尚未匯入；作用：保持 session；成功：rejection result 可讀；失敗：原 state 保持。", color=RED, w=5.56, h=1.10, body_size=18, name="Recovery schema field")
    rw_numbered(slide, 6.68, 2.52, "2", "matching artifact（配對結果）", "來源：experiment／case／run；值：match／mismatch；作用：選 recovery source；成功：回配對 record；失敗：原 result 保持。", color=BLUE, w=5.56, h=1.10, body_size=18, name="Recovery matching field")
    rw_numbered(slide, 6.68, 3.76, "3", "same-scenario fallback（同情境備用）", "來源：fallback label；值：fixed case；作用：更新 selected fallback；成功：欄位可重播；失敗：terminal record 不改。", color=GOLD, w=5.56, h=1.10, body_size=18, name="Recovery fallback field")
    rw_sentence(slide, 5.24, "current Lab C 是 empty state；rejection result 尚未出現。matching artifact 或明確 fallback 仍須 identity 配對，未配對時原狀態可回讀。", size=20, x=0.82, w=11.54, h=0.62, name="Recovery interpretation")


def draw_rw94(slide, assets):
    lead(slide, "Prepare：記錄 READY 與備用環境")
    picture(slide, assets["ready"], 0.72, 1.22, 6.12, 3.94, name="Current READY screenshot")
    for x, y, n in [(1.02, 1.52, "1"), (4.88, 2.12, "2"), (2.70, 4.28, "3")]:
        rw_callout_tag(slide, x, y, n, color=RED, name="READY callout")
    rw_numbered(slide, 6.96, 1.28, "1", "記錄 READY（browser-local 設定狀態）", "來源：terminal receipt；值：browser-local status；作用：記錄 READY；成功：status 更新；失敗：原 status 保持。", color=TEAL, w=5.30, h=1.18, body_size=18, name="READY control field")
    rw_numbered(slide, 6.96, 2.62, "2", "記錄備用環境（fallback source）", "來源：setup／verify；值：fallback label；作用：選同情境資料；成功：source 更新；失敗：原 source 保持。", color=GOLD, w=5.30, h=1.18, body_size=18, name="Fallback environment field")
    rw_numbered(slide, 6.96, 3.96, "3", "terminal receipt（終端收據）", "來源：runner；值：install／verify／run／upload receipt；作用：定義完成；成功：收據可讀；失敗：本 capture 不補收據。", color=BLUE, w=5.30, h=1.18, body_size=18, name="Terminal receipt field")
    rw_sentence(slide, 5.38, "current Prepare capture：目前狀態為備用環境；記錄 READY、記錄備用環境都是尚待操作的 browser-local controls。terminal receipt 尚未在此 capture 提供。", size=20, x=0.82, w=11.54, h=0.54, name="READY interpretation")


def draw_rw95nav(slide, assets):
    lead(slide, "導覽、語言與 Lab tabs")
    picture(slide, assets["accepted_header"], 0.72, 1.30, 5.70, 2.84, name="Current navigation screenshot")
    for x, y, n in [(0.98, 1.56, "1"), (3.86, 1.56, "2"), (2.24, 2.86, "3")]:
        rw_callout_tag(slide, x, y, n, color=RED, name="Navigation callout")
    rw_numbered(slide, 6.78, 1.28, "1", "global navigation（全站導覽）", "來源：route state；值：focus；作用：前往操作區或首頁；成功：頁面切換；失敗：目前頁面保持。", color=BLUE, w=5.46, h=1.08, body_size=18, name="Global navigation field")
    rw_numbered(slide, 6.78, 2.50, "2", "繁中／EN（語言切換）", "來源：language state；值：language；作用：切換介面文字；成功：語言更新；失敗：目前語言保持。", color=PURPLE, w=5.46, h=1.08, body_size=18, name="Language field")
    rw_numbered(slide, 6.78, 3.72, "3", "實驗 A／B／C（Lab tabs）", "來源：section state；值：route；作用：切換工作台；成功：section 更新；失敗：current section 與 result 保持。", color=TEAL, w=5.46, h=1.08, body_size=18, name="Lab tabs field")
    rw_sentence(slide, 4.94, "導覽作用：按鈕改變 focus、language 或 section route；endpoint identity、service gate 與 result 不隨切頁重寫。", size=19, x=0.82, w=11.54, h=0.54, name="Navigation interpretation")
    rw_source_label(slide, "current Lab A crop：global navigation、language 與 Lab tabs 可見；按鈕狀態屬 browser-local UI state。", y=5.54)


def draw_rw95fallback(slide, assets):
    lead(slide, "fallback loader：選取下一筆備用資料")
    picture(slide, assets["fallback"], 0.72, 1.28, 5.82, 3.86, name="Current fallback screenshot")
    for x, y, n in [(1.02, 1.60, "1"), (4.20, 2.34, "2"), (2.24, 4.08, "3")]:
        rw_callout_tag(slide, x, y, n, color=RED, name="Fallback loader callout")
    rw_numbered(slide, 6.68, 1.28, "1", "fallback loader（備用載入器）", "來源：experiment order／source list；值：selected fallback；作用：選下一筆；成功：畫面切換；失敗：原 state 保持。", color=BLUE, w=5.56, h=1.12, body_size=18, name="Fallback loader field")
    rw_numbered(slide, 6.68, 2.54, "2", "selected source（選取來源）", "來源：fallback label／case；值：資料來源；作用：標示責任；成功：source 更新；失敗：terminal record 不改。", color=PURPLE, w=5.56, h=1.12, body_size=18, name="Selected source field")
    rw_numbered(slide, 6.68, 3.80, "3", "identity match（識別配對）", "來源：case／run；值：match／mismatch；作用：保護 replay／workbook；成功：record 可讀；失敗：原 result 保持。", color=TEAL, w=5.56, h=1.12, body_size=18, name="Identity match field")
    rw_sentence(slide, 5.22, "current Lab B 是 empty state；loader 的契約只定義有序 fallback 與 identity match，沒有從這張圖宣稱 selected result。", size=20, x=0.82, w=11.54, h=0.58, name="Fallback loader interpretation")


def draw_rw96(slide, assets):
    lead(slide, "任務勾選、證據鎖定與檢查後繼續")
    picture(slide, assets["workbook"], 0.72, 1.28, 4.46, 3.90, name="Current task control screenshot")
    for x, y, n in [(1.00, 1.70, "1"), (3.92, 2.44, "2"), (2.16, 4.10, "3")]:
        rw_callout_tag(slide, x, y, n, color=RED, name="Task control callout")
    rw_numbered(slide, 5.48, 1.26, "1", "task checkbox（任務勾選）", "來源：段落 evidence；值：completion；作用：更新任務；成功：顯示完成；失敗：原勾選狀態保持。", color=BLUE, w=6.76, h=1.08, body_size=18, name="Task checkbox field")
    rw_numbered(slide, 5.48, 2.48, "2", "證據已鎖定（evidence lock）", "來源：result／replay／source；值：lock state；作用：固定段落；成功：狀態更新；失敗：原 lock 保持。", color=PURPLE, w=6.76, h=1.08, body_size=18, name="Evidence lock field")
    rw_numbered(slide, 5.48, 3.70, "3", "檢查證據並繼續（continue check）", "來源：段落條件；值：next-section focus；作用：解鎖下一段；成功：focus 更新；失敗：current task 與 workbook 保持。", color=TEAL, w=6.76, h=1.08, body_size=18, name="Continue check field")
    rw_sentence(slide, 4.96, "狀態解讀：三個 controls 管理課程紀錄與解鎖狀態；它們不執行 Python，也不重算 endpoint replay。", size=19, x=0.82, w=11.54, h=0.54, name="Task control interpretation")
    rw_source_label(slide, "current Workbook crop：0/10、尚未匯出；completion 與 lock 是 browser-local record。", y=5.54)


def draw_rw97(slide, assets):
    lead(slide, "provider replay controls 與 endpoint selector")
    picture(slide, assets["timeline"], 0.78, 1.24, 11.56, 0.96, name="Provider replay control strip")
    controls = [("1", "播放結果（play）", "來源：provider frames；值：playback cursor；作用：播放 frame；成功：cursor 前進；失敗：原 cursor 保持。", TEAL), ("2", "暫停重播（pause）", "來源：目前 cursor；值：paused state；作用：固定 frame；成功：frame 停止；失敗：原 frame 保持。", PURPLE), ("3", "slider（滑桿）", "來源：frame sequence；值：selected provider frame；作用：更新 context；成功：frame 切換；失敗：原 context 保持。", BLUE), ("4", "上一／下一畫面（previous／next）", "來源：鄰接 frame；值：cursor；作用：切換 context；成功：frame 更新；失敗：原 cursor 保持。", GOLD)]
    for i, (n, head, body, color) in enumerate(controls):
        rw_numbered(slide, 0.78 + (i % 2) * 6.10, 2.30 + (i // 2) * 1.12, n, head, body, color=color, w=5.70, h=1.04, body_size=18, name="Provider replay control definition")
    # The selector is a separate layer from the two-row provider controls;
    # place it below the controls so its panel cannot cover either lower card.
    rw_field_row(slide, 4.70, "endpoint selector（端點選擇器）", "來源：endpoint frames；值：selected frame identity；作用：更新八欄、queue、event；成功：result frame 更新；失敗：原 frame 保持。", color=TEAL, h=0.76, label_w=2.72, body_size=18, name="Endpoint selector definition")
    rw_source_label(slide, "14:12 live Evidence／Lab A：endpoint replay 空白或時間軸收合；兩層 frame identity 各自保存。", y=5.72)


def draw_rw98(slide, assets):
    lead(slide, "current /course：replay fields 五至八")
    picture(slide, assets["accepted_fields"], 0.70, 1.24, 5.72, 2.00, name="Current fields second crop")
    for x, y, n in [(1.00, 1.46, "1"), (3.94, 1.62, "2"), (1.20, 2.20, "3"), (4.58, 2.36, "4")]:
        rw_callout_tag(slide, x, y, n, color=RED, name="Current fields second callout")
    rows = [
        ("Elapsed（經過時間）", "來源：trace；值：秒；作用：顯示 frame 進度，不等於 endpoint J。", BLUE),
        ("Contact ID（接觸識別）", "來源：fallback contact；值：識別字串；作用：配對窗口，不匹配維持原 frame。", PURPLE),
        ("Contact（接觸狀態）", "來源：contact state；值：open／closed；作用：判定窗口，closed 支持 SLEEP／WAIT。", TEAL),
        ("Quality（品質等級）", "來源：frame quality；值：ordinal band；作用：提供 quality_ready，不宣稱 dB 量測。", GOLD),
    ]
    for i, (label, body, color) in enumerate(rows):
        rw_field_row(slide, 1.26 + i * 1.02, label, body + "；成功：frame 更新；失敗：原 frame 保持。", color=color, x=6.58, w=5.68, h=0.98, label_w=1.98, body_size=18, name="Current fields second definition")
    rw_source_label(slide, "14:12 live Lab A：四欄待 frame selector；Quality 採 ordinal band 分類，不填入 current value。", y=5.70)


def draw_rw99_group(slide, title: str, rows, color=BLUE):
    lead(slide, title)
    for i, (label, body, row_color) in enumerate(rows):
        rw_field_row(slide, 1.34 + i * 1.02, label, body, color=row_color, h=0.90, label_w=2.84, body_size=18, name="Control contract definition")


def draw_rw99prepare(slide):
    draw_rw99_group(slide, "控制契約一：Prepare 與 Import", [
        ("開啟 GitHub 課程套件", "來源：repository／README；寫入：browser focus；成功：套件頁開啟；失敗：Prepare 頁保持。", BLUE),
        ("記錄 READY", "來源：terminal receipt；寫入：browser-local setup status；成功：顯示已記錄；失敗：原 status 保持。", TEAL),
        ("記錄備用環境", "來源：setup／verify 狀態；寫入：fallback source；成功：選定 fallback；失敗：原 source 保持。", GOLD),
        ("import state（匯入狀態）", "來源：result schema、identity、units；寫入：accepted／rejected；成功：artifact 進入 replay；失敗：原 selected result 保持。", PURPLE),
    ])


def draw_rw99replay(slide):
    draw_rw99_group(slide, "控制契約二：Replay 與進度備份", [
        ("播放／暫停／slider", "來源：provider frame sequence；寫入：playback cursor；成功：provider frame 更新；失敗：原 cursor 保持。", TEAL),
        ("上一／下一畫面", "來源：鄰接 provider frame；寫入：cursor；成功：切換 context；失敗：目前 frame 保持。", BLUE),
        ("endpoint selector", "來源：endpoint frames；寫入：selected frame；成功：八欄、queue、event 更新；失敗：原 frame 保持。", PURPLE),
        ("下載／還原／存檔點", "來源：本機進度與 JSON；寫入：下載、還原、存檔點；成功：本機 record 更新；失敗：原進度保持。", GOLD),
    ], color=TEAL)


def draw_rw99task(slide):
    draw_rw99_group(slide, "控制契約三：Task 與證據狀態", [
        ("task checkbox（任務勾選）", "來源：段落 evidence；寫入：completion；成功：任務狀態更新；條件不足：原 completion 保持。", BLUE),
        ("檢查證據並繼續", "來源：目前段落條件；寫入：next-section focus；成功：解鎖下一段；失敗：current section 保持。", TEAL),
        ("證據已鎖定", "來源：result、replay、source；寫入：lock state；成功：段落固定；失敗：原 evidence 與進度備份保持。", PURPLE),
        ("fallback loader（備用載入）", "來源：experiment order 與 source list；寫入：selected fallback；成功：畫面更新；identity mismatch：原 result 保持。", GOLD),
    ], color=GOLD)


def _draw_split_ui_page(slide, assets, title: str, asset_key: str, fields,
                        source: str, callouts=()):
    """Render two complete field contracts beside one readable crop.

    The current /course captures are useful evidence, but four 18 pt contracts
    do not fit in one narrow column.  Split pages keep the crop auditable and
    give each field a separate panel with source, value, operation, success,
    and failure text.  There is intentionally no second bottom rail.
    """
    lead(slide, title)
    picture(slide, assets[asset_key], 0.72, 1.24, 5.78, 3.72,
            name=f"{title} screenshot")
    for x, y, n in callouts:
        rw_callout_tag(slide, x, y, n, color=RED, name=f"{title} callout")
    for i, (label, body, color) in enumerate(fields):
        rw_numbered(slide, 6.72, 1.28 + i * 2.02, str(i + 1), label, body,
                    color=color, w=5.56, h=1.70, body_size=18,
                    name=f"{title} field")
    rw_source_label(slide, source, y=5.70)


def draw_rw65branch(slide):
    lead(slide, "原始程式：marker 外 consumer branch 與後續分支")
    rw_code(slide, 0.78, 1.28, 12.00, 1.78,
            "def choose_action(observation):\n"
            "    if not observation.contact_open:\n"
            "        return SLEEP\n"
            "    if observation.urgent_pending and observation.urgent_due_in_s <= URGENT_MARGIN_S:\n"
            "        return SEND_URGENT",
            name="Original consumer branch exact", size=18)
    rw_numbered(slide, 0.78, 3.28, "1", "窗口 gate",
                "來源：window；值：closed／open；作用：closed 回傳 SLEEP；成功：開放後續分支；失敗：原 state 保持。",
                color=RED, w=5.76, h=1.46, body_size=18,
                name="Original branch window detail")
    rw_numbered(slide, 6.72, 3.28, "2", "pacing／batch／WAIT",
                "來源：steps、quality、queue；值：REST／FLUSH／SEND／WAIT；作用：非急件決定 action；成功：下一 branch 更新；失敗：下一 frame 再判讀。",
                color=TEAL, w=5.76, h=1.46, body_size=18,
                name="Original branch pacing detail")
    rw_source_label(slide, "完整 marked block 在 P065；本頁只呈現 marker 外 consumer branch 與後續 action。", y=5.70)


def draw_rw67commands(slide):
    lead(slide, "exact edit 1：備份、編輯與語法檢查")
    rw_code(slide, 0.78, 1.42, 12.00, 1.70,
            "WSL／POSIX\n"
            "cp student_policy.py student_policy.before-C-edit.py\n"
            "nano student_policy.py\n"
            ".venv/bin/python -m py_compile student_policy.py",
            name="Edit one WSL commands", size=18)
    rw_code(slide, 0.78, 3.38, 12.00, 1.70,
            "Windows PowerShell\n"
            "Copy-Item student_policy.py -Destination student_policy.before-C-edit.py\n"
            "notepad .\\student_policy.py\n"
            ".\\.venv\\Scripts\\python.exe -m py_compile student_policy.py",
            name="Edit one Windows commands", size=18)
    rw_sentence(slide, 5.22, "py_compile 只檢查 Python 語法；接著以 run、policy guard、result_path 與 endpoint-replay.json 驗證行為。", size=18, x=0.82, w=11.54, h=0.60, name="Edit one command interpretation")


def draw_rw70commands(slide):
    lead(slide, "exact edit 2：修訂備份、編輯與語法檢查")
    rw_code(slide, 0.78, 1.42, 12.00, 1.70,
            "WSL／POSIX\n"
            "cp student_policy.py student_policy.before-C-revision.py\n"
            "nano student_policy.py\n"
            ".venv/bin/python -m py_compile student_policy.py",
            name="Revision WSL commands", size=18)
    rw_code(slide, 0.78, 3.38, 12.00, 1.70,
            "Windows PowerShell\n"
            "Copy-Item student_policy.py -Destination student_policy.before-C-revision.py\n"
            "notepad .\\student_policy.py\n"
            ".\\.venv\\Scripts\\python.exe -m py_compile student_policy.py",
            name="Revision Windows commands", size=18)
    rw_sentence(slide, 5.22, "py_compile 只檢查語法；revision 仍須以 --freeze run、policy guard、result_path 與 endpoint-replay.json 驗證行為。", size=18, x=0.82, w=11.54, h=0.60, name="Revision command interpretation")


def draw_rw78split_a(slide, assets):
    _draw_split_ui_page(slide, assets, "frame selector 一：選取畫面與目前 frame", "accepted_fields", [
        ("frame selector（畫面選擇器）", "來源：endpoint replay；值：frame identity；作用：改變目前觀察畫面；成功：selected frame 更新；失敗：原 frame 保持。14:12 live 尚未匯入。", BLUE),
        ("current frame（目前畫面）", "來源：result／replay pair；值：一個 frame；作用：固定 Radio、Action、queue、event；成功：欄位同 frame；失敗：跨 frame 不混讀。", PURPLE),
    ], "14:12 live Lab A：result.json 尚未匯入；selector 與 frame 值待 replay。", [])


def draw_rw78split_b(slide, assets):
    _draw_split_ui_page(slide, assets, "frame selector 二：八欄與 queue／event 分工", "accepted_fields", [
        ("eight fields（八欄）", "來源：endpoint artifact；值：state、count、J、時間、identity、ordinal band；作用：分頁讀取；成功：欄位跟隨 frame；失敗：原 frame 保持。", TEAL),
        ("queue／event（佇列／事件）", "來源：queue／event ledger；值：item、attempt、delivery、expiry；作用：解釋 service；成功：事件配對；失敗：原 event 保持。", GOLD),
    ], "14:12 live Lab A：八欄與 queue／event 的 frame identity 待 result.json；目前沒有 replay。", [])


def draw_rw79split_a(slide, assets):
    _draw_split_ui_page(slide, assets, "進度備份記錄一：匯入紀錄與本機存檔點", "workbook", [
        ("A／B／C 匯入紀錄", "來源：browser-local progress backup；值：0 筆；作用：記錄各實驗匯入進度；成功：紀錄更新；失敗：原紀錄保持。", BLUE),
        ("本機存檔點", "來源：browser-local progress backup；值：#0；作用：建立／還原本機進度；成功：存檔點更新；失敗：原進度保持。", PURPLE),
    ], "14:12 live 進度備份：A／B／C 匯入紀錄 0、本機存檔點 #0、格式 JSON。", [])


def draw_rw79split_b(slide, assets):
    _draw_split_ui_page(slide, assets, "進度備份記錄二：來源／角色與復原邊界", "workbook", [
        ("source／role（來源／角色）", "來源：A／B／C 匯入紀錄；值：source、case、role；作用：區分本機紀錄責任；成功：來源一致；失敗：原紀錄保持。", TEAL),
        ("backup format（備份格式）", "來源：進度備份頁；值：JSON；作用：下載與還原本機紀錄；成功：檔案可讀；失敗：不重算 runner result。", GOLD),
    ], "14:12 live 進度備份：目前沒有下載內容；本機紀錄與 runner result 分層。", [])


def draw_rw79save_a(slide, assets):
    _draw_split_ui_page(slide, assets, "進度備份控制一：下載與建立本機存檔點", "workbook", [
        ("下載進度備份", "來源：A／B／C 匯入紀錄與本機進度；值：JSON；作用：下載本機備份；成功：檔案產生；失敗：目前紀錄保持。", BLUE),
        ("建立本機存檔點", "來源：目前 browser-local progress；值：#0 → 新存檔點；作用：建立恢復位置；成功：存檔點更新；失敗：原進度保持。", PURPLE),
    ], "14:12 live 進度備份：下載 JSON 與建立本機存檔點按鈕可見；目前尚未下載。", [])


def draw_rw79save_b(slide, assets):
    _draw_split_ui_page(slide, assets, "進度備份控制二：還原與重設本機進度", "workbook", [
        ("從備份還原", "來源：下載的 JSON；值：A／B／C 匯入紀錄與進度；作用：還原本機紀錄；成功：畫面更新；失敗：沒有備份時原狀態保持。", TEAL),
        ("重設本機進度", "來源：browser-local progress；值：重設後的 0 筆紀錄；作用：清除本機進度；成功：狀態更新；失敗：原紀錄保持。", GOLD),
    ], "14:12 live 進度備份：從備份還原、還原存檔點、重設本機進度可見；runner result 不受改寫。", [])


def draw_rw85split_a(slide, assets):
    _draw_split_ui_page(slide, assets, "匯入資料：source 與 case", "accepted_header", [
        ("source（來源）", "來源：result.json／source label；值：待匯入；作用：標示資料責任；成功：建立 selected state；失敗：原 import state 保持。", BLUE),
        ("experiment／case（實驗／案例）", "來源：result.json header；值：A／B／C case 待補；作用：配對情境；成功：案例可讀；失敗：匯入狀態保持。", PURPLE),
    ], "14:12 live Lab A：source／case 欄位待 result.json；目前仍是尚未匯入狀態。", [])


def draw_rw85split_b(slide, assets):
    _draw_split_ui_page(slide, assets, "匯入狀態與備用標籤", "accepted_header", [
        ("import state（匯入狀態）", "來源：http://120.126.151.102:3000/course gate；值：尚未匯入；作用：控制 downstream view；成功：匯入後進 replay；失敗：原 state 保持。", TEAL),
        ("fallback label（備用標籤）", "來源：README／fallback source；值：同情境備用標籤；作用：支援欄位說明；成功：selected 更新；失敗：terminal record 不改。", GOLD),
    ], "14:12 live Lab A：尚未匯入與備用標籤分開標示；不升格 accepted upload。", [])


def draw_rw86split_a(slide, assets):
    _draw_split_ui_page(slide, assets, "service 與 delivered bits", "accepted_summary", [
        ("service（服務結果）", "來源：result.json summary；值：待匯入；作用：第一個 gate；成功：PASS 才繼續；失敗：目前狀態保持。", RED),
        ("delivered bits（已送達位元）", "來源：result.json endpoint；值：bit，待匯入；作用：量化資料並與 service 同讀；成功：數值可配對；失敗：原 record 保持。", BLUE),
    ], "14:12 live Lab A：服務摘要尚未產生；不填入 FAIL、bit 或 accepted-upload result。", [])


def draw_rw86split_b(slide, assets):
    _draw_split_ui_page(slide, assets, "endpoint J 與 bit/J", "accepted_summary", [
        ("endpoint J（端點能量）", "來源：result.json endpoint；值：J，待匯入；作用：描述端點代價；成功：scope 清楚；失敗：不升格系統能量。", PURPLE),
        ("bit/J（能量效率）", "來源：bits ÷ endpoint J；值：bit/J，待匯入；作用：描述效率；成功：可比較；失敗：service gate 優先。", GOLD),
    ], "14:12 live Lab A：endpoint J、bit/J 尚無 current value；只保留單位與 scope。", [])


def draw_rw87split_a(slide, assets):
    _draw_split_ui_page(slide, assets, "replay fields 一至二", "accepted_fields", [
        ("Radio（無線電狀態）", "來源：endpoint replay；值：SLEEP／TX／RX，待匯入；作用：描述 radio mode；成功：frame 更新；失敗：原 frame 保持。", BLUE),
        ("Action（策略動作）", "來源：policy replay；值：WAIT／SEND_URGENT／FLUSH_BATCH，待匯入；作用：指出 branch output；成功：event 更新；失敗：原 action 保持。", PURPLE),
    ], "14:12 live Lab A：Radio、Action 尚無 current frame；列舉值是欄位契約，不當作目前結果。", [])


def draw_rw87split_b(slide, assets):
    _draw_split_ui_page(slide, assets, "replay fields 三至四", "accepted_fields", [
        ("Queue count（佇列數量）", "來源：queue snapshot；值：packet count，待匯入；作用：描述待處理工作；成功：queue event 更新；失敗：原 queue 保持。", TEAL),
        ("累積 endpoint J（端點累積能量）", "來源：frame ledger；值：J，待匯入；作用：顯示目前累積代價；成功：J 更新；失敗：system energy 不在此欄。", GOLD),
    ], "14:12 live Lab A：Queue count、累積 endpoint J 待 current frame；目前沒有 replay。", [])


def draw_rw88split_a(slide, assets):
    _draw_split_ui_page(slide, assets, "queue 與事件一", "accepted_queue", [
        ("queue item（佇列項目）", "來源：result queue；值：item／count，待匯入；作用：顯示等待壓力；成功：同 frame 讀 Action；失敗：原 queue 保持。", BLUE),
        ("event type（事件類型）", "來源：packet trace；值：attempt／retry／delivered／expired，待匯入；作用：說明 action 結果；成功：回到 service；失敗：原 event 保持。", PURPLE),
    ], "14:12 live Lab A：queue 與 packet event 區尚無 current value；不補寫未見事件。", [])


def draw_rw88split_b(slide, assets):
    _draw_split_ui_page(slide, assets, "queue 與事件二", "accepted_queue", [
        ("packet identity（封包識別）", "來源：event ledger；值：packet label，待匯入；作用：連結重傳與送達；成功：identity 配對；失敗：原 identity 保持。", TEAL),
        ("delivery state（送達狀態）", "來源：service event；值：delivered／expired，待匯入；作用：支撐 deadline；成功：更新 gate；失敗：原 state 保持。", GOLD),
    ], "14:12 live Lab A：packet identity、delivery state 待 result.json；尚無 current event。", [])


def draw_rw89split_a(slide, assets):
    _draw_split_ui_page(slide, assets, "timeline 一：contact 與 quality", "timeline", [
        ("contact（接觸）", "來源：frame；值：contact ID／status，待匯入；作用：界定窗口並連回 SLEEP 或 action；成功：欄位更新；失敗：原 state 保持。", BLUE),
        ("quality（品質）", "來源：frame；值：ordinal band，待匯入；作用：判定 quality_ready；成功：品質欄位更新；失敗：WAIT 與原 state 保持。", PURPLE),
    ], "14:12 live Lab A：時間軸收合且尚未匯入；contact、quality 是待 frame 契約。", [])


def draw_rw89split_b(slide, assets):
    _draw_split_ui_page(slide, assets, "timeline 二：radio 與 policy branch", "timeline", [
        ("radio state（無線電狀態）", "來源：Radio；值：SLEEP／TX／RX，待匯入；作用：描述 state transition 並連接 endpoint J；成功：state 更新；失敗：原 state 保持。", TEAL),
        ("policy branch（策略分支）", "來源：Action；值：urgent／pacing／batch／wait，待匯入；作用：回到 policy branch；成功：action 更新；失敗：原 action 保持。", GOLD),
    ], "14:12 live Lab A：expanded frame sequence 尚未載入；transition 保持未知。", [])


def draw_rw90split_a(slide, assets):
    _draw_split_ui_page(slide, assets, "execution ledger 一", "accepted_ledger", [
        ("experiment／case（實驗／案例）", "來源：result.json／ledger；值：A／B／C case，待匯入；作用：配對 artifact；成功：案例一致；失敗：停止更新。", BLUE),
        ("role（案例角色）", "來源：comparison；值：baseline／candidate／revision，待 receipt；作用：定義比較位置；成功：role 可讀；失敗：selected record 不變。", PURPLE),
    ], "14:12 live Lab A：execution ledger 尚未建立；experiment、case、role 待 receipt。", [])


def draw_rw90split_b(slide, assets):
    _draw_split_ui_page(slide, assets, "execution ledger 二", "accepted_ledger", [
        ("service／endpoint J（服務／端點能量）", "來源：result.json；值：service、J，待匯入；作用：保留 gate 與 scope；成功：scope 清楚；失敗：J 不改寫 service。", TEAL),
        ("來源與畫面選取", "來源：browser-local import state；值：尚未匯入；作用：區分資料來源與 selected 畫面；成功：selected 更新；失敗：terminal record 不改。", GOLD),
    ], "14:12 live Lab A：selected state 為尚未匯入；沒有 current result 可升格。", [])


def draw_rw91split_a(slide, assets):
    lead(slide, "Evidence：Leo scene 與空 endpoint replay")
    # The live-refresh capture has a real Leo scene, but the endpoint replay
    # area is still empty.  Show that current image and label the gap directly.
    panel(slide, 0.72, 1.24, 5.78, 3.72, fill=WHITE, line_color=GRAY, name="Evidence current scene frame")
    picture(slide, assets["provider"], 0.72, 1.24, 5.78, 3.72, name="Current Leo scene evidence")
    text_box(slide, 1.00, 4.28, 5.18, 0.48,
             "endpoint replay：目前空白；result.json 尚未匯入",
             18, bold=True, color=NAVY, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE, fill=CREAM, line_color=GRAY,
             name="Evidence endpoint empty label", italic_code=False)
    rw_numbered(slide, 6.72, 1.28, "1", "scenario input（情境輸入）",
                "來源：Evidence README；值：Leo scene context；作用：提供 current context；成功：欄位可讀；失敗：空 endpoint replay 不臆造結果。",
                color=BLUE, w=5.56, h=1.70, body_size=18, name="Evidence scenario field")
    rw_numbered(slide, 6.72, 3.30, "2", "endpoint result（端點結果）",
                "來源：runner artifact；值：service／delivery／J／replay；作用：提供 endpoint evidence；成功：replay 可讀；失敗：目前 endpoint replay 空白。",
                color=TEAL, w=5.56, h=1.70, body_size=18, name="Evidence endpoint field")
    rw_source_label(slide, "14:12 live Evidence：Leo scene 可見；endpoint replay 空白，scenario／result 尚待匯入。", y=5.70)


def draw_rw91split_b(slide, assets):
    lead(slide, "Evidence：identity 與空 replay 邊界")
    panel(slide, 0.72, 1.24, 5.78, 3.72, fill=WHITE, line_color=GRAY, name="Evidence scene identity frame")
    picture(slide, assets["provider"], 0.72, 1.24, 5.78, 3.72, name="Current Leo scene identity evidence")
    text_box(slide, 1.00, 4.28, 5.18, 0.48,
             "identity 尚待 result.json；endpoint replay 空白",
             18, bold=True, color=NAVY, align=PP_ALIGN.CENTER,
             valign=MSO_ANCHOR.MIDDLE, fill=CREAM, line_color=GRAY,
             name="Evidence identity empty label", italic_code=False)
    rw_numbered(slide, 6.72, 1.28, "1", "identity boundary（識別邊界）",
                "來源：context／result；值：identity label；作用：避免跨層混讀；成功：配對 record；失敗：空 endpoint replay 尚無法核對。",
                color=PURPLE, w=5.56, h=1.70, body_size=18, name="Evidence identity field")
    rw_numbered(slide, 6.72, 3.30, "2", "empty capture（空白證據）",
                "來源：Evidence PNG；值：Leo scene、endpoint replay 空白；作用：標示目前空狀態；成功：空狀態可追；失敗：不臆造 provider PASS。",
                color=GOLD, w=5.56, h=1.70, body_size=18, name="Evidence empty field")
    rw_source_label(slide, "14:12 live Evidence：Leo scene 與空 endpoint replay；不宣稱 accepted result 或 provider PASS。", y=5.70)


def draw_rw92save_split_a(slide, assets):
    _draw_split_ui_page(slide, assets, "進度備份：下載與建立本機存檔點", "workbook", [
        ("下載進度備份", "來源：A／B／C 匯入紀錄與本機進度；值：JSON；作用：下載本機備份；成功：檔案產生；失敗：目前紀錄保持。", BLUE),
        ("建立本機存檔點", "來源：目前 browser-local progress；值：#0 或新存檔點；作用：建立恢復位置；成功：存檔點更新；失敗：原進度保持。", PURPLE),
    ], "14:12 live 進度備份：A／B／C 匯入紀錄 0、本機存檔點 #0、格式 JSON。", [])


def draw_rw92save_split_b(slide, assets):
    _draw_split_ui_page(slide, assets, "進度備份：從備份還原與目前紀錄", "workbook", [
        ("從備份還原", "來源：下載的 JSON；值：A／B／C 匯入紀錄與進度；作用：還原本機紀錄；成功：畫面更新；失敗：沒有備份時原狀態保持。", TEAL),
        ("目前進度紀錄", "來源：browser-local progress backup；值：0 筆匯入、#0；作用：顯示本機狀態；成功：狀態更新；失敗：原紀錄保持。", GOLD),
    ], "14:12 live 進度備份：尚未下載內容；從備份還原不重算 runner result。", [])


def draw_rw92checkpoint_split_a(slide, assets):
    _draw_split_ui_page(slide, assets, "進度備份：建立與還原本機存檔點", "workbook", [
        ("建立本機存檔點", "來源：identity／A／B／C 匯入紀錄；值：#0 或新存檔點；作用：建立保存點；成功：新增 record；失敗：current state 保持。", BLUE),
        ("還原本機存檔點", "來源：本機存檔點；值：local progress state；作用：回到保存內容；成功：進度回復；失敗：原 progress 保持。", TEAL),
    ], "14:12 live 進度備份：本機存檔點 #0；保存與 runner artifact 分層。", [])


def draw_rw92checkpoint_split_b(slide, assets):
    _draw_split_ui_page(slide, assets, "進度備份：重設本機進度與結果邊界", "workbook", [
        ("重設本機進度", "來源：local progress；值：重設後 0 筆紀錄；作用：改變本機進度；成功：progress 更新；失敗：原 progress 保持。", PURPLE),
        ("result boundary（結果邊界）", "來源：runner result、replay、service gate；值：原始 artifact；作用：保持科學結果；成功：identity 一致；失敗：不由空白進度備份補出。", GOLD),
    ], "14:12 live 進度備份：重設只改 local progress，不重算 endpoint result。", [])


def draw_rw93split_a(slide, assets):
    _draw_split_ui_page(slide, assets, "empty-state／recovery：匯入狀態與配對結果", "empty_lab_c", [
        ("empty import state（尚未匯入）", "來源：/course import state；值：尚未匯入；作用：保持 session；成功：rejection result 可讀；失敗：原 state 保持。", RED),
        ("matching artifact（配對結果）", "來源：experiment／case／run；值：match／mismatch；作用：選 recovery source；成功：回配對 record；失敗：原 result 保持。", BLUE),
    ], "14:12 live Lab C 是 empty state；rejection result 尚未出現。", [])


def draw_rw93split_b(slide, assets):
    _draw_split_ui_page(slide, assets, "empty-state／recovery：同情境 fallback", "empty_lab_c", [
        ("same-scenario fallback（同情境備用）", "來源：fallback label；值：fixed case；作用：更新 selected fallback；成功：欄位可重播；失敗：terminal record 不改。", GOLD),
        ("empty-state boundary（空狀態邊界）", "來源：current Lab C capture；值：沒有 replay；作用：標示資料缺口；成功：缺口可追；失敗：不補出 selected result。", PURPLE),
    ], "14:12 live Lab C empty state 保持誠實；matching artifact 仍須 identity 配對。", [])


def draw_rw94split_a(slide, assets):
    _draw_split_ui_page(slide, assets, "Prepare：READY 與備用環境", "ready", [
        ("記錄 READY", "來源：terminal READY receipt；目前值：尚未記錄。作用：只保存 browser-local 進度；按鈕不執行 setup／verify／run，也不產生 result.json。", TEAL),
        ("記錄備用環境（fallback source）", "來源：setup／verify 受阻紀錄；目前值：尚未記錄。作用：標示 same-scenario fallback；按鈕不產生 fresh result。", GOLD),
    ], "14:12 live Prepare：目前狀態為尚未記錄；記錄 READY 與記錄備用環境按鈕尚未操作。", [])


def draw_rw94split_b(slide, assets):
    _draw_split_ui_page(slide, assets, "Prepare：terminal receipt 與完成邊界", "ready", [
        ("terminal receipt（終端收據）", "來源：runner；值：install／verify／run／upload receipt；作用：定義完成；成功：收據可讀；失敗：本 capture 不補收據。", BLUE),
        ("completion boundary（完成邊界）", "來源：Python receipt；值：syntax、guard、result_path；作用：核對執行鏈；成功：可配對 replay；失敗：browser-local status 保持。", PURPLE),
    ], "14:12 live Prepare 沒有 terminal receipt；install、verify、run、upload 各由自身收據定義。", [])


def draw_rw95nav_split_a(slide, assets):
    _draw_split_ui_page(slide, assets, "導覽：global navigation 與語言", "accepted_header", [
        ("global navigation（全站導覽）", "來源：route state；值：focus；作用：前往操作區或首頁；成功：頁面切換；失敗：目前頁面保持。", BLUE),
        ("繁中／EN（語言切換）", "來源：language state；值：language；作用：切換介面文字；成功：語言更新；失敗：目前語言保持。", PURPLE),
    ], "14:12 live Lab A：global navigation、language 可見；狀態屬 browser-local UI。", [])


def draw_rw95nav_split_b(slide, assets):
    _draw_split_ui_page(slide, assets, "導覽：Lab tabs 與結果邊界", "accepted_header", [
        ("實驗 A／B／C（Lab tabs）", "來源：section state；值：route；作用：切換工作台；成功：section 更新；失敗：current section 保持。", TEAL),
        ("endpoint result（端點結果）", "來源：result／replay artifact；值：原始 identity；作用：保留 endpoint result boundary；成功：配對 record；失敗：切頁不重寫 result。", GOLD),
    ], "14:12 live tabs：準備／實驗 A／B／C／證據／進度備份；切頁不宣稱新的 endpoint result。", [])


def draw_rw95fallback_split_a(slide, assets):
    _draw_split_ui_page(slide, assets, "fallback loader：選取與來源", "fallback", [
        ("fallback loader（備用載入器）", "來源：experiment order／source list；值：selected fallback；作用：選下一筆；成功：畫面切換；失敗：原 state 保持。", BLUE),
        ("selected source（選取來源）", "來源：fallback label／case；值：資料來源；作用：標示責任；成功：source 更新；失敗：terminal record 不改。", PURPLE),
    ], "14:12 live Lab B 是 empty state；本頁只定義 loader 與 source 契約。", [])


def draw_rw95fallback_split_b(slide, assets):
    _draw_split_ui_page(slide, assets, "fallback loader：identity 配對與空狀態", "fallback", [
        ("identity match（識別配對）", "來源：case／run；值：match／mismatch；作用：保護 replay／workbook；成功：record 可讀；失敗：原 result 保持。", TEAL),
        ("empty-state boundary（空狀態邊界）", "來源：current Lab B capture；值：尚未匯入；作用：標示缺少 replay；成功：缺口可追；失敗：不宣稱 selected result。", GOLD),
    ], "14:12 live Lab B 是 empty state；沒有從畫面宣稱 selected result。", [])


def draw_rw96split_a(slide, assets):
    _draw_split_ui_page(slide, assets, "進度備份：下載與建立本機存檔點", "workbook", [
        ("下載進度備份", "來源：A／B／C 匯入紀錄與本機進度；值：JSON；作用：下載本機備份；成功：檔案產生；失敗：目前紀錄保持。", BLUE),
        ("建立本機存檔點", "來源：browser-local progress；值：#0 或新存檔點；作用：建立恢復位置；成功：存檔點更新；失敗：原進度保持。", PURPLE),
    ], "14:12 live 進度備份：0 筆匯入紀錄、#0；completion 與 lock 不由此頁臆造。", [])


def draw_rw96split_b(slide, assets):
    _draw_split_ui_page(slide, assets, "進度備份：還原與重設本機進度", "workbook", [
        ("從備份還原", "來源：下載的 JSON；值：A／B／C 匯入紀錄與進度；作用：還原本機紀錄；成功：畫面更新；失敗：沒有備份時原狀態保持。", TEAL),
        ("重設本機進度", "來源：browser-local progress；值：重設後的 0 筆紀錄；作用：清除本機進度；成功：狀態更新；失敗：原紀錄保持。", GOLD),
    ], "14:12 live 進度備份：還原與重設只寫本機紀錄；不執行 Python、不重算 replay。", [])


def draw_rw97split_a(slide, assets):
    _draw_split_ui_page(slide, assets, "provider replay controls 一：播放與暫停", "provider", [
        ("播放結果（play）", "來源：provider frames；值：playback cursor；作用：播放 frame；成功：cursor 前進；失敗：原 cursor 保持。", TEAL),
        ("暫停重播（pause）", "來源：目前 cursor；值：paused state；作用：固定 frame；成功：frame 停止；失敗：原 frame 保持。", PURPLE),
    ], "14:12 live Evidence：Leo scene 可見但 endpoint replay 空白；play／pause 待匯入 result。", [])


def draw_rw97split_b(slide, assets):
    _draw_split_ui_page(slide, assets, "provider replay controls 二：滑桿與端點 selector", "provider", [
        ("slider／previous／next", "來源：frame sequence／鄰接 frame；值：selected provider cursor；作用：切換 context；成功：frame 更新；失敗：原 cursor 保持。滑桿與鄰接畫面由這組控制。", BLUE),
        ("endpoint selector（端點選擇器）", "來源：endpoint frames；值：selected frame identity；作用：更新八欄、queue、event；成功：result frame 更新；失敗：原 frame 保持。", GOLD),
    ], "14:12 live Evidence：endpoint replay 尚未匯入；slider 與 endpoint frame identity 待 result。", [])


def draw_rw98split_a(slide, assets):
    _draw_split_ui_page(slide, assets, "replay fields 五至六", "accepted_fields", [
        ("Elapsed（經過時間）", "來源：trace；值：秒；作用：顯示 frame 進度，不等於 endpoint J；成功：elapsed 更新；失敗：原 trace 保持。", BLUE),
        ("Contact ID（接觸識別）", "來源：fallback contact；值：識別字串；作用：配對窗口；成功：ID 更新；失敗：原 contact identity 保持。", PURPLE),
    ], "14:12 live Lab A：Elapsed、Contact ID 待 frame selector；目前沒有 current value。", [])


def draw_rw98split_b(slide, assets):
    _draw_split_ui_page(slide, assets, "replay fields 七至八", "accepted_fields", [
        ("Contact（接觸狀態）", "來源：contact state；值：open／closed；作用：判定窗口；成功：state 更新；失敗：原 frame 保持。", TEAL),
        ("Quality（品質等級）", "來源：frame quality；值：ordinal band；作用：提供 quality_ready，不宣稱 dB 量測；成功：band 更新；失敗：原 quality 保持。", GOLD),
    ], "14:12 live Lab A：Contact、Quality 待 frame selector；Quality 為 ordinal band。", [])


_WEBSITE_NOTE_DETAILS = {
    "P076": "欄位定位：terminal runner 產生 result.json 與 replay；課程頁只驗證、重播與保存；進度備份只保存 A／B／C 匯入紀錄與本機存檔點。",
    "P077-A": "欄位定位：result.json、units、import state；按鈕先選結果檔，欄位來源是 runner artifact，值與單位待匯入，失敗時原 import state 不變。",
    "P077-B": "欄位定位：experiment／case、run identity、policy lineage；來源是 result header 與 receipt，值待匯入，配對失敗時目前畫面保持。",
    "P078-A": "欄位定位：frame selector、current frame；來源是 endpoint replay，值是 frame identity，作用是固定共同時間點，失敗時原 frame 保持。",
    "P078-B": "欄位定位：八欄、queue、event；來源是 endpoint artifact 與 ledger，值待匯入，作用是分頁讀取事件脈絡，失敗時原 event 保持。",
    "P079-A": "欄位定位：A／B／C 匯入紀錄、本機存檔點；來源是進度備份，值為 0 與 #0，成功才更新本機 record，並不重算 runner result。",
    "P079-A2": "欄位定位：source／role、backup format；來源是本機進度備份，值為來源角色與 JSON，還原失敗時原紀錄保持。",
    "P079-B": "按鈕定位：下載進度備份、建立本機存檔點；來源是 browser-local progress，成功寫入 JSON 或存檔點，失敗時原進度保持。",
    "P079-B2": "按鈕定位：從備份還原、重設本機進度；來源是 JSON 或 local progress，成功更新本機畫面，失敗時原狀態保持。",
    "P080": "狀態定位：下載、建立、還原、重設四種本機進度操作；它們只改 browser-local state，不改 runner artifact、service gate 或 replay result。",
    "P081": "欄位定位：水位、freshness、灌溉期限與 pump endpoint J；來源是轉移假設，目前未提供 live KPI，先讀 service condition，再解讀端點代價。",
    "P082": "欄位定位：舒適度、設備期限與 fan／compressor endpoint J；來源是轉移假設，成功條件是 service 與 deadline，失敗時能源描述不升格。",
    "P083": "欄位定位：freshness、完成狀態與 edge endpoint Joule；來源是轉移假設，先讀 freshness gate，再讀能源 scope。",
    "P084": "欄位定位：condition、branch、event、service、energy scope、claim ceiling；來源是 transfer record，成功保留 lineage，失敗時不補結果。",
    "P085-A": "欄位定位：source、experiment／case；來源是 result.json 與 header，值待匯入，成功建立 selected state，失敗時 import state 保持。",
    "P085-B": "欄位定位：import state、fallback label；來源是課程頁 gate 與 README，值為尚未匯入及同情境備用標籤，成功才進 replay，失敗時原 state 保持。",
    "P086-A": "欄位定位：service、delivered bits；來源是 result summary 與 endpoint，值待匯入，service 是第一個 gate，失敗時原 record 保持。",
    "P086-B": "欄位定位：endpoint J、bit/J；來源是 endpoint result，單位是 J 與 bit/J，作用是描述端點代價與效率，失敗時不改寫 service。",
    "P087-A": "欄位定位：Radio、Action；來源是 endpoint replay 與 policy replay，列舉值待匯入，成功更新 frame／event，失敗時原 action 保持。",
    "P087-B": "欄位定位：Queue count、累積 endpoint J；來源是 queue snapshot 與 frame ledger，單位是 packet count 與 J，成功更新同一 frame，失敗時原 queue 保持。",
    "P088-A": "欄位定位：queue item、event type；來源是 result queue 與 packet trace，值待匯入，成功配對 service，失敗時原 event 保持。",
    "P088-B": "欄位定位：packet identity、delivery state；來源是 event ledger 與 service event，成功連回 deadline，失敗時原 identity 與 state 保持。",
    "P089-A": "欄位定位：contact、quality；來源是 frame，值為 contact ID／status 與 ordinal band，成功更新欄位，失敗時原 state 保持。",
    "P089-B": "欄位定位：radio state、policy branch；來源是 Radio 與 Action，成功更新 transition，失敗時原 state 與 action 保持。",
    "P090-A": "欄位定位：experiment／case、role；來源是 result ledger 與 comparison receipt，成功配對案例，失敗時 selected record 保持。",
    "P090-B": "欄位定位：service／endpoint J、source／selected state；來源是 result 與 browser-local import state，成功維持 scope，失敗時 terminal record 不改。",
    "P091-A": "欄位定位：Leo scene、scenario input、endpoint result；Evidence 目前只有場景，endpoint replay 空白，沒有 result.json 就不宣稱結果。",
    "P091-B": "欄位定位：identity boundary、empty capture；來源是 Evidence scene 與 README，endpoint replay 空白，配對失敗時不宣稱 provider PASS。",
    "P092-A1": "按鈕定位：下載進度備份、建立本機存檔點；來源是 A／B／C 匯入紀錄與 local progress，成功更新 JSON 或 #0，失敗時原紀錄保持。",
    "P092-A2": "按鈕定位：從備份還原、目前進度紀錄；來源是 JSON 與 browser-local progress，成功更新畫面，失敗時原狀態保持，且不重算 runner result。",
    "P092-B1": "按鈕定位：建立本機存檔點、還原本機存檔點；來源是 identity 與 local checkpoint，成功新增或回復 record，失敗時原 progress 保持。",
    "P092-B2": "按鈕定位：重設本機進度、result boundary；來源是 local progress 與 runner artifact，重設只改本機紀錄，失敗時原 result 保持。",
    "P093-A": "欄位定位：empty import state、matching artifact；來源是 Lab C current capture，值為尚未匯入與待配對，成功才回到 record，失敗時原 session 保持。",
    "P093-B": "欄位定位：same-scenario fallback、empty-state boundary；來源是 Lab C fallback label，成功更新 selected fallback，失敗時不補 selected result。",
    "P094-A": "按鈕定位：記錄 READY、記錄備用環境；14:12 live 畫面的目前狀態是尚未記錄，兩個按鈕都尚未操作。記錄 READY 只保存已存在的 terminal READY receipt 到 browser-local progress；它不執行 setup、verify 或 run，也不產生 result.json。記錄備用環境只保存 fallback source，失敗時原狀態保持。",
    "P094-B": "欄位定位：terminal receipt、completion boundary；來源是 install／verify／run／upload receipt，成功配對 result_path 與 replay，缺收據時 browser-local status 保持。",
    "P095-A1": "按鈕定位：global navigation、繁中／EN；來源是 route 與 language state，成功更新 focus／language，失敗時目前頁面保持。",
    "P095-A2": "按鈕定位：實驗 A／B／C tabs、endpoint result；切頁只更新 section route，成功顯示新頁，失敗時 current section 保持，切頁不重寫 result。",
    "P095-B1": "欄位定位：fallback loader、selected source；來源是 experiment order 與 source list，成功切換 fallback，失敗時原 state 保持。",
    "P095-B2": "欄位定位：identity match、empty-state boundary；來源是 case／run 與 Lab B capture，配對成功才讀 record，失敗時原 result 保持。",
    "P096-A": "按鈕定位：下載進度備份、建立本機存檔點；來源是 local progress，值為 0 筆與 #0，成功更新本機紀錄，失敗時原紀錄保持。",
    "P096-B": "按鈕定位：從備份還原、重設本機進度；來源是 JSON 與 browser-local progress，成功更新畫面，失敗時原紀錄保持，不執行 Python。",
    "P097-A": "按鈕定位：播放結果、暫停重播；來源是 provider frames，值為 playback cursor，成功更新 cursor，失敗時原 cursor 保持。",
    "P097-B": "按鈕定位：slider／上一／下一畫面、endpoint selector；來源是 provider frames 與 endpoint frames，成功更新相應 frame，失敗時原 identity 保持。",
    "P098-A": "欄位定位：Elapsed、Contact ID；來源是 trace 與 fallback contact，單位為秒與識別字串，成功跟隨 frame，失敗時原值保持。",
    "P098-B": "欄位定位：Contact、Quality；來源是 contact state 與 frame quality，值為 open／closed 與 ordinal band，成功更新欄位，失敗時原 frame 保持。",
    "P099-A": "按鈕定位：開啟套件、記錄 READY、記錄備用環境、匯入狀態；成功更新 browser-local status 或 import state，驗證失敗時原 state 保持。",
    "P099-B": "按鈕定位：播放／暫停／slider、上一／下一畫面、endpoint selector、下載／還原／存檔點；各自只寫 cursor、frame 或本機 record。",
    "P099-C": "按鈕定位：task checkbox、檢查證據並繼續、證據已鎖定、fallback loader；成功更新 completion／focus／lock／source，失敗時原 state 保持。",
}


def expanded_rewrite_notes(p: RewritePage) -> str:
    """Make each physical slide note read as an executable delivery script."""
    base = p.notes.strip()
    label = p.label
    if label in {f"P0{i}" for i in range(64, 76)} or label in {"P065-B", "P067-B", "P070-B"}:
        labc = (
            "說法：先指出 lora-energy-lab/student_policy.py、" 
            "# === LORA EDITABLE: lab-c-batch-urgent ===、BATCH_SIZE = 3、"
            "URGENT_MARGIN_S 的當前值與完整 END marker；marker 外 consumer branch 逐字讀出 "
            "if observation.urgent_pending and observation.urgent_due_in_s <= URGENT_MARGIN_S:，"
            "下一行是 return SEND_URGENT。"
            "操作：只改 marked block 內的 URGENT_MARGIN_S 一行，先保存 distinct backup，再以兩種平台命令編輯與 py_compile。"
            "預期：py_compile 只回報語法可解析；run 才產生 status、run_id、result_path、artifact_source、claim_boundary 與 endpoint-replay.json。"
            "解讀：margin 越大越早進入急件分支，可能增加 endpoint J；service、deadline、action、state、delivery 與 endpoint J 必須一起判讀。"
            "復原：命令錯誤、identity 不符或 replay 缺失時保留原 artifact 與原狀態，不把空白資料補成結果。"
            "轉場：下一頁沿相同 artifact 讀取欄位，確認唯一改動是否真的改變 action timing 與服務期限。"
        )
        if label == "P066":
            labc += (
                "baseline｜Windows PowerShell：.\\course.cmd run --lab C --case baseline\n"
                "baseline｜WSL/POSIX：bash course.sh run --lab C --case baseline\n"
                "candidate｜Windows PowerShell：.\\course.cmd run --lab C --case candidate\n"
                "candidate｜WSL/POSIX：bash course.sh run --lab C --case candidate\n"
                "讀 stdout 的 status、run_id、result_path、artifact_source、claim_boundary，"
                "再以相同 run_id 配對 endpoint-replay.json，接著讀 service、deadline、action、state、endpoint J。"
            )
        elif label == "P072":
            labc += (
                "revision｜Windows PowerShell：.\\course.cmd run --lab C --case revision --freeze\n"
                "revision｜WSL/POSIX：bash course.sh run --lab C --case revision --freeze\n"
                "surprise｜Windows PowerShell：.\\course.cmd run --lab C --case surprise\n"
                "surprise｜WSL/POSIX：bash course.sh run --lab C --case surprise\n"
                "讀每筆 stdout 的 status、run_id、result_path、artifact_source、claim_boundary，"
                "配對 endpoint-replay.json 後再讀 service、deadline、action、state、endpoint J。"
            )
        if label in {"P067", "P067-B"}:
            labc += (
                "before：marked block 為 BATCH_SIZE = 3、URGENT_MARGIN_S = 20；after：只改成 URGENT_MARGIN_S = 5；"
                "完整 END marker 是 # === LORA END EDITABLE: lab-c-batch-urgent ===。"
                "備份／編輯／編譯：cp student_policy.py student_policy.before-C-edit.py；nano student_policy.py；"
                ".venv/bin/python -m py_compile student_policy.py；Windows：Copy-Item student_policy.py -Destination student_policy.before-C-edit.py；"
                "notepad .\\student_policy.py；.\\.venv\\Scripts\\python.exe -m py_compile student_policy.py。"
            )
        if label in {"P070", "P070-B"}:
            labc += (
                "before：URGENT_MARGIN_S = 5；revision after：只改成 URGENT_MARGIN_S = 30，BATCH_SIZE = 3 與兩個 marker 不變。"
                " revision 備份／編輯／編譯：cp student_policy.py student_policy.before-C-revision.py；nano student_policy.py；"
                ".venv/bin/python -m py_compile student_policy.py；Windows：Copy-Item student_policy.py -Destination student_policy.before-C-revision.py；"
                "notepad .\\student_policy.py；.\\.venv\\Scripts\\python.exe -m py_compile student_policy.py。"
            )
        return base + "\n\n" + labc
    detail = _WEBSITE_NOTE_DETAILS.get(label, "欄位定位：依頁面標題與可見欄位逐一讀來源、值／單位、作用、成功變化與失敗不變項。")
    website = (
        "說法：這是 2026-08-11 14:12 live capture，網址為 http://120.126.151.102:3000/course；"
        "目前沒有 accepted result.json，待匯入值維持空白，不能把列舉值說成 current result。"
        f"{detail}"
        "操作：先讀左側 current crop，再按右側欄位或按鈕順序朗讀；每個欄位都說明來源、值／單位、作用、成功變化與失敗不變項。"
        "預期：畫面只呈現目前 empty state、Leo scene 或 browser-local progress；成功操作才更新局部 UI，不能改寫 runner artifact。"
        "解讀：endpoint result、provider scene 與進度備份分層保存；空 endpoint replay 不升格為 accepted replay。"
        "復原：匯入缺失、identity mismatch 或按鈕失敗時保留原 state，回到 README 與 result.json 配對條件。"
        "轉場：下一頁繼續相同來源與 claim boundary，先確認資料是否已匯入，再讀下一組欄位。"
    )
    return base + "\n\n" + website


def draw_full_rewrite_page(slide, p: RewritePage):
    global ACTIVE_RW_PAGE
    ACTIVE_RW_PAGE = int(re.search(r"\d+", p.label).group())
    set_title(slide, f"{p.label}｜{p.title}")
    clear_placeholders(slide)
    functions = {
        "rw64": draw_rw64, "rw65": draw_rw65, "rw66": draw_rw66, "rw67": draw_rw67,
        "rw65branch": draw_rw65branch, "rw67commands": draw_rw67commands,
        "rw68": draw_rw68, "rw69": draw_rw69, "rw70": draw_rw70, "rw71": draw_rw71,
        "rw70commands": draw_rw70commands,
        "rw72": draw_rw72, "rw73gates": draw_rw73gates, "rw73energy": draw_rw73energy,
        "rw73causal": draw_rw73causal, "rw74": draw_rw74, "rw75": draw_rw75,
        "rw76": draw_rw76, "rw77format": draw_rw77format, "rw77lineage": draw_rw77lineage,
        "rw78": draw_rw78, "rw78splitA": draw_rw78split_a, "rw78splitB": draw_rw78split_b,
        "rw79records": draw_rw79records, "rw79splitA": draw_rw79split_a, "rw79splitB": draw_rw79split_b,
        "rw79save": draw_rw79save, "rw79saveA": draw_rw79save_a, "rw79saveB": draw_rw79save_b,
        "rw80": draw_rw80, "rw81": draw_rw81, "rw82": draw_rw82, "rw83": draw_rw83,
        "rw84": draw_rw84, "rw85": draw_rw85, "rw85splitA": draw_rw85split_a, "rw85splitB": draw_rw85split_b,
        "rw86": draw_rw86, "rw86splitA": draw_rw86split_a, "rw86splitB": draw_rw86split_b,
        "rw87": draw_rw87, "rw87splitA": draw_rw87split_a, "rw87splitB": draw_rw87split_b,
        "rw88": draw_rw88, "rw88splitA": draw_rw88split_a, "rw88splitB": draw_rw88split_b,
        "rw89": draw_rw89, "rw89splitA": draw_rw89split_a, "rw89splitB": draw_rw89split_b,
        "rw90": draw_rw90, "rw90splitA": draw_rw90split_a, "rw90splitB": draw_rw90split_b,
        "rw91": draw_rw91, "rw91splitA": draw_rw91split_a, "rw91splitB": draw_rw91split_b,
        "rw92save": draw_rw92save, "rw92saveSplitA": draw_rw92save_split_a, "rw92saveSplitB": draw_rw92save_split_b,
        "rw92checkpoint": draw_rw92checkpoint, "rw92checkpointSplitA": draw_rw92checkpoint_split_a,
        "rw92checkpointSplitB": draw_rw92checkpoint_split_b, "rw93": draw_rw93,
        "rw93splitA": draw_rw93split_a, "rw93splitB": draw_rw93split_b,
        "rw94": draw_rw94, "rw94splitA": draw_rw94split_a, "rw94splitB": draw_rw94split_b,
        "rw95nav": draw_rw95nav, "rw95navSplitA": draw_rw95nav_split_a, "rw95navSplitB": draw_rw95nav_split_b,
        "rw95fallback": draw_rw95fallback, "rw95fallbackSplitA": draw_rw95fallback_split_a,
        "rw95fallbackSplitB": draw_rw95fallback_split_b, "rw96": draw_rw96,
        "rw96splitA": draw_rw96split_a, "rw96splitB": draw_rw96split_b,
        "rw97": draw_rw97, "rw97splitA": draw_rw97split_a, "rw97splitB": draw_rw97split_b,
        "rw98": draw_rw98, "rw98splitA": draw_rw98split_a, "rw98splitB": draw_rw98split_b,
        "rw99prepare": draw_rw99prepare, "rw99replay": draw_rw99replay, "rw99task": draw_rw99task,
    }
    fn = functions[p.kind]
    assets = make_assets()
    if p.kind in {"rw77format", "rw77lineage", "rw78", "rw78splitA", "rw78splitB", "rw79records", "rw79splitA", "rw79splitB", "rw79save", "rw79saveA", "rw79saveB", "rw85", "rw85splitA", "rw85splitB", "rw86", "rw86splitA", "rw86splitB", "rw87", "rw87splitA", "rw87splitB", "rw88", "rw88splitA", "rw88splitB", "rw89", "rw89splitA", "rw89splitB", "rw90", "rw90splitA", "rw90splitB", "rw91", "rw91splitA", "rw91splitB", "rw92save", "rw92saveSplitA", "rw92saveSplitB", "rw92checkpoint", "rw92checkpointSplitA", "rw92checkpointSplitB", "rw93", "rw93splitA", "rw93splitB", "rw94", "rw94splitA", "rw94splitB", "rw95nav", "rw95navSplitA", "rw95navSplitB", "rw95fallback", "rw95fallbackSplitA", "rw95fallbackSplitB", "rw96", "rw96splitA", "rw96splitB", "rw97", "rw97splitA", "rw97splitB", "rw98", "rw98splitA", "rw98splitB"}:
        fn(slide, assets)
    else:
        fn(slide)
    note_text = expanded_rewrite_notes(p)
    if "http://120.126.151.102:3000/course" not in note_text:
        note_text = note_text.replace("/course", "http://120.126.151.102:3000/course")
    slide.notes_slide.notes_text_frame.text = note_text


def validate_full_rewrite_pages() -> None:
    labels = [p.label for p in FULL_REWRITE_PAGES]
    if labels[0] != "P064" or labels[-1] != "P099-C" or len(labels) < 40:
        raise ValueError(f"full rewrite page labels incomplete: {labels[:2]} / {labels[-2:]}")
    for p in FULL_REWRITE_PAGES:
        if FORBIDDEN in (p.title + p.notes) or MINUTE_RE.search(p.title + p.notes):
            raise ValueError(f"{p.label}: forbidden full rewrite content")
        if len(re.findall(r"[。！？!?]", p.notes)) < 2:
            raise ValueError(f"{p.label}: notes need at least two sentences")


def render_full_rewrite_deck() -> dict:
    FULL_REWRITE_RENDER_DIR.mkdir(parents=True, exist_ok=True)
    pdf = FULL_REWRITE_RENDER_DIR / (FULL_REWRITE_PROJECT_EXPORT.stem + ".pdf")
    for old in FULL_REWRITE_RENDER_DIR.glob("*.pdf"):
        old.unlink()
    for old in FULL_REWRITE_RENDER_DIR.glob("slide-*.png"):
        old.unlink()
    for old in FULL_REWRITE_RENDER_DIR.glob("contact-sheet-pass2-*.png"):
        old.unlink()
    try:
        # The managed helper can inherit a stale office profile from another
        # presentation lane.  Direct headless LibreOffice conversion is
        # deterministic here and keeps this project render isolated by
        # output path.
        subprocess.run(["libreoffice", "--headless", "--convert-to", "pdf:impress_pdf_Export", "--outdir", str(FULL_REWRITE_RENDER_DIR), str(FULL_REWRITE_PROJECT_EXPORT)], check=True, capture_output=True, text=True)
        # 150 dpi matches the established original-size review renders for the
        # 960x540 pt template page (2000x1125 px per slide).
        subprocess.run(["pdftoppm", "-png", "-r", "150", str(pdf), str(FULL_REWRITE_RENDER_DIR / "slide")], check=True, capture_output=True, text=True)
    except (OSError, subprocess.CalledProcessError) as exc:
        return {"status": "BLOCKED", "slides_rendered": 0, "reason": str(exc)}
    renders = sorted(FULL_REWRITE_RENDER_DIR.glob("slide-*.png"))
    # Pass-2 contact sheets keep every page inspectable without shrinking a
    # tall browser capture into a slide.  The individual PNGs remain the
    # original-size evidence for pixel review.
    sheet_paths: list[str] = []
    per_sheet = 11
    for sheet_index in range(0, len(renders), per_sheet):
        chunk = renders[sheet_index:sheet_index + per_sheet]
        thumbs = []
        for path in chunk:
            image = Image.open(path).convert("RGB")
            image.thumbnail((640, 360))
            canvas = Image.new("RGB", (660, 402), "white")
            canvas.paste(image, ((660 - image.width) // 2, 8))
            draw = ImageDraw.Draw(canvas)
            draw.text((12, 374), path.stem, fill=(30, 30, 30))
            thumbs.append(canvas)
        columns = 2
        rows = (len(thumbs) + columns - 1) // columns
        sheet = Image.new("RGB", (columns * 660, rows * 402), (235, 237, 241))
        for i, image in enumerate(thumbs):
            sheet.paste(image, ((i % columns) * 660, (i // columns) * 402))
        out = FULL_REWRITE_RENDER_DIR / f"contact-sheet-pass2-{sheet_index // per_sheet + 1:02d}.png"
        sheet.save(out)
        sheet_paths.append(str(out))
    return {"status": "PASS", "slides_rendered": len(renders), "render_size": "2000x1125", "pdf": str(pdf), "contact_sheets": sheet_paths, "fix_and_rerender_pass": "PASS2"}


def write_full_rewrite_reports(report: dict, visual: dict) -> None:
    audit_lines = [
        "# Part C teaching-rewrite page index",
        "",
        "頁碼採 module-local label；P073、P077、P079、P092、P095、P099 使用子頁標籤，交由總控合併時再決定最終編號。",
        "",
        "| label | title | kind | visible field contract |",
        "|---|---|---|---|",
    ]
    for p in FULL_REWRITE_PAGES:
        audit_lines.append(f"| {p.label} | {p.title} | {p.kind} | 中文名稱／來源／值型態或單位／作用／判讀已寫入 slide |")
    (ANALYSIS_DIR / "full-teaching-rewrite-page-audit.md").write_text("\n".join(audit_lines) + "\n", encoding="utf-8")
    manifest = {
        "schema": "c120-direct-teaching-part-c-teaching-rewrite-v1",
        "pages": [asdict(p) for p in FULL_REWRITE_PAGES],
        "template": str(TEMPLATE),
        "source": str(SOURCE_MD),
        "field_contract": str(FIELD_MD),
        "audit_contract": str(ROOT / "teaching-rewrite/part-c-teaching-readability-audit.md"),
        "outputs": [str(FULL_REWRITE_PROJECT_EXPORT)],
        "evidence_boundary": "simulated teaching data; not live; not measured",
        "current_browser_evidence": {
            "capture_date": "2026-08-11 14:12 Asia/Taipei",
            "readme": str(EVIDENCE_DIR / "README.md"),
            "files": [str(EVIDENCE_DIR / name) for name in (
                "prepare.png",
                "lab-a.png",
                "lab-b.png",
                "lab-c.png",
                "evidence.png",
                "progress-backup.png",
            )],
            "states": {
                "Lab A": "empty import state; no result.json imported",
                "Lab B": "empty import state; no result.json imported",
                "Lab C": "empty import state; no result.json imported",
                "Evidence": "Leo scene visible; endpoint replay area empty",
                "Progress backup": "checkpoint #0; 0 A/B/C imports; JSON backup not downloaded",
                "Prepare": "status not recorded; READY and fallback controls not operated",
            },
        },
    }
    (ANALYSIS_DIR / "full-teaching-rewrite-content-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (QA_DIR / "full-teaching-rewrite-visual-qa.json").write_text(json.dumps(visual, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (VALIDATION_DIR / "full-teaching-rewrite-structural-qa.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    note_lines = []
    for p in FULL_REWRITE_PAGES:
        title = p.title if "http://120.126.151.102:3000/course" in p.title else p.title.replace("/course", "http://120.126.151.102:3000/course")
        notes = expanded_rewrite_notes(p)
        if "http://120.126.151.102:3000/course" not in notes:
            notes = notes.replace("/course", "http://120.126.151.102:3000/course")
        note_lines.append(f"{p.label}｜{title}\n{notes}")
    (PROJECT / "sources/full-teaching-rewrite-speaker-notes.md").write_text("\n\n".join(note_lines) + "\n", encoding="utf-8")
    (VALIDATION_DIR / "full-teaching-rewrite-readback.txt").write_text(f"slides={report['slides']}\nstatus={report['status']}\nrendered={visual.get('slides_rendered', 0)}\noutput={FULL_REWRITE_PROJECT_EXPORT}\n", encoding="utf-8")


def build_full_rewrite(skip_render: bool = False) -> dict:
    validate_full_rewrite_pages()
    ensure_dirs()
    prs = Presentation(str(TEMPLATE))
    remove_all_slides(prs)
    for p in FULL_REWRITE_PAGES:
        slide = prs.slides.add_slide(prs.slide_layouts[1])
        draw_full_rewrite_page(slide, p)
    FULL_REWRITE_PROJECT_EXPORT.parent.mkdir(parents=True, exist_ok=True)
    prs.save(FULL_REWRITE_PROJECT_EXPORT)
    reopened = Presentation(str(FULL_REWRITE_PROJECT_EXPORT))
    report = structural_qa(reopened)
    visual = {"status": "SKIPPED", "slides_rendered": 0}
    if not skip_render:
        visual = render_full_rewrite_deck()
    write_full_rewrite_reports(report, visual)
    return {"output": str(FULL_REWRITE_PROJECT_EXPORT), "project_output": str(FULL_REWRITE_PROJECT_EXPORT), "slides": len(FULL_REWRITE_PAGES), "qa": report, "visual": visual}


def draw_checkpoint_page(slide, p: Page):
    set_title(slide, f"P{p.number:03d}｜{p.title}")
    clear_placeholders(slide)
    functions = {
        "rw64": draw_rw64,
        "rw65": draw_rw65,
        "rw66": draw_rw66,
        "rw67": draw_rw67,
        "rw68": draw_rw68,
        "rw69": draw_rw69,
        "rw70": draw_rw70,
        "rw71": draw_rw71,
    }
    functions[p.kind](slide)
    slide.notes_slide.notes_text_frame.text = p.notes


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
    code = ("BATCH_SIZE = 3\nURGENT_MARGIN_S = 20\n\n"
            "if observation.urgent_pending and\n"
            "   observation.urgent_due_in_s <= URGENT_MARGIN_S:\n"
            "    return SEND_URGENT\n\n"
            "if steps_since_send < PACE_GAP_STEPS:\n"
            "    return REST_DURING_GAP\n"
            "if quality_ready:\n"
            "    return FLUSH_BATCH if queue_size >= BATCH_SIZE else SEND_ONE\n"
            "return WAIT")
    panel(slide, 0.78, 1.36, 6.28, 4.22, fill=CREAM, line_color=NAVY, name="Original policy code")
    text_box(slide, 1.02, 1.58, 5.80, 3.82, code, 20, color=INK, name="Original policy code text", italic_code=True)
    branches = [("窗口關閉", "SLEEP", RED, PALE_RED), ("urgent_due_in_s ≤ 20", "SEND_URGENT", PURPLE, PALE_PURPLE), ("pacing gap", "REST_DURING_GAP", BLUE, PALE_BLUE), ("quality + queue", "FLUSH_BATCH / SEND_ONE", TEAL, PALE_TEAL), ("其他", "WAIT", GOLD, PALE_GOLD)]
    y = 1.42
    for label, action, color, fill in branches:
        card(slide, 7.42, y, 4.82, 0.70, label, action, fill=fill, line_color=color, body_size=18, heading_size=18, name="Original branch")
        y += 0.82
    text_box(slide, 0.86, 5.68, 11.60, 0.28, "完整句：原始門檻 20 可能較早介入 urgent，優先於 pacing／batch；要觀察送出時點，不先猜 J。問題：queue 已達 BATCH_SIZE 時，urgent branch 會先 flush 嗎？", 18, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Original question", italic_code=False)
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
    text_box(slide, 1.30, 4.40, 10.56, 0.68, f"完整句：URGENT_MARGIN_S 改成 {value}，預測 action 時機會改變；再用 packet、service、deadline、state ledger 檢驗。具體問題：哪個 gate 失敗會推翻「只是省能量」？", 19, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Prediction sentence text", italic_code=False)
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
    lead(slide, "withheld：policy frozen，邊界條件不重調")
    card(slide, 0.86, 1.52, 5.54, 2.98, "FROZEN REVISION", "URGENT_MARGIN_S = 30\npolicy bytes unchanged\n保留 revision receipt\n不新增 edit", fill=PALE_BLUE, line_color=BLUE, body_size=23, heading_size=20, name="Frozen policy")
    card(slide, 6.86, 1.52, 5.54, 2.98, "SURPRISE FALLBACK", "2,400 delivered bit\n5.41 J｜443.622921 bit/J\n3 retransmissions\n3 expired packets\nservice FAIL｜deadline FAIL", fill=PALE_RED, line_color=RED, body_size=21, heading_size=19, name="Surprise evidence")
    connector(slide, 6.46, 3.00, 6.80, 3.00, color=RED, width=2.0, arrow=True)
    text_box(slide, 1.00, 4.86, 11.32, 0.68, "具體問題：5.41 J 比 revision 低，是否再改 margin？判讀：保留 service／deadline FAIL，保存 result_path 與 provenance，使 surprise 界定 claim ceiling。", 21, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Surprise boundary", italic_code=False)
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
    lead(slide, "website boundary：驗證、重播、保存，不執行 Python")
    nodes = [("本機 runner", "student_policy.py\n產生 result.json", BLUE, PALE_BLUE), ("import gate", "schema／identity／units\nlineage／hash", PURPLE, PALE_PURPLE), ("Leo replay", "endpoint fields\nqueue／event／timeline", TEAL, PALE_TEAL), ("Workbook", "prediction／role\nsource／checkpoint", GOLD, PALE_GOLD)]
    x = 0.62
    for i, (head, body, color, fill) in enumerate(nodes):
        card(slide, x, 1.50, 2.78, 2.28, head, body, fill=fill, line_color=color, body_size=21, heading_size=18, name="Website responsibility")
        if i < 3:
            connector(slide, x + 2.78, 2.64, x + 3.00, 2.64, color=NAVY, width=1.6, arrow=True)
        x += 3.02
    text_box(slide, 1.00, 4.34, 11.28, 0.82, "網站不下載／安裝 Python，不執行 policy，不重算 provider；它只把已產生且通過 gate 的 artifact 帶進 replay 與 workbook。", 22, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Website boundary text", italic_code=False)
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
    card(slide, 0.82, 1.42, 5.66, 3.08, "填寫 evidence", "prediction\nresult／replay lineage\nsource／hash\nrole／service gate", fill=PALE_BLUE, line_color=BLUE, body_size=23, heading_size=20, name="Workbook evidence")
    card(slide, 6.82, 1.42, 5.66, 3.08, "保存與恢復", "checkpoint #／完成度\n建立／恢復\n匯出／重新開啟\n0/10 表示 workbook 段落完成度；policy score 由 service／J 欄位定義", fill=PALE_GOLD, line_color=GOLD, body_size=21, heading_size=20, name="Workbook recovery")
    connector(slide, 6.50, 2.96, 6.78, 2.96, color=NAVY, width=1.8, arrow=True)
    text_box(slide, 1.02, 4.92, 11.20, 0.58, "可直接講：重新開啟要重新核對 run identity、source、role 和 service；Workbook 不會替缺失 evidence 補成 COMPLETE。", 20, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Workbook sentence", italic_code=False)
    stamp(slide)


def draw_save(slide):
    lead(slide, "保存、重設、復原、匯出、重開：每個 control 有自己的責任")
    controls = [("建立存檔點", "保存可恢復的 prediction／hash", BLUE, PALE_BLUE), ("恢復存檔點", "回到已保存狀態", TEAL, PALE_TEAL), ("重設本機進度", "清除本機課程紀錄", RED, PALE_RED), ("復原重設", "撤回 reset 的本機狀態", PURPLE, PALE_PURPLE), ("匯出學習單", "保存可攜的 workbook", GOLD, PALE_GOLD), ("重新開啟學習單", "再核對 identity／source", NAVY, CREAM)]
    for i, (head, body, color, fill) in enumerate(controls):
        x = 0.76 + (i % 3) * 4.06
        y = 1.40 + (i // 3) * 1.44
        card(slide, x, y, 3.72, 1.16, head, body, fill=fill, line_color=color, body_size=18, heading_size=18, name="Workbook control")
    text_box(slide, 0.96, 4.64, 11.36, 0.70, "reset／undo 只管理本機紀錄；它們不復原 runner，也不使 import gate、service gate 或 withheld 結果消失。", 21, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Save boundary", italic_code=False)
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
    parts = [("CONDITION", "哪個窗口／期限？", BLUE, PALE_BLUE), ("BRANCH", "哪個 policy action？", PURPLE, PALE_PURPLE), ("EVENT", "queue／retry／expiry？", TEAL, PALE_TEAL), ("CLAIM", "scope 與適用邊界？", GOLD, PALE_GOLD)]
    x = 0.64
    for i, (head, body, color, fill) in enumerate(parts):
        card(slide, x, 1.50, 2.76, 1.38, head, body, fill=fill, line_color=color, body_size=20, heading_size=18, name="Transfer exit")
        if i < 3:
            connector(slide, x + 2.76, 2.20, x + 2.98, 2.20, color=NAVY, width=1.5, arrow=True)
        x += 3.08
    text_box(slide, 0.96, 3.46, 11.34, 1.10, "若需要 fresh run：先保存目前 result／replay／workbook identity，再依核准流程另開。website 只驗證、重播、保存，不偷偷補 Python 結果。", 22, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Exit rule", italic_code=False)
    stamp(slide)


def draw_source(slide, assets):
    lead(slide, "current /course：source、case、hash、source label 的讀取順序")
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
    card(slide, 6.72, 1.28, 5.54, 3.92, "IMPORTED ENDPOINT RESULT", "source／run identity\nsummary／replay／ledger\nendpoint scope\n不升格為 canonical replay", fill=PALE_TEAL, line_color=TEAL, body_size=23, heading_size=19, name="Endpoint boundary")
    connector(slide, 6.34, 3.24, 6.64, 3.24, color=NAVY, width=1.7, arrow=False)
    text_box(slide, 0.98, 5.28, 11.30, 0.34, "Evidence view：503 MODQN bundle requests 與 WebGL／GLTF warnings；不可宣稱 provider browser PASS。", 18, bold=True, color=RED, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Provider warning", italic_code=False)
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
    text_box(slide, 5.22, 4.90, 6.76, 0.52, "可直接講：不手改 JSON、不換 case、不洗掉 surprise；回 release backup／matching fallback，保存 recovery note。", 19, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Recovery rule", italic_code=False)
    stamp(slide)


def draw_ready(slide, assets):
    lead(slide, "Prepare：READY 是 browser-local record；run proof 由 runner receipt 定義")
    picture(slide, assets["ready"], 0.70, 1.22, 6.12, 3.94, name="READY current screen")
    card(slide, 7.08, 1.22, 5.30, 1.64, "記錄 READY", "只記錄 terminal 已看見 machine-readable READY\nLeo 沒有執行／驗證 Python", fill=PALE_TEAL, line_color=TEAL, body_size=20, heading_size=19, name="READY semantics")
    card(slide, 7.08, 3.06, 5.30, 1.64, "記錄備用環境", "誠實標示 setup／verify 無法完成\n改走 same-scenario fallback", fill=PALE_GOLD, line_color=GOLD, body_size=20, heading_size=19, name="Fallback semantics")
    text_box(slide, 0.96, 5.34, 11.30, 0.38, "READY 不安裝、不 verify、不 run、不 upload、不產生 result.json，也不證明 Lab 完成。", 20, bold=True, color=RED, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="READY boundary", italic_code=False)
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
    text_box(slide, 1.00, 5.10, 11.28, 0.52, "切頁、切語言、載入 fallback 都不跳過 identity／service gate，也不執行 Python。", 20, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Navigation boundary", italic_code=False)
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
    text_box(slide, 1.04, 5.30, 11.20, 0.36, "✓ 不能跳過 service／deadline；按鈕不執行 Python、不重算 replay、不宣布策略 PASS。", 19, bold=True, color=RED, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Task boundary", italic_code=False)
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
    card(slide, 6.70, 4.18, 5.46, 1.12, "system replay timeline", "provider context；不保證與 endpoint time 同步", fill=PALE_GOLD, line_color=GOLD, body_size=20, heading_size=18, name="System replay control")
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
    slide.notes_slide.notes_text_frame.text = p.notes


def remove_all_slides(prs: Presentation) -> None:
    ids = prs.slides._sldIdLst
    for item in list(ids):
        prs.part.drop_rel(item.rId)
        ids.remove(item)


def ensure_dirs() -> None:
    for folder in ("sources", "assets", "analysis", "exports", "renders", "qa", "validation"):
        (PROJECT / folder).mkdir(parents=True, exist_ok=True)


def validate_pages() -> None:
    expected = list(range(64, 100))
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
    manifest = {"schema": "c120-direct-teaching-part-c-v1", "pages": [asdict(p) for p in PAGES], "template": str(TEMPLATE), "template_sha256": hashlib.sha256(TEMPLATE.read_bytes()).hexdigest(), "source": str(SOURCE_MD), "field_contract": str(FIELD_MD), "evidence_boundary": BOUNDARY, "current_upload": {"experiment": "A", "case": "baseline", "source": "實際執行", "run_id": RUN_ID, "service": "FAIL", "energy_j": 6.92, "delivered_bits": 4800, "bit_per_j": 693.641618}}
    (ANALYSIS_DIR / "content-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (VALIDATION_DIR / "structural-qa.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (QA_DIR / "visual-qa.json").write_text(json.dumps(visual, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (PROJECT / "sources/part-c-visible-content.md").write_text(SOURCE_MD.read_text(encoding="utf-8"), encoding="utf-8")
    shutil.copy2(FIELD_MD, PROJECT / "sources/field-interpretation.md")
    shutil.copy2(TEMPLATE, PROJECT / "sources/educate.pptx")
    note_lines = [f"P{p.number:03d}｜{p.title}\n{p.notes}" for p in PAGES]
    (PROJECT / "sources/speaker-notes.md").write_text("\n\n".join(note_lines) + "\n", encoding="utf-8")
    (VALIDATION_DIR / "readback.txt").write_text(f"slides={report['slides']}\nstatus={report['status']}\nrendered={visual.get('slides_rendered', 0)}\n", encoding="utf-8")


def validate_checkpoint_pages() -> None:
    expected = list(range(64, 72))
    actual = [p.number for p in CHECKPOINT_PAGES]
    if actual != expected:
        raise ValueError(f"checkpoint page sequence mismatch: {actual}")
    for p in CHECKPOINT_PAGES:
        if FORBIDDEN in (p.title + p.notes) or MINUTE_RE.search(p.title + p.notes):
            raise ValueError(f"P{p.number:03d}: forbidden checkpoint content")
        if len(re.findall(r"[。！？!?]", p.notes)) < 2:
            raise ValueError(f"P{p.number:03d}: checkpoint notes need at least two sentences")


def render_checkpoint_deck() -> dict:
    """Render the checkpoint into its own directory when LibreOffice is available."""
    CHECKPOINT_RENDER_DIR.mkdir(parents=True, exist_ok=True)
    pdf = CHECKPOINT_RENDER_DIR / (CHECKPOINT_PROJECT_EXPORT.stem + ".pdf")
    for old in CHECKPOINT_RENDER_DIR.glob("*.pdf"):
        old.unlink()
    lo_profile = Path(tempfile.mkdtemp(prefix="c120-partc-checkpoint-lo-"))
    try:
        subprocess.run(
            ["python3", str(OFFICE_HELPER), "-env:UserInstallation=file://" + str(lo_profile), "--headless", "--convert-to", "pdf:impress_pdf_Export", "--outdir", str(CHECKPOINT_RENDER_DIR), str(CHECKPOINT_PROJECT_EXPORT)],
            check=True, capture_output=True, text=True,
        )
        subprocess.run(["pdftoppm", "-png", "-r", "120", str(pdf), str(CHECKPOINT_RENDER_DIR / "slide")], check=True, capture_output=True, text=True)
    except (OSError, subprocess.CalledProcessError) as exc:
        return {"status": "BLOCKED", "slides_rendered": 0, "reason": str(exc)}
    renders = sorted(CHECKPOINT_RENDER_DIR.glob("slide-*.png"))
    return {"status": "PASS", "slides_rendered": len(renders), "pdf": str(pdf)}


def write_checkpoint_reports(report: dict, visual: dict) -> None:
    audit_lines = [
        "# P064–P071 teaching-readability checkpoint audit",
        "",
        "此表記錄每頁的主要視覺、新英文欄位、中文定義、來源／值型態、操作作用與判讀。",
        "",
        "| 頁面 | 主要視覺與新欄位 | 中文／來源 | 值型態／單位 | 操作作用 | 判讀 |",
        "|---:|---|---|---|---|---|",
    ]
    for number, visual_focus, fields, values, operation, interpretation in CHECKPOINT_AUDIT:
        cells = [str(number), visual_focus, fields, values, operation, interpretation]
        audit_lines.append("| " + " | ".join(cell.replace("|", "／") for cell in cells) + " |")
    (ANALYSIS_DIR / "p064-p071-teaching-readability-audit.md").write_text("\n".join(audit_lines) + "\n", encoding="utf-8")
    manifest = {
        "schema": "c120-direct-teaching-part-c-checkpoint-v1",
        "pages": [asdict(p) for p in CHECKPOINT_PAGES],
        "template": str(TEMPLATE),
        "source": str(SOURCE_MD),
        "field_contract": str(FIELD_MD),
        "evidence_boundary": "deterministic fallback teaching data; not live; not measured",
        "outputs": [str(CHECKPOINT_PROJECT_EXPORT), str(CHECKPOINT_EXPORT)],
    }
    (ANALYSIS_DIR / "p064-p071-content-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (QA_DIR / "p064-p071-visual-qa.json").write_text(json.dumps(visual, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (VALIDATION_DIR / "p064-p071-structural-qa.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    note_lines = [f"P{p.number:03d}｜{p.title}\n{p.notes}" for p in CHECKPOINT_PAGES]
    (PROJECT / "sources/p064-p071-speaker-notes.md").write_text("\n\n".join(note_lines) + "\n", encoding="utf-8")
    (VALIDATION_DIR / "p064-p071-readback.txt").write_text(
        f"slides={report['slides']}\nstatus={report['status']}\nrendered={visual.get('slides_rendered', 0)}\noutput={CHECKPOINT_EXPORT}\n",
        encoding="utf-8",
    )


def build_checkpoint(skip_render: bool = False) -> dict:
    validate_checkpoint_pages()
    ensure_dirs()
    assets = make_assets()
    prs = Presentation(str(TEMPLATE))
    remove_all_slides(prs)
    for p in CHECKPOINT_PAGES:
        # Native source slide 2 / slideLayout2 content shell only.
        slide = prs.slides.add_slide(prs.slide_layouts[1])
        draw_checkpoint_page(slide, p)
    CHECKPOINT_PROJECT_EXPORT.parent.mkdir(parents=True, exist_ok=True)
    prs.save(CHECKPOINT_PROJECT_EXPORT)
    shutil.copy2(CHECKPOINT_PROJECT_EXPORT, CHECKPOINT_EXPORT)
    reopened = Presentation(str(CHECKPOINT_PROJECT_EXPORT))
    report = structural_qa(reopened)
    visual = {"status": "SKIPPED", "slides_rendered": 0}
    if not skip_render:
        visual = render_checkpoint_deck()
    write_checkpoint_reports(report, visual)
    return {"output": str(CHECKPOINT_EXPORT), "project_output": str(CHECKPOINT_PROJECT_EXPORT), "slides": len(CHECKPOINT_PAGES), "qa": report, "visual": visual}


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
    parser.add_argument("--checkpoint-p064-p071", action="store_true")
    parser.add_argument("--full-teaching-rewrite", action="store_true")
    args = parser.parse_args()
    if args.full_teaching_rewrite:
        result = build_full_rewrite(skip_render=args.skip_render)
    elif args.checkpoint_p064_p071:
        result = build_checkpoint(skip_render=args.skip_render)
    else:
        result = build(skip_render=args.skip_render)
    print(json.dumps({"output": result["output"], "slides": result["slides"], "qa_status": result["qa"]["status"], "rendered": result["visual"].get("slides_rendered", 0)}, ensure_ascii=False, indent=2))
    return 0 if result["qa"]["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
