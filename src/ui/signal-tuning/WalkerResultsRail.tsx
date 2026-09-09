import type { CSSProperties, ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import type { Profile } from '../../profiles/types';
import type { SimState } from '../../scene/types';
import type { AngleAwareFormulaFrame } from '../../engine/signal/types';
import { FormulaTermsReadout } from '../info-panel/FormulaTermsReadout';
import {
  BeamEfficiency,
  BeamSupplyPower,
  LinkChannel,
  LinkEnergyEfficiency,
  LinkInterference,
  LinkRate,
  LinkRfPower,
  LinkTransmitGain,
  SystemAngleState,
  Theta3db,
} from './FormulaSymbols';
import { txBi } from './labels';
import { formatPower } from './formatters';

type WalkerResultsRailState = Pick<
  SimState,
  | 'physicalServing'
  | 'physicalServingBudget'
  | 'servingCellId'
  | 'pendingTargetSatId'
  | 'simTimeSec'
  | 'beamHopEnabled'
>;

interface WalkerResultsRailProps extends WalkerResultsRailState {
  readonly profile: Profile;
  readonly isFormulaEvidenceStale: boolean;
  readonly children: ReactNode;
  readonly angleAwareFormulaFrame?: AngleAwareFormulaFrame | null;
}

type ResultSection = 'sinr' | 'power' | 'throughput' | 'ee';

function formatValue(
  value: number | null | undefined,
  unit: string,
  locale: string,
  digits = 2,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (unit === 'W') return formatPower(value);
  const absolute = Math.abs(value);
  const scale = unit === 'W' || unit === 'J'
    ? absolute >= 1e9 ? { divisor: 1e9, suffix: unit === 'W' ? 'GW' : 'GJ' }
      : absolute >= 1e6 ? { divisor: 1e6, suffix: unit === 'W' ? 'MW' : 'MJ' }
        : absolute >= 1e3 ? { divisor: 1e3, suffix: unit === 'W' ? 'kW' : 'kJ' }
          : { divisor: 1, suffix: unit }
    : unit === 'Mbit/s' || unit === 'Mbit' || unit === 'Mbit/J'
      ? absolute >= 1e6 ? { divisor: 1e6, suffix: unit === 'Mbit/s' ? 'Tbit/s' : unit === 'Mbit' ? 'Tbit' : 'Tbit/J' }
        : absolute >= 1e3 ? { divisor: 1e3, suffix: unit === 'Mbit/s' ? 'Gbit/s' : unit === 'Mbit' ? 'Gbit' : 'Gbit/J' }
          : { divisor: 1, suffix: unit }
      : unit === 'bit/J'
        ? absolute >= 1e9 ? { divisor: 1e9, suffix: 'Gbit/J' }
          : absolute >= 1e6 ? { divisor: 1e6, suffix: 'Mbit/J' }
            : absolute >= 1e3 ? { divisor: 1e3, suffix: 'kbit/J' }
              : { divisor: 1, suffix: 'bit/J' }
      : unit === 'MHz' && absolute >= 1e3
        ? { divisor: 1e3, suffix: 'GHz' }
        : { divisor: 1, suffix: unit };
  const rendered = (value / scale.divisor).toLocaleString(locale === 'en' ? 'en-US' : 'zh-TW', {
    maximumFractionDigits: digits,
  });
  return scale.suffix.length > 0 ? `${rendered} ${scale.suffix}` : rendered;
}

function formatEnergyEfficiencyValue(value: number | null | undefined, locale: string): string {
  return formatValue(value, 'bit/J', locale);
}

function ResultRow({
  testId,
  symbol,
  scope,
  scopeLabel,
  note,
  value,
}: {
  readonly testId: string;
  readonly symbol: ReactNode;
  readonly scope: 'primary-ue' | 'system' | 'beam-aggregate';
  readonly scopeLabel: string;
  readonly note: string;
  readonly value: string;
}) {
  return (
    <div className="leo-walker-result-row" data-testid={testId} data-readonly="true" data-scope={scope}>
      <div className="leo-walker-result-row__identity">
        <div className="leo-walker-result-row__meta">
          <span className="leo-walker-result-row__symbol">{symbol}</span>
          <span className="leo-walker-result-row__scope-tag" data-scope={scope} aria-label={scopeLabel}>
            {scopeLabel}
          </span>
        </div>
        <span className="leo-walker-result-row__note">{note}</span>
      </div>
      <strong className="leo-walker-result-row__value">{value}</strong>
    </div>
  );
}

function ResultDisclosure({
  section,
  accent,
  marker,
  title,
  summaryValue,
  children,
}: {
  readonly section: ResultSection;
  readonly accent: string;
  readonly marker: ReactNode;
  readonly title: string;
  readonly summaryValue: string;
  readonly children: ReactNode;
}) {
  return (
    <details
      className="leo-walker-result-section"
      data-testid={`walker-result-section-${section}`}
      data-result-section={section}
      style={{ '--leo-result-accent': accent } as CSSProperties}
    >
      <summary className="leo-walker-result-section__summary">
        <span className="leo-walker-result-section__name">
          <span className="leo-walker-result-section__marker" aria-hidden="true">{marker}</span>
          <strong>{title}</strong>
        </span>
        <span className="leo-walker-result-section__summary-value">{summaryValue}</span>
      </summary>
      <div className="leo-walker-result-section__body">
        {children}
      </div>
    </details>
  );
}

/**
 * Legacy Walker result rail. Every value below is projected from the same live
 * scene frame rendered in the centre; it never consumes the independent TLE
 * analysis state used by the canonical simulator route.
 */
export function WalkerResultsRail({
  profile,
  physicalServing,
  physicalServingBudget,
  servingCellId,
  pendingTargetSatId,
  angleAwareFormulaFrame = null,
  simTimeSec,
  beamHopEnabled,
  isFormulaEvidenceStale,
  children,
}: WalkerResultsRailProps) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const terms = angleAwareFormulaFrame?.terms;
  const liveSinrDb = terms?.gammaDb ?? null;
  const liveSystemPowerW = terms?.systemPowerW ?? null;
  const liveThroughputBps = terms?.throughputBps ?? null;
  const liveEeBitsPerJoule = terms?.energyEfficiencyBitsPerJoule ?? null;

  const scopePrimaryUe = say('common.scope.primaryUe', '主要 UE', 'Primary UE');
  const scopeSystem = say('common.scope.system', '系統', 'System');
  const scopeBeamAggregate = say('common.scope.beamAggregate', '波束聚合', 'Beam aggregate');

  return (
    <div
      className="leo-walker-results-rail"
      data-testid="walker-results-rail"
      data-provenance-source="synthetic-walker"
      data-right-rail-source="walker-live-scene-frame"
      data-angle-aware-frame-status={terms === undefined ? 'waiting' : 'current'}
      data-formula-contract-version={terms?.contractVersion ?? ''}
      data-angle-aware-frame-time-sec={terms?.timeSec.toFixed(3) ?? ''}
      data-angle-aware-frame-sat-id={angleAwareFormulaFrame?.satId ?? ''}
      data-angle-aware-frame-beam-id={angleAwareFormulaFrame?.beamId.toString() ?? ''}
      data-angle-aware-frame-sinr-db={terms?.gammaDb.toFixed(6) ?? ''}
      data-angle-aware-frame-throughput-bps={terms?.throughputBps.toFixed(6) ?? ''}
      data-angle-aware-frame-system-power-w={terms?.systemPowerW.toFixed(6) ?? ''}
      data-angle-aware-frame-ee-bits-per-joule={terms?.energyEfficiencyBitsPerJoule.toFixed(6) ?? ''}
      data-sim-time-sec={Number.isFinite(simTimeSec) ? simTimeSec.toFixed(2) : ''}
      data-serving-satellite-id={physicalServing.satId ?? ''}
      data-candidate-satellite-id={pendingTargetSatId ?? ''}
      data-beam-hopping-enabled={beamHopEnabled ? 'true' : 'false'}
    >
      {children}

      <div className="leo-walker-results-rail__sections" data-testid="walker-calculation-results">
        <ResultDisclosure
          section="sinr"
          accent={UI_TOKENS.color.semantic.tuning}
          marker={<>γ</>}
          title={say('walker.results.sinr.title', 'SINR', 'SINR')}
          summaryValue={formatValue(liveSinrDb, 'dB', locale, 2)}
        >
          <FormulaTermsReadout
            source={physicalServing}
            budget={physicalServingBudget}
            isFormulaEvidenceStale={isFormulaEvidenceStale}
            frequencyReuse={profile.beams.frequencyReuse}
            servingCellId={servingCellId}
            formulaFrame={angleAwareFormulaFrame}
            embedded
          />
        </ResultDisclosure>

        <ResultDisclosure
          section="power"
          accent={UI_TOKENS.color.semantic.good}
          marker={<>P</>}
          title={say('walker.results.power.title', 'Power', 'Power')}
          summaryValue={formatValue(liveSystemPowerW, 'W', locale)}
        >
          <div className="leo-walker-result-rows">
            <ResultRow
              testId="walker-result-power-output"
              symbol={<LinkRfPower />}
              scope="primary-ue"
              scopeLabel={scopePrimaryUe}
              note={say('walker.results.power.output', '選定 UE-link 的 RF 功率', 'RF power of the selected UE-link')}
              value={formatValue(terms?.powerW, 'W', locale)}
            />
            <ResultRow
              testId="walker-result-system-power"
              symbol={<>P<sup>N</sup>(t, <SystemAngleState />, <Theta3db />)</>}
              scope="system"
              scopeLabel={scopeSystem}
              note={say('walker.results.power.system', '系統總功率', 'System total power')}
              value={formatValue(liveSystemPowerW, 'W', locale)}
            />
            <ResultRow
              testId="walker-result-power-signal"
              symbol={<><LinkRfPower /> <LinkChannel /> <LinkTransmitGain /></>}
              scope="primary-ue"
              scopeLabel={scopePrimaryUe}
              note={say('walker.results.power.signal', '選定鏈路的 wanted-link 訊號功率', 'Wanted-link signal power of the selected link')}
              value={formatValue(terms?.desiredSignalW, 'W', locale)}
            />
            <ResultRow
              testId="walker-result-power-interference"
              symbol={<LinkInterference />}
              scope="primary-ue"
              scopeLabel={scopePrimaryUe}
              note={say('walker.results.power.interference', '總同頻干擾功率', 'Total co-channel interference power')}
              value={formatValue(terms?.interferenceW, 'W', locale)}
            />
            <ResultRow
              testId="walker-result-power-noise"
              symbol={<>σ²</>}
              scope="primary-ue"
              scopeLabel={scopePrimaryUe}
              note={say('walker.results.power.noise', '接收雜訊功率', 'Receiver noise power')}
              value={formatValue(terms?.noiseW, 'W', locale)}
            />
            <ResultRow
              testId="walker-result-power-consumption"
              symbol={<BeamSupplyPower />}
              scope="beam-aggregate"
              scopeLabel={scopeBeamAggregate}
              note={say('walker.results.power.consumption', '服務波束的電源端功率', 'Supply-side power of the serving beam')}
              value={formatValue(terms?.powerConsumptionW, 'W', locale)}
            />
            {/* The Walker route is a derived-value rail. The canonical homepage
                owns the editable beam/satellite and EE inputs; this rail only
                projects the accepted frame's current beam efficiency and fixed
                power values. */}
            <ResultRow
              testId="walker-result-conversion-efficiency"
              symbol={<BeamEfficiency />}
              scope="beam-aggregate"
              scopeLabel={scopeBeamAggregate}
              note={say('walker.results.power.efficiency', '服務波束的功率轉換效率', 'Power-conversion efficiency of the serving beam')}
              value={formatValue(terms?.conversionEfficiency, '', locale, 3)}
            />
            <ResultRow
              testId="walker-result-fixed-power"
              symbol={<>P<sup>f</sup>(t)</>}
              scope="system"
              scopeLabel={scopeSystem}
              note={say('walker.results.power.fixed', '系統固定／電路功率組成', 'Fixed / circuit system-power components')}
              value={formatValue(terms?.fixedPowerW, 'W', locale)}
            />
          </div>
        </ResultDisclosure>

        <ResultDisclosure
          section="throughput"
          accent={UI_TOKENS.color.semantic.info}
          marker={<>R</>}
          title={say('walker.results.throughput.title', '吞吐量', 'Throughput')}
            summaryValue={formatValue(liveThroughputBps === null ? null : liveThroughputBps / 1e6, 'Mbit/s', locale)}
        >
          <div className="leo-walker-result-rows">
            <ResultRow
              testId="walker-result-link-throughput"
              symbol={<LinkRate />}
              scope="primary-ue"
              scopeLabel={scopePrimaryUe}
              note={say('walker.results.throughput.link', '主要 UE-link 的實際速率', 'Realized rate of the primary UE-link')}
              value={formatValue(liveThroughputBps === null ? null : liveThroughputBps / 1e6, 'Mbit/s', locale)}
            />
            <ResultRow
              testId="walker-result-beam-bandwidth"
              symbol={<>B<sup>w</sup></>}
              scope="beam-aggregate"
              scopeLabel={scopeBeamAggregate}
              note={say('walker.results.throughput.bandwidth', '單一重用群組的波束頻寬', 'Beam bandwidth of one reuse group')}
              value={formatValue(terms?.bandwidthHz === undefined ? null : terms.bandwidthHz / 1e6, 'MHz', locale)}
            />
            <ResultRow
              testId="walker-result-beam-load"
              symbol={<>U<sub>s,v</sub>(t)</>}
              scope="beam-aggregate"
              scopeLabel={scopeBeamAggregate}
              note={say('walker.results.throughput.load', '主要服務波束的使用者數', 'User count on the primary serving beam')}
              value={formatValue(terms?.beamLoad, '', locale, 0)}
            />
          </div>
        </ResultDisclosure>

        <ResultDisclosure
          section="ee"
          accent={UI_TOKENS.color.semantic.warning.accent}
          marker={<>η</>}
          title={say('walker.results.ee.title', '能源效率', 'Energy efficiency')}
          summaryValue={formatEnergyEfficiencyValue(liveEeBitsPerJoule, locale)}
        >
          <div className="leo-walker-result-rows">
            <ResultRow
              testId="walker-result-link-ee"
              symbol={<LinkEnergyEfficiency />}
              scope="primary-ue"
              scopeLabel={scopePrimaryUe}
              note={say('walker.results.ee.link', '選定 UE-link 的 EE 顯示量', 'EE display value of the selected UE-link')}
              value={formatEnergyEfficiencyValue(liveEeBitsPerJoule, locale)}
            />
            <ResultRow
              testId="walker-result-instantaneous-ee"
              symbol={<LinkRate />}
              scope="primary-ue"
              scopeLabel={scopePrimaryUe}
              note={say('walker.results.ee.rate', 'EE 分子中的 throughput', 'Throughput in the EE numerator')}
              value={formatValue(liveThroughputBps === null ? null : liveThroughputBps / 1e6, 'Mbit/s', locale)}
            />
            <ResultRow
              testId="walker-result-ee-system-power"
              symbol={<>P<sup>N</sup>(t, <SystemAngleState />, <Theta3db />)</>}
              scope="system"
              scopeLabel={scopeSystem}
              note={say('walker.results.ee.systemPower', 'EE 分母中的系統總功率', 'System total power in the EE denominator')}
              value={formatValue(liveSystemPowerW, 'W', locale)}
            />
          </div>
        </ResultDisclosure>
      </div>
    </div>
  );
}
