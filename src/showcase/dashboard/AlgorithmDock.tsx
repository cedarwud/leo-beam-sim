import { useState, type JSX } from 'react';
import { AlgorithmDashboard, type AlgorithmDashboardProps } from './AlgorithmDashboard';
import { LiveTelemetryPanel } from './LiveTelemetryPanel';

export interface AlgorithmDockProps {
  readonly mode: 'artifact' | 'live';
  readonly artifact?: AlgorithmDashboardProps['artifact'];
  readonly frameIndex?: AlgorithmDashboardProps['frameIndex'];
  readonly currentTimeSecRef?: AlgorithmDashboardProps['currentTimeSecRef'];
}

export function AlgorithmDock({
  mode,
  artifact,
  frameIndex = 0,
  currentTimeSecRef = null,
}: AlgorithmDockProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const title = mode === 'artifact' ? 'Algorithm Pipeline' : 'Live Training';
  const subtitle = mode === 'artifact' ? 'visual-showcase-v1 replay truth' : 'Plane-A SSE (episode-coarse)';

  return (
    <section
      className="leo-algorithm-dock"
      data-testid="algorithm-dock"
      data-collapsed={collapsed ? 'true' : 'false'}
      data-mode={mode}
      aria-label="Algorithm pipeline dock"
    >
      <header className="leo-algorithm-dock__header">
        <div className="leo-algorithm-dock__title">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <button
          type="button"
          className="leo-algorithm-dock__toggle"
          data-testid="algorithm-dock-toggle"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(value => !value)}
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </header>
      {!collapsed ? (
        <div className="leo-algorithm-dock__body">
          {mode === 'artifact' ? (
            <AlgorithmDashboard
              artifact={artifact ?? null}
              frameIndex={frameIndex}
              currentTimeSecRef={currentTimeSecRef}
              variant="dock"
              content="flowchart"
            />
          ) : (
            <LiveTelemetryPanel variant="dock" />
          )}
        </div>
      ) : null}
    </section>
  );
}
