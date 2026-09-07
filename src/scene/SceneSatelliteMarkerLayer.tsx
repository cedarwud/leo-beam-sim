import type { JSX } from 'react';

import type { SimulatorConstellation } from '../simulator/types';
import { SatelliteMarker } from '../viz/SatelliteMarker';
import { resolveHomepageSatelliteDisplayName } from '../homepage/controller/homepageSatelliteDisplayName';
import type { EventRole } from './types';
import type { RenderedLiveSatelliteMarker } from './renderedLiveSatelliteMarkers';

const MULTI_CANDIDATE_SATELLITE_SCALE_MULTIPLIER = 7;
const MULTI_CANDIDATE_REVIEW_MARKER_SCALE_MULTIPLIER = 2.15;
const LIVE_SATELLITE_BASE_SCALE_MULTIPLIER = 1.3;

export interface SceneSatelliteMarkerLayerVisibility {
  readonly mounted: boolean;
  readonly selectedSatellite: boolean;
  readonly candidateSatellite: boolean;
  readonly contextSatellites: boolean;
  readonly centralMarkerSatelliteIds: ReadonlySet<string> | null;
}

export interface SceneSatelliteMarkerLayerIdentity {
  readonly constellation: SimulatorConstellation;
  readonly eventRoles: ReadonlyMap<string, EventRole>;
  readonly multiCandidateColorById: ReadonlyMap<string, string>;
  readonly homepageNameById: ReadonlyMap<string, string> | null | undefined;
}

export interface SceneSatelliteMarkerLayerLabels {
  readonly candidateLabelActive: boolean;
  readonly candidateOrdinalBySatelliteId: ReadonlyMap<string, number>;
  readonly candidateVisibleSatelliteIds: ReadonlySet<string> | null | undefined;
  readonly teachingLabelSatelliteIds: ReadonlySet<string> | null;
  readonly selectedLayerSatelliteId: string | null | undefined;
  readonly candidateLayerSatelliteId: string | null | undefined;
  readonly homepageLabelActive: boolean;
  readonly homepageEeProgressById: ReadonlyMap<string, number | null> | null | undefined;
  readonly homepageEeProgressVisible: boolean;
  readonly handoverMarkerSatelliteIds: ReadonlySet<string>;
  readonly heroSatelliteId: string | null | undefined;
  readonly candidateEeSatelliteId: string | null | undefined;
}

export interface SceneSatelliteMarkerLayerEmphasis {
  readonly multiCandidateSceneVisualActive: boolean;
  readonly candidateComparisonSceneActive: boolean;
  readonly candidateComparisonVisibleSatelliteIds: ReadonlySet<string> | null | undefined;
  readonly liveSource: boolean;
}

export interface SceneSatelliteMarkerLayerProps {
  readonly satellites: readonly RenderedLiveSatelliteMarker[];
  readonly visibility: SceneSatelliteMarkerLayerVisibility;
  readonly identity: SceneSatelliteMarkerLayerIdentity;
  readonly labels: SceneSatelliteMarkerLayerLabels;
  readonly emphasis: SceneSatelliteMarkerLayerEmphasis;
}

function layerVisible(
  satelliteId: string,
  visibility: SceneSatelliteMarkerLayerVisibility,
  selectedSatelliteId: string | null,
  candidateSatelliteId: string | null,
): boolean {
  if (satelliteId === selectedSatelliteId) return visibility.selectedSatellite;
  if (satelliteId === candidateSatelliteId) return visibility.candidateSatellite;
  return visibility.contextSatellites;
}

/** Renders the single world-following satellite identity marker layer. */
export function SceneSatelliteMarkerLayer({
  satellites,
  visibility,
  identity,
  labels,
  emphasis,
}: SceneSatelliteMarkerLayerProps): JSX.Element | null {
  if (!visibility.mounted) return null;

  return (
    <>
      {satellites.map(satellite => {
        const selectedLayerId = labels.selectedLayerSatelliteId ?? null;
        const candidateLayerId = labels.candidateLayerSatelliteId ?? null;
        if (!layerVisible(satellite.id, visibility, selectedLayerId, candidateLayerId)) {
          return null;
        }

        const label = labels.candidateLabelActive
          && labels.candidateOrdinalBySatelliteId.has(satellite.id)
          ? `Option R${labels.candidateOrdinalBySatelliteId.get(satellite.id)} · ${resolveSatelliteName(satellite.id, identity.homepageNameById)}`
          : labels.candidateLabelActive
            && labels.candidateVisibleSatelliteIds?.has(satellite.id) === true
            ? `Serving · ${resolveSatelliteName(satellite.id, identity.homepageNameById)}`
            : resolveSatelliteName(satellite.id, identity.homepageNameById);

        const comparisonActive = emphasis.multiCandidateSceneVisualActive
          || emphasis.candidateComparisonSceneActive;
        const labelVisible = labels.teachingLabelSatelliteIds !== null
          ? labels.teachingLabelSatelliteIds.has(satellite.id)
          : labels.candidateLabelActive
            ? labels.candidateVisibleSatelliteIds?.has(satellite.id) === true
            : !emphasis.multiCandidateSceneVisualActive;

        return (
          <SatelliteMarker
            key={satellite.id}
            position={satellite.world}
            label={label}
            eventRole={comparisonActive ? undefined : identity.eventRoles.get(satellite.id)}
            satelliteTintColor={comparisonActive
              ? identity.multiCandidateColorById.get(satellite.id) ?? satellite.satelliteTintColor
              : satellite.satelliteTintColor}
            constellation={identity.constellation}
            showLabel={labelVisible}
            labelFontSize={labels.homepageLabelActive
              ? labels.candidateLabelActive ? 22 : 18
              : undefined}
            labelOffsetY={labels.homepageLabelActive
              ? labels.candidateLabelActive ? 28 : 24
              : undefined}
            labelColor={labels.homepageLabelActive ? '#f8fafc' : undefined}
            labelOutlineColor={labels.homepageLabelActive
              ? satellite.satelliteTintColor ?? '#000000'
              : undefined}
            labelOutlineWidth={labels.homepageLabelActive
              ? labels.candidateLabelActive ? 2.5 : 2
              : undefined}
            eeProgress={labels.homepageEeProgressById?.get(satellite.id) ?? null}
            showEeProgress={labels.homepageEeProgressVisible
              && (labels.handoverMarkerSatelliteIds.has(satellite.id)
                || satellite.id === labels.heroSatelliteId
                || satellite.id === labels.candidateEeSatelliteId)}
            baseScaleMultiplier={emphasis.liveSource
              ? LIVE_SATELLITE_BASE_SCALE_MULTIPLIER
              : 1}
            scaleMultiplier={emphasis.multiCandidateSceneVisualActive
              ? MULTI_CANDIDATE_SATELLITE_SCALE_MULTIPLIER
              : emphasis.candidateComparisonSceneActive
                && emphasis.candidateComparisonVisibleSatelliteIds?.has(satellite.id) === true
                ? MULTI_CANDIDATE_REVIEW_MARKER_SCALE_MULTIPLIER
                : 1}
            visible={visibility.centralMarkerSatelliteIds === null
              || visibility.centralMarkerSatelliteIds.has(satellite.id)}
          />
        );
      })}
    </>
  );
}

function resolveSatelliteName(
  satelliteId: string,
  homepageNameById: ReadonlyMap<string, string> | null | undefined,
): string {
  return resolveHomepageSatelliteDisplayName(satelliteId, homepageNameById);
}
