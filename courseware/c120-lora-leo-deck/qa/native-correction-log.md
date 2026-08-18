# Native educate checkpoint correction and revalidation

## Pass 1 findings

- The rejected custom dark deck did not use the requested native
  `/home/u24/ppt-master/template/educate.pptx` lifecycle.
- The native content placeholder inherited a blue bullet that appeared beside
  formula/evidence lines.
- Slide 5 used two long class identifiers as dense body labels.
- Slide 7 wrapped the last Chinese character of `機制` onto a separate line.
- Slides 8–9 were visually crowded near the footer.

## Correction

- Rebuilt by cloning the actual native cover/content slides through
  `ppt-master template-fill-pptx`.
- Preserved the template master, layouts, logo, footer, media and original
  background; no slide background or full-slide fill was added.
- Added an OOXML-only typography pass: 標楷體 for East Asian text, Times New
  Roman for Latin/number text, title size 28 pt, roman prose, italic raw LaTeX
  formula and variables.
- Disabled the inherited content bullet with `a:buNone` while retaining the
  native placeholder.
- Shortened/reflowed slides 5 and 7–9 without reducing the native body size.
- Replaced the earlier dark canonical build with the native-template build so
  the delivery path no longer points to the rejected visual direction.

## Revalidation

- PPT Master readback: `ok=36`, `warn=0`, `error=0`.
- Native OOXML QA: `PASS`, 9 slides, 9 non-empty notes, 9 titles at 28 pt,
  zero slide-level backgrounds, zero full-slide solid fills, template assets
  byte-preserved, exact Chinese word `學生` absent.
- Final renders: `renders/native-final/slide-01.jpg` through
  `slide-09.jpg`.
- Owner visual acceptance remains separate from machine QA.
