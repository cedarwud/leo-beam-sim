import type {
  ModqnReplayPlaybackDisplayState,
  ModqnReplayPlaybackFocusRow,
} from '../modqn/replay-bundle/playback-shell';
import type {
  ModqnBeamReference,
  ModqnHandoverEventKind,
} from '../modqn/replay-bundle/types';

export const MODQN_REPLAY_SCENE_SOURCE = 'display-only-canonical-7beam' as const;
export const MODQN_REPLAY_SCENE_BEAM_COUNT = 7;
export const MODQN_REPLAY_SCENE_BEAM_RADIUS_WORLD = 22;
export const MODQN_REPLAY_SCENE_SPACING_WORLD = 47;

export interface ModqnReplayScenePoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type ModqnReplaySceneBeamRole =
  | 'inactive'
  | 'previous'
  | 'selected'
  | 'previous-and-selected';

export interface ModqnReplaySceneBeamVisual {
  readonly canonicalLocalBeamIndex: number;
  readonly canonicalBeamNumber: number;
  readonly position: ModqnReplayScenePoint;
  readonly role: ModqnReplaySceneBeamRole;
  readonly previousProducerBeamId: string | null;
  readonly selectedProducerBeamId: string | null;
  readonly producerSatId: string | null;
}

export interface ModqnReplaySceneEndpointVisual {
  readonly role: 'previous' | 'selected';
  readonly producerBeamId: string;
  readonly producerSatId: string;
  readonly producerBeamIndex: number;
  readonly producerLocalBeamIndex: number;
  readonly canonicalBeamNumber: number;
  readonly position: ModqnReplayScenePoint;
  readonly label: string;
  readonly detail: string;
}

export interface ModqnReplaySceneSwitchVisual {
  readonly eventKind: ModqnHandoverEventKind;
  readonly activeIntraSatelliteSwitch: boolean;
  readonly sourcePosition: ModqnReplayScenePoint;
  readonly targetPosition: ModqnReplayScenePoint;
  readonly label: string;
}

export interface ModqnReplaySceneVisualState {
  readonly source: typeof MODQN_REPLAY_SCENE_SOURCE;
  readonly coordinateFrame: 'scene-world-display-layer';
  readonly modeLabel: string;
  readonly evidenceStatus: string;
  readonly sourceOwner: string;
  readonly sourcePath: string;
  readonly slotIndex: number;
  readonly sourceRowIndex: number;
  readonly sourceRowNumber: number;
  readonly eventKind: ModqnHandoverEventKind;
  readonly playing: boolean;
  readonly loopEnabled: boolean;
  readonly beams: readonly ModqnReplaySceneBeamVisual[];
  readonly previous: ModqnReplaySceneEndpointVisual;
  readonly selected: ModqnReplaySceneEndpointVisual;
  readonly switch: ModqnReplaySceneSwitchVisual;
}

function isCanonicalLocalBeamIndex(value: number): boolean {
  return Number.isInteger(value)
    && value >= 0
    && value < MODQN_REPLAY_SCENE_BEAM_COUNT;
}

export function createModqnReplayCanonicalBeamPosition(
  localBeamIndex: number,
  spacingWorld = MODQN_REPLAY_SCENE_SPACING_WORLD,
): ModqnReplayScenePoint | null {
  if (!isCanonicalLocalBeamIndex(localBeamIndex)) return null;
  if (localBeamIndex === 0) return { x: 0, y: 0, z: 0 };

  const ringIndex = localBeamIndex - 1;
  const angleRad = (ringIndex / 6) * Math.PI * 2;

  return {
    x: Math.cos(angleRad) * spacingWorld,
    y: 0,
    z: -Math.sin(angleRad) * spacingWorld,
  };
}

function formatEndpointLabel(role: 'previous' | 'selected', ref: ModqnBeamReference): string {
  const prefix = role === 'previous' ? 'Previous' : 'Selected';
  return `${prefix} B${ref.localBeamIndex + 1}`;
}

function formatEndpointDetail(ref: ModqnBeamReference): string {
  return `${ref.satId} / ${ref.beamId} / action ${ref.beamIndex}`;
}

function endpointVisual(
  role: 'previous' | 'selected',
  ref: ModqnBeamReference,
): ModqnReplaySceneEndpointVisual | null {
  const position = createModqnReplayCanonicalBeamPosition(ref.localBeamIndex);
  if (position === null) return null;

  return {
    role,
    producerBeamId: ref.beamId,
    producerSatId: ref.satId,
    producerBeamIndex: ref.beamIndex,
    producerLocalBeamIndex: ref.localBeamIndex,
    canonicalBeamNumber: ref.localBeamIndex + 1,
    position,
    label: formatEndpointLabel(role, ref),
    detail: formatEndpointDetail(ref),
  };
}

function resolveBeamRole(
  localBeamIndex: number,
  previous: ModqnBeamReference,
  selected: ModqnBeamReference,
): ModqnReplaySceneBeamRole {
  const isPrevious = previous.localBeamIndex === localBeamIndex;
  const isSelected = selected.localBeamIndex === localBeamIndex;

  if (isPrevious && isSelected) return 'previous-and-selected';
  if (isPrevious) return 'previous';
  if (isSelected) return 'selected';
  return 'inactive';
}

function beamProducerSatId(
  role: ModqnReplaySceneBeamRole,
  previous: ModqnBeamReference,
  selected: ModqnBeamReference,
): string | null {
  if (role === 'previous-and-selected') return selected.satId;
  if (role === 'previous') return previous.satId;
  if (role === 'selected') return selected.satId;
  return null;
}

function createBeamVisuals(focusRow: ModqnReplayPlaybackFocusRow): readonly ModqnReplaySceneBeamVisual[] | null {
  const beams: ModqnReplaySceneBeamVisual[] = [];

  for (let localBeamIndex = 0; localBeamIndex < MODQN_REPLAY_SCENE_BEAM_COUNT; localBeamIndex += 1) {
    const position = createModqnReplayCanonicalBeamPosition(localBeamIndex);
    if (position === null) return null;

    const role = resolveBeamRole(localBeamIndex, focusRow.previousServing, focusRow.selectedServing);
    beams.push({
      canonicalLocalBeamIndex: localBeamIndex,
      canonicalBeamNumber: localBeamIndex + 1,
      position,
      role,
      previousProducerBeamId: focusRow.previousServing.localBeamIndex === localBeamIndex
        ? focusRow.previousServing.beamId
        : null,
      selectedProducerBeamId: focusRow.selectedServing.localBeamIndex === localBeamIndex
        ? focusRow.selectedServing.beamId
        : null,
      producerSatId: beamProducerSatId(role, focusRow.previousServing, focusRow.selectedServing),
    });
  }

  return beams;
}

export function deriveModqnReplaySceneVisualState(
  displayState: ModqnReplayPlaybackDisplayState | null,
): ModqnReplaySceneVisualState | null {
  if (displayState === null) return null;

  const focusRow = displayState.currentSlot.focusRow;
  const previous = endpointVisual('previous', focusRow.previousServing);
  const selected = endpointVisual('selected', focusRow.selectedServing);
  const beams = createBeamVisuals(focusRow);
  if (previous === null || selected === null || beams === null) return null;

  return {
    source: MODQN_REPLAY_SCENE_SOURCE,
    coordinateFrame: 'scene-world-display-layer',
    modeLabel: displayState.modeLabel,
    evidenceStatus: displayState.evidenceStatus,
    sourceOwner: displayState.sourceOwner,
    sourcePath: displayState.sourcePath,
    slotIndex: displayState.currentSlot.slotIndex,
    sourceRowIndex: focusRow.sourceRowIndex,
    sourceRowNumber: focusRow.sourceRowIndex + 1,
    eventKind: focusRow.handoverEventKind,
    playing: displayState.playing,
    loopEnabled: displayState.loopEnabled,
    beams,
    previous,
    selected,
    switch: {
      eventKind: focusRow.handoverEventKind,
      activeIntraSatelliteSwitch: focusRow.handoverEventKind === 'intra-satellite-beam-switch',
      sourcePosition: previous.position,
      targetPosition: selected.position,
      label: focusRow.handoverEventKind === 'intra-satellite-beam-switch'
        ? 'Intra-sat beam switch'
        : focusRow.handoverEventKind,
    },
  };
}
