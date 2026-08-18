# C-120 LoRa / LEO evidence freeze matrix

Date: 2026-08-11

The full-deck production gate is open, but the LoRa runner/import evidence gate
is not.  Conceptual and authority-backed teaching pages may be produced now;
the following runtime details stay visibly labelled `EVIDENCE PLACEHOLDER`.

| Item | Status | Current boundary |
|---|---|---|
| Runner release and install package | `UNFROZEN` | Proposed package/setup only; no release archive or local runner package exists. |
| Supported Python, dependency lock and hashes | `UNFROZEN` | No release-frozen version/lock/receipt. |
| Setup, verify, run and import commands | `UNFROZEN` | SDD commands are proposals, not current terminal evidence. |
| Case names and output paths | `PROBABLE / UNFROZEN API` | Baseline/candidate/withheld naming is proposed but not release-frozen. |
| `student_policy.py` API and marked line numbers | `UNFROZEN` | Proposed tree/contract only; no released file exists locally. |
| Result/freeze JSON and hashes | `UNFROZEN` | Schema examples are not run artifacts. |
| LoRa import and endpoint replay | `UNFROZEN` | Importer/adapter paths are proposed; current implementation is fixture-first system replay. |
| Browser screenshots | `VERIFIED FIXTURE HOST ONLY` | Existing `/course/c120` screenshots may be used only with `fixture / c120-fixture-provider / bundled`; LoRa endpoint pixels remain placeholder. |
| KPIs | `VERIFIED FIXTURE VALUES ONLY` | Existing system-layer values are not endpoint KPIs; endpoint deltas may not be invented. |

## Production rule

- May show now: endpoint-first rationale, the causal chain, LEO as a changing
  service-window example, endpoint/system evidence separation, experiment
  design, and the proposed predict/edit/run/import/replay loop.
- Must remain placeholder: release URL/tag, Python version, lock, exact
  commands, receipts, case IDs, output paths, API/line numbers, deterministic
  LoRa artifacts, endpoint browser pixels and endpoint KPI values.
- Example zeros, empty arrays and placeholder hashes are never presented as
  results.
- Every install, run, import and permitted policy modification exposes
  `Do / Why / Mechanism / Expect / Interpret` on-slide.

Authority anchors: ADR-004 lines 3–5 and 76–93; integration SDD lines 220–271,
739–907 and 909–1078; next-controller handoff lines 81–101.
