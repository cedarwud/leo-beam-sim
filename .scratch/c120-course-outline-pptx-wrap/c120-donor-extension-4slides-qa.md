# SUPERSEDED／DO NOT USE

此紀錄對應的 `leo-energy-course-donor-extension-4slides-edu.pptx` 已被 owner 實際開啟結果否決。後續 forensics 發現 Slides 3–4 各有重複的 `p:cNvPr id="25"`，可能觸發 PowerPoint 修復；原本的 `Open2007(..., OpenAndRepair=false)` 隱藏開啟不能作為無修復證據。

目前唯一候選改為 `leo-energy-course-c120-style-test-4slides-owner-review.pptx`，其 QA 記錄為 `c120-style-test-4slides-owner-review-qa.md`。

# C-120 donor extension｜4 頁風格測試 QA（歷史、失效）

狀態：`OWNER-REVIEW / STYLE TEST`

## 範圍

- 本 checkpoint 只有 4 頁：已接受 donor 前 2 頁，加上 Lab A 與 Evidence clinic 各 1 頁。
- 這不是 9 頁 Phase 0 outline，也不是完整課程簡報；完成本測試後停止延伸。
- Slides 1–2 僅作為視覺 donor 與套版基準，其內容尚未視為目前 C-120 的 owner-approved 課程內容。

## 輸出

- `leo-energy-course-donor-extension-4slides-edu.pptx`
- `leo-energy-course-donor-extension-4slides-edu.pdf`
- `renders-donor-extension-4slides/slide-1.png` 至 `slide-4.png`
- `build_c120_donor_extension_content.cjs`
- `merge_donor_extension.py`

## 製作邊界

- 以 `pptx-wrap` 明確解析 `edu`，使用 managed PptxGenJS runner 產生 Slides 3–4；沒有直接執行 Node builder。
- Slides 1–2 與 edu template package 保留為 donor authority；以限縮 OOXML append 加入 Slides 3–4，沒有用會重寫整包的 round-trip editor 儲存最終檔。
- 背景保持白色／unset；保留 edu logo、標題 divider、footer 與安全邊界。
- 沒有亮橘色或深色大面積填色；新增內容使用可編輯 shapes、文字與簡單流程。
- 依 owner 明確授權「可以不用遵守字體大小的下限」處理，但本次 4 頁實際最低字級仍為 16 pt。
- Slides 1–4 均不含 PowerPoint placeholder。

## 完成證據

### Package 與開啟

- PPTX SHA-256：`89367f4b3223c0d428471cacc99b8af2de5322f4de26e0103a80b4b6176e2924`
- PDF SHA-256：`3a550ae2963794222be25e2ad4b62c01c28fab8cefaf1ed69da1331b65762cfc`
- Office OOXML validator：全部通過；0 個新增 XSD error、0 個缺漏 relationship、0 個缺漏 content type override。
- `python-pptx` 唯讀開啟：4 slides、2 layouts、1 master；4 頁皆使用 `PPTX_WRAP_EDUCATE_CONTENT_NO_PLACEHOLDERS`。
- Microsoft PowerPoint 實際開啟：`POWERPOINT_OPEN_OK slides=4`，呼叫 `Open2007(..., OpenAndRepair=false)` 成功，未要求修復。
- Donor 保留：final 的 `slide1.xml`、`slide2.xml`、`slideMaster1.xml` 與接受版逐 byte 相同。

### 頁數、文字與 render

- PPTX：4 頁。
- PDF：4 頁，頁面尺寸 `960.009 × 540 pt`。
- 最新 render：正好 4 張，每張 `2001 × 1125 px`，完整 16:9 頁面。
- Slides 1–2 render SHA-256 與接受版完全相同：
  - Slide 1：`a47558f864fac610aaa93752744baf6e8b8fa6f1e851e6835b2b0c2067c57d45`
  - Slide 2：`edf185dbed7c9f0425df38e36b6c63593b94b1f68644e371051dc7b6b451a24c`
- 新增 render：
  - Slide 3：`df552defd4d2733a8cfe29dd1b4a7672555561dc03d24d3f46173c53b6606b7e`
  - Slide 4：`64387602746f8c605657133f2c20c7366c037668c2e5dfb7db3a55b1db6b5971`
- 全文抽取確認順序為 donor slides 1–2、Lab A、Evidence clinic；Slide 3 保留 `active time`，Slide 4 保留 `prediction → action → service → J → bounded claim`。
- 4 頁 placeholder 數量均為 0；4 頁實際最低文字大小均為 16 pt。

## Fix-and-rerender 紀錄

1. 初次延伸後修正重複頁碼、BALANCED/status 斷行與操作區過密，再重新輸出 PPTX、PDF 與全部 renders。
2. Fresh visual review 找到 deadline 斷行、學生操作斷行、底部 verdict／causal chain 斷裂、evidence wording 過強與 chip 對比偏弱；逐項修正後再次完整 rerender。
3. 最後語意複查發現 `active time` 與 `prediction` 被過度刪減；恢復兩者、移除殘留 placeholder、重建並完整 rerender。
4. 最終 fresh reviewer 結果：`PASS`。Slides 3–4 未見 overflow、overlap、cropping、不可讀文字、配色阻斷或模板保護區侵入；claim boundary 清楚。

## 剩餘未知事項

- 這 4 頁是否足以成為 `edu + donor` 的可重用風格候選，仍需 owner 視覺接受；不應直接鎖成唯一視覺基準。
- Slides 1–2 目前是 donor 參照內容；若進入正式 C-120 production，仍需依最新課程 authority 重寫，而不是直接沿用其 C-90 語意。
- Lab A 的 23 分鐘與 Evidence clinic 的 14 分鐘均為設計估計，尚未以 novice classroom timing 驗證。
- 所有資料仍是模擬教學資料、非即時、非量測，尚未通過 canonical parity 驗證。

## Owner approval gate

請 owner 先判定 Slides 3–4 是否成功延伸前 2 頁的精神、密度與淺色視覺語言。只有取得此 style-extension approval 後，才可另開工作把它整理成 `pptx-wrap + edu` 的非預設風格候選，或用於後續 9 頁／full-deck production。
