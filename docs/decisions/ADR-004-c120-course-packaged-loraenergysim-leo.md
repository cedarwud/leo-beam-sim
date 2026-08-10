# ADR-004: Use a course-packaged LoRaEnergySim runner with Leo as the C-120 visual evidence host

## Status

**Accepted by owner direction; implementation pending SDD acceptance and contract freeze**

Date: 2026-08-10

Decision identifier: `C120-LORA-LEO-1`

Implementation repository: `/home/u24/demo/leo-beam-sim`

Upstream candidate: `GillesC/LoRaEnergySim` at commit
`f854462cda0cd30cb56e3f0c576cb004711842f6`

## Context

The current C-120 beta already provides an isolated Leo course route, coherent
simulated fixtures, authoritative replay, a stable `scenario_id`, recovery, and
a reopenable Energy Decision Workbook. It is suitable as a visual evidence
host, but the learner interaction can still feel like a short sequence of
browser choices rather than a sustained software laboratory.

The owner has selected a different hands-on direction: students should obtain
a prepared repository, install a small Python environment, edit a bounded
policy file, execute baseline and candidate runs, and bring the resulting
artifact into Leo for visual analysis. The course remains about **smart energy
and IoT applications**. LEO supplies a changing service window and a visible
example; it is not the subject specialization.

The upstream LoRaEnergySim project is relevant because its nodes model sleep,
processing, transmit, and receive states and expose packet, collision,
retransmission, and energy results. Its upstream workflow is research-oriented:
it asks users to edit `GlobalConfig.py`, generate locations, author a simulation
script, and commonly run stochastic or Monte Carlo experiments. It does not
provide the C-120 scenario identity, LEO contact-window semantics, deterministic
student workflow, JSON interchange contract, or Leo visualization required by
this course.

The previous decision to reject LoRaEnergySim applied to the **unmodified
upstream project as a required classroom runtime**. It did not reject a
course-owned, pinned, deterministic wrapper.

## Decision

Adopt **course-packaged LoRaEnergySim + Leo** with the following hard boundary:

1. A course-owned Python runner wraps a pinned LoRaEnergySim revision.
2. Students edit only `student_policy.py`; they do not edit the upstream
   framework, calculate scientific metrics in the browser, or debug the Leo
   application.
3. Leo exports a versioned scenario package containing the same
   `scenario_id`, contact windows, traffic cards, units, and course assumptions
   used by the browser route.
4. The runner consumes that package, executes the student policy locally, and
   emits one deterministic, schema-validated result artifact.
5. Leo imports the artifact fail closed and materializes an authoritative
   **endpoint replay** for queue, packet attempts, delivery/expiry, radio
   states, contact/handover context, endpoint energy, and endpoint service.
   Existing C-120 authoritative replay remains the separate authority for
   current Leo/system evidence; Phase 1 does not cast or copy endpoint values
   into its system/canonical fields. Both layers share the scenario anchor,
   clock, and Energy Decision Workbook.
6. No server executes uploaded student Python. Only JSON artifacts cross the
   trust boundary.
7. A fixture artifact for the same scenario remains available as a two-minute
   classroom recovery path. Fallback is visible and preserved in provenance.
8. The exact claim ceiling remains:

   `SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED`
9. Every student-facing package action and policy edit is taught as a causal
   decision, not as a recipe. The deck and quick sheet must state what the
   learner does, why the action is necessary, which mechanism it changes, what
   evidence should change, and how to interpret an unexpected result.

## Course-authority amendment

This owner direction supersedes only the older clauses that made package
installation and source editing categorically forbidden. It replaces them with
the following narrower rule:

- installing the prepared course runner is allowed;
- editing `student_policy.py` is a required learning action;
- every command and edited line requires a novice-readable explanation of its
  purpose and expected evidence;
- the new course deck uses the dark Leo-aligned evidence-lab visual system;
  the earlier light scratch outline is superseded for this deck but preserved
  as WIP rather than overwritten;
- editing upstream LoRaEnergySim, Leo source, scientific formulas, schemas, or
  generated artifacts is forbidden;
- installation and waiting do not count as energy-learning evidence;
- a learner must still produce a consequential policy change, replay evidence,
  and a causal explanation.

The following C-120 decisions are preserved:

- exact 120-minute energy-first course;
- non-communications-background audience;
- LEO as a moving service-window example rather than a satellite-specialist
  course;
- one scenario identity across TLE, all labs, replay, import, and workbook;
- no browser-side scientific formulas;
- W, J, bit/s, delivered bits, service, freshness, deadline, and bit/J remain
  distinct fields;
- incomplete and complete workbook export/reopen;
- deterministic fixture fallback and fail-closed identity/unit validation;
- no classroom-ready, 20-seat, canonical, measured, or live claim without the
  corresponding evidence.

The planning repository is not modified by this ADR. Until its current entry is
formally synchronized, this ADR records the latest owner correction for the
implementation repository and the conflict must remain visible.

## Integration and licensing boundary

LoRaEnergySim is GPL-3.0. The preferred packaging is a separately releasable
course-runner package or repository with its own license and source disclosure.
Leo communicates with it through documented JSON files and does not import or
link its Python modules into the React application. Vendoring the upstream
framework into the Leo source tree requires a separate license review and is
not authorized by this ADR.

## Alternatives considered

### Keep Leo fixture-first as the only student runtime

- Lowest operational risk.
- Does not satisfy the newly selected installation/edit/run laboratory
  experience by itself.
- Retained as the mandatory classroom fallback.

### Use upstream LoRaEnergySim directly

- Preserves the research project unchanged.
- Rejected because the workflow, stochastic defaults, output shape, energy
  semantics, and lack of LEO/Leo integration are unsuitable for novice
  classroom use.

### Use Contiki-NG/Cooja or FLoRa/OMNeT++

- Both provide stronger native simulator tooling and visualization.
- Rejected for this delivery because cross-platform setup, toolchain size, and
  communications-specialist concepts are materially larger than the selected
  energy-first Python runner.

### Execute student policies on the Leo server

- Would remove local installation friction.
- Rejected because accepting and executing untrusted student code creates an
  unnecessary security and operations boundary.

## Consequences

### Positive

- Students perform a real edit-run-observe loop rather than only browser
  selections.
- Endpoint energy, packet delivery, retry, sleep, and queue consequences have a
  direct IoT-energy interpretation.
- Leo's scene and evidence views remain useful and become driven by imported
  run artifacts.
- The runner and Leo can be developed in separate repositories or worktrees
  with a narrow contract, reducing merge conflicts.

### Costs and risks

- A cross-platform Python setup and recovery path must be maintained.
- LoRa endpoint-radio energy is not automatically the existing whole-system
  C-120 `consumedEnergyJ`; the adapter must preserve an explicit boundary.
- Upstream stochastic behavior must be constrained with fixed locations,
  seeds, run duration, and canonical JSON serialization.
- Course slides, speaker notes, screenshots, and the exact 120-minute cadence
  must be revised.
- The current C-120 authority documents and implementation contract are not yet
  synchronized with this decision.

## Required gates before implementation promotion

1. Owner accepts the companion SDD and revised exact-120 learner flow.
2. Controller freezes scenario/result schemas, energy boundary, and import
   mapping.
3. A representative Windows, macOS, and WSL/Linux cold-start probe completes
   setup without Docker or administrator privileges.
4. Baseline and candidate runs finish within the SDD limit and reproduce the
   same canonical JSON for the same seed and policy hash.
5. A policy change alters packet/service/endpoint-energy evidence, not only
   labels or animation.
6. Leo rejects identity, unit, schema, seed, policy-hash, and provenance
   mismatches.
7. Fixture fallback opens the same scenario in no more than two minutes.

## References

- [LoRaEnergySim upstream repository](https://github.com/GillesC/LoRaEnergySim)
- [Current C-120 planning entry](/home/u24/leo-satcom-lab/.scratch/90min-satellite-course/CURRENT-C120-HANDOFF.md)
- [C-120 server continuation](../handoff/C120-SERVER-CONTINUATION-2026-08-10.md)
- [Companion SDD](../sdd/C120-LORA-LEO-COURSE-INTEGRATION-SDD.md)
