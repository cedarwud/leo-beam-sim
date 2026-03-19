import type { SimState } from '../scene/types';

function sinrColor(sinrDb: number): string {
  if (sinrDb >= 20) return '#00ff00';
  if (sinrDb >= 10) return '#aaff00';
  if (sinrDb >= 5) return '#ffaa00';
  return '#ff4444';
}

export function InfoPanel({
  servingSatId,
  servingBeamId,
  pendingTargetSatId,
  pendingTargetBeamId,
  recentHoSourceSatId,
  recentHoTargetSatId,
  sinrDb,
  hoCount,
  lastHoReason,
}: SimState) {
  return (
    <div style={{
      position: 'absolute',
      top: 12,
      right: 12,
      zIndex: 10,
      background: 'rgba(0,0,0,0.7)',
      padding: '12px 16px',
      borderRadius: 8,
      color: 'white',
      fontSize: 13,
      fontFamily: 'monospace',
      minWidth: 220,
    }}>
      <div style={{ marginBottom: 8, fontWeight: 'bold', fontSize: 15 }}>LEO Beam Sim</div>
      <div>Serving: {servingSatId ? `${servingSatId} B${servingBeamId}` : 'none'}</div>
      <div>Pending: {pendingTargetSatId ? `${pendingTargetSatId} B${pendingTargetBeamId}` : '—'}</div>
      <div>
        Recent HO:{' '}
        {recentHoSourceSatId || recentHoTargetSatId
          ? `${recentHoSourceSatId ?? '—'} → ${recentHoTargetSatId ?? '—'}`
          : '—'}
      </div>
      <div>
        SINR:{' '}
        <span style={{ color: sinrColor(sinrDb) }}>
          {sinrDb > -100 ? `${sinrDb.toFixed(1)} dB` : '—'}
        </span>
      </div>
      <div>HO Count: {hoCount}</div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{lastHoReason}</div>
    </div>
  );
}
