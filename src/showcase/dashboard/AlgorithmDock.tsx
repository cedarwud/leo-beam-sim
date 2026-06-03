import { useState, type JSX } from 'react';
import { AlgorithmDashboard, type AlgorithmDashboardProps } from './AlgorithmDashboard';

export type AlgorithmDockProps = Pick<
  AlgorithmDashboardProps,
  'artifact' | 'frameIndex' | 'currentTimeSecRef'
>;

export function AlgorithmDock({
  artifact,
  frameIndex,
  currentTimeSecRef,
}: AlgorithmDockProps): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section
      className="leo-algorithm-dock"
      data-testid="algorithm-dock"
      data-collapsed={collapsed ? 'true' : 'false'}
      aria-label="MODQN algorithm pipeline dock"
    >
      <header className="leo-algorithm-dock__header">
        <div className="leo-algorithm-dock__title">
          <strong>MODQN Algorithm Pipeline</strong>
          <span>visual-showcase-v1 replay truth</span>
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
          <AlgorithmDashboard
            artifact={artifact}
            frameIndex={frameIndex}
            currentTimeSecRef={currentTimeSecRef}
            variant="dock"
          />
        </div>
      ) : null}
    </section>
  );
}
