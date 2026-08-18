# C-120 current downstream entry

Status: **OWNER-ACCEPTED / DIRECTION C / PLANNING COMPLETE**  
Date: 2026-08-09  
Audience: future PPT and simulator development sessions  
Implementation in this planning conversation: **FORBIDDEN**

> **Start here. Do not recursively read this planning tree.** The map, research,
> reviews and archive preserve controller evidence and history; they are not a
> second requirements bundle. If another document conflicts with this routing
> file, use the source precedence below and stop on any unresolved conflict.

## 1. Current decision in one paragraph

為 20 位非通訊背景 STEM 競賽學員製作 exact-120 的 energy-first 課程；LEO
只是用來學習可移轉節能決策的案例。每位學生一人一機，親自完成一次短的
TLE-to-NTPU data anchor、三個不同機制的 full labs、prediction/control
evidence clinic 與累積 competition transfer。最快交付路徑是
**Leo-like NTPU visual host + isolated C-120 course route + coherent,
deterministic simulated fixtures**；真實 backend 不是課程 prerequisite。
BeamShift 只作 formal backend／trace／replay／provenance donor；若 Leo Gate 0
隔離失敗才切 New shell。

## 2. Source precedence

1. **Owner 的最新明示修正**。
2. **課程與 storyboard authority：**
   [`issues/11-120min-energy-first-curriculum-reset.md`](issues/11-120min-energy-first-curriculum-reset.md)
   的 `C-120-ENERGY-DECISION-1R`。
3. **產品／交付策略 authority：**
   [`decisions/ADR-C-003-c120-fixture-first-visual-host.md`](decisions/ADR-C-003-c120-fixture-first-visual-host.md)。
4. **公式、欄位與 parity authority：**
   [`contracts/angle-aware-ee-v1/README.md`](../../contracts/angle-aware-ee-v1/README.md)、
   [`PARITY-PLAN.md`](../../contracts/angle-aware-ee-v1/PARITY-PLAN.md) 與
   [`golden-vectors.json`](../../contracts/angle-aware-ee-v1/golden-vectors.json)。
5. **競賽目的：**`/home/u24/papers/platform/intro.md`。

`map.md`、issues 01–10、`research/`、`reviews/` 與 `archive/` 都不能覆寫上述
authority。研究只可補 citation／rationale；review 只可證明曾怎麼審；archive
只可回答歷史問題。

## 3. Binding course contract

- Audience：20 位一人一機、非通訊背景 STEM 大學生，目的是智慧節能與 IoT
  競賽發想，不是成為衛星專家或 simulator validator。
- Prerequisites：基本代數、比例、單位、表格／折線圖與一般電腦操作；不假設
  dB/link budget、SNR/SINR、軌道力學、衛星通訊、程式設計或除錯。
- Student role：energy decision maker。學生作 prediction、具後果的選擇、
  replay、withheld-case 判斷、因果解釋與 competition transfer；不安裝套件、
  不改 source、不修 bug、不驗證公式／SGP4、不搬運重複中間檔。
- 唯一 headline metric：既定 boundary 下的 canonical
  `delivered bits / consumed J`。W、J、bit/s、bit/J、active time、service pass、
  freshness、deadline、energy budget 與 delivered bits 必須分欄，不建立另一套
  ratio 或 browser EE 公式。
- 每位學生最後留下同一份 reopenable `Energy Decision Workbook`；全課最多
  八個 constructed responses，其餘 choices、runs、units 與結果自動保存。

### Exact 120 minutes

| Clock | Min | Current segment |
|---|---:|---|
| 00–10 | 10 | Energy claim detective：service、boundary、W/J/bit-J |
| 10–18 | 8 | 每人 TLE-to-NTPU data anchor |
| 18–41 | 23 | Lab A — Same job, different pace |
| 41–64 | 23 | Lab B — Act now or wait |
| 64–69 | 5 | Recovery reset |
| 69–92 | 23 | Lab C — Spend the joules |
| 92–106 | 14 | Evidence clinic — Prediction is not saving |
| 106–120 | 14 | Competition transfer and exit |
| **Total** | **120** | **Exact; no installation/waiting filler** |

完整 learner question、explanation、prediction、operation、observation、
explanation、misconception、recovery/self-study、Lab C textual storyboard 與
surface/stop gates 只讀 issue 11，不從舊 C-90 文件拼裝。

## 4. `PPT_INPUT`

### Mandatory

1. 本入口檔。
2. issue 11：課程內容、cadence、segment contracts、Lab C storyboard 與
   empirical claim boundaries。
3. `contracts/angle-aware-ee-v1/README.md`：只作公式／欄位／claim boundary；
   不重新討論或改寫模型。
4. `/home/u24/papers/platform/intro.md`：競賽目的與智慧節能／IoT framing。

### Production gate

- 第一個 deliverable 仍只是一頁完整課程大綱，加八個 segment overview；owner
  接受後才製作 full deck。
- 舊 Phase-0 PPTX/PDF/renders 已移至 `archive/deck/phase-0-architecture/`，其
  C-90 + conditional E3 結構不得重用為 current outline。
- 不在無 simulator evidence 時製造 screenshots、KPI 或「已可操作」畫面；可先
  用誠實 placeholder 標出未來截圖位置。
- 研究資料只有在需要 citation 時按題讀取，不得因此改動 accepted cadence、
  labs 或 metric。

### Not PPT inputs

ADR-C-003、implementation tickets、BeamShift code、old prompts、old deck 與
controller map 不是簡報內容來源；除非要說明 simulator claim ceiling，PPT
session 不必讀它們。

## 5. `SIMULATOR_INPUT`

### Mandatory

1. 本入口檔。
2. issue 11：learner behavior／evidence／recovery requirements。
3. ADR-C-003：host、provider、identity、claim ceiling、Gate 0、stop rule 與 future
   `C120-IMP-*` decomposition。
4. angle-aware EE `README + PARITY-PLAN + golden-vectors`。
5. Implementation cwd：`/home/u24/demo/leo-beam-sim`；寫入前先保護該 repo 的
   existing dirty/untracked C-90 WIP，不得 reset／stash／覆寫。

### Critical path

- 先完成能讓學生走完整 C-120 的 coherent simulated-data version；不等 live
  backend、校準、server 或真實 parity。
- 只重用 Leo 的 isolated NTPU visual leaf；不得把 legacy `App/MainScene`、舊
  teaching EE、C-90 stage semantics 或 display-only manual handover 偷渡進 current
  route。
- 一個 fixture/scenario identity 同步驅動 scene、service、time、W、J、delivered
  bits、canonical bit/J、warnings 與 export；mismatch fail closed。
- A candidate、B frozen rule、C schedule、clinic action 都必須成為 authoritative
  replay input 並造成可觀察後果，不能是 cosmetic preset。
- 每個 surface 顯示 `SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT
  CANONICAL-PARITY-VERIFIED`，直到相應 evidence 真正成立。

現有 `/home/u24/demo/leo-beam-sim/src/course/**` 是 C-90 untracked WIP／donor，
不是 C-120 implementation authority。

## 6. Optional backend lane

Backend 不是 Phase-1 prerequisite。只有在 ADR-C-003 的 provider contract 已由
單一 owner 凍結後，才可於**另一 development session**平行工作：

- course lane 擁有 route、student UI、session/workbook、fixtures 與 recovery；
- backend lane 只擁有 provider implementation、canonical adapter 與專屬
  tests/artifacts；
- 不共寫 contract/UI/fixture files，不改 learner workflow、C-120 semantics 或
  claim ceiling；
- 任何 schema churn、shared write、runtime coupling 或課程回歸風險都使 backend
  lane 立即讓位，延至課程後再整合。

BeamShift、論文、訓練、校準與 server 工作不因本入口而自動獲得修改授權。

## 7. `HISTORICAL_DO_NOT_USE_AS_CURRENT`

- `archive/issues/05-*`、`06-*`、`07-*`：舊 cadence、cycles、C-90 storyboard 與
  conditional external E3。
- `archive/issues/08-strategy-decision-full-history.md`：host comparison 全歷史。
- `archive/decisions/ADR-C-001*`、`ADR-C-002*`：已 superseded host decisions。
- `archive/prompts/`：舊 C-90 implementation／audit／deck prompts。
- `archive/deck/phase-0-architecture/`：舊 outline、PPTX、PDF、renders、QA 與
  LibreOffice scratch profiles。
- `archive/reviews/2026-08-09-multi-model/`：C-90 review provenance。
- `archive/research/120min-external-artifact-module.md`：舊 conditional E3 research。
- `archive/controller-map-full-history.md`：完整決策歷史 snapshot。

Archive 可讀、可追溯、可恢復，但不得被 downstream prompt 列成 mandatory input。

## 8. Remaining unknowns are gates, not planning alternatives

Fresh browser pixels、3–5 novice timing/comprehension、20-seat recovery、keyboard/
accessibility、fixture diversity、human visual acceptance 與 canonical backend parity
仍為 `UNKNOWN`。它們在 future development/validation session 驗證；不得用 archive
中的舊 PASS、測試或漂亮畫面提前升級。

## 9. Stop boundary

Direction C 的教案與產品策略已定案。本 planning workspace 到此只維護 authority
與 handoff，不執行 simulator、UI、slides、install、server、commit 或 push。
Direction S（純多波束 LEO handover engineering）仍是完全獨立、deferred 的工作線。
