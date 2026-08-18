# Angle-aware EE binding contract v1

This directory binds the teaching lab to the owner-selected scientific authority in
`/home/u24/papers/modqn-paper-reproduction/docs/ADR-003-canonical-ee-closure.md`.
It does not define a second energy-efficiency model.

## Binding identity

- Contract version: `family-b-thesis-3.13-3.17-v1`
- Canonical executable source: `src/modqn_paper_reproduction/runtime/angle_aware_ee.py`
  in `modqn-paper-reproduction`
- Canonical runtime source SHA-256:
  `e838246b7c82e4ccb01b323d92d5e49ab3f849039e31312f20a96adc52154131`
- Golden fixture: `golden-vectors.json`
- Golden fixture SHA-256:
  `2d9de6552e9a8ad037b8d76999fd291938f6fefe64f6ec075b2ea19d76070519`
- Formal chain:
  `theta -> G_T(theta) -> h -> p_req -> actual capped P_DL -> coupled interference -> realized SINR/rate -> PA/fixed costs -> P_sys -> r1_u=R_u/P_sys`
- Evaluation: total delivered bits divided by total consumed energy over the same
  time domain.

`p_req` is a formal upstream power-control quantity. `q` and `kappa` are diagnostics
only and must never enter a teaching reward, headline metric, or displayed personal
energy attribution. Load-only power and post-hoc repricing are historical negative
controls, not alternate lab modes.

## Current claim boundary

The lab currently has no production simulator implementation. This directory closes
only the authority/fixture seam; it does not establish runtime, browser-pixel, or
classroom acceptance. A future implementation must use an adapter to the canonical
runtime when deployment permits, or consume generated outputs that pass the fixture
in `PARITY-PLAN.md`. Handwritten formula duplication is prohibited.

The runtime source SHA is a working-tree content identity, not a Git commit ID.
Any canonical source-byte change requires an ADR/contract-version decision,
regenerated golden vectors, and fresh cross-repository parity before the lab may
consume the changed runtime. Updating this SHA alone is not an accepted migration.
