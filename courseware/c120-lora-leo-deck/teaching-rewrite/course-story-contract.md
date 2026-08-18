# Direct-teaching story contract

This replaces the evidence-first narrative in the current preview.

## Opening promise

The course starts from a concrete IoT problem: a battery-powered endpoint has
data to deliver, but its service opportunity changes. Sending immediately,
waiting while awake, or sleeping all change delivery, delay, and energy.

The visible learner promise is:

> 你會改動一個受控的 policy 值，執行同一個情境，並用 state、packet、service 與 J 解釋結果為什麼改變。

LEO is introduced only after this promise, as one example of a changing
service window.

## Three missions

1. Lab A: Does sleeping during a pacing gap actually save endpoint energy once
   wake and service consequences are included?
2. Lab B: Does waiting for a more stable quality condition improve delivery,
   or does it miss the service window?
3. Lab C: How should batching and an urgent deadline trade delivery against
   endpoint energy?

Each mission follows a visible, natural sequence: make a prediction, change an
exact value, run an exact command, locate the generated result, interpret the
causal chain, and test the frozen policy on a withheld condition.

## Teaching weight: the edit and its consequences

The runner is expected to finish quickly. Runtime is not used to fill the
lesson. Each lab therefore gives most of its slides to the code change and the
evidence interpretation:

1. Read the original marked line and explain the original behavior.
2. Trace that behavior to radio state, packet timing, service, and endpoint J.
3. Show the one exact value to change and explain the mechanism it controls.
4. Record a directional prediction before execution.
5. Use one compact run/receipt slide for the exact command and stdout
   `result_path`.
6. Compare the original and changed results on one aligned visual.
7. Explain why the evidence changed, including any result that contradicts the
   prediction.
8. Keep the frozen policy unchanged for the withheld case, then explain what
   did and did not generalize.

Repeated command pages, waiting screens, or artificial runtime delays do not
count as teaching content. The projected before/edit/after sequence must make
it possible to teach the mechanism even when a run completes immediately.

## Why upload `result.json`

The website does not execute `student_policy.py`. It has three classroom jobs:

1. Verify schema, scenario identity, units, and policy lineage before accepting
   evidence.
2. Turn a dense `result.json` into a frame-by-frame endpoint replay that can be
   inspected together.
3. Keep baseline, candidate, frozen, and withheld records in one workbook that
   can be saved and reopened.

The upload page must therefore say, in plain language:

> 本機 runner 負責產生結果；網站負責驗證、重播與保存比較。上傳不是交作業，也不會執行你的 Python 程式。

## Visible-slide rule

- A concept slide contains two or three complete explanatory sentences, not
  only nouns, arrows, or evidence labels.
- An operation slide shows the exact value or command, a plain-language reason,
  the success signal, and what to do next.
- A result slide states what can and cannot be concluded, then asks one concrete
  interpretation question.
- The slide remains understandable without opening speaker notes.
- Main teaching text is normally 24–28 pt; commands are normally 20–22 pt.
  Necessary evidence labels may use 18 pt. Never shrink text to hide an
  overcrowded layout.
- Bright orange text is prohibited. Connectors may not cross text or formulas.
