# Z-VL — `UnifiedVisualLabPrototype` 第三輪下沉報告

本輪延續已驗證的「純模組＋薄 adapter＋Node 單元測試」方法。沒有執行
任何 git 寫入指令，沒有執行 `*:browser` validator，也沒有修改
`check:ee`／`check:visual`。

## 分組與判斷

| 語意組 | 對象 | 判斷 | 本輪動作 |
|---|---|---|---|
| demo handover teaching clock | `demoHandoverView` 與 `DEMO_HANDOVER_DURATION_MS` | elapsed 到五段教學 phase、beat、progress 的轉換是純計算；不讀 React state、不碰 DOM/canvas，且 timer 與 view 共用同一個 duration contract。 | 抽純模組並測試 |
| story inspection navigation | `handleStoryInspect` | semantic target 到 module、explicit view、focus 是穩定的導覽投影；state setter 與 `openModule` 執行仍留在 adapter。 | 抽純模組並測試 |
| UE geometry controls | `ueGeometryControls` | 純角度／位置計算已在上一輪下沉到 `visualLabUeGeometryControls.ts`；callback、debounce、dispatch、focus/reset 仍是 adapter。 | 不重抽 |
| figure export | `downloadFigureBundle` | figure metadata/profile/text 已在上一輪下沉到 `visualLabFigureExportModel.ts`；剩餘 canvas、PNG、download 與 status state 是 browser I/O。 | 不重抽剩餘 I/O |
| dialog focus lifecycle | `handleDialogKeys` | 依賴 document/window、focusable DOM 查詢、listener cleanup 與 state setter。 | 不抽 |
| playback clocks | 兩個含 `previousTickAt` 的 `useEffect` | wall clock、interval、ref/state 更新與 accepted timeline seek 形成 feedback edge。 | 不抽 |
| replay capture/export | `downloadActiveReplay` | 混合 replay controller、AbortController、canvas/capture stream、frame callback、download writer 與 status state。 | 不抽整體 |
| demo replay start coordination | `startDemoHandoverReplay` | close/open、多個 setter、scene/view/focus 協調是狀態轉換；只建立一個零 elapsed object 不足以形成有深度的模組。 | 不抽 |
| replay launch coordination | `launchReplay` | guided/story/causal 三路 async branch 會互相 close/open、驗 availability、更新 module/view/focus 與 error state。 | 不抽 |

## 每組結果

### 1. Demo handover teaching clock

新增 `src/prototype/visual-lab-g0/visualLabDemoHandoverView.ts`：

```ts
deriveVisualLabDemoHandoverView(
  elapsedMs: number,
): VisualLabDemoHandoverView
```

另 export `VISUAL_LAB_DEMO_HANDOVER_DURATION_MS`，由 component timer 與純
view resolver 共用。模組只依賴既有無樣式副作用的
`visualLab/guidedReplay/model` runtime 與 `guidedReplay/types` 型別，不會因
Node 測試載入 replay rail 的 SCSS。

元件目前只留下 nullable adapter：

```ts
const demoReplayView = demoReplay === null
  ? null
  : deriveVisualLabDemoHandoverView(demoReplay.elapsedMs);
```

測試：`visualLabDemoHandoverView.test.ts`，2 tests；覆蓋所有 phase 邊界、
beat、duration，以及負數／NaN／Infinity 的 fail-safe normalization。

驗證：

- focused Node test：2/2 pass。
- `npx tsc --noEmit -p tsconfig.json --pretty false`：exit 0。
- 初次 focused test 曾因錯誤地從 `guidedReplay` barrel 引入而載入
  `annotationOverlay.scss`；改接純 `model` runtime、型別改接
  `types` 後重跑通過。這是 import seam 修正，不是跳過測試。

行數（只作變更紀錄，不作成功指標）：新模組 29 行、新測試 25 行；原元件
移除 local view type/function/constant 25 行，留下 1 行純函式 adapter。

### 2. Story inspection navigation

新增 `src/prototype/visual-lab-g0/visualLabStoryInspectPlan.ts`：

```ts
deriveVisualLabStoryInspectPlan(
  target: VisualLabInspectTarget,
): VisualLabStoryInspectPlan
```

回傳明確的 `module`、`explicitView`、`focus`。其中 `scene` 與
`handover` 保留原本的 service-view override；`figure` 保留原 handler
落入 SINR/geometry fallback 的既有語意。元件 adapter 只執行 plan：

```ts
const plan = deriveVisualLabStoryInspectPlan(target);
openModule(plan.module);
if (plan.explicitView !== null) setView(plan.explicitView);
setFocus(plan.focus);
```

測試：`visualLabStoryInspectPlan.test.ts`，3 tests；覆蓋 scene/handover、
power/energy-efficiency、sinr/throughput/figure 六個 semantic target。

驗證：

- focused Node test：3/3 pass。
- `npx tsc --noEmit -p tsconfig.json --pretty false`：exit 0。
- `git diff --check`：無輸出。

行數（只作變更紀錄，不作成功指標）：新模組 33 行、新測試 47 行；
`handleStoryInspect` 原 21 行變成 6 行 adapter。兩組完成後
`UnifiedVisualLabPrototype.tsx` 為 1,463 行，前一輪 checkpoint 為
1,500 行；這不是本輪驗收依據。

## 我判斷不該抽的

- `handleDialogKeys`：它是 modal focus trap 的 UI lifecycle，讀取
  `document.activeElement`、query DOM、註冊／移除 window listener、focus
  cleanup 並寫 `clipShelfOpen`。抽成純 helper 無法承擔 lifecycle；抽成 hook
  只會搬移參數與 effect。
- 第一個 `previousTickAt` effect：demo clock 讀取
  `demoReplayRef`，再寫回 ref、`demoReplay`、`simpleReplayKind`，並以
  wall clock 決定生命週期，是 state feedback，不是可獨立投影。
- 第二個 `previousTickAt` effect：generic playback 同時依賴 performance
  clock、playback rate、timeline duration、replay guards、ref/state setter
  與 `session.dispatch({ type: 'seek' })`；抽完整 effect 會形成 clock/session
  參數網。
- `ueGeometryControls`：其可測數值核心已由
  `deriveVisualLabUeGeometryControls(input)` 承擔；剩下的
  `onAngleChange`、debounce、dispatch、reset/focus 是正確留在 React
  adapter 的副作用。
- `downloadFigureBundle`：可測的 figure model 已由
  `buildVisualLabFigureExportModel(input)` 承擔；canvas compositor、PNG
  encoding、bundle writer 與 status update 不能假裝成 Node 純函式。
- `downloadActiveReplay`：它是 capture orchestration，包含三種 replay
  controller 的重啟、canvas cache、capture stream、AbortController、每 frame
  draw 與下載。既有 provenance/compositor seam 已足夠，整段再抽會製造大
  interface。
- `startDemoHandoverReplay`：真正的行為是先關閉既有 replay，再同步多個
  presentation state、開啟 scene、切換 service view、設定 focus；可抽出的
  `{ kind, elapsedMs: 0 }` 只是 pass-through construction，沒有值得建立的
  深模組。
- `launchReplay`：guided/story/causal 分支各自需要不同 controller 與
  availability/identity 條件，還要在錯誤時恢復 shelf；這是 async controller
  協調，不是單一純 projection。

## 寫不出測試因此退回的

無。兩個本輪抽出的接縫都能以不掛 React、不啟動 canvas 的
`node:test` 直接驗證；其餘候選是在抽取前依 effect、browser I/O 或
state feedback 判定不抽，沒有先造出 30-parameter hook 再用 mock 掩蓋問題。
