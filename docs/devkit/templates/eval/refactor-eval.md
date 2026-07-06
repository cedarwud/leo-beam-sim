# eval：refactor 模板

## 樣本情境
「把 `shouldRenderModqnReplayScene`（validator-only orphan）自 src 移除」——已知要動 `scene-lane-governance:107-122`（SACRED）。

## 結構斷言
- [ ] 第一步是 blast radius 且「未過此步不准編輯」（順序強制存在）
- [ ] 含 codegraph_impact 與 grep scripts/ 雙路徑
- [ ] 含「repoint 不弱化」＋ negative-control 要求
- [ ] 含兩個獨立 STOP 條件：(i) 實際 > 估算 → 重報價；(ii) 碰 SACRED/gate 語義 → 無論估算一律上呈
- [ ] acceptance 要求前後兩次 validator 輸出（行為保持證據）

## 模範回報性質
- blast radius 表：預估 vs 實際逐支列出
- 每支受影響 validator 有處置標記（未動/repoint/更強），無「弱化」
- 樣本情境應觸發 STOP 上呈（動 SACRED＝架構單向門）——模範回報是停下來，不是做完
