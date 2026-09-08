import type { AppExperienceMode } from './appExperienceMode';
import { isSupportedBeamLayoutCount } from '../core/beam/completeHexPresets';
import { DEFAULT_UE_MOBILITY_PARAMS } from '../engine/ue/multiUeMobility';
import { normalizeEeThresholdKbitPerJoule } from '../engine/handover/eeThreshold';
import type { Profile } from '../profiles/types';
import type { RuntimeConfig, BeamDensity } from '../scene/types';
import type { SceneTopologyState } from '../sceneTopology';
import { resolvePresentationMode } from './appRuntimeModel';

export const APP_EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
export const LIVE_SIM_TIMELINE_DURATION_SEC = 7200;

/**
 * 運鏡 PARK (user 2026-06-17). The LIVE "cinematic camera" — the Director-focus
 * zoom-in + orbit + restore the Intra/Inter-HO buttons trigger, plus the sinr-live
 * Spotlight toggle — is TEMPORARILY disabled so the Intra-HO handover EFFECT
 * (candidate-beam highlight + timeline seek + slow-mo) plays IN PLACE without the
 * camera flying around. REVERSIBLE: flip to `true` to restore both.
 *
 * Scope: the LIVE scene. The artifact-replay cinematic camera is a separate path
 * and unaffected.
 * Only the camera POSITION mutation + the Spotlight UI toggle are gated — the
 * director FSM (`cinematicMode='director'`), the candidate highlight, the seek, and
 * the slow-mo are intentionally LEFT INTACT.
 */
export const LIVE_CINEMATIC_CAMERA_ENABLED = false;

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
  readonly [key: string]: unknown;
  readonly appMode: AppExperienceMode;
  readonly effectiveProfile: Profile;
  readonly demoStartOffsetSec: number;
  /** Explicit UTC epoch derived from the public Walker scenario time control. */
  readonly liveEpochUtcMs?: number;
  readonly liveTimelineSeekTargetSec?: number;
  readonly liveTimelineSeekRequestKey?: string;
  /** Homepage Director only; normal timeline seeks remain cheap rebase seeks. */
  readonly liveTimelineSeekSourceHistoryReplay?: boolean;
  /** Explicit measurement-window reset; does not rebuild or retune the simulation. */
  readonly measurementResetEpoch?: number;
  readonly signalResetKey: string;
  readonly handoverResetKey: string;
  readonly runtimeVisualSettings: RuntimeVisualSettings;
  readonly beamDensityOverride: BeamDensity | null;
  readonly effectiveCinematicMode: RuntimeConfig['cinematicMode'];
  readonly cameraCommand: RuntimeConfig['cameraCommand'];
  readonly directorFocusCommand?: RuntimeConfig['directorFocusCommand'];
  readonly viewport: RuntimeConfig['viewport'];
  readonly sceneTopology: SceneTopologyState;
  /** Homepage-only instantaneous EE candidate floor, in Kbit/J. */
  readonly eeThresholdKbitPerJoule?: number;
  /** The handover lecture currently running on the homepage, or null. */
  readonly teachingLectureKind?: 'intra' | 'inter' | null;
  /** Demo intra-handover jog: ENU offset (km) for the PRIMARY UE (button-toggled). */
  readonly primaryJogEastKm?: number;
  readonly primaryJogNorthKm?: number;
  /** One-shot explicit live demo cue; not a source-backed trajectory event. */
  readonly manualHandoverRequestId?: number;
  readonly manualHandoverKind?: 'intra' | 'inter';
  readonly manualHandoverOrigin?: 'button' | 'scheduled';
  readonly manualHandoverStartedAtMs?: number;
  readonly manualHandoverSourceSatId?: string;
  readonly manualHandoverSourceCellId?: number;
  readonly manualHandoverTargetSatId?: string;
  readonly manualHandoverTargetCellId?: number;
  readonly manualHandoverServingSinrDb?: number;
  readonly manualHandoverCandidateSinrDb?: number;
}

export function buildAppRuntimeConfig(input: AppRuntimeConfigInput): RuntimeConfig {
  const persistedGlobalBeamCount = input.sceneTopology.beamCountPerSatellite;
  const profileBeamCount = Math.trunc(input.effectiveProfile.beams.perSatellite);
  const fallbackSceneBeamCount = isSupportedBeamLayoutCount(profileBeamCount)
    ? profileBeamCount
    : undefined;
  // Serving satellite is the live-scene authority. The legacy global field is
  // retained only as a persisted-session fallback; candidate follows this
  // effective scene count unless it has an explicit role override.
  const effectiveSceneBeamCount = input.sceneTopology.servingBeamCount
    ?? (typeof persistedGlobalBeamCount === 'number' && isSupportedBeamLayoutCount(persistedGlobalBeamCount)
      ? persistedGlobalBeamCount
      : fallbackSceneBeamCount);
  return {
    appMode: input.appMode,
    presentationMode: resolvePresentationMode(input.effectiveProfile),
    replay: {
      epochUtcMs: Number.isFinite(input.liveEpochUtcMs)
        ? input.liveEpochUtcMs as number
        : APP_EPOCH_MS,
      startOffsetSec: input.demoStartOffsetSec,
      loop: true,
      windowLengthSec: LIVE_SIM_TIMELINE_DURATION_SEC,
      seekTargetSec: input.liveTimelineSeekTargetSec,
      seekRequestKey: input.liveTimelineSeekRequestKey,
      ...(input.liveTimelineSeekSourceHistoryReplay === true
        ? { sourceHistoryReplay: true }
        : {}),
    },
    measurementResetEpoch: input.measurementResetEpoch ?? 0,
    signalResetKey: input.signalResetKey,
    handoverResetKey: input.handoverResetKey,
    ...input.runtimeVisualSettings,
    beamDensity: input.beamDensityOverride ?? input.runtimeVisualSettings.beamDensity,
    cinematicMode: input.effectiveCinematicMode,
    cameraCommand: input.cameraCommand,
    directorFocusCommand: input.directorFocusCommand,
    viewport: input.viewport,
    beamCountBySatellite: input.sceneTopology.beamCountBySatellite,
    // The Scenario panel presents the serving-satellite layout as the scene
    // authority. Candidate follows it unless explicitly overridden.
    servingBeamCount: effectiveSceneBeamCount,
    candidateBeamCount: input.sceneTopology.candidateBeamCount ?? effectiveSceneBeamCount,
    teachingLectureKind: input.teachingLectureKind ?? null,
    eeThresholdKbitPerJoule: input.eeThresholdKbitPerJoule === undefined
      ? undefined
      : normalizeEeThresholdKbitPerJoule(input.eeThresholdKbitPerJoule),
    beamHoppingEnabled: input.sceneTopology.beamHoppingEnabled,
    focusCellId: input.sceneTopology.focusCellId,
    ueCount: input.sceneTopology.ueCount
      ?? SINR_LIVE_DEFAULT_UE_COUNT,
    // The legacy homepage has one intentional UE substrate: 100 users spread
    // across the same seven asymmetric earth-fixed cells used by the SINR
    // truth model. Do not let a stale topology override from an earlier UI
    // experiment silently switch `/` back to a map-wide random population.
    // Other lanes retain their existing topology-controlled distribution.
    ueDistributionMode: 'seven-cell-asymmetric',
    // The primary UE is the centred 'observer' protagonist.
    uePrimaryAnchorMode: 'observer',
    // S2: the sinr-experiment profile (hobs-2024-candidate-rich) now carries a
    // uniform-rectangle `ueDistribution` (200x90 km user area), so the secondary
    // population spreads across the WHOLE map and `generateUePositions` takes the
    // rectangle path (this `ueDistributionScope` radius is only the fallback when
    // no rectangle area is set). Coverage is the constellation's job: a single
    // candidate-rich's configured 40° steering envelope reaches well beyond the
    // 100 km map half-width, so map-wide UEs stay served while multiple Walker
    // alternatives remain measurable. The PRIMARY UE still anchors at the
    // observer (cinema unaffected).
    primaryJogEastKm: input.primaryJogEastKm ?? 0,
    primaryJogNorthKm: input.primaryJogNorthKm ?? 0,
    manualHandoverRequestId: input.manualHandoverRequestId,
    manualHandoverKind: input.manualHandoverKind,
    manualHandoverOrigin: input.manualHandoverOrigin,
    manualHandoverStartedAtMs: input.manualHandoverStartedAtMs,
    manualHandoverSourceSatId: input.manualHandoverSourceSatId,
    manualHandoverSourceCellId: input.manualHandoverSourceCellId,
    manualHandoverTargetSatId: input.manualHandoverTargetSatId,
    manualHandoverTargetCellId: input.manualHandoverTargetCellId,
    manualHandoverServingSinrDb: input.manualHandoverServingSinrDb,
    manualHandoverCandidateSinrDb: input.manualHandoverCandidateSinrDb,
    ueDistributionScope: 'beam-footprint',
    ueMobilityMode: input.sceneTopology.ueMobilityMode
      ?? 'static',
    ueMobilityParams: input.sceneTopology.ueMobilityParams
      ?? DEFAULT_UE_MOBILITY_PARAMS,
    enableUeTrails: input.sceneTopology.enableUeTrails !== null
      ? input.sceneTopology.enableUeTrails === true
      : false,
  };
}
