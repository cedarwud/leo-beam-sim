import { existsSync, readFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';

import { loadShowcaseArtifact } from '../src/showcase/loadShowcaseArtifact';
import type { VisualShowcaseArtifact } from '../src/scene/visual-showcase-contract';

export const PINNED_VISUAL_SHOWCASE_ARTIFACT_PATH =
  '/home/u24/papers/modqn-paper-reproduction/artifacts/phase-01h-mp5-visual-showcase-cli-smoke-2026-05-22/visual-showcase-v1.json';

export const PINNED_VISUAL_SHOWCASE_ARTIFACT_SHA256 =
  '0cfaf33e6b788e0722249dba12a7615275b0e3c6ee346662b2429b104ed383ef';

export interface VisualShowcaseValidatorArtifactSource {
  readonly kind: 'external' | 'synthetic';
  readonly label: string;
  readonly path: string | null;
  readonly isPinnedTrigger: boolean;
}

export interface VisualShowcaseValidatorArtifact {
  readonly artifact: VisualShowcaseArtifact;
  readonly json: unknown;
  readonly rawText: string;
  readonly rawBytes: Buffer;
  readonly source: VisualShowcaseValidatorArtifactSource;
}

const TIME_COUNT = 61;
const SATELLITE_COUNT = 4;
const BEAMS_PER_SATELLITE = 7;
const UE_COUNT = 100;
const TIMES_SEC = Array.from({ length: TIME_COUNT }, (_, i) => i);

function beamId(satIndex: number, beamIndex: number): string {
  return `sat-${satIndex}-beam-${beamIndex}`;
}

function buildTruthRecord(note: string, channelMetricKind?: 'snr-no-interference') {
  return {
    owner: 'synthetic-validator-fixture' as const,
    sourceArtifacts: ['synthetic-validator-visual-showcase-v1'],
    sourcePaths: ['scripts/visualShowcaseValidatorFixture.ts'],
    note,
    ...(channelMetricKind
      ? {
          channelMetricKind,
          channelMetricFormula: 'synthetic validator SNR values; renderer must not recompute',
        }
      : {}),
  };
}

function selectedActionIndexForFrame(frameIndex: number): number {
  return frameIndex === 0 ? 1 : 0;
}

function actionScoresForFrame(frameIndex: number): number[] {
  const selectedActionIndex = selectedActionIndexForFrame(frameIndex);
  return Array.from({ length: SATELLITE_COUNT * BEAMS_PER_SATELLITE }, (_, i) => {
    if (i === selectedActionIndex) return 0.9;
    if (i === 2) return 0.7;
    return 0.4 - i * 0.001;
  });
}

function selectedScoreForFrame(frameIndex: number): number {
  const selectedActionIndex = selectedActionIndexForFrame(frameIndex);
  return actionScoresForFrame(frameIndex)[selectedActionIndex] ?? 0;
}

function runnerUpScoreForFrame(frameIndex: number): number {
  return Math.max(
    ...actionScoresForFrame(frameIndex).filter((_, i) => i !== selectedActionIndexForFrame(frameIndex)),
  );
}

export function createSyntheticVisualShowcaseArtifact(): VisualShowcaseArtifact {
  const satellites = Array.from({ length: SATELLITE_COUNT }, (_, satIndex) => ({
    id: `sat-${satIndex}`,
    sourceId: `synthetic-sat-${satIndex}`,
    label: `S${satIndex + 1}`,
    shellId: 'modqn-baseline-leo',
    roleHints: satIndex === 0 ? ['serving'] : ['context'],
  }));

  const ues = Array.from({ length: UE_COUNT }, (_, ueIndex) => ({
    id: `ue-${String(ueIndex).padStart(3, '0')}`,
    sourceId: `synthetic-ue-${ueIndex}`,
    label: `UE ${ueIndex + 1}`,
    trajectoryKind: 'validator-grid-drift',
  }));

  const beams = satellites.flatMap((sat, satIndex) =>
    Array.from({ length: BEAMS_PER_SATELLITE }, (_, beamIndex) => ({
      id: beamId(satIndex, beamIndex),
      sourceId: `synthetic-${beamId(satIndex, beamIndex)}`,
      satelliteId: sat.id,
      localBeamIndex: beamIndex,
      label: `S${satIndex + 1} B${beamIndex + 1}`,
      frequencyReuseGroup: null,
      frequencyReuseProvenance: {
        source: 'synthetic-validator-fixture',
        note: 'frequency reuse is paper-unspecified in this validator fixture',
        displayOnly: true,
        policy: 'paper-unspecified',
      },
      halfAngleDeg: 1.7,
    })),
  );

  const timeline = TIMES_SEC.map((tSec, frameIndex) => {
    const isSwitchFrame = frameIndex === 0;
    const servingBeamId = isSwitchFrame ? beamId(0, 3) : beamId(0, 1);
    const targetBeamId = isSwitchFrame ? beamId(0, 1) : null;
    const actionIndex = selectedActionIndexForFrame(frameIndex);
    const selectedActionScore = selectedScoreForFrame(frameIndex);
    const runnerUpActionScore = runnerUpScoreForFrame(frameIndex);

    return {
      tSec,
      sourceRefs: {
        sourceSlotIndex: frameIndex,
        sources: [
          {
            sourceArtifactId: 'synthetic-validator-visual-showcase-v1',
            sourcePath: 'scripts/visualShowcaseValidatorFixture.ts',
            sourceSlotIndex: frameIndex,
          },
        ],
      },
      satellites: satellites.map((sat, satIndex) => {
        const theta = (2 * Math.PI * (frameIndex / TIME_COUNT)) + (satIndex * Math.PI) / 2;
        return {
          id: sat.id,
          positionEcefKm: [
            7000 * Math.cos(theta),
            120 + 25 * satIndex,
            7000 * Math.sin(theta),
          ] as [number, number, number],
          coordinateFrameKind: 'eci-km-no-earth-rotation-proxy' as const,
          positionProvenance: {
            source: 'synthetic-validator-fixture',
            note: 'validator-only ECI proxy positions; no Earth-rotation compensation',
            policy: 'eci-km-no-earth-rotation-proxy',
          },
          geo: {
            latDeg: 40 + satIndex * 0.2,
            lonDeg: 116 + satIndex * 0.3 + frameIndex * 0.01,
            altKm: 550,
          },
          visible: true,
          displayRole: satIndex === 0 ? 'serving' : 'context',
        };
      }),
      ues: ues.map((ue, ueIndex) => {
        const row = Math.floor(ueIndex / 10);
        const col = ueIndex % 10;
        const latDeg = 39.75 + row * 0.01 + frameIndex * 0.00008;
        const lonDeg = 115.75 + col * 0.012 + frameIndex * 0.00008;
        return {
          id: ue.id,
          geo: { latDeg, lonDeg, altKm: 0 },
          servingSatelliteId: 'sat-0',
          servingBeamId,
          targetSatelliteId: targetBeamId ? 'sat-0' : null,
          targetBeamId,
          sinrDb: 18 - (ueIndex % 6) * 0.25,
          candidateSinrDbByBeamId: {
            [beamId(0, 1)]: 18.5,
            [beamId(0, 3)]: 17.2,
            [beamId(1, 1)]: 14.1,
          },
          decisionRef: `decision-${frameIndex}-${ue.id}`,
        };
      }),
      beams: beams.map((beam) => ({
        id: beam.id,
        satelliteId: beam.satelliteId,
        role:
          beam.id === servingBeamId
            ? 'serving' as const
            : beam.id === targetBeamId
              ? 'prepared' as const
              : 'context' as const,
        center: {
          latDeg: 40 + beam.localBeamIndex * 0.025,
          lonDeg: 116 + Number(beam.satelliteId.split('-')[1]) * 0.04,
          altKm: 0,
        },
        footprintKm: 16,
        gainDb: null,
        gainProvenance: {
          source: 'synthetic-validator-fixture',
          note: 'display-only gain omitted; renderer must not infer link budget',
          displayOnly: true,
          policy: 'not-promoted',
        },
      })),
      links: [
        {
          id: `link-${frameIndex}`,
          sourceId: 'sat-0',
          targetId: 'ue-000',
          beamId: servingBeamId,
          role: 'serving',
          sinrDb: 18,
        },
      ],
      handoverState: {
        kind: isSwitchFrame ? 'intra-satellite-beam-switch' : 'none',
        phase: isSwitchFrame ? 'committed' : 'idle',
        phaseSource: isSwitchFrame ? 'visual-policy' as const : 'source' as const,
        sourceHandoverOccurred: isSwitchFrame,
        handoverProvenance: {
          source: 'synthetic-validator-fixture',
          note: 'validator-only producer handover kind; consumer must pass it through',
          policy: 'synthetic-validator-fixture',
        },
        servingSatelliteId: 'sat-0',
        servingBeamId,
        targetSatelliteId: targetBeamId ? 'sat-0' : null,
        targetBeamId,
      },
      metrics: {
        primarySinrDb: 18,
        servingSinrDb: 18,
        candidateSinrDbByBeamId: {
          [beamId(0, 1)]: 18.5,
          [beamId(0, 3)]: 17.2,
          [beamId(1, 1)]: 14.1,
        },
        servingSatelliteId: 'sat-0',
        servingBeamId,
        throughputMbps: 110 + frameIndex * 0.1,
        rewardScalar: 1 - frameIndex * 0.001,
        rewardVector: {
          throughput: 0.8,
          handover: isSwitchFrame ? 0.2 : 1,
          loadBalance: 0.5,
        },
      },
      modqnDecision: {
        actionIndex,
        actionLabel: isSwitchFrame ? 'switch to sat-0 beam-1' : 'stay on sat-0 beam-1',
        previousSatelliteId: 'sat-0',
        previousBeamId: isSwitchFrame ? beamId(0, 3) : beamId(0, 1),
        selectedSatelliteId: 'sat-0',
        selectedBeamId: beamId(0, 1),
        validActionCount: 28,
        selectedActionScore,
        runnerUpActionScore,
        scoreMargin: selectedActionScore - runnerUpActionScore,
        decisionActionValidityMask: Array.from({ length: 28 }, () => true),
        diagnosticsRef: `decision-${frameIndex}-ue-000`,
      },
    };
  });

  const actionScoresValues = TIMES_SEC.map((_, frameIndex) => actionScoresForFrame(frameIndex));

  return {
    schemaVersion: 'visual-showcase-v1',
    artifactId: 'synthetic-validator-visual-showcase-v1',
    scenario: {
      id: 'synthetic-validator-modqn-multi-ue',
      profile: 'modqn-multi-ue',
      title: 'Synthetic Validator MODQN Multi-UE Replay',
      description: 'Repo-local validator fallback used only when the pinned producer artifact is unavailable.',
      durationSec: 60,
      defaultStartSec: 0,
      defaultPlaybackSpeed: 1,
      coordinateFrame: 'eci-km-no-earth-rotation-proxy',
      storyKind: 'modqn-handover-baseline',
      truthMode: 'synthetic-validator-fixture',
    },
    provenance: {
      generatedAt: '2026-05-28T00:00:00.000Z',
      producer: {
        name: 'leo-beam-sim',
        mode: 'synthetic-validator-fixture',
      },
      sourceRepos: [
        {
          repoId: 'ntn-sim-core',
          path: '/home/u24/papers/ntn-sim-core',
          commit: 'fixture:ntn-sim-core-validator',
        },
        {
          repoId: 'modqn-paper-reproduction',
          path: '/home/u24/papers/modqn-paper-reproduction',
          commit: 'fixture:modqn-paper-reproduction-validator',
        },
        {
          repoId: 'leo-beam-sim',
          path: '/home/u24/papers/project/leo-beam-sim',
          commit: 'fixture:leo-beam-sim-validator',
        },
      ],
      ntnSimCoreCommit: 'fixture:ntn-sim-core-validator',
      modqnPaperReproductionCommit: 'fixture:modqn-paper-reproduction-validator',
      sourceCommits: {
        'ntn-sim-core': 'fixture:ntn-sim-core-validator',
        'modqn-paper-reproduction': 'fixture:modqn-paper-reproduction-validator',
        'leo-beam-sim': 'fixture:leo-beam-sim-validator',
      },
      sourceArtifactIds: ['synthetic-validator-visual-showcase-v1'],
      sourceArtifacts: [
        {
          id: 'synthetic-validator-visual-showcase-v1',
          repoId: 'leo-beam-sim',
          path: 'scripts/visualShowcaseValidatorFixture.ts',
          role: 'validator-only fallback visual-showcase-v1 artifact',
          truthFields: ['sinr', 'handover', 'modqnAction', 'reward', 'geometry', 'provenance', 'series', 'display'],
        },
      ],
      sourceSchemas: [
        {
          id: 'visual-showcase-v1',
          version: 'v1.1',
          role: 'consumer contract',
          path: 'ntn-sim-core/src/core/contracts/visual-showcase-v1.ts',
        },
      ],
      validation: {
        validator: 'leo-beam-sim synthetic fixture construction',
        status: 'validator-only',
        checkedAt: '2026-05-28T00:00:00.000Z',
        notes: ['Used only when the pinned producer artifact path is absent.'],
      },
      claimBoundary: {
        storyKind: 'modqn-handover-baseline',
        allowedClaims: ['baseline MODQN multi-UE replay artifact'],
        forbiddenClaims: [
          'Multi-Catfish not promoted',
          'Catfish-EE blocked',
          'old EE-MODQN blocked',
          'learned association blocked',
          'HOBS optimizer behavior not claimed',
          'physical energy saving not claimed',
          'full RA-EE-MODQN blocked',
          'do not claim live SINR recomputation',
        ],
        source: 'synthetic-validator-fixture',
      },
      evidenceStatus: {
        status: 'baseline',
        notes: ['synthetic validator fixture; not a research result'],
      },
      assumptions: [
        {
          id: 'synthetic-fixture-only',
          description: 'This artifact proves consumer replay wiring only and is not a promoted producer result.',
        },
      ],
    },
    truthOwnership: {
      sinr: buildTruthRecord('synthetic SNR samples owned by fixture', 'snr-no-interference'),
      handover: buildTruthRecord('handover kind is fixture-owned and must be passed through'),
      modqnAction: buildTruthRecord('MODQN action fields are fixture-owned and must be passed through'),
      reward: buildTruthRecord('reward values are fixture-owned and must be passed through'),
      geometry: buildTruthRecord('geometry samples are fixture-owned display inputs'),
      provenance: buildTruthRecord('provenance is fixture-owned metadata'),
      series: buildTruthRecord('series are fixture-owned timeline projections'),
      display: {
        ...buildTruthRecord('display hints are fixture-owned metadata'),
        sourcePaths: ['displayHints'],
      },
    },
    timebase: {
      sampleHz: 1,
      startEpochIso: '2026-05-28T00:00:00.000Z',
      timesSec: TIMES_SEC,
      timeMode: 'deterministic-validator-timeline',
      sourceTimeOffsetSec: 0,
      sourceSlotIndexBySample: TIMES_SEC,
    },
    entities: {
      satellites,
      ues,
      beams,
      shell: {
        altitudeKm: 550,
        antennaBeamwidth3dBRad: 0.058,
      },
    } as VisualShowcaseArtifact['entities'] & {
      shell: { altitudeKm: number; antennaBeamwidth3dBRad: number };
    },
    timeline,
    events: [
      {
        id: 'event-intra-switch-0',
        type: 'handover-committed',
        tSec: 0,
        title: 'Synthetic intra-satellite beam switch',
        entityRefs: ['sat-0', beamId(0, 3), beamId(0, 1)],
        truthRefs: ['synthetic-validator-visual-showcase-v1'],
      },
      {
        id: 'event-rl-action-0',
        type: 'rl-action',
        tSec: 0,
        title: 'Synthetic RL action selected',
        entityRefs: ['ue-000', 'sat-0', beamId(0, 1)],
        truthRefs: ['decision-0-ue-000'],
      },
      {
        id: 'event-reward-change-0',
        type: 'reward-change',
        tSec: 0,
        title: 'Synthetic reward sample changed',
        entityRefs: ['ue-000'],
        truthRefs: ['synthetic-validator-visual-showcase-v1'],
      },
    ],
    series: {
      sinrDb: {
        source: 'timeline.metrics.primarySinrDb',
        timesSec: TIMES_SEC,
        values: timeline.map((frame) => frame.metrics.primarySinrDb),
      },
      reward: {
        source: 'timeline.metrics.rewardScalar',
        timesSec: TIMES_SEC,
        values: timeline.map((frame) => frame.metrics.rewardScalar),
      },
      actionIndex: {
        source: 'timeline.modqnDecision.actionIndex',
        timesSec: TIMES_SEC,
        values: timeline.map((frame) => frame.modqnDecision.actionIndex),
      },
      servingSatellite: {
        source: 'timeline.metrics.servingSatelliteId',
        timesSec: TIMES_SEC,
        values: timeline.map((frame) => frame.metrics.servingSatelliteId),
      },
      handoverPhase: {
        source: 'timeline.handoverState.phase',
        timesSec: TIMES_SEC,
        values: timeline.map((frame) => frame.handoverState.phase),
      },
    },
    diagnostics: {
      policyName: 'synthetic-validator-policy',
      objectiveWeights: {
        throughput: 0.5,
        handover: 0.3,
        loadBalance: 0.2,
      },
      actionScoreKind: 'synthetic-validator-score',
      stateFeatures: ['snr', 'servingBeam', 'load'],
      actionLabels: beams.map((beam) => beam.id),
      actionScores: {
        source: 'synthetic-validator-fixture',
        timesSec: TIMES_SEC,
        values: actionScoresValues,
      },
      selectedAction: {
        source: 'synthetic-validator-fixture',
        timesSec: TIMES_SEC,
        values: TIMES_SEC.map((_, i) => (i === 0 ? 1 : 0)),
      },
      rewardComponents: {
        throughput: {
          source: 'synthetic-validator-fixture',
          timesSec: TIMES_SEC,
          values: TIMES_SEC.map(() => 0.8),
        },
        handover: {
          source: 'synthetic-validator-fixture',
          timesSec: TIMES_SEC,
          values: TIMES_SEC.map((_, i) => (i === 0 ? 0.2 : 1)),
        },
      },
      decisionFrames: TIMES_SEC.flatMap((tSec, frameIndex) =>
        ues.map((ue, ueIndex) => {
          const selectedActionIndex = selectedActionIndexForFrame(frameIndex);
          const selectedActionScore = selectedScoreForFrame(frameIndex);
          const runnerUpActionScore = runnerUpScoreForFrame(frameIndex);
          return {
            id: `decision-${frameIndex}-${ue.id}`,
            tSec,
            ueId: ue.id,
            sourceUserIndex: ueIndex,
            actionScores: actionScoresValues[frameIndex],
            selectedActionIndex,
            selectedActionScore,
            runnerUpActionScore,
            scoreMargin: selectedActionScore - runnerUpActionScore,
            decisionActionValidityMask: Array.from({ length: 28 }, () => true),
          };
        }),
      ),
    },
    displayHints: {
      source: 'synthetic-validator-fixture',
    },
  };
}

function resolveArtifactSource(): { rawText: string; source: VisualShowcaseValidatorArtifactSource } {
  const envPath = process.env.VISUAL_SHOWCASE_ARTIFACT_PATH;
  if (envPath && existsSync(envPath)) {
    return {
      rawText: readFileSync(envPath, 'utf8'),
      source: {
        kind: 'external',
        label: `VISUAL_SHOWCASE_ARTIFACT_PATH=${envPath}`,
        path: envPath,
        isPinnedTrigger: envPath === PINNED_VISUAL_SHOWCASE_ARTIFACT_PATH,
      },
    };
  }

  if (existsSync(PINNED_VISUAL_SHOWCASE_ARTIFACT_PATH)) {
    return {
      rawText: readFileSync(PINNED_VISUAL_SHOWCASE_ARTIFACT_PATH, 'utf8'),
      source: {
        kind: 'external',
        label: PINNED_VISUAL_SHOWCASE_ARTIFACT_PATH,
        path: PINNED_VISUAL_SHOWCASE_ARTIFACT_PATH,
        isPinnedTrigger: true,
      },
    };
  }

  const artifact = createSyntheticVisualShowcaseArtifact();
  return {
    rawText: JSON.stringify(artifact),
    source: {
      kind: 'synthetic',
      label: 'repo-local synthetic visual-showcase-v1 validator fixture',
      path: null,
      isPinnedTrigger: false,
    },
  };
}

export function loadValidatorVisualShowcaseArtifact(): VisualShowcaseValidatorArtifact {
  const { rawText, source } = resolveArtifactSource();
  const json = JSON.parse(rawText) as unknown;
  const artifact = loadShowcaseArtifact(json);
  return {
    artifact,
    json,
    rawText,
    rawBytes: Buffer.from(rawText),
    source,
  };
}
