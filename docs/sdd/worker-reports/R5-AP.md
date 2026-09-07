# R5-AP：`App` 成組下沉報告

本報告中的 `Lxxx` 沿用任務提供的 `src/App.tsx` 基準行號；重構後行號已因刪除宣告而前移。

本輪只處理兩個完整的純衍生領域。基準 `App.tsx` 為 4544 行，現在為 4215 行；工作樹差異為 164 行新增、493 行刪除。沒有執行 git 寫入、`*:browser`、`check:ee` 或 `check:visual`。未觸碰其他 worker 的 dirty WIP。

## 領域分組

1. **路由、初始狀態與 runtime bootstrap（保留）**
   - `L400-405` `isLegacyWalkerRoute`。
   - `L406-419`、`L422`、`L425`、`L429-432`、`L434-446` 的 anonymous `useState`。
   - `L433` `manualHandoverRequestSeqRef`。
   - `L451-462` 的 busy/time/runtime refs：`handoverPresentationBusyRef`、`handoverControlBusyRef`、`handoverBusyRef`、`manualHandoverWasPausedRef`、`currentTimeSecRef`、`liveSimTimeSecRef`、`walkerRuntimeHasPublishedRef`。
   - `L463` `initialRuntimeRef`、`L464-466` anonymous 裸宣告、`L467` `initialRuntime`、`L468` anonymous state、`L469` `profileByModeRef`、`L470` anonymous state、`L473-475` 與 `L476` anonymous state。
   - 這裡混有初始化、持久 ref 與 state，不是純衍生計算。

2. **lane、recorded replay、Omega 與 shell chrome（保留）**
   - `L484-495`：`canToggleModqnReplayProof`、`modqnReplayProofRequestActive`、`sceneLane`。
   - `L499-501`：`isArchivedTleSceneActive`、`isWalkerSceneActive`。
   - `L507-521`：`isRecordedReplayLane`、`recordedReplayActive`、`L512`、`L518-520`、`L521` 的 state，以及 `recordedReplayArtifactUrl`。
   - `L522-539`：`omegaDisplayApplyVersionRef`、`markOmegaDisplayApplied`、`resetOmegaDisplayApplied`、`L535` state、`incrementRescalarizeFallback`、`L539` 裸宣告。
   - `L541-559` 的 state 與 `L560-574` 的 `toggleShellChrome`、`showAllShellChrome`、`hideAllShellChrome`。
   - 這些宣告控制 lane、播放、DOM shell 或 ref 寫入，未假裝成純函式。

3. **homepage canonical analysis、訓練選擇與側欄 selectors（保留）**
   - `L575-583`：`homepageCanonicalAnalysis`、`homepageSatelliteNameById` 及 homepage/training state（完整 state 範圍為 `L584-591`）。
   - `L596-598` anonymous state。
   - `L599-606` `selectedTrainingEnvAxes`、`selectedTrainingSeedTriplet`。
   - `L607-623` `visibleLeftSidebarTabs`、`activeLeftSidebarTab`、`isRootHomepage`、`visibleRightSidebarTabs`、`activeRightSidebarTab`。
   - 這些 selectors 仍依賴 homepage hook、state 與 layout policy；本輪沒有重建第二個 homepage authority。

4. **camera、visual profile 與 handover policy（保留）**
   - `L626` `beamDensityOverride`，`L631-634` anonymous state，`L639-655` `camera`、`modqnDemoCameraAppliedRef` 與 effect。
   - `L656-667` `baseProfile` 與 anonymous state。
   - `L668-697` `initialPolicy`、`handoverPolicyDefaults`、`appliedHandoverPolicy`、`handoverPolicyVersion`、`handoverPolicyDraft`、`hasHandoverPolicyDraftChanges`、`hasHandoverPolicyOverrides`。
   - `L662-664` `handleHomepageEeThresholdChange`，以及 `L698-751` 的 `handleHandoverPolicyDraftChange`、`handleApplyHandoverPolicy`、`handleResetHandoverPolicy`、`handleTeachingModeChange`。
   - policy callback 會寫回 policy state、URL 或 scene owner，不能抽成只回傳結果的 module。

5. **topology、effective profile、visual reset 與 runtime config（保留）**
   - `L757-762` `liveSceneTopologyControlsEnabled`、`activeSceneTopology`。
   - `L763-833` `signalTunedProfile`、`effectiveProfile`、`hasSignalOverrides`、`hasTopologyOverrides`、`hasVisualScaleOverrides`、`sceneVisualScaleResetKey`、`walkerScenarioEpochUtcMs`、`signalResetKey`、`signalEvidenceKey`、`handoverResetKey`。
   - `L837-857` `demoStartOffset`、`runtimeVisualSettings`、`effectiveCinematicMode`。
   - `L863-875` anonymous state/ref。
   - `L876-942` `runtime` 與 `L943-946` `visualScaleMultipliers`。
   - `runtime` 讀取多個 state、profile 與 reset 通道，且結果直接餵給 effects/scene；依前輪結論保留，不為了可抽取性改變 authority。

6. **Sim frame、teaching link snapshot 與 replay model setup（保留）**
   - `L948-955` anonymous state、`sixActsSubtitleRef`、`sixActsTeachingFactsRef`、`sixActsTeachingTraceRef`、`sixActsTeachingReceiptRef`、`sixActsAutoCameraKeyRef`。
   - `L956-978` `walkerTeachingLinkSnapshot`、`canonicalTeachingLinkSnapshot`、`teachingLinkSnapshot`。
   - `L979-992` `walkerBeamDisplayFrame`，`L997-1005` `fallbackShellModel`、anonymous state、`modqnReplayModelIssue`。
   - `L1006-1017` anonymous state，`L1021` `pendingDirectorJumpKindRef`。
   - `L1025-1054` `sceneTopologyResetKey`、`previousSceneTopologyResetKeyRef`、`modqnReplaySlotOffset`、`modqnBundleOmega`、`renderedModqnReplayDisplayState`，以及 `L1055` state。
   - 這裡同時有 Sim frame、replay artifact 與 state/ref side effects；沒有將 projection 與 runtime owner 混成新 authority。

7. **accepted handover presentation 與 homepage rail authority（保留）**
   - `L1061-1069` anonymous state、`visibleHandoverActive`。
   - `L1076-1081` `homepageRailContinuityRef`、`L1087` `multiCandidateDecision`。
   - `L1088-1129` `homepageRailProjection`，`L1130-1143` `homepageCandidateComparisonActive`、`multiCandidateComparisonActive`、`visibleHandoverBusy`、`visibleManualHandoverActive`。
   - `L1144-1198` `handleHandoverPresentationChange`、`handleHandoverPresentationBusyChange`。
   - `homepageRailProjection` 讀取 continuity ref 的既有 presentation owner；callback 又會改變 busy/ref/state。這是明確回饋邊，依前輪拒絕抽取。

8. **播放 transport、manual intra demo 與 Sim update（保留）**
   - `L1199-1221` `legacyPlayback`、`homepagePlayback`、`playback`、`resetAnalysisWindow`。
   - `L1223-1249` `requestMovingIntraDemo`。
   - `L1255-1273` effects，`L1275-1349` `handleSimUpdate`，`L1351-1385` `facts` effect。
   - `handleSimUpdate` 與 `requestMovingIntraDemo` 都是 state/ref/playback owner；`facts` effect 還會寫 teaching receipt/trace，不能當純 projection。

9. **signal/topology/policy mode transitions 與 replay loaders（保留）**
   - `L1400-1415` `handleSignalTuningChange`、`handleSceneTopologyChange`、`handleResetSignalTuning`。
   - `L1417-1461` `applyHandoverModeSideEffects`。
   - `L1467-1522` `handleAppModeChange`、`handleHandoverModeChange`、`handleModqnDecisionPolicyChange`、`handleOmegaActiveChange`。
   - `L1526-1625` `handleLoadIntoScene`、`handleRevertToPaperFaithful`、`handleLoadFamilyBDenseQ`。
   - 這些 callback 會寫 profile、scene lane、camera、URL 或 async load 狀態；`applyHandoverModeSideEffects` 也會讀寫自己參與的 state，明確不抽。

10. **React lifecycle、replay cache 與 controller transport（保留）**
    - `L1627-1643` anonymous effects。
    - `L1649-1694` `cancelled` 與 anonymous effects。
    - `L1696-1721` `tickSec` effect、`L1723-1767` `slotOffset` effect、`L1769-1970` `cancelled` effect。
    - `L1980-1982` `replayArtifactCacheRef`、`L1992-2107` `cached`/`others` effects。
    - `L2109-2112` `replayController`、`L2114-2140` effects、`L2146-2163` `lastTime` effect。
    - 這些宣告含 fetch/cache、cancel flag、requestAnimationFrame 或 `ShowcaseReplayController`，抽出去會把 lifecycle 變成第二個 runtime。

11. **timeline/replay/rail 純 projection（本輪搬的第一組）**
    - 純計算宣告原本位於 `L2165-2203`：`modqnProducerTraceRange`、`modqnReplayVisualTimeline`、`modqnProducerTraceCurrentTimeSec`、`artifactHandoverRailEvents`、`modqnHandoverRailEvents`、`liveWalkerHandoverRailEvents`、`liveWalkerDirectorHandoverRailEvents`。
    - `L2204-2233` `automaticIntraPresentationSlots` 也是純 array derivation；`L2272-2286` `liveTimelineWindowStartSec`、`liveTimelineElapsedSec`、`liveWalkerHandoverEventIndexSourceGapReasons`。
    - `L2287-2327` `timelineRailDescriptor`、`archivedTleTimelineDescriptor`；`L2330-2334` `activeTimelineDescriptor`、`timelineDurationSec`、`timelineCurrentTimeSec`；`L2347-2352` `timelineDisabled`。
    - `L2434-2448` `handoverRailEvents`，`L2453-2469` `homepageTimelineEventMarkers`，`L2478-2505` `homepageDemoWindow`，`L2511-2524` `homepageDirectorHandoverRailEvents`，`L2530-2542` `homepageIndexedStoryRoute`、`liveWalkerDirectorHandoverEventsForButtons`。
    - 同一語意領域但不是純計算的邊界也列在這裡：`L2234-2271` `automaticIntraScheduleRef`/`scheduleState` effect、`L2335-2340` archived-TLE refs 與 anonymous ref、`L2358-2432` `initialTimeSec` effect；它們留在 `App`。

12. **timeline seek、director queue 與 homepage teaching controls（保留）**
    - `L2544-2632` `requestLiveTimelineSeek`、`handleTimelineSeek`；`L2634` anonymous 裸宣告。
    - `L2646-2684` `liveDirectorFocusClaimKind`、`directorIntraQueueable`、`directorInterQueueable`、`directorInterButtonEnabled`、`directorIntraIndexedEnabled`、`liveIntraFallbackEnabled`、`directorNextIntraEnabled`、`directorIntraTriggerEnabled`、`directorNextIntraMode`。
    - `L2686-2715` anonymous 裸宣告與 `L2716-2719` `handleLiveSeekLandedWithAnalysisReset`。
    - `L2726-2750` `handoverControlBusy`、`homepageHandoverQueueOpen`、`handoverCommandBusy`、`homepageDemoWindowButtonEnabled`、`handleHomepageTeachingRevealDetails`。
    - `L2751-2918` `handleHomepageTeachingSeekSource`、`handleHomepageTeachingEnd`、anonymous effect、`handoverCinema`、`previousKey` effect、兩個 anonymous 裸宣告、`triggerPrimaryIntra`、`jumpHomepageToIndexedEvent`、`handleDirectorNextIntra`。
    - 這些宣告與 playback seek、camera focus、pending command ref 或 state writer 相連，保留 adapter 邊界。

13. **teaching identity/story/display projection（本輪搬的第二組）**
    - 純宣告為 `L2929-2937` `teachingInterRosterSatelliteIds`、`L2950-2955` `teachingIntraSatelliteId`、`L2957-3045` `teachingIdentityBinding`、`L3061-3122` `teachingSceneStoryCandidate`、`L3386-3430` `intraTeachingDisplayState`。
    - 同一領域但有 clock/latch/寫回的宣告保留：`L3046-3052` `teachingLecture`、`restartTeachingLecture`、`teachingLectureFrameRef`、anonymous ref；`L3127-3147` `teachingSceneStoryLatchRef`、`teachingRunKey`、`teachingSceneStory`。
    - `L3163-3229` `requestManualHandover`、`L3245-3254` `openHandoverTeachingStage`、`L3260-3313` teaching switch/phase/run key 與 `handleQuickIntra`、`handleDirectorNextInter`、`handleQuickInter`、`L3337-3379` `intent` effect 與 `directorButtonCountEvents`、`L3431-3433` `intraTeachingComparisonCellId` 也保留。

14. **teaching rail、timeline UI 與 render assembly（保留）**
    - `L3439-3517` `handleExperienceChange`、`handleHandoverRailSeek`、`handleTimelineSpeedChange`。
    - `L3519-3624` `handoverEventRail`、`timelineBar`、`homepageHandoverStory`、`homepageRailShowAllSurfaces`、`homepageTeachingTimeline`。
    - JSX assembly 依賴 callback、playback 與 scene owner，不是本輪純模組的輸入/輸出 seam。

15. **replay scene frame 與 coverage readout（保留）**
    - `L3628-3658` `replaySceneFrame`、`processedUes`、`windowReplayCue`、`activeSceneFrame`、`shouldRenderMainScene`。
    - `L3667-3681` `coverageStats`、`currentCoverage`、`currentStarved`。
    - 它們看似有純 selector，但仍直接耦合 render frame、lane visibility 與 replay state；本輪不再擴大第三組。

16. **replaySimState、source switch 與 homepage rail panel（保留）**
    - `L3688-3744` anonymous state、`cancelled` effect、`replaySimState` effect、`resetAutoSlowDismissedRef`、anonymous ref、`defaults` effect。
    - `L3746-3775` `handleSimulationSourceChange`。
    - `L3781-3818` `homepageRailPanel`。
    - 這裡是 replay lifecycle、source switch side effects 與大段 JSX；不抽成只讀模組。

## 這輪搬的組

### 組一：timeline/replay/rail projection

新增 [`src/app/appTimelinePresentation.ts`](../../../src/app/appTimelinePresentation.ts)，以命名 input 驅動以下結果：

```ts
deriveAppTimelineCore(input: AppTimelineCoreInput): AppTimelineCoreProjection
deriveAppTimelineRailProjection(input: AppTimelineRailProjectionInput): AppTimelineRailProjection
deriveHomepageTimelineProjection(input: ...): HomepageTimelineProjection
selectAppHandoverRailEvents(input: ...): readonly HandoverRailEvent[]
deriveAppTimelineDisabled(input: ...): boolean
```

`AppTimelineCoreProjection` 同時輸出 replay trace/timeline、三種 rail event source、director event source、automatic intra slots、live window、source-gap reasons、active/archived descriptor、duration/current time。`AppTimelineRailProjection` 再以同一個 core 產生 rail owner、homepage marker/demo window、button event source。模組不讀 React state、不寫 ref、不取 clock、不建立 event/decision；`App.tsx` 只保留 `useMemo` adapter。

新增 [`src/app/appTimelinePresentation.test.ts`](../../../src/app/appTimelinePresentation.test.ts)，4 個不掛 React 的 Node tests 涵蓋：

- replay/index/descriptor 的 coherent core；
- homepage marker、demo window、button event 使用同一對 source event；
- artifact/live/modqn/observed rail owner selection；
- timeline disabled 的純條件。

基準清單中搬出的純宣告合計 223 行；`App.tsx` 端改為 core/rail/disabled 薄 adapter，純結果的來源與選擇集中到 321 行 module。測試檔 233 行，4/4 通過。第一組完成後執行：

```text
node --import tsx/esm --test src/app/appTimelinePresentation.test.ts  => 4 pass, 0 fail
npx tsc --noEmit -p tsconfig.json --pretty false                       => exit 0
```

### 組二：teaching identity/story/display projection

新增 [`src/app/teachingPresentationDerivations.ts`](../../../src/app/teachingPresentationDerivations.ts)，模組簽章為：

```ts
deriveTeachingInterRosterSatelliteIds(input): readonly string[]
resolveTeachingIntraSatelliteId(input): string | null
deriveTeachingIdentityBinding(input): TeachingIdentityBinding
deriveTeachingSceneStoryCandidate(input): HandoverTeachingSceneStory | null
deriveIntraTeachingDisplayState(input): SimState
```

這組把 roster 排序、intra protagonist、identity binding、same-cell/inter story candidate 與 display-only `SimState` snapshot 一起搬走。每個函式只吃 projection、命名 satellite/state 值與 teaching input，回傳明確結果；`App.tsx` 保留 `useMemo` adapter。

新增 [`src/app/teachingPresentationDerivations.test.ts`](../../../src/app/teachingPresentationDerivations.test.ts)，4 個不掛 React 的 Node tests 涵蓋：

- measured EE 排序與 intra protagonist；
- intra/inter identity row 與 live satellite name/beam；
- same-cell intra 與 cross-satellite inter story；
- manual intra presentation 的 panel snapshot，確認沒有 feedback write。

基準清單中搬出的純宣告合計 211 行；`App.tsx` 端保留約 62 行的薄 adapter，module 為 211 行，測試檔為 184 行。第二組純測試與既有相關測試結果為：

```text
node --import tsx/esm --test \
  src/app/appTimelinePresentation.test.ts \
  src/app/timelineRailAuthority.test.ts \
  src/app/teachingInterRoster.test.ts \
  src/app/teachingPresentationDerivations.test.ts
  => 12 pass, 0 fail
```

第二組完成後的完整 tsc gate 沒有達成綠燈；唯一錯誤是共享 checkout 中另一個 worker 的 dirty WIP：

```text
src/scene/MainScene.tsx(1030,12): error TS2304: Cannot find name 'SatelliteMarker'.
```

`src/scene/MainScene.tsx`、`src/scene/Scene*Layer.tsx` 與相關 scene tests 不在本輪修改範圍；為遵守共用 checkout 規則，沒有補 import、回復或改寫該 worker 的 WIP。故本組的純測試是綠的，但第二組的 repo-wide `tsc --noEmit -p tsconfig.json` gate 仍為 exit 2，不能宣稱全 repo tsc 完成。

## 我判斷不該抽的

- **`runtime`（`L876-942`）**：它不是只讀 formula。它組合 profile、scene source、replay、camera/visual overrides 與 reset key，結果會被 lifecycle effect 及 scene owner 消費；搬走會製造第二個 runtime authority。
- **`homepageRailProjection`（`L1088-1129`）**：它讀取 `homepageRailContinuityRef`（`L1076-1081`）代表 accepted presentation 的 continuity。其周邊 `handleHandoverPresentationChange` / `handleHandoverPresentationBusyChange` 會寫回同一 owner。這是「會寫回自己讀的 state」的回饋邊。
- **`handleSimUpdate`（`L1275-1349`）**：是 simulator frame 的 state writer，不是 projection；將它變純函式會改變 frame、handover、teaching receipt 的寫回時序。
- **`applyHandoverModeSideEffects`（`L1417-1461`）**：同時讀取 effective profile/scene mode，並寫回 policy、camera、overlay、lane 等 side effects；保留 owner。
- **外部控制通道（`L2335-2340` 與其 effect）**：`archivedTleTimelineCurrentTimeRef`、`archivedTleSelectTimelineTimeRef` 和 RAF effect 不能為了抽取而改。現有 `>= 15` 秒門檻區分 external seek 與 playback 自身遞增，必須留在 `App` 的 effect/ref 邊界。
- **播放與 manual handover writers**：`requestMovingIntraDemo`、`requestManualHandover`、`handleTimelineSeek`、`requestLiveTimelineSeek`、`handleHandoverRailSeek`、`handleExperienceChange` 會寫 playback/state/ref/URL 或取消 pending focus，不抽。
- **teaching clock/latch writers**：`teachingLecture`、`restartTeachingLecture`、`teachingLectureFrameRef`、`teachingSceneStoryLatchRef`、`teachingSceneStory`、`openHandoverTeachingStage`、`handleQuickIntra`、`handleQuickInter` 牽涉 lecture clock、run latch 與 playback owner；只抽它們的純輸入到第二組 module。
- **effects/cache/controller**：`L1627-2163` 與 `L3688-3775` 的 cancelled flags、requestAnimationFrame、cache、replay controller、source switch、reset ref 都有生命週期或 async cancellation，不抽。
- **render/UI assembly**：`handoverEventRail`、`timelineBar`、`homepageTeachingTimeline`、`homepageRailPanel` 及 `replaySceneFrame`/`activeSceneFrame`/coverage readout 儘管部分 expression 可寫成 function，仍直接耦合 JSX visibility、playback callback 與 scene frame；本輪不為行數而拆。
- **anonymous `useState` / `useRef`**：任務列出的所有 anonymous state/ref 宣告都保留；它們是 owner storage，不是可獨立測試的 derived calculation。

## 純的部分切出來、回饋邊留下的

### Timeline/replay/rail

- 切出：replay visual timeline、producer trace range/current time、artifact/modqn/live rail event arrays、director filtering 的結果、automatic intra slot array、live window elapsed、source-gap reasons、timeline descriptors、homepage marker/demo/button projection、rail owner selection、timeline disabled boolean。
- 留下：`automaticIntraScheduleRef` 和其 effect。它會遞增 `nextIndex`、寫 `lastSimTimeSec`，並呼叫 `requestMovingIntraDemo`；這是 schedule cursor 與 manual handover owner 的回饋邊。
- 留下：archived-TLE current/select refs 與 RAF playback effect。純 module 只接受已發布的 current/ready/duration/step 值，沒有改動 external seek 判定或 `>= 15` 秒通道。
- 留下：replay artifact cache/fetch、`replayController` tick/play/pause/speed effects；純 module 沒有接管 controller。

### Teaching identity/story/display

- 切出：inter roster 排序、intra protagonist 選擇、identity row 產生、story candidate 產生、display-only `SimState` snapshot。這些結果不寫 `simState`、manual request、lecture ref 或 latch。
- 留下：`teachingSceneStoryLatchRef` 與 `teachingSceneStory`。它會在 run key 變化時清除或寫入 latch，必須保留在 React integration seam。
- 留下：`useHandoverTeachingLecture` 的 clock/ref，以及 `requestManualHandover`、`openHandoverTeachingStage`、quick/director callbacks。它們改 playback、manual request、camera 或 phase state。
- display adapter 只把 `manualHandoverRequest.intraPresentation` 轉成 panel snapshot；未測量到 intra presentation 時直接回傳原 `simState`，所以沒有新增 state feedback。
