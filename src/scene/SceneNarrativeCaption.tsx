import type { JSX } from 'react';
import { Html } from '@react-three/drei';

import { useLocale } from '../i18n';
import type { NarrativeCaptionChapter, NarrativeCaptionText } from './narrativeCaptionPolicy';

const CAPTION_TOP_MARGIN_PX = 16;
const CAPTION_SIDE_MARGIN_PX = 16;

export interface NarrativeCaptionDisplay {
  readonly chapter: NarrativeCaptionChapter;
  readonly text: NarrativeCaptionText;
}

export interface SceneNarrativeCaptionProps {
  readonly caption: NarrativeCaptionDisplay | null;
  readonly enabled: boolean;
}

/**
 * This caption narrates the CURRENT DECISION-ENGINE CHAPTER, not a specific
 * satellite, so it is fixed to the top of the scene canvas rather than
 * projected from any 3D position. Returning the canvas centre in screen
 * space and letting drei's `fullscreen` recentre from there makes the
 * wrapping `Html` div exactly the canvas's own pixel size — the same width
 * the main scene already renders at between the two sidebars — with no
 * separate sidebar-width lookup needed.
 */
function screenCenterPosition(
  _el: unknown,
  _camera: unknown,
  size: { readonly width: number; readonly height: number },
): number[] {
  return [size.width / 2, size.height / 2];
}

/**
 * A compact banner fixed to the top of the main scene; it is intentionally
 * not a HUD block. It narrates the current decision-engine chapter only —
 * satellite/beam identity and EE figures already live in the right sidebar,
 * so this text never repeats them.
 *
 * No internal show/fade timer: unlike the one-shot event flashes this
 * replaced, a chapter is a STATE that holds for as long as
 * `advanceNarrativeCaptionHold` (`narrativeCaptionPolicy.ts`) says it does —
 * which can be a few seconds (`switching`) or tens of seconds (`guard`).
 * Auto-hiding after a fixed timer would cut a long chapter's text off mid-way
 * for no reason; the caller already controls exactly when `caption` changes.
 */
export function SceneNarrativeCaption({
  caption,
  enabled,
}: SceneNarrativeCaptionProps): JSX.Element | null {
  const { locale } = useLocale();
  if (!enabled || caption === null) return null;
  const isEnglish = locale === 'en';
  return (
    <Html
      fullscreen
      calculatePosition={screenCenterPosition}
      zIndexRange={[80, 20]}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <div
        data-testid="scene-narrative-caption"
        data-caption-chapter={caption.chapter}
        style={{
          position: 'absolute',
          top: CAPTION_TOP_MARGIN_PX,
          left: CAPTION_SIDE_MARGIN_PX,
          right: CAPTION_SIDE_MARGIN_PX,
          display: 'grid',
          gap: 2,
          padding: '9px 12px',
          borderInlineStart: '4px solid #76ead7',
          borderRadius: 8,
          maxWidth: 1040,
          marginInline: 'auto',
          background: 'rgba(4, 18, 25, 0.94)',
          color: '#f1fbff',
          boxShadow: '0 10px 24px rgba(0, 0, 0, 0.36)',
          font: '19px/1.6 "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif',
        }}
      >
        <strong style={{ fontSize: 15, color: '#76ead7' }}>
          {isEnglish ? caption.text.eventLabelEn : caption.text.eventLabelZhHant}
        </strong>
        <span>{isEnglish ? caption.text.narrationEn : caption.text.narrationZhHant}</span>
      </div>
    </Html>
  );
}
