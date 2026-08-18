# 多波束低軌衛星節能視覺實驗室：統一產品 SDD

狀態：**IMPLEMENTED CANONICAL PRODUCT CHECKPOINT — machine gates 已通過；source-backed inter／intra replay 已接通，人工視覺驗收仍由 owner 決定**

日期：2026-08-16

實作專案：`/home/u24/demo/leo-beam-sim`

產品決策：`docs/decisions/ADR-009-unified-composable-energy-visualization-scene.md`

## 0. 一頁式最終目標

本產品是**一個**可逐層組合的多波束低軌衛星節能視覺實驗室，不是首頁、
`/simulator` 與 `/explain` 三套彼此分離的產品。

同一筆 archived-TLE／SGP4 run、同一筆 canonical frame、同一套場景物件與
同一套 SINR／Power／Throughput／angle-aware EE 計算，依照鏡頭、圖層、焦點
與解說深度形成不同畫面：

```text
乾淨畫布
  + TLE 軌道來源
  + NTPU 與地面 cells / UEs
  + 衛星 GLB 與 context satellites
  + 服務／候選／干擾波束
  + 換手 before / decision / after
  + Power / SINR / Throughput / EE 視覺層
  = 完整主場景
```

`clean`、`full`、`far`、`near`、`guided`、`explore` 與 `figure` 都只是同一
scene/runtime 的 presentation preset。簡化只能隱藏、淡化、暫停或重設鏡頭；
不得切換成假軌跡、另一套公式、另一個 renderer 或互不相干的動畫。

產品必須同時完成四件事：

1. **看得懂軌道來源**：從 constellation／日期時間／TLE epoch／SGP4 到 NTPU
   上空的衛星位置、仰角、服務機會與換手時間，不只是一個日期選擇器。
2. **調得到完整參數**：正式模型目前 17 個 canonical editable inputs 全部可找到、
   可調、可重設；衍生結果不偽裝成停用滑桿。
3. **看得到因果關係**：參數、公式、場景物件、換手狀態、Power、SINR、
   Throughput 與 EE 必須指向同一條 causal path。
4. **看得到能源如何被使用與比較**：以傳輸資料量、RF／PA／RFC／BB／event
   功率、累積能量、EE 與換手事件的共用時間軸呈現，而不是只顯示一個 EE 數字
   或以不具刻度的亮度代表一切。

一期平台只是一個結果儲存目的地。產品核心完成後，可把 accepted evidence
bundle 上傳；平台 dashboard、回饋控制與營運 KPI 不主導本產品資訊架構。

## 1. Authority 與 supersession

### 1.1 科學 authority

以下契約不由本 SDD 重寫：

1. `/home/u24/papers/modqn-paper-reproduction/docs/ADR-003-canonical-ee-closure.md`
   — EE 公式、單位、zero semantics、aggregation 與 power boundary。
2. `docs/decisions/ADR-005-tle-and-canonical-ee-simulator-contract.md`
   — archived TLE、SGP4、atomic publication、canonical inputs／derived outputs。
3. `docs/decisions/ADR-006-tle-canonical-handover-trace.md`
   — accepted TLE-run handover trace。
4. `docs/decisions/ADR-007-scientific-experience-and-figure-mode.md`
   — evidence／presentation 分離、controlled evidence 與 Figure provenance。
5. `docs/decisions/ADR-008-scene-presentation-layer-boundary.md`
   — 單一 renderer 與 presentation-only layer plan。
6. `docs/decisions/ADR-011-paper-aligned-beam-hopping-and-switch-trace.md`
   — 每顆衛星 1／7／19 完整六角波束配置、固定照射／波束跳躍情境，
   以及同衛星換束的 accepted trace 邊界；論文的 `v_max` 不作為此頁配置控制。

### 1.2 產品 composition authority

owner 接受後，ADR-009 與本 SDD 取代舊文件中下列產品邊界：

- 把 homepage、`/simulator`、`/explain` 永久視為三套體驗；
- 把 clean canvas 限制為不能逐層恢復完整主場景；
- 把完整四類控制與結果排除在 clean experience 之外；
- 把固定三個 vertical-slice stories 當成完整產品資訊架構。

既有 route 可暫時保留為 migration aliases，但不得擁有不同 scientific state、
renderer 或 formula path。`SCIENTIFIC-NARRATIVE-VERTICAL-SLICE-SDD.md` 保留為
fixture／evidence／capture 的第一個驗證切片，不再是產品架構上限。

### 1.3 Claim ceiling

- `TLE-derived SGP4` 不等於 live telemetry。
- TLE snapshot 切換不等於 satellite handover。
- current `P_sys` 是論文宣告的 payload power boundary，不是整顆衛星、地面站或
  機房 wall-plug energy。
- current UI 可以說明 energy accounting 與 controlled comparison；沒有通過
  §11 的 comparison gates，不得顯示「節省 X%」或宣稱某 policy 節能。
- 一期平台接收資料不會把本地模擬升格為量測、營運或平台 canonical KPI。
- `thesis-mc-modqn-faithful` 的 Phase-I N/A/B/C 是具 Source／transfer／endpoint
  gates 的診斷-only 訓練資料流；Gate C 通過也只代表後續 preregistration 資格，
  不構成效果、排名或勝負結果，也不提供本產品的波束配置、波束跳躍或部署排程。

## 2. User requirement traceability

| Owner requirement | Product decision | Verification |
|---|---|---|
| clean 與原主畫面是同一件事 | one runtime、one scene、layer/preset composition | clean→full 切換前後 run/frame digest 不變 |
| 可逐步加回 NTPU、cells、UE、GLB、TLE、多衛星、多波束 | §6 layer registry | `full` preset 的 required-layer contract |
| 真實選定 TLE 日期時間驅動中央場景 | TLE source flow 與 complete-run atomic publish | 改日期後 trajectory/identity/frame 一次更新 |
| 場景可簡化以解釋邏輯 | hide/dim/isolate/freeze/focus only | presentation action 不觸發 canonical rebuild |
| SINR／Power／Throughput／EE 所有合理可調參數都要出現 | 17-input canonical registry | registry exact-key test 與 two-action reachability |
| 不再是工程師欄位牆 | progressive disclosure、plain-language cards、search | viewport 與 human visual acceptance |
| 左側調參真的影響畫面與換手 | parameter causal contract + shared focus path | group-specific invariance／change tests |
| 每顆衛星波束數可調，但不能任意破壞格網 | 1／7／19 complete-ring layout presets; 7 is global default, stable satellite-ID overrides may differ | preset exact-domain、boresight-count、per-satellite identity、HPBW-spacing and atomic-rebuild tests |
| 固定照射可切換成波束跳躍，且保留 intra/inter 教學 | scenario-policy control + separate schedule/service traces | active/load invariant、same-satellite/cross-satellite event tests |
| 不會影響換手的參數也要說清楚 | truthful unchanged-state explanation | energy-only input 不製造 geometry/handover motion |
| 右側結果不跟左側分頁一起消失 | independent result dock with four persistent groups | 每個 input tab 下四個 result headers 仍可找到 |
| 節能要被視覺化 | shared time-aligned data/power/energy/EE/handover story | ledger、timeline、units、comparison gates |
| TLE 過程不能只有選日期 | far→observer→trajectory→eligibility→local service reveal | source-to-scene teaching acceptance |
| 代表 UE 可以移動並真的改變結果 | bounded scenario geometry draft through canonical UE-position override | assignment/load invariance and full downstream rebuild |
| 可用於教學與論文截圖 | same evidence, Guided/Explore/Figure projections | deterministic capture bundle + human acceptance |
| 字太小看不到 | §13 typography/target/viewport floors | computed-style、overflow、contrast、browser captures |
| 首幀不必每次重算 | source-digest-bound precomputed default artifact | cache identity/parity and first-meaningful-scene measurement |
| GLB 可以縮小但外型不能改變 | geometry-locked asset optimization | decoded geometry exact gate + fixed-camera screenshot parity |
| 一期平台只要能上傳 | secondary artifact adapter | local export succeeds before optional upload |
| 之後容易修改 | §5 deep modules and stable seams | module-interface tests and deletion test review |

## 3. Scope

### 3.1 In scope

- one unified full-screen scientific scene and compatibility-route migration;
- archived OneWeb／Starlink TLE selection, SGP4 run and visual explanation;
- NTPU observer/local substrate, selectable 1／7／19 complete-ring per-satellite beam layout,
  100 UEs and satellite GLBs; the current seven-cell scene is the default preset, not a constant;
- serving/candidate/context satellite roles, multi-beam and source-backed
  interference projection;
- accepted handover trace visualization;
- fixed-illumination／Beam-Hopping controlled scenario modes over the accepted layout,
  with a source-accounted same-satellite beam-switch trace when one occurs; the paper's
  `v_max` remains outside this scenario control;
- all 17 current canonical editable inputs and their complete results;
- bounded representative-UE movement within its assigned cell as a separately identified
  canonical scenario-geometry experiment;
- scene-linked causal focus, readable formula explanation and progressive controls;
- energy accounting and controlled A/B comparison; the same visual grammar may present a
  qualified saving only after a separate comparison/policy ADR is accepted;
- Guided、Explore、Figure and far/near camera/layer presets;
- cached first accepted frame, completed-anchor timeline and responsive UI;
- deterministic figure/local evidence export;
- later Phase-1 upload adapter after schema registration.

### 3.2 Not in scope unless separately authorized

- editing raw TLE orbital elements;
- synthetic or Walker fallback presented as accepted TLE geometry;
- MODQN training, sweeps or long empirical rollouts;
- whole-spacecraft, ground-station or facility energy beyond ADR-003;
- arbitrary topology/mobility controls that create a second scenario;
- operational Starlink／OneWeb Beam Hopping claims, a learned scheduler, or a hopping energy
  term not declared by the paper/runtime authority;
- user-editable handover offset/TTT until a policy-experiment authority permits it;
- a qualified energy-saving claim before a separate comparison/policy ADR freezes the causal
  intervention, baseline/candidate identity, service-equivalence gates, interval and boundary;
- candidate/context satellites silently becoming active interferers;
- live Phase-1 feedback control, dashboard redesign or operational KPI claims;
- decorative animations that imply a scientific effect unsupported by the frame.

### 3.3 Current implementation truth table (2026-08-16)

本節是目前程式狀態的基準，不是目標功能的宣稱。任何尚未通過 canonical runtime
驗證的區域都必須標示為 mock／pending，不能因為畫面有相同欄位就視為已接上真實資料。

| Surface / capability | Current truth | Allowed use before the corresponding gate |
|---|---|---|
| global／far orbital view | **real** — consumes the accepted archived-TLE／SGP4 run and does not use a mock satellite fallback | 可作為真實 TLE 來源與軌道身份的現況展示 |
| local／near NTPU scene | **real model projection** — satellite identity, topocentric geometry, links, handover state and render DTO all consume the same accepted frame; the current seven-cell／100-UE substrate is a declared default experiment preset, not a measured NTPU network | 可用於教學與模型證據；不可宣稱為實測佈建或即時遥測 |
| left progressive controls | **implemented** — Scene／Handover／SINR／Power progressive taxonomy reaches exactly 17 canonical editable inputs through the single session transaction | draft 與 accepted 值分離；衍生 Throughput／EE 不出現為可調控制 |
| right result dock | **implemented canonical projection** — persistent service／candidate identity plus independently collapsible Handover／SINR／Power／Throughput／EE groups read one immutable snapshot | 可顯示模型結果與 controlled A／B；不得自動升格為節能成效 |
| timeline／event／source bookmarks | **implemented with real evidence** — 241 common anchors, ratio-of-sums energy accumulation, source-derived service-change markers and geometry-diverse archived-TLE bookmarks; no Walker or synthetic marker | 只有 complete accepted run 可操作時間軸；pending 時鎖住 transport |
| Guided／Explore story runtime | **source-backed inter- and intra-handover implemented** — cross-satellite replay consumes accepted service-change anchors；same-satellite replay is published only when one accepted `BeamScheduleTrace` proves the same UE、same satellite、different beam and exact before／decision／after anchors. The central scene focuses that trace UE and its realized beam at each story beat | 可重播有完整 identity／metric anchors 的 inter event 與 same-satellite beam switch；沒有 qualifying service-pair transition 時 intra 保持不可用，schedule-only change 不得稱為換手 |
| one-input causal replay | **implemented with accepted frame comparison** — the replay library launches link-gain or per-beam-power-cap A／B through `VisualLabSession`; it freezes A, changes exactly one canonical input, waits for the complete accepted B publication, applies comparison gates, projects Throughput／Power／instantaneous-EE／serving-SINR, and restores the baseline on restart or exit. Exact A/B publications are retained in a six-entry, geometry-bound in-memory cache, so returning to an already accepted side atomically restores its complete run rather than recomputing or mixing projections. Directed and free camera modes consume the same scene plan | 可教學式觀察同一場景的 frame-level 因果差異；frame gate 失敗時不顯示替代數字，evaluation-interval gate 未通過時不得宣稱區間節能成效 |
| beam-layout and fixed／Beam-Hopping scenario policy | **homogeneous／heterogeneous layouts and fixed／Beam-Hopping publication integrated** — global 1／7／19 defaults and stable satellite-ID overrides rebuild eligible beams、association、load、active mask、canonical metrics and a digest-bound 241-slot `BeamScheduleTrace` in one accepted run. Analysis-only edits reuse accepted TLE geometry／PassPlan in a Worker and publish atomically | 可比較一致或異質 1／7／19 專案場景及固定／波束跳躍情境；不得稱為 operational constellation schedule。19 目前只有完整兩圈 topology 與 HPBW-spacing metadata，未把 spacing 接入 physical ground boresight 前不得稱完整 3GPP baseline；candidate 仍是單鏈路反事實比較，在 joint interference gate 完成前不得稱為異質多星共同運算 |
| Figure／Clip export | **Implemented and browser-verified** — Figure exports one PNG／JSON／CSV／manifest ZIP from the accepted evidence and presentation plan. The bilingual replay shelf launches the existing inter／intra or causal runtime; an active replay can be restarted and captured as a 1280×720 VP8 WebM with a separate provenance manifest in one ZIP. Capture is enabled only after the complete accepted run, required GLBs, and (for causal A／B) the source-backed comparison are ready. | 圖稿與回放均來自同一 accepted evidence；跨衛星、同衛星換束與鏈路增益 A／B 已實際產生可解碼 WebM，回放中的階段、鏡頭與 SINR／Power／Throughput／EE 跟隨同一 runtime 變化，且 ZIP 保留 run／frame／story／source identity。 |
| default and repeated experiment latency | **implemented and live-checked** — the default archived-TLE first frame is a checked, immutable artifact and the complete run continues in the Worker. Within one accepted geometry, an exact previously accepted parameter/frame-options run is restored atomically from the bounded experiment cache. A live power-cap replay restored A and returned the session to `ready` in about 0.8 s after B had been accepted | 首幀與已計算過的 A/B 可用於現場展示；新的 source/time or never-before-seen experiment combination still waits for its complete accepted Worker publication |

本表每次實作 checkpoint 必須更新；更新只能反映通過的測試或人工驗收，不得用
「看起來已完成」取代 evidence gate。global 與 local 是同一場景的兩個尺度，不是
兩個獨立頁面或兩個 scientific runtime。

## 4. Domain vocabulary and state ownership

| Term | Meaning | Owner |
|---|---|---|
| `AcceptedRun` | complete archived-TLE SGP4 run and run evaluation | canonical runtime |
| `AcceptedFrame` | one immutable analysis anchor shared by all projections | canonical runtime |
| `ExperimentDraft` | unapplied source/parameter edits | interaction module |
| `PendingRun` | rebuild in progress; never mixed with accepted values | canonical run controller |
| `SceneEvidence` | renderable projection of accepted run/frame/trace | scene projection module |
| `PresentationState` | camera, focus, visible layers, motion, explanation depth | scene composition module |
| `LayerPlan` | reversible list of visible/emphasized scene layers | presentation preset registry |
| `FocusPath` | one subject mapped across control, formula, scene and results | causal focus module |
| `EnergyStory` | time-aligned delivered data, power, energy, EE and events | energy-story module |
| `BeamEligibility` | scenario-policy output that constrains which physical beam positions may serve in one accepted slot; it is not canonical `z` | beam-scenario module |
| `RealizedBeamState` | per-UE association, positive load and derived active mask satisfying `z=1 iff U>0`; paper-only `v_max` is not a Visual Lab control | canonical scenario adapter |
| `BeamScheduleTrace` | eligible set, realized active set, load and service identities at accepted anchors | accepted analysis run |
| `ComparisonPair` | accepted baseline A and candidate B plus identity gates | comparison module |
| `CaptureState` | frozen evidence + presentation plan + provenance | artifact module |
| `PlatformReceipt` | optional registered upload response | platform adapter |

Evidence state, draft state, presentation state, comparison state and capture state are
separate. Presentation actions never recalculate evidence. Scientific draft changes never
publish partial results. Capture state never becomes a new calculator.

## 5. Deep-module architecture

本次重構採取**一個 route-facing deep module，內部保留可測試的 visual/scientific
collaborators**。這讓畫面可以依語意拆解，但不把 frame identity、計算順序與錯誤
處理暴露給多個 route 或 UI caller。

### 5.1 The only route-facing module

```ts
interface VisualLabSession {
  snapshot(): LabSnapshot;
  subscribe(listener: (snapshot: LabSnapshot) => void): () => void;
  dispatch(command: LabCommand): Promise<DispatchResult>;
}
```

Factory construction is not a fourth runtime entry point. React、controls、results、timeline、
the single R3F renderer and route aliases all consume this same interface.

`LabSnapshot` is an immutable read model:

```ts
interface LabSnapshot {
  phase: 'idle' | 'cache-ready' | 'rebuilding' | 'ready' | 'rejected';
  accepted: AcceptedEvidenceView | null;
  draft: ExperimentDraftView;
  presentation: PresentationView;
  scenePlan: ScenePlan | null;
  results: ResultProjectionView;
  energy: EnergyStoryView;
  comparison: ComparisonView;
  capture: CaptureView;
  error: LabError | null;
}
```

Raw `TleAnalysisRun`, `SimulationAnalysisFrame`, handover producer, rebuild methods and
canonical evaluators remain implementation details. A caller cannot combine a scene from one
frame with results from another.

`LabCommand` is a finite discriminated union for source/input draft edits, apply, seek,
presentation/focus, baseline/candidate, capture, reset and export. Adding a command requires a
declared state owner and observable interface-level test; arbitrary callback injection is not
allowed.

### 5.1a Semantic story-command interface

故事是同一個 session 的可重現 presentation script，不是另一個頁面、另一個計算器或
預先錄好的科學結果。故事定義只描述語意目標；它不得依賴 DOM selector、CSS class、
按鈕座標、卡片順序或任何 pixel 座標，因此版面調整不會使故事失效。

```ts
interface StoryDefinition {
  id: string;
  evidenceRequirements: readonly EvidenceRequirement[];
  steps: readonly StoryStep[];
}

interface StoryStep {
  id: string;
  command: StoryCommand;
  observation: StoryObservation;
  expected: StoryExpectation;
}

type StoryCommand =
  | { type: 'selectSourceBookmark'; bookmarkId: string }
  | { type: 'setSceneScale'; scale: 'far' | 'near' }
  | { type: 'setLayerPreset'; preset: LayerPresetId }
  | { type: 'setCameraCue'; cue: CameraCueId }
  | { type: 'focusEntity'; entity: FocusEntity }
  | { type: 'openResultGroup'; group: ResultGroupId }
  | { type: 'applyControlledProbe'; input: CanonicalInputKey; value: number };
```

`StoryRuntime` 只把上述語意 command 送入 `VisualLabSession.dispatch()`，並在每一步
記錄 accepted frame identity、presentation state、預期觀察與 unavailable/rejected
原因。`applyControlledProbe` 仍須遵守正式 draft／apply／atomic publication 交易；故事
不得直接寫結果數字。每個 story step 必須能 pause、inspect、fork、reset，並能在同一個
accepted snapshot 上交還給 Explore。

故事輸出與影片輸出分離：Clip 是從已驗證 StoryRuntime 播放狀態產生的 capture side
effect，不能反過來成為證據來源。若資料或 handover trace 不存在，story step 必須顯示
`unavailable`，不得以預錄動畫或 mock 值補齊。

### 5.2 Private collaborators

The session implementation may use these private modules/seams:

| Private collaborator | Owns | Must not own |
|---|---|---|
| canonical transaction controller | cache identity, cancellation, complete-run rebuild, stale-request rejection, atomic publication | presentation or DOM |
| experiment schema | 17 inputs, results, symbols, units, bounds, defaults, owners and causal contracts | current values or calculation |
| `ScenePlanCompiler` | accepted evidence + presentation intent → typed semantic `ScenePlan` | a stored second world or scientific recalculation |
| causal mapper | one focus subject → control/formula/scene/result/timeline targets | new numbers or mutation |
| energy-story projector | accepted delivered-data/power/energy/EE/event projections | another EE definition |
| comparison/capture state | A/B identity gates, frozen figure evidence and provenance | unregistered saving policy |

They may be separate files and independently tested internally, but are not seven public
product interfaces. Their outputs are assembled into one `LabSnapshot` before publication.

### 5.3 Real adapters

- Archived-TLE/cache reading has browser and in-memory test adapters.
- GLB/asset loading may have browser and deterministic test adapters inside the renderer.
- Local artifact download and future Phase-1 upload are two real output adapters behind one
  artifact-writer port.
- React/R3F is a presentation adapter over `VisualLabSession`; no renderer-replacement port is
  created because the product explicitly owns one renderer.

### 5.4 Depth and deletion tests

- Deleting `VisualLabSession` would force request races, cache validation, source/input
  transactions, accepted identity, presentation, comparison and capture coordination back
  into several routes; therefore the facade earns its seam.
- Parameter/result metadata and causal ownership are defined once inside the schema and never
  copied into route-local cards.
- Visual layer files remain internal renderer implementation, not public capabilities.
- Parameter cards, result cards, mesh primitives and one-use wrappers remain internal unless
  a real second adapter/caller appears.
- Tests cross `snapshot / dispatch / subscribe`; internal pure compiler tests supplement but
  do not replace facade behavior tests.

**Checkable completion criterion:** active product routes obtain accepted evidence only from
one `VisualLabSession`; its public runtime interface remains the three entry points above;
every published snapshot is internally identity-consistent; no new public seam is accepted
without two real adapters or independent callers.

## 6. One scene, reversible layer stack

### 6.1 Normative layers

| Order | Layer | Evidence source | Clean/full behavior |
|---:|---|---|---|
| 1 | base stage and reference axes | presentation + declared coordinate frame | always available; axes optional |
| 2 | Earth/orbital context | accepted TLE run | hidden in local clean view; visible in far/source view |
| 3 | TLE trajectory and epoch | accepted SGP4 samples/provenance | revealed during TLE explanation/full context |
| 4 | NTPU observer/horizon/terrain | accepted observer + visual asset | minimal observer in clean; full substrate on add-back |
| 5 | per-satellite beam-footprint/service substrate | accepted 1／7／19 layout preset and scenario mapping | isolated focus or full selected layout; seven is the default preset |
| 6 | 100 UEs and representative focus | canonical assignment/load | aggregate, focused subset or full population |
| 7 | serving/candidate/context satellite GLBs | accepted identities/positions/roles | selected pair or full context set |
| 8 | serving and candidate beams | canonical ownership + bounded comparison | focused link, selected 1／7／19 per-satellite layout, optional candidate fan |
| 9 | co-channel interference | canonical reuse/ownership matrices | hidden, focused sources or full eligible set |
| 10 | handover trace | accepted ADR-006 trace | before/decision/after only when available |
| 11 | link and formula annotations | accepted frame + private experiment schema | one term, causal chain or full overlay |
| 12 | energy/data timeline and figure annotations | EnergyStory + CaptureState | compact, expanded or figure-frozen |

Layer toggles modify only `PresentationState`. They cannot change frame digest, satellite
ownership, beam membership, UE assignment, interference membership, handover decision,
power, rate or EE.

### 6.2 Presets are not pages

| Preset | Purpose | Typical layers |
|---|---|---|
| `clean` | isolate one scientific relationship | base, observer, representative link, focused annotation |
| `source` | explain TLE → SGP4 → observer opportunity | Earth, TLE trajectory, observer, identities |
| `local-service` | explain NTPU/cells/UE/beam ownership | terrain, cells, UEs, selected/context satellites, beams |
| `interference` | explain reuse and co-channel contributors | cells, beams, reuse colours, source-backed interference |
| `handover` | explain candidate qualification and ownership transfer | local service + accepted trace + event timeline |
| `energy` | connect delivered data to power and cumulative energy | focused service scene + energy/data timeline |
| `full` | recover the complete product composition | every available authoritative layer |
| `figure` | freeze one argument with readable annotations | any declared layer plan, no transient chrome |

`far` and `near` are camera/coordinate-projection presets over the same accepted evidence.
The transition may visibly rebase from Earth scale to the NTPU local frame, but it must
retain time, satellite identity and frame provenance and disclose the recentered projection.

### 6.3 Visual decomposition compiles to one typed scene plan

Visual concepts are modular inside the single renderer, but they do not become public
capabilities. A pure private compiler receives accepted evidence and presentation intent:

```ts
function compileScenePlan(
  evidence: Readonly<AcceptedEvidenceView>,
  presentation: Readonly<PresentationView>,
): ScenePlan;
```

`ScenePlan` contains a finite discriminated union of semantic nodes:

```ts
type SceneNode =
  | EarthNode
  | OrbitNode
  | SubstrateNode
  | SatelliteNode
  | CellNode
  | UeNode
  | BeamNode
  | InterferenceNode
  | HandoverNode
  | EnergyNode
  | AnnotationNode
  | UnavailableNode;
```

One exhaustive `ScenePlanRenderer` in one R3F Canvas renders the union. Internal files may be
organized as `OrbitLayer`, `TerrainLayer`, `SatelliteLayer`, `BeamLayer` and similar visual
concepts, while meshes, labels and effects remain private primitives.

Every node carries evidence references and role. Unsupported evidence becomes an explicit
`UnavailableNode`, never a zero placeholder. The compiler cannot fetch data, rebuild TLE or
formulas, decide ownership, store accepted state, or emit synthetic handover/energy evidence.

Layer disposition is richer than a boolean:

```text
hidden | visible | dimmed | frozen | focused
```

The plan also declares camera safe-frame, coordinate projection, motion/reduced-motion and
focus targets. Presets need not be monotonic additions; `far`, `near`, `handover` and `figure`
may emphasize different subsets while preserving accepted identity.

The 12 rows in §6.1 are user-facing semantic groups. The current renderer's lower-level mount
IDs such as candidate footprints, ambient beams, event effects and load overlays remain
private implementation details mapped into those groups. S1 must freeze one finite mapping;
the product must not expose both lists as competing layer state or create a general plug-in
framework.

## 7. TLE-to-scene experience

### 7.1 Source controls

Scenario controls are separate from the 17 formula parameters:

| Control | Scientific role | Apply behavior |
|---|---|---|
| Constellation | selects archived OneWeb or Starlink catalog | replaces catalog, TLE pairs, run and all downstream analysis atomically |
| Archived date/time | selects requested UTC instant with visible Asia/Taipei representation | resolves one publication and complete two-hour run before publication |
| Display timezone | presentation only | never changes the UTC instant or result |

Constellation/date/time remain draft values until explicit `套用衛星資料` action. During
rebuild, the previous accepted run remains intact, timeline transport is locked, and progress
is visible. Failure retains the previous run and states why the draft was not accepted; it
never substitutes generated geometry.

### 7.2 Visual transformation

TLE explanation uses one continuous evidence identity and four linked projections:

1. **Archive token** — constellation, publication, requested instant, resolved TLE epoch and
   satellite identity.
2. **Orbital propagation** — selected samples appear on Earth-scale trajectories; the user
   can distinguish Starlink and OneWeb orbital organization without treating dots as live
   telemetry.
3. **Observer opportunity** — NTPU observer, horizon, elevation and eligibility window are
   revealed; excluded/context/service candidates keep distinct roles.
4. **Local service projection** — camera visibly rebases into the NTPU service scene while
   retaining accepted time and identities; cells and beam footprints remain declared
   experimental display mappings rather than TLE-derived physical footprints.

The user can reverse this sequence by hiding layers or changing the camera. Returning from
near to far view must not load another route or replace the run.

### 7.3 Timeline and computation completeness

- One accepted run contains 241 common anchors at 30-second spacing across 7,200 seconds.
- Playback may interpolate completed geometry for smooth motion; quantitative labels remain
  attached to an identified accepted anchor.
- The user cannot scrub beyond completed authoritative anchors.
- The normal presentation may reveal the timeline only after the full run is accepted; if
  progressive computation is later allowed, the playable extent must end at the last
  complete common anchor across every required satellite and analysis field.
- The first default run shall be precomputed and content-addressed by source digest, requested
  instant, model revision and parameter digest. Cache mismatch fails closed and starts the
  normal rebuild; it never shows a stale first frame as current evidence.

## 8. Complete canonical control surface

### 8.1 Inventory contract

The private experiment schema contains exactly 17 current editable formula inputs. Each appears once as
the canonical control owner and may be linked from other domains without creating a second
mutable field.

| Domain owner | User-facing control | Thesis symbol | Runtime field | Unit | Current UI bound/default |
|---|---|---|---|---|---|
| SINR | 頻率重用群組數 | `K_FR` | `frequencyReuse` | integer groups | `1–7`; `3` |
| SINR | 天線雜訊溫度 | `T_ant` | `antennaNoiseTemperatureK` | K | `1–2000`; `150` |
| SINR | 接收器雜訊指數 | `NF` | `noiseFigureDb` | dB | `0–20`; `1.2` |
| SINR | 雜訊參考溫度 | `T_0` | `noiseReferenceTemperatureK` | K | `1–2000`; `290` |
| SINR | 波束中心發射增益 | `G_0` | `g0Linear`, UI converts dBi once | dBi | `0–40`; `33.0103` |
| SINR | 完整 3 dB 波束寬度 | `theta_3dB` | `theta3dbRad`, UI converts degrees once | degree | `1–20`; `3.32` |
| SINR | 載波頻率 | `f_c` | `carrierFrequencyGHz` | GHz | `1–100`; `20` |
| SINR | 大氣衰減係數 | `chi_atm` | `atmosphericZenithLossDb` legacy name | dB/km | `0–1`; `0.05` |
| SINR | 接收天線增益 | `G^R_dBi` | `receiveGainDbi` | dBi | `-10–60`; `35` |
| Power | 單波束功率上限 | `P_beam,max` | `beamPowerCapW` | W | `0.001–20`; `1.65` |
| Power | 單衛星功率上限 | `P_sat,max` | `satellitePowerCapW` | W | `0.001–40`; `19.952623` |
| Throughput | 最低傳輸速率目標 | `R_min` | `minimumRateBps` | bit/s | `1 kbit/s–10 Mbit/s`; `1 Mbit/s` |
| Throughput | 系統頻寬 | `B_sys` | `systemBandwidthHz` | Hz | `1 MHz–2 GHz`; `500 MHz` |
| EE | PA 效率上限 | `eta_max` | `etaMax` | ratio | `0.01–1`; `0.35` |
| EE | PA 輸出回退 | `BO` | `backoffDb` | dB | `0–10`; `5` |
| EE | 每個啟用波束的 RF chain 功率 | `P_RFC` | `rfcPowerW` | W/active beam | `0.001–10`; `0.338` |
| EE | 每顆啟用衛星的 baseband 功率 | `P_BB` | `basebandPerSatelliteW` | W/satellite | `0.001–20`; `0.2` |

These ranges are experiment/UI bounds, not claims that the complete mathematical domain has
the same limits. Every card names its source and distinguishes thesis identity, cited mapping
and project assumption.

### 8.2 Card anatomy

Every parameter card contains:

1. plain Chinese name and thesis symbol;
2. current draft value and unit;
3. synchronized slider and numeric input where the range supports both;
4. min/max/step/default and local reset;
5. one concise `作用` statement;
6. one causal path showing the quantities that can change;
7. source/provenance disclosure;
8. Draft／Applied／Recomputing／Unavailable／Invalid status;
9. `在場景中顯示` and `查看相關結果` actions.

The UI shall not repeat generic prose such as “these controls affect the same canonical
frame” on every card. That invariant is explained once at the experiment level.

### 8.3 Progressive disclosure without hiding parameters

- `重點參數` orders a small set relevant to the current visual question.
- Its header states the number shown and the number additionally available, for example
  `目前聚焦 5 項；另有 12 項 canonical 參數`.
- `全部參數` exposes the complete searchable 17-input index in at most two actions from the
  main scene.
- Changing disclosure depth preserves draft values, accepted frame, comparison slots, scene
  layers and camera.
- Shared parameters appear once. Cross-domain links scroll/focus the owner card rather than
  rendering duplicate sliders.
- Compatibility-only fields may appear in a provenance inspector, labelled `未進入目前正式
  計算`; they never appear as disabled controls in the primary flow.

### 8.4 Derived values are results, not controls

The following remain read-only: selected range/elevation/off-axis angle, `G^LS`, `h`, linear
receive gain, `G_T(theta)`, `B_beam`, `T_sys`, noise power, `gamma_req`, `p_req`, beam request,
pre-satellite-cap RF, actual RF, signal, `I_intra`, `I_inter`, total interference, SINR, rate,
QoS/power-limited state, PA efficiency, PA input, `P_sys`, instantaneous EE, evaluation EE,
active beam count, ownership, load and handover result.

They are shown in formula explanations, causal focus and the result dock. They are never
presented as greyed-out sliders.

### 8.5 Explicitly excluded historical controls

- direct `P_t` / `maxTxPowerDbm` actual-power override;
- direct `eta_PA` override;
- independent beam bandwidth or `N_0` controls;
- legacy `P_circuit` teaching ledger;
- scintillation, shadow-margin and `channelGainScale` compatibility fields;
- alternative beam-gain model selector, steering-angle and scan-loss controls absent from
  the current canonical closure;
- scalar `U_b`, arbitrary topology count and Walker mobility controls;
- Walker/HOBS hopping profiles or a direct editable canonical `z` vector;
- arbitrary offset/TTT controls outside an accepted policy experiment.

Removing these is scientific ownership correction, not a reason to remove the 17 valid
canonical inputs.

### 8.6 Original-main-screen reconciliation

The original main screen is a **completeness donor and regression inventory**, not a formula
authority. Every historically editable control must receive one explicit disposition; none
may silently disappear, but not every one may remain editable.

| Historical editable concept | Final disposition | Reason |
|---|---|---|
| direct `P_t` / `maxTxPowerDbm` | replaced by `P_beam,max` and `P_sat,max` | actual RF is derived after request and caps |
| direct beam bandwidth | replaced by editable `B_sys`; show derived `B_beam=B_sys/K_FR` | prevents duplicate bandwidth/noise ownership |
| direct `N_0` / noise PSD | replaced by `T_ant`, `NF`, `T_0` | canonical physical-noise construction |
| legacy frequency | retained as `f_c` | consumed by current channel path |
| legacy max transmit gain | retained as `G_0` with one dBi↔linear conversion | same canonical concept and one owner |
| legacy beamwidth | retained as full `theta_3dB` | current angle-aware antenna input |
| legacy receive gain | retained as `G^R_dBi` | consumed by current link path |
| legacy atmospheric loss | retained as `chi_atm`; remove independent enable toggle | formal loss term stays in the frozen equation |
| legacy reuse `K` | retained once as `K_FR` | shared bandwidth/noise/interference input |
| direct `eta_PA` | replaced by `eta_max` and `BO`; actual efficiency is derived | preserves canonical PA curve |
| legacy fixed `P_circuit` | replaced by `P_RFC` and `P_BB`; event term remains declared separately | current power boundary uses explicit components |
| scintillation / shadow margin / `channelGainScale` | compatibility/provenance only; no control | current formal adapter does not consume them |
| clutter-loss profile, gain-model selector, steering and scan-loss controls | excluded until a new formula/scenario authority exists | not inputs of the active canonical closure |
| topology counts, scalar load and Walker mobility controls | excluded from formula tabs; scenario/trace owns topology | would create a second scenario/state path |
| fixed illumination／Beam Hopping mode | retained once as a scenario-policy control under ADR-011, not a formula tab input | changes eligible beam positions, then rebuilds association, load, active mask and all canonical results |
| handover offset/TTT policy controls | read-only trace evidence until a policy experiment is authorized | current ADR-006 trace owns the fixed decision contract |

Implementation acceptance requires a machine-readable crosswalk from the exact historical UI
inventory to `retained / renamed / split / derived / compatibility / removed`. The crosswalk
must also prove the reverse direction: all 17 fields in §8.1 have an active control even if the
old main screen never exposed them.

### 8.7 Scene interactions are classified separately

Not every useful interaction is one of the 17 formula inputs.

| Interaction | Classification | Scientific behavior |
|---|---|---|
| drag the declared representative UE inside its assigned cell | bounded scenario-geometry input | draft ghost, then canonical rebuild through `userPositionOverridesKm` |
| select/focus a satellite, beam, cell or UE | presentation | changes focus only |
| pause/play/speed/camera | presentation | changes display time/camera only; quantitative anchor remains identified |
| show fewer context satellites or hide beam layers | presentation | filters visibility only; active ownership is unchanged |
| select 1／7／19 beams per satellite | authorized scenario-layout input under ADR-011 | rebuilds complete-ring boresights, footprints, assignment, interference and downstream results atomically; it is not thesis `v_max` |
| switch fixed illumination／Beam Hopping | authorized scenario input under ADR-011 | rebuilds eligible positions, assignment, load, active mask, interference, power, rate, EE and traces atomically |
| enter an arbitrary beam count or edit active satellite/beam/UE ownership directly | unavailable | partial rings or number-only custom drops bypass ADR-011 geometry/policy and create an unowned topology state |
| retarget a canonical beam or add arbitrary UE mobility | unavailable without new scenario/policy authority | would require new assignment and trace contracts |

The bounded UE probe preserves all 100 UEs, the selected accepted beam-layout cells, the scenario policy,
satellite ownership and TLE trajectory. Only the declared UE position changes within its current
cell; the canonical rebuild may consequently change its service assignment and the derived
load/active state. Apply rebuilds angle/channel matrices and every affected downstream result
through `VisualLabSession`; `/explain` or a visual layer may not calculate it locally.

## 9. Parameter-to-scene causal contract

### 9.1 Shared transaction

Every scientific control follows the same transaction:

```text
select/focus control
  -> highlight its formula term, scene target and dependent result groups
  -> edit ExperimentDraft
  -> show the draft value and the declared dependency path only; no predicted numeric result
  -> explicit Apply, slider commit or keyboard Enter
  -> one canonical rebuild
  -> atomically publish AcceptedRun/AcceptedFrame
  -> animate only source-backed before/after consequences
```

The accepted scene stays visible while pending. Draft and accepted values are visually
distinct. No panel may show a new input beside old calculated values as though they belonged
to one frame. A rejected draft keeps the accepted scene and explains the violated field or
source rule.

### 9.2 Causal response matrix

| Input | Visible response | Geometry / handover invariants | Quantitative path |
|---|---|---|---|
| constellation / archived instant | Earth orbit, trajectory, satellite GLBs, source token, NTPU elevation window and roles update together | starts a new run; not counted as handover | new geometry feeds the entire canonical graph |
| representative UE position | the accepted UE marker and focused link angle move after Apply; draft uses a distinct ghost | remains in the assigned cell; counts/load/ownership/TLE stay fixed; trace may change after rebuild | UE position → off-axis/channel matrices → RF/SINR/rate/P_sys/EE |
| `K_FR` | reuse colours/patterns, co-channel membership and interference links update | cells/UEs/orbits stay fixed; trace may change after rebuild | `K_FR → B_beam, noise, I → gamma_req, RF, SINR, rate, P_sys, EE` |
| `T_ant` | noise-temperature/noise-floor explanation moves | no geometry; trace changes only if realized serving/candidate evidence changes | `T_ant → T_sys → noise → RF/SINR/rate/EE` |
| `NF` | receiver-noise contribution changes | same as above | `NF → T_sys → noise → RF/SINR/rate/EE` |
| `T_0` | reference-temperature contribution changes | same as above | `T_0 → T_sys → noise → RF/SINR/rate/EE` |
| `G_0` | gain-pattern/cross-section and focused link-gain annotation change | no TLE/cell/UE movement; no fake footprint resize | `G_0 → G_T → h → RF/SINR/rate/EE` |
| `theta_3dB` | readable antenna-pattern cross-section shows the changed half-power width and current off-axis sample | fixed cell display mapping and orbit remain fixed; trace may change through SINR | `theta_3dB → G_T(theta) → h → RF/SINR/rate/EE` |
| `f_c` | wavelength/path-loss explanation and link loss bar change | not a TLE field; no orbit movement | `f_c → G^LS → h → RF/SINR/rate/EE` |
| `chi_atm` | atmosphere segment of the loss path changes | no geometry | `chi_atm → G^LS → h → RF/SINR/rate/EE` |
| `G^R_dBi` | receive-side gain marker and link budget change | no geometry | `G^R → h → RF/SINR/rate/EE` |
| `P_beam,max` | beam-cap gauge and requested/pre-cap/actual marks show whether the cap binds | no orbit/cell motion; trace can change only when resulting SINR changes | cap → actual RF → signal/I/SINR/rate/PA/P_sys/EE |
| `P_sat,max` | satellite aggregate-cap gauge and per-beam scaling appear when binding | no geometry; non-binding default may legitimately show no downstream change | satellite cap → actual RF → signal/I/SINR/rate/PA/P_sys/EE |
| `R_min` | service target line, QoS qualification and power-request path update | no geometry; accepted trace may change through serving/candidate SINR and qualification | `R_min → gamma_req → p_req → actual RF → rate/P_sys/EE` |
| `B_sys` | bandwidth allocation and noise/rate explanation update | no geometry | `B_sys,K_FR → B_beam → gamma_req,noise → RF/SINR/rate/EE` |
| `eta_max` | PA-efficiency curve, PA input and power ledger update | SINR/rate/geometry/handover remain unchanged | `eta_max → eta_PA → P_PA → P_sys → EE` |
| `BO` | operating point on the PA curve and power ledger update | SINR/rate/geometry/handover remain unchanged | `BO → eta_PA → P_PA → P_sys → EE` |
| `P_RFC` | RFC segment of per-beam/system power and cumulative energy update | geometry/SINR/rate/handover remain unchanged | `P_RFC × active beams → P_sys → energy/EE` |
| `P_BB` | baseband segment of satellite/system power and cumulative energy update | geometry/SINR/rate/handover remain unchanged | `P_BB × active satellites → P_sys → energy/EE` |

An unchanged result is an observation, not an error. The UI must state the scientific reason,
for example `此項只改變 PA 耗能，因此目前 SINR 與換手保持不變`, without using
developer-facing prose or pretending that an unrelated object moved.

### 9.3 Shared focus path

A control, formula term, result row, satellite, beam, UE, timeline event or energy segment can
select one `FocusPath`. That path highlights:

- the single canonical owner card;
- the relevant formula term(s);
- source-backed scene entity or explanatory cross-section;
- dependent result-group headers and changed values;
- relevant point or interval on the timeline.

Pointer, keyboard and touch focus produce the same mapping. Focus is presentation state and
does not mutate the run.

## 10. Information architecture and result dock

### 10.1 Six surfaces in one product

1. **Scene stage** — dominant 3D world and scientific focus.
2. **Source strip** — compact constellation/time/accepted-state control.
3. **Control drawer** — SINR／Power／Throughput／EE plus layer controls and full index.
4. **Result dock** — independent persistent result groups; never coupled to the selected
   control tab.
5. **Time and energy strip** — playback, handover events, delivered data, power and energy.
6. **Explanation/capture overlay** — contextual teaching and deterministic figure annotation.

These surfaces can collapse or move into sheets. They are not separate pages or scientific
states.

### 10.2 Control navigation

- The primary categories remain `SINR / Power / Throughput / EE`.
- Category labels use Chinese explanations alongside thesis symbols; formulas use editable
  LaTeX/KaTeX rendering and never expose raw underscores.
- `幾何實驗`、`場景圖層` and `全部參數` are tools beside the four scientific domains,
  not competing chapter navigation. `幾何實驗` contains the bounded representative-UE probe
  and clearly separates it from presentation-only layer/camera controls.
- The current four fixed story buttons are not the final top-level information architecture.
- A selected teaching story may temporarily order and focus controls, but it cannot hide the
  full index.

### 10.3 Result dock is independent of controls

All four headers and their headline values remain discoverable regardless of the active input
category. Groups are independently collapsible and preserve their open state.

| Result group | Headline | Expanded detail, without duplicates |
|---|---|---|
| Link / handover status | serving/candidate identities, current role, current trace phase | elevation, margin, fixed offset, TTT countdown/progress, event/count when trace-backed |
| SINR | serving realized SINR and candidate comparison when available | receive-side signal power, intra/inter/total interference, noise, relevant gain/channel terms and reuse group |
| Power | actual downlink RF and `P_sys` | requested power, beam cap, pre-satellite-cap, actual RF, PA input, RFC, BB and declared event boundary |
| Throughput | representative-link rate and system throughput | `R_min`, `B_sys`, derived `B_beam`, QoS status and accumulated delivered bits |
| EE | instantaneous EE and accumulated evaluation EE | cumulative energy, evaluation interval and identity validity; no repeated full formula |

The top status block appears once. `計算結果` is not repeated under each card. Serving and
candidate values use consistent columns only where the candidate field is source-backed.
Unavailable values show a precise state, not `0`, an empty box or a fabricated fallback.

`P_event = 0` is a current model-boundary fact, not a primary metric. It belongs in the
expanded power-boundary disclosure and does not occupy headline space.

### 10.4 Desktop, tablet and mobile composition

**Desktop 1440×900 and wider**

- scene is the visual anchor and retains at least 52% of usable width when both docks are open;
- the control drawer is approximately 360–420 px when open and collapses to a narrow labelled
  affordance;
- the result dock is approximately 340–400 px and may collapse to five headline rows;
- camera safe framing reacts to open docks so the selected link is not hidden;
- the time/energy strip is attached to the scene, not buried below an unrelated page.

**Tablet**

- landscape shows the scene with one open drawer at a time;
- portrait keeps the scene in the upper half and uses a bottom dock for Controls, Results,
  Layers and Compare;
- scientific labels wrap; no horizontal field wall.

**Mobile**

- scene appears in the first viewport at approximately 42–48vh;
- bottom navigation opens Controls, Results, Layers and Compare as explicit sheets;
- the full 17-input index remains reachable and searchable;
- no feature depends on hover or an undisclosed gesture.

### 10.5 Fixed five-zone composition contract

版面尚未 pixel-perfect 時，先固定以下五個**語意區域**。這是穩定的 layout contract，
不是要求永遠使用五個 DOM container；在 tablet/mobile 可以把區域轉成 drawer、sheet 或
bottom dock，但語意與入口不能消失。

| Zone | Persistent responsibility | Must not become |
|---|---|---|
| `source-strip`（上方） | constellation、TLE source/bookmark、run phase、目前尺度與故事／Explore 狀態 | 一堆 raw IDs 或只顯示「已接受」的裝飾列 |
| `control-drawer`（左側） | progressive Scene／Handover／SINR／Power controls；draft、Apply、reset 與因果焦點 | 隨 active tab 消失的唯一參數入口，或由結果值冒充 slider |
| `scene-canvas`（中央） | 同一 accepted evidence 的全球／NTPU 尺度、衛星、UE、beam、handover、energy layers | 與左右欄各自運算的背景動畫或第二個 runtime |
| `result-dock`（右側） | 固定可尋址的 Link/Handover、SINR、Power、Throughput、EE read-only 結果 | 因左側 tab 改變而消失的結果，或重複三次的同一數值 |
| `story-rail`（底部） | accepted-anchor timeline、energy/data markers、play/pause/step、故事進度與 capture entry | 可任意快轉到尚未計算的資料，或獨立擁有 Walker／synthetic event state |

五區共同消費 `VisualLabSession.snapshot()`。控制區的 draft 不得直接改中央場景，
結果區不得回寫控制值，story rail 不得自行選擇或重算事件。固定的是責任與可達性；
欄寬、折疊方式、字體、間距與配色仍可在 §13 視覺驗收中迭代。任何新增頂層區域都
必須在本契約與 interface-level test 中說明其 owner，不能以臨時 floating card 逃避
版面決策。

## 11. Energy visualization and saving claims

### 11.1 Energy is a linked story, not a single channel

The product uses four coordinated quantitative channels on one time axis:

1. **Delivered-data flow** — current throughput and accumulated delivered bits.
2. **Power stack** — actual RF, PA input, RFC, BB and declared event contribution.
3. **Energy accumulation** — integral of the declared `P_sys` boundary in joules.
4. **Efficiency** — instantaneous EE at an anchor and evaluation EE as the run-level
   ratio-of-sums.

Handover before/decision/after markers cross all four channels and focus the matching scene
state. This makes it possible to see whether a service transition coincides with a change in
requested/actual power, delivered service and accumulated energy without claiming causation
that the evidence does not establish.

Formal evaluation EE is `AcceptedRun.evaluation`. The browser must not maintain a second
session accumulator that looks like another evaluation definition. The time strip may show
source-backed prefix sums of delivered bits and consumed joules from the accepted run; a user
chosen reset/window is presentation-only unless the canonical runtime explicitly publishes a
new identified evaluation interval.

### 11.2 In-scene visual grammar

- serving = warm amber/gold role; candidate = cyan/blue; context = neutral slate/gray;
- role is also encoded by line style, outline and label, never by colour alone;
- throughput may use labelled directional flow particles or ribbons;
- power and energy use a legend-backed ledger/gauge, not unscaled beam brightness;
- a focused link may open an orthographic angle/gain cross-section attached to the same
  satellite/beam/UE identity;
- interference edges appear only for canonical co-channel contributors;
- no beam width, footprint, glow or motion is treated as quantitative unless its mapping and
  scale are explicit.

### 11.3 Three claim levels

| Level | Allowed statement | Required evidence |
|---|---|---|
| Energy accounting | where declared power is consumed and how energy accumulates | one accepted run/frame and canonical power ledger |
| Controlled comparison | A/B differences in bits, joules, EE and service state | matched source/geometry/interval plus explicit parameter diff |
| Qualified energy saving | lower declared energy while the accepted service constraints remain satisfied | frozen baseline/candidate identity, energy boundary, service-equivalence gates and accepted comparison authority |

The completed product is not considered to have fulfilled its central energy-learning goal
until at least one qualified energy-saving experiment is separately frozen and visualized.
The exact policy/control and service-equivalence threshold remain an owner/scientific decision;
the UI may not invent them. Until that decision, the first two levels remain fully usable and
the third clearly states `尚未建立可宣稱節能的比較條件` only in the comparison workflow,
not as repeated page-wide warning text.

### 11.4 A/B comparison behavior

- `儲存為基準 A` freezes accepted evidence, parameters, interval and presentation state.
- A changed accepted run/frame becomes candidate B.
- Split/wipe/twin views use the same camera, scale, time and layer plan.
- `causal comparison` is allowed only when exactly one declared scientific input differs and
  source, geometry, link identity and other invariants match.
- Otherwise the pair is an `exploratory comparison`; it may show values and deltas but not a
  one-parameter causal statement.
- Evaluation EE is compared only when complete run identity and interval gates pass.
- Restore/reset returns the exact saved digest; stale contract versions fail closed.

## 12. Teaching, exploration and publication figures

### 12.1 Guided and Explore

Guided is a driver of presentation state. It may select source time, camera, layers, focus and
an already accepted controlled pair. It never creates a second calculator or prerecorded fake
result.

Each guided moment must make one causal relationship answerable through:

- a plain-language question;
- the available action;
- a visible observation in the same scene;
- an explanation linked to the affected formula and energy/data story;
- a recovery path when the expected evidence is unavailable.

This is not a mandatory fixed five-question framework. Explore always permits access to the
same complete controls and accepted evidence.

Progressive disclosure and Guided are two different axes:

- **progressive disclosure** decides which controls and explanatory details are visible in the
  five-zone shell; it preserves the same draft and accepted frame and can be changed at any time;
- **Guided** selects a sequence of semantic story commands, focus targets and observations; it
  may open the relevant control/result groups but cannot replace the complete index or silently
  mutate a scientific input;
- **Explore** is the same shell with user-directed commands and no scripted order;
- **Figure** freezes a selected accepted state for publication; it is not a fourth interaction
  mode with its own calculations.

The initial Guided vertical slice is deliberately narrow: one source-backed accepted frame and
one controlled A/B change (angle-aware gain or another already-authorized canonical input). It
must pass the same identity and one-input-diff gates as Explore before handover stories are added.

Handover teaching uses two distinct replayable stories over the same `StoryRuntime`; it is not
one generic handover animation:

- **inter-handover** replays a completed serving-satellite change from the accepted TLE run and
  exposes its before／decision／after anchors, serving/candidate identities, offset/TTT or forced-
  continuity evidence, and the aligned SINR／Power／Throughput／EE projections;
- **intra-handover** replays a completed beam-identity change on the same serving satellite and is
  available only when the accepted producer publishes real beam ownership before and after the
  event; a Beam Hopping slot transition alone is not such an event;
- both stories support pause, previous/next beat, restart, inspect and fork-to-Explore. A missing
  trace produces an explicit unavailable reason; it is never replaced by a camera cut, synthetic
  beam switch or prerecorded result.

### 12.2 Figure preset

Figure preset freezes the same accepted state and declared layer/camera plan. It:

- removes transient controls and hover-only meaning;
- increases annotation and axis readability;
- keeps all quantitative values source-accounted;
- exports PNG for the 3D raster scene and SVG for crisp DOM/vector overlays where applicable;
- exports a manifest, supporting JSON/CSV, caption, alt text and long description with the
  same evidence identity;
- offers argument-specific compositions rather than a screenshot of the full engineering UI.

Every figure profile also freezes a presentation theme and locale. The initial publication
profiles are `light/zh-Hant` and `light/en`; `dark/zh-Hant` and `dark/en` remain valid for screen
or slide use. Theme and locale are presentation state only: changing either must preserve the
accepted run, frame, values, camera target and story beat. The capture manifest records both, and
the two locales use one semantic copy-key inventory rather than separately maintained pages.

Useful figure arguments include:

- TLE epoch → SGP4 trajectory → NTPU elevation opportunity;
- off-axis angle → transmit gain → link/power/EE consequence;
- reuse grouping → interference contributors → SINR/rate consequence;
- service/candidate before-decision-after handover evidence;
- delivered-data / power-stack / cumulative-energy / EE comparison under declared gates.

### 12.3 Phase-1 upload

Local evidence export is the core requirement. When a Phase-1 schema is registered, the same
bundle may be passed to a platform adapter through one secondary `上傳結果` action. Upload
status and receipt live in the export flow, not in the main scene, parameter navigation or
energy story.

## 13. Visual design, typography and accessibility

### 13.1 Direction

Use a calm editorial scientific workspace, not an engineering HUD or generic cyberpunk
dashboard. Two coordinated themes are required rather than a colour inversion:

- **dark interactive theme** — deep slate-blue 3D stage with warm neutral control/result
  surfaces for motion, spatial depth and extended operation;
- **light publication theme** — warm off-white canvas, dark ink, restrained borders and the same
  semantic role colours for paper figures, print and projector use;
- amber/gold service and energy role;
- cyan/blue candidate, geometry and throughput role;
- neutral slate context;
- red only for invalid/refused state;
- restrained depth, no scanlines, gratuitous glow, all-caps field walls or decorative grids.

Chinese UI prefers `Noto Sans TC`; editorial headings may use `Noto Serif TC`. Latin fallback
may use Source Sans/Serif or Atkinson Hyperlegible where available. Monospace is limited to
raw IDs, manifests and export data. Numeric tables use tabular figures without making the
entire interface monospaced.

### 13.2 Type and target floors

| Token | Desktop target | Mobile target | Rule |
|---|---:|---:|---|
| H1 | 32–38 px | 28–32 px | one clear page/scene title |
| H2 / drawer title | 24–30 px | 22–26 px | no all-caps substitute |
| body / explanatory copy | 16–18 px / 1.5 | 16 px / 1.5 | never compressed to fit a field wall |
| label / helper | 14–16 px / 1.4 | 14–16 px / 1.4 | concise, wrap normally |
| metadata / provenance | 12–14 px / 1.4 | 12–14 px / 1.4 | no meaningful text below 12 px |
| headline result | 24–32 px | 22–28 px | unit visually attached |
| formula symbol | 18–24 px | 18–22 px | rendered math, no raw underscore |
| interactive target | at least 44×44 px | at least 48×48 px | slider hit area included |

Scientific labels, symbols, values and units must never be ellipsized. They may wrap, use a
deliberate horizontal causal track, or move into an expanded detail view. `overflow-x:hidden`
must not conceal failed layout.

### 13.3 Accessibility

- normal text contrast is at least 4.5:1; small supporting labels target at least 5:1;
- role and state use shape/line/label in addition to colour;
- all toggles expose pressed/selected state and labelled controlled region;
- dynamic accepted-frame changes produce one concise polite announcement;
- keyboard and touch can reach every control, result, layer and focus action;
- a skip path reaches the scene, controls and results;
- `prefers-reduced-motion` preserves before/after meaning without camera flight or pulses;
- Figure mode retains all meaning without hover or motion;
- Traditional Chinese is the default locale and English is a complete peer locale. Scientific
  symbols, units, constellation names and source identities remain stable across locales; visible
  prose, accessible names, captions, alt text and long descriptions all switch together.

### 13.4 Responsive visual acceptance

Required review sizes are 1440×900, 1024×768, 768×900 and 390×844, plus one landscape
mobile capture. At every size:

- the scene appears before a long parameter list;
- no horizontal viewport overflow or clipped scientific text exists;
- opened drawers do not cover the selected object without camera safe-framing;
- all four result groups and the complete parameter index remain discoverable;
- touch targets, focus states and unit labels remain visible;
- a human reviewer can identify the changed parameter and scene consequence without reading
  raw IDs or developer notes.

## 14. Performance and first-frame contract

### 14.1 Precomputed default

The first accepted default run shall be materialized ahead of time. Startup loads:

1. application shell and lightweight scene background;
2. digest-verified default accepted artifact;
3. required GLB/terrain assets at the appropriate quality tier;
4. optional context detail after the first meaningful scene is interactive.

The artifact contains scientific evidence only. Camera, layer preset and animation remain
presentation state. Cache validation compares source publication/TLE digest, requested UTC,
model revision, scenario revision and parameter digest.

### 14.2 Performance targets

Targets are measured on the declared local reference browser/machine and reported with the
capture, rather than inferred from HTTP 200:

- input/focus/layer feedback begins within 100 ms;
- cached default meaningful scene target: at most 1.5 s warm and 3 s cold;
- pending source rebuild state appears within 100 ms;
- the main scene targets at least 30 fps at the default quality tier;
- context satellites, orbit samples and UE markers use instancing/batching where beneficial;
- visual interpolation never becomes a scientific anchor;
- the default asset path uses **geometry-locked optimization**: decoded POSITION/index
  arrays, primitive topology, node transforms and bounds remain equal to the source model;
- texture re-encoding, deduplication and lossless buffer compression are allowed only after
  fixed-camera screenshot parity is reviewed;
- triangle reduction, remeshing, replacement satellite models and shape-changing LOD are not
  accepted by this checkpoint. They require a separate owner-visible visual decision.

Asset optimization does not resolve publication rights. Owner decision on 2026-08-15 retires
the former `public/models/sat.glb`, whose embedded metadata declares CC-BY-NC-4.0, from the new
visual-lab renderer. The adopted display mapping is BeamShift's CC-BY-4.0 twin-array model for
Starlink and front-dish model for OneWeb; required attribution is recorded in the repository
root `THIRD_PARTY_NOTICES.md`. This is a one-time visible model replacement. Geometry locking
applies to the two adopted files from this decision forward. Neither model may be described as
real constellation spacecraft geometry. The current NTPU basemap remains local-only until its
imagery provenance is replaced or cleared.

If a target is not met, report the measured value and cause. Do not hide startup behind an
entry splash screen.

## 15. Migration and obsolete-code policy

### 15.1 Initial keep/rework/quarantine map

| Classification | Current material | Decision |
|---|---|---|
| Keep/reuse | archived-TLE resolver/run bundle, canonical EE producer, frame types, handover trace, timeline completeness | retain scientific ownership; adapt only through named seams |
| Keep/reuse after visual parity | satellite GLBs, NTPU asset, cell/UE/beam/orbit primitives, camera helpers | move behind the typed scene-plan renderer; no legacy state imports |
| Rework | current `AngleResponseDemoStage` shell, chapter nav, dense control/result cards | replace with unified scene composition and progressive control/result surfaces |
| Rework | separate orbit/local render branches | compose as layers/presets of one scene and one evidence identity |
| Rework first | `useHomepageCanonicalAnalysis` route-level orchestration | move transaction/race/cache/publication ownership behind `VisualLabSession` |
| Rework first | homepage timeline selecting legacy Walker events | consume only the accepted ADR-006 trace from the session snapshot |
| Consolidate | `scenePresentation` and `sceneLaneRenderPlan` overlapping visibility routers | replace their competing booleans with one typed `ScenePlanCompiler` |
| Compatibility, semantically dangerous | `archivedTleSimFrameAdapter` legacy link fields populated with zero placeholders | do not extend; isolate, replace with typed evidence nodes, then retire after parity |
| Active route split, not dead yet | `/simulator` route-local state/Canvas and `/explain` artifact/Canvas | migrate to aliases/presets over the same session and renderer before removal |
| Semantically dangerous alternate producer | `/explain` explore path rebuilding a local seven-cell scenario and calling canonical EE directly | prohibit in active route; replace with session commands, then remove after fixture parity |
| Quarantine pending proof | Walker runtime, historical teaching EE, C-90/C-120 and prototype-only calculators | never feed active product; remove only after reachability/ownership audit |
| Delete candidate | duplicate route shells, stale CSS, unused cards/adapters/tests after replacement | delete at the migration checkpoint when §15.2 gates pass |

This table is directional, not proof that a named file is currently dead.

### 15.2 Deletion gate

Before applying the gate, classify each path:

- `ACTIVE` — mounted or consumed by the accepted runtime;
- `COMPATIBILITY` — temporarily required by a migration caller;
- `FIXTURE_ONLY` — used by tests, validators or deterministic capture;
- `HISTORICAL` — retained ADR/course/donor record, not shipped runtime;
- `UNREACHABLE` — zero runtime/test/validator/script/document references after call-graph audit;
- `SEMANTICALLY_DANGEROUS` — can publish placeholders, alternate calculations or misleading
  state and must be isolated before ordinary cleanup.

Dead or obsolete code in the changed product area shall be removed rather than layered under
new wrappers, but only when all are true:

1. no active route, dynamic import, build entry, script, fixture generator, test, asset loader
   or current authority document requires it;
2. a replacement module is mounted and its interface-level tests cover the observable
   behavior that must survive;
3. the path is not owned by an overlapping writer and its dirty state is understood;
4. focused tests, build and browser acceptance pass after removal;
5. documentation and imports no longer advertise the removed path;
6. deleted behavior remains recoverable from Git history.

Search-by-name alone is not reachability proof. Conversely, a stale internal test is not a
reason to keep a retired shallow module once the deep-module interface test replaces it.
Commented-out code, unreachable feature flags and empty pass-through wrappers are not kept as
“backup.”

### 15.3 No opportunistic broad cleanup

Cleanup is limited to the unified visual-lab migration and its proven dependencies. Existing
dirty courseware, unrelated historical artifacts and other writers' WIP remain untouched.
Every implementation checkpoint includes a small residue ledger: `keep / migrate / quarantine /
delete-now`, with command-backed evidence for `delete-now`.

## 16. Delivery sequence

### 16.0 Normative implementation order and gates

目前版面、local scene、結果與時間軸尚未全部完成，因此實作必須依下列可驗收階段
進行。後一階段不得用 mock 版面或預錄動畫掩蓋前一階段未通過的 scientific gate；
版面可以持續精修，但五區責任與 session seam 一旦通過 structural acceptance 就不再
任意改名或重分配。

```text
P0  authority / ownership freeze
  → P1  mock final-screen shell + structural acceptance
  → P2  immutable canonical snapshot spine
  → P3  one story vertical slice
  → P4  real TLE event / handover stories
  → P5  Figure / Clip capture and optional upload
```

#### P0 — Authority、scope and writer freeze

對應 S0。確認 ADR-009／本 SDD、產品 route、dirty WIP、active writers、可寫檔案與
目前 truth table。只允許一個 owner 修改主組合檔（目前為 `UnifiedVisualLabPrototype`
及其 route-level composition）；其他 agent 可以在明確不重疊的 adapter、pure module、
review 或測試檔工作，不能同時改主組合檔、layout contract 或同一狀態 owner。

**Gate P0:** handoff 指定唯一 integrator、變更範圍與驗收命令；未完成不得並行改主畫面。

#### P1 — Mock final-screen shell

先做同一個 unified scene 的可檢查最終畫面 skeleton，不等真實後端才決定版面。必須
呈現 §10.5 五區、全球／NTPU 兩尺度切換、Scene／Handover／SINR／Power 漸進控制、
固定結果 dock、story rail 與足夠的字體／對比。mock 僅可用於 layout/interaction，
所有尚未接通欄位必須明示 pending/mock，不能顯示看似真實的 KPI、換手或節能結論。

**Gate P1:** 在目前產品支援的 1440×900 與 1280×720 至少各一張 capture 中，使用者能指出
來源、控制、中央場景、結果與時間軸；所有 17 個輸入可由漸進入口到達；左右欄不會
因 active tab 互相刪除；沒有人需要先理解工程欄位牆才能開始操作。

#### P2 — Immutable canonical snapshot spine

對應 S1–S4 的 scientific integration。建立／接通唯一 `VisualLabSession`，讓 global
real run、local NTPU scene、right results、timeline 與 energy projection 都消費同一個
immutable `AcceptedRun`／`AcceptedFrame`。先補 real local/result/timeline seam，再
處理美化；任何 pending/mock surface 在未通過本 gate 前不得進入 evidence 或 story。

**Gate P2:** 一次 Apply 只產生一筆完整 accepted snapshot；source、scene identity、
result values、timeline anchors、energy identity 可交叉核對；pending/rejected 時保留
上一筆 accepted，不顯示新舊混合值、零值或 synthetic fallback。

#### P3 — One story vertical slice

在 P2 之後只做一條完整、可暫停、可檢查、可 reset/fork 的 StoryRuntime。優先採 angle-
aware gain／power 的 controlled A/B，因為它可以先驗證「一個參數 → 場景焦點 → SINR／
Power／Throughput／EE」的因果鏈，不必先假造 handover。故事只能發出 §5.1a semantic
commands；baseline 與 probe 僅差一個正式 input，數字必須從 accepted snapshot 讀取。

**Gate P3:** 同一 story definition 可重播得到相同 frame／command provenance；每一步都有
可見觀察與 unavailable/recovery path；使用者能交還 Explore，且影片尚未成為任何證據
來源。

#### P4 — Real TLE event and handover narrative

對應 S5–S6。先接單一 2-hour accepted run 的事件／bookmark index，再以 source-backed
inter-handover 做第一個事件故事；只有存在真實 beam identity trace 時才加入 intra-
handover。完整場景可顯示 context satellites，但不能用 synthetic candidate、Walker
timeline 或展示用波束動畫代替 accepted trace。

**Gate P4:** bookmark、before／decision／after frame、serving/candidate identity、時間軸、
SINR／Power／Throughput／EE 都能回到同一 accepted run；TLE 日期切換與 handover 事件
不混為同一語意；未完成的計算不可被時間軸快轉。

#### P5 — Figure、Clip and optional upload

對應 S7–S9。Figure 先凍結同一 accepted evidence + presentation plan，輸出論文圖與
manifest；Clip 再由同一 StoryRuntime 產生，可包含鏡頭、分層、暫停點與參數操作，但
不另建錄影腳本或計算路徑。Phase-1 upload 只是同一 bundle 的 secondary adapter，最後
才加入。

**Gate P5:** 圖、資料、caption、clip provenance 都能指向 accepted frame/story identity；
截圖與影片即使離開主 UI 仍不失去單位、角色、尺度與 unavailable 語意；upload failure
不改變 accepted scientific state。

Current browser evidence for P5 uses the single fixed `:3000` application run. Inter-satellite
handover, intra-satellite beam handover, and link-gain A／B each produced a decodable 1280×720
VP8 WebM. The A／B capture visibly advanced through baseline／intervention／comparison while
system power changed from 4.47 W to 3.91 W and instantaneous EE changed from 29.80 Mbit/J to
34.03 Mbit/J; SINR and throughput remained aligned with the accepted comparison. Every archive
also contained `provenance.json` with the accepted analysis run, frame, story runtime, TLE source,
locale and theme. These are browser verification facts, not a new energy-saving claim.

以下 S0–S9 是對上述 P0–P5 的工作拆分；若兩者看似衝突，以 P0–P5 的先後與 gate 為準。

### S0 — Owner goal and authority freeze

- accept ADR-009 and this SDD's §0, §2, §6, §8–§13;
- select the exact active product route and compatibility-alias policy;
- preflight branch, dirty WIP, active writers and exact writable paths;
- record baseline tests and browser captures.

No product code change precedes S0 acceptance.

### S1 — Deep-module interfaces and registries

- implement/test the `VisualLabSession` three-entry-point facade around existing producers;
- implement the private exact 17-key experiment schema and result ownership;
- generate/test the machine-readable historical-control crosswalk required by §8.6;
- implement/test the pure typed `ScenePlanCompiler`, finite semantic-node union and preset
  resolution;
- define private `FocusPath` vocabulary and causal mappings;
- keep existing renderer and scientific runtime behavior unchanged.

### S2 — One-scene migration

- make orbit, local service and explanatory cutaway compositions consume one session
  snapshot, one typed scene plan and one renderer;
- prove clean/full/far/near change presentation only;
- restore NTPU, cells, UEs, GLBs, context satellites and multi-beam rendering through layers;
- preserve serving/candidate/context ownership and accepted TLE motion;
- run the first residue/dead-code removal gate.

### S3 — Readable complete controls and results

- replace dense chapter/field-wall UI with source strip, progressive control drawer and
  independent result dock;
- wire all 17 inputs through one draft/apply transaction;
- wire the bounded representative-UE geometry probe through the same transaction without
  creating an eighteenth formula parameter;
- keep all four result groups available and eliminate duplicate values/copy;
- pass typography, target, overflow, keyboard and responsive gates.

### S4 — Causal focus and truthful animation

- connect every parameter/formula/result/entity through `FocusPath`;
- implement the §9 invariance/change matrix;
- animate only accepted affected paths and explain legitimate unchanged states;
- verify parameter changes never move TLE geometry unless the source changed.

### S5 — TLE and handover visual narrative

- implement archive→orbit→observer→local-service progressive transformation;
- make completed-anchor timeline and accepted handover trace visible in the same scene;
- prove TLE switching is not counted as handover;
- show multi-satellite context while beams remain owned only by authoritative roles.

### S6 — Energy story and comparison

- add time-aligned delivered data, power stack, cumulative energy, EE and event markers;
- support baseline A/candidate B identity gates and fixed-scale comparison;
- freeze at least one scientifically accepted qualified energy-saving experiment before
  claiming the central energy-learning outcome complete.

### S7 — Guided and Figure projections

- add contextual teaching moments without a separate runtime;
- add deterministic figure presets, manifests, captions and supporting data;
- validate thesis-screenshot readability at the declared capture sizes.

### S8 — Consolidation

- complete route migration/aliases;
- remove proven dead/obsolete route, renderer, CSS, adapter and superseded internal tests;
- update README/current handoff and architecture map;
- run full focused tests, build, browser, performance and human visual acceptance.

### S9 — Optional Phase-1 adapter

- only after a registered schema exists, add upload as an artifact-writer adapter;
- local export remains usable when the platform is absent;
- upload failure never changes accepted scientific state.

## 17. Verification matrix

### 17.1 Scientific identity

- scene, formulas, all result groups, timeline, comparison and capture report one accepted
  run/frame identity;
- TLE source changes publish atomically and never generate a handover event by themselves;
- every formula result consumes canonical actual RF power and ADR-003 power boundary;
- evaluation EE is ratio-of-sums, not average instantaneous EE;
- unavailable and invalid states never display stale/new mixed values or fake zeroes.

### 17.2 Control and causality

- exact registry key set equals the 17 fields in §8.1;
- every field is reachable in at most two actions and has name, symbol, unit, range, default,
  source and reset;
- cross-domain links resolve to one owner card;
- group-specific tests prove both changed outputs and required unchanged state;
- representative-UE drag is constrained to its assigned cell, preserves count/load/ownership/
  TLE identity, and publishes affected results only after one accepted rebuild;
- binding and non-binding cap examples are both tested;
- no direct `P_t`, independent `B_beam`, `N_0`, `eta_PA` or compatibility field enters the
  formal control path.

### 17.3 Scene composition

- clean→full add-back does not change frame digest;
- per-satellite beam-layout control accepts exactly 1／7／19 and produces
  complete 0／1／2-ring hexagonal layouts; stable satellite identities may own
  different presets, while the simple-mode global value remains a bulk default;
- a 19-beam case uses the TR 38.821 HPBW spacing rule in evaluated physical
  boresight geometry before it is labelled the 3GPP single-satellite baseline;
  metadata-only spacing and heterogeneous 7／19 project scenarios do not carry
  that label;
- no arbitrary integer field or thesis `v_max` control appears;
- full preset contains every available required layer from §6.1;
- the plan compiler/renderer never recomputes canonical science or mutates evidence;
- the renderer exhaustively handles the finite semantic-node union and displays unsupported
  evidence as unavailable rather than zero placeholders;
- serving/candidate/context roles and interference membership remain distinct;
- reduced-motion view conveys the same accepted before/after result.

### 17.4 UX and accessibility

- §13 sizes, contrast, target and viewport gates pass by computed style and visible capture;
- no meaningful 6.5–11 px text remains;
- no scientific label/value/unit is clipped or ellipsized;
- results remain independent of input tab;
- keyboard, touch, screen-reader announcement and reduced-motion flows pass;
- human review can explain what changed, why it changed and what stayed unchanged.

### 17.5 Energy and claims

- data, power, cumulative energy, EE and handover markers share time and identity;
- `P_sys` boundary is visible without page-wide disclaimer repetition;
- A/B pair exposes exact changed inputs and invariant gates;
- `節能` wording appears only when the qualified comparison contract passes;
- platform upload success is never used as energy evidence.

### 17.6 Architecture and cleanup

- §5 completion criterion passes for the single public `VisualLabSession`;
- all active routes share one session and one Canvas and differ only by initial intent/preset;
- no visual layer/node owns a second store/calculator;
- no hypothetical single-adapter port or public per-layer capability remains;
- every deletion has §15.2 evidence;
- active build contains no superseded route-local scientific calculator.

## 18. Owner checkpoints and remaining decisions

The following decisions require explicit owner/scientific acceptance:

1. accept the one-page product goal and one-scene composition;
2. choose the active public route and migration lifetime for old aliases;
3. accept the calm editorial scientific visual direction and type floors;
4. freeze the first qualified energy-saving experiment: causal control/policy, baseline,
   candidate, service-equivalence gates, interval and energy boundary;
5. choose the default precomputed constellation/date/time artifact after current archive
   verification;
6. approve visual acceptance for clean, progressively built and full compositions;
7. register the optional Phase-1 upload schema when needed.

Items 2, 4, 5 and 7 do not block pure module/UX prototype work after S0 if their behavior
remains fail-closed. Item 4 does block a completed-product claim that the experience visibly
demonstrates energy saving rather than energy accounting and exploratory comparison.

## 19. Implementation-start gate

Implementation may begin only after:

- ADR-009 and this SDD are owner-accepted;
- the fresh-context hybrid recorded below remains reconciled after owner review;
- the active repo/branch/dirty writers and exact file ownership are rechecked;
- a short implementation handoff names this SDD as the product authority and prevents old
  `/explain` or route-local assumptions from silently returning.

The first visual implementation checkpoint is **P1 mock final-screen shell**, not a separate
demo page: it must already be the same clean→full scene path and use the five-zone contract.
**S1 is the first scientific-integration checkpoint (P2)**, after P1 structural acceptance;
until P2 passes, mock values may validate layout only and must not be used as evidence.

## 20. Fresh-context architecture review record

Three independent read-only reviews inspected current authorities and code with no inherited
conversation context:

1. **Minimal interface** — recommended one deep session with
   `snapshot / dispatch / subscribe`; found seven public modules overmodularized.
2. **Common-flow interface** — independently recommended the same facade, while retaining
   schema, projection, focus, energy and comparison as private collaborators.
3. **Extensibility interface** — recommended a pure typed `ScenePlanCompiler`, flat semantic
   node union and one exhaustive renderer instead of layer plug-ins.

The reconciled decision is the hybrid in §5–§6: one public `VisualLabSession`, one immutable
snapshot, one typed private scene-plan compiler and one Canvas. All three reviews agreed that
semantic visual decomposition is beneficial and public per-layer capabilities are not.

The code review also identified migration evidence, not immediate deletion authority:

- homepage、`/simulator` and `/explain` currently own different orchestration/Canvas paths;
- `/explain` exploration can independently rebuild a local scenario and canonical EE;
- the homepage timeline still has a Walker-event ownership path;
- current presentation and lane plans overlap as shallow boolean routers;
- a legacy TLE→`SimFrame` adapter supplies zero placeholders for fields that should instead be
  unavailable or evidence-backed.

These findings are reflected in §15. No product code or historical file was deleted during
the review.

The final **pre-implementation** read-only gate reported the then-current implementation
nonconformant: it had separate routes/Canvases, alternate `/explain` calculation, stale Walker
timeline, clear-on-Apply behavior and unreadable small text. Those findings became the S1–S8
migration checklist; they do not describe the implemented checkpoint recorded below. The gate
found the claim ceiling and deletion policy sound. Its two document conflicts—generic
`channel scale` wording and clear-on-Apply implementation residue—are explicitly superseded by
ADR-009 Decision K; the representative-UE requirement is explicitly covered by ADR-009
Decision J and §8.7.
