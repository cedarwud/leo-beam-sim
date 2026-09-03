# WI-02 unified runtime and visual-acceptance harness

Status: **CANDIDATE_EVIDENCE**  
Prerequisite token: `PASS_WI-01`  
Review stop: `WAITING_FOR_REVIEW_WI-02`

This bundle establishes the candidate single-frame ScenePlan seam and a
standalone browser contract fixture. It does not claim owner visual acceptance,
Golden Flow acceptance, Global acceptance, route cutover, lesson/science
acceptance, or platform readiness.

## Changed paths

Part A runtime seam:

- `src/visualLab/session/scenePlanCompiler.ts`
- `src/visualLab/session/scenePlanCompiler.test.ts`
- `src/visualLab/session/visualLabSession.ts`
- `src/prototype/visual-lab-g0/VisualLabScene.tsx`
- `src/prototype/visual-lab-g0/UnifiedVisualLabPrototype.tsx`

Part B/C fixture and validators:

- `visual-contract-fixture.html`
- `src/visualAcceptance/fixtureApp.tsx`
- `src/visualAcceptance/fixture.css`
- `src/visualAcceptance/rectangleUnion.ts`
- `src/visualAcceptance/rectangleUnion.test.ts`
- `scripts/validate-visual-contract-browser.ts`
- `scripts/validate-visual-contract-architecture.ts`

Generated candidate evidence:

- `output/playwright/visual-contract/valid.png`
- `output/playwright/visual-contract/bad-overlap.png`
- `output/playwright/visual-contract/bad-unmarked.png`
- `output/playwright/visual-contract/bad-ancestor-hidden.png`
- `output/playwright/visual-contract/bad-allowed-decoration-oversize.png`
- `output/playwright/visual-contract/bad-allowed-decoration-shadow.png`
- `output/playwright/visual-contract/contact-sheet.png`
- `output/playwright/visual-contract/current-simulator-quarantine.png`
- `output/playwright/visual-contract/machine-report.json`
- `output/playwright/visual-contract/architecture-report.json`

No route, package, course, homepage, platform, credential, commit, or push was
changed by this work order.

## Runtime boundary

`compileScenePlan` is a pure internal module. The route-facing session remains
the three-method `snapshot` / `subscribe` / `dispatch` facade. The public scene
component accepts one `scenePlan`; the private exhaustive
`ScenePlanRenderer` derives view, density, focus, global projection, and local
projection from that same immutable plan before entering the only R3F Canvas.
`focus: none` maps to the previous renderer behavior (`geometry`). Missing
accepted data is rendered through the existing unavailable path. Plan
availability is view-aware: `earth` requires the accepted global projection;
`sky` and `service` require the accepted local projection. A service frame with
`global === null` is therefore available and is not falsely downgraded to an
unavailable plan; a global-only earth frame is likewise valid.

The compiler is not exported from `src/visualLab/session/index.ts`, and the
architecture report records that no public layer/plugin registry was added.

## Browser evidence

The browser validator starts a dedicated Vite process on an unused loopback
port, serves `visual-contract-fixture.html`, captures the valid case and five
deliberate negative cases, writes the artifacts, and stops the process in
`finally`. It also smoke-tests `/simulator` on that isolated server and stores
the current product screenshot as quarantine evidence. Canonical capture
settings:

- valid and bad primary captures: `1920×1080`, DPR `1`
- responsive check: `320×720`, DPR `1`
- valid URL: `/visual-contract-fixture.html?case=valid`
- deliberate negative URL: `/visual-contract-fixture.html?case=bad-overlap`
- adversarial unmarked URL: `/visual-contract-fixture.html?case=bad-unmarked`
- ancestor-hidden URL: `/visual-contract-fixture.html?case=bad-ancestor-hidden`
- allowed-decoration geometry URL: `/visual-contract-fixture.html?case=bad-allowed-decoration-oversize`
- allowed-decoration shadow URL: `/visual-contract-fixture.html?case=bad-allowed-decoration-shadow`

The command passes only when the valid case is all-green, the overlap case is
red for the expected `subject-overlay`, `inactive-cues`, unregistered-surface,
and hidden-mounted-node findings, the unmarked case is red even though its
full-screen overlay, persistent sidebar, and CSS-hidden cue omit all contract
data markers (including nested copies inside the registered `scene-context`),
the ancestor-hidden case is red for effective visibility, the
registered-oversize case is red for `decoration-geometry`, and the tiny-box
registered-shadow case is red for `decoration-paint-extent`. The census does
not exempt arbitrary descendants of a registered role: role roots require an
exact `data-contract-surface` registration, while descendants require an
owner-scoped `data-contract-decorative` value from the narrow allowlist. The
browser census uses computed geometry/paint and mounted hidden-node inspection;
it does not rely on generic class names or the presence of
`data-opaque-surface` alone. Decorative registration is not a geometry waiver:
each allowlisted decoration is checked against a stage-relative width, height,
area, position, and opaque-paint envelope. The large `scene-orbit` outline is
allowed through its distinct low-paint envelope; a fixed/full-stage opaque
`scene-star` fails the geometry gate even though it has a structurally valid
owner registration. Registered decorations fail closed on uncontrolled
`box-shadow`, `text-shadow`, `filter`/drop-shadow, `backdrop-filter`,
`outline`/`outline-offset`, and painted `::before`/`::after` content; these
effects are not accepted merely because the element's client rect is small.
The valid stars use only in-box background paint, while the large `scene-orbit`
border remains within its distinct outline envelope. The overlap case also proves exact union is
smaller than naive summation:

- naive subject-overlay area: `40961.84814453125`
- exact union subject-overlay area: `34741.34814453125`

| Contract | Valid result | Threshold / expectation |
|---|---:|---:|
| stage coverage | `1.0000` | `>= 0.85` |
| union-derived unoccluded stage | `0.8969696120` | `>= 0.70` |
| combined subject safe area | PASS | every subject inside x `16–84%`, y `14–78%` |
| subject/opaque union intersection | `0` | `<= 0.05` |
| mounted + visible primary cue | `1 / 1` | exactly one |
| subtitle bars / visible / actual line boxes / font size | `1 / true / 2 / 18px` | one visible bar, `<=2` lines, `>=16px` |
| effective ancestor visibility | `stage / subject / cue / subtitle = true` | ancestor display/visibility/opacity must remain effective |
| inactive candidate/TTT/trace/commit/receipt DOM nodes | `0` | zero; hidden mounted nodes fail |
| contract role census | `6 / 0 / 0` | six required roles, missing `0`, duplicate `0` |
| invalid surface/decorative registrations | `0 / 0` | exact root/owner-scoped registrations only |
| invalid allowed-decoration geometry | `0` | stage-relative envelope; oversized opaque registered decoration fails |
| invalid allowed-decoration paint extent | `0` | fail closed on uncontrolled shadow/filter/outline/pseudo paint |
| unregistered painted surfaces / hidden mounted nodes | `0 / 0` | both zero; unmarked adversarial nodes fail |
| forbidden persistent chrome | `0` | zero nav/sidebar/top-bar/timeline/rail matches |
| required telemetry fields | `9 / 9` | all non-empty |
| overflow | horizontal `false`, vertical `false` | no overflow |
| keyboard focus | PASS | Tab reaches beat control |
| reduced motion | PASS | media active; max duration `0.01ms` |
| readable subtitle/control | PASS | font `>=16px`, contrast `>=4.5:1` |
| responsive 320×720 | PASS | no overflow; stage/subject/cue/control in viewport; visible subtitle `2` lines, `16px`, contrast `18.73:1` |
| non-color encoding | PASS | explicit `shape+label` / `line+label` |

Bad-overlap summary: stage and unoccluded thresholds remain above their numeric
thresholds, but `subject-overlay` is `0.7877856722`, two unregistered red
surfaces are painted, and five inactive cues are mounted (`candidate`, `ttt`,
`trace`, `commit`, `receipt`), so the deliberate negative fixture fails as
required. The `bad-unmarked` case independently reports four painted surfaces
(two top-level and two nested below `scene-context`) and two hidden mounted
cues without contract markers; it fails as required. The
`bad-ancestor-hidden` case sets the stage opacity to zero and reports effective
visibility false for stage, subject, cue, and subtitle, with all mounted
descendants visible to the hidden-node census; it fails as required. The
`bad-allowed-decoration-oversize` case keeps the `scene-star` owner/decoration
registration valid but expands it to the full stage with opaque paint; only
the `decoration-geometry` finding is expected to fail, proving registration
cannot bypass the envelope.
The `bad-allowed-decoration-shadow` case keeps a tiny, structurally allowed
`scene-star` box but gives it a huge `box-shadow`; only
`decoration-paint-extent` is expected to fail, proving client-rect geometry
alone cannot certify painted output.

## Route smoke boundary

The isolated browser smoke reached `/simulator` with one Canvas, zero console
errors, and zero page errors. After the route settled, the corrected view-aware
runtime published `scenePlanAvailability: available` with
`globalFrameId: null` and `localFrameId: analysis-b44260c9` for that run. The
route still rendered the old product compositor: left control stack
`318×1064`, center column `1224×1064`, right result dock `342×1064`, and bottom
timeline `1224×88`, all mounted at the same time. This is explicitly
`PRODUCT_REJECTED_QUARANTINED`; the screenshot is evidence for the next
compositor work and is not WI-02 product acceptance.

## Artifact hashes

| Artifact | SHA-256 |
|---|---|
| `output/playwright/visual-contract/valid.png` | `bb58b2a18c7ad3d7af21c13379ddc9ff24bc1993f3b7ab287885644deb4d3418` |
| `output/playwright/visual-contract/bad-overlap.png` | `bd7fa727bf76d0d061e49d800d0a9ffbda2f5784874a2d70b03ec73e3dc24453` |
| `output/playwright/visual-contract/bad-unmarked.png` | `6ccec3cf57294d72ebc8d83c69287fe2555c5482657483ba661d45cc43c9d322` |
| `output/playwright/visual-contract/bad-ancestor-hidden.png` | `6a3ac4c73b570e6556d3f54db91083e1fb4b6a888b0b43bebbcfbda988d735ef` |
| `output/playwright/visual-contract/bad-allowed-decoration-oversize.png` | `70a66d517a1078b8cd208c3f573f203bf2e31f89badae237c8d3af2d8ff88841` |
| `output/playwright/visual-contract/bad-allowed-decoration-shadow.png` | `67e3f30c3f5adda2861d0fac7a7f765d797c1ff6f7f4757ce38f0f8902f008cc` |
| `output/playwright/visual-contract/contact-sheet.png` | `d2de0a41560ad55d4e8b77fa6b7231d6622a2729512a1359c42799b765111726` |
| `output/playwright/visual-contract/current-simulator-quarantine.png` | `3d4ac80910a51ce698a3829035757beabc938d01288c13e57c2b7de1a8b369fa` |
| `output/playwright/visual-contract/machine-report.json` | `a47cdf35219bcefe6e7e57620afc27c4355dfdde9511ad3cc6c81cb95ced9307` |
| `output/playwright/visual-contract/architecture-report.json` | `664588d2a4101c3066b2e06a98fee2b7b25ba73565f43b3177f5e5a527168764` |

The machine report contains the full valid/bad snapshots, findings, geometry,
thresholds, viewport, and DPR. The architecture report is explicitly static
evidence and does not assert pixels.

## Commands and results

```text
node --import tsx/esm src/visualAcceptance/rectangleUnion.test.ts       PASS
node --import tsx/esm src/visualLab/session/scenePlanCompiler.test.ts   PASS
node --import tsx/esm src/visualLab/session/visualLabSession.test.ts    PASS
npx tsc --noEmit                                                        PASS
node --import tsx/esm scripts/validate-visual-contract-browser.ts       PASS
node --import tsx/esm scripts/validate-visual-contract-architecture.ts  PASS
```

The browser command's result was `valid: true`,
`badExpectedFailuresObserved: true`,
`badUnmarkedExpectedFailuresObserved: true`,
`badAncestorHiddenExpectedFailuresObserved: true`,
`badAllowedDecorationOversizeExpectedFailuresObserved: true`,
`badAllowedDecorationShadowExpectedFailuresObserved: true`, and the route
smoke reached one Canvas with zero console/page errors. The architecture
command reported fifteen passing static checks.

## Architecture and quarantine map

Verified static boundaries:

- session public surface remains `snapshot`, `subscribe`, `dispatch`;
- `compileScenePlan` is called internally and not re-exported by the session
  index;
- Unified passes `lab.scenePlan`;
- `ScenePlanRenderer` is private and guarded by a `never` exhaustiveness helper;
- `VisualLabScene.tsx` contains exactly one `<Canvas>`;
- banned legacy names/imports and manual-hide/chrome-rail markers are absent in
  the inspected Unified/scene/session/compiler/fixture sources;
- no public `Layer`/`Plugin` framework was introduced;
- allowlisted decorations remain subject to explicit stage-relative geometry
  envelopes; the oversize registered `scene-star` negative fixture is covered
  by the browser gate;
- registered decorations fail closed on uncontrolled shadow/filter/outline and
  painted pseudo-element effects, with the tiny-box giant-shadow negative
  fixture covered by the browser gate.

Quarantined rather than silently adopted:

- the existing Unified Visual Lab's generic timeline/sidebar/result surfaces
  remain outside this standalone fixture and are not certified by this report;
- existing Golden/Global artifacts remain candidate evidence only;
- all course routes, old shell migration, scientific lesson claims, and platform
  integration remain locked behind their backlog gates.

## Evidence boundaries

**VERIFIED:** exact rectangle clipping/union tests; immutable ScenePlan compiler
tests; existing session facade test; TypeScript check; valid browser fixture
thresholds; deliberate overlap, nested-unmarked, ancestor-hidden,
registered-oversize-decoration, and registered-shadow red findings; explicit
surface/decorative registration boundary; effective ancestor visibility;
stage-relative decoration geometry envelopes; fail-closed decoration paint
extent checks for shadow/filter/outline/pseudo effects;
keyboard/reduced-motion/responsive/contrast checks; generated
screenshots/contact sheet/reports; static architecture checks.

**PROBABLE:** the fixture composition is a useful machine-testable scene-first
contract and its captured pixels are suitable for controller inspection. This
is not a judgment that it is already the desired final teaching animation.

**UNVERIFIED:** owner pixel acceptance; the 60–90 second Golden Flow; Global
Constellation/TLE/off-axis/handover/EE lessons; official route first load; live
data/platform behavior; slide/recording package; full-course acceptance.

`CANDIDATE_EVIDENCE` only. Stop at `WAITING_FOR_REVIEW_WI-02`.
