/**
 * Unified React Container Component for Contact Window Teaching Labs.
 *
 * Hosts:
 * - Tab 1: Experiment 5 (Single-Pass SGP4 Contact Geometry & Elevation Mask Trade-off)
 * - Tab 2: Experiment 6 (24-Hour Multi-Satellite Constellation Schedule & Outages)
 * - Tab 3: Scientific Principles & Disclaimers (Theoretical Framework & Nomenclature)
 */

import React, { useState } from 'react';
import { SinglePassContactCarrier } from './SinglePassContactCarrier';
import { MultiSatScheduleCarrier } from './MultiSatScheduleCarrier';
import {
  SCIENTIFIC_ASSUMPTIONS,
  SCIENTIFIC_DISCLAIMER_EN,
  SCIENTIFIC_DISCLAIMER_ZH_HANT,
  TEACHING_LEARNING_OBJECTIVES,
} from './scientificBoundaries';

export type ContactLabTab = 'exp5' | 'exp6' | 'theory';

export interface ContactWindowLabsContainerProps {
  readonly initialTab?: ContactLabTab;
}

export const ContactWindowLabsContainer: React.FC<ContactWindowLabsContainerProps> = ({
  initialTab = 'exp5',
}) => {
  const [activeTab, setActiveTab] = useState<ContactLabTab>(initialTab);

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: '#010409',
        color: '#e6edf3',
        minHeight: '100vh',
        padding: '32px 16px',
      }}
      data-testid="contact-window-labs-container"
    >
      <div style={{ maxWidth: '1060px', margin: '0 auto' }}>
        {/* Lab Navigation Header */}
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#58a6ff', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            NTPU LEO Satellite Communication Curriculum
          </div>
          <h1 style={{ margin: '6px 0 8px 0', fontSize: '26px', color: '#f0f6fc' }}>
            Satellite Geometric Visibility & Orbit Schedule Labs
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#8b949e', maxWidth: '680px', marginInline: 'auto' }}>
            Interactive educational modules demonstrating SGP4/WGS84 topocentric geometry, elevation-mask trade-offs, and 24-hour geometric visibility schedules—not guaranteed RF service.
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '24px',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={() => setActiveTab('exp5')}
            style={{
              padding: '10px 20px',
              background: activeTab === 'exp5' ? '#1f6feb' : '#161b22',
              color: activeTab === 'exp5' ? '#ffffff' : '#c9d1d9',
              border: `1px solid ${activeTab === 'exp5' ? '#388bfd' : '#30363d'}`,
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            data-testid="tab-btn-exp5"
          >
            Experiment 5: Single-Pass Geometry (AOS / Peak / LOS)
          </button>

          <button
            onClick={() => setActiveTab('exp6')}
            style={{
              padding: '10px 20px',
              background: activeTab === 'exp6' ? '#1f6feb' : '#161b22',
              color: activeTab === 'exp6' ? '#ffffff' : '#c9d1d9',
              border: `1px solid ${activeTab === 'exp6' ? '#388bfd' : '#30363d'}`,
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            data-testid="tab-btn-exp6"
          >
            Experiment 6: 24-Hour Multi-Satellite Schedule
          </button>

          <button
            onClick={() => setActiveTab('theory')}
            style={{
              padding: '10px 20px',
              background: activeTab === 'theory' ? '#1f6feb' : '#161b22',
              color: activeTab === 'theory' ? '#ffffff' : '#c9d1d9',
              border: `1px solid ${activeTab === 'theory' ? '#388bfd' : '#30363d'}`,
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            data-testid="tab-btn-theory"
          >
            Scientific Principles & Boundaries
          </button>
        </div>

        {/* Tab Views */}
        {activeTab === 'exp5' && <SinglePassContactCarrier />}
        {activeTab === 'exp6' && <MultiSatScheduleCarrier />}

        {activeTab === 'theory' && (
          <div
            style={{
              background: '#0d1117',
              border: '1px solid #30363d',
              borderRadius: '12px',
              padding: '24px',
            }}
            data-testid="theory-container"
          >
            <h2 style={{ fontSize: '20px', margin: '0 0 16px 0', color: '#f0f6fc' }}>
              Scientific Boundaries & Theoretical Framework
            </h2>

            {/* Core Disclaimer Callout */}
            <div
              style={{
                padding: '16px',
                background: '#161b22',
                borderLeft: '4px solid #f0883e',
                borderRadius: '6px',
                fontSize: '13px',
                lineHeight: '1.6',
                color: '#d29922',
                marginBottom: '24px',
              }}
            >
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#f0883e' }}>
                Rule of Truth: Geometric Opportunity vs. Guaranteed RF Service
              </h3>
              <p style={{ margin: '0 0 8px 0' }}>{SCIENTIFIC_DISCLAIMER_EN}</p>
              <p style={{ margin: 0 }}>{SCIENTIFIC_DISCLAIMER_ZH_HANT}</p>
            </div>

            {/* Assumptions Grid */}
            <h3 style={{ fontSize: '16px', color: '#f0f6fc', marginBottom: '12px' }}>
              Model Assumptions & Real-World Exclusions
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {SCIENTIFIC_ASSUMPTIONS.map((item, index) => (
                <div key={index} style={{ background: '#161b22', padding: '14px', borderRadius: '8px', border: '1px solid #30363d' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#58a6ff', letterSpacing: '0.05em' }}>
                    {item.category}
                  </div>
                  <h4 style={{ margin: '6px 0 4px 0', fontSize: '14px', color: '#f0f6fc' }}>
                    {item.title}
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#8b949e', lineHeight: '1.5' }}>
                    {item.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Learning Objectives */}
            <h3 style={{ fontSize: '16px', color: '#f0f6fc', marginBottom: '12px' }}>
              Course Learning Objectives
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {TEACHING_LEARNING_OBJECTIVES.map((obj, index) => (
                <div key={index} style={{ background: '#161b22', padding: '16px', borderRadius: '8px', border: '1px solid #30363d' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#58a6ff' }}>
                    {obj.experiment}: {obj.title}
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#c9d1d9', lineHeight: '1.6' }}>
                    {obj.objectives.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
