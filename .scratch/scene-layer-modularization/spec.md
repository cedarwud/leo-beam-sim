# Scene presentation-layer modularization acceptance spec

Pre-change HEAD: `61d68ccd0cf8bf2315c114bced2739b80981dcea`

## Outcome

The established campus scene remains the only homepage renderer. Its scientific
state is still produced by the accepted archived-TLE/canonical frame, while a
separate presentation plan can progressively reveal coherent visual layers.

## Required presentation stages

1. `ground`: campus and UEs, without satellite-owned footprints.
2. `constellation`: ground plus selected, candidate, and context satellites.
3. `service`: constellation plus the selected satellite's serving beams and
   footprints.
4. `comparison`: service plus the candidate comparison beams and footprints.
5. `full`: the existing complete scene, including ambient beams, event effects,
   annotations, trails, and lane-owned overlays.

## Invariants

- `full` is the default and preserves the current visible mount plan.
- Presentation stages only suppress or reveal renderer mounts. They do not
  change `SimulationAnalysisFrame`, `SimFrame`, `NormalizedSceneFrame`, TLE
  interpolation, satellite selection, beam ownership, handover state, SINR,
  Power, Throughput, or EE.
- Existing lane/source gates remain authoritative. A presentation layer can
  only narrow an existing gate; it cannot enable a layer forbidden by the lane.
- Camera, controls, lighting, and invisible provenance telemetry remain mounted
  at every stage.
- The optional presenter control is absent by default and appears only when
  `scenePresenter=1` is present. `sceneStage=<stage>` may select the initial
  stage without introducing a second route or renderer.
- The current `MainScene` archived-TLE adapter remains the homepage source. No
  disconnected alternate TLE renderer may be stacked beside it.

## Verification

- Pure stage-plan unit test checks exact monotonic layer membership and fallback
  to `full` for invalid input.
- Source-level test checks that the active renderer consumes the presentation
  plan only at JSX mount boundaries and retains the archived-TLE producer seam.
- TypeScript build and focused current scene/TLE tests pass.
- Browser check compares the default homepage with presenter mode and verifies
  that stage changes update layer telemetry while the canonical frame identity
  remains unchanged.

## Retired residue removed

- `HomepageTleSceneContent.tsx` was an unmounted second renderer. The active
  source contract explicitly forbids importing or mounting it.
- `homepageSevenCellDisplay.ts` and its self-contained test were used only by
  that retired renderer. The shared path keeps
  `archivedTleSevenCellPlacement.ts` as the one display mapping.
- `validate-homepage-tle-center.tsx` asserted telemetry and fallback behavior
  belonging to the retired renderer, so its package script was removed instead
  of adapting the product back to stale assumptions.
