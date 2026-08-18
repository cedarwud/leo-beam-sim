# C-120 full-deck outline — 108-page target

Status: `AUTHORIZED 2026-08-11 / IN PRODUCTION / UNFROZEN EVIDENCE REMAINS PLACEHOLDER-ONLY`

Sizing contract:

- Core exact-120 path: 70 pages.
- Contingency/fast/recovery bank: 22 pages.
- Technical/source appendix: 16 pages.
- Total: 108 pages, within the accepted 98–116 range.

Native visual and typography contract:

- Use `/home/u24/ppt-master/template/educate.pptx` as the actual native template.
- Preserve its original background, master, logo, footer and colors; add no
  slide background fill.
- Every title is exactly 28 pt.
- Chinese uses 標楷體; English and numerals use Times New Roman.
- Variables and formulas are italic; all other text is roman.
- Formula source is editable raw LaTeX text.
- The exact Chinese word `學生` is forbidden; use `學員`.
- API, commands, code line numbers, browser evidence and KPI remain explicit
  placeholders until frozen; placeholder slides may be produced, but no
  evidence may be invented.

Legend:

- `AUTHORITY` — content can be authored from current ADR/SDD/course authority.
- `DONOR-REWRITE` — concept may be adapted from BeamShift, but current wording/visual/notes must be rebuilt.
- `PLACEHOLDER` — final command, line number, artifact, browser pixel or KPI is not frozen and may not be invented.
- `OWNER` — requires an owner decision before final production.

## Core exact-120 path — pages 1–70

| Page | Teaching beat | Dominant visual | Evidence / donor state |
|---:|---|---|---|
| 1 | 每一次 SEND、WAIT、SLEEP，都是能源決策 | endpoint state ribbon + service window | `AUTHORITY` |
| 2 | 節能是一條可檢驗因果鏈 | state/data → policy → packet/service → P×t → J → evidence | `AUTHORITY` |
| 3 | LoRa 證據邊界 | observes / does-not-prove split | `AUTHORITY` |
| 4 | LEO：變動服務窗口範例 | moving service-window hero | `DONOR-REWRITE` 2, 4–6 |
| 5 | 兩層 evidence 不互相冒充 | endpoint versus canonical-system evidence | `AUTHORITY` |
| 6 | 從預測到驗證 | predict → edit → run → import → withheld | `AUTHORITY`; commands/artifacts `PLACEHOLDER` |
| 7 | 操作與修改的五問框架 | Do / Why / Mechanism / Expect / Interpret | `AUTHORITY` |
| 8 | 120 分鐘：setup 與 labs | ten protected time bands | `OWNER` draft clock |
| 9 | Opening checkpoint | continuation gate + placeholder discipline | `OWNER` continuation authorized 2026-08-11 |
| 10 | What the course package contains | editable folder map | `AUTHORITY`; final filenames `PLACEHOLDER` until release |
| 11 | Choose the supported OS launcher | Windows / macOS-WSL split | `PLACEHOLDER` cold-start evidence |
| 12 | Why create an isolated `.venv` | system Python versus course environment | `AUTHORITY`; command screenshot `PLACEHOLDER` |
| 13 | Why install a pinned dependency lock | reviewed dependency graph | `AUTHORITY`; lock SHA `PLACEHOLDER` |
| 14 | Verify provenance before policy edits | release / upstream / wrapper / lock receipt | `PLACEHOLDER` current receipt |
| 15 | Read the `READY` receipt | expected fields + failure meaning | `PLACEHOLDER` current terminal evidence |
| 16 | Setup recovery gate at class minute 10/13 | normal path / same-scenario fallback fork | `AUTHORITY`; artifact ID `PLACEHOLDER` |
| 17 | Fixed, controlled and observed variables | three-zone experiment map | `AUTHORITY` |
| 18 | Endpoint state vocabulary | SLEEP / WAIT / WAKE / PROCESS / TX / RX ribbon | `AUTHORITY` |
| 19 | WAIT is awake idle; SLEEP has wake latency/energy | two-state timing comparison | `AUTHORITY` |
| 20 | Packet lifecycle | generated → attempt → retry/delivered/expired | `AUTHORITY` |
| 21 | Service boundary before energy comparison | service gate around evidence ledger | `DONOR-REWRITE` 19–21 |
| 22 | Python survival: constants are bounded controls | annotated constant line | `PLACEHOLDER` released line numbers |
| 23 | Python survival: comparisons and Boolean conditions | one highlighted condition | `PLACEHOLDER` released code |
| 24 | Python survival: indentation and observation input | 3–6 line code focus | `PLACEHOLDER` released code |
| 25 | Python survival: legal return actions | observation → action → return | `AUTHORITY`; exact API `PLACEHOLDER` |
| 26 | W is a rate; J accumulates over time | power-time area | `DONOR-REWRITE` 14, 16/17 |
| 27 | A fair baseline fixes job, window and boundary | fair / incomparable A-B comparison | `DONOR-REWRITE` 36–39 |
| 28 | Source → model → course assumption | three-layer provenance chain | `DONOR-REWRITE` 70–75 |
| 29 | One `scenario_id` across runner, replay and workbook | identity spine | `AUTHORITY`; current hash `PLACEHOLDER` |
| 30 | Legal interval and why LEO limits send/wait choices | NTPU window with legal/illegal action marks | `DONOR-REWRITE` 4–6 |
| 31 | Lab A question: same job, different pace | driving-question hero | `AUTHORITY` |
| 32 | Read `PACE_GAP_STEPS` line by line | 3–6 highlighted lines | `PLACEHOLDER` released code/line numbers |
| 33 | Read `REST_DURING_GAP = WAIT or SLEEP` | WAIT/SLEEP branch | `PLACEHOLDER` released code/line numbers |
| 34 | Mechanism: send spacing, idle time, sleep and wake | state ribbon before/after | `AUTHORITY` |
| 35 | Predict queue, service, state time and endpoint J | prediction lock | `AUTHORITY` |
| 36 | Run untouched Lab A baseline | one terminal action + receipt | `PLACEHOLDER` command/current result |
| 37 | Edit only the Lab A marked block and run candidate | source diff + policy hash | `PLACEHOLDER` code/command/hash |
| 38 | Import candidate and compare same-boundary evidence | screenshot + interpretation | `PLACEHOLDER` current browser evidence/KPI |
| 39 | Hidden condition and Lab A causal debrief | baseline/candidate/hidden ledger | `PLACEHOLDER` artifacts; `DONOR-REWRITE` 19–21, 36–39 |
| 40 | Lab B question: act now or wait | changing quality trace | `AUTHORITY` |
| 41 | Enter threshold: when to become send-ready | threshold crossing | `PLACEHOLDER` released code/line numbers |
| 42 | Exit threshold: why hysteresis differs from one threshold | enter/exit band | `DONOR-REWRITE` 12 |
| 43 | `STABLE_STEPS`: reject brief quality spikes | hold counter | `PLACEHOLDER` released code/line numbers |
| 44 | Predict Trace A entry, waits, service and endpoint J | prediction overlay on trace | `AUTHORITY` |
| 45 | Run Trace A baseline and candidate | two terminal receipts | `PLACEHOLDER` commands/results |
| 46 | Why freeze policy before the withheld trace | policy bytes + freeze receipt | `PLACEHOLDER` current receipt/schema instance |
| 47 | Run Trace B without retuning | frozen policy crossing new trace | `PLACEHOLDER` command/result |
| 48 | Inspect mode changes, attempts, retries, service and endpoint J | evidence-first trace | `PLACEHOLDER` browser/result artifact |
| 49 | Counterexample and Lab B debrief | too-slow / ping-pong / qualified verdict | `DONOR-REWRITE` 12, 36–39 |
| 50 | Recovery: save and reopen the workbook | checkpoint receipt | `PLACEHOLDER` workbook-v3 pixel/artifact |
| 51 | Same-scenario fallback and causal reconstruction | fallback provenance + causal chain | `AUTHORITY`; current artifact `PLACEHOLDER` |
| 52 | Lab C question: queue, batch, sleep or urgent send | queue + short window hero | `AUTHORITY` |
| 53 | Queue, deadline and freshness are separate | ordered message cards | `AUTHORITY` |
| 54 | Batch size trades activations for delay | queue-to-flush sequence | `AUTHORITY` |
| 55 | Urgent margin overrides normal pacing | urgent countdown | `AUTHORITY` |
| 56 | Read the Lab C marked lines | `BATCH_SIZE` + `URGENT_MARGIN_S` focus | `PLACEHOLDER` released code/line numbers |
| 57 | Baseline and pre-run prediction | queue/service/state/J prediction lock | `AUTHORITY`; baseline artifact `PLACEHOLDER` |
| 58 | Edit and run candidate | one allowed code diff + receipt | `PLACEHOLDER` command/result |
| 59 | Inspect queue and packet outcomes | queue strip + packet ledger | `PLACEHOLDER` current browser/artifact |
| 60 | Inspect sleep/wake/process/TX/RX and endpoint J | radio-state ribbon + energy breakdown | `PLACEHOLDER` current browser/artifact |
| 61 | One evidence-based revision only | candidate → one revised constant | `PLACEHOLDER` code/command/result |
| 62 | Surprise case, final ledger and Lab C debrief | candidate/revision/surprise evidence | `PLACEHOLDER` artifacts/KPI |
| 63 | Evidence clinic: what is available at decision time? | available-now / post-action sort | `AUTHORITY` |
| 64 | Leakage: prediction score is not energy saving | legal / leaky feature comparison | `AUTHORITY` |
| 65 | Artifact provenance and claim classification | evidence record with hashes/scopes | `DONOR-REWRITE` 70–75, 96–97, 113 |
| 66 | Bounded claim: what this course can and cannot say | claim ladder | `AUTHORITY` |
| 67 | Transfer to smart farm / HVAC / edge / logistics | mechanism token remap | `AUTHORITY` |
| 68 | Write a falsifiable competition hypothesis | hypothesis stem | `AUTHORITY` |
| 69 | Name the held-out condition that would overturn it | falsifier card | `AUTHORITY` |
| 70 | Export, close, reopen and exit with COMPLETE/INCOMPLETE provenance | workbook loop | `PLACEHOLDER` current workbook-v3 evidence |

## Contingency / fast / recovery bank — 22 pages

These branches substitute inside protected core clocks; they never extend the class beyond 120 minutes.

| ID | Branch beat | Dominant visual | Return point / evidence |
|---|---|---|---|
| C-01 | Setup/OS branch entry and exact eight-minute clock | branch clock | return core page 17 / minute 13 |
| C-02 | Verify the release root and folder map | missing/mixed file comparison | release path `PLACEHOLDER` |
| C-03 | Diagnose environment isolation and lock failure | staged receipt | current receipt `PLACEHOLDER` |
| C-04 | Read one representative setup error | error → meaning → smallest recovery | error evidence `PLACEHOLDER` |
| C-05 | Import the pinned same-scenario fallback by minute 13 | fallback provenance | artifact ID `PLACEHOLDER` |
| C-06 | Python recovery: indentation | before/after 3-line code | released code `PLACEHOLDER` |
| C-07 | Python recovery: comparison and legal action | syntax / semantics split | released API `PLACEHOLDER` |
| C-08 | Read a traceback without debugging the framework | line pointer + marked block | real traceback `PLACEHOLDER` |
| C-09 | Repair one marked line and reconnect mechanism | code → action → evidence | return affected lab debrief |
| C-10 | Fast branch: freeze the current policy | freeze receipt | receipt `PLACEHOLDER` |
| C-11 | Predict a fair counterexample | new trace, same policy | `AUTHORITY` |
| C-12 | Run without retuning | immutable policy over new case | result `PLACEHOLDER` |
| C-13 | Debrief why the ranking changed or held | compact evidence ledger | return current lab debrief |
| C-14 | Leo import failure: identify schema/identity/unit mismatch | fail-closed receipt | current error UI `PLACEHOLDER` |
| C-15 | Continue from rendered artifact evidence | offline evidence packet | current packet `PLACEHOLDER` |
| C-16 | Reconstruct queue → action → state → energy | causal chain | return current lab debrief |
| C-17 | Deepening: low W versus low J | power-time counterexample | `DONOR-REWRITE` 14, 16/17 |
| C-18 | Deepening: service boundary before bit/J | valid / invalid comparison | `DONOR-REWRITE` 19–21 |
| C-19 | Deepening: endpoint versus system energy | two-layer authority | `AUTHORITY` |
| C-20 | Deepening: fair baseline and same window | A/B contract | `DONOR-REWRITE` 36–39 |
| C-21 | Deepening: non-LEO changing-opportunity transfer | smart farm / HVAC example | `AUTHORITY` |
| C-22 | Deepening: measured / derived / assumed / simulated | claim classifier | `DONOR-REWRITE` 113 |

## Technical / source appendix — 16 pages

Appendix pages are optional vocabulary, provenance and recovery support. They are not required derivations for student completion.

The draft SDD groups eighteen appendix IDs.  This 108-page production outline
intentionally compresses them to sixteen pages: claim classification is merged
into APP-14, citations and licenses into APP-15, and glossary/claim/fallback
reference into APP-16.  No required core-clock material is removed.

| ID | Topic | Dominant visual | Donor / evidence state |
|---|---|---|---|
| APP-01 | LoRaEnergySim boundary: what endpoint state/packet/energy it exposes | scope diagram | `AUTHORITY` |
| APP-02 | Pinned upstream commit and course-owned wrapper | upstream / wrapper split | `AUTHORITY` |
| APP-03 | Course-added assumptions and unverified claims | provenance table | `AUTHORITY` |
| APP-04 | `student_policy.py` allowed observation/action API | compact API card | exact API `PLACEHOLDER` |
| APP-05 | Scenario package → runner → result schemas | contract flow | exact schema instance `PLACEHOLDER` |
| APP-06 | Fail-closed identity/unit/provenance validation | validation ladder | current receipts `PLACEHOLDER` |
| APP-07 | Sleep / awake-idle / wake / process / TX / RX accounting | state-energy ribbon | `AUTHORITY` |
| APP-08 | W, J, bit/s, delivered bits and bit/J unit ladder | unit ladder | `DONOR-REWRITE` 14, 16/17 |
| APP-09 | Endpoint energy versus Leo/system energy | authority boundary | `AUTHORITY` |
| APP-10 | TLE → SGP4 → position: only a changing-window anchor | source/model chain | `DONOR-REWRITE` 7–10, 98–110 |
| APP-11 | Source → model → assumption → result lineage | provenance spine | `DONOR-REWRITE` 70–75 |
| APP-12 | Minimal SINR / dB / linear vocabulary | one conversion concept | `DONOR-REWRITE` 13, 15, 22–35, 111–114 |
| APP-13 | Angle, range, RF and consumed-power boundary | boundary diagram | `DONOR-REWRITE` appendix only |
| APP-14 | Measured / derived / assumed / simulated classification | four-column classifier | `DONOR-REWRITE` 113 |
| APP-15 | Upstream license, citations and course-owned modification boundary | source ledger | `AUTHORITY` |
| APP-16 | Field glossary, bounded claim and fallback/reopen reference | glossary + recovery route | `AUTHORITY` |

## Evidence-closure gates after placeholder-safe production

1. Freeze release URL/tag, supported Python version, lock, commands, case names, output paths and `student_policy.py` line numbers.
2. Freeze scenario/result/freeze-receipt schemas and two-layer replay boundary.
3. Capture current terminal, artifact and browser evidence; replace every explicit placeholder.
4. Complete action/code explanation matrix for all package steps and edits.
5. Regenerate the editable Traditional-Chinese PPTX from the selected native template lifecycle.
6. Render all pages at original size, run geometry/content QA, perform fresh-eyes review, fix at least one issue and reverify.
7. Owner human visual and teaching-flow acceptance remains required before any classroom-ready claim.
