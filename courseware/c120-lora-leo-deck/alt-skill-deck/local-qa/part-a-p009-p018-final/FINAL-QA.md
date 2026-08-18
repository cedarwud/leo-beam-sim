# Part A P009–P018 final QA

Date: 2026-08-11

## Delivery

- Published output: `../latest/LoRaEnergySim-LEO-ALT-PART-A-V2-P009-P018-REVIEW.pptx`
- Scope: P009–P018
- Template: `/home/u24/pptx-wrap/assets/templates/educate.pptx`
- Shell: source slide 2 / `slideLayout2.xml` only; inherited template background, footer, logo, and page number retained
- Typography: title 28 pt; authored text minimum 18 pt; CJK `標楷體`; Latin and numerals `Times New Roman`

## Checks

- Lane package QA: PASS — 10 slides, 10 notes, layout2-only, no authored slide background, unique creation ids, no malformed XML or relationship errors, no forbidden-language hits.
- `shared/qa_v2_deck.py`: PASS — 10 slides, 10 notes, minimum explicit font 18 pt, no errors or warnings.
- `python -m markitdown`: PASS — all slide text and notes extracted; no placeholder residue or forbidden-language hit.
- LibreOffice headless conversion: PASS — 10-page PDF at 960.009 × 540 pt; all 10 page PNGs rendered at 144 dpi under this directory.

## Visual review

Every rendered page was inspected against the approved P001–P008 donor rhythm: one short takeaway, two to four large cards, one causal strip, and one bottom field contract. P009 now uses three compact teaching cards for「套件已完成／本次只做／完成後看什麼」; its middle edit card is shorter and names the single marked policy block while keeping the Chinese comments unchanged. P010–P018 sparse cards were also tightened and their freed space was used for concrete completion and interpretation cues. P010 package-root text, P014/P015 platform paths, P017 WSL steps, and P018 Python-path wording were shortened to prevent narrow-card collisions or split English tokens. No visible overlap, clipping, footer collision, or protected-logo collision remains.

The Beginner comprehension gate is applied: visible pages lead with plain-language purpose, introduce only a small number of English tokens, and keep complete command detail in formal speaker notes. Notes state what each command reads, what it changes, what remains unchanged, expected output, recovery boundary, and interpretation.
