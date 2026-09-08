import { ArtifactSatelliteCompass } from '../ui/ArtifactSatelliteCompass';
import { CinematicSeekFadeOverlay } from '../ui/CinematicSeekFadeOverlay';
import { SixActsSubtitleBar } from '../course/nav/SixActsAnnotation';
import { SixActsTeachingOverlay, type SixActsTeachingReceipt } from '../ui/SixActsTeachingOverlay';
import { HandoverTeachingCaption } from '../ui/homepage/HandoverTeachingRail';
import type { TeachingFrame, TeachingHandoverKind } from '../homepage/teaching/handoverTeachingScript';
import type { SixActsSubtitleState } from '../course/sixActs/subtitleStateMachine';
import type { SixActsFrameFacts } from '../course/sixActs/liveReplayBridge';
import type { NormalizedSceneFrame } from '../scene/NormalizedSceneFrame';
import type { SceneLane } from './sceneLane';
import type { SixActsTeachingMode } from '../course/sixActs/teachingMode';

export interface AppSceneOverlaysProps {
  readonly sceneLane: SceneLane;
  readonly replaySceneFrame: NormalizedSceneFrame | null;
  readonly directorCinematicEnabled: boolean;
  readonly directorFocusEnabled: boolean;
  readonly cinematicFadePulse: number | null;
  readonly reducedMotion: boolean;
  readonly suppressCinematicFade: boolean;
  readonly onCinematicSeekPeak: () => void;
  readonly shellOverlayVisible: boolean;
  readonly showTeachingAuxiliaryUi: boolean;
  readonly teachingMode: SixActsTeachingMode;
  readonly isWalkerSceneActive: boolean;
  readonly sixActsSubtitle: SixActsSubtitleState | null;
  readonly sixActsFacts: SixActsFrameFacts | null;
  readonly sixActsTrace: readonly SixActsFrameFacts[];
  readonly sixActsReceipt: SixActsTeachingReceipt | null;
  readonly sixActsOffsetDb: number;
  readonly sixActsTttSec: number;
  readonly teachingCaptionFrame: TeachingFrame | null;
  readonly teachingStageKind: TeachingHandoverKind | null;
}

/** Owns the shell-level overlay mounts; the scene remains the rendering authority. */
export function AppSceneOverlays({
  sceneLane,
  replaySceneFrame,
  directorCinematicEnabled,
  directorFocusEnabled,
  cinematicFadePulse,
  reducedMotion,
  suppressCinematicFade,
  onCinematicSeekPeak,
  shellOverlayVisible,
  showTeachingAuxiliaryUi,
  teachingMode,
  isWalkerSceneActive,
  sixActsSubtitle,
  sixActsFacts,
  sixActsTrace,
  sixActsReceipt,
  sixActsOffsetDb,
  sixActsTttSec,
  teachingCaptionFrame,
  teachingStageKind,
}: AppSceneOverlaysProps) {
  return (
    <>
      {sceneLane === 'artifact-replay' && replaySceneFrame && (
        <ArtifactSatelliteCompass satellites={replaySceneFrame.satellites} />
      )}
      {(directorCinematicEnabled || directorFocusEnabled) && (
        <CinematicSeekFadeOverlay
          pulseKey={cinematicFadePulse}
          reducedMotion={reducedMotion}
          suppressVisual={suppressCinematicFade}
          onPeak={onCinematicSeekPeak}
        />
      )}
      {shellOverlayVisible && (
        <>
          {showTeachingAuxiliaryUi && teachingMode === 'teaching' && sceneLane === 'sinr-live' && isWalkerSceneActive && sixActsSubtitle !== null && (
            sixActsFacts === null ? null : (
              <SixActsTeachingOverlay
                beat={sixActsSubtitle.beat}
                facts={sixActsFacts}
                trace={sixActsTrace}
                offsetDb={sixActsOffsetDb}
                tttSec={sixActsTttSec}
                receipt={sixActsReceipt}
              />
            )
          )}
          {showTeachingAuxiliaryUi && teachingMode === 'teaching' && sceneLane === 'sinr-live' && isWalkerSceneActive && sixActsSubtitle !== null && (
            <div
              className="leo-six-acts-subtitle-overlay"
              data-testid="six-acts-subtitle-overlay"
              data-six-acts-beat={sixActsSubtitle.beat}
            >
              <SixActsSubtitleBar
                eyebrow={sixActsSubtitle.eyebrow}
                text={sixActsSubtitle.text}
                rows={sixActsSubtitle.rows}
                tone={sixActsSubtitle.tone}
                provenance={sixActsFacts?.provenance}
                provenanceErrorCode={sixActsFacts?.provenanceErrorCode}
              />
            </div>
          )}
        </>
      )}
      {teachingStageKind !== null && teachingCaptionFrame !== null && (
        <HandoverTeachingCaption frame={teachingCaptionFrame} />
      )}
    </>
  );
}
