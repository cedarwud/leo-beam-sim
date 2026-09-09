import { useCallback, useMemo } from 'react';
import { homepageSatelliteColorForBeam } from '../homepage/controller/homepageSatelliteVisualIdentity';
import { resolveHomepageSatelliteIdentityColor } from '../appearance/satelliteIdentityPalette';
import { resolveBaseIdentityColor } from '../appearance/resolveBeamAppearance';
import {
  makeIdentitySources,
  type IdentitySources,
} from '../appearance/beamAppearanceContract';
import {
  resolveSatelliteIdentityColor,
  type SatelliteIdentitySources,
} from '../appearance/resolveSatelliteAppearance';
import { cellLinkBudgetBeamId } from './sinrLiveCellModel';
import { resolveAcceptedBeamIdentityColor } from './acceptedBeamIdentityColor';
import { resolveAcceptedSatelliteIdentityColor } from './acceptedSatelliteIdentityColor';
import { type AcceptedHandoverPresentationSnapshot } from './acceptedHandoverPresentationSnapshot';

/**
 * WHO DECIDES a beam's / a cell's / a satellite's IDENTITY COLOUR in the live
 * scene — and in what order the two candidate sources are asked.
 *
 * This module owns the *sources* (the ladder's rungs) and the three thin
 * resolvers that run `resolveBaseIdentityColor` / `resolveSatelliteIdentityColor`
 * over them. The precedence ORDER itself stays in `appearance/` — see
 * `resolveBaseIdentityColor`. Change "which palette a beam gets" here; change
 * "which rung wins" there.
 *
 * Everything it reads is in this parameter list. It cannot see the scene's other
 * ~2,600 lines, and nothing else in the scene may build a second set of rungs.
 */
export interface UseSceneIdentityColorLadderParameters {
  readonly acceptedHandoverPresentation: AcceptedHandoverPresentationSnapshot | null;
  readonly homepageBeamEeByKey: ReadonlyMap<string, number | null> | null;
  readonly homepageIdentityPaletteIndexBySatelliteId: ReadonlyMap<string, number | null> | null;
  readonly homepageVisualIdentity: boolean;
}

export interface UseSceneIdentityColorLadderResult {
  readonly resolveSceneAcceptedBeamColorSources: IdentitySources;
  readonly resolveSceneAcceptedBeamColor: (
    satelliteId: string,
    beamId: number,
    isServingOrCandidate?: boolean,
  ) => string;
  readonly resolveSceneAcceptedCellColor: (satelliteId: string, cellId: number) => string;
  readonly resolveSceneSatelliteColorSources: SatelliteIdentitySources;
  readonly resolveSceneSatelliteColor: (satelliteId: string) => string;
}

export function useSceneIdentityColorLadder({
  acceptedHandoverPresentation,
  homepageBeamEeByKey,
  homepageIdentityPaletteIndexBySatelliteId,
  homepageVisualIdentity,
}: UseSceneIdentityColorLadderParameters): UseSceneIdentityColorLadderResult {
  // The homepage controller owns the compact visual identity projection. Keep
  // the existing accepted-snapshot resolver as the default for every other
  // consumer, while making the root scene and its transition carriers use one
  // same-satellite hue family and bounded beam shade table.
  //
  // WHICH of those two sources wins is NOT decided here. MainScene supplies the
  // two lookups as pure functions and `resolveBaseIdentityColor` — the one
  // owner of the precedence ladder — runs the order. A source that has nothing
  // to say answers `undefined`; neither lookup may invent a colour to stand in
  // for a miss, because a fabricated miss colour is indistinguishable from a
  // real hit one rung down.
  const resolveSceneAcceptedBeamColorSources = useMemo((): IdentitySources => {
    const homepageColorFor = (satelliteId: string, beamId: number, isServingOrCandidate: boolean): string => (
      homepageSatelliteColorForBeam(satelliteId, beamId, {
        identityPaletteIndex: homepageIdentityPaletteIndexBySatelliteId?.get(satelliteId) ?? null,
        // The homepage shade is a projection of the accepted snapshot's
        // published EE.  Do not fall back to beam-slot shading for transition
        // carriers: that makes the same beam change tone when it moves between
        // the rail, the live fan, and the handover cue.
        eeNormalized: homepageBeamEeByKey?.get(`${satelliteId}:${beamId}`),
        isServing: isServingOrCandidate,
      }).color
    );
    return makeIdentitySources({
      // Rung 0 is not available on this scene-owned source set.
      plan: null,
      // Rung 1. Present only while the homepage controller owns identity; null
      // makes the unavailable rung explicit on every other surface.
      homepageProjection: homepageVisualIdentity ? homepageColorFor : null,
      // Rung 2. `resolveAcceptedBeamIdentityColor` reports a miss by handing
      // back whatever fallback it was given, so the only way to see a miss from
      // here is to give it a value that can never be a published colour. The
      // empty string is that value: not a fabricated colour, and already the
      // ladder's own definition of "nothing to say".
      acceptedSnapshot: acceptedHandoverPresentation === null
        ? null
        : (satelliteId, beamId) => {
            const published = resolveAcceptedBeamIdentityColor(
              acceptedHandoverPresentation,
              satelliteId,
              beamId,
              '',
            );
            return published.length > 0 ? published : undefined;
          },
    });
  }, [acceptedHandoverPresentation, homepageBeamEeByKey, homepageIdentityPaletteIndexBySatelliteId, homepageVisualIdentity]);
  const resolveSceneAcceptedBeamColor = useCallback((
    satelliteId: string,
    beamId: number,
    isServingOrCandidate = false,
  ): string => resolveBaseIdentityColor(
    satelliteId,
    beamId,
    resolveSceneAcceptedBeamColorSources,
    { isServingOrCandidate },
  ), [resolveSceneAcceptedBeamColorSources]);
  // The cell lane is the same ladder reached through a different key: an
  // earth-fixed cell id resolves to its link-budget beam id and then asks the
  // identical question. `resolveAcceptedCellIdentityColor` did exactly that
  // conversion before handing off to the beam resolver, so doing the conversion
  // here and reusing the beam sources is the same lookup with one fewer
  // wrapper — and, more to the point, one fewer place that could disagree about
  // the order.
  const resolveSceneAcceptedCellColor = useCallback((
    satelliteId: string,
    cellId: number,
  ): string => resolveBaseIdentityColor(
    satelliteId,
    Number.isFinite(cellId) ? cellLinkBudgetBeamId(Math.trunc(cellId)) : Number.NaN,
    resolveSceneAcceptedBeamColorSources,
  ), [resolveSceneAcceptedBeamColorSources]);
  const resolveSceneSatelliteColorSources = useMemo((): SatelliteIdentitySources => ({
    // Rung 1. Present only while the homepage controller owns identity; absent
    // on every other surface.
    homepageColorFor: satelliteId => resolveHomepageSatelliteIdentityColor(
      satelliteId,
      homepageVisualIdentity,
    ),
    // Rung 2. `resolveAcceptedSatelliteIdentityColor` reports a miss by handing back
    // whatever fallback it was given. Giving it the empty string allows detecting a
    // miss without fabricating a sentinel colour.
    acceptedColorFor: satelliteId => {
      const published = resolveAcceptedSatelliteIdentityColor(
        acceptedHandoverPresentation,
        satelliteId,
        '',
      );
      return published.length > 0 ? published : undefined;
    },
  }), [acceptedHandoverPresentation, homepageVisualIdentity]);
  const resolveSceneSatelliteColor = useCallback((
    satelliteId: string,
  ): string => resolveSatelliteIdentityColor(
    satelliteId,
    resolveSceneSatelliteColorSources,
  ), [resolveSceneSatelliteColorSources]);
  return {
    resolveSceneAcceptedBeamColorSources,
    resolveSceneAcceptedBeamColor,
    resolveSceneAcceptedCellColor,
    resolveSceneSatelliteColorSources,
    resolveSceneSatelliteColor,
  };
}

/**
 * WHICH ROSTER defines the live beam identity colour map — the `sat/beam → colour`
 * lookup that ground effects and the central cones both read, so the two cannot
 * disagree about one beam's colour.
 *
 * `acceptedHandoverPresentation` is listed as an input only to keep this memo's
 * dependency list byte-identical to the one it was lifted from; the snapshot
 * reaches the colour through `resolveSceneAcceptedBeamColor`.
 */
export interface UseLiveBeamIdentityColorMapParameters {
  readonly acceptedHandoverPresentation: AcceptedHandoverPresentationSnapshot | null;
  readonly resolveSceneAcceptedBeamColor: (satelliteId: string, beamId: number) => string;
  readonly satBeams: ReadonlyMap<string, readonly { readonly beamId: number }[]>;
}

export function useLiveBeamIdentityColorMap({
  acceptedHandoverPresentation,
  resolveSceneAcceptedBeamColor,
  satBeams,
}: UseLiveBeamIdentityColorMapParameters): ReadonlyMap<string, string> {
  const liveBeamIdentityColorBySatelliteBeam = useMemo(() => {
    const colors = new Map<string, string>();
    // Use the actual rendered beam roster so ground effects and the central
    // cones share one identity source. During an accepted episode prefer the
    // same retained beam token as the rail; the deterministic HSL resolver is
    // only the fallback for an ambient beam outside that snapshot.
    for (const [satelliteId, beams] of satBeams.entries()) {
      for (const beam of beams) {
        colors.set(
          `${satelliteId}/${beam.beamId}`,
          resolveSceneAcceptedBeamColor(
            satelliteId,
            beam.beamId,
          ),
        );
      }
    }
    return colors;
  }, [acceptedHandoverPresentation, resolveSceneAcceptedBeamColor, satBeams]);
  return liveBeamIdentityColorBySatelliteBeam;
}
