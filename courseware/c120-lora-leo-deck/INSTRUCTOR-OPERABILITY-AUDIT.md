# C-120 講師操作可行性盤點

日期：2026-08-11

## 先說結論

目前不能照 108 頁簡報直接教完整 LoRaEnergySim → Leo workflow。runner package
已實際定位且 ZIP hash 已驗證，但 Python 3.11 fresh setup/run 仍是
`USER-REPORTED`；Leo import、endpoint replay 與 browser rehearsal 仍未完成。
這不是講師熟悉度問題，而是 runner、Leo importer 和瀏覽器 evidence 尚未在同一
條可驗證路徑閉合。現有 108 頁版本是 presentation WIP，不能標示為
classroom-ready。

本次已核對的 server/package facts：package 位於
`/home/sat/leo-beam-sim/output/c120-course-package/`；ZIP 以
`ae887f751b93dbcbdb2289b0593fc2ccebed01da05e2e7034db0c24f692bf46e` 為 hash，
在 server 與 scp 到本機 `/tmp` 的副本各自驗證一致。本機核對的副本是
`/tmp/c120-package-audit.1yf6AP/c120-lora-energy-lab-v1.zip`。ZIP 共 65 個
檔案，包含 setup/course scripts、`student_policy.py`、schemas、10 組
fallback result/replay pairs；封裝內 README 也明列 10 個 exact cases。

這些 facts 將 runner 狀態提升為 **RUNNER PACKAGE LOCATED + HASH VERIFIED**，
但不等於 fresh run 已由本 controller 重跑。server 與本機 PATH 都沒有
`python3.11`；server 有 `uv` interpreter path，但本 agent 尚未用它重跑
setup/verify/10 cases，因此 fresh Python 3.11、`READY`、run receipts 仍保留
`USER-REPORTED`。Leo importer/browser 仍是 pending。

目前能由本 repo 直接確認並排演的是既有的 fixture-first C-120 browser route；
它提供瀏覽器中的固定情境、選擇、預測、結果重播與復原，但不是已接通的
LoRaEnergySim→Leo endpoint workflow。以下將 user claim、local evidence、以及
Leo/browser pending 明確分開。

## 證據等級

| 標記 | 意義 |
|---|---|
| `VERIFIED-STATIC` | 由目前 source、script、contract 或測試可直接確認；尚不等於講師已在瀏覽器現場完成一遍。 |
| `VERIFIED-REPO-TEST` | 目前 checkout 的自動化 C-120 測試通過；只證明程式合約與 fixture/replay 行為，不證明 LoRa runner 存在。 |
| `USER-CLAIMED` | owner/user 在本次對話回報的狀態；尚未因而取得本 checkout 的檔案、hash、receipt 或 artifact 證據。 |
| `RUNNER-PACKAGE-HASH-VERIFIED` | server package 已定位；server 與 scp 到本機 `/tmp` 的 ZIP hash 一致，並已核對檔案數與內容類型；不代表 fresh Python run。 |
| `LOCAL-VERIFIED` | controller 在可讀 checkout 內完成 fresh setup、`READY`、case runs、receipts 與 result/artifact 核對；runner 目前尚未達此等級。 |
| `LEO-IMPORT/BROWSER-PENDING` | runner 即使達到 local-verified，也尚未證明 Leo strict import、endpoint replay 與 browser pixels 已接通。 |
| `BROWSER-REHEARSAL-PENDING` | 尚待本次 controller 使用目前瀏覽器重新操作、截圖並記錄實際順序。 |
| `UNFROZEN / PROPOSED` | 只出現在 ADR/SDD 的設計或範例；不可當作現況指令、畫面、receipt 或 KPI。 |
| `MISSING` | 在目前 checkout 找不到實作或 artifact；不能用投影片文字補成已完成。 |

## 目前唯一可跑的 browser fixture 路徑

這是 Leo 前端本身的 fixture 教學路徑，不是 LoRaEnergySim 路徑。

```bash
cd /home/u24/demo/leo-beam-sim
npm install
npm run dev
```

由 README 與 Vite 設定，開發伺服器預設為 `http://localhost:3000`。目前可
使用的入口是：

```text
http://localhost:3000/course/c120
```

靜態 route/contract 證據為 `VERIFIED-STATIC`：

- 預設選用 `C120_FIXTURE_PROVIDER`，provider 為
  `fixture / c120-fixture-provider`，source mode 為 `bundled`。
- contract 為 `c120-fixture-first-v2`；畫面明示
  `SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED /
  NOT CANONICAL-PARITY-VERIFIED`。
- 明確的同情境備用入口是：
  `http://localhost:3000/course/c120?source=fallback`。
  這會選用 `c120-stub-provider`，並把 source mode 標為 `fallback`；它仍然
  是課程 fixture，不是 LoRa runner 產生的結果。
- `npm run test:c120` 於本次盤點通過（含 route、session、TLE import、replay、
  recovery、workbook 與 backend/materializer 測試），標記為
  `VERIFIED-REPO-TEST`。

`BROWSER-REHEARSAL-PENDING`：本文件完成時，尚未把上述入口在目前瀏覽器以
「新 session → 一次互動 → 結果重播 → 存檔/恢復」的順序重新排演並保存新的
browser pixels。因此下表是 source-grounded 操作清單，不是假稱已完成現場
驗收的證明。

## 這條 fixture route 實際能做的事

| 操作段 | 講師目前可以實際示範的互動 | 可觀察結果與復原 | 證據等級 |
|---|---|---|---|
| 資料範圍 | 開啟 claim boundary 與資料組成說明，先區分固定情境、TLE anchor、模型衍生與課程假設 | 畫面保持 simulated teaching data 的 claim ceiling；不能把它說成 live 或 measured | `VERIFIED-STATIC` |
| Claim detective | 選擇主張判斷與信心，選 mission contract，按「凍結契約並揭露證據」，再做一次重判斷；填一個證據連結短答 | 不符合前置條件時，route 會指出尚缺欄位；完成後可鎖定本段 | `VERIFIED-STATIC` |
| TLE anchor | 下載固定的三行 `.tle`，用檔案選擇器匯入；依序開啟三個匯入階段，分類 `SOURCE`、`MODEL-DERIVED`、`COURSE-ASSUMPTION`，並確認能量值來自 versioned replay provider 而非 TLE | provider 不相符的 TLE 會被拒絕；可回看固定 provenance；這不是 LoRa result import | `VERIFIED-STATIC` |
| Lab A | 先執行 reference replay，選 pace/balanced/burst-to-sleep 候選，填 active time、service、bit/J 等方向預測，凍結預測，再執行 frozen candidate | 右側出現 provider-owned replay；可播放、暫停、拖曳 frame、看 evidence/trial ledger；選擇沒有對應 replay 時會被拒絕 | `VERIFIED-STATIC` |
| Lab B | 選 threshold、hold、lower threshold 與規則，先凍結預測，再執行固定的 withheld Trace B | 可比較 mode/服務/能量相關欄位與警告；結果由 fixture replay 提供，不是重新執行 LoRa code | `VERIFIED-STATIC` |
| Recovery | 建立 checkpoint、恢復 checkpoint；開 reset dialog 後可 reset，再用「復原重設」回到 reset 前狀態；也可選明確 fallback route | provider、scenario、units 不相符的存檔會 fail closed；localStorage 會自動保存 session/learner envelope | `VERIFIED-STATIC` |
| Lab C | 在固定的六格 schedule 中選 `WAIT`、`SLEEP`、batch、urgent 等合法動作，先凍結預測並揭露 baseline ledger，再執行一次，修改一次後揭露 held-out event | 非案例中的 schedule 會被拒絕並提供文件化復原安排；可看 card ledger 與 optional counterexample | `VERIFIED-STATIC` |
| Evidence clinic | 將 feature card 分類為 decision-time 可用或 action 後才可見，選 action，凍結 boundary/prediction/action，再執行 chronological replay | 可顯示 leakage 警告、hint ladder 與 alternate action；不代表模型或 endpoint runner 的結果 | `VERIFIED-STATIC` |
| 保存與交接 | 匯出 reopenable workbook JSON，另一次用檔案匯入並重新開啟；查看 checkpoint、進度與 trial ledger | workbook 綁定 provider/scenario/contract/units；錯誤身份不會部分載入 | `VERIFIED-STATIC` |

右側結果畫面只顯示同一份課程 replay 的 frame。講師可以用播放/暫停、上一格、
下一格與滑桿讓全班看事件順序，並展開 evidence ledger 與 trial ledger。這些
互動是現有 fixture route 的能力，不是 LoRa endpoint replay 的證據。

## 最小可排演順序（現在能教的版本）

若 owner 選擇先教現有 route，講師可先照這個順序自己做一遍：

1. 啟動 Vite，開 `/course/c120`，確認頁面上的 simulated-data claim boundary。
2. 從 Claim detective 開始，完成一個 mission contract 與一次證據後重判斷。
3. 在 TLE anchor 匯入 repo 提供的固定三行檔，完成 provenance 分類與 provider
   能量確認。
4. 在 Lab A 執行 reference，做預測，凍結候選並執行一次；播放結果並打開
   ledger。
5. 在 Lab B 或 Lab C 只改一個合法選擇，先預測再 replay，指出 service、state
   time、W、J、bit/J 各自代表的欄位，不把它們合成單一分數。
6. 按「建立存檔點」，重新整理或切換後用「恢復存檔點」；必要時演示 reset、
   undo reset 或明確的 `?source=fallback`。
7. 匯出 workbook，再用同一份 route 匯入，確認身份不符時會拒絕。

這個順序可以教「選擇 → 預測 → fixture replay → 證據 → 復原」；它不能教
「安裝 LoRa runner → 修改 `student_policy.py` → 執行 Python → 產生 result.json
→ 匯入 Leo endpoint replay」。

## Server ownership 與交付邊界

本次 server preflight 另確認：

- `/home/sat/leo-beam-sim` 有 active Codex writer，PID `1731025`，cwd 位於
  該 server repo；preview process 也仍在執行。
- server repo 是 mixed dirty WIP，包含不屬於本 presentation lane 的修改；不能
  用整個 server checkout 的狀態代替本機 deck evidence。
- 因此本 controller 不在 server repo 直接 commit、push、reset、stash 或覆蓋
  dirty WIP。簡報與本盤點留在本機
  `/home/u24/demo/leo-beam-sim/courseware/c120-lora-leo-deck/**`。
- 等 server owner/session 停止或完成窄範圍 checkpoint 後，再由 owner 明確
  handoff runner evidence；在那之前不把 server 的執行宣稱寫成 Leo classroom
  acceptance。

## LoRa workflow 的現況缺口

先把 package facts、fresh-run claim 和 Leo integration 分開。server 與本機
`/tmp` 副本已完成 package/hash 核對：

```text
/home/sat/leo-beam-sim/output/c120-course-package/c120-lora-energy-lab-v1.zip
/home/sat/leo-beam-sim/output/c120-course-package/c120-lora-energy-lab-v1.zip.sha256
/home/sat/leo-beam-sim/courseware/c120-lora-energy-lab/README.zh-TW.md
/tmp/c120-package-audit.1yf6AP/c120-lora-energy-lab-v1.zip
SHA256: ae887f751b93dbcbdb2289b0593fc2ccebed01da05e2e7034db0c24f692bf46e
ZIP inventory: 65 files; setup/course scripts, policy, schemas, 10 fallback pairs
README: 10 exact cases
```

以上 package/hash facts 為 `RUNNER-PACKAGE-HASH-VERIFIED`。但本機
`/home/u24/demo/leo-beam-sim` product checkout 沒有 server package directory；
本 controller 只讀了 scp 到 `/tmp` 的 ZIP，不把 package 複製進簡報 checkout。
fresh Python 3.11 setup、`READY` receipt 與 10 cases 仍是
`USER-REPORTED`：server 與本機 PATH 都沒有 `python3.11`，server 的 `uv`
interpreter path 雖存在，但本 agent 尚未用它重跑。因此不能把 user report 改寫
成 `LOCAL-VERIFIED`。

在目前 checkout 中，下列仍是 `MISSING` 或 `UNFROZEN` 項目：

| 項目 | 現況 | 講師現在可否照做 |
|---|---|---|
| course runner ZIP/release | server package 已定位；server 與 `/tmp` 副本 hash 一致，ZIP 65 files，setup/course scripts、policy、schemas 與 10 fallback pairs 已核對 | package 可交付性已核；fresh run 仍待驗證；`RUNNER-PACKAGE-HASH-VERIFIED` |
| `student_policy.py` | ZIP 內實際存在 `student_policy.py` 與 `student_policy.baseline.py`，並有三組 marked blocks；尚未由本 agent 執行 policy guard/run | 可讀但不可宣稱已跑；`RUNNER-PACKAGE-HASH-VERIFIED / FRESH-RUN PENDING` |
| schemas 與 fallback artifacts | ZIP 內有 scenario/result/endpoint-replay/freeze schemas，及 10 組 fallback result/replay pairs；這不是 Leo importer 已接通 | 可作 package-side fallback input；`RUNNER-PACKAGE-HASH-VERIFIED` |
| `contracts/c120-lora-v1/**` | Leo product checkout 的 controller-owned shared contract path 尚不存在；package schemas 不等於 Leo integration | 不可；`UNFROZEN / MISSING IN LEO` |
| baseline/candidate/withheld run | README 列 10 cases；fresh Python 3.11、`READY`、10 run receipts 仍只有 user report，server/local 都未由本 agent 重跑 | 不可先當 current run evidence；`USER-REPORTED / FRESH-RUN PENDING` |
| Leo LoRa importer | `src/course/c120/loraEnergySim/**` 尚不存在；沒有 schema/unit/hash/provenance fail-closed import | 不可；`MISSING` |
| endpoint replay/workbook adapter | `src/course/c120/loraIntegration/**` 尚不存在；目前只有 fixture-first system replay/workbook v2 | 不可；`MISSING` |
| endpoint browser pixels/KPI | 沒有 current endpoint replay screenshots、endpoint energy artifact 或 consequential evidence | 不可；`LEO-IMPORT/BROWSER-PENDING` |

所以目前最準確的敘述是：**runner package 已定位且 hash verified；fresh
Python 3.11 run 仍是 user-reported；Leo importer、endpoint replay、browser
pixels 與 endpoint KPI 仍未驗證。** package 已不是「不存在」，但完整課堂路徑
仍未通過。

## 不可把 commands 當成已執行

SDD 的命令曾是 `UNFROZEN / PROPOSED`；現在 package README 已在 ZIP 內核對到
對應的 exact command 文字，但它們只有 `PACKAGE-CONTENT-VERIFIED`，不是本
controller 的 fresh-run evidence。課堂不能把「README 有寫」說成「講師已跑過」：

```text
PYTHON_BIN=python3.11 bash setup.sh
bash course.sh verify
bash course.sh run --lab A --case baseline
bash course.sh run --lab A --case candidate --freeze
bash course.sh run --lab A --case hidden
bash course.sh run --lab B --case trace-a-baseline
bash course.sh run --lab B --case trace-a-candidate --freeze
bash course.sh run --lab B --case trace-b
bash course.sh run --lab C --case baseline
bash course.sh run --lab C --case candidate
bash course.sh run --lab C --case revision --freeze
bash course.sh run --lab C --case surprise
```

以上 exact cases 和 10 個 labels 已由 README/package inventory 核對；
`READY`、每個 run receipt、`result.json`/`endpoint-replay.json` 和 policy
consequential diff 仍待 fresh run。package README 的 `uv python install 3.11`
是 recovery option，不是本 agent 已完成的 setup。Leo README 的「匯入結果」
仍須等 importer/UI/browser 證據，不能因 package hash verified 就宣稱可匯入。

目前 repo 的 `npm install` 與 `npm run dev` 只負責啟動 Leo 前端；它們不會
安裝或驗證 LoRaEnergySim，也不會產生 `result.json`。同樣地，目前 UI 的
「匯入並重新開啟學習單」是 C-120 workbook import，不能改稱為 LoRa result
import。任何投影片、speaker notes 或講師口述若把 proposed command 說成已
存在，都會讓講師在第一個操作點卡住，並且把缺少的 evidence 偽裝成教學結果。

## runner 與 Leo 的待驗證清單

package 定位與 hash 核對已完成；其餘 gate 仍需逐項完成，現在不能把它寫成
完整授課步驟：

1. **已完成：package identity。** server ZIP 與 scp 到本機 `/tmp` 的副本以
   `sha256sum` 得到相同的
   `ae887f751b93dbcbdb2289b0593fc2ccebed01da05e2e7034db0c24f692bf46e`。
2. **已完成：archive inventory。** `unzip -l` 顯示 65 files；可見 setup/course
   scripts、`student_policy.py`、schemas、runner code、README 與 10 組 fallback
   result/replay pairs；README 明列 10 exact cases。
3. **待重跑：fresh setup。** server 與本機 PATH 均沒有 `python3.11`；server
   有 `uv` interpreter path，但本 agent 尚未用它建立 venv、執行 setup、保存
   `artifacts/verify-receipt.json` 並跑 `course.sh verify`。目前只能保留
   `USER-REPORTED` 的 Python 3.11/`READY` claim。
4. **待重跑：10 cases。** 需保存 run ID、scenario/hash、seed、policy hash、
   result JSON、endpoint replay、freeze receipts 與 byte-stability comparison；
   也要確認 policy 改動真的改變 packet/service/endpoint-energy evidence。
5. **待整合：Leo strict importer。** 將同一 result artifact 匯入 Leo，驗證
   identity/unit/schema/seed/policy/provenance mismatch fail closed，再取得
   endpoint replay、workbook record 與 browser pixels。

在第 3–4 步通過前，runner 仍是 `RUNNER-PACKAGE-HASH-VERIFIED + USER-REPORTED
FRESH-RUN`；第 5 步未通過前，整條 LoRa-to-Leo 課堂路徑仍是
`LEO-IMPORT/BROWSER-PENDING`。

## 每個現有操作的 Do / Why / Mechanism / Expect / Interpret

目前只有 fixture route 的操作可以完整寫成可排演版本：

| Do | Why | Mechanism | Expect | Interpret |
|---|---|---|---|---|
| `npm install` | 取得 Leo 前端依賴 | npm 依 package lock/manifest 安裝本 repo 的 Node 依賴 | 之後可以啟動前端 | 失敗是本地前端環境問題，不是節能 evidence |
| `npm run dev` | 讓講師進入課程 route | Vite 在本機提供 React/C-120 route | `localhost:3000` 可載入 `/course/c120` | bootstrap 失敗就先 reload 或使用明確 fallback，不要補寫 LoRa 數字 |
| 核對 server ZIP 與 `/tmp` copy | 判斷 runner release identity 是否一致 | `sha256sum`、65-file inventory、README/case/fallback/schema 檢查 | `RUNNER-PACKAGE-HASH-VERIFIED` | 這只證明封裝內容；沒有 fresh Python run receipt 就不能說 runner 已由本 controller 執行 |
| fresh setup/verify/run | 確認講師真的能重現 runner | Python 3.11 venv、lock、policy guard、10 exact cases、receipt/artifact | `LOCAL-VERIFIED` runner | 目前 `python3.11` 不在兩端 PATH；server `uv` path 尚未由本 agent 使用，故仍是 `USER-REPORTED` |
| 開 `/course/c120` | 固定同一 scenario，讓選擇可重播 | route 綁定 `c120-fixture-provider` 與 provider-owned replay | 顯示 claim boundary、課程段落與初始情境 | 所有數值是 simulated fixture；不是 live/measured/canonical parity |
| 完成選擇後按 replay | 觀察決策的可見後果 | route 以既有 replay input 查找同情境 fixture result，再播放 frame | 右側畫面、ledger、service/W/J/bit/J 等欄位一起更新 | 解讀事件鏈與欄位邊界；不要宣稱執行了 Python |
| 建立/恢復 checkpoint 或匯出/匯入 workbook | 保留可繼續的教學狀態 | session、learner envelope 與 workbook 以 provider/scenario/units 驗證 | 正確身份可恢復；不符身份 fail closed | 這是 route recovery，不是 runner artifact import |
| 開 `?source=fallback` | 在同情境下保護課程主線 | route 明確切換 `c120-stub-provider`，保留 fallback provenance | fallback route 可重新開始或繼續其 provider 狀態 | fallback 是 fixture recovery，不是 LoRa run 成功 |

## Route A / Route B：需要 owner 決定的事

### Route A：現在就把簡報改成 fixture-first 課程

若 owner 選 A，簡報可以直接教目前 `/course/c120` 的選擇、預測、replay、
ledger、checkpoint、workbook 與 fallback。必須從課程承諾中移除：

- LoRaEnergySim 安裝與環境驗證；
- `student_policy.py` 編輯；
- Python baseline/candidate/withheld run；
- `result.json` 匯入與 endpoint replay；
- 尚不存在的 endpoint energy KPI。

在標成可上課前，仍要完成一次講師瀏覽器 fresh-session 排演，記錄實際 click
order、錯誤復原與新的 browser pixels；目前這個 gate 仍是
`BROWSER-REHEARSAL-PENDING`。

### Route B：保留 owner 指定的 LoRaEnergySim edit/run/import 課程

若 owner 選 B，先停止把 deck 當成操作說明，依 ADR-004、SDD 與 handoff 完成
下列驗證與整合 gate。user-claimed runner 可作為候選輸入，但不能跳過 local
verification：

1. **已完成 package 核對：** runner archive 已定位，server 與 `/tmp` copy 的
   hash 一致；ZIP inventory、README 10 cases、schemas、policy 與 fallback pairs
   已核對。仍需由 owner/session 凍結 package/release、Python/dependency lock、
   scenario/result/event/freeze schemas、seed、identity/hash lineage 與
   endpoint-energy boundary。
2. 由 controller 或 owner session 重跑可冷啟動 runner、`student_policy.py`、
   setup/verify/run commands、baseline/candidate/withheld/fallback artifacts
   與 deterministic receipts。完成後才可將目前的 fresh-run user report 提升為
   `LOCAL-VERIFIED`。
3. 交付或核對 Leo strict importer、endpoint replay、workbook adapter，以及 identity、
   unit、schema、seed、policy hash、provenance mismatch 的 fail-closed tests。
4. 以講師 fresh environment 實際走過 install → edit → run → import → replay →
   recover，保存 browser pixels 與可核對的 endpoint evidence。
5. 只有在上述 evidence freeze 後，才重做完整 classroom deck 與 speaker notes；
   每個 setup command 和 policy edit 才能填入真正的 Do / Why / Mechanism /
   Expect / Interpret。

這個選擇需要 owner 對 implementation lane 與 contract freeze 的明確授權；
presentation work 本身無法替 Route B 補出 runner 或 evidence。

## 目前的可教性判定

`NOT CLASSROOM-READY — RUNNER PACKAGE LOCATED + HASH VERIFIED; FRESH RUN USER-REPORTED; LEO IMPORT/BROWSER PENDING`

目前講師可以先排演既有 fixture route 的 browser lesson，但不能誠實地說自己
已經能照 108 頁教完整 LoRa workflow：runner package 的 archive/hash 已核驗，
但 fresh Python 3.11 setup/run 仍是 user report，Leo importer、endpoint replay
與 browser rehearsal 仍未完成。先由 owner 選 Route A 或 Route B，再決定要重寫
成現有可跑課程，或讓 owner/session 完成 fresh runner、importer/replay/evidence
freeze。

## 依據

- `courseware/c120-lora-leo-deck/CLASSROOM-READINESS.md`
- `courseware/c120-lora-leo-deck/evidence-freeze-matrix.md`
- `docs/decisions/ADR-004-c120-course-packaged-loraenergysim-leo.md`
- `docs/sdd/C120-LORA-LEO-COURSE-INTEGRATION-SDD.md`
- `docs/handoff/C120-LORA-LEO-NEXT-CONTROLLER-2026-08-10.md`
- `src/course/c120/C120CourseRoute.tsx`
- `src/course/c120/contract.ts`
- `src/course/c120/fixtures.ts`
- server runner package：`/home/sat/leo-beam-sim/output/c120-course-package/c120-lora-energy-lab-v1.zip`
- local hash-verified copy：`/tmp/c120-package-audit.1yf6AP/c120-lora-energy-lab-v1.zip`
- 本次驗證：`npm run test:c120`（PASS）
