import type { ReactNode } from 'react';
import { UI_TOKENS } from '../constants/uiTokens';
import type { Profile } from '../profiles/types';
import type { SimState } from '../scene/types';
import { formatBeamIdentity, formatHandoverReason, formatSatelliteLabel } from '../utils/formatSatelliteLabel';
import type { UiMode } from './uiMode';

type DiagnosticsDrawerProps = SimState & {
  uiMode: UiMode;
  profile: Profile;
};

function formatDb(value: number): string {
  return `${value.toFixed(1)} dB`;
}

function formatDbm(value: number): string {
  return `${value.toFixed(1)} dBm`;
}

function formatPanelBeamIdentity(
  satId: string | null,
  beamId: number | null,
  frequencyReuse: number,
  emptyLabel: string,
): string {
  if (!satId || beamId === null) return emptyLabel;
  return formatBeamIdentity({ satId, beamId, frequencyReuse });
}

function DebugRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(92px, 0.8fr) minmax(0, 1.2fr)',
      gap: 10,
      minWidth: 0,
    }}>
      <div style={{ color: UI_TOKENS.color.text.faint }}>{label}</div>
      <div style={{ color: UI_TOKENS.color.text.secondary, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  );
}

function DrawerSection({
  testId,
  tone,
  title,
  children,
}: {
  testId: string;
  tone: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      data-testid={testId}
      style={{
        padding: '11px 12px',
        borderRadius: UI_TOKENS.radius.lg,
        background: UI_TOKENS.color.surface.cardFaint,
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
        fontSize: 12,
        lineHeight: 1.45,
      }}
    >
      <div style={{
        color: tone,
        fontWeight: UI_TOKENS.type.weight.heavy,
        letterSpacing: 0.7,
        marginBottom: 7,
        textTransform: 'uppercase',
      }}>
        {title}
      </div>
      {children}
    </section>
  );
}

export function DiagnosticsDrawer({
  uiMode,
  profile,
  panelPrimary,
  panelComparison,
  recentHoSourceSatId,
  recentHoTargetSatId,
  physicalServingBudget,
  hoCount,
  lastHoReason,
  beamHopEnabled,
  beamHopSlotIndex,
  beamHopSlotSec,
  servingBeamActiveThisSlot,
  servingSatActiveBeamIds,
  pendingTargetActiveBeamIds,
}: DiagnosticsDrawerProps) {
  const expanded = uiMode === 'diagnostics';
  const frequencyReuse = profile.beams.frequencyReuse;
  const beamPowerControl = profile.channel.beamPowerControl;
  const showDpcStatus =
    expanded
    && profile.formulaFamily === 'hobs-tr38811'
    && beamPowerControl !== undefined;
  const recentHoSourceIdentity = panelPrimary.role === 'ho-source'
    ? formatPanelBeamIdentity(panelPrimary.satId, panelPrimary.beamId, frequencyReuse, '—')
    : recentHoSourceSatId
      ? formatSatelliteLabel(recentHoSourceSatId)
      : '—';
  const recentHoTargetIdentity = panelComparison.role === 'ho-target'
    ? formatPanelBeamIdentity(panelComparison.satId, panelComparison.beamId, frequencyReuse, '—')
    : recentHoTargetSatId
      ? formatSatelliteLabel(recentHoTargetSatId)
      : '—';
  const recentHoText = recentHoSourceSatId || recentHoTargetSatId
    ? `${recentHoSourceIdentity} → ${recentHoTargetIdentity}`
    : '—';
  const currentEffectiveServingPt = physicalServingBudget?.txPowerDbm;

  if (!expanded) {
    return (
      <section
        className="leo-diagnostics-drawer"
        data-testid="diagnostics-drawer"
        data-drawer-state="collapsed"
        aria-label="Diagnostics drawer"
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 'min(188px, 100%)',
          padding: '8px 10px',
          borderRadius: UI_TOKENS.radius.md,
          border: `1px solid ${UI_TOKENS.color.border.soft}`,
          background: 'rgba(5, 16, 26, 0.94)',
          color: UI_TOKENS.color.text.secondary,
          fontFamily: UI_TOKENS.type.family.mono,
          fontSize: UI_TOKENS.type.size.caption,
          fontWeight: UI_TOKENS.type.weight.heavy,
          letterSpacing: 0.4,
          pointerEvents: 'auto',
          zIndex: 4,
        }}
      >
        <div data-testid="diagnostics-drawer-tab">Diagnostics</div>
      </section>
    );
  }

  return (
    <section
      className="leo-diagnostics-drawer"
      data-testid="diagnostics-drawer"
      data-drawer-state="expanded"
      aria-label="Diagnostics drawer"
      style={{
        minWidth: 0,
        minHeight: 0,
        height: '100%',
        padding: '13px 14px',
        borderRadius: UI_TOKENS.radius.panel,
        border: `1px solid ${UI_TOKENS.color.border.panel}`,
        background: UI_TOKENS.color.surface.panel,
        boxShadow: UI_TOKENS.shadow.panel,
        color: UI_TOKENS.color.text.primary,
        fontFamily: UI_TOKENS.type.family.mono,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
      }}
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
        }}>
          <div style={{
            color: UI_TOKENS.color.text.controlLabel,
            fontSize: UI_TOKENS.type.size.caption,
            fontWeight: UI_TOKENS.type.weight.heavy,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}>
            Diagnostics
          </div>
          <div style={{
            color: UI_TOKENS.color.semantic.info,
            fontSize: UI_TOKENS.type.size.tiny,
            fontWeight: UI_TOKENS.type.weight.heavy,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}>
            drawer
          </div>
        </div>

        <DrawerSection
          testId="diagnostics-drawer-beam-hopping"
          tone={beamHopEnabled ? UI_TOKENS.color.semantic.good : UI_TOKENS.color.semantic.inactive}
          title="BEAM HOPPING"
        >
          <div style={{ display: 'grid', gap: 5 }}>
            <DebugRow
              label="Enabled"
              value={beamHopEnabled ? 'ON' : 'OFF'}
            />
            <DebugRow
              label="Slot ID"
              value={beamHopEnabled && beamHopSlotIndex >= 0 ? String(beamHopSlotIndex) : '—'}
            />
            <DebugRow
              label="Slot Sec"
              value={beamHopEnabled ? `${beamHopSlotSec.toFixed(2)} s` : 'disabled'}
            />
            <DebugRow
              label="Physical Serving Beam Active"
              value={servingBeamActiveThisSlot === null ? '—' : servingBeamActiveThisSlot ? 'yes' : 'no'}
            />
          </div>
        </DrawerSection>

        <DrawerSection
          testId="handover-policy-readout"
          tone={UI_TOKENS.color.semantic.fixed}
          title="Handover policy (effective)"
        >
          <div style={{ display: 'grid', gap: 5 }}>
            <DebugRow label="policy" value={`${profile.handover.policy} (read-only)`} />
            <DebugRow label="Offset margin" value={formatDb(profile.handover.offsetDb)} />
            <DebugRow label="Trigger time" value={`${profile.handover.triggerTimeSec.toFixed(1)} s`} />
            <DebugRow label="Ping-pong guard" value={`${profile.handover.pingPongGuardSec.toFixed(1)} s`} />
            <DebugRow label="Decision smoothing" value={`${profile.handover.sinrSmoothingSec.toFixed(1)} s`} />
            <DebugRow label="Same-sat dwell" value={`${profile.handover.intraSwitchTimeSec.toFixed(1)} s`} />
            <DebugRow label="Pending hold" value={`${profile.handover.pendingTargetHoldSec.toFixed(1)} s`} />
            <DebugRow label="Handover attach threshold" value={formatDb(profile.handover.sinrThresholdDb)} />
          </div>
        </DrawerSection>

        {showDpcStatus && beamPowerControl && (
          <DrawerSection
            testId="dpc-status-block"
            tone={UI_TOKENS.color.semantic.tuning}
            title="DPC: research power policy"
          >
            <div style={{ color: UI_TOKENS.color.text.secondary, marginBottom: 8 }}>
              This is a TR 38.811-gated research power policy. Enabled only for HOBS + TR 38.811 research profile. Base P_t remains the Tuning control; DPC may override per-beam P_{'{n,m}'}(t).
            </div>
            <div style={{ display: 'grid', gap: 5 }}>
              <DebugRow label="Gate" value="HOBS + TR 38.811 research profile" />
              <DebugRow label="Update Period" value={`${beamPowerControl.updatePeriodSec.toFixed(2)} s`} />
              <DebugRow label="Step Size" value={formatDb(beamPowerControl.stepDb)} />
              <DebugRow label="Min Effective" value={formatDbm(beamPowerControl.minTxPowerDbm)} />
              <DebugRow label="Max / Clamp" value={`${formatDbm(profile.channel.maxTxPowerDbm)} base P_t clamp`} />
              <DebugRow label="SINR Threshold" value={formatDb(beamPowerControl.sinrThresholdDb)} />
              <DebugRow
                label="Serving P_t"
                value={currentEffectiveServingPt === undefined
                  ? 'missing from current LinkBudgetTerms'
                  : `${formatDbm(currentEffectiveServingPt)} physical-serving effective P_t`}
              />
            </div>
          </DrawerSection>
        )}

        <DrawerSection
          testId="diagnostics-drawer-debug-validation"
          tone={UI_TOKENS.color.text.faint}
          title="DEBUG / VALIDATION"
        >
          <div style={{ display: 'grid', gap: 5 }}>
            <DebugRow
              label="Serving IDs"
              value={servingSatActiveBeamIds.length ? servingSatActiveBeamIds.join(', ') : '—'}
            />
            <DebugRow
              label="Pending IDs"
              value={pendingTargetActiveBeamIds.length ? pendingTargetActiveBeamIds.join(', ') : '—'}
            />
            <DebugRow label="Recent HO" value={recentHoText} />
            <DebugRow label="HO Count" value={String(hoCount)} />
            <DebugRow label="Last Reason" value={formatHandoverReason(lastHoReason, frequencyReuse) || '—'} />
          </div>
        </DrawerSection>
      </div>
    </section>
  );
}
