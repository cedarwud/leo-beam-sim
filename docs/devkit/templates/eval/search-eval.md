# eval：search 模板

## 樣本情境
「找出 `REPLAY_CANVAS_ATTRIBUTES` 目前的所有使用點與定義處」（動機：評估 SceneTelemetry 清理路徑）。

## 結構斷言（初篩 grep＋語意判定，照 eval/README 第 2 步——唯讀類斷言不得只憑字串命中放行）
- [ ] 含 codegraph 優先指示（`codegraph` 字樣）
- [ ] 含排除清單（node_modules、`scripts/_`）
- [ ] 含「沒找到也是結論」等價語（覆蓋面聲明要求）
- [ ] 含「不建議修法」（唯讀邊界）

## 模範回報性質（fresh agent 判）
- 回報開頭一句話給命中數；表格每列=檔案:行號＋一句角色說明
- 明說搜了哪些 pattern／目錄
- 無任何 >10 行的原始碼貼片、無修改建議
