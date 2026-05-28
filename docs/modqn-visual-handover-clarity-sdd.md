# MODQN Visual Handover Clarity Mini-SDD

**Date:** 2026-05-27
**Status:** Superseded for MODQN training-truth visualization by
`docs/modqn-training-truth-visualization-sdd.md`. The replay cue portions may
remain useful for T0 row-level display, but this document must not be used as
authority for reconstructing the producer training environment.
**Owner boundary:** `modqn-paper-reproduction` owns producer truth; `leo-beam-sim` owns display only.

## 1. Decision

MODQN Objective and Training are now one frontend workflow. The objective
weights are training-request inputs in `TrainingForm`, not a separate default
runtime control that claims to rewrite handover outcomes after the fact.
The legacy objective component may remain as a compatibility surface, but the
MODQN sidebar defaults to Training and does not expose a separate Objective tab.

## 2. Beam / Handover Visualization

The accepted 7-beam replay artifact contains:

- `82` intra-satellite beam-switch rows
- `918` no-event rows
- `0` inter-satellite handover rows

Therefore the default paper-faithful replay may visualize intra-satellite beam
switches and selected-beam activation, but it must not claim an observed
inter-satellite handover. The visual layer can render inter-satellite handover
when a user-trained or future producer artifact supplies that event kind.

The MODQN replay scene layer is display-only:

- it reads `ModqnReplayPlaybackDisplayState.currentSlot.focusRow`
- it shows a canonical 7-beam board with selected/previous beam roles
- it advances the slot cursor from a display-only replay clock, not from
  training or simulation truth
- it holds handover slots longer than stable slots so switching is readable
- it pulses the active selected beam to make slot-to-slot selection legible
- it draws an arc for intra-satellite beam switches
- it draws a separated purple arc for inter-satellite handover if producer
  truth contains that event
- it mirrors the current slot into the left-sidebar replay cue panel with
  previous beam, selected beam, event kind, source row, producer context
  satellite count, UE count, and provenance tags

It does not alter selected serving, reward, SINR/SNR, beam masks, or training
semantics.

### 2.1 Presentation Choice

The SINR screen's physical presentation is still the right baseline for live
SINR because the user is inspecting physical geometry, beam coverage, and UE
positions. MODQN replay has a different primary question: what did the policy
select at this decision row, and was the transition intra-satellite,
inter-satellite, or no handover?

For that reason the MODQN view uses two synchronized surfaces:

- world-space scene cues for spatial continuity with the SINR view
- a left-sidebar replay cue panel for the discrete handover decision

This prevents the handover evidence from depending on camera zoom without
covering the satellite / beam region in the scene. The sidebar panel is
intentionally derived from the same replay visual state as the 3D board, so it
remains a consumer visualization and does not invent producer truth.

The MODQN scene must not stack ordinary live SINR beam cones on top of replay
truth. Those cones imply physical live-SINR service geometry and can look like
the beam footprint is merely sliding with the moving satellite. MODQN replay
therefore uses the replay layer's ground-anchored canonical beam board for the
selected/previous action trace, while the normal SINR mode keeps the live cone,
frequency-ring, and callout presentation.

MODQN mode hides the ordinary live-SINR satellite marker set because that set
may contain only the currently elevated service satellite. Instead, the scene
renders four normal satellite models from the MODQN profile's moving orbit
propagation and maps them to producer-context IDs (`sat-0..sat-3`). The display
compresses the four models into a visible orbit-context lane so the 4-satellite
paper environment remains legible even when only one satellite is serviceable
at the current elevation. Link budget, serving decisions, rewards, and training
truth still use the producer/live-engine service filters.

**Supersession note:** The compressed orbit-context lane is no longer accepted
for the main MODQN training scene. It is a display shortcut, not a faithful
training-environment reconstruction. Future implementation must follow
`docs/modqn-training-truth-visualization-sdd.md`.

**Superseded:** The replay layer must not render translucent beam-cone cues
from producer-context satellite models to display-lens footprints. That was a
consumer display shortcut. The training-truth path now uses producer
`beamStates` / `satelliteStates` when available and otherwise fails closed.

For intra-satellite replay rows, the lens intentionally places the previous and
selected footprints near the same UE focus area with visible overlap. It does
not use the producer local beam index as a literal physical coordinate, because
the current replay bundle does not publish per-row beam-center coordinates.

## 3. Beam Hopping Boundary

The current MODQN paper-aligned artifact does not expose a producer-owned beam
hopping scheduler. A real beam hopping feature must come from producer or
validated engine state, because beam availability affects service, interference,
and training results.

For this pass, `leo-beam-sim` only renders replay slot activation and selected
beam changes. This is not a beam hopping truth claim.

## 4. Ground Grid

MODQN mode now keeps the earth-fixed hex grid visible as a spatial reference,
borrowing the SINR screen's visual scaffold. In MODQN mode the grid is not a
producer cell contract and labels are suppressed. It is only there to make beam
movement and UE area easier to read.

## 5. Beamwidth / UE Coverage Readout

Training now exposes a coverage estimate derived from the same environment axes
being submitted:

```text
beam_radius_km = altitude_km * tan(theta3dB_deg / 2)
beam_area_km2 = pi * beam_radius_km^2
expected_ues_per_beam = ue_count * beam_area_km2 / ue_area_km2
expected_ues_per_sat = expected_ues_per_beam * beams_per_satellite
```

For the Track-2 defaults (`altitude=780 km`, `theta3dB=2 deg`, `UE area=200 x
90 km`, `UE count=100`, `7 beams/sat`), this is approximately:

- beam 3 dB radius: `13.6 km`
- UE area: `18,000 km2`
- expected UEs per beam: `3.2`
- expected UEs per satellite across seven beams: `22.7`

This readout is a sanity check for training-impacting parameters, not a
replacement for producer validation.

## 6. Frequency Coloring

The MODQN paper-faithful profile currently has `frequencyReuse = 1`, and the
producer replay bundle does not provide a per-beam frequency assignment. The
viewer must not invent frequency colors. Beam colors in MODQN mode therefore
encode replay role only: inactive, previous, selected, or previous-and-selected.

If a future producer artifact or validated engine module exposes frequency /
reuse-group truth, that truth can be mapped to color as a separate visual layer.
