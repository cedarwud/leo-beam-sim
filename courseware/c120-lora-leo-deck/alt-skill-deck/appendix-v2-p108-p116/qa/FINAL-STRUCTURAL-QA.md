# P108-P116 structural QA

The owned root export is:

`courseware/c120-lora-leo-deck/alt-skill-deck/LoRaEnergySim-LEO-ALT-APPENDIX-V2-P108-P116-REVIEW.pptx`

The export contains exactly nine authored slides, P108-P116, and nine formal narration notes. It was rebuilt with the managed PptxGenJS runtime and the exact EDU template/master route. The authored slides are relinked to `slideLayout2.xml`; template background, logo, divider, footer, and page-number parts remain template-owned.

The following checks passed on the rebuilt root PPTX:

- ZIP integrity and recursive XML/relationship parsing.
- Nine presentation slide IDs, nine slide parts, and nine notes parts.
- Every slide relationship targets `slideLayout2.xml`; all package relationship targets resolve.
- Slide/notes shape structure, content-type overrides, and page geometry.
- No authored slide background, duplicate shape ID, or duplicate creation ID.
- Exact title sequence and source-map coverage for P108-P116.
- Authored font floor at or above 16pt; authored faces are `標楷體` and `Times New Roman`.
- Substantive notes and forbidden-language/identifier scan.

The readback text is recorded in `qa/readback.txt`; machine-readable results are in `qa/structural-qa.json`. Current evidence remains explicitly labelled as same-scenario fallback where used, and unavailable run identities or system/canonical values remain `待補`.

Visual rendering and PowerPoint reopen are deferred. The server has no LibreOffice/soffice executable or PPTX renderer; `pdftoppm` alone cannot render a PPTX. The controller environment must perform the page-by-page render/inspection and native PowerPoint reopen before those checks can be claimed as passed.
