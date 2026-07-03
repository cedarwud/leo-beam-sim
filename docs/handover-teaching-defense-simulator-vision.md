# 換手教學／口試模擬器 — 願景與可行性報告

> **狀態**：願景 + 可行性定調（2026-07-03）。這份文件是「教學用 + 口試用」互動模擬器的**內部設計真相來源**。
> 下游有兩步會引用它：(1) web agent 的 deep research（補外部最佳實務）、(2) 新對話的最終方案整合。
> 本報告只記錄**已在討論中確認**的結論與**已驗證**的資料事實；未定的列在 §12 開放決策。

---

## 0. 一段話摘要

要把 leo-beam-sim 的前端做成一個**互動 3D 模擬器**，同時服務兩種觀眾：**(A) 完全不懂的一般人**（有趣、好玩、有故事、真的學會「衛星換手是什麼、這演算法幫上什麼忙、用了跟不用差在哪」）與 **(B) 口試委員**（當場調整、live 證明「我的演算法比較好」）。核心發現：**兩者共用同一副骨架**——都要把一個抽象的統計改善（coverage/fairness）變成**瞬間、看得出因果、可當場操作**的東西。差別只是**語氣與鷹架，不是架構**。技術上**可行**，且不需要在瀏覽器跑神經網路——靠「重播錄下的估值 + 前端重跑確定性 decode」。

---

## 1. 目的與雙觀眾

| | Layperson 教學模式 | 口試 live-proof 模式 |
|---|---|---|
| 觀眾 | 什麼都不懂的人 | 領域專家委員 |
| 訴求 | 有趣、好玩、故事性、理解 | 嚴謹、可信、當場證明 |
| 差異 | 加鷹架 + 遊戲 + 白話 | 減遊戲 + 開術語 + provenance + 防呆 |
| **共用** | **同一引擎／場景／旋鈕／資料／誠實邊界** | |

**口試模式 ≈ layperson build 的減法**：拿掉遊戲/計分、預設開 Expert 術語、跳過導覽、加排練過的黃金場景 + 完整 ablation 錄影。

### 三個學習目標（layperson 版一句話）
- **換手是什麼** = 你的連線在天上的基地台之間「跳」，因為衛星一直在飛，現在連的那顆很快飛走。
- **演算法幫什麼** = 讓大家別全擠去同一顆 beam，**聰明地分開**（反自私、反塞車）。
- **用了跟不用的差別** = 不用 → 搶最強的 → 塞爆 → 一堆人卡住；用了 → 人人有位子。

---

## 2. 要證明的「贏」（誠實邊界，binding）

來自 `modqn-paper-reproduction` 的論文定調（RED LINES）：
- **贏在 coverage / fairness 軸**：baseline MODQN **塌縮**（shared-Q + per-user-argmax → 全 UE 擠 1 beam → 大多數餓死，min_cov=0）；framework 的**協調式分配 decode** 把 UE 攤開（min_cov≈1.0、active beams 3→12）+ EE 較高。
- **不是 raw scalar 贏**（一個簡單的 DQN_scalar 在加權純量上更高；win 要框在 fairness/coverage + EE，非加權純量）。
- **catfish 是具名核心元件、不是證實的贏因**（A1≈A2；de-collapse 引擎是**分配那步**，不是 catfish）。
- **r1 = angle-aware EE（binding）**。

→ 最有感的視覺（餓死→得救）**剛好等於**最誠實的贏（coverage/fairness）。教學/戲劇性與學術誠實在此**不衝突**。

---

## 3. 可行性判定：可行

**核心洞察（王牌）——決策可因式分解：**
一次換手決策 = 兩段：
1. **狀態 → 每個候選 beam 的三目標估值 Q1/Q2/Q3**：神經網路算的，需要**正確的訓練 env**，**不能**在 leo 現算（leo live env 用 S.672-4，訓練用 J1+J3 → 6–20 dB 漂移 → OOD → 決策變垃圾）。→ **錄一次**即可（producer 在正確 env 跑，存下每候選 Q）。
2. **argmax(ω·Q) 或協調分配 decode → 選中 beam → 換手**：ω 是**網路外**的加權；decode 是**確定性演算法、非神經網路**。→ 前端用 JS **重算**，沒有 OOD 問題。

**∴ 「復現整個換手決策過程」= 重播錄下的 Q + 前端重跑 decode。不用在瀏覽器跑 `.pt`、無 OOD、100% 忠實，而且比 live sim 更強**（live sim 根本沒有「為什麼選這顆」的 Q 推理可展示）。

**根本不可行的只有一件（是物理/ML 限制，不是程式或治理）**：對「網路沒看過的新場景」在瀏覽器現算決策 = live inference in-env = OOD 牆。**但復現決策過程不需要它**——重播 + 重加權 + 重 decode 已足以證明多目標決策。

---

## 4. 現況資料事實（已驗證，供下游 verify）

### 4.1 producer（`modqn-paper-reproduction`）
- 已轉**論文寫作**階段，不再自動產新 artifact；heavy run = HARD go-server gate。
- 決策核心演算法在 `src/modqn_paper_reproduction/route_b_factorial/auction_decode.py` — **148 行、純 numpy、無 torch、per-frame 無跨時刻狀態**。含兩個 decode 同檔、吃**同一份估值 V**：`decode_a0_argmax`（塌縮類）、`decode_af_physical_auction`（de-collapse 類，開 ≤k_cap physical cells、facility-location greedy）。輸入 = (V, slot_cell, l_w, k_cap)。→ **極易移植 TS、可 live 重算**。

### 4.2 權重（`modqn-weights-consolidated`）
- 267 個 `.pt`（按身份分類非品質，塌縮/收斂混放）。**不是 leo 能直接吃的格式。**
- 相關 arm 都在：`route-b/route-b-factorial-2026-06-27`、`coordinated/coordinated-multi-catfish-pilot-2026-06-03`、`baseline/`、`family-b/` 等。

### 4.3 前端能吃的替代品 = `visual-showcase-v1.json`（handoff 契約）
資料流：`modqn-paper-reproduction → visual-showcase-v1.json → validate（ntn-sim-core）→ leo 渲染`。producer 擁有 SINR/handover/action/reward/geometry 真相；leo 只顯示、**禁止**從顯示需求捏造真相。

現存 3 份（**都是塌縮 baseline，換手極少**）：
- `artifacts/visual-showcase-v1-baseline-89s-2026-06-03/`（46MB，90 幀/89s，**僅 1 次 intra 換手**，無 `objectiveQByAction`）
- `artifacts/dense-q-proof-window-600-130/`（26MB，10 幀，2 次 inter 換手；**bundle 的 JSONL 版有 per-action Q，共 1000 列**）
- `artifacts/family-b-baseline-retrain-2026-06-12/seed-42/dense-q-proof-window-600-130/`

### 4.4 leo 現在的 modqn 分頁 wiring（已驗證）
- 預設 = **leo 自己的 live SINR 模擬器套 MODQN 皮**，**不是**逐幀重播錄下的 MODQN 決策；真重播是另一個 opt-in `modqn-replay-proof` lane。
- 錄下的 artifact 只餵**側邊欄**（DecisionViz Q-proof、RewardCurve、ω 滑桿）。
- ω 滑桿被塞在 **Advanced 抽屜**；預設 baseline bundle **無 `objectiveQByAction`** → dense-Q proof fail-close 到 source-gap、ω 重加權跑 inert；載 Family-B dense-Q 才亮。
- **這些全部可改**（使用者已明示：不受現況限制）。

---

## 5. 互動旋鈕分類 + 重錄成本模型

**規則：只有動到「Q 估值」或「場景 state」才要重錄；改 decode 不用重錄**（錄下的 dense-Q 是 decode-無關的）。

| 側欄旋鈕 | 屬於 | 前端能現算新決策? | 重錄? | 需要的資料 |
|---|---|---|---|---|
| ω 三目標權重 | decode 時 | ✅ 真現算 | ❌ | dense 每候選 Q（一份）|
| k_cap 容量 | decode 時 | ✅ 真現算（移植 auction）| ❌ | 同上 |
| **協調 decode on/off**（argmax↔auction）| decode 時 | ✅✅ 一份錄影當場翻 | ❌ | 同上（兩 decode 共用 V）|
| catfish on/off | **訓練**時 | ⚠️ 不能現算 → 換預錄 arm | ✅ 每 arm 一份 | producer rollout+export |
| γ / χ_u / 分層回放 / reward | 訓練時 | ⚠️ 同上 | ✅ 每 arm 一份 | 同上 |
| 移動 UE / 換幾何 | 全新推論 | ❌ OOD 牆 | — | 不行 |

**份數公式**：`份數 = 1（撐所有 decode-time 互動）+ 你要切換的已訓練 arm 數`。

**你改演算法時的重錄觸發**：改 **decode/分配引擎** → 0 重錄（只改 Python + 同步 JS + 重驗）；改 **訓練配方（catfish/γ/reward/arch/env）** → 重錄該 arm（改權重才要 retrain，否則只 rollout+export）；改 **場景** → 重錄（免 retrain）。

---

## 6. 架構選項（decode 怎麼跑）

| 架構 | 你改 decode 要動 | demo 型態 | 適用 |
|---|---|---|---|
| **A. JS 移植**（前端跑 decode）| Python + JS 兩處 + self-check | 純靜態、離線 | **口試定稿**（無 server 可崩）|
| **B. 薄 Python 後端**（前端呼叫真 `auction_decode.py`）| 只 Python 一處 | 要跑 server | **開發期**（單一真相源、零同步稅、免重錄）|
| **C. 預算網格**（ω×k_cap×decode 全匯出查表）| Python + 重跑網格 | 純靜態 | 只需離散值時 |

**建議**：開發期 B（邊調邊看），口試凍成 A（靜態 + self-check + 可處理任意 ω/k_cap 質疑）。互動硬前提 = 錄「**每候選 beam 的三目標 Q + 幾何映射（slot_cell/k grid）**」，**全部候選**（不只選中的）——否則無法重挑，退回純播放。

---

## 7. 視覺／敘事語言（moment-to-moment）

- **殺招：把「贏」編碼成 per-UE 生死** — 有服務=綠/亮/資料流；餓死=紅/暗/⏳buffering。UE 畫成地上小人，頭上 📺/📞，卡住就 buffering（min_cov=0 → 「阿嬤視訊卡住」）。塌縮=紅海+一顆過載燙 beam；框架=紅翻綠+ beam 攤開。**紅海翻綠 = 前語言、瞬間有感，且是誠實的贏。**
- **主角 + 群眾**：spotlight 一個 UE 給故事；100 群眾給規模。
- **換手 = 有頭有尾的事件節拍**（非閃一下）：時間放慢 → 舊鏈枯萎 → 候選浮現發光 → 贏家套光環+margin → 新鏈啪亮 → 恢復；同刻彈「為什麼」面板。**因果：一次換手 → 一個紅點變綠。**
- **toggle-slam（基本↔智慧）= 核心證明**：一個開關 → 整片 UE 場重洗牌（紅→綠 cascade、燙點冷卻、beam 扇開）。order from chaos。技術上 decode 切換一份錄影即可即時重算 → 真資料驅動。
- **指標綁在視覺上**：coverage 條隨紅→綠填滿；fairness = 100 條 per-UE throughput（塌縮=一根尖刺+99 平；框架=均勻）；**數字是字幕、畫面是真相**。
- **EE 誠實搭車**（別當主角）：物理重framing「同功率服務多少人」；秀塌縮的功率浪費。coverage 是視覺主秀。

---

## 8. 教學設計（across-session，layperson）

**最重要原則：先讓人體驗「問題」，再給演算法**（productive failure；先痛過，AI 的修復才有意義；直接交付目標③）。

1. **比喻入門，不用術語**：換手 = 手機在高速公路換基地台（基地台會飛）；塞爆 = 搶座位/擠爆一台公車空車開過；演算法 = 反自私/反塞車的協調者。
2. **三關漸進解鎖**：
   - **L1** 一人一星：連線隨衛星飛走要「跳」= 換手是什麼（目標①）。
   - **L2** 100 人 + 容量，天真搶最強 → 紅海；**讓使用者親手試分配 → 分不動**（目標②鋪陳）。
   - **L3** 開 AI → 紅翻綠（目標②+③）。
3. **殺手玩法「你來當演算法」**：手動把 100 人分到 beam、別塞爆 → 手忙腳亂 → 「換 AI」秒解 → **計分（你的 coverage% vs AI）→ 跟 AI PK**。一個機制教會三件事 + 好玩。
4. **雙層標籤**：預設白話（智慧/基本模式、連線、塞爆、服務到的人）；一個 **🎓 Expert 開關** 掀出真術語（handover/SINR/EE/MODQN/k_cap/協調 decode）→ **一份 build 兩種觀眾**。
5. **引導 → 沙盒**：軌道導覽（旁白/小衛星嚮導，有 rails）跑完解鎖 sandbox + 挑戰任務。
6. **每個 slider = 一個看得見的成敗模式**（decode=chaos↔order；ω=太黏→紅回來；k_cap=韌性壓測；catfish=幾乎沒差＝誠實 ablation）。

---

## 9. 口試模式（在骨架上加嚴謹 + 防呆）

**旋鈕 = 當場反駁引擎**（口試殺招——用「秀」代替「辯」）：

| 委員可能攻 | 當場拖哪個 → 證明 |
|---|---|
| 「只有低容量才有用？」 | 拉 k_cap 掃全程 → 誠實秀 win-zone（k≤~10 CI 分離、高 k 收斂——秀出來別藏）|
| 「不就 reward/catfish 功勞？」 | 切 catfish（幾乎沒變）vs 切 decode（翻）→「引擎是協調 decode」|
| 「真的還是動畫？」 | 開 Expert → 指標 + provenance + self-check（重算出一模一樣的錄下決策 → 沒捏）|
| 「跟 naive baseline 比？」 | 切到 RSS / round-robin / DQN 的錄影 |

**live demo 防呆（demo 一定會出包）**：全部 local + 預載、無 live 訓練/網路依賴（口試用靜態 JS）；排練 2-3 個黃金場景；備錄影 fallback；決定性（錄的資料天生決定性）。

**誠實 = 資產**：把 win-zone、catfish≈沒差做進 demo → 會秀自己極限的 demo = 嚴謹。**demo 演出 RED LINES，不為戲劇違反它們。**

**~5 分鐘敘事弧**：① 標準法塌縮紅海（30s）→ ② 框架同刻紅翻綠（30s）→ ③ live 證：切 catfish(不變)/切 decode(翻)/掃 k_cap(win-zone)/調 ω(權衡)（2-3 分）→ ④ 數字 + provenance（30s）→ 接委員「那如果…」sandbox。

---

## 10. 資料匯出清單（producer 側，排 server）

口試要能「任意質疑 = 一個開關」，故**預先匯出完整 ablation 矩陣**：
- **arms**：baseline(argmax)、framework(auction)、catfish on/off、（可選）RSS / round-robin / DQN_throughput / DQN_scalar。
- **× 一個有明顯換手的好場景**（非塌縮到看不出東西的窗；需含 intra + inter 換手）。
- **× k_cap sweep**（涵蓋 win-zone k≤~10 與高 k 收斂）。
- **每份都要 dense 欄位**：`objectiveQByAction`（全候選、三目標）+ `scalarizedQByAction` + `objectiveWeights` + `candidateActionOrder` + `decisionActionValidityMask` + `selectedActionIndex` + `tieBreak` + 幾何（slot_cell/k grid）+ 逐幀 sat/UE/beam 位置 + SINR + handover 事件。欄位規格見 `docs/handoff/producer-dense-q-export-request.md`。
- **免 retrain**（權重都在；只要 rollout + export）。**唯一 heavy 前置**。

---

## 11. 工程切分（heavy 路由）

- **前端（非 heavy，在 leo）**：把 modqn lane 從 live-sim 皮改成**真 replay-driven 場景** + 決策面板 + 移植 `auction_decode.py`→TS（~148 行）+ self-check + ω/k_cap/decode 三種 slider → 重算 → 紅綠場/換手節拍 + 三關/沙盒/Expert 開關 + 敘事弧。
- **producer（heavy，排 Ubuntu server）**：跑完整 ablation 矩陣 rollout + export（§10）；免 retrain。
- **可能的契約小擴充（producer 端待確認）**：協調 decode 的決策結構 vs 現有 per-user-argmax 的 `decisionFrame`——per-UE 選中 beam + 估值可塞進現有結構，協調性由「UE 分散」整體呈現；要顯式秀容量定價可加一 section（非必須）。

---

## 12. 開放決策（給最終整合對話）

1. **取代 vs 並存**：這是新的體驗層，**不是**現在 thesis 導向的 modqn 分頁——要決定新 sim 取代它、還是並存（舊的留給你/口試、新的給大眾）。
2. **架構相位**：開發期 B（後端）→ 口試 A（靜態）的切換點與凍結時機。
3. **ablation 矩陣範圍**：口試要能切哪幾個 arm（決定要 producer 匯出幾份、server 排程多大）。
4. **場景挑選**：哪一個窗最能同時展示 intra + inter 換手 + 明顯的塌縮→de-collapse 對比。
5. **比喻定案**：手機基地台 / 公車座位 / 其他——挑主比喻。

---

## 13. 一句話收斂

**別秀波束，秀「一群人從餓死到得救」。** 一副骨架、兩種皮：layperson 加鷹架+玩法，口試加嚴謹+provenance+防呆。引擎/場景/旋鈕/資料全共用，**build 一次**。技術可行（重播估值 + 前端重跑 decode，無 OOD），唯一 heavy 前置 = producer 匯出完整 ablation 矩陣（免 retrain）。
