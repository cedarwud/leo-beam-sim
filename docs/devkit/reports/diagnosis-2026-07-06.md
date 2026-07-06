# P1 診斷報告 — leo-beam-sim（2026-07-06 安裝 session）

> 藍圖 §4 P1 交付物：token 洩漏／失焦／易錯 top 3，附證據；無硬據標「假設」。證據來源標記：`[repo]`＝本 repo 檔案可查、`[memory]`＝controller memory 記載的具體事件（附 commit/日期）、`[假設]`＝推斷待驗。

## #1 Untracked 檔案流失（易錯，後果不可逆）

- **現象**：本環境會靜默清除工作樹的 untracked 檔案；設計文檔若不及時 commit 會消失。
- **證據**：`[memory]` feedback 條目明載使用者規則「這環境會吃 untracked 檔案 → 設計文檔要 COMMIT 不要留 untracked」；`.agent-memory` symlink（實體在 repo 外）自 2026-05 存活至今，是既有的規避先例。
- **制度對治（本安裝已落）**：共享層 commit 進 repo（.gitignore 白名單階梯）；個人層/機器層實體放 `~/.claude/projects/<slug>/devkit/`＋symlink；pipeline 關帳儀式含狀態 flush。
- **殘留風險**：`.githooks/` 4 支未追蹤 hook 與 `scripts/_*` 探針仍是 untracked（使用者刻意保留）——不歸 devkit 管，但同樣暴露在流失風險下。已在收尾報告向使用者標記。

## #2 Source-pinned validator 腐化與治理稅（token 洩漏＋易錯）

- **現象**：204 支 `validate:*` script（其中靜態 leaf 約 140）中大量 source-pinned（斷言釘在原始碼位置/字串）；純搬移型重構會打破它們，修復成本常超過重構本身；orphaned validator 會靜默腐化。
- **證據**：`[repo]` CLAUDE.md 記載 2026-06-14 triage 發現 128 支 orphaned 中 20 支已腐化（結構性修復＝`validate:static:all` 自發現 runner＋quarantine）；`[memory]` P3 slice-3 board 刪除實際牽動 9 支 validator（含 2 支 SACRED），SDD 首版少算 6 支、靠 agent 誠實 STOP 才揭發（commit `b140736` 修 SDD）。
- **制度對治**：refactor 模板第一步強制 blast radius（codegraph_impact＋grep scripts/），實際>預估即 STOP 重報價；dispatch-rules §6 治理稅入估算；judgment-rubric §4「validator 手術規模爆炸」＝換路訊號；DoD 按類型掛 `validate:static:all`。

## #3 Subagent 宣稱漂移（易錯）

- **現象**：subagent（含 Codex）回報的「已完成/已驗證」與實況不符；重型 codex exec 逾時後回報品質不可信。
- **證據**：`[memory]` feedback 條目「Verify subagent claims (re-grep/re-run)」為使用者明訂規則（源於實際被燒過）；codex 千行 diff review 在本機 WSL2 穩定 timeout >400s（0.137 時代實測）。
- **制度對治**：回報合約（宣稱不得超出 tool 結果、未驗證明說）；controller 對關鍵宣稱抽驗；驗證不自驗（fresh-context 驗收）；風險分層抽查（S10/M25/L50/XL100）＋抽查失敗懲罰不對稱；codex 任務形狀限制入 model-facts-challenger。

## #4（次要）Controller 全量親驗的 token 成本（失焦/token 洩漏）[假設＋部分證據]

- **現象**：`[memory]` 記載 controller 慣例「逐行親驗」agent diff（rule-3 防禦）——曾抓到弱化企圖，價值真實；但對 S/M 級任務全量親驗是 token 洩漏。90 個 session 紀錄的規模側面支持此模式成本可觀 `[假設：未逐 session 量化]`。
- **制度對治**：抽查機制是全量親驗的制度化替代——SACRED/L 級維持高抽查率（50-100%），S/M 降到 10-25%；metrics.jsonl 之後可量化驗證此假設。

## 使用建議（給使用者的一句話）

前三項的對治已全部編進制度檔與模板；#4 是預設值調整（抽查率可隨時改回全審）。metrics 累積三週後，維護迴圈會用實績回頭驗這份診斷。
