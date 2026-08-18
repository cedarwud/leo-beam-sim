# C-120 四頁視覺系統 checkpoint

狀態：**OWNER-REVIEW／STYLE CHECKPOINT ONLY**

範圍固定為 **4 頁**：恢復已接受的兩頁 UI-skill reference，並只調整
`Lab C — Spend the joules` 與 `Evidence clinic — Prediction is not saving`。
本輪不製作其餘 outline 或 full deck。

## Authority 與 claim boundary

- 課程內容：`CURRENT-C120-HANDOFF.md` 與 issue 11 的
  `C-120-ENERGY-DECISION-1R`。
- 競賽 framing：`/home/u24/papers/platform/intro.md`。
- EE 科學邊界：`angle-aware-ee-v1/README.md`；ADR-003 只作 canonical closure
  交叉檢查，不把頁面改成 MODQN、訓練或公式報告。
- 唯一 headline metric：同一 time domain／boundary 下的
  `delivered bits / consumed J`。`service_pass`、freshness、deadline、consumed J、
  budget remaining、delivered bits、W、active time 與 bit/J 分開呈現。
- 新活動頁只宣稱模擬教學資料、非即時、非量測、尚未通過 canonical parity 與
  classroom timing 驗證；不製造數值、KPI、runtime 或 classroom-readiness 證據。

## Slide roles

### Slide 1｜UI-skill reference hero／route

逐像素恢復 `normalized-v3` 的白底、深靛大字、白卡彩色外框與判讀骨架。
90／120 route 是 donor style study，不是 current C-120 cadence authority。

### Slide 2｜UI-skill reference lineage

逐像素恢復 `normalized-v3` 的四個 lineage white cards、內層 chips、evidence／meaning／
recovery white cards。此頁建立來源、推導、課程假設與 NTPU scene 的界線。

### Slide 3｜Lab C — Spend the joules

主讀取路徑：`主問題 → 任務條件 → 六格 actual timeline → freeze → evidence → 判讀`。

- 任務類型改為三個色點標籤，不再各套一層 rounded card。
- 固定窗口採灰色填色；學生可操作的 SEND／BATCH／WAIT／SLEEP 維持白底靛框。
- 右欄前 3 步改為編號文字與細分隔線，只保留紅框
  `FREEZE → withheld` 作終點 gate。
- service／energy／efficiency 合併成單一 evidence ledger，以細直線分欄。
- `urgent miss` 不能因 bit/J 上升而宣稱 mission winner。
- 設計估計：23 分鐘；尚未 novice-timed。

### Slide 4｜Evidence clinic — Prediction is not saving

主讀取路徑：`目前可得資料 → 合法 A/B 決策 → freeze → chronological evidence →
Score ≠ saving`。

- 五個 feature rows 收成「現在可得／需判讀／事後才有」三組，以左色條分層。
- A／B action 放大為中欄主要操作物件；availability／leakage 保留綠／紅語義。
- prediction score 不再套第二層 card；freeze 後的 evidence 保留綠框。
- `Score ≠ saving` 放大為頁面結論錨點；model score 不進 energy formula。
- 設計估計：14 分鐘；尚未 novice-timed 或 browser 驗證。

## Visual system decision under test

本輪回到 owner 指定的 UI-skill reference，不採用後續 pale-surface pass。
`ui-ux-pro-max` 只協助層級判讀；其泛用亮橘色建議與 owner 限制衝突，未採用。

- 背景保持 unset，由 edu master 保留白色 field、logo、divider 與 footer。
- 主色：深靛 `312E81`；流程靛 `4F46E5`；reference lavender `818CF8`；
  高對比 secondary `6557C8`；green `16A34A`；red `DC2626`。
- 白色 card 是主要載體；`EBEEF8` 只用於少量 header／stage chips 與固定窗口。
- 不使用亮橘、深色填色、大面積粉彩 surface 或全頁同構 dashboard。
- 中文標楷體；英文與數字 Times New Roman；標題 28 pt；authored 可見文字最低 16 pt。
- 短選項與節點置中；長句與因果說明左對齊；不以縮字解決空間問題。

## Stop gate

Owner 必須決定這 4 頁是否足以凍結 full-deck visual system。未取得 owner approval 前，
不製作其餘頁面，也不推論 simulator、browser、novice timing、20-seat 或 classroom
readiness。
