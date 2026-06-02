  Prioritizing Tool Usage
  Here is the multi-axis system design review of the Master SDD, analyzed through the lens of a Senior WebGL Systems Architect and
  aligned strictly with your project's repository constraints.
  ──────
   1. Executive Summary

  The Master SDD is a strong, highly ambitious blueprint that elegantly solves the high-density legibility dilemma via a
  "Macro/Micro" visual separation and a choreographed Director Mode. It successfully meets the user's intent to elevate the
  platform from a simple 3D viewer into an interactive, educational showcase. However, it harbors a critical repository topology
  violation by conflating the PyTorch environment with the TypeScript reference simulator. Furthermore, there are significant WebGL
  performance and React rendering bottlenecks regarding 100-UE updates and high-frequency SVG data-binding that will severely
  degrade
  the 60 FPS target if implemented naively. With targeted architectural revisions, this SDD can transition from a promising concept
  to a robust, defense-ready platform.

   2. Detailed Critique per Axis

  ### Axis 1: Academic Rigor & Data Integrity

  • Repository Boundary Violation: The architecture diagram in Section 2 incorrectly places  PyTorch MODQN / Multi-Catfish  inside
  ntn-sim-core . As strictly mandated by  AGENTS.md ,  ntn-sim-core  is the frozen TypeScript reference simulator. PyTorch models
  and training engines belong in  modqn-paper-reproduction . The telemetry server must originate from the Python reproduction repo.
  • Data Integrity & Mocking: Relying on a live WebSocket stream effectively proves the algorithm is running (satisfying the User's
  Proof objective). However, a "fail-closed" mechanism that just shows an "Offline" badge is disastrous for a live oral defense.
  While mathematically rigorous, it lacks a presentation-safe fallback.
  • State Verification: The SDD respects the rule against faking numbers, but the frontend must ensure that the weights and Pareto
  points it receives map exactly to the deterministic structures expected from the baseline JSON artifacts to preserve integrity.

  ### Axis 2: Performance & WebGL Feasibility (Three.js limits)

  • 100-UE Macro Ground Legibility: The SDD proposes dynamically changing color tints and pulsing glow frequencies for 100 UEs
  based on queue depth. If implemented naively as 100 separate  THREE.Mesh  objects updating  MeshBasicMaterial  properties every
  frame via React state, CPU-to-GPU memory thrashing will occur, skyrocketing draw calls.
  • Micro View & Particle Overdraw: The Director Mode close-up with 3D cylindrical stacks and uploading particles is conceptually
  excellent. Rendering floating particles inside the Beam Cone is computationally safe only if capped (e.g., ~200 particles) and
  executed entirely on the GPU. JavaScript-driven particle updates looping over individual meshes per frame will cause immediate
  garbage collection (GC) stutter.

  ### Axis 3: 2D SVG Data-Binding Feasibility

  • React Render Thrashing: Connecting SVG  stroke-dashoffset  or  stroke-dasharray  properties directly to React render intervals
  for high-frequency millisecond updates (mimicking data packages flowing) is a fatal anti-pattern. It will lock the main browser
  thread, force React to constantly recalculate the virtual DOM, and severely lag the parallel Three.js rendering context.
  • State Management Pattern: React Context is wholly inappropriate for high-frequency data streams because it forces global re-
  renders on all consumers. A decoupled approach is mandatory for flowchart animations.

  ### Axis 4: Roadmap & Phased R&D Execution

  • Phase 1 Dependency Trap: Phase 1 demands building the  Telemetry Schema  and  WebSocket Bridge  simultaneously with the UI.
  This creates a hard dependency on the Python backend being online, flawless, and networked correctly. Frontend R&D will be
  completely blocked if the backend is unavailable.
  • Phase 4 Three.js Extrusion Sinkhole: Using Three.js  SVGLoader  and  ExtrudeGeometry  at runtime to convert complex 2D SVG
  vector paths into 3D glowing circuits is exceptionally expensive on the CPU due to polygon triangulation. Doing this dynamically
  during mode switches will cause massive UI freezing (jank).
  ──────
   3. Identified Risks & Mitigation Strategies

   Risk                                      │ Impact                    │ Mitigation Strategy
  ───────────────────────────────────────────┼───────────────────────────┼─────────────────────────────────────────────────────────
   Main-Thread Freezing from SVG Animations  │ High (Stutters 3D Scene)  │ Bypass React entirely for high-frequency SVG updates.
                                             │                           │ Use a  useRef  to target SVG DOM nodes and mutate
                                             │                           │ stroke-dashoffset  directly via a raw
                                             │                           │ requestAnimationFrame  loop. Alternatively, use pure
                                             │                           │ CSS  @keyframes  with CSS Variables updated via refs,
                                             │                           │ or Zustand's  subscribe  (transient updates) to prevent
                                             │                           │ component re-renders.
   Draw Call Explosion for 100 UEs           │ High (FPS Drop)           │ Mandate the use of  THREE.InstancedMesh  for the 100-UE
                                             │                           │ ground layer. Pass the assigned satellite color and the
                                             │                           │ "queue depth pulse frequency" via
                                             │                           │ THREE.InstancedBufferAttribute . Calculate the pulsing
                                             │                           │ glow directly inside a custom ShaderMaterial using a
                                             │                           │ global  uTime  uniform. (Reduces 100 draw calls to 1).
   Live Defense Telemetry Disconnect         │ Critical (Demo Failure)   │ Implement a dual-mode state provider:
                                             │                           │ LiveTelemetryProvider  and  ReplayArtifactProvider . If
                                             │                           │ the WebSocket drops or fails to connect, automatically
                                             │                           │ fall back to looping a validated  visual-showcase-
                                             │                           │ v1.json  bundle.
   OrbitControls vs. Director Mode Collision │ Medium (Camera Glitching) │ Ensure  DirectorModeController  explicitly disables
                                             │                           │ user control ( OrbitControls.enabled = false ) before
                                             │                           │ beginning its slerp/lerp path. Only restore it after
                                             │                           │ the handover choreography completes, or if the user
                                             │                           │ explicitly triggers an "Abort Tour" override.
  ──────
   4. Actionable Enhancements

  To fortify the SDD before implementation begins, add the following specifications:

  1. Correct the Architecture Diagram: Update Section 2 to move  PyTorch MODQN / Multi-Catfish  and  Training Telemetry Server
  into the  modqn-paper-reproduction  backend block. Clarify that  ntn-sim-core  is solely the TS mathematical reference oracle.
  2. Phase 1 Reordering (Offline-First): Split Phase 1 to implement the  ReplayArtifactProvider  first using static  visual-
  showcase-v1  artifacts. Add the  WebSocket Bridge  as Phase 1B. This immediately unblocks the 2D dashboard and 3D UI development.
  3. GPU Particle Instancing Standard: Explicitly define in Phase 3 that the Micro Focus Queue Particles must be implemented via
  THREE.Points  or a custom particle shader, capping particles at a strict  MAX_PARTICLES=256  per focused cone to guarantee zero
  WebGL overhead.
  4. Pre-bake SVG 3D Geometry: Revise Phase 4 to state that SVG-to-3D Extrusion must be pre-processed at build time (e.g., via a
  Node script exporting to a  .glb  file) or parsed exactly once during an initial loading screen. Prevent dynamic geometric
  extrusion during active rendering loops.
  ──────
   5. Verdict

  APPROVED WITH REVISIONS (CONCERNS IN PHASES 1 & 4)

  The conceptual UX foundations—Director Mode, Macro/Micro visual separation, and the physical queue representations—are phenomenal
  and perfectly tailored to deliver a spectacular academic showcase. However, you must update the SDD to fix the repository
  architecture violation, inject the InstancedMesh/Ref-based performance guards, and introduce an artifact replay fallback for live
  defense safety. Once those revisions are applied to the SDD, development is clear to proceed safely.