# `/course` current browser evidence

- Source: `http://120.126.151.102:3000/course`
- Capture date: 2026-08-11, Asia/Taipei
- Browser viewport: 1920 × 1080 unless noted by the PNG dimensions
- Capture method: Playwright against the live page

## Files and observed state

| File | View | State visible at capture time |
|---|---|---|
| `course-prepare-full.png` | Prepare | Local progress restored; runner state shows the fallback environment. |
| `course-lab-a-full.png` | Lab A | Fallback result is present. The raw page includes a SHA field that must not be placed in the presentation. |
| `course-lab-b-full.png` | Lab B | No result imported; current empty-state message is visible. |
| `course-lab-c-full.png` | Lab C | No result imported; current empty-state message is visible. |
| `course-evidence-full.png` | Evidence | No replay loaded; Leo scenario metadata and the empty result panel are visible. |
| `course-workbook-full.png` | Workbook | No exported workbook; checkpoint 0 and 0/10 completion are visible. |

## Presentation use

- Do not scale a complete tall page into a single slide. Use a readable crop or a single UI region, then explain each visible field or control beside it.
- Do not include the SHA field from the Lab A image.
- Lab B, Lab C, Evidence, and Workbook are current empty-state evidence, not completed experiment results.
- Keep the page's own `SIMULATED TEACHING DATA / NOT LIVE / NOT MEASURED / NOT CANONICAL-PARITY-VERIFIED` label only inside an authentic screenshot crop; do not recreate it as a repeated presentation footer.
