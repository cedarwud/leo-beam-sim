# LEO 六幕教學設計提案

> 產出：2026-08-22 · 狀態：**v2 REVIEWED**（經四家模型交叉審核修訂：GPT-5.6、Gemini 3.7 Flash、Gemini 3.1 Pro、Claude Fable 5；審核紀錄見文末附錄與 `.scratch/six-acts-review/`）
> HTML 版（同內容、同 URL）：https://claude.ai/code/artifact/3306a4db-bf52-471f-af00-c66f1396da99
> 課綱依據：`~/papers/platform/intro.md`（低軌衛星之節能通聯和移動管理）
> 平台規格依據：`~/papers/platform/`（fields.csv、leo-sinr-platform-field-extension.md、beamshift-course-operator-kit/README.md、upload_baseline_modqn_platform.py）
> **符號權威**：`~/papers/modqn-paper-reproduction/docs/research/ee-definition-cleanup/2026-08-17-simplified-ee-symbol-table.md`（ACTIVE SYMBOL AUTHORITY；ADR-003 已為 archived contract）。本文所有前端可見公式一律使用權威記號。

把現有三個頁面（首頁模擬器 `/`、全球星座 `/prototype/global-constellation`、離軸角 3D `/prototype/scientific-explain-legacy-3d`）改造成一條「從一顆地球 zoom-in 到一份實驗紀錄」的教學動線：六幕、每幕一個核心問題、每幕都有學生動手環節，最後以節能實驗數據上傳平台收尾。對象：無衛星／通訊背景學生。總長 **110–120 min**（demo cut 15 min；90 min 精簡版的取捨明列於錄影腳本節）。

---

## 0. 設計主張與六幕地圖

整條動線只講一個故事：**衛星飛得太快，網路必須一直做決定；每個決定都有能量代價**。鏡頭從整顆地球一路拉近——星座 → 一顆衛星的軌道資料 → 一條鏈路的幾何 → 一個系統的換手 → 一個實驗 → 一份紀錄。每一幕結束時留下一個「下一幕才能回答」的問題。

三個貫穿原則：

1. **預測 → 操作 → 解釋**：每個動手環節先押注、再操作驗證、最後一句因果解釋收尾（沿用 c90/c120 已驗證的 loop）。
2. **懸浮解說即字幕**：講解以釘在 3D 物件上的浮動卡片呈現（復用 visualLab annotationOverlay + story director），錄影自帶旁白重點、投影片直接截圖。
3. **誠實邊界不打折**：示意數值標 DEMO、正式數值標 CANONICAL——CANONICAL 的口徑是 **active symbol authority（2026-08-17 符號表）**；資料來源附 SHA-256。凡是現行引擎「做不到、但為了教學而敘事」的因果，一律標 `COURSE-ASSUMPTION`。

| 幕 | 頁面 | 核心問題 | 學生動手 | 建議時間 |
|---|---|---|---|---|
| 1 全球星座 | /prototype/global-constellation | 天上有多少衛星？為什麼兩家差 16 倍？ | 猜數量、拖時間軸、切殼層濾鏡、找 NTPU 可見數最少時刻 | 12–15 min |
| 2 TLE 之旅 | 新頁（建議 /course/tle-journey） | 衛星位置是誰算出來的？ | 載入真實 TLE、逐欄解讀、改壞數字、拖 pass 曲線 | 20–25 min |
| 3 離軸角實驗室 | /prototype/scientific-explain-legacy-3d | 離軸角 vs 仰角？角度怎麼變成功率與能耗？ | 切三種鏡頭、撥波束中軸、「掉 3 dB」任務、看功率遞推爬升 | 15–20 min |
| 4 換手劇場 | /（首頁・上課模式） | 為何換手？何時換？換給誰？為何有時「被迫」換？ | 調遲滯與 guard 做 ping-pong、暫停時自選候選衛星 | 22–25 min |
| 5 節能實驗 | /（首頁・實驗面板） | 調小功率真的省電嗎？ | 押預測、掃功率記錄曲線、詞庫寫解釋 | 18–20 min |
| 6 平台記錄 | Platform 抽屜（新建） | 為什麼上傳？上傳能做什麼？ | 勾欄位、看 payload、定期上傳、回讀驗證 | 12–15 min |

---

## Act 1 全球星座——規模與高度的第一眼

**頁面**：/prototype/global-constellation（升級）。素材：`public/tle-archive` 封存 TLE（2026-08-16 檔：Starlink 10,751 顆／OneWeb 651 顆）。

現況已有星座切換、總數／NTPU 可見數／中位高度、SHA-256 來源。「太虛」的根因是畫面靜止、數字之間沒有因果。三個改造：

1. **時間推進**：±90 分鐘時間軸（SGP4 預先批次算幀，沿用 first-frame artifact 產線，不即時逐點傳播）。**效能預算**（審核時實算）：30–60 s 步長 = 181–361 幀 × 10,751 點 × 3×float32 ≈ **23–46 MB／星座**——可行，但必須用 Float32Array 打包＋按星座 lazy load。點選衛星 → 浮卡（名稱／NORAD／高度／傾角／速度）＋ ground track。
2. **殼層要誠實**（審核修正）：同一份快照實測 Starlink 傾角 **42.97°–97.63°**、高度 **約 219–582 km**，其中 **1,369 顆（12.7%）傾角 >80°**——所以「兩極有洞」只對 **53° 主力殼**成立，不能對全星座講。做一顆「殼層濾鏡」（53° 主力殼／70°／極軌／全部）：先看主力殼講中緯度帶與極區洞，再切「全部」讓學生自己發現極軌那群——這個「咦？」本身就是好的教學拍點。數量對比的說法用**設計意圖**框架：「OneWeb 用較高軌道＋極軌設計，以較少衛星達成含極區的全球覆蓋；Starlink 的萬顆是為了容量與低延遲」——這是系統設計選擇的陳述，不是單從 footprint 幾何推導的定理。
3. **NTPU 視角**：仰角 10° 可見圓錐、錐內衛星高亮、可見顆數即時跳動；動手任務「找出 OneWeb 在 NTPU 頭上顆數最少的時刻」。

開場互動：「猜一猜 Starlink 現在有幾顆在軌」三選一，揭曉時數字滾動到 10,751。本幕不硬扯節能。

**Bridge → Act 2**：同一顆衛星只在你頭上停留幾分鐘。這些點的位置是誰算出來的？——三行文字：TLE。

---

## Act 2 TLE 之旅——五站動態投影片

**頁面**：新路由（建議 /course/tle-journey）。**復用邊界**（審核裁決）：只做**元件級**復用——c120 的 `tleImport` 與三層來源標籤元件、`src/tle`（SGP4、pass index）；**不**複製 c90/c120 的 stage-gating／session／claim-gate 機制（本頁是線性 stepper 講課面，不是闖關課程殼）。

五站 stepper（同畫面換景），每站＝一個畫面＋一張懸浮解說＋一個動手點；上一站的產物是下一站的輸入，從純文字逐步長成 3D 場景：

| 站 | 畫面 | 學生動手 |
|---|---|---|
| ① 拿到原始資料 | 真實 TLE 原文（預設 bundled 快照） | 選星座＋日期或貼上 TLE |
| ② 逐欄解讀 | 69 字元逐欄高亮，滑過彈解釋卡 | 由 mean motion 算「13.18 圈/天 → 週期約 109 分鐘」；**改壞一位數字 → checksum 驗證失敗** |
| ③ SGP4 黑盒子 | 契約式教學：(TLE, t) → 位置＋速度；拖時鐘衛星沿軌道動 | 拖時鐘觀察輸出 |
| ④ 從 NTPU 看它 | 地平座標（仰角／方位／距離）；仰角–時間「山形」pass 曲線 | 拖出 rise → max-el → set，讀 pass 長度 |
| ⑤ 成為模擬器燃料 | 迷你 3D：NTPU＋這顆衛星動起來、仰角字幕跟隨 | 按「放進模擬器」 |

站②素材用 c120 已釘選的 ONEWEB-0314（NORAD 49100）：epoch `26220.09856820` = 2026 年第 220.0986 天；傾角 `87.9186°`（極軌）；mean motion `13.17650635` rev/day → 週期約 109 min。

要點：SGP4 **只教契約不教推導**（輸入→輸出、誤差 km 量級）；來源三層標籤沿用 c120（SOURCE → MODEL-DERIVED → COURSE-ASSUMPTION）；CelesTrak group query 有 cache/rate policy——**學生一律用 bundled 快照**；講師「現場抓一次」的示範**走終端機／腳本（server-side）**，瀏覽器內直接 fetch CelesTrak 會撞 CORS（審核發現）。

**Bridge → Act 3**：知道位置還不夠——訊號從 550 km 外打下來，夠不夠、準不準，取決於幾何。

---

## Act 3 離軸角實驗室——兩個角度、一條角度感知的能量鏈

**頁面**：/prototype/scientific-explain-legacy-3d（升級）。復用：`src/engine/signal/beam-gain.ts`（PAP-2024-HOBS Eq.(3)，runtime link budget 使用的 J₁/J₃ 型樣）。

既有骨架保留（滑桿、三段 stepper、能量粒子、因果鏈、可旋轉鏡頭）。**審核後的重要修正：本頁現行的「R_min → 需求 SINR → 需求功率 → P_max cap」鏈使用的是權威符號表已刪除的語意（γ_req、需求功率反推、cap 都已自論文移除），整條數值鏈改為權威版的角度感知功率律**——這其實比原設計更貼課綱主題：

```
θ → G^T(θ) = G₀·F(θ, θ_3dB)（HOBS J₁/J₃ 型樣）
→ p(t) = p(t−1)·G^T(θ(t−1))/G^T(θ(t))（同一 served segment 內遞推；segment 起始 p = 2 W）
→ γ_{u,s,v} → R_{u,s,v} → η_{u,s,v}
```

教學語言：**「波束為了維持鏈路品質，會隨著你偏離中軸而把功率越推越高——指向誤差是有能量帳單的。」** 這就是論文 angle-aware EE 的核心機制，學生在這一頁第一次看到它。

三個改造：

1. **「兩個角度」同框＋三個鏡頭預設**：同畫面畫仰角 ε（金色，頂點在 UE 的地平面）與離軸角 θ（青色，頂點在衛星、從波束中軸量到 UE 方向）。鏡頭預設鍵：UE 視角 → 側視 → **衛星視角（沿波束中軸往下看：UE 偏離準心的角度就是 θ 的畫面定義）**。錄影時三連切就是完整論證。
2. **波束中軸可動**：新增 steering 滑桿（UE 不動、中軸傾斜 → θ 變）；自動演示「衛星飛過去」兩模式對照：(a) 中軸固定星下點 → θ 越變越大、G^T 掉、遞推功率一路爬升（能量粒子變密）；(b) 中軸鎖定 UE → θ≈0 但掃描角逼近極限。收尾句：**「波束會歪頭照你，歪到極限就得換人」**——換手伏筆。**口徑註記**：掃描損耗已退出論文公開表面（併入 H 的實作層），畫面上的 steering 極限效果標「實作層」，不呈現為公式項。
3. **公式即字幕**：G^T(θ)/G₀ 曲線小圖游標跟隨——DEMO 模式用簡化型樣；CANONICAL 模式切 **HOBS J₁/J₃**（看得到旁瓣：「為什麼偏一點點掉這麼快」的視覺答案）。波束寬度控制一律標 **θ_3dB**（不再用 β，避免與論文其他符號混淆），且 **θ_3dB 必須真的接進 F(θ, θ_3dB)**（審核發現：現行頁面的波束滑桿只改 footprint 視覺、不進數值鏈）。動手任務：「把 θ 調到 F 剛好掉 3 dB」→ 這時才真的教到 θ_3dB 是 3 dB 半寬。

**Bridge → Act 4**：一顆衛星對一支手機已經這麼多事。整個星座一起動，系統要在幾秒內回答：換不換？何時換？換給誰？

---

## Act 4 換手劇場——首頁的「上課模式」

**頁面**：/（首頁）。復用：visualLab story director + guidedReplay annotationOverlay、HandoverEventRail、liveWalkerHandoverEventIndex（`'intra' | 'inter'` 已分類）、`handoverPolicyTuning`（既有政策旋鈕，**不要新做**）、90 天 event atlas。**註**：operator kit 提到的 `/?teaching=1` 在本 repo 尚未實作——「上課模式」是新建的路由旗標。

首頁是工程師儀表板，資訊全開、沒有敘事——解法不是重寫，而是加**「上課模式」**：收起進階分頁，進入導演腳本，鏡頭／時間軸／懸浮卡由 story director 驅動，關鍵拍點自動暫停。**上課模式與工程模式的 persisted 狀態要隔離**（appPersistence 各自命名空間），避免上課調的參數污染研究工作流。

### 劇本素材：圖集實測給了一個意外的好教材（審核發現，已驗證）

90 天 NTPU 圖集（政策常數：**3 dB offset + 30 s TTT**）：

| | 有效 Offset+TTT 換手 | forced-continuity（被迫接替） |
|---|---:|---:|
| Starlink | **0** | 43,943 |
| OneWeb | **329**（0.152 次/小時） | 24,409 |

而且 OneWeb 的 329 件有效事件**全部發生在仰角 <45°**（≥45° 的計數為 0）——條件式換手天生發生在低仰角交接帶。三個設計後果：

- **Phase D 的示範窗取自 OneWeb 圖集**（唯一有 SOURCE 級有效事件的星座；例：2026-08-10T16:54:30Z，49194→55159，ΔSINR 0.86 dB）。
- **Phase A/B 改寫為中低仰角起點**：不能再演「仰角 62° 穩定服務 → 下滑」然後接一個真實低仰角事件——幾何對不上。若要演中高仰角版本，只能用政策參數合成，並掛 DEMO/COURSE-ASSUMPTION 徽章。
- **「Starlink 90 天 0 次有效換手」做成 Act 1↔Act 4 的橋段，但必須成對呈現**：0 要跟 43,943 次被迫接替一起講，並標明「這是 3 dB＋30 s TTT 這組政策在 NTPU 的性質，不是 Starlink 不換手」。正確教訓：**星越密、pass 越短，禮貌的 A3 條件常常等不滿 30 秒，換手多為被迫型**。單獨一個「0」會被學生誤讀成「Starlink 很穩」。

### 導演腳本六 Phase（低仰角版）

- **A 接手初期**：浮卡釘在服務衛星（γ／仰角／高度），解說「剛接手、幾何正在變好或變壞」。
- **B 品質下滑**：衛星西沉，卡片逐項變色：距離↑→FSPL↑；θ↑→G^T↓；仰角↓→大氣損耗↑。γ 曲線下滑（全是 Act 3 的詞）。
- **C 候選出現**：第二條 γ 曲線入場；「候選排行榜」浮窗（γ／仰角／剩餘可見時間 × 3 顆）。
- **D 條件判斷（自動暫停）**：規則可視化：候選 − 服務 > offset（3 dB），且持續 TTT（30 s）；offset 畫成兩曲線間陰影帶、TTT 畫成候選衛星上的倒數環；標題「條件在這一秒成立」。**拍點以 live 重放的實際 dt 校準**——圖集是 30 s 粗步長的離線 forecast，只用來「挑窗」，不能直接當拍點時刻表。
- **E 執行換手**：跳線動畫、rail 記一筆、**「換手收據」**浮窗（中斷 ms／訊令成本／γ 增益）——把換手變成「有代價的決定」，為 Act 5 鋪路。
- **F 新常態**：數值回穩，循環或交還自由操作。

### 動手環節

1. **Ping-pong 實驗（雙旋鈕版，審核修正）**：現行引擎在主顯示 UE 上有**共用換手鎖**：每次換手後至少 max(pingPongGuard, **6 s** 呈現包絡) 內不再換（`handover-manager.ts` 的 `MIN_HANDOVER_INTERVAL_MS`）——把 offset 調到 0 並**不會**讓 rail 爆量，會被 guard 悶住。所以這個實驗把 anti-ping-pong 機制本身變成教材：上課模式顯示 guard 底線並允許講師調整，兩顆旋鈕（offset Δ ＋ guard）接既有 `handoverPolicyTuning`。三段對照：Δ=0＋guard=0 → 爆量來回；guard 恢復 → 安定（**學生看見是誰在防抖**）；Δ 調過頭 → 黏在爛衛星、低 γ 比例升高。結論：**換手次數不是越少越好也不是越多越好，而且系統本來就內建防抖成本**。
2. **你來選**（Phase D 暫停時）：學生點選候選、模擬續跑、收據累計。選「γ 最高但只剩 55 秒」→ 一分鐘內被迫再換，兩張收據疊加。教訓：**換手決策是預測問題**（一句話銜接 RL/MODQN 研究，不展開）。

### 三種換手對照（含被迫型）

| | Intra（換波束） | Inter（條件式換衛星） | Forced-continuity（被迫接替） |
|---|---|---|---|
| 畫面語言 | 同衛星波束錐重指、footprint 換色 | 條件成立後跳線 | 服務衛星離開可視範圍，接替者直接接手 |
| 為什麼發生 | 衛星前進，cell 邊界掃過你 | 候選比服務好 3 dB 且持續 30 s | 服務衛星下山，沒得等條件 |
| 代價 | 小 | 中（有準備時間） | 大（可能伴隨中斷） |
| 在 NTPU 90 天圖集 | 常見 | OneWeb 329 次；Starlink 0 次 | 兩星座都是數萬次 |

**Bridge → Act 5**：每張收據都是能量。我們來做一個正式的節能實驗——先從一個你八成會答錯的問題開始。

---

## Act 5 節能實驗——「調小功率＝省電」是真的嗎？

**頁面**：/（首頁・實驗面板）。復用：`src/teaching` canonical EE 引擎（`BeamshiftCanonicalEeAccumulator`）、c120 prediction/word-bank 模式。**新工程量（審核發現，復用表沒涵蓋）**：功率掃描面板本身、以及 run-summary 遙測（LOW_SINR_RATIO 計算、TOTAL_ENERGY_J/DELIVERED_DATA_MBIT 匯出、1 Hz HANDOVER_EVENT 取樣橋）目前 **src 內零產出**，須列為 P0/P1 的明確工項。

**公式呈現（依符號權威）**：

```
γ_{u,s,v} = p·H·G^T(θ) / (I + σ²)
R_{u,s,v} = (B^w / U_{s,v}) · log₂(1 + γ_{u,s,v})
P^p = p / ξ          （ξ：RF→電源端的有效轉換效率）
P^N = P^f + Σ P^p     （P^f：系統固定/circuit overhead 聚合量）
η_{u,s,v} = R_{u,s,v} / P^N   （單鏈路 EE 顯示量，bit/J）
```

工程層對照（實作徽章，不進公開公式）：模擬器 BeamShift lane 的 P_RFC 0.338 W/beam 與 P_BB 分攤**彙總為 P^f**；PA 曲線以有效效率 **ξ** 表示；run 級評估用 **ratio-of-sums**（即平台欄位 `RUN_EE_MBIT_PER_J` 的口徑）。

**實驗設計（審核強化版）**：

1. **押注**：「把每波束發射功率一路調小，Mbit/J 會怎麼變？」三選一。先選才解鎖滑桿。
2. **掃描**：**baseline 與 eco 兩個 arm 跑同一組 immutable replay frames**（deterministic replay 保證可比），metadata 帶 runId/strategyId/scenarioId。學生逐檔調功率、按「記錄一點」——R、P^N、η 三條曲線當面長出來。**課堂參數先離線掃描定案**（B^w、reuse、UE 佈局、時間窗固定成 fixture），確保 EE 峰落在滑桿中段；該 fixture 同時是斷網 fallback。
3. **揭示三段式**：
   - **左段（功率太小）**：P^f 不因你調小而消失，ξ 還隨功率下降——固定開銷照付、bits 趨近 0 → **每 bit 能量成本爆炸**。
   - **中段**：甜蜜點。
   - **右段（功率拉滿）**：速率只有 log 成長，而電源端功率隨 **√p** 成長（cap 內 ξ∝√p 使 P^p≈c·√p）＋（多波束時）干擾同步上升 → 報酬遞減。

**第二層陷阱（審核重寫——原版因果鏈在現行引擎不成立）**：功率太低 → 絕對 γ 掉到門檻下（噪聲項 σ² 不會跟著變小）→ `LOW_SINR_RATIO` 飆升，**且服務中斷（outage）變多變長**——因為 attach/re-attach 用的是**絕對門檻**，接替衛星在低功率下過不了門檻，UE 只能斷著等；停擺期間固定功耗照燒 → J/bit 更慘。**注意**：「低功率 → 換手次數變多」在現行引擎**不會發生**（inter-HO 是相對規則、attach/drop 不計入換手數）——這條若要講，必須標 `COURSE-ASSUMPTION`，或（P2 選項）實作可開關的教學用 SINR-floor 重選政策並標明口徑。四個平台欄位在這裡串成的誠實故事是：**功率、LOW_SINR_RATIO、outage、EE**。

收尾用 word-bank 拼一句因果解釋寫進 session。實驗產出 run summary（TOTAL_ENERGY_J／DELIVERED_DATA_MBIT／RUN_EE_MBIT_PER_J／NUM_HANDOVERS／LOW_SINR_RATIO）餵給 Act 6。

**Bridge → Act 6**：你找到的甜蜜點，跟別組一樣嗎？口說無憑——上傳到全班共用的平台，讓曲線自己說話。

---

## Act 6 平台記錄——像研究者一樣留下證據

**介面**：首頁 Platform 抽屜（新建，操作流程對齊 beamshift-course-operator-kit）。

**API（寫全，避免前綴錯誤）**：base = `https://edu.nthu-smart-farming.kits.tw/api/api`；登入 `POST {base}/account/login`（form → token）；上傳 `POST {base}/iot_data/<mac>`（Bearer + JSON）；回讀 `GET {base}/area/<account>` → `/sensorgroup_in_area/<area>` → `/sensors_in_group/<group>` → `/sensors_in_timeinterval/<type>/<id>/<t0>/<t1>`。憑證一律走 `SMARTFARM_*` 環境變數。

**定位**：平台是**全班共用的實驗記錄簿**——(1) 跨組結果疊同一張圖比較、(2) 留下有時間戳的證據、(3) 下週回來還查得到。三件事單機都做不到。

**上傳什麼、為什麼**：

| 欄位 | 時機 | 為什麼值得上傳 | 狀態（誠實版） |
|---|---|---|---|
| `CURRENT_SINR` ch0/1/2 | 每秒 | 服務／最佳候選／增益三條曲線，平台圖直接看到換手前交叉 | 2026-05 曾成功上傳；**遠端註冊現況 CURRENT_UNVERIFIED** |
| `HANDOVER_EVENT` | 每秒 0/1 | 時間軸上標出每次換手 | 同上 |
| `LOW_SINR_RATIO` | **run 結束 1 筆**（依欄位規格；歷史腳本曾每秒上傳，課堂採規格版並註記差異） | 連線品質「不及格率」，低功率陷阱的證據 | 同上 |
| `NUM_HANDOVERS` | run 結束 | 換手總成本；ping-pong 現形 | type 0xAD，需 owner 確認現況 |
| `TOTAL_ENERGY_J`・`DELIVERED_DATA_MBIT`・`RUN_EE_MBIT_PER_J` | run 結束 | 實驗最終答案：每焦耳傳了多少 Mbit | **待 owner 註冊** |

**上傳節奏（實驗會話模型）**：

1. 開始實驗：選 arm（baseline vs eco）、勾選上傳欄位（每欄附一句「為什麼」）。
2. 定期上傳：1 Hz 取樣，每 30 秒批次一包（可設 30/60/300 s）＋**每組隨機 0–10 s jitter、login-once token 重用**——全班數十組同時整點打 API 會變成小型 thundering herd（審核發現）。斷線本地緩衝重送。
3. 上傳台帳：時間／筆數／HTTP 狀態流水帳；常駐誠實聲明——**HTTP 200 只代表「已接收」，不代表持久化或可回查**。
4. run 結束：上傳 summary → 「回讀驗證」按鈕走 documented GET 把資料抓回來比對。**驗證本身就是一堂課**。註：回讀需要 account/area/sensor id 與 token 授權範圍，學生按鈕的 auth 邊界要先定義（預設只回讀本組 MAC）。
5. 平台對照：平台圖表與模擬器曲線同框截圖 → 進投影片。

**班級玩法與依賴（審核修正）**：`RUN_EE_MBIT_PER_J` 排行榜是有意義的上傳理由，但它有**兩個 owner 依賴**：(a) EE 欄位註冊；(b) **各組身份區隔**——kit 目前只有單一 `SMARTFARM_MAC`，連 A/B 都尚未拍板（雙 MAC 或 channel），per-group 更是其後的決定。所以**排行榜列 P2**；owner 拍板前的過渡做法：單 MAC＋runId 區隔、由講師端本地彙整比較。

**課堂 fallback（升級版）**：斷網時不只截圖——Platform 抽屜內建**離線 mock 模式**（假 token＋預錄回讀資料，完整走一遍上傳→台帳→回讀流程），畫面常駐 **OFFLINE MOCK** 徽章以守誠實邊界；另備 JSON/CSV 下載與預留 receipt。

---

## 錄影腳本大綱

**110–120 min 課堂 cut**；demo cut（15 min）取每幕「◆」段落。**90 min 精簡版**：砍 Act 2 站③④的動手（保留演示）、Act 4 只做 ping-pong 不做「你來選」、Act 6 用離線 mock 不做現場回讀。

| 段落 | 畫面與操作 | 口白重點 |
|---|---|---|
| 開場 3' | 全球星座頁，猜數量 quiz ◆ | 「你頭上現在有一萬多顆衛星」；本課問題：讓它們替你傳資料要花多少能量？ |
| Act 1 · 13' | 切換星座 → 時間推進 → 殼層濾鏡 → NTPU 圓錐 ◆ | 主力殼 vs 極軌群；數量↔高度↔覆蓋是設計選擇；可見名單一直在換 |
| Act 2 · 23' | 五站依序走；站②改壞數字 ◆、站④拖 pass 曲線 | 每顆衛星背後是三行文字＋一個黑盒子；checksum 把關 |
| Act 3 · 18' | 三鏡頭連切 ◆ → steering 演示 → 3 dB 任務 → 功率遞推爬升 | 離軸角頂點在衛星、仰角頂點在你腳下；指向誤差有能量帳單 |
| Act 4 · 24' | 導演腳本六 Phase（OneWeb 低仰角窗）◆ → Starlink 0/43,943 對照卡 → ping-pong 雙旋鈕 → 你來選 | 換手三問＋第四問「為何被迫」；防抖機制本身有成本 |
| Act 5 · 19' | 押注 → 同幀雙 arm 掃功率長出三曲線 ◆ → 三段式揭示 | 省電模式為什麼最耗：固定開銷照付、斷聯照燒電；甜蜜點是算出來的 |
| Act 6 · 13' | 勾欄位 → 定期上傳台帳 → 回讀驗證 ◆ → 平台對照 | 上傳為了跨組比較與留證；200 只代表接收 |
| 收尾 3' | 六幕地圖回顧（排行榜於 P2 加入） | 從 TLE 到 Mbit/J：一條資料鏈、六個決定、一份紀錄 |

錄影技巧：導演腳本的自動暫停拍點＝換口白節點；deterministic replay（fixture frameId）保證重錄逐幀一致。

---

## 投影片與截圖清單（14 張骨架）

截圖規範：1920×1080、統一深色主題、關閉游標；每張記 frameId／參數組可逐幀重現。

| # | 投影片 | 截圖來源 | 說明重點 |
|---|---|---|---|
| 1 | 課程定位 | —（文字） | intro.md 課綱原文 |
| 2 | 兩個星座 | Act 1 雙星座對照 | 10,751 vs 651；**主力殼 53° 帶狀 vs 87.9° 極軌匯聚（Starlink 另有 1,369 顆極軌）** |
| 3 | 高度剖面 | Act 1 側視殼層 | 主力殼 550／OneWeb 1,200 km vs 地球半徑；Starlink 實測 219–582 km 散布 |
| 4 | NTPU 可見性 | Act 1 可見圓錐 | 10° 門檻；可見名單換人 → 為何需要換手 |
| 5 | TLE 原文 | Act 2 站② 欄位高亮 | epoch／傾角／mean motion；checksum |
| 6 | SGP4 契約 | Act 2 站③ 黑盒子 | (TLE, t) → 位置＋速度 |
| 7 | Pass 曲線 | Act 2 站④ | rise/max-el/set；一次 pass 只有幾分鐘 |
| 8 | 兩個角度 | Act 3 衛星視角＋側視 | 離軸角 ≠ 仰角：頂點位置不同 |
| 9 | 角度感知功率 | Act 3 G^T(θ) 曲線＋遞推功率爬升 | θ→G^T→p 遞推→γ→R→η；2 W segment 起始 |
| 10 | 換手條件 | Act 4 Phase D 暫停幀（OneWeb 低仰角窗） | 3 dB offset 陰影帶＋30 s TTT 倒數；ping-pong 雙旋鈕對照 |
| 11 | 三種換手 | Act 4 對照卡 | intra／inter／forced-continuity；**Starlink 0 vs 43,943 成對呈現＋政策前提** |
| 12 | EE 三段式曲線 | Act 5 掃描完成幀（**主圖**） | 固定開銷 P^f／甜蜜點／log-vs-√p 報酬遞減 |
| 13 | 平台對照 | Act 6 兩邊曲線同框（或 OFFLINE MOCK） | 上傳 → 回讀驗證 → 曲線一致 |
| 14 | 結論 | 六幕地圖＋各組甜蜜點分布（P2 後） | 一句話總結每幕 |

---

## 分期實作藍圖（審核後重構：fixture-first 垂直切片）

**P0——先讓一堂課能講**（原則：每個環節先用「離線驗證過的 fixture」跑通垂直切片，再談互動自由度）：
- **垂直切片**：OneWeb 圖集挑一個已驗證窗 → 導演腳本 v1（六 Phase、自動暫停、懸浮卡，拍點以 live dt 校準）→ 同幀雙 arm 功率掃描（pinned fixture）→ Platform 抽屜 v1（五個歷史欄位、批次＋jitter、台帳、payload 預覽、誠實聲明、**本地 JSON/CSV 匯出**與離線 mock）
- Act 1：時間推進＋殼層濾鏡＋NTPU 圓錐＋hover 卡（高度剖面可先靜態插圖）
- Act 3：三鏡頭預設＋雙角度同框＋steering 滑桿＋**θ_3dB 接進數值鏈**＋2 W 遞推功率顯示
- Act 4：ping-pong 雙旋鈕（接 handoverPolicyTuning＋guard 透明化）、候選排行榜（唯讀）
- **Act 2 站②靜態卡**（TLE 原文＋欄位高亮）——P0 課堂上「TLE 是誰算的」不能斷（審核修正）
- **明確新工項**：run-summary 遙測（LOW_SINR_RATIO 計算＋能量/資料量匯出＋1 Hz 事件取樣橋）——目前 src 內零產出

**P1——完整六幕**：Act 2 整頁（五站，元件級復用 c120 tleImport＋provenance）；Act 4 你來選＋換手收據＋三種換手小劇；Act 6 run summary＋4 個 EE 欄位（**卡 owner 註冊**）＋A/B arm（**卡 owner 拍板識別方案**）＋回讀驗證按鈕（auth 邊界先定義）；Act 1 雙地球並排。**P1 決策依 `docs/decisions/ADR-005`＋SDD 既列的未決事項先取得裁決**（handover policy／節能政策／平台上傳都在其開放清單上）。

**P2——加值**：班級排行榜（雙 owner 依賴解除後）、開場 quiz、word-bank 收集、learning bundle 匯出串 c90/c120、雙語、clip compositor 錄影輔助、（選配）教學用 SINR-floor 重選政策（可開關、標口徑，讓「低功率→換手變多」從 COURSE-ASSUMPTION 變成可演示）。

**復用對照（審核後修正版）**：

| 教學功能 | 復用模組 |
|---|---|
| 導演腳本＋懸浮卡 | `src/visualLab/story`（storyDirector）＋ `src/visualLab/guidedReplay`（annotationOverlay/annotationPlan） |
| 換手事件軌與 intra/inter 分類 | `src/ui/HandoverEventRail.tsx` ＋ `src/scene/liveWalkerHandoverEventIndex.ts` |
| 換手政策旋鈕（offset/TTT/guard） | `src/handoverPolicyTuning.ts` ＋ `src/engine/handover/handover-manager.ts` |
| 挑教學時間窗（有效事件 vs 被迫接替） | `src/tle/eventAtlas` ＋ `artifacts/tle-event-atlas/20260818-ntpu-90d/` |
| TLE 解析／SGP4／pass 曲線 | `src/tle`（propagation/passIndex）＋ `public/tle-archive` ＋ `~/demo/tle_data` |
| EE 累積與 run 評估 | `src/teaching/canonicalEnergyEfficiency.ts` ＋ `BeamshiftCanonicalEeAccumulator` |
| 波束增益（HOBS J₁/J₃） | **`src/engine/signal/beam-gain.ts`**（PAP-2024-HOBS Eq.(3)；runtime 使用版） |
| 預測→操作→解釋、word bank、TLE 匯入元件 | `src/course/C90*.tsx`（直接位於 src/course/）＋ `src/course/c120/`（元件級復用） |
| 前端符號唯一來源 | `src/explain/model/canonicalTermMap.ts`（2026-08-22 已對齊符號權威） |
| 上傳 payload 與 API 序列 | `~/papers/platform/upload_baseline_modqn_platform.py` 移植為前端 service |

---

## 風險與依賴（審核後完整版）

- **平台 owner 三重依賴**：EE 四欄註冊、A/B 識別方案、**per-group 身份區隔**（排行榜前提）。P0 全部不依賴這三者。
- **既有五欄現況**：僅有 2026-05 上傳紀錄，遠端註冊 CURRENT_UNVERIFIED——課前照 operator kit 走一次查驗。
- **CelesTrak**：學生一律 bundled 快照；講師示範走終端機（瀏覽器 fetch 會撞 CORS）。
- **HTTP 200 誠實邊界**：接收 ≠ 持久化；回讀驗證才是證據。
- **課堂並發**：批次上傳加 per-組 jitter＋token 重用。
- **效能**：時間推進預算 23–46 MB/星座（Float32Array＋lazy load）；必要時 worker 化。
- **圖集 vs live 漂移**：圖集是 30 s 離線 forecast，只用來挑窗；拍點一律以 live 重放校準。
- **首頁複雜度**：上課模式用「隱藏與腳本化」實現，並隔離 persisted 狀態，不動工程面板。
- **數值口徑**：DEMO／CANONICAL（=符號權威）／COURSE-ASSUMPTION／實作層 四種徽章；ADR-003 只作為 archived 工程契約引用。
- **符號權威仍在演進**：`V`（波束位置數）、衛星高度（實測 485–540 km 待定）、dwell、D2 門檻與 TTT 屬「先不要對」清單——本提案採用的角度功率鏈屬已定案段；權威表變更以 `.scratch/symbol-alignment/authority-baseline.sha256` 偵測。

---

## 附錄：多模型審核紀錄（2026-08-22）

依 multimodel-review 協議跑兩輪：GPT（codex/gpt-5.6-luna）、Gemini 3.7 Flash、Gemini 3.1 Pro（agy）、Claude Fable 5（無上下文子代理）各自對 C1–C9／S1–S6 出具 verdict，主持人逐條重推導後裁決；round 2 逐家確認（含一則 WITHDRAWN、多則附一手證據的 CLOSED）。對本文的實質修正：**C7 因果鏈重寫（Act 5 第二層陷阱）**、**Act 3 改用權威功率遞推（γ_req 已刪）**、**Act 4 改用 OneWeb 低仰角實測窗＋被迫接替教材化＋ping-pong 雙旋鈕**、Act 1 殼層誠實化、Act 6 依賴與並發修正、P0 重構。原始 brief／各家原文／裁決全文：`.scratch/six-acts-review/`。
