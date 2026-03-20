import { MIN_VISIBLE_SINR_DB } from '../constants/sinr';
import type { SimState } from '../scene/types';
import { formatBeamLabel, formatHandoverReason, formatSatelliteLabel } from '../utils/formatSatelliteLabel';

const SERVING_BEAM_COLOR = '#0088ff';
const CANDIDATE_BEAM_COLOR = '#ffb000';
const CANDIDATE_BEAM_BORDER = '#ffd36a';
const CANDIDATE_BEAM_TITLE = '#fff1cf';

function sinrColor(sinrDb: number): string {
  if (sinrDb >= 20) return '#00ff00';
  if (sinrDb >= 10) return '#aaff00';
  if (sinrDb >= 5) return '#ffaa00';
  return '#ff4444';
}

function deltaColor(deltaDb: number | null, offsetDb: number): string {
  if (deltaDb === null) return '#7f8896';
  if (deltaDb >= offsetDb) return '#00ff88';
  if (deltaDb >= 0) return '#ffd84a';
  return '#ff7d7d';
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
      borderRadius: 8,
      background: 'rgba(255,255,255,0.12)',
      border: '1px solid rgba(255,255,255,0.18)',
    }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', letterSpacing: 0.4, marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>
        {value}
      </div>
    </div>
  );
}

export function InfoPanel({
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
}: SimState) {
  const hasServingSignal = servingSatId !== null && servingBeamId !== null;
  const hasComparisonSignal = comparisonSatId !== null && comparisonBeamId !== null;
  const triggerRatio = handoverTriggerSec > 0
    ? Math.min(handoverTriggerProgressSec / handoverTriggerSec, 1)
    : 0;
  const servingTitle = comparisonKind === 'recent-ho' ? 'HO SOURCE' : 'SERVING BEAM';
  const comparisonTitle =
    comparisonKind === 'pending'
      ? 'PENDING TARGET'
      : comparisonKind === 'recent-ho'
        ? 'HO TARGET'
        : comparisonKind === 'candidate'
          ? 'BEST CANDIDATE'
          : 'COMPARISON';

  return (
    <div style={{
      position: 'absolute',
      top: 12,
      right: 12,
      zIndex: 10,
      background: 'rgba(3, 10, 18, 0.84)',
      backdropFilter: 'blur(10px)',
      padding: '18px 20px',
      borderRadius: 14,
      border: '1px solid rgba(126, 167, 214, 0.24)',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
      color: 'white',
      fontSize: 17,
      fontFamily: 'monospace',
      width: 320,
    }}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{
          padding: '12px 14px',
          background: 'linear-gradient(180deg, rgba(0, 136, 255, 0.56), rgba(0, 136, 255, 0.28))',
          borderRadius: 10,
          border: `1px solid rgba(140, 210, 255, 0.95)`,
          borderLeft: '5px solid #38b6ff',
          boxShadow: 'inset 0 0 34px rgba(130, 205, 255, 0.34), 0 0 24px rgba(0, 136, 255, 0.24)',
        }}>
          <div style={{ fontSize: 13, color: '#dff4ff', marginBottom: 6, letterSpacing: 0.6, textShadow: '0 0 10px rgba(120, 205, 255, 0.55)' }}>{servingTitle}</div>
          <div style={{ fontSize: 16, color: '#ffffff', marginBottom: 4 }}>
            {hasServingSignal ? `${formatSatelliteLabel(servingSatId)} ${formatBeamLabel(servingBeamId)}` : 'none'}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: hasServingSignal ? sinrColor(sinrDb) : '#ffffff' }}>
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

        <div style={{
          padding: '12px 14px',
          background: 'linear-gradient(180deg, rgba(255, 176, 0, 0.56), rgba(255, 176, 0, 0.26))',
          borderRadius: 10,
          border: `1px solid ${CANDIDATE_BEAM_BORDER}`,
          borderLeft: `5px solid ${CANDIDATE_BEAM_COLOR}`,
          boxShadow: 'inset 0 0 30px rgba(255, 212, 106, 0.28), 0 0 22px rgba(255, 176, 0, 0.2)',
        }}>
          <div style={{ fontSize: 13, color: CANDIDATE_BEAM_TITLE, marginBottom: 6, letterSpacing: 0.6, textShadow: '0 0 10px rgba(255, 210, 100, 0.42)' }}>{comparisonTitle}</div>
          <div style={{ fontSize: 16, color: '#ffffff', marginBottom: 4 }}>
            {hasComparisonSignal ? `${formatSatelliteLabel(comparisonSatId)} ${formatBeamLabel(comparisonBeamId)}` : 'none'}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: hasComparisonSignal && comparisonSinrDb !== null ? sinrColor(comparisonSinrDb) : '#ffffff' }}>
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

      <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 13, color: '#ffffff', marginBottom: 4 }}>SINR Delta</div>
            <div style={{ fontSize: 25, fontWeight: 700, color: deltaColor(sinrDeltaDb, handoverOffsetDb) }}>
              {sinrDeltaDb !== null ? `${sinrDeltaDb >= 0 ? '+' : ''}${sinrDeltaDb.toFixed(1)} dB` : '—'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: '#ffffff', marginBottom: 4 }}>Need Offset</div>
            <div style={{ fontSize: 25, fontWeight: 700, color: '#ffffff' }}>
              +{handoverOffsetDb.toFixed(1)} dB
            </div>
          </div>
        </div>

        <div style={{ fontSize: 15, color: '#ffffff', marginBottom: 6 }}>
          Trigger Time: {handoverTriggerProgressSec.toFixed(1)} / {handoverTriggerSec.toFixed(1)} s
        </div>
        <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            width: `${triggerRatio * 100}%`,
            height: '100%',
            background: sinrDeltaDb !== null && sinrDeltaDb >= handoverOffsetDb ? '#00ff88' : '#4f8cff',
            borderRadius: 999,
            transition: 'width 120ms linear',
          }}
          />
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 15, color: '#ffffff' }}>
        <div>
          Recent HO: {recentHoSourceSatId || recentHoTargetSatId
            ? `${formatSatelliteLabel(recentHoSourceSatId)} → ${formatSatelliteLabel(recentHoTargetSatId)}`
            : '—'}
        </div>
        <div>HO Count: {hoCount}</div>
      </div>

      <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 13, color: '#ffffff', letterSpacing: 0.6 }}>BEAM HOPPING</div>
          <div style={{ fontSize: 13, color: beamHopEnabled ? '#00ff88' : '#7f8896' }}>
            {beamHopEnabled ? 'ON' : 'OFF'}
          </div>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.45, color: '#ffffff' }}>
          Slot: {beamHopEnabled && beamHopSlotIndex >= 0 ? beamHopSlotIndex : '—'}
          {' · '}
          {beamHopEnabled ? `${beamHopSlotSec.toFixed(2)} s` : 'disabled'}
        </div>
        <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.45, color: '#ffffff' }}>
          Serving Beam Active: {servingBeamActiveThisSlot === null ? '—' : servingBeamActiveThisSlot ? 'yes' : 'no'}
        </div>
        <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.45, color: '#ffffff' }}>
          Serving Sat Active Beams: {servingSatActiveBeamIds.length ? servingSatActiveBeamIds.join(', ') : '—'}
        </div>
        <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.45, color: '#ffffff' }}>
          Pending Sat Active Beams: {pendingTargetActiveBeamIds.length ? pendingTargetActiveBeamIds.join(', ') : '—'}
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.45, color: '#ffffff' }}>
        {formatHandoverReason(lastHoReason)}
      </div>
    </div>
  );
}
