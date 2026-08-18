# Full-deck content fragment contract

Each fragment is a JSON array.  The merged set must contain pages `1..108`
exactly once.

```json
{
  "page": 2,
  "title": "節能競賽真正控制什麼？",
  "body": "one editable native-template text block",
  "notes": "speaker notes in Traditional Chinese",
  "authority": "Authority｜ADR-004 24–38",
  "state": "AUTHORITY",
  "purpose": "direct course relevance",
  "action_contract": false
}
```

Page 1 also requires `subtitle`; its `body` is ignored because it uses the
native cover slide.  Pages 2–108 use the native educate content slide.

Rules:

- Do not use the exact Chinese word `學生`; use `學員`.
- Titles are short enough to fit at exactly 28 pt.
- Chinese is authored for 標楷體; English/numbers for Times New Roman.
- Variables and formulas are represented as explicit LaTeX text.  A formula
  line starts with `LaTeX：`; the post-process makes the formula run italic.
- Other text is roman.
- Every install, run, import, or `student_policy.py` edit slide sets
  `action_contract: true` and exposes all five on-slide fields:
  `DO｜`, `WHY｜`, `MECHANISM｜`, `EXPECT｜`, and `INTERPRET｜`.
- Current API, command, line-number, browser, artifact, or KPI evidence that is
  not frozen is labelled `EVIDENCE PLACEHOLDER` on-slide.
- No screenshot, command, receipt, KPI, hash, URL, line number, or case name may
  be invented.
- Keep the body to one dominant typographic visual, normally 5–8 non-empty
  lines inside the native body placeholder.

