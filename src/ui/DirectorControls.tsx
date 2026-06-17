import type { DirectorFocusPhase } from '../scene/types';

export interface DirectorControlsProps {
  /**
   * Intra-HO is always actionable on the live lane: the Trigger button jogs the
   * primary UE one beam-lattice step to FORCE a real same-sat handover, and the
   * cinematic Focus arms slow-mo on the next intra event.
   */
  readonly intraEnabled: boolean;
  /** Inter-HO focus is offered only when the rail carries a source-backed inter event. */
  readonly interEnabled: boolean;
  readonly phase: DirectorFocusPhase;
  /**
   * PRIMARY intra action (Bug B fix, C1): jog the primary UE one beam-lattice step
   * so the engine fires a REAL same-sat intra handover → the ambient pulse flares.
   * NO camera move and NO seek — the seek's `rebase()` used to clear `prevUeServing`
   * (cold-attaching the jog → no pulse) AND wipe `recentHandovers` (no flare). Keeping
   * the trigger seek-free is what makes "click intra → see a pulse" work.
   */
  readonly onIntraTrigger: () => void;
  /**
   * OPTIONAL cinematic intra focus: arm the 0.25x slow-mo + camera close-up on the
   * next intra handover. A SEPARATE button from the trigger so its seek no longer
   * defeats the jog's pulse (Bug B). Disabled while a focus is already active.
   */
  readonly onIntraFocus: () => void;
  readonly onInterFocus: () => void;
  readonly onExit: () => void;
}

export function DirectorControls({
  intraEnabled,
  interEnabled,
  phase,
  onIntraTrigger,
  onIntraFocus,
  onInterFocus,
  onExit,
}: DirectorControlsProps) {
  const active = phase !== 'idle';
  // A disabled focus button is otherwise a silent grey button — the most common
  // case is the canonical 89s baseline artifact, which carries 82 intra-HO events
  // but 0 inter-satellite handovers, so Inter-HO Focus is correctly disabled.
  // Explain WHY on hover instead of leaving it inert and unexplained.
  const intraTriggerTitle =
    'Trigger a real intra-HO — jog the primary UE one beam step so the engine hands it to a sibling beam; the ambient pulse flares (no camera move)';
  const intraFocusTitle = intraEnabled
    ? 'Cinematic intra-HO focus — tight beam-level close-up + slow motion on the next intra event'
    : 'No beam-switch (intra-HO) event in the current artifact / live window — intra-HO focus unavailable';
  const interTitle = interEnabled
    ? 'Cinematic inter-HO focus — wide satellite-context shot + slow motion'
    : 'No inter-satellite handover in the current artifact / live window — inter-HO focus unavailable';
  return (
    <div
      className="leo-director-controls"
      data-testid="director-controls"
      data-director-phase={phase}
      data-director-enabled={intraEnabled || interEnabled ? '1' : '0'}
      data-director-intra-enabled={intraEnabled ? '1' : '0'}
      data-director-inter-enabled={interEnabled ? '1' : '0'}
    >
      <span className="leo-director-controls__label">Director</span>
      {/* PRIMARY action: force a real intra HO (jog) → ambient pulse flares. Stays
          actionable even during an active focus — jogging the live UE is decoupled
          from the cinema (Bug B fix, C1). */}
      <button
        type="button"
        className="leo-director-controls__btn"
        data-testid="director-intra-trigger"
        disabled={!intraEnabled}
        onClick={onIntraTrigger}
        title={intraTriggerTitle}
      >
        Intra-HO
      </button>
      <button
        type="button"
        className="leo-director-controls__btn"
        data-testid="director-intra-focus"
        disabled={!intraEnabled || active}
        onClick={onIntraFocus}
        title={intraFocusTitle}
      >
        Intra-HO Focus
      </button>
      <button
        type="button"
        className="leo-director-controls__btn"
        data-testid="director-inter-focus"
        disabled={!interEnabled || active}
        onClick={onInterFocus}
        title={interTitle}
      >
        Inter-HO Focus
      </button>
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
