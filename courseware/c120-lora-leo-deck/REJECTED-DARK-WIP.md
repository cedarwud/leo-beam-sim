# Rejected dark WIP boundary

The following earlier artifacts are preserved as dirty WIP/evidence only and
must not be used as the current build source:

- `build-opening-checkpoint.js`
- `design_brief.json`
- `content_plan.json`
- `outline.zh-TW.json`
- `qa/pass-*` and `qa/final-strict*`
- `renders/pass-*`

They represent the superseded custom dark direction.  The canonical opening
PPTX path has been overwritten with the native-template build, but the earlier
scripts/reports remain intact to preserve provenance.

Current build authority:

- actual template: `/home/u24/ppt-master/template/educate.pptx`;
- original white background/master/colors, no added fill;
- native fill plans under `projects/opening-checkpoint_ppt169_20260811/` and
  `projects/full-deck_ppt169_20260811/`;
- typography/background post-process: `format-native-template.py`;
- fail-closed native QA: `qa-native-pptx.py`.
