# Visual-first Golden Flow storyboard and truth contract

**Status:** `PASS_WI-03` — accepted for WI-04 authoring after an independent
fresh-context reviewer PASS and controller decision

**Date:** 2026-08-24

**Prerequisite:** `PASS_WI-02` (unified session/compiler and visual-acceptance
harness). This document does not accept the current `/simulator` compositor or
any existing Golden screenshot as product pixel evidence.

**Acceptance boundary:** this PASS accepts the WI-03 structure/truth contract
only. It does not accept product pixels, the current compositor, candidate
screenshots/video, or the WI-09 full scientific source-backed event lesson.
WI-04 owns the scene-first compositor, video, and owner pixel review.

**Target medium:** one 84-second, 12-beat, scene-first teaching animation with
exactly one guided pause/action. The scene carries the explanation; captions
are short timing aids. The detailed fields below are an internal director
contract and must never be rendered as a persistent student card, rail, or
reading page.

**Next work-item stop token:** `WAITING_FOR_REVIEW_WI-04`

## 1. Teaching decision

The pilot answers one coherent question:

> When a link is already serving a UE, how do we distinguish elevation from
> off-axis angle, observe a beam-axis consequence without changing the orbit,
> restore the source replay, and then watch one genuine inter-satellite
> handover satisfy qualification and TTT before commit?

The nominal sequence is deliberately narrow:

```text
establish
  -> two angle vertices
  -> freeze + predict + one beam-axis gesture
  -> visible counterfactual link consequence
  -> exact restore barrier
  -> source-backed candidate
  -> qualification
  -> TTT
  -> two discrete source anchors
  -> inter commit
  -> receipt
  -> new normal
```

The golden medium does not teach intra-handover, full candidate ranking, TLE
raw-to-SGP4 transformation, the EE experiment, or platform upload. Those are
later work items. The scene may use a short source label and a pause-only
inspector later, but the acceptance recording keeps the inspector closed.

## 2. Student-surface rules

1. The stage is the protagonist from the first frame. No persistent left/right
   rails, top navigation, course outline, engineering control wall, or bottom
   timeline is mounted during playback.
2. Exactly one primary cue is mounted for each beat. Candidate comparator, TTT
   ring, discrete trace, commit pulse, and receipt are mutually exclusive and
   appear in that order.
3. There is one subtitle bar and at most two rendered lines. Captions do not
   carry tables, provenance paragraphs, formulas, JSON, API fields, or error
   codes.
4. Only the guided interaction exposes controls: three camera presets and one
   beam-axis gesture available while the pause is active. Beat 12 exposes
   replay/next only when elapsed time reaches its stable hold of 6 seconds;
   before that threshold those controls are unmounted.
5. The angle action freezes time, satellite, UE, and elevation. Only the
   teaching beam axis changes. The approved angle-aware link projection may
   change; the source replay, handover manager, event count, platform samples,
   and platform records may not.
6. After the restore barrier passes, the later source-backed handover is a
   separate evidence namespace. No caption, transition, or causal explanation
   may imply that the learner's drag caused that event.
7. Brightness/beam glow is schematic. It is never presented as measured SINR.
   The trace uses exactly two discrete source anchors and no connecting line.
8. Any missing source, mismatched identity, incomplete equality proof, or
   unsupported field fails closed and stops the director at the last truthful
   beat.

## 3. 84-second beat contract

The machine-readable source of truth is
[`goldenFlowDirector.ts`](../../src/prototype/golden-flow/goldenFlowDirector.ts).
The following matrix is the concise implementation map. `hidden` means
unmounted, not merely opacity-hidden. The director object additionally carries
the learning question, visible phenomenon, expected observation, causal
explanation, misconception guard, unavailable/failure/recovery/reset paths,
freeze state, typed control-availability timing, source IDs, and one canonical
completion evidence key for every row. Legacy `camera`/`speed` fields are
asserted equal to the typed `cameraSpec.pose`/`playback.speed` fields.

| Beat / time | Scene and camera | Speed / controls | Hidden surfaces; one cue | Truth namespace and evidence | Caption (≤2 lines) | Learner action / completion |
|---|---|---|---|---|---|---|
| 01 establish · 0–5s | Wide oblique; target serving link; ease in. UE, source satellite, beam and link establish. | `1x`; none. | All rails, nav, timeline, inspector, and handover cues hidden; `scene-establish`. | `scene`; ADR-009 scene/link geometry; selected-frame + serving-link. | `先看一條正在服務的鏈路。` | None; `golden.establish.scene-visible`. |
| 02 angles · 5–13s | Side angle; target two vertices; ease. UE elevation arc and satellite off-axis arc are spatially separate. | `0.75x` slow; none. | Same chrome and handover cues hidden; `angle-arcs`. | `geometry-teaching`; ADR-009 link geometry; UE vertex + satellite vertex. | `仰角從地面量；離軸角從衛星量。` / `它們不是同一個角。` | None; `golden.angles.two-vertices`. |
| 03 interaction · 13–23s | Side angle; target beam axis; hold. Time/satellite/UE/elevation frozen. | `0x` hold; side/top/oblique + one `beam-axis-drag`. | All rails and handover cues hidden; `beam-axis-drag`. | `teaching-counterfactual`; ADR-007 guided presentation; pre/post frame + action. | `保持 UE 與衛星不動。` / `先預測，再把波束中軸移開一點。` | Guided: mandatory prediction, optional one-gesture response, prediction key `golden.counterfactual.prediction-recorded`; completion `golden.counterfactual.action-complete`. |
| 04 consequence · 23–31s | Side angle; target counterfactual link; hold. Elevation stays fixed; off-axis arc grows and beam centre separates. | `0x` hold; none. | All rails and handover cues hidden; `link-consequence`. | `teaching-counterfactual`; pre/post frame and approved angle-aware link result only. | `UE 沒動；波束中心偏了。` / `先看鏈路結果，再開公式。` | None; `golden.counterfactual.consequence-visible`. |
| 05 restore · 31–36s | Wide oblique; restore boundary; restore transition. Teaching axis disappears and source axis returns. | `0x` restore hold; none. | All rails and handover cues hidden; `counterfactual-discard`. | `source-backed-replay`; ADR-007 immutable evidence; equality barrier + zero persisted counterfactual samples. | `受控比較到此結束。` / `清除教學偏移，回到來源 replay。` | None; `golden.restore.equality-passed`. |
| 06 candidate · 36–44s | Pair wide; target source/candidate pair; ease. Source cue weakens and pinned pending target enters. | `0.75x` slow; none. | All chrome, TTT/trace/commit/receipt hidden; `candidate-arrival` / comparator only. | `source-backed-handover`; teaching-window selection, logical event, source/target IDs, offset/TTT locators. | `來源鏈路逐漸不利；候選鏈路進場。` / `中央光斑只是空間示意，不是實測 SINR。` | None; `golden.handover.candidate-visible`. |
| 07 qualification · 44–52s | Pair close; target qualification pair; ease. Source/candidate comparison and offset mark. | `0.5x` slow; none. | TTT/trace/commit/receipt and chrome hidden; comparator only; `qualification-mark`. | Same source event; candidate − serving crosses `window.handoverPolicy.offsetDb`. | `候選優勢達到來源設定的 offset。` / `場景先呈現比較，不是完整排名。` | None; `golden.handover.qualification-passed`. |
| 08 TTT · 52–60s | Pair close; target pending target; hold. Comparator unmounts; TTT ring advances from source progress. | `0.25x` slow; none. | Comparator/trace/commit/receipt and chrome hidden; `ttt-ring`. | Same source event; configured offset and `window.handoverPolicy.tttSec`; source trigger progress. | `一次領先還不夠。` / `優勢必須持續到來源設定的 TTT 完成。` | None; `golden.handover.ttt-complete`. |
| 09 trace · 60–66s | Pair close; target trace safe area; cut. Exactly two discrete source anchors/stems, no polyline. | `0.5x` slow; none. | Comparator/TTT/commit/receipt and chrome hidden; `delta-trace`. | Same source event; `selection.traceDigest`; two ordered qualification→commit source anchors. | `只顯示兩個來源錨點。` / `錨點之間沒有連續量測線。` | None; `golden.handover.trace-two-anchors`. |
| 10 commit · 66–72s | Commit wide; target transfer; ease. Source beam fades, target takes over, one transfer pulse. | `0.1x` slow hold; none. | Comparator/TTT/trace/receipt and chrome hidden; `commit-pulse`. | Same source event; `action=inter-handover`, non-null source, target identity, offset/TTT/trace evidence. | `條件成立。` / `引擎提交一次跨衛星換手。` | None; `golden.handover.inter-commit`. |
| 11 receipt · 72–78s | Commit wide; target receipt link; ease. Receipt briefly shows source/target/time/action only. | `0.5x` slow; none. | Comparator/TTT/trace/commit and chrome hidden; `event-receipt`. | Same committed event; receipt fields must match source event. | `收據只記錄引擎真正提交的欄位。` / `來源、目標、時間與事件類型。` | None; `golden.handover.receipt-matched`. |
| 12 new normal · 78–84s | New-normal pose; target new serving link; ease. Receipt leaves, target stays; stable hold ≥6s. | `1x`; replay/next unmounted before 6s, unlocked at 6s. | All rails, nav, timeline, inspector, and handover cues hidden; `new-serving-link`. | Same source event post-change identity; no policy/energy/platform inference. | `新的服務鏈路穩定下來。` / `幾何變化會再次啟動同一套判斷。` | None; `golden.new-normal.stable`. |

## 4. Director and evidence state contract

### 4.1 One evidence state, one presentation state

The director consumes an accepted evidence snapshot; it does not calculate a
second SINR, power, throughput, EE, TLE, or handover result.

```text
EvidenceState (immutable)
  source frame / replay identity
  serving + candidate identities
  source event/action/instant
  configured offset + TTT
  discrete source anchors + trace digest
  canonical result references and provenance

PresentationState (mutable)
  beat ID / elapsed time / camera pose and target
  playback speed / freeze state / visible primary cue
  transient caption / allowed controls
  teaching-counterfactual draft and prediction evidence
```

All 12 beats emit camera pose/target/transition, speed/slow-motion/hold,
visibility/unmounted surfaces, typed control availability, primary cue,
subject/capture key, and truth namespace/source/evidence IDs. The runtime may
interpolate presentation motion, but numeric labels stay attached to an
identified accepted source anchor. `completion.evidenceKey` is the sole
completion-key owner; guided metadata does not duplicate it. The runtime
asserts the legacy `camera` and `speed` aliases remain equal to
`cameraSpec.pose` and `playback.speed`.

### 4.2 Guided pause evidence

Only beat 03 is `guided`. It must show the prediction prompt before action and
record `golden.counterfactual.prediction-recorded`. The runtime response is a
typed `'gesture' | 'skip' | null` value. A gesture requires exactly one gesture
and response/action evidence; a skip requires zero gestures plus explicit skip
response evidence. `null` with zero gestures is an implicit response and cannot
complete the beat. Beat completion requires the single canonical
`completion.evidenceKey = golden.counterfactual.action-complete`. Every
autoplay beat has nullable prediction fields and its own non-empty
`completion.evidenceKey`.

### 4.3 Controlled comparison namespace and restore barrier

The counterfactual namespace is exactly `teaching-counterfactual` and is
separate from `source-backed-handover`:

| Fixed | Only mutable teaching dimension | Allowed observation | Forbidden persistence |
|---|---|---|---|
| time, satellite, UE, elevation | beam axis | off-axis angle and approved angle-aware link result | replay, handover, platform |

Before leaving beat 05, the director must compare these exact fields between
the pre-interaction snapshot and restored state:

```text
sourceFrameId
replayIdentity
servingSatelliteId
candidateSatelliteId
handoverManagerState
eventCount
platformSampleCount
platformRecordCount
persistedCounterfactualSampleCount === 0
```

Before comparing, both states must be valid: source/replay/serving/candidate/
handover identities are non-empty; all counts are finite non-negative integers;
and both persisted counterfactual counts are exactly zero. If any evidence is
unavailable, malformed, or differs, the director stops at the restore barrier.
The counterfactual result is discarded; it is never appended to the live replay
or a platform bundle. The later source event is loaded only after this barrier
and has no causal join to the learner action.

### 4.4 Source-backed handover evidence

Beats 06–12 must carry a source event reference with these evidence locators:

```text
event ID       selection.logicalEventKey
action         inter-handover
source         pair.from.satelliteId (must resolve non-null at commit)
target         pair.to.satelliteId
offset         window.handoverPolicy.offsetDb
TTT            window.handoverPolicy.tttSec
trace          expectedCount=2; qualification.anchors[0] → qualification.anchors[1]
               strictly increasing; phase=qualification-to-commit;
               connector=none; digest=selection.traceDigest
```

The pinned fixture currently resolves a OneWeb source/target pair and two
qualification anchors. The loader fail-closes if the count is not exactly two,
anchor indices/progress/UTC are not strictly ordered, or the trace digest is
empty. The actual values are read through the fail-closed
`loadSixActsTeachingWindow()` path; the director never invents a candidate,
ranking factor, continuous trace, connector, or event type.

## 5. Fixture ledger and truth ceilings

| Fixture / source | Used by | Evidence status and boundary |
|---|---|---|
| `src/course/sixActs/fixtures/teachingWindow.generated.json` via `loadSixActsTeachingWindow()` | Beats 06–12; source event, target, offset, TTT, two anchors, trace digest | Source-backed candidate/event fixture; `CANDIDATE_EVIDENCE` until WI-09 validates the complete inter lesson. |
| `src/course/sixActs/teachingWindowSchema.ts` | Field names and source/event shape | Schema authority for this candidate fixture; not a beat timetable. |
| `ADR-005` + `docs/sdd/TLE-CANONICAL-EE-SIMULATOR-SDD.md` | Immutable frame/TLE/EE ownership and fail-closed boundary | Scientific authority; no new formula or energy policy is introduced here. |
| `ADR-007` | Evidence/presentation split, guided prediction, source-backed event separation | Governs the presenter seam; current angle-response visual result still needs a source-backed fixture. |
| `ADR-009` | One session, one scene world, clean progressive disclosure | Governs composition; no second renderer or public layer framework is authorized. |
| `src/prototype/golden-flow/goldenFlowDirector.ts` | 12 beats, fields, namespaces, controls, barriers, capture keys | Machine contract candidate; no owner visual PASS. |
| Existing Golden UI/artifacts under `src/prototype/golden-flow/` and `output/playwright/` | Visual donors and review candidates only | Not proof of scene-first product pixels; current `/simulator` remains quarantined by WI-02. |

Scientific ceilings retained in the pilot:

- one immutable frame identity remains the owner of any quantitative values;
- TLE publication/propagation switching is not handover or energy-saving
  evidence;
- no legacy required-SINR, requested-power inversion, or cap semantics;
- no interruption time, signalling cost, residual visibility, complete
  candidate ranking, energy saving, platform persistence, or live/operational
  claim;
- a schematic brightness cue is not measured SINR; and
- no counterfactual sample is persisted.

## 6. Unavailable, failure, recovery, reset, completion paths

These are director transitions, not long student-facing paragraphs.

| Path | Required behavior |
|---|---|
| Source frame unavailable | Stop at the last accepted scene; show a concise unavailable caption; do not substitute a generated orbit or guessed link. |
| Angle vertices/result unavailable | Keep the spatial vertex teaching if possible; suppress numeric/formula result and mark the angle-aware projection unavailable. |
| Guided prediction missing | Keep beat 03 paused. No automatic advance; record explicit retry/skip outcome before action evidence. |
| Beam-axis action invalid | Keep time/satellite/UE/elevation frozen; reject the action and allow one bounded retry. |
| Counterfactual equality failure | Do not enter handover beats. Discard teaching namespace and return to the pre-interaction snapshot. |
| Candidate/event mismatch | Do not mount candidate cue. Re-read the pinned event; fail closed if event ID/source/target/action differs. |
| Offset/TTT unavailable | Stop before qualification/TTT; do not replace with a profile default or zero. |
| TTT condition breaks | Reset progress to the source-defined state and return to candidate/qualification. |
| Trace not exactly two anchors | Do not draw a trace. Return to TTT and mark source evidence incomplete. |
| Commit action/source invalid | Do not pulse or increment event count; require `action=inter-handover` and non-null source. |
| Receipt mismatch | Hide receipt; re-read the immutable committed event. |
| New-normal target mismatch | Stop at receipt and recover the post-change frame. |
| Full reset | Remove every transient cue, teaching axis and uncommitted evidence; replay from beat 01 with a fresh evidence namespace. |
| Successful completion | Record the beat completion key and 12-frame manifest; this is still candidate evidence until independent and owner review. |

## 7. Forbidden student claims

The following must not appear in captions, primary cues, visible source labels,
or causal copy:

- the drag caused the later handover;
- brightness equals measured SINR;
- a continuous SINR trace or a continuously sampled interval between the two
  anchors;
- full candidate ranking or a reason for every rejected satellite;
- interruption time, signalling cost, residual visibility, or operational/live
  telemetry not supplied by the source;
- energy saving, optimization success, policy superiority, or platform
  persistence;
- an attach/stay/intra action presented as this inter-handover;
- legacy required-SINR, requested-power inversion, or legacy cap semantics; and
- TLE switching presented as a handover or energy experiment.

The machine contract exports the English scan needles in
`GOLDEN_FLOW_FORBIDDEN_CLAIMS`. It also scans only actually visible eyebrow and
caption copy against positive-claim phrases in
`GOLDEN_FLOW_VISIBLE_COPY_FORBIDDEN_CLAIMS`, including `拖曳造成後續換手`,
`亮度就是實測 SINR`, `連續 SINR 曲線`, `完整候選排名`, `有中斷時間`,
`有訊令成本`, `有殘留可見性`, `節能成功`, `最佳化成功`, `已上傳平台`,
`平台已持久化`, `即時遙測`, `attach 換手`, `stay 換手`, `intra 換手`,
`TLE 換手`, and legacy `需求 SINR`/`請求功率反推`/`功率 cap 語意`.
These phrases are intentionally positive and specific, so honest negations such
as `亮度不是實測 SINR` are not false positives.

## 8. Twelve-frame capture matrix

Every beat emits a 1920×1080 DPR1 screenshot key. Slide frames are selected for
the teaching argument; all captures remain candidate evidence until the
controller watches the video and checks pixels.

| Frame key | Beat | What the still must prove | Slide use |
|---|---|---|---|
| `GF-01-establish` | 01 | One serving link and UE occupy the clean central stage. | Yes — establish spatial roles. |
| `GF-02-two-vertices` | 02 | UE and satellite vertices, rays and two arcs are visibly distinct. | Yes — elevation versus off-axis. |
| `GF-03-guided-beam-axis` | 03 | Frozen geometry, prediction/action affordance, beam-axis control only. | Yes — controlled experiment setup. |
| `GF-04-counterfactual-consequence` | 04 | Elevation fixed, off-axis changed, link consequence before formula. | Yes — phenomenon first. |
| `GF-05-restore-barrier` | 05 | Teaching axis leaves; restore barrier and source identity return. | No — transition evidence. |
| `GF-06-candidate-arrival` | 06 | Source/candidate cues share the central scene; brightness labelled schematic. | No — replay setup. |
| `GF-07-qualification` | 07 | Candidate comparator and configured offset evidence appear alone. | Yes — why qualification is allowed. |
| `GF-08-ttt` | 08 | TTT ring replaces comparator and advances from source progress. | No — temporal condition. |
| `GF-09-two-source-anchors` | 09 | Exactly two discrete anchors, no joining line. | Yes — evidence boundary. |
| `GF-10-inter-commit` | 10 | One source-to-target inter commit pulse, both identities visible. | Yes — when handover is real. |
| `GF-11-event-receipt` | 11 | Minimal receipt matches committed event fields. | Yes — provenance/record. |
| `GF-12-new-normal` | 12 | New target serving link holds visibly for ≥6 seconds. | Yes — coherent end frame. |

Required capture metadata: route, commit/worktree identifier, viewport/DPR,
beat ID/order, camera pose/target/transition, speed, cue, caption line count,
truth namespace/source/evidence IDs, source/replay identity, screenshot path,
and machine gate result. A future WI-04 video must cover all 12 beats, keep
beat-12 replay/next unmounted before 6 seconds, and include the stable beat-12
hold after the controls unlock.

## 9. Implementation boundary and known gaps

WI-03 writes only the non-rendering contract and focused tests. WI-04 is the
first item allowed to implement the scene-first compositor after
`PASS_WI-03`; it must unmount inactive surfaces and produce browser pixels/video
against the WI-02 harness.

Known gaps intentionally left for later gates:

1. The current Golden UI still contains a candidate dashboard-style compositor;
   this storyboard does not accept it. WI-04 must rebuild the student surface
   around beat-owned scene/cue visibility.
2. Existing `SixActsFrameFacts` does not yet provide the complete director
   geometry frame or a production beam-axis transaction. The interaction seam
   is declared but remains unavailable until WI-04/WI-08 supplies evidence.
3. The pinned teaching-window source event is a candidate fixture. WI-09 must
   validate event/action/source/target/anchor/trace identity before any full
   handover claim is accepted.
4. The current canonical EE/power-path reconciliation and the meaningful EE
   experiment are outside this pilot. This flow must not turn its handover
   animation into an energy-saving claim.
5. Intra-handover is explicitly outside this 84-second flow and belongs to a
   later item; it must not be implied by the inter receipt.

## 10. Review result and next stop

Machine checks recorded for this accepted contract are:

```text
node --import tsx/esm src/prototype/golden-flow/goldenFlowDirector.test.ts
npx tsc --noEmit
```

The focused assertions cover the seven revision gates as well as the base
sequence: one canonical completion key, explicit guided response evidence,
control availability at the guided pause and at the beat-12 six-second hold,
fail-closed restore validity, exact source event/trace locators and loaded
two-anchor digest, positive Traditional-Chinese visible-copy scans, and the
legacy camera/speed plus capture/stable-hold invariants. These checks inspect
the director model only; they do not turn internal contract fields into
student-facing text.

These prove contract structure only. They do not prove browser pixels,
scene-first composition, source-backed complete event playback, WI-09 full
scientific event acceptance, or owner compositor/video acceptance. An
independent fresh-context reviewer returned `PASS`; the controller recorded
`PASS_WI-03` because every beat has a scene-defined observable event, the flow
has one guided prediction/action, the counterfactual is isolated, and restore
and source-handover evidence fail closed. This unlocks WI-04 authoring/review
only; WI-05 and all later items remain frozen.

The exact next stop is:

```text
WAITING_FOR_REVIEW_WI-04
```
