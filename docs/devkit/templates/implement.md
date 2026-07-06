# 派工模板：實作

> 版本：v1.0（2026-07-06）——關帳時抄進 metrics 的 `template_ver`。

用法：填 `{{...}}` 後派 general-purpose（Sonnet high 起；難題 Opus xhigh）。**前端（scene/viz/ui/app/render 邊界）不用本模板**——改用 `docs/frontend-change-contract.md` 的 dispatch-prompt 模板＋git worktree 隔離。

```text
<goal>
{{做什麼，一句話}}。
動機：{{why——上游意圖檔項目/使用者原話}}。
</goal>

<context>
- spec／驗收條件出處：{{docs/devkit/intent.md 條目或 SDD 路徑}}
- 相關檔案（先讀這些，不要全 repo 亂逛）：{{清單}}
- 本 repo 鐵則：重播輸入 JSON 不可變；顯示層不得改寫 SINR/HO/決策/獎勵真值；vendored 模組 KPI 對不上 baseline 時修 port 不調 baseline。
</context>

<constraints>
- 不得執行改變版本庫狀態的全域操作（stash/checkout/reset 之類樹級指令）——會抽走其他 in-flight agent 的在途檔案。
- 不裝新依賴（需要就 STOP 回報，這是硬關卡）。
- 不 push、不發布。
- 臨時腳本/中間產物只放 scratchpad 或 .claude/scratch/，收尾自清。
- 範圍紀律：只做本任務要求的；發現隔壁有髒東西→記回報的「發現」欄，不順手改。
- 若做到一半發現任務實際觸及 scene/viz/ui/app 渲染邊界 → STOP 回報，等 controller 換 frontend contract 流程派工。
</constraints>

<acceptance>
全部通過才算完成（附各指令輸出證據）：
1. npx tsc --noEmit 0 錯
2. {{對口 validator 指令，如 npm run validate:modqn:coverage-fairness}}
3. {{任務特定驗收，如「X 面板顯示 Y 值且與 manifest 一致」}}
4. npm run validate:governance 綠（commit 前本來就會擋，但你要主動跑）
</acceptance>

<report_format>
1. 結論一句（完成/部分/受阻＋數字）。
2. 改了哪些檔（檔案:行號級），每檔一句為什麼。
3. 驗收證據：每條 acceptance 對應的實際指令輸出摘要。**沒跑的明說沒跑；宣稱不得超出 tool 結果。**
4. 假設與發現（不含修法建議的順手改）。
長輸出落檔給路徑，不貼全文。
</report_format>
```
