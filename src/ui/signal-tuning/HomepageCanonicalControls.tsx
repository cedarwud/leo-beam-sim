import type { ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { CanonicalSourceControls } from './CanonicalSourceControls';
import { MainTabList } from './MainTabList';
import { PowerTab } from './PowerTab';
import { ThroughputTab } from './ThroughputTab';
import { txBi } from './labels';
import {
  captionTextStyle,
  groupTitleStyle,
  pagePanelStyle,
  panelStyle,
} from './styles';
import type { MainTabKey } from './types';
import type { HomepageCanonicalAnalysisState } from './useHomepageCanonicalAnalysis';

function scientific(value: number | undefined, unit: string): string {
  return value !== undefined && Number.isFinite(value) ? `${value.toExponential(3)} ${unit}` : '—';
}

function decimal(value: number | undefined, unit: string, digits = 3): string {
  return value !== undefined && Number.isFinite(value) ? `${value.toFixed(digits)} ${unit}` : '—';
}

function firstScalar(value: number | readonly number[] | undefined): number | undefined {
  return typeof value === 'number' ? value : value?.[0];
}

function ReadonlyParameter({
  label,
  value,
  note,
}: {
  readonly label: ReactNode;
  readonly value: string;
  readonly note: string;
}) {
  return (
    <div
      data-readonly="true"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(82px, auto) 1fr',
        gap: 8,
        alignItems: 'baseline',
        padding: '8px 9px',
        borderRadius: UI_TOKENS.radius.md,
        background: UI_TOKENS.color.surface.cardFaint,
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
      }}
    >
      <span style={{ ...captionTextStyle, color: UI_TOKENS.color.text.primary }}>{label}</span>
      <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <strong style={{ color: UI_TOKENS.color.text.primary, overflowWrap: 'anywhere' }}>{value}</strong>
        <small style={captionTextStyle}>{note}</small>
      </span>
    </div>
  );
}

function ParameterSection({
  title,
  children,
  testId,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly testId: string;
}) {
  return (
    <section data-testid={testId} style={{ ...pagePanelStyle, display: 'grid', gap: 10 }}>
      <div style={groupTitleStyle}>{title}</div>
      <div style={{ display: 'grid', gap: 8 }}>{children}</div>
    </section>
  );
}

function SinrParameters({ analysis }: { readonly analysis: HomepageCanonicalAnalysisState }) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const frame = analysis.frame;
  const link = frame?.links[0];
  const config = frame?.inputs.config;
  return (
    <ParameterSection
      testId="homepage-sinr-parameters"
      title={say('homepage.sinr.parameters', 'SINR 計算參數', 'SINR calculation inputs')}
    >
      <ReadonlyParameter
        label={<>θ</>}
        value={decimal(link?.offAxisAngleRad, 'rad', 6)}
        note={say('homepage.param.theta', '由所選 TLE 與地面站幾何得到', 'Derived from the selected TLE and ground geometry')}
      />
      <ReadonlyParameter
        label={say('homepage.param.distance.label', '鏈路距離', 'Link distance')}
        value={decimal(link?.distanceKm, 'km', 1)}
        note={say('homepage.param.distance', '由 SGP4 位置與台北地面站得到', 'Derived from SGP4 position and the Taipei ground site')}
      />
      <ReadonlyParameter
        label={say('homepage.param.elevation.label', '仰角', 'Elevation')}
        value={decimal(link?.elevationDeg, '°', 2)}
        note={say('homepage.param.elevation', '用來確認目前衛星位於地平線上方', 'Confirms that the selected satellite is above the horizon')}
      />
      <ReadonlyParameter
        label={<>H<sub>u,b</sub></>}
        value={scientific(frame?.inputs.frame.propagationGainUb[0]?.[0], 'linear')}
        note={say('homepage.param.propagation', '目前情境的 normalized propagation gain', 'Normalized propagation gain for the current scenario')}
      />
      <ReadonlyParameter
        label={<>G<sup>R</sup></>}
        value={decimal(frame?.inputs.frame.receiveGainUb[0]?.[0], 'linear', 3)}
        note={say('homepage.param.receiveGain', '目前情境固定的接收增益', 'Fixed receive gain for this scenario')}
      />
      <ReadonlyParameter
        label={<>σ²</>}
        value={scientific(config?.noisePowerW, 'W')}
        note={say('homepage.param.noise', '完整計算鏈採用的固定雜訊輸入', 'Fixed noise input used by the full calculation chain')}
      />
      <p style={{ ...captionTextStyle, margin: 0 }}>
        {say(
          'homepage.sinr.resultsRight',
          'P_DL_actual、signal、interference 與最終 SINR 只在右側結果區顯示。',
          'P_DL_actual, signal, interference, and final SINR appear only in the right result rail.',
        )}
      </p>
    </ParameterSection>
  );
}

function EeParameters({ analysis }: { readonly analysis: HomepageCanonicalAnalysisState }) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const config = analysis.frame?.inputs.config;
  return (
    <ParameterSection
      testId="homepage-ee-parameters"
      title={say('homepage.ee.parameters', 'EE 聚合與事件參數', 'EE aggregation and event inputs')}
    >
      <ReadonlyParameter
        label={say('homepage.ee.aggregation.label', '聚合方式', 'Aggregation')}
        value="ratio-of-sums"
        note={say('homepage.ee.aggregation', '先累加資料量與能量，再做一次相除', 'Accumulate delivered bits and energy before taking one ratio')}
      />
      <ReadonlyParameter
        label={<>Δt</>}
        value={decimal(config?.frameDurationS, 's', 1)}
        note={say('homepage.ee.duration', '目前每個 accepted frame 的評估時間', 'Evaluation duration of the accepted frame')}
      />
      <ReadonlyParameter
        label={<>E<sub>train</sub></>}
        value={scientific(firstScalar(config?.trainingEnergyJByBeam), 'J')}
        note={say('homepage.ee.training', '目前情境未啟用 training event energy', 'Training event energy is inactive in this scenario')}
      />
      <ReadonlyParameter
        label={<>E<sub>switch</sub></>}
        value={scientific(config?.switchEnergyJ, 'J')}
        note={say('homepage.ee.switch', '時間切換是 TLE snapshot selection，不計為 handover event', 'Time selection is TLE snapshot selection, not a handover event')}
      />
      <p style={{ ...captionTextStyle, margin: 0 }}>
        {say(
          'homepage.ee.controlsElsewhere',
          '吞吐量分子使用 Throughput 分頁的輸入；功率分母使用 Power 分頁的輸入。最終 EE 只在右側顯示。',
          'The throughput numerator uses the Throughput inputs and the power denominator uses the Power inputs. Final EE appears only on the right.',
        )}
      </p>
    </ParameterSection>
  );
}

function PowerFixedParameters({ analysis }: { readonly analysis: HomepageCanonicalAnalysisState }) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const config = analysis.frame?.inputs.config;
  return (
    <ParameterSection
      testId="homepage-power-fixed-parameters"
      title={say('homepage.power.fixed', '目前固定的功率參數', 'Currently fixed power inputs')}
    >
      <ReadonlyParameter
        label={say('homepage.power.backoff.label', 'PA backoff', 'PA backoff')}
        value={decimal(config?.backoffDb, 'dB', 1)}
        note={say('homepage.power.backoff', '目前模型固定，會影響負載相依的 η_PA', 'Currently fixed; affects load-dependent eta_PA')}
      />
      <ReadonlyParameter
        label={<>P<sub>event</sub></>}
        value={scientific((firstScalar(config?.trainingEnergyJByBeam) ?? 0) + (config?.switchEnergyJ ?? 0), 'J/frame')}
        note={say('homepage.power.event', '目前 training 與 switch 指示皆未啟用', 'Training and switch indicators are inactive')}
      />
    </ParameterSection>
  );
}

function ThroughputFixedParameters({ analysis }: { readonly analysis: HomepageCanonicalAnalysisState }) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const frame = analysis.frame;
  return (
    <ParameterSection
      testId="homepage-throughput-fixed-parameters"
      title={say('homepage.throughput.fixed', '目前固定的服務參數', 'Currently fixed service inputs')}
    >
      <ReadonlyParameter
        label={<>U<sub>b</sub></>}
        value={String(frame?.inputs.frame.beamLoadB[0] ?? '—')}
        note={say('homepage.throughput.load', '目前 active beam 的服務負載', 'Service load on the active beam')}
      />
      <ReadonlyParameter
        label={<>b(u)</>}
        value={String(frame?.inputs.frame.servingBeamU[0] ?? '—')}
        note={say('homepage.throughput.assignment', '目前使用者指派到的服務波束索引', 'Serving-beam index assigned to the current user')}
      />
    </ParameterSection>
  );
}

export function HomepageCanonicalControls({
  analysis,
  activeTab,
  onActiveTabChange,
}: {
  readonly analysis: HomepageCanonicalAnalysisState;
  readonly activeTab: MainTabKey;
  readonly onActiveTabChange: (next: MainTabKey) => void;
}) {
  return (
    <aside
      className="leo-signal-tuning-panel"
      data-testid="homepage-canonical-controls"
      aria-label="Analysis parameters"
      style={panelStyle}
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <CanonicalSourceControls analysis={analysis} />
        <MainTabList activeTab={activeTab} onChange={onActiveTabChange} />
        {activeTab === 'sinr' && <SinrParameters analysis={analysis} />}
        {activeTab === 'energy' && <EeParameters analysis={analysis} />}
        {activeTab === 'power' && (
          <>
            <PowerTab parameters={analysis.parameters} onParametersChange={analysis.setParameters} />
            <PowerFixedParameters analysis={analysis} />
          </>
        )}
        {activeTab === 'throughput' && (
          <>
            <ThroughputTab parameters={analysis.parameters} onParametersChange={analysis.setParameters} />
            <ThroughputFixedParameters analysis={analysis} />
          </>
        )}
      </div>
    </aside>
  );
}
