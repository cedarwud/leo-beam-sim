// The SINR-live tuning surface, rendered INLINE in the left aside (always visible,
// in-flow, one scroll). App injects the tuner panels as nodes so this component does
// not prop-drill their large sets.
//
// The former formula/handover drawers are gone. This slot now hosts only the
// homepage source/parameter surface. Walker handover policy is a separate
// legacy runtime and must not be mixed into the archived-TLE analysis frame.
import { type ReactElement, type ReactNode } from 'react';
import type { SixActsTeachingMode } from '../course/sixActs/teachingMode';
import { TeachingPanelDock, type TeachingLinkSnapshot } from './TeachingPanelDock';

interface SinrLiveDisplayDrawerProps {
  /** Homepage source and calculation-parameter surface. */
  readonly parameterSection?: ReactNode;
  /** Single engineering ⇄ teaching content switch for the homepage rail. */
  readonly teachingMode?: SixActsTeachingMode;
  readonly onTeachingModeChange?: (mode: SixActsTeachingMode) => void;
  readonly teachingLinkSnapshot?: TeachingLinkSnapshot;
  readonly teachingPolicySection?: ReactNode;
  readonly teachingPlatformSection?: ReactNode;
  /** Display-only medium switch for the homepage scene floor. */
  readonly campusVisible?: boolean;
  readonly onCampusVisibleChange?: () => void;
  /** Temporarily hides the teaching floor and teaching-mode dock on homepage. */
  readonly showTeachingAuxiliaryUi?: boolean;
}

export function SinrLiveDisplayDrawer({
  parameterSection,
  teachingMode = 'engineering',
  onTeachingModeChange = () => undefined,
  teachingLinkSnapshot = {
    ueId: null,
    servingSatelliteId: null,
    candidateSatelliteId: null,
    timeSec: null,
    thetaDeg: null,
    transmitGainLinear: null,
    sinrDb: null,
    throughputMbps: null,
    systemPowerW: null,
    energyEfficiencyBitsPerJoule: null,
  },
  teachingPolicySection,
  teachingPlatformSection,
  campusVisible,
  onCampusVisibleChange,
  showTeachingAuxiliaryUi = true,
}: SinrLiveDisplayDrawerProps): ReactElement {
  return (
    <section
      className="leo-sinr-advanced-inline leo-sidebar-content-stack"
      data-testid="sinr-live-display"
      aria-label="SINR-live tuning controls"
    >
      {showTeachingAuxiliaryUi && typeof campusVisible === 'boolean' && onCampusVisibleChange && (
      <section className="leo-teaching-surface-control" data-testid="teaching-surface-control" aria-label="教學地板">
        <div className="leo-teaching-surface-control__copy">
          <span className="leo-teaching-surface-control__eyebrow">SCENE FLOOR</span>
          <strong>教學地板</strong>
          <small>切換 NTPU 實景與抽象網格舞台；相機、衛星與燈光保持不變。</small>
        </div>
        <label className="leo-teaching-surface-control__toggle">
          <input
            type="checkbox"
            aria-label="顯示 NTPU 實景地板"
            data-testid="campus-visible-toggle"
            checked={campusVisible}
            onChange={onCampusVisibleChange}
          />
          <span>{campusVisible ? 'NTPU 實景' : '抽象舞台'}</span>
        </label>
      </section>
      )}
      <div className="leo-sinr-advanced-section" data-testid="sinr-live-advanced-formula">
        <div className="leo-sinr-advanced-body">
          {showTeachingAuxiliaryUi ? (
            <TeachingPanelDock
              mode={teachingMode}
              onModeChange={onTeachingModeChange}
              engineeringContent={parameterSection}
              linkSnapshot={teachingLinkSnapshot}
              policyContent={teachingPolicySection}
              platformContent={teachingPlatformSection}
            />
          ) : (
            <section className="leo-engineering-dock" data-testid="engineering-panel-dock">
              {parameterSection}
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
