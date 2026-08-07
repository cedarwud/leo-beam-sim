# T1–T6 實際數值範例與因果解釋

> 目的：為每一張 T1–T6 空白觀測表提供一組目前 checkout 可重算的填入範例，以及可交給 deck worker 的因果解釋。
>
> 狀態語義：本報告的數字來自目前 project runtime source、focused tests 與受治理 deterministic fixture；本回依要求沒有啟動 Vite 或瀏覽器，因此不把它們冒充成瀏覽器畫面實測。每個 T 的數值區都保留標記：**一次實測範例，實際結果可能隨窗口改變**。

## 0. 先固定資料契約

### 範圍與 authority

- T1–T5 的 `P_RF`、`P_PA`、`P_total`、`Run EE` 是 teaching single-link route。`circuitPowerW=3 W` 是教學旋鈕，不是 ADR-003 的 canonical `P_sys`。
- T6 使用 `ADR-003 BeamShift partial-payload` producer。它從完整 `SinrLiveCellFrame` 計算 active-beam power、per-user rate、`P_sys`、`EE_inst` 與 ratio-of-sums `EE_eval`；不接入 teaching 的 3 W 電路項。
- `—` 表示 `null`／未取得；數字 `0` 表示已測得的零。不可用值不能補成 0。
- 表中數字以 6 位小數呈現；source 計算保留 JS 雙精度。

### 本報告共用的可重算窗口

T1/T2/T4/T5 的 teaching ledger 範例使用同一個短 deterministic window，避免把未觀測的 15–20 s browser timing 寫成事實：

```text
simTimeSec = 0, 1, 2
maxSampleGapSec = 2
throughput = computeTeachingThroughputMbps({sinrDb: 10, bandwidthMHz: 20, frequencyReuse: 1})
          = 69.18863237274594 Mbit/s
cumulativeHandoverCount = 0, 0, 1
servingSinrDb = 10 dB; lowSinrThresholdDb = 14 dB
```

因此有效積分區間是 `Δt=1+1=2 s`，窗口內計入一次 handover；第一筆只建立 timestamp/baseline，不積分。T5 的 invalid rows 以同一個時間序列送入 `throughput=null`，所以時鐘可前進但不累加 physics。

### 已執行的 focused commands

工作目錄均為 `/home/u24/papers/beamshift/.scratch/teaching-course/v3-ee/project`：

```text
node --import tsx/esm src/teaching/energyModel.test.ts              # 23/23 passed
node --import tsx/esm src/teaching/energyLedger.test.ts              # 50/50 passed
node --import tsx/esm src/teaching/energyComparison.test.ts          # 8/8 passed
node --import tsx/esm src/teaching/canonicalEnergyEfficiency.test.ts # 11/11 passed
node --import tsx/esm src/teaching/beamshiftCanonicalEe.test.ts      # 15/15 passed
node --import tsx/esm src/App.classroomEnergy.test.ts                 # passed
node --import tsx/esm src/ui/signal-tuning/EnergyTab.test.tsx         # passed
```

`experiments_evidence.py:35-42` 已把舊的 T5 50→35 dBm controller probe 與 deterministic T4/T6 source 分開；本報告不把 `experiments_evidence.py:1159-1170` 的歷史 literal `14505.8 J / 632.3 Mbit / ...` 當成目前 project 的 actual value。

---

## T1 — Verify the teaching power chain

### 空白表完整欄位與單位

`experiments_links.py:619-636` 的第一張表欄位是：

| 條件 | 衛星發射功率 `P_t` (dBm) | 功率放大器效率 `η_PA` (無量綱) | 已累積時間 (s) |
|---|---:|---:|---:|

`experiments_links.py:639-654` 的第二張表欄位是：

| 條件 | 電路功率 `P_circuit` (W) | 無線電發射功率 `P_RF` (W) | PA 輸入功率 `P_PA` (W) | 總功率 `P_total` (W) |
|---|---:|---:|---:|---:|

交付給 deck worker 時另保留：`scope=teaching/non-canonical`、reset action、窗口起訖與是否只改一項。`Elapsed` 是窗口欄，不是功率鏈的輸入。

### 已填入的 source/fixture 範例

**一次實測範例，實際結果可能隨窗口改變**（本表是目前 source + 2 s ledger window 的可重算範例，非本回瀏覽器實測）。所有列共用 `e_HO=3 J`；T1 的功率列不受 `e_HO` 影響。

| 條件 | `P_t` (dBm) | `η_PA` | 已累積時間 (s) | `P_circuit` (W) | `P_RF` (W) | `P_PA` (W) | `P_total` (W) | scope |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 基準 | 24 | 0.35 | 2 | 3 | 0.251189 | 0.717682 | 3.717682 | teaching / non-canonical |
| 調整電路功率 | 24 | 0.35 | 2 | 4 | 0.251189 | 0.717682 | 4.717682 | teaching / non-canonical |
| 調整 PA 效率 | 24 | 0.70 | 2 | 3 | 0.251189 | 0.358841 | 3.358841 | teaching / non-canonical |
| 調整發射功率 | 30 | 0.35 | 2 | 3 | 1.000000 | 2.857143 | 5.857143 | teaching / non-canonical |

### 重現來源與計算

- `src/teaching/energyModel.ts:115-161`：`P_RF=10^(P_t/10)/1000`、`P_PA=P_RF/η_PA`、`P_total=P_PA+P_circuit`。
- `src/teaching/energyModel.test.ts:14-39`：24 dBm、`η=0.35`、`P_circuit=3 W` 的 pinned checks 與加總 identity。
- `src/teaching/energyModel.ts:68-92`：defaults/ranges；`src/ui/signal-tuning/EnergyTab.tsx:327-343`：`P_t` control；`EnergyTab.tsx:345-412`：energy knobs。
- 2 s 的 `Elapsed` 來自 `advanceEnergyLedger` 的 `[0,1,2]` fixture；`src/teaching/energyLedger.ts:260-356` 只在正且連續的 `dt` 上累積。

例如基準列：

```text
P_RF    = 10^(24/10) / 1000 = 0.251188643150958 W
P_PA    = 0.251188643150958 / 0.35 = 0.717681837574165 W
P_total = 0.717681837574165 + 3 = 3.717681837574165 W
```

### 比較欄位與因果鏈

先比較 `P_circuit`、`P_RF`、`P_PA`，再比較 `P_total`；只看最後一欄不能知道中間哪一項先變。

- `P_circuit: 3→4 W` 時，第一個改變的是 circuit row；`P_RF`、`P_PA` 不變，`P_total` 一對一增加 1 W。若吞吐量/SINR 不變，2 s radio energy 增加 `1×2=2 J`，因此 teaching `Run EE=ΣMbit/E_total` 下降。
- `η_PA: .35→.70` 時，第一個改變的是 `P_PA=P_RF/η`；`P_RF` 與 circuit row 不變，`P_total`、後續 radio energy 下降。energy knob 不進 throughput formula，所以不能從此列宣稱 throughput 改善。
- `P_t: 24→30 dBm` 時，`P_RF` 先變，接著 `P_PA` 與 `P_total` 變；在 live scene，`P_t` 也可能改變 desired signal 與 co-channel interference，故 SINR/throughput 的方向仍要另讀 T3。

### 反直覺點、能支持與不能支持

- 反直覺：把 circuit 功率加 1 W，不會讓 `P_RF` 或 `P_PA` 變；它只在最後的加總出現，但會直接侵蝕時間窗 EE。
- 支持：teaching power identity、單一連線功率鏈、`P_circuit`/`η_PA` 對 teaching energy 的局部因果。
- 不支持：canonical `P_sys`、整顆衛星耗能、live SINR 方向或正式節能結論。`P_total` 即使單位是 W，也不能替代 T6 的 `P_sys`。

**T1 status：READY（source/test + deterministic window；browser acceptance 仍未執行）。**

---

## T2 — Separate PA efficiency, circuit power, and handover cost

### 空白表完整欄位與單位

`experiments_links.py:768-787` 的控制/瞬時表欄位：

| 條件 | `η_PA` | `P_circuit` (W) | `e_HO` (J/次) | `P_PA` (W) | `P_total` (W) |
|---|---:|---:|---:|---:|---:|

`experiments_links.py:790-809` 的窗口/結果表欄位：

| 條件 | 換手次數 (次) | 換手耗能 `E_HO` (J) | 總耗能 `E_total` (J) | 整段累積效率 `Run EE` (Mbit/J) | 已累積時間 (s) | Producer 狀態 |
|---|---:|---:|---:|---:|---:|---|

為了讓 causal explanation 可重算，T2 還應同列留下 `P_RF` (W)、累積傳輸資料量 (Mbit)、低 SINR 比例 (%)、低 SINR threshold (dB)、窗口 key/reset action。表中的 `Producer 狀態` 在下表寫成 `VALID*`，星號表示 finite pair 通過 teaching ledger 使用的 canonical seam；它不是把這個 teaching-only fixture 冒充成完整 live frame producer。

### 已填入的 source/fixture 範例

**一次實測範例，實際結果可能隨窗口改變**。固定 `P_t=24 dBm`、`B=20 MHz`、`K=1`、`SINR=10 dB`，使用共同 2 s window 與一次 handover；每一列重新建立空 ledger。

| 條件 | `η_PA` | `P_circuit` (W) | `e_HO` (J/次) | `P_PA` (W) | `P_total` (W) | HO 次數 | `E_HO` (J) | `E_total` (J) | Run EE (Mbit/J) | t (s) | Low SINR (%) | Producer 狀態 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 基準 | 0.35 | 3 | 3 | 0.717682 | 3.717682 | 1 | 3 | 10.435364 | 13.260416 | 2 | 100 | VALID* |
| 調整 PA 效率 | 0.70 | 3 | 3 | 0.358841 | 3.358841 | 1 | 3 | 9.717682 | 14.239740 | 2 | 100 | VALID* |
| 調整電路功率 | 0.35 | 12 | 3 | 0.717682 | 12.717682 | 1 | 3 | 28.435364 | 4.866379 | 2 | 100 | VALID* |
| 調整每次換手耗能 | 0.35 | 3 | 100 | 0.717682 | 3.717682 | 1 | 100 | 107.435364 | 1.288005 | 2 | 100 | VALID* |

共同分子是 `D=138.377265 Mbit`；差異只在 teaching denominator。`Low SINR=100%` 不是缺值：兩個可用 sample 都是 `10 dB < course threshold 14 dB`。

### 重現來源與計算

- `src/teaching/energyModel.ts:133-161`：功率 chain；`src/teaching/energyModel.ts:66-72`：`.35/3/3` defaults。
- `src/teaching/energyModel.ts:183-197` 與 `src/teaching/energyModel.test.ts:104-123`：`R=69.18863237274594 Mbit/s`、Shannon/cap/reuse semantics。
- `src/teaching/energyLedger.ts:56-65`：`E_HO=N_HO×e_HO`、`E_total=ΣP_totalΔt+E_HO`、`Run EE=ΣMbit/E_total`。
- `src/teaching/energyLedger.ts:260-356`：時間、null、HO cumulative-counter 差分、low-SINR sample tally；`energyLedger.ts:366-431`：low ratio、總耗能、Run EE。
- `src/teaching/energyLedger.test.ts`：50/50 tests；尤其 `:46-61` 驗證 `ΣrateΔt`/`ΣpowerΔt`，`:321-337` 驗證 Run EE 與空窗口 null，並有 handover/reset/low-SINR checks。

以基準為例：

```text
P_radio = 3.717681837574165 W
D       = 69.18863237274594 × 2 = 138.3772647454919 Mbit
E_radio = 3.717681837574165 × 2 = 7.43536367514833 J
N_HO    = 1
E_HO    = 1 × 3 = 3 J
E_total = 7.43536367514833 + 3 = 10.43536367514833 J
Run EE  = 138.3772647454919 / 10.43536367514833 = 13.260416125 Mbit/J
```

### 比較欄位與因果鏈

- `η_PA`：先變 `P_PA`，再變 `P_total`、`E_radio`、`E_total`、Run EE；`E_HO`、HO 次數、D、low-SINR 不變。
- `P_circuit`：先變 circuit/`P_total`，再以 `ΔP×Δt` 傳到 `E_radio`/`E_total`/Run EE；不進 rate。
- `e_HO`：不改 `P_PA` 或瞬時 `P_total`；只有發生一次 handover 時，先變 `E_HO`，再變 `E_total`/Run EE。若 HO 次數為 measured 0，改 e_HO 會是 measured no-effect，而不是 missing。
- 這幾個 energy knob 不改 live signal state；`App.tsx:520-523` 將它們限制在 teaching energy readout，`App.tsx:921-1005` 才把 signal/Pt/SINR 送進 ledger。

### 反直覺點、能支持與不能支持

- 反直覺：`e_HO` 可以讓 Run EE 大幅變差，但同一瞬間的 `P_total` 完全不動；事件成本是窗口 denominator 的另一條路徑。
- 支持：三個 knob 的局部因果、`E_HO` 是否計入總耗能、Run EE 的 ratio-of-sums teaching 定義。
- 不支持：只由 `P_total` 推論 canonical `P_sys`、把一次低 energy/高 EE 的列當成 qualified saving、或把 100% low-SINR 當成好服務。正式 A/B 還要同窗口、同服務集合與資料/品質 gates；`src/teaching/energyComparison.test.ts:11-77` 的 governed pair 也明確要求 AND gates。

**T2 status：READY（source/test + deterministic window；Producer 狀態的 `VALID*` 僅指有限值 seam，不是 live-frame acceptance）。**

---

## T3 — Trace transmit power, bandwidth, reuse, and live SINR to throughput

### 空白表完整欄位與單位

`experiments_links.py:963-977` 的條件表欄位：

| 條件 | `P_t` (dBm) | 頻道頻寬 `B` (MHz) | 頻率重複使用係數 `K` (無量綱整數) | 已累積時間 (s) | Producer 狀態 |
|---|---:|---:|---:|---:|---|

`experiments_links.py:980-994` 的 link observation 表欄位：

| 條件 | 波束負載 `U` (使用者數) | 即時 SINR (dB) | 速率 (Mbit/s) | 狀態 | 服務衛星 | 服務小區 |
|---|---:|---:|---:|---|---|---:|

另記 `allocated B/K/U` (MHz)、reset time、scene/profile identity、`P_max` (若走 canonical fixture)、window id。`Throughput` 是每位使用者 rate；不能把它和時間窗 cumulative data 混寫。

### 已填入的 source/fixture 範例

**一次實測範例，實際結果可能隨窗口改變**。以下直接使用 `beamshiftCanonicalEe.test.ts` 的 deterministic frame builder：`sat-a#cell0`、`ue-1`、`SINR=0 dB`，rated RF cap 明確給 `P_max=1 W`。每列以 `durationSec=1 s` 作為一個可重算的正時間窗口；表中 rate 是 per-user rate。

| 條件 | `P_t` (dBm) | B (MHz) | K | 已累積時間 (s) | Producer | U | SINR (dB) | rate (Mbit/s) | 狀態 | 服務衛星 | 服務小區 |
|---|---:|---:|---:|---:|---|---:|---:|---:|---|---|---:|
| A 基準 | 24 | 100 | 1 | 1 | VALID | 1 | 0 | 100.000000 | served | sat-a | 0 |
| B 調整 K | 24 | 100 | 3 | 1 | VALID | 1 | 0 | 33.333333 | served | sat-a | 0 |
| C 調整 B | 24 | 200 | 1 | 1 | VALID | 1 | 0 | 200.000000 | served | sat-a | 0 |
| D 調整 `P_t` | 30 | 100 | 1 | 1 | VALID | 1 | 0 | 100.000000 | served | sat-a | 0 |
| A+調整 U（補充列） | 24 | 100 | 1 | 1 | VALID | 2 | 0 | 50.000000 / UE | served | sat-a | 0 |

這組 frame 在 `SINR=0 dB` 下可直接回算：`log₂(1+10^0)=1`，所以 `R=(B/K)/U` Mbit/s。對應的 canonical power/EE 也可一併留下，避免只貼速率：

| 條件 | allocated `B/K` (MHz) | `P_sys` (W) | total rate (Mbit/s) | `EE_inst` (Mbit/J) | `Σr` (Mbit/J) | identity |
|---|---:|---:|---:|---:|---:|---|
| A | 100 | 3.084431 | 100 | 32.420888 | 32.420888 | PASS |
| B | 33.333333 | 3.084431 | 33.333333 | 10.806963 | 10.806963 | PASS |
| C | 200 | 3.084431 | 200 | 64.841776 | 64.841776 | PASS |
| D | 100 | 5.618798 | 100 | 17.797400 | 17.797400 | PASS |
| A+U | 100 | 3.084431 | 100 | 32.420888 | 32.420888 | PASS |

為避免誤讀：D 的 deterministic frame 將 `SINR=0 dB` 固定住，只驗證 `P_t` 進 canonical power boundary 的效果；它不是 live scene 重新解 link budget 後的 SINR 實測。

### teaching rate 對照與重現來源

- teaching route：`src/teaching/energyModel.ts:164-197` 的 `R=(B/K)×min(8,log₂(1+10^(SINR/10)))`；`src/teaching/energyModel.test.ts:77-123` 驗證 normal/cap/reuse/fail-closed。
- 對照值：`SINR=10 dB,B=20,K=1 → 69.188632 Mbit/s`；只改 `B=40 → 138.377265`；只改 `K=2 → 34.594316`。
- canonical fixture builder：`src/teaching/beamshiftCanonicalEe.test.ts:36-141`；A 的一 beam/一 UE expected rate/power：`:154-178`；U 分配與兩 UE：`:236-272`；producer 測試 command 為上方 `beamshiftCanonicalEe.test.ts`。
- canonical producer：`src/teaching/beamshiftCanonicalEe.ts:76-94` 要求 live B/K/actual RF/rated cap；`:306-350` 形成 beam power；`:487-567` 形成 `B/K/U` rate 與 `P_sys`。

### 比較欄位與因果鏈

- 先比較 `P_t→SINR`，再比較 `B/K/U→allocated bandwidth→rate`；同時看 `P_sys`、`EE_inst`，不能只看 rate。
- 在本固定 frame 中，`K:1→3` 先改 `B/K`，`P_sys` 不變，per-user rate/EE 變為三分之一。live scene 另有 co-channel grouping，因此 SINR 也可能變，不能把這個方向直接升格為所有場景的單調律。
- `B:100→200` 在固定 SINR fixture 中先把 allocated bandwidth 與 rate 加倍，`P_sys` 不變，所以 EE 加倍；live source 同時把 thermal noise `σ²=N₀B` 提高，實際 SINR/EE 方向需記錄。
- `U:1→2` 先把 per-user allocated bandwidth 從 100→50 MHz；總 rate 對等分配仍是 100 Mbit/s，`P_sys` 與系統 EE 不變，但每位使用者的 rate 與 `r_1,u` 減半。
- `P_t:24→30` 在 canonical fixture 先讓 `P_DL`/PA input/`P_sys` 上升；因 fixture 固定 SINR，rate 不變，EE 下降。live route 的 `P_t` 也改 desired/interference，需把 SINR 實測列補回來。

### 反直覺點、能支持與不能支持

- 反直覺：提高 K 可能讓干擾分組更乾淨，卻先把每組可分配的 `B/K` 壓低；提高 B 可能帶來更多 bandwidth，卻同時提高 thermal-noise denominator。
- 支持：表格欄位的單位/範圍、`B/K/U/SINR` 到 per-user rate 的 algebra、fixture 中的 `P_sys`/`EE_inst` identity。
- 不支持：由固定 SINR fixture 宣稱 live `P_t`、B、K 的普遍方向；也不支持將 T3 teaching `P_total` 宣稱成 canonical `P_sys`。

**T3 status：READY（teaching formula + governed canonical fixture；live SINR 的瀏覽器窗口仍未宣稱）。**

---

## T4 — Distinguish measurement reset from energy-parameter restoration

### 空白表完整欄位與單位

參數欄依 `experiments_evidence.py:673-706`：

| 狀態 | `η_PA` | 電路功率 (W) | 每次換手耗能 (J) |
|---|---:|---:|---:|

窗口欄依 `experiments_evidence.py:707-735`：

| 狀態 | 已累積時間 (s) | 累積傳輸資料量 (Mbit) | 總耗能 (J) | Run EE (Mbit/J) |
|---|---:|---:|---:|---:|

完整紀錄還要有：`simulation clock (simTimeSec, s)`、`playback state (paused/playing)`、scene/profile/context key、reset button、按鈕是否改參數、`lastSimTimeSec` 是否重新 baseline。`simulation clock`/`playback state` 是 App record 欄位；pure ledger 不應自己推造 playback。

### 已填入的 source/fixture 範例

**一次實測範例，實際結果可能隨窗口改變**。依 guide 的非預設值 `η=.60, P_circuit=25 W, e_HO=100 J`，共用窗口為 `P_t=24 dBm`、`R=69.188632 Mbit/s`、t=0/1/2、一次 HO。pre-reset 的 power train 是 `P_PA=0.418648 W`、`P_total=25.418648 W`。

| 操作/狀態 | `η_PA` | circuit (W) | `e_HO` (J) | 已累積時間 (s) | 累積資料 (Mbit) | radio energy (J) | HO 次數 | `E_HO` (J) | 總耗能 (J) | Run EE (Mbit/J) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| t=2 s，按鈕前 | 0.60 | 25 | 100 | 2 | 138.377265 | 50.837295 | 1 | 100 | 150.837295 | 0.917394 |
| Restart measurement 後 | 0.60 | 25 | 100 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| Restore energy defaults 後 | 0.35 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | — |

按鈕狀態補記：

| 狀態 | simulation clock | playback state | ledger `lastSimTimeSec` | 解釋 |
|---|---|---|---|---|
| 按鈕前 | fixture 最後 sample = 2 s | 由 App 當下 playback 決定 | 2 | 正常窗口 |
| Restart 後 | 外部 sim clock 不改 | 不改 | `null`，下一筆重新 anchor | 只清 ledger window |
| Restore defaults 後 | 外部 sim clock 不改 | 不改 | `null`，energy reset key 觸發新 window | 先改 energy parameters，再清跨條件累積 |

此處沒有把 `paused` 或 `playing` 任選一個寫成瀏覽器觀測；目前 source 明確規定兩個 action 不應改 playback，真正值應由 deck worker 在 live 表格填入當下 UI state。

### 重現來源與計算

- `src/teaching/energyModel.ts:68-92`：defaults/ranges；`energyModel.ts:133-161`：modified power。
- `src/teaching/energyLedger.ts:237-356`：first sample、正 dt、seek/jump、null physics 與累積；`:403-431`：`E_total`/Run EE；`:461-471`：reset key 對所有 energy knobs 敏感。
- `src/App.tsx:889-902`：`Restart measurement` 清空 ledger/epoch；`:909-922`：reset-key 改變時清 window；`:1216-1222`：Restore 只把 energy tuning 設回 defaults。
- `src/App.tsx:1122-1126`：experiment record 的 `simulationClock` 與 `playbackState` 欄位；`:1024-1043`：comparison input 也分開保留 `paused`、window start/end。
- `experiments_evidence.py:739-792` 是既有 T4 fixture 的 source note；本報告把同一 reset semantics 延伸到包含一次 HO 的目前 ledger 計算，沒有使用瀏覽器數字。

### 比較欄位與因果鏈

- `Restart measurement`：第一個改變是窗口 ledger（elapsed/data/energy/HO tally 歸零）；三個 parameter rows、scene、playback、simulation clock 不變。後續 rate/power 只從新 baseline 開始進入 EE。
- `Restore energy defaults`：第一個改變是 `η=.60→.35`、`25→3 W`、`100→3 J`；`energyLedgerResetKey` 隨之改變，避免把 pre-restore 的 150.837295 J 和 post-restore 數字接成一個 Run EE。
- 窗口重開本身不會傳播成 throughput 下降或節能；它只改「哪些樣本可以進入分子/分母」。參數恢復後，新樣本的 `P_total` 會回到 teaching default，才會在後續 energy/Run EE 發生物理模型上的差異。

### 反直覺點、能支持與不能支持

- 反直覺：按 Restart 後 `E_total` 顯示 0，不代表消耗被消除；只是舊樣本不再屬於新窗口。
- 支持：兩個按鈕的 ownership、參數與 ledger 的分離、不得跨 reset/seek/parameter condition 累積。
- 不支持：用 reset 後的 0 J 宣稱節能、用未記錄 playback/scene 狀態做 A/B、或把 parameter restore 誤稱成 canonical reset。

**T4 status：READY（numeric reset contract/source fixture；playback literal 留給 live record，未在本回冒充觀測）。**

---

## T5 — Check fail-closed SINR semantics

### 空白表完整欄位與單位

中間量表依 `experiments_evidence.py:1040-1101`：

| 條件 | `P_t` (dBm) | 無線電發射功率 `P_RF` (W) | 即時 SINR (dB) | Throughput (Mbit/s) |
|---|---:|---:|---:|---:|

累積結果表同段欄位：

| 條件 | 已累積時間 (s) | 累積傳輸資料量 (Mbit) | 總耗能 (J) | 整段累積效率 (Mbit/J) | 低 SINR 比例 (%) |
|---|---:|---:|---:|---:|---:|

另保留 `B (MHz)=20`、`K=1`、`η/circuit/e_HO`、`Producer/canonical status`、`lastSimTimeSec` 與 absence reason。`NaN/+Infinity` 沒有合法畫面數值，SINR 欄應顯示 `—`/invalid；只有 `-Infinity` 是 no-service domain sentinel。

### 已填入的 source/fixture 範例

**一次實測範例，實際結果可能隨窗口改變**（這一項是 model/release test，不需要 browser timing）。固定 `P_t=24 dBm`、`η=.35`、`P_circuit=3 W`、`B=20 MHz`、`K=1`、同一 2 s ledger sequence；沒有 handover，因此 `E_total=E_radio`。

| 條件 | `P_t` (dBm) | `P_RF` (W) | SINR | Throughput (Mbit/s) | 已累積時間 (s) | 累積資料 (Mbit) | 總耗能 (J) | Run EE (Mbit/J) | Low SINR (%) | 狀態 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| finite reference | 24 | 0.251189 | 10 dB | 69.188632 | 2 | 138.377265 | 7.435364 | 18.610692 | 100 | valid / finite |
| `-Infinity` no-service | 24 | 0.251189 | `-Infinity` | 0 | 2 | 0 | 7.435364 | 0 | — | measured no-service |
| `NaN` invalid | 24 | 0.251189 | `—` (`NaN`) | `—` (`null`) | 0 | 0 | 0 | — | — | invalid/unavailable |
| `+Infinity` invalid | 24 | 0.251189 | `—` (`+Infinity`) | `—` (`null`) | 0 | 0 | 0 | — | — | invalid/unavailable |

`NaN/+Infinity` rows的 `lastSimTimeSec` 仍可到 2，但 `elapsedSec/data/energy` 都是 0；這不是 0 J 實測，而是 null physics 被刻意排除的空窗口。若要在 live UI 表中記 canonical status，請保留 producer status 的真值與 typed error；本表的 `valid` 僅是 teaching pair 的可接受 branch。

### 重現來源、command 與計算

精確 command（guide 也指定此命令）：

```text
cd /home/u24/papers/beamshift/.scratch/teaching-course/v3-ee/project
node --import tsx/esm src/teaching/energyModel.test.ts
```

- `src/teaching/energyModel.ts:183-197`：`-Infinity→0`、其他 non-finite→`null`；`src/teaching/energyModel.test.ts:77-123` 對應三個 sentinel 與 finite formula。
- `src/App.tsx:921-936`：只有 `-Infinity` 進 throughput helper；NaN/+Infinity 直接成 `null`。
- `src/App.tsx:974-979`：只有 finite SINR 送進 low-SINR tally；`energyLedger.ts:253-257, 301-327` 對 null physics 只前進 timestamp、不積分。
- 2 s finite/no-service energy 使用 `P_total=3.717681837574165 W`；invalid rows 的 `E_total=0` 來自 empty ledger，Run EE 依 `energyLedger.ts:417-431` 保持 `null`。

### 比較欄位與因果鏈

- 第一個改變是 domain status/throughput：finite 有 rate；`-Infinity` 是 measured zero；NaN/+Infinity 是 unavailable。
- finite branch 才把 `R×dt` 傳到 cumulative data；只要 power finite，`-Infinity` no-service 仍會累積 radio energy，所以 Run EE 是 0 而不是 missing。
- invalid branch 不把 null 當成 0：資料、耗能、low-SINR ratio 與 Run EE 都不應因 invalid sample 增加；因此它不能製造「零流量、零耗能」的漂亮假節能。

### 反直覺點、能支持與不能支持

- 反直覺：`-Infinity` 的 throughput=0 是有效 measured no-service，且可有正的耗能；`NaN/+Infinity` 的 throughput 是 `—`，不是另一種 0。
- 支持：fail-closed domain contract、no-service 與 broken expression 的可觀測區分、invalid 不污染 ledger。
- 不支持：由 sentinel 單元測試宣稱 50→35 dBm live A/B、宣稱服務品質良好、或將 invalid row 的 0 totals 當成節能。普通 slider 不能注入 NaN/Infinity；要做 live sentinel demonstration，最小缺口是受控 frame injector/fixture selector，而非改 formatter。

**T5 status：READY（model/test contract；live sentinel injection 明確不是目前 UI 能力，故不宣稱 browser result）。**

---

## T6 — Read the live canonical gate without confusing it with the teaching chain

### 空白表完整欄位與單位

依 guide `T6` 的 record contract（`T1-T6-LAB-GUIDE.md:500-519`），空白表至少要有：

| 欄位 | 單位/允許值 |
|---|---|
| Producer status | `valid` / `zero-activity` / pending / invalid |
| identity | `Σ_u r_{1,u}=EE_inst` 的 `PASS`/failure |
| `P_sys` | W |
| `EE_inst` | Mbit/J |
| per-user row | UE id、served/outage/unserved、sat/cell、U、SINR dB、allocated B MHz、rate Mbit/s、`r_{1,u}` Mbit/J |
| contribution sum | Mbit/J |
| `EE_eval` | Mbit/J；第一個 baseline 應為 `—`，正 `Δt` 後才有數值 |
| window/clock | frame `simTimeSec` (s)、positive duration (s)、sample count |
| reset/seek/error | reset/seek epoch、equal/backward/out-of-order 或 typed pending/invalid code |
| scope | `ADR-003 BeamShift partial-payload`；不接 3 W teaching circuit |

### 已填入的 source/fixture 範例

**一次實測範例，實際結果可能隨窗口改變**（受治理 `beamshiftCanonicalEe.test.ts` fixture，`ratedMaxRfOutputW=1 W` 明確提供；非瀏覽器 frame）。共同 frame 為 `simTimeSec=1`、`B=30 MHz`、`K=3`、`P_t=30 dBm`、一個 `sat-a#cell0` active beam、`ue-1`、`SINR=0 dB`。

| 條件 | active beams | U | rate/UE (Mbit/s) | `P_sys` (W) | `EE_inst` (Mbit/J) | per-user `r` (Mbit/J) | sum (Mbit/J) | identity | `EE_eval` |
|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| baseline：1 beam/1 UE | 1 | 1 | 10.000000 | 5.618798 | 1.779740 | ue-1: 1.779740 | 1.779740 | PASS | — |
| 調整 U：同 beam 2 UE | 1 | 2 | 5.000000 / UE | 5.618798 | 1.779740 | ue-1/ue-2: 0.889870 each | 1.779740 | PASS | — |
| 調整 active domain：加 1 個 zero-load beam | 2 | 1 served | 10.000000 | 11.037597 | 0.905994 | ue-1: 0.905994 | 0.905994 | PASS | — |
| 調整 RF：`P_t=24 dBm`、1 beam/1 UE | 1 | 1 | 10.000000 | 3.084431 | 3.242089 | ue-1: 3.242089 | 3.242089 | PASS | — |

`EE_eval` 的時間窗口範例（同一 producer 的 ratio-of-sums fixture）：

| step | frame/期間 | total data (Mbit) | total energy (J) | `EE_eval` (Mbit/J) |
|---|---|---:|---:|---:|
| baseline | 第一幀 1 beam、尚未有正 `Δt` | 0 | 0 | — |
| 1 | baseline 後 1 beam、rate 10、`duration=1 s` | 10.000000 | 5.618798 | 1.779740 |
| 2 | 下一段 2 active beams、rate 10、`duration=3 s` | 40.000000 | 38.731588 | 1.032749 |

第二步的計算是：

```text
D = 10×1 + 10×3 = 40 Mbit
E = 5.618798314396923×1 + 11.037596628793846×3 = 38.73158820077846 J
EE_eval = D/E = 1.0327487680764933 Mbit/J
```

它不是兩個 instantaneous EE 的簡單平均；平均值約 `1.342867`，故不能拿 mean-of-ratios 代替 ratio-of-sums。

### 重現來源與計算

- `src/teaching/beamshiftCanonicalEe.test.ts:36-141`：cell/link/UE/frame/input helper，包含 `B=30,K=3,P_t=30,P_max=1` defaults。
- `beamshiftCanonicalEe.test.ts:154-178`：一 beam/一 UE 的 `R=10`、`P_RFC=.338 W`、`P_BB=.2 W`、PA eta、`P_sys=5.618798...`、identity。
- `beamshiftCanonicalEe.test.ts:236-272`：`U=2` 時每 UE 5 Mbit/s、總 rate 10；`:274-292`：zero-load active beam 仍收費；`:338-374`：Pt24、zero output、rated-cap fail-closed。
- `src/teaching/beamshiftCanonicalEe.ts:27-43`：canonical power assumptions；`:306-350`：active-beam power；`:487-567`：per-user rate、`P_sys`、contribution sum/identity。
- `src/teaching/beamshiftCanonicalEe.ts:580-669` 與 test `:445-470`：正 duration、ratio-of-sums、reset/seek/out-of-order。
- focused command：`node --import tsx/esm src/teaching/beamshiftCanonicalEe.test.ts`（15/15）。

基準列的核心公式：

```text
P_DL = 10^((30−30)/10) = 1 W
η_PA = 0.35×sqrt(1/(1×10^(5/10)))
P_sys = 0.338 + 0.2 + P_DL/η_PA + 0 = 5.618798314396923 W
R_ue = (30/3)/1 × log2(1+10^(0/10)) = 10 Mbit/s
EE_inst = R_ue/P_sys = 1.7797399800553833 Mbit/J
```

### 比較欄位與因果鏈

- `U`：先變 per-user allocated bandwidth/rate，再變每位 `r_{1,u}`；同 active beam、等分配且總 served load 相同時，sum rate、`P_sys`、`EE_inst` 不變。
- zero-load active beam：先變 active beam count/baseband share 與 `P_sys`；throughput 不變，energy denominator 上升，`EE_inst` 下降。這是實驗值得操作的問題：系統 boundary 是否把「開著但沒有 UE」的 beam 計價？目前 canonical contract 的答案是會。
- `P_t=30→24 dBm`：先變 `P_DL`、PA efficiency/input、`P_sys`；此固定 frame 的 SINR/rate 保持 0 dB/10 Mbit/s，所以 EE 上升。live frame 若重新計算 SINR，不能直接套這個方向。
- temporal append：第一個 frame 只可作 instantaneous baseline；只有嚴格正 `durationSec` 才傳到 `ΣRΔt/ΣP_sysΔt`。equal/backward frame 要 error 或重新 baseline。

### 反直覺點、能支持與不能支持

- 反直覺：`r_{1,u}` 變大不是 UE 得到更多物理發射功率；它只是該 UE 的 `R_u/P_sys` accounting contribution，共用同一個 system denominator。
- 反直覺：加一個沒有使用者的 active beam，throughput 可以完全不變，但 `P_sys` 變大、EE 變差；這正是 active-domain boundary 的可操作問題。
- 支持：ADR-003 partial-payload 的 power/rate/identity、baseline dash、ratio-of-sums、zero-activity 與 typed fail-closed branch。
- 不支持：完整衛星/平台總耗能、把 3 W teaching circuit 加入 canonical `P_sys`、rated cap 缺失時的任何 numeric fallback、或用單一 instantaneous row 宣稱整段 EE。

若 live effective profile 沒有明確 rated RF cap，這個分支必須標 `BLOCKED/PENDING`：最小開發缺口是把 `channel.maxTxPowerDbm` 或等價的 governed `ratedMaxRfOutputW` 以受控 profile/case selector 傳入 producer；不能用 resolver fallback 或 root-scenario cap 代填。現有 test fixture 已有 `P_max=1 W`，所以本 T6 example 本身是 READY。

**T6 status：READY（governed canonical fixture + producer tests；live rated-profile/browser acceptance 仍是獨立 gate）。**

---

## T1–T6 READY/BLOCKED 矩陣

| T | source/test/fixture data contract | 本報告可交付的範例 | 仍未宣稱的 live gate | 最小 BLOCKED 條件 |
|---|---|---|---|---|
| T1 | READY | power chain 4 rows、2 s window、scope note | browser display/range | 無；若要 live，需 browser acceptance |
| T2 | READY | η/circuit/e_HO 四 rows、HO/energy/Run EE | live Producer status 與實際 window | full-frame status 若要與 teaching ledger 同列，需 live frame |
| T3 | READY | guide A–D controls + U/SINR/rate canonical fixture、teaching spot checks | live scene SINR 對 P_t/B/K 的實際方向 | 若必須注入固定 live SINR，需受控 scene/frame selector |
| T4 | READY | parameter/window before–Restart–Restore numeric transitions | 當下 playback literal | 無 numeric 缺口；playback 只可由 live record 填值 |
| T5 | READY | finite/`-Infinity`/NaN/`+Infinity` source results與 ledger outcomes | ordinary UI sentinel injection | 要瀏覽器演示 sentinel，需受控 frame injector/selector |
| T6 | READY | canonical baseline、U/active-beam/Pt adjustments、ratio-of-sums | live publisher/profile/rated-cap browser gate | 無 explicit rated cap 時：BLOCKED，新增 governed rated-cap field/selector |

本矩陣沒有把「本回刻意不啟動瀏覽器」誤報為 data-contract BLOCKED；所有 T1–T6 都已有 source/test/fixture 可重算數字。完成後停止，不修改 deck 或 project source。
