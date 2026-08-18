# `educate.pptx` native-template fit report

Status: `NATIVE FILL SELECTED / VALIDATED`

## Verified intake

- Requested template: `/home/u24/ppt-master/template/educate.pptx`
- SHA-256: `3a90b0106c6587d720b5a46c653a31937ccd649b30890563c70a53c4cc5d25b8`
- Canvas: `13.3333 × 7.5 in`, 16:9.
- Physical source slides: 2: native cover and native title/body/footer.
- Background: original white master with low-opacity abstract artwork.
- Theme contract already matches the owner request: Times New Roman Latin,
  標楷體 East Asian, 28 pt content-slide title.

## Selected lifecycle

The user explicitly selected the actual native template and its original
background/colors.  `ppt-master template-fill-pptx` therefore clones source
slide 1 once for the cover and source slide 2 for all subsequent pages.

This lifecycle preserves:

- native master and layouts;
- top institutional logo and bottom teaching-alliance strip;
- original background artwork and color palette;
- editable title, body and authority text placeholders;
- speaker notes.

No dark adaptation, slide background fill, full-slide solid rectangle, donor
background or donor house style is used.

## Fit boundary

The source body placeholder is physically `12.486 × 5.677 in`, but the analyzer
misclassifies it as a short `label_candidate`.  Its capacity warning is
accepted only because the actual geometry is large; original-size render QA,
not the mislabeled heuristic, decides fit.

The native route is intentionally typographic: each page uses one dominant
editable causal chain, state ribbon, evidence ledger, decision grammar or
placeholder frame inside the original body region.  It does not invent current
browser pixels or KPI evidence.

## Post-fill typography-only pass

The OOXML post-process changes text styling only:

- Chinese: 標楷體;
- English and numerals: Times New Roman;
- all titles: exactly 28 pt;
- variables and raw LaTeX formula runs: italic;
- all other text: roman;
- inherited content bullets: explicitly disabled.

The pass does not create shapes, fills, masters, layouts, images or slide
backgrounds.  Native OOXML QA compares master/layout/theme/media bytes to the
requested template and fails closed on change.

## Verified outputs

- Opening checkpoint: 9 slides, PPT Master readback `36/36`, native OOXML QA
  `PASS`.
- Full deck: production authorized on 2026-08-11; unfrozen release/API/command/
  browser/KPI evidence remains visible placeholder-only.
