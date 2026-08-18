#!/usr/bin/env python3
"""Build the standalone direct-teaching Part B deck (P028--P063).

The builder owns only ``projects/direct-teaching-part-b_ppt169_20260811``.  It
authors editable DrawingML shapes on the supplied educate template, inserts
the two equations as native Office Math, and keeps the template master,
layouts, theme, logo, footer line/wording, and page-number carrier intact.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import posixpath
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from dataclasses import asdict, dataclass
from pathlib import Path
from xml.etree import ElementTree as ET

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE, MSO_CONNECTOR
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt


ROOT = Path(__file__).resolve().parent
TEMPLATE = Path("/home/u24/ppt-master/template/educate.pptx")
PROJECT = ROOT / "projects/direct-teaching-part-b_ppt169_20260811"
SOURCE_COPY = PROJECT / "sources/educate.pptx"
EXPORT = PROJECT / "exports/c120-lora-leo-direct-teaching-part-b-editable_20260811.pptx"
RENDER_DIR = PROJECT / "renders"
RENDER_SOURCE = PROJECT / "validation/.render-source.pptx"
SOURCE_SCRIPT = ROOT / "teaching-rewrite/part-b-visible-content.md"
EQUATION_TOOL = ROOT / "insert-native-equations.py"

SLIDE_CX = 12_192_000
SLIDE_CY = 6_858_000
CONTENT_BOTTOM = 6.18
# Classroom prose is authored at 20 pt or above; only copyable operational
# strings (exact commands and stdout path receipts) are allowed at 18 pt.
# The QA hard floor is explicit so an accidental 17 pt regression is caught.
CLASSROOM_BODY_MIN_PT = 20
OPERATIONAL_TEXT_MIN_PT = 18
# The educate template's title rule sits at roughly 0.84 in.  Keep the first
# authored object at least 0.30 in below that rule and keep the claim boundary
# above the template footer with a real breathing gap.
CONTENT_TOP = 1.18
BOUNDARY_Y = 5.84

NAVY = RGBColor(53, 55, 127)
PURPLE = RGBColor(102, 0, 102)
BLUE = RGBColor(73, 103, 194)
TEAL = RGBColor(0, 115, 116)
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

FORBIDDEN = "學生"
MINUTE_RE = re.compile(r"(?:分鐘|\b\d+\s*(?:min|mins|minute|minutes)\b)", re.I)
LANGUAGE_BANNED = (
    "講師", "老師", "學生", "全班", "你", "請", "記得", "完成這堂課",
    "讓結果可教也可追溯", "能回答", "能指出", "能說出", "可以回答", "可教",
    "讓結果可以反駁原先想法", "不對，就先停下來", "先辨認 radio state，才談省電",
    "先……才……", "舊截圖", "不要縮成截圖", "只放必要欄位", "截圖安排", "版面",
    "Fit", "投影片應放", "講稿提示", "截圖", "placeholder", "evidence placeholder",
    "本頁不", "本頁", "這一頁", "policy SHA", "scenario hash", "anchor hash",
    "policy hash", "policy_sha256", "SHA-256", "checksum", "hash-verification",
    "ZIP-test", "zip test", "先...才...", "...", "…", "備課", "meta", "口語",
    "SHA", "sha256", "student_policy.A-baseline.py", "<checkpoint>.py",
)
VARIABLES = (
    "REST_DURING_GAP", "PACE_GAP_STEPS", "ENTER_QUALITY", "EXIT_QUALITY",
    "STABLE_STEPS", "student_policy.py", "scenario_id", "policy_sha256",
    "endpoint_energy_j", "delivered_bits", "service_pass", "deadline_pass",
    "endpoint J", "result_path", "MODE_CHANGE", "PACKET_ATTEMPT",
    "SEND_READY", "SLEEP", "WAIT", "WAKE", "PROCESS", "TX", "RX",
)
VARIABLE_RE = re.compile("(" + "|".join(re.escape(v) for v in sorted(VARIABLES, key=len, reverse=True)) + ")")

SCENARIO_ID = "ntpu-energy-decision-01"
COMMON_BOUNDARY = "SIMULATED TEACHING DATA｜NOT LIVE｜NOT MEASURED｜NOT CANONICAL-PARITY-VERIFIED"
VISIBLE_BOUNDARY = "SIMULATED TEACHING DATA｜NOT LIVE｜NOT MEASURED"

FALLBACK = {
    # These values are deliberately labelled as same-scenario fallback
    # references in the visible result cards.  They are not a fabricated
    # local run and contain no hash material in the deck.
    "baseline-A": {"energy": "6.92", "delivered": "4,800", "eff": "693.641618", "service": "FAIL", "deadline": "FAIL", "freshness": "expired", "wake": "2", "attempt": "2", "retry": "1", "expired": "3"},
    "candidate-A": {"energy": "8.86", "delivered": "4,800", "eff": "541.760722", "service": "FAIL", "deadline": "FAIL", "freshness": "expired", "wake": "1", "attempt": "2", "retry": "1", "expired": "3"},
    "hidden-A": {"energy": "3.61", "delivered": "0", "eff": "0", "service": "FAIL", "deadline": "FAIL", "freshness": "expired", "wake": "0", "attempt": "0", "retry": "0", "expired": "3"},
    "trace-a-baseline-B": {"energy": "8.86", "delivered": "4,800", "eff": "541.760722", "service": "FAIL", "deadline": "FAIL", "freshness": "expired", "wake": "1", "attempt": "2", "retry": "1", "expired": "3", "active": "8"},
    "trace-a-candidate-B": {"energy": "10.66", "delivered": "9,600", "eff": "900.562852", "service": "FAIL", "deadline": "FAIL", "freshness": "expired", "wake": "1", "attempt": "4", "retry": "1", "expired": "1", "active": "16"},
    "trace-b-B": {"energy": "5.43", "delivered": "4,800", "eff": "883.977901", "service": "FAIL", "deadline": "FAIL", "freshness": "expired", "wake": "1", "attempt": "2", "retry": "1", "expired": "2", "active": "8"},
}

# The visible code cards intentionally show the whole marked region.  The
# consumer line is included because the control edit is meaningful only when
# this branch actually consumes the edited symbol; the engine remains the
# owner of state/transition emission.
A_MARKED_BLOCK = (
    "# === LORA EDITABLE: lab-a-pace-rest ===\n"
    "PACE_GAP_STEPS = 2\n"
    "REST_DURING_GAP = SLEEP\n"
    "# === LORA END EDITABLE: lab-a-pace-rest ==="
)
A_MARKED_BLOCK_AFTER = A_MARKED_BLOCK.replace("REST_DURING_GAP = SLEEP", "REST_DURING_GAP = WAIT")
B_MARKED_BLOCK = (
    "# === LORA EDITABLE: lab-b-enter-exit-hold ===\n"
    "ENTER_QUALITY = 2\n"
    "EXIT_QUALITY = 1\n"
    "STABLE_STEPS = 2\n"
    "# === LORA END EDITABLE: lab-b-enter-exit-hold ==="
)
B_MARKED_BLOCK_AFTER = B_MARKED_BLOCK.replace("STABLE_STEPS = 2", "STABLE_STEPS = 1")
A_CONSUMER = "if observation.steps_since_send < PACE_GAP_STEPS: return REST_DURING_GAP"
B_CONSUMER = "student_policy.py branch consumes quality / stable_steps; lora_energy_lab/engine.py uses that global to create MODE_CHANGE"


@dataclass(frozen=True)
class SlideSpec:
    number: int
    title: str
    kind: str
    evidence: str
    purpose: str
    mechanism: str
    expected: str
    recovery: str
    context: str = ""
    command: str = ""
    visual: str = ""
    notes: str = ""
    suffix: str = ""


def spec(number: int, title: str, kind: str, *, evidence: str, purpose: str,
         mechanism: str, expected: str, recovery: str, context: str = "",
         command: str = "", visual: str = "", notes: str = "", suffix: str = "") -> SlideSpec:
    return SlideSpec(number, title, kind, evidence, purpose, mechanism, expected,
                     recovery, context, command, visual, notes, suffix)


def page_label(s: SlideSpec) -> str:
    return f"P{s.number:03d}{s.suffix}"


def _notes(title: str, body: str, recovery: str) -> str:
    return f"{title}。{body} 操作受阻時，{recovery}"


def spoken_notes(s: SlideSpec) -> str:
    """Turn each slide contract into a directly teachable read-aloud script."""
    scripted = DELIVERY_SCRIPTS.get(page_label(s)) if "DELIVERY_SCRIPTS" in globals() else None
    if scripted:
        return scripted
    context = s.context or "固定情境與前一頁保持一致"
    command = s.command.replace("\n", "；") if s.command else "依頁面上的操作順序讀取既有證據"
    # _notes() carries a recovery clause for the source contract.  Keep that
    # clause in the dedicated Recovery line so the rendered notes read as a
    # continuous teaching script rather than repeating the same phrase in
    # Say and Recovery.
    say = s.notes.strip()
    if "操作受阻時，" in say:
        say = say.split("操作受阻時，", 1)[0].rstrip("。 ")
    transition = "接著把這個 evidence 帶到下一個 result／replay gate。"
    if s.kind in {"edit-a", "edit-a-commands", "edit-a-consumer", "edit-b", "edit-b-commands", "edit-b-consumer"}:
        transition = "接著保留唯一 edit，完成 syntax guard，再進入 exact run。"
    elif s.kind in {"run-a", "receipt-a", "run-b", "receipt-b"}:
        transition = "接著依 result_path 開 result.json 與同 run endpoint-replay.json，再做 summary 判讀。"
    elif s.kind in {"withheld-a", "withheld-a-result", "withheld-b", "withheld-b-result"}:
        transition = "接著把 withheld evidence 當成 claim ceiling，而不是再調參。"
    text = (
        f"Point：{s.title}。"
        f"Say：{say}。"
        f"Do：在 {context} 依序執行或讀取：{command}。"
        f"Why：{s.purpose}。"
        f"Mechanism：{s.mechanism}。"
        f"Expect：{s.expected}。"
        f"Interpret：結果符合預期時，將它解讀為 {s.evidence}；結果不符時，保留 stdout、result 與 replay。"
        f"Transition：{transition}"
        f"Recovery：{s.recovery}"
    )
    if s.kind in {"run-a", "receipt-a", "run-b", "receipt-b"}:
        lab = "A" if s.kind in {"run-a", "receipt-a"} else "B"
        checkpoint = "lab-a-frozen" if lab == "A" else "lab-b-frozen"
        text += (
            f"每條 run receipt 只朗讀 status、run_id、result_path、artifact_source、"
            f"claim_boundary，不朗讀任何識別摘要值；依 stdout 的 result_path 開啟 "
            f"artifacts/<run_id>/result.json，再開同一目錄的 endpoint-replay.json。"
            f"candidate --freeze 成功時，checkpoint 是 artifacts/checkpoints/{checkpoint}.{{json,py}}。"
        )
    return text


A_RECOVERY = "保留 stdout／stderr；用 A checkpoint 或同 scenario fallback 恢復，不再調參。"
B_RECOVERY = "receipt、predecessor 或 policy identity 不符時停止 withheld，恢復 A／B checkpoint。"
PAIR_RECOVERY = "result／replay 不成 pair 時保留錯誤，回到該次 stdout result_path，不手改 JSON。"


PAGES = [
    spec(28, "Radio state 與停留時間：endpoint energy 的積分基礎", "states", evidence="FALLBACK ARTIFACT｜SIMULATED",
         purpose="建立 state vocabulary、觸發條件、duration 與 energy bucket 的對照。",
         mechanism="SLEEP 是低功耗休息；WAIT 是 awake idle；WAKE、PROCESS、TX、RX 都會留下時間與功率。",
         expected="完整 ledger 由 state interval、power、duration 與 endpoint J 組成；action 名稱只標記一次決策。",
         recovery=PAIR_RECOVERY, visual="SLEEP → WAKE → PROCESS → TX → RX；WAIT = awake idle",
         notes=_notes("P028", "沿著 state 帶說明每個名稱如何對應 result 的 interval 與 energy bucket", PAIR_RECOVERY)),
    spec(29, "Lab A：SLEEP 與 WAIT 的 service／energy 比較", "challenge", evidence="LAB A MECHANISM｜SIMULATED TEACHING DATA",
         purpose="固定挑戰、成功 gate 與一個 exact edit。",
         mechanism="SLEEP 降低 idle power 並支付 wake；WAIT 維持 awake idle 並增加 awake-idle；service 與整段 J 共同形成結果。",
         expected="固定 scenario／seed／traffic／window／endpoint boundary，再讀 delivered、deadline、freshness 與 endpoint J。",
         recovery=A_RECOVERY, visual="同一工作：SLEEP ↔ WAIT → state → packet → service → J",
         notes=_notes("P029", "判斷 J 下降但 service_pass 變成 false 時，是否稱為節能成功", A_RECOVERY)),
    spec(30, "封包生命週期：送出與交付分開判定", "packet", evidence="FALLBACK ARTIFACT｜SIMULATED",
         purpose="packet ledger 定義交付事件；energy ledger 定義 endpoint 累積。",
         mechanism="generated → queue → attempt → collision／retry → delivered 或 expired → service verdict。",
         expected="attempted、retransmissions、unique_delivered、expired 與 deadline 必須一起讀。",
         recovery=PAIR_RECOVERY, visual="generated → queue → attempt → retry → delivered／expired → verdict",
         notes=_notes("P030", "一次 SEND 是 policy decision，不等於 service 已交付", PAIR_RECOVERY)),
    spec(31, "Service gate 與 endpoint J 的比較順序", "gate", evidence="BOUNDARY RULE｜SIMULATED TEACHING DATA",
         purpose="防止少做工作被誤教成更有效率。",
         mechanism="same identity → delivered／deadline／freshness → service_pass → endpoint J。",
         expected="兩次結果須有相同 scenario、job、window、traffic 與 endpoint scope。",
         recovery=PAIR_RECOVERY, visual="same scenario → service gate → endpoint energy",
         notes=_notes("P031", "service gate 決定 endpoint J 的解讀層級；低 J 維持為單一觀察值", PAIR_RECOVERY)),
    spec(32, "W 是瞬間功率，J 是整段累積", "power", evidence="MODEL BOUNDARY｜SIMULATED",
         purpose="把 power rate 與時間累積出的 energy 分開讀。",
         mechanism="WAIT／SLEEP 使用固定 clock step；PROCESS、TX、RX、WAKE 另有 transition cost。",
         expected="沿著 interval 看 duration，再把 awake_idle、sleep、wake、process、TX、RX 加回 total。",
         recovery=PAIR_RECOVERY, visual="P(t) height + time span → endpoint J",
         notes=_notes("P032", "低峰值拖得久仍可能累積較多 J", PAIR_RECOVERY)),
    spec(33, "endpoint energy 公式只涵蓋 endpoint 邊界", "formula-energy", evidence="EDITABLE OFFICE MATH｜SIMULATED",
         purpose="讀懂每個 endpoint state 的功率與停留時間如何累積。",
         mechanism="E_endpoint = Σ P_s t_s；endpoint scope 包含 radio／processing，不包含 satellite／gateway／whole-system wall-plug。",
         expected="native Office Math 可編輯；數值仍由 result artifact 提供。",
         recovery=PAIR_RECOVERY, visual="E_endpoint = Σ P_s t_s",
         notes=_notes("P033", "公式定義 scope 與累積語義；本次數值來源為 result artifact", PAIR_RECOVERY)),
    spec(34, "energy efficiency 的分子與分母要同一個邊界", "formula-eff", evidence="EDITABLE OFFICE MATH｜SIMULATED",
         purpose="同時確認 delivered data 分子、endpoint energy 分母與 units。",
         mechanism="η_E = D_delivered / E_endpoint；bit ÷ J = bit/J；service_pass 仍是獨立 gate。",
         expected="native Office Math 可編輯；efficiency ratio 與 delivery、deadline verdict 分開判定。",
         recovery=PAIR_RECOVERY, visual="η_E = D_delivered / E_endpoint；bit/J",
         notes=_notes("P034", "delivery gate 維持獨立；bit 與 J 僅在同一 endpoint boundary 內形成比值", PAIR_RECOVERY)),
    spec(35, "來源、模型、課程假設與結果要分開", "layers", evidence="PROVENANCE SPINE｜SIMULATED",
         purpose="沿 scenario、seed、policy identity 與 artifact source 回溯一筆結果。",
         mechanism="source → model → course assumption → result；上游 provenance 參考不等於上游程式被執行。",
         expected="runner_provenance.upstream_execution=false；claim boundary 隨 artifact 保存。",
         recovery=PAIR_RECOVERY, visual="source → model → course → result",
         notes=_notes("P035", "資料類型維持 coherent simulated result；provenance 記錄 input、policy 與 output 的關聯", PAIR_RECOVERY)),
    spec(36, "執行結果如何進入重播與工作簿", "identity", evidence="IDENTITY GATE｜FAIL CLOSED",
         purpose="確保 scenario、anchor、policy、seed 與 units 在整條鏈一致。",
         mechanism="scenario package → result.json → endpoint-replay.json → Leo replay → workbook；mismatch 不猜身份。",
         expected=f"同一 {SCENARIO_ID}、scenario identity、anchor identity、policy identity、seed 與 units。",
         recovery="identity mismatch：保留輸入與錯誤，回到 matching artifact；不可手改 JSON。", visual="scenario → result → replay → workbook",
         notes=_notes("P036", "配對 identity 比單一漂亮數字更重要", "identity mismatch 時 fail closed")),
    spec(37, "Baseline：固定條件下的 control execution", "control", evidence="CONTROL RULE｜SIMULATED",
         purpose="固定條件，使目前 lab 僅有 marked block 變動。",
         mechanism="固定 scenario／seed／traffic／window／endpoint scope；只改一個 marked block；觀察 state／packet／service／J。",
         expected="若 scenario identity、traffic 或 scope 偷換，A/B 失去因果資格。",
         recovery=PAIR_RECOVERY, visual="FIXED → ONE EDIT → OBSERVE",
         notes=_notes("P037", "Baseline 使用固定情境、隨機種子與原始 policy，作為對照執行", PAIR_RECOVERY)),
    spec(38, "LEO：changing-service-window trace 的輸入範例", "window", evidence="WINDOW CONTEXT｜NOT LIVE",
         purpose="為 Lab B 的 quality window 問題建立 changing opportunity 背景。",
         mechanism="contact_open、quality_band、contact_remaining_s 進入 observation；窗口關閉時只接受 SLEEP。",
         expected="changing-service-window trace 依序提供 closed、contact-a、closed、contact-b、closed 的輸入。",
         recovery=PAIR_RECOVERY, visual="closed → contact-a → closed → contact-b → closed",
         notes=_notes("P038", "LEO 範例採用預先定義的 changing-service-window trace，作為 endpoint 傳輸時機的輸入", PAIR_RECOVERY)),
    spec(39, "Lab A：等待空檔的 radio state 比較", "lab-a-hero", evidence="LAB A MECHANISM｜SIMULATED",
         purpose="固定 scenario、case workload、service window、seed、endpoint energy model 與 PACE_GAP_STEPS = 2。",
         mechanism="SLEEP（低功耗休息）→ WAKE cost；WAIT（清醒閒置）→ awake-idle energy。唯一修改：REST_DURING_GAP = SLEEP → WAIT。",
         expected="比較 state duration、wake event／energy、packet outcome、service result 與 endpoint_energy_j；唯一修改 → state 變化 → packet/service → endpoint energy。",
         recovery=A_RECOVERY, visual="機制假說 → baseline → edit → run → compare → hidden",
         notes=_notes("P039", "Lab A 固定同一工作，沿 state、packet、service、J 解釋差異", A_RECOVERY)),
    spec(40, "A-00a：Baseline decision 與 Trace evidence", "baseline-a", evidence="FALLBACK ARTIFACT｜SIMULATED",
         purpose="以 P042 第一條 stdout result_path 建立 A control。",
         mechanism="contact_open=false（服務窗口布林狀態）→ SLEEP；steps_since_send < PACE_GAP_STEPS（間隔步數）→ REST_DURING_GAP；gap 結束後選擇 WAIT 或 SEND。",
         expected=f"參考 baseline：{FALLBACK['baseline-A']['energy']} J、{FALLBACK['baseline-A']['delivered']} bit、service_pass={FALLBACK['baseline-A']['service']}；實際以 stdout path 為準。",
         recovery="P042 baseline result／replay 缺失時重跑該命令，使用新的 stdout result_path，不猜路徑。",
         context="package root；P042 第一條 stdout result_path；A release block",
         command="WSL / POSIX：bash course.sh run --lab A --case baseline\nPowerShell：.\\course.cmd run --lab A --case baseline",
         visual="decision card → baseline evidence card",
         notes=_notes("P040", "Baseline 固定原始 policy；下一個 case 的唯一修改是 REST_DURING_GAP", "重新取得同一次 baseline 的 result／replay pair")),
    spec(40, "A-00b：Baseline summary fields", "baseline-a-result", suffix="a", evidence="RESULT SUMMARY｜SIMULATED",
         purpose="將 baseline stdout result_path 對應到完整 summary 欄位。",
         mechanism="result.json 提供 service、deadline、freshness、delivery、endpoint energy 與 packet counters；endpoint-replay.json 保留同 run events。",
         expected="summary 欄位完整可讀；same-scenario-fallback reference 明確標示不是 fresh run。",
         recovery=PAIR_RECOVERY, context="P040 stdout result_path；artifacts/<run_id>/result.json + endpoint-replay.json",
         visual="summary fields → baseline interpretation",
         notes=_notes("P040b", "逐欄讀 baseline summary，再把下一頁 candidate 放到同一 identity gate", PAIR_RECOVERY)),
    spec(41, "A-01a：path 與 BEFORE 完整 marked block", "edit-a", evidence="EXACT EDIT｜POLICY SURFACE",
         purpose="只改 Lab A 的一個 marked block，使 action 差異具可歸因性。",
         mechanism="PACE_GAP_STEPS=2 保持不變；唯一修改為 REST_DURING_GAP：SLEEP → WAIT；state 變化由 packet／service／J result 觀察。",
         expected="backup + py_compile 回傳碼 0；active block 清楚顯示 REST_DURING_GAP = WAIT。",
         recovery="若 guard 或 syntax 失敗，從 student_policy.before-A-edit.py 還原，只重新 compile。",
         context="package root；student_policy.py；lab-a-pace-rest marked block",
         command="WSL / POSIX：cp student_policy.py student_policy.before-A-edit.py\n.venv/bin/python -m py_compile student_policy.py\nPowerShell：Copy-Item student_policy.py -Destination student_policy.before-A-edit.py\n.\\.venv\\Scripts\\python.exe -m py_compile student_policy.py",
         visual="PACE_GAP_STEPS = 2\nREST_DURING_GAP = SLEEP  →  WAIT",
         notes=_notes("P041", "Prediction 包含 wake event 與 awake-idle 的方向；完成一行 edit 後取得 result", "只還原 A marked block")),
    spec(41, "A-01d：AFTER 完整 marked block", "edit-a-after", suffix="d", evidence="EXACT EDIT｜AFTER BLOCK",
         purpose="在獨立頁保留完整 candidate marked block，讓唯一修改行可直接核對。",
         mechanism="PACE_GAP_STEPS = 2 不變；REST_DURING_GAP 由 SLEEP 改為 WAIT；marker 邊界維持原樣。",
         expected="AFTER block 的唯一差異是 REST_DURING_GAP = WAIT；其他 block 不動。",
         recovery="差異超過一行時回 student_policy.before-A-edit.py，再次核對 marker。", context="package root；lora-energy-lab/student_policy.py；lab-a-pace-rest",
         visual="BEFORE → AFTER；only REST_DURING_GAP changes", notes=_notes("P041d", "這頁只核對 AFTER bytes；下一頁讀 Windows／WSL edit commands", "回 A before backup")),
    spec(41, "A-01b：WSL 與 PowerShell edit commands", "edit-a-commands", suffix="b", evidence="EDIT COMMANDS｜SYNTAX GUARD",
         purpose="依 package-relative path 完成 editor、backup 與 py_compile 順序。",
         mechanism="editor 只改 student_policy.py；backup 保留 before bytes；py_compile 只驗 Python syntax。",
         expected="WSL / POSIX 與 Windows PowerShell 各自顯示完整可複製命令；compile exit code 0。",
         recovery="syntax 失敗時用 backup 還原，再次 py_compile；不進 run。", context="lora-energy-lab/student_policy.py；A marked block",
         command="cp student_policy.py student_policy.before-A-edit.py；nano student_policy.py；.venv/bin/python -m py_compile student_policy.py；Copy-Item student_policy.py -Destination student_policy.before-A-edit.py；notepad .\\student_policy.py；.\\.venv\\Scripts\\python.exe -m py_compile student_policy.py",
         visual="editor → backup → py_compile", notes=_notes("P041b", "先保存 before，再做唯一 edit 與 syntax guard；compile 不代表 API 或 result 已驗證", "用 student_policy.before-A-edit.py 還原")),
    spec(41, "A-01c：consumer、唯一修改與判讀", "edit-a-consumer", suffix="c", evidence="CONSUMER BOUNDARY｜POLICY SURFACE",
         purpose="把 marked constant 接回 marker 外 choose_action consumer，再讀 state、packet、service 與 J。",
         mechanism="if observation.steps_since_send < PACE_GAP_STEPS: return REST_DURING_GAP；唯一改動只改 REST_DURING_GAP 的 value。",
         expected="run 驗 marker、policy API、predecessor、result；py_compile 單獨不宣稱 transition 或 service。",
         recovery="consumer／API 不符時停在 syntax guard，還原 A before backup。", context="student_policy.py choose_action branch；A marked block",
         visual="consumer → unique edit → result interpretation", notes=_notes("P041c", "指出 branch 如何消費 WAIT／SLEEP，再預測 awake-idle、wake、packet、service 與 endpoint J", "只還原 A marked block")),
    spec(42, "A-02a：baseline、candidate 與 hidden commands", "run-a", evidence="COMPACT RUN COMMANDS｜SIMULATED",
         purpose="Lab A 三個 case 共用 stdout result_path 讀法。",
         mechanism="baseline → A exact edit + candidate --freeze → hidden frozen policy；每一條 path 與同 run replay 配對。",
         expected="每次成功 stdout 有 status=OK、artifact_source=student-run、新 result_path；candidate 另有 lab-a-frozen checkpoint。",
         recovery="任一步失敗保留 stdout／stderr；還原 A edit 後重跑該段，freeze 缺失不得進 hidden。",
         context="package root；A policy；每次 runner stdout",
         command="WSL：bash course.sh run --lab A --case baseline\nbash course.sh run --lab A --case candidate --freeze\nbash course.sh run --lab A --case hidden\nPowerShell：.\\course.cmd run --lab A --case baseline\n.\\course.cmd run --lab A --case candidate --freeze\n.\\course.cmd run --lab A --case hidden",
         visual="three-stage command / receipt ribbon",
         notes=_notes("P042", "三條 exact command 依序建立 baseline、candidate、hidden receipt；run identity 取自 stdout path", A_RECOVERY)),
    spec(42, "A-02b：stdout fields、result 與 replay pair", "receipt-a", suffix="a", evidence="RUN RECEIPT｜ARTIFACT PAIR",
         purpose="分開讀 stdout contract、result.json、endpoint-replay.json 與 candidate freeze checkpoint。",
         mechanism="stdout result_path 是 artifact join key；同 run replay 以相同 artifacts/<run_id>/ 目錄配對。",
         expected="status、run_id、result_path、artifact_source、claim_boundary 可讀；不顯示任何識別摘要值。",
         recovery="path 缺失時保留 stdout／stderr，重跑同一 case；freeze 缺失不得進 hidden。", context="P042 three run receipts；candidate --freeze",
         command="依 stdout result_path 開 artifacts/<run_id>/result.json；再開同目錄 endpoint-replay.json；candidate freeze：artifacts/checkpoints/lab-a-frozen.{json,py}",
         visual="stdout → result.json → endpoint-replay.json → freeze", notes=_notes("P042b", "每條 receipt 都先讀 path，再配對同 run replay；fallback reference 不能冒充 fresh local run", A_RECOVERY)),
    spec(43, "A-03：Identity boundary 與 before／after 比較", "compare-a", evidence="RESULT PATH｜SIMULATED",
         purpose="開啟 P042 的 baseline／candidate paths，核對 identity 後填 before／after 句。",
         mechanism="scenario identity、policy identity、summary、claim boundary 與同 run endpoint-replay 必須可配對。",
         expected=f"baseline {FALLBACK['baseline-A']['energy']} J／{FALLBACK['baseline-A']['delivered']} bit；candidate {FALLBACK['candidate-A']['energy']} J／{FALLBACK['candidate-A']['delivered']} bit；兩者 service 都 {FALLBACK['candidate-A']['service']}。",
         recovery=PAIR_RECOVERY, context="使用 P042 stdout result_path，不使用預填檔名", visual="baseline ↔ identity gate ↔ candidate",
         notes=_notes("P043", "若 identity 不同，停止比較並重新從各自 stdout 取 pair", PAIR_RECOVERY)),
    spec(44, "A-04：state ledger 與 endpoint J 的來源", "ledger-a", evidence="STATE LEDGER｜SIMULATED",
         purpose="從 candidate events 與 energy_breakdown_j 找 WAIT 的 awake-idle／wake 成本。",
         mechanism="WAIT 取代 gap 的 SLEEP 後，awake idle 可能增加、wake 可能減少；兩類 bucket 構成 total J 的解釋。",
         expected="參考：awake_idle=6.00 J、sleep=0.04 J、wake=0.02 J、process=0.16 J、tx=2.40 J、rx=0.24 J。",
         recovery=PAIR_RECOVERY, context="candidate P042 result_path；events + energy_breakdown_j", visual="state interval → energy bucket → endpoint J",
         notes=_notes("P044", "state interval 是 WAIT 耗能因果的必要 evidence", PAIR_RECOVERY)),
    spec(45, "A-05：attempted 不等於 delivered", "packet-a", evidence="PACKET / SERVICE｜SIMULATED",
         purpose="把 attempted、retry、delivered、expired 接回 service verdict。",
         mechanism="一次 SEND 是 decision；collision／retry／deadline 共同決定 packet outcome；service_pass 與 deadline_pass 定義 service gate。",
         expected="參考 candidate：attempted=2、retransmissions=1、delivered_bits=4,800、expired=3、service_pass=FAIL、deadline_pass=FAIL。",
         recovery=PAIR_RECOVERY, context="candidate P042 result.json + 同目錄 endpoint-replay.json", visual="packet ledger → service verdict",
         notes=_notes("P045", "delivery、deadline 與 service verdict 決定 energy interpretation；SEND 次數不足以代表交付", PAIR_RECOVERY)),
    spec(46, "A-06：freeze 是 hidden 的入場條件", "freeze-a", evidence="FREEZE GATE｜SIMULATED",
         purpose="讀 P042 candidate freeze 的 lineage；freeze receipt 是唯讀 evidence。",
         mechanism="lab-a-frozen receipt 綁定 policy identity、predecessor、active_block_id、scenario、seed 與 receipt identity。",
         expected="存在 artifacts/checkpoints/lab-a-frozen.{json,py}；identity 與 active_block_id=lab-a-pace-rest 對得上。",
         recovery="hidden 執行條件為完整 checkpoint 與 identity；缺失時還原 baseline，回到 P042 candidate --freeze。",
         context="P042 candidate checkpoint；hidden entry", visual="baseline → candidate + freeze → hidden gate",
         notes=_notes("P046", "freeze 是 lineage gate；receipt 與 checkpoint 定義 hidden 的執行資格", "回到 candidate --freeze")),
    spec(47, "A-07：hidden 只檢驗，不再調參", "withheld-a", evidence="WITHHELD｜SIMULATED LIMIT",
         purpose="讀 P042 第三條 hidden path，保留 frozen policy 並縮小 claim。",
         mechanism="REST_DURING_GAP=WAIT 與 policy identity 不變；新 contact／traffic condition 可改變結果。",
         expected=f"參考 hidden：{FALLBACK['hidden-A']['energy']} J、{FALLBACK['hidden-A']['delivered']} bit、service_pass={FALLBACK['hidden-A']['service']}；這是適用條件限制。",
         recovery="hidden path 缺失時還原 lab-a-frozen.py，回到 P042 hidden 命令；不使用 hardcoded fallback path。",
         context="P042 第三條 stdout result_path；A frozen policy", visual="frozen policy → hidden condition → qualified claim",
         notes=_notes("P047", "hidden 若方向相反，表示適用範圍縮小；frozen policy 維持不變", A_RECOVERY)),
    spec(48, "Lab A 結論：state、service 與 J 的因果句", "debrief-a", evidence="CONDITIONAL CLAIM｜SIMULATED",
         purpose="把 state、packet／service、J 與 primary／hidden 條件串成一句。",
         mechanism="同一 scenario／policy identity 下，WAIT 的 state 機制可能改變 packet outcome；hidden case 定義 claim ceiling。",
         expected="句型：在 ______ trace，WAIT 透過 ______ state 改變 ______ packet／service，J ______；hidden ______，所以結論 ______。",
         recovery=PAIR_RECOVERY, context="P042 三個 stdout result_path + replay pair", visual="condition → mechanism → evidence → claim ceiling",
         notes=_notes("P048", "結論同時包含 J、適用條件與非預期結果", PAIR_RECOVERY)),
    spec(49, "Lab B：quality hold 與 service window", "lab-b-hero", evidence="LAB B QUESTION｜SIMULATED",
         purpose="定義 quality trace、enter、hold、exit 與 service-window transition。",
         mechanism="quality_band + stable_steps → REST／SEND_READY transition → packet／deadline／service → endpoint J。",
         expected="固定 A frozen predecessor，只改 B stable hold，最後用 Trace B 找 too-slow 的適用條件限制。",
         recovery=B_RECOVERY, visual="quality trace → enter / hold / exit → service window",
         notes=_notes("P049", "Lab B 研究 quality trace 進入 send-ready 的條件；service 由 window、packet 與 deadline 判定", B_RECOVERY)),
    spec(50, "ENTER_QUALITY：send-ready 的進入閾值", "enter-b", evidence="THRESHOLD MODEL｜SIMULATED",
         purpose="說明 quality crossing 如何進入 send-ready。",
         mechanism="切換條件：quality_band ≥ ENTER_QUALITY 且 stable_steps ≥ STABLE_STEPS；threshold 是 decision gate，非 energy knob。",
         expected="ENTER_QUALITY=2、EXIT_QUALITY=1、STABLE_STEPS=2；下一步只改第三行。",
         recovery=PAIR_RECOVERY, context="student_policy.py lab-b-enter-exit-hold block", visual="quality 0 → 1 → 2 → 3；enter at 2",
         notes=_notes("P050", "以第一次達到 quality 2 的位置定位 enter；stable hold 與 transition 由同一 trace 連結", PAIR_RECOVERY)),
    spec(51, "EXIT_QUALITY：enter／exit 的雙閾值", "exit-b", evidence="HYSTERESIS MODEL｜SIMULATED",
         purpose="用 enter／exit 分離避免品質邊界 ping-pong。",
         mechanism="ENTER_QUALITY=2；已進入後 quality≥EXIT_QUALITY=1 時保持 send-ready；quality < 1 時退出。",
         expected="兩條 threshold 形成 hysteresis band；transition、retry、service、J 仍須由 result 驗證。",
         recovery=PAIR_RECOVERY, context="same quality trace；send_mode_active branch", visual="enter ≥2 ｜ hold ≥1 ｜ exit <1",
         notes=_notes("P051", "hysteresis 是 enter／exit 條件設計；service 與 energy 仍由 result 驗證", PAIR_RECOVERY)),
    spec(52, "STABLE_STEPS：拒絕短暫尖峰", "stable-b", evidence="HOLD MODEL｜SIMULATED",
         purpose="把短暫 quality spike 與連續穩定分開。",
         mechanism="engine 每個固定 clock step 更新 stable_steps；stable_steps=2 時 send_mode_active 切成 ready；改成 1 會縮短 hold。",
         expected="Prediction：STABLE_STEPS=1 可能提早一個 step 的 MODE_CHANGE；packet／service／J 由 result 觀察。",
         recovery=PAIR_RECOVERY, context="student_policy.py B marked block", visual="spike: hold；stable 1→2: switch",
         notes=_notes("P052", "Prediction 包含 hold 縮短、送出時機與 quality 條件", PAIR_RECOVERY)),
    spec(53, "Lab B Trace A：transition prediction 與執行", "prediction-b", evidence="PREDICTION LOCK｜SIMULATED",
         purpose="在 action 前標出 enter、hold、exit；prediction 與 result 以同一 trace 對照。",
         mechanism="policy 讀取當下／過去 observation；future trace 與 result summary 不在 policy input。",
         expected="填入 enter step、hold 連續步數、exit quality、service／J 方向；再執行 P056。",
         recovery="A policy 的 frozen predecessor 是 observation 的固定前提；缺失時還原 lab-a-frozen.py。",
         context="Trace A；A frozen predecessor；B candidate target=1", visual="Trace A quality curve + four prediction blanks",
         notes=_notes("P053", "Prediction 定位 MODE_CHANGE 時點並說明因果理由", "恢復 A frozen predecessor")),
    spec(54, "B-01a：Baseline decision 與 Trace A evidence", "baseline-b", evidence="FALLBACK ARTIFACT｜SIMULATED",
         purpose="用 P056 第一條 stdout path 建立 Trace A control。",
         mechanism="A block 保持 WAIT；B hold=2；quality≥2 且 stable_steps≥2 時切換 send-ready。",
         expected=f"參考 Trace A baseline：{FALLBACK['trace-a-baseline-B']['energy']} J、{FALLBACK['trace-a-baseline-B']['delivered']} bit、service_pass={FALLBACK['trace-a-baseline-B']['service']}。",
         recovery="P056 baseline pair 缺失時重新使用 baseline command 取新 stdout path，不猜路徑。",
         context="package root；P056 第一條 stdout result_path；A frozen + B hold=2",
         command="WSL / POSIX：bash course.sh run --lab B --case trace-a-baseline\nPowerShell：.\\course.cmd run --lab B --case trace-a-baseline",
         visual="A predecessor → Trace A baseline → control evidence",
         notes=_notes("P054", "Baseline 定義 hold=2 的原始 behavior；hold=1 由 candidate evidence 判定", B_RECOVERY)),
    spec(54, "B-01b：Trace A baseline summary fields", "baseline-b-result", suffix="a", evidence="RESULT SUMMARY｜SIMULATED",
         purpose="將 Trace A baseline stdout path 對應到 summary 與 MODE_CHANGE control evidence。",
         mechanism="result.json 提供 service、deadline、freshness、delivery、endpoint energy 與 counters；engine event 由同 run replay 核對。",
         expected="summary fields、active_s=8 與 REST→SEND_READY t=130 s 在同一 identity boundary 內。",
         recovery=PAIR_RECOVERY, context="P056 stdout result_path；Trace A baseline result/replay pair", visual="summary → MODE_CHANGE control",
         notes=_notes("P054b", "先讀 Trace A baseline 的 summary，再以 candidate 的 hold=1 做單一比較", PAIR_RECOVERY)),
    spec(55, "B-02a：path 與 BEFORE 完整 marked block", "edit-b", evidence="EXACT EDIT｜POLICY SURFACE",
         purpose="只改 B marked block 的 stable hold，測試較快進入 send-ready。",
         mechanism="ENTER_QUALITY=2、EXIT_QUALITY=1 與 A WAIT 保持原樣；STABLE_STEPS=1 改變 MODE_CHANGE 時機。",
         expected="backup + py_compile 回傳碼 0；active block 顯示 STABLE_STEPS = 1。",
         recovery="B guard 失敗時從 student_policy.before-B-edit.py 還原；A frozen block 與 runner 維持原樣。",
         context="package root；student_policy.py；lab-b-enter-exit-hold marked block",
         command="WSL / POSIX：cp student_policy.py student_policy.before-B-edit.py\n.venv/bin/python -m py_compile student_policy.py\nPowerShell：Copy-Item student_policy.py -Destination student_policy.before-B-edit.py\n.\\.venv\\Scripts\\python.exe -m py_compile student_policy.py",
         visual="ENTER_QUALITY = 2\nEXIT_QUALITY = 1\nSTABLE_STEPS = 2  →  1",
         notes=_notes("P055", "第三行是唯一 edit；prediction 涵蓋送出時機、quality、retry 與 deadline", "還原 B marked block")),
    spec(55, "B-02d：AFTER 完整 marked block", "edit-b-after", suffix="d", evidence="EXACT EDIT｜AFTER BLOCK",
         purpose="在獨立頁保留完整 candidate marked block，讓 stable hold 的唯一修改可直接核對。",
         mechanism="ENTER_QUALITY = 2、EXIT_QUALITY = 1 不變；STABLE_STEPS 由 2 改為 1；marker 邊界維持原樣。",
         expected="AFTER block 的唯一差異是 STABLE_STEPS = 1；其他 block 不動。",
         recovery="差異超過一行時回 student_policy.before-B-edit.py，再次核對 marker。", context="package root；lora-energy-lab/student_policy.py；lab-b-enter-exit-hold",
         visual="BEFORE → AFTER；only STABLE_STEPS changes", notes=_notes("P055d", "這頁只核對 AFTER bytes；下一頁讀 choose_action consumer 與 engine event", "回 B before backup")),
    spec(55, "B-02b：WSL 與 PowerShell edit commands", "edit-b-commands", suffix="b", evidence="EDIT COMMANDS｜SYNTAX GUARD",
         purpose="依 package-relative path 完成 B editor、backup 與 py_compile 順序。",
         mechanism="editor 只改 student_policy.py；backup 保留 before bytes；py_compile 只驗 Python syntax。",
         expected="WSL / POSIX 與 Windows PowerShell 各自顯示完整可複製命令；compile exit code 0。",
         recovery="syntax 失敗時用 backup 還原，再次 py_compile；不進 Trace A run。", context="lora-energy-lab/student_policy.py；B marked block",
         command="cp student_policy.py student_policy.before-B-edit.py；nano student_policy.py；.venv/bin/python -m py_compile student_policy.py；Copy-Item student_policy.py -Destination student_policy.before-B-edit.py；notepad .\\student_policy.py；.\\.venv\\Scripts\\python.exe -m py_compile student_policy.py",
         visual="editor → backup → py_compile", notes=_notes("P055b", "先保存 before，再只改 STABLE_STEPS；compile 不代表 API、MODE_CHANGE 或 service 已驗證", "用 student_policy.before-B-edit.py 還原")),
    spec(55, "B-02c：consumer、function location 與唯一修改", "edit-b-consumer", suffix="c", evidence="CONSUMER BOUNDARY｜ENGINE EVENT",
         purpose="精確指出 student_policy.py branch 消費 quality／stable_steps 的函式與條件位置。",
         mechanism="choose_action(observation) 的 quality_ready 位於 student_policy.py:116–118：observation.quality_band >= ENTER_QUALITY and observation.stable_steps >= STABLE_STEPS；engine.py 依 global 建立 MODE_CHANGE。",
         expected="唯一改動 STABLE_STEPS=2→1；run 才驗 marker、API、A predecessor、MODE_CHANGE、packet、service 與 result。",
         recovery="consumer／API 不符時停在 syntax guard，還原 B before backup；不把 MODE_CHANGE 寫成 policy 直接產生。", context="student_policy.py choose_action；lora_energy_lab/engine.py transition path",
         visual="quality_ready condition → engine MODE_CHANGE → result", notes=_notes("P055c", "朗讀 function name 與實際 condition lines，再判讀較早 transition 對 service 與 J 的含意", "只還原 B marked block")),
    spec(56, "B-03a：Trace A baseline、candidate 與 Trace B commands", "run-b", evidence="COMPACT RUN COMMANDS｜SIMULATED",
         purpose="Lab B 三個 case 共用 stdout result_path 讀法。",
         mechanism="A frozen + B=2 baseline → B=1 candidate --freeze → B frozen Trace B；每次 path 配同 run replay。",
         expected="三次 stdout 有 status=OK、artifact_source=student-run、新 result_path；candidate 另有 lab-b-frozen checkpoint。",
         recovery="任一步失敗保留 stdout／stderr；還原 B edit 後重跑該段，freeze 缺失不得進 Trace B。",
         context="package root；A predecessor + B policy；每次 runner stdout",
         command="WSL：bash course.sh run --lab B --case trace-a-baseline\nbash course.sh run --lab B --case trace-a-candidate --freeze\nbash course.sh run --lab B --case trace-b\nPowerShell：.\\course.cmd run --lab B --case trace-a-baseline\n.\\course.cmd run --lab B --case trace-a-candidate --freeze\n.\\course.cmd run --lab B --case trace-b",
         visual="three-stage command / receipt ribbon",
         notes=_notes("P056", "三條 exact command 依序建立 Trace A baseline、candidate、Trace B receipt；Trace B 不再 retune", B_RECOVERY)),
    spec(56, "B-03b：stdout fields、result 與 replay pair", "receipt-b", suffix="a", evidence="RUN RECEIPT｜ARTIFACT PAIR",
         purpose="分開讀 stdout contract、result.json、endpoint-replay.json 與 candidate freeze checkpoint。",
         mechanism="stdout result_path 是 artifact join key；同 run replay 以相同 artifacts/<run_id>/ 目錄配對。",
         expected="status、run_id、result_path、artifact_source、claim_boundary 可讀；不顯示任何識別摘要值。",
         recovery="path 缺失時保留 stdout／stderr，重跑同一 case；freeze 缺失不得進 Trace B。", context="P056 three run receipts；candidate --freeze",
         command="依 stdout result_path 開 artifacts/<run_id>/result.json；再開同目錄 endpoint-replay.json；candidate freeze：artifacts/checkpoints/lab-b-frozen.{json,py}",
         visual="stdout → result.json → endpoint-replay.json → freeze", notes=_notes("P056b", "每條 receipt 都先讀 path，再配對同 run replay；Trace B 不是再次調參", B_RECOVERY)),
    spec(57, "B-04a：品質與 service 分開判定的 causal overview", "transition-b", evidence="TRANSITION OVERVIEW｜SIMULATED",
         purpose="沿 P056 paths 對齊 MODE_CHANGE、packet、deadline、service 與 J。",
         mechanism="STABLE_STEPS=1 改變 enter timing；PACKET_ATTEMPT、retry、delivered、expired 由 result 觀察。",
         expected=f"參考 Trace A candidate：attempted=4、delivered_bits={FALLBACK['trace-a-candidate-B']['delivered']}、expired=1、{FALLBACK['trace-a-candidate-B']['energy']} J、service_pass=FAIL。",
         recovery=PAIR_RECOVERY, context="Trace A candidate P056 result_path + endpoint replay", visual="quality → MODE_CHANGE → packet → service/J",
         notes=_notes("P057", "quality band 是 context；MODE_CHANGE transition 把 action 接到 packet outcome", PAIR_RECOVERY)),
    spec(57, "B-04b：Trace A MODE_CHANGE 與 service evidence", "transition-b-evidence", suffix="a", evidence="TRANSITION / SERVICE｜SIMULATED",
         purpose="在獨立 evidence 頁讀完整 transition、packet、service 與 endpoint energy fields。",
         mechanism="STABLE_STEPS=1 改變 quality_ready timing；engine.py 建立 MODE_CHANGE，result 才提供 packet／service／J。",
         expected="MODE_CHANGE t=20、80、110 s；candidate delivered_bits=9,600、service_pass=FAIL、endpoint_energy_j=10.66 J。",
         recovery=PAIR_RECOVERY, context="Trace A candidate P056 result_path + endpoint replay", visual="MODE_CHANGE → packet → service/J",
         notes=_notes("P057b", "先核對 transition 時點，再讀 delivery、deadline、freshness 與 energy；較快不等於成功", PAIR_RECOVERY)),
    spec(58, "B-05：freeze evidence 決定 Trace B 閱讀資格", "freeze-b", evidence="FREEZE GATE｜SIMULATED",
         purpose="讀 P056 candidate freeze 的 lineage；freeze receipt 是唯讀 evidence。",
         mechanism="lab-b-frozen 綁定 A predecessor、B policy identity、active_block_id、Trace A、scenario 與 receipt identity。",
         expected="存在 artifacts/checkpoints/lab-b-frozen.{json,py}；active_block_id=lab-b-enter-exit-hold，identity 與 predecessor 對得上。",
         recovery="Trace B 執行條件為 candidate checkpoint 與 identity；缺失時還原 lab-a-frozen.py，回到 P056 candidate --freeze。",
         context="P056 candidate checkpoint；Trace B entry", visual="A frozen → B frozen → Trace B gate",
         notes=_notes("P058", "Trace B 是 frozen policy 的 withheld verification；調參停止於 candidate freeze", B_RECOVERY)),
    spec(59, "B-06a：Trace B：frozen policy 的 withheld setup", "withheld-b", evidence="WITHHELD SETUP｜SIMULATED LIMIT",
         purpose="讀 P056 第三條 Trace B path，判斷 hold=1 的泛化邊界。",
         mechanism="STABLE_STEPS=1 與 REST_DURING_GAP=WAIT 不變；新窗口／traffic 可暴露不同 outcome。",
         expected=f"參考 Trace B：{FALLBACK['trace-b-B']['energy']} J、{FALLBACK['trace-b-B']['delivered']} bit、expired={FALLBACK['trace-b-B']['expired']}、service_pass={FALLBACK['trace-b-B']['service']}。",
         recovery="Trace B path 來源固定為 stdout result_path；缺失時還原 lab-b-frozen.py，回到 P056 第三條命令。",
         context="P056 第三條 stdout result_path；B frozen policy", visual="B frozen policy → Trace B → claim ceiling",
         notes=_notes("P059", "非預期結果界定適用範圍；Trace A 的改善不外推至所有窗口", B_RECOVERY)),
    spec(59, "B-06b：Trace B summary 與 claim ceiling", "withheld-b-result", suffix="a", evidence="WITHHELD RESULT｜SIMULATED LIMIT",
         purpose="在獨立 result 頁讀 Trace B fallback summary，保留 service false 與邊界。",
         mechanism="frozen policy 不變；新 window／traffic 只作 withheld condition，summary 與 replay 決定 claim ceiling。",
         expected="energy=5.43 J、delivered_bits=4,800、efficiency=883.977901 bit/J、wake=1、attempt=2、retry=1、expired=2、service_pass=FAIL。",
         recovery=PAIR_RECOVERY, context="P056 Trace B stdout result_path + endpoint-replay.json", visual="summary fields → applicability limit → claim ceiling",
         notes=_notes("P059b", "Trace B 只驗 frozen policy 的泛化邊界；更快 transition 仍不宣稱 service success", PAIR_RECOVERY)),
    spec(60, "B-07：too-slow 與 ping-pong 是兩種不同問題", "counter-b", evidence="FAILURE MODE｜SIMULATED",
         purpose="用 MODE_CHANGE、packet outcome 與 endpoint ledger 區分兩種失敗。",
         mechanism="too-slow：hold 太久錯過窗口；ping-pong：enter／exit 太近，多次 transition、retry 與額外 J。",
         expected="每個 failure mode 以事件與 summary 判定；平滑 quality 線維持為 context evidence。",
         recovery="兩個 result policy identity 不同時回到 B freeze，使用同一個 checkpoint。",
         context="Trace A／Trace B；同一 B policy identity", visual="too-slow ↔ ping-pong comparison",
         notes=_notes("P060", "evidence 區分 hold、threshold 與 traffic／window 差異", B_RECOVERY)),
    spec(61, "Lab B 結論：hysteresis 的條件與邊界", "debrief-b", evidence="CONDITIONAL CLAIM｜SIMULATED",
         purpose="把 Trace A 支持的機制與 Trace B 暴露的邊界一起保留。",
         mechanism="hold=1 可能增加 delivery 但 service 仍失敗；效果受 window、traffic、deadline 與 endpoint scope 約束。",
         expected="條件式句型：Trace A ______；Trace B ______；因此 hysteresis 有效的條件是 ______。",
         recovery=PAIR_RECOVERY, context="P056 Trace A／Trace B result_path + replay pairs", visual="Trace A support + Trace B boundary → claim ceiling",
         notes=_notes("P061", "條件差異比一次改善更重要，保留支持、非預期結果與待查部分", PAIR_RECOVERY)),
    spec(62, "P062a：中斷復原 overview", "recovery", evidence="RECOVERY CONTRACT｜SOURCE-BOUND",
         purpose="從最後一個 identity 正確的 checkpoint 回到可重跑階段。",
         mechanism="course.* status 先讀目前 receipt；course.* restore --checkpoint 復原 policy lineage；重跑產生新的 stdout result_path 與配對 replay。",
         expected="status=READY 或明確失敗 receipt；restore 指定 lab-a-frozen、lab-b-frozen 或 release-default；新結果使用新的 stdout path。",
         recovery="result／replay 遺失時不手改 JSON；回 checkpoint 重跑；主機受阻則保留 same-scenario fallback 標籤。",
         context="package root；A/B checkpoints、receipts、result/replay pairs",
         command="WSL / POSIX：bash course.sh status\nbash course.sh restore --checkpoint lab-a-frozen\nbash course.sh restore --checkpoint lab-b-frozen\nbash course.sh restore --checkpoint release-default\nPowerShell：.\\course.cmd status\n.\\course.cmd restore --checkpoint lab-a-frozen\n.\\course.cmd restore --checkpoint lab-b-frozen\n.\\course.cmd restore --checkpoint release-default",
         visual="A frozen ↔ B frozen ↔ release baseline；restore → compile → rerun",
         notes=_notes("P062", "復原 policy 不會復原遺失的 result；每次重跑都保存新的 stdout path", A_RECOVERY)),
    spec(62, "P062b：Windows PowerShell 與 WSL exact recovery commands", "recovery-commands", suffix="b", evidence="RECOVERY COMMANDS｜SOURCE-BOUND",
         purpose="分開展示 status 與三個支援 checkpoint 的 restore 命令。",
         mechanism="course.* status 讀 receipt；course.* restore --checkpoint 恢復 policy lineage；exact rerun 才產生新 result。",
         expected="WSL / POSIX 與 PowerShell 命令均可獨立複製；只使用 lab-a-frozen、lab-b-frozen、release-default。",
         recovery="命令失敗時保留 stdout／stderr，不手改 JSON；回到 identity 正確 checkpoint。", context="package root；P062 recovery contract",
         command="bash course.sh status；bash course.sh restore --checkpoint lab-a-frozen；bash course.sh restore --checkpoint lab-b-frozen；bash course.sh restore --checkpoint release-default；.\\course.cmd status；.\\course.cmd restore --checkpoint lab-a-frozen；.\\course.cmd restore --checkpoint lab-b-frozen；.\\course.cmd restore --checkpoint release-default",
         visual="status → supported restore → compile → exact rerun", notes=_notes("P062b", "WSL 與 PowerShell 分開朗讀；restore 不會捏造遺失的 result", A_RECOVERY)),
    spec(63, "result.json 匯入：LoRa 實驗結果工作台", "bridge", evidence="CURRENT UI BOUNDARY｜SIMULATED",
         purpose="以完整入口進入目前 `/course` UI；辨認 `證據` 與 `進度備份` tabs 的責任邊界。",
         mechanism="runner stdout result_path → browser 只選 result.json → `證據` tab 驗證 schema／identity／units／provenance；目前 accepted replay 為 none。",
         expected="頁面顯示 LoRa 實驗結果工作台；目前狀態是 empty evidence view，不宣稱成功匯入、live measurement 或 canonical parity。",
         recovery="匯入失敗保留錯誤與 stdout path；回 P062 checkpoint 重跑 exact case，再用新 path 重新開啟 `/course`。",
         context="http://120.126.151.102:3000/course；`證據` tab；`進度備份` tab；current-browser-evidence/course-20260811-1412-live/README.md",
         visual="runner → result.json → 證據 tab → 進度備份 controls",
         notes=_notes("P063", "目前 browser evidence 只證明 UI 與 empty state；endpoint-replay.json 尚未被 browser accepted，不能把畫面說成成功 upload", PAIR_RECOVERY)),
]


# These pages are the operational spine of the module.  Their notes name the
# visible object, say what it means, operate the exact path/command, state the
# expected receipt or event fields, interpret the causal comparison, and give
# a page-specific recovery/transition.  They are deliberately written as
# stand-alone delivery scripts rather than a repeated checklist.
DELIVERY_SCRIPTS = {
    "P040": (
        "Point：左卡的 contact_open=false、steps_since_send 與 REST_DURING_GAP，右卡的 stdout receipt。"
        "Say：當前頁先固定 A baseline；窗口關閉時回到 SLEEP，間隔步數不足時由 policy 常數決定 gap action。"
        "Operate：在 package root 執行 bash course.sh run --lab A --case baseline，Windows PowerShell 對應 .\\course.cmd run --lab A --case baseline。"
        "Expect：stdout 讀 status、run_id、result_path、artifact_source、claim_boundary；成功時再沿 result_path 開 result.json 與同目錄 endpoint-replay.json。"
        "Interpret：baseline 是原始 policy 的 control，不先把任何 fallback 數值當 fresh run；下一頁把同一 receipt 的 summary 欄位集中讀完。"
        "Recover：命令失敗就保留 stdout／stderr，重新取得同一 case 的 path，不猜檔名。"
        "Transition：帶著 baseline result_path 進 P040a。"
    ),
    "P040a": (
        "Point：summary 卡的 fallback label 與十個欄位。"
        "Say：這組 6.92 J、4,800 bit、693.641618 bit/J、wake 2、attempt 2、retry 1、expired 3，以及 service_pass=FAIL、deadline_pass=FAIL、freshness_status=expired，是 same-scenario-fallback reference，不是 fresh run。"
        "Operate：依上一頁 stdout 的 result_path 開 artifacts/<run_id>/result.json，再開同一目錄 endpoint-replay.json；若只有 reference，就保留 reference 標籤。"
        "Expect：欄位名稱與單位逐一對上 summary.service_pass、summary.deadline_pass、summary.freshness_status、summary.delivered_bits、summary.endpoint_energy_j、summary.efficiency、wake、attempt、retry、expired。"
        "Interpret：baseline 只建立 control；service 與 deadline 都 false，不能用效率數值掩蓋未交付的 service verdict。"
        "Recover：result／replay 不是同一 run 時停止比較，回到 stdout path 重新配對。"
        "Transition：把完整 summary 帶到 A 的唯一 edit。"
    ),
    "P041": (
        "Point：頁首的 package-relative path，以及紫色 BEFORE 卡的兩個 marker 行和 PACE_GAP_STEPS = 2。"
        "Say：檔案是 lora-energy-lab/student_policy.py；完整 marked block 從 # === LORA EDITABLE: lab-a-pace-rest === 到 # === LORA END EDITABLE: lab-a-pace-rest ===，baseline 的 REST_DURING_GAP 仍是 SLEEP。"
        "Operate：在 package root 以 WSL／POSIX 範例先執行 cp student_policy.py student_policy.before-A-edit.py，再以 nano student_policy.py 開檔並修改，最後執行 .venv/bin/python -m py_compile student_policy.py。"
        "Expect：backup 產生 before bytes，py_compile 回傳 0；它只代表 syntax 可解析，尚未驗 marker、policy API、predecessor 或 result。"
        "Interpret：這頁的 BEFORE 是唯一 edit 的來源基線，不能把 editor 開啟或 compile 當成 candidate run。"
        "Recover：syntax 不通就用 student_policy.before-A-edit.py 還原，再只重跑 py_compile。"
        "Transition：下一頁讀完整 AFTER block。"
    ),
    "P041b": (
        "Point：左側 WSL／POSIX 與右側 Windows PowerShell 命令卡。"
        "Say：兩邊都在同一個 package-relative student_policy.py 上操作；nano 與 notepad 是 editor 範例，backup 先於 compile。"
        "Operate：WSL 逐行執行 cp student_policy.py student_policy.before-A-edit.py；nano student_policy.py；.venv/bin/python -m py_compile student_policy.py。PowerShell 逐行執行 Copy-Item student_policy.py -Destination student_policy.before-A-edit.py；notepad .\\student_policy.py；.\\.venv\\Scripts\\python.exe -m py_compile student_policy.py。"
        "Expect：兩個環境都得到 syntax guard 結果；compile 不驗 marker、API、前置 policy 或 JSON。"
        "Interpret：只要 backup 或 compile 失敗，就沒有 candidate run 的資格；成功只表示可進下一個 exact edit gate。"
        "Recover：保留 stderr，從 before-A-edit backup 還原後重試，不跳到 run。"
        "Transition：下一頁讀 marker 外 consumer。"
    ),
    "P041c": (
        "Point：marker 外的 function choose_action(observation) branch。"
        "Say：精確消費者是 if observation.steps_since_send < PACE_GAP_STEPS: return REST_DURING_GAP；它讀 marked block 的常數，engine 才負責後續 state 與 transition。"
        "Operate：先在 code editor 核對這個 branch，再執行 A candidate 的 exact command；compile 不能替代這個 API 與 predecessor 檢查。"
        "Expect：run receipt 會提供 result_path；result.json 與 endpoint-replay.json 才能給 state、packet、service、endpoint_energy_j 的實際欄位。"
        "Interpret：唯一因果差異是 REST_DURING_GAP = SLEEP 改成 WAIT；預期 awake-idle 可能增加、wake 或 state timing 可能改變，但 service 仍由 gate 判定。"
        "Recover：consumer 行或 API 不符時停在這裡，還原 student_policy.before-A-edit.py，不宣稱 candidate 成功。"
        "Transition：帶著唯一 edit 進 P042 的三條 run。"
    ),
    "P041d": (
        "Point：青色 AFTER 卡的完整五行邊界。"
        "Say：AFTER 仍從同一個 lab-a-pace-rest marker 開始，PACE_GAP_STEPS = 2 不動；唯一可見差異是 REST_DURING_GAP = WAIT，END marker 和其他 block 都保留。"
        "Operate：以 diff 或逐行目視核對 before-A-edit backup 與目前 student_policy.py，接著執行 .venv/bin/python -m py_compile student_policy.py；Windows 對應 .\\.venv\\Scripts\\python.exe -m py_compile student_policy.py。"
        "Expect：只看到一行 value change，compile 回傳 0；沒有額外的 A-baseline 檔名或不存在的 checkpoint 檔。"
        "Interpret：這是 policy surface 的 candidate 定義，尚未是 run result；因果判讀要等 P042 的 result／replay pair。"
        "Recover：多出任何修改就回 backup，重新只保留 REST_DURING_GAP = SLEEP → WAIT。"
        "Transition：下一頁讀 Windows／WSL edit commands。"
    ),
    "P042": (
        "Point：六條完整、可獨立複製的 command row，順序是 baseline、candidate、hidden。"
        "Say：WSL 先跑 bash course.sh run --lab A --case baseline，再跑 bash course.sh run --lab A --case candidate --freeze，最後跑 bash course.sh run --lab A --case hidden；PowerShell 對應三條 .\\course.cmd 命令。"
        "Operate：每條 command 單獨執行並保存 stdout；candidate 的 --freeze 必須先成功，hidden 才有入場資格。"
        "Expect：每次 stdout 讀 status、run_id、result_path、artifact_source、claim_boundary，不顯示任何識別摘要值；candidate 另應留下 artifacts/checkpoints/lab-a-frozen.{json,py}。"
        "Interpret：baseline 與 candidate 只相差 A marked edit，hidden 保持 frozen policy；每次 run 的實際 JSON 取自自己的 result_path，不用 reference 假裝 local run。"
        "Recover：任一 command 失敗就保留 stdout／stderr，先修復或還原 policy；freeze 缺失時停止 hidden。"
        "Transition：下一頁依 receipt 取 result 與 replay。"
    ),
    "P042a": (
        "Point：stdout fields 卡、artifact pair 卡與 candidate freeze checkpoint。"
        "Say：status、run_id、result_path、artifact_source、claim_boundary 是 receipt contract；result_path 是唯一的 artifact join key。"
        "Operate：照 stdout 的 result_path 開 artifacts/<run_id>/result.json，再開同一目錄 endpoint-replay.json；candidate freeze 只讀 artifacts/checkpoints/lab-a-frozen.json 與 lab-a-frozen.py。"
        "Expect：result 與 replay 共享同一 run 目錄；不在投影片或命令中輸出任何 hash／摘要值。"
        "Interpret：只在 result／replay pair 成立時解讀 summary、state、packet；fallback reference 必須標為 reference，不能改寫成 fresh run。"
        "Recover：path 遺失或 pair 不一致時保留原 stdout，重跑同一 case；不要手改 JSON，也不要用猜測路徑。"
        "Transition：把 pairs 帶到 identity gate。"
    ),
    "P043": (
        "Point：baseline 與 candidate 兩張比較卡，以及中間的 identity gate。"
        "Say：先確認 scenario_id、policy identity、scope、units 與 run_id，再談能量差異；baseline reference 是 6.92 J／4,800 bit，candidate reference 是 8.86 J／4,800 bit，兩次 service_pass 都 FAIL。"
        "Operate：各自從 P042 stdout result_path 開 result.json 與同 run endpoint-replay.json，將兩組欄位寫在 before／after 位置。"
        "Expect：兩組 pair 的 scenario 與 scope 一致；summary 仍含 freshness_status=expired、deadline_pass=FAIL 與完整 counters。"
        "Interpret：同一 identity 下，candidate endpoint J 增加而 delivered bits 沒變，這支持 WAIT 造成 energy trade-off 的機制，但不支持 service success。"
        "Recover：identity、units 或 predecessor 不一致就停止比較，分別回到各自 stdout path。"
        "Transition：下一頁拆解 candidate energy buckets。"
    ),
    "P044": (
        "Point：candidate 的 state ledger 與 energy_breakdown_j bucket。"
        "Say：awake_idle=6.00 J、sleep=0.04 J、wake=0.02 J、process=0.16 J、tx=2.40 J、rx=0.24 J；每個 J 都要回到 state interval 與 power。"
        "Operate：從 candidate result_path 開 events 和 energy_breakdown_j，逐 bucket 核對名稱、數值與 endpoint scope。"
        "Expect：六個 bucket 可加總到 endpoint energy；WAIT 的 awake-idle 與 SLEEP 的低功耗段分開出現。"
        "Interpret：這些欄位讓 REST_DURING_GAP 的 state 機制可追溯；不能只看 total J，也不能把 tx／rx 當成 gap action。"
        "Recover：bucket 缺失或 units 不符時保留 result／replay pair，回到 P042 重新取得同 case artifacts。"
        "Transition：接著用 packet ledger 判讀 delivery 與 service。"
    ),
    "P045": (
        "Point：attempted、retransmissions、delivered_bits、expired 與 service verdict。"
        "Say：candidate reference 是 attempted=2、retry=1、delivered_bits=4,800、expired=3、service_pass=FAIL、deadline_pass=FAIL；一次 SEND decision 不等於交付。"
        "Operate：在 result.json 讀 counters，在同 run endpoint-replay.json 找 PACKET_ATTEMPT、retry 與 deadline event。"
        "Expect：packet outcome、freshness_status=expired 與 endpoint_energy_j=8.86 J 能互相對上；service gate 由 delivery、deadline、freshness 一起判定。"
        "Interpret：WAIT 造成的 state energy 變化不能被誤讀成 delivery improvement；先分開 packet 與 service，再談效率。"
        "Recover：counter 或 replay event 對不上時停止因果句，回到該次 stdout result_path。"
        "Transition：下一頁檢查 candidate freeze lineage。"
    ),
    "P046": (
        "Point：freeze gate 的 policy identity、predecessor、active_block_id 與 checkpoint path。"
        "Say：hidden 的資格不是一個數字，而是 candidate --freeze 產生的 lab-a-frozen receipt 加上 artifacts/checkpoints/lab-a-frozen.{json,py}。"
        "Operate：開 candidate stdout 指出的 result_path，核對 checkpoint 內 scenario、seed、policy identity、predecessor 與 active_block_id=lab-a-pace-rest。"
        "Expect：receipt 與 checkpoint 的 identity 全部一致，且 result／replay pair 仍在同一 run 目錄。"
        "Interpret：freeze 把唯一 edit 固定成 lineage；沒有它就無法把 hidden 結果歸因到同一 policy。"
        "Recover：checkpoint 或 predecessor 遺失時回 P042 的 candidate --freeze，不執行 hidden，也不建立替代檔名。"
        "Transition：下一頁以 frozen policy 讀 hidden condition。"
    ),
    "P047": (
        "Point：hidden path、frozen policy 與 summary boundary。"
        "Say：hidden reference 是 3.61 J、0 bit、wake 0、attempt 0、retry 0、expired 3、service_pass=FAIL；它是適用條件限制，不是新的調參結果。"
        "Operate：用 P042 的 bash course.sh run --lab A --case hidden，或 PowerShell .\\course.cmd run --lab A --case hidden；再沿 stdout result_path 開 result.json 與同 run replay。"
        "Expect：policy identity 仍指向 lab-a-frozen，summary 欄位保持完整，freshness_status=expired。"
        "Interpret：同一 frozen policy 在不同窗口／traffic 條件下可能呈現不同 outcome；因此只縮小 claim，不把 hidden 數字外推成普遍結論。"
        "Recover：hidden path 缺失就恢復 lab-a-frozen checkpoint，重新跑該命令；不手填結果。"
        "Transition：把 primary 與 hidden 的條件放進 Lab A 結論句。"
    ),
    "P048": (
        "Point：condition → mechanism → evidence → claim ceiling 的結論骨架。"
        "Say：先填 trace 條件，再寫 WAIT 如何改變 state，接著引用 packet／service 與 J，最後寫 hidden 的適用條件限制。"
        "Operate：引用 P042 三組 result_path／replay pair、P044 六個 energy bucket 與 P045 service fields；不要引入未出現在 pair 的數值。"
        "Expect：結論同時包含 endpoint_energy_j、delivered_bits、service_pass、deadline_pass、freshness_status 與條件邊界。"
        "Interpret：可支持的句子是「在固定 identity 與指定 window 下，WAIT 透過 awake-idle state 改變 endpoint J」；service 是否成功仍由 gate 決定。"
        "Recover：缺一個 pair 就把結論停在已知欄位，回到 P042 重新建立 artifacts。"
        "Transition：帶著 state／service 分離的讀法進 Lab B。"
    ),
    "P054": (
        "Point：A WAIT predecessor、B hold=2 與 Trace A baseline command。"
        "Say：B 的 control 依賴 A frozen predecessor；quality ≥ 2 且 stable_steps ≥ 2 時才進 send-ready，engine 會留下 MODE_CHANGE。"
        "Operate：執行 bash course.sh run --lab B --case trace-a-baseline，PowerShell 對應 .\\course.cmd run --lab B --case trace-a-baseline。"
        "Expect：stdout 有 status、run_id、result_path、artifact_source、claim_boundary；reference summary 是 8.86 J、4,800 bit、active_s=8、service_pass=FAIL。"
        "Interpret：baseline 是 B hold=2 的 control，MODE_CHANGE REST → SEND_READY 在 t=130 s；transition 較早不等於 service success。"
        "Recover：baseline pair 缺失時保留 stdout，重跑同一命令取得新的 result_path。"
        "Transition：下一頁讀完整 Trace A baseline summary。"
    ),
    "P054a": (
        "Point：Trace A baseline summary 卡與右側 MODE_CHANGE interpretation。"
        "Say：這個 same-scenario-fallback reference 的 summary.service_pass、deadline_pass 都 FAIL，freshness_status=expired，delivered_bits=4,800，endpoint_energy_j=8.86 J，efficiency=541.760722 bit/J，wake=1、attempt=2、retry=1、expired=3。"
        "Operate：依 P054 stdout result_path 開 result.json，再開同 run endpoint-replay.json，核對 MODE_CHANGE REST → SEND_READY、t=130 s、active_s=8。"
        "Expect：summary 欄位與 event 時點屬於同一 run pair；不顯示任何識別摘要值。"
        "Interpret：Trace A baseline 提供 hold=2 的控制行為；下一個 candidate 只把 STABLE_STEPS 改成 1，其他 identity 維持。"
        "Recover：summary 與 event 不在同一 run 時停止，從 stdout path 重新配對。"
        "Transition：進入 B 的 BEFORE block。"
    ),
    "P055": (
        "Point：B 的 package-relative path 與紫色 BEFORE marked block。"
        "Say：完整 block 是 lab-b-enter-exit-hold；ENTER_QUALITY = 2、EXIT_QUALITY = 1、STABLE_STEPS = 2，三行都要保留。"
        "Operate：WSL 先 cp student_policy.py student_policy.before-B-edit.py，再以 nano student_policy.py 開檔並修改，最後跑 .venv/bin/python -m py_compile student_policy.py。"
        "Expect：backup 留住 hold=2 的 source bytes，compile 回傳 0；compile 只驗 syntax，沒有驗 choose_action、engine、predecessor 或 result。"
        "Interpret：這是 B candidate 的唯一修改前基線；A WAIT predecessor 與 runner scope 不在此頁被改動。"
        "Recover：syntax 失敗用 student_policy.before-B-edit.py 還原，只重跑 compile。"
        "Transition：下一頁核對完整 AFTER block。"
    ),
    "P055b": (
        "Point：B 的 WSL／POSIX 與 Windows PowerShell 命令卡。"
        "Say：editor 只是開啟相對路徑；backup 先保存 before，最後才做 py_compile。"
        "Operate：WSL 執行 cp student_policy.py student_policy.before-B-edit.py；nano student_policy.py；.venv/bin/python -m py_compile student_policy.py。PowerShell 執行 Copy-Item student_policy.py -Destination student_policy.before-B-edit.py；notepad .\\student_policy.py；.\\.venv\\Scripts\\python.exe -m py_compile student_policy.py。"
        "Expect：兩邊 compile 都只回報 syntax；任何 marker、API、MODE_CHANGE、service 都要等 run。"
        "Interpret：這個 gate 的目的，是在進入 Trace A 前保留可恢復的 policy bytes。"
        "Recover：命令失敗保留 stderr，從 before-B-edit backup 還原，不執行 Trace A。"
        "Transition：回 P055d 讀 candidate AFTER。"
    ),
    "P055c": (
        "Point：marker 外 consumer、choose_action(observation) 與 student_policy.py:116–118。"
        "Say：quality_ready 的實際條件是 observation.quality_band >= ENTER_QUALITY 且 observation.stable_steps >= STABLE_STEPS；function choose_action(observation) 只消費這些 global，run_simulation 位於 lora_energy_lab/engine.py:238–249，engine 依 global 建立 MODE_CHANGE。"
        "Operate：在 source 檔以 nl -ba student_policy.py 核對 116–118，再執行 candidate --freeze；Windows 使用 .\\course.cmd run --lab B --case trace-a-candidate --freeze，WSL 使用 bash course.sh run --lab B --case trace-a-candidate --freeze。"
        "Expect：candidate stdout 提供 result_path 與 lab-b-frozen checkpoint；replay 會記錄 MODE_CHANGE、PACKET_ATTEMPT、retry、delivered_bits、expired。"
        "Interpret：唯一 edit 是 STABLE_STEPS=2 → 1；較早 MODE_CHANGE 是 engine event，不可寫成 student_policy.py 直接產生 transition，也不能直接宣稱 service 成功。"
        "Recover：condition line、API 或 predecessor 不符時停止 run，還原 student_policy.before-B-edit.py。"
        "Transition：下一頁核對完整 AFTER block，再讀 Trace A commands。"
    ),
    "P055d": (
        "Point：B 的青色 AFTER block。"
        "Say：ENTER_QUALITY = 2 與 EXIT_QUALITY = 1 仍不動；只有 STABLE_STEPS = 2 改為 1，兩個 marker 行和其他 block 原樣保留。"
        "Operate：以 diff 核對 before-B-edit backup 與目前檔案，接著執行 .venv/bin/python -m py_compile student_policy.py；PowerShell 對應 .\\.venv\\Scripts\\python.exe -m py_compile student_policy.py。"
        "Expect：差異只有第三行，compile 回傳 0；MODE_CHANGE 尚未在這個 code page 生成。"
        "Interpret：AFTER 只定義 policy input surface，transition timing、packet、service 與 endpoint J 必須等 P056 run pair。"
        "Recover：多出任何行差異就回 student_policy.before-B-edit.py，重新保留單一 edit。"
        "Transition：進入 Trace A baseline／candidate／Trace B exact commands。"
    ),
    "P056": (
        "Point：六條 B command row，依序是 Trace A baseline、Trace A candidate、Trace B。"
        "Say：WSL 執行 bash course.sh run --lab B --case trace-a-baseline；bash course.sh run --lab B --case trace-a-candidate --freeze；bash course.sh run --lab B --case trace-b。PowerShell 執行對應的 .\\course.cmd 三條命令。"
        "Operate：每條 command 保存自己的 stdout；candidate --freeze 成功後才進 Trace B，Trace B withheld 不再調參。"
        "Expect：每次 receipt 讀 status、run_id、result_path、artifact_source、claim_boundary；candidate 應有 artifacts/checkpoints/lab-b-frozen.{json,py}。"
        "Interpret：Trace A baseline 用 hold=2，candidate 用 hold=1，Trace B 保持 frozen candidate policy；比較依 identity 與 predecessor，不依畫面印象。"
        "Recover：任一 run 失敗保留 stdout／stderr，還原 B edit 或 predecessor，再只重跑失敗 case。"
        "Transition：下一頁讀 stdout fields 與 artifact pair。"
    ),
    "P056a": (
        "Point：B receipt 的 fields、artifact pair 與 lab-b-frozen checkpoint。"
        "Say：result_path 指到 artifacts/<run_id>/result.json；同目錄 endpoint-replay.json 才是可配對的事件來源。"
        "Operate：依三次 stdout 各自開 result.json 和 endpoint-replay.json；candidate freeze 只開 artifacts/checkpoints/lab-b-frozen.json 與 lab-b-frozen.py。"
        "Expect：status、run_id、result_path、artifact_source、claim_boundary 可追溯，且不顯示任何識別摘要值。"
        "Interpret：若沒有同一 run 的 pair，不能讀 MODE_CHANGE、packet、service 或 energy；Trace B 只讀 frozen policy evidence。"
        "Recover：path 或 pair 缺失就保存 stdout，回到相同 case 重跑，不手改 JSON。"
        "Transition：帶著三組 pair 進 causal transition 頁。"
    ),
    "P057": (
        "Point：quality → MODE_CHANGE → packet → service／J 的 causal overview。"
        "Say：quality band 是 observation context；STABLE_STEPS=1 只改 quality_ready timing，MODE_CHANGE 由 lora_energy_lab/engine.py 建立，packet 與 service 再由 result/replay 判定。"
        "Operate：先取 Trace A candidate result_path，再依同目錄 replay 找 transition 與 PACKET_ATTEMPT；不要用 policy code 推填 event。"
        "Expect：summary fields 與 MODE_CHANGE 時點能和 delivered_bits、expired、endpoint_energy_j 對上。"
        "Interpret：這張 overview 只建立因果鏈，較快 transition 不等於 service success；下一頁列出完整數值。"
        "Recover：event 與 summary 不成 pair 時回 P056a 的 stdout path。"
        "Transition：讀 P057a 的 transition／service evidence。"
    ),
    "P057a": (
        "Point：MODE_CHANGE 三段時點與右側 packet／service fields。"
        "Say：Trace A candidate reference 的 MODE_CHANGE 是 REST → SEND_READY t=20 s、SEND_READY → REST t=80 s、REST → SEND_READY t=110 s；summary 是 10.66 J、9,600 bit、efficiency=900.562852 bit/J、wake=1、attempt=4、retry=1、expired=1、service_pass=FAIL。"
        "Operate：在 endpoint-replay.json 逐事件核對三段 transition，再在 result.json 讀 delivered_bits、deadline_pass、freshness_status、endpoint_energy_j。"
        "Expect：transition、packet、service、J 屬於同一 candidate run；service 仍 false。"
        "Interpret：較早 transition 改變 active timing 與 delivery opportunity，但不保證 deadline／freshness gate；transition speed 不是 service verdict。"
        "Recover：任何時點或欄位對不上就保留原 pair，重讀 result_path，不用另一個 case 補數字。"
        "Transition：下一頁檢查 Trace B 的 freeze lineage。"
    ),
    "P058": (
        "Point：A frozen → B frozen → Trace B gate。"
        "Say：Trace B 的執行資格由 A predecessor、B policy identity、active_block_id=lab-b-enter-exit-hold、scenario 與 candidate receipt 一起決定。"
        "Operate：開 artifacts/checkpoints/lab-b-frozen.{json,py}，把它和 P056 candidate stdout 的 result_path、replay pair 逐欄核對。"
        "Expect：A predecessor 指向 WAIT 版本，B checkpoint 指向 STABLE_STEPS=1，identity 沒有漂移。"
        "Interpret：freeze gate 把 Trace B 限定為同一 candidate policy；這裡停止調參，只做 withheld verification。"
        "Recover：checkpoint、predecessor 或 active block 不一致時回 lab-a-frozen，再重做 P056 candidate --freeze。"
        "Transition：以 frozen policy 讀 Trace B summary。"
    ),
    "P059": (
        "Point：Trace B frozen setup、第三條 stdout path 與 claim ceiling。"
        "Say：Trace B 沿用 STABLE_STEPS=1 與 REST_DURING_GAP=WAIT；新 window／traffic 只用來測試適用條件，不重新修改 policy。"
        "Operate：執行 bash course.sh run --lab B --case trace-b 或 .\\course.cmd run --lab B --case trace-b，依 stdout result_path 開 result.json 與同 run endpoint-replay.json。"
        "Expect：policy identity 仍是 lab-b-frozen；reference summary 是 5.43 J、4,800 bit、efficiency=883.977901 bit/J、wake=1、attempt=2、retry=1、expired=2、service_pass=FAIL。"
        "Interpret：Trace B 讀的是 frozen policy 在新條件下的 outcome；結果不同時只降低 claim 適用範圍，不再調參。"
        "Recover：第三條 path 缺失就回 candidate freeze，恢復 lab-b-frozen 後重跑 Trace B。"
        "Transition：下一頁把 summary 欄位與邊界寫完整。"
    ),
    "P059a": (
        "Point：Trace B summary fields 與 claim ceiling。"
        "Say：same-scenario-fallback reference 的 service_pass=FAIL、deadline_pass=FAIL、freshness_status=expired、delivered_bits=4,800、endpoint_energy_j=5.43 J、efficiency=883.977901 bit/J、wake=1、attempt=2、retry=1、expired=2。"
        "Operate：沿第三條 stdout result_path 開 result.json，再開同 run endpoint-replay.json，確認 frozen policy identity。"
        "Expect：summary、transition、packet 與 replay 都屬於 Trace B pair；這是 reference 時清楚標註，不宣稱 fresh local run。"
        "Interpret：Trace B service 仍 false，較低 J 或較高 bit/J 不能越過 deadline／freshness gate；結論停在條件式 claim。"
        "Recover：欄位缺失或 identity 漂移時回 P056 candidate freeze，不使用另一個 case 的數值。"
        "Transition：下一頁分辨 too-slow 與 ping-pong。"
    ),
    "P060": (
        "Point：too-slow 與 ping-pong 的兩條事件序列。"
        "Say：too-slow 是 hold 太久錯過 service window；ping-pong 是 enter／exit 太近造成多次 MODE_CHANGE、retry 與額外 endpoint J。"
        "Operate：對每個 sequence 讀 transition、PACKET_ATTEMPT、retry、expired、service_pass 與 energy bucket，不用 quality 曲線單獨下判斷。"
        "Expect：兩個 failure mode 都能在 result／replay 找到不同 event signature；平滑 quality 只作 context。"
        "Interpret：同一 policy identity 下仍要分開 timing、packet 與 service；一個 mode 的改善不能外推到另一個 mode。"
        "Recover：policy identity 不同時停止比較，回到 B freeze 建立同一 lineage。"
        "Transition：把支持與限制合併成 Lab B 條件句。"
    ),
    "P061": (
        "Point：Trace A support 與 Trace B boundary 的結論框。"
        "Say：先寫 Trace A 哪個 MODE_CHANGE／packet／J 欄位支持機制，再寫 Trace B 哪個 service／deadline／freshness 欄位限制外推，最後才寫 hysteresis 的條件。"
        "Operate：引用 P057a 與 P059a 的同名 fields 和各自 result_path，不混用兩個 run 的數字。"
        "Expect：句子同時包含 transition、delivered_bits、service_pass、endpoint_energy_j、window／traffic 條件。"
        "Interpret：較快 transition 可是機制 evidence，service false 仍是 claim boundary；因此結論必須是 conditional，而不是普遍保證。"
        "Recover：少一個 pair 就保留已知部分，回 P056 或 P059 的原始 stdout path。"
        "Transition：最後用 P062 的 supported restore contract 管理中斷。"
    ),
    "P062": (
        "Point：recovery overview 的 status → restore → compile → exact rerun。"
        "Say：先讀 course.* status，再只使用三個支援 checkpoint 名稱 lab-a-frozen、lab-b-frozen、release-default；restore 只回復 policy lineage，不會復原遺失的 result。"
        "Operate：WSL 依序可執行 bash course.sh status、bash course.sh restore --checkpoint lab-a-frozen、bash course.sh restore --checkpoint lab-b-frozen、bash course.sh restore --checkpoint release-default；PowerShell 依序使用 .\\course.cmd 對應命令。"
        "Expect：status 留下 receipt；restore 後重新 compile 並 exact rerun，新的 stdout 會帶新的 result_path 與配對 endpoint-replay.json。"
        "Interpret：restore 是可追溯的 lineage recovery，不是把 fallback 當成 fresh run；每次結果都重新以 stdout claim_boundary 判讀。"
        "Recover：result／replay 遺失時不手改 JSON，回 identity 正確 checkpoint 再跑一次。"
        "Transition：下一頁提供可逐行複製的 recovery commands。"
    ),
    "P062b": (
        "Point：WSL／POSIX 與 Windows PowerShell 的 status 及三個 restore 命令。"
        "Say：WSL 逐行執行 bash course.sh status；bash course.sh restore --checkpoint lab-a-frozen；bash course.sh restore --checkpoint lab-b-frozen；bash course.sh restore --checkpoint release-default。PowerShell 逐行執行 .\\course.cmd status；.\\course.cmd restore --checkpoint lab-a-frozen；.\\course.cmd restore --checkpoint lab-b-frozen；.\\course.cmd restore --checkpoint release-default。"
        "Expect：命令各自可複製；restore 只接受這三個 checkpoint，完成後仍要 compile 與 exact rerun 才會產生新 result_path。"
        "Interpret：命令成功代表 policy lineage 已回復，不代表 result、replay 或 service 已成功；那些欄位要從新的 stdout pair 讀。"
        "Recover：保留 stdout／stderr，回到最後 identity 正確 checkpoint；不手改 JSON。"
        "Transition：帶新的 result_path 進目前 browser UI。"
    ),
    "P063": (
        "Point：完整入口 http://120.126.151.102:3000/course、頁名 LoRa 實驗結果工作台，以及 證據、進度備份兩個 tabs。"
        "Say：目前 browser 只選 result.json；證據 tab 驗 schema、identity、units、provenance，進度備份 tab 是本機 controls；endpoint-replay.json 目前 accepted replay 為 none。"
        "Operate：由最新 stdout result_path 選對應 result.json，再觀察 empty evidence state；不要把畫面說成成功 upload 或 live measurement。"
        "Expect：UI 名稱、入口與 current-browser-evidence/course-20260811-1412-live/README.md 一致；identity／schema／units 不一致時 fail closed。"
        "Interpret：這頁只證明現行 browser boundary，不提升 endpoint energy 到 system 或 canonical claim，也不宣稱 replay 已被接受。"
        "Recover：匯入失敗保留瀏覽器錯誤和 stdout path，回 P062 restore／exact rerun 取得新 result.json。"
        "Transition：下一段進 Part C 的 web field reading，沿新的 receipt、result、replay pair 讀欄位。"
    ),
}


FIELD_AUDIT = [
    {"page": "P028", "unexplained_terms": "state、SLEEP、WAIT、WAKE、PROCESS、TX、RX", "fix_or_split": "每個 state 卡加入中文名稱與作用；補上 interval → power × duration → J 機制；不拆頁。"},
    {"page": "P029", "unexplained_terms": "scenario、seed、traffic、window、endpoint boundary", "fix_or_split": "改為 Lab A 機制總覽；固定條件、SLEEP／WAIT 成本與 service／energy 判讀集中於雙卡；不拆頁。"},
    {"page": "P030", "unexplained_terms": "generated、queue、attempt、retry、delivered、expired", "fix_or_split": "事件卡補中文名稱、packet outcome 與 service verdict；不拆頁。"},
    {"page": "P031", "unexplained_terms": "service gate、delivered、deadline、freshness、service_pass", "fix_or_split": "四段 gate 卡加入中文欄位定義與 endpoint J scope；不拆頁。"},
    {"page": "P032", "unexplained_terms": "power、W、time、s、state bucket", "fix_or_split": "座標軸補中文名稱與單位；band 說明 duration 與 bucket 組成 J；不拆頁。"},
    {"page": "P033", "unexplained_terms": "E_endpoint、P_s、t_s、Σ", "fix_or_split": "公式後補 P_s／t_s 的中文名稱、單位、scope 與 result artifact 來源；不拆頁。"},
    {"page": "P034", "unexplained_terms": "η_E、D_delivered、E_endpoint、bit/J", "fix_or_split": "公式後補分子／分母中文名稱、來源、單位與 service gate 限制；不拆頁。"},
    {"page": "P035", "unexplained_terms": "SOURCE、MODEL、COURSE、RESULT、provenance", "fix_or_split": "四層卡改為中文層名＋來源／作用；補 coherent simulated result 分類；不拆頁。"},
    {"page": "P036", "unexplained_terms": "scenario_id、RUN、REPLAY、WORKBOOK、run_id、units、provenance", "fix_or_split": "依正式契約重做三卡與一致性 band；分別定義物件、輸入、輸出與限制；不拆頁。"},
    {"page": "P037", "unexplained_terms": "baseline、control、marked block、policy identity", "fix_or_split": "三卡列固定條件、唯一修改與觀察輸出；改為正向 baseline 定義；不拆頁。"},
    {"page": "P038", "unexplained_terms": "changing-service-window、contact_open、quality_band、contact_remaining_s", "fix_or_split": "lead 改為 trace 輸入定義；band 加中文名稱與 seconds 單位；不拆頁。"},
    {"page": "P039", "unexplained_terms": "REST_DURING_GAP、SLEEP、WAIT、WAKE、awake idle、PACE_GAP_STEPS", "fix_or_split": "依正式契約改 Lab A 總覽；雙卡列固定條件與唯一修改；不拆頁。"},
    {"page": "P040", "unexplained_terms": "contact_open、steps_since_send、PACE_GAP_STEPS、REST_DURING_GAP", "fix_or_split": "decision／command 與 baseline summary 分到 P040、P040a，避免 evidence 卡標題重疊。"},
    {"page": "P041", "unexplained_terms": "PACE_GAP_STEPS、REST_DURING_GAP、py_compile", "fix_or_split": "P041 BEFORE；P041d AFTER；P041b commands；P041c marker 外 consumer／unique edit／interpret。"},
    {"page": "P042", "unexplained_terms": "baseline、candidate、hidden、freeze、result_path、replay", "fix_or_split": "P042 只放六條 exact commands；P042a 分開 stdout fields、result／replay pair 與 freeze checkpoint。"},
    {"page": "P043", "unexplained_terms": "identity、result_path、endpoint-replay、claim boundary", "fix_or_split": "比較卡列來源、數值／單位與 service；band 定義 identity／scope 比較條件；不拆頁。"},
    {"page": "P044", "unexplained_terms": "awake_idle、sleep、wake、process、tx、rx、energy_breakdown_j", "fix_or_split": "每個 bucket label 加中文名稱；數值保留 J 單位並連接 REST_DURING_GAP 機制；不拆頁。"},
    {"page": "P045", "unexplained_terms": "attempted、retransmissions、delivered_bits、expired_packets、service_pass", "fix_or_split": "packet／service 卡改為中文名稱＋值／單位；不以 SEND 次數代替交付；不拆頁。"},
    {"page": "P046", "unexplained_terms": "freeze、checkpoint、predecessor、active_block_id、receipt", "fix_or_split": "freeze fields 加中文名稱與識別碼性質；移除 identity digest 教學；不拆頁。"},
    {"page": "P047", "unexplained_terms": "withheld、frozen policy、適用條件限制、claim ceiling", "fix_or_split": "卡片補中文定義與 frozen policy 狀態；band 說明適用範圍；不拆頁。"},
    {"page": "P048", "unexplained_terms": "CONDITION、MECHANISM、EVIDENCE、CLAIM CEILING", "fix_or_split": "四個流程節點加中文名稱；結論句連接 state、packet／service、J、適用條件；不拆頁。"},
    {"page": "P049", "unexplained_terms": "quality trace、enter、hold、exit、service window", "fix_or_split": "改為 service-window transition 總覽；challenge visual 與 gate 卡提供中文定義；不拆頁。"},
    {"page": "P050", "unexplained_terms": "ENTER_QUALITY、STABLE_STEPS、send_mode_active、SEND_READY", "fix_or_split": "閾值卡加入中文名稱、值、單位／值域與切換作用；不拆頁。"},
    {"page": "P051", "unexplained_terms": "EXIT_QUALITY、hysteresis、send-ready", "fix_or_split": "雙閾值圖與卡片說明 enter／hold／exit 的條件與 mode 作用；不拆頁。"},
    {"page": "P052", "unexplained_terms": "quality band、STABLE_STEPS、send_mode_active、spike", "fix_or_split": "兩卡補品質等級、穩定步數與布林 mode 變化；不拆頁。"},
    {"page": "P053", "unexplained_terms": "Trace A、enter、hold、exit、MODE_CHANGE", "fix_or_split": "prediction band 加中文欄位解釋與填寫來源；不拆頁。"},
    {"page": "P054", "unexplained_terms": "A predecessor、B hold、Trace A、result_path", "fix_or_split": "decision／command 與 Trace A baseline summary 分到 P054、P054a。"},
    {"page": "P055", "unexplained_terms": "ENTER_QUALITY、EXIT_QUALITY、STABLE_STEPS、marked block、py_compile", "fix_or_split": "P055 BEFORE；P055d AFTER；P055b commands；P055c consumer／function location／unique edit。"},
    {"page": "P056", "unexplained_terms": "Trace A baseline、candidate、freeze、Trace B、result_path", "fix_or_split": "P056 只放六條 exact commands；P056a 分開 stdout fields、result／replay pair 與 freeze checkpoint。"},
    {"page": "P057", "unexplained_terms": "quality band、MODE_CHANGE、PACKET_ATTEMPT、service_pass", "fix_or_split": "P057 causal overview；P057a 獨立放 MODE_CHANGE、packet、service 與 energy evidence。"},
    {"page": "P058", "unexplained_terms": "A predecessor、B checkpoint、Trace B entry、receipt identity", "fix_or_split": "沿用 P046 定義；freeze lineage 卡只呈現三者關係與 entry 條件；不拆頁。"},
    {"page": "P059", "unexplained_terms": "Trace B、frozen policy、withheld、expired_packets", "fix_or_split": "P059 frozen setup；P059a 獨立放 Trace B summary、service false 與 claim ceiling。"},
    {"page": "P060", "unexplained_terms": "too-slow、ping-pong、MODE_CHANGE、retry、transition", "fix_or_split": "兩種 failure mode 以中文事件序列解釋；band 指定 evidence 欄位；不拆頁。"},
    {"page": "P061", "unexplained_terms": "hysteresis、Trace A、Trace B、claim ceiling", "fix_or_split": "流程節點加中文名稱；句型連接 transition、packet／service、J 與條件；不拆頁。"},
    {"page": "P062", "unexplained_terms": "policy lineage、checkpoint、py_compile、result_path、replay", "fix_or_split": "P062 recovery overview；P062b 分開展示 WSL／PowerShell status 與支援 checkpoint commands。"},
    {"page": "P063", "unexplained_terms": "RUNNER、VALIDATOR、REPLAY、WORKBOOK、schema、provenance", "fix_or_split": "流程節點加中文名稱；import rule／band 說明輸入、驗證、回放、寫入與失敗不變資料；不拆頁。"},
]


def qn(ns: str, local: str) -> str:
    return f"{{{ns}}}{local}"


def set_font(run, size: int, *, bold: bool = False, italic: bool = False,
             color: RGBColor = INK) -> None:
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


def write_text(tf, text: str, size: int, *, bold: bool = False,
               color: RGBColor = INK, align=PP_ALIGN.LEFT,
               valign=MSO_ANCHOR.TOP, italic_code: bool = True,
               margins=(0.08, 0.04, 0.08, 0.04)) -> None:
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = Inches(margins[0])
    tf.margin_top = Inches(margins[1])
    tf.margin_right = Inches(margins[2])
    tf.margin_bottom = Inches(margins[3])
    tf.vertical_anchor = valign
    paragraphs = text.split("\n")
    for pi, line in enumerate(paragraphs):
        p = tf.paragraphs[0] if pi == 0 else tf.add_paragraph()
        p.alignment = align
        p.space_after = Pt(0)
        p.line_spacing = 1.0
        pieces = list(filter(None, VARIABLE_RE.split(line)))
        if not pieces:
            pieces = [""]
        for piece in pieces:
            r = p.add_run()
            r.text = piece
            italic = italic_code and bool(VARIABLE_RE.fullmatch(piece))
            set_font(r, size, bold=bold, italic=italic, color=color)


def text_box(slide, x: float, y: float, w: float, h: float, text: str,
             size: int = 24, *, bold: bool = False, color: RGBColor = INK,
             align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP, fill=None, line=None,
             radius: bool = False, name: str = "Editable text",
             italic_code: bool = True, margins=(0.08, 0.04, 0.08, 0.04)):
    kind = MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE if radius else MSO_AUTO_SHAPE_TYPE.RECTANGLE
    shape = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h)) if fill is not None or line is not None else slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    shape.name = name
    if fill is None:
        shape.fill.background()
    else:
        shape.fill.solid(); shape.fill.fore_color.rgb = fill
    if line is None:
        shape.line.fill.background()
    else:
        shape.line.color.rgb = line; shape.line.width = Pt(1.2)
    write_text(shape.text_frame, text, size, bold=bold, color=color, align=align,
               valign=valign, italic_code=italic_code, margins=margins)
    return shape


def box(slide, x: float, y: float, w: float, h: float, *, fill=WHITE,
        line=BLUE, radius: bool = True, name: str = "Editable figure"):
    kind = MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE if radius else MSO_AUTO_SHAPE_TYPE.RECTANGLE
    shape = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.name = name
    shape.fill.solid(); shape.fill.fore_color.rgb = fill
    shape.line.color.rgb = line; shape.line.width = Pt(1.2)
    return shape


def line(slide, x1: float, y1: float, x2: float, y2: float, *, color=NAVY,
         width: float = 1.5, arrow: bool = False, name: str = "Editable connector"):
    shape = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    shape.name = name; shape.line.color.rgb = color; shape.line.width = Pt(width)
    if arrow:
        shape.line.end_arrowhead = True
    return shape


def dot(slide, x: float, y: float, d: float = 0.18, *, fill=TEAL, name="State marker"):
    shape = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.OVAL, Inches(x), Inches(y), Inches(d), Inches(d))
    shape.name = name; shape.fill.solid(); shape.fill.fore_color.rgb = fill; shape.line.color.rgb = fill
    return shape


def clear_placeholders(slide) -> None:
    for shape in list(slide.shapes):
        if shape.is_placeholder and int(shape.placeholder_format.type) not in (1, 4):
            shape._element.getparent().remove(shape._element)


def set_title(slide, title: str) -> None:
    shape = slide.shapes.title
    if shape is None:
        shape = slide.shapes.add_textbox(Inches(0.68), Inches(0.18), Inches(11.95), Inches(0.62))
        shape.name = "Native title anchor"
    # A blank educate layout inherits a title placeholder with zero width.
    # Give every authored title the same safe geometry so the title cannot
    # disappear while the native master/footer remains untouched.
    shape.left = Inches(0.68)
    shape.top = Inches(0.18)
    shape.width = Inches(11.95)
    shape.height = Inches(0.62)
    write_text(shape.text_frame, title, 28, bold=True, color=NAVY,
               valign=MSO_ANCHOR.MIDDLE, margins=(0.02, 0.0, 0.02, 0.0), italic_code=False)
    shape.height = max(shape.height, Inches(0.54))


def header(slide, s: SlideSpec) -> None:
    set_title(slide, s.title)


def boundary(slide, text: str = VISIBLE_BOUNDARY) -> None:
    # The educate master already owns the footer line, wording, logo, and
    # page-number carrier.  Repeating a red claim line on every authored page
    # crowded the lower content rail, so the claim boundary remains in the
    # manifest/notes rather than being rendered as a second footer.
    return None


def band(slide, text: str, y: float = 4.86, *, fill=PALE_GOLD, color=PURPLE,
         size: int = 20, name="Teaching takeaway", height: float = 0.70):
    # Two-line takeaways need real vertical breathing room at 18–20 pt.
    # Keep the lower rail above the native footer instead of letting text sit
    # on the band border; callers with compact legacy heights are promoted.
    height = max(height, 0.70)
    box(slide, 0.86, y, 11.58, height, fill=fill, line=GOLD, radius=True, name=name)
    text_box(slide, 1.04, y + 0.07, 11.22, max(0.30, height - 0.14), text, size, bold=True, color=color,
             align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=name + " text", margins=(0.02, 0.0, 0.02, 0.0))


def command_header(slide, s: SlideSpec, y: float = 1.18, h: float = 0.68, *, size: int = 20):
    box(slide, 0.82, y, 11.58, h, fill=CREAM, line=NAVY, radius=True, name="Exact command context")
    text_box(slide, 1.02, y + 0.05, 2.22, 0.24, "CONTEXT", 18, bold=True, color=NAVY, name="Command context label", italic_code=False, margins=(0.01, 0.0, 0.01, 0.0))
    text_box(slide, 3.16, y + 0.05, 8.98, 0.26, s.context, 18, color=MUTED, name="Command context", margins=(0.01, 0.0, 0.01, 0.0))
    if s.command:
        text_box(slide, 1.02, y + 0.30, 11.12, h - 0.34, s.command, size, color=INK, name="Exact command", italic_code=False, margins=(0.01, 0.0, 0.01, 0.0))


def card_text(slide, x: float, y: float, w: float, h: float, heading: str, body: str, *, fill=PALE_BLUE, line_color=BLUE, body_size: int = 22, heading_size: int = 20, name="Card"):
    box(slide, x, y, w, h, fill=fill, line=line_color, name=name)
    text_box(slide, x + 0.18, y + 0.16, w - 0.36, 0.30, heading, heading_size, bold=True, color=line_color, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=name + " heading", italic_code=False, margins=(0.01, 0.0, 0.01, 0.0))
    text_box(slide, x + 0.20, y + 0.58, w - 0.40, h - 0.72, body, body_size, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=name + " body")


def fallback_label() -> str:
    return "same-scenario-fallback reference｜not a fresh run"


def summary_text(case: str, *, include_source: bool = True) -> str:
    """Return the contract fields required on every result-reading page."""
    d = FALLBACK[case]
    source = f"{fallback_label()}\n" if include_source else ""
    return (
        source
        + f"summary.service_pass = {d['service']}\n"
        + f"summary.deadline_pass = {d['deadline']}\n"
        + f"summary.freshness_status = {d['freshness']}\n"
        + f"summary.delivered_bits = {d['delivered']} bit\n"
        + f"summary.endpoint_energy_j = {d['energy']} J\n"
        + f"summary.efficiency = {d['eff']} bit/J\n"
        + f"wake = {d['wake']} · attempt = {d['attempt']} · retry = {d['retry']} · expired = {d['expired']}"
    )


def stdout_receipt(slide, lab: str, *, y: float = 4.72) -> None:
    """Show the non-hash stdout contract and the paired artifact paths."""
    checkpoint = "lab-a-frozen" if lab == "A" else "lab-b-frozen"
    box(slide, 0.82, y, 11.58, 1.02, fill=CREAM, line=NAVY, radius=True, name=f"Run receipt contract {lab}")
    text_box(slide, 1.00, y + 0.08, 11.22, 0.25,
             "stdout fields：status（成功時 OK） · run_id · result_path · artifact_source · claim_boundary（不顯示識別摘要值）",
             18, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name=f"Run stdout fields {lab}", italic_code=False, margins=(0.01, 0.0, 0.01, 0.0))
    text_box(slide, 1.00, y + 0.38, 11.22, 0.24,
             "依 stdout result_path 開啟 artifacts/<run_id>/result.json，再開同目錄 endpoint-replay.json；"
             f"candidate freeze：artifacts/checkpoints/{checkpoint}.{{json,py}}",
             18, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name=f"Run artifact paths {lab}", italic_code=False, margins=(0.01, 0.0, 0.01, 0.0))


def draw_states(slide, s):
    header(slide, s)
    text_box(slide, 0.96, 1.18, 11.32, 0.36, "WAIT／SLEEP 的 state interval 與 energy bucket 對照。", 22, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Lead")
    labels = [("SLEEP", "低功耗休息\n空檔功率", BLUE, PALE_BLUE), ("WAKE", "喚醒轉換\ntransition cost", GOLD, PALE_GOLD), ("PROCESS", "資料處理\nclock interval", PURPLE, PALE_PURPLE), ("TX", "封包送出\nattempt", RED, PALE_RED), ("RX", "封包接收\nradio interval", TEAL, PALE_TEAL), ("WAIT", "清醒閒置\nawake idle", NAVY, CREAM)]
    x = 0.72
    for i, (lab, desc, col, fill) in enumerate(labels):
        card_text(slide, x, 1.92, 1.86, 1.42, lab, desc, fill=fill, line_color=col, body_size=18, heading_size=19, name=f"State {lab}")
        if i < len(labels) - 1:
            line(slide, x + 1.86, 2.63, x + 2.02, 2.63, color=NAVY, width=1.4, arrow=True, name="State transition")
        x += 2.07
    text_box(slide, 1.04, 3.66, 11.16, 0.70, "runner 將每個固定步長寫成 state interval，再把該區間的功率乘上時間累加到 endpoint energy。", 22, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="State mechanism")
    band(slide, "state interval 提供 duration；power × duration 形成 energy bucket；action 只標記一次決策。", y=4.64, size=20)
    boundary(slide)


def draw_challenge(slide, s, lab: str = "A"):
    header(slide, s)
    card_text(slide, 0.86, 1.18, 5.62, 3.22, f"LAB {lab} CHALLENGE", s.visual.replace(" → ", "\n→ "), fill=PALE_BLUE if lab == "A" else PALE_PURPLE, line_color=BLUE if lab == "A" else PURPLE, body_size=22, heading_size=21, name=f"Lab {lab} challenge")
    card_text(slide, 6.84, 1.18, 5.62, 3.22, "SUCCESS GATE", "固定 scenario／seed／traffic／window\ndelivered／deadline／freshness 定義 service\nendpoint J 作為 energy 欄位\nwithheld case 界定適用範圍", fill=PALE_GOLD, line_color=GOLD, body_size=20, heading_size=21, name=f"Lab {lab} gate")
    band(slide, s.mechanism, y=4.78, fill=CREAM, color=NAVY, size=19)
    boundary(slide)


def draw_packet(slide, s):
    header(slide, s)
    text_box(slide, 0.90, 1.18, 11.46, 0.36, "一次 TX 是一次嘗試；service 看完整 packet outcome。", 22, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Lead")
    stages = [("generated", "產生封包", BLUE, PALE_BLUE), ("queue", "進入佇列", NAVY, CREAM), ("attempt", "一次傳輸嘗試", PURPLE, PALE_PURPLE), ("retry", "碰撞後重試", GOLD, PALE_GOLD), ("delivered", "成功交付 bit", TEAL, PALE_TEAL), ("expired", "逾時未交付", RED, PALE_RED)]
    x = 0.62
    for i, (lab, desc, col, fill) in enumerate(stages):
        card_text(slide, x, 1.82, 1.86, 1.20, lab, desc, fill=fill, line_color=col, body_size=18, heading_size=18, name=f"Packet stage {lab}")
        if i < len(stages) - 1:
            line(slide, x + 1.86, 2.42, x + 2.00, 2.42, color=NAVY, width=1.4, arrow=True, name="Packet arrow")
        x += 2.08
    card_text(slide, 1.04, 3.34, 5.18, 1.60, "PACKET LEDGER", "attempted（嘗試次數）≠ delivered（交付 bit）\ncollision／retry／expired\n→ packet outcome", fill=PALE_BLUE, line_color=BLUE, body_size=18, heading_size=19, name="Packet ledger")
    card_text(slide, 6.76, 3.34, 5.44, 1.60, "SERVICE VERDICT", "deadline（期限）、freshness（新鮮度）\nrequired packet 共同定義\nservice_pass（服務布林狀態）", fill=PALE_GOLD, line_color=GOLD, body_size=18, heading_size=19, name="Packet service")
    boundary(slide)


def draw_gate(slide, s):
    header(slide, s)
    nodes = [("same identity", "情境／policy／scope 一致", BLUE, PALE_BLUE), ("delivered / deadline", "交付 bit 與期限", PURPLE, PALE_PURPLE), ("service_pass", "服務 gate：布林狀態", TEAL, PALE_TEAL), ("endpoint J", "端點累積能量（J）", GOLD, PALE_GOLD)]
    x = 0.68
    for i, (lab, desc, col, fill) in enumerate(nodes):
        card_text(slide, x, 1.48, 2.72, 1.26, lab, desc, fill=fill, line_color=col, body_size=18, heading_size=18, name=f"Gate {lab}")
        if i < len(nodes) - 1:
            line(slide, x + 2.72, 2.11, x + 2.92, 2.11, color=NAVY, width=1.5, arrow=True, name="Gate arrow")
        x += 3.04
    text_box(slide, 1.00, 3.08, 11.28, 0.72, "candidate 的 delivered／required packet／deadline 共同定義 service；較低的 J 仍須放回相同 endpoint scope。", 23, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Gate explanation")
    band(slide, "相同 scenario、traffic、window 與 scope 下，candidate 的 service verdict 決定 J 差異的解讀。", y=4.24, size=20)
    boundary(slide)


def draw_power(slide, s):
    header(slide, s)
    text_box(slide, 1.02, 1.18, 11.20, 0.36, "低峰值不保證低總 J；時間是因果的一部分。", 22, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Lead")
    line(slide, 1.46, 4.16, 11.54, 4.16, color=NAVY, width=1.8, name="Time axis")
    line(slide, 1.46, 4.16, 1.46, 1.90, color=NAVY, width=1.8, name="Power axis")
    points = [(1.70, 3.72), (3.00, 3.22), (4.32, 2.60), (5.62, 3.44), (6.96, 2.32), (8.28, 3.04), (9.68, 2.18), (11.20, 2.88)]
    for a, b in zip(points, points[1:]):
        line(slide, a[0], a[1], b[0], b[1], color=TEAL, width=2.2, name="Power curve")
    for x, y in points:
        dot(slide, x - 0.08, y - 0.08, 0.16, fill=TEAL, name="Power sample")
    text_box(slide, 1.56, 1.68, 2.20, 0.26, "功率 power / W", 20, bold=True, color=TEAL, name="Power label", italic_code=False)
    text_box(slide, 9.92, 4.34, 1.54, 0.24, "時間 time / s", 18, color=MUTED, align=PP_ALIGN.RIGHT, name="Time label", italic_code=False)
    band(slide, "功率高度 × 時間跨度 → endpoint energy；state bucket 定義總和的組成。", y=4.76, size=20)
    boundary(slide)


def draw_formula(slide, s, key: str):
    header(slide, s)
    box(slide, 0.72, 1.18, 11.90, 3.72, fill=CREAM, line=GOLD, name=f"NATIVE_EQUATION_HOOK_{key}")
    text_box(slide, 1.02, 1.42, 11.30, 0.30, "EDITABLE OFFICE MATH｜公式邊界", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Equation hook label {key}", italic_code=False)
    formula = "E_endpoint = Σ P_s t_s" if key == "E_endpoint" else "η_E = D_delivered / E_endpoint"
    # This preview is kept only in the render source; the final package removes
    # the named shape after the native OMML insertion.
    text_box(slide, 1.00, 2.10, 11.34, 0.84, formula, 30, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Formula preview fallback {key}", italic_code=True)
    scope = "P_s（state power，W）× t_s（停留時間，s）；scope：radio／processing；satellite、gateway、whole-system wall-plug 不在此式" if key == "E_endpoint" else "D_delivered（交付資料，bit）÷ E_endpoint（端點能量，J）= bit/J；service_pass 與 deadline_pass 另行判定"
    text_box(slide, 1.08, 3.38, 11.12, 0.86, scope, 22, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Formula scope")
    band(slide, "Office Math 定義累積／比值語義；本次數值來源為 result artifact。", y=4.90, fill=PALE_BLUE, color=NAVY, size=19, height=0.56)
    boundary(slide)


def draw_layers(slide, s):
    header(slide, s)
    layers = [("SOURCE", "來源 provenance：輸入與參考", BLUE, PALE_BLUE), ("MODEL", "模型：coherent simulated adapter", PURPLE, PALE_PURPLE), ("COURSE", "課程固定條件：scenario／endpoint", GOLD, PALE_GOLD), ("RESULT", "輸出：JSON + endpoint replay", TEAL, PALE_TEAL)]
    for i, (lab, body, col, fill) in enumerate(layers):
        y = 1.18 + i * 0.96
        box(slide, 1.06 + i * 0.32, y, 10.96 - i * 0.64, 0.66, fill=fill, line=col, name=f"Provenance {lab}")
        text_box(slide, 1.28 + i * 0.32, y + 0.10, 1.30, 0.40, lab, 19, bold=True, color=col, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Provenance {lab} label", italic_code=False, margins=(0.01, 0.0, 0.01, 0.0))
        text_box(slide, 2.72 + i * 0.32, y + 0.10, 8.82 - i * 0.64, 0.40, body, 20, color=INK, align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.MIDDLE, name=f"Provenance {lab} body", margins=(0.01, 0.0, 0.01, 0.0))
    band(slide, "資料類型：coherent simulated result；provenance 連結 input、policy、scenario、seed 與 output。", y=5.02, size=18, height=0.50)
    boundary(slide)


def draw_identity(slide, s):
    header(slide, s)
    card_text(slide, 0.82, 1.18, 3.64, 3.44, "情境識別碼 scenario_id", f"{SCENARIO_ID}\n固定 scenario 定義\n字串識別碼；非能量值\n來源：scenario package", fill=PALE_BLUE, line_color=BLUE, body_size=19, heading_size=18, name="Identity source")
    card_text(slide, 4.84, 1.18, 3.64, 3.44, "執行 RUN → result", "runner 讀 scenario／case／policy\n輸出 result.json（數值與 units）\n同 run endpoint-replay.json\n來源：stdout result_path", fill=PALE_PURPLE, line_color=PURPLE, body_size=18, heading_size=18, name="Identity result")
    card_text(slide, 8.86, 1.18, 3.64, 3.44, "事件重播 REPLAY／工作簿", "REPLAY：同 run events\nstate／queue／packet\nWORKBOOK：baseline／candidate\nfreeze／withheld\n一致性：run_id、policy identity\nunits、provenance", fill=PALE_TEAL, line_color=TEAL, body_size=18, heading_size=18, name="Identity replay")
    line(slide, 4.48, 3.10, 4.80, 3.10, color=NAVY, width=1.6, arrow=True, name="Identity arrow")
    line(slide, 8.50, 3.10, 8.82, 3.10, color=NAVY, width=1.6, arrow=True, name="Identity arrow")
    band(slide, "一致性核對：scenario_id、run_id、policy identity、units 與 provenance 共同決定配對資格。", y=4.98, fill=CREAM, color=NAVY, size=18, height=0.50)
    boundary(slide, "IDENTITY GATE｜scenario / run / policy / replay must agree")


def draw_control(slide, s):
    header(slide, s)
    cards = [("FIXED 固定條件", "scenario（情境）／seed（種子）\ntraffic、window、endpoint scope", BLUE, PALE_BLUE), ("ONE EDIT 唯一修改", "目前 lab 的 marked block\npolicy identity 產生差異", PURPLE, PALE_PURPLE), ("OBSERVE 觀察輸出", "state／packet／service\nendpoint J（端點能量）", TEAL, PALE_TEAL)]
    for i, (lab, body, col, fill) in enumerate(cards):
        card_text(slide, 0.90 + i * 4.10, 1.32, 3.62, 2.00, lab, body, fill=fill, line_color=col, body_size=20, heading_size=18, name=f"Control {lab}")
        if i < 2:
            line(slide, 4.52 + i * 4.10, 2.32, 4.84 + i * 4.10, 2.32, color=NAVY, width=1.5, arrow=True, name="Control arrow")
    text_box(slide, 1.06, 3.76, 11.18, 0.76, "兩次 result 的 scenario identity、traffic 或 scope 不同時，policy 差異不具因果資格。", 23, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Control question")
    band(slide, "Baseline = 固定條件下的原始 policy execution；candidate = 一個 marked edit 的比較 execution。", y=4.76, size=20)
    boundary(slide)


def draw_window(slide, s):
    header(slide, s)
    text_box(slide, 0.92, 1.18, 11.38, 0.36, "LEO trace：closed／contact-a／closed／contact-b／closed，作為傳輸時機輸入。", 20, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Window lead")
    line(slide, 1.10, 2.82, 11.92, 2.82, color=NAVY, width=2.0, name="Window axis")
    parts = [("closed", 1.20, 1.16, PALE_RED, RED), ("contact-a\nquality trace", 2.62, 3.08, PALE_TEAL, TEAL), ("closed", 6.10, 1.16, PALE_RED, RED), ("contact-b\nquality trace", 7.52, 3.08, PALE_TEAL, TEAL), ("closed", 11.00, 1.16, PALE_RED, RED)]
    for lab, x, w, fill, col in parts:
        box(slide, x, 2.12, w, 1.36, fill=fill, line=col, name=f"Window {lab}")
        text_box(slide, x + 0.08, 2.48, w - 0.16, 0.56, lab, 19, bold=True, color=col, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Window {lab} label", margins=(0.01, 0.0, 0.01, 0.0))
    band(slide, "contact_open（窗口布林狀態）、quality_band（品質等級）、contact_remaining_s（剩餘秒數）→ policy observation；closed 時 action=SLEEP。", y=4.30, size=18)
    boundary(slide)


def draw_lab_hero(slide, s, lab: str):
    draw_challenge(slide, s, lab)


def draw_baseline(slide, s, lab: str):
    header(slide, s)
    if lab == "A":
        decision = "contact_open=false（窗口布林）→ SLEEP\nsteps_since_send < PACE_GAP_STEPS（步數）→ REST_DURING_GAP\ngap 結束 → WAIT／SEND decision"
        card_text(slide, 0.82, 1.18, 5.62, 3.42, "BASELINE DECISION", decision, fill=PALE_BLUE, line_color=BLUE, body_size=20, heading_size=19, name="Baseline A decision")
        body = "stdout receipt：status／run_id／result_path\n依 result_path 開 result.json\n同目錄 endpoint-replay.json\nsummary 欄位見下一頁\n來源：P042 stdout result_path"
        posix = "WSL / POSIX：bash course.sh run --lab A --case baseline"
        powershell = "PowerShell：.\\course.cmd run --lab A --case baseline"
    else:
        decision = "A WAIT 保持 frozen\nquality ≥ 2 且 stable_steps ≥ 2\n切換 send-ready\nengine 建立 MODE_CHANGE"
        card_text(slide, 0.82, 1.18, 5.62, 3.42, "A PREDECESSOR + B BASELINE", decision, fill=PALE_PURPLE, line_color=PURPLE, body_size=20, heading_size=19, name="Baseline B decision")
        body = "stdout receipt：status／run_id／result_path\n依 result_path 開 result.json\n同目錄 endpoint-replay.json\nMODE_CHANGE：REST → SEND_READY，t = 130 s\nsummary 欄位見下一頁\n來源：P056 stdout result_path"
        posix = "WSL / POSIX：bash course.sh run --lab B --case trace-a-baseline"
        powershell = "PowerShell：.\\course.cmd run --lab B --case trace-a-baseline"
    card_text(slide, 6.84, 1.18, 5.62, 3.42, "READ CONTROL EVIDENCE", body, fill=PALE_TEAL, line_color=TEAL, body_size=20, heading_size=20, name=f"Baseline {lab} evidence")
    box(slide, 0.82, 4.78, 11.58, 0.70, fill=CREAM, line=NAVY, radius=True, name=f"Baseline command {lab}")
    text_box(slide, 1.02, 4.88, 11.18, 0.24, posix, 18, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Baseline WSL {lab}", italic_code=False, margins=(0.01, 0.0, 0.01, 0.0))
    text_box(slide, 1.02, 5.16, 11.18, 0.24, powershell, 18, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Baseline PowerShell {lab}", italic_code=False, margins=(0.01, 0.0, 0.01, 0.0))
    boundary(slide)


def draw_baseline_result(slide, s, lab: str):
    """Read the baseline receipt on its own page so summary lines stay clear."""
    header(slide, s)
    case = "baseline-A" if lab == "A" else "trace-a-baseline-B"
    title = "A BASELINE｜summary fields" if lab == "A" else "TRACE A BASELINE｜summary fields"
    d = FALLBACK[case]
    # The prior two-column card put the source line behind the lower rail at
    # original size.  Keep every required field at classroom scale in one
    # compact, full-width summary card, then use a separate source rail.
    detail = (
        "固定 scenario／seed／traffic／window；唯一 control：原始 policy；"
        "下一步：對照 candidate --freeze"
        if lab == "A" else
        "A WAIT predecessor 保持 frozen；B STABLE_STEPS = 2；"
        "MODE_CHANGE：REST → SEND_READY，t = 130 s；active_s = 8；"
        "較快 transition 不等於 service success"
    )
    body = (
        f"{fallback_label()}\n"
        f"summary.service_pass = {d['service']} · summary.deadline_pass = {d['deadline']} · summary.freshness_status = {d['freshness']}\n"
        f"summary.delivered_bits = {d['delivered']} bit · summary.endpoint_energy_j = {d['energy']} J\n"
        f"summary.efficiency = {d['eff']} bit/J · wake = {d['wake']} · attempt = {d['attempt']} · retry = {d['retry']} · expired = {d['expired']}\n"
        f"{detail}"
    )
    card_text(slide, 0.82, 1.28, 11.58, 3.96, title, body, fill=PALE_BLUE, line_color=BLUE, body_size=20, heading_size=20, name=f"Baseline {lab} result summary")
    band(slide, "來源：stdout result_path → artifacts/<run_id>/result.json；同 run endpoint-replay.json；欄位一起判讀。", y=5.34, fill=PALE_GOLD, color=PURPLE, size=20, height=0.70)
    boundary(slide)


def draw_edit(slide, s, lab: str):
    header(slide, s)
    # Keep the package path, before/after blocks, editor examples, and
    # marker-external consumer branch visible at once.  The marker block is
    # copied from the package contract; only the one permitted line differs.
    text_box(slide, 0.82, 1.18, 11.58, 0.30, "package-relative file：lora-energy-lab/student_policy.py", 22, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Policy package path", italic_code=False, margins=(0.01, 0.0, 0.01, 0.0))
    if lab == "A":
        backup_name = "student_policy.before-A-edit.py"
        before = A_MARKED_BLOCK
        after = A_MARKED_BLOCK_AFTER
        consumer = "marker 外 consumer：" + A_CONSUMER + "\n唯一改動：REST_DURING_GAP = SLEEP → WAIT；marker、choose_action、其他 block 不動"
    else:
        backup_name = "student_policy.before-B-edit.py"
        before = B_MARKED_BLOCK
        after = B_MARKED_BLOCK_AFTER
        consumer = "marker 外 consumer：" + B_CONSUMER + "\n唯一改動：STABLE_STEPS = 2 → 1；ENTER_QUALITY、EXIT_QUALITY、其他 block 不動"
    card_text(slide, 0.72, 1.56, 5.82, 1.92, "BEFORE｜完整 marked block", before, fill=PALE_PURPLE, line_color=PURPLE, body_size=20, heading_size=20, name=f"Edit {lab} before")
    card_text(slide, 6.80, 1.56, 5.82, 1.92, "AFTER｜完整 marked block", after, fill=PALE_TEAL, line_color=TEAL, body_size=20, heading_size=20, name=f"Edit {lab} after")
    posix = (
        "WSL / POSIX（編輯器範例：nano）\n"
        "nano student_policy.py\n"
        f"cp student_policy.py {backup_name}\n"
        ".venv/bin/python -m py_compile student_policy.py"
    )
    powershell = (
        "Windows PowerShell（編輯器範例：notepad）\n"
        "notepad .\\student_policy.py\n"
        f"Copy-Item student_policy.py -Destination {backup_name}\n"
        ".\\.venv\\Scripts\\python.exe -m py_compile student_policy.py"
    )
    # Commands are operational text and may use 18 pt when the full command
    # must remain copyable.  Explanatory headings/body remain at classroom
    # scale; the consumer rail is split into two deliberate lines so it does
    # not collapse into a tiny annotation.
    card_text(slide, 0.72, 3.68, 5.82, 1.48, "WSL / POSIX exact", posix, fill=CREAM, line_color=NAVY, body_size=18, heading_size=20, name=f"Edit {lab} WSL commands")
    card_text(slide, 6.80, 3.68, 5.82, 1.48, "PowerShell exact", powershell, fill=CREAM, line_color=NAVY, body_size=18, heading_size=20, name=f"Edit {lab} PowerShell commands")
    box(slide, 0.72, 5.20, 11.90, 0.74, fill=PALE_GOLD, line=GOLD, radius=True, name=f"Edit {lab} consumer boundary")
    text_box(slide, 0.94, 5.28, 11.46, 0.58, consumer + "\npy_compile 只驗 syntax；run 才驗 marker、policy API、predecessor 與 result。", 20, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Edit {lab} consumer text", italic_code=False, margins=(0.01, 0.0, 0.01, 0.0))
    boundary(slide, "POLICY SURFACE｜marked block only｜syntax guard before run")


def _edit_contract(lab: str) -> tuple[str, str, str, str, str]:
    if lab == "A":
        return (
            "student_policy.before-A-edit.py", A_MARKED_BLOCK, A_MARKED_BLOCK_AFTER,
            "marker 外 consumer：function choose_action(observation)\n" + A_CONSUMER,
            "唯一改動：REST_DURING_GAP = SLEEP → WAIT；marker、choose_action、其他 block 不動",
        )
    return (
        "student_policy.before-B-edit.py", B_MARKED_BLOCK, B_MARKED_BLOCK_AFTER,
            "marker 外 consumer：function choose_action(observation)\n"
            "student_policy.py:116–118；observation.quality_band >= ENTER_QUALITY\n"
        "observation.stable_steps >= STABLE_STEPS\n"
        "run_simulation：lora_energy_lab/engine.py:238–249 → engine 建立 MODE_CHANGE",
        "唯一改動：STABLE_STEPS = 2 → 1；ENTER_QUALITY、EXIT_QUALITY、其他 block 不動",
    )


def _code_block(slide, x: float, y: float, w: float, h: float, heading: str, code: str, *, fill, line_color, name: str) -> None:
    box(slide, x, y, w, h, fill=fill, line=line_color, name=name)
    text_box(slide, x + 0.18, y + 0.10, w - 0.36, 0.25, heading, 20, bold=True, color=line_color,
             align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=name + " heading", italic_code=False,
             margins=(0.01, 0.0, 0.01, 0.01))
    text_box(slide, x + 0.22, y + 0.38, w - 0.44, max(0.24, h - 0.48), code, 20, color=INK,
             align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=name + " code", margins=(0.01, 0.0, 0.01, 0.01))


def draw_edit_stage(slide, s: SlideSpec, lab: str, stage: str) -> None:
    """Readable three-page edit sequence: source, commands, then consumer."""
    header(slide, s)
    backup, before, after, consumer, unique = _edit_contract(lab)
    text_box(slide, 0.82, 1.16, 11.58, 0.34, "package-relative file：lora-energy-lab/student_policy.py", 22,
             bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name=f"Edit {lab} package path", italic_code=False, margins=(0.01, 0.0, 0.01, 0.0))
    if stage in {"path", "before", "after"}:
        # Lab B has five marker/code lines.  Showing BEFORE and AFTER in the
        # same 1.62-inch cards made the marker lines collide at original
        # size, so the source stage intentionally uses one full-height card
        # per page.  The companion page keeps the exact after block equally
        # editable and legible.
        if stage == "after":
            heading, code, fill, line_color, name = "AFTER｜完整 marked block", after, PALE_TEAL, TEAL, "after"
        else:
            heading, code, fill, line_color, name = "BEFORE｜完整 marked block", before, PALE_PURPLE, PURPLE, "before"
        _code_block(slide, 0.72, 1.58, 11.90, 3.64, heading, code,
                    fill=fill, line_color=line_color, name=f"Edit {lab} staged {name}")
        if stage == "after":
            band(slide, unique, y=5.34, fill=PALE_GOLD, color=PURPLE, size=20, height=0.70)
        else:
            band(slide, "baseline bytes：保留完整 marker；下一頁只看唯一 edit 的 AFTER block。", y=5.34,
                 fill=PALE_GOLD, color=PURPLE, size=20, height=0.70)
    elif stage == "commands":
        posix = (
            f"cp student_policy.py {backup}\n"
            "編輯器範例：nano student_policy.py\n"
            ".venv/bin/python -m py_compile student_policy.py"
        )
        powershell = (
            f"Copy-Item student_policy.py -Destination {backup}\n"
            "編輯器範例：notepad .\\student_policy.py\n"
            ".\\.venv\\Scripts\\python.exe -m py_compile student_policy.py"
        )
        _code_block(slide, 0.72, 1.58, 5.82, 3.72, "WSL / POSIX exact", posix,
                    fill=CREAM, line_color=NAVY, name=f"Edit {lab} staged WSL commands")
        _code_block(slide, 6.80, 1.58, 5.82, 3.72, "Windows PowerShell exact", powershell,
                    fill=CREAM, line_color=NAVY, name=f"Edit {lab} staged PowerShell commands")
        band(slide, "順序：backup → 開檔並修改 → py_compile；compile 只驗 syntax，尚未驗 marker、API、predecessor 或 result。", y=5.24, fill=PALE_GOLD, color=PURPLE, size=18, height=0.50)
    else:
        _code_block(slide, 0.72, 1.58, 11.90, 1.78, "MARKER 外 consumer／function boundary", consumer,
                    fill=PALE_BLUE, line_color=BLUE, name=f"Edit {lab} staged consumer")
        if lab == "A":
            interpretation = (
                "Why：PACE_GAP_STEPS = 2；gap action：SLEEP → WAIT。\n"
                "Expect：run 驗 marker／API／predecessor／packet／service／J。\n"
                "Interpret：result 判定 transition 與 endpoint energy。"
            )
        else:
            interpretation = (
                "Why：ENTER = 2、EXIT = 1；stable hold：2 → 1。\n"
                "Expect：engine 建立 MODE_CHANGE；較早 transition 不等於 service success。\n"
                "Interpret：result／replay 判定 service、deadline、freshness、J。"
            )
        band(slide, unique, y=3.62, fill=PALE_GOLD, color=PURPLE, size=20, height=0.70,
             name=f"Edit {lab} staged unique change")
        _code_block(slide, 0.72, 4.38, 11.90, 1.46, "WHY／EXPECT／INTERPRET", interpretation,
                    fill=PALE_TEAL, line_color=TEAL, name=f"Edit {lab} staged interpretation")
    boundary(slide, "POLICY SURFACE｜marked block only｜syntax guard before run")


def _command_lines(lab: str) -> list[tuple[str, str, str]]:
    if lab == "A":
        return [("1  BASELINE｜基線", "bash course.sh run --lab A --case baseline", ".\\course.cmd run --lab A --case baseline"),
                ("2  CANDIDATE｜候選", "bash course.sh run --lab A --case candidate --freeze", ".\\course.cmd run --lab A --case candidate --freeze"),
                ("3  HIDDEN｜邊界", "bash course.sh run --lab A --case hidden", ".\\course.cmd run --lab A --case hidden")]
    return [("1  TRACE A｜基線", "bash course.sh run --lab B --case trace-a-baseline", ".\\course.cmd run --lab B --case trace-a-baseline"),
            ("2  CANDIDATE｜候選", "bash course.sh run --lab B --case trace-a-candidate --freeze", ".\\course.cmd run --lab B --case trace-a-candidate --freeze"),
            ("3  TRACE B｜邊界", "bash course.sh run --lab B --case trace-b", ".\\course.cmd run --lab B --case trace-b")]


def draw_run(slide, s, lab: str):
    header(slide, s)
    # One complete command per row keeps every copy boundary runnable.  A
    # split command such as ``bash course.sh run`` plus ``--lab ...`` is not a
    # usable teaching instruction, so the rows intentionally trade ribbons
    # for width and retain 18 pt only for the exact command strings.
    stages = _command_lines(lab)
    palette = [("WSL / POSIX", BLUE, PALE_BLUE), ("Windows PowerShell", PURPLE, PALE_PURPLE)]
    box(slide, 0.72, 1.24, 11.90, 3.38, fill=CREAM, line=NAVY, radius=True, name=f"Exact run commands {lab}")
    text_box(slide, 0.94, 1.32, 11.46, 0.24, "逐行 copy boundary｜WSL / POSIX + Windows PowerShell", 20, bold=True,
             color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name=f"Run command OS heading {lab}", italic_code=False, margins=(0.01, 0.0, 0.01, 0.0))
    row = 0
    for idx, (head, posix, windows) in enumerate(stages):
        for os_label, short_os, command, (label, col, fill) in zip(("WSL / POSIX", "Windows PowerShell"), ("WSL", "PowerShell"), (posix, windows), palette):
            y = 1.64 + row * 0.44
            text_box(slide, 0.92, y, 2.66, 0.30, f"{head.split('｜')[0]} · {short_os}", 18, bold=True, color=col,
                     valign=MSO_ANCHOR.MIDDLE, name=f"Run row label {lab} {row}", italic_code=False,
                     margins=(0.01, 0.0, 0.01, 0.0))
            text_box(slide, 3.74, y, 9.00, 0.30, command, 18, color=INK,
                     valign=MSO_ANCHOR.MIDDLE, name=f"Run exact command {lab} {row}", italic_code=False,
                     margins=(0.01, 0.0, 0.01, 0.0))
            row += 1
    band(slide, "每一行都是獨立 copy boundary；結果欄位與 checkpoint 另頁讀取，避免 command 與 receipt 疊在一起。", y=4.86, fill=PALE_GOLD, color=PURPLE, size=18, height=0.50)
    boundary(slide, "RUN COMMANDS｜three exact cases｜SIMULATED")


def draw_run_receipt(slide, s, lab: str) -> None:
    header(slide, s)
    checkpoint = "lab-a-frozen" if lab == "A" else "lab-b-frozen"
    text_box(slide, 0.82, 1.16, 11.58, 0.34, "每次 run 先讀 stdout，再依 result_path 配對 result.json 與 endpoint-replay.json。", 22,
             bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE,
             name=f"Receipt {lab} lead", italic_code=False, margins=(0.01, 0.0, 0.01, 0.0))
    _code_block(slide, 0.72, 1.62, 11.90, 1.18, "stdout fields｜不顯示任何識別摘要值",
                "status（成功時 OK） · run_id · result_path · artifact_source · claim_boundary",
                fill=PALE_BLUE, line_color=BLUE, name=f"Receipt {lab} stdout fields")
    _code_block(slide, 0.72, 3.02, 11.90, 1.36, "artifact pair｜同一 run",
                "依 stdout result_path 開 artifacts/<run_id>/result.json\n"
                "再開同目錄 endpoint-replay.json；不猜檔名，不手改 JSON",
                fill=PALE_TEAL, line_color=TEAL, name=f"Receipt {lab} artifact pair")
    _code_block(slide, 0.72, 4.60, 11.90, 0.78, "candidate freeze checkpoint",
                f"artifacts/checkpoints/{checkpoint}.{{json,py}}",
                fill=PALE_GOLD, line_color=GOLD, name=f"Receipt {lab} checkpoint")
    boundary(slide, "RUN RECEIPT｜stdout → result → replay → freeze gate")


def draw_compare(slide, s, lab: str):
    header(slide, s)
    if lab == "A":
        pairs = [("BASELINE", "baseline-A", BLUE, PALE_BLUE), ("CANDIDATE", "candidate-A", PURPLE, PALE_PURPLE)]
    else:
        pairs = [("TRACE A BASELINE", "trace-a-baseline-B", BLUE, PALE_BLUE), ("TRACE A CANDIDATE", "trace-a-candidate-B", PURPLE, PALE_PURPLE)]
    for i, (label, case, col, fill) in enumerate(pairs):
        x = 0.80 + i * 6.04
        body = summary_text(case)
        if lab == "B":
            body += f"\nactive_s = {FALLBACK[case]['active']}"
        card_text(slide, x, 1.18, 5.58, 4.18, label, body, fill=fill, line_color=col, body_size=20, heading_size=20, name=f"Compare {label}")
    line(slide, 6.46, 2.74, 6.86, 2.74, color=GOLD, width=1.8, arrow=True, name="Compare gate")
    band(slide, "先比對 scenario／policy／scope，再解讀 service verdict、delivery、transition 與 endpoint J。", y=5.50, fill=PALE_GOLD, color=PURPLE, size=20, height=0.52)
    boundary(slide)


def draw_ledger(slide, s):
    header(slide, s)
    text_box(slide, 0.92, 1.18, 11.42, 0.36, "candidate events 與 energy_breakdown_j：沿 state interval 找機制。", 20, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Ledger lead")
    rows = [("awake_idle（清醒閒置）", 6.00, TEAL), ("sleep（低功耗）", 0.04, BLUE), ("wake（喚醒）", 0.02, GOLD), ("process（處理）", 0.16, PURPLE), ("tx（送出）", 2.40, RED), ("rx（接收）", 0.24, NAVY)]
    for i, (label, value, col) in enumerate(rows):
        y = 1.82 + i * 0.50
        text_box(slide, 0.96, y + 0.02, 1.78, 0.42, label, 20, bold=True, color=col, name=f"Ledger label {label}", italic_code=False, margins=(0.01, 0.0, 0.01, 0.0))
        width = 0.62 + min(7.30, value * 0.82)
        box(slide, 2.90, y, width, 0.38, fill=PALE_TEAL if label == "awake_idle" else PALE_BLUE, line=col, radius=False, name=f"Ledger bar {label}")
        text_box(slide, 10.36, y + 0.08, 1.18, 0.28, f"{value:.2f} J", 20, color=INK, align=PP_ALIGN.RIGHT, name=f"Ledger value {label}", italic_code=False, margins=(0.01, 0.0, 0.01, 0.0))
    band(slide, "same-scenario-fallback reference｜awake_idle=6.00、sleep=0.04、wake=0.02、process=0.16、tx=2.40、rx=0.24 J。", y=5.00, fill=PALE_GOLD, color=PURPLE, size=20, height=0.50)
    boundary(slide)


def draw_packet_service(slide, s, lab: str):
    header(slide, s)
    if lab == "A":
        case = "candidate-A"
        d, attempted, retries, expired = FALLBACK[case], 2, 1, 3
        lead = "A CANDIDATE｜WAIT edit → packet ledger → service"
    else:
        case = "trace-a-candidate-B"
        d, attempted, retries, expired = FALLBACK[case], 4, 1, 1
        lead = "B TRACE A CANDIDATE｜MODE_CHANGE → packet ledger → service"
    card_text(slide, 0.82, 1.18, 5.42, 3.74, "PACKET LEDGER", f"attempted（嘗試次數） {attempted}\nretransmissions（重傳次數） {retries}\ndelivered_bits（交付資料） {d['delivered']} bit\nexpired_packets（逾時封包） {expired}\nsummary.freshness_status = {d['freshness']}\nsummary.endpoint_energy_j = {d['energy']} J\nsummary.efficiency = {d['eff']} bit/J\nwake = {d['wake']}", fill=PALE_BLUE, line_color=BLUE, body_size=20, heading_size=20, name=f"Packet service {lab} ledger")
    card_text(slide, 6.70, 1.18, 5.42, 3.74, "SERVICE VERDICT", f"summary.service_pass = {d['service']}\nsummary.deadline_pass = {d['deadline']}\nrequired packet 與 deadline 共同定義 service\nSEND 次數不具交付欄位\n來源：{fallback_label()}", fill=PALE_GOLD, line_color=GOLD, body_size=20, heading_size=20, name=f"Packet service {lab} verdict")
    line(slide, 6.34, 3.02, 6.64, 3.02, color=GOLD, width=1.8, arrow=True, name="Packet to service")
    band(slide, s.mechanism, y=5.18, fill=CREAM, color=NAVY, size=20, height=0.56)
    boundary(slide)


def draw_freeze(slide, s, lab: str):
    header(slide, s)
    if lab == "A":
        nodes = [("baseline", BLUE, PALE_BLUE), ("candidate + freeze", PURPLE, PALE_PURPLE), ("hidden entry", TEAL, PALE_TEAL)]
    else:
        nodes = [("A frozen predecessor", BLUE, PALE_BLUE), ("B candidate + freeze", PURPLE, PALE_PURPLE), ("Trace B entry", TEAL, PALE_TEAL)]
    x = 0.72
    for i, (label, col, fill) in enumerate(nodes):
        card_text(slide, x, 1.48, 3.84, 1.18, label, "", fill=fill, line_color=col, body_size=18, heading_size=19, name=f"Freeze {lab} {i}")
        if i < 2:
            line(slide, x + 3.84, 2.07, x + 4.04, 2.07, color=GOLD, width=1.7, arrow=True, name="Freeze lineage arrow")
        x += 4.12
    fields = "policy identity（策略識別） · predecessor identity（前序） · active_block_id（修改區塊）\nscenario_id（情境識別） · seed role（種子角色） · receipt identity（收據識別）"
    box(slide, 1.08, 3.18, 10.98, 1.38, fill=CREAM, line=GOLD, name="Freeze fields")
    text_box(slide, 1.32, 3.48, 10.50, 0.76, fields, 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Freeze fields text")
    band(slide, "receipt／checkpoint／identity 缺失 → withheld 執行資格暫停；新 result_path 待取得 current evidence。", y=4.90, fill=PALE_RED, color=RED, size=19)
    boundary(slide, "FREEZE GATE｜missing receipt / checkpoint = stop before withheld")


def draw_withheld(slide, s, lab: str):
    header(slide, s)
    if lab == "A":
        case = "hidden-A"
        trace = "hidden contact／traffic\nfrozen policy identity\n不再修改 policy"
    else:
        case = "trace-b-B"
        trace = f"Trace B quality／window\nMODE_CHANGE：REST → SEND_READY，t = 110 s\nactive_s = 8\n不再調參；維持 B frozen policy"
    card_text(slide, 0.82, 1.18, 5.42, 4.18, "FROZEN POLICY", "candidate checkpoint（候選快照）\n新 freeze：0；policy edit：0\nstdout result_path（來源）\n同 run replay（事件重播）\nTrace B：withheld，不再調參", fill=PALE_BLUE, line_color=BLUE, body_size=20, heading_size=20, name=f"Withheld {lab} frozen")
    card_text(slide, 6.70, 1.18, 5.42, 4.18, "WITHHELD EVIDENCE", f"{trace}\n{summary_text(case)}\nclaim ceiling shrinks", fill=PALE_GOLD, line_color=GOLD, body_size=20, heading_size=20, name=f"Withheld {lab} result")
    line(slide, 6.34, 3.08, 6.64, 3.08, color=GOLD, width=1.8, arrow=True, name="Withheld arrow")
    band(slide, "withheld 方向不同時，保留適用條件限制；Trace B 更快 transition 仍不等於 service success。", y=5.50, fill=CREAM, color=NAVY, size=18, height=0.52)
    boundary(slide, "WITHHELD｜frozen policy identity unchanged｜SIMULATED")


def draw_withheld_overview(slide, s, lab: str):
    header(slide, s)
    if lab == "A":
        trace = "hidden contact／traffic\nfrozen policy identity\nREST_DURING_GAP = WAIT\n不再修改 policy"
        title = "A HIDDEN｜frozen policy setup"
    else:
        trace = "Trace B quality／window\nMODE_CHANGE：REST → SEND_READY，t = 110 s\nactive_s = 8\n不再調參；維持 B frozen policy"
        title = "B TRACE B｜frozen policy setup"
    card_text(slide, 0.82, 1.32, 5.42, 3.72, "FROZEN POLICY", "candidate checkpoint（候選快照）\n新 freeze：0；policy edit：0\nstdout result_path（來源）\n同 run replay（事件重播）\nwithheld：不再調參", fill=PALE_BLUE, line_color=BLUE, body_size=20, heading_size=20, name=f"Withheld {lab} staged frozen")
    card_text(slide, 6.70, 1.32, 5.42, 3.72, title, trace, fill=PALE_TEAL, line_color=TEAL, body_size=20, heading_size=20, name=f"Withheld {lab} staged trace")
    band(slide, "先保持 policy identity 不變，再讀下一頁 same-scenario-fallback reference summary；Trace B 不再 retune。", y=5.32, fill=PALE_GOLD, color=PURPLE, size=18, height=0.50)
    boundary(slide, "WITHHELD SETUP｜frozen policy identity unchanged｜SIMULATED")


def draw_withheld_result(slide, s, lab: str):
    header(slide, s)
    case = "hidden-A" if lab == "A" else "trace-b-B"
    title = "HIDDEN RESULT｜applicability limit" if lab == "A" else "TRACE B RESULT｜applicability limit"
    card_text(slide, 0.82, 1.34, 11.58, 3.72, title, summary_text(case), fill=PALE_GOLD, line_color=GOLD, body_size=20, heading_size=20, name=f"Withheld {lab} staged result")
    if lab == "A":
        sentence = "hidden：energy 3.61 J、delivered_bits 0、wake 0、attempt 0、retry 0、expired 3、service_pass FAIL；claim ceiling shrinks。"
    else:
        sentence = "Trace B：MODE_CHANGE 較快不等於 service success；energy 5.43 J、delivered_bits 4,800、expired 2、service_pass FAIL。"
    band(slide, sentence, y=5.32, fill=CREAM, color=NAVY, size=18, height=0.50)
    boundary(slide, "WITHHELD RESULT｜same-scenario-fallback reference｜not a fresh run")


def draw_debrief(slide, s, lab: str):
    header(slide, s)
    labels = [("CONDITION 條件", BLUE, PALE_BLUE), ("MECHANISM 機制", PURPLE, PALE_PURPLE), ("EVIDENCE 證據", TEAL, PALE_TEAL), ("CLAIM CEILING 邊界", GOLD, PALE_GOLD)]
    x = 0.64
    for i, (label, col, fill) in enumerate(labels):
        box(slide, x, 1.48, 2.76, 0.92, fill=fill, line=col, name=f"Debrief {lab} {label}")
        text_box(slide, x + 0.10, 1.64, 2.56, 0.56, label, 18, bold=True, color=col, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Debrief {label}", italic_code=False, margins=(0.01, 0.0, 0.01, 0.0))
        if i < 3:
            line(slide, x + 2.76, 1.94, x + 2.98, 1.94, color=NAVY, width=1.4, arrow=True, name="Debrief arrow")
        x += 3.08
    if lab == "A":
        sentence = "在 primary trace，WAIT 改變 state ledger；packet／service 與 J 一起判讀；hidden 決定適用範圍。"
    else:
        sentence = "在 Trace A，hold=1 可能增加 delivered；在 Trace B，window／traffic 暴露邊界；hysteresis 是條件。"
    card_text(slide, 1.02, 2.96, 11.14, 1.48, "CAUSAL SENTENCE 因果句", sentence, fill=CREAM, line_color=GOLD, body_size=22, heading_size=19, name=f"Debrief {lab} sentence")
    band(slide, "結論包含 state／transition、packet／service evidence 與適用條件；J 維持為單一欄位。", y=4.76, size=19)
    boundary(slide)


def draw_enter(slide, s):
    header(slide, s)
    text_box(slide, 1.00, 1.18, 11.28, 0.36, "切換條件：quality band ≥ 2 且 stable_steps ≥ 2 → send-ready。", 22, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Enter lead")
    for i, q in enumerate((0, 1, 2, 3)):
        y = 3.98 - i * 0.60
        col = BLUE if q < 2 else TEAL
        box(slide, 2.02, y, 3.04, 0.46, fill=PALE_BLUE if q < 2 else PALE_TEAL, line=col, radius=False, name=f"Quality level {q}")
        text_box(slide, 2.16, y + 0.10, 2.76, 0.24, f"quality {q}", 20, bold=True, color=col, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Quality level {q} label", italic_code=False, margins=(0.01, 0.0, 0.01, 0.0))
    line(slide, 5.10, 2.38, 8.02, 2.38, color=TEAL, width=2.0, arrow=True, name="Enter threshold")
    card_text(slide, 8.24, 1.66, 3.70, 2.18, "ENTER GATE 進入條件", "ENTER_QUALITY（進入）= 2\nSTABLE_STEPS（穩定）= 2\n→ SEND_READY（可送）", fill=PALE_TEAL, line_color=TEAL, body_size=19, heading_size=18, name="Enter gate")
    band(slide, "threshold 是 decision gate；transition 時機會改變 queue／attempt／deadline。", y=4.90, size=19)
    boundary(slide)


def draw_exit(slide, s):
    header(slide, s)
    text_box(slide, 1.00, 1.18, 11.28, 0.36, "enter 與 exit 分離；已進入 mode 遇到單一低點時維持狀態。", 22, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Exit lead")
    line(slide, 1.30, 2.38, 11.62, 2.38, color=TEAL, width=2.0, name="Enter line")
    line(slide, 1.30, 4.02, 11.62, 4.02, color=PURPLE, width=2.0, name="Exit line")
    text_box(slide, 1.34, 1.96, 2.48, 0.28, "ENTER ≥ 2", 20, bold=True, color=TEAL, name="Enter threshold label", italic_code=False)
    text_box(slide, 1.34, 3.60, 2.48, 0.28, "EXIT < 1", 20, bold=True, color=PURPLE, name="Exit threshold label", italic_code=False)
    card_text(slide, 4.24, 2.70, 4.72, 1.24, "HYSTERESIS BAND", "quality 1：保持 send-ready\nquality < 1：退出", fill=PALE_GOLD, line_color=GOLD, body_size=21, heading_size=19, name="Hysteresis band")
    band(slide, "hysteresis 可能減少 ping-pong；仍要用 transition、retry、service、J 驗證。", y=4.96, size=19, height=0.56)
    boundary(slide)


def draw_stable(slide, s):
    header(slide, s)
    text_box(slide, 0.96, 1.18, 11.36, 0.36, "短 hold 改變 transition timing；長 hold 增加穩定條件；service window 定義 outcome。", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Stable lead")
    card_text(slide, 0.90, 1.78, 5.44, 2.52, "短暫 SPIKE", "student_policy.py branch 讀 quality_band／stable_steps\nstep 1：單步觀察\nSTABLE_STEPS=2（穩定步數）→ hold\n不直接產生 MODE_CHANGE", fill=PALE_BLUE, line_color=BLUE, body_size=18, heading_size=19, name="Stable spike")
    card_text(slide, 6.80, 1.78, 5.44, 2.52, "連續穩定", "lora_energy_lab/engine.py 每個 clock step 讀 global\nstep 1 → step 2\nSTABLE_STEPS=2 → MODE_CHANGE\nsend_mode_active → true", fill=PALE_TEAL, line_color=TEAL, body_size=18, heading_size=19, name="Stable hold")
    line(slide, 6.38, 3.04, 6.72, 3.04, color=GOLD, width=1.8, arrow=True, name="Stable comparison")
    band(slide, "candidate 唯一修改：STABLE_STEPS = 2 → 1；Prediction 定位 MODE_CHANGE，再讀 packet／service／J。", y=4.72, size=18, height=0.56)
    boundary(slide)


def draw_prediction(slide, s):
    header(slide, s)
    text_box(slide, 0.98, 1.18, 11.34, 0.36, "Trace A 標示 enter、hold、exit；MODE_CHANGE 與 service evidence 對 prediction 形成支持或反駁。", 20, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Prediction lead")
    line(slide, 1.08, 2.54, 11.72, 2.54, color=NAVY, width=1.8, name="Trace axis")
    pts = [(1.22, 3.50), (2.42, 3.34), (3.54, 2.86), (4.66, 2.30), (5.78, 2.54), (6.90, 2.20), (8.02, 2.32), (9.14, 3.12), (10.28, 3.34), (11.40, 3.54)]
    for a, b in zip(pts, pts[1:]):
        line(slide, a[0], a[1], b[0], b[1], color=TEAL, width=2.0, name="Trace A quality")
    for x, y in pts:
        dot(slide, x - 0.07, y - 0.07, 0.14, fill=TEAL, name="Trace point")
    for x, label in ((4.66, "enter?"), (6.90, "hold?"), (9.14, "exit?")):
        box(slide, x - 0.46, 3.88, 0.92, 0.42, fill=PALE_GOLD, line=GOLD, radius=False, name=f"Prediction marker {label}")
        text_box(slide, x - 0.40, 3.96, 0.80, 0.22, label, 18, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Prediction marker {label} text", italic_code=False, margins=(0.01, 0.0, 0.01, 0.0))
    band(slide, "enter（進入 step）：____；hold（穩定步數）：____；exit（quality 閾值）：____；service／J：____ 因為 ____。", y=4.76, size=18, height=0.56)
    boundary(slide)


def draw_transition(slide, s):
    header(slide, s)
    text_box(slide, 0.96, 1.18, 11.36, 0.36, "品質是 observation context；MODE_CHANGE transition 把 action 接到 packet outcome。", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Transition lead")
    stages = [("quality band 品質帶", "observation context", BLUE, PALE_BLUE), ("MODE_CHANGE 模式", "action state event", PURPLE, PALE_PURPLE), ("PACKET_ATTEMPT", "封包嘗試 input", GOLD, PALE_GOLD), ("service / J", "服務 verdict + endpoint energy", TEAL, PALE_TEAL)]
    x = 0.72
    for i, (label, desc, col, fill) in enumerate(stages):
        card_text(slide, x, 1.80, 2.78, 1.20, label, desc, fill=fill, line_color=col, body_size=18, heading_size=18, name=f"Transition {label}")
        if i < 3:
            line(slide, x + 2.78, 2.40, x + 2.98, 2.40, color=NAVY, width=1.5, arrow=True, name="Transition arrow")
        x += 3.04
    card_text(slide, 0.92, 3.30, 5.40, 2.46, "TRACE A CANDIDATE", "POLICY_DECISION：quality_band=2 · stable_steps=1\nMODE_CHANGE：REST → SEND_READY，t = 20 s\nMODE_CHANGE：SEND_READY → REST，t = 80 s\nMODE_CHANGE：REST → SEND_READY，t = 110 s\nactive_s = 16 · wake = 1 · attempt = 4 · retry = 1 · expired = 1", fill=PALE_BLUE, line_color=BLUE, body_size=20, heading_size=20, name="Transition metrics")
    card_text(slide, 6.72, 3.30, 5.40, 2.46, "INTERPRET", "delivered_bits = 9,600 bit · endpoint_energy_j = 10.66 J\nefficiency = 900.562852 bit/J\nservice_pass = FAIL · deadline_pass = FAIL · freshness_status = expired\n較快 transition ≠ service success；engine.py emits MODE_CHANGE\nstudent_policy.py branch consumes quality／stable_steps", fill=PALE_GOLD, line_color=GOLD, body_size=20, heading_size=20, name="Transition interpret")
    boundary(slide)


def draw_transition_overview(slide, s):
    header(slide, s)
    text_box(slide, 0.96, 1.18, 11.36, 0.36, "品質是 observation context；engine 的 MODE_CHANGE 才把 action 接到 packet outcome。", 20,
             bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Transition overview lead")
    stages = [("quality band 品質帶", "observation context", BLUE, PALE_BLUE), ("MODE_CHANGE 模式", "engine event", PURPLE, PALE_PURPLE), ("PACKET_ATTEMPT", "封包嘗試 input", GOLD, PALE_GOLD), ("service / J", "verdict + endpoint energy", TEAL, PALE_TEAL)]
    x = 0.72
    for i, (label, desc, col, fill) in enumerate(stages):
        card_text(slide, x, 1.82, 2.78, 1.26, label, desc, fill=fill, line_color=col, body_size=20, heading_size=20, name=f"Transition overview {label}")
        if i < 3:
            line(slide, x + 2.78, 2.45, x + 2.98, 2.45, color=NAVY, width=1.5, arrow=True, name="Transition overview arrow")
        x += 3.04
    _code_block(slide, 0.72, 3.48, 11.90, 1.62, "CAUSAL ORDER｜從 observation 到 claim",
                "policy branch consumes quality／stable_steps\n"
                "engine.py reads the global each clock step and creates MODE_CHANGE\n"
                "MODE_CHANGE → packet attempt → delivered／expired → service + endpoint J",
                fill=CREAM, line_color=NAVY, name="Transition overview causal order")
    band(slide, "較快 transition 只是一個 mechanism observation；service_pass、deadline_pass、freshness_status 與 endpoint J 仍要從 result 讀。", y=5.30, fill=PALE_GOLD, color=PURPLE, size=18, height=0.50)
    boundary(slide)


def draw_transition_evidence(slide, s):
    header(slide, s)
    text_box(slide, 0.90, 1.16, 11.40, 0.34, "Trace A candidate：完整 MODE_CHANGE、packet 與 service evidence。", 22,
             bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Transition evidence lead")
    _code_block(slide, 0.72, 1.62, 11.90, 2.10, "POLICY_DECISION + MODE_CHANGE",
                "quality_band = 2 · stable_steps = 1\n"
                "REST → SEND_READY，t = 20 s\n"
                "SEND_READY → REST，t = 80 s\n"
                "REST → SEND_READY，t = 110 s\n"
                "active_s = 16 · wake = 1 · attempt = 4 · retry = 1 · expired = 1",
                fill=PALE_BLUE, line_color=BLUE, name="Transition evidence mode changes")
    _code_block(slide, 0.72, 3.98, 11.90, 1.34, "PACKET / SERVICE / ENERGY",
                "delivered_bits = 9,600 bit · endpoint_energy_j = 10.66 J · efficiency = 900.562852 bit/J\n"
                "service_pass = FAIL · deadline_pass = FAIL · freshness_status = expired",
                fill=PALE_GOLD, line_color=GOLD, name="Transition evidence result fields")
    band(slide, "engine.py emits MODE_CHANGE；student_policy.py branch consumes quality／stable_steps；較快 transition ≠ service success。", y=5.44, fill=CREAM, color=NAVY, size=18, height=0.50)
    boundary(slide, "TRANSITION EVIDENCE｜MODE_CHANGE → packet → service/J")


def draw_counter(slide, s):
    header(slide, s)
    card_text(slide, 0.92, 1.28, 5.34, 3.30, "TOO-SLOW", "hold 太久\n→ send-ready 太晚\n→ contact window 用完\n→ deadline／service loss", fill=PALE_RED, line_color=RED, body_size=22, heading_size=20, name="Too slow")
    card_text(slide, 6.78, 1.28, 5.34, 3.30, "PING-PONG", "enter／exit 太近\n→ 多次 MODE_CHANGE\n→ retry／額外 transition\n→ energy trade-off", fill=PALE_GOLD, line_color=GOLD, body_size=22, heading_size=20, name="Ping pong")
    line(slide, 6.36, 2.98, 6.66, 2.98, color=NAVY, width=1.8, arrow=True, name="Failure comparison")
    band(slide, "機制判定依據：MODE_CHANGE、packet outcome、service verdict 與 endpoint ledger；平滑 quality 線維持為 context。", y=4.88, size=18, height=0.56)
    boundary(slide)


def draw_recovery(slide, s):
    header(slide, s)
    text_box(slide, 0.88, 1.18, 11.56, 0.36, "先讀 status，再用支援的 restore checkpoint；新 run 會產生新的 stdout path。", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Recovery lead")
    nodes = [("A frozen", "course.* restore\n--checkpoint lab-a-frozen", BLUE, PALE_BLUE), ("B frozen", "course.* restore\n--checkpoint lab-b-frozen", PURPLE, PALE_PURPLE), ("release default", "course.* restore\n--checkpoint release-default", TEAL, PALE_TEAL)]
    for i, (lab, path, col, fill) in enumerate(nodes):
        x = 0.84 + i * 4.16
        card_text(slide, x, 1.76, 3.68, 1.32, lab, path, fill=fill, line_color=col, body_size=20, heading_size=20, name=f"Recovery node {lab}")
    card_text(slide, 0.84, 3.34, 5.54, 1.86, "WSL / POSIX", "bash course.sh status\nbash course.sh restore --checkpoint lab-a-frozen\nbash course.sh restore --checkpoint lab-b-frozen\nbash course.sh restore --checkpoint release-default", fill=CREAM, line_color=NAVY, body_size=20, heading_size=20, name="Recovery WSL")
    card_text(slide, 6.96, 3.34, 5.54, 1.86, "WINDOWS POWERSHELL", ".\\course.cmd status\n.\\course.cmd restore --checkpoint lab-a-frozen\n.\\course.cmd restore --checkpoint lab-b-frozen\n.\\course.cmd restore --checkpoint release-default", fill=CREAM, line_color=NAVY, body_size=20, heading_size=20, name="Recovery PowerShell")
    band(slide, "result／replay 遺失：先回 identity 正確的 checkpoint，再重跑 exact case；JSON 維持原始內容。", y=5.52, size=18, height=0.50)
    boundary(slide, "RECOVERY CONTRACT｜restore → compile → exact rerun → new stdout result_path")


def draw_recovery_overview(slide, s):
    header(slide, s)
    text_box(slide, 0.88, 1.18, 11.56, 0.36, "先讀 status，再選支援的 checkpoint；restore 只恢復 policy lineage，不恢復遺失的 result。", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Recovery overview lead")
    nodes = [("A frozen", "lab-a-frozen", BLUE, PALE_BLUE), ("B frozen", "lab-b-frozen", PURPLE, PALE_PURPLE), ("release default", "release-default", TEAL, PALE_TEAL)]
    for i, (lab, checkpoint, col, fill) in enumerate(nodes):
        x = 0.84 + i * 4.16
        card_text(slide, x, 1.78, 3.68, 1.46, lab, f"course.* restore\n--checkpoint {checkpoint}", fill=fill, line_color=col, body_size=20, heading_size=20, name=f"Recovery overview {lab}")
    _code_block(slide, 0.84, 3.62, 11.38, 1.42, "RECOVERY ORDER",
                "course.* status → course.* restore --checkpoint <supported-name> → compile → exact rerun\n"
                "新的 stdout result_path 與同 run endpoint-replay.json 才能形成新 evidence",
                fill=CREAM, line_color=NAVY, name="Recovery overview order")
    band(slide, "支援名稱只有 lab-a-frozen、lab-b-frozen、release-default；不使用不存在的 policy／checkpoint 檔名。", y=5.34, fill=PALE_GOLD, color=PURPLE, size=18, height=0.50)
    boundary(slide, "RECOVERY OVERVIEW｜status → restore → compile → exact rerun")


def draw_recovery_commands(slide, s):
    header(slide, s)
    text_box(slide, 0.88, 1.16, 11.56, 0.36, "P062 exact commands：Windows PowerShell 與 WSL / POSIX 分開保留。", 22, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Recovery command lead")
    _code_block(slide, 0.72, 1.62, 11.90, 2.10, "WSL / POSIX",
                "bash course.sh status\n"
                "bash course.sh restore --checkpoint lab-a-frozen\n"
                "bash course.sh restore --checkpoint lab-b-frozen\n"
                "bash course.sh restore --checkpoint release-default",
                fill=PALE_BLUE, line_color=BLUE, name="Recovery exact WSL")
    _code_block(slide, 0.72, 3.98, 11.90, 2.10, "Windows PowerShell",
                ".\\course.cmd status\n"
                ".\\course.cmd restore --checkpoint lab-a-frozen\n"
                ".\\course.cmd restore --checkpoint lab-b-frozen\n"
                ".\\course.cmd restore --checkpoint release-default",
                fill=PALE_TEAL, line_color=TEAL, name="Recovery exact PowerShell")
    boundary(slide, "RECOVERY COMMANDS｜supported checkpoint names only")


def draw_bridge(slide, s):
    header(slide, s)
    text_box(slide, 0.92, 1.18, 11.50, 0.52, "LoRa 實驗結果工作台：`證據` tab 只驗證 result.json；`進度備份` tab 保留本機 controls。\nstudent_policy.py 留在 runner；目前 accepted replay 為 none。", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Bridge lead")
    nodes = [("RUNNER 執行器", "stdout\nresult_path（結果路徑）", BLUE, PALE_BLUE), ("證據 Evidence tab", "only result.json\nschema／identity／units", PURPLE, PALE_PURPLE), ("REPLAY 狀態", "endpoint-replay.json\n目前 accepted replay：none", TEAL, PALE_TEAL), ("進度備份 Progress backup", "local controls\n目前未接受匯入", GOLD, PALE_GOLD)]
    x = 0.62
    for i, (lab, body, col, fill) in enumerate(nodes):
        card_text(slide, x, 1.94, 2.82, 1.42, lab, body, fill=fill, line_color=col, body_size=18, heading_size=18, name=f"Bridge {lab}")
        if i < 3:
            line(slide, x + 2.82, 2.65, x + 3.00, 2.65, color=NAVY, width=1.5, arrow=True, name="Bridge arrow")
        x += 3.06
    box(slide, 1.06, 3.52, 10.98, 0.50, fill=PALE_GOLD, line=GOLD, radius=True, name="Course entry URL")
    text_box(slide, 1.24, 3.61, 10.62, 0.28, "完整入口：http://120.126.151.102:3000/course", 20, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Course entry URL text", italic_code=False, margins=(0.01, 0.0, 0.01, 0.0))
    box(slide, 1.06, 4.16, 10.98, 0.96, fill=CREAM, line=GOLD, radius=True, name="Bridge rule")
    text_box(slide, 1.24, 4.31, 10.62, 0.58, "只選 stdout 指出的 result.json；目前不把 endpoint-replay.json 說成 browser accepted。\nidentity／schema／units 不一致 → fail closed。", 19, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Bridge rule text", margins=(0.01, 0.0, 0.01, 0.0))
    band(slide, "目前畫面僅確認空白狀態；未提供成功匯入、現場量測或 canonical parity 證據。", y=5.28, size=20, height=0.70)
    boundary(slide)


def compose(slide, s: SlideSpec) -> None:
    clear_placeholders(slide)
    if s.kind == "states": draw_states(slide, s)
    elif s.kind == "challenge": draw_challenge(slide, s, "A")
    elif s.kind == "packet": draw_packet(slide, s)
    elif s.kind == "gate": draw_gate(slide, s)
    elif s.kind == "power": draw_power(slide, s)
    elif s.kind == "formula-energy": draw_formula(slide, s, "E_endpoint")
    elif s.kind == "formula-eff": draw_formula(slide, s, "eta_E")
    elif s.kind == "layers": draw_layers(slide, s)
    elif s.kind == "identity": draw_identity(slide, s)
    elif s.kind == "control": draw_control(slide, s)
    elif s.kind == "window": draw_window(slide, s)
    elif s.kind == "lab-a-hero": draw_lab_hero(slide, s, "A")
    elif s.kind == "baseline-a": draw_baseline(slide, s, "A")
    elif s.kind == "baseline-a-result": draw_baseline_result(slide, s, "A")
    elif s.kind == "edit-a": draw_edit_stage(slide, s, "A", "before")
    elif s.kind == "edit-a-after": draw_edit_stage(slide, s, "A", "after")
    elif s.kind == "edit-a-commands": draw_edit_stage(slide, s, "A", "commands")
    elif s.kind == "edit-a-consumer": draw_edit_stage(slide, s, "A", "consumer")
    elif s.kind == "run-a": draw_run(slide, s, "A")
    elif s.kind == "receipt-a": draw_run_receipt(slide, s, "A")
    elif s.kind == "compare-a": draw_compare(slide, s, "A")
    elif s.kind == "ledger-a": draw_ledger(slide, s)
    elif s.kind == "packet-a": draw_packet_service(slide, s, "A")
    elif s.kind == "freeze-a": draw_freeze(slide, s, "A")
    elif s.kind == "withheld-a": draw_withheld_overview(slide, s, "A")
    elif s.kind == "withheld-a-result": draw_withheld_result(slide, s, "A")
    elif s.kind == "debrief-a": draw_debrief(slide, s, "A")
    elif s.kind == "lab-b-hero": draw_lab_hero(slide, s, "B")
    elif s.kind == "enter-b": draw_enter(slide, s)
    elif s.kind == "exit-b": draw_exit(slide, s)
    elif s.kind == "stable-b": draw_stable(slide, s)
    elif s.kind == "prediction-b": draw_prediction(slide, s)
    elif s.kind == "baseline-b": draw_baseline(slide, s, "B")
    elif s.kind == "baseline-b-result": draw_baseline_result(slide, s, "B")
    elif s.kind == "edit-b": draw_edit_stage(slide, s, "B", "before")
    elif s.kind == "edit-b-after": draw_edit_stage(slide, s, "B", "after")
    elif s.kind == "edit-b-commands": draw_edit_stage(slide, s, "B", "commands")
    elif s.kind == "edit-b-consumer": draw_edit_stage(slide, s, "B", "consumer")
    elif s.kind == "run-b": draw_run(slide, s, "B")
    elif s.kind == "receipt-b": draw_run_receipt(slide, s, "B")
    elif s.kind == "transition-b": draw_transition_overview(slide, s)
    elif s.kind == "transition-b-evidence": draw_transition_evidence(slide, s)
    elif s.kind == "freeze-b": draw_freeze(slide, s, "B")
    elif s.kind == "withheld-b": draw_withheld_overview(slide, s, "B")
    elif s.kind == "withheld-b-result": draw_withheld_result(slide, s, "B")
    elif s.kind == "counter-b": draw_counter(slide, s)
    elif s.kind == "debrief-b": draw_debrief(slide, s, "B")
    elif s.kind == "recovery": draw_recovery_overview(slide, s)
    elif s.kind == "recovery-commands": draw_recovery_commands(slide, s)
    elif s.kind == "bridge": draw_bridge(slide, s)
    else: raise ValueError(f"unknown slide kind {s.kind}")
    notes = spoken_notes(s)
    if FORBIDDEN in notes or MINUTE_RE.search(notes):
        raise ValueError(f"{page_label(s)}: forbidden notes content")
    slide.notes_slide.notes_text_frame.text = notes


def validate_pages() -> None:
    base_numbers = [p.number for p in PAGES if not p.suffix]
    if base_numbers != list(range(28, 64)):
        raise ValueError("Part B must contain base pages P028..P063 exactly once")
    suffixes = [page_label(p) for p in PAGES if p.suffix]
    if len(suffixes) != len(set(suffixes)):
        raise ValueError("suffix page labels must be unique")
    if [row["page"] for row in FIELD_AUDIT] != [f"P{i:03d}" for i in range(28, 64)]:
        raise ValueError("field audit must cover P028..P063 exactly once")
    for p in PAGES:
        text = " ".join(str(v) for v in asdict(p).values())
        if FORBIDDEN in text or MINUTE_RE.search(text):
            raise ValueError(f"{page_label(p)}: forbidden word or time label")
        hits = [term for term in LANGUAGE_BANNED if term in text]
        if hits:
            raise ValueError(f"{page_label(p)}: formal-language hits: {hits}")
        if not all((p.title, p.evidence, p.purpose, p.mechanism, p.expected, p.recovery, p.notes)):
            raise ValueError(f"{page_label(p)}: missing contract field")


def remove_all_slides(prs: Presentation) -> None:
    ids = prs.slides._sldIdLst
    for item in list(ids):
        prs.part.drop_rel(item.rId)
        ids.remove(item)


def overlay_template_parts(path: Path) -> None:
    with zipfile.ZipFile(TEMPLATE) as source, zipfile.ZipFile(path, "r") as old:
        data = {i.filename: old.read(i.filename) for i in old.infolist()}
        infos = {i.filename: copy.copy(i) for i in old.infolist()}
        for info in source.infolist():
            if info.filename.startswith(("ppt/slideLayouts/", "ppt/slideMasters/", "ppt/theme/", "ppt/media/", "ppt/notesMasters/")):
                data[info.filename] = source.read(info.filename); infos[info.filename] = copy.copy(info)
    temp = path.with_suffix(".overlay.pptx")
    with zipfile.ZipFile(temp, "w", zipfile.ZIP_DEFLATED) as out:
        for name, payload in data.items(): out.writestr(infos[name], payload)
    temp.replace(path)


def remove_formula_previews(path: Path) -> None:
    pns = "http://schemas.openxmlformats.org/presentationml/2006/main"
    with zipfile.ZipFile(path, "r") as archive:
        infos = [copy.copy(i) for i in archive.infolist()]
        data = {i.filename: archive.read(i.filename) for i in infos}
    for name in list(data):
        if not (name.startswith("ppt/slides/slide") and name.endswith(".xml")): continue
        root = ET.fromstring(data[name]); changed = False
        for parent in root.iter():
            for child in list(parent):
                if child.tag != f"{{{pns}}}sp": continue
                c = child.find(f"./{{{pns}}}nvSpPr/{{{pns}}}cNvPr")
                if c is not None and c.get("name", "").startswith("Formula preview fallback"):
                    parent.remove(child); changed = True
        if changed: data[name] = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    temp = path.with_suffix(".formula-clean.pptx")
    with zipfile.ZipFile(temp, "w", zipfile.ZIP_DEFLATED) as out:
        for info in infos: out.writestr(info, data[info.filename])
    temp.replace(path)


def enforce_native_math_font(path: Path) -> None:
    """Apply the explicit Times New Roman contract to native Office Math runs."""
    with zipfile.ZipFile(path, "r") as archive:
        infos = [copy.copy(info) for info in archive.infolist()]
        payloads = {info.filename: archive.read(info.filename) for info in infos}
    replacements = 0
    for slide_number in (6, 7):
        part = f"ppt/slides/slide{slide_number}.xml"
        before = payloads[part]
        after = before.replace(b'typeface="Cambria Math"', b'typeface="Times New Roman"')
        replacements += before.count(b'typeface="Cambria Math"')
        payloads[part] = after
    if replacements == 0:
        raise RuntimeError("native equation font normalization found no Cambria Math runs")
    if any(b'typeface="Cambria Math"' in payloads[f"ppt/slides/slide{number}.xml"] for number in (6, 7)):
        raise RuntimeError("native equation font normalization left a Cambria Math run")
    temp = path.with_suffix(".math-font.pptx")
    with zipfile.ZipFile(temp, "w", zipfile.ZIP_DEFLATED) as out:
        for info in infos:
            out.writestr(info, payloads[info.filename])
    temp.replace(path)


def insert_equations() -> list[dict[str, object]]:
    reports = []
    for slide, key in ((6, "E_endpoint"), (7, "eta_E")):
        temp = EXPORT.with_name(f".equation-{slide}.pptx")
        report = PROJECT / "validation" / f"equation-slide-{slide}.json"
        cmd = [sys.executable, str(EQUATION_TOOL), str(EXPORT), str(temp), "--logical-slide", str(slide), "--equation", key, "--report", str(report)]
        result = subprocess.run(cmd, cwd=str(ROOT), text=True, capture_output=True, timeout=90, check=False)
        reports.append({"slide": slide, "key": key, "returncode": result.returncode, "stdout": result.stdout[-800:], "stderr": result.stderr[-800:]})
        if result.returncode != 0 or not temp.exists():
            raise RuntimeError(f"native equation insertion failed on logical slide {slide}: {result.stderr[-500:]}")
        temp.replace(EXPORT)
    remove_formula_previews(EXPORT)
    enforce_native_math_font(EXPORT)
    return reports


def ordered_slide_parts(archive: zipfile.ZipFile) -> list[str]:
    pns = "http://schemas.openxmlformats.org/presentationml/2006/main"
    rns = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    prns = "http://schemas.openxmlformats.org/package/2006/relationships"
    pres = ET.fromstring(archive.read("ppt/presentation.xml"))
    rels = ET.fromstring(archive.read("ppt/_rels/presentation.xml.rels"))
    targets = {x.get("Id"): x.get("Target") for x in rels.findall(f"{{{prns}}}Relationship")}
    parts = []
    for node in pres.findall(f"./{{{pns}}}sldIdLst/{{{pns}}}sldId"):
        target = targets.get(node.get(f"{{{rns}}}id"))
        if target: parts.append(str(Path("ppt") / target).replace("\\", "/"))
    return parts


def qa_package() -> dict[str, object]:
    ans = "http://schemas.openxmlformats.org/drawingml/2006/main"
    pns = "http://schemas.openxmlformats.org/presentationml/2006/main"
    mns = "http://schemas.openxmlformats.org/officeDocument/2006/math"
    errors: list[str] = []
    warnings: list[str] = []
    overflow = []
    all_text: list[str] = []
    formula_slides = []
    low_text = []
    font_violations = []
    title_sizes = []
    ellipsis_hits = []
    bright_orange = []
    language_hits: list[dict[str, object]] = []
    layout_targets: list[dict[str, str]] = []
    note_lengths: list[int] = []
    expected_layout = "ppt/slideLayouts/slideLayout2.xml"
    with zipfile.ZipFile(TEMPLATE) as template, zipfile.ZipFile(EXPORT) as deck:
        if deck.testzip(): errors.append("ZIP test failed")
        parts = ordered_slide_parts(deck)
        expected_slide_count = len(PAGES)
        if len(parts) != expected_slide_count: errors.append(f"slide_count={len(parts)} expected={expected_slide_count}")
        notes = [n for n in deck.namelist() if n.startswith("ppt/notesSlides/notesSlide") and n.endswith(".xml")]
        if len(notes) != expected_slide_count: errors.append(f"notes_count={len(notes)} expected={expected_slide_count}")
        for index, part in enumerate(parts, 1):
            root = ET.fromstring(deck.read(part))
            rel_part = str(Path(part).parent / "_rels" / f"{Path(part).name}.rels").replace("\\", "/")
            rel_root = ET.fromstring(deck.read(rel_part)) if rel_part in deck.namelist() else None
            slide_layouts = []
            if rel_root is not None:
                for rel in rel_root.findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"):
                    if rel.get("Type", "").endswith("/slideLayout"):
                        target = posixpath.normpath(posixpath.join(posixpath.dirname(part), rel.get("Target", "")))
                        slide_layouts.append(target)
            if len(slide_layouts) != 1:
                errors.append(f"slide {index}: slideLayout relationship count={len(slide_layouts)}")
            else:
                layout_targets.append({"slide": str(index), "target": slide_layouts[0]})
                if slide_layouts[0] != expected_layout:
                    errors.append(f"slide {index}: layout target {slide_layouts[0]} expected {expected_layout}")
            if root.find(f"./{{{pns}}}cSld/{{{pns}}}bg") is not None: errors.append(f"slide {index}: slide-level background")
            text = "".join(n.text or "" for n in root.findall(f".//{{{ans}}}t"))
            all_text.append(text)
            if FORBIDDEN in text: errors.append(f"slide {index}: forbidden word")
            if MINUTE_RE.search(text): errors.append(f"slide {index}: time label")
            for term in ("...", "…"):
                if term in text:
                    ellipsis_hits.append({"location": f"slide-{index}", "term": term})
            for term in LANGUAGE_BANNED:
                if term in text:
                    language_hits.append({"location": f"slide-{index}", "term": term})
            omath = root.findall(f".//{{{mns}}}oMath")
            if omath: formula_slides.append((index, len(omath)))
            for run_node in root.findall(f".//{{{ans}}}r"):
                run_text = "".join(n.text or "" for n in run_node.findall(f".//{{{ans}}}t"))
                rpr = run_node.find(f"./{{{ans}}}rPr")
                if rpr is not None and run_text:
                    latin = rpr.find(f"./{{{ans}}}latin")
                    ea = rpr.find(f"./{{{ans}}}ea")
                    if latin is None or latin.get("typeface") != "Times New Roman":
                        font_violations.append({"slide": index, "text": run_text[:40], "latin": None if latin is None else latin.get("typeface")})
                    if ea is None or ea.get("typeface") != "標楷體":
                        font_violations.append({"slide": index, "text": run_text[:40], "east_asia": None if ea is None else ea.get("typeface")})
                    try:
                        run_size = int(rpr.get("sz", "0"))
                    except ValueError:
                        run_size = 0
                    if run_size and run_size < OPERATIONAL_TEXT_MIN_PT * 100:
                        low_text.append((index, run_size))
                
            for rpr in root.findall(f".//{{{ans}}}rPr"):
                try: size = int(rpr.get("sz", "0"))
                except ValueError: continue
                solid = rpr.find(f"./{{{ans}}}solidFill/{{{ans}}}srgbClr")
                if solid is not None and solid.get("val", "").upper() in {"FF6600", "FF9900", "FFA500", "FFC000", "FFB000"}:
                    bright_orange.append((index, solid.get("val")))
            for shape in root.findall(f"./{{{pns}}}cSld/{{{pns}}}spTree/{{{pns}}}sp"):
                c_nv_pr = shape.find(f"./{{{pns}}}nvSpPr/{{{pns}}}cNvPr")
                name = "" if c_nv_pr is None else c_nv_pr.get("name", "")
                ph = shape.find(f"./{{{pns}}}nvSpPr/{{{pns}}}nvPr/{{{pns}}}ph")
                if "title" in name.lower() or (ph is not None and ph.get("type") == "title"):
                    for rpr in shape.findall(f".//{{{ans}}}rPr"):
                        try:
                            title_size = int(rpr.get("sz", "0"))
                        except ValueError:
                            title_size = 0
                        if title_size:
                            title_sizes.append({"slide": index, "size_pt": title_size / 100})
            for shape in root.findall(f"./{{{pns}}}cSld/{{{pns}}}spTree/*"):
                xfrm = shape.find(f"./{{{pns}}}spPr/{{{ans}}}xfrm")
                if xfrm is None:
                    xfrm = shape.find(f"./{{{pns}}}grpSpPr/{{{ans}}}xfrm")
                if xfrm is None: continue
                off, ext = xfrm.find(f"{{{ans}}}off"), xfrm.find(f"{{{ans}}}ext")
                if off is None or ext is None: continue
                try: x, y, cx, cy = (int(off.get(k, "0")) for k in ("x", "y", "cx", "cy"))
                except ValueError: continue
                if x < 0 or y < 0 or x + cx > SLIDE_CX or y + cy > SLIDE_CY:
                    overflow.append({"slide": index, "x": x, "y": y, "cx": cx, "cy": cy})
        note_text = []
        for name in notes:
            nr = ET.fromstring(deck.read(name)); txt = "".join(n.text or "" for n in nr.findall(f".//{{{ans}}}t")); note_text.append(txt)
            note_lengths.append(len(txt.strip()))
            if FORBIDDEN in txt: errors.append(f"notes {name}: forbidden word")
            if MINUTE_RE.search(txt): errors.append(f"notes {name}: time label")
            for term in ("...", "…"):
                if term in txt:
                    ellipsis_hits.append({"location": name, "term": term})
            for term in LANGUAGE_BANNED:
                if term in txt:
                    language_hits.append({"location": name, "term": term})
        if len(formula_slides) != 2 or sorted(formula_slides) != [(6, 1), (7, 1)]: errors.append(f"omml={formula_slides} expected slides 6,7")
        for idx in (6, 7):
            root = ET.fromstring(deck.read(parts[idx - 1]))
            if root.findall(f".//{{{pns}}}pic"): errors.append(f"formula slide {idx}: picture shape present")
        template_names = [n for n in template.namelist() if n.startswith(("ppt/slideLayouts/", "ppt/slideMasters/", "ppt/theme/")) or n in {"ppt/media/image1.png", "ppt/media/image2.png", "ppt/media/image3.png"}]
        for name in template_names:
            if name not in deck.namelist(): errors.append(f"template part missing: {name}")
            elif hashlib.sha256(template.read(name)).hexdigest() != hashlib.sha256(deck.read(name)).hexdigest(): errors.append(f"template part changed: {name}")
        layout_xml = deck.read("ppt/slideLayouts/slideLayout2.xml").decode("utf-8", "ignore")
        master_xml = deck.read("ppt/slideMasters/slideMaster1.xml").decode("utf-8", "ignore")
        if "sldNum" not in layout_xml and "slidenum" not in layout_xml.lower(): errors.append("page-number placeholder missing from layout")
        if "sldNum" not in master_xml and "slidenum" not in master_xml.lower(): errors.append("page-number placeholder missing from master")
    if overflow: errors.append(f"authored_shape_overflow={len(overflow)}")
    if bright_orange: errors.append(f"bright_orange_text={bright_orange}")
    if language_hits: errors.append(f"language_policy_hits={len(language_hits)}")
    if ellipsis_hits: errors.append(f"ellipsis_hits={len(ellipsis_hits)}")
    if font_violations: errors.append(f"font_violations={len(font_violations)}")
    if low_text: errors.append(f"text_below_operational_floor={len(low_text)}")
    if any(length < 80 for length in note_lengths): errors.append("speaker_notes_too_short")
    if title_sizes and any(item["size_pt"] != 28 for item in title_sizes): errors.append("title_not_28pt")
    if len(layout_targets) != len(parts): errors.append(f"layout_target_count={len(layout_targets)} expected={len(parts)}")
    report = {
        "schema": "c120-direct-teaching-part-b-qa-v1", "status": "PASS" if not errors else "FAIL",
        "input": str(EXPORT), "slide_count": len(parts), "expected_slide_count": len(PAGES), "notes_count": len(notes), "expected_notes_count": len(PAGES),
        "omml_count": sum(n for _, n in formula_slides), "omml_slides": formula_slides,
        "slide_level_background_nodes": 0, "overflow_candidates": overflow,
        "low_text_pt": [{"slide": i, "size_pt": sz / 100} for i, sz in low_text],
        "font_contract": {"latin": "Times New Roman", "east_asia": "標楷體", "violations": font_violations},
        "title_sizes": title_sizes,
        "bright_orange_text": bright_orange, "template_master_layout_theme_footer_preserved": not any("template part" in e for e in errors),
        "layout_contract": {"expected_target": expected_layout, "targets": layout_targets, "all_content_shell": len(layout_targets) == len(parts) and all(item["target"] == expected_layout for item in layout_targets)},
        "language_policy": {"banned_terms": list(LANGUAGE_BANNED), "hits": language_hits, "slide_xml_and_notes_scan": "PASS" if not language_hits else "FAIL"},
        "ellipsis_policy": {"hits": ellipsis_hits, "scan": "PASS" if not ellipsis_hits else "FAIL"},
        "speaker_notes": {"count": len(notes), "minimum_chars": min(note_lengths) if note_lengths else 0, "all_nonempty": all(note_lengths)},
        "text_size_contract": {
            "classroom_body_min_pt": CLASSROOM_BODY_MIN_PT,
            "operational_exact_command_min_pt": OPERATIONAL_TEXT_MIN_PT,
            "hard_floor_pt": OPERATIONAL_TEXT_MIN_PT,
            "hard_floor_scan": "PASS" if not low_text else "FAIL",
            "operational_pages": [i for i, p in enumerate(PAGES, 1) if p.kind in {"run-a", "receipt-a", "run-b", "receipt-b"}],
        },
        "field_explanation_contract": {"audit_pages": len(FIELD_AUDIT), "audit_path": str(PROJECT / "validation/field-explanation-audit.json")},
        "footer_contract": {"line_and_text_media": "ppt/media/image2.png", "logo_media": "ppt/media/image3.png", "page_number_placeholder": "native layout/master sldNum"},
        "formula_contract": {"native_office_math_only": True, "formula_preview_removed": True, "formula_picture_count": 0},
        "errors": errors, "warnings": warnings,
        "limitations": ["Microsoft PowerPoint open/reopen remains controller-owned.", "LibreOffice PDF render is a visual check; OMML editability is structurally checked."],
    }
    (PROJECT / "validation/qa_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def render_and_contact() -> dict[str, object]:
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    converter = Path("/home/u24/.codex/skills/pptx/scripts/office/soffice.py")
    final_pdf = RENDER_DIR / "direct-teaching-part-b-final.pdf"
    source_pdf = RENDER_DIR / "direct-teaching-part-b-preview.pdf"
    chosen_pdf = RENDER_DIR / "direct-teaching-part-b.pdf"
    # Never allow a failed conversion to leave a previous PDF eligible for
    # the contact sheet.  These are all builder-owned render artifacts.
    for path in (final_pdf, source_pdf, chosen_pdf):
        path.unlink(missing_ok=True)
    runs = []
    for source, target in ((EXPORT, final_pdf), (RENDER_SOURCE, source_pdf)):
        run_root = Path(tempfile.mkdtemp(prefix="c120-part-b-lo-", dir="/tmp"))
        out_dir = run_root / "out"
        profile = run_root / "profile"
        out_dir.mkdir()
        profile.mkdir()
        cmd = [sys.executable, str(converter), f"-env:UserInstallation={profile.as_uri()}", "--headless", "--convert-to", "pdf:impress_pdf_Export", "--outdir", str(out_dir), str(source)]
        result = subprocess.run(cmd, cwd=str(ROOT), text=True, capture_output=True, timeout=120, check=False)
        produced = next(iter(sorted(out_dir.glob("*.pdf"))), None)
        fresh = bool(produced and produced.exists() and produced.stat().st_mtime > EXPORT.stat().st_mtime)
        if result.returncode == 0 and fresh:
            shutil.copy2(produced, target)
        runs.append({"source": str(source), "target": str(target), "returncode": result.returncode, "stdout": result.stdout[-600:], "stderr": result.stderr[-600:], "exists": target.exists(), "fresh_mtime_gt_export": fresh})
    # The editable export is converted separately for the native-OMML check,
    # but the visual contact sheet must use the render source.  LibreOffice
    # can distort a14:m glyphs even when the editable package is structurally
    # valid; keeping the source PDF as the chosen visual path avoids turning
    # that renderer limitation into a false layout rejection.
    chosen = source_pdf if source_pdf.exists() else final_pdf if final_pdf.exists() else None
    pdf = chosen_pdf
    if chosen is not None: shutil.copy2(chosen, pdf)
    images = []
    if pdf.exists():
        subprocess.run(["pdftoppm", "-png", "-r", "144", str(pdf), str(RENDER_DIR / "slide")], cwd=str(ROOT), check=True)
        images = sorted(RENDER_DIR.glob("slide-*.png"), key=lambda p: int(re.search(r"(\d+)$", p.stem).group(1)))
        from PIL import Image, ImageDraw
        cdir = RENDER_DIR / "contact-sheets"; cdir.mkdir(exist_ok=True)
        for old in cdir.glob("contact-*.jpg"): old.unlink()
        for start in range(0, len(images), 9):
            subset = images[start:start + 9]; tw, th = 360, 203
            sheet = Image.new("RGB", (tw * 3, (th + 24) * 3), "white"); draw = ImageDraw.Draw(sheet)
            for j, path in enumerate(subset):
                with Image.open(path) as img:
                    img = img.convert("RGB"); img.thumbnail((tw, th)); x = (j % 3) * tw; y = (j // 3) * (th + 24); sheet.paste(img, (x, y)); draw.text((x + 6, y + th + 4), page_label(PAGES[start + j]), fill="black")
            sheet.save(cdir / f"contact-{page_label(PAGES[start])}-{page_label(PAGES[start + len(subset) - 1])}.jpg", quality=90)
    review = {"pdf": str(pdf) if pdf.exists() else None, "chosen_render_source": str(chosen) if chosen is not None else None, "slides_rendered": len(images), "runs": runs, "contact_sheets": [str(p) for p in sorted((RENDER_DIR / "contact-sheets").glob("contact-*.jpg"))], "page_by_page_human_inspection": "PENDING", "fix_and_rerender_pass": "PENDING"}
    (PROJECT / "validation/visual-qa.json").write_text(json.dumps(review, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return review


def write_field_audit() -> None:
    (PROJECT / "validation/field-explanation-audit.json").write_text(
        json.dumps({"schema": "c120-part-b-field-explanation-audit-v1", "pages": FIELD_AUDIT}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    rows = [
        "# Part B 欄位與英文術語逐頁 audit",
        "",
        "本表是 validation record；欄位解釋已寫入可見頁面，contract source 不嵌入簡報。",
        "",
        "| page | unexplained terms before fix | fix / split |",
        "|---|---|---|",
    ]
    for item in FIELD_AUDIT:
        rows.append(f"| {item['page']} | {item['unexplained_terms']} | {item['fix_or_split']} |")
    (PROJECT / "validation/field-explanation-audit.md").write_text("\n".join(rows) + "\n", encoding="utf-8")


def write_sources(equation_reports: list[dict[str, object]]) -> None:
    shutil.copy2(TEMPLATE, SOURCE_COPY)
    rows = ["# Direct-teaching Part B source (P028–P063)", "", "Template: educate.pptx (native content shell / slideLayout2.xml)", "", "The builder is the owning source for this rendered module; teaching contract files remain outside the PPTX.", ""]
    notes = ["# Direct-teaching Part B speaker notes (P028–P063)", ""]
    for p in PAGES:
        rows.extend([f"## {page_label(p)} — {p.title}", "", f"Evidence: {p.evidence}", f"Purpose: {p.purpose}", f"Mechanism: {p.mechanism}", f"Expected: {p.expected}", f"Recovery: {p.recovery}", f"Context: {p.context}", f"Command: {p.command or 'none'}", ""])
        notes.extend([f"## {page_label(p)} — {p.title}", "", spoken_notes(p), ""])
    (PROJECT / "sources/module-b-script.md").write_text("\n".join(rows), encoding="utf-8")
    (PROJECT / "sources/module-b-speaker-notes.md").write_text("\n".join(notes), encoding="utf-8")
    (PROJECT / "analysis/content-manifest.json").write_text(json.dumps({"schema": "c120-direct-teaching-part-b-v1", "pages": [asdict(p) for p in PAGES], "claim_boundary": COMMON_BOUNDARY, "equations": equation_reports, "fallback": FALLBACK}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (PROJECT / "sources/part-b-visible-content.md").write_text(
        "# Part B visible-content source\n\nThis project-local source is generated from the builder owning P028–P063 content. The production contract is read during build and is not embedded in slides or notes.\n",
        encoding="utf-8",
    )
    write_field_audit()


def ensure_dirs() -> None:
    # Preserve any project-local WIP that is not an explicit builder output.
    # The controller may be running adjacent QA in the same project folder.
    for folder in ("sources", "analysis", "exports", "validation", "renders"):
        (PROJECT / folder).mkdir(parents=True, exist_ok=True)
    generated = [
        SOURCE_COPY, EXPORT, RENDER_SOURCE,
        PROJECT / "validation/python-pptx-working.pptx",
        PROJECT / "validation/qa_report.json",
        PROJECT / "validation/visual-qa.json",
        PROJECT / "validation/field-explanation-audit.json",
        PROJECT / "validation/field-explanation-audit.md",
        PROJECT / "analysis/content-manifest.json",
        PROJECT / "sources/module-b-script.md",
        PROJECT / "sources/module-b-speaker-notes.md",
        PROJECT / "sources/part-b-visible-content.md",
        PROJECT / "README.md",
    ]
    generated.extend(PROJECT / "validation" / f"equation-slide-{n}.json" for n in (6, 7))
    generated.extend(PROJECT / "renders" / name for name in (
        "direct-teaching-part-b.pdf", "direct-teaching-part-b-final.pdf",
        "direct-teaching-part-b-preview.pdf", ".render-source.pdf",
    ))
    for path in generated:
        path.unlink(missing_ok=True)
    for pattern in ("slide-*.png", "export-slide-*.png", "contact-*.png"):
        for path in (PROJECT / "renders").glob(pattern):
            path.unlink(missing_ok=True)
    contact_dir = PROJECT / "renders/contact-sheets"
    contact_dir.mkdir(parents=True, exist_ok=True)
    for path in contact_dir.glob("contact-*.jpg"):
        path.unlink(missing_ok=True)


def build() -> tuple[dict[str, object], dict[str, object]]:
    validate_pages(); ensure_dirs()
    prs = Presentation(str(TEMPLATE)); remove_all_slides(prs)
    # Part B has no cover: every slide clones the native educate content shell
    # (template slide 2 / slideLayout2.xml).
    layouts = [1] * len(PAGES)
    for index, p in enumerate(PAGES):
        slide = prs.slides.add_slide(prs.slide_layouts[layouts[index % len(layouts)]])
        compose(slide, p)
    working = PROJECT / "validation/python-pptx-working.pptx"
    prs.save(str(working))
    shutil.copy2(working, EXPORT)
    overlay_template_parts(EXPORT)
    # Keep a template-overlaid, pre-OMML copy for page rendering.  LibreOffice
    # may not shape the native a14:m choice, while the editable export must
    # retain it for PowerPoint; the visual source therefore has the same
    # master/layout/footer bytes but no native equation objects.
    shutil.copy2(EXPORT, RENDER_SOURCE)
    equations = insert_equations()
    report = qa_package()
    return report, {"equations": equations}


def write_readme(report: dict[str, object], visual: dict[str, object], equation_data: dict[str, object]) -> None:
    eq_summary = [
        {"slide": item.get("slide"), "key": item.get("key"), "returncode": item.get("returncode")}
        for item in equation_data.get("equations", [])
    ]
    text = f"""# Direct-teaching Part B (P028–P063)\n\nFinal editable deck: `exports/{EXPORT.name}`\n\n- Template: educate.pptx native content shell (`slideLayout2.xml`)\n- Scope: shared model P028–P038, Lab A P039–P048, Lab B P049–P062, website bridge P063.\n- Speaker notes: 36 embedded notes plus `sources/module-b-speaker-notes.md`.\n- Equations: native Office Math only on logical slides 6 and 7; no formula fallback text or picture remains in final PPTX.\n- Fallback evidence: deterministic teaching values are marked `SIMULATED`, `NOT LIVE`, `NOT MEASURED`, and `NOT CANONICAL-PARITY-VERIFIED`.\n- QA: `validation/qa_report.json`; render/contact sheets under `renders/`; visual review record under `validation/visual-qa.json`.\n- Field audit: `validation/field-explanation-audit.md`; formal-language scan is part of `qa_report.json`.\n- Build QA status: `{report.get('status')}`; rendered pages: `{visual.get('slides_rendered')}`.\n- Native equation reports: `{json.dumps(eq_summary, ensure_ascii=False)}`\n- Human page-by-page acceptance and PowerPoint reopen remain controller-owned.\n"""
    text = text.replace("Speaker notes: 36 embedded notes", f"Speaker notes: {len(PAGES)} embedded notes")
    (PROJECT / "README.md").write_text(text, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-render", action="store_true")
    args = parser.parse_args(argv)
    report, equation_data = build()
    write_sources(equation_data.get("equations", []))
    if args.skip_render:
        # A deferred render is an explicit pending gate, never a visual PASS
        # and never a stale-PDF fallback.
        visual = {
            "pdf": None,
            "chosen_render_source": None,
            "slides_rendered": 0,
            "runs": [],
            "contact_sheets": [],
            "page_by_page_human_inspection": "PENDING",
            "fix_and_rerender_pass": "PENDING",
        }
        (PROJECT / "validation/visual-qa.json").write_text(json.dumps(visual, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    else:
        visual = render_and_contact()
    write_readme(report, visual, equation_data)
    print(json.dumps({"output": str(EXPORT), "slides": len(PAGES), "qa_status": report["status"], "omml_count": report["omml_count"], "rendered": visual.get("slides_rendered", 0)}, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "PASS" else 2


if __name__ == "__main__":
    raise SystemExit(main())
