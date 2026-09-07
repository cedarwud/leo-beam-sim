已完成兩組成組下沉：

- 多候選 authority / identity / marker：新增 [multiCandidateSceneDisplayPolicy.ts](/home/u24/demo/leo-beam-sim/src/scene/multiCandidateSceneDisplayPolicy.ts) 與測試。
- Manual/cinema/handover display：新增 [handoverPresentationDisplayPolicy.ts](/home/u24/demo/leo-beam-sim/src/scene/handoverPresentationDisplayPolicy.ts) 與測試。
- 報告：[R5-MS.md](/home/u24/demo/leo-beam-sim/docs/sdd/worker-reports/R5-MS.md)

驗證結果：

- `tsc --noEmit -p tsconfig.json`：exit 0。
- 相關純測試：50 pass、0 fail。
- 未執行 browser validator、`check:ee`、`check:visual` 或任何 git 寫入指令。
- 既有 R5-JSX source-contract 測試仍期待被抽走的舊 MainScene 宣告，12 個中 8 個因此失敗；該 dirty WIP 未修改。

