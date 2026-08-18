# C-120 LoRa × Leo 講師 rehearsal runbook

狀態：`SERVER-PACKAGE-HASH-VERIFIED / FRESH-RUN PENDING REHEARSAL / BROWSER EVIDENCE PENDING REHEARSAL`

這份 runbook 是給講師在課前逐步排演用的操作稿。它以 server 上的獨立
runner package、實際 scripts、policy API、JSON schemas，以及 Leo `/course`
import seam 為準。它不把 package README 的命令文字改寫成已完成的本機
fresh-run 證據；尚未由本 controller 重演的命令與瀏覽器流程，都保留
`PENDING REHEARSAL` 標記。

## 先固定這些邊界

runner 只執行 package 內的 `coherent-course-simulated-adapter`。它不執行
`GillesC/LoRaEnergySim` 上游程式；上游 repository 與 commit 只是 provenance
參考。所有 result、endpoint replay、freeze receipt 與 Leo 畫面都必須保留這個
claim boundary：

```text
SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED
```

endpoint energy 的範圍是 package 宣告的
`endpoint-radio-and-processing-course-assumptions`。講解時把 queue、packet、
radio state、service、endpoint energy 與 units 分開；不要把 endpoint J 說成
整個部署系統或 wall-plug energy，也不要自行填入尚未產生的數字或 KPI。

### 身份卡

```text
scenario_id:             c120-ntpu-energy-decision-01
runner_contract_version: c120-lora-leo-v1
wrapper_version:         c120-lora-runner-v1
policy_api_version:      c120-student-policy-v1
endpoint replay:         c120-lora-endpoint-replay-v1
workbook extension:      c120-energy-decision-workbook-v3
scenario_sha256:         sha256:eef91848de0ea2b974b6607f3549d63826a1a85a0a50453ee3f56f45b3b4e75a
c120_anchor_sha256:      sha256:73d04695f5bf1d4d9d0a4091430d6eaeec863c0ef2268abc12587c8771cc21ec
upstream reference:      GillesC/LoRaEnergySim@f854462cda0cd30cb56e3f0c576cb004711842f6
```

### 證據標籤

- `SERVER-SOURCE-VERIFIED`：本 controller 已從 server checkout 讀到檔案內容，
  但不等於講師電腦已完成 fresh run。
- `PACKAGE-HASH-VERIFIED`：server package archive 的 SHA-256 已由本 controller
  讀取並核對；講師仍應在自己的下載目錄重新核對。
- `PENDING REHEARSAL`：命令、receipt、result artifact 尚未由本 controller 在
  乾淨環境重演；這些是 package/source-based instructions，不是 fresh evidence。
- `SERVER-PREVIEW-VERIFIED / WINDOWS PENDING`：server preview 的 Leo import、
  endpoint replay、workbook export、same-scenario fallback 與 mismatch rejection
  已留存證據；Windows native、WSL fresh-run 與本機 pixel acceptance 仍待排演。

## 0. 課前取得指定 release

### 0.1 下載正確資產

**Do：** 從 owner 指定的 server 下載這兩個同名資產，並在下載目錄確認檔名：

```text
http://120.126.151.102:4192/c120-lora-energy-lab-v1.zip
http://120.126.151.102:4192/c120-lora-energy-lab-v1.zip.sha256
```

只使用這組 URL 與檔名；不要改用相似 archive 或不同 branch 的 source ZIP。

**Why：** release archive 才能把 runner、policy、lock、scenario、schemas 與
fallback 保持在同一 provenance；moving branch 或自動 source archive 可能混入
不同版本。

**Mechanism：** ZIP 內應只有一個 `c120-lora-energy-lab/` 根目錄；`.venv` 與
過去排演產生的 `artifacts` 不應依賴下載檔提供。

**Expect：** 本次 server package reference 的完整 SHA-256 是：

```text
ae887f751b93dbcbdb2289b0593fc2ccebed01da05e2e7034db0c24f692bf46e
```

這個 reference 為 `PACKAGE-HASH-VERIFIED`。Server listener、ZIP bytes、
checksum 內容與單一根目錄 65-file inventory 已核對。2026-08-11 controller
已從公開 URL 完整下載 115,697-byte ZIP 與 checksum，`sha256sum -c` 通過，
`unzip -t` 無錯誤，且 inventory 仍為單一 `c120-lora-energy-lab/` 根目錄與
65 個項目。因此標示 `EXTERNAL GET VERIFIED FROM CONTROLLER`；這仍不等於每一個
教室網路均已排演。

**Interpret：** hash 不相同、根目錄多於一個，或缺少 README、setup scripts、
lock、policy、runner、schemas 時，停在取得階段，回到 owner 指定的 release；
不要拼裝替代 package。

### 0.2 核對與解壓

**Do：** 先在下載目錄執行 checksum，再解壓並進入 ZIP 內唯一的
`c120-lora-energy-lab/` 根目錄。**Why：** 將講師實際使用的 bytes 與指定
release identity 綁在一起。**Mechanism：** `.sha256` 第一欄提供 archive digest；
解壓後的根目錄提供 scripts、lock、policy、scenario、schemas 與 fallback 的
共同邊界。**Expect：** checksum 通過，且 `cd c120-lora-energy-lab` 後能看到
`README.zh-TW.md`、`setup.sh`/`setup.cmd`、`course.sh`/`course.cmd`、
`student_policy.py` 與 `schemas/`。**Interpret：** checksum、根目錄或必要檔案
不符時停止，不在錯誤 archive 上繼續 setup。

Linux：

```sh
sha256sum -c c120-lora-energy-lab-v1.zip.sha256
unzip c120-lora-energy-lab-v1.zip
cd c120-lora-energy-lab
```

macOS：

```sh
shasum -a 256 c120-lora-energy-lab-v1.zip
unzip c120-lora-energy-lab-v1.zip
cd c120-lora-energy-lab
```

將 `shasum` 第一欄與 `.sha256` 第一欄逐字比較。Windows PowerShell：

```powershell
Get-FileHash .\c120-lora-energy-lab-v1.zip -Algorithm SHA256
Expand-Archive .\c120-lora-energy-lab-v1.zip -DestinationPath .
Set-Location .\c120-lora-energy-lab
```

**EXTERNAL GET VERIFIED FROM CONTROLLER：** 上述公開 URL 的完整下載、hash、
ZIP integrity 與單一根目錄 inventory 已由本 controller fresh-run；不同教室網路
仍應在課前重新下載並核對，不把 controller 網路通過擴張成所有場域均通過。

## 1. Python 3.11 setup 與 READY

以下命令均在解壓後的 `c120-lora-energy-lab/` 根目錄執行。這是 package README
與實際 `setup.sh`、`setup.cmd`、`verify_setup.py` 的命令面；本節 fresh execution
仍為 `PENDING REHEARSAL`。

### 1.1 先辨認 shell，再選一條路徑

先看提示字元與目前路徑，不要把一個 shell 的命令貼到另一個 shell：

- **Command Prompt（CMD）** 通常以 `C:\...>` 開頭；使用 `set`、`py`、
  `setup.cmd`、`course.cmd`。
- **PowerShell** 通常以 `PS C:\...>` 開頭；使用 `$env:NAME`、`Get-FileHash`、
  `Expand-Archive` 與 `.\setup.cmd`。
- **WSL/Ubuntu** 通常以 `<user>@<host>:~$` 開頭；`pwd` 會回傳 `/home/...`，
  使用 `bash`、`sha256sum`、`unzip`、`source` 與 `setup.sh`。

本節兩條路徑均為 **`PENDING REHEARSAL`**。講師在一次排演中只選 Windows 原生
或 WSL/Ubuntu 其中一條；不要讓同一份 package 同時共用兩種 `.venv`。

### 1.2 Windows 原生：Python launcher、uv 與 package setup

**Do：** 在 Windows 原生的 CMD 或 PowerShell 執行 prerequisite checks：

```bat
py --list
py -3.11 --version
```

PowerShell 也可直接執行相同兩行。**Why：** `py --list` 顯示已註冊的 Python
versions，`py -3.11 --version` 確認 setup 將使用 exact 3.11.x，而不是 PATH 中
碰巧排在前面的其他版本。**Mechanism：** Python Launcher 依 version tag 選取
interpreter；package 的 `setup.cmd` 會再驗證 interpreter 與 package-local
`.venv`。**Expect：** `py --list` 能看到 3.11，第二行回報 `Python 3.11.x`。
**Interpret：** `py` 不存在或沒有 3.11 時，不要改用未指定版本的 `python`；走
下方官方 Python installer 或 uv recovery。

若使用官方 CPython installer，選 Python 3.11 的 user-level 安裝；需要時勾選
launcher/PATH 選項。安裝完成後重新開啟 CMD/PowerShell，再重跑上面兩行。

若選 uv 管理 Python，PowerShell 可用官方 WinGet 安裝：

```powershell
winget install --id=astral-sh.uv -e
uv --version
uv python install 3.11
uv python find 3.11
```

也可依 uv 官方 standalone installer：

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

安裝後重新開啟 PowerShell；若 `uv` 仍找不到，先檢查 installer 顯示的 PATH，再
重跑 `uv --version`。**Do：** 使用 `py -3.11` 時在 CMD 設定：

```bat
set "PYTHON_BIN=py -3.11"
setup.cmd
course.cmd verify
```

PowerShell 等價寫法：

```powershell
$env:PYTHON_BIN = "py -3.11"
.\setup.cmd
.\course.cmd verify
```

若 `py -3.11` 仍不可用但 `uv python find 3.11` 已回傳 path，PowerShell 可把
該 path 傳給 package setup；path 含空格時保留引號：

```powershell
$uvPython = (uv python find 3.11).Trim()
$env:PYTHON_BIN = '"' + $uvPython + '"'
.\setup.cmd
.\course.cmd verify
```

**Why：** Windows 原生路徑由 `setup.cmd` 建立 `.venv\Scripts\python.exe`，不應
混入 WSL 的 `.venv/bin/python`。**Mechanism：** setup 使用 lock 的 hashes 安裝，
最後產生 `artifacts\verify-receipt.json`。**Expect：** verify stdout 與 receipt
顯示 `READY`、Python 3.11.x、scenario/lock/policy identity 與 claim boundary。
**Interpret：** 任何版本、lock 或 receipt gate failure 都先停止；不要移除 pins，
必要時改用第 5 節 same-scenario fallback。

正常課程不必手動 activate；`course.cmd` 會優先使用 package-local venv。只為了
診斷版本時，可直接檢查：

```powershell
.\.venv\Scripts\python.exe --version
```

若需要互動式檢查，PowerShell：

```powershell
.\.venv\Scripts\Activate.ps1
python --version
deactivate
```

CMD：

```bat
.venv\Scripts\activate.bat
python --version
deactivate
```

若 PowerShell execution policy 阻擋 activation，不要為了課程放寬系統 policy；
改用 `.\.venv\Scripts\python.exe` 或直接執行 `course.cmd`。

### 1.3 WSL/Ubuntu：Windows 端前置與 Linux package setup

**Do：** 先在 Windows PowerShell（需要時以 Administrator 開啟）檢查或安裝 WSL：

```powershell
wsl --install
wsl -l -v
```

**Why：** `wsl --install` 會啟用 WSL、安裝預設 Ubuntu，並依 Windows 狀態提示
restart；`wsl -l -v` 確認 Ubuntu distribution 與 WSL version。**Mechanism：**
WSL 端與 Windows 原生端是兩個 shell/檔案環境；Windows 端只負責 WSL 前置，
Ubuntu 端負責 Linux runner。**Expect：** `wsl -l -v` 能看到 `Ubuntu`；新安裝
首次啟動時完成 Linux username/password。**Interpret：** `wsl --install` 若只顯示
help，代表 WSL 可能已存在；可在 Windows 端先執行 `wsl --list --online`，再以
`wsl --install -d Ubuntu` 指定 distro。若需要 restart，完成後再跑 `wsl -l -v`。

進入 Ubuntu（從 Start 開啟 Ubuntu，或在 Windows 端執行 `wsl`）後，確認這已是
WSL shell：

```sh
pwd
uname -a
```

先準備 Linux 工具並安裝 uv：

```sh
sudo apt update
sudo apt install -y curl unzip
curl -LsSf https://astral.sh/uv/install.sh | sh
```

依 installer 指示重新開啟 Ubuntu shell，然後確認：

```sh
uv --version
uv python install 3.11
uv python find 3.11
```

**Do：** 將 ZIP 放在 WSL 的 Linux home，例如 `~/c120-course/`，在 WSL 內核對
並解壓；若 ZIP 在 Windows Downloads，可從 `/mnt/c/Users/<YourName>/Downloads/`
複製進來。**Why：** 避免把 Windows `.venv` 帶入 WSL，也避免跨 shell 共享一個
不可攜的 environment。**Mechanism：** WSL package 由 `setup.sh` 建立
`.venv/bin/python`，以 `PYTHON_BIN="$(uv python find 3.11)"` 選定 interpreter。
**Expect：** `bash course.sh verify` 產生 `artifacts/verify-receipt.json`，並顯示
Python 3.11.x 與 `READY`。**Interpret：** WSL 的 `.venv` 只在 WSL 使用；不要從
Windows CMD/PowerShell 呼叫它，也不要在 WSL 執行 Windows `setup.cmd`。

在 WSL package root 執行：

```sh
PYTHON_BIN="$(uv python find 3.11)" bash setup.sh
bash course.sh verify
```

正常課程不必手動 activate；`course.sh` 會優先使用 package-local
`.venv/bin/python`。只為了診斷版本時，可直接檢查或短暫 activate：

```sh
.venv/bin/python --version
source .venv/bin/activate
python --version
deactivate
```

離開 WSL 時使用 `exit`；回到 Windows 後不要把 Windows package root 與 WSL
package root 混看成同一個 shell。若要從另一條路徑重新排演，使用同一 ZIP 重新
解壓，並只建立該環境自己的 package-local `.venv`。

### 1.4 Package setup — POSIX / Linux / macOS

```sh
PYTHON_BIN=python3.11 bash setup.sh
bash course.sh verify
```

### 1.5 Package setup — Windows Command Prompt / PowerShell

```bat
set "PYTHON_BIN=py -3.11"
setup.cmd
course.cmd verify
```

**Do：** 在正確 package root 以 Python 3.11.x 執行 setup，再以相同 package
launcher 執行 verify。**Why：** 先固定 interpreter、dependency lock、policy API
與 scenario，再開始任何 policy edit。**Mechanism：** setup 建立 package-local
`.venv`、以 `--require-hashes --no-deps` 安裝 lock，最後呼叫 `verify_setup.py`；
`course.sh`/`course.cmd` 會優先選用這個 `.venv`。**Expect：** verify stdout 是
machine-readable JSON，並寫出 `artifacts/verify-receipt.json`；成功 receipt 的
`status` 是 `READY`。**Interpret：** 其他版本、lock failure、policy/scenario
identity mismatch 都是 setup gate failure；不要以換版本或移除 hash 來繼續。

`setup.sh` / `setup.cmd` 會建立 package-local `.venv`，以
`requirements-lock.txt` 的 hash 安裝，最後呼叫與 launcher 相同的 verify。成功
時應產生：

```text
artifacts/verify-receipt.json
```

receipt 應至少讓講師確認 `status: READY`、Python `3.11.x`、scenario identity、
`policy_api_version`、lock hash、`engine_mode: coherent-course-simulated-adapter`、
`upstream_execution: false` 與完整 claim boundary。不要用 Python 3.12 或 3.13
放寬這個 gate。

### 1.6 找不到 Python 3.11 時

POSIX 可使用 package README 指定的 uv recovery：

```sh
uv python install 3.11
PYTHON_BIN="$(uv python find 3.11)" bash setup.sh
bash course.sh verify
```

**Do：** 只在 3.11.x 不可用時安裝或選取 3.11 interpreter，再重跑 setup/verify。
**Why：** 保持 frozen result contract 的 Python minor version。**Mechanism：**
`uv python find 3.11` 提供實際 interpreter path；setup 仍會重新驗證 venv 版本。
**Expect：** 重新得到同一 scenario/contract identity 的 READY receipt。**Interpret：**
若仍無法建立 3.11 venv，停止 local runner 並改用第 5 節 same-scenario fallback；
不要把 recovery 當成 fresh result。

Windows 先執行 `uv python install 3.11`，再以 `uv python find 3.11` 顯示的
interpreter path 設定 `PYTHON_BIN`，然後重新執行 `setup.cmd`。setup 會再次檢查
選定 interpreter 與 `.venv` 都是 3.11.x，不會靜默接受其他 minor version。

若既有 `.venv` 使用錯誤版本，只處理這個 package-local venv 後重跑：

```sh
rm -rf .venv
```

Windows：

```bat
rmdir /s /q .venv
```

這兩個 recovery 命令只針對解壓後 package 目錄內的 `.venv`；不要刪除其他
project 或使用者環境。

### 1.7 setup 在 Leo 的記錄方式

**Do：** 將 runner 的 READY receipt 或明確 fallback 選擇記錄在 Leo setup panel。
**Why：** 讓 workbook 知道本次 session 是外部 runner ready 還是同 scenario
fallback。**Mechanism：** panel 只保存 setup mode；result import 仍由獨立控制項
處理。**Expect：** setup status 與後續 import source 可互相對照。**Interpret：**
沒有 READY 時不可標成 ready；選 fallback 也不代表 local policy 曾執行。

開啟 Leo `/course` 的 runner setup panel。看到外部 runner 的 machine-readable
READY receipt 後，按「我看到 READY，記錄 receipt」。若主機無法達到 READY，按
「選擇有標籤的同一 scenario fallback」；這個按鈕只記錄 setup mode，真正的
fallback `result.json` 仍要在下方 import control 另外選取。

**PENDING REHEARSAL — BROWSER：** 上述 Leo setup panel、READY 記錄與
fallback 選擇尚未由本 controller 重演；不能把它當成 browser acceptance 或
pixel evidence。

## 2. 只編輯 marked policy blocks

唯一可編輯檔案是：

```text
student_policy.py
```

`student_policy.baseline.py` 是封裝的 reference，只讀使用。三個可編輯 marker
必須維持原樣：

```text
# === C120 EDITABLE: lab-a-pace-rest ===
# === C120 END EDITABLE: lab-a-pace-rest ===

# === C120 EDITABLE: lab-b-enter-exit-hold ===
# === C120 END EDITABLE: lab-b-enter-exit-hold ===

# === C120 EDITABLE: lab-c-batch-urgent ===
# === C120 END EDITABLE: lab-c-batch-urgent ===
```

各 block 的 bounded constants 是：

- `lab-a-pace-rest`：`PACE_GAP_STEPS`、`REST_DURING_GAP`。
- `lab-b-enter-exit-hold`：`ENTER_QUALITY`、`EXIT_QUALITY`、`STABLE_STEPS`。
- `lab-c-batch-urgent`：`BATCH_SIZE`、`URGENT_MARGIN_S`。

**Do：** 每次只改目前 Lab 的 marked block；先在 Leo workbook 或講師備課記錄寫
下 queue、service、packet、state duration、endpoint-energy 的 prediction，再
執行命令。

**Why：** 只有一個受控變因時，baseline、candidate、freeze 與 withheld 的
predecessor lineage 才能解釋。

**Mechanism：** policy guard 會檢查 exact UTF-8/LF bytes、三組 markers、AST、
allowed observations、allowed actions 與 constants。`choose_action(observation)`
只能回傳 `WAIT`、`SLEEP`、`SEND_ONE`、`SEND_URGENT` 或 `FLUSH_BATCH`。

**Expect：** 正常 policy 可由 runner 在本機載入；result 會記錄 policy SHA、
active block、predecessor 與 freeze receipt identity。

**Interpret / recover：** 不要加入 import、function call、scenario 內容、
schemas、generated JSON、runner 或 Leo code。BOM、CRLF、缺少最後 LF、非法 AST、
未知名稱或越出 marked block 都應停止並依錯誤訊息修復；若 policy 已混亂，使用
第 8 節的 checkpoint restore，不要手改 result/replay JSON。

## 3. 十個 exact cases

每次成功的 runner command 都應在 stdout 印出 JSON，使用其中的 `result_path`，
不要自行猜 `<run_id>`。student-run artifact 的預期位置是：

```text
artifacts/<run_id>/result.json
artifacts/<run_id>/endpoint-replay.json
```

`--freeze` 只允許用在 A candidate、B Trace A candidate、C revision。baseline、
C candidate 與所有 withheld command 都不要加 `--freeze`。

### 3.1 Lab A — baseline

```sh
bash course.sh run --lab A --case baseline
```

Windows：

```bat
course.cmd run --lab A --case baseline
```

**Do：** 保持 release-default policy，執行未修改的 Lab A baseline。**Why：** 建立
candidate 的控制組。**Mechanism：** 固定 scenario 與 seed，讓 pace/rest policy
產生 queue、packet、radio state、service 與 endpoint-energy ledger。**Expect：**
stdout 有 baseline `run_id` 與 `result_path`，且沒有 candidate freeze receipt。
**Interpret：** 先記錄可比較欄位；沒有數字時保留空白，不以預期值代填。

狀態：`PENDING REHEARSAL`；本 controller 尚未在乾淨 Python 3.11 package
環境重演此命令。

### 3.2 Lab A — candidate freeze

先只改 `lab-a-pace-rest`，再執行：

```sh
bash course.sh run --lab A --case candidate --freeze
```

Windows：

```bat
course.cmd run --lab A --case candidate --freeze
```

**Do：** 只改 A block 後執行並 freeze。**Why：** 將 pace/rest 的因果假設固定，
供 hidden case 使用。**Mechanism：** receipt 綁定 scenario、anchor、policy SHA、
predecessor、lock、seed 與 `active_block_id`。**Expect：** 產生 candidate result、
`artifacts/receipts/` 的 content-addressed receipt，以及
`artifacts/checkpoints/lab-a-frozen.json` 與同名 `.py` checkpoint；candidate
policy SHA 應與 baseline 不同。**Interpret：** 若沒有 consequential queue、packet、
service、state 或 endpoint-energy change，先檢查確實只改了 A block；不要為 hidden
case 再調參。

狀態：`PENDING REHEARSAL`。

### 3.3 Lab A — hidden

保持 A candidate freeze 的 policy 不變：

```sh
bash course.sh run --lab A --case hidden
```

Windows：

```bat
course.cmd run --lab A --case hidden
```

**Do：** 不再編輯 policy，執行 withheld hidden case。**Why：** 檢查 pace/rest
預測能否承受另一個成本或 service-window 條件。**Mechanism：** runner 先驗證
`lab-a-frozen` receipt，再以同一 policy bytes 執行 hidden case；withheld case 不會
建立新 freeze。**Expect：** hidden result 的 policy SHA 與 A frozen candidate 相同，
並有自己的 queue、service、state 與 energy evidence。**Interpret：** 方向相反是
counterexample，應寫入 workbook，而不是事後修改 policy。

狀態：`PENDING REHEARSAL`。

### 3.4 Lab B — Trace A baseline

保持 A frozen policy，執行：

```sh
bash course.sh run --lab B --case trace-a-baseline
```

Windows：

```bat
course.cmd run --lab B --case trace-a-baseline
```

**Do：** 不改 A block，先執行 Trace A baseline。**Why：** 建立 enter/exit/hold
候選的 control，避免把 trace 差異誤認成 policy effect。**Mechanism：** runner
驗證 A receipt，並使用 B block 的 baseline policy；固定 quality/contact trace。
**Expect：** 產生 Trace A baseline 的 mode transition、queue、service 與 endpoint
energy evidence。**Interpret：** 先記錄 transition 與 hold prediction；若前置 A
receipt 缺失，先 restore A checkpoint。

狀態：`PENDING REHEARSAL`。

### 3.5 Lab B — Trace A candidate freeze

只改 `lab-b-enter-exit-hold`，再執行：

```sh
bash course.sh run --lab B --case trace-a-candidate --freeze
```

Windows：

```bat
course.cmd run --lab B --case trace-a-candidate --freeze
```

**Do：** 只改 `ENTER_QUALITY`、`EXIT_QUALITY`、`STABLE_STEPS` 中的合法值，執行
並 freeze。**Why：** 測試 hysteresis 是否拒絕短暫 quality spike，又能在穩定條件
下切換。**Mechanism：** B receipt 綁定 A frozen policy 作 predecessor，並鎖定 B
marked block。**Expect：** 產生新的 policy SHA、Trace A transition diff、receipt，
以及 `artifacts/checkpoints/lab-b-frozen.json` 與同名 `.py`。**Interpret：** 只有
畫面改變而 queue/service/energy 不變時，記錄 consequential-fixture gate 未通過；
不要編輯未標記區域。

狀態：`PENDING REHEARSAL`。

### 3.6 Lab B — Trace B withheld

保持 B freeze 的 policy：

```sh
bash course.sh run --lab B --case trace-b
```

Windows：

```bat
course.cmd run --lab B --case trace-b
```

**Do：** 不再編輯 policy，執行 withheld Trace B。**Why：** 觀察 hysteresis 在未
公開 quality/contact trace 的反例。**Mechanism：** runner 驗證 B receipt 與 policy
SHA，套用同一 frozen policy；withheld case 不建立新 freeze。**Expect：** Trace B
result 沿用 B frozen policy SHA，並提供 transition、service、queue、endpoint J。
**Interpret：** 意外切換或 service loss 是要保留的 counterexample，不是再次調整
threshold 的理由。

狀態：`PENDING REHEARSAL`。

### 3.7 Lab C — baseline

保持 B frozen policy，執行：

```sh
bash course.sh run --lab C --case baseline
```

Windows：

```bat
course.cmd run --lab C --case baseline
```

**Do：** 先用 C block baseline 執行。**Why：** 建立 batching/urgent 改動的 control
與 deadline baseline。**Mechanism：** 固定 traffic、deadline、contact window，讓
policy 產生 queue age、packet outcome、service 與 endpoint-energy evidence。
**Expect：** 產生 C baseline result；此步不建立 freeze。**Interpret：** 先完成
prediction，再進行 C candidate；若 B predecessor 不符，停止並 restore B checkpoint。

狀態：`PENDING REHEARSAL`。

### 3.8 Lab C — candidate

只做一次 `lab-c-batch-urgent` marked-block 修改：

```sh
bash course.sh run --lab C --case candidate
```

Windows：

```bat
course.cmd run --lab C --case candidate
```

**Do：** 改 `BATCH_SIZE` 或 `URGENT_MARGIN_S`，執行第一個 candidate；不要加
`--freeze`。**Why：** 先測試 batching/urgency 的第一個 prediction，再判斷是否需
一次 revision。**Mechanism：** runner 以 B frozen policy 為 predecessor，讓新的
flush/send timing 影響 queue age、freshness、deadline、TX/wake 與 endpoint J。
**Expect：** 產生 candidate result 與
`artifacts/checkpoints/lab-c-candidate.py`，但沒有 C candidate freeze receipt。
**Interpret：** 逐項比較 queue、delivered/expired、deadline、state 與 endpoint J；
沒有 consequential diff 時，記錄 gate 失敗，不自行改動其他檔案。

狀態：`PENDING REHEARSAL`。

### 3.9 Lab C — revision freeze

根據 C candidate evidence 做唯一一次合法 revision：

```sh
bash course.sh run --lab C --case revision --freeze
```

Windows：

```bat
course.cmd run --lab C --case revision --freeze
```

**Do：** 只在 C marked block 做一次相對於 candidate 的修改，執行並 freeze。
**Why：** 在 surprise case 前固定修正版，避免 withheld 結果變成事後調參。
**Mechanism：** runner 綁定 C candidate checkpoint 作 predecessor，只接受目前
marked block 的合法差異。**Expect：** 產生 revision result、freeze receipt、
`artifacts/checkpoints/lab-c-frozen.json` 與同名 `.py`；完成後不可再改 policy。
**Interpret：** 若仍沒有 consequential diff、receipt 缺失，或需要第二次 revision，
就把 Lab C gate 記為未完成，不把後續 surprise 當成有效比較。

狀態：`PENDING REHEARSAL`。

### 3.10 Lab C — surprise withheld

保持 C revision freeze：

```sh
bash course.sh run --lab C --case surprise
```

Windows：

```bat
course.cmd run --lab C --case surprise
```

**Do：** 不再編輯 policy，執行 surprise case。**Why：** 觀察 batching/urgency 在
突發 traffic 下的 queue、service 與 endpoint-energy trade-off。**Mechanism：**
runner 驗證 C revision receipt，以同一 policy 處理 withheld traffic，保留 packet、
queue、radio 與 energy ledger。**Expect：** surprise result 沿用 revision policy
SHA，可與 C baseline、candidate、revision 並列。**Interpret：** 這些結果只支持
此 simulated scenario 的教學機制；意外 deadline、queue 或 energy 結果應當作
counterexample 保留。

狀態：`PENDING REHEARSAL`。

## 4. result、replay、receipt 與 checkpoint 收集

**Do：** 逐次保存 stdout JSON 指出的 `result_path`，並把 result、配對 replay、
receipt、checkpoint 與 prediction 放在同一排演資料夾索引中。**Why：** 讓講師能
從任一 run ID 回到 policy、scenario、predecessor 與 freeze lineage。**Mechanism：**
runner 以 content-addressed identity 寫入 result/replay/receipt，並以 role-specific
checkpoint 供後續 Lab restore。**Expect：** 每個 exact case 都能找到相符的
`result.json` 與 `endpoint-replay.json`，freeze case 另有 receipt/checkpoint。
**Interpret：** 缺少配對檔、identity 或 stdout path 時，先標記該 case incomplete；
不要從檔名或畫面數字推回不存在的 evidence。

每次 runner 成功時，以 stdout 顯示的 `result_path` 為準。不要靠時間、檔名猜測
run identity。每個結果應有同目錄配對檔：

```text
artifacts/<run_id>/result.json
artifacts/<run_id>/endpoint-replay.json
```

freeze 會在以下兩個區域留下可復原證據：

```text
artifacts/receipts/
artifacts/checkpoints/
```

預期的 checkpoint 名稱：

```text
lab-a-frozen.json
lab-a-frozen.py
lab-b-frozen.json
lab-b-frozen.py
lab-c-candidate.py
lab-c-frozen.json
lab-c-frozen.py
```

講師應保存 stdout JSON、完整 `result.json`、配對 `endpoint-replay.json`、
freeze receipt、active policy SHA、scenario/anchor identity，以及每個 case 的
prediction。不要只截取畫面上的單一數字，也不要手改 JSON 使狀態看起來完成。

## 5. 同 scenario fallback

如果 Python 3.11、setup、verify 或某個 run 在排演環境無法完成，不要放寬 lock、
policy guard 或 importer gate。改用 package 隨附的同 scenario fallback，並在
講師記錄中明確標為 `artifact_source: same-scenario-fallback`。

本節的 matching fallback 選取與 artifact 使用仍為 `PENDING REHEARSAL`；它是 recovery
路徑，不是本 controller 已產生的 fresh evidence。

先保留 `fallback_artifacts/manifest.json`，再使用與 case 完全相符的
`result.json`，同時保留同目錄的 `endpoint-replay.json`。對應關係如下：

- A baseline：`fallback_artifacts/baseline-A/result.json`
- A candidate：`fallback_artifacts/candidate-A/result.json`
- A hidden：`fallback_artifacts/hidden-A/result.json`
- B Trace A baseline：`fallback_artifacts/trace-a-baseline-B/result.json`
- B Trace A candidate：`fallback_artifacts/trace-a-candidate-B/result.json`
- B Trace B：`fallback_artifacts/trace-b-B/result.json`
- C baseline：`fallback_artifacts/baseline-C/result.json`
- C candidate：`fallback_artifacts/candidate-C/result.json`
- C revision：`fallback_artifacts/revision-C/result.json`
- C surprise：`fallback_artifacts/surprise-C/result.json`

**Do：** 將 fallback 視為同 scenario recovery，選取 matching result/replay pair。
**Why：** 保留 scenario identity、policy lineage、freeze receipt 與 endpoint replay
契約，讓課程仍能進行。**Mechanism：** manifest 明列十個 label、result/replay path、
scenario identity、policy lineage 與 receipt hashes。**Expect：** Leo 顯示來源為
`same-scenario-fallback`，而不是假裝有新的 local policy execution。**Interpret：**
fallback 只能支持同 scenario 的教學 recovery；它不證明本機 policy 曾執行，不能
拿來填 fresh-run 或 KPI 證據。

## 6. Leo `/course` import

以下是 server source 與 package contract 描述的操作；整段仍標為
`PENDING REHEARSAL — BROWSER`，因為本 controller 尚未重演瀏覽器流程。

### 6.1 先記 setup mode

在 Leo `/course` 的 runner panel：

1. fresh runner 成功且看到 `READY` 時，選「我看到 READY，記錄 receipt」。
2. runner 不可用而改走 fallback 時，選「選擇有標籤的同一 scenario fallback」。
3. 記錄 setup mode 後，仍要在 import panel 選取相應的 result；setup 按鈕不會
   自動匯入 artifact。

Leo 不執行或驗證 `student_policy.py`；policy 只在外部 package runner 本機執行。

### 6.2 匯入 result

在 panel 的「匯入 result.json」控制項選取：

- fresh run：`artifacts/<run_id>/result.json`；或
- fallback：與 exact case 對應的 `fallback_artifacts/.../result.json`。

**Do：** 保留並核對配對 `endpoint-replay.json`，依 Lab 順序匯入 baseline、candidate、
freeze 後的 withheld/revision cases。**Why：** workbook 才能保留 predecessor、
policy SHA、freeze receipt、run ID 與 replay lineage。**Mechanism：** strict importer
依 fail-closed 順序檢查 JSON shape/schema、scenario/anchor hash、case/lab/seed、
policy/freeze/predecessor、units、runner provenance、energy scope、claim boundary，
通過後才 materialize endpoint replay。**Expect：** 成功時 import ledger、endpoint
replay 與 workbook evidence 一起更新；失敗時 session/workbook 不應部分改變。
**Interpret：** scenario、schema、unit、policy、lock、provenance 或 replay identity
不一致，就回到 matching artifact 或同 scenario fallback；不要修改 gate 或手改
JSON。

contract source 的關鍵檔案是：

```text
contracts/c120-lora-v1/scenario.schema.json
contracts/c120-lora-v1/result.schema.json
contracts/c120-lora-v1/freeze-receipt.schema.json
contracts/c120-lora-v1/endpoint-replay.schema.json
contracts/c120-lora-v1/workbook-v3-extension.schema.json
contracts/c120-lora-v1/canonicalization.md
```

RFC 8785 JCS 與 SHA-256 會綁定 policy bytes、scenario、receipt、result、replay
input、replay identity 與 replay content。檔名、主機名、絕對路徑、上傳檔名與
timestamp 不應成為 hash preimage。

## 7. workbook 保存與 reopen

import 成功後，在 `/course` 使用「匯出可重開的學習單」保存 workbook JSON。重新
載入 `/course`，再使用「匯入並重新開啟學習單」選取保存檔。

**Do：** 檢查同一 `scenario_id`、已匯入的 run/replay records、endpoint replay
identity、completed evidence 與 artifact source 是否回來。**Why：** 這是講師
交接與中斷復原的證據，不是重新計算科學結果。**Mechanism：** workbook v3
extension 綁定 scenario、claim、units、run ledger、replay IDs、source mode 與
source workbook hash；reopen 只恢復已驗證資料。**Expect：** 正確 identity 的
workbook 可回來；不符 identity 的檔案被拒絕且 session 不變。**Interpret：** evidence
不完整就保持 `INCOMPLETE`，不要手改 workbook JSON 造成假完成。

若本機自動保存失敗，優先使用已匯出的 workbook backup；若沒有 backup，使用同一
scenario 重新開始，將遺失 evidence 記為 incomplete。

## 8. 故障回復清單

本節的 status、restore、reset 與其他 recovery 命令尚未由本 controller 重演，均標為
`PENDING REHEARSAL`；執行時保留 stdout 與錯誤訊息。

### Setup / verify 失敗

**Do：** 確認 interpreter 是 3.11.x，依 OS 重跑 setup，再跑 verify；仍無法使用
時轉同 scenario fallback。**Why：** environment failure 不應被解讀成 energy
result。**Mechanism：** setup 不會自行下載 Python，也不會靜默改用其他 minor
version。**Expect：** 成功才有 `artifacts/verify-receipt.json` 的 `READY`。
**Interpret：** 沒有 READY 就不要在 Leo 記成 ready mode；選 labelled fallback。

### Policy guard 或 syntax failure

**Do：** 依錯誤訊息修正 UTF-8/LF、marker、allowed name、AST 或目前 active block。
**Why：** 保持 policy API 與 hash boundary。**Mechanism：** guard 只接受三個
marked blocks 與 bounded `choose_action(observation)`。**Expect：** 修正後可先用
`bash course.sh status` 查看 policy 狀態。**Interpret：** 不要改 runner、schemas、
scenario 或移除 guard。

### 需要查看或恢復 checkpoint

下列 recovery 命令：`PENDING REHEARSAL`。

POSIX：

```sh
bash course.sh status
bash course.sh restore --checkpoint lab-a-frozen
bash course.sh restore --checkpoint lab-b-frozen
bash course.sh restore --checkpoint lab-c-candidate
bash course.sh restore --checkpoint lab-c-frozen
bash course.sh reset-policy
```

Windows：

```bat
course.cmd status
course.cmd restore --checkpoint lab-a-frozen
course.cmd restore --checkpoint lab-b-frozen
course.cmd restore --checkpoint lab-c-candidate
course.cmd restore --checkpoint lab-c-frozen
course.cmd reset-policy
```

**Do：** 先用 `status` 找到可用 checkpoint，再只 restore 所需 role。**Why：**
恢復 active `student_policy.py` 而不覆寫既有 result、replay、receipt。**Mechanism：**
runner 會驗證 checkpoint、receipt、scenario、anchor、lock 與 policy hash，失敗時
回復原 active policy bytes。**Expect：** status/restore 印出 machine-readable JSON，
並標示 `artifacts_untouched: true`。**Interpret：** 若 checkpoint 不存在或 identity
不符，回到 release-default 或 matching fallback；不要從另一個 Lab 拼 policy。

### 缺少 result 或 run 失敗

保留已產生的 stdout 與錯誤訊息，依 exact case 選擇第 5 節 matching fallback pair。
不要執行 `_make-fallbacks`；那是 package 維護命令，不是課堂操作，也不要把
fallback 標成 `student-run`。

### Leo import 失敗

**Do：** 保留 importer error，核對 result、配對 replay、scenario ID、run ID、case、
policy SHA、receipt 與 source mode；仍不符時選 matching fallback pair。**Why：**
保持 all-or-nothing session boundary。**Mechanism：** importer 在 replay materialize
成功前不更新 session/workbook。**Expect：** 失敗匯入不會留下半筆 ledger 或半個 replay。
**Interpret：** 不手改 result/replay JSON，不上傳或執行 policy source。

### Workbook 遺失或 reopen 失敗

先使用已匯出的 workbook backup。若沒有 backup，從同一 scenario 重新開始，並把
缺少的 run/replay/evidence 標為 `INCOMPLETE`；不以預期 KPI 或螢幕截圖補造缺口。

## 9. 本 runbook 的來源與未完成證據

本 controller 讀取的 server source：

```text
/home/sat/leo-beam-sim/courseware/c120-lora-energy-lab/README.zh-TW.md
/home/sat/leo-beam-sim/courseware/c120-lora-energy-lab/setup.sh
/home/sat/leo-beam-sim/courseware/c120-lora-energy-lab/setup.cmd
/home/sat/leo-beam-sim/courseware/c120-lora-energy-lab/course.sh
/home/sat/leo-beam-sim/courseware/c120-lora-energy-lab/course.cmd
/home/sat/leo-beam-sim/courseware/c120-lora-energy-lab/verify_setup.py
/home/sat/leo-beam-sim/courseware/c120-lora-energy-lab/run_lab.py
/home/sat/leo-beam-sim/courseware/c120-lora-energy-lab/student_policy.py
/home/sat/leo-beam-sim/courseware/c120-lora-energy-lab/scenarios/c120-ntpu-energy-decision-01.json
/home/sat/leo-beam-sim/courseware/c120-lora-energy-lab/schemas/**
/home/sat/leo-beam-sim/contracts/c120-lora-v1/**
/home/sat/leo-beam-sim/src/course/c120/loraEnergySim/**
/home/sat/leo-beam-sim/src/course/c120/loraIntegration/**
```

package archive reference：

```text
/home/sat/leo-beam-sim/output/c120-course-package/c120-lora-energy-lab-v1.zip
SHA-256: ae887f751b93dbcbdb2289b0593fc2ccebed01da05e2e7034db0c24f692bf46e
Download: http://120.126.151.102:4192/c120-lora-energy-lab-v1.zip
Checksum: http://120.126.151.102:4192/c120-lora-energy-lab-v1.zip.sha256
```

`SERVER-SOURCE-VERIFIED` 與 `PACKAGE-HASH-VERIFIED` 不等於完整 classroom
acceptance。以下證據在本 controller 尚未完成，必須保留
`PENDING REHEARSAL`：

- release download、解壓、Python 3.11 venv、lock install 與 READY receipt 的
  fresh repetition；
- 十個 exact cases 的 fresh result、配對 endpoint replay、freeze receipt、
  policy SHA 與 consequential diff；
- Windows native／WSL fresh-run 對 Leo `/course` 的 READY/fallback 記錄、result
  import、endpoint replay materialize、run ledger 與 workbook export/reopen；
- server preview 以外的 browser pixel acceptance、Windows／WSL pixel evidence 與
  任何 numeric KPI。

在上述證據由 controller 重演並存檔前，講師可以依 package README 排演命令與
同 scenario recovery，但不應把它們口述為已完成的 live、measured、canonical
parity 或 classroom acceptance。

## 10. 官方 prerequisite 來源

本節只列官方文件；命令是否能在講師指定主機完成，仍須依本 runbook 的
`PENDING REHEARSAL` 標記留存實際 receipt 與錯誤訊息。

- [Python 3.11 on Windows](https://docs.python.org/3.11/using/windows.html)
- [uv installation](https://docs.astral.sh/uv/getting-started/installation/)
- [uv: installing and managing Python](https://docs.astral.sh/uv/guides/install-python/)
- [uv: using environments](https://docs.astral.sh/uv/pip/environments/)
- [Microsoft Learn: Install WSL](https://learn.microsoft.com/windows/wsl/install)
