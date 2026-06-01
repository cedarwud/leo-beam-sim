# SDD: MODQN Walker Pool and Serving-Satellite Authority

## Status

Accepted for the next cleanup and implementation slice.

## Date

2026-06-01

## Scope

This SDD fixes the source-of-truth model for the MODQN live/demo lane before
runtime changes resume. It is intentionally about authority and semantics, not
about replay-proof producer evidence.

This SDD supersedes the MODQN serving-count parts of:

- `docs/modqn-realistic-beam-geometry-cross-repo-sdd.md` sections that expose
  `L={4,8,12}` or keep `K=28` fixed across all `L`.
- `docs/modqn-realistic-beam-geometry-phase-ii-producer-brief.md` bullets that
  specify `K=28` with `L={4,8,12}`.
- Current UI copy that says `K=28 active beams` is held fixed while only the
  serving set size changes.

The old documents remain useful history, but this document is the authority for
the next implementation slice.

## Problem

The current repo mixes three different quantities:

1. the Walker constellation pool used to generate natural visibility;
2. the number of simultaneously visible satellites exposed to MODQN as a
   decision candidate set;
3. the number of beams/actions created from those serving satellites.

Previous cleanup work also treated `K=28` as a fixed global active-beam budget
for every serving count. That is not paper-faithful for
`PAP-2024-MORL-MULTIBEAM`: the paper baseline has 4 satellites and 7 beams per
satellite, so 28 comes from `4 x 7`, not from a global beam cap that remains
constant when `L` changes.

This matters because training complexity follows the decision candidate count,
not the background constellation pool. A UI that offers `L=12` implies an
84-action MODQN catalog (`12 x 7`) under paper-faithful semantics. That is a
different training regime, lacks direct paper support, and is not guaranteed by
the current `P=384` pool over a 2-hour serving-candidate horizon.

## Terminology

| Symbol | Meaning | Authority |
|---|---|---|
| `P` | Walker constellation pool propagated by the orbit model | Profile/runtime geometry |
| `visible` | Satellites above the runtime elevation threshold at a step | Live Walker runtime |
| `L` | Serving/candidate satellites exposed to MODQN at a decision step | MODQN env/profile config |
| `B` | Beams per serving satellite | Paper baseline, `B=7` |
| action catalog | Candidate beam actions visible to MODQN | `L x B` |

`P` is not the MODQN action space. `L` is the key training and action-space
dimension.

## Decision

### MODQN Walker Pool

Use `P=384` as the MODQN Walker pool:

```text
planes = 24
satsPerPlane = 16
altitudeKm = 780
inclinationDeg = 53
observer = 40N, 116E
```

The pool is a natural-visibility substrate. It exists so the runtime can select
the current top visible serving satellites without scripted passes.

### MODQN Serving Count

The formal MODQN serving count is:

```text
L in {2, 3, 4, 5, 6, 7, 8}
```

Interpretation:

- `L=4` is the paper-faithful baseline.
- `L=8` is the paper-supported upper sensitivity / richer demo setting.
- `L=2,3,5,6,7` are paper-supported sweep settings.
- `L=12` is not part of the formal MODQN training or default demo surface.

If a future stress experiment needs `L=12`, it must be a separately labeled
experimental mode with its own pool coverage audit and producer-side training
plan. It must not be mixed into the normal MODQN selector.

### Beam Model

Each serving satellite has 7 beams:

```text
B = 7 beams per serving satellite
action catalog size = L x 7
```

Therefore:

```text
L=2 -> 14 beam actions
L=4 -> 28 beam actions
L=8 -> 56 beam actions
```

Do not keep a fixed global `K=28` beam budget across all `L` and then distribute
those 28 beams over more satellites. `K=28` is only paper-faithful when
`L=4` and `B=7`.

If the live cell scheduler needs a display-only cap for 37 cells, that cap must
be named and labeled as display/scheduler presentation. It must not be used as
the MODQN action-catalog truth unless the producer exports that exact scheduler
contract.

### SINR Profile Boundary

Do not globally replace SINR's current source with the MODQN pool.

- The existing `sinr-experiment` default profile,
  `hobs-2024-candidate-rich`, remains a HOBS/SINR candidate-rich profile with
  its own multi-shell geometry.
- MODQN live/demo uses the MODQN Walker pool (`P=384`).
- If a comparison needs SINR and MODQN on the same geometry, add or select an
  explicitly labeled MODQN-aligned SINR profile that uses `P=384`.

The UI must not imply that all SINR evidence now comes from the MODQN pool.

### Timeline Boundary

`P=384` does not by itself authorize a 2-hour UI timeline.

A 2-hour live Walker timeline requires the runtime trajectory/cache, seek,
handover reset, and performance path to be validated at 7200 seconds. This repo
authorizes the live Walker 2-hour horizon only when
`validate:live-walker:7200-timeline` passes.

Legacy MODQN producer traces remain source-bounded to their exported horizon and
must not be stretched into a 2-hour proof.

## Evidence and 7200s Validator

Read-only controller scans on 2026-06-01 used the repo orbit helpers over the
current `P=384` MODQN profile for 7200 seconds at 1-second cadence:

```text
display/cache threshold >= 10 deg:
  min visible = 13
  mean visible = 15.746
  max visible = 18

serving threshold >= 15 deg:
  min visible = 10
  mean visible = 11.718
  max visible = 14
```

This supports formal `L<=8` for a 2-hour serving-candidate window with margin.
It does not support a formal always-full `L=12` serving window.

This scan is now codified as `validate:live-walker:7200-timeline`. The validator
also checks the 7200s trajectory cache, end-of-window runtime frame, timeline
label, and the rule that MODQN producer proof stays on its exported 10s source
horizon.

## Required Implementation Changes

### UI and Persistence

- Replace the MODQN serving selector options with `2,3,4,5,6,7,8`.
- Remove `12` from formal UI options and persisted accepted values.
- Migrate or clear any persisted `L=12` value to `L=8` as the paper-supported
  upper setting.
- Label `L=4` as baseline.
- Label `L=8` as paper sweep max or rich demo.
- Remove copy that says `K=28 active beams` is fixed across all serving counts.

Default policy:

- Paper/evidence mode defaults to `L=4`.
- A visual demo may start at `L=8` only if it is labeled as paper-supported rich
  demo, not as baseline.

### Runtime Model

- Treat `cellServingCount` as MODQN serving count `L`.
- Derive MODQN candidate beam catalog from `L x 7`.
- Retire or rename `PAPER_ACTIVE_BEAMS_PER_SLOT` where it is being used as a
  global fixed-capacity truth for `L>4`.
- If a display-only cell scheduler still caps active cells, separate that
  display cap from MODQN action truth.

### Validators

Add or update static validators to reject:

- `SERVING_COUNT_OPTIONS` containing `12` in the formal MODQN selector.
- UI copy claiming `K=28 active beams` is fixed across all `L`.
- code paths that treat `P` as the MODQN action dimension.
- replay/proof paths that fill missing producer truth from the live Walker pool.

Runtime/diagnostic validation must prove:

- `P=384` supplies at least `L=8` serving candidates over the intended live
  Walker horizon and elevation threshold.
- 7200-second timeline support is real before any 2-hour label is shown.
- SINR candidate-rich and MODQN-aligned geometry remain explicitly labeled.

## Non-Goals

- Do not train MODQN in `leo-beam-sim`.
- Do not create fake 2-hour MODQN replay history.
- Do not convert the existing HOBS/SINR candidate-rich profile into the MODQN
  pool by default.
- Do not delete legacy producer traces or replay bundles.
- Do not claim producer-backed `P=384`, `L=8`, or 2-hour MODQN proof until the
  producer exports an artifact with those fields.

## Acceptance Criteria for the Next Development Slice

1. Formal MODQN serving selector exposes only `L=2..8`.
2. `L=12` is absent from normal UI, persistence allowlists, and formal
   validators.
3. The UI explains `L=4` baseline and `L=8` paper sweep max without visible
   tutorial text clutter.
4. The live MODQN beam/action semantics are no longer described as fixed global
   `K=28` across all `L`.
5. SINR default behavior remains unchanged unless the user explicitly chooses a
   MODQN-aligned SINR profile.
6. Any 2-hour timeline label is gated by `validate:live-walker:7200-timeline`.
7. Legacy producer trace displays remain labeled as legacy/source-gap where the
   producer did not export Walker timeline truth.

## Handoff Notes

Start follow-up implementation passes from this SDD, not from the older
`L={4,8,12}` or fixed-`K=28` text. Completed safe slices:

1. update the serving-count selector and persistence allowlist;
2. update the labels and validators that mention fixed `K=28`;
3. add the 7200-second `P=384`, `L<=8` coverage validator;
4. enable the 2-hour live Walker timeline without changing producer proof
   horizons.
