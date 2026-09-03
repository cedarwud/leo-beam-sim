# Homepage Visual-First Handover Implementation Lock

## Status

**Owner-directed execution lock — 2026-08-30**

This document narrows the already accepted homepage multi-candidate SDD. It is
not a new scientific model, a replacement for ADR-014, or permission to turn
Forecast-EE on. Its purpose is to stop implementation drift between the
central scene, the decision state, and the right rail.

Authority order:

1. The user's repeated product requirements in the current handoff.
2. This implementation lock for the first executable slice.
3. `HOMEPAGE-MULTI-CANDIDATE-MULTIBEAM-EE-HANDOVER-SDD.md` and its ADRs for
   existing scientific contracts and later activation gates.
4. Existing dirty-worktree code is preserved unless an exact path is named by
   an implementation task.

## 1. Non-negotiable outcome

The homepage must tell one visible story without requiring the user to infer
it from the rail:

1. One serving satellite and one serving beam continue carrying the sole solid
   data link.
2. Before a handover, several currently measured satellite-beam alternatives
   appear together whenever the accepted frame contains at least two
   hard-eligible pairs.
3. Candidate satellites are visibly distinct by satellite identity; beams of
   the same satellite use related shades. Serving/candidate role is not encoded
   by a fixed yellow/blue role palette.
4. Candidate guides remain measurement-only. No candidate is presented as
   serving data before the atomic commit.
5. Inter-satellite handover and same-satellite beam switching use the same
   visible progression:

   ```text
   hard-eligible
   -> trigger-satisfied
   -> TTT-stable
   -> provisional leader
   -> selection hold
   -> one atomic commit
   ```

6. The satellite and beam selected at commit are the exact objects that become
   the new serving link in the central scene and the right rail.
7. The original readable 3D carrier remains visible: satellite GLBs, ground
   cells/footprints, UE, orbit/motion guides, event cues, and handover
   choreography are retained. Candidate presentation is additive.

## 2. Explicit non-goals for this slice

The following are deliberately frozen and must not become new work:

- no new SDD/ADR or second candidate/EE architecture;
- no broad replacement of the legacy 3D scene;
- no automatic camera pan, zoom, refit, or candidate-driven camera motion;
- no route-local substitute formulas, guessed coverage, or visual cone angle
  used as scientific eligibility;
- no Forecast-EE default activation, `epsilon_EE` invention, or 7200-second
  calibration in the visual recovery slice;
- no deletion of the compatibility `pendingTarget` projection. It may remain
  as a typed compatibility projection, but it must not retain later homepage
  primary-UE decision authority;
- no claim that a seven-slot Walker cell surrogate is a measured physical
  antenna-beam schedule;
- no new teaching-route redesign until the homepage carrier and handover
  fixture pass the acceptance gate below.

## 3. First executable slice

### 3.1 Frozen runtime fixture

Create or select one deterministic Starlink Walker frame sequence using the
existing seed/configuration. The fixture must contain a serving pair and at
least two hard-eligible candidate satellite-beam pairs at one accepted frame.
It must expose the complete observed/hard-eligible/trigger/TTT/selection state
without changing the live simulation clock or mutating assignments.

### 3.2 Decision authority seam

The new per-pair decision engine remains the authority for the homepage after
bootstrap. The legacy manager may provide a compatibility projection and
startup origin, but it must not independently choose a later primary-UE target
or advance a competing handover timer. Background beam-hop protection must be
given an explicit owner rather than silently reading a second decision path.

Do not remove scalar compatibility fields globally; isolate their scheduler
and presentation uses and keep one ranking/TTT/commit path.

### 3.3 Accepted snapshot and render join

The decision frame, candidate presentation plan, central scene, scene render
receipt, and right rail consume one immutable accepted snapshot. For every
displayed candidate, these values must match exactly on both sides:

```text
satelliteId, beamId, phase, role, metrics, sourceFrameId, config/policy hash
```

At commit, the old solid link ends and the new solid link begins at the same
transaction boundary. Any stale or unmapped candidate fails closed and emits a
typed receipt/telemetry error; it must not be silently reduced to text only.

### 3.4 Central scene and rail

The scene keeps the established carrier and adds bounded candidate geometry.
The rail explains the same visible candidates and their beams, including the
reason a final pair wins. Progressive disclosure may reduce rail density, but
it may not hide hard-eligible candidates from the scientific set or cover the
primary scene.

The first slice is not complete until the central scene works even when the
right rail is collapsed.

### 3.5 Parameter recomputation

For each currently exposed homepage control, a focused probe must show that a
change invalidates/recomputes the relevant candidate metrics and that the
central scene and right rail publish the same updated snapshot. This is a
verification of the existing configuration path, not permission to add new
controls.

## 4. Bottom-layer work that is genuinely still allowed

Only these backend changes are in scope before visual acceptance:

1. Finish the single homepage decision-authority seam described in §3.2.
2. Finish the live production adapter that carries the accepted per-frame
   candidate set into the snapshot; do not create another evaluator.
3. Finish global scene/rail receipt accounting and stale/missing mapping
   handling.
4. Prove control/date/time invalidation and same-snapshot publication.

Forecast-EE provider completion, physical beam-hopping semantics, TypeScript /
Python full parity, policy-threshold calibration, and long matched runs remain
separate gates. They may be implemented later only after this slice is visually
accepted and only under the existing homepage SDD.

## 5. Acceptance gate

No implementation slice may be called complete until all of the following are
recorded from port 3000:

- continuous inter-satellite and same-satellite beam-switch recordings;
- monitoring, evaluating, qualifying/TTT, selection-hold, switching, and
  receipt phases;
- at least two corresponding hard-eligible candidate rows and scene objects
  in one accepted frame;
- one and only one solid data link in every serving snapshot;
- exact scene/rail `sourceFrameId` and snapshot identity equality;
- candidate selection visibly matches the satellite/beam that commits;
- no candidate-triggered camera movement and no overlay covering the UE,
  footprint, selected target, or essential event cue;
- readable candidate rows at 1920x1080, 1440x900, and 1366x768, plus a
  reduced-motion/mobile smoke check;
- parameter/date/time changes show matching central and rail values; and
- owner visual acceptance. Tests, screenshots, Opus/Fable review, and browser
  validators are evidence, not substitutes for that acceptance.

## 6. Work ownership and sequencing

One writer owns each path set. No agents may concurrently modify shared
decision contracts or `MainScene`/candidate render code.

```text
read-only seam audit
  -> decision-authority adapter
  -> accepted snapshot / receipt proof
  -> central carrier + candidate overlay
  -> right-rail correspondence
  -> browser recording and owner acceptance
```

Parallel work is allowed only for non-overlapping audits or control probes.
Forecast-EE and decision-authority changes share contracts and must be staged,
not blindly merged in parallel.

## 7. Stop rule

If a proposed change does not directly satisfy §3 or §5, it is out of scope for
this slice. Do not compensate for an unclear scene by adding more formulas,
more panels, more labels, another route, or another abstraction layer.

