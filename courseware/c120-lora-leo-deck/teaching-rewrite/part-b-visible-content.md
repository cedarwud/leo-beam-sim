# P028–P063 可直接授課的 Lab A／Lab B 顯示內容

這份檔案是給投影片 builder 使用的「畫面上要看得到的教學文字」，不是講師
備忘錄。每頁都先說這一頁要解決的問題，再給可觀察的證據；命令頁同時列出
POSIX／WSL 與 Windows Command Prompt 的完整命令。所有命令都假設目前目錄是
解壓後唯一的 `lora-energy-lab/` 根目錄，而且 setup／verify 已先顯示 `READY`。

## 全模組版面與證據規格

- 標題：28 pt；主要解釋文字：26 pt；次要說明：24 pt；命令：20–22 pt；標籤與頁腳：20 pt。必要的 provenance／失敗標籤可用 18 pt，但任何文字不得低於 18 pt。
- 文字顏色使用深墨、深藍、深綠、深紫與深紅；文字不使用亮橘色。顏色只標示角色，不代替文字說明。
- 不放任何時長標籤，不重複同一個五欄問題軌。版面依頁面目的改用 `split_statement`、`state_strip`、`formula_focus`、`command_ribbon`、`result_compare`、`timeline`、`recovery_map` 與 `bridge`。
- 本模組的固定 claim boundary 是：`SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED`。endpoint energy 只涵蓋套件宣告的 radio／processing 假設。
- runner stdout 印出的 `result_path` 是該次執行的唯一結果入口。將 stdout 的路徑原樣貼到檔案選擇器或 `python -m json.tool` 命令；不要自行猜 run ID，也不要把另一個 case 的 fallback 路徑當成本次結果。配對的 `endpoint-replay.json` 位於同一次 run 的同一個產物目錄。

### 必須保留的頁面拆分旗標

若 educate template 的命令區與結果區無法在上述字級下同時容納，必須拆頁，不得縮小文字：

- `P040`：可拆成「保留 baseline」與「讀 stdout result_path」兩頁。
- `P043`：可拆成「baseline／candidate 摘要」與「比較句型」兩頁。
- `P054`：可拆成「保留 Trace A baseline」與「讀 stdout result_path」兩頁。
- `P062`：可拆成「復原 policy」與「復原 result／replay」兩頁。
- `P042` 與 `P056` 是硬性單頁例外：三條命令必須留在同一張 compact run／receipt ribbon；若內容過密，只能刪減輔助文字或改成更窄的三段 ribbon，不得拆成多張 run 頁。
- 其餘頁面應先換版面；只有在仍無法保留 24 pt 主要文字時才拆分。

---

## P028 — 先辨認 radio state，才談省電

- `kind`: concept
- `layout`: state_strip（六個狀態沿一條時間帶排列）
- `split_flag`: no
- `title`: 先辨認 radio state，才談省電
- `lead`: `同一個 WAIT 和 SLEEP，留下的 state ledger 不一樣。`
- `visible_explanation`: `SLEEP` 表示低功耗休息；`WAIT` 表示保持清醒但暫不傳送。真正的收發還會經過 `WAKE`、`PROCESS`、`TX` 與 `RX`，所以不能只看 policy decision 的文字就宣稱節能。
- `state_strip`: `SLEEP：低功耗休息` → `WAKE：回復成本` → `PROCESS：處理` → `TX：送出` → `RX：接收`；`WAIT：awake idle，仍在耗電`
- `purpose`: 讓全班建立共同的 state 名稱，後面讀 JSON 時知道每個時間區間代表什麼。
- `mechanism`: runner 將每個固定步長寫成 state interval，並把該區間的功率乘上時間累加到 endpoint energy。
- `takeaway`: `名字 → state interval → energy bucket`；不可用一個 action 名稱取代完整 ledger。

## P029 — Lab A 的挑戰：休眠是否真的省電？

- `kind`: challenge
- `layout`: split_statement（左側挑戰句、右側成功條件）
- `split_flag`: no
- `title`: Lab A：休眠是否真的省電？
- `challenge`: `挑戰句：在同一份工作與同一組服務窗口中，把空檔的 SLEEP 改成 WAIT，是否真的讓 endpoint energy 下降？`
- `success_condition`: `成功不是看到較低的單一功率，而是先確認 delivered／deadline／freshness 的 service gate，再比較整段 endpoint J。若服務未保住，較低的 J 只能叫 trade-off，不能叫節能成功。`
- `visible_explanation`: `SLEEP` 可能降低 idle power，但醒來時要支付 wake latency 與 wake energy；`WAIT` 不支付 wake，卻會讓 awake-idle 時間增加。Lab A 會把這個方向性預測交給 baseline、candidate 與 withheld case 檢驗，而不是先把答案寫在投影片上。
- `purpose`: 讓參與者知道為何值得跑 Lab A，以及什麼證據才算回答挑戰。
- `mechanism`: 只改 `lab-a-pace-rest` 的一個標記區塊，固定 scenario、seed、traffic 與 endpoint boundary，讓 state／packet／service／J 的差異可以歸因到這個控制點。
- `question`: `若 J 下降但 service_pass 變成 false，這是節能，還是用服務換能量？`

## P030 — 封包生命週期：送出不是交付

- `kind`: concept
- `layout`: timeline（queue 到 verdict 的水平流程）
- `split_flag`: no
- `title`: 封包生命週期：送出不是交付
- `visible_explanation`: 封包會先生成並進入 queue，接著才可能產生 attempt；attempt 可能碰撞、重傳、成功 delivered，或在 deadline 前 expired。`SEND_ONE`、`SEND_URGENT` 或 `FLUSH_BATCH` 只是 policy decision，不能直接代表服務已交付。
- `timeline`: `generated → queue → attempt → collision／retry → delivered 或 expired → service verdict`
- `purpose`: 讓讀者在後面的 result page 先讀 packet ledger，再讀 energy ledger。
- `mechanism`: result 的 `summary` 統計 attempted、retransmissions、unique_delivered、expired 與 deadline；endpoint replay 把每個 event 物化成可逐步回看的 frame。
- `takeaway`: `一次 TX 是一次嘗試；service 要看完整 packet outcome。`

## P031 — 先過 service gate，再比較 J

- `kind`: concept
- `layout`: gate_flow（兩個門：service → energy）
- `split_flag`: no
- `title`: 先過 service gate，再比較 J
- `visible_explanation`: 兩個 policy 必須使用同一個 scenario、工作、窗口、traffic 與 endpoint scope，才有資格比較。先看 required packet 是否交付、deadline 是否通過、freshness 是否合格，再看 endpoint energy；candidate 少送很多資料時，較低的 J 不能直接升格為節能。
- `gate_flow`: `same identity` → `delivered／deadline／freshness` → `service_pass` → `endpoint_energy_j`
- `purpose`: 防止把「少做工作」誤教成「更有效率」。
- `mechanism`: runner 的 `service_pass` 同時檢查 required packet、minimum bits、deadline、expired 數量與 freshness；比較頁必須把這些欄位一起呈現。
- `comparison_sentence`: `在相同 ______ 下，candidate 的 service ______；因此 endpoint J 的差異應解讀為 ______，而不是直接稱為節能。`

## P032 — W 是瞬間功率，J 是整段累積

- `kind`: concept
- `layout`: area_analogy（左側功率高度、右側時間面積）
- `split_flag`: no
- `title`: W 是瞬間功率，J 是整段累積
- `visible_explanation`: W 表示某個 state 當下的功率，J 是功率在時間上的累積；同樣的峰值可以因為持續時間不同而得到不同的總能量。請先沿 state interval 看時間，再把各 bucket 的 J 加回 endpoint total，不要只挑一個看起來漂亮的欄位。
- `visual_formula`: `功率（W） × 時間（s） = 能量（J）`
- `purpose`: 把 `awake_idle`、`sleep`、`wake`、`process`、`tx`、`rx` 的差異接到總 J。
- `mechanism`: engine 以固定 10 s clock step 執行 WAIT／SLEEP；收發流程另外累加 process、TX、RX 與 wake energy。
- `takeaway`: `低峰值不保證低總 J；時間是因果鏈的一部分。`

## P033 — endpoint energy 公式只涵蓋 endpoint 邊界

- `kind`: concept
- `layout`: formula_focus（原生 Office Math 居中，兩側文字）
- `split_flag`: no
- `title`: endpoint energy 公式只涵蓋 endpoint 邊界
- `formula`: `E_endpoint = Σ P_s t_s`
- `visible_explanation`: 這個式子把每個 endpoint state 的功率與持續時間加總成 `E_endpoint`。下標 `endpoint` 是邊界提醒：它不是衛星、閘道器或整個部署系統的 wall-plug energy，數字仍必須從 result artifact 讀取。
- `purpose`: 讓參與者能解釋分母的範圍，而不是只背公式。
- `mechanism`: result 的 `energy_breakdown_j` 對應 state／transition bucket，`summary.endpoint_energy_j` 是同一邊界下的總和。
- `takeaway`: `公式說明怎麼累積；artifact 才提供這次 run 的數值。`

## P034 — energy efficiency 的分子與分母要同一個邊界

- `kind`: concept
- `layout`: ratio_focus（分子與分母上下對齊）
- `split_flag`: no
- `title`: energy efficiency 的分子與分母要同一個邊界
- `formula`: `η_E = D_delivered / E_endpoint`；`bit ÷ J = bit/J`
- `visible_explanation`: 分子是實際 `delivered_bits`，分母是同一個 endpoint scope 的 `endpoint_energy_j`，因此單位是 bit/J。若 candidate 只降低 J 卻同時失去 required packet，先描述服務 trade-off，再決定這個比值是否有教學意義。
- `purpose`: 讓全班知道效率比值不是單獨的節能證明。
- `mechanism`: runner 以 `delivered_bits / endpoint_energy_j` 產生 `endpoint_energy_efficiency_bits_per_j`；它不能代替 `service_pass` 或 deadline verdict。
- `takeaway`: `先確認交付資料，再把 bit 與 J 放進同一個邊界。`

## P035 — 來源、模型、課程假設與結果要分開

- `kind`: concept
- `layout`: four_layer（四層上下堆疊）
- `split_flag`: no
- `title`: 來源、模型、課程假設與結果要分開
- `visible_explanation`: release package 的 scenario、runner 與 policy 一起決定這次 deterministic teaching run；上游 repository 與 commit 只是 provenance 參考，不表示 runner 執行了上游研究程式。讀 result 時要沿 `scenario_id`、`seed`、`policy_sha256` 與 `artifact_source` 回溯，才知道數字從哪裡來。
- `layers`: `source：provenance 參考` → `model：coherent-course-simulated-adapter` → `course：固定 scenario／endpoint 假設` → `result：這次 run 的 JSON 與 replay`
- `purpose`: 防止把模擬結果誤說成 live 或量測。
- `mechanism`: result 的 `runner_provenance.upstream_execution` 固定為 `false`，`claim_boundary` 會跟著 artifact 一起保存。
- `takeaway`: `結果可追溯，不代表結果變成現場量測。`

## P036 — 一個 scenario_id 綁住 RUN → REPLAY → WORKBOOK

- `kind`: concept
- `layout`: identity_chain（橫向 identity 鏈）
- `split_flag`: no
- `title`: 一個 scenario_id 綁住 RUN → REPLAY → WORKBOOK
- `visible_explanation`: `scenario_id`、scenario hash、anchor、policy hash、seed 與 units 必須在 scenario、result、endpoint replay 與 workbook 之間一致。任何 identity mismatch 都應 fail closed；不要手改 JSON 讓畫面看似完成，也不要用另一個 case 的 replay 補洞。
- `identity_chain`: `scenario package` → `result.json` → `endpoint-replay.json` → `Leo replay` → `Energy Decision Workbook`
- `purpose`: 先建立「為什麼要配對檔案」的理由，P063 再回到網站匯入。
- `mechanism`: importer 驗證 schema／identity／units／provenance 後，才 materialize endpoint replay；不一致時 workbook 維持原狀。
- `takeaway`: `同一條 provenance 鏈比單一漂亮數字更重要。`

## P037 — baseline 是 control，不是舊截圖

- `kind`: concept
- `layout`: control_card（左 control、右 one-edit rule）
- `split_flag`: no
- `title`: baseline 是 control，不是舊截圖
- `visible_explanation`: baseline 使用 release 預設 policy，讓我們知道在固定 scenario 與 seed 下 runner 原本會留下什麼 ledger。candidate 只改目前 Lab 的一個 marked block；若同時換 scenario、traffic、seed 或 boundary，這組 A/B 就失去因果資格。
- `control_rule`: `固定：scenario／seed／traffic／window／endpoint scope`
- `edit_rule`: `只改：目前 lab 的 marked block`
- `observe_rule`: `比較：state／packet／service／endpoint J`
- `purpose`: 讓執行前的控制條件先被看見，避免把環境差異誤當 policy 效果。
- `question`: `若兩次 result 的 scenario hash 不同，還能說是 policy 造成的差異嗎？`

## P038 — LEO 在這裡是 changing service window 的例子

- `kind`: concept
- `layout`: window_band（開窗、關窗、第二個窗口）
- `split_flag`: no
- `title`: LEO 在這裡是 changing service window 的例子
- `visible_explanation`: 固定 scenario 內有兩段 contact window，中間也有 contact closed 的區間；quality trace 會從 closed、weak、usable 到 strong 再回落。LEO 在本課只用來表達「服務機會會改變」，不是要從這頁推導 live TLE 或衛星量測。
- `window_band`: `closed → contact-a／品質變化 → closed → contact-b／品質變化 → closed`
- `purpose`: 為 Lab B 的「等穩定訊號」問題準備 changing opportunity 的背景。
- `mechanism`: `contact_open`、`quality_band`、`contact_remaining_s` 會進入 policy observation，窗口關閉時 runner 只接受 `SLEEP`。
- `takeaway`: `先問 action 落在什麼服務窗口，再問它省不省電。`

## P039 — Lab A 先鎖定問題，再動 policy

- `kind`: challenge
- `layout`: challenge_wall（大字挑戰句＋三段證據箭頭）
- `split_flag`: no
- `title`: Lab A：同一份工作，SLEEP 還是 WAIT？
- `challenge`: `為什麼值得做：低功耗休眠看起來省電，但醒來成本可能改變送達與期限；我們要用一個可重跑的 A/B 實驗把這個直覺拆開。`
- `success_condition`: `成功條件：固定 scenario／seed／traffic／window；先確認 service，再用 state ledger 解釋 endpoint J，最後讓 hidden case 檢驗同一個機制是否仍成立。`
- `causal_path`: `REST_DURING_GAP` → `WAIT／SLEEP` → `awake_idle／sleep／wake` → `attempt／retry／delivered／expired` → `service_pass + endpoint_energy_j`
- `lab_sequence`: `問題（P039）` → `基線 decision（本頁）` → `baseline evidence（P040）` → `常數逐行解釋與 exact edit（P041）` → `改前預測（P041）` → `唯一 compact run／receipt ribbon（P042：baseline／candidate freeze／hidden 三條命令）` → `before／after 對照（P043）` → `state／packet 因果解釋（P044–P045）` → `withheld／recovery（P046–P048）`
- `baseline_decision`: `contact_open=false → SLEEP；若 steps_since_send < PACE_GAP_STEPS（2）→ REST_DURING_GAP，而 release baseline 的 REST_DURING_GAP = SLEEP；通過 gap 後才依 quality、stable_steps、queue 與 send mode 選擇 WAIT 或 SEND。`
- `visible_explanation`: Lab A 不要求先猜一個漂亮的 J，而是要求說出「我改了哪一行、它先改變哪個 state、state 如何影響 packet、最後 service 與 J 怎麼變」。若 hidden case 反駁方向，這個反例就是結果的一部分，不需重新調參。
- `question`: `你的預測是 WAIT 會少一次 WAKE，還是會付出更多 awake-idle？請先寫下理由。`

## P040 — A-00：baseline evidence 是 control，不是答案

- `kind`: result
- `layout`: result_card（左 baseline decision、右 evidence checklist）
- `split_flag`: no
- `title`: A-00：先理解 baseline 怎麼決策，再讀 evidence
- `purpose`: 讓 baseline 成為後面 before／after 的 control；本頁不再放第二張 run 命令頁。
- `exact_policy_state`: release baseline 的 A block 是 `PACE_GAP_STEPS = 2`、`REST_DURING_GAP = SLEEP`。candidate 的唯一 edit 會在 P041 改成 `REST_DURING_GAP = WAIT`，兩次 run 的結果由 P042 的同一條 run ribbon 產生。
- `baseline_decision`: `contact_open=false → SLEEP；steps_since_send < 2 → REST_DURING_GAP = SLEEP；通過 gap 後才依 quality／stable_steps／queue 選擇 WAIT 或 SEND。`
- `baseline_evidence`: `用 P042 的第一個 stdout result_path 讀 summary、events 與配對 endpoint-replay；參考摘要是 endpoint_energy_j=6.92、delivered_bits=4800、service_pass=false，實際數字以該 result_path 為準。`
- `causal_interpretation`: `baseline 只是原始 control，不回答休眠是否值得；它讓下一頁的 WAIT edit 有固定的 state／packet／service／J 對照。`
- `comparison_sentence`: `baseline 在 gap 回傳 SLEEP，因此先觀察 ______；candidate 改成 WAIT 後，我要檢查 ______ 是否改變。`
- `recovery`: `若 baseline result／replay pair 缺失，保留目前檔案，回到 P042 的 baseline 命令並使用新 stdout result_path；不要自行輸入 fallback 檔名，也不要改 JSON。`
- `result_path_rule`: `所有 baseline 讀取都使用 P042 第一條命令印出的 result_path；配對 endpoint-replay.json 必須位於同一個 generated run 目錄。`

## P041 — A-01：只改一個 marked block

- `kind`: operation
- `layout`: edit_zoom（程式碼區放大、因果箭頭放右側）
- `split_flag`: no
- `title`: A-01：把空檔的 REST 改成 WAIT
- `purpose`: 將 Lab A 的單一假說變成可執行的 bounded edit。
- `exact_policy_state`: `在開始編輯前，A block 是 REST_DURING_GAP = SLEEP；本頁完成後必須是 REST_DURING_GAP = WAIT。`
- `exact_edit`: 在 `student_policy.py` 只把下面一行改成：
  ```python
  REST_DURING_GAP = WAIT
  ```
  `PACE_GAP_STEPS = 2` 與其他兩個 marked block 必須保持原樣。
- `line_explanation`: `PACE_GAP_STEPS = 2` 定義送出之間至少隔幾個固定 step；`REST_DURING_GAP` 定義 gap 期間回傳的 action。這次只改第二行，讓班上可以把 action 差異與後面的 state ledger 對上。`
- `pre_edit_prediction`: `改前先寫：WAIT 可能少一次 WAKE，但 awake-idle 可能增加；如果 service 不變，才比較整段 endpoint J。`
- `posix_commands`:
  ```sh
  cp student_policy.py student_policy.before-A-edit.py
  .venv/bin/python -m py_compile student_policy.py
  ```
- `windows_cmd_commands`:
  ```bat
  copy /Y student_policy.py student_policy.before-A-edit.py
  .venv\Scripts\python.exe -m py_compile student_policy.py
  ```
- `expected_stdout`: `py_compile 沒有文字錯誤且回傳碼為 0；畫面上的 active block 顯示 REST_DURING_GAP = WAIT。`
- `causal_interpretation`: `WAIT 讓 radio 在 gap 期間保持 awake idle；它可能避免下一次 WAKE，卻也可能累積更多 awake-idle energy。這一頁只有 mechanism，不把方向寫成結果。`
- `recovery`: `若值、縮排或 policy guard 出錯，POSIX 執行 cp student_policy.before-A-edit.py student_policy.py；Windows 執行 copy /Y student_policy.before-A-edit.py student_policy.py，再重新 py_compile。不要改 runner、scenario、schema 或 generated JSON。`
- `result_path_rule`: `本頁尚未產生 result_path；下一頁執行 candidate 後只接受 stdout 新印出的路徑。`

## P042 — A-02：Lab A compact run／receipt ribbon

- `kind`: operation
- `layout`: command_ribbon_compact（單一橫向三階段 ribbon；不再拆成三張 run 頁）
- `split_flag`: `no（Lab A 的唯一 run／receipt 頁；若版面過密，刪減輔助說明或改成三段窄 ribbon，但不可把 run 拆成多頁，也不可把字縮到 18 pt 以下。）`
- `title`: A-02：一條 ribbon 完成 baseline → candidate → hidden
- `purpose`: 這是 Lab A 唯一的快速執行／receipt 頁；baseline、candidate freeze、hidden 三個 case 共用同一個 stdout result_path 教法。
- `exact_policy_state`: `第一條命令前是 REST_DURING_GAP = SLEEP；第一條完成後只改 A marked block 成 REST_DURING_GAP = WAIT；candidate freeze 成功後保持 frozen policy 執行 hidden。`
- `posix_commands`:
  ```sh
  # 1. baseline：不要改 policy
  bash course.sh run --lab A --case baseline
  # 2. candidate：先完成 P041 的 REST_DURING_GAP = WAIT，再 freeze
  bash course.sh run --lab A --case candidate --freeze
  # 3. hidden：保持 A frozen，不再 edit
  bash course.sh run --lab A --case hidden
  ```
- `windows_cmd_commands`:
  ```bat
  rem 1. baseline：不要改 policy
  course.cmd run --lab A --case baseline
  rem 2. candidate：先完成 P041 的 REST_DURING_GAP = WAIT，再 freeze
  course.cmd run --lab A --case candidate --freeze
  rem 3. hidden：保持 A frozen，不再 edit
  course.cmd run --lab A --case hidden
  ```
- `ribbon_read_order`: `baseline stdout result_path → P041 exact edit → candidate stdout result_path + artifacts/checkpoints/lab-a-frozen.{json,py} → hidden stdout result_path；每個 result_path 都原樣保存，配對 replay 取同一個 generated run 目錄。`
- `expected_stdout`: `三次成功 stdout 都應有 status=OK、artifact_source=student-run 與各自新的 result_path；candidate 另應留下 lab-a-frozen checkpoint，hidden 不建立新的 freeze。不要自行猜 run ID 或 fallback path。`
- `expected_result`: `參考摘要：baseline 6.92 J／4800 bit／service_pass=false；candidate 8.86 J／4800 bit／service_pass=false；hidden 3.61 J／0 bit／service_pass=false。這些只是讀法參考，實際 summary 以三次 stdout result_path 為準。`
- `causal_interpretation`: `這條 ribbon 只負責建立可回放 evidence；WAIT 少了 WAKE 卻可能增加 awake-idle，hidden 若方向不同則要縮小 claim，而不是再調參。`
- `recovery`: `任一步失敗都保留 stdout／stderr；POSIX 用 cp student_policy.before-A-edit.py student_policy.py 還原 edit，Windows 用 copy /Y student_policy.before-A-edit.py student_policy.py，重新完成該段命令。candidate freeze 缺失時不得直接跑 hidden。`
- `result_path_rule`: `三條命令的 result_path 分別貼到 baseline／candidate／hidden 的檔案選擇器；網站與 JSON viewer 都只接受該次 stdout path，不接受投影片預填路徑。`

## P043 — A-03：用 result_path 讀 baseline／candidate 比較

- `kind`: result
- `layout`: result_compare（兩欄 result card，中間是同一 identity gate）
- `split_flag`: `SPLIT IF：摘要卡與比較句型無法同頁維持 24 pt。`
- `title`: A-03：先核對同一 boundary，再比較
- `visible_explanation`: 開啟兩次 stdout 指出的 result path，分別讀 `scenario_id`、policy hash、summary 與 claim boundary，再把 candidate 的配對 replay 留在同一個 run 目錄。baseline 與 candidate 的數字只有在 scenario／seed／traffic／endpoint scope 一致時，才可以拿來說明 `REST_DURING_GAP = WAIT` 的後果。
- `how_to_open`:
  ```text
  使用 stdout 印出的 result_path：
  artifacts/<baseline stdout path>/result.json
  artifacts/<candidate stdout path>/result.json
  不要把上面角括號文字當成實際檔名。
  ```
- `expected_result_cards`: `baseline：6.92 J／4800 bit／service_pass=false（參考）；candidate：8.86 J／4800 bit／service_pass=false（參考）。實際卡片以各自 result_path 的 summary 為準。`
- `comparison_sentence`: `在同一個 scenario 與 endpoint boundary 下，WAIT 讓 ______ state time 改變，packet service ______，endpoint J ______；因此本次結果應稱為 ______。`
- `question`: `candidate 沒有增加 delivered_bits 時，J 的變化可以單獨稱為成功節能嗎？`
- `causal_interpretation`: `若 service 同樣未通過，這頁的重點是把兩個失敗拆成同一邊界下的 trade-off，並準備下一頁從 state ledger 找機制。`
- `recovery`: `若兩個 result 的 scenario／policy identity 不同，停止比較；重新從各自 stdout 取得正確 result_path，必要時用 cp／copy 還原 A policy 後重跑，不手改 JSON。`

## P044 — A-04：從 state ledger 找到 WAIT 的成本

- `kind`: result
- `layout`: state_strip（時間帶＋energy bucket）
- `split_flag`: no
- `title`: A-04：state ledger 會告訴我們 J 從哪裡來
- `visible_explanation`: 先在 candidate result 的 `events` 找 `STATE_INTERVAL` 與 `WAKE`，再對照 `energy_breakdown_j`；不要只看 policy decision 的 action 名稱。若 `WAIT` 取代了 gap 的 `SLEEP`，你應該能指出 awake idle 增加或 wake 減少，並把它連回 total endpoint J。
- `result_path_rule`: `candidate 的檔案一律使用 A-02 stdout 印出的 result_path；不要使用投影片預填的 fallback 檔名。`
- `expected_result`: `參考 ledger：awake_idle=6.00 J、sleep=0.04 J、wake=0.02 J、process=0.16 J、tx=2.40 J、rx=0.24 J；實際數字以本次 result 的 energy_breakdown_j 為準。`
- `comparison_sentence`: `因為 REST_DURING_GAP = WAIT，______ state interval 增加／減少，造成 ______ bucket 改變；這解釋了 endpoint J 的 ______。`
- `question`: `你能在 events 中指出第一個與 WAIT 相關的 state interval 嗎？`
- `causal_interpretation`: `這一頁把「WAIT 可能比較耗電」改成可檢查的 state 機制；沒有 state interval 的證據，就不能跳到因果結論。`
- `recovery`: `若 events 與 summary 不相符，保留 result 與 stdout；重新從該次 stdout path 開啟配對 replay，必要時還原 student_policy.py，不修改產物內容。`

## P045 — A-05：把 packet ledger 接回 service verdict

- `kind`: result
- `layout`: packet_to_gate（左 packet timeline、右 service gate）
- `split_flag`: no
- `title`: A-05：attempted 不等於 delivered
- `visible_explanation`: candidate 的 `attempted_packets`、`retransmissions`、`unique_delivered_packets` 與 `expired_packets` 必須一起讀，因為一次送出可能碰撞或最後過期。`service_pass` 與 `deadline_pass` 才回答工作是否被保住，不能用 SEND 次數替代。
- `result_path_rule`: `使用 A-02 stdout result_path 開啟 result；若需要逐事件畫面，再選同一 run 目錄的 endpoint-replay.json。`
- `expected_result`: `參考 candidate ledger：attempted=2、retransmissions=1、delivered_bits=4800、expired_packets=3、service_pass=false、deadline_pass=false；實際以 result summary 為準。`
- `comparison_sentence`: `REST_DURING_GAP = WAIT 先改變 ______，接著造成 ______ packet outcome；因此 service_pass ______，endpoint J 的差異只能解讀為 ______。`
- `question`: `哪一個 packet outcome 讓你不能把本次結果稱為服務成功？`
- `causal_interpretation`: `這裡不是鼓勵少送；而是要求把 radio state 的改變一路追到交付與期限，才知道 energy trade-off 是否值得。`
- `recovery`: `若 candidate result 沒有完整 packet／service 欄位，停止比較，從 stdout 重新選同 run 的 result／replay pair；不可自行補 summary。`

## P046 — A-06：A freeze evidence 與 hidden 入口

- `kind`: recovery
- `layout`: lineage_gate（左 frozen checkpoint、右 hidden entry；不再放第三張 run command）
- `split_flag`: no
- `title`: A-06：freeze 是 hidden 的入場條件
- `purpose`: 把 P042 candidate freeze 留下的 checkpoint 讀成 lineage evidence；執行命令已集中在 P042。
- `exact_policy_state`: `student_policy.py` 的 A block 保持 REST_DURING_GAP = WAIT；不要在這頁再改 PACE 或其他 block。
- `checkpoint_evidence`: `P042 candidate 成功後應有 artifacts/checkpoints/lab-a-frozen.json 與 artifacts/checkpoints/lab-a-frozen.py；JSON 要能對上 scenario_id、active_block_id=lab-a-pace-rest、policy_sha256、predecessor_policy_sha256、seed_role 與 receipt_sha256。`
- `causal_interpretation`: `freeze 把 candidate 的 policy hash 與 predecessor 綁在 receipt；它是 hidden 能否合法進入的 lineage gate，不是另一個結果頁。`
- `recovery`: `若 checkpoint 不存在或 hash 不符，POSIX 執行 cp student_policy.before-A-edit.py student_policy.py；Windows 執行 copy /Y student_policy.before-A-edit.py student_policy.py，回到 P042 的 candidate --freeze；不得直接執行 hidden。`
- `result_path_rule`: `本頁不產生新 result_path；hidden path 只使用 P042 第三條命令的 stdout。`

## P047 — A-07：讀 hidden 結果，不要 retune

- `kind`: result
- `layout`: withheld_result（左 frozen policy、右新條件 evidence；無第二個 run command）
- `split_flag`: no
- `title`: A-07：hidden 只檢驗，不再調參
- `purpose`: 讀 P042 第三條命令產生的 hidden result，判斷 A 機制是否能跨條件成立。
- `exact_policy_state`: `REST_DURING_GAP = WAIT` 必須保持不變；hidden 不建立新的 freeze，也不接受任何 edit。
- `expected_result`: `參考 hidden 摘要是 endpoint_energy_j=3.61、delivered_bits=0、service_pass=false；這是新條件下的 counterexample／失敗 evidence，不是要靠改 policy 消掉的瑕疵。`
- `comparison_sentence`: `在 primary trace ______；在 hidden trace ______；所以 A 的機制結論 ______，適用範圍是 ______。`
- `causal_interpretation`: `若 hidden 與 primary 方向不同，結論應縮小成「在 primary trace 下觀察到」，而不是宣稱 WAIT 普遍省電。請把 hidden 的 policy SHA 與 P042 candidate 相比，確認差異來自 case 條件而不是 policy 偷換。`
- `question`: `hidden 的 policy SHA 是否仍與 frozen A 相同？如果相同，哪個新 contact／traffic 條件改變了結果？`
- `recovery`: `若 P042 第三條命令失敗或 path 缺失，保留錯誤；POSIX 執行 cp artifacts/checkpoints/lab-a-frozen.py student_policy.py，Windows 執行 copy /Y artifacts\checkpoints\lab-a-frozen.py student_policy.py，回到 P042 的 hidden 命令。不要使用 hidden-A hardcoded fallback path。`
- `result_path_rule`: `只使用 P042 第三條 stdout 印出的 result_path 與同一目錄 replay；網站或 viewer 不接受投影片預填路徑。`

## P048 — Lab A debrief：用一句因果句交代答案

- `kind`: result
- `layout`: sentence_builder（條件、機制、證據三段接成一句）
- `split_flag`: no
- `title`: Lab A 結論不是一個 J，而是一條因果句
- `visible_explanation`: 把 baseline、candidate 與 hidden 的 result path 並排，先指出 A policy hash 與 scenario identity，再比較 state、packet、service 與 endpoint J。好的結論必須說明適用條件與反例；若 hidden 不支持 primary 的方向，就把它寫成邊界而不是刪掉。
- `comparison_sentence`: `在 ______ trace，將 REST_DURING_GAP 從 SLEEP 改為 WAIT，透過 ______ state 機制改變 ______ packet／service evidence，endpoint J ______；在 hidden trace ______，所以結論 ______。`
- `expected_result`: `參考結果支持「WAIT 減少 wake 但不保證 service 或較低 J」這個條件式說法；實際 verdict 由三個 stdout result_path 的 summary 與 replay 決定。`
- `question`: `請在句子中填入一個 state、一個 packet／service evidence 與適用條件，不要只報 J。`
- `causal_interpretation`: `Lab A 的成功條件是可反駁、可回放、邊界清楚，不是所有 case 都得到同一方向。`
- `recovery`: `若三個 path 的 identity 無法配對，保留現有檔案，回到 P046 的 A freeze gate；不要重寫或合併 JSON。`

## P049 — Lab B 的挑戰：等穩定訊號會不會錯過服務？

- `kind`: challenge
- `layout`: challenge_wall（挑戰句＋窗口時間帶＋成功條件）
- `split_flag`: no
- `title`: Lab B：現在送，還是等到更穩定？
- `challenge`: `挑戰句：等待品質穩定可能降低失敗與重傳，但 contact window 會關閉；hold 太久會不會錯過可用服務？`
- `success_condition`: `成功條件：固定 A frozen predecessor，只改 B 的 stable hold；先指出 enter／hold／exit transition，再比較 packet delivery、deadline、service 與 endpoint J，最後用 Trace B 檢驗是否出現 too-slow counterexample。`
- `lab_sequence`: `問題（P049）` → `基線 decision（P050–P052）` → `baseline evidence（P054）` → `常數逐行解釋與 exact edit（P055）` → `改前預測（P053）` → `唯一 compact run／receipt ribbon（P056：Trace A baseline／candidate freeze／Trace B 三條命令）` → `before／after 對照與因果解釋（P057）` → `withheld／failure mode／recovery（P058–P062）`
- `baseline_decision`: `contact_open=false → SLEEP；send_mode_active=true 時，quality_band >= EXIT_QUALITY（1）才繼續 send-ready；尚未進入時，quality_band >= ENTER_QUALITY（2）且 stable_steps >= STABLE_STEPS（2）才切換到 send-ready。`
- `visible_explanation`: Lab B 研究的不是「品質越高越好」，而是 policy 何時進入 send-ready、何時退出、要連續穩定幾步。這個控制點只有在 transition 真的改變 packet／service／energy ledger 時才有教學意義。
- `causal_path`: `quality_band + stable_steps` → `REST／SEND_READY transition` → `WAIT／SEND` → `attempt／retry／deadline` → `service_pass + endpoint_energy_j`
- `question`: `若等候一個較穩定的 quality band，最先可能失去的是哪個 deadline 或 contact opportunity？`

## P050 — ENTER_QUALITY：何時進入 send-ready

- `kind`: concept
- `layout`: threshold_ladder（quality 0–3 階梯）
- `split_flag`: no
- `title`: ENTER_QUALITY：何時進入 send-ready
- `visible_explanation`: `ENTER_QUALITY = 2` 表示 quality band 至少到 usable，並且還要通過 stable hold，policy 才能從 REST 進入 send-ready。它不是直接把 energy 設成某個值，而是改變何時允許後續的 process／TX／RX。
- `policy_block`:
  ```python
  ENTER_QUALITY = 2
  EXIT_QUALITY = 1
  STABLE_STEPS = 2
  ```
- `line_explanation`: `ENTER_QUALITY = 2` 是進入門檻；`EXIT_QUALITY = 1` 是已進入模式的退出門檻；`STABLE_STEPS = 2` 是連續穩定的 hold 長度。下一個 edit 只改第三行，其他兩條線與 A predecessor 不動。`
- `purpose`: 先理解進入條件，下一頁才解釋為何退出條件可以不同。
- `mechanism`: `quality_band >= ENTER_QUALITY and stable_steps >= STABLE_STEPS` 才令 send mode ready；transition 時機會影響 queue age、attempt 與 deadline。
- `takeaway`: `threshold 是 decision gate，不是 energy knob。`

## P051 — EXIT_QUALITY：為什麼要分開兩條線

- `kind`: concept
- `layout`: hysteresis_band（兩條線與中間穩定帶）
- `split_flag`: no
- `title`: EXIT_QUALITY：為什麼不能只用一條線
- `visible_explanation`: `EXIT_QUALITY = 1` 讓已進入 send-ready 的模式在 quality 降到 weak 時才退出，而不是在 usable／weak 邊界來回跳動。分開 enter 與 exit threshold 形成 hysteresis，目的是減少 ping-pong；它仍要用 transition、retry、service 與 energy evidence 驗證。
- `threshold_visual`: `進入：quality ≥ 2`；`保持：quality = 1 或以上`；`退出：quality < 1`
- `purpose`: 把「穩定」說成可觀察的 mode transition，而不是一條漂亮平滑線。
- `mechanism`: runner 依 `send_mode_active` 使用 exit threshold；未進入時使用 enter threshold 與 stable count。
- `takeaway`: `hysteresis 是條件設計，不是服務或節能保證。`

## P052 — STABLE_STEPS：拒絕短暫尖峰

- `kind`: concept
- `layout`: step_hold（兩段 quality trace：短尖峰與連續 hold）
- `split_flag`: no
- `title`: STABLE_STEPS：拒絕短暫尖峰
- `visible_explanation`: `STABLE_STEPS` 把「這一刻變好」和「連續幾步都穩定」分開；預設值 2 會要求兩個連續 clock step 才能進入 send-ready。把它改成 1 會更快允許傳送，但也可能讓短暫 quality spike 直接改變 attempt、retry 與 service。
- `policy_block`: `ENTER_QUALITY = 2`、`EXIT_QUALITY = 1`、`STABLE_STEPS = 2（candidate 下一頁改成 1）`
- `pre_edit_prediction`: `改前先寫：STABLE_STEPS = 1 可能提早一個固定 step 進入 send-ready；我預期 ______ transition 先變，接著觀察 ______ packet／service 與 ______ endpoint J。`
- `purpose`: 讓全班預測 hold 時間如何透過 transition 影響 packet 與 energy。
- `mechanism`: engine 每 10 s 更新 `stable_steps`；只有達到 policy constant 才把 `send_mode_active` 切成 ready。
- `takeaway`: `短 hold 可能較快，長 hold 可能較保守；成功與否由 service window 決定。`

## P053 — Lab B Trace A：先預測 enter／hold／exit

- `kind`: activity
- `layout`: trace_annotation（品質 trace 上三個可填標記）
- `split_flag`: no
- `title`: Lab B Trace A：先預測 transition，再執行
- `exact_policy_state`: `A frozen policy 保持 REST_DURING_GAP = WAIT；B candidate 的目標值是 STABLE_STEPS = 1，但本頁先不執行 edit。`
- `visible_explanation`: 先在 Trace A 上標出 quality 第一次達到 2、連續穩定的步數、降到 1 的位置，再寫下你預期的 enter／hold／exit。這個預測會在 candidate 的 `MODE_CHANGE`、packet ledger、service gate 與 endpoint J 中被支持或反駁。
- `prediction_prompts`: `enter：第 ______ 個 step`；`hold：需要 ______ 個連續 stable step`；`exit：quality 降到 ______ 時`；`service／J：我預期 ______，因為 ______。`
- `purpose`: 在 action 前把機制說清楚，避免跑完結果才倒推理由。
- `mechanism`: policy 只能讀當下與過去 observation；它不能偷看整條 future trace 或 result summary。
- `question`: `若把 hold 從 2 改成 1，哪一個 MODE_CHANGE 會最早發生？`
- `recovery`: `本頁不改檔案；若 A policy 不是 frozen，POSIX 執行 cp artifacts/checkpoints/lab-a-frozen.py student_policy.py；Windows 執行 copy /Y artifacts\checkpoints\lab-a-frozen.py student_policy.py，再開始 B。`

## P054 — B-01：Trace A baseline evidence 是 control

- `kind`: result
- `layout`: result_card（左 A predecessor decision、右 Trace A baseline evidence）
- `split_flag`: no
- `title`: B-01：先理解 baseline decision，再讀 Trace A evidence
- `purpose`: 讓 B baseline 成為 candidate before／after 的 control；所有三個 B case 的執行命令集中在 P056。
- `exact_policy_state`: `A block 必須保持 REST_DURING_GAP = WAIT；B baseline block 是 STABLE_STEPS = 2。candidate 的唯一 edit 會在 P055 改成 STABLE_STEPS = 1。`
- `baseline_decision`: `contact_open=false → SLEEP；send_mode_active=true 時 quality_band >= EXIT_QUALITY（1）才保持 send-ready；尚未進入時，quality_band >= ENTER_QUALITY（2）且 stable_steps >= STABLE_STEPS（2）才切換。`
- `baseline_evidence`: `使用 P056 第一條 stdout result_path 讀 Trace A baseline 的 transition、packet、service 與 endpoint J；參考摘要是 endpoint_energy_j=8.86、delivered_bits=4800、service_pass=false，實際 summary 以該 path 為準。`
- `causal_interpretation`: `這個 control 只說明 hold=2 的原始 behavior；它還不能回答 STABLE_STEPS=1 是否改善，因為 candidate evidence 尚未對照。`
- `comparison_sentence`: `baseline 需要 ______ 個 stable step 才進入 send-ready；candidate 改成 1 後，我要檢查 ______ transition 是否提早。`
- `recovery`: `若 P056 第一條命令的 result／replay pair 缺失，保留錯誤，重新使用 P056 baseline command 取得新 stdout path；不要使用 A candidate result 或自行猜路徑。`
- `result_path_rule`: `只使用 P056 第一條命令印出的 result_path 與同目錄 endpoint-replay.json。`

## P055 — B-02：把 STABLE_STEPS 精確改成 1

- `kind`: operation
- `layout`: edit_zoom（B block 放大、Trace A 右側）
- `split_flag`: no
- `title`: B-02：把穩定等待從 2 改成 1
- `purpose`: 只改 B 的 hold 參數，測試較快進入 send-ready 是否會錯過或保住服務。
- `exact_policy_state`: `在開始編輯前，B block 是 STABLE_STEPS = 2；本頁完成後必須是 STABLE_STEPS = 1，A block 仍是 REST_DURING_GAP = WAIT。`
- `exact_edit`: 在 `student_policy.py` 的 `lab-b-enter-exit-hold` block 只把下面一行改成：
  ```python
  STABLE_STEPS = 1
  ```
  `ENTER_QUALITY = 2`、`EXIT_QUALITY = 1`、A block 的 `REST_DURING_GAP = WAIT` 與 C block 都保持原樣。
- `line_explanation`: `ENTER_QUALITY` 與 `EXIT_QUALITY` 決定 quality 何時進出 send-ready；`STABLE_STEPS` 決定進入前要連續觀察幾個 step。這次只把第三行改成 1，才能把 transition 差異歸因到 hold。`
- `pre_edit_prediction`: `改前先寫：較短 hold 可能早送、少等候，但也可能遇到較弱 quality 或留下不同 retry／deadline 結果；先寫方向，不先寫答案。`
- `posix_commands`:
  ```sh
  cp student_policy.py student_policy.before-B-edit.py
  .venv/bin/python -m py_compile student_policy.py
  ```
- `windows_cmd_commands`:
  ```bat
  copy /Y student_policy.py student_policy.before-B-edit.py
  .venv\Scripts\python.exe -m py_compile student_policy.py
  ```
- `expected_stdout`: `py_compile 沒有文字錯誤且回傳碼為 0；B marked block 清楚顯示 STABLE_STEPS = 1。`
- `causal_interpretation`: `hold 從 2 變 1 會讓 send-ready 可能提早一個 clock step；它先改變 MODE_CHANGE 時機，再可能改變 TX／RX、retry、deadline 與 endpoint J。`
- `recovery`: `若 B guard 失敗，POSIX 執行 cp student_policy.before-B-edit.py student_policy.py；Windows 執行 copy /Y student_policy.before-B-edit.py student_policy.py，重新 compile。不要改 A frozen block 或 runner。`
- `result_path_rule`: `本頁只有 compile receipt；candidate result_path 要等下一頁 exact freeze command 的 stdout。`

## P056 — B-03：Lab B compact run／receipt ribbon

- `kind`: operation
- `layout`: command_ribbon_compact（單一橫向三階段 ribbon；不再拆成三張 run 頁）
- `split_flag`: `no（Lab B 的唯一 run／receipt 頁；若版面過密，刪減輔助說明或改成三段窄 ribbon，但不可把 run 拆成多頁，也不可把字縮到 18 pt 以下。）`
- `title`: B-03：一條 ribbon 完成 Trace A baseline → candidate → Trace B
- `purpose`: 這是 Lab B 唯一的快速執行／receipt 頁；三個 case 共用同一個 stdout result_path 教法。
- `exact_policy_state`: `第一條命令前是 A frozen + STABLE_STEPS = 2；第一條完成後只改 B marked block 成 STABLE_STEPS = 1；candidate freeze 成功後保持 B frozen 執行 Trace B。`
- `posix_commands`:
  ```sh
  # 1. Trace A baseline：A frozen active，B 仍為 2
  bash course.sh run --lab B --case trace-a-baseline
  # 2. Trace A candidate：先完成 P055 的 STABLE_STEPS = 1，再 freeze
  bash course.sh run --lab B --case trace-a-candidate --freeze
  # 3. Trace B：保持 B frozen，不再 edit
  bash course.sh run --lab B --case trace-b
  ```
- `windows_cmd_commands`:
  ```bat
  rem 1. Trace A baseline：A frozen active，B 仍為 2
  course.cmd run --lab B --case trace-a-baseline
  rem 2. Trace A candidate：先完成 P055 的 STABLE_STEPS = 1，再 freeze
  course.cmd run --lab B --case trace-a-candidate --freeze
  rem 3. Trace B：保持 B frozen，不再 edit
  course.cmd run --lab B --case trace-b
  ```
- `ribbon_read_order`: `Trace A baseline stdout result_path → P055 exact edit → candidate stdout result_path + artifacts/checkpoints/lab-b-frozen.{json,py} → Trace B stdout result_path；每個 result_path 都原樣保存，配對 replay 取同一個 generated run 目錄。`
- `expected_stdout`: `三次成功 stdout 都應有 status=OK、artifact_source=student-run 與各自新的 result_path；candidate 另應留下 lab-b-frozen checkpoint，Trace B 不建立新的 freeze。不要自行猜 run ID 或 fallback path。`
- `expected_result`: `參考摘要：Trace A baseline 8.86 J／4800 bit／service_pass=false；Trace A candidate 10.66 J／9600 bit／service_pass=false；Trace B 5.43 J／4800 bit／service_pass=false。實際 summary 以三次 stdout result_path 為準。`
- `causal_interpretation`: `較短 hold 可能提早 send-ready 並增加 delivered bits，但 service gate 仍可能失敗；Trace B 若方向不同，這是泛化邊界，不是再次調參的邀請。`
- `recovery`: `任一步失敗都保留 stdout／stderr；POSIX 用 cp student_policy.before-B-edit.py student_policy.py 還原 B edit，Windows 用 copy /Y student_policy.before-B-edit.py student_policy.py，重新完成該段命令。candidate freeze 缺失時不得直接跑 Trace B。`
- `result_path_rule`: `三條命令的 result_path 分別貼到 Trace A baseline／candidate／Trace B 的 viewer；網站與 JSON viewer 都只接受該次 stdout path。`

## P057 — B-04：沿 transition 讀 packet 與 service

- `kind`: result
- `layout`: transition_to_service（上半 transition、下半 packet／service）
- `split_flag`: no
- `title`: B-04：品質不是 service，transition 才是機制
- `visible_explanation`: 開啟 B-03 stdout 指出的 result path，先定位 `MODE_CHANGE` 的 enter／exit，再看後續 `PACKET_ATTEMPT`、retry、delivered、expired 與 service verdict。quality band 是 observation context；只有它透過 transition 改變 action 與 packet outcome，才是這頁要教的因果鏈。
- `expected_result`: `參考 Trace A candidate：attempted=4、retransmissions=1、delivered_bits=9600、expired_packets=1、endpoint_energy_j=10.66、service_pass=false、deadline_pass=false。`
- `comparison_sentence`: `STABLE_STEPS = 1 使 ______ transition 提早／延後，接著 ______ packet outcome 改變；因此 service_pass ______，endpoint J ______。`
- `question`: `quality band 變高本身，是否等於 required packet 已在 deadline 前交付？請用 result 欄位回答。`
- `causal_interpretation`: `這頁把「較快看到好訊號」與「完成服務」分開；如果 service gate 仍紅，應保留 trade-off 與失敗原因。`
- `recovery`: `若找不到 MODE_CHANGE 或 result path 不是 B-03 stdout 的路徑，停止讀取，重新選正確 pair；不要改 result JSON。`

## P058 — B-05：B freeze evidence 與 Trace B 入口

- `kind`: recovery
- `layout`: lineage_gate（左 A predecessor、中央 B checkpoint、右 Trace B entry；不再放第三個 run command）
- `split_flag`: no
- `title`: B-05：freeze evidence 決定能否讀 Trace B
- `purpose`: 把 P056 candidate freeze 留下的 checkpoint 讀成 lineage evidence；執行命令已集中在 P056。
- `exact_policy_state`: `A block 保持 REST_DURING_GAP = WAIT；B block 保持 STABLE_STEPS = 1。`
- `checkpoint_evidence`: `P056 candidate 成功後應有 artifacts/checkpoints/lab-b-frozen.json 與 artifacts/checkpoints/lab-b-frozen.py；JSON 要對上 active_block_id=lab-b-enter-exit-hold、policy_sha256、predecessor_policy_sha256、seed_role 與 receipt_sha256。`
- `causal_interpretation`: `B freeze 把 hold=1 與 A predecessor 綁成可追溯的實驗階段；Trace B 只能檢驗這個階段，不能再調 threshold。`
- `recovery`: `若 checkpoint 缺失或 hash 不符，POSIX 執行 cp artifacts/checkpoints/lab-a-frozen.py student_policy.py；Windows 執行 copy /Y artifacts\checkpoints\lab-a-frozen.py student_policy.py，回到 P056 的 Trace A candidate --freeze；不得直接進 Trace B。`
- `result_path_rule`: `本頁不產生新 result_path；Trace B path 只使用 P056 第三條命令的 stdout。`

## P059 — B-06：讀 Trace B 結果，不再 retune

- `kind`: result
- `layout`: withheld_result（左 B frozen policy、右 Trace B evidence；無第二個 run command）
- `split_flag`: no
- `title`: B-06：Trace B 只檢驗，不再 retune
- `purpose`: 讀 P056 第三條命令產生的 Trace B result，判斷較短 stable hold 的泛化邊界。
- `exact_policy_state`: `STABLE_STEPS = 1` 與 `REST_DURING_GAP = WAIT` 都保持 frozen；本頁不建立新的 freeze，也不接受 edit。
- `expected_result`: `參考 Trace B 摘要是 endpoint_energy_j=5.43、delivered_bits=4800、expired_packets=2、service_pass=false；這是泛化邊界的 evidence，不是要刪除的錯誤。`
- `comparison_sentence`: `Trace A 在 ______ 條件下 ______；Trace B 在 ______ 條件下 ______；因此 STABLE_STEPS = 1 的結論應限制在 ______。`
- `causal_interpretation`: `Trace B 若錯過窗口或保留過多 expired packet，說明 stable hold 的效果依 opportunity 而變；不能把 Trace A 的改善宣稱成所有窗口都成立。counterexample 要保留，因為它定義了 claim ceiling。`
- `recovery`: `若 P056 第三條命令失敗或 path 缺失，保留錯誤；POSIX 執行 cp artifacts/checkpoints/lab-b-frozen.py student_policy.py，Windows 執行 copy /Y artifacts\checkpoints\lab-b-frozen.py student_policy.py，回到 P056 的 Trace B 命令。不要使用 trace-b-B hardcoded fallback path。`
- `result_path_rule`: `只使用 P056 第三條 stdout 印出的 result_path 與同一目錄 replay；網站或 viewer 不接受投影片預填路徑。`

## P060 — B-07：分辨 too-slow 與 ping-pong

- `kind`: result
- `layout`: two_failure_modes（兩個自然案例，不是五問卡片）
- `split_flag`: no
- `title`: B-07：too-slow 與 ping-pong 是兩種不同問題
- `visible_explanation`: hold 太長可能使 mode 太晚進入 send-ready，最後錯過 contact 或 deadline；enter／exit 太近則可能在品質邊界來回切換，增加 transition、retry 與 energy。請把 Trace A／Trace B 的 `MODE_CHANGE`、packet outcome 與 endpoint ledger 對齊，不能把一條平滑 quality 線直接當成省能量證據。
- `failure_modes`: `too-slow：hold 太久 → 服務窗口用完 → deadline／service loss`；`ping-pong：enter／exit 間隔太窄 → 多次 transition → retry／額外 J`
- `comparison_sentence`: `在 ______ trace，主要機制是 ______，證據是 ______；在另一個 trace，主要機制是 ______，證據是 ______。`
- `question`: `你看到的是 hold 太久、threshold 太近，還是單純 traffic／窗口不同？請用事件與 summary 區分。`
- `causal_interpretation`: `B 的價值在於找出控制參數與服務窗口的條件式關係，而不是保證任何 trace 都少耗能。`
- `recovery`: `若兩個 result 的 policy SHA 不同，先回到 P058，使用同一個 B frozen checkpoint；不要拿不同 policy 的結果做 failure-mode 比較。`

## P061 — Lab B debrief：hysteresis 是條件，不是保證

- `kind`: result
- `layout`: claim_boundary（Trace A／Trace B 兩欄＋適用範圍）
- `split_flag`: no
- `title`: Lab B 結論：hysteresis 是條件，不是保證
- `visible_explanation`: 把 B-03 與 B-06 stdout result path 的 policy SHA、scenario identity、transition 與 service verdict 一起讀，才能判斷 hold=1 的效果。最好的結論同時描述 Trace A 支持的機制與 Trace B 暴露的邊界，不把一次改善寫成所有 changing windows 的保證。
- `comparison_sentence`: `在 Trace A，STABLE_STEPS = 1 使 ______，所以 ______；在 Trace B，因為 ______，結果 ______；因此 hysteresis 的有效條件是 ______。`
- `expected_result`: `參考結果顯示 Trace A delivered_bits 增加但 service_pass 仍未通過，Trace B 則有不同的窗口／traffic 限制；因此只能提出條件式教學結論。`
- `question`: `哪一個 evidence 讓你的結論縮小適用範圍，而不是擴大？`
- `causal_interpretation`: `這個 debrief 以可反駁性收尾：保留支持、反例與尚未回答的部分，才能把 policy 設計帶到下一個場景。`
- `recovery`: `若缺任一 result／replay pair，保留已完成的 B freeze，回到 stdout path 重新選檔，不重新執行或改寫 policy。`

## P062 — Recovery checkpoint：用 copy 保持 A／B lineage

- `kind`: operation
- `layout`: recovery_map（狀態節點與雙向 copy 箭頭）
- `split_flag`: `SPLIT IF：policy restore 與 result／replay restore 不能同頁保留 24 pt。`
- `title`: 中斷時先復原 lineage，不補造結果
- `purpose`: 讓講師能從任何 gate 失敗回到最後一個 identity 正確的階段。
- `exact_policy_state`: `進入 B 後，A frozen policy 的 REST_DURING_GAP = WAIT 必須保留；B candidate／frozen 階段的 STABLE_STEPS = 1 必須保留。`
- `posix_commands`:
  ```sh
  # 回到 A frozen，準備重跑 B
  cp artifacts/checkpoints/lab-a-frozen.py student_policy.py
  # 回到 B frozen，準備重跑 Trace B
  cp artifacts/checkpoints/lab-b-frozen.py student_policy.py
  # 只在需要回到 release baseline 時使用
  cp student_policy.A-baseline.py student_policy.py
  ```
- `windows_cmd_commands`:
  ```bat
  rem 回到 A frozen，準備重跑 B
  copy /Y artifacts\checkpoints\lab-a-frozen.py student_policy.py
  rem 回到 B frozen，準備重跑 Trace B
  copy /Y artifacts\checkpoints\lab-b-frozen.py student_policy.py
  rem 只在需要回到 release baseline 時使用
  copy /Y student_policy.A-baseline.py student_policy.py
  ```
- `expected_stdout`: `copy 完成後先用 .venv/bin/python -m py_compile student_policy.py（Windows 為 .venv\Scripts\python.exe -m py_compile student_policy.py），再重跑對應的 exact case command；runner stdout 會重新給出新的 result_path。`
- `causal_interpretation`: `policy checkpoint 只能復原 policy lineage，不能復原遺失的 result；每一次重跑都會產生新的 stdout result_path，必須保存它與配對 replay。`
- `recovery`: `若 result 或 replay 遺失，不要手改 JSON；回到最後一個 identity 正確的 checkpoint，重新執行該 case，並使用新 stdout path。若主機無法 clean-run，依 README 的 same-scenario fallback 流程保留 artifact_source 標籤。`
- `result_path_rule`: `任何匯入或比較都使用重新執行後的 stdout result_path；不使用投影片、舊預覽或猜測的 hardcoded path。`

## P063 — 為什麼要把 result.json 上傳網站？

- `kind`: bridge
- `layout`: bridge（左 runner、中央 validator／replay、右 workbook）
- `split_flag`: no
- `title`: 上傳 result.json，是把證據交給網站驗證與回放
- `purpose`: 自然銜接到 Leo `/course`：網站不是另一個 policy runner，而是 result／replay 的驗證與教學展示邊界。
- `exact_policy_state`: `上傳前不再改 policy；A 階段保留 REST_DURING_GAP = WAIT，B 階段保留 STABLE_STEPS = 1。`
- `visible_explanation`: 把 `result.json` 上傳網站，是為了讓網站驗證 schema、scenario／policy identity、units 與 provenance，並把事件 materialize 成 endpoint replay。網站不執行 `student_policy.py`，也不把模擬資料變成 live 或 measured；它只保留 baseline、candidate、withheld 的可追溯比較，並把它們放進 workbook。
- `bridge_flow`: `runner stdout result_path` → `選取該次 result.json` → `驗證 identity／schema／units` → `讀配對 endpoint-replay.json` → `比較 baseline／candidate／withheld` → `Save／Open Energy Decision Workbook`
- `how_to_import`: `在 Leo /course 的匯入控制項選擇 stdout 指出的 result_path；若畫面要求 replay，選同一個 generated run 目錄中的 endpoint-replay.json。不要上傳 policy source，不要把另一個 case 的 fallback result 改名成這次 run。`
- `expected_output`: `成功時畫面應顯示同一 scenario、case、run identity 與 endpoint replay；若 schema／identity／units 不一致，匯入應 fail closed，原 workbook 不應被悄悄改寫。`
- `comparison_sentence`: `這個 result 不是讓網站重新計算 policy，而是讓網站 ______；因此我可以在同一 workbook 中保留 ______、比較 ______，並回到 ______ 檢查因果。`
- `question`: `如果上傳的是錯誤 scenario 的 result，網站為什麼應該拒絕，而不是幫忙猜它屬於哪一個 lab？`
- `recovery`: `匯入失敗時保留網站錯誤與原始 stdout path；回到 P062 以 checkpoint 復原 policy、重跑 exact case，再用新 stdout result_path 與配對 replay 重新匯入。不要手改 JSON、不要替換 scenario hash，也不要把 fallback 標籤移除。`
- `claim_boundary`: `SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED`

## 來源核對（給 builder／審查者，不直接當頁腳）

- `/home/u24/lora-energy-lab/README.zh-TW.md`：release ZIP、Python 3.11 setup、三個 marked blocks、十個 exact cases、stdout `result_path`、配對 replay、same-scenario fallback 與 claim ceiling。
- `/home/u24/lora-energy-lab/run_lab.py`：A/B case predecessor、`--freeze` 允許範圍、withheld gate、stdout payload、freeze checkpoint 與 result writer 流程。
- `/home/u24/lora-energy-lab/student_policy.py`：A 的 `REST_DURING_GAP` 預設為 `SLEEP`；B 的 `STABLE_STEPS` 預設為 `2`；本模組的 candidate exact edits 分別是 `WAIT` 與 `1`。
- `/home/u24/lora-energy-lab/lora_energy_lab/engine.py`：固定 10 s step、SLEEP／WAIT state、WAKE／PROCESS／TX／RX energy、packet attempt／retry／delivery／expiry、service gate 與 endpoint efficiency。
- `/home/u24/lora-energy-lab/tests/test_student_workflow.py`：A baseline → candidate freeze → hidden，再接 B Trace A baseline → candidate freeze → Trace B 的 predecessor／freeze 順序。
