/**
 * SINR-serving aggregate readout (S2).
 *
 * The ambient `served N/N` + per-beam load + mean served SINR readout for the
 * `sinr-live` lane — a right-sidebar "LIVE RUN" section block (it used to float
 * in-scene). Always-on (the low-density default per Rule#10): it proves
 * G3 — every UE in the live population is served and the service is distributed
 * across multiple beams (not "1 UE performs, 99 are decoration").
 *
 * Honesty (governance Rule#6, SDD §9):
 * - Lane-truthful, stamped `data-claim-kind="sinr-serving"`. It reads ONLY the
 *   live per-UE serving truth published in `SimState.perUePositions`; it
 *   computes counts/averages but never invents a serving assignment or a SINR.
 * - It NEVER mentions MODQN / producer and NEVER claims decision proof — the
 *   only thing it asserts is "this many UEs are served, by this many beams, at
 *   this mean live SINR".
 * - The per-beam swatch uses the SAME stable serving-beam colour as the 3D
 *   mosaic, so the readout and the scene agree.
 */
import type { JSX } from 'react';
import {
  deriveSinrServingMosaicAggregate,
  type SinrServingMosaicUeInput,
} from '../scene/sinrServingMosaic';

interface SinrServingAggregateProps {
  /** `SimState.perUePositions` — live per-UE serving samples (undefined for N≤1). */
  readonly perUePositions?: ReadonlyArray<SinrServingMosaicUeInput & { id: string }>;
  readonly visible: boolean;
}

const MAX_BEAM_LOAD_ROWS = 4;

function formatSinr(sinrDb: number | null): string {
  return sinrDb == null ? '—' : `${sinrDb.toFixed(1)} dB`;
}

export function SinrServingAggregate({
  perUePositions,
  visible,
}: SinrServingAggregateProps): JSX.Element | null {
  if (!visible || perUePositions === undefined || perUePositions.length === 0) {
    return null;
  }
  const aggregate = deriveSinrServingMosaicAggregate(perUePositions);
  if (aggregate.totalCount === 0) return null;
  const topLoads = aggregate.beamLoads.slice(0, MAX_BEAM_LOAD_ROWS);

  return (
    <div
      className="leo-sinr-serving-aggregate"
      data-testid="sinr-serving-aggregate"
      data-claim-kind="sinr-serving"
      data-served-count={aggregate.servedCount}
      data-total-count={aggregate.totalCount}
      data-serving-beam-count={aggregate.servingBeamCount}
      data-avg-sinr-db={aggregate.avgServedSinrDb == null ? '' : aggregate.avgServedSinrDb.toFixed(1)}
    >
      <div className="leo-sinr-serving-aggregate__title">Service · live SINR</div>
      <div className="leo-sinr-serving-aggregate__served">
        <span className="leo-sinr-serving-aggregate__served-value" data-testid="sinr-serving-served-readout">
          {aggregate.servedCount}/{aggregate.totalCount}
        </span>
        <span className="leo-sinr-serving-aggregate__served-label">UEs served</span>
      </div>
      <div className="leo-sinr-serving-aggregate__stats">
        <span>{aggregate.servingBeamCount} serving beams</span>
        <span>avg {formatSinr(aggregate.avgServedSinrDb)}</span>
      </div>
      {topLoads.length > 0 && (
        <div className="leo-sinr-serving-aggregate__loads">
          {topLoads.map(load => (
            <div
              key={load.key}
              className="leo-sinr-serving-aggregate__load-row"
              data-testid="sinr-serving-beam-load"
              data-beam-key={load.key}
              data-beam-load={load.count}
            >
              <span
                className="leo-sinr-serving-aggregate__load-swatch"
                style={{ backgroundColor: load.color }}
              />
              <span className="leo-sinr-serving-aggregate__load-label">
                {load.satId}·b{load.beamId}
              </span>
              <span className="leo-sinr-serving-aggregate__load-count">{load.count}</span>
            </div>
          ))}
        </div>
      )}
      <div className="leo-sinr-serving-aggregate__claim-stamp" data-claim="sinr-serving">
        live SINR serving · not MODQN
      </div>
    </div>
  );
}
