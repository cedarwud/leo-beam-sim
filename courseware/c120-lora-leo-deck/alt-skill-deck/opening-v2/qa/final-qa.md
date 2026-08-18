# Opening V2 QA

Output: `/home/sat/leo-beam-sim/courseware/c120-lora-leo-deck/alt-skill-deck/LoRaEnergySim-LEO-ALT-OPENING-V2-REVIEW.pptx`

## Build contract

- 11 opening slides (`O001`–`O011); 11 speaker-notes slides.
- Exact template: `/home/sat/pptx-wrap/assets/templates/educate.pptx`.
- Template SHA-256: `3a90b0106c6587d720b5a46c653a31937ccd649b30890563c70a53c4cc5d25b8`.
- All authored slides use source slide 2 / `slideLayout2.xml`.
- No authored slide-level background fill; inherited template field, logo, divider, and slide-number system retained.
- Typography readback: title 28 pt; authored text floor 16 pt; Chinese `標楷體`; Latin/numerals `Times New Roman`.
- Speaker notes are embedded and directly readable formal narration.

## Completed checks

- ZIP integrity and required package parts: PASS.
- Recursive slide, notes, and relationship XML parse: PASS.
- Internal relationship targets: PASS.
- Slide count / notes count: PASS (`11 / 11`).
- Slide-layout target: PASS (`slideLayout2.xml` only).
- Authored slide backgrounds: PASS (none).
- Duplicate creation IDs: PASS (none).
- Font floor and title floor: PASS (`16 pt` / `28 pt`).
- Forbidden-language and placeholder scans: PASS.
- Required-content readback: PASS, including `http://120.126.151.102:3000/course`, POSIX/Windows run commands, paired `result.json` / `endpoint-replay.json`, service-first interpretation, and claim ceiling.
- Geometry bounds and non-containment overlap review: PASS after one fix-and-reverify cycle. Connector/card and footer-band proximity issues were corrected before the final pass.
- Embedded evidence crops: PASS; three permitted clean current `/course` crops are embedded as `ppt/media/image4.png`–`image6.png`, and the slide labels them as same-scenario fallback evidence.

## Deferred by server override

- Visual rendering and original-proportion image inspection: deferred; no LibreOffice/`soffice` or other installed PPTX renderer was available.
- Microsoft PowerPoint reopen/repair check: deferred to the controller environment.

No commit or push was performed.
