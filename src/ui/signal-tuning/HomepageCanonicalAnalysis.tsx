import type { ReactNode } from 'react';
import type { SimulationAnalysisFrame, SimulatorTab } from '../../simulator/types';
import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import { FormulaHeader, FormulaRow } from './FormulaHeader';
import { PowerTab } from './PowerTab';
import { ThroughputTab } from './ThroughputTab';
import { txBi } from './labels';
import {
  captionTextStyle,
  groupTitleStyle,
  pagePanelStyle,
} from './styles';
import { useHomepageCanonicalAnalysis } from './useHomepageCanonicalAnalysis';

const SINR_ACCENT = UI_TOKENS.color.semantic.tuning;
const EE_ACCENT = UI_TOKENS.color.semantic.warning.accent;

function formatNumber(value: number, unit: string, digits = 3): string {
  return Number.isFinite(value)
    ? `${value.toLocaleString('en-US', { maximumFractionDigits: digits })} ${unit}`
    : '—';
}

function formatScientific(value: number, unit: string): string {
  return Number.isFinite(value) ? `${value.toExponential(3)} ${unit}` : '—';
}

function CanonicalReadout({
  testId,
  label,
  value,
  note,
  accent,
}: {
  readonly testId: string;
  readonly label: ReactNode;
  readonly value: string;
  readonly note: string;
  readonly accent: string;
}) {
  return (
    <div
      data-testid={testId}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(88px, auto) 1fr',
        gap: 8,
        alignItems: 'baseline',
        padding: '9px 10px',
        borderRadius: UI_TOKENS.radius.md,
        background: UI_TOKENS.color.surface.cardFaint,
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
      }}
    >
      <span style={{ ...captionTextStyle, color: UI_TOKENS.color.text.primary }}>{label}</span>
      <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <strong style={{ color: accent, overflowWrap: 'anywhere' }}>{value}</strong>
        <small style={captionTextStyle}>{note}</small>
      </span>
    </div>
  );
}

function SinrProjection({ frame }: { readonly frame: SimulationAnalysisFrame }) {
  const link = frame.links[0]!;
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  return (
    <section
      id="tuning-page-panel-sinr-canonical"
      data-testid="sinr-canonical-page"
      data-canonical-status="canonical"
      role="tabpanel"
      aria-label="SINR"
      style={pagePanelStyle}
    >
      <FormulaHeader
        testId="sinr-canonical-formula-header"
        title={say('panel.sinr.canonical.title', '實際 SINR', 'Realized SINR')}
        accent={SINR_ACCENT}
        caption={say(
          'panel.sinr.canonical.scope',
          '本頁只讀取 canonical producer 的 P_DL_actual、signal、interference 與 noise；沒有獨立 P_t 控制。',
          'This page reads canonical P_DL_actual, signal, interference, and noise; it has no independent P_t control.',
        )}
      >
        <FormulaRow
          testId="sinr-canonical-formula-row"
          accent={SINR_ACCENT}
          emphasis
          expression={<>SINR<sub>u</sub> = S<sub>u</sub> / (I<sub>u</sub> + σ²)</>}
          note="linear"
          source={say(
            'panel.sinr.canonical.source',
            'S 與 I 都使用同一份 post-cap P_DL_actual',
            'S and I both consume the same post-cap P_DL_actual',
          )}
        />
      </FormulaHeader>
      <div style={{ display: 'grid', gap: 8 }}>
        <CanonicalReadout testId="sinr-tab-actual-power-readout" label={<>P<sub>DL,actual</sub></>} value={formatScientific(link.actualPowerW, 'W')} note="derived / read-only" accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-tab-signal-readout" label="Signal" value={formatScientific(link.signalW, 'W')} note="useful received power" accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-tab-interference-readout" label="Interference" value={formatScientific(link.interferenceW, 'W')} note="co-channel sum" accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-tab-noise-readout" label="Noise σ²" value={formatScientific(link.noiseW, 'W')} note="canonical input" accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-tab-realized-readout" label="SINR" value={formatNumber(link.sinrDb, 'dB', 3)} note={`${link.sinrLinear.toExponential(3)} linear`} accent={SINR_ACCENT} />
        <CanonicalReadout testId="sinr-tab-angle-readout" label="off-axis θ" value={formatNumber(link.offAxisAngleRad, 'rad', 6)} note="feeds G_T(theta)" accent={SINR_ACCENT} />
      </div>
    </section>
  );
}

function EeProjection({ frame }: { readonly frame: SimulationAnalysisFrame }) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  return (
    <section
      id="tuning-page-panel-ee-canonical"
      data-testid="ee-canonical-page"
      data-canonical-status="canonical"
      role="tabpanel"
      aria-label="EE"
      style={pagePanelStyle}
    >
      <FormulaHeader
        testId="ee-canonical-formula-header"
        title={say('panel.ee.canonical.title', 'Angle-aware energy efficiency', 'Angle-aware energy efficiency')}
        accent={EE_ACCENT}
        caption={say(
          'panel.ee.canonical.scope',
          '分子使用同一 frame 的 realized throughput；分母使用完整 canonical payload-power ledger。',
          'The numerator uses realized throughput from the same frame; the denominator uses the full canonical payload-power ledger.',
        )}
      >
        <FormulaRow
          testId="ee-canonical-formula-row"
          accent={EE_ACCENT}
          emphasis
          expression={<>EE<sub>inst</sub> = Σ<sub>u</sub>R<sub>u</sub> / P<sub>sys</sub></>}
          note="bit/J"
          source={say(
            'panel.ee.canonical.source',
            'P_sys = Σ_b(P_PA + P_RFC + P_BB + P_event)',
            'P_sys = Σ_b(P_PA + P_RFC + P_BB + P_event)',
          )}
        />
      </FormulaHeader>
      <div style={{ display: 'grid', gap: 8 }}>
        <CanonicalReadout testId="ee-tab-throughput-readout" label={<>ΣR<sub>u</sub></>} value={formatNumber(frame.throughput.totalRateBps, 'bit/s', 1)} note="canonical numerator" accent={EE_ACCENT} />
        <CanonicalReadout testId="ee-tab-system-power-readout" label={<>P<sub>sys</sub></>} value={formatScientific(frame.power.systemPowerW, 'W')} note="canonical denominator" accent={EE_ACCENT} />
        <CanonicalReadout testId="ee-tab-instantaneous-readout" label={<>EE<sub>inst</sub></>} value={formatNumber(frame.ee.instantaneousBitsPerJ, 'bit/J', 1)} note="single immutable frame" accent={EE_ACCENT} />
        <CanonicalReadout testId="ee-tab-evaluation-readout" label={<>EE<sub>eval</sub></>} value={formatNumber(frame.ee.evaluationBitsPerJ, 'bit/J', 1)} note="ratio-of-sums; current window is one frame" accent={EE_ACCENT} />
        <CanonicalReadout testId="ee-tab-r1-readout" label={<>Σr<sub>1,u</sub></>} value={formatNumber(frame.canonical.ee.contributionSumBitsPerJ, 'bit/J', 1)} note={frame.canonical.ee.sumIdentity ? 'identity verified' : 'identity invalid'} accent={EE_ACCENT} />
      </div>
      <p style={captionTextStyle}>
        {say(
          'panel.ee.canonical.boundary',
          '能耗邊界是 partial payload power，不包含 bus、TT&C、thermal 或整星 wall-plug power。',
          'The boundary is partial payload power; it excludes bus, TT&C, thermal, and whole-satellite wall-plug power.',
        )}
      </p>
    </section>
  );
}

export interface HomepageCanonicalAnalysisProps {
  readonly activeTab: SimulatorTab;
}

/** Four compact projections backed by one canonical archived-TLE frame. */
export function HomepageCanonicalAnalysis({ activeTab }: HomepageCanonicalAnalysisProps) {
  const {
    frame,
    status,
    error,
    parameters,
    setParameters,
  } = useHomepageCanonicalAnalysis();
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);

  if (frame === null) {
    return (
      <section
        data-testid="homepage-canonical-analysis-state"
        data-canonical-status={status}
        role={status === 'error' ? 'alert' : 'status'}
        style={{ ...pagePanelStyle, padding: 14, border: `1px solid ${UI_TOKENS.color.border.subtle}`, borderRadius: UI_TOKENS.radius.lg }}
      >
        <div style={groupTitleStyle}>{status === 'loading' ? say('canonical.loading', '載入 canonical frame', 'Loading canonical frame') : say('canonical.error', 'Canonical frame 未接受', 'Canonical frame not accepted')}</div>
        <p style={captionTextStyle}>{error ?? say('canonical.loading.detail', '正在驗證 archived TLE 並建立 immutable analysis frame。', 'Validating archived TLE and building an immutable analysis frame.')}</p>
      </section>
    );
  }

  return (
    <div
      data-testid="homepage-canonical-analysis"
      data-frame-id={frame.frameId}
      data-contract-version={frame.contractVersion}
      style={{ display: 'grid', gap: 12 }}
    >
      <section
        data-testid="homepage-canonical-frame-identity"
        style={{
          display: 'grid',
          gap: 4,
          padding: '10px 12px',
          borderRadius: UI_TOKENS.radius.md,
          background: UI_TOKENS.color.surface.cardFaint,
          border: `1px solid ${UI_TOKENS.color.border.subtle}`,
        }}
      >
        <strong style={{ color: UI_TOKENS.color.text.primary, fontSize: UI_TOKENS.type.size.caption }}>CANONICAL · {frame.contractVersion}</strong>
        <span style={captionTextStyle}>{frame.provenance.constellation.toUpperCase()} · {frame.instantTaipei} · {frame.selectedSatelliteId}</span>
        <span style={{ ...captionTextStyle, overflowWrap: 'anywhere' }}>frame {frame.frameId}</span>
      </section>

      {activeTab === 'power' && <PowerTab result={frame.canonical} parameters={parameters} onParametersChange={setParameters} />}
      {activeTab === 'throughput' && <ThroughputTab result={frame.canonical} parameters={parameters} onParametersChange={setParameters} />}
      {activeTab === 'ee' && <EeProjection frame={frame} />}
      {activeTab === 'sinr' && <SinrProjection frame={frame} />}

      <p style={captionTextStyle}>
        {say(
          'homepage.canonical.frameBoundary',
          '此側欄使用明示的 archived-TLE canonical analysis frame；右側復原的 Walker 場景目前保留既有視覺，不冒充同一個分析 frame。',
          'This rail uses an explicit archived-TLE canonical analysis frame; the restored Walker scene remains a legacy visual and is not presented as the same frame.',
        )}
      </p>
    </div>
  );
}
