# W-C 前端文字 pin 清理報告

## 我改了哪些檔案

計數先嘗試執行工作單指定的 `node --import tsx/esm scripts/audit/count-source-pins.ts <target>`；該工具在目前 sandbox 內呼叫 `spawnSync /bin/sh` 時收到 `EPERM`。因此改用同一份 TypeScript AST 判定邏輯、將六個 validator 路徑明列後，仍以 `targetSource.split(literal).length - 1` 逐條重算。下列數字均是本輪實測，不是照抄工作單。

### `scripts/validate-timeline-scrubbing.tsx`

刪除 2 個字面 pin（2 個完整 `assertContains` 呼叫）：

- 原 L150／現 L150：`LIVE_SIM_TIMELINE_DURATION_SEC`，在 `src/App.tsx` 出現 **6** 次。
- 原 L152／現 L152：`setLiveObservedHandoverRailEvents([]);`，在 `src/App.tsx` 出現 **4** 次。

### `scripts/validate-modqn-handover-story-layer.ts`

刪除 4 個字面 pin（4 個完整 `assertContains` 呼叫）：

- 原 L549／現 L549：`deriveProfileHandoverStoryModel`，在 `src/scene/MainScene.tsx` 出現 **2** 次。
- 原 L557／現 L557：`selectProfileDerivedHandoverCues`，在 `src/scene/MainScene.tsx` 出現 **2** 次。
- 原 L561／現 L561：`resolveCellBeamConeSatelliteCount`，在 `src/scene/MainScene.tsx` 出現 **2** 次。
- 原 L572／現 L572：`replayBackedHandoverStoryVisible`，在 `src/scene/MainScene.tsx` 出現 **3** 次。

### `scripts/validate-modqn-omega-s1-sidebar-truth-up.tsx`

刪除 1 個已失效 pin（1 個完整 `assert.equal` 呼叫）：

- 原 L133／現 L132：`useModqnDemoStub`，在 `src/App.tsx` 出現 **0** 次。以 `rg` 掃描 `src/` 的 import／require 後為 **0** 個引用；唯一同名字樣只在 `src/ui/ModqnObjectiveTab.tsx` 的歷史說明註解，不是被守護的 import。

### `scripts/validate-modqn-omega-s2-runtime-fetch.tsx`

刪除 4 個字面 pin（4 個完整 assert 呼叫）：

- 原 L84／現 L83：`fetchModqnReplayBundleEnvelope`，在 `src/App.tsx` 出現 **4** 次。
- 原 L90／現 L86：`getModqnReplayPlaybackFallbackShellModel`，在 `src/App.tsx` 出現 **2** 次。
- 原 L105／現 L98：`data-testid="modqn-bundle-fetch-banner"`，在 `src/App.tsx` 出現 **0** 次，且以固定字串掃描 `src/` 也是 **0** 次。
- 原 L110／現 L99：`leo-modqn-bundle-fetch-banner`，在 `src/App.tsx` 出現 **0** 次，且以固定字串掃描 `src/` 也是 **0** 次。

### `scripts/validate-modqn-omega-s3-replay-mode-wiring.tsx`

刪除 8 個授權字面 pin：其中 2 個是完整的獨立 assert 呼叫，另 6 個位於 5 個複合 assert 中，只刪除對應的 `includes(...)` 子句。後者保留了工作單明列「不准動」的唯一／負向 pin、原 assert 與原訊息，沒有新增斷言、搬移字面或 re-pin。

- 原 L270／現 L269：`return null;`，在 `src/App.tsx` 出現 **11** 次。
- 原 L319／現 L319：`<LaneExperienceBar value={sceneLane} onChange={handleExperienceChange} />`，在 `src/App.tsx` 出現 **0** 次；`rg '<LaneExperienceBar' src` 亦為 **0** 個 JSX 掛載。`src/App.tsx:3528-3532` 明載 SINR launch surface 刻意不掛 public switch。
- 原 L399／現 L396：`readInitialRuntimeState`，在 `src/App.tsx` 出現 **2** 次。
- 原 L411／現 L409：`getLeftSidebarTabsForSceneLane`，在 `src/App.tsx` 出現 **2** 次。
- 原 L422／現 L420：`getRightSidebarTabsForSceneLane`，在 `src/App.tsx` 出現 **2** 次。
- 原 L434／現 L432：`handoverMode={handoverMode}`，在 `src/App.tsx` 出現 **3** 次。
- 原 L439／現 L433：`appMode,`，在 `src/App.tsx` 出現 **13** 次。
- 原 L440／現 L433：`sceneSource,`，在 `src/App.tsx` 出現 **17** 次。

### `scripts/validate-modqn-omega-s4-heuristic-not-paper.tsx`

刪除 **0** 條。唯一紅 pin 所守護的事實仍在，依規則 7 留給 owner，沒有改字面。

### `docs/sdd/worker-reports/W-C.md`

新增本報告；不計入 validator pin 刪除數。

合計：刪除 **19 個授權 pin**（15 個可證明假綠、4 個已不存在的舊入口）。

## 我沒動但有問題的

### 紅，但事實仍在；需 owner 決定替代 guard

- `validate-timeline-scrubbing.tsx` 原 L148：`replayController?.seek(target);` 已改寫為 `replayController?.seek(transportTarget);`，事實仍在 `src/App.tsx:2621-2624`。
- 同檔原 L149：live seek 的絕對時間映射仍在 `src/App.tsx:2645-2652`，現為 `liveTimelineWindowStartSec + transportTarget` 並加上 horizon clamp。
- 同檔原 L155-L157：source owner、horizon kind、claim kind 三個 dataset 仍在 `src/App.tsx:3975-3977`，來源改為 `activeTimelineDescriptor`。
- `validate-modqn-handover-story-layer.ts` 原 L508：`TimelineBar` 仍收到 source horizon，現為 `horizonSec={activeTimelineDescriptor.horizonSec}`（`src/App.tsx:3682-3686`）。
- 同檔原 L512：live seek 絕對時間映射仍在 `src/App.tsx:2645-2652`，只是加入 clamp 並將局部目標改名為 `transportTarget`。
- 同檔原 L550：handover story render gate 仍在 `src/scene/MainScene.tsx:5116-5120`，現在另外受 `presentationPlan.visible['event-effects']` 約束。
- 同檔原 L554：mosaic 優先、service fallback 的 marker color 邏輯仍在 `src/scene/MainScene.tsx:5079-5083`，外層新增 other-handover／homepage identity 優先序。
- 同檔原 L559：cell overlay 與 beam-cone preset 的 render gate 仍在 `src/scene/MainScene.tsx:5129-5136`，現在另外受 serving-beams presentation plan 約束。
- `validate-modqn-omega-s3-replay-mode-wiring.tsx` 原 L266，以及 `validate-modqn-omega-s4-heuristic-not-paper.tsx` 原 L218：兩者守護的 `data-handover-criterion` 二路分支仍在 `src/App.tsx:4347-4353`，但已因 archived-TLE 第三分支而改成多行巢狀條件。兩個 validator 都不得 re-pin，故維持紅色。

### 清單外或需 `package.json`／`src/` 的問題

- `package.json` 沒有 S1、S2、S3 三支 validator 的 npm key；本輪無權修改，只能用其直接 Node 入口驗證。
- `validate-modqn-handover-story-layer.ts` 在抵達本工作單 MainScene pin 前，先因 `It does not export a 2-hour Walker handover timeline.` 的既有文字 pin 失敗；此 pin 不在 W-C 清單，未動。
- S2 validator 在執行 producer export 時，checkpoint 的 `net.0.weight` 為 `[100, 140]`、現行 model 為 `[100, 112]`，因此在進入本檔靜態 pin 前就失敗；修正涉及清單外 producer／fixture 決策，未動。
- S3 validator 另有 `useSimulation.ts mode/handover reset returns to replay start...` 既有失敗；涉及 `src/scene/useSimulation.ts`，未動。
- 沒有觸碰 `src/**`、`package.json`、`.github/**`、`check:ee`、`check:visual` 或顏色鍵 cellId／beamId 決策。

## 驗證

所有指令都在 `/home/u24/demo/leo-beam-sim` 執行；沒有執行任何 `*:browser` validator，也沒有做 mutation 測試。

| Validator | 實際指令 | 修改前 exit code | 修改後 exit code | 結果摘要 |
|---|---|---:|---:|---|
| timeline scrubbing | `npm run validate:timeline:scrubbing` | 1 | 1 | 前後皆停在仍存在但改寫的 `replayController?.seek(target);` pin。 |
| handover story layer | `npm run validate:modqn:handover-story-layer` | 1 | 1 | 前後皆先停在清單外的 legacy producer horizon 文句 pin。 |
| omega S1 | `node --import tsx/esm scripts/validate-modqn-omega-s1-sidebar-truth-up.tsx` | 0 | 0 | 通過；`package.json` 無 npm key。 |
| omega S2 | `node --import tsx/esm scripts/validate-modqn-omega-s2-runtime-fetch.tsx` | 1 | 1 | 前後皆在 producer export checkpoint shape mismatch 失敗；`package.json` 無 npm key。 |
| omega S3 | `node --import tsx/esm scripts/validate-modqn-omega-s3-replay-mode-wiring.tsx` | 1 | 1 | 修改前 47 pass／3 fail；最終修改後 46 pass／2 fail。移除已不存在的 LaneExperienceBar 掛載 pin，保留 ternary 與 `useSimulation` 兩個既有紅項；`package.json` 無 npm key。 |
| omega S4 | `npm run validate:modqn:omega-s4-heuristic-not-paper` | 1 | 1 | 前後皆 31 pass／1 fail，失敗為仍存在但已改寫的 criterion 分支。 |

工作單將 S1 原 L133 標為「今天已紅」，但本輪修改前實跑 exit code 是 **0**：外層是 `assert.equal(includes(...), false)`，所以字面 0 次其實為綠。S2 的兩個 banner pin 也是負向 `assert.equal(..., false)`，但 S2 在抵達它們前已被 producer export 錯誤中止，無法取得該段的獨立 runtime 紅綠。這不影響出現次數，故不列入下一節的「數字不符」。

另執行 `git diff --check -- <六個授權 validator>`，exit code **0**。

## 我數到和給定數字不符的

無。
