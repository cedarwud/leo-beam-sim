# W-VL — `UnifiedVisualLabPrototype` 第三輪下沉報告

本輪延續「純模組＋薄 adapter＋Node 單元測試」方法。純模組不讀 React
state、不啟動 DOM 或 canvas；effect、controller、ref、setter 與 browser I/O
仍由元件持有。全程沒有執行 git 寫入指令、`*:browser` validator、`check:ee`
或 `check:visual`。

## 分組與判斷

| 分組 | 原始標的 | 判斷 | 動作 |
|---|---|---|---|
| dialog keyboard policy | `handleDialogKeys`（原 27 行） | Escape 與 Tab endpoint wrap 是純決策；DOM 查詢、focus、listener 與 state lifecycle 不是純核心。 | 抽 `resolveVisualLabDialogKeyAction`；effect 留薄 adapter |
| demo replay tick | 第一個 `previousTickAt` effect（原 22 行） | elapsed 累加、duration completion 與 immutable next state 可脫離 timer/ref/state 測試。 | 抽 `advanceVisualLabDemoReplay`；wall clock 與 completion setter 留在 effect |
| replay launch routing | `launchReplay`（原 54 行） | target 到 module/view/focus/runtime story id 是穩定投影；availability、controller async、close/open 與 error recovery 仍是元件協調。 | 抽 `deriveVisualLabReplayLaunchPlan`；`launchReplay` 留 controller adapter |
| generic playback clock | 第二個 `previousTickAt` effect（原 31 行） | 已有 `advanceVisualLabPlayback` 純模組；剩下的 performance clock、timeline wrap、ref/state 與 session dispatch 形成 feedback edge。 | 不重抽 |
| UE geometry controls | `ueGeometryControls`（原 37 行） | 數值核心已由 `deriveVisualLabUeGeometryControls` 承擔；callback、debounce、dispatch、focus/reset 是 adapter。 | 不重抽 |
| figure export | `downloadFigureBundle`（原 79 行） | figure model 已由 `buildVisualLabFigureExportModel` 承擔；canvas compositing、PNG、bundle writer 與 status 是 browser I/O。 | 不重抽剩餘部分 |
| replay capture/export | `downloadActiveReplay`（原 158 行） | capture controller、AbortController、canvas cache、MediaRecorder stream、frame callback 與 download writer 互相協調。 | 不抽整體；沿用既有 provenance/compositor seams |
| demo replay start | `startDemoHandoverReplay`（原 21 行） | close/open、多個 presentation setter 與 scene/view/focus ownership 是狀態轉換；單獨抽 `{ kind, elapsedMs: 0 }` 會是 pass-through。 | 不抽 |

## 每組結果

### 1. Dialog keyboard policy

純模組簽章：

```ts
resolveVisualLabDialogKeyAction(
  input: VisualLabDialogKeyActionInput,
): VisualLabDialogKeyAction
```

`VisualLabDialogKeyActionInput` 只含 `key`、`shiftKey`、`activeIndex`、
`focusableCount`；結果是 `{ type: 'close' }`、`{ type: 'focus', index }` 或
`null`。元件目前只做 focusable DOM collection、呼叫純模組，再執行
`preventDefault`／focus／`setClipShelfOpen`。

- 測試：`visualLabDialogKeyAction.test.ts`，3 tests、3 pass、0 fail。
- tsc：`npx tsc --noEmit -p tsconfig.json --pretty false`，exit 0。
- 行數紀錄：adapter 約 27→26 行；新純模組 26 行、測試 48 行。行數不是驗收指標。

### 2. Demo replay clock

純模組簽章：

```ts
advanceVisualLabDemoReplay(
  current: VisualLabDemoReplayState,
  deltaMs: number,
  durationMs?: number,
): VisualLabDemoReplayState | null
```

`null` 表示本 tick 已達 duration；否則回傳新的 immutable replay state。
有限性、非負 elapsed/delta 與 completion policy 均在純模組內，effect 仍保留
`performance.now`、interval、ref 寫入與三個 React state 更新。

- 測試：`visualLabDemoReplayClock.test.ts`，3 tests、3 pass、0 fail。
- tsc：最後 checkpoint exit 0。中途曾因 W-MS 尚未完成的
  `MainScene.tsx:992` 外部 WIP 暫時出現 type error；未修改該檔，writer 完成後
  重跑為綠。
- 行數紀錄：adapter 約 22→23 行；新純模組 16 行、測試 32 行。呼叫行變長
  不影響 seam 的可測性。

### 3. Replay launch plan

純模組簽章：

```ts
deriveVisualLabReplayLaunchPlan(
  target: VisualLabClipLaunchTarget,
): VisualLabReplayLaunchPlan
```

結果以 discriminated union 表達三條路徑：guided 回傳 typed
`guidedReplayId`、module、service view 與 handover focus；story 回傳 scene
module、service view 與 handover focus；causal 回傳 `sinr`／`power` module 與
`beamwidth`／`power-cap` story id。未知組合 fail closed，錯誤仍在原本的
`try/catch` 內由 adapter 轉成 launch error state。

- 測試：`visualLabReplayLaunchPlan.test.ts`，3 tests、3 pass、0 fail；涵蓋
  guided、story、兩個 causal target 與兩種 unsupported combination。
- tsc：修正 plan 與 guided replay id 的 type narrowing 後，最後 checkpoint
  exit 0。
- 行數紀錄：`launchReplay` 約 54→46 行；新純模組 57 行、測試 47 行。行數
  只作變更紀錄，不作成功指標。

### 本輪整體驗證

- 三個新測試檔合計 9 個 test cases，focused Node run exit 0。
- `npx tsc --noEmit -p tsconfig.json --pretty false`：`TSC_EXIT=0`。
- `git diff --check`：`DIFF_CHECK_EXIT=0`。
- 既有 `visualLabScenePresentation.test.ts` 另有 1 個 assertion failure：測試
  期待 `VisualLabScene.tsx` 有 `data-local-system-power-w`，但目前來源內容沒有；
  本輪沒有修改 `VisualLabScene.tsx`，因此不把它當成本輪新模組的通過證據，也
  沒有越界修復。
- `UnifiedVisualLabPrototype.tsx` 本輪 checkpoint 由 1,463 行變為 1,456 行；
  這只是定位資料，不是成功指標。

## 我判斷不該抽的

- `handleDialogKeys` 的剩餘 effect lifecycle：`document`／`window`、focusable
  DOM collection、listener cleanup 與 `setClipShelfOpen` 必須跟 modal lifecycle
  同處；已只抽出可測的 keyboard policy。
- 第二個 `previousTickAt` effect：`performance.now`、playback rate、timeline
  duration、replay guards、`elapsedSecRef`、React setter 與
  `session.dispatch({ type: 'seek' })` 是同一條 feedback edge。已有
  `advanceVisualLabPlayback` 純 seam，再抽整個 effect 會製造參數網。
- `ueGeometryControls` 的剩餘 useMemo：`deriveVisualLabUeGeometryControls`
  已承擔角度／位置計算；`onAngleChange`、debounce、dispatch、focus/reset
  是故意留在 React adapter 的副作用。
- `downloadFigureBundle` 的剩餘 browser 部分：DOM canvas、`drawImage`、PNG
  encoding、bundle writer 與 capture status 不能在 Node 純測試中假裝成核心。
- `downloadActiveReplay` 整體：三種 replay controller 的 restart/play、
  canvas/cache、capture stream、AbortController、每 frame draw 與下載 writer
  是 browser capture orchestration；既有 provenance/compositor 純 seam 已足夠。
- `startDemoHandoverReplay`：先 close active replay，再同步更新 demo/story/
  shelf/playback/module/view/focus 的狀態 ownership；只抽零值 replay object
  沒有足夠深度。
- `launchReplay` 的剩餘 async controller：availability 查驗、story selection、
  guided/causal open/close、play、error recovery 與 shelf reopen 都依賴 runtime
  controller 和 React state；本輪只抽 target routing plan。

## 寫不出測試因此退回的

本輪沒有把任何候選硬塞成 custom hook，也沒有新增需要 React、DOM、canvas 或
mocked controller 才能測的模組。三個抽出的 seam 都有不掛 React、不啟動 canvas
的 `node:test` 測試；其餘標的依上節理由保留在 adapter，因此沒有「先抽再因寫
不出測試退回」的假完成項。
