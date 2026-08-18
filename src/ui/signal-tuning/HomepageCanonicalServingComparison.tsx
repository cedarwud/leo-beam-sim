import type { ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import type { CanonicalLinkResult, SimulationAnalysisFrame } from '../../simulator/types';
import { DuelCard } from '../info-panel/DuelCard';
import { PostSatelliteCapDownlinkPower } from '../common/formulaText';
import { txBi } from './labels';
import { formatEnergyEfficiency, formatPower, formatRate } from './formatters';

function CanonicalLinkPowerComparison({
  serving,
  candidate,
}: {
  readonly serving: CanonicalLinkResult | null;
  readonly candidate: CanonicalLinkResult | null;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const rows: readonly {
    readonly id: string;
    readonly label: ReactNode;
    readonly servingValue: string;
    readonly candidateValue: string;
  }[] = [
    {
      id: 'actual-power',
      label: <PostSatelliteCapDownlinkPower />,
      servingValue: formatPower(serving?.actualPowerW),
      candidateValue: formatPower(candidate?.actualPowerW),
    },
    {
      id: 'rate',
      label: <>R<sub>u,s,v</sub></>,
      servingValue: formatRate(serving?.rateBps),
      candidateValue: formatRate(candidate?.rateBps),
    },
    {
      id: 'instantaneous-ee',
      label: <>η<sup>e</sup></>,
      servingValue: formatEnergyEfficiency(serving?.instantaneousEeBitsPerJ),
      candidateValue: formatEnergyEfficiency(candidate?.instantaneousEeBitsPerJ),
    },
  ];

  return (
    <section
      data-testid="canonical-link-power-comparison"
      style={{
        marginTop: 10,
        display: 'grid',
        gap: 7,
        padding: 11,
        borderRadius: UI_TOKENS.radius.lg,
        background: UI_TOKENS.color.surface.cardFaint,
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(72px, auto) repeat(2, minmax(0, 1fr))', gap: 5, alignItems: 'stretch' }}>
        <span />
        <strong style={{ color: UI_TOKENS.color.semantic.serving.title, fontSize: UI_TOKENS.type.size.tiny, textAlign: 'right' }}>
          {say('homepage.canonicalComparison.servingShort', '服務', 'Serving')}
        </strong>
        <strong style={{ color: UI_TOKENS.color.semantic.candidate.title, fontSize: UI_TOKENS.type.size.tiny, textAlign: 'right' }}>
          {say('homepage.canonicalComparison.candidateShort', '候選', 'Candidate')}
        </strong>
        {rows.map(row => (
          <div key={row.id} style={{ display: 'contents' }}>
            <span style={{ padding: '5px 6px', color: UI_TOKENS.color.text.secondary, fontFamily: UI_TOKENS.type.family.math, fontSize: UI_TOKENS.type.size.small }}>
              {row.label}
            </span>
            <strong data-testid={`canonical-serving-${row.id}`} style={{ padding: '5px 6px', color: UI_TOKENS.color.text.primary, fontSize: UI_TOKENS.type.size.small, textAlign: 'right', whiteSpace: 'nowrap' }}>
              {row.servingValue}
            </strong>
            <strong data-testid={`canonical-candidate-${row.id}`} style={{ padding: '5px 6px', color: UI_TOKENS.color.text.primary, fontSize: UI_TOKENS.type.size.small, textAlign: 'right', whiteSpace: 'nowrap' }}>
              {row.candidateValue}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HomepageCanonicalServingComparison({ frame }: { readonly frame: SimulationAnalysisFrame | null }) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const serving = frame?.links[0] ?? null;
  const candidate = frame?.candidateLink ?? null;
  const handover = frame?.handover;
  const sinrDeltaDb = handover?.deltaDb ?? (serving === null || candidate === null
    ? null
    : candidate.sinrDb - serving.sinrDb);
  const handoverUnavailable = say(
    'homepage.canonicalComparison.noHandover',
    '切換資料未提供。',
    'Switching data is unavailable.',
  );
  const handoverState = handover?.state ?? null;
  const stateLabel = handoverState === 'pending'
    ? say('homepage.canonicalComparison.state.pending', 'TTT 計時中', 'TTT pending')
    : handoverState === 'handover'
      ? say('homepage.canonicalComparison.state.handover', '換手完成', 'handover completed')
      : handoverState === 'forced-continuity'
        ? say('homepage.canonicalComparison.state.forced', '服務切換', 'continuity switch')
        : handoverState === 'monitoring'
          ? say('homepage.canonicalComparison.state.monitoring', '監測候選', 'monitoring candidate')
          : handoverState === 'attached'
            ? say('homepage.canonicalComparison.state.attached', '服務中', 'attached')
            : say('homepage.canonicalComparison.state', '鏈路比較', 'link comparison');
  const stateTone = handoverState === 'pending'
    ? 'candidate'
    : handoverState === 'forced-continuity'
      ? 'warning'
      : handoverState === null || handoverState === 'monitoring'
        ? 'neutral'
        : 'serving';

  return (
    <div
      data-testid="homepage-canonical-serving-comparison"
      className="leo-homepage-serving-comparison leo-info-panel"
      data-formula-authority="canonical-tle-analysis-frame"
      data-analysis-frame-id={frame?.frameId ?? ''}
      data-serving-satellite-id={serving?.satelliteId ?? ''}
      data-candidate-satellite-id={candidate?.satelliteId ?? ''}
      data-serving-sinr-db={serving?.sinrDb ?? ''}
      data-candidate-sinr-db={candidate?.sinrDb ?? ''}
      data-handover-state={handover?.state ?? ''}
      data-handover-count={handover?.cumulativeCount ?? ''}
      data-handover-offset-db={handover?.offsetDb ?? ''}
      data-handover-ttt-sec={handover?.tttSec ?? ''}
      data-handover-progress-sec={handover?.progressSec ?? ''}
    >
      <style>{`.leo-homepage-serving-comparison .leo-duel-card > div:first-child > span:last-child { display: none; }`}</style>
      <DuelCard
        headerTitle={say('homepage.canonicalComparison.header', '衛星鏈路比較', 'Satellite link comparison')}
        servingTitle={say('homepage.canonicalComparison.servingTitle', '服務鏈路', 'Serving link')}
        servingFriendlyTitle={say('homepage.canonicalComparison.serving', '服務衛星', 'Serving satellite')}
        servingCaption={say('homepage.canonicalComparison.servingCaption', '目前的服務鏈路', 'Current serving link')}
        servingBadgeText={serving === null ? say('homepage.canonicalComparison.loading', '載入中', 'loading') : say('homepage.canonicalComparison.active', '目前服務', 'serving')}
        servingBadgeTone="serving"
        servingIdentity={serving === null ? '—' : `NORAD ${serving.satelliteId}`}
        hasServingSignal={serving !== null}
        servingGlyph={null}
        servingSinrDb={serving?.sinrDb ?? null}
        servingElevationDeg={serving?.elevationDeg ?? null}
        servingRangeKm={serving?.distanceKm ?? null}
        servingTone={serving === null ? 'neutral' : 'serving'}
        comparisonTitle={say('homepage.canonicalComparison.candidateTitle', '候選鏈路', 'Candidate link')}
        comparisonFriendlyTitle={say('homepage.canonicalComparison.candidate', '候選衛星', 'Candidate satellite')}
        comparisonCaption={say('homepage.canonicalComparison.candidateCaption', '候選衛星的單鏈路結果', 'Single-link result for the candidate satellite')}
        comparisonBadgeText={candidate === null ? say('homepage.canonicalComparison.none', '無可用候選', 'no candidate') : say('homepage.canonicalComparison.candidateBadge', '候選', 'candidate')}
        comparisonBadgeTone="candidate"
        comparisonIdentity={candidate === null ? '—' : `NORAD ${candidate.satelliteId}`}
        hasComparisonSignal={candidate !== null}
        comparisonGlyph={null}
        comparisonSinrDb={candidate?.sinrDb ?? null}
        comparisonElevationDeg={candidate?.elevationDeg ?? null}
        comparisonRangeKm={candidate?.distanceKm ?? null}
        comparisonTone={candidate === null ? 'neutral' : 'pending'}
        sinrDeltaDb={sinrDeltaDb}
        handoverOffsetDb={handover?.offsetDb ?? null}
        handoverTriggerProgressSec={handover?.progressSec ?? null}
        handoverTriggerSec={handover?.tttSec ?? null}
        triggerRatio={handover?.ratio ?? null}
        stateLabel={stateLabel}
        stateTone={stateTone}
        contextBadgeText=""
        contextBadgeTone="neutral"
        deltaLabel={say('homepage.canonicalComparison.delta', '候選 − 服務', 'candidate − serving')}
        offsetLabel={say('homepage.canonicalComparison.offset', '切換門檻', 'switching offset')}
        triggerLabel={say('homepage.canonicalComparison.ttt', '切換計時', 'switching timer')}
        triggerAriaLabel={say('homepage.canonicalComparison.tttAria', '換手倒數進度', 'Handover TTT progress')}
        handoverCount={handover?.cumulativeCount ?? null}
        decisionUnavailableReason={handover === undefined ? handoverUnavailable : undefined}
      />
      <CanonicalLinkPowerComparison serving={serving} candidate={candidate} />
    </div>
  );
}
