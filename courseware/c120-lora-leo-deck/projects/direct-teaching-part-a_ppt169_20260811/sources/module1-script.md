# C-120 module 1 source checkpoint (36 physical pages)

Template: `/home/u24/ppt-master/template/educate.pptx`

The full authored source remains in `courseware/c120-lora-leo-deck/full-deck-v2-classroom-script.md`; this file is the module-1 extraction and evidence contract.

## P001 — P001｜有限電量與變動服務窗口

Evidence: SOURCE BOUNDARY
Visual: endpoint 與 changing service window
On-slide: 有限電量的 IoT endpoint（物聯網端點）必須把資料送進會開、會關的服務窗口。過早保持 awake 會耗電；錯過窗口，資料可能延遲或過期。

Commands: none (concept / boundary page)
Purpose: 建立具體 endpoint 問題，再連到工具。
Mechanism: SEND、WAIT、SLEEP 改變 radio state（無線狀態）與停留時間，進而改變 packet timing、service 與 endpoint energy J（焦耳）。
Expected: 預期：SEND、WAIT、SLEEP 各自保護的資源可由 state 與 service 觀察。
Recovery: claim 擴大：停在目前 boundary；source mode 保留；模擬資料維持 simulated 類型。

本頁目的：建立具體 endpoint 問題，再連到工具。
畫面指向：先看標題與 endpoint 與 changing service window，再看命令、欄位或箭頭所標示的邊界。
可直接說：節點位於田區、倉庫或校園角落；供電有限且 service window 有限。分析沿著 action、state、packet、service 連到 endpoint J。
必要操作：本頁屬於概念或邊界頁；沿著畫面上的 endpoint 與 changing service window 閱讀，不改動 runner、schema 或 generated JSON。
預期畫面或結果：預期：SEND、WAIT、SLEEP 各自保護的資源可由 state 與 service 觀察。
失敗處理：claim 擴大：停在目前 boundary；source mode 保留；模擬資料維持 simulated 類型。
銜接下一頁：P002｜P002｜現在送不一定最好，等一下也不一定省電，把本頁的 endpoint 與 changing service window 帶入下一個操作階段。

## P002 — P002｜現在送不一定最好，等一下也不一定省電

Evidence: SOURCE BOUNDARY
Visual: SEND／WAIT／SLEEP 三欄取捨
On-slide: 立刻送可能守住窗口，卻付出處理與收發能量。醒著等待可能等到較好品質，卻持續消耗 awake-idle；睡眠功率低，卻增加 wake latency 與 wake energy。

Commands: none (concept / boundary page)
Purpose: 比較三種合法方向，不使用公式。
Mechanism: action 的代價回到 state duration、packet outcome 與 service。
Expected: 預期：窗口關閉時，SEND_* 不屬於合法路徑。
Recovery: claim 擴大：停在目前 boundary；source mode 保留；模擬資料維持 simulated 類型。

本頁目的：比較三種合法方向，不使用公式。
畫面指向：先看標題與 SEND／WAIT／SLEEP 三欄取捨，再看命令、欄位或箭頭所標示的邊界。
可直接說：窗口接近關閉時，觀察 service、反應能力與等待功率的取捨；結果回到這三個欄位。
必要操作：本頁屬於概念或邊界頁；沿著畫面上的 SEND／WAIT／SLEEP 三欄取捨 閱讀，不改動 runner、schema 或 generated JSON。
預期畫面或結果：預期：窗口關閉時，SEND_* 不屬於合法路徑。
失敗處理：claim 擴大：停在目前 boundary；source mode 保留；模擬資料維持 simulated 類型。
銜接下一頁：P003｜P003｜WAIT、SLEEP、SEND：合法 action，把本頁的 SEND／WAIT／SLEEP 三欄取捨 帶入下一個操作階段。

## P003 — P003｜WAIT、SLEEP、SEND：合法 action

Evidence: SOURCE BOUNDARY
Visual: legal action → observable consequence
On-slide: 每一步選一個 action：WAIT（清醒閒置）、SLEEP（低功耗休息）或 SEND（傳送）。action 改變 radio state、packet 進度與服務結果。

Commands: none (concept / boundary page)
Purpose: 建立合法 action vocabulary。
Mechanism: contact_open = false 時，安全路徑只允許 `SLEEP`；其餘 SEND_* 必須被拒絕。
Expected: 預期：action 對 state、packet 或 service 的一個後果可被定位。
Recovery: claim 擴大：停在目前 boundary；source mode 保留；模擬資料維持 simulated 類型。

本頁目的：建立合法 action vocabulary。
畫面指向：先看標題與 legal action → observable consequence，再看命令、欄位或箭頭所標示的邊界。
可直接說：結果解讀由 action 開始，再追蹤 state 與 packet 事件。SEND 展開成 SEND_ONE、SEND_URGENT、FLUSH_BATCH。
必要操作：本頁屬於概念或邊界頁；沿著畫面上的 legal action → observable consequence 閱讀，不改動 runner、schema 或 generated JSON。
預期畫面或結果：預期：action 對 state、packet 或 service 的一個後果可被定位。
失敗處理：claim 擴大：停在目前 boundary；source mode 保留；模擬資料維持 simulated 類型。
銜接下一頁：P004｜P004｜實際流程：安裝→baseline→修改→比較→網站回放，把本頁的 legal action → observable consequence 帶入下一個操作階段。

## P004 — P004｜實際流程：安裝→baseline→修改→比較→網站回放

Evidence: SOURCE BOUNDARY
Visual: 安裝 → baseline → edit → compare → website replay
On-slide: setup Python 3.11＋`.venv` → 執行 baseline。
edit `student_policy.py` → compare state／packet／service／J → website replay。

Commands: none (concept / boundary page)
Purpose: 定義可操作的課程流程。
Mechanism: 固定 scenario 與 seed；唯一修改項進入 candidate；result／replay 保留 input、policy、output 關聯。
Expected: 預期：baseline 與 candidate 的中間事件、service 結果與 endpoint J 可比較。
Recovery: claim 擴大：停在目前 boundary；source mode 保留；模擬資料維持 simulated 類型。

本頁目的：定義可操作的課程流程。
畫面指向：先看標題與 安裝 → baseline → edit → compare → website replay，再看命令、欄位或箭頭所標示的邊界。
可直接說：流程依序涵蓋 environment setup、baseline、active block edit、candidate comparison 與 website replay；每個 stage 保存自己的 receipt。
必要操作：本頁屬於概念或邊界頁；沿著畫面上的 安裝 → baseline → edit → compare → website replay 閱讀，不改動 runner、schema 或 generated JSON。
預期畫面或結果：預期：baseline 與 candidate 的中間事件、service 結果與 endpoint J 可比較。
失敗處理：claim 擴大：停在目前 boundary；source mode 保留；模擬資料維持 simulated 類型。
銜接下一頁：P005｜P005｜因果鏈與 endpoint J，把本頁的 安裝 → baseline → edit → compare → website replay 帶入下一個操作階段。

## P005 — P005｜因果鏈與 endpoint J

Evidence: SOURCE BOUNDARY
Visual: observation → policy → action → state/packet → service → endpoint J
On-slide: endpoint energy J（焦耳）由 state time、packet outcome 與 service 累積。中間任何一段沒有差異，最後的變化不歸因給這次修改。

Commands: none (concept / boundary page)
Purpose: 定義所有 lab 共用的讀圖順序。
Mechanism: observation 觸發 action；action 改變 state／packet；service gate 位於 energy interpretation 之前。
Expected: 預期：支持或推翻預測的 evidence 段落可定位。
Recovery: claim 擴大：停在目前 boundary；source mode 保留；模擬資料維持 simulated 類型。

本頁目的：定義所有 lab 共用的讀圖順序。
畫面指向：先看標題與 observation → policy → action → state/packet → service → endpoint J，再看命令、欄位或箭頭所標示的邊界。
可直接說：service 失敗但 J 下降時，記錄服務邊界，再說明 energy trade-off；同一讀法沿用到 replay。
必要操作：本頁屬於概念或邊界頁；沿著畫面上的 observation → policy → action → state/packet → service → endpoint J 閱讀，不改動 runner、schema 或 generated JSON。
預期畫面或結果：預期：支持或推翻預測的 evidence 段落可定位。
失敗處理：claim 擴大：停在目前 boundary；source mode 保留；模擬資料維持 simulated 類型。
銜接下一頁：P006｜P006｜LoRaEnergySim endpoint runner 的必要性，把本頁的 observation → policy → action → state/packet → service → endpoint J 帶入下一個操作階段。

## P006 — P006｜LoRaEnergySim endpoint runner 的必要性

Evidence: SOURCE BOUNDARY
Visual: runner evidence／claim boundary
On-slide: LoRaEnergySim runner：固定 scenario／policy／seed，重跑 endpoint case。
state／packet／service／J 形成 evidence；live telemetry 屬於另一類。

Commands: none (concept / boundary page)
Purpose: 說明 LoRaEnergySim 與智慧節能 IoT 的直接關係。
Mechanism: 同一 runner 連接 sleep、processing、TX、RX、packet、retry 與 energy ledger。
Expected: 預期：endpoint evidence 範圍與 claim ceiling 分開標示。
Recovery: claim 擴大：停在目前 boundary；source mode 保留；模擬資料維持 simulated 類型。

本頁目的：說明 LoRaEnergySim 與智慧節能 IoT 的直接關係。
畫面指向：先看標題與 runner evidence／claim boundary，再看命令、欄位或箭頭所標示的邊界。
可直接說：LoRaEnergySim endpoint model 以事件鏈記錄 sleep、processing、TX、RX、packet、retry 與 energy；每筆 result 保留 source mode 與 boundary。
必要操作：本頁屬於概念或邊界頁；沿著畫面上的 runner evidence／claim boundary 閱讀，不改動 runner、schema 或 generated JSON。
預期畫面或結果：預期：endpoint evidence 範圍與 claim ceiling 分開標示。
失敗處理：claim 擴大：停在目前 boundary；source mode 保留；模擬資料維持 simulated 類型。
銜接下一頁：P007｜P007｜LEO：changing service window 的例子，把本頁的 runner evidence／claim boundary 帶入下一個操作階段。

## P007 — P007｜LEO：changing service window 的例子

Evidence: SOURCE BOUNDARY
Visual: 窗口出現 → policy → service／energy
On-slide: LEO 範例採用預先定義的 changing-service-window trace，作為 endpoint 傳輸時機的輸入。窗口會開、會關、會變短，品質也可能變動。

Commands: none (concept / boundary page)
Purpose: 以 LEO trace 引出 changing window。
Mechanism: 窗口長短改變傳送或等待的後果；機制可轉到農場、HVAC、物流與 edge。
Expected: 預期：LEO 窗口機制可轉用至另一 IoT 場景。
Recovery: claim 擴大：停在目前 boundary；source mode 保留；模擬資料維持 simulated 類型。

本頁目的：以 LEO trace 引出 changing window。
畫面指向：先看標題與 窗口出現 → policy → service／energy，再看命令、欄位或箭頭所標示的邊界。
可直接說：本頁使用預先定義的 changing-service-window trace，分析服務機會變動時的 endpoint policy；軌道與 link budget 不屬於此案例。
必要操作：本頁屬於概念或邊界頁；沿著畫面上的 窗口出現 → policy → service／energy 閱讀，不改動 runner、schema 或 generated JSON。
預期畫面或結果：預期：LEO 窗口機制可轉用至另一 IoT 場景。
失敗處理：claim 擴大：停在目前 boundary；source mode 保留；模擬資料維持 simulated 類型。
銜接下一頁：P008｜P008｜從預測到結果：每次修改留下證據，把本頁的 窗口出現 → policy → service／energy 帶入下一個操作階段。

## P008 — P008｜從預測到結果：每次修改留下證據

Evidence: SOURCE BOUNDARY
Visual: 預測 → bounded edit → run → 讀 evidence → withheld
On-slide: 預測 state／packet／service／endpoint J，修改 policy 並執行 exact case。
withheld case 固定 policy，不重新調參。

Commands: none (concept / boundary page)
Purpose: 結果可檢驗原先預測。
Mechanism: baseline／candidate／withheld 共享 scenario identity；withheld 沿用 frozen policy。
Expected: 預期：非預期結果保留，且中間事件可定位。
Recovery: claim 擴大：停在目前 boundary；source mode 保留；模擬資料維持 simulated 類型。

本頁目的：結果可檢驗原先預測。
畫面指向：先看標題與 預測 → bounded edit → run → 讀 evidence → withheld，再看命令、欄位或箭頭所標示的邊界。
可直接說：結果與預測相反時，保留非預期結果並檢查 state、packet 或 service 的中間事件；數值不因非預期結果回寫。
必要操作：本頁屬於概念或邊界頁；沿著畫面上的 預測 → bounded edit → run → 讀 evidence → withheld 閱讀，不改動 runner、schema 或 generated JSON。
預期畫面或結果：預期：非預期結果保留，且中間事件可定位。
失敗處理：claim 擴大：停在目前 boundary；source mode 保留；模擬資料維持 simulated 類型。
銜接下一頁：P009｜P009｜claim 與來源邊界，把本頁的 預測 → bounded edit → run → 讀 evidence → withheld 帶入下一個操作階段。

## P009 — P009｜claim 與來源邊界

Evidence: SOURCE BOUNDARY
Visual: 可說／不可說／待核對
On-slide: result／replay = simulated data；READY（環境就緒）= verify gate。
來源鏈決定 claim ceiling；fresh setup／import 待核對。

Commands: none (concept / boundary page)
Purpose: 標記證據等級。
Mechanism: package identity、scenario identity 與 source mode 必須一起保存。
Expected: 預期：READY 定義為環境 gate；energy result 需要 run evidence。
Recovery: claim 擴大：停在目前 boundary；source mode 保留；模擬資料維持 simulated 類型。

本頁目的：標記證據等級。
畫面指向：先看標題與 可說／不可說／待核對，再看命令、欄位或箭頭所標示的邊界。
可直接說：目前確認的是 package content 與 identity；fresh Python run、READY、case receipt、Leo strict import 仍以現場 gate 為準。待核對 evidence 維持 pending。
必要操作：本頁屬於概念或邊界頁；沿著畫面上的 可說／不可說／待核對 閱讀，不改動 runner、schema 或 generated JSON。
預期畫面或結果：預期：READY 定義為環境 gate；energy result 需要 run evidence。
失敗處理：claim 擴大：停在目前 boundary；source mode 保留；模擬資料維持 simulated 類型。
銜接下一頁：P010｜P010a｜使用命名 release asset，把本頁的 可說／不可說／待核對 帶入下一個操作階段。

## P010 — P010a｜使用命名 release asset

Evidence: SOURCE BOUNDARY
Visual: release ZIP 與來源鎖
On-slide: 使用命名 release asset：`lora-energy-lab-v1.zip`。禁止以 branch 或資料夾拼裝 runner。

Commands: ls -l lora-energy-lab-v1.zip; Get-ChildItem .\lora-energy-lab-v1.zip
Purpose: 固定 artifact 交付邊界。
Mechanism: 單一 release asset 固定 wrapper、policy API、scenario、schema 與 license source chain。
Expected: 預期：命名 asset 位於指定 release 目錄。
Recovery: 檔案缺少或混用：錯誤保留，重新取得同一 release asset；source archive 與 git clone 不納入 runner。

本頁目的：固定 artifact 交付邊界。
畫面指向：先看標題與 release ZIP 與來源鎖，再看命令、欄位或箭頭所標示的邊界。
可直接說：命名 release asset 固定 artifact identity；此 gate 尚未進入 Python 或 energy runner。
必要操作：在畫面標示的 package/root context 執行命令：ls -l lora-energy-lab-v1.zip；Get-ChildItem .\lora-energy-lab-v1.zip。
預期畫面或結果：預期：命名 asset 位於指定 release 目錄。
失敗處理：檔案缺少或混用：錯誤保留，重新取得同一 release asset；source archive 與 git clone 不納入 runner。
銜接下一頁：P011｜P010b｜解壓後只能有一個 package root，把本頁的 release ZIP 與來源鎖 帶入下一個操作階段。

## P011 — P010b｜解壓後只能有一個 package root

Evidence: SOURCE BOUNDARY
Visual: lora-energy-lab/ root inventory
On-slide: 解壓後只應有一個 `lora-energy-lab/` 根目錄。
README、launcher、`student_policy.py`、schemas、fallback 均位於此 root。

Commands: find lora-energy-lab -mindepth 1 -maxdepth 1 -printf '%f\n'; Get-ChildItem .\lora-energy-lab
Purpose: 定義解壓後 root inventory 的第一個可觀察 gate。
Mechanism: 解壓後的 root 同時提供 policy、runner、scenario 與 schema；此頁只列舉 root 內容，不測試 ZIP bytes。
Expected: 預期：POSIX `find` 或 PowerShell `Get-ChildItem` 顯示單一 `lora-energy-lab/` root 內的 README、launcher、policy、schemas 與 fallback。
Recovery: root 不符：錯誤保留，重新取得指定 asset 並重新解壓；checkout 檔案不補入 release root。

本頁目的：定義解壓後 root inventory 的第一個可觀察 gate。
畫面指向：先看標題與 lora-energy-lab/ root inventory，再看命令、欄位或箭頭所標示的邊界。
可直接說：package tree 必須是單一 release root；`.venv` 與 result lineage 均以此 root 為參照。
必要操作：在畫面標示的 package/root context 執行命令：find lora-energy-lab -mindepth 1 -maxdepth 1 -printf '%f\n'；Get-ChildItem .\lora-energy-lab。
預期畫面或結果：預期：POSIX `find` 或 PowerShell `Get-ChildItem` 顯示單一 `lora-energy-lab/` root 內的 README、launcher、policy、schemas 與 fallback。
失敗處理：root 不符：錯誤保留，重新取得指定 asset 並重新解壓；checkout 檔案不補入 release root。
銜接下一頁：P012｜P011a｜解壓位置：release asset 所在資料夾，把本頁的 lora-energy-lab/ root inventory 帶入下一個操作階段。

## P012 — P011a｜解壓位置：release asset 所在資料夾

Evidence: LOCAL PRECONDITION
Visual: archive parent → extract → package root
On-slide: 目前 shell 位於 `lora-energy-lab-v1.zip` 所在資料夾；下一頁直接解壓並進入唯一的 `lora-energy-lab` root。

Commands: Get-Location; pwd
Purpose: 固定 extract 的起始工作目錄。
Mechanism: archive parent 決定解壓目的地；Windows 與 WSL/POSIX 在各自 shell 讀取目前位置，下一頁再執行平台對應的 extract。
Expected: 預期：`Get-Location` 或 `pwd` 顯示命名 release asset 所在資料夾。
Recovery: 位置不符：切換到 release asset 所在資料夾，再進入下一頁的 extract。

本頁目的：固定 extract 的起始工作目錄。
畫面指向：先看標題與 archive parent → extract → package root，再看命令、欄位或箭頭所標示的邊界。
可直接說：本頁只確認解壓起點；下一頁執行 `Expand-Archive` 或 `unzip`，setup、READY 與 runner evidence 仍屬後續 stages。
必要操作：在畫面標示的 package/root context 執行命令：Get-Location；pwd。
預期畫面或結果：預期：`Get-Location` 或 `pwd` 顯示命名 release asset 所在資料夾。
失敗處理：位置不符：切換到 release asset 所在資料夾，再進入下一頁的 extract。
銜接下一頁：P013｜P011b｜解壓並進入唯一的 package root，把本頁的 archive parent → extract → package root 帶入下一個操作階段。

## P013 — P011b｜解壓並進入唯一的 package root

Evidence: LOCAL PRECONDITION
Visual: Windows PowerShell／WSL-POSIX exact extract
On-slide: 兩個 shell 從 archive parent 解壓，並進入 `lora-energy-lab` root。
root 內有 launcher、policy、schemas、`fallback_artifacts/`。

Commands: Expand-Archive .\lora-energy-lab-v1.zip -DestinationPath .; Set-Location .\lora-energy-lab; Get-Location; unzip lora-energy-lab-v1.zip; cd lora-energy-lab; pwd
Purpose: 固定解壓後的工作目錄。
Mechanism: package root 是 setup、policy edit、result path 與 replay path 的共同參照；Windows 與 WSL/POSIX 各走自己的 exact route。
Expected: 預期：Windows `Get-Location` 或 POSIX `pwd` 顯示結尾是 `lora-energy-lab`，必要檔案位於同一 root。
Recovery: root 不符：回到 inventory gate；parent 目錄不建立 `.venv` 或 runner。

本頁目的：固定解壓後的工作目錄。
畫面指向：先看標題與 Windows PowerShell／WSL-POSIX exact extract，再看命令、欄位或箭頭所標示的邊界。
可直接說：後續 shell 命令均以此 root 為參照；Windows 只用 PowerShell `.cmd` route，WSL/POSIX 只用 bash `.sh` route。
必要操作：操作起點是 archive parent。Windows PowerShell 依序執行 Expand-Archive .\lora-energy-lab-v1.zip -DestinationPath .、Set-Location .\lora-energy-lab、Get-Location；WSL/POSIX 依序執行 unzip lora-energy-lab-v1.zip、cd lora-energy-lab、pwd。最後確認兩個 shell 都位於 lora-energy-lab root。
預期畫面或結果：預期：Windows `Get-Location` 或 POSIX `pwd` 顯示結尾是 `lora-energy-lab`，必要檔案位於同一 root。
失敗處理：root 不符：回到 inventory gate；parent 目錄不建立 `.venv` 或 runner。
銜接下一頁：P014｜P012｜Windows shell 與 Python 3.11 identity，把本頁的 Windows PowerShell／WSL-POSIX exact extract 帶入下一個操作階段。

## P014 — P012｜Windows shell 與 Python 3.11 identity

Evidence: LOCAL PRECONDITION
Visual: CMD／PowerShell 雙視窗
On-slide: CMD、PowerShell、WSL 使用不同 shell／path。`py --list` 必須含 3.11；Windows native 使用 `setup.cmd`／`course.cmd`。

Commands: py --list; py -3.11 --version
Purpose: 建立 Windows interpreter identity。
Mechanism: Python 3.11.x 是 package contract 的前置條件；Windows launcher 與 WSL bash launcher 分開。
Expected: 預期：清單含 3.11，版本命令顯示 `Python 3.11.x`。
Recovery: 缺少 3.11：進入 P013 官方 installer 或 P014 uv；其他 minor 維持 gate failure。

本頁目的：建立 Windows interpreter identity。
畫面指向：先看標題與 CMD／PowerShell 雙視窗，再看命令、欄位或箭頭所標示的邊界。
可直接說：CMD／PowerShell prompt 表示 Windows shell；Windows 使用 `setup.cmd`／`course.cmd`，`.sh` path 僅屬 POSIX／WSL。
必要操作：在畫面標示的 package/root context 執行命令：py --list；py -3.11 --version。
預期畫面或結果：預期：清單含 3.11，版本命令顯示 `Python 3.11.x`。
失敗處理：缺少 3.11：進入 P013 官方 installer 或 P014 uv；其他 minor 維持 gate failure。
銜接下一頁：P015｜P013｜Windows 缺少 Python 3.11：補正確 interpreter，把本頁的 CMD／PowerShell 雙視窗 帶入下一個操作階段。

## P015 — P013｜Windows 缺少 Python 3.11：補正確 interpreter

Evidence: RECOVERY PATH
Visual: 官方下載 → Launcher／PATH 選項 → version gate
On-slide: `py --list` 缺少 3.11：安裝 Python 3.11.x 64-bit，保留 Python Launcher；PATH 可不勾選。重開 PowerShell，重新執行兩個版本命令。

Commands: 開啟 https://www.python.org/downloads/windows/; 下載 Python 3.11.x Windows installer (64-bit); 安裝選項：Install Python Launcher for all users; PATH：可不勾選；完成後重開 PowerShell; py --list; py -3.11 --version
Purpose: 提供可恢復的 Windows 路徑。
Mechanism: 官方 installer 修復 interpreter discovery；Python Launcher 是 Windows 版本 gate；package-local `.venv` 尚未建立。
Expected: 預期：`py --list` 出現 3.11，`py -3.11 --version` 顯示 3.11.x。
Recovery: 仍缺少 3.11：保留錯誤，改走 P014 uv；PATH 綁定其他 minor 不構成 gate success。

本頁目的：提供可恢復的 Windows 路徑。
畫面指向：先看標題與 官方下載 → Launcher／PATH 選項 → version gate，再看命令、欄位或箭頭所標示的邊界。
可直接說：下載頁、64-bit installer、Launcher 選項與 PATH 決策都在畫面上；完成後重開 PowerShell，再進入 P012 的 `py --list` 與 `py -3.11 --version` gate。
必要操作：在畫面標示的 package/root context 執行命令：開啟 https://www.python.org/downloads/windows/；下載 Python 3.11.x Windows installer (64-bit)；安裝選項：Install Python Launcher for all users；PATH：可不勾選；完成後重開 PowerShell；py --list；py -3.11 --version。
預期畫面或結果：預期：`py --list` 出現 3.11，`py -3.11 --version` 顯示 3.11.x。
失敗處理：仍缺少 3.11：保留錯誤，改走 P014 uv；PATH 綁定其他 minor 不構成 gate success。
銜接下一頁：P016｜P014｜uv 取得與定位 Python 3.11，把本頁的 官方下載 → Launcher／PATH 選項 → version gate 帶入下一個操作階段。

## P016 — P014｜uv 取得與定位 Python 3.11

Evidence: RECOVERY PATH
Visual: Windows／POSIX uv 兩條入口
On-slide: uv 負責取得並定位 Python 3.11；`READY`、`result.json` 與 replay 由 package setup／run 產生。

Commands: winget install --id=astral-sh.uv -e; uv python install 3.11; uv python find 3.11; uv --version
Purpose: launcher unavailable 時的第二條入口。
Mechanism: Windows、WSL、Linux 的 interpreter path 不能互換。
Expected: 預期：`uv python find 3.11` 回傳可執行的 3.11 path。
Recovery: shell、版本、lock 或 root 不符：錯誤保留，回到該 gate；受阻時使用同情境 fallback。

本頁目的：launcher unavailable 時的第二條入口。
畫面指向：先看標題與 Windows／POSIX uv 兩條入口，再看命令、欄位或箭頭所標示的邊界。
可直接說：uv output 僅表示 interpreter path；READY 與 energy result 由後續 package stages 產生。
必要操作：Windows PowerShell 先執行 winget install --id=astral-sh.uv -e，再執行 uv python install 3.11、uv python find 3.11；WSL/POSIX 執行 uv python install 3.11、uv python find 3.11。畫面上的 path 是 interpreter 定位結果，尚未代表 READY 或 run evidence。
預期畫面或結果：預期：`uv python find 3.11` 回傳可執行的 3.11 path。
失敗處理：shell、版本、lock 或 root 不符：錯誤保留，回到該 gate；受阻時使用同情境 fallback。
銜接下一頁：P017｜P015｜每個 package 使用自己的 `.venv`，把本頁的 Windows／POSIX uv 兩條入口 帶入下一個操作階段。

## P017 — P015｜每個 package 使用自己的 `.venv`

Evidence: LOCAL PRECONDITION
Visual: system Python 與 package-local venv
On-slide: `.venv` 建立於 `lora-energy-lab/` root。Windows 與 WSL／Linux／macOS 使用不同 path，兩者不能互換；Windows 與 WSL 各自建立 venv。

Commands: .\.venv\Scripts\python.exe --version; ./.venv/bin/python --version
Purpose: 將 dependency graph 綁回 package root。
Mechanism: launcher 優先使用 package-local interpreter，使 lock、policy 與 receipt 具備來源關聯。
Expected: 預期：所在平台的 path 顯示 `Python 3.11.x`。
Recovery: 既有 venv minor 錯誤：處理目前 package root 的 `.venv` 後重跑 setup；package root 保持不變。

本頁目的：將 dependency graph 綁回 package root。
畫面指向：先看標題與 system Python 與 package-local venv，再看命令、欄位或箭頭所標示的邊界。
可直接說：activate 非必要；核對 path 與 version，不採用 shell 預設 Python 作為 identity。Windows `.venv\Scripts\python.exe` 與 WSL `.venv/bin/python` 分開建立。
必要操作：在畫面標示的 package/root context 執行命令：.\.venv\Scripts\python.exe --version；./.venv/bin/python --version。
預期畫面或結果：預期：所在平台的 path 顯示 `Python 3.11.x`。
失敗處理：既有 venv minor 錯誤：處理目前 package root 的 `.venv` 後重跑 setup；package root 保持不變。
銜接下一頁：P018｜P016a｜Windows setup：建立可重現 runtime，把本頁的 system Python 與 package-local venv 帶入下一個操作階段。

## P018 — P016a｜Windows setup：建立可重現 runtime

Evidence: SETUP
Visual: CMD／PowerShell 分欄 setup route
On-slide: setup 建立隔離的 Python 3.11／`.venv`／lock runtime。
所有命令在 Windows 的 `lora-energy-lab` root；CMD 與 PowerShell 不混用。

Commands: setup.cmd; .\setup.cmd; uv python install 3.11; $python311 = (uv python find 3.11).Trim(); $env:PYTHON_BIN = ('"{0}"' -f $python311); .\setup.cmd; Remove-Item Env:PYTHON_BIN
Purpose: 建立 Windows 的 package-local runtime。
Mechanism: CMD route 直接執行 `setup.cmd`；PowerShell 的 Python Launcher shortcut 直接執行 `.\setup.cmd`；若改走 uv，先定位 3.11，使用與 README 相同的雙引號 path semantics，以 format expression 設定 `PYTHON_BIN`，完成 setup 後清除該環境變數。
Expected: 預期：package-local `.venv` 與 lock installation 完成；`result.json` 尚未產生。
Recovery: shell、版本、lock 或 root 不符：錯誤保留，回到該 gate；受阻時使用同情境 fallback。

本頁目的：建立 Windows 的 package-local runtime。
畫面指向：先看標題與 CMD／PowerShell 分欄 setup route，再看命令、欄位或箭頭所標示的邊界。
可直接說：CMD 與 PowerShell 各在 Windows package root 執行自己的欄位；WSL path 不混用。setup 的 output 是 runtime state；result 與 endpoint replay 由 RUN stage 產生。
必要操作：所有操作均在 Windows lora-energy-lab root。CMD 執行 setup.cmd；PowerShell 執行 .\setup.cmd；採用 uv fallback 時先取得 $python311、以 `$env:PYTHON_BIN = ('"{0}"' -f $python311)` 設定 interpreter，再執行 .\setup.cmd，完成後移除 PYTHON_BIN。
預期畫面或結果：預期：package-local `.venv` 與 lock installation 完成；`result.json` 尚未產生。
失敗處理：shell、版本、lock 或 root 不符：錯誤保留，回到該 gate；受阻時使用同情境 fallback。
銜接下一頁：P019｜P016b｜Windows verify：前置條件通過才允許 RUN，把本頁的 CMD／PowerShell 分欄 setup route 帶入下一個操作階段。

## P019 — P016b｜Windows verify：前置條件通過才允許 RUN

Evidence: VERIFY
Visual: CMD／PowerShell 分欄 verify route
On-slide: verify 檢查 Python、lock、scenario、policy API、schema。
Windows `lora-energy-lab` root 的 READY 才允許 RUN。

Commands: course.cmd verify; .\course.cmd verify
Purpose: 保存 validation gate receipt。
Mechanism: CMD 與 PowerShell 分別執行自己的 `course.cmd verify`；verify 比對 runtime、release、scenario、schema 與 policy identity，不一致時在 RUN 前停止。
Expected: 預期：`artifacts\verify-receipt.json` 有 `status: READY` 與 `python_version: 3.11.x`；`result.json` 尚未產生。
Recovery: 缺欄位或 status 非 READY：原始錯誤保留，回到 P012–P018；receipt 維持唯讀。

本頁目的：保存 validation gate receipt。
畫面指向：先看標題與 CMD／PowerShell 分欄 verify route，再看命令、欄位或箭頭所標示的邊界。
可直接說：verify 是 validation stage；READY 表示 RUN 的前置條件通過。RUN 產生 result.json 與 endpoint-replay.json，browser import 只讀取這兩筆結果。
必要操作：所有操作均在 Windows lora-energy-lab root。CMD 執行 course.cmd verify；PowerShell 執行 .\course.cmd verify。接著讀取 artifacts\verify-receipt.json，確認 status READY、Python 3.11.x，並確認 result.json 尚未產生。
預期畫面或結果：預期：`artifacts\verify-receipt.json` 有 `status: READY` 與 `python_version: 3.11.x`；`result.json` 尚未產生。
失敗處理：缺欄位或 status 非 READY：原始錯誤保留，回到 P012–P018；receipt 維持唯讀。
銜接下一頁：P020｜P017｜WSL：Ubuntu shell 與 Linux home，把本頁的 CMD／PowerShell 分欄 verify route 帶入下一個操作階段。

## P020 — P017｜WSL：Ubuntu shell 與 Linux home

Evidence: RECOVERY PATH
Visual: Windows host → Ubuntu shell
On-slide: WSL Ubuntu 使用 Linux home 與 bash `.sh`；Windows native 使用 `.cmd`，兩者的 venv path 不互換。

Commands: wsl --install -d Ubuntu; wsl -l -v; wsl -d Ubuntu; pwd; uname -a
Purpose: 區分 `.cmd`、`.sh` 與 venv path。
Mechanism: shell identity 決定 path、launcher 與 interpreter；Linux path 不回傳 Windows venv。
Expected: 預期：`wsl -l -v` 有 Ubuntu，Ubuntu shell 的 `uname -a` 開頭是 Linux。
Recovery: 需要重開機或 distribution 不符：保留提示，依 `wsl -l -v` 修正；WSL 使用 bash `.sh`，Windows 使用 `.cmd`。

本頁目的：區分 `.cmd`、`.sh` 與 venv path。
畫面指向：先看標題與 Windows host → Ubuntu shell，再看命令、欄位或箭頭所標示的邊界。
可直接說：shell identity gate 完成後，uv、venv、READY 與 runner 仍屬後續 stages。Windows CMD 不執行 `.sh`；WSL 使用 `.venv/bin/python`。
必要操作：在畫面標示的 package/root context 執行命令：wsl --install -d Ubuntu；wsl -l -v；wsl -d Ubuntu；pwd；uname -a。
預期畫面或結果：預期：`wsl -l -v` 有 Ubuntu，Ubuntu shell 的 `uname -a` 開頭是 Linux。
失敗處理：需要重開機或 distribution 不符：保留提示，依 `wsl -l -v` 修正；WSL 使用 bash `.sh`，Windows 使用 `.cmd`。
銜接下一頁：P021｜P018｜WSL 工具與 uv 的安裝順序，把本頁的 Windows host → Ubuntu shell 帶入下一個操作階段。

## P021 — P018｜WSL 工具與 uv 的安裝順序

Evidence: RECOVERY PATH
Visual: apt → curl／unzip → uv → Python 3.11
On-slide: 已確認的 Ubuntu shell 執行 `curl`、`unzip`、uv 與 Python 3.11 安裝命令。此 stage 只準備環境；`result.json` 由 runner stage 產生。

Commands: sudo apt update; sudo apt install -y curl unzip; curl -LsSf https://astral.sh/uv/install.sh | sh; uv python install 3.11; uv python find 3.11
Purpose: 準備 WSL interpreter path。
Mechanism: uv 找到的是 WSL／Linux interpreter，不能被 Windows `.cmd` 共用。
Expected: 預期：`uv python find 3.11` 回傳可執行 path。
Recovery: shell、版本、lock 或 root 不符：錯誤保留，回到該 gate；受阻時使用同情境 fallback。

本頁目的：準備 WSL interpreter path。
畫面指向：先看標題與 apt → curl／unzip → uv → Python 3.11，再看命令、欄位或箭頭所標示的邊界。
可直接說：apt、installer 或網路失敗時保留錯誤，修復目前 stage；uv output 不等同 READY。
必要操作：在畫面標示的 package/root context 執行命令：sudo apt update；sudo apt install -y curl unzip；curl -LsSf https://astral.sh/uv/install.sh | sh；uv python install 3.11；uv python find 3.11。
預期畫面或結果：預期：`uv python find 3.11` 回傳可執行 path。
失敗處理：shell、版本、lock 或 root 不符：錯誤保留，回到該 gate；受阻時使用同情境 fallback。
銜接下一頁：P022｜P019a｜將 release asset 複製到 Linux home，把本頁的 apt → curl／unzip → uv → Python 3.11 帶入下一個操作階段。

## P022 — P019a｜將 release asset 複製到 Linux home

Evidence: LOCAL PRECONDITION
Visual: Windows Downloads → WSL Linux home
On-slide: WSL：ZIP 先放 `$HOME`；下一頁只形成一層 `lora-energy-lab`。

Commands: Set-Location "$HOME\Downloads"; Get-ChildItem .\lora-energy-lab-v1.zip; WIN_USER="<Windows帳號>"; cd "/mnt/c/Users/$WIN_USER/Downloads"; cp lora-energy-lab-v1.zip "$HOME/"; cd "$HOME"
Purpose: 把 release asset 放到 WSL Linux home。
Mechanism: Windows PowerShell 只檢查 Downloads；WSL/POSIX 先以 `WIN_USER="<Windows帳號>"` 設定替換欄位，再進入 Windows Downloads，把指定 ZIP 放在 `$HOME`，避免先建立同名資料夾造成雙層 root；Windows venv 不進入 WSL。
Expected: 預期：ZIP 位於 `$HOME/lora-energy-lab-v1.zip`；下一頁解壓後只有 `$HOME/lora-energy-lab/`。
Recovery: copy 失敗：保留命令錯誤，確認實際 Windows 帳號、Downloads 與 WSL interop；不要先建立同名 package directory。

本頁目的：把 release asset 放到 WSL Linux home。
畫面指向：先看標題與 Windows Downloads → WSL Linux home，再看命令、欄位或箭頭所標示的邊界。
可直接說：copy 只搬 release asset，不搬 Git metadata；解壓與 runner evidence 由下一個 stage 產生。
必要操作：Windows PowerShell 先進入 $HOME\Downloads 並確認 ZIP；WSL/POSIX 先以 WIN_USER=<Windows帳號> 對應 Windows 帳號，再進入 Downloads 並把 ZIP 複製到 $HOME，最後以 cd $HOME 準備下一頁的解壓操作。`<Windows帳號>` 是替換欄位。
預期畫面或結果：預期：ZIP 位於 `$HOME/lora-energy-lab-v1.zip`；下一頁解壓後只有 `$HOME/lora-energy-lab/`。
失敗處理：copy 失敗：保留命令錯誤，確認實際 Windows 帳號、Downloads 與 WSL interop；不要先建立同名 package directory。
銜接下一頁：P023｜P019b｜WSL extract／root：建立 Linux venv，把本頁的 Windows Downloads → WSL Linux home 帶入下一個操作階段。

## P023 — P019b｜WSL extract／root：建立 Linux venv

Evidence: LOCAL PRECONDITION
Visual: Linux home → one package root → `.venv/bin/python`
On-slide: Linux home：unzip 後只形成一層 `lora-energy-lab` root。

Commands: unzip lora-energy-lab-v1.zip; cd lora-energy-lab; pwd; PYTHON_BIN=python3.11 bash setup.sh; bash course.sh verify
Purpose: 將 WSL package-local environment 接上 runner gate。
Mechanism: ZIP 只在 Linux home 解壓一次，形成單一 `lora-energy-lab/`；同一 root 對應 `.venv/bin/python`、lock、policy、scenario 與 receipt。
Expected: 預期：`pwd` 是 `$HOME/lora-energy-lab`，JSON 有 `status: READY`、`python_version: 3.11.x`。
Recovery: verify 失敗：錯誤保留，回到 Linux home、one-root extract、interpreter 或 lock gate；Windows `.venv\Scripts\python.exe` 不納入 WSL path。

本頁目的：將 WSL package-local environment 接上 runner gate。
畫面指向：先看標題與 Linux home → one package root → `.venv/bin/python`，再看命令、欄位或箭頭所標示的邊界。
可直接說：READY 可能在此 stage 產生；現場受阻時保留 same-scenario fallback 路徑，claim 維持原證據等級。
必要操作：在 WSL/POSIX Linux home 依序執行 unzip、cd lora-energy-lab、pwd；留在同一 root 後執行 PYTHON_BIN=python3.11 bash setup.sh 與 bash course.sh verify。確認 .venv/bin/python、lock 與 verify-receipt.json 都屬於這個 root。
預期畫面或結果：預期：`pwd` 是 `$HOME/lora-energy-lab`，JSON 有 `status: READY`、`python_version: 3.11.x`。
失敗處理：verify 失敗：錯誤保留，回到 Linux home、one-root extract、interpreter 或 lock gate；Windows `.venv\Scripts\python.exe` 不納入 WSL path。
銜接下一頁：P024｜P020｜POSIX runner 的最小入口，把本頁的 Linux home → one package root → `.venv/bin/python` 帶入下一個操作階段。

## P024 — P020｜POSIX runner 的最小入口

Evidence: LOCAL PRECONDITION
Visual: POSIX setup → verify
On-slide: Linux 與 macOS 在 `lora-energy-lab` root 使用 POSIX launcher，interpreter 固定為 Python 3.11.x。setup 完成且 `course.sh verify` 成功後，進入 policy 操作。

Commands: PYTHON_BIN=python3.11 bash setup.sh; bash course.sh verify
Purpose: 提供非 Windows 的最小可重跑入口。
Mechanism: POSIX path 仍需檢查 venv、lock、policy API、scenario 與 claim boundary。
Expected: 預期：`artifacts/verify-receipt.json` 有 `status: READY`。
Recovery: 缺少 `python3.11`：改走 uv；既有 venv 版本錯誤時處理 package-local `.venv`；verify failure 維持 gate failure。

本頁目的：提供非 Windows 的最小可重跑入口。
畫面指向：先看標題與 POSIX setup → verify，再看命令、欄位或箭頭所標示的邊界。
可直接說：Windows、WSL、macOS 共用 READY 語義；shell/path receipt 保留原樣。
必要操作：在畫面標示的 package/root context 執行命令：PYTHON_BIN=python3.11 bash setup.sh；bash course.sh verify。
預期畫面或結果：預期：`artifacts/verify-receipt.json` 有 `status: READY`。
失敗處理：缺少 `python3.11`：改走 uv；既有 venv 版本錯誤時處理 package-local `.venv`；verify failure 維持 gate failure。
銜接下一頁：P025｜P021a｜verify-receipt.json：schema example，把本頁的 POSIX setup → verify 帶入下一個操作階段。

## P025 — P021a｜verify-receipt.json：schema example

Evidence: RECEIPT
Visual: machine-readable receipt schema／example
On-slide: `verify-receipt.json` 圖例只說明欄位與型別；現場值從 package root 讀取。RUN 輸出另見 `result.json` 與 `endpoint-replay.json`。

Commands: sed -n '1,80p' artifacts/verify-receipt.json; Get-Content .\artifacts\verify-receipt.json; type artifacts\verify-receipt.json
Purpose: 保存 validation receipt 的欄位結構。
Mechanism: receipt fields 描述 status、Python version、lock 與 scenario；run artifact 另有自己的 identity；畫面示意值不替代現場檔案。
Expected: 預期：現場讀取的 receipt 欄位包含 `status: READY`、`python_version: 3.11.x` 與 `scenario_id`；畫面 JSON 僅為 schema example，energy fields 不在此 receipt。
Recovery: 缺檔、版本不符或 status 非 READY：回到 setup；JSON 維持唯讀，現場值以實際 receipt 為準。

本頁目的：保存 validation receipt 的欄位結構。
畫面指向：先看標題與 machine-readable receipt schema／example，再看命令、欄位或箭頭所標示的邊界。
可直接說：先把畫面 JSON 當欄位索引，再用命令讀取 package root 內的 current receipt；RUN 產生 result.json 與 endpoint-replay.json，browser import 只讀取這兩筆結果。
必要操作：在畫面標示的 package/root context 執行命令：sed -n '1,80p' artifacts/verify-receipt.json；Get-Content .\artifacts\verify-receipt.json；type artifacts\verify-receipt.json。
預期畫面或結果：預期：現場讀取的 receipt 欄位包含 `status: READY`、`python_version: 3.11.x` 與 `scenario_id`；畫面 JSON 僅為 schema example，energy fields 不在此 receipt。
失敗處理：缺檔、版本不符或 status 非 READY：回到 setup；JSON 維持唯讀，現場值以實際 receipt 為準。
銜接下一頁：P026｜P021b｜逐欄解讀：READY 與 energy evidence 分層，把本頁的 machine-readable receipt schema／example 帶入下一個操作階段。

## P026 — P021b｜逐欄解讀：READY 與 energy evidence 分層

Evidence: LOCAL PRECONDITION
Visual: scenario／engine／claim fields
On-slide: READY receipt 提供四個 identity fields。
四欄共同限定 claim ceiling；energy result 另屬 run evidence。

Commands: none (concept / boundary page)
Purpose: 讀取 identity 與 claim ceiling。
Mechanism: scenario_id（情境識別碼，字串）、policy_api_version（介面版本，字串）、engine_mode（引擎模式，分類）、upstream（上游執行，布林）限定來源；claim boundary 限定可說範圍。
Expected: 預期：欄位相符後進入 policy；mismatch 維持 gate failure。
Recovery: scenario_id 存在不建立 result evidence；缺欄位：gate failure，source mode 與 recovery evidence 保留。

本頁目的：讀取 identity 與 claim ceiling。
畫面指向：先看標題與 scenario／engine／claim fields，再看命令、欄位或箭頭所標示的邊界。
可直接說：identity receipt 描述 course model 的來源欄位；energy run 與部署量測使用各自 evidence 分類。
必要操作：本頁屬於概念或邊界頁；沿著畫面上的 scenario／engine／claim fields 閱讀，不改動 runner、schema 或 generated JSON。
預期畫面或結果：預期：欄位相符後進入 policy；mismatch 維持 gate failure。
失敗處理：scenario_id 存在不建立 result evidence；缺欄位：gate failure，source mode 與 recovery evidence 保留。
銜接下一頁：P027｜P022｜setup 失敗：gate repair 與 same-scenario fallback，把本頁的 scenario／engine／claim fields 帶入下一個操作階段。

## P027 — P022｜setup 失敗：gate repair 與 same-scenario fallback

Evidence: RECOVERY PATH
Visual: Windows／WSL verify fallback route
On-slide: 失敗範圍限於 Python minor、root、lock 或 policy。
READY 缺少時，分 shell verify，再選 same-scenario-fallback。

Commands: .\course.cmd verify; bash course.sh verify
Purpose: 建立 fail-closed recovery 決策樹。
Mechanism: Windows 使用 `.\course.cmd verify`；WSL/POSIX 使用 `bash course.sh verify`；兩條 route 都保留 error receipt，再依 same-scenario-fallback 維持問題與 evidence 邊界。
Expected: 預期：error receipt 保留；fallback pair 具有同一 exact-case 的 result 與 replay。
Recovery: result、replay 與 receipt 維持唯讀。runner inspection 與 Leo import pending 分開記錄。

本頁目的：建立 fail-closed recovery 決策樹。
畫面指向：先看標題與 Windows／WSL verify fallback route，再看命令、欄位或箭頭所標示的邊界。
可直接說：fallback 分支保留原始 evidence 等級，不重命名受阻環境的結果狀態。
必要操作：Windows PowerShell 在 package root 執行 .\course.cmd verify；WSL/POSIX 在 package root 執行 bash course.sh verify。先保留 error receipt，再修復目前指出的最小 gate；修復仍未完成時只選同情境 fallback，不改寫來源標籤。
預期畫面或結果：預期：error receipt 保留；fallback pair 具有同一 exact-case 的 result 與 replay。
失敗處理：result、replay 與 receipt 維持唯讀。runner inspection 與 Leo import pending 分開記錄。
銜接下一頁：P028｜P023｜可編輯檔案只有 `student_policy.py` 的 marked block，把本頁的 Windows／WSL verify fallback route 帶入下一個操作階段。

## P028 — P023｜可編輯檔案只有 `student_policy.py` 的 marked block

Evidence: SOURCE BOUNDARY
Visual: 可編輯檔與四個 read-only 鎖
On-slide: 每個 lab 只修改 `student_policy.py` 目前 active 的 marked block；scenario、schemas、runner、Leo code 與 generated JSON 均為 read-only。

Commands: sed -n '1,140p' student_policy.py; Get-Content .\student_policy.py; git diff -- student_policy.py
Purpose: 分離 policy edit 與 evidence engine。
Mechanism: small diff → predecessor／freeze receipt → 可解釋結果。
Expected: 預期：diff 只落在 active block，檔案通過 policy guard。
Recovery: marker 或 package identity 不符：檔案與錯誤保留，回到 package identity；runner 與 JSON 維持唯讀。

本頁目的：分離 policy edit 與 evidence engine。
畫面指向：先看標題與 可編輯檔與四個 read-only 鎖，再看命令、欄位或箭頭所標示的邊界。
可直接說：此檔案是唯一允許修改的控制面；API、常數、條件與 return 需與 read-only boundary 分開。
必要操作：此頁維持定位概念。畫面上的 student_policy.py 與 active marked block 是通用邊界；可用 sed -n 或 Get-Content 讀取檔案並以 git diff 觀察差異，此頁維持唯讀，精確修改不在這裡執行。Lab A、B、C 的 path、marker、before/after 與編輯命令在 Part B。
預期畫面或結果：預期：diff 只落在 active block，檔案通過 policy guard。
失敗處理：marker 或 package identity 不符：檔案與錯誤保留，回到 package identity；runner 與 JSON 維持唯讀。
銜接下一頁：P029｜P024｜policy 讀取邊界與合法 action，把本頁的 可編輯檔與四個 read-only 鎖 帶入下一個操作階段。

## P029 — P024｜policy 讀取邊界與合法 action

Evidence: SOURCE BOUNDARY
Visual: observation → legal action
On-slide: `choose_action(observation)` 僅使用目前與過去允許的 observation；future quality、future energy 與 result summary 不屬於輸入；輸出符合 action contract。

Commands: sed -n '1,140p' student_policy.py; Get-Content .\student_policy.py
Purpose: 定義 bounded policy API 的讀取邊界。
Mechanism: 觀察欄位包含 window、quality、queue、pace、previous action 與 deadline；輸出限定為 `WAIT`、`SLEEP`、`SEND_ONE`、`SEND_URGENT`、`FLUSH_BATCH`。
Expected: 預期：`contact_open = false` 時，`SEND_ONE` 不合法；安全路徑為 `SLEEP`。
Recovery: policy guard 或 syntax failure：active marked block only；runner、schema 與 generated JSON 維持唯讀。

本頁目的：定義 bounded policy API 的讀取邊界。
畫面指向：先看標題與 observation → legal action，再看命令、欄位或箭頭所標示的邊界。
可直接說：未知欄位、future leakage 或契約外 action：fail closed；active block 以外的內容維持不變。
必要操作：此頁維持 policy API 的定位概念。沿著 choose_action(observation)、observation 與 legal action 閱讀，檔案保持唯讀；精確 marked block 與 edit 順序在 Part B，future 欄位與 result summary 維持 read-only。
預期畫面或結果：預期：`contact_open = false` 時，`SEND_ONE` 不合法；安全路徑為 `SLEEP`。
失敗處理：policy guard 或 syntax failure：active marked block only；runner、schema 與 generated JSON 維持唯讀。
銜接下一頁：P030｜P025｜常數是受控旋鈕：一次只改一個值，把本頁的 observation → legal action 帶入下一個操作階段。

## P030 — P025｜常數是受控旋鈕：一次只改一個值

Evidence: SOURCE BOUNDARY
Visual: A／B／C controls
On-slide: 修改一個 bounded constant，執行 exact case。
A／B／C 的控制名稱見下方三個 lab。

Commands: grep -n 'REST_DURING_GAP\|STABLE_STEPS\|URGENT_MARGIN_S' student_policy.py
Purpose: 定義三個 lab 的第一個 edit。
Mechanism: A：`SLEEP → WAIT` 改變 gap 的 awake-idle／wake；B：`2 → 1` 改變 quality hold；C：`20 → 5` 改變 urgent deadline branch。
Expected: 預期：方向性 prediction 先記錄；KPI 改善不預設。
Recovery: policy guard 或 syntax failure：active marked block only；runner、schema 與 generated JSON 維持唯讀。

本頁目的：定義三個 lab 的第一個 edit。
畫面指向：先看標題與 A／B／C controls，再看命令、欄位或箭頭所標示的邊界。
可直接說：gap、quality、batch 與 margin 分開修改。guard failure 時回到 package baseline 或上一個 freeze 的 exact block。
必要操作：此頁只建立定位概念與三個受控旋鈕的索引。可在 package root 以 grep -n 或對應的文字搜尋 確認 REST_DURING_GAP、STABLE_STEPS、URGENT_MARGIN_S；精確 before/after 與 candidate run 轉到 Part B、Part C。
預期畫面或結果：預期：方向性 prediction 先記錄；KPI 改善不預設。
失敗處理：policy guard 或 syntax failure：active marked block only；runner、schema 與 generated JSON 維持唯讀。
銜接下一頁：P031｜P026｜條件分支：observation 轉成 action，把本頁的 A／B／C controls 帶入下一個操作階段。

## P031 — P026｜條件分支：observation 轉成 action

Evidence: SOURCE BOUNDARY
Visual: mechanism-only pseudocode：observation 轉成 legal action
On-slide: `choose_action` 依窗口、急件期限與 pacing 產生 action。右側說明分支機制；實際修改位置是 `student_policy.py` 的 marked block。

Commands: grep -n 'choose_action\|contact_open\|URGENT_MARGIN_S' student_policy.py
Purpose: 建立程式碼到機制的閱讀橋。
Mechanism: 窗口關閉 → `SLEEP`；urgent 逼近 → `SEND_URGENT`；距離上次送出太近 → `REST_DURING_GAP`。
Expected: 預期：`URGENT_MARGIN_S` 增大時，`SEND_URGENT` 觸發點提前。
Recovery: policy guard 或 syntax failure：active marked block only；runner、schema 與 generated JSON 維持唯讀。

本頁目的：建立程式碼到機制的閱讀橋。
畫面指向：先看標題與 mechanism-only pseudocode：observation 轉成 legal action，再看命令、欄位或箭頭所標示的邊界。
可直接說：名稱、縮排或 guard failure：active marked block 內修復；branch prediction 與 evidence 分開記錄；畫面 pseudocode 不替代 exact source。
必要操作：在 package root 以 grep -n 找到 choose_action、contact_open 與 URGENT_MARGIN_S，逐段閱讀條件與 return；此頁只做 branch reading，policy 保持唯讀，預測也不當成 result evidence。
預期畫面或結果：預期：`URGENT_MARGIN_S` 增大時，`SEND_URGENT` 觸發點提前。
失敗處理：policy guard 或 syntax failure：active marked block only；runner、schema 與 generated JSON 維持唯讀。
銜接下一頁：P032｜P027｜RUN：baseline 產生兩筆結果，把本頁的 mechanism-only pseudocode：observation 轉成 legal action 帶入下一個操作階段。

## P032 — P027｜RUN：baseline 產生兩筆結果

Evidence: RUN
Visual: Windows PowerShell／WSL-POSIX 分欄 baseline
On-slide: Baseline：固定 scenario、seed 與原始 policy 的對照執行。
兩個 shell 都在 `lora-energy-lab` root；各用本平台 Python 3.11 venv。

Commands: .\.venv\Scripts\python.exe -m py_compile student_policy.py; .\course.cmd run --lab A --case baseline; ./.venv/bin/python -m py_compile student_policy.py; bash course.sh run --lab A --case baseline
Purpose: 建立第一筆 control evidence。
Mechanism: Windows PowerShell 使用 `.venv\Scripts\python.exe` 與 `course.cmd`；WSL/POSIX 使用 `.venv/bin/python` 與 `bash course.sh`。兩條命令鏈固定 scenario／seed，產生 `result.json`、`endpoint-replay.json`、run identity 與 endpoint replay。
Expected: 預期：`status: OK`、`artifact_source: student-run`、JSON 印出 `result_path`，並有 `endpoint-replay.json`。
Recovery: compile 或 RUN failure：stdout/stderr 保留，回到 marked block、READY 或 predecessor gate；JSON 維持唯讀。

本頁目的：建立第一筆 control evidence。
畫面指向：先看標題與 Windows PowerShell／WSL-POSIX 分欄 baseline，再看命令、欄位或箭頭所標示的邊界。
可直接說：baseline 是固定情境、隨機種子與原始 policy 的對照執行。RUN 先產生 result.json 與 endpoint-replay.json；browser import 只讀取這兩筆結果。
必要操作：兩個 shell 都在 lora-energy-lab root。Windows PowerShell 先以 .\.venv\Scripts\python.exe -m py_compile student_policy.py 驗證語法，再執行 .\course.cmd run --lab A --case baseline；WSL/POSIX 使用 ./.venv/bin/python -m py_compile student_policy.py，再執行 bash course.sh run --lab A --case baseline。保留 stdout 的 result_path，並在同一 run 目錄讀取 result.json 與 endpoint-replay.json。
預期畫面或結果：預期：`status: OK`、`artifact_source: student-run`、JSON 印出 `result_path`，並有 `endpoint-replay.json`。
失敗處理：compile 或 RUN failure：stdout/stderr 保留，回到 marked block、READY 或 predecessor gate；JSON 維持唯讀。
銜接下一頁：P033｜P028｜Windows 手動建立 Python 3.11 `.venv`，把本頁的 Windows PowerShell／WSL-POSIX 分欄 baseline 帶入下一個操作階段。

## P033 — P028｜Windows 手動建立 Python 3.11 `.venv`

Evidence: LOCAL PRECONDITION
Visual: PowerShell：檢查／安裝／venv module／建立
On-slide: PowerShell 位於 `lora-energy-lab` root：先確認 Python 3.11，再確認 `venv` module，最後建立 `.venv`。Windows path 使用 `.venv\Scripts\python.exe`。

Commands: py -3.11 --version; $python311 = (py -3.11 -c "import sys; print(sys.executable)").Trim(); winget install --id=astral-sh.uv -e; uv python install 3.11; $python311 = (uv python find 3.11).Trim(); & $python311 --version; & $python311 -m venv --help; & $python311 -m venv .venv
Purpose: 把 Windows interpreter 與 package-local venv 連在同一個操作流程。
Mechanism: `py -3.11` 成功時沿用其 path；缺少 3.11 時由 uv 安裝並定位；`-m venv` 確認 standard-library module 後建立 root 內的 `.venv`。
Expected: 預期：`& $python311 --version` 顯示 3.11.x，`-m venv --help` 成功，並產生 `.venv\Scripts\python.exe`。
Recovery: shell、版本、lock 或 root 不符：錯誤保留，回到該 gate；受阻時使用同情境 fallback。

本頁目的：把 Windows interpreter 與 package-local venv 連在同一個操作流程。
畫面指向：先看標題與 PowerShell：檢查／安裝／venv module／建立，再看命令、欄位或箭頭所標示的邊界。
可直接說：PowerShell 命令都在 Windows package root 執行；uv-managed Python 與 Python Launcher 的 3.11 path 都可作為 `PYTHON_BIN`。
必要操作：PowerShell 位於 lora-energy-lab root。先執行 py -3.11 --version 並定位 $python311；缺少 3.11 時依序執行 winget/uv route，再執行 & $python311 -m venv .venv。最後確認 .venv\Scripts\python.exe 已建立。
預期畫面或結果：預期：`& $python311 --version` 顯示 3.11.x，`-m venv --help` 成功，並產生 `.venv\Scripts\python.exe`。
失敗處理：shell、版本、lock 或 root 不符：錯誤保留，回到該 gate；受阻時使用同情境 fallback。
銜接下一頁：P034｜P029｜Windows 啟用 `.venv`、locked install、verify，把本頁的 PowerShell：檢查／安裝／venv module／建立 帶入下一個操作階段。

## P034 — P029｜Windows 啟用 `.venv`、locked install、verify

Evidence: SETUP
Visual: PowerShell activation → locked install → verify
On-slide: 建立 `.venv` 後在同一個 PowerShell 視窗啟用、確認 prefix、安裝 locked requirements，再執行 `course.cmd verify`。

Commands: .\.venv\Scripts\Activate.ps1; python --version; python -c "import sys; assert sys.prefix != sys.base_prefix; print(sys.executable)"; python -m pip install --disable-pip-version-check --require-hashes --no-deps -r .\requirements-lock.txt; .\course.cmd verify
Purpose: 讓 Windows 手動流程產生可觀察的 READY gate。
Mechanism: activation 將 `python` 綁到 `.venv\Scripts\python.exe`；locked install 固定 package contract；verify 產生 `artifacts\verify-receipt.json`。
Expected: 預期：版本是 3.11.x、`sys.prefix` 不等於 `sys.base_prefix`，verify receipt 的 status 是 READY。
Recovery: shell、版本、lock 或 root 不符：錯誤保留，回到該 gate；受阻時使用同情境 fallback。

本頁目的：讓 Windows 手動流程產生可觀察的 READY gate。
畫面指向：先看標題與 PowerShell activation → locked install → verify，再看命令、欄位或箭頭所標示的邊界。
可直接說：若 PowerShell 不允許 `Activate.ps1`，Windows Command Prompt 可用 `call .venv\Scripts\activate.bat`；`.sh` 不在 Windows CMD 執行。
必要操作：在同一個 Windows PowerShell 視窗執行 .\.venv\Scripts\Activate.ps1、python --version、prefix assertion、locked requirements install 與 .\course.cmd verify。若 Activate.ps1 受限，改用 Command Prompt 的 call .venv\Scripts\activate.bat，仍在同一 root 執行 course.cmd verify。
預期畫面或結果：預期：版本是 3.11.x、`sys.prefix` 不等於 `sys.base_prefix`，verify receipt 的 status 是 READY。
失敗處理：shell、版本、lock 或 root 不符：錯誤保留，回到該 gate；受阻時使用同情境 fallback。
銜接下一頁：P035｜P030｜WSL Ubuntu 24.04：定位並安裝 Python 3.11，把本頁的 PowerShell activation → locked install → verify 帶入下一個操作階段。

## P035 — P030｜WSL Ubuntu 24.04：定位並安裝 Python 3.11

Evidence: RECOVERY PATH
Visual: WSL／Ubuntu：detect → apt prerequisite → curl → uv
On-slide: WSL Ubuntu 24.04 先查 apt Candidate。有則安裝 Python 3.11 與 venv；否則以 uv 安裝。兩個分支都設定 `PYTHON_BIN`，供下一頁建立 `.venv`。

Commands: command -v python3.11; python3.11 --version; apt-cache policy python3.11 python3.11-venv; sudo apt update; sudo apt install -y python3.11 python3.11-venv; PYTHON_BIN="$(command -v python3.11)"; sudo apt install -y curl unzip; curl -LsSf https://astral.sh/uv/install.sh | sh; export PATH="$HOME/.local/bin:$PATH"; uv python install 3.11; PYTHON_BIN="$(uv python find 3.11)"; "$PYTHON_BIN" --version
Purpose: 建立 WSL 的 exact interpreter path。
Mechanism: 若 `apt-cache policy` 有 Candidate，安裝 `python3.11` 與 `python3.11-venv`，再以 `PYTHON_BIN="$(command -v python3.11)"` 保存 exact path；沒有 Candidate 時補 curl/unzip、安裝 uv，再以 `PYTHON_BIN="$(uv python find 3.11)"` 保存 exact path。
Expected: 預期：兩個分支都讓 `PYTHON_BIN` 指向 WSL／Linux 的 Python 3.11.x；Windows interpreter path 不進入 WSL。
Recovery: shell、版本、lock 或 root 不符：錯誤保留，回到該 gate；受阻時使用同情境 fallback。

本頁目的：建立 WSL 的 exact interpreter path。
畫面指向：先看標題與 WSL／Ubuntu：detect → apt prerequisite → curl → uv，再看命令、欄位或箭頭所標示的邊界。
可直接說：apt 與 uv 分支都在 Ubuntu／WSL bash 設定 `PYTHON_BIN`，接續頁直接以同一變數建立 `.venv`。
必要操作：上述命令只在 Ubuntu/WSL bash 執行。先以 command -v python3.11 與 python3.11 --version 檢查，再以 apt-cache policy 檢查 python3.11-venv；接著執行 sudo apt update；有 Candidate 時執行 sudo apt install -y python3.11 python3.11-venv，沒有 Candidate 時以 apt 補 curl/unzip，再安裝 uv、定位 Python 3.11，將 PYTHON_BIN 留在同一個 bash session 給下一頁使用。
預期畫面或結果：預期：兩個分支都讓 `PYTHON_BIN` 指向 WSL／Linux 的 Python 3.11.x；Windows interpreter path 不進入 WSL。
失敗處理：shell、版本、lock 或 root 不符：錯誤保留，回到該 gate；受阻時使用同情境 fallback。
銜接下一頁：P036｜P031｜WSL `.venv/bin`：建立、啟用、locked install、verify，把本頁的 WSL／Ubuntu：detect → apt prerequisite → curl → uv 帶入下一個操作階段。

## P036 — P031｜WSL `.venv/bin`：建立、啟用、locked install、verify

Evidence: SETUP
Visual: WSL／Ubuntu：venv module → source → install → verify
On-slide: WSL root 使用 `PYTHON_BIN` 建立 Linux `.venv`；source 後確認 3.11、locked install，再執行 `bash course.sh verify`。

Commands: "$PYTHON_BIN" -m venv --help; "$PYTHON_BIN" -m venv .venv; source .venv/bin/activate; python --version; python -c 'import sys; assert sys.prefix != sys.base_prefix; print(sys.executable)'; python -m pip install --disable-pip-version-check --require-hashes --no-deps -r requirements-lock.txt; bash course.sh verify
Purpose: 讓 WSL 手動流程產生可觀察的 READY gate。
Mechanism: `source` 將 `python` 綁到 `.venv/bin/python`；locked install 固定 package contract；verify 產生 `artifacts/verify-receipt.json`。
Expected: 預期：版本是 3.11.x、prefix 與 base prefix 不同，verify receipt 的 status 是 READY。
Recovery: shell、版本、lock 或 root 不符：錯誤保留，回到該 gate；受阻時使用同情境 fallback。

本頁目的：讓 WSL 手動流程產生可觀察的 READY gate。
畫面指向：先看標題與 WSL／Ubuntu：venv module → source → install → verify，再看命令、欄位或箭頭所標示的邊界。
可直接說：Windows `.venv\Scripts\python.exe` 與 WSL `.venv/bin/python` 是兩個 filesystem 內的環境；`.sh` 僅在 WSL／Linux bash 執行，Windows CMD 使用 `.cmd`。
必要操作：在同一個 WSL root 與 bash session 使用 PYTHON_BIN 執行 venv module check、建立 .venv、source .venv/bin/activate、確認 prefix、安裝 locked requirements，最後執行 bash course.sh verify。讀取 verify receipt 的 READY，再進入後續 policy stage。
預期畫面或結果：預期：版本是 3.11.x、prefix 與 base prefix 不同，verify receipt 的 status 是 READY。
失敗處理：shell、版本、lock 或 root 不符：錯誤保留，回到該 gate；受阻時使用同情境 fallback。
本模組在此收束；保留 READY 與 baseline receipt，後續實驗從對應的操作頁開始。
