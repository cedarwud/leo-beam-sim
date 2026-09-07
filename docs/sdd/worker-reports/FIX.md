# FIX 測試治理報告

本次只修改 `src/scene/multiCandidateMainSceneIntegration.test.ts` 與本報告；沒有修改 production code。受影響的 source regex 沒有改指向任何新模組，也沒有新增以 source literal 維持綠燈的 pin。場景與 gate 的新斷言使用 renderer-neutral resolver；layer wiring 僅直接呼叫 function 檢查回傳 element props，沒有 mount React 或啟動 canvas。

## 逐條處置

1. `MainScene mounts the bounded multi-candidate presentation from one accepted snapshot`（審查 #1）

   - 原本守什麼：`MainScene` 文字中必須以 accepted presentation plan 呼叫 `buildMultiCandidateScenePresentation`，並把產物接到 multi-candidate scene、candidate callback 與 identity-label 設定。
   - 現在怎麼守：建立有效的 mock decision frame 與 `CandidatePresentationPlan`，交給 `resolveMultiCandidatePresentationPolicy`，斷言輸出非空、join key 與 plan 完全一致、候選數為 2、solid data link 為 1；再直接呼叫 `SceneMultiCandidateLayer`，斷言 central/review 都消費相同 presentation、callback 正確傳遞、serving carrier 只在 central 開啟，兩個 beat 都關閉重複 identity labels；直接呼叫 marker layer，斷言候選標籤、homepage 字級 22/18、顏色與 scale 7 的實際 props。
   - 不是 re-pin：測試不再讀取或比對搬家後的模組文字。若 plan 沒有被建立、join key/候選數/solid link 錯誤，或 layer/marker 輸出契約被破壞，斷言會紅。

2. `homepage transition colours stay on the accepted EE shade projection`

   - 原本守什麼：serving 與 candidate 兩端都要使用 accepted EE shade 與 vivid identity，而不能退回 beam-slot 顏色。
   - 現在怎麼守：把兩個 endpoint 與不同 EE 值餵給 `resolveMultiCandidateBeamColors`，用實際 `homepageSatelliteColorForBeam` 計算期望色，斷言兩個 beam 都有正確顏色、顏色不同，且 resolver 對兩端都以 vivid 模式呼叫。
   - 不是 re-pin：驗證的是顏色 map 與 callback 輸出；若任一端遺失、EE 被忽略或 vivid/highlight 行為消失，測試會紅。

3. `candidate authority is additive and cannot blanket-suppress the established carrier`

   - 原本守什麼：candidate authority 不能清空既有 serving carrier、cell-truth particles、Beam Info、pulse/cross-fade、triggered intra 與 authority pair。
   - 現在怎麼守：分別以純輸入驗證 `resolveAuthoritySpineParticlePlans`、`resolveSinrLiveCellTruthSpineParticlePlans`、`resolveServingConeItems`、`resolveBeamInfoItems`、`resolvePulseConeItems`、`resolveTriggeredIntraConeItems` 與 `resolveAuthorityPairConeItems`；斷言 particle IDs、serving cone/color、Beam Info 對 display-only substrate 的過濾，以及各 handover carrier 的輸出數量。
   - 不是 re-pin：正向的 moved implementation pins 已改為實際 resolver output；若 authority 造成既有 carrier 消失、Beam Info 顯示 substrate、或任一 handover geometry 不再產生，對應斷言會紅。

4. `central comparison is rendered from the accepted pre-selection projection`（審查 #2）

   - 原本守什麼：central overlay 必須由 accepted snapshot 的 pre-selection decision/frame gate 啟用，不能靠另一個 wall-clock review timer，也不能接納 stale snapshot。
   - 現在怎麼守：以 accepted plan 呼叫 `resolveMultiCandidateComparisonPolicy` 與 `resolveMultiCandidatePresentationPolicy`；overlay enabled 時斷言 `centralOverlayActive`、scene projection、visual/layer gate 全部成立，disabled 時斷言輸出為 `null` 且 gate 全關，epoch 不一致時斷言 snapshot 不匹配、overlay 關閉。
   - 不是 re-pin：不再斷言 `MULTI_CANDIDATE_CENTRAL_OVERLAY_ENABLED` 或其他原始碼字面值；若 central gate、pre-selection output 或 stale-frame fail-closed 行為改壞，測試會紅。

5. `homepage candidate cones cannot fall back to the legacy pending-target stream`

   - 原本守什麼：homepage 模式下 candidate geometry 不能從 legacy `pendingTargetSatId` fan 回流。
   - 現在怎麼守：把 pending target 與 geometry 餵給 `resolveCandidateConeItems`；homepage identity mode 必須輸出空集合，而相同輸入在非 homepage mode 必須仍有 legacy fan 輸出。
   - 不是 re-pin：斷言的是兩種模式的 geometry output；homepage fallback 一旦洩漏或 legacy 路徑被誤刪，測試會紅。

6. `scene telemetry exposes rendered-output recovery and one-link browser gates`（審查 #5）

   - 原本守什麼：除了 telemetry/status 外，還以 `renderReceipt={multiCandidateSceneRenderReceipt}` 守一個內部 prop 傳遞。
   - 現在怎麼守：依審查判定刪除 `renderReceipt` source regex；它沒有對應畫面圖元，不能有效保護 render behavior。原本 serving cone mount 的 source pin 改由 `resolveServingConeItems` 驗證實際 serving output，其餘 telemetry/status guards 保留。
   - 不是 re-pin：沒有把 receipt regex 改到 `SceneMultiCandidateLayer` 或其他新模組；若 serving output 消失，新的 geometry assertion 會紅，而 receipt prop 本身不再製造假紅。

7. `authority presentation prioritizes actual switching while admitting manual and cinema demos during evaluation`（審查 #3）

   - 原本守什麼：authority candidate 非 null 時必須優先；authority 沒有 candidate 時，manual/cinema 可依條件接手；natural background event 在 authority snapshot 下須被壓制。
   - 現在怎麼守：以 `resolveHandoverPresentationCandidate` 做 truth cases：authority + manual 時 authority 勝出、authority 無 candidate 時 manual fallback、再測 cinema fallback，以及 accepted authority 存在時 natural event 回傳 `null`。
   - 不是 re-pin：不再找 `if (authorityHandoverPresentationCandidate !== null)` 的 source text；若優先權或 fallback 順序改變，對應 case 會紅。

8. `homepage cinema pair render gate admits indexed intra handover`（審查 #4）

   - 原本守什麼：`presentedInterHandoverActive`、`presentedCinemaHandoverActive` 與 `kind === 'intra'` 的組合必須決定 cinema pair 是否輸出。
   - 現在怎麼守：列出五組 truth table，直接呼叫 `resolveCinemaPairConeItems`，驗證 inter presentation、cinema intra、cinema inter、inactive，以及 inter 優先於 cinema kind 的輸出真假。
   - 不是 re-pin：不再比對 source ordering 或條件文字；每組 output 都直接反映畫面 gate，任一組決策錯誤就會紅。

## 驗證

- `node --import tsx/esm --test src/scene/multiCandidateMainSceneIntegration.test.ts`：exit 0；12 tests、12 pass、0 fail。
- `tsc --noEmit -p tsconfig.json` 與 `tsc --noEmit -p tsconfig.scripts.json`：目前 shell 未把 `node_modules/.bin` 放入 `PATH`，裸指令 exit 127；加入 repo-local binary 後以 `PATH="$PWD/node_modules/.bin:$PATH" tsc ...` 執行，兩者皆 exit 0、無輸出（TypeScript 5.9.3）。
- `git diff --check`：exit 0、無輸出。
- 未執行任何 `*:browser` validator；未執行或修改 `check:ee`、`check:visual`；未執行任何 git 寫入指令。

## 做不到因此保留原樣的

無。
