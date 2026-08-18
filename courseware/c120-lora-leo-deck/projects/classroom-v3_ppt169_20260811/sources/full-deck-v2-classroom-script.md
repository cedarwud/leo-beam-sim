# C-120《智慧節能與物聯網應用》可直接授課逐頁腳本

版本：`v2-classroom-script`；頁數：108；用途：講師可直接投影、操作、朗讀。

## 使用契約

- 每頁只有一個主視覺或一個操作物件；畫面只留足以支撐口語的必要字句。
- 標題一律 28pt；正文預設 24pt。中文字型為標楷體；英文、數字與命令為 Times New Roman。
- 變數與公式以斜體呈現；一般說明用正體。公式頁另附 `LaTeX source`，畫面使用可編輯的 Office Math 或向量 fallback。
- 使用 `/home/u24/ppt-master/template/educate.pptx` 的原生 master、layout、主題色與背景；不新增投影片背景填色，也不放置底部 footer。
- `VERIFIED` 只表示目前有可追溯證據；`IMPLEMENTED NOT VERIFIED` 表示來源與程式已存在但尚未完成相應的乾淨實機排演；`PLACEHOLDER` 表示不得捏造的 release、命令、畫面、行號或數字。
- 畫面與講稿不使用固定問答框架。講稿依頁面採「先看什麼、做什麼、會改變哪個機制、證據如何回應、失敗如何回復」等自然敘事。
- 不把 endpoint replay 的模擬資料說成 live、measured、whole-system 或 canonical parity。LEO 只用來示範 changing service window。

## 頁面索引

| 範圍 | 章節 |
|---:|---|
| 01–09 | 開場：LoRaEnergySim、智慧節能與 IoT、LEO 的位置 |
| 10–27 | 取得套件、Windows 原生、WSL、Python 3.11、uv 與 `.venv` |
| 28–38 | endpoint 狀態、封包、服務邊界、公式與 provenance |
| 39–50 | Lab A：pace / rest |
| 51–63 | Lab B：enter / exit / hold |
| 64–76 | Lab C：batch / urgent |
| 77–88 | Leo import、replay、workbook、fallback 與 mismatch recovery |
| 89–96 | evidence clinic、跨場域轉移、假說與退出 |
| 97–108 | 快速分支、故障復原與技術附錄 |

---

## P001 — 每一次 SEND、WAIT、SLEEP 都是能源決策

Layout: cover hero
Evidence: VERIFIED
On-slide: `policy → state time → packet/service → endpoint energy`；`SIMULATED TEACHING DATA`。
Visual: endpoint radio-state ribbon 與一個變動服務窗口。
Notes: 今天先不從衛星名詞開始。我們從一個 IoT endpoint 的選擇開始：現在送、短暫等待，或進入低功耗休眠。每個選擇會改變 radio state 停留時間、封包結果與服務，最後才在 endpoint energy ledger 中留下可追溯的 J。這堂課要做的是把一個小小的 policy edit 走完一條證據鏈，而不是背一個漂亮的數字。
Recovery: 若 claim 被擴大，停在分層圖，回到 endpoint/system boundary；不可把模擬資料說成 live 或 measured。

## P002 — 節能是一條可檢驗的因果鏈

Layout: causal flow
Evidence: VERIFIED
On-slide: `observation → policy → action → state / packet → service → J`。
Visual: 六段箭頭流程圖。
Notes: 請看箭頭，不要跳到最右邊。先有已經發生的 observation，policy 才選 action；action 會改變等待、喚醒、處理、收發與封包結果；服務條件確認後，才談功率乘上時間累積出的 endpoint energy。每一步都能回到 result 或 replay。若只看到動畫變化，卻沒有 state、packet、service 或 energy 的差異，我們就不能稱為節能證據。
Recovery: 若 claim 被擴大，停在分層圖，回到 endpoint/system boundary；不可把模擬資料說成 live 或 measured。

## P003 — LoRaEnergySim 為什麼直接服務智慧節能與 IoT

Layout: scope map
Evidence: VERIFIED
On-slide: `低功耗節點`、`封包與重試`、`睡眠／處理／TX／RX`、`可觀察結果`。
Visual: IoT endpoint 的 state／packet／energy 三層卡片。
Notes: 智慧節能不是只把功率欄位改小，而是讓裝置在工作與等待之間做出可解釋的取捨。LoRaEnergySim 的相關模型正好把 endpoint 的 sleep、processing、transmit、receive、packet、collision、retry 與 energy 結果連起來；因此它能支援 IoT 的決策教學。課程 wrapper 會把這個機制縮成可重現的課程場景，不要求大家安裝研究型全套工具。
Recovery: 若 claim 被擴大，停在分層圖，回到 endpoint/system boundary；不可把模擬資料說成 live 或 measured。

## P004 — LEO 只提供會改變的服務窗口

Layout: hero timeline
Evidence: VERIFIED; DONOR-REWRITE：BeamShift donor slides 2, 4–6 的 changing service window，改寫成 endpoint-first IoT example。
On-slide: `機會出現 → policy 選擇 → service / energy 取捨`；`LEO = example`。
Visual: 一條 NTPU contact-window timeline。
Notes: LEO 在這裡不是衛星工程課的終點。它提供一個很直觀的 changing service window：可服務的機會會出現、消失、變短或變長。這種變動能讓「現在送還是等一下」變得可觀察；同一個機制也能轉到智慧農場的上行窗口、HVAC 的低負載時段或邊緣設備的可用連線。請把 LEO 當成例子，不要把課程 claim 擴張成 live satellite measurement。
Recovery: 若 claim 被擴大，停在分層圖，回到 endpoint/system boundary；不可把模擬資料說成 live 或 measured。

## P005 — 兩層 evidence 不能互相冒充

Layout: split compare
Evidence: VERIFIED
On-slide: `endpoint layer：queue / packet / state / endpoint J`；`system layer：既有 C-120 authority`。
Visual: endpoint replay 與 C-120 system replay 的分層圖。
Notes: 左邊的 endpoint replay 可以回答封包、佇列、radio state、endpoint energy 與 endpoint service；右邊的 system replay 才承擔既有 C-120 的 canonical fields。兩層可以共享 scenario、clock 和 workbook，但欄位不能因為名稱相似就互相改寫。今天看到的 endpoint J 必須留在 endpoint layer；它不是整個部署、衛星或 wall-plug energy。
Recovery: 若 claim 被擴大，停在分層圖，回到 endpoint/system boundary；不可把模擬資料說成 live 或 measured。

## P006 — 從預測走到可反駁的結果

Layout: loop diagram
Evidence: VERIFIED
On-slide: `先寫預測，再執行`；`withheld case 不准 retune`。
Visual: `predict → edit → run → import → replay → withheld` 圓環。
Notes: 每個 lab 都遵循這條學習路徑，但每一頁會換一種畫面，不會把它變成固定問答。先記下你預期哪個 state time、packet outcome、service 或 endpoint J 會變；再只改標記區塊；接著跑 baseline 與 candidate，匯入 result 看 replay，最後用沒有調參的 withheld case 檢驗假說。預測被推翻時，保留它，因為那就是最有用的教學結果。
Recovery: 若 claim 被擴大，停在分層圖，回到 endpoint/system boundary；不可把模擬資料說成 live 或 measured。

## P007 — 一個小改動，必須能追到一個機制

Layout: single annotated card
Evidence: VERIFIED
On-slide: `只改 marked block`；`policy hash → result → replay`。
Visual: `student_policy.py` 的 marked block 卡片。
Notes: 這張卡片只問一件事：你改的那一行，透過哪個機制影響哪一筆 evidence？例如把 pace gap 拉長，可能改變等待、喚醒與封包時機；提高 hold 穩定門檻，可能拒絕短暫品質尖峰；調整 batch 或 urgent margin，可能改變佇列年齡與 deadline 結果。若改動無法連到這些事件，就先不要跑；若結果沒有 consequential diff，就記錄 gate 未通過，不用畫面效果替代。
Recovery: 若 claim 被擴大，停在分層圖，回到 endpoint/system boundary；不可把模擬資料說成 live 或 measured。

## P008 — 今天的教學路徑

Layout: route map
Evidence: VERIFIED
On-slide: `why → setup → endpoint model → anchor → A → B → recovery → C → evidence → transfer`。
Visual: 十個節點的路徑圖。
Notes: 這張是路線圖，不是倒數計時器。先把工具與場景的關係講清楚，再完成能回復的 setup；接著建立 endpoint state 與服務邊界的共同語言，逐一跑三個 labs，保存 workbook，最後把機制轉到其他 IoT 場景。若某個節點受阻，沿著同一場景的 recovery 分支回來，不切換成另一個學習問題。
Recovery: 若 claim 被擴大，停在分層圖，回到 endpoint/system boundary；不可把模擬資料說成 live 或 measured。

## P009 — 開場檢查點：先確認 claim 邊界

Layout: claim shield
Evidence: VERIFIED
On-slide: `course-packaged simulated endpoint-energy lab`；`NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED`。
Visual: 四層 claim ladder。
Notes: 在進入命令前，我們先把能說什麼與不能說什麼放在同一張圖。這是 course-owned、deterministic、simulated 的 endpoint energy lab；不是 live telemetry，不是量測結果，也不是 canonical parity 通過。這個邊界不是警語而已，它會出現在 result、replay、Leo import 與 workbook provenance。之後若看見未凍結的 URL、畫面或 KPI，我們用 placeholder 保留缺口。
Recovery: 若 claim 被擴大，停在分層圖，回到 endpoint/system boundary；不可把模擬資料說成 live 或 measured。

## P010 — 套件根目錄是一條 provenance 邊界

Layout: folder anatomy
Evidence: VERIFIED（server ZIP inventory：single root、65 files）
On-slide: `README`、`setup.sh / setup.cmd`、`course.sh / course.cmd`、`student_policy.py`、`schemas/`。
Visual: `c120-lora-energy-lab/` 資料夾樹。
Notes: 拿到 release 後，不要從不同 branch 拼檔案。Server 上目前的 ZIP inventory 已驗證為單一 `c120-lora-energy-lab/` 根目錄與 65 個檔案，包含說明、setup、launcher、policy、fallback 與 schemas。解壓後請確認仍是這個單一根目錄；這樣 runner、policy、scenario 與驗證契約才來自同一份 reviewed bytes。根目錄不對、必要檔案缺失，先停在 provenance gate。
Recovery: 若 shell、版本、lock 或 receipt 不符，保留錯誤並回到 setup gate；仍受阻就使用同 scenario fallback。

## P011 — 下載指定 archive，先核對 identity

Layout: checksum card
Evidence: VERIFIED（server bytes、checksum、listener 與 controller public GET）
On-slide: `http://120.126.151.102:4192/c120-lora-energy-lab-v1.zip`；`http://120.126.151.102:4192/c120-lora-energy-lab-v1.zip.sha256`；`SHA-256：ae887f751b93dbcbdb2289b0593fc2ccebed01da05e2e7034db0c24f692bf46e`。
Visual: ZIP 與 SHA-256 檔案的相鄰卡片。
Notes: 請只從畫面上的兩個 URL 取得同名 ZIP 與 checksum。Linux 用 `sha256sum -c c120-lora-energy-lab-v1.zip.sha256`，macOS 用 `shasum -a 256` 後逐字比較，Windows PowerShell 用 `Get-FileHash .\\c120-lora-energy-lab-v1.zip -Algorithm SHA256`，再與畫面上的 64 位 hash 比對。這一步保護的是 artifact identity，不是 energy evidence。2026-08-11 controller 已從公開 URL 完整下載 115,697-byte ZIP 與 checksum，`sha256sum -c`、`unzip -t` 與單一根目錄 65-item inventory 均通過；仍不把 controller 網路通過擴張成所有教室網路均已驗證。hash 不符就停止，不改用相似 archive。
Recovery: URL 無法下載時先保留錯誤並確認教室網路能連到 `120.126.151.102:4192`；checksum 不符或必要檔案缺失時停止，重新取得同一個 owner 指定 archive，不從其他 branch 拼檔。

## P012 — Windows 原生先確認 shell 與 launcher

Layout: split shell
Evidence: IMPLEMENTED NOT VERIFIED
On-slide: `C:\...>` → `py -3.11`；`PS C:\...>` → `.\setup.cmd`。
Visual: CMD 與 PowerShell 的提示字元對照卡。
Notes: 如果畫面開頭是 `C:\...>`，我們在 CMD；如果是 `PS C:\...>`，我們在 PowerShell。兩者都能使用 Python Launcher，但環境變數寫法不同。先執行 `py --list`，再執行 `py -3.11 --version`。看到 Python 3.11.x 才進入 setup；不要因為 `python` 指向另一個版本就繼續。
Recovery: 若 shell、版本、lock 或 receipt 不符，保留錯誤並回到 setup gate；仍受阻就使用同 scenario fallback。

## P013 — 沒有 Python 3.11 時的 Windows 安裝路徑

Layout: recovery ladder
Evidence: IMPLEMENTED NOT VERIFIED（official Windows download path；clean install pending）
On-slide: `https://www.python.org/downloads/windows/`；`Python 3.11.x / Windows installer (64-bit)`；`安裝 Python Launcher`；`重新開啟 shell → py --list`。
Visual: Python 3.11 installer → launcher → version check。
Notes: 如果 `py --list` 沒有 3.11，請開啟畫面上的 Python 官方 Windows 下載頁，選擇 Python 3.11.x 的 64-bit installer；安裝時保留 Python Launcher。完成後關閉再開 CMD 或 PowerShell，重跑 `py --list` 與 `py -3.11 --version`。這不是把最新版本硬塞進課程，而是建立 runner 預期的 minor-version 邊界。若 installer、PATH 或 launcher 仍失敗，改用下一頁的 uv recovery；不修改 lock。
Recovery: 若 shell、版本、lock 或 receipt 不符，保留錯誤並回到 setup gate；仍受阻就使用同 scenario fallback。

## P014 — uv 是 Python 3.11 的 recovery 工具

Layout: terminal command ribbon
Evidence: IMPLEMENTED NOT VERIFIED
On-slide: `winget install --id=astral-sh.uv -e`；`uv python install 3.11`；`uv python find 3.11`。
Visual: 三行 PowerShell command ribbon。
Notes: 當 launcher 找不到 3.11，我們可以用 uv 取得 exact interpreter。先裝 uv，再跑 `uv --version`，接著 `uv python install 3.11` 與 `uv python find 3.11`。最後一行要回傳實際 interpreter path；它只用來建立這份 package 的 `.venv`。如果 uv 仍找不到，保留錯誤，走 fallback；不要把 uv recovery 說成已完成的 fresh setup。
Recovery: 若 shell、版本、lock 或 receipt 不符，保留錯誤並回到 setup gate；仍受阻就使用同 scenario fallback。

## P015 — Windows 用 package-local `.venv`

Layout: environment split
Evidence: VERIFIED
On-slide: `system Python ≠ course .venv`；`不要共享 WSL .venv`。
Visual: system Python 與 `.venv\Scripts\python.exe` 的隔離圖。
Notes: 隔離環境讓這份 runner 的 dependency graph 不受其他專案污染，也讓錯誤能從 package root 回復。Windows 的 interpreter 應落在 `.venv\Scripts\python.exe`，不能拿 WSL 的 `.venv/bin/python` 來用。正常上課不必 activate；launcher 會優先找 package-local venv。需要診斷時才執行 `.\.venv\Scripts\python.exe --version`。
Recovery: 若 shell、版本、lock 或 receipt 不符，保留錯誤並回到 setup gate；仍受阻就使用同 scenario fallback。

## P016 — Windows 執行 setup 與 verify

Layout: command-to-receipt
Evidence: IMPLEMENTED NOT VERIFIED
On-slide: `$env:PYTHON_BIN = "py -3.11"`；`.\setup.cmd`；`.\course.cmd verify`；`READY / PLACEHOLDER`。
Visual: PowerShell command 與 READY receipt 的左右箭頭。
Notes: 在 package root 的 PowerShell，先設定 `$env:PYTHON_BIN = "py -3.11"`，再執行 `.\setup.cmd`，完成後執行 `.\course.cmd verify`。setup 的作用是建立 venv 並依 lock 安裝；verify 的作用是檢查 Python、wrapper、lock、policy API 和 scenario identity。預期是 machine-readable `READY` receipt；目前 Windows native command 與 receipt 尚未 clean-run，所以只把 `READY / PLACEHOLDER` 留在畫面。版本或 identity 失敗就停在這一 gate。
Recovery: 若 shell、版本、lock 或 receipt 不符，保留錯誤並回到 setup gate；仍受阻就使用同 scenario fallback。

## P017 — WSL 先確認它真的是 Ubuntu shell

Layout: shell identity
Evidence: IMPLEMENTED NOT VERIFIED
On-slide: `PowerShell (系統管理員)：wsl --install -d Ubuntu`；`wsl -l -v`；`Ubuntu：pwd`；`uname -a`；`不要混用 .venv`。
Visual: PowerShell 安裝／清單與 Ubuntu `pwd / uname -a` 的雙視窗。
Notes: WSL 是另一個 shell 與檔案環境。尚未安裝時，在系統管理員 PowerShell 執行 `wsl --install -d Ubuntu`，依 Windows 提示重新啟動並完成 Ubuntu 使用者設定；已安裝時先用 `wsl -l -v` 確認 Ubuntu。進入 Ubuntu 後再執行 `pwd` 與 `uname -a`。如果看到 Linux home 路徑，才使用 `setup.sh`；Windows 端的 `setup.cmd` 不要在這裡執行。先辨識環境，才能讓後面的 path、venv 和 recovery 可信。
Recovery: 若 shell、版本、lock 或 receipt 不符，保留錯誤並回到 setup gate；仍受阻就使用同 scenario fallback。

## P018 — WSL 安裝工具與 uv

Layout: toolchain ladder
Evidence: IMPLEMENTED NOT VERIFIED
On-slide: `sudo apt update`；`sudo apt install -y curl unzip`；`curl -LsSf https://astral.sh/uv/install.sh | sh`。
Visual: `apt → curl → uv → Python 3.11` 階梯。
Notes: 在 Ubuntu shell 先更新套件索引並安裝 `curl`、`unzip`，再依 uv 官方 installer 安裝 uv。重新開 shell 後跑 `uv --version`、`uv python install 3.11`、`uv python find 3.11`。這些步驟只是讓 WSL 有可選的 exact interpreter；它們不會產生 course result。若 installer 被 policy 或網路擋住，留下錯誤並回到同 scenario fallback。
Recovery: 若 shell、版本、lock 或 receipt 不符，保留錯誤並回到 setup gate；仍受阻就使用同 scenario fallback。

## P019 — WSL 解壓與建立 `.venv`

Layout: path flow
Evidence: IMPLEMENTED NOT VERIFIED
On-slide: `PYTHON_BIN="$(uv python find 3.11)"`；`bash setup.sh`；`.venv/bin/python`。
Visual: `/mnt/c/...` → `~/c120-course/` → package root。
Notes: 如果 ZIP 在 Windows Downloads，可從 `/mnt/c/Users/<YourName>/Downloads/` 複製到 WSL 的 Linux home，再在 WSL 內解壓。進入 package root 後執行 `PYTHON_BIN="$(uv python find 3.11)" bash setup.sh`。這會建立 WSL 專用的 `.venv/bin/python`；不要把 Windows 既有 venv 帶過來。接著同一個 shell 執行 `bash course.sh verify`。
Recovery: 若 shell、版本、lock 或 receipt 不符，保留錯誤並回到 setup gate；仍受阻就使用同 scenario fallback。

## P020 — POSIX runner 的最小入口

Layout: single terminal
Evidence: IMPLEMENTED NOT VERIFIED
On-slide: `PYTHON_BIN=python3.11 bash setup.sh`；`bash course.sh verify`。
Visual: POSIX command pair。
Notes: 在 Linux 或 macOS 的 POSIX shell，先以 `PYTHON_BIN=python3.11 bash setup.sh` 指定 interpreter，再以 `bash course.sh verify` 做同一份 gate。這與 Windows、WSL 的 launcher 不同，但驗證目的相同：package-local venv、lock、policy API、scenario 與 claim boundary 都要一致。現在這條 POSIX path 也保持實機排演 placeholder。
Recovery: 若 shell、版本、lock 或 receipt 不符，保留錯誤並回到 setup gate；仍受阻就使用同 scenario fallback。

## P021 — `READY` receipt 是下一步的入場券

Layout: receipt anatomy
Evidence: PLACEHOLDER
On-slide: `status: READY`；`Python 3.11.x`；`scenario_id`；`policy_api_version`；`engine_mode`。
Visual: machine-readable receipt 欄位放大卡。
Notes: 請在 receipt 中找 status、Python version、scenario identity、policy API、lock、engine mode、upstream execution 和 claim boundary。`READY` 表示環境和契約可以進入 runner；它不表示已完成任何節能實驗。缺欄位、版本不符或出現不同 scenario，先讀失敗 gate；不要手改 receipt 讓它看起來通過。
Recovery: 若 shell、版本、lock 或 receipt 不符，保留錯誤並回到 setup gate；仍受阻就使用同 scenario fallback。

## P022 — setup 失敗不等於 energy result

Layout: decision fork
Evidence: VERIFIED
On-slide: `讀錯誤 → 修最小邊界`；`無法完成 → same-scenario fallback`。
Visual: `READY` 與 `RECOVERABLE ERROR` 的分叉牌。
Notes: 如果 setup 或 verify 出現錯誤，先確認 Python minor、package root、lock 與 scenario；只修目前 gate 指出的最小問題。若仍無法建立 READY，就選同 scenario fallback，並把 source mode 記成 fallback。這保留相同的學習問題與 provenance，但不冒充本機 policy execution。不要把安裝等待拿來填 energy evidence。
Recovery: 若 shell、版本、lock 或 receipt 不符，保留錯誤並回到 setup gate；仍受阻就使用同 scenario fallback。

## P023 — 可編輯檔案只有一個

Layout: guarded file
Evidence: VERIFIED
On-slide: `只編輯 marked blocks`；`scenario / schemas / runner / generated JSON = read-only`。
Visual: `student_policy.py` 與四個鎖頭。
Notes: 在整個實驗中，我們只改 `student_policy.py` 的 marked blocks。不要改 upstream framework、scenario、schema、runner、Leo code 或 generated JSON。這個邊界讓 policy hash、predecessor 和 freeze receipt 能解釋結果。若檔案本身與 release 不同，停止編輯，回到 package identity 或 checkpoint restore。
Recovery: 若 policy guard 或 syntax 失敗，只修 marked block 的最小行；不要改 runner、schema 或 generated JSON。

## P024 — policy API 的輸入是現在能觀察到的事

Layout: input/output card
Evidence: PLACEHOLDER
On-slide: `observation`；`choose_action(...)`；`WAIT / SLEEP / SEND_ONE / SEND_URGENT / FLUSH_BATCH`。
Visual: observation card → legal action card。
Notes: policy 只能依當下允許的 observation 做選擇。它不能偷看未來品質、future energy 或 result summary；也不能回傳不在契約內的 action。請先說出 observation 代表什麼，再說 action 會觸發哪個 state 或 packet 行為。這是控制面，不是讓大家重寫 simulator。
Recovery: 若 policy guard 或 syntax 失敗，只修 marked block 的最小行；不要改 runner、schema 或 generated JSON。

## P025 — Python survival：常數是受控旋鈕

Layout: code callout
Evidence: PLACEHOLDER
On-slide: `PACE_GAP_STEPS`、`REST_DURING_GAP`、`BATCH_SIZE`、`URGENT_MARGIN_S`；`bounded values only`。
Visual: 一行斜體常數與範圍護欄。
Notes: 這裡只需要讀懂變數名稱、等號和允許值。斜體顯示的變數是 policy 的控制點；runner 會檢查它們是否在 bounded range。改一個常數前，先寫出它可能改變的 state、queue 或 service；改完保留一個小 diff。實際 release line number 沒有凍結，畫面不填行號。
Recovery: 若 policy guard 或 syntax 失敗，只修 marked block 的最小行；不要改 runner、schema 或 generated JSON。

## P026 — Python survival：條件只處理當前 observation

Layout: branch diagram
Evidence: PLACEHOLDER
On-slide: `現在看到的條件` → `一個 legal action`；`不要讀 future outcome`。
Visual: `if / elif / else` 的三叉決策樹。
Notes: 看一個 Boolean 條件時，先圈出它讀的是哪個 observation，再指出每一個分支會回傳什麼 action。這會把程式閱讀連到機制：條件成立，裝置可能等待、睡眠或送出；條件不成立，則走另一個合法路徑。若 syntax 或名稱錯誤，修 marked block 的最小行，不碰 runner。
Recovery: 若 policy guard 或 syntax 失敗，只修 marked block 的最小行；不要改 runner、schema 或 generated JSON。

## P027 — Python survival：縮排與 return

Layout: before/after code card
Evidence: PLACEHOLDER
On-slide: `choose_action(observation)`；`return WAIT`；`return SLEEP`；`return SEND_ONE`。
Visual: 三行縮排示意與 action token。
Notes: 縮排決定條件屬於哪個分支，`return` 決定 runner 收到哪個 action。請不要在課堂中追 framework traceback；若錯誤指向 marked line，就修該行並重新做 policy guard；若指向非 marked 區域，保留錯誤，走 recovery。這一頁的目的只是讓大家能安全讀與改小段 Python。
Recovery: 若 policy guard 或 syntax 失敗，只修 marked block 的最小行；不要改 runner、schema 或 generated JSON。

## P028 — endpoint 狀態：名稱要和機制對齊

Layout: state ribbon
Evidence: VERIFIED
On-slide: `SLEEP`、`WAIT`、`WAKE`、`PROCESS`、`TX`、`RX`。
Visual: `SLEEP → WAKE → PROCESS → TX/RX → WAIT` 狀態帶。
Notes: 先把狀態名稱和可觀察機制分開。SLEEP 是低功耗休息；WAIT 是 awake idle；WAKE 有回復成本；PROCESS、TX、RX 都各有時間與功率。不要把所有空檔都叫 sleep，也不要把狀態標籤直接當成 energy saving。後面的 result ledger 會把 state duration 逐項列出。
Recovery: 若欄位、單位、scope 或 identity 不完整，停止比較，回到相同 scenario 的 artifact；不要補填數字。

## P029 — WAIT 是 awake idle，SLEEP 會帶來 wake 成本

Layout: two-lane timing
Evidence: VERIFIED
On-slide: `WAIT = 保持清醒`；`SLEEP = 低功耗 + wake latency/energy`。
Visual: WAIT 與 SLEEP 的雙泳道時間線。
Notes: 這是 Lab A 的核心。WAIT 可能不增加睡眠喚醒，但裝置仍清醒；SLEEP 可能降低 idle power，卻要付 wake latency 和 wake energy。哪一個較好，不能只看功率，還要看 service、deadline、packet outcome 與整段 state time。這是一個待驗證的方向，不是預先保證的 KPI。
Recovery: 若欄位、單位、scope 或 identity 不完整，停止比較，回到相同 scenario 的 artifact；不要補填數字。

## P030 — 封包生命週期：送出不是交付

Layout: packet lifecycle
Evidence: VERIFIED
On-slide: `attempt`、`retry`、`delivered`、`expired`、`queue age`。
Visual: `generated → attempt → retry → delivered / expired` 卡片流。
Notes: 每一個 packet 先進 queue，再可能產生 attempt；attempt 可能成功、重試或逾期。SEND action 只代表一次決策，不等於 delivered service。講師要把 queue age、attempt、retry、delivered、expired 分開念給大家聽，讓後面比較 candidate 時不會只看一次 TX。
Recovery: 若欄位、單位、scope 或 identity 不完整，停止比較，回到相同 scenario 的 artifact；不要補填數字。

## P031 — service boundary 先於 energy 比較

Layout: gate diagram
Evidence: VERIFIED; DONOR-REWRITE：BeamShift donor slides 19–21 的 service reaction 與 W→J boundary，改寫成 current endpoint ledger。
On-slide: `先確認 job / window / delivery`；`再比較 J`。
Visual: service gate 包住 endpoint energy ledger。
Notes: 比較兩個 policy 前，先確認是不是同一個 job、同一個 service window、同一個 endpoint boundary，以及 delivered bits 或 deadline 條件是否可比。若 candidate 少送很多封包，J 下降不能直接叫節能；先說服務是否保住。這個 gate 會在三個 labs 都重現，但畫面只保留必要的判讀卡。
Recovery: 若欄位、單位、scope 或 identity 不完整，停止比較，回到相同 scenario 的 artifact；不要補填數字。

## P032 — W 是速率，J 是累積結果

Layout: area chart
Evidence: VERIFIED; DONOR-REWRITE：BeamShift donor slides 14, 16/17 的 throughput、power、energy，去重後拆成 W 與 J。
On-slide: `power = rate`；`energy = area under P(t)`；`W`、`J`。
Visual: `P(t)` 曲線下的面積。
Notes: W 描述某一時刻的功率，J 描述功率隨時間累積的能量。低峰值但拖很久，可能累積更多 J；短暫高峰也要放回 service 和 deadline 看。不要把畫面上的 power 欄位直接當節省，也不要拿 endpoint J 去代表整個 system。公式頁會把這個關係寫成 LaTeX。
Recovery: 若欄位、單位、scope 或 identity 不完整，停止比較，回到相同 scenario 的 artifact；不要補填數字。

## P033 — 公式：endpoint energy 的範圍

Layout: equation canvas
Evidence: VERIFIED
On-slide: `LaTeX source：E_{endpoint}=\sum_{s\in\mathcal{S}}P_s t_s`；`endpoint boundary`。
Visual: Office Math 公式 `E_endpoint`。
Notes: 公式只把 endpoint radio 與 processing course assumptions 的累積關係說清楚：每個 state 的功率乘上停留時間，再加總。`E_endpoint` 的下標提醒我們它不是 whole-system energy。這裡不填入未產生的數字；結果要從 runner artifact 讀取。若 PowerPoint 不能顯示 Office Math，使用同一公式的向量 fallback，不顯示原始 LaTeX 當成公式畫面。
Recovery: 若欄位、單位、scope 或 identity 不完整，停止比較，回到相同 scenario 的 artifact；不要補填數字。

## P034 — 公式：服務效率的分子與分母

Layout: equation + unit ladder
Evidence: VERIFIED
On-slide: `LaTeX source：\eta_E=\frac{D_{delivered}}{E_{endpoint}}`；`delivered bits / J`。
Visual: `η_E` 公式與單位階梯。
Notes: 這個比值的分子是 delivered data，分母是 endpoint energy；兩邊的 boundary 與 units 都要對上。若資料沒有交付或能量 scope 不明，就不能直接報 bit/J。公式幫助我們檢查語義，不會在 browser 端重新計算科學結果。這一頁只教如何讀分子、分母與 scope。
Recovery: 若欄位、單位、scope 或 identity 不完整，停止比較，回到相同 scenario 的 artifact；不要補填數字。

## P035 — 來源、模型、課程假設、結果

Layout: provenance spine
Evidence: VERIFIED
On-slide: `source → model → course assumption → result`；`scenario_id / seed / policy hash`。
Visual: 四層 provenance chain。
Notes: 不要把來源、模型與課程假設壓成一個神秘數字。pinned source 或 TLE 是 source；模型轉成 contact、quality、state 和 packet trace；course wrapper 加入 traffic、wake 或 mission rule；policy action 才產生 result。沿著 scenario_id、seed、policy hash 和 artifact path 往回查，才能判讀一筆數據的來處。
Recovery: 若欄位、單位、scope 或 identity 不完整，停止比較，回到相同 scenario 的 artifact；不要補填數字。

## P036 — 一個 `scenario_id` 綁住整條鏈

Layout: identity spine
Evidence: VERIFIED
On-slide: `c120-ntpu-energy-decision-01`；`scenario / anchor / policy / replay`。
Visual: runner → result → replay → workbook 的同色 identity token。
Notes: 同一個 scenario identity 要出現在 scenario package、runner result、endpoint replay 與 workbook。它讓我們知道比較的是同一個問題，而不是把兩張相似畫面拼在一起。當 identity、anchor、seed、schema 或 unit 不一致，Leo importer 要 fail closed；講師不以改 JSON 的方式繞過它。
Recovery: 若欄位、單位、scope 或 identity 不完整，停止比較，回到相同 scenario 的 artifact；不要補填數字。

## P037 — 公平 baseline：固定 job、window、boundary

Layout: fairness frame
Evidence: VERIFIED; DONOR-REWRITE：BeamShift donor slides 36–39 的 fair A/B，改寫成固定 job/window/boundary 的 bounded policy loop。
On-slide: `FIXED：scenario / seed / job`；`CONTROLLED：policy block`；`OBSERVED：queue / service / state / J`。
Visual: baseline / candidate 的三個鎖定條。
Notes: baseline 不是一張舊截圖，而是後面比較的 control。固定 scenario、seed、job、window、traffic 與 energy boundary，只讓目前 lab 的 marked block 改變。結果觀察 queue、packet、service、state time 和 endpoint J。任何比較若偷偷換了 trace、scope 或 policy，就先判定不公平。
Recovery: 若欄位、單位、scope 或 identity 不完整，停止比較，回到相同 scenario 的 artifact；不要補填數字。

## P038 — LEO window：合法與不合法的 action

Layout: window timeline
Evidence: VERIFIED; DONOR-REWRITE：BeamShift donor slides 2, 4–6 的 window opportunity，改寫成 LEO-only changing service example。
On-slide: `window open`；`window closed`；`WAIT / SEND`；`same anchor`。
Visual: contact window 上的 legal / illegal action marks。
Notes: 窗口開啟時，send、wait 或 batch 的後果可能不同；窗口關閉時，延後可能變成 service loss。請先看固定 anchor 與 traffic，再判斷某個 action 是否落在合法 service window。這頁不是教 TLE 推導，而是把 changing opportunity 接回 endpoint policy 的選擇。
Recovery: 若欄位、單位、scope 或 identity 不完整，停止比較，回到相同 scenario 的 artifact；不要補填數字。

## P039 — Lab A：同一份工作，不同 pace

Layout: lab hero
Evidence: VERIFIED
On-slide: `same job`；`pace / rest`；`service first`。
Visual: 同一批 packet 在兩種送出節奏上的雙泳道。
Notes: Lab A 只問一個可測問題：固定工作與窗口時，送出的 pace 和 rest 選擇，會如何改變 queue、state time、service 與 endpoint J？先不要開檔案。請每個人先說一個方向性的預測，然後我們用 baseline 和 candidate 來驗證；沒有 evidence 就不提前宣布答案。
Recovery: 若 A result 缺失或沒有 consequential diff，保留 stdout 與錯誤，restore A checkpoint 或選 matching fallback。

## P040 — 先讀 `PACE_GAP_STEPS`

Layout: annotated code
Evidence: PLACEHOLDER
On-slide: `gap 變大 → send opportunity 改變`；`line number：PLACEHOLDER`。
Visual: `PACE_GAP_STEPS` marked line 的放大框。
Notes: 請只讀變數名稱與它進入 decision 的位置。這個控制點描述送出之間的步距；它不是直接指定 energy。先預測 gap 改變後 queue age、attempt timing、awake idle、service 和 J 的方向，再改一個合法值。正式 release 的行號與畫面尚未凍結，因此這裡明示 placeholder。
Recovery: 若 A result 缺失或沒有 consequential diff，保留 stdout 與錯誤，restore A checkpoint 或選 matching fallback。

## P041 — 再讀 `REST_DURING_GAP`

Layout: branch card
Evidence: VERIFIED
On-slide: `REST_DURING_GAP = WAIT or SLEEP`；`wake cost must be observed`。
Visual: `WAIT` / `SLEEP` 的二選一分支。
Notes: 這個控制點把空檔送進 WAIT 或 SLEEP。選 WAIT 時，裝置保持清醒；選 SLEEP 時，可能降低 idle power，但要付 wake latency 和 wake energy。先把這個機制寫成 prediction；candidate 結果要同時看 state ledger、service 和 J，不接受只看一個功率欄位。
Recovery: 若 A result 缺失或沒有 consequential diff，保留 stdout 與錯誤，restore A checkpoint 或選 matching fallback。

## P042 — Lab A 的 prediction lock

Layout: prediction canvas
Evidence: VERIFIED
On-slide: `queue age`、`service`、`state time`、`endpoint J`；`before run`。
Visual: 四格 prediction card。
Notes: 在執行前，請寫下四個觀察：queue age 會怎麼走、service 是否保持、哪個 state time 會改變、endpoint J 可能往哪裡走。這不是猜 KPI；它是一個可以被 result 推翻的判讀句。若之後只有 label 或動畫變化，沒有這四類 evidence 的 consequential diff，Lab A gate 就不算完成。
Recovery: 若 A result 缺失或沒有 consequential diff，保留 stdout 與錯誤，restore A checkpoint 或選 matching fallback。

## P043 — A-01：跑 untouched baseline

Layout: terminal focus
Evidence: IMPLEMENTED NOT VERIFIED
On-slide: `bash course.sh run --lab A --case baseline`；Windows：`course.cmd run --lab A --case baseline`；`result_path：PLACEHOLDER`。
Visual: 一條 baseline command 與 stdout JSON。
Notes: 先不改 policy，執行 baseline。POSIX/WSL 使用 `bash course.sh run --lab A --case baseline`，Windows 使用 `course.cmd run --lab A --case baseline`。這一步建立 control，固定 scenario 和 seed，並輸出 stdout JSON；請複製 JSON 指出的 `result_path`，不要靠檔名猜 run。現在命令與 clean artifact 尚未完成 controller fresh rehearsal，畫面保留 placeholder。
Recovery: 若 A result 缺失或沒有 consequential diff，保留 stdout 與錯誤，restore A checkpoint 或選 matching fallback。

## P044 — A-02：只改 A marked block 並 freeze

Layout: source diff
Evidence: IMPLEMENTED NOT VERIFIED
On-slide: `lab-a-pace-rest`；`bash course.sh run --lab A --case candidate --freeze`；Windows：`course.cmd run --lab A --case candidate --freeze`；`policy SHA：PLACEHOLDER`。
Visual: baseline 與 candidate 的單一 diff。
Notes: 現在才編輯 `lab-a-pace-rest`，只改 `PACE_GAP_STEPS` 或 `REST_DURING_GAP` 的合法內容。先說出你的 prediction，保存原始檔案，再執行 candidate freeze。freeze 會綁定 scenario、anchor、policy SHA、predecessor 與 seed；預期會有 candidate result、receipt 和 A checkpoint。若沒有 queue、packet、service、state 或 J 的 consequential diff，先記錄 gate 失敗，不再亂調參。
Recovery: 若 A result 缺失或沒有 consequential diff，保留 stdout 與錯誤，restore A checkpoint 或選 matching fallback。

## P045 — A-03：匯入 candidate，先看同一個 boundary

Layout: evidence compare
Evidence: PLACEHOLDER
On-slide: `same scenario`；`same job`；`queue / service / state / J`；`endpoint layer`。
Visual: baseline/candidate 雙欄 evidence ledger。
Notes: 把 candidate result 和配對 replay 帶進 Leo，與 baseline 並排看。同一個 scenario、job、window 和 endpoint boundary 先打勾，再比較 queue、packet、state 和 J。若 service 不同，先說 service trade-off；不要用較低 J 直接宣布節能。現行 LoRa endpoint browser pixel 和 KPI 尚未凍結，這裡只放 evidence placeholder。
Recovery: 若 A result 缺失或沒有 consequential diff，保留 stdout 與錯誤，restore A checkpoint 或選 matching fallback。

## P046 — A-04：讀懂 state ledger

Layout: state ledger
Evidence: PLACEHOLDER
On-slide: `state duration`；`wake latency`；`TX/RX attempts`；`energy scope`。
Visual: WAIT/SLEEP/WAKE/PROCESS/TX/RX 的橫向 ledger。
Notes: 請沿著 ledger 從左到右讀，不要只抓總 J。先看 WAIT 是否變長，再看 SLEEP 是否帶來 WAKE；接著確認 PROCESS、TX、RX 的時間與 attempt。最後把差異連回 policy action。若 artifact 沒有 state 或 scope 欄位，判定 evidence 不完整，回到相符 result 或 fallback。
Recovery: 若 A result 缺失或沒有 consequential diff，保留 stdout 與錯誤，restore A checkpoint 或選 matching fallback。

## P047 — A-05：把 packet 結果接回 service

Layout: packet-to-service bridge
Evidence: VERIFIED
On-slide: `attempt ≠ delivered`；`retry / expired`；`service verdict`。
Visual: packet ledger → service gate 的箭頭。
Notes: candidate 是否真的支持工作，要看 delivered、expired、retry 與 deadline，而不是只看 SEND 次數。若 packet retry 增加，TX time 和 J 可能增加；若等待跨過 window，service 可能下降。請用一個完整句子判讀：哪個 action 改變哪個 packet outcome，這個 outcome 是否仍滿足 service。
Recovery: 若 A result 缺失或沒有 consequential diff，保留 stdout 與錯誤，restore A checkpoint 或選 matching fallback。

## P048 — A-06：檢查 A freeze lineage

Layout: receipt chain
Evidence: PLACEHOLDER
On-slide: `predecessor`；`policy SHA`；`active_block_id`；`freeze receipt`。
Visual: baseline → candidate → `lab-a-frozen` receipt 鏈。
Notes: freeze 不只是按鈕，它是 withheld case 的入場條件。請確認 candidate 的 policy SHA 與 baseline 不同，receipt 指向同一 scenario 和 anchor，checkpoint 名稱為 A frozen。若 receipt、checkpoint 或 predecessor 缺失，停止進入 hidden，回到 candidate 的最小修復。
Recovery: 若 A result 缺失或沒有 consequential diff，保留 stdout 與錯誤，restore A checkpoint 或選 matching fallback。

## P049 — A-07：用 hidden case 檢驗，不再 retune

Layout: withheld window
Evidence: IMPLEMENTED NOT VERIFIED
On-slide: `bash course.sh run --lab A --case hidden`；Windows：`course.cmd run --lab A --case hidden`；`policy SHA unchanged`。
Visual: 同一 policy 跨兩個不同窗口的對照圖。
Notes: 保持 A frozen policy，不再編輯，執行 hidden case；Windows 使用對應的 `course.cmd`。hidden 會用另一個成本或 service-window 條件測試原先的 pace/rest 假說。預期 policy SHA 不變，結果有自己的 queue、service、state 和 J。若方向相反，這是 counterexample；不要回頭改 policy 讓它變漂亮。
Recovery: 若 A result 缺失或沒有 consequential diff，保留 stdout 與錯誤，restore A checkpoint 或選 matching fallback。

## P050 — Lab A debrief：一條因果句就夠

Layout: causal sentence
Evidence: PLACEHOLDER
On-slide: `我改了…`；`因此…`；`result 顯示…`；`在 hidden…`。
Visual: `A edit → mechanism → evidence → verdict` 四段句卡。
Notes: 請每個人完成一句可反駁敘述：「我改了 A 的哪一個控制點，因此改變了哪個 state 或 packet 機制；result 顯示哪一項 evidence；在 hidden 條件下這個結論仍成立或被推翻。」這句話比背一個 J 更有價值，也把 predictor、runner 與 replay 綁回同一條 lineage。
Recovery: 若 A result 缺失或沒有 consequential diff，保留 stdout 與錯誤，restore A checkpoint 或選 matching fallback。

## P051 — Lab B：現在送，還是等到更穩定？

Layout: quality trace hero
Evidence: VERIFIED
On-slide: `enter`；`exit`；`hold`；`不要被短暫 spike 騙走`。
Visual: 一條 quality/contact trace 與 send-ready band。
Notes: Lab B 把 changing opportunity 換成品質 trace。問題不是品質越高越好，而是裝置在噪聲或短暫尖峰中，何時進入 send-ready、何時退出、要穩定多久。這會影響切換、retry、service 和 endpoint J。先讀 trace，再讀 policy；不要先調 threshold。
Recovery: 若 B receipt、predecessor 或 policy SHA 不符，停止 withheld，restore A/B checkpoint；不可 retune。

## P052 — `ENTER_QUALITY`：何時進入 send-ready

Layout: threshold crossing
Evidence: PLACEHOLDER
On-slide: `quality ≥ ENTER_QUALITY`；`enter event`；`line number：PLACEHOLDER`。
Visual: quality curve 穿越 enter threshold。
Notes: enter threshold 決定何時從等待轉進可送狀態。先指出 trace 中第一次真正越過 threshold 的位置，再預測 mode transition、attempt 和 service。這個欄位不是直接的 energy knob；它透過切換與後續 packet 行為產生結果。正式 line number 與 field mapping 尚未凍結，保留 placeholder。
Recovery: 若 B receipt、predecessor 或 policy SHA 不符，停止 withheld，restore A/B checkpoint；不可 retune。

## P053 — `EXIT_QUALITY`：為什麼不能只用一條線

Layout: hysteresis band
Evidence: VERIFIED
On-slide: `ENTER_QUALITY ≠ EXIT_QUALITY`；`avoid ping-pong`。
Visual: enter/exit 兩條 threshold 中間的 band。
Notes: 如果 enter 和 exit 共用一條線，品質在邊界抖動時，mode 可能來回切換；這就是 ping-pong。把 exit threshold 放在不同位置，是為了讓已進入的狀態有穩定帶。講師要讓大家先預測切換次數、WAIT、TX/RX 和 service，再看 trace evidence。
Recovery: 若 B receipt、predecessor 或 policy SHA 不符，停止 withheld，restore A/B checkpoint；不可 retune。

## P054 — `STABLE_STEPS`：拒絕短暫尖峰

Layout: hold counter
Evidence: PLACEHOLDER
On-slide: `stable_count < STABLE_STEPS`；`hold`；`stable_count = STABLE_STEPS` → `switch`。
Visual: 逐格累積的 stability counter。
Notes: STABLE_STEPS 把「看起來變好」和「連續穩定」分開。未達計數時保持 hold，達到計數才切換。這可能減少 ping-pong，但也可能錯過短窗口；所以要把 transition、queue、service 與 energy 一起看。不要只用切換次數判定成功。
Recovery: 若 B receipt、predecessor 或 policy SHA 不符，停止 withheld，restore A/B checkpoint；不可 retune。

## P055 — Lab B 的 Trace A prediction

Layout: trace annotation
Evidence: VERIFIED
On-slide: `預測 entry`；`預測 hold`；`預測 service / endpoint J`。
Visual: Trace A 上的三個預測標記。
Notes: 請在 Trace A 上標出你認為會 enter、會 hold、會 exit 的位置，並寫下可能的 service 與 endpoint J 方向。這不是把未來輸入偷塞進 policy，而是課前的可反駁假說。下一步 baseline 和 candidate 會在同一條 Trace A 上比較。
Recovery: 若 B receipt、predecessor 或 policy SHA 不符，停止 withheld，restore A/B checkpoint；不可 retune。

## P056 — B-01：Trace A baseline

Layout: terminal focus
Evidence: IMPLEMENTED NOT VERIFIED
On-slide: `bash course.sh run --lab B --case trace-a-baseline`；Windows：`course.cmd run --lab B --case trace-a-baseline`；`result_path：PLACEHOLDER`。
Visual: Trace A baseline command 與 result path。
Notes: 保持 A frozen predecessor，先跑 B Trace A baseline。這一步固定 quality/contact trace，建立 enter/exit/hold 候選的 control。stdout 會回傳 run identity 與 result path；請保留配對 replay。命令名稱、實際 path 與 clean result 尚未完成排演，因此畫面不填現成數字。
Recovery: 若 B receipt、predecessor 或 policy SHA 不符，停止 withheld，restore A/B checkpoint；不可 retune。

## P057 — B-02：改 B marked block 並 freeze

Layout: threshold diff
Evidence: IMPLEMENTED NOT VERIFIED
On-slide: `lab-b-enter-exit-hold`；`ENTER_QUALITY / EXIT_QUALITY / STABLE_STEPS`；`bash course.sh run --lab B --case trace-a-candidate --freeze`；Windows：`course.cmd run --lab B --case trace-a-candidate --freeze`。
Visual: 三個 B 常數中的單一 diff。
Notes: 只修改 B marked block 中的合法 threshold 或 stable steps，保留 A frozen predecessor。執行 Trace A candidate freeze，讓 receipt 綁定 B policy SHA、Trace A、scenario 與 predecessor。若改到其他 block、trace 或 engine，runner 應在執行前拒絕；若 evidence 只變了畫面標籤，記錄 consequential-fixture gate 未通過。
Recovery: 若 B receipt、predecessor 或 policy SHA 不符，停止 withheld，restore A/B checkpoint；不可 retune。

## P058 — B-03：讀 transition 與 service，不只讀品質

Layout: transition ledger
Evidence: PLACEHOLDER
On-slide: `quality trace`；`mode transition`；`attempt / retry`；`service`；`endpoint J`。
Visual: mode transition 與 packet/service 的同步表。
Notes: 比較 candidate 時，先定位 enter、hold、exit，再看這些 transition 造成的 attempt、retry、queue 和 service。品質數值只是 observation context，不是 delivered service，也不是 energy。若 policy 反應更慢，要問它保住了什麼；若切換更多，要問它付出了什麼。
Recovery: 若 B receipt、predecessor 或 policy SHA 不符，停止 withheld，restore A/B checkpoint；不可 retune。

## P059 — B-04：確認 freeze receipt 才能進 Trace B

Layout: gate card
Evidence: PLACEHOLDER
On-slide: `lab-b-frozen`；`policy SHA`；`Trace A`；`predecessor = A frozen`。
Visual: B frozen receipt 的鎖與 predecessor 箭頭。
Notes: Trace B 是 withheld，不是再調參的 playground。先檢查 B frozen receipt、checkpoint、policy SHA 和 predecessor；任何一項缺失就不要執行 withheld。freeze 的目的，是讓 Trace B 真正回答「同一 policy 在新 trace 是否仍有用」。
Recovery: 若 B receipt、predecessor 或 policy SHA 不符，停止 withheld，restore A/B checkpoint；不可 retune。

## P060 — B-05：Trace B 不 retune

Layout: withheld trace
Evidence: IMPLEMENTED NOT VERIFIED
On-slide: `bash course.sh run --lab B --case trace-b`；Windows：`course.cmd run --lab B --case trace-b`；`policy SHA unchanged`。
Visual: 同一個 frozen policy 跨 Trace A / B。
Notes: 保持 B frozen policy，執行 Trace B；Windows 使用對應的 `course.cmd`。此時不再改 threshold 或 stable steps。預期 result 沿用 B policy SHA，並提供 transition、queue、service、state 和 endpoint J。若 Trace B 露出 counterexample，這是泛化邊界，不是失敗到要隨機重調。
Recovery: 若 B receipt、predecessor 或 policy SHA 不符，停止 withheld，restore A/B checkpoint；不可 retune。

## P061 — B-06：辨識 too-slow 與 ping-pong

Layout: counterexample compare
Evidence: VERIFIED; DONOR-REWRITE：BeamShift donor slide 12 的 too-slow / ping-pong counterexample，改寫成 enter/exit/hold evidence。
On-slide: `too-slow`；`ping-pong`；`service loss`；`保留 counterexample`。
Visual: 兩條 transition traces。
Notes: 如果 hold 太長，可能 too-slow，錯過 service window；如果 enter/exit 太近，可能 ping-pong，付出額外切換與 retry。請把 trace 上的事件和 endpoint ledger 對起來，最後說明是哪個 trade-off 被觀察到。不要把畫面上較平滑的線直接當成較省能量。
Recovery: 若 B receipt、predecessor 或 policy SHA 不符，停止 withheld，restore A/B checkpoint；不可 retune。

## P062 — Lab B debrief：hysteresis 是條件，不是保證

Layout: verdict card
Evidence: PLACEHOLDER
On-slide: `成立`；`被推翻`；`待查`。
Visual: `policy condition → transition → service/energy → verdict`。
Notes: 請用「在 Trace A…；在 Trace B…」兩句話回答。hysteresis 可能減少 ping-pong，但也可能讓切換太慢；它是一個在特定 trace、job 和 service boundary 下的條件式結論。把 B receipt、policy SHA、Trace B result 和 counterexample 一起保留，讓別人能重查。
Recovery: 若 B receipt、predecessor 或 policy SHA 不符，停止 withheld，restore A/B checkpoint；不可 retune。

## P063 — Recovery checkpoint：保存 A/B lineage

Layout: checkpoint stack
Evidence: PLACEHOLDER
On-slide: `artifacts/receipts/`；`artifacts/checkpoints/`；`workbook prediction + result`。
Visual: A frozen、B frozen 與 workbook checkpoint 三層堆疊。
Notes: 在進入 C 前，保存目前的 policy、receipt、checkpoint、result/replay pair 和 prediction。若中斷，先用 status 找可用 checkpoint，再 restore 所需 role；不要覆寫既有 artifact。這一步的價值是保持 lineage，不是補出一個看似完整的數字。
Recovery: 若 B receipt、predecessor 或 policy SHA 不符，停止 withheld，restore A/B checkpoint；不可 retune。

## P064 — Lab C：佇列、批次、休眠或 urgent send

Layout: queue hero
Evidence: VERIFIED
On-slide: `batch`；`urgent`；`deadline`；`freshness`；`service`。
Visual: queue cards 接到長窗口與短窗口。
Notes: Lab C 把問題拉到 IoT traffic：多個資料等待時，要不要累積成 batch？快到 deadline 時，要不要 urgent send？批次可能減少 activation，卻增加 queue age；urgent 可能保住 delivery，卻付出較高 state cost。先看 queue 與 window，再改 policy。
Recovery: 若 C lineage、packet ledger 或 service evidence 不完整，保留目前 artifact，回到 matching result 或 same-scenario fallback。

## P065 — queue、deadline、freshness 不是同一欄

Layout: three-card compare
Evidence: VERIFIED
On-slide: `queue age`；`deadline`；`freshness`；`delivered / expired`。
Visual: queue age、deadline、freshness 三張訊息卡。
Notes: queue age 告訴我們等了多久；deadline 告訴我們何時失效；freshness 告訴我們資料還有沒有用。batch 讓 queue 變長，不代表一定過期；urgent 讓 action 提前，也不代表一定 delivered。請把這三個欄位分開讀，最後才把它們與 endpoint J 對照。
Recovery: 若 C lineage、packet ledger 或 service evidence 不完整，保留目前 artifact，回到 matching result 或 same-scenario fallback。

## P066 — `BATCH_SIZE`：少 activation 還是多等待

Layout: queue-to-flush
Evidence: PLACEHOLDER
On-slide: `BATCH_SIZE`；`flush`；`activation count`；`queue age`。
Visual: 訊息累積到 flush 的階梯。
Notes: BATCH_SIZE 影響何時把累積的資料送出。較大的 batch 可能減少醒來與 TX 次數，但 queue age、freshness 和 deadline 風險上升；較小的 batch 可能更即時，卻增加 activation。預測時要同時寫 activation、delivered、expired、state time 和 J。
Recovery: 若 C lineage、packet ledger 或 service evidence 不完整，保留目前 artifact，回到 matching result 或 same-scenario fallback。

## P067 — `URGENT_MARGIN_S`：何時跳過一般節奏

Layout: deadline gauge
Evidence: PLACEHOLDER
On-slide: `deadline − now ≤ URGENT_MARGIN_S`；`SEND_URGENT`；`不要偷看結果`。
Visual: deadline gauge 與 urgent margin。
Notes: urgent margin 是 action decision 的門檻：當距離 deadline 的剩餘空間太小，policy 可以選擇 SEND_URGENT。這個判斷使用現在可見的時間與資料，不應讀 future delivered 或 future energy。預期是 urgent action 改變 packet timing 與 service；endpoint J 的方向仍要由 result 驗證。
Recovery: 若 C lineage、packet ledger 或 service evidence 不完整，保留目前 artifact，回到 matching result 或 same-scenario fallback。

## P068 — Lab C prediction：先寫 trade-off

Layout: trade-off canvas
Evidence: VERIFIED
On-slide: `batching`；`urgency`；`delivered bits`；`endpoint J`。
Visual: `activation ↔ delay ↔ service ↔ J` 的四向平衡圖。
Notes: 請先寫一個 trade-off，而不是預測單向節省。例如「較大的 batch 可能降低 activation，但若 queue age 穿過 deadline，delivered bits 會下降」。這種句子能被 candidate、revision 和 surprise 逐步驗證。若預測不成立，保留完整 packet ledger。
Recovery: 若 C lineage、packet ledger 或 service evidence 不完整，保留目前 artifact，回到 matching result 或 same-scenario fallback。

## P069 — C-01：跑 baseline

Layout: terminal focus
Evidence: IMPLEMENTED NOT VERIFIED
On-slide: `bash course.sh run --lab C --case baseline`；Windows：`course.cmd run --lab C --case baseline`。
Visual: C baseline command 與 stdout JSON。
Notes: 保持 B frozen predecessor，先跑 C baseline；不要加 `--freeze`。這個 control 固定 traffic、deadline 和 contact window，讓後面的 batching/urgent 改動有比較基準。請保存 result path 和配對 replay；如果 predecessor 不符，先 restore B checkpoint，不要把 C 直接跑下去。
Recovery: 若 C lineage、packet ledger 或 service evidence 不完整，保留目前 artifact，回到 matching result 或 same-scenario fallback。

## P070 — C-02：只做一次 candidate edit

Layout: single diff card
Evidence: IMPLEMENTED NOT VERIFIED
On-slide: `lab-c-batch-urgent`；`BATCH_SIZE or URGENT_MARGIN_S`；`bash course.sh run --lab C --case candidate`；Windows：`course.cmd run --lab C --case candidate`。
Visual: C marked block 的一個小 diff。
Notes: 現在只改 C marked block，選擇 BATCH_SIZE 或 URGENT_MARGIN_S 的一個方向，保存 prediction 後執行 candidate；不要加 freeze。candidate 的 purpose 是讓我們先看到第一個結果，決定是否需要一次有理由的 revision。若沒有 queue、state、service 或 J 的 consequential change，先記錄 gate failure。
Recovery: 若 C lineage、packet ledger 或 service evidence 不完整，保留目前 artifact，回到 matching result 或 same-scenario fallback。

## P071 — C-03：讀 queue 與 packet ledger

Layout: ledger table
Evidence: PLACEHOLDER
On-slide: `queue age`；`attempt`；`retry`；`delivered`；`expired`。
Visual: queue cards 與 delivered/expired packet ledger。
Notes: 先從 packet ledger 讀發生了什麼，再回到 policy。candidate 是讓 queue 多等了一輪，還是把 urgent 資料提前送出？是否增加 retry 或 expired？請把每個差異連回 action 時機，避免用總數字遮掉 service loss。現在的 endpoint artifact path 和 KPI 仍是 placeholder。
Recovery: 若 C lineage、packet ledger 或 service evidence 不完整，保留目前 artifact，回到 matching result 或 same-scenario fallback。

## P072 — C-04：讀 state 與 endpoint J

Layout: state-energy ribbon
Evidence: PLACEHOLDER
On-slide: `state duration`；`P_s × t_s`；`E_endpoint`；`service gate`。
Visual: PROCESS/TX/RX/SLEEP/WAKE 的能量帶。
Notes: 沿著 state 帶讀：batch 是否減少 activation？urgent 是否增加 awake/TX？有沒有 wake latency？把這些時間帶放進 `E_endpoint` 的累積關係，再回頭檢查 delivered bits 與 deadline。若 service 不同，先報 trade-off，不以 J 單項排名。
Recovery: 若 C lineage、packet ledger 或 service evidence 不完整，保留目前 artifact，回到 matching result 或 same-scenario fallback。

## P073 — C-05：根據 evidence 做唯一一次 revision

Layout: candidate-to-revision
Evidence: VERIFIED
On-slide: `one reason`；`one marked-block change`；`no second revision`。
Visual: candidate evidence → 一個 revision arrow。
Notes: revision 不是試到好看為止。從 candidate ledger 指出一個具體問題，例如 queue age 太長或 urgent margin 太晚；只在 C marked block 做一次有理由的修改，更新 prediction。若需要第二次 revision，Lab C gate 仍未完成，保留這個結論，不能把後續 surprise 當成有效比較。
Recovery: 若 C lineage、packet ledger 或 service evidence 不完整，保留目前 artifact，回到 matching result 或 same-scenario fallback。

## P074 — C-06：revision freeze

Layout: freeze receipt
Evidence: IMPLEMENTED NOT VERIFIED
On-slide: `bash course.sh run --lab C --case revision --freeze`；Windows：`course.cmd run --lab C --case revision --freeze`；`lab-c-frozen`；`policy SHA`。
Visual: C candidate checkpoint → C frozen receipt。
Notes: 執行 revision freeze，讓 receipt 綁定 C candidate predecessor、scenario、policy SHA 和目前的 C block。預期會有 revision result、freeze receipt、C frozen JSON 與 policy checkpoint。完成後 policy 不再編輯；任何 identity、schema 或 policy mismatch 都回到上一頁的最小修復。
Recovery: 若 C lineage、packet ledger 或 service evidence 不完整，保留目前 artifact，回到 matching result 或 same-scenario fallback。

## P075 — C-07：surprise case 保持 frozen policy

Layout: surprise scenario
Evidence: IMPLEMENTED NOT VERIFIED
On-slide: `bash course.sh run --lab C --case surprise`；Windows：`course.cmd run --lab C --case surprise`；`policy SHA unchanged`；`surprise`。
Visual: 短窗口中的突發 traffic 與 frozen policy。
Notes: 保持 C revision frozen policy，執行 surprise；不要再改 BATCH_SIZE 或 URGENT_MARGIN_S。surprise 會把同一 policy 放進突發 traffic 或較短 opportunity，觀察 queue、service、state 與 endpoint J。結果可以支持或推翻 revision 的假說；無論方向如何，都保留 receipt 與 replay。
Recovery: 若 C lineage、packet ledger 或 service evidence 不完整，保留目前 artifact，回到 matching result 或 same-scenario fallback。

## P076 — Lab C debrief：用 packet、service、J 一起判讀

Layout: three-ledger verdict
Evidence: PLACEHOLDER
On-slide: `packet outcome`；`service`；`endpoint J`；`counterexample`。
Visual: candidate / revision / surprise 三欄 ledger。
Notes: 最後請用三個 ledger 完成判讀：packet 是否交付、service 是否保住、endpoint J 如何累積。candidate 的問題、revision 的理由、surprise 的反例要分開記錄。不要把較低 J、較高 delivered bits 或較少 activation 任一項單獨升格成普遍節能結論。
Recovery: 若 C lineage、packet ledger 或 service evidence 不完整，保留目前 artifact，回到 matching result 或 same-scenario fallback。

## P077 — 先保存 result 與配對 replay

Layout: artifact pair
Evidence: IMPLEMENTED NOT VERIFIED
On-slide: `artifacts/<run_id>/result.json`；`artifacts/<run_id>/endpoint-replay.json`；`stdout result_path`。
Visual: result/replay 雙檔案與同一 `run_id` 的連結。
Notes: 每次 runner 成功，stdout 會告訴我們真正的 `result_path`。請把 result 和同目錄的 endpoint replay 一起保存，並記下 case、policy SHA、scenario identity 和 prediction。不要靠 timestamp 或檔名猜 run，也不要手改 JSON。這兩個檔案是後面 Leo import 能否建立完整 evidence chain 的起點。
Recovery: 若 result 或 replay 缺一個，保留 stdout 和錯誤，回到 exact case 的 matching fallback；不要拼接不同 run。

## P078 — 在 Leo 先記 setup mode

Layout: setup panel
Evidence: PLACEHOLDER
On-slide: `READY receipt` → `記錄 READY`；`same-scenario fallback` → `記錄 fallback`。
Visual: Leo runner setup panel 的兩個互斥選項。
Notes: 打開 Leo `/course` 的 runner panel。若外部 runner 已看到 READY，選記錄 READY；若 setup 無法完成，選有標籤的 same-scenario fallback。這個按鈕只記錄 setup mode，不會自動匯入 result，也不會在 Leo 執行 Python。當前 panel 操作與 pixel 尚未由 Windows/WSL clean rehearsal 完成，畫面只放 placeholder。
Recovery: 若 setup mode 與 artifact source 不一致，停止 import，先改回相符的 READY 或 fallback provenance。

## P079 — 匯入 exact result，不上傳 policy source

Layout: import control
Evidence: PLACEHOLDER
On-slide: `匯入 result.json`；`fresh：artifacts/<run_id>/...`；`fallback：fallback_artifacts/...`。
Visual: Leo import control 與一個 matching result path。
Notes: 在 import control 選擇 exact case 的 result.json；fresh run 用 stdout 指出的 artifact，fallback 用 manifest 指定的 matching path。Leo 只接收 JSON，不執行 `student_policy.py`。匯入前核對配對 endpoint replay，讓 workbook 能保存 run ID、policy SHA、predecessor 與 replay identity。LoRa endpoint import pixel 尚未凍結，不能放假的成功畫面。
Recovery: 若匯入被拒絕，保留 importer error，核對 result/replay pair 與 case，再選相同 scenario 的 fallback；不要改上傳檔案內容。

## P080 — importer 逐層檢查 provenance

Layout: validation ladder
Evidence: VERIFIED; DONOR-REWRITE：BeamShift donor slides 70–75 的 evidence qualification，改寫為 current schema、identity、unit、policy 與 provenance gate。
On-slide: `schema → identity → units → policy / seed → provenance → replay`。
Visual: 六階 validation ladder，最後才落到 replay。
Notes: importer 先檢查 JSON shape，再檢查 scenario、anchor、case、seed、policy、units、runner provenance 和 energy scope；全部通過後才 materialize endpoint replay。這裡採用 donor 的 evidence qualification 概念，但已改寫成當前 result/replay contract。任何一層失敗都要保持 session 不變，不能留下半筆 ledger。
Recovery: 任一 gate 失敗就回到命名的 artifact 或 same-scenario fallback；不以空陣列、零值或手改 hash 假裝通過。

## P081 — replay 把 result 變成可讀時間線

Layout: replay timeline
Evidence: PLACEHOLDER
On-slide: `queue`；`packet`；`radio state`；`contact / handover`；`endpoint energy`。
Visual: endpoint replay timeline 上的 queue、packet 與 state markers。
Notes: import 成功後，Leo 只 materialize 已驗證的 endpoint replay。請沿時間線先看 queue，再看 packet attempt/delivery，再看 radio state，最後看 contact context 與 endpoint energy。這是把 machine-readable result 變成可以講解的 evidence；它不是 browser-side 科學 producer，也不是重新計算另一套公式。
Recovery: 若 replay marker 與 result identity 不相符，回到 importer gate，保留 session 不變；不要手動畫事件。

## P082 — server preview 可以證明什麼

Layout: screenshot evidence
Evidence: VERIFIED（server preview / fixture host boundary only）; DONOR-REWRITE：BeamShift donor slides 96–97 的 claim boundary，改寫成 server-preview 與 Windows/WSL 的明確分層。
On-slide: `Server preview 已驗證`；`Windows native：PLACEHOLDER`；`endpoint KPI：PLACEHOLDER`。
Visual: current server preview import/replay screenshot，附來源與 boundary 標籤。
Notes: 這張畫面只能說明 server preview 的 import/replay path 曾被驗證；不能推導 Windows native、WSL fresh run 或 endpoint KPI 已完成。講解時指出 screenshot 的來源、artifact source 和 claim ceiling。畫面若沒有 current evidence，就只放明示 placeholder，不重畫一張看似真的 browser。
Recovery: 若瀏覽器 evidence 來源或 scenario 不明，移除畫面，改走 matching fallback 的 artifact packet；保留未驗證標籤。

## P083 — 匯出可重開的 Energy Decision Workbook

Layout: workbook export
Evidence: PLACEHOLDER
On-slide: `匯出可重開的學習單`；`predictions`；`run ledger`；`replay IDs`；`source mode`。
Visual: workbook export control 與保存檔欄位卡。
Notes: import 成功後匯出 workbook。保存的不只是最後一個 J，而是 scenario identity、prediction、run/import/freeze records、replay IDs、artifact source、claim 與 recovery provenance。講師示範按 export，讓檔案落在可辨識的位置；不把 export 當成重新計算，也不把檔案存在視為 COMPLETE。
Recovery: 若 export 失敗，先保留已匯入 artifact 與 stdout，使用 backup；缺少欄位就標記 INCOMPLETE，不手改 status。

## P084 — 關閉再 reopen，驗證 provenance 仍在

Layout: reopen loop
Evidence: PLACEHOLDER
On-slide: `export → close → reopen`；`same scenario_id`；`same run / replay records`。
Visual: workbook 由保存檔回到同一個 evidence ledger 的回路。
Notes: 關閉 `/course` 後，用「匯入並重新開啟學習單」選擇保存檔。請核對 scenario_id、已匯入 run/replay、endpoint replay identity、completed evidence 和 source mode 都回來。reopen 只恢復已驗證資料，不會重跑 policy，也不會補造結果。這是交接與中斷復原的 proof。
Recovery: 若 identity 不符或 evidence 缺失，保留 INCOMPLETE，回到同一 scenario 重新匯入；不要把舊 workbook 改名成新場景。

## P085 — mismatch 必須 fail closed

Layout: fail-closed dialog
Evidence: VERIFIED（server preview mismatch recovery）
On-slide: `identity / unit / schema mismatch`；`session unchanged`；`REJECTED`。
Visual: mismatch rejection dialog，旁邊是一個未變動的 workbook ledger。
Notes: 示範一個 scenario、unit、schema 或 policy provenance 不一致的 artifact。正確行為是拒絕，且 session/workbook 不留下半筆資料。這個失敗是安全邊界，也是教學邊界：不能為了讓畫面出現而降低驗證。講師要讓大家說出 rejected 的原因，再回到 matching artifact。
Recovery: 保存錯誤訊息，核對 manifest、scenario、case 與配對 replay；仍不符就選 same-scenario fallback，絕不修改 gate。

## P086 — fallback 是同一場景的可追溯復原

Layout: fallback map
Evidence: PLACEHOLDER
On-slide: `artifact_source: same-scenario-fallback`；`manifest.json`；`matching result + replay`。
Visual: 十個 case label 指向十組 matching fallback pair 的地圖。
Notes: fallback 不是一張相似預設畫面。先保留 `fallback_artifacts/manifest.json`，再依 exact label 選 A baseline、A candidate、A hidden、B Trace A/B、C baseline/candidate/revision/surprise 的 matching result 與 replay。Leo 要顯示 source mode 是 fallback；這表示課程可繼續，但不證明本機 policy 曾執行。
Recovery: 若 manifest、case label 或 scenario identity 不配對，停止使用，回到 owner 指定 release 或重新解壓同一 archive。

## P087 — policy guard 失敗：只恢復 marked block

Layout: recovery code
Evidence: IMPLEMENTED NOT VERIFIED
On-slide: `status` → `restore --checkpoint` → `policy guard`；`artifacts untouched`。
Visual: checkpoint restore 的三步回復箭頭。
Notes: 若 policy guard 報 UTF-8/LF、marker、AST、名稱或 action 錯誤，先執行 `course.sh status` 找可用 checkpoint；再用對應的 `restore --checkpoint lab-a-frozen`、`lab-b-frozen`、`lab-c-candidate` 或 `lab-c-frozen`。Windows 使用 `course.cmd` 等價命令。restore 只回復 active policy bytes，應保留 artifacts。修好後重新驗證，不要重做整個結果集。
Recovery: checkpoint 不存在或 identity 不符，就回到 release-default 或 matching fallback；不可從不同 Lab 拼 policy。

## P088 — 一條完整的中斷復原路徑

Layout: recovery route
Evidence: VERIFIED
On-slide: `保留錯誤 → 核對 identity → restore / fallback → import → reopen`。
Visual: 從 runner error 到 workbook reopen 的單一路徑。
Notes: 現在把整條 recovery 念一次：保留命令輸出與錯誤；核對 scenario、policy、case、unit 和 replay identity；能 restore 就恢復正確 checkpoint，不能就選 matching same-scenario fallback；重新 import，最後 reopen workbook。任何一步都不補造 KPI。這條路讓課程在環境或瀏覽器受阻時，仍保留同一條因果鏈。
Recovery: 若 recovery provenance 無法說清楚，將本次 session 標成 INCOMPLETE，停止向下宣稱完成。

---

## P089 — evidence clinic：決策時可取得什麼

Layout: availability sort
Evidence: VERIFIED
On-slide: `decision-time input`；`post-action outcome`；`不可互換`。
Visual: 可在 action 前取得與只能在 run 後讀到的兩欄分類。
Notes: 把 policy 能看到的 observation 放在左邊，把 run 後才出現的 delivered、retry、endpoint J 和 outcome 放在右邊。policy 只能用左邊資訊做 action；右邊只能作為事後 evidence。這個分層能避免 future leakage，也讓 result 的因果解釋可信。
Recovery: 若某欄位的取得時點不明，暫停使用，標成 PLACEHOLDER，回到 API contract；不要猜它是合法 observation。

## P090 — leakage 會讓假說看起來很強

Layout: legal-illegal feature
Evidence: VERIFIED
On-slide: `合法：現在的 quality / queue / deadline`；`禁止：future delivery / future energy`。
Visual: legal feature 與 leaky feature 的紅綠分流。
Notes: 如果 policy 偷看 future delivery 或 future energy，結果看似更好，卻沒有真實決策意義。請把每個 observation 對回 runner API：它在 action 當下是否已存在？若不是，就從 policy 移除，並在 prediction 中說明限制。evidence clinic 的目的不是追求最高分，而是守住可反駁的控制面。
Recovery: 發現 leakage 時，恢復 release policy 或 checkpoint，重新做 prediction；保留原結果但標成 invalid experiment。

## P091 — 一筆 evidence record 要能自我說明

Layout: evidence record
Evidence: VERIFIED; DONOR-REWRITE：BeamShift donor slides 70–75、96–97、113 的 evidence record 與 qualification，改寫成 current artifact / claim record。
On-slide: `source`；`identity`；`mechanism`；`evidence`；`claim class`。
Visual: 一筆 record 卡片串起 source、policy、result、replay 與 verdict。
Notes: 這頁採用 donor 的 evidence record 概念，但把內容重寫成目前課程的 artifact lineage。每筆結論至少要能回到 source mode、scenario、policy SHA、run/replay、energy scope、service boundary 和 claim class。只寫一句「比較省」不足以交接；要說哪個機制造成哪個 evidence，以及範圍到哪裡。
Recovery: 若 record 缺 identity、scope 或 source mode，維持 INCOMPLETE；不以畫面或預期值補上缺欄位。

## P092 — measured、derived、assumed、simulated

Layout: claim classifier
Evidence: VERIFIED; DONOR-REWRITE：BeamShift donor slide 113 的四類 claim，改寫為 current course boundary。
On-slide: `measured`；`derived`；`assumed`；`simulated`。
Visual: 四欄 claim classifier，底部標示 `course ceiling = simulated teaching data`。
Notes: measured 需要實體或儀器證據；derived 需要 frozen inputs、model 和 lineage；assumed 是課程設定；simulated 是 fixture、runner 或 endpoint replay output。分類不是品質排行榜，而是宣稱範圍。現在這份課程的 endpoint result 屬於 simulated teaching data，不能升格成 measured KPI。
Recovery: 分類不清時保留 placeholder，回查 artifact provenance；不要因為欄位精細或畫面漂亮就升格 claim。

## P093 — endpoint layer 與 system layer 的邊界

Layout: authority boundary
Evidence: VERIFIED; DONOR-REWRITE：BeamShift donor evidence-boundary concepts，改寫為 endpoint replay / C-120 system replay 分層。
On-slide: `endpoint J` 不等於 `system consumed J`；`共享 scenario ≠ 共享語義`。
Visual: 兩個有明確邊界的 energy ledgers。
Notes: 再次把最容易混淆的兩層放在一起。endpoint layer 能回答 endpoint state、packet、queue、service 和 endpoint J；system layer 保留既有 C-120 authoritative replay。它們共享 anchor、clock 和 workbook，但沒有自動 mapping。講師在讀每個欄位前，先說「這是哪一層」。
Recovery: 若欄位來源或 boundary 不明，停止做 bit/J 或 system 比較，回到 schema 與 authority map。

## P094 — 把同一機制轉到智慧農場

Layout: transfer map
Evidence: VERIFIED
On-slide: `soil sensor`；`上行機會`；`batch / sleep / urgent`；`service + endpoint J`。
Visual: IoT 農場 sensor 到 gateway 的機會窗口圖。
Notes: 請把 LEO 名稱拿掉，只留下 mechanism：sensor 有資料，連線機會會變，policy 要在 freshness、service 與 energy 間選擇。農場可以使用 batch、sleep 或 urgent，但要重新定義 traffic、deadline、power model 與 service boundary。不能把 LEO 的 contact window 或數字直接搬過去。
Recovery: 若 transfer 只換了場景名、沒有重定義 service 或 energy scope，回到 endpoint model，標成未完成假說。

## P095 — HVAC、edge、物流：機會變動仍是同一個問題

Layout: domain cards
Evidence: VERIFIED
On-slide: `HVAC`；`edge inference`；`logistics`；`opportunity → policy → service / energy`。
Visual: 三個 domain card 共同指向一條 causal spine。
Notes: HVAC 的 opportunity 可能是低負載時段，edge inference 可能是可用算力窗口，物流可能是車輛或網路連線窗口。三者都能使用「何時工作、何時等待、何時批次」的機制；但每個 domain 的 deadline、delivered work 和 power boundary 都要重新定義。LEO 只示範 changing opportunity，不是 transfer 的必要條件。
Recovery: 若 domain claim 需要 LEO 數字或未提供的 measured power，刪除該 claim，保留 mechanism placeholder。

## P096 — 寫一個可被推翻的競賽假說

Layout: hypothesis card
Evidence: VERIFIED
On-slide: `在固定 ______ 下，若改變 ______，則 ______ 會改變，因為 ______；若 ______，假說被推翻。`
Visual: 一張可填寫但不是空白表格的 hypothesis card。
Notes: 請把假說寫成 policy、mechanism、evidence 和 held-out condition 的句子。例如在固定 job、window 和 endpoint boundary 下，若調整 batch 或 urgency，則 queue/service/state J 會以某個方向改變，因為 action timing 改了；在 surprise case 出現相反結果時，假說就被推翻。不要填入尚未產生的數字。
Recovery: 若假說只有「更省」而沒有 mechanism 或 falsifier，回到第 68 頁的 trade-off card 重寫。

---

## P097 — Appendix：TLE 只負責提供時間與位置來源

Layout: provenance appendix
Evidence: VERIFIED; DONOR-REWRITE：BeamShift donor slides 7–10、98–110，僅取 TLE/SGP4/coordinate provenance vocabulary。
On-slide: `pinned source → model → contact context`；`LEO = changing window example`。
Visual: TLE source、model 與 contact context 的三層箭頭。
Notes: 這一頁是可選 vocabulary，不是要求大家推導軌道。TLE 是 source；模型把它轉成 position/contact context；課程再把 context 接到 scenario。真正重要的是 provenance 與固定 identity，不是背一個衛星名。這是從 BeamShift appendix 改寫的來源概念，沒有搬入 legacy satellite-first opening。
Recovery: 若 source、epoch 或 scenario anchor 未凍結，停止引用 contact 畫面，標成 PLACEHOLDER；不要自行抓最新 TLE。

## P098 — Appendix：SGP4 與 contact window 的最小讀法

Layout: minimal model
Evidence: VERIFIED
On-slide: `position over time`；`contact open / closed`；`not live telemetry`。
Visual: position sample 點穿過 contact boundary 的圖。
Notes: 只需要知道模型把時間輸入轉成位置與可服務窗口的 context；不必在課堂推導 SGP4。當 window open 時，policy 有一組 action opportunity；window closed 時，等待可能造成 service trade-off。這些是 course scenario 的 simulated inputs，不是當下衛星遙測。
Recovery: 若有人把 contact 圖說成 live pass，回到 claim shield，改用 simulated / source-verified 的準確語句。

## P099 — Appendix：quality、dB 與 action context

Layout: vocabulary ladder
Evidence: VERIFIED; DONOR-REWRITE：BeamShift donor slides 13、15、22–35、111–114，縮成非通訊背景可讀的 quality vocabulary。
On-slide: `quality observation ≠ service`；`dB / linear`；`不要求 link-budget 推導`。
Visual: dB observation 透過 threshold 進入 policy 的最小流程。
Notes: quality trace 只是 policy 的 observation context；它不等於 delivered service、endpoint energy 或 bit/J。若需要讀 dB，只要理解對數尺度與線性量的差異，不要把 donor 的 link-budget 或 RF producer 搬進課堂。當 quality field 或 unit 未凍結，就只講概念並保留 placeholder。
Recovery: unit、field mapping 或 boundary 不清時，停在 observation 層，不做跨欄位的數值比較。

## P100 — Appendix：W、J、bit/s、delivered bits、bit/J

Layout: unit ladder
Evidence: VERIFIED; DONOR-REWRITE：BeamShift donor slides 14、16/17，去重後重建單位階梯。
On-slide: `W = power rate`；`J = accumulated energy`；`bit/s = rate`；`delivered bits`；`bit/J = service per energy`。
Visual: 五個單位 token 從 state ledger 接到 service gate。
Notes: 依序念五個 token：W 是功率速率，J 是累積能量，bit/s 是資料率，delivered bits 是真正交付量，bit/J 是在清楚 boundary 下的服務效率。donor 的 throughput/power/energy 概念已在此去重；任何數字都要回到 result scope。沒有 delivered 或 energy scope，就不要宣稱 bit/J。
Recovery: 若 unit 混用，停止比較，回查 schema、公式與 endpoint/system boundary；不自行換算補值。

## P101 — Appendix：source → model → assumption → result

Layout: lineage map
Evidence: VERIFIED
On-slide: `source`；`model`；`course assumption`；`result`；`policy hash`。
Visual: provenance spine 與四個可追溯節點。
Notes: source 可能是 pinned upstream reference；model 產生 trace；course assumption 決定 traffic、state 或 energy scope；policy action 產生 result。請讓每一個 claim 都能沿著 policy hash、scenario、seed 與 replay ID 往回查。若某個數字沒有 lineage，就把它留在 placeholder。
Recovery: provenance 斷裂時，回到最近一個有 identity 的 artifact，保留斷點，不重建看似完整的鏈。

## P102 — Appendix：`student_policy.py` 的 allowed API

Layout: API card
Evidence: PLACEHOLDER; DONOR-REWRITE：BeamShift 舊操作／session 語義退役，僅保留 current bounded action contract。
On-slide: `allowed observations` → `WAIT / SLEEP / SEND_ONE / SEND_URGENT / FLUSH_BATCH`；`API version：PLACEHOLDER`。
Visual: observation-to-action API card。
Notes: 這張卡是 policy 操作邊界，不是完整 Python 教科書。請讀 allowed observation、合法 action 和 marked block；不要改 engine、schema、scientific formula 或 generated output。實際 API version、line number 和 released field mapping 尚未 freeze，因此畫面只保留 placeholder。每個 action 都要能在 event/replay 中留下 evidence，否則不算 consequential。
Recovery: API 與檔案版本不符時，恢復 release policy 或 checkpoint，不能自行發明 action 名稱。

## P103 — Appendix：scenario、result、receipt、replay 的契約流

Layout: contract flow
Evidence: PLACEHOLDER
On-slide: `scenario.schema` → `result.schema` → `freeze-receipt.schema` → `endpoint-replay.schema` → `workbook`。
Visual: 五份 schema 連成一條 contract flow。
Notes: scenario 定義固定問題；result 記錄 runner outcome；freeze receipt 綁定 policy lineage；endpoint replay 定義 Leo 能重現的事件；workbook 保存整條學習證據。這些 schema 是互相連接的 contract，不是讓課堂自行改欄位的練習。實際 schema instance、hash 與 current artifact 未完全 freeze，維持 placeholder。
Recovery: schema validation 失敗時，保留 error 與 input，不手改欄位，改選 matching release artifact。

## P104 — Appendix：fail-closed validation ladder

Layout: validation gates
Evidence: VERIFIED
On-slide: `shape` → `identity` → `units` → `policy` → `provenance`；`fail = no partial update`。
Visual: 每一關通過才向下的閘門。
Notes: fail closed 的重點是「不通過就不寫入」。先檢查 shape，再核對 identity、units、policy/seed 和 provenance；任何一關失敗，Leo session/workbook 都保持原狀。這種行為同時保護 evidence 邊界與使用者對結果的信任。
Recovery: 回讀錯誤所指出的 gate，重選 exact artifact 或 fallback；不要關掉 validation 或刪除欄位。

## P105 — Appendix：課程 wrapper 與 upstream license boundary

Layout: source boundary
Evidence: VERIFIED
On-slide: `course wrapper`；`pinned upstream reference`；`JSON seam`；`GPL-3.0 review`。
Visual: upstream、course package、Leo JSON seam 的三方邊界圖。
Notes: 課程 wrapper 以 documented JSON 與 pinned reference 溝通；Leo 不 import 或 link upstream Python modules，也不在 server 執行上傳的 policy。這個邊界既是技術設計，也是 license 與安全設計。今天只使用課程提供的 package 與 contract，不要求大家讀完整 upstream repository。
Recovery: 任何人若要把 upstream、Leo source 或 generated artifact 改成課堂操作，停止並交回 owner review；課堂只保留 bounded policy edit。

## P106 — Appendix：field glossary 與 claim ceiling

Layout: glossary card
Evidence: VERIFIED
On-slide: `queue`；`packet`；`service`；`state time`；`endpoint J`；`simulated teaching data`。
Visual: glossary tokens 與 claim shield。
Notes: 最後把容易混淆的詞再讀一次：queue 是等待中的工作，packet 是傳輸單位，service 是符合課程 boundary 的交付，state time 是狀態停留，endpoint J 是 endpoint scope 的累積能量。所有 runner/replay output 目前都在 simulated teaching claim ceiling 內。詞彙清楚，才不會把同名欄位互相冒充。
Recovery: 若有人以 live、measured、whole-system 或 canonical parity 描述課程 result，回到 claim shield，改用 evidence status 標示。

## P107 — 快速分支：同一 policy，新的 held-out 條件

Layout: fast branch
Evidence: VERIFIED
On-slide: `freeze policy`；`new opportunity / trace`；`predict → run → compare`；`no retune`。
Visual: frozen policy 直接連到新的 counterexample card。
Notes: 如果班級進度較快，不增加任意 slider；使用同一個 frozen policy 和新的 fair condition。先預測 window、quality、queue 或 urgency 改變時的 service/state/J，再執行對應 withheld case。這個分支的價值是檢查結論是否依賴某一條 trace，不是追求更低的數字。
Recovery: 若沒有 frozen receipt 或新的 condition 未標 identity，就回到主路徑，使用已保存的 result/replay，不另造 case。

## P108 — 退出：留下可重開、可反駁的 evidence chain

Layout: exit gate
Evidence: PLACEHOLDER
On-slide: `export`；`close`；`reopen`；`hypothesis + falsifier`；`COMPLETE / INCOMPLETE`。
Visual: workbook、hypothesis、falsifier 三張卡回到同一 scenario identity。
Notes: 下課前請確認 workbook 能保存並 reopen，prediction、result、replay、freeze、fallback 與 claim provenance 都在；再用一句話說出 hypothesis 和會推翻它的 condition。缺少 runner、browser 或 endpoint evidence 就保留 INCOMPLETE，這是正確的 evidence 狀態，不是要用數字補滿。最後再說一次：LoRaEnergySim 支援智慧節能與 IoT 的 endpoint 因果教學；LEO 只是 changing service window 的例子。
Recovery: 若無法完成 export/reopen，保留已產生的 artifact 與錯誤，使用 backup 或 same-scenario fallback；不得宣稱 classroom-ready、live 或 measured。

---

## 交付前缺口（不佔頁）

- `VERIFIED / EXTERNAL GET VERIFIED FROM CONTROLLER`：server listener、公開完整 ZIP 與 checksum 下載、hash、ZIP integrity 與單一根目錄 65-item inventory已核對；不同教室網路仍需 fresh rehearsal。Python 3.11 cold-start receipt、dependency lock/hash 與各平台 fresh-run 證據仍為 `PLACEHOLDER`。
- `PLACEHOLDER`：正式 release 的 `student_policy.py` 行號、API version、result/freeze/replay schema instance、十個 exact run 的 run ID、policy SHA 與 consequential diff。
- `PLACEHOLDER`：Windows native 與 WSL 的乾淨安裝、verify、十個 runs 和 recovery rehearsal；目前不能把 Linux/server source claim 擴成 Windows 通過。
- `VERIFIED（server preview 邊界）`：server-side import、endpoint replay、workbook export、same-scenario fallback 與 mismatch rejection 的 preview evidence；不能代替本機或 Windows pixel acceptance。
- `PLACEHOLDER`：LoRa endpoint browser pixel、endpoint KPI 與 final human classroom acceptance；未凍結前不繪製畫面、不填數字、不宣稱完成。
