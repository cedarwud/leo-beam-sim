import type { JSX } from 'react';
import type { AppExperienceMode } from '../../app/appExperienceMode';
import type { ModqnVisualLayerPreset } from '../../scene/modqnVisualLayers';
import type { SimState } from '../../scene/types';

export const MODQN_LIVE_CELL_PREVIEW_BANNER_TEXT =
  'preview · profile-derived cells · NOT baseline proof · degenerate baseline (1 sat · 100 UE/1 beam · 0 HO) · awaiting dense-Q producer export';
export const MODQN_BEAM_LOAD_SOURCE_GAP_TEXT =
  'Beam load (UEs/beam): shown · Queue/buffer depth: not modeled (full-buffer)';

interface Props {
  readonly appMode: AppExperienceMode;
  readonly simState: SimState;
  readonly bundleProvenanceKind: 'paper-faithful' | 'user-trained';
  readonly sceneSource: 'live-sim' | 'artifact-replay';
  readonly modqnVisualLayerPreset?: ModqnVisualLayerPreset;
}

// Phase H §4.8: top-right HUD that surfaces sim time + handover counters +
// truth-lane chip so the user can tell whether the scene is live-sim (the
// modqn-demo default) or artifact-replay (paper-faithful or user-trained
// bundle loaded). The chip honors modqn-training-truth-visualization-sdd
// §4.4 - no producer-truth claim leaks into the live-sim chip.

function truthChipLabel(
  sceneSource: 'live-sim' | 'artifact-replay',
  bundleProvenanceKind: 'paper-faithful' | 'user-trained',
): { label: string; tone: 'live' | 'paper' | 'user' } {
  if (sceneSource === 'live-sim') {
    return { label: 'live-sim · profile-derived', tone: 'live' };
  }
  if (bundleProvenanceKind === 'user-trained') {
    return { label: 'user-trained replay', tone: 'user' };
  }
  return { label: 'paper-faithful replay', tone: 'paper' };
}

export function ModqnSceneHud({
  appMode,
  simState,
  bundleProvenanceKind,
  sceneSource,
  modqnVisualLayerPreset = 'baseline-faithful',
}: Props): JSX.Element | null {
  if (appMode !== 'modqn-demo') return null;

  const { label, tone } = truthChipLabel(sceneSource, bundleProvenanceKind);
  const intraHoCount = simState.intraHoCount ?? 0;
  const hoCount = simState.hoCount ?? 0;
  const interHoCount = Math.max(0, hoCount - intraHoCount);
  const simTimeSec = simState.simTimeSec ?? 0;
  const serviceReadout = simState.modqnCellServiceReadout;
  const showLivePreviewBanner = sceneSource === 'live-sim';
  const beamLoadShown = (modqnVisualLayerPreset === 'explain-handover' || modqnVisualLayerPreset === 'debug')
    && sceneSource === 'live-sim'
    && simState.servingSatId !== null
    && simState.servingBeamId !== null;
  const showServiceDiagnostics = modqnVisualLayerPreset === 'debug' && serviceReadout !== undefined;
  const showServiceAllocationSummary = modqnVisualLayerPreset === 'service-allocation' && serviceReadout !== undefined;
  const activeServiceSatelliteCount = serviceReadout?.satelliteSummaries
    .filter(summary => summary.activeCellCount > 0 || summary.servedUeCount > 0)
    .length ?? 0;
  const serviceLegendLimit = modqnVisualLayerPreset === 'service-allocation' ? 8 : 6;
  const visibleSatelliteSummaries = serviceReadout?.satelliteSummaries
    .filter(summary => summary.activeCellCount > 0 || summary.servedUeCount > 0)
    .slice(0, serviceLegendLimit) ?? [];
  const diagnosticSatelliteSummaries = visibleSatelliteSummaries.slice(0, 3);

  return (
    <div
      className="leo-modqn-scene-hud"
      data-testid="modqn-scene-hud"
      data-preview-stage="phase-i"
      data-truth-tone={tone}
      data-sim-time-sec={simTimeSec.toFixed(1)}
      data-intra-ho-count={String(intraHoCount)}
      data-inter-ho-count={String(interHoCount)}
      data-modqn-layer-preset={modqnVisualLayerPreset}
      data-service-source={serviceReadout?.source ?? 'none'}
      data-service-claim-kind={serviceReadout?.claimKind ?? 'none'}
      data-service-slot-index={String(serviceReadout?.slotIndex ?? '')}
      data-service-slot-sec={String(serviceReadout?.slotSec ?? '')}
      data-service-next-slot-index={String(serviceReadout?.nextSlotIndex ?? '')}
      data-service-next-change-count={String(serviceReadout?.nextChangedCellCount ?? '')}
      data-service-serving-count={String(serviceReadout?.servingCount ?? '')}
      data-service-active-cell-count={String(serviceReadout?.activeCellCount ?? '')}
      data-service-idle-cell-count={String(serviceReadout?.idleCellCount ?? '')}
      data-service-served-ue-count={String(serviceReadout?.servedUeCount ?? '')}
      data-service-idle-ue-count={String(serviceReadout?.idleUeCount ?? '')}
      data-service-active-satellite-count={String(activeServiceSatelliteCount)}
      data-service-allocation-visible={showServiceAllocationSummary ? 'true' : 'false'}
      data-service-diagnostics-visible={showServiceDiagnostics ? 'true' : 'false'}
      data-queue-depth-source="source-gap"
      data-beam-load-shown={beamLoadShown ? '1' : '0'}
      aria-label="MODQN scene HUD"
    >
      <header className="leo-modqn-scene-hud__chip" data-truth-chip={tone}>
        {label}
      </header>
      {showLivePreviewBanner && (
        <div
          className="leo-modqn-scene-hud__preview-banner"
          data-testid="modqn-scene-hud-preview-banner"
          data-preview-stage="phase-i"
          data-preview-source="profile-derived-demo"
          data-backend-snr-truth="nadir"
          data-producer-proof="false"
          data-phase-target="phase-iii"
        >
          {MODQN_LIVE_CELL_PREVIEW_BANNER_TEXT}
        </div>
      )}
      <dl className="leo-modqn-scene-hud__metrics">
        <div>
          <dt>sim t</dt>
          <dd data-testid="modqn-scene-hud-sim-time">{simTimeSec.toFixed(1)}s</dd>
        </div>
        <div>
          <dt>intra HO</dt>
          <dd data-testid="modqn-scene-hud-intra-ho">{intraHoCount}</dd>
        </div>
        <div>
          <dt>inter HO</dt>
          <dd data-testid="modqn-scene-hud-inter-ho">{interHoCount}</dd>
        </div>
      </dl>
      <div
        className="leo-modqn-scene-hud__source-gap"
        data-testid="modqn-scene-hud-queue-depth-source-gap"
      >
        {MODQN_BEAM_LOAD_SOURCE_GAP_TEXT}
      </div>
      {serviceReadout !== undefined && (
        <section
          className="leo-modqn-scene-hud__service"
          data-testid="modqn-service-readout"
          aria-label="MODQN profile-derived cell service readout"
        >
          {showServiceAllocationSummary && (
            <div
              className="leo-modqn-scene-hud__service-callout"
              data-testid="modqn-service-allocation-summary"
            >
              <strong>Service Allocation</strong>
              <span>{activeServiceSatelliteCount} sats · {serviceReadout.activeCellCount} cells · {serviceReadout.servedUeCount} UE</span>
              <small>profile-derived overlay</small>
            </div>
          )}
          <div className="leo-modqn-scene-hud__service-summary">
            <span>L{serviceReadout.servingCount}</span>
            <span>slot {serviceReadout.slotIndex}</span>
            <span>{serviceReadout.activeCellCount}/{serviceReadout.cellCount} cells</span>
            <span>{serviceReadout.servedUeCount}/{serviceReadout.servedUeCount + serviceReadout.idleUeCount} UE</span>
          </div>
          <div
            className="leo-modqn-scene-hud__service-legend"
            data-satellite-summary-count={String(serviceReadout.satelliteSummaries.length)}
          >
            {visibleSatelliteSummaries.map(summary => (
              <div
                key={summary.satId}
                className="leo-modqn-scene-hud__service-sat"
                data-sat-id={summary.satId}
                data-active-cell-count={String(summary.activeCellCount)}
                data-active-beam-ids={summary.activeBeamIds.join(',')}
                data-served-ue-count={String(summary.servedUeCount)}
              >
                <span
                  className="leo-modqn-scene-hud__service-swatch"
                  style={{ backgroundColor: summary.markerColor }}
                  aria-hidden="true"
                />
                <span className="leo-modqn-scene-hud__service-id">{summary.satId}</span>
                <span className="leo-modqn-scene-hud__service-counts">
                  {summary.activeCellCount}c · {summary.servedUeCount}u
                </span>
              </div>
            ))}
          </div>
          {showServiceDiagnostics && (
            <div
              className="leo-modqn-scene-hud__service-diagnostics"
              data-testid="modqn-service-diagnostics"
              aria-label="MODQN profile-derived cell schedule diagnostics"
            >
              <div className="leo-modqn-scene-hud__service-diagnostics-grid">
                <span>slot {serviceReadout.slotIndex} -&gt; {serviceReadout.nextSlotIndex}</span>
                <span>{serviceReadout.slotSec.toFixed(1)}s slot</span>
                <span>{serviceReadout.visibleSatelliteCount} visible sats</span>
                <span>{serviceReadout.nextChangedCellCount} next changes</span>
                <span>{serviceReadout.nextActiveCellCount}/{serviceReadout.cellCount} next cells</span>
                <span>overlay · profile-derived</span>
              </div>
              {diagnosticSatelliteSummaries.length > 0 && (
                <div className="leo-modqn-scene-hud__service-beams">
                  {diagnosticSatelliteSummaries.map(summary => (
                    <span key={summary.satId}>
                      {summary.satId}: b{summary.activeBeamIds.join('/') || '-'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
