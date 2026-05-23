import { useEffect, useRef, useState } from 'react';
import type { SimState } from '../scene/types';
import { channelMetricLabelForKind } from './info-panel/formatters';

function computeSinrThroughputBitsPerHz(sinrDb: number): number {
  if (!Number.isFinite(sinrDb)) return Number.NaN;
  return Math.log2(1 + Math.pow(10, sinrDb / 10));
}

interface LastHoSnapshot {
  type: 'intra' | 'inter';
  from: string;
  to: string;
  deltaDb: number | null;
  atSimSec: number;
}

interface LiveKpiStripProps {
  readonly simState: SimState;
  readonly effectiveOffsetDb: number;
  readonly effectiveTriggerTimeSec: number;
  readonly bandwidthMHz: number;
}

const NO_VALUE = '—';

function formatBeam(satId: string | null, beamId: number | null): string {
  if (!satId || beamId === null) return NO_VALUE;
  return `${satId} / B${beamId + 1}`;
}

function formatRate(count: number, simTimeSec: number): string {
  if (simTimeSec <= 0) return '0.0';
  return (count / (simTimeSec / 60)).toFixed(1);
}

function formatDeltaDb(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return NO_VALUE;
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)} dB`;
}

function KpiRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="leo-live-kpi-strip__row">
      <span className="leo-live-kpi-strip__label">{label}</span>
      <span className="leo-live-kpi-strip__value">{value}</span>
    </div>
  );
}

export function LiveKpiStrip({
  simState,
  effectiveOffsetDb,
  effectiveTriggerTimeSec,
  bandwidthMHz,
}: LiveKpiStripProps) {
  const { physicalServing, hoCount, intraHoCount, simTimeSec } = simState;
  const interCount = Math.max(hoCount - intraHoCount, 0);
  const sinrDb = physicalServing.sinrDb;
  const sinrIsFinite = sinrDb !== null && Number.isFinite(sinrDb);
  const spectralEff = sinrIsFinite ? computeSinrThroughputBitsPerHz(sinrDb as number) : null;
  const throughputMbps = spectralEff !== null ? spectralEff * bandwidthMHz : null;
  const throughputValue = throughputMbps !== null
    ? throughputMbps >= 1000
      ? `${(throughputMbps / 1000).toFixed(2)} Gbps`
      : `${throughputMbps.toFixed(1)} Mbps`
    : NO_VALUE;

  const [stickyLastHo, setStickyLastHo] = useState<LastHoSnapshot | null>(null);
  const lastSeenHoCountRef = useRef(0);
  useEffect(() => {
    const ev = simState.lastHoEvent;
    if (ev !== null && simState.hoCount > lastSeenHoCountRef.current) {
      const isIntra = ev.action === 'intra-switch';
      setStickyLastHo({
        type: isIntra ? 'intra' : 'inter',
        from: formatBeam(ev.fromSatId, ev.fromBeamId),
        to: formatBeam(ev.toSatId, ev.toBeamId),
        deltaDb: ev.deltaDb,
        atSimSec: simState.simTimeSec,
      });
      lastSeenHoCountRef.current = simState.hoCount;
    }
  }, [simState.hoCount, simState.lastHoEvent, simState.simTimeSec]);

  const lastHoFrom = stickyLastHo?.from ?? NO_VALUE;
  const lastHoTo = stickyLastHo?.to ?? NO_VALUE;
  const lastHoDelta = formatDeltaDb(stickyLastHo?.deltaDb ?? null);
  const lastHoTypeLabel = stickyLastHo?.type ?? NO_VALUE;
  const lastHoAgeSec = stickyLastHo !== null
    ? Math.max(0, simState.simTimeSec - stickyLastHo.atSimSec)
    : null;
  const lastHoAgeText = lastHoAgeSec !== null
    ? lastHoAgeSec < 60
      ? `${lastHoAgeSec.toFixed(0)}s ago`
      : `${(lastHoAgeSec / 60).toFixed(1)}m ago`
    : NO_VALUE;

  return (
    <section className="leo-live-kpi-strip" data-testid="live-kpi-strip" aria-label="Live KPI strip">
      <div className="leo-live-kpi-strip__group-title" id="live-kpi-serving-heading">Serving</div>
      <div role="status" aria-live="polite" aria-labelledby="live-kpi-serving-heading">
        <KpiRow label="Sat / Beam" value={formatBeam(physicalServing.satId, physicalServing.beamId)} />
        <KpiRow
          label={channelMetricLabelForKind('sinr-with-interference')}
          value={sinrIsFinite ? `${(sinrDb as number).toFixed(2)} dB` : NO_VALUE}
        />
        <KpiRow label="Throughput" value={throughputValue} />
      </div>

      <div className="leo-live-kpi-strip__group-title" id="live-kpi-handover-heading">Handover</div>
      <div role="status" aria-live="polite" aria-labelledby="live-kpi-handover-heading">
        <KpiRow label="Intra-HO" value={`${intraHoCount} (${formatRate(intraHoCount, simTimeSec)}/min)`} />
        <KpiRow label="Inter-HO" value={`${interCount} (${formatRate(interCount, simTimeSec)}/min)`} />
      </div>

      <div className="leo-live-kpi-strip__group-title">Last HO</div>
      <KpiRow label="Type" value={lastHoTypeLabel} />
      <KpiRow label="From" value={lastHoFrom} />
      <KpiRow label="To" value={lastHoTo} />
      <KpiRow label="ΔSINR" value={lastHoDelta} />
      <KpiRow label="When" value={lastHoAgeText} />

      <div className="leo-live-kpi-strip__group-title">Policy (effective)</div>
      <KpiRow label="Offset" value={`${effectiveOffsetDb.toFixed(1)} dB`} />
      <KpiRow label="TTT" value={`${effectiveTriggerTimeSec.toFixed(1)} s`} />
    </section>
  );
}
