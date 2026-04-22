# HOBS + TR 38.811 Phase 2 DPC Validation

## Scope

This note records the first validation pass for the promoted Phase 2 slice:

- beam-level transmit-power override plumbing
- simplified deterministic DPC for the `hobs-2024-tr38811-research` profile

This slice does **not** widen scope into:

- DAPS / dual-connectivity
- Doppler ICI
- per-satellite `Pmax` normalization
- energy-model coupling
- frontend contract changes

## Explicit Deviations

The local Phase 2 slice intentionally differs from full HOBS-P in these ways:

- the simulator remains single-UE observer-centered, so per-beam EE uses the
  proxy `log2(1 + γ) / P`
- DPC is applied in deterministic 1-second buckets using the previous bucket's
  link samples
- beam power is clamped to `44 dBm` to `50 dBm` for this bounded first slice
- the paper's satellite-level normalization step is still deferred

These deviations are deliberate and documented in
`docs/hobs-tr38811-sinr-mini-sdd.md`.

## Command

Run from `project/leo-beam-sim/`:

```bash
npm run validate:hobs-tr38811-phase2:dpc
```

## Harness Result

`npm run validate:hobs-tr38811-phase2:dpc` passed.

Recorded checks:

- research profile exposes a `beamPowerControl` block
- legacy profile remains `hobs-legacy` without beam-power control
- repeated runs produce identical overrides and identical serialized snapshots
- after two DPC buckets, the strongest fixture beam backs off while weaker beams
  remain at full power
- beam-level override changes both own-link RSRP and peer-beam SINR

Observed overrides after two buckets:

```json
{
  "sat-a:1": 49.5,
  "sat-a:5": 50,
  "sat-b:1": 50,
  "sat-z:1": 50
}
```

Observed research snapshot before DPC:

```json
[
  { "satId": "sat-a", "beamId": 1, "rsrpDbm": -93.631007, "sinrDb": -2.578975 },
  { "satId": "sat-a", "beamId": 5, "rsrpDbm": -98.902984, "sinrDb": -9.275425 },
  { "satId": "sat-b", "beamId": 1, "rsrpDbm": -95.896588, "sinrDb": -5.723989 },
  { "satId": "sat-z", "beamId": 1, "rsrpDbm": -121.061924, "sinrDb": -31.916598 }
]
```

Observed research snapshot after the DPC override:

```json
[
  { "satId": "sat-a", "beamId": 1, "rsrpDbm": -94.131007, "sinrDb": -3.078975 },
  { "satId": "sat-a", "beamId": 5, "rsrpDbm": -98.902984, "sinrDb": -9.083367 },
  { "satId": "sat-b", "beamId": 1, "rsrpDbm": -95.896588, "sinrDb": -5.505594 },
  { "satId": "sat-z", "beamId": 1, "rsrpDbm": -121.061924, "sinrDb": -31.745128 }
]
```

## Interpretation

This validation confirms the intended minimum contract for the slice:

- `P_{n,m}(t)` is no longer implicitly uniform in the research path
- DPC remains profile-scoped and deterministic
- the frontend data contract stays unchanged because the override is consumed
  inside the engine/simulation path

The result is a bounded, explainable Phase 2 foundation for later power/energy
work without rewriting Phase 1 surfaces.

## Browser QA

Browser QA was run against a live local dev server after the DPC slice landed.

Command used for this run:

```bash
npx tsx scripts/validate-hobs-tr38811-phase2-browser.ts http://127.0.0.1:4174/
```

Observed browser states:

- initial candidate-rich load showed:
  - selected profile: `hobs-2024-candidate-rich`
  - formula family: `HOBS Legacy`
  - beam hopping: `ON`
- after switching to the research profile:
  - selected profile: `hobs-2024-tr38811-research`
  - formula family: `HOBS + TR 38.811`
  - beam hopping: `OFF`
- after switching back to candidate-rich and then into research again:
  - profile labels and beam-hopping state returned to the same expected values
  - no visible profile-switch regression remained after the DPC-state reset fix

Observed non-blocking console/runtime notes:

- `favicon.ico` 404
- `THREE.GLTFLoader` unknown-extension warning
- headless WebGL `ReadPixels` stall warnings

These matched the earlier Phase 1 browser-validation notes and did not indicate
a new Phase 2 regression.
