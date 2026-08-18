# LoRaEnergySim + LEO 簡報：替代 skill 製作入口

Date: 2026-08-11

## 主要內容來源

新簡報以以下三份教學文字稿為主要素材，依序閱讀：

1. `teaching-rewrite/part-a-visible-content.md`：課程目的、環境安裝、Python 3.11、`.venv`、package 操作、policy API 與修改前置。
2. `teaching-rewrite/part-b-visible-content.md`：radio／packet／energy model、Lab A 與 Lab B 的修改、run、result 與 interpretation。
3. `teaching-rewrite/part-c-visible-content.md`：Lab C、網站匯入、endpoint replay、workbook、所有 current `/course` 欄位與按鈕。

這三份是內容草稿，不是可直接複製的定稿。以下契約覆寫其中仍存在的舊語句：

- `teaching-rewrite/formal-language-contract.md`
- `teaching-rewrite/field-explanation-contract.md`
- `teaching-rewrite/venv-platform-contract.md`
- `teaching-rewrite/part-b-field-audit.md`

## 科學與產品權威

遇到內容衝突時，依下列順序裁決：

1. `docs/decisions/ADR-004-c120-course-packaged-loraenergysim-leo.md`
2. `docs/sdd/C120-LORA-LEO-COURSE-INTEGRATION-SDD.md`
3. `docs/handoff/C120-LORA-LEO-NEXT-CONTROLLER-2026-08-10.md`
4. `/home/u24/lora-energy-lab/README.zh-TW.md` 與該 package 的實際 scripts/code
5. 三份 visible-content 草稿

LoRaEnergySim 是「智慧節能與物聯網應用」的直接操作主體；LEO 只提供 changing-service-window 的情境輸入。Endpoint energy、LEO/system energy 與 canonical/system efficiency 不得混用。

## Current `/course` 介面證據

- 欄位與按鈕解釋：`evidence/browser-field-inventory-20260811/field-interpretation.md`
- current evidence：`evidence/browser-live-course-20260811/`
- live route：`http://120.126.151.102:4191/course`

畫面可能持續更新。使用 browser skill 時重新擷取 current screenshot；無 current evidence 時放中性且明示的待補狀態，不得仿造 UI、KPI 或執行結果。

## BeamShift donor

114 頁 donor 不可直接串接或照搬。使用：

1. `donor-analysis/donor-dedup-table.md`：採用／附錄／淘汰裁決。
2. `donor-analysis/donor-insertion-map.md`：P001–P097 穿插位置。
3. `donor-analysis/full-deck-98-116-outline.md`：P098–P116 optional tail。

Donor 只提供概念、敘事或視覺構圖參考；舊按鈕、舊 KPI、舊畫面、舊 session semantics 與 donor master 不得成為 current evidence。

## 模板與版面鎖定

- Template: `/home/u24/ppt-master/template/educate.pptx`
- 所有頁面只使用 source slide 2／`slideLayout2.xml` 的內文 shell。
- source slide 1／`slideLayout1.xml` 是中間有橫線的首頁版型；全 deck 禁用，包括第一頁。
- 保留模板原背景、logo、footer rule 與頁碼；不得另加背景填色。
- 中文字體：標楷體；英文、數字：Times New Roman。
- 標題 28 pt；正文以 24 pt 為基準，內容不足以容納時拆頁。
- 變數與公式斜體；一般文字正體。
- 公式使用 editable native PPTX／Office Math，不使用圖片。
- 禁用亮橘色文字；不得加入分鐘、製作備註或自訂底部說明列。
- 版型須隨內容變化；禁止固定五問框架、重複卡片牆與每頁相同構圖。

## 文字與教學密度

- 不出現 `學生`、`老師`、`講師`、`你`；實際檔名 `student_policy.py` 例外。
- 不使用對話式、勸說式、辯解式或製作端語句；以定義、條件、機制、操作、輸出與判讀構成正文。
- 所有英文欄位、程式常數與縮寫首次出現時，提供中文名稱與完整用途。
- 一頁出現過多欄位時拆頁，不縮小到 24 pt 以下。
- 安裝、`.venv`、run 與 `student_policy.py` 修改均說明作用、原因、機制、預期輸出與結果解讀；呈現形式不固定成同一組卡片。
- 簡報必須支援直接照頁講解與操作；speaker notes 是可直接朗讀的完整敘述，不是備課提示或排版指令。

## 並行工作隔離

目前 A/B/C source 與 builders 可能仍有其他 writer。替代 skill 僅讀取上述來源，不修改既有檔案。

只寫新路徑：

```text
courseware/c120-lora-leo-deck/alt-skill-deck/**
courseware/LoRaEnergySim-LEO-ALT-REVIEW.pptx
```

不 commit、不 push。

## 第一版交付界線

先交付文字完整、版面大致成型的 editable PPTX：

- 可開啟且不觸發修復。
- slideLayout2 only。
- speaker notes 已嵌入。
- donor 穿插頁有來源對照。
- 逐頁 render 可後續補強，但首版不得有明顯溢位、重疊或低於 24 pt 的正文。
