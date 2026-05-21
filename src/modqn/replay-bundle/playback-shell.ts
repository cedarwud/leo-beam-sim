import {
  MODQN_EXPECTED_EVENT_COUNTS,
  MODQN_REPLAY_7BEAM_EVIDENCE_STATUS,
  MODQN_REPLAY_7BEAM_MODE_KEY,
  MODQN_REPLAY_7BEAM_MODE_LABEL,
  SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH,
  type ModqnReplayEnvelope,
} from './replay-state';
import type {
  ModqnBeamReference,
  ModqnHandoverEventKind,
  ModqnPolicyDiagnostics,
  ModqnRewardVector,
} from './types';
import type { RuntimeOmegaState } from '../../ui/useModqnHandoverState';
import { reScalarize } from './rescalarize';

export type ModqnReplayPlaybackStepKind = 'source-slot';

export type ModqnReplayPlaybackDiagnosticsStatus =
  | 'present-from-producer'
  | 'missing-from-producer';

export type ModqnReplayPlaybackEventCounts =
  Readonly<Record<ModqnHandoverEventKind, number>>;

export interface ModqnReplayPlaybackFocusRow {
  readonly sourceRowIndex: number;
  readonly slotRowIndex: number;
  readonly userId: string;
  readonly userIndex: number;
  readonly timeSec: number;
  readonly decisionTimeSec: number;
  readonly previousServing: ModqnBeamReference;
  readonly selectedServing: ModqnBeamReference;
  readonly producerSelectedServing?: ModqnBeamReference;
  readonly producerHandoverEventKind?: ModqnHandoverEventKind;
  readonly selectedServingSource?:
    | 'producer'
    | 'omega-rescalarized'
    | 'omega-rescalarized-fallback';
  readonly appliedOmega?: RuntimeOmegaState;
  readonly handoverEventKind: ModqnHandoverEventKind;
  readonly scalarReward: number;
  readonly rewardVector: ModqnRewardVector;
  readonly policyDiagnostics?: ModqnPolicyDiagnostics;
  readonly diagnosticsStatus: ModqnReplayPlaybackDiagnosticsStatus;
  readonly availableActionCount: number | null;
}

export interface ModqnReplayPlaybackSlot {
  readonly slotIndex: number;
  readonly sourceRowStartIndex: number;
  readonly sourceRowEndIndex: number;
  readonly rowCount: number;
  readonly eventCounts: ModqnReplayPlaybackEventCounts;
  readonly focusRow: ModqnReplayPlaybackFocusRow;
}

export interface ModqnReplayPlaybackShellModel {
  readonly modeKey: typeof MODQN_REPLAY_7BEAM_MODE_KEY;
  readonly modeLabel: typeof MODQN_REPLAY_7BEAM_MODE_LABEL;
  readonly evidenceStatus: typeof MODQN_REPLAY_7BEAM_EVIDENCE_STATUS;
  readonly sourceOwner: 'modqn-paper-reproduction';
  readonly sourcePath: typeof SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH;
  readonly stepKind: ModqnReplayPlaybackStepKind;
  readonly rowCount: number;
  readonly slotCount: number;
  readonly eventCounts: ModqnReplayPlaybackEventCounts;
  readonly diagnosticsStatus: ModqnReplayPlaybackDiagnosticsStatus;
  readonly slots: readonly ModqnReplayPlaybackSlot[];
}

export interface ModqnReplayPlaybackDisplayState {
  readonly modeKey: typeof MODQN_REPLAY_7BEAM_MODE_KEY;
  readonly modeLabel: typeof MODQN_REPLAY_7BEAM_MODE_LABEL;
  readonly evidenceStatus: typeof MODQN_REPLAY_7BEAM_EVIDENCE_STATUS;
  readonly sourceOwner: 'modqn-paper-reproduction';
  readonly sourcePath: typeof SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH;
  readonly stepKind: ModqnReplayPlaybackStepKind;
  readonly rowCount: number;
  readonly slotCount: number;
  readonly slotOffset: number;
  readonly playing: boolean;
  readonly loopEnabled: boolean;
  readonly currentSlot: ModqnReplayPlaybackSlot;
  readonly eventCounts: ModqnReplayPlaybackEventCounts;
  readonly diagnosticsStatus: ModqnReplayPlaybackDiagnosticsStatus;
}

export type ModqnReplayPlaybackModelValidationCode =
  | 'missing-model'
  | 'unexpected-mode'
  | 'unexpected-evidence-status'
  | 'unexpected-source'
  | 'unexpected-step-kind'
  | 'missing-slots'
  | 'unexpected-shape'
  | 'unexpected-event-counts';

export interface ModqnReplayPlaybackModelValidationIssue {
  readonly code: ModqnReplayPlaybackModelValidationCode;
  readonly message: string;
}

function createEmptyEventCounts(): Record<ModqnHandoverEventKind, number> {
  return {
    none: 0,
    'intra-satellite-beam-switch': 0,
    'inter-satellite-handover': 0,
  };
}

function validationIssue(
  code: ModqnReplayPlaybackModelValidationCode,
  message: string,
): ModqnReplayPlaybackModelValidationIssue {
  return { code, message };
}

export function getModqnReplayPlaybackModelValidationIssue(
  model: ModqnReplayPlaybackShellModel | null | undefined,
): ModqnReplayPlaybackModelValidationIssue | null {
  if (model === null || model === undefined) {
    return validationIssue(
      'missing-model',
      'Selected MODQN replay artifact display model is missing.',
    );
  }

  if (model.modeKey !== MODQN_REPLAY_7BEAM_MODE_KEY || model.modeLabel !== MODQN_REPLAY_7BEAM_MODE_LABEL) {
    return validationIssue(
      'unexpected-mode',
      'Selected replay display model is not the accepted 7-beam MODQN producer artifact mode.',
    );
  }

  if (model.evidenceStatus !== MODQN_REPLAY_7BEAM_EVIDENCE_STATUS) {
    return validationIssue(
      'unexpected-evidence-status',
      'Selected replay display model is not accepted-7beam-baseline evidence.',
    );
  }

  if (
    model.sourceOwner !== 'modqn-paper-reproduction'
    || model.sourcePath !== SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH
  ) {
    return validationIssue(
      'unexpected-source',
      'Selected replay display model does not point at the approved producer artifact path.',
    );
  }

  if (model.stepKind !== 'source-slot') {
    return validationIssue(
      'unexpected-step-kind',
      'Selected replay display model is not read-only source-slot playback.',
    );
  }

  if (model.slots.length === 0) {
    return validationIssue(
      'missing-slots',
      'Selected replay display model has no source slots to display.',
    );
  }

  if (model.rowCount !== 1000 || model.slotCount !== 10 || model.slots.length !== model.slotCount) {
    return validationIssue(
      'unexpected-shape',
      'Selected replay display model does not match the 1000-row / 10-slot accepted artifact shape.',
    );
  }

  if (
    model.eventCounts['intra-satellite-beam-switch'] !== MODQN_EXPECTED_EVENT_COUNTS['intra-satellite-beam-switch']
    || model.eventCounts.none !== MODQN_EXPECTED_EVENT_COUNTS.none
    || model.eventCounts['inter-satellite-handover'] !== MODQN_EXPECTED_EVENT_COUNTS['inter-satellite-handover']
  ) {
    return validationIssue(
      'unexpected-event-counts',
      'Selected replay display model does not match the accepted producer artifact event counts.',
    );
  }

  return null;
}

export function createModqnReplayPlaybackDisplayState(
  model: ModqnReplayPlaybackShellModel,
  slotOffset = 0,
  playing = false,
  loopEnabled = true,
): ModqnReplayPlaybackDisplayState {
  const firstSlot = model.slots[0];
  if (firstSlot === undefined) {
    throw new Error('MODQN Phase 7G replay cues require at least one source slot');
  }

  const maxSlotOffset = Math.max(model.slots.length - 1, 0);
  const safeSlotOffset = Math.min(Math.max(Math.trunc(slotOffset), 0), maxSlotOffset);

  return {
    modeKey: model.modeKey,
    modeLabel: model.modeLabel,
    evidenceStatus: model.evidenceStatus,
    sourceOwner: model.sourceOwner,
    sourcePath: model.sourcePath,
    stepKind: model.stepKind,
    rowCount: model.rowCount,
    slotCount: model.slotCount,
    slotOffset: safeSlotOffset,
    playing,
    loopEnabled,
    currentSlot: model.slots[safeSlotOffset] ?? firstSlot,
    eventCounts: model.eventCounts,
    diagnosticsStatus: model.diagnosticsStatus,
  };
}

function deriveHandoverEventKind(
  previous: ModqnBeamReference,
  selected: ModqnBeamReference,
): ModqnHandoverEventKind {
  if (previous.satId !== selected.satId) return 'inter-satellite-handover';
  if (previous.localBeamIndex !== selected.localBeamIndex) {
    return 'intra-satellite-beam-switch';
  }
  return 'none';
}

function findPolicyCandidateServing(
  diagnostics: ModqnPolicyDiagnostics,
  satId: string,
  localBeamIndex: number,
): ModqnBeamReference | null {
  const candidate = diagnostics.topCandidates?.find(entry => (
    entry.satId === satId && entry.localBeamIndex === localBeamIndex
  ));
  return candidate ?? null;
}

export function createOmegaRescalarizedModqnReplayPlaybackDisplayState(
  displayState: ModqnReplayPlaybackDisplayState | null,
  omega: RuntimeOmegaState,
): ModqnReplayPlaybackDisplayState | null {
  if (displayState === null) return null;

  const focusRow = displayState.currentSlot.focusRow;
  const diagnostics = focusRow.policyDiagnostics;
  const result = reScalarize(diagnostics?.topCandidates, omega);
  if (diagnostics === undefined || result === null) return displayState;

  const selectedServing = findPolicyCandidateServing(
    diagnostics,
    result.satId,
    result.beamId,
  );
  if (selectedServing === null) return displayState;

  const nextFocusRow: ModqnReplayPlaybackFocusRow = {
    ...focusRow,
    producerSelectedServing:
      focusRow.producerSelectedServing ?? focusRow.selectedServing,
    producerHandoverEventKind:
      focusRow.producerHandoverEventKind ?? focusRow.handoverEventKind,
    selectedServing,
    selectedServingSource: result.wasFallback
      ? 'omega-rescalarized-fallback'
      : 'omega-rescalarized',
    appliedOmega: omega,
    handoverEventKind: deriveHandoverEventKind(
      focusRow.previousServing,
      selectedServing,
    ),
  };

  const nextSlot: ModqnReplayPlaybackSlot = {
    ...displayState.currentSlot,
    focusRow: nextFocusRow,
  };

  return {
    ...displayState,
    currentSlot: nextSlot,
  };
}

export function createModqnReplayPlaybackShellModel(
  envelope: ModqnReplayEnvelope,
): ModqnReplayPlaybackShellModel {
  return {
    modeKey: MODQN_REPLAY_7BEAM_MODE_KEY,
    modeLabel: MODQN_REPLAY_7BEAM_MODE_LABEL,
    evidenceStatus: MODQN_REPLAY_7BEAM_EVIDENCE_STATUS,
    sourceOwner: 'modqn-paper-reproduction',
    sourcePath: SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH,
    stepKind: 'source-slot',
    rowCount: envelope.diagnostics.adapter.rowCount,
    slotCount: envelope.diagnostics.adapter.slotCount,
    eventCounts: {
      none: envelope.diagnostics.adapter.eventCounts.none,
      'intra-satellite-beam-switch':
        envelope.diagnostics.adapter.eventCounts['intra-satellite-beam-switch'],
      'inter-satellite-handover':
        envelope.diagnostics.adapter.eventCounts['inter-satellite-handover'],
    },
    diagnosticsStatus: envelope.diagnostics.producerPolicyDiagnostics.status,
    slots: envelope.replaySlots.map(slot => {
      const focusRow = slot.rows[0];
      if (focusRow === undefined) {
        throw new Error(`MODQN Phase 7F playback shell: slot ${slot.slotIndex} has no source rows`);
      }

      const slotEventCounts = createEmptyEventCounts();
      for (const row of slot.rows) {
        slotEventCounts[row.producerTruth.handoverEvent.kind] += 1;
      }

      return {
        slotIndex: slot.slotIndex,
        sourceRowStartIndex: slot.sourceRowStartIndex,
        sourceRowEndIndex: slot.sourceRowEndIndex,
        rowCount: slot.rowCount,
        eventCounts: slotEventCounts,
        focusRow: {
          sourceRowIndex: focusRow.sourceRowIndex,
          slotRowIndex: focusRow.slotRowIndex,
          userId: focusRow.producerTruth.userId,
          userIndex: focusRow.producerTruth.userIndex,
          timeSec: focusRow.producerTruth.timestamps.timeSec,
          decisionTimeSec: focusRow.producerTruth.timestamps.decisionTimeSec,
          previousServing: focusRow.producerTruth.previousServing,
          selectedServing: focusRow.producerTruth.selectedServing,
          handoverEventKind: focusRow.producerTruth.handoverEvent.kind,
          scalarReward: focusRow.producerTruth.scalarReward,
          rewardVector: focusRow.producerTruth.rewardVector,
          policyDiagnostics: focusRow.producerTruth.policyDiagnostics,
          diagnosticsStatus: focusRow.producerTruth.policyDiagnostics === undefined
            ? 'missing-from-producer'
            : 'present-from-producer',
          availableActionCount: focusRow.producerTruth.policyDiagnostics?.availableActionCount ?? null,
        },
      };
    }),
  };
}

// MODQN ω-Handover S2 fallback accessor.
//
// Returns the immutable typed-reference shell model used as the demo-render
// fallback when the runtime bundle fetch in App.tsx fails. The constant
// MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL must not be imported into
// App.tsx after S2 (SDD §9.3); this accessor is the supported indirection so
// the fallback path stays demoable when the dev server has not been started
// from the right cwd, the producer artifact has moved, etc.
export function getModqnReplayPlaybackFallbackShellModel(): ModqnReplayPlaybackShellModel {
  return MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL;
}

export const MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL = {
  modeKey: 'modqn-replay-7beam',
  modeLabel: 'MODQN replay - 7-beam producer artifact',
  evidenceStatus: 'accepted-7beam-baseline',
  sourceOwner: 'modqn-paper-reproduction',
  sourcePath: SELECTED_MODQN_PHASE7C_REPLAY_BUNDLE_PATH,
  stepKind: 'source-slot',
  rowCount: 1000,
  slotCount: 10,
  eventCounts: MODQN_EXPECTED_EVENT_COUNTS,
  diagnosticsStatus: 'present-from-producer',
  slots: [
    {
      slotIndex: 1,
      sourceRowStartIndex: 0,
      sourceRowEndIndex: 99,
      rowCount: 100,
      eventCounts: { none: 18, 'intra-satellite-beam-switch': 82, 'inter-satellite-handover': 0 },
      focusRow: {
        sourceRowIndex: 0,
        slotRowIndex: 0,
        userId: 'user-0',
        userIndex: 0,
        timeSec: 1,
        decisionTimeSec: 0,
        previousServing: {
          beamId: 'sat-0-beam-3',
          beamIndex: 3,
          satId: 'sat-0',
          satIndex: 0,
          localBeamIndex: 3,
          validUnderDecisionMask: true,
          validUnderPostStepMask: true,
        },
        selectedServing: {
          beamId: 'sat-0-beam-1',
          beamIndex: 1,
          satId: 'sat-0',
          satIndex: 0,
          localBeamIndex: 1,
          validUnderDecisionMask: true,
          validUnderPostStepMask: true,
        },
        handoverEventKind: 'intra-satellite-beam-switch',
        scalarReward: 5.361922306060791,
        rewardVector: {
          r1Throughput: 17.765361785888672,
          r2Handover: -0.5,
          r3LoadBalance: -16.853792934417726,
        },
        diagnosticsStatus: 'present-from-producer',
        availableActionCount: 7,
      },
    },
    {
      slotIndex: 2,
      sourceRowStartIndex: 100,
      sourceRowEndIndex: 199,
      rowCount: 100,
      eventCounts: { none: 100, 'intra-satellite-beam-switch': 0, 'inter-satellite-handover': 0 },
      focusRow: {
        sourceRowIndex: 100,
        slotRowIndex: 0,
        userId: 'user-0',
        userIndex: 0,
        timeSec: 2,
        decisionTimeSec: 1,
        previousServing: {
          beamId: 'sat-0-beam-1',
          beamIndex: 1,
          satId: 'sat-0',
          satIndex: 0,
          localBeamIndex: 1,
          validUnderDecisionMask: true,
          validUnderPostStepMask: true,
        },
        selectedServing: {
          beamId: 'sat-0-beam-1',
          beamIndex: 1,
          satId: 'sat-0',
          satIndex: 0,
          localBeamIndex: 1,
          validUnderDecisionMask: true,
          validUnderPostStepMask: true,
        },
        handoverEventKind: 'none',
        scalarReward: 4.814667896270752,
        rewardVector: {
          r1Throughput: 16.6057186126709,
          r2Handover: 0,
          r3LoadBalance: -17.440957050323487,
        },
        diagnosticsStatus: 'present-from-producer',
        availableActionCount: 7,
      },
    },
    {
      slotIndex: 3,
      sourceRowStartIndex: 200,
      sourceRowEndIndex: 299,
      rowCount: 100,
      eventCounts: { none: 100, 'intra-satellite-beam-switch': 0, 'inter-satellite-handover': 0 },
      focusRow: {
        sourceRowIndex: 200,
        slotRowIndex: 0,
        userId: 'user-0',
        userIndex: 0,
        timeSec: 3,
        decisionTimeSec: 2,
        previousServing: {
          beamId: 'sat-0-beam-1',
          beamIndex: 1,
          satId: 'sat-0',
          satIndex: 0,
          localBeamIndex: 1,
          validUnderDecisionMask: true,
          validUnderPostStepMask: true,
        },
        selectedServing: {
          beamId: 'sat-0-beam-1',
          beamIndex: 1,
          satId: 'sat-0',
          satIndex: 0,
          localBeamIndex: 1,
          validUnderDecisionMask: true,
          validUnderPostStepMask: true,
        },
        handoverEventKind: 'none',
        scalarReward: 7.729289022445679,
        rewardVector: {
          r1Throughput: 22.487613677978516,
          r2Handover: 0,
          r3LoadBalance: -17.572589082717897,
        },
        diagnosticsStatus: 'present-from-producer',
        availableActionCount: 7,
      },
    },
    {
      slotIndex: 4,
      sourceRowStartIndex: 300,
      sourceRowEndIndex: 399,
      rowCount: 100,
      eventCounts: { none: 100, 'intra-satellite-beam-switch': 0, 'inter-satellite-handover': 0 },
      focusRow: {
        sourceRowIndex: 300,
        slotRowIndex: 0,
        userId: 'user-0',
        userIndex: 0,
        timeSec: 4,
        decisionTimeSec: 3,
        previousServing: {
          beamId: 'sat-0-beam-1',
          beamIndex: 1,
          satId: 'sat-0',
          satIndex: 0,
          localBeamIndex: 1,
          validUnderDecisionMask: true,
          validUnderPostStepMask: true,
        },
        selectedServing: {
          beamId: 'sat-0-beam-1',
          beamIndex: 1,
          satId: 'sat-0',
          satIndex: 0,
          localBeamIndex: 1,
          validUnderDecisionMask: true,
          validUnderPostStepMask: true,
        },
        handoverEventKind: 'none',
        scalarReward: 2.024377471923828,
        rewardVector: {
          r1Throughput: 11.070615768432617,
          r2Handover: 0,
          r3LoadBalance: -17.554652061462402,
        },
        diagnosticsStatus: 'present-from-producer',
        availableActionCount: 7,
      },
    },
    {
      slotIndex: 5,
      sourceRowStartIndex: 400,
      sourceRowEndIndex: 499,
      rowCount: 100,
      eventCounts: { none: 100, 'intra-satellite-beam-switch': 0, 'inter-satellite-handover': 0 },
      focusRow: {
        sourceRowIndex: 400,
        slotRowIndex: 0,
        userId: 'user-0',
        userIndex: 0,
        timeSec: 5,
        decisionTimeSec: 4,
        previousServing: {
          beamId: 'sat-0-beam-1',
          beamIndex: 1,
          satId: 'sat-0',
          satIndex: 0,
          localBeamIndex: 1,
          validUnderDecisionMask: true,
          validUnderPostStepMask: true,
        },
        selectedServing: {
          beamId: 'sat-0-beam-1',
          beamIndex: 1,
          satId: 'sat-0',
          satIndex: 0,
          localBeamIndex: 1,
          validUnderDecisionMask: true,
          validUnderPostStepMask: true,
        },
        handoverEventKind: 'none',
        scalarReward: 5.482919040679931,
        rewardVector: {
          r1Throughput: 18.08970069885254,
          r2Handover: 0,
          r3LoadBalance: -17.80965654373169,
        },
        diagnosticsStatus: 'present-from-producer',
        availableActionCount: 7,
      },
    },
    {
      slotIndex: 6,
      sourceRowStartIndex: 500,
      sourceRowEndIndex: 599,
      rowCount: 100,
      eventCounts: { none: 100, 'intra-satellite-beam-switch': 0, 'inter-satellite-handover': 0 },
      focusRow: {
        sourceRowIndex: 500,
        slotRowIndex: 0,
        userId: 'user-0',
        userIndex: 0,
        timeSec: 6,
        decisionTimeSec: 5,
        previousServing: {
          beamId: 'sat-0-beam-1',
          beamIndex: 1,
          satId: 'sat-0',
          satIndex: 0,
          localBeamIndex: 1,
          validUnderDecisionMask: true,
          validUnderPostStepMask: true,
        },
        selectedServing: {
          beamId: 'sat-0-beam-1',
          beamIndex: 1,
          satId: 'sat-0',
          satIndex: 0,
          localBeamIndex: 1,
          validUnderDecisionMask: true,
          validUnderPostStepMask: true,
        },
        handoverEventKind: 'none',
        scalarReward: 3.5907409591674804,
        rewardVector: {
          r1Throughput: 14.123076438903809,
          r2Handover: 0,
          r3LoadBalance: -17.35398630142212,
        },
        diagnosticsStatus: 'present-from-producer',
        availableActionCount: 7,
      },
    },
    {
      slotIndex: 7,
      sourceRowStartIndex: 600,
      sourceRowEndIndex: 699,
      rowCount: 100,
      eventCounts: { none: 100, 'intra-satellite-beam-switch': 0, 'inter-satellite-handover': 0 },
      focusRow: {
        sourceRowIndex: 600,
        slotRowIndex: 0,
        userId: 'user-0',
        userIndex: 0,
        timeSec: 7,
        decisionTimeSec: 6,
        previousServing: {
          beamId: 'sat-0-beam-1',
          beamIndex: 1,
          satId: 'sat-0',
          satIndex: 0,
          localBeamIndex: 1,
          validUnderDecisionMask: true,
          validUnderPostStepMask: true,
        },
        selectedServing: {
          beamId: 'sat-0-beam-1',
          beamIndex: 1,
          satId: 'sat-0',
          satIndex: 0,
          localBeamIndex: 1,
          validUnderDecisionMask: true,
          validUnderPostStepMask: true,
        },
        handoverEventKind: 'none',
        scalarReward: 4.860362812042236,
        rewardVector: {
          r1Throughput: 16.601289749145508,
          r2Handover: 0,
          r3LoadBalance: -17.201410312652587,
        },
        diagnosticsStatus: 'present-from-producer',
        availableActionCount: 7,
      },
    },
    {
      slotIndex: 8,
      sourceRowStartIndex: 700,
      sourceRowEndIndex: 799,
      rowCount: 100,
      eventCounts: { none: 100, 'intra-satellite-beam-switch': 0, 'inter-satellite-handover': 0 },
      focusRow: {
        sourceRowIndex: 700,
        slotRowIndex: 0,
        userId: 'user-0',
        userIndex: 0,
        timeSec: 8,
        decisionTimeSec: 7,
        previousServing: {
          beamId: 'sat-0-beam-1',
          beamIndex: 1,
          satId: 'sat-0',
          satIndex: 0,
          localBeamIndex: 1,
          validUnderDecisionMask: true,
          validUnderPostStepMask: true,
        },
        selectedServing: {
          beamId: 'sat-0-beam-1',
          beamIndex: 1,
          satId: 'sat-0',
          satIndex: 0,
          localBeamIndex: 1,
          validUnderDecisionMask: true,
          validUnderPostStepMask: true,
        },
        handoverEventKind: 'none',
        scalarReward: 6.903380182266235,
        rewardVector: {
          r1Throughput: 20.869224548339844,
          r2Handover: 0,
          r3LoadBalance: -17.656160459518432,
        },
        diagnosticsStatus: 'present-from-producer',
        availableActionCount: 7,
      },
    },
    {
      slotIndex: 9,
      sourceRowStartIndex: 800,
      sourceRowEndIndex: 899,
      rowCount: 100,
      eventCounts: { none: 100, 'intra-satellite-beam-switch': 0, 'inter-satellite-handover': 0 },
      focusRow: {
        sourceRowIndex: 800,
        slotRowIndex: 0,
        userId: 'user-0',
        userIndex: 0,
        timeSec: 9,
        decisionTimeSec: 8,
        previousServing: {
          beamId: 'sat-0-beam-1',
          beamIndex: 1,
          satId: 'sat-0',
          satIndex: 0,
          localBeamIndex: 1,
          validUnderDecisionMask: true,
          validUnderPostStepMask: true,
        },
        selectedServing: {
          beamId: 'sat-0-beam-1',
          beamIndex: 1,
          satId: 'sat-0',
          satIndex: 0,
          localBeamIndex: 1,
          validUnderDecisionMask: true,
          validUnderPostStepMask: true,
        },
        handoverEventKind: 'none',
        scalarReward: 8.493200187683104,
        rewardVector: {
          r1Throughput: 23.8810977935791,
          r2Handover: 0,
          r3LoadBalance: -17.236743545532228,
        },
        diagnosticsStatus: 'present-from-producer',
        availableActionCount: 7,
      },
    },
    {
      slotIndex: 10,
      sourceRowStartIndex: 900,
      sourceRowEndIndex: 999,
      rowCount: 100,
      eventCounts: { none: 100, 'intra-satellite-beam-switch': 0, 'inter-satellite-handover': 0 },
      focusRow: {
        sourceRowIndex: 900,
        slotRowIndex: 0,
        userId: 'user-0',
        userIndex: 0,
        timeSec: 10,
        decisionTimeSec: 9,
        previousServing: {
          beamId: 'sat-0-beam-1',
          beamIndex: 1,
          satId: 'sat-0',
          satIndex: 0,
          localBeamIndex: 1,
          validUnderDecisionMask: true,
          validUnderPostStepMask: true,
        },
        selectedServing: {
          beamId: 'sat-0-beam-1',
          beamIndex: 1,
          satId: 'sat-0',
          satIndex: 0,
          localBeamIndex: 1,
          validUnderDecisionMask: true,
          validUnderPostStepMask: true,
        },
        handoverEventKind: 'none',
        scalarReward: 4.460901739120484,
        rewardVector: {
          r1Throughput: 15.980642318725586,
          r2Handover: 0,
          r3LoadBalance: -17.647097101211546,
        },
        diagnosticsStatus: 'present-from-producer',
        availableActionCount: 7,
      },
    },
  ],
} as const satisfies ModqnReplayPlaybackShellModel;
