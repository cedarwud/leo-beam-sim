# C-120 LEO 能源決策課程｜Phase 0 九頁架構

Status：**OWNER-REVIEW／PHASE-0 OUTLINE ONLY**

Scope：**恰好 9 頁**；第 1 頁為完整課程總覽，第 2–9 頁各對應一個課程段落。

Stop rule：本檔只定義 outline architecture；owner 未接受前，不延伸為 full deck、
實作、截圖、KPI 或課堂 ready claim。

## 1. 現行權威與不可越過的界線

本檔按四份現行內容輸入重組，並以一份 canonical EE authority 作交叉檢查；不把
歷史材料當成第二套 requirements：

1. `/home/u24/leo-satcom-lab/.scratch/90min-satellite-course/CURRENT-C120-HANDOFF.md`：
   交付入口、exact-120、受眾、Workbook 與 claim ceiling。
2. `/home/u24/leo-satcom-lab/.scratch/90min-satellite-course/issues/11-120min-energy-first-curriculum-reset.md`：
   `C-120-ENERGY-DECISION-1R` 的 learner question、段落操作、protected timing、
   evidence floor、recovery、Lab C storyboard 與 stop gates。
3. `/home/u24/leo-satcom-lab/contracts/angle-aware-ee-v1/README.md`：
   唯一 canonical EE chain、欄位分離與 parity／runtime／browser／classroom claim
   boundary；不在課程或投影片重寫公式。
4. `/home/u24/papers/platform/intro.md`：
   競賽的智慧節能與 IoT 應用 framing；學生以資料分析／預測形成智慧控制，不以衛星
   專業考核為目的。
5. `/home/u24/papers/modqn-paper-reproduction/docs/ADR-003-canonical-ee-closure.md`：
   只交叉檢查 canonical EE 科學邊界；不把簡報改成 MODQN、訓練、校準或 ADR 報告，
   也不修改該 repository。

### 語義標記

- **SOURCE-REQUIRED MECHANICS**：現行 authority 明定、後續頁面不可刪除的 learner
  action、資料欄位、時序或 recovery seam。
- **FACT**：可由 authority 直接支持的定義或 claim boundary，不代表課堂已驗證。
- **DESIGN INFERENCE**：本 Phase 0 為可讀性與版面提出的設計推論，不是文獻或教室
  證據。
- **UNKNOWN**：必須由後續 runtime、browser、3–5 位 novice 逐人 walkthrough 或
  20-seat rehearsal 驗證的事項。

### OWNER-REVIEW DESIGN RESOLUTION（不是 source FACT）

以下五項是為了讓九頁 architecture 可執行而提出的版面／順序決定，均不把尚未驗證的
教學效果升格為事實；owner 接受 full deck 前仍可改寫，但不得改動八段總分鐘數：

1. 開場先呈現一個具體 mission consequence（例如 urgent update 漏 deadline 即
   `service_pass=fail`），再進入 vote／claim-card verdict／mission contract／reveal／
   revise；這是把主張放回後果中的設計解析，不是新增第九段。
2. TLE 圖必須顯示同一 `scenario_id` 產生的 contact window 如何限制 legal／illegal
   send-wait interval；若只畫衛星移動而沒有這個 gate，TLE 會降為裝飾性 onboarding。
3. Lab B 的 switch count 只作 policy evidence；能量因果線固定寫成
   `link choice → active time／service → consumed J`，不暗示每次 switch 另有已建模的
   handover-event energy。
4. Lab C 的 source table 把 `6+10+5+2` 的 5 分鐘標成 debrief、詳細 storyboard 則把
   5 分鐘用於 revision／withheld、2 分鐘用於 debrief。本檔先採後者以保住 hidden
   decision loop，並把兩者衝突留在 owner gate；總計仍是 23 分鐘，並非新增時間。
5. Clinic 的 14 分鐘 default core 收斂為「一個連貫 borderline case → 兩個合法 action
   → held-out replay → claim」；其餘 feature cards 只作 optional／fast branch。Transfer
   不只搬 tokens，而要顯式完成 `available data／time → control → service → P×time → J
   → measurement window／falsifier`。

## 2. 全課主線與固定資料骨架

```text
00–10 開場判讀
      ↓
10–18 TLE-to-NTPU anchor
      ↓
18–41 Lab A：pace／power-time
      ↓
41–64 Lab B：dynamic policy
      ↓
64–69 recovery reset
      ↓
69–92 Lab C：budgeted schedule
      ↓
92–106 evidence clinic
      ↓
106–120 competition transfer／exit
      ╰──────────────→ 同一 Energy Decision Workbook（可重新開啟）
```

固定時鐘為：`10 + 8 + 23 + 23 + 5 + 23 + 14 + 14 = 120` 分鐘。每位學生一人一機，
以 LEO 作為移動服務窗口的索引，親自完成 TLE-to-NTPU journey、三個不同機制的 full
labs、prediction/control evidence clinic 與累積式 competition transfer。LEO 數值只在
明示的 simulated teaching boundary 內支持判斷，不外推為真實衛星、whole-satellite、
wall-plug 或已校準效能。

同一 `scenario_id` 必須被 Lab A、Lab B、Lab C、clinic 與 Workbook 消費；fallback 也
保留相同 identity 並明示 `source_mode=fallback`。學生的 candidate、rule、schedule、
feature/action 都必須成為下一次 replay 的 authoritative input；只記錄選擇、換動畫或
預載答案不算 agency。

固定的能源敘事是：`W`（瞬時功率）→ `J`（累積能量）→ `bit/s`（速率）→ 在同一
boundary／time domain 下的 canonical `delivered bits / consumed J`（bit/J）。
`service_pass`、freshness、deadline、consumed J、energy budget、delivered bits、active
time、W、bit/s 與 bit/J 各自呈現，不建立 `service/J`、`value/J`、`qualified updates/J`、
`q` 或 `kappa` 等第二個 headline metric。

## 3. 九頁的 diagram-led architecture

### Middle-canvas-first authoring resolution（OWNER-REVIEW）

edu master 的有效設計畫布是 `x=0.718–13.004 in、y=1.05–6.627 in`，不是可任意縮放的
全頁白板。先前把全頁構圖直接壓進此範圍，造成重複橫列、字級過小與視覺同質化；該方案
已被 owner 明確否決。本版因此採以下固定原則：

- 每頁只保留一個 dominant operation diagram、一條 evidence／meaning／recovery 路徑與底部
  `FACT／DESIGN INFERENCE／UNKNOWN` boundary；claim boundary 改成不帶底色的大字串導軌，
  不再使用三個大型 footer boxes 或三列 claim band。
- 版面差異由活動機制決定：claim adjudication、lineage gate、power-time footprints、two-trace
  replay、recovery chain、schedule board、timestamp case、transfer chain 各自使用不同圖形語法。
- 色彩以藍綠＝資料／服務、灰藍＝時間／狀態、紫＝設計推論為主；低彩珊瑚只用於決策分支、
  leakage 或 UNKNOWN，金色只作 decision/checkpoint marker。沒有亮橘色實心框，也沒有
  author-defined 全頁背景；edu 的深靛標題、白底、logo、divider 與 footer 不改動。
- PptxGenJS 採絕對座標，不會因 master 加入保護區而自動 reflow；因此本版的修正是刪減內容
  層級與重新構圖，不是縮小原版。owner 已授權解除 author text floor，但主體仍優先使用
  14–22 pt 的可讀階層；低於原 24 pt floor 的文字只出現在 supporting labels／claim footer，
  不作為繼續塞內容的理由。

### 第一版 visual donor 的採用界線（OWNER-REVIEW）

owner 指定比較的第一版已定位到
`/home/u24/leo-satcom-lab/.scratch/90min-satellite-course/archive/deck/phase-0-architecture/`
及其 `build_phase0.js`。本版只借用其視覺語法：彩色 stage／metric chips、route arrows、
局部 navy decision hub、mission cards、replay traces、rule board 與 transfer chain；不帶回
90 分鐘路線、conditional E3、C-90 claim 或該 builder 的 source semantics。

PptxGenJS 與 `pptx-wrap` 不是視覺單調的根因：第一版與本版均由 PptxGenJS authoring；
`pptx-wrap` 在此只解析 edu master、safe bounds、fonts、protected zones 與 managed runtime。
先前變得枯燥，是把八個不同活動轉成同一組大橫框／同一 footer boxes，並把全頁構圖縮進
中間安全區。本版改為 snake route、claim adjudication、lineage gate、power-time footprints、
beam decision＋two-trace replay、recovery fork、local navy task board、timestamp case 與
U-shaped transfer chain，讓活動機制決定版面。

### Slide 1｜一條 120 分鐘能源決策路線（00–120）

**主問題**：一條決策線如何從單位與服務條件，走到可移轉的競賽假說？

**圖解語法：2×4 route grid＋兩條全課約束帶**。公式與
`energy-first → LEO-as-index → 同一份 Energy Decision Workbook` 先成為唯一主標線；八段以
兩列四站呈現分鐘數與活動名稱。下方只保留 `MISSION CONTRACT` 與「不同量不能互相代換」
兩個大區塊，再單列完整 simulated-data ceiling；不在同頁重複八段的問題、操作與證據細節。

**SOURCE-REQUIRED MECHANICS**

- 八個站點與完整時鐘必須同時可讀：開場 10、TLE 8、A 23、B 23、recovery 5、C 23、
  clinic 14、transfer 14；不以安裝、等待或講稿填補。
- 主線是 energy-first；每位學生最後留下同一份可 reopen 的 Workbook，最多八個
  constructed responses，其餘選擇、runs、units 與結果自動保存。
- 頁面只作完整 outline；不能暗示 production simulator 或 classroom acceptance。

**FACT**：W／J 不可互換；canonical headline metric 是同一時間域與 boundary 下的
`delivered bits / consumed J`，而平台目的為資料分析／預測後形成智慧節能或 IoT 控制。

**DESIGN INFERENCE**：以公式、Workbook 主線與 2×4 route grid 建立單一路徑，讓八段看起來
是同一條可追溯的學習迴路，而非八個獨立小活動。

**UNKNOWN**：route map、單位帶與 claim ceiling 在原尺寸投影上的可讀性、視覺接受度與
實際 active time 尚未驗證。

**頁面底線**：頁尾固定標示「模擬教學資料、非即時、非量測、尚未通過 canonical parity
驗證。」；沒有 simulator evidence 時不放 screenshots、KPI 或「已可操作」畫面。

### Slide 2｜開場：把能源主張變成可比較的 mission contract（00–10）

**主問題**：「平均 W 較低、完成較快、bit/J 較高但漏 deadline，哪個主張目前可判讀？」

**圖解語法：mission-contract gate＋三列 claim adjudication board**。左側鎖定 payload、
deadline、idle／wakeup boundary、units／time window；右側把三個主張並列為「待判主張／
揭露後看／A-Q-R verdict＋confidence」。底部只留一次
`初判 → 鎖定條件 → 揭露 J／時間／服務 → 只改判一次`，不把開場畫成 Lab A 的策略 replay：

```text
mission contract gate → A／B／C claim board → reveal J／時間／服務
                     → accept／qualify／reject＋confidence → one rejudgment
```

**SOURCE-REQUIRED MECHANICS**

- `vote → sort → mission contract → reveal → revise` 五拍不可省；結果前保存 initial
  prediction，結果揭露後只允許改判一次。
- 從有限且預先核准的 payload、deadline、idle／wakeup boundary 選 mission contract；
  不公平比較要標為 `INCOMPARABLE`，不能靠降低服務要求製造 saving。
- claim card 只要求 `accept／qualify／reject`、confidence 與一句 short-clause；
  系統自動留下數值與欄位，不把開場變成長篇書寫。

**FACT**：W 是能量變化速率，J 是一段時間的累積量；高 bit/J 不會自動覆蓋服務或
deadline 失敗。這一頁只判斷主張是否可比較，不先宣布 Lab A 的策略 winner。

**DESIGN INFERENCE**：以「合約 gate → 三列主張 → 判決／信心」左右分區，讓學生先判可比性，
再進入一次 reveal／revise；10 分鐘內的內部分配仍是設計假說。

**OWNER-REVIEW DESIGN RESOLUTION**：先用一個具體 service consequence 使 mission contract
有立即代價，再揭露 claim-card 結果；這是開場敘事的順序選擇，不是 source 已證明的動機
提升方法。

**UNKNOWN**：新手能否在一輪中分辨 W、J、服務門檻與 boundary；各卡的語句、story stakes
與 10 分鐘理解品質尚未 novice-timed。

### Slide 3｜TLE-to-NTPU data anchor：source 不是 energy truth（10–18）

**主問題**：「NTPU 畫面的移動與 service window，哪一段是 source、哪一段是模型產物、
哪一段是課程假設？」

**圖解語法：lineage river／單一 identity 分流＋interval gate**。一條由左至右的資料河流
只允許三段，並在 service window 後加上可檢查的 send-wait gate：

```text
pinned TLE source → model-derived NTPU service window → course-added traffic／power assumption
                              │
                              └→ legal／illegal send-wait interval
       └──────────── same versioned scenario_id ────────────→ Lab A → Lab B → Lab C → clinic → Workbook
```

**SOURCE-REQUIRED MECHANICS**

- 每位學生操作同一份 offline pinned TLE，依序檢視 friendly source、target UTC、
  model-derived state 與 NTPU visibility；不是下載、上傳或手算 SGP4。
- 學生只做 source／window／assumption selection；不要求記憶 frame、TEME 或推導，
  但 lineage 與 `scenario_id` 自動寫入 Workbook。
- TLE 不含 power、traffic、handover 或 energy；同一 scenario 必須延續到四個後續
  evidence surface。若走 identical fallback，保留 identity 並標記 `source_mode`。
- interval gate 必須讓學生看見同一 contact window 如何使某一 send／wait interval
  legal 或 illegal；違反 deadline／window 的動作要立即回饋，不能只在後續結果中暗示。

**FACT**：TLE-to-NTPU journey 的角色是提供會移動的 service window；不能把模型輸出
冒充量測真值，也不能把 TLE 直接當能源證據。

**DESIGN INFERENCE**：把 identity 畫成貫穿河流的透明帶，比再放一張軌道示意圖更能
顯示「後續實驗必須消費同一 scenario」。8 分鐘 anchor 是 source-required cadence，
但畫面分段仍屬 design estimate。

**OWNER-REVIEW DESIGN RESOLUTION**：以 legal／illegal interval gate 作為 TLE 段的可見
學習後果；若該 gate 尚未能由同一 scenario 驅動，這一頁不得宣稱完成 data anchor。

**UNKNOWN**：每位學生能否在 8 分鐘內完成 glass-box 操作、fallback 是否真的保持
continuity，以及 scenario 是否在 runtime／browser 中 fail closed，尚無證據。

### Slide 4｜Lab A — Same job, different pace（18–41；23）

**主問題**：「固定同一 payload 與 deadline，較低 W 或較快完成是否一定帶來較低 J？」

**圖解語法：共同時間軸上的三個 power-time footprint＋單一 evidence ledger**。慢速、平衡、
高速後休眠三列共享 workload、deadline 與 system boundary；每列用 bar 高度／長度表示
qualitative W 與 active time，不製造量測值。右側 ledger 在回放後自動填入 service_pass、
consumed J、bit/J 與完成時刻；下方才揭露 fixed／idle／wakeup condition，讓學生鎖定策略後
回放並判斷排序是否翻轉。

**PROTECTED MICRO-TIMING（SOURCE-REQUIRED）**

```text
5 min reference（worked example＋entry check）
→ 11 min predict → deploy → hidden replay
→ 5 min learner debrief
→ 2 min transition
```

debrief 不得被操作超時吞掉。consequential counterexample 是快手在同一 23 分鐘
learner-facing window 內進入的 branch，不把固定的 2 分鐘 transition 冒充另一個實驗。

**SOURCE-REQUIRED MECHANICS**

- reference 先教 active／fixed／idle cost、完成後 sleep 與 service failure；學生再
  以方向選項預測 `pace／balanced／burst-to-sleep`。
- 學生挑一張 candidate 作 deployment；該選擇必須成為 hidden fixed／idle／wakeup
  condition replay 的 actual input，不能只保存卡片或跳過動畫。
- debrief 以一句 causal stem 說明 power-time pathway、`service_pass`、consumed J、
  bit/J 與 failure condition；結果表由系統 auto-log。
- counterexample 必須在另一個明示 fixed／idle cost 下讓 ranking 有可辯護的反轉，
  不把 race-to-idle 說成 universal rule。

**FACT**：固定 workload、time window、boundary 與 power model 時，race／pace-to-idle
沒有無條件的普遍 winner；canonical denominator 仍是同一時間域的 consumed energy。

**DESIGN INFERENCE**：三股 braid 讓「選擇 → hidden condition → J／服務結果 → 因果
解釋」一眼可見，並且和 Lab B 的 state-policy 圖、Lab C 的 schedule 圖有不同形狀。

**UNKNOWN**：candidate 是否真正改變 authoritative state、counterexample 是否公平、
新手能否在 23 分鐘留下完整 evidence floor，尚未 runtime／browser／classroom 驗證。

### Slide 5｜Lab B — Act now or wait（41–64；23）

**主問題**：「看到較好 candidate 要立即 switch，還是等 quality 穩定？link choice 如何
改變 active time、service 與 consumed J？」

**圖解語法：雙軌 trace＋rewind gate**。左軌固定顯示 `Trace A` 的五事件 thermostat-
like quality trend；中間以回帶箭頭回到一次 alternate decision；右軌把 student rule
鎖進 `Trace B`，遮住未來 trend 並標出 `NO RETUNE`。下方把 serving state、quality trend、
switch count（policy evidence）與真正的能量因果線分開：`link choice → active time／
service → W／累積 J／delivered bits／bit/J`。

**PROTECTED MICRO-TIMING（SOURCE-REQUIRED）**

```text
5 min Trace A（worked trace＋entry check）
→ 11 min predict → rewind → rule freeze → Trace B no-retune
→ 5 min learner debrief
→ 2 min transition
```

**SOURCE-REQUIRED MECHANICS**

- Trace A 先讓學生選 `switch now／wait／remain`；rewind 一次 alternate decision，
  再用 non-code executable blocks 凍結 threshold／hysteresis rule。
- `Trace B` 只改未來 quality trend；規則必須驅動 serving state 與 downstream evidence，
  學生不可偷看答案或 retune。
- debrief 留下「哪一種 trend 會失敗、哪個 state 改變了 service／consumed-J trade-off」
  的部分 stem；switch count 只作 policy evidence，已知 handover-event energy 未建模，
  能量差只能歸因於 link choice、active time 與 delivered service。

**FACT**：hysteresis 是可移轉的動態控制機制；本頁不宣稱商用衛星 handover 標準，也
不要求 dB 或 3GPP 知識。prediction 不等於 future knowledge。

**DESIGN INFERENCE**：`Trace A → rewind → frozen rule → Trace B` 的左右走向把 no-retune
公平性畫成一條不可回頭的門，與 Lab A 的 power braid 分開。

**OWNER-REVIEW DESIGN RESOLUTION**：所有「少 switch 是否比較省」的語句改寫為
`link choice → active time／service → J`；switch count 不得被畫成 energy meter 或
獨立的 handover-event cost。

**UNKNOWN**：Trace B 的 withheld trend 是否足夠公平、rule 是否真的驅動可觀察 branch、
以及一人一機時 instructor rescue 是否會掩蓋 learner reasoning，尚未證明。

### Slide 6｜Recovery reset：把證據接回同一本 Workbook（64–69；5）

**主問題**：「短暫中斷後，學生能否閉卷重建一條因果鏈並從同一狀態繼續？」

**圖解語法：checkpoint gate／雙出口**。左側是同一 Workbook 的 save checkpoint，中
央是閉卷 retrieval（選 A 或 B，補一句 causal chain），右側分成兩個出口：

```text
save Workbook → retrieve one causal chain
                    ├─ needs reset → device／class sync → resume same scenario_id
                    └─ no reset    → boundary counterexample → resume
```

**SOURCE-REQUIRED MECHANICS**

- 五分鐘中保護 checkpoint；其餘是 stretch、裝置 recovery 與全班同步，不可拿等待
  當課程內容或實驗 filler。
- 只要求一句話重建 Lab A 或 B 的因果鏈；不新增衛星術語、slider 或自由問答。
- resume 必須回到同一 Workbook／scenario；任何 fallback 要保留 provenance。

**FACT**：Workbook、choice、run 與結果的 continuity 是全課 evidence contract，不是
最後才補填的表格。

**DESIGN INFERENCE**：把 recovery 畫成 gate 而非空白休息頁，能明示「保存證據」本身
是學習迴路的一部分，同時不誤稱 recovery 為新實驗。

**UNKNOWN**：20 台裝置在中斷後是否能同步恢復、學生是否能不看答案重建因果鏈，以及
fallback 的提示層級會否改變 evidence claim，尚未驗證。

### Slide 7｜Lab C — Spend the joules（69–92；23）

**主問題**：「在有限 consumed-J budget 與短 contact window 下，urgent、periodic、bulk
資料何時送、batch、wait 或 sleep？」

**圖解語法：六格 mission board＋budget state machine**。左半是兩格 scenario 固定、四格
可行動的時間板；右半是 `baseline → schedule → revise → withheld → debrief` 狀態機。
每張資料卡以 `generated → sent → received` 小箭頭穿過時間板；預算線只連到同一
canonical `P_sys` 累積的 consumed J，不另畫 ratio。

**PROTECTED MICRO-TIMING（SOURCE CADENCE＋OWNER-REVIEW DESIGN RESOLUTION）**

```text
6 min baseline（one-card example＋legal-slot entry check）
→ 10 min schedule（run＋observation）
→ 5 min revise → withheld event（freeze；不得看答案後 retune）
→ 2 min learner debrief＋transition token
```

Issue 11 的 cadence table 將這一段描述為「5 分鐘 debrief＋2 分鐘 transition」，而
其 detailed Lab C storyboard 將 5 分鐘用於 revision／withheld、2 分鐘用於 debrief。本
架構暫採後者以保住 withheld decision loop；兩者皆是 23 分鐘內的 protected sequence，
最後選擇屬 owner-review design gate，不能稱為 empirical PASS。

**SOURCE-REQUIRED MECHANICS**

- baseline 先 lock `send-immediately` prediction；學生辨認 deadline、freshness、
  contact window 與 hard consumed-J budget。
- schedule 只在最多四個 actionable slots 安排 urgent／periodic／bulk 的 send／batch／
  wait／sleep；非法 slot 立即指出違反的 deadline／window。learner schedule 必須是
  actual timeline input，且只允許一次 revision。
- withheld event 是 shorter contact 或新 urgent arrival；baseline／learner／withheld
  ledger 並列。debrief 以一句 causal stem 作 `accept／qualify／reject`，並把
  boundary／service token 累積至 transfer。
- 分區呈現每張卡的 generated／sent／received time、fresh／expired、wake／tx／sleep、
  W、累積 J、budget remaining、delivered bits、canonical bit/J、service_pass 與
  deadline；不能用高 bit/J 掩蓋 urgent miss，也不引入 harvest、battery、net-energy
  或第二套 numerator／denominator。

**FACT**：canonical chain 的 `P_sys`、realized rate、PA／fixed costs 與 consumed energy
必須沿用 binding contract；`q`、`kappa` 只是 diagnostics，不能變成教學 reward 或
個人 energy attribution。

**DESIGN INFERENCE**：mission board、budget state machine 與 card lifecycle 三層疊圖，
讓「安排」與「結果」分離，避免把六格畫面誤讀成六個彼此獨立的活動。

**UNKNOWN**：fixture 是否有至少兩個不同條件下可辯護的 schedule、學生安排是否改變
authoritative timeline，以及 withheld event 是否在 23 分鐘內形成因果解釋，尚未實作或
browser 驗證。

### Slide 8｜Evidence clinic：Prediction is not saving（92–106；14）

**主問題**：「較高 prediction score 是否就能證明較多節能？」

**圖解語法：availability funnel／claim gate**。14 分鐘 default core 只把一個連貫的
borderline case 放入 `available now／post-action leakage` 篩選器；通過後進入兩個合法
但風險不同的 action，再進入 chronological held-out replay，最後落在四格 claim gate。
其餘 3–5 張 feature cards 只在 fast branch 或後續 authoring gate 通過時出現：

```text
one coherent borderline card → two legal actions（freeze one）
       → chronological held-out replay → claim：可／不可、只能聲稱什麼
```

**SOURCE-REQUIRED MECHANICS**

- Source 原規格要求 4–6 張 feature cards，且至少一張必須看 timestamp 才能判定；不可
  因欄位名稱含 `final` 就偷看答案。本 owner-review resolution 將一張 coherent
  borderline case 放入核心，其餘卡片降為 optional／fast branch，尚待 owner 正式接受。
- 學生拒絕 leakage，從至少兩個 decision-time 合法 action 中凍結一個；frozen action
  必須進 actual control path，而不是只保存 feature sort。
- replay 後把 prediction score 與 `service_pass`／freshness／deadline、consumed J、
  delivered bits、canonical bit/J 分成兩區；model score 不進 energy formula。
- 只完成一句 claim：資料在 decision time 是否可得、frozen replay 顯示什麼，因此
  只能聲稱什麼；不擴成 algorithm zoo 或多模型比較。

**FACT**：prediction score 本身不是 energy result；只有合法、凍結的 action 在 held-out
replay 上留下 service 與 consumed-J evidence，才可支持節能主張。

**DESIGN INFERENCE**：funnel 只讓合法 feature 穿過，再以 gate 截斷超出 evidence 的
語句，可視化 prediction → action → plant result 的因果責任鏈。

**OWNER-REVIEW DESIGN RESOLUTION**：14 分鐘先保證一個 coherent case、兩個合法 action、
一次 held-out replay 與一句 claim；4–6 cards 的完整版本只作 optional／fast branch，
避免用 feature 數量取代因果理解。

**UNKNOWN**：browser-native clinic 是否比外部工具提供不可替代的學習、feature availability
提示是否造成誤解、以及 14 分鐘內能否完成 claim adjudication，尚無 3–5 位 novice A/B
證據；本頁不預設任何外部工具已獲 20-seat 通過。

### Slide 9｜Competition transfer and exit：把機制帶到未見 domain（106–120；14）

**主問題**：「哪一個 LEO 節能機制換到非衛星場景後，仍可形成可測、可被推翻的競賽題目？」

**圖解語法：累積 token bridge／未見 domain card**。四個前段 token bank 匯入一座橋，
橋面強制通過 available data／time 到 measurement window／falsifier 的完整因果鏈：

```text
A baseline／power-time ┐
B state／data／control  ├→ cumulative tokens → unseen smart farm／HVAC／edge／logistics card
C boundary／unit／service┤          ↓
clinic held-out／falsifier ┘  available data／time → control → service → P×time → J
                                      ↓
                         measurement window／falsifier → what-if → revise → retrieval → export
```

**SOURCE-REQUIRED MECHANICS**

- 八個 semantic fields 由全課累積，不在最後一次出現八個空白框：A 保存 baseline／
  power-time pathway；B 保存 state／data／control；C 保存 boundary／unit／service
  constraint；clinic 保存 held-out logic／falsifier starter。
- 學生選一張未見的非 LEO domain card，重新映射 tokens，只寫 competition hypothesis
  與 falsifier。固定鄰座交換一張 `what-if` 後個別修一次；若鄰座未就緒，立即使用
  個人 system what-if，不等待。
- retrieval 用一題未見情境的 selection／排序，同時檢查 low W vs low J、dynamic
  policy 與 prediction-vs-saving；完成後匯出可 reopen 的 Workbook，未完成仍可匯出
  但標示 `INCOMPLETE`。
- rubric 檢查 causal path、fair comparison、service gate 與 falsifier，不評工具品牌、
  dashboard 華麗程度或把 satellite fixture 數值搬到新 domain。
- transfer artifact 必須明示 available data／time、control action、service constraint、
  `P×time` 到 `J` 的 measurement window，以及可使主張失敗的 falsifier；單純重排 token
  或複製衛星數字不算完成。

**FACT**：競賽 brief 要求以資料分析／預測形成智慧節能控制應用；可轉移的是
`state → prediction → control → service → P×time → J → evidence`，不是 LEO 數值本身。

**DESIGN INFERENCE**：token bridge 讓學生看見前三個 lab 的產物仍在工作，what-if 與
retrieval 則把 transfer 從口號變成可檢查的行動序列。

**OWNER-REVIEW DESIGN RESOLUTION**：把 token bridge 的出口鎖定為
`available data／time → control → service → P×time → J → measurement window／falsifier`，
以防 transfer 退化成欄位搬運；這是 owner-review 的 artifact shape，不是已驗證的學習成效。

**UNKNOWN**：學生能否在未見 domain 維持公平 baseline、service constraint 與 falsifier，
以及 story stakes／競賽動機是否足以支撐 14 分鐘完成，尚未驗證。

## 4. 跨頁 production contract（九頁共同遵守）

1. **同一資料主幹**：`scenario_id`、Workbook、shared clock、trial ledger 與
   `source_mode` 貫穿所有頁面；不得將後續 trace 靜默換成另一個預載場景。
2. **同一證據順序**：prediction lock → learner input → hidden／withheld replay →
   observable state → learner causal debrief；每個 full lab 都必須有 failure condition。
3. **同一欄位邊界**：`service_pass`、freshness、deadline、W、active time、累積 J、
   budget remaining、delivered bits、bit/s、bit/J 分欄顯示；不以欄位不空白冒充理解。
4. **圖解而非重複表格**：九頁分別使用 route map、五拍迴圈、lineage river、power
   braid、dual trace、checkpoint gate、mission state machine、availability funnel、
   token bridge；不重複六列的「問題／預測／操作／證據／意義／回復」版型。
5. **可及與可恢復**：任何 drag／drop 必須有 keyboard／table alternative；timeline 可
   pause／replay；hint、autofill、fallback 與 instructor rescue 留 provenance，且
   scaffolded practice 不算 unaided evidence。
6. **畫面與聲稱**：在現行 lab 尚無 production simulator implementation 的前提下，
   不生成假 screenshot、live KPI、measurement、calibration、browser closure、
   classroom readiness 或 whole-system／wall-plug claim；每頁保留固定 simulated-data
   ceiling：`模擬教學資料、非即時、非量測、尚未通過 canonical parity 驗證。`

## 5. Source-level risks（不得以版面設計補成 PASS）

下列風險直接限制本 Phase 0 的 claim，並列為後續 gate；它們不是新增課程段落，也不是
可用更多投影片解決的問題：

- **Fixture content not authored**：現行 authority 要求 coherent、deterministic、可
  branch 的 simulated fixtures，但本 Phase 0 沒有完成 fixture 內容、反例族群或 scenario
  diversity 的 authoring／runtime 證據。
- **Motivation／story stakes not validated**：LEO-as-index 與競賽 framing 已定義學習
  方向，但學員是否感到任務有意義、能否維持 non-LEO transfer 的故事 stakes，尚無
  3–5 位新手或教室觀察驗證。
- **3–5 novice timing proof absent**：尚未逐人記錄 active seconds、first answer、
  invalid action、hint／fallback、instructor rescue、artifact completion 與 causal
  rubric；`65–72 median／p90 <=78` 只能作 planning hypothesis。
- **20-seat proof absent**：尚無證據證明 20 台裝置能在 5 分鐘內進入第一個 meaningful
  activity，或故障能在 2 分鐘內切到同一 fixture fallback。
- **Rubric／counterexample coverage unproven**：尚未證明每個 lab 的 causal rubric、
  legal／illegal gate 與反例族群都已 authored、可公平重播且能在 20-seat 條件下被讀懂。

因此本 Phase 0 最高可用 claim 仍是：

`PROPOSED EXACT-120 ENERGY-FIRST STORYBOARD / EMPIRICALLY UNCONFIRMED`

Owner gate 只在此九頁 outline 被接受後，才決定 full-deck 的 detail slide scope、visual
acceptance、placeholder 替換與後續 evidence promotion。

## 6. 未來詳細頁／活動數量（全部為設計估計）

下列數量只用來讓 owner 判斷 full-deck 規模，不是 validated classroom timing，也不因
列在 Phase 0 就獲得製作授權：

| 段落 | 未來詳細投影片／活動數量（設計估計） |
|---|---|
| 開場判讀 | 3–4 頁＋1 個 vote／sort／reveal／revise 活動 |
| TLE-to-NTPU anchor | 3–4 頁＋1 個 staged glass-box 操作 |
| Lab A | 5–6 頁＋1 個完整 lab；counterexample 為快手 branch |
| Lab B | 5–6 頁＋1 個完整 lab；含 Trace A／B 與 no-retune gate |
| Recovery reset | 1–2 頁＋1 個 checkpoint／retrieval |
| Lab C | 6–7 頁＋1 個完整 lab；`6+10+5+2` 仍待 owner 解決 source timing tension |
| Evidence clinic | 4–5 頁＋1 個 coherent case；額外 cards 為 optional／fast branch |
| Competition transfer／exit | 4–5 頁＋1 個 transfer／what-if／retrieval／export 活動 |
