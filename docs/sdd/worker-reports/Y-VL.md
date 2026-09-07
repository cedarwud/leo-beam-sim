# Y-VL — `UnifiedVisualLabPrototype` 下沉報告

本輪接續今日已驗證的「純模組＋薄 adapter＋Node 單元測試」方法。沒有執行
任何 git 寫入指令，沒有執行 `*:browser` validator，也沒有修改
`check:ee`／`check:visual`。

## 分組與判斷

| 語意組 | 對象 | 判斷 | 動作 |
|---|---|---|---|
| demo handover direction | `demoDirection` | 由 demo replay、accepted local scene 與 beam target 產生 presentation direction；不寫 state、不碰 DOM。 | 抽純模組 |
| shell presentation copy | `ui` | 是 locale/theme 到 labels 的純轉換，不是 JSX UI tree，也不持有 callback。 | 抽純模組 |
| replay shelf availability | `clipEntries` | 將 story availability、session readiness 與 locale reason 投影成 clip availability；既有 `createVisualLabClipEntries` 仍負責固定四張卡的純建構。 | 抽純模組 |
| UE geometry controls | `ueGeometryControls` | 角度、draft world position、最大角度與反解 request 是數值衍生計算；slider callback、debounced dispatch、focus/reset 是 React adapter。 | 抽純模組；callback 留在元件 |
| figure export preparation | `downloadFigureBundle` 的 metadata/text/profile 子圖 | 整個函式含 DOM/canvas/PNG/下載與 status state，但其 figure profile、metric/footer text、caption/provenance 是可獨立測試的純 I/O model。 | 抽純 model；canvas/下載 adapter 留在元件 |
| dialog focus effect | `handleDialogKeys` | 依賴 `document.activeElement`、DOM query、window listener、focus cleanup 與 `setClipShelfOpen`。這是 UI effect，不是純計算。 | 不抽 |
| playback clocks | 兩個含 `previousTickAt` 的 `useEffect` | `performance.now`、interval、refs、state setter、`session.dispatch({ type: 'seek' })` 形成 clock/state feedback edge。 | 不抽 |
| replay capture/export | `downloadActiveReplay` | 會重啟/播放 controller、讀取與建立 canvas、呼叫 capture stream、AbortController、refs、status state 與下載 writer。 | 不抽整個函式；沿用既有純 provenance/compositor seams |
| replay launch coordination | `launchReplay` | guided/story/causal 三條 async branch 會互相 close/open、改 module/view/focus、更新 launch/error state。這是 controller 協調，不是純 projection。 | 不抽 |

## 每組結果

### 1. demo handover direction

新增 `src/prototype/visual-lab-g0/visualLabDemoDirection.ts`：

```ts
deriveVisualLabDemoDirection(
  input: VisualLabDemoDirectionInput,
): VisualLabStorySceneDirection | null
```

input 只包含 `replay`、`view` 與縮窄後的 `scene`：satellite elevation、serving/candidate identity、representative user、substrate users、active beam targets。元件目前只做 nullable guard 與 scene adapter；排序、serving/target identity、beam mapping 與 revision 全在純函式中完成。

測試：`visualLabDemoDirection.test.ts`，3 tests，涵蓋 inter 最高 elevation 選擇、intra 保留 serving identity、representative 不可用時的 user fallback，以及無 local scene。

元件宣告由原始 43 行（原 L282–324）變為目前 L280–294 的 15 行；新增純模組 101 行、測試 66 行。此行數只作變更記錄，不作成功指標。

### 2. shell presentation copy

新增 `src/prototype/visual-lab-g0/presentation/visualLabShellUiCopy.ts`：

```ts
visualLabShellUiCopy(
  locale: VisualLabLocale,
  theme: VisualLabTheme,
): VisualLabShellUiCopy
```

測試：`presentation/visualLabShellUiCopy.test.ts`，2 tests，驗證中英文 labels、dark/light theme wording 與 immutable result。

`ui` 由原始 89 行（原 L403–491）變為目前 L373 的 1 行 adapter；新增純模組 151 行、測試 19 行。

### 3. replay shelf availability

新增 `src/prototype/visual-lab-g0/visualLabClipAvailability.ts`：

```ts
deriveVisualLabClipAvailability(
  input: VisualLabClipAvailabilityInput,
): Partial<Record<VisualLabClipId, VisualLabClipAvailability>>
```

測試：`visualLabClipAvailability.test.ts`，3 tests，驗證 pending/preparing/unavailable 分流、runtime id 缺失時 fail closed，以及 accepted scene 尚未 ready 時的文案與狀態。

`clipEntries` 由原始 48 行（原 L623–670）變為目前 L505–519 的 15 行 adapter；新增純模組 83 行、測試 55 行。既有 `createVisualLabClipEntries` 未重複搬動，仍由它建構固定 clip definition 與 launch model。

### 4. UE geometry controls

新增 `src/prototype/visual-lab-g0/visualLabUeGeometryControls.ts`：

```ts
deriveVisualLabUeGeometryControls(
  input: VisualLabUeGeometryControlsInput,
): VisualLabUeGeometryDerived | null
```

回傳 `scale`、`angleInput`、accepted/draft/max angle 與 `hasDraft`；`onAngleChange`、`scheduleUeRecompute`、`setFocus`、`onReset` 仍由元件持有，因此純模組沒有 React state 或 canvas 依賴。

測試：`visualLabUeGeometryControls.test.ts`，3 tests，驗證角度與 slider max、world-space draft 轉 km、精確 inverse seam，以及 invalid scale fail closed。

`ueGeometryControls` 由原始 63 行（原 L840–902）變為目前 L689–725 的 37 行 adapter；新增純模組 85 行、測試 54 行。

### 5. figure export preparation

新增 `src/prototype/visual-lab-g0/visualLabFigureExportModel.ts`：

```ts
buildVisualLabFigureExportModel(
  input: VisualLabFigureExportModelInput,
): VisualLabFigureExportModel
```

測試：`visualLabFigureExportModel.test.ts`，2 tests，驗證 figure profile/camera/layer preset、雙語 metric formatting、離軸角/footer、缺少 metrics 的 deterministic output 與 provenance locators。

`downloadFigureBundle` 由原始 88 行（原 L904–991）變為目前 L727–805 的 79 行；canvas creation、`drawImage`、PNG encoding、bundle writer 與 status state 都仍在 adapter。新增純 model 117 行、測試 59 行。這個切法讓 figure 的可測接縫清楚，但沒有假裝 canvas I/O 本身是 Node 純函式。

總體上，`UnifiedVisualLabPrototype.tsx` 由 checkpoint 的 1,686 行變為 1,500 行（-186）；行數不是本輪驗收條件。

驗收證據：上述五組每組均在 focused Node test 後重新執行
`npx tsc --noEmit -p tsconfig.json --pretty false`，每次 tsc exit 0；新增測試合計 13 tests，全部通過。

## 我判斷不該抽的

- `handleDialogKeys`：它是 modal focus trap 的 UI lifecycle，讀寫 `document`、`window`、refs 與 `clipShelfOpen`；抽成 helper 只會把 event listener lifecycle 藏起來，沒有穩定的純輸入/輸出邊界。
- 第一個 `previousTickAt` effect：demo replay clock 會以 wall clock 改寫 `demoReplayRef`、`demoReplay` 與 `simpleReplayKind`，是自身 state feedback。
- 第二個 `previousTickAt` effect：generic playback clock 同時更新 elapsed ref/state 並 dispatch accepted timeline seek；若抽出整段會把 session/clock ownership 變成參數網。
- `downloadActiveReplay`：它是 capture orchestration，不是單一資料轉換；純 `buildVisualLabReplayProvenance` 與 `drawVisualLabClipFrame` 已有各自 seam，剩餘部分仍有 canvas/capture/abort/controller feedback。
- `launchReplay`：三種 runtime 的 open/close、module/view/focus 與 error recovery 互相協調，抽出會製造 callback/state 參數網，也無法在不啟動 React runtime 的情況下驗證整個行為。
- `downloadFigureBundle` 的 DOM/canvas/PNG/download 部分：只抽了可測的 export model；不能把 `HTMLCanvasElement` 或 browser writer 假裝成純核心。

## 寫不出測試因此退回的

無。這次沒有把上述 feedback/effect/canvas 區段硬抽後再用 mock 補測試；它們在接縫分析階段即判定不符合純模組驗收條件。

補充回歸狀態：`npm run test:visual-lab` 在本 checkout 結果為 59 pass、3 fail；失敗檔案是既有 `visualLabControlTaxonomy.test.tsx`、`visualLabScenePresentation.test.ts`、`visualLabStoryController.test.ts`，本輪沒有修改這些檔案。這三項不被宣稱為本輪綠燈；本輪新模組 focused tests 與 tsc 證據仍全綠。
