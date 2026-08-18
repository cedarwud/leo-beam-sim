# C-120 module 1 source checkpoint (P001–P027)

Template: `/home/u24/ppt-master/template/educate.pptx`
Template SHA-256: `3a90b0106c6587d720b5a46c653a31937ccd649b30890563c70a53c4cc5d25b8`

The full authored source remains in `courseware/c120-lora-leo-deck/full-deck-v2-classroom-script.md`; this file is the module-1 extraction and evidence contract.

## P001 — 每一次 SEND、WAIT、SLEEP 都是能源決策

Evidence: VERIFIED
Visual: endpoint radio-state ribbon 與變動服務窗口
On-slide: policy → state time → packet/service → endpoint energy
SIMULATED TEACHING DATA

Commands: none (concept / boundary page)
Purpose: 先從 endpoint 的選擇開始，而不是先背衛星名詞。
Mechanism: SEND、WAIT、SLEEP 會改變 state 停留時間、封包結果與 service，最後才落到 endpoint energy ledger。
Expected: 預期：可以沿著 policy → state → packet/service → J 說出一條可追溯鏈。
Recovery: 若 claim 被擴大：停在 endpoint / system boundary；不可把模擬資料說成 live 或 measured。
Notes: 今天先不從衛星名詞開始。我們從一個 IoT endpoint 的選擇開始：現在送、短暫等待，或進入低功耗休眠。每個選擇會改變 radio state 停留時間、封包結果與服務，最後才在 endpoint energy ledger 中留下可追溯的 J。

## P002 — 節能是一條可檢驗的因果鏈

Evidence: VERIFIED
Visual: 六段箭頭流程圖
On-slide: observation → policy → action → state / packet → service → J

Commands: none (concept / boundary page)
Purpose: 先讀左邊的 observation，再談右邊的 J。
Mechanism: action 會改變等待、喚醒、處理、收發與封包結果；service gate 通過後，才比較累積能量。
Expected: 預期：每個箭頭都能回到 result 或 replay；只有動畫變化不算 evidence。
Recovery: 若 claim 被擴大：停在 endpoint / system boundary；不可把模擬資料說成 live 或 measured。
Notes: 請看箭頭，不要跳到最右邊。先有 observation，policy 才選 action；action 會改變等待、喚醒、處理、收發與封包結果；服務條件確認後，才談功率乘上時間累積出的 endpoint energy。

## P003 — LoRaEnergySim 為什麼直接服務智慧節能與 IoT

Evidence: VERIFIED
Visual: state／packet／energy 三層卡片
On-slide: 低功耗節點
封包與重試
睡眠／處理／TX／RX
可觀察結果

Commands: none (concept / boundary page)
Purpose: 用一個低功耗節點把抽象的節能選擇變成可觀察事件。
Mechanism: sleep、processing、transmit、receive、packet、collision、retry 與 energy 結果連在同一條 endpoint model。
Expected: 預期：能指出 action 會改哪一層，而不是只改小功率欄位。
Recovery: 若 claim 被擴大：停在 endpoint / system boundary；不可把模擬資料說成 live 或 measured。
Notes: 智慧節能不是只把功率欄位改小，而是讓裝置在工作與等待之間做出可解釋的取捨。相關模型把 sleep、processing、transmit、receive、packet、collision、retry 與 energy 結果連起來。

## P004 — LEO 只提供會改變的服務窗口

Evidence: VERIFIED
Visual: 一條 NTPU contact-window timeline
On-slide: 機會出現 → policy 選擇 → service / energy 取捨
LEO = example

Commands: none (concept / boundary page)
Purpose: 把 LEO 當成 changing service window 的例子。
Mechanism: 窗口會出現、消失、變短或變長，因此現在送或等一下會有不同 service 後果。
Expected: 預期：可以說明窗口如何改變 policy 選擇；不宣稱 live satellite measurement。
Recovery: 若 claim 被擴大：停在 endpoint / system boundary；不可把模擬資料說成 live 或 measured。
Notes: LEO 在這裡不是衛星工程課的終點，而是 changing service window 的例子。可服務的機會會出現、消失、變短或變長，讓現在送還是等一下變得可觀察。

## P005 — 兩層 evidence 不能互相冒充

Evidence: VERIFIED
Visual: endpoint replay 與 C-120 system replay 的分層圖
On-slide: endpoint layer：queue / packet / state / endpoint J
system layer：既有 C-120 authority

Commands: none (concept / boundary page)
Purpose: 先分清 endpoint layer 與 system layer 的責任。
Mechanism: 兩層可共享 scenario、clock 與 workbook，但欄位不能因名稱相似就互相改寫。
Expected: 預期：看到 endpoint J 時，能說出它不是 whole-system 或 wall-plug energy。
Recovery: 若 claim 被擴大：停在 endpoint / system boundary；不可把模擬資料說成 live 或 measured。
Notes: 左邊的 endpoint replay 可以回答封包、佇列、radio state、endpoint energy 與 endpoint service；右邊的 system replay 才承擔既有 C-120 canonical fields。

## P006 — 從預測走到可反駁的結果

Evidence: VERIFIED
Visual: predict → edit → run → import → replay → withheld 圓環
On-slide: 先寫預測，再執行
withheld case 不准 retune

Commands: none (concept / boundary page)
Purpose: 先留下可被結果推翻的 prediction，再開始操作。
Mechanism: 只改 marked block；baseline / candidate 結果要回到同一 scenario、seed 與 boundary。
Expected: 預期：withheld 只驗證 frozen policy；推翻的 prediction 也要保留。
Recovery: 若 claim 被擴大：停在 endpoint / system boundary；不可把模擬資料說成 live 或 measured。
Notes: 每個 lab 都先記下預期會變的 state time、packet outcome、service 或 endpoint J，再只改標記區塊，跑 baseline 與 candidate，匯入 result 看 replay，最後用 withheld case 檢驗。

## P007 — 一個小改動，必須能追到一個機制

Evidence: VERIFIED
Visual: student_policy.py marked block 卡片
On-slide: 只改 marked block
policy hash → result → replay

Commands: package root：student_policy.py
Purpose: 把每次修改縮成一個可追溯的控制點。
Mechanism: PACE、hold、batch 或 urgent margin 的變化，必須能連到 state、packet、service 或 energy evidence。
Expected: 預期：每個 diff 都有 policy hash 與 result lineage；沒有 consequential diff 就停。
Recovery: 若 claim 被擴大：停在 endpoint / system boundary；不可把模擬資料說成 live 或 measured。
Notes: 這張卡片只問一件事：你改的那一行透過哪個機制影響哪一筆 evidence？如果結果沒有 consequential diff，就記錄 gate 未通過，不用畫面效果替代。

## P008 — 今天的教學路徑

Evidence: VERIFIED
Visual: 十個節點的路徑圖
On-slide: why → setup → endpoint model → anchor → A → B → recovery → C → evidence → transfer

Commands: none (concept / boundary page)
Purpose: 這是一張路線圖，不是倒數計時器。
Mechanism: setup、endpoint model、labs、workbook 與 transfer 沿著同一 scenario 前進；受阻時走 recovery 分支。
Expected: 預期：知道現在在哪一個 gate，以及下一個可觀察 receipt。
Recovery: 若 claim 被擴大：停在 endpoint / system boundary；不可把模擬資料說成 live 或 measured。
Notes: 先把工具與場景的關係講清楚，再完成能回復的 setup；接著建立 endpoint state 與服務邊界的共同語言，最後把機制轉到其他 IoT 場景。

## P009 — 開場檢查點：先確認 claim 邊界

Evidence: VERIFIED
Visual: 四層 claim ladder
On-slide: course-packaged simulated endpoint-energy lab
NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED

Commands: none (concept / boundary page)
Purpose: 先把能說與不能說的範圍放在同一張圖。
Mechanism: course-owned、deterministic、simulated 的 endpoint lab 不等於 live telemetry、量測結果或 canonical parity。
Expected: 預期：看到未凍結 URL、畫面或 KPI 時，用 placeholder 保留缺口。
Recovery: 若 claim 被擴大：停在 endpoint / system boundary；不可把模擬資料說成 live 或 measured。
Notes: 在進入命令前，我們先把能說什麼與不能說什麼放在同一張圖。這是 course-owned、deterministic、simulated 的 endpoint energy lab，不是 live telemetry、量測結果或 canonical parity 通過。

## P010 — 套件根目錄是一條 provenance 邊界

Evidence: VERIFIED LOCAL ARTIFACT
Visual: lora-energy-lab/ 資料夾樹
On-slide: README
setup.sh / setup.cmd
course.sh / course.cmd
student_policy.py
lora_energy_lab/
scenarios/
schemas/

Commands: 解壓後：cd lora-energy-lab; POSIX：find . -maxdepth 2 -type f; Windows：Get-ChildItem -Recurse -File
Purpose: 先確認 local artifact 解壓後只有一個 reviewed package root。
Mechanism: README、setup、launcher、policy、Python module、scenario 與 schemas 必須來自同一份 bytes；根目錄錯就停止。
Expected: 預期 receipt：single root；inventory 可看到 lora_energy_lab、scenario 與 schemas。
Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。
Notes: local artifact 已凍結為 121,139 bytes；解壓後仍不要從不同 branch 拼檔案，先確認 root 與必要檔案。

## P011 — 先核對 local artifact，再等待公開 release

Evidence: VERIFIED LOCAL ARTIFACT
Visual: local ZIP、SHA-256 與公開 release placeholder
On-slide: 檔案：lora-energy-lab-v1.zip｜121,139 bytes
SHA-256：047e8459988d8bee59fbfdcc39189e00048f3697968901ce5b6e5363dc9e8c8c
公開 URL：RELEASE_ASSET_PENDING

Commands: ls -l ~/lora-energy-lab-v1.zip; sha256sum ~/lora-energy-lab-v1.zip; # public URL: RELEASE_ASSET_PENDING
Purpose: 先使用 verified local artifact；公開 URL 尚未發布前不把網路下載當成已驗證。
Mechanism: sha256sum 驗證 local bytes identity，不是 energy evidence；公開 release 另行等待 owner。
Expected: 預期 receipt：121139 bytes；hash = 047e8459…e8c8；public URL = RELEASE_ASSET_PENDING。
Recovery: local hash 不符：停止並重新取得 owner 指定檔案；公開 URL 未發布：保留 placeholder，不改用舊 URL 或其他 branch。
Notes: local ZIP 已核對為 121,139 bytes，SHA-256 為 047e8459988d8bee59fbfdcc39189e00048f3697968901ce5b6e5363dc9e8c8c。這是 local artifact 證據，不擴張成公開 GitHub Release 已可下載。

## P012 — Windows 原生先確認 shell 與 launcher

Evidence: IMPLEMENTED / NOT VERIFIED
Visual: CMD 與 PowerShell 的提示字元對照卡
On-slide: CMD：C:\...> py --list
PowerShell：PS C:\...> py -3.11 --version
不要因為 python 指到其他版本就繼續

Commands: CMD> py --list; PS C:\...> py -3.11 --version
Purpose: 先辨識 prompt，再確認 Python Launcher 看得到 3.11。
Mechanism: CMD 與 PowerShell 的環境變數寫法不同；3.11.x 才符合 runner minor-version 邊界。
Expected: 預期 receipt：PLACEHOLDER｜Windows native clean run 尚未驗證。
Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。
Notes: 如果畫面開頭是 C:\...>，我們在 CMD；如果是 PS C:\...>，我們在 PowerShell。先執行 py --list，再執行 py -3.11 --version；看到 3.11.x 才進入 setup。

## P013 — 沒有 Python 3.11 時的 Windows 安裝路徑

Evidence: IMPLEMENTED / NOT VERIFIED
Visual: Python 3.11 installer → launcher → version check
On-slide: https://www.python.org/downloads/windows/
Python 3.11.x / Windows installer (64-bit)
安裝 Python Launcher
重新開啟 shell → py --list

Commands: 開啟：https://www.python.org/downloads/windows/; 安裝後：py --list; 確認：py -3.11 --version
Purpose: 缺少 3.11 時走官方 Windows installer 路徑。
Mechanism: 保留 Python Launcher；重新開 shell 後再確認 minor version，不修改 lock。
Expected: 預期 receipt：PLACEHOLDER｜clean install 尚未驗證；成功時列出 Python 3.11.x。
Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。
Notes: 如果 py --list 沒有 3.11，開啟畫面上的官方 Windows 下載頁，選 Python 3.11.x 的 64-bit installer 並保留 Python Launcher。完成後關閉再開 shell，重跑 py --list 與 py -3.11 --version。

## P014 — uv 是 Python 3.11 的 recovery 工具

Evidence: IMPLEMENTED / NOT VERIFIED
Visual: 三行 PowerShell command ribbon
On-slide: uv = exact interpreter recovery

Commands: winget install --id=astral-sh.uv -e; uv python install 3.11; uv python find 3.11
Purpose: 當 launcher 找不到 3.11，用 uv 取得 exact interpreter。
Mechanism: uv python find 3.11 回傳 interpreter path；它只用來建立 package-local .venv。
Expected: 預期 receipt：PLACEHOLDER｜uv fresh setup 尚未驗證；成功時回傳實際 path。
Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。
Notes: 當 launcher 找不到 3.11，可以用 uv 取得 exact interpreter。先裝 uv，再跑 uv python install 3.11 與 uv python find 3.11；如果仍找不到，保留錯誤走 fallback。

## P015 — Windows 用 package-local .venv

Evidence: IMPLEMENTED / NOT VERIFIED
Visual: system Python 與 .venv\Scripts\python.exe 的隔離圖
On-slide: system Python ≠ package .venv
不要共享 WSL .venv

Commands: PS> Get-ChildItem .venv\Scripts\python.exe; PS> .\.venv\Scripts\python.exe --version
Purpose: 確認 Windows interpreter 落在 package-local venv。
Mechanism: 系統 Python 與 package .venv 隔離 dependency graph；不能拿 WSL 的 .venv/bin/python。
Expected: 預期 receipt：PLACEHOLDER｜Windows path clean run 尚未驗證；成功時顯示 Python 3.11.x。
Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。
Notes: 隔離環境讓 runner 的 dependency graph 不受其他專案污染。Windows interpreter 應落在 .venv\Scripts\python.exe，不能拿 WSL 的 .venv/bin/python 來用。

## P016 — Windows 執行 setup 與 verify

Evidence: IMPLEMENTED / NOT VERIFIED
Visual: PowerShell command 與 READY receipt 的左右箭頭
On-slide: setup：建立 .venv + 依 lock 安裝
verify：檢查 Python、wrapper、lock、policy API、scenario identity

Commands: $env:PYTHON_BIN = "py -3.11"; .\setup.cmd; .\course.cmd verify
Purpose: 在 package root 以 Windows launcher 建立環境並跑 verify。
Mechanism: setup 產生隔離 interpreter；verify 只在契約與 identity 通過後回 READY。
Expected: 預期 receipt：READY / PLACEHOLDER；Windows native command 與 receipt 尚未 clean-run。
Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。
Notes: 在 package root 的 PowerShell，先設定 PYTHON_BIN，再執行 .\setup.cmd，完成後執行 .\course.cmd verify。畫面保留 READY / PLACEHOLDER，因為 Windows native command 尚未 clean-run。

## P017 — WSL 先確認它真的是 Ubuntu shell

Evidence: IMPLEMENTED / NOT VERIFIED
Visual: PowerShell 安裝／清單與 Ubuntu pwd / uname -a 雙視窗
On-slide: PowerShell（系統管理員）：wsl --install -d Ubuntu
Ubuntu：pwd / uname -a
不要混用 .venv

Commands: PowerShell（系統管理員）：wsl --install -d Ubuntu; PowerShell：wsl -l -v; Ubuntu：pwd && uname -a
Purpose: 先辨識 Windows host 與 Ubuntu guest 的 shell / path。
Mechanism: 看見 Linux home path 才使用 setup.sh；Windows setup.cmd 不在 WSL 執行。
Expected: 預期 receipt：PLACEHOLDER｜WSL install / identity 尚未 clean-run。
Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。
Notes: WSL 是另一個 shell 與檔案環境。先用 wsl -l -v 確認 Ubuntu，進入後跑 pwd 與 uname -a；如果看到 Linux home path，才使用 setup.sh。

## P018 — WSL 安裝工具與 uv

Evidence: IMPLEMENTED / NOT VERIFIED
Visual: apt → curl → uv → Python 3.11 階梯
On-slide: WSL toolchain

Commands: sudo apt update; sudo apt install -y curl unzip; curl -LsSf https://astral.sh/uv/install.sh | sh; uv --version && uv python find 3.11
Purpose: 在 Ubuntu shell 補齊 curl、unzip 與 uv。
Mechanism: 這些命令只準備 exact interpreter；不會產生 course result。
Expected: 預期 receipt：PLACEHOLDER｜WSL installer / uv 尚未 clean-run；成功時回傳 uv 版本與 interpreter path。
Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。
Notes: 在 Ubuntu shell 先更新套件索引並安裝 curl、unzip，再依 installer 安裝 uv。重新開 shell 後跑 uv --version、uv python install 3.11 與 uv python find 3.11。

## P019 — WSL 解壓與建立 .venv

Evidence: IMPLEMENTED / NOT VERIFIED
Visual: /mnt/c/... → ~/lora-course/ → package root
On-slide: Windows Downloads → WSL Linux home → package-local .venv

Commands: cp /mnt/c/.../lora-energy-lab-v1.zip ~/; unzip lora-energy-lab-v1.zip; cd lora-energy-lab; PYTHON_BIN=python3.11 bash setup.sh; bash course.sh verify
Purpose: 把 owner 指定的 release 複製到 WSL Linux home，再在 package root 建立 WSL 專用 venv。
Mechanism: Windows 與 WSL venv 不可互換；setup 後同一個 shell 執行 verify。
Expected: 預期 receipt：PLACEHOLDER｜release 與 WSL setup / verify 尚未 clean-run；成功時回 READY。
Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。
Notes: release asset 尚未指定，所以畫面保留 RELEASE_ASSET_PENDING。收到正式 asset 後，從 /mnt/c/Users/<YourName>/Downloads/ 複製到 WSL Linux home，再在 package root 建立 WSL 專用的 .venv/bin/python。

## P020 — POSIX runner 的最小入口

Evidence: IMPLEMENTED / NOT VERIFIED
Visual: POSIX command pair
On-slide: POSIX shell：setup → verify

Commands: PYTHON_BIN=python3.11 bash setup.sh; bash course.sh verify
Purpose: Linux 或 macOS 以同一個 gate 驗證 package-local environment。
Mechanism: POSIX launcher 雖不同於 Windows / WSL，仍要檢查 venv、lock、policy API、scenario 與 claim boundary。
Expected: 預期 receipt：PLACEHOLDER｜POSIX clean run 尚未驗證；成功時回 READY。
Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。
Notes: 在 Linux 或 macOS 的 POSIX shell，先以 PYTHON_BIN=python3.11 bash setup.sh 指定 interpreter，再以 bash course.sh verify 做同一份 gate。

## P021 — READY receipt 是下一步的入場券

Evidence: PLACEHOLDER
Visual: machine-readable receipt 欄位放大卡
On-slide: status: READY
Python 3.11.9
scenario_id: ntpu-energy-decision-01
policy_api_version: lora-energy-policy-v1
engine_mode: coherent-course-simulated-adapter

Commands: bash course.sh verify; Windows：.\course.cmd verify
Purpose: 把 READY 當成環境與契約 gate，不把它當成實驗結果。
Mechanism: receipt 要同時帶 Python、scenario、policy API、lock、engine mode 與 claim boundary。
Expected: 預期：PLACEHOLDER｜缺欄位、版本不符或不同 scenario 都是 fail。
Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。
Notes: 請在 receipt 中找 status、Python version、scenario identity、policy API、lock、engine mode 與 claim boundary。READY 只表示可以進入 runner，不表示完成任何節能實驗。

## P022 — setup 失敗不等於 energy result

Evidence: VERIFIED
Visual: READY 與 RECOVERABLE ERROR 的分叉牌
On-slide: 讀錯誤 → 修最小邊界
無法完成 → same-scenario fallback

Commands: bash course.sh verify; 失敗時：保留原始 stdout / stderr
Purpose: 先修 Python minor、package root、lock 或 scenario 目前指出的最小問題。
Mechanism: 若仍無法建立 READY，轉同 scenario fallback；source mode 要標示 fallback。
Expected: 預期：RECOVERABLE ERROR receipt 不得被改寫成 READY；fallback 仍保留相同學習問題。
Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。
Notes: 如果 setup 或 verify 出現錯誤，先確認 Python minor、package root、lock 與 scenario，只修目前 gate 指出的最小問題。若仍無法建立 READY，就選同 scenario fallback，並記錄 source mode。

## P023 — 可編輯檔案只有一個

Evidence: VERIFIED
Visual: student_policy.py 與四個鎖頭
On-slide: 只編輯 marked blocks
scenario / schemas / runner / generated JSON = read-only

Commands: POSIX：sed -n '1,220p' student_policy.py; Windows：Get-Content .\student_policy.py; git diff -- student_policy.py
Purpose: 把 policy edit 與 runner / schema / generated artifact 分開。
Mechanism: policy hash、predecessor 與 freeze receipt 才能解釋結果；release bytes 不同就停止編輯。
Expected: 預期：diff 只出現在 marked blocks；其他檔案保持 read-only。
Recovery: policy guard 或 syntax 失敗：只修 marked block 的最小行；不要改 runner、schema 或 generated JSON。
Notes: 在整個實驗中，我們只改 student_policy.py 的 marked blocks。不要改 upstream framework、scenario、schema、runner、Leo code 或 generated JSON；檔案與 release 不同就回到 package identity。

## P024 — policy API 的輸入是現在能觀察到的事

Evidence: PLACEHOLDER
Visual: observation card → legal action card
On-slide: observation
choose_action(...)
WAIT / SLEEP / SEND_ONE / SEND_URGENT / FLUSH_BATCH

Commands: bash course.sh verify; Windows：.\course.cmd verify
Purpose: 先說明 policy 可以讀什麼，再說明它回傳哪個合法 action。
Mechanism: policy 不能偷看 future quality、future energy 或 result summary；action 必須在契約內。
Expected: 預期：PLACEHOLDER｜verify 通過時只接受 legal action；不合法 action 先 fail closed。
Recovery: policy guard 或 syntax 失敗：只修 marked block 的最小行；不要改 runner、schema 或 generated JSON。
Notes: policy 只能依當下允許的 observation 做選擇，不能偷看未來品質、future energy 或 result summary，也不能回傳契約外的 action。

## P025 — Python survival：常數是受控旋鈕

Evidence: PLACEHOLDER
Visual: 一行斜體常數與範圍護欄
On-slide: PACE_GAP_STEPS
REST_DURING_GAP
BATCH_SIZE
URGENT_MARGIN_S
bounded values only

Commands: grep -n PACE_GAP_STEPS student_policy.py; bash course.sh verify
Purpose: 只讀懂變數名稱、等號與允許值，不把變數當成直接 energy knob。
Mechanism: runner 會檢查 bounded range；每次只改一個常數，先預測 state、queue 或 service。
Expected: 預期：PLACEHOLDER｜bounded values accepted；實際 release line number 不凍結。
Recovery: policy guard 或 syntax 失敗：只修 marked block 的最小行；不要改 runner、schema 或 generated JSON。
Notes: 這裡只需要讀懂變數名稱、等號和允許值。斜體顯示的變數是 policy 控制點；runner 會檢查 bounded range，實際 release line number 尚未凍結。

## P026 — Python survival：條件只處理當前 observation

Evidence: PLACEHOLDER
Visual: if / elif / else 的三叉決策樹
On-slide: 現在看到的條件 → 一個 legal action
不要讀 future outcome

Commands: POSIX：grep -n 'def choose_action' student_policy.py; bash course.sh verify
Purpose: 閱讀每個 Boolean condition 實際讀取的 observation。
Mechanism: 每個分支只回傳一個 legal action；條件成立會觸發不同 state 或 packet 行為。
Expected: 預期：PLACEHOLDER｜policy guard / verify 接受合法分支；非 marked 區域錯誤要保留。
Recovery: policy guard 或 syntax 失敗：只修 marked block 的最小行；不要改 runner、schema 或 generated JSON。
Notes: 看一個 Boolean 條件時，先圈出它讀的是哪個 observation，再指出每個分支會回傳什麼 action。若 syntax 或名稱錯誤，修 marked block 的最小行，不碰 runner。

## P027 — Python survival：縮排與 return

Evidence: PLACEHOLDER
Visual: 三行縮排示意與 action token
On-slide: choose_action(observation)
return WAIT
return SLEEP
return SEND_ONE

Commands: python -m py_compile student_policy.py; py -3.11 -m py_compile student_policy.py; bash course.sh verify
Purpose: 用最小 Python 檢查確認縮排、return 與 action token。
Mechanism: 縮排決定條件屬於哪個分支；return 決定 runner 收到哪個 action。
Expected: 預期：PLACEHOLDER｜compile exit code 0，再由 verify 檢查 policy API。
Recovery: policy guard 或 syntax 失敗：只修 marked block 的最小行；不要改 runner、schema 或 generated JSON。
Notes: 縮排決定條件屬於哪個分支，return 決定 runner 收到哪個 action。若錯誤指向 marked line，只修該行並重新做 policy guard；若指向非 marked 區域，保留錯誤走 recovery。
