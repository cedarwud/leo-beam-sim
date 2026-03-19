import type { SimState } from '../scene/types';

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
  if (sinrDb === null || !Number.isFinite(sinrDb) || sinrDb <= -100) return '—';
  return `${sinrDb.toFixed(1)} dB`;
}

export function InfoPanel({
  servingSatId,
  servingBeamId,
  pendingTargetSatId,
  pendingTargetBeamId,
  pendingTargetSinrDb,
  comparisonSatId,
  comparisonBeamId,
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
        <div style={{ padding: '12px 14px', background: 'rgba(0, 136, 255, 0.08)', borderRadius: 10 }}>
          <div style={{ fontSize: 13, color: '#ffffff', marginBottom: 6, letterSpacing: 0.6 }}>{servingTitle}</div>
          <div style={{ fontSize: 16, color: '#ffffff', marginBottom: 4 }}>
            {hasServingSignal ? `${servingSatId} B${servingBeamId}` : 'none'}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: hasServingSignal ? sinrColor(sinrDb) : '#ffffff' }}>
            {formatSinr(hasServingSignal ? sinrDb : null)}
          </div>
        </div>

        <div style={{ padding: '12px 14px', background: 'rgba(0, 255, 136, 0.08)', borderRadius: 10 }}>
          <div style={{ fontSize: 13, color: '#ffffff', marginBottom: 6, letterSpacing: 0.6 }}>{comparisonTitle}</div>
          <div style={{ fontSize: 16, color: '#ffffff', marginBottom: 4 }}>
            {hasComparisonSignal ? `${comparisonSatId} B${comparisonBeamId}` : 'none'}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: hasComparisonSignal && comparisonSinrDb !== null ? sinrColor(comparisonSinrDb) : '#ffffff' }}>
            {formatSinr(hasComparisonSignal ? comparisonSinrDb : null)}
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
          Recent HO: {recentHoSourceSatId || recentHoTargetSatId ? `${recentHoSourceSatId ?? '—'} → ${recentHoTargetSatId ?? '—'}` : '—'}
        </div>
        <div>HO Count: {hoCount}</div>
      </div>

      <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.45, color: '#ffffff' }}>
        {lastHoReason}
      </div>
    </div>
  );
}
