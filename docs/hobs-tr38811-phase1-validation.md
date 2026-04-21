# HOBS + TR 38.811 Phase 1 Validation

## Scope

This note records the first local validation pass after landing the
`hobs-2024-tr38811-research` profile and the Phase 1 research-grade signal path.

Validated surfaces:

- deterministic `TR 38.811 Eq. (6.6-3)` slant-range closure
- deterministic seeded LOS bucket behavior
- deterministic research-profile link-budget snapshots for a fixed time bucket
- runtime profile selection in the app UI
- additive profile / formula-family disclosure in the info panel
- unchanged default startup path for `hobs-2024-candidate-rich`

## Commands

Run from `project/leo-beam-sim/`:

```bash
npm run validate:hobs-tr38811-phase1
npm run lint
npm run build
```

## Harness Result

`npm run validate:hobs-tr38811-phase1` passed.

Recorded checks:

- `d(alpha)` fixed checks at `5°`, `30°`, and `90°`
- independent equation cross-check against the runtime implementation
- LOS probability nearest-angle lookup for suburban mode
- deterministic LOS seed behavior for `satId|beamId|floor(simTimeSec)`
- deterministic research-profile link-budget snapshot equality for repeated
  evaluation in the same 1-second bucket

Observed research snapshot at `simTimeSec = 60.2`:

```json
[
  { "satId": "sat-a", "beamId": 1, "rsrpDbm": -93.631007, "sinrDb": -2.578975 },
  { "satId": "sat-a", "beamId": 5, "rsrpDbm": -98.902984, "sinrDb": -9.275425 },
  { "satId": "sat-b", "beamId": 1, "rsrpDbm": -95.896588, "sinrDb": -5.723989 },
  { "satId": "sat-z", "beamId": 1, "rsrpDbm": -121.061924, "sinrDb": -31.916598 }
]
```

## Browser Validation

Local app validation used:

- dev server: `npm run dev -- --host 127.0.0.1 --port 4173`
- browser URL: `http://127.0.0.1:4173/`

Observed startup state:

- default profile remained `HOBS Candidate-Rich Demo`
- info panel showed `HOBS Legacy`
- beam hopping remained `ON`

Observed after switching profile selector to `HOBS + TR 38.811 Research`:

- selector updated correctly
- info panel showed `HOBS + TR 38.811`
- profile id showed `hobs-2024-tr38811-research`
- beam hopping switched to `OFF`
- UI remained responsive and the panel continued to update from engine truth

## Non-Blocking Console Notes

Observed during browser validation:

- `404` for `favicon.ico`
- `THREE.GLTFLoader` warning for unknown extension
  `KHR_materials_pbrSpecularGlossiness`
- WebGL `ReadPixels` stall warnings under headless browser execution

These were pre-existing or environment-level signals and were not treated as
Phase 1 blockers for the HOBS + TR 38.811 upgrade path.

## Outcome

Phase 1 now has local evidence for:

- runtime reachability of the research profile
- deterministic slant-range and LOS bucket behavior
- deterministic research link-budget snapshots
- stable front-end disclosure of the active signal formula family

Performance evidence is recorded separately in:

- `docs/hobs-tr38811-phase1-benchmark.md`
