import type { SimulationAnalysisFrame } from '../../simulator/types';
import type {
  PairRepresentativeLinkSelection,
  RepresentativeLinkSelection,
  ScientificLinkIdentity,
} from './types';

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function candidateAt(frame: SimulationAnalysisFrame, userIndex: number) {
  const beamId = frame.inputs.frame.servingBeamU[userIndex];
  if (beamId === undefined || beamId < 0 || frame.inputs.frame.beamActiveB[beamId] !== true) return null;
  const thetaRad = frame.inputs.frame.thetaRadUb[userIndex]?.[beamId];
  const rateBps = frame.canonical.throughput.rateUBps[userIndex];
  if (thetaRad === undefined || rateBps === undefined
    || !Number.isFinite(thetaRad) || !Number.isFinite(rateBps) || rateBps <= 0) return null;
  return { beamId, userIndex, thetaRad, rateBps };
}

function unavailable(reason: string): Extract<RepresentativeLinkSelection, { readonly status: 'unavailable' }> {
  return freeze({ status: 'unavailable', selectorVersion: 'representative-link-v2', reason });
}

export function selectRepresentativeLinkV2(frame: SimulationAnalysisFrame): RepresentativeLinkSelection {
  const candidates = frame.scenario.users.flatMap(user => {
    const candidate = candidateAt(frame, user.index);
    return candidate === null ? [] : [candidate];
  });
  candidates.sort((left, right) => (
    right.thetaRad - left.thetaRad
    || left.beamId - right.beamId
    || left.userIndex - right.userIndex
  ));
  const selected = candidates[0];
  if (selected === undefined) return unavailable('frame has no active finite non-zero-rate representative link');
  return freeze({
    status: 'available',
    selectorVersion: 'representative-link-v2',
    satelliteId: frame.selectedSatelliteId,
    beamId: selected.beamId,
    userIndex: selected.userIndex,
    userId: `ue-${selected.userIndex + 1}`,
    thetaRad: selected.thetaRad,
    rateBps: selected.rateBps,
  });
}

export function selectPinnedRepresentativeLink(
  frame: SimulationAnalysisFrame,
  identity: ScientificLinkIdentity,
): RepresentativeLinkSelection {
  if (frame.selectedSatelliteId !== identity.satelliteId) {
    return unavailable(`frame serving satellite ${frame.selectedSatelliteId} does not match ${identity.satelliteId}`);
  }
  if (identity.userId !== `ue-${identity.userIndex + 1}`) {
    return unavailable('pinned UE string identity does not match its index');
  }
  const candidate = candidateAt(frame, identity.userIndex);
  if (candidate === null || candidate.beamId !== identity.beamId) {
    return unavailable('pinned representative UE/beam is not an active finite non-zero-rate link');
  }
  return freeze({
    status: 'available',
    selectorVersion: 'representative-link-v2',
    ...identity,
    thetaRad: candidate.thetaRad,
    rateBps: candidate.rateBps,
  });
}

export function selectPairRepresentativeLinkV2(
  reference: SimulationAnalysisFrame,
  probe: SimulationAnalysisFrame,
  pinnedIdentity?: ScientificLinkIdentity,
): PairRepresentativeLinkSelection {
  if (reference.selectedSatelliteId !== probe.selectedSatelliteId) {
    return unavailable('reference and probe serving satellite identities differ');
  }
  let referenceSelection: RepresentativeLinkSelection;
  if (pinnedIdentity !== undefined) {
    referenceSelection = selectPinnedRepresentativeLink(reference, pinnedIdentity);
  } else {
    const intersection = reference.scenario.users.flatMap(user => {
      const referenceCandidate = candidateAt(reference, user.index);
      const probeCandidate = candidateAt(probe, user.index);
      return referenceCandidate !== null
        && probeCandidate !== null
        && referenceCandidate.beamId === probeCandidate.beamId
        && referenceCandidate.thetaRad === probeCandidate.thetaRad
        ? [{ reference: referenceCandidate, probe: probeCandidate }]
        : [];
    });
    intersection.sort((left, right) => (
      right.reference.thetaRad - left.reference.thetaRad
      || left.reference.beamId - right.reference.beamId
      || left.reference.userIndex - right.reference.userIndex
    ));
    const selected = intersection[0];
    referenceSelection = selected === undefined
      ? unavailable('reference and probe have no shared active finite non-zero-rate representative link')
      : freeze({
          status: 'available',
          selectorVersion: 'representative-link-v2',
          satelliteId: reference.selectedSatelliteId,
          beamId: selected.reference.beamId,
          userIndex: selected.reference.userIndex,
          userId: `ue-${selected.reference.userIndex + 1}`,
          thetaRad: selected.reference.thetaRad,
          rateBps: selected.reference.rateBps,
        });
  }
  if (referenceSelection.status === 'unavailable') return referenceSelection;
  const probeSelection = selectPinnedRepresentativeLink(probe, referenceSelection);
  if (probeSelection.status === 'unavailable') return probeSelection;
  return freeze({
    ...referenceSelection,
    probeThetaRad: probeSelection.thetaRad,
    probeRateBps: probeSelection.rateBps,
  });
}
