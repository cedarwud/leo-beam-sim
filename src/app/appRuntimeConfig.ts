import type { AppExperienceMode } from './appExperienceMode';
import { DEFAULT_UE_MOBILITY_PARAMS } from '../engine/ue/multiUeMobility';
import type { EnvAxes } from '../modqn/training-trigger/types';
import type { Profile } from '../profiles/types';
import type { RuntimeConfig, BeamDensity } from '../scene/types';
import type { SceneTopologyState } from '../sceneTopology';
import { normalizeRuntimeModqnServingCount } from '../modqn/servingCount';
import { resolvePresentationMode } from './appRuntimeModel';
import { sceneTopologyFromTrainingEnvAxes } from './trainingEnvAxesProfileAdapter';
import {
  DEFAULT_MODQN_VISUAL_LAYER_PRESET,
  resolveModqnVisualLayers,
  type ModqnVisualLayerPreset,
} from '../scene/modqnVisualLayers';

export const APP_EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
export const LIVE_SIM_TIMELINE_DURATION_SEC = 7200;

/**
 * 運鏡 PARK (user 2026-06-17). The LIVE "cinematic camera" — the Director-focus
 * zoom-in + orbit + restore the Intra/Inter-HO buttons trigger, plus the sinr-live
 * Spotlight toggle — is TEMPORARILY disabled so the Intra-HO handover EFFECT
 * (candidate-beam highlight + timeline seek + slow-mo) plays IN PLACE without the
 * camera flying around. REVERSIBLE: flip to `true` to restore both.
 *
 * Scope: the LIVE scene (sinr-live + the MODQN live page, which reuses the SINR
 * render). The artifact-replay cinematic camera is a separate path and unaffected.
 * Only the camera POSITION mutation + the Spotlight UI toggle are gated — the
 * director FSM (`cinematicMode='director'`), the candidate highlight, the seek, and
 * the slow-mo are intentionally LEFT INTACT.
 */
export const LIVE_CINEMATIC_CAMERA_ENABLED = false;

const MODQN_PAPER_BASELINE_UE_COUNT = 100;
// S2: sinr-live default UE population. `sceneTopology.ueCount` is null by
// default, but the TopologyTab already SHOWS 100 as the effective default
// (`topology.ueCount ?? DEFAULT_UE_COUNT`), so the runtime falling back to 1 was
// a UI/runtime mismatch. Defaulting the runtime to 100 makes the ambient
// SINR-serving mosaic the literal default screen (SDD §3.1/§5.4 — G3 visible
// with zero clicks) and aligns runtime with the UI. An explicit Advanced
// override still wins.
const SINR_LIVE_DEFAULT_UE_COUNT = 100;

type RuntimeVisualSettings = Pick<
  RuntimeConfig,
  'beamDensity' | 'effectsEnabled' | 'cinematicMode' | 'reducedMotion'
>;

export interface AppRuntimeConfigInput {
  readonly appMode: AppExperienceMode;
  readonly effectiveProfile: Profile;
  readonly demoStartOffsetSec: number;
  readonly liveTimelineSeekTargetSec?: number;
  readonly liveTimelineSeekRequestKey?: string;
  readonly signalResetKey: string;
  readonly handoverResetKey: string;
  readonly runtimeVisualSettings: RuntimeVisualSettings;
  readonly beamDensityOverride: BeamDensity | null;
  readonly effectiveCinematicMode: RuntimeConfig['cinematicMode'];
  readonly cameraCommand: RuntimeConfig['cameraCommand'];
  readonly directorFocusCommand?: RuntimeConfig['directorFocusCommand'];
  readonly viewport: RuntimeConfig['viewport'];
  readonly sceneTopology: SceneTopologyState;
  readonly selectedTrainingEnvAxes: EnvAxes | undefined;
  readonly modqnVisualLayerPreset?: ModqnVisualLayerPreset;
  // S-FLAG-2 producer-readiness gate for the MODQN service-allocation overlay
  // family (parked OFF by default; `MODQN_SERVICE_ALLOCATION_PRODUCER_READY` /
  // `?modqnServiceAllocation=1`). Only meaningful on `modqn-demo`.
  readonly modqnServiceAllocationEnabled?: boolean;
  /** Demo intra-handover jog: ENU offset (km) for the PRIMARY UE (button-toggled). */
  readonly primaryJogEastKm?: number;
  readonly primaryJogNorthKm?: number;
  /** One-shot explicit live demo cue; not a source-backed trajectory event. */
  readonly manualHandoverRequestId?: number;
  readonly manualHandoverKind?: 'intra' | 'inter';
  readonly manualHandoverStartedAtMs?: number;
}

export function buildAppRuntimeConfig(input: AppRuntimeConfigInput): RuntimeConfig {
  const trainingTopology = sceneTopologyFromTrainingEnvAxes(input.selectedTrainingEnvAxes);
  const modqnVisualLayerPreset = input.appMode === 'modqn-demo'
    ? input.modqnVisualLayerPreset ?? DEFAULT_MODQN_VISUAL_LAYER_PRESET
    : undefined;
  return {
    appMode: input.appMode,
    presentationMode: resolvePresentationMode(input.effectiveProfile),
    replay: {
      epochUtcMs: APP_EPOCH_MS,
      startOffsetSec: input.demoStartOffsetSec,
      loop: true,
      windowLengthSec: LIVE_SIM_TIMELINE_DURATION_SEC,
      seekTargetSec: input.liveTimelineSeekTargetSec,
      seekRequestKey: input.liveTimelineSeekRequestKey,
    },
    signalResetKey: input.signalResetKey,
    handoverResetKey: input.handoverResetKey,
    ...input.runtimeVisualSettings,
    beamDensity: input.beamDensityOverride ?? input.runtimeVisualSettings.beamDensity,
    cinematicMode: input.effectiveCinematicMode,
    cameraCommand: input.cameraCommand,
    directorFocusCommand: input.directorFocusCommand,
    viewport: input.viewport,
    ueCount: input.sceneTopology.ueCount
      ?? (input.appMode === 'sinr-experiment'
        ? SINR_LIVE_DEFAULT_UE_COUNT
        : input.selectedTrainingEnvAxes?.nUsers ?? MODQN_PAPER_BASELINE_UE_COUNT),
    cellServingCount: input.appMode === 'modqn-demo'
      ? normalizeRuntimeModqnServingCount(input.sceneTopology.cellServingCount)
      : undefined,
    ueDistributionMode: input.sceneTopology.ueDistributionMode
      ?? (input.appMode === 'sinr-experiment'
        ? 'random'
        : trainingTopology.ueDistributionMode ?? 'random'),
    // MODQN consolidation: the MODQN live page reuses the SINR scene, so the primary
    // UE is the centred 'observer' protagonist on BOTH modes. The old 'distribution'
    // anchor (from the paper-faithful MODQN) placed the primary off-centre per the UE
    // spread → the "主角在角落" orange dot in the lower-left corner.
    uePrimaryAnchorMode: 'observer',
    // S2: the sinr-experiment profile (hobs-2024-candidate-rich) now carries a
    // uniform-rectangle `ueDistribution` (200x90 km user area), so the secondary
    // population spreads across the WHOLE map and `generateUePositions` takes the
    // rectangle path (this `ueDistributionScope` radius is only the fallback when
    // no rectangle area is set). Coverage is the constellation's job: a single
    // candidate-rich satellite reaches ~154 km (16 km footprint + 27.6 km lattice
    // + 110.5 km steering @ 12 deg) > the 100 km map half-width, so map-wide UEs
    // stay served. The PRIMARY UE still anchors at the observer (cinema unaffected).
    primaryJogEastKm: input.primaryJogEastKm ?? 0,
    primaryJogNorthKm: input.primaryJogNorthKm ?? 0,
    manualHandoverRequestId: input.manualHandoverRequestId,
    manualHandoverKind: input.manualHandoverKind,
    manualHandoverStartedAtMs: input.manualHandoverStartedAtMs,
    ueDistributionScope: input.appMode === 'modqn-demo' ? 'service-area' : 'beam-footprint',
    ueDistributionRadiusKm: input.appMode === 'modqn-demo'
      && input.selectedTrainingEnvAxes?.ueArea.distribution === 'uniform-circular'
      ? input.selectedTrainingEnvAxes.ueArea.radiusKm
      : undefined,
    ueMobilityMode: input.sceneTopology.ueMobilityMode
      ?? (input.appMode === 'sinr-experiment'
        ? 'static'
        : trainingTopology.ueMobilityMode ?? 'static'),
    ueMobilityParams: input.sceneTopology.ueMobilityParams
      ?? (input.appMode === 'sinr-experiment'
        ? DEFAULT_UE_MOBILITY_PARAMS
        : trainingTopology.ueMobilityParams ?? DEFAULT_UE_MOBILITY_PARAMS),
    enableUeTrails: input.sceneTopology.enableUeTrails !== null
      ? input.sceneTopology.enableUeTrails === true
      : input.appMode === 'sinr-experiment'
        ? false
        : trainingTopology.enableUeTrails === true,
    modqnVisualLayerPreset,
    modqnVisualLayers: modqnVisualLayerPreset
      ? resolveModqnVisualLayers(modqnVisualLayerPreset)
      : undefined,
    // S-FLAG-2: producer-readiness gate for the MODQN service-allocation overlay
    // family. Only the `modqn-demo` lane consumes it; parked OFF by default.
    modqnServiceAllocationEnabled: input.appMode === 'modqn-demo'
      ? input.modqnServiceAllocationEnabled ?? false
      : undefined,
  };
}
