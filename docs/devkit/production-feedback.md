# 生產回饋掛載點 — leo-beam-sim

> 藍圖 §15 第 8 項：先留介面，實體等真的對外運轉再接。本 repo 的「生產」＝**demo 場合**（口試預演、對外展示、教學使用）＋長駐瀏覽器驗證。現實是唯一不會被 Goodhart 的驗證器——每次真的用，都是回饋來源。

## 回饋條目格式（append 到下表，之後由 intake 編譯成 backlog 項）

| 日期 | 來源 | 觀察 | 證據 | 建議去向 |
|---|---|---|---|---|
| （範例）2026-07-05 | validator-flake | handover-pulse 偶發紅（sinr-live timing） | slice-2/3 兩次紀錄 | 觀察名單；連 3 次紅升格 backlog |

來源類別：`demo-run`（實際展示/預演中發現）· `validator-flake`（非 regression 的間歇紅）· `perf`（FPS/載入實測劣化）· `external`（觀眾/口委反應）。

## 已知觀察名單（安裝日轉入）

- **CI visual-gates 冷啟逾時**（2026-07-07，run 28827685964@df103f1）：static-gates **史上首綠**（復活鏈成立）；visual-gates 紅在首 gate `sinr-live-render` 的 `waitForSelector` 20s 逾時（開跑 25s 即死）＝hosted runner 軟體 WebGL 冷啟慢於本地（本地同碼 validate:live-render 6/6 綠）。**分類＝CI 環境差異、非 gate 斷言失敗、不動 gate**。判準：連 3 次同型逾時 → 升格 backlog（對策候補在 health-2026-07-07 延遲對策節：首 gate 前 warmup、playwright cache、visual-gates 改僅 PR 觸發）。required check 只綁 static-gates（visual-gates 自證 3 綠前不綁——workflow 註解與健檢 B 路建議一致）。

- handover-pulse flake：sinr-live timing 起源，非 regression（P3 slice-2/3 兩度出現）。判準：validate:governance:full 連續 3 次跑到同一紅 → 升格 backlog 修 timing。

## 尚未接的實體（等條件成熟）

- 錯誤追蹤器／健康檢查：本 repo 為本地 demo app，無長駐部署；若日後掛公開 demo 站，補 console-error 收集＋載入健康檢查（屆時列新增依賴關卡）。
- demo 場次紀錄儀式：口試預演後 5 分鐘，把卡頓/誤解/提問寫成本表條目——寫進 pipeline 收尾提醒。
