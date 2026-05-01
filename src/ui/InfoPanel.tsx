import { MIN_VISIBLE_SINR_DB } from '../constants/sinr';
import { UI_TOKENS } from '../constants/uiTokens';
import type { Profile } from '../profiles/types';
import type { SimState } from '../scene/types';
import { formatBeamLabel, formatHandoverReason, formatSatelliteLabel } from '../utils/formatSatelliteLabel';
import type { UiMode } from './uiMode';

function sinrColor(sinrDb: number): string {
  if (sinrDb >= 20) return UI_TOKENS.color.signalQuality.great;
  if (sinrDb >= 10) return UI_TOKENS.color.signalQuality.good;
  if (sinrDb >= 5) return UI_TOKENS.color.signalQuality.warning;
  return UI_TOKENS.color.signalQuality.poor;
}

function deltaColor(deltaDb: number | null, offsetDb: number): string {
  if (deltaDb === null) return UI_TOKENS.color.semantic.inactive;
  if (deltaDb >= offsetDb) return UI_TOKENS.color.semantic.good;
  if (deltaDb >= 0) return UI_TOKENS.color.semantic.warning.accent;
  return UI_TOKENS.color.semantic.danger;
}

function formatSinr(sinrDb: number | null): string {
  if (sinrDb === null || !Number.isFinite(sinrDb) || sinrDb <= MIN_VISIBLE_SINR_DB) return '—';
  return `${sinrDb.toFixed(1)} dB`;
}

function formatElevation(elevationDeg: number | null): string {
  if (elevationDeg === null || !Number.isFinite(elevationDeg)) return '—';
  return `${elevationDeg.toFixed(1)}°`;
}

function formatSlantRange(rangeKm: number | null): string {
  if (rangeKm === null || !Number.isFinite(rangeKm)) return '—';
  return `${rangeKm.toFixed(0)} km`;
}

function formatDb(value: number): string {
  return `${value.toFixed(1)} dB`;
}

function formatDbm(value: number): string {
  return `${value.toFixed(1)} dBm`;
}

function formatStatusLabel(status: SimState['panelPrimary']['status']): string {
  switch (status) {
    case 'live':
      return 'live';
    case 'latched':
      return 'latched';
    case 'recent-ho':
      return 'recent HO';
    case 'derived':
      return 'derived';
    case 'none':
      return 'none';
  }
}

function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: string;
  tone?: 'serving' | 'candidate' | 'warning' | 'neutral';
}) {
  const color = tone === 'serving'
    ? UI_TOKENS.color.semantic.serving.badge
    : tone === 'candidate'
      ? UI_TOKENS.color.semantic.candidate.badge
      : tone === 'warning'
        ? UI_TOKENS.color.semantic.warning.badge
        : UI_TOKENS.color.text.secondary;
  const border = tone === 'serving'
    ? UI_TOKENS.color.semantic.serving.badgeBorder
    : tone === 'candidate'
      ? UI_TOKENS.color.semantic.candidate.badgeBorder
      : tone === 'warning'
        ? UI_TOKENS.color.semantic.warning.badgeBorder
        : 'rgba(255,255,255,0.16)';

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 7px',
      borderRadius: UI_TOKENS.radius.pill,
      border: `1px solid ${border}`,
      color,
      background: 'rgba(0,0,0,0.16)',
      fontSize: UI_TOKENS.type.size.tiny,
      fontWeight: UI_TOKENS.type.weight.heavy,
      lineHeight: 1.2,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    }}>
      {children}
    </span>
  );
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

function MetricTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={{
      padding: '8px 10px',
      borderRadius: UI_TOKENS.radius.md,
      background: 'rgba(255,255,255,0.12)',
      border: `1px solid ${UI_TOKENS.color.border.metric}`,
    }}>
      <div style={{ fontSize: UI_TOKENS.type.size.tiny, color: UI_TOKENS.color.text.secondary, letterSpacing: 0.4, marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: UI_TOKENS.type.size.body, fontWeight: UI_TOKENS.type.weight.strong, color: UI_TOKENS.color.text.primary }}>
        {value}
      </div>
    </div>
  );
}

type InfoPanelProps = SimState & {
  uiMode: UiMode;
  profile: Profile;
};

export function InfoPanel({
  physicalServing,
  panelPrimary,
  panelComparison,
  uiMode,
  profile,
  profileId,
  formulaFamilyLabel,
  servingSatId,
  servingBeamId,
  servingElevationDeg,
  servingRangeKm,
  pendingTargetSatId,
  pendingTargetBeamId,
  pendingTargetSinrDb,
  comparisonSatId,
  comparisonBeamId,
  comparisonElevationDeg,
  comparisonRangeKm,
  comparisonSinrDb,
  comparisonKind,
  sinrDeltaDb,
  recentHoSourceSatId,
  recentHoTargetSatId,
  sinrDb,
  physicalServingBudget,
  handoverOffsetDb,
  handoverTriggerProgressSec,
  handoverTriggerSec,
  hoCount,
  lastHoReason,
  beamHopEnabled,
  beamHopSlotIndex,
  beamHopSlotSec,
  servingBeamActiveThisSlot,
  servingSatActiveBeamIds,
  pendingTargetActiveBeamIds,
}: InfoPanelProps) {
  const hasServingSignal = servingSatId !== null && servingBeamId !== null;
  const hasComparisonSignal = comparisonSatId !== null && comparisonBeamId !== null;
  const triggerRatio = handoverTriggerSec > 0
    ? Math.min(handoverTriggerProgressSec / handoverTriggerSec, 1)
    : 0;
  const servingTitle = panelPrimary.role === 'ho-source' ? 'HO SOURCE' : 'ACTIVE SERVING';
  const servingCaption = panelPrimary.role === 'ho-source'
    ? 'previous source'
    : 'physical serving';
  const comparisonTitle =
    panelComparison.role === 'pending'
      ? 'PENDING TARGET'
      : panelComparison.role === 'ho-target'
        ? 'HO TARGET'
        : panelComparison.role === 'candidate'
          ? 'BEST CANDIDATE'
          : 'COMPARISON';
  const comparisonCaption =
    panelComparison.role === 'pending'
      ? 'handover timer'
      : panelComparison.role === 'ho-target'
        ? panelComparison.satId === physicalServing.satId ? 'recent target / serving now' : 'recent target'
        : panelComparison.role === 'candidate'
          ? 'derived comparison'
          : 'no comparison';
  const recentHoText = recentHoSourceSatId || recentHoTargetSatId
    ? `${formatSatelliteLabel(recentHoSourceSatId)} → ${formatSatelliteLabel(recentHoTargetSatId)}`
    : '—';
  const showProfileIdentity = uiMode !== 'tuning';
  const showHandoverMetrics = uiMode === 'diagnostics'
    || hasComparisonSignal
    || pendingTargetSatId !== null
    || sinrDeltaDb !== null
    || handoverTriggerProgressSec > 0;
  const showDiagnostics = uiMode === 'diagnostics';
  const showHandoverPolicyReadout = showDiagnostics;
  const beamPowerControl = profile.channel.beamPowerControl;
  const showDpcStatus =
    showDiagnostics
    && profile.formulaFamily === 'hobs-tr38811'
    && beamPowerControl !== undefined;
  const currentEffectiveServingPt = physicalServingBudget?.txPowerDbm;

  return (
    <div className="leo-info-panel" style={{
      position: 'absolute',
      top: 12,
      right: 12,
      zIndex: 10,
      background: UI_TOKENS.color.surface.panel,
      backdropFilter: 'blur(10px)',
      padding: '18px 20px',
      borderRadius: UI_TOKENS.radius.panel,
      border: `1px solid ${UI_TOKENS.color.border.panel}`,
      boxShadow: UI_TOKENS.shadow.panel,
      color: UI_TOKENS.color.text.primary,
      fontSize: UI_TOKENS.type.size.bodyLg,
      fontFamily: UI_TOKENS.type.family.mono,
      boxSizing: 'border-box',
      width: 'min(340px, calc(100vw - 24px))',
      minWidth: 0,
      overflowWrap: 'anywhere',
    }}>
      <div style={{ display: 'grid', gap: 14 }}>
        {showProfileIdentity && (profileId || formulaFamilyLabel) && (
          <div style={{
            padding: '10px 12px',
            background: UI_TOKENS.color.surface.cardSubtle,
            borderRadius: UI_TOKENS.radius.lg,
            border: `1px solid ${UI_TOKENS.color.border.subtle}`,
          }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.6, marginBottom: 4 }}>
              SIGNAL PROFILE
            </div>
            <div style={{ fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.text.primary, marginBottom: 2 }}>
              {formulaFamilyLabel ?? '—'}
            </div>
            <div style={{ fontSize: 12, color: UI_TOKENS.color.text.secondary }}>
              {profileId ?? '—'}
            </div>
          </div>
        )}

        <div data-testid="info-panel-primary-sinr-status" data-ownership="operational-sinr-status" style={{
          padding: '12px 14px',
          background: UI_TOKENS.color.semantic.serving.background,
          borderRadius: UI_TOKENS.radius.lg,
          border: `1px solid ${UI_TOKENS.color.semantic.serving.border}`,
          borderLeft: `5px solid ${UI_TOKENS.color.semantic.serving.accent}`,
          boxShadow: UI_TOKENS.color.semantic.serving.glow,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
          }}>
            <div style={{ fontSize: UI_TOKENS.type.size.caption, color: UI_TOKENS.color.semantic.serving.title, letterSpacing: 0.6, textShadow: '0 0 10px rgba(120, 205, 255, 0.55)' }}>
              {servingTitle}
            </div>
            <StatusBadge tone={panelPrimary.role === 'ho-source' ? 'warning' : 'serving'}>
              {panelPrimary.role === 'ho-source' ? 'recent HO' : formatStatusLabel(panelPrimary.status)}
            </StatusBadge>
          </div>
          <div style={{ fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.semantic.serving.caption, marginBottom: 6 }}>
            {servingCaption}
          </div>
          <div style={{ fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.text.primary, marginBottom: 4 }}>
            {hasServingSignal ? `${formatSatelliteLabel(servingSatId)} ${formatBeamLabel(servingBeamId)}` : 'none'}
          </div>
          <div style={{ fontSize: UI_TOKENS.type.size.signal, fontWeight: UI_TOKENS.type.weight.strong, color: hasServingSignal ? sinrColor(sinrDb) : UI_TOKENS.color.text.primary }}>
            {formatSinr(hasServingSignal ? sinrDb : null)}
          </div>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MetricTile
              label="Elevation"
              value={formatElevation(hasServingSignal ? servingElevationDeg : null)}
            />
            <MetricTile
              label="Slant Range"
              value={formatSlantRange(hasServingSignal ? servingRangeKm : null)}
            />
          </div>
        </div>

        <div data-testid="info-panel-comparison-sinr-status" data-ownership="operational-sinr-status" style={{
          padding: '12px 14px',
          background: UI_TOKENS.color.semantic.candidate.background,
          borderRadius: UI_TOKENS.radius.lg,
          border: `1px solid ${UI_TOKENS.color.semantic.candidate.border}`,
          borderLeft: `5px solid ${UI_TOKENS.color.semantic.candidate.accent}`,
          boxShadow: UI_TOKENS.color.semantic.candidate.glow,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
          }}>
            <div style={{ fontSize: UI_TOKENS.type.size.caption, color: UI_TOKENS.color.semantic.candidate.title, letterSpacing: 0.6, textShadow: '0 0 10px rgba(255, 210, 100, 0.42)' }}>
              {comparisonTitle}
            </div>
            <StatusBadge tone={panelComparison.role === 'ho-target' ? 'warning' : 'candidate'}>
              {formatStatusLabel(panelComparison.status)}
            </StatusBadge>
          </div>
          <div style={{ fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.semantic.candidate.caption, marginBottom: 6 }}>
            {comparisonCaption}
          </div>
          <div style={{ fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.text.primary, marginBottom: 4 }}>
            {hasComparisonSignal ? `${formatSatelliteLabel(comparisonSatId)} ${formatBeamLabel(comparisonBeamId)}` : 'none'}
          </div>
          <div style={{ fontSize: UI_TOKENS.type.size.signal, fontWeight: UI_TOKENS.type.weight.strong, color: hasComparisonSignal && comparisonSinrDb !== null ? sinrColor(comparisonSinrDb) : UI_TOKENS.color.text.primary }}>
            {formatSinr(hasComparisonSignal ? comparisonSinrDb : null)}
          </div>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <MetricTile
              label="Elevation"
              value={formatElevation(hasComparisonSignal ? comparisonElevationDeg : null)}
            />
            <MetricTile
              label="Slant Range"
              value={formatSlantRange(hasComparisonSignal ? comparisonRangeKm : null)}
            />
          </div>
        </div>
      </div>

      {showHandoverMetrics && (
        <div style={{ marginTop: 14, padding: '12px 14px', background: UI_TOKENS.color.surface.cardSubtle, borderRadius: UI_TOKENS.radius.lg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: UI_TOKENS.type.size.caption, color: UI_TOKENS.color.text.primary, marginBottom: 4 }}>SINR Delta <span style={{ color: 'rgba(255,255,255,0.48)' }}>(derived)</span></div>
              <div style={{ fontSize: UI_TOKENS.type.size.delta, fontWeight: UI_TOKENS.type.weight.strong, color: deltaColor(sinrDeltaDb, handoverOffsetDb) }}>
                {sinrDeltaDb !== null ? `${sinrDeltaDb >= 0 ? '+' : ''}${sinrDeltaDb.toFixed(1)} dB` : '—'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: UI_TOKENS.type.size.caption, color: UI_TOKENS.color.text.primary, marginBottom: 4 }}>Need Offset <span style={{ color: 'rgba(255,255,255,0.48)' }}>(config)</span></div>
              <div style={{ fontSize: UI_TOKENS.type.size.delta, fontWeight: UI_TOKENS.type.weight.strong, color: UI_TOKENS.color.text.primary }}>
                +{handoverOffsetDb.toFixed(1)} dB
              </div>
            </div>
          </div>

          <div style={{ fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.text.primary, marginBottom: 6 }}>
            Trigger Time <span style={{ color: 'rgba(255,255,255,0.48)' }}>(pending)</span>: {handoverTriggerProgressSec.toFixed(1)} / {handoverTriggerSec.toFixed(1)} s
          </div>
          <div style={{ height: 8, background: UI_TOKENS.color.border.subtle, borderRadius: UI_TOKENS.radius.pill, overflow: 'hidden' }}>
            <div style={{
              width: `${triggerRatio * 100}%`,
              height: '100%',
              background: sinrDeltaDb !== null && sinrDeltaDb >= handoverOffsetDb ? UI_TOKENS.color.semantic.good : UI_TOKENS.color.semantic.info,
              borderRadius: UI_TOKENS.radius.pill,
              transition: 'width 120ms linear',
            }}
            />
          </div>
        </div>
      )}

      <div style={{ marginTop: 14, padding: '12px 14px', background: UI_TOKENS.color.surface.cardSubtle, borderRadius: UI_TOKENS.radius.lg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <div style={{ fontSize: UI_TOKENS.type.size.caption, color: UI_TOKENS.color.text.primary, letterSpacing: 0.6 }}>BEAM HOPPING</div>
          <div style={{ fontSize: UI_TOKENS.type.size.caption, color: beamHopEnabled ? UI_TOKENS.color.semantic.good : UI_TOKENS.color.semantic.inactive }}>
            {beamHopEnabled ? 'ON' : 'OFF'}
          </div>
        </div>
        <div style={{ fontSize: UI_TOKENS.type.size.body, lineHeight: 1.45, color: UI_TOKENS.color.text.primary }}>
          Physical Serving Beam Active: {servingBeamActiveThisSlot === null ? '—' : servingBeamActiveThisSlot ? 'yes' : 'no'}
        </div>
      </div>

      {showHandoverPolicyReadout && (
        <div
          data-testid="handover-policy-readout"
          style={{
            marginTop: 10,
            padding: '11px 12px',
            borderRadius: UI_TOKENS.radius.lg,
            background: 'rgba(255, 176, 0, 0.06)',
            border: '1px solid rgba(255, 210, 100, 0.16)',
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          <div style={{ color: UI_TOKENS.color.semantic.fixed, fontWeight: 800, letterSpacing: 0.7, marginBottom: 7 }}>
            Handover policy (effective)
          </div>
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
        </div>
      )}

      {showDpcStatus && beamPowerControl && (
        <div
          data-testid="dpc-status-block"
          style={{
            marginTop: 10,
            padding: '11px 12px',
            borderRadius: UI_TOKENS.radius.lg,
            background: 'rgba(125, 226, 209, 0.07)',
            border: '1px solid rgba(125, 226, 209, 0.18)',
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          <div style={{ color: UI_TOKENS.color.semantic.tuning, fontWeight: 800, letterSpacing: 0.7, marginBottom: 7 }}>
            DPC: research power policy
          </div>
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
        </div>
      )}

      {showDiagnostics && (
        <div style={{
          marginTop: 10,
          padding: '10px 12px',
          borderRadius: UI_TOKENS.radius.lg,
          background: UI_TOKENS.color.surface.cardFaint,
          border: '1px solid rgba(255,255,255,0.06)',
          fontSize: 12,
          lineHeight: 1.45,
        }}>
          <div style={{ color: 'rgba(255,255,255,0.42)', fontWeight: 800, letterSpacing: 0.7, marginBottom: 7 }}>
            DEBUG / VALIDATION
          </div>
          <div style={{ display: 'grid', gap: 5 }}>
            <DebugRow
              label="Slot ID"
              value={beamHopEnabled && beamHopSlotIndex >= 0 ? String(beamHopSlotIndex) : '—'}
            />
            <DebugRow
              label="Slot Sec"
              value={beamHopEnabled ? `${beamHopSlotSec.toFixed(2)} s` : 'disabled'}
            />
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
            <DebugRow label="Last Reason" value={formatHandoverReason(lastHoReason) || '—'} />
          </div>
        </div>
      )}
    </div>
  );
}
