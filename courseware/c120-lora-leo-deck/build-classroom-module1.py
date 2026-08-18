#!/usr/bin/env python3
"""Build the directly teachable C-120 module 1 deck (P001--P027).

The source deck is ``/home/u24/ppt-master/template/educate.pptx``.  The
authoring pass uses python-pptx for editable DrawingML text and shapes, then
puts the template's original master, layouts, theme and media parts back into
the package.  That last pass is intentional: the footer line, footer text
image, logo, and slide-number placeholders must remain the exact objects from
the supplied template.  No slide-level background is added.

The script writes only ``projects/classroom-module1_ppt169_20260811`` (plus a
temporary rendering directory under /tmp).  It is safe to re-run; the output
directory is rebuilt from its own generated files, without touching sibling
deck projects.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import shutil
import subprocess
import sys
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
PROJECT = ROOT / "projects/classroom-module1_ppt169_20260811"
TEMPLATE = Path("/home/u24/ppt-master/template/educate.pptx")
SOURCE_SCRIPT = ROOT / "full-deck-v2-classroom-script.md"
OUTPUT_NAME = "c120-lora-leo-classroom-module1-editable_20260811.pptx"

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


def page_data() -> list[Page]:
    """Authored first-part script, with operation receipts made explicit."""

    common_claim_recovery = "若 claim 被擴大：停在 endpoint / system boundary；不可把模擬資料說成 live 或 measured。"
    setup_recovery = "shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。"
    policy_recovery = "policy guard 或 syntax 失敗：只修 marked block 的最小行；不要改 runner、schema 或 generated JSON。"

    return [
        Page(1, "每一次 SEND、WAIT、SLEEP 都是能源決策", 0, "cover", "VERIFIED", "endpoint radio-state ribbon 與變動服務窗口", "policy → state time → packet/service → endpoint energy\nSIMULATED TEACHING DATA", _t(), "先從 endpoint 的選擇開始，而不是先背衛星名詞。", "SEND、WAIT、SLEEP 會改變 state 停留時間、封包結果與 service，最後才落到 endpoint energy ledger。", "預期：可以沿著 policy → state → packet/service → J 說出一條可追溯鏈。", common_claim_recovery, "今天先不從衛星名詞開始。我們從一個 IoT endpoint 的選擇開始：現在送、短暫等待，或進入低功耗休眠。每個選擇會改變 radio state 停留時間、封包結果與服務，最後才在 endpoint energy ledger 中留下可追溯的 J。", False),
        Page(2, "節能是一條可檢驗的因果鏈", 1, "flow", "VERIFIED", "六段箭頭流程圖", "observation → policy → action → state / packet → service → J", _t(), "先讀左邊的 observation，再談右邊的 J。", "action 會改變等待、喚醒、處理、收發與封包結果；service gate 通過後，才比較累積能量。", "預期：每個箭頭都能回到 result 或 replay；只有動畫變化不算 evidence。", common_claim_recovery, "請看箭頭，不要跳到最右邊。先有 observation，policy 才選 action；action 會改變等待、喚醒、處理、收發與封包結果；服務條件確認後，才談功率乘上時間累積出的 endpoint energy。", False),
        Page(3, "LoRaEnergySim 為什麼直接服務智慧節能與 IoT", 2, "cards", "VERIFIED", "state／packet／energy 三層卡片", "低功耗節點\n封包與重試\n睡眠／處理／TX／RX\n可觀察結果", _t(), "用一個低功耗節點把抽象的節能選擇變成可觀察事件。", "sleep、processing、transmit、receive、packet、collision、retry 與 energy 結果連在同一條 endpoint model。", "預期：能指出 action 會改哪一層，而不是只改小功率欄位。", common_claim_recovery, "智慧節能不是只把功率欄位改小，而是讓裝置在工作與等待之間做出可解釋的取捨。相關模型把 sleep、processing、transmit、receive、packet、collision、retry 與 energy 結果連起來。", False),
        Page(4, "LEO 只提供會改變的服務窗口", 3, "timeline", "VERIFIED", "一條 NTPU contact-window timeline", "機會出現 → policy 選擇 → service / energy 取捨\nLEO = example", _t(), "把 LEO 當成 changing service window 的例子。", "窗口會出現、消失、變短或變長，因此現在送或等一下會有不同 service 後果。", "預期：可以說明窗口如何改變 policy 選擇；不宣稱 live satellite measurement。", common_claim_recovery, "LEO 在這裡不是衛星工程課的終點，而是 changing service window 的例子。可服務的機會會出現、消失、變短或變長，讓現在送還是等一下變得可觀察。", False),
        Page(5, "兩層 evidence 不能互相冒充", 2, "compare", "VERIFIED", "endpoint replay 與 C-120 system replay 的分層圖", "endpoint layer：queue / packet / state / endpoint J\nsystem layer：既有 C-120 authority", _t(), "先分清 endpoint layer 與 system layer 的責任。", "兩層可共享 scenario、clock 與 workbook，但欄位不能因名稱相似就互相改寫。", "預期：看到 endpoint J 時，能說出它不是 whole-system 或 wall-plug energy。", common_claim_recovery, "左邊的 endpoint replay 可以回答封包、佇列、radio state、endpoint energy 與 endpoint service；右邊的 system replay 才承擔既有 C-120 canonical fields。", False),
        Page(6, "從預測走到可反駁的結果", 1, "loop", "VERIFIED", "predict → edit → run → import → replay → withheld 圓環", "先寫預測，再執行\nwithheld case 不准 retune", _t(), "先留下可被結果推翻的 prediction，再開始操作。", "只改 marked block；baseline / candidate 結果要回到同一 scenario、seed 與 boundary。", "預期：withheld 只驗證 frozen policy；推翻的 prediction 也要保留。", common_claim_recovery, "每個 lab 都先記下預期會變的 state time、packet outcome、service 或 endpoint J，再只改標記區塊，跑 baseline 與 candidate，匯入 result 看 replay，最後用 withheld case 檢驗。", False),
        Page(7, "一個小改動，必須能追到一個機制", 6, "guard", "VERIFIED", "student_policy.py marked block 卡片", "只改 marked block\npolicy hash → result → replay", _t("package root：student_policy.py"), "把每次修改縮成一個可追溯的控制點。", "PACE、hold、batch 或 urgent margin 的變化，必須能連到 state、packet、service 或 energy evidence。", "預期：每個 diff 都有 policy hash 與 result lineage；沒有 consequential diff 就停。", common_claim_recovery, "這張卡片只問一件事：你改的那一行透過哪個機制影響哪一筆 evidence？如果結果沒有 consequential diff，就記錄 gate 未通過，不用畫面效果替代。", False),
        Page(8, "今天的教學路徑", 5, "route", "VERIFIED", "十個節點的路徑圖", "why → setup → endpoint model → anchor → A → B → recovery → C → evidence → transfer", _t(), "這是一張路線圖，不是倒數計時器。", "setup、endpoint model、labs、workbook 與 transfer 沿著同一 scenario 前進；受阻時走 recovery 分支。", "預期：知道現在在哪一個 gate，以及下一個可觀察 receipt。", common_claim_recovery, "先把工具與場景的關係講清楚，再完成能回復的 setup；接著建立 endpoint state 與服務邊界的共同語言，最後把機制轉到其他 IoT 場景。", False),
        Page(9, "開場檢查點：先確認 claim 邊界", 4, "shield", "VERIFIED", "四層 claim ladder", "course-packaged simulated endpoint-energy lab\nNOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED", _t(), "先把能說與不能說的範圍放在同一張圖。", "course-owned、deterministic、simulated 的 endpoint lab 不等於 live telemetry、量測結果或 canonical parity。", "預期：看到未凍結 URL、畫面或 KPI 時，用 placeholder 保留缺口。", common_claim_recovery, "在進入命令前，我們先把能說什麼與不能說什麼放在同一張圖。這是 course-owned、deterministic、simulated 的 endpoint energy lab，不是 live telemetry、量測結果或 canonical parity 通過。", False),
        Page(10, "套件根目錄是一條 provenance 邊界", 6, "folder", "VERIFIED LOCAL ARTIFACT", "lora-energy-lab/ 資料夾樹", "README\nsetup.sh / setup.cmd\ncourse.sh / course.cmd\nstudent_policy.py\nlora_energy_lab/\nscenarios/\nschemas/", _t("解壓後：cd lora-energy-lab", "POSIX：find . -maxdepth 2 -type f", "Windows：Get-ChildItem -Recurse -File"), "先確認 local artifact 解壓後只有一個 reviewed package root。", "README、setup、launcher、policy、Python module、scenario 與 schemas 必須來自同一份 bytes；根目錄錯就停止。", "預期 receipt：single root；inventory 可看到 lora_energy_lab、scenario 與 schemas。", setup_recovery, "local artifact 已凍結為 121,139 bytes；解壓後仍不要從不同 branch 拼檔案，先確認 root 與必要檔案。", True),
        Page(11, "先核對 local artifact，再等待公開 release", 7, "checksum", "VERIFIED LOCAL ARTIFACT", "local ZIP、SHA-256 與公開 release placeholder", "檔案：lora-energy-lab-v1.zip｜121,139 bytes\nSHA-256：047e8459988d8bee59fbfdcc39189e00048f3697968901ce5b6e5363dc9e8c8c\n公開 URL：RELEASE_ASSET_PENDING", _t("ls -l ~/lora-energy-lab-v1.zip", "sha256sum ~/lora-energy-lab-v1.zip", "# public URL: RELEASE_ASSET_PENDING"), "先使用 verified local artifact；公開 URL 尚未發布前不把網路下載當成已驗證。", "sha256sum 驗證 local bytes identity，不是 energy evidence；公開 release 另行等待 owner。", "預期 receipt：121139 bytes；hash = 047e8459…e8c8；public URL = RELEASE_ASSET_PENDING。", "local hash 不符：停止並重新取得 owner 指定檔案；公開 URL 未發布：保留 placeholder，不改用舊 URL 或其他 branch。", "local ZIP 已核對為 121,139 bytes，SHA-256 為 047e8459988d8bee59fbfdcc39189e00048f3697968901ce5b6e5363dc9e8c8c。這是 local artifact 證據，不擴張成公開 GitHub Release 已可下載。", True),
        Page(12, "Windows 原生先確認 shell 與 launcher", 2, "shell", "IMPLEMENTED / NOT VERIFIED", "CMD 與 PowerShell 的提示字元對照卡", "CMD：C:\\...> py --list\nPowerShell：PS C:\\...> py -3.11 --version\n不要因為 python 指到其他版本就繼續", _t("CMD> py --list", "PS C:\\...> py -3.11 --version"), "先辨識 prompt，再確認 Python Launcher 看得到 3.11。", "CMD 與 PowerShell 的環境變數寫法不同；3.11.x 才符合 runner minor-version 邊界。", "預期 receipt：PLACEHOLDER｜Windows native clean run 尚未驗證。", setup_recovery, "如果畫面開頭是 C:\\...>，我們在 CMD；如果是 PS C:\\...>，我們在 PowerShell。先執行 py --list，再執行 py -3.11 --version；看到 3.11.x 才進入 setup。", True),
        Page(13, "沒有 Python 3.11 時的 Windows 安裝路徑", 3, "ladder", "IMPLEMENTED / NOT VERIFIED", "Python 3.11 installer → launcher → version check", "https://www.python.org/downloads/windows/\nPython 3.11.x / Windows installer (64-bit)\n安裝 Python Launcher\n重新開啟 shell → py --list", _t("開啟：https://www.python.org/downloads/windows/", "安裝後：py --list", "確認：py -3.11 --version"), "缺少 3.11 時走官方 Windows installer 路徑。", "保留 Python Launcher；重新開 shell 後再確認 minor version，不修改 lock。", "預期 receipt：PLACEHOLDER｜clean install 尚未驗證；成功時列出 Python 3.11.x。", setup_recovery, "如果 py --list 沒有 3.11，開啟畫面上的官方 Windows 下載頁，選 Python 3.11.x 的 64-bit installer 並保留 Python Launcher。完成後關閉再開 shell，重跑 py --list 與 py -3.11 --version。", True),
        Page(14, "uv 是 Python 3.11 的 recovery 工具", 1, "commands", "IMPLEMENTED / NOT VERIFIED", "三行 PowerShell command ribbon", "uv = exact interpreter recovery", _t("winget install --id=astral-sh.uv -e", "uv python install 3.11", "uv python find 3.11"), "當 launcher 找不到 3.11，用 uv 取得 exact interpreter。", "uv python find 3.11 回傳 interpreter path；它只用來建立 package-local .venv。", "預期 receipt：PLACEHOLDER｜uv fresh setup 尚未驗證；成功時回傳實際 path。", setup_recovery, "當 launcher 找不到 3.11，可以用 uv 取得 exact interpreter。先裝 uv，再跑 uv python install 3.11 與 uv python find 3.11；如果仍找不到，保留錯誤走 fallback。", True),
        Page(15, "Windows 用 package-local .venv", 2, "env", "IMPLEMENTED / NOT VERIFIED", "system Python 與 .venv\\Scripts\\python.exe 的隔離圖", "system Python ≠ package .venv\n不要共享 WSL .venv", _t("PS> Get-ChildItem .venv\\Scripts\\python.exe", "PS> .\\.venv\\Scripts\\python.exe --version"), "確認 Windows interpreter 落在 package-local venv。", "系統 Python 與 package .venv 隔離 dependency graph；不能拿 WSL 的 .venv/bin/python。", "預期 receipt：PLACEHOLDER｜Windows path clean run 尚未驗證；成功時顯示 Python 3.11.x。", setup_recovery, "隔離環境讓 runner 的 dependency graph 不受其他專案污染。Windows interpreter 應落在 .venv\\Scripts\\python.exe，不能拿 WSL 的 .venv/bin/python 來用。", True),
        Page(16, "Windows 執行 setup 與 verify", 7, "command-receipt", "IMPLEMENTED / NOT VERIFIED", "PowerShell command 與 READY receipt 的左右箭頭", "setup：建立 .venv + 依 lock 安裝\nverify：檢查 Python、wrapper、lock、policy API、scenario identity", _t('$env:PYTHON_BIN = "py -3.11"', ".\\setup.cmd", ".\\course.cmd verify"), "在 package root 以 Windows launcher 建立環境並跑 verify。", "setup 產生隔離 interpreter；verify 只在契約與 identity 通過後回 READY。", "預期 receipt：READY / PLACEHOLDER；Windows native command 與 receipt 尚未 clean-run。", setup_recovery, "在 package root 的 PowerShell，先設定 PYTHON_BIN，再執行 .\\setup.cmd，完成後執行 .\\course.cmd verify。畫面保留 READY / PLACEHOLDER，因為 Windows native command 尚未 clean-run。", True),
        Page(17, "WSL 先確認它真的是 Ubuntu shell", 2, "wsl", "IMPLEMENTED / NOT VERIFIED", "PowerShell 安裝／清單與 Ubuntu pwd / uname -a 雙視窗", "PowerShell（系統管理員）：wsl --install -d Ubuntu\nUbuntu：pwd / uname -a\n不要混用 .venv", _t("PowerShell（系統管理員）：wsl --install -d Ubuntu", "PowerShell：wsl -l -v", "Ubuntu：pwd && uname -a"), "先辨識 Windows host 與 Ubuntu guest 的 shell / path。", "看見 Linux home path 才使用 setup.sh；Windows setup.cmd 不在 WSL 執行。", "預期 receipt：PLACEHOLDER｜WSL install / identity 尚未 clean-run。", setup_recovery, "WSL 是另一個 shell 與檔案環境。先用 wsl -l -v 確認 Ubuntu，進入後跑 pwd 與 uname -a；如果看到 Linux home path，才使用 setup.sh。", True),
        Page(18, "WSL 安裝工具與 uv", 1, "ladder", "IMPLEMENTED / NOT VERIFIED", "apt → curl → uv → Python 3.11 階梯", "WSL toolchain", _t("sudo apt update", "sudo apt install -y curl unzip", "curl -LsSf https://astral.sh/uv/install.sh | sh", "uv --version && uv python find 3.11"), "在 Ubuntu shell 補齊 curl、unzip 與 uv。", "這些命令只準備 exact interpreter；不會產生 course result。", "預期 receipt：PLACEHOLDER｜WSL installer / uv 尚未 clean-run；成功時回傳 uv 版本與 interpreter path。", setup_recovery, "在 Ubuntu shell 先更新套件索引並安裝 curl、unzip，再依 installer 安裝 uv。重新開 shell 後跑 uv --version、uv python install 3.11 與 uv python find 3.11。", True),
        Page(19, "WSL 解壓與建立 .venv", 6, "path", "IMPLEMENTED / NOT VERIFIED", "/mnt/c/... → ~/lora-course/ → package root", "Windows Downloads → WSL Linux home → package-local .venv", _t("cp /mnt/c/.../lora-energy-lab-v1.zip ~/", "unzip lora-energy-lab-v1.zip", "cd lora-energy-lab", "PYTHON_BIN=python3.11 bash setup.sh", "bash course.sh verify"), "把 owner 指定的 release 複製到 WSL Linux home，再在 package root 建立 WSL 專用 venv。", "Windows 與 WSL venv 不可互換；setup 後同一個 shell 執行 verify。", "預期 receipt：PLACEHOLDER｜release 與 WSL setup / verify 尚未 clean-run；成功時回 READY。", setup_recovery, "release asset 尚未指定，所以畫面保留 RELEASE_ASSET_PENDING。收到正式 asset 後，從 /mnt/c/Users/<YourName>/Downloads/ 複製到 WSL Linux home，再在 package root 建立 WSL 專用的 .venv/bin/python。", True),
        Page(20, "POSIX runner 的最小入口", 1, "commands", "IMPLEMENTED / NOT VERIFIED", "POSIX command pair", "POSIX shell：setup → verify", _t("PYTHON_BIN=python3.11 bash setup.sh", "bash course.sh verify"), "Linux 或 macOS 以同一個 gate 驗證 package-local environment。", "POSIX launcher 雖不同於 Windows / WSL，仍要檢查 venv、lock、policy API、scenario 與 claim boundary。", "預期 receipt：PLACEHOLDER｜POSIX clean run 尚未驗證；成功時回 READY。", setup_recovery, "在 Linux 或 macOS 的 POSIX shell，先以 PYTHON_BIN=python3.11 bash setup.sh 指定 interpreter，再以 bash course.sh verify 做同一份 gate。", True),
        Page(21, "READY receipt 是下一步的入場券", 4, "receipt", "PLACEHOLDER", "machine-readable receipt 欄位放大卡", "status: READY\nPython 3.11.9\nscenario_id: ntpu-energy-decision-01\npolicy_api_version: lora-energy-policy-v1\nengine_mode: coherent-course-simulated-adapter", _t("bash course.sh verify", "Windows：.\\course.cmd verify"), "把 READY 當成環境與契約 gate，不把它當成實驗結果。", "receipt 要同時帶 Python、scenario、policy API、lock、engine mode 與 claim boundary。", "預期：PLACEHOLDER｜缺欄位、版本不符或不同 scenario 都是 fail。", setup_recovery, "請在 receipt 中找 status、Python version、scenario identity、policy API、lock、engine mode 與 claim boundary。READY 只表示可以進入 runner，不表示完成任何節能實驗。", True),
        Page(22, "setup 失敗不等於 energy result", 3, "fork", "VERIFIED", "READY 與 RECOVERABLE ERROR 的分叉牌", "讀錯誤 → 修最小邊界\n無法完成 → same-scenario fallback", _t("bash course.sh verify", "失敗時：保留原始 stdout / stderr"), "先修 Python minor、package root、lock 或 scenario 目前指出的最小問題。", "若仍無法建立 READY，轉同 scenario fallback；source mode 要標示 fallback。", "預期：RECOVERABLE ERROR receipt 不得被改寫成 READY；fallback 仍保留相同學習問題。", setup_recovery, "如果 setup 或 verify 出現錯誤，先確認 Python minor、package root、lock 與 scenario，只修目前 gate 指出的最小問題。若仍無法建立 READY，就選同 scenario fallback，並記錄 source mode。", True),
        Page(23, "可編輯檔案只有一個", 2, "guard", "VERIFIED", "student_policy.py 與四個鎖頭", "只編輯 marked blocks\nscenario / schemas / runner / generated JSON = read-only", _t("POSIX：sed -n '1,220p' student_policy.py", "Windows：Get-Content .\\student_policy.py", "git diff -- student_policy.py"), "把 policy edit 與 runner / schema / generated artifact 分開。", "policy hash、predecessor 與 freeze receipt 才能解釋結果；release bytes 不同就停止編輯。", "預期：diff 只出現在 marked blocks；其他檔案保持 read-only。", policy_recovery, "在整個實驗中，我們只改 student_policy.py 的 marked blocks。不要改 upstream framework、scenario、schema、runner、Leo code 或 generated JSON；檔案與 release 不同就回到 package identity。", True),
        Page(24, "policy API 的輸入是現在能觀察到的事", 7, "io", "PLACEHOLDER", "observation card → legal action card", "observation\nchoose_action(...)\nWAIT / SLEEP / SEND_ONE / SEND_URGENT / FLUSH_BATCH", _t("bash course.sh verify", "Windows：.\\course.cmd verify"), "先說明 policy 可以讀什麼，再說明它回傳哪個合法 action。", "policy 不能偷看 future quality、future energy 或 result summary；action 必須在契約內。", "預期：PLACEHOLDER｜verify 通過時只接受 legal action；不合法 action 先 fail closed。", policy_recovery, "policy 只能依當下允許的 observation 做選擇，不能偷看未來品質、future energy 或 result summary，也不能回傳契約外的 action。", True),
        Page(25, "Python survival：常數是受控旋鈕", 1, "code", "PLACEHOLDER", "一行斜體常數與範圍護欄", "PACE_GAP_STEPS\nREST_DURING_GAP\nBATCH_SIZE\nURGENT_MARGIN_S\nbounded values only", _t("grep -n PACE_GAP_STEPS student_policy.py", "bash course.sh verify"), "只讀懂變數名稱、等號與允許值，不把變數當成直接 energy knob。", "runner 會檢查 bounded range；每次只改一個常數，先預測 state、queue 或 service。", "預期：PLACEHOLDER｜bounded values accepted；實際 release line number 不凍結。", policy_recovery, "這裡只需要讀懂變數名稱、等號和允許值。斜體顯示的變數是 policy 控制點；runner 會檢查 bounded range，實際 release line number 尚未凍結。", True),
        Page(26, "Python survival：條件只處理當前 observation", 6, "branch", "PLACEHOLDER", "if / elif / else 的三叉決策樹", "現在看到的條件 → 一個 legal action\n不要讀 future outcome", _t("POSIX：grep -n 'def choose_action' student_policy.py", "bash course.sh verify"), "閱讀每個 Boolean condition 實際讀取的 observation。", "每個分支只回傳一個 legal action；條件成立會觸發不同 state 或 packet 行為。", "預期：PLACEHOLDER｜policy guard / verify 接受合法分支；非 marked 區域錯誤要保留。", policy_recovery, "看一個 Boolean 條件時，先圈出它讀的是哪個 observation，再指出每個分支會回傳什麼 action。若 syntax 或名稱錯誤，修 marked block 的最小行，不碰 runner。", True),
        Page(27, "Python survival：縮排與 return", 3, "return", "PLACEHOLDER", "三行縮排示意與 action token", "choose_action(observation)\nreturn WAIT\nreturn SLEEP\nreturn SEND_ONE", _t("python -m py_compile student_policy.py", "py -3.11 -m py_compile student_policy.py", "bash course.sh verify"), "用最小 Python 檢查確認縮排、return 與 action token。", "縮排決定條件屬於哪個分支；return 決定 runner 收到哪個 action。", "預期：PLACEHOLDER｜compile exit code 0，再由 verify 檢查 policy API。", policy_recovery, "縮排決定條件屬於哪個分支，return 決定 runner 收到哪個 action。若錯誤指向 marked line，只修該行並重新做 policy guard；若指向非 marked 區域，保留錯誤走 recovery。", True),
    ]


def assert_pages(pages: list[Page]) -> None:
    if [p.number for p in pages] != list(range(1, 28)):
        raise ValueError("module 1 must contain P001 through P027 exactly once")
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
    source_hash = hashlib.sha256(TEMPLATE.read_bytes()).hexdigest()
    source_lines = [
        "# C-120 module 1 source checkpoint (P001–P027)",
        "",
        f"Template: `/home/u24/ppt-master/template/educate.pptx`",
        f"Template SHA-256: `{source_hash}`",
        "",
        "The full authored source remains in `courseware/c120-lora-leo-deck/full-deck-v2-classroom-script.md`; this file is the module-1 extraction and evidence contract.",
        "",
    ]
    for page in pages:
        source_lines.extend([f"## P{page.number:03d} — {page.title}", "", f"Evidence: {page.evidence}", f"Visual: {page.visual}", f"On-slide: {page.statement}", "", f"Commands: {'; '.join(page.commands) if page.commands else 'none (concept / boundary page)'}", f"Purpose: {page.purpose}", f"Mechanism: {page.mechanism}", f"Expected: {page.expected}", f"Recovery: {page.recovery}", f"Notes: {page.notes}", ""])
    (PROJECT / "sources/module1-script.md").write_text("\n".join(source_lines), encoding="utf-8")
    notes_lines = [
        "# C-120 module 1 speaker notes (P001–P027)",
        "",
        "These notes are embedded in the PPTX notes slides. The visible slides carry the editable diagram or exact command/receipt objects; narration, caveats, and recovery wording live here.",
        "",
    ]
    for page in pages:
        notes_lines.extend([f"## P{page.number:03d} — {page.title}", "", page.notes, "", f"Recovery: {page.recovery}", ""])
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


def evidence_tag(slide, page: Page) -> None:
    color = GOLD if ("PLACEHOLDER" in page.evidence or "NOT VERIFIED" in page.evidence) else BLUE
    # Keep status metadata in a consistent safe band above the native footer.
    # The old 11pt title-rule tag was both hard to read and visually collided
    # with the template separator.  A full-size label here stays clear of the
    # title and operation content while retaining the exact evidence wording.
    if page.family == "cover":
        return
    if page.family == "receipt":
        # The receipt slide uses the lower area for four full-width identity
        # hashes, so place its status inside the anatomy card instead.
        x, y, w, h = 8.76, 4.72, 3.12, 0.30
    else:
        # Give the full 18pt status one line of breathing room; this band is
        # intentionally right-aligned and remains above the native footer.
        x, y, w, h = 8.00, 5.72, 4.62, 0.32
    text_box(slide, x, y, w, h, page.evidence, 18, bold=True, color=color, align=PP_ALIGN.RIGHT, valign=MSO_ANCHOR.MIDDLE, name="Evidence status tag", margins=(0.02, 0.0, 0.02, 0.0))


def operation_command_strip(slide, page: Page, *, y: float = 1.05) -> None:
    """Show exact shell/context commands on operation pages lacking a command card."""
    commands = list(page.commands)
    if not commands:
        return
    # Long URLs need the full slide width; ordinary commands fit cleanly in two
    # editable columns and stay at the requested 18 pt minimum.
    long_form = max(map(len, commands)) >= 82
    if long_form:
        line_h = 0.24
        h = 0.14 + line_h * len(commands)
        frame(slide, 0.72, y, 11.90, h, line=NAVY, radius=True, name="Exact command context frame")
        for i, command in enumerate(commands):
            shape = text_box(slide, 0.90, y + 0.03 + i * line_h, 11.54, line_h, command, 18, color=INK, valign=MSO_ANCHOR.MIDDLE, name=f"Exact command line {i + 1}")
            shape.text_frame.word_wrap = False
        return
    rows = (len(commands) + 1) // 2
    line_h = 0.25
    h = 0.14 + line_h * rows
    frame(slide, 0.72, y, 11.90, h, line=NAVY, radius=True, name="Exact command context frame")
    for i, command in enumerate(commands):
        col = i // rows
        row = i % rows
        x = 0.90 + col * 5.82
        shape = text_box(slide, x, y + 0.03 + row * line_h, 5.58, line_h, command, 18, color=INK, valign=MSO_ANCHOR.MIDDLE, name=f"Exact command line {i + 1}")
        shape.text_frame.word_wrap = False


def command_box(slide, commands: Iterable[str], x: float, y: float, w: float, h: float, *, label="可直接複製的操作", size=18, line=NAVY):
    frame(slide, x, y, w, h, line=line, radius=True, name="Command context frame")
    text_box(slide, x + 0.12, y + 0.05, w - 0.24, 0.34, label, 18, bold=True, color=line, name="Command context label", margins=(0.02, 0.0, 0.02, 0.0), valign=MSO_ANCHOR.MIDDLE)
    lines = list(commands)
    usable = max(0.25, h - 0.50)
    line_h = min(0.52, usable / max(1, len(lines)))
    for i, command in enumerate(lines):
        text_box(slide, x + 0.15, y + 0.44 + i * line_h, w - 0.30, line_h - 0.02, command, size if len(command) < 84 else max(18, size - 1), color=INK, valign=MSO_ANCHOR.MIDDLE, name=f"Command line {i + 1}", margins=(0.02, 0.0, 0.02, 0.0))


def draw_cover(slide, page: Page) -> None:
    set_title(slide, page.title, cover=True)
    # Cover subtitle is a native subtitle placeholder when present.
    for shape in slide.shapes:
        if shape.is_placeholder and int(shape.placeholder_format.type) == 4:
            # The template subtitle anchor sits in the middle of the cover;
            # move it below the state ribbon so it cannot collide with the
            # editable teaching diagram.
            shape.top = Inches(5.48)
            shape.height = Inches(0.38)
            write_text(shape.text_frame, "C-120｜LoRaEnergySim × 智慧節能與物聯網應用", 18, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE)
    text_box(slide, 0.92, 2.65, 11.45, 0.52, "policy → state time → packet / service → endpoint energy", 24, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Causal chain ribbon")
    items = ["SEND", "WAIT", "SLEEP", "SERVICE / J"]
    x0, y0, w, gap = 1.00, 3.52, 2.70, 0.24
    for i, label in enumerate(items):
        x = x0 + i * (w + gap)
        frame(slide, x, y0, w, 1.00, line=(BLUE if i % 2 == 0 else NAVY), radius=True, name=f"Cover state {label}")
        text_box(slide, x + 0.08, y0 + 0.20, w - 0.16, 0.45, label, 23, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Cover state label {label}")
        if i < len(items) - 1:
            connector(slide, x + w, y0 + 0.50, x + w + gap, y0 + 0.50, color=GOLD, width=1.8, name="Cover causal arrow")
    text_box(slide, 3.00, 4.78, 7.35, 0.48, "SIMULATED TEACHING DATA｜先追機制，再讀證據", 20, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Simulation boundary")


def draw_flow(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    items = ["observation", "policy", "action", "state / packet", "service", "J"]
    x0, y, w, gap = 0.74, 2.20, 1.82, 0.26
    for i, item in enumerate(items):
        x = x0 + i * (w + gap)
        frame(slide, x, y, w, 1.12, line=BLUE if i in (0, 3) else NAVY, radius=True, name=f"Flow stage {i + 1}")
        text_box(slide, x + 0.07, y + 0.21, w - 0.14, 0.56, item, 20, bold=i in (0, 5), color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Flow stage label {i + 1}")
        if i < len(items) - 1:
            connector(slide, x + w, y + 0.56, x + w + gap, y + 0.56, color=GOLD, width=1.6, name="Flow arrow")
    text_box(slide, 1.0, 3.83, 11.25, 0.78, "每一段都要能回到 result / replay；沒有 state、packet、service 或 energy 差異，就不能稱為節能證據。", 22, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Flow interpretation")
    text_box(slide, 1.8, 4.72, 9.75, 0.42, "觀察先於選擇｜服務先於 J", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Flow rule")


def draw_cards(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    labels = [("STATE", "sleep / processing / TX / RX", BLUE), ("PACKET", "collision / retry / delivered", GOLD), ("ENERGY", "state time → endpoint J", NAVY)]
    for i, (head, body, color) in enumerate(labels):
        x = 0.82 + i * 4.17
        frame(slide, x, 1.58, 3.72, 3.30, line=color, radius=True, name=f"Scope card {head}")
        circle(slide, x + 1.48, 1.86, 0.72, fill=color, line=color, name=f"Scope marker {head}")
        text_box(slide, x + 0.28, 2.76, 3.16, 0.45, head, 24, bold=True, color=color, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Scope heading {head}")
        text_box(slide, x + 0.28, 3.38, 3.16, 0.92, body, 20, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Scope body {head}")
    text_box(slide, 1.12, 5.03, 11.1, 0.38, "一個 action 會讓哪一層改變？先說機制，再看結果。", 19, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Scope takeaway")


def draw_timeline(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    text_box(slide, 0.95, 1.48, 11.35, 0.42, "LEO = changing service window；本頁只示範窗口機制", 19, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="LEO scope tag")
    connector(slide, 1.15, 3.05, 12.05, 3.05, color=NAVY, width=2.1, arrow=False, name="Service window axis")
    stages = [("機會出現", 1.28, BLUE), ("policy 選擇", 4.28, GOLD), ("送 / 等", 7.35, BLUE), ("service / energy", 10.2, NAVY)]
    for label, x, color in stages:
        circle(slide, x, 2.77, 0.56, fill=color, line=color, name=f"Window point {label}")
        text_box(slide, x - 0.55, 3.52, 1.75, 0.52, label, 20, bold=True, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Window label {label}")
    frame(slide, 1.15, 4.46, 10.85, 0.68, line=GOLD, radius=True, name="Window band")
    text_box(slide, 1.35, 4.58, 10.45, 0.40, "窗口長短改變機會；機會改變 policy；policy 改變 service / endpoint J", 20, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Window explanation")


def draw_compare(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    for i, (head, body, color) in enumerate((("ENDPOINT LAYER", "queue\npacket\nstate\nendpoint J", BLUE), ("SYSTEM LAYER", "既有 C-120 authority\ncanonical fields\n不可互寫", NAVY))):
        x = 0.84 + i * 6.05
        frame(slide, x, 1.62, 5.55, 3.52, line=color, radius=True, name=f"Evidence layer {i + 1}")
        text_box(slide, x + 0.22, 1.84, 5.10, 0.48, head, 23, bold=True, color=color, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Layer heading {i + 1}")
        text_box(slide, x + 0.35, 2.56, 4.84, 1.72, body, 22, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Layer body {i + 1}")
    connector(slide, 6.67, 2.08, 6.67, 4.72, color=GOLD, width=2.0, arrow=False, name="Layer boundary")
    text_box(slide, 1.28, 5.32, 10.8, 0.34, "共享 scenario / clock / workbook，不共享語義與 energy boundary", 18, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Layer rule")


def draw_loop(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    items = ["predict", "edit", "run", "import", "replay", "withheld"]
    coords = [(1.55, 1.72), (4.55, 1.48), (7.62, 1.72), (9.72, 3.52), (7.62, 4.48), (4.55, 4.72)]
    for i, (label, (x, y)) in enumerate(zip(items, coords)):
        circle(slide, x, y, 0.62, fill=BLUE if i % 2 == 0 else GOLD, line=BLUE if i % 2 == 0 else GOLD, name=f"Loop node {label}")
        text_box(slide, x - 0.38, y + 0.78, 1.38, 0.38, label, 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Loop label {label}")
        if i < len(items) - 1:
            x2, y2 = coords[i + 1]
            connector(slide, x + 0.62, y + 0.31, x2, y2 + 0.31, color=NAVY, width=1.2, name="Loop arrow")
    connector(slide, 4.86, 5.03, 1.86, 2.12, color=GOLD, width=1.2, name="Loop closure arrow")
    text_box(slide, 1.62, 3.03, 3.60, 0.68, "預測可被推翻\n不要 retune hidden", 20, bold=True, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Loop rule")


def draw_guard(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    if page.operation:
        operation_command_strip(slide, page)
    y0 = 1.76 if page.operation else 1.58
    frame(slide, 0.88, y0, 5.10, 3.28, line=BLUE, radius=True, name="Guarded file")
    text_box(slide, 1.12, y0 + 0.29, 4.62, 0.52, "student_policy.py", 24, bold=True, color=BLUE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Guarded filename")
    text_box(slide, 1.28, y0 + 1.06, 4.30, 1.62, "MARKED BLOCK\n只改這裡\npolicy hash → result → replay", 22, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Guarded block")
    for i, label in enumerate(("scenario", "schemas", "runner", "generated JSON")):
        x = 6.58 + (i % 2) * 2.92
        y = (1.86 if page.operation else 1.72) + (i // 2) * 1.40
        frame(slide, x, y, 2.48, 0.96, line=MUTED, radius=True, name=f"Read-only lock {label}")
        text_box(slide, x + 0.08, y + 0.20, 2.32, 0.50, "🔒 " + label, 19, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Read-only label {label}")
    text_box(slide, 6.62, 4.88, 5.66, 0.42, "沒有 consequential diff → 停在 gate", 19, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Guard stop rule")


def draw_route(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    steps = ["why", "setup", "endpoint", "anchor", "A", "B", "recovery", "C", "evidence", "transfer"]
    x0, y, w, gap = 0.88, 2.15, 1.05, 0.18
    for i, label in enumerate(steps):
        x = x0 + i * (w + gap)
        circle(slide, x + 0.20, y, 0.64, fill=BLUE if i % 2 == 0 else GOLD, line=BLUE if i % 2 == 0 else GOLD, name=f"Route node {label}")
        text_box(slide, x - 0.08, y + 0.78, 1.40, 0.42, label, 18, bold=True, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Route label {label}", margins=(0.02, 0.0, 0.02, 0.0))
        if i < len(steps) - 1:
            connector(slide, x + w + 0.02, y + 0.31, x + w + gap - 0.02, y + 0.31, color=NAVY, width=1.1, name="Route arrow")
    text_box(slide, 1.10, 4.26, 11.2, 0.72, "每一個節點都要有 gate、receipt 與 recovery；受阻時沿同一 scenario 回來。", 22, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Route explanation")


def draw_shield(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    text_box(slide, 0.95, 1.38, 11.35, 0.48, "course-packaged simulated endpoint-energy lab", 22, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Claim scope")
    layers = [("可說", "course-owned / deterministic / simulated", BLUE), ("不可說", "NOT LIVE / NOT MEASURED", GOLD), ("尚未驗證", "NOT CANONICAL-PARITY-VERIFIED", NAVY), ("處理方式", "URL / screenshot / KPI 缺口 → PLACEHOLDER", MUTED)]
    for i, (head, body, color) in enumerate(layers):
        x = 1.30 + i * 0.47
        y = 2.15 + i * 0.69
        w = 10.7 - i * 0.94
        frame(slide, x, y, w, 0.58, line=color, radius=True, name=f"Claim ladder {i + 1}")
        text_box(slide, x + 0.14, y + 0.08, 1.15, 0.38, head, 18, bold=True, color=color, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Claim heading {i + 1}")
        text_box(slide, x + 1.40, y + 0.08, w - 1.58, 0.38, body, 18, color=INK, align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.MIDDLE, name=f"Claim body {i + 1}")
    text_box(slide, 1.42, 5.20, 10.40, 0.36, "邊界會跟著 result、replay、import 與 workbook provenance 一起走", 18, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Claim provenance")


def draw_folder(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    operation_command_strip(slide, page)
    frame(slide, 0.82, 1.78, 5.42, 3.54, line=BLUE, radius=True, name="Package tree")
    text_box(slide, 1.14, 2.00, 4.80, 0.44, "lora-energy-lab/", 23, bold=True, color=BLUE, name="Package root")
    tree = ["├─ README.en.md / README.zh-TW.md", "├─ setup.sh / setup.cmd", "├─ course.sh / course.cmd", "├─ student_policy.py", "├─ lora_energy_lab/", "├─ scenarios/", "└─ schemas/"]
    for i, line in enumerate(tree):
        text_box(slide, 1.28, 2.42 + i * 0.40, 4.62, 0.32, line, 18, color=INK, name=f"Package item {i + 1}", margins=(0.02, 0.0, 0.02, 0.0), valign=MSO_ANCHOR.MIDDLE)
    frame(slide, 6.82, 1.78, 5.52, 3.54, line=NAVY, radius=True, name="Provenance gate")
    text_box(slide, 7.10, 2.04, 4.94, 0.46, "provenance gate", 23, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Provenance heading")
    text_box(slide, 7.32, 2.74, 4.48, 1.64, "single root\nreviewed bytes\ncommit 32cc723…\nrequired files present\nidentity mismatch → STOP", 18, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Provenance body")
    connector(slide, 6.24, 3.54, 6.82, 3.54, color=GOLD, width=1.8, name="Root to gate")


def draw_checksum(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    operation_command_strip(slide, page, y=1.05)
    for i, (head, body, color) in enumerate((("LOCAL ZIP", "lora-energy-lab-v1.zip\n121,139 bytes", BLUE), ("SHA-256", "047e8459988d8bee\n59fbfdcc39189e00048f3697968901ce5b6e5363dc9e8c8c", GOLD))):
        x = 0.88 + i * 6.08
        frame(slide, x, 1.92, 5.56, 1.70, line=color, radius=True, name=f"Checksum artifact {head}")
        text_box(slide, x + 0.18, 2.16, 5.20, 0.38, head, 23, bold=True, color=color, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Checksum heading {head}")
        text_box(slide, x + 0.24, 2.70, 5.08, 0.58, body, 20, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Checksum body {head}")
    text_box(slide, 1.16, 3.64, 11.02, 0.30, "repo：github.com/cedarwud/lora-energy-lab", 18, color=MUTED, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Repository identity", margins=(0.02, 0.0, 0.02, 0.0))
    frame(slide, 0.92, 3.96, 11.50, 1.08, line=NAVY, radius=True, name="Hash receipt")
    text_box(slide, 1.12, 4.18, 11.10, 0.40, "receipt：VERIFIED LOCAL ARTIFACT｜19/19 tests PASS", 21, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Hash status")
    text_box(slide, 1.20, 4.60, 10.94, 0.32, "公開 GitHub Release URL：RELEASE_ASSET_PENDING", 18, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Hash limitation", margins=(0.02, 0.0, 0.02, 0.0))


def draw_shell(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    for i, (head, prompt, body, color) in enumerate((("CMD", "C:\\...>", "py --list\npy -3.11 --version", BLUE), ("PowerShell", "PS C:\\...>", "py --list\npy -3.11 --version", NAVY))):
        x = 0.88 + i * 6.08
        frame(slide, x, 1.42, 5.56, 3.48, line=color, radius=True, name=f"Shell panel {head}")
        text_box(slide, x + 0.20, 1.70, 5.16, 0.42, head, 23, bold=True, color=color, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Shell heading {head}")
        text_box(slide, x + 0.28, 2.33, 5.00, 0.40, prompt, 20, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Shell prompt {head}")
        text_box(slide, x + 0.28, 3.04, 5.00, 0.94, body, 20, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Shell commands {head}")
    text_box(slide, 1.20, 5.12, 10.94, 0.38, "預期：PLACEHOLDER｜看到 Python 3.11.x 才進入 setup", 19, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Shell expected")


def draw_ladder(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    if page.operation:
        operation_command_strip(slide, page)
    connector(slide, 1.46, 1.92, 1.46, 5.06, color=NAVY, width=2.0, arrow=False, name="Recovery spine")
    steps = [("1", "official installer / uv", "取得 Python 3.11.x", BLUE), ("2", "Python Launcher", "保留 py --list", GOLD), ("3", "reopen shell", "清掉舊 PATH 狀態", BLUE), ("4", "version gate", "py -3.11 --version", NAVY)]
    for i, (num, head, body, color) in enumerate(steps):
        y = 1.82 + i * 0.82
        circle(slide, 1.18, y, 0.56, fill=color, line=color, name=f"Recovery step {num}")
        text_box(slide, 1.18, y + 0.09, 0.56, 0.34, num, 18, bold=True, color=WHITE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Recovery number {num}")
        frame(slide, 2.12, y - 0.04, 9.62, 0.66, line=color, radius=True, name=f"Recovery frame {num}")
        text_box(slide, 2.34, y + 0.05, 3.42, 0.42, head, 20, bold=True, color=color, name=f"Recovery heading {num}")
        text_box(slide, 5.86, y + 0.05, 5.54, 0.42, body, 20, color=INK, name=f"Recovery body {num}")


def draw_commands(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    command_box(slide, page.commands, 0.82, 1.42, 7.55, 3.64, label="PowerShell / POSIX command ribbon", size=18, line=NAVY)
    frame(slide, 8.76, 1.42, 3.60, 3.64, line=BLUE, radius=True, name="Command expected panel")
    text_box(slide, 9.00, 1.74, 3.12, 0.42, "receipt / purpose", 20, bold=True, color=BLUE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Command receipt heading")
    text_box(slide, 9.12, 2.46, 2.88, 1.72, page.expected, 19, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Command expected body")


def draw_env(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    if page.operation:
        operation_command_strip(slide, page)
    for i, (head, body, color) in enumerate((("SYSTEM PYTHON", "other project\nshared packages", MUTED), ("PACKAGE .venv", ".venv\\Scripts\\python.exe\npackage-local lock", BLUE))):
        x = 0.96 + i * 6.08
        frame(slide, x, 1.55, 5.54, 2.40, line=color, radius=True, name=f"Environment panel {head}")
        text_box(slide, x + 0.20, 1.82, 5.14, 0.44, head, 21, bold=True, color=color, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Environment heading {head}")
        text_box(slide, x + 0.26, 2.56, 5.02, 0.82, body, 20, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Environment body {head}")
    connector(slide, 6.52, 2.74, 6.52, 3.72, color=GOLD, width=2.0, arrow=False, name="Environment boundary")
    text_box(slide, 2.05, 4.42, 9.24, 0.56, "不要共享 WSL .venv｜正常上課不必 activate，launcher 優先找 package-local venv", 19, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Environment rule")


def draw_command_receipt(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    command_box(slide, page.commands, 0.82, 1.42, 6.46, 3.70, label="Windows PowerShell / package root", size=18, line=NAVY)
    connector(slide, 7.46, 3.25, 8.02, 3.25, color=GOLD, width=1.8, name="Command to receipt")
    frame(slide, 8.12, 1.42, 4.24, 3.70, line=BLUE, radius=True, name="Ready receipt panel")
    text_box(slide, 8.34, 1.75, 3.80, 0.42, "machine-readable receipt", 19, bold=True, color=BLUE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Ready receipt heading")
    text_box(slide, 8.52, 2.43, 3.46, 1.42, "status: READY\nPython 3.11.x\nscenario_id\npolicy_api_version", 20, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Ready receipt fields")
    text_box(slide, 8.40, 4.30, 3.70, 0.42, "目前：READY / PLACEHOLDER", 18, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Ready receipt status")


def draw_wsl(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    frame(slide, 0.84, 1.38, 5.70, 3.76, line=NAVY, radius=True, name="PowerShell WSL panel")
    text_box(slide, 1.10, 1.70, 5.18, 0.40, "PowerShell（系統管理員）", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="PowerShell WSL heading")
    text_box(slide, 1.18, 2.40, 5.02, 1.40, "wsl --install -d Ubuntu\nwsl -l -v\n→ 進入 Ubuntu", 22, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="PowerShell WSL commands")
    frame(slide, 6.80, 1.38, 5.70, 3.76, line=BLUE, radius=True, name="Ubuntu WSL panel")
    text_box(slide, 7.08, 1.70, 5.12, 0.40, "Ubuntu shell", 20, bold=True, color=BLUE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Ubuntu heading")
    text_box(slide, 7.18, 2.40, 4.94, 1.40, "pwd\nuname -a\n→ Linux home path 才用 setup.sh", 22, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Ubuntu commands")


def draw_path(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    operation_command_strip(slide, page)
    nodes = [("Windows Downloads", "/mnt/c/Users/<YourName>/Downloads/", BLUE), ("WSL Linux home", "~/lora-course/", GOLD), ("package root", "lora-energy-lab/", NAVY), ("local venv", ".venv/bin/python", BLUE)]
    for i, (head, body, color) in enumerate(nodes):
        x = 0.82 + i * 3.08
        frame(slide, x, 1.98, 2.62, 1.64, line=color, radius=True, name=f"Path node {head}")
        text_box(slide, x + 0.12, 2.20, 2.38, 0.38, head, 18, bold=True, color=color, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Path heading {head}")
        text_box(slide, x + 0.14, 2.78, 2.34, 0.62, body, 18, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Path body {head}", margins=(0.02, 0.0, 0.02, 0.0))
        if i < len(nodes) - 1:
            connector(slide, x + 2.62, 2.80, x + 3.08, 2.80, color=GOLD, width=1.5, name="Path arrow")
    text_box(slide, 1.0, 4.08, 11.30, 0.64, "WSL 專用 .venv/bin/python\n不要把 Windows 既有 venv 帶進 WSL", 20, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Path command")


def draw_receipt(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    operation_command_strip(slide, page)
    frame(slide, 1.55, 1.62, 10.26, 3.54, line=BLUE, radius=True, name="Receipt anatomy")
    fields = [("status", "READY / PLACEHOLDER", BLUE), ("Python", "3.11.9", NAVY), ("scenario_id", "ntpu-energy-decision-01", BLUE), ("policy_api_version", "lora-energy-policy-v1", NAVY), ("engine_mode", "coherent-course-simulated-adapter", GOLD)]
    for i, (key, value, color) in enumerate(fields):
        y = 1.92 + i * 0.58
        text_box(slide, 2.00, y, 3.50, 0.40, key, 19, bold=True, color=color, name=f"Receipt key {key}")
        text_box(slide, 5.60, y, 5.44, 0.40, value, 18, color=INK, name=f"Receipt value {key}")
    frame(slide, 0.72, 5.20, 11.90, 1.24, line=MUTED, radius=True, name="Current identity receipt")
    # Keep the complete identity receipts editable and readable.  Each hash
    # gets a full-width row instead of being squeezed into four 12pt columns.
    identity_rows = (
        "scenario_sha256: c157c76ed283074cdd17c1b689b83e168022abd2ca6ef8d9c337e69ab31a6593",
        "scenario_anchor_sha256: cfe84682a71c0c0ea09c273d4cd033c32818da63cf1695ace4363b9d789c50f9",
        "lock_sha256: f1d1fe3339137d56e4e9ea9d141b764eaa183a8f40933bad597d734bbf310197",
        "baseline_policy_sha256: 9917d2cde2e8c0eae8339b7eea2e358bf8577b4eb6aaf1e928674f6b8964ef68",
    )
    for i, identity in enumerate(identity_rows):
        shape = text_box(slide, 0.92, 5.26 + i * 0.28, 11.50, 0.26, identity, 18, color=INK, valign=MSO_ANCHOR.MIDDLE, name=f"Identity receipt row {i + 1}", margins=(0.02, 0.0, 0.02, 0.0))
        shape.text_frame.word_wrap = False


def draw_fork(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    operation_command_strip(slide, page)
    circle(slide, 5.98, 1.52, 1.08, fill=BLUE, line=BLUE, name="Fork input")
    text_box(slide, 5.50, 1.84, 2.04, 0.38, "verify", 22, bold=True, color=WHITE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Fork input label")
    connector(slide, 6.52, 2.60, 3.28, 3.25, color=NAVY, width=1.7, name="Fork ready arrow")
    connector(slide, 6.52, 2.60, 9.76, 3.25, color=GOLD, width=1.7, name="Fork error arrow")
    for x, head, body, color in ((1.05, "READY", "進入 runner\n保留同一 identity", BLUE), (7.52, "RECOVERABLE ERROR", "保留 stdout / stderr\n修最小邊界或 fallback", GOLD)):
        frame(slide, x, 3.25, 4.86, 1.60, line=color, radius=True, name=f"Fork panel {head}")
        text_box(slide, x + 0.18, 3.52, 4.50, 0.38, head, 21, bold=True, color=color, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Fork heading {head}")
        text_box(slide, x + 0.28, 4.12, 4.30, 0.50, body, 18, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Fork body {head}")
    text_box(slide, 2.04, 5.22, 9.24, 0.38, "fallback 保留相同學習問題，但不冒充本機 policy execution", 18, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Fork boundary", margins=(0.02, 0.0, 0.02, 0.0))


def draw_io(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    operation_command_strip(slide, page)
    frame(slide, 0.88, 1.64, 4.68, 2.66, line=BLUE, radius=True, name="Observation input")
    text_box(slide, 1.12, 1.92, 4.20, 0.40, "observation", 23, bold=True, color=BLUE, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Observation heading")
    text_box(slide, 1.22, 2.66, 4.00, 0.76, "當下允許讀取的狀態\nquality / queue / window", 20, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Observation body")
    connector(slide, 5.62, 2.96, 7.58, 2.96, color=GOLD, width=2.0, name="Observation to action")
    frame(slide, 7.76, 1.64, 4.68, 2.66, line=NAVY, radius=True, name="Legal action output")
    text_box(slide, 8.00, 1.92, 4.20, 0.40, "choose_action(...)", 23, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Action heading")
    text_box(slide, 8.06, 2.58, 4.08, 0.98, "WAIT / SLEEP\nSEND_ONE / SEND_URGENT\nFLUSH_BATCH", 19, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Action body")
    text_box(slide, 1.28, 4.78, 10.72, 0.50, "不能偷看 future quality、future energy 或 result summary；契約外 action 要 fail closed。", 18, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="IO guard")


def draw_code(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    operation_command_strip(slide, page)
    frame(slide, 0.86, 1.48, 7.50, 3.70, line=NAVY, radius=True, name="Python constants code")
    text_box(slide, 1.12, 1.78, 6.98, 0.38, "student_policy.py｜marked constants", 19, bold=True, color=NAVY, name="Python code heading")
    text_box(slide, 1.20, 2.42, 6.84, 1.82, "PACE_GAP_STEPS = bounded\nREST_DURING_GAP = WAIT / SLEEP\nBATCH_SIZE = bounded\nURGENT_MARGIN_S = bounded", 19, color=INK, name="Python constants")
    frame(slide, 8.78, 1.48, 3.56, 3.70, line=GOLD, radius=True, name="Bounded range guard")
    text_box(slide, 9.04, 1.78, 3.04, 0.38, "bounded values only", 20, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Bounded heading")
    text_box(slide, 9.18, 2.54, 2.76, 1.20, "先預測\n只改一個\n保留小 diff", 21, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Bounded body")


def draw_branch(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    operation_command_strip(slide, page)
    frame(slide, 4.72, 1.42, 3.88, 0.92, line=NAVY, radius=True, name="Observation condition")
    text_box(slide, 4.90, 1.68, 3.52, 0.40, "現在看到的 condition", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Condition heading")
    for i, (x, head, body, color) in enumerate(((1.02, "if", "WAIT / SLEEP", BLUE), (4.72, "elif", "SEND_ONE", GOLD), (8.42, "else", "SEND_URGENT", NAVY))):
        connector(slide, 6.66, 2.34, x + 1.50, 3.02, color=color, width=1.4, name=f"Branch arrow {i}")
        frame(slide, x, 3.02, 3.00, 1.42, line=color, radius=True, name=f"Branch panel {head}")
        text_box(slide, x + 0.14, 3.28, 2.72, 0.34, head, 20, bold=True, color=color, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Branch heading {head}")
        text_box(slide, x + 0.18, 3.84, 2.64, 0.36, body, 19, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name=f"Branch body {head}")
    text_box(slide, 1.38, 5.02, 10.42, 0.36, "每條分支只回傳一個 legal action；不要讀 future outcome。", 18, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Branch guard")


def draw_return(slide: object, page: Page) -> None:
    set_title(slide, page.title)
    operation_command_strip(slide, page)
    frame(slide, 0.84, 1.82, 7.15, 3.34, line=NAVY, radius=True, name="Return code card")
    text_box(slide, 1.12, 2.08, 6.58, 0.38, "choose_action(observation)", 21, bold=True, color=NAVY, name="Return function")
    code_lines = [("if ready:", BLUE), ("    return WAIT", NAVY), ("elif low_power:", GOLD), ("    return SLEEP", NAVY), ("else:", BLUE), ("    return SEND_ONE", NAVY)]
    for i, (line, color) in enumerate(code_lines):
        text_box(slide, 1.28, 2.66 + i * 0.36, 6.24, 0.28, line, 19, color=color, name=f"Return line {i + 1}")
    frame(slide, 8.42, 1.82, 3.92, 3.34, line=GOLD, radius=True, name="Return meaning")
    text_box(slide, 8.70, 2.12, 3.36, 0.42, "runner 收到什麼？", 20, bold=True, color=GOLD, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Return meaning heading")
    text_box(slide, 8.84, 2.78, 3.10, 1.42, "縮排\n→ 分支歸屬\nreturn\n→ action token", 21, color=INK, align=PP_ALIGN.CENTER, valign=MSO_ANCHOR.MIDDLE, name="Return meaning body")


def compose_page(slide, page: Page) -> None:
    clear_placeholders(slide)
    set_title(slide, page.title, cover=(page.number == 1))
    if page.family == "cover":
        draw_cover(slide, page)
    elif page.family == "flow":
        draw_flow(slide, page)
    elif page.family == "cards":
        draw_cards(slide, page)
    elif page.family == "timeline":
        draw_timeline(slide, page)
    elif page.family == "compare":
        draw_compare(slide, page)
    elif page.family == "loop":
        draw_loop(slide, page)
    elif page.family == "guard":
        draw_guard(slide, page)
    elif page.family == "route":
        draw_route(slide, page)
    elif page.family == "shield":
        draw_shield(slide, page)
    elif page.family == "folder":
        draw_folder(slide, page)
    elif page.family == "checksum":
        draw_checksum(slide, page)
    elif page.family == "shell":
        draw_shell(slide, page)
    elif page.family == "ladder":
        draw_ladder(slide, page)
    elif page.family == "commands":
        draw_commands(slide, page)
    elif page.family == "env":
        draw_env(slide, page)
    elif page.family == "command-receipt":
        draw_command_receipt(slide, page)
    elif page.family == "wsl":
        draw_wsl(slide, page)
    elif page.family == "path":
        draw_path(slide, page)
    elif page.family == "receipt":
        draw_receipt(slide, page)
    elif page.family == "fork":
        draw_fork(slide, page)
    elif page.family == "io":
        draw_io(slide, page)
    elif page.family == "code":
        draw_code(slide, page)
    elif page.family == "branch":
        draw_branch(slide, page)
    elif page.family == "return":
        draw_return(slide, page)
    else:
        raise ValueError(f"unknown visual family {page.family}")
    evidence_tag(slide, page)
    # Operation narration is embedded in speaker notes and the separate source
    # notes artifact.  Visual families carry their own command/receipt cards;
    # there is intentionally no fixed bottom strip over the native footer.


def create_editable_deck(pages: list[Page]) -> Path:
    """Create slide-local editable content, notes, and native layout links."""
    prs = Presentation(str(TEMPLATE))
    layouts = prs.slide_layouts
    # Keep the original two source slides in the working package for now.  The
    # final OOXML cleanup removes them after the 27 authored slides are added;
    # retaining them here avoids python-pptx duplicate slide-part names.
    layout_cycle = [0, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8, 3, 2]
    for page, layout_index in zip(pages, layout_cycle):
        slide = prs.slides.add_slide(layouts[layout_index])
        compose_page(slide, page)
        notes = slide.notes_slide
        # Notes placeholder 2 is the editable narration placeholder in the
        # educate notes master.
        body = next((shape for shape in notes.placeholders if int(shape.placeholder_format.type) == 2), None)
        if body is None:
            raise RuntimeError(f"slide {page.number}: notes body placeholder missing")
        body.text = page.notes + " " + page.recovery
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


def remove_original_slides_and_clean(working: Path) -> Path:
    """Keep only the 27 newly authored slides and clean orphaned parts."""
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
    if len(ids) < 29:
        raise RuntimeError(f"working deck has {len(ids)} slides; expected original 2 + 27")
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
    errors: list[str] = []
    warnings: list[str] = []
    source_hashes: dict[str, str] = {}
    with zipfile.ZipFile(TEMPLATE) as template, zipfile.ZipFile(final) as deck:
        if deck.testzip():
            errors.append("ZIP test failed")
        ordered = ordered_slide_parts(deck)
        if len(ordered) != 27:
            errors.append(f"slide_count={len(ordered)} expected=27")
        notes = [n for n in deck.namelist() if n.startswith("ppt/notesSlides/notesSlide") and n.endswith(".xml")]
        if len(notes) != 27:
            errors.append(f"notes_count={len(notes)} expected=27")
        all_text = []
        overflow = []
        slide_backgrounds = 0
        min_command_size = 10_000
        title_sizes: list[int] = []
        body_sizes: list[int] = []
        for index, part in enumerate(ordered, start=1):
            root = ET.fromstring(deck.read(part))
            if root.find(f"./{{{P}}}cSld/{{{P}}}bg") is not None:
                slide_backgrounds += 1
            text = "".join(node.text or "" for node in root.findall(f".//{{{A}}}t"))
            all_text.append(text)
            if FORBIDDEN_WORD in text:
                errors.append(f"slide {index}: forbidden exact Chinese word")
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
                        warnings.append(f"slide {index}: non-Times Latin run")
                for node in rpr.findall(f"{{{A}}}ea"):
                    if node.get("typeface") != "標楷體":
                        warnings.append(f"slide {index}: non-標楷體 East Asia run")
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
            if FORBIDDEN_WORD in note_text[-1]:
                errors.append(f"notes {name}: forbidden exact Chinese word")
        if any("分鐘" in text for text in all_text + note_text):
            errors.append("visible or notes time label")
        required = [
            "047e8459988d8bee59fbfdcc39189e00048f3697968901ce5b6e5363dc9e8c8c",
            "VERIFIED LOCAL ARTIFACT",
            "RELEASE_ASSET_PENDING",
            "ntpu-energy-decision-01",
            "lora-energy-policy-v1",
            "lora_energy_lab",
            "c157c76ed283074cdd17c1b689b83e168022abd2ca6ef8d9c337e69ab31a6593",
            "cfe84682a71c0c0ea09c273d4cd033c32818da63cf1695ace4363b9d789c50f9",
            "f1d1fe3339137d56e4e9ea9d141b764eaa183a8f40933bad597d734bbf310197",
            "9917d2cde2e8c0eae8339b7eea2e358bf8577b4eb6aaf1e928674f6b8964ef68",
        ]
        if not all(token in "\n".join(all_text) for token in required):
            errors.append("local artifact or current scenario identity evidence missing")
    report = {
        "schema": "c120-classroom-module1-qa-v1",
        "status": "PASS" if not errors else "FAIL",
        "input": str(final),
        "slide_count": len(ordered),
        "notes_count": len(notes),
        "slide_level_background_nodes": slide_backgrounds,
        "overflow_candidates": overflow,
        "template_part_hashes": source_hashes,
        "footer_contract": {"line_and_text_media": "ppt/media/image2.png", "logo_media": "ppt/media/image3.png", "page_number_placeholder": "layout/master sldNum"},
        "errors": errors,
        "warnings": warnings,
        "limitations": ["Microsoft PowerPoint open/reopen remains the controller-owned final gate.", "P001-P027 contain no formula; no equation image is used in this module."],
    }
    (PROJECT / "validation/qa_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def render_and_contact(final: Path) -> None:
    render = PROJECT / "renders"
    pdf = render / "module1.pdf"
    converter = Path("/home/u24/.codex/skills/pptx/scripts/office/soffice.py")
    command = [sys.executable, str(converter), "--headless", "--convert-to", "pdf", "--outdir", str(render), str(final)]
    result = subprocess.run(command, cwd=str(ROOT), text=True, capture_output=True)
    produced = render / (final.stem + ".pdf")
    if result.returncode != 0 or not produced.exists():
        (PROJECT / "validation/render-status.md").write_text("Render failed\n" + result.stdout + "\n" + result.stderr, encoding="utf-8")
        # Headless LibreOffice may be blocked by the current sandbox's dconf
        # policy.  Keep the valid PPTX/QA result and let the controller render
        # with its approved office environment; do not delete the deliverable.
        return
    produced.replace(pdf)
    subprocess.run(["pdftoppm", "-png", "-r", "144", str(pdf), str(render / "slide")], check=True, cwd=str(ROOT))
    images = sorted(render.glob("slide-*.png"), key=lambda p: int(re.search(r"(\d+)$", p.stem).group(1)))
    if len(images) != 27:
        raise RuntimeError(f"render produced {len(images)} pages, expected 27")
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
    (PROJECT / "validation/targeted-visual-review.md").write_text("# Module 1 visual review\n\nAll 27 slides rendered at 144 DPI. Inspect every `renders/slide-*.png` at original size, with special attention to command wrapping, receipt rails, footer line/text, logo, and page-number placeholder.\n", encoding="utf-8")


def write_readme(final: Path, report: dict[str, object]) -> None:
    template_hash = hashlib.sha256(TEMPLATE.read_bytes()).hexdigest()
    text = f"""# C-120 classroom module 1 (P001–P027)

Final editable deck: `exports/{final.name}`

- Scope: opening through archive download/hash, Windows native, WSL, Python 3.11, uv, package-local `.venv`, setup/verify/recovery, and safe policy-file reading.
- Source template: `/home/u24/ppt-master/template/educate.pptx`
- Template SHA-256: `{template_hash}`
- Native template parts preserved byte-for-byte: master, all layouts, theme, footer/logo media, notes master.
- Footer contract: original bottom line/text image (`ppt/media/image2.png`), original logo (`ppt/media/image3.png`), and native `sldNum` placeholders remain in the package.
- Speaker notes: 27 embedded narration notes; notes do not replace on-slide operation instructions.
- Evidence: P011 records the `VERIFIED LOCAL ARTIFACT` (`lora-energy-lab-v1.zip`, 121,139 bytes, SHA-256 `047e8459…e8c8`). Public GitHub Release URL remains `RELEASE_ASSET_PENDING`; old URLs and hashes are absent.
- Current identity: `ntpu-energy-decision-01`; scenario SHA-256 `c157c76e…a6593`; anchor `cfe84682…c50f9`; lock `f1d1fe33…0197`; baseline policy `9917d2cd…ef68`.
- Equations: none occur in P001–P027; no equation image is used.
- QA: `validation/qa_report.json`; render/contact sheets under `renders/`.
- Status: `{report.get('status')}` (PowerPoint open/reopen is the controller-owned final gate).
"""
    (PROJECT / "README.md").write_text(text, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-render", action="store_true", help="build and QA without rendering")
    args = parser.parse_args(argv)
    pages = page_data()
    assert_pages(pages)
    ensure_dirs()
    copy_sources(pages)
    (PROJECT / "analysis/content_plan.json").write_text(json.dumps([asdict(page) for page in pages], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    working = create_editable_deck(pages)
    final = remove_original_slides_and_clean(working)
    overlay_exact_template_parts(final)
    report = qa_package(final, pages)
    if not args.skip_render:
        render_and_contact(final)
    write_readme(final, report)
    print(json.dumps({"final": str(final), "qa_status": report["status"], "qa_errors": report["errors"]}, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "PASS" else 2


if __name__ == "__main__":
    raise SystemExit(main())
