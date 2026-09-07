# Rendering Architecture Audit

日期：2026-09-07  
範圍：`leo-beam-sim` 的衛星、波束、UE、換手與首頁 rail 的 rendering truth  
角色：AUDIT，資深前端架構審查

## 先給 owner 的結論

核心問題不是「檔案太大」而已，而是**同一個畫面事實被多個階層重新解讀**：

```text
source / clock
  -> simulation frame
  -> handover decision frame
  -> accepted presentation snapshot
  -> normalized scene frame
  -> MainScene policy composition
  -> layer-specific color / identity / geometry resolver
  -> Three/R3F material or DOM CSS
```

這條鏈目前不是單一路徑。它在 decision、time、palette index、cell/beam key、handover phase 與 render override 上都有分叉。`MainScene` 是最後一個大型組合點，但不是唯一的權威；一些 renderer 還能以自己的 fallback 或 legacy adapter 改寫結果。

因此 owner 現在輸入「把 intra 換手的波束顏色改成某種變化」時，實際上不是在修改一個 policy，而是在猜測這個詞目前落在哪一組語意：

- steady serving identity 的顏色；
- semantic role 的 pulse 顏色；
- selected/committed handover carrier 的顏色；
- homepage 的 EE shade；
- source/target 的同色系強調；
- 或某個舊 layer 的 fallback 顏色。

這就是「改三個地方仍然壞」的根因。要讓 prompt 真正能完成修改，目標不是再建更多 helper，而是建立一個**單一、可命名、可測試、可觀測的 RenderPlan policy 邊界**。

本報告的建議依序是：先收斂真值，再收斂 identity，再收斂 handover appearance，最後才把大型 React shell 拆成 view modules。這不是全部重寫；每一段都可以用 adapter 保留舊路徑並獨立驗證與回滾。

## 證據範圍與讀法

這是唯讀架構分析。本輪：

- 沒有執行任何 git 寫入指令；
- 沒有執行任何 `*:browser` validator；
- 沒有把目前的 TypeScript、靜態 gate 或 source pin 當成畫面已驗收；
- 唯一建立的檔案是本報告。

目前 checkout 的可重現環境證據如下：

```text
branch: wip/ee-handover-authority-2026-09-05
HEAD:   67a98fd
dirty:  src/App.tsx、src/scene/MainScene.tsx、既有 multi-candidate test，以及多個未追蹤的 WIP/report/layer 檔案
lines:  App.tsx 4215
        MainScene.tsx 4438
        sinrLiveCellModel.ts 4342
        useSimulation.ts 997
        liveSimToScene.ts 607
        NormalizedSceneFrame.ts 503
```

目前 WIP 上的 symbol analyzer（`node --import tsx/esm scripts/refactor/analyze-closure-captures.ts --file src/App.tsx --function App --project tsconfig.json`）輸出 `useState: 62`、`useRef: 29`、`useMemo: 46`、`useCallback: 45`、`useEffect: 31`、`ownedWrittenBindings: 109`、extractability score `49`。owner 提供的「77 個 state／23 個叢集／10 個循環」來自較早的量測；`N1.answer.md:5-11` 與 `N1.md:13-25` 仍查證了 23 個叢集裡 10 個有同類循環。這裡不把兩個 snapshot 硬湊成同一個數字；它們都支持同一結論：**App 的循環與跨域依賴已經是架構問題，但不支持一次性重寫或先做 global store。**

任務提供的初步盤點「36 個顏色/調色函式、40 個換手決策檔案／123 處」在本報告中被當作 audit input；下文另外用目前 source 的具體 authority anchors 驗證其形狀，沒有把這兩個數字冒充成一次新的完整 grep census。行號以本次 audit 讀取的 shared WIP snapshot 為準。

以下分清三種敘述：

- **已查證現況**：附 `file:line`，或附上面的指令輸出。
- **架構推論**：根據現況提出的目標契約，不宣稱已落地。
- **owner 決策**：產品或科學語意，AUDIT 不代替 owner 選擇。

# 1. 渲染真值的擁有權地圖

## 1.1 現在畫面是怎麼被組出來的

### A. source、route 與時間先決定「正在看哪一個世界」

`App` 先決定 route、`simulationSource`、`sceneSource`、profile、時間控制與 UI mode。`src/App.tsx:390-405` 顯示 `/`、`/legacy`、`/walker` 的 route 判斷，以及 legacy Walker route 會強制 `sceneSource = 'live-sim'`；同一段也顯示非 legacy route 才讀 URL 的 scene source。這不是單純 routing：它決定後面到底由 live simulation、archived TLE 或其他 producer 提供 frame。

時間與控制目前分散在 App、播放 hook、simulation hook 與 presentation owner：

- App 保存時間、seek、pause、速度、manual handover、director 與 scene/lane state；`src/App.tsx:400-456`、`src/App.tsx:1193-1212`。
- `useSimulation` 接收 replay/speed/paused/reset/seek/jog 等多組輸入，並在 frame loop 中 step runtime、安裝 decision override、更新 frame；`src/scene/useSimulation.ts:215-259`、`src/scene/useSimulation.ts:916-994`。
- archived 播放的 RAF 以 ref 同步外部 selector；當外部時間與 `lastRequestedTimeSec` 相差 `>= 15` 秒就把它解讀成外部 seek，否則視為自己遞增；`src/App.tsx:2310-2369`。這是一個實際的外部控制通道，不只是 cache。
- handover presentation 的純 policy 只把 supplied clock 映射成 bounded interval，不自行前進時間；`src/scene/handoverPresentationDisplayPolicy.ts:41-63`。然而這個 clock 仍由 React/R3F adapter 與其他手動/cinema state 提供。

**目前的 owner 判斷：**時間沒有單一全域 owner；不同 source 有各自的 cursor/clock 入口，presentation 又有自己的 display clock。這解釋了為什麼「同一事件在 scene 與 rail 的時間點」可能被分別處理。

### B. simulation frame 產生科學與服務真值

`useSimulation` 把 profile、beam layout、UE、mobility、EE threshold、multi-candidate 與 seek 等東西送入 runtime；`src/scene/useSimulation.ts:215-259`。live cell model 至少同時保有 cell truth、beam truth、frequency reuse 與 handover identity；`src/scene/sinrLiveCellModel.ts:1-37`。

在 frame runtime 裡，cell model 的結果被掛到 `frame.sinrLiveCells`，另外把 `model.getHandoverDecisionFrame()` 掛到 top-level `frame.handoverDecisionFrame`；`src/scene/sinrLiveCellRuntime.ts:475-495`。這個 top-level immutable decision frame 是目前最接近 canonical handover truth 的東西，但它只解決「決策/接受哪個 link」，還沒有解決「所有 renderer 如何畫它」。

model 內還存在兩個層次：

- primary assignment 使用新的 `HandoverDecisionEngine` 與 `InstantaneousEePolicy`，並處理 intra/inter、TTT、guard 與 atomic assignment；`src/scene/sinrLiveCellModel.ts:1221-1271`、`src/scene/sinrLiveCellModel.ts:2912-3027`。
- 非 primary 或 startup/background 路徑仍使用 cell-level `HandoverManager` 與 per-cell serving record；`src/scene/sinrLiveCellModel.ts:2410-2457`、`src/scene/useSimulation.ts:518-528`。

這是第一個重要的雙權威：**新的 primary decision frame 與舊的 per-cell/legacy manager 並存**。它們不是每次都矛盾，但目前沒有一個總契約禁止下游在不同情境各取一個。

### C. publisher 將 decision frame 包裝成 accepted snapshot

`useSimStatePublisher` 讀取 live frame 的 decision，而不是再 step 一次 clock 或 decision engine：`src/scene/useSimStatePublisher.ts:873-887`。接著在 `src/scene/useSimStatePublisher.ts:888-960` 建立 accepted presentation session/snapshot；homepage 路徑用 `sourceFrameId`、`epochToken`、`simTimeMs` 與 decision boundary 建立 snapshot，並明確說 accepted decision 是 candidate authority，且只有 decision engine 能推進 handover。

這是很好的既有 seam，但它還沒有成為所有 render output 的唯一輸入：

- `App` 仍把 `simState`、`visibleHandover`、continuity ref、manual/cinema state 傳回 scene；`src/App.tsx:1049-1123`、`src/App.tsx:1134-1212`。
- `MainScene` 同時接受 `acceptedHandoverPresentation` 與 `sim`/`viz`/各種 layer item；`src/scene/MainScene.tsx:1935-2089`。
- rail 與 scene 已有共享 identity allocation 的嘗試，但 allocation 的生命週期/消費仍有 route store 與 MainScene 各自的組合邏輯；`src/engine/handover/candidatePresentationPlan.ts:706-732`、`src/ui/handover-evaluation/candidatePresentationIdentityStore.ts:113-163`。

### D. scene frame 仍是「部分 normalized」，不是最終 render truth

幾何本身有一個清楚的 seam：`SceneGeometry` 說明它是 scene geometry boundary，live/replay adapter 都填入同一形狀；`src/scene/SceneGeometry.ts:1-27`、`src/scene/SceneGeometry.ts:160-205`。但 geometry 與 role/color 的權威仍分開且不封裝在同一 render plan。

live projection 的主路徑是：

1. `liveSimToScene` 檢查 live geometry brand，再呼叫 `deriveLiveSceneFields`；`src/showcase/liveSimToScene.ts:105-129`。
2. 它先把 satellite world position、beam、link、UE 投影出去；`src/showcase/liveSimToScene.ts:131-277`。
3. 接著對 Walker cell truth 做 override：若有 authoritative decision frame，就用它選 serving pair；否則回到 primary cell record；`src/showcase/liveSimToScene.ts:279-343`。
4. 仍從 legacy `recentHandoverEvents` 取得 latest event、transition progress 與 role approach；`src/showcase/liveSimToScene.ts:345-475`。
5. 若 `resolveHandoverAuthorityJoin` 有結果，再覆寫 handover、roles 與 transition；`src/showcase/liveSimToScene.ts:477-529`。

這是一個**有順序的 precedence chain**，不是一個 owner。較後的 adapter 可能覆寫較早的 derived result；某些資料來自 decision frame，另一些仍來自 generic steered simulation。

`sceneFrameResolver` 再加一層 precedence：若 caller 已傳 `sceneFrame` 就優先，否則才從 live sim projection；archived 則另外包 provenance；`src/scene/sceneFrameResolver.ts:23-45`。因此 `NormalizedSceneFrame` 雖然說自己是 renderer-only input，檔案註解也承認它目前還不是唯一 authority；`src/scene/NormalizedSceneFrame.ts:1-38`。

### E. MainScene、useBeamViz 與 renderer 最後決定長相

`useBeamViz` 讀 `NormalizedSceneFrame` 與 `SceneGeometry`，做比例、排序、serving/pending/recent 選擇，最後組成 `BeamTarget`；`src/scene/useBeamViz.ts:99-170`、`src/scene/useBeamViz.ts:760-830`。它還以自己的 `satelliteTintIndex(sat.id, displayOrder)`/`satelliteTint` 產生 display satellite identity；`src/scene/useBeamViz.ts:435-489`。

`MainScene` 再把下列幾組決策合在一起：

- accepted snapshot / homepage identity / EE 對 beam 與 cell 顏色的 resolver；`src/scene/MainScene.tsx:1946-1988`；
- accepted、candidate、ambient satellite maps 與 by-cell/by-beam beam maps；`src/scene/MainScene.tsx:2014-2055`；
- `viz.satBeams` fallback 到 `colorForServingBeam`；`src/scene/MainScene.tsx:2046-2089`；
- 一個 `sinrLiveConePalette` 傳給多個 cone/footprint mounts；`src/scene/MainScene.tsx:2829-2866`；
- pulse、triggered、cinema、authority 四條 handover cue 路徑；`src/scene/MainScene.tsx:2995-3118`、`src/scene/MainScene.tsx:3140-3182`。

live cone renderer 也不是單純 paint：

- render item key 明確合併 `satId-cellId-beamId`，缺 beamId 時由 cell 推 link-budget beam；`src/viz/SinrLiveCellBeamCones.tsx:162-185`。
- `resolveSinrLiveConeDisplayStyle` 先決定 semantic role，再視 `colorAuthority` 以 item identity 覆蓋；`src/viz/SinrLiveCellBeamCones.tsx:188-217`。
- mount 再依 homepage flag 以 `homepageSatelliteColorForBeam` 覆寫 style color，並依 EE 與 primary identity 改 opacity；`src/viz/SinrLiveCellBeamCones.tsx:1394-1459`。

最後的 sink 不只有 cone：

- `HandoverLinks` 直接由 serving/primary/scheduled beam 選 pair，再呼叫 `colorForServingBeam`；`src/viz/HandoverLinks.tsx:52-64`。
- `IntraGroundShockwave` 先查 satellite/beam identity map，查不到才回到 hardcoded intra source/target fallback；`src/viz/IntraGroundShockwave.tsx:276-305`。
- `ServingGroundRipple` 先查 beam map，再查 satellite map，再 fallback；`src/viz/ServingGroundRipple.tsx:114-159`。
- `SatelliteMarker` 的 role 控制 scale/label，但 tint map 控制 marker/light/label 的顏色；`src/viz/SatelliteMarker.tsx:104-168`。

換句話說，使用者看到的「CSS 顏色」實際主要是 Three/R3F material 的 `color`/opacity，另有 DOM panel/rail 的 `cssColor`。目前沒有一個包含兩者的 immutable `RenderFrame`。

## 1.2 現在誰說了算：決策表

| 畫面事實 | 目前最接近的權威 | 實際最後決策者 | 重複或缺口 |
|---|---|---|---|
| live 時間與 frame | `useSimulation` runtime；archived 另有 App RAF | App、hook、presentation adapter 各自消費 | archived ref 是外部控制通道；legacy derive 又使用 wall clock |
| primary serving pair | `handoverDecisionFrame` | `liveSimToScene`、publisher、MainScene 各自 join/override | per-cell `HandoverManager` 與 legacy `recentHandoverEvents` 仍存在 |
| selected/committed 的可畫 transition | `handoverAuthorityJoin` | `handoverPresentationDisplayPolicy`、cue policy、MainScene layer flags | selected 在 homepage 可被隱藏，committed/guard 又有 retained commit |
| beam geometric placement | `SceneGeometry` + source frame cell placement | `liveSimToScene`、`useBeamViz`、cone resolver | normalized scene 有 legacy magnitude fallback，沒有完整 geometry plan |
| stable serving identity | `servingColour` 的 sat/beam 函式 | cone item、MainScene map、HandoverLinks、fallbacks | `useBeamViz` 另有 4-color satellite tint；homepage 另做 compact family |
| handover event color | `sinrLiveConeStyle` semantic role palette | cone mount、handover resolvers、additive recoloring、shockwave fallback | same intra event 在不同 layer 是不同 precedence |
| accepted candidate identity | `allocateHandoverVisualIdentities` | candidate plan、identity store、MainScene | episode allocation、route allocation、homepage index 並存 |
| DOM rail color | candidate presentation identity / homepage projection | rail/panel projection | 沒有硬契約要求與 scene 的每個 render sink byte-for-byte 同色 |

### 明確的重複權威

1. **palette index 至少兩套。** `homepageSatellitePaletteIndex` 在 `src/homepage/controller/homepageSatelliteVisualIdentity.ts:185-197` 取 supplied identity index，否則回到 `servingIdentityPaletteIndex`，再把 16-slot 壓成 homepage compact family；`handoverVisualIdentity.ts:654-720` 則以 preferred index、reserved slots、assignments 做 linear/contrast-aware allocation。後者是 episode/candidate identity allocator，不是前者的純 alias。
2. **satellite tint 至少三種語意。** `beamRoleTokens.ts:52-66` 有 4-color satellite tint；`servingColour.ts:39-67` 有 16-color serving identity palette；homepage 又以 `homepageSatelliteBaseColor`/`homepageSatelliteColorForBeam` 做 compact/EE projection。`useBeamViz.ts:435-489` 還能直接用前者產生 display tint。
3. **intra 顏色有 semantic 與 identity 兩個權威。** `beamRoleTokens.ts:68-96`/`sinrLiveConeStyle.ts` 提供 pulse/target semantic colors；`servingColour.ts:183-203` 以保留 hue 的方式做 source darken/target lighten。`handoverConeResolvers.ts:66-124`、`:127-225`、`:258-318` 會把兩者依路徑組合；homepage mount 之後還可覆寫它。
4. **decision 有新舊兩條路。** primary immutable decision frame 與 cell-level manager/legacy event 同時存在；`sinrLiveCellModel.ts:2410-2457` 與 `useSimulation.ts:518-528` 是直接證據。
5. **cellId/beamId 不是一個無害的型別細節。** cone key 以兩者組合，缺 beamId 時由 cell 推導；`src/viz/SinrLiveCellBeamCones.tsx:162-169`。multi-candidate map 也同時維護 `bySatelliteCell` 與 `bySatelliteBeam`；`src/scene/multiCandidateBeamColors.ts:1-68`。這代表目前系統還在替 owner 延後選擇，而不是已經決定了唯一 key。

## 1.3 目前的 ownership verdict

`handoverDecisionFrame` 可以作為 primary handover 的科學真值起點；`acceptedHandoverPresentationSnapshot` 可以作為 scene/rail 共享的 accepted boundary。這與現有 `handoverAuthorityJoin` 的契約一致：只有 immutable decision frame 可以提名 solid data link，且最多一條；`src/scene/handoverAuthorityJoin.ts:29-38`、`src/scene/handoverAuthorityJoin.ts:106-120`。

但目前**沒有誰單獨擁有「一顆衛星/一道波束在所有畫面長什麼樣」**。現況是：

```text
decision truth       = sinrLiveCellModel / HandoverDecisionFrame
accepted boundary    = useSimStatePublisher / accepted snapshot
scene interpretation = liveSimToScene + normalized frame + useBeamViz
visual policy        = MainScene + multiple color/presentation modules
final appearance     = cone mount + ripple/shockwave/link/marker fallbacks
rail appearance      = candidate plan + identity store + homepage projection
```

這是要修的核心，不是單純的檔案大小。

# 2. 為什麼「改一次會壞別的地方」

以下用 owner 最常見、也最能暴露架構問題的 prompt 作具體追蹤：

> 「把 intra 換手時的波束顏色變化改掉：source 與 target 要用新的同色系變化，並且 scene、換手 cue、衛星/UE 周邊與 rail 要一致。」

先說清楚：這句話的「一致」目前沒有一個程式型契約。它至少跨過六種 output。

## 2.1 一次 intra event 會經過哪些地方

### 第一步：事件本身不是一個 render color

live cell model 先決定 serving、candidate、selected、commit 與 intra/inter；`src/scene/sinrLiveCellModel.ts:1221-1271`、`:2643-2676`、`:3273-3290`。`handoverAuthorityJoin` 再把 selected/committed boundary 轉成 presentation pair，並根據 pair 的 satellite/cell/beam 驗證 geometry；`src/scene/handoverAuthorityJoin.ts:203-239`。

接著 `handoverPresentationDisplayPolicy` 會決定要不要顯示、是否壓掉 concurrent intra、要不要顯示 homepage EE progress；`src/scene/handoverPresentationDisplayPolicy.ts:219-290`。所以「intra」可能是：

- engine 的 `kind = intra`；
- presentation event 的 `kind = intra`；
- semantic cone role 的 `pulse`、`handoverSource`、`handoverTarget` 或 `triggered`；
- homepage identity mount 的 primary identity beam；
- 其他 layer 的 source/target endpoint。

這些名稱相近，但不是同一個 enum。

### 第二步：穩態 serving 顏色與 transition 顏色是不同決策

`servingColour.ts:183-203` 的 `emphasizeIntraHandoverColor` 會在保留 satellite hue 的前提下，把 source darken、target lighten；`servingColour.ts:264-315` 則決定 steady serving beam/satellite 的 palette。若 owner 只改這裡：

- 走 `handoverConeResolvers` 的 pulse/triggered/cinema/authority 路徑可能跟著變；
- `sinrLiveConeStyle` 裡的 semantic pulse color、target orange、inter blue 不會自動變；
- homepage cone mount 後面可能用 EE-driven `homepageSatelliteColorForBeam` 再覆寫；
- `HandoverLinks` 是直接 `colorForServingBeam`，不一定走 transition resolver；
- shockwave/ripple 若 map 缺 key，會落到自己的 fallback。

反過來，若 owner 只改 `beamRoleTokens.ts:68-96` 或 `sinrLiveConeStyle.ts` 的 pulse/target palette：

- live cone 的 semantic-role 路徑可能變；
- `handoverConeResolvers.ts:66-124`、`:127-225`、`:258-318` 仍可能用 accepted beam identity 加 `emphasizeIntraHandoverColor`；
- `additiveHandoverConeColoring.ts:42-81` 會對 pulse/triggered/cinema overlay 再做一次 recoloring；
- homepage 以 `item-identity` 時，`SinrLiveCellBeamCones.tsx:1414-1444` 最後可以不採 semantic color，而採 `homepageSatelliteColorForBeam`；
- `IntraGroundShockwave` 的 fallback 常數不會因 semantic palette 改動而一致。

### 第三步：MainScene 會重新決定 identity map 與 precedence

`MainScene.tsx:1946-1988` 同時有 accepted beam color、accepted cell color、homepage satellite color 三種 resolver。接著 `MainScene.tsx:2014-2055` 組 accepted/candidate/ambient satellite map 與 multi-candidate beam map，`MainScene.tsx:2046-2089` 再把 `viz.satBeams` 的 identity color 做成另一張 map。

所以 owner 可能已修改「顏色函式」，但畫面仍不變，因為：

1. 該 layer 收到的是 `multiCandidateBeamColors.bySatelliteCell`，不是同一個 `bySatelliteBeam`。
2. 該 mount 的 `colorAuthority` 是 `item-identity`，它覆蓋 semantic style。
3. accepted snapshot 存在時，MainScene 優先使用 snapshot identity；snapshot 不存在時才用 serving fallback。
4. transition layer 只對 central overlay recolor；ambient layer 仍用 serving identity。

### 第四步：同一個「波束」可能有兩個 key

`SinrLiveCellBeamCones.tsx:162-169` 定義 render key 為 `satId-cellId-renderItemBeamId`，缺 beamId 時用 `cellLinkBudgetBeamId(cellId)`。`SinrLiveCellBeamCones.tsx:436-488` 的 serving resolver 又明確註明 live cell lane 以 `cellId` 作 serving unit，並在有明確 beamId 時改用 beam shade。

因此：

- 如果新 policy 以 `beamId` 為 key，而某個 legacy event 只有 `cellId`，它可能查不到 color map，掉到 fallback。
- 如果新 policy 以 `cellId` 為 key，而同一 cell 在 intra transition 暫時出現兩個 physical beam variant，它可能把兩個 visual identity 壓成一個。
- 如果 `beamId` 是 link-budget 1-based、cell 是 geometry 0-based，還會出現「畫得出來但對錯顏色」的情況；`src/viz/SinrLiveCellBeamCones.tsx:198-203` 與 `src/scene/MainScene.tsx:1967-1983` 都明確做了 cell-to-beam conversion。

這不是 owner 需要在 prompt 裡自己記住的細節；這應該由一個 identity policy 的 typed mapping 明確承擔。但在現況，owner 會被迫知道它。

## 2.2 為什麼「改三個地方」仍可能漏

以一次 intra target 顏色為例，實際可能需要檢查：

| 路徑 | 目前可能的決策點 | 只改別處時的症狀 |
|---|---|---|
| ambient/serving cone | `servingColour.ts`、`SinrLiveCellBeamCones.tsx:436-588` | ordinary beam 改了，但 pulse 不改；或 UE dots 與 cone 不同色 |
| semantic pulse | `sinrLiveConeStyle.ts`、`beamDisplaySpec.ts:284-306` | pulse 改了，但 triggered/cinema pair 仍是舊色 |
| natural/authority cue | `handoverConeResolvers.ts:66-124`、`:127-225`、`:258-423` | selected/committed event 沒跟 ambient 一起改 |
| central additive overlay | `additiveHandoverConeColoring.ts:30-81`、`MainScene.tsx:3140-3182` | overlay 對同一 item 二次 recolor，出現兩套 target 色 |
| homepage scene | `MainScene.tsx:1946-1988`、`SinrLiveCellBeamCones.tsx:1420-1452` | homepage EE shade 覆蓋了新 semantic color |
| link/ripple/shockwave | `HandoverLinks.tsx:52-64`、`ServingGroundRipple.tsx:114-159`、`IntraGroundShockwave.tsx:276-305` | 線、地面波紋或 shockwave 仍是舊色/neutral fallback |
| satellite marker/rail | `SatelliteMarker.tsx:104-168`、candidate plan/identity store | 衛星 marker 或 rail 不跟 beam cue；scene 與 rail 不一致 |
| retired/fixture path | `SatelliteBeams.tsx`、`HandoverStoryLayer.tsx:186-190,269` | live 可能沒變，但 fixture/gate 或另一條 route 仍讀舊常數 |

因此 owner 說「我已經改了三個地方」並不表示修改不夠努力；問題是三個地方沒有穩定的 semantic address。每一個地方只知道自己收到的 local vocabulary，沒有人能告訴 owner 哪一個才是「intra beam appearance」的唯一入口。

## 2.3 哪些檢查會攔，哪些攔不到

### 會攔到一部分的檢查

- TypeScript/lint 會攔住型別不一致，但不會攔住兩個合法 `string` 顏色各自不同。
- `validate:beam:colour-match` 會守住它涵蓋的 serving cone/UE identity 關係；`SinrLiveCellBeamCones.tsx:1155-1160` 也明確說它與 `SinrLiveCellFootprintRings` 仍使用 legacy opts adapter。
- `validate:frontend:beam-display-spec-purity` 會限制 renderer 直接放 color literal，因為 appearance authority 被指定在 `sinrLiveConeStyle.ts`；`src/constants/sinrLiveConeStyle.ts:716-724`。
- `validate:vc:intra-handover-arrow`、`validate:intra-shockwave-s4`、`validate:intra-ribbon-s4b` 等 gate 會各自守自己的 layer/contract；它們存在於 `package.json:120-123`。
- serving cone 的 serving-only contract 有 s0/s4 與 render test 守護；`SinrLiveCellBeamCones.tsx:499-508`。

### 攔不到的部分

- 沒有一個 contract 要求 ambient cone、pulse、triggered、cinema、authority、HandoverLinks、ripple、shockwave、marker、rail 對同一 `(episodeId, entity key, phase)` 使用同一個 `BeamAppearance`。
- `validate:beam:colour-match` 通過，不表示 handover cue 或 homepage override 沒有再改色。
- purity gate 可以阻止新的 literal，不能證明 semantic palette 與 identity palette 的 precedence 正確。
- source-text pin 可以讓「舊檔案還有某段文字」通過，但不能證明 owner 改的是 live path；`APP-TSX-TEXT-PIN-TRIAGE.md:1679-1685` 也警告 source pin 與 behavior proof 不同。
- 純函式單元測試可以證明 resolver 在某組 input 下回傳值，不能證明使用者實際看到的所有 layer 都拿到該值。
- 本輪未執行 browser validator，因此沒有任何 pixel、WebGL、DOM layout 或 owner visual acceptance 結論。`OWNER-DECISIONS-BLOCKING-P4.md:11-22` 也把 browser gate 的綠/紅與產品決策分開記錄。

**結論：**現在的閘門多半是「每條支流各自不壞」；owner 需要的是「同一個 rendering policy 改動會沿所有支流一致地流動」。兩者不是同一種測試。

# 3. 目標狀態的設計

## 3.1 目標不是 global store，而是單向 authority pipeline

建議目標資料流：

```text
SourceProvider
  -> PlaybackTransport
  -> SourceFrameAdapter
  -> CanonicalFrame
       - physical positions and beams
       - one HandoverDecisionFrame
       - source/time provenance
  -> AcceptedHandoverSnapshot
  -> VisualIdentityPolicy
  -> HandoverAppearancePolicy
  -> BeamGeometryPolicy
  -> RenderFrame / RenderPlan
       - satellite render records
       - beam render records
       - UE render records
       - handover cue records
       - rail projection records
  -> SceneProjection + RailProjection
  -> dumb Three/R3F and DOM components
```

這個方向延續 repo 已有的較好設計意圖：`PlaybackTransport -> SourceFrameAdapter -> HandoverDecision -> AcceptedHandoverSnapshot -> SceneProjection + RailProjection`；先前 authority handoff 也明確要求不要再造第二個 clock、decision、snapshot 或 render gate。這裡把它補完到 visual policy，而不是重新發明另一條平行架構。

## 3.2 應收斂成單一 policy 的模組

| 目標 module | 唯一職責 | 輸入 | 輸出 | 不准做的事 |
|---|---|---|---|---|
| `PlaybackTransport` | 擁有 source cursor、play/pause/seek/advance command | source session、使用者 command | immutable source frame + transport status | 不替 scene 決定顏色或 handover |
| `SourceFrameAdapter` | 把 live、archived、artifact 等 producer 轉成共同 frame | producer frame、geometry/provenance | `CanonicalFrame` | 不重算第二個 decision |
| `HandoverDecisionPolicy` | hard gates、TTT、selection、guard、atomic commit | canonical physical frame、policy config | 一個 `HandoverDecisionFrame` | 不產生 presentation color/opacity |
| `AcceptedHandoverSnapshot` | 固定一個 frame/episode 的 scene/rail 可見 boundary | decision frame、identity lease、source identity | immutable accepted snapshot | 不讀 wall clock、不再選 winner |
| `VisualIdentityPolicy` | 分配並維持 satellite/beam identity、alias 與 palette | accepted snapshot、owner 選定的 key contract | `RenderIdentityFrame` | 不依照 render order 私下改 palette |
| `HandoverAppearancePolicy` | 把 kind/boundary/phase/layer/identity 轉成 source/target/steady `BeamAppearance` | decision + presentation view + display spec + identity | immutable color/opacity/role/visibility tokens | 不讀 React ref、不從 component fallback 猜事件 |
| `BeamGeometryPolicy` | 把 canonical beam/earth-fixed placement 轉成可畫幾何 | source frame、scene geometry、display scale | apex/base/radius/anchor geometry | 不決定誰 serving、誰 target、什麼顏色 |
| `RenderFrame` / `RenderPlan` | 將上述結果一次性 join | accepted snapshot + identity + appearance + geometry | scene 與 rail 共用的完整 render records | 不含 setter、不反向寫回 simulation |
| `SceneProjection` / `RailProjection` | 對各消費面做 shape projection | 同一 `RenderFrame` | Scene props、rail rows | 不重新分配 palette、不重判 handover |
| leaf renderer | 只 paint input | render record | Three/R3F material 或 DOM CSS | 不 import simulation/decision/palette authority |

這些不是要求一次新增十個檔案。它們是**ownership contract**；可以先由現有模組實作，再逐步搬移。深 module 的判準是：介面小、內部決策完整、外部不需要知道它的 precedence。

## 3.3 一顆波束的目標資料契約

一個 render record 應至少同時攜帶：

```text
sourceFrameId
decisionId / episodeId
entity identity
cell/beam correspondence
physical geometry
semantic role
handover phase and boundary
identity token
appearance token
visibility and opacity
provenance
```

component 不應再做這種選擇：

```text
if homepage then use homepage color
else if map has beam key use map
else if map has cell key use map
else use serving fallback
```

上面的規則應在 `VisualIdentityPolicy`/`HandoverAppearancePolicy` 完成。component 只接受 `render.color` 與 `render.opacity`。這樣 owner 的 prompt 才能有穩定地址：

- 「改 intra target 顏色」→ `HandoverAppearancePolicy` 的 intra target rule；
- 「改同一顆衛星的 beam shade」→ `VisualIdentityPolicy` 的 beam identity rule；
- 「改低仰角波束的形狀/寬度」→ `BeamGeometryPolicy`；
- 「改 seek/播放」→ `PlaybackTransport`；
- 「改 rail 排版」→ `RailProjection`，但不能重判顏色真值。

## 3.4 cellId vs beamId：保留 owner 決定，不替 owner 選邊

這個 audit 不選 canonical key。目標設計應先讓 schema 顯式表達兩者，而不是讓每個 consumer 自己 fallback：

```text
VisualIdentityKey = owner-selected canonical key
CellBeamCorrespondence = explicit mapping with source and target provenance
```

兩種選擇的後果要由 owner 決定：

| owner 選擇 | 好處 | 代價 |
|---|---|---|
| `cellId` | 幾何 cell、UE mosaic、同一地面服務區較容易保持一致；cell lane 的資料較穩定 | 同一 cell 的不同 physical beam variant 可能無法有不同 steady identity；需要把差異放在 transition/geometry token |
| `beamId` | 能區分實際 link-budget beam，適合同一 cell 同時出現不同 beam identity | 必須保證 beam id 的 producer、基準（0/1-based）、生命週期一致；若 beam id 會重排，顏色可能跳動或跨 lane 對不上 |

目前 code 同時保留 `bySatelliteCell` 與 `bySatelliteBeam`，正說明這個決策還沒有被收斂；`src/scene/multiCandidateBeamColors.ts:1-68`。在 owner 決定前，不能把「兩邊都支援」誤報成「已經一致」；應該讓 mapping adapter 暫時顯式報出 alias/miss，而不是靜默 fallback。

## 3.5 十個循環依賴在目標設計下怎麼處理

`N1.md:67-90` 已列出 23 個叢集與 10 個同類循環。目標不是把所有 state 搬進一個 store，而是把反向邊改成 command/event 或明確的 input/output seam。

| 現有叢集 | 現有反向邊的意思 | 目標處理 |
|---|---|---|
| `handle` | homepage jump handler 依賴 seek handler | UI 只送 `JumpToEvent` command；transport 回傳新 frame；handler 不互相捕獲 |
| `live` | rail event index 反過來被 runtime composite 需要 | index 成為 frame 的 derived projection 或明確 query service；不由 UI callback 反推 runtime |
| `scene` | topology reset key 依賴 active topology，而 topology 又由 state 組出 | topology config 是 source/session input；reset 是新 session event，不由 consumer 產生 key |
| `walker` | beam display frame 依賴 runtime，runtime 又依賴 scenario epoch | epoch 是 source session identity；runtime 只消費 immutable session/frame |
| `current` | coverage 依賴 replay scene frame，再回到 current time | time 只由 transport/source cursor 產生；coverage 是 projection，不回寫 current time |
| `homepage` | rail projection 依賴 runtime，runtime 又讀 homepage threshold | threshold 是 immutable policy config；rail 只消費 accepted `RenderFrame` |
| `teaching` | teaching story candidate 依賴 runtime，又反向落入 runtime input | teaching 是 presentation command/view；不作 simulation truth input |
| `archived` | RAF 讀 App ref，App ref 每 render 寫回 selector，再用 15 秒 heuristic 判 external seek | transport 擁有 cursor；RAF 只發 `advance`，外部只發 `seek`；移除 ref control channel 與 heuristic |
| `handover` | reset key 依賴 policy version/state | policy version 是 immutable config identity；新 config 產生新 policy session，不從 render state 反推 reset |
| `modqn` | bundle omega 依賴 replay slot offset/display state | MODQN input/session 明確化；render output 不回寫 producer slot/omega |

所以答案是：**大部分循環消失為單向資料流；少數互動保留，但變成明確雙向契約。** 例如 UI 與 transport 的 `command -> frame` 是合法的雙向產品互動，不是 hidden closure cycle；presentation owner 也可以有 `advance(input, command) -> nextState/view`，但它不應把 view 再偷偷送回 simulation truth。

# 4. 從現狀到目標的分階段路徑

每個階段都應是一個小型、可獨立驗證的 seam change。實作時可用 feature flag 或 adapter 保留 old/new consumer，讓 rollback 是切回 consumer，而不是重寫一大片檔案。

## P0：凍結 authority contract，先不改行為

**做什麼**

- 建立一張 machine-readable authority matrix：source、clock、decision、accepted snapshot、identity、appearance、geometry、scene、rail。
- 為每個 render sink 記錄 `sourceFrameId`、`decisionId`、key type、color authority、fallback。
- 將現有 36 個 color/tint decision function 與 40 個 handover decision file 分成「真值」「policy」「adapter」「sink」，不先搬檔。
- 為現況建立 deterministic contract fixtures，而不是先寫更多 source pins。

**做完 owner 能多做什麼**

能問：「這個 prompt 影響哪個 authority？目前有哪些 sink 會讀它？」而不是從整個 `MainScene`/`App` 猜路徑。尚不能承諾只改一檔；這一階段的成果是可追蹤性。

**風險與驗證**

- 風險：把舊路徑誤標成已退休，或把 fixture 當 live path。
- 驗證：AST/import inventory、現有 unit tests、`tsc`、非 browser static checks；保留目前 dirty WIP 差分。不得用 source pin 通過代替行為證據。
- 回滾：刪除 matrix/fixture，不動 runtime。

**需要 owner 決定的事**：這階段就要先回答下面「產品契約決策」清單，否則後續會反覆搬錯 authority。

## P1：單一 transport 與 source frame seam

**做什麼**

- 在現有 live、archived、artifact producer 外包一層 `PlaybackTransport`/`SourceFrameAdapter`。
- 先 dual-publish：舊 App state 保留，但新 adapter 產生 `CanonicalFrame` 並做 parity logging。
- 將 archived 的 ref/15 秒 heuristic 改成明確 `seek` command 與 `advance` command；在 owner 尚未接受前，可保留舊 adapter 作 fallback，但不讓新 policy 讀 ref。

**做完 owner 能多做什麼**

「改播放速度、seek、source cursor」集中在 transport seam；不用碰 render component，也不會同時改 handover color。

**風險與驗證**

- 風險：old/new cursor 在 paused frame 或 source switch 時不同步。
- 驗證：transport unit、source join test、seek landing test、`tsc`、非 browser baseline 的差分；同一 `sourceFrameId` 驗證 scene/rail 收到同一 frame。
- 回滾：切回 old publisher consumer；保留 adapter 但不啟用。

## P2：單一 primary handover decision frame

**做什麼**

- 把 `HandoverDecisionFrame` 定為 primary scene/rail 的唯一 serving/selected/committed input。
- `HandoverManager` 只可作明確標示的 legacy/background adapter；不得再偷偷決定 primary render。
- `recentHandoverEvents` 降級為 evidence/history，不能覆寫 decision frame 的 solid link 或 commit。
- 將 `handoverAuthorityJoin`、presentation owner、publisher 的 join 組成一個 public seam。

**做完 owner 能多做什麼**

「改 intra 何時進 selected/commit、TTT、guard、candidate eligibility」主要只需改 `HandoverDecisionPolicy` 及其測試；scene 不再跟著重寫 selection 邏輯。

**風險與驗證**

- 風險：legacy layer 依賴最近一個 event，而 decision frame 在 UI cadence 中跳過 switching frame。
- 驗證：decision trace、atomic commit trace、one-solid-link invariant、intra/inter unit tests、accepted snapshot join tests。`handoverAuthorityJoin.ts:242-252` 的 selected/committed presentation boundary 必須明確保留。
- 回滾：以 source/route feature flag 切回 legacy presentation adapter，不能讓兩者同時寫同一 render field。

## P3：單一 VisualIdentityPolicy 與 owner key 決策

**做什麼**

- 把 `servingColour`、`handoverVisualIdentity`、homepage compact projection、candidate identity store 的分工固定下來。
- `VisualIdentityPolicy` 只分配一次 identity，產出 `RenderIdentityFrame`；scene、rail、marker、cone、ripple、shockwave 全部只消費它。
- homepage `homepageSatellitePaletteIndex` 變成 projection/alias，不能再自行成為第二個 allocator。
- 在 owner 決定 cellId 或 beamId 後，移除各 consumer 的靜默 fallback；所有 mapping miss 要有明確 diagnostic。

**做完 owner 能多做什麼**

「同一顆 satellite/beam 的 palette、shade、route continuity」只需修改 VisualIdentityPolicy；prompt 不必再同時猜 `servingColour`、homepage helper、MainScene map 與 candidate store。

**風險與驗證**

- 風險：palette lease 的 episode scope 與 route scope 不一致，造成 scene/rail 短暫變色。
- 驗證：property tests：同一 accepted snapshot 的所有 consumer identity 相等；跨 frame 保持 identity；scene/rail `identityVersion` 一致；`validate:s2:satellite-identity-stable`、`validate:beam:colour-match` 等非 browser gate 做差分。
- 回滾：render plan 可接受舊 identity map 作 adapter，但不得讓舊/new allocator 同時寫 color。

**需要 owner 決定的事**：canonical color key 是 cellId 還是 beamId；同一 satellite 的 intra beam variant 是否允許 steady color 不同；UE marker 是否應跟 beam transition 一起變色。`servingColour.ts:291-315` 已把其中一個行為選項寫成產品語意，但本報告不替 owner 選。

## P4：HandoverAppearancePolicy 與 RenderPlan

**做什麼**

- 建立純函式 `resolveHandoverAppearance`，一次輸出 source、target、serving、candidate、pulse、triggered、cinema、authority 各 layer 的 `BeamAppearance`。
- 它接收 decision boundary、presentation phase、identity token、display spec；不接 React ref，也不做 source/decision lookup。
- 建立 `resolveRenderPlan`，把 color、opacity、role、visibility、geometry key、render key、provenance 一起 join。
- `MainScene` 保留 composition shell，但不再在 JSX 前重新組 color map 或 handover precedence。

**做完 owner 能多做什麼**

「intra target 改色、source/target alpha、pulse sustain、selected 與 committed 的差異」可集中在 `HandoverAppearancePolicy` 一個模組與一組 table-driven tests；所有 scene sink 會拿同一個 output。

**風險與驗證**

- 風險：把 display-only appearance 誤餵回 simulation，改變科學結果。
- 驗證：pure matrix tests，至少涵蓋 live/archived、intra/inter、selected/committed/guard、homepage/legacy、identity present/missing；確認 policy 沒有 `useState/useRef/useEffect` 與外部時間讀取。
- 回滾：保留舊 `MainScene` resolver 作 adapter，RenderPlan 只先接一個 layer，再逐層切換。

## P5：scene 與 rail 共享同一 RenderFrame

**做什麼**

- `SceneProjection` 與 `RailProjection` 只由同一個 accepted `RenderFrame` 產生。
- `App` 不再以 `visibleHandover` callback、continuity ref 或 child-render side effect 當第二個 presentation truth；App 只送 command、接受 snapshot。
- 將 candidate plan 的 identity allocation、MainScene accepted map、rail identity store 收斂成同一個 route/session lease。

**做完 owner 能多做什麼**

一句「scene/rail 的 intra target 都改成同色系 X」只需改 appearance/identity policy；不需要再改 rail adapter、MainScene、marker、shockwave 四個 consumer。

**風險與驗證**

- 風險：scene 與 rail 發布 cadence 不同，造成 snapshot boundary 短暫跨 episode。
- 驗證：每個 projection 帶 `snapshotId`/`sourceFrameId`/`identityVersion`；測試跨 cadence 的 retained snapshot；browser/pixel review 留給可啟動 Chromium 的環境，本輪不宣稱通過。
- 回滾：用舊 projection 讀同一 snapshot，不恢復 hidden callback truth。

## P6：最後才做 component/file split、刪 duplicate 與修 gates

**做什麼**

- 依已定義的 module boundary 拆 `App` transport shell、`MainScene` projection shell、layer renderer、rail projection。
- 刪除已沒有 consumer 的 legacy resolver、retired `SatelliteBeams` live twin、重複 palette allocator；每刪一條先跑 import/deletion test。
- 把會通過「文字存在」的 pin 改成 behavior/contract assertions；`APP-TSX-TEXT-PIN-TRIAGE.md:1802-1804` 已指出 extraction 可用 `tsc` 驗證，但 source pin 不等於 behavior proof。

**做完 owner 能多做什麼**

prompt 的 noun 能對到一個 module：transport、decision、identity、appearance、geometry、projection 或 pure renderer；不再對到一個 4,000 行 shell 裡的局部閉包。

**風險與驗證**

- 風險：新檔案只是把舊 coupling 搬家，數量增加但權威未減少。
- 驗證：deletion test、dependency direction check、`tsc`、focused unit、非 browser static gates、最後才是 browser/pixel/owner acceptance。
- 回滾：每一組 split 保持單一 import seam；可恢復舊 consumer，不需回退前面已確認的 source/decision policy。

## 4.1 必須由 owner 明確決定的產品契約

以下不能由工程師用「最方便抽取」代答：

1. **時間軸真值歸誰。** `/` 是否只代表 live Walker？archived TLE 是否是另一條正式 source？`?sceneSource=` 是否應被正式入口接受？現況 `App.tsx:390-405` 會在 legacy route 忽略它；`OWNER-DECISIONS-BLOCKING-P4.md:26-63` 已列出這是產品入口決策，不是 bug fix。
2. **MODQN 的進場合約。** 公開入口、測試專用入口，或退休相關 browser coverage，不能由 renderer refactor 順手決定；`OWNER-DECISIONS-BLOCKING-P4.md:67-96` 已列出選項與代價。
3. **selected 與 committed 的畫面語意。** homepage 目前 selected boundary 可暫不畫 cue，committed 才 promote target；`handoverPresentationDisplayPolicy.ts:139-159`、`handoverAuthorityJoin.ts:248-279`。要不要改，是產品/教學語意，不是色彩重構可以擅自決定的細節。
4. **cellId vs beamId 的 canonical identity key。** 本報告不選邊；必須連同 beam numbering、same-cell variant 與 UE marker 行為一起決定。
5. **intra 是否改 UE/marker 的 steady identity。** 同一 satellite 的 intra 是否保留 UE dot hue，或讓 transition 一起變，是可見產品契約。
6. **外部是否能指定 app/scene 進場 state。** artifact replay、MODQN、demo/驗證入口需要正式受支援的 entry contract，不能依賴 localStorage 或被 route silently reset。

# 5. 拆檔在這個藍圖裡的位置

## 5.1 今天的判準為什麼不夠

「能不能寫出不掛 React 的單元測試」是好的一半：它會找到純計算葉節點，這正是今天拆掉約 1,500 行與產出許多測試的價值。但它只回答「這段現在容易測嗎」，沒有回答：

- 這段是否擁有一個決策？
- 拆出去後是否仍有兩個地方在做同一個決策？
- owner 的 prompt 是否有穩定落點？
- 新 module 是否比原本更深，還是只是把 40 行 JSX 搬到另一個薄檔？
- 原檔的決策是否真的可以刪掉，而不是保留一份 hidden fallback？

`N1.md:252-267` 的建議也是先做可證明 leaf、對有環的 M/L 叢集逐條整理 seam，不把「無環」當成 ready。這應該成為後續拆檔規則。

## 5.2 新的拆檔判準

一個模組只有在以下條件大部分成立時才值得拆：

1. **Single owner**：它擁有一個明確決策，不只是轉傳 props。
2. **Deep interface**：輸入少而語意完整，外部不需要知道內部 precedence。
3. **Deletion test**：新模組接通後，原本那段決策程式可以被刪掉；若只能保留另一份副本，代表還沒完成。
4. **One-way dependency**：新模組不 import 回它要取代的 composition shell，不製造新的 cycle。
5. **Stable prompt address**：owner 能用產品詞對到它，例如 `HandoverAppearancePolicy`、`VisualIdentityPolicy`，而非 `MainScene` 的第 3 個 memo。
6. **Contract test**：測試的是 output contract、identity equality、phase matrix 或 geometry invariant，而非只測 source text。
7. **No hidden clock/authority**：模組不在 render 時偷偷讀 wall clock、ref 或另一套 palette allocator。

「可不掛 React 測試」應降為第 6 項的一部分，不應是唯一判準。

## 5.3 哪些現在可以拆，哪些不應先拆

### 可以先拆的

- 已經是純函式且有穩定 input/output 的 geometry、formatting、policy table、mapping validator。
- P1/P2 先做的 source/decision adapters；它們的價值是建立 seam，不是換檔名。
- identity allocation 的 pure allocator，但前提是 owner 已決定它的 scope（route、episode 或 snapshot）與 key contract。

### 架構重構前不要再拆的

- `MainScene` 裡的 accepted beam/cell/satellite color resolver、multi-candidate map 與 cue precedence：現在拆成多個 layer 只會把同一份 authority 分散到更多檔案；先做 P3/P4。
- `useSimulation`、`sinrLiveCellModel` 與 legacy `HandoverManager` 的邊界：先決定 primary decision frame 與 background adapter；否則拆出去仍會同時捕獲兩套 decision。
- `App` 的 archived RAF/ref、seek handlers、visible handover callback：先做 P1 transport contract；否則只是把 hidden control channel 藏進 hook。
- `liveSimToScene`/`deriveLiveSceneFields` 的 handover role/progress：先確定 canonical RenderFrame 的 precedence；否則每一次拆分都會再搬一次 legacy override。
- `useBeamViz` 的 satellite ordering、identity tint 與 geometry target：先讓它消費 `RenderIdentityFrame`/`BeamGeometryFrame`，再拆 view helper。
- 目前 WIP 新增的 `Scene*Layer` 檔案：它們可能降低 JSX 量，但在 policy 尚未收斂前只能稱為 view extraction，不能稱為 ownership refactor；要以 deletion test 檢查 MainScene 是否真的不再重新決策。

## 5.4 owner prompt 的最終落點

完成 P1-P5 後，常見 prompt 應有如下穩定落點：

| owner 想改的事 | 應修改的唯一 policy | 不應再修改 |
|---|---|---|
| intra source/target 顏色與 phase transition | `HandoverAppearancePolicy` | cone、ripple、shockwave、rail 各自的 fallback |
| satellite/beam identity 與 palette continuity | `VisualIdentityPolicy` | homepage 自己的 palette allocator、display order tint |
| 波束 apex/base/radius/地面 footprint | `BeamGeometryPolicy` | color/role resolver |
| threshold、TTT、selected/commit | `HandoverDecisionPolicy` | renderer、rail label、CSS |
| play/pause/seek/source | `PlaybackTransport` | MainScene handover resolver |
| scene/rail 顯示欄位與排序 | 各自 projection | decision、identity、simulation truth |

如果一個 prompt 同時需要改兩個 policy，應該是 owner 的產品需求跨了兩個概念，而不是要求 owner 去搜尋 40 個檔案。這種跨 policy 需求要在 `RenderPlan` 的 contract test 明確寫出來。

## 最後的判定

今天的拆檔工作不是錯；它改善了純計算的 locality，也讓測試更容易。但它主要改善的是 implementation size，沒有改變 rendering truth 的 ownership。下一步應停止以「再抽一個 helper」作為完成指標，改用三個問題驗收：

1. 這個決策是否只有一個 writer？
2. scene 與 rail 是否消費同一個 immutable snapshot/render plan？
3. owner 的 prompt 是否能用一個產品詞定位到一個 policy 與一組 behavior tests？

在這三題都能回答「是」以前，任何單獨的綠色測試、檔案數下降、或 renderer 有新的 prop，都不能宣稱 owner 的核心痛點已經解決。
