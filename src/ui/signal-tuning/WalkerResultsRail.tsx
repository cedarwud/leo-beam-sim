import type { CSSProperties, ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import { useLocale } from '../../i18n';
import type { Profile } from '../../profiles/types';
import type { SimState } from '../../scene/types';
import { FormulaTermsReadout } from '../info-panel/FormulaTermsReadout';
import { SystemAngleState } from './FormulaSymbols';
import { txBi } from './labels';
import { SIMPLIFIED_EE_LINK_INDEX } from './simplifiedEeSymbols';

type WalkerResultsRailState = Pick<
  SimState,
  | 'canonicalEe'
  | 'livePaperEnergyEfficiency'
  | 'perUePositions'
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
}

type ResultSection = 'sinr' | 'power' | 'throughput' | 'ee';

function formatValue(
  value: number | null | undefined,
  unit: string,
  locale: string,
  digits = 2,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
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
      : unit === 'MHz' && absolute >= 1e3
        ? { divisor: 1e3, suffix: 'GHz' }
        : { divisor: 1, suffix: unit };
  const rendered = (value / scale.divisor).toLocaleString(locale === 'en' ? 'en-US' : 'zh-TW', {
    maximumFractionDigits: digits,
  });
  return scale.suffix.length > 0 ? `${rendered} ${scale.suffix}` : rendered;
}

function ResultRow({
  testId,
  symbol,
  note,
  value,
}: {
  readonly testId: string;
  readonly symbol: ReactNode;
  readonly note: string;
  readonly value: string;
}) {
  return (
    <div className="leo-walker-result-row" data-testid={testId} data-readonly="true">
      <div className="leo-walker-result-row__identity">
        <span className="leo-walker-result-row__symbol">{symbol}</span>
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
  canonicalEe,
  livePaperEnergyEfficiency,
  perUePositions,
  physicalServing,
  physicalServingBudget,
  servingCellId,
  pendingTargetSatId,
  simTimeSec,
  beamHopEnabled,
  isFormulaEvidenceStale,
  children,
}: WalkerResultsRailProps) {
  const { locale, t } = useLocale();
  const isEnglish = locale === 'en';
  const say = (key: string, zh: string, en: string) => txBi(t, isEnglish, key, zh, en);
  const primaryUeId = perUePositions?.[0]?.id ?? null;
  const contributions = canonicalEe?.perUserContributions ?? [];
  const primaryContribution = (
    primaryUeId === null
      ? contributions[0]
      : contributions.find(entry => entry.ueId === primaryUeId) ?? contributions[0]
  );
  const totalRateMbps = contributions.length === 0
    ? null
    : contributions.reduce((sum, entry) => sum + (entry.rateMbps ?? 0), 0);
  const beamBandwidthMHz = livePaperEnergyEfficiency === null
    || livePaperEnergyEfficiency === undefined
    ? null
    : livePaperEnergyEfficiency.allocatedBandwidthHz / 1e6;

  return (
    <div
      className="leo-walker-results-rail"
      data-testid="walker-results-rail"
      data-right-rail-source="walker-live-scene-frame"
      data-canonical-ee-status={canonicalEe?.status ?? 'pending'}
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
          summaryValue={formatValue(physicalServing.sinrDb, 'dB', locale, 2)}
        >
          <FormulaTermsReadout
            source={physicalServing}
            budget={physicalServingBudget}
            isFormulaEvidenceStale={isFormulaEvidenceStale}
            frequencyReuse={profile.beams.frequencyReuse}
            servingCellId={servingCellId}
            embedded
          />
        </ResultDisclosure>

        <ResultDisclosure
          section="power"
          accent={UI_TOKENS.color.semantic.good}
          marker={<>P</>}
          title={say('walker.results.power.title', 'Power', 'Power')}
          summaryValue={formatValue(canonicalEe?.systemPowerW, 'W', locale)}
        >
          <div className="leo-walker-result-rows">
            <ResultRow
              testId="walker-result-power-output"
              symbol={<><i>p</i><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</>}
              note={say('walker.results.power.output', '主要 UE-link 的 RF 功率', 'RF power of the primary UE-link')}
              value={formatValue(canonicalEe?.actualRfOutputW, 'W', locale)}
            />
            <ResultRow
              testId="walker-result-system-power"
              symbol={<>P<sup>N</sup>(t, <SystemAngleState />)</>}
              note={say('walker.results.power.system', '全系統總功率', 'Total system power')}
              value={formatValue(canonicalEe?.systemPowerW, 'W', locale)}
            />
            <ResultRow
              testId="walker-result-power-signal"
              symbol={<><i>p</i><sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />) · h<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</>}
              note={say('walker.results.power.signal', '目前 UE 的接收訊號功率', 'Current received signal power of the UE')}
              value={formatValue(physicalServingBudget?.signalDbm, 'dBm', locale)}
            />
            <ResultRow
              testId="walker-result-power-intra-interference"
              symbol={<>I<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</>}
              note={say('walker.results.power.intra', '同一衛星的干擾功率', 'Same-satellite interference power')}
              value={formatValue(physicalServingBudget?.intraInterferenceDbm, 'dBm', locale)}
            />
            <ResultRow
              testId="walker-result-power-inter-interference"
              symbol={<>I<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</>}
              note={say('walker.results.power.inter', '其他衛星的干擾功率', 'Cross-satellite interference power')}
              value={formatValue(physicalServingBudget?.interInterferenceDbm, 'dBm', locale)}
            />
            <ResultRow
              testId="walker-result-power-noise"
              symbol={<>σ²</>}
              note={say('walker.results.power.noise', '接收雜訊功率', 'Receiver noise power')}
              value={formatValue(physicalServingBudget?.noiseDbm, 'dBm', locale)}
            />
          </div>
        </ResultDisclosure>

        <ResultDisclosure
          section="throughput"
          accent={UI_TOKENS.color.semantic.info}
          marker={<>R</>}
          title={say('walker.results.throughput.title', '吞吐量', 'Throughput')}
          summaryValue={formatValue(totalRateMbps, 'Mbit/s', locale)}
        >
          <div className="leo-walker-result-rows">
            <ResultRow
              testId="walker-result-link-throughput"
              symbol={<>R<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</>}
              note={say('walker.results.throughput.link', '主要 UE-link 的實際速率', 'Realized rate of the primary UE-link')}
              value={formatValue(primaryContribution?.rateMbps, 'Mbit/s', locale)}
            />
            <ResultRow
              testId="walker-result-total-throughput"
              symbol={say('walker.results.throughput.totalSymbol', '總量', 'Total')}
              note={say('walker.results.throughput.total', '所有使用者的總吞吐量', 'Total throughput of all users')}
              value={formatValue(totalRateMbps, 'Mbit/s', locale)}
            />
            <ResultRow
              testId="walker-result-beam-bandwidth"
              symbol={<>B<sup>w</sup></>}
              note={say('walker.results.throughput.bandwidth', '單一重用群組的波束頻寬', 'Beam bandwidth of one reuse group')}
              value={formatValue(beamBandwidthMHz, 'MHz', locale)}
            />
            <ResultRow
              testId="walker-result-beam-load"
              symbol={<>U<sub>s,v</sub>(t)</>}
              note={say('walker.results.throughput.load', '主要服務波束的使用者數', 'User count on the primary serving beam')}
              value={formatValue(primaryContribution?.assignedBeamLoad, '', locale, 0)}
            />
          </div>
        </ResultDisclosure>

        <ResultDisclosure
          section="ee"
          accent={UI_TOKENS.color.semantic.warning.accent}
          marker={<>η</>}
          title={say('walker.results.ee.title', '能源效率', 'Energy efficiency')}
          summaryValue={formatValue(canonicalEe?.eeInstMbitPerJ, 'Mbit/J', locale)}
        >
          <div className="leo-walker-result-rows">
            <ResultRow
              testId="walker-result-link-ee"
              symbol={<>η<sub>{SIMPLIFIED_EE_LINK_INDEX}</sub>(t, <SystemAngleState />)</>}
              note={say('walker.results.ee.link', '主要 UE-link 對系統 EE 的當步貢獻', 'Current-step contribution of the primary UE-link to system EE')}
              value={formatValue(primaryContribution?.contributionMbitPerJ, 'Mbit/J', locale)}
            />
            <ResultRow
              testId="walker-result-instantaneous-ee"
              symbol={say('walker.results.ee.instantaneousSymbol', '系統 EE', 'System EE')}
              note={say('walker.results.ee.instantaneous', '當步系統能源效率', 'Current-step system energy efficiency')}
              value={formatValue(canonicalEe?.eeInstMbitPerJ, 'Mbit/J', locale)}
            />
            <ResultRow
              testId="walker-result-evaluation-ee"
              symbol={say('walker.results.ee.evaluationSymbol', '評估 EE', 'Evaluation EE')}
              note={say('walker.results.ee.evaluation', '目前評估區間的 ratio-of-sums', 'Ratio of sums over the current evaluation window')}
              value={formatValue(canonicalEe?.eeEvalMbitPerJ, 'Mbit/J', locale)}
            />
            <ResultRow
              testId="walker-result-evaluation-data"
              symbol={say('walker.results.ee.dataSymbol', '資料量', 'Data')}
              note={say('walker.results.ee.data', '評估區間累積傳輸資料量', 'Accumulated delivered data in the evaluation window')}
              value={formatValue(canonicalEe?.evaluationDataMbit, 'Mbit', locale)}
            />
            <ResultRow
              testId="walker-result-evaluation-energy"
              symbol={say('walker.results.ee.energySymbol', '能量', 'Energy')}
              note={say('walker.results.ee.energy', '評估區間累積消耗能量', 'Accumulated energy in the evaluation window')}
              value={formatValue(canonicalEe?.evaluationEnergyJ, 'J', locale)}
            />
          </div>
        </ResultDisclosure>
      </div>
    </div>
  );
}
