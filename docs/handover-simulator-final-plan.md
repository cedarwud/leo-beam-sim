# 換手教學／口試模擬器 — 最終建置方案

> **狀態**：定案（2026-07-03）；同日使用者已回全部開放問題 → D3/D4/D5/R4/§9/§10 據此更新，排程改 plan-first（P0.5 整頓 → P1 mini-SDD → code）。整合兩份輸入：
> (1) 內部願景報告 [handover-teaching-defense-simulator-vision.md](./handover-teaching-defense-simulator-vision.md)（§12 開放決策在本文件 §1 逐項解掉）；
> (2) 外部 deep research 四份（`dr/fable.md`、`dr/flash.md`、`dr/gpt.md`、`dr/pro.md`，已入 repo）。
> 本文件之後 = 建置期的執行真相來源。誠實 RED LINES（願景報告 §2）全文 binding，此處不重抄。

---

## 0. 一段話

一個頁面、一條 scene lane、一副骨架：**重播錄下的 dense 三目標 Q + 前端 TS 重跑確定性 decode**（argmax ↔ auction、ω、k_cap 全部 decode-time 現算，無 .pt、無 OOD、無 server）。layperson 三關 + 「你來當演算法」在同一份錄影上玩；口試模式 = 同頁開 Expert + provenance + self-check。唯一 heavy 前置 = producer 在 server 匯出「1 個好場景窗 × 4 個 arm」的 dense 矩陣（免 retrain）。前端第一步（decode 移植 + parity gate）**今天就能用現有 artifact 起跑**。

---

## 1. 已解設計決策（願景 §12 → 定案）

### D1. 取代 vs 並存 → **過渡式取代**

新 sim 成為 `modqn-demo` 頁的新預設體驗，**重用（升級）現已 park 的 `modqn-replay-proof` lane** 作為 replay 舞台——不新增 lane、不動 `sinr-experiment` 頁。現行 live-SINR-skin 檢視在開發期經 nav 機制保留可達；sim 通過 `validate:ready` + pixel-verify 且口試素材就緒後，**clean-delete** 舊預設檢視（遵守 clean-delete policy，不留 zombie）。

理由：(a) 報告核心命題 = 一副骨架兩種皮，長期並存兩套 MODQN 體驗自相矛盾、餵 accretion ratchet；(b) nav ≠ lane（ADR-002）使分段切換便宜（park/unpark 是既有機制，硬刪 lane 才貴）；(c) 舊頁的誠實資產（DecisionViz Q-proof、source-gap fail-close、honesty chip、RewardCurve）全數遷入新 sim 的 Expert 層，功能被吸收而非丟失。
**待使用者確認的只有 clean-delete 時點**（建議：P3 完成後，見 §9-Q4）。

### D2. 架構相位 → **跳過 runtime 後端，靜態 A 從第一天開始；Python 只當離線 golden oracle**

願景 §6 建議「開發期 B（薄 Python 後端）→ 口試凍 A（靜態 JS）」。定案改為**不做 runtime B**：

- decode 是**凍結研究真相**（route_b_factorial frozen），不是 leo 端的迭代對象——B 的核心價值（改 decode 免同步）在本案不存在。
- B 的同步保險改由 **parity goldens** 以更低成本取得：Python `auction_decode.py` 離線產 golden fixtures（合成 V + 真實匯出 V），TS 移植必須逐 index 重現 → 新 gate `validate:modqn:decode-parity`。這正是 vendor-on-demand 規則（source-side validator + KPI 不漂移）的 decode 版。
- 口試「無 server 可崩」從第一天成立；「切換點」問題消失。
- **乘數紅利**：replay lane 天生適合 `frameloop="demand"`（互動/scrub 才 render）→ 逃出 live lane 的軟體 WebGL ~9 FPS 天花板（[[project_runtime_perf_software_webgl_2026-06-22]]），這是 live-sim 皮做不到的。

### D3. ablation 矩陣範圍 → **4 份錄影 × 1 個好場景窗**（2026-07-03 使用者定案）

| # | arm | 用途 | 成本 |
|---|---|---|---|
| 1 | **route-b A-column（auction-trained）hero** | 撐全部 decode-time 互動：ω 重加權、k_cap 掃、argmax↔auction counterfactual flip（同一份 V） | rollout+export |
| 2 | route-b B-column（argmax-trained） | 真塌縮 baseline as-trained（回應「你只是在 A 的 Q 上換 decode」） | rollout+export |
| 3 | catfish-off twin（**A1** ⚠️） | 誠實 ablation：切 catfish ≈ 沒差（A1≈A2）、切 decode = 翻 | rollout+export |

> ⚠️ **2026-07-04 H1 更正**：本表原標 arm#3 = 「A2」，但 H1 掃描讀 `run_metadata` 發現 **A2 = catfish-ON（= hero，arm#1）、A1 = catfish-off**。∴ arm#3（catfish-off twin）應鎖 **A1**。不影響 H1 選窗（A1≈A2）。**派 H2 前對 producer `run_metadata` 再驗一次** 才鎖 arm。
| 4 | RSS_max heuristic | naive/論文 benchmark；layperson 的「基本模式」敘事 | 免訓練，最便宜 |

使用者已決：**DQN_scalar 與 round-robin 都不收**。DQN_scalar 降為後補選項（口試風向需要 raw-scalar 現場道具時再 +1 份 rollout+export）；raw-scalar 攻擊改以口頭 + 靜態證據回應（§5 對照表）。

- **k_cap sweep = 0 份額外錄影**：k_cap 是 decode-time → 前端在 hero arm 的 V 上 live 重 decode 即為掃描。win-zone（k≤~10 CI 分離）的統計圖另以**靜態圖資料**從現有 eval JSON 匯出（近乎免費，H3）。
- **誠實標註（binding）**：live k_cap 掃 = *decode-time counterfactual*（同一份估值換分配器容量），**不是** per-k retrain 的 policy。UI 必須如此標示。若委員追問 trained-at-k，`modqn-weights-consolidated/matched-kcap/` 的已訓 arms 可事後加錄（optional 擴充，每 arm +1 份）。
- 份數公式驗證：`1（hero 撐所有 decode-time）+ 3 個切換 arm` ✓（願景 §5）。

### D4. 場景挑選 → **資料驅動兩段式，準則先寫死**

leo 端無法憑空選窗；現存 artifact 全是塌縮少換手窗（且 dense-q window 的 125 次 inter 有 ~80% 是 window-reset 假象——這個坑要明確避開）。定案：

1. **H1 掃描（heavy）**：hero arm eval-only rollout，逐候選窗記錄：intra 數 / inter 數 / argmax-vs-auction 的 served-fraction delta / 是否含 reset-spike / 衛星可視穩定度 → 產 top-3 候選窗報表。
2. **人工挑 1 窗**（使用者 + 我看報表）→ H2 只對選定窗做全 arm dense 匯出。

**選窗準則（寫死，事件數驅動）**：窗內 ≥1 次 intra + ≥3 次 inter；decode 對比 served-fraction 差夠大（紅海→綠有感）；無 window-reset 假換手；k_cap 在窗內掃得出行為差。
**窗長語意（2026-07-03 澄清）**：窗長 = 達成上述事件數所需的「**模擬時鐘**」長度，與 demo 播放時間**完全解耦**——前端可任意加速/減速/scrub/重放同一窗，5 分鐘口試大半時間是旋鈕互動（同窗重算），不是線性播片。窗長上限來自 dense 匯出檔案量（每決策步 ≈ U×A×3 Q + mask + slot_cell）。90–120s（env step ≈1s → ~90–120 決策步）為初始猜測，H1 報表按實際事件密度定案。若掃不到同時滿足的窗 → 備案見 §9-R2。

### D5. 主比喻 → **定案：「基地台」＋「開櫃檯」**（2026-07-03 使用者拍板）

- **場景框架（L1，換手是什麼）＝「基地台」**：大家都懂手機連基地台。「會飛」**不進標籤**——唯一轉折「塔在動、你沒動，所以連線必須跳」由 L1 場景自己演出（衛星可見地飛走、訊號枯萎、跳下一顆）；這個轉折 = 學習目標①，保留在敘事與旁白，不在名稱。telecom 成熟敘事弧（訊號邊緣衰減→切鄰居；dr/fable Area 2）照用。
- **演算法比喻（L2/L3，分配）＝「開櫃檯」**：`decode_af_physical_auction` 字面上就是 facility-location「greedy 開 ≤k_cap 個櫃檯、把人分到開著的櫃檯」——比喻與真演算法 **1:1 對映**（k_cap＝最多開幾個櫃檯；塌縮＝全部人擠一個櫃檯；ω＝店長在乎快、公平還是省電）。比喻不撒謊，Expert 開關掀開時術語能無縫接上。

---

## 2. 架構定案（資料流 + 引擎）

```
producer (server, heavy, 免retrain)
  route-b arms rollout ──► dense export（§4 契約）
        │  visual-showcase-v1.json + step-trace.jsonl
        ▼
  ntn-sim-core: npm run validate:visual-showcase:artifact ✔
        ▼
leo（靜態，無 server）
  loader ──► 錄下真相（immutable）: 幾何/SINR/HO事件/V=objectiveQByAction/mask/slot_cell/selected
        │
        ├─► replay 舞台（modqn-replay-proof lane, frameloop=demand）
        │     紅綠 UE 場 + 波束 + 換手節拍 + 主角 spotlight
        │
        └─► TS decode 引擎（auction_decode.py 移植，148行 numpy → ~200行 TS）
              ω / k_cap / argmax↔auction → 全窗重算 → 差異上色 + 指標
              ▲ self-check：預設 ω/decode 重算 == 錄下 selectedActionIndex（fail-close）
              ▲ parity：validate:modqn:decode-parity（Python goldens 逐 index 相等）
```

- **display ≠ truth 邊界**：loader 輸出唯讀；decode 引擎只產生「counterfactual 圖層」，永不回寫錄下真相；重算結果與錄下決策不同時，UI 明示「你的加權 vs 錄下決策」。
- **移植注意**：`auction_decode.py` 的 `l_of_a = a // 7`（每 slot 7 beams）與 `shift_to_nonneg` 的 per-user row-min 外部選項、tol 規則，必須逐行帶到 TS 並被 parity fixtures 覆蓋（含負 Q、全 -inf 行、tie 案例）。beams-per-slot 由匯出參數帶入、預設鎖 7。

---

## 3. 分相位建置計畫（每項標 heavy / 非 heavy）

前端相位 = 非 heavy（leo、WSL 本機）；H 相位 = **heavy（排 Ubuntu server）**。一相位一關注點、一 PR；P2 起每相位過對應 gate（見 frontend-change-contract 的 gate map）。

| 相位 | 內容 | 依賴 | Gate |
|---|---|---|---|
| **P0** 資產落地（非 heavy，✅done） | commit `dr/` 四份 + 本方案（此環境會吃 untracked 檔） | — | pre-commit |
| **P0.5** 開跑前整頓 pre-flight（非 heavy，**P1 之前**） | (a) 收債：footprint-hex WIP `8e4e1e7` 的 :3000 pixel-verify（紅綠場 legibility 地基，P2 不疊在未驗景上）；(b) gate 基線：跑一次 `validate:governance:full` + `validate:static:all`，記錄現存紅（quarantine/已知 deferred 之外的 rot 先修）；(c) 清過期 `scripts/_shot-*` 探針。**明確不做**：App.tsx 拆分、broad Phase B spec 遷移、SCSS 大掃——大掃除先行 = 已知失敗模式（4 次合併嘗試停在 planning），治理靠 per-commit gate 維持 | P0 | governance:full + static:all 基線報告 |
| **P1** decode 引擎（非 heavy；P0.5 後，**先交 mini-SDD 過目再 code**——plan-first） | `valuation / decode_a0_argmax / decode_af_physical_auction / column_greedy_decode` → `src/modqn/decode/`（純 TS、無 render）；fixtures：(a) 現有 `dense-q-proof-window-600-130`（已驗含全 28-action 3-目標 dense Q + mask + tieBreak）跑 1000 列 argmax self-check；(b) 本機 python 執行 producer 的 decode 產 auction goldens（合成 V + 邊界案例；秒級、只 import 不改 producer） | — | 新 `validate:modqn:decode-parity`（進 static:all 自發現名冊） |
| **P2** replay 舞台（非 heavy，structural） | 升級 parked `modqn-replay-proof` lane：逐幀重播（instanced 紅/綠 UE 點、波束錐、hex、DOM 標籤上限=主角+鄰近數個）；`frameloop=demand`；先用現有（無聊的）窗開發 | P1 | **contract 全流程**：worktree dispatch + `validate:ready`；flag budget＝重用該 lane 既有 flags |
| **P3** 旋鈕 + 證明面板（非 heavy） | ω×3 / k_cap / decode 開關 → P1 引擎全窗重算 → toggle-slam（紅→綠分批 cascade）＋覆蓋條/公平條；**self-check chip**（重算==錄下 ✓）+ **provenance chip** + 重掛誠實揭露 chip（[[project_modqn_one_page_consolidation_2026-06-15]] 的 OPEN OBLIGATION 在此清償） | P1+P2 | validate:ready |
| **P4** 換手事件節拍（非 heavy） | 時間軸換手標記 track（重用已保留的 top track）、慢動作 scrub、「為什麼」面板（該刻各候選 Q1/Q2/Q3 對比）、主角 UE spotlight（順收 W8 debt） | P2 | validate:ready |
| **P5** 教學層（非 heavy） | L1/L2/L3 漸進解鎖 + 「你來當演算法」（凍幀手動指派、用**同一份錄下 V** 誠實計分 vs AI）+ 雙層標籤（白話預設、🎓Expert 掀術語）+ 導覽→沙盒 | P3+P4 + H2 資料 | validate:ready + 真人試玩 |
| **P6** 口試硬化（非 heavy） | golden 場景預載、`vite build` 靜態離線驗證、備援錄影錄製、彩排 checklist、Expert 直達 URL、Visibility API 暫停 | P3–P5 + H2 | validate:ready + 口試機實測 |
| **H1** 場景掃描（**heavy**，est. 數小時） | §1-D4 的掃描 job：hero arm eval rollout + 逐窗統計 → top-3 報表 | 無（可與 P1 平行） | producer 側 |
| **H2** dense ablation 匯出（**heavy**，est. 數小時–半天） | 選定窗 × 4 arms × §4 欄位 → visual-showcase-v1 + JSONL；ntn-sim-core validator 過 + export self-check（argmax 重現 selected） | H1 + 選窗 | ntn-sim-core validate + leo P1 parity |
| **H3** win-zone 圖資料（borderline，可搭 H2 順跑） | 現有 eval JSON → k_cap CI 圖靜態資料 | — | — |

**Heavy 路由（global 規則）**：H1/H2 dispatch 時的 worker prompt 需前綴 server 建議（SSH 至 Ubuntu server、sync producer repo + weights、確認 Python env、開 worker session、貼 prompt；est. wall 見上表）。P1–P6 全部留在本環境。
**關鍵路徑**：P1→P2→P3 用現有資料即可完成骨架；H1‖P1 平行開跑；H2 資料落地後 P2–P4 只換資料來源、P5/P6 收尾。前端從不被 heavy 阻塞。

---

## 4. 資料匯出清單（producer 側規格；擴充自 `docs/handoff/producer-dense-q-export-request.md`）

**沿用既有契約**（該文件全部欄位 + 4 條 hard acceptance + axis rule 不變）：`candidateActionOrder` / `decisionActionValidityMask` / `objectiveQByAction`（全候選×3 目標）/ `scalarizedQByAction` / `objectiveWeights` / `selectedActionIndex` / `tieBreak` / `invalidActionSentinel`。

**本案新增（auction 重跑必需 — 沒有這些前端只能重跑 argmax）**：

| 欄位 | 形狀 | 用途 |
|---|---|---|
| `slotCell` | `U×A` int | 每 (user, action) 的 physical cell id（`decode_af` 的 `slot_cell`） |
| `decodeParams` | `{lW, kCap, gridCount, beamsPerSlot:7, shiftToNonneg}` | decode 引擎常數（該 arm 訓練/eval 實際值） |
| `decodeKind` | `'argmax' \| 'auction'` | 該 arm 錄影時的 decode（self-check 用對的路徑） |
| `auctionAudit` | `{nFallback, openedPerSlot[], demandedPerSlot[]}` | auction 路徑 self-check（TS 重跑須重現 opened 集合） |

**場景欄位（每幀，紅綠場 + 節拍 + EE 搭車）**：sat 位置、beam 幾何（center/halfAngle/footprint，含 displayOnly provenance，同現有 Family-B 樣式）、UE 位置、per-UE served/starved + throughput、SINR、handover 事件（intra/inter、from→to、幀號）、per-sat 功率/EE、coverage/fairness 序列。

**Provenance（每份）**：arm id + weights 路徑 + env config hash + seed + 窗 id + export self-check 結果。

**矩陣**：§1-D3 的 4 arms × H1 選定窗 × 全欄位。**免 retrain**（權重都在 `modqn-weights-consolidated/route-b/` 等）。
**大小預算**：對照現有 26MB/10 幀窗，估每份 30–80MB（U=100、A≈28–144、60–120s）→ 4 份 ≈ 120–320MB；靜態離線可行，選擇性載入 + gzip；若爆量再議 binary 欄位（開發後期才處理，不前置優化）。
**先跑 1-slot smoke**：H2 正式跑前先出 1 個 slot 的小樣本給 leo 驗 parity + loader，再全量（防契約來回）。

---

## 5. 口試 runbook（~5 分鐘敘事弧 + 反駁引擎）

### 敘事弧

| 時間 | 節拍 | 操作 |
|---|---|---|
| 0:00–0:30 | ① 標準法塌縮 | 載 hero 窗、decode=argmax：紅海 + 一顆過載燙 beam；覆蓋條低垂 |
| 0:30–1:00 | ② 同刻翻綠 | **toggle-slam** → auction：紅→綠 cascade、beam 扇開、覆蓋條填滿——「同一份估值，只換分配那一步」 |
| 1:00–3:30 | ③ live 三連證 | 切 catfish arm（幾乎沒變）→ 切回 decode 開關（翻）＝「引擎是協調 decode」；k_cap 掃全程（誠實秀 win-zone k≤~10 分離、高 k 收斂 + H3 CI 圖）；拖 ω（權衡當場翻，紅點回來→再救回） |
| 3:30–4:00 | ④ 數字 + provenance | 開 Expert：min_cov、active beams 3→12、EE、Lorenz；self-check chip（前端重算==錄下決策 ✓）+ 資料 provenance |
| 4:00– | ⑤ 委員 sandbox | 「那如果…」→ 對照表出招 |

### 委員攻擊 → 旋鈕對照表

| 攻擊 | 當場動作 → 證明 |
|---|---|
| 「只有低容量才有用？」 | k_cap live 掃 + CI 圖：誠實秀 win-zone 與高 k 收斂，不藏 |
| 「不就 catfish/reward 的功勞？」 | 切 catfish arm ≈ 沒變；切 decode = 翻 → 引擎是協調分配那步（A1≈A2） |
| 「這是動畫還是真的？」 | Expert：self-check chip（TS 重算 argmax(ω·Q) == 錄下 selectedActionIndex，全窗逐幀）+ provenance + 指到 JSONL 列 |
| 「跟 naive baseline 比呢？」 | 切 RSS_max 錄影 |
| 「別人加權純量更高？」 | 口頭 + 靜態證據（論文表格/圖）：raw scalar 確實有簡單 DQN 更高——win 框在 coverage/fairness + EE，畫面當場證明（RED LINE 正面演出）。若口試風向需要現場道具，DQN_scalar 錄影列後補（§1-D3） |
| 「挑過場景吧？」 | 秀 H1 掃描報表（選窗準則 + 全窗統計），窗不是手挑孤例 |
| 「換個場景/加倍用戶再跑？」 | 誠實邊界：live 換場景 = OOD（訓練 env 與瀏覽器 env 天線模型 6–20dB 漂移）→ 解釋決策因式分解：估值錄一次、分配當場重跑；「重跑分配」我做給你看，「現場重新推論」任何人做了都是不誠實的 demo |
| 「ω 是不是 cherry-picked？」 | 拖壞它：把 fairness 權重拉到 0 → 紅點回來；拉回 → 救回。權衡透明可操作 |

### 防呆 checklist（口試前）

排練用**口試同一台機器**（GPU 有無先驗明，§9-Q2）→ 彩排後凍結系統（不更新）→ `vite build` 靜態、斷網驗證、全資料 preload → 備援：全程錄影 + click-through 截圖 deck + 第二台設備 → pivot 台詞演練（「我直接放錄好的版本」）→ 決定性驗證：同操作序列兩次重放結果 bit 一致（錄影天生決定性；唯一隨機源=UI 動畫，不入真相）。

---

## 6. Layperson 流程（三關 + PK + Expert）

**敘事骨架用 BUT/THEREFORE 串**（dr/fable：Nicky Case 規則）：「大家都連最強的那顆 **但** 那顆塞爆 **所以** 後面的人餓死 **但** 聰明系統多開幾個櫃檯分流 **所以** 人人有位子。」

- **L1 一人一星（換手是什麼）**：主角 UE + 單顆衛星，鏡頭跟星。基地台飛走 → 訊號枯萎 → 跳到下一顆（慢動作節拍 + 白話「為什麼跳」）。完成一次跳 = 解鎖 L2（gating＝動機，不是懲罰）。
- **L2 100 人 + 容量（問題）**：群眾出現，天真搶最強 → 紅海。**「你來當演算法」**：凍結一幀，玩家手動把人指派到 beam（容量看得見地爆掉）→ 手忙腳亂 → 計分（你的 coverage% / 公平）。失敗畫面**不是 Game Over**，是錯誤精確化：「這顆 beam 擠了 41 人，容量 k=…，這 15 人因此餓死」（productive failure + 元認知回饋，dr/flash/pro）。
- **L3 開 AI（解答）**：「換 AI 做」→ 同一幀秒解 → 你 vs AI 比分 → toggle-slam 全窗紅翻綠。之後解鎖 sandbox（全部旋鈕）+ 挑戰任務（「把 k_cap 降到 5 還能救活幾個人？」）。
- **雙層標籤**：預設白話（智慧/基本模式、塞爆、服務到的人、開幾個櫃檯）；🎓 Expert 掀出 handover/SINR/EE/MODQN/k_cap/coordinated decode + Lorenz/Jain。**一份 build 兩種觀眾**；口試 = Expert 預設開 + 跳導覽（URL 參數）。
- **誠實計分**：L2 玩家指派用**同一份錄下 V** 評分（與 AI 同一把尺）——比喻性玩法也不脫離真資料。

視覺鐵律（dr 四份共識）：贏 = **每個點同時變綠**，數字是字幕；fairness 標量不當主角（Jain 對尾部餓死不敏感——Expert 層用 Lorenz/per-UE 100 條，dr/pro 的矛盾警示）；動畫 toggle 給情感衝擊 + 並排靜態對比給委員分析（animation vs small-multiples 研究，dr/fable Area 4）。

---

## 7. Wireframe + scene-lane plan

```
┌──────────────────────────────────────────────────────────────────┐
│ [基本 argmax ⇄ 智慧 auction]   覆蓋 ▓▓▓▓░░ 62%   arm: hero ▾  🎓 │
├─────────────────────────────────────────────┬────────────────────┤
│                                             │ 決策面板            │
│   3D replay 舞台（modqn-replay-proof lane）  │ 「為什麼選這顆」     │
│   衛星 + 波束錐 + hex 格                     │  Q1/Q2/Q3 橫條×候選 │
│   100 UE 紅/綠 instanced 點                  │ ω 滑桿 ×3          │
│   主角 UE spotlight + DOM 標籤(≤5個)          │ k_cap 滑桿 [3..28] │
│   （慢動作時：舊鏈枯萎→候選發光→新鏈亮）        │ ✓self-check chip   │
│                                             │ ⓘprovenance chip   │
├─────────────────────────────────────────────┴────────────────────┤
│ 時間軸 ──●────▲──▲───────▲──── (▲=換手標記; 點▲=慢動作事件節拍)      │
└──────────────────────────────────────────────────────────────────┘
 🎓Expert 掀開：Lorenz 曲線 / per-UE 100 條 throughput / JSONL 列號 /
 k_cap win-zone CI 圖 / RewardCurve（訓練佐證，自舊頁遷入）
```

- **Lane 決策**：整個 sim（L1–L3、sandbox、口試）跑**同一條 `modqn-replay-proof` lane**——L1/L2/L3 是同一份錄影的**呈現層漸進解鎖**（圖層 gating），不是換 lane、不是另建 live 玩具 sim。單 lane = 治理最省（one frame one lane 天然成立）+ 每個畫面都資料背書。`sinr-live` / `modqn-live-cell-preview` 不動。
- **Flag budget**：優先重用該 lane 既有 render-plan flags；新增圖層（紅綠 UE 場、why-panel、cascade）逐個對 flag budget 記帳（contract Rule 5）。
- **Perf 策略**（軟體 WebGL ~9 FPS 前提）：`frameloop=demand`（scrub/旋鈕才 render）；UE 場 = 單一 InstancedMesh + unlit material（fill-rate 優先於 draw-call，dr/fable Area 7）；文字/HUD 全 DOM overlay；標籤上限主角+鄰近；toggle-slam cascade 做**分批離散翻色**（每批一次 invalidate），不做 60fps 平滑補間；useFrame 內零配置（無 new Vector3）；Visibility API 暫停。

---

## 8. 外部研究 → 設計對照（摘要）

| 設計點 | 依據（dr/） |
|---|---|
| 紅綠點場 = 主要「aha」，數字降為字幕 | fable Area 4（unit chart + 動畫遷移；Jain 不當主角）、pro §4（Lorenz 矛盾警示、不平等摩天大樓） |
| 你來當演算法（先失敗再教） | fable Area 5（Kapur RCT, η²=.44）、flash §5（兩階段 + 元認知回饋）、gpt §5 |
| 一關一個新 wrinkle、curated 順序、gating | fable（Zachtronics 案例研究、Nicky Case gating） |
| 慢動作換手節拍 + 時間 scrub | fable（Bret Victor control-time）、gpt §7 |
| ω/k_cap 反事實滑桿 = 教學工具 + 口試反駁引擎 | fable Area 3（What-If Tool；Olson et al. 反事實助非專家辨識 agent 的實證）、pro §3（COViz 並排） |
| 口試防呆（彩排凍結、備援影片、pivot 台詞、決定性 seed） | fable Area 6、pro §6（CHI demo 規範：≤5min walkthrough video）、gpt §6 |
| demand 渲染、DPR=1、無 AA、unlit、DOM overlay、標籤上限 | fable Area 7 + 本 repo 實測 memory（3.5→9.2 FPS） |
| InstancedMesh 陷阱（低端反慢，量測為準）、useFrame 零配置、Visibility 暫停 | pro §7、flash §7/§10 |
| Canvas-2D 備援問題（Chrome 移除 SwiftShader fallback） | fable Area 7 →本案列 §9-R4 開放問題，先驗口試機再決定 |
| beam 足跡/容量視覺先前技術（starlink.sx、H3 格） | fable Area 8、pro §8 |

---

## 9. 風險 + 開放問題

### 風險

- **R1 匯出契約增補**（`slotCell`/`decodeParams`/`auctionAudit`）需 producer 確認 rollout 時可得（理應是 decode 的現成輸入）。緩解：H2 前先 1-slot smoke（§4）。
- **R2 掃不到理想窗**（intra+inter+對比同窗）。緩解：放寬窗長／兩窗分工（一窗講換手、一窗講 de-collapse）／inter 豐 intra 少時由 sinr-live 頁誠實分工講 intra。
- **R3 toggle-slam 在 9 FPS 下不順**。緩解：§7 的分批離散 cascade + demand 渲染；動畫期間可臨時降 dpr<1。
- **R4 口試機硬體 → 已解（2026-07-03）**：口試機 = 使用者自己的筆電、**有 GPU** → Canvas-2D 備援**不做**。改列一項 P6 小工作：runtime GPU 偵測自適應品質（無 GPU dev 盒維持 demand+unlit+dpr1 現況；GPU 筆電可回開 AA/shadows 較豐富外觀），並在該筆電上彩排。備援錄影照舊（便宜保險）。
- **R5 檔案量**（~150–400MB）：選擇性載入 + gzip；夠用就不做 binary。
- **R6 k_cap counterfactual 被誤讀成 retrained**：UI 誠實標註（D3）；必要時加錄 matched-kcap arms。
- **R7 治理稅**：P2 是 structural lane 升級，validators 會動——照 contract 走（worktree dispatch、invariant-pin 不 source-pin、flag budget、validate:ready 貼證）。

### 使用者已決（2026-07-03 回覆，全部有答案）

- **Q1** 比喻 = 「**基地台**」+「開櫃檯」；「會飛」不進標籤，L1 場景自己演出「塔在動、你沒動」轉折（見 §1-D5）。
- **Q2** 口試機 = 自己筆電、有 GPU → R4 已解（見上）。
- **Q3** DQN_scalar 與 round-robin **都不收** → arms = 4 份；DQN_scalar 列後補選項（§1-D3）。
- **Q4** 舊檢視 clean-delete = P3 過 validate:ready 後（照建議）。
- **Q5** 澄清後定案：窗長 = 模擬時鐘、與播放解耦；實際窗長由**事件密度 + 檔案量**決定、H1 報表定案（見 §1-D4）。
- **Q6** L2 = 凍結錄影幀 + 錄下 V 計分（照建議）。
- 排程偏好：**plan-first**（P1 先交 mini-SDD 過目）+ 開跑前先做 **P0.5 整頓 pre-flight**（§3）。

---

## 10. 下一步（2026-07-03 使用者回覆後更新）

1. ~~使用者回 Q1–Q6~~ ✅ 已回（§9）；排程改 plan-first + 先整頓。
2. **P0.5 pre-flight**（§3）：footprint-hex pixel-verify 收債 → gates 基線（governance:full + static:all，記錄/修 rot）→ 清過期 `_shot-*` 探針。
3. **P1 mini-SDD**：`docs/handover-simulator-p1-decode-port-sdd.md` — 模組佈局、fixture 矩陣（`a//7`、`shift_to_nonneg` per-user row-min、tol、tie、全-invalid 列等邊界案例）、parity gate 規格、驗收準則 → **使用者過目後才 code**。
4. 起草 **H1 worker prompt**（heavy 標記 + server 路由前綴：SSH、sync repo+weights、Python env、est. wall），交使用者擇時派發；H2 prompt 待選窗後出。
5. P2 前重讀 `docs/frontend-change-contract.md` 走全套（本文件 §3 已按其 gate map 排程）。
