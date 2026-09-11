import type { JSX } from 'react';

import type { CandidateLinkKey } from '../engine/handover/candidateDecisionContract';
import type { CandidateSceneRenderReceipt } from './acceptedHandoverPresentationSnapshot';
import type {
  MultiCandidateScenePresentation,
} from './multiCandidateScenePresentation';
import {
  MultiCandidateBeamScene,
  type MultiCandidateBeamSceneResolverInput,
} from '../viz/MultiCandidateBeamScene';

export interface SceneMultiCandidateBeat {
  readonly active: boolean;
  readonly presentation: MultiCandidateScenePresentation | null;
  readonly widthScale: number;
  readonly renderReceipt: CandidateSceneRenderReceipt | null;
}

export interface SceneMultiCandidateLayerContext {
  readonly placementByCellId: MultiCandidateBeamSceneResolverInput['placementByCellId'];
  readonly satelliteWorldById: MultiCandidateBeamSceneResolverInput['satelliteWorldById'];
  readonly primaryUeWorld: MultiCandidateBeamSceneResolverInput['primaryUeWorld'] | null;
  readonly reducedMotion: boolean;
  readonly homepageVisualIdentity: boolean;
  readonly satelliteNameById: MultiCandidateBeamSceneResolverInput['satelliteNameById'];
  readonly homepageBeamEeByKey: MultiCandidateBeamSceneResolverInput['homepageBeamEeByKey'];
  readonly homepageIdentityPaletteIndexBySatelliteId:
    MultiCandidateBeamSceneResolverInput['homepageIdentityPaletteIndexBySatelliteId'];
  readonly onCandidateSelect?: (key: CandidateLinkKey) => void;
  readonly focusedJoinKey?: string | null;
  readonly onFocusJoinKeyChange?: (joinKey: string | null) => void;
}

export interface SceneMultiCandidateLayerProps {
  readonly context: SceneMultiCandidateLayerContext;
  readonly central: SceneMultiCandidateBeat;
  readonly review: SceneMultiCandidateBeat;
}

/** Renders the central accepted comparison beat or its additive review beat. */
export function SceneMultiCandidateLayer({
  context,
  central,
  review,
}: SceneMultiCandidateLayerProps): JSX.Element {
  return (
    <>
      {central.active
        && central.presentation !== null
        && context.primaryUeWorld !== null
        && (
          <MultiCandidateBeamScene
            presentation={central.presentation}
            placementByCellId={context.placementByCellId}
            satelliteWorldById={context.satelliteWorldById}
            primaryUeWorld={context.primaryUeWorld}
            widthScale={central.widthScale}
            reducedMotion={context.reducedMotion}
            homepageVisualIdentity={context.homepageVisualIdentity}
            satelliteNameById={context.satelliteNameById}
            homepageBeamEeByKey={context.homepageBeamEeByKey}
            homepageIdentityPaletteIndexBySatelliteId={context.homepageIdentityPaletteIndexBySatelliteId}
            // The homepage keeps its established serving carrier mounted while
            // the accepted comparison owns the candidate geometry.
            renderServingConeAndFootprint={!context.homepageVisualIdentity}
            renderCandidateCarrierGeometry={true}
            renderCandidateFootprints={true}
            limitCandidateCarrierToLeader={context.homepageVisualIdentity}
            limitCandidateLinksToLeader={false}
            anchorIntraCandidatesToServingCell={context.homepageVisualIdentity}
            // SatelliteMarker is the single world-following identity owner.
            renderSatelliteIdentityLabels={false}
            renderPairLabels={false}
            renderReceipt={central.renderReceipt}
            onCandidateSelect={context.onCandidateSelect}
            focusedJoinKey={context.focusedJoinKey}
            onFocusJoinKeyChange={context.onFocusJoinKeyChange}
          />
        )}
      {review.active
        && review.presentation !== null
        && context.primaryUeWorld !== null
        && (
          <MultiCandidateBeamScene
            presentation={review.presentation}
            placementByCellId={context.placementByCellId}
            satelliteWorldById={context.satelliteWorldById}
            primaryUeWorld={context.primaryUeWorld}
            widthScale={review.widthScale}
            reducedMotion={context.reducedMotion}
            homepageVisualIdentity={context.homepageVisualIdentity}
            satelliteNameById={context.satelliteNameById}
            homepageBeamEeByKey={context.homepageBeamEeByKey}
            homepageIdentityPaletteIndexBySatelliteId={context.homepageIdentityPaletteIndexBySatelliteId}
            // The review beat exposes one bounded candidate carrier while the
            // complete candidate roster remains in the rail.
            renderServingConeAndFootprint={false}
            renderCandidateCarrierGeometry={true}
            renderCandidateFootprints={true}
            limitCandidateCarrierToLeader={context.homepageVisualIdentity}
            limitCandidateLinksToLeader={false}
            anchorIntraCandidatesToServingCell={context.homepageVisualIdentity}
            renderServingDataLink={true}
            renderSatelliteIdentityMarkers={true}
            renderSatelliteIdentityLabels={false}
            renderPairLabels={false}
            renderReceipt={review.renderReceipt}
            onCandidateSelect={context.onCandidateSelect}
            focusedJoinKey={context.focusedJoinKey}
            onFocusJoinKeyChange={context.onFocusJoinKeyChange}
          />
        )}
    </>
  );
}
