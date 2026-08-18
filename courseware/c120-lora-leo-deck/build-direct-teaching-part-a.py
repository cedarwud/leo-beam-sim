#!/usr/bin/env python3
"""Build the directly teachable C-120 Part A deck (36 physical pages).

The source deck is ``/home/u24/ppt-master/template/educate.pptx``.  The
authoring pass uses python-pptx for editable DrawingML text and shapes, then
puts the template's original master, layouts, theme and media parts back into
the package.  That last pass is intentional: the footer line, footer text
image, logo, and slide-number placeholders must remain the exact objects from
the supplied template.  No slide-level background is added.

The script writes only ``projects/direct-teaching-part-a_ppt169_20260811`` (plus a
temporary rendering directory under /tmp).  It is safe to re-run; the output
directory is rebuilt from its own generated files, without touching sibling
deck projects.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE, MSO_CONNECTOR
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.xmlchemy import OxmlElement
from pptx.util import Inches, Pt


ROOT = Path(__file__).resolve().parent
PROJECT = ROOT / "projects/direct-teaching-part-a_ppt169_20260811"
TEMPLATE = Path("/home/u24/ppt-master/template/educate.pptx")
SOURCE_SCRIPT = ROOT / "teaching-rewrite/part-a-visible-content.md"
OUTPUT_NAME = "c120-lora-leo-direct-teaching-part-a-editable_20260811.pptx"
EXPECTED_PAGE_COUNT = 36

SLIDE_W = 13.333333
SLIDE_H = 7.5
CONTENT_BOTTOM = 6.18  # footer image begins below this boundary in the template

# The first theme in educate.pptx uses these colors.  Objects use the theme's
# visual language; no object paints over the native slide background.
NAVY = RGBColor(53, 55, 127)
BLUE = RGBColor(111, 137, 247)
# The previous pale yellow accent rendered as bright yellow-orange text on
# light template surfaces.  Keep the accent role, but use a restrained,
# readable gold for authored text and thin connectors.  Native template
# background/footer/logo parts are overlaid byte-for-byte below and are not
# recoloured here.
GOLD = RGBColor(132, 104, 38)
INK = RGBColor(35, 35, 35)
MUTED = RGBColor(105, 105, 105)
PALE_BLUE = RGBColor(233, 237, 252)
PALE_GOLD = RGBColor(252, 248, 231)
WHITE = RGBColor(255, 255, 255)

FORBIDDEN_WORD = "學生"
FORBIDDEN_CONTENT_TERMS = (
    "講師",
    "老師",
    "學生",
    "全班",
    "你",
    "請",
    "記得",
    "SHA-256",
    "sha256",
    "checksum",
    "sidecar",
    "ZIP test",
    "hash-verification",
    "不對，就先停下來",
    "一顆小小的電池",
    "完成這堂課",
    "能回答",
    "能指出",
    "能說出",
    "可以回答",
    "可教",
    "讓結果可教也可追溯",
    "讓結果可以反駁原先想法",
    "不要縮成截圖",
    "只放必要欄位",
    "版面",
    "Fit",
    "投影片應放",
    "講稿提示",
    "截圖安排",
    "evidence placeholder",
    "placeholder",
    "provenance",
    "Provenance",
    "PROVENANCE",
    "舊截圖",
    "本頁不",
    "才談",
)
VARIABLES = (
    "PACE_GAP_STEPS",
    "REST_DURING_GAP",
    "ENTER_QUALITY",
    "EXIT_QUALITY",
    "STABLE_STEPS",
    "BATCH_SIZE",
    "URGENT_MARGIN_S",
    "student_policy.py",
    "scenario_id",
    "policy_api_version",
    "engine_mode",
    "endpoint J",
    "radio state",
)
VARIABLE_RE = re.compile(
    "(" + "|".join(re.escape(token) for token in sorted(VARIABLES, key=len, reverse=True)) + ")"
)

# These were repeated status rails in an earlier candidate.  They are not
# part of the educate template footer contract and must never return as
# slide-local text.  The native footer line, footer image, logo, and page
# number remain supplied by the preserved layout/master parts.
FORBIDDEN_CUSTOM_LABELS = (
    "PACKAGE CONTENT VERIFIED",
    "EXPECTED LOCAL GATE",
    "EXPECTED RECOVERY",
    "RUN STAGE",
    "VERIFY STAGE",
)


@dataclass(frozen=True)
class Page:
    number: int
    title: str
    layout: int
    family: str
    evidence: str
    visual: str
    statement: str
    commands: tuple[str, ...]
    purpose: str
    mechanism: str
    expected: str
    recovery: str
    notes: str
    operation: bool = False


def _t(*lines: str) -> tuple[str, ...]:
    return tuple(lines)


_OPERATION_GUIDANCE = {
    13: (
        "操作起點是 archive parent。Windows PowerShell 依序執行 "
        "Expand-Archive .\\lora-energy-lab-v1.zip -DestinationPath .、"
        "Set-Location .\\lora-energy-lab、Get-Location；WSL/POSIX 依序執行 "
        "unzip lora-energy-lab-v1.zip、cd lora-energy-lab、pwd。"
        "最後確認兩個 shell 都位於 lora-energy-lab root。"
    ),
    16: (
        "Windows PowerShell 先執行 winget install --id=astral-sh.uv -e，再執行 "
        "uv python install 3.11、uv python find 3.11；WSL/POSIX 執行 "
        "uv python install 3.11、uv python find 3.11。畫面上的 path 是 interpreter "
        "定位結果，尚未代表 READY 或 run evidence。"
    ),
    18: (
        "所有操作均在 Windows lora-energy-lab root。CMD 執行 setup.cmd；"
        "PowerShell 執行 .\\setup.cmd；採用 uv fallback 時先取得 $python311、"
        "以 `$env:PYTHON_BIN = ('\"{0}\"' -f $python311)` 設定 interpreter，"
        "再執行 .\\setup.cmd，完成後移除 PYTHON_BIN。"
    ),
    19: (
        "所有操作均在 Windows lora-energy-lab root。CMD 執行 course.cmd verify；"
        "PowerShell 執行 .\\course.cmd verify。接著讀取 "
        "artifacts\\verify-receipt.json，確認 status READY、Python 3.11.x，並確認 "
        "result.json 尚未產生。"
    ),
    22: (
        "Windows PowerShell 先進入 $HOME\\Downloads 並確認 ZIP；WSL/POSIX 先以 "
        "WIN_USER=<Windows帳號> 對應 Windows 帳號，再進入 Downloads 並把 ZIP 複製到 $HOME，"
        "最後以 cd $HOME 準備下一頁的解壓操作。`<Windows帳號>` 是替換欄位。"
    ),
    23: (
        "在 WSL/POSIX Linux home 依序執行 unzip、cd lora-energy-lab、pwd；"
        "留在同一 root 後執行 PYTHON_BIN=python3.11 bash setup.sh 與 "
        "bash course.sh verify。確認 .venv/bin/python、lock 與 verify-receipt.json "
        "都屬於這個 root。"
    ),
    27: (
        "Windows PowerShell 在 package root 執行 .\\course.cmd verify；"
        "WSL/POSIX 在 package root 執行 bash course.sh verify。先保留 error receipt，"
        "再修復目前指出的最小 gate；修復仍未完成時只選同情境 fallback，不改寫來源標籤。"
    ),
    28: (
        "此頁維持定位概念。畫面上的 student_policy.py 與 active marked block "
        "是通用邊界；可用 sed -n 或 Get-Content 讀取檔案並以 git diff 觀察差異，"
        "此頁維持唯讀，精確修改不在這裡執行。Lab A、B、C 的 path、marker、before/after 與編輯命令在 Part B。"
    ),
    29: (
        "此頁維持 policy API 的定位概念。沿著 choose_action(observation)、"
        "observation 與 legal action 閱讀，檔案保持唯讀；精確 marked block 與 edit "
        "順序在 Part B，future 欄位與 result summary 維持 read-only。"
    ),
    30: (
        "此頁只建立定位概念與三個受控旋鈕的索引。可在 package root 以 grep -n 或對應的文字搜尋 "
        "確認 REST_DURING_GAP、STABLE_STEPS、URGENT_MARGIN_S；精確 before/after "
        "與 candidate run 轉到 Part B、Part C。"
    ),
    31: (
        "在 package root 以 grep -n 找到 choose_action、contact_open 與 "
        "URGENT_MARGIN_S，逐段閱讀條件與 return；此頁只做 branch reading，"
        "policy 保持唯讀，預測也不當成 result evidence。"
    ),
    32: (
        "兩個 shell 都在 lora-energy-lab root。Windows PowerShell 先以 "
        ".\\.venv\\Scripts\\python.exe -m py_compile student_policy.py 驗證語法，"
        "再執行 .\\course.cmd run --lab A --case baseline；WSL/POSIX 使用 "
        "./.venv/bin/python -m py_compile student_policy.py，再執行 "
        "bash course.sh run --lab A --case baseline。保留 stdout 的 result_path，"
        "並在同一 run 目錄讀取 result.json 與 endpoint-replay.json。"
    ),
    33: (
        "PowerShell 位於 lora-energy-lab root。先執行 py -3.11 --version 並定位 "
        "$python311；缺少 3.11 時依序執行 winget/uv route，再執行 "
        "& $python311 -m venv .venv。最後確認 .venv\\Scripts\\python.exe 已建立。"
    ),
    34: (
        "在同一個 Windows PowerShell 視窗執行 .\\.venv\\Scripts\\Activate.ps1、"
        "python --version、prefix assertion、locked requirements install 與 "
        ".\\course.cmd verify。若 Activate.ps1 受限，改用 Command Prompt 的 "
        "call .venv\\Scripts\\activate.bat，仍在同一 root 執行 course.cmd verify。"
    ),
    35: (
        "上述命令只在 Ubuntu/WSL bash 執行。先以 command -v python3.11 與 "
        "python3.11 --version 檢查，再以 apt-cache policy 檢查 python3.11-venv；"
        "接著執行 sudo apt update；有 Candidate 時執行 sudo apt install -y "
        "python3.11 python3.11-venv，沒有 Candidate 時以 apt 補 curl/unzip，"
        "再安裝 uv、定位 Python 3.11，"
        "將 PYTHON_BIN 留在同一個 bash session 給下一頁使用。"
    ),
    36: (
        "在同一個 WSL root 與 bash session 使用 PYTHON_BIN 執行 venv module check、"
        "建立 .venv、source .venv/bin/activate、確認 prefix、安裝 locked requirements，"
        "最後執行 bash course.sh verify。讀取 verify receipt 的 READY，再進入後續 policy stage。"
    ),
}


def speaker_script(page: Page, next_page: Page | None = None) -> str:
    """Return a speakable, page-local delivery script for the embedded notes."""
    if page.number in _OPERATION_GUIDANCE:
        operation = _OPERATION_GUIDANCE[page.number]
    elif page.operation and page.commands:
        operation = "在畫面標示的 package/root context 執行命令：" + "；".join(page.commands) + "。"
    else:
        operation = (
            "本頁屬於概念或邊界頁；沿著畫面上的 "
            f"{page.visual} 閱讀，不改動 runner、schema 或 generated JSON。"
        )
    if next_page is None:
        transition = "本模組在此收束；保留 READY 與 baseline receipt，後續實驗從對應的操作頁開始。"
    else:
        transition = f"銜接下一頁：P{next_page.number:03d}｜{next_page.title}，把本頁的 {page.visual} 帶入下一個操作階段。"
    return "\n".join([
        f"本頁目的：{page.purpose}",
        f"畫面指向：先看標題與 {page.visual}，再看命令、欄位或箭頭所標示的邊界。",
        f"可直接說：{page.notes}",
        f"必要操作：{operation}",
        f"預期畫面或結果：{page.expected}",
        f"失敗處理：{page.recovery}",
        transition,
    ])


def direct_page_data() -> list[Page]:
    """Part A pages from teaching-rewrite/part-a-visible-content.md.

    This builder uses an isolated authored contract; superseded donor content
    is not emitted into Part A.
    """
    claim_recovery = "claim 擴大：停在目前 boundary；source mode 保留；模擬資料維持 simulated 類型。"
    setup_recovery = "shell、版本、lock 或 root 不符：錯誤保留，回到該 gate；受阻時使用同情境 fallback。"
    policy_recovery = "policy guard 或 syntax failure：active marked block only；runner、schema 與 generated JSON 維持唯讀。"
    p = Page
    return [
        p(1, "P001｜有限電量與變動服務窗口", 0, "hero", "SOURCE BOUNDARY", "endpoint 與 changing service window", "有限電量的 IoT endpoint（物聯網端點）必須把資料送進會開、會關的服務窗口。過早保持 awake 會耗電；錯過窗口，資料可能延遲或過期。", _t(), "建立具體 endpoint 問題，再連到工具。", "SEND、WAIT、SLEEP 改變 radio state（無線狀態）與停留時間，進而改變 packet timing、service 與 endpoint energy J（焦耳）。", "預期：SEND、WAIT、SLEEP 各自保護的資源可由 state 與 service 觀察。", claim_recovery, "節點位於田區、倉庫或校園角落；供電有限且 service window 有限。分析沿著 action、state、packet、service 連到 endpoint J。", False),
        p(2, "P002｜現在送不一定最好，等一下也不一定省電", 1, "tradeoff", "SOURCE BOUNDARY", "SEND／WAIT／SLEEP 三欄取捨", "立刻送可能守住窗口，卻付出處理與收發能量。醒著等待可能等到較好品質，卻持續消耗 awake-idle；睡眠功率低，卻增加 wake latency 與 wake energy。", _t(), "比較三種合法方向，不使用公式。", "action 的代價回到 state duration、packet outcome 與 service。", "預期：窗口關閉時，SEND_* 不屬於合法路徑。", claim_recovery, "窗口接近關閉時，觀察 service、反應能力與等待功率的取捨；結果回到這三個欄位。", False),
        p(3, "P003｜WAIT、SLEEP、SEND：合法 action", 2, "actions", "SOURCE BOUNDARY", "legal action → observable consequence", "每一步選一個 action：WAIT（清醒閒置）、SLEEP（低功耗休息）或 SEND（傳送）。action 改變 radio state、packet 進度與服務結果。", _t(), "建立合法 action vocabulary。", "contact_open = false 時，安全路徑只允許 `SLEEP`；其餘 SEND_* 必須被拒絕。", "預期：action 對 state、packet 或 service 的一個後果可被定位。", claim_recovery, "結果解讀由 action 開始，再追蹤 state 與 packet 事件。SEND 展開成 SEND_ONE、SEND_URGENT、FLUSH_BATCH。", False),
        p(4, "P004｜實際流程：安裝→baseline→修改→比較→網站回放", 3, "promise", "SOURCE BOUNDARY", "安裝 → baseline → edit → compare → website replay", "setup Python 3.11＋`.venv` → 執行 baseline。\nedit `student_policy.py` → compare state／packet／service／J → website replay。", _t(), "定義可操作的課程流程。", "固定 scenario 與 seed；唯一修改項進入 candidate；result／replay 保留 input、policy、output 關聯。", "預期：baseline 與 candidate 的中間事件、service 結果與 endpoint J 可比較。", claim_recovery, "流程依序涵蓋 environment setup、baseline、active block edit、candidate comparison 與 website replay；每個 stage 保存自己的 receipt。", False),
        p(5, "P005｜因果鏈與 endpoint J", 4, "chain", "SOURCE BOUNDARY", "observation → policy → action → state/packet → service → endpoint J", "endpoint energy J（焦耳）由 state time、packet outcome 與 service 累積。中間任何一段沒有差異，最後的變化不歸因給這次修改。", _t(), "定義所有 lab 共用的讀圖順序。", "observation 觸發 action；action 改變 state／packet；service gate 位於 energy interpretation 之前。", "預期：支持或推翻預測的 evidence 段落可定位。", claim_recovery, "service 失敗但 J 下降時，記錄服務邊界，再說明 energy trade-off；同一讀法沿用到 replay。", False),
        p(6, "P006｜LoRaEnergySim endpoint runner 的必要性", 5, "runner", "SOURCE BOUNDARY", "runner evidence／claim boundary", "LoRaEnergySim runner：固定 scenario／policy／seed，重跑 endpoint case。\nstate／packet／service／J 形成 evidence；live telemetry 屬於另一類。", _t(), "說明 LoRaEnergySim 與智慧節能 IoT 的直接關係。", "同一 runner 連接 sleep、processing、TX、RX、packet、retry 與 energy ledger。", "預期：endpoint evidence 範圍與 claim ceiling 分開標示。", claim_recovery, "LoRaEnergySim endpoint model 以事件鏈記錄 sleep、processing、TX、RX、packet、retry 與 energy；每筆 result 保留 source mode 與 boundary。", False),
        p(7, "P007｜LEO：changing service window 的例子", 6, "leo", "SOURCE BOUNDARY", "窗口出現 → policy → service／energy", "LEO 範例採用預先定義的 changing-service-window trace，作為 endpoint 傳輸時機的輸入。窗口會開、會關、會變短，品質也可能變動。", _t(), "以 LEO trace 引出 changing window。", "窗口長短改變傳送或等待的後果；機制可轉到農場、HVAC、物流與 edge。", "預期：LEO 窗口機制可轉用至另一 IoT 場景。", claim_recovery, "本頁使用預先定義的 changing-service-window trace，分析服務機會變動時的 endpoint policy；軌道與 link budget 不屬於此案例。", False),
        p(8, "P008｜從預測到結果：每次修改留下證據", 7, "loop", "SOURCE BOUNDARY", "預測 → bounded edit → run → 讀 evidence → withheld", "預測 state／packet／service／endpoint J，修改 policy 並執行 exact case。\nwithheld case 固定 policy，不重新調參。", _t(), "結果可檢驗原先預測。", "baseline／candidate／withheld 共享 scenario identity；withheld 沿用 frozen policy。", "預期：非預期結果保留，且中間事件可定位。", claim_recovery, "結果與預測相反時，保留非預期結果並檢查 state、packet 或 service 的中間事件；數值不因非預期結果回寫。", False),
        p(9, "P009｜claim 與來源邊界", 8, "claims", "SOURCE BOUNDARY", "可說／不可說／待核對", "result／replay = simulated data；READY（環境就緒）= verify gate。\n來源鏈決定 claim ceiling；fresh setup／import 待核對。", _t(), "標記證據等級。", "package identity、scenario identity 與 source mode 必須一起保存。", "預期：READY 定義為環境 gate；energy result 需要 run evidence。", claim_recovery, "目前確認的是 package content 與 identity；fresh Python run、READY、case receipt、Leo strict import 仍以現場 gate 為準。待核對 evidence 維持 pending。", False),
        p(10, "P010a｜使用命名 release asset", 9, "release", "SOURCE BOUNDARY", "release ZIP 與來源鎖", "使用命名 release asset：`lora-energy-lab-v1.zip`。禁止以 branch 或資料夾拼裝 runner。", _t("ls -l lora-energy-lab-v1.zip", "Get-ChildItem .\\lora-energy-lab-v1.zip"), "固定 artifact 交付邊界。", "單一 release asset 固定 wrapper、policy API、scenario、schema 與 license source chain。", "預期：命名 asset 位於指定 release 目錄。", "檔案缺少或混用：錯誤保留，重新取得同一 release asset；source archive 與 git clone 不納入 runner。", "命名 release asset 固定 artifact identity；此 gate 尚未進入 Python 或 energy runner。", True),
        p(11, "P010b｜解壓後只能有一個 package root", 10, "package", "SOURCE BOUNDARY", "lora-energy-lab/ root inventory", "解壓後只應有一個 `lora-energy-lab/` 根目錄。\nREADME、launcher、`student_policy.py`、schemas、fallback 均位於此 root。", _t("find lora-energy-lab -mindepth 1 -maxdepth 1 -printf '%f\\n'", "Get-ChildItem .\\lora-energy-lab"), "定義解壓後 root inventory 的第一個可觀察 gate。", "解壓後的 root 同時提供 policy、runner、scenario 與 schema；此頁只列舉 root 內容，不測試 ZIP bytes。", "預期：POSIX `find` 或 PowerShell `Get-ChildItem` 顯示單一 `lora-energy-lab/` root 內的 README、launcher、policy、schemas 與 fallback。", "root 不符：錯誤保留，重新取得指定 asset 並重新解壓；checkout 檔案不補入 release root。", "package tree 必須是單一 release root；`.venv` 與 result lineage 均以此 root 為參照。", True),
        p(12, "P011a｜解壓位置：release asset 所在資料夾", 11, "preflight", "LOCAL PRECONDITION", "archive parent → extract → package root", "目前 shell 位於 `lora-energy-lab-v1.zip` 所在資料夾；下一頁直接解壓並進入唯一的 `lora-energy-lab` root。", _t("Get-Location", "pwd"), "固定 extract 的起始工作目錄。", "archive parent 決定解壓目的地；Windows 與 WSL/POSIX 在各自 shell 讀取目前位置，下一頁再執行平台對應的 extract。", "預期：`Get-Location` 或 `pwd` 顯示命名 release asset 所在資料夾。", "位置不符：切換到 release asset 所在資料夾，再進入下一頁的 extract。", "本頁只確認解壓起點；下一頁執行 `Expand-Archive` 或 `unzip`，setup、READY 與 runner evidence 仍屬後續 stages。", True),
        p(13, "P011b｜解壓並進入唯一的 package root", 12, "extract", "LOCAL PRECONDITION", "Windows PowerShell／WSL-POSIX exact extract", "兩個 shell 從 archive parent 解壓，並進入 `lora-energy-lab` root。\nroot 內有 launcher、policy、schemas、`fallback_artifacts/`。", _t("Expand-Archive .\\lora-energy-lab-v1.zip -DestinationPath .", "Set-Location .\\lora-energy-lab", "Get-Location", "unzip lora-energy-lab-v1.zip", "cd lora-energy-lab", "pwd"), "固定解壓後的工作目錄。", "package root 是 setup、policy edit、result path 與 replay path 的共同參照；Windows 與 WSL/POSIX 各走自己的 exact route。", "預期：Windows `Get-Location` 或 POSIX `pwd` 顯示結尾是 `lora-energy-lab`，必要檔案位於同一 root。", "root 不符：回到 inventory gate；parent 目錄不建立 `.venv` 或 runner。", "後續 shell 命令均以此 root 為參照；Windows 只用 PowerShell `.cmd` route，WSL/POSIX 只用 bash `.sh` route。", True),
        p(14, "P012｜Windows shell 與 Python 3.11 identity", 13, "windows-shell", "LOCAL PRECONDITION", "CMD／PowerShell 雙視窗", "CMD、PowerShell、WSL 使用不同 shell／path。`py --list` 必須含 3.11；Windows native 使用 `setup.cmd`／`course.cmd`。", _t("py --list", "py -3.11 --version"), "建立 Windows interpreter identity。", "Python 3.11.x 是 package contract 的前置條件；Windows launcher 與 WSL bash launcher 分開。", "預期：清單含 3.11，版本命令顯示 `Python 3.11.x`。", "缺少 3.11：進入 P013 官方 installer 或 P014 uv；其他 minor 維持 gate failure。", "CMD／PowerShell prompt 表示 Windows shell；Windows 使用 `setup.cmd`／`course.cmd`，`.sh` path 僅屬 POSIX／WSL。", True),
        p(15, "P013｜Windows 缺少 Python 3.11：補正確 interpreter", 14, "installer", "RECOVERY PATH", "官方下載 → Launcher／PATH 選項 → version gate", "`py --list` 缺少 3.11：安裝 Python 3.11.x 64-bit，保留 Python Launcher；PATH 可不勾選。重開 PowerShell，重新執行兩個版本命令。", _t("開啟 https://www.python.org/downloads/windows/", "下載 Python 3.11.x Windows installer (64-bit)", "安裝選項：Install Python Launcher for all users", "PATH：可不勾選；完成後重開 PowerShell", "py --list", "py -3.11 --version"), "提供可恢復的 Windows 路徑。", "官方 installer 修復 interpreter discovery；Python Launcher 是 Windows 版本 gate；package-local `.venv` 尚未建立。", "預期：`py --list` 出現 3.11，`py -3.11 --version` 顯示 3.11.x。", "仍缺少 3.11：保留錯誤，改走 P014 uv；PATH 綁定其他 minor 不構成 gate success。", "下載頁、64-bit installer、Launcher 選項與 PATH 決策都在畫面上；完成後重開 PowerShell，再進入 P012 的 `py --list` 與 `py -3.11 --version` gate。", True),
        p(16, "P014｜uv 取得與定位 Python 3.11", 15, "uv", "RECOVERY PATH", "Windows／POSIX uv 兩條入口", "uv 負責取得並定位 Python 3.11；`READY`、`result.json` 與 replay 由 package setup／run 產生。", _t("winget install --id=astral-sh.uv -e", "uv python install 3.11", "uv python find 3.11", "uv --version"), "launcher unavailable 時的第二條入口。", "Windows、WSL、Linux 的 interpreter path 不能互換。", "預期：`uv python find 3.11` 回傳可執行的 3.11 path。", setup_recovery, "uv output 僅表示 interpreter path；READY 與 energy result 由後續 package stages 產生。", True),
        p(17, "P015｜每個 package 使用自己的 `.venv`", 16, "venv", "LOCAL PRECONDITION", "system Python 與 package-local venv", "`.venv` 建立於 `lora-energy-lab/` root。Windows 與 WSL／Linux／macOS 使用不同 path，兩者不能互換；Windows 與 WSL 各自建立 venv。", _t(".\\.venv\\Scripts\\python.exe --version", "./.venv/bin/python --version"), "將 dependency graph 綁回 package root。", "launcher 優先使用 package-local interpreter，使 lock、policy 與 receipt 具備來源關聯。", "預期：所在平台的 path 顯示 `Python 3.11.x`。", "既有 venv minor 錯誤：處理目前 package root 的 `.venv` 後重跑 setup；package root 保持不變。", "activate 非必要；核對 path 與 version，不採用 shell 預設 Python 作為 identity。Windows `.venv\\Scripts\\python.exe` 與 WSL `.venv/bin/python` 分開建立。", True),
        p(18, "P016a｜Windows setup：建立可重現 runtime", 17, "setup-win", "SETUP", "CMD／PowerShell 分欄 setup route", "setup 建立隔離的 Python 3.11／`.venv`／lock runtime。\n所有命令在 Windows 的 `lora-energy-lab` root；CMD 與 PowerShell 不混用。", _t("setup.cmd", ".\\setup.cmd", "uv python install 3.11", "$python311 = (uv python find 3.11).Trim()", "$env:PYTHON_BIN = ('\"{0}\"' -f $python311)", ".\\setup.cmd", "Remove-Item Env:PYTHON_BIN"), "建立 Windows 的 package-local runtime。", "CMD route 直接執行 `setup.cmd`；PowerShell 的 Python Launcher shortcut 直接執行 `.\\setup.cmd`；若改走 uv，先定位 3.11，使用與 README 相同的雙引號 path semantics，以 format expression 設定 `PYTHON_BIN`，完成 setup 後清除該環境變數。", "預期：package-local `.venv` 與 lock installation 完成；`result.json` 尚未產生。", setup_recovery, "CMD 與 PowerShell 各在 Windows package root 執行自己的欄位；WSL path 不混用。setup 的 output 是 runtime state；result 與 endpoint replay 由 RUN stage 產生。", True),
        p(19, "P016b｜Windows verify：前置條件通過才允許 RUN", 18, "verify-win", "VERIFY", "CMD／PowerShell 分欄 verify route", "verify 檢查 Python、lock、scenario、policy API、schema。\nWindows `lora-energy-lab` root 的 READY 才允許 RUN。", _t("course.cmd verify", ".\\course.cmd verify"), "保存 validation gate receipt。", "CMD 與 PowerShell 分別執行自己的 `course.cmd verify`；verify 比對 runtime、release、scenario、schema 與 policy identity，不一致時在 RUN 前停止。", "預期：`artifacts\\verify-receipt.json` 有 `status: READY` 與 `python_version: 3.11.x`；`result.json` 尚未產生。", "缺欄位或 status 非 READY：原始錯誤保留，回到 P012–P018；receipt 維持唯讀。", "verify 是 validation stage；READY 表示 RUN 的前置條件通過。RUN 產生 result.json 與 endpoint-replay.json，browser import 只讀取這兩筆結果。", True),
        p(20, "P017｜WSL：Ubuntu shell 與 Linux home", 19, "wsl", "RECOVERY PATH", "Windows host → Ubuntu shell", "WSL Ubuntu 使用 Linux home 與 bash `.sh`；Windows native 使用 `.cmd`，兩者的 venv path 不互換。", _t("wsl --install -d Ubuntu", "wsl -l -v", "wsl -d Ubuntu", "pwd", "uname -a"), "區分 `.cmd`、`.sh` 與 venv path。", "shell identity 決定 path、launcher 與 interpreter；Linux path 不回傳 Windows venv。", "預期：`wsl -l -v` 有 Ubuntu，Ubuntu shell 的 `uname -a` 開頭是 Linux。", "需要重開機或 distribution 不符：保留提示，依 `wsl -l -v` 修正；WSL 使用 bash `.sh`，Windows 使用 `.cmd`。", "shell identity gate 完成後，uv、venv、READY 與 runner 仍屬後續 stages。Windows CMD 不執行 `.sh`；WSL 使用 `.venv/bin/python`。", True),
        p(21, "P018｜WSL 工具與 uv 的安裝順序", 20, "wsl-tools", "RECOVERY PATH", "apt → curl／unzip → uv → Python 3.11", "已確認的 Ubuntu shell 執行 `curl`、`unzip`、uv 與 Python 3.11 安裝命令。此 stage 只準備環境；`result.json` 由 runner stage 產生。", _t("sudo apt update", "sudo apt install -y curl unzip", "curl -LsSf https://astral.sh/uv/install.sh | sh", "uv python install 3.11", "uv python find 3.11"), "準備 WSL interpreter path。", "uv 找到的是 WSL／Linux interpreter，不能被 Windows `.cmd` 共用。", "預期：`uv python find 3.11` 回傳可執行 path。", setup_recovery, "apt、installer 或網路失敗時保留錯誤，修復目前 stage；uv output 不等同 READY。", True),
        p(22, "P019a｜將 release asset 複製到 Linux home", 21, "wsl-copy", "LOCAL PRECONDITION", "Windows Downloads → WSL Linux home", "WSL：ZIP 先放 `$HOME`；下一頁只形成一層 `lora-energy-lab`。", _t("Set-Location \"$HOME\\Downloads\"", "Get-ChildItem .\\lora-energy-lab-v1.zip", "WIN_USER=\"<Windows帳號>\"", "cd \"/mnt/c/Users/$WIN_USER/Downloads\"", "cp lora-energy-lab-v1.zip \"$HOME/\"", "cd \"$HOME\""), "把 release asset 放到 WSL Linux home。", "Windows PowerShell 只檢查 Downloads；WSL/POSIX 先以 `WIN_USER=\"<Windows帳號>\"` 設定替換欄位，再進入 Windows Downloads，把指定 ZIP 放在 `$HOME`，避免先建立同名資料夾造成雙層 root；Windows venv 不進入 WSL。", "預期：ZIP 位於 `$HOME/lora-energy-lab-v1.zip`；下一頁解壓後只有 `$HOME/lora-energy-lab/`。", "copy 失敗：保留命令錯誤，確認實際 Windows 帳號、Downloads 與 WSL interop；不要先建立同名 package directory。", "copy 只搬 release asset，不搬 Git metadata；解壓與 runner evidence 由下一個 stage 產生。", True),
        p(23, "P019b｜WSL extract／root：建立 Linux venv", 22, "wsl-root", "LOCAL PRECONDITION", "Linux home → one package root → `.venv/bin/python`", "Linux home：unzip 後只形成一層 `lora-energy-lab` root。", _t("unzip lora-energy-lab-v1.zip", "cd lora-energy-lab", "pwd", "PYTHON_BIN=python3.11 bash setup.sh", "bash course.sh verify"), "將 WSL package-local environment 接上 runner gate。", "ZIP 只在 Linux home 解壓一次，形成單一 `lora-energy-lab/`；同一 root 對應 `.venv/bin/python`、lock、policy、scenario 與 receipt。", "預期：`pwd` 是 `$HOME/lora-energy-lab`，JSON 有 `status: READY`、`python_version: 3.11.x`。", "verify 失敗：錯誤保留，回到 Linux home、one-root extract、interpreter 或 lock gate；Windows `.venv\\Scripts\\python.exe` 不納入 WSL path。", "READY 可能在此 stage 產生；現場受阻時保留 same-scenario fallback 路徑，claim 維持原證據等級。", True),
        p(24, "P020｜POSIX runner 的最小入口", 23, "posix", "LOCAL PRECONDITION", "POSIX setup → verify", "Linux 與 macOS 在 `lora-energy-lab` root 使用 POSIX launcher，interpreter 固定為 Python 3.11.x。setup 完成且 `course.sh verify` 成功後，進入 policy 操作。", _t("PYTHON_BIN=python3.11 bash setup.sh", "bash course.sh verify"), "提供非 Windows 的最小可重跑入口。", "POSIX path 仍需檢查 venv、lock、policy API、scenario 與 claim boundary。", "預期：`artifacts/verify-receipt.json` 有 `status: READY`。", "缺少 `python3.11`：改走 uv；既有 venv 版本錯誤時處理 package-local `.venv`；verify failure 維持 gate failure。", "Windows、WSL、macOS 共用 READY 語義；shell/path receipt 保留原樣。", True),
        p(25, "P021a｜verify-receipt.json：schema example", 24, "receipt-view", "RECEIPT", "machine-readable receipt schema／example", "`verify-receipt.json` 圖例只說明欄位與型別；現場值從 package root 讀取。RUN 輸出另見 `result.json` 與 `endpoint-replay.json`。", _t("sed -n '1,80p' artifacts/verify-receipt.json", "Get-Content .\\artifacts\\verify-receipt.json", "type artifacts\\verify-receipt.json"), "保存 validation receipt 的欄位結構。", "receipt fields 描述 status、Python version、lock 與 scenario；run artifact 另有自己的 identity；畫面示意值不替代現場檔案。", "預期：現場讀取的 receipt 欄位包含 `status: READY`、`python_version: 3.11.x` 與 `scenario_id`；畫面 JSON 僅為 schema example，energy fields 不在此 receipt。", "缺檔、版本不符或 status 非 READY：回到 setup；JSON 維持唯讀，現場值以實際 receipt 為準。", "先把畫面 JSON 當欄位索引，再用命令讀取 package root 內的 current receipt；RUN 產生 result.json 與 endpoint-replay.json，browser import 只讀取這兩筆結果。", True),
        p(26, "P021b｜逐欄解讀：READY 與 energy evidence 分層", 25, "receipt-fields", "LOCAL PRECONDITION", "scenario／engine／claim fields", "READY receipt 提供四個 identity fields。\n四欄共同限定 claim ceiling；energy result 另屬 run evidence。", _t(), "讀取 identity 與 claim ceiling。", "scenario_id（情境識別碼，字串）、policy_api_version（介面版本，字串）、engine_mode（引擎模式，分類）、upstream（上游執行，布林）限定來源；claim boundary 限定可說範圍。", "預期：欄位相符後進入 policy；mismatch 維持 gate failure。", "scenario_id 存在不建立 result evidence；缺欄位：gate failure，source mode 與 recovery evidence 保留。", "identity receipt 描述 course model 的來源欄位；energy run 與部署量測使用各自 evidence 分類。", False),
        p(27, "P022｜setup 失敗：gate repair 與 same-scenario fallback", 26, "fallback", "RECOVERY PATH", "Windows／WSL verify fallback route", "失敗範圍限於 Python minor、root、lock 或 policy。\nREADY 缺少時，分 shell verify，再選 same-scenario-fallback。", _t(".\\course.cmd verify", "bash course.sh verify"), "建立 fail-closed recovery 決策樹。", "Windows 使用 `.\\course.cmd verify`；WSL/POSIX 使用 `bash course.sh verify`；兩條 route 都保留 error receipt，再依 same-scenario-fallback 維持問題與 evidence 邊界。", "預期：error receipt 保留；fallback pair 具有同一 exact-case 的 result 與 replay。", "result、replay 與 receipt 維持唯讀。runner inspection 與 Leo import pending 分開記錄。", "fallback 分支保留原始 evidence 等級，不重命名受阻環境的結果狀態。", True),
        p(28, "P023｜可編輯檔案只有 `student_policy.py` 的 marked block", 27, "guard-policy", "SOURCE BOUNDARY", "可編輯檔與四個 read-only 鎖", "每個 lab 只修改 `student_policy.py` 目前 active 的 marked block；scenario、schemas、runner、Leo code 與 generated JSON 均為 read-only。", _t("sed -n '1,140p' student_policy.py", "Get-Content .\\student_policy.py", "git diff -- student_policy.py"), "分離 policy edit 與 evidence engine。", "small diff → predecessor／freeze receipt → 可解釋結果。", "預期：diff 只落在 active block，檔案通過 policy guard。", "marker 或 package identity 不符：檔案與錯誤保留，回到 package identity；runner 與 JSON 維持唯讀。", "此檔案是唯一允許修改的控制面；API、常數、條件與 return 需與 read-only boundary 分開。", True),
        p(29, "P024｜policy 讀取邊界與合法 action", 28, "policy-io", "SOURCE BOUNDARY", "observation → legal action", "`choose_action(observation)` 僅使用目前與過去允許的 observation；future quality、future energy 與 result summary 不屬於輸入；輸出符合 action contract。", _t("sed -n '1,140p' student_policy.py", "Get-Content .\\student_policy.py"), "定義 bounded policy API 的讀取邊界。", "觀察欄位包含 window、quality、queue、pace、previous action 與 deadline；輸出限定為 `WAIT`、`SLEEP`、`SEND_ONE`、`SEND_URGENT`、`FLUSH_BATCH`。", "預期：`contact_open = false` 時，`SEND_ONE` 不合法；安全路徑為 `SLEEP`。", policy_recovery, "未知欄位、future leakage 或契約外 action：fail closed；active block 以外的內容維持不變。", True),
        p(30, "P025｜常數是受控旋鈕：一次只改一個值", 29, "knobs", "SOURCE BOUNDARY", "A／B／C controls", "修改一個 bounded constant，執行 exact case。\nA／B／C 的控制名稱見下方三個 lab。", _t("grep -n 'REST_DURING_GAP\\|STABLE_STEPS\\|URGENT_MARGIN_S' student_policy.py"), "定義三個 lab 的第一個 edit。", "A：`SLEEP → WAIT` 改變 gap 的 awake-idle／wake；B：`2 → 1` 改變 quality hold；C：`20 → 5` 改變 urgent deadline branch。", "預期：方向性 prediction 先記錄；KPI 改善不預設。", policy_recovery, "gap、quality、batch 與 margin 分開修改。guard failure 時回到 package baseline 或上一個 freeze 的 exact block。", True),
        p(31, "P026｜條件分支：observation 轉成 action", 30, "branch-code", "SOURCE BOUNDARY", "mechanism-only pseudocode：observation 轉成 legal action", "`choose_action` 依窗口、急件期限與 pacing 產生 action。右側說明分支機制；實際修改位置是 `student_policy.py` 的 marked block。", _t("grep -n 'choose_action\\|contact_open\\|URGENT_MARGIN_S' student_policy.py"), "建立程式碼到機制的閱讀橋。", "窗口關閉 → `SLEEP`；urgent 逼近 → `SEND_URGENT`；距離上次送出太近 → `REST_DURING_GAP`。", "預期：`URGENT_MARGIN_S` 增大時，`SEND_URGENT` 觸發點提前。", policy_recovery, "名稱、縮排或 guard failure：active marked block 內修復；branch prediction 與 evidence 分開記錄；畫面 pseudocode 不替代 exact source。", True),
        p(32, "P027｜RUN：baseline 產生兩筆結果", 31, "baseline", "RUN", "Windows PowerShell／WSL-POSIX 分欄 baseline", "Baseline：固定 scenario、seed 與原始 policy 的對照執行。\n兩個 shell 都在 `lora-energy-lab` root；各用本平台 Python 3.11 venv。", _t(".\\.venv\\Scripts\\python.exe -m py_compile student_policy.py", ".\\course.cmd run --lab A --case baseline", "./.venv/bin/python -m py_compile student_policy.py", "bash course.sh run --lab A --case baseline"), "建立第一筆 control evidence。", "Windows PowerShell 使用 `.venv\\Scripts\\python.exe` 與 `course.cmd`；WSL/POSIX 使用 `.venv/bin/python` 與 `bash course.sh`。兩條命令鏈固定 scenario／seed，產生 `result.json`、`endpoint-replay.json`、run identity 與 endpoint replay。", "預期：`status: OK`、`artifact_source: student-run`、JSON 印出 `result_path`，並有 `endpoint-replay.json`。", "compile 或 RUN failure：stdout/stderr 保留，回到 marked block、READY 或 predecessor gate；JSON 維持唯讀。", "baseline 是固定情境、隨機種子與原始 policy 的對照執行。RUN 先產生 result.json 與 endpoint-replay.json；browser import 只讀取這兩筆結果。", True),
        p(33, "P028｜Windows 手動建立 Python 3.11 `.venv`", 32, "windows-manual-venv", "LOCAL PRECONDITION", "PowerShell：檢查／安裝／venv module／建立", "PowerShell 位於 `lora-energy-lab` root：先確認 Python 3.11，再確認 `venv` module，最後建立 `.venv`。Windows path 使用 `.venv\\Scripts\\python.exe`。", _t("py -3.11 --version", "$python311 = (py -3.11 -c \"import sys; print(sys.executable)\").Trim()", "winget install --id=astral-sh.uv -e", "uv python install 3.11", "$python311 = (uv python find 3.11).Trim()", "& $python311 --version", "& $python311 -m venv --help", "& $python311 -m venv .venv"), "把 Windows interpreter 與 package-local venv 連在同一個操作流程。", "`py -3.11` 成功時沿用其 path；缺少 3.11 時由 uv 安裝並定位；`-m venv` 確認 standard-library module 後建立 root 內的 `.venv`。", "預期：`& $python311 --version` 顯示 3.11.x，`-m venv --help` 成功，並產生 `.venv\\Scripts\\python.exe`。", setup_recovery, "PowerShell 命令都在 Windows package root 執行；uv-managed Python 與 Python Launcher 的 3.11 path 都可作為 `PYTHON_BIN`。", True),
        p(34, "P029｜Windows 啟用 `.venv`、locked install、verify", 33, "windows-activate", "SETUP", "PowerShell activation → locked install → verify", "建立 `.venv` 後在同一個 PowerShell 視窗啟用、確認 prefix、安裝 locked requirements，再執行 `course.cmd verify`。", _t(".\\.venv\\Scripts\\Activate.ps1", "python --version", "python -c \"import sys; assert sys.prefix != sys.base_prefix; print(sys.executable)\"", "python -m pip install --disable-pip-version-check --require-hashes --no-deps -r .\\requirements-lock.txt", ".\\course.cmd verify"), "讓 Windows 手動流程產生可觀察的 READY gate。", "activation 將 `python` 綁到 `.venv\\Scripts\\python.exe`；locked install 固定 package contract；verify 產生 `artifacts\\verify-receipt.json`。", "預期：版本是 3.11.x、`sys.prefix` 不等於 `sys.base_prefix`，verify receipt 的 status 是 READY。", setup_recovery, "若 PowerShell 不允許 `Activate.ps1`，Windows Command Prompt 可用 `call .venv\\Scripts\\activate.bat`；`.sh` 不在 Windows CMD 執行。", True),
        p(35, "P030｜WSL Ubuntu 24.04：定位並安裝 Python 3.11", 34, "wsl-python", "RECOVERY PATH", "WSL／Ubuntu：detect → apt prerequisite → curl → uv", "WSL Ubuntu 24.04 先查 apt Candidate。有則安裝 Python 3.11 與 venv；否則以 uv 安裝。兩個分支都設定 `PYTHON_BIN`，供下一頁建立 `.venv`。", _t("command -v python3.11", "python3.11 --version", "apt-cache policy python3.11 python3.11-venv", "sudo apt update", "sudo apt install -y python3.11 python3.11-venv", "PYTHON_BIN=\"$(command -v python3.11)\"", "sudo apt install -y curl unzip", "curl -LsSf https://astral.sh/uv/install.sh | sh", "export PATH=\"$HOME/.local/bin:$PATH\"", "uv python install 3.11", "PYTHON_BIN=\"$(uv python find 3.11)\"", "\"$PYTHON_BIN\" --version"), "建立 WSL 的 exact interpreter path。", "若 `apt-cache policy` 有 Candidate，安裝 `python3.11` 與 `python3.11-venv`，再以 `PYTHON_BIN=\"$(command -v python3.11)\"` 保存 exact path；沒有 Candidate 時補 curl/unzip、安裝 uv，再以 `PYTHON_BIN=\"$(uv python find 3.11)\"` 保存 exact path。", "預期：兩個分支都讓 `PYTHON_BIN` 指向 WSL／Linux 的 Python 3.11.x；Windows interpreter path 不進入 WSL。", setup_recovery, "apt 與 uv 分支都在 Ubuntu／WSL bash 設定 `PYTHON_BIN`，接續頁直接以同一變數建立 `.venv`。", True),
        p(36, "P031｜WSL `.venv/bin`：建立、啟用、locked install、verify", 35, "wsl-venv", "SETUP", "WSL／Ubuntu：venv module → source → install → verify", "WSL root 使用 `PYTHON_BIN` 建立 Linux `.venv`；source 後確認 3.11、locked install，再執行 `bash course.sh verify`。", _t("\"$PYTHON_BIN\" -m venv --help", "\"$PYTHON_BIN\" -m venv .venv", "source .venv/bin/activate", "python --version", "python -c 'import sys; assert sys.prefix != sys.base_prefix; print(sys.executable)'", "python -m pip install --disable-pip-version-check --require-hashes --no-deps -r requirements-lock.txt", "bash course.sh verify"), "讓 WSL 手動流程產生可觀察的 READY gate。", "`source` 將 `python` 綁到 `.venv/bin/python`；locked install 固定 package contract；verify 產生 `artifacts/verify-receipt.json`。", "預期：版本是 3.11.x、prefix 與 base prefix 不同，verify receipt 的 status 是 READY。", setup_recovery, "Windows `.venv\\Scripts\\python.exe` 與 WSL `.venv/bin/python` 是兩個 filesystem 內的環境；`.sh` 僅在 WSL／Linux bash 執行，Windows CMD 使用 `.cmd`。", True),
    ]


def assert_pages(pages: list[Page]) -> None:
    if [p.number for p in pages] != list(range(1, EXPECTED_PAGE_COUNT + 1)):
        raise ValueError(f"Part A must contain {EXPECTED_PAGE_COUNT} physical pages")
    for page in pages:
        serial = " ".join(asdict(page).values().__str__())
        if FORBIDDEN_WORD in serial:
            raise ValueError(f"page {page.number}: forbidden exact Chinese word")
        if "分鐘" in serial or re.search(r"\b\d+\s*(?:min|mins|minute|minutes)\b", serial, re.I):
            raise ValueError(f"page {page.number}: time label is forbidden")
        if page.operation and not page.commands:
            raise ValueError(f"page {page.number}: operation page needs commands")
        if not all(value.strip() for value in (page.title, page.evidence, page.visual, page.statement, page.purpose, page.mechanism, page.expected, page.recovery, page.notes)):
            raise ValueError(f"page {page.number}: missing authored field")


def ensure_dirs() -> None:
    if PROJECT.exists():
        # Only this task-owned project is rebuilt.  Sibling projects and all
        # unrelated dirty work remain untouched.
        shutil.rmtree(PROJECT)
    for name in ("sources", "analysis", "exports", "validation", "renders"):
        (PROJECT / name).mkdir(parents=True, exist_ok=True)


def copy_sources(pages: list[Page]) -> None:
    shutil.copy2(TEMPLATE, PROJECT / "sources/educate.pptx")
    source_lines = [
        f"# C-120 module 1 source checkpoint ({len(pages)} physical pages)",
        "",
        f"Template: `/home/u24/ppt-master/template/educate.pptx`",
        "",
        "The full authored source remains in `courseware/c120-lora-leo-deck/full-deck-v2-classroom-script.md`; this file is the module-1 extraction and evidence contract.",
        "",
    ]
    for index, page in enumerate(pages):
        next_page = pages[index + 1] if index + 1 < len(pages) else None
        source_lines.extend([f"## P{page.number:03d} — {page.title}", "", f"Evidence: {page.evidence}", f"Visual: {page.visual}", f"On-slide: {page.statement}", "", f"Commands: {'; '.join(page.commands) if page.commands else 'none (concept / boundary page)'}", f"Purpose: {page.purpose}", f"Mechanism: {page.mechanism}", f"Expected: {page.expected}", f"Recovery: {page.recovery}", "", speaker_script(page, next_page), ""])
    (PROJECT / "sources/module1-script.md").write_text("\n".join(source_lines), encoding="utf-8")
    beamshift_source_map = """# BeamShift e2 source map for Part A

This is an authoring/source map for the controller-owned full-deck assembler. It
does not add donor metadata to the teaching slides or speaker notes. Each row
names the historical `e2.pptx` topic pages that informed the rewrite; all
delivered pages were redrawn as editable objects on the native `educate.pptx`
content shell.

| Part A page(s) | BeamShift e2 donor page(s) | Rewritten teaching content |
|---|---:|---|
| P001–P002 | 2, 4–6 | Endpoint-first finite-energy problem; changing service window; SEND/WAIT/SLEEP trade-off tied to packet service and endpoint energy. |
| P003 | 14, 16, 19–21 | Rate/power/energy/service causal idea rewritten as legal action → radio state → packet/service consequence. |
| P004 | 36–39, 70–75 | Control → intermediate state → observable result workflow rewritten as setup → baseline → marked edit → compare → website replay. |
| P005 | 14, 16, 19–21 | W/J and service-boundary idea rewritten as the endpoint observation → policy → action → state/packet → service → J chain. |
| P006 | 70–75, 96–97, 113 | Evidence qualification and value classification rewritten for the LoRaEnergySim endpoint runner and simulated teaching-data ceiling. |
| P007 | 2, 4–6 | Changing-opportunity idea retained through a LEO worked example, with transfer to other IoT service windows. |
| P008 | 36–39, 70–75 | Prediction, bounded edit, exact run, result/replay, and withheld-case loop rewritten for current policy operations. |
| P009 | 96–97, 113 | Claim-boundary and evidence-record concepts rewritten as package identity, READY gate, source mode, and simulated result limits. |
| P021a–P021b | 96–97, 113 | Evidence-record fields rewritten as READY receipt identity, field meaning, source, value/type, and claim ceiling. |
| P022 | 70–75, 96–97 | Missing-value discipline and recovery ladder rewritten as fail-closed repair or same-scenario fallback. |
| P023–P024 | 36–39 | Control boundary and legal action concepts rewritten as one editable `student_policy.py` marked block plus read-only inputs and legal outputs. |
| P025–P027 | 19–21, 20, 36–39 | Power/time and fair-comparison ideas rewritten as bounded constants, branch mechanism, and fixed-scenario baseline entry. |

P010a–P020 (except the evidence concepts carried into P021a–P021b), and the
platform-specific setup pages, are current package-operation content from the
C-120 contracts; no historical donor slide bytes, screenshots, commands, or
values were copied.
"""
    (PROJECT / "analysis/beamshift-e2-source-map.md").write_text(beamshift_source_map, encoding="utf-8")
    notes_lines = [
        f"# C-120 module 1 speaker notes ({len(pages)} physical pages)",
        "",
        "These notes are embedded in the PPTX notes slides. The visible slides carry the editable diagram or exact command/receipt objects; narration, caveats, and recovery wording live here.",
        "",
    ]
    for index, page in enumerate(pages):
        next_page = pages[index + 1] if index + 1 < len(pages) else None
        notes_lines.extend([f"## P{page.number:03d} — {page.title}", "", speaker_script(page, next_page), ""])
    (PROJECT / "sources/module1-speaker-notes.md").write_text("\n".join(notes_lines), encoding="utf-8")


def set_font(run, size: int, *, bold: bool = False, italic: bool = False, color: RGBColor = INK) -> None:
    run.font.name = "Times New Roman"
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    rpr = run._r.get_or_add_rPr()
    rpr.set("sz", str(size * 100))
    rpr.set("b", "1" if bold else "0")
    rpr.set("i", "1" if italic else "0")
    for tag, typeface in (("latin", "Times New Roman"), ("ea", "標楷體"), ("cs", "Times New Roman")):
        node = rpr.find(f"{{http://schemas.openxmlformats.org/drawingml/2006/main}}{tag}")
        if node is None:
            node = OxmlElement(f"a:{tag}")
            rpr.append(node)
        node.set("typeface", typeface)


def write_paragraph(paragraph, text: str, size: int, *, bold: bool = False, color: RGBColor = INK, align=PP_ALIGN.LEFT, italic_whole: bool = False) -> None:
    paragraph.alignment = align
    paragraph.space_after = Pt(0)
    paragraph.line_spacing = 1.0
    for piece in filter(None, VARIABLE_RE.split(text)):
        run = paragraph.add_run()
        run.text = piece
        italic = italic_whole or bool(VARIABLE_RE.fullmatch(piece))
        set_font(run, size, bold=bold, italic=italic, color=color)


def write_text(tf, text: str, size: int, *, bold: bool = False, color: RGBColor = INK, align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP, margins=(0.08, 0.06, 0.08, 0.06), italic_whole: bool = False) -> None:
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = Inches(margins[0])
    tf.margin_top = Inches(margins[1])
    tf.margin_right = Inches(margins[2])
    tf.margin_bottom = Inches(margins[3])
    tf.vertical_anchor = valign
    lines = text.split("\n")
    first = tf.paragraphs[0]
    for index, line in enumerate(lines):
        paragraph = first if index == 0 else tf.add_paragraph()
        write_paragraph(paragraph, line, size, bold=bold, color=color, align=align, italic_whole=italic_whole)


def text_box(slide, x: float, y: float, w: float, h: float, text: str, size: int = 24, *, bold: bool = False, color: RGBColor = INK, align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP, fill=None, line=None, radius=False, name: str = "Editable text", italic_whole: bool = False, margins=(0.08, 0.06, 0.08, 0.06)):
    shape_type = MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE if radius else MSO_AUTO_SHAPE_TYPE.RECTANGLE
    shape = slide.shapes.add_shape(shape_type, Inches(x), Inches(y), Inches(w), Inches(h)) if fill is not None or line is not None else slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    shape.name = name
    if fill is None:
        shape.fill.background()
    else:
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill
        shape.fill.transparency = 0
    if line is None:
        shape.line.fill.background()
    else:
        shape.line.color.rgb = line
        shape.line.width = Pt(1.2)
    write_text(shape.text_frame, text, size, bold=bold, color=color, align=align, valign=valign, margins=margins, italic_whole=italic_whole)
    return shape


def frame(slide, x: float, y: float, w: float, h: float, *, line=NAVY, fill=None, radius=False, name="Editable frame"):
    shape_type = MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE if radius else MSO_AUTO_SHAPE_TYPE.RECTANGLE
    shape = slide.shapes.add_shape(shape_type, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.name = name
    shape.fill.background() if fill is None else (shape.fill.solid(), setattr(shape.fill.fore_color, "rgb", fill))
    shape.line.color.rgb = line
    shape.line.width = Pt(1.2)
    return shape


def circle(slide, x: float, y: float, d: float, *, fill=BLUE, line=BLUE, name="State marker"):
    shape = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.OVAL, Inches(x), Inches(y), Inches(d), Inches(d))
    shape.name = name
    shape.fill.solid(); shape.fill.fore_color.rgb = fill
    shape.line.color.rgb = line
    return shape


def connector(slide, x1: float, y1: float, x2: float, y2: float, *, color=NAVY, width=1.4, arrow=True, name="Editable connector"):
    shape = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    shape.name = name
    shape.line.color.rgb = color
    shape.line.width = Pt(width)
    if arrow:
        shape.line.end_arrowhead = True
    return shape


def clear_placeholders(slide) -> None:
    """Keep only title/subtitle anchors; all teaching visuals are editable shapes."""
    for shape in list(slide.shapes):
        if not shape.is_placeholder:
            continue
        ph_type = shape.placeholder_format.type
        # python-pptx uses enum values; title=1, body=2, subtitle=4.
        if int(ph_type) not in (1, 4):
            shape._element.getparent().remove(shape._element)


def set_title(slide, title: str, *, cover: bool = False) -> None:
    title_shape = slide.shapes.title
    if title_shape is None:
        title_shape = slide.shapes.add_textbox(Inches(0.65), Inches(0.22), Inches(11.55), Inches(0.68))
        title_shape.name = "Native title anchor"
    write_text(title_shape.text_frame, title, 28, bold=True, color=NAVY, valign=MSO_ANCHOR.MIDDLE, align=PP_ALIGN.CENTER if cover else PP_ALIGN.LEFT, margins=(0.03, 0.01, 0.03, 0.01))
    # The title placeholder may have inherited a too-small text frame from a
    # vertical layout; the native top band remains the visual authority.
    if not cover and title_shape.height < Inches(0.45):
        title_shape.height = Inches(0.58)


def command_box(slide, commands: Iterable[str], x: float, y: float, w: float, h: float, *, label="可直接複製的操作", size=20, line=NAVY):
    # A white editable surface keeps the template's native footer ornament
    # from visually running through command text when a command card is near
    # the lower half of the slide.
    frame(slide, x, y, w, h, line=line, fill=WHITE, radius=True, name="Command context frame")
    text_box(slide, x + 0.12, y + 0.05, w - 0.24, 0.34, label, 20, bold=True, color=line, name="Command context label", margins=(0.02, 0.0, 0.02, 0.0), valign=MSO_ANCHOR.MIDDLE)
    lines = list(commands)
    usable = max(0.25, h - 0.50)
    line_h = min(0.52, usable / max(1, len(lines)))
    for i, command in enumerate(lines):
        # Long commands stay at the classroom-readable 20pt floor; callers
        # must allocate enough width/height rather than silently shrinking
        # exact commands into tiny metadata text.
        text_box(slide, x + 0.15, y + 0.44 + i * line_h, w - 0.30, line_h - 0.02, command, size if len(command) < 84 else max(20, size - 1), color=INK, valign=MSO_ANCHOR.MIDDLE, name=f"Command line {i + 1}", margins=(0.02, 0.0, 0.02, 0.0))


def direct_scaffold(slide: object, page: Page, *, statement_size: int = 24) -> None:
    """Set only the native title and a page-specific teaching statement."""
    clear_placeholders(slide)
    set_title(slide, page.title)
    text_box(slide, 0.72, 0.93, 11.90, 0.84, page.statement, statement_size, color=INK, name="Main teaching statement", margins=(0.06, 0.02, 0.06, 0.02))


def visual_heading(slide: object, text: str, color: RGBColor = NAVY) -> None:
    text_box(slide, 0.84, 1.87, 11.70, 0.32, text, 20, bold=True, color=color, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Visual heading", margins=(0.02, 0.0, 0.02, 0.0))


def visual_panel(slide: object, x: float, y: float, w: float, h: float, head: str, body: str, color: RGBColor, *, body_size: int = 20) -> None:
    # White fill is a local mask only; it does not alter the slide/master
    # background.  It keeps native template artwork behind the editable panel
    # from crossing body text in rendered output.
    frame(slide, x, y, w, h, line=color, fill=WHITE, radius=True, name=f"Visual panel {head}")
    text_box(slide, x + 0.14, y + 0.16, w - 0.28, 0.34, head, 21, bold=True, color=color, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Visual heading {head}", margins=(0.01, 0.0, 0.01, 0.0))
    text_box(slide, x + 0.18, y + 0.66, w - 0.36, h - 0.78, body, body_size, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Visual body {head}", margins=(0.03, 0.01, 0.03, 0.01))


def draw_direct_visual(slide: object, page: Page) -> None:
    family = page.family
    statement_size = 22 if family in {"branch-code", "wsl-python"} else 24
    direct_scaffold(slide, page, statement_size=statement_size)
    if family == "hero":
        visual_heading(slide, "endpoint-first：資料、窗口、電池同時存在", NAVY)
        frame(slide, 0.96, 2.30, 3.00, 1.70, line=BLUE, fill=PALE_BLUE, radius=True, name="Endpoint hero")
        circle(slide, 1.24, 2.72, 0.68, fill=BLUE, line=BLUE, name="Endpoint radio")
        text_box(slide, 2.02, 2.56, 1.58, 0.42, "IoT endpoint", 22, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Endpoint label")
        text_box(slide, 1.20, 3.24, 2.52, 0.42, "battery → packet", 20, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Endpoint detail")
        connector(slide, 4.02, 3.16, 8.74, 3.16, color=GOLD, width=2.0, name="Packet path")
        frame(slide, 8.92, 2.30, 3.42, 1.70, line=NAVY, fill=PALE_GOLD, radius=True, name="Service window hero")
        text_box(slide, 9.18, 2.60, 2.90, 0.42, "service window", 22, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Window label")
        text_box(slide, 9.28, 3.22, 2.70, 0.36, "OPEN → CLOSE", 20, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Window state")
        text_box(slide, 4.42, 3.50, 4.16, 0.42, "送達機會正在改變", 22, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Window consequence")
    elif family == "tradeoff":
        visual_heading(slide, "三個合法方向與保護對象", NAVY)
        panels = (("SEND", "守住窗口\n付出 TX／RX／process", BLUE), ("WAIT", "保持反應\n付出 awake-idle", NAVY), ("SLEEP", "降低等待功率\n付出 wake latency", GOLD))
        for i, (head, body, color) in enumerate(panels):
            visual_panel(slide, 0.82 + i * 4.17, 2.34, 3.72, 1.92, head, body, color, body_size=22)
    elif family == "actions":
        visual_heading(slide, "action → radio state → packet／service", NAVY)
        items = (("WAIT", "awake-idle", BLUE), ("SLEEP", "wake + sleep", GOLD), ("SEND_*", "SEND_ONE／SEND_URGENT／FLUSH_BATCH", NAVY))
        for i, (head, body, color) in enumerate(items):
            x = 1.02 + i * 4.04
            circle(slide, x + 1.30, 2.34, 0.62, fill=color, line=color, name=f"Action node {head}")
            frame(slide, x, 3.14, 3.18, 0.94, line=color, radius=True, name=f"Action result {head}")
            text_box(slide, x + 0.14, 3.34, 2.90, 0.28, body, 20, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Action result text {head}")
            if i < 2:
                connector(slide, x + 3.18, 3.62, x + 4.04, 3.62, color=GOLD, width=1.6, name="Action path")
        text_box(slide, 0.92, 2.18, 3.18, 0.30, "WAIT", 20, bold=True, color=BLUE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Action WAIT label", margins=(0.01, 0.0, 0.01, 0.0))
        text_box(slide, 4.96, 2.18, 3.18, 0.30, "SLEEP", 20, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Action SLEEP label", margins=(0.01, 0.0, 0.01, 0.0))
        text_box(slide, 9.00, 2.18, 3.18, 0.30, "SEND_*", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Action SEND label", margins=(0.01, 0.0, 0.01, 0.01))
        text_box(slide, 1.28, 4.18, 10.80, 0.30, "contact_open = false → SLEEP；SEND_* 必須被拒絕", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Action safety rule", margins=(0.01, 0.0, 0.01, 0.0))
    elif family == "promise":
        visual_heading(slide, "四個操作階段：edit → run → read → explain", NAVY)
        steps = (("1", "改", "active marked block"), ("2", "跑", "exact case"), ("3", "讀", "result／replay"), ("4", "解釋", "policy → event → J"))
        for i, (num, head, body) in enumerate(steps):
            x = 0.94 + i * 3.08
            circle(slide, x + 0.98, 2.36, 0.64, fill=BLUE if i % 2 == 0 else GOLD, line=BLUE if i % 2 == 0 else GOLD, name=f"Promise node {num}")
            text_box(slide, x + 0.98, 2.50, 0.64, 0.30, num, 20, bold=True, color=WHITE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Promise number {num}", margins=(0.01, 0.0, 0.01, 0.0))
            frame(slide, x, 3.22, 2.60, 0.86, line=BLUE if i % 2 == 0 else GOLD, radius=True, name=f"Promise step {head}")
            text_box(slide, x + 0.12, 3.38, 2.36, 0.28, head + "｜" + body, 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Promise label {head}", margins=(0.01, 0.0, 0.01, 0.0))
            if i < 3:
                connector(slide, x + 2.60, 3.65, x + 3.08, 3.65, color=GOLD, width=1.5, name="Promise arrow")
    elif family == "chain":
        visual_heading(slide, "每一段回到 result 或 replay", NAVY)
        items = ["observation", "policy", "action", "state / packet", "service", "endpoint J"]
        x0, y, w, gap = 0.78, 2.70, 1.86, 0.22
        for i, item in enumerate(items):
            x = x0 + i * (w + gap)
            frame(slide, x, y, w, 0.86, line=BLUE if i in (0, 3) else NAVY, radius=True, name=f"Causal node {i + 1}")
            text_box(slide, x + 0.06, y + 0.24, w - 0.12, 0.30, item, 20, bold=i in (0, 5), color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Causal node label {i + 1}", margins=(0.01, 0.0, 0.01, 0.0))
            if i < len(items) - 1:
                connector(slide, x + w, y + 0.43, x + w + gap, y + 0.43, color=GOLD, width=1.4, name="Causal arrow")
        text_box(slide, 1.42, 3.86, 10.50, 0.42, "service → J；中間差異支援因果", 22, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Causal rule")
    elif family == "runner":
        visual_heading(slide, "endpoint runner 的 evidence 範圍", NAVY)
        visual_panel(slide, 0.84, 2.28, 5.64, 1.92, "ENDPOINT EVIDENCE", "sleep／awake-idle／TX／RX\nattempt／retry／delivery／expiry\nendpoint J 與 service 結果", BLUE, body_size=20)
        visual_panel(slide, 6.84, 2.28, 5.64, 1.92, "CLAIM CEILING", "live telemetry 與 wall-plug energy\nupstream repository execution\nwhole-system consumed J", NAVY, body_size=20)
    elif family == "leo":
        visual_heading(slide, "LEO = changing service window worked example", NAVY)
        connector(slide, 1.16, 3.14, 12.08, 3.14, color=NAVY, width=2.0, arrow=False, name="LEO window axis")
        stages = (("機會出現", 1.36, BLUE), ("policy 選擇", 4.30, GOLD), ("送／等", 7.34, BLUE), ("service／J", 10.26, NAVY))
        for head, x, color in stages:
            circle(slide, x, 2.86, 0.58, fill=color, line=color, name=f"LEO stage {head}")
            text_box(slide, x - 0.48, 3.55, 1.58, 0.34, head, 20, bold=True, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"LEO label {head}", margins=(0.01, 0.0, 0.01, 0.0))
        frame(slide, 1.20, 4.00, 10.95, 0.54, line=GOLD, radius=True, name="LEO transfer band")
        text_box(slide, 1.40, 4.12, 10.55, 0.26, "同一機制可轉到田區上傳、HVAC 低負載、物流或 edge", 20, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="LEO transfer text", margins=(0.01, 0.0, 0.01, 0.0))
    elif family == "loop":
        visual_heading(slide, "predict → edit → run → read → withheld", NAVY)
        coords = ((1.72, 2.35), (4.52, 2.03), (7.36, 2.35), (9.58, 3.76), (7.36, 4.20), (4.52, 4.50))
        labels = ("predict", "bounded edit", "exact run", "result／replay", "frozen", "withheld")
        for i, ((x, y), label) in enumerate(zip(coords, labels)):
            circle(slide, x, y, 0.62, fill=BLUE if i % 2 == 0 else GOLD, line=BLUE if i % 2 == 0 else GOLD, name=f"Loop node {label}")
            text_box(slide, x - 0.38, y + 0.72, 1.40, 0.30, label, 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Loop label {label}", margins=(0.01, 0.0, 0.01, 0.0))
            if i < len(coords) - 1:
                x2, y2 = coords[i + 1]
                connector(slide, x + 0.62, y + 0.31, x2, y2 + 0.31, color=NAVY, width=1.1, name="Loop path")
        text_box(slide, 1.54, 3.24, 3.50, 0.52, "withheld 固定\n不重新調參", 20, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Loop rule")
    elif family == "claims":
        visual_heading(slide, "claim ceiling 跟著來源鏈走", NAVY)
        # Keep the layer labels short so the 18pt field names remain on one
        # line inside their frames at the template's native 16:9 size.
        layers = (("MODEL", "本課模型中的 state／packet／service／endpoint J", BLUE), ("LIVE", "telemetry、部署量測、whole-system J", NAVY), ("CURRENT", "fresh setup、READY、Leo import、browser replay", GOLD))
        for i, (head, body, color) in enumerate(layers):
            x = 1.10 + i * 0.44
            y = 2.30 + i * 0.68
            w = 11.16 - i * 0.88
            frame(slide, x, y, w, 0.60, line=color, radius=True, name=f"Claim layer {head}")
            # Keep the longest layer label on one line at the required 20pt
            # body floor; the small shift preserves a readable body column.
            text_box(slide, x + 0.10, y + 0.13, 1.58, 0.30, head, 20, bold=True, color=color, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Claim layer heading {head}", margins=(0.01, 0.0, 0.01, 0.0))
            text_box(slide, x + 1.82, y + 0.13, w - 2.02, 0.30, body, 20, color=INK, valign=MSO_ANCHOR.MIDDLE, name=f"Claim layer body {head}", margins=(0.01, 0.0, 0.01, 0.0))
    elif family in ("release", "package"):
        visual_heading(slide, "single release asset → single package root", NAVY)
        if family == "release":
            release_body = "lora-energy-lab-v1.zip\n命名 release asset\nls -l／Get-ChildItem\nartifact identity"
            visual_panel(slide, 0.92, 2.28, 4.80, 1.88, "RELEASE", release_body, BLUE, body_size=20)
            connector(slide, 5.92, 3.22, 7.24, 3.22, color=GOLD, width=2.0, name="Release to root")
            tree = "lora-energy-lab/\nREADME + launchers\nstudent_policy.py\nschemas + fallback"
            visual_panel(slide, 7.42, 2.28, 4.78, 1.88, "PACKAGE ROOT", tree, NAVY, body_size=20)
        else:
            command_box(slide, page.commands[:1], 0.70, 2.22, 5.90, 2.24, label="WSL／POSIX｜extracted root inventory", size=20, line=BLUE)
            command_box(slide, page.commands[1:], 6.75, 2.22, 5.90, 2.24, label="Windows PowerShell｜extracted root inventory", size=20, line=NAVY)
            text_box(slide, 0.96, 4.78, 11.36, 0.44, "可驗證結果：只有 lora-energy-lab/ root；不使用額外 release directory", 20, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Package root rule", margins=(0.01, 0.0, 0.01, 0.0))
    elif family == "preflight":
        visual_heading(slide, "archive parent → extract → package root", NAVY)
        visual_panel(slide, 0.92, 2.25, 5.10, 1.72, "WINDOWS POWERSHELL", "Get-Location\nZIP 與目前位置相同", BLUE, body_size=20)
        visual_panel(slide, 6.24, 2.25, 5.98, 1.72, "WSL／POSIX", "pwd\nZIP 與目前位置相同", NAVY, body_size=20)
        text_box(slide, 2.30, 4.10, 8.82, 0.34, "目前位置 → 平台對應解壓命令 → lora-energy-lab root", 22, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Archive parent route")
    elif family == "extract":
        visual_heading(slide, "Windows PowerShell／WSL-POSIX exact extract → root", NAVY)
        command_box(slide, page.commands[:3], 0.70, 2.22, 5.90, 2.48, label="Windows PowerShell｜archive parent", size=20, line=BLUE)
        command_box(slide, page.commands[3:], 6.75, 2.22, 5.90, 2.48, label="WSL／POSIX｜archive parent", size=20, line=NAVY)
        text_box(slide, 0.96, 4.96, 11.36, 0.34, "兩個 shell 都以 lora-energy-lab 為 cwd；Windows 不執行 .sh，WSL/POSIX 不執行 .cmd", 20, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Extract rule", margins=(0.01, 0.0, 0.01, 0.0))
    elif family == "windows-shell":
        visual_heading(slide, "prompt → launcher → Python 3.11.x", NAVY)
        visual_panel(slide, 0.88, 2.28, 5.62, 1.86, "CMD", "CMD> py --list\nCMD> py -3.11 --version", BLUE, body_size=20)
        visual_panel(slide, 6.82, 2.28, 5.62, 1.86, "POWERSHELL", "PS> py --list\nPS> py -3.11 --version", NAVY, body_size=20)
        text_box(slide, 1.04, 4.38, 11.24, 0.34, "Windows native：setup.cmd／course.cmd｜POSIX／WSL：bash setup.sh／bash course.sh", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Windows launcher boundary", margins=(0.01, 0.0, 0.01, 0.0))
    elif family == "installer":
        visual_heading(slide, "缺少 3.11 時的官方 recovery route", NAVY)
        steps = (
            ("1｜官方下載", "https://www.python.org/downloads/windows/\nPython 3.11.x Windows installer (64-bit)", BLUE),
            ("2｜安裝選項", "Install Python Launcher for all users\nPATH 可不勾選；使用 py -3.11", GOLD),
            ("3｜完成並重開 shell", "完成安裝後重開 PowerShell\n不要混用其他 minor", BLUE),
            ("4｜版本 gate", "py --list\npy -3.11 --version", NAVY),
        )
        positions = ((0.84, 2.22), (6.72, 2.22), (0.84, 4.18), (6.72, 4.18))
        for (head, body, color), (x, y) in zip(steps, positions):
            visual_panel(slide, x, y, 5.78, 1.48, head, body, color, body_size=20)
    elif family == "uv":
        visual_heading(slide, "uv 找 interpreter；package setup 才產生 receipt", NAVY)
        visual_panel(slide, 0.88, 2.24, 5.70, 1.94, "WINDOWS POWERSHELL", "winget install --id=astral-sh.uv -e\nuv python install 3.11\nuv python find 3.11", BLUE, body_size=20)
        visual_panel(slide, 6.78, 2.24, 5.70, 1.94, "POSIX／WSL", "uv python install 3.11\nuv python find 3.11\n→ exact interpreter path", NAVY, body_size=20)
    elif family == "venv":
        visual_heading(slide, "system Python ≠ package-local `.venv`", NAVY)
        visual_panel(slide, 0.94, 2.28, 5.54, 1.82, "SYSTEM PYTHON", "其他專案\nshared packages", MUTED, body_size=22)
        connector(slide, 6.56, 3.18, 7.12, 3.18, color=GOLD, width=2.0, name="Venv boundary")
        visual_panel(slide, 7.36, 2.28, 5.00, 1.82, "PACKAGE .VENV", ".venv\\Scripts\\python.exe\n或 .venv/bin/python\nPython 3.11.x", BLUE, body_size=20)
        text_box(slide, 1.12, 4.34, 11.04, 0.34, "Windows venv 與 WSL／Linux venv 各自建立；path 不互換", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Venv platform boundary", margins=(0.01, 0.0, 0.01, 0.0))
    elif family == "setup-win":
        visual_heading(slide, "Windows package root｜setup → isolated runtime", NAVY)
        command_box(slide, page.commands[:1], 0.70, 2.20, 5.90, 3.28, label="CMD｜lora-energy-lab root", size=20, line=BLUE)
        command_box(slide, page.commands[1:2], 6.75, 2.20, 5.90, 1.26, label="PowerShell｜py launcher shortcut", size=20, line=NAVY)
        command_box(slide, page.commands[2:], 6.75, 3.66, 5.90, 1.82, label="PowerShell｜uv 3.11 fallback", size=20, line=GOLD)
        text_box(slide, 0.96, 5.62, 11.36, 0.30, "CMD 與 PowerShell 各自完成 setup；result.json 尚未產生", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Setup result boundary", margins=(0.01, 0.0, 0.01, 0.0))
    elif family == "verify-win":
        visual_heading(slide, "Windows package root｜verify prerequisites → READY", NAVY)
        command_box(slide, page.commands[:1], 0.70, 2.24, 5.90, 2.04, label="CMD｜lora-energy-lab root", size=20, line=BLUE)
        command_box(slide, page.commands[1:], 6.75, 2.24, 5.90, 2.04, label="PowerShell｜lora-energy-lab root", size=20, line=NAVY)
        text_box(slide, 0.96, 4.62, 11.36, 0.34, "兩欄都產生 artifacts\\verify-receipt.json：status READY；result.json 尚未產生", 20, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Verify result boundary", margins=(0.01, 0.0, 0.01, 0.0))
    elif family == "wsl":
        visual_heading(slide, "Windows host → Ubuntu guest → Linux home", NAVY)
        visual_panel(slide, 0.86, 2.24, 3.50, 1.94, "WINDOWS", "wsl -l -v\nwsl -d Ubuntu", NAVY, body_size=20)
        connector(slide, 4.48, 3.20, 5.40, 3.20, color=GOLD, width=1.8, name="WSL entry arrow")
        visual_panel(slide, 5.54, 2.24, 3.22, 1.94, "UBUNTU", "pwd\nuname -a", BLUE, body_size=21)
        connector(slide, 8.90, 3.20, 9.82, 3.20, color=GOLD, width=1.8, name="WSL path arrow")
        visual_panel(slide, 9.96, 2.24, 2.48, 1.94, "NEXT", "setup.sh\ncourse.sh", GOLD, body_size=20)
        text_box(slide, 1.00, 4.40, 11.30, 0.34, "Windows native：.cmd｜Ubuntu／WSL：bash .sh｜Git Bash 非主要路徑", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="WSL launcher boundary", margins=(0.01, 0.0, 0.01, 0.0))
    elif family == "wsl-tools":
        visual_heading(slide, "Ubuntu toolchain ladder", NAVY)
        steps = (("apt", "curl／unzip", BLUE), ("uv", "installer + version", GOLD), ("Python", "3.11 interpreter", NAVY))
        for i, (head, body, color) in enumerate(steps):
            x = 0.98 + i * 4.10
            visual_panel(slide, x, 2.30, 3.58, 1.70, head.upper(), body, color, body_size=21)
            if i < 2:
                connector(slide, x + 3.58, 3.14, x + 4.10, 3.14, color=GOLD, width=1.6, name="Toolchain arrow")
    elif family == "wsl-copy":
        visual_heading(slide, "Windows Downloads → WSL Linux home → package root", NAVY)
        command_box(slide, page.commands[:2], 0.70, 2.20, 5.90, 1.32, label="Windows PowerShell｜Downloads", size=20, line=BLUE)
        command_box(slide, page.commands[2:], 6.75, 2.20, 5.90, 3.12, label="WSL／POSIX bash｜copy into Linux home", size=20, line=NAVY)
        text_box(slide, 0.88, 5.58, 11.60, 0.32, "`<Windows帳號>` 需替換成實際帳號；ZIP 先到 $HOME，下一頁解壓只形成一層 lora-energy-lab。", 20, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Copy path rule", margins=(0.02, 0.0, 0.02, 0.0))
    elif family == "wsl-root":
        visual_heading(slide, "WSL／POSIX exact route：extract → root → READY", NAVY)
        command_box(slide, page.commands[:3], 0.70, 2.20, 5.90, 2.42, label="WSL／POSIX｜Linux home → one root", size=20, line=BLUE)
        command_box(slide, page.commands[3:], 6.75, 2.20, 5.90, 2.42, label="WSL／POSIX｜lora-energy-lab root", size=20, line=NAVY)
        text_box(slide, 0.96, 4.88, 11.36, 0.40, "同一 root 對應 .venv/bin/python、lock 與 verify-receipt.json；READY 才允許 RUN", 20, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Root ready boundary", margins=(0.01, 0.0, 0.01, 0.0))
    elif family == "posix":
        visual_heading(slide, "POSIX：exact interpreter → setup → verify", NAVY)
        command_box(slide, page.commands, 1.04, 2.26, 6.90, 1.88, label="lora-energy-lab root｜Linux／macOS", size=20, line=NAVY)
        visual_panel(slide, 8.28, 2.26, 3.86, 1.88, "GATE", "status: READY\npackage-local venv", BLUE, body_size=20)
    elif family == "receipt-view":
        visual_heading(slide, "verify-receipt.json：schema／example", NAVY)
        frame(slide, 1.04, 2.20, 11.20, 2.04, line=BLUE, fill=PALE_BLUE, radius=True, name="Receipt JSON")
        text_box(slide, 1.42, 2.54, 10.44, 1.34, '{\n  "status": "READY",\n  "python_version": "3.11.x",\n  "scenario_id": "ntpu-energy-decision-01"\n}', 20, color=INK, name="Receipt JSON text", margins=(0.04, 0.01, 0.04, 0.01))
        text_box(slide, 1.18, 4.42, 11.00, 0.30, "SCHEMA／EXAMPLE ONLY｜值為示意；現場以實際 verify-receipt.json 為準", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Receipt schema disclaimer", margins=(0.02, 0.0, 0.02, 0.0))
        text_box(slide, 1.18, 4.72, 11.00, 0.30, "energy/output：result.json＋endpoint-replay.json", 20, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Receipt output boundary", margins=(0.02, 0.0, 0.02, 0.0))
    elif family == "receipt-fields":
        visual_heading(slide, "identity fields 共同限定 claim ceiling", NAVY)
        # Two columns with generous cards keep the long policy/engine values
        # on their own lines.  The old four-row strip was too short at 20pt
        # and caused cross-row clipping in the rendered slide.
        fields = (
            ("scenario_id｜情境識別碼", "ntpu-energy-decision-01\n字串；READY receipt", BLUE),
            ("policy_api_version｜介面版本", "lora-energy-policy-v1\n字串；READY receipt", NAVY),
            ("engine_mode｜引擎模式", "coherent-course-simulated-adapter\n分類；READY receipt", GOLD),
            ("upstream｜上游執行", "false\n布林；READY receipt", BLUE),
        )
        positions = ((0.78, 2.24), (6.84, 2.24), (0.78, 4.10), (6.84, 4.10))
        for (key, val, color), (x, y) in zip(fields, positions):
            frame(slide, x, y, 5.72, 1.58, line=color, fill=WHITE, radius=True, name=f"Receipt field {key}")
            text_box(slide, x + 0.16, y + 0.14, 5.40, 0.32, key, 20, bold=True, color=color, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Receipt field key {key}", margins=(0.01, 0.0, 0.01, 0.0))
            text_box(slide, x + 0.16, y + 0.55, 5.40, 0.78, val, 20, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Receipt field value {key}", margins=(0.01, 0.01, 0.01, 0.01))
        text_box(slide, 1.18, 5.82, 11.00, 0.28, "作用：identity value 限定 claim ceiling；四欄均來自 READY receipt", 20, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Receipt identity explanation", margins=(0.02, 0.0, 0.02, 0.0))
    elif family == "fallback":
        visual_heading(slide, "Windows／WSL verify route → repair or same-scenario fallback", NAVY)
        command_box(slide, page.commands[:1], 0.70, 2.18, 5.90, 1.28, label="Windows PowerShell｜package root", size=20, line=BLUE)
        command_box(slide, page.commands[1:], 6.75, 2.18, 5.90, 1.28, label="WSL／POSIX bash｜package root", size=20, line=NAVY)
        circle(slide, 5.98, 3.68, 0.72, fill=BLUE, line=BLUE, name="Recovery input")
        text_box(slide, 5.58, 3.88, 1.52, 0.24, "error", 20, bold=True, color=WHITE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Recovery input label", margins=(0.01, 0.0, 0.01, 0.0))
        connector(slide, 6.34, 4.40, 3.18, 4.50, color=BLUE, width=1.6, name="Repair branch")
        connector(slide, 6.34, 4.40, 9.46, 4.50, color=GOLD, width=1.6, name="Fallback branch")
        visual_panel(slide, 0.94, 4.50, 4.72, 0.96, "REPAIR", "修目前指出的最小 gate", BLUE, body_size=20)
        visual_panel(slide, 7.68, 4.50, 4.72, 0.96, "FALLBACK", "same-scenario-fallback", GOLD, body_size=20)
    elif family == "guard-policy":
        visual_heading(slide, "一個 editable file，四個 read-only boundary", NAVY)
        visual_panel(slide, 0.90, 2.26, 5.18, 1.92, "EDIT", "student_policy.py\nactive marked block\nsmall diff", BLUE, body_size=21)
        connector(slide, 6.18, 3.20, 7.04, 3.20, color=GOLD, width=1.8, name="Guard boundary")
        visual_panel(slide, 7.18, 2.26, 5.12, 1.92, "READ-ONLY", "scenario\nschemas／runner\ngenerated JSON", NAVY, body_size=20)
    elif family == "policy-io":
        visual_heading(slide, "當下 observation → 一個 legal action", NAVY)
        visual_panel(slide, 0.88, 2.24, 5.14, 1.94, "OBSERVATION", "contact_open\nquality／queue\nurgent_due_in_s", BLUE, body_size=20)
        connector(slide, 6.18, 3.20, 7.02, 3.20, color=GOLD, width=1.8, name="Policy IO arrow")
        visual_panel(slide, 7.18, 2.24, 5.20, 1.94, "LEGAL ACTION", "WAIT／SLEEP\nSEND_ONE／SEND_URGENT\nFLUSH_BATCH", NAVY, body_size=20)
        text_box(slide, 1.42, 4.26, 10.52, 0.28, "future quality、future energy、result summary = 不可讀", 20, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Policy no future")
    elif family == "knobs":
        visual_heading(slide, "每次只動一個 bounded control", NAVY)
        panels = (("LAB A", "REST_DURING_GAP\nSLEEP → WAIT\nawake-idle／wake", BLUE), ("LAB B", "STABLE_STEPS\n2 → 1\nquality hold", NAVY), ("LAB C", "URGENT_MARGIN_S\n20 → 5\ndeadline branch", GOLD))
        for i, (head, body, color) in enumerate(panels):
            visual_panel(slide, 0.82 + i * 4.17, 2.24, 3.72, 1.94, head, body, color, body_size=20)
    elif family == "branch-code":
        visual_heading(slide, "MECHANISM-ONLY PSEUDOCODE｜讀條件，再追 return", NAVY)
        frame(slide, 0.88, 2.16, 7.04, 3.10, line=NAVY, fill=PALE_BLUE, radius=True, name="Policy code excerpt")
        code = "if not observation.contact_open:\n    return SLEEP\nif observation.urgent_pending:\n    if observation.urgent_due_in_s <= URGENT_MARGIN_S:\n        return SEND_URGENT\nif observation.steps_since_send < PACE_GAP_STEPS:\n    return REST_DURING_GAP"
        text_box(slide, 1.16, 2.34, 6.50, 2.64, code, 20, color=INK, name="Policy code lines", margins=(0.02, 0.01, 0.02, 0.01))
        visual_panel(slide, 8.20, 2.16, 4.12, 3.10, "MECHANISM", "window → SLEEP\nurgent → SEND_URGENT\npace → REST", GOLD, body_size=20)
    elif family == "baseline":
        visual_heading(slide, "lora-energy-lab root｜RUN：fixed scenario A baseline", NAVY)
        command_box(slide, page.commands[:2], 0.70, 2.20, 5.90, 2.54, label="Windows PowerShell｜package-local venv", size=20, line=BLUE)
        command_box(slide, page.commands[2:], 6.75, 2.20, 5.90, 2.54, label="WSL／POSIX bash｜package-local venv", size=20, line=NAVY)
        text_box(slide, 0.96, 5.02, 11.36, 0.52, "兩欄執行同一固定 scenario／seed；輸出 result.json、endpoint-replay.json，JSON 印出 result_path", 20, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Baseline result boundary", margins=(0.01, 0.0, 0.01, 0.0))
    elif family == "windows-manual-venv":
        visual_heading(slide, "PowerShell exact route：check → install／locate → venv", NAVY)
        command_box(slide, page.commands[:2], 0.70, 2.16, 11.95, 1.34, label="1｜Python Launcher check", size=20, line=BLUE)
        command_box(slide, page.commands[2:5], 0.70, 3.72, 5.90, 1.72, label="2｜3.11 missing: uv route", size=20, line=GOLD)
        command_box(slide, page.commands[5:], 6.75, 3.72, 5.90, 1.72, label="3｜venv module and create", size=20, line=NAVY)
        text_box(slide, 0.96, 5.60, 11.36, 0.30, "全部命令在 lora-energy-lab root；成功後有 .venv\\Scripts\\python.exe", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Windows manual boundary", margins=(0.01, 0.0, 0.01, 0.0))
    elif family == "windows-activate":
        visual_heading(slide, "PowerShell exact route：activate → locked install → READY", NAVY)
        command_box(slide, page.commands, 0.70, 2.16, 11.95, 3.22, label="Windows package root｜同一 PowerShell 視窗", size=20, line=NAVY)
        text_box(slide, 0.96, 5.56, 11.36, 0.48, "PowerShell policy blocked → Command Prompt\ncall .venv\\Scripts\\activate.bat", 20, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Windows activation fallback", margins=(0.01, 0.0, 0.01, 0.0))
    elif family == "wsl-python":
        visual_heading(slide, "WSL／Ubuntu exact route：detect → apt prerequisite → uv Python 3.11", NAVY)
        command_box(slide, page.commands[:6], 0.70, 2.16, 5.90, 3.20, label="1｜detect；apt Candidate branch", size=20, line=BLUE)
        command_box(slide, page.commands[6:], 6.75, 2.16, 5.90, 3.20, label="2｜curl + uv managed Python", size=20, line=GOLD)
        text_box(slide, 0.96, 5.58, 11.36, 0.32, "有 Candidate：apt 安裝後設定 PYTHON_BIN；無 Candidate：uv 定位並設定 PYTHON_BIN；只在 WSL／Linux bash 執行", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="WSL Python boundary", margins=(0.01, 0.0, 0.01, 0.0))
    elif family == "wsl-venv":
        # This page has a dense but essential two-line teaching statement;
        # place its route heading below that statement so no third wrapped
        # line can collide with the heading.
        text_box(slide, 0.84, 2.02, 11.70, 0.30, "WSL／Ubuntu exact route：venv → source → locked install → READY", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="WSL venv route heading", margins=(0.02, 0.0, 0.02, 0.0))
        command_box(slide, page.commands, 0.70, 2.38, 11.95, 3.00, label="Linux package root｜同一 WSL bash 視窗", size=20, line=NAVY)
        text_box(slide, 0.96, 5.58, 11.36, 0.32, "WSL 使用 .venv/bin/python；Windows .venv\\Scripts\\python.exe 不互換，Windows CMD 不執行 .sh", 20, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="WSL venv boundary", margins=(0.01, 0.0, 0.01, 0.0))
    else:
        raise ValueError(f"unknown direct visual family {family}")


def compose_direct_page(slide, page: Page) -> None:
    draw_direct_visual(slide, page)


def compose_page(slide, page: Page) -> None:
    compose_direct_page(slide, page)


def create_editable_deck(pages: list[Page]) -> Path:
    """Create slide-local editable content, notes, and native layout links."""
    prs = Presentation(str(TEMPLATE))
    layouts = prs.slide_layouts
    # Every authored slide uses the native content shell from source slide 2
    # (python-pptx layout index 1 -> ppt/slideLayouts/slideLayout2.xml).
    # The cover shell (layout1) is prohibited, including on the first page.
    layout_cycle = [1] * len(pages)
    for index, (page, layout_index) in enumerate(zip(pages, layout_cycle)):
        next_page = pages[index + 1] if index + 1 < len(pages) else None
        slide = prs.slides.add_slide(layouts[layout_index])
        compose_page(slide, page)
        notes = slide.notes_slide
        # Notes placeholder 2 is the editable narration placeholder in the
        # educate notes master.
        body = next((shape for shape in notes.placeholders if int(shape.placeholder_format.type) == 2), None)
        if body is None:
            raise RuntimeError(f"slide {page.number}: notes body placeholder missing")
        body.text = speaker_script(page, next_page)
    working = PROJECT / "validation/python-pptx-working.pptx"
    prs.save(str(working))
    return working


def _copy_zip_parts(source: Path, target: Path, prefixes: tuple[str, ...]) -> None:
    """Overlay exact template parts after python-pptx authoring."""
    with zipfile.ZipFile(source) as src, zipfile.ZipFile(target, "r") as old:
        members = {info.filename: old.read(info.filename) for info in old.infolist()}
        infos = {info.filename: copy.copy(info) for info in old.infolist()}
        for info in src.infolist():
            if info.filename.startswith(prefixes):
                members[info.filename] = src.read(info.filename)
                infos[info.filename] = copy.copy(info)
    temp = target.with_suffix(".overlay.pptx")
    with zipfile.ZipFile(temp, "w", zipfile.ZIP_DEFLATED) as out:
        for name, data in members.items():
            out.writestr(infos[name], data)
    temp.replace(target)


def remove_original_slides_and_clean(working: Path, expected_pages: int) -> Path:
    """Keep only the authored slides and clean orphaned parts."""
    with zipfile.ZipFile(working) as z:
        members = {info.filename: z.read(info.filename) for info in z.infolist()}
        infos = {info.filename: copy.copy(info) for info in z.infolist()}
    pres_name = "ppt/presentation.xml"
    root = ET.fromstring(members[pres_name])
    P = "http://schemas.openxmlformats.org/presentationml/2006/main"
    A = "http://schemas.openxmlformats.org/drawingml/2006/main"
    R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    # Keep the canonical p:/a:/r: prefixes.  clean.py intentionally uses the
    # package's p:sldIdLst lexical contract when resolving slide references.
    ET.register_namespace("a", A)
    ET.register_namespace("p", P)
    ET.register_namespace("r", R)
    sld_id_lst = root.find(f"{{{P}}}sldIdLst")
    if sld_id_lst is None:
        raise RuntimeError("missing presentation slide list")
    ids = list(sld_id_lst)
    if len(ids) < expected_pages + 2:
        raise RuntimeError(f"working deck has {len(ids)} slides; expected original 2 + {expected_pages}")
    sld_id_lst.clear(); sld_id_lst.extend(ids[2:])
    members[pres_name] = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    # Make an intermediate package; clean.py follows the slide list and all
    # slide relationships, including notes slides.
    intermediate = PROJECT / "validation/pre-clean-module1.pptx"
    with zipfile.ZipFile(intermediate, "w", zipfile.ZIP_DEFLATED) as out:
        for name, data in members.items():
            out.writestr(infos[name], data)
    unpacked = PROJECT / "validation/module1-unpacked"
    if unpacked.exists():
        shutil.rmtree(unpacked)
    unpacked.mkdir(parents=True)
    with zipfile.ZipFile(intermediate) as z:
        z.extractall(unpacked)
    clean = Path("/home/u24/.codex/skills/pptx/scripts/clean.py")
    subprocess.run([sys.executable, str(clean), str(unpacked)], check=True, cwd=str(ROOT), capture_output=True, text=True)
    output = PROJECT / "exports" / OUTPUT_NAME
    pack = Path("/home/u24/.codex/skills/pptx/scripts/office/pack.py")
    subprocess.run([sys.executable, str(pack), str(unpacked), str(output), "--validate", "false"], check=True, cwd=str(ROOT), capture_output=True, text=True)
    return output


def overlay_exact_template_parts(final: Path) -> None:
    # Layout/master/theme/media are not merely similar: byte-identical copies
    # of the source package are required to preserve the footer/logo/page no.
    _copy_zip_parts(TEMPLATE, final, ("ppt/slideLayouts/", "ppt/slideMasters/", "ppt/theme/", "ppt/media/", "ppt/notesMasters/"))


def ordered_slide_parts(z: zipfile.ZipFile) -> list[str]:
    P = "http://schemas.openxmlformats.org/presentationml/2006/main"
    R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    PR = "http://schemas.openxmlformats.org/package/2006/relationships"
    presentation = ET.fromstring(z.read("ppt/presentation.xml"))
    rels = ET.fromstring(z.read("ppt/_rels/presentation.xml.rels"))
    targets = {node.get("Id"): node.get("Target") for node in rels.findall(f"{{{PR}}}Relationship")}
    parts = []
    for node in presentation.findall(f"./{{{P}}}sldIdLst/{{{P}}}sldId"):
        target = targets.get(node.get(f"{{{R}}}id"))
        if target:
            parts.append(str(Path("ppt") / target).replace("\\", "/"))
    return parts


def qa_package(final: Path, pages: list[Page]) -> dict[str, object]:
    A = "http://schemas.openxmlformats.org/drawingml/2006/main"
    P = "http://schemas.openxmlformats.org/presentationml/2006/main"
    PR = "http://schemas.openxmlformats.org/package/2006/relationships"
    errors: list[str] = []
    warnings: list[str] = []
    source_hashes: dict[str, str] = {}
    layout_targets_by_slide: dict[str, list[str]] = {}
    content_term_hits: list[dict[str, str]] = []
    note_lengths: list[int] = []
    note_section_errors: list[dict[str, object]] = []
    required_note_sections = (
        "本頁目的：",
        "畫面指向：",
        "可直接說：",
        "必要操作：",
        "預期畫面或結果：",
        "失敗處理：",
    )
    with zipfile.ZipFile(TEMPLATE) as template, zipfile.ZipFile(final) as deck:
        if deck.testzip():
            errors.append("OOXML archive integrity check failed")
        ordered = ordered_slide_parts(deck)
        if len(ordered) != len(pages):
            errors.append(f"slide_count={len(ordered)} expected={len(pages)}")
        notes = [n for n in deck.namelist() if n.startswith("ppt/notesSlides/notesSlide") and n.endswith(".xml")]
        if len(notes) != len(pages):
            errors.append(f"notes_count={len(notes)} expected={len(pages)}")
        for index, part in enumerate(ordered, start=1):
            relpart = f"ppt/slides/_rels/{Path(part).name}.rels"
            if relpart not in deck.namelist():
                errors.append(f"slide {index}: relationship part missing")
                continue
            relroot = ET.fromstring(deck.read(relpart))
            targets_for_slide = [
                node.get("Target", "")
                for node in relroot.findall(f"{{{PR}}}Relationship")
                if node.get("Type", "").endswith("/slideLayout")
            ]
            layout_targets_by_slide[str(index)] = targets_for_slide
            if targets_for_slide != ["../slideLayouts/slideLayout2.xml"]:
                errors.append(f"slide {index}: layout target {targets_for_slide!r}; expected slideLayout2.xml")
            if any("slideLayout1.xml" in target for target in targets_for_slide):
                errors.append(f"slide {index}: prohibited slideLayout1.xml relationship")
        all_text = []
        overflow = []
        slide_backgrounds = 0
        min_command_size = 10_000
        title_sizes: list[int] = []
        body_sizes: list[int] = []
        title_size_errors: list[dict[str, object]] = []
        font_errors: list[dict[str, object]] = []
        for index, part in enumerate(ordered, start=1):
            root = ET.fromstring(deck.read(part))
            if root.find(f"./{{{P}}}cSld/{{{P}}}bg") is not None:
                slide_backgrounds += 1
            text = "".join(node.text or "" for node in root.findall(f".//{{{A}}}t"))
            all_text.append(text)
            if FORBIDDEN_WORD in text:
                errors.append(f"slide {index}: forbidden exact Chinese word")
            for label in FORBIDDEN_CUSTOM_LABELS:
                if label in text:
                    errors.append(f"slide {index}: forbidden custom bottom label {label!r}")
            # Package operations must use the one release root.  This catches
            # stale `~/c120-course` or similar paths even when they appear in
            # a command box rather than in the main statement.
            if re.search(r"(?i)(?:~|/home/[^\s`]+|/mnt/[^\s`]+|[A-Za-z]:\\[^\s`])*c120(?:[-_/]|\\)", text):
                errors.append(f"slide {index}: stray c120 package path; use lora-energy-lab")
            for rpr in root.findall(f".//{{{A}}}rPr"):
                try:
                    size = int(rpr.get("sz", "0"))
                except ValueError:
                    continue
                if size:
                    body_sizes.append(size)
                    if size < 1800:
                        warnings.append(f"slide {index}: small auxiliary text {size / 100:.1f}pt")
                for node in rpr.findall(f"{{{A}}}latin"):
                    if node.get("typeface") != "Times New Roman":
                        font_errors.append({"slide": index, "kind": "latin", "typeface": node.get("typeface")})
                for node in rpr.findall(f"{{{A}}}ea"):
                    if node.get("typeface") != "標楷體":
                        font_errors.append({"slide": index, "kind": "east_asia", "typeface": node.get("typeface")})
            title_shapes = []
            for shape in root.findall(f".//{{{P}}}sp"):
                title_ph = shape.find(f"./{{{P}}}nvSpPr/{{{P}}}nvPr/{{{P}}}ph[@type='title']")
                if title_ph is not None:
                    title_shapes.append(shape)
            for title_shape in title_shapes:
                for rpr in title_shape.findall(f".//{{{A}}}rPr"):
                    try:
                        title_size = int(rpr.get("sz", "0"))
                    except ValueError:
                        title_size = 0
                    title_sizes.append(title_size)
                    if title_size != 2800:
                        title_size_errors.append({"slide": index, "size_pt": title_size / 100})
            for sp in root.findall(f"./{{{P}}}cSld/{{{P}}}spTree/*"):
                xfrm = sp.find(f"./{{{P}}}spPr/{{{A}}}xfrm")
                if xfrm is None:
                    xfrm = sp.find(f"./{{{P}}}grpSpPr/{{{A}}}xfrm")
                if xfrm is None:
                    continue
                off, ext = xfrm.find(f"{{{A}}}off"), xfrm.find(f"{{{A}}}ext")
                if off is None or ext is None:
                    continue
                try:
                    x, y, cx, cy = (int(off.get(k, "0")) for k in ("x", "y", "cx", "cy"))
                except ValueError:
                    continue
                if x < 0 or y < 0 or x + cx > 12192000 or y + cy > 6858000:
                    overflow.append({"slide": index, "x": x, "y": y, "cx": cx, "cy": cy})
        if slide_backgrounds:
            errors.append(f"slide_level_background_nodes={slide_backgrounds}")
        if title_size_errors:
            errors.append(f"title_size_errors={title_size_errors}")
        if font_errors:
            errors.append(f"font_errors={font_errors}")
        # Original template parts are exact.  The footer itself is a layout
        # image and the page number is a layout/master placeholder.
        for name in ("ppt/slideMasters/slideMaster1.xml", "ppt/slideLayouts/slideLayout2.xml", "ppt/slideLayouts/slideLayout5.xml", "ppt/theme/theme1.xml", "ppt/media/image1.png", "ppt/media/image2.png", "ppt/media/image3.png"):
            if name not in deck.namelist():
                errors.append(f"template part missing: {name}")
                continue
            same = hashlib.sha256(deck.read(name)).hexdigest() == hashlib.sha256(template.read(name)).hexdigest()
            source_hashes[name] = hashlib.sha256(template.read(name)).hexdigest()
            if not same:
                errors.append(f"template part changed: {name}")
        layout_xml = deck.read("ppt/slideLayouts/slideLayout2.xml").decode("utf-8", "ignore")
        master_xml = deck.read("ppt/slideMasters/slideMaster1.xml").decode("utf-8", "ignore")
        if "slidenum" not in layout_xml.lower() or "slidenum" not in master_xml.lower():
            errors.append("slide-number placeholder missing from preserved layout/master")
        if "ppt/media/image2.png" not in deck.namelist() or "ppt/media/image3.png" not in deck.namelist():
            errors.append("footer/logo media missing")
        note_text = []
        for name in notes:
            note_root = ET.fromstring(deck.read(name))
            note_text.append("".join(node.text or "" for node in note_root.findall(f".//{{{A}}}t")))
            note_lengths.append(len(note_text[-1]))
            missing = [section for section in required_note_sections if section not in note_text[-1]]
            if "銜接下一頁：" not in note_text[-1] and "本模組在此收束" not in note_text[-1]:
                missing.append("銜接下一頁：或本模組在此收束")
            if len(note_text[-1]) < 180 or missing:
                note_section_errors.append({"part": name, "chars": len(note_text[-1]), "missing": missing})
            if FORBIDDEN_WORD in note_text[-1]:
                errors.append(f"notes {name}: forbidden exact Chinese word")
        if len(note_text) == len(pages) and note_section_errors:
            errors.append(f"speaker note script gate failed: {note_section_errors}")
        if any("分鐘" in text for text in all_text + note_text):
            errors.append("visible or notes time label")
        source_paths = (PROJECT / "sources/module1-script.md", PROJECT / "sources/module1-speaker-notes.md")
        source_text = "\n".join(path.read_text(encoding="utf-8") for path in source_paths if path.exists())
        scan_payloads = {
            **{f"slide_xml:{index}": text for index, text in enumerate(all_text, start=1)},
            **{f"notes_xml:{name}": text for name, text in zip(notes, note_text)},
            "source:module1-script.md": source_text,
        }
        for location, text in scan_payloads.items():
            for term in FORBIDDEN_CONTENT_TERMS:
                if term in text:
                    content_term_hits.append({"location": location, "term": term})
            if re.search(r"先[^。\n]{0,24}才", text):
                content_term_hits.append({"location": location, "term": "先…才…"})
        for hit in content_term_hits:
            errors.append(f"content forbidden term: {hit['location']} contains {hit['term']!r}")
        required: list[str] = []
        if len(pages) >= 11:
            required.extend(["lora-energy-lab", "student_policy.py"])
        if len(pages) >= 26:
            required.extend(["ntpu-energy-decision-01", "lora-energy-policy-v1", "coherent-course-simulated-adapter"])
        if len(pages) >= 27:
            required.append("same-scenario-fallback")
        if len(pages) >= 32:
            required.append("result_path")
        if not all(token in "\n".join(all_text) for token in required):
            errors.append("local artifact or current scenario identity evidence missing")
    report = {
        "schema": "c120-direct-teaching-part-a-qa-v1",
        "status": "PASS" if not errors else "FAIL",
        "input": str(final),
        "slide_count": len(ordered),
        "notes_count": len(notes),
        "speaker_notes": {
            "count": len(note_text),
            "min_chars": min(note_lengths) if note_lengths else None,
            "max_chars": max(note_lengths) if note_lengths else None,
            "required_sections": list(required_note_sections) + ["銜接下一頁：或本模組在此收束"],
            "section_errors": note_section_errors,
        },
        "slide_level_background_nodes": slide_backgrounds,
        "overflow_candidates": overflow,
        "title_sizes_pt": title_sizes,
        "min_text_size_pt": min(body_sizes) / 100 if body_sizes else None,
        "font_errors": font_errors,
        "layout_targets_by_slide": layout_targets_by_slide,
        "content_term_hits": content_term_hits,
        "template_part_hashes": source_hashes,
        "footer_contract": {"line_and_text_media": "ppt/media/image2.png", "logo_media": "ppt/media/image3.png", "page_number_placeholder": "layout/master sldNum"},
        "errors": errors,
        "warnings": warnings,
        "source_map": "analysis/beamshift-e2-source-map.md",
        "limitations": ["Microsoft PowerPoint open/reopen remains the controller-owned final gate.", "Part A contains no formula; no equation image is used."],
    }
    (PROJECT / "validation/qa_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def render_and_contact(final: Path, expected_pages: int) -> None:
    render = PROJECT / "renders"
    pdf = render / "part-a.pdf"
    converter = Path("/home/u24/.codex/skills/pptx/scripts/office/soffice.py")
    render_env = dict(os.environ)
    render_env["SAL_USE_VCLPLUGIN"] = "svp"
    render_env["XDG_CONFIG_HOME"] = str(render / ".config")
    # An isolated office profile keeps dconf and lock files out of the
    # read-only runtime locations used by the build sandbox.
    with tempfile.TemporaryDirectory(prefix="c120-part-a-office-", dir="/tmp") as profile:
        command = [sys.executable, str(converter), f"-env:UserInstallation=file://{profile}", "--headless", "--convert-to", "pdf", "--outdir", str(render), str(final)]
        result = subprocess.run(command, cwd=str(ROOT), text=True, capture_output=True, env=render_env)
    produced = render / (final.stem + ".pdf")
    if result.returncode != 0 or not produced.exists():
        # Some sandbox profiles reject dconf even though LibreOffice can
        # render with its normal isolated profile.  Retry without the custom
        # profile before declaring the render gate blocked.
        fallback = subprocess.run(
            [sys.executable, str(converter), "--headless", "--convert-to", "pdf", "--outdir", str(render), str(final)],
            cwd=str(ROOT), text=True, capture_output=True, env=dict(os.environ),
        )
        if fallback.returncode != 0 or not produced.exists():
            status = "Render failed (isolated attempt)\n" + result.stdout + "\n" + result.stderr
            status += "\nRender failed (normal-profile fallback)\n" + fallback.stdout + "\n" + fallback.stderr
            (PROJECT / "validation/render-status.md").write_text(status, encoding="utf-8")
            # Keep the valid PPTX/QA result and let the controller render with
            # its approved office environment; do not delete the deliverable.
            return
        (PROJECT / "validation/render-status.md").write_text(
            "Normal-profile LibreOffice fallback succeeded after isolated-profile dconf failure.\n",
            encoding="utf-8",
        )
    produced.replace(pdf)
    subprocess.run(["pdftoppm", "-png", "-r", "144", str(pdf), str(render / "slide")], check=True, cwd=str(ROOT))
    images = sorted(render.glob("slide-*.png"), key=lambda p: int(re.search(r"(\d+)$", p.stem).group(1)))
    if len(images) != expected_pages:
        raise RuntimeError(f"render produced {len(images)} pages, expected {expected_pages}")
    from PIL import Image, ImageDraw

    contact_dir = render / "contact-sheets"
    contact_dir.mkdir(exist_ok=True)
    thumb_w, thumb_h = 360, 203
    for start in range(0, len(images), 9):
        subset = images[start:start + 9]
        sheet = Image.new("RGB", (thumb_w * 3, (thumb_h + 24) * 3), "white")
        draw = ImageDraw.Draw(sheet)
        for offset, image_path in enumerate(subset):
            image = Image.open(image_path).convert("RGB")
            image.thumbnail((thumb_w, thumb_h))
            x, y = (offset % 3) * thumb_w, (offset // 3) * (thumb_h + 24)
            sheet.paste(image, (x, y))
            draw.text((x + 6, y + thumb_h + 4), f"P{start + offset + 1:03d}", fill="black")
        sheet.save(contact_dir / f"contact-{start + 1:03d}-{start + len(subset):03d}.jpg", quality=90)
    review = f"""# Part A visual review

All {expected_pages} slides were rendered at 144 DPI after a first-pass repair cycle.

## First-pass findings

- P003: action labels and the safety rule competed for the same vertical space.
- P010a/P010b: the release/package-root visual needed a bounded inventory and a local white mask so the native template line could not cross text.
- P011a/P011b/P014/P016b/P019a/P019b/P027: the shared lower rail caused clipped or colliding recovery copy and made the page family visually repetitive.
- P014/P019b/P027: long teaching statements reached into the visual heading.
- P004/P006/P009/P017/P021a/P021b/P027: dense two-line statements and typed receipt values required a second readable reflow pass.

## Repairs applied

- Removed every slide-local status rail and custom bottom label; setup, verify, receipt, and RUN pages now rely on their dominant family-specific visual plus the native educate footer only.
- Shortened the affected teaching statements and bounded the package tree/release inventory to readable lines.
- Removed provenance wording from the teaching surface; source lineage remains in `analysis/beamshift-e2-source-map.md` for the controller-owned assembler.
- Added white local fills to editable visual and command panels to mask native artwork behind their text without adding slide-level backgrounds.
- Kept the template footer line, footer wording, logo, and native page-number field untouched.

## Second-pass inspection

Inspect every `renders/slide-*.png` at original size, plus all contact sheets. Fixed-slide spot checks: P003, P004, P006, P009, P010a, P010b, P011a, P011b, P014, P016a, P016b, P019a, P019b, P021a, P021b, P027. The remaining acceptance boundary is a controller-owned Microsoft PowerPoint open/reopen check.
"""
    (PROJECT / "validation/targeted-visual-review.md").write_text(review, encoding="utf-8")


def write_readme(final: Path, report: dict[str, object], expected_pages: int) -> None:
    contact_paths = []
    for start in range(1, expected_pages + 1, 9):
        end = min(expected_pages, start + 8)
        contact_paths.append(f"`renders/contact-sheets/contact-{start:03d}-{end:03d}.jpg`")
    contact_listing = ", ".join(contact_paths)
    text = f"""# C-120 direct-teaching Part A ({expected_pages} physical pages)

Final editable deck: `exports/{final.name}`

- Scope: concrete IoT motivation through release identity, Windows/WSL/Python 3.11, uv, package-local `.venv`, setup/verify/recovery, policy API, and baseline entry.
- Source template: `/home/u24/ppt-master/template/educate.pptx`
- Native template parts preserved byte-for-byte: master, all layouts, theme, footer/logo media, notes master.
- Footer contract: original bottom line/text image (`ppt/media/image2.png`), original logo (`ppt/media/image3.png`), and native `sldNum` fields remain in the package.
- Speaker notes: {expected_pages} embedded page-local delivery scripts; each note states purpose, visual pointer, speakable wording, operation, expected result, recovery, and transition.
- Evidence wording stays bounded: package content is verified, while fresh setup/READY/run/import claims remain expected or pending until their live gates pass.
- Current identity: `ntpu-energy-decision-01`; engine mode `coherent-course-simulated-adapter`; `upstream_execution: false`.
- Equations: none occur in Part A; no equation image is used.
- QA: `validation/qa_report.json`.
- Render PDF: `renders/part-a.pdf`; original-size PNGs: `renders/slide-01.png` through `renders/slide-{expected_pages:02d}.png`.
- Contact sheets: {contact_listing}.
- BeamShift e2 source map for controller merge: `analysis/beamshift-e2-source-map.md`; donor provenance is kept out of teaching surfaces.
- Status: `{report.get('status')}` (PowerPoint open/reopen is the controller-owned final gate).
"""
    (PROJECT / "README.md").write_text(text, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-render", action="store_true", help="build and QA without rendering")
    parser.add_argument("--limit", type=int, default=0, help="build only the first N pages for an early checkpoint")
    args = parser.parse_args(argv)
    all_pages = direct_page_data()
    assert_pages(all_pages)
    if args.limit:
        if args.limit < 1 or args.limit > len(all_pages):
            raise ValueError(f"--limit must be between 1 and {len(all_pages)}")
        pages = all_pages[: args.limit]
    else:
        pages = all_pages
    ensure_dirs()
    copy_sources(pages)
    (PROJECT / "analysis/content_plan.json").write_text(json.dumps([asdict(page) for page in pages], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    working = create_editable_deck(pages)
    final = remove_original_slides_and_clean(working, len(pages))
    overlay_exact_template_parts(final)
    report = qa_package(final, pages)
    if not args.skip_render:
        render_and_contact(final, len(pages))
    write_readme(final, report, len(pages))
    print(json.dumps({"final": str(final), "qa_status": report["status"], "qa_errors": report["errors"]}, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "PASS" else 2


if __name__ == "__main__":
    raise SystemExit(main())
