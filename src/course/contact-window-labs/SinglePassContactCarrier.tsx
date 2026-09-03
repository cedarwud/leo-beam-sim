/**
 * React Carrier Component for Experiment 5:
 * Single-Pass SGP4 Topocentric Contact Geometry & Elevation Mask Trade-off.
 *
 * Provides interactive UI for:
 * - Selecting archived TLE satellite (ONEWEB-0314, ONEWEB-0325, ONEWEB-0618, STARLINK-1008)
 * - Adjusting minimum elevation mask (5°, 10°, 20°, 30°)
 * - Live computation of AOS, Peak, LOS, and contact duration
 * - Interactive Elevation vs. Time SVG curve with mask crossing markers
 * - Multi-mask sensitivity trade-off table
 * - Prominent scientific boundary and non-guaranteed RF service disclaimers
 */

import React, { useMemo, useState } from 'react';
import type { SupportedElevationMaskDeg } from './types';
import { SUPPORTED_ELEVATION_MASKS_DEG } from './types';
import {
  DEFAULT_EXPERIMENT_5_SEARCH_DURATION_SEC,
  DEFAULT_EXPERIMENT_5_SEARCH_START_UTC,
  EXPERIMENT_5_ALTERNATIVE_SATELLITES,
  EXPERIMENT_5_PRIMARY_SATELLITE,
  NTPU_LAB_OBSERVER,
} from './fixtures';
import { computeSinglePassContactOpportunity } from './singlePassModel';
import {
  SCIENTIFIC_DISCLAIMER_EN,
  SCIENTIFIC_DISCLAIMER_ZH_HANT,
} from './scientificBoundaries';

export interface SinglePassContactCarrierProps {
  readonly initialSatelliteId?: string;
  readonly initialElevationMaskDeg?: SupportedElevationMaskDeg;
  readonly searchStartUtc?: string;
  readonly searchDurationSec?: number;
  readonly onMaskChange?: (maskDeg: SupportedElevationMaskDeg) => void;
}

export const SinglePassContactCarrier: React.FC<SinglePassContactCarrierProps> = ({
  initialSatelliteId = EXPERIMENT_5_PRIMARY_SATELLITE.satelliteId,
  initialElevationMaskDeg = 10,
  searchStartUtc = DEFAULT_EXPERIMENT_5_SEARCH_START_UTC,
  searchDurationSec = DEFAULT_EXPERIMENT_5_SEARCH_DURATION_SEC,
  onMaskChange,
}) => {
  const [selectedSatId, setSelectedSatId] = useState<string>(initialSatelliteId);
  const [elevationMaskDeg, setElevationMaskDeg] = useState<SupportedElevationMaskDeg>(initialElevationMaskDeg);
  const [showZhHant, setShowZhHant] = useState<boolean>(false);

  const selectedSat = useMemo(() => {
    return EXPERIMENT_5_ALTERNATIVE_SATELLITES.find(s => s.satelliteId === selectedSatId)
      ?? EXPERIMENT_5_PRIMARY_SATELLITE;
  }, [selectedSatId]);

  const handleMaskClick = (mask: SupportedElevationMaskDeg) => {
    setElevationMaskDeg(mask);
    if (onMaskChange) onMaskChange(mask);
  };

  const result = useMemo(() => {
    return computeSinglePassContactOpportunity({
      tle: selectedSat,
      observer: NTPU_LAB_OBSERVER,
      minimumElevationDeg: elevationMaskDeg,
      searchStartUtc,
      searchDurationSec,
      sampleStepSec: 10,
    });
  }, [selectedSat, elevationMaskDeg, searchStartUtc, searchDurationSec]);

  // SVG Chart Dimensions
  const chartWidth = 720;
  const chartHeight = 240;
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const trajectory = result.trajectory;
  const startMs = Date.parse(searchStartUtc);
  const endMs = startMs + searchDurationSec * 1000;

  const getX = (instantMs: number) => {
    const fraction = Math.max(0, Math.min(1, (instantMs - startMs) / (endMs - startMs)));
    return padding.left + fraction * innerWidth;
  };

  const getY = (elDeg: number) => {
    // Map -10 deg to 90 deg into chart area
    const minEl = -10;
    const maxEl = 90;
    const fraction = (elDeg - minEl) / (maxEl - minEl);
    return padding.top + (1 - Math.max(0, Math.min(1, fraction))) * innerHeight;
  };

  const svgPath = useMemo(() => {
    if (trajectory.length === 0) return '';
    return trajectory.reduce((acc, point, index) => {
      const x = getX(point.instantMs);
      const y = getY(point.elevationDeg);
      return `${acc} ${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');
  }, [trajectory]);

  const maskY = getY(elevationMaskDeg);
  const horizonY = getY(0);

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: '#0d1117',
        color: '#e6edf3',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid #30363d',
        maxWidth: '960px',
        margin: '0 auto',
      }}
      data-testid="experiment5-carrier"
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'inline-block', padding: '3px 8px', background: '#1f6feb22', color: '#58a6ff', borderRadius: '4px', fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '6px' }}>
            EXPERIMENT 5 · SGP4 TOPOCENTRIC PASS
          </div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', color: '#f0f6fc' }}>
            Single-Pass Contact Geometry & Elevation Mask
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#8b949e' }}>
            Observer: <strong style={{ color: '#c9d1d9' }}>{NTPU_LAB_OBSERVER.label}</strong> (24.944°N, 121.371°E, 50m)
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
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          background: '#161b22',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #30363d',
        }}
      >
        {/* Satellite Picker */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#8b949e', marginBottom: '6px' }}>
            SELECT SATELLITE (ARCHIVED TLE)
          </label>
          <select
            value={selectedSatId}
            onChange={(e) => setSelectedSatId(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: '#0d1117',
              color: '#f0f6fc',
              border: '1px solid #30363d',
              borderRadius: '6px',
              fontSize: '14px',
            }}
            data-testid="satellite-selector"
          >
            {EXPERIMENT_5_ALTERNATIVE_SATELLITES.map((sat) => (
              <option key={sat.satelliteId} value={sat.satelliteId}>
                {sat.satelliteName} (NORAD {sat.satelliteId} · {sat.constellation})
              </option>
            ))}
          </select>
        </div>

        {/* Minimum Elevation Mask Toggle */}
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
                    flex: 1,
                    padding: '8px 0',
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

      {/* KPI Cards: AOS, Peak, LOS, Duration */}
      <div
        style={{
          marginTop: '20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
        }}
        data-testid="pass-metrics-grid"
      >
        {/* AOS Card */}
        <div style={{ background: '#161b22', padding: '14px', borderRadius: '8px', border: '1px solid #30363d' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#3fb950', letterSpacing: '0.05em' }}>
            AOS (GEOMETRIC MASK ENTRY)
          </div>
          {result.aos ? (
            <div style={{ marginTop: '6px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#f0f6fc' }}>
                {result.aos.instantUtc.slice(11, 19)} UTC
              </div>
              <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '4px' }}>
                Azimuth: <strong style={{ color: '#c9d1d9' }}>{result.aos.azimuthDeg.toFixed(1)}°</strong>
              </div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>
                Slant Range: <strong style={{ color: '#c9d1d9' }}>{result.aos.rangeKm.toFixed(0)} km</strong>
              </div>
            </div>
          ) : (
            <div style={{ color: '#8b949e', fontSize: '13px', marginTop: '6px' }}>No Pass Above Mask</div>
          )}
        </div>

        {/* Peak Card */}
        <div style={{ background: '#161b22', padding: '14px', borderRadius: '8px', border: '1px solid #30363d' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#58a6ff', letterSpacing: '0.05em' }}>
            PEAK (MAX ELEVATION / TCA)
          </div>
          {result.peak ? (
            <div style={{ marginTop: '6px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#58a6ff' }}>
                {result.peak.maxElevationDeg.toFixed(1)}°
              </div>
              <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '4px' }}>
                Time: <strong style={{ color: '#c9d1d9' }}>{result.peak.instantUtc.slice(11, 19)} UTC</strong>
              </div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>
                Azimuth: <strong style={{ color: '#c9d1d9' }}>{result.peak.azimuthDeg.toFixed(1)}°</strong> · Range: <strong style={{ color: '#c9d1d9' }}>{result.peak.rangeKm.toFixed(0)} km</strong>
              </div>
            </div>
          ) : (
            <div style={{ color: '#8b949e', fontSize: '13px', marginTop: '6px' }}>No Pass Above Mask</div>
          )}
        </div>

        {/* LOS Card */}
        <div style={{ background: '#161b22', padding: '14px', borderRadius: '8px', border: '1px solid #30363d' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#f85149', letterSpacing: '0.05em' }}>
            LOS (GEOMETRIC MASK EXIT)
          </div>
          {result.los ? (
            <div style={{ marginTop: '6px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#f0f6fc' }}>
                {result.los.instantUtc.slice(11, 19)} UTC
              </div>
              <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '4px' }}>
                Exit Azimuth: <strong style={{ color: '#c9d1d9' }}>{result.los.azimuthDeg.toFixed(1)}°</strong>
              </div>
              <div style={{ fontSize: '12px', color: '#8b949e' }}>
                Slant Range: <strong style={{ color: '#c9d1d9' }}>{result.los.rangeKm.toFixed(0)} km</strong>
              </div>
            </div>
          ) : (
            <div style={{ color: '#8b949e', fontSize: '13px', marginTop: '6px' }}>No Pass Above Mask</div>
          )}
        </div>

        {/* Duration Card */}
        <div style={{ background: '#161b22', padding: '14px', borderRadius: '8px', border: '1px solid #30363d' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#a371f7', letterSpacing: '0.05em' }}>
            CONTACT OPPORTUNITY DURATION
          </div>
          <div style={{ marginTop: '6px' }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: result.hasContact ? '#a371f7' : '#8b949e' }}>
              {result.hasContact ? `${result.durationMinutes.toFixed(2)} min` : '0 min'}
            </div>
            <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '4px' }}>
              {result.hasContact ? `Exact: ${result.durationSec.toFixed(1)} seconds` : 'Mask not cleared'}
            </div>
          </div>
        </div>
      </div>

      {/* SVG Elevation Profile Chart */}
      <div
        style={{
          marginTop: '20px',
          background: '#161b22',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #30363d',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f0f6fc' }}>
            Topocentric Elevation Track (SGP4 / WGS84)
          </div>
          <div style={{ fontSize: '11px', color: '#8b949e' }}>
            Threshold: <strong style={{ color: '#58a6ff' }}>{elevationMaskDeg}°</strong> · Horizon: <strong style={{ color: '#6e7681' }}>0°</strong>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            style={{ width: '100%', height: 'auto', background: '#0d1117', borderRadius: '6px' }}
          >
            {/* Grid lines */}
            {[0, 30, 60, 90].map((el) => {
              const y = getY(el);
              return (
                <g key={el}>
                  <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="#21262d" strokeWidth="1" />
                  <text x={padding.left - 8} y={y + 4} fill="#6e7681" fontSize="10" textAnchor="end">
                    {el}°
                  </text>
                </g>
              );
            })}

            {/* Geometric Horizon Line (0°) */}
            <line
              x1={padding.left}
              y1={horizonY}
              x2={chartWidth - padding.right}
              y2={horizonY}
              stroke="#484f58"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
            <text x={chartWidth - padding.right} y={horizonY - 4} fill="#8b949e" fontSize="9" textAnchor="end">
              Horizon 0°
            </text>

            {/* Minimum Elevation Mask Threshold Line */}
            <line
              x1={padding.left}
              y1={maskY}
              x2={chartWidth - padding.right}
              y2={maskY}
              stroke="#f0883e"
              strokeDasharray="3 3"
              strokeWidth="1.5"
            />
            <text x={padding.left + 8} y={maskY - 4} fill="#f0883e" fontSize="10" fontWeight="bold">
              Mask {elevationMaskDeg}°
            </text>

            {/* Orbit Elevation Curve */}
            {svgPath && (
              <path
                d={svgPath}
                fill="none"
                stroke="#58a6ff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Marker: AOS */}
            {result.aos && (
              <g>
                <circle cx={getX(result.aos.instantMs)} cy={getY(result.aos.elevationDeg)} r="5" fill="#3fb950" />
                <text
                  x={getX(result.aos.instantMs)}
                  y={getY(result.aos.elevationDeg) + 16}
                  fill="#3fb950"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  AOS
                </text>
              </g>
            )}

            {/* Marker: Peak */}
            {result.peak && (
              <g>
                <circle cx={getX(result.peak.instantMs)} cy={getY(result.peak.elevationDeg)} r="5" fill="#58a6ff" />
                <text
                  x={getX(result.peak.instantMs)}
                  y={getY(result.peak.elevationDeg) - 8}
                  fill="#58a6ff"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  Peak {result.peak.maxElevationDeg.toFixed(1)}°
                </text>
              </g>
            )}

            {/* Marker: LOS */}
            {result.los && (
              <g>
                <circle cx={getX(result.los.instantMs)} cy={getY(result.los.elevationDeg)} r="5" fill="#f85149" />
                <text
                  x={getX(result.los.instantMs)}
                  y={getY(result.los.elevationDeg) + 16}
                  fill="#f85149"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  LOS
                </text>
              </g>
            )}

            {/* Time Axis Labels */}
            <text x={padding.left} y={chartHeight - 12} fill="#6e7681" fontSize="10">
              {searchStartUtc.slice(11, 16)} UTC
            </text>
            <text x={chartWidth - padding.right} y={chartHeight - 12} fill="#6e7681" fontSize="10" textAnchor="end">
              {new Date(endMs).toISOString().slice(11, 16)} UTC
            </text>
          </svg>
        </div>
      </div>

      {/* Multi-Mask Sensitivity Comparison Table */}
      <div
        style={{
          marginTop: '20px',
          background: '#161b22',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #30363d',
        }}
      >
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#f0f6fc' }}>
          Elevation Mask Trade-off Analysis (5°, 10°, 20°, 30°)
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #30363d', color: '#8b949e' }}>
                <th style={{ padding: '8px' }}>Mask (θ_min)</th>
                <th style={{ padding: '8px' }}>Status</th>
                <th style={{ padding: '8px' }}>AOS Time</th>
                <th style={{ padding: '8px' }}>LOS Time</th>
                <th style={{ padding: '8px' }}>Duration (min)</th>
                <th style={{ padding: '8px' }}>Duration (sec)</th>
                <th style={{ padding: '8px' }}>Peak El (°)</th>
              </tr>
            </thead>
            <tbody>
              {result.multiMaskComparison.map((row) => {
                const isSelected = row.elevationMaskDeg === elevationMaskDeg;
                return (
                  <tr
                    key={row.elevationMaskDeg}
                    style={{
                      borderBottom: '1px solid #21262d',
                      background: isSelected ? '#1f6feb15' : 'transparent',
                      color: isSelected ? '#58a6ff' : '#c9d1d9',
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    <td style={{ padding: '8px' }}>
                      <strong>{row.elevationMaskDeg}°</strong> {isSelected && '← Active'}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {row.hasContact ? (
                        <span style={{ color: '#3fb950' }}>● Geometric Window</span>
                      ) : (
                        <span style={{ color: '#8b949e' }}>○ Below Mask</span>
                      )}
                    </td>
                    <td style={{ padding: '8px' }}>{row.aosUtc ? row.aosUtc.slice(11, 19) + ' UTC' : '—'}</td>
                    <td style={{ padding: '8px' }}>{row.losUtc ? row.losUtc.slice(11, 19) + ' UTC' : '—'}</td>
                    <td style={{ padding: '8px' }}>
                      {row.durationMinutes !== undefined ? `${row.durationMinutes.toFixed(2)} min` : '0 min'}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {row.durationSec !== undefined ? `${row.durationSec.toFixed(1)} s` : '0 s'}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {row.peakElevationDeg !== undefined ? `${row.peakElevationDeg.toFixed(1)}°` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
