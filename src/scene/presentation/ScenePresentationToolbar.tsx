import {
  SCENE_PRESENTATION_STAGE_OPTIONS,
  type ScenePresentationStageId,
} from './scenePresentation';
import './ScenePresentationToolbar.scss';

export interface ScenePresentationToolbarProps {
  readonly currentStage: ScenePresentationStageId;
  readonly onStageChange: (stage: ScenePresentationStageId) => void;
}

/**
 * Small presentation-only control for the scene presenter.
 *
 * The toolbar selects a visibility preset only.  It does not own a simulation
 * frame and it does not expose or mutate any SINR, power, throughput, EE, TLE,
 * or handover value.
 */
export function ScenePresentationToolbar({
  currentStage,
  onStageChange,
}: ScenePresentationToolbarProps) {
  const activeOption = SCENE_PRESENTATION_STAGE_OPTIONS.find(option => option.id === currentStage)
    ?? SCENE_PRESENTATION_STAGE_OPTIONS[SCENE_PRESENTATION_STAGE_OPTIONS.length - 1];

  return (
    <nav
      className="scene-presentation-toolbar"
      data-testid="scene-presentation-toolbar"
      aria-label="場景呈現階段"
    >
      <div className="scene-presentation-toolbar__heading">
        <span className="scene-presentation-toolbar__eyebrow">場景呈現</span>
        <span className="scene-presentation-toolbar__status" aria-live="polite">
          <strong>{activeOption.index}</strong>
          <span>{activeOption.label}</span>
        </span>
      </div>

      <div className="scene-presentation-toolbar__buttons" role="group" aria-label="選擇呈現階段">
        {SCENE_PRESENTATION_STAGE_OPTIONS.map(option => {
          const selected = option.id === currentStage;
          return (
            <button
              key={option.id}
              type="button"
              className={selected ? 'is-active' : undefined}
              data-testid={`scene-presentation-stage-${option.id}`}
              aria-current={selected ? 'step' : undefined}
              aria-pressed={selected}
              onClick={() => onStageChange(option.id)}
            >
              <span className="scene-presentation-toolbar__index" aria-hidden="true">{option.index}</span>
              <span className="scene-presentation-toolbar__label">{option.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
