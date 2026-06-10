/**
 * SINR-serving aggregate readout (S2).
 *
 * The ambient `served N/N` + per-beam load + mean served SINR HUD on the
 * `sinr-live` lane. Always-on (the low-density default per Rule#10): it proves
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
  deriveSinrLiveServiceQueueFocusStories,
  deriveSinrLiveServiceQueueModel,
  deriveSinrServingMosaicAggregate,
  type SinrServiceQueueFocusStory,
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

function formatBits(bits: number): string {
  if (!Number.isFinite(bits)) return '—';
  if (bits >= 1_000_000) return `${(bits / 1_000_000).toFixed(2)} Mb`;
  if (bits >= 1_000) return `${Math.round(bits / 1_000)} kb`;
  return `${Math.round(bits)} b`;
}

function formatSignedBits(bits: number): string {
  if (!Number.isFinite(bits)) return '—';
  const sign = bits > 0 ? '+' : bits < 0 ? '-' : '';
  return `${sign}${formatBits(Math.abs(bits))}`;
}

function QueueFocusStoryRow({
  story,
  label,
}: {
  readonly story: SinrServiceQueueFocusStory;
  readonly label: string;
}): JSX.Element {
  return (
    <div
      className="leo-sinr-serving-aggregate__queue-focus-row"
      data-testid="sinr-service-queue-focus-story"
      data-queue-focus-kind={story.kind}
      data-queue-focus-ue-id={story.ueId}
      data-queue-before-bits={Math.round(story.queueBeforeBits)}
      data-queue-after-bits={Math.round(story.queueAfterBits)}
      data-queue-delta-bits={Math.round(story.queueDeltaBits)}
      data-service-surplus-bits={Math.round(story.serviceSurplusBits)}
      data-service-rate-bps={Math.round(story.serviceRateBps)}
      data-queue-pressure={story.pressure.toFixed(3)}
    >
      <span>{label}</span>
      <strong>{story.ueId}</strong>
      <small>{`${formatSignedBits(story.queueDeltaBits)} queue`}</small>
    </div>
  );
}

export function SinrServingAggregate({
  perUePositions,
  visible,
}: SinrServingAggregateProps): JSX.Element | null {
  if (!visible || perUePositions === undefined || perUePositions.length === 0) {
    return null;
  }
  const aggregate = deriveSinrServingMosaicAggregate(perUePositions);
  const queueModel = deriveSinrLiveServiceQueueModel(perUePositions);
  const queueAggregate = queueModel.aggregate;
  const queueFocusStories = deriveSinrLiveServiceQueueFocusStories(queueModel.accounts);
  if (aggregate.totalCount === 0) return null;
  const topLoads = aggregate.beamLoads.slice(0, MAX_BEAM_LOAD_ROWS);
  const maxHeatmapBin = Math.max(1, ...queueAggregate.pressureHistogram);

  return (
    <div
      className="leo-sinr-serving-aggregate"
      data-testid="sinr-serving-aggregate"
      data-claim-kind="sinr-serving"
      data-served-count={aggregate.servedCount}
      data-total-count={aggregate.totalCount}
      data-serving-beam-count={aggregate.servingBeamCount}
      data-avg-sinr-db={aggregate.avgServedSinrDb == null ? '' : aggregate.avgServedSinrDb.toFixed(1)}
      data-queue-source={queueAggregate.source}
      data-queue-capable-count={queueAggregate.queueCapableUeCount}
      data-queue-avg-bits={Math.round(queueAggregate.avgQueueBits)}
      data-queue-p95-bits={Math.round(queueAggregate.p95QueueBits)}
      data-queue-max-bits={Math.round(queueAggregate.maxQueueBits)}
      data-queue-starved-count={queueAggregate.starvedUeCount}
      data-queue-pressure-bucket-count={queueAggregate.pressureBucketCount}
      data-queue-focus-source={queueFocusStories.source}
      data-queue-highest-pressure-ue-id={queueFocusStories.highestPressure?.ueId ?? ''}
      data-queue-best-rescue-ue-id={queueFocusStories.bestRescue?.ueId ?? ''}
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
      <div
        className="leo-sinr-serving-aggregate__queue"
        data-testid="sinr-service-queue-summary"
        data-queue-source={queueAggregate.source}
      >
        <div className="leo-sinr-serving-aggregate__queue-head">
          <span>Queue</span>
          <span data-testid="sinr-service-queue-source">{queueAggregate.source}</span>
        </div>
        <div className="leo-sinr-serving-aggregate__queue-grid">
          <span>avg {formatBits(queueAggregate.avgQueueBits)}</span>
          <span>p95 {formatBits(queueAggregate.p95QueueBits)}</span>
          <span>max {formatBits(queueAggregate.maxQueueBits)}</span>
          <span>starved {queueAggregate.starvedUeCount}</span>
        </div>
        <div
          className="leo-sinr-serving-aggregate__queue-heatmap"
          data-testid="sinr-service-queue-heatmap"
          aria-hidden="true"
        >
          {queueAggregate.pressureHistogram.map((count, index) => (
            <span
              key={index}
              data-testid="sinr-service-queue-heatmap-bin"
              data-bin-index={index}
              data-bin-count={count}
              style={{ opacity: count > 0 ? 0.22 + (count / maxHeatmapBin) * 0.72 : 0.1 }}
            />
          ))}
        </div>
        {queueFocusStories.highestPressure !== null && queueFocusStories.bestRescue !== null ? (
          <div
            className="leo-sinr-serving-aggregate__queue-focus"
            data-testid="sinr-service-queue-focus-stories"
            data-queue-focus-source={queueFocusStories.source}
            data-highest-pressure-ue-id={queueFocusStories.highestPressure.ueId}
            data-best-rescue-ue-id={queueFocusStories.bestRescue.ueId}
            aria-label="Queue focus stories"
          >
            <QueueFocusStoryRow story={queueFocusStories.highestPressure} label="Pressure" />
            <QueueFocusStoryRow story={queueFocusStories.bestRescue} label="Rescue" />
          </div>
        ) : null}
      </div>
      <div className="leo-sinr-serving-aggregate__claim-stamp" data-claim="sinr-serving">
        live SINR serving · not MODQN · queue demo
      </div>
    </div>
  );
}
