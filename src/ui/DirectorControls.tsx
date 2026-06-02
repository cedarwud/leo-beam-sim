import type { DirectorFocusPhase } from '../scene/types';

export interface DirectorControlsProps {
  /** Intra-HO focus is offered only when the rail carries a source-backed intra event. */
  readonly intraEnabled: boolean;
  /** Inter-HO focus is offered only when the rail carries a source-backed inter event. */
  readonly interEnabled: boolean;
  readonly phase: DirectorFocusPhase;
  readonly onIntraFocus: () => void;
  readonly onInterFocus: () => void;
  readonly onExit: () => void;
}

export function DirectorControls({
  intraEnabled,
  interEnabled,
  phase,
  onIntraFocus,
  onInterFocus,
  onExit,
}: DirectorControlsProps) {
  const active = phase !== 'idle';
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
      <button
        type="button"
        className="leo-director-controls__btn"
        data-testid="director-intra-focus"
        disabled={!intraEnabled || active}
        onClick={onIntraFocus}
        title="Cinematic intra-HO focus — tight beam-level close-up + slow motion"
      >
        Intra-HO Focus
      </button>
      <button
        type="button"
        className="leo-director-controls__btn"
        data-testid="director-inter-focus"
        disabled={!interEnabled || active}
        onClick={onInterFocus}
        title="Cinematic inter-HO focus — wide satellite-context shot + slow motion"
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
