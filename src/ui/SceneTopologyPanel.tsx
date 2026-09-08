import type { ReactElement } from 'react';
import type { AppExperienceMode } from './appMode';
import type { Profile } from '../profiles/types';
import {
  createSceneTopologyState,
  type SceneTopologyState,
} from '../sceneTopology';
import type { SceneVisualScaleState } from '../sceneVisualScale';
import { TopologyTab } from './signal-tuning/TopologyTab';

interface SceneTopologyPanelProps {
  readonly appMode: AppExperienceMode;
  readonly baseProfile: Profile;
  readonly topology: SceneTopologyState;
  readonly sceneVisualScale: SceneVisualScaleState;
  readonly onTopologyChange: (next: SceneTopologyState) => void;
  readonly onSceneVisualScaleChange: (next: SceneVisualScaleState) => void;
}

/**
 * The live-cell lane reuses the live scene, but does not mount the full
 * SINR/EE tuning panel. Keep the scene topology controls available there too,
 * otherwise a persisted beam override can be active while its clear button is
 * unreachable. Recorded artifact lanes deliberately do not mount this panel.
 */
export function SceneTopologyPanel({
  appMode,
  baseProfile,
  topology,
  sceneVisualScale,
  onTopologyChange,
  onSceneVisualScaleChange,
}: SceneTopologyPanelProps): ReactElement {
  return (
    <section
      className="leo-sinr-advanced-inline leo-sidebar-content-stack"
      data-testid="scene-topology-panel"
      aria-label="Scene setup"
    >
      <TopologyTab
        topology={topology}
        sceneVisualScale={sceneVisualScale}
        baseProfile={baseProfile}
        appMode={appMode}
        onTopologyChange={onTopologyChange}
        onSceneVisualScaleChange={onSceneVisualScaleChange}
        onReset={() => onTopologyChange(createSceneTopologyState())}
      />
    </section>
  );
}
