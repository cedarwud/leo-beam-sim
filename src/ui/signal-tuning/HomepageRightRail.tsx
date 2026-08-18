import { useState, type ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import type { SimulatorTab } from '../../simulator/types';
import { renderFormulaText } from '../common/formulaText';
import { txBi } from './labels';
import { HomepageCanonicalAnalysis } from './HomepageCanonicalAnalysis';
import {
  captionTextStyle,
} from './styles';
import type { HomepageCanonicalAnalysisState } from './useHomepageCanonicalAnalysis';

function formatAccumulatedDuration(durationSec: number, isEnglish: boolean): string {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return isEnglish ? '0 sec' : '0 秒';
  const totalSeconds = Math.round(durationSec);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (isEnglish) {
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours} hr`);
    if (minutes > 0) parts.push(`${minutes} min`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds} sec`);
    return parts.join(' ');
  }
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} 小時`);
  if (minutes > 0) parts.push(`${minutes} 分`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} 秒`);
  return parts.join(' ');
}

function EvaluationWindowControls({ analysis }: { readonly analysis: HomepageCanonicalAnalysisState }) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const durationSec = 'durationSec' in analysis.evaluation
    && typeof analysis.evaluation.durationSec === 'number'
    ? analysis.evaluation.durationSec
    : 0;
  const canReset = durationSec > 0;

  return (
    <div
      data-testid="homepage-ee-evaluation-controls"
      data-result-owner="right-rail"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: UI_TOKENS.space.md,
        flexWrap: 'wrap',
        padding: `${UI_TOKENS.space.sm}px ${UI_TOKENS.space.md}px`,
        borderRadius: UI_TOKENS.radius.md,
        background: UI_TOKENS.color.surface.cardFaint,
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
      }}
    >
      <span style={{ ...captionTextStyle, margin: 0 }}>
        {renderFormulaText(say(
          'homepage.rightRail.ee.accumulation',
          `累積時間：${formatAccumulatedDuration(durationSec, false)}`,
          `Accumulated time: ${formatAccumulatedDuration(durationSec, true)}`,
        ))}
      </span>
      <button
        type="button"
        data-testid="homepage-ee-evaluation-reset"
        data-reset-scope="ee-accumulation"
        disabled={!canReset}
        onClick={analysis.resetEvaluation}
        aria-label={say(
          'homepage.rightRail.ee.resetAria',
          '歸零',
          'Reset',
        )}
        style={{
          minHeight: 32,
          padding: '5px 9px',
          borderRadius: UI_TOKENS.radius.md,
          border: `1px solid ${canReset ? UI_TOKENS.color.border.soft : UI_TOKENS.color.border.subtle}`,
          background: canReset ? UI_TOKENS.color.surface.card : UI_TOKENS.color.surface.cardFaint,
          color: canReset ? UI_TOKENS.color.semantic.tuning : UI_TOKENS.color.text.faint,
          cursor: canReset ? 'pointer' : 'default',
          whiteSpace: 'nowrap',
        }}
      >
        {say('homepage.rightRail.ee.reset', '歸零', 'Reset')}
      </button>
    </div>
  );
}

export interface HomepageRightRailProps {
  readonly analysis: HomepageCanonicalAnalysisState;
  /** Same-frame serving/candidate projection stays above appended calculations. */
  readonly children?: ReactNode;
}

const RESULT_SECTION_ORDER = ['sinr', 'power', 'throughput', 'ee'] as const satisfies readonly SimulatorTab[];

const RESULT_SECTION_ACCENT: Readonly<Record<SimulatorTab, string>> = {
  sinr: UI_TOKENS.color.semantic.tuning,
  power: UI_TOKENS.color.semantic.good,
  throughput: UI_TOKENS.color.semantic.info,
  ee: UI_TOKENS.color.semantic.warning.accent,
};

function CollapsibleResultSection({
  section,
  expanded,
  label,
  onToggle,
  children,
}: {
  readonly section: SimulatorTab;
  readonly expanded: boolean;
  readonly label: string;
  readonly onToggle: () => void;
  readonly children: ReactNode;
}) {
  const contentId = `homepage-result-section-${section}-content`;
  const accent = RESULT_SECTION_ACCENT[section];
  return (
    <section
      data-testid={`homepage-result-section-${section}`}
      data-result-section={section}
      data-expanded={expanded ? 'true' : 'false'}
      style={{
        display: 'grid',
        gap: expanded ? UI_TOKENS.space.sm : 0,
        borderRadius: UI_TOKENS.radius.lg,
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
        background: UI_TOKENS.color.surface.cardFaint,
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        data-testid={`homepage-result-section-${section}-toggle`}
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={onToggle}
        style={{
          width: '100%',
          minHeight: 42,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: UI_TOKENS.space.md,
          padding: `${UI_TOKENS.space.sm}px ${UI_TOKENS.space.md}px`,
          border: 0,
          borderLeft: `3px solid ${accent}`,
          background: UI_TOKENS.color.surface.card,
          color: UI_TOKENS.color.text.primary,
          cursor: 'pointer',
          textAlign: 'left',
          font: 'inherit',
        }}
      >
        <strong>{label}</strong>
        <span aria-hidden="true" style={{ color: accent, fontSize: 18, lineHeight: 1 }}>
          {expanded ? '−' : '+'}
        </span>
      </button>
      {expanded && (
        <div id={contentId} style={{ padding: `0 ${UI_TOKENS.space.sm}px ${UI_TOKENS.space.sm}px` }}>
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * Composite homepage right rail.
 *
 * The serving/candidate comparison remains first. All four calculation groups
 * stay mounted in a right-rail-owned accordion and never follow the left input
 * tab or its scroll position.
 */
export function HomepageRightRail({ analysis, children }: HomepageRightRailProps) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const [expandedSections, setExpandedSections] = useState<Readonly<Record<SimulatorTab, boolean>>>(() => ({
    sinr: true,
    power: true,
    throughput: true,
    ee: true,
  }));
  const sectionLabels: Readonly<Record<SimulatorTab, string>> = {
    sinr: say('homepage.rightRail.section.sinr', 'SINR 計算結果', 'SINR results'),
    power: say('homepage.rightRail.section.power', '功率計算結果', 'Power results'),
    throughput: say('homepage.rightRail.section.throughput', '吞吐量計算結果', 'Throughput results'),
    ee: say('homepage.rightRail.section.ee', '能源效率計算結果', 'Energy-efficiency results'),
  };

  return (
    <div
      data-testid="homepage-right-rail"
      className="leo-homepage-right-rail"
      data-right-rail-source="orbit-data-canonical-frame"
      data-result-layout="persistent-collapsible"
      data-analysis-frame-id={analysis.frame?.frameId ?? ''}
      data-tle-frame-id={analysis.frame?.tleFrameId ?? ''}
      data-selected-satellite-id={analysis.frame?.selectedSatelliteId ?? ''}
      data-selected-position-teme-km={analysis.frame
        ? [
          analysis.frame.tleState.selectedSatellite.positionTemeKm.x,
          analysis.frame.tleState.selectedSatellite.positionTemeKm.y,
          analysis.frame.tleState.selectedSatellite.positionTemeKm.z,
        ].join(',')
        : ''}
      data-selected-velocity-teme-km-per-sec={analysis.frame
        ? [
          analysis.frame.tleState.selectedSatellite.velocityTemeKmPerSec.x,
          analysis.frame.tleState.selectedSatellite.velocityTemeKmPerSec.y,
          analysis.frame.tleState.selectedSatellite.velocityTemeKmPerSec.z,
        ].join(',')
        : ''}
      data-propagation-model={analysis.frame?.provenance.propagationModel ?? ''}
      data-archive-id={analysis.frame?.provenance.archiveId ?? ''}
      data-run-anchor-count={analysis.frame?.runAnchor?.anchorCount ?? ''}
      data-run-duration-sec={analysis.frame?.runAnchor?.durationSec ?? ''}
      data-run-step-sec={analysis.frame?.runAnchor?.stepSec ?? ''}
      data-instant-utc={analysis.frame?.instantUtc ?? ''}
      style={{
        display: 'grid',
        gap: UI_TOKENS.space.lg,
        width: '100%',
        minWidth: 0,
        minHeight: 0,
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        overscrollBehavior: 'contain',
        scrollbarGutter: 'stable',
        alignContent: 'start',
      }}
    >
      {children === undefined ? null : (
        <div
          data-testid="homepage-serving-comparison"
          className="leo-homepage-right-rail__serving-comparison"
        >
          {children}
        </div>
      )}

      <div data-testid="homepage-all-calculation-results" style={{ display: 'grid', gap: UI_TOKENS.space.md }}>
        {RESULT_SECTION_ORDER.map((section, index) => (
          <CollapsibleResultSection
            key={section}
            section={section}
            expanded={expandedSections[section]}
            label={sectionLabels[section]}
            onToggle={() => {
              setExpandedSections(current => ({
                ...current,
                [section]: !current[section],
              }));
            }}
          >
            {section === 'ee' && <EvaluationWindowControls analysis={analysis} />}
            <HomepageCanonicalAnalysis
              activeTab={section}
              analysis={analysis}
              showStatus={index === 0}
            />
          </CollapsibleResultSection>
        ))}
      </div>
    </div>
  );
}
