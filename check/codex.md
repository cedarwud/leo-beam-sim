Executive Summary

  這份 Master SDD 的「展示目標」大致對齊原始意圖，但目前不應直接作為 implementation authority。主要問題是：它把 PyTorch MODQN training
  backend 放到 ntn-sim-core，這違反既有 repo roles；Telemetry 只描述「WebSocket/SSE」但沒有證明 metric truth 的 schema/sequence/
  provenance；2D SVG 動畫建議用 React interval 高頻更新，風險偏高；Phase 4 的 3D SVG extrusion 也不符合目前 research-visual-lab 的靜態
  SVG 角色。

  結論：方向可行，但需要重大修訂後再進入開發。現有 repo 已經有不少基礎可用：TrainingForm / JobsPanel / SSE job stream、scene lane
  governance、100-UE instanced marker、live Walker handover event focus。SDD 應該接上這些既有邊界，而不是重開一套平行架構。

  Detailed Critique per Axis

  Academic Rigor & Data Integrity

  最大紅旗是架構圖把「Backend / Python DRL Engine」標成 ntn-sim-core（docs/showcase-master-sdd.md:44）。既有分工是：modqn-paper-
  reproduction owns MODQN training/rewards/diagnostics，ntn-sim-core 是 validation oracle，leo-beam-sim 是展示層（/home/u24/papers/
  ntn-showcase-stack/docs/repo-roles.md:7）。這必須改掉。

  SSE/WebSocket 本身不保證「數學真實」或「無 lag」。目前 JobsPanel 已有 EventSource 讀 /jobs/{id}/stream（src/ui/modqn-training/
  JobsPanel.tsx:265），但 TrainingProgressEvent.metrics 還是 generic Record<string, number>（src/modqn/training-trigger/
  types.ts:245）。SDD 需要定義 metric schema、事件序號、run/config hash、producer revision、metric definition、stale TTL、out-of-order
  handling、snapshot reconciliation。否則 Dashboard 只是在「即時顯示數字」，不是 proof。

  Fail-closed 也不夠具體。Telemetry Pending / Offline 不能只是 badge；斷線後 flowchart animation 必須停止使用 live/proof claim，
  metrics 要標成 last-confirmed/stale，不可繼續用 CSS/interval 假裝資料還在流。

  WebGL Performance & Three.js Feasibility

  100 UE markers 可行，前提是維持 instancing。目前 GroundScene 已經把 secondary UEs 用 THREE.InstancedMesh 合成一個 draw call（src/
  viz/GroundScene.tsx:15）。但 SDD 說每個 UE glow radius / pulse frequency 動態變化（docs/showcase-master-sdd.md:31），如果用 React
  state 或每 UE mesh/material 會很快失控。應改成 instanced attributes + single ShaderMaterial，queue/service values 以 10-15Hz 更新，
  不要 per-frame React re-render。

  Director close-up 的 cone + queue stack + particles 可行，但要限縮：active cones ≤2、queue cylinder 用單一幾何或 shader clip、upload
  particles 用 THREE.Points 或 instanced quads，不要 200 個 Mesh object。SDD 的「max 200 per focused cone」偏鬆；建議 default 64-96、
  hard cap 128 focused particles，global cap 256。

  Director Mode 還有現有控制衝突。Camera tween 已在 MainScene 透過 controlsRef 和 cameraTweenRef 做（src/scene/MainScene.tsx:600），但
  playback auto-slow 目前最低是 1x（src/usePlaybackControls.ts:4），SDD 的 0.05x 不符合現況。要嘛擴充 dedicated director speed
  override，要嘛採用已存在的 display-stretched slow-focus model，而不是直接改 global source time。

  2D SVG Data-Binding Feasibility

  stroke-dasharray / stroke-dashoffset 可以做教學動畫，但不應用 React interval 跟每個 learning step 綁定（docs/showcase-master-
  sdd.md:26）。高頻 telemetry 應 coalesce 成 UI snapshots，例如 10-20Hz；SVG edge animation 用 CSS/WAAPI 自己跑，React 只切 active
  node/edge class 或 CSS variables。

  State management 建議：不要用 React Context 承載高頻 metrics。此 repo 目前沒有 Zustand 依賴（package.json:167），所以第一選擇是小型
  external store + useSyncExternalStore selector；Context 只提供 store reference。若後續資料面變大再引入 Zustand。

  research-visual-lab 的 SVG 是靜態 academic figure pipeline，不是 runtime animation engine；它明確不重算 MODQN reward/action/
  handover/SINR，也尚未實作 animation/web shell/3D（/home/u24/papers/research-visual-lab/README.md:27）。應從其 semantic spec / stable
  IDs 生成 React/SVG blueprint，不要直接把 raw SVG 當 interactive runtime source，更不要在 Phase 4 預設用 SVGLoader +
  ExtrudeGeometry。

  Roadmap Soundness

  Phase 1 方向對，但順序仍不夠精準。第一步不應是「define training-telemetry.json」在 Leo 端自創 contract；應該先 inventory/extend
  producer-owned TrainingProgressEvent、modqn-training-scene-trace-v1，再由 Leo consumer adapter 顯示。ADR-002 已經明確禁止 Leo 端
  infer training trace truth（docs/decisions/ADR-002-modqn-training-scene-trace-artifact-target.md:90）。

  Phase 2 Director Mode 應接既有 HandoverEventRail slow-focus 和 lane source horizon，而不是另建一個來源不明的 tour system。Live
  Walker focus 已有 source-time/display-time 分離設計（docs/live-walker-handover-event-map-sdd.md:109）。

  Phase 3 queue/traffic 目前最大 hidden dependency 是 truth ownership：queue depth 不是 display state，必須來自 producer trace、
  validated traffic generator、或 vendored ntn-sim-core/src/core module。不能在 SimState 為了好看本地發明 packet backlog。

  Identified Risks & Mitigation Strategies

  - Wrong backend owner: 改為 modqn-paper-reproduction training service -> leo orchestration -> ntn-sim-core validation oracle。
  - Fake dashboard risk: 每個 metric 必須帶 schemaVersion/jobId/eventSeq/sourceHash/metricDefinition/sourceOwner/staleState。
  - SVG main-thread lock: telemetry coalesce，CSS/WAAPI animation，避免 React interval per step。
  - OrbitControls collision: Director state machine 需有 idle/acquiring/focused/restoring/cancelled，保存並恢復 camera/target/speed，
    使用者互動可 cancel。

  - WebGL overdraw/leaks: stable geometries/materials，particle pool，unmount disposal audit，Playwright + FPS telemetry smoke。
  - Lane regression: 新 layer 必須更新 sceneLaneRenderPlan 與 validate:frontend:scene-lane-governance，不能從 appMode 直接 mount。

  Actionable Enhancements

  1. 修正 Master SDD architecture diagram 的 repo ownership。
  2. 在 Phase 1 前加 Phase 0: Contract Inventory & Source Authority Reconciliation。
  3. 將 telemetry schema 改成 producer-owned progress stream + validated snapshot，不要 Leo-local truth schema。
  4. 2D dashboard 用 external telemetry store + selector；React Context 只傳 store。
  5. UE queue visualization 定義 traffic-queue-v1 source contract；缺資料就 source gap。
  6. Render caps 寫入 SDD：100 UE instanced；focused particles default 96 / hard 128；global particles 256；focused cones ≤2；labels
     only focused UE + selected event。

  7. Director Mode 接 source-backed handover event id/source time；不要讓 display slow-motion 改寫 source horizon。
  8. Phase 4 先做 Multi-Catfish producer contract/dashboard extension；3D SVG extrusion 移到 optional experiment。

  Verdict

  APPROVED WITH MAJOR REVISIONS as a vision document. NOT APPROVED as implementation authority until ownership, telemetry truth
  schema, lane-governance integration, and performance caps are corrected. The risky phases are Phase 1 telemetry truth and Phase 2
  Director integration; Phase 4 3D extrusion should be deferred.