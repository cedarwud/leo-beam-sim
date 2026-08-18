# P019–P027b final QA

Date: 2026-08-11

## Delivery

- Published output: `../../latest/LoRaEnergySim-LEO-ALT-PART-A-V2-P019-P027B-REVIEW.pptx`
- Scope: P019, P020, P021a–P021c, P022, P023, P024a–P024b, P025a–P025b, P026a–P026b, P027a–P027b
- Template: `/home/u24/pptx-wrap/assets/templates/educate.pptx`; SHA-256 `3a90b0106c6587d720b5a46c653a31937ccd649b30890563c70a53c4cc5d25b8`
- Shell: source slide 2 / `slideLayout2.xml` only; inherited background, logo, footer rule, and page number retained
- Typography: title 28 pt; authored text minimum 16 pt (preferred 18–24 pt); CJK `標楷體`; Latin/numerals `Times New Roman`
- Published PPTX SHA-256: `513afaad501cae22e89f60bd5175564d35ac5573063c3bb46124fbeff77311f3`

## Checks

- `qa/structural_qa.py`: PASS — ZIP/XML/relationships/content types, 15 slides, 15 notes, layout2-only, no direct slide backgrounds, font contract, forbidden-language scan, internal Pxxx source/order alignment, and visible-title ID-free check. Chinese-first teaching titles carry the meaning; IDs remain only in source maps/notes.
- `qa/geometry_qa.py`: PASS — all authored shapes inside safe bounds; no protected-logo collisions; every slide has text and a visual board.
- Office validator (`/home/u24/.codex/skills/pptx/scripts/office/validate.py`): PASS — all validations passed.
- `shared/qa_v2_deck.py`: PASS — 15 slides, 15 notes, minimum explicit font 16 pt, no errors/warnings.
- `python -m markitdown`: PASS — extracted all slide text and notes; no placeholder residue.
- LibreOffice headless conversion: PASS — 15-page PDF at 960.009 × 540 pt; page PNGs rendered at 144 dpi under `local-qa/part-a-p019-p027b-final/png/`.

## Visual repair

The lane was redrawn against the approved P001–P008 donor style: Chinese-first teaching claims, one short takeaway, two to four large cards, one Chinese-first causal strip, and one bottom field contract. P019 defines WSL before using the path and labels the Linux/macOS terminal; P020–P021c now split the setup into independent actions with exact Linux/WSL, macOS, Windows PowerShell, and Windows Command Prompt commands for Python 3.11 discovery/install, `.venv` creation, activation, locked requirements install, and READY verification, including visible success and stop points. P023 and P024b provide the read-only Chinese policy mirror; P025a/P025b/P026a keep one Lab per page and show the unique Before/After value large, with exact file/block and fixed observation cards. P027b visibly distinguishes the two JSON artifacts and states that the website imports only `result.json`, not the runner. Visual inspection covered every page rendered from the published PPTX at original PNG geometry; no visible overlap, clipping, footer collision, or protected-logo collision remains.

Speaker notes retain the complete operation, mechanism, expected output, interpretation, provenance boundary, and exact lab commands; visible cards are intentionally concise for projected teaching.
