# C-120 course-packaged LoRaEnergySim + Leo integration SDD

Status: **DRAFT FOR OWNER REVIEW / NO IMPLEMENTATION DISPATCH YET**

Date: 2026-08-10

Decision: [`ADR-004`](../decisions/ADR-004-c120-course-packaged-loraenergysim-leo.md)

Candidate implementation base: `f01f8efd09e1dd3088d66d9eea7f43e117029190`

Implementation base must be re-pinned after the active server writer creates a
checkpoint.

## 1. Outcome

Build one exact-120, energy-first course in which a novice student:

1. obtains a prepared Python course runner;
2. verifies the environment without Docker or administrator privileges;
3. downloads or opens one Leo scenario package;
4. predicts an outcome;
5. explains why each setup action is needed and edits only a small,
   scaffolded `student_policy.py`;
6. runs deterministic baseline and candidate experiments;
7. imports the result artifact into Leo;
8. observes queue, packets, service, radio states, endpoint energy, contact and
   handover context;
9. connects each edited line to a mechanism and an expected evidence change;
10. survives a withheld condition without retuning; and
11. leaves with a reopenable Energy Decision Workbook and an IoT competition
    hypothesis that can be falsified.

The course topic is **智慧節能與物聯網應用**. LoRaEnergySim is selected because
its endpoint state and packet model can connect a policy change to sleep,
processing, TX/RX, retry, delivery, and energy consequences. LEO is the example
that supplies changing service opportunities; it is not the course's specialist
destination.

## 2. Authority, amendment, and claim ceiling

### 2.1 Preserved authority

The following remain binding unless explicitly changed in this SDD:

- energy-first, LEO-as-index learning objective;
- one scenario identity across TLE, runner, Labs A/B/C, withheld cases, Leo
  replay, and workbook;
- a fixed service boundary before comparing energy;
- W, J, bit/s, delivered bits, service, deadline, freshness, and bit/J as
  separate fields;
- no browser-side scientific producer or formula;
- learner action must change authoritative replay evidence within its declared
  layer: existing C-120 replay for current system evidence and imported
  endpoint replay for queue/packet/state/endpoint-energy evidence;
- incomplete/complete export, reopen, reset, and fallback;
- no more than eight constructed responses;
- keyboard, narrow viewport, and 20-seat recovery remain gates;
- all learner surfaces show exactly:

  `SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED`

### 2.2 Explicit amendment

The latest owner direction replaces the older blanket prohibition on package
installation and source editing:

- students install the prepared course runner;
- students edit only `student_policy.py`;
- students never edit upstream LoRaEnergySim, Leo, generated JSON, schemas, or
  scientific formulas;
- installation time is operational time, not energy-learning evidence;
- a prepared result artifact remains available if local setup fails.

### 2.3 Current conflict

`CURRENT-C120-HANDOFF.md` and issue 11 still state that students do not install
packages or edit source. The owner decision has higher precedence, but the
planning entry has not yet been synchronized. Implementation may not claim
simultaneous conformance to both versions. This SDD and ADR record the intended
replacement; a later planning-authority maintenance task must make the
supersession explicit without deleting history.

## 3. Scope

### 3.1 In scope

- pinned course wrapper around LoRaEnergySim;
- `requirements.txt` or lock file with tested versions;
- PowerShell and POSIX setup/verification commands;
- one bounded policy-editing surface;
- fixed scenario and fixed-seed runner;
- packet/queue/radio-state/endpoint-energy result artifact;
- strict Leo importer and fail-closed validation;
- Leo visual replay driven by the imported artifact;
- exact-120 learner flow, workbook binding, recovery, and fast branches;
- Traditional-Chinese-first UI and deck, with a separate English output later;
- a full slide-production specification and BeamShift donor triage;
- path-exclusive worker plan and server/local integration strategy.

### 3.2 Out of scope for the minimum course release

- training or evaluating a new ML/RL model;
- full LoRaWAN or satellite-network standards instruction;
- student modification of spreading factor, coding rate, link budget, SGP4,
  energy equations, or framework internals;
- Cooja, OMNeT++, FLoRa, Open5GS, UERANSIM, OAI, or FlexRIC installation;
- live satellite telemetry or measured classroom hardware energy;
- executing student Python on the Leo server;
- automatic download of the latest TLE during class;
- canonical parity, wall-plug energy, whole-satellite energy, or a claim that
  LoRaEnergySim validates the existing canonical producer;
- replacing the fixture fallback;
- classroom-ready or 20-seat claims before the corresponding gates pass.

## 4. Exact-120 learner flow

The previous three energy mechanisms remain, but each becomes a real
edit-run-import-observe loop. Setup starts immediately and is bounded; it does
not become an excuse to remove the causal experiments.

| Clock | Min | Segment | Student operation | Required evidence |
|---|---:|---|---|---|
| 00–05 | 5 | Why this tool | connect LoRaEnergySim directly to `智慧節能與物聯網應用`; position LEO as the worked example | learner can name the endpoint-energy decision and the evidence loop |
| 05–13 | 8 | Runner launch | obtain repo/package, create an isolated environment, install pinned dependencies, run `verify_setup`; every action includes its purpose | `READY` receipt or visible fallback provenance |
| 13–21 | 8 | Setup-independent concept bridge | after `READY` or fallback selection, distinguish sleep/wake/awake-idle/process/TX/RX, packet outcome, W, J, service and bit/J | one initial claim verdict and mission contract |
| 21–29 | 8 | Leo/TLE data anchor | inspect pinned source → model-derived NTPU contact → course traffic/energy assumptions | same `scenario_id`; legal/illegal interval selection |
| 29–50 | 21 | Lab A — Same job, different pace | read annotated code; predict; explain and edit pace/rest policy; run baseline/candidate; import; inspect awake-idle/sleep/wakeup cost | policy hash, run artifact, service/J/delivery comparison, one causal clause |
| 50–71 | 21 | Lab B — Act now or wait | explain threshold/hold/hysteresis; edit marked lines; run Trace A; freeze; execute withheld Trace B with no retune | frozen-policy receipt, switch/contact evidence, counterexample clause |
| 71–76 | 5 | Recovery reset | save workbook, verify environment/artifact, rebuild one causal chain | checkpoint and fallback/hint provenance |
| 76–99 | 23 | Lab C — Queue, batch, sleep | explain queue/deadline/batch logic; edit urgency/batch rule; run; revise once; accept surprise urgent/short window | packet ledger, queue/radio-state trace, endpoint J, delivered bits, service clause |
| 99–109 | 10 | Evidence clinic | separate decision-time input from post-action outcome; reject leakage; inspect imported result provenance | legal feature/action verdict and claim ceiling |
| 109–120 | 11 | Competition transfer and exit | map policy to smart farm/HVAC/edge/logistics; complete hypothesis/falsifier; export | complete or `INCOMPLETE` workbook, hypothesis, falsifier |
| **Total** | **120** |  |  |  |

This ten-row clock supersedes the current eight-row `C120_SEGMENTS` schedule
for the new course release. Updating segment IDs, completion migration,
workbook status, route labels, and tests is controller-owned shared-contract
work; a runner/importer worker must not change it. Existing v2 workbooks retain
their recorded segment provenance during the v3 migration.

The v3 segment IDs, in order, are:

```text
why-lora
runner-launch
endpoint-model-bridge
tle-anchor
lab-a
lab-b
recovery
lab-c
evidence-clinic
competition-transfer
```

Workbook schema/storage key becomes `c120-energy-decision-workbook-v3`. A
validated v2 import is fail-closed and deterministic:

- `status` becomes `INCOMPLETE`;
- v3 `completedSegments` and `endpointRunRecords` start empty;
- no v2 segment is silently treated as a completed v3 segment;
- a `legacyV2Provenance` record stores the canonical source-workbook SHA,
  original completed segment IDs, replay IDs/input IDs, source mode, and the
  original constructed-response key/value pairs;
- current scenario identity must still match before migration;
- the v2 artifact remains exportable/read-only, and the v3 workbook continues
  from a new checkpoint without overwriting it.

This conservative map preserves student work and provenance without claiming
that the old eight-segment activity completed the new software lab.

### 4.1 Installation recovery clock

These are class-global minutes; the runner launch begins at class minute 05:

- `05–08`: run the normal setup command while the instructor explains what the
  environment and lock protect.
- `08`: `verify_setup` must show either a precise recoverable error or `READY`;
  no silent spinner.
- `10`: instructor offers the pinned same-scenario result artifact without
  waiting for individual rescue.
- `13`: any learner still blocked switches to the same-scenario fallback in
  Leo. The runner may be retried after class, but the learner does not lose the
  course.

The eight-minute cold-start target is an unverified release gate, not a current
promise. Representative Windows, macOS, and WSL/Linux probes must decide
whether signed release ZIPs, per-platform dependency caches, or another
bounded setup aid is required. Even if setup passes, the pinned fallback
artifact remains part of the release.

### 4.2 Fast learner branch

Fast completion does not add arbitrary sliders. Each lab has one consequential
counterexample package that preserves the same policy and reveals a different
contact, awake-idle/wakeup cost, queue, or urgency condition. A fast learner predicts and
runs that package without retuning.

## 5. Student experience

### 5.1 Student-facing route

- Canonical route: `/course`
- Compatibility route: `/course/c120` redirects to `/course` without losing
  session identity.
- The course uses workbench tabs, not dozens of pseudo-slide pages and not a
  dense all-at-once dashboard.
- Proposed tabs:
  1. `準備 / Prepare`
  2. `實驗 A：節奏與休眠`
  3. `實驗 B：現在送或等一下`
  4. `實驗 C：佇列、批次與預算`
  5. `證據與 Workbook`

Each tab exposes only the current prediction, edit/run/import checkpoint, one
primary visualization, and one recovery action. Detailed provenance and
secondary metrics use progressive disclosure.

### 5.2 Student package

The preferred distribution is a separately releasable GPL-compatible package
or repository:

```text
c120-lora-energy-lab/
├── README.zh-TW.md
├── README.en.md
├── LICENSE
├── THIRD_PARTY_NOTICES.md
├── requirements.txt
├── requirements-lock.txt
├── setup.cmd
├── setup.sh
├── course.cmd
├── course.sh
├── verify_setup.py
├── student_policy.py
├── run_lab.py
├── c120_lora_lab/
│   ├── contracts.py
│   ├── engine.py
│   ├── lora_adapter.py
│   ├── policy_api.py
│   ├── result_writer.py
│   └── validation.py
├── scenarios/
├── fallback_artifacts/
├── schemas/
└── tests/
```

The Leo repository must not import these Python modules. Integration occurs by
versioned scenario and result JSON.

### 5.3 Supported setup contract

- Python target: one explicitly pinned minor version selected after the first
  compatibility spike; Python 3.11 is the initial candidate.
- Supported learner environments: Windows PowerShell, macOS Terminal, WSL or
  native Linux.
- No Docker, administrator privileges, IDE plugin, browser extension, or cloud
  login is required.
- `requirements-lock.txt` pins every transitive dependency used in the course
  release.
- PowerShell learners run `.\setup.cmd`; macOS/WSL/Linux learners run
  `bash setup.sh`. The scripts create `.venv`, install the lock, and run
  `verify_setup.py`.
- `.\course.cmd` and `bash course.sh` always invoke the `.venv` interpreter;
  learners do not rely on shell activation persisting between commands.
- `verify_setup.py` emits a machine-readable receipt and never mutates a course
  result.

### 5.4 Student-action explanation contract

The package README, slides, student quick sheet, and instructor notes must use
the same explanation for every required action. A learner must never be asked
to copy a command or change a line without knowing its role.

Every action checkpoint contains five visible fields:

1. **Do** — the exact command, file, or marked line;
2. **Why** — why this action is necessary in the experiment;
3. **Mechanism** — which environment, policy, packet, radio-state, service, or
   energy mechanism it affects;
4. **Expect** — the terminal receipt or evidence change to predict before
   executing it; and
5. **Interpret** — what a matching or surprising result means and the single
   recovery action if it fails.

The required sequence is: obtain the pinned release; create the isolated
environment; install pinned dependencies; verify provenance; inspect the fixed
scenario; read the policy API; run the untouched baseline; edit only marked
lines; run the candidate; inspect the result artifact; import into Leo; freeze
the policy; run a withheld case; export and reopen the workbook. No step may be
described only as `next`, `run this`, or `change this value`.

The following matrix is the acceptance source for package instructions. The
release URL is the only value allowed to remain unresolved during contract
freeze; it must be real before slide production.

| ID | Do | Why | Mechanism | Expect | Interpret / recover |
|---|---|---|---|---|---|
| `ACT-01` | obtain the named GitHub Release ZIP, or `git clone --branch c120-v1 <COURSE_REPOSITORY_URL>` | use the reviewed course source, not a moving branch | pins wrapper, policy API, scenarios, and license provenance | root contains README, setup scripts, lock, policy, runner, and schemas | URL is a contract-freeze blocker; `c120-v1` must resolve to an immutable release tag/commit before slides; missing/mixed files mean use the named ZIP |
| `ACT-02` | run `bash setup.sh` or `.\setup.cmd`; the slide expands its internal `python -m venv .venv` action | keep course packages separate from other Python work | creates an isolated interpreter and package location | setup reports the `.venv` stage as passed | failure is an environment issue, not energy evidence; use the OS-specific diagnostic/fallback |
| `ACT-03` | let setup install `requirements-lock.txt` with hashes | reproduce the tested dependency graph instead of taking latest packages | resolves only pinned runner dependencies | lock SHA and install stage pass | hash/version failure blocks the runner; do not remove pins during class |
| `ACT-04` | run `bash course.sh verify` or `.\course.cmd verify` if setup did not already finish it | fail before changing policy when runtime, release, or scenario is incompatible | the launcher selects `.venv`, then validates Python, wrapper, lock, policy API, and scenario schema | machine-readable `READY` receipt | any other receipt names the failed gate; at class minute 13 use same-scenario fallback |
| `ACT-05` | open `scenarios/c120-ntpu-energy-decision-01.json` read-only | separate fixed experimental conditions from student controls | exposes scenario identity, contact/quality trace, traffic, units, energy scope, and mission boundary | learner locates the same `scenario_id` shown in Leo | editing the scenario invalidates the comparison; restore it from the release |
| `ACT-06` | open only the marked region of `student_policy.py` and its generated API card | learn what can be observed and acted on without future leakage | bounds inputs, legal actions, state semantics, and editable constants | learner can paraphrase one condition and identify forbidden future fields | if the file/API version differs, stop and restore the pinned policy |
| `ACT-07` | record a queue/service/state-time/energy prediction in Leo before each run | make the result capable of confirming or falsifying a causal idea | binds an expected mechanism to later evidence | workbook stores prediction before result ID exists | an unpredicted run may be explored but cannot satisfy the causal checkpoint |
| `ACT-08` | run the exact lab baseline command in section 9.3 before editing, beginning with `bash course.sh run --lab A --case baseline` or the `.\course.cmd` equivalent | create the fair control under the same boundary | executes the inherited reviewed policy with the fixed scenario/case seed | baseline run ID, predecessor policy hash, packet/service/state/energy artifact | failure preserves no partial result; diagnose or import the matching fallback baseline |
| `ACT-09` | change only the lab-marked constant(s) or branch in `student_policy.py` | manipulate the decision rule without modifying engine or evidence | changes the content-addressed policy and action choices | a small source diff and new policy SHA | syntax/illegal action errors identify the line; restore only the marked block |
| `ACT-10A` | run `bash course.sh run --lab A --case candidate --freeze` or `.\course.cmd run --lab A --case candidate --freeze` | test the pace/rest change | executes the Lab A block while scenario and baseline boundary remain fixed | candidate diff and freeze receipt | null packet/state/energy/service evidence diff fails Lab A even if animation changed |
| `ACT-10B` | run `bash course.sh run --lab B --case trace-a-candidate --freeze` or the `.\course.cmd` equivalent | test and freeze the enter/exit/hold rule on Trace A | changes only the Lab B block on the inherited Lab A policy | Trace A diff and frozen policy SHA | any non-Lab-B edit or missing predecessor checkpoint fails before execution |
| `ACT-10C1` | run `bash course.sh run --lab C --case candidate` or the `.\course.cmd` equivalent | test the first batching/urgency prediction | changes only the Lab C block on its fixed baseline | candidate evidence diff | null queue/state/energy/service change fails the consequential-fixture gate |
| `ACT-10C2` | inspect candidate evidence and make the one allowed change in the marked Lab C block | revise a mechanism using evidence rather than random retuning | updates only `BATCH_SIZE` or `URGENT_MARGIN_S` and records the reason | one small diff and revised prediction | a second revision or non-Lab-C edit is rejected |
| `ACT-10C3` | run `bash course.sh run --lab C --case revision --freeze` or the `.\course.cmd` equivalent | evaluate and freeze the one revision before surprise | executes revised policy bytes under the same case boundary | candidate/revision diff, revision receipt, and frozen SHA | null evidence change fails Lab C; syntax error returns to `ACT-10C2` only |
| `ACT-11` | inspect `artifacts/<run_id>/result.json`, then use Leo `匯入結果` | move machine-readable evidence into Leo without executing learner code | validates schema, scenario/hash, seed, policy, units, events, and provenance | one all-or-nothing import receipt and matching replay identity | mismatch leaves the session unchanged; correct the named artifact or use same-scenario fallback |
| `ACT-12A` | run `bash course.sh run --lab A --case hidden` or the `.\course.cmd` equivalent without editing | test pace/rest under a hidden cost/window condition | requires the Lab A freeze receipt and same policy SHA | hidden replay with unchanged policy identity | changed bytes are retuning; restore the frozen file/receipt |
| `ACT-12B` | run `bash course.sh run --lab B --case trace-b` or the `.\course.cmd` equivalent without editing | test hysteresis on a withheld trace | requires the Trace A freeze receipt and same policy SHA | Trace B replay and counterexample verdict | changed bytes do not count; restore the frozen file/receipt |
| `ACT-12C` | run `bash course.sh run --lab C --case surprise` or the `.\course.cmd` equivalent without editing | test batching/urgency under the surprise event | requires the revision freeze receipt and same policy SHA | surprise replay, queue/service/energy ledger | changed bytes or a second revision do not count |
| `ACT-13` | export, close, and reopen the Energy Decision Workbook | preserve the full evidence chain rather than only a final number | serializes identity, receipts, predictions, results, recovery, and clauses | `COMPLETE` or explicit `INCOMPLETE` status reopens with the same scenario | missing evidence remains visibly incomplete; never fabricate a completion flag |

## 6. Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Leo /course                                                         │
│ pinned TLE + NTPU contact + traffic + assumptions + workbook        │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ download scenario package
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Student machine: course-packaged LoRaEnergySim                       │
│ scenario.json + student_policy.py + pinned engine + fixed seed       │
│ no server execution, no Leo imports                                  │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ result.json
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Leo strict importer                                                  │
│ schema + identity + units + seed + policy hash + provenance          │
│ mismatch => fail closed                                              │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ validated donor artifact
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Controller-owned LoRa integration                                    │
│ materializes authoritative endpoint replay; preserves C-120 replay   │
└──────────────────────────────┬───────────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Leo scene + packet/queue/radio timeline + evidence ledger + workbook │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.1 Trust boundaries

- The browser treats uploaded JSON as untrusted data.
- The browser/server never executes uploaded Python or shell commands.
- The runner only reads a schema-validated scenario package and the local
  course policy file.
- Imported results do not become a provider or authoritative replay until the
  controller-owned integration validates and materializes the endpoint replay.
- A filename, UI selection, or user-supplied label cannot override identity.

### 6.2 Two-layer replay boundary

The minimum release does **not** cast LoRa results into the existing
`C120AuthoritativeReplay` or fill its `systemPowerW`, `consumedEnergyJ`,
`energyBudgetJ`, or canonical `energyEfficiencyBitsPerJ` fields.

- Existing `C120AuthoritativeReplay` remains authoritative for current
  fixture/bundled Leo and system evidence under `c120-fixture-first-v2`.
- New `C120LoraEndpointReplay` is authoritative only for policy actions,
  queue/packet events, WAIT/SLEEP/wake/process/TX/RX state, endpoint energy,
  and endpoint service under `c120-lora-run-result-v1`.
- Both layers must echo the same C-120 scenario anchor, TLE source, target UTC,
  shared clock, claim boundary, and fixture/bundled source identity.
- Leo renders them on one clock but labels their evidence scopes separately.
- Workbook v3 stores current C-120 replay records and separate endpoint-run
  records; it never copies endpoint values into C-120 system fields.
- Phase 1 does not add a `C120ProviderKind` or pretend the imported result is a
  `canonical-adapter`; the active validated C-120 provider remains the scenario
  anchor and the endpoint artifact is a separately versioned evidence input.

Mapping any endpoint field into `C120Evidence` is a later controller-only gate,
not a Phase-1 prerequisite. This boundary keeps the minimum teaching release
useful without pretending LoRa endpoint energy is current Leo system energy.

## 7. Scenario package contract

Schema identifier: `c120-lora-scenario-v1`

The exact JSON Schema is a controller-owned `C120-LORA-00` contract-freeze
deliverable that must land before worker dispatch. The semantic fields are
fixed by this SDD:

```json
{
  "schema_version": "c120-lora-scenario-v1",
  "course_id": "C-120-ENERGY-DECISION-1R",
  "runner_contract_version": "c120-lora-leo-v1",
  "scenario_id": "c120-ntpu-energy-decision-01",
  "scenario_sha256": "<sha256>",
  "c120_anchor_sha256": "<sha256>",
  "source_mode": "bundled",
  "target_utc": "2026-08-09T04:00:00Z",
  "tle_source_id": "oneweb-0314-archive-2026-08-08",
  "c120_anchor": {
    "course_id": "C-120-ENERGY-DECISION-1R",
    "contract_version": "c120-fixture-first-v2",
    "provider_kind": "fixture",
    "provider_id": "c120-fixture-provider",
    "fixture_id": "c120-energy-decision-fixture",
    "fixture_version": "c120-energy-decision-fixture-v2",
    "scenario_id": "c120-ntpu-energy-decision-01",
    "source_mode": "bundled",
    "tle_source_id": "oneweb-0314-archive-2026-08-08",
    "target_utc": "2026-08-09T04:00:00Z",
    "claim_boundary": "SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED",
    "claim_levels": [
      "SIMULATED_TEACHING_DATA",
      "NOT_LIVE",
      "NOT_MEASURED",
      "NOT_CANONICAL_PARITY_VERIFIED"
    ],
    "units": {
      "elapsedTime": "s",
      "activeTime": "s",
      "deadline": "s",
      "freshness": "s",
      "power": "W",
      "consumedEnergy": "J",
      "energyBudget": "J",
      "rate": "bit/s",
      "deliveredData": "bit",
      "energyEfficiency": "bit/J",
      "angle": "deg",
      "distance": "km",
      "quality": "teaching-band"
    }
  },
  "runner": {
    "upstream_repository": "https://github.com/GillesC/LoRaEnergySim",
    "upstream_commit": "f854462cda0cd30cb56e3f0c576cb004711842f6",
    "wrapper_version": "c120-lora-runner-v1",
    "seed": 12001
  },
  "units": {
    "time": "s",
    "power": "W",
    "energy": "J",
    "data": "bit",
    "rate": "bit/s"
  },
  "clock": {
    "step_s": 0,
    "duration_s": 0
  },
  "contact_windows": [],
  "quality_band_trace": [],
  "traffic_cards": [],
  "endpoint_energy_profile": {
    "scope": "endpoint-radio-and-processing-course-assumptions",
    "sleep_power_w": 0,
    "awake_idle_power_w": 0,
    "process_power_w": 0,
    "tx_power_w": 0,
    "rx_power_w": 0,
    "wake_energy_j": 0,
    "wake_latency_s": 0
  },
  "mission_contract": {},
  "claim_boundary": "SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED"
}
```

### 7.1 Required invariants

- `scenario_sha256` is computed over canonical JSON with the hash field
  excluded.
- `c120_anchor` is exported by the active validated C-120 provider and must
  exactly match current `C120ScenarioIdentity`; the runner only echoes it and
  cannot synthesize or relabel it.
- Runner units and the full C-120 anchor units are validated separately. Equal
  unit strings do not make endpoint fields equivalent to C-120 system fields.
- `c120_anchor_sha256` is SHA-256 over RFC 8785 canonical `c120_anchor` bytes.
  `scenario_sha256` is SHA-256 over RFC 8785 canonical scenario bytes with only
  `scenario_sha256` excluded; therefore it includes the anchor and anchor hash.
- `scenario_id`, `target_utc`, TLE source, contact windows, traffic, units,
  energy profile, mission boundary, and seed are immutable during a run.
- Fixed node locations replace upstream random location generation.
- Contact windows are model/course inputs; LoRaEnergySim must not claim they
  came from its native model.
- A package with an unknown field, missing field, unsupported unit, duplicate
  packet/card ID, invalid time ordering, or non-finite numeric value is
  rejected.

The zero values above document shape only; release scenarios must supply
positive, reviewed course assumptions where the schema requires them. The
scenario contract also freezes these semantics before runner work begins:

- `clock.step_s` is the shared decision/event sampling interval;
- `quality_band_trace` is an ordered, timestamped course input using a small
  novice-facing ordinal set; it is not a browser calculation or a native
  LoRaEnergySim claim;
- `stable_steps` counts consecutive past/current steps meeting the applicable
  entry condition;
- `send_mode_active` is policy state derived only from prior legal actions and
  the current contact/exit condition; it resets when contact closes or quality
  falls below the exit threshold;
- `steps_since_send` counts completed steps since the last send action;
- `WAIT` consumes `awake_idle_power_w` and can act again next step;
- `SLEEP` consumes `sleep_power_w`; the next active action incurs declared
  `wake_energy_j` and `wake_latency_s`;
- process/TX/RX time and power follow the pinned wrapper mapping, with every
  course-added assumption labeled in provenance;
- withheld traces are immutable scenario cases with their own case ID and
  seed role, but the same `scenario_id` and frozen policy hash.

### 7.2 Record families frozen before worker dispatch

The controller produces exact JSON Schemas and fixtures before runner/importer
workers start. At minimum they contain these required record families:

Controller-owned machine-readable contract path:

```text
contracts/c120-lora-v1/
├── scenario.schema.json
├── result.schema.json
├── freeze-receipt.schema.json
├── endpoint-replay.schema.json
├── workbook-v3-extension.schema.json
├── canonicalization.md
└── golden/
```

Workers consume this directory read-only. The runner release carries an exact
hash-verified copy; the TypeScript importer validates against the same schema
version and golden corpus. A worker may add lane-local malicious test inputs
but may not change the shared schemas or golden valid artifacts.

| Record | Required semantic fields |
|---|---|
| contact window | unique `contact_id`, satellite/source ID, inclusive start, exclusive end, legal quality-trace ID, optional handover target ID |
| quality point | ordered `elapsed_s` aligned to `clock.step_s`, `contact_id`, integer novice band from the frozen ordinal set |
| traffic card | unique packet/card ID, class (`normal`/`urgent`), generated time, deadline, freshness limit, positive payload bits, destination/gateway ID |
| mission contract | evaluation end, required packet IDs or minimum unique delivered bits, deadline/freshness rules, maximum allowed expiry; energy is reported separately and cannot silently change service pass |
| case | unique case ID, lab/role, seed role, referenced contact/quality/traffic sets, expected predecessor/freeze role, withheld flag |

Result `events` are a discriminated union. Every event has an event ID, stable
index, type, start/end time, case/policy identity, contact/quality snapshot,
affected packet IDs, state/action, event endpoint J, and cumulative endpoint J.
Allowed event types are frozen from:

`POLICY_DECISION`, `MODE_CHANGE`, `STATE_INTERVAL`, `WAKE`,
`PACKET_GENERATED`, `PACKET_ATTEMPT`, `PACKET_COLLISION`, `PACKET_RETRY`,
`PACKET_DELIVERED`, and `PACKET_EXPIRED`.

Type-specific schema rules prohibit irrelevant fields. Summary service,
deadline, freshness, delivered bits, rate, state duration, and energy
breakdowns are produced by the Python runner and must reconcile with the event
ledger. The browser displays validated values and never derives a new
scientific result from these events.

## 8. Student policy API

The policy file is deliberately small and domain-focused. It has three clearly
marked lab blocks; a learner edits only the active block. The full function is
read and explained, but branch reordering is not part of the minimum release.

```python
# Lab A: pacing and the energy difference between awake wait and sleep
PACE_GAP_STEPS = 2
REST_DURING_GAP = SLEEP  # legal values: WAIT or SLEEP

# Lab B: enter, hold, and exit a send-ready mode
ENTER_QUALITY = 2
EXIT_QUALITY = 1
STABLE_STEPS = 2

# Lab C: batching versus an urgent deadline
BATCH_SIZE = 3
URGENT_MARGIN_S = 20

def choose_action(observation):
    if not observation.contact_open:
        return SLEEP
    if (
        observation.urgent_pending
        and observation.urgent_due_in_s <= URGENT_MARGIN_S
    ):
        return SEND_URGENT
    if observation.steps_since_send < PACE_GAP_STEPS:
        return REST_DURING_GAP
    if observation.send_mode_active:
        quality_ready = observation.quality_band >= EXIT_QUALITY
    else:
        quality_ready = (
            observation.quality_band >= ENTER_QUALITY
            and observation.stable_steps >= STABLE_STEPS
        )
    if quality_ready:
        return FLUSH_BATCH if observation.queue_size >= BATCH_SIZE else SEND_ONE
    return WAIT
```

The published file contains type-safe symbols, comments, and guarded examples.
Students do not type string action names or import internal engine modules.

Policy development is cumulative but bounded. Lab A starts from the release
default. Lab B starts from the accepted Lab A policy and unlocks only the Lab B
block. Lab C starts from the frozen Lab B checkpoint and unlocks only the Lab C
block. The runner records each predecessor policy SHA and rejects edits outside
the active block. Thus later labs build a real policy without making an earlier
comparison silently change.

### 8.1 Allowed observation fields

- elapsed time;
- contact open/closed;
- friendly quality band;
- stable-step count;
- send-mode active state derived from past/current legal state only;
- steps since the last send;
- time until contact closes;
- queue length and message classes;
- whether an urgent message is pending;
- earliest urgent deadline;
- previous action.

Endpoint energy remaining is not a core v1 observation. It may be added only
as a separately reviewed endpoint-only advanced case; it must never imply
access to canonical system energy or future consumption.

Post-action delivery, future contact, final service, future collision, and
future energy are not available to the policy.

### 8.2 Allowed actions

- `SLEEP`
- `WAIT`
- `SEND_ONE`
- `SEND_URGENT`
- `FLUSH_BATCH`

Invalid return values fail with a student-facing line number and legal-action
list. The engine does not silently replace them.

`WAIT` means awake idle: higher idle power but no wake transition before the
next decision. `SLEEP` means low-power rest: lower state power but a declared
wake energy and latency before the next active action. These are distinct
runner states and distinct result fields, not UI synonyms.

### 8.3 Code-teaching contract

The code edit is a mechanism lesson, not a typing exercise. Before each lab,
the deck and package show:

- the observation fields used by the highlighted lines;
- a line-by-line plain-language reading of the condition and returned action;
- which marked constant the learner may change;
- why that change should alter wait/send/batch/sleep behavior;
- a prediction for queue, packet/service, state time, and endpoint energy;
- the evidence panel that can confirm or falsify the prediction;
- one common syntax or logic error and how to recover without replacing the
  learner's whole file.

The core deck includes a short Python survival bridge for constants,
comparisons, Boolean conditions, indentation, function input, and return
values. It does not turn the course into a general Python class and it does not
hide the code explanation in speaker notes alone.

The first policy API uses the following teaching map. Directional effects are
hypotheses to test, not guaranteed outcomes:

| ID / marked code | Do | Why / mechanism | Expect before run | Interpret / recover |
|---|---|---|---|---|
| `A-PACE`: `PACE_GAP_STEPS` | change only the marked integer | controls the minimum spacing between sends | a larger gap changes send timing and rest duration; service may improve or fail depending on the window | inspect attempts, queue age, contact remaining, state time, endpoint J; null diff means the fixture is not consequential |
| `A-REST`: `REST_DURING_GAP` | choose the typed `WAIT` or `SLEEP` symbol | trades awake responsiveness for lower state power plus wake cost/latency | `SLEEP` should move time from awake idle to sleep and add wake evidence | compare awake-idle/sleep/wake J and deadline/service; illegal strings fail on the marked line |
| `B-ENTER`: `ENTER_QUALITY` | change the send-mode entry band | delays or advances entry into send-ready mode | higher entry should reduce marginal entries but may miss short opportunities | inspect mode entry, waits, attempts, service, and endpoint J; direction is not guaranteed |
| `B-EXIT`: `EXIT_QUALITY` | change the lower band that keeps an active send mode | creates hysteresis between entry and exit | a lower exit may reduce mode chatter but remain active in weaker quality | inspect mode transitions, retries/delivery, contact remaining, and state time |
| `B-HOLD`: `STABLE_STEPS` | change required consecutive entry steps | rejects brief quality spikes before entering send mode | a longer hold should reduce short-lived entries and may delay service | inspect stability counter, first entry, missed window, service, and endpoint J |
| `C-BATCH`: `BATCH_SIZE` | change only the marked positive integer | trades fewer activations for queue delay | a larger batch may reduce TX/wake events while increasing message age | inspect queue age, activations, delivered/expired packets, and endpoint J |
| `C-URGENT`: `URGENT_MARGIN_S` | change the marked seconds threshold | decides when an urgent deadline overrides normal pacing/batching | a larger margin should send urgent traffic earlier and may spend energy sooner | inspect urgent send time, deadline/freshness, TX/RX/wake time, endpoint J |

## 9. Runner design

### 9.1 Upstream usage

The wrapper reuses bounded LoRaEnergySim concepts/components for endpoint
state, packet transmission, gateway delivery, collision/retry behavior, and
energy tracking. It must not expose upstream `GlobalConfig.py`, the default
1000-run Monte Carlo loop, uncontrolled multiprocessing, random location
generation, pickle output, or Pycharm source-root setup to students.

### 9.2 Determinism

- fixed locations from the scenario;
- one fixed seed per baseline/candidate/withheld case;
- seed Python and NumPy random sources explicitly;
- sequential execution by default;
- no wall-clock time, hostname, absolute path, locale, or unordered map in the
  canonical result;
- stable sorting for nodes, packets, events, and warnings;
- canonical JSON serialization;
- same scenario + same runner + same policy bytes + same seed produces the
  same result bytes.

#### 9.2.1 WAIT/SLEEP/wake clock and accounting

The runner, not the browser, applies these exact rules:

1. Each policy decision occurs at an event time on the shared scenario clock.
2. `WAIT` occupies one `clock.step_s` as awake idle. Its energy is
   `awake_idle_power_w × step_s`; the next decision needs no wake transition.
3. `SLEEP` occupies one step at `sleep_power_w`. Consecutive sleep steps do not
   charge repeated wake energy.
4. The first later process/send action creates a separate `WAKE` event before
   that action. It advances the shared clock by `wake_latency_s` and adds the
   declared lump-sum `wake_energy_j`; no other state energy is double-counted
   during that event.
5. Wake latency consumes contact time and affects packet deadline/freshness. If
   contact closes before wake completes, the send is not attempted, the wake
   cost remains spent, and the event records `wake-missed-contact`.
6. A final sleep with no later active action incurs no wake cost. `WAIT` never
   incurs wake cost. In the core policy, contact closed permits only `SLEEP`.
7. Process/TX/RX events begin only after a successful wake, have positive
   duration, and use their declared state powers. Events never overlap.
8. Endpoint total J must equal the exact sum of sleep, awake-idle, wake,
   process, TX, and RX breakdowns within the schema tolerance. State time,
   queue/packet events, deadlines, and the final summary must all reconcile.

`WAKE` is therefore an explicit result event and visible replay state. An
importer worker may validate these invariants but may not change the rules or
map their energy into C-120 system evidence.

### 9.3 Learner CLI contract

The learner-visible command surface is fixed and intentionally small. The
examples below use POSIX `bash course.sh`; on Windows, replace that prefix with
`.\course.cmd`. Neither launcher depends on a persistently activated shell:

```text
bash course.sh verify

bash course.sh run --lab A --case baseline
bash course.sh run --lab A --case candidate --freeze
bash course.sh run --lab A --case hidden

bash course.sh run --lab B --case trace-a-baseline
bash course.sh run --lab B --case trace-a-candidate --freeze
bash course.sh run --lab B --case trace-b

bash course.sh run --lab C --case baseline
bash course.sh run --lab C --case candidate
bash course.sh run --lab C --case revision --freeze
bash course.sh run --lab C --case surprise
```

`--freeze` creates a content-addressed receipt. Every hidden/trace-b/surprise
case requires the expected receipt and refuses changed policy bytes. Commands,
case names, output paths, and line numbers become release API: changing them
requires synchronized package, quick-sheet, slide, screenshot, and test
updates.

Freeze receipt schema: `c120-lora-freeze-receipt-v1`.

```json
{
  "schema_version": "c120-lora-freeze-receipt-v1",
  "scenario_id": "c120-ntpu-energy-decision-01",
  "scenario_sha256": "<sha256>",
  "c120_anchor_sha256": "<sha256>",
  "lab_id": "B",
  "frozen_case_id": "trace-a-candidate",
  "active_block_id": "lab-b-enter-exit-hold",
  "policy_api_version": "c120-student-policy-v1",
  "policy_sha256": "<sha256>",
  "predecessor_policy_sha256": "<sha256>",
  "upstream_commit": "f854462cda0cd30cb56e3f0c576cb004711842f6",
  "wrapper_version": "c120-lora-runner-v1",
  "lock_sha256": "<sha256>",
  "seed_role": "lab-b-trace-a",
  "seed": 12002,
  "canonicalization": "RFC8785",
  "receipt_sha256": "<sha256>"
}
```

`run_id` is `sha256:<hex>` over RFC 8785 canonical result bytes with only the
`run_id` field excluded. The preimage therefore includes scenario/anchor
hashes, lab/case/seed, runner/lock, policy/predecessor/freeze identity, units,
summary, breakdown, events, warnings, and claim boundary. A result import is
valid only while Leo has an active validated scenario provider whose canonical
identity hash equals `c120_anchor_sha256` and whose exported scenario hash
equals `scenario_sha256`; filename and UI selection never supply identity.

`receipt_sha256` covers the RFC 8785 canonical JSON bytes of every field above
except itself. Timestamp, path, hostname, username, locale, and display labels
are forbidden from the preimage. The file name is
`artifacts/receipts/<receipt_sha256>.json`. Baselines have no freeze receipt;
candidate/revision results that use `--freeze` embed the new receipt hash, and
withheld results must echo that hash plus identical policy bytes.

### 9.4 Runtime budget

- `verify_setup`: target <= 5 seconds after installation;
- one baseline or candidate run: target <= 20 seconds, hard gate <= 60 seconds
  on the lowest supported classroom machine;
- import and validation: target <= 2 seconds;
- no class activity relies on long Monte Carlo sweeps.

### 9.5 Result artifact

Schema identifier: `c120-lora-run-result-v1`

```json
{
  "schema_version": "c120-lora-run-result-v1",
  "scenario_id": "c120-ntpu-energy-decision-01",
  "scenario_sha256": "<sha256>",
  "c120_anchor_sha256": "<sha256>",
  "run_id": "<content-addressed-id>",
  "lab_id": "A",
  "case_id": "candidate",
  "run_role": "candidate",
  "seed": 12001,
  "runner_provenance": {
    "upstream_commit": "f854462cda0cd30cb56e3f0c576cb004711842f6",
    "wrapper_version": "c120-lora-runner-v1",
    "python_version": "3.11.x",
    "lock_sha256": "<sha256>"
  },
  "policy": {
    "policy_sha256": "<sha256>",
    "predecessor_policy_sha256": "<sha256-or-null>",
    "freeze_receipt_sha256": "<sha256-or-null>",
    "active_block_id": "lab-a-pace-rest",
    "policy_api_version": "c120-student-policy-v1"
  },
  "energy_scope": "endpoint-radio-and-processing-course-assumptions",
  "units": {
    "time": "s",
    "power": "W",
    "energy": "J",
    "data": "bit",
    "rate": "bit/s",
    "endpoint_energy_efficiency": "bit/J"
  },
  "summary": {
    "generated_packets": 0,
    "attempted_packets": 0,
    "unique_delivered_packets": 0,
    "delivered_bits": 0,
    "collisions": 0,
    "retransmissions": 0,
    "expired_packets": 0,
    "deadline_pass": false,
    "freshness_status": "not-applicable",
    "rate_bits_per_s": 0,
    "active_time_s": 0,
    "wake_count": 0,
    "endpoint_energy_j": 0,
    "endpoint_energy_efficiency_bits_per_j": 0,
    "service_pass": false
  },
  "energy_breakdown_j": {
    "sleep": 0,
    "awake_idle": 0,
    "wake": 0,
    "process": 0,
    "tx": 0,
    "rx": 0
  },
  "events": [],
  "warnings": [],
  "claim_boundary": "SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED"
}
```

### 9.6 Energy semantics

- Upstream internal mJ values are converted to J inside the Python wrapper and
  recorded with provenance.
- Wrapper-added awake-idle and wake transition values use only the frozen
  scenario assumptions and remain separately labeled; they are not attributed
  to native upstream measurement.
- Do not use upstream `Node.energy_per_bit()` as the C-120 headline result; it
  divides by sent packet bits and does not establish delivered service under
  the course boundary.
- The result exports endpoint component energy and delivered bits separately.
- The runner may additionally export
  `endpoint_energy_efficiency_bits_per_j = unique delivered bits /
  endpoint_energy_j` over the frozen mission evaluation window. It also
  exports the numerator, denominator, window, and service verdict; Leo labels
  the ratio `endpoint bit/J`, never canonical `bit/J`.
- `rate_bits_per_s` uses unique delivered bits divided by the same frozen
  mission evaluation duration. Deadline/freshness/service are evaluated from
  traffic-card and mission-contract fields, not inferred from the ratio.
- Only the controller-owned adapter may decide whether and how endpoint energy
  becomes an input to the existing course/system `consumedEnergyJ`.
- The browser never calculates a new ratio.
- Until the adapter mapping passes its declared boundary gate, Leo labels the
  imported value `endpoint energy` and does not present it as canonical course
  energy or canonical bit/J.

## 10. Leo importer and two-layer replay

### 10.1 New isolated module

Proposed path:

```text
src/course/c120/loraEnergySim/
├── scenarioContract.ts
├── resultContract.ts
├── freezeReceiptContract.ts
├── resultImporter.ts
├── provenance.ts
├── fixtures/
└── *.test.ts
```

This entire directory is the importer worker's maximum ownership. It may read
current C-120 types but may not cast external data into
`C120AuthoritativeReplay`, create replay frames, or write session/workbook
state directly.

Controller-owned integration uses a separate path:

```text
src/course/c120/loraIntegration/
├── endpointReplayContract.ts
├── endpointReplayAdapter.ts
├── sessionExtension.ts
├── workbookExtension.ts
└── *.test.ts
```

The minimum adapter creates `C120LoraEndpointReplay`, not
`C120AuthoritativeReplay`. It verifies the current provider's full
`C120ScenarioIdentity` against `c120_anchor`, binds every endpoint frame to the
result/policy/case/seed/freeze identity, and synchronizes the already-produced
event clock with the current Leo scene. It does not calculate scientific
metrics in the browser.

### 10.2 Validation order

1. byte/size and JSON parse gate;
2. exact schema and unknown-field gate;
3. scenario ID and scenario hash gate;
4. runner/upstream/wrapper/lock gate;
5. lab/case/seed, policy API/hash/predecessor, and freeze-receipt gate;
6. units, finite numbers, non-negative values, and sum-consistency gate;
7. event time ordering and packet identity gate;
8. contact-window and action legality gate;
9. claim boundary and energy-scope gate;
10. controller-owned endpoint replay materialization;
11. current C-120 anchor plus workbook-v3 endpoint-record validation.

Any failure preserves the current session, displays one actionable message,
and offers the same-scenario fixture fallback. It never partially imports.

### 10.3 Consequential replay requirement

The student policy hash, predecessor, case, seed, and freeze receipt become the
endpoint replay input identity. `endpointReplayId` is content addressed over
the validated result. The IDs are defined as follows:

- `endpointReplayInputId = sha256:` of RFC 8785 canonical
  `{ contract_version, c120_anchor_sha256, scenario_sha256, lab_id, case_id,
  seed, policy_sha256, predecessor_policy_sha256,
  freeze_receipt_sha256 }`;
- `endpointReplayId = sha256:` of RFC 8785 canonical
  `{ endpoint_replay_contract_version, endpointReplayInputId, run_id,
  c120_anchor_sha256, scenario_sha256 }`.

The ID fields themselves are excluded from their own preimages. Contract
version for the first release is `c120-lora-endpoint-replay-v1`. After identity
validation, at least one legal policy change in each lab must alter at least
one of:

- service pass, deadline or freshness;
- packet delivered/expired state;
- retry/collision count;
- endpoint energy breakdown or total;
- queue and active/sleep duration;
- WAIT/SLEEP/wake/process/TX/RX state duration or event sequence.

Animation without an evidence change fails the gate.

## 11. Leo visual and interaction specification

### 11.1 Visual language

- preserve the original blue-black Leo identity;
- deep navy surfaces, teal action, amber boundary/provenance warning, red
  invalid/fail state;
- body text >= 18 px, primary controls >= 44 px;
- one dominant work surface per tab;
- no light warm redesign, tiny dashboard labels, repeated card grids, or
  pseudo-presentation next/next questioning;
- Traditional Chinese is primary; English uses the existing switch and the
  same information hierarchy.

### 11.2 Required visual layers

1. **NTPU/LEO scene** — satellite/contact/handover state from the same scenario.
2. **Queue strip** — message cards ordered by generated time, class, and
   deadline.
3. **Packet events** — attempt, delivered, collision/retry, expired, not sent.
4. **Endpoint radio-state ribbon** — sleep, wake, awake idle, process, TX, and
   RX across the shared clock.
5. **Contact/quality band** — legal send opportunities and withheld changes.
6. **Cumulative endpoint energy** — source-labeled, not silently mapped to
   whole-system energy.
7. **Evidence ledger** — baseline/candidate/withheld with fixed boundary and
   visible provenance.
8. **Workbook checkpoint** — policy hash, scenario, run, hint/fallback, verdict.

### 11.3 Progressive disclosure

The initial result view shows only:

- did endpoint service pass under the frozen mission contract;
- what happened to the queue/packets;
- endpoint energy change;
- why the policy caused it.

Retries, per-state energy, rate, delivered bits, canonical fields, hashes, and
source detail expand on demand. They are not rendered as a wall of small text.

## 12. Workbook and response budget

The maximum remains eight constructed responses:

1. initial energy claim;
2. Lab A causal clause;
3. Lab B counterexample clause;
4. recovery causal reconstruction;
5. Lab C service/energy clause;
6. evidence-clinic claim boundary;
7. competition hypothesis;
8. falsifier.

The workbook auto-records:

- setup receipt/fallback;
- scenario and runner identity;
- policy hash and changed marked lines;
- baseline/candidate/withheld result IDs;
- units, energy scope, service and packet evidence;
- hints, invalid actions, recovery, and instructor rescue;
- incomplete/complete status.

Controller integration bumps the workbook schema to v3 only after migration
tests. Existing C-120 `replayRecords` remain unchanged. A separate
`endpointRunRecords` collection stores, for each imported endpoint replay:

- `lab_id`, `case_id`, result ID, and endpoint replay ID;
- scenario/result hashes and the full C-120 anchor digest;
- policy API, current/predecessor policy hashes, active block, and freeze
  receipt hash;
- runner/upstream/wrapper/lock provenance and case seed role;
- endpoint energy scope, service/packet summary, fallback/hint provenance, and
  claim boundary.

A v2 workbook may migrate to v3 with an empty endpoint collection and remains
`INCOMPLETE`; migration never invents imported runs or completion. Workbook
identity continues to use the validated current C-120 scenario/provider anchor,
while endpoint records keep their separate contract version and evidence
scope.

The exact v3 TypeScript/JSON shape, storage validator, and malicious/mismatch
fixtures are controller-owned `C120-LORA-00` outputs. They must exist before an
importer or UI implementation worker is dispatched.

## 13. Presentation production specification

### 13.1 Narrative promise

The deck must open by answering three questions before any satellite detail:

1. Why is an IoT endpoint an energy-decision problem?
2. Why does the course-packaged runner make sleep/wake/awake-idle/process/TX/RX,
   packet delivery, retry, and energy observable, while labeling wrapper-added
   assumptions?
3. Why use LEO? Because a moving service window creates a clear send/wait,
   batch/sleep, and service-versus-energy trade-off—not because students are
   training as satellite engineers.

The competition framing appears on slides 2–4, not only at the end:

`state/data → policy → packet/service consequence → power × time → energy → evidence → transferable IoT idea`

### 13.2 Deliverable size

Target one reusable deck workspace with three layers. Slide count is teaching
capacity, not a requirement to show every page in the normal path:

| Layer | Target slides | Use |
|---|---:|---|
| Core exact-120 path | 64–72 | normal lecture, fully explained setup/code, labs, debrief, transfer |
| Contingency/fast-path bank | 20–26 | OS/setup failure, Python recovery, fast experiments, import/scene failure, causal deepening |
| Technical/source appendix | 14–18 | selected TLE, SINR, power/energy boundary, code/API, provenance and citations |
| **Expected total** | **98–116** | target approximately 108; not all slides are shown in the normal path |

Superseded sizing history: earlier 32–40 and 70–84 proposals did not allocate
enough readable pages to explain each package action and permitted code edit.
The current 98–116 contract replaces them. The extra slides split dense
procedures, code, mechanisms, predictions, results, and recovery into readable
beats and provide a meaningful lecture fallback; they are not duplicate
title/bullet pages.

### 13.3 Core slide map

| Slides | Purpose | Required visual/action |
|---|---|---|
| 1–5 | competition opening and why LoRaEnergySim | endpoint energy story; state/packet observability; what the simulator can and cannot prove |
| 6–8 | why LEO is only the example and course route | moving service window; LEO-to-IoT transfer; exact-120/recovery map |
| 9–16 | setup with reasons | obtain release, folder map, virtual environment, pinned dependencies, OS command, `READY` receipt, failure meaning, fallback gate |
| 17–21 | setup-independent model bridge | fixed/controlled/observed variables; sleep/wake/awake-idle/process/TX/RX; packet lifecycle; service boundary; evidence loop |
| 22–25 | Python survival bridge | constants; comparisons/Boolean logic; indentation; observation → action → return |
| 26–30 | claim detective and TLE-to-NTPU | W vs J; fair baseline; source/model/assumption lineage; same scenario; legal interval |
| 31–39 | Lab A | question; annotated code; mechanism; prediction; baseline; candidate edit; run/import; hidden condition; causal debrief |
| 40–49 | Lab B | question; threshold/hold/hysteresis; annotated code; Trace A; run; freeze reason; Trace B; evidence; counterexample; debrief |
| 50–51 | recovery | save/reopen; same-scenario fallback and causal reconstruction |
| 52–62 | Lab C | queue/deadline; batch/urgent mechanism; annotated code; baseline; prediction; edit/run; packet/radio evidence; revision; withheld event; ledger; debrief |
| 63–66 | evidence clinic | available-now vs leakage; artifact provenance; prediction versus result; bounded claim |
| 67–70 | transfer and exit | smart-farm/HVAC/edge remap; hypothesis; falsifier; export/reopen |

The final production controller may shift slide numbers within the target range
but may not remove the opening LoRa/competition rationale, the setup/code
explanations, the three complete policy loops, or the contingency bank.

The appendix uses new-deck IDs rather than core slide numbers:

| New appendix IDs | Topic | Source role |
|---|---|---|
| `APP-01`–`APP-03` | LoRaEnergySim boundary, pinned upstream, wrapper changes | distinguish reused model, course assumptions, and unverified claims |
| `APP-04`–`APP-06` | policy API and runner/result schemas | instructor/code recovery; not required derivation |
| `APP-07`–`APP-09` | endpoint state energy, W/J/bit/J, endpoint versus system | evidence-boundary deepening |
| `APP-10`–`APP-12` | TLE, SGP4, source/model/assumption lineage | provenance deepening without satellite-specialist assessment |
| `APP-13`–`APP-15` | selected quality/SINR/dB interpretation | optional vocabulary support only |
| `APP-16`–`APP-18` | citations, licenses, field glossary, claim classification | source and recovery reference |

The release selects 14–18 of these appendix pages without renumbering the core
or contingency branches.

### 13.4 Action and code slide grammar

Each package action receives at least one readable slide or a linked pair; no
slide may compress multiple unfamiliar commands into a terminal screenshot.

**Operation slide:** one large command or file action, a plain-language `why`,
the environment/data mechanism it changes, the expected receipt, what that
receipt means, and one recovery path. Environment actions explicitly explain
isolation, reproducibility, and provenance instead of claiming they directly
save energy.

**Code slide pair:** the first slide reads no more than 3–6 highlighted lines
in plain language; the second connects the allowed edit to a predicted policy,
packet/service, state-time, and endpoint-energy consequence. Syntax and
scientific meaning are visually separated.

**Result slide pair:** the first shows the current Leo/terminal evidence; the
second traces `edited line → chosen action → packet/queue event → radio state
time → endpoint energy → service verdict`. The learner must predict before the
answer is revealed.

**Recovery slide:** shows the exact error, why it occurred, what remains valid,
and the smallest recovery action. It never asks the learner to replace the
whole repository blindly.

The same terminology and line numbers must match the released
`student_policy.py`. Any code change after screenshots are captured invalidates
the affected slides until they are regenerated and rechecked.

### 13.5 BeamShift 114-slide donor policy

Candidate donors:

- `/home/u24/papers/beamshift/e2.pptx` — 114 slides with speaker notes;
- `/home/u24/papers/beamshift/.scratch/teaching-course/v3-ee/delivery/satellite-energy-course-combined-handoff-v1.pptx`
  — 114-slide delivery variant.

They have matching chapter order but different bytes. Use `e2.pptx` as the
content/notes donor and the delivery file as a visual/provenance comparison.
Do not concatenate either deck into the new deck and do not clone their
structure as the new house style.

#### Adapt into core or contingency

- BeamShift donor `e2.pptx` slides 2, 4–6: changing link/service window and
  handover opportunity;
- BeamShift donor slide 12: switch too slowly versus ping-pong;
- BeamShift donor slides 14, 16/17: throughput, power, and energy distinction;
  collapse the
  duplicate 16/17 concept;
- BeamShift donor slides 19–21: service reactions, same window, and accounting
  boundary;
- BeamShift donor slides 36–39: fair A/B comparison and the
  control-to-evidence causal chain;
- BeamShift donor slides 70–75: evidence qualification and why one energy number is
  insufficient;
- BeamShift donor slides 96–97: claim boundary and evidence record;
- BeamShift donor slide 113: measured/derived/assumed/simulated
  classification.

These are topic donors only. Rewrite them around endpoint IoT energy, the new
student policy, current screenshots, current units, and the current claim
ceiling.

#### Appendix only after simplification

- BeamShift donor slides 7–10 and 98–110: selected TLE/SGP4/coordinate
  concepts;
- BeamShift donor slides 13, 15, 22–35, 111–114: selected SINR, dB, PA, angle,
  system-boundary, and source-detail material.

At most one concept per slide survives. Do not require these derivations for
student completion.

#### Reject as current course semantics

- BeamShift donor slides 40–69 and 76–95: old buttons, T1–T6 operations,
  observation tables, producer states, and old workflow;
- any slide that teaches old stage/session semantics, legacy browser EE, or a
  result not generated by the new scenario/runner/import path;
- duplicated formulas, repeated blank/filled tables, and satellite-specialist
  material used only to increase page count.

### 13.6 Contingency bank

The deck must include pre-authored branches with explicit clocks:

1. **Setup/OS failure branch (5–6 slides, exactly 8 min):** unpack the repo, explain
   environment isolation and pinned dependencies, read the policy, diagnose a
   representative error, inspect a valid artifact, switch to same-scenario
   fallback.
2. **Python/code recovery branch (3–4 slides, 8–12 min):** read indentation,
   comparison, legal action, and traceback examples; repair one marked line and
   connect it back to the intended mechanism.
3. **Runner finishes early (4–5 slides, 8–10 min):** freeze the policy and
   predict a fair counterexample before revealing the result.
4. **Leo import/scene failure (3–4 slides, 6–8 min):** use rendered artifact
   evidence and reconstruct queue → packet → radio state → energy causality.
5. **Concept deepening (5–7 slides, 10–15 min):** W/J, service boundary,
   endpoint versus system energy, fair baseline, and one non-LEO transfer.

The five branches therefore contain 20–26 slides in total, matching the
three-layer deck contract.

Contingency clocks substitute for protected core time; they never extend the
course:

| Branch | Replaces protected clock | Remaining activity in that clock | Required return |
|---|---|---|---|
| Setup/OS failure | `05–13` setup | diagnose until minute 10, then import the pinned same-scenario fallback by minute 13 | core slide 17 / class minute 13 |
| Python/code recovery | first 8–12 minutes of the affected Lab A (`29–50`), B (`50–71`), or C (`76–99`) block | use the repaired marked line if ready; otherwise use its matching prebuilt result for the remaining lab evidence chain | the affected lab debrief at its original endpoint: minute 50, 71, or 99 |
| Runner finishes early | 8–10 otherwise unused minutes inside the current lab block | freeze policy and run/predict the named counterexample | current lab debrief at its original endpoint |
| Leo import/scene failure | 6–8 minutes inside the current lab block | use the rendered artifact packet for offline queue → action → state → energy reconstruction | current lab debrief at its original endpoint |
| Concept deepening | 10–15 minutes of a failed/shortened run inside the current lab block | use the same artifact for W/J, boundary, fair-baseline, or non-LEO transfer deepening | next protected segment at minute 50, 71, or 99 |

Speaker notes name the selected branch, start clock, fallback artifact, return
slide, and skipped core pages. A branch cannot consume time from the next
protected segment. Therefore both the normal route and every declared
substitution route still end at minute 120.

The instructor chooses at most one branch at a time. Branch notes state where
to return to the core deck.

### 13.7 Design system

- 16:9 canvas.
- Design DNA: **dark command-center + lab evidence**, matching Leo rather than
  a generic light dashboard.
- This owner-directed dark system supersedes the earlier light course-outline
  draft for this new deck only; it does not authorize modifying the dirty donor
  workspace.
- Dominant color: deep navy/blue-black; secondary teal for action/data; amber
  for provenance/boundary; red only for invalid/fail; neutral cool gray for
  inactive state.
- EDU branding, if mandatory, remains in a protected footer/logo area; it does
  not force a light body canvas.
- Title: 34–40 pt; driving question: 26–30 pt; body: 20–24 pt; code: 18–22 pt;
  caption/source: 11–13 pt. Required learner content may not be placed in the
  caption size.
- One dominant visual per content slide: code focus, state ribbon, queue,
  timeline, comparison, screenshot, or evidence table.
- No repeated four-card grid, tiny KPI wall, accent line under titles, centered
  paragraph text, or side-by-side Chinese/English duplication.
- Use screenshot-plus-interpretation, scientific figure, lab result table,
  comparison, and short process layouts before generic cards.
- Placeholders are visibly labeled until current browser evidence exists. Do
  not invent screenshots or successful KPI values.

### 13.8 Language and notes

- Primary deliverable: all-Traditional-Chinese deck.
- Canonical identifiers such as `scenario_id`, `service_pass`,
  `student_policy.py`, `consumed J`, and `bit/J` remain in English where
  necessary.
- If an English deck is required, build it as a separate output from the same
  workspace; do not create bilingual columns.
- Every core and contingency slide has speaker notes containing:
  - protected clock and purpose;
  - exact narration;
  - instructor action and student action;
  - expected screen/terminal state;
  - why the command or edited line is necessary;
  - the mechanism and predicted evidence change;
  - one causal interpretation;
  - misconception;
  - slow scaffold and fast counterexample;
  - fallback/resume target;
  - claim ceiling and source.

### 13.9 Deck workspace and QA

Create a fresh, versioned workspace rather than editing the current dirty
`.scratch/c120-course-outline-pptx-wrap/**` tree:

```text
courseware/c120-lora-leo-deck/
├── design_brief.json
├── content_plan.json
├── evidence_plan.json
├── asset_plan.json
├── outline.zh-TW.json
├── notes.md
├── assets/
└── build/
```

Required production loop:

1. donor slide inventory and dedup report;
2. owner review of the first 8–10 slides including the LoRa rationale;
3. action/code explanation matrix for every package step and allowed edit;
4. source-stable outline and notes;
5. editable PPTX build;
6. geometry/content QA;
7. render every slide at original size;
8. fresh-eyes visual review;
9. at least one fix-and-reverify cycle;
10. verify Traditional Chinese text, commands, screenshots, sources, notes,
   contingency return points, and absence of placeholders before final claim.

File existence or an automated QA pass alone is not acceptance.

## 14. Recovery and classroom operations

### 14.1 Required artifacts

- pinned source archive or release receipt;
- requirements lock and setup receipts for each supported OS;
- fixed scenario packages;
- baseline, candidate, withheld, and fallback result artifacts;
- import validator test corpus, including malicious and mismatched files;
- instructor runbook;
- student quick sheet;
- contingency slide bank;
- workbook recovery guide.

### 14.2 Two-minute recovery

Every failure maps to one action:

- setup fails → open same-scenario fallback result;
- policy syntax fails → show line and restore last-known-good policy;
- run fails → retain previous artifact, permit deterministic rerun;
- import fails → show exact identity/unit/schema mismatch; no partial state;
- Leo route fails → use rendered evidence packet and workbook offline form;
- session is lost → reopen saved workbook and rebind to the same scenario.

## 15. Security, privacy, and licensing

- Do not upload or execute student Python on the server.
- Do not accept arbitrary archives; scenario/result upload is JSON only with a
  strict size limit.
- Escape all learner-controlled strings before rendering.
- Reject NaN, Infinity, negative energy/time, duplicate identities, excessive
  event counts, and deeply nested payloads.
- Do not include credentials, student names, machine paths, or hostnames in
  result artifacts.
- Preserve upstream copyright, GPL-3.0 license, citation, commit, and modified
  source availability in the course runner.
- A license review decides whether the runner is a separate repository,
  release archive, or clearly separated package before distribution.

## 16. Implementation tickets and gates

| Ticket | Owner | Deliverable | Promotion gate |
|---|---|---|---|
| `C120-LORA-00` | controller | ADR/SDD, exact scenario/result/event/freeze schemas, C-120 anchor, endpoint accounting, file ownership | owner accepts exact flow and boundaries |
| `C120-LORA-01` | runner lane | package skeleton, setup, verify, fixed scenario reader | Windows/macOS/WSL/Linux smoke |
| `C120-LORA-02` | runner lane | deterministic LoRa adapter, policy API, result writer | byte-stable replay and <=60 s hard limit |
| `C120-LORA-03` | importer lane | strict TypeScript parser and fixtures | identity/unit/schema mismatch fail closed |
| `C120-LORA-04` | controller | `C120LoraEndpointReplay` adapter under `loraIntegration/**`; no mapping into C-120 system fields | policy change alters authoritative endpoint evidence |
| `C120-LORA-05` | controller, sequential after importer | `/course` import workbench and packet/queue/radio visuals in shared route files | keyboard/narrow/browser evidence |
| `C120-LORA-06` | controller | workbook/session/recovery integration | reset/resume/incomplete/complete reopen |
| `C120-LORA-07` | deck lane | 64–72 core + 20–26 contingency + 14–18 appendix pages (98–116 total), including full action/code explanations | full render, visual QA, owner review |
| `C120-LORA-08` | controller | novice/20-seat rehearsal packet | claim ceiling raised only by evidence |

## 17. Agent routing and exclusive ownership

### 17.1 Controller — GPT-5.6 Sol/ultra

Owns exclusively:

- ADR/SDD and source precedence;
- scenario/result schema freeze;
- `contracts/c120-lora-v1/**` machine-readable schemas and golden valid
  artifacts;
- `src/course/c120/contract.ts`, fixtures, replay, session, workbook;
- `src/course/c120/loraIntegration/**` endpoint replay/session/workbook adapter;
- energy-scope mapping and claim language;
- route integration, package scripts, merge order;
- browser evidence and final readiness ceiling.

The controller must not delegate shared-contract edits.

### 17.2 Luna max

Use Luna/max for high-judgment implementation:

1. **Runner worker** — only the new runner package/repository; Python adapter,
   determinism, policy sandbox boundary, result artifact, tests.
2. **Importer worker** — only `src/course/c120/loraEnergySim/**`; strict parsing,
   identity/unit invariants, malicious fixtures, focused tests.

At most two Luna/max workers run concurrently, and only after the controller
freezes the contract. They may not edit the same repository paths.

### 17.3 Agy / Gemini 3.1 Pro (High)

Use agy for work where multimodal comparison and editorial judgment dominate:

- BeamShift 114-slide donor inventory and semantic dedup;
- the first 8–10 slide visual/story checkpoint;
- Traditional Chinese microcopy and novice readability review;
- rendered slide and browser screenshot fresh-eyes review;
- contingency branch clarity and speaker-note critique.

Agy should not own scientific contracts, energy mapping, deterministic runner
logic, shared session state, or final merge decisions.

### 17.4 Safe concurrent count

After contract freeze and a clean checkpoint:

- maximum **two implementation writers** at once;
- optionally one additional read-only visual/review agent if machine capacity
  permits;
- one controller integrates sequentially.

The number of agents is constrained by shared files and machine state, not by
how many prompts can be launched.

## 18. Server and local development strategy

### 18.1 Current state at SDD drafting

- local and server are both at `f01f8efd09e1dd3088d66d9eea7f43e117029190`;
- local contains dirty presentation/research WIP that must be preserved;
- server contains broad dirty C-120/UI/backend WIP and an active `leo`
  controller process;
- server load is already high and swap is heavily used;
- no new implementation worker may overlap the current server writer.

### 18.2 Recommended split after checkpoint

| Environment | Lane | Exact ownership |
|---|---|---|
| Ubuntu server worktree A | Luna runner | separate `c120-lora-energy-lab` repo/worktree only |
| Ubuntu server worktree B | Luna importer | new `src/course/c120/loraEnergySim/**` only; launch only after load permits |
| Local | agy deck/readability | new `courseware/c120-lora-leo-deck/**` or read-only renders |
| Controller checkout | integration | shared contract/route/session only after workers stop |

If server load remains high, the importer lane may move to a new local
worktree pinned to the same clean base. This is a capacity fallback; it does
not change its exact ownership or permit cross-environment co-writing.

### 18.3 Merge rules

1. Stop and checkpoint the active server writer first.
2. Pin the same clean base SHA for all Leo worktrees.
3. Use distinct branches and worktrees; never develop two lanes in one dirty
   checkout.
4. Workers commit only exact owned paths after explicit commit authority.
5. Controller reviews and integrates runner contract first, importer second,
   shared adapter third, UI fourth, deck screenshots last.
6. Never copy an entire server checkout over local WIP.
7. Do not pull or merge while a worktree has uncheckpointed shared-file edits.
8. Run diff checks and focused tests after each integration, then combined
   C-120 tests, lint, build, and browser validation.

## 19. Verification matrix

### 19.1 Runner

- clean setup on representative Windows, macOS, and WSL/Linux;
- no Docker/admin/cloud login;
- `verify_setup` actionable errors;
- fixed seed and byte-stable canonical JSON;
- freeze receipt canonical preimage and withheld-policy rejection;
- WAIT/SLEEP/wake clock, contact, deadline, and energy reconciliation;
- baseline/candidate/withheld runtime budget;
- legal policy change changes evidence;
- invalid policy fails locally with line/action guidance;
- no host/path/personal data in artifact.

### 19.2 Contract/import

- schema version and exact fields;
- external runner contract plus exact current C-120 anchor, content hash, and
  same scenario;
- pinned runner/upstream/lock/seed/policy hash;
- finite non-negative values and sum consistency;
- unit and energy-scope mismatch;
- event ordering and contact legality;
- oversized/malicious/deep JSON rejection;
- no partial import or session corruption;
- fallback preserves scenario and provenance.

### 19.3 Leo/browser

- all three policies alter authoritative endpoint replay while current C-120
  replay remains valid and separate;
- scene, queue, packet, radio ribbon, endpoint energy, current C-120 evidence,
  ledger, and workbook share one scenario clock with explicit two-layer
  identity;
- workbook v2-to-v3 migration, endpoint records, reset/resume, and reopen do not
  invent or relabel evidence;
- `/course` and compatibility redirect;
- Traditional Chinese/English switch and `<html lang>`;
- keyboard-only, 200% zoom, 320 px, 390 px, desktop;
- reset, undo where supported, resume, incomplete/complete export and reopen;
- zero console errors in a fresh production build;
- exact claim ceiling on every student-visible data surface.

### 19.4 Deck

- donor dedup and rejection log;
- opening explains direct smart-energy/IoT relevance before satellite detail;
- every required command explains its purpose, expected receipt, and recovery;
- every allowed code edit has a line-by-line reading, mechanism, prediction,
  evidence target, and falsifiable interpretation;
- commands match the released package;
- screenshots match the released route and artifacts;
- normal and contingency clocks both close at 120;
- all slides render at original size;
- no overflow, overlap, crop, low contrast, tiny required text, or placeholder;
- speaker notes, sources, recovery, return points, and claim ceiling complete;
- at least one fix-and-reverify cycle.

### 19.5 Human gates

- 3–5 novice individual walkthroughs with time, first action, invalid action,
  hint/fallback, instructor rescue, artifact completion, and causal rubric;
- 20-seat rehearsal after novice remediation;
- all learners reach a meaningful activity within five minutes or use the
  declared fallback;
- any failure recovers to the same scenario within two minutes;
- owner performs final human visual and teaching-flow acceptance.

## 20. Claim ceiling

Before human gates, the highest permitted claim is:

`COURSE-PACKAGED SIMULATED LORA ENDPOINT-ENERGY LAB INTEGRATED WITH LEO FOR BOUNDED NOVICE VALIDATION`

Do not claim:

- classroom-ready;
- 20-seat pass;
- live satellite or live network data;
- measured student-device energy;
- canonical parity;
- whole-satellite or wall-plug energy;
- scientifically validated LoRa-to-LEO equivalence;
- live backend completion.

## 21. Stop conditions

Stop implementation and return to the controller if:

- current server/local writers overlap an owned path;
- the scenario/result/energy contract is still changing;
- a worker needs to edit shared C-120 contract/session/fixtures;
- an importer worker attempts to create endpoint/C-120 replay or edit
  `loraIntegration/**`;
- LoRa endpoint energy is being relabeled as canonical system energy;
- student code would execute on the server;
- setup requires Docker/admin privileges or cannot recover in two minutes;
- a student policy change only changes labels/animation;
- the new course route depends on legacy `App`, `MainScene`, C-90 stage state,
  or browser-side formulas;
- deck pages are added without a learning, recovery, or evidence role.

## 22. Immediate next decision

Owner review is required for:

1. revised exact-120 clock;
2. separate runner package/repository boundary;
3. Phase-1 two-layer replay: endpoint evidence remains endpoint-only and is not
   mapped into current C-120 system/canonical fields;
4. target 98–116-slide three-layer deck, approximately 108 pages, with a
   64–72-slide normal path and explicit action/code teaching;
5. maximum two implementation writers plus one optional read-only reviewer;
6. waiting for the active server controller to checkpoint before a new
   implementation conversation starts;
7. synchronizing planning authority so the installation/bounded-edit amendment
   no longer conflicts with the older no-install/no-source-edit clause.
