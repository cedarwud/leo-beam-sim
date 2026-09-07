# W-F：15 個既有 browser 紅燈的唯讀根因分析

- 分析基準：`HEAD 456381997577399e388f17918e37b251068d127b`。
- 方法：只讀 validator predicate、掛載條件、現行測試與權威文件；未執行任何 `*:browser` validator。
- 結論：**A 類 8 個、B 類 6 個、C 類 0 個、D 類 1 個**。
- 本報告不判定顏色鍵應採 `cellId` 或 `beamId`。

## 分組

### G1｜首頁把 artifact query 強制改回 live-sim（B 類，共 6 個）

**組員**

- `validate:phase-c:director-cinematic:browser`
- `validate:phase-c:artifact-satellite-compass:browser`
- `validate:phase-c:artifact-scene:real-data:browser`
- `validate:phase-d:dashboard:real-data:browser`
- `validate:phase-d:dashboard:browser`
- `validate:phase-c:artifact-fail-closed:browser`

**共同根因**

六個 validator 都把 `sceneSource=artifact-replay` 加在目前 `APP_URL`（基準是根路徑 `/`）上；但 `App` 把 `/` 視為 `isLegacyWalkerRoute`，並在 state initializer 直接選 `live-sim`，完全不呼叫 `readSceneSourceFromUrl()`（`src/App.tsx:388-404`）。因此 `resolveSceneLane()` 收到的不是 `artifact-replay`，`recordedReplayActive` 為 false，artifact fetch 不啟動，所有 artifact-only surface 都不會掛載。

這是 B 而不是 A：artifact lane resolver、loader、fail-closed、compass、dashboard 與 director controls 都仍是活程式碼；是 `/` 的條件分支使它們在 validator 情境下不掛載。`src/app/sceneLane.ts:16-22` 仍明定只要 state 真的是 `artifact-replay` 就應解析成該 lane。

各失敗點與此共因的連結：

- director、compass、scene-real、dashboard-real 都先等 `artifact-replay-sidebar[data-artifact-loaded="true"]`，但 sidebar 本身只在 `sceneLane === 'artifact-replay'` 分支（`src/App.tsx:4199-4215`）。
- dashboard-fixture 直接等 artifact branch 內的 `AlgorithmDashboard`（`src/App.tsx:4519-4547`）。
- fail-closed 要求 `artifact-scene-fail-closed`；但 `shouldRenderMainScene = !recordedReplayActive || ...`（`src/App.tsx:3751`），錯誤地留在 live lane 時前半項已為 true，故反而掛正常 `MainScene`，不會走 `src/App.tsx:4423-4431` 的 fail-closed 分支。
- compass 另有明確的 `sceneLane === 'artifact-replay' && replaySceneFrame` 掛載條件（`src/App.tsx:4433-4435`）。

**grep 證據**

```text
$ rg -n 'isLegacyWalkerRoute \? .live-sim.|recordedReplayActive|data-testid="artifact-replay-sidebar"|data-testid="artifact-scene-fail-closed"|sceneLane === .artifact-replay. && replaySceneFrame|<AlgorithmDashboard' src/App.tsx
403:    isLegacyWalkerRoute ? 'live-sim' : readSceneSourceFromUrl()
501:  const recordedReplayActive = sceneSource === 'artifact-replay' || isRecordedReplayLane;
2023:    if (!recordedReplayActive) return;
3751:  const shouldRenderMainScene = !recordedReplayActive || activeSceneFrame !== undefined;
4203:                  data-testid="artifact-replay-sidebar"
4426:              data-testid="artifact-scene-fail-closed"
4433:          {sceneLane === 'artifact-replay' && replaySceneFrame && (
4542:                <AlgorithmDashboard

$ rg -n 'return .artifact-replay.' src/app/sceneLane.ts
17:  if (input.sceneSource === 'artifact-replay') return 'artifact-replay';
```

```text
$ rg -n '\?sceneSource=artifact-replay|searchParams.set\(.sceneSource., .artifact-replay.|artifact-replay-sidebar' scripts/validate-phase-c-director-cinematic-browser.ts scripts/validate-phase-c-artifact-satellite-compass-browser.ts scripts/validate-phase-c-artifact-scene-real-data-browser.ts scripts/validate-phase-c-artifact-fail-closed-browser.ts scripts/validate-phase-d-dashboard-browser.ts scripts/validate-phase-d-dashboard-real-data-browser.ts
scripts/validate-phase-c-director-cinematic-browser.ts:60:    await page.goto(`${appUrl}/?sceneSource=artifact-replay`, { waitUntil: 'domcontentloaded' });
scripts/validate-phase-c-director-cinematic-browser.ts:67:          .querySelector('[data-testid="artifact-replay-sidebar"]')
scripts/validate-phase-c-artifact-satellite-compass-browser.ts:68:    await page.goto(`${appUrl}/?sceneSource=artifact-replay`, { waitUntil: 'domcontentloaded' });
scripts/validate-phase-c-artifact-satellite-compass-browser.ts:73:          .querySelector('[data-testid="artifact-replay-sidebar"]')
scripts/validate-phase-c-artifact-scene-real-data-browser.ts:42:    await page.goto(`${appUrl}/?sceneSource=artifact-replay`, { waitUntil: 'domcontentloaded' });
scripts/validate-phase-c-artifact-scene-real-data-browser.ts:44:      () => document.querySelector('[data-testid="artifact-replay-sidebar"]')?.getAttribute('data-artifact-loaded') === 'true',
scripts/validate-phase-c-artifact-fail-closed-browser.ts:37:    await page.goto(`${appUrl}/?sceneSource=artifact-replay`, { waitUntil: 'domcontentloaded' });
scripts/validate-phase-d-dashboard-browser.ts:38:  target.searchParams.set('sceneSource', 'artifact-replay');
scripts/validate-phase-d-dashboard-real-data-browser.ts:45:    await page.goto(`${appUrl}/?sceneSource=artifact-replay`, { waitUntil: 'domcontentloaded' });
scripts/validate-phase-d-dashboard-real-data-browser.ts:47:      () => document.querySelector('[data-testid="artifact-replay-sidebar"]')?.getAttribute('data-artifact-loaded') === 'true',
```

### G2｜live-lane 的 HandoverEventRail／DirectorControls 掛載點已刻意移除（A 類，共 3 個）

**組員**

- `validate:phase-c:director-cinematic:live:browser`
- `validate:phase-c:handover-cinema:browser`
- `validate:live-walker:handover-event-focus:browser`

**共同根因**

`App` 仍建立 `handoverEventRail`（其中含 `DirectorControls`），但全檔唯一 JSX 使用點在 `activeRightSidebarTab === 'artifact'` 分支的 `src/App.tsx:4519-4532`；live 分支從 `src/App.tsx:4549` 開始，沒有這個 mount。`docs/sinr-live-right-sidebar-restore-sdd.md:68-71,89-92` 明載 live-tab duplicate 被移除、功能等待日後重建。兩個 director validator 自己也已在檔頭標為 `QUARANTINED`，並精確寫出會得到 `0 !== 1`（各檔 `:1-7`）。

所以兩個 `director controls mount on the live lane` 是同一根因；event-focus 等的 `handover-event-rail` 正是同一個被移除的父 surface。元件仍供 artifact lane 使用，不表示 live-lane 舊路徑仍存在；此處是**情境限定的 A 類**。

**grep 證據**

```text
$ rg -n 'handoverEventRail|<DirectorControls' src/App.tsx
3612:  const handoverEventRail = (
3642:      <DirectorControls
4532:                {handoverEventRail}

$ rg -n 'QUARANTINED|removed the live-tab handoverEventRail|director controls mount on the live lane' scripts/validate-phase-c-director-cinematic-live-browser.ts scripts/validate-phase-c-handover-cinema-browser.ts
scripts/validate-phase-c-handover-cinema-browser.ts:1:// QUARANTINED 2026-06-20 — removed from the `validate:live-render` chain (package.json).
scripts/validate-phase-c-handover-cinema-browser.ts:3:// 49db65d right-sidebar restore removed the live-tab handoverEventRail (DirectorControls
scripts/validate-phase-c-handover-cinema-browser.ts:85:    assert.equal(await page.locator(DIRECTOR).count(), 1, 'director controls mount on the live lane');
scripts/validate-phase-c-director-cinematic-live-browser.ts:1:// QUARANTINED 2026-06-20 — removed from the `validate:live-render` chain (package.json).
scripts/validate-phase-c-director-cinematic-live-browser.ts:3:// right-sidebar restore removed the live-tab handoverEventRail (which carried
scripts/validate-phase-c-director-cinematic-live-browser.ts:71:    assert.equal(await page.locator(DIRECTOR).count(), 1, 'director controls mount on the live lane');

$ rg -n 'handover-event-rail' src/App.tsx src/ui/HandoverEventRail.tsx scripts/validate-live-walker-handover-event-focus-browser.ts
scripts/validate-live-walker-handover-event-focus-browser.ts:147:  await page.locator('[data-testid="handover-event-rail"]').waitFor({ timeout: 30000 });
src/ui/HandoverEventRail.tsx:376:      data-testid="handover-event-rail"
```

### G3｜首頁已停用 legacy natural-pulse carrier（A 類，共 2 個）

**組員**

- `validate:phase-c:handover-pulse:render:browser`
- `validate:phase-c:sinr-live-cells:render:browser`

**共同根因**

兩個 validator 都開根路徑 `/`，所以 `MainScene` 收到 `homepageVisualIdentity=true`（`src/App.tsx:4381`）。現行單一幾何 owner policy 在 `src/scene/MainScene.tsx:3434-3437` 明確令 `naturalPulseAvailable` 只能在非首頁為 true；首頁 steady state 的 `renderNaturalPulse` 是 false（`src/homepage/controller/homepageSceneGeometryPolicy.ts:129-137`），且測試鎖住此結果（同名 `.test.ts:19-26`）。接著 `MainScene` 在 `src/scene/MainScene.tsx:4042-4049` 直接把 `sinrLiveCellPulseConeItems` 變成空陣列。

因此：

- handover-pulse validator 的 `everRendered` 永遠維持 false，最後在 `scripts/validate-phase-c-handover-pulse-render-browser.ts:107-110` 失敗。
- sinr-live-cells validator 能先印 healthy serving frame，但之後 `:137-146` 等 `pulse > 0 && pulseRendered > 0` 必然逾時；這與背景所述「healthy frame 後再逾時 90s」完全吻合。

這不是資料沒有產生 handover 的 C 類：即使 `recentHandoverEvents` 有資料，首頁入口也會先被明確 policy 擋成空陣列。註解說首頁改由 normalized wall-clock pair 接手、避免 raw retention buffer 重播同一事件（`src/scene/MainScene.tsx:3434-3437`），故舊 natural-pulse 斷言屬 A。

**grep 證據**

```text
$ rg -n 'naturalPulseAvailable:|renderNaturalPulse|sinrLiveCellPulseConeItems|additiveHandoverPulseConeItems' src/scene/MainScene.tsx src/homepage/controller/homepageSceneGeometryPolicy.ts src/homepage/controller/homepageSceneGeometryPolicy.test.ts
src/scene/MainScene.tsx:3437:    naturalPulseAvailable: !homepageVisualIdentity && recentPrimaryHandoverEvent !== null,
src/scene/MainScene.tsx:4042:  const sinrLiveCellPulseConeItems = useMemo(
src/scene/MainScene.tsx:4048:        || (homepageVisualIdentity && !homepageSceneGeometryPolicy.renderNaturalPulse)
src/scene/MainScene.tsx:4488:  const additiveHandoverPulseConeItems = useMemo(
src/scene/MainScene.tsx:5597:      {presentationPlan.visible['event-effects'] && additiveHandoverPulseConeItems.length > 0 && (
src/homepage/controller/homepageSceneGeometryPolicy.ts:133:    renderNaturalPulse: false,
src/homepage/controller/homepageSceneGeometryPolicy.test.ts:24:  assert.equal(policy.renderNaturalPulse, false);
```

### G4｜文案／公開導覽契約已換代，validator 仍釘舊值（A 類，共 3 個）

**組員與根因**

1. `validate:golden-flow:browser`：validator 在 `scripts/validate-golden-flow-browser.ts:716` 仍要求 `所需功率 P′`；現行 component 在 `src/prototype/golden-flow/GoldenFlowPrototype.tsx:399` 顯示 `理想補償功率需求 P′`。更強的刻意性證據是 presentation regression test 已要求 `理想補償功率需求` 並拒絕舊式 `所需功率上升` 說法（`src/prototype/golden-flow/goldenFlowPresentationRegression.test.ts:139,146-147`）。A。
2. `validate:homepage:multi-candidate:browser`：`scripts/validate-homepage-multi-candidate-acceptance-browser.ts:468-485` 以未限定容器的 `[data-testid="director-intra-focus"]` 取第一個按鈕，再硬釘 `Next Intra`。首頁公開 top control 的同 testid 現在顯示 `Intra Handover`（`src/ui/SinrLiveQuickControls.tsx:167-186`）；舊 `Next Intra` 只留在 G2 所述 artifact rail 的 `DirectorControls`（`src/ui/DirectorControls.tsx:51,75-90`），不在首頁 live path。A。
3. `validate:contact-window-labs:browser`：validator `scripts/validate-canonical-experiments-browser.ts:22-29` 要 stage nav 有 6 個 act link；現行 nav 只 map `SIX_ACTS_VISIBLE_ROUTES`（`src/course/nav/SixActsNav.tsx:51-68`），Act 5/6 皆設 `hiddenFromNavigation: true`（`src/course/nav/sixActsRoutes.ts:76-97`），且現行測試明確鎖成只發布 Acts 1–4（`src/course/nav/sixActsRoutes.test.ts:138-141`）。A。

**grep 證據**

```text
$ rg -n '所需功率 P′|理想補償功率需求 P′|doesNotMatch.*所需功率' scripts/validate-golden-flow-browser.ts src/prototype/golden-flow/GoldenFlowPrototype.tsx src/prototype/golden-flow/goldenFlowPresentationRegression.test.ts
scripts/validate-golden-flow-browser.ts:716:        assert.match(await page.getByTestId('golden-flow-angle-power-ee').innerText(), /方向圖 F\(θ\).*增益變化 ΔGᵀ.*所需功率 P′.*相對 EE/s);
src/prototype/golden-flow/GoldenFlowPrototype.tsx:399:          <span>理想補償功率需求 P′</span>
src/prototype/golden-flow/goldenFlowPresentationRegression.test.ts:147:assert.doesNotMatch(prototypeSource, /提高所需功率|功率需求越高|觀察功率與 EE|所需功率上升/);

$ rg -n 'current Next button copy|Next Intra|Intra Handover|director-intra-focus' scripts/validate-homepage-multi-candidate-acceptance-browser.ts src/ui/DirectorControls.tsx src/ui/SinrLiveQuickControls.tsx
src/ui/SinrLiveQuickControls.tsx:172:            data-testid="director-intra-focus"
src/ui/SinrLiveQuickControls.tsx:185:            Intra Handover{nextIntraMode === 'real-trigger' ? ' · trigger' : ''}{typeof nextIntraCount === 'number' ? ` · ${nextIntraCount}` : ''}
src/ui/DirectorControls.tsx:51:  const intraNextLabel = nextIntraMode === 'real-trigger' ? 'Next Intra · trigger' : 'Next Intra';
scripts/validate-homepage-multi-candidate-acceptance-browser.ts:485:  assert.match(buttonCountLabel ?? '', new RegExp(`Next ${kind === 'intra' ? 'Intra' : 'Inter'}`), `${kind}: current Next button copy is missing`);

$ rg -n 'count\(\), 6|SIX_ACTS_VISIBLE_ROUTES.map|hiddenFromNavigation: true|releases only Acts 1–4' scripts/validate-canonical-experiments-browser.ts src/course/nav/SixActsNav.tsx src/course/nav/sixActsRoutes.ts src/course/nav/sixActsRoutes.test.ts
scripts/validate-canonical-experiments-browser.ts:24:  assert.equal(await nav.locator('.six-acts-nav__acts a').count(), 6);
src/course/nav/SixActsNav.tsx:52:        {SIX_ACTS_VISIBLE_ROUTES.map(entry => {
src/course/nav/sixActsRoutes.ts:85:    hiddenFromNavigation: true,
src/course/nav/sixActsRoutes.ts:96:    hiddenFromNavigation: true,
src/course/nav/sixActsRoutes.test.ts:138:test('the registry preserves six direct routes but releases only Acts 1–4', () => {
```

### G5｜`assertSharedWalkerSnapshot` 的失敗子句不可由現有摘要唯一定位（D 類，共 1 個）

**組員**

- `validate:homepage:authority:browser`

**根因邊界**

`assertSharedWalkerSnapshot` 內有兩個連續的 30 秒 `waitForFunction`：第一個只等 primary callout 存在（`scripts/validate-homepage-authority-browser.ts:221-226`）；第二個是由節點存在、四層 snapshot/source-frame/phase 相等、active-link count、candidate-scene receipt、serving identity、四個 finite metric 欄位等組成的複合 predicate（`:227-269`）。背景只保留「卡在 assertSharedWalkerSnapshot」而沒有 stack 的精確行號或 timeout 當下 DOM dump，無法知道是第一個 wait，還是第二個 wait 的哪一個 conjunct。

source 也不足以把它降成 A：`beam-callout[data-beam-primary="1"]` 的活路徑仍存在於 `src/viz/SinrLiveCellBeamCallouts.tsx:124-179`；掛載受 `showBeamCallouts/homepageHandoverBeamInfoActive`、`teachingLectureKind == null`、`beamInfoItems.length > 0` 控制（`src/scene/MainScene.tsx:5567-5591`）。這些全依 runtime frame/identity 而定。沒有失敗快照便無法在 B、C 間可靠選擇，故列 D。

**grep 證據**

```text
$ rg -n 'assertSharedWalkerSnapshot|beam-callout.*data-beam-primary|multiCandidateSceneRenderStatus|angleAwareFrameSinrDb|metricFields.every' scripts/validate-homepage-authority-browser.ts
221:async function assertSharedWalkerSnapshot(page: Page): Promise<SharedHomepageSnapshot> {
223:    () => document.querySelector('[data-testid="beam-callout"][data-beam-primary="1"]') !== null,
231:    const center = document.querySelector<HTMLElement>('[data-testid="beam-callout"][data-beam-primary="1"]');
256:      && (canvas.dataset.multiCandidateSceneRenderStatus !== 'active'
262:      && center.dataset.angleAwareFrameSinrDb !== ''
266:      && metricFields.every(field => (

$ rg -n 'data-testid="beam-callout"|data-beam-primary|measuredItems.length === 0|showBeamCallouts \|\| homepageHandoverBeamInfoActive|runtime.teachingLectureKind|beamInfoItems.length' src/viz/SinrLiveCellBeamCallouts.tsx src/scene/MainScene.tsx
src/viz/SinrLiveCellBeamCallouts.tsx:124:  if (measuredItems.length === 0) return null;
src/viz/SinrLiveCellBeamCallouts.tsx:173:              data-testid="beam-callout"
src/viz/SinrLiveCellBeamCallouts.tsx:179:              data-beam-primary={isPrimary ? '1' : '0'}
src/scene/MainScene.tsx:5567:      {(showBeamCallouts || homepageHandoverBeamInfoActive)
src/scene/MainScene.tsx:5568:        && runtime.teachingLectureKind == null
src/scene/MainScene.tsx:5569:        && beamInfoItems.length > 0 && (
```

## 逐個歸因

| # | validator | 類別 | 直接證據與判定 |
|---:|---|:---:|---|
| 1 | `validate:golden-flow:browser` | A | validator `scripts/validate-golden-flow-browser.ts:716` 釘舊詞；現行文字在 `GoldenFlowPrototype.tsx:399`，現行 regression test 也鎖新術語。 |
| 2 | `validate:homepage:authority:browser` | D | `assertSharedWalkerSnapshot` 有兩個 30s wait，第二個又有多個 conjunct；缺精確 timeout 行與失敗 DOM/dataset。 |
| 3 | `validate:homepage:multi-candidate:browser` | A | `:485` 要 `Next Intra`；首頁同 testid 的公開按鈕在 `SinrLiveQuickControls.tsx:185` 已是 `Intra Handover`。 |
| 4 | `validate:contact-window-labs:browser` | A | `:24` 要 6 links；nav 只 map visible routes，Act 5/6 明確 hidden，現行單測鎖 1–4。 |
| 5 | `validate:phase-c:director-cinematic:browser` | B | `:60-70` 從根路徑要求 artifact sidebar loaded；`App.tsx:393-404` 在 `/` 忽略 query，故 loader 不啟動。 |
| 6 | `validate:phase-c:director-cinematic:live:browser` | A | script `:1-7` 已自述 quarantine；live-tab 的 `handoverEventRail` mount 被移除，故 `:71` 得 0。 |
| 7 | `validate:phase-c:handover-cinema:browser` | A | 與上一項完全相同；script `:1-7,85` 自述同一個 live mount removal。 |
| 8 | `validate:phase-c:handover-pulse:render:browser` | A | root homepage policy 令 natural pulse items 為空；故 `:108` 的 `everRendered` 不可能為 true。 |
| 9 | `validate:phase-c:sinr-live-cells:render:browser` | A | healthy frame 只證明 serving cones；後續 `:137-146` 等的是同一個被首頁 policy 停用的 natural pulse。 |
| 10 | `validate:phase-c:artifact-satellite-compass:browser` | B | `:68-76` 等 artifact sidebar；root query 被強制改成 live，連 `App.tsx:4433-4435` 的 compass gate 都到不了。 |
| 11 | `validate:phase-c:artifact-scene:real-data:browser` | B | `:42-47` 的第一個 predicate 就等 artifact loaded；同 G1。 |
| 12 | `validate:live-walker:handover-event-focus:browser` | A | `:144-148` 等 live rail；該 rail 唯一 App mount 在 artifact right-tab。 |
| 13 | `validate:phase-d:dashboard:browser` | B | `:36-43` 對根 URL 加 artifact query後等 metrics；query 被 root initializer 忽略，artifact dashboard branch 不掛載。 |
| 14 | `validate:phase-d:dashboard:real-data:browser` | B | `:45-50` 同 G1，停在 artifact sidebar loaded 之前，尚未進到資料 provenance 判斷。 |
| 15 | `validate:phase-c:artifact-fail-closed:browser` | B | `:37-40` 雖 mock 404，但 root 沒進 artifact state、也不發該 fetch；`shouldRenderMainScene` 留 true，fail-closed surface 不掛載。 |

## D 類需要什麼

### `validate:homepage:authority:browser`

至少需要以下兩項，第一項用來定位 wait，第二項用來定位 predicate 子句：

1. 完整錯誤 stack（須保留 `scripts/validate-homepage-authority-browser.ts:222` 或 `:227/:269` 的精確行號）。
2. timeout 當下的一次原子 DOM dump：
   - `[data-testid="homepage-beam-rail"]`、`[data-homepage-rail-snapshot-id]`、`[data-testid="leo-main-scene"]`、其 `canvas`、primary `beam-callout`、serving `homepage-beam-row` 是否存在；
   - 上述節點的完整 `dataset`；
   - serving row 四個 `[data-testid^="homepage-beam-metric-"]` 的文字；
   - 所有 `beam-callout` 的 `satellite/beam/cell/primary` identity，以及 canvas 的 `sinrLiveCellBeamCalloutRenderedCount`。

若 timeout 在第一個 wait，這份資料可區分 mount gate（callout layer 未掛）、`measuredItems.length===0`，或只有 primary identity join 未命中；若在第二個 wait，逐項比較 dump 即可指出是 snapshot join、active-link count、candidate receipt、serving identity或 metric 欄位哪一項未滿足。僅有目前的通用 timeout 無法可靠判定。

## 我查證後發現上面背景敘述有誤的地方

無。
