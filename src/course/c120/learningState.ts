import {
  C120_SEGMENTS,
  type C120AuthoritativeReplay,
  type C120ClinicActionId,
  type C120ConstructedResponseKey,
  type C120ConstructedResponses,
  type C120LabACandidateId,
  type C120LabBRuleId,
  type C120LabCAction,
  type C120LabCSlots,
  type C120Scenario,
  type C120SegmentId,
  type C120WorkbookReplayRecord,
} from './contract';

export type C120ClaimDisposition = 'accept' | 'qualify' | 'reject' | '';
export type C120Confidence = 'low' | 'medium' | 'high' | '';
export type C120Provenance = 'SOURCE' | 'MODEL-DERIVED' | 'COURSE-ASSUMPTION' | '';
export type C120BinaryPrediction = 'lower' | 'higher' | 'same' | '';
export type C120Verdict = 'supported' | 'revised' | '';
export type C120Availability = 'available' | 'leaky' | '';

export interface C120InteractionState {
  readonly claimJudgments: Readonly<Record<string, C120ClaimDisposition>>;
  readonly confidence: C120Confidence;
  readonly missionContractId: string;
  readonly claimEvidenceRevealed: boolean;
  readonly claimRejudgment: C120ClaimDisposition;
  readonly tleImportStage: 0 | 1 | 2 | 3;
  readonly tleImportValidated: boolean;
  readonly tleImportFileName: string;
  readonly tleImportRecordSha256: string;
  readonly tleProvenance: Readonly<Record<string, C120Provenance>>;
  readonly tleExcluded: readonly string[];
  readonly tleConfirmed: boolean;
  readonly tleTechnicalOpen: boolean;
  readonly tleWindowDecisionId: string;
  readonly labAReferenceSeen: boolean;
  readonly labAPrediction: C120BinaryPrediction;
  readonly labAServicePrediction: C120BinaryPrediction;
  readonly labABitJPrediction: C120BinaryPrediction;
  readonly labAActiveTimePrediction: C120BinaryPrediction;
  readonly labAPredictionConfidence: C120Confidence;
  readonly labAPredictionFrozen: boolean;
  readonly labAMechanismId: string;
  readonly labACandidateId: C120LabACandidateId | '';
  readonly labACandidateRunDone: boolean;
  readonly labAVerdict: C120Verdict;
  readonly labAFastBranchAnswer: string;
  readonly labBEntryAnswer: string;
  readonly labBPrediction: C120BinaryPrediction;
  readonly labBServicePrediction: C120BinaryPrediction;
  readonly labBActiveTimePrediction: C120BinaryPrediction;
  readonly labBEnergyPrediction: C120BinaryPrediction;
  readonly labBPredictionConfidence: C120Confidence;
  readonly labBPredictionFrozen: boolean;
  readonly labBRuleId: C120LabBRuleId | '';
  readonly labBThresholdId: string;
  readonly labBHoldCountId: string;
  readonly labBLowerThresholdId: string;
  readonly labBAlternateReviewed: boolean;
  readonly labBRuleFrozen: boolean;
  readonly labBVerdict: C120Verdict;
  readonly labBFastBranchAnswer: string;
  readonly recoveryRetrievalId: string;
  readonly recoveryCounterexampleId: string;
  readonly labCSlots: C120LabCSlots;
  readonly labCEntryAnswer: string;
  readonly labCBaselineSeen: boolean;
  readonly labCPrediction: C120BinaryPrediction;
  readonly labCServicePrediction: C120BinaryPrediction;
  readonly labCFreshnessPrediction: C120BinaryPrediction;
  readonly labCWakePrediction: C120BinaryPrediction;
  readonly labCActiveTimePrediction: C120BinaryPrediction;
  readonly labCBudgetPrediction: C120BinaryPrediction;
  readonly labCPredictionConfidence: C120Confidence;
  readonly labCPredictionFrozen: boolean;
  readonly labCFirstRunSlots: C120LabCSlots | null;
  readonly labCFirstRunDone: boolean;
  readonly labCRevisionApplied: boolean;
  readonly labCFastBranchAnswer: string;
  readonly clinicWorkedAnswer: string;
  readonly clinicAvailability: Readonly<Record<string, C120Availability>>;
  readonly clinicPrediction: string;
  readonly clinicPredictionConfidence: C120Confidence;
  readonly clinicActionId: C120ClinicActionId | '';
  readonly clinicActionFrozen: boolean;
  readonly clinicHintLevel: 0 | 1 | 2 | 3;
  readonly clinicFastBranchAnswer: string;
  readonly transferDomainId: string;
  readonly retrievalAnswerId: string;
  readonly retrievalPowerEnergyId: string;
  readonly retrievalDynamicPolicyId: string;
  readonly retrievalPredictionSavingId: string;
  readonly transferWhatIfId: string;
  readonly powerTimePathwayId: string;
}

const INTERACTION_KEYS = [
  'claimJudgments', 'confidence', 'missionContractId', 'claimEvidenceRevealed', 'claimRejudgment',
  'tleImportStage', 'tleImportValidated', 'tleImportFileName', 'tleImportRecordSha256',
  'tleProvenance', 'tleExcluded', 'tleConfirmed', 'tleTechnicalOpen', 'tleWindowDecisionId',
  'labAReferenceSeen', 'labAPrediction', 'labAServicePrediction', 'labABitJPrediction', 'labAActiveTimePrediction',
  'labAPredictionConfidence', 'labAPredictionFrozen', 'labAMechanismId',
  'labACandidateId', 'labACandidateRunDone', 'labAVerdict', 'labAFastBranchAnswer',
  'labBEntryAnswer', 'labBPrediction', 'labBServicePrediction', 'labBActiveTimePrediction', 'labBEnergyPrediction',
  'labBPredictionConfidence', 'labBPredictionFrozen', 'labBRuleId', 'labBThresholdId', 'labBHoldCountId',
  'labBLowerThresholdId', 'labBAlternateReviewed', 'labBRuleFrozen', 'labBVerdict', 'labBFastBranchAnswer',
  'recoveryRetrievalId', 'recoveryCounterexampleId',
  'labCSlots', 'labCEntryAnswer', 'labCBaselineSeen', 'labCPrediction', 'labCServicePrediction',
  'labCFreshnessPrediction', 'labCWakePrediction', 'labCActiveTimePrediction', 'labCBudgetPrediction',
  'labCPredictionConfidence', 'labCPredictionFrozen', 'labCFirstRunSlots', 'labCFirstRunDone', 'labCRevisionApplied', 'labCFastBranchAnswer',
  'clinicWorkedAnswer', 'clinicAvailability', 'clinicPrediction', 'clinicPredictionConfidence', 'clinicActionId', 'clinicActionFrozen',
  'clinicHintLevel', 'clinicFastBranchAnswer',
  'transferDomainId', 'retrievalAnswerId', 'retrievalPowerEnergyId', 'retrievalDynamicPolicyId',
  'retrievalPredictionSavingId', 'transferWhatIfId', 'powerTimePathwayId',
] as const;

const LAB_C_ACTIONS: readonly C120LabCAction[] = [
  'fixed-contact', 'fixed-outage', 'send-urgent', 'batch-periodic',
  'send-bulk', 'flush-batch', 'wait', 'sleep',
];

function interactionError(message: string): never {
  throw new Error(`C-120 learner-state violation: ${message}`);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    interactionError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  if (JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    interactionError(`${label} has unknown or missing fields`);
  }
}

function oneOf<T extends string>(value: unknown, choices: readonly T[], label: string): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) interactionError(`${label} is unsupported`);
  return value as T;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string') interactionError(`${label} must be text`);
  return value;
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') interactionError(`${label} must be boolean`);
  return value;
}

function boundedInteger(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    interactionError(`${label} must be an integer from ${min} to ${max}`);
  }
  return value;
}

export function createInitialC120InteractionState(): C120InteractionState {
  return {
    claimJudgments: { 'rate-is-energy': '', 'system-boundary': '', 'same-job': '' },
    confidence: '',
    missionContractId: '',
    claimEvidenceRevealed: false,
    claimRejudgment: '',
    tleImportStage: 0,
    tleImportValidated: false,
    tleImportFileName: '',
    tleImportRecordSha256: '',
    tleProvenance: {},
    tleExcluded: [],
    tleConfirmed: false,
    tleTechnicalOpen: false,
    tleWindowDecisionId: '',
    labAReferenceSeen: false,
    labAPrediction: '',
    labAServicePrediction: '',
    labABitJPrediction: '',
    labAActiveTimePrediction: '',
    labAPredictionConfidence: '',
    labAPredictionFrozen: false,
    labAMechanismId: '',
    labACandidateId: '',
    labACandidateRunDone: false,
    labAVerdict: '',
    labAFastBranchAnswer: '',
    labBEntryAnswer: '',
    labBPrediction: '',
    labBServicePrediction: '',
    labBActiveTimePrediction: '',
    labBEnergyPrediction: '',
    labBPredictionConfidence: '',
    labBPredictionFrozen: false,
    labBRuleId: '',
    labBThresholdId: '',
    labBHoldCountId: '',
    labBLowerThresholdId: '',
    labBAlternateReviewed: false,
    labBRuleFrozen: false,
    labBVerdict: '',
    labBFastBranchAnswer: '',
    recoveryRetrievalId: '',
    recoveryCounterexampleId: '',
    labCSlots: ['fixed-contact', 'wait', 'batch-periodic', 'fixed-outage', 'flush-batch', 'sleep'],
    labCEntryAnswer: '',
    labCBaselineSeen: false,
    labCPrediction: '',
    labCServicePrediction: '',
    labCFreshnessPrediction: '',
    labCWakePrediction: '',
    labCActiveTimePrediction: '',
    labCBudgetPrediction: '',
    labCPredictionConfidence: '',
    labCPredictionFrozen: false,
    labCFirstRunSlots: null,
    labCFirstRunDone: false,
    labCRevisionApplied: false,
    labCFastBranchAnswer: '',
    clinicWorkedAnswer: '',
    clinicAvailability: {},
    clinicPrediction: '',
    clinicPredictionConfidence: '',
    clinicActionId: '',
    clinicActionFrozen: false,
    clinicHintLevel: 0,
    clinicFastBranchAnswer: '',
    transferDomainId: '',
    retrievalAnswerId: '',
    retrievalPowerEnergyId: '',
    retrievalDynamicPolicyId: '',
    retrievalPredictionSavingId: '',
    transferWhatIfId: '',
    powerTimePathwayId: '',
  };
}

export function validateC120InteractionState(value: unknown): C120InteractionState {
  const candidate = record(value, 'interaction');
  exactKeys(candidate, INTERACTION_KEYS, 'interaction');
  const claims = record(candidate.claimJudgments, 'interaction.claimJudgments');
  exactKeys(claims, ['rate-is-energy', 'system-boundary', 'same-job'], 'interaction.claimJudgments');
  const provenance = record(candidate.tleProvenance, 'interaction.tleProvenance');
  const availability = record(candidate.clinicAvailability, 'interaction.clinicAvailability');
  if (!Array.isArray(candidate.tleExcluded) || candidate.tleExcluded.some(item => typeof item !== 'string')) {
    interactionError('interaction.tleExcluded must be a text array');
  }
  if (!Array.isArray(candidate.labCSlots) || candidate.labCSlots.length !== 6
    || candidate.labCSlots[0] !== 'fixed-contact' || candidate.labCSlots[3] !== 'fixed-outage'
    || candidate.labCSlots.some(action => !LAB_C_ACTIONS.includes(action as C120LabCAction))) {
    interactionError('interaction.labCSlots is not a six-slot C-120 schedule');
  }
  if (candidate.labCFirstRunSlots !== null && (
    !Array.isArray(candidate.labCFirstRunSlots) || candidate.labCFirstRunSlots.length !== 6
    || candidate.labCFirstRunSlots[0] !== 'fixed-contact' || candidate.labCFirstRunSlots[3] !== 'fixed-outage'
    || candidate.labCFirstRunSlots.some(action => !LAB_C_ACTIONS.includes(action as C120LabCAction))
  )) interactionError('interaction.labCFirstRunSlots is not a six-slot C-120 schedule');
  for (const [key, raw] of Object.entries(provenance)) {
    oneOf(raw, ['', 'SOURCE', 'MODEL-DERIVED', 'COURSE-ASSUMPTION'] as const, `interaction.tleProvenance.${key}`);
  }
  for (const [key, raw] of Object.entries(availability)) {
    oneOf(raw, ['', 'available', 'leaky'] as const, `interaction.clinicAvailability.${key}`);
  }
  if (candidate.claimEvidenceRevealed === true && (
    candidate.missionContractId === '' || candidate.confidence === ''
    || Object.values(claims).some(value => value === '')
  )) interactionError('revealed claim evidence requires frozen classifications, confidence, and mission contract');
  if (candidate.labAPredictionFrozen === true && (
    candidate.labACandidateId === '' || candidate.labAMechanismId === '' || candidate.labAPredictionConfidence === ''
    || [candidate.labAPrediction, candidate.labAServicePrediction, candidate.labABitJPrediction, candidate.labAActiveTimePrediction].includes('')
  )) interactionError('frozen Lab A prediction is incomplete');
  if (candidate.labACandidateRunDone === true && candidate.labAPredictionFrozen !== true) {
    interactionError('Lab A candidate run requires a frozen prediction');
  }
  if (candidate.labBPredictionFrozen !== candidate.labBRuleFrozen) {
    interactionError('Lab B prediction and rule must freeze together');
  }
  if (candidate.labBRuleFrozen === true && (
    candidate.labBEntryAnswer === '' || candidate.labBAlternateReviewed !== true
    || candidate.labBPredictionConfidence === '' || candidate.labBRuleId === ''
    || candidate.labBRuleId !== deriveC120LabBRuleId(
      String(candidate.labBThresholdId), String(candidate.labBHoldCountId), String(candidate.labBLowerThresholdId),
    )
    || [candidate.labBPrediction, candidate.labBServicePrediction, candidate.labBActiveTimePrediction, candidate.labBEnergyPrediction].includes('')
  )) interactionError('frozen Lab B prediction and executable rule are incomplete');
  if (candidate.labCPredictionFrozen === true && (
    candidate.labCEntryAnswer !== 'slot 2' || candidate.labCPredictionConfidence === ''
    || [candidate.labCPrediction, candidate.labCServicePrediction, candidate.labCFreshnessPrediction,
      candidate.labCWakePrediction, candidate.labCActiveTimePrediction, candidate.labCBudgetPrediction].includes('')
  )) interactionError('frozen Lab C prediction is incomplete');
  if (candidate.labCBaselineSeen === true && candidate.labCPredictionFrozen !== true) {
    interactionError('Lab C baseline result requires a frozen prediction');
  }
  if (candidate.labCFirstRunDone === true && (
    candidate.labCPredictionFrozen !== true || candidate.labCBaselineSeen !== true || candidate.labCFirstRunSlots === null
  )) interactionError('Lab C first run requires a frozen prediction, revealed baseline, and frozen schedule snapshot');
  if (candidate.labCRevisionApplied === true && (
    candidate.labCFirstRunDone !== true || candidate.labCFirstRunSlots === null
    || JSON.stringify(candidate.labCFirstRunSlots) === JSON.stringify(candidate.labCSlots)
  )) interactionError('Lab C revision must be one changed schedule after the first run');
  if (candidate.clinicActionFrozen === true && (
    candidate.clinicPrediction === '' || candidate.clinicPredictionConfidence === '' || candidate.clinicActionId === ''
  )) interactionError('frozen clinic decision is incomplete');
  const binary = ['', 'lower', 'higher', 'same'] as const;
  return {
    claimJudgments: Object.fromEntries(Object.entries(claims).map(([key, raw]) => [key, oneOf(raw, ['', 'accept', 'qualify', 'reject'] as const, `interaction.claimJudgments.${key}`)])),
    confidence: oneOf(candidate.confidence, ['', 'low', 'medium', 'high'] as const, 'interaction.confidence'),
    missionContractId: text(candidate.missionContractId, 'interaction.missionContractId'),
    claimEvidenceRevealed: bool(candidate.claimEvidenceRevealed, 'interaction.claimEvidenceRevealed'),
    claimRejudgment: oneOf(candidate.claimRejudgment, ['', 'accept', 'qualify', 'reject'] as const, 'interaction.claimRejudgment'),
    tleImportStage: boundedInteger(candidate.tleImportStage, 0, 3, 'interaction.tleImportStage') as 0 | 1 | 2 | 3,
    tleImportValidated: bool(candidate.tleImportValidated, 'interaction.tleImportValidated'),
    tleImportFileName: text(candidate.tleImportFileName, 'interaction.tleImportFileName'),
    tleImportRecordSha256: text(candidate.tleImportRecordSha256, 'interaction.tleImportRecordSha256'),
    tleProvenance: provenance as Readonly<Record<string, C120Provenance>>,
    tleExcluded: [...candidate.tleExcluded] as string[],
    tleConfirmed: bool(candidate.tleConfirmed, 'interaction.tleConfirmed'),
    tleTechnicalOpen: bool(candidate.tleTechnicalOpen, 'interaction.tleTechnicalOpen'),
    tleWindowDecisionId: text(candidate.tleWindowDecisionId, 'interaction.tleWindowDecisionId'),
    labAReferenceSeen: bool(candidate.labAReferenceSeen, 'interaction.labAReferenceSeen'),
    labAPrediction: oneOf(candidate.labAPrediction, binary, 'interaction.labAPrediction'),
    labAServicePrediction: oneOf(candidate.labAServicePrediction, binary, 'interaction.labAServicePrediction'),
    labABitJPrediction: oneOf(candidate.labABitJPrediction, binary, 'interaction.labABitJPrediction'),
    labAActiveTimePrediction: oneOf(candidate.labAActiveTimePrediction, binary, 'interaction.labAActiveTimePrediction'),
    labAPredictionConfidence: oneOf(candidate.labAPredictionConfidence, ['', 'low', 'medium', 'high'] as const, 'interaction.labAPredictionConfidence'),
    labAPredictionFrozen: bool(candidate.labAPredictionFrozen, 'interaction.labAPredictionFrozen'),
    labAMechanismId: text(candidate.labAMechanismId, 'interaction.labAMechanismId'),
    labACandidateId: oneOf(candidate.labACandidateId, ['', 'pace', 'balanced', 'burst-to-sleep'] as const, 'interaction.labACandidateId'),
    labACandidateRunDone: bool(candidate.labACandidateRunDone, 'interaction.labACandidateRunDone'),
    labAVerdict: oneOf(candidate.labAVerdict, ['', 'supported', 'revised'] as const, 'interaction.labAVerdict'),
    labAFastBranchAnswer: text(candidate.labAFastBranchAnswer, 'interaction.labAFastBranchAnswer'),
    labBEntryAnswer: text(candidate.labBEntryAnswer, 'interaction.labBEntryAnswer'),
    labBPrediction: oneOf(candidate.labBPrediction, binary, 'interaction.labBPrediction'),
    labBServicePrediction: oneOf(candidate.labBServicePrediction, binary, 'interaction.labBServicePrediction'),
    labBActiveTimePrediction: oneOf(candidate.labBActiveTimePrediction, binary, 'interaction.labBActiveTimePrediction'),
    labBEnergyPrediction: oneOf(candidate.labBEnergyPrediction, binary, 'interaction.labBEnergyPrediction'),
    labBPredictionConfidence: oneOf(candidate.labBPredictionConfidence, ['', 'low', 'medium', 'high'] as const, 'interaction.labBPredictionConfidence'),
    labBPredictionFrozen: bool(candidate.labBPredictionFrozen, 'interaction.labBPredictionFrozen'),
    labBRuleId: oneOf(candidate.labBRuleId, ['', 'switch-now', 'stable-two', 'hysteresis'] as const, 'interaction.labBRuleId'),
    labBThresholdId: text(candidate.labBThresholdId, 'interaction.labBThresholdId'),
    labBHoldCountId: text(candidate.labBHoldCountId, 'interaction.labBHoldCountId'),
    labBLowerThresholdId: text(candidate.labBLowerThresholdId, 'interaction.labBLowerThresholdId'),
    labBAlternateReviewed: bool(candidate.labBAlternateReviewed, 'interaction.labBAlternateReviewed'),
    labBRuleFrozen: bool(candidate.labBRuleFrozen, 'interaction.labBRuleFrozen'),
    labBVerdict: oneOf(candidate.labBVerdict, ['', 'supported', 'revised'] as const, 'interaction.labBVerdict'),
    labBFastBranchAnswer: text(candidate.labBFastBranchAnswer, 'interaction.labBFastBranchAnswer'),
    recoveryRetrievalId: text(candidate.recoveryRetrievalId, 'interaction.recoveryRetrievalId'),
    recoveryCounterexampleId: text(candidate.recoveryCounterexampleId, 'interaction.recoveryCounterexampleId'),
    labCSlots: [...candidate.labCSlots] as unknown as C120LabCSlots,
    labCEntryAnswer: text(candidate.labCEntryAnswer, 'interaction.labCEntryAnswer'),
    labCBaselineSeen: bool(candidate.labCBaselineSeen, 'interaction.labCBaselineSeen'),
    labCPrediction: oneOf(candidate.labCPrediction, binary, 'interaction.labCPrediction'),
    labCServicePrediction: oneOf(candidate.labCServicePrediction, binary, 'interaction.labCServicePrediction'),
    labCFreshnessPrediction: oneOf(candidate.labCFreshnessPrediction, binary, 'interaction.labCFreshnessPrediction'),
    labCWakePrediction: oneOf(candidate.labCWakePrediction, binary, 'interaction.labCWakePrediction'),
    labCActiveTimePrediction: oneOf(candidate.labCActiveTimePrediction, binary, 'interaction.labCActiveTimePrediction'),
    labCBudgetPrediction: oneOf(candidate.labCBudgetPrediction, binary, 'interaction.labCBudgetPrediction'),
    labCPredictionConfidence: oneOf(candidate.labCPredictionConfidence, ['', 'low', 'medium', 'high'] as const, 'interaction.labCPredictionConfidence'),
    labCPredictionFrozen: bool(candidate.labCPredictionFrozen, 'interaction.labCPredictionFrozen'),
    labCFirstRunSlots: candidate.labCFirstRunSlots === null ? null : [...candidate.labCFirstRunSlots] as unknown as C120LabCSlots,
    labCFirstRunDone: bool(candidate.labCFirstRunDone, 'interaction.labCFirstRunDone'),
    labCRevisionApplied: bool(candidate.labCRevisionApplied, 'interaction.labCRevisionApplied'),
    labCFastBranchAnswer: text(candidate.labCFastBranchAnswer, 'interaction.labCFastBranchAnswer'),
    clinicWorkedAnswer: text(candidate.clinicWorkedAnswer, 'interaction.clinicWorkedAnswer'),
    clinicAvailability: availability as Readonly<Record<string, C120Availability>>,
    clinicPrediction: text(candidate.clinicPrediction, 'interaction.clinicPrediction'),
    clinicPredictionConfidence: oneOf(candidate.clinicPredictionConfidence, ['', 'low', 'medium', 'high'] as const, 'interaction.clinicPredictionConfidence'),
    clinicActionId: oneOf(candidate.clinicActionId, ['', 'protect-service', 'chase-score'] as const, 'interaction.clinicActionId'),
    clinicActionFrozen: bool(candidate.clinicActionFrozen, 'interaction.clinicActionFrozen'),
    clinicHintLevel: boundedInteger(candidate.clinicHintLevel, 0, 3, 'interaction.clinicHintLevel') as 0 | 1 | 2 | 3,
    clinicFastBranchAnswer: text(candidate.clinicFastBranchAnswer, 'interaction.clinicFastBranchAnswer'),
    transferDomainId: text(candidate.transferDomainId, 'interaction.transferDomainId'),
    retrievalAnswerId: text(candidate.retrievalAnswerId, 'interaction.retrievalAnswerId'),
    retrievalPowerEnergyId: text(candidate.retrievalPowerEnergyId, 'interaction.retrievalPowerEnergyId'),
    retrievalDynamicPolicyId: text(candidate.retrievalDynamicPolicyId, 'interaction.retrievalDynamicPolicyId'),
    retrievalPredictionSavingId: text(candidate.retrievalPredictionSavingId, 'interaction.retrievalPredictionSavingId'),
    transferWhatIfId: text(candidate.transferWhatIfId, 'interaction.transferWhatIfId'),
    powerTimePathwayId: text(candidate.powerTimePathwayId, 'interaction.powerTimePathwayId'),
  };
}

function transitionSame(
  previous: C120InteractionState,
  next: C120InteractionState,
  fields: readonly (keyof C120InteractionState)[],
  label: string,
): void {
  const changed = fields.find(field => JSON.stringify(previous[field]) !== JSON.stringify(next[field]));
  if (changed !== undefined) interactionError(`${label} cannot rewrite frozen ${String(changed)}`);
}

/**
 * Validate one learner interaction transition, including the invariants that a
 * standalone restored state cannot prove. This is UI-independent: disabled
 * controls are a convenience, while this guard is the authoritative lock.
 */
export function validateC120InteractionTransition(
  previousValue: unknown,
  nextValue: unknown,
): C120InteractionState {
  const previous = validateC120InteractionState(previousValue);
  const next = validateC120InteractionState(nextValue);

  if (previous.claimEvidenceRevealed) {
    if (!next.claimEvidenceRevealed) interactionError('claim evidence reveal cannot be undone');
    transitionSame(previous, next, ['claimJudgments', 'confidence', 'missionContractId'], 'claim evidence lock');
  }
  if (!previous.claimEvidenceRevealed && next.claimEvidenceRevealed) {
    if (next.missionContractId === '' || next.missionContractId !== previous.missionContractId) {
      interactionError('claim evidence reveal must freeze the previously selected mission contract');
    }
  }

  const labAFrozenFields: readonly (keyof C120InteractionState)[] = [
    'labAPrediction', 'labAServicePrediction', 'labABitJPrediction', 'labAActiveTimePrediction',
    'labAPredictionConfidence', 'labAMechanismId', 'labACandidateId',
  ];
  if (previous.labAPredictionFrozen) {
    if (!next.labAPredictionFrozen) interactionError('Lab A prediction freeze cannot be undone');
    transitionSame(previous, next, labAFrozenFields, 'Lab A prediction lock');
  }
  if (!previous.labAPredictionFrozen && next.labAPredictionFrozen) {
    if (next.labACandidateId === '' || next.labAMechanismId === '' || next.labAPredictionConfidence === ''
      || [next.labAPrediction, next.labAServicePrediction, next.labABitJPrediction, next.labAActiveTimePrediction].includes('')) {
      interactionError('Lab A prediction cannot freeze with missing axes, confidence, candidate, or mechanism');
    }
  }
  if (previous.labACandidateRunDone && !next.labACandidateRunDone) {
    interactionError('Lab A candidate run cannot be undone');
  }
  if (!previous.labACandidateRunDone && next.labACandidateRunDone && !next.labAPredictionFrozen) {
    interactionError('Lab A candidate run requires a frozen prediction');
  }

  const labBFrozenFields: readonly (keyof C120InteractionState)[] = [
    'labBPrediction', 'labBServicePrediction', 'labBActiveTimePrediction', 'labBEnergyPrediction',
    'labBPredictionConfidence', 'labBRuleId', 'labBThresholdId', 'labBHoldCountId', 'labBLowerThresholdId',
  ];
  if (previous.labBPredictionFrozen || previous.labBRuleFrozen) {
    if (!next.labBPredictionFrozen || !next.labBRuleFrozen) interactionError('Lab B prediction and rule freeze cannot be undone');
    transitionSame(previous, next, [...labBFrozenFields, 'labBEntryAnswer', 'labBAlternateReviewed'], 'Lab B prediction/rule lock');
  }
  if ((!previous.labBPredictionFrozen && next.labBPredictionFrozen)
    || (!previous.labBRuleFrozen && next.labBRuleFrozen)) {
    if (!next.labBPredictionFrozen || !next.labBRuleFrozen || next.labBPredictionConfidence === ''
      || next.labBEntryAnswer === '' || !next.labBAlternateReviewed
      || next.labBRuleId === '' || next.labBRuleId !== deriveC120LabBRuleId(next.labBThresholdId, next.labBHoldCountId, next.labBLowerThresholdId)
      || [next.labBPrediction, next.labBServicePrediction, next.labBActiveTimePrediction, next.labBEnergyPrediction].includes('')) {
      interactionError('Lab B prediction and exact executable rule must freeze together and be complete');
    }
  }

  const labCPredictionFields: readonly (keyof C120InteractionState)[] = [
    'labCPrediction', 'labCServicePrediction', 'labCFreshnessPrediction', 'labCWakePrediction',
    'labCActiveTimePrediction', 'labCBudgetPrediction', 'labCPredictionConfidence',
  ];
  if (previous.labCPredictionFrozen) {
    if (!next.labCPredictionFrozen) interactionError('Lab C prediction freeze cannot be undone');
    transitionSame(previous, next, labCPredictionFields, 'Lab C prediction lock');
  }
  if (!previous.labCPredictionFrozen && next.labCPredictionFrozen) {
    if (next.labCEntryAnswer !== 'slot 2' || next.labCPredictionConfidence === ''
      || [next.labCPrediction, next.labCServicePrediction, next.labCFreshnessPrediction, next.labCWakePrediction,
        next.labCActiveTimePrediction, next.labCBudgetPrediction].includes('')) {
      interactionError('Lab C prediction cannot freeze before the entry check and every prediction axis are complete');
    }
  }
  if (!previous.labCBaselineSeen && next.labCBaselineSeen && !previous.labCPredictionFrozen) {
    interactionError('Lab C baseline cannot be revealed before prediction freeze');
  }
  if (previous.labCPredictionFrozen && !previous.labCFirstRunDone && !next.labCFirstRunDone) {
    transitionSame(previous, next, ['labCSlots'], 'Lab C frozen first-run schedule');
  }
  if (previous.labCFirstRunDone) {
    if (!next.labCFirstRunDone) interactionError('Lab C first run cannot be undone');
    transitionSame(previous, next, ['labCFirstRunSlots'], 'Lab C first-run lock');
  } else if (next.labCFirstRunDone) {
    if (!previous.labCPredictionFrozen || !previous.labCBaselineSeen || next.labCFirstRunSlots === null
      || JSON.stringify(next.labCFirstRunSlots) !== JSON.stringify(previous.labCSlots)
      || JSON.stringify(next.labCSlots) !== JSON.stringify(previous.labCSlots)) {
      interactionError('Lab C first run must follow the frozen baseline prediction and snapshot the six-slot schedule');
    }
  }
  if (previous.labCRevisionApplied) {
    if (!next.labCRevisionApplied) interactionError('Lab C single revision cannot be undone');
    transitionSame(previous, next, ['labCSlots'], 'Lab C revision lock');
  } else if (next.labCRevisionApplied) {
    if (!previous.labCFirstRunDone || previous.labCFirstRunSlots === null
      || JSON.stringify(next.labCSlots) === JSON.stringify(previous.labCFirstRunSlots)) {
      interactionError('Lab C revision must follow the first run and change the schedule');
    }
  }

  const clinicFrozenFields: readonly (keyof C120InteractionState)[] = [
    'clinicAvailability', 'clinicPrediction', 'clinicPredictionConfidence', 'clinicActionId',
  ];
  if (previous.clinicActionFrozen) {
    if (!next.clinicActionFrozen) interactionError('clinic feature/action freeze cannot be undone');
    transitionSame(previous, next, clinicFrozenFields, 'clinic feature/action lock');
  }
  if (!previous.clinicActionFrozen && next.clinicActionFrozen
    && (next.clinicPrediction === '' || next.clinicPredictionConfidence === '' || next.clinicActionId === '')) {
    interactionError('clinic feature boundary, prediction, confidence, and action must freeze together');
  }

  return next;
}

export function deriveC120LabBRuleId(
  thresholdId: string,
  holdCountId: string,
  lowerThresholdId: string,
): C120LabBRuleId | '' {
  if (thresholdId === 'threshold-low' && holdCountId === 'one-step' && lowerThresholdId === 'lower-same') return 'switch-now';
  if (thresholdId === 'threshold-steady' && holdCountId === 'two-steps' && lowerThresholdId === 'lower-one-band') return 'stable-two';
  if (thresholdId === 'threshold-high' && holdCountId === 'two-steps' && lowerThresholdId === 'lower-two-bands') return 'hysteresis';
  return '';
}

export interface C120SegmentValidationContext {
  readonly segment: C120SegmentId;
  readonly state: C120InteractionState;
  readonly scenario: C120Scenario;
  readonly responses: C120ConstructedResponses;
  readonly activeReplay: C120AuthoritativeReplay | null;
  readonly replayRecords: readonly C120WorkbookReplayRecord[];
  readonly checkpointOrdinal: number;
}

export interface C120ValidationIssue {
  readonly fieldId: string;
  readonly message: string;
  readonly code: string;
}

export interface C120ResponseAssessment {
  readonly ready: boolean;
  readonly reason: 'ready' | 'empty' | 'too-short' | 'placeholder' | 'causal-marker-missing' | 'evidence-marker-missing';
}

const CAUSAL_MARKER = /\b(because|therefore|so|causes?|caused|changes?|changed|changing|makes?|made|leads?|led|while|although|preserving|results?)\b|因為|所以|因此|導致|造成|使得|改變|同時|儘管|雖然/iu;
const COUNTERFACTUAL_MARKER = /\b(if|when|would|fails?|failed|misses?|missed|reverses?|revised?|abandon)\b|如果|若|當|失敗|未達|反轉|放棄|修正/iu;
const EVIDENCE_MARKER = /\b(service|boundary|deadline|replay|state|active|idle|power|energy|freshness|wake|switch|score|available|time|w|j|bits?|bit\/j)\b|服務|邊界|期限|重播|狀態|主動|閒置|功率|能量|焦耳|新鮮度|喚醒|切換|分數|可用|時間/iu;

export function assessC120ConstructedResponse(
  responses: C120ConstructedResponses,
  key: C120ConstructedResponseKey,
): C120ResponseAssessment {
  const value = (responses[key] ?? '').trim();
  if (value === '') return { ready: false, reason: 'empty' };
  if (value.length < 18) return { ready: false, reason: 'too-short' };
  if (/_{2,}|\[\s*\]|<blank>/iu.test(value)) return { ready: false, reason: 'placeholder' };
  const hasCausalMarker = key === 'falsifier'
    ? COUNTERFACTUAL_MARKER.test(value)
    : CAUSAL_MARKER.test(value) || COUNTERFACTUAL_MARKER.test(value);
  if (!hasCausalMarker) return { ready: false, reason: 'causal-marker-missing' };
  if (!EVIDENCE_MARKER.test(value)) return { ready: false, reason: 'evidence-marker-missing' };
  return { ready: true, reason: 'ready' };
}

function responseReady(responses: C120ConstructedResponses, key: C120ConstructedResponseKey): boolean {
  return assessC120ConstructedResponse(responses, key).ready;
}

export function validateC120SegmentEvidence(context: C120SegmentValidationContext): C120ValidationIssue | null {
  const { segment, state, scenario, responses, activeReplay, replayRecords, checkpointOrdinal } = context;
  const issue = (fieldId: string, message: string, code: string): C120ValidationIssue => ({ fieldId, message, code });
  if (segment === 'claim-detective') {
    const missingClaim = ['rate-is-energy', 'system-boundary', 'same-job'].find(id => state.claimJudgments[id] === '');
    if (missingClaim) return issue(`c120-claim-${missingClaim}`, 'Classify all three claims before continuing.', 'claim-classification-missing');
    if (state.missionContractId === '') return issue('c120-mission-contract', 'Choose one mission contract so later comparisons share a boundary.', 'mission-contract-missing');
    if (scenario.missionContracts.find(item => item.id === state.missionContractId)?.comparisonStatus !== 'COMPARABLE') {
      return issue('c120-mission-contract', 'This choice is intentionally incomparable. Choose the fixed job, deadline, and system boundary.', 'mission-contract-incomparable');
    }
    if (state.confidence === '') return issue('c120-claim-confidence', 'Record your first confidence level.', 'claim-confidence-missing');
    if (!state.claimEvidenceRevealed) return issue('c120-claim-reveal', 'Reveal the two-slot evidence before making one re-judgment.', 'claim-evidence-hidden');
    if (state.claimRejudgment === '') return issue('c120-claim-rejudgment', 'Make one evidence-based re-judgment after the reveal.', 'claim-rejudgment-missing');
    if (!responseReady(responses, 'openingClause')) return issue('c120-response-openingClause', 'Complete the opening clause with a causal connector and an evidence, boundary, or unit term.', 'opening-clause-missing');
    return null;
  }
  if (segment === 'tle-anchor') {
    if (!state.tleImportValidated || state.tleImportRecordSha256 !== scenario.tle.recordSha256) {
      return issue('c120-tle-file', 'Import and validate the pinned offline TLE record for this scenario.', 'tle-file-not-validated');
    }
    if (state.tleImportStage < 3) return issue('c120-tle-import', 'Complete all three pinned offline TLE import stages.', 'tle-import-incomplete');
    const missingLineage = scenario.tle.lineage.find(item => state.tleProvenance[String(item.order)] !== item.provenance);
    if (missingLineage) return issue(`c120-tle-lineage-${missingLineage.order}`, `Recheck the provenance for “${missingLineage.label}”.`, 'tle-lineage-incorrect');
    if (!scenario.tle.tleDoesNotContain.every(item => state.tleExcluded.includes(item))) {
      return issue('c120-tle-exclusions', 'Select every quantity that is not contained in a TLE.', 'tle-exclusions-incomplete');
    }
    if (!state.tleConfirmed) return issue('c120-tle-confirm', 'Confirm where the simulated energy values come from.', 'tle-confirmation-missing');
    if (state.tleWindowDecisionId !== 'send-inside-window') return issue('c120-tle-window-decision', 'Choose the interval inside the model-derived service window.', 'tle-window-decision-missing');
    return null;
  }
  if (segment === 'lab-a') {
    if (!state.labAReferenceSeen) return issue('c120-lab-a-reference', 'Run or reveal the reference example first.', 'lab-a-reference-missing');
    if ([state.labAPrediction, state.labAServicePrediction, state.labABitJPrediction, state.labAActiveTimePrediction].includes('')
      || state.labAPredictionConfidence === '') {
      return issue('c120-lab-a-prediction', 'Predict active time, consumed J, service, bit/J, and confidence before replay.', 'lab-a-prediction-missing');
    }
    if (!state.labAPredictionFrozen) return issue('c120-lab-a-freeze', 'Freeze the candidate prediction before replay.', 'lab-a-prediction-not-frozen');
    if (state.labAMechanismId === '') return issue('c120-lab-a-mechanism', 'Choose the mechanism you expect to dominate.', 'lab-a-mechanism-missing');
    if (state.labACandidateId === '') return issue('c120-lab-a-candidate', 'Choose a pacing candidate.', 'lab-a-candidate-missing');
    if (!state.labACandidateRunDone) {
      return issue('c120-lab-a-run', 'Run the currently selected candidate to create authoritative evidence.', 'lab-a-replay-missing');
    }
    if (!replayRecords.some(record => record.input.surface === 'lab-a' && record.input.hiddenConditionId === 'high-idle-cost'
      && record.input.candidateId === state.labACandidateId && record.input.missionContractId === state.missionContractId)) {
      return issue('c120-lab-a-run', 'Keep the candidate replay in the authoritative trial ledger.', 'lab-a-ledger-missing');
    }
    if (state.labAVerdict === '') return issue('c120-lab-a-verdict', 'Mark whether the replay supported or revised your prediction.', 'lab-a-verdict-missing');
    if (!responseReady(responses, 'labAClause')) return issue('c120-response-labAClause', 'Complete the Lab A clause with a causal connector and an evidence, boundary, or unit term.', 'lab-a-clause-missing');
    return null;
  }
  if (segment === 'lab-b') {
    if (state.labBEntryAnswer !== 'wait') return issue('c120-lab-b-entry', 'Recheck the worked Trace A next-state decision.', 'lab-b-entry-incorrect');
    if ([state.labBPrediction, state.labBServicePrediction, state.labBActiveTimePrediction, state.labBEnergyPrediction].includes('')
      || state.labBPredictionConfidence === '') {
      return issue('c120-lab-b-prediction', 'Predict service, active time, consumed J, switching, and confidence.', 'lab-b-prediction-missing');
    }
    if (!state.labBPredictionFrozen) return issue('c120-lab-b-prediction-freeze', 'Freeze the Trace B prediction before the rule replay.', 'lab-b-prediction-not-frozen');
    if (state.labBRuleId === '' || state.labBThresholdId === '' || state.labBHoldCountId === '' || state.labBLowerThresholdId === '') {
      return issue('c120-lab-b-rule', 'Complete all executable rule blocks before freezing.', 'lab-b-rule-incomplete');
    }
    if (state.labBRuleId !== deriveC120LabBRuleId(state.labBThresholdId, state.labBHoldCountId, state.labBLowerThresholdId)) {
      return issue('c120-lab-b-rule', 'The provider rule ID must be derived from the visible threshold, N, and lower-threshold blocks.', 'lab-b-rule-mismatch');
    }
    if (!state.labBAlternateReviewed) return issue('c120-lab-b-alternate', 'Review the one permitted Trace A rewind/alternate.', 'lab-b-alternate-missing');
    if (!state.labBRuleFrozen) return issue('c120-lab-b-freeze', 'Freeze the completed rule before opening Trace B.', 'lab-b-rule-not-frozen');
    if (!replayRecords.some(record => record.input.surface === 'lab-b' && record.input.frozenRuleId === state.labBRuleId
      && record.input.thresholdId === state.labBThresholdId && record.input.holdCountId === state.labBHoldCountId
      && record.input.lowerThresholdId === state.labBLowerThresholdId && record.input.missionContractId === state.missionContractId)) {
      return issue('c120-lab-b-run', 'Run withheld Trace B with the frozen rule.', 'lab-b-replay-missing');
    }
    if (state.labBVerdict === '') return issue('c120-lab-b-verdict', 'Judge the frozen rule against the withheld trace.', 'lab-b-verdict-missing');
    if (!responseReady(responses, 'labBClause')) return issue('c120-response-labBClause', 'Complete the Lab B clause with a causal connector and an evidence, boundary, or unit term.', 'lab-b-clause-missing');
    return null;
  }
  if (segment === 'recovery') {
    if (checkpointOrdinal < 1) return issue('c120-save-checkpoint', 'Save a recoverable checkpoint first.', 'checkpoint-missing');
    if (state.recoveryRetrievalId !== 'state-time-power') return issue('c120-recovery-retrieval', 'Retrieve the full state → time → power → J chain.', 'recovery-retrieval-incorrect');
    if (state.recoveryCounterexampleId !== 'boundary-can-reverse') return issue('c120-recovery-counterexample', 'Recognize that a changed boundary can reverse the comparison.', 'recovery-counterexample-incorrect');
    if (!responseReady(responses, 'recoveryClause')) return issue('c120-response-recoveryClause', 'Complete the recovery clause with a causal connector and an evidence, boundary, or unit term.', 'recovery-clause-missing');
    return null;
  }
  if (segment === 'lab-c') {
    if (state.labCEntryAnswer !== 'slot 2') return issue('c120-lab-c-entry', 'Use the worked card timing to choose its legal slot.', 'lab-c-entry-incorrect');
    if (!state.labCBaselineSeen) return issue('c120-lab-c-baseline', 'Review the completed one-card example and baseline ledger.', 'lab-c-baseline-missing');
    if ([state.labCPrediction, state.labCServicePrediction, state.labCFreshnessPrediction, state.labCWakePrediction,
      state.labCActiveTimePrediction, state.labCBudgetPrediction].includes('') || state.labCPredictionConfidence === '') {
      return issue('c120-lab-c-prediction', 'Predict service, freshness, wakes, active time, consumed J, budget, and confidence.', 'lab-c-prediction-missing');
    }
    if (!state.labCPredictionFrozen) return issue('c120-lab-c-prediction-freeze', 'Freeze the schedule prediction before its first run.', 'lab-c-prediction-not-frozen');
    if (!state.labCFirstRunDone) return issue('c120-lab-c-run', 'Run the six-slot schedule once before revising it.', 'lab-c-first-run-missing');
    if (state.labCFirstRunSlots === null || JSON.stringify(state.labCFirstRunSlots) === JSON.stringify(state.labCSlots)) {
      return issue('c120-lab-c-revise', 'Make exactly one visible schedule change after the first run.', 'lab-c-revision-not-consequential');
    }
    if (!state.labCRevisionApplied) {
      return issue('c120-lab-c-revise', 'Apply the single revision and run the surprise event.', 'lab-c-revision-missing');
    }
    if (!replayRecords.some(record => record.input.surface === 'lab-c' && record.input.revisionOrdinal === 0
      && state.labCFirstRunSlots !== null && JSON.stringify(record.input.slots) === JSON.stringify(state.labCFirstRunSlots)
      && record.input.missionContractId === state.missionContractId)
      || !replayRecords.some(record => record.input.surface === 'lab-c' && record.input.revisionOrdinal === 1
        && JSON.stringify(record.input.slots) === JSON.stringify(state.labCSlots)
        && record.input.missionContractId === state.missionContractId)) {
      return issue('c120-lab-c-revise', 'Keep both first-run and revision evidence in the trial ledger.', 'lab-c-ledger-incomplete');
    }
    if (!responseReady(responses, 'labCClause')) return issue('c120-response-labCClause', 'Complete the Lab C clause with a causal connector and an evidence, boundary, or unit term.', 'lab-c-clause-missing');
    return null;
  }
  if (segment === 'clinic') {
    if (state.clinicWorkedAnswer !== 'available') return issue('c120-clinic-worked', 'Use the timestamp to decide whether the worked feature existed at decision time.', 'clinic-worked-incorrect');
    const misclassified = scenario.clinic.featureCards.find(card => state.clinicAvailability[card.id] !== (card.availableAtDecisionTime ? 'available' : 'leaky'));
    if (misclassified) return issue(`c120-clinic-card-${misclassified.id}`, 'Recheck this card against the decision timestamp; names alone are not evidence.', 'clinic-card-incorrect');
    if (state.clinicPrediction === '') return issue('c120-clinic-prediction', 'Predict which action protects the operational gate before replay.', 'clinic-prediction-missing');
    if (state.clinicPredictionConfidence === '') return issue('c120-clinic-prediction', 'Record confidence before freezing the clinic decision.', 'clinic-confidence-missing');
    if (!state.clinicActionFrozen || state.clinicActionId === '') return issue('c120-clinic-freeze', 'Choose and freeze one legal action.', 'clinic-action-not-frozen');
    if (!replayRecords.some(record => record.input.surface === 'clinic' && record.input.actionId === state.clinicActionId
      && record.input.featureSetId === 'decision-time-only' && record.input.missionContractId === state.missionContractId)) {
      return issue('c120-clinic-run', 'Run the frozen action on the chronological replay.', 'clinic-replay-missing');
    }
    if (!responseReady(responses, 'clinicClause')) return issue('c120-response-clinicClause', 'Complete the clinic clause with a causal connector and an evidence, boundary, or unit term.', 'clinic-clause-missing');
    return null;
  }
  if (state.transferDomainId === '') return issue('c120-transfer-domain', 'Choose one unseen transfer domain.', 'transfer-domain-missing');
  if (state.retrievalAnswerId !== 'same-boundary') return issue('c120-transfer-retrieval', 'Retrieve the same job, deadline, and system-boundary gate.', 'transfer-retrieval-incorrect');
  if (state.retrievalPowerEnergyId !== 'read-both') return issue('c120-transfer-retrieval-power', 'Keep low W separate from low consumed J under one service boundary.', 'transfer-power-energy-incorrect');
  if (state.retrievalDynamicPolicyId !== 'state-changes-action') return issue('c120-transfer-retrieval-dynamic', 'A dynamic policy changes the action from decision-time state, not from animation.', 'transfer-dynamic-incorrect');
  if (state.retrievalPredictionSavingId !== 'separate-evidence') return issue('c120-transfer-retrieval-saving', 'Keep prediction score separate from operational saving evidence.', 'transfer-saving-incorrect');
  if (state.transferWhatIfId !== 'revise-held-out') return issue('c120-transfer-what-if', 'Revise the card for the held-out what-if instead of retuning after the result.', 'transfer-what-if-missing');
  if (state.powerTimePathwayId === '') return issue('c120-transfer-pathway', 'Choose the state/time pathway carried into the new domain.', 'transfer-pathway-missing');
  if (!responseReady(responses, 'competitionHypothesis')) return issue('c120-response-competitionHypothesis', 'Complete the hypothesis with a causal connector and an evidence, boundary, or unit term.', 'transfer-hypothesis-missing');
  if (!responseReady(responses, 'falsifier')) return issue('c120-response-falsifier', 'Name a counterfactual result and the evidence or boundary that would falsify the hypothesis.', 'transfer-falsifier-missing');
  return null;
}

export interface C120IdeaCardField {
  readonly id: 'baseline' | 'state-data' | 'control' | 'power-time' | 'boundary-unit' | 'service-constraint' | 'held-out' | 'falsifier';
  readonly label: string;
  readonly mode: 'AUTO' | 'SELECT' | 'STEM' | 'SHORT-CLAUSE';
  readonly value: string;
}

export function buildC120IdeaCard(
  state: C120InteractionState,
  scenario: C120Scenario,
  responses: C120ConstructedResponses,
): readonly C120IdeaCardField[] {
  const mission = scenario.missionContracts.find(item => item.id === state.missionContractId);
  const reference = scenario.labA.referenceReplay.outcome;
  const candidate = scenario.labA.candidates.find(item => item.id === state.labACandidateId)?.label ?? 'not selected';
  const rule = scenario.labB.rules.find(item => item.id === state.labBRuleId)?.label ?? 'not selected';
  const domain = state.transferDomainId || 'not selected';
  return [
    { id: 'baseline', label: 'Baseline', mode: 'AUTO', value: `${reference.consumedEnergyJ} J; service ${reference.servicePass ? 'PASS' : 'FAIL'}; ${reference.deliveredBits} bit` },
    { id: 'state-data', label: 'State / data', mode: 'SELECT', value: `${domain}; decision-time timestamped state only` },
    { id: 'control', label: 'Control', mode: 'AUTO', value: `${candidate}; ${rule}; six-slot schedule frozen after one revision` },
    { id: 'power-time', label: 'Power–time pathway', mode: 'SELECT', value: state.powerTimePathwayId || 'not selected' },
    { id: 'boundary-unit', label: 'Boundary / unit', mode: 'AUTO', value: mission ? `${mission.boundaryLabel}; keep W, J, bit, and bit/J separate` : 'not selected' },
    { id: 'service-constraint', label: 'Service constraint', mode: 'AUTO', value: mission ? `${mission.payloadBits} bit by ${mission.deadlineSec} s` : 'not selected' },
    { id: 'held-out', label: 'Held-out case', mode: 'AUTO', value: 'Trace B + shorter window + surprise urgent card + chronological clinic trace' },
    { id: 'falsifier', label: 'Falsifier starter', mode: 'SHORT-CLAUSE', value: responses.falsifier?.trim() || 'not completed' },
  ];
}

export function firstAnswerDelta(previous: C120InteractionState, next: C120InteractionState): readonly [string, string][] {
  const candidates: readonly [string, unknown, unknown][] = [
    ['missionContractId', previous.missionContractId, next.missionContractId],
    ['claimRejudgment', previous.claimRejudgment, next.claimRejudgment],
    ['labAPrediction', previous.labAPrediction, next.labAPrediction],
    ['labACandidateId', previous.labACandidateId, next.labACandidateId],
    ['labBPrediction', previous.labBPrediction, next.labBPrediction],
    ['labBRuleId', previous.labBRuleId, next.labBRuleId],
    ['recoveryRetrievalId', previous.recoveryRetrievalId, next.recoveryRetrievalId],
    ['labCPrediction', previous.labCPrediction, next.labCPrediction],
    ['clinicPrediction', previous.clinicPrediction, next.clinicPrediction],
    ['clinicActionId', previous.clinicActionId, next.clinicActionId],
    ['transferDomainId', previous.transferDomainId, next.transferDomainId],
    ['retrievalAnswerId', previous.retrievalAnswerId, next.retrievalAnswerId],
    ['retrievalPowerEnergyId', previous.retrievalPowerEnergyId, next.retrievalPowerEnergyId],
    ['retrievalDynamicPolicyId', previous.retrievalDynamicPolicyId, next.retrievalDynamicPolicyId],
    ['retrievalPredictionSavingId', previous.retrievalPredictionSavingId, next.retrievalPredictionSavingId],
  ];
  return candidates.flatMap(([key, before, after]) => (
    (before === '' || before === false) && after !== '' && after !== false ? [[key, String(after)] as [string, string]] : []
  ));
}

export const C120_SEGMENT_IDS = C120_SEGMENTS.map(segment => segment.id);
