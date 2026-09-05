# Frontend authority refactor — SDD

Status: DRAFT, awaiting the Step 0 experiment. Authored 2026-09-04 at the end of a
long session; every load-bearing claim carries a `file:line` so the next session
verifies rather than trusts. Claims marked HYPOTHESIS were not verified.

## 0. Status update (appended 2026-09-05 by a later session)

**Step 0 has run. F1-F11 still hold as a diagnosis; the plan below has been
superseded in three places by measurement.** Read
`AGENT-EXECUTABILITY-FINDINGS-2026-09-05.md` §"狀態更新" first -- it carries the
corrections and the evidence.

**F8 / §3 are out of date.** The five tests listed there as red are all green:
`check:baseline` is exit 0 across 19 tests, `test:multi-candidate` is 178/178,
and `check:handover` reports GREEN. Do not use §3 as a to-do list.

**New finding, more severe than F1.** `6b9474e` routed the candidate SINR
admission gate through the angle-aware EE counterfactual sample, whose transmit
power is capped at 1.65 W (32.17 dBm) versus the profile's rated 50 dBm.
Measured: `sinr{pass=0, fail=91074}` over `[-53.6, -13.5] dB` against a `-5 dB`
gate -- **no candidate was ever hard-eligible, so the EE handover authority
could not fire at all in the live pipeline.** That is a more likely root cause of
the owner's "it never hands over" than F1. Fixed in `d558881`
(`pass=50364`, `[-38.0, +5.1]`). Note the shape: this is **F3 recurring** -- a
value the code itself labels as an EE/display counterfactual was feeding a
decision, while the `sinrMeasurementContext` built a few lines above declared
`powerModel: 'profile-rated-rf'`.

**P2 does not need to run as its own phase.** §5's P2 assumed ~1,000-1,500
pinned assertions stand in the way. Measured against the actual convergence:
**20** assertions block it, 16 of them inside `scripts/check-handover.ts` itself.
The real blocker is the runtime contract, not governance: callers depend on the
commit having already happened when `update()` returns
(`runtimeFrameStep.ts:871-876` reads `eventLog` on the next line;
`liveWalkerHandoverEventIndex.ts:345-350` reads increments between steps).

**P3 progress.** Steps 1-3 are done:
- `commitProvenance.ts` -- the approving path is a typed value stated by the
  committing code, not a regex over the reason sentence (`0bb5f0b`).
- `eeCommitPermit.ts` -- committing requires a permit, as a REQUIRED parameter,
  so a new commit path that does not state its evidence fails to compile
  (`a62d680`). Honest limit: the brand stops object literals, not
  `as unknown as`; that half is enforced mechanically by check:handover.
- `selectServiceContinuityFallback` now requires the vanished link's EE
  evidence and refuses a still-healthy link, so paths consulting EE went from
  1/7 to 2/7 (`87e0b0e`).

**Red-team detection is now 4/4** (was 1/4), measured by re-running all four
mutations against `npm run check:baseline` in an isolated worktree. B was closed
by asserting the required-gate set against a literal; C by a time-to-trigger
contract asserted on the event log; D by an authoritative threshold test.

**The largest structural finding of this session is not in this document's F
list at all: 97 of the repo's 310 test files were run by nothing.** No npm
script referenced them. 91 passed and are now adopted into
`test:adopted-orphans` (253 tests, ~61s, wired into CI static-gates and
validate:governance:full); 6 were red. Among the 91 were
`src/engine/signal/angle-aware-ee.test.ts` and
`src/profiles/transmitPowerDefault.test.ts` -- the two modules involved in the
SINR admission regression above. The tests existed and passed the whole time;
nothing ran them. `scripts/validate-static-all.mjs` cannot see this class of
problem, since it auto-discovers `validate:*` npm keys only. `validate:test-orphans`
is now a ratchet against new orphans. **Being green is not the same as being run.**

That also produced a fourth independent regression traceable to `6b9474e`: it
added `eeThreshold.ts` with a default of 135 and, in the same commit, a test
asserting the control renders `100` -- internally inconsistent on arrival,
invisible because the test was an orphan.

**Where each acceptance sentence is now checked.** §7 lists five real requests.
This is the map from each to the executable check that would fail if it broke --
the P2 addressability the document asks for, applied to the acceptance list
itself. All of these run: the orphan ratchet is at 0, so every test file in the
repo is reachable from some npm script.

| §7 sentence | Checked by |
|---|---|
| 1. EE below the threshold triggers handover | `eeCommitPermit.test.ts` (literal 135, the 134_999/135_000 boundary), `check:handover`'s EE gate and EE-blind ledger |
| 2. The right rail shows all seven beams | `railProjection.test.ts`, `beamMetrics.test.ts`, `acceptedSnapshot.test.ts` |
| 3. Beam colour follows EE through the handover | `beamMetrics.test.ts`, `homepageSatelliteVisualIdentity.test.ts` |
| 4. The serving beam is not permanently B1 | `handoverPresentationExclusivity.test.ts`, `sinrLiveCellIntraDecision.test.ts` |
| 5. Pressing Intra shows only intra | `handoverDisplayIsolation.test.ts`, `homepageHandoverControlsOwnership.test.ts` |

Worth knowing before planning Track A: the four principal files above carry 243
assertions between them and **none** of them reads production source text --
they exercise behaviour. The data layer behind these five sentences is better
covered than the F-list suggests. What is NOT covered by them is the visual
presentation itself, which is what Track A is about.

**An invariant worth knowing about.** The homepage's EE authority depends on the
legacy SINR-only manager being suppressed once a link exists
(`MainScene.tsx` passes `homepageVisualIdentity && sceneLane === 'sinr-live'`
positionally into `useSimulation`; `App.tsx:4381` derives it from
`pathname === '/'`). Until `c133135` this had no test, no validator and no
golden anywhere. On the homepage lane the five EE-blind manager paths therefore
reduce to initial attach alone; the remaining `legacy-ee-blind` ledger entries
belong to the preview/replay and background-UE lanes.

**§11 should be read as still current.** It is the list of errors made while
writing this document, and the same classes recurred: a wrong mechanism
(`indexOf` vs `.match`), a wrong count (4 vs 3 EE-blind commits), and a claim
about `validate-architecture-boundaries.ts` parsing import edges when it uses a
regex. Verify, do not trust -- including this section.

---

## 1. Why this exists

The owner has repeatedly asked for one behaviour — *handover must trigger only
when serving EE falls below the threshold* — and it has repeatedly been reported
fixed while remaining broken. One codex session on this alone reached 8,516 user
turns and 286 MB (`~/.codex/sessions/2026/09/03/rollout-...01a067f6-...jsonl`).

The same loop recurs across model families. It happened to GPT via codex and, on
2026-09-04, to Claude Opus 5 in this session (five consecutive failed attempts to
render one beam cone). **The variable that does not change between those runs is
this codebase**, so the cause is treated here as structural rather than as model
capability.

## 2. Verified findings

Every row was reproduced directly. Line numbers are from commit `6b9474e`.

| # | Finding | Evidence |
|---|---|---|
| F1 | **Seven commit paths exist; exactly one consults the EE threshold.** The threshold lives in `InstantaneousEePolicy`; the other six commit without ever reading it. | `handover-manager.ts:221,265,319,345,389`; `sinrLiveCellModel.ts:2650` (`selectServiceContinuityFallback`); `handoverSelectionPolicy.ts` `instantaneousEeTriggerStatus` |
| F2 | **The legacy intra rule ignores EE entirely** — it switches on `best.sinrDb > currentSinr`. | `handover-manager.ts:357` |
| F3 | **A value the codebase labels display-only is fed back into decision evidence.** | `sinrLiveCellModel.ts:3576-3581` selects `homepageDemoEeBitsPerJoule` over `rawInstantaneousEe` whenever `multiCandidateDecisionEnabled` |
| F4 | **Canonical EE's denominator is frame-wide system power**, so EE jumps whenever the active beam set changes even when the link is steady. This is the root of the observed <1 to 500 Kbit/J swings and of EE failing to correlate with elevation. | module comment in `engine/handover/homepageDemoEe.ts` |
| F5 | **Per-beam differentiation is gated on single-cell layouts.** In seven-cell mode every non-serving beam receives the same bias of `1`, which is why all candidate beams render near-identical values. | `sinrLiveCellModel.ts:1800` `cellLayout.centers.length === 1 ? [...] : 1` |
| F6 | **Serving and candidate beams use different seeds and clamps**, so repairing one path does not repair the other. | `sinrLiveCellModel.ts:1868-1878` (`initialServingBitsPerJoule` vs `replacementSeed`, candidate target clamped below `initialServing - 4_000`) |
| F7 | **When the serving spacecraft vanishes the code falls back to a frozen cached EE**, which stays at ~153 Kbit/J and therefore never reads as below the 135 floor, so continuity and detach never fire. | `sinrLiveCellModel.ts:2617` (`lastKnownServingEe`), `:2631` (`isEeBelowThreshold`) |
| F8 | **Five core runtime tests are red**, covering exactly the owner's reported symptoms. | see §3 |
| F9 | **ADR-014 blocks default EE-policy activation** and explicitly rejects tuning an instantaneous proxy to obtain desired animation counts. | `docs/decisions/ADR-014-multi-candidate-multibeam-handover.md:12-26` |
| F10 | **Two engines with different physics drive the same page.** The rail timeline is precomputed by `HandoverManager` under a 3 dB SINR offset; the live scene runs `InstantaneousEePolicy` under a 135 Kbit/J EE floor. | `liveWalkerHandoverEventIndex.ts:2,250` vs `sinrLiveCellModel.ts` policy construction |
| F11 | **The two threshold roles were split** during this session by a concurrent worker: `minimumEeBitsPerJoule: 0` (candidate admission) and `servingEeThresholdBitsPerJoule` (service health, 135 Kbit/J). | `sinrLiveCellModel.ts:1180-1181` |

### F1 is the answer to the owner's question

The threshold was never ignored by the code that owns it. It is enforced by one
of seven paths, and the handovers visible on screen are produced by the other
six. Every repair targeted the enforcing path; every observation came from the
non-enforcing ones. That is why the fix never appeared to take, no matter how
many times it was applied.

## 3. The five red tests

Reproduce with:

```
node --import tsx/esm --test src/scene/sinrLiveCellDecisionAuthority.test.ts
node --import tsx/esm --test src/scene/sinrLiveCellIntraDecision.test.ts
```

- `primary multi-candidate authority commits one remeasured link without changing membership`
- `a vanished serving pair uses an explicit measured service-continuity transaction`
- `a vanished serving pair with no safe replacement publishes an explicit detach` — asserts `initial-attach`, receives `monitoring`
- `one-cell layout commits a real same-satellite same-cell intra handover`
- `seven-cell layout commits a same-satellite intra handover without changing membership`

The last two are the owner's "neither one nor seven satellites hand over". The
middle two are "the satellite serves to the horizon, disappears, nothing takes
over". **These are the acceptance criteria; they already exist and already
encode the intended behaviour.**

## 4. Root cause

> **The codebase assumes whoever edits it already understands it.**

Its invariants are real and carefully written, but they live in prose —
`display-only`, `NEVER fabricate`, `never changes serving state`, ADR-014's
gate. Prose binds a careful human reader. It does not bind a weak model, a
rushed edit, or a parallel agent. Safety is therefore proportional to the care
of whoever last touched the file, which is the wrong dependency once agents do
the editing.

Each observed failure maps to a missing mechanical guard:

| What happened | What holds it today | What should hold it |
|---|---|---|
| Display EE entered the decision (F3) | a comment | distinct `DecisionEe` / `DisplayEe` types |
| Seven paths decide handover (F1) | nothing | one commit function; others may only propose |
| Synthesised EE bias (F5, F6) | nothing | contract test: EE monotone in elevation, same-satellite beams within one order of magnitude |
| Six broken beams invisible until displayed | nothing | dev mode renders every beam |
| `endpoint()` returns null, event silently dropped | nothing | absent evidence throws |
| ADR-014 violated (F9) | a document | an executable gate |

## 5. Design principles, in priority order

**P1 — Cheap oracles.** Every question the owner asks must become a command that
answers in seconds without their eyes. `check:handover` (which path approved each
commit, did any bypass the threshold), `check:ee` (monotone in elevation, beams
within an order of magnitude), `check:visual` (screenshot plus geometry
assertions). Without this a weak model has no truth source and will report
success sincerely.

**P2 — Addressability.** A noun in the owner's prompt must map to a filename in
one hop. "EE 低於閾值才換手" currently matches seven plausible files and no
`handoverTriggerRule.ts`. Name modules in the owner's vocabulary.

**P3 — Mechanical rejection.** Types and contract tests, not comments. Test of
success: *can a model that does not understand this project make the obvious
wrong change and pass every check?* Today, easily.

**P4 — Split the god objects last.** `MainScene.tsx` 6,104 lines, `App.tsx`
4,684, `sinrLiveCellModel.ts` 4,186. Splitting is deferred because the tangle is
*inside functions*, not between files: the seven commit sources sit in one
`useMemo`, and the EE seeds/clamps/biases sit in one function. Splitting now
would preserve the tangle across more files and would have to be redone once the
boundaries are known. When it happens it is decided by a strong model and
**executed by tooling with `tsc` as the net — never by a model rewriting files.**

## 6. Step 0 — the one-hour experiment (do this first)

Do not begin any refactor before this returns.

1. Extract `handoverTriggerRule.ts` — the "what conditions permit a handover"
   logic only. Leave the god objects otherwise untouched; they import it.
2. Open a session on a **cheap model** (Haiku / Flash).
3. Give it the owner's own sentence: **「EE 低於閾值才觸發換手」**.
4. Record what happens.

| Outcome | Meaning | Next |
|---|---|---|
| Correct in one shot | addressability was the binding constraint | keep extracting concepts; do not split the god objects |
| Finds the file, edits wrongly | addressability solved, guarding is not | add types and contract tests (P3) |
| Cannot find the file | the name is wrong | rename, retry |
| Edits correctly, screen unchanged | **other commit paths still bypass it (F1)** | converge the commit paths before anything else |

This experiment is deliberately falsifiable and settles the plan empirically
rather than by argument.

## 7. Acceptance — five real requests

The refactor is done when a **cheap** model handles these in one shot, or fails
with a clear red signal. All five were actually requested and actually failed.

1. EE below the threshold triggers handover
2. The right rail shows all seven beams of the serving satellite
3. Beam colour strength follows EE, faint to strong, through the handover
4. The serving beam is not permanently `B1`
5. Pressing Intra shows only intra; no inter event intrudes

## 8. Non-goals

- No big-bang rewrite. The physics and the test assets are real value.
- No splitting for its own sake. Stopping rule: **one writer per fact, one-way
  projections, no shared implementation regions between parallel tasks.** Not
  "one change touches one file" — interfaces, adapters and tests legitimately
  co-change.
- Do not tune the EE proxy so it crosses the threshold. ADR-014 forbids it (F9),
  and it is circular: authoring a value, letting the engine consume it, then
  verifying the authored crossing proves nothing about live EE.
- No concurrent sessions editing the same region. During this session three
  files changed underneath the work, and `HEAD` was committed at 09:25 by
  another session, sweeping ~46 files including this session's.

## 9. Open questions

Each names the measurement that settles it. None blocks Step 0.

- Does canonical EE cross any reasonable threshold under real TLE geometry?
- Starlink or OneWeb? The 90-day atlas (Starlink 0 valid / 43,943 forced;
  OneWeb 329 valid, all below 45° elevation) was measured under the *old* 3 dB +
  30 s TTT policy, so it does not predict behaviour under an EE rule.
  HYPOTHESIS: density favours Starlink once the 30 s TTT no longer applies.
- What threshold value on the canonical scale? The current 135 is calibrated to
  the demo band (80–180 Kbit/J), not to raw EE.
- The visual/physical tension: every real conditional handover in the atlas
  occurred below 45° elevation, where a cone rakes across the terrain rather
  than descending. Options: accept it and use camera language; use a declared
  synthetic scenario; or present both side by side.

## 10. Authored input versus authored output

Teaching content is legitimate when it authors the **scenario** — geometry,
initial conditions, time window — and lets the real engine reach a real
conclusion. It is not legitimate when it authors the **output** the decision
reads. The current code does the second (F3). Fixing this unblocks both the
scientific and the teaching use, because ADR-014's calibration prerequisite is
the same work either way.

## 11. Errors made while producing this document

Recorded so the next session does not repeat them.

- Claimed conditions ② and ③ were mutually unsatisfiable ("no threshold can
  satisfy both"). Wrong: the thresholds had already been split (F11).
- Claimed the fix was to calibrate the demo EE trajectory. Wrong and circular
  per F9; also incomplete, since the decision runtime's commit and continuity
  paths are themselves red (F8).
- Diagnosed an `agy` timeout as a model-name format problem and "fixed" it by
  switching to the model id; the display name worked all along, and that change
  probably caused the second failure.
- Verified "no foreign handover intrudes" by reading a DOM attribute on an
  element that does not exist while the teaching panel is open. The empty read
  was interpreted as success. A subagent in the same session asserted
  `teachingCones === 2`, which counted mounted components while the cones were
  rendering as flat patches on the terrain. **Two false passes from oracles that
  could not distinguish success from failure** — this is the concrete argument
  for P1.

## 12. Review status

Round 1 of a cross-family review ran against an earlier version of this
analysis: `gpt-5.6-sol` via codex and `Gemini 3.8 Flash (High)` via agy, briefs
and raw output in `.scratch/frontend-review/`. Both independently identified F3.
Codex contributed F9 and the circularity argument; Gemini contributed F7 and
F10. **The confirmation round was not run**, so those verdicts are single-round.
Review this SDD after Step 0, not before — the next action is a measurement, and
a measurement outranks an opinion.
