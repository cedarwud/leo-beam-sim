完成 R5-JSX 重構。

- `SceneRenderContent` 拆成 10 個語意子元件，`MainScene.tsx` return：860 → 655 行。
- 4,915 → 4,419 行；其中總差額含平行 R5-MS WIP，已於報告分離。
- 新增 element-tree render tests，9 項 scene tests 全部通過。
- `tsc --noEmit -p tsconfig.json`：green。
- `npm run test:scene-presentation`：green。
- 未執行 git 寫入、browser validator、`check:ee` 或 `check:visual`。

報告：[R5-JSX.md](/home/u24/demo/leo-beam-sim/docs/sdd/worker-reports/R5-JSX.md)

