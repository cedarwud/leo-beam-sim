# BeamShift donor audit v2

Status: `READ-ONLY AUDIT COMPLETE / SOURCE DECKS UNMODIFIED`

## Scope and authority

This audit covers exactly two named BeamShift donors and writes only this
`donor-audit-v2/` directory. The C120 authority is separate from donor
evidence: `docs/decisions/ADR-004-c120-course-packaged-loraenergysim-leo.md`,
`docs/sdd/C120-LORA-LEO-COURSE-INTEGRATION-SDD.md`, and
`docs/handoff/C120-LORA-LEO-NEXT-CONTROLLER-2026-08-10.md`. They define
LoRaEnergySim as the direct smart-energy/IoT teaching core and LEO as a
changing-service-window example only. Donor pages do not override that
boundary, the endpoint/system energy split, the current runner contract, or the
claim ceiling.

## Exact source provenance

| Donor ID | Exact path | Bytes | SHA-256 | Slides | Notes | Layout | Source role |
|---|---|---:|---|---:|---:|---|---|
| `e2` | `/home/u24/papers/beamshift/e2.pptx` | 2,065,216 | `60ba796c908387cdfe06c2b82e592bcce3205e2472c42566467bbbd89dcad024` | 114 | 114/114 non-empty | 13.3333 × 7.5 in, 16:9 | content and notes donor |
| `delivery-variant` | `/home/u24/papers/beamshift/.scratch/teaching-course/v3-ee/delivery/satellite-energy-course-combined-handoff-v1.pptx` | 1,657,236 | `7dbdc23e17d7a3c6dc8d6ed76823100da6aa7f14512a8128201a42c59f5ddd34` | 114 | 0/114 non-empty | 13.3333 × 7.5 in, 16:9 | visual/provenance comparison only |

The second path exists and is readable. No missing-source placeholder is
needed. The exact file hashes above are from `sha256sum`; slide counts and
notes/layout counts are from OOXML extraction.

## Extracted evidence

`slide-inventory.json` is the loss-minimizing per-page record. Each page has:

- title and body text in shape order;
- the actual notes-body text (not image/slide-number placeholders), notes hash,
  and notes-presence flag;
- visible-text and normalized-text SHA-256 hashes;
- direct `ppt/slides/slideN.xml` and relationship hashes;
- layout name/type, layout/master part names, slide dimensions, shape counts,
  shape type counts, text boxes, tables, positions, and text hashes;
- embedded PNG media relationship names, content types, byte sizes, and media
  SHA-256 values.

`slide-inventory.csv` is the flattened title/body/notes/layout/media view.
`dedup-candidates.csv` retains exact and high-similarity cross-page candidates.

Re-derived counts:

| Evidence | `e2` | delivery variant |
|---|---:|---:|
| non-empty speaker notes | 114/114 | 0/114 |
| slides containing embedded PNG relationships | 50 | 13 |
| embedded PNG relationship count | 63 | 18 |
| unique direct slide XML hashes | 114 | 114 |

## Rendering and visual review

Both decks converted successfully to 114-page PDFs with the PPTX skill's
LibreOffice helper. PDF page size was `960.009 × 540 pt`; renders were made at
96 dpi (1281 × 720 pixels, as rounded by Poppler) with `pdftoppm`. The complete per-page PNG renders
are under `renders/e2/` and `renders/delivery/`; PDF intermediates are under
`renders/e2-pdf/` and `renders/delivery-pdf/`. Six labelled contact sheets per
deck are under `contact-sheets/`.

The contact sheets show the same 114-page chapter order and design family. The
delivery variant changes formulas, shape ordering, some labels, and selected
visual details; it is not byte-identical to `e2` and has no notes. Render
inspection supports semantic correspondence and duplicate-cluster decisions;
it does not establish owner acceptance or scientific validity.

## Hash and dedup findings

- Every title matches its same-number peer: 114/114.
- Exactly 1/114 same-number pairs have identical visible-text and
  normalized-text hashes; this is page 1. Exactly 1/114 pairs
  also share the same direct slide XML hash.
- 89/114 same-number pairs have normalized visible-text
  similarity at or above 0.99; the remaining pairs range from
  0.9680 upward and differ by formulas, shape-text order, or
  small wording/layout edits. A similarity score is evidence of correspondence,
  not permission to copy.
- Within-deck semantic duplicate clusters confirmed by text/title/layout and
  contact-sheet review are `7/98`, `16/17`, `45/46`, `54/55`, `57/58`,
  `64/65`, `67/68`, `78–80`, `83–86`, and `92–95`.

The full 228-row disposition record is `dedup-table.csv`. It assigns every
source page `ADOPT`, `APPENDIX`, or `RETIRE`; the delivery variant never owns
content/notes adoption because its authority role is visual comparison only.

## Reproducibility commands

```text
sha256sum /home/u24/papers/beamshift/e2.pptx \
  /home/u24/papers/beamshift/.scratch/teaching-course/v3-ee/delivery/satellite-energy-course-combined-handoff-v1.pptx
python courseware/c120-lora-leo-deck/donor-audit-v2/extract_pptx_inventory.py \
  --output courseware/c120-lora-leo-deck/donor-audit-v2
python /home/u24/.codex/skills/pptx/scripts/office/soffice.py --headless \
  --convert-to pdf --outdir .../renders/e2-pdf /home/u24/papers/beamshift/e2.pptx
python /home/u24/.codex/skills/pptx/scripts/office/soffice.py --headless \
  --convert-to pdf --outdir .../renders/delivery-pdf /home/u24/papers/beamshift/.scratch/teaching-course/v3-ee/delivery/satellite-energy-course-combined-handoff-v1.pptx
pdftoppm -png -r 96 <pdf> <owned-render-prefix>
python courseware/c120-lora-leo-deck/donor-audit-v2/make_contact_sheets.py \
  --root courseware/c120-lora-leo-deck/donor-audit-v2
python courseware/c120-lora-leo-deck/donor-audit-v2/build_audit_docs.py
```

## Limitations and fail-closed boundary

The audit can prove current file bytes, OOXML contents, notes presence,
rendered appearance, and the stated hash/similarity evidence. It cannot prove
the original authoring history, upstream licensing beyond the repository's
own declarations, current scientific validity of donor formulas/values, or
that a donor screenshot is current C120 evidence. If either named path becomes
missing or unreadable on rerun, the extraction script records `MISSING` and no
invented page rows are allowed.

All adoption is topic-level only. Current C120 commands, `student_policy.py`
line numbers, result artifacts, endpoint replay, browser screenshots, and
claim labels must be generated from the current course package before any
page is promoted. No donor page is classroom acceptance evidence.
