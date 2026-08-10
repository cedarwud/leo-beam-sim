# C-90 Phase-1 classroom-readiness audit — 2026-08-09

## 1. Overall verdict

`BLOCKED_BEFORE_3_5_NOVICE_WALKTHROUGH`

**FACT / FAIL / STATIC + FOCUSED-TEST + BUILD + LIVE-BROWSER.** A fresh production-preview browser session did reach a new JSON export, and E1 three-arm outcomes, E2 withholding/freeze/replay, identity synchronization, claim labels, reset/reload, route isolation, compilation, and current focused tests produced useful positive evidence. Those positives do not satisfy the current course contract because five mandatory boundaries fail:

1. TLE is a staged inspection of a preloaded fixture, not a learner import/source-selection and source-to-scenario operation. The normal path also skips display of stage 5, and the stage-5 `Open E1 mission` control does not navigate after the learner returns to inspect it.
2. E1's replay slider exposes the endpoint before the required mid-run update. A fresh browser moved directly from `e1-balanced-0` to `e1-balanced-3` with the checkpoint field empty and displayed 180 s, 22 W, 402 J, 120 Mbit, and 0.299 Mbit/J.
3. IoT learner and revision text do not select or create the outcome-producing schedule. Three fixed provider presets own the results; contradictory learner text left the frame and all outcomes unchanged.
4. Retrieval has no learner-answer controls or state/export producer. The complete screen renders three fixed statements and reports zero inputs/textareas.
5. `C90CourseRoute` consumes an arbitrary `provider` prop before applying the complete contract validator. Tests validate the fixture and a second provider's state-machine compatibility, but do not mount the route with a second or malformed provider.

The current claim ceiling remains:

> fixture-world simulated teaching beta; pending novice timing, 20-seat rehearsal, human visual acceptance and Phase-2 canonical/live backend

This audit does not establish learner pacing, multi-seat operation, human visual acceptance, scientific parity, measurement validity, or a live service.

## 2. Preflight, ownership, and examined scope

### Repository preflight

- `pwd`: `/home/u24/demo/leo-beam-sim`
- branch: `main...origin/main`
- HEAD: `d3ab66794cfda75f55bfd98d25202ca45289b3ae`
- no repository-local `AGENTS.md`, `CLAUDE.md`, or `GEMINI.md` was present; the user-supplied AGENTS instructions governed this non-heavy local audit.
- pre-existing dirty WIP, before audit evidence/report files:

```text
 M index.html
 M package.json
 M src/main.tsx
?? public/favicon.svg
?? src/course/
?? src/vite-env.d.ts
```

**FACT / RISK.** All current `src/course/**` implementation and tests are untracked WIP. A working local browser is therefore not a durable integration claim: the complete course route can be omitted from a patch, lost, or diverge without ordinary history/review visibility. This audit preserved that WIP and did not commit, stage, stash, reset, revert, or edit it.

Audit-created files are limited to this report and `artifacts/c90-classroom-readiness-audit-2026-08-09/`, as authorized by the audit prompt.

### Authority and source scope examined

- current `C-90-ENERGY-1` section only in `issues/07-complete-cycle-prototype.md`, plus issues 04, 05, 06, and 08;
- ADR-C-002 fixture-first Leo visual host decision;
- Phase-1 implementation prompt and the C120 reserve supplement (C120 was not pulled into scope);
- `contracts/angle-aware-ee-v1/README.md` and `PARITY-PLAN.md` for the scientific/claim ceiling;
- repo README and frontend change/render governance;
- current `src/main.tsx`, all `src/course/**`, relevant package scripts, `BaseSceneLayout`, `NTPUScene`, and NTPU configuration boundary.

No BeamShift, Scenario Globe, planning document, paper, training, server, slide, dependency, or backend implementation was modified.

## 3. Evidence-level summary

| Area | Result | Evidence level | Basis |
|---|---|---|---|
| Direct and query route reachability; legacy default | PASS / FACT | STATIC + LIVE-BROWSER | `/course/c90` and `/?course=c90` each mounted one course route; `/` mounted no course route. |
| Legacy runtime isolation and no browser-side scientific producer | PASS / FACT | STATIC + FOCUSED-TEST + BUILD | Course imports use the isolated route, provider fixture, `BaseSceneLayout`, and NTPU config; forbidden runtime imports and outcome formula production were not found. |
| Complete claim boundary | PASS / FACT | STATIC + LIVE-BROWSER + EXPORT | Header, rails, scene/footer, manifest, and fresh JSON contain the four-part simulated-data boundary. |
| Arbitrary provider validation and UI substitution | FAIL / FACT | STATIC + FOCUSED-TEST | Validator exists, and fixture/stub contract tests pass, but route prop consumption is not wrapped in it and there is no mounted second-provider test. |
| Ready mechanics | PARTIAL / FACT + UNKNOWN | LIVE-BROWSER | Three checks and Ready worked by keyboard with visible focus and no login/install. A real novice 60-second completion is untested. |
| Learner-operated TLE journey | FAIL / FACT | STATIC + LIVE-BROWSER | Preloaded inspection only; no import/source selection or target-run action; normal flow skips card 5 and its return button is inert. |
| E1 distinct branches and table | PASS / FACT | FOCUSED-TEST + LIVE-BROWSER + EXPORT | Three arms reached distinct endpoint frames and saved service/time/W/J/data/EE outcomes. |
| E1 prediction-before-endpoint gate | FAIL / FACT | LIVE-BROWSER | Timeline End exposed the endpoint while the required checkpoint update remained empty. |
| E2 event replay and withheld B | PASS / FACT | FOCUSED-TEST + LIVE-BROWSER + EXPORT | B remained disabled until a distinct A replay and frozen rule; rule input then disabled; rewind identity matched. |
| IoT consequential rule/schedule authoring | FAIL / FACT | STATIC + LIVE-BROWSER + EXPORT | Rule text changes did not change the selected preset frame or any result. |
| Eight-field competition idea | PASS / FACT | STATIC + LIVE-BROWSER + EXPORT | Eight independently labeled fields were required and present in the fresh JSON. |
| Three learner retrieval answers | FAIL / FACT | STATIC + LIVE-BROWSER + EXPORT | Complete panel has fixed bullets, zero answer controls, no session fields, and no bundle fields. |
| Incomplete/complete export and identity | PARTIAL / FACT | FOCUSED-TEST + LIVE-BROWSER + EXPORT | Incomplete export is disabled/fail-closed and a fresh coherent JSON downloaded, but it preserves contradictory IoT text/results and omits retrieval evidence. |
| Reset/reload/fallback | PARTIAL / FACT | FOCUSED-TEST + LIVE-BROWSER | Full reset/reload and TLE fallback preserve scenario identity; no IoT-board reset exists, and TLE stage-5 recovery navigation is broken. |
| Desktop/laptop/narrow layout and keyboard | PARTIAL / FACT + INFERENCE | LIVE-BROWSER + HUMAN-IMAGE-INSPECTION | No page-level horizontal overflow at 1024 or 390; keyboard focus works. Text is frequently 9–12 px, mobile form text is 13 px, no skip link exists, and the 1024 IoT document is 4282 px tall. |
| Novice time-on-task and classroom operation | NOT-TESTED / UNKNOWN | HUMAN | Controller automation cannot establish 45/55 minutes of individual work, 3–5 novice success, or 20-seat operation. |

## 4. Mandatory completeness matrix

| requirement | exact student action | actual UI control/path | state/provider producer | visible result + unit | saved/exported evidence | reset/recovery | focused-test evidence | fresh-browser evidence | verdict | fact/inference/unknown |
|---|---|---|---|---|---|---|---|---|---|---|
| Route isolation | Open direct or query route without entering legacy UI | `/course/c90`, `/?course=c90`; dispatch in `src/main.tsx:12-31` | lazy `C90CourseRoute`; fixture provider | one NTPU course workspace | route/provider/claim identity in DOM and bundle | reload restores provider-bound session | source-regex route test only | both URLs mounted one route; `/` mounted legacy and zero course routes | PASS | FACT; STATIC/FOCUSED-TEST/LIVE-BROWSER |
| Scene/readout/export identity | Move E1/E2 timeline and choose branches | course scene, timeline range, right KPI rail | one `CourseSceneFrame` selected in `C90CourseRoute.tsx:55-103` | frame ID plus s, Mbps, W, J, Mbit, Mbit/J, az/el/range | fresh JSON: scenario `ntpu-pass-01`, fixture/provider IDs | reset/reload preserved scenario | frame/identity contract tests pass | observed synchronized E1/E2 frames and exported same scenario | PASS | FACT; FOCUSED-TEST/LIVE-BROWSER/EXPORT |
| Provider substitution and fail-closed seam | Load the same UI with a second valid provider; reject malformed values before display | optional `provider` prop at `C90CourseRoute.tsx:24-26,187-200` | `assertCourseDataProvider` exists at `contract.ts:862-887`, but route does not call it | should either render validated data or a bounded error, never NaN/mismatch | export catches some late errors only | restore key binds provider ID | fixture/malformed provider tests pass; stub test exercises state only | no mounted stub/malformed provider evidence | FAIL | FACT; STATIC/FOCUSED-TEST; browser case absent |
| Claim boundary | Read before interpreting any number | header badge/bar, both rails, scene legend, footer | manifest and `C90_CLAIM_BOUNDARY` | complete four-part warning | complete boundary and claim levels in JSON | remains after route/reload/reset | contract test checks boundary | visible at desktop, laptop, narrow; fresh JSON exact match | PASS | FACT; STATIC/FOCUSED-TEST/LIVE-BROWSER/EXPORT |
| Ready, 00–01 | Confirm workspace, simulated data, Reset knowledge; activate Ready | three checkboxes and `ready-check` button | local Ready state | TLE stage unlocks | `readyCheckCompleted` in bundle | reset clears checks; reload restores checkpoint | session transition/reset tests pass | keyboard Tab/Space/Enter path worked with 2 px focus outline | PARTIAL | FACT for mechanics; UNKNOWN for novice 60 seconds |
| TLE source-to-scene, 00–10 | Import/select pinned TLE, choose supplied UTC, run/advance all five transformations, explain source/derived/assumption | only `Inspect pinned TLE record`, explanation box, and `Inspect next stage` | `provider.getTleJourney()` returns all preloaded cards | friendly input/transform/output/unit/purpose/provenance text; no learner-produced scenario | explanation saved in JSON | fallback preserves scenario | fixture order/provenance test passes | no import/select/run boundary; card 4 jumped to E1; card 5 required nav-back and `Open E1` stayed at TLE | FAIL | FACT; STATIC/LIVE-BROWSER |
| E1 branch comparison | Predict, choose candidate order, run balanced/low-power/fast-finish, recommend and qualify | prediction; three arm cards; advance/save; radio; verdict; explanation | provider arms and session arm order/completion | balanced 180 s/22 W/402 J/120 Mbit/0.299; low 236 s/12 W/396 J/104 Mbit/0.263 and deadline miss; fast 142 s/34 W/450 J/120 Mbit/0.267 | prediction, checkpoint, order, all arms, recommendation/verdict/explanation | replay can select a completed arm; reset clears | provider and complete-session tests pass | all three endpoint frames and comparison table observed; JSON contains all arms | PASS | FACT; FOCUSED-TEST/LIVE-BROWSER/EXPORT |
| E1 protected mid-run update | Update judgment after an intermediate frame and before first endpoint | checkpoint textarea plus global replay range | `e1TimelineIndex`; checkpoint capture in session | endpoint should remain hidden until update | checkpoint saved | reset clears | tests require nonblank checkpoint by completion, not reveal ordering | pressing End on replay changed frame 0→3 and exposed endpoint with checkpoint empty | FAIL | FACT; LIVE-BROWSER |
| E2 A/replay/frozen B | Predict; run one A action; rewind; run a different A action; freeze rule; run B without retune; explain | action cards, advance/save, rewind, rule gate, Trace tabs, verdict/explanation | trace branches plus guarded session transitions | serving beam, trend, s, Mbps, W, J, Mbit/J | A action, distinct replay, B action, frozen rule, verdict/explanation | rewind returns event frame; reset clears | branch-separation session test passes | B disabled before replay/freeze, input disabled after freeze, rewind frame matched, B completed | PASS | FACT; FOCUSED-TEST/LIVE-BROWSER/EXPORT |
| IoT baseline/learner/revision | Place task cards/use prepared blocks to form a rule, observe, revise one consequential placement/rule | three preset buttons plus two free-text inputs; no board/block placement | selected fixed `IoTRun`; text only updates `IoTRecord` | fixed delivered/fresh/expired, active s, J, Mbit/J | all three presets plus learner text saved | only full-session reset; no board reset | tests prove three fixture versions, not learner-produced branch | contradictory learner and revision text left `iot-learner`/`iot-revision` and outcomes unchanged | FAIL | FACT; STATIC/LIVE-BROWSER/EXPORT |
| Competition idea | Author eight falsifiable fields | eight labeled textareas | `ideaCard` session state | readable eight-field card | all eight keys in fresh JSON | full reset clears | source count and session tests pass | all eight fields required before CTA enabled | PASS | FACT; STATIC/FOCUSED-TEST/LIVE-BROWSER/EXPORT |
| Retrieval, 84–90 | Answer three questions personally | no answer controls; three fixed check-mark statements | no retrieval session/provider producer | fixed prose only | absent from fresh JSON | none | no retrieval-answer test | complete panel had zero inputs/textareas | FAIL | FACT; STATIC/LIVE-BROWSER/EXPORT |
| Learning bundle | Attempt early export; after completion export one JSON and reopen/inspect it | disabled rail export; final CTA; export-again | readiness plus provider bundle builder | byte count, fixture/scenario IDs | fresh 71,597-byte JSON with TLE/E1/E2/IoT/idea/claims | export-again works while page remains complete; reset starts new session | readiness/export tests pass | fresh download inspected; identity coherent; retrieval absent and IoT text/result contradiction preserved | PARTIAL | FACT; FOCUSED-TEST/LIVE-BROWSER/EXPORT |
| Recovery/self-study | Reload mid-course; reset complete course; use TLE fallback; replay/rewind | local checkpoint, header/reset, fallback, E1 timeline, E2 rewind | provider-bound localStorage envelope and deterministic frames | restored stage/frame; reset Ready; same scenario | prior export remains downloaded; new reset ordinal | reset/reload/fallback directly exercised | persistence/reset tests pass | reload restored one E1 completion; full reset Bundle→Ready; fallback same scenario; TLE final-stage return broken | PARTIAL | FACT; FOCUSED-TEST/LIVE-BROWSER |
| Four distinct interactions | Perform source journey, policy comparison, event replay, task-rule revision | current TLE/E1/E2/IoT panels | session plus provider fixtures | visibly different intended panels | bundle records each domain | mixed | source presence tests only | E1 and E2 are behaviorally distinct; TLE is passive and IoT is preset+text | FAIL | FACT; LIVE-BROWSER |
| Browser/visual/a11y | Complete by mouse and keyboard at desktop/laptop/narrow sizes | semantic buttons/labels/tables, canvas plus text rail | React DOM and CSS | readable non-color KPI evidence; responsive layout | screenshots and browser logs | reload/reset checked | only source regex for focus/layout | 1440x900, 1024x768, 390x844 inspected; no page-x overflow; small text/no skip link/long vertical path remain | PARTIAL | FACT plus INFERENCE on novice burden; LIVE-BROWSER/HUMAN-IMAGE-INSPECTION |
| Time and classroom scale | Complete independently in exact cadence with recovery and no continuous rescue | not representable by controller automation | humans, devices, room operations | observed individual decision/explanation time | novice/rehearsal records | human recovery observation | none | audit operator took about 9:05 including evidence/debug; not pacing evidence | NOT-TESTED | UNKNOWN/HUMAN |

## 5. Fresh browser walkthrough and evidence

### Browser setup and session discipline

- One retained Chrome session: `c90-audit-20260809`, in-memory profile.
- localStorage was cleared before the direct-route run.
- The user asked for a session inventory: six sessions were open; five stale sessions were closed, leaving only this session. Every viewport, route, reset, reload, and export check then reused it.
- Production preview: `http://127.0.0.1:4179` from the successful build.

### Complete-path log

The browser reached a fresh export through:

`Ready → TLE cards 1–4 → E1 → nav-back to inspect TLE card 5 → nav workaround to E1 → all E1 arms → E2 A/wait → rewind → A/switch-now → freeze → B/remain → IoT baseline/learner/revision → eight idea fields → complete screen → JSON`.

The workaround is evidence of the TLE defect, not a PASS for the prescribed linear flow.

- audit-operator elapsed from fresh reload to export: approximately **9 minutes 5 seconds**, including screenshots/instrumentation and one 30-second wait caused by the broken TLE return control;
- recorded student-style interactions: **73** total — 50 clicks, 19 text-entry actions, and 4 checkbox/radio actions;
- this fast automated path is usability instrumentation only and does not estimate a novice's 90-minute lesson or individual work time.

Detailed direct observations are recorded in [browser-walkthrough-log.md](../../artifacts/c90-classroom-readiness-audit-2026-08-09/browser-walkthrough-log.md).

### Recovery and keyboard log

- reload after the first E1 arm restored E1 with one completed table row and the same `e1-balanced-0` inactive frame;
- full reset changed Bundle/`iot-revision` to Ready/`e1-balanced-0`, preserved `ntpu-pass-01`, incremented reset ordinal to 1, and reloaded as `local checkpoint restored`;
- TLE fallback opened E1 and preserved `ntpu-pass-01`;
- keyboard Tab/Space/Enter reached all Ready controls in order, each control reported a 2 px solid focus outline, and Enter opened TLE;
- reset produced no confirmation dialog, so one accidental activation immediately discards local progress.

### Visual and accessibility findings

Positive browser facts:

- the NTPU scene remains the only satellite scene on the course route;
- tables and the right rail provide textual results, so the lesson does not depend only on 3D color/animation;
- at 1024 and 390 CSS pixels, document width equaled viewport width; the tables/stage navigation use bounded internal scrolling;
- labels, table captions, group labels, status text, and visible focus were present for the exercised controls.

Findings using the UI-audit rule vocabulary:

- **P1 — `type-readable-scale`:** many instructional/claim labels are 9–12 px at desktop; the full claim and stage text are 10 px at 390. This is too small for a dense novice classroom surface.
- **P1 — `forms-mobile-input-font-size`:** narrow form text measured 13 px, below the 16 px mobile-input threshold and susceptible to browser zoom/reading friction.
- **P1 — `a11y-skip-link-heading-order`:** heading order is H1→H2, but there is no skip link; keyboard users traverse header and stage controls before the long workspace on every reload.
- **P1 — `interaction-target-size`:** exercised controls were at least 34–36 px high, above the 24 px minimum but below the preferred 44 px classroom/touch target in several cases.
- **P1 — `layout-long-content-safety`:** there is no page-level x overflow, but the IoT page at 1024x768 measured 4282 px tall and the scene is placed before the learner rail under 860 px. The long travel and repeated scroll context require novice validation.
- **P1 — `interaction-keyboard-operable` / `interaction-focus-visible`:** exercised Ready controls passed; E1's keyboard-operable range also exposed the endpoint prematurely, which is a semantic gate failure rather than an accessibility success.

### Console, request, and WebGL evidence

[browser-console-page-errors.txt](../../artifacts/c90-classroom-readiness-audit-2026-08-09/browser-console-page-errors.txt) records:

- current direct C-90 navigation: 0 console errors, 0 current warnings, no surfaced page error, no failed current resource request;
- C-90's current performance resource list contained only local production chunks, `NTPU.glb`, and favicon;
- four Chrome WebGL `ReadPixels` GPU-stall performance warnings occurred during screenshot capture, with no context loss;
- the only external CDN request and legacy informational log belonged to the deliberately visited `/` legacy route, not C-90.

## 6. Gaps and minimum remediation tickets

These are descriptions only. This audit did not open or implement tickets.

### P0 blockers

1. **`C90-R1-TLE-LEARNER-ACTION`** — Add an explicit pinned offline source selection/import boundary and supplied target-UTC action, then advance five inspectable stages without skipping stage 5. Make final-stage E1 navigation functional. Keep all propagation/look-angle values precomputed; do not add a browser physics producer.
2. **`C90-R2-E1-REVEAL-GATE`** — Prevent replay/timeline access from exposing a first-candidate endpoint until a non-empty update is captured at an intermediate frame. After completion, retain unrestricted replay. Add a mounted browser assertion for the reveal order.
3. **`C90-R3-IOT-CONSEQUENTIAL-RULE`** — Replace the preset picker as the learner action with a small task-board or prepared non-code blocks. Map each legal authored schedule/revision to a genuinely different precomputed provider branch. Fail closed if no exact branch exists; keep formulas out of the UI.
4. **`C90-R4-RETRIEVAL-EVIDENCE`** — Add three individually labeled learner-answer fields, completion/readiness gating, checkpoint persistence, and bundle fields. Fixed teaching prompts may remain, but cannot substitute for answers.
5. **`C90-R5-VALIDATED-PROVIDER-BOUNDARY`** — Validate every supplied provider before any manifest/experiment/frame is consumed. Provide a bounded course-route error state and mounted tests for a valid second provider plus malformed/mismatched/NaN providers.

All five require a new focused test run, production build, and fresh complete browser/export audit before novice exposure.

### P1 before novice walkthrough

1. **`C90-R6-DURABLE-BROWSER-GATE`** — Add a repository-owned mounted/browser validator for the complete route, reveal order, TLE navigation, IoT authoring, retrieval, recovery, identity, and export. The current `C90CourseRoute.test.tsx` is source regex only.
2. **`C90-R7-RECOVERY-SCOPING`** — Add a bounded IoT-board reset/retry and make TLE fallback/re-entry self-explanatory. Add confirmation or a short undo path for full-session Reset.
3. **`C90-R8-READABILITY-A11Y`** — Raise instructional/claim/form text to a classroom-readable scale, use 16 px narrow form controls, add a skip link, review target sizes, and keyboard-test all stages rather than Ready only.
4. **`C90-R9-LAPTOP-FLOW-DENSITY`** — Reduce the 1024/narrow scroll burden while keeping the NTPU scene the single visual anchor; verify IoT, idea, complete, tables, and footer at representative laptop sizes.
5. **`C90-R10-INTEGRATION-DURABILITY`** — After the owner approves the implementation changes, create a tracked reviewable integration checkpoint containing the complete route and its required assets/tests. This audit does not grant commit authority.

### P2 before classroom use

1. Run a 3–5 novice walkthrough against the exact 90-minute cadence; record independent decisions/explanations, actual recovery requests, and whether at least 45 minutes of individual work occurs.
2. Repair walkthrough findings and perform the 20-seat rehearsal on representative classroom hardware/network/offline serving conditions, including a measured 60-second ready/fallback exercise.
3. Obtain human visual acceptance and representative assistive-technology/keyboard review.
4. Keep Phase-2 backend integration as a separate provider task after the fixture-first beta. It must not retroactively upgrade this audit's scientific claim.

## 7. Commands and machine-gate results

Exact preflight/gate commands were run from `/home/u24/demo/leo-beam-sim`:

| Command | Exit | Result |
|---|---:|---|
| `pwd` | 0 | `/home/u24/demo/leo-beam-sim` |
| `git status --short --branch` | 0 | dirty WIP shown in section 2 |
| `git rev-parse HEAD` | 0 | `d3ab66794cfda75f55bfd98d25202ca45289b3ae` |
| `git diff --check` | 0 | no output |
| `npm run test:course` | 0 | 15 pass, 0 fail: 6 provider/contract + 5 session + 4 source/static route tests |
| `npm run lint` | 0 | `tsc --noEmit` passed |
| `npm run build` | 0 | `tsc && vite build`; 872 modules; production build passed in 6.68 s |

Build note: the legacy `App` chunk emitted a >900 kB warning; the isolated C-90 JS chunk was 81.60 kB (23.65 kB gzip). No build failure occurred. The durable summary is [machine-gates.txt](../../artifacts/c90-classroom-readiness-audit-2026-08-09/machine-gates.txt).

Browser command family, all using the same named session:

```text
/home/u24/.codex/skills/playwright/scripts/playwright_cli.sh -s=c90-audit-20260809 open http://127.0.0.1:4179/course/c90 --browser chrome
/home/u24/.codex/skills/playwright/scripts/playwright_cli.sh -s=c90-audit-20260809 localstorage-clear
/home/u24/.codex/skills/playwright/scripts/playwright_cli.sh -s=c90-audit-20260809 reload
/home/u24/.codex/skills/playwright/scripts/playwright_cli.sh -s=c90-audit-20260809 resize 1440 900
/home/u24/.codex/skills/playwright/scripts/playwright_cli.sh -s=c90-audit-20260809 run-code '<inline learner/recovery/identity assertions recorded in browser-walkthrough-log.md>'
/home/u24/.codex/skills/playwright/scripts/playwright_cli.sh -s=c90-audit-20260809 console error
/home/u24/.codex/skills/playwright/scripts/playwright_cli.sh -s=c90-audit-20260809 requests
```

Browser wrapper invocations used for completed assertions/screenshots returned exit 0. Four overlong inline probes reached the tool's 30-second command window while waiting on a state that exposed a defect or due an incorrect first keyboard/range probe; each was followed by a direct state probe and a shorter exit-0 reproduction. These controller-instrumentation timeouts were not page errors and are not counted as product PASS evidence.

## 8. Artifact index and SHA-256

All paths are under `artifacts/c90-classroom-readiness-audit-2026-08-09/`.

| Artifact | SHA-256 | Purpose |
|---|---|---|
| `01-desktop-ready-fresh.png` | `d5468bc3a380e3987bc0ce1bb70c917b5d693b6ef2ee433b55a0a16ad376f049` | fresh full-page Ready |
| `02-desktop-ready-viewport.png` | `d60e111e63fd32a4dcc7a7f75c7769ed5747f20c573e762ef617c2a9f47d434a` | 1440x900 Ready viewport |
| `03-desktop-tle-final-stage-after-nav-back.png` | `6f84624fdffb5656ef7d6d7bf45eb2af124f780a6a9a067390477f128fb00d57` | TLE stage 5 only after nav-back |
| `04-desktop-e1-first-endpoint.png` | `39dd6f955c15040130cc851b7cda61343e3ae017ebdf8b42b4b39d0417305054` | normal first-arm endpoint |
| `05-desktop-e1-three-arm-table.png` | `6a32f4c58199a00100ba159a3d338973b1baf122ef3fe6c8fc37d17f4dac4864` | completed E1 table and judgment |
| `06-desktop-e2-trace-b.png` | `3fb9944f01a207a2f0c831e9d5ecbe4bf5255a06d79dd4f1550dd24a6c68329f` | frozen rule and withheld B |
| `07-laptop-iot-viewport.png` | `738c0cf22a54a91ed9ca8a5e8e6baa3a6c67dca250b9252959a3ca49d31f770f` | 1024 IoT preset/text contradiction |
| `08-laptop-idea-card.png` | `88c1aca5251c33a30932186db43c57b4a8cf0ce93794ea5df7a464c87398101a` | eight-field idea and export gate |
| `09-laptop-complete-fixed-retrieval.png` | `38ba1b5e61d660e91746bfe48294682e2c59e1540d1c51527822ce776895c4de` | fixed retrieval statements |
| `10-keyboard-focus-visible.png` | `c98dd7d290975ca636a48f19a5634e73f9780250905f798edda386ae2143ef8b` | keyboard Ready focus |
| `11-narrow-top.png` | `19a943e4e03276048f32025c4e7e9f90ec881dd4d06a9e463af05e673e57d003` | 390x844 top/scene |
| `12-narrow-e1-form.png` | `217e7af6e4be49c648d1698c49b02afc460b5250ee124b46d202dad9cd33b5de` | 390 E1 form/table |
| `13-e1-endpoint-before-midrun-update.png` | `227c9fbbc47802e249ff3fa73200ed7591e3b06a1b869017e34477442e5875f7` | endpoint exposed by range |
| `14-e1-endpoint-empty-checkpoint.png` | `ba6a27ae7c844d9b25fcd9009806ebe5e0d4098efce3e0d7abdc0bc1ba830d2d` | endpoint and empty update together |
| `C-90-ENERGY-1-ntpu-pass-01-learning-bundle.json` | `c9221f592bb236b49d175dee655fb1091b67f4316b9b0700a4f9be848aa1c304` | fresh browser export |
| `browser-console-page-errors.txt` | `353b09298e63064e18ba7ebd75a6c4ae2c8a266bae0babe5f5ad70c89f48659c` | console/request summary |
| `browser-walkthrough-log.md` | `4d59953b8a52821756ef65491c6e961fd58a99363730096bebdb26f533fa70bd` | complete/recovery direct observations |
| `machine-gates.txt` | `94c4f16f989d0c248dc36738e7199e828aa262674eef0a741c7e34c3e908611a` | exact machine-gate summary |

All screenshots were visually opened and inspected; file existence alone was not used as visual acceptance.

## 9. Remaining human and unknown gates

- **UNKNOWN / HUMAN:** 3–5 novice comprehension, exact cadence, independent work duration, rescue frequency, and whether learners can explain all three energy principles in ordinary language.
- **UNKNOWN / HUMAN:** 20-seat startup, local hosting/network behavior, actual classroom laptop mix, WebGL stability across those devices, and 60-second ready/fallback behavior.
- **UNKNOWN / HUMAN:** visual acceptance by the course owner and accessibility validation with representative keyboard/assistive-technology users.
- **UNKNOWN / SCIENTIFIC:** measured accuracy, calibration, scientific parity, and real satellite saving magnitude; intentionally outside this fixture-first phase.
- **PENDING / SEPARATE PHASE:** canonical/live provider implementation and integration.

The next admissible gate is not a novice walkthrough yet. First close P0 tickets R1–R5, rerun focused/build/browser/export evidence on the repaired checkout, then decide whether the result may enter a 3–5-person novice walkthrough.
