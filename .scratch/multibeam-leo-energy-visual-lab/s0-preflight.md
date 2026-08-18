# S0 authority, ownership, and baseline receipt

Date: 2026-08-14

Verdict: **PASS — S0.5 diagnostic-only work may begin under the frozen
allowlist below.**

## Controller authorization and writer ownership

- The controller authorized proceeding with the reviewed SDD sequence on
  2026-08-14.
- Sole implementation writer for this checkout: the active `/root` Codex
  session in `/home/u24/demo/leo-beam-sim`.
- Other visible Codex/Claude sessions resolve to `/home/u24/pptx-craft`,
  `/home/u24/papers/mcrl-figures`,
  `/home/u24/papers/modqn-paper-reproduction`, and
  `/home/u24/odoo19-docker/khoa`; none owns this checkout.
- The Vite process on port 3000 is a renderer/dev server, not a source writer.
- `lsof` found no process holding the proposed S0.5 source paths open.
- Recheck these facts immediately before the first S0.5 write. Any new
  overlapping writer or changed file digest reopens S0.

## Base and dirty-state receipt

```text
base HEAD: 61d68ccd0cf8bf2315c114bced2739b80981dcea
branch: main...origin/main
worktrees: one, /home/u24/demo/leo-beam-sim
staged paths: none
git lock files: none
tmux server: absent at /tmp/tmux-1000/default
dirty paths before repair: 201
dirty paths after repair and this receipt: 202 plus this receipt
```

The checkout already contained broad user/controller WIP, including every
candidate S0.5 producer path. No reset, stash, restore, cleanup, broad add,
commit, or push was performed. The current session explicitly adopts only the
paths listed below and must preserve all other WIP.

## Authority digest

```text
ADR-005  7c9e7959895aabf141067b2aa628d290cdcdbefb21245f0e645ffe2cc897f156
ADR-006  70f30c36b64d69b2c4b2a6dcbaceda609725cdbb5398aac255599d2a3c9bb0d2
ADR-007  f49be14b0455763056e12e75e13e9c9278b614e3067403396059749891a067cb
vertical-slice SDD  ef50ae09f6b4a45388ff8310f59f46dc07b48a83768a874c1b9848b9841b6c77
experience addendum  164947d84a98d507685403a4ff652d27415b2f8735eae488e73dd567ff0ced20
```

ADR-003 remains the mathematical authority with contract version
`family-b-thesis-3.13-3.17-v1`.

## Inherited aggregate-gate repair

### Simulator ownership gate

The red `channelGainScale` assertion was a stale contract conflict. The latest
thesis-form UI and its focused tests intentionally omit three non-formal
channel extensions, while the aggregate test still classified every serialized
field as editable and separately required zero EE-owned inputs.

The repair:

- keeps `channelGainScale`, `scintillationScaleDb`, and
  `shadowFadingMarginDb` as compatibility-only serialized fields;
- keeps them outside the formal adapter and left-rail controls;
- retains the four real EE energy-consumption controls; and
- aligns ADR-005, the TLE SDD, the current handoff, ownership metadata, and the
  aggregate assertion without changing producer calculations.

Verified:

```text
npm run test:simulator  PASS
npm run lint            PASS
git diff --check        PASS for the repair paths
```

### Geometry-trace gate

The 1610 differences were classified before replacement:

- 1440 `display.displaySats.*.world` differences: committed 1.5x
  display-altitude lift;
- 137 `truth.cellServing.*` differences: committed deterministic
  per-satellite beam-schedule de-phasing; and
- 33 downstream display beam/label differences from that schedule.

The two source changes are clean committed bytes from `9d38a13`; no current
dirty writer modified them. The old golden had not been updated after that
commit. The validator's run-twice determinism and perturbation controls passed
before the audited replacement. Old and new fixture hashes:

```text
old  53c51b7bed5669c5be1d35c5e389771dadbdf14a43da702365fbc5d33d2ec859
new  b08c0dae11d8da72110d65af22d70b7d88ff3034fc54c504e29826c656090627
```

Verified after replacement:

```text
npm run validate:s0:geometry-trace              PASS
npm run validate:s1:coordinate-authority         PASS, 23 checks
npm run validate:phase-c:sinr-live-cells:model   PASS, 25 checks
```

The previous fixture is recoverable from Git and from the temporary local copy
`/tmp/s0-geometry-candidate-rich-baseline.before-20260814.json` during this
session.

## Frozen S0.5 path allowlist

S0.5 may write only:

```text
src/analysis/canonicalEe/types.ts
src/analysis/canonicalEe/producer.ts
src/analysis/canonicalEe/canonicalEe.test.ts
src/simulator/types.ts
src/simulator/analysis.ts
src/simulator/simulator.test.ts
src/simulator/canonicalLinkResult.test.ts
src/simulator/canonicalTleHandover.ts
src/simulator/canonicalTleHandover.test.ts
src/simulator/tleAnalysisRun.ts
src/simulator/tleAnalysisRun.test.ts
.scratch/multibeam-leo-energy-visual-lab/s0-preflight.md
.scratch/multibeam-leo-energy-visual-lab/s0.5-review.md
```

S0.5 must expose only:

1. canonical raw `h` and divisor-safe `h^div` evidence;
2. the same representative UE/beam candidate identity and explicit
   counterfactual role; and
3. an immutable serving-change evidence record with stable event identity and
   qualifying/visibility evidence.

It may not mount `/explain`, add presentation state, touch homepage or scene
files, alter formula/cap semantics, or change ADR-006 decision behavior.
