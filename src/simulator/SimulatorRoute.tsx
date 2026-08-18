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

function updateNumber(
  event: ChangeEvent<HTMLInputElement>,
  key: keyof SimulatorParameters,
  setParameters: React.Dispatch<React.SetStateAction<SimulatorParameters>>,
): void {
  const value = Number(event.currentTarget.value);
  if (!Number.isNaN(value)) setParameters(previous => ({ ...previous, [key]: value }));
}

function Metric({ label, value, unit, detail }: { readonly label: string; readonly value: string; readonly unit?: string; readonly detail?: string }) {
  return (
    <div className="simulator-metric">
      <span className="simulator-metric__label">{label}</span>
      <strong className="simulator-metric__value">{value}{unit && <small>{unit}</small>}</strong>
      {detail && <span className="simulator-metric__detail">{detail}</span>}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  unit,
  min,
  max,
  step,
  description,
  source,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly description: string;
  readonly source: string;
  readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="simulator-field" htmlFor={id}>
      <span className="simulator-field__heading"><span>{label}</span><small>{unit}</small></span>
      <input id={id} type="number" value={value} min={min} max={max} step={step} onChange={onChange} />
      <span className="simulator-field__description">{description}</span>
      <span className="simulator-field__source">來源／作用：{source}</span>
    </label>
  );
}

function ReadOnlyTable({ rows }: { readonly rows: readonly { readonly label: string; readonly value: string; readonly unit?: string; readonly note?: string }[] }) {
  return (
    <dl className="simulator-ledger">
      {rows.map(row => (
        <div className="simulator-ledger__row" key={row.label}>
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

function PowerPanel({ frame, parameters, setParameters }: {
  readonly frame: SimulationAnalysisFrame;
  readonly parameters: SimulatorParameters;
  readonly setParameters: React.Dispatch<React.SetStateAction<SimulatorParameters>>;
}) {
  const update = (key: keyof SimulatorParameters) => (event: ChangeEvent<HTMLInputElement>) => updateNumber(event, key, setParameters);
  const link = frame.links[0]!;
  return (
    <div className="simulator-panel-grid">
      <Section title="可編輯的 canonical power inputs" subtitle="這五個欄位是限制條件／功耗模型參數；P_DL_actual 與 PA 功率不是輸入欄位。">
        <div className="simulator-form-grid">
          <NumberField id="beam-power-cap" label="P_beam_max（beam 上限）" unit="W" value={parameters.beamPowerCapW} min={0.001} step={0.001} description="單一 beam 的 RF 輸出上限。" source="Power constraint；會限制 p_req。" onChange={update('beamPowerCapW')} />
          <NumberField id="satellite-power-cap" label="P_sat_max（衛星上限）" unit="W" value={parameters.satellitePowerCapW} min={0.001} step={0.001} description="同一衛星所有 active beams 的 aggregate RF 上限。" source="Satellite cap；在 beam cap 後套用。" onChange={update('satellitePowerCapW')} />
          <NumberField id="eta-max" label="eta_max（PA 上限）" unit="0–1" value={parameters.etaMax} min={0.001} max={1} step={0.01} description="canonical load-dependent PA 曲線的上界。" source="Amplifier model bound；實際 eta_PA 由結果推導。" onChange={update('etaMax')} />
          <NumberField id="rfc-power" label="P_RFC（RF chain）" unit="W / active beam" value={parameters.rfcPowerW} min={0.001} step={0.001} description="每個 active beam 分攤的 RF-chain 功率。" source="Power ledger；隨 active beam 計入。" onChange={update('rfcPowerW')} />
          <NumberField id="bb-power" label="P_BB（baseband）" unit="W / satellite" value={parameters.basebandPerSatelliteW} min={0.001} step={0.001} description="衛星 baseband 功率，按 active beam 分攤。" source="Power ledger；不是 RF output。" onChange={update('basebandPerSatelliteW')} />
        </div>
        <button className="simulator-secondary-button" type="button" onClick={() => setParameters(DEFAULT_SIMULATOR_PARAMETERS)}>重設 canonical power inputs</button>
      </Section>
      <Section title="同一 frame 的功率結果" subtitle="所有數值由 canonical producer 推導，不能在此直接改寫。">
        <ReadOnlyTable rows={[
          { label: 'p_req（requested RF）', value: formatScientific(link.requestedPowerW), unit: ' W', note: 'cap 前需求' },
          { label: 'P_DL_actual（actual RF）', value: formatScientific(link.actualPowerW), unit: ' W', note: link.powerLimited ? '受 cap 限制' : '未受 cap 限制' },
          { label: 'eta_PA（實際效率）', value: formatScientific(frame.power.paEfficiencyB[0] ?? 0), note: 'derived，read-only' },
          { label: 'P_PA', value: formatScientific(frame.power.pPaBW[0] ?? 0), unit: ' W' },
          { label: 'P_RFC + P_BB + P_event', value: formatScientific((frame.power.pRfcBW[0] ?? 0) + (frame.power.pBbBW[0] ?? 0) + (frame.power.pEventBW[0] ?? 0)), unit: ' W' },
          { label: 'P_sys（system power）', value: formatScientific(frame.power.systemPowerW), unit: ' W' },
        ]} />
        <p className="simulator-note">Energy boundary：此處是 canonical payload-power boundary；目前不包含 bus、TT&amp;C、thermal 或其他衛星系統功耗。</p>
      </Section>
    </div>
  );
}

function SinrPanel({ frame }: { readonly frame: SimulationAnalysisFrame }) {
  const link = frame.links[0]!;
  return (
    <div className="simulator-panel-grid">
      <Section title="Realized SINR" subtitle="SINR 只讀取同一個 P_DL_actual 與同一個 frame；沒有獨立的 P_t 控制。">
        <div className="simulator-metrics-grid simulator-metrics-grid--four">
          <Metric label="Signal" value={formatScientific(link.signalW)} unit=" W" detail="received useful signal" />
          <Metric label="Interference" value={formatScientific(link.interferenceW)} unit=" W" detail="同色 co-channel" />
          <Metric label="Noise σ²" value={formatScientific(link.noiseW)} unit=" W" detail="canonical input" />
          <Metric label="SINR" value={formatNumber(link.sinrDb, 2)} unit=" dB" detail={`${formatScientific(link.sinrLinear)} linear`} />
        </div>
        <ReadOnlyTable rows={[
          { label: '共享的 P_DL_actual', value: formatScientific(link.actualPowerW), unit: ' W', note: '來自 Power projection' },
          { label: 'off-axis θ', value: formatNumber(link.offAxisAngleRad, 5), unit: ' rad' },
          { label: 'Taipei link distance', value: formatNumber(link.distanceKm, 1), unit: ' km' },
          { label: 'elevation', value: formatNumber(link.elevationDeg, 1), unit: '°' },
        ]} />
      </Section>
      <Section title="如何解讀" subtitle="先看 signal／interference／noise，再看 realized SINR；Power tab 的 cap 變更會沿同一鏈路傳到這裡。">
        <div className="simulator-explanation"><strong>{link.qosMet ? '目前達到服務目標' : '目前未達服務目標'}</strong><p>服務目標由 Throughput 分頁的「每位使用者最低傳輸速率要求」決定。通道增益使用所選 TLE 幾何推導的路徑損耗 H = 10⁻ᴸ⁄¹⁰；大氣、閃爍、陰影裕度與接收增益仍是明示的實驗假設，不代表硬體量測或完整校準。</p></div>
      </Section>
    </div>
  );
}

function ThroughputPanel({ frame, parameters, setParameters }: {
  readonly frame: SimulationAnalysisFrame;
  readonly parameters: SimulatorParameters;
  readonly setParameters: React.Dispatch<React.SetStateAction<SimulatorParameters>>;
}) {
  const update = (key: keyof SimulatorParameters) => (event: ChangeEvent<HTMLInputElement>) => updateNumber(event, key, setParameters);
  const link = frame.links[0]!;
  return (
    <div className="simulator-panel-grid">
      <Section title="Throughput inputs" subtitle="服務目標與 bandwidth 只在這個 projection 編輯；SINR、rate 與 P_DL_actual 仍是 derived。">
        <div className="simulator-form-grid">
          <NumberField id="minimum-rate" label="R_min（service target）" unit="bit/s" value={parameters.minimumRateBps} min={1} step={1000} description="此 beam 要求的最低服務速率。" source="gamma_req；決定 requested power。" onChange={update('minimumRateBps')} />
          <NumberField id="system-bandwidth" label="B_sys（system bandwidth）" unit="Hz" value={parameters.systemBandwidthHz} min={1} step={1000000} description="整個系統的可用頻寬；B_beam 由 B_sys / K_FR 推導。" source="Throughput formula；K_FR 由 SINR controls 提供。" onChange={update('systemBandwidthHz')} />
        </div>
      </Section>
      <Section title="Realized throughput" subtitle="這裡直接投影 canonical throughput ledger，不另算 SINR 或 rate。">
        <div className="simulator-metrics-grid simulator-metrics-grid--three">
          <Metric label="User rate R_u" value={formatNumber(link.rateBps, 1)} unit=" bit/s" detail={link.qosMet ? 'QoS met' : 'QoS not met'} />
          <Metric label="Total rate" value={formatNumber(frame.throughput.totalRateBps, 1)} unit=" bit/s" detail="service-set sum" />
          <Metric label="Spectral efficiency" value={formatNumber(link.rateBps / Math.max(frame.scenario.derived.beamBandwidthHz, 1), 4)} unit=" bit/s/Hz" detail="derived from B_beam" />
        </div>
        <ReadOnlyTable rows={[
          { label: 'gamma_req', value: formatScientific(frame.canonical.gammaReqB[0] ?? 0), unit: ' linear', note: 'derived from R_min / B_beam' },
          { label: 'p_req', value: formatScientific(link.requestedPowerW), unit: ' W', note: 'before caps' },
          { label: 'P_DL_actual', value: formatScientific(link.actualPowerW), unit: ' W', note: 'shared downstream' },
        ]} />
      </Section>
    </div>
  );
}

function EePanel({ frame }: { readonly frame: SimulationAnalysisFrame }) {
  const acceptedConstellation = frame.tleState.catalog.constellation;
  return (
    <div className="simulator-panel-grid">
      <Section title="Energy efficiency" subtitle="本頁只投影 canonical numerator／denominator；不以不同公式重算。">
        <div className="simulator-metrics-grid simulator-metrics-grid--three">
          <Metric label="Instantaneous EE" value={formatNumber(frame.ee.instantaneousBitsPerJ, 1)} unit=" bit/J" detail="這一個 frame" />
          <Metric label="Evaluation EE" value={formatNumber(frame.ee.evaluationBitsPerJ, 1)} unit=" bit/J" detail="single-frame ratio-of-sums" />
          <Metric label="P_sys" value={formatScientific(frame.power.systemPowerW)} unit=" W" detail="canonical denominator" />
        </div>
        <ReadOnlyTable rows={[
          { label: 'delivered bits', value: formatNumber(frame.ee.deliveredBits, 1), unit: ' bit', note: 'duration = 1 s' },
          { label: 'consumed energy', value: formatNumber(frame.ee.consumedEnergyJ, 4), unit: ' J' },
          { label: 'aggregation', value: 'ratio-of-sums', note: '累積尚未啟用；目前只有單一 frame' },
          { label: 'r1 user contribution', value: formatNumber(frame.canonical.ee.r1UBitsPerJ[0] ?? 0, 1), unit: ' bit/J' },
        ]} />
        <p className="simulator-note">目前 evaluation 只示範單一 frame 的 ratio-of-sums；不能解讀成跨時間累積，也不能解讀成節能比較或平台實測。</p>
      </Section>
      <Section title="能效邊界與來源" subtitle="保持物理量與證據邊界清楚。">
        <div className="simulator-explanation"><p><strong>來源：</strong>{frame.provenance.archiveCatalogUrl} → {frame.provenance.selectedTlePath}</p><p><strong>接受 constellation：</strong>{constellationLabel(acceptedConstellation)}；<strong>模型：</strong>{frame.provenance.propagationModel}，TLE epoch {frame.tleEpochUtc}；時間切換是 snapshot selection，不是 handover，也不產生 event energy。</p><p><strong>情境：</strong>固定 NTPU ground terminal + TLE/SGP4 幾何 + H = 10⁻ᴸ⁄¹⁰ 的路徑損耗鏈。通道與硬體輸入仍是可重現的實驗假設，不宣稱為量測校準或完整論文場景重現。</p></div>
      </Section>
    </div>
  );
}

function TabPanel({ activeTab, frame, parameters, setParameters }: {
  readonly activeTab: SimulatorTab;
  readonly frame: SimulationAnalysisFrame;
  readonly parameters: SimulatorParameters;
  readonly setParameters: React.Dispatch<React.SetStateAction<SimulatorParameters>>;
}) {
  if (activeTab === 'power') return <PowerPanel frame={frame} parameters={parameters} setParameters={setParameters} />;
  if (activeTab === 'throughput') return <ThroughputPanel frame={frame} parameters={parameters} setParameters={setParameters} />;
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
  initialConstellation = 'oneweb',
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
                <TabPanel activeTab={activeTab} frame={frame} parameters={parameters} setParameters={setParameters} />
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
