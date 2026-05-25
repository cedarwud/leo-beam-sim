import type { KeyboardEvent } from 'react';
import { APP_EXPERIENCE_MODES, type AppExperienceMode } from './appMode';

export interface AppModeRailProps {
  readonly mode: AppExperienceMode;
  readonly onChange: (mode: AppExperienceMode) => void;
}

const LABEL_BY_MODE: Readonly<Record<AppExperienceMode, { label: string; sub: string }>> = {
  'sinr-experiment': { label: 'SINR', sub: '實驗' },
  'modqn-demo': { label: 'MODQN', sub: 'demo' },
};

function focusAppModeButton(mode: AppExperienceMode): void {
  window.requestAnimationFrame(() => {
    document.querySelector<HTMLButtonElement>(`[data-testid="app-mode-${mode}"]`)?.focus();
  });
}

export function AppModeRail({ mode, onChange }: AppModeRailProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;

    if (event.key === 'ArrowDown') {
      nextIndex = (index + 1) % APP_EXPERIENCE_MODES.length;
    } else if (event.key === 'ArrowUp') {
      nextIndex = (index - 1 + APP_EXPERIENCE_MODES.length) % APP_EXPERIENCE_MODES.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = APP_EXPERIENCE_MODES.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    const nextMode = APP_EXPERIENCE_MODES[nextIndex];
    onChange(nextMode);
    focusAppModeButton(nextMode);
  };

  return (
    <nav
      className="leo-app-mode-rail"
      role="tablist"
      aria-label="App experience mode"
      data-testid="app-mode-rail"
      aria-orientation="vertical"
    >
      <button
        role="tab"
        type="button"
        className="leo-app-mode-rail__button"
        data-testid="app-mode-sinr-experiment"
        data-active={mode === 'sinr-experiment' ? 'true' : 'false'}
        aria-selected={mode === 'sinr-experiment'}
        tabIndex={mode === 'sinr-experiment' ? 0 : -1}
        onClick={() => onChange('sinr-experiment')}
        onKeyDown={event => handleKeyDown(event, 0)}
      >
        <span className="leo-app-mode-rail__label">{LABEL_BY_MODE['sinr-experiment'].label}</span>
        <small className="leo-app-mode-rail__sub">{LABEL_BY_MODE['sinr-experiment'].sub}</small>
      </button>
      <button
        role="tab"
        type="button"
        className="leo-app-mode-rail__button"
        data-testid="app-mode-modqn-demo"
        data-active={mode === 'modqn-demo' ? 'true' : 'false'}
        aria-selected={mode === 'modqn-demo'}
        tabIndex={mode === 'modqn-demo' ? 0 : -1}
        onClick={() => onChange('modqn-demo')}
        onKeyDown={event => handleKeyDown(event, 1)}
      >
        <span className="leo-app-mode-rail__label">{LABEL_BY_MODE['modqn-demo'].label}</span>
        <small className="leo-app-mode-rail__sub">{LABEL_BY_MODE['modqn-demo'].sub}</small>
      </button>
    </nav>
  );
}
