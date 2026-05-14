# MODQN Baseline Phase 6X Antenna Pattern Provenance Packet

**Date:** 2026-05-12
**Status:** `PROVENANCE_INSUFFICIENT_SOURCE_DECISION_REQUIRED`
**Target repo:** `/home/u24/papers/project/leo-beam-sim`
**Scope:** docs-only antenna-pattern provenance packet

Phase 6X inventories the local evidence behind the antenna-pattern convention
blocker isolated by Phase 6U and Phase 6V, then carried forward by Phase 6W.
It does not change source code, validators, package scripts, runtime wiring,
profiles, UI controls, replay inputs, artifacts, vendored files, or
`ntn-sim-core` source.

Runtime adoption status after Phase 6X: **not adopted**.

## Phase 6X Status

Phase 6X status:

`PROVENANCE_INSUFFICIENT_SOURCE_DECISION_REQUIRED`

Local provenance proves a real convention mismatch, but it does not prove that
either implementation is wrong. It also does not prove that either convention
should be promoted as Leo's source-backed live-runtime truth without an explicit
source-side or product decision.

## Authority Classes

This packet uses these classes:

| Class | Meaning |
|---|---|
| `runtime-current` | The surface currently drives Leo live HOBS/SINR behavior. It proves current behavior, not necessarily cross-repo source truth. |
| `vendored-source` | Source copied from or owned by `ntn-sim-core/src/core`. It is donor/source evidence, subject to the vendor-on-demand workflow. |
| `validation/golden` | Validator, fixture, or KPI evidence. It proves the checked behavior and guard conditions, not necessarily full scientific correctness. |
| `paper/provenance` | Source-map, paper-family, or assumption documentation. It can justify claim boundaries and parameter anchors. |
| `coordination/vendor-log` | Cross-repo coordination evidence that records what was vendored and what was not adopted. |
| `non-authoritative observation` | Useful context that does not decide antenna-pattern truth for Leo live runtime. |

## Evidence Inventory

### Leo Current HOBS/SINR Runtime Evidence

| Evidence item | Authority | Convention evidence | Phase 6X interpretation |
|---|---|---|---|
| `src/engine/signal/beam-gain.ts` | `runtime-current` | Current live helper. It is documented as `PAP-2024-HOBS Eq.(3)` / `ITU-R S.672-4`, uses `beamwidth3dBDeg` directly, uses `alphaScale=1.835239914925094` for `bessel-j1-j3`, normalizes by `BESSEL_J1_J3_BORESIGHT_ENVELOPE=1.75`, and floors output at `-40 dB`. | Proves Leo's current live HOBS/SINR antenna pattern. It does not prove this is the intended source-backed convention after vendoring. |
| `src/engine/signal/link-budget.ts` | `runtime-current` | Live HOBS/SINR path calls the current helper, applies `antenna.maxGainDbi` outside the helper, subtracts steering loss, applies path loss, and then forms same-frequency interference plus noise. | Proves the current runtime receives the Leo helper's relative beam-pattern delta. |
| `src/profiles/hobs-2024-paper-default.json` and peer HOBS profiles | `runtime-current` | HOBS-family profiles use `model: "bessel-j1-j3"`, `maxGainDbi: 40`, and `beamwidth3dBRad: 0.058`. | Proves current profile inputs to the Leo helper. It does not settle the J1+J3 formula convention. |
| `src/profiles/types.ts` and `src/signalTuning.ts` | `runtime-current` | Runtime tuning exposes `antenna.model`, `maxGainDbi`, and `beamwidth3dBDeg`, then writes back `beamwidth3dBRad`. | Proves the live UI/control surface can alter the current Leo convention. It is not source-convention authority. |
| `docs/hobs-tr38811-sinr-mini-sdd.md` | `paper/provenance` | Describes Leo's local HOBS/TR 38.811 hardening path and says the repo already simulates Bessel J1/J3 beam gain. | Historical local design authority for the current Leo path. It predates the Phase 6U/6V blocker and does not resolve the source convention. |
| `docs/sinr-runtime-parameter-contract.md` | `paper/provenance` | Defines the shipped SINR control contract and maps `G^T`, `theta_3dB`, max gain, gain model, and frequency reuse into the live formula path. | Good UI/runtime contract evidence. It is not enough to choose between Leo and donor J1+J3 normalization. |
| `docs/hobs-tr38811-current-status.md` | `non-authoritative observation` | Says the local HOBS/TR 38.811 implementation was sufficient for an earlier SINR-alignment goal. | Useful historical context, but superseded for this decision by the later Phase 6T/6U/6V/6W mismatch evidence. |

### Vendored Leo `src/core/channel` Evidence

| Evidence item | Authority | Convention evidence | Phase 6X interpretation |
|---|---|---|---|
| `src/core/channel/beam-gain.ts` | `vendored-source` | Destination copy of `ntn-sim-core/src/core/channel/beam-gain.ts`, with only the Phase 6F documented trailing-space normalization. For `bessel-j1j3`, it derives `theta3db=atan(beamDiameterKm/(2*altitudeKm))`, uses `u=2.07123*sin(theta)/sin(theta3db)`, and evaluates `(J1(u)/(2u)+36*J3(u)/u^3)^2` with no Leo `-40 dB` floor. | Proves the donor convention present in Leo. It is not adopted by live runtime. |
| `src/core/channel/link-budget.ts` | `vendored-source` | Uses `computeBeamGain()` as Tier 3 beam gain in a source-style link-budget composition. | Proves how the vendored helper would be consumed if source-channel link budget were adopted. |
| `src/core/channel/types.ts` | `vendored-source` | Defines `BeamGainInput` with `beamDiameterKm`, `altitudeKm`, and optional `slantRangeKm`. | Proves the source helper input contract is diameter-based, not Leo profile-beamwidth based. |
| `docs/modqn-baseline-phase6f-beam-gain-vendor.md` | `validation/golden` | Records Phase 6F source-side `validate:core-purity` and `validate:golden-channel` passes, destination validator pass, hashes, and runtime non-adoption. | Proves the beam-gain leaf was safely copied. It does not prove runtime adoption or resolve Leo-vs-source convention truth. |
| `scripts/validate-modqn-phase6f-beam-gain-vendor.ts` | `validation/golden` | Checks hashes, import purity, deterministic `computeBeamGain()` fixtures, `computeOffAxisAngle()` fixtures, and runtime non-adoption. | Validates the vendored slice boundary, not the Phase 6V J1+J3 source decision. |

### `ntn-sim-core` Source Evidence

| Evidence item | Authority | Convention evidence | Phase 6X interpretation |
|---|---|---|---|
| `/home/u24/papers/ntn-sim-core/src/core/channel/beam-gain.ts` | `vendored-source` | Source copy of the donor helper. It matches the Leo vendored helper except for the Phase 6F trailing-space normalization in Leo. | Source implementation authority, but not proof that Leo's current helper is wrong. |
| `/home/u24/papers/ntn-sim-core/src/core/channel/link-budget.ts` | `vendored-source` | Calls source `computeBeamGain()` as Tier 3 and composes channel tiers. | Shows intended source-side consumption of the donor helper. |
| `/home/u24/papers/ntn-sim-core/src/core/channel/types.ts` | `vendored-source` | Defines `BeamGainInput` around beam diameter and altitude, with optional slant range for theta calculation. | Source API evidence for the diameter convention. |
| `/home/u24/papers/ntn-sim-core/src/core/profiles/defaults-hobs.ts` | `paper/provenance` | Source map records HOBS anchors: `theta3dB=0.058 rad`, `h=550 km`, `D=2h*tan(theta3dB)=63.87 km`, `G0=40 dBi`, and `bessel-j1j3`. | Strong source-side provenance for HOBS parameters and diameter mapping. It still does not prove the exact J1+J3 normalization constants against Leo's helper. |
| `/home/u24/papers/ntn-sim-core/src/core/config/parameter-registry-foundation-data.ts` | `paper/provenance` | Records `G0=40 dBi` and `beam_diameter_km=63.87163746358206` for HOBS-family profiles. | Supports the Phase 6U diameter adapter as a provenance-backed comparison. |
| `/home/u24/papers/ntn-sim-core/src/core/config/paper-sources.json` | `paper/provenance` | Maps `PAP-2024-HOBS` and `STD-ITU-S672` to `src/core/channel/beam-gain.ts`; maps `ASSUME-MODQN-BEAM` to MODQN-specific beam assumptions. | Supports donor/source provenance but does not adjudicate the Leo-vs-source residual. |
| `/home/u24/papers/ntn-sim-core/sdd/ntn-sim-core-profile-baselines.md` | `paper/provenance` | States HOBS beam gain model is Bessel J1+J3 and the simulator antenna model is `bessel-j1j3`. | Confirms source profile identity, not the exact residual convention. |
| `/home/u24/papers/ntn-sim-core/sdd/ntn-sim-core-reproduction-targets.md` | `paper/provenance` | Lists HOBS peak gain, 3 dB beamwidth, and Bessel J1+J3 beam gain from Eq. (3)/(A1). | Confirms paper-family target and source claim boundary. |
| `/home/u24/papers/ntn-sim-core/sdd/ntn-sim-core-sdd.md` | `paper/provenance` | Defines beam-gain as a mandatory Tier 3 channel component and maps HOBS to a profile-declared Bessel J1-family. | Source design evidence. It does not distinguish Leo's normalized J1+J3 implementation from the donor helper. |
| `/home/u24/papers/ntn-sim-core/scripts/golden-case-channel.mjs` | `validation/golden` | `validate:golden-channel` checks FSPL, Bessel J1 beam gain, shadow/clutter tables, and channel sanity. The beam check is J1-focused, not a direct Phase 6V J1+J3 residual oracle. | Good donor validation, but insufficient to prove the donor J1+J3 convention is uniquely correct. |
| `/home/u24/papers/ntn-sim-core/scripts/validation/runtime-validation-core-suite.mjs` | `validation/golden` | Contains multi-beam SINR structure checks using a J1 geometry pattern. | Useful structural validation, not an authority for the Phase 6V J1+J3 residual. |
| `/home/u24/papers/ntn-sim-core/scripts/validate-multibeam-gating.ts` | `validation/golden` | Uses HOBS profile beam diameter and altitude to validate multibeam serviceability/gating surfaces. | Supports source profile geometry, not the exact antenna-pattern normalization decision. |
| `/home/u24/papers/ntn-sim-core/docs/hobs-tr38811-sinr-implementation-note.md` | `paper/provenance` | Maps `theta` and `G_T(theta)` to `src/core/channel/beam-gain.ts`, says beam gain is a boresight-relative delta, and lists HOBS/TR 38.811 anchors. | Strong source-side implementation narrative. It does not override the Phase 6V ambiguity. |
| `/home/u24/papers/ntn-sim-core/docs/validation-catalog.md` | `coordination/vendor-log` | Identifies `validate:reference`, `validate:runtime`, and golden validators as donor reference checks. | Useful for future source-side decision workflow, not a convention decision by itself. |
| `/home/u24/papers/ntn-sim-core/docs/extraction-guide-for-leo-beam-sim.md` and `docs/leo-beam-sim-donor-map.md` | `coordination/vendor-log` | Define `ntn-sim-core` as frozen donor/reference and require target-owned divergences to be documented. | Confirms a later source decision must be explicit and validated. |

### Phase 6U, 6V, And 6W Evidence

| Evidence item | Authority | Convention evidence | Phase 6X interpretation |
|---|---|---|---|
| `docs/modqn-baseline-phase6u-beam-gain-mismatch.md` | `validation/golden` | Phase 6U isolated large raw drift and showed diameter adaptation reduces mean absolute beam-gain difference from `17.250813 dB` to `2.427126 dB`, with p50 residual `2.490353 dB`. Status: `BLOCKED_BY_MODEL_DIFFERENCE`. | Proves an adapter-only diameter fix is insufficient. |
| `scripts/fixtures/modqn-phase6u-beam-gain-mismatch.json` | `validation/golden` | Defines validator-only policy, not-adopted runtime status, thresholds, and claim boundaries. | Establishes the Phase 6U guardrail. |
| `scripts/validate-modqn-phase6u-beam-gain-mismatch.ts` | `validation/golden` | Compares current Leo helper, raw donor helper, and diameter-adapted donor helper across analytic and runtime-derived samples. | Main local diagnostic proof for the mismatch shape. |
| `docs/modqn-baseline-phase6v-antenna-pattern-convention.md` | `validation/golden` | Phase 6V compared three conventions and found adapted same-theta residuals above tolerance. Status: `BLOCKED_BY_PATTERN_CONVENTION`. | Proves the remaining residual is a J1+J3 convention issue, not only diameter mapping. |
| `scripts/fixtures/modqn-phase6v-antenna-pattern-convention.json` | `validation/golden` | Admits only candidates with explicit paper-backed, standard-backed, source-map, or source-code provenance. Expected status is `BLOCKED_BY_PATTERN_CONVENTION`. | Blocks curve-fit or hidden adapter candidates. |
| `scripts/validate-modqn-phase6v-antenna-pattern-convention.ts` | `validation/golden` | Encodes the compared conventions: Leo normalized J1+J3, raw donor J1+J3, and Phase 6U diameter adapter. | Main local diagnostic proof that extra source provenance is needed. |
| `docs/modqn-baseline-phase6w-channel-adoption-decision-gate.md` | `paper/provenance` | Phase 6W chooses `CHANNEL_ADOPTION_DEFERRED_PROVENANCE_REQUIRED`, rejects source patch design and non-parity experimental design for that phase, and recommends Phase 6X. | Direct predecessor decision. Phase 6X preserves this stop line. |
| Phase 6W fixture | `non-authoritative observation` | No Phase 6W fixture exists in the inspected local tree. Phase 6W is a docs-only decision gate. | No fixture evidence is available beyond the Markdown decision packet. |
| `docs/modqn-baseline-phase6t-source-channel-shadow-kpi.md` and fixture | `validation/golden` | Phase 6T found source-channel shadow drift above the Phase 6S gate and identified beam-gain-driven SINR drift. | Context for why Phase 6U/6V were needed. |

### Cross-Repo Vendor Log Evidence

| Evidence item | Authority | Convention evidence | Phase 6X interpretation |
|---|---|---|---|
| `/home/u24/papers/ntn-showcase-stack/README.md` Module Vendor Log, Phase 6F `core/channel/beam-gain` row | `coordination/vendor-log` | Records source path, destination path, validation commands, one trailing-space normalization, PASS, and explicit runtime non-adoption. | Confirms beam-gain vendoring occurred and did not adopt runtime behavior. |
| Module Vendor Log Phase 6D `core/channel` row | `coordination/vendor-log` | Records vendoring of `types.ts`, `sinr.ts`, and `fspl.ts`; runtime adoption explicitly not adopted. | Establishes channel leaf groundwork before beam gain. |
| Module Vendor Log Phase 6K `core/channel/link-budget` row | `coordination/vendor-log` | Records link-budget composition helper vendoring and runtime non-adoption. | Shows donor beam gain is available in source-style link-budget composition but still not live. |
| Module Vendor Log Phase 6L `core/channel/index` row | `coordination/vendor-log` | Records channel barrel vendoring and runtime non-adoption. | Confirms no channel runtime adoption was performed through the barrel. |
| `/home/u24/papers/ntn-showcase-stack/AGENTS.md` and `docs/repo-roles.md` | `coordination/vendor-log` | State that live-sim rigor-critical logic should be vendored from `ntn-sim-core/src/core`, while Leo must not become an independent truth source. | Supports the need for explicit source decision before changing live truth. |

### MODQN Producer Evidence For Claim Boundary Context

| Evidence item | Authority | Convention evidence | Phase 6X interpretation |
|---|---|---|---|
| `/home/u24/papers/modqn-paper-reproduction/AGENTS.md` | `paper/provenance` | Producer owns MODQN actions, rewards, diagnostics, evidence status, and claim boundaries. Display needs must not change training/evaluation semantics. | Claim-boundary authority only. Not antenna-pattern convention authority for Leo live HOBS/SINR. |
| `/home/u24/papers/modqn-paper-reproduction/src/modqn_paper_reproduction/env/beam.py` | `paper/provenance` | Hex-7 baseline geometry. It explicitly says the MODQN paper does not model off-axis beam gain; off-axis angle is state/future-extension data, not Phase 1 channel computation. | Supports the boundary that 7-beam MODQN replay evidence is separate from HOBS/SINR antenna-pattern truth. |
| `/home/u24/papers/modqn-paper-reproduction/src/modqn_paper_reproduction/env/channel.py` | `paper/provenance` | Implements SNR-like MODQN channel gain from FSPL, atmospheric factor, Rician fading, and noise. No antenna-pattern convention is used. | Confirms the producer baseline is not channel-convention authority for Leo HOBS/SINR. |
| MODQN HOBS/SINR channel-regime audit docs and script | `paper/provenance` | Records that adding 30/40 dBi antenna gain is a model extension not in the MODQN paper; HOBS 40 dBi is different-paper context. | Useful claim boundary: HOBS antenna gain must not be relabeled as paper-backed MODQN baseline evidence. |
| Angle-aware EE Phase 02A surfaces using `approved_G_T_bessel_v1` | `non-authoritative observation` | Separate angle-aware EE route records an approved Bessel gain source for that route. | Not authority for Leo live HOBS/SINR or for deciding the Phase 6V source-vs-Leo convention. |

## Direct Answers

### Does Local Provenance Prove Leo's Current Antenna Pattern Is Intended Live-Runtime Truth?

No.

Local provenance proves Leo's current antenna pattern is the **current live
runtime** implementation. It is documented, controllable through the live
profile/tuning path, and used by `src/engine/signal/link-budget.ts`.

It does not prove that Leo's current normalized J1+J3 constants, envelope, and
floor are the intended source-backed truth after the project adopted the
vendor-on-demand rule for rigor-critical live-sim modules.

### Does Local Provenance Prove `ntn-sim-core`'s Vendored Antenna Pattern Is Intended Live-Runtime Truth?

No for Leo live runtime, yes only as donor/source evidence.

The donor helper is source-owned, validated as a vendored leaf, and supported
by `ntn-sim-core` source maps and HOBS profile provenance. That proves the
donor convention exists and is the current source implementation.

It does not prove Leo should replace its current live helper with the donor
helper while Phase 6T/6U/6V drift remains above the gate and the exact J1+J3
residual has not been adjudicated source-side.

### Does Local Provenance Prove Either Implementation Is Wrong?

No.

Phase 6U and Phase 6V prove mismatch and isolate the residual. They do not
prove the Leo helper is wrong, and they do not prove the donor helper is wrong.
The local evidence can support a source-side review request, but not a patch
claim.

### Is A Source Patch Design Justified?

No.

A source patch design is not justified by local provenance alone. A source
patch would require a source-side proof that the donor `ntn-sim-core`
J1+J3 implementation contradicts the source paper, source maps, golden
fixtures, or a stronger source-owned oracle. Phase 6X found no such proof in
the inspected local evidence.

### Is A Non-Parity Experimental Live Mode Justified?

No for Phase 6X.

A non-parity experimental live mode could be a later product decision, but the
local provenance packet does not justify implementing it. Such a mode would
need explicit UI labels, diagnostics, claim text, and validation that it is
non-parity source-channel behavior, not MODQN replay evidence and not adopted
source truth.

## Decision Recommendation

Recommended next decision:

1. Keep runtime adoption deferred.
2. Do not implement adapter fixes, runtime flags, UI controls, source patches,
   or source-channel adoption from this packet.
3. If the team wants source-backed live runtime, open a source-side
   `ntn-sim-core` antenna-pattern convention decision that checks the donor
   J1+J3 formula against source paper text, source-map intent, and any stronger
   golden oracle.
4. If the team wants a demo-only non-parity source-channel mode, make that an
   explicit product decision with non-parity labeling before implementation.

## Claim Boundary

Phase 6X establishes no new MODQN evidence.

1. `7` beams remains the accepted regenerated baseline MODQN evidence path.
2. `19` and `37` remain sensitivity/demo only and must not be described as
   trained baseline MODQN evidence.
3. HOBS/SINR live output remains separate from MODQN replay evidence.
4. Phase 6X diagnostics and provenance inventory are not MODQN policy, reward,
   replay, training, or producer evidence.
5. Source-channel shadow diagnostics, beam-gain mismatch checks, and antenna-
   pattern convention checks do not create MODQN policy, reward, training,
   replay, or producer evidence.
6. EE-MODQN, HEA-MODQN, Catfish, Multi-Catfish, Catfish-over-HEA,
   Catfish-family effectiveness, and physical energy-saving claims remain
   non-scope.

## Validation Plan

Required validation for Phase 6X:

1. `git diff --check`
2. no-index whitespace check for this new doc
3. unsupported `19` / `37` trained-baseline claim scan
4. HOBS/SINR-as-MODQN-replay-evidence claim scan
5. confirm no source/runtime/package files were changed by Phase 6X

Browser smoke and long KPI validation are intentionally not run because Phase
6X is docs-only and has no browser-visible runtime, scene, panel, label,
control, validator, or simulation behavior change.

## Validation Results

| Check | Result |
|---|---|
| `git diff --check` | Passed with no output. |
| `git diff --no-index --check -- /dev/null docs/modqn-baseline-phase6x-antenna-pattern-provenance-packet.md` | No whitespace findings. The command exits nonzero because `/dev/null` and the new file differ. |
| Unsupported `19` / `37` trained-baseline claim scan on this packet | Passed with no hits. |
| HOBS/SINR-as-MODQN-replay-evidence claim scan on this packet | Passed by inspection. The only hits are negative boundary statements saying HOBS/SINR is separate from MODQN replay evidence. |
| Source/runtime/package change confirmation | Phase 6X changed only this Markdown file. The broader worktree already contained modified and untracked source, script, package, and docs files before this packet; those were not edited by Phase 6X. |

## Deviations And Blockers

Deviations:

1. None from the requested Phase 6X scope. This packet is docs-only.
2. The repository worktree was already dirty before Phase 6X, including
   package, source, script, and earlier docs changes. This phase did not touch
   them.

Blockers:

1. Local evidence is insufficient to decide the source antenna-pattern
   convention.
2. Existing Phase 6T source-channel shadow drift remains above the Phase 6S
   gate.
3. Adapter-only correction remains blocked because the residual is a J1+J3
   convention difference, not only diameter/beamwidth mapping.
