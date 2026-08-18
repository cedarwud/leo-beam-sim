import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { VisualLabGuidedReplayAnnotationOverlay } from './annotationOverlay';
import type { VisualLabGuidedReplayNormalizedAnchorMap } from './types';

const anchors: VisualLabGuidedReplayNormalizedAnchorMap = {
  'serving-satellite': { x: 0.24, y: 0.22, width: 0.09, height: 0.07 },
  'candidate-satellite': { x: 0.72, y: 0.24, width: 0.09, height: 0.07 },
  ue: { x: 0.46, y: 0.62, radius: 0.03 },
  'serving-beam': { x: 0.32, y: 0.46, radius: 0.04 },
  'candidate-beam': { x: 0.66, y: 0.46, radius: 0.04 },
  'sinr-result': { x: 0.82, y: 0.68, width: 0.1, height: 0.05 },
  'power-result': { x: 0.82, y: 0.76, width: 0.1, height: 0.05 },
  'throughput-result': { x: 0.82, y: 0.84, width: 0.1, height: 0.05 },
  'ee-result': { x: 0.82, y: 0.92, width: 0.1, height: 0.05 },
};

const clean = renderToStaticMarkup(
  <VisualLabGuidedReplayAnnotationOverlay
    storyId="inter-handover"
    phase="decision"
    annotationMode="clean"
    anchors={anchors}
  />,
);
assert.equal(clean, '', 'clean mode renders null');

const zhAnnotated = renderToStaticMarkup(
  <VisualLabGuidedReplayAnnotationOverlay
    storyId="inter-handover"
    phase="decision"
    annotationMode="annotated"
    locale="zh-Hant"
    anchors={anchors}
  />,
);
assert.match(zhAnnotated, /data-guided-annotation="annotated"/);
assert.match(zhAnnotated, /data-guided-annotation-anchor-state="anchored"/);
assert.match(zhAnnotated, /到達資料中的跨衛星換手事件/);
assert.match(zhAnnotated, /服務衛星/);
assert.match(zhAnnotated, /候選衛星/);
assert.match(zhAnnotated, /data-guided-annotation-mark="spotlight"/);
assert.match(zhAnnotated, /data-guided-annotation-arrow="serving-satellite-&gt;candidate-satellite"/);
assert.match(zhAnnotated, /pointer-events:none/);

const enAnnotated = renderToStaticMarkup(
  <VisualLabGuidedReplayAnnotationOverlay
    storyId="intra-beam-handover"
    phase="comparison"
    annotationMode="annotated"
    locale="en"
    anchors={anchors}
  />,
);
assert.match(enAnnotated, /Compare SINR, power, throughput, and EE across the beam switch/);
assert.match(enAnnotated, /Serving beam/);
assert.match(enAnnotated, /Candidate beam/);
assert.match(enAnnotated, /EE result/);

const subtitleOnly = renderToStaticMarkup(
  <VisualLabGuidedReplayAnnotationOverlay
    storyId="intra-beam-handover"
    phase="after"
    annotationMode="annotated"
    locale="zh-Hant"
    anchors={{}}
  />,
);
assert.match(subtitleOnly, /data-guided-annotation-anchor-state="subtitle-only"/);
assert.match(subtitleOnly, /切換完成，同衛星改由候選波束服務/);
assert.doesNotMatch(subtitleOnly, /<svg/);
assert.doesNotMatch(subtitleOnly, /data-guided-annotation-mark=/);
assert.doesNotMatch(subtitleOnly, /data-guided-annotation-label=/);
assert.doesNotMatch(subtitleOnly, /data-guided-annotation-arrow=/);

const invalidAnchor = renderToStaticMarkup(
  <VisualLabGuidedReplayAnnotationOverlay
    storyId="inter-handover"
    phase="before"
    annotationMode="annotated"
    anchors={{ 'serving-satellite': { x: 1.4, y: 0.2 } }}
  />,
);
assert.match(invalidAnchor, /data-guided-annotation-anchor-state="subtitle-only"/);
assert.doesNotMatch(invalidAnchor, /data-guided-annotation-mark=/);

const styleSource = readFileSync(new URL('./annotationOverlay.scss', import.meta.url), 'utf8');
assert.match(styleSource, /pointer-events:\s*none/);
assert.match(styleSource, /font-size:\s*14px/);
assert.match(styleSource, /font-size:\s*16px/);
assert.match(styleSource, /prefers-reduced-motion/);
assert.doesNotMatch(styleSource, /font-size:\s*(?:[0-9]|1[0-3])px/);

console.log('visual-lab guided replay annotation overlay clean/annotated and fail-soft tests passed');
