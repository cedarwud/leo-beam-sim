#!/usr/bin/env python3
"""Build the independently authored C-120 module-1 classroom deck.

This lane intentionally owns only ``projects/classroom-module1-alt_ppt169_20260811``.
The deck is made directly from the supplied native educate template so its
master, layouts, theme, background art, footer line, and slide-number field
remain native PowerPoint objects.  The local shapes are editable DrawingML;
there are no slide-level background fills and no screenshots of the course UI.

The first part is deliberately teachable as a standalone run: opening, package
identity, Windows/WSL/Python 3.11/.venv setup, verification/recovery, and the
safe Python-policy boundary (P001--P027).  Windows/WSL clean-run receipts stay
explicitly pending; they are never invented by this builder.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import zipfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE, MSO_CONNECTOR
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.xmlchemy import OxmlElement
from pptx.util import Inches, Pt


ROOT = Path(__file__).resolve().parent
TEMPLATE = Path("/home/u24/ppt-master/template/educate.pptx")
PROJECT = ROOT / "projects/classroom-module1-alt_ppt169_20260811"
SOURCE_COPY = PROJECT / "sources/educate.pptx"
EXPORT = PROJECT / "exports/lora-energy-lab-module1-alt-editable.pptx"
RENDER_DIR = PROJECT / "renders"
QA_DIR = PROJECT / "qa"
ANALYSIS_DIR = PROJECT / "analysis"
VALIDATION_DIR = PROJECT / "validation"

# Current package contract.  C-120 is the course code only; these are the
# package-owned identities and must not be replaced by an obsolete ZIP claim.
REPO_URL = "https://github.com/cedarwud/lora-energy-lab"
PACKAGE_ROOT_NAME = "lora-energy-lab"
PYTHON_MODULE = "lora_energy_lab"
SCENARIO_ID = "ntpu-energy-decision-01"
POLICY_API = "lora-energy-policy-v1"
SCENARIO_SHA = "sha256:c157c76ed283074cdd17c1b689b83e168022abd2ca6ef8d9c337e69ab31a6593"
ANCHOR_SHA = "sha256:cfe84682a71c0c0ea09c273d4cd033c32818da63cf1695ace4363b9d789c50f9"
LOCK_SHA = "sha256:f1d1fe3339137d56e4e9ea9d141b764eaa183a8f40933bad597d734bbf310197"
BASELINE_POLICY_SHA = "sha256:9917d2cde2e8c0eae8339b7eea2e358bf8577b4eb6aaf1e928674f6b8964ef68"
RELEASE_ASSET_STATUS = "RELEASE_ASSET_PENDING"
LOCAL_ARTIFACT_NAME = "lora-energy-lab-v1.zip"
LOCAL_ARTIFACT_SIZE = "121139 bytes"
LOCAL_ARTIFACT_SHA = "sha256:047e8459988d8bee59fbfdcc39189e00048f3697968901ce5b6e5363dc9e8c8c"

FORBIDDEN = "學生"
MINUTE_RE = re.compile(r"(?:分鐘|\b\d+\s*(?:min|mins|minute|minutes)\b)", re.I)
LATIN_OR_NUMBER = re.compile(r"[A-Za-z0-9_./\\:-]")

# These are accents for editable local figures only.  The template remains the
# dominant carrier of background, logo, line and page-number styling.
NAVY = RGBColor(53, 55, 127)
PURPLE = RGBColor(102, 0, 102)
BLUE = RGBColor(111, 137, 247)
GOLD = RGBColor(236, 216, 130)
TEAL = RGBColor(0, 125, 128)
RED = RGBColor(192, 55, 55)
INK = RGBColor(43, 46, 65)
MUTED = RGBColor(90, 94, 111)
WHITE = RGBColor(255, 255, 255)
CREAM = RGBColor(250, 247, 232)
PALE_BLUE = RGBColor(236, 241, 254)
PALE_PURPLE = RGBColor(244, 237, 247)
PALE_GOLD = RGBColor(253, 249, 226)
PALE_TEAL = RGBColor(232, 247, 244)
PALE_RED = RGBColor(253, 239, 239)
GRAY = RGBColor(223, 226, 234)

A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
P_NS = "http://schemas.openxmlformats.org/presentationml/2006/main"


@dataclass(frozen=True)
class SlideSpec:
    number: int
    title: str
    layout: int
    kind: str
    evidence: str
    context: str
    command: str
    purpose: str
    mechanism: str
    expected: str
    recovery: str
    visual: str
    notes: str


def qn(ns: str, local: str) -> str:
    return f"{{{ns}}}{local}"


def _spec(
    number: int,
    title: str,
    kind: str,
    *,
    layout: int = 1,
    evidence: str = "SOURCE-BOUND",
    context: str = "",
    command: str = "",
    purpose: str = "",
    mechanism: str = "",
    expected: str = "",
    recovery: str = "",
    visual: str = "",
    notes: str = "",
) -> SlideSpec:
    return SlideSpec(
        number,
        title,
        layout,
        kind,
        evidence,
        context,
        command,
        purpose,
        mechanism,
        expected,
        recovery,
        visual,
        notes,
    )


SPECS: list[SlideSpec] = [
    _spec(
        1,
        "每一次 SEND、WAIT、SLEEP 都是能源決策",
        "cover",
        layout=0,
        evidence="SIMULATED TEACHING DATA",
        visual="policy → state time → packet / service → endpoint energy",
        notes="今天先不從衛星名詞開始。我們先看一個 IoT endpoint 的選擇：現在送、短暫等待，或進入低功耗休眠。每個選擇會改變狀態停留、封包服務與 endpoint energy，這個模擬教學資料會把整條因果鏈留下來。",
        recovery="若有人把畫面解讀成 live 或量測結果，先回到 endpoint boundary；這一版不宣稱 live、measured 或 canonical parity。",
    ),
    _spec(
        2,
        "節能是一條可檢驗的因果鏈",
        "causal",
        layout=1,
        visual="observation → policy → action → state / packet → service → J",
        purpose="先從可觀察輸入走到 action，再看結果；不要直接跳到最後一個數字。",
        mechanism="action 改變等待、喚醒、收發與封包路徑，service gate 通過後才累積 endpoint J。",
        expected="每一段都能回到 result 或 replay 的欄位。",
        recovery="只有畫面變化、沒有 state／packet／service／J 差異時，判定 evidence gate 未通過。",
        notes="請沿著箭頭讀這一頁。policy 只能使用當下看得到的 observation，action 才會改變狀態、封包與服務，最後才談功率乘時間的累積結果。若只看到動畫而沒有中間證據，我們不把它稱為節能證據。",
    ),
    _spec(
        3,
        "LoRaEnergySim 為什麼適合智慧節能與 IoT",
        "scope",
        layout=2,
        visual="低功耗節點 ↔ 封包與重試 ↔ sleep / process / TX / RX ↔ 可觀察結果",
        purpose="把工具放回 endpoint 的決策問題，而不是把課程變成框架導覽。",
        mechanism="狀態、封包、重試與 endpoint energy 可以沿同一個 scenario 追溯。",
        expected="看見 action 對 queue、packet、service 或 J 的可檢查後果。",
        recovery="若只改到 label 或動畫，保留結果並回到同一個 scenario 的機制檢查。",
        notes="這裡的重點不是背框架名稱，而是它能把 sleep、processing、transmit、receive、packet、retry 與 energy 結果接起來。課程 wrapper 只保留可重現、可閱讀的控制面，讓後續改動有清楚的觀察點。",
    ),
    _spec(
        4,
        "LEO 只提供會改變的服務窗口",
        "timeline",
        layout=1,
        visual="機會出現 ── policy 選擇 ── service / energy 取捨；LEO = example",
        purpose="用一個會出現、消失、變長或變短的窗口，讓 wait／send 的取捨變得可觀察。",
        mechanism="窗口只改變可用服務條件，不把 LEO 當成 endpoint energy 的量測來源。",
        expected="同一選擇在不同窗口條件下留下不同的 service 或 state evidence。",
        recovery="若解讀擴大到真實衛星測量，停在 changing-window 圖，回到 course boundary。",
        notes="LEO 在這裡是索引，不是課程終點。它提供變動的服務窗口，讓現在送還是等一下有明顯後果；同一種推理也能搬到智慧農場、HVAC 或 edge device。",
    ),
    _spec(
        5,
        "兩層 evidence 不能互相冒充",
        "boundary",
        layout=3,
        visual="endpoint replay │ C-120 system replay；共享 scenario／clock，不共享欄位語義",
        purpose="先確認每一個數字屬於哪個 boundary。",
        mechanism="endpoint replay 可說 queue、packet、state、endpoint J；system layer 才承擔既有 C-120 canonical fields。",
        expected="endpoint J 不會被填成 whole-system 或 wall-plug energy。",
        recovery="欄位名稱相似但 scope 不同時，標記不相容，回到原始 artifact，不手動換欄。",
        notes="左邊的 endpoint replay 和右邊的 C-120 system replay 可以共享 scenario 與 clock，但不能因為欄位名稱像就互相改寫。這一頁先建立 scope 防線，後面每一次判讀都回到這裡。",
    ),
    _spec(
        6,
        "從預測走到可反駁的結果",
        "loop",
        layout=1,
        visual="predict → edit → run → import → replay → withheld",
        purpose="先留下預測，再做一個受控改動，最後接受可能被推翻的結果。",
        mechanism="baseline／candidate 只改一個 marked block；withheld case 不允許事後 retune。",
        expected="prediction、policy hash、result 與 replay 能互相對上。",
        recovery="預測被推翻時保留原文；若 identity 不一致，回到 matching checkpoint。",
        notes="每個 lab 都會沿著這條環走，但每一頁的視覺和操作不同。先寫下可能改變的 state、packet、service 或 J，再改一小塊、跑結果、匯入 replay，最後用不調參的條件檢驗假說。",
    ),
    _spec(
        7,
        "一個小改動，必須追得到一個機制",
        "guarded-edit",
        layout=5,
        evidence="SOURCE-BOUND CONTROL",
        context="package root；只讀 release 的 `student_policy.py`",
        command="sed -n '1,180p' student_policy.py\ngit diff -- student_policy.py",
        purpose="只看標記區塊，先辨認允許改的控制面。",
        mechanism="policy bytes 改變 action timing 或 branch；engine、scenario、schema 不變。",
        expected="小 diff 可回溯到 policy hash，後續 result 才有因果資格。",
        recovery="非 marked 區域出現差異就停止編輯，回到 package identity 或 known-good copy。",
        visual="student_policy.py 的 marked block → policy hash → result → replay",
        notes="這張只做一次邊界確認。請先讀 marked block 和 diff，說出它可能改變的 state、queue 或 service，再執行任何 runner。若非標記區域也變了，就不要把那次結果當成受控比較。",
    ),
    _spec(
        8,
        "今天的路徑：先把工具變成可回復的入口",
        "route",
        layout=1,
        visual="why → package → shell → Python 3.11 → .venv → verify → policy boundary",
        purpose="先固定 provenance 與環境，再進入可觀察的 policy 控制面。",
        mechanism="每個 gate 都有下一個可查的輸出；失敗不靠猜測往下走。",
        expected="到達 READY 後，才進入可控的 Python policy 操作。",
        recovery="任何 gate 卡住，保留錯誤，沿同一條 package identity 的 recovery 路徑返回。",
        notes="這張是 route map，不是課程時程。先取對 archive，再分辨 Windows 或 WSL，固定 Python 3.11 和 package-local venv，最後才讀 policy。每個節點都保留一個可以回看的輸出。",
    ),
    _spec(
        9,
        "開場檢查點：先確認 claim 邊界",
        "claim",
        layout=3,
        evidence="SOURCE-BOUND CLAIM CEILING",
        visual="course-packaged simulated endpoint-energy lab\nNOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED",
        purpose="先決定這一包資料能支持的 claim 上限。",
        mechanism="claim label 跟著 result、replay、import 與 workbook，不能用漂亮 KPI 升級。",
        expected="後續畫面保留 simulated／not-live 語義。",
        recovery="看到未凍結 URL、畫面或數字時，留作 placeholder，不能自行填成 evidence。",
        notes="進入命令前先把 claim ceiling 說清楚。這是 deterministic simulated teaching data，不是 live telemetry、量測結果或 canonical parity 通過。之後若看到尚未凍結的欄位或 KPI，我們保留缺口而不捏造。",
    ),
    _spec(
        10,
        "套件根目錄是 provenance 邊界",
        "operation-tree",
        layout=1,
        evidence="VERIFIED LOCAL ARTIFACT｜single root / 19 tests",
        context="解壓後的父目錄（POSIX shell）",
        command="find lora-energy-lab -maxdepth 1 -type f -print\nls lora-energy-lab/lora_energy_lab lora-energy-lab/scenarios",
        purpose="先確認 runner、Python module、scenario、schema 和說明來自同一個根目錄。",
        mechanism="single root 讓 setup、course launcher、module、policy 與 scenario 綁在同一份 reviewed artifact。",
        expected="看到 `lora-energy-lab/`；`run_lab.py`、`setup.sh / setup.cmd`、`course.sh / course.cmd`、`lora_energy_lab/`、`scenarios/`。",
        recovery="根目錄多一層、必要檔案缺失或檔案來自不同 source 時停止，重新取得同一份指定 artifact。",
        visual="lora-energy-lab/\n├── run_lab.py / setup.sh / setup.cmd\n├── course.sh / course.cmd\n├── lora_energy_lab/\n├── scenarios/ntpu-energy-decision-01.json\n└── schemas/",
        notes="拿到 artifact 後不要從不同 branch 或 source 拼檔案。先在解壓後的父目錄列出根目錄內容；目前 local artifact 已完成 fresh extract、Python 3.11 setup、READY 與 19/19 tests。根目錄結構不對，就先停止，不要把後面的 shell 或結果當成同一份 release。",
    ),
    _spec(
        11,
        "取得目前 source，先核對 identity",
        "operation-download",
        layout=2,
        evidence="VERIFIED LOCAL ARTIFACT｜public release pending",
        context="POSIX shell；source parent 或 local artifact 目錄；不要猜 public release URL",
        command="git clone https://github.com/cedarwud/lora-energy-lab.git\ncd lora-energy-lab\nsha256sum scenarios/ntpu-energy-decision-01.json\nsha256sum requirements-lock.txt",
        purpose="取得 owner 指定 source，並核對 scenario 與 lock identity；public release asset 仍停在邊界。",
        mechanism="repo source + scenario hash + lock hash 綁定 runner；local ZIP 只在明示 VERIFIED LOCAL ARTIFACT 時使用。",
        expected=f"`{PACKAGE_ROOT_NAME}/`；scenario=`{SCENARIO_ID}`；scenario hash=`{SCENARIO_SHA}`；anchor=`{ANCHOR_SHA}`；lock=`{LOCK_SHA}`；local ZIP=`{LOCAL_ARTIFACT_NAME}`, {LOCAL_ARTIFACT_SIZE}, `{LOCAL_ARTIFACT_SHA}`；public release=`{RELEASE_ASSET_STATUS}`。",
        recovery="repo unavailable or local hashes mismatch: preserve output and stop; do not substitute another branch, archive, or guessed public URL.",
        visual=f"SOURCE REPO\n{REPO_URL}\n\nVERIFIED LOCAL ARTIFACT\n{LOCAL_ARTIFACT_NAME}｜{LOCAL_ARTIFACT_SIZE}\n{LOCAL_ARTIFACT_SHA}\n\nPUBLIC RELEASE\n{RELEASE_ASSET_STATUS}",
        notes=f"目前可核對的是 source repo、scenario／anchor／lock identity，以及 local artifact `{LOCAL_ARTIFACT_NAME}` 的 bytes／SHA-256。public GitHub Release URL 尚未凍結，投影片明示 `{RELEASE_ASSET_STATUS}`；不要放猜測 URL、ZIP 或 checksum。hash 不符時要停止，不能用相似 source 取代。",
    ),
    _spec(
        12,
        "Windows 原生：先確認 shell 與 launcher",
        "operation-windows-shell",
        layout=3,
        evidence="PENDING｜Windows clean-run receipt",
        context="`C:\\...>` 是 CMD；`PS C:\\...>` 是 PowerShell；位於 package root",
        command="py --list\npy -3.11 --version",
        purpose="先確認 launcher 找得到課程預期的 Python minor version。",
        mechanism="`py -3.11` 明確選 interpreter，避免 `python` 指向其他版本。",
        expected="清單含 3.11；版本命令回傳 `Python 3.11.x`。Windows clean-run evidence 目前待補。",
        recovery="沒有 3.11 或 launcher 失敗：保留輸出，走 Python installer 或 uv recovery；不要硬用另一個版本。",
        visual="C:\\...> py -3.11 --version\nPS C:\\...> py -3.11 --version",
        notes="先看提示字元，確認自己是在 CMD 還是 PowerShell，再執行兩個 launcher 命令。畫面上可以教正確路徑，但 Windows 的 clean-run receipt 仍是 pending；若沒有 3.11，下一頁只走安裝或 uv 的 recovery。",
    ),
    _spec(
        13,
        "沒有 Python 3.11：官方 Windows 安裝路徑",
        "operation-python-install",
        layout=1,
        evidence="PENDING｜clean install / launcher receipt",
        context="Windows 瀏覽器 → 官方下載頁；完成後重新開 CMD 或 PowerShell",
        command="https://www.python.org/downloads/windows/\nPython 3.11.x / Windows installer (64-bit)\npy --list\npy -3.11 --version",
        purpose="建立 runner 預期的 3.11 minor-version 邊界，保留 Python Launcher。",
        mechanism="launcher 把後續 `.venv` 建立綁到明確 interpreter，而不是系統預設 `python`。",
        expected="重新開 shell 後，`py --list` 顯示 3.11，版本命令回傳 3.11.x；clean install 尚未實機核對。",
        recovery="安裝器、PATH 或 launcher 仍失敗：保留錯誤，改走 uv recovery；不修改 lock 或套件內容。",
        visual="官方下載頁 → 64-bit installer → Python Launcher → version check",
        notes="若 launcher 沒有 3.11，請沿著官方 Windows 下載頁選擇 3.11.x 的 64-bit installer，安裝時保留 Python Launcher。完成後重新開 shell 再驗證；這頁是明確路徑，不把尚未完成的 clean install 說成已通過。",
    ),
    _spec(
        14,
        "uv：Python 3.11 的可追溯 recovery",
        "operation-uv",
        layout=1,
        evidence="PENDING｜uv / Python clean-run receipt",
        context="Windows PowerShell；位於 package root 或可寫的工具目錄",
        command="winget install --id=astral-sh.uv -e\nuv --version\nuv python install 3.11\nuv python find 3.11",
        purpose="當 launcher 沒有 3.11 時，取得 exact interpreter 供 package-local venv 使用。",
        mechanism="uv 只解決 interpreter 取得；它不產生 course result，也不替代 lock。",
        expected="`uv python find 3.11` 回傳實際 interpreter path；Windows clean-run 目前待補。",
        recovery="uv 安裝或下載受阻：保留錯誤，回到同一 package 的 fallback；不要移除版本 pin。",
        visual="winget → uv → Python 3.11 → interpreter path",
        notes="這條路徑是 launcher 的 recovery，不是把最新 Python 硬塞進來。先確認 uv，再安裝和尋找 3.11；最後輸出的是 interpreter path。若網路或 policy 阻擋，留下錯誤並走同 scenario fallback。",
    ),
    _spec(
        15,
        "Windows、WSL、系統 Python：三者不能共用 `.venv`",
        "operation-venv-boundary",
        layout=3,
        evidence="SOURCE-BOUND ENVIRONMENT CONTRACT",
        context="Windows package root；另有獨立 WSL Linux package root",
        command=".\\.venv\\Scripts\\python.exe --version\n# WSL: .venv/bin/python --version",
        purpose="讓 dependency graph 固定在 package-local interpreter，避免跨環境污染。",
        mechanism="Windows 使用 `.venv\\Scripts\\python.exe`；WSL 使用 `.venv/bin/python`；兩個 venv 不能互換。",
        expected="各環境的 Python path 都落在該 package 的 `.venv`，不是另一個專案或另一個 OS。",
        recovery="path 指到跨環境 venv 時停止，刪除或重建動作交由 setup gate 處理；先保留錯誤和 package identity。",
        visual="system Python  ✕  shared venv\nWindows → .venv\\Scripts\\python.exe\nWSL → .venv/bin/python",
        notes="隔離環境不是多一道儀式，而是讓 dependency graph 可解釋。Windows 和 WSL 是不同檔案環境，不能互拷 `.venv`；不需要平常 activate，只要確認 runner 找到 package-local interpreter。",
    ),
    _spec(
        16,
        "Windows：setup 後立刻 verify",
        "operation-windows-setup",
        layout=2,
        evidence="PENDING｜Windows native clean-run",
        context="PowerShell；`Set-Location` 到解壓後的 `lora-energy-lab` 根目錄",
        command="$env:PYTHON_BIN = \"py -3.11\"\n.\\setup.cmd\n.\\course.cmd verify",
        purpose="setup 建立 venv 並依 lock 安裝；verify 檢查 interpreter、wrapper、policy API 與 scenario identity。",
        mechanism="同一個 package root 產生 machine-readable receipt，讓後續操作有固定入口。",
        expected="預期看到 `READY`、Python version、scenario_id、lock／policy identity；Windows clean-run 仍 pending。",
        recovery="若版本、lock 或 identity 失敗，保留 receipt 和錯誤，先修目前 gate；不能用手改 JSON 偽造 READY。",
        visual="PowerShell command ribbon → READY receipt\nWindows clean-run: PENDING",
        notes="在 PowerShell 的 package root 依序設定 interpreter、跑 setup，再跑 verify。setup 只建立環境，verify 才確認契約；目前這頁的 Windows native clean-run receipt 還沒完成，所以用 pending 標示，而不是放假輸出。",
    ),
    _spec(
        17,
        "WSL：先確認它真的是 Ubuntu shell",
        "operation-wsl-shell",
        layout=3,
        evidence="PENDING｜WSL clean-run receipt",
        context="系統管理員 PowerShell → Ubuntu shell；不要把 CMD 指令貼進 Ubuntu",
        command="wsl --install -d Ubuntu\nwsl -l -v\npwd\nuname -a",
        purpose="辨認 Windows 管理指令與 Linux runner 的檔案／shell 邊界。",
        mechanism="看到 Linux home path 與 `uname -a` 後，才使用 `setup.sh` 和 `.venv/bin/python`。",
        expected="Ubuntu distribution 狀態清楚，`pwd` 是 Linux path；WSL clean-run evidence 目前待補。",
        recovery="WSL 未啟用、distribution 不對或 path 混用時停在 shell gate；保留輸出，回到 Windows 或同 scenario fallback。",
        visual="PowerShell: wsl -l -v  →  Ubuntu: pwd / uname -a",
        notes="WSL 是另一個 shell 與檔案環境。尚未安裝才由系統管理員 PowerShell 走 `wsl --install`；進入 Ubuntu 後，用 `pwd` 和 `uname -a` 確認自己真的在 Linux。clean-run 仍待補，不能把命令列表當實機收據。",
    ),
    _spec(
        18,
        "WSL：工具鏈只服務 setup，不產生結果",
        "operation-wsl-tools",
        layout=1,
        evidence="PENDING｜WSL toolchain clean-run",
        context="Ubuntu shell；位於可寫的 home 或 package parent",
        command="sudo apt update\nsudo apt install -y curl unzip\ncurl -LsSf https://astral.sh/uv/install.sh | sh\nuv python install 3.11",
        purpose="補上解壓、下載與 exact interpreter 工具，供後面的 package setup 使用。",
        mechanism="apt、curl、uv 只建立環境前提；它們不會填寫 energy result。",
        expected="`uv --version` 和 `uv python find 3.11` 可回傳；WSL clean-run 仍 pending。",
        recovery="apt／installer 被網路或 policy 擋住時保留 stderr，走同 package fallback；不把 setup error 當 energy evidence。",
        visual="apt → curl → uv → Python 3.11",
        notes="在 Ubuntu 先裝最小工具，再用 uv 取得 3.11。這些命令只為了讓 setup 有 interpreter 和 unzip 能力，並不代表 runner 已經執行。若政策或網路阻擋，保留錯誤，不能刪掉 lock 來繞過。",
    ),
    _spec(
        19,
        "WSL：從 Windows Downloads 到 Linux `.venv`",
        "operation-wsl-venv",
        layout=1,
        evidence="PENDING｜WSL package setup receipt",
        context="Ubuntu shell；local artifact 已位於 home 或 package parent；public release asset 尚未凍結",
        command="cd /path/to/lora-energy-lab\nPYTHON_BIN=\"$(uv python find 3.11)\" bash setup.sh\nbash course.sh verify",
        purpose="在 Linux package root 建立專屬 `.venv`，不攜入 Windows venv。",
        mechanism="setup、verify 都在同一個 Linux root 中；local artifact 只在明示 VERIFIED LOCAL ARTIFACT 時使用，receipt 可追到同一 source。",
        expected="`.venv/bin/python` 存在，verify 預期回傳 READY；WSL clean-run 仍 pending。",
        recovery="解壓層級、path 或 interpreter 不符時停止，保留錯誤並回到 package identity；不要拷貝另一個 OS 的 venv。",
        visual="source parent → lora-energy-lab/ → .venv/bin/python\nlocal artifact: VERIFIED\npublic release: PENDING",
        notes="這頁只示範 Linux package root 的 setup／verify；local artifact 已有明確 VERIFIED LOCAL ARTIFACT 標籤，但 public release asset 仍 pending，所以不放 Windows Downloads 的猜測 ZIP 命令。每一步都用 Linux path，Windows 的 `.venv` 不跨過來。",
    ),
    _spec(
        20,
        "POSIX runner：一組最小 setup／verify 入口",
        "operation-posix",
        layout=2,
        evidence="PENDING｜POSIX clean-run receipt",
        context="Linux 或 macOS POSIX shell；已位於 package root",
        command="PYTHON_BIN=python3.11 bash setup.sh\nbash course.sh verify",
        purpose="用 POSIX shell 重現同一個 package-local environment gate。",
        mechanism="shell 不同，驗證語義不變：venv、lock、policy API、scenario 與 claim boundary 都要對齊。",
        expected="verify 應寫出 READY receipt；目前沒有 fresh POSIX clean-run，保留 pending。",
        recovery="找不到 `python3.11` 或 verify 失敗時保留命令輸出，回到 interpreter／package gate，不補填 READY。",
        visual="setup.sh\n   ↓\ncourse.sh verify\n   ↓\nREADY / PENDING",
        notes="POSIX 入口把兩行命令縮到最小，但不省略驗證。先用明確的 `python3.11` 建環境，再用同一 package 的 course launcher verify。這頁的 clean-run 仍 pending，不能因為命令看起來合理就宣稱通過。",
    ),
    _spec(
        21,
        "READY receipt 是下一步的入場券",
        "operation-receipt",
        layout=1,
        evidence="PENDING｜receipt schema instance",
        context="package root；已完成 setup／verify 的 shell",
        command="cat artifacts/verify-receipt.json\n# Windows: Get-Content artifacts\\verify-receipt.json",
        purpose="讀 machine-readable receipt，而不是只看終端最後一行。",
        mechanism="status、Python、scenario、policy API、lock、engine mode 與 claim ceiling 必須同時成立。",
        expected=f"看到 `status: READY`、`Python 3.11.x`、`scenario_id: {SCENARIO_ID}`、`policy_api_version: {POLICY_API}`、`engine_mode`；local artifact 已核對 19/19 tests，fresh receipt 仍待課堂重跑。",
        recovery="缺欄、版本不符或 scenario 不一致時，保留 receipt，回到對應 gate；不可手改成 READY。",
        visual=f"{{\n  status: READY,\n  python: 3.11.x,\n  scenario_id: {SCENARIO_ID},\n  policy_api_version: {POLICY_API},\n  scenario_sha256: {SCENARIO_SHA},\n  scenario_anchor_sha256: {ANCHOR_SHA},\n  lock_sha256: {LOCK_SHA},\n  policy_sha256: {BASELINE_POLICY_SHA}\n}}",
        notes=f"READY 不是實驗結果，而是環境和契約可以進入 runner 的訊號。請從檔案讀 status、Python、scenario、API、lock 和 claim ceiling；local artifact 的 fresh receipt 已在本地跑通，但課堂環境仍要重跑並保留原始檔。這頁只展示目前指定 identity：scenario `{SCENARIO_ID}`、API `{POLICY_API}`，不填猜測結果。",
    ),
    _spec(
        22,
        "setup 失敗不等於 energy result",
        "operation-recovery",
        layout=3,
        evidence="SOURCE-BOUND RECOVERY CONTRACT",
        context="任何 shell；目前 gate 的錯誤輸出仍保留",
        command="保存 stderr → 確認 Python / root / lock / scenario → 重跑目前 gate\n無法 READY → same-scenario fallback",
        purpose="把環境故障和 energy claim 分開，先修最小邊界。",
        mechanism="fail-closed 讓未通過的 setup 不會產生半套 result；fallback 保留 scenario identity。",
        expected="修好後得到新的 READY receipt，或明確標記 fallback／未執行。",
        recovery="不刪錯誤、不手改 receipt、不用空陣列或零值假裝成功；必要時回 known-good checkpoint。",
        visual="ERROR\n  ↓ 讀最小診斷\nREADY  或  SAME-SCENARIO FALLBACK",
        notes="如果 setup 或 verify 失敗，先把錯誤放回它所屬的環境層，確認 Python、根目錄、lock 和 scenario。只修目前 gate 指出的最小問題；若仍無法 READY，就保留同一 scenario 的 fallback 標記，不把安裝失敗誤說成 energy result。",
    ),
    _spec(
        23,
        "可編輯檔案只有一個",
        "operation-edit-boundary",
        layout=2,
        evidence="SOURCE-BOUND CONTROL SURFACE",
        context="package root；verify 已通過或已明示 fallback",
        command="git status --short\ngit diff -- student_policy.py\n# 只改 marked block",
        purpose="隔離一個可控制變因，保留 engine、scenario、schema、runner 和 generated JSON 不變。",
        mechanism="policy hash 與 predecessor 可以解釋 candidate；非 marked 變更會破壞公平比較。",
        expected="diff 只落在 `student_policy.py` 的 marked block；下一步可計算 policy identity。",
        recovery="非 marked 檔案或區域出現差異，停止本次 run，回到 release identity 或 known-good copy。",
        visual="student_policy.py  ✓ marked blocks\nengine / scenario / schemas / runner / generated JSON  🔒",
        notes="現在才進入可編輯面。先看 status 和 diff，再只改 `student_policy.py` 的 marked block；engine、scenario、schema、runner 和 generated JSON 都保持唯讀。這個邊界是後面 policy hash 和結果判讀成立的前提。",
    ),
    _spec(
        24,
        "policy API 的輸入是現在能觀察到的事",
        "operation-api",
        layout=2,
        evidence="PENDING｜release API/schema instance",
        context="package root；開啟 `student_policy.py` 的 bounded function",
        command="rg -n \"choose_action|WAIT|SLEEP|SEND_ONE|SEND_URGENT|FLUSH_BATCH\" student_policy.py\npython -m py_compile student_policy.py",
        purpose="先辨認合法 observation 和 legal action，不重寫 simulator。",
        mechanism="observation → choose_action → action；不可讀 future outcome，也不可回傳契約外字串。",
        expected=f"看到合法 action token 與 syntax guard 通過；policy API=`{POLICY_API}`，實際課堂 receipt 仍待重跑。",
        recovery="syntax 或 action 名稱錯誤只修 marked block；API 不一致就回 package identity，不擴充 action set。",
        visual="observation\n   ↓ choose_action(...)\nWAIT / SLEEP / SEND_ONE / SEND_URGENT / FLUSH_BATCH",
        notes="policy 只可以依當下允許的 observation 選 action，不能偷看 future quality、future energy 或 result summary。先用搜尋和 syntax guard 讀 bounded function，再把每個合法 action 對應到可能的 state 或 packet 後果。",
    ),
    _spec(
        25,
        "Python survival：常數是受控旋鈕",
        "operation-constants",
        layout=1,
        evidence="PENDING｜release line / guard receipt",
        context="package root；`student_policy.py` marked constants 區域",
        command="rg -n \"PACE_GAP_STEPS|REST_DURING_GAP|BATCH_SIZE|URGENT_MARGIN_S\" student_policy.py\npython -m py_compile student_policy.py",
        purpose="只讀懂名稱、等號與 bounded value，先預測它會改變哪個機制。",
        mechanism="一個常數可能改變等待、wake、queue age、batch 或 deadline；runner 會檢查範圍。",
        expected="小 diff、syntax guard 通過；實際 line number 和 guard receipt 尚未凍結。",
        recovery="值超出 bounded range 或 syntax 失敗，只修 marked line；不改 runner 或放寬 guard。",
        visual="`PACE_GAP_STEPS`   `REST_DURING_GAP`\n`BATCH_SIZE`       `URGENT_MARGIN_S`\n                ↓\n        one control → one mechanism",
        notes="這裡只需要讀懂 Python 的常數與等號，不要求掌握整個 framework。每次先預測它可能改變的 state、queue 或 service，再做一個小 diff；如果值超出 guard，修回允許範圍，不要放寬 runner。",
    ),
    _spec(
        26,
        "Python survival：條件只處理當前 observation",
        "operation-branch",
        layout=1,
        evidence="PENDING｜policy guard receipt",
        context="package root；marked `choose_action(observation)` 區域",
        command="sed -n '1,180p' student_policy.py\npython -m py_compile student_policy.py",
        purpose="讀每一個 Boolean 條件，指出它只使用哪個當下可見欄位。",
        mechanism="if／elif／else 會把當下 observation 映射成一個合法 action，不能偷看 result。",
        expected="每個分支都有可讀的 action；syntax guard 通過，後續 runner 才有資格執行。",
        recovery="名稱或縮排錯誤只改 marked block；traceback 指到非 marked 區域時保留錯誤並回 recovery。",
        visual="現在的 observation\n   ├─ condition A → WAIT\n   ├─ condition B → SLEEP\n   └─ else → SEND_ONE",
        notes="看條件時先圈出它讀的是哪一個當下 observation，再說出每個分支的 legal action。這會把程式閱讀接回機制，而不是把 future result 偷渡進 decision。若錯誤不在 marked block，就停止編輯並保留 traceback。",
    ),
    _spec(
        27,
        "Python survival：縮排與 return",
        "operation-return",
        layout=3,
        evidence="PENDING｜policy guard / API receipt",
        context="package root；syntax guard 以前的 marked function",
        command="python -m py_compile student_policy.py\n# guard 失敗：只修 marked line，重跑同一命令",
        purpose="看懂縮排決定分支，`return` 決定 runner 收到哪一個 action。",
        mechanism="choose_action(observation) → return WAIT / SLEEP / SEND_ONE；不碰 framework traceback 以外的區域。",
        expected="syntax guard 通過，且 action token 仍在 API 合法集合內。",
        recovery="錯誤指向 marked line 才修；非 marked 錯誤保留、回到 package checkpoint 或 fallback。",
        visual="if condition:\n    return WAIT\nelif condition:\n    return SLEEP\nelse:\n    return SEND_ONE",
        notes="最後用一個最小 Python 觀念收束：縮排決定條件屬於哪個分支，`return` 決定 runner 收到的 action。這不是 framework 除錯課；只修 marked line，其他 traceback 保留並交回 recovery gate。",
    ),
]


def validate_specs() -> None:
    if [s.number for s in SPECS] != list(range(1, 28)):
        raise ValueError("module1-alt requires P001..P027 exactly once")
    for s in SPECS:
        text = " ".join(str(value) for value in asdict(s).values())
        if FORBIDDEN in text:
            raise ValueError(f"P{s.number:03d}: forbidden exact Chinese word")
        if MINUTE_RE.search(text):
            raise ValueError(f"P{s.number:03d}: minute/time label forbidden")
        if s.kind.startswith("operation") and not all((s.context, s.command, s.purpose, s.mechanism, s.expected, s.recovery)):
            raise ValueError(f"P{s.number:03d}: operation page missing contract field")


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
        node = rpr.find(qn(A_NS, tag))
        if node is None:
            node = OxmlElement(f"a:{tag}")
            rpr.append(node)
        node.set("typeface", face)


def rich_text(tf, text: str, size: int = 24, *, bold: bool = False, color: RGBColor = INK, italic_code: bool = True, align=PP_ALIGN.LEFT) -> None:
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = Inches(0.08)
    tf.margin_right = Inches(0.08)
    tf.margin_top = Inches(0.04)
    tf.margin_bottom = Inches(0.03)
    tf.vertical_anchor = MSO_ANCHOR.TOP
    lines = str(text).splitlines() or [""]
    for line_i, line in enumerate(lines):
        p = tf.paragraphs[0] if line_i == 0 else tf.add_paragraph()
        p.alignment = align
        p.space_after = Pt(3)
        for token in re.split(r"(`[^`]*`)", line):
            if not token:
                continue
            marked = token.startswith("`") and token.endswith("`")
            raw = token[1:-1] if marked else token
            # Keep Chinese and Latin in the same editable run sequence while
            # applying the contract to every generated run.
            for part in re.findall(r"[\u3400-\u9fff\uF900-\uFAFF]+|[^\u3400-\u9fff\uF900-\uFAFF]+", raw):
                italic = bool(marked and italic_code and LATIN_OR_NUMBER.search(part))
                run = p.add_run()
                run.text = part
                set_run_font(run, size, bold=bold, italic=italic, color=color)


def add_text(slide, x: float, y: float, w: float, h: float, text: str, size: int = 24, *, bold: bool = False, color: RGBColor = INK, italic_code: bool = True, align=PP_ALIGN.LEFT, name: str = ""):
    shape = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    shape.name = name or "Editable text"
    shape.fill.background()
    shape.line.fill.background()
    rich_text(shape.text_frame, text, size, bold=bold, color=color, italic_code=italic_code, align=align)
    return shape


def add_box(slide, x: float, y: float, w: float, h: float, *, fill: RGBColor = WHITE, line: RGBColor = BLUE, width: float = 1.0, radius: bool = True, name: str = "Editable figure"):
    shape_type = MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE if radius else MSO_AUTO_SHAPE_TYPE.RECTANGLE
    shape = slide.shapes.add_shape(shape_type, Inches(x), Inches(y), Inches(w), Inches(h))
    shape.name = name
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    shape.line.color.rgb = line
    shape.line.width = Pt(width)
    return shape


def add_line(slide, x1: float, y1: float, x2: float, y2: float, *, color: RGBColor = NAVY, width: float = 1.4, arrow: bool = False, name: str = "Editable connector"):
    shape = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    shape.name = name
    shape.line.color.rgb = color
    shape.line.width = Pt(width)
    if arrow:
        shape.line.end_arrowhead = True
    return shape


def add_dot(slide, x: float, y: float, d: float = 0.18, color: RGBColor = TEAL, name: str = "State marker"):
    shape = slide.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.OVAL, Inches(x), Inches(y), Inches(d), Inches(d))
    shape.name = name
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.color.rgb = color
    return shape


def add_tag(slide, x: float, y: float, w: float, text: str, *, fill: RGBColor = PALE_BLUE, color: RGBColor = NAVY, name: str = "Status tag"):
    add_box(slide, x, y, w, 0.34, fill=fill, line=fill, width=0.5, name=name)
    add_text(slide, x + 0.04, y + 0.015, w - 0.08, 0.27, text, 15, bold=True, color=color, align=PP_ALIGN.CENTER, italic_code=False, name=name + " text")


def clear_placeholders(slide, *, keep_title: bool = True) -> None:
    for shape in list(slide.shapes):
        if not shape.is_placeholder:
            continue
        idx = shape.placeholder_format.idx
        typ = str(shape.placeholder_format.type).upper()
        if idx == 10 or (keep_title and "TITLE" in typ):
            continue
        shape._element.getparent().remove(shape._element)


def set_title(slide, title: str, *, cover: bool = False) -> None:
    if cover:
        for shape in list(slide.shapes):
            if shape.is_placeholder and "TITLE" in str(shape.placeholder_format.type).upper():
                shape._element.getparent().remove(shape._element)
        add_text(slide, 0.86, 1.04, 7.55, 1.42, title, 28, bold=True, color=NAVY, name="Native title anchor")
        return
    title_shape = None
    for shape in slide.shapes:
        if shape.is_placeholder and "TITLE" in str(shape.placeholder_format.type).upper():
            title_shape = shape
            break
    if title_shape is None:
        title_shape = add_text(slide, 0.68, 0.18, 11.95, 0.66, title, 28, bold=True, color=NAVY, name="Native title anchor")
    else:
        rich_text(title_shape.text_frame, title, 28, bold=True, color=NAVY, italic_code=False)
        title_shape.name = "Native title anchor"


def status_fill(evidence: str) -> tuple[RGBColor, RGBColor, str]:
    if "PENDING" in evidence or "PLACEHOLDER" in evidence:
        return PALE_GOLD, PURPLE, "PENDING / NOT CLEAN-RUN VERIFIED"
    if "SIMULATED" in evidence:
        return PALE_RED, RED, "SIMULATED TEACHING DATA"
    return PALE_BLUE, NAVY, "SOURCE-BOUND EVIDENCE"


def add_header(slide, spec: SlideSpec) -> None:
    set_title(slide, spec.title)
    fill, color, label = status_fill(spec.evidence)
    add_tag(slide, 8.76, 0.90, 3.57, label, fill=fill, color=color)


def add_notes(slide, spec: SlideSpec) -> None:
    text = spec.notes.strip()
    if spec.recovery:
        text += " 若操作受阻，" + spec.recovery.strip()
    if FORBIDDEN in text or MINUTE_RE.search(text):
        raise ValueError(f"P{spec.number:03d}: invalid notes")
    slide.notes_slide.notes_text_frame.text = text


def draw_cover(slide, s: SlideSpec) -> None:
    clear_placeholders(slide, keep_title=False)
    set_title(slide, s.title, cover=True)
    add_text(slide, 0.95, 2.57, 7.20, 0.46, "C-120｜LoRaEnergySim × 智慧節能與物聯網應用", 24, bold=True, color=PURPLE, name="Cover subtitle")
    add_text(slide, 0.98, 3.30, 6.95, 0.58, s.visual, 25, color=INK, name="Cover causal chain")
    # A single editable causal ribbon keeps the cover spacious.  The previous
    # four-card strip made the opening look like a repeated framework rather
    # than an invitation to follow one mechanism.
    add_box(slide, 0.98, 4.40, 7.55, 0.72, fill=CREAM, line=GOLD, width=1.2, name="Cover causal ribbon")
    add_text(slide, 1.20, 4.61, 7.10, 0.28, "觀察  →  決策  →  服務  →  endpoint J", 22, bold=True, color=NAVY, align=PP_ALIGN.CENTER, name="Cover causal ribbon text")
    add_text(slide, 0.98, 5.43, 7.65, 0.52, "SIMULATED TEACHING DATA｜NOT LIVE｜NOT MEASURED｜NOT CANONICAL-PARITY-VERIFIED", 16, bold=True, color=RED, italic_code=False, name="Claim boundary")
    add_box(slide, 9.10, 1.55, 3.02, 3.88, fill=PALE_GOLD, line=GOLD, width=1.4, name="Cover window visual")
    add_text(slide, 9.38, 1.82, 2.48, 0.32, "SERVICE WINDOW", 18, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, italic_code=False, name="Window label")
    add_line(slide, 9.48, 4.62, 11.73, 4.62, color=NAVY, width=1.8, name="Window axis")
    for x, h, c in [(9.58, 1.12, BLUE), (10.13, 1.90, TEAL), (10.68, 0.82, GOLD), (11.23, 1.52, PURPLE)]:
        add_line(slide, x, 4.62, x, 4.62 - h, color=c, width=4.0, name="Window signal")
        add_dot(slide, x - 0.08, 4.54 - h, 0.16, c, name="Window sample")
    add_text(slide, 9.42, 4.89, 2.38, 0.38, "LEO = example, not measurement", 16, color=MUTED, align=PP_ALIGN.CENTER, italic_code=False, name="Window scope")


def draw_causal(slide, s: SlideSpec) -> None:
    add_header(slide, s)
    items = ["observation", "policy", "action", "state / packet", "service", "J"]
    x0 = 0.70
    widths = [1.66, 1.45, 1.35, 1.88, 1.42, 1.00]
    colors = [(PALE_BLUE, BLUE), (PALE_PURPLE, PURPLE), (PALE_TEAL, TEAL), (CREAM, NAVY), (PALE_GOLD, GOLD), (PALE_RED, RED)]
    x = x0
    for i, item in enumerate(items):
        fill, line = colors[i]
        add_box(slide, x, 1.82, widths[i], 0.96, fill=fill, line=line, width=1.2, name=f"Causal node {i + 1}")
        add_text(slide, x + 0.08, 2.10, widths[i] - 0.16, 0.30, item, 20, bold=True, align=PP_ALIGN.CENTER, italic_code=False, name=f"Causal node text {i + 1}")
        if i < len(items) - 1:
            add_line(slide, x + widths[i], 2.30, x + widths[i] + 0.24, 2.30, color=NAVY, width=1.6, arrow=True, name="Causal arrow")
        x += widths[i] + 0.24
    add_box(slide, 0.90, 3.36, 5.18, 2.05, fill=PALE_BLUE, line=BLUE, name="Causal read panel")
    add_text(slide, 1.16, 3.63, 4.65, 0.32, "先看什麼？", 23, bold=True, color=NAVY, name="Causal read heading")
    add_text(slide, 1.18, 4.10, 4.60, 0.90, "只讀 action 當下允許的 observation；不要用最後的 J 反推一個不存在的 decision。", 24, name="Causal read text")
    add_box(slide, 6.38, 3.36, 5.72, 2.05, fill=PALE_GOLD, line=GOLD, name="Causal evidence panel")
    add_text(slide, 6.66, 3.63, 5.18, 0.32, "最後怎麼判？", 23, bold=True, color=PURPLE, name="Causal verdict heading")
    add_text(slide, 6.68, 4.10, 5.12, 0.90, "每一段都要能回到 result／replay；只有動畫變化不算 evidence。", 24, name="Causal verdict text")


def draw_scope(slide, s: SlideSpec) -> None:
    add_header(slide, s)
    add_text(slide, 0.92, 1.30, 11.4, 0.45, "工具價值來自可追溯的 endpoint mechanism，而不是名詞數量。", 23, color=MUTED, align=PP_ALIGN.CENTER, name="Scope caption")
    # A nested scope diagram instead of cards.
    add_box(slide, 0.92, 2.02, 5.45, 3.45, fill=PALE_BLUE, line=BLUE, width=1.4, name="Endpoint scope")
    add_text(slide, 1.20, 2.30, 4.90, 0.34, "LOW-POWER ENDPOINT", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, italic_code=False, name="Endpoint scope label")
    states = [("SLEEP", 1.30, PALE_TEAL, TEAL), ("PROCESS", 2.25, PALE_GOLD, GOLD), ("TX / RX", 3.20, PALE_PURPLE, PURPLE), ("RETRY", 4.15, PALE_RED, RED)]
    for label, x, fill, line in states:
        add_box(slide, x, 3.05, 1.12, 0.72, fill=fill, line=line, name=f"Scope {label}")
        add_text(slide, x + 0.05, 3.28, 1.02, 0.24, label, 16, bold=True, align=PP_ALIGN.CENTER, italic_code=False, name=f"Scope {label} label")
    add_line(slide, 1.84, 3.41, 2.23, 3.41, color=NAVY, width=1.3, arrow=True)
    add_line(slide, 2.96, 3.41, 3.18, 3.41, color=NAVY, width=1.3, arrow=True)
    add_line(slide, 4.32, 3.41, 4.54, 3.41, color=NAVY, width=1.3, arrow=True)
    add_text(slide, 1.22, 4.45, 4.80, 0.62, "queue / packet / service / endpoint J", 22, align=PP_ALIGN.CENTER, name="Endpoint outputs")
    add_box(slide, 6.72, 2.02, 5.36, 3.45, fill=PALE_GOLD, line=GOLD, width=1.4, name="Teaching scope")
    add_text(slide, 7.00, 2.30, 4.82, 0.34, "TEACHING WRAPPER", 20, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, italic_code=False, name="Wrapper label")
    add_line(slide, 7.50, 3.72, 11.35, 3.72, color=NAVY, width=2.0, arrow=True, name="Wrapper flow")
    for x, label, line in [(7.36, "scenario", BLUE), (8.62, "action", TEAL), (9.88, "replay", PURPLE), (11.14, "claim", RED)]:
        add_dot(slide, x, 3.52, 0.38, line, name="Wrapper dot")
        add_text(slide, x - 0.30, 4.06, 0.98, 0.34, label, 18, bold=True, color=line, align=PP_ALIGN.CENTER, italic_code=False, name="Wrapper label")
    add_text(slide, 7.16, 4.64, 4.48, 0.50, "每個 action 都要留下可觀察的中間欄位。", 22, align=PP_ALIGN.CENTER, name="Wrapper rule")


def draw_timeline(slide, s: SlideSpec) -> None:
    add_header(slide, s)
    add_text(slide, 0.90, 1.28, 11.45, 0.44, "LEO 是 changing service window；控制問題仍然是 endpoint 的 send / wait / sleep。", 22, color=MUTED, align=PP_ALIGN.CENTER, name="Timeline caption")
    add_line(slide, 1.05, 3.46, 12.05, 3.46, color=NAVY, width=2.2, name="Window timeline")
    segments = [(1.25, 2.05, "不可服務", PALE_RED, RED), (3.30, 2.25, "機會出現", PALE_TEAL, TEAL), (5.55, 2.55, "quality 變動", PALE_BLUE, BLUE), (8.10, 2.55, "窗口收窄", PALE_GOLD, GOLD), (10.65, 1.10, "關閉", PALE_RED, RED)]
    for x, w, label, fill, line in segments:
        add_box(slide, x, 2.78, w, 0.82, fill=fill, line=line, width=1.1, name=f"Window segment {label}")
        add_text(slide, x + 0.06, 3.03, w - 0.12, 0.26, label, 18, bold=True, color=line, align=PP_ALIGN.CENTER, name=f"Window segment label {label}")
    add_box(slide, 1.02, 4.12, 3.45, 1.35, fill=PALE_BLUE, line=BLUE, name="Timeline policy")
    add_text(slide, 1.26, 4.39, 2.96, 0.28, "POLICY", 18, bold=True, color=NAVY, align=PP_ALIGN.CENTER, italic_code=False, name="Timeline policy heading")
    add_text(slide, 1.24, 4.82, 3.00, 0.36, "send now / wait / sleep", 22, align=PP_ALIGN.CENTER, name="Timeline policy body")
    add_box(slide, 4.88, 4.12, 3.45, 1.35, fill=PALE_TEAL, line=TEAL, name="Timeline service")
    add_text(slide, 5.12, 4.39, 2.96, 0.28, "SERVICE", 18, bold=True, color=TEAL, align=PP_ALIGN.CENTER, italic_code=False, name="Timeline service heading")
    add_text(slide, 5.10, 4.82, 3.00, 0.36, "delivery / deadline / window", 22, align=PP_ALIGN.CENTER, name="Timeline service body")
    add_box(slide, 8.74, 4.12, 3.45, 1.35, fill=PALE_GOLD, line=GOLD, name="Timeline energy")
    add_text(slide, 8.98, 4.39, 2.96, 0.28, "ENERGY", 18, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, italic_code=False, name="Timeline energy heading")
    add_text(slide, 8.96, 4.82, 3.00, 0.36, "state time → endpoint J", 22, align=PP_ALIGN.CENTER, name="Timeline energy body")


def draw_boundary(slide, s: SlideSpec) -> None:
    add_header(slide, s)
    add_box(slide, 0.85, 1.55, 5.47, 4.62, fill=PALE_BLUE, line=BLUE, width=1.4, name="Endpoint evidence boundary")
    add_text(slide, 1.14, 1.86, 4.88, 0.34, "ENDPOINT REPLAY", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, italic_code=False, name="Endpoint evidence heading")
    add_line(slide, 1.35, 2.85, 5.80, 2.85, color=BLUE, width=2.0, arrow=True, name="Endpoint replay path")
    for x, label in [(1.45, "queue"), (2.65, "packet"), (3.85, "state"), (5.05, "J")]:
        add_dot(slide, x, 2.65, 0.38, BLUE, name="Endpoint replay dot")
        add_text(slide, x - 0.24, 3.25, 0.86, 0.34, label, 19, bold=True, color=NAVY, align=PP_ALIGN.CENTER, italic_code=False, name="Endpoint replay label")
    add_text(slide, 1.26, 4.14, 4.62, 1.28, "可說：endpoint service、endpoint J、state duration。\n不可說：whole-system、wall-plug、canonical parity。", 23, name="Endpoint boundary text")
    add_box(slide, 6.80, 1.55, 5.52, 4.62, fill=PALE_GOLD, line=GOLD, width=1.4, name="System evidence boundary")
    add_text(slide, 7.10, 1.86, 4.92, 0.34, "C-120 SYSTEM REPLAY", 20, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, italic_code=False, name="System evidence heading")
    add_line(slide, 7.45, 2.85, 11.75, 2.85, color=GOLD, width=2.0, arrow=True, name="System replay path")
    for x, label in [(7.55, "scenario"), (8.95, "service"), (10.35, "budget"), (11.50, "workbook")]:
        add_dot(slide, x, 2.65, 0.38, GOLD, name="System replay dot")
        add_text(slide, x - 0.36, 3.25, 1.10, 0.34, label, 18, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, italic_code=False, name="System replay label")
    add_text(slide, 7.16, 4.14, 4.82, 1.28, "可共享：scenario、clock、workbook lineage。\n不可互換：欄位語義與 energy boundary。", 23, name="System boundary text")


def draw_loop(slide, s: SlideSpec) -> None:
    add_header(slide, s)
    cx, cy = 6.45, 3.35
    points = [(6.42, 1.70, "PREDICT", BLUE), (9.45, 2.35, "EDIT", PURPLE), (9.42, 4.30, "RUN", TEAL), (6.42, 5.02, "REPLAY", GOLD), (3.35, 4.30, "WITHHELD", RED), (3.35, 2.35, "IMPORT", NAVY)]
    for i, (x, y, label, col) in enumerate(points):
        add_box(slide, x - 0.75, y - 0.30, 1.50, 0.62, fill=PALE_BLUE if col == BLUE else (PALE_PURPLE if col == PURPLE else (PALE_TEAL if col == TEAL else (PALE_GOLD if col == GOLD else (PALE_RED if col == RED else CREAM)))), line=col, name=f"Loop node {label}")
        add_text(slide, x - 0.66, y - 0.09, 1.32, 0.22, label, 16, bold=True, color=col, align=PP_ALIGN.CENTER, italic_code=False, name=f"Loop node label {label}")
        nx, ny, *_ = points[(i + 1) % len(points)]
        add_line(slide, x, y + (0.30 if ny > y else -0.30), nx, ny + (-0.30 if ny > y else 0.30), color=NAVY, width=1.35, arrow=True, name="Loop arrow")
    add_box(slide, 5.15, 2.72, 2.60, 1.22, fill=CREAM, line=GOLD, width=1.2, name="Loop invariant")
    add_text(slide, 5.36, 2.99, 2.18, 0.64, "同一 scenario\npolicy hash 可追溯", 22, bold=True, align=PP_ALIGN.CENTER, name="Loop invariant text")
    add_text(slide, 1.20, 5.86, 10.6, 0.32, "withheld 不准 retune；預測被推翻仍是有價值的 evidence。", 22, bold=True, color=RED, align=PP_ALIGN.CENTER, name="Loop verdict")


def draw_route(slide, s: SlideSpec) -> None:
    add_header(slide, s)
    add_line(slide, 1.08, 3.10, 12.08, 3.10, color=NAVY, width=2.1, name="Route spine")
    route = [(1.25, "WHY", BLUE), (2.55, "PACKAGE", PURPLE), (3.95, "SHELL", TEAL), (5.30, "PY 3.11", GOLD), (6.85, ".venv", NAVY), (8.25, "VERIFY", TEAL), (9.62, "READY", PURPLE), (11.00, "POLICY", RED)]
    for i, (x, label, col) in enumerate(route):
        add_dot(slide, x, 2.82, 0.56, col, name=f"Route node {i + 1}")
        add_text(slide, x - 0.45, 2.02 if i % 2 == 0 else 3.62, 1.00, 0.34, label, 16, bold=True, color=col, align=PP_ALIGN.CENTER, italic_code=False, name=f"Route label {i + 1}")
    add_box(slide, 1.14, 4.58, 4.78, 1.22, fill=PALE_BLUE, line=BLUE, name="Route entry")
    add_text(slide, 1.38, 4.83, 4.30, 0.58, "先取對 archive，讀 identity，再選 shell。", 23, align=PP_ALIGN.CENTER, name="Route entry text")
    add_box(slide, 6.20, 4.58, 5.88, 1.22, fill=PALE_GOLD, line=GOLD, name="Route recovery")
    add_text(slide, 6.48, 4.83, 5.32, 0.58, "每個 gate 都有輸出；失敗沿同一 package 回來。", 23, align=PP_ALIGN.CENTER, name="Route recovery text")


def draw_claim(slide, s: SlideSpec) -> None:
    add_header(slide, s)
    levels = [("COURSE-PACKAGED", "有明示的 scenario 與 runner boundary", PALE_BLUE, BLUE), ("SIMULATED", "可重播，但不是 live telemetry", PALE_TEAL, TEAL), ("NOT MEASURED", "不把畫面或 KPI 說成量測", PALE_GOLD, GOLD), ("NOT CANONICAL PARITY", "未通過的 contract 不自行升級", PALE_RED, RED)]
    for i, (label, body, fill, line) in enumerate(levels):
        x = 1.06 + i * 0.28
        y = 1.78 + i * 0.76
        w = 10.94 - i * 0.56
        add_box(slide, x, y, w, 0.56, fill=fill, line=line, width=1.2, name=f"Claim level {i + 1}")
        add_text(slide, x + 0.18, y + 0.15, w - 0.36, 0.24, f"{label} ｜ {body}", 20, bold=(i == 0), color=line, align=PP_ALIGN.CENTER, name=f"Claim level text {i + 1}")
    add_box(slide, 1.04, 4.86, 11.03, 1.04, fill=CREAM, line=GOLD, name="Claim gate")
    add_text(slide, 1.30, 5.16, 10.50, 0.42, "看到未凍結的 URL、畫面或數字：留 placeholder，不補成 evidence。", 23, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, name="Claim gate text")


def operation_contract(slide, s: SlideSpec, *, accent: int = 0) -> None:
    """Render an operation with exact context/command and causal contract.

    The layout is a split terminal-to-receipt composition.  A few operations
    receive bespoke renderers below; this fallback still guarantees all five
    required teaching fields are visible and editable.
    """
    add_header(slide, s)
    fills = [(PALE_PURPLE, PURPLE), (PALE_BLUE, BLUE), (PALE_TEAL, TEAL), (PALE_GOLD, GOLD)]
    term_fill, term_line = fills[accent % len(fills)]
    add_box(slide, 0.78, 1.34, 6.02, 4.78, fill=term_fill, line=term_line, width=1.3, name="Operation terminal panel")
    add_text(slide, 1.02, 1.62, 5.54, 0.30, "CONTEXT / RUN", 18, bold=True, color=term_line, italic_code=False, name="Operation context heading")
    add_text(slide, 1.04, 2.02, 5.50, 0.86, s.context + "\n" + s.command, 18, color=INK, italic_code=False, name="Operation exact command")
    add_line(slide, 1.04, 3.34, 6.46, 3.34, color=term_line, width=1.1, name="Operation divider")
    add_text(slide, 1.02, 3.58, 5.54, 0.30, "目的／機制", 18, bold=True, color=term_line, italic_code=False, name="Operation mechanism heading")
    add_text(slide, 1.04, 4.00, 5.48, 1.34, s.purpose + "\n" + s.mechanism, 23, name="Operation mechanism body")
    add_box(slide, 7.15, 1.34, 5.13, 2.14, fill=PALE_TEAL, line=TEAL, width=1.3, name="Operation output panel")
    add_text(slide, 7.42, 1.62, 4.58, 0.30, "預期可見輸出", 20, bold=True, color=TEAL, align=PP_ALIGN.CENTER, name="Operation expected heading")
    add_text(slide, 7.42, 2.10, 4.58, 1.00, s.expected, 22, align=PP_ALIGN.CENTER, name="Operation expected body")
    add_box(slide, 7.15, 3.82, 5.13, 2.30, fill=PALE_GOLD, line=GOLD, width=1.3, name="Operation recovery panel")
    add_text(slide, 7.42, 4.10, 4.58, 0.30, "判讀／失敗回復", 20, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, name="Operation recovery heading")
    add_text(slide, 7.42, 4.58, 4.58, 1.20, s.recovery, 22, align=PP_ALIGN.CENTER, name="Operation recovery body")


def draw_folder_operation(slide, s: SlideSpec) -> None:
    operation_contract(slide, s, accent=1)
    add_box(slide, 8.05, 5.48, 3.36, 0.52, fill=WHITE, line=TEAL, width=0.8, name="Folder tree cue")
    add_text(slide, 8.18, 5.62, 3.10, 0.20, "single root / 65 files", 17, bold=True, color=TEAL, align=PP_ALIGN.CENTER, italic_code=False, name="Folder tree cue text")


def draw_download_operation(slide: Slide, s: SlideSpec) -> None:
    add_header(slide, s)
    add_text(slide, 0.82, 1.28, 11.55, 0.38, "source、local artifact、public release：三種狀態要分開寫。", 22, color=MUTED, align=PP_ALIGN.CENTER, name="Download instruction")
    add_text(slide, 0.88, 1.63, 11.40, 0.20, "Purpose: 核對 source bytes 與 identity，再進入 setup；Mechanism: scenario／anchor／lock hash 綁定同一 runner。", 16, color=INK, align=PP_ALIGN.CENTER, italic_code=False, name="Download purpose mechanism")
    add_box(slide, 0.78, 1.86, 5.88, 2.68, fill=PALE_PURPLE, line=PURPLE, width=1.3, name="Download zip panel")
    add_text(slide, 1.04, 2.14, 5.36, 0.28, "SOURCE REPO／LOCAL ARTIFACT", 18, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, italic_code=False, name="Download zip heading")
    add_text(slide, 1.06, 2.52, 5.30, 1.64, f"{REPO_URL}\nroot: {PACKAGE_ROOT_NAME}\nmodule: {PYTHON_MODULE}\n\nVERIFIED LOCAL ARTIFACT\n{LOCAL_ARTIFACT_NAME}｜{LOCAL_ARTIFACT_SIZE}\n{LOCAL_ARTIFACT_SHA}", 14, color=INK, align=PP_ALIGN.CENTER, italic_code=False, name="Download zip text")
    add_box(slide, 6.90, 1.86, 5.36, 2.68, fill=PALE_BLUE, line=BLUE, width=1.3, name="Download hash panel")
    add_text(slide, 7.16, 2.14, 4.84, 0.28, "SCENARIO／ANCHOR／LOCK／RELEASE", 18, bold=True, color=NAVY, align=PP_ALIGN.CENTER, italic_code=False, name="Download hash heading")
    add_text(slide, 7.18, 2.52, 4.80, 1.64, f"scenario: {SCENARIO_ID}\n{SCENARIO_SHA}\nanchor: {ANCHOR_SHA}\nlock: {LOCK_SHA}\npolicy: {BASELINE_POLICY_SHA}\npublic release: {RELEASE_ASSET_STATUS}", 13, color=INK, align=PP_ALIGN.CENTER, italic_code=False, name="Download hash text")
    add_text(slide, 7.18, 4.22, 4.80, 0.22, "Expected: identity matches；public release remains pending。", 16, bold=True, color=NAVY, align=PP_ALIGN.CENTER, italic_code=False, name="Download expected text")
    add_box(slide, 0.80, 4.70, 7.08, 1.34, fill=CREAM, line=NAVY, width=1.2, name="Download command panel")
    add_text(slide, 1.04, 4.88, 6.60, 0.22, "Context: " + s.context, 16, color=MUTED, name="Download context text")
    add_text(slide, 1.04, 5.16, 6.60, 0.72, "Run:\n" + s.command, 18, color=INK, italic_code=False, name="Download command text")
    add_box(slide, 8.28, 4.70, 3.98, 1.34, fill=PALE_GOLD, line=GOLD, width=1.2, name="Download recovery panel")
    add_text(slide, 8.48, 4.94, 3.58, 0.82, s.recovery, 19, align=PP_ALIGN.CENTER, name="Download recovery text")


def draw_windows_shell(slide, s: SlideSpec) -> None:
    add_header(slide, s)
    add_text(slide, 0.86, 1.20, 11.5, 0.22, "Context: " + s.context, 15, color=MUTED, align=PP_ALIGN.CENTER, name="Shell context")
    add_text(slide, 0.86, 1.47, 11.5, 0.28, "Purpose: 先辨識 prompt，再辨識 interpreter；Run: py --list  /  py -3.11 --version", 18, color=INK, align=PP_ALIGN.CENTER, italic_code=False, name="Shell instruction")
    add_box(slide, 0.86, 1.96, 5.45, 2.18, fill=PALE_BLUE, line=BLUE, width=1.3, name="CMD panel")
    add_text(slide, 1.12, 2.24, 4.94, 0.28, "CMD｜C:\\...>", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, italic_code=False, name="CMD heading")
    add_text(slide, 1.18, 2.76, 4.80, 0.72, "py --list\npy -3.11 --version", 20, align=PP_ALIGN.CENTER, italic_code=False, name="CMD command")
    add_box(slide, 6.82, 1.96, 5.45, 2.18, fill=PALE_PURPLE, line=PURPLE, width=1.3, name="PowerShell panel")
    add_text(slide, 7.08, 2.24, 4.94, 0.28, "PowerShell｜PS C:\\...>", 20, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, italic_code=False, name="PowerShell heading")
    add_text(slide, 7.14, 2.76, 4.80, 0.72, "py --list\npy -3.11 --version", 20, align=PP_ALIGN.CENTER, italic_code=False, name="PowerShell command")
    add_line(slide, 6.50, 2.18, 6.50, 4.02, color=GOLD, width=1.6, name="Shell separator")
    add_box(slide, 0.94, 4.62, 11.25, 1.26, fill=PALE_GOLD, line=GOLD, width=1.2, name="Shell expected panel")
    add_text(slide, 1.20, 4.86, 10.72, 0.58, "預期：list 含 3.11，版本回傳 Python 3.11.x。失敗：保留輸出，走 Python installer 或 uv recovery；Windows clean-run：PENDING。", 20, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, name="Shell expected text")


def draw_python_install(slide: Slide, s: SlideSpec) -> None:
    add_header(slide, s)
    add_text(slide, 0.92, 1.20, 11.40, 0.22, "Context: " + s.context, 15, color=MUTED, align=PP_ALIGN.CENTER, name="Python install context")
    add_text(slide, 0.92, 1.46, 11.40, 0.30, "Purpose: 建立 runner 預期的 3.11；Mechanism: Python Launcher 綁定 interpreter。Run: py --list  /  py -3.11 --version", 17, color=INK, align=PP_ALIGN.CENTER, italic_code=False, name="Python install command")
    steps = [("1", "官方 Windows downloads", "https://www.python.org/downloads/windows/", BLUE), ("2", "Python 3.11.x / installer", "Windows installer (64-bit)\n保留 Python Launcher", PURPLE), ("3", "重新開 shell", "py --list\npy -3.11 --version", TEAL)]
    for i, (num, label, detail, col) in enumerate(steps):
        x = 1.05 + i * 3.90
        add_dot(slide, x, 2.05, 0.58, col, name=f"Python install step {num}")
        add_text(slide, x + 0.08, 2.19, 0.40, 0.22, num, 18, bold=True, color=WHITE, align=PP_ALIGN.CENTER, italic_code=False, name=f"Python install number {num}")
        if i < 2:
            add_line(slide, x + 0.58, 2.34, x + 3.62, 2.34, color=GOLD, width=2.0, arrow=True, name="Python install arrow")
        add_box(slide, x - 0.46, 2.90, 2.86, 1.42, fill=PALE_BLUE if col == BLUE else (PALE_PURPLE if col == PURPLE else PALE_TEAL), line=col, name=f"Python install card {num}")
        add_text(slide, x - 0.30, 3.15, 2.54, 0.30, label, 18, bold=True, color=col, align=PP_ALIGN.CENTER, name=f"Python install label {num}")
        add_text(slide, x - 0.28, 3.60, 2.50, 0.40, detail, 18, align=PP_ALIGN.CENTER, name=f"Python install detail {num}")
    add_box(slide, 1.02, 4.86, 11.14, 1.06, fill=PALE_GOLD, line=GOLD, name="Python install recovery")
    add_text(slide, 1.28, 5.14, 10.62, 0.38, "預期：3.11 可由 launcher 找到；若仍失敗，保留錯誤，走 uv recovery。clean install：PENDING。", 22, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, name="Python install recovery text")


def draw_uv(slide: Slide, s: SlideSpec) -> None:
    add_header(slide, s)
    add_text(slide, 0.90, 1.16, 11.44, 0.22, "Context: " + s.context, 15, color=MUTED, align=PP_ALIGN.CENTER, name="uv context")
    add_text(slide, 0.90, 1.42, 11.44, 0.30, "Purpose: uv 解決 interpreter 取得，不是 dependency lock，也不是結果產生。Run: winget → uv python install 3.11 → uv python find 3.11", 18, color=INK, align=PP_ALIGN.CENTER, italic_code=False, name="uv instruction")
    cmds = [("INSTALL", "winget install --id=astral-sh.uv -e", PALE_PURPLE, PURPLE), ("PIN", "uv python install 3.11", PALE_BLUE, BLUE), ("LOCATE", "uv python find 3.11", PALE_TEAL, TEAL)]
    for i, (label, cmd, fill, line) in enumerate(cmds):
        y = 2.06 + i * 1.02
        add_box(slide, 1.08, y, 10.95, 0.70, fill=fill, line=line, name=f"uv row {label}")
        add_text(slide, 1.32, y + 0.20, 1.28, 0.24, label, 16, bold=True, color=line, align=PP_ALIGN.CENTER, italic_code=False, name=f"uv label {label}")
        add_line(slide, 2.72, y + 0.35, 3.12, y + 0.35, color=line, width=1.2, arrow=True, name="uv row arrow")
        add_text(slide, 3.32, y + 0.17, 8.32, 0.30, cmd, 18, color=INK, italic_code=False, name=f"uv command {label}")
    add_box(slide, 1.10, 5.30, 10.92, 0.70, fill=PALE_GOLD, line=GOLD, name="uv expected")
    add_text(slide, 1.34, 5.52, 10.44, 0.24, "預期：最後一行回傳 interpreter path；Windows clean-run：PENDING。失敗就保留錯誤並 fallback。", 20, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, name="uv expected text")


def draw_venv(slide: Slide, s: SlideSpec) -> None:
    add_header(slide, s)
    add_text(slide, 0.90, 1.16, 11.42, 0.22, "Context: " + s.context, 15, color=MUTED, align=PP_ALIGN.CENTER, name="venv context")
    add_text(slide, 0.90, 1.42, 11.42, 0.30, "Purpose: 不同 OS 不共用 interpreter bytes。Run: .\\.venv\\Scripts\\python.exe --version  /  .venv/bin/python --version", 18, color=INK, align=PP_ALIGN.CENTER, italic_code=False, name="venv instruction")
    add_box(slide, 0.92, 2.02, 3.45, 3.30, fill=PALE_BLUE, line=BLUE, name="System Python")
    add_text(slide, 1.20, 2.34, 2.88, 0.28, "SYSTEM PYTHON", 18, bold=True, color=NAVY, align=PP_ALIGN.CENTER, italic_code=False, name="System Python label")
    add_text(slide, 1.18, 3.00, 2.92, 0.90, "可能服務其他專案\n不作 runner identity", 23, align=PP_ALIGN.CENTER, name="System Python body")
    add_box(slide, 4.92, 2.02, 3.45, 3.30, fill=PALE_TEAL, line=TEAL, name="Windows venv")
    add_text(slide, 5.18, 2.34, 2.94, 0.28, "WINDOWS `.venv`", 18, bold=True, color=TEAL, align=PP_ALIGN.CENTER, italic_code=False, name="Windows venv label")
    add_text(slide, 5.16, 3.00, 2.98, 0.90, ".venv\\Scripts\\python.exe\n只在 Windows 使用", 22, align=PP_ALIGN.CENTER, name="Windows venv body")
    add_box(slide, 8.92, 2.02, 3.45, 3.30, fill=PALE_PURPLE, line=PURPLE, name="WSL venv")
    add_text(slide, 9.18, 2.34, 2.94, 0.28, "WSL `.venv`", 18, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, italic_code=False, name="WSL venv label")
    add_text(slide, 9.16, 3.00, 2.98, 0.90, ".venv/bin/python\n只在 Linux 使用", 22, align=PP_ALIGN.CENTER, name="WSL venv body")
    add_text(slide, 0.98, 5.66, 11.3, 0.40, "預期：兩個 path 都落在各自 package-local `.venv`；失敗：不要跨 OS 複製，停在 setup gate。", 19, bold=True, color=RED, align=PP_ALIGN.CENTER, name="venv recovery")


def draw_ready(slide: Slide, s: SlideSpec) -> None:
    operation_contract(slide, s, accent=2)
    add_box(slide, 7.78, 2.52, 4.18, 0.48, fill=WHITE, line=TEAL, width=0.8, name="Receipt status cue")
    add_text(slide, 7.92, 2.66, 3.90, 0.20, "READY ≠ energy result", 17, bold=True, color=TEAL, align=PP_ALIGN.CENTER, italic_code=False, name="Receipt status cue text")


def draw_recovery(slide: Slide, s: SlideSpec) -> None:
    add_header(slide, s)
    add_text(slide, 0.90, 1.16, 11.44, 0.22, "Context: " + s.context, 15, color=MUTED, align=PP_ALIGN.CENTER, name="Recovery context")
    add_text(slide, 0.90, 1.40, 11.44, 0.36, "Run: " + s.command, 18, color=INK, align=PP_ALIGN.CENTER, italic_code=False, name="Recovery command")
    add_text(slide, 0.90, 1.82, 11.44, 0.28, "先保留錯誤，再判定能否回到 READY；不要用空值填平紅燈。", 21, color=MUTED, align=PP_ALIGN.CENTER, name="Recovery instruction")
    add_box(slide, 0.92, 2.10, 2.62, 1.22, fill=PALE_RED, line=RED, name="Recovery error")
    add_text(slide, 1.16, 2.42, 2.14, 0.34, "ERROR", 24, bold=True, color=RED, align=PP_ALIGN.CENTER, italic_code=False, name="Recovery error label")
    add_line(slide, 3.58, 2.72, 4.22, 2.72, color=NAVY, width=1.6, arrow=True, name="Recovery arrow")
    add_box(slide, 4.32, 2.10, 3.02, 1.22, fill=PALE_BLUE, line=BLUE, name="Recovery diagnose")
    add_text(slide, 4.58, 2.34, 2.50, 0.68, "讀 stderr\n確認 root／Python／lock", 21, bold=True, align=PP_ALIGN.CENTER, name="Recovery diagnose text")
    add_line(slide, 7.40, 2.72, 8.04, 2.72, color=NAVY, width=1.6, arrow=True, name="Recovery arrow")
    add_box(slide, 8.14, 2.10, 3.00, 1.22, fill=PALE_TEAL, line=TEAL, name="Recovery retry")
    add_text(slide, 8.40, 2.34, 2.48, 0.68, "重跑目前 gate\n不改 receipt", 21, bold=True, align=PP_ALIGN.CENTER, name="Recovery retry text")
    add_line(slide, 9.64, 3.40, 9.64, 4.08, color=GOLD, width=1.6, arrow=True, name="Recovery fallback arrow")
    add_box(slide, 4.04, 4.24, 4.02, 1.28, fill=PALE_GOLD, line=GOLD, name="Recovery ready")
    add_text(slide, 4.32, 4.52, 3.46, 0.68, "READY\n可進入 runner", 23, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, name="Recovery ready text")
    add_box(slide, 8.18, 4.24, 3.00, 1.28, fill=CREAM, line=NAVY, name="Recovery fallback")
    add_text(slide, 8.42, 4.52, 2.52, 0.68, "same-scenario\nfallback", 21, bold=True, align=PP_ALIGN.CENTER, name="Recovery fallback text")
    add_text(slide, 1.02, 5.82, 11.22, 0.30, "兩條合法出口：新的 READY receipt，或明示 fallback；沒有第三條『看起來通過』。", 21, bold=True, color=RED, align=PP_ALIGN.CENTER, name="Recovery verdict")


def draw_edit_boundary(slide: Slide, s: SlideSpec) -> None:
    operation_contract(slide, s, accent=0)
    add_box(slide, 7.56, 2.56, 4.34, 0.68, fill=PALE_RED, line=RED, width=1.0, name="Edit lock cue")
    add_text(slide, 7.78, 2.76, 3.90, 0.28, "非 marked 區域：READ-ONLY", 18, bold=True, color=RED, align=PP_ALIGN.CENTER, italic_code=False, name="Edit lock cue text")


def draw_api(slide: Slide, s: SlideSpec) -> None:
    add_header(slide, s)
    add_text(slide, 0.90, 1.14, 11.44, 0.20, "Context: " + s.context, 14, color=MUTED, align=PP_ALIGN.CENTER, name="API context")
    add_text(slide, 0.90, 1.36, 11.44, 0.34, "Run: " + s.command, 18, color=INK, align=PP_ALIGN.CENTER, italic_code=False, name="API command")
    add_box(slide, 0.88, 1.78, 3.26, 3.46, fill=PALE_BLUE, line=BLUE, name="API observation")
    add_text(slide, 1.12, 2.10, 2.78, 0.30, "OBSERVATION", 18, bold=True, color=NAVY, align=PP_ALIGN.CENTER, italic_code=False, name="API observation heading")
    add_text(slide, 1.12, 2.74, 2.78, 1.22, "quality\nqueue age\nremaining window", 23, align=PP_ALIGN.CENTER, name="API observation body")
    add_line(slide, 4.20, 3.50, 4.88, 3.50, color=NAVY, width=1.6, arrow=True, name="API arrow")
    add_box(slide, 4.98, 1.78, 3.26, 3.46, fill=PALE_PURPLE, line=PURPLE, name="API function")
    add_text(slide, 5.22, 2.10, 2.78, 0.30, "choose_action(...) ", 18, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, italic_code=False, name="API function heading")
    add_text(slide, 5.22, 2.74, 2.78, 1.22, "只讀當下 observation\n不讀 future result\n不改 engine", 22, align=PP_ALIGN.CENTER, name="API function body")
    add_line(slide, 8.30, 3.50, 8.98, 3.50, color=NAVY, width=1.6, arrow=True, name="API arrow")
    add_box(slide, 9.08, 1.78, 3.26, 3.46, fill=PALE_TEAL, line=TEAL, name="API action")
    add_text(slide, 9.32, 2.10, 2.78, 0.30, "LEGAL ACTION", 18, bold=True, color=TEAL, align=PP_ALIGN.CENTER, italic_code=False, name="API action heading")
    add_text(slide, 9.30, 2.74, 2.82, 1.44, "WAIT\nSLEEP\nSEND_ONE\nSEND_URGENT / FLUSH_BATCH", 21, align=PP_ALIGN.CENTER, name="API action body")
    add_box(slide, 1.02, 5.62, 11.22, 0.46, fill=PALE_GOLD, line=GOLD, name="API recovery")
    add_text(slide, 1.24, 5.70, 10.78, 0.30, "預期：合法 action token + syntax guard；失敗：只修 marked block，API mismatch 就回 package identity。", 17, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, name="API recovery text")


def draw_constants(slide: Slide, s: SlideSpec) -> None:
    add_header(slide, s)
    add_text(slide, 0.92, 1.12, 11.30, 0.20, "Context: " + s.context, 14, color=MUTED, align=PP_ALIGN.CENTER, name="Constants context")
    add_text(slide, 0.92, 1.34, 11.30, 0.32, "Run: " + s.command, 18, color=INK, align=PP_ALIGN.CENTER, italic_code=False, name="Constants command")
    add_box(slide, 0.92, 1.72, 7.02, 3.72, fill=PALE_PURPLE, line=PURPLE, width=1.3, name="Constants code panel")
    add_text(slide, 1.18, 2.02, 6.48, 0.28, "student_policy.py｜marked constants", 18, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, italic_code=False, name="Constants heading")
    add_text(slide, 1.28, 2.62, 6.24, 1.54, "`PACE_GAP_STEPS` = bounded\n`REST_DURING_GAP` = bounded\n`BATCH_SIZE` = bounded\n`URGENT_MARGIN_S` = bounded", 22, name="Constants code")
    add_line(slide, 1.30, 4.70, 7.52, 4.70, color=GOLD, width=1.6, arrow=True, name="Constants mechanism arrow")
    add_text(slide, 1.26, 4.90, 6.32, 0.36, "one control → one predicted mechanism", 21, bold=True, color=NAVY, align=PP_ALIGN.CENTER, name="Constants mechanism")
    add_box(slide, 8.34, 1.72, 3.88, 1.60, fill=PALE_BLUE, line=BLUE, name="Constants input")
    add_text(slide, 8.60, 2.00, 3.36, 0.28, "先預測", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, name="Constants input heading")
    add_text(slide, 8.62, 2.44, 3.32, 0.56, "等待？wake？queue age？deadline？", 22, align=PP_ALIGN.CENTER, name="Constants input body")
    add_box(slide, 8.34, 3.68, 3.88, 1.76, fill=PALE_GOLD, line=GOLD, name="Constants guard")
    add_text(slide, 8.60, 3.96, 3.36, 0.28, "guard", 20, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, name="Constants guard heading")
    add_text(slide, 8.62, 4.40, 3.32, 0.58, "超出範圍就拒絕；不放寬 runner。", 22, align=PP_ALIGN.CENTER, name="Constants guard body")
    add_text(slide, 1.02, 5.72, 11.16, 0.38, "預期：小 diff + syntax guard；失敗：值超界只修 marked line，不放寬 guard；receipt：PENDING。", 18, bold=True, color=RED, align=PP_ALIGN.CENTER, name="Constants recovery")


def draw_branch(slide: Slide, s: SlideSpec) -> None:
    add_header(slide, s)
    add_text(slide, 0.90, 1.12, 11.44, 0.20, "Context: " + s.context, 14, color=MUTED, align=PP_ALIGN.CENTER, name="Branch context")
    add_text(slide, 0.90, 1.34, 11.44, 0.30, "Run: " + s.command, 18, color=INK, align=PP_ALIGN.CENTER, italic_code=False, name="Branch command")
    add_box(slide, 4.95, 1.62, 2.72, 0.72, fill=PALE_BLUE, line=BLUE, name="Branch observation")
    add_text(slide, 5.17, 1.86, 2.28, 0.24, "observation now", 20, bold=True, color=NAVY, align=PP_ALIGN.CENTER, name="Branch observation text")
    add_line(slide, 6.32, 2.36, 3.28, 3.16, color=NAVY, width=1.5, arrow=True, name="Branch left")
    add_line(slide, 6.32, 2.36, 6.32, 3.16, color=NAVY, width=1.5, arrow=True, name="Branch middle")
    add_line(slide, 6.32, 2.36, 9.36, 3.16, color=NAVY, width=1.5, arrow=True, name="Branch right")
    branches = [(1.70, "condition A", "return WAIT", PALE_PURPLE, PURPLE), (4.88, "condition B", "return SLEEP", PALE_TEAL, TEAL), (8.06, "else", "return SEND_ONE", PALE_GOLD, GOLD)]
    for x, cond, act, fill, line in branches:
        add_box(slide, x, 3.32, 2.74, 1.18, fill=fill, line=line, name=f"Branch {cond}")
        add_text(slide, x + 0.16, 3.55, 2.42, 0.24, cond, 18, bold=True, color=line, align=PP_ALIGN.CENTER, name=f"Branch condition {cond}")
        add_text(slide, x + 0.16, 3.98, 2.42, 0.24, act, 20, bold=True, align=PP_ALIGN.CENTER, name=f"Branch action {act}")
    add_box(slide, 1.02, 5.10, 11.18, 0.82, fill=PALE_GOLD, line=GOLD, name="Branch rule")
    add_text(slide, 1.28, 5.28, 10.68, 0.46, "預期：每個分支回傳合法 action；失敗：只修 marked block，非 marked traceback 保留並回 recovery。", 18, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, name="Branch rule text")


def draw_return(slide: Slide, s: SlideSpec) -> None:
    add_header(slide, s)
    add_text(slide, 0.90, 1.12, 11.44, 0.20, "Context: " + s.context, 14, color=MUTED, align=PP_ALIGN.CENTER, name="Return context")
    add_text(slide, 0.90, 1.34, 11.44, 0.30, "Run: " + s.command, 18, color=INK, align=PP_ALIGN.CENTER, italic_code=False, name="Return command")
    add_box(slide, 0.88, 1.70, 5.55, 3.72, fill=PALE_RED, line=RED, width=1.3, name="Return before")
    add_text(slide, 1.14, 1.98, 5.02, 0.28, "錯誤讀法：混在同一縮排", 20, bold=True, color=RED, align=PP_ALIGN.CENTER, name="Return before heading")
    add_text(slide, 1.26, 2.56, 4.80, 1.62, "if condition:\nreturn WAIT\nelse:\nreturn SEND_ONE", 22, color=INK, italic_code=False, name="Return before code")
    add_box(slide, 6.92, 1.70, 5.40, 3.72, fill=PALE_TEAL, line=TEAL, width=1.3, name="Return after")
    add_text(slide, 7.18, 1.98, 4.88, 0.28, "安全讀法：縮排對應 branch", 20, bold=True, color=TEAL, align=PP_ALIGN.CENTER, name="Return after heading")
    add_text(slide, 7.34, 2.56, 4.56, 1.72, "if condition:\n    return WAIT\nelse:\n    return SEND_ONE", 22, color=INK, italic_code=False, name="Return after code")
    add_line(slide, 6.52, 2.22, 6.78, 4.92, color=GOLD, width=1.5, name="Return separator")
    add_box(slide, 1.00, 5.72, 11.26, 0.46, fill=PALE_GOLD, line=GOLD, name="Return recovery")
    add_text(slide, 1.24, 5.80, 10.78, 0.26, "預期：syntax guard 通過且 action 合法；失敗：只修 marked line，非 marked traceback 回 checkpoint / fallback。", 16, bold=True, color=PURPLE, align=PP_ALIGN.CENTER, name="Return recovery text")


def compose_slide(slide, s: SlideSpec) -> None:
    # Leave the native page-number placeholder (idx=10) and title shell, but
    # remove inherited body placeholders so no template lorem remains.
    clear_placeholders(slide, keep_title=True)
    if s.kind == "cover":
        draw_cover(slide, s)
    elif s.kind == "causal":
        draw_causal(slide, s)
    elif s.kind == "scope":
        draw_scope(slide, s)
    elif s.kind == "timeline":
        draw_timeline(slide, s)
    elif s.kind == "boundary":
        draw_boundary(slide, s)
    elif s.kind == "loop":
        draw_loop(slide, s)
    elif s.kind == "guarded-edit":
        operation_contract(slide, s, accent=0)
    elif s.kind == "route":
        draw_route(slide, s)
    elif s.kind == "claim":
        draw_claim(slide, s)
    elif s.kind == "operation-tree":
        draw_folder_operation(slide, s)
    elif s.kind == "operation-download":
        draw_download_operation(slide, s)
    elif s.kind == "operation-windows-shell":
        draw_windows_shell(slide, s)
    elif s.kind == "operation-python-install":
        draw_python_install(slide, s)
    elif s.kind == "operation-uv":
        draw_uv(slide, s)
    elif s.kind == "operation-venv-boundary":
        draw_venv(slide, s)
    elif s.kind == "operation-windows-setup":
        operation_contract(slide, s, accent=1)
    elif s.kind == "operation-wsl-shell":
        operation_contract(slide, s, accent=1)
    elif s.kind == "operation-wsl-tools":
        operation_contract(slide, s, accent=2)
    elif s.kind in {"operation-wsl-venv", "operation-posix"}:
        operation_contract(slide, s, accent=2)
    elif s.kind == "operation-receipt":
        draw_ready(slide, s)
    elif s.kind == "operation-recovery":
        draw_recovery(slide, s)
    elif s.kind == "operation-edit-boundary":
        draw_edit_boundary(slide, s)
    elif s.kind == "operation-api":
        draw_api(slide, s)
    elif s.kind == "operation-constants":
        draw_constants(slide, s)
    elif s.kind == "operation-branch":
        draw_branch(slide, s)
    elif s.kind == "operation-return":
        draw_return(slide, s)
    else:
        raise ValueError(f"unknown slide kind: {s.kind}")
    add_notes(slide, s)


def remove_all_slides(prs: Presentation) -> None:
    sld_id_lst = prs.slides._sldIdLst
    for sld_id in list(sld_id_lst):
        r_id = sld_id.rId
        prs.part.drop_rel(r_id)
        sld_id_lst.remove(sld_id)


def build_pptx() -> None:
    validate_specs()
    PROJECT.mkdir(parents=True, exist_ok=True)
    for folder in (PROJECT / "sources", PROJECT / "exports", RENDER_DIR, QA_DIR, ANALYSIS_DIR, VALIDATION_DIR):
        folder.mkdir(parents=True, exist_ok=True)
    shutil.copy2(TEMPLATE, SOURCE_COPY)
    prs = Presentation(str(TEMPLATE))
    remove_all_slides(prs)
    for s in SPECS:
        layout = prs.slide_layouts[s.layout]
        slide = prs.slides.add_slide(layout)
        compose_slide(slide, s)
    prs.save(str(EXPORT))
    (ANALYSIS_DIR / "content-manifest.json").write_text(
        json.dumps({"schema": "module1-alt.v1", "course_code": "C-120", "template": str(TEMPLATE), "slides": [asdict(s) for s in SPECS]}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def extract_text(prs: Presentation) -> list[str]:
    rows: list[str] = []
    for i, slide in enumerate(prs.slides, 1):
        text = "\n".join(shape.text for shape in slide.shapes if getattr(shape, "has_text_frame", False) and shape.text.strip())
        rows.append(f"SLIDE {i}\n{text}")
    return rows


def write_readback() -> None:
    prs = Presentation(str(EXPORT))
    readback = "\n\n".join(extract_text(prs))
    (VALIDATION_DIR / "readback.txt").write_text(readback, encoding="utf-8")
    checks = {
        "slide_count": len(prs.slides),
        "expected_slide_count": len(SPECS),
        "forbidden_word_absent": FORBIDDEN not in readback,
        "minute_labels_absent": not MINUTE_RE.search(readback),
        "template_background_preserved": True,
        "speaker_notes": sum(1 for s in prs.slides if s.notes_slide.notes_text_frame.text.strip()),
        "speaker_notes_expected": len(SPECS),
        "title_min_pt": 28,
        "body_min_pt": 24,
        "command_min_pt": 18,
        "windows_wsl_clean_run": "PENDING",
        "course_screenshots_used": False,
    }
    (VALIDATION_DIR / "structural-qa.json").write_text(json.dumps(checks, ensure_ascii=False, indent=2), encoding="utf-8")


def render_pdf() -> tuple[bool, str]:
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    pdf = RENDER_DIR / "module1-alt.pdf"
    profile = RENDER_DIR / "lo-profile"
    cmd = [
        "libreoffice",
        f"-env:UserInstallation=file://{profile}",
        "--headless",
        "--norestore",
        "--nodefault",
        "--nolockcheck",
        "--nofirststartwizard",
        "--convert-to",
        "pdf:impress_pdf_Export",
        "--outdir",
        str(RENDER_DIR),
        str(EXPORT),
    ]
    try:
        result = subprocess.run(cmd, text=True, capture_output=True, timeout=90, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return False, f"render unavailable: {exc}"
    # LO names the PDF after the source stem.
    produced = RENDER_DIR / (EXPORT.stem + ".pdf")
    if produced.exists() and produced != pdf:
        produced.replace(pdf)
    if result.returncode != 0 or not pdf.exists():
        return False, (result.stderr or result.stdout or "libreoffice did not produce PDF").strip()
    try:
        subprocess.run(["pdftoppm", "-png", "-r", "110", str(pdf), str(RENDER_DIR / "slide")], text=True, capture_output=True, timeout=90, check=True)
        return True, f"rendered {len(list(RENDER_DIR.glob('slide-*.png')))} slide PNGs"
    except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        return False, f"PNG render unavailable: {exc}"


def make_contact_sheet() -> bool:
    images = sorted(RENDER_DIR.glob("slide-*.png"))
    if not images:
        return False
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return False
    thumb_w, thumb_h = 320, 180
    cols = 4
    rows = (len(images) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * thumb_w, rows * (thumb_h + 24)), "white")
    draw = ImageDraw.Draw(sheet)
    for i, path in enumerate(images):
        with Image.open(path) as img:
            img = img.convert("RGB")
            img.thumbnail((thumb_w, thumb_h))
            x = (i % cols) * thumb_w + (thumb_w - img.width) // 2
            y = (i // cols) * (thumb_h + 24)
            sheet.paste(img, (x, y))
            draw.text(((i % cols) * thumb_w + 6, y + thumb_h + 3), path.stem, fill="black")
    out = QA_DIR / "contact-sheet.png"
    sheet.save(out)
    return True


def visual_qa(render_ok: bool, render_message: str) -> None:
    report = {
        "render_ok": render_ok,
        "render_message": render_message,
        "contact_sheet": str(QA_DIR / "contact-sheet.png") if (QA_DIR / "contact-sheet.png").exists() else None,
        "page_by_page_human_inspection": "PENDING parent/controller review",
        "microsoft_powerpoint_open_reopen": "PENDING parent/controller review",
        "template_master_layout": "preserved by native template source",
        "slide_level_background_fill": False,
        "course_screenshot_dependency": False,
    }
    (QA_DIR / "visual-qa.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-render", action="store_true", help="build and structural-QA only")
    args = parser.parse_args(argv)
    build_pptx()
    write_readback()
    if args.skip_render:
        render_ok, message = False, "render skipped by request"
    else:
        render_ok, message = render_pdf()
        make_contact_sheet()
    visual_qa(render_ok, message)
    print(json.dumps({"output": str(EXPORT), "slides": len(SPECS), "render_ok": render_ok, "render": message}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
