# C-120 LoRaEnergySim + Leo next-controller handoff

Status: **READY FOR OWNER SDD REVIEW / IMPLEMENTATION NOT DISPATCHED**

Date: 2026-08-10

Leo candidate base: `f01f8efd09e1dd3088d66d9eea7f43e117029190`

## 1. Outcome for the next conversation

Continue from the accepted direction **course-packaged LoRaEnergySim + Leo**.
Do not reopen the tool-selection debate unless a preflight gate disproves a
hard assumption. The minimum release is an exact-120, Traditional-Chinese-first
course in which novice learners:

- understand why LoRaEnergySim directly serves the competition theme
  `智慧節能與物聯網應用`;
- use LEO only as the changing-service-window example;
- obtain and set up a pinned course runner without Docker/admin privileges;
- understand the purpose of every command and every permitted code edit;
- modify only the bounded `student_policy.py` decision surface;
- run baseline, candidate, and withheld experiments;
- import strict JSON evidence into Leo;
- see policy → queue/packet → radio state → endpoint energy → service causality;
- recover with the same-scenario fixture path; and
- export and reopen the Energy Decision Workbook.

No learner step may be a blind recipe. Every package action and code edit must
show `Do / Why / Mechanism / Expect / Interpret`.

## 2. Read these before any write

In precedence order:

1. [`ADR-004`](../decisions/ADR-004-c120-course-packaged-loraenergysim-leo.md)
2. [`C120-LORA-LEO-COURSE-INTEGRATION-SDD`](../sdd/C120-LORA-LEO-COURSE-INTEGRATION-SDD.md)
3. `/home/u24/leo-satcom-lab/.scratch/90min-satellite-course/CURRENT-C120-HANDOFF.md`
4. its mandatory simulator inputs, issue 11, and ADR-C-003;
5. [`C120-SERVER-CONTINUATION-2026-08-10`](C120-SERVER-CONTINUATION-2026-08-10.md)
6. repo `AGENTS.md`, `DESIGN.md`, `PRODUCT.md`, and affected source/tests.

ADR-004/SDD are the latest owner-directed amendment for installation and
bounded policy editing. The planning repository still contains the prior
no-install/no-source-edit rule, so keep the conflict visible; do not silently
claim both are current.

## 3. Mandatory preflight and stop gate

Run read-only checks first in both the intended server checkout and any local
checkout:

```bash
pwd
git status --short --branch
git rev-parse HEAD
git worktree list
tmux ls
ps -eo pid,ppid,stat,etime,pcpu,pmem,args
```

Then inspect the relevant tmux panes and exact dirty paths without interrupting
or deleting anything.

At handoff time, server `/home/sat/leo-beam-sim` has an active `leo` Codex
controller and broad dirty C-120/UI/backend WIP. `leo-web` serves Vite on port
4179. Other finished lanes still leave dirty or untracked evidence. The server
also has unrelated compute load and heavy swap usage.

**Stop before implementation** if any of the following remains true:

- an active writer owns shared C-120 paths;
- shared dirty WIP has no controller checkpoint;
- runner/result/event/freeze schema, full C-120 anchor, or endpoint accounting
  boundary is not frozen;
- the intended worker path overlaps another lane;
- a merge/pull would touch uncheckpointed WIP.

Report the exact blocker. Do not reset, stash, clean, copy over, pull into, or
commit another writer's WIP.

## 4. Contract freeze owned by GPT-5.6 Sol/ultra controller

Before launching implementation workers, the controller alone freezes:

- runner package/repository location and GPL boundary;
- `c120-lora-scenario-v1` and `c120-lora-run-result-v1` schemas;
- one `scenario_id` and content-hash lineage across TLE, runner, replay, and
  workbook;
- fixed seed, fixed location, deterministic event ordering, and runtime bound;
- endpoint-radio/processing energy as a separate Phase-1 evidence layer, with
  no mapping into current C-120 system/canonical fields;
- `C120LoraEndpointReplay` identity/materialization and its separation from
  existing `C120AuthoritativeReplay`;
- WAIT/SLEEP/wake clock, contact, deadline, and energy accounting;
- freeze receipt canonical schema and hash preimage;
- source mode, provider identity, units, claim ceiling, and fallback behavior;
- the exact student policy API and the marked lines that slides will teach:
  Lab A pace gap plus `WAIT`/`SLEEP`, Lab B enter/exit/stable hysteresis, and
  Lab C batch/urgent policy;
- `WAIT` as awake idle versus `SLEEP` as low-power rest with explicit wake
  latency/energy, all separately visible in result provenance.

Shared controller ownership includes:

```text
src/course/c120/contract.ts
src/course/c120/fixtures.ts
src/course/c120/replay.ts
src/course/c120/session.ts
src/course/c120/workbookStatus.ts
src/course/c120/C120CourseRoute.tsx
src/course/c120/C120SegmentPanels.tsx
src/course/c120/loraIntegration/**
contracts/c120-lora-v1/**
src/main.tsx
package.json
tsconfig*.json
docs/decisions/**
docs/sdd/**
docs/handoff/**
```

No worker may modify these paths.

## 5. Safe parallel lanes after the freeze

### Lane A — Luna max runner worker (non-heavy implementation)

Preferred ownership is a separate sibling package/repository such as:

```text
/home/sat/c120-lora-energy-lab/**
```

It owns setup scripts, pinned requirements, fixed scenario reader,
`student_policy.py`, deterministic LoRaEnergySim adapter, result writer,
fallback artifacts, and Python tests. It must not edit Leo, run sweeps, expose
upstream Monte Carlo to learners, or claim canonical/system energy.

### Lane B — Luna max importer worker (non-heavy implementation)

Exclusive ownership:

```text
src/course/c120/loraEnergySim/**
```

It implements strict parsers, identity/unit/hash/seed/provenance/event checks,
malicious/mismatch fixtures, and focused tests. It returns validated donor data
only. It consumes `contracts/c120-lora-v1/**` read-only and may not create
endpoint/C-120 replay, modify session/workbook or `loraIntegration/**`, or
choose any endpoint-to-system energy mapping.

### Lane C — agy / Gemini 3.1 Pro (High) (non-heavy editorial/visual)

Exclusive new deck workspace or read-only review:

```text
courseware/c120-lora-leo-deck/**
```

Good agy work:

- inventory and semantic dedup of the BeamShift 114-slide donors;
- opening 8–10-slide story/visual checkpoint;
- novice Traditional-Chinese wording;
- operation/code slide grammar and contingency branches;
- rendered-deck and browser fresh-eyes review.

Do not give agy scientific contracts, deterministic runner logic, shared C-120
state, energy mapping, or final merge authority.

## 6. Concurrency recommendation

Current safe count is **zero new implementation writers** until the active
server controller checkpoints and the server load is reassessed.

After a clean checkpoint and contract freeze:

- one GPT-5.6 Sol/ultra controller;
- at most two mutually exclusive Luna/max implementation writers;
- optionally one read-only/editorial agy lane when compute and session capacity
  permit.

Do not equate more processes with faster delivery. Two writers are the useful
maximum because the remaining critical files are controller-owned integration
seams.

## 7. Server/local split and merge order

The preferred user-aligned arrangement is:

- server: runner and importer implementation in separate branches/worktrees;
- local: ADR/SDD, donor analysis, slide production, browser/render QA, and
  controller review;
- controller: sequential shared-file integration after workers stop.

If server load stays high, Lane B may run locally only in a new worktree pinned
to the same clean base and still limited to
`src/course/c120/loraEnergySim/**`. This is an optional capacity valve, not a
license to edit the same file in two environments.

Integration order:

1. runner schema/example artifacts;
2. strict importer;
3. controller-owned `C120LoraEndpointReplay` and workbook-v3 adapter, keeping
   existing C-120 replay/system evidence separate;
4. route/session/workbook integration;
5. Leo packet/queue/radio-state visuals;
6. current screenshots and final deck production;
7. combined tests, browser evidence, novice validation, then 20-seat rehearsal.

Use path-scoped commits/patches only after explicit commit authority. Never
copy a whole dirty checkout. After each merge run `git diff --check` and focused
tests before the next lane.

## 8. Deck contract for the separate presentation conversation

Use a fresh deck workspace. Do not edit the dirty
`.scratch/c120-course-outline-pptx-wrap/**` tree.

Target:

- 64–72 core pages;
- 20–26 contingency/fast/recovery pages;
- 14–18 technical/source appendix pages;
- approximately 108 pages total, acceptable range 98–116.

The normal 120-minute path does not show every page. Extra pages are named,
timed fallback and deepening branches, not duplicate filler.

The opening must explain before satellite detail:

1. why endpoint sleep/process/TX/RX and packet outcomes are energy decisions;
2. why LoRaEnergySim exposes those consequences;
3. why this directly supports `智慧節能與物聯網應用`;
4. why LEO is a clear changing-window example, not the learning destination.

Every setup command has its own readable `action / why / expected receipt /
recovery` treatment. Every permitted code edit has line-by-line plain-language
reading, mechanism, prediction, evidence target, and falsifiable
interpretation. Include a short Python survival bridge. Do not hide these
explanations only in speaker notes.

BeamShift donors:

```text
/home/u24/papers/beamshift/e2.pptx
/home/u24/papers/beamshift/.scratch/teaching-course/v3-ee/delivery/satellite-energy-course-combined-handoff-v1.pptx
```

Use them as concept/notes donors only. Deduplicate and rewrite around endpoint
IoT energy and the current runner. Reject old T1–T6, old buttons/session
semantics, legacy EE, and filler. Preserve selected service-window, fair A/B,
W/J, evidence-boundary, TLE/provenance, and claim-classification concepts as
specified in the SDD.

Deliver separate all-Traditional-Chinese and all-English outputs if both are
needed. Do not use bilingual columns. Use a dark Leo-aligned evidence-lab
design, large text, one dominant visual, full speaker notes, original-size
render review, and at least one fix-and-reverify pass.

## 9. Controller prompts

- [Server implementation controller](../prompts/C120-LORA-LEO-SERVER-CONTROLLER.txt)
- [Presentation controller](../prompts/C120-LORA-LEO-PRESENTATION-CONTROLLER.txt)

## 10. Claim ceiling

Before novice and classroom gates, the maximum claim remains:

`COURSE-PACKAGED SIMULATED LORA ENDPOINT-ENERGY LAB INTEGRATED WITH LEO FOR BOUNDED NOVICE VALIDATION`

Do not claim classroom-ready, 20-seat pass, canonical parity, measured energy,
live satellite/network data, whole-system energy, or live backend completion.
