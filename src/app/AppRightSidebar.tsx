import type { ComponentProps, ReactNode } from 'react';
import { AlgorithmDashboard } from '../showcase/dashboard/AlgorithmDashboard';
import { ClaimBoundaryBanner } from '../ui/ClaimBoundaryBanner';
import { HomepageCanonicalRightRail } from '../ui/HomepageCanonicalRightRail';
import { SidebarTabShell, type SidebarTabItem } from '../ui/SidebarTabShell';
import type { VisualShowcaseArtifact } from '../scene/visual-showcase-contract';
import type { NormalizedSceneFrame } from '../scene/NormalizedSceneFrame';
import type { RightSidebarTab } from './appRuntimeModel';

export interface AppRightSidebarProps {
  readonly shellVisible: boolean;
  readonly isArchivedTleSceneActive: boolean;
  readonly homepageCanonicalRightRailProps: ComponentProps<typeof HomepageCanonicalRightRail>;
  readonly teachingRail: ReactNode;
  readonly homepageRailPanel: ReactNode;
  readonly visibleTabs: readonly SidebarTabItem<RightSidebarTab>[];
  readonly activeTab: RightSidebarTab;
  readonly onTabChange: (tab: RightSidebarTab) => void;
  readonly showcaseArtifact: VisualShowcaseArtifact | null;
  readonly showcaseError: string | null;
  readonly activeSceneFrame: NormalizedSceneFrame | undefined;
  readonly frameIndex: number;
  readonly handoverEventRail: ReactNode;
  readonly liveRailSnapshotId: string;
  readonly liveRailSourceFrameId: string;
  readonly liveRailPhase: string;
  readonly liveStatusContent: ReactNode;
}

/** Owns right-side route selection and artifact/live sidebar composition. */
export function AppRightSidebar({
  shellVisible,
  isArchivedTleSceneActive,
  homepageCanonicalRightRailProps,
  teachingRail,
  homepageRailPanel,
  visibleTabs,
  activeTab,
  onTabChange,
  showcaseArtifact,
  showcaseError,
  activeSceneFrame,
  frameIndex,
  handoverEventRail,
  liveRailSnapshotId,
  liveRailSourceFrameId,
  liveRailPhase,
  liveStatusContent,
}: AppRightSidebarProps) {
  return (
    <aside
      className="leo-shell-right"
      data-shell-visibility={shellVisible ? 'visible' : 'hidden'}
      aria-label="Calculated values panel"
      aria-hidden={!shellVisible}
    >
      {isArchivedTleSceneActive ? (
        <HomepageCanonicalRightRail {...homepageCanonicalRightRailProps} />
      ) : teachingRail !== null ? (
        teachingRail
      ) : homepageRailPanel !== null ? (
        homepageRailPanel
      ) : visibleTabs.length > 0 ? (
        <SidebarTabShell
          label="Simulation status sidebar"
          side="right"
          tabs={visibleTabs}
          activeKey={activeTab}
          onChange={onTabChange}
        >
          {activeTab === 'artifact' ? (
            <section
              className="leo-sidebar-content-stack"
              aria-label="Artifact truth status"
              data-testid="artifact-truth-sidebar"
              data-artifact-loaded={showcaseArtifact ? 'true' : 'false'}
            >
              {activeSceneFrame ? <ClaimBoundaryBanner frame={activeSceneFrame} /> : null}
              {handoverEventRail}
              <div className="leo-replay-truth-summary" data-testid="artifact-truth-source-summary">
                <strong>{showcaseArtifact?.scenario.truthMode ?? 'artifact truth'}</strong>
                <span>{showcaseArtifact?.provenance.validation.status ?? showcaseError ?? 'loading'}</span>
              </div>
              <AlgorithmDashboard
                artifact={showcaseArtifact}
                frameIndex={frameIndex}
                variant="sidebar"
                content="metrics"
              />
            </section>
          ) : activeTab === 'live' ? (
            <section
              className="leo-live-status-stack"
              aria-label="Live status for current scene"
              data-homepage-rail-snapshot-id={liveRailSnapshotId}
              data-homepage-rail-source-frame-id={liveRailSourceFrameId}
              data-homepage-rail-phase={liveRailPhase}
            >
              {liveStatusContent}
            </section>
          ) : null}
        </SidebarTabShell>
      ) : null}
    </aside>
  );
}
