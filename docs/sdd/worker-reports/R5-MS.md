# R5-MS：SceneRenderContent 成組下沉報告

本輪選擇兩個完整的語意領域：多候選 accepted-snapshot 顯示政策，以及 handover presentation/display 政策。兩者都把純衍生計算移到不依賴 React 的模組；React 元件只保留 hook、ref、R3F 時鐘與 renderer-specific adapter。

原始行號以下列使用者提供的 `SceneRenderContent` inventory 為準。共享 checkout 同時有 R5-JSX 的 dirty WIP，因此本報告的行數只計入可辨識的本輪取代 hunk，不把整個 `MainScene.tsx` diff 歸給本 worker。

## 領域分組

### A. 場景基礎輸入、相機與通用 scene projection

這一組負責 homepage EE 輸入、相機控制、場景幾何、UE/衛星顯示資料與基礎 render plan；相機和 hook 相關項目保留在 adapter。

`homepageBeamEeByKey` (1264-1267)、`homepageBeamEeBitsPerJouleByKey` (1268-1276)、`homepageSatelliteEeProgressById` (1277-1280)、`homepageIdentityPaletteIndexBySatelliteId` (1281-1289)、`camera` (1290)、`controlsRef` (1291)、`cameraPresetRef` (1292)、`cameraTransitionRef` (1293)、`cameraTweenRef` (1294)、`lastCameraCommandAtRef` (1295)、`lastCameraPresetRef` (1296)、`lastDirectorCommandAtRef` (1297)、`directorSnapshotRef` (1298)、`directorFocusOrbitRef` (1299)、`sceneConfig` (1305-1309)、`paperUserArea` (1310-1313)、`handoverTriggerTimeSec` (1314-1315)、`useEarthFixedCellTruth` (1316)、`ueTrailHistory` (1317-1323)、`latchedBeamSinrByKeyRef` (1324)、`alpha` (1325)、`cameraPresets` (1327-1347)、`applyCameraPose` (1349-1357)、`sceneGeometry` (1363-1390)、`sceneFrameInput` (1394-1403)、`(anon)` (1404)、`naturalHandoverProtagonistUeId` (1405-1409)、`selectedOtherHandoverUeIds` (1410-1423)、`displayedUes` (1424-1438)、`pendingOtherHandoverUeCount` (1439-1442)、`viz` (1446-1460)、`worldUnitsPerKm` (1461)、`sinrLiveEllipseTiltExaggeration` (1466)、`sinrLiveCellPlacementById` (1472-1486)、`cellSchedule` (1487-1506)、`satelliteTintById` (1507-1513)、`satelliteWorldById` (1514-1520)、`cellHoCounts` (1521-1525)、`recentHoActive` (1526-1528)、`renderPlan` (1529-1543)、`(anon)` (1544-1564)。

### B. MODQN、cell service、負載與 cell-cone 顯示

這一組負責 MODQN service/load、cell schedule 與現有的 cell-cone renderer；相關純模組已存在，hook 或 renderer adapter 不重複抽象。

`(anon)` (1570)、`raf` (1571-1574)、`modqnVisualLayerPreset` (1575)、`modqnVisualLayers` (1576)、`beamLoadContentionEnabled` (1586)、`modqnServiceMap` (1587-1602)、`sinrServingColorById` (1611-1620)、`sinrServingTelemetryActive` (1628)、`beamLoadContention` (1646-1655)、`beamLoadContentionUeCount` (1660-1663)、`ueMarkerShape` (1664)、`focusedCellBeamConeUe` (1665)、`focusBeamLoad` (1666-1668)、`focusBeamLoadTint` (1669-1671)、`modqnCellServiceReadout` (1672-1686)、`renderedCellBeamConeScope` (1743)、`cellBeamConeInput` (1746-1760)、`renderedCellBeamConeCount` (1761-1765)、`renderedCellBeamConeSatelliteCount` (1766-1770)。

### C. 多候選 accepted authority、比較投影、identity 與 marker roster（本輪搬移）

這一組把 accepted decision 的 authority gate、comparison latch、presentation hold、候選 render identity、marker filter/label policy 視為同一條顯示資料流。`useRef` 本身不是純計算，已切成「純函式回傳 next state + 元件寫回 ref」。

`multiCandidateEpisodeId` (1687)、`candidateInspectionSnapshot` (1689-1699)、`(anon)` (1700-1703)、`(anon)` (1704-1724)、`handoverStoryModel` (1725-1742)、`primaryServingRecord` (1788-1796)、`displayHeroPrimary` (1797-1806)、`displayHeroRecord` (1807-1825)、`acceptedHandoverDecisionFrame` (1832)、`multiCandidateSnapshotMatchesFrame` (1833-1836)、`multiCandidateAuthorityActive` (1837)、`multiCandidateDecisionAuthorityPresent` (1841-1843)、`multiCandidateComparisonLatchRef` (1858-1861)、`acceptedComparisonDecision` (1862)、`rawMultiCandidateComparisonPhase` (1863-1864)、`preSelectionComparisonPhase` (1865-1866)、`comparisonLatch` (1867)、`sameLatchedEpisode` (1868-1871)、`(anon)` (1872-1880)、`(anon)` (1881-1886)、`latchedMultiCandidateComparisonPhase` (1887-1891)、`multiCandidateComparisonPhase` (1892-1893)、`multiCandidateCentralOverlayActive` (1894-1896)、`handoverAuthorityJoin` (1897-1903)、`authorityTransitionRef` (1909)、`authorityTransitionResetKeyRef` (1913-1918)、`currentAuthorityResetKey` (1919-1924)、`(anon)` (1925-1928)、`(anon)` (1929-1931)、`(anon)` (1932-1934)、`handoverCandidatePresentationPlan` (1935-1937)、`homepageSceneProjection` (1938-1947)、`multiCandidateCandidateReviewPresentation` (1952-1958)、`candidateComparisonSceneActive` (1959-1962)、`multiCandidateScenePresentation` (1963-1969)、`multiCandidateScenePresentationHoldRef` (1970-1973)、`multiCandidatePresentationEpisodeKey` (1974-1976)、`(anon)` (1977-1987)、`(anon)` (1988-1997)、`multiCandidateScenePresentationForRender` (1998-2006)、`multiCandidateScenePresentationHoldActive` (2007-2010)、`multiCandidateSceneVisualActive` (2011-2012)、`multiCandidateSceneLayerVisible` (2013-2018)、`multiCandidateSceneRenderPlan` (2019-2050)、`multiCandidateCandidateReviewRenderPlan` (2051-2080)、`resolveSceneAcceptedBeamColor` (2085-2105)、`resolveSceneAcceptedCellColor` (2106-2122)、`resolveSceneSatelliteColor` (2123-2127)、`candidateComparisonVisibleSatelliteIds` (2128-2137)、`candidateComparisonOrdinalBySatelliteId` (2138-2152)、`multiCandidateServingCarrierRenderable` (2153-2160)、`multiCandidateAuthoritySpineParticlePlans` (2161-2168)、`multiCandidateSatelliteColorsInput` (2169-2199)、`(anon)` (2200)、`multiCandidateBeamColors` (2201-2211)、`multiCandidateBeamColorBySatelliteCell` (2212)、`multiCandidateBeamColorBySatelliteBeam` (2213)、`liveBeamIdentityColorBySatelliteBeam` (2214-2233)、`multiCandidateCentralMarkerFilterRef` (2239-2242)、`acceptedComparisonEpisodeKey` (2243-2245)、`(anon)` (2246-2255)、`centralMarkerSourcePlan` (2261-2265)、`(anon)` (2266-2280)、`latchedCentralMarkerSatelliteIds` (2281-2284)、`renderedCandidateSatelliteId` (2291-2295)、`multiCandidateCentralMarkerSatelliteIds` (2296-2318)、`homepageCandidateStageLabelActive` (2323-2324)、`homepageCandidateStageVisibleSatelliteIds` (2325-2327)、`homepageSatelliteLabelActive` (2328)、`satelliteCandidateLabelActive` (2329-2330)、`satelliteCandidateLabelVisibleSatelliteIds` (2331-2333)、`handoverMarkerSatelliteIds` (2334-2352)、`renderedLiveSatelliteMarkersInput` (2353-2371)、`(anon)` (2372)。

### D. Manual/cinema handover presentation 與 display-isolation（本輪搬移）

這一組負責手動 demonstration clock、cinema pair snapshot、authority candidate adapter，以及 normalized presentation owner 之後的 source/active/isolation/envelope/telemetry 派生。stateful clock、owner 與 feedback refs 留在元件。

`sinrLiveBeamDisplayFrame` (2378-2390)、`candidateDisplayCellFrame` (2391-2398)、`manualHandoverEvent` (2399-2429)、`manualHandoverDisplayMs` (2430-2434)、`manualHandoverBeamRecord` (2435-2437)、`(anon)` (2443)、`(anon)` (2444)、`manualHandoverTickRef` (2445)、`cinemaHandoverTickRef` (2446)、`cinemaHandoverReady` (2447-2454)、`nowMs` (2455-2508)、`manualHandoverProgress` (2509-2515)、`manualHandoverAgeMs` (2516)、`manualHandoverRequested` (2523-2525)、`manualHandoverActive` (2526-2527)、`manualHandoverProgressSec` (2528)、`manualHandoverGroundTarget` (2532-2537)、`cinemaInterPairAnchorRef` (2541)、`readApexWorld` (2542-2566)、`cinemaInterPairAnchor` (2567)、`cinemaInterSatelliteWorldById` (2568-2577)、`cinemaPairCandidate` (2581-2594)、`authorityHandoverPresentationCandidate` (2596-2628)、`recentPrimaryHandoverEvent` (2630-2637)、`recentAnyInterHandoverEvent` (2643-2649)、`handoverPresentationCandidateInput` (2651-2720)、`(anon)` (2721)、`handoverPresentationStateRef` (2724)、`handoverPresentationSourceRef` (2725)、`(anon)` (2726-2729)、`handoverPresentationNowMs` (2730-2732)、`handoverPresentationStep` (2733-2742)、`(anon)` (2747)、`handoverPresentation` (2748)、`handoverPresentationMode` (2749)、`handoverPresentationCooldownUntilMs` (2750)、`handoverPresentationBusy` (2754-2756)、`(anon)` (2762)、`handoverPresentationSource` (2763)、`presentedCinemaHandoverActive` (2764-2765)、`presentedInterHandoverActive` (2766-2767)、`manualHandoverPresentationActive` (2768-2770)、`concurrentIntraVisualSuppressed` (2774-2777)、`naturalInterCandidatePending` (2783-2787)、`presentationHandoverEnvelope` (2788-2792)、`handoverDisplayIsolation` (2793-2812)、`teachingLectureFieldCleared` (2816-2817)、`teachingLabelSatelliteIds` (2819-2825)、`presentedHandoverPairCandidate` (2827-2842)。

### E. Homepage beam geometry、SINR cell truth 與 cone palette

這一組負責 homepage 的 beam visibility/geometry policy、SINR cone palette、cell-truth particle/cone selection、event cue 與 beam-info 的 renderer 輸入；已有對應純模組或需要 Three/R3F context 的部分保留。

`homepageBeamFanSatelliteIds` (2849-2857)、`homepageIntraCellAnchor` (2864-2887)、`homepageSceneBeamVisibilityInput` (2894-2921)、`(anon)` (2922)、`restrictHomepageBeamItems` (2923-2934)、`authorityTransition` (2935)、`authorityPresentationCommitObserved` (2936-2941)、`presentationSatelliteWorldById` (2942-2944)、`multiCandidateIdentityTransitionActive` (2951-2953)、`homepageSceneGeometryPolicy` (2961-2976)、`(anon)` (2978-2992)、`(anon)` (2993-3000)、`cinemaInterDisplayCellFrame` (3006-3012)、`sinrLiveTargetSatIds` (3031-3034)、`sinrLiveConePalette` (3042-3073)、`multiCandidateServingBeamColor` (3074-3076)、`activeServingConePalette` (3077-3093)、`(anon)` (3095-3124)、`sinrLiveCellTruthSpineParticlePlans` (3131-3144)、`candidateConeSelection` (3149-3161)、`(anon)` (3162)、`(anon)` (3163-3181)、`(anon)` (3187)、`sinrLiveCellServingSinrByCellId` (3190-3196)、`renderedSinrLiveCellBeamConeCount` (3197)、`renderedSinrLiveCellBeamConeSatelliteCount` (3198-3200)、`(anon)` (3211)、`(anon)` (3219-3335)、`latchedAuthorityTransition` (3346-3362)、`handoverEventCuePolicy` (3366-3375)、`(anon)` (3376-3399)、`beamInfoItemsInput` (3408-3435)、`(anon)` (3436)、`homepageHandoverBeamInfoActive` (3437-3440)、`multiCandidateEventCueCount` (3441-3447)。

### F. Render receipt、late overlays 與 camera command/tween

這一組負責渲染回執、scene status、late-stage overlay flags、spotlight 與相機命令；其結果依賴實際 renderer mount 或會寫入相機/動畫狀態。

`multiCandidateSceneRenderReceipt` (3448-3468)、`multiCandidateCandidateReviewSceneRenderReceipt` (3469-3487)、`mountedMultiCandidateSceneRenderPlan` (3492-3494)、`multiCandidateSceneRenderStatus` (3495-3503)、`cinemaDisplayServingSatId` (3508-3512)、`cinemaDisplayCandidateSatId` (3513-3517)、`sinrLiveCellServedCount` (3518-3520)、`sinrLiveCellUeOffAxisMaxDeg` (3523-3528)、`homepageEeProgressVisible` (3529-3532)、`uploadParticlesEnabled` (3533-3537)、`uploadParticleFocusCones` (3538-3549)、`profileDerivedHandoverCues` (3550-3553)、`showCellReassignmentEventArcs` (3557)、`replayBackedHandoverStoryVisible` (3563-3564)、`cinematicSpotlightActive` (3565)、`cinematicSpotlightTargets` (3566-3572)、`command` (3574-3607)、`command` (3609-3662)、`(anon)` (3664-3674)、`tween` (3676-3740)。

## 這輪搬的組

### C. 多候選 accepted authority / identity / marker policy

模組：[multiCandidateSceneDisplayPolicy.ts](/home/u24/demo/leo-beam-sim/src/scene/multiCandidateSceneDisplayPolicy.ts)

模組不 import React，也不直接 import JSX renderer；selector 以 type-only render instruction 及命名 callback 傳入。主要簽章如下：

```ts
resolveMultiCandidateComparisonPolicy(
  input: MultiCandidateComparisonPolicyInput,
): MultiCandidateComparisonPolicy

resolveMultiCandidatePresentationPolicy(
  input: MultiCandidatePresentationPolicyInput,
): MultiCandidatePresentationPolicy

resolveMultiCandidateRenderIdentity(
  input: MultiCandidateRenderIdentityInput,
): MultiCandidateRenderIdentity

resolveMultiCandidateMarkerPolicy(
  input: MultiCandidateMarkerPolicyInput,
): MultiCandidateMarkerPolicy
```

其中 `MultiCandidateComparisonPolicyInput` 明確接收 accepted snapshot、`simSource`、`sceneLane`、上一個 latch 與 overlay flag；`MultiCandidatePresentationPolicyInput` 接收 candidate plan、scene/presentation phase、上一個 hold 與 scene layer gate；render identity 接收兩個已完成 geometry mapping 的 render plan 和 selector；marker policy 接收上一個 filter、兩個 render plan、候選 roster 與 canonical/pending identity。所有輸出都以明確 result type 回傳，包含 `nextLatch`、`nextHold`、`nextFilter`，不在模組內寫 React state。

移入的純計算包括：

- accepted snapshot/frame join、authority predicate、raw/pre-selection phase、episode/epoch comparison latch；
- homepage/central candidate presentation、publication-gap hold、scene visibility；
- candidate satellite roster、alternate ordinal、serving carrier renderability；
- central marker source/filter、latched satellite IDs、rendered candidate identity，以及 homepage/candidate label gates；
- `MULTI_CANDIDATE_BEAM_WIDTH_MULTIPLIER` 與 `MULTI_CANDIDATE_CENTRAL_OVERLAY_ENABLED` 這兩個 display policy constants。

測試：[multiCandidateSceneDisplayPolicy.test.ts](/home/u24/demo/leo-beam-sim/src/scene/multiCandidateSceneDisplayPolicy.test.ts)

測試涵蓋三個跨函式情境：comparison policy 開啟/鎖存/清除 episode、presentation 在缺少 publication 時 fail closed、render identity 與 marker policy 共用同一個 selected satellite roster 並處理 stale filter。測試直接呼叫純函式，未 mount React。

驗證與行數：

- `./node_modules/.bin/tsc --noEmit -p tsconfig.json`：exit 0（最終 checkpoint）。
- 本模組測試：3 pass。
- 可辨識的 `MainScene.tsx` policy replacement hunk：277 行舊宣告/邏輯 → 92 行薄 adapter，淨減 185 行。
- 純模組 408 行；成組測試檔 211 行。這些行數不是完成判據，實際收益是同一 lifecycle 的四個純政策函式可獨立測試，且 feedback edge 明確回到元件。

### D. Manual/cinema/handover presentation display policy

模組：[handoverPresentationDisplayPolicy.ts](/home/u24/demo/leo-beam-sim/src/scene/handoverPresentationDisplayPolicy.ts)

模組不 import React，使用命名輸入和明確 result type：

```ts
resolveManualHandoverProgress(input): ManualHandoverProgress
resolveManualHandoverDisplayState(input): ManualHandoverDisplayPolicy
resolveManualHandoverDisplayMs(input): number
resolveCinemaPairCandidate(input): SinrLiveCinemaHandoverCandidate | null
resolveCinemaInterSatelliteWorldById(input): Map<string, InterCinemaApexWorld>
resolveAuthorityPresentationCandidate(input): HandoverPresentationEvent | null
resolveHandoverPresentationDisplayPolicy(
  input: HandoverPresentationDisplayPolicyInput,
): HandoverPresentationDisplayPolicy
resolveHomepageEeProgressVisible(input): boolean
resolveCinemaDisplaySatelliteIds(input): CinemaDisplaySatelliteIds
resolveSinrLiveCellTelemetry(input): SinrLiveCellTelemetry
```

移入的純計算包括：

- manual wall-clock age、bounded progress、request/event gate 與 homepage/default display duration；
- cinema inter pair 的 anchored endpoint/world map；
- accepted authority transition 到既有 presentation-event vocabulary 的投影；
- normalized presentation owner 的 source、intra/inter/manual flags、natural pending、envelope、field isolation、teaching field clear 與 pair candidate；
- cinema display serving/candidate IDs、SINR served-cell/off-axis telemetry，以及 homepage EE progress visibility。

測試：[handoverPresentationDisplayPolicy.test.ts](/home/u24/demo/leo-beam-sim/src/scene/handoverPresentationDisplayPolicy.test.ts)

測試涵蓋四個跨函式情境：manual progress/state/display duration、presentation owner/isolation/pair、cinema pair anchor/world/IDs、telemetry 與 authority candidate 的 selected-boundary fail-closed。測試直接呼叫純函式，未 mount React。

驗證與行數：

- `./node_modules/.bin/tsc --noEmit -p tsconfig.json`：exit 0（最終 checkpoint）。
- 本模組測試：4 pass。
- 可辨識的 `MainScene.tsx` display-policy replacement hunk：145 行舊宣告/邏輯 → 94 行薄 adapter，淨減 51 行。
- 純模組 364 行；成組測試檔 239 行。這個領域的價值不是把單一 flag 搬走，而是把 manual/cinema/authority 三種 presentation owner 的 display isolation 和身份邊界合併成一個可測 seam。

共同驗證：

- 兩個新測試檔及相關 handover/multi-candidate 純測試合計 50 pass、0 fail。
- 未執行任何 `*:browser` validator。
- 未執行或修改 `check:ee`、`check:visual`。
- 沒有執行任何 git 寫入指令。

既有 `src/scene/multiCandidateMainSceneIntegration.test.ts` 是共享 checkout 中 R5-JSX 同時修改的 source-contract dirty WIP；它仍要求被本輪抽出的 MainScene-local 字串（例如 `buildMultiCandidateScenePresentation(...)`、舊 constants 與舊 inline flags）。直接執行結果為 12 tests 中 4 pass、8 fail，失敗均為這些舊 source regex，不是 TypeScript 錯誤。依共享 WIP 規則，本輪沒有改寫該檔案；新純模組測試承擔已搬移政策的 unit coverage。

## 我判斷不該抽的

### 1. 會形成 feedback edge 的 state/ref/effect

以下不是純衍生計算，保留在 `SceneRenderContent`：`controlsRef`、`cameraPresetRef`、`cameraTransitionRef`、`cameraTweenRef`、`lastCameraCommandAtRef`、`lastCameraPresetRef`、`lastDirectorCommandAtRef`、`directorSnapshotRef`、`directorFocusOrbitRef`、`latchedBeamSinrByKeyRef`、`multiCandidateComparisonLatchRef`、`authorityTransitionRef`、`authorityTransitionResetKeyRef`、`multiCandidateScenePresentationHoldRef`、`multiCandidateCentralMarkerFilterRef`、`(anon)` state (1570)、`raf` effect (1571-1574)、`(anon)` state (2443-2444)、`manualHandoverTickRef`、`cinemaHandoverTickRef`、`cinemaInterPairAnchorRef`、`handoverPresentationStateRef`、`handoverPresentationSourceRef`、`(anon)` effect (2726-2729)、`command` (3574-3607)、`command` (3609-3662)、`(anon)` effect (3664-3674)、`tween` (3676-3740)。它們要依序讀寫 ref、setState、useFrame/effect 或與 imperative runtime 同步；抽成「純」函式會把回饋邊藏起來。

### 2. 相機/Three/R3F imperative ownership

`camera`、`cameraPresets`、`applyCameraPose`、`cameraTweenRef`、`cameraTransitionRef`、`command`、`tween` 不抽。它們與 OrbitControls、Director FSM、Three `Vector3` 和 user command 的寫入順序有關；相機 ownership 也明確保留給元件，而不是讓候選資料變更觸發隱式 fit/tween。

### 3. 已有純模組或 hook 的薄包裝

`homepageBeamEeByKey`、`homepageBeamEeBitsPerJouleByKey`、`homepageSatelliteEeProgressById`、`homepageIdentityPaletteIndexBySatelliteId`、`naturalHandoverProtagonistUeId`、`selectedOtherHandoverUeIds`、`pendingOtherHandoverUeCount`、`satelliteTintById`、`satelliteWorldById`、`cellHoCounts`、`recentHoActive`、`modqnServiceMap`、`sinrServingColorById`、`beamLoadContention`、`beamLoadContentionUeCount`、`modqnCellServiceReadout`、`handoverStoryModel`、`recentPrimaryHandoverEvent`、`recentAnyInterHandoverEvent`、`sinrLiveBeamDisplayFrame`、`candidateDisplayCellFrame`、`homepageSceneGeometryPolicy`、`cinemaInterDisplayCellFrame`、`handoverEventCuePolicy`、`multiCandidateSceneRenderStatus` 等，是既有 pure module/hook 的輸入組裝或已被既有 resolver 涵蓋的薄包裝。再搬一層只會增加 forwarding module，沒有新的可測邊界。

### 4. renderer-specific geometry/color adapters

`sceneGeometry`、`sceneFrameInput`、`viz`、`cellSchedule`、`renderPlan`、`multiCandidateSceneRenderPlan`、`multiCandidateCandidateReviewRenderPlan`、`multiCandidateAuthoritySpineParticlePlans`、`multiCandidateSatelliteColorsInput`、`multiCandidateBeamColors`、`liveBeamIdentityColorBySatelliteBeam`、`resolveSceneAcceptedBeamColor`、`resolveSceneAcceptedCellColor`、`resolveSceneSatelliteColor`、`homepageSceneBeamVisibilityInput`、`restrictHomepageBeamItems`、`homepageIntraCellAnchor`、`sinrLiveConePalette`、`activeServingConePalette`、`sinrLiveCellTruthSpineParticlePlans`、`candidateConeSelection`、`beamInfoItemsInput`、`uploadParticleFocusCones` 等保留為薄 adapter。它們不是 decision truth：輸入含 Three world map、UE anchor、renderer visibility、palette callback 或現有 hook 的輸出；真正有價值的 domain policy 已由本輪模組取出，剩下部分若再抽只會把 renderer context 搬進更寬的 interface。

### 5. 以實際 mount/receipt 為語意的 late-stage 結果

`multiCandidateSceneRenderReceipt`、`multiCandidateCandidateReviewSceneRenderReceipt`、`mountedMultiCandidateSceneRenderPlan`、`cinemaDisplayServingSatId`、`cinemaDisplayCandidateSatId`、`renderedSinrLiveCellBeamConeCount`、`renderedSinrLiveCellBeamConeSatelliteCount`、`homepageHandoverBeamInfoActive`、`multiCandidateEventCueCount`、`replayBackedHandoverStoryVisible`、`cinematicSpotlightActive`、`cinematicSpotlightTargets` 等依賴實際 mount、renderer receipt 或場景輸出；它們不是單純的 domain policy，不抽。

### 6. 純但不具本輪新增 seam 的小值

`camera`、`handoverTriggerTimeSec`、`useEarthFixedCellTruth`、`alpha`、`worldUnitsPerKm`、`sinrLiveEllipseTiltExaggeration`、`modqnVisualLayerPreset`、`modqnVisualLayers`、`beamLoadContentionEnabled`、`ueMarkerShape`、`focusedCellBeamConeUe`、`focusBeamLoad`、`focusBeamLoadTint`、`homepageBeamFanSatelliteIds`、`authorityTransition`、`authorityPresentationCommitObserved`、`presentationSatelliteWorldById`、`multiCandidateIdentityTransitionActive`、`uploadParticlesEnabled`、`profileDerivedHandoverCues`、`showCellReassignmentEventArcs`、`cinemaHandoverReady` 等雖可寫成函式，但多為一到數行的 context projection，或已被本輪 policy 當作 named input。為了可測性與可讀性不增加，不另外拆檔。

## 純的部分切出來、回饋邊留下的

- 多候選 comparison：`resolveMultiCandidateComparisonPolicy` 讀 `previousLatch`，回傳 `nextLatch`；`multiCandidateComparisonLatchRef.current = nextLatch` 留在元件。清除舊 episode、保留同 episode 的 publication-gap latch 都在純函式內，ref 寫回仍是 adapter responsibility。
- 多候選 presentation：`resolveMultiCandidatePresentationPolicy` 讀 `previousHold`，回傳 `nextHold`；`multiCandidateScenePresentationHoldRef` 的建立與寫回留在元件。`buildHomepageSceneProjection`/`buildMultiCandidateScenePresentation` 只在純模組內被呼叫，geometry mapping 仍由元件的 `resolveMultiCandidateBeamScene` adapter 完成。
- 多候選 marker：`resolveMultiCandidateMarkerPolicy` 讀 `previousFilter`，回傳 `nextFilter`；`multiCandidateCentralMarkerFilterRef` 寫回留在元件。marker filter 只保留 presentation identity，不改 decision/serving state。
- Cinema inter：`cinemaInterPairAnchorRef` 的 capture、reset 與 `readApexWorld` 仍在元件，因為它們讀取當前 R3F/world runtime 並跨 frame 保留 pair。anchor 後的 `resolveCinemaPairCandidate` 與 `resolveCinemaInterSatelliteWorldById` 是純 snapshot projection，移到模組。
- Manual demonstration：`manualHandoverNowMs`、`cinemaHandoverNowMs`、tick refs、`useFrame` 與 setState 仍在元件；`resolveManualHandoverProgress`、`resolveManualHandoverDisplayState` 只把已提供的 clock 映射成 bounded display result，不自行讀 clock 或推進時間。
- Presentation owner：`handoverPresentationStateRef`、`handoverPresentationSourceRef`、`advanceHandoverPresentation`、busy callback 與 owner lifecycle 仍在元件；owner 產出的 immutable `handoverPresentation` 進入 `resolveHandoverPresentationDisplayPolicy`，由純模組計算 source、isolation、envelope、pair 與 telemetry flags。
- Authority transition：`authorityTransitionRef` 的 reset/retain/write feedback 留在元件；`resolveAuthorityPresentationCandidate` 只接收 authority join、source、geometry existence predicates 和 duration，回傳可被既有 owner 消費的 event 或 `null`。
- Homepage EE visibility：`multiCandidateIdentityTransitionActive` 仍由元件依 authority transition 與 presentation event 組成，避免循環依賴；最後的 `homepageEeProgressVisible` 由 `resolveHomepageEeProgressVisible` 依命名 flags 計算。
- Render seam：兩個 `resolveMultiCandidateBeamScene` 呼叫仍在元件，因為它們需要 `sceneFrame.ues`、`viz.coneApexWorldById`、cell placement、reduced-motion 與實際 renderer geometry。純 policy 只決定「哪個 presentation/roster/flag」，不擁有 Three geometry 或 React lifecycle。
