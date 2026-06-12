// G1-LEFT-DEFAULT — the thin read-only left-rail default for the SINR-live lane.
//
// North star 少按鈕 / 直覺 / 零學習: the SINR-live left aside used to default to the
// heavy SINR-formula tuner. It now defaults to this light orientation card —
// what the viewer is looking at, a compact live serving readout, and a pointer
// that the display / camera / tuning power tools live in the ⚙ Advanced drawer.
//
// Truth: read-only. It reuses the SAME pure deriveSinrServingMosaicAggregate over
// the published per-UE serving samples (SimState.perUePositions) as the ambient
// SinrServingAggregate HUD — it computes counts/means, never invents a serving
// assignment or a SINR (claim-kind "sinr-serving", lane-truthful).
import { type ReactElement } from 'react';
import {
  deriveSinrServingMosaicAggregate,
  type SinrServingMosaicUeInput,
} from '../scene/sinrServingMosaic';

interface SinrLiveOrientationCardProps {
  /** `SimState.perUePositions` — live per-UE serving samples (undefined for N≤1). */
  readonly perUePositions?: ReadonlyArray<SinrServingMosaicUeInput & { id: string }>;
}

export function SinrLiveOrientationCard({
  perUePositions,
}: SinrLiveOrientationCardProps): ReactElement {
  const aggregate = deriveSinrServingMosaicAggregate(perUePositions ?? []);
  const avgSinr = aggregate.avgServedSinrDb;
  return (
    <section
      className="leo-sinr-orientation-card leo-sidebar-content-stack"
      aria-label="Live SINR scene summary"
      data-testid="sinr-live-orientation-card"
      data-claim-kind="sinr-serving"
    >
      <div className="leo-sinr-orientation-head">
        <strong>Live SINR</strong>
        <span>LEO multi-beam · earth-fixed cell truth</span>
      </div>
      <dl className="leo-sinr-orientation-stats" data-testid="sinr-live-orientation-stats">
        <div>
          <dt>Served</dt>
          <dd>{aggregate.servedCount}/{aggregate.totalCount}</dd>
        </div>
        <div>
          <dt>Serving beams</dt>
          <dd>{aggregate.servingBeamCount}</dd>
        </div>
        <div>
          <dt>Mean SINR</dt>
          <dd>{avgSinr === null ? '—' : `${avgSinr.toFixed(1)} dB`}</dd>
        </div>
      </dl>
      <p className="leo-sinr-orientation-hint">
        Display, camera &amp; SINR tuning live in <strong>⚙ Advanced</strong> below.
      </p>
    </section>
  );
}
