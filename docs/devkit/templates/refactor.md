# 派工模板：重構／搬移

> 版本：v1.1（2026-07-06）——關帳時抄進 metrics 的 `template_ver`。

用法：先讀 `/home/u24/papers/skill/safe-refactor/SKILL.md`；填 `{{...}}` 派 general-purpose（Opus xhigh 優先）。本 repo 重構有**治理稅**：source-pinned validator 會被純搬移打破——爆炸半徑先算，不算先不動刀。

```text
<goal>
{{重構什麼→成什麼形狀}}。行為必須不變（refactor 的定義）。
動機：{{why}}。
</goal>

<context>
- 目標檔案/模組：{{清單}}
- 本 repo 有 codegraph MCP：動刀前先 codegraph_impact 估影響面。
- 治理稅前例：一次 board 刪除牽動 9 支 validator（含 2 支 SACRED）——先估 validator 爆炸半徑再動手。
</context>

<constraints>
- 第一步（未過此步不准編輯任何檔案）：列出 blast radius——codegraph_impact ＋ grep scripts/ 找 source-pinned validator（grep 目標符號/路徑字串出現在哪些 validate-*.ts）。兩個獨立的 STOP 條件（任一命中即停，不編輯）：
  (i) 實際 blast radius 比 controller 給的估算多 → STOP 重報價；
  (ii) blast radius 含**任何 SACRED validator**（scene-lane-governance、s0-connected-sat-has-beam 等 pre-commit 層）或任何 gate 語義變更 → **無論是否在估算內，一律 STOP 上呈**——這是架構單向門，controller 要帶使用者核准才能續。
- 禁全域 git 樹級操作（stash/checkout/reset）。
- 一次一個模組；vendor port 類禁止批次。
- validator 修復規則：repoint 不弱化——assert 數量與強度不得下降；negative-control 驗證 gate 還會紅。
- 不裝依賴、不 push。
</constraints>

<acceptance>
1. 行為保持證據：重構前後 {{對口 validator 集}} 皆綠（前後都要跑，貼兩次輸出）。
2. npx tsc --noEmit 0 錯；npm run validate:governance 綠。
3. blast radius 清單上每支 validator 的處置逐一列出（未動/repoint/更強），不得有「順手弱化」。
4. 交接前註記：controller 會另跑 npm run validate:static:all（~8min）——你的清單會被對帳。
</acceptance>

<report_format>
結論→blast radius 實際 vs 預估→每檔改動一句話→validator 處置表→前後驗證輸出摘要。未驗證項明說。
</report_format>
```
