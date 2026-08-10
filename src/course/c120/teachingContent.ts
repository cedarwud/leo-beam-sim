import {
  C120_CLAIM_BOUNDARY,
  C120_CONSTRUCTED_RESPONSE_KEYS,
  type C120ConstructedResponseKey,
  type C120LabACandidateId,
  type C120LabBRuleId,
  type C120LabCAction,
  type C120SegmentId,
} from './contract';
import {
  C120_FIXTURE_VERSION,
  C120_SCENARIO_ID,
  C120_TARGET_UTC,
  C120_TLE_SOURCE_ID,
} from './fixtures';

/**
 * Authored teaching content for the fixture-first C-120 route.
 *
 * This file is deliberately a content boundary: all values below are fixed
 * teaching values, not a browser producer. Replay values still come from the
 * validated provider; the content here only supplies worked examples, labels,
 * prompts, scaffolds and bounded choices.
 */

export type C120TeachingFieldKind = 'AUTO' | 'SELECT' | 'STEM' | 'SHORT-CLAUSE';
export type C120ProvenanceLabel = 'SOURCE' | 'MODEL-DERIVED' | 'COURSE-ASSUMPTION';

/**
 * Learner-facing copy has a deliberately small locale seam.  The authored
 * English fields below remain the stable content/provenance record used by
 * tests and exports; the renderer chooses these pairs for the first-run
 * Traditional Chinese experience without touching provider payloads.
 */
export interface C120LocalizedCopy {
  readonly zhHant: string;
  readonly en: string;
}

export interface C120NoviceGuide {
  readonly question: C120LocalizedCopy;
  readonly whatToDo: C120LocalizedCopy;
  readonly whatToNotice: C120LocalizedCopy;
  readonly whyItMatters: C120LocalizedCopy;
  readonly recovery: C120LocalizedCopy;
}

export interface C120TeachingContentHeader {
  readonly contentId: 'c120-teaching-content-v1';
  readonly scenarioId: typeof C120_SCENARIO_ID;
  readonly fixtureVersion: typeof C120_FIXTURE_VERSION;
  readonly claimBoundary: typeof C120_CLAIM_BOUNDARY;
  readonly exactMinutes: 120;
}

export interface C120ClaimTraceSlot {
  readonly id: string;
  readonly timeLabel: string;
  readonly stateLabel: string;
  readonly powerW: number;
  readonly consumedEnergyJ: number;
  readonly deliveredBits: number;
  readonly serviceLabel: 'pending' | 'complete' | 'missed';
  readonly boundaryLabel: string;
}

export interface C120ClaimCard {
  readonly id: 'claim-average-power' | 'claim-fast-completion' | 'claim-high-bit-j';
  readonly claimLabel: string;
  readonly expectedAction: 'accept' | 'qualify' | 'reject';
  readonly explanation: string;
}

export interface C120ClaimDetectiveContent {
  readonly question: string;
  readonly workedTrace: {
    readonly title: string;
    readonly note: string;
    readonly slots: readonly [C120ClaimTraceSlot, C120ClaimTraceSlot];
  };
  readonly claimCards: readonly [C120ClaimCard, C120ClaimCard, C120ClaimCard];
  readonly predictionChoices: readonly ['accept', 'qualify', 'reject'];
  readonly observationReveal: readonly string[];
  readonly rejudgementPrompt: string;
  readonly missionContractChoices: readonly {
    readonly id: 'fixed-service-boundary' | 'different-deadline';
    readonly label: string;
    readonly comparisonStatus: 'COMPARABLE' | 'INCOMPARABLE';
    readonly effect: string;
  }[];
  readonly explanationStem: string;
  readonly unitHint: string;
  readonly fastCounterexample: {
    readonly title: string;
    readonly prompt: string;
    readonly observation: string;
  };
}

export interface C120TleTeachingStage {
  readonly id: 'pinned-source' | 'model-derived-window' | 'course-assumption';
  readonly order: 1 | 2 | 3;
  readonly label: string;
  readonly provenance: C120ProvenanceLabel;
  readonly value: string;
  readonly studentAction: string;
  readonly disclosure: string;
}

export interface C120TleAnchorContent {
  readonly question: string;
  readonly offlineImport: {
    readonly id: 'offline-pinned-tle-import';
    readonly label: string;
    readonly sourceId: typeof C120_TLE_SOURCE_ID;
    readonly sourceEpochUtc: '2026-08-08T02:21:56.292480Z';
    readonly targetUtc: typeof C120_TARGET_UTC;
    readonly scenarioId: typeof C120_SCENARIO_ID;
    readonly fixtureVersion: typeof C120_FIXTURE_VERSION;
    readonly importInstruction: string;
  };
  readonly stages: readonly [C120TleTeachingStage, C120TleTeachingStage, C120TleTeachingStage];
  readonly sourceDoesNotContain: readonly ['power', 'traffic', 'handover', 'energy'];
  readonly progressiveDetails: readonly {
    readonly id: 'friendly' | 'technical';
    readonly label: string;
    readonly copy: string;
  }[];
  readonly predictionChoices: readonly {
    readonly id: 'source' | 'service-window' | 'course-assumption';
    readonly label: string;
  }[];
  readonly sendWaitChoice: readonly {
    readonly id: 'send-inside-window' | 'wait-outside-window';
    readonly label: string;
    readonly consequence: string;
  }[];
}

export interface C120LabAPredictionChoice {
  readonly id: 'pace' | 'balanced' | 'burst-to-sleep';
  readonly label: string;
  readonly activeTimeDirection: 'shorter' | 'middle' | 'longer';
  readonly consumedEnergyDirection: 'lower' | 'middle' | 'higher';
  readonly serviceDirection: 'pass' | 'risk';
  readonly bitJDirection: 'lower' | 'middle' | 'higher';
}

export interface C120LabAContent {
  readonly question: string;
  readonly workedExample: {
    readonly title: string;
    readonly note: string;
    readonly slots: readonly [
      {
        readonly id: 'active';
        readonly label: string;
        readonly powerW: number;
        readonly durationSec: number;
        readonly energyLabel: string;
      },
      {
        readonly id: 'fixed';
        readonly label: string;
        readonly powerW: number;
        readonly durationSec: number;
        readonly energyLabel: string;
      },
    ];
    readonly conclusion: string;
  };
  readonly entryCheck: readonly {
    readonly id: 'instantaneous-power' | 'accumulated-energy';
    readonly prompt: string;
    readonly choices: readonly string[];
  }[];
  readonly predictionChoices: readonly [C120LabAPredictionChoice, C120LabAPredictionChoice, C120LabAPredictionChoice];
  readonly mechanismWordBank: readonly {
    readonly id: 'active-time' | 'fixed-cost' | 'idle-cost' | 'wakeup-cost';
    readonly label: string;
    readonly copy: string;
  }[];
  readonly referenceReplayPrompt: string;
  readonly hiddenConditionPrompt: string;
  readonly negativeControl: {
    readonly id: 'same-service-boundary-negative-control';
    readonly label: string;
    readonly copy: string;
  };
  readonly hints: readonly {
    readonly level: 1 | 2 | 3;
    readonly id: 'compare-time' | 'compare-fixed-idle' | 'check-service-first';
    readonly copy: string;
  }[];
  readonly fastBranch: {
    readonly id: 'fixed-idle-ranking-reversal';
    readonly prompt: string;
    readonly observation: string;
  };
  readonly explanationStem: string;
  readonly candidateIds: readonly C120LabACandidateId[];
}

export interface C120LabBEvent {
  readonly id: 'thermostat-01' | 'thermostat-02' | 'thermostat-03' | 'thermostat-04' | 'thermostat-05';
  readonly timeLabel: string;
  readonly roomState: string;
  readonly qualityBand: 'low' | 'steady' | 'high';
  readonly servingState: 'A' | 'B';
  readonly nextStatePrompt: string;
}

export interface C120LabBContent {
  readonly question: string;
  readonly workedTrace: {
    readonly title: string;
    readonly note: string;
    readonly events: readonly [C120LabBEvent, C120LabBEvent, C120LabBEvent, C120LabBEvent, C120LabBEvent];
  };
  readonly entryCheck: {
    readonly prompt: string;
    readonly choices: readonly ['switch now', 'wait', 'remain'];
  };
  readonly traceAChoices: readonly {
    readonly id: 'switch-now' | 'wait' | 'remain';
    readonly label: string;
  }[];
  readonly ruleBuilder: {
    readonly thresholdOptions: readonly {
      readonly id: 'threshold-low' | 'threshold-steady' | 'threshold-high';
      readonly label: string;
      readonly qualityBand: 'low' | 'steady' | 'high';
    }[];
    readonly consecutiveStepOptions: readonly {
      readonly id: 'one-step' | 'two-steps' | 'three-steps';
      readonly label: string;
      readonly countLabel: string;
    }[];
    readonly lowerThresholdOptions: readonly {
      readonly id: 'lower-same' | 'lower-one-band' | 'lower-two-bands';
      readonly label: string;
      readonly boundaryLabel: string;
    }[];
    readonly executableBlock: string;
  };
  readonly withheldTrace: {
    readonly id: 'trace-b-withheld';
    readonly changedFutureTrend: string;
    readonly unchangedRuleInstruction: string;
  };
  readonly counterexample: {
    readonly id: 'quality-dip-after-switch';
    readonly prompt: string;
    readonly observation: string;
  };
  readonly hints: readonly {
    readonly id: 'rewind-one-event' | 'show-next-state' | 'known-good-trace';
    readonly level: 1 | 2 | 3;
    readonly copy: string;
  }[];
  readonly explanationStem: string;
  readonly ruleIds: readonly C120LabBRuleId[];
}

export interface C120LabCDataCard {
  readonly id: 'urgent-alert-card';
  readonly label: string;
  readonly generatedAt: string;
  readonly deadlineAt: string;
  readonly freshnessLimit: string;
  readonly sizeLabel: string;
  readonly contactWindow: string;
  readonly legalSlot: string;
}

export interface C120LabCSchedule {
  readonly id: 'schedule-urgent-first' | 'schedule-batch-periodic' | 'schedule-surprise-revision';
  readonly label: string;
  readonly scaffoldLevel: 'worked' | 'bounded-choice' | 'fast-counterexample';
  readonly slots: readonly [
    'fixed-contact',
    C120LabCAction,
    C120LabCAction,
    'fixed-outage',
    C120LabCAction,
    C120LabCAction,
  ];
  readonly constraintNote: string;
  readonly learnerCanRevise: boolean;
}

export interface C120LabCContent {
  readonly question: string;
  readonly workedExample: {
    readonly title: string;
    readonly card: C120LabCDataCard;
    readonly generatedSentReceived: readonly [string, string, string];
    readonly observation: string;
  };
  readonly entryCheck: {
    readonly prompt: string;
    readonly choices: readonly ['slot 2', 'slot 5', 'not inside contact window'];
  };
  readonly baselinePrediction: readonly {
    readonly id: 'service-pass' | 'freshness' | 'wake-count' | 'active-time' | 'consumed-energy' | 'budget-remaining';
    readonly label: string;
    readonly choices: readonly string[];
  }[];
  readonly boundedSchedules: readonly [C120LabCSchedule, C120LabCSchedule, C120LabCSchedule];
  readonly actionableSlotIds: readonly ['slot-2', 'slot-3', 'slot-5', 'slot-6'];
  readonly constraintCopy: readonly string[];
  readonly ledgerColumns: readonly string[];
  readonly replayCardLedgers: readonly {
    readonly replayId: 'lab-c-immediate-baseline-replay' | 'lab-c-batched-replay' | 'lab-c-revision-replay';
    readonly rows: readonly {
      readonly cardId: string;
      readonly generated: string;
      readonly sent: string;
      readonly received: string;
      readonly state: 'received' | 'queued' | 'expired' | 'not-sent';
    }[];
  }[];
  readonly revisionRule: string;
  readonly withheldEvents: readonly {
    readonly id: 'shorter-window' | 'surprise-urgent';
    readonly label: string;
    readonly copy: string;
  }[];
  readonly surpriseBranch: {
    readonly id: 'surprise-urgent';
    readonly prompt: string;
    readonly observation: string;
  };
  readonly scaffoldCopy: readonly {
    readonly level: 'baseline' | 'autofill' | 'bounded-choice';
    readonly copy: string;
    readonly provenanceLabel: string;
  }[];
  readonly explanationStem: string;
}

export interface C120ClinicFeatureCard {
  readonly id: 'feature-a' | 'feature-b' | 'feature-c' | 'feature-d' | 'feature-e';
  readonly neutralLabel: string;
  readonly timestampLabel: string;
  readonly availability: 'available-now' | 'after-action';
  readonly studentPrompt: string;
}

export interface C120ClinicContent {
  readonly question: string;
  readonly workedExample: {
    readonly title: string;
    readonly cardLabel: string;
    readonly timestamp: string;
    readonly decisionTimeObservation: string;
    readonly afterActionObservation: string;
  };
  readonly featureCards: readonly [C120ClinicFeatureCard, C120ClinicFeatureCard, C120ClinicFeatureCard, C120ClinicFeatureCard, C120ClinicFeatureCard];
  readonly predictionChoices: readonly ['available now', 'after action'];
  readonly actionChoices: readonly {
    readonly id: 'protect-service' | 'chase-score';
    readonly neutralLabel: string;
    readonly decisionTimeRule: string;
  }[];
  readonly scoreSeparation: readonly string[];
  readonly hints: readonly {
    readonly id: 'availability-tooltip' | 'leakage-check' | 'honest-fallback';
    readonly level: 1 | 2 | 3;
    readonly copy: string;
  }[];
  readonly distributionShift: {
    readonly id: 'held-out-weather-shift';
    readonly prompt: string;
    readonly observation: string;
  };
  readonly explanationStem: string;
}

export interface C120IdeaCardFieldDefinition {
  readonly id: 'baseline' | 'state-data' | 'control' | 'power-time-pathway' | 'boundary-unit' | 'service-constraint' | 'held-out-case' | 'falsifier';
  readonly label: string;
  readonly prompt: string;
  readonly sourceSegment: C120SegmentId;
  readonly fieldKind: C120TeachingFieldKind;
}

export interface C120TransferContent {
  readonly question: string;
  readonly workedFormatExample: {
    readonly domainId: 'smart-greenhouse';
    readonly domainLabel: string;
    readonly fixtureLabel: string;
    readonly exampleFields: readonly {
      readonly fieldId: C120IdeaCardFieldDefinition['id'];
      readonly example: string;
    }[];
    readonly note: string;
  };
  readonly ideaCardFields: readonly [
    C120IdeaCardFieldDefinition,
    C120IdeaCardFieldDefinition,
    C120IdeaCardFieldDefinition,
    C120IdeaCardFieldDefinition,
    C120IdeaCardFieldDefinition,
    C120IdeaCardFieldDefinition,
    C120IdeaCardFieldDefinition,
    C120IdeaCardFieldDefinition,
  ];
  readonly unseenDomainChoices: readonly {
    readonly id: 'smart-farm' | 'hvac' | 'edge-cache' | 'logistics';
    readonly label: string;
    readonly prompt: string;
  }[];
  readonly whatIfPrompt: string;
  readonly retrievalPrompts: readonly {
    readonly id: 'low-w-vs-low-j' | 'dynamic-policy' | 'prediction-vs-saving';
    readonly prompt: string;
    readonly choices: readonly string[];
  }[];
  readonly exportPrompt: string;
}

export interface C120ConstructedResponseDefinition {
  readonly key: C120ConstructedResponseKey;
  readonly segmentId: C120SegmentId;
  readonly fieldKind: 'STEM' | 'SHORT-CLAUSE';
  readonly label: string;
  readonly prompt: string;
  readonly zhHantLabel?: string;
  readonly zhHantPrompt?: string;
  readonly maxLength: number;
}

export interface C120TeachingContent {
  readonly header: C120TeachingContentHeader;
  readonly constructedResponses: readonly [
    C120ConstructedResponseDefinition,
    C120ConstructedResponseDefinition,
    C120ConstructedResponseDefinition,
    C120ConstructedResponseDefinition,
    C120ConstructedResponseDefinition,
    C120ConstructedResponseDefinition,
    C120ConstructedResponseDefinition,
    C120ConstructedResponseDefinition,
  ];
  readonly claimDetective: C120ClaimDetectiveContent;
  readonly tleAnchor: C120TleAnchorContent;
  readonly labA: C120LabAContent;
  readonly labB: C120LabBContent;
  readonly labC: C120LabCContent;
  readonly clinic: C120ClinicContent;
  readonly transfer: C120TransferContent;
}

export const C120_CONSTRUCTED_RESPONSE_DEFINITIONS: C120TeachingContent['constructedResponses'] = [
  {
    key: 'openingClause',
    segmentId: 'claim-detective',
    fieldKind: 'STEM',
    label: 'Claim decision',
    prompt: 'I accept / qualify / reject the claim because the fixed ______ makes ______ comparable, although ______; if ______, the claim cannot be compared.',
    zhHantLabel: '主張判斷',
    zhHantPrompt: '我接受／限定／拒絕這個主張，因為固定的 ______ 讓 ______ 可以比較，但 ______；如果 ______，這個主張就不能比較。',
    maxLength: 280,
  },
  {
    key: 'labAClause',
    segmentId: 'lab-a',
    fieldKind: 'STEM',
    label: 'Lab A causal debrief',
    prompt: 'I chose ______, which changed ______; the power-time pathway ______, so with service_pass ______ the consumed J was ______ and bit/J was ______; the decision fails if ______.',
    zhHantLabel: '實驗 A 因果整理',
    zhHantPrompt: '我選擇 ______，它改變了 ______；功率－時間路徑 ______，所以在 service_pass ______ 時，消耗 J 是 ______、bit/J 是 ______；若 ______，這個決策會失敗。',
    maxLength: 280,
  },
  {
    key: 'labBClause',
    segmentId: 'lab-b',
    fieldKind: 'STEM',
    label: 'Lab B counterexample',
    prompt: 'This rule fails when ______ changes, because the changed state ______ makes the service / consumed-J trade-off ______.',
    zhHantLabel: '實驗 B 反例',
    zhHantPrompt: '當 ______ 改變時，這條規則會失效，因為改變後的狀態 ______ 讓服務／消耗 J 的取捨變成 ______。',
    maxLength: 240,
  },
  {
    key: 'recoveryClause',
    segmentId: 'recovery',
    fieldKind: 'STEM',
    label: 'Recovery causal chain',
    prompt: 'A decision changes ______, which changes ______, and the service boundary is ______.',
    zhHantLabel: '復原因果鏈',
    zhHantPrompt: '一個決策改變 ______，接著改變 ______，而服務邊界是 ______。',
    maxLength: 180,
  },
  {
    key: 'labCClause',
    segmentId: 'lab-c',
    fieldKind: 'STEM',
    label: 'Lab C schedule debrief',
    prompt: 'My schedule saved ______ power-time cost but sacrificed / nearly sacrificed ______ service; therefore under ______ it qualifies.',
    zhHantLabel: '實驗 C 排程整理',
    zhHantPrompt: '我的排程節省了 ______ 功率－時間成本，但犧牲／幾乎犧牲了 ______ 服務；因此在 ______ 邊界下，它可以成立。',
    maxLength: 240,
  },
  {
    key: 'clinicClause',
    segmentId: 'clinic',
    fieldKind: 'STEM',
    label: 'Evidence clinic claim',
    prompt: 'This prediction claim is usable / not usable because ______ was available at decision time ______; the frozen action showed ______, so I can only claim ______.',
    zhHantLabel: '證據診間主張',
    zhHantPrompt: '這個預測主張可用／不可用，因為 ______ 在決策時刻 ______ 已經可用；凍結的動作顯示 ______，所以我只能主張 ______。',
    maxLength: 260,
  },
  {
    key: 'competitionHypothesis',
    segmentId: 'transfer',
    fieldKind: 'SHORT-CLAUSE',
    label: 'Competition hypothesis',
    prompt: 'In my new domain, changing ______ should change ______ while preserving ______.',
    zhHantLabel: '競賽假說',
    zhHantPrompt: '在我的新領域中，改變 ______ 應該改變 ______，同時保留 ______。',
    maxLength: 300,
  },
  {
    key: 'falsifier',
    segmentId: 'transfer',
    fieldKind: 'SHORT-CLAUSE',
    label: 'Falsifier',
    prompt: 'I would abandon or revise this idea if ______ occurs under the fixed boundary ______.',
    zhHantLabel: '反駁條件',
    zhHantPrompt: '如果在固定邊界 ______ 下發生 ______，我會放棄或修正這個想法。',
    maxLength: 300,
  },
] as const;

export const C120_TEACHING_CONTENT: C120TeachingContent = {
  header: {
    contentId: 'c120-teaching-content-v1',
    scenarioId: C120_SCENARIO_ID,
    fixtureVersion: C120_FIXTURE_VERSION,
    claimBoundary: C120_CLAIM_BOUNDARY,
    exactMinutes: 120,
  },
  constructedResponses: C120_CONSTRUCTED_RESPONSE_DEFINITIONS,
  claimDetective: {
    question: 'A has lower average power; B finishes sooner; C has higher bit/J but misses the deadline. Which claim is actually energy-saving?',
    workedTrace: {
      title: 'Worked trace: two time slots, one fixed boundary',
      note: 'The values are an authored teaching example. Read power, accumulated energy, delivered service and the boundary as separate columns.',
      slots: [
        {
          id: 'worked-slot-1',
          timeLabel: 't = 0-10 s',
          stateLabel: 'active transfer',
          powerW: 30,
          consumedEnergyJ: 300,
          deliveredBits: 400000,
          serviceLabel: 'pending',
          boundaryLabel: 'same payload; deadline still open',
        },
        {
          id: 'worked-slot-2',
          timeLabel: 't = 10-20 s',
          stateLabel: 'fixed + idle tail',
          powerW: 20,
          consumedEnergyJ: 500,
          deliveredBits: 900000,
          serviceLabel: 'complete',
          boundaryLabel: 'same payload; deadline met',
        },
      ],
    },
    claimCards: [
      {
        id: 'claim-average-power',
        claimLabel: 'The lower-W run is automatically the lower-energy run.',
        expectedAction: 'qualify',
        explanation: 'Power is an instantaneous column; the time pathway and service gate still need to be inspected.',
      },
      {
        id: 'claim-fast-completion',
        claimLabel: 'The faster run is automatically the energy winner.',
        expectedAction: 'qualify',
        explanation: 'A shorter run can avoid an idle tail, but only a comparable service result can support the claim.',
      },
      {
        id: 'claim-high-bit-j',
        claimLabel: 'A higher bit/J cancels a missed deadline.',
        expectedAction: 'reject',
        explanation: 'A useful ratio cannot repair a failed service boundary.',
      },
    ],
    predictionChoices: ['accept', 'qualify', 'reject'],
    observationReveal: ['reveal consumed J', 'reveal completion time', 'reveal service and deadline badge', 'allow one re-judgement'],
    rejudgementPrompt: 'After the evidence opens, may your first claim change? Record one revised decision and the reason for the boundary.',
    missionContractChoices: [
      {
        id: 'fixed-service-boundary',
        label: 'Fixed payload, deadline and contact boundary',
        comparisonStatus: 'COMPARABLE',
        effect: 'Later evidence may be compared on the same service gate.',
      },
      {
        id: 'different-deadline',
        label: 'Different payload or deadline',
        comparisonStatus: 'INCOMPARABLE',
        effect: 'The surface marks this as incomparable; do not call a saving.',
      },
    ],
    explanationStem: 'I accept / qualify / reject ______ because fixed ______ makes ______ comparable, although ______; if ______, the claim cannot be compared.',
    unitHint: 'W is a power column; J is consumed energy; bit/J is a provider-owned service ratio. Keep units visible.',
    fastCounterexample: {
      title: 'Fast branch: change the boundary, not the data',
      prompt: 'What changes when the deadline is different but the two authored traces stay the same?',
      observation: 'The same numbers can move from comparable to incomparable; lowering the service requirement is not a legal saving.',
    },
  },
  tleAnchor: {
    question: 'Which part of the NTPU display is source data, model-derived state, or a course assumption?',
    offlineImport: {
      id: 'offline-pinned-tle-import',
      label: 'Import the pinned offline source',
      sourceId: C120_TLE_SOURCE_ID,
      sourceEpochUtc: '2026-08-08T02:21:56.292480Z',
      targetUtc: C120_TARGET_UTC,
      scenarioId: C120_SCENARIO_ID,
      fixtureVersion: C120_FIXTURE_VERSION,
      importInstruction: 'Use the bundled offline record once. Do not download or upload another source; the next lab must display this same scenario ID.',
    },
    stages: [
      {
        id: 'pinned-source',
        order: 1,
        label: 'Pinned source',
        provenance: 'SOURCE',
        value: C120_TLE_SOURCE_ID,
        studentAction: 'Inspect source label and source epoch UTC.',
        disclosure: 'This record is the offline input; it is not measured.',
      },
      {
        id: 'model-derived-window',
        order: 2,
        label: 'NTPU service window',
        provenance: 'MODEL-DERIVED',
        value: 'ntpu-observer-window-v1',
        studentAction: 'Open the target UTC, observer and visibility cards.',
        disclosure: 'The scene/window is a provider replay product derived for this teaching scenario.',
      },
      {
        id: 'course-assumption',
        order: 3,
        label: 'Course traffic and power assumption',
        provenance: 'COURSE-ASSUMPTION',
        value: 'mission-fixed-service-boundary',
        studentAction: 'Choose which send/wait interval is inside the displayed window.',
        disclosure: 'Traffic, power and energy evidence are course fixtures added after the source/window stages.',
      },
    ],
    sourceDoesNotContain: ['power', 'traffic', 'handover', 'energy'],
    progressiveDetails: [
      { id: 'friendly', label: 'Friendly view', copy: 'source → target UTC → NTPU visibility → service window' },
      { id: 'technical', label: 'Technical detail', copy: 'epoch, observer frame and look-angle values are inspectable but not a derivation task' },
    ],
    predictionChoices: [
      { id: 'source', label: 'Pinned source record' },
      { id: 'service-window', label: 'Model-derived service window' },
      { id: 'course-assumption', label: 'Course traffic/power assumption' },
    ],
    sendWaitChoice: [
      { id: 'send-inside-window', label: 'Send inside the window', consequence: 'The provider can compare this action against the fixed service boundary.' },
      { id: 'wait-outside-window', label: 'Wait outside the window', consequence: 'The service gate is constrained by the same scenario window.' },
    ],
  },
  labA: {
    question: 'With the same payload and deadline, does lower instantaneous power always mean lower consumed energy?',
    workedExample: {
      title: 'Worked example: active, fixed and idle are separate rows',
      note: 'This example teaches the pathway without exposing the later candidate winner.',
      slots: [
        { id: 'active', label: 'Active transfer', powerW: 32, durationSec: 10, energyLabel: 'authored row: 320 J' },
        { id: 'fixed', label: 'Fixed/idle tail', powerW: 14, durationSec: 8, energyLabel: 'authored row: 112 J' },
      ],
      conclusion: 'A low-power tail can still matter because it occupies time; check service before ranking.',
    },
    entryCheck: [
      { id: 'instantaneous-power', prompt: 'Which column is an instantaneous system level?', choices: ['W', 'J', 'delivered bits'] },
      { id: 'accumulated-energy', prompt: 'Which column accumulates the run?', choices: ['W', 'J', 'rate'] },
    ],
    predictionChoices: [
      { id: 'pace', label: 'Pace to idle', activeTimeDirection: 'longer', consumedEnergyDirection: 'higher', serviceDirection: 'pass', bitJDirection: 'middle' },
      { id: 'balanced', label: 'Balanced pace', activeTimeDirection: 'middle', consumedEnergyDirection: 'middle', serviceDirection: 'pass', bitJDirection: 'higher' },
      { id: 'burst-to-sleep', label: 'Burst then sleep', activeTimeDirection: 'shorter', consumedEnergyDirection: 'lower', serviceDirection: 'risk', bitJDirection: 'higher' },
    ],
    mechanismWordBank: [
      { id: 'active-time', label: 'active time', copy: 'How long the transfer remains active.' },
      { id: 'fixed-cost', label: 'fixed cost', copy: 'A bounded system cost that remains in the authored replay.' },
      { id: 'idle-cost', label: 'idle cost', copy: 'A cost carried while waiting or sleeping transition is not free.' },
      { id: 'wakeup-cost', label: 'wakeup cost', copy: 'A wake event is tracked separately from power and service.' },
    ],
    referenceReplayPrompt: 'Run the provider-owned reference first; compare the same timeline columns before choosing a candidate.',
    hiddenConditionPrompt: 'Choose one candidate. Its choice is sent to a hidden fixed/idle/wakeup replay and cannot be replaced by a cosmetic preset.',
    negativeControl: {
      id: 'same-service-boundary-negative-control',
      label: 'Negative control: same service boundary',
      copy: 'Re-run the same payload/deadline boundary with the candidate held constant; use it to check that the observed change is attributable to the authored condition.',
    },
    hints: [
      { level: 1, id: 'compare-time', copy: 'First compare active time and the sleep interval.' },
      { level: 2, id: 'compare-fixed-idle', copy: 'Then inspect the fixed/idle rows in the evidence ledger.' },
      { level: 3, id: 'check-service-first', copy: 'Finally check service_pass and deadline before reading bit/J.' },
    ],
    fastBranch: {
      id: 'fixed-idle-ranking-reversal',
      prompt: 'If the fixed idle cost is changed in the next authored fixture, does your ranking reverse?',
      observation: 'A ranking can reverse when the operating-cost condition changes; that is a counterexample, not a universal law.',
    },
    explanationStem: 'I chose ______, which changed ______; its power-time pathway ______, so when service_pass is ______ the consumed J is ______ and bit/J is ______; it fails if ______.',
    candidateIds: ['pace', 'balanced', 'burst-to-sleep'],
  },
  labB: {
    question: 'When a candidate looks better, should a controller switch now or wait for a stable trend?',
    workedTrace: {
      title: 'Worked thermostat trace: state changes after evidence, not after hindsight',
      note: 'The five rows are a familiar control analogy; they do not claim a commercial handover standard.',
      events: [
        { id: 'thermostat-01', timeLabel: 'event 1', roomState: 'room warming', qualityBand: 'low', servingState: 'A', nextStatePrompt: 'Would a one-step improvement be enough to switch?' },
        { id: 'thermostat-02', timeLabel: 'event 2', roomState: 'room steady', qualityBand: 'steady', servingState: 'A', nextStatePrompt: 'Would you wait for another steady observation?' },
        { id: 'thermostat-03', timeLabel: 'event 3', roomState: 'room briefly cooler', qualityBand: 'high', servingState: 'B', nextStatePrompt: 'If the high band persists, what is the next serving state?' },
        { id: 'thermostat-04', timeLabel: 'event 4', roomState: 'room drifts back', qualityBand: 'steady', servingState: 'B', nextStatePrompt: 'Would the lower threshold permit an immediate return?' },
        { id: 'thermostat-05', timeLabel: 'event 5', roomState: 'room stable again', qualityBand: 'low', servingState: 'A', nextStatePrompt: 'Record the next state before revealing the outcome row.' },
      ],
    },
    entryCheck: {
      prompt: 'On Trace A, what is your first action before seeing the later trend?',
      choices: ['switch now', 'wait', 'remain'],
    },
    traceAChoices: [
      { id: 'switch-now', label: 'Switch now' },
      { id: 'wait', label: 'Wait for one more event' },
      { id: 'remain', label: 'Remain on the current state' },
    ],
    ruleBuilder: {
      thresholdOptions: [
        { id: 'threshold-low', label: 'Low band', qualityBand: 'low' },
        { id: 'threshold-steady', label: 'Steady band', qualityBand: 'steady' },
        { id: 'threshold-high', label: 'High band', qualityBand: 'high' },
      ],
      consecutiveStepOptions: [
        { id: 'one-step', label: 'N = 1', countLabel: 'one observed step' },
        { id: 'two-steps', label: 'N = 2', countLabel: 'two consecutive steps' },
        { id: 'three-steps', label: 'N = 3', countLabel: 'three consecutive steps' },
      ],
      lowerThresholdOptions: [
        { id: 'lower-same', label: 'same lower threshold', boundaryLabel: 'return at the same band' },
        { id: 'lower-one-band', label: 'one band lower', boundaryLabel: 'return only after one lower band' },
        { id: 'lower-two-bands', label: 'two bands lower', boundaryLabel: 'return only after two lower bands' },
      ],
      executableBlock: 'IF quality reaches threshold for N consecutive steps THEN switch ELSE remain; use the chosen lower threshold before switching back.',
    },
    withheldTrace: {
      id: 'trace-b-withheld',
      changedFutureTrend: 'Trace B changes only the future quality trend after the rule is frozen.',
      unchangedRuleInstruction: 'Run the frozen rule without retuning; record state, service, switching, W and J together.',
    },
    counterexample: {
      id: 'quality-dip-after-switch',
      prompt: 'Which changed quality trend would make a switch-now rule fail?',
      observation: 'A quality dip after switching can add switching or service cost; fewer switches alone do not prove lower energy.',
    },
    hints: [
      { id: 'rewind-one-event', level: 1, copy: 'Rewind exactly one event and make the alternate decision.' },
      { id: 'show-next-state', level: 2, copy: 'Reveal the next state only; future outcome rows stay hidden.' },
      { id: 'known-good-trace', level: 3, copy: 'Open the known-good trace to inspect the rule shape, not the withheld answer.' },
    ],
    explanationStem: 'This rule fails when ______ changes, because the changed state ______ makes service / consumed-J trade-off ______.',
    ruleIds: ['switch-now', 'stable-two', 'hysteresis'],
  },
  labC: {
    question: 'With a finite energy budget and short contact window, when should urgent, periodic and bulk cards send, batch, wait or sleep?',
    workedExample: {
      title: 'Worked data-card example: generated → sent → received',
      card: {
        id: 'urgent-alert-card',
        label: 'Urgent alert · card U1',
        generatedAt: 't = 12 s',
        deadlineAt: 't = 42 s',
        freshnessLimit: 'fresh through t = 48 s',
        sizeLabel: 'small payload',
        contactWindow: 't = 0-150 s with fixed outage at t = 90 s',
        legalSlot: 'slot 2 or slot 5 before the deadline',
      },
      generatedSentReceived: ['generated at t = 12 s', 'sent at t = 20 s', 'received at t = 32 s'],
      observation: 'The card can be delivered inside the same window while preserving its deadline and freshness labels.',
    },
    entryCheck: {
      prompt: 'Which slot is legal for urgent card U1 in the worked example?',
      choices: ['slot 2', 'slot 5', 'not inside contact window'],
    },
    baselinePrediction: [
      { id: 'service-pass', label: 'service_pass', choices: ['pass', 'risk', 'unknown'] },
      { id: 'freshness', label: 'freshness', choices: ['fresh', 'expired', 'unknown'] },
      { id: 'wake-count', label: 'wake count', choices: ['lower', 'middle', 'higher'] },
      { id: 'active-time', label: 'active time', choices: ['shorter', 'middle', 'longer'] },
      { id: 'consumed-energy', label: 'consumed J', choices: ['lower', 'middle', 'higher'] },
      { id: 'budget-remaining', label: 'budget remaining', choices: ['more', 'middle', 'less'] },
    ],
    boundedSchedules: [
      {
        id: 'schedule-urgent-first',
        label: 'Urgent first, then sleep',
        scaffoldLevel: 'worked',
        slots: ['fixed-contact', 'send-urgent', 'send-urgent', 'fixed-outage', 'send-bulk', 'sleep'],
        constraintNote: 'Provider baseline: urgent cards are sent before the fixed outage; bulk uses the later legal slot.',
        learnerCanRevise: true,
      },
      {
        id: 'schedule-batch-periodic',
        label: 'Batch periodic cards',
        scaffoldLevel: 'bounded-choice',
        slots: ['fixed-contact', 'wait', 'batch-periodic', 'fixed-outage', 'flush-batch', 'sleep'],
        constraintNote: 'First learner run: the periodic batch meets the visible slot contract; the evaluation condition stays hidden until freeze.',
        learnerCanRevise: true,
      },
      {
        id: 'schedule-surprise-revision',
        label: 'Revision shape R',
        scaffoldLevel: 'fast-counterexample',
        slots: ['fixed-contact', 'send-urgent', 'batch-periodic', 'fixed-outage', 'flush-batch', 'send-urgent'],
        constraintNote: 'This provider-supported revision may be loaded after the first run; the held-out event remains hidden until freeze.',
        learnerCanRevise: true,
      },
    ],
    actionableSlotIds: ['slot-2', 'slot-3', 'slot-5', 'slot-6'],
    constraintCopy: [
      'Fixed contact and fixed outage slots cannot be edited.',
      'An urgent card cannot be dropped silently; an illegal slot explains its deadline or window conflict.',
      'Run once, revise once, then freeze before the withheld event is revealed.',
      'Autofill is scaffolded practice and keeps its provenance in the workbook.',
    ],
    ledgerColumns: ['card', 'generated', 'sent', 'received', 'state', 'service_pass', 'freshness', 'W', 'J', 'budget remaining', 'delivered bits', 'bit/J'],
    replayCardLedgers: [
      {
        replayId: 'lab-c-immediate-baseline-replay',
        rows: [
          { cardId: 'U1', generated: 't = 12 s', sent: 't = 30 s', received: 't = 42 s', state: 'received' },
          { cardId: 'P1', generated: 't = 45 s', sent: 't = 60 s', received: 't = 72 s', state: 'received' },
          { cardId: 'B1', generated: 't = 100 s', sent: 't = 120 s', received: 't = 145 s', state: 'received' },
        ],
      },
      {
        replayId: 'lab-c-batched-replay',
        rows: [
          { cardId: 'U1', generated: 't = 12 s', sent: 't = 120 s', received: 'not received', state: 'expired' },
          { cardId: 'P1', generated: 't = 45 s', sent: 't = 120 s', received: 't = 142 s', state: 'received' },
          { cardId: 'B1', generated: 't = 100 s', sent: 'not sent', received: 'not received', state: 'not-sent' },
        ],
      },
      {
        replayId: 'lab-c-revision-replay',
        rows: [
          { cardId: 'U1', generated: 't = 12 s', sent: 't = 30 s', received: 't = 42 s', state: 'received' },
          { cardId: 'P1', generated: 't = 45 s', sent: 't = 120 s', received: 't = 142 s', state: 'received' },
          { cardId: 'U2 surprise', generated: 't = 118 s', sent: 't = 150 s', received: 't = 158 s', state: 'received' },
        ],
      },
    ],
    revisionRule: 'One learner revision is permitted. After freeze, one authored held-out event runs without retuning.',
    withheldEvents: [
      { id: 'shorter-window', label: 'Shorter contact window', copy: 'The same schedule meets a shorter window only if its legal service boundary remains satisfied.' },
      { id: 'surprise-urgent', label: 'Surprise urgent card', copy: 'A new urgent card arrives after freeze; read service and budget separately.' },
    ],
    surpriseBranch: {
      id: 'surprise-urgent',
      prompt: 'If a surprise urgent card arrives after freeze, which service constraint can change your judgement?',
      observation: 'A higher bit/J does not license calling a mission successful when the urgent service or deadline fails.',
    },
    scaffoldCopy: [
      { level: 'baseline', copy: 'System runs the authored send-immediately baseline.', provenanceLabel: 'AUTO · baseline replay' },
      { level: 'autofill', copy: 'One legal schedule is prefilled for recovery practice.', provenanceLabel: 'SCAFFOLD · autofill provenance' },
      { level: 'bounded-choice', copy: 'Only bounded legal actions for the current slot are offered.', provenanceLabel: 'SELECT · bounded course choices' },
    ],
    explanationStem: 'My schedule saved ______ power-time cost but sacrificed / nearly sacrificed ______ service; therefore under ______ it qualifies.',
  },
  clinic: {
    question: 'Does a higher prediction score prove that a control action saves energy?',
    workedExample: {
      title: 'Worked feature card: timestamp before label',
      cardLabel: 'Card C · observed state row',
      timestamp: '2026-08-09T04:00:20Z',
      decisionTimeObservation: 'Quality and freshness snapshot available before the action.',
      afterActionObservation: 'Delivered result and service outcome appear after the action and stay held out.',
    },
    featureCards: [
      { id: 'feature-a', neutralLabel: 'Card A · state snapshot', timestampLabel: 't = 0', availability: 'available-now', studentPrompt: 'Classify by timestamp and action order.' },
      { id: 'feature-b', neutralLabel: 'Card B · timestamped event row', timestampLabel: 't = 1', availability: 'available-now', studentPrompt: 'Is this row available before the decision?' },
      { id: 'feature-c', neutralLabel: 'Card C · quality snapshot', timestampLabel: 't = 2', availability: 'available-now', studentPrompt: 'Classify without reading a future result.' },
      { id: 'feature-d', neutralLabel: 'Card D · follow-up row', timestampLabel: 't = 3', availability: 'after-action', studentPrompt: 'Compare this timestamp with the decision marker.' },
      { id: 'feature-e', neutralLabel: 'Card E · closing row', timestampLabel: 't = 4', availability: 'after-action', studentPrompt: 'Classify from chronology before reading its meaning.' },
    ],
    predictionChoices: ['available now', 'after action'],
    actionChoices: [
      { id: 'protect-service', neutralLabel: 'Action P', decisionTimeRule: 'Apply policy P using the frozen feature boundary.' },
      { id: 'chase-score', neutralLabel: 'Action Q', decisionTimeRule: 'Apply policy Q using the same frozen feature boundary.' },
    ],
    scoreSeparation: [
      'Prediction score is recorded in its own evidence block.',
      'The frozen action replay separately records service_pass, freshness, deadline, consumed J and delivered bits.',
      'A score is not a measurement and is not inserted into the energy evidence.',
    ],
    hints: [
      { id: 'availability-tooltip', level: 1, copy: 'Open the timestamp tooltip before classifying the card.' },
      { id: 'leakage-check', level: 2, copy: 'Ask whether the row existed before the action was frozen.' },
      { id: 'honest-fallback', level: 3, copy: 'Use the fixed honest fallback when the feature boundary is unclear.' },
    ],
    distributionShift: {
      id: 'held-out-weather-shift',
      prompt: 'Would the same decision-time rule survive a new held-out weather pattern?',
      observation: 'A distribution shift can change the held-out control result without changing the feature labels; record the limitation.',
    },
    explanationStem: 'This prediction claim is usable / not usable because ______ was available at decision time ______; the frozen action showed ______, so I can only claim ______.',
  },
  transfer: {
    question: 'Which energy decision mechanism can become a measurable, falsifiable competition question outside LEO?',
    workedFormatExample: {
      domainId: 'smart-greenhouse',
      domainLabel: 'Smart greenhouse',
      fixtureLabel: 'Example fixture: irrigation valve with a fixed freshness window',
      exampleFields: [
        { fieldId: 'baseline', example: 'Run the valve at the existing schedule.' },
        { fieldId: 'state-data', example: 'Use soil-moisture snapshot before each decision.' },
        { fieldId: 'control', example: 'Batch one irrigation request or wait.' },
        { fieldId: 'power-time-pathway', example: 'Valve active time plus fixed wake/idle rows.' },
        { fieldId: 'boundary-unit', example: 'Same plot, same window, W and J columns.' },
        { fieldId: 'service-constraint', example: 'Keep soil freshness inside the agreed window.' },
        { fieldId: 'held-out-case', example: 'A new weather card arrives after the policy freezes.' },
        { fieldId: 'falsifier', example: 'The schedule misses freshness without a compensating service result.' },
      ],
      note: 'This is a format example from another fixture; it is not the answer to the learner’s chosen domain.',
    },
    ideaCardFields: [
      { id: 'baseline', label: 'Baseline', prompt: 'What is the current operating policy?', sourceSegment: 'lab-a', fieldKind: 'AUTO' },
      { id: 'state-data', label: 'State / data', prompt: 'What decision-time state is observed?', sourceSegment: 'lab-b', fieldKind: 'AUTO' },
      { id: 'control', label: 'Control', prompt: 'What action can the learner freeze?', sourceSegment: 'lab-b', fieldKind: 'SELECT' },
      { id: 'power-time-pathway', label: 'Power-time pathway', prompt: 'Which active, fixed, idle or wake pathway changes?', sourceSegment: 'lab-a', fieldKind: 'AUTO' },
      { id: 'boundary-unit', label: 'Boundary / unit', prompt: 'What is held fixed and which units remain visible?', sourceSegment: 'claim-detective', fieldKind: 'SELECT' },
      { id: 'service-constraint', label: 'Service constraint', prompt: 'What deadline, freshness or service gate cannot be traded away?', sourceSegment: 'lab-c', fieldKind: 'SELECT' },
      { id: 'held-out-case', label: 'Held-out case', prompt: 'What unseen case will challenge the frozen policy?', sourceSegment: 'clinic', fieldKind: 'SELECT' },
      { id: 'falsifier', label: 'Falsifier', prompt: 'What observation would make you abandon or revise the idea?', sourceSegment: 'transfer', fieldKind: 'SHORT-CLAUSE' },
    ],
    unseenDomainChoices: [
      { id: 'smart-farm', label: 'Smart farm', prompt: 'Map a send/wait decision to irrigation or sensor reporting.' },
      { id: 'hvac', label: 'HVAC', prompt: 'Map a threshold and hysteresis decision to room control.' },
      { id: 'edge-cache', label: 'Edge cache', prompt: 'Map batching and freshness to cache refresh.' },
      { id: 'logistics', label: 'Logistics', prompt: 'Map deadline-aware batching to a delivery queue.' },
    ],
    whatIfPrompt: 'A peer may ask one what-if. If no peer is ready, use the personal system what-if and revise once without waiting.',
    retrievalPrompts: [
      { id: 'low-w-vs-low-j', prompt: 'Which comparison keeps low W separate from low consumed J?', choices: ['read both columns under one service boundary', 'choose the lower W only', 'choose the higher bit/J only'] },
      { id: 'dynamic-policy', prompt: 'What makes a policy dynamic rather than a preset?', choices: ['state at decision time changes the frozen action', 'the screen animates', 'the label says AI'] },
      { id: 'prediction-vs-saving', prompt: 'What distinguishes prediction evidence from saving evidence?', choices: ['prediction score and plant/service replay are separate', 'accuracy is the energy result', 'future outcome is a legal feature'] },
    ],
    exportPrompt: 'Export the same workbook after the transfer fields are complete; incomplete workbooks remain reopenable and are labelled INCOMPLETE.',
  },
};

/** Plain-language learner scaffold for each of the eight fixed segments. */
export const C120_NOVICE_GUIDES: Readonly<Record<C120SegmentId, C120NoviceGuide>> = {
  'claim-detective': {
    question: { zhHant: '看到 W、J、bit/J 時，我能先說出哪個結論？', en: 'When I see W, J, and bit/J, what can I conclude?' },
    whatToDo: { zhHant: '先判斷三個說法，選定相同工作與期限，打開兩格證據，再改判一次。', en: 'Classify three claims, fix the same job and deadline, open two evidence slots, then revise one judgement.' },
    whatToNotice: { zhHant: 'W 是當下功率，J 是累積能量，bit/J 是每焦耳傳送的位元。先看服務是否達標。', en: 'W is power at an instant, J is accumulated energy, and bit/J is bits per joule. Check service first.' },
    whyItMatters: { zhHant: '只有在相同服務邊界下，省能量的說法才有意義。', en: 'A saving claim only has meaning when the service boundary is the same.' },
    recovery: { zhHant: '卡住時依序看工作、期限、邊界，再讀 W、J 與服務結果。', en: 'If you get stuck, return to the job, deadline, and boundary, then read W, J, and service.' },
  },
  'tle-anchor': {
    question: { zhHant: '這筆資料如何變成畫面上的時間和服務窗口？', en: 'How does this record become the time and service window you see?' },
    whatToDo: { zhHant: '匯入固定三行記錄，依序查看來源、模型窗口和課程假設。', en: 'Import the pinned three-line record, then open the source, model window, and course assumption in order.' },
    whatToNotice: { zhHant: 'TLE 提供軌道狀態，UTC 對齊時間。功率和能量不在 TLE 欄位裡。', en: 'A TLE supplies orbit state, UTC aligns time, and power and energy are not TLE fields.' },
    whyItMatters: { zhHant: '先固定資料身分，重播才不會混用不同情境。', en: 'Fix the data identity first so replays cannot mix scenarios.' },
    recovery: { zhHant: '匯入失敗時，用畫面提供的固定檔，不要換另一筆資料。', en: 'If import fails, use the pinned file shown here. Do not substitute another record.' },
  },
  'lab-a': {
    question: { zhHant: '同一份工作，低功率和快完成哪個會少用能量？', en: 'For the same job, does lower power or faster completion use less energy?' },
    whatToDo: { zhHant: '先跑參考，再選節奏，預測四項變化與信心，凍結後執行候選。', en: 'Run the reference, choose a pace, predict four changes and your confidence, then freeze before running the candidate.' },
    whatToNotice: { zhHant: '能量會累積功率在時間上的影響，閒置、固定成本和喚醒也要算進閱讀。', en: 'Energy accumulates power over time. Idle, fixed, and wake costs also leave evidence.' },
    whyItMatters: { zhHant: '它把低 W 和低 J 分開，同時保留服務期限。', en: 'It separates low W from low J while keeping the service deadline in view.' },
    recovery: { zhHant: '不知道選哪個時先重看參考或開一個提示；凍結前仍可改預測。', en: 'If you are unsure, reread the reference or open one hint. Predictions stay editable until freeze.' },
  },
  'lab-b': {
    question: { zhHant: '品質改善一次時，現在切換還是等穩定訊號？', en: 'When quality improves once, should you switch or wait for a stable signal?' },
    whatToDo: { zhHant: '先判斷 Trace A 下一狀態，設定門檻、連續次數和回切門檻，再凍結規則。', en: 'Choose Trace A’s next state, set the threshold, consecutive count, and return threshold, then freeze the rule.' },
    whatToNotice: { zhHant: 'threshold 觸發切換，hysteresis 用另一個回切門檻減少來回切換。', en: 'A threshold triggers a switch. Hysteresis uses another return threshold to reduce back-and-forth switching.' },
    whyItMatters: { zhHant: '規則必須只用當下資料也能執行，才有公平的保留測試。', en: 'The rule must run from current data alone for a fair held-out test.' },
    recovery: { zhHant: '規則難組時先載入教學模板，再逐項確認三個區塊。', en: 'If the rule is hard to build, load the teaching template and check its three blocks.' },
  },
  recovery: {
    question: { zhHant: '中途停下來時，怎麼從同一條因果鏈接著做？', en: 'If you stop midway, how do you continue from the same causal chain?' },
    whatToDo: { zhHant: '先存檢查點，再做兩個閉卷提取；真的需要時才記錄教師協助。', en: 'Save a checkpoint, complete two closed-book checks, and record instructor help only when needed.' },
    whatToNotice: { zhHant: '決策先改變狀態和時間，才留下 W、J、服務結果；checkpoint 保存這個順序。', en: 'A decision changes state and time before W, J, and service appear. The checkpoint preserves that order.' },
    whyItMatters: { zhHant: '復原是課程的一部分，讓你從同一份證據繼續，不是除錯。', en: 'Recovery is part of the course. It lets you continue from the same evidence, not debug the software.' },
    recovery: { zhHant: '不確定時重開工作簿，先找 state → time → power → J → service。', en: 'If unsure, reopen the workbook and find state → time → power → J → service first.' },
  },
  'lab-c': {
    question: { zhHant: '能源有限、窗口很短時，卡片何時送、批次、等待或睡眠？', en: 'When energy is limited and the window is short, when should cards send, batch, wait, or sleep?' },
    whatToDo: { zhHant: '先確認示範卡片的合法時槽，填好預測，查看 baseline，跑一次，再修正一次。', en: 'Confirm the worked card’s legal slot, complete the predictions, view the baseline, run once, then revise once.' },
    whatToNotice: { zhHant: '固定接觸和 outage 不能改，先守合法性與期限，再談省能量。', en: 'Fixed contact and outage cannot change. Protect legality and the deadline before discussing savings.' },
    whyItMatters: { zhHant: '這段把預測、第一次結果、修正和 held-out 事件分開。', en: 'This separates prediction, the first result, revision, and the held-out event.' },
    recovery: { zhHant: '排程超出選項時，載入有來源標示的合法形狀，再從那裡繼續。', en: 'If the schedule is outside the choices, load the labelled legal shape and continue from there.' },
  },
  clinic: {
    question: { zhHant: '預測分數高，真的代表動作省能量嗎？', en: 'Does a high prediction score really mean the action saves energy?' },
    whatToDo: { zhHant: '先按時間戳分類，寫預測和信心，凍結邊界與動作，再跑時間順序回放。', en: 'Classify by timestamp, record the prediction and confidence, freeze the boundary and action, then run the chronological replay.' },
    whatToNotice: { zhHant: 'held-out 結果在動作後才出現；feature leakage 會把答案偷帶進預測。', en: 'Held-out results appear after the action. Feature leakage carries the answer into the prediction.' },
    whyItMatters: { zhHant: '預測分數和服務、能量證據要分開，分數不能代替回放。', en: 'Prediction scores must stay separate from service and energy evidence. A score cannot replace replay.' },
    recovery: { zhHant: '拿不準時只看決策時間戳，不看卡片名稱；需要時開一個提示。', en: 'When unsure, use the decision-time timestamp, not the card name. Open one hint if needed.' },
  },
  transfer: {
    question: { zhHant: '如何把這套能量決策方法帶到另一個問題？', en: 'How can you carry this energy-decision method into another problem?' },
    whatToDo: { zhHant: '選一個未看過的領域，提取邊界、W/J、動態策略與預測證據，修正一次 what-if，再寫假說與反駁條件。', en: 'Choose an unseen domain, retrieve the boundary, W/J, dynamic policy, and prediction evidence, revise one what-if, then write a hypothesis and falsifier.' },
    whatToNotice: { zhHant: 'held-out 案例要在結果前寫下；反駁條件說明什麼觀察會改變你的想法。', en: 'Write the held-out case before seeing its result. A falsifier names the observation that would change your mind.' },
    whyItMatters: { zhHant: '最後留下的是可重開、可檢驗的決策卡，不是口號。', en: 'The result is a reopenable, testable decision card, not a slogan.' },
    recovery: { zhHant: '選項太多時先完成四個提取題，再回到一個 what-if；未完成欄位會保留。', en: 'If there are too many choices, complete the four retrieval checks first, then return to one what-if. Unfinished fields stay saved.' },
  },
} as const;

/**
 * Traditional Chinese copy for the authored fields that are exposed by the
 * learner panels.  Unknown provider values intentionally pass through: IDs,
 * units, and provider payloads are stable evidence, not translatable claims.
 */
const C120_TEACHING_TEXT_ZH_HANT: Readonly<Record<string, string>> = {
  'A has lower average power; B finishes sooner; C has higher bit/J but misses the deadline. Which claim is actually energy-saving?': 'A 的平均功率較低；B 更快完成；C 的 bit/J 較高卻錯過期限。哪個主張真的代表省能量？',
  'Worked trace: two time slots, one fixed boundary': '示範追蹤：兩個時槽、一道固定邊界',
  'The values are an authored teaching example. Read power, accumulated energy, delivered service and the boundary as separate columns.': '這些數值是編寫的教學例子。請把功率、累積能量、已交付服務和邊界分成不同欄位閱讀。',
  'reveal consumed J': '揭露消耗 J',
  'reveal completion time': '揭露完成時間',
  'reveal service and deadline badge': '揭露服務與期限標記',
  'allow one re-judgement': '允許重新判斷一次',
  'After the evidence opens, may your first claim change? Record one revised decision and the reason for the boundary.': '證據打開後，第一次主張可以改變嗎？請記下一次修正與邊界理由。',
  'W is a power column; J is consumed energy; bit/J is a provider-owned service ratio. Keep units visible.': 'W 是功率欄；J 是消耗能量；bit/J 是 provider 擁有的服務比例。請保留單位。',
  'Fast branch: change the boundary, not the data': '快速分支：改變邊界，不改變資料',
  'What changes when the deadline is different but the two authored traces stay the same?': '兩條編寫的追蹤不變、期限改變時，什麼會改變？',
  'The same numbers can move from comparable to incomparable; lowering the service requirement is not a legal saving.': '同一組數字可能從可比較變成不可比較；降低服務要求不是合法的節省。',
  'Which part of the NTPU display is source data, model-derived state, or a course assumption?': 'NTPU 畫面上的哪一部分是來源資料、模型推導狀態或課程假設？',
  'Import the pinned offline source': '匯入固定的離線來源',
  'Use the bundled offline record once. Do not download or upload another source; the next lab must display this same scenario ID.': '使用隨附的離線紀錄一次即可。不要下載或上傳其他來源；下一個實驗必須顯示同一個 scenario ID。',
  'Pinned source': '固定來源',
  'NTPU service window': 'NTPU 服務窗口',
  'Course traffic and power assumption': '課程流量與功率假設',
  'Inspect source label and source epoch UTC.': '查看來源標籤與來源 epoch UTC。',
  'Open the target UTC, observer and visibility cards.': '打開目標 UTC、觀測者和可見性卡片。',
  'Choose which send/wait interval is inside the displayed window.': '選擇哪個傳送／等待區間位於顯示的窗口內。',
  'This record is the offline input; it is not measured.': '這筆紀錄是離線輸入，不是量測值。',
  'The scene/window is a provider replay product derived for this teaching scenario.': '場景／窗口是為本教學情境推導出的 provider 回放產品。',
  'Traffic, power and energy evidence are course fixtures added after the source/window stages.': '流量、功率與能量證據是來源／窗口階段後加入的課程 fixture。',
  'Progressive technical details': '逐步查看技術細節',
  'Which action is inside the displayed service window?': '哪個動作位於顯示的服務窗口內？',
  'Send inside the window': '在窗口內傳送',
  'Wait outside the window': '在窗口外等待',
  'The provider can compare this action against the fixed service boundary.': 'provider 可以在固定服務邊界下比較這個動作。',
  'The service gate is constrained by the same scenario window.': '服務門檻仍受同一情境窗口限制。',
  'With the same payload and deadline, does lower instantaneous power always mean lower consumed energy?': '相同 payload 與期限下，較低的瞬時功率一定代表較低的消耗能量嗎？',
  'Worked example: active, fixed and idle are separate rows': '示範例子：主動、固定與閒置是不同列',
  'This example teaches the pathway without exposing the later candidate winner.': '這個例子教你看路徑，但不先揭露後面的候選勝者。',
  'A low-power tail can still matter because it occupies time; check service before ranking.': '低功率尾段仍可能重要，因為它佔用時間；排名前先檢查服務。',
  'Which column is an instantaneous system level?': '哪一欄是瞬時系統量？',
  'Which column accumulates the run?': '哪一欄會累積整次執行？',
  'Run the provider-owned reference first; compare the same timeline columns before choosing a candidate.': '先執行 provider 擁有的參考回放；選候選前先比較相同時間欄位。',
  'Choose one candidate. Its choice is sent to a hidden fixed/idle/wakeup replay and cannot be replaced by a cosmetic preset.': '選一個候選。選擇會送進隱藏的固定／閒置／喚醒回放，不能用外觀預設取代。',
  'Negative control: same service boundary': '負控制：相同服務邊界',
  'Re-run the same payload/deadline boundary with the candidate held constant; use it to check that the observed change is attributable to the authored condition.': '固定候選，重新執行相同 payload／期限邊界；用它確認觀察到的變化確實來自編寫的條件。',
  'First compare active time and the sleep interval.': '先比較主動時間和睡眠區間。',
  'Then inspect the fixed/idle rows in the evidence ledger.': '再查看證據帳本中的固定／閒置列。',
  'Finally check service_pass and deadline before reading bit/J.': '最後先檢查 service_pass 與 deadline，再讀 bit/J。',
  'If the fixed idle cost is changed in the next authored fixture, does your ranking reverse?': '如果下一個編寫 fixture 改變固定閒置成本，你的排名會反轉嗎？',
  'A ranking can reverse when the operating-cost condition changes; that is a counterexample, not a universal law.': '運作成本條件改變時排名可能反轉；這是反例，不是普遍定律。',
  'When a candidate looks better, should a controller switch now or wait for a stable trend?': '候選看起來更好時，控制器要立刻切換，還是等待穩定趨勢？',
  'Worked thermostat trace: state changes after evidence, not after hindsight': '示範恆溫器追蹤：狀態依證據改變，不依事後答案改變',
  'The five rows are a familiar control analogy; they do not claim a commercial handover standard.': '這五列使用熟悉的控制類比；它們不宣稱任何商用 handover 標準。',
  'On Trace A, what is your first action before seeing the later trend?': '在看到後續趨勢前，你在 Trace A 的第一個動作是什麼？',
  'Wait for one more event': '再等待一個事件',
  'IF quality reaches threshold for N consecutive steps THEN switch ELSE remain; use the chosen lower threshold before switching back.': '若品質連續 N 個步驟達到門檻，則切換；否則保持；切回前使用選定的較低門檻。',
  'Trace B changes only the future quality trend after the rule is frozen.': 'Trace B 只在規則凍結後改變未來品質趨勢。',
  'Run the frozen rule without retuning; record state, service, switching, W and J together.': '不重新調參，直接執行凍結規則；一起記錄狀態、服務、切換、W 和 J。',
  'Which changed quality trend would make a switch-now rule fail?': '哪一種品質趨勢改變會讓「立刻切換」規則失效？',
  'A quality dip after switching can add switching or service cost; fewer switches alone do not prove lower energy.': '切換後品質下降可能增加切換或服務成本；只看切換較少不能證明能量較低。',
  'With a finite energy budget and short contact window, when should urgent, periodic and bulk cards send, batch, wait or sleep?': '在有限能量預算和短接觸窗口下，緊急、週期與大量卡片何時應傳送、批次、等待或睡眠？',
  'Worked data-card example: generated → sent → received': '示範資料卡：產生 → 傳送 → 收到',
  'Which slot is legal for urgent card U1 in the worked example?': '示範例子中，緊急卡片 U1 的合法時槽是哪個？',
  'The card can be delivered inside the same window while preserving its deadline and freshness labels.': '卡片可以在同一窗口內送達，同時保留期限與新鮮度標籤。',
  'Urgent first, then sleep': '先送緊急卡，再睡眠',
  'Batch periodic cards': '把週期卡片批次處理',
  'Revision shape R': '修正版型 R',
  'Fixed contact and fixed outage slots cannot be edited.': '固定接觸與固定 outage 時槽不能編輯。',
  'An urgent card cannot be dropped silently; an illegal slot explains its deadline or window conflict.': '緊急卡片不能靜默丟棄；不合法時槽會說明期限或窗口衝突。',
  'Run once, revise once, then freeze before the withheld event is revealed.': '執行一次、修正一次，然後在揭露保留事件前凍結。',
  'Autofill is scaffolded practice and keeps its provenance in the workbook.': '自動填入是有腳手架的練習，來源會保留在工作簿中。',
  'One learner revision is permitted. After freeze, one authored held-out event runs without retuning.': '允許學習者修正一次。凍結後會不重新調參地執行一個編寫的 held-out 事件。',
  'If a surprise urgent card arrives after freeze, which service constraint can change your judgement?': '凍結後出現驚喜緊急卡片時，哪個服務限制會改變你的判斷？',
  'A higher bit/J does not license calling a mission successful when the urgent service or deadline fails.': '即使 bit/J 較高，緊急服務或期限失敗時，也不能宣稱任務成功。',
  'Does a higher prediction score prove that a control action saves energy?': '預測分數較高，能證明控制動作省能量嗎？',
  'Worked feature card: timestamp before label': '示範特徵卡：先看時間戳，再看標籤',
  'Quality and freshness snapshot available before the action.': '品質與新鮮度快照在動作前可用。',
  'Delivered result and service outcome appear after the action and stay held out.': '交付結果與服務結果在動作後出現，並保持為 held-out。',
  'Before operational replay, which action do you predict will protect the service gate?': '在操作回放前，你預測哪個動作能保護服務門檻？',
  'Prediction score is recorded in its own evidence block.': '預測分數記錄在自己的證據區塊。',
  'The frozen action replay separately records service_pass, freshness, deadline, consumed J and delivered bits.': '凍結動作的回放另外記錄 service_pass、freshness、deadline、消耗 J 和 delivered bits。',
  'A score is not a measurement and is not inserted into the energy evidence.': '分數不是量測值，也不會放進能量證據。',
  'Open the timestamp tooltip before classifying the card.': '分類卡片前先打開時間戳提示。',
  'Ask whether the row existed before the action was frozen.': '先問這一列是否在動作凍結前已存在。',
  'Use the fixed honest fallback when the feature boundary is unclear.': '特徵邊界不清楚時，使用固定的誠實 fallback。',
  'Would the same decision-time rule survive a new held-out weather pattern?': '同一條決策時間規則能通過新的 held-out 天氣模式嗎？',
  'A distribution shift can change the held-out control result without changing the feature labels; record the limitation.': '分布轉移可能在特徵標籤不變時改變 held-out 控制結果；請記下限制。',
  'Which energy decision mechanism can become a measurable, falsifiable competition question outside LEO?': '哪個能量決策機制可以在 LEO 之外變成可量測、可反駁的競賽問題？',
  'Smart greenhouse': '智慧溫室',
  'Example fixture: irrigation valve with a fixed freshness window': '示範 fixture：具有固定新鮮度窗口的灌溉閥',
  'This is a format example from another fixture; it is not the answer to the learner’s chosen domain.': '這是另一個 fixture 的格式示例，不是學習者所選領域的答案。',
  'What is the current operating policy?': '目前的運作策略是什麼？',
  'What decision-time state is observed?': '決策時刻觀察到什麼狀態？',
  'What action can the learner freeze?': '學習者可以凍結什麼動作？',
  'Which active, fixed, idle or wake pathway changes?': '哪一條主動、固定、閒置或喚醒路徑改變？',
  'What is held fixed and which units remain visible?': '什麼保持固定，哪些單位要保留？',
  'What deadline, freshness or service gate cannot be traded away?': '哪個期限、新鮮度或服務門檻不能拿來交換？',
  'What unseen case will challenge the frozen policy?': '哪個未見案例會挑戰凍結策略？',
  'What observation would make you abandon or revise the idea?': '什麼觀察會讓你放棄或修正這個想法？',
  'Map a send/wait decision to irrigation or sensor reporting.': '把傳送／等待決策對應到灌溉或感測器回報。',
  'Map a threshold and hysteresis decision to room control.': '把門檻與遲滯決策對應到房間控制。',
  'Map batching and freshness to cache refresh.': '把批次與新鮮度對應到快取更新。',
  'Map deadline-aware batching to a delivery queue.': '把期限感知的批次處理對應到配送佇列。',
  'A peer may ask one what-if. If no peer is ready, use the personal system what-if and revise once without waiting.': '同伴可能提出一個 what-if；若同伴尚未準備好，就用自己的系統 what-if，不必等待也修正一次。',
  'Export the same workbook after the transfer fields are complete; incomplete workbooks remain reopenable and are labelled INCOMPLETE.': '完成 transfer 欄位後匯出同一份工作簿；未完成的工作簿仍可重開，並標記為 INCOMPLETE。',
  'Active transfer': '主動傳送',
  'Fixed/idle tail': '固定成本／閒置尾段',
  'authored row: 320 J': '編寫列：320 J',
  'authored row: 112 J': '編寫列：112 J',
  'Pace to idle': '逐步降到閒置',
  'Balanced pace': '平衡節奏',
  'Burst then sleep': '突發傳送後睡眠',
  'How long the transfer remains active.': '傳送維持主動狀態多久。',
  'A bounded system cost that remains in the authored replay.': '編寫回放中保留的有界系統成本。',
  'A cost carried while waiting or sleeping transition is not free.': '等待或睡眠轉換期間仍會承擔成本，不是免費的。',
  'A wake event is tracked separately from power and service.': '喚醒事件會與功率和服務分開追蹤。',
  'I chose ______, which changed ______; its power-time pathway ______, so when service_pass is ______ the consumed J is ______ and bit/J is ______; it fails if ______.': '我選擇 ______，它改變了 ______；功率－時間路徑是 ______，所以 service_pass 為 ______ 時，消耗 J 是 ______、bit/J 是 ______；若 ______ 就會失效。',
  'Would a one-step improvement be enough to switch?': '改善一步就足以切換嗎？',
  'Would you wait for another steady observation?': '你會再等待一次穩定觀察嗎？',
  'If the high band persists, what is the next serving state?': '如果高區間持續，下一個服務狀態是什麼？',
  'Would the lower threshold permit an immediate return?': '較低門檻允許立即返回嗎？',
  'Record the next state before revealing the outcome row.': '在揭露結果列前，先記錄下一個狀態。',
  'Remain on the current state': '保持目前狀態',
  'Low band': '低區間',
  'Steady band': '穩定區間',
  'High band': '高區間',
  'N = 1': 'N = 1',
  'one observed step': '一個觀察步驟',
  'N = 2': 'N = 2',
  'two consecutive steps': '連續兩個步驟',
  'N = 3': 'N = 3',
  'three consecutive steps': '連續三個步驟',
  'same lower threshold': '相同的較低門檻',
  'return at the same band': '在相同區間返回',
  'one band lower': '低一個區間',
  'return only after one lower band': '只有低一個區間後才返回',
  'two bands lower': '低兩個區間',
  'return only after two lower bands': '只有低兩個區間後才返回',
  'Rewind exactly one event and make the alternate decision.': '正好倒帶一個事件，做出替代決策。',
  'Reveal the next state only; future outcome rows stay hidden.': '只揭露下一個狀態；未來結果列保持隱藏。',
  'Open the known-good trace to inspect the rule shape, not the withheld answer.': '打開已知良好追蹤來查看規則形狀，不看保留答案。',
  'Urgent alert · card U1': '緊急警示 · 卡片 U1',
  'fresh through t = 48 s': '到 t = 48 s 前保持新鮮',
  'small payload': '小型 payload',
  't = 0-150 s with fixed outage at t = 90 s': 't = 0-150 s，t = 90 s 有固定中斷',
  'slot 2 or slot 5 before the deadline': '期限前的時槽 2 或時槽 5',
  'generated at t = 12 s': '在 t = 12 s 產生',
  'sent at t = 20 s': '在 t = 20 s 傳送',
  'received at t = 32 s': '在 t = 32 s 收到',
  'service_pass': 'service_pass',
  'unknown': '未知',
  'fresh': '新鮮',
  'expired': '過期',
  'wake count': '喚醒次數',
  'consumed J': '消耗 J',
  'budget remaining': '剩餘預算',
  'Provider baseline: urgent cards are sent before the fixed outage; bulk uses the later legal slot.': 'Provider baseline：緊急卡在固定中斷前傳送；大量卡使用較晚的合法時槽。',
  'First learner run: the periodic batch meets the visible slot contract; the evaluation condition stays hidden until freeze.': '學習者第一次執行：週期批次符合可見時槽契約；評估條件在凍結前保持隱藏。',
  'This provider-supported revision may be loaded after the first run; the held-out event remains hidden until freeze.': '第一次執行後可以載入這個 provider 支援的修正版；保留事件在凍結前保持隱藏。',
  'The same schedule meets a shorter window only if its legal service boundary remains satisfied.': '同一排程只有在仍符合合法服務邊界時，才能通過較短窗口。',
  'A new urgent card arrives after freeze; read service and budget separately.': '凍結後出現新的緊急卡；請分開閱讀服務與預算。',
  'System runs the authored send-immediately baseline.': '系統執行編寫的立即傳送 baseline。',
  'AUTO · baseline replay': '自動 · baseline 回放',
  'One legal schedule is prefilled for recovery practice.': '預先填入一個合法排程供復原練習。',
  'SCAFFOLD · autofill provenance': '腳手架 · 自動填入來源',
  'Only bounded legal actions for the current slot are offered.': '目前時槽只提供有界的合法動作。',
  'SELECT · bounded course choices': '選擇 · 有界課程選項',
  'Card C · observed state row': '卡片 C · 觀察到的狀態列',
  'Classify by timestamp and action order.': '依時間戳與動作順序分類。',
  'Card A · state snapshot': '卡片 A · 狀態快照',
  'Card B · timestamped event row': '卡片 B · 有時間戳的事件列',
  'Is this row available before the decision?': '這一列在決策前可用嗎？',
  'Card C · quality snapshot': '卡片 C · 品質快照',
  'Classify without reading a future result.': '不讀未來結果就完成分類。',
  'Card D · follow-up row': '卡片 D · 後續列',
  'Compare this timestamp with the decision marker.': '把這個時間戳和決策標記比較。',
  'Card E · closing row': '卡片 E · 收尾列',
  'Classify from chronology before reading its meaning.': '先依時間順序分類，再閱讀它的意義。',
  'Action P': '動作 P',
  'Apply policy P using the frozen feature boundary.': '使用凍結的特徵邊界套用 P 策略。',
  'Action Q': '動作 Q',
  'Apply policy Q using the same frozen feature boundary.': '使用相同的凍結特徵邊界套用 Q 策略。',
  'Run the valve at the existing schedule.': '依現有排程執行閥門。',
  'Use soil-moisture snapshot before each decision.': '每次決策前使用土壤濕度快照。',
  'Batch one irrigation request or wait.': '把一個灌溉請求批次處理，或等待。',
  'Valve active time plus fixed wake/idle rows.': '閥門主動時間，加上固定喚醒／閒置列。',
  'Same plot, same window, W and J columns.': '相同地塊、相同窗口、W 與 J 欄。',
  'Keep soil freshness inside the agreed window.': '讓土壤新鮮度維持在約定窗口內。',
  'A new weather card arrives after the policy freezes.': '策略凍結後出現新的天氣卡片。',
  'The schedule misses freshness without a compensating service result.': '排程錯過新鮮度，且沒有補償性的服務結果。',
  'Which comparison keeps low W separate from low consumed J?': '哪一種比較會把低 W 與低消耗 J 分開？',
  'read both columns under one service boundary': '在同一服務邊界下讀兩欄',
  'choose the lower W only': '只選較低 W',
  'choose the higher bit/J only': '只選較高 bit/J',
  'What makes a policy dynamic rather than a preset?': '什麼讓策略是動態的，而不是預設值？',
  'state at decision time changes the frozen action': '決策時刻的狀態改變凍結動作',
  'the screen animates': '畫面會動',
  'the label says AI': '標籤寫著 AI',
  'What distinguishes prediction evidence from saving evidence?': '什麼區分預測證據與節省證據？',
  'prediction score and plant/service replay are separate': '預測分數與操作／服務回放是分開的',
  'accuracy is the energy result': '準確度就是能量結果',
  'future outcome is a legal feature': '未來結果是合法特徵',
};

export function localizeC120TeachingText(value: string, locale: 'zh-Hant' | 'en'): string {
  return locale === 'en' ? value : C120_TEACHING_TEXT_ZH_HANT[value] ?? value;
}

export const C120_TEACHING_CONTENT_IDS = Object.freeze({
  scenarioId: C120_SCENARIO_ID,
  fixtureVersion: C120_FIXTURE_VERSION,
  tleSourceId: C120_TLE_SOURCE_ID,
  targetUtc: C120_TARGET_UTC,
} as const);

/** Return the exact response ceiling without letting callers mutate the authored list. */
export function getC120ConstructedResponseDefinitions(): readonly C120ConstructedResponseDefinition[] {
  return C120_CONSTRUCTED_RESPONSE_DEFINITIONS;
}

/**
 * A small content-level guard for consumers that bind a provider scenario to
 * the teaching copy. It intentionally checks identity only; it does not
 * manufacture replay values or calculate any scientific metric.
 */
export function assertC120TeachingScenarioId(scenarioId: string): asserts scenarioId is typeof C120_SCENARIO_ID {
  if (scenarioId !== C120_SCENARIO_ID) {
    throw new Error(`C-120 teaching content scenario mismatch: expected ${C120_SCENARIO_ID}`);
  }
}

void C120_CONSTRUCTED_RESPONSE_KEYS;
