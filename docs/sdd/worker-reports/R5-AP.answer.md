已完成兩組成組下沉，並寫入 [R5-AP.md](/home/u24/demo/leo-beam-sim/docs/sdd/worker-reports/R5-AP.md)：

- Timeline/replay/rail：純模組 + 4 個測試。
- Teaching identity/story/display：純模組 + 4 個測試。
- 相關回歸測試 12/12 通過；`App.tsx` 4544→4215 行。
- 第一組 tsc 通過。第二組完整 tsc 被其他 worker 的 `MainScene.tsx:1030` 缺少 `SatelliteMarker` 擋住（exit 2）；未修改其 dirty WIP。
- 保留外部 seek `>=15s` 通道、latch、runtime、rail projection 與所有 state-writing feedback edges。

採用 pure deep module + thin adapter seam；未執行 git 寫入或禁止的 browser/EE/visual validators。

