# Approved eight-slide visual contract

Authoritative visual donor:

`latest/LoRaEnergySim-LEO-ALT-PART-A-V2-P001-P008-REVIEW.pptx`

This donor is the only currently accepted classroom style. Package validity,
layout2 use, or a green validator does not by itself permit publication to
`latest/`.

The donor's visual language is approved; its current eight-page content is not
the final beginner explanation. The opening may be split into additional pages
without changing this visual language.

## Beginner comprehension gate

- Assume no prior knowledge of LoRa, endpoint, gateway, service window, policy,
  runner, JSON, replay, or energy accounting.
- Introduce no more than two new English terms on one page.
- Explain a term first with a concrete Chinese sentence or everyday analogy,
  then show the English field or token.
- Every page must make clear what the item is, why it appears here, and what
  visible consequence it has.
- If the explanation no longer fits the approved card density, add a page. Do
  not shrink text or turn the card into a paragraph.
- Commands and source code require a plain-language sentence immediately before
  them: what the command/code reads, what it changes, and what remains unchanged.
- Use classroom-facing platform names: `Linux／macOS 終端機` and
  `Windows PowerShell／Command Prompt`; add `WSL 也使用 Linux 指令` when
  relevant. Do not use `POSIX` as a visible title or primary platform label.

## Page skeleton

1. One-line semantic title bar without a visible page number or internal ID, 28 pt.
2. One short takeaway directly below the title.
3. One visual teaching board using two to four large cards, or one short flow.
4. One causal or interpretation strip below the board.
5. One pale-blue field strip at the bottom. It explains the first visible
   English field with Chinese name, source, purpose, unit, and interpretation.
6. Preserve the template footer and inherited background.

## Visible-title splice contract

- Visible slide titles are semantic only. Do not prefix them with page numbers
  or internal IDs such as `P019｜`, `O006｜`, `A-01｜`, `B-03｜`, or `C-04｜`.
- Keep internal IDs only in source maps, manifests, build metadata, and speaker
  notes when traceability requires them.
- This allows sections to be inserted, removed, and reordered without
  renumbering visible titles.

## Density and typography

- One page performs one teaching move.
- Use at most four major cards.
- A card contains a short heading plus no more than two short explanatory lines.
- Prefer 24 pt body text when space permits; use 18--20 pt for compact labels and
  16--18 pt only for code or the field strip. Never go below 16 pt.
- Chinese uses 標楷體. Latin letters and numerals use Times New Roman.
- Variables and formulas are italic; prose is upright.
- No text wall, dense table, unexplained arrow chain, or paragraph-shaped card.

## Lab explanation sequence

Each experiment must visibly cover these teaching moves, split across pages as
needed:

1. What the baseline does and why the experiment exists.
2. Exact file, exact decision block, and the meaning of the original code.
3. Before/after edit with one changed parameter or branch per page.
4. Exact command and expected artifact path.
5. One screenshot or editable evidence view with a small number of callouts.
6. Service result first, then delivery, endpoint energy, and efficiency.
7. Causal interpretation: code change -> event/state change -> service outcome ->
   endpoint-energy tradeoff.

## `student_policy.py` explanation

- The current executable `student_policy.py` and its packaged baseline now carry
  formal Traditional-Chinese comments for every action, editable constant,
  observation field, and decision branch. Those comments are part of the current
  policy identity and are source truth for the deck.
- During each lab, change only the assigned value inside the active marked block.
  Do not ask the class to edit, delete, or reflow the teaching comments; edits
  outside the active block are rejected against the predecessor/reference policy.
- Show only the small relevant source excerpt on a slide, with a nearby plain-
  Chinese callout. Do not shrink or paste the complete file merely because it is
  now commented.
- First show the whole `choose_action()` decision order in plain Chinese:
  contact closed, urgent deadline, pacing gap, quality hold, queue send, fallback
  wait.
- Lab A, B, and C each receive a separate before/after page. Highlight only the
  currently editable marked block and explicitly state which lines and files
  remain unchanged.
- A code page must explain each visible condition before introducing its English
  field name. Do not display an unexplained source listing.

## Screenshot pages

- Use one large identifier-free current crop, not a collage of small screens.
- Add at most three numbered callouts.
- State what the website reads, what it writes, and what remains unchanged.
- If current evidence is unavailable, show `待補` and an editable reading guide;
  never fabricate a screen or KPI.

## Publication rule

- Work-in-progress PPTX stays inside its owned build directory.
- Publish to `latest/` only after every page has been rendered and visually
  compared with the authoritative eight-slide donor.
- Use fixed filenames. A new build replaces the same-range prior file; no dated,
  preview-copy, final-final, or backup PPTX is retained in `latest/`.
