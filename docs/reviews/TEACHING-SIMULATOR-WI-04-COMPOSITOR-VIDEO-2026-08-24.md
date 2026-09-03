# WI-04 compositor/video controller review

Status: **CONTROLLER_VISUAL_REVIEW_PASS / WAITING_FOR_OWNER_VISUAL_ACCEPTANCE**  
Date: 2026-08-24  
Prerequisite token: `PASS_WI-03`  
Controller decision: controller visual review passed for the bounded WI-04 candidate; owner visual acceptance is still pending.  
Next work-item stop: `WAITING_FOR_OWNER_VISUAL_ACCEPTANCE_WI-04`

This record covers the scene-first 60–90 second Golden Flow compositor/video
candidate only. It does not accept the formal course route, the WI-09
source-backed scientific inter-handover lesson, SINR/EE claims, platform
registration/persistence, or any downstream work. No commit or push was made;
WI-05 remains `WIP_FROZEN`.

## Review provenance and decision

The first fresh Claude Opus max review session
`8f9484f1-e6ec-4ebc-ad46-04dbe34f0c05` reviewed the r1 candidate and returned
`REVISE`, identifying two blockers and three major findings. The compositor,
viewport assertions, recorder, and evidence path were then revised.

A second, independent fresh Claude Opus max session
`191dd9bb-cbbc-4f3a-9095-d295f15e4511` reviewed the r2 candidate and returned
`PASS_WI04_VISUAL_CANDIDATE`. Its frame-by-frame review marked all five findings
FIXED. The controller then inspected the complete r2 contact sheet, key
full-resolution PNG frames (`beat-02-angles`, `beat-04-consequence`,
`beat-11-receipt`, and `beat-12-new-normal`), key/timing video frames around
the new-normal transition, and browser-gate results. The complete
frame-by-frame timeline analysis belongs to the second fresh Opus session.
This is controller visual review evidence, not owner acceptance.

## Finding closure

| Finding | Closure evidence | Result |
|---|---|---|
| A — post-handover labels | Receipt/new-normal show `ONEWEB-0325 · 前服務` and `ONEWEB-0618 · 服務`; browser role assertion checks both labels. | FIXED |
| B — native new-normal timing | Native browser capture holds new-normal before controls; controls are rendered by the browser and retained to the video tail. No static-frame append. | FIXED |
| C — white first frame | Head trim is applied before final encode; frame-0 signalstats report `YAVG=22.1901`, with `YMIN=10`, `YMAX=238`. | FIXED |
| D — edge cue/control clipping | Consequence card is inset from the right edge; finale controls retain an accent-bar gap; browser viewport containment assertions cover desktop/mobile cue/control surfaces. | FIXED |
| E — angle-label legibility | α/θ labels are moved outside the beam/axis raster with short connectors, local dark knockout, and contrast shadow; both vertices remain explicit. | FIXED |

## Commands and results

| Command/evidence | Result |
|---|---|
| `npm run test:golden-flow` | PASS — director contract, 12 beats, 84-second nominal flow, one guided action. |
| `npx tsc --noEmit` | PASS. |
| `node --import tsx/esm scripts/validate-golden-flow-browser.ts http://127.0.0.1:4318` | PASS — main browser gate. |
| `node --import tsx/esm scripts/validate-golden-flow-course-segments-browser.ts http://127.0.0.1:4318` | First run hit a browser-context crash attributed to environment/memory pressure; isolated retry PASS for Act 3/4 segments. |
| `node --import tsx/esm scripts/record-golden-flow-video.ts http://127.0.0.1:4318 -wi04-r2` | PASS — one native browser capture, 12 beat frames, no static-frame append. |
| `ffprobe` on the final WebM | PASS — `90.000s`, `1920×1080`, `25fps`. |
| `ffprobe` lavfi `signalstats` on frame 0 | PASS — `YMIN=10`, `YAVG=22.1901`, `YMAX=238`; first frame is not a white flash. |

The final-video frame audit measured new-normal at frame 1988 (`79.52s`) and
controls first visible at frame 2147 (`85.88s`). The measured native gap is
`6.36s` (`159 / 25`), satisfying the six-second hold; controls remain visible
through the end of the WebM. The manifest's transformed timing is intentionally
conservative: it records final new-normal at approximately `79.376s`, controls
at approximately `85.804s`, and a `6.428s` gap after head trim and pre-segment
speed adjustment.

## r2 artifacts and hashes

All paths below are repository-relative and were retained alongside the prior
WI-04 artifacts.

| Artifact | SHA-256 |
|---|---|
| `output/playwright/golden-flow/golden-flow-1920-wi04-r2.webm` | `9b18db213ed27d50cc71f69ec66836092ad9b8029738f783d171b9b631fef95a` |
| `output/playwright/golden-flow/golden-flow-1920-wi04-r2.manifest.json` | `87b5899f276557f78726dbefd9e3b0a6b267ade4254da0622518bb78b81cc59c` |
| `output/playwright/golden-flow/golden-flow-wi04-r2-contact-sheet.png` | `4fba9c11146989e0572efa9f01507bef59cc1b5946886c7ac6bcf049677b2338` |
| `output/playwright/golden-flow/beat-01-establish-wi04-r2.png` | `18c8a177d52f0d4cee2b9780e5174a88f1538e6f54d3e2804a198c4f9aa7c7c4` |
| `output/playwright/golden-flow/beat-02-angles-wi04-r2.png` | `89b8109890f57eace99ece6c6cb81c6350c90637b0815b492e86b9b7d58efc19` |
| `output/playwright/golden-flow/beat-03-interaction-wi04-r2.png` | `d770245046cd5b626f1d509244c5ed5e9154ae042d6607d5ebb88e6f7c68cc85` |
| `output/playwright/golden-flow/beat-04-consequence-wi04-r2.png` | `02162428ddbcef68a67ab458a97cfa5fd068b028230fb8675a5b0dae17a08983` |
| `output/playwright/golden-flow/beat-05-restore-wi04-r2.png` | `7804bf839e1ac7c9b6b46fe56f1dc977cab01159e050b27f5d4d9730aad0fda5` |
| `output/playwright/golden-flow/beat-06-candidate-wi04-r2.png` | `008806d29c851d720e1353a16fd54e77b7be56d3ec28b2e380d21abbf1000eed` |
| `output/playwright/golden-flow/beat-07-qualification-wi04-r2.png` | `78f6f5a71ceee96d67d6f41ad6800b6296d4db77fe4fbf4f976a8f8c9ea0e3de` |
| `output/playwright/golden-flow/beat-08-ttt-wi04-r2.png` | `53a5b7068d421ca71c666902100ae1978128e4d2c5b197a011f75735921c3730` |
| `output/playwright/golden-flow/beat-09-trace-wi04-r2.png` | `1cf864bf08deaf392aa0fde2730a2ef76132bc7c61f7e052e1458b688ca5e2fd` |
| `output/playwright/golden-flow/beat-10-commit-wi04-r2.png` | `f0e9ab38752bd4962ce833d8ca5c9b1e168be5ba9a8a28503928c209441dc27e` |
| `output/playwright/golden-flow/beat-11-receipt-wi04-r2.png` | `b32cf19f62ac5da4dc53bbbc240110fa4535dec0da425866218eae288b5d395d` |
| `output/playwright/golden-flow/beat-12-new-normal-wi04-r2.png` | `3fe7977adae110463acda9a98450548b3ffca1f2ebbfe25505f6fae9094287d2` |

The manifest records the route `/prototype/visual-first-golden-flow`, viewport
`1920×1080` at DPR 1, native and transformed timing, `staticFrameAppend=false`,
and the exact browser/ffprobe commands. The video is 90.000 seconds, within the
60–90 second pilot bound.

## Minor observations

- The opening has an approximately 0.8-second stage hard-pop.
- The ending has an approximately 0.92-second near-static hold.
- Manifest timing is conservative relative to the frame audit, as recorded
  above.
- Receipt text sits approximately 1px from the right accent rule.

## Known gaps and governance boundary

- The central safe-area check is a DOM rectangle proxy, not semantic pixel
  segmentation.
- This candidate does not accept WI-09 source-backed science, canonical
  SINR/EE, energy/policy claims, platform registration/persistence, or the
  formal course route.
- Owner visual acceptance has not happened. The exact next stop is
  `WAITING_FOR_OWNER_VISUAL_ACCEPTANCE_WI-04`; no downstream item is unlocked.
- No commit or push was performed.
