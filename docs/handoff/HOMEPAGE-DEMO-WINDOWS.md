# Homepage `/` Walker demo windows

日期：2026-09-03（Asia/Taipei）  
範圍：`/` homepage、synthetic Walker、`sinr-live`、兩小時 `live-walker-window`。

## 結論

目前最小而可重跑的 source-backed 教學 window 是 source time `466–626 s`。
同一個 primary-UE trajectory 會先產生 intra，再產生 inter；但 source
diagnostic、event-index、presentation 與 browser acceptance 仍必須分開記錄：

| 層次 | natural window 的 intra | 同一 window 的後續 inter | 可宣稱的內容 |
|---|---:|---:|---|
| Source-backed event index / diagnostic（2 s cadence） | commit `476 s` | commit `606 s` | canonical EE decision、TTT、kind、from/to link、source time/frame identity |
| Natural playback teaching segment | candidate/qualifying before `476 s` | candidate/qualifying before `606 s` | live scene 不停下；右欄與場景沿同一 accepted snapshot 更新 |
| Port-3000 browser presentation | 尚待驗收 | 尚待驗收 | 不把 headless source receipt 冒充畫面、camera 或 WebGL acceptance |

不要把 source commit time、候選開始時間與 browser presentation 混成一個事件。
目前可重跑的 source receipt 是 `476/606 s`；它不是瀏覽器 render-FPS 或人工畫面
驗收的替代品。

## 首頁 index 的 source truth

以目前首頁 runtime 等效參數重建 7200 s index：

```text
profile=hobs-2024-candidate-rich
epoch=2026-08-25T12:00:00.000Z  (台北場景顯示 2026-08-25T20:00)
simStepSec=2
ueCount=100, primaryUeId=live-ue-0
primaryJogEastKm=10, primaryJogNorthKm=0
ueDistributionMode=seven-cell-asymmetric
uePrimaryAnchorMode=observer
ueDistributionScope=beam-footprint
ueMobilityMode=static
servingBeamCount=7, candidateBeamCount=7
beamHoppingEnabled=false
beamPointingMode=sampled-steering
multiCandidateDecisionEnabled=true
```

Index metadata 是：

```text
sourceOwner=sinr-live-cell-truth
horizonKind=live-walker-window
claimKind=live-truth
durationSec=7200
ueScope=primary-ue-only
aggregateUeCount=100
aggregateClaim=not-100-ue-aggregate
runtimeFramePath=stepRuntimeFrame+sinrLiveCells
```

首頁 natural story 的 source geometry 由
`src/homepage/controller/homepageStoryScenario.ts` 的單一常數提供。以目前
固定 epoch、2 s cadence、700 s diagnostic window 重跑時，primary UE 觀察到
`8` 個 commit：`1 intra`、`7 inter`；自然教學 selector 只取第一個完整的
`intra -> later inter` pair。這是可重現的 source evidence，不是
把所有場上衛星列成候選的 UI 數量。

第一個兩筆 primary source receipt：

```text
INTRA
sourceTimeSec=476, sourceFrameId=walker:1787659200000:1787659676000
from=shell-pro-42-P16-S4 beam 1 / geographic cell preserved
to  =shell-pro-42-P16-S4 beam 421 / same geographic cell
kind=intra  (same satellite, same geographic cell, distinct beam)
decision kind=intra; target is selected by the canonical max-EE decision path

INTER
sourceTimeSec=606, sourceFrameId=walker:1787659200000:1787659806000
from=shell-pro-53-P23-S1 beam 1
to  =shell-pro-42-P21-S1 beam 1
kind=inter  (cross-satellite change)
decision kind=inter; target is selected by the canonical max-EE decision path
```

source event rows and live decision receipts have different contracts. Do not
fabricate a `sourceFrameId` from an event id or time; use the live receipt's
actual frame id when explaining the commit.

## Live measured frame

同一 profile/epoch/100-UE substrate，用現有
`diagnose-multi-candidate-window.ts` 以 2 s cadence 跑 `0–700 s`，輸出包含：

```text
commit intra shell-pro-42-P16-S4|1 -> shell-pro-42-P16-S4|421
  t=476.000s frame=walker:1787659200000:1787659676000

commit inter shell-pro-53-P23-S1|1 -> shell-pro-42-P21-S1|1
  t=606.000s frame=walker:1787659200000:1787659806000

primaryCellTruthEvents=8; first intra@t=476.000s; paired later inter@t=606.000s (global first inter@t=68.000s)
VERDICT FLOW-OBSERVED
REQUIRE-FLOW PASSED
```

這些是 `stepRuntimeFrame` + `attachSinrLiveCellFrame` 路徑產生的 runtime decision/commit evidence，不是瀏覽器 DOM 或 render-FPS 取樣。`sourceFrameId` 只在這個 live decision receipt 上成立。

## Presentation seek 與重現步驟

1. 以乾淨的瀏覽器 context 開 `http://127.0.0.1:3000/`；不要帶入舊的
   topology override。確認 Walker/live-truth/7200 s attributes。
2. 讓 source timeline 從 `T+0:00` 播放；不要先用 `Next` 按鈕製造動畫。
   在約 `T+7:56` 前，右欄應能看到服務與真正合格候選的數值；接著在
   `ho slow` 階段看到同衛星、同 geographic cell 的 beam `1 -> 421` intra。
3. 繼續播放到約 `T+10:06`；候選應維持為可解釋的資格集合，inter 由
   `shell-pro-53-P23-S1` 轉到 `shell-pro-42-P21-S1`。commit 後只留
   新的服務實線。
4. `Next Intra/Inter` 只能作為同一 source index 的定位輔助；在 browser
   acceptance 尚未完成前，不把按鈕成功視為自然 timeline 已驗收。
5. 若要取得可核對的 source/frame receipt，執行下列 headless diagnostic。

```bash
node --import tsx/esm scripts/diagnose-multi-candidate-window.ts \
  --duration-sec 700 --step-sec 2 --ue-count 100 --require-flow
```

每次 source、decision、snapshot、scene、rail、transport 或 render gate 有變更，
以及每個前端 checkpoint 報告前，都要重跑首頁 alignment gate：

```bash
npm run validate:homepage:alignment
npm run test:homepage:alignment
```

alignment gate 只讀既有 source event 與 decision witness；它不會另建 clock、
候選選擇器或 presentation snapshot。瀏覽器仍須另外驗收
`http://127.0.0.1:3000/` 的畫面與 scene/rail join。

穩定性檢查可連續執行兩次；兩次都應先回報 intra `476 s`、再回報其後的 inter
`606 s`，並使用相同 primary source frame ids。若 topology、beam count、
primary jog 或 policy 改變，必須重新跑 alignment gate，不得沿用舊 window。

## Attach/drop 邊界

本 window 的 `kind=inter` 僅表示 from/to satellite identity 改變；`kind=intra` 表示
satellite 相同、geographic cell 相同但 beam identity 改變。attach、drop、cold
acquisition 都不算 inter，也不放入上述兩筆流程。alignment gate 會拒絕 cell
改變或 beam 未改變的 intra，並拒絕同衛星的 inter。

## 驗證命令與結果

```text
npm run validate:live-walker:7200-timeline
PASS: runtime cache spans 7200s; coverage and end-of-window frame checks passed

npm run validate:sinr-live:handover-index-chunked-golden
PASS: builder/one-shot single code path; slice=1 and slice=7 equal one-shot; deterministic second topology

node --import tsx/esm src/scene/sinrLiveCellHandoverEventIndex.test.ts
PASS 4 checks

node --import tsx/esm src/scene/liveWalkerDirectorFocus.test.ts
PASS 9 checks

APP_URL=http://127.0.0.1:3000 npm run validate:homepage:authority:browser
UNVERIFIED: the current browser attempt exceeded four minutes during the
scenario-change/ready-frame sequence and was interrupted; no browser pass is
claimed.

2026-09-03 partial CLI browser receipt (not full acceptance):
`http://127.0.0.1:3000/` loaded with title `LEO Beam Sim`; after the index became
ready, the timeline exposed the source-backed markers `INTRA 476 s` and
`INTER 606 s` (the earlier unrelated `INTER 68 s` was no longer paired into the
teaching markers). The root exposed `data-homepage-demo-window-alignment=aligned`
and the demo button sought to the `466 s` lead-in. A sample also showed matching
scene/rail `snapshotId`, `sourceFrameId`, and `phase`, with one active data link.
This is only DOM/transport evidence; full intra/inter phase, candidate
visibility, and visual/WebGL acceptance remain open.
```

## 未解限制

- 本次 port 3000 browser attempt 在 scenario-change/ready-frame sequence 超過四分鐘後被中斷；因此沒有取得完整 browser-side accepted snapshot/source-frame、camera focus 或 visual phase acceptance。這不推翻 source diagnostic，但也不能算 browser gate 通過。
- Event index 與 diagnostic 都使用 2 s source cadence；這不等於瀏覽器 render-FPS sampling，source commit time 不可直接當成畫面每一幀的時間。
- shared checkout/server 有既有 WIP 與 Vite HMR；index rebuild 時仍可能短暫顯示 updating。demo 前必須等同一組參數的 index ready，並再做 port-3000 browser gate。
- 沒有把這份 runtime/index 證據升格為 human visual acceptance、瀏覽器 live-frame acceptance 或 producer artifact proof。
