# C-120 簡報正式語體契約

本檔只供簡報製作與 QA 使用，不得複製到投影片可見文字或 speaker notes。

## 適用範圍

- Part A、Part B、Part C 的可見文字與 speaker notes。
- `student_policy.py` 為實際檔名，保留原字串；其他受眾角色名稱不使用。
- 技術名詞、變數與公式依既定字體及斜體規則處理。

## 正文句型

每頁以客觀技術敘述組織：

1. 定義目前物件、輸入或狀態。
2. 說明作用機制與固定條件。
3. 列出操作或觀察位置。
4. 說明輸出的技術意義與證據等級。

命令頁使用「執行」「開啟」「比較」「記錄」等明確動詞，不使用對話式提醒或勸說語氣。

## 禁止出現在 PPTX 的句型

- 對受眾說話：`你`、`請`、`先……才……`、`才談……`、`記得……`。
- 角色稱呼：`學生`、`老師`、`講師`。
- 辯解式對照：`不是舊截圖`、`不代表結果變成……`、`本頁不……`。
- 製作過程：`舊截圖`、`不要縮成截圖`、`只放必要欄位`、`截圖安排`、`版面`、`Fit`、`投影片應放`、`講稿提示`。
- 能力宣告：`能回答`、`能指出`、`能說出`、`可以回答`、`可教`。
- 口語化比喻或結語：`一顆小小的電池`、`完成這堂課`、`談省電`。

## 已指定的正式替換

| 淘汰文字 | 正式教材文字 |
|---|---|
| 先辨認 radio state，才談省電 | Radio state 與停留時間構成 endpoint energy 的狀態積分基礎。 |
| 結果可追溯，不代表結果變成現場量測。 | 資料類型維持 coherent simulated result；provenance 記錄輸入、policy 與輸出的關聯。 |
| baseline 是 control，不是舊截圖 | Baseline：固定情境、隨機種子與原始 policy 的對照執行。 |
| 本頁不推導 live TLE 或衛星量測 | LEO 範例採用預先定義的 changing-service-window trace，作為 endpoint 傳輸時機的輸入。 |

## 正向範圍敘述

- 來源類型直接標示為 `coherent simulated result`、`browser record` 或其他已驗證分類。
- LEO 範圍直接描述為 `changing-service-window trace` 的使用方式。
- Baseline 直接列出固定條件；candidate 直接列出唯一修改項與比較欄位。
- provenance 直接列出所連結的 input、policy、scenario、seed 與 output。
- 缺少 evidence 時使用明確且中性的「待取得 current evidence」，不使用製作端指令或仿造畫面。

## QA

重建前與重建後的 PPTX readback 必須掃描上述禁詞。任何命中均視為失敗；修正 owning source 後重建，不直接修改舊輸出充數。
