# MODQN Baseline Phase 6W Channel Adoption Decision Gate

**Date:** 2026-05-12
**Status:** `CHANNEL_ADOPTION_DEFERRED_PROVENANCE_REQUIRED`
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** docs-only antenna-pattern provenance and channel-adoption decision

Phase 6W decides what to do after Phase 6V reported
`BLOCKED_BY_PATTERN_CONVENTION`. It does not change runtime code, validators,
package scripts, UI controls, profiles, signal or handover logic, replay
inputs, producer artifacts, or vendored `ntn-sim-core` files.

Runtime adoption status after Phase 6W: **not adopted**.

## Decision

Phase 6W status: `CHANNEL_ADOPTION_DEFERRED_PROVENANCE_REQUIRED`.

Channel adoption remains deferred because local provenance does not prove which
J1+J3 antenna-pattern convention should govern the live runtime:

1. The current Leo HOBS/SINR helper is documented as
   `PAP-2024-HOBS Eq.(3)` / `ITU-R S.672-4` and uses Leo profile
   `beamwidth3dBRad` directly, with a calibrated alpha scale, boresight
   normalization, and a `-40 dB` floor.
2. The vendored `ntn-sim-core/src/core/channel/beam-gain.ts` helper is the
   Phase 6F validated donor copy. It derives `theta3db` from beam diameter and
   altitude, uses `u=2.07123`, and evaluates the J1+J3 expression without the
   Leo floor.
3. `ntn-sim-core` source maps anchor HOBS values such as
   `theta3dB=0.058 rad`, `h=550 km`, `D=63.87 km`, `G0=40 dBi`, and
   `bessel-j1j3`, but the inspected local surfaces do not prove that the
   donor J1+J3 normalization is wrong or that the Leo runtime convention should
   replace it.
4. Phase 6V found no paper-backed, standard-backed, source-map, or source-code
   authority for an extra curve-fit, calibrated `u`, alternate envelope, or
   floor as an adapter-only fix.

Therefore Phase 6W does not choose
`READY_FOR_SOURCE_PATCH_DESIGN` and does not choose
`READY_FOR_NON_PARITY_EXPERIMENTAL_DESIGN`.

## Evidence Summary

Phase 6T added a validator-only source-channel shadow KPI comparison. It kept
the existing HOBS/SINR runtime as authoritative and found that source-channel
shadow KPIs exceeded the Phase 6S drift gate. The largest differences were
beam-gain driven: p50 finite SINR drift was `6.299191 dB`,
`20.104735 dB`, and `7.808790 dB` across the three required HOBS profiles.

Phase 6U isolated the beam-gain mismatch. Passing the raw runtime layout
diameter into the donor helper produced large drift; diameter/beamwidth
adaptation reduced the mean absolute beam-gain difference from `17.250813 dB`
to `2.427126 dB` and the p50 difference from `8.495537 dB` to
`2.490353 dB`, but did not eliminate mismatch. Phase 6U therefore remained
`BLOCKED_BY_MODEL_DIFFERENCE`.

Phase 6V narrowed the residual to the J1+J3 antenna-pattern convention. The
same-theta sweep still showed adapted residuals above tolerance:
`11.983848 dB` max absolute mismatch, `2.764619 dB` mean absolute mismatch,
and `1.785050 dB` p50 absolute mismatch. Phase 6V concluded that an
adapter-only fix is not currently defensible.

## Provenance Inspected

Leo Phase surfaces:

1. `docs/modqn-baseline-phase6t-source-channel-shadow-kpi.md`
2. `docs/modqn-baseline-phase6u-beam-gain-mismatch.md`
3. `docs/modqn-baseline-phase6v-antenna-pattern-convention.md`
4. `scripts/fixtures/modqn-phase6t-source-channel-shadow-kpi.json`
5. `scripts/fixtures/modqn-phase6u-beam-gain-mismatch.json`
6. `scripts/fixtures/modqn-phase6v-antenna-pattern-convention.json`
7. `src/engine/signal/beam-gain.ts`
8. `src/core/channel/beam-gain.ts`

Donor and cross-repo surfaces:

1. `/home/u24/papers/ntn-sim-core/src/core/channel/beam-gain.ts`
2. `/home/u24/papers/ntn-sim-core/src/core/channel/link-budget.ts`
3. `/home/u24/papers/ntn-sim-core/src/core/engine/channel-sinr-helpers.ts`
4. `/home/u24/papers/ntn-sim-core/src/core/profiles/defaults-hobs.ts`
5. `/home/u24/papers/ntn-sim-core/src/core/config/paper-sources.json`
6. `/home/u24/papers/ntn-sim-core/src/core/config/parameter-registry-foundation-data.ts`
7. `/home/u24/papers/ntn-sim-core/scripts/golden-case-channel.mjs`
8. `/home/u24/papers/ntn-sim-core/docs/hobs-tr38811-sinr-implementation-note.md`
9. `/home/u24/papers/ntn-sim-core/docs/extraction-guide-for-leo-beam-sim.md`
10. `/home/u24/papers/ntn-sim-core/docs/validation-catalog.md`
11. `/home/u24/papers/ntn-showcase-stack/README.md` Module Vendor Log
12. `/home/u24/papers/modqn-paper-reproduction/src/modqn_paper_reproduction/env/channel.py`

Key provenance findings:

1. The cross-repo vendor log records Phase 6F as a validated beam-gain leaf
   vendor slice, with runtime adoption explicitly not adopted.
2. Donor validation includes `validate:golden-channel`, but that golden case
   primarily validates FSPL, a Bessel J1 pattern check, shadow/clutter tables,
   and multi-beam SINR sanity. It does not settle the Phase 6V J1+J3 residual
   between Leo's current convention and the vendored donor convention.
3. The donor HOBS implementation note assigns `G_T(theta)` to
   `src/core/channel/beam-gain.ts` and explains beam gain as a boresight-
   relative pattern delta, but it does not override the Phase 6V convention
   ambiguity.
4. The MODQN reproduction channel surface is SNR-like paper reproduction
   channel logic, not authority for adopting HOBS/SINR live source-channel
   output as MODQN replay evidence.

## Rejected Statuses

`READY_FOR_SOURCE_PATCH_DESIGN` is rejected for Phase 6W. Local provenance does
not prove that the vendored `ntn-sim-core` beam-gain convention is wrong. A
source patch would require a stronger source-side proof, not just local KPI
drift against Leo's current runtime helper.

`READY_FOR_NON_PARITY_EXPERIMENTAL_DESIGN` is rejected for Phase 6W. The
product/demo need for a non-parity source-channel mode has not been explicitly
chosen here, and adopting such a mode despite drift would require later UI,
diagnostic, and claim labels that disclose non-parity status.

## Claim Boundary

Phase 6W establishes no new MODQN evidence.

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` remain sensitivity/demo only and must not be described as
   trained baseline MODQN evidence.
3. HOBS/SINR live output remains separate from MODQN replay evidence.
4. Source-channel shadow diagnostics and antenna-pattern convention checks are
   not MODQN policy, reward, replay, training, or producer evidence.
5. Channel parity, shadow KPI comparison, runtime frame-step guards, and this
   decision gate do not create MODQN policy, reward, training, replay, or
   producer evidence.
6. EE-MODQN, HEA-MODQN, Catfish, Multi-Catfish, Catfish-over-HEA,
   Catfish-family effectiveness, and physical energy-saving claims remain
   non-scope.

## Next Recommended Phase

Recommended next phase: `Phase 6X antenna-pattern provenance packet`.

Phase 6X should stay docs-only or source-side design-only unless explicit
authority is found. Its job is to collect a source-side convention packet that
can prove one of these outcomes:

1. the donor J1+J3 implementation should remain authoritative for any
   source-backed live runtime;
2. the donor J1+J3 implementation is wrong and a source patch design should be
   opened in `ntn-sim-core`; or
3. the demo intentionally wants a non-parity source-channel experiment, with
   later explicit UI and claim labels.

Until one of those outcomes is proven or explicitly chosen, do not implement a
runtime flag, adapter fix, source-channel adoption, UI control, source patch,
or default-mode promotion.

## Validation

Required validation for Phase 6W:

1. `git diff --check`
2. whitespace check for this new doc
3. unsupported `19` / `37` trained-baseline claim scan
4. HOBS/SINR-as-MODQN-replay-evidence claim scan
5. runtime non-adoption statement by inspection only

Phase 6W validation results:

| Check | Result |
| --- | --- |
| `git diff --check` | Passed with no output. |
| `rg -n "[[:blank:]]$" docs/modqn-baseline-phase6w-channel-adoption-decision-gate.md` | No trailing-whitespace findings. |
| `git diff --no-index --check -- /dev/null docs/modqn-baseline-phase6w-channel-adoption-decision-gate.md` | No whitespace findings. The command exits nonzero because `/dev/null` and the new file differ. |
| unsupported `19` / `37` trained-baseline claim scan | Passed by inspection. Hits are boundary/prohibition or validation-scope text only. |
| HOBS/SINR-as-MODQN-replay-evidence claim scan | Passed by inspection. Hits are negative boundary statements only. |
| runtime non-adoption inspection | Passed. The Phase 6W path added by this change is this Markdown file only. |

Runtime non-adoption by inspection: this docs-only phase adds only
`docs/modqn-baseline-phase6w-channel-adoption-decision-gate.md`. No runtime
source, validator, package script, UI, profile, replay, producer artifact,
signal logic, handover logic, or vendored donor file was edited.

Browser smoke and long KPI validation are intentionally not run because Phase
6W has no browser-visible runtime, scene, panel, label, control, validator, or
simulation behavior change.

## Deviations And Blockers

Deviations:

1. None. Phase 6W is docs-only and stops at the decision gate.

Blockers:

1. Antenna-pattern convention provenance is insufficient to authorize
   source-channel runtime adoption.
2. The existing source-channel shadow KPI drift remains over the Phase 6S gate.
3. Adapter-only correction remains blocked because the residual is a J1+J3
   convention difference, not only diameter/beamwidth mapping.
