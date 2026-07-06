# P3 mini-SDD — self-check live 重算 chip（＋附錄 B：Jain live 讀 manifest）

> 2026-07-07 由收官前的最強檔 session 定稿：整合點經唯讀 scout 逐點核實（檔案:行號皆實查）、架構決策已做完。**接手者拿到的是執行題**：照施工順序做，碰到 STOP 訊號就停，不需要重新設計。
> 上游：北極星 `docs/handover-simulator-final-plan.md`；本 chip 清償 honesty chip「not yet re-run in-browser」TODO（口試主張的最後一塊：重播結果可在瀏覽器現場重算驗證）。

## 0. 核心架構決策（已裁決，不重開）

**問題**：dense-Q 全量 365MB/arm（9600 行 step-trace），現行瀏覽器載入唯一先例是 `response.text()` 整檔（157MB 天花板，App.tsx:882-889→runtime-fetch.ts:91）；本機是 software-WebGL ~9FPS 的環境，整檔載入大概率 OOM。

**裁決：per-slot 切片＋現場抽算，不做全量瀏覽器重算。**
- 口試主張「你不用信我們，瀏覽器現場重算給你看」——**一個 slot 的現場重算就完整支撐這個主張**（100 UE × 28 action 的 argmax＋整 slot auction，毫秒級）。
- 全量 9600 行的重算證明**已經存在**於 node 層：decode-parity gate 的 shape-2 golden（scripts/validate-modqn-decode-parity.ts:220-246）＋ `scripts/_h2-full-verify.ts`（全窗 acc 驗證器，已入庫）。chip 誠實分工：「本 slot 瀏覽器現算 ✓ ＋ 全窗由 node gate 鎖」。
- 何時會被證明是錯的：若口委要求「全部 9600 行都在我面前的瀏覽器算」——屆時的逃生路線＝背景 Web Worker 逐 slot 掃全窗（切片架構天然支援，只是加個迴圈＋進度條），成本一天內。更無聊的替代案（若連切片都嫌）：chip 只放大 node gate 的結果連結——但那就沒有「現場」了，放棄主張的核心，不建議。

## 1. 目標／非目標

**目標**：focus slot 變化時，瀏覽器用 staged 的 per-slot 切片真重算兩個基準並顯示 match 狀態；HonestyProvenancePanel 的 self-check 段從「not yet re-run in-browser」升級為活證據。
**非目標**：不動 decode 引擎（`src/modqn/decode/` 一字不改）；不動重播輸入 JSON（切片是 build script 的**衍生檔**，原始 step-trace 不動）；不動 DecisionVizPanel 的舊 600-130 路徑（兩代 schema 並存，互不打擾）；不改 decode-parity gate 的舊窗釘點。

## 2. 現況地圖（scout 2026-07-07 實查；改動前先讀這些）

| 東西 | 位置 | 關鍵事實 |
|---|---|---|
| honesty chip 文案 | `src/ui/HonestyProvenancePanel.tsx:163`（`data-testid="provenance-selfcheck"` :152-165） | 硬編碼 "Producer-computed, not yet re-run in-browser (that is slice-3)." |
| chip 資料源 | 同檔 :105-108＋`ReplayArmManifest` type :65-85 | `manifest.selfChecks.{dense_q_proof_green_masked_argmax_eq_selected, auction_redecode_reproduces_serving_and_audit}`；argmax arm 顯 n/a :158-162 |
| manifest fetch | `src/App.tsx:1806-1828` | 由 window URL 換 `manifest.json`，fail-soft null |
| decode 引擎（純 TS） | `src/modqn/decode/auctionDecode.ts:117` `decodeAfPhysicalAuction(v, slotCell, params, {returnAudit})`；`:84` `decodeA0Argmax`；`scalarize.ts:52/:82`；`types.ts:16/:33/:70` | **UI 至今零 import**（codegraph 證實）；橋接＝第一次把它接進 UI |
| argmax 重算先例 | `src/modqn/replay-bundle/denseQProof.ts:193/:319` | 已被 DecisionVizPanel.tsx:4 import；支援新 schema。**缺的只是 auction 側** |
| node 全窗重算原型 | `scripts/_h2-full-verify.ts:34+` | 依 slotIndex 分組→sort userIndex→scalarizeRow→V(100×28)→auction→比 serving+audit。**橋接函式照抄它的組裝順序** |
| dense-Q 資料 | `/tmp/leo-beam-sim/modqn-bundles/h2-dense-ablation-2026-07-04/<arm>/timeline/step-trace.jsonl` | 9600 行（96 slot×100 UE、~41KB/行）；policyDiagnostics 欄位清單見 scout 筆記；`decodeParams{lW:4,kCap:3,gridCount:59,beamsPerSlot:7,shiftToNonneg:true}` |
| 對齊鍵（陷阱） | `scripts/build-h2-scene-payload.mjs:13-14` | **slotIndex 1-based**：scene `frame.tSec`(0..95) ↔ `timeSec`＝tSec ↔ `slotIndex`＝tSec+1；`"ue-N"`==userIndex N；decisionRef=`decision-slot-{slotIndex}-ue-{userIndex}` |
| 瀏覽器靜態服務 | `vite.config.ts:104-255` middleware | **basename allow-list :176-195 現只 4 root**——h2-dense arm 目前 404；無 Range、無 gzip 協商 |
| contract-A 雙基準 | manifest `decouple` 欄＋`replay-state.ts:164/171` | argmax 基準=`pd.selectedActionIndex`；auction 基準=`selectedServing.beamIndex/beamId`＋`auctionAudit{nFallback,openedPerSlot,demandedPerSlot}`；兩者相異 7680/9600（80%）＝解耦 load-bearing，**兩個 chip 兩個基準，不可混** |

## 3. 設計（四件）

**A. 切片生產（build script 擴充）**：`scripts/build-h2-scene-payload.mjs` 加一段：讀 step-trace.jsonl，按 slotIndex 分組輸出 `decode-slices/slot-<k>.json`（k=1..96，每檔＝該 slot 100 rows 的最小欄位集：userIndex、policyDiagnostics{objectiveQByAction, decisionActionValidityMask, objectiveWeights, scalarizedQByAction, selectedActionIndex, slotCell, decodeParams, auctionAudit}、selectedServing{beamId,beamIndex}、timeSec）。估 ~2-4MB/檔 raw；>8MB 即 STOP 重估欄位集。同步把 slices 目錄放進 staged scene 窗旁（與 manifest 同層）＋ vite allow-list 加該 root。**切片是衍生檔**：generator 冪等、輸出含 `sourceTraceSha256` 前 16 碼供對帳。

**B. 橋接模組（新純檔）**：`src/modqn/replay-bundle/slotRedecode.ts`——輸入切片 JSON，輸出 `{argmax: {matches, mismatchUserIndexes}, auction: {servingMatch, auditMatch, mismatchDetail}}`。組裝順序**照抄 `_h2-full-verify.ts`**（sort userIndex→scalarizeRow→vMatrixFromNested(null↔-Inf)→decodeAfPhysicalAuction(returnAudit)）；argmax 側走 denseQProof 同款遮罩 argmax。零 react/three import（維持 decode 純度慣例）。

**C. chip UI**：HonestyProvenancePanel self-check 段升級：focus slot 變化→fetch `decode-slices/slot-<tSec+1>.json`（fail-soft：404 顯「切片未 stage」）→跑 B→顯示「slot N in-browser re-decode: argmax 100/100 ✓ · auction serving+audit ✓」＋累計「本次瀏覽已現算 M slots 全 match」。argmax arm（b1/rss）auction 側顯 n/a（沿用 :158-162 慣例）。**chip 文案是誠實揭露語義**：定稿措辭出給使用者過目（品味凍結不含新文案）。

**D. validators（棘輪）**：①`validate:modqn:slice-integrity`（static、有 ci-data-guard）：抽 3 slot 對帳切片 vs step-trace 原行（值逐欄相等＋rowCount=100×96）；②橋接單元測試 `src/modqn/replay-bundle/slotRedecode.test.ts`＋合成 4-UE 迷你 slot fixture（committed，走 SN-1 後的 static:all 自動發現；**不 commit 真切片**——/tmp 衍生物）；③browser 級：provenance-selfcheck testid 出現「in-browser re-decode」＋match 態（掛 validate:live-render 清單）。

## 4. 施工順序（三個 slice，各自可獨立 commit）

1. **slice-α 資料**：A（builder 擴充＋allow-list＋重 stage 實測 96 檔尺寸）＋D①。驗收：`ls decode-slices | wc -l`=96×4 arm、slice-integrity 綠、瀏覽器可 fetch 單檔 200。
2. **slice-β 橋接**：B＋D②。驗收：單測綠；**node 端交叉驗證**——同一 slot 用 slotRedecode vs `_h2-full-verify.ts` 輸出一致（a2 全 96 slot 掃一次）。
3. **slice-γ UI**：C＋D③。驗收：validate:ready 全綠＋截圖（focus slot 切換 chip 更新）；文案過使用者。

預算：α=S、β=M、γ=M（合計 ~2-4h agent 時）。前置：`node scripts/build-h2-scene-payload.mjs` 重 stage（/tmp reboot 後必做）。

## 5. STOP／換路訊號（碰到就停，帶軌跡上報）

- **auction 重算與 recorded 不 match**（真資料上）：**不准動引擎、不准動資料**——先跑 slice-β 的 node 交叉驗證定位是橋接組裝 bug（十之八九是 sort/1-based/遮罩順序）還是真 mismatch；真 mismatch＝上報使用者（這推翻 producer selfCheck，是研究事件不是前端 bug）。
- 切片單檔 >8MB 或瀏覽器 fetch+parse >2s：停，重估欄位集或改 .gz＋DecompressionStream（新機制，要報備）。
- 需要動 `src/modqn/decode/` 任何一字：停——那是 parity gate 鎖的 vendor 純區。
- chip 需要新 lane 或掛進 scene：不會發生（它是 panel 內容）；若發現自己在動 scene/viz mount，回頭讀 frontend-change-contract。

## 6. 風險對沖表（scout top3 → 設計吸收）

| 風險 | 吸收方式 |
|---|---|
| 365MB 載入無先例 | 架構決策 §0：per-slot 切片（~2-4MB），根本不載全量 |
| slot 對齊 1-based 陷阱 | 對齊鍵寫死在 §2 表＋橋接照抄 node 原型＋slice-β 交叉驗證全 96 slot |
| 兩代 dense-Q schema 漂移 | 新路徑（切片+橋接）只認新 schema；舊 600-130 路徑零接觸；gate 釘點不動 |

## 附錄 B：Jain live 讀 manifest（一頁 spec）

- **現況**：`manifest.selfChecks.fairness_jain_mean` 已存在（HonestyProvenancePanel.tsx:77-84 type 有欄位）；顯示側目前非 live 讀。
- **做法**：顯示 Jain 的 UI 位置改讀 `replayManifest.selfChecks.fairness_jain_mean`（manifest 已在 App.tsx:1806 fetch 進來），旁掛 provenance 標記「from producer manifest」。找顯示點：grep `jain`（大小寫不敏感）於 src/ui＋src/showcase。
- **紅線**：Jain＝diagnostic-only（獎 equal-misery 塌縮），顯示措辭不得把它抬成 win 軸；不在前端重算 Jain（讀 manifest 值，就這樣）。
- **驗收**：顯示值===manifest 欄位值（behavioral validator 一條，併入 coverage-fairness 或新小 validator）；文案含 diagnostic 定位。預算 S。
