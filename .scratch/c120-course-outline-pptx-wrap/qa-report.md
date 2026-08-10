# C-120 Phase 0 outline QA report

Status：**OWNER-REVIEW**

Scope：**正好 9 頁；Phase 0 outline checkpoint only**

Production／classroom status：**NOT CLASSROOM-READY／NOT FULL-DECK AUTHORIZATION**

## 1. 產物與最終雜湊

- 架構紀錄：`deck-architecture.md`
- Managed PptxGenJS source：`build_c120_outline.cjs`
- PowerPoint：`leo-energy-course-c120-outline-edu.pptx`
- PDF：`leo-energy-course-c120-outline-edu.pdf`
- 原始比例 renders：`renders/slide-1.png` 至 `renders/slide-9.png`

SHA-256：

- 架構紀錄：`7ad2161faf646d3cff0b62b2e1744f65e5dcc8039be050df3f20dbc29a11252b`
- Build source：`e85e5866ad73232c7d37554f067703c95467963e94f0adb1ac6bbaf2be1dd5cb`
- PPTX：`cbca96575afba56b35725cf9593008f699f2d00c36bde5f055de25f11d7f6c51`
- PDF：`9ad18b3dcf75665aeeafbe3cbae3f267a16bc9fb761fdee97af989ecf5480ea1`

## 2. Authority、語義與視覺來源邊界

- 五份指定 authority 已完整閱讀；內容 precedence 依 `CURRENT-C120-HANDOFF.md`。ADR-003
  僅用於 canonical EE 邊界交叉檢查，沒有把課程改成 MODQN、訓練或 ADR 報告，也未修改
  authority repositories。
- archived C-90、conditional E3 與 `src/course/**` 的舊課程語義沒有被當成 C-120 authority。
  找到的第一版 `leo-energy-course-phase0-outline.pptx` builder／renders 只作**視覺語法 donor**：借用
  route、decision board、local hub、replay trace 與 task-card 的構圖感，不帶回 90 分鐘路線、舊 E3
  或其他 C-90 claim。
- 原始 authority 提供 pace、dynamic policy、budgeted schedule、evidence clinic 與 transfer 骨架；
  可以構成 120 分鐘的**設計**，但 engagement、active time、fixture fairness 與 classroom timing
  尚無實證。先前 outline 偏弱主要是內容轉譯與重複版面，不是已證明原始文件本身失效。
- 第 2 頁與 Lab A 已分工：第 2 頁是
  `mission contract → claim reveal → A/Q/R＋confidence → one rejudgment`；Lab A 是
  `同工／同期限／同邊界 → 三種節奏 → hidden-condition replay → service／J evidence`。
- 模擬資料 ceiling 固定為：「模擬教學資料、非即時、非量測、尚未通過 canonical parity
  驗證。」沒有 simulator screenshot、KPI、量測值或 classroom-readiness claim。

## 3. Template／authoring gate

- `edu` selector 已明確解析，`authoring_contract.ready_for_authoring=true`。
- Master：`/home/u24/pptx-wrap/assets/templates/educate.master.cjs`；export：
  `registerEducateTemplate`；master SHA-256：
  `3a90b0106c6587d720b5a46c653a31937ccd649b30890563c70a53c4cc5d25b8`。
- Source 明確使用 PptxGenJS；建置只透過
  `/home/u24/.codex/skills/pptx-wrap/scripts/run-pptxgen.sh`，並在 managed runtime 之外 fail closed。
  `pptx-wrap` 只提供 master、safe bounds、protected zones、fonts 與結構 gate；版面同質化並非
  PptxGenJS 或 wrapper 的必然結果。
- Slide size 為 `13.3333 × 7.5 in`；body safe bounds 為
  `x=0.718057、y=1.05、w=12.286111、bottom=6.627083`。背景保持 unset；edu 白底、logo、
  divider、footer 與頁碼保留。沒有亮橘色 box 或滿版深色背景。
- Owner 已明確解除本次 24 pt 文字下限。標題維持 28 pt；最小明示字級為 9.3 pt，僅用於
  Lab A 的四個短 ledger 標籤；三欄 claim rail 為 10.6 pt。Fresh reviewer 在原尺寸 render
  判為可讀，但這不等同投影或課堂驗證，仍列 owner gate。
- PPTX author text typefaces 只出現 `標楷體` 與 `Times New Roman`。LibreOffice PDF export
  另出現 `DFKaiShu-SB-Estd-BF`、`Liberation Serif`、`WenQuanYi Zen Hei` 與 `DejaVu Serif`
  代換；正式 export 環境待 owner 決定。
- OOXML 已移除所有 editable title／body placeholder boxes：slide 與 layout 計數皆為 0；
  slide-number placeholders 保留為 slides 9、layouts 2。

## 4. Final machine QA

| Check | Result |
|---|---|
| OOXML／Office validation | **PASS** — `All validations PASSED!` |
| PPTX pages／order | **PASS** — 9 頁；outline → claim → TLE → Lab A → Lab B → recovery → Lab C → clinic → transfer |
| Cadence | **PASS** — `10 + 8 + 23 + 23 + 5 + 23 + 14 + 14 = 120` |
| Mainline | **PASS** — `energy-first → LEO-as-index → 同一份 Energy Decision Workbook` |
| Required distinctions | **PASS** — W、J、bit/s、bit/J、active time、service_pass、freshness、deadline、energy budget 均可抽取且未互相代換 |
| Data ceiling | **PASS** — 完整 ceiling 句可抽取 |
| Claim boundary | **PASS** — 9 個 `FACT`、9 個 `DESIGN INFERENCE`、9 個 `UNKNOWN` |
| Prohibited wording／style | **PASS** — 「偵探」、`F4B942`、`slide.background` 與背景 assignment 均為 0 match |
| Placeholder／background | **PASS** — title／body placeholders 0；slide-number 9／2；9 個 slide XML 無 author background |
| PPTX author fonts | **PASS** — 只含 `標楷體`、`Times New Roman`；PDF substitution 另列 owner gate |
| PDF | **PASS** — 9 pages；`960.009 × 540 pt` |
| Renders | **PASS** — 正好 9 張 PNG；每張 `2001 × 1125` |

全文抽取確認 9 頁標題與順序。上述 PASS 只代表目前 artifact、結構與原尺寸 render；不代表
browser、simulator runtime、投影可讀性或 classroom acceptance。

## 5. Fix-and-rerender evidence

所有循環皆重新用 managed runner 建置 PPTX、LibreOffice 匯出 PDF，並 render 全部 9 頁：

1. 依 owner 意見，放棄把全頁構圖壓入 edu 中間安全區；九頁改為 middle-canvas-first，每頁採
   不同 dominant diagram，並用淺色 route、decision board、replay、ledger 與 task board 恢復
   第一版的活動感。
2. 第一輪 fresh review 發現第 2 頁 `INCOMPARABLE` 遮擋、第 4 頁 `SERVICE` 換行、第 5 頁
   `J` 孤字及 claim rail 缺漏；已修正欄位、gate、ledger 與 claim rail，完整重建重 render。
3. 第二輪發現第 2 頁最後 mission-contract 欄位被 gate 壓住，以及第 4／5／6／8／9 頁
   claim 文案斷行；已移動欄位／gate，改成每欄一個可編輯段落，重新分配欄寬，完整重建重 render。
4. 第三輪只剩第 1 頁「驗證」與第 7 頁「待核」成孤字；改為「120 分鐘待實證」與「時序待核」，
   沒有再縮字，並再次完整重建、PDF export 與 9-page rerender。
5. Final fresh reviewer 逐頁重新開啟最新 renders：**FINAL PASS — slides 1–9**。第 1、7 頁孤字
   已消失；第 2 頁最後 mission-contract 欄位與 COMPARABLE gate 清楚；未見 overflow、overlap、
   cropping、弱對比或 template protected-zone 問題。

## 6. Remaining UNKNOWN

- 所有未來詳細頁數／活動數量均為**設計估計**，不是 validated classroom timing。
- `10+8+23+23+5+23+14+14=120` 尚無 3–5 位 novice walkthrough 或 20-seat rehearsal。
- Cards、fixture、rubric、known-good／counterexample、Trace A／B、withheld fairness 與未見
  domain 素材尚未 authored／validated。
- 尚未證實 learner choice 會改變單一 authoritative simulator state 並驅動 consequential
  replay；browser pixels、keyboard/accessibility、fallback identity 與 canonical parity 未驗證。
- TLE 段尚未在 runtime 證明會真正限制 legal／illegal send-wait interval。
- Issue 11 的 Lab C `6+10+5+2` 有語義張力：表格把 5 分鐘稱為 debrief，詳細 storyboard
  則把 5 分鐘用於 revision／withheld、2 分鐘用於 debrief。本 outline 採後者，仍需 owner
  resolution，不是 FACT。
- 9.3 pt ledger 標籤與 10.6 pt claim rail 尚未經實際教室投影驗證。
- 正式 PDF 是否必須在具有 Times New Roman 的環境重匯出尚未決定。

## 7. Owner approval gate before full-deck production

Owner 必須明確決定：

1. 是否接受目前 original-inspired、middle-canvas-first 的淺色視覺語法、palette 與小型 local
   navy hubs；
2. 是否接受 9.3 pt 短 ledger 標籤與 10.6 pt claim rail，或先縮短文案／重排再進 full deck；
3. 是否接受 mission-contract／Workbook 主線，以及第 2 頁與 Lab A 的角色分工；
4. 是否接受 Lab B 的 `link choice → active time／service → J` boundary 與 switch-count wording；
5. 是否把 Lab C `6+10+5+2` resolution 回寫 authority；
6. 是否接受 clinic one-coherent-case 與 transfer artifact 的形狀；
7. authored fixtures／rubric／novice timing 要補到何種程度才授權 full-deck production；
8. 是否接受目前 LibreOffice PDF 字型代換，或指定正式 export 環境。

在 owner 明確批准前，本 checkpoint 維持 **OWNER-REVIEW**。沒有擴寫完整課程簡報、沒有修改
simulator／package config／其他 repo，也沒有 commit 或 push。
