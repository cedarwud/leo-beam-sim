import type { ComponentProps, ReactNode } from 'react';
import { ArchivedTleBoundaryNote } from '../ui/ArchivedTleBoundaryNote';
import { HomepageCanonicalControls } from '../ui/signal-tuning/HomepageCanonicalControls';
import { HandoverPolicyControls } from '../ui/HandoverPolicyControls';
import { SidebarTabShell, type SidebarTabItem } from '../ui/SidebarTabShell';
import { SignalTuningPanel } from '../ui/SignalTuningPanel';
import { SinrLiveDisplayDrawer } from '../ui/SinrLiveDisplayDrawer';
import type { VisualShowcaseArtifact } from '../scene/visual-showcase-contract';
import type { SceneLane } from './sceneLane';
import type { LeftSidebarTab } from './appRuntimeModel';
import type { SixActsTeachingMode } from '../course/sixActs/teachingMode';
import type { TeachingLinkSnapshot } from '../ui/TeachingPanelDock';

type SignalTuningProps = Omit<ComponentProps<typeof SignalTuningPanel>, 'handoverPolicySection'>;

export interface AppLeftSidebarProps {
  readonly collapsed: boolean;
  readonly shellVisible: boolean;
  readonly sceneLane: SceneLane;
  readonly visibleTabs: readonly SidebarTabItem<LeftSidebarTab>[];
  readonly activeTab: LeftSidebarTab;
  readonly onToggleCollapsed: () => void;
  readonly onTabChange: (tab: LeftSidebarTab) => void;
  readonly showcaseArtifact: VisualShowcaseArtifact | null;
  readonly showcaseLoading: boolean;
  readonly showcaseError: string | null;
  readonly frameIndex: number;
  readonly currentTimeSec: number;
  readonly showTeachingAuxiliaryUi: boolean;
  readonly campusVisible: boolean;
  readonly onCampusVisibleChange: () => void;
  readonly teachingMode: SixActsTeachingMode;
  readonly onTeachingModeChange: (mode: SixActsTeachingMode) => void;
  readonly teachingLinkSnapshot: TeachingLinkSnapshot;
  readonly isWalkerSceneActive: boolean;
  readonly handoverPolicyProps: ComponentProps<typeof HandoverPolicyControls>;
  readonly archivedBoundaryProps: ComponentProps<typeof ArchivedTleBoundaryNote>;
  readonly signalTuningProps: SignalTuningProps;
  readonly canonicalControlsProps: ComponentProps<typeof HomepageCanonicalControls>;
}

/** Owns the left-side shell routing and its lane-specific input surfaces. */
export function AppLeftSidebar({
  collapsed,
  shellVisible,
  sceneLane,
  visibleTabs,
  activeTab,
  onToggleCollapsed,
  onTabChange,
  showcaseArtifact,
  showcaseLoading,
  showcaseError,
  frameIndex,
  currentTimeSec,
  showTeachingAuxiliaryUi,
  campusVisible,
  onCampusVisibleChange,
  teachingMode,
  onTeachingModeChange,
  teachingLinkSnapshot,
  isWalkerSceneActive,
  handoverPolicyProps,
  archivedBoundaryProps,
  signalTuningProps,
  canonicalControlsProps,
}: AppLeftSidebarProps) {
  const teachingPolicySection: ReactNode = isWalkerSceneActive
    ? <HandoverPolicyControls {...handoverPolicyProps} />
    : <ArchivedTleBoundaryNote {...archivedBoundaryProps} />;
  const signalTuningSection: ReactNode = isWalkerSceneActive
    ? <SignalTuningPanel
        {...signalTuningProps}
        handoverPolicySection={<HandoverPolicyControls {...handoverPolicyProps} />}
      />
    : <HomepageCanonicalControls {...canonicalControlsProps} />;

  return (
    <aside
      className="leo-shell-left"
      data-left-sidebar-state={collapsed ? 'collapsed' : 'expanded'}
      data-shell-visibility={shellVisible ? 'visible' : 'hidden'}
      aria-label="Signal tuning panel slot"
      aria-hidden={!shellVisible}
    >
      <button
        type="button"
        className="leo-left-sidebar-toggle"
        data-testid="left-sidebar-toggle"
        aria-controls="left-sidebar-content"
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand left sidebar' : 'Collapse left sidebar to the left'}
        onClick={onToggleCollapsed}
      >
        <span className="leo-left-sidebar-toggle__icon" aria-hidden="true">
          {collapsed ? '›' : '‹'}
        </span>
      </button>
      <div id="left-sidebar-content" className="leo-left-sidebar-content">
        {sceneLane === 'artifact-replay' && (
          <SidebarTabShell
            label="Simulation control sidebar"
            side="left"
            tabs={visibleTabs}
            activeKey={activeTab}
            onChange={onTabChange}
          >
            {activeTab === 'evidence' ? (
              <section
                className="leo-sidebar-content-stack"
                aria-label="Artifact replay source status"
                data-testid="artifact-replay-sidebar"
                data-artifact-loaded={showcaseArtifact ? 'true' : 'false'}
                data-artifact-loading={showcaseLoading ? 'true' : 'false'}
                data-artifact-frame-index={String(frameIndex)}
              >
                <div className="leo-replay-truth-summary" data-testid="artifact-replay-source-summary">
                  <strong>{showcaseArtifact?.scenario.title ?? 'Artifact replay'}</strong>
                  <span>{showcaseError ?? showcaseArtifact?.artifactId ?? 'loading visual-showcase-v1'}</span>
                </div>
                <div className="leo-replay-playback-status" data-testid="artifact-replay-playback-status">
                  t={currentTimeSec.toFixed(1)}s / {showcaseArtifact?.scenario.durationSec.toFixed(1) ?? '0.0'}s
                </div>
              </section>
            ) : null}
          </SidebarTabShell>
        )}
        {sceneLane === 'sinr-live' && (
          <SinrLiveDisplayDrawer
            showTeachingAuxiliaryUi={showTeachingAuxiliaryUi}
            campusVisible={campusVisible}
            onCampusVisibleChange={onCampusVisibleChange}
            teachingMode={teachingMode}
            onTeachingModeChange={onTeachingModeChange}
            teachingLinkSnapshot={teachingLinkSnapshot}
            teachingPolicySection={teachingPolicySection}
            parameterSection={signalTuningSection}
          />
        )}
      </div>
    </aside>
  );
}
