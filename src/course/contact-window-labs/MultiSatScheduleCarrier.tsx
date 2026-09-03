/**
 * React Carrier Component for Experiment 6:
 * 24-Hour Multi-Satellite Constellation Contact Schedule & Outage / Overlap Analysis.
 *
 * Provides interactive UI for:
 * - 24-hour timeline analysis across archived constellation TLE records over NTPU
 * - Adjustable minimum elevation mask (5°, 10°, 20°, 30°)
 * - Total contact opportunity minutes vs. merged non-overlapping coverage duty cycle
 * - Longest outage duration, timestamp intervals, and neighbor satellite identification
 * - Overlap count and maximum concurrent satellite tracking
 * - 24-hour visual Gantt schedule strip & concurrency distribution
 * - Detailed chronological pass ledger and outage ledger
 * - Prominent scientific boundary and non-guaranteed RF service disclaimers
 */

import React, { useMemo, useState } from 'react';
import type { SupportedElevationMaskDeg } from './types';
import { SUPPORTED_ELEVATION_MASKS_DEG } from './types';
import {
  DEFAULT_24_HOUR_SCHEDULE_START_UTC,
  EXPERIMENT_6_CONSTELLATION_SATELLITES,
  NTPU_LAB_OBSERVER,
} from './fixtures';
import { compute24HourMultiSatSchedule } from './multiSatScheduleModel';
import {
  SCIENTIFIC_DISCLAIMER_EN,
  SCIENTIFIC_DISCLAIMER_ZH_HANT,
} from './scientificBoundaries';

export interface MultiSatScheduleCarrierProps {
  readonly initialElevationMaskDeg?: SupportedElevationMaskDeg;
  readonly startUtc?: string;
  readonly durationHours?: number;
  readonly onMaskChange?: (maskDeg: SupportedElevationMaskDeg) => void;
}

export const MultiSatScheduleCarrier: React.FC<MultiSatScheduleCarrierProps> = ({
  initialElevationMaskDeg = 10,
  startUtc = DEFAULT_24_HOUR_SCHEDULE_START_UTC,
  durationHours = 24,
  onMaskChange,
}) => {
  const [elevationMaskDeg, setElevationMaskDeg] = useState<SupportedElevationMaskDeg>(initialElevationMaskDeg);
  const [showZhHant, setShowZhHant] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'passes' | 'outages' | 'concurrency'>('passes');

  const handleMaskClick = (mask: SupportedElevationMaskDeg) => {
    setElevationMaskDeg(mask);
    if (onMaskChange) onMaskChange(mask);
  };

  const scheduleResult = useMemo(() => {
    return compute24HourMultiSatSchedule({
      satellites: EXPERIMENT_6_CONSTELLATION_SATELLITES,
      observer: NTPU_LAB_OBSERVER,
      minimumElevationDeg: elevationMaskDeg,
      startUtc,
      durationHours,
      sampleStepSec: 30,
    });
  }, [elevationMaskDeg, startUtc, durationHours]);

  const startMs = Date.parse(scheduleResult.windowStartUtc);
  const endMs = Date.parse(scheduleResult.windowEndUtc);
  const totalWindowMs = endMs - startMs;

  const getPercent = (ms: number) => {
    return Math.max(0, Math.min(100, ((ms - startMs) / totalWindowMs) * 100));
  };

  // Satellite colors for Gantt chart
  const satColors: Record<string, string> = {
    '49100': '#58a6ff',
    '49194': '#3fb950',
    '55159': '#d29922',
    '44057': '#a371f7',
    '44058': '#f0883e',
    '44059': '#79c0ff',
    '44060': '#56d364',
    '44061': '#e3b341',
  };

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: '#0d1117',
        color: '#e6edf3',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid #30363d',
        maxWidth: '1020px',
        margin: '0 auto',
      }}
      data-testid="experiment6-carrier"
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'inline-block', padding: '3px 8px', background: '#3fb95022', color: '#3fb950', borderRadius: '4px', fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '6px' }}>
            EXPERIMENT 6 · 24-HOUR CONSTELLATION SCHEDULE
          </div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', color: '#f0f6fc' }}>
            24-Hour Multi-Satellite Geometric Visibility & Gap Schedule
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#8b949e' }}>
            Constellation: <strong style={{ color: '#c9d1d9' }}>{scheduleResult.satelliteCount} Archived OneWeb Satellites</strong> · Observer: <strong style={{ color: '#c9d1d9' }}>{NTPU_LAB_OBSERVER.label}</strong> · Geometry only
          </p>
        </div>

        <button
          onClick={() => setShowZhHant(!showZhHant)}
          style={{
            background: '#21262d',
            border: '1px solid #30363d',
            color: '#c9d1d9',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          {showZhHant ? 'Switch to English' : '切換為中文說明'}
        </button>
      </div>

      {/* Scientific Boundary Notice */}
      <div
        style={{
          marginTop: '16px',
          padding: '12px 16px',
          background: '#161b22',
          borderLeft: '4px solid #f0883e',
          borderRadius: '4px',
          fontSize: '12px',
          lineHeight: '1.5',
          color: '#d29922',
        }}
        data-testid="scientific-disclaimer"
      >
        <strong>⚠️ SCIENTIFIC BOUNDARY: </strong>
        {showZhHant ? SCIENTIFIC_DISCLAIMER_ZH_HANT : SCIENTIFIC_DISCLAIMER_EN}
      </div>

      {/* Controls Bar */}
      <div
        style={{
          marginTop: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          background: '#161b22',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #30363d',
        }}
      >
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#8b949e' }}>
            24-HOUR ANALYSIS WINDOW
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#f0f6fc', marginTop: '2px' }}>
            {startUtc.slice(0, 10)} 00:00 UTC → {scheduleResult.windowEndUtc.slice(0, 10)} 00:00 UTC ({durationHours} Hours)
          </div>
        </div>

        {/* Minimum Elevation Mask Selector */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8b949e', marginBottom: '6px' }}>
            MINIMUM ELEVATION MASK (θ_min)
          </label>
          <div style={{ display: 'flex', gap: '8px' }} data-testid="elevation-mask-group">
            {SUPPORTED_ELEVATION_MASKS_DEG.map((mask) => {
              const active = mask === elevationMaskDeg;
              return (
                <button
                  key={mask}
                  onClick={() => handleMaskClick(mask)}
                  style={{
                    padding: '6px 14px',
                    background: active ? '#1f6feb' : '#21262d',
                    color: active ? '#ffffff' : '#c9d1d9',
                    border: `1px solid ${active ? '#388bfd' : '#30363d'}`,
                    borderRadius: '6px',
                    fontWeight: active ? 700 : 500,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  data-testid={`mask-btn-${mask}`}
                >
                  {mask}°
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 24-Hour KPI Summary Grid */}
      <div
        style={{
          marginTop: '20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
        }}
        data-testid="schedule-kpi-grid"
      >
        {/* Total Contact Opportunity Minutes */}
        <div style={{ background: '#161b22', padding: '14px', borderRadius: '8px', border: '1px solid #30363d' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#58a6ff', letterSpacing: '0.05em' }}>
            TOTAL CONTACT OPPORTUNITY
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#58a6ff', marginTop: '6px' }}>
            {scheduleResult.totalContactOpportunityMinutes.toFixed(1)} min
          </div>
          <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '4px' }}>
            {scheduleResult.totalPassesCount} Total Passes across 24h
          </div>
        </div>

        {/* Total Merged Contact Coverage */}
        <div style={{ background: '#161b22', padding: '14px', borderRadius: '8px', border: '1px solid #30363d' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#3fb950', letterSpacing: '0.05em' }}>
            MERGED GEOMETRIC COVERAGE
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#3fb950', marginTop: '6px' }}>
            {scheduleResult.totalMergedContactCoverageMinutes.toFixed(1)} min
          </div>
          <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '4px' }}>
            Duty Cycle: <strong style={{ color: '#c9d1d9' }}>{scheduleResult.coverageDutyCyclePercent.toFixed(1)}%</strong> of 24h
          </div>
        </div>

        {/* Longest Outage */}
        <div style={{ background: '#161b22', padding: '14px', borderRadius: '8px', border: '1px solid #30363d' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#f85149', letterSpacing: '0.05em' }}>
            LONGEST OUTAGE GAP
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#f85149', marginTop: '6px' }}>
            {scheduleResult.longestOutage ? `${scheduleResult.longestOutage.durationMinutes.toFixed(1)} min` : '0 min'}
          </div>
          <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '4px' }}>
            {scheduleResult.longestOutage
              ? `${scheduleResult.longestOutage.startUtc.slice(11, 16)} → ${scheduleResult.longestOutage.endUtc.slice(11, 16)} UTC`
              : 'Continuous geometric visibility'}
          </div>
        </div>

        {/* Overlap Count */}
        <div style={{ background: '#161b22', padding: '14px', borderRadius: '8px', border: '1px solid #30363d' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#a371f7', letterSpacing: '0.05em' }}>
            OVERLAP OPPORTUNITIES
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#a371f7', marginTop: '6px' }}>
            {scheduleResult.overlapCount} Events
          </div>
          <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '4px' }}>
            Max Concurrent: <strong style={{ color: '#c9d1d9' }}>{scheduleResult.maxConcurrentSatellites} Sats</strong>
          </div>
        </div>

        {/* Average Pass Duration */}
        <div style={{ background: '#161b22', padding: '14px', borderRadius: '8px', border: '1px solid #30363d' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#d29922', letterSpacing: '0.05em' }}>
            AVERAGE PASS DURATION
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#d29922', marginTop: '6px' }}>
            {scheduleResult.averagePassDurationMinutes.toFixed(1)} min
          </div>
          <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '4px' }}>
            At θ ≥ {elevationMaskDeg}° elevation mask
          </div>
        </div>
      </div>

      {/* 24-Hour Visual Gantt Schedule Timeline */}
      <div
        style={{
          marginTop: '20px',
          background: '#161b22',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #30363d',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f0f6fc' }}>
            24-Hour Geometric Visibility Gantt Schedule
          </div>
          <div style={{ fontSize: '11px', color: '#8b949e' }}>
            Colored bars = Geometric windows above {elevationMaskDeg}° · Dark spaces = Visibility gaps
          </div>
        </div>

        {/* Hour Markers */}
        <div style={{ position: 'relative', height: '18px', borderBottom: '1px solid #30363d', marginBottom: '8px' }}>
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((hr) => {
            const leftPct = (hr / 24) * 100;
            return (
              <div
                key={hr}
                style={{
                  position: 'absolute',
                  left: `${leftPct}%`,
                  transform: hr === 24 ? 'translateX(-100%)' : hr === 0 ? 'none' : 'translateX(-50%)',
                  fontSize: '10px',
                  color: '#6e7681',
                }}
              >
                {String(hr).padStart(2, '0')}:00
              </div>
            );
          })}
        </div>

        {/* Satellite Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {EXPERIMENT_6_CONSTELLATION_SATELLITES.map((sat) => {
            const satPasses = scheduleResult.passesBySatellite[sat.satelliteId] ?? [];
            const satColor = satColors[sat.satelliteId] ?? '#58a6ff';

            return (
              <div
                key={sat.satelliteId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#c9d1d9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sat.satelliteName}
                </div>

                <div
                  style={{
                    position: 'relative',
                    height: '16px',
                    background: '#0d1117',
                    borderRadius: '3px',
                    border: '1px solid #21262d',
                    overflow: 'hidden',
                  }}
                >
                  {satPasses.map((p) => {
                    const left = getPercent(p.aos.instantMs);
                    const right = getPercent(p.los.instantMs);
                    const width = Math.max(0.5, right - left);

                    return (
                      <div
                        key={p.passId}
                        title={`${p.satelliteName} Pass ${p.passIndex}: ${p.aos.instantUtc.slice(11, 19)} → ${p.los.instantUtc.slice(11, 19)} (${p.durationMinutes.toFixed(1)}m, Peak ${p.peak.maxElevationDeg.toFixed(1)}°)`}
                        style={{
                          position: 'absolute',
                          left: `${left}%`,
                          width: `${width}%`,
                          top: 0,
                          bottom: 0,
                          background: satColor,
                          borderRadius: '2px',
                          cursor: 'pointer',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Details Tabs */}
      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #30363d', paddingBottom: '8px' }}>
          <button
            onClick={() => setActiveTab('passes')}
            style={{
              background: activeTab === 'passes' ? '#21262d' : 'transparent',
              border: `1px solid ${activeTab === 'passes' ? '#388bfd' : 'transparent'}`,
              color: activeTab === 'passes' ? '#58a6ff' : '#8b949e',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Chronological Pass Schedule ({scheduleResult.passes.length})
          </button>
          <button
            onClick={() => setActiveTab('outages')}
            style={{
              background: activeTab === 'outages' ? '#21262d' : 'transparent',
              border: `1px solid ${activeTab === 'outages' ? '#388bfd' : 'transparent'}`,
              color: activeTab === 'outages' ? '#f85149' : '#8b949e',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Outage Intervals ({scheduleResult.outages.length})
          </button>
          <button
            onClick={() => setActiveTab('concurrency')}
            style={{
              background: activeTab === 'concurrency' ? '#21262d' : 'transparent',
              border: `1px solid ${activeTab === 'concurrency' ? '#388bfd' : 'transparent'}`,
              color: activeTab === 'concurrency' ? '#a371f7' : '#8b949e',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Concurrency & Overlaps
          </button>
        </div>

        {/* Tab 1: Chronological Passes */}
        {activeTab === 'passes' && (
          <div style={{ marginTop: '12px', background: '#161b22', padding: '12px', borderRadius: '8px', border: '1px solid #30363d', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #30363d', color: '#8b949e' }}>
                  <th style={{ padding: '8px' }}>#</th>
                  <th style={{ padding: '8px' }}>Satellite</th>
                  <th style={{ padding: '8px' }}>AOS (UTC · Az)</th>
                  <th style={{ padding: '8px' }}>Peak (UTC · Max El)</th>
                  <th style={{ padding: '8px' }}>LOS (UTC · Az)</th>
                  <th style={{ padding: '8px' }}>Duration</th>
                  <th style={{ padding: '8px' }}>Plane</th>
                </tr>
              </thead>
              <tbody>
                {scheduleResult.passes.map((p, idx) => (
                  <tr key={p.passId} style={{ borderBottom: '1px solid #21262d' }}>
                    <td style={{ padding: '8px', color: '#8b949e' }}>{idx + 1}</td>
                    <td style={{ padding: '8px', fontWeight: 600, color: satColors[p.satelliteId] ?? '#58a6ff' }}>
                      {p.satelliteName}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {p.aos.instantUtc.slice(11, 19)} (<span style={{ color: '#3fb950' }}>{p.aos.azimuthDeg.toFixed(0)}°</span>)
                    </td>
                    <td style={{ padding: '8px' }}>
                      {p.peak.instantUtc.slice(11, 19)} (<span style={{ color: '#58a6ff', fontWeight: 600 }}>{p.peak.maxElevationDeg.toFixed(1)}°</span>)
                    </td>
                    <td style={{ padding: '8px' }}>
                      {p.los.instantUtc.slice(11, 19)} (<span style={{ color: '#f85149' }}>{p.los.azimuthDeg.toFixed(0)}°</span>)
                    </td>
                    <td style={{ padding: '8px', fontWeight: 600 }}>
                      {p.durationMinutes.toFixed(1)} min
                    </td>
                    <td style={{ padding: '8px', color: '#8b949e' }}>{p.orbitalPlane ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Outages */}
        {activeTab === 'outages' && (
          <div style={{ marginTop: '12px', background: '#161b22', padding: '12px', borderRadius: '8px', border: '1px solid #30363d', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #30363d', color: '#8b949e' }}>
                  <th style={{ padding: '8px' }}>Outage ID</th>
                  <th style={{ padding: '8px' }}>Start Time (UTC)</th>
                  <th style={{ padding: '8px' }}>End Time (UTC)</th>
                  <th style={{ padding: '8px' }}>Gap Duration</th>
                  <th style={{ padding: '8px' }}>Preceding Sat</th>
                  <th style={{ padding: '8px' }}>Next Sat</th>
                </tr>
              </thead>
              <tbody>
                {scheduleResult.outages.map((out) => {
                  const isLongest = scheduleResult.longestOutage?.outageId === out.outageId;
                  return (
                    <tr
                      key={out.outageId}
                      style={{
                        borderBottom: '1px solid #21262d',
                        background: isLongest ? '#f8514915' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '8px', color: isLongest ? '#f85149' : '#8b949e', fontWeight: isLongest ? 700 : 400 }}>
                        {out.outageId} {isLongest && '(Longest)'}
                      </td>
                      <td style={{ padding: '8px' }}>{out.startUtc.slice(11, 19)}</td>
                      <td style={{ padding: '8px' }}>{out.endUtc.slice(11, 19)}</td>
                      <td style={{ padding: '8px', fontWeight: 600, color: isLongest ? '#f85149' : '#c9d1d9' }}>
                        {out.durationMinutes.toFixed(1)} min ({out.durationSec.toFixed(0)} s)
                      </td>
                      <td style={{ padding: '8px', color: '#8b949e' }}>{out.previousPassSatelliteName ?? '—'}</td>
                      <td style={{ padding: '8px', color: '#8b949e' }}>{out.nextPassSatelliteName ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Concurrency */}
        {activeTab === 'concurrency' && (
          <div style={{ marginTop: '12px', background: '#161b22', padding: '16px', borderRadius: '8px', border: '1px solid #30363d' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#f0f6fc' }}>
              24-Hour Simultaneous Satellite Concurrency Distribution
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div style={{ background: '#0d1117', padding: '12px', borderRadius: '6px', border: '1px solid #21262d' }}>
                <div style={{ fontSize: '11px', color: '#f85149', fontWeight: 600 }}>0 SATELLITES (OUTAGE)</div>
                <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>
                  {scheduleResult.concurrencyDistributionMinutes[0]?.toFixed(1)} min
                </div>
                <div style={{ fontSize: '11px', color: '#8b949e' }}>
                  {(((scheduleResult.concurrencyDistributionMinutes[0] ?? 0) / 1440) * 100).toFixed(1)}% of day
                </div>
              </div>

              <div style={{ background: '#0d1117', padding: '12px', borderRadius: '6px', border: '1px solid #21262d' }}>
                <div style={{ fontSize: '11px', color: '#3fb950', fontWeight: 600 }}>1 SATELLITE (SINGLE)</div>
                <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>
                  {scheduleResult.concurrencyDistributionMinutes[1]?.toFixed(1)} min
                </div>
                <div style={{ fontSize: '11px', color: '#8b949e' }}>
                  {(((scheduleResult.concurrencyDistributionMinutes[1] ?? 0) / 1440) * 100).toFixed(1)}% of day
                </div>
              </div>

              <div style={{ background: '#0d1117', padding: '12px', borderRadius: '6px', border: '1px solid #21262d' }}>
                <div style={{ fontSize: '11px', color: '#58a6ff', fontWeight: 600 }}>2 SATELLITES (OVERLAP)</div>
                <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>
                  {scheduleResult.concurrencyDistributionMinutes[2]?.toFixed(1)} min
                </div>
                <div style={{ fontSize: '11px', color: '#8b949e' }}>
                  {(((scheduleResult.concurrencyDistributionMinutes[2] ?? 0) / 1440) * 100).toFixed(1)}% of day
                </div>
              </div>

              <div style={{ background: '#0d1117', padding: '12px', borderRadius: '6px', border: '1px solid #21262d' }}>
                <div style={{ fontSize: '11px', color: '#a371f7', fontWeight: 600 }}>3+ SATELLITES (HIGH DENSITY)</div>
                <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '4px' }}>
                  {scheduleResult.concurrencyDistributionMinutes[3]?.toFixed(1)} min
                </div>
                <div style={{ fontSize: '11px', color: '#8b949e' }}>
                  {(((scheduleResult.concurrencyDistributionMinutes[3] ?? 0) / 1440) * 100).toFixed(1)}% of day
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
