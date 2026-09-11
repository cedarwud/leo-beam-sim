import { type ReactElement } from 'react';
import { UI_CLASSES } from '../constants/uiTokens';
import { useLocale } from '../i18n';
import type { CinematicMode } from '../scene/types';
import type { HandoverPhase } from '../engine/handover/candidateDecisionContract';
import { txBi } from './signal-tuning/labels';

// The compact SINR-live quick-control row at the top of the viewport: cheap
// display toggles plus two source-backed handover jump buttons. The heavier
// tuners stay in the left drawer; the handover rail does not occupy the live
// right sidebar.

/**
 * Owner request (2026-08-06): keep the "show other UEs in handover" control OUT of
 * the quick-control row for now. Only the CONTROL is hidden — the display filter,
 * its selector (src/scene/otherHandoverUeSelector.ts) and the seek-settle runtime
 * fix it depends on (src/scene/seekSettle.ts) are all still in place and still
 * covered by tests. `beamDisplaySpec.showOtherHandoverUes` defaults to false, so
 * with no way to switch it on the scene keeps its full UE population.
 *
 * Flip this to `true` to bring the checkbox back — nothing else needs to change.
 */
const OTHER_HANDOVER_UES_TOGGLE_VISIBLE = false;
interface SinrLiveQuickControlsProps {
  readonly beamCalloutsEnabled: boolean;
  readonly showNonServingCones: boolean;
  readonly showOtherHandoverUes: boolean;
  readonly cinematicMode: CinematicMode;
  readonly autoSlowEnabled: boolean;
  // HO-Slow feedback (the checkbox alone gave no signal that it slowed): the live
  // effective scene rate + whether the auto-slow is currently applied, plus a
  // dismiss to resume normal speed for the in-progress handover.
  readonly effectiveSpeed: number;
  /** User-selected transport rate; shown when HO Slow intentionally caps it. */
  readonly requestedSpeed?: number;
  readonly autoSlowActive: boolean;
  readonly autoSlowApplied: boolean;
  /** Accepted decision phase; display-only HO Slow explanation. */
  readonly decisionPhase?: HandoverPhase | null;
  /** Homepage-only narrative caption switch. */
  readonly teachingMode?: boolean;
  readonly onTeachingModeChange?: (enabled: boolean) => void;
  readonly showTeachingModeToggle?: boolean;
  readonly onToggleBeamCallouts: () => void;
  readonly onToggleNonServingCones: () => void;
  readonly onToggleOtherHandoverUes: () => void;
  readonly onCinematicModeChange: (mode: CinematicMode) => void;
  readonly onToggleAutoSlow: () => void;
  readonly onDismissAutoSlow: () => void;
  readonly showHandoverJumpButtons?: boolean;
  readonly nextIntraEnabled?: boolean;
  readonly nextInterEnabled?: boolean;
  readonly nextIntraCount?: number;
  readonly nextInterCount?: number;
  readonly nextIntraMode?: 'indexed' | 'real-trigger' | 'moving-beam-demo';
  readonly handoverIndexBuilding?: boolean;
  /** Keep the first-paint control row quiet; titles still explain disabled jumps. */
  readonly showHandoverIndexStatus?: boolean;
  readonly manualHandoverKind?: 'intra' | 'inter' | null;
  readonly onNextIntra?: () => void;
  readonly onNextInter?: () => void;
}

export function SinrLiveQuickControls({
  beamCalloutsEnabled,
  showNonServingCones,
  showOtherHandoverUes,
  cinematicMode,
  autoSlowEnabled,
  effectiveSpeed,
  requestedSpeed = effectiveSpeed,
  autoSlowActive,
  autoSlowApplied,
  decisionPhase = null,
  teachingMode = true,
  onTeachingModeChange,
  showTeachingModeToggle = false,
  onToggleBeamCallouts,
  onToggleNonServingCones,
  onToggleOtherHandoverUes,
  onCinematicModeChange,
  onToggleAutoSlow,
  onDismissAutoSlow,
  showHandoverJumpButtons = false,
  nextIntraEnabled = false,
  nextInterEnabled = false,
  nextIntraCount,
  nextInterCount,
  nextIntraMode = 'indexed',
  handoverIndexBuilding = false,
  showHandoverIndexStatus = false,
  manualHandoverKind = null,
  onNextIntra,
  onNextInter,
}: SinrLiveQuickControlsProps): ReactElement {
  const { locale, t } = useLocale();
  const otherHandoverUesLabel = txBi(
    t,
    locale === 'en',
    'common.showOtherHandoverUes',
    '顯示其他換手中的 UE',
    'Show other UEs in handover',
  );
  const hoSlowPhaseLabel = decisionPhase === 'switching'
    ? txBi(t, locale === 'en', 'quickControls.hoSlow.committing', '換手提交中', 'handover committing')
    : decisionPhase === 'qualifying' || decisionPhase === 'selection-hold'
      ? txBi(t, locale === 'en', 'quickControls.hoSlow.confirming', '候選確認中', 'confirming candidate persistence')
      : decisionPhase === 'evaluating'
        ? txBi(t, locale === 'en', 'quickControls.hoSlow.evaluating', '候選評估中', 'evaluating candidates')
        : txBi(t, locale === 'en', 'quickControls.hoSlow.monitoring', '持續監測中', 'monitoring; no switch pending');

  return (
    <div
      className="leo-sinr-quick-controls"
      role="group"
      aria-label="Quick display controls"
      data-testid="sinr-live-quick-controls"
    >
      <label className="leo-control-bar__toggle" title="Show or hide beam information blocks in the scene">
        <input
          className={UI_CLASSES.checkbox}
          type="checkbox"
          aria-label="Show beam information blocks"
          data-testid="beam-info-toggle"
          checked={beamCalloutsEnabled}
          onChange={onToggleBeamCallouts}
        />
        Beam Info
      </label>

      <label className="leo-control-bar__toggle" title="Also draw the dim non-serving (co-channel) beam cones behind the serving ones">
        <input
          className={UI_CLASSES.checkbox}
          type="checkbox"
          aria-label="Show non-serving beam cones"
          data-testid="non-serving-cones-toggle"
          checked={showNonServingCones}
          onChange={onToggleNonServingCones}
        />
        Other beams
      </label>

      {OTHER_HANDOVER_UES_TOGGLE_VISIBLE && (
        <label className="leo-control-bar__toggle" title={otherHandoverUesLabel}>
          <input
            className={UI_CLASSES.checkbox}
            type="checkbox"
            aria-label={otherHandoverUesLabel}
            data-testid="other-handover-ues-toggle"
            checked={showOtherHandoverUes}
            onChange={onToggleOtherHandoverUes}
          />
          {otherHandoverUesLabel}
        </label>
      )}

      {/* Spotlight RESTORED (user request). The spotlight EFFECT is a scene-level
          cinematic dim + fog + target point-lights resolved in `BaseSceneLayout`
          (cinematicSpotlightActive) — it is INDEPENDENT of the parked live cinematic
          CAMERA (LIVE_CINEMATIC_CAMERA_ENABLED, which only suppresses the director
          camera MOTION). So this toggle works on the live cell lane without un-parking
          the camera. cinematicMode 'spotlight' (not 'director') never arms the director FSM. */}
      <label className="leo-control-bar__toggle" title="Highlight serving beam path with cinematic spotlight (scene dim + fog)">
        <input
          className={UI_CLASSES.checkbox}
          type="checkbox"
          aria-label="Spotlight mode: highlight serving beam path"
          checked={cinematicMode === 'spotlight'}
          onChange={event => onCinematicModeChange(event.target.checked ? 'spotlight' : 'off')}
        />
        Spotlight
      </label>

      <label className="leo-control-bar__toggle" title="Auto-slow simulation rate during handover events">
        <input
          className={UI_CLASSES.checkbox}
          type="checkbox"
          aria-label="Auto slow on handover"
          checked={autoSlowEnabled}
          onChange={onToggleAutoSlow}
        />
        HO Slow
      </label>

      {showTeachingModeToggle && onTeachingModeChange !== undefined && (
        <label
          className="leo-control-bar__toggle"
          title="Show short event explanations next to the corresponding scene object"
        >
          <input
            className={UI_CLASSES.checkbox}
            type="checkbox"
            aria-label="Teaching cues"
            data-testid="teaching-mode-toggle"
            checked={teachingMode}
            onChange={event => onTeachingModeChange(event.target.checked)}
          />
          Teaching cues
        </label>
      )}

      {showHandoverJumpButtons && (
        <span className="leo-sinr-quick-controls__handover-jumps" aria-label="Handover quick navigation">
          <button
            type="button"
            className="leo-sinr-quick-controls__handover-button leo-sinr-quick-controls__handover-button--intra"
            data-testid="director-intra-focus"
            disabled={!nextIntraEnabled}
            onClick={onNextIntra}
            title={nextIntraMode === 'real-trigger'
              ? nextIntraCount === undefined
                ? 'Trigger a real same-satellite intra handover'
                : 'Trigger the next real same-satellite intra handover'
              : handoverIndexBuilding
              ? nextIntraEnabled
                ? 'Queue the next indexed intra handover; the current-parameter index is rebuilding'
                : 'Updating the handover event index for the current parameters'
              : 'Jump to the next indexed intra handover'}
          >
            Intra Handover{nextIntraMode === 'real-trigger' ? ' · trigger' : ''}{typeof nextIntraCount === 'number' ? ` · ${nextIntraCount}` : ''}
          </button>
          <button
            type="button"
            className="leo-sinr-quick-controls__handover-button leo-sinr-quick-controls__handover-button--inter"
            data-testid="director-inter-focus"
            disabled={!nextInterEnabled}
            onClick={onNextInter}
            title={handoverIndexBuilding
              ? nextInterEnabled
                ? 'Queue the next indexed inter handover; the current-parameter index is rebuilding'
                : 'Updating the handover event index for the current parameters'
              : nextInterCount === undefined
              ? 'Seek to the next indexed inter handover and play the moving satellite pair'
              : 'Jump to the next indexed inter handover'}
          >
            Inter Handover{typeof nextInterCount === 'number' ? ` · ${nextInterCount}` : ''}
          </button>
          {handoverIndexBuilding && showHandoverIndexStatus && (
            <span
              className="leo-sinr-quick-controls__handover-status"
              data-testid="handover-index-building"
              role="status"
              title="The live scene and timeline can start while the quick-jump index is built in the background"
            >
              Building quick-jump index…
            </span>
          )}
        </span>
      )}

      {/* HO-Slow feedback: the checkbox alone never showed whether the slow was
          firing. This readout shows the actual scene rate and makes the deliberate
          cap explicit when a faster transport preset is selected. */}
      <span
        className="leo-ho-slow-status"
        data-testid="ho-slow-status"
        data-auto-slow-applied={autoSlowApplied ? '1' : '0'}
        data-auto-slow-active={autoSlowActive ? '1' : '0'}
        data-ho-slow-phase={decisionPhase ?? ''}
        title={autoSlowApplied
          ? `HO Slow: ${hoSlowPhaseLabel}. Resume skips the cap for this episode.`
          : `Live scene playback rate; current decision phase: ${hoSlowPhaseLabel}.`}
      >
        Scene {effectiveSpeed.toFixed(1)}×{autoSlowApplied
          ? ` · HO Slow · ${hoSlowPhaseLabel}${requestedSpeed !== effectiveSpeed ? ` · ${requestedSpeed.toFixed(1)}× selected` : ''}`
          : ` · ${hoSlowPhaseLabel}`}
      </span>
      {manualHandoverKind !== null && (
        <span
          className="leo-sinr-quick-controls__handover-status"
          data-testid="manual-handover-status"
          role="status"
        >
          Showing {manualHandoverKind === 'intra' ? 'Intra' : 'Inter'} · Timeline running
        </span>
      )}
      {autoSlowApplied && (
        <button
          type="button"
          className="leo-ho-slow-dismiss"
          data-testid="ho-slow-dismiss"
          onClick={onDismissAutoSlow}
          title="Resume normal speed for this handover"
        >
          Resume
        </button>
      )}
    </div>
  );
}
