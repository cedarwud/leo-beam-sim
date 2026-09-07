# W-AP：`App` 第三輪續作——兩個純 selector 下沉

本輪接續目前 HEAD 已完成的 App 第三輪首切片。既有 `walkerSignalProfile` 與
`canonicalTeachingLinkSnapshot` 不重做；本輪只處理目前仍留在 `src/App.tsx`
且可證明為純輸入→輸出的兩段衍生計算。

本輪沒有執行任何 git 寫入指令，沒有執行 `*:browser` validator，沒有修改
`check:ee`／`check:visual`，也沒有碰 cellId／beamId owner 決定。共享 checkout
中其他 worker 同時留下的 `MainScene.tsx`、`SceneTelemetry.tsx`、
`UnifiedVisualLabPrototype.tsx` 與其他未追蹤 scene／visual-lab 檔案均未觸碰。

## 分組與判斷

### 1. Live Walker event-index source-gap selector：抽取

原段只根據五個已命名的 runtime 值選擇三種結果：rebuilding gap、not-ready gap、
或既有 index 的 source gaps。它不寫 state/ref、不呼叫 I/O、不建立 clock，也不
改變 handover decision。輸入可縮成 `sceneSource`、Walker surface gate、`sceneLane`、
building flag 與 `sourceGapReasons`，適合形成純 module。

### 2. Teaching inter roster ranking：抽取

原段只做候選 satellite 去重、排除 serving satellite、以每顆衛星的最高已量測 EE
排序，並補入只出現在 beam metrics 的 replacement satellite。它不寫 state/ref，
不建立 candidate、decision 或 presentation；只需 serving ID、candidate satellite
IDs 與窄的 satellite/EE records，能直接以 Node 單測驗證。

### 3. 其餘候選：保留在 integration owner

effect、非同步 fetch、seek、playback、presentation owner、camera orchestration、
React JSX，以及會讀寫 continuity／latch ref 的 projection 都不是本輪的純 module
候選。已存在的 pure builder 也不再包一層只負責組參數的淺 module。

## 每組結果

### Live Walker event-index source-gap selector：完成

新增 `src/app/liveWalkerEventIndexSourceGap.ts`，純模組介面為：

```ts
resolveLiveWalkerEventIndexSourceGapReasons(
  input: LiveWalkerEventIndexSourceGapInput,
): readonly string[]
```

`LiveWalkerEventIndexSourceGapInput` 只有五個欄位：
`sceneSource`、`isWalkerSceneActive`、`sceneLane`、`indexBuilding`、
`indexSourceGapReasons`。它只接收 index 的 `sourceGapReasons`，不接完整
`LiveWalkerHandoverEventIndex`，因此不會把 event index ownership 拉進 module。

`App` 保留 `useMemo` adapter，維持原本的優先順序：building 先於 stale gaps，
live Walker surface 缺 index 時回報 not-ready，其他 lane 原樣傳遞既有 gaps。

新增 `src/app/liveWalkerEventIndexSourceGap.test.ts`，3 個 cases：

- building 時優先回報 rebuilding gap；
- live index 缺失時回報 not-ready gap；
- 非 live-index surface 原樣傳遞既有 gaps。

驗證：

```text
node --import tsx/esm --test src/app/liveWalkerEventIndexSourceGap.test.ts
tests 3, pass 3, fail 0, exit 0
```

行數記錄：HEAD 中原 App 區段為 19 行（L2275–2293）；目前 App adapter 為 10 行，
純模組 36 行，測試 40 行。行數只記錄搬移結果，不作成功指標。

### Teaching inter roster ranking：完成

新增 `src/app/teachingInterRoster.ts`，純模組介面為：

```ts
resolveTeachingInterRosterSatelliteIds(
  input: TeachingInterRosterInput,
): readonly string[]
```

`TeachingInterRosterInput` 只有 `servingSatelliteId`、
`candidateSatelliteIds`、`beamMetrics` 三個命名欄位；`TeachingInterRosterMetric`
只保留 `satelliteId` 與 `energyEfficiencyBitsPerJoule`。實作保留原本的候選去重、
serving 排除、每顆衛星取最高 EE、metrics 補入與穩定排序，回傳 frozen array。

`App` 只把 `homepageRailProjection` 的窄資料映射成 input，沒有把整個 rail
projection 或 `SimState` 暴露給新 module。

新增 `src/app/teachingInterRoster.test.ts`，3 個 cases：

- 候選去重並以每顆衛星最高量測 EE 排序，且排除 serving；
- metrics 中新增但 roster 沒有的 replacement satellite；
- 沒有 EE 差異時保留候選原順序。

驗證：

```text
node --import tsx/esm --test src/app/teachingInterRoster.test.ts
tests 3, pass 3, fail 0, exit 0
```

行數記錄：HEAD 中原 App 區段為 23 行（L2936–2958）；目前 App adapter 為 9 行，
純模組 32 行，測試 41 行。行數只記錄搬移結果，不作成功指標。

### 交叉驗收

```text
node --import tsx/esm --test \
  src/app/liveWalkerEventIndexSourceGap.test.ts \
  src/app/teachingInterRoster.test.ts \
  src/app/timelineRailAuthority.test.ts \
  src/app/homepageHandoverControlsOwnership.test.ts \
  src/app/homepagePlaybackTransportOwnership.test.ts
tests 16, pass 16, fail 0, exit 0

npx tsc --noEmit -p tsconfig.json --pretty false
exit 0

git diff --check
exit 0
```

本輪 App 為 HEAD 的 4,565 行至目前 4,544 行。這不是成功指標；真正的驗收是兩
個新 module 均可不掛 React、不啟動 canvas 直接由 `node:test` 驗證，且 typecheck
與既有 owner/transport 回歸均為綠燈。

## 我判斷不該抽的

以下逐項依目前 `App.tsx` 的候選材料判斷；「不抽」不等於邏輯錯誤，而是保留
authority、feedback edge 或既有 pure seam。

- `runtime`：跨 profile、timeline seek、camera、viewport、topology、handover reset
  與 teaching state 的匯流 adapter；純 implementation 已由
  `buildAppRuntimeConfig` 承擔，再抽會形成寬介面。
- `homepageRailProjection`：核心 `projectHomepageRail` 已是純 projection，但外層
  會讀寫 `homepageRailContinuityRef`，並保留 accepted snapshot 的 continuity；ref
  mutation 必須留在 integration owner。
- `handleHandoverPresentationChange`：將 renderer owner envelope 轉成 state，並呼叫
  `setVisibleHandover`，是 presentation state adapter。
- `requestMovingIntraDemo`：讀寫 busy ref、request sequence、playback 與 manual
  handover state；整個 callback 不是純輸出函式。
- `handleSimUpdate`：接收 scene publisher 更新，寫 sim/time/evidence/reset state 與
  refs，是 runtime publication edge。
- `facts` effect：將 frame facts 發布到 teaching refs/state，屬 lifecycle effect。
- `applyHandoverModeSideEffects`：同時 reset simulation、playback、sidebar、policy
  並 persist mode，是跨 state feedback edge。
- `handleAppModeChange`：更新 profile map ref、persist mode/profile、切換 app mode
  並呼叫 side effects，不是純轉換。
- `handleLoadIntoScene`：含 training service/metadata/bundle fetch、validation、error
  feedback 與多個 setter，不能抽整個 callback。
- `handleRevertToPaperFaithful`：重設 user-trained、omega、profile、sidebar 等 state，
  不是單一輸出函式。
- `handleLoadFamilyBDenseQ`：含 fetch、envelope validation、provenance 與 error state，
  是載入 lifecycle。
- MODQN bundle fetch 的 `cancelled` effect：有 I/O、cancellation guard 與 state
  publication。
- `tickSec` effect：interval、elapsed ref 與 playback state 形成 clock feedback。
- `slotOffset` effect：同步 replay display state 與 playback elapsed，含 setter/equality
  guard。
- 202 行的 event-index `cancelled` effect：incremental build、idle yield、cancellation
  與 final publication 綁在一起，不能抽成 projection。
- artifact fetch 的 `cached` effect：fetch、header provenance、cache、loading/error
  state 綁在一起。
- prefetch 的 `others` effect：idle scheduling、cache 與 cancellation 綁在一起。
- `automaticIntraPresentationSlots`：純 schedule builder 已由
  `buildNonOverlappingIntraPresentationSlots` 承擔，App 剩下的是 scene/lane gate。
- `scheduleState` effect：修改 schedule ref、處理時間倒退並觸發 cue，是 time/presentation
  feedback。
- `timelineRailDescriptor`：`resolveTimelineRailDescriptor` 已是受測 pure module，App
  只組跨 lane input。
- archived-TLE `initialTimeSec` effect：含 RAF、external seek detection、cursor ref、
  pause 與 canonical selector；`>= 15` 秒門檻是外部 seek 與自身遞增的控制通道，不能
  為可抽取性改寫。
- `homepageDemoWindow`：`selectHomepageDemoWindow` 已是純 selector；App 仍需保留 route
  gate、index readiness 與 focused-UE event selection。
- `handleTimelineSeek`：lane precedence、canonical selector、replay controller、live
  seek request、analysis reset 與 state publication 互相回饋。
- `useDirectorOrchestration` 的 input：包含 camera、playback、controller、refs、setters
  與 handlers，是 orchestration adapter，不是純衍生計算。
- `handleHomepageTeachingSeekSource`：clamp 後呼叫 timeline seek 並 pause playback，
  有 command side effects。
- `jumpHomepageToIndexedEvent`：取消 focus、seek、切 teaching state、改 speed、resume
  playback，是導覽 callback。
- `handleDirectorNextIntra`：在 queue、cinema、indexed event 與 moving trigger 之間
  路由，會觸發 presentation owner。
- `teachingIdentityBinding`：雖含資料組合，但同時依賴 rail、metrics、satellite-name
  map、stage kind、roster 與 `SimState`，是 teaching integration contract；本輪不再
  製造寬介面。
- `teachingSceneStoryCandidate`：會同時決定 teaching identity、cell layout fallback
  與 scene story key；需先收斂 teaching/scene authority，不能只搬 mapping。
- `requestManualHandover`：建立 request id、presentation endpoints、refs 與 state，是
  one-shot command owner。
- `handleQuickIntra`、`handleQuickInter`：呼叫 request/trigger、更新 teaching stage
  與 playback，不是純函式。
- `intent` effect：消費 queued jump intent、呼叫 focus/seek/cinema owner 並清 ref。
- `intraTeachingDisplayState`：雖可視為 projection，但輸入是寬 `SimState`，輸出是
  presentation-latched 的替代 state；本輪 scope 已有較窄的 teaching seam，不再擴張。
- `handleExperienceChange`：同步 URL、切 scene source/app mode、清 artifact 並釋放
  presentation ownership，是 route transition feedback edge。
- `handleHandoverRailSeek`：依 lane 導向 timeline/Director/MODQN，並寫 request、清 observed
  events 與 visual elapsed。
- `handoverEventRail`：`HandoverEventRail` 與 `DirectorControls` JSX tree，應走
  presentational component seam。
- `timelineBar`：`TimelineBar` JSX 與 playback callbacks 的 UI composition，不是純函式。
- simulation-source `cancelled` effect：非同步 reset/cancel lifecycle，含 state/ref
  publication。
- `handleSimulationSourceChange`：退出 camera/cinema、清 request、恢復 timeline、persist
  source 並切 state，是 source transition owner。
- `homepageRailPanel`：`HomepageBeamRail`/waiting fallback 的 JSX tree 與 visible-surface
  gate，不是純計算。
- `walkerTeachingLinkSnapshot`：本身是小型純 mapping，但低於本輪提供的候選規模，且
  canonical teaching snapshot 已經是同一 read-model seam；本輪維持 scope stop，不再
  增加第三個近似 module。

## 寫不出測試因此退回的

無。本輪兩個實際下沉候選都能以不掛 React、不啟動 canvas 的 `node:test` 測試，沒有
任何標的因為測試介面不成立而回退。其餘保留項目是因為 state/ref/I/O/clock/presentation
ownership、既有 pure builder 或 authority coupling，不把它們誤記為「測試寫不出來」。
