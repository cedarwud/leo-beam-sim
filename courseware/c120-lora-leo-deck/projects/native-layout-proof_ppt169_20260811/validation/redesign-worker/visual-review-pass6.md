# C-120 native proof — pass6 visual review

## Render boundary

The final editable artifact is `c120-native-layout-proof-redesign-pass6.pptx`.
It retains the native OMML branch and the SVG/PNG fallback media.  LibreOffice
would not load the raw `AlternateContent` package directly in this runtime, so
the six JPGs below were rendered from the explicit render-only surrogate:

1. Replace logical slide 5 `mc:AlternateContent` with its PNG fallback only.
2. Remove the unused SVG relationship from that surrogate.
3. Open/save the surrogate with `python-pptx` to a temporary `/tmp` path.
4. Convert that temporary render surrogate with LibreOffice.

The temporary resave is not the teaching deliverable and is never used as the
editable final.

## Page-by-page inspection

| Page | Main visual | Result | Inspection |
| ---: | --- | --- | --- |
| 1 | Four-node policy → state → energy → service route | PASS | Title/subtitle hierarchy is centered; route has clear spacing and no inherited bottom carrier. |
| 2 | Five-node horizontal causal flow | PASS | Nodes, arrows and takeaway are aligned; no clipping or collision. |
| 3 | Open core/LEO frames with service-window timeline | PASS | LEO is visibly bounded to the changing service window; both frames keep breathing room. |
| 4 | Three-step vertical executable path | PASS | Commands are readable at 18pt; the long policy label is intentionally two lines; recovery text is separated. |
| 5 | Central equation canvas | PASS (surrogate) | High-resolution PNG surrogate is legible; final keeps 2 editable `a14:m` / 2 `m:oMath` equations plus original SVG fallback. |
| 6 | Evidence chain plus server-preview image | PASS | Status is a figure-header tag, screenshot is within bounds, interpretation callout is readable, and no bottom status/footer line remains. |

## Structural evidence

- Footer/master cleanup: 25 inherited bottom banner/page-number carriers removed.
- Slide-level background nodes: 0; full-slide shapes added by redesign: 0.
- Forbidden visible deck text checks: `學生`, `分鐘`, and `120分鐘` absent.
- Font policy recorded in `qa-report-pass6.json`: 標楷體 for Chinese, Times New Roman for Latin, 28pt title, 24pt body default, 18pt commands/captions.
- Screenshot source SHA-256: `a515857ef52f0a76536aa725967b273bb2e33c2eeafe225e4be7cba775782687`.

## Reproduction

```bash
python3 courseware/c120-lora-leo-deck/redesign-native-proof.py \
  courseware/c120-lora-leo-deck/projects/native-layout-proof_ppt169_20260811/validation/c120-native-layout-proof-equations-pass3.pptx \
  courseware/c120-lora-leo-deck/projects/native-layout-proof_ppt169_20260811/validation/redesign-worker/c120-native-layout-proof-redesign-pass6.pptx \
  --screenshot courseware/c120-lora-leo-deck/evidence/browser-server-preview/02-endpoint-replay-imported.png \
  --fallback-png courseware/c120-lora-leo-deck/projects/native-layout-proof_ppt169_20260811/validation/redesign-worker/equations-fallback-hires.png \
  --report courseware/c120-lora-leo-deck/projects/native-layout-proof_ppt169_20260811/validation/redesign-worker/design-report-pass6.json \
  --qa-report courseware/c120-lora-leo-deck/projects/native-layout-proof_ppt169_20260811/validation/redesign-worker/qa-report-pass6.json
```

