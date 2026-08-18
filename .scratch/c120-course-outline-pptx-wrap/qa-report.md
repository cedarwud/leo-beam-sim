# C-120 Phase 0 outline QA report

Status：**READABILITY-RECALIBRATION / LIGHT-FILL / OWNER-REVIEW**

Scope：**正好 9 頁；Slide 1 為完整課程大綱，Slide 2–9 為八段 overview。本輪已重構全部 9 頁，完成後停止。**

Production／classroom status：**NOT CLASSROOM-READY／NOT FULL-DECK AUTHORIZATION**

## 1. 產物與最終雜湊

- 架構紀錄：`deck-architecture.md`
- Managed PptxGenJS source：`build_c120_outline.cjs`
- PowerPoint：`leo-energy-course-c120-outline-edu.pptx`
- PDF：`leo-energy-course-c120-outline-edu.pdf`
- 原始比例 renders：`renders/slide-1.png` 至 `renders/slide-9.png`

SHA-256：

- 架構紀錄：`8231e1616c1d449654b9fa41e9d01db0bb56862622f0eba2dbe795d89c6d0af2`
- Build source：`f2339b406a0cd3f6d1fbf7bbfa16109a2be5d77fce5660c26fe4e1989d53e04c`
- PPTX：`1ad3caec10415b5cf8950ec2905c6313ad0ab1b315166f8d161f68420b928900`
- PDF：`59ccb2610e048199ed2895ebee1682a111a070b3cf0f2d003035b61df3f6c71e`

## 2. Authority、donor 與範圍邊界

- 五份指定 authority 已完整閱讀；內容 precedence 依 `CURRENT-C120-HANDOFF.md`。ADR-003
  只用於 canonical EE 科學邊界交叉檢查，沒有把課程改成 MODQN、訓練或 ADR 報告，也沒有
  修改 authority repositories。
- archived C-90、conditional E3 與 `src/course/**` 舊語義沒有回流。第一版
  `phase-0-architecture/leo-energy-course-phase0-outline.pptx` 與 `build_phase0.js` 只作**資訊階層、
  視覺節奏與可讀性 donor**；現行 C-120 handoff、issue 11 與 canonical claim boundary 仍決定
  課程內容。
- donor 檢查顯示其可讀性來自「一個大問題＋少數大型視覺群組＋短標籤」，不是靠全頁小字或
  `fit: shrink`。上一版的問題是同一語義被拆進 header、four-part rail、claim dock 與多個 chips，
  造成文字框過多。本輪因此刪除微型資訊層，沒有用縮字解決。
- Slide 2 與 Slide 4 已明確分工：Slide 2 是
  `A／B／C 主張 → mission-contract 可比性 gate → A/Q/R＋信心 → 揭露後改判一次`；Slide 4 是
  `同工作量／同期限／同邊界 → slow/balanced/fast → hidden replay → service／J／bit-J ledger`。
- 模擬資料 ceiling 固定為：「模擬教學資料、非即時、非量測、尚未通過 canonical parity
  驗證。」沒有 simulator screenshot、KPI、量測值或 classroom-readiness claim。
- owner 禁用詞「偵探」在 PPTX 抽取全文中為 **0**；沒有把該詞換成近義角色包裝。

## 3. Template／authoring gate

- `edu` selector 已明確解析，`authoring_contract.ready_for_authoring=true`。
- Template PPTX：`/home/u24/pptx-wrap/assets/templates/educate.pptx`，SHA-256
  `3a90b0106c6587d720b5a46c653a31937ccd649b30890563c70a53c4cc5d25b8`。
- Master module：`/home/u24/pptx-wrap/assets/templates/educate.master.cjs`，export
  `registerEducateTemplate`，SHA-256
  `ba87b88b56236561cf1db4ed4a73438ea9990db13e690895aad10353ed2d09a6`。
- 建置只透過 `/home/u24/.codex/skills/pptx-wrap/scripts/run-pptxgen.sh`；沒有直接執行 builder。
  `pptx-wrap` 提供 master、safe bounds、protected zones、fonts 與 fail-closed gate，不代替作者排版。
- Slide size 為 `13.3333 × 7.5 in`；body safe bounds 為
  `x=0.718057、y=1.05、w=12.286111、bottom=6.627083`。author background 保持 unset；
  edu 白底、logo、divider、footer 與頁碼均保留。
- OOXML title／body placeholder boxes：slides **0**、layouts **0**；slide-number placeholders
  保留為 slides **9**、layouts **2**。
- owner 已明確解除 24 pt author-text floor，但本輪沒有用此授權繼續塞字。PPTX authored text：
  title 28 pt、driving question 22 pt、主操作／證據多為 16–23 pt、次要說明 14.2–16 pt、
  claim labels 13.5 pt、claim values 14.2 pt。
- PPTX author fonts 只出現 `標楷體` 與 `Times New Roman`。

## 4. Readability／light-fill calibration evidence

- 全 9 頁都採「一個 dominant diagram＋兩張大結論卡＋精簡 claim boundary」，不再使用四個窄欄
  learning rail 或大量 10–13 pt chips。
- 每頁字元加權中位字級：Slide 1–2 為 **15.5 pt**；Slide 3–9 為 **16 pt**。
- 每頁最小 authored text 為 **13.5 pt**；低於 14 pt 的字元固定只有 27 個，即 `FACT`、
  `DESIGN INFERENCE`、`UNKNOWN` 三個周邊標籤。沒有學生完成操作所必須依賴的 10–13 pt 文字。
- PPTX slide-owned solid fills 只出現 white／pale 色：共 15 種，最低相對亮度檢查值 **239.7／255**；
  luminance < 180 的 dark authored fills 為 **0**。深色只作文字、外框、線條與箭頭。
- 版面依機制而異：snake route、claim gate、lineage＋legal window、pace／power-time／ledger、
  rule freeze＋withheld replay、recovery chain＋fork、schedule board、timestamp／leakage、
  domain-to-falsifier transfer；不是九頁套同一張卡片模板。

## 5. Final machine QA

| Check | Result |
|---|---|
| OOXML／Office validation | **PASS** — `All validations PASSED!` |
| PPTX pages／order | **PASS** — 9 頁；outline → claim → TLE → Lab A → Lab B → recovery → Lab C → clinic → transfer |
| Cadence | **PASS** — `10 + 8 + 23 + 23 + 5 + 23 + 14 + 14 = 120` 恰好 1 次 |
| Mainline | **PASS** — `energy-first`、`LEO-as-index`、`Energy Decision Workbook` 均可抽取 |
| Required distinctions | **PASS** — W、J、bit/s、bit/J、active time、service pass、freshness、deadline、energy budget 均可抽取 |
| Data ceiling | **PASS** — 完整 ceiling 句可抽取 1 次 |
| Claim boundary | **PASS** — 9 個 `FACT`、9 個 `DESIGN INFERENCE`、9 個 `UNKNOWN` |
| Verdict／禁用詞 | **PASS** — `○ A ○ Q ○ R` 1 次；「偵探」0 次 |
| Placeholder／background | **PASS** — editable title／body placeholders 0；author background 0；slide numbers 9／2 |
| Authored fills | **PASS** — dark-fill count 0；全部 white／pale |
| PPTX author fonts | **PASS** — 只含 `標楷體`、`Times New Roman` |
| PDF | **PASS** — 9 pages；`960.009 × 540 pt` |
| Renders | **PASS** — 正好 9 張 PNG；每張 `2001 × 1125` |
| Fresh visual review | **PASS** — 全 9 頁原尺寸檢查；兩輪局部修正後 final follow-up PASS |

上述 PASS 只代表目前 artifact、結構、原尺寸 render 與本輪可視 QA；不代表 browser、simulator
runtime、教室投影、novice timing 或 classroom acceptance。

## 6. Fix-and-rerender evidence

1. 第一輪 V5 managed build／PDF export／完整 9-page render 後，fresh reviewer 逐頁檢查，回報：
   - Slide 4 `高速後休眠` 的「眠」成孤字；
   - Slide 7 `先做 baseline，再決定哪張先送` 的「送」成孤字；
   - Slide 7 `SERVICE｜FRESHNESS｜J` 的 `J` 被擠到第二行；
   - footer 12.5 pt labels 可讀但可再提高。
2. 不縮字，改以加寬／縮短文案；Slide 2 同步把 verdict 恢復為 source-required `A／Q／R`；
   claim labels 全部提高到 13.5 pt。使用 managed runner 重建 PPTX、重新匯出 9-page PDF、完整
   rerender 9 頁。
3. follow-up reviewer 對 Slide 2、7 回報 PASS，但發現 Slide 4 三列把「時間」拆成「時／間」。
4. 再將三列收斂為 `低 W・長／中 W・中／高 W・短`；中央 23 pt 的 `W × active time → consumed J`
   保留完整概念。再次 managed rebuild、PDF export、完整 rerender 9 頁。
5. final follow-up reviewer 回報 Slide 4 **PASS**：沒有孤字、不自然斷行、overflow、overlap、
   cropping、弱對比或 EDU template boundary 問題。最終結果：**PASS**。

## 7. Remaining UNKNOWN

- 所有未來詳細頁數／活動數量均為**設計估計**，不是 validated classroom timing；完整
  `10+8+23+23+5+23+14+14=120` 尚無 novice walkthrough 或 20-seat rehearsal。
- Cards、fixture、rubric、known-good／counterexample、Trace A／B、withheld fairness 與未見
  domain 素材尚未 authored／validated。
- 尚未證實 learner choice 會改變單一 authoritative simulator state 並驅動 consequential
  replay；browser pixels、keyboard/accessibility、fallback identity 與 canonical parity 未驗證。
- TLE 段尚未在 runtime 證明會真正限制 legal／illegal send-wait interval。
- Issue 11 的 Lab C `6+10+5+2` 在 debrief／revision 分配仍有 authority 張力，需 owner resolution。
- LibreOffice PDF 使用 `DFKaiShu-SB-Estd-BF`、`Liberation Serif`、`WenQuanYi Zen Hei` 與
  `DejaVu Serif` 代換；正式 PDF 是否必須在具有 Times New Roman 的環境重匯出尚未決定。
- 實際教室距離、投影設備與 owner aesthetic acceptance 尚未驗證；本輪機器與 fresh visual PASS
  不等於 owner 接受 full-deck style。

## 8. Owner approval gate before full-deck production

Owner 必須明確決定：

1. 是否接受本輪從第一版 donor 校準出的「大問題＋dominant diagram＋兩張大結論卡」語法，作為
   full-deck production 的視覺基線；
2. 是否接受 white／pale-only authored fills、深色只作文字／線條，以及目前藍綠、紫、低彩珊瑚、
   灰藍的配色；
3. 是否接受 Slide 2 的 comparison-boundary／A-Q-R rejudgment 與 Slide 4 的 same-job hidden
   replay／ledger 分工；
4. full deck 是否採「學生必讀內容 16 pt 以上、supporting text 14 pt 左右、claim labels 13.5 pt」
   作為新 floor；
5. Lab C timing 張力、fixtures／rubric／novice timing 與 simulator evidence 要補到何種程度才可稱為
   120 分鐘課程；
6. 是否接受目前 LibreOffice PDF 字型代換，或指定正式 export 環境。

在 owner 明確批准前，本 checkpoint 維持 **READABILITY-RECALIBRATION / LIGHT-FILL /
OWNER-REVIEW**。本輪沒有擴寫完整課程簡報、沒有修改 simulator／package config／其他 repo，
也沒有 install、server、commit 或 push。
