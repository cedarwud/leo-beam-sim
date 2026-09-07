# 神函式 closure capture 實測

實測日期：2026-09-06。這份材料只提供 owner 判定邊界所需的量測與候選，不主張任何拆分方案，也沒有修改或抽取 `src/App.tsx`、`src/scene/MainScene.tsx`。

## 方法與口徑

執行命令：

```bash
node --import tsx/esm scripts/refactor/analyze-closure-captures.ts \
  --file src/App.tsx --function App --candidates
node --import tsx/esm scripts/refactor/analyze-closure-captures.ts \
  --file src/scene/MainScene.tsx --function SceneRenderContent --candidates
```

`state` 是所選函式 AST 範圍內的 `useState` 呼叫數。`write capture` 是函式從外部捕獲、且該函式取得寫入能力的 binding 數；它不等於函式內完全沒有寫入。後者另列為 `ownedWrittenBindings`。候選分數是 triage evidence，公式為：

```text
max(0, 100 - 3*runtimeProps - 20*writeCaptures - 8*stateToLift - 30*hookBoundary)
```

imports 與 ambient globals 不計入 `runtimeProps`。分數不是可抽取證明，最後仍須由執行器的拒絕規則與 `tsc --noEmit` 判定。

## App

- 來源：`src/App.tsx`，SHA-256 `885e2f8d24b19a6ff8113cd6a232341e068ba515740948c19c6c1b9244124e63`
- 函式範圍：388–4684
- `useState`：64；`useRef`：29
- captures：280（imports 249）；write captures：0
- owned written bindings：116
- 整體 extractability：49/100。原因是 7 個 runtime props/parameters、0 個 write capture、0 個 captured state cell，但函式跨越 hook boundary。

最容易抽取的前 5 個候選：

| 排名 | 區域 | 形狀 | 分數 | 工具評分理由 |
|---:|---|---|---:|---|
| 1 | 4042–4060，`six-acts-top-entry` 連結 | JSX | 100 | 0 runtime prop、0 write capture、0 state-to-lift、無 hook boundary。 |
| 2 | 3907–3915，`homepage-beam-rail-waiting` 狀態區塊 | JSX | 100 | 0 runtime prop、0 write capture、0 state-to-lift、無 hook boundary。 |
| 3 | 4124–4129，`global-locale-toggle-slot` | JSX | 100 | 0 runtime prop、0 write capture、0 state-to-lift、無 hook boundary。 |
| 4 | 4276–4288，archived-TLE policy boundary | JSX | 97 | 1 runtime prop、0 write capture、0 state-to-lift、無 hook boundary。 |
| 5 | 4491–4495，`HomepageRightRail` serving comparison | JSX | 97 | 1 runtime prop、0 write capture、0 state-to-lift、無 hook boundary。 |

## SceneRenderContent

- 來源：`src/scene/MainScene.tsx`，SHA-256 `d4c3fc30e37569ece1eaefe461a49bfd81034edf929f39f631f8b6b3e7eeb125`
- 函式範圍：1295–5779
- `useState`：3；`useRef`：20
- captures：194（imports 149）；write captures：0
- owned written bindings：40
- 整體 extractability：0/100。原因是 25 個 runtime props/parameters、0 個 write capture、0 個 captured state cell，且函式跨越 hook boundary。

最容易抽取的前 5 個候選：

| 排名 | 區域 | 形狀 | 分數 | 工具評分理由 |
|---:|---|---|---:|---|
| 1 | 5049–5051，`Suspense` 包住的 `UAV` | JSX | 97 | 1 runtime prop、0 write capture、0 state-to-lift、無 hook boundary。 |
| 2 | 5175–5182，`HandoverLinks` | JSX | 94 | 2 runtime props、0 write capture、0 state-to-lift、無 hook boundary。 |
| 3 | 2806–2809，`readApexWorld` | helper | 94 | 2 runtime props、0 write capture、0 state-to-lift、無 hook boundary。 |
| 4 | 5117–5120，`HandoverStoryLayer` | JSX | 94 | 2 runtime props、0 write capture、0 state-to-lift、無 hook boundary。 |
| 5 | 5140–5146，`BeamLoadCylinder` | JSX | 91 | 3 runtime props、0 write capture、0 state-to-lift、無 hook boundary。 |

`readApexWorld` 雖在相對評分中排名第三，仍捕獲兩個 runtime 值；目前最保守的區域抽取執行器會拒絕有 closure/module capture 的 helper。這個候選表是在回答「相對容易量到哪些區域」，不是宣告「工具二現在就能抽哪些區域」。

## 靜態分析限制

- 寫入分析是 flow-insensitive 的語法分析，加上本地 alias/callback effect 的保守傳播；不是 purity proof。
- imported call、dynamic dispatch、accessor、custom-hook return 與外部物件 alias 仍可能隱藏 effect。
- `setXxx` 與 hook-like name 是保守提示；本輪已修正 ambient `setTimeout` 被誤認為 setter 的假陽性。
- 候選行號綁定上述來源 hash；來源變動後必須重跑，不能沿用本表。
