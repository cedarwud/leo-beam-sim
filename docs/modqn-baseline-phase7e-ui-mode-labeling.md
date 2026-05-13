# MODQN Baseline Phase 7E UI Mode Labeling

**Date:** 2026-05-12
**Status:** `UI_MODE_LABELING_IMPLEMENTED`
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** visible UI labels, replay/live display separation, focused browser smoke

Phase 7E adds a compact UI labeling layer only. It does not implement replay
playback, timeline controls, mode switching, artifact edits, copied artifact
changes, vendored `src/core` changes, HOBS/SINR formula changes, handover
manager changes, or Phase 6 source-channel adoption behavior.

## Visible Labels

The label strip now shows three separated groups:

| Group | Visible wording |
| --- | --- |
| MODQN replay evidence | `MODQN replay - 7-beam producer artifact`, `accepted-7beam-baseline`, `newly regenerated / re-promoted`, `not recovered frozen artifact`, `not full paper-faithful reproduction` |
| HOBS/SINR live | `HOBS/SINR live`, plus a boundary note that HOBS/SINR controls do not modify MODQN replay artifact truth |
| Sensitivity/demo boundary | `Sensitivity/demo`, `7 = baseline MODQN evidence path`, `19/37 = sensitivity/demo only` |

The strip is non-interactive and sits between the control bar and scene row.
The existing control bar, signal tuning drawer, signal status panel, and
diagnostics drawer remain live-simulator controls/readouts. They are not
presented as replay truth controls.

## Claim Boundary

Allowed claims:

1. The selected `7`-beam producer bundle remains the only baseline MODQN
   evidence shape currently surfaced by the UI labels.
2. The selected artifact is newly regenerated and re-promoted.
3. HOBS/SINR live output remains a live simulator surface.
4. `19` and `37` remain sensitivity/demo only.

Forbidden claims:

1. No recovered frozen artifact claim.
2. No full paper-faithful reproduction claim.
3. No `19` or `37` trained-baseline MODQN evidence claim.
4. No HOBS/SINR live output as MODQN replay evidence.
5. No EE, HEA, Catfish, Multi-Catfish, Catfish-over-HEA, or
   Catfish-over-HEA-on-HEA scope claim.

## Implementation

Changed UI surface:

1. `src/ui/ModeEvidenceStrip.tsx` adds the read-only label layer.
2. `src/App.tsx` places the label layer between the top control bar and the
   scene row, separate from live controls.
3. `src/styles/main.scss` keeps the label layer compact and responsive across
   desktop and narrow viewports.

Focused browser validation:

```bash
npm run validate:modqn:phase7e-ui-mode-labeling
```

The browser smoke starts or reuses a local dev server, checks desktop
`1440x900` and narrow `390x844` viewports, confirms the labels are visible,
confirms the label strip stays compact, confirms it does not overlap the
control bar, scene canvas, or side panels, and scans visible text for
unsupported claim wording.

## Validation Results

Validation results are recorded after the Phase 7E implementation run:

| Check | Result |
| --- | --- |
| Pre-change `npm run validate:modqn:phase2-identity-adapter` | Passed before Phase 7E edits. |
| Pre-change `npm run validate:modqn:phase4b-beam-layout-bridge` | Passed before Phase 7E edits. |
| Pre-change `npm run validate:modqn:phase7c-replay-state-model` | Passed before Phase 7E edits. |
| Pre-change `npm run validate:modqn:phase7d-replay-diagnostics` | Passed before Phase 7E edits. |
| `npm run validate:modqn:phase2-identity-adapter` | Passed after Phase 7E edits. |
| `npm run validate:modqn:phase4b-beam-layout-bridge` | Passed after Phase 7E edits. |
| `npm run validate:modqn:phase7c-replay-state-model` | Passed after Phase 7E edits. |
| `npm run validate:modqn:phase7d-replay-diagnostics` | Passed after Phase 7E edits. |
| `npm run validate:modqn:phase7e-ui-mode-labeling` | Passed. Confirmed desktop `1440x900` and narrow `390x844` label visibility, no overlap with control bar, scene canvas, or side panels, and zero unsupported visible claim hits. |
| `npm run lint` | Passed. |
| `git diff --check` | Passed with no output. |
| Unsupported `19` / `37` trained-baseline claim scan | Passed by inspection. Hits are negative boundary, stop-rule, or validation-scope statements only. |
| HOBS/SINR-as-MODQN-replay-evidence claim scan | Passed by inspection. Hits are negative boundary or separation statements only. |
| Read-only review pass | Reviewer found a browser-smoke claim-scan masking weakness; the scanner was tightened to inspect raw visible-text chunks. Reviewer reported the UI wording itself kept replay/live boundaries intact. |

## Deviations And Blockers

Deviations:

1. None from the requested Phase 7E scope at implementation time.

Blockers:

1. None at implementation time.
