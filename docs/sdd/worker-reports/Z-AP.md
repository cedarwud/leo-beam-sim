# Z-AP：`App` 第三輪純衍生計算下沉

本輪只處理 `src/App.tsx` 內可證明為純輸入→輸出的衍生計算。沒有執行任何
git 寫入指令，沒有執行 `*:browser` validator，沒有修改 `check:ee`／
`check:visual`，也沒有碰 cellId／beamId owner 決定。共享 checkout 中其他
worker 的 dirty WIP 保持原狀。

## 分組與判斷

### 1. Profile／topology pipeline

`signalTunedProfile` 只依賴 base profile、signal tuning、training axes、seed
triplet 與 active topology，沒有 setter、ref、clock 或 feedback edge。既有
`src/app/walkerSignalProfile.ts` 已經提供命名 input 的純函式與 Node 測試；本輪
將 `App` 接到該模組，不再在元件內重複 pipeline。

`runtime` 雖然包含計算，但它是跨 profile、timeline seek、camera、viewport、
topology、handover reset 與 teaching state 的匯流 adapter；既有
`buildAppRuntimeConfig` 已承擔純 implementation，不能再包一層大介面。

### 2. Canonical frame → teaching read model

`canonicalTeachingLinkSnapshot` 是從已接受的 canonical frame 取第一條 link，
做角度與 throughput 單位轉換，再回傳 teaching panel 所需 read model。它不讀
React state 的 setter、不寫 ref、不啟動 producer 或 canvas，因此切成
`canonicalTeachingLinkSnapshot` 純模組；`App` 只保留一個 `useMemo` adapter。

### 3. 已有純 builder 與 integration adapter

`homepageRailProjection`、`timelineRailDescriptor`、`homepageDemoWindow`、
`automaticIntraPresentationSlots` 等區段的核心已分別由既有 pure projection／
builder 承擔。本輪不為「組 input 再呼叫既有函式」製造第二個淺模組；continuity
ref、lane gate 與 event-index selection 仍由 `App` 保持。

### 4. Lifecycle／command／UI tree

effect、非同步載入、seek／mode／handover callback、camera orchestration 與 JSX
tree 都含 state/ref 寫入或外部控制通道。本輪不把它們偽裝成 custom hook，也不
改變 archived-TLE 的 ref／播放循環控制通道。

## 每組結果

### Profile／topology pipeline：完成接線

純模組介面：

```ts
deriveWalkerSignalTunedProfile(
  input: WalkerSignalProfileInput,
): Profile
```

`WalkerSignalProfileInput` 只有 5 個命名欄位：`baseProfile`、`signalTuning`、
`selectedTrainingEnvAxes`、`selectedTrainingSeedTriplet`、`activeSceneTopology`。
計算順序維持原行為：signal tuning → training axes → legacy constellation
preset → active topology。

`App` 現在只組 input 並呼叫純函式；原本 21 行的 inline pipeline 變成 13 行
adapter。既有 `src/app/walkerSignalProfile.ts` 為 39 行，
`src/app/walkerSignalProfile.test.ts` 為 40 行。Focused command：

```text
node --import tsx/esm --test src/app/walkerSignalProfile.test.ts
1 file passed
```

本標的完成後 `npx tsc --noEmit -p tsconfig.json --pretty false` exit 0。

### Canonical teaching link snapshot：完成

新增 `src/app/canonicalTeachingLinkSnapshot.ts`，純模組介面為：

```ts
deriveCanonicalTeachingLinkSnapshot(
  frame: CanonicalTeachingLinkSnapshotSource | null,
): CanonicalTeachingLinkSnapshot
```

`CanonicalTeachingLinkSnapshotSource` 只暴露 projection 需要的窄資料：第一條
canonical link、candidate satellite、run elapsed time、transmit-gain matrix、
system power 與 instantaneous EE。空 frame 或沒有 link 時回傳全 null read
model；有資料時保留原本的角度（degree）與 throughput（Mbps）轉換。

新增 `src/app/canonicalTeachingLinkSnapshot.test.ts`，2 個 `node:test` cases：

- 驗證第一條 link、candidate、run anchor、gain、角度、Mbps、power 與 EE 的完整 mapping。
- 驗證 `null` frame 與空 `links` 都 fail closed 為全 null。

模組為 69 行，測試為 72 行；`App` 原本 31 行裸邏輯現在是 4 行
`useMemo` adapter。Focused command：

```text
node --import tsx/esm --test src/app/canonicalTeachingLinkSnapshot.test.ts
1 file passed; 2 test cases passed
```

本標的完成後，最終完整驗證的 `npx tsc --noEmit -p tsconfig.json --pretty false`
exit 0。新純模組沒有 React 或 canvas runtime import。

### 最終驗證與行數記錄

```text
node --import tsx/esm --test \
  src/app/walkerSignalProfile.test.ts \
  src/app/canonicalTeachingLinkSnapshot.test.ts
tests: 2 files passed, 0 failed
npx tsc --noEmit -p tsconfig.json --pretty false
exit 0
```

`src/App.tsx` 由 HEAD 的 4,602 行變為目前 4,565 行。這只是變更記錄，不是
成功指標；本輪驗收依據是純介面、無 React／canvas 測試與 typecheck。

## 我判斷不該抽的

- `runtime`：跨 profile、seek、camera、viewport、topology、reset 與 teaching
  的匯流 adapter；純部分已在 `buildAppRuntimeConfig`，再抽會製造大參數介面。
- `homepageRailProjection`：`projectHomepageRail` 已是純 projection，但同一段還
  要讀寫 `homepageRailContinuityRef` 並維持 accepted snapshot continuity；ref
  mutation 留在 integration owner。
- `handleHandoverPresentationChange`：把 renderer owner envelope 轉成 state，並
  呼叫 `setVisibleHandover`；是 presentation state adapter。
- `requestMovingIntraDemo`：讀寫 busy ref、request sequence、playback 與 manual
  handover state；只有 admission predicate 可純化，整個 callback 不抽。
- `handleSimUpdate`：接收 scene publisher 更新，寫 sim／time／evidence／reset
  相關 state 與 refs；是 runtime publication edge。
- `facts` effect：將 frame facts 寫入 teaching refs/state，屬於 effect lifecycle。
- `applyHandoverModeSideEffects`：同時 reset simulation、playback、sidebar、
  policy 並 persist mode；是跨 state feedback edge。
- `handleAppModeChange`：更新 profile map ref、persist mode/profile、切換 app mode
  並呼叫 side effects；不是純轉換。
- `handleLoadIntoScene`：包含 training service／metadata／bundle fetch、validation、
  error feedback 與多個 setter；不能抽整個 callback。
- `handleRevertToPaperFaithful`：重設 user-trained／omega／profile／sidebar 等
  state，並非單一輸出函式。
- `handleLoadFamilyBDenseQ`：包含 fetch、envelope validation、provenance state
  與 error state，是載入 lifecycle。
- 第一個 `cancelled` effect：非同步 MODQN bundle fetch 與 cancellation guard，
  有 I/O 與 state publication。
- `tickSec` effect：interval／elapsed ref／playback state 形成 clock feedback。
- `slotOffset` effect：依 replay slot 更新 display state 與 playback elapsed，含
  equality guard 與 setter synchronization。
- 202 行的 `cancelled` effect：handover index 的 incremental build、idle yield、
  cancellation 與 final publication；不是純 projection。
- `cached` effect：artifact fetch、header provenance、cache、loading/error state
  綁在一起。
- `others` effect：prefetch、idle scheduling、cache 與 cancellation 綁在一起。
- `automaticIntraPresentationSlots`：純 schedule builder 已由
  `buildNonOverlappingIntraPresentationSlots` 承擔；剩下的是 scene/lane gate，
  不另包薄模組。
- `scheduleState` effect：修改 schedule ref、處理時間倒退並觸發 scheduled cue，
  是時間與 presentation feedback。
- `timelineRailDescriptor`：`resolveTimelineRailDescriptor` 已是受測純模組；
  App 只組跨 lane input。
- `initialTimeSec` effect：包含 RAF、external seek detection、cursor ref、pause
  與 canonical selector，且是 archived-TLE 外部控制通道；不能為可抽而改語意。
- `homepageDemoWindow`：`selectHomepageDemoWindow` 已是純 selector；本段負責 route
  gate、index readiness 與 focused-UE event selection，留在 App。
- `handleTimelineSeek`：lane precedence、canonical selector、replay controller、
  live seek request、analysis reset 與 state publication 互相回饋。
- `useDirectorOrchestration` 的匿名 input：物件含 camera、playback、controller、
  refs、setters 與 handlers，是 orchestration adapter。
- `handleHomepageTeachingSeekSource`：clamp 後呼叫 timeline seek 並 pause playback，
  有 command side effects。
- `jumpHomepageToIndexedEvent`：取消 focus、seek、切 teaching state、改 speed、
  resume playback，是導覽 callback。
- `handleDirectorNextIntra`：在 queue、cinema、indexed event 與 moving trigger
  間路由，會觸發既有 presentation owner。
- `teachingInterRosterSatelliteIds`：計算本身純，但依賴完整 homepage rail／beam
  metrics presentation contract；本輪已鎖定兩個低風險 seam，不新增第三個 teaching
  roster interface。
- `teachingIdentityBinding`：純資料組合但有 rail、metrics、satellite-name map、
  stage kind、roster 與 SimState 多方耦合；89 行不是本輪的小深模組，先保留在
  teaching integration owner。
- `teachingSceneStoryCandidate`：雖然主要是純 mapping，但它同時決定 teaching
  identity、cell layout fallback 與 scene story key；需先收斂 teaching／scene
  authority，不在本輪建立第二個 story seam。
- `requestManualHandover`：建立 request id、presentation endpoints、refs 與 state，
  是 one-shot command owner。
- `handleQuickIntra`：會呼叫 request／trigger、更新 teaching stage 與 playback，
  不是純函式。
- `intent` effect：消費 queued jump intent，呼叫 focus/seek/cinema owner，並清 ref。
- `intraTeachingDisplayState`：projection 可測，但本輪只交付 canonical teaching
  read model；另有既有 `walkerIntraTeachingDisplay` 純 seam 可供後續接線，不在
  本輪擴到第三個標的。
- `handleExperienceChange`：同步 URL、切 scene source/app mode、清 artifact 並
  釋放 presentation ownership，是 route transition feedback edge。
- `handleHandoverRailSeek`：依 lane 導向 timeline／Director／MODQN，並寫 request、
  clear observed events 與 visual elapsed；不是純 projection。
- `handoverEventRail`：`HandoverEventRail` 與 `DirectorControls` JSX tree，應走
  presentational component seam，不是純 module。
- `timelineBar`：TimelineBar JSX 與 playback callbacks 的 UI composition，不抽成
  純函式。
- 3747 附近的 `cancelled` effect：simulation source change 的非同步 reset／cancel
  lifecycle，含 state/ref publication。
- `handleSimulationSourceChange`：退出 camera/cinema、清 request、恢復 timeline、
  persist source 並切 state，是 source transition owner。
- `homepageRailPanel`：HomepageBeamRail／waiting fallback 的 JSX tree 與 visible
  surface gate，不是純計算。

## 寫不出測試因此退回的

無。本輪沒有任何候選因為「寫不出不掛 React、不啟動 canvas 的測試」而硬抽或
半交付。未抽候選的理由是既有 pure builder、state／ref／I/O feedback、UI tree、
authority coupling 或本輪 scope stop；它們不應被誤記為測試失敗。
