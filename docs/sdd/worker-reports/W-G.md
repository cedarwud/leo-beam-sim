# W-G：神函式分析與區域抽取工具

## 我做了什麼

- 修改 `scripts/refactor/analyze-closure-captures.ts`：保留原本的 TypeScript symbol／alias／callback-effect 分析，只修正 ambient `setTimeout` 的 setter 假陽性。
- 新增 `scripts/refactor/extract-region.ts`：以 AST 完整節點為輸入，支援保守的 nested helper 與 read-only JSX 抽取；寫入後自行執行 `tsc --noEmit`，紅燈時以原始 bytes 回復來源並移除新目標，不使用 git。
- 新增 `scripts/refactor/__tests__/analyze-closure-captures.test.ts` 與 `extract-region.test.ts`：全部使用測試期間建立的小型合成 project/fixture，沒有拿三個神函式檔案當抽取輸入。
- 新增 `docs/sdd/GOD-FUNCTION-CAPTURE-ANALYSIS.md`：記錄 `App`、`SceneRenderContent` 的來源 hash、state/write-capture 量測與各自前 5 個候選。
- 沒有修改 `src/App.tsx`、`src/scene/MainScene.tsx`、`src/AppWalkerSandbox.tsx`、`package.json` 或其他既有檔案。

## 我驗證工具一的方式與結果

我先讀完接手版本，確認它不是文字搬移器：它透過 TypeScript checker 建立 symbol inventory，追蹤 hook binding、direct/alias/object mutation、local callback effect，再把候選分數標成 triage evidence 而非 extraction approval。這些設計保留，沒有重寫。

正確的部分：

- `App` 的核心 hook AST 計數為 `useState 64 / useRef 29 / useMemo 63 / useCallback 45 / useEffect 31`；以涵蓋泛型呼叫的 lexical pattern（例如 `useState[<(]`）獨立計數，完全一致。
- `SceneRenderContent` 的對應結果為 `3 / 20 / 80 / 4 / 4`，另有 `useLayoutEffect 2`；獨立計數亦一致。
- 合成反例證實 direct setter、setter alias 與 object mutator 都被列為寫入能力。

發現並修正的錯誤：原版把任何 `setXxx(...)` 都當 setter，因此把 ambient global `setTimeout(cb, 1200)` 誤列為 `App` 的唯一 write capture。修正後，name-based setter hint 只套用在本來源檔有 declaration 的 symbol；真正的 hook setter 仍由 hook origin 判定。結果如下：

| 函式 | 修正前 write captures / score | 修正後 write captures / score |
|---|---:|---:|
| `App` | 1 / 29 | 0 / 49 |
| `SceneRenderContent` | 0 / 0 | 0 / 0 |

這個修正由 `does not mistake ambient setTimeout for a React-style setter` 測試鎖住。工具仍明載限制：這是靜態、flow-insensitive、保守分析，不是跨模組 purity proof。

## 工具二的能力邊界

能處理：

- 完整 AST 對齊、定義在另一個函式／元件內的 named function declaration，或單一 `const` arrow/function-expression helper。
- helper 只能捕獲 imports 與 ambient globals，不得含 hook、write capture、parameter mutation，亦不得依賴 `this`、`super`、`arguments`、`await` 或 `yield`。原本的 local binding 由 import alias 保留，所以既有 call sites 不需文字重寫。
- 完整 JSX element/self-closing element/fragment。import capture 會複製並依目標位置重算相對路徑；closure/module 的 runtime read-only capture 會成為具體 typed props；原處會換成新 presentational component call。
- 目標必須不存在；JSX 目標必須是 `.tsx`。執行前先跑 baseline `tsc --noEmit`，baseline 本來就紅則完全不寫檔。
- 建立目標後再寫來源，最後再跑一次 `tsc --noEmit`。後驗紅燈會回復 byte-identical 原來源、刪除新目標並清掉本次新增且仍為空的目錄；完全不呼叫 git。

會拒絕：

- 任何 write capture，包括直接／alias setter、外部物件 mutation，以及把 setter 當 callback 傳下去。
- 有 closure/module/unresolved capture 的 helper、local-only type capture 或 unresolved capture 的 JSX、helper parameter mutation、partial AST range、多個 statements、既有目標檔、無 tsconfig 的輸入。
- 任意 statement block、自動搬 hook/state ownership、改寫跨檔 call graph、class/method extraction，以及超出上述兩種形狀的自動猜測。

`tsc` 只能證明型別網子為綠，不能證明 imported call、accessor 或 dynamic dispatch 的語意純度。工具因此先做可機械拒絕的保守檢查，仍不把成功結果稱為 owner 邊界核准。

## 測試

最終測試以 repo 既有的 Node test runner 慣例執行，兩個檔案明確序列化：

```bash
node --import tsx/esm --test scripts/refactor/__tests__/analyze-closure-captures.test.ts && \
node --import tsx/esm --test scripts/refactor/__tests__/extract-region.test.ts
```

實際結果：analyzer `3/3 pass`；extractor `7/7 pass`；總計 `10/10 pass`、exit 0。涵蓋 hook/state/ref 計數、direct/alias/mutator write、`setTimeout` 假陽性、function/arrow helper、唯讀 JSX props/import rebasing、setter capture 拒絕、parameter mutation 拒絕，以及 mock 與真實 `tsc` post-write failure 的 byte-exact 完整回滾。

```bash
npx tsc --noEmit -p tsconfig.scripts.json --pretty false
```

實際結果：無 diagnostics，exit 0。

曾嘗試用一個 `--test scripts/refactor/__tests__/*.test.ts` process 探索兩檔；此環境在第一檔完成後，只對第二檔回報 file-level `test failed`，沒有 subtest assertion。第二檔單獨與上面的明確序列命令均全綠。原因未被證實，因此不把 glob 形式列為建議 gate。

沒有執行任何 `*:browser` validator、`check:ee` 或 `check:visual`。

## 交給 owner 的

`package.json` 未修改。建議由 owner 加入以下 keys：

```json
{
  "test:refactor-tools": "node --import tsx/esm --test scripts/refactor/__tests__/analyze-closure-captures.test.ts && node --import tsx/esm --test scripts/refactor/__tests__/extract-region.test.ts",
  "refactor:analyze-captures": "node --import tsx/esm scripts/refactor/analyze-closure-captures.ts",
  "refactor:extract-region": "node --import tsx/esm scripts/refactor/extract-region.ts"
}
```

仍需 owner 決定：

- `GOD-FUNCTION-CAPTURE-ANALYSIS.md` 的候選哪些才是領域／ownership 邊界；分數只表示靜態搬移摩擦較低。
- 新模組的命名、目錄與 public API；工具只執行給定目標，不替 owner 選架構。
- 是否先處理 `App.tsx` 的 source-text pins，再允許任何真實抽取。
- 未來是否擴充 helper 的 closure value parameterization、state ownership 搬移或多 statement extraction；這些不在本輪兩種安全形狀內。
- 在真實神函式上執行前，仍應重新確認來源 hash、當下工作樹與完整可用的非瀏覽器／瀏覽器網子。本輪未對三個目標檔執行工具二。
