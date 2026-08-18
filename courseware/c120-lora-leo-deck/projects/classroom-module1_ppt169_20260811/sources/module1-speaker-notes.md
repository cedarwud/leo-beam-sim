# C-120 module 1 speaker notes (P001–P027)

These notes are embedded in the PPTX notes slides. The visible slides carry the editable diagram or exact command/receipt objects; narration, caveats, and recovery wording live here.

## P001 — 每一次 SEND、WAIT、SLEEP 都是能源決策

今天先不從衛星名詞開始。我們從一個 IoT endpoint 的選擇開始：現在送、短暫等待，或進入低功耗休眠。每個選擇會改變 radio state 停留時間、封包結果與服務，最後才在 endpoint energy ledger 中留下可追溯的 J。

Recovery: 若 claim 被擴大：停在 endpoint / system boundary；不可把模擬資料說成 live 或 measured。

## P002 — 節能是一條可檢驗的因果鏈

請看箭頭，不要跳到最右邊。先有 observation，policy 才選 action；action 會改變等待、喚醒、處理、收發與封包結果；服務條件確認後，才談功率乘上時間累積出的 endpoint energy。

Recovery: 若 claim 被擴大：停在 endpoint / system boundary；不可把模擬資料說成 live 或 measured。

## P003 — LoRaEnergySim 為什麼直接服務智慧節能與 IoT

智慧節能不是只把功率欄位改小，而是讓裝置在工作與等待之間做出可解釋的取捨。相關模型把 sleep、processing、transmit、receive、packet、collision、retry 與 energy 結果連起來。

Recovery: 若 claim 被擴大：停在 endpoint / system boundary；不可把模擬資料說成 live 或 measured。

## P004 — LEO 只提供會改變的服務窗口

LEO 在這裡不是衛星工程課的終點，而是 changing service window 的例子。可服務的機會會出現、消失、變短或變長，讓現在送還是等一下變得可觀察。

Recovery: 若 claim 被擴大：停在 endpoint / system boundary；不可把模擬資料說成 live 或 measured。

## P005 — 兩層 evidence 不能互相冒充

左邊的 endpoint replay 可以回答封包、佇列、radio state、endpoint energy 與 endpoint service；右邊的 system replay 才承擔既有 C-120 canonical fields。

Recovery: 若 claim 被擴大：停在 endpoint / system boundary；不可把模擬資料說成 live 或 measured。

## P006 — 從預測走到可反駁的結果

每個 lab 都先記下預期會變的 state time、packet outcome、service 或 endpoint J，再只改標記區塊，跑 baseline 與 candidate，匯入 result 看 replay，最後用 withheld case 檢驗。

Recovery: 若 claim 被擴大：停在 endpoint / system boundary；不可把模擬資料說成 live 或 measured。

## P007 — 一個小改動，必須能追到一個機制

這張卡片只問一件事：你改的那一行透過哪個機制影響哪一筆 evidence？如果結果沒有 consequential diff，就記錄 gate 未通過，不用畫面效果替代。

Recovery: 若 claim 被擴大：停在 endpoint / system boundary；不可把模擬資料說成 live 或 measured。

## P008 — 今天的教學路徑

先把工具與場景的關係講清楚，再完成能回復的 setup；接著建立 endpoint state 與服務邊界的共同語言，最後把機制轉到其他 IoT 場景。

Recovery: 若 claim 被擴大：停在 endpoint / system boundary；不可把模擬資料說成 live 或 measured。

## P009 — 開場檢查點：先確認 claim 邊界

在進入命令前，我們先把能說什麼與不能說什麼放在同一張圖。這是 course-owned、deterministic、simulated 的 endpoint energy lab，不是 live telemetry、量測結果或 canonical parity 通過。

Recovery: 若 claim 被擴大：停在 endpoint / system boundary；不可把模擬資料說成 live 或 measured。

## P010 — 套件根目錄是一條 provenance 邊界

local artifact 已凍結為 121,139 bytes；解壓後仍不要從不同 branch 拼檔案，先確認 root 與必要檔案。

Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。

## P011 — 先核對 local artifact，再等待公開 release

local ZIP 已核對為 121,139 bytes，SHA-256 為 047e8459988d8bee59fbfdcc39189e00048f3697968901ce5b6e5363dc9e8c8c。這是 local artifact 證據，不擴張成公開 GitHub Release 已可下載。

Recovery: local hash 不符：停止並重新取得 owner 指定檔案；公開 URL 未發布：保留 placeholder，不改用舊 URL 或其他 branch。

## P012 — Windows 原生先確認 shell 與 launcher

如果畫面開頭是 C:\...>，我們在 CMD；如果是 PS C:\...>，我們在 PowerShell。先執行 py --list，再執行 py -3.11 --version；看到 3.11.x 才進入 setup。

Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。

## P013 — 沒有 Python 3.11 時的 Windows 安裝路徑

如果 py --list 沒有 3.11，開啟畫面上的官方 Windows 下載頁，選 Python 3.11.x 的 64-bit installer 並保留 Python Launcher。完成後關閉再開 shell，重跑 py --list 與 py -3.11 --version。

Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。

## P014 — uv 是 Python 3.11 的 recovery 工具

當 launcher 找不到 3.11，可以用 uv 取得 exact interpreter。先裝 uv，再跑 uv python install 3.11 與 uv python find 3.11；如果仍找不到，保留錯誤走 fallback。

Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。

## P015 — Windows 用 package-local .venv

隔離環境讓 runner 的 dependency graph 不受其他專案污染。Windows interpreter 應落在 .venv\Scripts\python.exe，不能拿 WSL 的 .venv/bin/python 來用。

Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。

## P016 — Windows 執行 setup 與 verify

在 package root 的 PowerShell，先設定 PYTHON_BIN，再執行 .\setup.cmd，完成後執行 .\course.cmd verify。畫面保留 READY / PLACEHOLDER，因為 Windows native command 尚未 clean-run。

Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。

## P017 — WSL 先確認它真的是 Ubuntu shell

WSL 是另一個 shell 與檔案環境。先用 wsl -l -v 確認 Ubuntu，進入後跑 pwd 與 uname -a；如果看到 Linux home path，才使用 setup.sh。

Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。

## P018 — WSL 安裝工具與 uv

在 Ubuntu shell 先更新套件索引並安裝 curl、unzip，再依 installer 安裝 uv。重新開 shell 後跑 uv --version、uv python install 3.11 與 uv python find 3.11。

Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。

## P019 — WSL 解壓與建立 .venv

release asset 尚未指定，所以畫面保留 RELEASE_ASSET_PENDING。收到正式 asset 後，從 /mnt/c/Users/<YourName>/Downloads/ 複製到 WSL Linux home，再在 package root 建立 WSL 專用的 .venv/bin/python。

Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。

## P020 — POSIX runner 的最小入口

在 Linux 或 macOS 的 POSIX shell，先以 PYTHON_BIN=python3.11 bash setup.sh 指定 interpreter，再以 bash course.sh verify 做同一份 gate。

Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。

## P021 — READY receipt 是下一步的入場券

請在 receipt 中找 status、Python version、scenario identity、policy API、lock、engine mode 與 claim boundary。READY 只表示可以進入 runner，不表示完成任何節能實驗。

Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。

## P022 — setup 失敗不等於 energy result

如果 setup 或 verify 出現錯誤，先確認 Python minor、package root、lock 與 scenario，只修目前 gate 指出的最小問題。若仍無法建立 READY，就選同 scenario fallback，並記錄 source mode。

Recovery: shell、版本、lock 或 receipt 不符：保留錯誤，回到 setup gate；仍受阻就使用同 scenario fallback。

## P023 — 可編輯檔案只有一個

在整個實驗中，我們只改 student_policy.py 的 marked blocks。不要改 upstream framework、scenario、schema、runner、Leo code 或 generated JSON；檔案與 release 不同就回到 package identity。

Recovery: policy guard 或 syntax 失敗：只修 marked block 的最小行；不要改 runner、schema 或 generated JSON。

## P024 — policy API 的輸入是現在能觀察到的事

policy 只能依當下允許的 observation 做選擇，不能偷看未來品質、future energy 或 result summary，也不能回傳契約外的 action。

Recovery: policy guard 或 syntax 失敗：只修 marked block 的最小行；不要改 runner、schema 或 generated JSON。

## P025 — Python survival：常數是受控旋鈕

這裡只需要讀懂變數名稱、等號和允許值。斜體顯示的變數是 policy 控制點；runner 會檢查 bounded range，實際 release line number 尚未凍結。

Recovery: policy guard 或 syntax 失敗：只修 marked block 的最小行；不要改 runner、schema 或 generated JSON。

## P026 — Python survival：條件只處理當前 observation

看一個 Boolean 條件時，先圈出它讀的是哪個 observation，再指出每個分支會回傳什麼 action。若 syntax 或名稱錯誤，修 marked block 的最小行，不碰 runner。

Recovery: policy guard 或 syntax 失敗：只修 marked block 的最小行；不要改 runner、schema 或 generated JSON。

## P027 — Python survival：縮排與 return

縮排決定條件屬於哪個分支，return 決定 runner 收到哪個 action。若錯誤指向 marked line，只修該行並重新做 policy guard；若指向非 marked 區域，保留錯誤走 recovery。

Recovery: policy guard 或 syntax 失敗：只修 marked block 的最小行；不要改 runner、schema 或 generated JSON。
