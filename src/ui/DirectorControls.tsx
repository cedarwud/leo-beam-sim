import type { DirectorFocusPhase } from '../scene/types';

export interface DirectorControlsProps {
  /** Source-indexed when available; otherwise the real same-satellite trigger is used. */
  readonly intraEnabled: boolean;
  /** Next inter navigation is offered only when the rail carries a source-backed event. */
  readonly interEnabled: boolean;
  /** The explicit real intra trigger is live-sim-only; defaults to intraEnabled for old callers. */
  readonly intraTriggerEnabled?: boolean;
  /** `indexed` seeks the next source event; `real-trigger` performs a real same-sat jog. */
  readonly nextIntraMode?: 'indexed' | 'real-trigger';
  /** True while the source index is being rebuilt after a left-side change. */
  readonly handoverIndexBuilding?: boolean;
  readonly nextIntraCount?: number;
  readonly nextInterCount?: number;
  readonly phase: DirectorFocusPhase;
  /**
   * PRIMARY intra action (Bug B fix, C1): jog the primary UE one beam-lattice step
   * so the engine fires a REAL same-sat intra handover → the ambient pulse flares.
   * NO camera move and NO seek — the seek's `rebase()` used to clear `prevUeServing`
   * (cold-attaching the jog → no pulse) AND wipe `recentHandovers` (no flare). Keeping
   * the trigger seek-free is what makes "click intra → see a pulse" work.
   */
  readonly onIntraTrigger: () => void;
  /** Next intra action: seek/focus an indexed event or trigger the real fallback. */
  readonly onIntraFocus: () => void;
  readonly onInterFocus: () => void;
  readonly onExit: () => void;
}

export function DirectorControls({
  intraEnabled,
  interEnabled,
  intraTriggerEnabled = intraEnabled,
  nextIntraMode = 'indexed',
  handoverIndexBuilding = false,
  nextIntraCount,
  nextInterCount,
  phase,
  onIntraTrigger,
  onIntraFocus,
  onInterFocus,
  onExit,
}: DirectorControlsProps) {
  const active = phase !== 'idle';
  const intraTriggerTitle =
    'Trigger a real intra-HO — jog the primary UE one beam step so the engine hands it to a sibling beam; the same satellite keeps its hue while the beam shade changes (no camera seek)';
  const intraNextTitle = nextIntraMode === 'real-trigger'
    ? 'No indexed intra row exists in the static window; trigger the next real same-satellite beam switch now'
    : 'Jump to the next indexed intra-HO event, seek to its lead-in, and play it in slow motion';
  const intraNextLabel = nextIntraMode === 'real-trigger' ? 'Next Intra · trigger' : 'Next Intra';
  const interNextTitle = handoverIndexBuilding
    ? interEnabled
      ? 'Queue the next indexed inter-HO; the current-parameter event index is rebuilding'
      : 'Updating the handover event index for the current parameters'
    : interEnabled
    ? 'Jump to the next indexed inter-HO event, seek to its lead-in, and play it in slow motion'
    : 'No inter-satellite handover exists in the current source window';
  const countLabel = (count: number | undefined): string => (
    typeof count === 'number' ? ` · ${count}` : ''
  );
  return (
    <div
      className="leo-director-controls"
      data-testid="director-controls"
      data-director-phase={phase}
      data-director-enabled={intraEnabled || interEnabled ? '1' : '0'}
      data-director-intra-enabled={intraEnabled ? '1' : '0'}
      data-director-inter-enabled={interEnabled ? '1' : '0'}
      data-director-intra-mode={nextIntraMode}
      data-director-index-building={handoverIndexBuilding ? '1' : '0'}
    >
      <span className="leo-director-controls__label">Director</span>
      <span className="leo-director-controls__section-label">Jump to next</span>
      <button
        type="button"
        className="leo-director-controls__btn"
        data-testid="director-intra-focus"
        disabled={!intraEnabled || active}
        onClick={onIntraFocus}
        title={nextIntraMode === 'real-trigger'
          ? intraNextTitle
          : handoverIndexBuilding
            ? intraEnabled
              ? 'Queue the next indexed intra-HO; the current-parameter event index is rebuilding'
              : 'Updating the handover event index for the current parameters'
            : intraNextTitle}
      >
        {intraNextLabel}{countLabel(nextIntraCount)}
      </button>
      <button
        type="button"
        className="leo-director-controls__btn"
        data-testid="director-inter-focus"
        disabled={!interEnabled || active}
        onClick={onInterFocus}
        title={interNextTitle}
      >
        Next Inter{countLabel(nextInterCount)}
      </button>

      {/* Explicit live trigger: separate from navigation so it never seeks/rebases
          the sim before the real intra pulse can be observed. */}
      <button
        type="button"
        className="leo-director-controls__btn"
        data-testid="director-intra-trigger"
        disabled={!intraTriggerEnabled}
        onClick={onIntraTrigger}
        title={intraTriggerTitle}
      >
        Trigger Intra
      </button>
      <span className="leo-director-controls__hint">
        {nextIntraMode === 'real-trigger'
          ? 'no indexed row: real same-satellite trigger'
          : handoverIndexBuilding
            ? 'updating source index'
            : 'indexed event: lead-in + slow-mo'}
      </span>
      {nextIntraMode === 'real-trigger' && (
        <span className="leo-director-controls__color-key" aria-label="Intra handover cue: same satellite, different beam shades">
          same satellite · source beam → target beam
        </span>
      )}
      <button
        type="button"
        className="leo-director-controls__btn leo-director-controls__btn--exit"
        data-testid="director-exit-focus"
        disabled={!active}
        onClick={onExit}
        title="Exit director focus and restore camera controls"
      >
        Exit Focus
      </button>
    </div>
  );
}
