import type { CSSProperties, ReactElement } from 'react';

import { buildVisualLabGuidedReplayAnnotationPlan } from './annotationPlan';
import type {
  VisualLabGuidedReplayAnnotationCue,
  VisualLabGuidedReplayAnnotationMode,
  VisualLabGuidedReplayAnnotationPlan,
  VisualLabGuidedReplayNormalizedAnchor,
  VisualLabGuidedReplayNormalizedAnchorMap,
  VisualLabGuidedReplayId,
  VisualLabGuidedReplayPhase,
} from './types';

export interface VisualLabGuidedReplayAnnotationOverlayProps {
  readonly storyId: VisualLabGuidedReplayId;
  readonly phase: VisualLabGuidedReplayPhase;
  readonly annotationMode: VisualLabGuidedReplayAnnotationMode;
  readonly locale?: 'zh-Hant' | 'en';
  readonly anchors?: VisualLabGuidedReplayNormalizedAnchorMap;
  readonly theme?: 'dark' | 'light';
  readonly className?: string;
}

function inUnitRange(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function positiveUnitRange(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0 && value <= 1;
}

function normalizeAnchor(
  anchor: VisualLabGuidedReplayNormalizedAnchor | undefined,
): VisualLabGuidedReplayNormalizedAnchor | null {
  if (anchor === undefined || !inUnitRange(anchor.x) || !inUnitRange(anchor.y)) return null;
  return Object.freeze({
    x: anchor.x,
    y: anchor.y,
    ...(positiveUnitRange(anchor.width) ? { width: anchor.width } : {}),
    ...(positiveUnitRange(anchor.height) ? { height: anchor.height } : {}),
    ...(positiveUnitRange(anchor.radius) ? { radius: anchor.radius } : {}),
  });
}

function anchorFor(
  anchors: VisualLabGuidedReplayNormalizedAnchorMap | undefined,
  target: VisualLabGuidedReplayAnnotationCue['target'],
): VisualLabGuidedReplayNormalizedAnchor | null {
  return normalizeAnchor(anchors?.[target]);
}

function anchorStyle(anchor: VisualLabGuidedReplayNormalizedAnchor): CSSProperties {
  return {
    left: `${anchor.x * 100}%`,
    top: `${anchor.y * 100}%`,
  };
}

function circleRadius(anchor: VisualLabGuidedReplayNormalizedAnchor): number {
  return (anchor.radius ?? 0.042) * 100;
}

function AnnotationMark({
  cue,
  anchor,
}: {
  readonly cue: VisualLabGuidedReplayAnnotationCue;
  readonly anchor: VisualLabGuidedReplayNormalizedAnchor;
}): ReactElement {
  const cx = anchor.x * 100;
  const cy = anchor.y * 100;
  const className = `vlab-guided-annotation__mark is-${cue.mark} is-${cue.tone}`;
  if (cue.mark === 'spotlight' && anchor.width !== undefined && anchor.height !== undefined) {
    return (
      <rect
        className={className}
        data-guided-annotation-mark={cue.mark}
        data-guided-annotation-target={cue.target}
        x={(anchor.x - anchor.width / 2) * 100}
        y={(anchor.y - anchor.height / 2) * 100}
        width={anchor.width * 100}
        height={anchor.height * 100}
        rx="1.8"
      />
    );
  }
  return (
    <circle
      className={className}
      data-guided-annotation-mark={cue.mark}
      data-guided-annotation-target={cue.target}
      cx={cx}
      cy={cy}
      r={circleRadius(anchor)}
    />
  );
}

function AnnotationLabels({
  plan,
  anchors,
  locale,
}: {
  readonly plan: VisualLabGuidedReplayAnnotationPlan;
  readonly anchors: VisualLabGuidedReplayNormalizedAnchorMap | undefined;
  readonly locale: 'zh-Hant' | 'en';
}): ReactElement[] {
  return plan.cues.flatMap((cue) => {
    const anchor = anchorFor(anchors, cue.target);
    if (anchor === null) return [];
    return [
      <span
        key={cue.target}
        className={`vlab-guided-annotation__label is-${cue.tone}`}
        data-guided-annotation-label={cue.target}
        style={anchorStyle(anchor)}
      >{cue.label[locale]}</span>,
    ];
  });
}

function AnnotationSvg({
  plan,
  anchors,
}: {
  readonly plan: VisualLabGuidedReplayAnnotationPlan;
  readonly anchors: VisualLabGuidedReplayNormalizedAnchorMap | undefined;
}): ReactElement | null {
  const anchoredArrows = plan.arrows.flatMap((arrow) => {
    const from = anchorFor(anchors, arrow.from);
    const to = anchorFor(anchors, arrow.to);
    if (from === null || to === null) return [];
    return [(
      <line
        key={`${arrow.from}-${arrow.to}`}
        className={`vlab-guided-annotation__arrow is-${arrow.tone}`}
        data-guided-annotation-arrow={`${arrow.from}->${arrow.to}`}
        x1={from.x * 100}
        y1={from.y * 100}
        x2={to.x * 100}
        y2={to.y * 100}
        markerEnd={`url(#vlab-guided-annotation-arrowhead-${arrow.tone})`}
      />
    )];
  });
  const anchoredMarks = plan.cues.flatMap((cue) => {
    const anchor = anchorFor(anchors, cue.target);
    return anchor === null ? [] : [<AnnotationMark key={cue.target} cue={cue} anchor={anchor} />];
  });
  if (anchoredArrows.length === 0 && anchoredMarks.length === 0) return null;
  return (
    <svg
      className="vlab-guided-annotation__svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {(['service', 'candidate', 'result'] as const).map(tone => (
          <marker
            key={tone}
            id={`vlab-guided-annotation-arrowhead-${tone}`}
            className={`is-${tone}`}
            markerWidth="4"
            markerHeight="4"
            refX="3.2"
            refY="2"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M0,0 L4,2 L0,4 Z" />
          </marker>
        ))}
      </defs>
      {anchoredArrows}
      {anchoredMarks}
    </svg>
  );
}

/**
 * Render only the explanatory layer over the accepted guided scene.  Clean
 * mode is intentionally null; annotated mode never treats a missing anchor
 * as a tracked object and keeps the subtitle visible as the fail-soft path.
 */
export function VisualLabGuidedReplayAnnotationOverlay({
  storyId,
  phase,
  annotationMode,
  locale = 'zh-Hant',
  anchors,
  theme = 'dark',
  className,
}: VisualLabGuidedReplayAnnotationOverlayProps): ReactElement | null {
  if (annotationMode === 'clean') return null;
  const plan = buildVisualLabGuidedReplayAnnotationPlan(storyId, phase);
  const anchoredCueCount = plan.cues.filter(cue => anchorFor(anchors, cue.target) !== null).length;
  const anchoredArrowCount = plan.arrows.filter(arrow => (
    anchorFor(anchors, arrow.from) !== null && anchorFor(anchors, arrow.to) !== null
  )).length;
  const anchorState = anchoredCueCount > 0 || anchoredArrowCount > 0 ? 'anchored' : 'subtitle-only';
  return (
    <div
      className={['vlab-guided-annotation', `vlab-guided-annotation--${theme}`, className].filter(Boolean).join(' ')}
      data-guided-annotation="annotated"
      data-guided-annotation-anchor-state={anchorState}
      data-guided-phase={phase}
      data-guided-story={storyId}
      aria-label={`${plan.title[locale]} · ${plan.phaseLabel[locale]}`}
      style={{ pointerEvents: 'none' }}
    >
      <div className="vlab-guided-annotation__subtitle" role="status" aria-live="polite">
        <span className="vlab-guided-annotation__phase">{plan.phaseLabel[locale]}</span>
        <span>{plan.subtitle[locale]}</span>
      </div>
      <AnnotationSvg plan={plan} anchors={anchors} />
      <div className="vlab-guided-annotation__labels" aria-hidden="true">
        {AnnotationLabels({ plan, anchors, locale })}
      </div>
    </div>
  );
}
