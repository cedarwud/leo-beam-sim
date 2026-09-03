import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { parseTaipeiLocalDateTime, utcToAsiaTaipei } from '../tle/timezone';
import { loadTleSnapshotSelection, loadTleWebArchiveCatalog } from './archive';
import { buildSimulationAnalysisFrame, createSimulatorTleState, simulatorTaipeiDateTimeToUtc } from './analysis';
import { SimulatorOrbitScene } from './SimulatorOrbitScene';
import { FormulaFraction, InlineFormulaFraction } from '../ui/signal-tuning/FormulaHeader';
import { SystemAngleState, SystemPowerSum } from '../ui/signal-tuning/FormulaSymbols';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  SIMULATOR_CATALOG_URLS,
  SIMULATOR_CONSTELLATIONS,
  SIMULATOR_TABS,
  SIMULATOR_TIME_ZONE,
  type SimulationAnalysisFrame,
  type SimulatorConstellation,
  type SimulatorLoadStatus,
  type SimulatorParameters,
  type SimulatorTab,
  type TleWebArchiveCatalog,
} from './types';
import './SimulatorRoute.scss';

const DEFAULT_TAIPEI_LOCAL = '2026-08-12T20:00';

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatArchiveDate(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function archiveDateInput(value: string, end = false): string {
  return `${formatArchiveDate(value)}T${end ? '23:59' : '00:00'}`;
}

function formatNumber(value: number, maximumFractionDigits = 3): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('zh-TW', { maximumFractionDigits }).format(value);
}

function formatScientific(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  return value.toExponential(digits);
}

function constellationLabel(constellation: SimulatorConstellation): string {
  return SIMULATOR_CONSTELLATIONS.find(option => option.id === constellation)?.label ?? constellation;
}

function catalogQualityNote(catalog: TleWebArchiveCatalog | null): string | null {
  if (catalog === null) return null;
  const excludedCount = catalog.excludedSnapshots?.length ?? 0;
  if (excludedCount === 0 || catalog.sourceSnapshotCount === undefined) return null;
  return `Catalog quality：${catalog.snapshotCount}/${catalog.sourceSnapshotCount} valid snapshots；${excludedCount} source snapshot${excludedCount === 1 ? '' : 's'} excluded。`;
}

function Metric({ label, value, unit, detail }: { readonly label: ReactNode; readonly value: string; readonly unit?: string; readonly detail?: string }) {
  return (
    <div className="simulator-metric">
      <span className="simulator-metric__label">{label}</span>
      <strong className="simulator-metric__value">{value}{unit && <small>{unit}</small>}</strong>
      {detail && <span className="simulator-metric__detail">{detail}</span>}
    </div>
  );
}

function ReadOnlyTable({ rows }: { readonly rows: readonly { readonly label: ReactNode; readonly value: string; readonly unit?: string; readonly note?: string }[] }) {
  return (
    <dl className="simulator-ledger">
      {rows.map((row, index) => (
        <div className="simulator-ledger__row" key={index}>
          <dt>{row.label}</dt>
          <dd>{row.value}{row.unit && <small>{row.unit}</small>}{row.note && <span>{row.note}</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, subtitle, children }: { readonly title: string; readonly subtitle?: string; readonly children: ReactNode }) {
  return (
    <section className="simulator-section">
      <div className="simulator-section__heading"><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      {children}
    </section>
  );
}

function SimulatorFormula({ title, formula, explanation }: { readonly title: string; readonly formula: ReactNode; readonly explanation: string }) {
  return (
    <div className="simulator-formula-block">
      <h3>{title}</h3>
      <div className="simulator-formula-block__formula">{formula}</div>
      <p>{explanation}</p>
    </div>
  );
}

function formatGain(value: number | null | undefined, unit: 'dB' | 'dBi'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(10 * Math.log10(Math.max(value, 1e-30))).toFixed(2)} ${unit}`;
}

function ProvenanceStrip({
  frame,
  requestedConstellation,
}: {
  readonly frame: SimulationAnalysisFrame;
  readonly requestedConstellation: SimulatorConstellation;
}) {
  const acceptedConstellation = frame.tleState.catalog.constellation;
  return (
    <div className="simulator-provenance" aria-label="Frame identity and provenance">
      <div><span>Requested constellation</span><strong>{constellationLabel(requestedConstellation)}</strong></div>
      <div><span>Accepted constellation</span><strong>{constellationLabel(acceptedConstellation)}</strong></div>
      <div><span>Frame</span><strong>{frame.frameId}</strong></div>
      <div><span>TLE frame</span><strong>{frame.tleFrameId}</strong></div>
      <div><span>衛星／TLE epoch</span><strong>{frame.selectedSatelliteId} · {frame.tleEpochUtc}</strong></div>
      <div><span>來源 catalog</span><strong>{frame.provenance.archiveCatalogUrl} · {frame.provenance.archiveDate}</strong></div>
    </div>
  );
}

function PowerPanel({ frame }: { readonly frame: SimulationAnalysisFrame }) {
  const link = frame.links[0]!;
  const fixedPowerW = (frame.power.pRfcBW[0] ?? 0) + (frame.power.pBbBW[0] ?? 0) + (frame.power.pEventBW[0] ?? 0);
  return (
    <div className="simulator-panel-grid">
      <Section title="Power" subtitle="公式在上方；數值由同一個 frame 直接呈現。">
        <SimulatorFormula
          title="系統功率公式"
          formula={(
            <>
              <div>P<sup>N</sup>(t, <SystemAngleState />) = P<sup>f</sup>(t) + <SystemPowerSum /></div>
              <div>P<sup>p</sup><sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>) = <InlineFormulaFraction numerator={<>p<sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>)</>} denominator={<>ξ<sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>)</>} label="RF power divided by effective efficiency" /></div>
              <div>p<sub>u,s,v</sub>(τ<sub>u,s,v</sub>, θ<sub>u,s,v</sub>(τ<sub>u,s,v</sub>)) = 2 W</div>
              <div>p<sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>(t)) = p<sub>u,s,v</sub>(t−1, θ<sub>u,s,v</sub>(t−1)) · <InlineFormulaFraction numerator={<>G<sup>T</sup>(θ<sub>u,s,v</sub>(t−1))</>} denominator={<>G<sup>T</sup>(θ<sub>u,s,v</sub>(t))</>} label="previous-step transmit-gain ratio" /></div>
            </>
          )}
          explanation="p 由初始鏈路功率與上一幀的發射增益比例遞推；Pᵖ 再依 ξ 換算，最後與固定功率 Pᶠ 形成 Pᴺ。"
        />
        <ReadOnlyTable rows={[
          { label: <>p<sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>)</>, value: formatScientific(link.actualPowerW), unit: ' W', note: '代表鏈路 RF 功率' },
          { label: <>P<sup>p</sup><sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>)</>, value: formatScientific(frame.power.pPaBW[0] ?? 0), unit: ' W', note: '由 p 與 ξ 換算' },
          { label: <>ξ<sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>)</>, value: formatScientific(frame.power.paEfficiencyB[0] ?? 0), note: '有效轉換效率' },
          { label: <>P<sup>f</sup>(t)</>, value: formatScientific(fixedPowerW), unit: ' W', note: '固定功率項' },
          { label: <>P<sup>N</sup>(t, <SystemAngleState />)</>, value: formatScientific(frame.power.systemPowerW), unit: ' W', note: '系統總功率' },
        ]} />
      </Section>
      <Section title="符號關係" subtitle="本頁不提供額外功率輸入。">
        <div className="simulator-explanation"><p>角度改變時，G<sup>T</sup>(θ<sub>u,s,v</sub>) 會帶動 p 的下一幀值；Pᴺ 則聚合所有 x<sub>u,s,v</sub>(t)=1 的鏈路。</p></div>
      </Section>
    </div>
  );
}

function SinrPanel({ frame }: { readonly frame: SimulationAnalysisFrame }) {
  const link = frame.links[0]!;
  const channelGain = frame.inputs.frame.propagationGainUb[link.userIndex]?.[link.beamId];
  const transmitGain = frame.canonical.transmitGainUb[link.userIndex]?.[link.beamId];
  return (
    <div className="simulator-panel-grid">
      <Section title="SINR" subtitle="公式與下方值使用同一條代表鏈路。">
        <SimulatorFormula
          title="SINR 公式"
          formula={<FormulaFraction lhs={<>γ<sub>u,s,v</sub>(t, <SystemAngleState />)</>} numerator={<>p<sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>) · H<sub>u,s,v</sub>(t) · G<sup>T</sup>(θ<sub>u,s,v</sub>)</>} denominator={<>I<sub>u,s,v</sub>(t, <SystemAngleState />) + σ²</>} numeratorAccent="#76ead7" denominatorAccent="#ffde85" />}
          explanation="分子是代表 UE 的發射功率、有效通道與發射增益；分母是總同頻干擾 I 與熱雜訊 σ²。"
        />
        <div className="simulator-metrics-grid simulator-metrics-grid--four">
          <Metric label={<>p<sub>u,s,v</sub>(t, θ<sub>u,s,v</sub>)</>} value={formatScientific(link.actualPowerW)} unit=" W" detail="RF transmit power" />
          <Metric label={<>H<sub>u,s,v</sub>(t)</>} value={formatGain(channelGain, 'dB')} detail="effective channel" />
          <Metric label={<>G<sup>T</sup>(θ<sub>u,s,v</sub>)</>} value={formatGain(transmitGain, 'dBi')} detail="transmit gain" />
          <Metric label={<>γ<sub>u,s,v</sub>(t, <SystemAngleState />)</>} value={formatNumber(link.sinrDb, 2)} unit=" dB" detail={`${formatScientific(link.sinrLinear)} linear`} />
        </div>
        <ReadOnlyTable rows={[
          { label: <>I<sub>u,s,v</sub>(t, <SystemAngleState />)</>, value: formatScientific(link.interferenceW), unit: ' W', note: '總同頻干擾' },
          { label: <>σ²</>, value: formatScientific(link.noiseW), unit: ' W', note: '熱雜訊' },
          { label: <>θ<sub>u,s,v</sub></>, value: formatNumber(link.offAxisAngleRad, 5), unit: ' rad', note: '鏈路離軸角' },
          { label: 'Taipei link distance', value: formatNumber(link.distanceKm, 1), unit: ' km' },
          { label: 'elevation', value: formatNumber(link.elevationDeg, 1), unit: '°' },
        ]} />
      </Section>
      <Section title="如何解讀" subtitle="先看分子，再看干擾與雜訊組成的分母。">
        <div className="simulator-explanation"><p>H、G<sup>T</sup>、I 與 σ² 都是同一個 TLE frame 的結果；改變時間只會重新產生下一個 frame，不會在這裡另算一套 SINR。</p></div>
      </Section>
    </div>
  );
}

function ThroughputPanel({ frame }: { readonly frame: SimulationAnalysisFrame }) {
  const link = frame.links[0]!;
  const beamLoad = frame.scenario.beamLoadB[link.beamId] ?? 0;
  return (
    <div className="simulator-panel-grid">
      <Section title="Throughput" subtitle="公式在上方；下方只顯示同一 frame 的數值。">
        <SimulatorFormula
          title="吞吐量公式"
          formula={<div>R<sub>u,s,v</sub>(t, <SystemAngleState />) = <InlineFormulaFraction numerator={<>B<sup>w</sup></>} denominator={<>U<sub>s,v</sub>(t)</>} label="beam bandwidth divided by serving users" /> log<sub>2</sub>(1 + γ<sub>u,s,v</sub>(t, <SystemAngleState />))</div>}
          explanation="單一服務鏈路的速率由波束頻寬、服務波束負載與同一條鏈路的 γ 決定。"
        />
        <div className="simulator-metrics-grid simulator-metrics-grid--three">
          <Metric label={<>R<sub>u,s,v</sub>(t, <SystemAngleState />)</>} value={formatNumber(link.rateBps, 1)} unit=" bit/s" detail="代表鏈路速率" />
          <Metric label={<>B<sup>w</sup></>} value={formatNumber(frame.scenario.derived.beamBandwidthHz, 0)} unit=" Hz" detail="單一波束頻寬" />
          <Metric label={<>U<sub>s,v</sub>(t)</>} value={formatNumber(beamLoad, 0)} unit=" UE" detail="服務波束負載" />
        </div>
        <ReadOnlyTable rows={[
          { label: <>γ<sub>u,s,v</sub>(t, <SystemAngleState />)</>, value: formatScientific(link.sinrLinear), unit: ' linear', note: '來自 SINR 分頁' },
          { label: <>R<sub>u,s,v</sub>(t, <SystemAngleState />)</>, value: formatNumber(link.rateBps, 1), unit: ' bit/s', note: '代表鏈路' },
          { label: 'Total rate', value: formatNumber(frame.throughput.totalRateBps, 1), unit: ' bit/s', note: '服務鏈路總和' },
        ]} />
      </Section>
      <Section title="符號關係" subtitle="本頁沒有獨立的目標速率輸入。">
        <div className="simulator-explanation"><p>U<sub>s,v</sub>(t) 是服務波束負載，γ 由 SINR 公式提供；兩者與 B<sup>w</sup> 一起決定 R。</p></div>
      </Section>
    </div>
  );
}

function EePanel({ frame }: { readonly frame: SimulationAnalysisFrame }) {
  const acceptedConstellation = frame.tleState.catalog.constellation;
  const link = frame.links[0]!;
  return (
    <div className="simulator-panel-grid">
      <Section title="EE" subtitle="公式在上方；下方顯示同一 frame 的 η、R 與 Pᴺ。">
        <SimulatorFormula
          title="能源效率公式"
          formula={<FormulaFraction lhs={<>η<sub>u,s,v</sub>(t, <SystemAngleState />)</>} numerator={<>R<sub>u,s,v</sub>(t, <SystemAngleState />)</>} denominator={<>P<sup>N</sup>(t, <SystemAngleState />)</>} numeratorAccent="#ffde85" denominatorAccent="#76ead7" />}
          explanation="EE 以代表鏈路速率除以同一 frame 的系統總功率；分子與分母都沿用前面分頁的結果。"
        />
        <div className="simulator-metrics-grid simulator-metrics-grid--three">
          <Metric label={<>η<sub>u,s,v</sub>(t, <SystemAngleState />)</>} value={formatNumber(frame.ee.instantaneousBitsPerJ, 1)} unit=" bit/J" detail="這一個 frame" />
          <Metric label={<>R<sub>u,s,v</sub>(t, <SystemAngleState />)</>} value={formatNumber(link.rateBps, 1)} unit=" bit/s" detail="代表鏈路速率" />
          <Metric label={<>P<sup>N</sup>(t, <SystemAngleState />)</>} value={formatScientific(frame.power.systemPowerW)} unit=" W" detail="系統總功率" />
        </div>
        <ReadOnlyTable rows={[
          { label: <>R<sub>u,s,v</sub>(t, <SystemAngleState />)</>, value: formatNumber(link.rateBps, 1), unit: ' bit/s', note: 'EE 分子' },
          { label: <>P<sup>N</sup>(t, <SystemAngleState />)</>, value: formatScientific(frame.power.systemPowerW), unit: ' W', note: 'EE 分母' },
          { label: <>η<sub>u,s,v</sub>(t, <SystemAngleState />)</>, value: formatNumber(frame.ee.instantaneousBitsPerJ, 1), unit: ' bit/J', note: 'R / Pᴺ' },
        ]} />
      </Section>
      <Section title="能效邊界與來源" subtitle="保持物理量與證據邊界清楚。">
        <div className="simulator-explanation"><p><strong>來源：</strong>{frame.provenance.archiveCatalogUrl} → {frame.provenance.selectedTlePath}</p><p><strong>星座：</strong>{constellationLabel(acceptedConstellation)}；<strong>模型：</strong>{frame.provenance.propagationModel}，TLE epoch {frame.tleEpochUtc}。</p><p>時間切換會重新選取 TLE frame；η、R 與 Pᴺ 都來自該 frame，不在右側重新建立另一套公式。</p></div>
      </Section>
    </div>
  );
}

function TabPanel({ activeTab, frame }: {
  readonly activeTab: SimulatorTab;
  readonly frame: SimulationAnalysisFrame;
}) {
  if (activeTab === 'power') return <PowerPanel frame={frame} />;
  if (activeTab === 'throughput') return <ThroughputPanel frame={frame} />;
  if (activeTab === 'ee') return <EePanel frame={frame} />;
  return <SinrPanel frame={frame} />;
}

function EmptyState({ status, message }: { readonly status: SimulatorLoadStatus; readonly message?: string }) {
  if (status === 'loading') return <div className="simulator-state simulator-state--loading" role="status"><div className="simulator-spinner" /><h2>正在載入 archived TLE</h2><p>先驗證 catalog、SHA-256 與 3LE records，再解析 SGP4 frame。</p></div>;
  return <div className="simulator-state simulator-state--error" role="alert"><h2>目前沒有可接受的 simulation frame</h2><p>{message ?? '資料來源或解析結果未通過 fail-closed 驗證。'}</p><p>請確認 browser archive 與 catalog 完整，再重新選擇時間。</p></div>;
}

export interface SimulatorRouteProps {
  readonly initialConstellation?: SimulatorConstellation;
  readonly initialTaipeiDateTime?: string;
}

/** Archived-TLE / canonical-EE route. The controller can mount this component under any URL. */
export function SimulatorRoute({
  initialConstellation = 'starlink',
  initialTaipeiDateTime = DEFAULT_TAIPEI_LOCAL,
}: SimulatorRouteProps) {
  const [requestedConstellation, setRequestedConstellation] = useState<SimulatorConstellation>(initialConstellation);
  const [catalog, setCatalog] = useState<TleWebArchiveCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [taipeiDateTime, setTaipeiDateTime] = useState(initialTaipeiDateTime);
  const [tleState, setTleState] = useState<ReturnType<typeof createSimulatorTleState> | null>(null);
  const [fallbackFrame, setFallbackFrame] = useState<SimulationAnalysisFrame | null>(null);
  const [status, setStatus] = useState<SimulatorLoadStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SimulatorTab>('sinr');
  const [parameters, setParameters] = useState<SimulatorParameters>({ ...DEFAULT_SIMULATOR_PARAMETERS });
  const lastAcceptedFrame = useRef<SimulationAnalysisFrame | null>(null);
  const requestId = useRef(0);
  const requestedCatalogUrl = SIMULATOR_CATALOG_URLS[requestedConstellation];

  useEffect(() => {
    let cancelled = false;
    requestId.current += 1;
    setCatalogError(null);
    setLoadError(null);
    setStatus('loading');
    setCatalog(null);
    setTleState(null);
    setFallbackFrame(lastAcceptedFrame.current);
    void (async () => {
      try {
        if (typeof requestedCatalogUrl !== 'string' || requestedCatalogUrl.trim() === '') {
          throw new Error(`沒有 ${constellationLabel(requestedConstellation)} 的 archived catalog URL`);
        }
        const nextCatalog = await loadTleWebArchiveCatalog(requestedCatalogUrl);
        if (nextCatalog.constellation !== requestedConstellation) {
          throw new Error(`catalog constellation mismatch：requested ${constellationLabel(requestedConstellation)}，received ${constellationLabel(nextCatalog.constellation)}`);
        }
        if (!cancelled) setCatalog(nextCatalog);
      } catch (error) {
        if (!cancelled) {
          setCatalog(null);
          setCatalogError(readableError(error));
          setFallbackFrame(lastAcceptedFrame.current);
          setStatus('error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [requestedCatalogUrl, requestedConstellation]);

  useEffect(() => {
    if (catalog === null) return;
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    let cancelled = false;
    setStatus('loading');
    setLoadError(null);
    setFallbackFrame(lastAcceptedFrame.current);
    void (async () => {
      try {
        const utc = simulatorTaipeiDateTimeToUtc(taipeiDateTime);
        const selection = await loadTleSnapshotSelection(catalog, utc);
        const nextState = createSimulatorTleState(selection, utc);
        if (cancelled || currentRequest !== requestId.current) return;
        setTleState(nextState);
        setStatus('ready');
      } catch (error) {
        if (cancelled || currentRequest !== requestId.current) return;
        setTleState(null);
        setFallbackFrame(lastAcceptedFrame.current);
        setLoadError(readableError(error));
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [catalog, taipeiDateTime]);

  const computed = useMemo((): { readonly frame: SimulationAnalysisFrame | null; readonly error: string | null } => {
    if (tleState === null) return { frame: null, error: null };
    try {
      return { frame: buildSimulationAnalysisFrame(tleState, parameters), error: null };
    } catch (error) {
      return { frame: null, error: readableError(error) };
    }
  }, [parameters, tleState]);

  useEffect(() => {
    if (computed.frame !== null && status === 'ready') lastAcceptedFrame.current = computed.frame;
  }, [computed.frame, status]);

  const frame = computed.frame ?? fallbackFrame;
  const error = catalogError ?? loadError ?? computed.error;

  const changeTime = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setTaipeiDateTime(event.currentTarget.value);
    try {
      parseTaipeiLocalDateTime(event.currentTarget.value);
    } catch (parseError) {
      setLoadError(readableError(parseError));
    }
  }, []);

  const resetTime = useCallback(() => {
    if (catalog !== null) setTaipeiDateTime(`${formatArchiveDate(catalog.lastArchiveDate)}T20:00`);
  }, [catalog]);

  const changeConstellation = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextConstellation = event.currentTarget.value;
    if (!SIMULATOR_CONSTELLATIONS.some(option => option.id === nextConstellation)) return;
    setRequestedConstellation(nextConstellation as SimulatorConstellation);
  }, []);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = SIMULATOR_TABS.findIndex(tab => tab.id === activeTab);
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const movingForward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? SIMULATOR_TABS.length - 1
        : (index + (movingForward ? 1 : -1) + SIMULATOR_TABS.length) % SIMULATOR_TABS.length;
    const nextTab = SIMULATOR_TABS[nextIndex]!;
    setActiveTab(nextTab.id);
    document.getElementById(`simulator-tab-${nextTab.id}`)?.focus();
  };

  const qualityNote = catalogQualityNote(catalog);

  return (
    <main className="simulator-route" lang="zh-Hant">
      <header className="simulator-header">
        <div>
          <p className="simulator-eyebrow">LEO BEAM SIMULATOR · FORMAL ANALYSIS ROUTE</p>
          <h1>Archived TLE × canonical EE</h1>
          <p className="simulator-lede">選擇 constellation 與 Asia/Taipei 時間，驗證 archived TLE 後以 SGP4 產生一個 immutable frame；SINR、EE、Power、Throughput 都從同一份結果解讀。</p>
        </div>
        <div className="simulator-contract-badge"><span>contract</span><strong>family-B · v1</strong><small>{SIMULATOR_TIME_ZONE}</small></div>
      </header>

      <section className="simulator-constellation-bar" aria-label="Constellation selector">
        <div className="simulator-constellation-bar__heading">
          <p className="simulator-eyebrow">ARCHIVED TLE SOURCE</p>
          <h2>選擇衛星星座</h2>
          <p>切換後會重新驗證對應 catalog；若新資料未通過驗證，畫面只保留上一個 accepted frame。</p>
        </div>
        <fieldset className="simulator-constellation-selector">
          <legend>Constellation</legend>
          <div className="simulator-constellation-selector__options">
            {SIMULATOR_CONSTELLATIONS.map(option => (
              <label key={option.id} className={`simulator-constellation-option${requestedConstellation === option.id ? ' is-selected' : ''}`} htmlFor={`simulator-constellation-${option.id}`}>
                <input id={`simulator-constellation-${option.id}`} type="radio" name="simulator-constellation" value={option.id} checked={requestedConstellation === option.id} onChange={changeConstellation} />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.id === 'oneweb' ? 'LEO archive · oneweb' : 'LEO archive · starlink'}</small>
                </span>
              </label>
            ))}
          </div>
          <p className="simulator-constellation-selector__status" role="status" aria-live="polite">
            Requested：<strong>{constellationLabel(requestedConstellation)}</strong>
            {' · '}
            Accepted frame：<strong>{frame === null ? '尚未接受' : constellationLabel(frame.tleState.catalog.constellation)}</strong>
          </p>
          {qualityNote !== null && <p className="simulator-constellation-selector__quality">{qualityNote}</p>}
        </fieldset>
      </section>

      <section className="simulator-timebar" aria-label="Archived TLE time selector">
        <div className="simulator-timebar__input"><label htmlFor="simulator-time">時間（{SIMULATOR_TIME_ZONE}）</label><input id="simulator-time" type="datetime-local" value={taipeiDateTime} min={catalog ? archiveDateInput(catalog.firstArchiveDate) : undefined} max={catalog ? archiveDateInput(catalog.lastArchiveDate, true) : undefined} step={60} onChange={changeTime} /><span>內部會轉成明確 UTC，再解析不晚於該 instant 的最新 TLE epoch。</span></div>
        <div className="simulator-timebar__conversion"><span>UTC conversion</span><strong>{(() => { try { return simulatorTaipeiDateTimeToUtc(taipeiDateTime); } catch { return '等待有效時間'; } })()}</strong><button className="simulator-secondary-button" type="button" onClick={resetTime} disabled={catalog === null}>回到 archive latest</button></div>
      </section>

      {frame !== null && <ProvenanceStrip frame={frame} requestedConstellation={requestedConstellation} />}
      {(status === 'error' || computed.error !== null) && <div className="simulator-alert" role="alert"><strong>這次更新未被接受，畫面保留上一個 accepted frame。</strong><span>{error}</span></div>}

      {frame === null ? <EmptyState status={status} message={error ?? undefined} /> : (
        <section className="simulator-workspace" aria-label="Simulation workspace">
          <aside className="simulator-analysis-rail" aria-label="Canonical analysis projections">
            <div className="simulator-analysis-rail__heading">
              <p className="simulator-eyebrow">FRAME ANALYSIS</p>
              <h2>分析工作區</h2>
              <p>四個 projections 讀取同一個 accepted frame。</p>
            </div>
            <div className="simulator-tablist" role="tablist" aria-orientation="vertical" aria-label="Canonical analysis views">
              {SIMULATOR_TABS.map(tab => (
                <button key={tab.id} id={`simulator-tab-${tab.id}`} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`simulator-panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1} className={activeTab === tab.id ? 'is-active' : ''} onClick={() => setActiveTab(tab.id)} onKeyDown={handleTabKeyDown}>
                  <strong>{tab.label}</strong><span>{tab.shortLabel}</span>
                </button>
              ))}
            </div>
            <p className="simulator-analysis-rail__status" role="status" aria-live="polite">Active view：<strong>{SIMULATOR_TABS.find(tab => tab.id === activeTab)?.label}</strong></p>
          </aside>

          <div className="simulator-workspace__main">
            <section className="simulator-scene-card">
              <div className="simulator-scene-card__heading"><div><h2>SGP4 orbit / trajectory</h2><p>Requested：<strong>{constellationLabel(requestedConstellation)}</strong> · accepted：<strong>{constellationLabel(frame.tleState.catalog.constellation)}</strong>；目前選中的 serving candidate：{frame.selectedSatelliteId}；場景與 SINR、EE、Power、Throughput tabs 共用 frame <code>{frame.frameId}</code>。</p></div><span className="simulator-source-badge">ARCHIVED_TLE · {constellationLabel(frame.tleState.catalog.constellation)} · SGP4</span></div>
              <SimulatorOrbitScene frame={frame} />
            </section>
            <section className="simulator-analysis-card" aria-label="Active canonical analysis projection">
              <div id={`simulator-panel-${activeTab}`} className="simulator-tabpanel" role="tabpanel" aria-labelledby={`simulator-tab-${activeTab}`} tabIndex={0}>
                <TabPanel activeTab={activeTab} frame={frame} />
              </div>
            </section>
          </div>
        </section>
      )}

      <footer className="simulator-footer"><span>Source: read-only browser archive</span><span>Time switching is snapshot selection, not handover.</span><span>Normalized geometry adapter is not a calibrated RF link budget.</span></footer>
    </main>
  );
}

export default SimulatorRoute;
