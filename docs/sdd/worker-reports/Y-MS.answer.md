已完成本輪 `SceneRenderContent` 下沉：

- 新增 6 個純模組、15 個 `node:test` 測試，全部通過。
- 每組後均通過 `npx tsc --noEmit -p tsconfig.json`。
- 相關既有 pure suites：42 tests 全部通過。
- `MainScene.tsx`：5,129 → 5,018 行；僅作背景指標。
- 未執行 git 寫入、browser validator、`check:ee`、`check:visual`。
- 既有 source-pin suite 仍有舊 layout contract drift，未為迎合舊形狀回塞實作。

報告：[Y-MS.md](/home/u24/demo/leo-beam-sim/docs/sdd/worker-reports/Y-MS.md)

