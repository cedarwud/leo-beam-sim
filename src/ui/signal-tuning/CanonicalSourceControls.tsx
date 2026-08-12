import type { ChangeEvent } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import {
  SIMULATOR_CONSTELLATIONS,
  SIMULATOR_TIME_ZONE,
  type SimulatorConstellation,
} from '../../simulator/types';
import { txBi } from './labels';
import { captionTextStyle, groupTitleStyle } from './styles';
import type { HomepageCanonicalAnalysisState } from './useHomepageCanonicalAnalysis';

function formatArchiveDate(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function constellationLabel(value: SimulatorConstellation): string {
  return SIMULATOR_CONSTELLATIONS.find(option => option.id === value)?.label ?? value;
}

export function CanonicalSourceControls({
  analysis,
}: {
  readonly analysis: HomepageCanonicalAnalysisState;
}) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const acceptedConstellation = analysis.frame?.provenance.constellation ?? null;
  const acceptedMatchesRequest = analysis.status === 'ready'
    && acceptedConstellation === analysis.requestedConstellation;
  // Treat catalog metadata as request-scoped. This extra guard keeps a stale
  // fixture or an intermediate render from publishing another constellation's
  // date bounds as the current request.
  const currentCatalog = analysis.catalog?.constellation === analysis.requestedConstellation
    ? analysis.catalog
    : null;
  const minDateTime = currentCatalog === null
    ? undefined
    : `${formatArchiveDate(currentCatalog.firstArchiveDate)}T00:00`;
  const maxDateTime = currentCatalog === null
    ? undefined
    : `${formatArchiveDate(currentCatalog.lastArchiveDate)}T23:59`;

  const changeConstellation = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value;
    if (value === 'oneweb' || value === 'starlink') analysis.setRequestedConstellation(value);
  };

  const statusText = analysis.status === 'loading'
    ? say(
      'homepage.source.loading',
      `正在載入 ${constellationLabel(analysis.requestedConstellation)}；右側暫留上一筆已接受結果。`,
      `Loading ${constellationLabel(analysis.requestedConstellation)}; the right rail keeps the last accepted result.`,
    )
    : analysis.status === 'error'
      ? say(
        'homepage.source.error',
        '這次設定未被接受；請調整日期時間，右側仍保留上一筆結果。',
        'This selection was not accepted. Adjust the date/time; the right rail still shows the last result.',
      )
    : acceptedMatchesRequest
      ? say(
          'homepage.source.ready',
          `已採用 ${acceptedConstellation === null ? '—' : constellationLabel(acceptedConstellation)} 的 archived TLE。`,
          `Accepted archived TLE for ${acceptedConstellation === null ? '—' : constellationLabel(acceptedConstellation)}.`,
        )
      : say(
          'homepage.source.pending',
          '目前要求尚未被接受；右側只保留上一筆結果。',
          'The requested source is not accepted yet; only the last result remains visible.',
        );

  return (
    <section
      data-testid="homepage-canonical-source-controls"
      data-requested-constellation={analysis.requestedConstellation}
      data-accepted-constellation={acceptedConstellation ?? 'none'}
      style={{
        display: 'grid',
        gap: 10,
        padding: 12,
        borderRadius: UI_TOKENS.radius.lg,
        background: UI_TOKENS.color.surface.cardFaint,
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
      }}
    >
      <div>
        <div style={groupTitleStyle}>
          {say('homepage.source.title', 'TLE 場景參數', 'TLE scenario inputs')}
        </div>
        <p style={{ ...captionTextStyle, margin: '4px 0 0' }}>
          {say(
            'homepage.source.help',
            '選擇衛星星座與台北時間；四個分頁會共用同一筆運算狀態。',
            'Choose a constellation and Taipei time; all four tabs share one calculation state.',
          )}
        </p>
      </div>

      <fieldset style={{ margin: 0, padding: 0, border: 0 }}>
        <legend style={{ ...captionTextStyle, marginBottom: 6 }}>
          {say('homepage.source.constellation', '衛星星座', 'Constellation')}
        </legend>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          {SIMULATOR_CONSTELLATIONS.map(option => {
            const selected = analysis.requestedConstellation === option.id;
            return (
              <label
                key={option.id}
                htmlFor={`homepage-constellation-${option.id}`}
                style={{
                  position: 'relative',
                  display: 'grid',
                  placeItems: 'center',
                  minHeight: 38,
                  padding: '6px 8px',
                  borderRadius: UI_TOKENS.radius.md,
                  border: selected
                    ? `1px solid ${UI_TOKENS.color.semantic.tuning}`
                    : `1px solid ${UI_TOKENS.color.border.subtle}`,
                  background: selected ? 'rgba(118, 234, 215, 0.12)' : UI_TOKENS.color.surface.card,
                  color: selected ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
                  cursor: 'pointer',
                  fontWeight: UI_TOKENS.type.weight.strong,
                }}
              >
                <input
                  id={`homepage-constellation-${option.id}`}
                  type="radio"
                  name="homepage-constellation"
                  value={option.id}
                  checked={selected}
                  onChange={changeConstellation}
                  style={{ position: 'absolute', inlineSize: 1, blockSize: 1, opacity: 0 }}
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div style={{ display: 'grid', gap: 6 }}>
        <label htmlFor="homepage-tle-time" style={captionTextStyle}>
          {say('homepage.source.time', `日期與時間（${SIMULATOR_TIME_ZONE}）`, `Date and time (${SIMULATOR_TIME_ZONE})`)}
        </label>
        <input
          id="homepage-tle-time"
          data-testid="homepage-tle-time-control"
          type="datetime-local"
          value={analysis.taipeiDateTime}
          min={minDateTime}
          max={maxDateTime}
          step={60}
          onChange={event => analysis.setTaipeiDateTime(event.currentTarget.value)}
          style={{
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            padding: '8px 9px',
            borderRadius: UI_TOKENS.radius.md,
            border: `1px solid ${UI_TOKENS.color.border.subtle}`,
            background: UI_TOKENS.color.surface.card,
            color: UI_TOKENS.color.text.primary,
            colorScheme: 'dark',
          }}
        />
        <button
          type="button"
          data-testid="homepage-tle-time-reset"
          disabled={currentCatalog === null}
          onClick={analysis.resetTaipeiDateTime}
          style={{
            justifySelf: 'start',
            padding: '6px 9px',
            borderRadius: UI_TOKENS.radius.md,
            border: `1px solid ${UI_TOKENS.color.border.subtle}`,
            background: UI_TOKENS.color.surface.card,
            color: UI_TOKENS.color.text.secondary,
            cursor: currentCatalog === null ? 'not-allowed' : 'pointer',
            opacity: currentCatalog === null ? 0.55 : 1,
          }}
        >
          {say('homepage.source.latest', '回到資料最新日期', 'Use latest archive date')}
        </button>
      </div>

      <div
        role={analysis.status === 'error' ? 'alert' : 'status'}
        aria-live="polite"
        style={{
          display: 'grid',
          gap: 3,
          paddingTop: 8,
          borderTop: `1px solid ${UI_TOKENS.color.border.subtle}`,
        }}
      >
        <span style={{ ...captionTextStyle, color: acceptedMatchesRequest ? UI_TOKENS.color.text.secondary : UI_TOKENS.color.semantic.warning.accent }}>
          {statusText}
        </span>
        {analysis.frame !== null && (
          <span
            data-readonly="true"
            data-frame-state={acceptedMatchesRequest ? 'accepted-request' : 'last-accepted-fallback'}
            style={captionTextStyle}
          >
            {acceptedMatchesRequest
              ? say('homepage.source.satellite', '目前衛星', 'Selected satellite')
              : say('homepage.source.acceptedSatellite', '上次接受的衛星', 'Last accepted satellite')}
            ：{analysis.frame.selectedSatelliteId}
            {' · '}
            {acceptedMatchesRequest
              ? say('homepage.source.snapshot', '資料日期', 'Snapshot')
              : say('homepage.source.acceptedSnapshot', '上次接受的資料日期', 'Last accepted snapshot')}
            ：{formatArchiveDate(analysis.frame.tleState.archiveDate)}
          </span>
        )}
        {analysis.status === 'error' && analysis.error !== null && (
          <span style={{ ...captionTextStyle, overflowWrap: 'anywhere' }}>{analysis.error}</span>
        )}
      </div>
    </section>
  );
}
