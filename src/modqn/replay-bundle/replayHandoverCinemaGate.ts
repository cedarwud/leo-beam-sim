import {
  buildModqnDenseQProof,
  isModqnDenseQProofReady,
  type ModqnDenseQProofResult,
} from './denseQProof';
import type {
  ModqnReplayPlaybackDisplayState,
  ModqnReplayPlaybackFocusRow,
} from './playback-shell';
import type {
  ModqnBeamReference,
  ModqnBeamState,
  ModqnHandoverEventKind,
  ModqnProducerPosition,
  ModqnRewardVector,
  ModqnSatelliteState,
} from './types';
import type { ModqnReplaySourceGapField } from '../replay-source-gaps';

export const MODQN_REPLAY_HANDOVER_CINEMA_GATE_ID = 'modqn-replay-handover-cinema-gate' as const;

export interface ModqnReplayHandoverCinemaGateReady {
  readonly status: 'ready';
  readonly eventKind: Exclude<ModqnHandoverEventKind, 'none'>;
  readonly eventKey: string;
  readonly sourceGapFields: readonly [];
  readonly reasons: readonly [];
  readonly denseQProof: ModqnDenseQProofResult;
}

export interface ModqnReplayHandoverCinemaGateSourceGap {
  readonly status: 'source-gap';
  readonly eventKind: ModqnHandoverEventKind | null;
  readonly eventKey: null;
  readonly sourceGapFields: readonly ModqnReplaySourceGapField[];
  readonly reasons: readonly string[];
  readonly denseQProof: ModqnDenseQProofResult | null;
}

export type ModqnReplayHandoverCinemaGate =
  | ModqnReplayHandoverCinemaGateReady
  | ModqnReplayHandoverCinemaGateSourceGap;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : null;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function numericField(source: unknown, key: string): number | null {
  const value = record(source)?.[key];
  return finiteNumber(value) ? value : null;
}

function booleanField(source: unknown, key: string): boolean | null {
  const value = record(source)?.[key];
  return typeof value === 'boolean' ? value : null;
}

function isDisplayOnlyProvenance(value: unknown): boolean {
  return booleanField(value, 'displayOnly') === true;
}

function localTangentKm(source: unknown): { readonly east: number; readonly north: number } | null {
  const tangent = record(record(source)?.localTangentKm);
  const east = numericField(tangent, 'east');
  const north = numericField(tangent, 'north');
  return east === null || north === null ? null : { east, north };
}

function producerPositionIsRenderable(position: ModqnProducerPosition | undefined): boolean {
  return localTangentKm(position) !== null;
}

function satelliteCoordinateFrameKindIsProxy(kind: string | null): boolean {
  return kind !== null && kind.includes('no-earth-rotation-proxy');
}

function satelliteIsRenderable(satellite: ModqnSatelliteState): boolean {
  const coordinateFrameKind = record(satellite)?.coordinateFrameKind;
  if (!nonEmptyString(coordinateFrameKind)) return false;
  if (satelliteCoordinateFrameKindIsProxy(coordinateFrameKind)) return false;
  if (isDisplayOnlyProvenance(record(satellite)?.positionProvenance)) return false;

  const subpoint = record(satellite.subSatellitePoint);
  return numericField(subpoint, 'latDeg') !== null
    && numericField(subpoint, 'lonDeg') !== null;
}

function hasRenderableSatellite(
  satellites: readonly ModqnSatelliteState[] | undefined,
  satId: string,
): boolean {
  return (satellites ?? []).some(satellite => (
    satellite.satId === satId && satelliteIsRenderable(satellite)
  ));
}

function beamCenterIsRenderable(beam: ModqnBeamState): boolean {
  return localTangentKm({ localTangentKm: beam.centerLocalTangentKm }) !== null;
}

function beamFootprintIsRenderable(beam: ModqnBeamState): boolean {
  const footprintKm = numericField(beam, 'footprintKm');
  if (footprintKm === null || footprintKm <= 0) return false;
  return !isDisplayOnlyProvenance(record(beam)?.footprintProvenance);
}

function beamMatchesReference(beam: ModqnBeamState, reference: ModqnBeamReference): boolean {
  return beam.beamId === reference.beamId
    || (beam.satId === reference.satId && beam.localBeamIndex === reference.localBeamIndex);
}

function hasRenderableBeam(
  beams: readonly ModqnBeamState[] | undefined,
  reference: ModqnBeamReference,
): boolean {
  return (beams ?? []).some(beam => (
    beamMatchesReference(beam, reference)
    && beamCenterIsRenderable(beam)
    && beamFootprintIsRenderable(beam)
  ));
}

function rewardIsFinite(rewardVector: ModqnRewardVector, scalarReward: number): boolean {
  const values = Object.values(rewardVector);
  return finiteNumber(scalarReward)
    && values.length > 0
    && values.every(value => finiteNumber(value));
}

function handoverEventMatchesServing(focusRow: ModqnReplayPlaybackFocusRow): boolean {
  const previous = focusRow.previousServing;
  const selected = focusRow.selectedServing;
  if (focusRow.handoverEventKind === 'intra-satellite-beam-switch') {
    return previous.satId === selected.satId
      && previous.localBeamIndex !== selected.localBeamIndex;
  }
  if (focusRow.handoverEventKind === 'inter-satellite-handover') {
    return previous.satId !== selected.satId;
  }
  return false;
}

function formatEventKey(displayState: ModqnReplayPlaybackDisplayState, eventId: string): string {
  const focusRow = displayState.currentSlot.focusRow;
  return [
    `event:${eventId}`,
    `slot:${displayState.currentSlot.slotIndex}`,
    `row:${focusRow.sourceRowIndex}`,
    `time:${focusRow.timeSec}`,
    `ue:${focusRow.userId}`,
  ].join('|');
}

function pushGap(
  fields: ModqnReplaySourceGapField[],
  reasons: string[],
  field: ModqnReplaySourceGapField,
  reason: string,
): void {
  if (!fields.includes(field)) fields.push(field);
  reasons.push(`${field}: ${reason}`);
}

export function buildModqnReplayHandoverCinemaGate(
  displayState: ModqnReplayPlaybackDisplayState | null | undefined,
): ModqnReplayHandoverCinemaGate {
  if (displayState === null || displayState === undefined) {
    return {
      status: 'source-gap',
      eventKind: null,
      eventKey: null,
      sourceGapFields: ['timeline.sourceRowIdentity'],
      reasons: ['timeline.sourceRowIdentity: replay display state is absent'],
      denseQProof: null,
    };
  }

  const focusRow = displayState.currentSlot.focusRow;
  const sourceGapFields: ModqnReplaySourceGapField[] = [];
  const reasons: string[] = [];
  const eventId = focusRow.handoverEventId;

  if (focusRow.handoverEventKind === 'none') {
    pushGap(sourceGapFields, reasons, 'timeline.sourceRowIdentity', 'focused producer row is not a handover event');
  }
  if (!nonEmptyString(eventId)) {
    pushGap(sourceGapFields, reasons, 'timeline.sourceRowIdentity', 'producer handover event ID is absent');
  }
  if (!handoverEventMatchesServing(focusRow)) {
    pushGap(sourceGapFields, reasons, 'timeline.sourceRowIdentity', 'event kind does not match old/new serving identity');
  }
  if (!producerPositionIsRenderable(focusRow.decisionUserPosition ?? focusRow.userPosition)) {
    pushGap(sourceGapFields, reasons, 'entities.ues.positionTrace', 'focused UE producer position is not renderable');
  }
  if (
    !hasRenderableSatellite(focusRow.satelliteStates, focusRow.previousServing.satId)
    || !hasRenderableSatellite(focusRow.satelliteStates, focusRow.selectedServing.satId)
  ) {
    pushGap(sourceGapFields, reasons, 'entities.satellites.trajectory', 'old/new satellite producer trajectory is not renderable');
  }
  if (
    !hasRenderableBeam(focusRow.beamStates, focusRow.previousServing)
    || !hasRenderableBeam(focusRow.beamStates, focusRow.selectedServing)
  ) {
    pushGap(sourceGapFields, reasons, 'entities.beams.footprints', 'old/new beam producer footprint is not renderable');
  }
  if (!rewardIsFinite(focusRow.rewardVector, focusRow.scalarReward)) {
    pushGap(sourceGapFields, reasons, 'metrics.reward', 'producer reward vector or scalar reward is incomplete');
  }

  const denseQProof = buildModqnDenseQProof({
    policyDiagnostics: focusRow.policyDiagnostics,
    // Index dense Q by the policy action catalog (length A), not the physical
    // beam list (beamStates) — under a windowed action space they differ and
    // beamStates source-gaps every row. Legacy bundles omit the catalog and
    // fall back to beamStates (then stay source-gap with no dense Q). Mirrors
    // buildModqnDenseQProofFromReplayRow.
    actionOrder:
      focusRow.policyDiagnostics?.candidateActionOrder ?? focusRow.beamStates ?? [],
    decisionActionValidityMask: focusRow.decisionActionValidityMask ?? [],
  });
  if (!isModqnDenseQProofReady(denseQProof)) {
    pushGap(
      sourceGapFields,
      reasons,
      'diagnostics.denseQPolicy',
      denseQProof.reasons.join('; ') || 'dense-Q proof is absent',
    );
  }

  if (
    sourceGapFields.length === 0
    && nonEmptyString(eventId)
    && focusRow.handoverEventKind !== 'none'
  ) {
    return {
      status: 'ready',
      eventKind: focusRow.handoverEventKind,
      eventKey: formatEventKey(displayState, eventId),
      sourceGapFields: [],
      reasons: [],
      denseQProof,
    };
  }

  return {
    status: 'source-gap',
    eventKind: focusRow.handoverEventKind,
    eventKey: null,
    sourceGapFields,
    reasons,
    denseQProof,
  };
}

export function modqnReplayHandoverCinemaGateSourceGapFieldsAttr(
  gate: ModqnReplayHandoverCinemaGate,
): string {
  return gate.sourceGapFields.join(',');
}
