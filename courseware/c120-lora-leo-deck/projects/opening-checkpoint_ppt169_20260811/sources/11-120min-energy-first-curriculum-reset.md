# 120 分鐘 Energy-first 課程應如何以 LEO 作索引，而不是把學生教成衛星專家？

Type: course-specification
Status: owner-accepted specification — empirical classroom validation pending
Claimed by: /root
Blocked by: none for read-only build/adapt/replace comparison; implementation remains unauthorized
Date: 2026-08-09
Downstream entry: [`../CURRENT-C120-HANDOFF.md`](../CURRENT-C120-HANDOFF.md)

## Question

若直接規劃一堂 120 分鐘課程，而不把既有 Stage、E1／E2／E3、IoT
配額當成框架，哪些內容與學生操作最能讓 20 位非通訊背景 STEM 學員
帶走可移轉的節能決策能力；LEO、TLE、模擬器及免費外部工具各自只應
承擔什麼角色？

## Accepted decision — `C-120-ENERGY-DECISION-1R`

這不是把 `C-90-ENERGY-1` 拉長，也不是在中間插入外部軌道工具。
課程以同一個 NTPU LEO 任務貫穿，但學習物改成一套可移轉的
**energy decision toolkit**：

1. 先定義合格服務、時間窗與 system boundary；
2. 分辨瞬時功率 W、累積能量 J、完成時間、服務量，以及固定 service gate
   下既有 canonical `delivered bits / consumed J`（bit/J）。`service_pass`、
   freshness、deadline、consumed J、budget remaining 與 delivered bits 是
   分開的服務／限制／證據欄位，不是另一個 ratio；不得出現 `service/J`、
   `qualified updates/J`、`value/J` 或其他 headline metric。所有比較固定
   workload、time window、system boundary 與 power model；
3. 在動態條件下用 policy，而不是找一個永遠最好的參數；
4. 在有限 canonical consumed-J budget、資料 freshness／deadline 下作排程；
5. 分開 prediction、control 與節能證據，拒絕 leakage 和不公平 baseline；
6. 把同一套推理轉成智慧節能／IoT 競賽假說與 falsifier。

這裡的 `reset` 是**學習目標、agency 與證據結構的概念重構**，不是聲稱
所有科學機制都是新發明。Lab A/B 分別深化舊 power-time 與 handover
概念，Lab C 把舊 preset IoT selector 改成真正的受限排程，evidence clinic
則是新增的 prediction-versus-control 學習物。

LEO 的必要角色只有三個：提供會移動的服務窗口、清楚的 switch/wait
決策，以及讓資料 freshness、deadline 和 energy budget 同時有意義。
學生不學軌道力學、RF 推導或模擬器驗證。

本提案保留 owner 已要求的**每位學生親自完成一次 TLE-to-NTPU
glass-box journey**，但壓在 8 分鐘，且不把它計為節能實驗或節能學習
證據。研究中「把 TLE 全移到後台」的建議在此不採用，因為它違反已
確認的 student-operation constraint。

學生產生的 `scenario_id` 必須被 Lab A/B/C 與 evidence clinic 全部消費；
後續 contact／quality traces 只能是同一 scenario 的明示、versioned course
sub-traces，不能暗中換成另一組預載場景。若學生走 identical fallback，
workbook 與全畫面必須標記 `source_mode=fallback`，保留相同 scenario
identity 與後續行為，不得靜默切回預設值。若這條 seam 未成立，TLE
段落立即降為裝飾性 onboarding，不能保留 8 分鐘。

Owner 已接受本決策。舊 `C-120-DECK-RESERVE-1` 的外部 Gpredict／GMAT E3
已移至 [`archive/issues/07-complete-cycle-prototype.md`](../archive/issues/07-complete-cycle-prototype.md)
作 decision history／future extension，不再是 120 分鐘 default route。

研究檔中的 A/B/C 是 research alternatives；**本 ticket 是 controller 唯一
current exact-120 course/storyboard authority**。研究中的其他分鐘表不能形成
第二套並行 authority。

## Five-model pedagogical audit — 2026-08-09

Owner accepted `C-120-ENERGY-DECISION-1R` on 2026-08-09 as the authoritative
course and storyboard requirement for the next read-only build／adapt／replace
comparison. Acceptance does not convert any UNKNOWN into empirical PASS and does
not authorize simulator, UI, slide, server, install, commit or push work.

五條指定 reviewer lane 已在中斷後以原 conversation 恢復並完整落檔：
Gemini 3.6 Flash (High)、Gemini 3.1 Pro (High)、GPT-5.6 Sol/ultra、
GPT-5.6 Terra/ultra、GPT-5.6 Luna/max/fast。裁決分布是
`5/5 REVISE_BEFORE_ACCEPTANCE`、`0 PASS`、`0 REJECT`；完整 provenance、
原始輸出、共識、分歧與 claim boundary 見
[`controller-synthesis.md`](../reviews/c120-five-model-2026-08-09/controller-synthesis.md)。

五者一致保留 energy-first／LEO-as-index 與 A/B/C 不同機制，但否決現稿的
自由書寫量、尾段八欄集中填寫及把 `80` 分鐘紙面配置當普遍通過門檻。
本 `1R` 修訂採用下列 controller adjudication：

1. 保留 exact `10+8+23+23+5+23+14+14=120`，不以安裝、等待或講稿補時；
2. 全課最多八個 constructed responses，其餘選擇與數值自動留存；
3. learner choice 必須成為下一次 replay 的 authoritative input；
4. TLE 保留每人操作，但學生必做語義只到 source／window／assumption；
5. idea card 的八個 semantic fields 在全課逐步累積，不在最後一次出現八個
   空白框；
6. `80` 只稱 learner-facing capacity，timing 與理解品質留給逐人 novice gate。

這是文字 remediation，不是 empirical PASS、implementation 或 slide 授權。

## Evidence and claim boundary

### FACT

- BIPM 定義 watt 為 joule per second；W 是能量變化速率，J 是一段時間
  的累積量，兩者不能互換。[BIPM Resolution 2](https://www.bipm.org/en/committees/ci/cipm/41-1946/resolution-2)
- energy-proportional computing 與 race／pace-to-idle 研究都說明「快做完
  再休眠」或「降功率慢慢做」沒有無條件的普遍贏家；固定／idle 成本、
  sleep transition 與 performance constraint 會改變答案。
  [Barroso & Hölzle](https://research.google/pubs/the-case-for-energy-proportional-computing/)；
  [Kim, Imes & Hoffmann](https://people.cs.uchicago.edu/~hankhoffmann/kim-cpsna2015.pdf)
- status freshness 與 throughput／delay 並非同一目標；更新頻率會形成
  freshness trade-off。[Kaul, Yates & Gruteser](https://doi.org/10.1109/INFCOM.2012.6195689)
- hysteresis 是一般動態控制機制，不只屬於衛星；band 太窄與太寬會在
  switching 與反應速度間取捨。
  [Lei et al.](https://doi.org/10.1049/iet-rpg.2019.1027)
- Orange 官方支援 File、Predictions 與 separate test data 的 Test and
  Score，但 prediction score 本身不是 energy result。
  [Orange Test and Score](https://orangedatamining.com/widget-catalog/evaluate/testandscore/)；
  [Orange Predictions](https://orangedatamining.com/widget-catalog/evaluate/predictions/)
- 競賽 brief 要求的主線是資料分析／預測後形成智慧節能控制應用，不是
  衛星專業考核。來源：`/home/u24/papers/platform/intro.md`。

### INFERENCE

- 下列 exact-120、三個 full lab、一個 evidence clinic 與 80 分鐘
  learner-facing capacity 是課程設計假說，不是文獻證明的最佳數字。
- 三個 full lab 分別承載不同 agency：controlled comparison、dynamic
  policy、budgeted scheduling；短 evidence clinic 承載 feature／claim
  adjudication。它們不是把同一個 slider 任務換皮重做。
- LEO 數值只在明示的 simulated teaching boundary 內支持課堂判斷；不能
  外推為真實衛星、whole-satellite、wall-plug 或已校準效能。

### UNKNOWN

- 目標新手是否真的需要 120 分鐘、能否在 80 分鐘 learner-facing window
  完成核心 evidence 且不過載，尚未 novice-timed。
- energy-budget、freshness、policy 與 dataset fixture 是否能由同一
  authoritative course state 產生，尚未實作或 browser 驗證。
- Lab A candidate、Lab B rule、Lab C schedule 與 evidence-clinic feature／
  action 是否真的改變 downstream authoritative state，而非只被記錄或換
  動畫，尚未實作或 browser 驗證。
- Orange 是否比 browser-native evidence bench 增加不可替代的學習，
  尚未由 3–5 位 novice A/B walkthrough 證明。

## 120-minute learner contract extension

完成課程後，每位學生應能：

1. 用 W、J、bit/s、bit/J、active time 與一個明示 service constraint
   判斷節能主張，並說明為何 low power、low energy、high bit/J 和 successful
   service 不是同義詞。
2. 比較 `burst / pace / duty`，說明 fixed／idle／wakeup cost、deadline
   與 link condition 為何使 race-to-idle 沒有 universal winner。
3. 用 plain-language threshold／hysteresis policy 控制一個時間變動系統，
   並在 withheld trace 上承受不能 retune 的測試。
4. 在有限 canonical consumed-energy budget 與 contact window 下，把
   urgent、periodic、bulk data 排入 send／batch／wait／sleep 決策；同時檢查 freshness、
   deadline、consumed J 與服務，而不是只追最高 bit/J。
5. 區分 decision-time feature 與 post-action outcome，拒絕 leakage；把
   prediction score 與 frozen-policy canonical replay 的 `service_pass`／
   freshness／deadline、consumed J 與 canonical bit/J 分開陳述。
6. 產生一張可移轉到 smart farm、HVAC、edge inference、物流或 LEO 的
   **全課累積式** competition idea card，包含 baseline、state/data、control、
   power-time pathway、boundary/unit、service constraint、held-out case
   與 falsifier；這八個 semantic fields 不是最後 14 分鐘才出現的八個自由
   文字框。

每位學生最後留下同一份 `Energy Decision Workbook`；單純點完流程、
複製 KPI、匯出檔案或同意講師答案都不算達成。

## Exact 120-minute cadence

| Clock | Min | Learning object | Interaction mode | Learner-facing capacity | Instructor | Transition/recovery | Required artifact |
|---|---:|---|---|---:|---:|---:|---|
| 00–10 | 10 | **Energy claim detective**：服務、boundary、W/J/bit-J | claim-card sort + prediction lock | 6 | 3 | 1 | 初始判決與 `mission/energy contract` |
| 10–18 | 8 | **LEO data anchor**：TLE 如何成為 NTPU 時間窗 | staged glass-box operation | 5 | 2 | 1 | source/model/assumption 分類與 scenario |
| 18–41 | 23 | **Lab A — Same job, different pace** | worked example + candidate deployment + hidden condition | 16 | 5 | 2 | auto ledger、累積 J／bit/J、scaffolded verdict |
| 41–64 | 23 | **Lab B — Act now or wait** | worked trace + executable frozen rule + withheld trace | 16 | 5 | 2 | Trace A/B、rule、counterexample |
| 64–69 | 5 | **Recovery reset** | checkpoint、closed-book retrieval、短休息 | 1 | 0 | 4 | 中途 checkpoint；不拿等待填時 |
| 69–92 | 23 | **Lab C — Spend the joules** | scaffolded mission board + one revision + withheld event | 16 | 5 | 2 | baseline／schedule／revision、service fields／J／budget／bit-J evidence |
| 92–106 | 14 | **Evidence clinic — Prediction is not saving** | 4–6 feature cards + legal action + held-out replay | 9 | 4 | 1 | honest/leaky 判決與 frozen control result |
| 106–120 | 14 | **Competition transfer and exit** | cumulative remap + bounded challenge + retrieval | 11 | 2 | 1 | completed cumulative idea card、falsifier、one exit case |
| **Total** | **120** | **1 data anchor + 3 full energy labs + 1 evidence clinic** | **至少六種互動** | **80 scheduled capacity** | **26** | **14** | **one reopenable workbook** |

表中的 `80` 是**排入牆鐘的 learner-facing capacity**，不是每位學生都要
消耗滿 80 分鐘的 active-work target，也不是低於 70 分鐘就失敗。五模型
walkthrough 對現稿所需時間估計互相衝突，故不得平均後假裝成證據。修訂後
的初始 formative hypothesis 是：核心路徑 median active work `65–72` 分鐘、
p90 `<=78` 分鐘，且三個 lab debrief 與 unaided non-LEO transfer 均完成；
這些數字仍須 3–5 位代表性新手逐人計時，不能先稱 PASS。高品質快手低於
65 分鐘不因速度快而 FAIL，改走 8–12 分鐘 consequential counterexample
branch；慢手在同一 learner-facing window 使用逐層 scaffold，不加講稿 filler。

逐人記錄 active seconds、first answer、invalid action、hint／fallback level、
instructor rescue、artifact completion 與 causal-explanation rubric。安裝、
下載、loading、等待、講師說話和故障處理均不得計入；平均值不得掩蓋單一
learner 卡死或由講師代答。

研究支持完整 POE／self-explanation／debrief／replay 結構，但**沒有研究
證明三個實驗或上述分鐘數是最佳值**。選三個 full labs 是為了保住三種
不同節能機制，每個仍有 23 分鐘完成完整循環；若 novice walkthrough
顯示某段過快，先檢查 action 是否 consequential、hidden test 是否公平、
debrief 是否形成因果鏈；只加 slider、重播、文字框或投影片不算深化。

每段另設 evidence floor：A/B/C 都必須留下 pre-action prediction、真正改變
state 的 learner input、同 boundary 結果、learner causal debrief 與一個
failure condition；clinic 必須留下 availability 判斷與 frozen-action replay；
transfer 必須完成新 domain hypothesis 與 falsifier。不得用別段講解、完成
分鐘數或欄位不空白掩蓋缺失。

### Whole-course response and scaffold budget

- 核心路徑最多 **8 個 constructed responses**：opening 一句、A 一句、B 一句、
  recovery 一句、C 一句、clinic 一句、competition hypothesis 與 falsifier
  各一句。TLE 不要求自由文字；結果數值、run 資訊、第一次選擇與 KPI 由
  workbook 自動保存，不讓學生重抄。
- 每個欄位標為 `AUTO / SELECT / STEM / SHORT-CLAUSE`；每段最多一個
  `SHORT-CLAUSE`，只有最後 hypothesis／falsifier 可無完整 sentence stem。
- A 使用完整 worked example 與完整因果 stem；B/C/clinic 逐步移除提示；
  final transfer 使用另一個 domain 的格式範例，但不提供本題 winner。
- incomplete workbook 可以匯出但標記 `INCOMPLETE`；不能以阻擋匯出製造
  最後幾分鐘的操作摩擦。hint、autofill 與 fallback 必須留 provenance，不能
  和 unaided reasoning 算同一層 evidence。

## Segment contracts

### 00–10 — Energy claim detective

- **Question:** 「A 的平均功率較低；B 較快完成；C 的 bit/J 較高但漏掉
  deadline。誰真的比較節能？」
- **Explanation:** 初投票後用一個兩方案、兩時間格 worked trace 教
  `J = Σ P(t)Δt`、useful service、time window 和 boundary；範例不用本題
  三張卡，不先給 winner。
- **Prediction:** 個別把三張 claim card 分成 `accept / qualify / reject` 並選
  confidence；只挑一張最有爭議的卡完成一句 stem，不逐卡寫理由。
- **Operation:** 從有限且預先核准的 mission contract 選擇固定 payload、
  deadline 與 idle/wakeup boundary；選擇必須改變 comparable gate 或後續
  evidence，系統把不公平比較標為 `INCOMPARABLE`。任意降低服務要求以
  取得漂亮 saving 的 boundary gaming 不合法。
- **Observation:** 翻開累積 J、完成時間與 service badge，再允許改判一次。
- **Explanation artifact:** `我 accept／qualify／reject，因為固定＿＿後，
  ＿＿雖然＿＿，但＿＿；若＿＿則不能比較`；contract 欄位使用 selection。
- **Misconceptions:** W=J；高 bit/J 必然低 J；少做服務也算節能；不同窗口可
  直接報百分比改善。
- **Self-study/recovery:** unit strip、boundary hint、reset cards；fast branch
  改一次 boundary，觀察同一數據的 claim 是否改變。

### 10–18 — LEO data anchor

- **Question:** 「NTPU 畫面中的移動與 contact window，是原始資料還是模型
  產物？它為何會限制後面的能源決策？」
- **Explanation:** required learner model 只有 `pinned source → model-derived
  NTPU service window → course-added traffic/power assumption`。介面仍可
  inspect epoch、TEME、frame 與 look-angle transformation，但不要求記憶、
  推導或書寫；TLE 沒有 power、traffic、handover 或 energy。
- **Prediction:** 用 cards 把 source、service window、payload/power assumption
  排成三段，並選一項「TLE 本身不包含的資料」；不新增自由文字。
- **Operation:** 每位學生匯入同一 offline pinned TLE，依序檢視 friendly
  source、target UTC、model-derived state 與 NTPU visibility，產生同一
  versioned NTPU scenario；中間不反覆下載／上傳。technical detail 是
  progressive disclosure，不是必答站點。
- **Observation:** NTPU scene 顯示相同 scenario 的 service window，下一個
  lab 明示使用同一 `scenario_id`；學生選出哪個 send/wait interval 因而受限。
- **Explanation artifact:** workbook 自動保存三段 lineage 與 scenario；學生
  只作 selection，不把 satellite provenance 冒充節能推理證據。
- **Misconceptions:** TLE 是即時真值；TLE 含電力／波束／流量；專業 producer
  會把模型輸出自動變成量測真值。
- **Self-study/recovery:** resume checkpoint 與 identical offline fallback；
  不教手算 SGP4、不寫程式、不除錯。

### 18–41 — Lab A: Same job, different pace

- **Question:** 「固定同一 payload 與 deadline，降低瞬時功率是否一定降低
  總 J？最快完成是否一定最省？」
- **Protected timing:** `5 min worked example + entry check / 11 min action +
  observation / 5 min learner debrief / 2 min transition`；debrief 不得被操作
  超時吞掉。
- **Explanation:** 用另一個兩時間格 worked example 教 active/fixed/idle
  cost、完成後 sleep、服務失敗；entry check 先辨認 W 與累積 J，不把
  race-to-idle 教成定律。
- **Prediction:** 用方向選項排 `pace / balanced / burst-to-sleep` 的 active
  time、J、delivered service 和 bit/J；從 mechanism word bank 選一個可能
  翻盤的 operating-cost condition，不先寫長理由。
- **Operation:** 全班先跑一個完整 reference replay；其餘 policy 以 compact
  controlled rows 呈現。學生選一張 candidate 作 deployment choice，該
  choice 必須真正進入一個未揭露的 fixed／idle／wakeup condition replay；
  run order、不可跳動畫或途中多按一次不算 agency。
- **Observation:** 同一時間軸並列 system W、累積 J、rate、delivered bits、
  deadline/service 與 sleep interval。
- **Explanation artifact:** 結果表由系統 auto-log；學生只完成一句
  `我選＿＿改變＿＿，使 power-time pathway＿＿；在 service_pass=＿＿時，
  consumed J＿＿、bit/J＿＿；若＿＿，判決不成立`。
- **Misconceptions:** 最低 W 一定省 J；最高 rate 一定省；bit/J 高可抵銷
  deadline failure；fixed cost 不重要。
- **Self-study/recovery:** negative-control replay、三層 hint、同一 scenario
  reset；fast branch 換一個 fixed-idle-cost fixture，檢查 ranking 是否反轉。

### 41–64 — Lab B: Act now or wait

- **Question:** 「看到較好的 candidate 就立刻 switch，還是等訊號穩定？少
  switch 是否一定較省？」
- **Protected timing:** `5 min worked thermostat trace + next-state entry check /
  11 min action + observation / 5 min learner debrief / 2 min transition`。
- **Explanation:** 用五事件日常 thermostat trace 引入單閾值、保持上一狀態
  與 hysteresis band；只用 friendly quality band，不要求 dB 或 3GPP。
  這是可轉移的 course policy，不宣稱是標準或商用衛星 handover 演算法。
- **Prediction:** 對 Trace A 選 `switch now / wait / remain`，預測 service、
  active time、J 與 switching；答案不可預先顯示。
- **Operation:** 在 event timeline 作一次決策、rewind 一個 alternate decision，
  再用 executable non-code blocks 凍結規則：`IF quality >= threshold for N
  steps THEN switch ELSE remain`，並可設定回切的 lower threshold。Trace B
  只改未來 quality trend，rule 必須實際驅動 branch；學生不得 retune。
- **Observation:** serving state、quality trend、switch count、outage／deadline、
  W、累積 J、delivered bits、service_pass 與 canonical bit/J 同步。
- **Explanation artifact:** A/B 結果 auto-log；學生只完成部分 stem：`此規則
  在＿＿趨勢會失敗，因為 changed state＿＿使 service／consumed-J trade-off
  ＿＿`。
- **Misconceptions:** 最近／最強一定最好；最少 handover 一定省；動畫換色
  就證明 policy 生效；prediction 等於 future knowledge。
- **Self-study/recovery:** event rewind、show-next-state hint、known-good trace；
  明示未建模 handover-event energy，能量差只能歸因於 link choice、active
  time 與 delivered service。

### 64–69 — Recovery reset

- 儲存同一 workbook；閉卷用一句話重建 Lab A 或 B 因果鏈。
- 其餘時間是伸展、裝置 recovery 與全班同步，不計作內容或實驗。
- 若全班不需 recovery，使用一張 boundary counterexample card；不新增
  衛星術語或額外 slider。

### 69–92 — Lab C: Spend the joules

- **Question:** 「有限 consumed-energy budget 和短 contact window 下，urgent alert、
  periodic status、bulk data 應何時送、何時 batch、何時 sleep？」
- **Protected timing:** `6 min completed one-card example + entry check / 10 min
  action + observation / 5 min learner debrief / 2 min transition`；不再切七個
  需要逐一書寫的微步驟。
- **Explanation:** 完整走一次 data card 的 generated → sent → received，分辨
  deadline 與 freshness，再教 wake/idle cost 與用同一 canonical `P_sys`
  累積出的 consumed-J hard budget。第一版不引入 harvest、battery state、
  net-energy 或第二套 numerator／denominator；entry check 要求在一張 urgent
  card 上選出 legal slot。
- **Prediction:** 對 `send-immediately` baseline 用方向選項預測 service_pass、
  freshness／expired、wake count、active time、consumed J 與 budget remaining；
  不逐項寫理由。
- **Operation:** 六格 mission board 保留視覺時間軸，但兩格固定、最多四格
  可由學生行動；在半填合法起點安排 urgent／periodic／bulk 的 send／batch／
  wait／sleep。learner schedule 必須成為 actual timeline input；跑一次、只修
  一次，再凍結接受一個較短窗口或新 urgent arrival。autofill 只算 scaffolded
  practice，不算 unaided evidence。
- **Observation:** 每張卡的 generated/sent/received time、fresh/expired、
  wake/tx/sleep state、system W、累積 J、budget remaining、delivered bits 與
  canonical bit/J；`service_pass`、deadline、freshness、consumed J、budget
  remaining 與 delivered bits 分區呈現，不壓成第二個 ratio。
- **Explanation artifact:** baseline／learner／withheld ledger 自動比較；學生
  只完成 `我的 schedule 省掉＿＿的 power-time cost，但犧牲／差點犧牲＿＿
  service；因此在＿＿條件下 qualify`。
- **Misconceptions:** batch 一定省；等好 link 一定省；最高 bit/J 可以忽略
  urgent miss；energy budget 是另一個 headline ratio；少送重要資料也算節能。
- **Self-study/recovery:** illegal drop slot 立即說明 deadline/window；reset
  baseline、autofill one legal schedule；fast branch 加一張 surprise alert，
  不增加參數自由度。

### 92–106 — Evidence clinic: Prediction is not saving

- **Question:** 「99% 準確率的模型是否比 78% 的模型更能證明節能？」
- **Explanation:** 用一張帶 timestamp 的 worked feature card 教 decision-time
  data、post-action outcome、chronological held-out set 與 prediction → action
  → plant result；不教演算法 zoo。欄位不得只靠名稱中的 `final` 洩漏答案。
- **Prediction:** 只分類 4–6 張關鍵 feature card，包括一張需看 timestamp 才
  能判斷的 borderline case；以 `available now / post-action leakage` 選項作答。
- **Operation:** browser-native default 提供同一 interpretable model 的 honest
  與 oracle contrast。學生拒絕 leakage，從至少兩個 decision-time 合法但
  風險不同的 action 中凍結一個，對 chronological Trace B replay；選擇必須
  進 actual control path，不能只保存 feature-sort 答案。
- **Observation:** prediction score 與 actual `service_pass`／freshness／deadline、
  consumed J、delivered bits 與 canonical bit/J 分兩區；model score 不進
  energy formula。
- **Explanation artifact:** 只完成一句 `這個 prediction claim 可／不可用，
  因為＿＿在 decision time＿＿；frozen action replay 顯示＿＿，所以只能聲稱
  ＿＿`。
- **Misconceptions:** accuracy=energy saving；future result 可當 feature；
  training rows 等於新情境；AI label 是量測。
- **Self-study/recovery:** availability-time tooltip、leakage hint、fixed honest
  fallback model；fast branch 判斷 distribution shift，不比較更多模型。

### 106–120 — Competition transfer and exit

- **Question:** 「把哪一個 LEO 節能機制換到非衛星場景後，仍能形成可測、
  可被推翻的競賽題目？」
- **Explanation:** 衛星數值不能直接外推；只轉移 `state → prediction →
  control → service → P×time → J → evidence`。先展示一張**不同 domain、
  不同 fixture** 的完成格式範例，不提供本題答案。
- **Operation:** 八個 semantic fields 已由全課累積：A 保存 baseline／
  power-time pathway，B 保存 state/data／control，C 保存 boundary+unit／
  service constraint，clinic 保存 held-out logic／falsifier starter。最後選一張
  未見的 smart farm／HVAC／edge／logistics domain card，重新映射 tokens，
  只開放寫 competition hypothesis 與 falsifier。固定鄰座交換一張 `what-if`
  後個別修一次；若鄰座尚未就緒，立即使用個人 system what-if，不等待。
- **Observation:** rubric 不評工具品牌或華麗 dashboard；只檢查因果路徑、
  比較公平、service gate 與 falsifier。
- **Explanation/retrieval:** 一題未見情境的選擇／排序題同時檢查 low W vs
  low J、dynamic policy 與 prediction-vs-saving；因果理由已由 hypothesis／
  falsifier 提供，不再新增三個自由問答。完成後匯出 reopenable workbook，
  未完成者仍可匯出但明示 `INCOMPLETE`。
- **Misconceptions:** 題目寫 AI 就成立；只有節能百分比沒有 baseline；把
  satellite fixture 數值搬到 smart farm；falsifier 是預期成功案例。
- **Self-study/recovery:** field-specific hint、同一 workbook reopen、換一個
  held-out fixture replay；hint／fallback provenance 保留在輸出中。

## Complete textual storyboard — Lab C, 69–92

1. **69–75 / One-card model, boundary and baseline.** 講師只走一張不同 fixture
   的 card：generated → sent → received，學生做 legal-slot entry check。回到
   NTPU 任務後，畫面揭露 urgent／periodic／bulk、deadline、freshness limit、
   size、contact window 與同一 canonical consumed-J budget；學生以方向選項
   lock `send-immediately` prediction，系統逐格播放 baseline 並自動記錄
   `service_pass`、freshness／expired、consumed J、budget remaining、delivered
   bits 與 bit/J。
2. **75–85 / Learner schedule and run.** 六格畫面中兩格已被 scenario 固定，
   學生在四個 actionable slots 安排 cards、batch flush 與 sleep。非法 slot
   立即說明違反的 deadline／window；合法 schedule 成為 actual course-state
   input。timeline 播放時先顯示 state、service_pass 與 consumed J，再按需展開 wake count、active
   time、delivered bits 與 bit/J，避免同時掃描所有 KPI。
3. **85–90 / One revision and withheld event.** 學生只修一次並凍結 schedule；
   系統揭露 shorter contact 或 surprise urgent card，自動執行而不允許看答案
   後 retune。fast branch 使用另一個公平 counterexample；慢手可用半填合法
   schedule，但輸出標記 scaffold level。
4. **90–92 / Learner debrief and transfer token.** baseline／learner／withheld
   ledger 並列；學生完成「省掉什麼 power-time cost／犧牲什麼 service」的
   部分 stem，作 `accept / qualify / reject`，並把 boundary／service token
   累積到 final idea card。若 urgent 過期，即使 bit/J 上升也禁止宣稱 mission
   winner；講師不得用新增公式吃掉 learner debrief。

## Tool strategy for this storyboard

| Tool/route | Decision | Irreplaceable learning object | Promotion or cut rule |
|---|---|---|---|
| One browser-native energy workbench | **REQUIRED BASELINE / EMPIRICALLY UNCONFIRMED** | same workbook、policy state、timeline、service fields、consumed J、delivered bits／bit-J、held-out replay 應共用一條權威 | learner action 不進 authoritative state、結果全預揭或只變動畫即 FAIL；required 不代表 current runtime 已 PASS |
| Existing TLE-to-NTPU glass box | **REQUIRED 8-min anchor / EMPIRICALLY UNCONFIRMED** | owner-required individual source-to-scene literacy | 超過 8–10 分、教 orbital derivation、fallback 未明示或後續沒消費同一 scenario 即 CUT／simplify |
| Orange | **OPTIONAL route candidate** | visual feature availability、separate test data、prediction workflow | 官方能力不證明 14–20 分鐘／20-seat readiness；首次新手無法完成就不硬塞，完整 20 分鐘只能用下列 C120-O 替代重切 |
| Node-RED | **NOT IN DEFAULT ROUTE** | event message → bounded rule → command trace 有潛力，但 browser 可等效 | 這是課程路由判斷，不是否定工具；cold install、broker/port、Function code 或只轉送 telemetry 即拒絕 |
| Contiki-NG/Cooja/Energest | **OPTIONAL FUTURE CANDIDATE** | 真實 OS/radio state occupancy → assumed power table → energy accounting | 目前無 image/reset/parser/20-seat 證據；只有 prebuilt、zero-compile gate 全過才可另提，本 route 不需要它 |
| INET/OMNeT++、FLoRa | **NOT IN THIS 120 CORE** | 有真實 radio/energy model，但引入第二套通訊語義與環境工程 | 留給 longer specialist lab／staff demo；這是 fit 判斷，不是工具能力否定 |
| Gpredict/GMAT external artifact E3 | **NOT IN NEW DEFAULT** | 只有同一 TLE scenario 真被後續 labs 消費時，8-min anchor 才足以取代其 provenance 角色；工具本身沒有 energy authority | 只有 future separate extension 且 artifact 真改 service window／service_pass 與 consumed J／bit-J 才重開 |

### Conditional `C120-O` if Orange earns 20 minutes

若 3–5 位 novice 證明預載 Orange workflow 能在 20 分鐘內、無 add-on／raw
CSV／random-split／講師救援完成 feature selection、separate Trace B prediction
與 browser replay，採以下**替代**時鐘：

`8 claim detective + 8 TLE + 22 Lab A + 22 Lab B + 5 reset + 22 Lab C +`
`20 Orange + 13 transfer = 120`。

Orange 不增加第 121 分鐘，也不計算／覆寫 consumed J 或 canonical bit/J；失敗立即回到
browser-native 14-minute evidence clinic。

## Minimum course surface, independent of Leo／BeamShift／new shell

本 ticket 不選實作 base；三案都必須先滿足同一 surface contract：

1. `Mission contract`：service、deadline、boundary、units。
2. `Prediction lock`：結果前保存方向、selection／short-clause 理由與信心，
   不能事後改寫；不要求重抄 KPI。
3. `Policy cards / rule blocks / mission board`：三種不同 consequential
   agency；Lab A candidate、Lab B executable rule、Lab C schedule 與 clinic
   feature/action 必須成為下一次 replay 的 authoritative input。選擇順序、
   note、動畫與 preset result 不算 agency。
4. `Shared timeline`：state、`service_pass`／deadline／freshness、W、cumulative
   consumed J、budget remaining、delivered bits、canonical bit/J 與 action
   共用同一 clock；display-only 明示。
5. `Trial ledger`：baseline、candidate、revision、withheld 可比較且可 reopen。
6. `Hidden test`：答案與 future trend 在 freeze 前不可見。
7. `Evidence clinic`：feature availability、claim boundary、incomparable gate。
8. `Transfer and retrieval`：全課累積式 idea card、bounded counterexample、
   一題未見情境選擇／排序、export/replay。

現行 Leo route 的 preset IoT table、auto-filled rule、fixed retrieval bullets、
leaked future trend 和 jump-to-end timeline 均不符合這個 contract。漂亮 NTPU
前端可以保留，但它不是 120-minute readiness evidence。

## Promotion, collapse and stop gates

以下任一項成立，就不得宣稱 course-ready 或用更多投影片補時：

1. 任一 full lab 只靠 preset clicks／等待動畫完成，沒有 prediction、
   consequential state、revision／withheld test 或 learner explanation；快手
   雖完成核心 evidence，卻沒有同機制 consequential counterexample branch。
2. learner candidate、rule、feature/action 或 schedule 只被記錄，沒有改變
   後續 observable state，且沒有改變至少一項 `service_pass`／freshness／
   deadline、consumed J、delivered bits 或 canonical bit/J evidence。
3. 結果前已顯示 future trend、所有 preset outcomes 或正確答案。
4. 只有 W／bit-J 改變，沒有 cumulative J 與 qualified service；或不同 boundary、
   workload、time window 被直接報 saving percentage。
5. Lab C 把 priority 或 energy budget 偷塞成另一套未宣告 headline ratio；第一版若
   出現 harvest、battery、net-energy 或 `qualified_updates/J`，未另經 owner
   接受獨立 storage/accounting contract 即 FAIL。
6. prediction accuracy 被當成節能證據，沒有 frozen-action replay；leakage
   欄位在 decision time 不可得。
7. 學生必須安裝、編譯、登入、寫程式、debug 或接受持續講師接管。
8. 3–5 位 novice walkthrough 沒有逐人記錄 active seconds、first answer、
   invalid action、hint／fallback、instructor rescue、artifact completion 與
   causal rubric；或任何核心段落只能靠講師公布答案。`65–72 median / p90
   <=78` 只是初始 planning hypothesis，不是先驗 PASS；高品質快手不得因
   active time 較短被判 FAIL。
9. 20-seat rehearsal 無法在 5 分鐘內讓所有電腦進入第一個 meaningful
   activity，或故障不能在 2 分鐘內切同一 fixture fallback。
10. 最後沒有個人 workbook、三個 lab verdict、prediction/control 判決、
    全課累積 idea card、non-LEO hypothesis 與 falsifier；或只以欄位不空白
    判定理解。
11. fixture 永遠只有講師預定的單一 winner，沒有至少兩個在不同明示條件
    下可辯護的 policy；hidden case 只是刻意翻牌而非公平 counterexample。
12. drag/drop 沒有 keyboard／table alternative，關鍵 state 只靠顏色，或
    timeline 無法 pause／replay；這些不得延後到 20-seat 後才處理。

這些 gates 通過前，最高 claim 是
`PROPOSED EXACT-120 ENERGY-FIRST STORYBOARD / EMPIRICALLY UNCONFIRMED / NO IMPLEMENTATION OR SLIDE AUTHORIZATION`。
