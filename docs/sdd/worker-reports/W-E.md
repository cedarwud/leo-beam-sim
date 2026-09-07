# W-E：前端原始碼文字 pin 清理報告

## 我改了哪些檔案

本輪共刪除 19 個 assert/check 呼叫、21 個字面 pin：其中 20 個是目標字面在被斷言檔案出現超過 1 次的可證明假綠；另 1 個是已紅的 0 次字面，因與假綠 pin 位於同一個不可分割的 `check(...)` 呼叫而一併移除。所有出現次數都是本輪直接讀取目標檔案後，以完整字面逐一計數所得。

- `scripts/validate-phase-e-sat-count-override.tsx`：刪除 4 個 `check(...)`、6 個字面 pin。
  - 原 L128／現註解 L127：`applySceneTopology(trainingProfile, activeSceneTopology)`，`src/App.tsx` 0 次；`applyTrainingEnvAxesToProfile`，2 次。兩者在同一個 `check(...)`，因後者無法定位標籤所稱的特定 wiring，整段刪除。
  - 原 L132／現註解 L128：`getSceneTopologyResetKey(`，2 次。
  - 原 L134／現註解 L130：`appMode={appMode}`，7 次。
  - 原 L136–137／現註解 L131：`liveSceneTopologyControlsEnabled`，3 次；`sceneLane === 'modqn-live-cell-preview'`，12 次。
- `scripts/validate-phase-f-ue-distribution-mode.tsx`：刪除 1 個 `check(...)`、1 個字面 pin。
  - 原／現 L246：`buildAppRuntimeConfig`，`src/App.tsx` 3 次。
- `scripts/validate-phase-g-ue-mobility-step.tsx`：刪除 1 個 `check(...)`、1 個字面 pin。
  - 原／現 L258：`buildAppRuntimeConfig`，`src/App.tsx` 3 次。
- `scripts/validate-phase-h-s5-orbit-trail-modqn-demo.ts`：刪除 4 個 `expect(...)`、4 個字面 pin。
  - 原 L61／現註解 L60：`showOrbitTrail`，`src/scene/MainScene.tsx` 2 次。
  - 原 L65／現註解 L61：`showSpineParticles`，2 次。
  - 原 L69／現註解 L62：`effectsEnabled: runtime.effectsEnabled`，2 次。
  - 原 L74／現註解 L63：`effectsEnabled: runtime.effectsEnabled`，2 次。
- `scripts/validate-phase-h-s8-hud-camera-default.ts`：刪除 4 個 `expect(...)`、4 個字面 pin。
  - 原 L26／現註解 L25：`modqnDemoCameraAppliedRef`，`src/App.tsx` 4 次。
  - 原 L82／現註解 L78：`sceneSource={sceneSource}`，2 次。
  - 原 L86／現註解 L79：`bundleProvenanceKind={bundleProvenanceKind}`，5 次。
  - 原 L90／現註解 L80：`simState={simState}`，2 次。
- `scripts/validate-phase8b-path-loss-controls.tsx`：刪除 2 個 `assertContains(...)`、2 個字面 pin。
  - 原／現 L641：`setStaleFormulaEvidenceKey(getSignalTuningEvidenceKey(next))`，`src/App.tsx` 2 次。
  - 原／現 L642：`isFormulaEvidenceStale={staleFormulaEvidenceKey !== null}`，4 次。
- `scripts/validate-phase9b-power-noise-separation.tsx`：刪除 2 個 `assertContains(...)`、2 個字面 pin。
  - 原／現 L280：`setStaleFormulaEvidenceKey(getSignalTuningEvidenceKey(next))`，`src/App.tsx` 2 次。
  - 原／現 L281：`isFormulaEvidenceStale={staleFormulaEvidenceKey !== null}`，4 次。
- `scripts/validate-modqn-phase7k-replay-scene-layer.ts`：刪除 1 個 `assertContains(...)`、1 個字面 pin。
  - 原／現 L424：`createOmegaRescalarizedModqnReplayPlaybackDisplayState`，`src/App.tsx` 2 次。
- `docs/sdd/worker-reports/W-E.md`：新增本報告。

## 我沒動但有問題的

- `scripts/validate-phase-h-s8-hud-camera-default.ts` 原 L38 的同一個 `expect(...)` 同時包含：
  - `appMode !== 'modqn-demo'`：`src/App.tsx` 5 次，符合動作 A 的刪除條件。
  - `modqnDemoCameraAppliedRef.current = false`：1 次，明列為不准動。
  - 「整個 assert 呼叫刪掉」與「1 次 pin 不准動」無法同時成立；本輪沒有拆寫、re-pin 或刪除此呼叫。需 owner 決定原子處置。
- `scripts/validate-phase-e-sat-count-override.tsx` 原 L128 的 `applySceneTopology(trainingProfile, activeSceneTopology)` 已是 0 次，但它宣稱的拓撲層疊仍存在：`src/App.tsx` L758–770 先套 signal、training，再以新增的 `applyLegacyConstellationPreset(...)` 巢狀呼叫套 topology。該 0 次 pin 因與 2 次假綠 pin 共用 `check(...)` 而一併刪除；owner 應以行為測試承接，不可 re-pin 新字面。
- `scripts/validate-phase6b-handover-policy-controls.tsx` 原 L149–150 的兩條負向 pin 仍紅，且被禁止的事實目前確實在 `src/`：`src/App.tsx` L4317 有 `handoverPolicySection={`，`<HandoverPolicyControls` 在 L4266、L4318 共 2 次。需 owner 決定目前 placement 是否為權威；若不符，需改 `src/`，本輪未動。
- `scripts/validate-modqn-phase7k-replay-scene-layer.ts` 原 L486、L498 的兩條 0 次 pin 所守行為仍在，只是寫法已變：
  - marker lane gate 位於 `src/scene/sceneLaneRenderPlan.ts` L210–213；渲染端改為 `src/scene/MainScene.tsx` L5214 的 `showLiveSatelliteMarkers && renderedLiveSatelliteMarkers.map(...)`，而 `renderedLiveSatelliteMarkers` 仍由 `viz.displaySats` 建立。
  - beam lane gate 位於 `src/scene/sceneLaneRenderPlan.ts` L194–204；渲染端在 `src/scene/MainScene.tsx` L5333–5437 等處加入額外條件後仍以 `showSinrLiveCellBeams` 掛載 `SinrLiveCellBeamCones`。
  - 依規則 7 未改字面，兩條留給 owner 轉成行為／模組測試。
- `scripts/validate-phase-h-s5-orbit-trail-modqn-demo.ts` 修改後由 0 變 1：刪除 4 個無效 pin 後 `PASSED.length` 從 20 降為 16，檔尾未列入 pin 清單的 `assert.ok(PASSED.length >= 17, ...)` 因而紅。調整數字會是為變綠而改 assertion literal，刪除此 ratchet 又超出動作 A/B，因此本輪未動，需 owner 明確處置。
- 其餘修改前即紅、且不屬本工作單可改 pin 的問題：
  - phase F：14 個 `TopologyTab` testid／SSR 預期失敗。
  - phase G：4 個 runtime/mobility 預期失敗，其中一個是 `spawnSync git EPERM`。
  - phase 8B：`NLoS clutter delta must enter pathLossDb: expected 10, got 0`。
  - MODQN phase 5A：`src/App.tsx added a beam-count control surface`。
  - MODQN phase 6P：`APP_EPOCH_MS` harness 假設與 baseline fixture 漂移。
- 本輪沒有發現必須修改 `package.json` 才能完成動作 A/B 的項目，也沒有修改 `package.json` 或任何 `src/**`。

## 驗證

未執行任何 `*:browser` validator，也未做 mutation 測試。修改前 log 在 `/tmp/we-baseline.WjLVJw`，修改後 log 在 `/tmp/we-after.FtmuXR`。

| 實際指令 | 修改前 exit code | 修改後 exit code |
|---|---:|---:|
| `npm run validate:phase-e:sat-count-override` | 1 | 0 |
| `npm run validate:phase-f:ue-distribution-mode` | 1 | 1 |
| `npm run validate:phase-g:ue-mobility-step` | 1 | 1 |
| `npm run validate:phase-h:s4-beam-hopping-toggle` | 0 | 0 |
| `npm run validate:phase-h:s5-orbit-trail-modqn-demo` | 0 | 1 |
| `npm run validate:phase-h:s8-hud-camera-default` | 0 | 0 |
| `npm run validate:phase-i:s6-hud-preview-banner` | 0 | 0 |
| `npm run validate:phase-i:s6-hud-cell-schedule-truth` | 0 | 0 |
| `npm run validate:phase6b:handover-policy-controls` | 1 | 1 |
| `npm run validate:phase6c:handover-policy-placement` | 1 | 1 |
| `npm run validate:phase8b:path-loss-controls` | 1 | 1 |
| `npm run validate:phase9b:power-noise-separation` | 0 | 0 |
| `npm run validate:modqn:phase5a-runtime-beam-layout` | 1 | 1 |
| `npm run validate:modqn:phase6p-hobs-sinr-kpi-baseline` | 1 | 1 |
| `npm run validate:modqn:phase7k-replay-scene-layer` | 1 | 1 |

計數時另實際嘗試：

```text
node --import tsx/esm scripts/audit/count-source-pins.ts src/App.tsx
node --import tsx/esm scripts/audit/count-source-pins.ts src/scene/MainScene.tsx
```

兩條命令都在工具內部呼叫 `execSync(...)` 時遭 sandbox 拒絕（`spawnSync /bin/sh EPERM`），因此沒有把工具的失敗當作計數結果；改以 Node 直接讀取兩個目標檔案，對本工作單每個完整字面執行 `source.split(literal).length - 1`，結果列於第一節。

## 我數到和給定數字不符的

字面出現次數：無。

處置總數與「可刪 21 條」預估不同：實際刪除 20 條可證明假綠；第 21 條 `appMode !== 'modqn-demo'` 因與一條明列不准動的單次 pin 共用同一個 `expect(...)`，依不可協商規則保留。另有 1 條 0 次已紅 pin 因與假綠 pin 共用同一個 `check(...)` 而隨整段刪除，所以實際移除的字面 pin 總數仍為 21。
