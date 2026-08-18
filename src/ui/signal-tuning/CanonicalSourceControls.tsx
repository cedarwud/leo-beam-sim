import type { ChangeEvent } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import {
  SIMULATOR_CONSTELLATIONS,
  SIMULATOR_TIME_ZONE,
  type SimulatorConstellation,
} from '../../simulator/types';
import { DEFAULT_TLE_TIME_FALLBACK_LIMIT } from '../../simulator/tleTimeFallback';
import { utcToAsiaTaipei } from '../../tle/timezone';
import { txBi } from './labels';
import { captionTextStyle, groupTitleStyle } from './styles';
import {
  HOMEPAGE_DEFAULT_CONSTELLATION,
  type HomepageCanonicalAnalysisState,
} from './useHomepageCanonicalAnalysis';

function formatArchiveDate(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function constellationLabel(value: SimulatorConstellation): string {
  return SIMULATOR_CONSTELLATIONS.find(option => option.id === value)?.label ?? value;
}

function formatTaipeiInstant(value: string): string {
  return utcToAsiaTaipei(value).slice(0, 19).replace('T', ' ');
}

function formatTimeOffset(offsetSeconds: number, isEnglish = false): string {
  const direction = offsetSeconds < 0
    ? isEnglish ? 'earlier by' : '提早'
    : isEnglish ? 'later by' : '延後';
  const absolute = Math.abs(offsetSeconds);
  const hours = Math.floor(absolute / 3_600);
  const minutes = Math.floor((absolute % 3_600) / 60);
  const seconds = Math.round(absolute % 60);
  const parts = [
    hours > 0 ? `${hours} ${isEnglish ? 'h' : '小時'}` : '',
    minutes > 0 ? `${minutes} ${isEnglish ? 'min' : '分'}` : '',
    seconds > 0 || (hours === 0 && minutes === 0) ? `${seconds} ${isEnglish ? 's' : '秒'}` : '',
  ].filter(Boolean);
  return `${direction} ${parts.join(' ')}`;
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
  const orbitSettingsDirty = analysis.orbitSettingsDirty ?? false;
  const acceptedMatchesRequest = analysis.status === 'ready'
    && !orbitSettingsDirty
    && acceptedConstellation === analysis.requestedConstellation;
  const acceptedTimeResolution = acceptedMatchesRequest ? analysis.timeResolution ?? null : null;
  const usedCatalogBoundaryFallback = acceptedTimeResolution?.usedFallback === true;
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

  const statusText = analysis.status === 'loading' && analysis.timeFallbackSearch != null
    ? say(
      'homepage.source.searchingFallback',
      `正在嘗試附近時間（${analysis.timeFallbackSearch.attemptNumber}/${analysis.timeFallbackSearch.candidateCount}）。`,
      `Trying a nearby time (${analysis.timeFallbackSearch.attemptNumber}/${analysis.timeFallbackSearch.candidateCount}).`,
    )
    : analysis.status === 'loading'
    ? say(
      'homepage.source.loading',
      `正在計算 ${constellationLabel(analysis.requestedConstellation)} 軌道。`,
      `Calculating the ${constellationLabel(analysis.requestedConstellation)} orbit.`,
    )
    : orbitSettingsDirty
      ? say(
        'homepage.source.draftPending',
        '衛星軌道設定已變更但尚未套用；按下「套用並重新計算」後才會更換場景與結果。',
        'The orbit settings have changed but are not applied; the scene and results change only after Apply and recalculate.',
      )
    : analysis.status === 'error'
      ? null
    : usedCatalogBoundaryFallback
      ? say(
        'homepage.source.readyFallback',
        `所選時間不可用，已改用附近可用時間（${formatTimeOffset(acceptedTimeResolution.offsetSeconds)}）。`,
        `The selected time was unavailable; using a nearby valid time (${formatTimeOffset(acceptedTimeResolution.offsetSeconds, true)}).`,
      )
    : acceptedMatchesRequest
      ? say(
          'homepage.source.ready',
          `目前使用 ${acceptedConstellation === null ? '—' : constellationLabel(acceptedConstellation)} 的 archived TLE。`,
          `Currently using the archived TLE for ${acceptedConstellation === null ? '—' : constellationLabel(acceptedConstellation)}.`,
        )
      : say(
          'homepage.source.pending',
          '資料準備中。',
          'Preparing orbit data.',
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
      <div style={groupTitleStyle}>
        {say('homepage.source.title', '衛星軌道設定', 'Satellite orbit settings')}
      </div>

      <fieldset
        data-testid="homepage-constellation-control"
        data-source-provenance="local archived TLE catalog; resolved snapshot propagated with SGP4"
        data-reset-value={HOMEPAGE_DEFAULT_CONSTELLATION}
        style={{ margin: 0, padding: 0, border: 0 }}
      >
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
        <button
          type="button"
          data-testid="homepage-constellation-reset"
          disabled={analysis.requestedConstellation === HOMEPAGE_DEFAULT_CONSTELLATION}
          onClick={analysis.resetRequestedConstellation}
          style={{
            marginTop: 7,
            padding: '6px 9px',
            borderRadius: UI_TOKENS.radius.md,
            border: `1px solid ${UI_TOKENS.color.border.subtle}`,
            background: UI_TOKENS.color.surface.card,
            color: UI_TOKENS.color.text.secondary,
            cursor: analysis.requestedConstellation === HOMEPAGE_DEFAULT_CONSTELLATION ? 'default' : 'pointer',
            opacity: analysis.requestedConstellation === HOMEPAGE_DEFAULT_CONSTELLATION ? 0.55 : 1,
          }}
        >
          {say('homepage.source.resetConstellation', '回到預設 Starlink', 'Reset to Starlink')}
        </button>
      </fieldset>

      <div style={{ display: 'grid', gap: 6 }}>
        <label htmlFor="homepage-tle-time" style={captionTextStyle}>
          {say('homepage.source.time', `日期與時間（${SIMULATOR_TIME_ZONE}）`, `Date and time (${SIMULATOR_TIME_ZONE})`)}
        </label>
        <input
          id="homepage-tle-time"
          data-testid="homepage-tle-time-control"
          data-source-provenance="requested Asia/Taipei instant resolved against the selected archived TLE catalog"
          data-reset-value="latest available archive date at 20:00 Asia/Taipei"
          type="datetime-local"
          value={analysis.taipeiDateTime}
          min={minDateTime}
          max={maxDateTime}
          step={1}
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
        <button
          type="button"
          data-testid="homepage-tle-apply"
          disabled={analysis.applyRequestedOrbitSettings === undefined
            || (!orbitSettingsDirty && analysis.status !== 'error')}
          onClick={analysis.applyRequestedOrbitSettings}
          style={{
            justifySelf: 'stretch',
            minHeight: 40,
            padding: '8px 10px',
            borderRadius: UI_TOKENS.radius.md,
            border: `1px solid ${UI_TOKENS.color.semantic.tuning}`,
            background: orbitSettingsDirty || analysis.status === 'error'
              ? 'rgba(118, 234, 215, 0.15)'
              : UI_TOKENS.color.surface.card,
            color: orbitSettingsDirty || analysis.status === 'error'
              ? UI_TOKENS.color.text.primary
              : UI_TOKENS.color.text.muted,
            cursor: analysis.applyRequestedOrbitSettings !== undefined
              && (orbitSettingsDirty || analysis.status === 'error')
              ? 'pointer'
              : 'not-allowed',
            fontWeight: UI_TOKENS.type.weight.strong,
          }}
        >
          {analysis.status === 'error' && !orbitSettingsDirty
            ? say('homepage.source.retry', '重試這筆設定', 'Retry this setting')
            : say('homepage.source.apply', '套用並重新計算', 'Apply and recalculate')}
        </button>
      </div>

      {(statusText !== null
        || (analysis.runProgress !== undefined && analysis.runProgress !== null && analysis.status === 'loading')
        || (usedCatalogBoundaryFallback && acceptedTimeResolution !== null)
        || analysis.frame !== null) && <div
        role={analysis.status === 'error' ? 'alert' : 'status'}
        aria-live="polite"
        style={{
          display: 'grid',
          gap: 3,
          paddingTop: 8,
          borderTop: `1px solid ${UI_TOKENS.color.border.subtle}`,
        }}
      >
        {statusText === null ? null : (
          <span style={{ ...captionTextStyle, color: acceptedMatchesRequest && !usedCatalogBoundaryFallback ? UI_TOKENS.color.text.secondary : UI_TOKENS.color.semantic.warning.accent }}>
            {statusText}
          </span>
        )}
        {analysis.runProgress !== undefined && analysis.runProgress !== null && analysis.status === 'loading' && (
          <div
            data-testid="homepage-tle-run-progress"
            style={{ display: 'grid', gap: 4 }}
          >
            <progress
              max={analysis.runProgress.totalAnchors}
              value={analysis.runProgress.completedAnchors}
              aria-label={say(
                'homepage.source.progress.label',
                '完整兩小時軌道計算進度',
                'Complete two-hour orbit calculation progress',
              )}
              style={{ width: '100%', accentColor: UI_TOKENS.color.semantic.tuning }}
            />
            <span style={captionTextStyle}>
              {say(
                'homepage.source.progress.value',
                `已完成 ${analysis.runProgress.completedAnchors}/${analysis.runProgress.totalAnchors}。`,
                `${analysis.runProgress.completedAnchors}/${analysis.runProgress.totalAnchors} complete.`,
              )}
            </span>
          </div>
        )}
        {usedCatalogBoundaryFallback && acceptedTimeResolution !== null && (
          <div
            data-testid="homepage-tle-time-fallback-disclosure"
            data-fallback-search-scope="bounded-catalog-max-epoch-boundaries"
            data-fallback-candidate-limit={DEFAULT_TLE_TIME_FALLBACK_LIMIT}
            data-requested-instant-utc={acceptedTimeResolution.requestedInstantUtc}
            data-applied-instant-utc={acceptedTimeResolution.appliedInstantUtc}
            data-offset-seconds={acceptedTimeResolution.offsetSeconds}
            style={{
              display: 'grid',
              gap: 2,
              padding: '7px 8px',
              borderRadius: UI_TOKENS.radius.md,
              border: `1px solid ${UI_TOKENS.color.semantic.warning.accent}`,
              background: 'rgba(255, 187, 92, 0.08)',
            }}
          >
            <span style={captionTextStyle}>
              {say('homepage.source.requestedTime', '原選時間', 'Requested time')}：
              {formatTaipeiInstant(acceptedTimeResolution.requestedInstantUtc)}
            </span>
            <span style={captionTextStyle}>
              {say('homepage.source.appliedTime', '實際套用時間', 'Applied time')}：
              {formatTaipeiInstant(acceptedTimeResolution.appliedInstantUtc)}
              {' · '}{formatTimeOffset(acceptedTimeResolution.offsetSeconds, isEnglish)}
            </span>
          </div>
        )}
        {analysis.frame !== null && (
          <span
            data-readonly="true"
            data-frame-state={acceptedMatchesRequest ? 'accepted-request' : 'last-accepted-fallback'}
            data-tle-archive-date={analysis.frame.tleState.archiveDate}
            data-applied-instant-taipei={analysis.frame.instantTaipei}
            style={captionTextStyle}
          >
            {acceptedMatchesRequest
              ? say('homepage.source.satellite', '目前衛星', 'Selected satellite')
              : say('homepage.source.acceptedSatellite', '上一筆有效結果的衛星', 'Satellite in the previous valid result')}
            ：{analysis.frame.selectedSatelliteId}
            {' · '}
            {acceptedMatchesRequest
              ? say('homepage.source.appliedInstant', '模擬時間', 'Simulation time')
              : say('homepage.source.acceptedInstant', '上一筆有效結果的模擬時間', 'Simulation time in the previous valid result')}
            ：{analysis.frame.instantTaipei.slice(0, 19).replace('T', ' ')}
          </span>
        )}
      </div>}
    </section>
  );
}
