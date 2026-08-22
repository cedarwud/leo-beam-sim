import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { Html } from '@react-three/drei';

import './SixActsAnnotation.scss';

/**
 * The floating narration card — the proposal's second cross-cutting principle,
 * "懸浮解說即字幕".
 *
 * Narration is PINNED to the thing it is about, not parked in a sidebar. That
 * matters for two reasons the proposal names: a recording carries its own
 * subtitles, and a slide screenshot arrives with the explanation already in
 * frame. A caption in a side panel is cropped out of both.
 *
 * Two mounts, one look:
 *   - `SixActsSceneCard` pins to a 3D position via drei's `Html`
 *   - `SixActsOverlayCard` pins to a percentage position over a 2D stage
 */

export type SixActsCardTone = 'neutral' | 'serving' | 'candidate' | 'warn' | 'source';

export interface SixActsCardContent {
  /** Small kicker above the headline, e.g. the phase or the quantity. */
  readonly eyebrow?: string;
  readonly title: string;
  readonly body?: string;
  /** Compact metric rows shown under the body. */
  readonly rows?: readonly { readonly label: string; readonly value: string }[];
  /** Provenance badge; omitted when a card carries no measured number. */
  readonly badge?: string;
  readonly tone?: SixActsCardTone;
}

function CardBody({ content }: { readonly content: SixActsCardContent }): ReactElement {
  return (
    <>
      {content.eyebrow === undefined ? null : <span className="sa-card__eyebrow">{content.eyebrow}</span>}
      <strong className="sa-card__title">{content.title}</strong>
      {content.body === undefined ? null : <p className="sa-card__body">{content.body}</p>}
      {content.rows === undefined || content.rows.length === 0 ? null : (
        <dl className="sa-card__rows">
          {content.rows.map(row => (
            <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>
          ))}
        </dl>
      )}
      {content.badge === undefined ? null : <em className="sa-card__badge">{content.badge}</em>}
    </>
  );
}

/**
 * A card pinned to a point in a 3D scene.
 *
 * Rendered at CONSTANT screen size by default. `distanceFactor` would scale the
 * card with camera distance, which sounds right and is not: at a teaching
 * camera it produced cards larger than the geometry they annotate. A subtitle
 * should stay a subtitle however far the camera is.
 */
export function SixActsSceneCard({
  position, content, distanceFactor, occlude = false,
}: {
  readonly position: readonly [number, number, number];
  readonly content: SixActsCardContent;
  readonly distanceFactor?: number;
  readonly occlude?: boolean;
}): ReactElement {
  return (
    <Html
      position={[...position]}
      center
      distanceFactor={distanceFactor}
      occlude={occlude}
      zIndexRange={[20, 0]}
    >
      <div className={`sa-card is-${content.tone ?? 'neutral'}`}>
        <CardBody content={content} />
      </div>
    </Html>
  );
}

/** A card pinned over a 2D stage, positioned in percent of the stage box. */
export function SixActsOverlayCard({
  leftPercent, topPercent, content, anchor = 'top-left',
}: {
  readonly leftPercent: number;
  readonly topPercent: number;
  readonly content: SixActsCardContent;
  readonly anchor?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}): ReactElement {
  const style: CSSProperties = {
    left: `${leftPercent}%`,
    top: `${topPercent}%`,
    transform: `translate(${anchor.includes('right') ? '-100%' : '0'}, ${anchor.includes('bottom') ? '-100%' : '0'})`,
  };
  return (
    <div className={`sa-card is-overlay is-${content.tone ?? 'neutral'}`} style={style}>
      <CardBody content={content} />
    </div>
  );
}

/** Wraps a 2D stage so overlay cards position against it. */
export function SixActsOverlayStage({ children }: { readonly children: ReactNode }): ReactElement {
  return <div className="sa-overlay-stage">{children}</div>;
}

/**
 * A subtitle BAR across the foot of a stage.
 *
 * The floating-card version of this put narration boxes over the middle of the
 * scene, which hid the thing being narrated — review found every page doing it.
 * A subtitle is a band at the bottom; that is what makes it a subtitle and not
 * an obstruction. Values that must sit ON an object stay as small pinned tags.
 */
export function SixActsSubtitleBar({
  eyebrow, text, rows, tone = 'neutral',
}: {
  readonly eyebrow?: string;
  readonly text: string;
  readonly rows?: readonly { readonly label: string; readonly value: string }[];
  readonly tone?: SixActsCardTone;
}): ReactElement {
  return (
    <div className={`sa-subtitle is-${tone}`}>
      <p>
        {eyebrow === undefined ? null : <span className="sa-subtitle__eyebrow">{eyebrow}</span>}
        {text}
      </p>
      {rows === undefined || rows.length === 0 ? null : (
        <dl>
          {rows.map(row => (
            <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>
          ))}
        </dl>
      )}
    </div>
  );
}
