# W-B 前端治理文字 pin 清理報告

## 我改了哪些檔案

### `scripts/validate-frontend-scene-lane-governance.ts`

刪除 27 條可證明假綠的 `assertContains`。下表的次數均由我在本輪實際執行 AST 量測工具所得；「改後行」是原 assert 所在位置留下之英文說明註解行。

| 改前行 | 改後行 | 被刪字面 | 目標檔案 | 實測出現次數 |
|---:|---:|---|---|---:|
| 645 | 645 | `sceneLane={sceneLane}` | `src/App.tsx` | 2 |
| 646 | 646 | `sceneLane={sceneLane}` | `src/App.tsx` | 2 |
| 669 | 669 | `LIVE_SIM_TIMELINE_DURATION_SEC` | `src/App.tsx` | 6 |
| 674 | 674 | `data-scene-lane={sceneLane}` | `src/App.tsx` | 3 |
| 1388 | 1388 | `handoverMode === 'decision-overlay-on-live-sinr'` | `src/App.tsx` | 2 |
| 1389 | 1389 | `setModqnReplayProofRequested(false)` | `src/App.tsx` | 2 |
| 1412 | 1412 | `sceneLane === 'modqn-live-cell-preview' && (` | `src/App.tsx` | 2 |
| 1650 | 1646 | `resolveSceneLaneRenderPlan({` | `src/scene/MainScene.tsx` | 2 |
| 1821 | 1813 | `sim.sinrLiveCells` | `src/scene/MainScene.tsx` | 48 |
| 1929 | 1917 | `beamDisplaySpec.showNonServingCones ? null : sinrLiveTargetSatIds` | `src/scene/MainScene.tsx` | 2 |
| 2131 | 2115 | `resolveSceneLaneUeMarkerShape(sceneLane)` | `src/scene/MainScene.tsx` | 3 |
| 2153 | 2133 | `deriveProfileHandoverStoryModel` | `src/scene/MainScene.tsx` | 2 |
| 2197 | 2173 | `showModqnServiceAllocation && modqnVisualLayers.serviceMap` | `src/scene/MainScene.tsx` | 4 |
| 2237 | 2209 | `slotSec: CELL_SCHEDULE_VIZ_SLOT_SEC` | `src/scene/MainScene.tsx` | 2 |
| 2277 | 2245 | `selectProfileDerivedHandoverCues` | `src/scene/MainScene.tsx` | 2 |
| 2307 | 2271 | `resolveCellBeamConeSatelliteCount` | `src/scene/MainScene.tsx` | 2 |
| 2343 | 2303 | `<BeamLoadCylinder` | `src/scene/MainScene.tsx` | 2 |
| 2423 | 2379 | `resolveCellBeamConeItems` | `src/scene/MainScene.tsx` | 2 |
| 2438 | 2390 | `&& modqnVisualLayers.handoverStory` | `src/scene/MainScene.tsx` | 4 |
| 2468 | 2416 | `focusedUe={focusedCellBeamConeUe}` | `src/scene/MainScene.tsx` | 2 |
| 2473 | 2417 | `paused={paused}` | `src/scene/MainScene.tsx` | 4 |
| 2478 | 2418 | `reducedMotion={runtime.reducedMotion}` | `src/scene/MainScene.tsx` | 5 |
| 2744 | 2680 | `replayBackedHandoverStoryVisible` | `src/scene/MainScene.tsx` | 3 |
| 2883 | 2815 | `<MultiCandidateBeamScene` | `src/scene/MainScene.tsx` | 2 |
| 3313 | 3241 | `appMode={appMode}` | `src/App.tsx` | 7 |
| 3318 | 3242 | `handoverMode={handoverMode}` | `src/App.tsx` | 3 |
| 3323 | 3243 | `modqnVisualLayerPreset={modqnVisualLayerPreset}` | `src/App.tsx` | 2 |

### `docs/sdd/worker-reports/W-B.md`

新建本報告；此檔未刪除 pin。

## 我沒動但有問題的

五條今天已紅的正向 pin 所宣稱守護的事實仍存在於 `src/`，因此依規則 7 全部保留原字面、沒有 re-pin，也沒有刪除：

| validator 現行行（改前行） | 已紅字面 | `src/` 查證結果 | 需 owner 決定 |
|---:|---|---|---|
| 668（668） | `liveTimelineWindowStartSec + target` | `src/AppWalkerSandbox.tsx:1887-1893` 仍以 `Math.min(liveTimelineWindowStartSec + target, LIVE_SIM_TIMELINE_DURATION_SEC)` 形成並送出 absolute seek target。查證指令：`rg -n -C 8 "absoluteTargetSec\|liveTimelineWindowStartSec" src --glob '*.{ts,tsx}'`。 | 原 pin 只讀 `src/App.tsx`，但能力已在 sandbox；應由 owner 決定行為測試或去檔名化守門方式。 |
| 685（685） | `homepageCanonicalAnalysis.selectTimelineTimeSec?.(target);` | `src/AppWalkerSandbox.tsx:1851-1861` 仍在 archived-TLE homepage seek 分支以該 selector 選取 published anchor；selector 實作位於 `src/ui/signal-tuning/useHomepageCanonicalAnalysis.ts:1113-1121`。查證指令：`rg -n -C 8 "selectTimelineTimeSec" src --glob '*.{ts,tsx}'`。 | 原 pin 只讀 `src/App.tsx`；應由 owner 決定以行為測試守住 anchor selection。 |
| 2763（2831） | `&& showLiveSceneEffects ... <HandoverLinks` | `src/scene/MainScene.tsx:5165-5182` 仍掛載 `HandoverLinks`，但中間新增 `!multiCandidateCentralOverlayActive` 與 `!candidateComparisonSceneActive` 條件，所以舊連續字面為 0 次。查證指令：`rg -n -C 8 "HandoverLinks" src/scene/MainScene.tsx`。 | 事實仍在但守門語意可能已改；owner 應決定可接受的行為／結構驗證，不可只改字面讓它轉綠。 |
| 2809（2877） | `&& showHandoverToastOverlay\n        && (` | `src/scene/MainScene.tsx:5701-5712` 仍掛載 `HandoverToastOverlay`，但中間新增 `!homepageVisualIdentity` 及事件條件。查證指令：`rg -n -C 8 "showHandoverToastOverlay\|HandoverToastOverlay" src/scene/MainScene.tsx`。 | 事實仍在但條件形狀已改；交由 owner 決定行為驗證。 |
| 2831（2903） | `{presentationPlan.visible['candidate-footprints'] && showSinrLiveCellBeams && sinrLiveCandidateBeamConeItems.length > 0` | `src/scene/MainScene.tsx:5544-5552` 仍以 `candidate-footprints`、`showSinrLiveCellBeams` 與非空 candidate items 掛載 footprint rings，但新增 `!multiCandidateSceneVisualActive` 且已換行。查證指令：`rg -n -C 8 "candidate-footprints\|sinrLiveCandidateBeamConeItems" src/scene/MainScene.tsx`。 | 事實仍在但舊連續字面失效；交由 owner 決定行為／結構驗證。 |

本工作單不需要修改 `package.json`；既有 npm key 已存在。若 owner 決定新增行為 validator 或 npm key，該變更超出 W-B 授權範圍。本輪亦未修改任何 `src/**`。

## 驗證

### 次數量測

實際執行：

```sh
node --import tsx/esm scripts/audit/count-source-pins.ts src/App.tsx
node --import tsx/esm scripts/audit/count-source-pins.ts src/scene/MainScene.tsx
```

量測結果中，本工作單 27 條候選的出現次數皆與上表一致，且皆大於 1。

### Validator 改動前／後

實際執行指令（改前、改後各一次）：

```sh
npm run validate:frontend:scene-lane-governance
```

| validator | 改前 exit code | 改後 exit code | 結果 |
|---|---:|---:|---|
| `validate:frontend:scene-lane-governance` | 1 | 1 | 兩次皆停在保留的 L668：`App converts bottom timeline elapsed seek to absolute Walker time missing liveTimelineWindowStartSec + target`。依規則 7 未改字面；對應能力仍存在於 `src/AppWalkerSandbox.tsx:1887-1893`。 |

未執行任何 `*:browser` validator，也未做 mutation 測試。

## 我數到和給定數字不符的

無。
