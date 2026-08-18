# P001–P063 逐頁整合施工圖

這份 map 是給整合 owner 的版型與文字密度施工圖。它只讀取既有
`build-classroom-module1.py`、`build-classroom-part2.py`、兩份 visible-content、
`educate.pptx` 與既有分析／render；不改 builder，也不把目前 preview 當作
教學內容的最終版本。

## 整合硬規格

- 畫布使用 `/home/u24/ppt-master/template/educate.pptx` 的原生 16:9 shell；保留 master、logo、footer、頁碼 carrier、原生背景與 notes。不要加整頁背景色或遮住 footer 的大矩形。
- 標題固定 28 pt；主要教學句 24–28 pt；命令與程式碼 20–22 pt；必要的 provenance／失敗標籤最低 18 pt，任何文字不得低於 18 pt。放不下就拆頁或改版型，不縮字。
- 文字只用深墨、深藍、深綠、深紫、低飽和金與深紅（只給失敗／復原）；禁止亮橘色文字。不要用時長標籤，不使用固定五問欄。
- 每頁只留一個主視覺：因果鏈、狀態帶、程式碼放大、before／after、result ledger、command ribbon、recovery map 或 bridge。箭頭與線在文字／公式框前至少留 0.12 in，文字區塊通常留 0.24 in 間距。
- 可見內容來源以 `part-a-visible-content.md` 與修訂後的 `part-b-visible-content.md` 為準。概念／結果頁要保留完整解釋句、比較句與一個待回答問題；不可只留下欄位名。
- Lab A 只有 P042 一張 compact run／receipt 頁；Lab B 只有 P056 一張 compact run／receipt 頁。P042 同一條 ribbon 排 baseline、candidate `--freeze`、hidden；P056 同一條 ribbon 排 Trace A baseline、candidate `--freeze`、Trace B。其餘 Lab 頁不能再放一組獨立 run 命令。
- run 頁只呈現快速執行與 receipt 教法；stdout 新印出的 `result_path` 是唯一結果入口，網站／viewer 要使用該次 path 與同目錄的 `endpoint-replay.json`，不能寫死 fallback path。實際 A／B 命令與 POSIX／Windows 雙版本已在 Part B visible content 指定。
- Part B 目前 builder 的舊 `kind` 名稱可作幾何起點，但文字角色必須依下表重綁：P040／P054 是 baseline evidence，P041／P055 是 exact edit，P043／P057 是 before／after，P046／P058 是 freeze／recovery，P047／P059 是 withheld／Trace B result。

## 版型索引

| 代號 | 可實作來源 | 何時使用 |
|---|---|---|
| M1-原生 | `build-classroom-module1.py` 的既有 `draw_*` | P001–P027；保留 native shell，只重排文字密度 |
| M2-原生 | `build-classroom-part2.py` 的既有 `draw_*` | P028–P038；用既有 state／formula／identity 幾何承載修訂文字 |
| M2-自訂 | 以 M2 原生 shell 加一個局部 custom drawing | P039–P063；不得換背景、另造 master 或覆寫 footer |
| compact ribbon | `draw_run` 的 command／receipt 幾何重排為三段 | 僅 P042、P056；三條命令必須同頁，不能變成三張操作頁 |
| OMML formula | `draw_formula` 的 dedicated hook + native Office Math insertion | P033、P034；公式後處理要驗證 `omath=1` |

## P001–P027：Part A 版型施工

`上限` 是可見文字總量的實作上限，不含原生 footer／頁碼。`拆頁` 的
`審核` 表示先以指定字級 render；若超出 safe zone，就按指定方向拆，不得
把 24–28 pt 壓小。

| P | 教學角色與需講清楚的事 | family | 實際可行模板／自訂版型 | 主要視覺 | 上限 | 拆頁 |
|---|---|---|---|---|---|---|
| P001 | 開場 promise：policy → state → packet／service → endpoint J；明示 simulated claim boundary。 | hero | M1 `draw_cover` | endpoint radio-state ribbon＋窗口 | 標題＋1 條鏈＋2 句 | 否 |
| P002 | 先有 observation，policy 才選 action；action 才改變 state、packet、service、J。 | causal chain | M1 `draw_flow` | 六段因果箭頭 | 標題＋6 個節點＋2 句 | 否 |
| P003 | 低功耗節點、封包／重試、state／energy 三層如何互相連動。 | concept cards | M1 `draw_cards` | 三層卡片，卡片內用短句 | 標題＋3 卡×2 行＋1 句 | 否 |
| P004 | LEO 只作 changing service window 例子，不作 live telemetry 宣稱。 | state timeline | M1 `draw_timeline` | 開窗／關窗時間帶 | 標題＋4 個窗口節點＋2 句 | 否 |
| P005 | endpoint replay 與既有 system evidence 的責任邊界不同。 | layer compare | M1 `draw_compare` | endpoint／system 雙層對照 | 標題＋2 欄×3 行＋1 句 | 否 |
| P006 | 先預測，再 edit、run、import、replay、withheld；反例也保留。 | process loop | M1 `draw_loop` | 閉環箭頭 | 標題＋6 節點＋2 句 | 否 |
| P007 | 每次只改 marked block，並由 policy hash 追到 result／replay。 | code guard | M1 `draw_guard` | `student_policy.py` 鎖定卡 | 標題＋4 個 guard＋2 句 | 否 |
| P008 | 從 why、setup 到 A／B、recovery、evidence、transfer 的路徑。 | chapter route | M1 `draw_route` | 路線圖，不放時長 | 標題＋10 節點＋1 句 | 否 |
| P009 | 能說的範圍是 course-packaged simulated endpoint lab，不是 live／measured／parity。 | claim shield | M1 `draw_shield` | claim ladder | 標題＋4 層＋2 句 | 否 |
| P010 | release ZIP 根目錄、README、launcher、policy、module、scenario、schema 必須同源。 | package boundary | M1 `draw_folder` | 根目錄樹＋單一 root 閘門 | 標題＋樹 7 行＋2 句 | 審核：若命令與樹同頁不足，拆成 inventory／root gate |
| P011 | local bytes／SHA-256 是 artifact identity，不是 energy evidence；公開 asset 未凍結就保留 placeholder。 | checksum evidence | M1 `draw_checksum` | hash 對照與 public placeholder | 標題＋3 個 receipt＋2 句 | 審核：hash 與 recovery command 不得互擠 |
| P012 | 先辨識 CMD／PowerShell，再確認 Python Launcher 看到 3.11。 | shell walkthrough | M1 `draw_shell` | prompt 對照卡 | 標題＋2 prompt＋2 命令＋2 句 | 否 |
| P013 | 缺少 Python 3.11 時走官方 installer → launcher → version check。 | recovery ladder | M1 `draw_ladder` | 安裝階梯 | 標題＋3 階＋2 句 | 否 |
| P014 | uv 只負責找 exact interpreter，不產生課程結果。 | command ribbon | M1 `draw_commands` | 三段命令 ribbon | 標題＋3 命令＋2 句 | 審核：命令 20–22 pt 需保留 |
| P015 | Windows 使用 package-local `.venv\Scripts\python.exe`，不混用 WSL venv。 | environment compare | M1 `draw_env` | system Python／package venv 隔離 | 標題＋2 路徑＋2 句 | 否 |
| P016 | setup 建環境，verify 才驗 Python、wrapper、lock、policy API、scenario identity，READY 不是結果。 | command／receipt | M1 `draw_command_receipt` | 命令 → READY receipt | 標題＋3 命令＋5 receipt 欄位＋2 句 | 審核：必要時拆 setup 與 READY 解讀 |
| P017 | WSL host／guest 是不同 shell 與 path；辨識後才選 setup.sh。 | host split | M1 `draw_wsl` | PowerShell／Ubuntu 雙視窗 | 標題＋4 命令＋2 句 | 否 |
| P018 | Ubuntu 補齊 apt、curl、uv、Python 3.11；這些只是 toolchain gate。 | toolchain ladder | M1 `draw_ladder` | apt → uv → interpreter | 標題＋4 命令＋2 句 | 審核：若命令不能維持 20 pt，拆 install／verify |
| P019 | release 從 Windows Downloads 複製到 WSL home，在 package root 建 venv，再 verify。 | path recovery | M1 `draw_path` | Windows path → WSL home → root | 標題＋5 命令＋2 句 | 是：拆「複製／解壓」與「setup／verify」兩頁 |
| P020 | POSIX 最小入口是 setup → verify；通過才進 runner。 | command pair | M1 `draw_commands` | 兩段 POSIX command ribbon | 標題＋2 命令＋2 句 | 否 |
| P021 | READY receipt 只表示 environment／契約 gate 通過，不表示實驗完成。 | receipt evidence | M1 `draw_receipt` | machine-readable receipt 放大卡 | 標題＋6 欄位＋2 句＋1 問題 | 審核：欄位不可縮到 18 pt 以下 |
| P022 | setup error 先修最小邊界；無法完成則走 same-scenario fallback 並保留 source mode。 | recovery fork | M1 `draw_fork` | READY／recoverable error 分叉 | 標題＋2 分支×2 行＋2 句 | 否 |
| P023 | 可寫的是 policy marked block；scenario、schema、runner、generated JSON 只讀。 | edit guard | M1 `draw_guard` | 一個可編輯檔＋四把鎖 | 標題＋5 guard＋2 命令＋2 句 | 審核：若命令與 guard 擁擠，拆 policy guard／recovery |
| P024 | policy 只能讀現在的 observation，回傳 legal action；不能讀 future outcome。 | API I/O | M1 `draw_io` | observation card → action card | 標題＋2 卡×3 行＋2 句 | 否 |
| P025 | 常數是受控旋鈕；先解釋它透過 state／queue／service 起作用，不是直接改 J。 | code walkthrough | M1 `draw_code` | 四個常數與 bounded guard | 標題＋4 行 code＋2 句＋1 命令 | 審核：若 code 與命令同頁不清楚，拆 code／compile |
| P026 | 每個 Boolean branch 只處理當前 observation，最後回傳一個 legal action。 | decision tree | M1 `draw_branch` | if／elif／else 三叉樹 | 標題＋3 分支＋2 句 | 否 |
| P027 | 縮排決定 branch，return 決定 action；compile receipt 只驗 syntax，verify 才驗 API。 | code close | M1 `draw_return` | 三行縮排＋action token | 標題＋4 行 code＋3 命令＋2 句 | 審核：命令與 code 若超 safe zone，拆 compile／API |

## P028–P038：共同模型與 evidence grammar

P033／P034 是公式專用頁。兩頁都要保留原生 `draw_formula` 的 hook，但清空
公式位置後方的 title/body placeholder，讓 OMML 只進入專用公式框；任何箭頭、
分隔線或卡片邊線都不得穿過公式框。公式下方另放一個 24 pt 的完整解釋句，
不要用 raw LaTeX 或第二份 fallback 文字。插入後以 absolute P033／P034
與其 logical formula index 對照，驗證 `omath=1`，再做原尺寸 render。

| P | 教學角色與需講清楚的事 | family | 實際可行模板／自訂版型 | 主要視覺 | 上限 | 拆頁 |
|---|---|---|---|---|---|---|
| P028 | 先建立 SLEEP、WAIT、WAKE、PROCESS、TX、RX 的 state vocabulary；action 名稱不是完整 ledger。 | state model | M2 `draw_states` | 六狀態帶＋energy bucket | 標題＋6 節點＋2 完整句 | 否 |
| P029 | 挑戰句是「休眠是否真的省電？」；success gate 要先看 service，再看整段 J。 | challenge hero | M2-自訂 `draw_lab_hero` | 大挑戰句＋success gate | 標題＋挑戰句＋2 句＋1 問題 | 否 |
| P030 | SEND 是 attempt，不是 delivered；packet 要走 queue、retry、deadline、service verdict。 | packet timeline | M2 `draw_packet` | packet lifecycle timeline | 標題＋6 節點＋2 句 | 否 |
| P031 | 相同 scenario／工作／窗口後，先過 service gate 才比較 endpoint J。 | gate flow | M2 `draw_service` | service → energy 雙閘門 | 標題＋2 閘門＋2 句＋比較句 | 否 |
| P032 | W 是瞬間功率，J 是功率×時間累積；要沿 interval 解讀 energy bucket。 | area analogy | M2 `draw_powerarea` | P(t) 高度與時間面積 | 標題＋公式短句＋2 句 | 否 |
| P033 | `E_endpoint = Σ P_s t_s` 只描述 endpoint boundary；數字仍來自 result artifact。 | formula | OMML formula hook（logical formula slide 6） | 中央可編輯公式＋下方 scope sentence | 標題＋1 公式＋2 句 | 否；公式框不得與 placeholder／線重疊 |
| P034 | `η_E = D_delivered / E_endpoint` 的分子、分母與 bit/J 邊界要同時說明。 | ratio formula | OMML formula hook（logical formula slide 7） | 分子／分母對齊＋單位 | 標題＋1 公式＋2 句＋1 問題 | 否；公式框不得與 placeholder／線重疊 |
| P035 | source、model、course assumption、result 是四層不同證據；simulated 不變成 measured。 | provenance layers | M2 `draw_provenance` | 四層堆疊 | 標題＋4 層＋2 句 | 否 |
| P036 | scenario、seed、policy hash、units 把 RUN → REPLAY → WORKBOOK 綁在一起；不一致要 fail closed。 | identity chain | M2 `draw_identity` | 三段 identity chain | 標題＋3 節點＋3 句 | 否 |
| P037 | baseline 是 control；scenario／seed／traffic／window／scope 固定，只改一個 marked block。 | control rule | M2 `draw_fairness` | control／one-edit／observe 三欄 | 標題＋3 欄×2 行＋2 句＋1 問題 | 審核：若欄位不足 24 pt，改成上下 control strip |
| P038 | changing service window 會改變「現在送或等一下」的機會；不從這頁推導 live LEO 數據。 | window context | M2 `draw_window` | open／closed＋quality band 時間帶 | 標題＋4 段窗口＋2 句 | 否 |

## P039–P048：Lab A 施工順序（固定一張 run 頁）

Lab A 的因果主線固定為：`REST_DURING_GAP` → `WAIT／SLEEP` →
`awake_idle／sleep／wake` → packet／service → endpoint J。P041 顯示
`REST_DURING_GAP = WAIT` 的 exact edit；P042 只做一次快速 run；P043–P045
把 result path 讀成 before／after 與因果；P046–P048 不再新增命令頁。

| P | 教學角色與需講清楚的事 | family | 實際可行模板／自訂版型 | 主要視覺 | 上限 | 拆頁 |
|---|---|---|---|---|---|---|
| P039 | 先問「同一份工作，SLEEP 還是 WAIT？」；說明成功條件與 baseline → edit → run → compare → withheld 順序。 | lab challenge hero | M2-自訂 `draw_lab_hero` | 挑戰句＋因果路徑＋success gate | 標題＋2 句＋5 節點＋1 問題 | 否 |
| P040 | 先講 baseline 如何決策，再用 P042 第一條 stdout path 讀 control evidence；baseline 不是答案。 | baseline evidence | M2-自訂 `result_card` | decision card → evidence card | 標題＋2 完整句＋4 metrics＋1 比較句 | 否 |
| P041 | 逐行解釋 `PACE_GAP_STEPS = 2` 與 `REST_DURING_GAP = SLEEP`，只把後者 exact edit 為 `WAIT`，並先寫方向預測。 | code walkthrough／exact edit | M2-自訂 `draw_code` 的 edit zoom | 左程式碼放大＋右因果箭頭 | 標題＋最多 7 行 code＋3 句＋2 command lines | 審核：若 backup／compile 命令擠壓 code，拆講解文字而非新增 run 頁 |
| P042 | 唯一 A run／receipt：同一條 ribbon 排 baseline、candidate `--freeze`、hidden 三條 POSIX／Windows command；每次讀 stdout 新 path。 | command／receipt | M2-自訂 compact `draw_run` | 三段橫向 command ribbon＋receipt nodes | 標題＋3 command steps＋每步 2 receipt 欄＋1 recovery sentence | 否，硬性一頁 |
| P043 | 開啟 P042 的 baseline／candidate paths，先核 identity／boundary，再填 before／after 比較句。 | before／after result | M2-自訂 `draw_compare` | 兩張 result card＋中央 identity gate | 標題＋2 cards×4 metrics＋2 句＋1 問題 | 審核：若 path 說明與 cards 重疊，拆 path 教法與比較解讀；不可增加 run |
| P044 | 從 candidate result 的 `events` 與 `energy_breakdown_j` 找 WAIT 的 awake-idle／wake 成本。 | state ledger | M2-自訂 `draw_ledger` | state interval → energy bucket | 標題＋6 bucket＋2 句＋1 比較句 | 否 |
| P045 | 把 attempted、retry、delivered、expired 接到 service gate；少送或少做不能直接稱為節能。 | packet／service causality | M2-自訂 `draw_packet_service` | packet ledger → service verdict | 標題＋5 metrics＋2 句＋1 問題 | 否 |
| P046 | candidate freeze 的 policy hash、predecessor、active block、receipt SHA 是 hidden 入場條件；本頁不重跑。 | freeze／recovery | M2-自訂 `draw_freeze` 或 `lineage_gate` | frozen checkpoint → hidden gate | 標題＋5 lineage fields＋2 句 | 否 |
| P047 | 讀 P042 第三條 hidden path；保持 frozen policy，不 retune；直接說明反例如何縮小 claim。 | withheld result | M2-自訂 `draw_withheld` | frozen policy／hidden evidence 雙欄 | 標題＋2 欄×3 行＋2 句＋1 比較句 | 否 |
| P048 | 用一句因果句收束 primary／hidden：state、packet／service、J 與適用條件要一起出現。 | result debrief | M2-自訂 `draw_debrief` | 條件 → 機制 → evidence 句子拼接 | 標題＋1 句型＋2 句＋1 問題 | 否 |

## P049–P062：Lab B 施工順序與全域 recovery

Lab B 的主線固定為：`quality_band + stable_steps` → enter／hold／exit
transition → `WAIT／SEND` → packet／deadline／service → endpoint J。
P055 的唯一 edit 是 `STABLE_STEPS = 1`；P056 是唯一 run ribbon；P058–P062
只負責 lineage、withheld、counterexample 與復原。

| P | 教學角色與需講清楚的事 | family | 實際可行模板／自訂版型 | 主要視覺 | 上限 | 拆頁 |
|---|---|---|---|---|---|---|
| P049 | 先問「等穩定訊號會不會錯過服務？」；說明 success gate 是 transition、packet、service、J 加 Trace B。 | lab challenge hero | M2-自訂 `draw_lab_hero` | 挑戰句＋quality window＋success gate | 標題＋2 句＋5 節點＋1 問題 | 否 |
| P050 | 解釋 `ENTER_QUALITY = 2`：何時由 REST 進入 send-ready，並把 stable hold 接到 transition。 | threshold walkthrough | M2-自訂 `draw_code`／`threshold_ladder` | quality 0–3 階梯＋進入門 | 標題＋3 code lines＋2 句 | 否 |
| P051 | 解釋 `EXIT_QUALITY = 1` 與 hysteresis：已進入後何時退出，避免把品質線當成服務保證。 | hysteresis model | M2-自訂 `threshold_ladder`／`draw_window` | enter／hold／exit 雙線 | 標題＋3 段 threshold＋2 句＋1 問題 | 否 |
| P052 | 逐行說明 `ENTER_QUALITY=2`、`EXIT_QUALITY=1`、`STABLE_STEPS=2`；只把最後一行保留給 exact edit。 | code walkthrough | M2-自訂 `draw_code` 的 stable hold zoom | policy block＋連續 step 對照 | 標題＋3 code lines＋3 句 | 否 |
| P053 | 在 Trace A 上先標 enter、hold、exit，再預測 `STABLE_STEPS = 1` 哪個 transition 會提早。 | prediction annotation | M2 `draw_prediction` 的 trace 版 | quality trace＋三個可填標記 | 標題＋4 個 prediction blanks＋2 句 | 否 |
| P054 | 先讀 Trace A baseline decision，再用 P056 第一條 stdout path 讀 control evidence；不要再放 baseline command。 | baseline evidence | M2-自訂 `result_card` | A predecessor card＋Trace A evidence card | 標題＋2 完整句＋4 metrics＋1 比較句 | 否 |
| P055 | 逐行把 B baseline `STABLE_STEPS = 2` 改成 exact `STABLE_STEPS = 1`；A 的 `REST_DURING_GAP = WAIT`、threshold 與 C block 不動。 | code walkthrough／exact edit | M2-自訂 `draw_code` 的 edit zoom | 左 B code＋右 transition mechanism | 標題＋最多 7 行 code＋3 句＋2 command lines | 審核：若 backup／compile 擁擠，拆 edit 說明與 recovery，不增加 run |
| P056 | 唯一 B run／receipt：同一條 ribbon 排 Trace A baseline、candidate `--freeze`、Trace B 三條 POSIX／Windows command；每次讀 stdout 新 path。 | command／receipt | M2-自訂 compact `draw_run` | 三段橫向 command ribbon＋freeze receipt | 標題＋3 command steps＋每步 2 receipt 欄＋1 recovery sentence | 否，硬性一頁 |
| P057 | 用 P056 paths 對齊 MODE_CHANGE、packet、deadline、service、J，說出 hold=1 的 before／after 及是否真保住服務。 | before／after causality | M2-自訂 `draw_packet_service`／transition | 上 transition、下 packet／service | 標題＋2 result columns×4 metrics＋2 句＋1 問題 | 審核：若 transition 與 result cards 同頁過密，拆解讀頁；不可增加 run |
| P058 | B candidate freeze 必須連回 A predecessor；hash／active block／receipt 是 Trace B 入場條件。 | freeze／recovery | M2-自訂 `draw_freeze`／`lineage_gate` | A predecessor → B checkpoint → Trace B gate | 標題＋6 lineage fields＋2 句 | 否 |
| P059 | 讀 P056 第三條 Trace B path；保持兩個 frozen 值，說明泛化邊界，不再 retune。 | withheld result | M2-自訂 `draw_withheld` | frozen policy／Trace B evidence 雙欄 | 標題＋2 欄×3 行＋2 句＋1 比較句 | 否 |
| P060 | 區分 too-slow 與 ping-pong：hold 太長錯過窗口，threshold 太近造成多次 transition；要用事件與 summary 判斷。 | counterexample comparison | M2 `draw_counterexample` | 兩個 failure mode 對照 | 標題＋2 欄×3 行＋2 句＋1 問題 | 否 |
| P061 | 用 Trace A／Trace B 的 evidence 寫條件式結論：改善、service failure、window／traffic 限制都要保留。 | result debrief | M2 `draw_debrief`／`claim_boundary` | 兩 trace＋claim ceiling | 標題＋2 欄×3 行＋2 句＋1 比較句 | 否 |
| P062 | 以 copy 復原 A／B checkpoint 或 release baseline；compile 後重跑對應 exact case，新的 stdout path 才是新 evidence。 | recovery map | M2 `draw_checkpoint`＋custom recovery ribbon | 三個 restore nodes＋雙向 lineage 箭頭 | 標題＋3 restore choices＋2 compile lines＋2 句 | 是：先拆 policy restore，再拆 result／replay 重跑規則；兩頁都不是 run ribbon |

## P063：自然橋接到網站匯入

| P | 教學角色與需講清楚的事 | family | 實際可行模板／自訂版型 | 主要視覺 | 上限 | 拆頁 |
|---|---|---|---|---|---|---|
| P063 | 說清楚「為什麼上傳 result.json」：網站不執行 policy，而是驗證 identity／schema／units／provenance，把 JSON 變成 endpoint replay，保留 baseline／candidate／withheld 比較與 workbook。 | bridge／handoff | M2-自訂 `bridge`（可重用 `draw_identity` 的三段鏈） | runner stdout path → validator → replay → workbook | 標題＋4 節點＋2 完整句＋1 比較句＋1 問題 | 審核：若匯入規則與 claim boundary 無法保留 24 pt，拆成 bridge／fail-closed 兩頁 |

P063 的可見流程固定為：`runner stdout result_path` → 選取該次
`result.json` → 驗證 schema／identity／units／provenance → 讀同一 run 目錄的
`endpoint-replay.json` → 保留 baseline／candidate／withheld → 開啟 Energy
Decision Workbook。畫面必須明寫網站不執行 `student_policy.py`；匯入失敗要
fail closed，不能替錯誤 scenario 猜身份、改寫原 workbook 或把 simulated data
說成 live／measured。

## 拆頁與驗證 gate

必須先處理的拆頁風險是 P019、P062；它們的命令／復原選項超過單一視覺能
安全承載的密度。P010、P011、P014、P016、P018、P021、P023、P025、P027、
P041、P043、P055、P057、P063 標為 render 審核點：若 body 不能維持 24 pt、
command 不能維持 20 pt，就依表中方向拆頁。P042／P056 是硬性例外，不能
拆 run；要從輔助說明、欄位數或間距收斂，保留三條 exact commands 與 stdout
`result_path` 教法。

OMML、template 與頁面驗證要分開記錄：

1. 先以 native template source／master／layout／footer／background byte check 確認未被改寫。
2. 對 P033／P034 檢查專用公式框、placeholder 清空、線條 clearance、可編輯 Office Math 與 `omath=1`。
3. 對全部 P001–P063 以原尺寸 render 檢查文字 overflow、crop、footer intrusion、placeholder overlap、線穿字與白空間；目前既有 Part B render report 的 structural／formula checks 不能代替 controller 的逐頁人眼檢查。
4. 靜態檢查不得出現禁止的精確中文字、時長標籤、亮橘文字；operation／result／recovery 頁要能在沒有 notes 的情況下看懂 purpose、exact edit／command、expected output、causal interpretation 與 recovery。
