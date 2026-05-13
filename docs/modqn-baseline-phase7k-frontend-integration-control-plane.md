# MODQN Baseline Phase 7K Frontend Integration Control Plane

**Date:** 2026-05-13
**Status:** `FRONTEND_CONTROL_PLANE_CHECKPOINT`
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** control-plane checkpoint for the Phase 7 frontend integration target

Phase 7K records the current frontend control-plane target for the baseline
MODQN replay demo. This checkpoint does not authorize edits to replay
artifacts, producer artifacts, vendored `src/core/**`, HOBS/SINR runtime math,
handover logic, MODQN action truth, rewards, geometry truth, diagnostics, or
provenance.

## Target State

The Phase 7K frontend target is:

1. Baseline MODQN replay is integrated into the frontend for the selected
   regenerated and re-promoted `7`-beam producer artifact.
2. Right-side MODQN replay controls own replay playback affordances such as
   source-slot playback, scrub / play / pause / reset state, replay evidence
   labels, and replay-derived cue text.
3. Left-side live handover controls own HOBS/SINR live-runtime handover and
   tuning affordances. These controls affect live simulator behavior only and
   do not modify MODQN replay artifact truth.
4. Agent A scene-integrated visual proof should show replay-derived previous
   beam, selected beam, and intra-satellite beam-switch state inside the
   3D/canvas scene. DOM overlay labels may support this proof, but they are not
   the primary proof surface. The cue remains display-only unless a later
   validated producer-to-scene identity contract promotes stronger meaning.

This checkpoint documents the target control-plane split. It does not replace
the older Phase 7G / 7H history, which recorded scene-adjacent cues and
showcase hardening at that time.

## Control Ownership

| Surface | Owner | Allowed effect |
| --- | --- | --- |
| Right-side MODQN replay controls | Replay playback display model | Change displayed source slot, replay summary, cue labels, and fail-closed replay UI state. |
| Left-side live handover controls | HOBS/SINR live runtime | Change live handover / tuning parameters under their existing runtime reset and stale-evidence rules. |
| Scene-integrated replay proof | Display layer fed by replay-derived cue state | Show that the frontend can present the selected replay focus in the scene without creating new replay truth. |
| Diagnostics / docs | Provenance and claim-boundary guardrails | Preserve source, evidence, and forbidden-claim boundaries without making them primary demo controls. |

The right-side replay control plane and left-side live control plane must remain
separate. A replay scrub must not change HOBS/SINR live handover state. A live
handover control change must not mutate the replay artifact, replay source row,
producer action, reward, event kind, or evidence status.

## Scene Cue Boundary

The Agent A scene-integrated visual proof is display-only for Phase 7K. It may
make the selected replay focus visible in the scene, but it does not establish
any of these facts:

1. producer satellite IDs mapped to live HOBS/SINR satellite IDs;
2. producer beam IDs mapped to live Three.js beam geometry as research truth;
3. replay selected serving state as the live HOBS/SINR serving state;
4. replay event kind as a live handover-manager event;
5. recomputed replay SINR, reward, MODQN action, policy diagnostics, geometry
   truth, or provenance.

If the scene cue is visually colocated with live scene content, that placement
is a frontend display proof only. It must be labeled and validated as replay
display state, not as live HOBS/SINR truth.

## Claim Boundary

Allowed claims:

1. The selected regenerated and re-promoted `7`-beam producer bundle can drive
   baseline MODQN replay display in the frontend after the Phase 7 validation
   chain passes.
2. The frontend can separate right-side replay playback controls from
   left-side HOBS/SINR live handover controls.
3. Scene-integrated replay cues can provide display proof of the frontend
   integration target when labeled as display-only.
4. The selected artifact contains `85` `intra-satellite-beam-switch` rows,
   `915` `none` rows, and `0` `inter-satellite-handover` rows.

Forbidden claims:

1. No `19` or `37` trained-baseline MODQN evidence claim; `19` and `37` remain
   sensitivity/demo only.
2. No claim that HOBS/SINR live output is MODQN replay evidence.
3. No EE, HEA, Catfish, Multi-Catfish, or Catfish-over-HEA scope.
4. No observed inter-satellite handover claim for the selected artifact.
5. No claim that the scene cue maps producer satellite IDs to live HOBS/SINR
   truth or turns display placement into replay geometry evidence.
6. No claim that Leo recomputes producer MODQN action, reward, handover, SINR,
   geometry, diagnostics, or provenance for replay evidence.

## Validation Direction

Phase 7K should reuse the existing Phase 7 validation chain. If a
scene-integrated cue creates a new testable surface, add focused visual-proof
validation for that surface without changing replay artifact truth.

Minimum validation direction:

1. `npm run lint`
2. `git diff --check`
3. `npm run validate:modqn:phase7c-replay-state-model`
4. `npm run validate:modqn:phase7d-replay-diagnostics`
5. `npm run validate:modqn:phase7e-ui-mode-labeling`
6. `npm run validate:modqn:phase7f-replay-playback-shell`
7. `npm run validate:modqn:phase7g-replay-scene-cues`
8. `npm run validate:modqn:phase7h-showcase-hardening`
9. `npm run validate:modqn:phase7k-replay-scene-layer`

For the scene-integrated proof, the focused validator should prove that the
canvas-level cue is an R3F world-layer display surface fed by replay display
state; that it visibly separates previous and selected beams for the default
`intra-satellite-beam-switch` focus row; and that it preserves replay/live
separation, no unsupported visible claims, and no mutation of live HOBS/SINR
state from replay playback.

## Staging Guidance

Stage this checkpoint only with the matching Phase 7K frontend integration
implementation and focused validators. Do not stage producer artifacts,
replay-truth data, or unrelated dirty files with it.
