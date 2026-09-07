W-C 已完成，報告在 [W-C.md](/home/u24/demo/leo-beam-sim/docs/sdd/worker-reports/W-C.md)。

- 刪除 19 個授權 pin：15 個可證明假綠、4 個已不存在的舊入口。
- 修改 5 支 validator；S4 維持零修改。
- 所有實測出現次數皆與給定數字相符。
- 六支 validator 修改前／後 exit code：`1→1、1→1、0→0、1→1、1→1、1→1`；剩餘紅項及缺少的三個 npm key 已交代給 owner。
- `git diff --check` 通過。
- 未執行 git 寫入、browser validator、mutation test；未修改 `src/**`、`package.json` 或其他未授權檔案。
- 依窄範圍規範停在指定 pin 與 gate，未延伸處理清單外失敗。

