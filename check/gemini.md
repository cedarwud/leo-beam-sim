   系統設計審查報告 (System Design Review Report)

  本報告針對  /home/u24/papers/project/leo-beam-sim/docs/showcase-master-sdd.md  規劃之動態展示平台、演算法儀表板以及 Multi-Catfish
  研發路線圖進行多軸向系統設計審查。本審查旨在核實該系統設計是否在不妥協學術嚴謹性與渲染效能的前提下，完整實現用戶之原始設計意圖。
  ──────
  ## 1. 執行摘要 (Executive Summary)

  本系統設計文件試圖在 100-UE 高密度環境下提供清晰的手渡（Handover）動態展示、雙向遙測綁定之 2D SVG
  演算法流程圖，以及藉由導演模式（Director Mode）實現自動運鏡與時間膨脹（Time-dilation）。然而，該設計在 WebGL 渲染效能、React
  狀態頻繁更新 DOM 之瓶頸、遙測數據背壓（Backpressure）處理以及故障降級機制（Fail-closed）方面存在技術隱患。

  本報告針對上述關鍵軸向進行了詳細評估，並結合項目記憶庫中的 realistic beam geometry、renderer decoupling 與 timeline controls
  等既有架構，提出了具體的修正意見。在落實實例化渲染、遙測數據緩衝與故障降級的前提下，本系統設計具備可行性。
  ──────
  ## 2. 各評估維度的詳細審查 (Detailed Critique per Axis)

  ### 2.1 學術嚴謹性與數據完整性 (Academic Rigor & Data Integrity)

  • 遙測橋接與背壓控制：PyTorch 訓練引擎在進行單步學習時，其更新頻率可達數百赫茲。若 WebSocket 遙測直接將每一步的 Pareto
  權重、損失與獎勵無過濾地推送至前端，會引發嚴重的事件循環阻塞。必須在後端實施定頻聚合（如限制在
  30Hz），或在前端引入環形緩衝區（Ring Buffer）進行平滑消費，以確保數據的真實性不因渲染延遲而被扭曲。
  • 防止數據虛構與物理一致性：系統不得為了展示效果而虛構 SINR 或手渡事件。所有渲染必須嚴格遵循  ntn-sim-core  的 Bessel J1/J3
  $G_T(\theta)$ 物理增益公式（如  realistic-beam-geometry-sdd  所述）。3D 視口中的 Cone 發光強度與 UE 的收發狀態，必須與 vendored
  物理模組的實際計算值精確對應。
  • 故障降級機制（Fail-Closed）：當即時訓練後端中斷或 WebSocket 連線丟失時，僅顯示 "Telemetry Pending / Offline"

徽章並不足以應對學術口試等演示場景。系統必須實施自動無縫降級，暫停即時模擬更新，並將數據車道切換至本地已驗證的靜態重播數據（例如載入
合格的
  visual-showcase-v1.json  或  MODQN  數據包），避免頁面鎖死或崩潰。

  ### 2.2 WebGL 效能與可行性 (WebGL Performance & WebGL Feasibility)

  • 100-UE 渲染架構：為 100 個獨立的 UE 建立個別的 Three.js  Mesh  與  Material ，並在 CPU 逐幀更新
  uniform（如呼吸頻率、顏色），會帶來過高的繪圖調用（Draw Calls）與狀態變更開銷。必須採用  THREE.InstancedMesh
  進行單次呼叫渲染。背景 UE 的調幅（如項目記憶庫確定的  0.24  透明度與  0.72  縮放比例）應直接編碼至實例化屬性（Instance
  Attribute）中，將動態發光計算卸載至頂點著色器。
  • 光暈與圓柱幾何體優化：全局後處理 Bloom 濾波器極消耗 GPU 資源。應採用自訂著色器（Shader）在 UE Marker
  內部實現程序化發光（Procedural Glow）。同時，3D 數據堆疊圓柱體應以單一  THREE.CylinderGeometry  通過頂點著色器的高度 Uniform
  進行高度縮放，而非動態創建或堆疊多個 Discrete Mesh，以消除額外的頂點開銷。
  • 粒子系統限制：在導演模式近景展示中，Beam Cone 內部的數據上傳粒子嚴禁使用獨立的 Mesh 或 Sprite 對象，必須使用單一  THREE.Points
  配合 GPU 驅動的頂點著色器計算軌跡。單個 Cone 內的粒子數量應嚴格限制在 200 個以內，以維持 60 FPS。此外，應遵循  minimal-demo-viz
  規範，將無效的軌跡線與裝飾效果關閉，只保留主聚焦光束。

  ### 2.3 2D SVG 數據綁定可行性 (2D SVG Data-Binding Feasibility)

  • DOM 操作與路徑動畫瓶頸：在毫秒級的訓練週期下，若透過 React 狀態直接變更 SVG 的  stroke-dasharray  與  stroke-dashoffset
  來呈現數據流動，將導致 React 頻繁進行調和與 DOM 重繪，這會使瀏覽器主線程鎖死。應改用純 CSS 動畫（CSS Keyframes）或 Web Animations
  API 實現自主流動效果，使其完全脫離 React 的渲染管線。
  • 狀態管理與漸態更新：必須避免使用 React Context 來管理高頻更新的遙測數據，否則會導致整棵組件樹的重複渲染。應使用 Zustand
  狀態庫，並利用暫態訂閱（Transient updates，不透過 React 重新渲染組件，而是直接在訂閱回調中以 Ref 修改 DOM 的  textContent
  ）來直接更新數值面板，確保 UI 響應維持在 60 FPS。

  ### 2.4 研發路線圖合理性 (Roadmap & Phased R&D Execution)

  • Phase 1 的整合缺失：Phase 1 優先建構 2D 儀表板而未進行 Three.js 與遙測數據的聯調，這隱藏了動態遙測輸入與 Three.js
  渲染線程衝突的風險。應將「Three.js Telemetry Ingestion Smoke Test」提前至 Phase 1，作為測試基底。
  • Phase 4 的 3D 電路板幾何開銷：利用  SVGLoader  與  ExtrudeGeometry  在 3D 空間中動態生成 Glowing 3D
  電路板會產生數十萬個未經優化的三角面，造成 CPU 拓撲計算瓶頸。此項應列為低優先級的可選擴展（Stretch
  Goal），若效能受限，應優先保留優化的 2D 流程圖。
  • 渲染車道治理（Governance）：設計文件未說明動態遙測與現有 "MODQN Replay Proof"、"SINR Live" 的隔離機制。必須嚴格遵循
  docs/frontend-render-governance.md ，當進入 "Live Training" 模式時，必須完全卸載其他無關車道的渲染對象，防止 GPU 顯存洩漏。
  ──────
  ## 3. 識別的風險與緩解策略 (Identified Risks & Mitigation Strategies)

   識別風險 (Identified Risks) │ 技術瓶頸說明 (Technical Bottleneck)             │ 具體緩解策略 (Mitigation Strategies)
  ─────────────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────
   相機控制權衝突              │ 在導演模式自動運鏡插值時，用戶手動操作滑鼠會導  │ 自動運鏡（如點擊  [Intra-HO Focus]  或  [Inter-
                               │ 致  OrbitControls                               │ HO Focus] ）啟動時，將  OrbitControls.enabled
                               │ 與插值腳本同時修改相機位置，引發相機劇烈抖動。  │ 設為  false
                               │                                                 │ ；運鏡結束或手動中斷後重新啟用，並引入 Slerp
                               │                                                 │ Blend 實現相機平滑交接。
   WebGL 內存洩露              │ 高頻率地創建與銷毀 3D Cones、手渡弧線（Handover │ 建立材質與幾何體的對象池（Object Pool）。隱藏
                               │ Arcs）與粒子會迅速堆積 WebGL 內存，引發 Context │ 3D Cones 與 Arcs 時僅將其  visible  屬性設為
                               │ Lost 崩潰。                                     │ false  並回收到池中，嚴禁在每幀渲染中調用
                               │                                                 │ dispose()  或  new THREE.Mesh() 。
   物理步長不同步              │ 若在導演模式下將  speed  降至  0.05x            │ 模擬引擎的時間步長必須與 UI
                               │ ，而物理引擎的  dt  未成比例調整，將導致 3D     │ 的變速乘數進行嚴格的乘積綁定，並與  Interactive
                               │ 動畫極慢但決策週期前進速度不變，造成視覺與邏輯  │ Timeline Controls  的邊界安全機制相容，確保  dt
                               │ 脫節。                                          │ 隨播放速度成比例縮小。
  ──────
  ## 4. 可落地的架構改進建議 (Actionable Enhancements)

  1. 增設 InstancedMesh 渲染規範：在 SDD 中新增 §3.3「100-UE 實例化渲染規範」，明確限制 100-UE 場景下的 Draw Calls 上限，要求背景
  UE 的顏色 Tint 與 Scale 使用 Instance Attribute，並將動態發光計算移至頂點著色器。
  2. 制定遙測背壓機制：在 SDD §4.1 中增設「遙測背壓與環形緩衝合約」，限制後端 PyTorch 發送頻率最高為 30Hz；前端 WebSocket
  接收端引進緩衝區，在  requestAnimationFrame  迴圈中批量消費（Batch Consume）數據，避免 React 被高頻觸發。
  3. 明確定義降級自動切換流程：在 SDD §5 中新增 §5.4 「演示降級自動切換合約」。若 WebSocket 心跳包中斷超過 3 秒，UI
  應立即自動切換至  Static Replay Mode ，載入經過  ntn-sim-core  驗證的  visual-showcase-v1.json 。
  4. 細化車道銷毀與治理：在 SDD §5 中明確加入與  docs/frontend-render-governance.md  隔離的條款，規定 Live Training
  啟動時必須完全銷毀（Unmount）重播車道（Replay Lane）的所有幾何對象，防止 GPU 顯存洩漏。
  5. 調整 3D 擠壓為可選功能：將 Phase 4 的「3D Flowchart Extrude」調整為「2D Canvas Flowchart Overlay with Three.js
  Integration」的可選模組，避免重型擠壓幾何體影響核心模擬幀率。
  ──────
  ## 5. 評審結論 (Verdict)

  APPROVED WITH REVISIONS IN PHASE 1 & PHASE 2 (在修正 Phase 1 遙測背壓合約與 Phase 2 實例化渲染及相機控制衝突的前提下予以批准).
  ──────
  ### 工作摘要 (Summary of Work)

  本工作審閱了  /home/u24/papers/project/leo-beam-sim/docs/showcase-master-sdd.md  中的 Master SDD 文件，並結合項目記憶庫中的
  realistic
  beam geometry、renderer decoupling 與 timeline controls 等架構約束，完成了多軸向系統設計審查。報告中針對學術嚴謹性、WebGL
  效能、SVG

數據綁定、以及研發路線圖提出了具體的技術改進方案，並識別了潛在的相機控制衝突與內存洩露風險，提出了緩解策略。本評審報告採用了繁體中文
編寫，符合語言規範要求。