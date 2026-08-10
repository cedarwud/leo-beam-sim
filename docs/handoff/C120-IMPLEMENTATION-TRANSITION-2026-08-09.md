# C-120 implementation transition checkpoint — 2026-08-09

Status: **C-90/TLE DONOR SEGMENT COMPLETE; C-120 IMPLEMENTATION NOT STARTED**

Implementation repo: `/home/u24/demo/leo-beam-sim`

Pinned HEAD before this work: `d3ab66794cfda75f55bfd98d25202ca45289b3ae`

## Current authority

Start from `/home/u24/leo-satcom-lab/.scratch/90min-satellite-course/CURRENT-C120-HANDOFF.md` and follow its precedence. For simulator work, the only mandatory downstream authority is:

1. `issues/11-120min-energy-first-curriculum-reset.md` — `C-120-ENERGY-DECISION-1R` learner behavior, exact cadence and surface/stop gates;
2. `decisions/ADR-C-003-c120-fixture-first-visual-host.md` — Adapt Leo, isolated C-120 domain, Gate 0 and New-shell kill gate;
3. `contracts/angle-aware-ee-v1/{README.md,PARITY-PLAN.md,golden-vectors.json}` — formula, fixture and claim ceiling.

Archived C-90 issues, prompts, ADR-C-002 and the existing C-90 audit are historical evidence only. They must not define the next route.

## Segment completed before the authority correction

The preserved untracked C-90 donor now has an isolated route, deterministic provider/state/export flow and a real TLE source boundary. The TLE lane added:

- sibling archive query and rate-aware single-GET update policy in `/home/u24/demo/tle_data`;
- exact `.tle` import with checksum/catalog matching and fail-closed rejection when no precomputed bundle exists;
- archive/source/epoch/target/now separation, old/mid/recent comparison and 10/30/90-minute precomputed windows;
- one time-indexed producer frame driving the TLE scene, replay, readout and export identity;
- explicit archive/import/pinned-fallback paths and instructor/server source links/command;
- responsive 390 px source cards and a complete C-90 browser export/reset/replay run.

Current focused evidence after the final responsive fix:

- `npm run test:course`: 22 pass, 0 fail;
- `npm run lint`: pass;
- `node scripts/c90-generate-tle-study.mjs --check`: deterministic/current, 2,435,186 bytes;
- `npm run build`: pass; chunk-size warnings only;
- `/home/u24/demo/tle_data`: 7 tests pass;
- browser: one production-preview session, full C-90 journey to JSON download, reset to Ready, explicit fallback, source links/command, 1440/768/390 visual checks and 0 console errors.

This evidence does **not** establish C-120 readiness, canonical parity, measured accuracy, a live backend, novice timing, 20-seat operation or human visual acceptance.

## Compliance against `CURRENT-C120-HANDOFF.md`

| C-120 boundary | Current checkout | Verdict |
|---|---|---|
| Isolated C-120 route and new C-120 domain | Only `/course/c90` and C-90 session semantics exist | **FAIL / NOT STARTED** |
| Leo NTPU visual leaf without legacy runtime | Existing C-90 route demonstrates the donor boundary | **PASS AS DONOR ONLY** |
| C-120 provider plus validated second provider | C-90 provider shape/tests exist, but the route still consumes an arbitrary provider before complete validation | **PARTIAL DONOR** |
| One `scenario_id` across TLE, A/B/C, clinic and workbook | C-90 connects TLE/E1/E2/IoT only; claim detective and clinic are absent | **FAIL** |
| 00–10 claim detective | Absent | **FAIL** |
| 10–18 TLE anchor | Source/import/precompute mechanics exist, but the current journey is 10-minute C-90, asks free text and exposes extra source/time exploration | **PARTIAL DONOR; MUST SIMPLIFY** |
| Lab A candidate drives hidden-condition replay | Current C-90 runs three revealed fixture arms; endpoint can be reached before the required update | **FAIL** |
| Lab B executable frozen non-code rule drives Trace B | Current text rule is frozen, but the learner still chooses the Trace B action; the rule is not the authoritative producer input | **FAIL** |
| Lab C six-slot consequential schedule/revision/withheld event | Current IoT is three fixed presets plus text | **FAIL** |
| Evidence clinic feature availability plus frozen action replay | Absent | **FAIL** |
| Exact 120 cadence and recovery reset segment | Absent | **FAIL** |
| At most eight constructed responses | Current C-90 path has many more free-text fields and an eight-field final form | **FAIL** |
| Cumulative reopenable Energy Decision Workbook | Current export is a C-90 learning bundle, not the cumulative C-120 workbook | **FAIL** |
| Incomplete export marked `INCOMPLETE` | Current export blocks incomplete sessions | **FAIL** |
| Every surface exact simulated-data ceiling | C-90 shows the older `NOT LIVE BACKEND` wording; no C-120 surfaces exist | **NOT STARTED** |
| Canonical formula ownership | Browser reads fixture W/J/data/bit-J and does not produce a second formula; no golden-vector parity claim is made | **PASS AS BOUNDARY ONLY** |

## Required next session entry

Use a fresh implementation conversation. Preserve all current dirty/untracked C-90 and audit artifacts; do not reset, stash, clean, commit or push. Do not continue the archived C-90 remediation list as the product roadmap.

The first implementation segment is only `C120-IMP-00` plus the minimum contract needed to prove it:

1. add an isolated `/course/c120` entry and a new `src/course/c120/**` domain; do not rename or extend C-90 stage/session types;
2. reuse only the Leo NTPU visual leaf and bounded presentation patterns;
3. define one validated C-120 provider/scenario/frame/workbook seam and prove replacement by a second stub without UI/state-machine changes;
4. use thin deterministic Gate-0 traces proving that Lab A candidate, Lab B frozen rule, Lab C schedule and clinic action each enter authoritative replay and change visible service or energy evidence;
5. prove the same `scenario_id`, units, frame identity and claim level reach TLE, A/B/C, clinic and workbook; all mismatches fail closed;
6. if this requires `App`, `MainScene`, legacy teaching EE/state or a browser-side scientific producer, stop with the ADR-C-003 New-shell recommendation.

Backend/canonical adapter work remains a separate future session after the shared provider contract is owner-frozen. It is not a Phase-1 prerequisite and must not share-write C-120 UI/session/fixture files.

## Claim ceiling at handoff

`C-90 fixture donor with completed TLE/precompute evidence; C-120 implementation and classroom evidence not started.`
