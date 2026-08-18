# C-120 第一版直接移植｜2 頁 style checkpoint QA

狀態：**OWNER-REVIEW**

日期：2026-08-10（Asia/Taipei）

## 本輪範圍

- 只製作 2 頁獨立 style prototype；沒有擴寫 9 頁或完整課程。
- 直接以 archived 第一版的前 2 頁為版面 donor，僅做白底化、edu 上下界線／logo／footer 保留，以及必要的垂直重排。
- 頁面上的 90／120 分鐘與 TLE-to-NTPU 文字是 **ARCHIVED CONTENT PLACEHOLDER**，只用來判斷版型；不代表現行 C-120 內容或 claim 已核准。
- 既有 9 頁 checkpoint 檔案未被本 prototype 覆寫。

## 問題診斷

結論：問題不在 PptxGenJS 本身，也不是 pptx-wrap 自動把畫面變得枯燥。先前版本失去第一版的精神，主要是 authoring translation 發生四個偏差：

1. 第一版用短句、大字、深色主文字與清楚的視覺焦點；先前版本增加了過多說明句、claim docks 與同權重支援層。
2. 第一版第 2 頁的大卡片接近白色，飽和色只用在 chip、outline、箭頭與少量數字；先前版本把大部分容器都改成不同的低飽和 pastel fill，導致角色不清楚、對比變弱。
3. 第一版使用 `Noto Sans TC Bold`，字面黑度高；edu 規則指定 `標楷體`／`Times New Roman`，相同名義字級的視覺重量會較弱。本 prototype 以更短文字、較大主要字級與更強深色文字補償，但不可能在保留字體規則時做到像素級相同。
4. edu master 將主要可寫高度限制在 `y=1.05–6.627083`。若把原本全頁構圖等比例壓縮，文字就會變小；本 prototype 改成保留物件關係、只重新配置垂直節奏。

pptx-wrap 在本輪實際約束的是 master、safe bounds、protected zones、logo、divider、footer 與字體。先前的「每張都像同一張淡色模板」是內容容器與配色選擇造成，不是 wrapper 強制產生。

PowerPoint 開啟時要求修復的實際原因已重現並分離：不是版面、placeholder、edu master 或 PptxGenJS 繪圖本身，而是建置後用 JSZip 重新封裝整個 PPTX。同一份純 PptxGenJS 輸出可用 Microsoft PowerPoint `OpenAndRepair=false` 正常開啟 2 頁；經 JSZip 重封裝後，PowerPoint 在 unpack 階段回傳 `HRESULT -2147023504`、`UnpackResultHint=7`。現已從 builder 徹底移除 JSZip 重封裝。

## 本 prototype 的視覺規則

- 沒有設定任何 `slide.background`；頁面底色由 edu master 的白色 field 提供。
- 沒有深色填色區塊；大面積內容卡一律白色。
- 深 navy 只用在主要文字與 outline；cyan 是主流程色，muted steel blue 取代亮橘色，violet／green 只作少量角色標記。
- 不使用陰影、漸層、亮橘色 box、滿版深色背景或大量 pastel cards。
- Slide 1 保留第一版的 hero title、衛星／NTPU 圖示、雙路線與單一共同判讀骨架。
- Slide 2 保留第一版的 4 節點 lineage、單一 learner action、2 個 evidence cards 與 2 個底部 callouts。
- 所有 authored 內容都是可編輯 PowerPoint shapes 與 text。
- 中下方很淡的多色暈染是 edu master 的既有 `image1.png` 素材，不是本 builder 加上的頁面背景填色；在保留現行 edu master 的前提下沒有移除。

## Build 與來源

- Archived donor PPTX：`/home/u24/leo-satcom-lab/.scratch/90min-satellite-course/archive/deck/phase-0-architecture/leo-energy-course-phase0-outline.pptx`
- Archived donor builder：`/home/u24/leo-satcom-lab/.scratch/90min-satellite-course/archive/deck/phase-0-architecture/build_phase0.js`
- edu master：`/home/u24/pptx-wrap/assets/templates/educate.master.cjs`
- resolved template SHA-256：`3a90b0106c6587d720b5a46c653a31937ccd649b30890563c70a53c4cc5d25b8`
- Builder：`build_donor_transplant_2slides.cjs`
- Builder 僅透過 `/home/u24/.codex/skills/pptx-wrap/scripts/run-pptxgen.sh` 執行；直接執行 node 會因缺少 managed runtime environment 而停止。
- Builder 現在只產生純 PptxGenJS package，不再使用 JSZip 重封裝；正式檔通過「不修復正常開啟」後，再由 PowerPoint 正常另存並重開一次，並非 OpenAndRepair 流程。

## Fix-and-rerender 紀錄

1. 初始 render 發現 Slide 1 的身份 badge、`TLE→NTPU`、`提取／緩衝` 與 style marker 斷行不佳；Slide 2 evidence／meaning／recovery 文字因楷體寬度出現擠壓與孤行。
2. 第一輪修正：縮短 metadata、調整 route 內距、取消造成孤行的強制換行、縮短 recovery 文句，重新 build／PDF／render。
3. 第二輪修正：使 `TLE→NTPU` 回到單行，並分開 Slide 1 headline／subtitle；Slide 2 recovery 改為平衡兩行，再次重新 build／render。
4. Fresh visual reviewer 指出 `bit/J` caption、`單位`、`不會`、`runtime／browser` 的斷詞；逐項修正並重新 build／render。
5. Follow-up reviewer 指出 `scenario。` 成為第三行孤詞；縮短該 evidence 句後再次重新 build／render。
6. Final follow-up：`PASS`；孤詞已消失，未出現新的 overflow、overlap、cropping 或 template-boundary regression。
7. Owner follow-up：Slide 1 補上 `C-120 LEO 能源決策課程｜Phase 0` 標題；working-title chip 改為淡紫灰底／深紫字；亮橘色全面改為 muted steel blue；hero 與主要數字放大。
8. 修正第一次放大造成的 title/subtitle 與 120 分鐘標籤擠壓後重新 render；fresh reviewer final `PASS`。
9. Owner follow-up：`E3 整段移除`與`核心問題`改為深紫字；`可觀察結果`改為淡紫灰底；所有 authored 可見文字放大至至少 16 pt，並重排節點 chip 與右下 recovery 區。
10. 放大後重新 build／PDF／render；fresh reviewer `PASS`，無 overflow、overlap、cropping 或不自然斷行。
11. 修復提示根因對照：JSZip 重封裝檔在 PowerPoint 正常開啟失敗；純 PptxGenJS 檔在 `OpenAndRepair=false` 下正常開啟。移除重封裝後，正式輸出以 PowerPoint 正常開啟、正常另存、正常重開，全部成功且頁數均為 2。
12. Owner 色彩／間距 follow-up：Slide 1 的 90 分鐘加總式由 cyan 改為 muted steel blue；Slide 2 的「學員動作」改為深紫字，`SOURCE` 改為淺藍灰底／深藍灰字，並加高 `COURSE ASSUMPTION` chip、重排其標題與說明。重新 build／PowerPoint 正常另存與重開／PDF／render 後，fresh reviewer `PASS`。
13. Owner 色彩／置中 follow-up：Slide 1 的「可拔除保留段」、`30` 與 120 分鐘加總式統一改為深紫字，90／120 分鐘 route 各小框改成「數字＋標籤」整組水平／垂直置中；Slide 2 的 `STAGE 1`、`能源／競賽意義`、`復原／狀態`統一改為 muted teal，四個 lineage 大框的 chip、主標與說明皆改為卡片中心對齊。PowerPoint 第一次呼叫在檔案開啟前遇到 WSL vsock 暫時錯誤；唯一一次重試以正常模式開啟、另存及重開成功，2 頁皆未使用修復。重新 PDF／render 後 fresh reviewer `PASS`。
14. Owner 再次要求更換 `STAGE 1` 同組填色。初始嘗試的淡藍灰與 `SOURCE` 太接近，目視後改為淺鼠尾草綠底／深綠字；`STAGE 1`、`能源／競賽意義`、`復原／狀態`三個 chips 同步更新。重新 build／PowerPoint 正常另存與重開／PDF／render 後，fresh reviewer `PASS`，並確認與 `SOURCE` 清楚區分。

## 精確 QA 結果

### 結構與檔案

- PPTX slide count：`2`。
- PDF page count：`2`。
- renders：正好 `2` 張，`slide-1.png` 與 `slide-2.png`。
- render 尺寸：兩張皆為 `2001 × 1125`，16:9 原始頁面比例。
- Office XML validator：`All validations PASSED!`
- Microsoft PowerPoint 正常開啟（`OpenAndRepair=false`）：`PASS`，2 頁；正常另存後重開仍為 2 頁，未使用修復模式。
- authored slide background count：每頁 `0`。
- editable title/body placeholder count：每頁 `0`；由原生無 placeholder master 產生，沒有再刪除 slide/layout XML；頁碼改為普通可編輯文字。
- authored text fonts：只有 `標楷體` 與 `Times New Roman`。
- authored 可見文字最小明示字級：`16 pt`。
- builder 的每個 authored 物件都經 edu title/body safe-bound assertion；未越過 protected zones。

### 全文抽取

- Slide 1 順序包含：working title → hero title → 雙路線 → `10 + 22 + 22 + 18 + 12 + 6 = 90` → `10 + 22 + 22 + 30 + 18 + 12 + 6 = 120` → 共同判讀骨架 → style／claim rail。
- Slide 2 順序包含：TLE-to-NTPU title → driving question → 4-node lineage → learner action → observable result／architecture boundary → meaning／recovery → style／claim rail。
- 兩頁皆明確標示 `STYLE STUDY｜DONOR` 與 `模擬教學｜非即時｜非量測｜未驗證 parity`。

### Final visual inspection

- Slide 1：`PASS`。有明確 course title；working-title chip 為單行淡紫灰；`E3 整段移除`為深紫字；90 分鐘加總式為清楚的 muted steel blue；「可拔除保留段」、`30` 與 120 分鐘加總式為一致的深紫字；90／120 分鐘 route 小框內的數字與標籤皆整組置中。無亮橘色、overflow、overlap、cropping、弱對比或模板越界；route、equations、satellite visual 與單一 backbone 仍保有 donor 的視覺節奏。
- Slide 2：`PASS`。`核心問題`與「學員動作」為深紫字；`SOURCE` 為淺藍灰底／深藍灰字；`STAGE 1`、`能源／競賽意義`、`復原／狀態`皆為同一淺鼠尾草綠底／深綠字，並與 `SOURCE` 清楚區分；四個 lineage 大框的 chip、主標與說明皆在卡片內置中，兩行 `COURSE ASSUMPTION` 未壓框；`可觀察結果`為淡紫灰底。所有 authored 可見文字皆不低於 16 pt；無 overflow、overlap、cropping、弱對比或模板越界。
- Fresh reviewer 總結：在白底、無深色填色與 edu chrome 的限制下，這 2 頁仍能令人辨認為第一版的視覺語言。

### Final artifact hashes

- PPTX：`174af4771bbb625b7bacac817e9862af8ba83e0518695fbca615edaec0b05256`
- PDF：`c5bb0f8d3f7b156ee3d8e2094c0848c12797a2ec06c798d287192278975fd50c`
- Slide 1 render：`a47558f864fac610aaa93752744baf6e8b8fa6f1e851e6835b2b0c2067c57d45`
- Slide 2 render：`edf185dbed7c9f0425df38e36b6c63593b94b1f68644e371051dc7b6b451a24c`

## 剩餘未知事項

- 本輪沒有把現行 C-120 內容重新放回版型，因此尚未驗證 current content 在此風格下需要幾頁或如何拆頁。
- Archived 內容未接受 C-120 科學、課程或 timing review；不得從本 style PASS 推論內容 PASS。
- 已用 Microsoft PowerPoint 完成不修復正常開啟、正常另存與重開；視覺 renders 仍由 LibreOffice 24.2 產生，尚未以 PowerPoint 原生畫面逐頁截圖比對。
- 尚未做投影機、教室後排、真實學生或 120 分鐘課堂可讀性驗證。
- 若 owner 所說的「背景完全無顏色」也包含 edu master 自帶的淡色 motif，則需要另行修改／更換 master authority；本輪沒有擅自改模板。

## Owner approval gate

在 full-deck production 或把 current C-120 內容放回之前，owner 必須明確決定：

1. 是否核准這個「第一版直接移植＋白卡＋少量飽和 accent＋edu chrome」作為後續視覺基準；
2. 是否接受 `標楷體`／`Times New Roman` 與第一版 `Noto Sans TC Bold` 之間不可避免的黑度差；
3. 是否保留 edu master 自帶的淡色 motif；
4. 核准後才另開 current C-120 內容重排；本 checkpoint 在 2 頁停止。
