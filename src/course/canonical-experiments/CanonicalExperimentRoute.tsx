import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';

import { SixActsNav } from '../nav/SixActsNav';
import {
  SIX_ACTS_ACT5_HREF,
  SIX_ACTS_ACT6_HREF,
  nextSixActsRoute,
} from '../nav/sixActsRoutes';
import { useHomepageCanonicalAnalysis } from '../../ui/signal-tuning/useHomepageCanonicalAnalysis';
import {
  buildSimulationAnalysisFrame,
  type SimulationAnalysisFrameBuildOptions,
} from '../../simulator/analysis';
import type { SimulationAnalysisFrame, SimulatorParameters } from '../../simulator/types';
import {
  acceptCanonicalExperimentObservation,
  canonicalExperimentComplete,
  canonicalExperimentObservation,
  type CanonicalExperimentKind,
  type CanonicalExperimentObservation,
} from './canonicalExperimentModel';
import { CanonicalExperimentScene } from './CanonicalExperimentScene';
import './CanonicalExperimentRoute.scss';

type ExperimentPhase = 'prediction' | 'run' | 'evidence' | 'transfer' | 'complete';

interface ExperimentDefinition {
  readonly kind: CanonicalExperimentKind;
  readonly act: 5 | 6;
  readonly currentHref: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly question: string;
  readonly scope: string;
  readonly conditions: readonly number[];
  readonly conditionLabel: (condition: number) => string;
  readonly predictionOptions: readonly { readonly id: string; readonly label: string }[];
  readonly transferQuestion: string;
  readonly transferOptions: readonly { readonly id: string; readonly label: string; readonly correct: boolean }[];
  readonly initialFrameOptions: SimulationAnalysisFrameBuildOptions;
  readonly initialDisplayCondition: number;
}

const BEAM_LAYOUT_DEFINITION: ExperimentDefinition = Object.freeze({
  kind: 'beam-layout',
  act: 5,
  currentHref: SIX_ACTS_ACT5_HREF,
  eyebrow: '第五幕 · 多波束空間涵蓋',
  title: '多波束空間涵蓋實驗',
  question: '同一衛星與 100 個固定 UE 下，1 與 19 波束的服務結果有何不同？',
  scope: '只比較 1 與 19 波束完整配置；兩次計算使用同一衛星、同一組 UE 位置與相同射頻參數。',
  conditions: Object.freeze([1, 19]),
  conditionLabel: (condition: number) => `${condition} 波束配置`,
  predictionOptions: Object.freeze([
    Object.freeze({ id: 'increase', label: '可服務 UE 數顯著增加' }),
    Object.freeze({ id: 'similar', label: '可服務 UE 數大致不變' }),
    Object.freeze({ id: 'decrease', label: '可服務 UE 數顯著下降' }),
  ]),
  transferQuestion: '若兩次試驗使用不同的 UE 位置，能否把結果差異歸因於波束配置？',
  transferOptions: Object.freeze([
    Object.freeze({ id: 'no', label: '不能；控制變因已被破壞', correct: true }),
    Object.freeze({ id: 'yes', label: '可以；只要 UE 總數相同', correct: false }),
  ]),
  initialFrameOptions: Object.freeze({ beamLayoutCount: 1 }),
  initialDisplayCondition: 1,
});

const FREQUENCY_REUSE_DEFINITION: ExperimentDefinition = Object.freeze({
  kind: 'frequency-reuse',
  act: 6,
  currentHref: SIX_ACTS_ACT6_HREF,
  eyebrow: '第六幕 · 頻率重用取捨',
  title: '頻率重用取捨實驗',
  question: '降低同頻干擾，是否必然提高系統總吞吐量？',
  scope: '固定 19 波束配置、同一衛星、同一組 100 個 UE 位置與其餘射頻參數，只調整頻率重用因子 K_FR。',
  conditions: Object.freeze([1, 3, 7]),
  conditionLabel: (condition: number) => `重用因子 K_FR = ${condition}`,
  predictionOptions: Object.freeze([
    Object.freeze({ id: 'increase', label: 'SINR 與總吞吐量都會提高' }),
    Object.freeze({ id: 'tradeoff', label: '未必；還要檢查每波束頻寬' }),
    Object.freeze({ id: 'unrelated', label: '頻率重用因子與吞吐量無關' }),
  ]),
  transferQuestion: '只看到 SINR 上升，是否足以判定系統總吞吐量也會上升？',
  transferOptions: Object.freeze([
    Object.freeze({ id: 'insufficient', label: '不足；仍須讀取每波束頻寬 B_beam 與系統總吞吐量 ΣR', correct: true }),
    Object.freeze({ id: 'sufficient', label: '足夠；SINR 上升即可判定', correct: false }),
  ]),
  initialFrameOptions: Object.freeze({ beamLayoutCount: 19 }),
  initialDisplayCondition: 3,
});

function formatRate(value: number): string {
  return `${value.toFixed(2)} Mbit/s`;
}

function formatPower(value: number): string {
  return `${value.toFixed(3)} W`;
}

function formatEe(value: number): string {
  return `${value.toFixed(2)} Mbit/J`;
}

function conditionMatches(
  observation: CanonicalExperimentObservation,
  kind: CanonicalExperimentKind,
  condition: number,
): boolean {
  return observation.kind === kind && observation.condition === condition;
}

function observationConclusion(
  definition: ExperimentDefinition,
  observations: readonly CanonicalExperimentObservation[],
): string {
  if (!canonicalExperimentComplete(observations, definition.conditions)) return '';
  if (definition.kind === 'beam-layout') {
    const strongest = [...observations].sort((left, right) => right.servedUeCount - left.servedUeCount)[0]!;
    return `在這組固定條件中，${definition.conditionLabel(strongest.condition)}服務 ${strongest.servedUeCount}/${strongest.totalUeCount} UE；這是該組條件的結果，不代表一般情況下的最適配置。`;
  }
  const low = observations.find(observation => observation.condition === 1)!;
  const high = observations.find(observation => observation.condition === 7)!;
  if (high.representativeSinrDb > low.representativeSinrDb && high.totalRateMbps < low.totalRateMbps) {
    return '代表鏈路 SINR 上升，但系統總吞吐量下降；同頻干擾減少時，仍須同時考慮每波束頻寬。';
  }
  return 'SINR 與系統總吞吐量並未呈現可直接互推的單調關係；結論必須同時讀取干擾、每波束頻寬與系統總吞吐量。';
}

function EvidenceRows({
  definition,
  observations,
}: {
  readonly definition: ExperimentDefinition;
  readonly observations: readonly CanonicalExperimentObservation[];
}): ReactElement {
  const rows = definition.kind === 'beam-layout'
    ? [
      { label: '可服務 UE', value: (observation: CanonicalExperimentObservation) => `${observation.servedUeCount}/${observation.totalUeCount}` },
      { label: '配置／啟動波束', value: (observation: CanonicalExperimentObservation) => `${observation.configuredBeamCount}/${observation.activeBeamCount}` },
      { label: '系統總吞吐量（ΣR）', value: (observation: CanonicalExperimentObservation) => formatRate(observation.totalRateMbps) },
      { label: '系統功率（Psys）', value: (observation: CanonicalExperimentObservation) => formatPower(observation.systemPowerW) },
      { label: '瞬時能源效率（η）', value: (observation: CanonicalExperimentObservation) => formatEe(observation.instantaneousEeMbitPerJ) },
    ]
    : [
      { label: '代表鏈路 SINR', value: (observation: CanonicalExperimentObservation) => `${observation.representativeSinrDb.toFixed(2)} dB` },
      { label: '每波束頻寬（Bbeam）', value: (observation: CanonicalExperimentObservation) => `${observation.beamBandwidthMHz.toFixed(2)} MHz` },
      { label: '代表鏈路干擾', value: (observation: CanonicalExperimentObservation) => `${observation.representativeInterferenceW.toExponential(2)} W` },
      { label: '系統總吞吐量（ΣR）', value: (observation: CanonicalExperimentObservation) => formatRate(observation.totalRateMbps) },
    ];
  return (
    <div className="canonical-experiment__comparison" data-testid="canonical-experiment-comparison">
      <table>
        <thead>
          <tr>
            <th scope="col">觀察量</th>
            {definition.conditions.map(condition => {
              const observation = observations.find(candidate => conditionMatches(candidate, definition.kind, condition));
              return (
                <th
                  key={condition}
                  scope="col"
                  data-condition={condition}
                  data-observed={observation === undefined ? 'false' : 'true'}
                >
                  <strong>{definition.conditionLabel(condition)}</strong>
                  <span>{observation === undefined ? '尚未執行' : '結果已核對'}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {definition.conditions.map(condition => {
                const observation = observations.find(candidate => conditionMatches(candidate, definition.kind, condition));
                return <td key={condition}>{observation === undefined ? '—' : row.value(observation)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="canonical-experiment__comparison-mobile" aria-label="實驗條件比較">
        {definition.conditions.map(condition => {
          const observation = observations.find(candidate => conditionMatches(candidate, definition.kind, condition));
          return (
            <section key={condition} data-observed={observation === undefined ? 'false' : 'true'}>
              <header>
                <strong>{definition.conditionLabel(condition)}</strong>
                <span>{observation === undefined ? '尚未執行' : '結果已核對'}</span>
              </header>
              <dl>
                {rows.map(row => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{observation === undefined ? '—' : row.value(observation)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function liveMetricRows(
  definition: ExperimentDefinition,
  observation: CanonicalExperimentObservation | null,
): readonly { readonly label: string; readonly value: string }[] {
  if (observation === null) return Object.freeze([]);
  if (definition.kind === 'beam-layout') {
    return Object.freeze([
      Object.freeze({ label: '波束配置／啟動', value: `${observation.configuredBeamCount} / ${observation.activeBeamCount}` }),
      Object.freeze({ label: '可服務 UE', value: `${observation.servedUeCount} / ${observation.totalUeCount}` }),
      Object.freeze({ label: '系統總吞吐量', value: formatRate(observation.totalRateMbps) }),
      Object.freeze({ label: '系統總功率', value: formatPower(observation.systemPowerW) }),
      Object.freeze({ label: '瞬時能源效率', value: formatEe(observation.instantaneousEeMbitPerJ) }),
    ]);
  }
  return Object.freeze([
    Object.freeze({ label: '頻率重用因子（K_FR）', value: String(observation.frequencyReuse) }),
    Object.freeze({ label: '代表鏈路 SINR', value: `${observation.representativeSinrDb.toFixed(2)} dB` }),
    Object.freeze({ label: '每波束頻寬', value: `${observation.beamBandwidthMHz.toFixed(2)} MHz` }),
    Object.freeze({ label: '代表鏈路干擾', value: `${observation.representativeInterferenceW.toExponential(2)} W` }),
    Object.freeze({ label: '系統總吞吐量', value: formatRate(observation.totalRateMbps) }),
  ]);
}

function CanonicalExperimentRoute({ definition }: { readonly definition: ExperimentDefinition }): ReactElement {
  const analysis = useHomepageCanonicalAnalysis({ initialFrameOptions: definition.initialFrameOptions });
  const [phase, setPhase] = useState<ExperimentPhase>('prediction');
  const [prediction, setPrediction] = useState<string | null>(null);
  const [pendingCondition, setPendingCondition] = useState<number | null>(null);
  const [observations, setObservations] = useState<readonly CanonicalExperimentObservation[]>([]);
  const [selectedCondition, setSelectedCondition] = useState<number>(definition.conditions[0]!);
  const [invariantError, setInvariantError] = useState<string | null>(null);
  const [transferAnswer, setTransferAnswer] = useState<string | null>(null);
  const lockedParametersRef = useRef<SimulatorParameters | null>(null);
  const lockedFrameOptionsRef = useRef<Readonly<SimulationAnalysisFrameBuildOptions> | null>(null);
  const baseFrameRef = useRef<SimulationAnalysisFrame | null>(null);
  const observationsRef = useRef<readonly CanonicalExperimentObservation[]>([]);
  const [displayFrame, setDisplayFrame] = useState<SimulationAnalysisFrame | null>(null);

  const buildConditionFrame = useCallback((condition: number): SimulationAnalysisFrame => {
    const baseFrame = baseFrameRef.current;
    const lockedParameters = lockedParametersRef.current;
    if (baseFrame === null || lockedParameters === null) {
      throw new Error('正式計算影格尚未完成載入');
    }
    const lockedOptions = lockedFrameOptionsRef.current ?? definition.initialFrameOptions;
    const parameters = definition.kind === 'frequency-reuse'
      ? { ...lockedParameters, frequencyReuse: condition }
      : lockedParameters;
    const frameOptions: SimulationAnalysisFrameBuildOptions = definition.kind === 'beam-layout'
      ? {
        ...lockedOptions,
        beamLayoutCount: condition as 1 | 19,
        perSatelliteBeamLayoutCount: {},
      }
      : {
        ...lockedOptions,
        beamLayoutCount: 19,
        perSatelliteBeamLayoutCount: {},
      };
    return buildSimulationAnalysisFrame(baseFrame.tleState, parameters, undefined, frameOptions);
  }, [definition.initialFrameOptions, definition.kind]);

  useEffect(() => {
    if (baseFrameRef.current !== null || analysis.frame === null) return;
    baseFrameRef.current = analysis.frame;
    lockedParametersRef.current = analysis.frame.parameters;
    lockedFrameOptionsRef.current = analysis.frameOptions;
    try {
      setDisplayFrame(buildConditionFrame(definition.initialDisplayCondition));
    } catch (error) {
      setInvariantError(error instanceof Error ? error.message : String(error));
    }
  }, [analysis.frame, analysis.frameOptions, buildConditionFrame, definition.initialDisplayCondition]);

  const executeCondition = useCallback((condition: number) => {
    setInvariantError(null);
    setSelectedCondition(condition);
    setPendingCondition(condition);
    globalThis.setTimeout(() => {
      try {
        const nextFrame = buildConditionFrame(condition);
        const observation = canonicalExperimentObservation(nextFrame, definition.kind);
        const accepted = acceptCanonicalExperimentObservation(
          observationsRef.current,
          observation,
          condition,
        );
        observationsRef.current = accepted;
        setDisplayFrame(nextFrame);
        setObservations(accepted);
        if (canonicalExperimentComplete(accepted, definition.conditions)) setPhase('evidence');
      } catch (error) {
        setInvariantError(error instanceof Error ? error.message : String(error));
      } finally {
        setPendingCondition(null);
      }
    }, 0);
  }, [buildConditionFrame, definition.conditions, definition.kind]);

  const requestCondition = useCallback((condition: number) => {
    if (prediction === null) return;
    executeCondition(condition);
  }, [executeCondition, prediction]);

  const handlePrediction = (answer: string) => {
    setPrediction(answer);
    setPhase('run');
    executeCondition(definition.conditions[0]!);
  };

  const resetExperiment = () => {
    setPhase('prediction');
    setPrediction(null);
    setPendingCondition(null);
    setObservations([]);
    observationsRef.current = [];
    setSelectedCondition(definition.conditions[0]!);
    setInvariantError(null);
    setTransferAnswer(null);
    try {
      setDisplayFrame(buildConditionFrame(definition.initialDisplayCondition));
    } catch (error) {
      setInvariantError(error instanceof Error ? error.message : String(error));
    }
  };

  const currentObservation = useMemo(() => {
    if (displayFrame === null || prediction === null) return null;
    try {
      return canonicalExperimentObservation(displayFrame, definition.kind);
    } catch {
      return null;
    }
  }, [definition.kind, displayFrame, prediction]);
  const metrics = liveMetricRows(definition, currentObservation);
  const completed = phase === 'complete';
  const next = nextSixActsRoute(definition.currentHref);
  const conclusion = observationConclusion(definition, observations);
  const receipt = observations[0]?.receipt ?? currentObservation?.receipt ?? null;

  const phaseLabel = phase === 'prediction'
    ? '01 · 觀察與預測'
    : phase === 'run'
      ? pendingCondition === null ? '02 · 切換控制量' : '02 · 正在計算'
      : phase === 'evidence'
        ? '03 · 比較結果'
        : phase === 'transfer'
          ? '04 · 結論檢核'
          : '05 · 完成';

  return (
    <main
      className={`canonical-experiment is-${definition.kind} is-phase-${phase}`}
      lang="zh-Hant"
      data-testid="canonical-experiment-route"
      data-act={definition.act}
      data-experiment-kind={definition.kind}
      data-phase={phase}
      data-prediction={prediction ?? 'none'}
      data-pending-condition={pendingCondition ?? ''}
      data-selected-condition={selectedCondition}
      data-observation-count={observations.length}
      data-required-observation-count={definition.conditions.length}
      data-invariant-status={invariantError === null ? 'valid' : 'rejected'}
      data-transfer-answer={transferAnswer ?? 'none'}
      data-complete={completed ? 'true' : 'false'}
      data-frame-id={displayFrame?.frameId ?? ''}
      data-tle-frame-id={displayFrame?.tleFrameId ?? ''}
    >
      <SixActsNav currentHref={definition.currentHref} variant="stage" />

      <header className="canonical-experiment__titlebar">
        <span>{definition.eyebrow}</span>
        <h1>{definition.question}</h1>
        <p>{definition.scope}</p>
      </header>

      <section className="canonical-experiment__layout">
        <aside className="canonical-experiment__control-rail" data-testid="canonical-experiment-controls">
          <div className="canonical-experiment__rail-heading">
            <span>{phaseLabel}</span>
            <h2>{definition.title}</h2>
          </div>

          {phase === 'prediction' ? (
            <section className="canonical-experiment__gate" data-testid="canonical-experiment-prediction-gate">
              <h3>先作預測</h3>
              <p>{definition.kind === 'beam-layout'
                ? '把配置從 1 波束改為 19 波束後，可服務 UE 數會如何變化？'
                : '把頻率重用因子 K_FR 從 1 提高到 7 後，系統總吞吐量會如何變化？'}</p>
              <div role="group" aria-label="預測答案">
                {definition.predictionOptions.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    data-testid={`canonical-experiment-prediction-${option.id}`}
                    disabled={displayFrame === null}
                    onClick={() => handlePrediction(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="canonical-experiment__conditions">
              <h3>唯一可調參數</h3>
              <div role="group" aria-label="實驗條件">
                {definition.conditions.map(condition => {
                  const observed = observations.some(candidate => candidate.condition === condition);
                  return (
                    <button
                      key={condition}
                      type="button"
                      className={selectedCondition === condition ? 'is-selected' : ''}
                      data-testid={`canonical-experiment-condition-${condition}`}
                      data-observed={observed ? 'true' : 'false'}
                      disabled={pendingCondition !== null || phase === 'transfer' || completed}
                      onClick={() => requestCondition(condition)}
                    >
                      <span>{definition.conditionLabel(condition)}</span>
                      <small>{observed ? '✓ 已取得結果' : '執行'}</small>
                    </button>
                  );
                })}
              </div>
              {pendingCondition === null ? null : (
                <p className="canonical-experiment__pending" role="status">
                  正在以相同 TLE 幾何與其餘參數計算 {definition.conditionLabel(pendingCondition)}…
                </p>
              )}
            </section>
          )}

          {phase === 'evidence' ? (
            <button
              className="canonical-experiment__transfer-start"
              type="button"
              data-testid="canonical-experiment-transfer-start"
              onClick={() => setPhase('transfer')}
            >
              檢驗結論
            </button>
          ) : null}

          {phase === 'transfer' ? (
            <section className="canonical-experiment__gate" data-testid="canonical-experiment-transfer-gate">
              <h3>結論檢核</h3>
              <p>{definition.transferQuestion}</p>
              <div role="group" aria-label="結論檢核答案">
                {definition.transferOptions.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    className={transferAnswer === option.id ? 'is-selected' : ''}
                    data-testid={`canonical-experiment-transfer-${option.id}`}
                    onClick={() => {
                      setTransferAnswer(option.id);
                      if (option.correct) setPhase('complete');
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {transferAnswer !== null && !definition.transferOptions.find(option => option.id === transferAnswer)?.correct ? (
                <p className="canonical-experiment__answer-error" role="alert">這項結論缺少控制變因或完整結果，請重新判讀。</p>
              ) : null}
            </section>
          ) : null}

          <div className="canonical-experiment__lock-list" data-testid="canonical-experiment-invariants">
            <h3>固定條件</h3>
            <span>✓ 封存 TLE 與 UTC 時刻</span>
            <span>✓ 服務衛星與 100 UE 位置</span>
            <span>✓ 其餘射頻與功率參數</span>
            <span>✓ 每個 UE 服務門檻：{((lockedParametersRef.current ?? analysis.parameters).minimumRateBps / 1_000_000).toFixed(2)} Mbit/s</span>
            <span>✓ 同一分析模型與計算邊界</span>
          </div>

          {definition.kind === 'frequency-reuse' ? (
            <div className="canonical-experiment__formula" aria-label="每波束頻寬計算式">
              <span>頻寬分配</span>
              <strong>B<sub>beam</sub> = B<sub>sys</sub> / K<sub>FR</sub></strong>
              <p>K<sub>FR</sub> 增加可降低同頻干擾，但每個波束分得的頻寬也會縮小。</p>
            </div>
          ) : null}
        </aside>

        <section className="canonical-experiment__stage" aria-label="實驗中央場景" data-testid="canonical-experiment-stage">
          <CanonicalExperimentScene
            frame={displayFrame}
            kind={definition.kind}
            revealResults={prediction !== null}
          />
          <div className="canonical-experiment__scene-key" aria-hidden="true">
            <span><i className="is-served" />達到服務目標</span>
            <span><i className="is-unserved" />未達服務目標</span>
            <span><i className="is-ring" />圓形波束範圍</span>
          </div>
          {analysis.error === null ? null : <p className="canonical-experiment__fatal" role="alert">{analysis.error}</p>}
          {invariantError === null ? null : <p className="canonical-experiment__fatal" role="alert">比較已拒絕：{invariantError}</p>}
        </section>

        <aside className="canonical-experiment__result-rail" data-testid="canonical-experiment-results">
          <div className="canonical-experiment__rail-heading">
            <span>即時計算結果</span>
            <h2>同一組固定條件</h2>
          </div>
          {metrics.length === 0 ? (
            <p className="canonical-experiment__results-locked">提交預測後才顯示數值，避免答案先於觀察。</p>
          ) : (
            <dl className="canonical-experiment__live-metrics">
              {metrics.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}
            </dl>
          )}

          <EvidenceRows definition={definition} observations={observations} />

          {conclusion === '' ? null : (
            <p className="canonical-experiment__conclusion" data-testid="canonical-experiment-conclusion">{conclusion}</p>
          )}

          <div className="canonical-experiment__receipt" data-testid="canonical-experiment-receipt">
            <span>封存 TLE + SGP4 · 非即時網路量測</span>
            <dl>
              <div><dt>UTC</dt><dd>{receipt?.instantUtc ?? '尚未執行'}</dd></div>
              <div><dt>衛星</dt><dd>{receipt?.selectedSatelliteId ?? '—'}</dd></div>
              <div><dt>UE 配置</dt><dd>{receipt?.ueSubstrateId ?? '—'}</dd></div>
              <div><dt>計算影格</dt><dd>{receipt?.frameId.slice(0, 18) ?? '—'}</dd></div>
            </dl>
          </div>
        </aside>
      </section>

      {completed ? (
        <footer className="canonical-experiment__finale" data-testid="canonical-experiment-finale">
          <strong>結論檢核通過</strong>
          <span>結論僅適用於畫面所列的計算影格與固定條件。</span>
          <button type="button" data-testid="canonical-experiment-replay" onClick={resetExperiment}>重新播放</button>
          {next === null
            ? <a href="/" data-testid="canonical-experiment-next">回首頁</a>
            : <a href={next.href} data-testid="canonical-experiment-next">下一幕：{next.titleZhHant}</a>}
        </footer>
      ) : null}
    </main>
  );
}

export function BeamLayoutExperimentRoute(): ReactElement {
  return <CanonicalExperimentRoute definition={BEAM_LAYOUT_DEFINITION} />;
}

export function FrequencyReuseExperimentRoute(): ReactElement {
  return <CanonicalExperimentRoute definition={FREQUENCY_REUSE_DEFINITION} />;
}
