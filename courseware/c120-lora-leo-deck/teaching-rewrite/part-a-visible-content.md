# P001–P027｜可直接授課的可見內容重寫

用途：把開場、環境準備與 Python policy 入門改成「投影後就知道為什麼做、下一步做什麼、結果怎麼讀」的教學頁。這份檔案只描述可見文案、操作卡與版面要求；不改 builder、不改既有 PPTX。

## 使用邊界與呈現契約

這一段的課程主問題是：**一個電池有限的 IoT endpoint，如何在會開、會關、品質會變的 service window 內送達資料，同時不把能量花在錯的地方？** 每頁先回答這個問題的一小步，再引入名詞或工具。

目前可由 repo 與 `/home/u24/lora-energy-lab` 直接對齊的 runner facts：

- scenario：`ntpu-energy-decision-01`；course：`LORA-ENERGY-DECISION-1R`。
- runner engine：`coherent-course-simulated-adapter`；`upstream_execution: false`。
- 合法 action：`SLEEP`、`WAIT`、`SEND_ONE`、`SEND_URGENT`、`FLUSH_BATCH`。
- package 內有 `README.zh-TW.md`、`setup.sh` / `setup.cmd`、`course.sh` / `course.cmd`、`student_policy.py`、schemas 與同情境 fallback pairs。
- 最新操作盤點只確認 runner package 已定位、ZIP hash 已核對；fresh Python 3.11 setup、`READY`、十個 case、Leo strict import 與瀏覽器排演仍不能寫成已完成。投影片上的成功訊號因此一律寫成「預期看到」，不冒充現場證據。

### 字級、色彩與版面

- 標題 36–44pt；主要教學句 24–28pt；一般說明 24–26pt；命令與程式碼 20–22pt；必要的 provenance／狀態標籤最低 18pt。任何文字不得小於 18pt。
- 每頁只保留一個主問題與一個主視覺；操作頁最多一個主要命令群，若跨平台命令、預期輸出與復原無法在 24–28pt 清楚呈現，就照頁末的拆分建議增加頁面。
- 使用深藍／米白／青綠或深紫作為主色；正文必須高對比。**禁止亮橘色文字**；錯誤訊息可用深紅底卡或紫紅底卡，但字仍維持 18pt 以上。
- 不使用固定的五問橫列。每頁依內容採 hero、流程、比較、命令卡、分叉、程式註解或結果卡等不同版面。
- 本檔不使用課程時間或分鐘標籤；頁碼只用 P001–P027。

### 投影上的證據語氣

`PACKAGE-CONTENT-VERIFIED` 只表示 README、script 或封裝內容中確實存在；`RUNNER-PACKAGE-HASH-VERIFIED` 只表示 package identity 已核對；`LOCAL-VERIFIED` 才表示本次 controller 完成 fresh setup、receipt、run artifact 與核對。任何未達後者的頁面，都用「若成功」「預期」「待現場核對」，不使用「已跑出」。

## P001｜一顆小小的電池，能不能等到下一個服務窗口？

**版面：** 具體情境 hero。左側是電池供電的環境感測節點，右側是正在開啟、即將關閉的 gateway service window；中間只放一條封包路徑。

**投影主文（24–28pt）：**

> 一個電池有限的環境感測節點，必須把資料封包送進會開、會關的服務窗口。太早醒著等會耗電；錯過窗口，封包可能延遲或過期。

**講師直接說：**「先想像這個節點在田區、倉庫或校園角落，不能隨時插電。它不是單純選『省電』；它要在有限電池、有限服務機會與資料新鮮度之間做決定。」

**投影停一下：**「窗口只剩一小段時間時，你會立刻送、保持清醒等，還是先睡？請說出你保護的那一件事。」

**教學目的：** 讓全班先看見「服務可能消失」與「電量有限」同時存在；尚不介紹 LEO、Python 或 JSON。

**主標籤：** `固定教學情境｜endpoint-first｜尚未執行 runner`

**Fit：** 一頁可放下；情境句不可被縮成名詞。

## P002｜現在送不一定最好，等一下也不一定省電

**版面：** 三欄取捨卡；每欄是一個 action 的後果，不放公式。

**投影主文：**

> 立刻送，可能守住窗口，卻會付出處理與收發的能量。保持清醒等待，可能等到更好的品質，卻持續消耗 awake-idle；進入睡眠，功率較低，卻多了喚醒時間與喚醒能量。

**三張可見卡片：**

| 選擇 | 先保護什麼 | 可能失去什麼 |
|---|---|---|
| `SEND` | 服務機會與資料進度 | process／TX／RX 能量、碰撞或重試風險 |
| `WAIT` | 保持反應能力，等待更合適的條件 | awake-idle 時間與能量 |
| `SLEEP` | 降低等待期間功率 | wake latency、wake energy，甚至錯過窗口 |

**全班先判斷：**「如果窗口關閉時還在等待，最重要的不是把數字變漂亮，而是先避免哪一種不合法行為？」預期回答：不能在關閉窗口執行送出；policy 必須選擇可執行的休眠路徑。

**講師補充：**「我們稍後不是比較一個孤立的 J，而是看 action 如何改變 state、packet、service，再看累積的 endpoint energy。」

**Fit：** 一頁可放下；三欄每格最多兩行，正文維持 24pt。

## P003｜WAIT、SLEEP、SEND 是可控制的選擇

**版面：** 中央三段狀態帶，下面接一條「action → 可觀察後果」箭頭；採青綠、米白、深紫，不用亮橘。

**投影主文：**

> policy 每一步只選一個可執行 action；action 會改變 radio state、packet 進度與服務結果。這堂課的價值，是讓每個選擇留下可以回看的事件，而不是只問最後哪個數字比較小。

**可見 action 帶：**

- `WAIT`：radio 保持可反應，等待條件改善；代價是 awake-idle。
- `SLEEP`：降低休眠功率；代價是喚醒延遲與喚醒能量。
- `SEND`：在實際 runner 中展開成 `SEND_ONE`、`SEND_URGENT` 或 `FLUSH_BATCH`；會留下 process、TX、RX、attempt、retry 與 delivery 證據。

**小問題：**「`contact_open = false` 時，哪一類 action 不該被送進 runner？」答案是任何 `SEND_*`；這份 engine 的安全路徑只允許 `SLEEP`。

**講師直接說：**「這裡先建立 vocabulary。等看到結果時，請先找『剛剛選了什麼 action』，再找它造成的 state 和 packet 事件。」

**Fit：** 一頁可放下；`SEND` 的三個具體 token 不得縮到 18pt 以下。

## P004｜完成這堂課，你能把一個 policy 選擇說清楚

**版面：** 四格承諾卡，使用「改 → 跑 → 讀 → 解釋」四個大字作視覺錨點。

**投影主文：**

> 你會改一個受控的 policy 值，執行同一個固定情境，讀出 state、packet、service 與 endpoint J，最後用因果鏈說明結果為什麼改變。若結果推翻原先預測，也保留它，因為可反駁的假說比漂亮的單一數字更有教學價值。

**四格內容：**

1. **改一個值：** 只動 `student_policy.py` 的指定 marked block。
2. **執行一次：** 用 exact lab/case 命令產生帶有 run identity 的 JSON。
3. **讀事件：** 看 state interval、packet attempt／delivery／expiry、service 與 endpoint energy。
4. **說機制：** 把 policy → action → event → service／J 串回來；不把模擬結果說成量測。

**投影提問：**「做完後，你要能回答的是『哪個數字最小』，還是『哪個 policy 機制造成這個差異』？」預期回答是後者。

**Fit：** 一頁可放下；每格只保留一個動詞與一個完整短句。

## P005｜先看因果鏈，再看 J

**版面：** 六段可編輯流程圖，箭頭寬、節點少；每個節點下面一行解釋。

**投影主文：**

> 可檢驗的節能敘事必須沿著 `observation → policy → action → state / packet → service → endpoint J` 前進。J 是累積結果，不是 policy 直接寫出的答案；中間任何一段沒有差異，就不能把最後的變化歸因給這次修改。

**節點短句：**

- `observation`：此刻看得到的品質、窗口、佇列與期限。
- `policy`：依目前資訊選擇 bounded action。
- `action`：`WAIT`、`SLEEP` 或某種 `SEND_*`。
- `state / packet`：radio 狀態、attempt、retry、delivery、expiry。
- `service`：資料是否在期限與新鮮度規則內完成。
- `endpoint J`：endpoint radio／processing 假設累積的焦耳。

**請指向箭頭：**「如果 `service` 失敗但 `endpoint J` 下降，能不能直接叫作成功節能？」不能；先記錄服務邊界，再討論能量取捨。

**講師補充：**「這條鏈會成為後面每次看 JSON 或 replay 的讀法。」

**Fit：** 一頁可放下；若中文說明放不下，保留六個節點並把完整句放在下方，不得只剩箭頭。

## P006｜為什麼需要一個可重跑的 endpoint runner？

**版面：** 左側「可操作」與右側「不能宣稱」的比較頁；左側放小型事件 ledger，右側放 claim shield。

**投影主文：**

> runner 把同一個固定 scenario、同一組 policy 規則與同一個 seed 變成可重跑的教學證據。它讓我們比較 policy 改動造成的 state、packet、service 與 endpoint energy 差異，但不會因此變成 live telemetry、部署量測或上游研究程式的 parity 證明。

**左卡：runner 可以回答**

- 哪些時間進入 sleep、awake-idle、process、TX、RX。
- 有幾次 packet attempt、retry、delivery 或 expiry。
- endpoint energy 與 service 結果是否一起改變。

**右卡：runner 不會自動回答**

- 真實裝置、真實網路或 wall-plug system energy。
- 上游 `GillesC/LoRaEnergySim` 已在此封裝中被執行。
- 整個 LEO 或 C-120 system 的 canonical consumed J。

**結果卡提問：**「如果 candidate 的 J 下降但 required packet 沒送達，這是完整成功嗎？」不是；這是需要保留的 trade-off／失敗結果。

**Fit：** 一頁可放下；左右卡每格最多三行。

## P007｜LEO 是 changing service window 的例子，不是課程終點

**版面：** 橫向窗口時間線：`機會出現 → policy 選擇 → 服務／能量後果`；下方放三個可轉移場景小卡。

**投影主文：**

> LEO 在這裡只把「服務機會會改變」畫得清楚：窗口可能開啟、關閉、變短，品質也可能變化。真正要學的是在 changing opportunity 下做 endpoint policy；同一個機制可轉到田區上傳、HVAC 低負載時段、物流追蹤或邊緣連線。

**可見小卡：**

- `LEO`：窗口隨時間移動的 worked example。
- `智慧農場`：閘道可用時段改變上傳策略。
- `HVAC／物流／edge`：低負載或可連線時段改變等待與批次。

**轉移問題：**「把 LEO 換成 HVAC，changing service window 可能是哪一段時間？」可回答成低負載、網路可用或能源價格較合適的時段；不要求軌道或 link-budget 推導。

**講師直接說：**「所以今天不先教衛星術語；先教一個可轉移的控制問題，再把 LEO 當成視覺上容易看懂的窗口。」

**Fit：** 一頁可放下；時間線與場景卡不可互相壓字。

## P008｜從預測到結果：每一次修改都要留下證據

**版面：** 環形流程，但不做固定問答欄；每個節點是一個動作與一句目的。

**投影主文：**

> 先寫下對 state、packet、service 或 endpoint J 的預測，再改 marked policy、執行 exact case、讀取結果，最後用沒有重新調參的 withheld case 檢驗假說。流程的終點不是「跑通」，而是能指出哪一段因果鏈支持或推翻預測。

**流程節點：**

1. `預測`：寫一個可被 result 反駁的方向。
2. `bounded edit`：只改 active marked block。
3. `deterministic run`：保留 command 印出的 `result_path`。
4. `讀證據`：對照 state／packet／service／J。
5. `withheld`：沿用 frozen policy，不為 withheld 重新調參。

**小問題（寫在圓環中央）：**「如果結果和預測相反，第一個動作是改回數字，還是把反例留下來並找中間事件？」答案是留下反例，先找中間事件。

**Fit：** 一頁可放下；每個節點只用一行動詞與一行解釋。

## P009｜現在才建立 claim 與 provenance 邊界

**版面：** 兩層盾牌：第一層是「這次 runner 產生什麼」，第二層是「它不能冒充什麼」；不要把這頁做成開場封面。

**投影主文：**

> 我們使用的是固定 scenario、固定契約、deterministic 的課程模擬資料；每一份 result 與 replay 的 claim ceiling 都是 `SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED`。package identity、policy hash、scenario identity 與 source mode 必須一起保存，才能知道這筆證據從哪裡來。

**可見邊界：**

- **可以說：** policy 改動在本課程模型中造成哪些 state、packet、service 與 endpoint-energy 差異。
- **不能說：** 這是部署量測、整個 system 的 consumed J，或上游研究 repository 已被這個 runner 執行。
- **來源模式：** `student-run` 與 `same-scenario-fallback` 必須原樣保留，不能互換名稱。

**檢查點提問：**「`READY` receipt 是否等於已完成 energy experiment？」不是；`READY` 只表示環境與契約可進入 runner。

**講師補充：**「目前盤點已確認 package 位於 server、ZIP hash 一致；fresh Python run 與 Leo import 仍待實機 gate。這是我們之後報告證據等級的規則。」

**Fit：** 一頁可放下；完整 claim ceiling 用 20pt 等寬字，其他主文 24pt。

## P010｜一個 release asset，一個 package 根目錄

**版面：** package anatomy；左側顯示 ZIP 內單一 `lora-energy-lab/` root，右側是「不要拼檔」的鎖頭卡。避免使用 Git logo 作裝飾，直接寫清楚限制。

**投影主文：**

> 請使用講師指定的 release asset：`lora-energy-lab-v1.zip` 與同名 `.sha256`。不要下載 GitHub 自動產生的 `Source code (zip)`，也不要從不同 branch、不同資料夾或 Git checkout 拼出 runner；本課程需要一份可核對 bytes 的 package。

**解壓後應看見：**

```text
lora-energy-lab/
├── README.zh-TW.md
├── setup.sh       setup.cmd
├── course.sh      course.cmd
├── student_policy.py
├── scenarios/     schemas/
└── fallback_artifacts/
```

**實際操作｜Linux／macOS／WSL：**

```sh
unzip -l lora-energy-lab-v1.zip
```

**實際操作｜Windows PowerShell：**

```powershell
Get-ChildItem .\lora-energy-lab-v1.zip
Expand-Archive .\lora-energy-lab-v1.zip -DestinationPath .\lora-energy-lab-release
Get-ChildItem .\lora-energy-lab-release
```

**預期看到：** ZIP 只有一個 `lora-energy-lab/` 根目錄，並含上述必要檔案；目前 audit 的 package inventory 為 65 個檔案，但這個數字是 package fact，不是 fresh run 證據。

**解讀：** root 或必要檔案不對，問題是 artifact identity，還沒到 Python 或 energy 階段。

**復原：** 保留不符檔案與錯誤訊息，重新取得同一 release asset；不要改用 `Source code (zip)`、不要 `git clone` 來補檔。

**Fit：** **建議拆成 P010a「release／不使用 Git」與 P010b「root inventory」**；若維持一頁，命令卡只放一個平台，另一平台放講師手冊。

## P011｜先核對 SHA-256，再解壓與進入 root

**版面：** checksum gate；上方是「相同 bytes 才能繼續」，下方用平台分頁呈現命令。這頁不放未凍結的下載 URL 或手工填入的 hash。

**投影主文：**

> checksum 只回答「拿到的是不是同一個 archive」，不回答「energy 結果是否正確」。只有 hash 與 sidecar 完全一致、ZIP test 通過，才進入解壓與 setup；hash 不符就停在這一頁。

**Linux／WSL：**

```sh
sha256sum -c lora-energy-lab-v1.zip.sha256
unzip -t lora-energy-lab-v1.zip
unzip lora-energy-lab-v1.zip
cd lora-energy-lab
```

**macOS：**

```sh
shasum -a 256 lora-energy-lab-v1.zip
unzip -t lora-energy-lab-v1.zip
unzip lora-energy-lab-v1.zip
cd lora-energy-lab
```

`shasum` 顯示的 64 位 hash 必須逐字等於 `.sha256` 第一欄。

**Windows PowerShell：**

```powershell
Get-FileHash .\lora-energy-lab-v1.zip -Algorithm SHA256
Get-Content .\lora-energy-lab-v1.zip.sha256
Expand-Archive .\lora-energy-lab-v1.zip -DestinationPath .
Set-Location .\lora-energy-lab
```

**預期輸出：** Linux 顯示 `OK`；macOS／PowerShell 顯示的 hash 與 sidecar 第一欄相同；`unzip -t` 顯示沒有錯誤。`cd`／`Set-Location` 後，工作目錄是解壓出的 `lora-energy-lab`。

**解讀：** 通過代表 package bytes 可追溯；不代表 `setup.sh`、`course.sh run` 或 Leo importer 已成功。

**復原：** checksum 不符、ZIP test 失敗或 root 不對時，保留錯誤，重新取得講師指定的 ZIP 與 `.sha256` pair；不要混用舊檔，也不要手改 checksum。

**Fit：** **建議拆成 P011a「hash／ZIP test」與 P011b「extract／enter root」**；三平台命令若同頁，命令字級不得低於 20pt。

## P012｜Windows 先辨識 shell，再鎖定 Python 3.11

**版面：** CMD 與 PowerShell 雙視窗；每個視窗只放兩行命令與一個成功訊號。

**投影主文：**

> Windows 的 CMD、PowerShell 與 WSL 是不同的 shell 與 path 規則；先辨識所在環境，才不會把 `.cmd`、`.sh` 和另一套 `.venv` 混在一起。runner 的 frozen result contract 要求 Python 3.11.x，不能用 3.12 或 3.13 繞過版本 gate。

**CMD：**

```bat
py --list
py -3.11 --version
```

**PowerShell：**

```powershell
py --list
py -3.11 --version
```

**預期輸出：** 清單中有 3.11，第二行回傳 `Python 3.11.x`。若命令提示字元是 `C:\...>` 或 `PS C:\...>`，本頁路徑屬於 Windows；不要在這裡執行 `setup.sh`。

**解讀：** 版本 gate 是可重現性的前置條件，不是可選建議；Python 版本正確仍只代表可以進 setup。

**復原：** 沒有 3.11 時，走 P013 的官方安裝或 P014 的 uv recovery；不要把 `python --version` 顯示的其他 minor version 當成通過。

**Fit：** 一頁可放下；兩個 shell 命令保持 20–22pt。

## P013｜Windows 沒有 Python 3.11：先補正確的 interpreter

**版面：** recovery ladder；官方安裝是主路徑，uv 是下一頁的明確備援，不把兩條路混在同一個命令框。

**投影主文：**

> 如果 `py --list` 沒有 3.11，請安裝 Python 3.11.x 的 64-bit Windows installer，並保留 Python Launcher。安裝後關閉並重新開啟 shell，再驗證 `py -3.11 --version`；不要修改 runner 的版本 gate。

**畫面連結：** `https://www.python.org/downloads/windows/`

**安裝後重新驗證｜CMD／PowerShell 都可：**

```text
py --list
py -3.11 --version
```

**預期輸出：** `py --list` 出現 3.11，版本命令顯示 `Python 3.11.x`。

**解讀：** 這只確認 Windows 能找到 exact minor；package-local `.venv` 尚未建立，還不能執行 case。

**復原：** installer 或 launcher 仍找不到 3.11，保留錯誤，改走 P014 的 uv；不要把 PATH 指向 3.12／3.13 後繼續。

**Fit：** 一頁可放下；官方連結 18–20pt，正文 24pt。

## P014｜uv 只負責取得 Python 3.11，不負責製造結果

**版面：** Windows 與 POSIX／WSL 兩條垂直命令帶；中央用一句話切開「interpreter recovery」與「runner run」。

**投影主文：**

> uv 是在主機找不到 Python 3.11 時的明確 recovery 工具。它只取得並定位 exact interpreter；`READY`、result.json 與 endpoint replay 仍要由後面的 package setup／run 產生，不能把 `uv` 的成功當成 energy experiment 成功。

**Windows PowerShell：**

```powershell
winget install --id=astral-sh.uv -e
uv --version
uv python install 3.11
uv python find 3.11
```

**Linux／macOS／WSL：**

```sh
uv --version
uv python install 3.11
uv python find 3.11
```

若 POSIX／WSL 尚未有 uv，依官方 installer 安裝後重新開 shell，再重跑上述四行中的 `uv` 命令；不要把 Windows 的 `.venv\Scripts\python.exe` 帶進 WSL。

**預期輸出：** `uv python find 3.11` 回傳一個可執行的 Python 3.11 interpreter path。

**解讀：** 這個 path 會交給 P016（Windows）或 P020（POSIX／WSL）的 setup；它尚未寫入 `artifacts/verify-receipt.json`。

**復原：** `winget`、installer 或網路失敗時保留錯誤，回到官方 Python 路徑或同情境 fallback；不要手改 `PYTHON_BIN` 指向其他 minor。

**Fit：** **建議拆成 P014a「Windows uv」與 P014b「POSIX／WSL uv」**；若同頁，兩條命令帶各自不超過四行。

## P015｜每個 package 都要有自己的 `.venv`

**版面：** 隔離圖；左側 system Python，右側 package root 的 `.venv`，Windows 與 POSIX path 並列，不放 activation 教學。

**投影主文：**

> `.venv` 必須建在這份 `lora-energy-lab/` package root 內，讓 lock、policy、scenario 與 runner 用同一個隔離環境。Windows 的 `.venv\Scripts\python.exe` 與 WSL／Linux／macOS 的 `.venv/bin/python` 不能互換，也不要共享另一個專案的 venv。

**兩個合法 path：**

```text
Windows：.venv\Scripts\python.exe
POSIX／WSL：.venv/bin/python
```

**建立後核對：**

```powershell
.\.venv\Scripts\python.exe --version
```

```sh
./.venv/bin/python --version
```

**預期輸出：** 所在平台的 package-local interpreter 顯示 `Python 3.11.x`；如果 venv 尚未存在，先做 P016 或 P020，不要手動把另一台環境的 venv 複製過來。

**解讀：** `course.cmd`／`course.sh` 會優先使用這個 package-local interpreter；這讓命令與 receipt 的 Python identity 可追溯。

**復原：** 若已存在的 `.venv` 不是 3.11.x，先確認目標就是目前 package root，再只移除這個 `.venv` 後重跑 setup：PowerShell `Remove-Item -Recurse -Force .\.venv`；CMD `rmdir /s /q .venv`；POSIX／WSL `rm -rf .venv`。不要刪除 package root 或整個工作目錄。

**Fit：** 一頁可放下；復原命令若放在投影頁，至少 20pt，否則移到講師操作卡。

## P016｜Windows：setup 建 venv，verify 產生 READY receipt

**版面：** Windows command-to-receipt；左半是 CMD，右半是 PowerShell，底部用大字顯示「`READY` 是入場券，不是結果」。

**投影主文：**

> 在已確認 Python 3.11 的 Windows package root 執行 setup；setup 會建立 package-local `.venv`、依 lock 安裝並呼叫 verification。接著用 `course.cmd verify` 再看一次同一份 gate，通過才進入 policy 與 case。

**CMD：**

```bat
set "PYTHON_BIN=py -3.11"
setup.cmd
course.cmd verify
```

**PowerShell：**

```powershell
$env:PYTHON_BIN = "py -3.11"
.\setup.cmd
.\course.cmd verify
```

**預期輸出：** machine-readable JSON 中有 `"status":"READY"`、`"python_version":"3.11.x"`；同時寫入 `artifacts\verify-receipt.json`。若 setup 自己已印出 receipt，再跑 verify 會再印一次，重點是兩次都不應出現 ERROR。

**解讀：** `READY` 只表示版本、lock、scenario、policy API 與 claim boundary 通過；它不表示任何 case 已執行。

**復原：** 版本、lock、policy 或 scenario gate 失敗時，停在錯誤行，回到 P012–P015 修最小邊界；不要跳到 `course.cmd run`，也不要手改 receipt。

**Fit：** **建議拆成 P016a「CMD」與 P016b「PowerShell／receipt」**；兩個 shell 同頁時，JSON 只顯示必要欄位。

## P017｜WSL：先進入 Ubuntu，再使用 `.sh`

**版面：** 正確順序的上下流程：Windows PowerShell → Ubuntu shell identity → WSL package root；把 `.cmd` 與 `.sh` 放在兩條不同路徑。

**投影主文：**

> WSL 不是 Windows shell 的別名，而是另一套 Linux 環境；先確認 Ubuntu 已啟動，再安裝工具與解壓 package。只有在看到 Linux home path 後，才使用 `setup.sh`、`course.sh` 與 `.venv/bin/python`。

**Windows PowerShell（尚未有 Ubuntu 才做安裝）：**

```powershell
wsl --install -d Ubuntu
wsl -l -v
wsl -d Ubuntu
```

**進入 Ubuntu 後：**

```sh
pwd
uname -a
```

**預期輸出：** `pwd` 是 Linux home path；`uname -a` 開頭顯示 Linux；`wsl -l -v` 顯示 Ubuntu。若 Ubuntu 已存在，只需從 `wsl -l -v` 確認後進入，不要重複安裝。

**解讀：** 這一步只是 shell identity gate；此刻還不能說 uv、venv 或 runner 已準備好。

**復原：** `wsl --install` 需要重新啟動時，先完成 Windows 要求並重新開 shell；若進入的不是 Ubuntu，回到 `wsl -l -v` 選正確 distribution。不要在 WSL 執行 `setup.cmd`。

**Fit：** **建議拆成 P017a「Windows 啟用 WSL」與 P017b「Ubuntu identity」**；正確順序不能被壓成一張混合命令圖。

## P018｜WSL：工具與 uv 的安裝順序

**版面：** Ubuntu toolchain ladder：`apt → curl／unzip → uv → Python 3.11`；每一階只放一個目的。

**投影主文：**

> 在已確認的 Ubuntu shell，先取得解壓與安裝工具，再安裝 uv，最後取得 Python 3.11。這些命令只建立可用的環境；尚未解壓 release，也尚未寫入 runner receipt。

**Ubuntu／WSL：**

```sh
sudo apt update
sudo apt install -y curl unzip
curl -LsSf https://astral.sh/uv/install.sh | sh
```

重新開一個 Ubuntu shell 後：

```sh
uv --version
uv python install 3.11
uv python find 3.11
```

**預期輸出：** `apt` 完成、`uv --version` 有版本字串，`uv python find 3.11` 回傳 interpreter path。

**解讀：** `uv` 找到的是 WSL／Linux interpreter；它不能被 Windows `.cmd` 直接共用。

**復原：** apt 權限、installer 或網路失敗時保留錯誤；先修目前一階，仍無法完成就改用已核對的同情境 fallback。不要把 `uv` 安裝錯誤改寫成 energy result。

**Fit：** 一頁可放下；若把 installer 說明放到頁面，建議拆出 P018b，避免命令低於 20pt。

## P019｜WSL：把 ZIP 複製到 Linux home，再驗證與解壓

**版面：** 路徑流向圖：Windows Downloads → WSL Linux home → `lora-energy-lab/`；禁止直接在 `/mnt/c` 建立 Linux venv 的警示放在旁邊。

**投影主文：**

> ZIP 可以從 Windows Downloads 取得，但 setup 與 `.venv` 要在 WSL 的 Linux filesystem 完成。先複製 ZIP 與 `.sha256` 到 Linux home，核對、測試、解壓後才進入唯一的 package root；不要把 Windows venv 帶進 WSL。

**WSL／Ubuntu 命令：**

```sh
mkdir -p ~/c120-course
cp /mnt/c/Users/<YourName>/Downloads/lora-energy-lab-v1.zip ~/c120-course/
cp /mnt/c/Users/<YourName>/Downloads/lora-energy-lab-v1.zip.sha256 ~/c120-course/
cd ~/c120-course
sha256sum -c lora-energy-lab-v1.zip.sha256
unzip -t lora-energy-lab-v1.zip
unzip lora-energy-lab-v1.zip
cd lora-energy-lab
pwd
```

**預期輸出：** checksum 顯示 `OK`，ZIP test 沒有錯誤，最後 `pwd` 位於 Linux home 下的 `.../c120-course/lora-energy-lab`。

**解讀：** 這樣 `.venv/bin/python`、lock 與 shell path 都屬於同一個 Linux package；沒有 Git metadata 也不影響 runner，因為 release asset 本身就是交付邊界。

**復原：** `/mnt/c` 路徑、`<YourName>`、sidecar 或 hash 出錯時，先停在目前命令；重新取得同名 pair。不要從 Git checkout 補檔，也不要在 checksum 未通過時解壓後繼續。

**Fit：** **強烈建議拆成 P019a「copy／hash／ZIP test」與 P019b「extract／root」**；完整命令群若同頁不可低於 20pt。

## P020｜POSIX／WSL：用 exact interpreter 建立 package-local venv

**版面：** 兩條入口帶：已安裝 `python3.11` 與 uv path；下方共同指向 `.venv/bin/python` 與 `course.sh verify`。

**投影主文：**

> Linux、macOS 與 WSL 都使用 POSIX script，但 interpreter 仍要明確是 Python 3.11.x。setup 完成後，`course.sh` 會優先使用 package-local `.venv/bin/python`；verify 成功才可開始 policy 操作。

**Linux／macOS（PATH 已有 Python 3.11）：**

```sh
PYTHON_BIN=python3.11 bash setup.sh
bash course.sh verify
```

**WSL／uv path：**

```sh
PYTHON_BIN="$(uv python find 3.11)" bash setup.sh
bash course.sh verify
```

**預期輸出：** JSON 顯示 `"status":"READY"`、`"python_version":"3.11.x"`，並寫入 `artifacts/verify-receipt.json`。

**解讀：** 通過的是環境與契約 gate；尚未產生 `artifacts/<run_id>/result.json`，也尚未證明 Leo endpoint import。

**復原：** `python3.11` 不存在時改用 P014 的 uv；既有 venv 版本錯誤時照 P015 只處理 package-local `.venv`；verify 失敗就保留錯誤，不要跳過 gate。

**Fit：** 一頁可放下；兩條命令帶各兩行，命令 20–22pt。

## P021｜`READY` receipt 是入場券，不是 energy result

**版面：** receipt anatomy；把 machine-readable JSON 的必要欄位放大成兩列，不要把整份 receipt 縮成不可讀的截圖。

**投影主文：**

> `READY` 表示選定的 Python、lock、scenario、policy API 與 claim boundary 彼此一致，可以進入 runner。它不代表 baseline、candidate 或 withheld 已執行，更不代表 Leo importer 已接通。

**POSIX／WSL 查看：**

```sh
sed -n '1,80p' artifacts/verify-receipt.json
```

**Windows PowerShell 查看：**

```powershell
Get-Content .\artifacts\verify-receipt.json
```

**Windows CMD 查看：**

```bat
type artifacts\verify-receipt.json
```

**應核對的欄位：**

```text
status: READY
python_version: 3.11.x
scenario_id: ntpu-energy-decision-01
policy_api_version: lora-energy-policy-v1
engine_mode: coherent-course-simulated-adapter
upstream_execution: false
claim_boundary: SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED
```

**解讀問題：**「receipt 有 `scenario_id`，是否表示某個 result 已經存在？」不是；receipt 是 setup gate 的檔案。

**復原：** 缺檔、`status` 不是 READY、Python 不是 3.11.x 或欄位不符時，回到 P016／P020 重跑對應 setup；絕不手改 JSON 讓它看起來通過。

**Fit：** **建議拆成 P021a「查看 receipt」與 P021b「逐欄解讀」**；完整 claim boundary 僅可用 18–20pt 等寬字，不能縮正文。

## P022｜setup 失敗不等於 energy result：先修 gate，受阻才走 fallback

**版面：** decision fork。左支是「修最小環境問題」，右支是「同情境 fallback 的明確降級」；中間大字寫「不把錯誤改名成結果」。

**投影主文：**

> setup 或 verify 失敗時，先讀錯誤指出的 Python minor、package root、lock 或 policy 問題，只修那一個邊界。若環境仍無法建立 `READY`，可以用相同 lab／case 的 fallback 保留教學問題，但必須保留 `artifact_source: same-scenario-fallback`，不能說成本機 policy 曾執行。

**重跑 gate｜Linux／macOS／WSL：**

```sh
PYTHON_BIN=python3.11 bash setup.sh
bash course.sh verify
```

**重跑 gate｜Windows CMD：**

```bat
set "PYTHON_BIN=py -3.11"
setup.cmd
course.cmd verify
```

**重跑 gate｜Windows PowerShell：**

```powershell
$env:PYTHON_BIN = "py -3.11"
.\setup.cmd
.\course.cmd verify
```

**fallback pair 的可見規則：**

```text
fallback_artifacts/<exact-case>/result.json
fallback_artifacts/<exact-case>/endpoint-replay.json
```

`<exact-case>` 必須與目前 lab／case 完全相同，例如 `baseline-A`、`candidate-A`、`trace-b-B` 或 `surprise-C`；兩個檔案要成對保留。

**預期輸出／解讀：** setup 通過才會有 `READY`；fallback 只提供 package-side 的同情境教學 recovery，source mode 不可改名。最新操作盤點也顯示 Leo strict import／browser route 尚未完成，因此 fallback 不能被投影片寫成網站匯入成功。

**復原：** 不要手改 result、replay 或 receipt；記錄錯誤，修正指定 artifact，或改用對應的同情境 pair。若目標是先教 runner，停在 package-side inspection；Leo import 保持 pending。

**Fit：** **建議拆成 P022a「重跑 setup／verify」與 P022b「fallback identity／Leo pending」**；fallback mapping 若需逐案列出，另做講師手冊表，不塞入投影頁。

## P023｜可編輯檔案只有 `student_policy.py` 的 marked block

**版面：** guarded-file 卡；左側是一個被打開的檔案，右側四個鎖頭標示 scenario／schema／runner／generated JSON 皆不可改。

**投影主文：**

> 每個 lab 只修改 `student_policy.py` 裡目前 active 的 marked block；scenario、schemas、runner、Leo code 與 generated JSON 都是 read-only。這個邊界讓 policy hash、predecessor、freeze receipt 與結果差異保持可解釋。

**檔案中要找的三段 marker：**

```python
# === LORA EDITABLE: lab-a-pace-rest ===
# === LORA EDITABLE: lab-b-enter-exit-hold ===
# === LORA EDITABLE: lab-c-batch-urgent ===
```

**可見操作：** 開啟與 package 同根的 `student_policy.py`，只在目前 lab 的起訖 marker 之間改常數；`student_policy.baseline.py` 是 packaged reference，不是上傳或執行目標。

**預期結果：** 修改前後只出現一個 bounded block 的小 diff；檔案仍是 UTF-8／LF，沒有 import、任意 function call 或契約外 action。

**解讀：** 小 diff 讓後面的 `policy_sha256` 能回答「是哪一個控制點改變了結果」，而不是讓整個 simulator 變成另一個程式。

**復原：** policy guard／syntax 失敗時依錯誤指出的 marked line 修正；不要編輯 runner、schema 或 JSON。若整個檔案不是 package 版本，先保留目前檔案，回到 package identity／checkpoint recovery，不要盲目覆蓋。

**Fit：** 一頁可放下；marker code 20pt，完整解釋句 24pt。

## P024｜policy 只能讀現在可觀察到的欄位

**版面：** observation → legal action 的輸入輸出卡；把「不能偷看」做成遮罩，不使用大段 API 文件。

**投影主文：**

> `choose_action(observation)` 只能使用目前與過去已允許的 observation，不能讀 future quality、future energy 或 result summary。每次呼叫必須回傳契約內的一個 action，讓 runner 能把它轉成可觀察事件。

**可見輸入例子：**

```text
contact_open       quality_band       stable_steps
steps_since_send   queue_size         urgent_due_in_s
previous_action    contact_remaining_s
```

**可見輸出：**

```text
WAIT | SLEEP | SEND_ONE | SEND_URGENT | FLUSH_BATCH
```

**請全班判斷：**「如果 `contact_open` 是 false，回傳 `SEND_ONE` 合法嗎？」不合法；安全的 engine 路徑必須選 `SLEEP`。

**講師直接說：**「這是 bounded policy API，不是重寫 simulator 的入口。先說清楚 observation 代表哪個機制，再說 action 會改變哪一段 state 或 packet。」

**讀檔命令（僅供確認）：**

```sh
sed -n '1,140p' student_policy.py
```

```powershell
Get-Content .\student_policy.py
```

**預期／復原：** 讀到三段 marker 與 `choose_action`；若 policy guard 拒絕 future 欄位、未知 action 或不支援語法，只修 active block，保留錯誤訊息。

**Fit：** 一頁可放下；輸入欄位可只顯示八個代表欄位，完整 API 留在 speaker notes／講師手冊。

## P025｜常數是受控旋鈕：一次只改一個可解釋值

**版面：** 三個 lab 的旋鈕卡，分成「控制點」「預期機制」「安全改法」；不用逐行程式碼佔滿頁面。

**投影主文：**

> 先改一個 bounded constant，再跑一個 exact case，才知道哪個控制點造成差異。改值前先說出它可能影響的等待、穩定門檻、佇列、期限或 wake／send 行為；不要同時改整段 policy。

**目前 package baseline 與合法教學改法：**

| Lab | baseline（package 內） | 第一個可解釋改法 | 想觀察的機制 |
|---|---|---|---|
| A pace／rest | `PACE_GAP_STEPS = 2`；`REST_DURING_GAP = SLEEP` | 把 `REST_DURING_GAP` 改成 `WAIT` | awake-idle 與 wake／service 後果 |
| B enter／exit／hold | `ENTER_QUALITY = 2`；`EXIT_QUALITY = 1`；`STABLE_STEPS = 2` | 把 `STABLE_STEPS` 改成 `1` | 等待穩定品質與錯過窗口的取捨 |
| C batch／urgent | `BATCH_SIZE = 3`；`URGENT_MARGIN_S = 20` | 先改 `URGENT_MARGIN_S` 成 `5` | urgent deadline、batch 與 delivery／energy |

**可見提醒：** Lab C 的後續 revision 可把 `URGENT_MARGIN_S = 5` 改成 `30`；這是第二個受控比較，不是同一次命令同時修改兩個旋鈕。

**小問題：**「若想知道 wake cost 是否是差異來源，A lab 應先改哪一種東西？」先改 `REST_DURING_GAP`，不要同時改 gap、quality 和 batch。

**復原：** 超出 bounded value、改到非 active marker 或出現 syntax error，回到 package baseline／上一個 freeze 的 exact block；不要放寬 guard。

**Fit：** **建議拆成 P025a「A／B 旋鈕」與 P025b「C 旋鈕／一次一變」**；三列表若同頁，表內字級不得低於 20pt。

## P026｜看條件分支：它如何把 observation 變成 action？

**版面：** 程式碼註解頁；左側放三段真實 policy 邏輯的短摘錄，右側用箭頭標出每段改變的機制。

**投影主文：**

> 讀 policy 時，先圈出條件正在讀哪個 observation，再追蹤每個分支回傳哪個 legal action。條件本身不是結果；它只是把「窗口、品質、期限、節奏」轉成下一個 state／packet 決策。

**可見程式摘錄（保持與 package 相同的 token）：**

```python
if not observation.contact_open:
    return SLEEP
if observation.urgent_pending and observation.urgent_due_in_s <= URGENT_MARGIN_S:
    return SEND_URGENT
if observation.steps_since_send < PACE_GAP_STEPS:
    return REST_DURING_GAP
```

**旁註箭頭：**

- 窗口關閉 → `SLEEP`：避免不合法 send。
- urgent 到期逼近 → `SEND_URGENT`：保護期限。
- 距離上次送出太近 → `REST_DURING_GAP`：控制節奏；此 token 可由 A block 的 `SLEEP` 或 `WAIT` 決定。

**判斷題：**「如果把 `URGENT_MARGIN_S` 改大，policy 可能更早做什麼？」更早選 `SEND_URGENT`；接著要觀察 deadline、attempt 與 endpoint J 是否真的跟著改變。

**預期／復原：** 讀檔只應看目前／過去欄位與合法 action；若名稱、縮排或 guard 報錯，只修 active marked block。沒有獨立的「神奇修復」命令，錯誤會在下一次 `course.sh run`／`course.cmd run` 的 policy parse 或 execution gate 顯示。

**Fit：** **建議拆成 P026a「讀條件」與 P026b「追 action 後果」**；完整程式摘錄若保留三段，程式碼 20pt。

## P027｜縮排與 `return`：先完成第一個可追溯 baseline

**版面：** 上半部是小型縮排示意，下半部是跨平台的第一個 run command；把「寫程式」與「跑結果」用一條粗箭頭接起來。

**投影主文：**

> Python 的縮排決定條件屬於哪個分支，`return` 決定 runner 收到哪個 action；先讀懂這兩件事，就能安全修改一個 marked block。第一個 baseline 要保留 command 印出的 `result_path`，因為那個路徑是後續檢查與配對 replay 的入口。

**可見程式骨架：**

```python
def choose_action(observation):
    if not observation.contact_open:
        return SLEEP
    return WAIT
```

**第一個 exact run｜Linux／macOS／WSL：**

```sh
bash course.sh run --lab A --case baseline
```

**第一個 exact run｜Windows CMD／PowerShell：**

```text
course.cmd run --lab A --case baseline
```

**預期成功輸出（若前面的 `READY` gate 已通過）：**

```json
{"artifact_source":"student-run","claim_boundary":"SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED","result_path":"artifacts/<run_id>/result.json","run_id":"<run_id>","status":"OK"}
```

同一個 `<run_id>` 旁邊應有 `endpoint-replay.json`；命令印出的 `result_path` 優先於自行猜目錄名稱。

**解讀：** `status: OK` 代表該 exact case 在通過 gate 後產生一筆 runner artifact，不代表 Leo 已成功匯入，也不代表這是 live／measured data。

**復原：** 若錯誤指出 Python、policy、scenario 或 predecessor，保留完整錯誤，回到對應的 setup／marked block／freeze gate；不要手改 JSON。第一個 baseline 若現有 policy 已被修改，先在可恢復的副本中把 active block 還原為 package baseline，再重新執行。

**往下一步：** 只有 baseline 的 `result_path` 與 prediction 記錄都保存後，才進入 A candidate 的單一值修改與 `--freeze` 命令；withheld case 不在這一頁調參。

**Fit：** **強烈建議拆成 P027a「縮排／return」與 P027b「A baseline run」**；若不拆，程式碼與命令均不得低於 20pt，JSON 只保留必要欄位。

## 拆分建議總表

下列頁面若要把所有命令、預期輸出與復原都直接放在投影上，不能靠縮小字級解決，應增加一頁並維持主要教學文字 24–28pt：

| 原頁 | 建議拆分 | 原因 |
|---|---|---|
| P010 | P010a／P010b | release asset／禁止 Git 與 root inventory 是兩個不同操作判斷。 |
| P011 | P011a／P011b | hash／ZIP test 與 extract／enter root 需要不同平台命令。 |
| P014 | P014a／P014b | Windows uv 與 POSIX／WSL uv 的安裝入口不同。 |
| P016 | P016a／P016b | CMD、PowerShell 與 READY receipt 不應縮在同一個命令卡。 |
| P017 | P017a／P017b | WSL 啟用與 Ubuntu shell identity 必須保持正確順序。 |
| P019 | P019a／P019b | copy／checksum／ZIP test 與 Linux extract／root 需要各自可核對。 |
| P021 | P021a／P021b | 查看 receipt 與解讀欄位是兩個教學動作。 |
| P022 | P022a／P022b | setup recovery 與 fallback／Leo pending 的 claim 不應混成一張錯誤頁。 |
| P025 | P025a／P025b | A／B 控制點與 C urgent／revision 的因果問題不同。 |
| P026 | P026a／P026b | 讀條件與追 action 後果需要不同視覺焦點。 |
| P027 | P027a／P027b | Python survival 與第一個 runner case 都需要可操作的字級。 |

拆分後仍沿用 P001–P027 的主線，不新增時間標籤；新增頁只服務閱讀與操作，不把課程目的改成安裝課。
