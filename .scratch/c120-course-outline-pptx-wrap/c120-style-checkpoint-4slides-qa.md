# C-120 四頁視覺系統 checkpoint QA

狀態：**OWNER-REVIEW／STYLE CHECKPOINT ONLY**

本輪固定為 **4 頁**。Slide 1–2 精確恢復 owner 指定的 UI-skill reference；
Slide 3–4 只在同一視覺語言內調整操作主體。沒有製作其餘 outline 或 full deck。

## 完成輸出

- Builder：`build_c120_style_checkpoint_4slides.cjs`
- Architecture：`c120-style-checkpoint-4slides-architecture.md`
- PPTX：`leo-energy-course-c120-style-checkpoint-4slides-edu.pptx`
- PDF：`leo-energy-course-c120-style-checkpoint-4slides-edu.pdf`
- Renders：`renders-style-checkpoint-4slides/slide-1.png` 至 `slide-4.png`

## 恢復與調整證據

- `normalized-v3.pptx` 確認為指定的 UI-skill reference，SHA-256：
  `e5a592951219266fa3917f771a199801876e5a679013ce66f466f61578403737`。
- Slide 1 final render 與 reference **逐像素相同**：
  `b70463f5bf3fc6ed6b0de6df13e7938497e279a215f2344fd9d5e68e0cc24d5e`。
- Slide 2 final render 與 reference **逐像素相同**：
  `16e724ebbb8f61a99bc3f9b59f9289428936e0ca3e71746a41fbb3939b8d32d8`。
- Slide 3 保留白卡／靛框語法，減少 mission tickets、decision steps 與 evidence 的
  巢狀框；時間線與 freeze gate 成為主體。
- Slide 4 保留三欄 white cards，將 feature rows 收成三組並放大 A／B action 與
  `Score ≠ saving`。
- 背景 author fill unset；無亮橘、深色填色或大面積 pale-surface panel。

## 機械檢查

- `edu` selector：`authoring_contract.ready_for_authoring=true`。
- 模板 SHA-256：`3a90b0106c6587d720b5a46c653a31937ccd649b30890563c70a53c4cc5d25b8`。
- 建置：pptx-wrap managed PptxGenJS runner；直接執行 builder 會 fail closed。
- Builder 在輸出後只修正 `ppt/presentation.xml` 中
  `notesMasterIdLst`／`sldIdLst` 的 ECMA 元素順序。這是本輪確認到會觸發 repair
  風險的具體 OOXML 問題，不改任何 slide content 或 visual geometry。
- 最終 OOXML schema：**All validations PASSED**；ZIP integrity：**PASS**。
- PPTX：**4 slides、0 placeholders**。
- PDF：**4 pages**，頁面尺寸 `960.009 × 540 pt`。
- Renders：**4/4**，每張 `2001 × 1125 px`。
- authored slide fonts：中文 `標楷體`、英文與數字 `Times New Roman`。
- authored 可見文字最小值 **16 pt**；標題 **28 pt**。
- 全文抽取順序：Slide 1 route、Slide 2 TLE-to-NTPU、Slide 3 Lab C、Slide 4
  Evidence clinic；包含 `canonical bit/J`、`Prediction is not saving`、
  `Score ≠ saving`，且沒有使用「偵探」。

## Visual QA 與 fix-and-rerender

1. Pass 1 恢復 UI-skill reference 並重排 Slides 3–4。Fresh reviewer 在原始尺寸檢查
   4 頁，判定無 blocking overflow、overlap、cropping、模板侵入或風格斷裂。
2. 實際發現 Slide 3 recovery 文字換成兩行，以及 Slide 3 `效率`／Slide 4
   `PREDICTION SCORE` 的 lavender 對比可再提高。
3. Fix：擴大 recovery 文字寬度並調為 16.5 pt，使其保持一行；只在 Slides 3–4 新增
   deeper secondary `6557C8`，不改 Slides 1–2 reference 色。
4. Pass 2 全頁 rerender。Fresh reviewer follow-up：Slide 3 recovery 單行且 padding
   正常；secondary contrast 改善；Slides 3–4 無新增 overflow、overlap、cropping、
   弱對比或 style mismatch。結果：**4/4 PASS**。
5. OOXML 順序修正後由最終 PPTX 再輸出 PDF／renders；最終 render 與 pass 2
   Slides 3–4 雜湊相同，沒有 package normalization 造成的 visual drift。

## PowerPoint repair 狀態

- 已定位並修正可重現的 schema error；最終檔通過 OOXML validator，不再保留該錯序。
- 本輪嘗試以 Windows PowerPoint COM 做正常開啟／另存／重開，但 WSL Windows bridge
  回傳 `UtilAcceptVsock: accept4 failed 110`，連簡單 PowerShell probe 也失敗，因此
  **最終檔的 live PowerPoint normal-open 尚未在本輪重驗**，不得宣稱該項 PASS。
- LibreOffice 正常開啟並輸出 4-page PDF；這不等同於 PowerPoint live-open proof。

## Claim boundary 與剩餘 UNKNOWN

- Slide 1–2 的 90／120 route 仍是視覺 donor，不是 current C-120 cadence authority。
- Slide 3–4 只宣稱模擬教學資料、非即時、非量測；沒有新增 simulator、KPI、
  canonical parity、runtime 或 classroom-readiness 證據。
- 未驗證 full-deck density、投影環境、novice timing、20-seat reset／fallback、
  actual control path、withheld replay、browser behavior 或學生操作節奏。
- Windows bridge 恢復後，owner 若要求 delivery-level proof，仍需做一次最終檔的
  PowerPoint normal open／close（`OpenAndRepair=false`）。

## Owner approval gate

Owner 必須決定是否接受下列 full-deck 基準：

1. 以 Slide 1–2 的白卡、深靛大字與少量 header fill 為基準；
2. Slide 3–4 可依活動主體改變構圖，但沿用同一 outline／semantic color grammar；
3. student-facing authored 文字最低實際值 16 pt；
4. 不回到大面積 pale-surface、深色 panel、亮橘 box 或每頁同構 dashboard。

未取得 owner approval 前，不製作其餘頁面。本 checkpoint 到此停止。

## Final hashes

- PPTX：`699763a88db17f88e960510010ce68bd65d6b3919d261651cc1b4addad3770a3`
- PDF：`877635e3458e78e3aafa39894dc3347a212b9fa585558616d7cea76e4085505b`
- Slide 1：`b70463f5bf3fc6ed6b0de6df13e7938497e279a215f2344fd9d5e68e0cc24d5e`
- Slide 2：`16e724ebbb8f61a99bc3f9b59f9289428936e0ca3e71746a41fbb3939b8d32d8`
- Slide 3：`63f64b3b596a0309af0f80df49eebe65b532a1f8f9df371c14d37df1c1a05c86`
- Slide 4：`26cad417bf8faf776dabd7128a5ce8abb946cc4e10741be352fbed218bbe0e28`
