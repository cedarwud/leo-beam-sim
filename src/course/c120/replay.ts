import {
  assertC120Replay,
  assertC120ScenarioIdentity,
  C120ContractError,
  replayInputId,
  type C120AuthoritativeReplay,
  type C120CardEvidence,
  type C120LabAScenarioInput,
  type C120LabBScenarioInput,
  type C120LabCScenarioInput,
  type C120LabCSlots,
  type C120ClinicScenarioInput,
  type C120ReplayFrame,
  type C120ReplayInput,
  type C120Scenario,
  type C120ScenarioIdentity,
  type C120SurfaceIdentity,
  type C120SurfaceId,
} from './contract';

/**
 * Values for one authoritative frame.  These are authored replay values; this
 * helper only attaches the identity required by the frozen C-120 contract.
 */
export type C120ReplayFrameSpec = Omit<C120ReplayFrame, 'identity' | 'frameIndex'>;

function objectRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new C120ContractError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new C120ContractError(`${label} has unknown or missing fields`);
  }
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new C120ContractError(`${label} is unsupported`);
  }
  return value as T;
}

function exactLiteral<T extends string>(value: unknown, expected: T, label: string): T {
  if (value !== expected) throw new C120ContractError(`${label} mismatch`);
  return expected;
}

function inputCollection(scenario: C120Scenario, surface: Exclude<C120SurfaceId, 'tle' | 'workbook'>): readonly C120AuthoritativeReplay[] {
  if (surface === 'lab-a') return scenario.labA.replays;
  if (surface === 'lab-b') return scenario.labB.replays;
  if (surface === 'lab-c') return scenario.labC.replays;
  return scenario.clinic.replays;
}

/**
 * Runtime parser for replay inputs.  Resolver callers do not get to select a
 * replay by an untyped string or by a partial object: every discriminant and
 * every frozen scenario field must be present and known.
 */
export function parseC120ReplayInput(value: unknown): C120ReplayInput {
  const candidate = objectRecord(value, 'replay input');
  const surface = candidate.surface;
  const missionContractId = oneOf(
    candidate.missionContractId,
    ['mission-fixed-service-boundary', 'mission-different-deadline'],
    'replay input.missionContractId',
  );

  if (surface === 'lab-a') {
    exactKeys(candidate, ['surface', 'missionContractId', 'candidateId', 'hiddenConditionId'], 'lab-a replay input');
    const parsed: C120LabAScenarioInput = {
      surface: 'lab-a',
      missionContractId,
      candidateId: oneOf(candidate.candidateId, ['pace', 'balanced', 'burst-to-sleep'], 'lab-a.candidateId'),
      hiddenConditionId: oneOf(candidate.hiddenConditionId, ['high-idle-cost', 'tight-service-window'], 'lab-a.hiddenConditionId'),
    };
    return parsed;
  }

  if (surface === 'lab-b') {
    exactKeys(candidate, ['surface', 'missionContractId', 'frozenRuleId', 'thresholdId', 'holdCountId', 'lowerThresholdId', 'traceId'], 'lab-b replay input');
    const parsed: C120LabBScenarioInput = {
      surface: 'lab-b',
      missionContractId,
      frozenRuleId: oneOf(candidate.frozenRuleId, ['switch-now', 'stable-two', 'hysteresis'], 'lab-b.frozenRuleId'),
      thresholdId: oneOf(candidate.thresholdId, ['threshold-low', 'threshold-steady', 'threshold-high'], 'lab-b.thresholdId'),
      holdCountId: oneOf(candidate.holdCountId, ['one-step', 'two-steps'], 'lab-b.holdCountId'),
      lowerThresholdId: oneOf(candidate.lowerThresholdId, ['lower-same', 'lower-one-band', 'lower-two-bands'], 'lab-b.lowerThresholdId'),
      traceId: exactLiteral(candidate.traceId, 'trace-b-withheld', 'lab-b.traceId'),
    };
    return parsed;
  }

  if (surface === 'clinic') {
    exactKeys(candidate, ['surface', 'missionContractId', 'actionId', 'featureSetId', 'traceId'], 'clinic replay input');
    const parsed: C120ClinicScenarioInput = {
      surface: 'clinic',
      missionContractId,
      actionId: oneOf(candidate.actionId, ['protect-service', 'chase-score'], 'clinic.actionId'),
      featureSetId: oneOf(candidate.featureSetId, ['decision-time-only', 'post-action-mixed'], 'clinic.featureSetId'),
      traceId: exactLiteral(candidate.traceId, 'chronological-trace-b', 'clinic.traceId'),
    };
    return parsed;
  }

  if (surface === 'lab-c') {
    exactKeys(candidate, ['surface', 'missionContractId', 'slots', 'revisionOrdinal', 'withheldEvent'], 'lab-c replay input');
    if (!Array.isArray(candidate.slots) || candidate.slots.length !== 6) {
      throw new C120ContractError('lab-c.slots must contain six actions');
    }
    const slots = candidate.slots.map((slot, index) => oneOf(
      slot,
      ['fixed-contact', 'fixed-outage', 'send-urgent', 'batch-periodic', 'send-bulk', 'flush-batch', 'wait', 'sleep'],
      `lab-c.slots[${index}]`,
    ));
    if (slots[0] !== 'fixed-contact' || slots[3] !== 'fixed-outage') {
      throw new C120ContractError('lab-c.slots fixed contact/outage anchors mismatch');
    }
    if (candidate.revisionOrdinal !== 0 && candidate.revisionOrdinal !== 1) {
      throw new C120ContractError('lab-c.revisionOrdinal mismatch');
    }
    const parsed: C120LabCScenarioInput = {
      surface: 'lab-c',
      missionContractId,
      slots: slots as unknown as C120LabCSlots,
      revisionOrdinal: candidate.revisionOrdinal,
      withheldEvent: oneOf(candidate.withheldEvent, ['none', 'shorter-window', 'surprise-urgent'], 'lab-c.withheldEvent'),
    };
    return parsed;
  }

  throw new C120ContractError('replay input surface is unsupported');
}

export function c120SurfaceIdentity(
  scenarioIdentity: C120ScenarioIdentity,
  surface: C120SurfaceId,
): C120SurfaceIdentity {
  return { ...scenarioIdentity, surface };
}

export function makeC120Frame(
  identity: C120SurfaceIdentity,
  replayId: string,
  replayInputId: string,
  frameIndex: number,
  spec: C120ReplayFrameSpec,
): C120ReplayFrame {
  return {
    identity: {
      ...identity,
      replayId,
      replayInputId,
      frameId: `${replayId}:frame-${frameIndex}`,
    },
    frameIndex,
    ...spec,
  };
}

export function makeC120Replay(
  scenarioIdentity: C120ScenarioIdentity,
  replayId: string,
  input: C120ReplayInput,
  mechanismLabel: string,
  conditionLabel: string,
  frameSpecs: readonly C120ReplayFrameSpec[],
  cardLedger: readonly C120CardEvidence[] = [],
): C120AuthoritativeReplay {
  if (frameSpecs.length < 2) throw new C120ContractError(`${replayId} requires at least two frame values`);
  const inputId = replayInputId(input);
  const identity = c120SurfaceIdentity(scenarioIdentity, input.surface);
  const frames = frameSpecs.map((spec, frameIndex) => makeC120Frame(
    identity,
    replayId,
    inputId,
    frameIndex,
    spec,
  ));
  const outcome = frames[frames.length - 1]?.evidence;
  if (outcome === undefined) throw new C120ContractError(`${replayId} has no outcome frame`);
  return {
    identity,
    replayId,
    replayInputId: inputId,
    input,
    mechanismLabel,
    conditionLabel,
    frames,
    outcome,
    cardLedger,
  };
}

export function resolveC120Replay(scenario: C120Scenario, value: unknown): C120AuthoritativeReplay {
  const parsedInput = parseC120ReplayInput(value);
  const scenarioIdentity = scenario.manifest.scenario;
  assertC120ScenarioIdentity(scenarioIdentity, undefined, 'resolver.scenario');
  const inputId = replayInputId(parsedInput);
  const candidates = inputCollection(scenario, parsedInput.surface);
  if (!Array.isArray(candidates)) throw new C120ContractError(`${parsedInput.surface} replay collection is missing`);
  const replay = candidates.find(candidate => (
    candidate.replayInputId === inputId
      && JSON.stringify(candidate.input) === JSON.stringify(parsedInput)
  ));
  if (replay === undefined) {
    throw new C120ContractError(`no authoritative replay exists for ${inputId}`);
  }
  assertC120Replay(replay, scenarioIdentity, parsedInput.surface, `resolver.${inputId}`);
  return replay;
}

export function resolveLabAReplay(scenario: C120Scenario, value: unknown): C120AuthoritativeReplay {
  const input = parseC120ReplayInput(value);
  if (input.surface !== 'lab-a') throw new C120ContractError('lab-a resolver received another surface');
  return resolveC120Replay(scenario, input);
}

export function resolveLabBReplay(scenario: C120Scenario, value: unknown): C120AuthoritativeReplay {
  const input = parseC120ReplayInput(value);
  if (input.surface !== 'lab-b') throw new C120ContractError('lab-b resolver received another surface');
  return resolveC120Replay(scenario, input);
}

export function resolveLabCReplay(scenario: C120Scenario, value: unknown): C120AuthoritativeReplay {
  const input = parseC120ReplayInput(value);
  if (input.surface !== 'lab-c') throw new C120ContractError('lab-c resolver received another surface');
  return resolveC120Replay(scenario, input);
}

export function resolveClinicReplay(scenario: C120Scenario, value: unknown): C120AuthoritativeReplay {
  const input = parseC120ReplayInput(value);
  if (input.surface !== 'clinic') throw new C120ContractError('clinic resolver received another surface');
  return resolveC120Replay(scenario, input);
}
