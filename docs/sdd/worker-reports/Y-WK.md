# Y-WK — `AppWalkerSandbox` 下沉報告

本輪只處理 `src/AppWalkerSandbox.tsx` 的純衍生計算與純輸入轉換接縫。沒有執行
任何 git 寫入指令，沒有執行 `*:browser`、`check:ee` 或 `check:visual`，也沒有
改動 cellId／beamId 的 owner 決定。共用 checkout 中其他 worker 的 dirty WIP
保留原狀。

## 分組與判斷

### 1. Runtime、timeline descriptor 與既有純 builder

`runtime`（`useMemo`）的計算本身已由 `buildAppRuntimeConfig` 承擔；
`timelineRailDescriptor` 已由 `resolveTimelineRailDescriptor` 承擔。兩者在元件中
是把 React state 組成命名 input 的 adapter，不再重複抽一層 hook。既有純模組已有
不掛 React 的測試，因此判定為「純計算：已下沉；本輪不新增模組」。

`tickSec`、`slotOffset` 與 replay display 的小段計算也已分別是常數換算或既有純
builder 的輸入；真正的宣告包含 interval、state publication 與 effect lifecycle，
不是新的深模組界線。

### 2. Intra demo admission 與 handover mode

`requestMovingIntraDemo` 是混合宣告：可接受性判斷是純計算，但後半段會讀寫
playback、ref、request sequence 與 React state。因此抽出 admission predicate，保留
request orchestration adapter。

`applyHandoverModeSideEffects`、`handleAppModeChange` 是 mode/profile/persistence
的 feedback edge，會同時 reset simulation、寫 sidebar、persist mode/profile，判定為
「有回饋邊：不抽整個 callback」。

### 3. Training／replay 載入與同步 effects

`handleLoadIntoScene`、`handleLoadFamilyBDenseQ`、四個 `cancelled`／`cached`／
`others` effect、`scheduleState` effect，都含 fetch、cancellation、timer、cache、
ref 或多個 state setter。它們是 I/O lifecycle 與 state ownership，不是可獨立驗證的
純函式；判定為「有回饋邊：不抽」。

### 4. Timeline 與 handover rail

`handleTimelineSeek` 的 lane precedence、clamp、display-stretched 映射與 live
source horizon 是純衍生計算；select／replay seek／reset／state publication 留在
元件 adapter。

`handleHandoverRailSeek` 的 rail routing、Director live clamp 與 visual elapsed
映射也是純計算；實際 request、event clear、state setter 與對主 timeline 的呼叫留在
adapter。兩者都不改變 canonical archived-TLE homepage 的 authority chain。

`initialTimeSec` effect 與匿名的 `useDirectorOrchestration` input 則分別擁有 RAF／
playback feedback，以及 camera／controller／setter wiring，判定為「有回饋邊：不抽」。

### 5. UI tree 與 Visual Lab UE geometry

`handoverEventRail` 是 `HandoverEventRail` 加 `DirectorControls` 的 JSX 樹，判定為
「UI 樹：不抽成純模組」。

`vlabRefUeGeometryInput` 是真正的純 I/O 轉換：從 nullable snapshot/local-scene
read model 取出 geometry 所需欄位，缺資料時回傳 `null`。它不需要 React 或 canvas，
判定為「純轉換：抽出」。UE controls 的 setter、debounced dispatch、focus callback
仍留在元件內。

## 每組結果

### Runtime／既有 builder：維持既有下沉

本輪沒有製造重複模組。元件仍使用以下已驗證的純介面：

```ts
buildAppRuntimeConfig(input: AppRuntimeConfigInput): RuntimeConfig
resolveTimelineRailDescriptor(input): TimelineRailDescriptor
advanceArchivedTlePlaybackCursor(input: ArchivedTlePlaybackCursorInput): number
```

既有 `appRuntimeConfig.test.ts`、`timelineRailAuthority.test.ts` 與
`archivedTlePlayback.test.ts` 保持不變；最終 `tsc --noEmit -p tsconfig.json` 為
exit 0。`runtime` 與 `timelineRailDescriptor` 的 component adapter 行數不以縮短
作為成功條件。

### Intra demo admission：完成純核心

新增 `src/app/walkerIntraDemoAdmission.ts`：

```ts
canRequestWalkerIntraDemo(
  input: WalkerIntraDemoAdmissionInput,
): boolean
```

input 只含 presentation、manual/visible/busy flags；函式只判斷 presentation 存在、
沒有其他 handover 佔用，以及兩個 SINR 是 finite。新增
`src/app/walkerIntraDemoAdmission.test.ts`，驗證 ready、null/undefined、busy、visible
與 non-finite evidence，共 1 個 Node test file 通過。

元件的 `requestMovingIntraDemo` 現在只組 input 並執行後續 playback/ref/state adapter。
本組測試通過後的 `tsc --noEmit -p tsconfig.json` 為 exit 0。

### Timeline seek：完成純核心

新增 `src/app/walkerTimelineSeek.ts`：

```ts
resolveWalkerTimelineSeek(
  input: WalkerTimelineSeekInput,
): WalkerTimelineSeekResolution
```

回傳 discriminated union：`archived-tle`、`artifact-replay`、`display-stretched`、
`modqn-replay-proof` 或 `live-walker`。純函式負責 target clamp、proof rail 映射與
live source horizon clamp；元件仍負責 canonical selector、replay controller、
analysis reset、live request 與 state publication。

新增 `src/app/walkerTimelineSeek.test.ts`，涵蓋 canonical archived-TLE、artifact、
display-stretched、proof mapping 與 live offset/horizon，共 1 個 Node test file
通過。這個接縫將原 callback 的純分支移出，adapter 目前仍有 wiring 行，沒有把行數
當成功指標。本組測試通過後的 `tsc --noEmit -p tsconfig.json` 為 exit 0。

### Handover rail seek：完成純核心

新增 `src/app/walkerHandoverRailSeek.ts`：

```ts
resolveWalkerHandoverRailSeek(
  input: WalkerHandoverRailSeekInput,
): WalkerHandoverRailSeekResolution
```

`timeline` 結果保留 raw target，交回主 timeline resolver；`director-live` 結果才
計算 source rail clamp 與 live visual elapsed clamp。這避免在 rail callback 內複製或
改寫 canonical seek precedence。

新增 `src/app/walkerHandoverRailSeek.test.ts`，涵蓋 SINR delegation、非 focused
delegation、Director source/visual clamp 與 lower bound，共 1 個 Node test file
通過。本組測試通過後的 `tsc --noEmit -p tsconfig.json` 為 exit 0。

### Visual Lab UE geometry input：完成純轉換

新增 `src/app/walkerVisualLabUeGeometryInput.ts`：

```ts
buildWalkerVisualLabUeGeometryInput(
  input: WalkerVisualLabUeGeometrySource,
): WalkerVisualLabUeGeometryInput | null
```

它只讀取 snapshot、representative user/cell、substrate scale 與 selected world
position；資料不完整或 scale 非正時 fail closed 為 `null`。新增
`src/app/walkerVisualLabUeGeometryInput.test.ts`，驗證完整 mapping、null draft 與
三種 invalid source，共 1 個 Node test file 通過。

元件現在只保留一個薄 `useMemo` adapter；UE position callback 的 state/session/focus
feedback 沒有被偷搬進純模組。本組測試通過後的 `tsc --noEmit -p tsconfig.json` 為
exit 0。

### 量測與最終驗證

本輪新增 4 個純模組與 4 個 `node:test` 測試檔。最後一次命令為：

```text
node --import tsx/esm --test \
  src/app/walkerVisualLabUeGeometryInput.test.ts \
  src/app/walkerTimelineSeek.test.ts \
  src/app/walkerHandoverRailSeek.test.ts \
  src/app/walkerIntraDemoAdmission.test.ts
```

結果為 `tests 4, pass 4, fail 0`；隨後執行
`npx tsc --noEmit -p tsconfig.json --pretty false`，exit 0。新模組沒有 import React
或 canvas runtime。

相對本輪開始的既有 HEAD baseline，`AppWalkerSandbox.tsx` 為 3,172 行變成 3,164
行（`git diff --numstat`：66 added、74 deleted）。這只是變更記錄：

| 接縫 | 元件目前區段 | 純模組／測試行數 | 行數觀察 |
|---|---:|---:|---|
| intra admission | L817–L838 | 26／42 | predicate 移出，setter/ref orchestration 保留 |
| timeline seek | L1857–L1924 | 83／85 | branch calculation 移出；adapter wiring 不以縮短驗收 |
| handover rail seek | L2157–L2187 | 42／65 | routing calculation 移出；I/O wiring 保留 |
| Visual Lab input | L2460–L2467 | 78／86 | nullable field mapping 移出，元件只留薄 adapter |

## 我判斷不該抽的

- `runtime`：純計算已由 `buildAppRuntimeConfig` 下沉且有測試；本輪重抽只會增加
  duplicate interface。剩下的是 React state 到 runtime input 的 adapter。
- `applyHandoverModeSideEffects`：同一 callback 內有多個 setter、simulation reset、
  playback reset、sidebar mutation 與 persist；抽成 hook 會把 feedback edge 改名而不會
  消除它。
- `handleAppModeChange`：會更新 profile map ref、persist app/profile、切 app mode，並
  呼叫 handover side effects；這是跨 state 的導覽協調器。
- `handleLoadIntoScene`：多段 training service／metadata／bundle fetch、validation、
  error handling 與 8 個以上 state publication 綁在一起，不能當純轉換。
- `handleLoadFamilyBDenseQ`：fetch、envelope validation、provenance state 與 error
  state 形成載入 lifecycle；不抽整個 callback。
- startup `cancelled` effect（目前約 L1132–L1164）：非同步 bundle fetch 的
  cancellation guard 與 state writes 是 effect ownership。
- `tickSec` effect（目前約 L1179–L1204）：`tickSec` 雖是純常數換算，但宣告的核心是
  interval scheduling、cleanup 與 elapsed state feedback，沒有值得獨立成模組的深度。
- `slotOffset` effect（目前約 L1206–L1250）：slot resolver 與 display-state builder
  已是純 builder；剩下的是 equality guard、playback state 與 setter synchronization。
- handover-index `cancelled` effect（目前約 L1252–L1379）：idle/macrotask scheduling、
  incremental builder、cancellation 與 final index publication 是 runtime lifecycle。
- artifact `cached` effect（目前約 L1401–L1474）：fetch、header provenance、parse
  cache、warning、loading/error state 都是 I/O 與 feedback edge。
- artifact `others` prefetch effect（目前約 L1480–L1516）：`others` array 本身雖是小
  純 projection，但 effect 還擁有 idle scheduling、fetch、cache writes 與 cancellation；
  不為三行 projection 建立空殼模組。
- `scheduleState` effect（目前約 L1639–L1672）：ref cursor mutation、時間倒退 reset、
  handover admission 與自動 cue 觸發互相回饋，不能抽成無副作用函式而保留原語意。
- `timelineRailDescriptor`：已使用 `resolveTimelineRailDescriptor`；本輪不重複包裝。
- `initialTimeSec` effect（目前約 L1753–L1823）：RAF、external scrub detection、
  playback cursor、canonical selector 與 pause setter 是時間 transport owner。
- 匿名 `useDirectorOrchestration` wiring（目前約 L1990–L2019）：輸入物件包含 camera、
  playback、controller、refs、setter 與 handler；這是既有 orchestration adapter，不是
  純資料 projection。
- `handleExperienceChange`：會取消 focus、退出 camera、清 artifact、同步 URL、切換
  source/app mode/proof flag，是跨領域 route transition feedback edge。
- `handoverEventRail`（目前約 L2194–L2240）：它是 JSX UI tree，不是 domain calculation；
  拆分應另走 presentational component seam。
- Visual Lab UE controls 的後續 `useMemo`：`onAngleChange` 會 setter、debounced
  session dispatch 與 focus；純 geometry 已抽，剩餘部分不抽。

## 寫不出測試因此退回的

無。四個新增純接縫都能用 `node:test` + `node:assert/strict` 在不掛 React、不啟動
canvas 的情況下測試並通過。沒有任何候選因為測試寫不出來而交付或硬留下；未抽的
callback/effect 是因為它們仍是 I/O lifecycle、UI tree 或 state feedback edge。
